import {saveMonitorStates} from './monitor.js';

const DAY=86400000;
const time=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value.replace(/(?:\.(\d{1,3}))?Z$/,(_,ms)=>'.'+(ms||'').padEnd(3,'0')+'Z');
// These are collector states, never judgments about a program's legal validity.
export function jgrantsJobState(row,clock=new Date(),enabled=true){
 const state={type:'jgrants_job',status:'unconfirmed',attention:true,failures:null,cursor:null,itemCount:null,snapshotAt:null,nextAttempt:null};
 if(!row)return {...state,status:'missing_job'};
 const validCounts=['cursor','item_count','failures'].every(k=>Number.isSafeInteger(row[k])&&row[k]>=0)&&row.cursor<=row.item_count&&row.item_count<=5000;
 const validDates=(row.checked_at==null||time(row.checked_at))&&time(row.next_attempt)&&(!row.checked_at||Date.parse(row.checked_at)<=+clock);
 if(!Number.isFinite(+clock)||!validCounts||!validDates)return state;
 Object.assign(state,{failures:row.failures,cursor:row.cursor,itemCount:row.item_count,snapshotAt:row.checked_at,nextAttempt:row.next_attempt});
 if(!enabled)return {...state,status:'collection_paused',attention:false};
 if(row.failures>0)return {...state,status:'retry_pending',attention:row.failures>=3};
 if(row.last_error)return state;
 if(!row.checked_at)return row.cursor||row.item_count?state:{...state,status:'never_collected',attention:false};
 const stale=+clock-Date.parse(row.checked_at)>2*DAY;
 if(row.cursor<row.item_count)return {...state,status:stale?'persistence_stale':'persisting',attention:stale};
 return {...state,status:stale?'update_stale':row.item_count===0?'empty_snapshot':'snapshot_saved',attention:stale};
}

export async function monitorJgrants(env,keywords,clock=new Date()){
 if(!Number.isFinite(+clock)||!Array.isArray(keywords)||keywords.length!==8||new Set(keywords).size!==8)throw Error('invalid_jgrants_monitor_scope');
 const result=await env.DB.prepare('SELECT keyword,cursor,item_count,checked_at,next_attempt,failures,last_error FROM jgrants_jobs ORDER BY keyword LIMIT 9').all();
 if(!result.success||result.results.length>8||new Set(result.results.map(r=>r.keyword)).size!==result.results.length||result.results.some(r=>!keywords.includes(r.keyword)))throw Error('invalid_jgrants_job_inventory');
 const states=keywords.map(keyword=>['jgrants:'+keyword,jgrantsJobState(result.results.find(r=>r.keyword===keyword),clock,env.COLLECTION_ENABLED==='true')]);
 await saveMonitorStates(env.DB,states,clock.toISOString());
 return {version:1,status:'saved',checkedAt:clock.toISOString(),jobs:states.length,attention:states.filter(([,s])=>s.attention).length,unconfirmed:states.filter(([,s])=>['missing_job','unconfirmed','never_collected'].includes(s.status)).length};
}
