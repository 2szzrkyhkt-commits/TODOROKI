import {chromium,firefox,webkit} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';
const out='quality-results';await fs.mkdir(out,{recursive:true});
const results={};
function add(id,errors,evidence){const r=results[id]??={errors:[],evidence:[]};r.errors.push(...errors);r.evidence.push(evidence);}
const weekly=['weekly','monthly'].includes(process.env.MODE);
const paths=['/','/en/','/es/','/pt/','/zh-Hans/','/zh-Hant/','/boki1','/pdf-library','/calculators/','/compound-interest/','/break-even/','/ai-bubble-collapse-or-correction'];
for(const [name,engine] of Object.entries(weekly?{chromium,firefox,webkit}:{chromium})){
 const browser=await engine.launch();
 try{for(const width of [390,1440]){
 const context=await browser.newContext({viewport:{width,height:900}});
 for(const path of paths){
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
   const response=await page.goto('https://todoroki-gold.com'+path,{waitUntil:'domcontentloaded',timeout:30000});
   if(!response?.ok()){add(26,[],{path,name,width,inconclusive:`HTTP ${response?.status()}`});continue;}
   await page.waitForTimeout(1500);
   add(26,errors.map(e=>({path,name,width,error:e})),{path,name,width});
   const ui=await page.evaluate(()=>({headers:document.querySelectorAll('header.site-header').length,nav:document.querySelectorAll('header a[href]').length,overflow:document.documentElement.scrollWidth>innerWidth+2,brokenImages:[...document.images].filter(x=>!x.complete||x.naturalWidth===0).map(x=>x.getAttribute('src'))}));
   await page.screenshot({path:`${out}/${name}-${width}-${path.replaceAll('/','_')}.png`,fullPage:true});
   add(28,ui.headers!==1?[{path,name,width,headerCount:ui.headers}]:[],{path,name,width});
   add(29,ui.nav===0?[{path,name,width,missingNavigation:true}]:[],{path,name,width});
   if(path==='/pdf-library'||path==='/boki1'){
    const input=page.locator('#search');
    if(await input.count()){
     await input.fill('__todoroki_audit_no_match_84739__');await page.waitForTimeout(250);
     const target=path==='/pdf-library'?'#grid':'#cards';
     const count=await page.locator(target+' > *:visible').count();
     add(31,count>0?[{path,filterDidNotClearResults:count}]:[],{path,searchQuery:'unique no-match fixture'});
     if(path==='/boki1')add(33,[],{path,searchTest:true,scope:'lesson filtering only; save and quiz not verified'});
     await input.fill('');
    }else add(31,[{path,missingSearch:true}],{path});
   }
   if(path==='/'){
    const track=page.locator('.news-ticker-track');
    if(await track.count()){
     const a=await track.evaluate(e=>getComputedStyle(e).transform);await page.waitForTimeout(400);
     const b=await track.evaluate(e=>getComputedStyle(e).transform);
     add(32,a===b?[{path,stationary:true}]:[],{path,transforms:[a,b]});
    }else add(32,[{path,missingTicker:true}],{path});
    const picker=page.locator('[data-todoroki-language]:visible').first();
    if(await picker.count()){
     await picker.selectOption('en');await page.waitForURL('**/en/**',{timeout:10000});
     add(30,[],{path,target:page.url(),scope:'Japanese to English home only'});
    }
   }
   if(path==='/compound-interest/'){
    for(const [id,value] of Object.entries({initial:'100000',monthly:'10000',rate:'0',years:'1'}))await page.locator('#'+id).fill(value);
    await page.locator('#calculate').click();
    const total=await page.locator('#total').innerText();
    add(34,!total.includes('220,000')?[{path,total,expected:220000}]:[],{path,case:'zero-rate one year'});
   }
   if(path==='/break-even/'){
    for(const [id,value] of Object.entries({fixed:'1000000',price:'2000',variable:'1200',target:'500000'}))await page.locator('#'+id).fill(value);
    await page.locator('#calculate').click();const qty=await page.locator('#qty').innerText();
    add(34,!qty.includes('1,250')?[{path,qty,expected:1250}]:[],{path,case:'fixed example'});
   }
   {
    add(41,ui.overflow?[{path,name,width,overflow:true}]:[],{path,name,width});
    add(43,ui.brokenImages.map(src=>({path,name,width,src})),{path,name,width});
    if(weekly){
    const axe=await new AxeBuilder({page}).analyze();
    add(52,axe.violations.filter(x=>['serious','critical'].includes(x.impact)).map(x=>({path,name,width,id:x.id,nodes:x.nodes.map(n=>n.target)})),{path,name,width,incomplete:axe.incomplete.map(x=>x.id)});
    }
   }
  }catch(e){add(26,[],{path,name,width,inconclusive:e.message});}finally{await page.close();}
 }
 await context.close();
 }}finally{await browser.close();}
}
await fs.writeFile(out+'/browser.json',JSON.stringify(results,null,2));
