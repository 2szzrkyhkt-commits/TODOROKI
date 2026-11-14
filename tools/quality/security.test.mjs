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

const pdfAlias='/pdf/社会的選好_情報共有_フリーライド_黒金.pdf';
r=await invoke(encodeURI(pdfAlias)+'?download=1');
assert.equal(r.headers.get('Link'),'<'+new URL('/pdf/社会的選好と情報共有_仕事仲間の協力_改訂版.pdf',origin).href+'>; rel="canonical"');
assert.equal(await r.text(),'fixture');
const rangeEnv={...env,ASSETS:{fetch:async()=>new Response('part',{status:206,headers:{'Content-Range':'bytes 0-3/100','Content-Type':'application/pdf'}})}};
r=await worker.fetch(new Request(origin+encodeURI(pdfAlias),{headers:{Range:'bytes=0-3'}}),rangeEnv);
assert.equal(r.status,206);assert.equal(r.headers.get('Content-Range'),'bytes 0-3/100');assert.ok(r.headers.has('Link'));
r=await worker.fetch(new Request(origin+encodeURI(pdfAlias)),{...env,ASSETS:{fetch:async()=>new Response('missing',{status:404})}});assert.equal(r.headers.has('Link'),false);
r=await invoke('/pdf/another.pdf');assert.equal(r.headers.has('Link'),false);
console.log('PDF canonical: Unicode alias, query, bytes, range, missing and unrelated assets passed');

const pdfFiles=await fs.readdir('pdf');
for(const [alias,target] of [
 ['Amazon輸入ビジネス_価格差と相乗り販売_修正版.pdf','Amazon輸入ビジネス_価格差と相乗り販売.pdf'],
 ['社会的選好_情報共有_フリーライド_黒金.pdf','社会的選好と情報共有_仕事仲間の協力_改訂版.pdf'],
 ['社会的選好と情報共有_仕事仲間の協力.pdf','社会的選好と情報共有_仕事仲間の協力_改訂版.pdf']]){
 const a=pdfFiles.find(n=>n.normalize('NFC')===alias);assert.ok(a);
 assert.deepEqual(await fs.readFile('pdf/'+a),await fs.readFile('pdf/'+target));
}
console.log('PDF canonical alias/target byte equality: 3 pairs passed');

for(const path of ['/pdf/M&Aと資本配分_企業価値を高める再編の見方.pdf','/pdf/日本企業_M&A産業再編_黒金4P.pdf']){
 r=await invoke(encodeURI(path));assert.equal(r.headers.get('Link'),'<'+new URL(path,origin).href+'>; rel="canonical"');
}
console.log('Distinct M&A PDFs retain individual canonical targets: 2 passed');
