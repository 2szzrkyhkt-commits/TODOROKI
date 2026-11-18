import {isLawXml} from './xml.mjs';
import {historyTick,getHistory,renderHistory} from './history.mjs';
import {ntaTick} from './nta.mjs';
const BASE = 'https://laws.e-gov.go.jp/api/2';
const CATEGORIES = ['013', '036'];
export const SUBJECTS = ['所得税法','法人税法','相続税法','消費税法','酒税法','住民税','事業税','固定資産税','国税徴収法'];
export const STUDY_SUBJECTS = ['簿記論','財務諸表論',...SUBJECTS];
export function classify(title) {
  if (title.startsWith('地方税法')) return ['住民税','事業税','固定資産税'];
  const hits = SUBJECTS.filter(s => title.includes(s));
  return hits.length ? hits : ['共通・関連法令'];
}
async function bounded(response, max) {
  if (!response.ok) throw new Error(`upstream HTTP ${response.status}`);
  const reader=response.body.getReader();const chunks=[];let total=0;
  try { while (true) {const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>max)throw new Error('upstream too large');chunks.push(value);}}
  finally {await reader.cancel();}
  const data=new Uint8Array(total);let at=0;for(const c of chunks){data.set(c,at);at+=c.byteLength;}return data;
}
async function api(path, params) {
  const url=new URL(BASE+path);Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,String(v)));
  const response=await fetch(url,{headers:{Accept:'application/json','User-Agent':'TODOROKI-Tax-Collector/1.0'},signal:AbortSignal.timeout(45000)});
  const raw=await bounded(response,2*1024*1024);
  return {data:JSON.parse(new TextDecoder().decode(raw)),url:url.href};
}
async function archive(env, law) {
  const r=law.revision_info, id=law.law_info.law_id, rev=r.law_revision_id;
  if (!rev || !id) throw new Error('missing revision id');
  if (await env.TAX.get(`revision:${rev}`)) return false;
  const url=new URL(`${BASE}/law_data/${encodeURIComponent(rev)}`);
  url.searchParams.set('response_format','xml');url.searchParams.set('law_full_text_format','xml');url.searchParams.set('include_attached_file_content','false');
  const response=await fetch(url,{headers:{Accept:'application/xml','User-Agent':'TODOROKI-Tax-Collector/1.0'},signal:AbortSignal.timeout(60000)});
  const raw=await bounded(response,24*1024*1024);
  if (!isLawXml(raw)) throw new Error('invalid law XML');
  const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),b=>b.toString(16).padStart(2,'0')).join('');
  await env.TAX.put(`raw:${rev}`,raw);
  const meta={law_id:id,revision_id:rev,title:r.law_title,subjects:classify(r.law_title),classification:'名称による仮分類・条文分類未確認',source_url:url.href,collected_at:new Date().toISOString(),sha256,bytes:raw.length,revision_info:r};
  await env.TAX.put(`revision:${rev}`,JSON.stringify(meta));
  await env.TAX.put(`law:${id}`,JSON.stringify(meta));
  return true;
}
export async function collectTax(env,{persistStatus=true}={}) {
  let state=await env.TAX.get('state','json') || {category:0,offset:0,queue:[],next_offset:null,saved:0,scans:0,seeded:false};
  const report={at:new Date().toISOString(),saved:0,skipped:0,failed:[],phase:'collect',scope:'国税・地方財政の候補法令。通達・条例・旧版の遡及収集・試験年度確定は未対応。'};
  try {
    if (!state.seeded) {
      const seed=await env.TAX.get('seed','json');
      state.queue=seed || [];state.seeded=true;
      report.phase='seed';
    }
    if (!state.queue.length) {
      if(state.next_scan_at && Date.now()<state.next_scan_at) {report.phase='idle';return report;}
      const {data,url}=await api('/laws',{category_cd:CATEGORIES[state.category],limit:50,offset:state.offset});
      if(!Array.isArray(data.laws))throw new Error('invalid catalog');
      if(data.next_offset!=null && data.next_offset<=state.offset)throw new Error('invalid pagination');
      await env.TAX.put(`catalog:${CATEGORIES[state.category]}:${state.offset}`,JSON.stringify({source_url:url,checked_at:report.at,...data}));
      state.queue=data.laws;state.next_offset=data.next_offset ?? null;state.page_loaded=true;
      report.catalog_total=data.total_count;
    }
    // Single scheduled writer; manual setup invocations must not overlap with cron.
    const pending=state.queue.splice(0,3), retry=[];
    for(const law of pending) {
      try {if(await archive(env,law)){report.saved++;state.saved++;}else report.skipped++;}
      catch(e) {const fail={id:law.law_info?.law_id,error:String(e).slice(0,300)};report.failed.push(fail);retry.push(law);console.error(JSON.stringify({event:'tax_archive_failed',...fail}));}
    }
    // Rotate failures rather than blocking every subsequent law in the same page.
    state.queue.push(...retry);
    if(!state.queue.length && state.page_loaded) {
      if(state.next_offset!=null)state.offset=state.next_offset;
      else {state.category++;state.offset=0;if(state.category>=CATEGORIES.length){state.category=0;state.scans++;state.next_scan_at=Date.now()+6*3600000;}}
      state.page_loaded=false;
    }
    state.last_run=report.at;state.last_error=report.failed.length?report.failed:null;
    await env.TAX.put('state',JSON.stringify(state));
    const result={...report,total_saved:state.saved,completed_scans:state.scans,queue_remaining:state.queue.length};
    if(persistStatus)await env.TAX.put('status',JSON.stringify(result));
    console.log(JSON.stringify({event:'tax_tick',...report,total_saved:state.saved}));
    if(report.failed.length){const e=new Error(`${report.failed.length} law downloads failed; retained for retry`);e.collectionReport=result;throw e;}
    return result;
  } catch(e) {
    console.error(JSON.stringify({event:'tax_tick_failed',error:String(e)}));
    e.collectionReport??={...report,phase:'failed',collection_error:'COLLECTION_TICK_FAILED',total_saved:state.saved,completed_scans:state.scans,queue_remaining:state.queue.length};
    throw e;
  }
}

