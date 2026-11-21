import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://local').pathname);
    if (!path.extname(p)) p += '.html';
    const local = path.resolve(root, '.' + p);
    if (!local.startsWith(root)) throw Error('Outside fixture');
    const type = {'.js':'text/javascript','.css':'text/css','.json':'application/json','.pdf':'application/pdf'}[path.extname(p)] ?? 'text/html; charset=utf-8';
    const bytes = await fs.readFile(local);
    res.setHeader('Content-Type', type);
    res.end(bytes);
  } catch { res.writeHead(404).end(); }
});
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const origin = 'http://127.0.0.1:' + server.address().port;
let browser;
try {
  browser = await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  for (const [width, javascript] of [[320,false],[390,true],[1440,true]]) {
    const context = await browser.newContext({viewport:{width,height:900},javaScriptEnabled:javascript});
    await context.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
    const page = await context.newPage();
    await page.goto(origin + '/behavioral-economics');
    const roadmap = page.locator('#part-one-roadmap');
    const cards = roadmap.locator('[id^=part-one-pdf-]');
    assert.equal(await cards.count(),6);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
    const columns = await roadmap.locator('.part-one-cards').filter({has:page.locator('#part-one-pdf-01')}).evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length);
    assert.equal(columns,width<681?1:2);
    const link = cards.first().getByRole('link',{name:/期待効用理論のPDF/});
    assert.ok((await link.boundingBox()).height>=44);
    await cards.first().getByRole('link',{name:'ウェブ解説'}).press('Enter');
    await page.waitForURL('**/behavioral-economics#uncertainty');
    assert.ok(await page.locator('#uncertainty h2').isVisible());
    const details = page.locator('#fundamentals .part-one-detail');
    assert.equal(await details.getAttribute('open'),null);
    await details.locator('summary').press('Enter');
    assert.notEqual(await details.getAttribute('open'),null);
    await cards.first().getByRole('link',{name:'期待効用理論',exact:true}).click();
    await page.waitForURL('**/glossary#term-expected-utility');
    const back = page.locator('#term-expected-utility').getByRole('link',{name:/期待効用理論の教材/});
    await back.click();
    await page.waitForURL('**/behavioral-economics#part-one-pdf-01');
    await roadmap.getByRole('link',{name:'行動経済学のPDF一覧'}).click();
    await page.waitForURL('**/pdf-library?category=*');
    assert.equal(await page.locator('#grid h2').filter({hasText:/行動経済学 第1部 0/}).count(), 6);
    await context.close();
    console.log(`behavioral part 1: ${width}px, JavaScript ${javascript ? 'on' : 'off'}, six cards and keyboard links passed`);
  }
} finally {
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
