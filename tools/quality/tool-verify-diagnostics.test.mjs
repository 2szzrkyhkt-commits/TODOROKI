import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {createHmac} from 'node:crypto';
const file=new URL('../../worker.js',import.meta.url),source=await fs.readFile(file,'utf8');
const code=source.replace(/^(\s*import\s+[^\n]+?\s+from\s+)(['"])(\.\/[^'"\n]+)\2/gm,(_,a,q,b)=>a+JSON.stringify(new URL(b,file).href));const w=(await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))).default;
const secret='test-only-not-a-production-key'.repeat(3),ua='fixture-client',origin='https://todoroki-gold.com';const env={AUTH_SECRET:secret};const mac=s=>createHmac('sha256',secret).update(s).digest('hex');const now=()=>Math.floor(Date.now()/1000);
const p={aud:'todoroki-equity-lab',kind:'entry',iat:now(),exp:now()+60,fp:mac('tool-fingerprint-v1:'+ua),nonce:'fixture'};
function token(p){const b=Buffer.from(JSON.stringify(p)).toString('base64url');return b+'.'+mac('tool-gate-v1:'+b)}
async function verify(t,expected,expectedStatus=403,extra={}){const r=await w.fetch(new Request(origin+'/api/tools/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:t,kind:'entry',aud:p.aud,ua,...extra})}),env);assert.equal(r.status,expectedStatus);assert.equal(r.headers.get('X-Todoroki-Verify'),'v1');assert.equal(r.headers.get('X-Todoroki-Verify-Result'),expected);const data=await r.json();if(expectedStatus!==200)assert.deepEqual(data,{valid:false});const h=JSON.stringify([...r.headers]);assert.ok(!h.includes(ua)&&!h.includes(p.fp)&&!h.includes(t||'not-used'));return data;}
await verify(token(p),'ok',200);
await verify(token(p),'client_mismatch',403,{ua:'different-fixture'});
await verify(token({...p,exp:now()-1}),'expired');
await verify(token({...p,exp:now()+5000}),'invalid_expiry');
await verify(token({...p,aud:'unknown'}),'invalid_claims');
await verify(token(p),'request_mismatch',403,{aud:'different'});
await verify(token(p),'request_mismatch',403,{kind:'session'});
await verify(token(p),'request_mismatch',403,{ua:'x'.repeat(701)});
await verify('malformed','invalid_ticket');
const expired=token({...p,exp:now()-1});await verify(expired.slice(0,-1)+(expired.endsWith('0')?'1':'0'),'invalid_ticket');
await verify(undefined,'invalid_ticket');
const data=await verify(token(p),'ok',200);await verify(data.session,'ok',200,{kind:'session'});
console.log('13 verification diagnostics cases passed; signed-only detail, unchanged grants, no sensitive header output.');
