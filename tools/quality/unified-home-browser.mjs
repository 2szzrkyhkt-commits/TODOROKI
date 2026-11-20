import {chromium,devices} from 'playwright';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../../',import.meta.url));
const aliases=new Set(['/app','/app/','/app/index.html','/app/index']);
const ct={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.mp4':'video/mp4','.ico':'image/x-icon','.webp':'image/webp'};
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
 if(p.startsWith('/api/')){res.setHeader('Content-Type','application/json');res.end('{}');return;}
 try{
  const clean=decodeURIComponent(p);
  const file=resolve(root,'.'+(clean==='/'?'/index.html':clean==='/login'?'/login.html':clean));
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
 browser=await chromium.launch();
 for(const [profile,opts] of [['Desktop Chrome',devices['Desktop Chrome']],['Virtual iPhone',devices['iPhone 13']],['Virtual Android',devices['Pixel 7']]]){
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
   const equity=opts.isMobile?'/api/tools/equity?flow=auto':'/api/tools/equity';
   for(const tool of ['/api/tools/jp','/api/tools/us',equity,'/us-equity']){
    const a=p.locator('#company-analysis a[href="'+tool+'"]');
    assert.equal(await a.count(),1,tool+' original normal entry');
   }
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
   await Promise.all([
     p.waitForURL(origin+equity),
     p.locator('#company-analysis a[href="'+equity+'"]').click(),
   ]);
   assert.deepEqual(errors,[],profile+' page script errors');
   console.log(profile+': fixture legacy launch, same home, layout'+(opts.isMobile?' and rotated viewport':'')+', state restoration, legacy login return, logout, and one-click tool destination passed');
  }finally{await context.close();}
 }
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
