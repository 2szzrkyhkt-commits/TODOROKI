// Real homepage source: image loading, card navigation and ticker controls.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {chromium} from 'playwright';
const root=process.cwd(),html=await fs.readFile(process.env.HOME_TEST_SOURCE||'index.html','utf8');
const server=createServer(async(req,res)=>{const p=new URL(req.url,'http://localhost').pathname;if(p==='/api/privacy/region'){res.setHeader('Content-Type','application/json');return res.end('{"optionalAllowed":false}');}if(p==='/'){res.setHeader('Content-Type','text/html');return res.end(html);}if(!p.startsWith('/assets/')||!path.resolve(root,'.'+p).startsWith(root+path.sep)){res.statusCode=404;return res.end();}try{res.setHeader('Content-Type',p.endsWith('.svg')?'image/svg+xml':p.endsWith('.js')?'application/javascript':p.endsWith('.css')?'text/css':'application/octet-stream');res.end(await fs.readFile('.'+p));}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch(),evidence=[];
try{for(const width of [390,1440]){const context=await browser.newContext({viewport:{width,height:900}});await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);
const cards=page.locator('#latest-articles .card-link:visible');assert.equal(await cards.count(),6);
for(const card of await cards.all()){await card.scrollIntoViewIfNeeded();const img=card.locator('img.article-thumbnail');assert.equal(await img.count(),1);await img.evaluate(e=>e.decode());assert.ok(await img.evaluate(e=>e.naturalWidth===640&&e.naturalHeight===360));assert.ok((await card.locator('h3').innerText()).length>8);const href=await card.getAttribute('href');assert.ok(href.startsWith('/'));await fs.access(href.slice(1)+'.html');}
await page.goto(origin);const track=page.locator('.news-ticker-track');const transform=()=>track.evaluate(e=>getComputedStyle(e).transform);
const a=await transform();await page.waitForTimeout(350);const b=await transform();assert.notEqual(a,b);
await page.getByRole('button',{name:'テロップを一時停止',exact:true}).press('Enter');const stopped=await transform();await page.waitForTimeout(350);assert.equal(await transform(),stopped);
await page.getByRole('button',{name:'テロップを再生',exact:true}).press('Enter');await page.waitForTimeout(350);assert.notEqual(await transform(),stopped);
assert.equal(await page.locator('.news-ticker-group').count(),2);assert.equal(await page.locator('.news-ticker-group[aria-hidden="true"] a:not([tabindex="-1"])').count(),0);
assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
await page.locator('#latest-articles').screenshot({path:`quality-results/home-cards-${width}.png`});evidence.push({width,cards:6,images_loaded:6,links_exist:6,ticker_moves:true,pause_resume:true,errors});await context.close();}}finally{await browser.close();server.close();}
await fs.writeFile('quality-results/home-cards.json',JSON.stringify(evidence,null,2));console.log('homepage 390/1440: 12 cards/images/links, ticker movement/pause/resume, no JS errors or viewport overflow passed');
