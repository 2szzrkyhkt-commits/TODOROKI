// EDINET archive collector (standalone Cloudflare Worker module).
// Requires bindings: EDINET_API_KEY (secret), EDINET_DB (D1), EDINET_FILES (R2).
// Run schema.sql first. Configure a Cron Trigger (e.g. every minute).
// POST /start with Authorization: Bearer <ADMIN_TOKEN> and {"from":"2016-11-02","to":"2026-11-02"}.
// This module does not alter existing TODOROKI routes.
const sleep = ms => new Promise(r => setTimeout(r, ms));
const valid = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));
const next = s => new Date(Date.parse(s+'T00:00:00Z')+86400000).toISOString().slice(0,10);
async function api(url, key) {
  for(let attempt=0;attempt<5;attempt++){
    const r=await fetch(url,{headers:{'Accept':'application/json'}});
    if(r.ok)return r;
    if(![429,500,502,503,504].includes(r.status))throw Error('EDINET HTTP '+r.status);
    await sleep(Math.min(60000,1500*2**attempt));
  }
  throw Error('EDINET retry exhausted');
}
async function tick(env) {
  const job=await env.EDINET_DB.prepare("SELECT * FROM archive_jobs WHERE state='running' ORDER BY id LIMIT 1").first();
  if(!job)return {state:'idle'};
  if(job.cursor>job.end_date){
    const pending=await env.EDINET_DB.prepare("SELECT count(*) n FROM archive_docs WHERE job_id=? AND state!='done'").bind(job.id).first();
    if(!pending.n){await env.EDINET_DB.prepare("UPDATE archive_jobs SET state='complete' WHERE id=?").bind(job.id).run();return {state:'complete'};}\n    // Failed records remain visible for manual review; do not silently declare success.
  }else{
    try{
      const url='https://api.edinet-fsa.go.jp/api/v2/documents.json?date='+job.cursor+'&type=2&Subscription-Key='+encodeURIComponent(env.EDINET_API_KEY);
      const data=await (await api(url,env.EDINET_API_KEY)).json();
      if(data.metadata?.status && String(data.metadata.status)!=='200')throw Error('EDINET API status '+data.metadata.status);\n      if(!Array.isArray(data.results))throw Error('Missing results');
      for(const d of data.results){
        // 120 = annual securities report; 130 = amended annual securities report.
        if(!['120','130'].includes(String(d.docTypeCode)))continue;
        if(!d.docID)continue;
        await env.EDINET_DB.prepare("INSERT OR IGNORE INTO archive_docs(job_id,doc_id,submitted_on,doc_type,state) VALUES(?,?,?,?, 'pending')").bind(job.id,d.docID,job.cursor,String(d.docTypeCode)).run();
      }
      await env.EDINET_DB.prepare("UPDATE archive_jobs SET cursor=?,last_error=NULL WHERE id=?").bind(next(job.cursor),job.id).run();
    }catch(e){
      await env.EDINET_DB.prepare("UPDATE archive_jobs SET last_error=? WHERE id=?").bind(String(e).slice(0,500),job.id).run();
      return {state:'retry-date',date:job.cursor,error:String(e)};
    }
  }
  // Once the date range is indexed, continue draining queued documents.
  const docs=await env.EDINET_DB.prepare("SELECT doc_id FROM archive_docs WHERE job_id=? AND state='pending' ORDER BY submitted_on LIMIT 2").bind(job.id).all();
  for(const d of docs.results){
    try{
      const u='https://api.edinet-fsa.go.jp/api/v2/documents/'+encodeURIComponent(d.doc_id)+'?type=1&Subscription-Key='+encodeURIComponent(env.EDINET_API_KEY);
      const r=await api(u,env.EDINET_API_KEY);
      await env.EDINET_FILES.put('edinet/'+d.doc_id+'.zip',r.body,{httpMetadata:{contentType:'application/zip'}});
      await env.EDINET_DB.prepare("UPDATE archive_docs SET state='done',last_error=NULL WHERE job_id=? AND doc_id=?").bind(job.id,d.doc_id).run();
    }catch(e){
      await env.EDINET_DB.prepare("UPDATE archive_docs SET attempts=attempts+1,last_error=?,state=CASE WHEN attempts>=9 THEN 'failed' ELSE 'pending' END WHERE job_id=? AND doc_id=?").bind(String(e).slice(0,500),job.id,d.doc_id).run();
    }
    await sleep(1500);
  }
  return {state:'running',date:job.cursor};
}
export default {
  async scheduled(event,env,ctx){ctx.waitUntil(tick(env));},
  async fetch(request,env){
    const url=new URL(request.url);
    if(!env.ADMIN_TOKEN||request.headers.get('Authorization')!=='Bearer '+env.ADMIN_TOKEN)return new Response('Unauthorized',{status:401});
    if(request.method==='POST'&&url.pathname==='/start'){
      let from,to;try{({from,to}=await request.json());}catch{return Response.json({error:'Invalid JSON'},{status:400});}
      if(!valid(from)||!valid(to)||new Date(from).toISOString().slice(0,10)!==from||new Date(to).toISOString().slice(0,10)!==to||from>to||to>new Date().toISOString().slice(0,10))return new Response('Invalid dates',{status:400});
      const existing=await env.EDINET_DB.prepare("SELECT id FROM archive_jobs WHERE state='running' LIMIT 1").first();
      if(existing)return Response.json({error:'Already running',id:existing.id},{status:409});
      const r=await env.EDINET_DB.prepare("INSERT INTO archive_jobs(start_date,end_date,cursor,state) VALUES(?,?,?,'running')").bind(from,to,from).run();
      return Response.json({id:r.meta.last_row_id,state:'running'});
    }
    if(request.method==='POST'&&url.pathname==='/retry-failed'){
      const j=await env.EDINET_DB.prepare("SELECT id FROM archive_jobs WHERE state='running' ORDER BY id DESC LIMIT 1").first();
      if(!j)return Response.json({error:'No running job'},{status:409});
      const result=await env.EDINET_DB.prepare("UPDATE archive_docs SET state='pending',attempts=0 WHERE job_id=? AND state='failed'").bind(j.id).run();
      return Response.json({reset:result.meta.changes});
    }
    if(request.method==='POST'&&url.pathname==='/pause'){
      await env.EDINET_DB.prepare("UPDATE archive_jobs SET state='paused' WHERE state='running'").run();
      return Response.json({state:'paused'});
    }
    if(request.method==='POST'&&url.pathname==='/resume'){
      const active=await env.EDINET_DB.prepare("SELECT id FROM archive_jobs WHERE state='running' LIMIT 1").first();
      if(active)return Response.json({error:'Already running'},{status:409});
      const paused=await env.EDINET_DB.prepare("SELECT id FROM archive_jobs WHERE state='paused' ORDER BY id DESC LIMIT 1").first();
      if(!paused)return Response.json({error:'No paused job'},{status:404});
      await env.EDINET_DB.prepare("UPDATE archive_jobs SET state='running' WHERE id=?").bind(paused.id).run();
      return Response.json({state:'running',id:paused.id});
    }
    if(url.pathname==='/status'){
      const j=await env.EDINET_DB.prepare("SELECT * FROM archive_jobs ORDER BY id DESC LIMIT 1").first();
      if(!j)return Response.json({state:'idle'});
      const counts=await env.EDINET_DB.prepare("SELECT state,count(*) count FROM archive_docs WHERE job_id=? GROUP BY state").bind(j.id).all();
      return Response.json({job:j,documents:counts.results});
    }
    return new Response('Not found',{status:404});
  }
};