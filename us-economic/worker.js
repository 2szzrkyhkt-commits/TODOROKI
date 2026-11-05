// Isolated starter Worker: daily incremental sync of official BLS public API series.
// Does not modify existing TODOROKI routes or the separate US tool.
// Requires D1 binding US_DB and Cron Trigger; deploy only after configuring both.
// BLS public API v1: https://api.bls.gov/publicAPI/v1/timeseries/data/
// Only approved official BLS series; no FRED redistribution.
const SERIES = [
  {id:'CUUR0000SA0', title:'CPI-U all items, U.S. city average', unit:'index 1982-84=100', frequency:'monthly'},
  {id:'LNS14000000', title:'Civilian unemployment rate', unit:'percent', frequency:'monthly'}
];
const endpoint='https://api.bls.gov/publicAPI/v1/timeseries/data/';
const stamp=()=>new Date().toISOString();
async function sync(env) {
  if (!env.US_DB) throw new Error('Missing US_DB D1 binding');
  const started=stamp(), runId=crypto.randomUUID();
  await env.US_DB.prepare('INSERT INTO us_runs(id,started_at,status) VALUES(?,?,?)').bind(runId,started,'running').run();
  const report=[];
  for(const s of SERIES) {
    try {
      const endYear=new Date().getUTCFullYear();
      // Backfill up to 10 calendar years once, then check the most recent 2 years daily.
      // Public API v1 accepts a maximum 10-year inclusive window.
      const existing=await env.US_DB.prepare('SELECT COUNT(*) AS n FROM us_observations WHERE series_id=?').bind(s.id).first();
      const startYear=Number(existing?.n||0)===0?endYear-9:endYear-1;
      const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({seriesid:[s.id],startyear:String(startYear),endyear:String(endYear)}),
        signal:AbortSignal.timeout(15000)});
      if(!res.ok) throw new Error('BLS HTTP '+res.status);
      const payload=await res.json();
      if(payload.status!=='REQUEST_SUCCEEDED') throw new Error('BLS status '+String(payload.status));
      const rows=payload.Results?.series?.[0]?.data;
      if(!Array.isArray(rows)) throw new Error('Invalid BLS response');
      const valid=rows.filter(x=>/^M(0[1-9]|1[0-2])$/.test(x.period)&&/^[-+]?\d+(?:\.\d+)?$/.test(String(x.value)));
      if(!valid.length) throw new Error('No valid monthly observations');
      await env.US_DB.prepare(`INSERT INTO us_series(id,source,title,unit,frequency,last_checked_at,last_success_at,last_error)
        VALUES(?,'BLS',?,?,?,?,?,NULL)
        ON CONFLICT(id) DO UPDATE SET last_checked_at=excluded.last_checked_at,
        last_success_at=excluded.last_success_at,last_error=NULL`)
        .bind(s.id,s.title,s.unit,s.frequency,stamp(),stamp()).run();
      for(const row of valid) {
        const period=row.year+'-'+row.period.slice(1);
        await env.US_DB.prepare(`INSERT INTO us_observations(series_id,period,value,updated_at)
          VALUES(?,?,?,?) ON CONFLICT(series_id,period) DO UPDATE SET
          value=excluded.value,updated_at=CASE WHEN value<>excluded.value THEN excluded.updated_at ELSE updated_at END`)
          .bind(s.id,period,Number(row.value),stamp()).run();
      }
      report.push({series:s.id,status:'ok',rows:valid.length});
    } catch(e) {
      const message=String(e.message||e).slice(0,250);
      await env.US_DB.prepare(`INSERT INTO us_series(id,source,title,unit,frequency,last_checked_at,last_error)
        VALUES(?,'BLS',?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET last_checked_at=excluded.last_checked_at,last_error=excluded.last_error`)
        .bind(s.id,s.title,s.unit,s.frequency,stamp(),message).run();
      report.push({series:s.id,status:'error',error:message});
    }
  }
  const failed=report.some(x=>x.status==='error');
  await env.US_DB.prepare('UPDATE us_runs SET finished_at=?,status=?,details=? WHERE id=?')
    .bind(stamp(),failed?'partial_failure':'success',JSON.stringify(report),runId).run();
  return {runId,status:failed?'partial_failure':'success',report};
}
export default {
  async scheduled(_event,env,ctx){ctx.waitUntil(sync(env));},
  async fetch(request,env){
    const url=new URL(request.url);
    if(request.method!=='GET') return new Response('Method not allowed',{status:405});
    if(url.pathname==='/health') return Response.json({service:'us-economic-sync',configured:!!env.US_DB});
    if(url.pathname!=='/series') return new Response('Not found',{status:404});
    const id=url.searchParams.get('id');
    if(!SERIES.some(s=>s.id===id)) return new Response('Unknown series',{status:400});
    if(!env.US_DB) return new Response('Not configured',{status:503});
    const rows=await env.US_DB.prepare('SELECT period,value FROM us_observations WHERE series_id=? ORDER BY period DESC LIMIT 360').bind(id).all();
    return Response.json({series:id,observations:rows.results},{headers:{'Access-Control-Allow-Origin':'https://todoroki-gold.com','Cache-Control':'public, max-age=3600'}});
  }
};
