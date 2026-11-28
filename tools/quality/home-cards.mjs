// Real homepage source: image loading, card navigation and ticker autoplay.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {chromium} from 'playwright';
const root=process.cwd(),html=await fs.readFile(process.env.HOME_TEST_SOURCE||'index.html','utf8');
const expectedPopular=['/kioxia-earnings-analysis-2026','/kokusai-electric-6525-earnings-2026','/open-house-group-3288-earnings-2026'];
const fixture={startDate:'2026-11-20',endDate:'2026-11-26',paths:[
 '/fast-retailing-9983-earnings-valuation-2026','/fixture-article-not-in-catalog',
 expectedPopular[0], expectedPopular[0], ...expectedPopular.slice(1)
]};
const server=createServer(async(req,res)=>{const p=new URL(req.url,'http://localhost').pathname;if(p==='/api/home-popular'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(req.headers['x-home-ranking-fixture']==='fresh'?fixture:null));}if(p==='/api/privacy/region'){res.setHeader('Content-Type','application/json');return res.end('{"optionalAllowed":false}');}if(p==='/'){res.setHeader('Content-Type','text/html');return res.end(html);}if(!p.startsWith('/assets/')||!path.resolve(root,'.'+p).startsWith(root+path.sep)){res.statusCode=404;return res.end();}try{res.setHeader('Content-Type',p.endsWith('.svg')?'image/svg+xml':/\.m?js$/.test(p)?'application/javascript':p.endsWith('.css')?'text/css':'application/octet-stream');res.end(await fs.readFile('.'+p));}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {}),evidence=[];
try{for(const width of [390,1440]){const context=await browser.newContext({viewport:{width,height:900}});await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.setFixedTime(new Date('2026-11-28T02:00:00Z'));
const cards=page.locator('#latest-article-shortlist > .card-link:visible');
const period=page.locator('#home-popular-period');
for(const scenario of ['fallback','fresh']){
 await page.setExtraHTTPHeaders({'x-home-ranking-fixture':scenario});
 const [response]=await Promise.all([page.waitForResponse(origin+'/api/home-popular'),page.goto(origin)]);
 assert.equal(response.status(),200);
 const fresh=scenario==='fresh';
 if(fresh)await period.waitFor({state:'visible'});
 assert.equal(await cards.count(),6);
 assert.deepEqual(await cards.locator('.selection-label').allTextContents(),[
   '新着','新着','新着',...Array(3).fill(fresh?'よく読まれた記事':'過去の記事')]);
 const hrefs=await cards.evaluateAll(es=>es.map(e=>e.getAttribute('href')));
 const featured=await page.locator('#latest-earnings .earnings-picks-list a').evaluateAll(es=>es.map(e=>e.getAttribute('href')));
 assert.equal(featured.length,3);
 assert.equal(new Set([...featured,...hrefs]).size,9);
 assert.equal(await period.isVisible(),fresh);
 if(fresh){
  assert.deepEqual(hrefs.slice(3),expectedPopular);
  assert.equal(await period.innerText(),'よく読まれた記事の集計期間：2026年11月20日〜2026年11月26日（GA4の閲覧数）');
 }else assert.equal(await period.textContent(),'');
}
assert.equal(await page.locator('#latest-articles-title').innerText(),'ARTICLES｜新着・よく読まれた記事');
assert.equal(await page.locator('#latest-articles-title + .rule + .cards').count(),1);

let imagesLoaded=0;for(const card of await cards.all()){await card.scrollIntoViewIfNeeded();const img=card.locator('img.article-thumbnail');assert.ok((await img.count())<=1);if(await img.count()){await img.evaluate(e=>e.decode());assert.ok(await img.evaluate(e=>e.naturalWidth===640&&e.naturalHeight===360));imagesLoaded++;}assert.ok((await card.locator('h3').innerText()).length>8);const href=await card.getAttribute('href');assert.ok(href.startsWith('/'));await fs.access(href.slice(1)+'.html');}
for (const reducedMotion of ['no-preference', 'reduce']) {
 await page.emulateMedia({reducedMotion});
 await page.goto(origin);
 assert.equal(await page.locator('.news-ticker button').count(), 0);
 const tracks = page.locator('.news-ticker-track');
 assert.equal(await tracks.count(), 2);
 const transforms = () => tracks.evaluateAll(items => items.map(item => getComputedStyle(item).transform));
 const before = await transforms();
 await page.waitForTimeout(350);
 const after = await transforms();
 for (let i = 0; i < before.length; i++) assert.notEqual(before[i], after[i]);
 assert.equal(await page.locator('#news-ticker .news-ticker-group').count(), 2);
 assert.equal(await page.locator('.news-ticker-group[aria-hidden="true"] a:not([tabindex="-1"])').count(), 0);
}
assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
await page.locator('#latest-articles').screenshot({path:`quality-results/home-cards-${width}.png`});evidence.push({width,cards:6,ranking_paths:['fallback','fresh'],images_loaded:imagesLoaded,text_only_cards:6-imagesLoaded,links_exist:6,ticker_moves:true,reduced_motion_autoplay:true,errors});await context.close();}}finally{await browser.close();server.close();}
await fs.writeFile('quality-results/home-cards.json',JSON.stringify(evidence,null,2));console.log('homepage 390/1440: fresh and fallback ranking, 12 cards/links, existing thumbnail loading and text-only cards, ticker autoplay with both motion settings, no JS errors or viewport overflow passed');
