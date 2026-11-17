import assert from 'node:assert/strict';
import {assess} from './report.mjs';
const sample = () => ({period:{start:'2026-11-16T00:00:00Z',end:'2026-11-17T00:00:00Z'},
  workers:[{name:'a',requests:10,errors:2},{name:'b',requests:20,errors:0}],
  d1:{rowsRead:5887,rowsWritten:805,storageBytes:729088},plan:'unverified'});
let checks = 0;
function check(fn){fn();checks++;}
check(()=>assert.equal(assess(sample()).requests,30));
check(()=>assert.equal(assess(sample()).errors,2));
check(()=>assert.equal(assess(sample()).freeUsageAssessmentComplete,false));
check(()=>assert.equal(assess(sample()).contractVerified,false));
check(()=>assert.equal(assess(sample()).billingConclusion,'not_assessed'));
check(()=>assert.equal(assess(sample()).absentWorkers,'unobserved_not_zero'));
check(()=>assert.equal(assess(sample()).d1.writePercent,0.805));
check(()=>assert.equal(assess({...sample(),d1:null}).d1,null));
check(()=>assert.throws(()=>assess({...sample(),workers:[]})));
check(()=>assert.throws(()=>assess({...sample(),workers:[{name:'a',requests:null,errors:0}]})));
check(()=>assert.throws(()=>assess({...sample(),workers:[{name:'a',requests:1,errors:2}]})));
check(()=>assert.throws(()=>assess({...sample(),workers:[sample().workers[0],sample().workers[0]]})));
check(()=>assert.throws(()=>assess({...sample(),period:{start:'2026-11-16T01:00:00Z',end:'2026-11-17T01:00:00Z'}})));
check(()=>assert.throws(()=>assess({...sample(),period:{start:'2026-11-16T00:00:00Z',end:'2026-11-16T01:00:00Z'}})));
check(()=>assert.equal(assess({...sample(),workers:[{name:'a',requests:100001,errors:0}]}).workersFreeReference.within,false));
check(()=>assert.equal(assess({...sample(),plan:'free'}).freeUsageAssessmentComplete,false));
check(()=>assert.equal(assess({...sample(),d1:null,plan:'free',kvVerified:true,r2Verified:true}).freeUsageAssessmentComplete,false));
console.log(`T41 usage evidence: ${checks} checks passed; missing counters, duplicate workers, UTC periods and unverified billing guarded.`);
