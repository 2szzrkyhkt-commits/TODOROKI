import assert from 'node:assert/strict';import {runScheduled}from './edinet-cron.js';
assert.equal((await runScheduled({})).state,'not_configured');let count=0;globalThis.fetch=async(url,opt)=>{assert.equal(new URL(url).origin,'https://todoroki-edinet-connect.easysquid66.chatgpt.site');assert.equal(opt.headers['OAI-Sites-Authorization'],'Bearer test');count++;return Response.json(count===1?{state:'running',updatedAt:'1'}:{state:'watching',updatedAt:'2',nextPollAt:Date.now()+3600000,saved:1});};const d=await runScheduled({EDINET_CONNECT_TOKEN:'test'});assert.equal(count,2);assert.equal(d.calls,1);
globalThis.fetch=async()=>new Response('Forbidden',{status:403});await assert.rejects(()=>runScheduled({EDINET_CONNECT_TOKEN:'test'}),/CONNECT_HTTP_403/);
console.log('PASS fixed private target, service header, bounded batch loop, monitoring wait, HTTP failure handling');

for(const field of ['retryAt','nextPollAt','lease']){
 for(const value of [Date.now()+3600000,new Date(Date.now()+3600000).toISOString(),String(Date.now()+3600000)]){
  let ticks=0;globalThis.fetch=async(url)=>{if(url.endsWith('/tick'))ticks++;return Response.json({state:'running',updatedAt:'fixture',[field]:value});};
  const r=await runScheduled({EDINET_CONNECT_TOKEN:'test'});assert.equal(ticks,0,field+' must respect future '+value);assert.equal(r.calls,0);
 }
}
console.log('PASS 9 future retry/poll/lease guards across ISO, numeric and numeric-string timestamps');

import worker from './edinet-cron.js';
let support=0,tax=0;const pending=[];
const env={SUPPORT_COLLECTOR:{run:async()=>{support++;return {status:'fixture'}}},TAX_COLLECTOR:{fetch:async(url,opts)=>{assert.equal(url,'https://tax.internal/setup-run');assert.equal(opts.method,'POST');assert.equal(opts.headers.Authorization,'Bearer fixture');tax++;return new Response('{}');}},TAX_RUN_TOKEN:'fixture'};
for(const minute of [0,5,30]){await worker.scheduled({scheduledTime:Date.UTC(2026,10,14,6,minute)},env,{waitUntil:p=>pending.push(p)});await Promise.all(pending.splice(0));}
assert.equal(support,3);assert.equal(tax,2);
const r=await worker.fetch();assert.equal(r.status,200);assert.match((await r.json()).control,/cannot start/);
console.log('PASS unchanged support dispatch, tax minute guard, service target/method/header, read-only health');
