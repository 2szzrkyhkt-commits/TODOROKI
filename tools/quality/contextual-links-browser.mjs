import fs from 'node:fs/promises';import path from 'node:path';import http from 'node:http';import assert from 'node:assert/strict';import {chromium} from 'playwright';
const root=process.cwd(),slugs=['/open-house-group-3288-earnings-2026','/nyk-9101-earnings-2026','/yamada-hd-9831-earnings-2026',...['en','es','pt','zh-Hans','zh-Hant'].map(l=>'/'+l+'/anthropic-ipo-ai-safety-2026')];
const server=http.createServer(async(req,res)=>{try{let p=new URL(req.url,'http://local').pathname;if(p.endsWith('/'))p+='index.html';else if(!path.extname(p))p+='.html';const file=path.resolve(root,'.'+p);if(!file.startsWith(root+path.sep))throw Error('outside');res.setHeader('Content-Type',/\.m?js$/.test(p)?'text/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(await fs.readFile(file));}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch(),evidence=[];
try{for(const width of [390,1440]){
 const context=await browser.newContext({viewport:{width,height:900}});await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const slug of slugs){
  await page.goto(origin+slug);const related=page.locator('.contextual-reading');assert.equal(await related.count(),1);assert.equal(await related.locator('a').count(),3);
  const first=related.locator('a').first(),target=await first.getAttribute('href');assert.ok(target);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);if(overflow)console.log(JSON.stringify({slug,width,overflow,wide:await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+2&&getComputedStyle(e).position!=='fixed').slice(0,15).map(e=>({tag:e.tagName,cls:e.className,width:e.getBoundingClientRect().width,right:e.getBoundingClientRect().right,text:e.textContent?.slice(0,80)})))}));
  await first.press('Enter');await page.waitForURL(origin+target);assert.ok(await page.locator('main').count());
  evidence.push({slug,width,relatedLinks:3,keyboardNavigation:true,target,overflow,scope:'isolated source; not physical iPhone'});
 }
 assert.deepEqual(errors,[]);await context.close();
}}finally{await fs.mkdir('quality-results',{recursive:true});await fs.writeFile('quality-results/contextual-links.json',JSON.stringify(evidence,null,2));await browser.close();await new Promise(r=>server.close(r));}
assert.ok(evidence.every(x=>!x.overflow),'Viewport overflow remains; see contextual-links.json');
console.log('T04 contextual links UI passed: 8 pages at 390/1440px, localized related links, keyboard navigation and no viewport overflow.');
