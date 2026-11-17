import {historyTick,getHistory,renderHistory} from './history.mjs';
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
  const prefix=new TextDecoder().decode(raw.subarray(0,Math.min(raw.length,10000)));
  if (!prefix.includes('<Law') || /<Error>|<Code>[1-9]/.test(prefix)) throw new Error('invalid law XML');
  const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),b=>b.toString(16).padStart(2,'0')).join('');
  await env.TAX.put(`raw:${rev}`,raw);
  const meta={law_id:id,revision_id:rev,title:r.law_title,subjects:classify(r.law_title),classification:'名称による仮分類・条文分類未確認',source_url:url.href,collected_at:new Date().toISOString(),sha256,bytes:raw.length,revision_info:r};
  await env.TAX.put(`revision:${rev}`,JSON.stringify(meta));
  await env.TAX.put(`law:${id}`,JSON.stringify(meta));
  return true;
}
export async function collectTax(env) {
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
    await env.TAX.put('status',JSON.stringify({...report,total_saved:state.saved,completed_scans:state.scans,queue_remaining:state.queue.length}));
    console.log(JSON.stringify({event:'tax_tick',...report,total_saved:state.saved}));
    if(report.failed.length)throw new Error(`${report.failed.length} law downloads failed; retained for retry`);
    return {...report,total_saved:state.saved,queue_remaining:state.queue.length};
  } catch(e) {
    console.error(JSON.stringify({event:'tax_tick_failed',error:String(e)}));
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
 const report=await collectTax(env);
 try{report.history=await historyTick(env);}
 catch(e){report.history={state:'failed',error:String(e).slice(0,160)};console.error(JSON.stringify({event:'tax_history_failed',error:report.history.error}));}
 return report;
}
async function authorized(request,env) {
  if(!env.SETUP_TOKEN)return false;
  const enc=new TextEncoder();
  const [a,b]=await Promise.all([crypto.subtle.digest('SHA-256',enc.encode(request.headers.get('Authorization')||'')),crypto.subtle.digest('SHA-256',enc.encode('Bearer '+env.SETUP_TOKEN))]);
  const aa=new Uint8Array(a),bb=new Uint8Array(b);let mismatch=0;for(let i=0;i<aa.length;i++)mismatch|=aa[i]^bb[i];return mismatch===0;
}
export default {
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
