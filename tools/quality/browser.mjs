import {chromium,firefox,webkit} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';
const out='quality-results';await fs.mkdir(out,{recursive:true});
const results={};
function add(id,errors,evidence){const r=results[id]??={errors:[],evidence:[]};r.errors.push(...errors);r.evidence.push(evidence);}
const weekly=['weekly','monthly'].includes(process.env.MODE);
const paths=['/','/en/','/es/','/pt/','/zh-Hans/','/zh-Hant/','/boki1','/pdf-library','/calculators/'];
for(const [name,engine] of Object.entries(weekly?{chromium,firefox,webkit}:{chromium})){
 const browser=await engine.launch();
 try{for(const width of weekly?[390,1440]:[390]){
 const context=await browser.newContext({viewport:{width,height:900}});
 for(const path of paths){
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
   const response=await page.goto('https://todoroki-gold.com'+path,{waitUntil:'domcontentloaded',timeout:30000});
   if(!response?.ok()){add(26,[],{path,name,width,inconclusive:`HTTP ${response?.status()}`});continue;}
   await page.waitForTimeout(1500);
   add(26,errors.map(e=>({path,name,width,error:e})),{path,name,width});
   const ui=await page.evaluate(()=>({headers:document.querySelectorAll('header.site-header').length,nav:document.querySelectorAll('header a[href]').length,overflow:document.documentElement.scrollWidth>innerWidth+2,brokenImages:[...document.images].filter(x=>!x.complete||x.naturalWidth===0).map(x=>x.getAttribute('src'))}));
   add(28,ui.headers!==1?[{path,name,width,headerCount:ui.headers}]:[],{path,name,width});
   add(29,ui.nav===0?[{path,name,width,missingNavigation:true}]:[],{path,name,width});
   if(weekly){
    add(41,ui.overflow?[{path,name,width,overflow:true}]:[],{path,name,width});
    add(43,ui.brokenImages.map(src=>({path,name,width,src})),{path,name,width});
    const axe=await new AxeBuilder({page}).analyze();
    add(52,axe.violations.filter(x=>['serious','critical'].includes(x.impact)).map(x=>({path,name,width,id:x.id,nodes:x.nodes.map(n=>n.target)})),{path,name,width,incomplete:axe.incomplete.map(x=>x.id)});
    await page.screenshot({path:`${out}/${name}-${width}-${path.replaceAll('/','_')}.png`,fullPage:true});
   }
  }catch(e){add(26,[],{path,name,width,inconclusive:e.message});}finally{await page.close();}
 }
 await context.close();
 }}finally{await browser.close();}
}
await fs.writeFile(out+'/browser.json',JSON.stringify(results,null,2));
