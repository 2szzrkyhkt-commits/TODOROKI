import fs from 'node:fs/promises';import path from 'node:path';import http from 'node:http';import assert from 'node:assert/strict';import {chromium} from 'playwright';
const expectedPages=[...(await fs.readFile('sitemap.xml','utf8')).matchAll(/<loc>/g)].length;
const root=process.cwd();await fs.mkdir('quality-results',{recursive:true});
const server=http.createServer(async(req,res)=>{try{let p=new URL(req.url,'http://local').pathname;if(!path.extname(p))p+='.html';const file=path.resolve(root,'.'+p);if(!file.startsWith(root+path.sep))throw Error('outside');res.setHeader('Content-Type',/\.m?js$/.test(p)?'text/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(await fs.readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch(),results=[];
try{for(const width of [390,1440]){
 const context=await browser.newContext({viewport:{width,height:900}});await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/site-map');await page.locator('#page-query').waitFor();assert.equal(await page.locator('#page-query').isEnabled(),true);
 const initial=await page.locator('#page-search-count').innerText();assert.equal(initial,expectedPages+'ページが該当');
 for(const code of ['7267','8306','3861','4755','8316','7269','7203']){await page.locator('#page-query').fill(code);assert.equal(await page.locator('#site-map-entries li:visible').count(),1);}await page.locator('#page-search-reset').click();
 await page.locator('#page-query').fill('無料計算ツール一覧ページ');assert.equal(await page.locator('#page-search-count').innerText(),'1ページが該当');assert.ok(await page.locator('#site-map-entries a[href="/calculators/"]').isVisible());await page.locator('#page-search-reset').click();
 await page.locator('#page-query').fill('太平洋 ５２３３');assert.equal(await page.locator('#site-map-entries li:visible').count(),1);assert.ok((await page.locator('#site-map-entries li:visible').innerText()).includes('太平洋'));
 await page.locator('#page-query').fill('せめんと');assert.equal(await page.locator('#site-map-entries li:visible').count(),1);
 await page.locator('#page-query').fill('nvidia 不明語');assert.equal(await page.locator('#site-map-entries li:visible').count(),0);assert.equal(await page.locator('#page-search-empty').isVisible(),true);
 await page.locator('#page-search-reset').click();assert.equal(await page.locator('#page-search-count').innerText(),initial);
 await page.locator('#page-language').selectOption('en');assert.ok(await page.locator('#site-map-entries li:visible').count()>0);for(const href of await page.locator('#site-map-entries li:visible a').evaluateAll(es=>es.map(e=>e.getAttribute('href'))))assert.ok(href.startsWith('/en/'));
 await page.locator('#page-search-reset').click();await page.locator('#page-query').fill('NVIDIA');assert.equal(await page.locator('#site-map-entries li:visible').count(),1);await page.locator('#page-query').press('Enter');assert.ok((await page.url()).endsWith('/site-map'));
 await page.locator('#site-map-entries li:visible a').click();await page.locator('#scenario-check').waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);assert.equal(await page.locator('#scenario-check a[href="/site-map"]').count(),1);
 await page.screenshot({path:`quality-results/t04-article-${width}.png`,fullPage:true});assert.deepEqual(errors,[]);
 const nojs=await browser.newContext({javaScriptEnabled:false,viewport:{width,height:900}}),plain=await nojs.newPage();await plain.goto(origin+'/site-map');assert.equal(await plain.locator('#page-query').isEnabled(),false);assert.ok(await plain.locator('#site-map-entries a[href="/taiheiyo-cement-5233-valuation-2026-nov"]').isVisible());await nojs.close();
 results.push({width,pages:expectedPages,unicode:true,andSearch:true,language:true,reset:true,noResults:true,keyboard:true,articleNavigation:true,noJsLinks:true,overflow:false,scope:'isolated source; not iPhone hardware'});await context.close();
}}finally{await fs.writeFile('quality-results/t04-discovery.json',JSON.stringify(results,null,2));await browser.close();await new Promise(r=>server.close(r));}
console.log(`T04 discovery UI passed: 390/1440px, ${expectedPages} pages, new company codes, code/kana/AND search, language, empty/reset/Enter, article navigation and no-JS links.`);
