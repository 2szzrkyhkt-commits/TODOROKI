import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
const repo=process.argv[2]||fileURLToPath(new URL('../../',import.meta.url));
const read=p=>fs.readFileSync(path.join(repo,p),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function handlers(init={}){
 const events=new Map();
 return {...init,events,addEventListener(key,fn){events.set(key,fn)},fire(key,arg){return events.get(key)?.(arg)}};
}
function el(init={}){
 const node=handlers({hidden:false,disabled:false,open:false,checked:false,value:'',textContent:'',classList:{toggle(){}},focus(){},...init});
 return node;
}
function account(mock){
 const loginLabel=el({textContent:'ログイン'}),login=el({hidden:true,querySelector:()=>loginLabel,setAttribute(){},removeAttribute(){}}),details=el({hidden:true}),logout=el(),status=el({hidden:true});
 const edinet=el({href:null,setAttribute(_,v){this.href=v},removeAttribute(){this.href=null}});
 details.querySelector=sel=>sel==='button'?logout:sel==='[data-edinet-connect]'?edinet:status;
 const acct=el({contains:()=>false,querySelector:sel=>sel==='details'?details:login});
 const document=handlers({visibilityState:'visible',activeElement:null,querySelector:()=>acct});
 const window=handlers({});
 const requests=[];
 const fetch=async (u,o)=>{
  requests.push([u,o.method,o.credentials,o.cache]);
  const r=mock.shift();
  if(r instanceof Error)throw r;
  return {ok:true,json:async()=>r};
 };
 vm.runInNewContext(read('assets/header-account.js'),{window,document,fetch,AbortController,setTimeout,clearTimeout,Error});
 return {window,document,login,loginLabel,details,logout,status,requests,edinet};
}
const MEMBER={member:{email:'synthetic@example.invalid'}};
test('homepage member state restores, then successful logout updates the header',async()=>{
 const a=account([MEMBER,MEMBER,{ok:true}]);
 await tick();
 assert.equal(a.login.hidden,true);
 assert.equal(a.details.hidden,false);
 assert.equal(a.edinet.href,'https://todoroki-edinet-connect.easysquid66.chatgpt.site/');
 a.window.fire('pageshow',{persisted:true});
 await tick();
 assert.equal(a.login.hidden,true);
 await a.logout.fire('click');
 assert.equal(a.login.hidden,false);
 assert.equal(a.details.hidden,true);
 assert.equal(a.edinet.href,null);
 assert.deepEqual(a.requests,[['/api/auth/me','GET','same-origin','no-store'],['/api/auth/me','GET','same-origin','no-store'],['/api/auth/logout','POST','same-origin','no-store']]);
});
test('anonymous state and network error do not redirect the public home',async()=>{
 const a=account([{member:null},Error('offline')]);
 assert.equal(a.login.hidden,true);
 await tick();
 assert.equal(a.login.hidden,false);
 assert.equal(a.details.hidden,true);
 a.document.fire('visibilitychange',{});
 await tick();
 assert.equal(a.login.hidden,false);
 assert.equal(a.details.hidden,true);
 assert.notEqual(a.loginLabel.textContent,'ログイン');
});
test('failed logout preserves member UI and gives retry advice',async()=>{
 const a=account([MEMBER,{ok:false}]);
 await tick();
 await a.logout.fire('click');
 assert.equal(a.login.hidden,true);
 assert.equal(a.details.hidden,false);
 assert.equal(a.status.hidden,false);
});
function login(href,responses,start='unauthenticated'){
 const source=read('login.html').match(/<script>\s*(const get = id\s*=>[\s\S]*?)<\/script>/)?.[1];
 assert.ok(source,'expected to execute the actual login UI script');
 const objects=new Map();
 const element=id=>objects.has(id)?objects.get(id):objects.set(id,el()).get(id);
 const doc=handlers({getElementById:element,querySelectorAll:()=>[]});
 const target=[],calls=[];
 const location={search:new URL(href).search,replace:x=>target.push(x)};
 const todorokiSessionStartup=cb=>cb(start);
 const fetch=async(u,o)=>{
  calls.push([u,o.method,o.cache,o.credentials]);
  const {status=200,value}=responses.shift()||{};
  return {status,ok:status<400,json:async()=>value};
 };
 vm.runInNewContext(source,{document:doc,window:{location},location,URLSearchParams,todorokiSessionStartup,fetch,Error});
 doc.fire('DOMContentLoaded');
 return {doc,element,target,calls};
}
for(const suffix of ['', '?from=app','?from=https%3A%2F%2Fforeign.invalid']) {
 test('existing session on legacy/current login returns to / '+suffix,()=>{
  const a=login('https://todoroki-gold.com/login'+suffix,[],'authenticated');
  assert.deepEqual(a.target,['/']);
 });
}
test('login code success rechecks cookie-backed account before returning home; no real mail',async()=>{
 const a=login('https://todoroki-gold.com/login?from=app',[{value:{ok:true}},{value:MEMBER}]);
 a.element('code').value='123456';
 a.element('code-form').fire('submit',{preventDefault(){}});
 await tick();
 assert.deepEqual(a.target,['/']);
 assert.deepEqual(a.calls,[['/api/auth/verify','POST','no-store','same-origin'],['/api/auth/me','GET','no-store','same-origin']]);
});
test('missing member session or rejected code does not redirect',async()=>{
 for(const responses of [[{value:{ok:true}},{value:{member:null}}],[{status:400,value:{error:'invalid'}}]]){
  const a=login('https://todoroki-gold.com/login?from=app',responses);
  a.element('code').value='123456';
  a.element('code-form').fire('submit',{preventDefault(){}});
  await tick();
  assert.deepEqual(a.target,[]);
  assert.match(a.element('status').className,/error/);
 }
});
test('service worker is network-only and only deletes obsolete app-cache prefix',async()=>{
 const deleted=[]; let skip=0,claimed=0, waited;
 const self=handlers({skipWaiting:async()=>{skip++},clients:{claim:async()=>{claimed++}}});
 const caches={keys:async()=>['todoroki-app-shell-v1','todoroki-app-shell-v2','foreign-cache','todoroki-other'],delete:async k=>deleted.push(k)};
 vm.runInNewContext(read('app/sw.js'),{self,caches,Promise});
 assert.deepEqual([...self.events.keys()],['install','activate']);
 self.fire('install',{waitUntil:p=>waited=p});await waited;
 self.fire('activate',{waitUntil:p=>waited=p});await waited;
 assert.equal(skip,1);assert.equal(claimed,1);
 assert.deepEqual(deleted,['todoroki-app-shell-v1','todoroki-app-shell-v2']);
});
function splashRun({ios=false,native=false,display=false,referrer='',small=true}={}){
 const code=read('index.html').match(/<script>\s*(\(\(\) => \{\s*const splash = document\.getElementById\('td-splash'\);[\s\S]*?)<\/script>/)?.[1];
 assert.ok(code,'expected to execute the real homepage splash decision');
 const splash=el({hidden:true,removed:0,remove(){this.removed++}});
 const document=handlers({referrer,getElementById:()=>splash});
 const window=handlers({});
 const animation=[];
 const matchMedia=q=>({matches:q.includes('device-width: 393px')?native:q.includes('display-mode')?display:small});
 vm.runInNewContext(code,{document,window,location:{origin:'https://todoroki-gold.com'},navigator:{standalone:ios},matchMedia,requestAnimationFrame:f=>animation.push(f)});
 return {splash,document,window,animation};
}
test('matched iPhone 16 native startup never draws the website splash logo',()=>{
 const x=splashRun({ios:true,native:true,display:true});
 assert.equal(x.splash.hidden,true);
 assert.equal(x.document.events.has('DOMContentLoaded'),false);
});
test('non-native mobile installed launch draws once; normal browsing and same-site resume do not',()=>{
 const x=splashRun({display:true});
 assert.equal(x.splash.hidden,false);
 x.document.fire('DOMContentLoaded');
 while(x.animation.length)x.animation.shift()();
 assert.equal(x.splash.removed,1);
 for(const params of [{},{display:true,referrer:'https://todoroki-gold.com/boki1'},{display:true,small:false}]){
  assert.equal(splashRun(params).splash.hidden,true);
 }
});
