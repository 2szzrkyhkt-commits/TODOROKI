import fs from 'node:fs/promises';import path from 'node:path';import http from 'node:http';import assert from 'node:assert/strict';import {chromium} from 'playwright';
const root=process.cwd();await fs.mkdir('quality-results',{recursive:true});
const server=http.createServer(async(req,res)=>{try{let p=new URL(req.url,'http://local').pathname;if(!path.extname(p))p+='.html';const file=path.resolve(root,'.'+p);if(!file.startsWith(root+path.sep))throw Error('outside');res.setHeader('Content-Type',/\.m?js$/.test(p)?'text/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(await fs.readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch(),evidence=[];
try{for(const width of [390,1440]){
 const context=await browser.newContext({viewport:{width,height:900}});await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/donchian-channels#worked-reading');const section=page.locator('#worked-reading');assert.ok((await section.innerText()).includes('2026年11月17日'));
 for(let i=0;i<2;i++){const region=section.locator('.table-scroll').nth(i);assert.equal(await region.locator('tbody tr').count(),[5,3][i]);assert.equal(await region.locator('caption').count(),1);await region.focus();await region.press('ArrowRight');assert.equal(await region.evaluate(e=>e===document.activeElement),true);if(width===390)assert.ok(await region.evaluate(e=>e.scrollWidth>e.clientWidth));}
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);await section.screenshot({path:`quality-results/donchian-${width}.png`});
 for(const target of ['/envelope-basics','/pivot-points']){await section.locator(`a[href="${target}"]`).press('Enter');await page.waitForURL(origin+target);assert.equal(await page.locator('h1').count(),1);await page.goto(origin+'/donchian-channels#worked-reading');}
 assert.deepEqual(errors,[]);evidence.push({width,tables:2,keyboard:true,readingLinks:2,bodyOverflow:false,scope:'isolated source, not physical iPhone'});await context.close();
}}finally{await fs.writeFile('quality-results/donchian-examples.json',JSON.stringify(evidence,null,2));await browser.close();await new Promise(r=>server.close(r));}
console.log('T04 Donchian examples: 390/1440px tables and navigation passed.');
