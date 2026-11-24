import {MAX_BYTES, publicMetadata} from './assets/tax-public-metadata.mjs';
const headers={'Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex','Referrer-Policy':'no-referrer'};
const CACHE_URL='https://todoroki-gold.com/api/tax-catalog';
const success=rows=>new Response(JSON.stringify(rows),{headers:{...headers,'Cache-Control':'public, max-age=300'}});
export async function taxPublicFeed(request,env,cache=globalThis.caches?.default){
 const u=new URL(request.url);
 if(u.origin!=='https://todoroki-gold.com'||u.pathname!=='/api/tax-catalog')return new Response(JSON.stringify({error:'not_found'}),{status:404,headers:{...headers,'Cache-Control':'no-store'}});
 if(request.method!=='GET')return new Response(JSON.stringify({error:'method_not_allowed'}),{status:405,headers:{...headers,Allow:'GET','Cache-Control':'no-store'}});
 if(u.search)return new Response(JSON.stringify({error:'invalid_request'}),{status:400,headers:{...headers,'Cache-Control':'no-store'}});
 // Fixed URL-only key: no cookies, authorization, query or arbitrary host enters cache identity.
 const key=new Request(CACHE_URL,{method:'GET'});
 if(cache)try{const hit=await cache.match(key);if(hit?.ok){const text=await hit.text();if(new TextEncoder().encode(text).length<=MAX_BYTES)return success(publicMetadata(JSON.parse(text)));}}catch{}
 let timer;try{
  if(typeof env.TAX_PUBLIC_FEED?.catalog!=='function')throw Error('unavailable');
  const rows=publicMetadata(await Promise.race([env.TAX_PUBLIC_FEED.catalog(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('timeout')),1500);})]));
  const response=success(rows);
  // Only reconstructed, validated successes are stored. Cache failure must not hide valid data.
  if(cache)try{await cache.put(key,response.clone());}catch{}
  return response;
 }catch{return new Response(JSON.stringify({error:'tax_metadata_unavailable'}),{status:503,headers:{...headers,'Cache-Control':'no-store'}});}finally{clearTimeout(timer);}
}
