import fs from 'node:fs/promises';import path from 'node:path';import http from 'node:http';import assert from 'node:assert/strict';import {chromium} from 'playwright';
const root=process.cwd();await fs.mkdir('quality-results',{recursive:true});
const server=http.createServer(async(req,res)=>{try{let p=new URL(req.url,'http://local').pathname;if(!path.extname(p))p+='.html';const file=path.resolve(root,'.'+p);if(!file.startsWith(root+path.sep))throw Error('outside');res.setHeader('Content-Type',/\.m?js$/.test(p)?'text/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(await fs.readFile(file));}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch(),evidence=[];
try{for(const width of [390,1440]){
 const context=await browser.newContext({viewport:{width,height:900}});await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/gasoline-subsidy-outlook-2026');
 const update=await page.locator('#as-of-update').innerText();for(const text of ['169.9円/L','36.7円/L','11月9日調査','11月12日〜18日','現在の残高は今回未確認'])assert.ok(update.includes(text));
 assert.equal(await page.locator('#as-of-update table th[scope="row"]').count(),2);
 const region=page.locator('#as-of-update .table-wrap');await region.press('ArrowRight');assert.ok(await region.getAttribute('aria-label'));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
 const dates=await page.locator('#reading-dates').innerText();assert.ok(dates.includes('169.9＋51.9−15.1−170.0＝36.7'));assert.ok(dates.includes('翌日の実売価格を保証する数字ではありません'));
 await page.screenshot({path:`quality-results/gasoline-dates-${width}.png`,fullPage:true});assert.deepEqual(errors,[]);
 evidence.push({width,datedValues:true,periodMismatchExplained:true,historicalScope:true,keyboardRegion:true,overflow:false,scope:'isolated actual source; not physical iPhone'});await context.close();
}}finally{await fs.writeFile('quality-results/gasoline-dates.json',JSON.stringify(evidence,null,2));await browser.close();await new Promise(r=>server.close(r));}
console.log('T04 gasoline dates UI passed: 390/1440px, dated values, historical scope, table keyboard access and no viewport overflow.');
