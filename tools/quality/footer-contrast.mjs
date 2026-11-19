// Isolated source check: no advertising, media or third-party requests.
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
const root=process.cwd(),out='quality-results';
await fs.mkdir(out,{recursive:true});
const server=http.createServer(async(req,res)=>{
 try{
  let p=decodeURIComponent(new URL(req.url,'http://local').pathname);
  if(p.endsWith('/'))p+='index.html';else if(!path.extname(p))p+='.html';
  const file=path.resolve(root,'.'+p);if(!file.startsWith(root+path.sep))throw Error('outside');
  const data=await fs.readFile(file);res.setHeader('Content-Type',p.endsWith('.css')?'text/css':p.endsWith('.js')?'text/javascript':'text/html');res.end(data);
 }catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port,paths=['/','/en/','/es/','/pt/','/zh-Hans/','/zh-Hant/','/pdf-library'];
const browser=await chromium.launch(),results=[];
try{
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:900}});
  await context.route('**/*',r=>r.request().url().startsWith(origin)&&!['script','image','media','font'].includes(r.request().resourceType())?r.continue():r.abort());
  for(const p of paths){
   const page=await context.newPage();
   try{
    const response=await page.goto(origin+p,{waitUntil:'networkidle'});assert.equal(response.status(),200);
    const footer=page.locator('footer');assert.equal(await footer.count(),1);
    const result=await new AxeBuilder({page}).include('footer').withRules(['color-contrast']).analyze();
    const evidence={path:p,width,violations:result.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),incomplete:result.incomplete.map(v=>v.id)};
    results.push(evidence);assert.equal(evidence.violations.length,0,JSON.stringify(evidence));assert.equal(evidence.incomplete.length,0,JSON.stringify(evidence));
    await footer.screenshot({path:out+'/footer-'+width+'-'+p.replaceAll('/','_')+'.png'});
   }finally{await page.close();}
  }
  await context.close();
 }
}finally{
 await fs.writeFile(out+'/footer-source.json',JSON.stringify(results,null,2));
 await browser.close();await new Promise(r=>server.close(r));
}
console.log('Footer source checks passed: '+results.length+' page/width cases, no third-party requests; no claim of full accessibility.');
