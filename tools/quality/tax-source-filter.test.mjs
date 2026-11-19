import test from 'node:test';import assert from 'node:assert/strict';import {matches,initialize} from '../../assets/tax-source-filter.mjs';
test('literal normalization and type intersection',()=>{
 assert.ok(matches('answer','No.1901 同族会社','all','１９０１'));
 assert.ok(matches('answer','No.1901 同族会社','answer',' no.1901 '));
 assert.equal(matches('answer','No.1901 同族会社','circular','1901'),false);
 assert.equal(matches('answer','No.1901 同族会社','all','<script>'),false);
 assert.ok(matches('circular','減価償却資産','circular','減価償却'));
});
test('controls, no results, groups and clearing with DOM adapter',()=>{
 const control=v=>({value:v,disabled:true,events:{},addEventListener(k,f){this.events[k]=f;}});
 const kind=control('all'),query=control(''),count={},empty={};
 const rows=['answer','circular'].map((k,i)=>({dataset:{taxSourceKind:k},hidden:false,querySelector:()=>({textContent:i?'減価償却資産':'No.1901 同族会社'})}));
 const groups=rows.map(r=>({hidden:false,querySelectorAll:()=>[r]}));
 initialize({querySelector:s=>({'#tax-source-kind':kind,'#tax-source-query':query,'#tax-source-count':count,'#tax-source-empty':empty})[s],querySelectorAll:s=>s==='[data-tax-source-kind]'?rows:groups});
 assert.equal(kind.disabled,false);assert.equal(query.disabled,false);assert.equal(count.textContent,'2件表示／全2件');
 query.value='１９０１';query.events.input();assert.deepEqual(rows.map(r=>r.hidden),[false,true]);assert.deepEqual(groups.map(r=>r.hidden),[false,true]);
 kind.value='circular';kind.events.change();assert.equal(empty.hidden,false);assert.equal(count.textContent,'0件表示／全2件');
 query.value='';query.events.input();assert.equal(empty.hidden,true);kind.value='all';kind.events.change();assert.ok(rows.every(r=>!r.hidden));
});
