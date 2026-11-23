import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const origin = process.env.REVIVAL_BASE_URL ?? 'http://todoroki.local';
const local = !process.env.REVIVAL_BASE_URL;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
try {
  for (const width of [390,1440]) {
    const context = await browser.newContext({viewport:{width,height:900},hasTouch:width===390});
    await context.route('**/*',async route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (!local) return route.continue();
      if (url.pathname === '/api/privacy/region') return route.fulfill({json:{optionalAllowed:false}});
      if (url.pathname === '/') return route.fulfill({path:'index.html'});
      const path = '.'+url.pathname;
      const type = path.endsWith('.mjs') ? 'application/javascript' : undefined;
      try { await route.fulfill({path:/\.[a-z]+$/i.test(path) ? path : path+'.html',contentType:type}); }
      catch { await route.fulfill({status:404}); }
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror',error => errors.push(error.message));
    await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
    for (const [id,direction] of [['news-ticker','normal'],['archive-ticker','reverse']]) {
      const row = page.locator('#'+id);
      await row.waitFor();
      const track = row.locator('.news-ticker-track');
      await track.locator(':scope > div').nth(1).waitFor({state:'attached'});
      const motion = () => track.evaluate(element => {
        const css = getComputedStyle(element);
        return [css.transform,css.animationDirection];
      });
      assert.equal((await motion())[1],direction);
      const start = (await motion())[0];
      await page.waitForTimeout(180);
      assert.notEqual((await motion())[0],start);
      const stop = row.getByRole('button');
      await stop.press('Enter');
      const held = (await motion())[0];
      await page.waitForTimeout(180);
      assert.equal((await motion())[0],held);
      await stop.press('Enter');
      await page.waitForTimeout(180);
      assert.notEqual((await motion())[0],held);
    }
    const read = id => page.locator('#'+id+' .news-ticker-group:not([aria-hidden]) a').evaluateAll(links => links.map(link=>link.pathname));
    const newest = await read('news-ticker'), archive = await read('archive-ticker');
    assert.equal(newest.length,10);
    assert(archive.length && !archive.some(url=>newest.includes(url)));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
    await page.emulateMedia({reducedMotion:'reduce'});
    const archiveRow = page.locator('#archive-ticker');
    assert.equal(await archiveRow.locator('.news-ticker-track').evaluate(e=>getComputedStyle(e).animationName),'none');
    await archiveRow.locator('.news-ticker-group:not([aria-hidden]) a').first().press('Enter');
    await page.waitForURL(origin+archive[0]);
    await page.goto(origin+'/investment-list#reading-paths');
    assert((await page.locator('#reading-paths ol li').count())>5);
    await page.goto(origin+'/price-value');
    assert((await page.locator('main [data-article-event="related_article_click"]').count())>0);
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({width,newest:newest.length,archive:archive.length,directionAndPause:true,reducedMotion:true,realLinkNavigation:true}));
    await context.close();
  }
} finally { await browser.close(); }
