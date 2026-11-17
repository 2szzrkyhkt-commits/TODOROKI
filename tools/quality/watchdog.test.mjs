import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{check,retryFetch,scheduledAudit} from './watchdog-worker.mjs';

const now=Date.now();
const at=offset=>new Date(now+offset).toISOString();
const success=overrides=>({event:'schedule',head_branch:'main',status:'completed',conclusion:'success',updated_at:at(0),...overrides});
function fixture({runs=[success()],site=200,webhook=200,token='fixture',configured=true}={}){
 const data=new Map();let alerts=0;
 const env={GITHUB_TOKEN:token,STATE:{async get(k,type){const value=data.get(k)??null;return type==='json'&&value!==null?JSON.parse(value):value},async put(k,v){data.set(k,v)}}};
 if(configured)env.ALERT_WEBHOOK='https://fixture.invalid/alert';
 const fetcher=async(url,options)=>{
  if(url==='https://todoroki-gold.com/')return new Response('fixture',{status:site});
  if(url===env.ALERT_WEBHOOK){alerts++;return new Response('{}',{status:webhook});}
  if(String(url).startsWith('https://api.github.com/repos/2szzrkyhkt-commits/TODOROKI/actions/workflows/quality-audit.yml/runs?'))return Response.json({workflow_runs:runs});
  throw new Error('unexpected fixture request');
 };
 return {env,data,fetcher,alerts:()=>alerts};
}
async function mocked(f,fn){const original=globalThis.fetch;globalThis.fetch=f;try{return await fn()}finally{globalThis.fetch=original}}
async function health(f){return worker.fetch(new Request('https://fixture.invalid/health'),f.env)}

