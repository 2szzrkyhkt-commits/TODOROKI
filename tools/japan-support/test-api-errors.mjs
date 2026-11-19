import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Synthetic records only. No database, network, credentials or publication.
const code=fs.readFileSync(new URL('./worker.js',import.meta.url),'utf8')
 .replace(/^import .*;\n/gm,'').replace('export default','const handler=')
 .replace('export class SupportCollector','class SupportCollector');
const privateDetail='synthetic-private-database-detail';
const settings={ACCESS_VERIFIED:'true',ACCESS_AUD:'fixture'};
const identity={access:{aud:'fixture',getIdentity:async()=>({email:'synthetic@example.test'})}};
function fixture(mode='ok') {
 let reads=0;const logs=[];
 const fail=()=>{reads++;if(mode==='throw')throw Error(privateDetail);};
 const result=()=>mode==='false'?{success:false,results:[]}:
  mode==='shape'?{success:true,results:null}:{success:true,results:[{id:'fixture'}]};
 const db={prepare(){return {bind(){return this},async all(){fail();return result()}}}};
 const context=vm.createContext({Response,URL,WorkerEntrypoint:class{},assets:{},ATTRIBUTION:'Synthetic attribution',
  console:{log:x=>logs.push(x),error:x=>logs.push(x)},
  readSubsidies:async()=>{fail();return ['false','shape'].includes(mode)?result():{success:true,results:[{record_json:mode==='corrupt'?'invalid '+privateDetail:JSON.stringify({id:'fixture',verification:'pending'})}]};},
  readConditions:async()=>{fail();return mode==='missing'?null:{programId:'fixture'};}});
 vm.runInContext(code+';globalThis.handler=handler;',context);
 return {fetch:(path,authorized=true)=>context.handler.fetch(new Request('https://fixture.invalid'+path),{...settings,DB:db},authorized?identity:{}),reads:()=>reads,logs};
}
function secure(response){
 assert.equal(response.headers.get('Cache-Control'),'no-store');
 assert.equal(response.headers.get('X-Robots-Tag'),'noindex, nofollow');
 assert.equal(response.headers.get('X-Content-Type-Options'),'nosniff');
 assert.equal(response.headers.get('Referrer-Policy'),'no-referrer');
 assert.match(response.headers.get('Content-Security-Policy'),/frame-ancestors 'none'/);
}
const routes=[['/api/subsidies','subsidies_unavailable'],['/api/conditions','conditions_unavailable'],['/api/programs','programs_unavailable'],['/programs.json','programs_unavailable']];
for(const [path,error] of routes){
 test(path+' contains database exceptions in a fixed secured 503',async()=>{
  const f=fixture('throw'),r=await f.fetch(path);assert.equal(r.status,503);secure(r);
  assert.deepEqual(await r.json(),{error});assert.deepEqual(f.logs,[]);
 });
 test(path+' preserves normal results and refuses unauthenticated reads',async()=>{
  const f=fixture(),denied=await f.fetch(path,false);assert.equal(denied.status,403);secure(denied);assert.equal(f.reads(),0);
  const r=await f.fetch(path);assert.equal(r.status,200);secure(r);const body=await r.json();assert(!JSON.stringify(body).includes(privateDetail));
  if(path==='/api/subsidies'){assert.equal(body.verification,'pending');assert.equal(body.items.length,1);assert.equal(body.attribution,'Synthetic attribution');}
  else if(path==='/api/conditions')assert.equal(body.programId,'fixture');else assert.equal(body.length,1);
 });
}
for(const path of ['/api/subsidies','/api/programs','/programs.json'])for(const mode of ['false','shape'])test(path+' refuses '+mode+' database results',async()=>{
 const r=await fixture(mode).fetch(path);assert.equal(r.status,503);secure(r);assert.match((await r.json()).error,/_unavailable$/);
});
test('corrupt subsidy JSON is unavailable, never an empty-success response or raw exception',async()=>{
 const r=await fixture('corrupt').fetch('/api/subsidies');assert.equal(r.status,503);secure(r);assert.deepEqual(await r.json(),{error:'subsidies_unavailable'});
});
test('missing conditions stay 404, distinct from storage failure',async()=>{
 const r=await fixture('missing').fetch('/api/conditions');assert.equal(r.status,404);secure(r);assert.deepEqual(await r.json(),{error:'condition_document_not_found'});
});
