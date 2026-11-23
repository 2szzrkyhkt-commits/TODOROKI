import {chromium,devices} from 'playwright';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../../',import.meta.url));
const aliases=new Set(['/app','/app/','/app/index.html','/app/index']);
const ct={'.html':'text/html; charset=utf-8','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.mp4':'video/mp4','.ico':'image/x-icon','.webp':'image/webp'};
const economyRequests=[];
const earningsLinks=['/toto-5332-earnings-valuation-2026','/smc-6273-earnings-valuation-2026','/taiheiyo-cement-5233-valuation-2026-nov'];
const server=createServer(async(req,res)=>{
 const p=new URL(req.url,'http://localhost').pathname;
 // Fixture only: production independently verifies exact Cloudflare alias and worker headers.
 if(aliases.has(p)){res.writeHead(301,{Location:'/'});res.end();return;}
 if(p==='/api/auth/me'||p==='/api/auth/logout'){
  res.setHeader('Content-Type','application/json');
  res.setHeader('Cache-Control','no-store');
  if(p.endsWith('/logout')){
   if(req.method!=='POST'){res.writeHead(405);res.end();return;}
   res.setHeader('Set-Cookie','fixture=; Max-Age=0; Path=/; HttpOnly');
   res.end(JSON.stringify({ok:true}));return;
  }
  // Delay ensures a member's private state is not assumed before a response.
  await new Promise(r=>setTimeout(r,180));
  res.end(JSON.stringify({member:req.headers.cookie?.includes('fixture=member')?{email:'fixture@example.invalid'}:null}));return;
 }
 if(p.startsWith('/api/')){
  if(p==='/api/tools/jp'||p==='/api/tools/us'){
   economyRequests.push({url:req.url,method:req.method,origin:req.headers.origin,fetchSite:req.headers['sec-fetch-site']});
  }
  res.setHeader('Content-Type','application/json');res.end('{}');return;
 }
 try{
  const clean=decodeURIComponent(p);
  const file=resolve(root,'.'+(clean==='/'?'/index.html':clean==='/login'?'/login.html':earningsLinks.includes(clean)?clean+'.html':clean));
  if(!file.startsWith(root.endsWith(sep)?root:root+sep)){res.writeHead(404);res.end();return;}
  if(p==='/app/sw.js')res.setHeader('Service-Worker-Allowed','/');
  res.setHeader('Content-Type',ct[extname(file)]??'application/octet-stream');
  res.end(await readFile(file));
 }catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
 browser=await chromium.launch(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{});
 for(const [profile,opts] of [['Desktop Chrome',devices['Desktop Chrome']],['Virtual iPhone',devices['iPhone 13']],['Virtual compact iPhone',{...devices['iPhone 13'],viewport:{width:375,height:667}}],['Virtual Android',devices['Pixel 7']]]){
  const context=await browser.newContext(opts);
  try{
   await context.route(u=>u.origin!==origin,r=>r.fulfill({status:204,body:''}));
   const p=await context.newPage();
   const errors=[];p.on('pageerror',e=>errors.push(e.message));
   let res=await p.goto(origin+'/app/',{waitUntil:'domcontentloaded'});
   assert.equal(p.url(),origin+'/');assert.equal(res.status(),200);
   const login=p.locator('[data-header-account] > a');
   const state=p.locator('[data-header-account] details');
   await login.waitFor({state:'visible'});
   assert.equal(await login.getAttribute('href'),'/login');
   const swScope=await p.evaluate(()=>Promise.race([
    navigator.serviceWorker.ready.then(reg=>reg.scope),
    new Promise((_,reject)=>setTimeout(()=>reject(Error('service worker not ready')),12000)),
   ]));
   assert.equal(swScope,origin+'/');
   assert.equal(await p.locator('link[rel="canonical"]').getAttribute('href'),'https://todoroki-gold.com/');
   const toEntry=slug=>'/api/tools/'+slug+(opts.isMobile?'?flow=auto':'');
   const equity=toEntry('equity');
   for(const tool of [toEntry('jp'),toEntry('us'),equity,'/us-equity']){
    const a=p.locator('#company-analysis a[href="'+tool+'"]');
    assert.equal(await a.count(),1,tool+' original normal entry');
   }
   const stock=p.getByRole('link',{name:'銘柄を調べる',exact:true});
   const earnings=p.getByRole('link',{name:'最新の決算分析を読む',exact:true});
   const hero=p.locator('.hero');
   assert.equal(await hero.locator('.hero-actions a').count(),2);
   await p.evaluate(()=>window.scrollTo(0,0));
   for(const cta of [stock,earnings]){
    const rect=await cta.boundingBox();
    const viewport=p.viewportSize();
    assert.ok(rect&&rect.width>100&&rect.height>=44&&rect.y>=0&&rect.y+rect.height<=viewport.height&&rect.x>=0&&rect.x+rect.width<=viewport.width,profile+' fully visible hero CTA');
    assert.ok(await cta.evaluate(a=>a.scrollWidth<=a.clientWidth),profile+' CTA text untruncated');
   }
   const latest=p.locator('.hero + #latest-earnings');
   assert.deepEqual(await latest.locator('.earnings-picks-list a').evaluateAll(ls=>ls.map(l=>l.getAttribute('href'))),earningsLinks);
   assert.equal(await latest.locator('time').count(),3);
   const lower=p.locator('#latest-article-shortlist > a');
   const lowerLinks=await lower.evaluateAll(ls=>ls.map(l=>l.getAttribute('href')));
   assert.equal(lowerLinks.length,6);
   assert.equal(new Set([...earningsLinks,...lowerLinks]).size,9,'visible picks are distinct across sections');
   const archive=p.locator('#latest-articles details');
   assert.equal(await archive.getAttribute('open'),null);
   for(const href of earningsLinks)assert.equal(await archive.locator('#home-article-catalog a[href="'+href+'"]').count(),1);
   assert.equal(await p.locator('#latest-articles a[href="/site-map"]').count(),1);
   assert.ok(await p.locator('#news-ticker a[href="'+earningsLinks[0]+'"]').count()>0,'featured article remains in ticker');

   assert.equal(await p.locator('#latest-earnings + #latest-articles + #articles').count(),1);
   assert.equal(await p.locator('#news-ticker').count(),1);
   await Promise.all([p.waitForURL(origin+'/#latest-earnings'),earnings.click()]);
   await p.waitForFunction(()=>document.querySelector('#latest-earnings').getBoundingClientRect().top>=document.querySelector('.site-header').getBoundingClientRect().bottom-1&&document.querySelector('#latest-earnings').getBoundingClientRect().top<250);
   if(!opts.isMobile){
    for(const href of earningsLinks)assert.equal((await p.request.get(origin+href)).status(),200);
    const link=latest.locator('.earnings-picks-list a').first();
    await Promise.all([p.waitForURL(origin+earningsLinks[0]),link.click()]);
    await p.goBack({waitUntil:'domcontentloaded'});
    assert.equal(p.url(),origin+'/#latest-earnings');
   }
   if(profile==='Desktop Chrome'||profile==='Virtual compact iPhone'){
    for(const [path,code] of [[earningsLinks[0],'5332'],[earningsLinks[1],'6273']]){
     assert.equal((await p.goto(origin+path,{waitUntil:'domcontentloaded'})).status(),200);
     const link=p.getByRole('link',{name:'日本企業分析ツールへ →',exact:true});
     assert.equal(await link.count(),1);
     assert.equal(await link.getAttribute('href'),'/#equity-research-tool');
     assert.equal(await link.getAttribute('data-article-tool-market'),'jp');
     assert.equal(await p.evaluate(()=>typeof window.gtag),'undefined','default analytics remains off');
     assert.ok((await p.locator('aside:has(a[href="/#equity-research-tool"])').innerText()).includes('銘柄コード「'+code+'」'));
     await Promise.all([p.waitForURL(origin+'/#equity-research-tool'),link.click()]);
     const existing=p.locator('#equity-research-tool');
     assert.equal(await existing.getAttribute('href'),equity);
     assert.equal(await existing.getAttribute('referrerpolicy'),'origin');
     await p.waitForFunction(()=>{const card=document.querySelector('#equity-research-tool').getBoundingClientRect();return card.top>=document.querySelector('.site-header').getBoundingClientRect().bottom-1&&card.top<250;});
    }
   }
   await p.goto(origin+'/',{waitUntil:'domcontentloaded'});
   await Promise.all([p.waitForURL(origin+'/#equity-research-tool'),stock.press('Enter')]);
   const targeted=p.locator('#equity-research-tool');
   assert.equal(await targeted.getAttribute('href'),equity);
   assert.equal(await targeted.getAttribute('referrerpolicy'),'origin');
   await p.waitForFunction(()=>{const p=document.querySelector('#equity-research-tool').getBoundingClientRect();return p.top>=document.querySelector('.site-header').getBoundingClientRect().bottom-1&&p.top<250;});
   await p.goto(origin+'/',{waitUntil:'domcontentloaded'});
   const width=()=>p.evaluate(()=>({w:innerWidth,doc:document.documentElement.scrollWidth}));
   let bounds=await width();assert.ok(bounds.doc<=bounds.w+2,profile+' portrait overflow '+JSON.stringify(bounds));
   if(opts.isMobile){
    const {width:w,height:h}=p.viewportSize();
    await p.setViewportSize({width:h,height:w});
    bounds=await width();assert.ok(bounds.doc<=bounds.w+2,profile+' landscape overflow '+JSON.stringify(bounds));
   }
   await context.addCookies([{name:'fixture',value:'member',url:origin,httpOnly:true}]);
   await p.reload({waitUntil:'domcontentloaded'});
   assert.equal(new URL(p.url()).pathname,'/');
   await state.waitFor({state:'visible'});
   assert.equal(await login.isVisible(),false);
   await p.goto(origin+'/login?from=app',{waitUntil:'domcontentloaded'});
   await p.waitForURL(origin+'/');
   await state.waitFor({state:'visible'});
   await state.locator('summary').click();
   await state.getByRole('button',{name:'ログアウト'}).click();
   await login.waitFor({state:'visible'});
   assert.equal(await state.isVisible(),false);
   assert.equal(new URL(p.url()).pathname,'/');
   for(const slug of ['jp','us']){
    const target=toEntry(slug);
    const card=p.locator('#company-analysis a[href="'+target+'"]');
    assert.equal(await card.getAttribute('target'),'_blank');
    assert.equal(await card.getAttribute('rel'),'noopener');
    if(!opts.isMobile) continue;
    const expected=origin+target;
    const before=economyRequests.length;
    await Promise.all([p.waitForURL(expected),card.click()]);
    assert.equal(economyRequests.length,before+1);
    const request=economyRequests.at(-1);
    assert.equal(request.url,target);
    assert.equal(request.method,'POST');
    assert.equal(request.origin,origin);
    assert.ok(request.fetchSite===undefined||request.fetchSite==='same-origin',
     'Economy POST fetch-site must be absent or same-origin, as required by the Worker');
    assert.equal(context.pages().length,1,'Economy POST must navigate the same tab');
    await p.goto(origin+'/',{waitUntil:'domcontentloaded'});
   }
   await Promise.all([
     p.waitForURL(origin+equity),
     p.locator('#company-analysis a[href="'+equity+'"]').click(),
   ]);
   assert.deepEqual(errors,[],profile+' page script errors');
   console.log(profile+': fixture article-to-company CTA / legacy launch, same home, layout'+(opts.isMobile?' and rotated viewport':'')+', hero CTAs, featured links, state restoration, legacy login return, logout, and one-click tool destination passed');
  }finally{await context.close();}
 }
 const noJS=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
 try{
  await noJS.route(u=>u.origin!==origin,r=>r.abort());
  const p=await noJS.newPage();await p.goto(origin,{waitUntil:'domcontentloaded'});
  assert.deepEqual(await p.locator('#latest-earnings .earnings-picks-list a').evaluateAll(ls=>ls.map(l=>l.getAttribute('href'))),earningsLinks);
  assert.equal(await p.locator('.hero-actions a').count(),2);
  const lower=await p.locator('#latest-article-shortlist > a').evaluateAll(ls=>ls.map(l=>l.getAttribute('href')));
  assert.equal(lower.length,6);
  assert.equal(new Set([...earningsLinks,...lower]).size,9);
  const archive=p.locator('#latest-articles details');
  await archive.getByText('記事一覧へ',{exact:true}).click();
  for(const href of earningsLinks)assert.equal(await archive.locator('a[href="'+href+'"]').isVisible(),true);
  console.log('No-JavaScript 390px: two native CTAs, disjoint article previews, full archive still opens');
 }finally{await noJS.close();}
 const opted=await browser.newContext();
 try{
  await opted.route(u=>u.origin!==origin,r=>r.abort());
  await opted.route(origin+'/api/privacy/region',r=>r.fulfill({json:{optionalAllowed:true}}));
  await opted.addInitScript(()=>{
   localStorage.setItem('todoroki_privacy_v1',JSON.stringify({version:1,time:Date.now(),analytics:true,ads:false}));
  });
  const p=await opted.newPage();
  await p.goto(origin+earningsLinks[0],{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>typeof window.gtag==='function');
  await p.evaluate(()=>{
   const active=window.gtag;
   window.gtag=function(...args){
    if(args[0]==='event')sessionStorage.setItem('fixture-events',JSON.stringify([...JSON.parse(sessionStorage.getItem('fixture-events')||'[]'),args]));
    active.apply(this,args);
   };
  });
  const link=p.getByRole('link',{name:'日本企業分析ツールへ →',exact:true});
  await link.evaluate(a=>{const e=new MouseEvent('click',{bubbles:true,cancelable:true});e.preventDefault();a.dispatchEvent(e);});
  assert.equal(await p.evaluate(()=>sessionStorage.getItem('fixture-events')),null);
  await Promise.all([p.waitForURL(origin+'/#equity-research-tool'),link.click()]);
  assert.deepEqual(await p.evaluate(()=>JSON.parse(sessionStorage.getItem('fixture-events'))),[['event','article_tool_click',{market:'jp'}]]);
  console.log('Article CTA: one fixed event only under existing permitted opt-in; no event for synthetic click; navigation unchanged');
 }finally{await opted.close();}
 const next=await browser.newContext();
 try{
  await next.route(u=>u.origin!==origin,r=>r.abort());
  const p=await next.newPage();await p.clock.setFixedTime(new Date('2026-11-21T00:00:00Z'));
  await p.route(u=>u.href===origin+'/?publish-fixture',async r=>{
   const upstream=await r.fetch(),source=await upstream.text();
   // A genuine editorial earnings card gets a later publication date in this synthetic fixture.
   const pattern=/(href="\/advantest-6857-earnings-analysis-2026" class="card-link" data-earnings-analysis>.*?<time datetime=")2026-11-12(">)[^<]+/s;
   assert.match(source,pattern);
   await r.fulfill({response:upstream,body:source.replace(pattern,(_,before,after)=>before+'2026-11-21'+after+'2026.11.21')});
  });
  await p.goto(origin+'/?publish-fixture',{waitUntil:'domcontentloaded'});
  const hrefs=selector=>p.locator(selector).evaluateAll(ls=>ls.map(l=>l.getAttribute('href')));
  const upper=await hrefs('#latest-earnings .earnings-picks-list a'), lower=await hrefs('#latest-article-shortlist > a');
  assert.deepEqual(upper,['/advantest-6857-earnings-analysis-2026',earningsLinks[0],earningsLinks[1]]);
  assert.equal(lower.length,6);
  assert.equal(new Set([...upper,...lower]).size,9);
  assert.ok(lower.includes(earningsLinks[2]),'displaced featured article is eligible for the lower preview again');
  assert.deepEqual(await p.locator('#latest-article-shortlist .selection-label').allTextContents(),['新着','新着','新着','よく読まれた記事','よく読まれた記事','よく読まれた記事']);
  console.log('Synthetic newly published earnings moves into upper three; only actual upper links excluded from lower six');
 }finally{await next.close();}
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
