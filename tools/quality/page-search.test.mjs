import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {normalizeSearch,matchesPage,pageLanguage} from '../../assets/page-search.mjs';
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
eq(normalizeSearch(' ＮＶＩＤＩＡ　５２３３ '),'nvidia 5233');eq(normalizeSearch('セメント'),'せめんと');
for(const [text,path,q,lang,expected] of [
 ['太平洋セメント','/taiheiyo-cement-5233-valuation-2026-nov','太平洋 ５２３３','all',true],
 ['太平洋セメント','/taiheiyo-cement-5233-valuation-2026-nov','せめんと','ja',true],
 ['NVIDIAの人事','/nvidia','ｎｖｉｄｉａ 人事','all',true],
 ['NVIDIAの人事','/nvidia','nvidia 不明語','all',false],
 ['Business','/en/business-list','business','en',true],
 ['Business','/en/business-list','business','ja',false],
 ['安全域','/zh-Hant/margin-of-safety','','zh-Hant',true],
 ['安全域','/zh-Hant/margin-of-safety','','zh-Hans',false],
 ['一般','/about','%_.*[','all',false],
 ['100%','/about','%','all',true],
 ['一般','/about','   ','all',true]
 ])eq(matchesPage(text,path,q,lang),expected);
for(const l of ['en','es','pt','zh-Hans','zh-Hant'])eq(pageLanguage('/'+l+'/'),l);
eq(pageLanguage('/envelope-basics'),'ja');
const html=await fs.readFile('site-map.html','utf8'),xml=await fs.readFile('sitemap.xml','utf8');
const entries=html.split('<div id="site-map-entries">')[1].split('</div></main>')[0];
const paths=[...entries.matchAll(/<a[^>]+href="([^"]+)"/g)].map(m=>m[1]);
const expected=[...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>new URL(m[1]).pathname);
eq([...new Set(paths)].sort(),[...new Set(expected)].sort());eq(expected.length,new Set(expected).size);assert.ok(expected.length>=195);checks++;eq(Number(html.match(/id="page-search-count"[^>]*>(\d+)ページを掲載/)[1]),expected.length);
for(const p of expected){const file=p.endsWith('/')?p.slice(1)+'index.html':p.slice(1)+'.html';await fs.access(file);checks++;}
assert.ok(html.includes('<noscript>')&&html.includes('id="page-query"')&&html.includes('role="search"'));checks++;
const article=await fs.readFile('nvidia-jensen-huang-spy-allegations-2026.html','utf8');
for(const target of ['https://nvidianews.nvidia.com/news/nvidia-announces-ceo-transition','https://www.sec.gov/Archives/edgar/data/1045810/000104581026000082/nvda-20261111.htm','/cash-flow-financial-health','/company-comparison-method','/financial-statements-basics','/site-map']){assert.ok(article.includes('href="'+target+'"'));checks++;}
assert.ok(article.includes('id="scenario-check"')&&article.includes('仮説')&&article.includes('11月14日時点の範囲'));checks++;
assert.ok(article.includes('"dateModified":"2026-11-17"')&&article.includes('2026年11月17日追記'));checks++;
const investment=await fs.readFile('investment-list.html','utf8');assert.ok(investment.includes('/nvidia-jensen-huang-spy-allegations-2026#scenario-check'));checks++;
console.log(`T04 page discovery: ${checks} assertions passed; XML/HTML ${expected.length} URL equality, real targets, Unicode/AND/language filters, no-JS links and verified-source article navigation.`);
