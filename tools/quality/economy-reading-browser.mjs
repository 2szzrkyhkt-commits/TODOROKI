import fs from 'node:fs/promises';import path from 'node:path';import http from 'node:http';import assert from 'node:assert/strict';import {chromium} from 'playwright';
const root=process.cwd();await fs.mkdir('quality-results',{recursive:true});
const server=http.createServer(async(req,res)=>{try{let p=new URL(req.url,'http://local').pathname;if(!path.extname(p))p+='.html';const f=path.resolve(root,'.'+p);if(!f.startsWith(root+path.sep))throw Error('outside');res.setHeader('Content-Type',/\.m?js$/.test(p)?'text/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(await fs.readFile(f));}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch(),evidence=[];
try{for(const width of [390,1440]){
 const context=await browser.newContext({viewport:{width,height:900}});await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const slug of ['inflation','interest-rate','government-subsidies']){
  await page.goto(origin+'/'+slug);const section=page.locator('#worked-reading');await section.scrollIntoViewIfNeeded();assert.ok((await section.innerText()).includes('2026年11月17日'));assert.equal(await section.locator('table caption').count(),1);
  const region=section.locator('.table-wrap');await region.focus();await region.press('ArrowRight');assert.equal(await region.evaluate(el=>el===document.activeElement),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
  await page.screenshot({path:`quality-results/economy-reading-${slug}-${width}.png`});
  const target=slug==='inflation'?'interest-rate':'inflation';await section.locator(`a[href="/${target}#worked-reading"]`).click();await page.waitForURL(origin+'/'+target+'#worked-reading');assert.equal(await page.locator('#worked-reading').count(),1);
  evidence.push({slug,width,datedAssumptions:true,keyboardTable:true,reciprocalLink:true,overflow:false,scope:'isolated source, not physical iPhone'});
 }
 assert.deepEqual(errors,[]);await context.close();
}}finally{await fs.writeFile('quality-results/economy-reading.json',JSON.stringify(evidence,null,2));await browser.close();await new Promise(r=>server.close(r));}
console.log('T04 economy reading UI passed: 3 articles at 390/1440px, keyboard tables, reciprocal links and no viewport overflow.');
