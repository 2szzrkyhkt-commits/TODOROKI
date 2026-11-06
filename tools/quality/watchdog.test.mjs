import {check} from './watchdog-worker.mjs';
import assert from 'node:assert/strict';
let state=null,alerts=0;
const env={GITHUB_TOKEN:'fixture',ALERT_WEBHOOK:'https://fixture.invalid/alert',STATE:{async get(){return state},async put(k,v){state=v}}};
let stale=true;
globalThis.fetch=async url=>{
 if(url===env.ALERT_WEBHOOK){alerts++;return new Response('{}');}
 return Response.json({workflow_runs:stale?[]:[{conclusion:'success',updated_at:new Date().toISOString()}]});
};
await check(env);assert.equal(alerts,1);await check(env);assert.equal(alerts,1);
stale=false;await check(env);assert.equal(state,'healthy');
stale=true;await check(env);assert.equal(alerts,2);
globalThis.fetch=async()=>new Response('{}',{status:403});
await assert.rejects(()=>check(env),/403/);
console.log('watchdog: stale, dedup, recovery, recurrence, API failure passed');
