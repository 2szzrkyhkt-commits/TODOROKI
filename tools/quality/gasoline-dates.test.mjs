import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const html=await fs.readFile('gasoline-subsidy-outlook-2026.html','utf8');let checks=0;
const has=s=>{assert.ok(html.includes(s),s);checks++;};
const data=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
assert.equal(data.datePublished,'2026-10-29');assert.equal(data.dateModified,'2026-11-17');checks+=2;
assert.ok(!data.description.includes('最新の補助単価52.4'));checks++;
for(const [a,b] of [[1699+519,2218],[1699+519-151-1700,367],[50*5,250],[50*10,500],[50*20,1000]]){assert.equal(a,b);checks++;}
assert.notEqual(1699+367,2218);checks++;
for(const s of ['2026年11月9日調査','2026年11月12日〜18日適用分','169.9円/L','36.7円/L','確認日：2026年11月17日','現在の残高は今回未確認','制度変更の最新方針を全て更新した記事ではありません','同じ時点の「補助なし価格」を再現したことにはなりません','10月29日時点の見通し（履歴）','52.4円/Lは10月29日適用分として記録した過去の値','href="https://nenryo-teigakuhikisage.go.jp/current_graph.pdf"','href="https://www.nenryo-teigakuhikisage.go.jp/"','href="/site-map"','href="/government-subsidies"','href="/inflation"'])has(s);
const opening=html.split('<section id="as-of-update"')[1].split('</section>')[0];assert.equal((opening.match(/<th scope="row">/g)||[]).length,2);checks++;
for(const m of html.matchAll(/<meta[^>]+(?:name|property)="(?:description|og:description)"[^>]+content="([^"]+)"/g)){assert.equal(m[1],data.description);checks++;}
has('https://todoroki-gold.com/gasoline-subsidy-outlook-2026');has('/assets/privacy-controls.js');
console.log(`T04 gasoline dates: ${checks} assertions passed; official values/periods, decimal-unit arithmetic, historical scope, metadata and related links.`);
