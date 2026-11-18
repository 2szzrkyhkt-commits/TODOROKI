import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectHomeKeyboard} from './keyboard-probe.mjs';
function fixture({skip=true,main=true,reachable=true,space=true,enter=true}={}){
 let evaluations=0,label='テロップを一時停止';const keys=[];
 return {keys,keyboard:{async press(key){keys.push(key);if(key==='Space'&&space)label='テロップを再生';else if(key==='Enter'&&label==='テロップを再生'&&enter)label='テロップを一時停止';}},async evaluate(){evaluations++;return evaluations===1?skip:evaluations===2?main:reachable;},locator(){return {async getAttribute(){return label;}};}};
}
test('records only the tested scope and uses actual keyboard keys',async()=>{const p=fixture();const r=await inspectHomeKeyboard(p);assert.equal(r.steps.length,4);assert.match(r.scope,/not a full-site/);assert.deepEqual(p.keys,['Tab','Enter','Tab','Space','Enter']);});
for(const [options,message] of [[{skip:false},/skip link/],[{main:false},/main content/],[{reachable:false},/80 Tab/],[{space:false},/Space/],[{enter:false},/Enter/]])test(`detects ${JSON.stringify(options)}`,async()=>{await assert.rejects(inspectHomeKeyboard(fixture(options)),message);});
