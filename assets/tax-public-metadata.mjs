// Shared allowlist for the deliberately public metadata projection only.
export function publicMetadata(value, now=Date.now()) {
 if(!Array.isArray(value)||value.length>30)throw Error('invalid_metadata');
 const seen=new Set();const rows=[];
 for(const row of value){
  if(!row||typeof row!=='object'||typeof row.title!=='string'||!row.title.trim()||row.title.length>180||/[\x00-\x1f\x7f]/.test(row.title)||typeof row.official_url!=='string'||row.official_url.length>400||typeof row.checked_at!=='string')throw Error('invalid_metadata');
  const u=new URL(row.official_url);
  if(u.origin!=='https://www.nta.go.jp'||u.username||u.password||u.search||u.hash||!/^\/(?:taxes\/shiraberu\/taxanswer\/[a-z]+\/\d{3,5}|law\/tsutatsu\/[a-z0-9_/-]+)\.htm$/.test(u.pathname)||u.href!==row.official_url)throw Error('invalid_metadata');
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|\+09:00)$/.test(row.checked_at)||!Number.isFinite(Date.parse(row.checked_at))||Date.parse(row.checked_at)>now+300000)throw Error('invalid_metadata');
  if(seen.has(u.href))continue;seen.add(u.href);
  rows.push({title:row.title.trim(),official_url:u.href,checked_at:row.checked_at});
 }
 if(new TextEncoder().encode(JSON.stringify(rows)).length>32768)throw Error('invalid_metadata');
 return rows;
}
