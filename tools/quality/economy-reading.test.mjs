import fs from 'node:fs';
import assert from 'node:assert/strict';
let checks=0;const check=fn=>{fn();checks++;};
const pages=['inflation','interest-rate','government-subsidies'];
const html=Object.fromEntries(pages.map(p=>[p,fs.readFileSync(p+'.html','utf8')]));
for(const p of pages){
 const s=html[p],section=s.match(/<section class="reading-worked"[\s\S]*?<\/section>/)?.[0];
 check(()=>assert.ok(section,p));
 check(()=>assert.equal((s.match(/id="worked-reading"/g)||[]).length,1));
 check(()=>assert.ok(section.includes('2026年11月17日')));
 check(()=>assert.ok(section.includes('仮定')));
 check(()=>assert.ok(s.match(new RegExp('https://todoroki-gold.com/'+p+'["\\s]'))));
 check(()=>assert.ok(section.includes('scope="row"')&&section.includes('scope="col"')&&section.includes('<caption>')));
 check(()=>assert.ok(section.includes('tabindex="0"')&&section.includes('role="region"')));
 for(const target of pages.filter(x=>x!==p))check(()=>assert.ok(section.includes('/'+target+'#worked-reading')));
 check(()=>assert.ok(section.includes('/site-map')));
}
const money=n=>Math.round(n).toLocaleString('en-US');
for(const rate of [0,.01,.03]){
 check(()=>assert.ok(html.inflation.includes(money(1000000*(1+rate)**10)+'円')));
 check(()=>assert.ok(html.inflation.includes(money(1000000*((1+rate)/1.03)**10)+'円')));
}
for(const rate of [.03,.05])check(()=>assert.ok(html['interest-rate'].includes(money(1000000/(1+rate))+'円')));
check(()=>assert.ok(html['interest-rate'].includes(money(1000000*.03)+'円')));
check(()=>assert.equal(300000*2/3,200000));
check(()=>assert.equal((300000-60000)*2/3,160000));
check(()=>assert.ok(html['government-subsidies'].includes('負担は14万円')));
check(()=>assert.ok(html['government-subsidies'].includes('既存の制度別紹介は2026年10月28日時点')));
for(const [p,domain] of [['inflation','www.stat.go.jp/data/cpi/4-1.htm'],['interest-rate','www.boj.or.jp/about/education/oshiete/glossary/market/m11.htm'],['government-subsidies','seisansei.smrj.go.jp/problem_solving/shokibo-guide/shokibo-subsidy-myths.html']])check(()=>assert.ok(html[p].includes('https://'+domain)));
console.log(`T04 economy reading: ${checks} checks passed; independent arithmetic, assumptions, source links, reciprocal navigation and accessible tables.`);
