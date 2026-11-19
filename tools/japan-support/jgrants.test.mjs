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
function persistingDB(mode='ok',input){
 const items=input||Array.from({length:40},(_,i)=>({id:'a'+i,title:'補助'+i}));
 const pending={keyword:'補助',cursor:0,item_count:items.length,payload:JSON.stringify(items),checked_at:'2026-11-18T05:35:12.507Z'};
 const records=new Map(),sql=[],state={cursor:0};
 return {pending,records,sql,state,repair(){mode='ok'},prepare(q){sql.push(q);return {sql:q,args:[],bind(...args){this.args=args;return this},async first(){return q.includes('payload IS NOT NULL')?pending:null},async run(){if(q.includes('SET cursor=')){if(mode==='checkpointFailure')return {success:false,meta:{changes:0}};if(mode==='checkpointConflict')return {success:true,meta:{changes:0}};state.cursor=this.args[0];assert.equal(this.args[2],pending.cursor);assert.equal(this.args[3],pending.checked_at);}return {success:true,meta:{changes:1}}},async all(){
 if(!q.includes('FROM jgrants_catalog'))throw Error('monitor fixture unavailable');
 if(mode==='throwRead')throw Error('read unavailable');
 let rows=[...records.values()].map(x=>({...x}));
 if(mode==='missing')rows.pop();
 if(mode==='corrupt')rows[0].record_json=JSON.stringify({...JSON.parse(rows[0].record_json),maximum:999});
 if(mode==='wrongTitle')rows[0].title='保存時に変化';
 if(mode==='duplicateReadback')rows[1]={...rows[0]};
 return {success:mode!=='readFailure',results:rows};
 }}},async batch(statements){assert.equal(statements.length,Math.min(25,items.length));if(mode==='failedBatch')return statements.map(()=>({success:false,results:[]}));for(const q of statements){const [id,title,record_json,acquired_at]=q.args;records.set(id,{id,title,record_json,acquired_at});}return statements.map(()=>({success:true,results:[]}));}};
}
test('persistence resumes bounded batch, verifies readback and never modifies verified programs',async()=>{
 const db=persistingDB();const r=await runJgrants({DB:db,COLLECTION_ENABLED:'true'});assert.equal(r.count,25);assert.equal(r.readback,true);assert.equal(db.state.cursor,25);assert.equal(db.records.size,25);assert(!db.sql.some(s=>s.includes('UPDATE programs')));
});
for(const mode of ['failedBatch','missing','corrupt','wrongTitle','duplicateReadback','readFailure','throwRead'])test('persistence does not advance a cursor after '+mode,async()=>{
 const db=persistingDB(mode),payload=db.pending.payload;
 await assert.rejects(()=>runJgrants({DB:db,COLLECTION_ENABLED:'true'}));
 assert.equal(db.state.cursor,0);assert.equal(db.pending.payload,payload);assert(!db.sql.some(s=>s.includes('SET cursor=')));assert(!db.sql.some(s=>/DELETE|SET payload=/.test(s)));
});
test('repeated source IDs retain last-write semantics and advance the source-row cursor only after readback',async()=>{
 const input=Array.from({length:25},(_,i)=>({id:'a'+i,title:'補助'+i}));input[24]={id:'a0',title:'同じIDの最後の値'};
 const db=persistingDB('ok',input);const r=await runJgrants({DB:db,COLLECTION_ENABLED:'true'});
 assert.equal(r.count,25);assert.equal(r.readback,true);assert.equal(db.state.cursor,25);assert.equal(db.records.size,24);assert.equal(db.records.get('a0').title,'同じIDの最後の値');
});
test('an overdue unfetched keyword is not starved by another keyword persistence',async()=>{
 const original=globalThis.fetch;let fetches=0,batches=0;const writes=[];
 const pending={keyword:'助成',cursor:0,item_count:40,payload:JSON.stringify(Array.from({length:40},(_,i)=>({id:'a'+i,title:'合成資料'}))),checked_at:'2026-11-18T02:15:00Z'};
 const due={keyword:'支援',cursor:0,item_count:0,payload:null};
 const db={prepare(sql){let args=[];return {bind(...a){args=a;return this},async first(){return sql.includes('payload IS NOT NULL')?pending:due},async run(){writes.push({sql,args});return {meta:{changes:1}}}}},async batch(){batches++;}};
 try{globalThis.fetch=async(u,o)=>{fetches++;assert.equal(u.searchParams.get('keyword'),'支援');assert.equal(o.redirect,'manual');return Response.json({result:[{id:'b1',title:'合成の支援制度'}]});};
 const r=await runJgrants({DB:db,COLLECTION_ENABLED:'true'});assert.equal(r.status,'fetched');assert.equal(r.keyword,'支援');assert.equal(fetches,1);assert.equal(batches,0);assert(!writes.some(x=>x.sql.includes('SET cursor=')));assert.equal(pending.cursor,0);
 }finally{globalThis.fetch=original;}
});
test('a due fetch failure keeps another pending snapshot and does not add a persistence step',async()=>{
 const original=globalThis.fetch;let fetches=0,batches=0;const writes=[];
 const pending={keyword:'助成',cursor:875,item_count:922,payload:'retained snapshot',checked_at:'2026-11-18T02:15:00Z'};
 const db={prepare(sql){let args=[];return {bind(...a){args=a;return this},async first(){return sql.includes('payload IS NOT NULL')?pending:{keyword:'奨学',payload:null}},async run(){writes.push({sql,args});return {meta:{changes:1}}}}},async batch(){batches++;}};
 try{globalThis.fetch=async()=>{fetches++;return new Response('',{status:503});};const r=await runJgrants({DB:db,COLLECTION_ENABLED:'true'});assert.equal(r.status,'failed');assert.equal(fetches,1);assert.equal(batches,0);assert.equal(pending.cursor,875);assert(!writes.some(x=>x.sql.includes('SET payload=')||x.sql.includes('SET cursor=')));assert(writes.some(x=>x.sql.includes('failures=failures+1')));
 }finally{globalThis.fetch=original;}
});

for(const mode of ['checkpointFailure','checkpointConflict'])test('verified records are not reported saved after '+mode,async()=>{const db=persistingDB(mode);await assert.rejects(()=>runJgrants({DB:db,COLLECTION_ENABLED:'true'}),/jgrants_checkpoint_failed/);assert.equal(db.state.cursor,0);assert.equal(db.records.size,25);});
test('snapshot array and declared item count must agree before writing',async()=>{const db=persistingDB();db.pending.payload='[]';await assert.rejects(()=>runJgrants({DB:db,COLLECTION_ENABLED:'true'}),/jgrants_snapshot_invalid/);assert.equal(db.state.cursor,0);assert.equal(db.records.size,0);});

test('a retained snapshot resumes after failed readback without duplicating records',async()=>{const db=persistingDB('corrupt');const payload=db.pending.payload;await assert.rejects(()=>runJgrants({DB:db,COLLECTION_ENABLED:'true'}),/jgrants_catalog_readback_failed/);assert.equal(db.state.cursor,0);db.repair();const result=await runJgrants({DB:db,COLLECTION_ENABLED:'true'});assert.equal(result.readback,true);assert.equal(result.count,25);assert.equal(db.state.cursor,25);assert.equal(db.records.size,25);assert.equal(db.pending.payload,payload);});
