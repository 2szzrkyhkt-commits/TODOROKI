import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {sourceAllowed,boundedText,collectDue} from './collector.js';
const source={url:'https://laws.e-gov.go.jp/api/2/law_revisions/346AC0000000073',enabled:1,automated_access:'approved',reviewed_at:'2026-11-14',commercial:'conditional-PDL1.0',reproduction:'conditional-PDL1.0',modification:'conditional-PDL1.0'};
assert(sourceAllowed(source));for(const delta of [{enabled:0},{automated_access:'unknown'},{commercial:'unknown'},{reproduction:'unknown'},{modification:'unknown'},{reviewed_at:null},{url:'https://example.com/api/2/law_revisions/346AC0000000073'}])assert(!sourceAllowed({...source,...delta}));
assert.equal((await collectDue({COLLECTION_ENABLED:'false'})).status,'disabled');
assert.equal(await boundedText(new Response('児童手当')), '児童手当');await assert.rejects(()=>boundedText(new Response('x'.repeat(512*1024+1))),/body_too_large/);
const worker=fs.readFileSync('worker.js','utf8').replace(/^import .*;\n/gm,'').replace('export default','const handler=').replace('export class SupportCollector','class SupportCollector');
let calls=0;const context=vm.createContext({Response,URL,WorkerEntrypoint:class{constructor(ctx,env){this.env=env}},collectDue:async env=>{assert.equal(env.marker,'only-this-env');calls++;return {status:'idle'}},assets:{}});
vm.runInContext(worker+';globalThis.testExports={handler,SupportCollector};',context);
assert.equal((await context.testExports.handler.fetch(new Request('https://example.com/api/programs'),{ACCESS_VERIFIED:'false'},{})).status,403);
assert.equal((await context.testExports.handler.fetch(new Request('https://example.com/'),{ACCESS_VERIFIED:'true',ACCESS_AUD:'required'},{})).status,403);
assert.equal((await new context.testExports.SupportCollector({}, {marker:'only-this-env'}).run()).status,'idle');assert.equal(calls,1);
const code=fs.readFileSync('edinet-cron.js','utf8').replace('export async function runScheduled','async function runScheduled').replace('export default','const handler=');
const logs=[];const c=vm.createContext({Date,Response,console:{log:x=>logs.push(x),error:x=>logs.push(x)}});vm.runInContext(code+';globalThis.handler=handler;',c);
for(const minute of [5,10,30]){const promises=[];let support=0,tax=0;const env={SUPPORT_COLLECTOR:{run:async()=>{support++;return {status:'idle'}}},TAX_COLLECTOR:{fetch:async()=>{tax++;return new Response('{}')}},TAX_RUN_TOKEN:'test-only'};await c.handler.scheduled({scheduledTime:Date.UTC(2026,10,14,3,minute)},env,{waitUntil:p=>promises.push(p)});await Promise.all(promises);assert.equal(support,1);assert.equal(tax,minute===30?1:0);}
const promises=[];await c.handler.scheduled({scheduledTime:Date.UTC(2026,10,14,3,5)},{SUPPORT_COLLECTOR:{run:async()=>{throw Error('fixture failure')}}},{waitUntil:p=>promises.push(p)});await Promise.all(promises);assert(logs.some(x=>x.includes('fixture failure')));
assert.equal((await c.handler.fetch()).status,200);console.log('PASS source policy, bounded payload, disabled collection, unchanged public denial, internal RPC, existing tax cadence and isolated support failure');
