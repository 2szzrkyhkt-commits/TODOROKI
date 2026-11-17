import assert from 'node:assert/strict';import http from 'node:http';import fs from 'node:fs/promises';import {chromium} from 'playwright';import {imageInspector} from './image-probe.mjs';
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="32" height="20"><rect width="32" height="20" fill="gold"/></svg>';
const server=http.createServer((req,res)=>{
 if(req.url==='/'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><style>#hidden{display:none}#lazy{margin-top:7000px}</style><img id="hidden" loading="lazy" src="/hidden.svg" width="32" height="20"><img id="lazy" loading="lazy" src="/valid.svg" width="32" height="20"><img src="/missing.svg" width="32" height="20"><img src="/invalid.svg" width="32" height="20"><img src="/forbidden.svg" width="32" height="20"><img id="slow" loading="lazy" src="/slow.svg" width="32" height="20">')}
 if(req.url==='/missing.svg'||req.url==='/hidden.svg'){res.writeHead(404);return res.end('missing')}
 if(req.url==='/forbidden.svg'){res.writeHead(403);return res.end('blocked')}
 res.setHeader('Content-Type','image/svg+xml');
 if(req.url==='/slow.svg'){setTimeout(()=>{if(!res.destroyed)res.end(svg)},4000);return}
 res.end(req.url==='/invalid.svg'?'not an SVG':svg);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch(),evidence=[];
try{for(const width of [390,1440]){
 const context=await browser.newContext({viewport:{width,height:900}});await context.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
 const page=await context.newPage(),inspect=imageInspector(page,{timeoutMs:1000,budgetMs:5000});await page.goto(origin,{waitUntil:'domcontentloaded'});
 const initial=await page.locator('#lazy').evaluate(e=>({complete:e.complete,width:e.naturalWidth}));assert.equal(initial.complete,false);assert.equal(initial.width,0);
 const result=await inspect();assert.equal(result.excludedHidden,1);
 assert.ok(result.ready.some(x=>x.src==='/valid.svg'||x.src===origin+'/valid.svg'));
 assert.deepEqual(result.broken.map(x=>x.src.replace(origin,'')).sort(),['/invalid.svg','/missing.svg']);
 assert.ok(result.unverified.some(x=>x.src?.endsWith('/forbidden.svg')));assert.ok(result.unverified.some(x=>x.src?.endsWith('/slow.svg')));
 assert.equal(await page.locator('#hidden').evaluate(e=>getComputedStyle(e).display),'none');assert.equal(await page.evaluate(()=>scrollY),0);
 evidence.push({width,...result});await context.close();
}}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r))}
await fs.mkdir('quality-results',{recursive:true});await fs.writeFile('quality-results/image-probe-fixtures.json',JSON.stringify(evidence,null,2));
console.log('TQ43 image probe: hidden/lazy, 200 decode failure, 404, 403, timeout and scroll restoration passed at 390/1440px');
