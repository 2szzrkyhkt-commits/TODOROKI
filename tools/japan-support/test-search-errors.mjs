import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {searchPrograms} from './eligibility.js';
const code=fs.readFileSync(new URL('./worker.js',import.meta.url),'utf8')
 .replace(/^import .*;\n/gm,'').replace('export default','const handler=')
 .replace('export class SupportCollector','class SupportCollector');
const detail='synthetic-private-storage-error';
const context=vm.createContext({Response,URL,WorkerEntrypoint:class{},assets:{},searchPrograms});
vm.runInContext(code+';globalThis.handler=handler;',context);
function fixture(result,throws=false){
 let reads=0;
 const DB={prepare(){return{bind(){return this},async all(){reads++;if(throws)throw Error(detail);return result}}}};
 return {direct:filters=>searchPrograms({DB},filters),reads:()=>reads,
 fetch:(query='',authorized=true)=>context.handler.fetch(new Request('https://fixture.invalid/api/search'+query),{DB,ACCESS_VERIFIED:'true',ACCESS_AUD:'fixture'},authorized?{access:{aud:'fixture',getIdentity:async()=>({email:'synthetic@example.test'})}}:{})};
}
function secure(r){for(const[k,v]of Object.entries({'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}))assert.equal(r.headers.get(k),v);assert.match(r.headers.get('Content-Security-Policy'),/frame-ancestors 'none'/);}
for(const [name,result,throws]of [
 ['false empty',{success:false,results:[],error:detail}],
 ['false partial',{success:false,results:[{id:'synthetic-partial'}],error:detail}],
 ['null',null],['undefined',undefined],['missing results',{success:true}],
 ['null results',{success:true,results:null}],['object results',{success:true,results:{}}],
 ['throw',null,true],
])test('search failure '+name+' never returns successful results',async()=>{
 const f=fixture(result,throws);await assert.rejects(()=>f.direct({}),throws?new RegExp(detail):/search_storage_failed/);
 const r=await f.fetch();assert.equal(r.status,503);secure(r);assert.deepEqual(await r.json(),{error:'search_unavailable'});assert.equal(f.reads(),2);
});
for(const results of [[],[{id:'synthetic-program',name:'fixture'}]])test('successful '+results.length+' search results preserved',async()=>{
 const f=fixture({success:true,results});assert.deepEqual((await f.direct({})).programs,results);
 const r=await f.fetch();assert.equal(r.status,200);secure(r);assert.deepEqual((await r.json()).programs,results);
});
for(const query of ['?region=invalid','?q='+('a'.repeat(101))])test('invalid search still 400: '+query.slice(0,20),async()=>{
 const f=fixture({success:true,results:[]}),r=await f.fetch(query);assert.equal(r.status,400);secure(r);assert.equal(f.reads(),0);assert.deepEqual(await r.json(),{error:'search_unavailable'});
});
test('scope limit stays 400 and never returns partial matches',async()=>{const f=fixture({success:true,results:Array(101).fill({id:'fixture'})});await assert.rejects(()=>f.direct({}),/search_scope_limit/);const r=await f.fetch();assert.equal(r.status,400);assert.deepEqual(await r.json(),{error:'search_unavailable'});});
test('unauthenticated search performs no database reads',async()=>{const f=fixture({success:true,results:[]});const r=await f.fetch('',false);assert.equal(r.status,403);secure(r);assert.equal(f.reads(),0);});

test('legacy results-only adapter remains compatible',async()=>{const f=fixture({results:[]});assert.deepEqual((await f.direct({})).programs,[]);const r=await f.fetch();assert.equal(r.status,200);secure(r);assert.deepEqual((await r.json()).programs,[]);});
