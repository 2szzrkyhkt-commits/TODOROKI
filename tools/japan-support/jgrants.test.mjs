import test from 'node:test';import assert from 'node:assert/strict';import {normalize,runJgrants} from './jgrants.js';
test('facts retain pending status and attribution',()=>{const r=normalize({id:'a012345',title:'設備補助',subsidy_max_limit:0},'today');assert.equal(r.maximum,0);assert.equal(r.verification,'pending');assert(r.attribution.includes('出典'));assert.throws(()=>normalize({id:'../../',title:'x'},'today'));});
test('disabled makes no database calls',async()=>assert.equal((await runJgrants({})).status,'disabled'));
function fetchingDB(){
 const writes=[];const oldPayload='preserved old snapshot';
 return {writes,oldPayload,prepare(sql){let args=[];return {bind(...values){args=values;return this},async first(){return sql.includes('payload IS NOT NULL')?null:{keyword:'交付',payload:oldPayload}},async run(){writes.push({sql,args});return {meta:{changes:1}}}}}};
}
test('Workers-compatible manual mode fetches and checkpoints without following redirects',async()=>{
 const original=globalThis.fetch,db=fetchingDB();let calls=0;
 try{globalThis.fetch=async(url,options)=>{calls++;if(options.redirect==='error')throw Error('Workers rejects redirect:error');assert.equal(options.redirect,'manual');assert.equal(url.origin,'https://api.jgrants-portal.go.jp');assert.equal(url.searchParams.get('keyword'),'交付');return Response.json({result:[{id:'a012345',title:'合成の交付金'}]})};
 const r=await runJgrants({DB:db,COLLECTION_ENABLED:'true'});assert.equal(r.status,'fetched');assert.equal(r.count,1);assert.equal(calls,1);
 assert.deepEqual(r.monitor,{status:'failed',code:'jgrants_monitor_storage_failed'}); // fixture has no monitor storage
 const saved=db.writes.find(w=>w.sql.includes('SET payload='));assert(saved);assert.equal(JSON.parse(saved.args[0])[0].id,'a012345');assert(saved.sql.includes('failures=0'));assert(saved.sql.includes('last_error=NULL'));
 }finally{globalThis.fetch=original;}
});
test('a 302 is a failed source fetch, never followed or substituted, and old data is retained',async()=>{
 const original=globalThis.fetch,db=fetchingDB();let calls=0;
 try{globalThis.fetch=async(url,options)=>{calls++;assert.equal(options.redirect,'manual');return new Response(null,{status:302,headers:{Location:'https://unapproved.example.test/'}})};
 assert.equal((await runJgrants({DB:db,COLLECTION_ENABLED:'true'})).status,'failed');assert.equal(calls,1);
 assert(!db.writes.some(w=>w.sql.includes('SET payload=')||/DELETE|jgrants_catalog/.test(w.sql)));const failed=db.writes.find(w=>w.sql.includes('failures=failures+1'));assert.equal(failed.args[0],'http_302');assert.equal(db.oldPayload,'preserved old snapshot');
 }finally{globalThis.fetch=original;}
});
test('upstream denial and malformed JSON preserve the successful snapshot and schedule retry',async()=>{
 const original=globalThis.fetch;
 try{for(const response of [new Response('denied',{status:403}),new Response('not json',{status:200})]){
 const db=fetchingDB();globalThis.fetch=async()=>response;assert.equal((await runJgrants({DB:db,COLLECTION_ENABLED:'true'})).status,'failed');assert(!db.writes.some(w=>w.sql.includes('SET payload=')||/DELETE/.test(w.sql)));assert(db.writes.some(w=>w.sql.includes('next_attempt=')&&w.sql.includes('failures=failures+1')));
 }}finally{globalThis.fetch=original;}
});
test('persistence resumes bounded batch and never modifies verified programs',async()=>{const sql=[];let updatedCursor;const payload=JSON.stringify(Array.from({length:40},(_,i)=>({id:'a'+i,title:'補助'+i})));const db={prepare(q){sql.push(q);return {bind(...args){if(q.includes('SET cursor='))updatedCursor=args[0];return this},async first(){return {keyword:'補助',cursor:0,item_count:40,payload,checked_at:'today'}},async run(){return {meta:{changes:1}}}}},async batch(rows){assert.equal(rows.length,25)}};const r=await runJgrants({DB:db,COLLECTION_ENABLED:'true'});assert.equal(r.count,25);assert.equal(updatedCursor,25);assert(!sql.some(s=>s.includes('UPDATE programs')))});