test('healthy website and scheduled run produce a healthy heartbeat without alerts',async()=>{
 const f=fixture();await mocked(f.fetcher,()=>scheduledAudit(f.env));
 assert.equal((await health(f)).status,200);assert.equal(f.alerts(),0);
 assert.equal(f.data.get('status'),'healthy');assert.equal(JSON.parse(f.data.get('site-latest')).status,200);
});
test('stale audit stays unhealthy after a delivered alert; dedup, recovery and recurrence',async()=>{
 const f=fixture({runs:[]});
 await mocked(f.fetcher,async()=>{
  for(let i=0;i<2;i++)await assert.rejects(()=>scheduledAudit(f.env),/scheduled audit stale/);
 });
 assert.equal(f.alerts(),1);assert.equal((await health(f)).status,503);
 assert.equal(JSON.parse(f.data.get('heartbeat')).ok,false);
 const healthy=fixture();await mocked(healthy.fetcher,()=>check(f.env));assert.equal(f.data.get('status'),'healthy');
 await mocked(f.fetcher,()=>assert.rejects(()=>scheduledAudit(f.env),/scheduled audit stale/));assert.equal(f.alerts(),2);
});
test('site 404 never becomes healthy when the scheduled audit succeeds',async()=>{
 const f=fixture({site:404});await mocked(f.fetcher,()=>assert.rejects(()=>scheduledAudit(f.env),/site HTTP 404/));
 assert.equal(JSON.parse(f.data.get('site-latest')).ok,false);assert.equal((await health(f)).status,503);assert.equal(f.alerts(),0);
});
for(const [name,overrides] of Object.entries({old:{updated_at:at(-3*3600000-1)},invalid:{updated_at:'invalid'},future:{updated_at:at(3600000)},push:{event:'push'},otherBranch:{head_branch:'fixture'},running:{status:'in_progress'}})){
 test(`audit ${name} cannot qualify as recent successful scheduling`,async()=>{
  const f=fixture({runs:[success(overrides)]});const r=await mocked(f.fetcher,()=>check(f.env));assert.equal(r.ok,false);assert.equal(f.alerts(),1);
 });
}
test('failed newer run does not erase a genuine recent scheduled success',async()=>{
 const f=fixture({runs:[success({conclusion:'failure'}),success()]});assert.equal((await mocked(f.fetcher,()=>check(f.env))).ok,true);
});
for(const [name,heartbeat] of Object.entries({missing:null,invalid:{at:'invalid',ok:true},future:{at:at(3600000),ok:true},old:{at:at(-3*3600000-1),ok:true},failed:{at:at(0),ok:false},wrongType:{at:at(0),ok:'true'}})){
 test(`health ${name} returns 503`,async()=>{const f=fixture();if(heartbeat)f.data.set('heartbeat',JSON.stringify(heartbeat));assert.equal((await health(f)).status,503)});
}
test('health storage failure is an uncached 503, unrelated routes remain 404',async()=>{
 const env={STATE:{get:async()=>{throw new Error('fixture')}}};
 const r=await worker.fetch(new Request('https://fixture.invalid/health'),env);assert.equal(r.status,503);assert.equal(r.headers.get('Cache-Control'),'no-store');
 assert.equal((await worker.fetch(new Request('https://fixture.invalid/'),env)).status,404);
});
for(const configured of [true,false]){
 test(`notification failure (${configured?'HTTP':'missing configuration'}) is retried on the next check`,async()=>{
  const f=fixture({runs:[],webhook:503,configured});
  await mocked(f.fetcher,async()=>{for(let i=0;i<2;i++)await assert.rejects(()=>scheduledAudit(f.env),configured?/notification 503/:/not configured/)});
  assert.equal(f.data.has('status'),false);assert.equal((await health(f)).status,503);assert.equal(f.alerts(),configured?2:0);
 });
}
test('GitHub HTTP failure or malformed JSON cannot create a healthy heartbeat',async()=>{
 for(const fetcher of [async()=>new Response('{}',{status:403}),async()=>Response.json({unexpected:[]})]){
  const f=fixture();await mocked(fetcher,()=>assert.rejects(()=>scheduledAudit(f.env)));assert.equal((await health(f)).status,503);
 }
});
test('upstream retry is bounded and uses exponential waits',async()=>{
 let tries=0;const waits=[];
 await mocked(async()=>{tries++;return new Response('{}',{status:tries<3?503:200})},async()=>{
  assert.equal((await retryFetch('https://fixture.invalid',{},ms=>waits.push(ms))).status,200);
 });
 assert.deepEqual(waits,[1000,2000]);assert.equal(tries,3);
 tries=0;await mocked(async()=>{tries++;throw new Error('fixture-secret-value')},()=>assert.rejects(()=>retryFetch('https://fixture.invalid',{},()=>{}),/^Error: upstream network error$/));assert.equal(tries,3);
});
test('failure history keeps only 30 entries and does not persist upstream response bodies',async()=>{
 const f=fixture({site:404});f.data.set('failures',JSON.stringify(Array.from({length:30},()=>({at:'fixture',error:'fixture'}))));
 await mocked(f.fetcher,()=>assert.rejects(()=>scheduledAudit(f.env)));
 const failures=JSON.parse(f.data.get('failures'));assert.equal(failures.length,30);assert.equal(failures.at(-1).error,'watchdog site HTTP 404');
});
test('notification exceptions never persist or rethrow a URL/token from the upstream error',async()=>{
 const f=fixture({runs:[]});const token='fixture-sensitive-url-token';
 const fetcher=(url,options)=>url===f.env.ALERT_WEBHOOK?Promise.reject(new Error(token)):f.fetcher(url,options);
 await mocked(fetcher,()=>assert.rejects(()=>scheduledAudit(f.env),/^Error: watchdog execution failed$/));
 assert.ok(!f.data.get('failures').includes(token));assert.equal((await health(f)).status,503);
});
test('malformed GitHub response bodies are never copied into failure history',async()=>{
 const f=fixture();const token='fixture-sensitive-body';
 const fetcher=(url,options)=>String(url).startsWith('https://api.github.com/')?new Response(token):f.fetcher(url,options);
 await mocked(fetcher,()=>assert.rejects(()=>scheduledAudit(f.env),/^Error: watchdog execution failed$/));
 assert.ok(!f.data.get('failures').includes(token));assert.equal((await health(f)).status,503);
});
test('corrupt history cannot prevent recording an unhealthy heartbeat',async()=>{
 const f=fixture({site:404});f.data.set('failures','fixture-sensitive-corrupt-history');
 await mocked(f.fetcher,()=>assert.rejects(()=>scheduledAudit(f.env),/^Error: watchdog site HTTP 404$/));assert.equal((await health(f)).status,503);
});
test('unavailable state still rejects execution without rethrowing provider diagnostics',async()=>{
 const f=fixture();f.env.STATE={get:async()=>{throw new Error('fixture-sensitive-provider-error')},put:async()=>{throw new Error('fixture-sensitive-provider-error')}};
 await mocked(f.fetcher,()=>assert.rejects(()=>scheduledAudit(f.env),/^Error: watchdog execution failed$/));assert.equal((await health(f)).status,503);
});
