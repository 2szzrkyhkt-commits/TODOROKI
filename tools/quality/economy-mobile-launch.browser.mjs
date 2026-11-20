import {webkit,devices} from 'playwright';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const client=await readFile(new URL('../../assets/economy-mobile-launch.js',import.meta.url));
const html=`<!doctype html><title>Economy entry fixture</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<script defer src="/assets/economy-mobile-launch.js"></script>
<a href="/api/tools/jp" referrerpolicy="origin" target="_blank" rel="noopener">Japan</a>
<a href="/api/tools/us" referrerpolicy="origin" target="_blank" rel="noopener">US</a>`;
const requests=[];
const server=createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/api/tools/')){
    requests.push({url:req.url,method:req.method,origin:req.headers.origin,site:req.headers['sec-fetch-site']});
    req.resume();
  }
  res.setHeader('Content-Type',url.pathname.endsWith('.js')?'application/javascript':'text/html; charset=utf-8');
  res.end(url.pathname.endsWith('.js')?client:url.pathname==='/'?html:'<!doctype html><title>Target</title>');
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
  browser=await webkit.launch();
  for(const profile of ['iPhone-shaped WebKit','Desktop-shaped touch WebKit']){
    const phone=devices['iPhone 13'];
    const context=await browser.newContext(
      profile==='iPhone-shaped WebKit'?phone:{...phone,userAgent:devices['Desktop Safari'].userAgent});
    try{
      if(profile==='Desktop-shaped touch WebKit'){
        await context.addInitScript(()=>{
          Object.defineProperty(navigator,'platform',{value:'MacIntel'});
          Object.defineProperty(navigator,'maxTouchPoints',{value:5});
          Object.defineProperty(navigator,'standalone',{value:true});
        });
      }
      const page=await context.newPage();
      for(const slug of ['jp','us']){
        await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
        const expected='/api/tools/'+slug+'?flow=auto';
        const before=requests.length;
        await Promise.all([page.waitForURL(origin+expected),page.locator('a[href="/api/tools/'+slug+'"]').click()]);
        assert.equal(context.pages().length,1);
        assert.equal(requests.length,before+1);
        const entry=requests.at(-1);
        assert.equal(entry.url,expected);
        assert.equal(entry.method,'POST');
        assert.equal(entry.origin,origin);
        assert.ok(entry.site===undefined||entry.site==='same-origin');
      }
      console.log(profile+': both economy cards emit a same-tab POST with a correct Origin');
    }finally{await context.close();}
  }
}finally{await browser?.close();await new Promise(r=>server.close(r));}
