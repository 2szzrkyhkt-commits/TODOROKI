import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = http.createServer(async (req, res) => {
  try {
    let pathname = decodeURIComponent(new URL(req.url, 'http://local').pathname);
    if (pathname === '/') pathname = '/index.html';
    else if (!path.extname(pathname)) pathname += '.html';
    const local = path.resolve(root, '.' + pathname);
    if (path.relative(root, local).startsWith('..')) throw Error('Outside local fixture');
    const type = {'.js':'text/javascript','.css':'text/css','.json':'application/json','.pdf':'application/pdf'}[path.extname(local)] || 'text/html; charset=utf-8';
    const body = await fs.readFile(local);
    res.writeHead(200, {'Content-Type':type}).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const origin = 'http://127.0.0.1:' + server.address().port;
let browser;
const KEY='todoroki.behavior-study.v1';
const live=process.env.STUDY_LIVE_ORIGIN;
try {
  browser=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH}: {});
  for(const [width,mode] of [[320,'off'],[390,'declined'],[800,'allowed'],[1440,'gpc']]){
    const ctx=await browser.newContext({viewport:{width,height:900},javaScriptEnabled:mode!=='off'});
    const site=live || origin;
    const errors=[];
    const events=[];
    await ctx.route('**/*', async route=>{
      const url=route.request().url();
      if(mode==='allowed' && !live && url===site+'/api/privacy/region') return route.fulfill({json:{optionalAllowed:true}});
      if(url.startsWith(site+'/')) return route.continue();
      events.push(url);
      return route.abort();
    });
    if(mode==='gpc') await ctx.addInitScript(()=>{Object.defineProperty(navigator,'globalPrivacyControl',{value:true}); window.gtag=(...args)=>{window.events??=[]; window.events.push(args)};});
    if(mode==='allowed' && !live) await ctx.addInitScript(()=>{
      localStorage.setItem('todoroki_privacy_v1',JSON.stringify({version:1,time:Date.now(),analytics:true,ads:false}));
    });
    const p=await ctx.newPage();
    p.on('pageerror', e=>errors.push(String(e)));
    await p.goto(site+'/behavioral-economics#chapter-17',{waitUntil:'domcontentloaded'});
    const cards=p.locator('[data-study-chapter]');
    assert.equal(await cards.count(),20);
    assert.deepEqual(await cards.evaluateAll(es=>es.map(e=>Number(e.dataset.studyChapter))),Array.from({length:20},(_,i)=>i+1));
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),width);
    const ch=cards.nth(16);
    const quiz=ch.getByText('確認問題',{exact:true});
    await quiz.press('Enter');
    if(mode==='off'){
      assert.equal(await ch.locator('form').isVisible(),false);
      await ch.getByText('解答を見る',{exact:true}).press('Enter');
      assert.ok(await ch.locator('details[open] details[open] p').isVisible());
    } else {
      const analyticsAllowed=mode==='allowed' && !live;
      if(analyticsAllowed) await p.waitForFunction(()=>typeof window.gtag==='function');
      assert.equal(await p.evaluate(k=>localStorage.getItem(k),KEY),null);
      const panel=p.locator('#behavior-study-progress');
      if(!live) await panel.getByText('この端末に進捗を保存する').click();
      const form=ch.locator('form');
      assert.equal(await form.locator('input').count(),3);
      const correct=await form.getAttribute('data-answer');
      await form.locator('input').nth((Number(correct)+1)%3).check();
      await form.getByRole('button').click();
      assert.match(await form.locator('output').innerText(),/復習候補/);
      assert.equal(await panel.getByRole('link',{name:'第17章を復習'}).count(),1);
      await ch.getByText('学習済みにする',{exact:false}).click();
      assert.match(await panel.locator('[data-study-status]').innerText(),/1 \/ 20章/);
      if(!live){
        const log=await p.evaluate(()=>Array.from(window.dataLayer??[],e=>Array.from(e)).filter(e=>String(e[1]).startsWith('be_study')));
        if(analyticsAllowed) assert.deepEqual(log,[['event','be_study_quiz_submit',{chapter_id:'17'}],['event','be_study_complete',{chapter_id:'17'}]]);
        else assert.equal(log.length,0);
        if(mode==='gpc') assert.equal(await p.evaluate(()=>window.events?.length||0),0);
        await p.reload({waitUntil:'domcontentloaded'});
        assert.match(await panel.locator('[data-study-status]').innerText(),/1 \/ 20章/);
        const reloadCard=p.locator('[data-study-chapter="17"]');
        await reloadCard.getByText('確認問題',{exact:true}).press('Enter');
        await reloadCard.locator('form input').nth(Number(correct)).check();
        await reloadCard.locator('form button').click();
        assert.match(await reloadCard.locator('output').innerText(),/正解/);
        assert.equal(await panel.getByRole('link',{name:'第17章を復習'}).count(),0);
        await panel.getByRole('button',{name:'進捗を消去する'}).click();
        assert.equal(await p.evaluate(k=>localStorage.getItem(k),KEY),null);
        assert.match(await panel.locator('[data-study-status]').innerText(),/0 \/ 20章/);
      } else assert.equal(await p.evaluate(k=>localStorage.getItem(k),KEY),null);
    }
    await ch.getByRole('link',{name:'第18章へ →'}).click();
    await p.waitForURL('**/behavioral-economics#chapter-18');
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),width);
    assert.deepEqual(errors,[]);
    if(!live && mode!=='allowed') assert.ok(!events.some(x=>x.includes('googletagmanager')));
    await ctx.close();
    console.log(`${width}px ${mode}: 20 chapters; navigation; exercise; storage and privacy conditions passed`);
  }
} finally {
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
