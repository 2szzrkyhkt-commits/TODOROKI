const API='https://laws.e-gov.go.jp/api/2';
const MAX_BODY=512*1024,INTERVAL=6*3600000;
const validLaw=id=>typeof id==='string'&&/^[0-9A-Z]{15}$/.test(id);
const validRevision=(id,law)=>typeof id==='string'&&id.startsWith(law+'_')&&/^[0-9A-Z_]{20,100}$/.test(id);
const sha=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),n=>n.toString(16).padStart(2,'0')).join('');
const validDate=d=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(d||''))return false;const n=new Date(d+'T00:00:00Z');return !Number.isNaN(n.valueOf())&&n.toISOString().slice(0,10)===d;};
async function save(env,key,value){if(!key.startsWith('history:'))throw Error('history namespace violation');return env.TAX.put(key,value);}
export const japanDay=iso=>new Date(Date.parse(iso)+9*3600000).toISOString().slice(0,10);
export function effectiveState(r,asOf){
 const d=r.amendment_enforcement_date;
 if(!validDate(d))return '施行日未確認';
 if(d>asOf)return '未施行';
 if(['Repeal','Expire','LossOfEffectiveness'].includes(r.repeal_status))return '廃止・失効版';
 if(r.current_revision_status==='PreviousEnforced')return '旧版';
 if(r.current_revision_status==='CurrentEnforced')return '現行版（公式区分）';
 return '施行日到来・現行性未確認';
}
const fields=['law_title','amendment_promulgate_date','amendment_enforcement_date','amendment_enforcement_comment','amendment_law_id','amendment_law_title','amendment_type','repeal_status','repeal_date','remain_in_force','current_revision_status'];
export function compareMetadata(before,after){
 return fields.filter(k=>JSON.stringify(before[k]??null)!==JSON.stringify(after[k]??null))
 .map(field=>({field,before:before[field]??null,after:after[field]??null}));
}
export function compareXml(before,after){
 if(before===after)return {state:'identical',changed:false,common_prefix_chars:before.length,before_chars:0,after_chars:0,before_excerpt:'',after_excerpt:'',excerpt_truncated:false};
 let a=0,b=0;while(a<Math.min(before.length,after.length)&&before[a]===after[a])a++;
 while(b<Math.min(before.length,after.length)-a&&before[before.length-1-b]===after[after.length-1-b])b++;
 const x=before.slice(a,b?before.length-b:undefined),y=after.slice(a,b?after.length-b:undefined);
 return {state:'compared',changed:true,common_prefix_chars:a,before_chars:x.length,after_chars:y.length,before_excerpt:x.slice(0,2000),after_excerpt:y.slice(0,2000),excerpt_truncated:x.length>2000||y.length>2000,
 method:'XML文字列の共通前後を除いた変更区間。文字位置はUTF-16単位。条文の法的意味や差分位置の網羅性は未判定。'};
}
async function bounded(response,max){
 if(!response.ok)throw Error('official HTTP '+response.status);
 const reader=response.body.getReader(),chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max)throw Error('body_limit');chunks.push(value);}}finally{await reader.cancel();}
 const out=new Uint8Array(size);let p=0;for(const b of chunks){out.set(b,p);p+=b.length;}return out;
}
async function official(path,max,fetcher){
 const url=API+path;const response=await fetcher(url,{headers:{Accept:path.includes('law_revisions')?'application/json':'application/xml','User-Agent':'TODOROKI-Tax-History/1.0'},signal:AbortSignal.timeout(45000)});
 return {url,bytes:await bounded(response,max)};
}
async function bodyFor(env,id,law,fetcher){
 const previous=await env.TAX.get('history:record:'+id,'json');
 if(previous?.sha256){const cached=await env.TAX.get('history:body:'+id,'arrayBuffer');
  if(cached&&await sha(cached)===previous.sha256)return {sha256:previous.sha256,bytes:cached.byteLength,text:new TextDecoder().decode(cached),source_url:previous.body_source_url};}
 const meta=await env.TAX.get('revision:'+id,'json');
 let bytes,url;
 if(meta&&meta.law_id===law&&meta.revision_id===id&&meta.bytes<=MAX_BODY){
  const raw=await env.TAX.get('raw:'+id,'arrayBuffer');
  if(raw&&raw.byteLength<=MAX_BODY&&await sha(raw)===meta.sha256){bytes=new Uint8Array(raw);url=meta.source_url;}
 }
 if(!bytes){const r=await official('/law_data/'+encodeURIComponent(id)+'?response_format=xml&law_full_text_format=xml&include_attached_file_content=false',MAX_BODY,fetcher);bytes=r.bytes;url=r.url;}
 const text=new TextDecoder().decode(bytes);
 if(!/<Law(?:\s|>)/.test(text)||/<Error>|<Code>[1-9]/.test(text))throw Error('invalid official XML');
 const digest=await sha(bytes);await save(env,'history:body:'+id,bytes);
 return {sha256:digest,bytes:bytes.byteLength,text,source_url:url};
}
export async function refreshHistory(env,law,{fetcher=fetch,now=new Date().toISOString(),verifyRoutes}={}){
 if(!validLaw(law))throw Error('invalid law id');
 const {url,bytes}=await official('/law_revisions/'+encodeURIComponent(law),2*1024*1024,fetcher);
 const data=JSON.parse(new TextDecoder().decode(bytes));
 if(data.law_info?.law_id!==law||!Array.isArray(data.revisions)||!data.revisions.length||data.revisions.length>500)throw Error('invalid official revision index');
 const ids=new Set();
 for(const r of data.revisions){if(!validRevision(r.law_revision_id,law)||ids.has(r.law_revision_id))throw Error('invalid/duplicate revision id');ids.add(r.law_revision_id);}
 const rows=[...data.revisions].sort((a,b)=>(b.amendment_enforcement_date||'').localeCompare(a.amendment_enforcement_date||'')||b.law_revision_id.localeCompare(a.law_revision_id));
 // Compare the newest two listed dates; neither is silently labelled currently applicable.
 const selected=rows.slice(0,2),bodies=[];
 for(const r of selected){
  let body;try{body=await bodyFor(env,r.law_revision_id,law,fetcher);}catch(e){body={unavailable:String(e).slice(0,160)};}
  bodies.push(body);
  const key='history:record:'+r.law_revision_id;
  if(!await env.TAX.get(key))await save(env,key,JSON.stringify({law_id:law,revision_id:r.law_revision_id,revision_info:r,first_seen_at:now,index_source_url:url,sha256:body.sha256??null,body_source_url:body.source_url??null}));
 }
 const after=selected[0],before=selected[1];
 const comparison=before?{before:before.law_revision_id,after:after.law_revision_id,metadata:compareMetadata(before,after),xml:bodies.every(b=>typeof b.text==='string')?compareXml(bodies[1].text,bodies[0].text):{state:'unverified',reason:'本文取得失敗・サイズ上限・未保存を含む',details:bodies.map(b=>b.unavailable??null)}}:{state:'single_revision',reason:'公式収録が1版のため版間比較は未確認'};
 const snapshot={schema:1,law_id:law,title:after.law_title,checked_at:now,source_url:url,source_index_sha256:await sha(bytes),as_of:japanDay(now),
 scope:'e-Govが返した改正一覧。全歴史の網羅・個別案件への適用・法的意味の自動判定は行わない。本文比較は最新の掲載施行日2版・各512KiB以内。',official_revision_count:rows.length,body_checks:selected.map((r,i)=>({revision_id:r.law_revision_id,sha256:bodies[i].sha256??null,bytes:bodies[i].bytes??null,source_url:bodies[i].source_url??null,state:bodies[i].sha256?'verified_body':'unverified'})),
 revisions:rows.map(r=>({revision_id:r.law_revision_id,enforcement_date:r.amendment_enforcement_date??null,promulgation_date:r.amendment_promulgate_date??null,amendment_title:r.amendment_law_title??null,official_status:r.current_revision_status??null,repeal_status:r.repeal_status??null,state:effectiveState(r,japanDay(now)),revision_info:r})),comparison};
 await save(env,'history:index:'+law,JSON.stringify(snapshot));
 const readback=await getHistory(env,law);
 if(JSON.stringify(readback)!==JSON.stringify(snapshot))throw Error('history readback mismatch');
 const html=renderHistory(readback);
 const verification={at:now,law_id:law,official_revision_count:rows.length,readback_matches:true,metadata_diff_count:comparison.metadata?.length??0,xml_state:comparison.xml?.state??comparison.state,
 rendered_dates:readback.revisions.every(r=>!r.enforcement_date||html.includes(r.enforcement_date)),original_namespaces_written:false,...(verifyRoutes?{authenticated_routes:await verifyRoutes(readback)}:{})};
 if(!verification.rendered_dates)throw Error('history display mismatch');
 await save(env,'history:verification',JSON.stringify(verification));
 return verification;
}
export async function getHistory(env,law){if(!validLaw(law))throw Error('invalid law id');return await env.TAX.get('history:index:'+law,'json');}
const esc=s=>String(s??'未確認').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderHistory(s){
 if(!s)return '<!doctype html><meta charset="utf-8"><p>この法令の履歴は未収集です。</p>';
 const changes=(s.comparison.metadata||[]).map(r=>'<tr><th>'+esc(r.field)+'</th><td>'+esc(r.before)+'</td><td>'+esc(r.after)+'</td></tr>').join('');
 const xml=s.comparison.xml;
 return '<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>税法改正履歴 | TODOROKI</title><style>body{margin:0;background:#080808;color:#eee;font:16px/1.8 system-ui}main{max-width:1000px;margin:auto;padding:24px}a{color:#e5c778}.scroll{overflow:auto}table{border-collapse:collapse;width:100%}td,th{border:1px solid #76633b;padding:10px;text-align:left}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#17140e;padding:12px}p{overflow-wrap:anywhere}</style><main><h1>'+esc(s.title)+'：改正履歴</h1><p>確認日時 '+esc(s.checked_at)+' ／ 施行状況の表示基準日（日本時間） '+esc(s.as_of)+'</p><p>'+esc(s.scope)+'</p><p><a href="'+esc(s.source_url)+'">公式の履歴データ</a></p><div class="scroll"><table><caption>取得日と施行日を区別した公式収録版</caption><tr><th>施行日</th><th>公布日</th><th>状態</th><th>改正法令</th><th>版ID</th></tr>'+s.revisions.map(r=>'<tr><td>'+esc(r.enforcement_date)+'</td><td>'+esc(r.promulgation_date)+'</td><td>'+esc(r.state)+'</td><td>'+esc(r.amendment_title)+'</td><td>'+esc(r.revision_id)+'</td></tr>').join('')+'</table></div><h2>選択2版のメタデータ差分</h2><p>前 '+esc(s.comparison.before)+' → 後 '+esc(s.comparison.after)+'</p><div class="scroll"><table><tr><th>項目</th><th>前</th><th>後</th></tr>'+changes+'</table></div><h2>本文XMLの変更区間</h2><p>検証状態 '+esc(xml?.state??s.comparison.state)+'。XMLの文字列比較であり、条文の法的意味や税額への影響の判定ではありません。</p>'+(xml?.state==='compared'?'<p>変更区間：前 '+xml.before_chars+'文字 → 後 '+xml.after_chars+'文字。'+(xml.excerpt_truncated?'抜粋は各2,000文字まで。全文の差分表示ではありません。':'')+'</p><h3>前</h3><pre>'+esc(xml.before_excerpt)+'</pre><h3>後</h3><pre>'+esc(xml.after_excerpt)+'</pre>':'')+'</main></html>';
}
export async function historyTick(env,{verifyRoutes}={}){
 const state=await env.TAX.get('history:state','json')||{queue:[],cursor:null};
 if(state.next_at&&Date.now()<Date.parse(state.next_at))return {state:'within_interval',next_at:state.next_at};
 if(!state.queue.length){const page=await env.TAX.list({prefix:'law:',limit:10,...(state.cursor?{cursor:state.cursor}:{})});state.queue=page.keys.map(k=>k.name);state.cursor=page.list_complete?null:page.cursor;}
 if(!state.queue.length)return {state:'no_stored_laws'};
 const key=state.queue[0],law=key.slice(4);const result=await refreshHistory(env,law,{verifyRoutes});
 state.queue.shift();state.next_at=new Date(Date.now()+INTERVAL).toISOString();state.last_law_id=law;state.last_success=result.at;
 await save(env,'history:state',JSON.stringify(state));return {...result,next_at:state.next_at};
}
