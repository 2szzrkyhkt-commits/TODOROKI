// Exercise actual privacy source on localhost. All external requests are aborted.
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const source=await fs.readFile('assets/privacy-controls.js','utf8');
const server=createServer((req,res)=>{
 if(req.url==='/assets/privacy-controls.js'){res.setHeader('Content-Type','application/javascript');res.end(source);return;}
 if(req.url==='/api/privacy/region'){res.setHeader('Content-Type','application/json');res.end('{"optionalAllowed":true}');return;}
 res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="ja"><head><script defer src="/assets/privacy-controls.js"></script></head><body><main>Fixture</main></body></html>');
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch();const evidence=[];
try{
 const context=await browser.newContext();const external=[];
 await context.route('**/*',async route=>{
  if(route.request().url().startsWith(origin))return route.continue();
  external.push(route.request().url().split('?')[0]);return route.abort();
 });
 const page=await context.newPage();await page.goto(origin);await page.locator('#td-privacy-open').waitFor();await page.waitForTimeout(300);
 assert.equal(external.length,0);evidence.push('default denies optional requests');
 await page.locator('#td-privacy-open').click();await page.locator('#td-ads').check();await page.locator('#td-save').click();await page.waitForLoadState();await page.waitForTimeout(300);
 assert.equal(external.filter(u=>u.includes('adsbygoogle')).length,1);evidence.push('one ad-loader request after explicit choice, external request intercepted');
 await page.locator('#td-privacy-open').click();await page.locator('#td-reject').click();await page.waitForLoadState();await page.waitForTimeout(300);
 assert.equal(await page.locator('script[src*="adsbygoogle"]').count(),0);evidence.push('reject removes loader on reload');
 await context.close();
 const sensitive=await browser.newContext({storageState:{cookies:[],origins:[{origin,localStorage:[{name:'todoroki_privacy_v1',value:JSON.stringify({version:1,time:Date.now(),analytics:true,ads:true})}]}]}});
 await sensitive.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
 const login=await sensitive.newPage();await login.goto(origin+'/login');await login.locator('#td-privacy-open').waitFor();await login.waitForTimeout(300);
 assert.equal(await login.locator('script[src*="adsbygoogle"]').count(),0);evidence.push('login page excludes ads even with saved consent');await sensitive.close();
 await fs.mkdir('quality-results',{recursive:true});await fs.writeFile('quality-results/consent.json',JSON.stringify({39:{errors:[],evidence:[{scope:'isolated real-source browser contract; not production ad delivery',cases:evidence}]}},null,2));
 console.log('consent contracts passed:',evidence.length);
}finally{await browser.close();server.close();}
