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
try {
  browser = await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  for (const [width, javascript] of [[320,false],[390,true],[1440,true]]) {
    const context = await browser.newContext({viewport:{width,height:900},javaScriptEnabled:javascript,hasTouch:width<600});
    await context.route('**/*', route => route.request().url().startsWith(origin+'/') ? route.continue() : route.abort());
    const page = await context.newPage();
    await page.goto(origin+'/behavioral-economics');
    const nav = page.locator('#behavior-study-roadmap');
    await nav.getByRole('link',{name:/第2部/}).press('Enter');
    await page.waitForURL('**/behavioral-economics#part-two-roadmap');
    await page.locator('#part-two-roadmap').getByRole('link',{name:'第3部へ進む'}).click();
    await page.waitForURL('**/behavioral-economics#part-three-roadmap');
    const part = page.locator('#part-three-roadmap');
    const cards = part.locator('.part-three-card');
    assert.equal(await cards.count(),6);
    const ol = part.locator('.part-one-cards');
    assert.equal(await ol.evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),width<681?1:2);
    const first = cards.first();
    const pdf = first.getByRole('link',{name:/情報処理のメカニズムのPDFを読む/});
    assert.ok((await pdf.boundingBox()).height>=44);
    const question=first.locator('summary').filter({hasText:/^確認問題$/});
    await question.press('Enter');
    const answer=first.locator('summary').filter({hasText:/^解答を見る$/});
    assert.equal(await answer.isVisible(),true);
    const solution=answer.locator('..').locator('p');
    assert.equal(await solution.isVisible(),false);
    await answer.press('Enter');
    assert.equal(await solution.isVisible(),true);
    await first.locator('summary').filter({hasText:/^理論・図解・事例$/}).press('Enter');
    assert.equal(await first.getByRole('heading',{name:'図解｜考える順序'}).isVisible(),true);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
    await first.getByRole('link',{name:/12｜プロスペクト理論/}).click();
    await page.waitForURL('**/behavioral-economics#part-three-chapter-12');
    const second=cards.nth(1);
    await second.locator('summary').filter({hasText:/^用語を確認する$/}).press('Enter');
    await second.getByRole('link',{name:'プロスペクト理論',exact:true}).click();
    await page.waitForURL('**/glossary#term-prospect-theory');
    await page.locator('#term-prospect-theory').getByRole('link',{name:/第3部 12/}).click();
    await page.waitForURL('**/behavioral-economics#part-three-chapter-12');
    await part.getByRole('link',{name:'行動経済学のPDF一覧'}).click();
    await page.waitForURL('**/pdf-library?category=*');
    const library=page.locator('#grid').getByRole('heading',{name:/行動経済学 第3部 1[1-6]/});
    assert.equal(await library.count(),6);
    if (javascript) {
      assert.equal(await page.locator('#category').inputValue(),'行動経済学');
      await page.locator('#search').fill('心理会計');
      assert.equal(await library.count(),1);
    }
    await page.goto(origin+'/behavioral-economics#part-three-chapter-12');
    await page.getByRole('link',{name:'日本企業分析ツールで財務を確認する'}).click();
    await page.waitForURL('**/#equity-research-tool');
    assert.equal(await page.locator('#equity-research-tool').count(),1);
    const guide=page.locator('#analysis-reading-guide');
    assert.equal(await guide.locator('ol').isVisible(),false);
    await guide.locator('summary').press('Enter');
    assert.equal(await guide.locator('li').count(),3);
    assert.equal(await guide.locator('ol').isVisible(),true);
    await guide.getByRole('link',{name:/参照点と判断の偏り/}).click();
    await page.waitForURL('**/behavioral-economics#part-three-chapter-12');
    await page.goto(origin + '/toto-5332-earnings-valuation-2026');
    const lens=page.locator('.valuation-lens');
    assert.ok(await lens.getByRole('heading',{name:/上向き/}).isVisible());
    assert.ok(await lens.getByRole('heading',{name:/下向き/}).isVisible());
    const conditions=lens.locator('.valuation-conditions');
    assert.equal(await conditions.evaluate(e => getComputedStyle(e).gridTemplateColumns.split(' ').length),width<561?1:2);
    const model=lens.locator('details');
    assert.equal(await model.locator('dl').isVisible(),false);
    await model.locator('summary').press('Enter');
    assert.equal(await model.locator('dl').isVisible(),true);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
    await model.getByRole('link',{name:/参照点と損失回避/}).click();
    await page.waitForURL('**/behavioral-economics#part-three-chapter-12');
    await context.close();
    console.log(`behavioral part 3: ${width}px (JS ${javascript?'on':'off'}) each navigation, keyboard disclosures, glossary, PDF library passed`);
  }
} finally {
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