export async function listCatalog(env, {cursor, subject, query = ''} = {}) {
  if (subject && !STUDY_SUBJECTS.includes(subject) && subject !== '共通・関連法令') throw new Error('invalid subject');
  if (query.length > 100 || (cursor && cursor.length > 2048)) throw new Error('invalid query');
  const page = await env.TAX.list({prefix:'law:',limit:20,...(cursor?{cursor}:{})});
  const rows = await Promise.all(page.keys.map(k=>env.TAX.get(k.name,'json')));
  const laws = rows.filter(Boolean).map(m=>({...m,subjects:classify(m.title)}))
    .filter(m=>(!subject||m.subjects.includes(subject))&&(!query||m.title.includes(query)));
  return {subjects:STUDY_SUBJECTS,laws,next_cursor:page.list_complete?null:page.cursor,
    page_scanned:page.keys.length,classification:'名称による仮分類・条文分類未確認',
    notice:'検索・科目絞り込みは取得ページ単位。続きがある場合はnext_cursorで取得。簿記論・財務諸表論の教材は未収録。'};
}

export async function tick(env) {
 let report={},collectionFailure;
 try{report=await collectTax(env,{persistStatus:false});}catch(e){report=e.collectionReport;collectionFailure=e;}
 try{report.history=await historyTick(env,{verifyRoutes:async snapshot=>{
  const headers={Authorization:'Bearer '+env.SETUP_TOKEN};
  const endpoint='https://internal.invalid/history?law_id='+encodeURIComponent(snapshot.law_id);
  const json=await taxWorker.fetch(new Request(endpoint,{headers}),env);
  if(json.status!==200||JSON.stringify(await json.json())!==JSON.stringify(snapshot))throw Error('authenticated JSON readback mismatch');
  const html=await taxWorker.fetch(new Request(endpoint,{headers:{...headers,Accept:'text/html'}}),env);
  if(html.status!==200||await html.text()!==renderHistory(snapshot))throw Error('authenticated HTML readback mismatch');
  return {json_200_and_matches:true,html_200_and_matches:true,method:'in-process actual handler; existing credential stays in binding/request memory; no network transmission'};
 }});}
 catch(e){report.history={state:'failed',error:String(e).slice(0,160)};console.error(JSON.stringify({event:'tax_history_failed',error:report.history.error}));}
 // Independent source family: an e-Gov failure must not masquerade as an NTA failure.
 try{report.nta=await ntaTick(env);}
 catch{report.nta={state:'failed',at:new Date().toISOString(),code:'NTA_STORAGE_OR_STATE_FAILED'};}
 // One write to the shared status key per tick (KV same-key rate limit).
 const status=report.phase==='idle'?(await env.TAX.get('status','json')||{}):report;
 await env.TAX.put('status',JSON.stringify({...status,nta:report.nta}));
 if(collectionFailure)throw collectionFailure;
 return report;
}
async function authorized(request,env) {
  if(!env.SETUP_TOKEN)return false;
  const enc=new TextEncoder();
  const [a,b]=await Promise.all([crypto.subtle.digest('SHA-256',enc.encode(request.headers.get('Authorization')||'')),crypto.subtle.digest('SHA-256',enc.encode('Bearer '+env.SETUP_TOKEN))]);
  const aa=new Uint8Array(a),bb=new Uint8Array(b);let mismatch=0;for(let i=0;i<aa.length;i++)mismatch|=aa[i]^bb[i];return mismatch===0;
}
const taxWorker = {
  async scheduled(controller,env,ctx) {ctx.waitUntil(tick(env));},
  async fetch(request,env) {
    const path=new URL(request.url).pathname;
    if(request.method==='GET'&&path==='/status')return Response.json(await env.TAX.get('status','json')||{phase:'not_started'}, {headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex'}});
    if(request.method==='GET'&&path==='/history') {
      if(!await authorized(request,env))return Response.json({error:'Unauthorized'},{status:401,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex'}});
      try{
       const data=await getHistory(env,new URL(request.url).searchParams.get('law_id'));
       const headers={'Cache-Control':'no-store','X-Robots-Tag':'noindex','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"};
       if(request.headers.get('Accept')?.includes('text/html'))return new Response(renderHistory(data),{status:data?200:404,headers:{...headers,'Content-Type':'text/html; charset=utf-8'}});
       return Response.json(data??{state:'not_collected'},{status:data?200:404,headers});
      }catch{return Response.json({error:'Invalid or unavailable law history'},{status:400,headers:{'Cache-Control':'no-store'}});}
    }
    if(request.method==='GET'&&path==='/catalog') {
      if(!await authorized(request,env)) return Response.json({error:'Unauthorized'},{status:401});
      const u=new URL(request.url);
      try {return Response.json(await listCatalog(env,{cursor:u.searchParams.get('cursor'),subject:u.searchParams.get('subject'),query:u.searchParams.get('q')||''}),{headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex'}});}
      catch(e){return Response.json({error:'Catalog unavailable or invalid parameters'},{status:400});}
    }
    if(request.method==='POST'&&path==='/setup-run'&&await authorized(request,env)) {
      try{return Response.json(await tick(env));}catch(e){return Response.json({error:String(e)}, {status:502});}
    }
    return new Response('Not found',{status:404});
  }
};

export default taxWorker;
