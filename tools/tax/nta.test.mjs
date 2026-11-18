import assert from 'node:assert/strict';
import {ntaURL,ntaLinks,ntaHTML,ntaTick,robotsAllows,NTA_SEEDS} from './nta.mjs';
import {tick} from './worker.mjs';
const base=NTA_SEEDS[0],doc='https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1000.htm';
let cases=0;
function test(name,fn){return Promise.resolve().then(fn).then(()=>{cases++;console.log('NTA PASS '+name);});}
class KV {
  map=new Map();writes=[];corrupt=false;
  async put(k,v){assert.ok(k.startsWith('nta:'));this.writes.push(k);this.map.set(k,typeof v==='string'?new TextEncoder().encode(v):new Uint8Array(v));}
  async get(k,type){const v=this.map.get(k);if(!v)return null;if(type==='json')return JSON.parse(new TextDecoder().decode(v));if(type==='arrayBuffer')return this.corrupt?new Uint8Array([0]).buffer:v.slice().buffer;return new TextDecoder().decode(v);}
}
const html=(title,links='')=>`<!doctype html><html><meta charset="utf-8"><h1>${title}</h1>${links}</html>`;
const response=(s,type='text/html; charset=UTF-8')=>new Response(s,{headers:{'content-type':type}});
const robots='User-agent: *\nDisallow: /service_publication/\n';
function fetcher(extra=()=>response(html('公式資料'))){let calls=[];return {calls,fetch:async(u,o)=>{calls.push(u);assert.equal(o.redirect,'manual');return u.endsWith('/robots.txt')?response(robots,'text/plain'):extra(u,o);}};}
await test('official origin and path only',()=>{
 assert.equal(ntaURL('../shotoku/1000.htm#x'),doc);
 for(const bad of ['http://www.nta.go.jp/law/tsutatsu/menu.htm','https://evil.test/law/tsutatsu/a.htm','https://www.nta.go.jp.evil.test/law/tsutatsu/a.htm','https://x@www.nta.go.jp/law/tsutatsu/a.htm','https://www.nta.go.jp/law/tsutatsu/a.htm?q=x','https://www.nta.go.jp/law/tsutatsu/%2e%2e/a.htm','https://www.nta.go.jp/law/tsutatsu/a%2fb.htm','https://www.nta.go.jp/index.htm','javascript:alert(1)'])assert.equal(ntaURL(bad),null,bad);
});
await test('links deduplicate; scripts, comments, forms and assets excluded',()=>{
 const input=`<a href='../shotoku/1000.htm#a'>one</a><a href="${doc}">two</a><a href=../shotoku/2000.htm>three</a><!-- <a href='../shotoku/3000.htm'> --> <script>"<a href='../shotoku/4000.htm'>"</script><img src='../shotoku/5000.htm'><form action='../shotoku/6000.htm'></form>`;
 assert.deepEqual(ntaLinks(input,base),[doc,doc.replace('1000','2000')]);
});
await test('robots specificity, wildcard, allow tie and group selection',()=>{
 assert.equal(robotsAllows(robots,doc),true);
 assert.equal(robotsAllows('User-agent: *\nDisallow: /',doc),false);
 assert.equal(robotsAllows('User-agent: *\nDisallow: /\nAllow: /taxes/',doc),true);
 assert.equal(robotsAllows('User-agent: *\nDisallow: /*1000.htm$',doc),false);
 assert.equal(robotsAllows('User-agent: *\nDisallow: /\nUser-agent: todoroki-tax-collector\nAllow: /',doc),true);
 assert.throws(()=>robotsAllows('<html>failed</html>',doc));
});
await test('UTF-8 and Shift JIS; malformed pages rejected',()=>{
 assert.ok(ntaHTML(new TextEncoder().encode(html('税'))).includes('税'));
 assert.ok(ntaHTML(new Uint8Array([...Buffer.from('<html><h1>'),0x90,0xc5,...Buffer.from('</h1></html>')]),'text/html; charset=Shift_JIS').includes('税'));
 assert.throws(()=>ntaHTML(new TextEncoder().encode('<html><h1>partial')));
 assert.throws(()=>ntaHTML(new TextEncoder().encode('<html><title>403 forbidden</title><h1>x</h1></html>')));
});
await test('two requests, verified bytes, source, queue progress and no e-Gov writes',async()=>{
 const kv=new KV(),f=fetcher(u=>response(html('国税庁',u===base?`<a href="${doc}">税</a>`:'')));
 const r=await ntaTick({TAX:kv},{fetcher:f.fetch,now:100000});
 assert.equal(f.calls.length,3);assert.equal(r.pages_saved,2);assert.equal(r.known,3);assert.equal(r.queue_remaining,1);assert.equal(r.completed_scans,0);assert.equal(r.last_verified.readback,true);
 const pages=[...kv.map.keys()].filter(k=>k.startsWith('nta:page:'));assert.equal(pages.length,2);
 for(const key of pages){const m=await kv.get(key,'json');assert.equal(m.source_url,m.url);assert.match(m.sha256,/^[a-f0-9]{64}$/);assert.ok(m.license_url);const b=await kv.get(m.raw_key,'arrayBuffer');assert.equal(b.byteLength,m.bytes);}
});
await test('scan completion, next scan delay and unchanged version deduplication',async()=>{
 const kv=new KV(),f=fetcher();let r=await ntaTick({TAX:kv},{fetcher:f.fetch,now:100000});assert.equal(r.completed_scans,1);const bytes=r.stored_version_bytes;
 r=await ntaTick({TAX:kv},{fetcher:f.fetch,now:110000});assert.equal(r.state,'waiting');assert.equal(f.calls.length,3);
 r=await ntaTick({TAX:kv},{fetcher:f.fetch,now:100000+86400000});assert.equal(r.saved,0);assert.equal(r.stored_version_bytes,bytes);assert.equal(r.completed_scans,2);
});
await test('403 blocks and preserves targets without retrying',async()=>{
 const kv=new KV(),f=fetcher(()=>new Response('',{status:403}));let r=await ntaTick({TAX:kv},{fetcher:f.fetch,now:100000});assert.equal(r.blocked,'UPSTREAM_ACCESS_DENIED');assert.equal(r.queue_remaining,2);assert.equal(r.pages_saved,0);
 await ntaTick({TAX:kv},{fetcher:f.fetch,now:999999999});assert.equal(f.calls.length,2);
});
await test('robots denial prevents document requests',async()=>{
 const kv=new KV();let count=0;const r=await ntaTick({TAX:kv},{fetcher:async()=>{count++;return response('User-agent: *\nDisallow: /','text/plain');},now:100000});assert.equal(count,1);assert.equal(r.blocked,'ROBOTS_DISALLOW');assert.equal(r.pages_saved,0);
});
await test('404, redirect, 429, invalid PDF and content type remain queued',async()=>{
 for(const status of [302,404,429,500]){const kv=new KV(),f=fetcher(()=>new Response('',{status}));const r=await ntaTick({TAX:kv},{fetcher:f.fetch,now:100000});assert.equal(r.queue_remaining,2);assert.equal(r.completed_scans,0);assert.equal(r.pages_saved,0);assert.equal(r.failed.length,2);assert.ok((await kv.get('nta:state','json')).queue.every(x=>x.due>100000));}
 const kv=new KV(),f=fetcher(()=>response('fake','application/pdf'));assert.equal((await ntaTick({TAX:kv},{fetcher:f.fetch,now:100000})).pages_saved,0);
});
await test('readback corruption cannot produce a success report',async()=>{
 const kv=new KV();kv.corrupt=true;await assert.rejects(()=>ntaTick({TAX:kv},{fetcher:fetcher().fetch,now:100000}),/READBACK_MISMATCH/);
});
await test('Retry-After wins over local delay; valid and truncated PDF differ',async()=>{
 const kv=new KV(),f=fetcher(()=>new Response('',{status:429,headers:{'Retry-After':'172800'}}));await ntaTick({TAX:kv},{fetcher:f.fetch,now:100000});assert.ok((await kv.get('nta:state','json')).queue.every(q=>q.due===172900000));
 for(const valid of [true,false]){
  const store=new KV(),pdf=doc.replace('.htm','.pdf');await store.put('nta:state',JSON.stringify({queue:[{url:pdf,due:0,attempts:0}],known:[pdf],saved:0,bytes:0,scans:0}));
  const fx=fetcher(()=>response('%PDF-1.7\nsynthetic\n'+(valid?'%%EOF':''),'application/pdf'));const r=await ntaTick({TAX:store},{fetcher:fx.fetch,now:100000});assert.equal(r.pages_saved,valid?1:0);assert.equal(r.completed_scans,valid?1:0);
 }
});
await test('storage bound stops without deleting or claiming scan completion',async()=>{
 const kv=new KV();await kv.put('nta:state',JSON.stringify({queue:NTA_SEEDS.map(url=>({url,due:0,attempts:0})),known:[...NTA_SEEDS],bytes:64*1024*1024,saved:0,scans:0}));const r=await ntaTick({TAX:kv},{fetcher:fetcher().fetch,now:100000});assert.equal(r.blocked,'STORAGE_BUDGET');assert.equal(r.completed_scans,0);assert.equal(r.queue_remaining,2);assert.equal(r.pages_saved,0);
});
await test('e-Gov failure is retained; NTA succeeds; shared status is written once',async()=>{
 const kv=new KV();kv.put=async(k,v)=>{kv.writes.push(k);kv.map.set(k,typeof v==='string'?new TextEncoder().encode(v):new Uint8Array(v));};
 await kv.put('state',JSON.stringify({seeded:true,category:0,offset:0,scans:0,saved:5,page_loaded:true,next_offset:null,queue:[{law_info:{law_id:'133AC0000000067'},revision_info:{law_revision_id:'test-revision',law_title:'公式法令の試験'}}]}));
 await kv.put('history:state',JSON.stringify({queue:[],next_at:new Date(Date.now()+86400000).toISOString()}));kv.writes=[];
 const original=globalThis.fetch,fx=fetcher();globalThis.fetch=async(u,o)=>String(u).startsWith('https://www.nta.go.jp/')?fx.fetch(u,o):new Response('',{status:503});
 try{await assert.rejects(()=>tick({TAX:kv}),/law downloads failed/);}finally{globalThis.fetch=original;}
 const status=await kv.get('status','json');assert.equal(status.total_saved,5);assert.equal(status.failed.length,1);assert.equal(status.nta.pages_saved,2);assert.equal(kv.writes.filter(k=>k==='status').length,1);assert.equal((await kv.get('state','json')).queue.length,1);assert.equal(Object.hasOwn(status,'history'),false);
 const bad=new KV(),get=bad.get.bind(bad);bad.put=async(k,v)=>{bad.writes.push(k);bad.map.set(k,typeof v==='string'?new TextEncoder().encode(v):new Uint8Array(v));};bad.get=async(k,t)=>{if(k==='state')throw Error('isolated state-read failure');return get(k,t);};
 globalThis.fetch=fx.fetch;
 try{await assert.rejects(()=>tick({TAX:bad}),/isolated state-read failure/);}finally{globalThis.fetch=original;}
 assert.equal((await bad.get('status','json')).nta.pages_saved,2);assert.equal((await bad.get('status','json')).phase,'failed');
});
const circular='https://www.nta.go.jp/law/tsutatsu/kihon/shotoku/01.htm';
async function oldQueue(queue,next_family){const kv=new KV();await kv.put('nta:state',JSON.stringify({schema:1,queue:queue.map(q=>typeof q==='string'?{url:q,attempts:0,due:0}:q),known:queue.map(q=>typeof q==='string'?q:q.url),saved:0,bytes:0,scans:0,...(next_family?{next_family}:{})}));return kv;}
await test('legacy FIFO queue serves both source families within two requests',async()=>{
 const urls=Array.from({length:20},(_,i)=>doc.replace('1000',String(1000+i)));const kv=await oldQueue([...urls,circular]);const fx=fetcher();const r=await ntaTick({TAX:kv},{fetcher:fx.fetch,now:100000});
 assert.deepEqual(fx.calls.filter(u=>!u.endsWith('robots.txt')),[urls[0],circular]);assert.deepEqual(r.verified.map(x=>x.source_family),['taxanswer','tsutatsu']);assert.equal(r.queue_remaining,19);assert.equal(r.checked,2);
 const state=await kv.get('nta:state','json');assert.equal(state.next_family,'taxanswer');assert.deepEqual(state.queue.map(x=>x.url),urls.slice(1));assert.equal(state.known.length,21);
});
await test('future retry is not pulled forward; the available family uses the budget',async()=>{
 const future={url:circular,attempts:4,due:999999999},other=doc.replace('1000','2000');const kv=await oldQueue([future,doc,other],'tsutatsu'),fx=fetcher();const r=await ntaTick({TAX:kv},{fetcher:fx.fetch,now:100000});
 assert.deepEqual(fx.calls.filter(u=>!u.endsWith('robots.txt')),[doc,other]);assert.equal(r.completed_scans,0);assert.deepEqual((await kv.get('nta:state','json')).queue,[future]);
 const again=await ntaTick({TAX:kv},{fetcher:fx.fetch,now:110000});assert.equal(again.checked,0);assert.equal(again.queue_remaining,1);assert.equal(fx.calls.length,3);
});
await test('persisted family turn and Shift JIS evidence survive a restart',async()=>{
 const kv=await oldQueue([doc,circular],'tsutatsu');const bytes=new Uint8Array([...Buffer.from('<html><meta charset="shift_jis"><h1>'),0x90,0xc5,...Buffer.from('</h1></html>')]);
 const fx=fetcher(u=>u===circular?response(bytes,'text/html'):response(html('UTF8')));const r=await ntaTick({TAX:kv},{fetcher:fx.fetch,now:100000});
 assert.deepEqual(fx.calls.filter(u=>!u.endsWith('robots.txt')),[circular,doc]);assert.equal(r.verified.length,2);assert.equal(r.verified[0].encoding,'shift_jis');assert.equal(r.verified[0].title,'税');assert.equal(r.verified[0].bytes,bytes.length);assert.equal(r.verified[0].readback,true);assert.equal(r.verified[1].encoding,'utf-8');
});
// Failed metadata writes leave conservative reservations on the retained queue item.
async function retryFixture({bytes=0}={}) {
 const kv=await oldQueue([doc]);const state=await kv.get('nta:state','json');state.bytes=bytes;await kv.put('nta:state',JSON.stringify(state));
 const put=kv.put.bind(kv),get=kv.get.bind(kv);let failMeta=true,failRaw=false,corruptRaw=false,title='A';
 kv.put=async(k,v)=>{if((failMeta&&k.startsWith('nta:page:'))||(failRaw&&k.startsWith('nta:raw:')))throw Error('synthetic storage failure');return put(k,v);};
 kv.get=async(k,t)=>corruptRaw&&k.startsWith('nta:raw:')&&t==='arrayBuffer'?new Uint8Array([0]).buffer:get(k,t);
 const fx=fetcher(()=>response(html(title)));
 return {kv,fx,set(options){({failMeta=failMeta,failRaw=failRaw,corruptRaw=corruptRaw,title=title}=options);},run:now=>ntaTick({TAX:kv},{fetcher:fx.fetch,now}),size:()=>new TextEncoder().encode(html(title)).length};
}
await test('metadata failure retains one reservation across same-content retries and completion',async()=>{
 const f=await retryFixture(),size=f.size();let r=await f.run(100000);assert.equal(r.stored_version_bytes,size);assert.equal(r.failed.length,1);
 const first=await f.kv.get('nta:state','json');assert.equal(first.queue[0].due,3700000);
 r=await f.run(3700000);assert.equal(r.stored_version_bytes,size);assert.equal((await f.kv.get('nta:state','json')).queue[0].reserved_raw_keys.length,1);assert.equal((await f.kv.get('nta:state','json')).queue[0].due,10900000);
 f.set({failMeta:false});r=await f.run(10900000);assert.equal(r.stored_version_bytes,size);assert.equal(r.completed_scans,1);assert.equal(r.pages_saved,1);
 assert.equal(Object.hasOwn((await f.kv.get('nta:state','json')).queue[0],'reserved_raw_keys'),false);
});
await test('A failure then B failure then A retry preserves both reservations without double counting',async()=>{
 const f=await retryFixture();const a=f.size();await f.run(100000);f.set({title:'BBB'});const b=f.size();let r=await f.run(3700000);assert.equal(r.stored_version_bytes,a+b);
 const state=await f.kv.get('nta:state','json');assert.equal(new Set(state.queue[0].reserved_raw_keys).size,2);
 f.set({title:'A',failMeta:false});r=await f.run(10900000);assert.equal(r.stored_version_bytes,a+b);assert.equal(r.completed_scans,1);
});
await test('reserved same hash can finish at the cap but changed hash cannot exceed it',async()=>{
 const size=new TextEncoder().encode(html('A')).length,cap=64*1024*1024;
 const f=await retryFixture({bytes:cap-size});await f.run(100000);f.set({failMeta:false});let r=await f.run(3700000);assert.equal(r.blocked,null);assert.equal(r.completed_scans,1);assert.equal(r.stored_version_bytes,cap);
 const g=await retryFixture({bytes:cap-size});await g.run(100000);g.set({title:'B',failMeta:false});r=await g.run(3700000);assert.equal(r.blocked,'STORAGE_BUDGET');assert.equal(r.completed_scans,0);assert.equal(r.stored_version_bytes,cap);
});
await test('reserved retry must still verify raw bytes and cannot claim success on corruption',async()=>{
 const f=await retryFixture();await f.run(100000);f.set({failMeta:false,corruptRaw:true});const r=await f.run(3700000);
 assert.equal(r.stored_version_bytes,f.size());assert.equal(r.failed[0].code,'READBACK_MISMATCH');assert.equal(r.completed_scans,0);assert.equal(r.queue_remaining,1);assert.equal(r.pages_saved,0);
});
await test('failed raw write keeps conservative reservation and retry reattempts storage',async()=>{
 const f=await retryFixture();f.set({failRaw:true});await f.run(100000);assert.equal([...f.kv.map.keys()].filter(k=>k.startsWith('nta:raw:')).length,0);
 f.set({failRaw:false,failMeta:false});const r=await f.run(3700000);assert.equal(r.stored_version_bytes,f.size());assert.equal(r.completed_scans,1);assert.equal([...f.kv.map.keys()].filter(k=>k.startsWith('nta:raw:')).length,1);
});
await test('legacy queue without reservation retains its existing byte total and reserves conservatively',async()=>{
 const f=await retryFixture({bytes:1234});f.set({failMeta:false});const r=await f.run(100000);assert.equal(r.stored_version_bytes,1234+f.size());assert.equal(r.completed_scans,1);
});
console.log('T20 NTA: '+cases+' isolated cases passed; no live requests or production writes.');
