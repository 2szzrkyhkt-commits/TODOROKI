import assert from 'node:assert/strict';
import {chromium, webkit} from 'playwright';

const origin = process.env.REVIVAL_BASE_URL ?? 'http://todoroki.local';
const local = !process.env.REVIVAL_BASE_URL;
const engine = process.env.PLAYWRIGHT_ENGINE === 'webkit' ? webkit : chromium;
const browser = await engine.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
try {
  for (const width of [390, 412, 1440, ...(local ? [1920] : [])]) {
    const sparse = width === 1920;
    const context = await browser.newContext({viewport:{width,height:900},hasTouch:width < 500});
    await context.route('**/*',async route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (!local) return route.continue();
      if (url.pathname === '/api/privacy/region') return route.fulfill({json:{optionalAllowed:false}});
      if (url.pathname === '/') {
        if (!sparse) return route.fulfill({path:'index.html'});
        const {readFile} = await import('node:fs/promises');
        const html = await readFile('index.html', 'utf8');
        return route.fulfill({contentType:'text/html', body:html.replace('</body>', `<script>
          const cards = document.querySelectorAll('#home-article-catalog > .card-link');
          cards.forEach((card, index) => { if (index) card.remove(); });
          const archiveData = document.querySelector('#archive-article-data');
          const data = JSON.parse(archiveData.textContent);
          data.candidates = data.candidates.slice(0, 2).map(entry => ({...entry, date:'2020-01-01'}));
          archiveData.textContent = JSON.stringify(data);
        </script></body>`)});
      }
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
        return [css.transform,css.animationDirection,css.animationPlayState,element.getAnimations()[0]?.currentTime];
      });
      assert.equal((await motion())[1],direction);
      const geometry = await track.evaluate(element => ({
        coverage: element.getBoundingClientRect().width / 2,
        viewport: element.parentElement.clientWidth,
        groupWidth: element.firstElementChild.getBoundingClientRect().width,
        copies: [...element.querySelectorAll('[aria-hidden] a')].every(link => link.tabIndex === -1),
      }));
      assert(geometry.coverage >= geometry.viewport);
      assert(geometry.copies);
      if (sparse) assert(geometry.groupWidth < geometry.viewport);
      const start = (await motion())[0];
      for (let attempt = 0; attempt < 10 && (await motion())[0] === start; attempt++) {
        await page.waitForTimeout(150);
      }
      assert.notEqual((await motion())[0],start,JSON.stringify({width,id,motion:await motion()}));
      const stop = row.getByRole('button');
      await stop.press('Enter');
      await track.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(await track.evaluate(e=>getComputedStyle(e).animationPlayState),'paused');
      const held = (await motion())[0];
      await page.waitForTimeout(180);
      assert.equal((await motion())[0],held);
      await stop.press('Enter');
      await page.waitForTimeout(180);
      assert.notEqual((await motion())[0],held);
    }
    if (width < 500) {
      await page.setViewportSize({width:850,height:width});
      await page.waitForTimeout(200);
      await page.setViewportSize({width,height:900});
      const transforms = () => page.locator('.news-ticker-track').evaluateAll(tracks =>
        tracks.map(track => getComputedStyle(track).transform));
      const before = await transforms();
      await page.waitForTimeout(250);
      assert((await transforms()).every((transform,index) => transform !== before[index]));
    }
    const read = id => page.locator('#'+id+' .news-ticker-group:not([aria-hidden]) a').evaluateAll(links => links.map(link=>link.pathname));
    const newest = await read('news-ticker'), archive = await read('archive-ticker');
    assert.equal(newest.length,sparse ? 1 : 10);
    assert(archive.length && !archive.some(url=>newest.includes(url)));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
    if (width === 1440 && process.env.TICKER_LONG_SMOKE === '1') {
      const times = () => page.locator('.news-ticker-track').evaluateAll(tracks =>
        tracks.map(track => track.getAnimations()[0].currentTime));
      const start = await times();
      await page.waitForTimeout(31_000);
      assert((await times()).every((time, index) => time - start[index] >= 30_000));
    }
    // Seek through the seam only after checking natural motion. Seeking can reset
    // the CSS animation's playback state on WebKit.
    for (const track of await page.locator('.news-ticker-track').all()) {
      const seams = await track.evaluate(async element => {
        const animation = element.getAnimations()[0];
        const duration = animation.effect.getTiming().duration;
        const half = element.getBoundingClientRect().width / 2;
        const step = 50;
        const expectedJump = half * (1 - 2 * step / duration);
        animation.pause();
        await animation.ready;
        const position = async time => {
          animation.currentTime = time;
          await new Promise(resolve => requestAnimationFrame(resolve));
          return new DOMMatrix(getComputedStyle(element).transform).m41;
        };
        const gaps = [];
        for (let loop = 1; loop <= 3; loop++) {
          const before = await position(loop * duration - step);
          const after = await position(loop * duration + step);
          gaps.push(Math.abs(Math.abs(after - before) - expectedJump));
        }
        return gaps;
      });
      assert(seams.every(gap => gap < 2), JSON.stringify({width,seams}));
    }
    await page.emulateMedia({reducedMotion:'reduce'});
    const archiveRow = page.locator('#archive-ticker');
    assert.equal(await archiveRow.locator('.news-ticker-track').evaluate(e=>getComputedStyle(e).animationName),'none');
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.waitForFunction(() => [...document.querySelectorAll('.news-ticker-track')].every(track => track.getAnimations().length === 1));
    await page.emulateMedia({reducedMotion:'reduce'});
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
