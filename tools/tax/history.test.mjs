import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {refreshHistory,getHistory,historyTick,compareMetadata,compareXml,effectiveState,renderHistory,japanDay} from './history.mjs';
import worker,{classify,collectTax,tick} from './worker.mjs';
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
eq(japanDay('2026-11-16T15:00:00Z'),'2026-11-17');eq(japanDay('2026-11-16T14:59:59Z'),'2026-11-16');
const law='133AC0000000067',old=law+'_20170401_429AC0000000004',recent=law+'_20180401_429AC0000000004';
const date='2026-11-17T03:20:00.000Z';
const before={law_revision_id:old,law_title:'国税犯則取締法',amendment_enforcement_date:'2017-04-01',amendment_promulgate_date:'2017-03-31',current_revision_status:'PreviousEnforced',repeal_status:'None',amendment_type:'3'};
const after={...before,law_revision_id:recent,amendment_enforcement_date:'2018-04-01',repeal_date:'2018-04-01',current_revision_status:'Repeal',repeal_status:'Repeal',amendment_type:'8'};
const index={law_info:{law_id:law},revisions:[before,after]};
const xmls=new Map([[old,'<?xml version="1.0"?><Law><Article>旧条文の試験用データ</Article></Law>'],[recent,'<?xml version="1.0"?><Law><Article>廃止後の試験用データ</Article></Law>']]);
const hash=b=>createHash('sha256').update(b).digest('hex');
function memory({corruptReadback=false}={}){
 const map=new Map(),writes=[],reads=[];return {map,writes,reads,
 async get(k,type){reads.push(k);let v=map.get(k);if(v===undefined)return null;if(corruptReadback&&k.startsWith('history:index:'))v='{}';
 if(type==='json')return JSON.parse(v);if(type==='arrayBuffer')return typeof v==='string'?new TextEncoder().encode(v).buffer:Uint8Array.from(v).buffer;return v;},
 async put(k,v){writes.push(k);map.set(k,v instanceof Uint8Array?Uint8Array.from(v):v);},
 async list({prefix,limit,cursor}){const keys=[...map.keys()].filter(k=>k.startsWith(prefix)).sort(),offset=Number(cursor||0);return {keys:keys.slice(offset,offset+limit).map(name=>({name})),list_complete:offset+limit>=keys.length,cursor:String(offset+limit)};}
 };
}
const fetches=[];const fetcher=async url=>{fetches.push(url);if(url.includes('/law_revisions/'))return Response.json(index);
 const id=decodeURIComponent(new URL(url).pathname.split('/').pop());return new Response(xmls.get(id),{status:xmls.has(id)?200:404});};
