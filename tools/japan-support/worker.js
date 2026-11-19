import {runJgrants,readSubsidies,ATTRIBUTION} from './jgrants.js';
import {readCatalog} from './catalog.js';
import {calculateStoredAmount,runSupportWithAmounts as collectDue} from './amounts.js';
import {WorkerEntrypoint} from 'cloudflare:workers';
import {assessStored,searchPrograms,readBoundedJSON} from './eligibility.js';
import {assets} from './embedded-assets.js';
import {readConditions} from './conditions.js';
const security={'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"};
export default {
 async fetch(request,env,ctx) {
  // Trust only Cloudflare-validated runtime Access identity, never a raw request header.
  // Until Access integration has been verified end-to-end, every URL fails closed.
  if(env.ACCESS_VERIFIED!=='true'||!env.ACCESS_AUD||!ctx.access || ctx.access.aud!==env.ACCESS_AUD) return new Response('開発環境はロックされています',{status:403,headers:security});
  let identity; try { identity=await ctx.access.getIdentity(); } catch { return new Response('認証を確認できません',{status:403,headers:security}); }
  if(!identity?.email)return new Response('認証が必要です',{status:403,headers:security});
  const u=new URL(request.url);
  if(request.method!=='GET'&&!(request.method==='POST'&&['/api/eligibility','/api/amounts'].includes(u.pathname)))return new Response('Method not allowed',{status:405,headers:security});
  if(u.pathname.startsWith('/admin'))return new Response('Not found',{status:404,headers:security});
  let response;
  if(u.pathname==='/api/subsidies'){
   try{const rows=await readSubsidies(env.DB,u.searchParams.get('q')||'');if(rows.success===false||!Array.isArray(rows.results))throw Error('subsidies_read_failed');response=Response.json({items:rows.results.map(r=>JSON.parse(r.record_json)),attribution:ATTRIBUTION,verification:'pending',coverage:'Jグランツの指定キーワード検索。全国全制度の網羅を保証しません'});}catch{response=Response.json({error:'subsidies_unavailable'},{status:503});}
  } else if(u.pathname==='/api/catalog'){
   try{const result=await readCatalog(env.DB);response=result?Response.json(result):Response.json({error:'catalog_not_collected'},{status:404});}catch{response=Response.json({error:'catalog_unavailable'},{status:503});}
  } else if(u.pathname==='/api/amounts'){
   if(request.method!=='POST')response=Response.json({error:'post_required'},{status:405});
   else {try{const body=await readBoundedJSON(request);const result=await calculateStoredAmount(env,body);response=result?Response.json(result):Response.json({error:'amount_rules_not_found'},{status:404});}catch(error){const inputError=['invalid_amount_input','invalid_json','invalid_content_type','input_too_large'].includes(error.message)||error instanceof SyntaxError;response=Response.json({error:inputError?'invalid_input':'amount_rules_unavailable'},{status:inputError?400:503});}}
  } else if(u.pathname==='/api/eligibility'){
   if(request.method!=='POST')response=Response.json({error:'post_required'},{status:405});
   else {try{const body=await readBoundedJSON(request);if(!body||Array.isArray(body)||typeof body!=='object'||Object.keys(body).some(k=>!['programId','answers'].includes(k))||typeof body.programId!=='string')throw Error('invalid_request');const result=await assessStored(env,body.programId,body.answers);response=result?Response.json(result):Response.json({error:'conditions_not_found'},{status:404});}catch(error){const inputError=['invalid_request','invalid_json','invalid_content_type','input_too_large','invalid_answers','unknown_answer_field','invalid_answer_type','future_birth_date'].includes(error.message)||error instanceof SyntaxError;response=Response.json({error:inputError?'invalid_input':'conditions_unavailable'},{status:inputError?400:503});}}
  } else if(u.pathname==='/api/search'){
   try{response=Response.json(await searchPrograms(env,{q:u.searchParams.get('q')||'',region:u.searchParams.get('region')||'all',category:u.searchParams.get('category')||'all'}));}catch(error){const inputError=['invalid_search','search_scope_limit'].includes(error?.message);response=Response.json({error:'search_unavailable'},{status:inputError?400:503});}
  } else if(u.pathname==='/api/conditions'){
   try{const document=await readConditions(env,u.searchParams.get('program_id')||'');response=document?Response.json(document):Response.json({error:'condition_document_not_found'},{status:404});}catch{response=Response.json({error:'conditions_unavailable'},{status:503});}
  } else if(u.pathname==='/api/programs'||u.pathname==='/programs.json'){
   const q=(u.searchParams.get('q')||'').slice(0,100);
   try{const rows=await env.DB.prepare('SELECT * FROM programs WHERE name LIKE ? ORDER BY name LIMIT 100').bind('%'+q+'%').all();if(rows.success===false||!Array.isArray(rows.results))throw Error('programs_read_failed');response=Response.json(rows.results);}catch{response=Response.json({error:'programs_unavailable'},{status:503});}
  } else response=assets[u.pathname]?new Response(assets[u.pathname].body,{headers:{'Content-Type':assets[u.pathname].type}}):new Response('Not found',{status:404});
  const secured=new Response(response.body,response);for(const [k,v]of Object.entries(security))secured.headers.set(k,v);return secured;
 },
 async scheduled(controller,env,ctx){ctx.waitUntil(collectDue(env).then(result=>console.log(JSON.stringify({event:'collection',...result}))).catch(error=>{console.error(JSON.stringify({event:'collection_fatal',message:String(error)}));throw error;}));}
};

// Internal-only capability; no public route can invoke a collection.
export class SupportCollector extends WorkerEntrypoint {
 async run(){const results=await Promise.allSettled([collectDue(this.env),runJgrants(this.env)]);return results.map(r=>r.status==='fulfilled'?r.value:{status:'failed',error:String(r.reason)});}
}
