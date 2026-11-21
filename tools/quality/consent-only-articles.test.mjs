import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {setImmediate} from 'node:timers/promises';
import test from 'node:test';

const read = path => fs.readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
const source = read('assets/privacy-controls.js');
const pages=['murata-6981-earnings-analysis-2026','sumitomo-rubber-5110-earnings-2026'];

async function execute(pathname, marked, allow, region=true){
  const nodes=new Map(), scriptUrls=[], requestUrls=[], stored=[], focused=[];
  const get = id => {
    if(!nodes.has(id))nodes.set(id,{textContent:'',hidden:true,checked:false,disabled:false,setAttribute(){},focus(){focused.push(id);}});
    return nodes.get(id);
  };
  const header={dataset:{},outerHTML:'original'};
  const body=[];
  const document={
    currentScript:{hasAttribute:name=>marked&&name==='data-todoroki-consent-only'},
    documentElement:{lang:'ja'},readyState:'complete',
    querySelectorAll:()=>[],
    querySelector:selector=>selector.includes('header')?header:null,
    createElement:tag=>({tag}),
    head:{append:element=>{if(element.tag==='script')scriptUrls.push(element.src);}},
    body:{append:element=>body.push(element)},
    getElementById:get,addEventListener(){}
  };
  vm.runInNewContext(source,{
    document,navigator:{},window:{},location:{pathname,reload(){throw Error('unexpected preference change');}},
    localStorage:{getItem:()=>JSON.stringify({time:Date.now(),version:1,analytics:allow,ads:allow}),setItem:(...args)=>stored.push(args)},
    fetch:async url=>{requestUrls.push(url);return {ok:true,json:async()=>({optionalAllowed:region})};},
    AbortSignal
  });
  await setImmediate();
  return {document,header,scriptUrls,requestUrls,nodes,body,stored,focused};
}

for(const slug of pages)test(`${slug}: existing opt-in never causes optional requests or header change`,async()=>{
  const html=read(slug+'.html');
  assert.match(html,/<script src="\/assets\/privacy-controls\.js" data-todoroki-consent-only defer><\/script>/);
  for(const allow of [true,false]){
    const r=await execute('/'+slug,true,allow);
    assert.equal(r.body.length,1);
    assert.deepEqual(r.scriptUrls,[]);
    assert.deepEqual(r.requestUrls,[]);
    assert.deepEqual(r.stored,[]);
    assert.equal(r.header.outerHTML,'original');
    for(const id of ['td-analytics','td-ads','td-reject','td-save'])assert.equal(r.nodes.get(id).disabled,true);
    assert.match(r.nodes.get('td-region').textContent,/このページでは広告・解析を読み込みません/);
    r.nodes.get('td-privacy-open').onclick();
    assert.equal(r.nodes.get('td-privacy-panel').hidden,false);
    assert.deepEqual(r.focused,['td-close']);
    assert.equal(r.nodes.get('td-close').disabled,false);
    r.nodes.get('td-close').onclick();
    assert.equal(r.nodes.get('td-privacy-panel').hidden,true);
  }
});

test('existing unmarked pages still apply current consent and regional behavior',async()=>{
  const allowed=await execute('/generic',false,true);
  assert.deepEqual(allowed.requestUrls,['/api/privacy/region']);
  assert.equal(allowed.scriptUrls.length,2);
  assert.ok(allowed.scriptUrls.some(src=>src.includes('googlesyndication.com')));
  assert.ok(allowed.scriptUrls.some(src=>src.includes('googletagmanager.com')));
  assert.notEqual(allowed.header.outerHTML,'original');
  const refusal=await execute('/generic',false,false);
  assert.deepEqual(refusal.scriptUrls,[]);
  const regional=await execute('/generic',false,true,false);
  assert.deepEqual(regional.scriptUrls,[]);
  assert.ok(regional.nodes.get('td-ads').disabled);
});
