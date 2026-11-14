// Native Cloudflare Cron coordinator. Connect owns all jobs, encrypted keys and R2 files.
// No EDINET API key, financial records or second collection queue is copied here.
const ORIGIN='https://todoroki-edinet-connect.easysquid66.chatgpt.site';
export function futureTime(value,now=Date.now()){
 const at=typeof value==='number'?value:typeof value==='string'&&value.trim()?(Number.isFinite(Number(value))?Number(value):Date.parse(value)):NaN;
 return Number.isFinite(at)&&at>now;
}
export async function runScheduled(env){
 if(!env.EDINET_CONNECT_TOKEN)return {state:'not_configured',reason:'EDINET_CONNECT_TOKEN'};
 const headers={'OAI-Sites-Authorization':'Bearer '+env.EDINET_CONNECT_TOKEN,Origin:ORIGIN,'Content-Type':'application/json','X-Todoroki-Runner':'cloudflare-cron'};
 const read=async(op,post=false)=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),70000);let r;try{r=await fetch(ORIGIN+'/api/background/'+op,{method:post?'POST':'GET',headers,...(post?{body:'{}'}:{}),redirect:'manual',signal:controller.signal});}finally{clearTimeout(timer);}if(!r.ok)throw Error('CONNECT_HTTP_'+r.status);return r.json();};
 let result=await read('status'),calls=0;const start=Date.now();
 while(['running','watching'].includes(result.state)&&calls<6&&Date.now()-start<210000){if(futureTime(result.retryAt)||futureTime(result.nextPollAt))break;if(futureTime(result.lease))break;const before=result.updatedAt;result=await read('tick',true);calls++;if(result.state==='busy'||result.updatedAt===before)break;}
 const summary={state:result.state,calls,processed:result.processed,saved:result.saved,lastBatchFinishedAt:result.lastBatchFinishedAt,error:result.lastError||null};
 console.log(JSON.stringify({event:'edinet_native_cron',...summary}));return summary;
}
export default {async scheduled(event,env,ctx){ctx.waitUntil(runScheduled(env));if(env.SUPPORT_COLLECTOR){ctx.waitUntil(env.SUPPORT_COLLECTOR.run().then(result=>console.log(JSON.stringify({event:'japan_support_collection_dispatch',...result}))).catch(error=>{console.error(JSON.stringify({event:'japan_support_collection_dispatch',status:'failed',error:String(error.message).slice(0,120)}));}));}if(new Date(event.scheduledTime).getUTCMinutes()%30===0){ctx.waitUntil(env.TAX_COLLECTOR.fetch('https://tax.internal/setup-run',{method:'POST',headers:{Authorization:'Bearer '+env.TAX_RUN_TOKEN}}).then(async r=>{const result=await r.text();console.log(JSON.stringify({event:'tax_collection_dispatch',status:r.status,result}));if(!r.ok)throw Error('TAX_COLLECTOR_HTTP_'+r.status);}));}},async fetch(){return Response.json({service:'TODOROKI EDINET native coordinator',control:'Use the private EDINET Connect dashboard. This endpoint cannot start collection.'},{headers:{'Cache-Control':'no-store'}});}};

