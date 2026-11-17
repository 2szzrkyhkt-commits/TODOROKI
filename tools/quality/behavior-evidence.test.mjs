import fs from 'node:fs';import assert from 'node:assert/strict';
const pages=Object.fromEntries(['consumer-protection-solutions','discounted-utility','social-preferences'].map(p=>[p,fs.readFileSync(p+'.html','utf8').match(/<section class="evidence-reading"[\s\S]*?<\/section>/)?.[0]]));
for(const [p,s]of Object.entries(pages))assert.ok(s,`Evidence section absent: ${p}`);
let checks=0;const check=fn=>{fn();checks++;};
const rows=s=>[...s.matchAll(/<tr>(.*?)<\/tr>/gs)].map(x=>[...x[1].matchAll(/<t[dh][^>]*>(.*?)<\/t[dh]>/gs)].map(c=>c[1].replace(/<[^>]*>/g,'')));
const beta=.8,delta=.99;
const today=[beta*delta*100,beta*delta**2*110],tomorrow=[100,beta*delta*110];
check(()=>assert.ok(today[1]>today[0]&&tomorrow[0]>tomorrow[1]));
check(()=>assert.ok(delta**2*110>delta*100&&delta*110>100));
const utility=pages['discounted-utility'];
const utilityRows=rows(utility).slice(1);
for(const [i,oracle]of [today,tomorrow].entries())check(()=>assert.deepEqual(utilityRows[i].slice(1,3).map(s=>Number(s.split('＝').at(-1))),oracle.map(n=>Number(n.toFixed(4)))));
check(()=>assert.equal(rows(utility).length,3));
check(()=>assert.ok(utility.includes('t≥1')&&utility.includes('今すぐの効用にはβを掛けません')));
check(()=>assert.ok(utility.includes('実測値・金額・投資利回りではありません')));
const social=pages['social-preferences'],data=rows(social).slice(1);
for(let i=0;i<data.length;i++){
 const [a,b,pa,pb,total]=data[i].map(Number),pool=.75*(a+b);
 check(()=>assert.deepEqual([pa,pb,total],[10-a+pool,10-b+pool,20-a-b+2*pool]));
}
check(()=>assert.equal(data.length,4));
check(()=>assert.ok(social.includes('論文全体の効用や実証結果を再現する表ではありません')));
const consumer=pages['consumer-protection-solutions'];
check(()=>assert.ok(consumer.includes('すべてが現在の法的義務という意味ではありません')));
check(()=>assert.ok(consumer.includes('サービスの解約を商品の返品と同じ扱いにすることもできません')));
for(const [p,url]of [['consumer-protection-solutions','https://www.no-trouble.caa.go.jp/what/mailorder/guidelines.html'],['discounted-utility','https://laibson.scholars.harvard.edu/sites/g/files/omnuum5971/files/laibson/files/golden_eggs_and_hyperbolic_discounting.pdf'],['social-preferences','https://web.stanford.edu/~niederle/Fehr.Schmidt.1999.QJE.pdf']])check(()=>assert.ok(pages[p].includes(url)));
console.log(`T04 behavioral evidence: ${checks} checks passed; independent preference reversal/control, all public-good payoffs and evidence/proposal boundaries.`);
