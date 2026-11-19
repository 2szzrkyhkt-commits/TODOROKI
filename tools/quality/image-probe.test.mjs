import assert from 'node:assert/strict';
import {imageState} from './image-probe.mjs';
const cases=[
 [{complete:true,naturalWidth:640},200,'ready'],
 [{complete:false,naturalWidth:0},200,'unverified'],
 [{complete:true,naturalWidth:0},404,'broken'],
 [{complete:true,naturalWidth:0},200,'broken'],
 [{complete:true,naturalWidth:0},503,'broken'],
 [{complete:true,naturalWidth:0},401,'unverified'],
 [{complete:true,naturalWidth:0},403,'unverified'],
 [{complete:true,naturalWidth:0},429,'unverified'],
 [{complete:true,naturalWidth:0},undefined,'unverified'],
 [{complete:false,naturalWidth:640},200,'unverified']
];
for(const [state,status,expected] of cases)assert.equal(imageState(state,status),expected);
console.log('TQ43 image state: '+cases.length+' load/decode/HTTP/unknown cases passed');
