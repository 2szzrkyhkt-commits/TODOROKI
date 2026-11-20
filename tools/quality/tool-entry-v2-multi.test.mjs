import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const file=new URL('../../worker.js',import.meta.url),source=await fs.readFile(file,'utf8');const code=source.replace(/^(\s*import\s+[^\n]+?\s+from\s+)(['"])(\.\/[^'"\n]+)\2/gm,(_,a,q,b)=>a+JSON.stringify(new URL(b,file).href));const w=(await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))).default;
class DB{rows=new Map();fail=false;prepare(sql){const db=this;return{bind(...args){this.args=args;return this},async run(){if(db.fail)throw Error('fixture unavailable');assert.match(sql,/id LIKE 'toolv2:%'/);let n=0;for(const [k,v]of db.rows)if(k.startsWith('toolv2:')&&v.expires_at<=this.args[0]&&n++<100)db.rows.delete(k);return{success:true}},async first(){if(db.fail)throw Error('fixture unavailable');const a=this.args;if(sql.startsWith('SELECT hits')){const r=db.rows.get(a[0]);return r?{hits:r.hits}:null;}if(sql.startsWith('UPDATE')){const r=db.rows.get(a[1]);if(!r||r.hits!==a[2]||r.expires_at<=a[3])return null;r.hits=a[0];return{id:a[1]};}const r=db.rows.get(a[0]);if(sql.includes('VALUES (?,1,?)')){if(r){if(r.hits>=(sql.includes('hits<60')?60:5))return null;r.hits++;}else db.rows.set(a[0],{hits:1,expires_at:a[1]});}else{if(r)return null;db.rows.set(a[0],{hits:0,expires_at:a[1]});}return{id:a[0]};}}}}

const O='https://todoroki-gold.com',ua='destination-UA',secret='test-only'.repeat(9),env={AUTH_SECRET:secret,DB:new DB()};
const configs={equity:{aud:'todoroki-equity-lab',src:'__Host-todoroki_equity_source',prefix:'toolv2:'},jp:{aud:'todoroki-economy-data',src:'__Host-todoroki_jp_source',prefix:'toolv2:jp:'},us:{aud:'todoroki-us-economy-data',src:'__Host-todoroki_us_source',prefix:'toolv2:us:'}};
const raw='b'.repeat(64),digest=createHash('sha256').update(raw).digest('hex');
const run=(path,headers={},method='GET',data)=>w.fetch(new Request(O+path,{method,headers,body:data?JSON.stringify(data):undefined}),env);
const verify=(kind,token,aud,extra={})=>run('/api/tools/verify',{'Content-Type':'application/json'},'POST',{kind,token,aud,ua,destProof:digest,destSecret:raw,...extra});
const start=slug=>run('/api/tools/'+slug+'?flow=v2',{Referer:O+'/','CF-Connecting-IP':'192.0.2.40','User-Agent':'source-UA'});
const cookies=[];
for(const [slug,cfg]of Object.entries(configs)){
 let r=await start(slug);assert.equal(r.status,303);const intentURL=new URL(r.headers.get('Location')),intent=intentURL.searchParams.get('t');assert.equal(intentURL.origin,'https://'+cfg.aud+'.easysquid66.chatgpt.site');assert.equal(intentURL.pathname,'/prepare');
 const cookie=r.headers.get('Set-Cookie').split(';')[0];assert.ok(cookie.startsWith(cfg.src+'='));cookies.push(cookie.split('=')[0]);
 for(const [other,otherCfg]of Object.entries(configs))if(other!==slug)assert.equal((await verify('prepare-v2',intent,otherCfg.aud)).status,403);
 r=await verify('prepare-v2',intent,cfg.aud);assert.equal(r.status,200);const prep=(await r.json()).prepared;
 for(const other of Object.keys(configs))if(other!==slug)assert.equal((await run('/api/tools/'+other+'-finish?t='+prep,{Cookie:cookie})).status,403);
 r=await run('/api/tools/'+slug+'-finish?t='+prep,{Cookie:cookie});assert.equal(r.status,303);const entryURL=new URL(r.headers.get('Location'));assert.equal(entryURL.origin,intentURL.origin);const entry=entryURL.searchParams.get('t');
 assert.equal((await verify('entry-v2',entry,cfg.aud,{destSecret:digest})).status,403);
 assert.equal((await verify('entry-v2',entry,cfg.aud,{ua:'other-UA'})).status,403);
 for(const [other,otherCfg]of Object.entries(configs))if(other!==slug)assert.equal((await verify('entry-v2',entry,otherCfg.aud)).status,403);
 r=await verify('entry-v2',entry,cfg.aud);assert.equal(r.status,200);const session=(await r.json()).session;assert.equal((await verify('session',session,cfg.aud)).status,200);assert.equal((await verify('entry-v2',entry,cfg.aud)).status,403);
 const route='/api/tools/'+slug+'?flow=auto',admitted={Referer:O+'/','CF-Connecting-IP':'192.0.2.41'};
 // Installed app startup links retain the current route until cookie isolation is solved.
 r=await run('/api/tools/'+slug,{...admitted,'User-Agent':'iPhone'});assert.equal(new URL(r.headers.get('Location')).pathname,'/enter');assert.equal(r.headers.get('Set-Cookie'),null);

 for(const client of ['Mozilla/5.0 X11 Chrome','Mozilla/5.0 Macintosh Safari','Mozilla/5.0 Windows Edg','unknown-profile','']){
  r=await run(route,{...admitted,'User-Agent':client});assert.equal(new URL(r.headers.get('Location')).pathname,'/enter');assert.equal(r.headers.get('Set-Cookie'),null);
 }
 for(const profile of [{'User-Agent':'Mozilla/5.0 (iPhone; CPU iPhone OS) Safari'},{'User-Agent':'Mozilla/5.0 (iPhone; CPU iPhone OS) AppleWebKit'},{'User-Agent':'Mozilla/5.0 (Android 15) Chrome'},{'User-Agent':'reduced','Sec-CH-UA-Mobile':'?1'}]){
  r=await run(route,{...admitted,...profile});assert.equal(r.status,303);assert.equal(new URL(r.headers.get('Location')).pathname,'/prepare');assert.ok(r.headers.get('Set-Cookie')?.startsWith(cfg.src+'='));
 }
 r=await run(route,{Origin:O,'Sec-Fetch-Site':'same-origin','User-Agent':'iPhone','CF-Connecting-IP':'192.0.2.42'},'POST');assert.equal(new URL(r.headers.get('Location')).pathname,'/prepare');
 r=await run(route,{...admitted,'User-Agent':'Android'});assert.equal(new URL(r.headers.get('Location')).pathname,'/prepare');
 r=await run(route,{...admitted,'User-Agent':'Android'});assert.equal(new URL(r.headers.get('Location')).pathname,'/enter');assert.equal(r.headers.get('Set-Cookie'),null);
 r=await run(route.replace('flow=auto','flow=v2'),{...admitted,'User-Agent':'Android'});assert.equal(r.status,429);assert.equal(r.headers.get('Location'),null);
 r=await run(route,{...admitted,'User-Agent':'Android','Sec-Purpose':'prefetch'});assert.equal(r.status,403);assert.equal(r.headers.get('Location'),null);
 env.DB.fail=true;r=await run(route,{...admitted,'User-Agent':'Android'});assert.equal(r.status,503);assert.equal(r.headers.get('Location'),null);env.DB.fail=false;
 const prior=JSON.stringify([...env.DB.rows]);
 for(const path of [route,route.replace('flow=auto','flow=v2')]){
  for(const referer of [undefined,'https://foreign.invalid/']){
   r=await run(path,{'User-Agent':'iPhone','CF-Connecting-IP':'192.0.2.41',...(referer?{Referer:referer}:{})});
   assert.equal(r.headers.get('Set-Cookie'),null);assert.equal(r.headers.get('Location'),null);assert.ok(!(await r.text()).includes('/prepare?t='));
  }
 }
 assert.equal(JSON.stringify([...env.DB.rows]),prior);
 const day=Math.floor(Date.now()/86400000);env.DB.rows.set(cfg.prefix+'global:'+day,{hits:60,expires_at:(day+1)*86400});
 const before=JSON.stringify([...env.DB.rows]);r=await start(slug);assert.equal(r.status,429);assert.equal(r.headers.get('Location'),null);
 r=await run(route,{...admitted,'User-Agent':'iPhone'});assert.equal(r.status,303);assert.equal(new URL(r.headers.get('Location')).pathname,'/enter');assert.equal(r.headers.get('Set-Cookie'),null);
 assert.equal(JSON.stringify([...env.DB.rows]),before);
}
assert.equal(new Set(cookies).size,3);assert.equal((await verify('prepare-v2','invalid','__proto__')).status,403);
console.log('Three-tool v2 scope, cookies, independent caps, exact destination UA/secret, replay, cross-tool denial and mobile auto-selection, unchanged desktop v1, and start-only cap rollover passed.');
