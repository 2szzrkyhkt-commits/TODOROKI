import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {dirname, extname, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const slugs=['/valuation-per-pbr','/fundamental-analysis','/financial-statements-basics'];
const destination='https://ofuse.me/todoroki_gold';
const server=createServer(async(req,res)=>{
  try {
    assert.equal(req.method,'GET');
    const path=new URL(req.url,'http://127.0.0.1').pathname;
    if(path==='/api/privacy/region')return res.writeHead(200,{'Content-Type':'application/json'}).end('{"optionalAllowed":false}');
    const file=resolve(root,'.'+(slugs.includes(path)?path+'.html':path));
    if(!file.startsWith(root+sep)||(!slugs.includes(path)&&!path.startsWith('/assets/'))) return res.writeHead(404).end();
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
  for(const slug of slugs)for(const [width,javascript] of [[320,false],[390,true],[1440,true]]){
    const external=[];
    const context=await browser.newContext({viewport:{width,height:900},javaScriptEnabled:javascript});
    await context.route('**/*',async r=>{
      const request=r.request(),u=request.url();
      if(u.startsWith(origin+'/'))return r.continue();
      if(u===destination){
        external.push({method:request.method(),body:request.postData()});
        return r.fulfill({status:200,contentType:'text/html; charset=utf-8',body:'<title>Navigation fixture only</title><p>No external action</p>'});
      }
      return r.abort();
    });
    const page=await context.newPage();
    await page.goto(origin+slug);
    const support=page.locator(javascript?'header.site-header .todoroki-support':'main .article-ofuse');
    const button=support.getByRole('link',{name:'とどろきを応援する',exact:true});
    assert.equal(await button.count(),1);
    assert.equal(await button.getAttribute('href'),destination);
    assert.equal(await page.locator('a[href="'+destination+'"]').count(),1);
    if(javascript){
      assert.equal(await page.locator('main .article-ofuse').count(),0);
      const image=button.getByRole('img',{name:'とどろきを応援する',exact:true});
      assert.equal(await image.getAttribute('src'),'/assets/todoroki-ofuse-button-3.png');
      await image.evaluate(i=>i.decode());
      assert.ok(await image.evaluate(i=>i.naturalWidth>0));
    }else{
      assert.equal(await support.getByText('記事やツールが役に立ったら、任意で応援できます。',{exact:true}).isVisible(),true);
      assert.equal(await support.getByText('OFUSEが開きます',{exact:true}).isVisible(),true);
      assert.equal(await support.evaluate(e=>e.nextElementSibling.querySelector('h2').textContent),'関連記事');
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
    assert.deepEqual(external,[{method:'GET',body:null}]);
    assert.equal(await page.title(),'Navigation fixture only');
    await context.close();
    console.log(`OFUSE ${slug}: ${width}px, JS ${javascript?'on':'off'}, one visible control, Tab/Enter, mocked GET only`);
  }
} finally {
  await browser?.close();
  await new Promise(done=>server.close(done));
}
