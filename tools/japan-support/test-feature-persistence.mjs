import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

// Exercise actual orchestration bodies with synthetic checks and isolated storage.
// No network, real applicant information, or database writes.
for (const spec of [
  {file:'eligibility.js',fn:'runSupportWithEligibility',prior:'runSupport',check:'checkStoredEligibility',key:'eligibilityCheck',error:'eligibility_check_failed'},
  {file:'amounts.js',fn:'runSupportWithAmounts',prior:'runSupportWithEligibility',check:'checkStoredAmounts',key:'amounts',error:'amount_checks_failed'},
]) {
  const source=fs.readFileSync(new URL(spec.file,import.meta.url),'utf8');
  const start=source.indexOf(`export async function ${spec.fn}(`);
  assert.notEqual(start,-1);
  const body=source.slice(start).replace('export ','');
  const check={checkedAt:'2026-11-19T00:00:00.000Z',passed:5,sourceReviewRequired:false};
  function harness(result,{writeThrows=false,priorThrows=false}={}) {
    const calls=[];
    const priorError=new Error('synthetic_prior_failure');
    const run=vm.runInNewContext(`(${body})`,{
      [spec.prior]:async()=>{if(priorThrows)throw priorError;return{status:'disabled'};},
      [spec.check]:async()=>check,
      saveAmountRules:async()=>({changed:false}),
    });
    const env={DB:{prepare(sql){assert.match(sql,/^INSERT INTO support_feature_checks/);return{
      bind(...params){calls.push(params);return this;},
      async run(){if(writeThrows)throw Error('synthetic_private_storage_detail');return result;},
    };}}};
    return {run:()=>run(env),calls,priorError};
  }
  for(const [name,result] of [
    ['success',{success:true,meta:{changes:1}}],
    ['false',{success:false,error:'synthetic_private_storage_detail'}],
    ['null',null],['undefined',undefined],['missing flag',{}],
    ['string true',{success:'true'}],['numeric true',{success:1}],
  ]) test(`${spec.fn}: persisted result ${name}`,async()=>{
    const h=harness(result),out=await h.run();
    assert.equal(out.status,'disabled');
    assert.equal(h.calls.length,1);
    assert.equal(h.calls[0][0],spec.key==='amounts'?'amounts':'eligibility');
    assert.deepEqual(JSON.parse(h.calls[0][1]),check);
    if(name==='success')assert.equal(out[spec.key].status,'passed');
    else assert.deepEqual(JSON.parse(JSON.stringify(out[spec.key])),{status:'failed',code:spec.error});
    assert.equal(JSON.stringify(out).includes('synthetic_private_storage_detail'),false);
  });
  test(`${spec.fn}: thrown storage failure stays sanitized`,async()=>{
    const h=harness(null,{writeThrows:true}),out=await h.run();
    assert.deepEqual(JSON.parse(JSON.stringify(out[spec.key])),{status:'failed',code:spec.error});
    assert.equal(h.calls.length,1);
  });
  test(`${spec.fn}: prior error remains an error after a failed save`,async()=>{
    const h=harness({success:false},{priorThrows:true});
    await assert.rejects(h.run,e=>e===h.priorError);
    assert.equal(h.calls.length,1);
  });
}
