import {WorkerEntrypoint} from 'cloudflare:workers';
import {assessStored,searchPrograms,readBoundedJSON,runSupportWithEligibility as collectDue} from './eligibility.js';
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
  if(request.method!=='GET'&&!(request.method==='POST'&&u.pathname==='/api/eligibility'))return new Response('Method not allowed',{status:405,headers:security});
  if(u.pathname.startsWith('/admin'))return new Response('Not found',{status:404,headers:security});
  let response;
  if(u.pathname==='/api/eligibility'){
   if(request.method!=='POST')response=Response.json({error:'post_required'},{status:405});
   else {try{const body=await readBoundedJSON(request);if(!body||Array.isArray(body)||typeof body!=='object'||Object.keys(body).some(k=>!['programId','answers'].includes(k))||typeof body.programId!=='string')throw Error('invalid_request');const result=await assessStored(env,body.programId,body.answers);response=result?Response.json(result):Response.json({error:'conditions_not_found'},{status:404});}catch(error){const inputError=['invalid_request','invalid_json','invalid_content_type','input_too_large','invalid_answers','unknown_answer_field','invalid_answer_type','future_birth_date'].includes(error.message)||error instanceof SyntaxError;response=Response.json({error:inputError?'invalid_input':'conditions_unavailable'},{status:inputError?400:503});}}
  } else if(u.pathname==='/api/search'){
   try{response=Response.json(await searchPrograms(env,{q:u.searchParams.get('q')||'',region:u.searchParams.get('region')||'all',category:u.searchParams.get('category')||'all'}));}catch{response=Response.json({error:'search_unavailable'},{status:400});}
  } else if(u.pathname==='/api/conditions'){
   const document=await readConditions(env,u.searchParams.get('program_id')||'');
   response=document?Response.json(document):Response.json({error:'condition_document_not_found'},{status:404});
  } else if(u.pathname==='/api/programs'||u.pathname==='/programs.json'){
   const q=(u.searchParams.get('q')||'').slice(0,100);
   const {results}=await env.DB.prepare('SELECT * FROM programs WHERE name LIKE ? ORDER BY name LIMIT 100').bind('%'+q+'%').all();
   response=Response.json(results);
  } else response=assets[u.pathname]?new Response(assets[u.pathname].body,{headers:{'Content-Type':assets[u.pathname].type}}):new Response('Not found',{status:404});
  const secured=new Response(response.body,response);for(const [k,v]of Object.entries(security))secured.headers.set(k,v);return secured;
 },
 async scheduled(controller,env,ctx){ctx.waitUntil(collectDue(env).then(result=>console.log(JSON.stringify({event:'collection',...result}))).catch(error=>{console.error(JSON.stringify({event:'collection_fatal',message:String(error)}));throw error;}));}
};

// Internal-only capability; no public route can invoke a collection.
export class SupportCollector extends WorkerEntrypoint {
 async run(){return collectDue(this.env);}
}
