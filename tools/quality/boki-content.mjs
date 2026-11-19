// Actual lesson/quiz source, isolated browser, no external requests or production writes.
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {chromium} from 'playwright';
const root=process.cwd(),html=await fs.readFile('boki1.html','utf8'),ctx=vm.createContext({});
for(const m of html.matchAll(/<script src="(\/assets\/boki[^\"]+\.js)"/g)){
 if(m[1].includes('scope-ui'))continue;
 vm.runInContext(await fs.readFile('.'+m[1],'utf8'),ctx);
}
const data=JSON.parse(vm.runInContext('JSON.stringify({lessons,qs})',ctx));
const addedL=data.lessons.filter(x=>x.id?.startsWith('fx-20261114-')),addedQ=data.qs.filter(x=>x.id?.startsWith('fx-q-20261114-'));
assert.equal(addedL.length,8);assert.equal(addedQ.length,8);
for(const all of [data.lessons,data.qs]){const rows=all.filter(x=>x.id);assert.equal(new Set(rows.map(x=>x.id)).size,rows.length,'duplicate ID');}
for(const x of [...addedL,...addedQ]){assert.ok(x.sourceUrl.startsWith('https://www.asb-j.jp/'));assert.ok(x.years.includes(2026));}
const answers=['取得時の相場','435,000円','552,000円','評価額引下げの規則を別途検討する','差損4,000円','差益9,000円','差益5,600円','借：買掛金174,000・為替差損4,800／貸：現金預金178,800'];
for(let i=0;i<8;i++){assert.equal(addedQ[i].a[addedQ[i].correct],answers[i]);assert.equal(data.qs.filter(x=>x.q===addedQ[i].q).length,1);}
assert.equal(3000*145,435000);assert.equal(4000*138,552000);assert.equal(2000*(148-150),-4000);assert.equal(3000*(150-147),9000);assert.equal(800*(142-135),5600);assert.equal(1200*(149-145),4800);
const server=createServer(async(req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname==='/api/privacy/region'){res.setHeader('Content-Type','application/json');res.end('{"optionalAllowed":false}');return;}
 const rel=pathname==='/boki1'?'boki1.html':pathname.startsWith('/assets/')?pathname.slice(1):null;
 if(!rel||!path.resolve(root,rel).startsWith(root+path.sep)){res.statusCode=404;res.end();return;}
 try{res.setHeader('Content-Type',rel.endsWith('.js')?'application/javascript':rel.endsWith('.css')?'text/css':'text/html');res.end(await fs.readFile(rel));}catch{res.statusCode=404;res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch();
const evidence=[];
try{for(const width of [390,1440]){
 const context=await browser.newContext({viewport:{width,height:900}});await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/boki1');
 for(const l of addedL){await page.locator('#search').fill(l.title);assert.equal(await page.locator('#cards > *').count(),1);assert.ok((await page.locator('#cards').innerText()).includes(l.body));}
 await page.locator('[data-view="quiz"]').click();
 for(let i=0;i<addedQ.length;i++){
  const q=addedQ[i];await page.locator('#quiz-search').fill(q.q);assert.equal(await page.locator('#questions .question').count(),1);
  if(i===0){await page.locator('#questions').getByRole('button',{name:q.a[(q.correct+1)%3],exact:true}).click();assert.ok((await page.locator('#questions .feedback').innerText()).startsWith('不正解'));await page.getByRole('button',{name:'この問題を解き直す',exact:true}).click();}
  await page.locator('#questions').getByRole('button',{name:q.a[q.correct],exact:true}).click();assert.ok((await page.locator('#questions .feedback').innerText()).startsWith('正解！'));
 }
 await page.reload();await page.locator('[data-view="quiz"]').click();await page.locator('#quiz-search').fill(addedQ[7].q);assert.ok((await page.locator('#questions .feedback').innerText()).startsWith('正解！'));
 assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
 await fs.mkdir('quality-results',{recursive:true});await page.locator('#questions').screenshot({path:`quality-results/boki-additions-${width}.png`});
 evidence.push({width,lessons:8,graded:8,wrong_retry:true,reload_saved:true,errors:[]});await context.close();
 }}finally{await browser.close();server.close();}
await fs.writeFile('quality-results/boki-additions.json',JSON.stringify({source:'actual proposed sources, isolated localhost',evidence},null,2));
console.log('boki additions: 8 lessons, 8 quiz oracles; 16 lesson views/16 correct answers, wrong/retry/reload and 2 widths passed');
