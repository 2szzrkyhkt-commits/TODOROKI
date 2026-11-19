import test from 'node:test';import assert from 'node:assert/strict';
import {saveConditionDocuments} from './conditions.js';import {conditionDocuments} from './conditions-data.js';
import {saveAmountRules} from './amounts.js';import {amountRules} from './amount-rules.js';
const digest=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');
const clock=new Date('2026-11-19T00:00:00Z');
for(const [kind,doc,save] of [['condition',conditionDocuments[0],env=>saveConditionDocuments(env,[conditionDocuments[0]],clock)],['amount',amountRules,env=>saveAmountRules(env,clock)]]){
 const json=JSON.stringify(doc),hash=await digest(json);
 function fixture({existing=true,body=json,storedHash=hash,missing=false}={}){let writes=0,reads=0;const env={DB:{prepare(sql){return{bind(){return this},async first(){if(sql.includes('FROM programs'))return{id:doc.programId};reads++;if(!existing&&reads===1)return null;if(missing)return null;return{content_hash:storedHash,document_json:body};},async run(){writes++;return{success:true,meta:{changes:1}}}}}}};return{env,writes:()=>writes};}
 test(`${kind}: exact existing document unchanged, no writes`,async()=>{const f=fixture();assert.equal((await save(f.env)).status,'saved');assert.equal(f.writes(),0);});
 for(const body of ['{}','{broken',null,'',json+' '])test(`${kind}: existing wrong body rejected without overwrite ${String(body).slice(0,15)}`,async()=>{const f=fixture({body});await assert.rejects(()=>save(f.env),new RegExp(kind+'_integrity_failed'));assert.equal(f.writes(),0);});
 test(`${kind}: matching new write readback succeeds`,async()=>{const f=fixture({existing:false});assert.equal((await save(f.env)).status,'saved');assert.equal(f.writes(),1);});
 test(`${kind}: corrupt postinsert readback fails, no repair write`,async()=>{const f=fixture({existing:false,body:'{}'});await assert.rejects(()=>save(f.env),new RegExp(kind+'_integrity_failed'));assert.equal(f.writes(),1);});
 test(`${kind}: hash mismatch collision unchanged`,async()=>{const f=fixture({storedHash:'0'.repeat(64)});await assert.rejects(()=>save(f.env),/version_collision/);assert.equal(f.writes(),0);});
 test(`${kind}: missing postinsert readback still fails`,async()=>{const f=fixture({existing:false,missing:true});await assert.rejects(()=>save(f.env),/version_collision/);assert.equal(f.writes(),1);});
}
