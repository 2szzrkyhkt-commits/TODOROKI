import test from 'node:test';import assert from 'node:assert/strict';import {webcrypto} from 'node:crypto';
globalThis.crypto ||=webcrypto;
import {NATIONAL_SOURCE,NATIONAL_URL,nationalNames,nationalCandidate,readNationalIndex} from './national-index.js';
import {sourceAllowed,collectOne} from './collector.js';import {sha256} from './catalog.js';
const names=['自立相談支援事業','住居確保給付金の支給','就労準備支援事業','家計改善支援事業','就労訓練事業','子どもの学習・生活支援事業','居住支援事業'];
const fixture='<h3>ナビゲーション</h3><h2>生活困窮者自立支援制度の各事業の概要</h2>'+names.map(n=>'<h3>'+n+'</h3><p>本文・条件・画像等は保存しない</p>').join('')+'<h2>生活困窮者自立支援制度のチラシ</h2><h3>対象外</h3>';
const source={id:NATIONAL_SOURCE,url:NATIONAL_URL,terms_url:'https://www.mhlw.go.jp/chosakuken/index.html',enabled:1,automated_access:'approved',reviewed_at:'2026-11-18',third_party:'excluded',commercial:'conditional-PDL1.0',reproduction:'conditional-PDL1.0',modification:'conditional-PDL1.0',interval_seconds:86400,failures:0};
function database(mode='ok'){
 const revisions=new Map(),calls=[],state={};return {revisions,calls,state,prepare(sql){let args;return {sql,bind(...a){args=a;this.values=a;return this},async run(){calls.push({sql,args});if(sql.includes('INSERT OR IGNORE INTO revisions')&&mode!=='missing')revisions.set(args[2],{candidate_json:args[4]});return {success:mode!=='writeFailure',meta:{changes:1}}},async first(){const row=revisions.get(args[1]);if(!row)return null;return mode==='corrupt'?{candidate_json:row.candidate_json+' '}:row}}},async batch(qs){calls.push(...qs.map(q=>({sql:q.sql,args:q.values})));return qs.map(()=>({success:mode!=='checkpointFailure'}));}};
}
test('national source is restricted to the exact reviewed ministry page and rights',()=>{
 assert(sourceAllowed(source));for(const delta of [{id:'unknown'},{url:NATIONAL_URL+'?all=1'},{url:'https://example.test/'},{enabled:0},{automated_access:'unknown'},{reviewed_at:null},{commercial:'unknown'},{third_party:'included'}])assert.equal(sourceAllowed({...source,...delta}),false);
});
test('only program headings in the selected section become pending names',async()=>{
 assert.deepEqual(nationalNames(fixture),names);const hash=await sha256(fixture),d=await nationalCandidate(fixture,hash);
 assert.equal(d.itemCount,7);assert.equal(d.publishedOn,null);assert.equal(d.coverage,'one_official_index_not_nationwide');assert.equal(d.sourceSha256,hash);assert.equal(d.verification,'pending');assert(d.attribution.includes('出典'));
 for(const p of d.items){assert.equal(p.eligibility,'not_evaluated');assert.equal(p.amount,'not_calculated');assert.equal(p.localAvailability,'unconfirmed');assert.equal(p.sourceURL,NATIONAL_URL);assert(!JSON.stringify(p).includes('本文・条件'));}
 const second=await nationalCandidate(fixture,hash);assert.deepEqual(d,second);
});
test('script, template and comment headings are not extracted',()=>{
 const fake='<h3>架空の事業</h3>';assert.deepEqual(nationalNames(fixture.replace('<h3>'+names[0],'<script>'+fake+'</script><template>'+fake+'</template><!--'+fake+'--><h3>'+names[0])),names);
});
test('missing, duplicate, empty, oversized or malformed headings fail closed',()=>{
 for(const s of ['<h3>別文書</h3>',fixture.replace(names[0],names[1]),fixture.replace(names[0],''),fixture.replace(names[0],'a'.repeat(101)),fixture+'\u0000',fixture+'<script>unclosed',fixture+fixture,'x'.repeat(524289)])assert.throws(()=>nationalNames(s));
});
test('source hash must match the received document',async()=>assert.rejects(()=>nationalCandidate(fixture,'0'.repeat(64)),/national_source_hash_mismatch/));
test('bounded collection archives a hash-verified seven-name candidate without changing programs',async()=>{
 const db=database();let fetches=0;const result=await collectOne(db,source,async(url,options)=>{fetches++;assert.equal(url,NATIONAL_URL);assert.equal(options.redirect,'manual');return new Response(fixture,{headers:{'Content-Type':'text/html; charset=utf-8',ETag:'test'}})},new Date('2026-11-18T10:00:00Z'));
 assert.equal(result.status,'ok');assert.equal(result.catalog.itemCount,7);assert.equal(fetches,1);assert.equal(db.revisions.size,1);assert(!db.calls.some(c=>/INSERT.*programs|UPDATE programs|DELETE/.test(c.sql||'')));assert.equal((await readNationalIndex(db,result.hash)).itemCount,7);
 const again=await collectOne(db,{...source,last_hash:result.hash},async()=>new Response(null,{status:304}),new Date('2026-11-19T10:00:00Z'));assert.equal(again.status,'ok');assert.equal(again.catalog.itemCount,7);assert.equal(db.revisions.size,1);
});
for(const mode of ['missing','corrupt','writeFailure'])test('a '+mode+' archive is not reported as a successful collection',async()=>{
 const db=database(mode);const r=await collectOne(db,source,async()=>new Response(fixture,{headers:{'Content-Type':'text/html'}}));assert.equal(r.status,'failed');assert(!db.calls.some(c=>c.sql?.includes("status='ok'")));
});
test('304 requires a valid stored candidate; redirects and denied responses are not followed',async()=>{
 for(const status of [304,302,403]){let count=0;const db=database();const r=await collectOne(db,{...source,last_hash:'0'.repeat(64)},async()=>{count++;return new Response(null,{status,headers:{Location:'https://example.test/'}})});assert.equal(r.status,'failed');assert.equal(count,1);assert.equal(db.revisions.size,0);}
});

test('a failed collection checkpoint is not reported as successful',async()=>{const db=database('checkpointFailure');const r=await collectOne(db,source,async()=>new Response(fixture,{headers:{'Content-Type':'text/html'}}));assert.equal(r.status,'failed');assert.equal(r.error,'national_checkpoint_failed');});
