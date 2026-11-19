import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {course} from '../../assets/tax-course-content.mjs';
const oracle={'boki-receivable':'c','boki-prepaid':'a','financial-position':'c','financial-depreciation':'a','income-base':'b','income-progressive':'b','corporate-adjustment':'c','corporate-depreciation':'a','inheritance-exemption':'b','inheritance-process':'c','consumption-rates':'a','consumption-classification':'b','liquor-taxpayer':'c','liquor-licence':'a','collection-process':'b','collection-deferral':'c','resident-year':'a','resident-address':'b','business-base':'c','business-adjustment':'a','property-owner':'b','property-base':'c'};
const root=process.cwd(),out='quality-results',key='todoroki.tax-course.progress.v1';await fs.mkdir(out,{recursive:true});
const server=http.createServer(async(req,res)=>{try{
 let p=decodeURIComponent(new URL(req.url,'http://local').pathname);if(!path.extname(p))p+='.html';
 const file=path.resolve(root,'.'+p);if(!file.startsWith(root+path.sep))throw Error('outside');
 res.setHeader('Content-Type',/\.m?js$/.test(p)?'text/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(await fs.readFile(file));
}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch(),evidence=[];
try{for(const width of [390,1440]){
 const context=await browser.newContext({viewport:{width,height:900}});
 await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/tax-study');assert.equal(await page.locator('#tax-subject').isEnabled(),true);
 assert.equal(await page.locator('[data-tax-lesson]:visible').count(),2);
 assert.ok((await page.locator('#tax-progress').innerText()).includes('0 / 22'));
 const first=page.locator('form[data-tax-quiz="income-base"]');
 await first.getByRole('button',{name:'回答を確認',exact:true}).click();
 assert.equal(await first.locator('[data-tax-feedback]').getAttribute('data-result'),'unanswered');
 for(const s of course.subjects){
  await page.locator('#tax-subject').selectOption(s.id);
  assert.equal(await page.locator('[data-tax-lesson]:visible').count(),2);
  for(const l of course.lessons.filter(l=>l.subject===s.id)){
   const form=page.locator('form[data-tax-quiz="'+l.id+'"]');
   await form.locator('input[value="'+oracle[l.id]+'"]').check();
   await form.getByRole('button',{name:'回答を確認',exact:true}).click();
   assert.equal(await form.locator('[data-tax-feedback]').getAttribute('data-result'),'correct');
  }
 }
 assert.ok((await page.locator('#tax-progress').innerText()).includes('22 / 22'));
 await page.reload();assert.ok((await page.locator('#tax-progress').innerText()).includes('22 / 22'));
 const form=page.locator('form[data-tax-quiz="income-base"]');
 await form.getByRole('button',{name:'この問題をやり直す',exact:true}).click();
 assert.ok((await page.locator('#tax-progress').innerText()).includes('21 / 22'));
 assert.equal(await form.locator('[data-tax-feedback]').isVisible(),false);
 await form.locator('input[value="a"]').check();await form.getByRole('button',{name:'回答を確認',exact:true}).click();
 assert.equal(await form.locator('[data-tax-feedback]').getAttribute('data-result'),'incorrect');
 assert.ok((await page.locator('#tax-progress').innerText()).includes('21 / 22'));
 await form.locator('input[value="b"]').check();await form.getByRole('button',{name:'回答を確認',exact:true}).click();
 assert.ok((await page.locator('#tax-progress').innerText()).includes('22 / 22'));
 await page.locator('#tax-search').fill('__audit_no_result_29198__');
 assert.equal(await page.locator('[data-tax-lesson]:visible').count(),0);assert.equal(await page.locator('#tax-no-results').isVisible(),true);
 await page.getByRole('link',{name:'簿記論',exact:true}).click();
 assert.equal(await page.locator('[data-tax-lesson]:visible').count(),2);
 await page.locator('#tax-search').fill('前払費用');assert.equal(await page.locator('[data-tax-lesson]:visible').count(),1);
 await page.locator('#tax-search').fill('');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
 assert.equal(await page.locator('#income-tax-form').count(),1);
 await page.screenshot({path:out+'/tax-course-'+width+'.png',fullPage:true});
 const foreign='{"schema":2,"correctOnce":["future-safe-lesson"]}';
 await page.evaluate(({key,foreign})=>localStorage.setItem(key,foreign),{key,foreign});
 await page.reload();assert.ok((await page.locator('#tax-storage-note').innerText()).includes('上書きしません'));
 const boki=page.locator('form[data-tax-quiz="boki-receivable"]');
 await boki.locator('input[value="c"]').check();await boki.getByRole('button',{name:'回答を確認',exact:true}).click();
 assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),foreign);
 assert.deepEqual(errors,[]);
 evidence.push({width,subjects:11,correctAnswers:22,unansweredRejected:true,wrongNotCompleted:true,retryOnlyOne:true,reloadPersistence:true,keywordAndSubjectFilters:true,hashNavigation:true,foreignProgressPreserved:true,overflow:false,pageErrors:errors,scope:'isolated current source; not production/iPhone hardware'});
 await context.close();
}}finally{await fs.writeFile(out+'/tax-course-ui.json',JSON.stringify(evidence,null,2));await browser.close();await new Promise(r=>server.close(r));}
console.log('T19 course UI: 11 subjects, 22 correct answers per 390/1440 width, unanswered/wrong/retry/reload, keyword/hash navigation, foreign progress preservation and no overflow passed.');
