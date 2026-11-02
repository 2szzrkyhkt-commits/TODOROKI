// US Equity Lab prototype worker. Bind D1 as DB and set SEC_USER_AGENT to a real contact.
// SEC fair-access policy: keep requests comfortably below 10/second per originating IP.
const SEC='https://data.sec.gov';
const JSON_HEADERS={'content-type':'application/json','cache-control':'no-store'};
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:JSON_HEADERS});
const cik10=x=>String(x).replace(/\D/g,'').padStart(10,'0');
async function secFetch(path,env){
  if(!env.SEC_USER_AGENT || !env.SEC_USER_AGENT.includes('@'))throw Error('SEC_USER_AGENT with contact email is required');
  const r=await fetch(SEC+path,{headers:{'User-Agent':env.SEC_USER_AGENT,'Accept':'application/json'}});
  if(!r.ok)throw Error('SEC HTTP '+r.status);
  return r.json();
}
async function refreshTickers(env){
  const r=await fetch('https://www.sec.gov/files/company_tickers_exchange.json',{headers:{'User-Agent':env.SEC_USER_AGENT,'Accept':'application/json'}});
  if(!r.ok)throw Error('SEC ticker exchange HTTP '+r.status);
  const j=await r.json(),idx=Object.fromEntries(j.fields.map((f,i)=>[f,i]));
  let count=0;
  for(const row of j.data){
    const exchange=String(row[idx.exchange]||'');
    if(!['Nasdaq','NYSE','NYSE American','NYSE Arca'].includes(exchange))continue;
    const cik=cik10(row[idx.cik]),ticker=String(row[idx.ticker]||''),name=String(row[idx.name]||'');
    if(!ticker||!name)continue;
    await env.DB.prepare('INSERT INTO issuers(cik,ticker,name,exchange) VALUES(?,?,?,?) ON CONFLICT(cik) DO UPDATE SET ticker=excluded.ticker,name=excluded.name,exchange=excluded.exchange,updated_at=CURRENT_TIMESTAMP').bind(cik,ticker,name,exchange).run();
    await env.DB.prepare("INSERT OR IGNORE INTO collection_jobs(cik,status) VALUES(?,'pending')").bind(cik).run();
    count++;
  }
  return count;
}
function selectAnnual(facts){
  const out=new Map();
  for(const [taxonomy,concepts] of Object.entries(facts||{})){
    if(!['us-gaap','dei','ifrs-full'].includes(taxonomy))continue;
    for(const [concept,detail] of Object.entries(concepts)){
      for(const [unit,entries] of Object.entries(detail.units||{})){
        for(const e of entries){
          if(!['10-K','10-K/A','20-F','20-F/A'].includes(e.form)||e.fp!=='FY'||!Number.isInteger(e.fy)||!Number.isFinite(e.val)||!e.end||!e.accn||!e.filed)continue;
          if(e.start){const days=(Date.parse(e.end)-Date.parse(e.start))/86400000;if(days<330||days>380)continue;}
          // Prevent restated comparative years from masquerading as the filing's own fiscal year.
          if(e.frame && !/^CY\d{4}$/.test(e.frame) && !/^CY\d{4}Q4I$/.test(e.frame))continue;
          const key=[e.fy,taxonomy,concept,unit].join('|');
          const prev=out.get(key);
          if(!prev||e.filed>prev.filed||(e.filed===prev.filed&&e.accn>prev.accn))out.set(key,{year:e.fy,taxonomy,concept,unit,val:e.val,accn:e.accn,filed:e.filed,form:e.form,start:e.start||null,end:e.end});
        }
      }
    }
  }
  return [...out.values()];
}
async function collectOne(env,cik){
  const data=await secFetch('/api/xbrl/companyfacts/CIK'+cik+'.json',env);
  const facts=selectAnnual(data.facts);
  for(let i=0;i<facts.length;i+=50){
    const batch=facts.slice(i,i+50).map(f=>env.DB.prepare('INSERT INTO annual_facts(cik,fiscal_year,fiscal_period_end,concept,taxonomy,unit,value,accession,filed_at,form,source_start,source_end) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(cik,fiscal_year,concept,taxonomy,unit) DO UPDATE SET value=excluded.value,accession=excluded.accession,filed_at=excluded.filed_at,form=excluded.form,fiscal_period_end=excluded.fiscal_period_end,source_start=excluded.source_start,source_end=excluded.source_end,updated_at=CURRENT_TIMESTAMP').bind(cik,f.year,f.end,f.concept,f.taxonomy,f.unit,f.val,f.accn,f.filed,f.form,f.start,f.end));
    await env.DB.batch(batch);
  }
  await env.DB.prepare("UPDATE collection_jobs SET status='done',completed_at=CURRENT_TIMESTAMP,last_error=NULL WHERE cik=?").bind(cik).run();
  return facts.length;
}
async function runBatch(env,limit=3){
  const jobs=await env.DB.prepare("SELECT cik FROM collection_jobs WHERE status='pending' OR (status='error' AND attempts<3) ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END,attempts,cik LIMIT ?").bind(Math.min(limit,5)).all();
  let done=0,errors=0;
  for(const row of jobs.results){
    await env.DB.prepare("UPDATE collection_jobs SET status='running',attempts=attempts+1,last_attempt_at=CURRENT_TIMESTAMP WHERE cik=?").bind(row.cik).run();
    try{await collectOne(env,row.cik);done++;}
    catch(e){errors++;await env.DB.prepare("UPDATE collection_jobs SET status='error',last_error=? WHERE cik=?").bind(String(e.message).slice(0,300),row.cik).run();}
  }
  return {done,errors};
}
export default {
 async scheduled(event,env,ctx){
   ctx.waitUntil((async()=>{
     if(!env.SEC_USER_AGENT)return;
     // Requeue interrupted jobs. Ticker refresh is separately initiated by administrator.
     await env.DB.prepare("UPDATE collection_jobs SET status='pending' WHERE status='running' AND last_attempt_at < datetime('now','-30 minutes')").run();
     await runBatch(env,3);
   })());
 },
 async fetch(request,env){
   const url=new URL(request.url),path=url.pathname;
   try{
     if(path==='/api/status'){
       const r=await env.DB.prepare('SELECT status,COUNT(*) AS count FROM collection_jobs GROUP BY status').all();
       return response({jobs:r.results,mode:'prototype'});
     }
     if(path==='/api/companies'){
       const q=(url.searchParams.get('q')||'').trim().slice(0,60);
       if(!q)return response({companies:[]});
       const r=await env.DB.prepare('SELECT cik,ticker,name,exchange,market_tier FROM issuers WHERE ticker LIKE ? OR name LIKE ? ORDER BY ticker LIMIT 30').bind(q.toUpperCase()+'%','%'+q+'%').all();
       return response({companies:r.results});
     }
     if(path==='/api/annual'){
       const cik=url.searchParams.get('cik')||'';
       if(!/^\d{1,10}$/.test(cik))return response({error:'valid CIK required'},400);
       const r=await env.DB.prepare('SELECT fiscal_year,concept,taxonomy,unit,value,accession,filed_at,form,source_start,source_end FROM annual_facts WHERE cik=? ORDER BY fiscal_year DESC LIMIT 5000').bind(cik10(cik)).all();
       return response({cik:cik10(cik),facts:r.results});
     }
     // Administrative operations require a bearer token. Never expose token to frontend.
     if(path==='/admin/refresh-tickers'||path==='/admin/collect'){
       if(!env.ADMIN_TOKEN||request.headers.get('authorization')!=='Bearer '+env.ADMIN_TOKEN)return response({error:'unauthorized'},401);
       if(request.method!=='POST')return response({error:'POST required'},405);
       return response(path.endsWith('refresh-tickers')?{issuers:await refreshTickers(env)}:await runBatch(env,3));
     }
     return response({service:'TODOROKI US Equity Lab',endpoints:['/api/status','/api/companies?q=AAPL','/api/annual?cik=320193']});
   }catch(e){return response({error:String(e.message)},500);}
 }
};
