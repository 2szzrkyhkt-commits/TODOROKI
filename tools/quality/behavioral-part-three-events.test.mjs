import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../../assets/behavioral-part-three-events.js',import.meta.url),'utf8');
let callback;
const document={getElementById:id=>{
  assert.equal(id,'part-three-roadmap');
  return {addEventListener:(name,listener)=>{assert.equal(name,'click');assert.equal(callback,undefined);callback=listener;}};
}};
const window={};
const navigator={globalPrivacyControl:false};
class Element {
  constructor({action='pdf', tagName='A', id='part-three-chapter-11', open=false}={}){
    Object.assign(this,{dataset:{beAction:action},tagName,id,parentElement:{open}});
  }
  closest(selector){
    return selector==='.part-three-card' ? {id:this.id} : this;
  }
}
vm.runInNewContext(source,{document,window,navigator,Element});
const fire = (fields,override={})=>callback({target:new Element(fields),isTrusted:true,defaultPrevented:false,...override});
const events=[];
fire(); // Analytics was not enabled through the standard privacy script.
assert.deepEqual(events,[]);
window.gtag=(...args)=>events.push(JSON.parse(JSON.stringify(args)));
navigator.globalPrivacyControl=true;
fire();
assert.equal(events.length,0);
navigator.globalPrivacyControl=false;
fire({}, {isTrusted:false});
fire({}, {defaultPrevented:true});
fire({id:'part-three-chapter-17'});
fire({action:'https://arbitrary',id:'part-three-chapter-11'});
fire({action:'constructor'});
fire({action:'quiz',tagName:'SUMMARY',open:true});
fire({action:'pdf',tagName:'SUMMARY'});
assert.equal(events.length,0);
fire();
fire({action:'save',id:'part-three-chapter-15'});
fire({action:'quiz',tagName:'SUMMARY',open:false,id:'part-three-chapter-13'});
fire({action:'article',id:'part-three-chapter-14'});
fire({action:'tool',id:'part-three-chapter-12'});
assert.deepEqual(events,[
  ['event','be_part3_pdf_open',{chapter_id:'11'}],
  ['event','be_part3_pdf_save',{chapter_id:'15'}],
  ['event','be_part3_quiz_open',{chapter_id:'13'}],
  ['event','be_part3_related_article_open',{chapter_id:'14'}],
  ['event','be_part3_tool_entry_open',{chapter_id:'12'}],
]);
console.log('Part 3 events: default-off, GPC, trusted clicks, 5 enumerated actions, chapter allowlist verified');
