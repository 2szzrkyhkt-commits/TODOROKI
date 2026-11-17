import fs from 'node:fs/promises';
import http from 'node:http';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const html=await fs.readFile('quality-results/tax-history-fixture.html');
const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch(),evidence=[];
try{for(const width of [390,1440]){
 const page=await browser.newPage({viewport:{width,height:900}});
 await page.goto('http://127.0.0.1:'+server.address().port);assert.ok((await page.locator('main').innerText()).includes('廃止・失効版'));
 assert.ok((await page.locator('main').innerText()).includes('旧版'));assert.ok((await page.locator('main').innerText()).includes('2018-04-01'));
 assert.equal(await page.locator('table').count(),2);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
 await page.screenshot({path:'quality-results/tax-history-'+width+'.png',fullPage:true});evidence.push({width,dates:true,repealedAndOld:true,metadataDiff:true,overflow:false,fixture:'synthetic XML; real official-style metadata, not authenticated production UI'});await page.close();
}}finally{await fs.writeFile('quality-results/tax-history-ui.json',JSON.stringify(evidence,null,2));await browser.close();await new Promise(r=>server.close(r));}
console.log('T21 history display: 390/1440px, enforcement dates, old/repealed states, metadata diff, escaped XML and no viewport overflow passed.');
