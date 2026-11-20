import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
const file=new URL('../../worker.js',import.meta.url),source=await fs.readFile(file,'utf8');const code=source.replace(/^(\s*import\s+[^\n]+?\s+from\s+)(['"])(\.\/[^'"\n]+)\2/gm,(_,a,q,b)=>a+JSON.stringify(new URL(b,file).href));const central=(await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))).default;
class DB{rows=new Map();fail=false;prepare(sql){const db=this;return{bind(...args){this.args=args;return this},async run(){if(db.fail)throw Error('fixture unavailable');assert.match(sql,/id LIKE 'toolv2:%'/);let n=0;for(const [k,v]of db.rows)if(k.startsWith('toolv2:')&&v.expires_at<=this.args[0]&&n++<100)db.rows.delete(k);return{success:true}},async first(){if(db.fail)throw Error('fixture unavailable');const a=this.args;if(sql.startsWith('SELECT hits')){const r=db.rows.get(a[0]);return r?{hits:r.hits}:null;}if(sql.startsWith('UPDATE')){const r=db.rows.get(a[1]);if(!r||r.hits!==a[2]||r.expires_at<=a[3])return null;r.hits=a[0];return{id:a[1]};}const r=db.rows.get(a[0]);if(sql.includes('VALUES (?,1,?)')){if(r){if(r.hits>=(sql.includes('hits<60')?60:5))return null;r.hits++;}else db.rows.set(a[0],{hits:1,expires_at:a[1]});}else{if(r)return null;db.rows.set(a[0],{hits:0,expires_at:a[1]});}return{id:a[0]};}}}}


const O='https://todoroki-gold.com',sourceUA='Mozilla/5.0 (iPhone; CPU iPhone OS) source-context-UA',destUA='destination-context-UA';
const env={AUTH_SECRET:'test-local-only'.repeat(6),DB:new DB()};
const configurations={equity:{dir:process.env.SITES_EQ_DIR,host:'todoroki-equity-lab',src:'__Host-todoroki_equity_source',proof:'__Host-todoroki_equity_proof',session:'__Host-todoroki_equity_entry'},jp:{dir:process.env.SITES_JP_DIR,host:'todoroki-economy-data',src:'__Host-todoroki_jp_source',proof:'__Host-todoroki_jp_proof',session:'__Host-todoroki_jp_entry'},us:{dir:process.env.SITES_US_DIR,host:'todoroki-us-economy-data',src:'__Host-todoroki_us_source',proof:'__Host-todoroki_us_proof',session:'__Host-todoroki_us_entry'}};
const originalFetch=globalThis.fetch,originalWarn=console.warn;const logs=[];console.warn=x=>logs.push(x);
globalThis.fetch=async(u,init)=>{assert.equal(u,O+'/api/tools/verify','No real network allowed');return central.fetch(new Request(u,init),env);};
const sourceCall=(url,cookie,method='GET')=>central.fetch(new Request(url,{method,headers:{'User-Agent':sourceUA,Referer:O+'/','CF-Connecting-IP':'192.0.2.1',...(cookie?{Cookie:cookie}:{})}}),env);
const pair=r=>r.headers.get('Set-Cookie').split(';')[0];
try{
for(const [slug,cfg]of Object.entries(configurations)){
 if(!cfg.dir)throw Error('Missing local Sites candidate for '+slug);
 const site=(await import(pathToFileURL(cfg.dir+'/dist/server/index.js'))).default,S='https://'+cfg.host+'.easysquid66.chatgpt.site';
 const dest=(url,cookie,ua=destUA,method='GET')=>site.fetch(new Request(url,{method,headers:{'User-Agent':ua,...(cookie?{Cookie:cookie}:{})}}),{});
 let r=await sourceCall(O+'/api/tools/'+slug+'?flow=auto');assert.equal(r.status,303);const sourceCookie=pair(r),prepareURL=r.headers.get('Location');
 assert.equal((await dest(prepareURL,null,destUA,'HEAD')).status,405);
 assert.equal((await dest(S+'/enter?t='+new URL(prepareURL).searchParams.get('t'))).status,403);
 r=await dest(prepareURL);assert.equal(r.status,303);const proofCookie=pair(r),finishURL=r.headers.get('Location');assert.equal(new URL(finishURL).pathname,'/api/tools/'+slug+'-finish');
 assert.equal((await dest(prepareURL)).status,403);
 const isolated=await sourceCall(finishURL);assert.equal(isolated.status,403,'PWA/Safari isolated source jar must fail safely');assert.equal(isolated.headers.get('Location'),null,'No legacy fallback in a different jar');
 assert.equal((await sourceCall(finishURL,cfg.src+'='+'a'.repeat(64))).status,403);
 r=await sourceCall(finishURL,sourceCookie);assert.equal(r.status,303);const entryURL=r.headers.get('Location');assert.equal(new URL(entryURL).origin,S);
 assert.equal((await sourceCall(finishURL,sourceCookie)).status,403);
 assert.equal((await dest(entryURL)).status,403);
 assert.equal((await dest(entryURL,cfg.proof+'='+'a'.repeat(64))).status,403);
 assert.equal((await dest(entryURL,proofCookie,sourceUA)).status,403);
 r=await dest(entryURL,proofCookie);assert.equal(r.status,303);const sessionCookie=pair(r);assert.ok(sessionCookie.startsWith(cfg.session+'='));
 assert.equal((await dest(entryURL,proofCookie)).status,403);
 r=await dest(S+'/',sessionCookie);assert.equal(r.status,200);assert.match(await r.text(),/TODOROKI/);
 assert.equal((await dest(S+'/',sessionCookie,sourceUA)).status,303);assert.equal((await dest(S+'/')).status,303);
 r=await central.fetch(new Request(O+'/api/tools/'+slug,{headers:{Referer:O+'/','User-Agent':destUA}}),env);assert.equal(r.status,303);r=await dest(r.headers.get('Location'));assert.equal(r.status,303);assert.equal((await dest(S+'/',pair(r))).status,200);
 for(const entry of logs){const text=JSON.stringify(entry);assert.ok(!text.includes(sourceUA)&&!text.includes(destUA)&&!text.includes(sourceCookie)&&!text.includes(proofCookie));}
 console.log(slug+': exact central/Sites local first-tap v2 and unchanged desktop v1 integration passed; different-UA success, isolated-jar denial, proof/replay/unauthenticated protections.');
}
}finally{globalThis.fetch=originalFetch;console.warn=originalWarn;}
