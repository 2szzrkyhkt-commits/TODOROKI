import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const p=new URL('../../worker.js',import.meta.url);
async function load(src){src=src.replace(/^(\s*import\s+[^\n]+?\s+from\s+)(['"])(\.\/[^'"\n]+)\2/gm,(_,a,q,b)=>a+JSON.stringify(new URL(b,p).href));return(await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'))).default}
const fixed=await load(await fs.readFile(p,'utf8')); const origin='https://todoroki-gold.com',env={AUTH_SECRET:'fixture-only'.repeat(6)};
const call=(w,key,method,headers)=>w.fetch(new Request(origin+'/api/tools/'+key,{method,headers}),env);let n=0;
for(const key of ['jp','us','equity']) for(const headers of [{'Referer':'https://www.todoroki-gold.com/'},{'Referer':origin+'/','Sec-Fetch-Site':'same-site'},{'Referer':'https://example.invalid/','Sec-Fetch-Site':'cross-site'},{'Referer':'not a url'}]){
 const r=await call(fixed,key,'GET',headers);assert.equal(r.status,200);assert.equal(r.headers.get('location'),null);const html=await r.text();assert.match(html,/<form method="post">/);assert.doesNotMatch(html,/enter\?t=|<script/i);n++;
}
for(const key of ['jp','us','equity']){
 for(const h of [{'Referer':origin+'/'},{'Sec-Fetch-Site':'same-origin'},{'Referer':origin+'/app/','Sec-Fetch-Site':'same-origin'}]){const r=await call(fixed,key,'GET',h);assert.equal(r.status,303);assert.match(r.headers.get('location'),/\/enter\?t=/);n++;}
 let r=await call(fixed,key,'GET',{});assert.equal(r.status,200);n++;
 r=await call(fixed,key,'POST',{'Origin':origin,'Sec-Fetch-Site':'same-origin'});assert.equal(r.status,303);assert.match(r.headers.get('location'),/\/enter\?t=/);n++;
 for(const h of [{},{'Origin':'https://example.invalid'},{'Origin':origin,'Sec-Fetch-Site':'cross-site'}]){r=await call(fixed,key,'POST',h);assert.equal(r.headers.get('location'),origin+'/#company-analysis');n++;}
}
console.log(n+' tool-entry regression cases passed.');

const alternate='https://todoroki.8njb5bzfbz.workers.dev';
for(const key of ['jp','us','equity']){
 const path='/api/tools/'+key;
 let r=await fixed.fetch(new Request(alternate+path+'?ignored=1'),env);
 assert.equal(r.status,303);assert.equal(r.headers.get('location'),origin+path);
 r=await fixed.fetch(new Request(alternate+path,{method:'POST',headers:{Origin:alternate}}),env);assert.equal(r.status,403);
 r=await fixed.fetch(new Request('https://unknown.invalid'+path),env);assert.equal(r.status,403);
}
for(const path of ['/api/tools/verify','/api/tools/unknown','/api/auth/me']){
 const r=await fixed.fetch(new Request(alternate+path),env);assert.equal(r.status,403);
}
let r=await fixed.fetch(new Request(alternate+'/'),{...env,ASSETS:{fetch:()=>new Response('unchanged homepage')}});
assert.equal(r.status,200);assert.equal(await r.text(),'unchanged homepage');
console.log('13 alternate-origin regression cases passed (canonical GET recovery; POST/verify/unknown blocked; homepage unchanged).');
