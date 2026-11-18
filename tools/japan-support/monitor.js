import {collectDue, sourceAllowed} from './collector.js';

// Observe only stored metadata. A fetch failure or unchanged law is never evidence
// that a benefit ended. No status, eligibility, amount or source permission is edited.
export const MONITOR_SCHEMA = [
 `CREATE TABLE IF NOT EXISTS support_monitor_latest(entity_key TEXT PRIMARY KEY,state_json TEXT NOT NULL,checked_at TEXT NOT NULL)`,
 `CREATE TABLE IF NOT EXISTS support_monitor_history(id TEXT PRIMARY KEY,entity_key TEXT NOT NULL,state_json TEXT NOT NULL,observed_at TEXT NOT NULL)`
];
const validTime = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
function dateOnly(value) {
 if(typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
 const d = new Date(value+'T00:00:00Z');
 return Number.isFinite(+d) && d.toISOString().slice(0,10) === value ? value : null;
}
function period(raw) {
 try {
  const p=JSON.parse(raw);
  if(!p || Array.isArray(p) || typeof p!=='object')return null;
  for(const k of ['from','to']) if(p[k]!=null && !dateOnly(p[k]))return null;
  if(p.from && p.to && p.from>p.to)return null;
  return {from:p.from||null,to:p.to||null};
 } catch {return null;}
}
export function sourceState(s,now,enabled=true) {
 let permitted=false; try {permitted=sourceAllowed(s);} catch {}
 let status;
 const interval=Number(s.interval_seconds);
 if(s.enabled!==1)status='disabled';
 else if(!permitted)status='blocked_terms';
 else if(!enabled)status='collection_paused';
 else if(s.last_success==null)status='never_collected';
 else if(!validTime(s.last_success) || !Number.isFinite(interval) || interval<3600 || Date.parse(s.last_success)>+now)status='unconfirmed';
 else status=+now-Date.parse(s.last_success)>Math.max(interval*2,interval+3600)*1000?'update_stopped':'within_interval';
 return {type:'source',status,lastSuccess:validTime(s.last_success)?s.last_success:null,intervalSeconds:Number.isFinite(interval)&&interval>=3600?interval:null,failures:Number.isInteger(s.failures)&&s.failures>=0?s.failures:null};
}
export function programState(p,now,source) {
 const today=new Date(+now+9*3600000).toISOString().slice(0,10);
 const verified=p.verification==='verified' && validTime(p.verified_at) && Date.parse(p.verified_at)<=+now;
 const effective=period(p.effective_period_json),application=period(p.application_period_json);
 let lifecycle='unconfirmed',basis='unverified_metadata',applicationState='unconfirmed';
 if(verified) {
  if(p.status==='ended'){lifecycle='ended';basis='verified_status';}
  else if(!effective){basis='invalid_effective_period';}
  else if(effective.to && today>effective.to){lifecycle='ended';basis='verified_effective_end';}
  else if(effective.from && today<effective.from){lifecycle='not_started';basis='verified_effective_start';}
  else if(p.status==='active'){lifecycle='active';basis='verified_active_status';}
  else basis='status_unconfirmed';
  if(application?.to && today>application.to)applicationState='closed';
  else if(application?.from && today<application.from)applicationState='not_started';
  else if(application && (application.from||application.to))applicationState='within_stated_period';
 }
 return {type:'program',lifecycle,basis,applicationState,verifiedAt:verified?p.verified_at:null,effectiveTo:verified&&effective?effective.to:null,sourceStatus:source?.status||'missing_source'};
}
export async function monitorStored(env,clock=new Date()) {
 if(!Number.isFinite(+clock))throw Error('invalid_clock');
 const db=env.DB,now=clock.toISOString();
 const [sources,programs,pending]=await db.batch([
  db.prepare('SELECT * FROM sources ORDER BY id LIMIT 1001'),
  db.prepare('SELECT id,source_id,verification,verified_at,status,effective_period_json,application_period_json FROM programs ORDER BY id LIMIT 1001'),
  db.prepare("SELECT source_id,COUNT(*) AS count FROM revisions WHERE verification='pending' GROUP BY source_id LIMIT 1001")
 ]);
 if([sources,programs,pending].some(r=>!r.success || r.results.length>1000))throw Error('monitor_scope_limit');
 const sourceMap=new Map(),states=[];
 for(const s of sources.results){const state=sourceState(s,clock,env.COLLECTION_ENABLED==='true');state.pendingChanges=Number(pending.results.find(r=>r.source_id===s.id)?.count||0);sourceMap.set(s.id,state);states.push(['source:'+s.id,state]);}
 for(const p of programs.results)states.push(['program:'+p.id,programState(p,clock,sourceMap.get(p.source_id))]);
 await saveMonitorStates(db,states,now);
 return {version:1,status:'saved',checkedAt:now,sources:sources.results.length,programs:programs.results.length,updateStopped:states.filter(([,s])=>s.status==='update_stopped').length,ended:states.filter(([,s])=>s.lifecycle==='ended').length,unconfirmed:states.filter(([,s])=>s.lifecycle==='unconfirmed').length};
}
export async function collectAndMonitor(env) {
 let result,error;
 try {result=await collectDue(env);}catch(e){error=e;}
 let monitor;
 try {monitor=await monitorStored(env);}catch {monitor={version:1,status:'failed',code:'monitor_storage_failed'};}
 if(error)throw error;
 return {...result,monitor};
}

// Shared transition persistence; callers provide only sanitized monitoring metadata.
export async function saveMonitorStates(db,states,now) {
 const writes=[];
 for(const [key,state] of states){
  const json=JSON.stringify(state);
  // The conditional history insert and latest upsert share one transaction, so
  // concurrent calls cannot create a second transition for an unchanged state.
  writes.push(db.prepare('INSERT INTO support_monitor_history(id,entity_key,state_json,observed_at) SELECT ?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM support_monitor_latest WHERE entity_key=? AND (state_json=? OR checked_at>?))').bind(crypto.randomUUID(),key,json,now,key,json,now));
  writes.push(db.prepare('INSERT INTO support_monitor_latest(entity_key,state_json,checked_at) VALUES(?,?,?) ON CONFLICT(entity_key) DO UPDATE SET state_json=excluded.state_json,checked_at=excluded.checked_at WHERE excluded.checked_at>=support_monitor_latest.checked_at').bind(key,json,now));
 }
 // At most 40 entities per transaction to bound each write batch. Each entity
 // remains atomic; a later chunk failure is reported, never a successful scan.
 for(let i=0;i<writes.length;i+=80){const result=await db.batch(writes.slice(i,i+80));if(result.some(r=>!r.success))throw Error('monitor_write_failed');}
}
