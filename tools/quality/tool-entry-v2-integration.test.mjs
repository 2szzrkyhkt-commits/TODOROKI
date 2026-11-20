import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
const file=new URL('../../worker.js',import.meta.url),source=await fs.readFile(file,'utf8');const code=source.replace(/^(\s*import\s+[^\n]+?\s+from\s+)(['"])(\.\/[^'"\n]+)\2/gm,(_,a,q,b)=>a+JSON.stringify(new URL(b,file).href));const central=(await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))).default;
if(!process.env.SITES_V2_DIR)throw Error('Set SITES_V2_DIR to the reviewed local Sites candidate');
const site=(await import(pathToFileURL(process.env.SITES_V2_DIR+'/dist/server/index.js'))).default;
class DB{rows=new Map();fail=false;prepare(sql){const db=this;return{bind(...args){this.args=args;return this},async run(){if(db.fail)throw Error('fixture unavailable');assert.match(sql,/id LIKE 'toolv2:%'/);let n=0;for(const [k,v]of db.rows)if(k.startsWith('toolv2:')&&v.expires_at<=this.args[0]&&n++<100)db.rows.delete(k);return{success:true}},async first(){if(db.fail)throw Error('fixture unavailable');const a=this.args;if(sql.startsWith('SELECT hits')){const r=db.rows.get(a[0]);return r?{hits:r.hits}:null;}if(sql.startsWith('UPDATE')){const r=db.rows.get(a[1]);if(!r||r.hits!==a[2]||r.expires_at<=a[3])return null;r.hits=a[0];return{id:a[1]};}const r=db.rows.get(a[0]);if(sql.includes('VALUES (?,1,?)')){if(r){if(r.hits>=(sql.includes('hits<60')?60:5))return null;r.hits++;}else db.rows.set(a[0],{hits:1,expires_at:a[1]});}else{if(r)return null;db.rows.set(a[0],{hits:0,expires_at:a[1]});}return{id:a[0]};}}}}

const O='https://todoroki-gold.com',S='https://todoroki-equity-lab.easysquid66.chatgpt.site',sourceUA='source-context-UA',destUA='destination-context-UA';
const env={AUTH_SECRET:'test-local-only'.repeat(6),DB:new DB()};
const originalFetch=globalThis.fetch,originalWarn=console.warn;const logs=[];console.warn=x=>logs.push(x);
globalThis.fetch=async(u,init)=>{assert.equal(u,O+'/api/tools/verify','No real network allowed');return central.fetch(new Request(u,init),env);};
const sourceCall=(url,cookie,method='GET')=>central.fetch(new Request(url,{method,headers:{'User-Agent':sourceUA,Referer:O+'/','CF-Connecting-IP':'192.0.2.1',...(cookie?{Cookie:cookie}:{})}}),env);
const destinationCall=(url,cookie,ua=destUA,method='GET')=>site.fetch(new Request(url,{method,headers:{'User-Agent':ua,...(cookie?{Cookie:cookie}:{})}}),{});
const pair=r=>r.headers.get('Set-Cookie').split(';')[0];
try{
 let r=await sourceCall(O+'/api/tools/equity?flow=v2');assert.equal(r.status,303);const sourceCookie=pair(r),prepareURL=r.headers.get('Location');
 assert.equal((await destinationCall(prepareURL,null,destUA,'HEAD')).status,405);
 assert.equal((await destinationCall(S+'/enter?t='+new URL(prepareURL).searchParams.get('t'))).status,403,'intent alone must not grant');
 r=await destinationCall(prepareURL);assert.equal(r.status,303);const proofCookie=pair(r),finishURL=r.headers.get('Location');
 assert.equal((await destinationCall(prepareURL)).status,403,'prepare replay denied');
 assert.equal((await sourceCall(finishURL)).status,403,'wrong or missing source jar denied');
 assert.equal((await sourceCall(finishURL,'__Host-todoroki_equity_source='+'a'.repeat(64))).status,403);
 r=await sourceCall(finishURL,sourceCookie);assert.equal(r.status,303);const entryURL=r.headers.get('Location');
 assert.equal((await sourceCall(finishURL,sourceCookie)).status,403,'finish replay denied');
 assert.equal((await destinationCall(entryURL)).status,403,'missing destination proof denied');
 assert.equal((await destinationCall(entryURL,'__Host-todoroki_equity_proof='+'a'.repeat(64))).status,403);
 assert.equal((await destinationCall(entryURL,proofCookie,sourceUA)).status,403,'destination UA must match exactly');
 r=await destinationCall(entryURL,proofCookie);assert.equal(r.status,303);assert.equal(r.headers.get('Location'),'/');const sessionCookie=pair(r);assert.ok(sessionCookie.startsWith('__Host-todoroki_equity_entry='));
 assert.equal((await destinationCall(entryURL,proofCookie)).status,403,'entry replay denied');
 r=await destinationCall(S+'/',sessionCookie);assert.equal(r.status,200);assert.match(await r.text(),/TODOROKI/);
 assert.equal((await destinationCall(S+'/',sessionCookie,sourceUA)).status,303,'session UA binding retained');
 for(const path of ['/','/api/companies','/evidence/7974.json'])assert.equal((await destinationCall(S+path)).status,303,'unauthenticated data still gated');
 // Existing desktop v1 still works end-to-end with matching UA.
 r=await central.fetch(new Request(O+'/api/tools/equity',{headers:{Referer:O+'/','User-Agent':destUA}}),env);assert.equal(r.status,303);
 r=await destinationCall(r.headers.get('Location'));assert.equal(r.status,303);assert.equal((await destinationCall(S+'/',pair(r))).status,200);
 for(const entry of logs){const text=JSON.stringify(entry);assert.ok(!text.includes(sourceUA)&&!text.includes(destUA)&&!text.includes(sourceCookie)&&!text.includes(proofCookie));}
 console.log('Exact two-worker local integration passed: differing source/destination UA, proof cookies, three atomic one-use steps, protected data, v1 compatibility; no live requests.');
}finally{globalThis.fetch=originalFetch;console.warn=originalWarn;}
