import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {synchronize} from '../sync-page-discovery.mjs';
const origin='https://todoroki-gold.com';
const page=(name,title=name,extra='')=>`<html><head><title>${title}</title><link href="${origin}/${name}" rel="canonical">${extra}</head><body></body></html>`;
const root=await fs.mkdtemp(path.join(os.tmpdir(),'todoroki-discovery-'));let checks=0;
try{
 await fs.writeFile(path.join(root,'site-map.html'),page('site-map','Map').replace('</body>','<p id="page-search-count" role="status">1ページを掲載</p><div id="site-map-entries"><ul><li><a href="/site-map">Map</a></li></ul></div></main></body>'));
 await fs.writeFile(path.join(root,'sitemap.xml'),`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/site-map</loc><lastmod>2026-01-01</lastmod></url></urlset>`);
 const before=await fs.readFile(path.join(root,'sitemap.xml'),'utf8');
 assert.equal((await synchronize(root,{check:true})).changed,false);checks++;
 await fs.writeFile(path.join(root,'new-1234.html'),page('new-1234','A &amp; B &lt;example&gt;'));
 await fs.writeFile(path.join(root,'private.html'),page('private','private','<meta name="robots" content="noindex,nofollow">'));
 await fs.mkdir(path.join(root,'node_modules'));await fs.writeFile(path.join(root,'node_modules','not-public.html'),'fixture');
 await assert.rejects(()=>synchronize(root,{check:true}),/requires synchronization/);assert.equal(await fs.readFile(path.join(root,'sitemap.xml'),'utf8'),before);checks++;
 const result=await synchronize(root);assert.equal(result.pages,2);assert.equal(result.added_xml_urls,1);checks++;
 const xml=await fs.readFile(path.join(root,'sitemap.xml'),'utf8'),html=await fs.readFile(path.join(root,'site-map.html'),'utf8');
 assert.ok(xml.includes('<lastmod>2026-01-01</lastmod>'));assert.ok(!xml.includes('/private'));assert.ok(html.includes('A &amp; B &lt;example&gt;'));assert.ok(html.includes('>2ページを掲載</p>'));checks++;
 assert.equal((await synchronize(root)).changed,false);assert.equal(await fs.readFile(path.join(root,'site-map.html'),'utf8'),html);checks++;
 await fs.writeFile(path.join(root,'next-5678.html'),page('next-5678'));await synchronize(root);const next=await fs.readFile(path.join(root,'site-map.html'),'utf8');assert.equal((next.match(/id="generated-page-discovery"/g)||[]).length,1);assert.ok(next.includes('/new-1234')&&next.includes('/next-5678'));checks++;
 await fs.writeFile(path.join(root,'bad.html'),page('bad').replace(origin,'https://other.invalid'));await assert.rejects(()=>synchronize(root),/Invalid source canonical/);await fs.unlink(path.join(root,'bad.html'));checks++;
 await fs.writeFile(path.join(root,'sitemap.xml'),xml.replace('</urlset>',`<url><loc>${origin}/missing</loc></url></urlset>`));await assert.rejects(()=>synchronize(root),/review required/);checks++;
}finally{await fs.rm(root,{recursive:true,force:true});}
console.log(`T02 discovery sync: ${checks} isolated cases; additive, idempotent, noindex/asset exclusion, unsafe canonical rejection, no network.`);
