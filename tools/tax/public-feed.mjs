// Public link metadata only. No original content, hashes, KV keys or credentials.
export const PUBLIC_LIMIT=30;
const MAX_BATCH=100;
export function safePublicLink(row){
 if(!row||typeof row!=='object'||Array.isArray(row))return null;
 const {title,official_url,checked_at}=row;
 if(typeof title!=='string'||!title.trim()||title.length>180||/[\x00-\x1f\x7f<>]/.test(title))return null;
 if(typeof official_url!=='string'||official_url.length>400||!/^https:\/\/www\.nta\.go\.jp\/(?:taxes\/shiraberu\/taxanswer\/[a-z]+\/\d{3,5}\.htm|law\/tsutatsu\/[a-z0-9_/-]+\.htm)$/.test(official_url))return null;
 if(official_url.includes('//',8)||official_url.includes('/../')||official_url.includes('/./'))return null;
 if(typeof checked_at!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(checked_at)||!Number.isFinite(Date.parse(checked_at))||new Date(checked_at).toISOString()!==checked_at.replace(/Z$/,checked_at.includes('.')?'Z':'.000Z'))return null;
 return {title:title.trim(),official_url,checked_at};
}
const compareText=(a,b)=>a<b?-1:a>b?1:0;
function ordered(rows){
 const seen=new Set();
 return rows.sort((a,b)=>Date.parse(b.checked_at)-Date.parse(a.checked_at)||compareText(a.official_url,b.official_url)||compareText(a.title,b.title)).filter(r=>{if(seen.has(r.official_url))return false;seen.add(r.official_url);return true;}).slice(0,PUBLIC_LIMIT);
}
export function publicLinks(value){
 if(!Array.isArray(value)||value.length>PUBLIC_LIMIT)return [];
 return ordered(value.map(safePublicLink).filter(Boolean));
}
export function mergePublicLinks(prior,report){
 const good=publicLinks(prior);
 if(!report||!Array.isArray(report.verified)||report.verified.length>MAX_BATCH)return good;
 // An empty, failed or waiting run must not erase successful prior results.
 if(!report.verified.length)return good;
 const rows=[];
 for(const row of report.verified){
  const link=safePublicLink({title:row?.title,official_url:row?.url,checked_at:report.at});
  if(!link||row.readback!==true||row.source_family!==(link.official_url.includes('/law/tsutatsu/')?'tsutatsu':'taxanswer'))return good;
  rows.push(link);
 }
 return ordered([...good,...rows]);
}
export async function persistCombinedStatus(env,report){
 // Reuses the idle read; non-idle runs add exactly one read. Read failure stops
 // the status update instead of overwriting an unavailable good prior snapshot.
 const previous=await env.TAX.get('status','json')||{};
 const {history,nta,...collection}=report;
 const status=report.phase==='idle'?previous:collection;
 const nta_public_links=mergePublicLinks(previous.nta_public_links,nta);
 await env.TAX.put('status',JSON.stringify({...status,...(report.egov?{egov:report.egov}:{}),nta,nta_public_links}));
}
export async function readPublicLinks(env){
 try{
  // One fixed key, no caller-selected keys/cursors, bounded decode and output.
  const raw=await env.TAX.get('status');
  if(typeof raw!=='string'||raw.length>256*1024)return [];
  return publicLinks(JSON.parse(raw)?.nta_public_links);
 }catch{return [];}
}
