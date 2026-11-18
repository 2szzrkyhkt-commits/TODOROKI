import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync(new URL('../../assets/pdf-viewer.js',import.meta.url),'utf8');
const catalog=JSON.parse(fs.readFileSync(new URL('../../assets/pdf-catalog.json',import.meta.url),'utf8'));
const file=Object.keys(catalog).find(p=>/graham/i.test(p))||Object.keys(catalog)[0];
for(const lang of ['ja','en','es','pt','zh-Hans','zh-Hant'])for(const header of ['original','replaced','missing']){
 test(`PDF initializes: ${lang}, ${header} header`,async()=>{
  const nodes=Object.fromEntries(['back','download','help','direct','article','status','title','document'].map(id=>[id,{hidden:true,textContent:'',children:[],append(n){this.children.push(n)}}]));
  const logo={};if(header==='original')nodes.home=logo;
  const document={documentElement:{},getElementById:id=>nodes[id]||null,querySelector:selector=>header==='replaced'?logo:null,querySelectorAll:()=>[],createElement:tag=>({tag})};
  let requests=0;
  await vm.runInNewContext(code,{document,location:{origin:'https://fixture.invalid',search:'?'+new URLSearchParams({file,lang,category:'investing',q:'value'})},URL,URLSearchParams,fetch:async url=>{assert.equal(url,'/assets/pdf-catalog.json');requests++;return{ok:true,json:async()=>catalog}}});
  const base=lang==='ja'?'/':`/${lang}/`;
  assert.equal(document.documentElement.lang,lang);
  if(header!=='missing')assert.equal(logo.href,base);
  assert.equal(nodes.back.href,base+'pdf-library.html?category=investing&q=value');
  assert.equal(nodes.title.textContent,catalog[file].title);
  assert.equal(nodes.status.textContent,'');assert.equal(requests,1);
  assert.equal(nodes.document.children.length,1);
  const frame=nodes.document.children[0];assert.equal(frame.tag,'iframe');assert.equal(frame.title,catalog[file].title);
  assert.equal(decodeURIComponent(frame.src.split('#')[0]),file);
  for(const id of ['direct','download']){assert.equal(nodes[id].hidden,false);assert.equal(decodeURIComponent(nodes[id].href),file)}
 });
}
test('missing header still handles unavailable catalog without an uncaught error',async()=>{
 const nodes=Object.fromEntries(['back','download','help','direct','article','status','title','document'].map(id=>[id,{}]));
 await vm.runInNewContext(code,{document:{documentElement:{},getElementById:id=>nodes[id]||null,querySelector:()=>null,querySelectorAll:()=>[]},location:{origin:'https://fixture.invalid',search:'?file=missing.pdf'},URL,URLSearchParams,fetch:async()=>({ok:false})});
 assert.match(nodes.status.textContent,/見つかりません/);assert.equal(nodes.help.hidden,true);
});
