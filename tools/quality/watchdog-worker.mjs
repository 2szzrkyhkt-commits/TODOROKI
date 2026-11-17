// Deploy separately; never attach to the production website or its D1 database.
// Required secret: GITHUB_TOKEN (fine-grained Actions read only).
// Required binding: STATE (KV). Optional: ALERT_WEBHOOK (secret).
const MAX_AGE_MS=3*3600000;
function fresh(at){
 const age=Date.now()-Date.parse(at);
 return typeof at==='string'&&Number.isFinite(age)&&age>=0&&age<MAX_AGE_MS;
}
export default {
 async scheduled(event,env,ctx){ctx.waitUntil(scheduledAudit(env));},
 async fetch(request,env){
  if(new URL(request.url).pathname!=='/health')return new Response('Not found',{status:404});
  let value;
  try{value=await env.STATE.get('heartbeat','json');}catch{value=null;}
  const ok=fresh(value?.at)&&value?.ok===true;
  return Response.json({at:typeof value?.at==='string'?value.at:null,ok},{status:ok?200:503,headers:{'Cache-Control':'no-store'}});
 }
};
export async function check(env){
 const url='https://api.github.com/repos/2szzrkyhkt-commits/TODOROKI/actions/workflows/quality-audit.yml/runs?event=schedule&per_page=10';
 const res=await retryFetch(url,{headers:{Authorization:`Bearer ${env.GITHUB_TOKEN}`,'User-Agent':'TODOROKI-audit-watchdog','Accept':'application/vnd.github+json'}});
 if(!res.ok)throw new Error(`watchdog GitHub read ${res.status}`);
 const {workflow_runs:runs}=await res.json();
 if(!Array.isArray(runs))throw new Error('watchdog GitHub response invalid');
 const latest=runs.find(r=>r.event==='schedule'&&r.head_branch==='main'&&r.status==='completed'&&r.conclusion==='success');
 const stale=!latest||!fresh(latest.updated_at);
 const key=stale?'scheduled-audit-stale':'healthy';
 const prior=await env.STATE.get('status');
 // A separate monitor is essential; this worker cannot detect its own suspension.
 if(stale&&prior!==key){
  if(!env.ALERT_WEBHOOK)throw new Error('ALERT_WEBHOOK not configured; notification not delivered');
  const sent=await fetch(env.ALERT_WEBHOOK,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'TODOROKI: scheduled quality audit has no successful run within 3 hours.'})});
  if(!sent.ok)throw new Error(`notification ${sent.status}`);
 }
 await env.STATE.put('status',key);
 return {ok:!stale,state:key};
}

export async function retryFetch(url,options={},sleep=ms=>new Promise(r=>setTimeout(r,ms))){
 let last;
 for(let i=0;i<3;i++){
  try{const response=await fetch(url,{...options,signal:AbortSignal.timeout(10000)});if(response.status!==429&&response.status<500)return response;last=new Error('upstream HTTP '+response.status);}
  catch(e){last=new Error(e.name==='TimeoutError'?'upstream timeout':'upstream network error');}
  if(i<2)await sleep(1000*2**i);
 }
 throw last;
}
export async function scheduledAudit(env){
 const at=new Date().toISOString();
 try{
  const response=await retryFetch('https://todoroki-gold.com/',{redirect:'follow'});
  await env.STATE.put('site-latest',JSON.stringify({at,status:response.status,ok:response.ok}));
  const audit=await check(env);
  if(!response.ok)throw new Error(`watchdog site HTTP ${response.status}`);
  if(!audit.ok)throw new Error('watchdog scheduled audit stale');
  await env.STATE.put('heartbeat',JSON.stringify({at,ok:true}));
 }catch(e){
  const prior=JSON.parse(await env.STATE.get('failures')||'[]');
  prior.push({at,error:String(e.message).slice(0,160)});
  await env.STATE.put('failures',JSON.stringify(prior.slice(-30)));
  await env.STATE.put('heartbeat',JSON.stringify({at,ok:false}));
  throw e;
 }
}
