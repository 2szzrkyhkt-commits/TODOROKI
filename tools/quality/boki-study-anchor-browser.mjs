import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {dirname, extname, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const engine=process.env.PLAYWRIGHT_ENGINE||'chromium';
assert.ok(engine==='chromium'||engine==='webkit');
const playwright=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const article='/financial-statements-basics', course='/boki1';
const server=createServer(async(req,res)=>{
  try{
    if(req.method!=='GET') return res.writeHead(405).end();
    const path=new URL(req.url,'http://127.0.0.1').pathname;
    if(path==='/api/privacy/region')return res.writeHead(200,{'Content-Type':'application/json'}).end('{"optionalAllowed":false}');
    const isPage=path===article||path===course;
    const file=resolve(root,'.'+(isPage?path+'.html':path));
    if(!file.startsWith(root+sep)||(!isPage&&!path.startsWith('/assets/')))return res.writeHead(404).end();
    const mime={'.css':'text/css','.js':'text/javascript','.html':'text/html; charset=utf-8'};
    const data=await readFile(file);
    res.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream'}).end(data);
  }catch{if(!res.headersSent)res.writeHead(404);res.end();}
});
await new Promise((done,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',done);});
const origin='http://127.0.0.1:'+server.address().port;
const destination=origin+course+'#learn';
function geometry(){
  const header=document.querySelector('header.site-header');
  const heading=document.querySelector('#learn h2');
  const link=document.querySelector('#boki-to-statements');
  const headerRect=header.getBoundingClientRect(),headRect=heading.getBoundingClientRect();
  const range=document.createRange();range.selectNodeContents(heading);
  const text=range.getBoundingClientRect(),back=link.getBoundingClientRect();
  const atHeading=document.elementFromPoint(text.left+8,(text.top+text.bottom)/2);
  const linkFragments=Array.from(link.getClientRects()).filter(rect=>rect.height>0&&rect.width>0);
  const returnUncovered=linkFragments.length>0&&linkFragments.every(rect=>
    document.elementFromPoint(rect.left+Math.min(rect.width/2,8),(rect.top+rect.bottom)/2)?.closest('a')===link);
  return {headerBottom:headerRect.bottom,headerHeight:headerRect.height,headingTop:headRect.top,
    headingBottom:headRect.bottom,textTop:text.top,linkTop:back.top,viewportHeight:innerHeight,
    visibleHeading:atHeading?.closest('h2')===heading,visibleReturn:returnUncovered,scrollY,
    sticky:getComputedStyle(header).position,margin:getComputedStyle(heading.parentElement).scrollMarginTop};
}
async function checkLanding(page,label,headerHeight){
  const data=await page.evaluate(geometry);
  assert.equal(data.sticky,'sticky',label);
  assert.equal(data.headerHeight,headerHeight,label+' header size should not change');
  assert.ok(data.headingTop>=data.headerBottom+6&&data.headingBottom<data.viewportHeight,label+' '+JSON.stringify(data));
  assert.ok(data.linkTop>=data.headerBottom&&data.visibleHeading&&data.visibleReturn,label+' '+JSON.stringify(data));
  assert.equal(page.url(),destination);
  console.log(label+' '+JSON.stringify(data));
}
async function checkLeaseScope(page,label){
  await page.locator('#scope-review > summary').click();
  const year=page.locator('#scope-year');
  const row=async selected=>{
    await year.selectOption(String(selected));
    const result=page.locator('#scope-rows .scope-row').filter({hasText:'リース（'+selected+'年度）'});
    assert.equal(await result.count(),1,label+' year row '+selected);
    await result.locator('summary').click();
    return result;
  };
  const old=await row(2026);
  assert.match(await old.innerText(),/2026年度に対応する関連教材：解説1件／問題0問/);
  assert.match(await old.innerText(),/この年度の関連問題は未掲載です/);
  assert.equal(await old.getByRole('button',{name:'関連する問題を開く',exact:true}).count(),0);
  await old.getByRole('button',{name:'関連する解説を開く',exact:true}).click();
  assert.match(await page.locator('#count').innerText(),/^2026年度（リース）｜1件/);
  assert.match(await page.locator('#cards').innerText(),/年度別に借手の区分/);
  assert.doesNotMatch(await page.locator('#cards').innerText(),/借手の利息法と元本返済/);
  await page.locator('[data-view="quiz"]').click();
  assert.match(await page.locator('#quiz-count').innerText(),/^2026年度（リース）｜0問/);
  assert.equal((await page.locator('#questions').innerText()).trim(),'');
  const current=await row(2027);
  assert.match(await current.innerText(),/2027年度に対応する関連教材：解説2件／問題2問/);
  await current.getByRole('button',{name:'関連する解説を開く',exact:true}).click();
  assert.match(await page.locator('#count').innerText(),/^2027年度（リース）｜2件/);
  assert.match(await page.locator('#cards').innerText(),/借手の利息法と元本返済/);
  await current.getByRole('button',{name:'関連する問題を開く',exact:true}).click();
  assert.match(await page.locator('#quiz-count').innerText(),/^2027年度（リース）｜2問/);
  assert.match(await page.locator('#questions').innerText(),/2027年度/);
  await page.getByRole('button',{name:'年度の絞り込みを解除',exact:true}).click();
  assert.match(await page.locator('#quiz-count').innerText(),/^2問/);
  console.log(label+' lease year scope: 2026 1 lesson/0 questions, 2027 2/2, clear filter');
}
let browser;
try{
  browser=await playwright[engine].launch(engine==='chromium'&&process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
  for(const [width,height] of [[375,667],[390,844],[1440,900]]){
    const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
    await context.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
    const page=await context.newPage();
    await page.goto(origin+course);
    const normal=await page.evaluate(geometry);
    const heightBefore=normal.headerHeight;
    assert.equal(normal.sticky,'sticky');
    assert.equal(normal.scrollY,0);
    assert.equal(await page.getByRole('heading',{name:'簿記1級 学習ノート',exact:true}).isVisible(),true);
    await page.goto(origin+article);
    await Promise.all([page.waitForURL(destination),page.locator('#statements-to-boki').click()]);
    await checkLanding(page,engine+' '+width+'px article click',heightBefore);
    await page.reload();
    await checkLanding(page,engine+' '+width+'px reload',heightBefore);
    const fresh=await context.newPage();
    await fresh.goto(destination);
    await checkLanding(fresh,engine+' '+width+'px direct',heightBefore);
    await Promise.all([fresh.waitForURL(origin+article),fresh.locator('#boki-to-statements').click()]);
    assert.equal(await fresh.getByRole('heading',{name:'決算書の見方｜利益・財務・現金をつなげて読む',exact:true}).isVisible(),true);
    await fresh.goto(origin+course);
    await checkLeaseScope(fresh,engine+' '+width+'px');
    await context.close();
  }
}finally{
  await browser?.close();
  await new Promise(done=>server.close(done));
}
