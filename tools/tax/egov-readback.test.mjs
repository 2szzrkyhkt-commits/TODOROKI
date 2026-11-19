import assert from 'node:assert/strict';
import {collectTax} from './worker.mjs';
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
