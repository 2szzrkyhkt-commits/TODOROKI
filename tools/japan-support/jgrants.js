import {monitorJgrants} from './jgrants-monitor.js';
async function boundedText(res){const reader=res.body.getReader();const chunks=[];let size=0;try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2000000)throw Error('body_too_large');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}return new TextDecoder().decode(bytes);}
export const ATTRIBUTION='出典：Jグランツ。このコンテンツは、政府公式の補助金申請システムjGrantsのWeb-API機能を利用して取得した情報をもとにTODOROKIが整理したものです。内容は日本国政府及び自治体によって保証されたものではありません。';
export const KEYWORDS=['補助','助成','支援','給付','奨学','減免','融資','交付'];
export function normalize(row,now){if(!row||typeof row.id!=='string'||! /^[A-Za-z0-9]{1,18}$/.test(row.id)||typeof row.title!=='string'||!row.title.trim())throw Error('invalid_subsidy');return {id:row.id,title:row.title,region:row.target_area_search??null,maximum:row.subsidy_max_limit??null,start:row.acceptance_start_datetime??null,end:row.acceptance_end_datetime??null,institution:row.institution_name??null,employees:row.target_number_of_employees??null,source_url:'https://www.jgrants-portal.go.jp/subsidy/'+row.id,acquired_at:now,verification:'pending',attribution:ATTRIBUTION};}
async function runJgrantsCore(env){
 if(env.COLLECTION_ENABLED!=='true')return {status:'disabled'};
 const db=env.DB,now=new Date().toISOString();
 // A bounded persistence step. Snapshot is retained so execution can resume without re-fetching.
 const pending=await db.prepare('SELECT * FROM jgrants_jobs WHERE payload IS NOT NULL AND cursor<item_count AND (lease_until IS NULL OR lease_until<?) ORDER BY checked_at LIMIT 1').bind(now).first();
 if(pending){const lock=await db.prepare('UPDATE jgrants_jobs SET lease_until=? WHERE keyword=? AND (lease_until IS NULL OR lease_until<?)').bind(new Date(Date.now()+60000).toISOString(),pending.keyword,now).run();if(!lock.meta.changes)return {status:'leased'};const items=JSON.parse(pending.payload);const rows=items.slice(pending.cursor,pending.cursor+25).map(r=>normalize(r,pending.checked_at));await db.batch(rows.map(r=>db.prepare("INSERT INTO jgrants_catalog(id,title,record_json,acquired_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,record_json=excluded.record_json,acquired_at=excluded.acquired_at").bind(r.id,r.title,JSON.stringify(r),r.acquired_at)));await db.prepare('UPDATE jgrants_jobs SET cursor=?,lease_until=NULL WHERE keyword=?').bind(pending.cursor+rows.length,pending.keyword).run();return {status:'saved',count:rows.length,keyword:pending.keyword};}
 const job=await db.prepare('SELECT * FROM jgrants_jobs WHERE next_attempt<=? AND (lease_until IS NULL OR lease_until<?) ORDER BY next_attempt,keyword LIMIT 1').bind(now,now).first();if(!job)return {status:'idle'};
 const lock=await db.prepare('UPDATE jgrants_jobs SET lease_until=? WHERE keyword=? AND (lease_until IS NULL OR lease_until<?)').bind(new Date(Date.now()+60000).toISOString(),job.keyword,now).run();if(!lock.meta.changes)return {status:'leased'};
 try{const u=new URL('https://api.jgrants-portal.go.jp/exp/v1/public/subsidies');u.search=new URLSearchParams({keyword:job.keyword,sort:'created_date',order:'DESC',acceptance:'0'});const res=await fetch(u,{redirect:'manual',signal:AbortSignal.timeout(15000)});if(!res.ok)throw Error('http_'+res.status);const data=JSON.parse(await boundedText(res));if(!Array.isArray(data.result)||data.result.length>5000)throw Error('invalid_response');for(const r of data.result)normalize(r,now);await db.prepare('UPDATE jgrants_jobs SET payload=?,cursor=0,item_count=?,checked_at=?,next_attempt=?,failures=0,lease_until=NULL,last_error=NULL WHERE keyword=?').bind(JSON.stringify(data.result),data.result.length,now,new Date(Date.now()+86400000).toISOString(),job.keyword).run();return {status:'fetched',keyword:job.keyword,count:data.result.length};}
 catch(e){await db.prepare('UPDATE jgrants_jobs SET failures=failures+1,last_error=?,next_attempt=?,lease_until=NULL WHERE keyword=?').bind(String(e.message).slice(0,100),new Date(Date.now()+3600000).toISOString(),job.keyword).run();console.error(JSON.stringify({event:'jgrants_failure',keyword:job.keyword,error:String(e)}));return {status:'failed'};}
}
export async function readSubsidies(db,q=''){return db.prepare('SELECT record_json FROM jgrants_catalog WHERE title LIKE ? ORDER BY title LIMIT 100').bind('%'+q.slice(0,100)+'%').all();}


// Observe the stored job after its fetch/persistence step; do not hide its failure.
export async function runJgrants(env){
 if(env.COLLECTION_ENABLED!=='true')return {status:'disabled'};
 let result,error;
 try{result=await runJgrantsCore(env);}catch(e){error=e;}
 let monitor;
 try{monitor=await monitorJgrants(env,KEYWORDS);}catch{monitor={status:'failed',code:'jgrants_monitor_storage_failed'};}
 if(error)throw error;
 return {...result,monitor};
}
