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

    const support=page.locator('header.site-header a.ofuse-header-button');
    assert.equal(await support.count(),1);
    assert(await support.isVisible());
    const supportImage=await support.locator('img').evaluate(async image=>{
      await image.decode();
      const box=image.getBoundingClientRect();
      return {loaded:image.naturalWidth>0,within:box.left>=0&&box.right<=innerWidth+1};
    });
    assert.deepEqual(supportImage,{loaded:true,within:true});

    for (const id of ['news-ticker', 'archive-ticker']) {
      const row = page.locator('#'+id);
      await row.waitFor();
      const track = row.locator('.news-ticker-track');
      await track.locator(':scope > div').nth(1).waitFor({state:'attached'});
      const motion = () => track.evaluate(element => {
        const css = getComputedStyle(element);
        return [css.transform,css.animationDirection,css.animationPlayState,element.getAnimations()[0]?.currentTime];
      });
      assert.equal((await motion())[1],'normal');
      const geometry = await track.evaluate(element => ({
        coverage: element.getBoundingClientRect().width / 2,
        viewport: element.parentElement.clientWidth,
        groupWidth: element.firstElementChild.getBoundingClientRect().width,
        copies: [...element.querySelectorAll('[aria-hidden] a')].every(link => link.tabIndex === -1),
      }));
      assert(geometry.coverage >= geometry.viewport);
      assert(geometry.copies);
      if (sparse) assert(geometry.groupWidth < geometry.viewport);
      if (width >= 500) {
        const viewport = await row.locator('.news-ticker-window').boundingBox();
        await page.mouse.move(viewport.x + viewport.width / 2, viewport.y + viewport.height / 2);
        assert.equal((await motion())[2], 'running');
      }
      const start = (await motion())[0];
      for (let attempt = 0; attempt < 10 && (await motion())[0] === start; attempt++) {
        await page.waitForTimeout(150);
      }
      assert.notEqual((await motion())[0],start,JSON.stringify({width,id,motion:await motion()}));
      assert.equal(await row.locator('button').count(), 0);
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
        const distance = Number.parseFloat(getComputedStyle(element).getPropertyValue('--ticker-distance'));
        const position = time => {
          animation.currentTime = time;
          const progress = animation.effect.getComputedTiming().progress;
          return progress === null ? NaN : distance * progress;
        };
        const gaps = [];
        for (let loop = 1; loop <= 3; loop++) {
          const before = position(loop * duration - step);
          const after = position(loop * duration + step);
          gaps.push(Math.abs(Math.abs(after - before) - expectedJump));
        }
        return gaps;
      });
      assert(seams.every(gap => gap < 2), JSON.stringify({width,seams}));
    }
    await page.reload({waitUntil:'domcontentloaded'});
    const motionReady = () => page.waitForFunction(() => {
      const rows = [...document.querySelectorAll('.news-ticker')];
      return rows.length === 2 && rows.every(row => {
        const css = getComputedStyle(row.querySelector('.news-ticker-track'));
        return css.animationName === 'todoroki-ticker' && css.animationPlayState === 'running';
      });
    }, null, {timeout:5000});
    const readTransforms = () => page.locator('.news-ticker-track').evaluateAll(
      tracks => tracks.map(track => getComputedStyle(track).transform)
    );
    for (const reducedMotion of ['no-preference', 'reduce', 'no-preference']) {
      await page.emulateMedia({reducedMotion});
      await motionReady();
      const initial = await readTransforms();
      await page.waitForFunction(before => [...document.querySelectorAll('.news-ticker-track')]
        .every((track,i) => getComputedStyle(track).transform !== before[i]), initial, {timeout:5000});
    }
    // Kept separate from autoplay: keyboard focus stops only the focused row
    // while exposing its real links. Playback returns when focus leaves.
    await page.keyboard.press('Tab');
    for (const id of ['news-ticker', 'archive-ticker']) {
      const row = page.locator('#'+id);
      const track = row.locator('.news-ticker-track');
      const link = row.locator('.news-ticker-group:not([aria-hidden]) a').first();
      await link.focus();
      assert(await link.evaluate(anchor => anchor.matches(':focus-visible')));
      assert.equal(await track.evaluate(e => getComputedStyle(e).animationName), 'none');
      assert.equal(await row.locator('.news-ticker-window').evaluate(e => getComputedStyle(e).overflowX), 'auto');
      assert.equal(await row.locator('.news-ticker-group[aria-hidden="true"]:visible').count(), 0);
      assert.equal(await page.locator('.news-ticker:not(#'+id+') .news-ticker-track').evaluate(e => getComputedStyle(e).animationName), 'todoroki-ticker');
      await link.blur();
      await motionReady();
    }
    const archiveRow = page.locator('#archive-ticker');
    await archiveRow.locator('.news-ticker-group:not([aria-hidden]) a').first().press('Enter');
    await page.waitForURL(origin+archive[0]);
    await page.goto(origin+'/investment-list#reading-paths');
    assert((await page.locator('#reading-paths ol li').count())>5);
    await page.goto(origin+'/price-value');
    assert((await page.locator('main [data-article-event="related_article_click"]').count())>0);
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({width,newest:newest.length,archive:archive.length,sameDirection:true,autoplayWithBothMotionSettings:true,keyboardFocusStopsRow:true,realLinkNavigation:true}));
    await context.close();
  }
} finally { await browser.close(); }
