import test from 'node:test';import assert from 'node:assert/strict';import {publicMetadata} from '../../assets/tax-public-metadata.mjs';import {taxPublicFeed} from '../../tax-public-feed.mjs';import {enhance} from '../../assets/tax-public-feed-ui.mjs';
const item={title:'公式資料',official_url:'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1900.htm',checked_at:'2026-11-19T09:00:00Z'};
test('projection excludes extra data and deduplicates',()=>{assert.deepEqual(publicMetadata([{...item,secret:'never expose'},item]),[item]);});
test('reject invalid origin/path/input/date/size',()=>{for(const patch of [{official_url:'https://evil.test/1900.htm'},{official_url:item.official_url+'?private=1'},{official_url:item.official_url+'#private'},{official_url:'https://www.nta.go.jp/admin/x.htm'},{official_url:'http://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1900.htm'},{title:'x'.repeat(181)},{title:'a\nb'},{checked_at:'later'},{checked_at:'2099-01-01T00:00:00Z'}])assert.throws(()=>publicMetadata([{...item,...patch}]));assert.throws(()=>publicMetadata(Array(31).fill(item)));assert.throws(()=>publicMetadata({items:[item]}));});
test('RPC has no arguments and response contains no extras/CORS',async()=>{let args;const r=await taxPublicFeed(new Request('https://todoroki-gold.com/api/tax-public-links'),{TAX_PUBLIC_FEED:{latest:async(...a)=>{args=a;return [{...item,secret:'hidden'}];}}});assert.deepEqual(args,[]);assert.deepEqual(await r.json(),[item]);assert.equal(r.headers.get('access-control-allow-origin'),null);assert.match(r.headers.get('cache-control'),/max-age=300/);});
test('non-GET/query reject without RPC; errors sanitized',async()=>{const env={TAX_PUBLIC_FEED:{latest:()=>assert.fail('must not call')}};for(const method of ['POST','PUT','DELETE','OPTIONS','HEAD'])assert.equal((await taxPublicFeed(new Request('https://todoroki-gold.com/api/tax-public-links',{method}),env)).status,405);assert.equal((await taxPublicFeed(new Request('https://todoroki-gold.com/api/tax-public-links?q=x'),env)).status,400);for(const env of [{},{TAX_PUBLIC_FEED:{latest:async()=>{throw Error('secret');}}},{TAX_PUBLIC_FEED:{latest:async()=>[{...item,official_url:'https://evil.test'}]}}]){const r=await taxPublicFeed(new Request('https://todoroki-gold.com/api/tax-public-links'),env);assert.equal(r.status,503);assert.equal(r.headers.get('cache-control'),'no-store');assert.deepEqual(await r.json(),{error:'tax_metadata_unavailable'});}});
test('RPC timeout gives safe 503',async()=>{assert.equal((await taxPublicFeed(new Request('https://todoroki-gold.com/api/tax-public-links'),{TAX_PUBLIC_FEED:{latest:()=>new Promise(()=>{})}})).status,503);});
test('UI failed/invalid response retains fallback without DOM writes',async()=>{let refresh=0;const note={};const root={querySelector:()=>note,querySelectorAll:()=>assert.fail('must not mutate fallback')};for(const response of [new Response('x',{status:503}),Response.json([{...item,official_url:'https://evil.test'}]),Response.json('x'.repeat(33000))]){await enhance(root,()=>refresh++,async(url,options)=>{assert.equal(url,'/api/tax-public-links');assert.equal(options.credentials,'omit');return response;});assert.match(note.textContent,/固定6件/);}assert.equal(refresh,0);});
test('UI deduplicates URL, safely appends new title, refreshes filter',async()=>{
 const note={},added=[];const group={querySelector:s=>s==='ul'?{append:x=>added.push(x)}:{}};
 const root={querySelector:()=>note,querySelectorAll:s=>s==='[data-tax-source-kind] a'?[{href:item.official_url}]:[group]};
 const previous=globalThis.document;globalThis.document={createElement:tag=>({tag,dataset:{},children:[],append(...x){this.children.push(...x);}}),createTextNode:text=>({text})};
 try{let refreshed=0;await enhance(root,()=>refreshed++,async()=>Response.json([item,{...item,title:'<b>literal title</b>',official_url:item.official_url.replace('1900','1901')}]));assert.equal(added.length,1);assert.equal(added[0].dataset.taxSourceKind,'answer');assert.equal(added[0].children[0].textContent,'<b>literal title</b>');assert.equal(added[0].children[0].href,item.official_url.replace('1900','1901'));assert.equal(refreshed,1);assert.match(note.textContent,/1件を追加/);}finally{globalThis.document=previous;}
});
test('cache hit avoids RPC; canonical header-free key and five minute TTL',async()=>{
 let stored,reads=0,calls=0;const keys=[];
 const cache={async match(key){reads++;keys.push(key);return stored?.clone();},async put(key,response){keys.push(key);stored=response;}};
 const env={TAX_PUBLIC_FEED:{latest:async()=>{calls++;return [item];}}};
 for(const headers of [{Cookie:'private=a',Authorization:'secret'},{Cookie:'private=b'}]){const r=await taxPublicFeed(new Request('https://todoroki-gold.com/api/tax-public-links',{headers}),env,cache);assert.equal(r.status,200);assert.deepEqual(await r.json(),[item]);}
 assert.equal(calls,1);assert.equal(reads,2);assert.equal(stored.headers.get('cache-control'),'public, max-age=300');
 assert.ok(keys.every(k=>k.url==='https://todoroki-gold.com/api/tax-public-links'&&[...k.headers].length===0));
});
test('host/path/query variants do not call cache or RPC',async()=>{
 const cache={match:()=>assert.fail('cache'),put:()=>assert.fail('cache')};const env={TAX_PUBLIC_FEED:{latest:()=>assert.fail('RPC')}};
 for(const url of ['https://todoroki.workers.dev/api/tax-public-links','http://todoroki-gold.com/api/tax-public-links','https://todoroki-gold.com/api/tax-public-links/','https://todoroki-gold.com/api/tax-public-links?q=x'])assert.ok((await taxPublicFeed(new Request(url),env,cache)).status>=400);
});
test('cache exceptions and invalid cached body fall back; failures never cached',async()=>{
 for(const cache of [{match:async()=>{throw Error('cache down');},put:async()=>{throw Error('cache down');}},{match:async()=>Response.json([{...item,official_url:'https://evil.test/'}]),put:async()=>{}}]){const r=await taxPublicFeed(new Request('https://todoroki-gold.com/api/tax-public-links'),{TAX_PUBLIC_FEED:{latest:async()=>[item]}},cache);assert.deepEqual(await r.json(),[item]);}
 const cache={match:async()=>null,put:()=>assert.fail('errors must not be cached')};const r=await taxPublicFeed(new Request('https://todoroki-gold.com/api/tax-public-links'),{},cache);assert.equal(r.status,503);
});
test('verified collector delta passes the narrow public contract and nothing else',async()=>{
 const {persistCombinedStatus,readPublicLinks}=await import('../tax/public-feed.mjs');
 const state=new Map([['status',JSON.stringify({private_note:'forbidden',nta_public_links:[]})]]);const reads=[],writes=[];
 const internal={TAX:{async get(k,type){reads.push(k);const v=state.get(k);return type==='json'?JSON.parse(v):v;},async put(k,v){writes.push(k);state.set(k,v);}}};
 await persistCombinedStatus(internal,{phase:'idle',history:{secret:'private'},nta:{at:item.checked_at,verified:[{url:item.official_url,title:item.title,source_family:'taxanswer',readback:true,raw_key:'raw:private',sha256:'private'}]}});
 const rpc={TAX_PUBLIC_FEED:{latest:async(...args)=>{assert.equal(args.length,0);return readPublicLinks(internal);}}};
 const result=await taxPublicFeed(new Request('https://todoroki-gold.com/api/tax-public-links'),rpc,null);
 assert.deepEqual(await result.json(),[item]);assert.deepEqual(reads,['status','status']);assert.deepEqual(writes,['status']);assert.equal(JSON.parse(state.get('status')).private_note,'forbidden');
});
