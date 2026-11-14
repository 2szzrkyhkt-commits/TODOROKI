import {WorkerEntrypoint} from 'cloudflare:workers';
import {assets} from './embedded-assets.js';
import {collectDue} from './collector.js';
const security={'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"};
export default {
 async fetch(request,env,ctx) {
  // Trust only Cloudflare-validated runtime Access identity, never a raw request header.
  // Until Access integration has been verified end-to-end, every URL fails closed.
  if(env.ACCESS_VERIFIED!=='true'||!env.ACCESS_AUD||!ctx.access || ctx.access.aud!==env.ACCESS_AUD) return new Response('開発環境はロックされています',{status:403,headers:security});
  let identity; try { identity=await ctx.access.getIdentity(); } catch { return new Response('認証を確認できません',{status:403,headers:security}); }
  if(!identity?.email)return new Response('認証が必要です',{status:403,headers:security});
  const u=new URL(request.url);
  if(request.method!=='GET')return new Response('Method not allowed',{status:405,headers:security});
  if(u.pathname.startsWith('/admin'))return new Response('Not found',{status:404,headers:security});
  let response;
  if(u.pathname==='/api/programs'||u.pathname==='/programs.json'){
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

