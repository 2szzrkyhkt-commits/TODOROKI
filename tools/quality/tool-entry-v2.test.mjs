import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const file=new URL('../../worker.js',import.meta.url),source=await fs.readFile(file,'utf8');const code=source.replace(/^(\s*import\s+[^\n]+?\s+from\s+)(['"])(\.\/[^'"\n]+)\2/gm,(_,a,q,b)=>a+JSON.stringify(new URL(b,file).href));const w=(await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))).default;
const O='https://todoroki-gold.com',S='https://todoroki-equity-lab.easysquid66.chatgpt.site',AUD='todoroki-equity-lab',SRC='__Host-todoroki_equity_source',ua='destination-test-UA',destProof=createHash('sha256').update('b'.repeat(64)).digest('hex');
class DB{rows=new Map();fail=false;prepare(sql){const db=this;return{bind(...args){this.args=args;return this},async run(){if(db.fail)throw Error('fixture unavailable');assert.match(sql,/id LIKE 'toolv2:%'/);let n=0;for(const [k,v]of db.rows)if(k.startsWith('toolv2:')&&v.expires_at<=this.args[0]&&n++<100)db.rows.delete(k);return{success:true}},async first(){if(db.fail)throw Error('fixture unavailable');const a=this.args;if(sql.startsWith('SELECT hits')){const r=db.rows.get(a[0]);return r?{hits:r.hits}:null;}if(sql.startsWith('UPDATE')){const r=db.rows.get(a[1]);if(!r||r.hits!==a[2]||r.expires_at<=a[3])return null;r.hits=a[0];return{id:a[1]};}const r=db.rows.get(a[0]);if(sql.includes('VALUES (?,1,?)')){if(r){if(r.hits>=(sql.includes('hits<60')?60:5))return null;r.hits++;}else db.rows.set(a[0],{hits:1,expires_at:a[1]});}else{if(r)return null;db.rows.set(a[0],{hits:0,expires_at:a[1]});}return{id:a[0]};}}}}
const env={AUTH_SECRET:'test-secret'.repeat(8),DB:new DB()};let ip=0;
const call=(path,headers={},method='GET',data)=>w.fetch(new Request(O+path,{method,headers,body:data===undefined?undefined:JSON.stringify(data)}),env);
const verify=(kind,token,extra={})=>call('/api/tools/verify',{'Content-Type':'application/json'},'POST',{kind,token,aud:AUD,ua,destProof,destSecret:'b'.repeat(64),...extra});
async function start(flow='v2',ua='different-source-UA'){const r=await call('/api/tools/equity?flow='+flow,{'Referer':O+'/','CF-Connecting-IP':'192.0.2.'+(++ip),'User-Agent':ua});assert.equal(r.status,303);const u=new URL(r.headers.get('Location'));assert.equal(u.origin,S);assert.equal(u.pathname,'/prepare');const cookie=r.headers.get('Set-Cookie');for(const f of ['HttpOnly','Secure','SameSite=Lax','Path=/','Max-Age=120'])assert.ok(cookie.includes(f));assert.ok(!cookie.includes('Domain='));return{intent:u.searchParams.get('t'),cookie:cookie.split(';')[0]};}
async function prepare(x){const r=await verify('prepare-v2',x.intent);assert.equal(r.status,200);return{...x,prepared:(await r.json()).prepared};}
async function finish(x){const r=await call('/api/tools/equity-finish?t='+x.prepared,{Cookie:x.cookie});assert.equal(r.status,303);const u=new URL(r.headers.get('Location'));assert.equal(u.origin,S);assert.equal(u.pathname,'/enter');assert.match(r.headers.get('Set-Cookie'),/Max-Age=0/);return{...x,entry:u.searchParams.get('t')};}
for(const purpose of ['Sec-Purpose','Purpose']){const before=env.DB.rows.size;const r=await call('/api/tools/equity?flow=v2',{'Referer':O+'/','CF-Connecting-IP':'192.0.2.250',[purpose]:'prefetch'});assert.equal(r.status,403);assert.equal(r.headers.get('Set-Cookie'),null);assert.equal(env.DB.rows.size,before);}
const iphone='Mozilla/5.0 (iPhone; CPU iPhone OS 18_5) AppleWebKit/605.1.15 Version/18.5 Mobile Safari/604.1';
const android='Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36';
const entryRoute='/api/tools/equity', automatic=entryRoute+'?flow=auto';
const admitted={'Referer':O+'/','CF-Connecting-IP':'192.0.2.170','User-Agent':iphone};
function legacy(r, origin=S){
 assert.equal(r.status,303);const target=new URL(r.headers.get('Location'));
 assert.equal(target.origin,origin);assert.equal(target.pathname,'/enter');assert.equal(r.headers.get('Set-Cookie'),null);
}
for(const ua of ['', 'Windows Chrome', 'Fixture UA']) legacy(await call(entryRoute,{...admitted,'User-Agent':ua}));


const beforeAuto=env.DB.rows.size;
for(const headers of [{'User-Agent':iphone},{...admitted,Referer:'https://foreign.invalid/'},{...admitted,'Sec-Fetch-Site':'cross-site'}]){
 const denied=await call(automatic,headers);assert.equal(denied.status,200);assert.equal(denied.headers.get('Location'),null);assert.equal(denied.headers.get('Set-Cookie'),null);
}
const badPost=await call(automatic,{...admitted,Origin:'https://foreign.invalid'},'POST');
assert.equal(badPost.headers.get('Location'),O+'/#company-analysis');assert.equal(badPost.headers.get('Set-Cookie'),null);
const prefetched=await call(automatic,{...admitted,'Sec-Purpose':'prefetch'});
assert.equal(prefetched.status,403);assert.equal(prefetched.headers.get('Location'),null);assert.equal(prefetched.headers.get('Set-Cookie'),null);
assert.equal(env.DB.rows.size,beforeAuto);
await start('auto',android);
const x=await start('auto',iphone);assert.equal((await verify('entry-v2',x.intent)).status,403);const y=await prepare(x);assert.equal((await verify('prepare-v2',x.intent)).status,403);
const split=await call('/api/tools/equity-finish?t='+y.prepared);assert.equal(split.status,403);assert.equal(split.headers.get('Location'),null,'lost proof may not trigger legacy entry');
assert.equal((await call('/api/tools/equity-finish?t='+y.prepared,{Cookie:SRC+'='+'a'.repeat(64)})).status,403);
assert.equal((await call('/api/tools/equity-finish?t='+y.prepared,{Cookie:y.cookie+'; '+y.cookie})).status,403);
assert.equal((await call('/api/tools/equity-finish?t='+y.prepared,{Cookie:y.cookie},'POST')).status,405);
const z=await finish(y);assert.equal((await call('/api/tools/equity-finish?t='+y.prepared,{Cookie:y.cookie})).status,403);
assert.equal((await verify('entry-v2',z.entry,{ua:'wrong-UA'})).status,403);assert.equal((await verify('entry-v2',z.entry,{destSecret:'c'.repeat(64)})).status,403);
assert.equal((await verify('entry-v2',z.entry,{destSecret:destProof})).status,403,'public digest cannot substitute for secret');
assert.equal((await verify('entry-v2',z.entry,{destSecret:undefined})).status,403,'digest alone cannot grant');
const parallel=await Promise.all([verify('entry-v2',z.entry),verify('entry-v2',z.entry)]);assert.deepEqual(parallel.map(r=>r.status).sort(),[200,403]);const session=(await parallel.find(r=>r.status===200).json()).session;
assert.equal((await verify('session',session)).status,200);assert.equal((await verify('session',session,{ua:'different'})).status,403);
assert.equal((await verify('entry-v2',z.entry)).status,403);
assert.equal((await verify('prepare-v2',x.intent,{aud:'todoroki-us-equity-lab'})).status,403);
const malformed=x.intent.slice(0,-1)+(x.intent.endsWith('0')?'1':'0');assert.equal((await verify('prepare-v2',malformed)).status,403);
let r=await call('/api/tools/equity?flow=v2',{'Referer':'https://foreign.invalid','CF-Connecting-IP':'192.0.2.100'});assert.equal(r.status,200);assert.equal(r.headers.get('Set-Cookie'),null);
r=await call('/api/tools/equity?flow=v2',{'Origin':'https://foreign.invalid','CF-Connecting-IP':'192.0.2.100'},'POST');assert.equal(r.status,303);assert.equal(r.headers.get('Set-Cookie'),null);
r=await call('/api/tools/equity?flow=v2',{'Referer':O+'/'});assert.equal(r.status,503);
env.DB.rows.set('login:fixture',{hits:1,expires_at:0});await start();assert.ok(env.DB.rows.has('login:fixture'));
for(let i=0;i<6;i++){r=await call('/api/tools/equity?flow=v2',{'Referer':O+'/','CF-Connecting-IP':'192.0.2.200'});assert.equal(r.status,i<5?303:429);}
const expired=await start();for(const[k,v]of env.DB.rows)if(k.startsWith('toolv2:intent:'))v.expires_at=0;assert.equal((await verify('prepare-v2',expired.intent)).status,403);
const day=Math.floor(Date.now()/86400000);env.DB.rows.set('toolv2:global:'+day,{hits:60,expires_at:(day+1)*86400});const beforeCap=JSON.stringify([...env.DB.rows]);r=await call('/api/tools/equity?flow=v2',{'Referer':O+'/','CF-Connecting-IP':'192.0.2.202'});assert.equal(r.status,429);assert.equal(JSON.stringify([...env.DB.rows]),beforeCap,'exhausted pilot must not mutate any rows');
legacy(await call(automatic,admitted));assert.equal(JSON.stringify([...env.DB.rows]),beforeCap);
env.DB.fail=true;r=await call('/api/tools/equity?flow=v2',{'Referer':O+'/','CF-Connecting-IP':'192.0.2.201'});assert.equal(r.status,503);assert.equal(r.headers.get('Set-Cookie'),null);
legacy(await call(automatic,admitted));
console.log('V2 local synthetic protocol tests passed: source proof, destination proof, UA binding, atomic one-use, scope, expiry, rate cap, no login-row cleanup, DB fail-closed.');
