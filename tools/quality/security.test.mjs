// Isolated worker contract tests: no live writes, no mail, no production DB.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const code=await fs.readFile('worker.js','utf8');
const worker=(await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))).default;
const origin='https://todoroki-gold.com';
let calls=0;
const db={prepare(sql){return {bind(){return this},async first(){return null},async run(){calls++;return {success:true}}}}};
const env={DB:db,AUTH_SECRET:'x'.repeat(64),RESEND_API_KEY:'fixture-not-a-key',EMAIL_FROM:'fixture@example.invalid',ASSETS:{fetch:async()=>new Response('fixture',{status:200})}};
async function invoke(path,method='GET',headers={},body){return worker.fetch(new Request(origin+path,{method,headers,body}),env);}
let r=await invoke('/api/auth/me');assert.equal(r.status,200);assert.deepEqual(await r.json(),{member:null});
r=await invoke('/api/auth/verify','POST',{'Origin':'https://untrusted.invalid','Content-Type':'application/json'},'{}');assert.equal(r.status,403);assert.equal(calls,0);
r=await invoke('/api/auth/request','GET');assert.equal(r.status,405);assert.equal(calls,0);
r=await invoke('/api/auth/verify','POST',{'Origin':origin,'Content-Type':'text/plain'},'{}');assert.equal(r.status,400);
r=await invoke('/api/auth/logout','POST',{'Origin':origin});assert.equal(r.status,200);const cookies=r.headers.get('set-cookie');for(const flag of ['Secure','HttpOnly','SameSite=Strict','Path=/'])assert.ok(cookies.includes(flag));
r=await invoke('/api/auth/me','GET',{'Cookie':'__Host-todoroki_session=invalid'});assert.deepEqual(await r.json(),{member:null});
const redirects=JSON.parse(await fs.readFile('tools/quality/redirects.json','utf8'));
for(const [path,target] of Object.entries(redirects)){
 r=await invoke(path);assert.equal(r.status,302);assert.equal(r.headers.get('Location'),target);assert.equal(r.headers.get('X-Robots-Tag'),'noindex');
}
const data=Object.fromEntries([53,54,56,59].map(id=>[id,{errors:[],evidence:[{scope:'isolated worker contracts only; live positive login and provider setup require manual verification',cases:6,redirects:8}]}]));
await fs.mkdir('quality-results',{recursive:true});await fs.writeFile('quality-results/security.json',JSON.stringify(data,null,2));
console.log('isolated security: anonymous session, invalid session, method, Origin, body type, cookie flags, eight redirects passed');
