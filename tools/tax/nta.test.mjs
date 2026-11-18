import assert from 'node:assert/strict';
import {ntaURL,ntaLinks,ntaHTML,ntaTick,robotsAllows,NTA_SEEDS} from './nta.mjs';
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
console.log('T20 NTA: '+cases+' isolated cases passed; no live requests or production writes.');
