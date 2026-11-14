const MAX_BYTES=512*1024;
export async function boundedText(response) {
 const reader=response.body?.getReader(); if(!reader) throw Error('empty_body');
 const chunks=[]; let size=0;
 try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BYTES)throw Error('body_too_large');chunks.push(value);}} finally {await reader.cancel().catch(()=>{});}
 const data=new Uint8Array(size);let offset=0;for(const c of chunks){data.set(c,offset);offset+=c.length;}
 return new TextDecoder().decode(data);
}
export function sourceAllowed(s) {
 const u=new URL(s.url);
 return s.enabled===1 && s.automated_access==='approved' && !!s.reviewed_at && ['commercial','reproduction','modification'].every(k=>['conditional-PDL1.0','approved'].includes(s[k])) && u.protocol==='https:' && ((u.hostname==='www.cfa.go.jp' && u.pathname==='/policies/kokoseido/jidouteate/annai') || (u.hostname==='laws.e-gov.go.jp' && u.pathname==='/api/2/law_revisions/346AC0000000073'));
}
export async function collectOne(db, source, fetcher=fetch, clock=new Date()) {
 if(!sourceAllowed(source)) return {status:'blocked_terms'};
 const now=clock.toISOString(), id=crypto.randomUUID();
 const lock=await db.prepare('UPDATE sources SET lease_until=? WHERE id=? AND (lease_until IS NULL OR lease_until<?)').bind(new Date(+clock+120000).toISOString(),source.id,now).run();
 if(!lock.meta.changes) return {status:'leased'};
 await db.prepare('INSERT INTO collection_runs(id,source_id,started_at,status) VALUES(?,?,?,?)').bind(id,source.id,now,'running').run();
 try {
 const headers={'User-Agent':'TODOROKI-JAPAN-SUPPORT/0.1 (official-source-change-monitor)'};
 if(source.etag)headers['If-None-Match']=source.etag;
 if(source.last_modified)headers['If-Modified-Since']=source.last_modified;
 const response=await fetcher(source.url,{headers,redirect:'manual',signal:AbortSignal.timeout(15000)});
 let hash=source.last_hash;
 if(response.status!==304){
 if(!response.ok)throw Error('http_'+response.status);
 const api=new URL(source.url).hostname==='laws.e-gov.go.jp';
 if(!(response.headers.get('content-type')||'').includes(api?'application/json':'text/html'))throw Error('unexpected_content_type');
 const body=await boundedText(response);
 if(!body.includes('児童手当'))throw Error('unexpected_document');
 let candidate={kind:'source_change',url:source.url,requires:'human_fact_and_formula_review'};
 if(api){const data=JSON.parse(body);if(data.law_info?.law_id!=='346AC0000000073'||!Array.isArray(data.revisions)||!data.revisions.length)throw Error('invalid_law_response');candidate={...candidate,law_id:data.law_info.law_id,revisions:data.revisions.map(r=>({id:r.law_revision_id,title:r.law_title,enforcement:r.amendment_enforcement_date,status:r.current_revision_status,updated:r.updated}))};}
 hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body)))).map(b=>b.toString(16).padStart(2,'0')).join('');
 // Store metadata only, never copy the page or promote a detected change.
 await db.prepare('INSERT OR IGNORE INTO revisions(id,source_id,content_hash,acquired_at,candidate_json) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),source.id,hash,now,JSON.stringify(candidate)).run();
 }
 await db.batch([
 db.prepare('UPDATE sources SET failures=0,lease_until=NULL,last_hash=?,last_success=?,next_attempt=?,etag=?,last_modified=? WHERE id=?').bind(hash,now,new Date(+clock+source.interval_seconds*1000).toISOString(),response.headers.get('etag')||source.etag,response.headers.get('last-modified')||source.last_modified,source.id),
 db.prepare("UPDATE collection_runs SET status='ok',finished_at=?,http_status=? WHERE id=?").bind(now,response.status,id),
 db.prepare('UPDATE incidents SET resolved_at=? WHERE source_id=? AND resolved_at IS NULL').bind(now,source.id)]);
 return {status:'ok',hash};
 } catch(e) {
 const failures=source.failures+1, error=String(e.message).slice(0,80);
 await db.batch([
 db.prepare('UPDATE sources SET failures=?,lease_until=NULL,next_attempt=? WHERE id=?').bind(failures,new Date(+clock+Math.min(86400,3600*2**Math.min(failures,5))*1000).toISOString(),source.id),
 db.prepare("UPDATE collection_runs SET status='failed',finished_at=?,error_code=? WHERE id=?").bind(now,error,id)]);
 if(failures>=3)await db.prepare('INSERT INTO incidents(id,source_id,kind,created_at) SELECT ?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM incidents WHERE source_id=? AND kind=? AND resolved_at IS NULL)').bind(crypto.randomUUID(),source.id,'repeated_collection_failure',now,source.id,'repeated_collection_failure').run();
 return {status:'failed',error};
 }
}
export async function collectDue(env) {
 if(env.COLLECTION_ENABLED!=='true')return {status:'disabled'};
 // One document per invocation. Persisted next_attempt and lease enable restart.
 const source=await env.DB.prepare("SELECT * FROM sources WHERE enabled=1 AND automated_access='approved' AND next_attempt<=? AND (lease_until IS NULL OR lease_until<=?) ORDER BY next_attempt LIMIT 1").bind(new Date().toISOString(),new Date().toISOString()).first();
 return source ? collectOne(env.DB,source) : {status:'idle'};
}

