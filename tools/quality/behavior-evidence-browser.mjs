import fs from 'node:fs/promises';import path from 'node:path';import http from 'node:http';import assert from 'node:assert/strict';import {chromium} from 'playwright';
const root=process.cwd();const server=http.createServer(async(req,res)=>{try{let p=new URL(req.url,'http://local').pathname;if(!path.extname(p))p+='.html';const f=path.resolve(root,'.'+p);if(!f.startsWith(root+path.sep))throw Error('outside');res.setHeader('Content-Type',/\.m?js$/.test(p)?'text/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(await fs.readFile(f));}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch(),evidence=[];
try{for(const width of [390,1440]){
 const context=await browser.newContext({viewport:{width,height:900}});await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const slug of ['consumer-protection-solutions','discounted-utility','social-preferences']){
  await page.goto(origin+'/'+slug);const section=page.locator('#evidence-reading');assert.equal(await section.count(),1);assert.ok((await section.innerText()).includes('2026年11月17日'));assert.ok(await section.locator('a[href^="https:"]').count());
  if(slug!=='consumer-protection-solutions'){const region=section.locator('.table-scroll');await region.focus();await region.press('ArrowRight');assert.equal(await region.evaluate(e=>e===document.activeElement),true);assert.equal(await region.locator('caption').count(),1);}
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
  const target=slug==='discounted-utility'?'social-preferences':'discounted-utility';await section.locator(`a[href="/${target}#evidence-reading"]`).press('Enter');await page.waitForURL(origin+'/'+target+'#evidence-reading');assert.equal(await page.locator('#evidence-reading').count(),1);
  evidence.push({slug,width,datedSource:true,hypotheticalScope:true,keyboardTable:slug!=='consumer-protection-solutions',readingLink:true,overflow:false,scope:'isolated source; not physical iPhone'});
 }
 assert.deepEqual(errors,[]);await context.close();
}}finally{await fs.mkdir('quality-results',{recursive:true});await fs.writeFile('quality-results/behavior-evidence.json',JSON.stringify(evidence,null,2));await browser.close();await new Promise(r=>server.close(r));}
console.log('T04 behavioral evidence UI passed: 3 pages at 390/1440px, dated sources, keyboard tables, reading links and no overflow.');
