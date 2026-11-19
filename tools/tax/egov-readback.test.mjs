import assert from 'node:assert/strict';
import {collectTax,tick} from './worker.mjs';
import {createEgovFetcher,refreshHistory,historyTick} from './history.mjs';
const enc=new TextEncoder(), xml=enc.encode('<Law><LawBody>公式法令の隔離試験</LawBody></Law>');
const digest=async raw=>Buffer.from(await crypto.subtle.digest('SHA-256',raw)).toString('hex');
const law={law_info:{law_id:'TEST-LAW'},revision_info:{law_revision_id:'TEST-REV',law_title:'所得税法'}};
class KV {
 map=new Map(); failKey=null; corruptKey=null; writes=[];
 async get(k,type){let v=this.map.get(k);if(v==null)return null;if(k===this.corruptKey)v=enc.encode('corrupted');if(type==='json')return JSON.parse(new TextDecoder().decode(v));if(type==='arrayBuffer')return v.slice().buffer;return new TextDecoder().decode(v);}
 async put(k,v){if(k===this.failKey)throw Error('isolated write failure');this.writes.push(k);this.map.set(k,typeof v==='string'?enc.encode(v):new Uint8Array(v));}
}
async function fixture(){const kv=new KV();await kv.put('state',JSON.stringify({seeded:true,category:0,offset:0,saved:0,scans:0,page_loaded:true,next_offset:50,queue:[law]}));return kv;}
async function meta(){return {law_id:'TEST-LAW',revision_id:'TEST-REV',sha256:await digest(xml),bytes:xml.length,title:'所得税法'};}
let cases=0,fetches=0;const original=globalThis.fetch;
globalThis.fetch=async()=>{fetches++;return new Response(xml,{headers:{'Content-Type':'application/xml'}});};
async function test(name,fn){await fn();cases++;console.log('EGOV PASS '+name);}
try{
 await test('existing metadata without raw never counts as verified skip',async()=>{const kv=await fixture();await kv.put('revision:TEST-REV',JSON.stringify(await meta()));await assert.rejects(()=>collectTax({TAX:kv}),/downloads failed/);assert.equal((await kv.get('state','json')).queue.length,1);assert.equal((await kv.get('status','json')).skipped,0);});
 await test('new original and both metadata keys are verified before success',async()=>{const kv=await fixture();const r=await collectTax({TAX:kv});assert.equal(r.saved,1);assert.equal(r.verified.length,1);assert.equal(r.verified[0].readback,true);assert.equal(r.verified[0].sha256,await digest(xml));assert.equal(r.verified[0].bytes,xml.length);assert.equal((await kv.get('state','json')).queue.length,0);});
 await test('corrupt raw readback leaves target queued and metadata unwritten',async()=>{const kv=await fixture();kv.corruptKey='raw:TEST-REV';await assert.rejects(()=>collectTax({TAX:kv}),/downloads failed/);assert.equal(await kv.get('revision:TEST-REV'),null);assert.equal((await kv.get('state','json')).saved,0);assert.equal((await kv.get('state','json')).queue.length,1);});
 await test('revision metadata readback failure cannot produce success',async()=>{const kv=await fixture();kv.corruptKey='revision:TEST-REV';await assert.rejects(()=>collectTax({TAX:kv}),/downloads failed/);assert.equal(await kv.get('law:TEST-LAW'),null);assert.equal((await kv.get('state','json')).saved,0);});
 await test('retry after index write failure restores absent pointer without redownload',async()=>{const kv=await fixture();kv.failKey='law:TEST-LAW';await assert.rejects(()=>collectTax({TAX:kv}),/downloads failed/);kv.failKey=null;const before=fetches;const r=await collectTax({TAX:kv});assert.equal(fetches,before);assert.equal(r.skipped,1);assert.equal(r.saved,0);assert.equal(r.verified[0].index_repaired,true);assert.equal((await kv.get('law:TEST-LAW','json')).revision_id,'TEST-REV');});
 await test('valid existing raw checked without overwriting a different index revision',async()=>{const kv=await fixture();await kv.put('revision:TEST-REV',JSON.stringify(await meta()));await kv.put('raw:TEST-REV',xml);const other=JSON.stringify({law_id:'TEST-LAW',revision_id:'OTHER-REV'});await kv.put('law:TEST-LAW',other);kv.writes=[];const before=fetches;const r=await collectTax({TAX:kv});assert.equal(r.skipped,1);assert.equal(fetches,before);assert.equal(await kv.get('law:TEST-LAW'),other);assert.ok(!kv.writes.includes('law:TEST-LAW'));});
 await test('raw corruption on an existing revision is not silently skipped',async()=>{const kv=await fixture();await kv.put('revision:TEST-REV',JSON.stringify(await meta()));await kv.put('raw:TEST-REV',enc.encode('broken'));await assert.rejects(()=>collectTax({TAX:kv}),/downloads failed/);assert.equal((await kv.get('state','json')).queue.length,1);});
}finally{globalThis.fetch=original;}
console.log(`T20 e-Gov readback: ${cases} isolated cases; no live requests or production writes.`);


