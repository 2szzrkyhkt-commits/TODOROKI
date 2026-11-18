import test from 'node:test';
import assert from 'node:assert/strict';
import {jgrantsJobState,monitorJgrants} from './jgrants-monitor.js';
import {runJgrants} from './jgrants.js';
const keys=['補助','助成','支援','給付','奨学','減免','融資','交付'];
const now=new Date('2026-11-18T02:20:00.000Z');
const base={cursor:25,item_count:922,checked_at:'2026-11-18T02:15:12.825Z',next_attempt:'2026-11-19T02:15:14.518Z',failures:0,last_error:null};
test('stored jobs distinguish partial persistence, retry, empty and complete snapshots',()=>{
 assert.equal(jgrantsJobState(base,now).status,'persisting');
 assert.equal(jgrantsJobState({...base,cursor:922},now).status,'snapshot_saved');
 assert.equal(jgrantsJobState({...base,cursor:0,item_count:0},now).status,'empty_snapshot');
 assert.equal(jgrantsJobState({...base,cursor:0,item_count:0,checked_at:null},now).status,'never_collected');
 assert.equal(jgrantsJobState(null,now).status,'missing_job');
 const failed=jgrantsJobState({...base,failures:22,last_error:'secret-shaped raw upstream body'},now);
 assert.equal(failed.status,'retry_pending');assert.equal(failed.attention,true);assert(!JSON.stringify(failed).includes('secret-shaped'));
 assert.equal(jgrantsJobState({...base,failures:1},now).attention,false);
 assert.equal(jgrantsJobState(base,now,false).status,'collection_paused');
});
test('unknown counters, invalid/future dates and stale snapshots never look healthy',()=>{
 for(const delta of [{cursor:-1},{cursor:923},{item_count:5001},{failures:NaN},{cursor:0.5},{checked_at:'bad'},{checked_at:'2026-11-19T00:00:00Z'},{next_attempt:'2026-02-30T00:00:00Z'},{checked_at:null},{last_error:'uncleared'}]){
 const s=jgrantsJobState({...base,...delta},now);assert.equal(s.status,'unconfirmed');assert.equal(s.attention,true);
 }
 assert.equal(jgrantsJobState(base,new Date('2026-11-20T02:15:12.825Z')).attention,false);
 assert.equal(jgrantsJobState(base,new Date('2026-11-20T02:15:12.826Z')).status,'persistence_stale');
 assert.equal(jgrantsJobState({...base,cursor:922},new Date('2026-11-20T03:00:00Z')).status,'update_stale');
});
function dbFor(rows,{fail=false}={}){
 const writes=[];
 return {writes,prepare(sql){return {sql,args:[],bind(...args){this.args=args;return this},async all(){return {success:true,results:rows}}}},async batch(batch){writes.push(...batch);return batch.map(()=>({success:!fail}));}};
}
test('monitor records all eight known jobs, redacts errors and never fetches or alters catalogs',async()=>{
 const db=dbFor(keys.map(keyword=>({...base,keyword})));const original=globalThis.fetch;
 try{globalThis.fetch=()=>{throw Error('monitor must not fetch')};const r=await monitorJgrants({DB:db,COLLECTION_ENABLED:'true'},keys,now);assert.equal(r.jobs,8);assert.equal(r.attention,0);assert.equal(db.writes.length,16);
 assert(db.writes.every(s=>/support_monitor_(history|latest)/.test(s.sql)&&!s.sql.includes('UPDATE jgrants')));
 assert(db.writes.filter(s=>s.sql.includes('INSERT INTO support_monitor_latest')).every(s=>JSON.parse(s.args[1]).status==='persisting'));
 }finally{globalThis.fetch=original;}
});
test('missing, unexpected, duplicate jobs and failed persistence remain unconfirmed or fail',async()=>{
 const missing=await monitorJgrants({DB:dbFor([]),COLLECTION_ENABLED:'true'},keys,now);assert.equal(missing.jobs,8);assert.equal(missing.unconfirmed,8);assert.equal(missing.attention,8);
 await assert.rejects(()=>monitorJgrants({DB:dbFor([{...base,keyword:'unknown'}])},keys,now));
 await assert.rejects(()=>monitorJgrants({DB:dbFor([{...base,keyword:keys[0]},{...base,keyword:keys[0]}])},keys,now));
 await assert.rejects(()=>monitorJgrants({DB:dbFor(keys.map(keyword=>({...base,keyword})),{fail:true})},keys,now),/monitor_write_failed/);
});
test('a fatal collection failure is still thrown after monitoring is attempted',async()=>{
 let writes=0;const db={prepare(sql){return {bind(){return this},async first(){return sql.includes('payload IS NOT NULL')?{keyword:'助成',payload:'broken JSON',cursor:0,item_count:1}:null},async run(){return {meta:{changes:1}}},async all(){return {success:true,results:keys.map(keyword=>({...base,keyword}))}}}},async batch(batch){writes+=batch.length;return batch.map(()=>({success:true}))}};
 const original=globalThis.fetch;try{globalThis.fetch=()=>{throw Error('isolated fixture must not fetch')};
 await assert.rejects(()=>runJgrants({DB:db,COLLECTION_ENABLED:'true'}),SyntaxError);assert.equal(writes,16);
 }finally{globalThis.fetch=original;}
});
