import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const slugs=['rsi-basics','atr-basics','vwap-basics'],root=process.cwd();
await fs.mkdir('quality-results',{recursive:true});
const server=http.createServer(async(req,res)=>{try{
 let p=new URL(req.url,'http://local').pathname;if(!path.extname(p))p+='.html';
 const file=path.resolve(root,'.'+p);if(!file.startsWith(root+path.sep))throw Error('outside');
 res.setHeader('Content-Type',/\.m?js$/.test(p)?'text/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(await fs.readFile(file));
}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch(),evidence=[];
try{for(const width of [390,1440]){
 const context=await browser.newContext({viewport:{width,height:900}});
 await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const [i,slug] of slugs.entries()){
  await page.goto(origin+'/'+slug+'#worked-reading');
  const section=page.locator('#worked-reading'),region=section.locator('.table-scroll');
  assert.equal(await section.count(),1);assert.ok((await section.innerText()).includes('2026年11月17日'));
  assert.equal(await section.locator('tbody tr').count(),[2,4,3][i]);
  assert.equal(await section.locator('caption').count(),1);assert.ok(await section.locator('a[href^="https://www.tradingview.com/"]').count());
  await region.focus();await region.press('ArrowRight');assert.equal(await region.evaluate(e=>e===document.activeElement),true);
  const geometry=await region.evaluate(e=>({scroll:e.scrollWidth>e.clientWidth,client:e.clientWidth}));
  if(width===390)assert.ok(geometry.scroll);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
  await section.screenshot({path:`quality-results/indicator-${slug}-${width}.png`});
  const next=slugs[(i+1)%slugs.length];await section.locator(`a[href="/${next}#worked-reading"]`).press('Enter');
  await page.waitForURL(origin+'/'+next+'#worked-reading');assert.equal(await page.locator('#worked-reading').count(),1);
  evidence.push({slug,width,datedSources:true,keyboardTable:true,bodyOverflow:false,linkedCalculation:true,scope:'isolated source; not physical iPhone'});
 }
 assert.deepEqual(errors,[]);await context.close();
}}finally{await fs.mkdir('quality-results',{recursive:true});await fs.writeFile('quality-results/indicator-examples.json',JSON.stringify(evidence,null,2));await browser.close();await new Promise(r=>server.close(r));}
console.log('T04 indicator examples: all 3 pages at 390/1440px passed.');