// Host gate tests use only in-memory storage and synthetic responses.
{
 const lawId='133AC0000000067',rev1=lawId+'_20180401_429AC0000000004',rev2=lawId+'_20170401_428AC0000000015';
 const makeLaw=(id=lawId)=>({law_info:{law_id:id},revision_info:{law_revision_id:id+'_20180401_429AC0000000004',law_title:'税法'}});
 class GateKV extends KV{async list(){return {keys:[{name:'law:'+lawId}],list_complete:true};}}
 const stop=e=>e.egovStop===true;
 const index=()=>Response.json({law_info:{law_id:lawId},revisions:[{law_revision_id:rev1,law_title:'税法',amendment_enforcement_date:'2018-04-01'},{law_revision_id:rev2,law_title:'税法',amendment_enforcement_date:'2017-04-01'}]});
 async function queued(){const kv=new GateKV();await kv.put('state',JSON.stringify({seeded:true,category:1,offset:50,saved:9,scans:1,page_loaded:true,next_offset:100,queue:Array.from({length:5},()=>makeLaw())}));return kv;}
 await test('host gate 429 measures response time, persists, and suppresses every subsequent e-Gov request',async()=>{
  const kv=new GateKV();let now=100000,calls=0;const fetcher=async()=>{calls++;now=145000;return new Response('',{status:429,headers:{'Retry-After':'7200'}});};
  const f=createEgovFetcher({TAX:kv},{fetcher,clock:()=>now});await assert.rejects(()=>f('https://laws.e-gov.go.jp/api/2/laws'),stop);assert.equal(calls,1);assert.equal((await kv.get('history:upstream','json')).until,7345000);
  await assert.rejects(()=>f('https://laws.e-gov.go.jp/api/2/law_revisions/'+lawId),stop);assert.equal(calls,1);
  const again=createEgovFetcher({TAX:kv},{fetcher,clock:()=>7344999});await assert.rejects(()=>again('https://laws.e-gov.go.jp/api/2/laws'),stop);assert.equal(calls,1);
  let resumed=0;await createEgovFetcher({TAX:kv},{fetcher:async()=>{resumed++;return new Response('ok');},clock:()=>7345000})('https://laws.e-gov.go.jp/api/2/laws');assert.equal(resumed,1);
 });
 await test('host gate absolute dates and invalid/huge Retry-After remain conservative',async()=>{
  const now=Date.parse('2026-11-19T00:00:00Z');
  for(const [value,until] of [['Thu, 19 Nov 2026 02:00:00 GMT',now+7200000],['0',now+3600000],['-1',now+3600000],['bad',now+3600000]]){
   const kv=new GateKV(),f=createEgovFetcher({TAX:kv},{clock:()=>now,fetcher:async()=>new Response('',{status:429,headers:{'Retry-After':value}})});await assert.rejects(()=>f('https://laws.e-gov.go.jp/api/2/laws'),stop);assert.equal((await kv.get('history:upstream','json')).until,until);
  }
  const kv=new GateKV(),f=createEgovFetcher({TAX:kv},{clock:()=>now,fetcher:async()=>new Response('',{status:429,headers:{'Retry-After':'9'.repeat(400)}})});await assert.rejects(()=>f('https://laws.e-gov.go.jp/api/2/laws'),stop);assert.equal((await kv.get('history:upstream','json')).state,'blocked');
 });
 await test('archive stop preserves all queued work, cursor and archived originals',async()=>{
  for(const status of [401,403,429]){
   const kv=await queued();await kv.put('raw:KEEP',xml);const before=await kv.get('state','json');let calls=0;
   const f=createEgovFetcher({TAX:kv},{fetcher:async()=>{calls++;return new Response('',{status});}});
   await assert.rejects(()=>collectTax({TAX:kv},{egovFetch:f}));const after=await kv.get('state','json');assert.deepEqual(after.queue,before.queue);for(const k of ['category','offset','next_offset','saved','scans'])assert.equal(after[k],before[k]);assert.equal(calls,1);assert.deepEqual(new Uint8Array(await kv.get('raw:KEEP','arrayBuffer')),xml);
   if(status!==429){await assert.rejects(()=>createEgovFetcher({TAX:kv},{clock:()=>8e15,fetcher:async()=>{throw Error('must not fetch');}})('https://laws.e-gov.go.jp/api/2/laws'),stop);}
  }
 });
 await test('catalog stop leaves previous collection state untouched',async()=>{
  const kv=await queued(),s=await kv.get('state','json');s.queue=[];s.page_loaded=false;await kv.put('state',JSON.stringify(s));const before=await kv.get('state');
  const f=createEgovFetcher({TAX:kv},{fetcher:async()=>new Response('',{status:429})});await assert.rejects(()=>collectTax({TAX:kv},{egovFetch:f}),stop);assert.equal(await kv.get('state'),before);assert.equal(await kv.get('catalog:036:50'),null);
 });
 await test('history first body stop does not request second body or replace prior snapshot',async()=>{
  for(const status of [401,403,429]){
   const kv=new GateKV();await kv.put('history:index:'+lawId,'{"previous":true}');await kv.put('history:state','{"queue":["law:'+lawId+'"],"cursor":"keep"}');const before=await kv.get('history:state');let calls=0;
   const f=createEgovFetcher({TAX:kv},{fetcher:async()=>++calls===1?index():new Response('',{status})});await assert.rejects(()=>historyTick({TAX:kv},{egovFetch:f}),stop);assert.equal(calls,2);assert.equal(await kv.get('history:state'),before);assert.equal(await kv.get('history:index:'+lawId),'{"previous":true}');assert.equal(await kv.get('history:record:'+rev2),null);
  }
 });
 await test('failed gate persistence still prevents history in same shared invocation',async()=>{
  const kv=await queued();kv.failKey='history:upstream';let calls=0;const f=createEgovFetcher({TAX:kv},{fetcher:async()=>{calls++;return new Response('',{status:429});}});
  await assert.rejects(()=>collectTax({TAX:kv},{egovFetch:f}));await assert.rejects(()=>refreshHistory({TAX:kv},lawId,{egovFetch:f}),e=>stop(e)&&e.egovGate.code==='EGOV_GATE_STORAGE_UNAVAILABLE');assert.equal(calls,1);
 });
 await test('malformed or unreadable persisted gate fails closed before network',async()=>{
  for(const broken of ['{"state":"rate_limited","until":null,"code":"x"}','[]','false','0','bad']){
   const kv=new GateKV();await kv.put('history:upstream',broken);let calls=0;const f=createEgovFetcher({TAX:kv},{fetcher:async()=>{calls++;return new Response('ok');}});await assert.rejects(()=>f('https://laws.e-gov.go.jp/api/2/laws'),stop);assert.equal(calls,0);
  }
 });
 await test('tick shares collector stop with history while independent NTA continues',async()=>{
  const kv=await queued();await kv.put('law:'+lawId,JSON.stringify({law_id:lawId}));let egov=0,nta=0;const previous=globalThis.fetch;
  globalThis.fetch=async url=>{if(String(url).startsWith('https://laws.e-gov.go.jp/')){egov++;return new Response('',{status:429});}nta++;return String(url).endsWith('robots.txt')?new Response('User-agent: *\nAllow: /',{headers:{'Content-Type':'text/plain'}}):new Response('<html><h1>国税庁</h1></html>',{headers:{'Content-Type':'text/html'}});};
  try{await assert.rejects(()=>tick({TAX:kv}));}finally{globalThis.fetch=previous;}
  assert.equal(egov,1);assert.equal(nta,3);assert.equal((await kv.get('status','json')).nta.pages_saved,2);assert.equal((await kv.get('status','json')).egov.state,'rate_limited');
 });
 await test('history index stop after idle collection persists gate in shared status',async()=>{
  const kv=await queued(),s=await kv.get('state','json');s.queue=[];s.next_scan_at=Date.now()+86400000;await kv.put('state',JSON.stringify(s));await kv.put('status','{"total_saved":9}');let egov=0;const previous=globalThis.fetch;
  globalThis.fetch=async url=>{if(String(url).startsWith('https://laws.e-gov.go.jp/')){egov++;return new Response('',{status:403});}return String(url).endsWith('robots.txt')?new Response('User-agent: *\\nAllow: /',{headers:{'Content-Type':'text/plain'}}):new Response('<html><h1>NTA</h1></html>',{headers:{'Content-Type':'text/html'}});};
  try{await tick({TAX:kv});}finally{globalThis.fetch=previous;}
  assert.equal(egov,1);assert.equal((await kv.get('status','json')).egov.code,'EGOV_HTTP_403');assert.equal((await kv.get('status','json')).total_saved,9);
 });
 console.log('T20 e-Gov readback + host safety: '+cases+' isolated cases; no live requests.');
}
