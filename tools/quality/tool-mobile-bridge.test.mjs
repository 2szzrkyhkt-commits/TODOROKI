import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const file=new URL('../../worker.js',import.meta.url),source=await fs.readFile(file,'utf8');
const code=source.replace(/^(\s*import\s+[^\n]+?\s+from\s+)(['"])(\.\/[^'"\n]+)\2/gm,(_,a,q,b)=>a+JSON.stringify(new URL(b,file).href));const w=(await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))).default;
const origin='https://todoroki-gold.com',ua='Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 Version/26.6.1 Mobile/15E148 Safari/604.1',env={AUTH_SECRET:'test-only-secret'.repeat(5)};
const hosts={jp:'todoroki-economy-data',us:'todoroki-us-economy-data',equity:'todoroki-equity-lab'};
async function call(key,method,headers={}){return w.fetch(new Request(origin+'/api/tools/'+key,{method,headers:{'User-Agent':ua,...headers}}),env)}
let count=0;
for(const [key,host] of Object.entries(hosts)){
 for(const [method,headers] of [['GET',{Referer:origin+'/'}],['POST',{Origin:origin,'Sec-Fetch-Site':'same-origin'}]]){
  const r=await call(key,method,headers);assert.equal(r.status,200);assert.equal(r.headers.get('Location'),null);assert.equal(r.headers.get('Set-Cookie'),null);assert.match(r.headers.get('Cache-Control'),/no-store/);assert.equal(r.headers.get('Referrer-Policy'),'no-referrer');assert.match(r.headers.get('Content-Security-Policy'),/default-src 'none'/);
  const html=await r.text();assert.doesNotMatch(html,/<script|<form|<input|http-equiv\s*=|onclick/i);assert.match(html,/60秒/);assert.ok(html.includes('href="/api/tools/'+key+'"'));
  const links=[...html.matchAll(/href="(https:[^"]+)"/g)];assert.equal(links.length,1);const u=new URL(links[0][1]);assert.equal(u.origin,'https://'+host+'.easysquid66.chatgpt.site');assert.equal(u.pathname,'/enter');assert.deepEqual([...u.searchParams.keys()],['t']);
  const token=u.searchParams.get('t');const p=JSON.parse(Buffer.from(token.split('.')[0],'base64url'));assert.equal(p.exp-p.iat,60);assert.equal(p.aud,host);assert.equal(p.kind,'entry');
  for(const [client,status] of [[ua,200],['different client',403]]){const v=await w.fetch(new Request(origin+'/api/tools/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,kind:'entry',aud:host,ua:client})}),env);assert.equal(v.status,status);}
  count++;
 }
 for(const [method,headers] of [['GET',{Referer:'https://foreign.invalid/'}],['GET',{}],['POST',{Origin:'https://foreign.invalid'}],['POST',{Origin:origin,'Sec-Fetch-Site':'cross-site'}]]){const r=await call(key,method,headers);assert.doesNotMatch(await r.text(),/\/enter\?t=/);assert.ok(!r.headers.get('Location')?.includes('/enter?t='));count++;}
 for(const desktop of ['Mozilla/5.0 (Windows NT 10.0) Chrome/156','Mozilla/5.0 (iPad; CPU OS 18_7) Safari/604.1']){const r=await call(key,'GET',{Referer:origin+'/','User-Agent':desktop});assert.equal(r.status,303);assert.equal(new URL(r.headers.get('Location')).hostname,host+'.easysquid66.chatgpt.site');count++;}
}
console.log(count+' mobile bridge cases passed, with unchanged UA-binding positive/negative verification for all three tools.');
