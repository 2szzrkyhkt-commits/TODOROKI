// Deploy separately; never attach to the production website or its D1 database.
// Required secret: GITHUB_TOKEN (fine-grained Actions read only).
// Required binding: STATE (KV). Optional: ALERT_WEBHOOK (secret).
export default {
 async scheduled(event,env,ctx){ctx.waitUntil(check(env));},
 async fetch(){return new Response('Not found',{status:404});}
};
export async function check(env){
 const url='https://api.github.com/repos/2szzrkyhkt-commits/TODOROKI/actions/workflows/quality-audit.yml/runs?event=schedule&per_page=10';
 const res=await fetch(url,{headers:{Authorization:`Bearer ${env.GITHUB_TOKEN}`,'User-Agent':'TODOROKI-audit-watchdog','Accept':'application/vnd.github+json'}});
 if(!res.ok)throw new Error(`watchdog GitHub read ${res.status}`);
 const {workflow_runs:runs}=await res.json();
 const latest=runs.find(r=>r.conclusion==='success');
 const stale=!latest||Date.now()-Date.parse(latest.updated_at)>3*3600000;
 const key=stale?'scheduled-audit-stale':'healthy';
 const prior=await env.STATE.get('status');
 // A separate monitor is essential; this worker cannot detect its own suspension.
 if(stale&&prior!==key){
  if(!env.ALERT_WEBHOOK)throw new Error('ALERT_WEBHOOK not configured; notification not delivered');
  const sent=await fetch(env.ALERT_WEBHOOK,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'TODOROKI: scheduled quality audit has no successful run within 3 hours.'})});
  if(!sent.ok)throw new Error(`notification ${sent.status}`);
 }
 await env.STATE.put('status',key);
}