const kv=memory(),env={TAX:kv,SETUP_TOKEN:'fixture-only-not-a-real-credential'};
const raw=new TextEncoder().encode(xmls.get(recent));
const meta={law_id:law,revision_id:recent,bytes:raw.length,sha256:hash(raw),source_url:'https://laws.e-gov.go.jp/api/2/law_data/'+recent};
kv.map.set('law:'+law,JSON.stringify(meta));kv.map.set('revision:'+recent,JSON.stringify(meta));kv.map.set('raw:'+recent,raw);
kv.map.set('state',JSON.stringify({seeded:true,queue:[],next_scan_at:Date.now()+86400000,saved:243}));
kv.map.set('status',JSON.stringify({total_saved:243}));
const original=new Map([...kv.map].map(([k,v])=>[k,typeof v==='string'?v:hash(v)]));
const verification=await refreshHistory(env,law,{fetcher,now:date});
eq(verification.readback_matches,true);eq(verification.xml_state,'compared');eq(verification.rendered_dates,true);
eq(fetches.length,2); // one index, one older body; current original body reused
assert.ok(kv.writes.every(k=>k.startsWith('history:')));checks++;
for(const [k,v]of original)eq(typeof kv.map.get(k)==='string'?kv.map.get(k):hash(kv.map.get(k)),v);
const snapshot=await getHistory(env,law);
eq(snapshot.revisions.length,2);eq(snapshot.revisions.map(r=>r.revision_id),[recent,old]);
eq(snapshot.revisions[0].state,'廃止・失効版');eq(snapshot.revisions[1].state,'旧版');
eq(snapshot.comparison.before,old);eq(snapshot.comparison.after,recent);
eq(snapshot.comparison.metadata.find(x=>x.field==='repeal_status'),{field:'repeal_status',before:'None',after:'Repeal'});
assert.ok(snapshot.comparison.xml.before_excerpt.includes('旧条文'));checks++;
const html=renderHistory(snapshot);assert.ok(html.includes('2017-04-01')&&html.includes('2018-04-01')&&html.includes(date));checks++;
assert.ok(html.includes('&lt;')||!html.includes('<Article>'));checks++;
const injected=renderHistory({...snapshot,title:'<img src=x onerror=alert(1)>',comparison:{...snapshot.comparison,xml:{state:'compared',before_excerpt:'<script>bad</script>',after_excerpt:'<img src=x>'}}});
eq(injected.includes('<script>bad</script>'),false);eq(injected.includes('&lt;script&gt;bad&lt;/script&gt;'),true);
const firstRecords=new Map([...kv.map].filter(([k])=>k.startsWith('history:record:')));
fetches.length=0;await refreshHistory(env,law,{fetcher,now:'2026-11-18T00:00:00Z'});
eq(fetches.length,1);for(const [k,v]of firstRecords)eq(kv.map.get(k),v);
eq(compareXml('abc','abc').state,'identical');eq(compareXml('abc','abx').before_excerpt,'c');eq(compareXml('','abc').after_excerpt,'abc');
eq(compareXml('abc','').before_excerpt,'abc');eq(compareXml('X'.repeat(3000),'Y'.repeat(3001)).excerpt_truncated,true);
eq(compareMetadata({law_title:'a'},{law_title:'a'}),[]);
for(const [r,expected]of [[{amendment_enforcement_date:null},'施行日未確認'],[{amendment_enforcement_date:'2026-99-99'},'施行日未確認'],[{amendment_enforcement_date:'2026-02-30'},'施行日未確認'],[{...after,amendment_enforcement_date:'2027-01-01'},'未施行'],[{...before,current_revision_status:'CurrentEnforced'},'現行版（公式区分）'],[{...before,current_revision_status:'unknown'},'施行日到来・現行性未確認']])eq(effectiveState(r,'2026-11-17'),expected);
for(const id of ['',null,'../state',law+'_bad']){await assert.rejects(()=>getHistory(env,id));checks++;}
for(const data of [{...index,law_info:{law_id:'340AC0000000033'}},{...index,revisions:[before,before]},{...index,revisions:[]},{...index,revisions:[{...before,law_revision_id:'bad'}]}]){
 const m=memory();await assert.rejects(()=>refreshHistory({TAX:m},law,{fetcher:async()=>Response.json(data),now:date}));checks++;eq(m.writes.length,0);
}
await assert.rejects(()=>refreshHistory(env,law,{fetcher:async()=>new Response('',{status:503})}));checks++;
await assert.rejects(()=>refreshHistory({TAX:memory({corruptReadback:true})},law,{fetcher,now:date}));checks++;
const big=memory();const large=await refreshHistory({TAX:big},law,{now:date,fetcher:async u=>u.includes('law_revisions')?Response.json(index):new Response('<Law>'+('a'.repeat(524288))+'</Law>')});
eq(large.xml_state,'unverified');eq((await getHistory({TAX:big},law)).comparison.xml.state,'unverified');
const missing=await refreshHistory({TAX:memory()},law,{now:date,fetcher:async u=>u.includes('law_revisions')?Response.json({law_info:{law_id:law},revisions:[after]}):new Response('<Error>bad</Error>')});
eq(missing.xml_state,'single_revision');
const make=(url,headers={})=>new Request('https://private.example'+url,{headers});
let response=await worker.fetch(make('/history?law_id='+law),env);eq(response.status,401);
response=await worker.fetch(make('/history?law_id='+law,{Authorization:'Bearer wrong'}),env);eq(response.status,401);
const auth={Authorization:'Bearer '+env.SETUP_TOKEN};
response=await worker.fetch(make('/history?law_id='+law,auth),env);eq(response.status,200);eq((await response.json()).law_id,law);eq(response.headers.get('Cache-Control'),'no-store');
response=await worker.fetch(make('/history?law_id='+law,{...auth,Accept:'text/html'}),env);eq(response.status,200);assert.ok((await response.text()).includes('税法改正履歴'));checks++;
assert.ok(response.headers.get('Content-Security-Policy').includes("frame-ancestors 'none'"));checks++;
response=await worker.fetch(make('/history?law_id=bad',auth),env);eq(response.status,400);
response=await worker.fetch(make('/history?law_id=340AC0000000033',auth),env);eq(response.status,404);
response=await worker.fetch(make('/status'),env);eq((await response.json()).total_saved,243);
eq(classify('地方税法'),['住民税','事業税','固定資産税']);
const report=await collectTax(env);eq(report.phase,'idle');eq(kv.map.get('state'),original.get('state'));
const originalFetch=globalThis.fetch;globalThis.fetch=fetcher;
try{
 const first=await historyTick(env);eq(first.readback_matches,true);
 const n=kv.writes.length;const second=await historyTick(env);eq(second.state,'within_interval');eq(kv.writes.length,n);
}finally{globalThis.fetch=originalFetch;}
eq(JSON.parse(kv.map.get('history:state')).queue.length,0);
const active=memory();active.map.set('state',JSON.stringify({seeded:true,queue:[{law_info:{law_id:law},revision_info:after}],saved:0,category:0,offset:0,page_loaded:true,next_offset:null}));
active.map.set('history:state',JSON.stringify({queue:[],next_at:new Date(Date.now()+86400000).toISOString()}));
globalThis.fetch=async()=>new Response(xmls.get(recent));
try{
 const result=await tick({TAX:active});eq(result.saved,1);eq(result.total_saved,1);eq(result.history.state,'within_interval');
 eq(JSON.parse(active.map.get('law:'+law)).revision_id,recent);eq(JSON.parse(active.map.get('state')).category,1);
 const fail=memory();fail.map.set('state',JSON.stringify({seeded:true,queue:[{law_info:{law_id:law},revision_info:after}],saved:0,category:0,offset:0,page_loaded:true,next_offset:null}));
 globalThis.fetch=async()=>new Response('',{status:503});
 await assert.rejects(()=>tick({TAX:fail}));checks++;eq(JSON.parse(fail.map.get('state')).queue.length,1);eq(fail.map.has('history:state'),false);
}finally{globalThis.fetch=originalFetch;}
await import('node:fs/promises').then(async fs=>{await fs.mkdir('quality-results',{recursive:true});await fs.writeFile('quality-results/tax-history-fixture.html',html);});
console.log('T21 history: '+checks+' assertions passed; synthetic XML fixture, official-style revision metadata, namespace preservation, readback, bounds, dates, authenticated JSON/HTML and cadence.');
