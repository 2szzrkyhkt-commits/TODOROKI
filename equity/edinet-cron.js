// Native Cloudflare Cron coordinator. Connect owns all jobs, encrypted keys and R2 files.
// No EDINET API key, financial records or second collection queue is copied here.
const ORIGIN='https://todoroki-edinet-connect.easysquid66.chatgpt.site';
export async function runScheduled(env){
 if(!env.EDINET_CONNECT_TOKEN)return {state:'not_configured',reason:'EDINET_CONNECT_TOKEN'};
 const headers={'OAI-Sites-Authorization':'Bearer '+env.EDINET_CONNECT_TOKEN,Origin:ORIGIN,'Content-Type':'application/json','X-Todoroki-Runner':'cloudflare-cron'};
 const read=async(op,post=false)=>{const r=await fetch(ORIGIN+'/api/background/'+op,{method:post?'POST':'GET',headers,...(post?{body:'{}'}:{}),redirect:'error',signal:AbortSignal.timeout(70000)});if(!r.ok)throw Error('CONNECT_HTTP_'+r.status);return r.json();};
 let result=await read('status'),calls=0;const start=Date.now();
 while(['running','watching'].includes(result.state)&&calls<6&&Date.now()-start<210000){if(result.retryAt>Date.now()||result.nextPollAt>Date.now())break;if(result.lease>Date.now())break;const before=result.updatedAt;result=await read('tick',true);calls++;if(result.state==='busy'||result.updatedAt===before)break;}
 const summary={state:result.state,calls,processed:result.processed,saved:result.saved,lastBatchFinishedAt:result.lastBatchFinishedAt,error:result.lastError||null};
 console.log(JSON.stringify({event:'edinet_native_cron',...summary}));return summary;
}
export default {async scheduled(event,env){await runScheduled(env);},async fetch(){return Response.json({service:'TODOROKI EDINET native coordinator',control:'Use the private EDINET Connect dashboard. This endpoint cannot start collection.'},{headers:{'Cache-Control':'no-store'}});}};
