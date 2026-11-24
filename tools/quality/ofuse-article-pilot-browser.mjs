import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {dirname, extname, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const slugs=['/valuation-per-pbr','/fundamental-analysis','/financial-statements-basics'];
const pages=['/', '/boki1', ...slugs];
const destination='https://ofuse.me/todoroki_gold';
const server=createServer(async(req,res)=>{
  try {
    assert.equal(req.method,'GET');
    const path=new URL(req.url,'http://127.0.0.1').pathname;
    if(path==='/api/privacy/region')return res.writeHead(200,{'Content-Type':'application/json'}).end('{"optionalAllowed":false}');
    const file=resolve(root,'.'+(path==='/'?'/index.html':pages.includes(path)?path+'.html':path));
    if(!file.startsWith(root+sep)||(!pages.includes(path)&&!path.startsWith('/assets/'))) return res.writeHead(404).end();
    const mime={'.css':'text/css','.js':'text/javascript','.html':'text/html; charset=utf-8','.png':'image/png'};
    res.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream'}).end(await readFile(file));
  } catch { if(!res.headersSent)res.writeHead(404);res.end(); }
});
await new Promise((accept,reject)=>{
  server.once('error',reject);server.listen(0,'127.0.0.1',accept);
});
const origin='http://127.0.0.1:'+server.address().port;
let browser;
try {
  browser=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
  for(const slug of slugs)for(const [width,javascript] of [[320,false],[320,true],[390,true],[1440,true]]){
    const external=[];
    const context=await browser.newContext({viewport:{width,height:900},javaScriptEnabled:javascript,reducedMotion:'reduce'});
    await context.route('**/*',async r=>{
      const request=r.request(),u=request.url();
      if(u.startsWith(origin+'/'))return r.continue();
      if(new URL(u).hostname==='ofuse.me')external.push({url:u,method:request.method(),body:request.postData()});
      if(u===destination){
        return r.fulfill({status:200,contentType:'text/html; charset=utf-8',body:'<title>Navigation fixture only</title><p>No external action</p>'});
      }
      return r.abort();
    });
    const page=await context.newPage();
    await page.goto(origin+slug);
    const support=page.locator(javascript?'header.site-header .todoroki-support':'main .article-ofuse');
    const button=support.getByRole('link',{name:'とどろきを応援する',exact:true});
    assert.equal(await page.locator(`a[href="${destination}"]`).count(),1,'Exactly one profile link');
    assert.equal(await button.count(),1);
    assert.equal(await button.isVisible(),true);
    assert.equal(await button.getAttribute('href'),destination);
    assert.match(await button.getAttribute('rel'),/\bnoreferrer\b/);
    if(javascript){
      assert.equal(await page.locator('main .article-ofuse').count(),0,'No duplicate article card after enhancement');
      const image=button.getByRole('img',{name:'とどろきを応援する',exact:true});
      assert.equal(await image.count(),1);
      assert.ok(await image.evaluate(async e=>{try{await e.decode();return e.naturalWidth>0;}catch{return false;}}),'Local support image loaded');
      await page.evaluate(()=>window.scrollTo(0,400));
      const header=await page.locator('header.site-header').evaluate(e=>({
        top:e.getBoundingClientRect().top,position:getComputedStyle(e).position,scrollY
      }));
      assert.equal(header.position,'sticky');
      assert.ok(header.scrollY>0&&Math.abs(header.top)<=1,'Header stays visible after scrolling');
    }else{
      assert.equal(await support.getByText('記事やツールが役に立ったら、任意で応援できます。',{exact:true}).isVisible(),true);
      assert.equal(await support.getByText('OFUSEが開きます',{exact:true}).isVisible(),true);
      assert.equal(await support.evaluate(e=>e.nextElementSibling.querySelector('h2').textContent),'関連記事');
      assert.equal(await button.getAttribute('aria-describedby'),'article-ofuse-intro article-ofuse-external');
    }
    assert.deepEqual(external,[],'No OFUSE request on viewing the article');
    await button.press('Shift+Tab');
    assert.equal(await button.evaluate(e=>document.activeElement===e),false);
    await page.keyboard.press('Tab');
    assert.equal(await button.evaluate(e=>document.activeElement===e&&e.matches(':focus-visible')),true);
    assert.equal(await button.evaluate(e=>getComputedStyle(e).outlineStyle),'solid');
    const rect=await button.boundingBox();
    assert.ok(rect && rect.height>=44 && rect.x>=0 && rect.x+rect.width<=width+1);
    assert.equal(await support.evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);
    await Promise.all([page.waitForURL(destination),page.keyboard.press('Enter')]);
    assert.deepEqual(external,[{url:destination,method:'GET',body:null}]);
    assert.equal(await page.title(),'Navigation fixture only');
    await context.close();
    console.log(`OFUSE ${slug}: ${width}px, JS ${javascript?'on':'off'}, ${javascript?'sticky accessible profile':'visible disclosure and fallback'}, Tab/Enter, mocked GET only`);
  }
  for (const width of [320, 375, 1200, 1201, 1440]) {
    const context=await browser.newContext({viewport:{width,height:850},reducedMotion:'reduce'});
    await context.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
    const page=await context.newPage();
    const links=page.locator(`a[href="${destination}"]`);
    const header=page.locator('header.site-header');
    const assertSingleSupport=async()=>{
      assert.equal(await links.count(),1);
      assert.equal(await header.locator(`a[href="${destination}"]`).isVisible(),true);
    };
    const assertClear=async selector=>{
      await page.waitForFunction(selector=>{
        const target=document.querySelector(selector).getBoundingClientRect();
        const bottom=document.querySelector('header.site-header').getBoundingClientRect().bottom;
        return target.top>=bottom && target.bottom<=innerHeight;
      },selector);
    };
    await page.goto(origin+'/');
    await assertSingleSupport();
    await page.goto(origin+'/financial-statements-basics');
    await page.locator('a[href="/boki1#learn"]').click();
    await page.waitForURL('**/boki1#learn');
    await assertClear('#learn h2');
    await assertSingleSupport();
    await page.reload();
    await assertClear('#learn h2');
    await assertSingleSupport();
    // Pagination is intentionally hidden until a topic with enough results is selected.
    await page.locator('#lesson-topic').selectOption('総論');
    const lessonNext=page.locator('#lesson-next');
    const lessonPage=page.locator('#lesson-page');
    assert.equal(await lessonNext.isVisible(),true);
    assert.equal(await lessonNext.isEnabled(),true);
    assert.match(await lessonPage.innerText(),/^1 \/ (?:[2-9]|[1-9]\d+)ページ$/);
    await lessonNext.click();
    assert.match(await lessonPage.innerText(),/^2 \/ (?:[2-9]|[1-9]\d+)ページ$/);
    await assertClear('#count');
    await page.locator('[data-view="quiz"]').click();
    assert.equal(await page.locator('#quiz-topic').inputValue(),'総論');
    const quizNext=page.locator('#quiz-next');
    const quizPage=page.locator('#quiz-page');
    assert.equal(await quizNext.isVisible(),true);
    assert.equal(await quizNext.isEnabled(),true);
    assert.match(await quizPage.innerText(),/^1 \/ (?:[2-9]|[1-9]\d+)ページ$/);
    await quizNext.click();
    assert.match(await quizPage.innerText(),/^2 \/ (?:[2-9]|[1-9]\d+)ページ$/);
    await assertClear('#quiz h2');
    const scope=page.locator('#scope-review');
    assert.equal(await scope.evaluate(e=>e.open),false);
    await scope.locator(':scope > summary').click();
    assert.equal(await scope.evaluate(e=>e.open),true);
    await page.locator('#scope-year').selectOption('2027');
    assert.equal(await page.locator('#scope-year').inputValue(),'2027');
    await context.close();
    console.log(`Bookkeeping: ${width}px, lesson and quiz clear the sticky header, single support link`);
  }

} finally {
  await browser?.close();
  await new Promise(done=>server.close(done));
}
