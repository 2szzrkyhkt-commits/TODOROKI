import assert from 'node:assert/strict';
import {calculateIncomeTax as calc,parseYen,RULE} from '../../assets/income-tax.mjs';
let assertions=0;
function equal(a,b){assert.equal(a,b);assertions++;}
equal(calc('7000000').tax,974000); // NTA No.2260 worked example
equal(calc('6500000').tax,872500); // Independent NTA 2026 progressive-tax diagram
equal(calc('0').tax,0);equal(calc('999').tax,0);equal(calc('1000').tax,50);
equal(calc('７，０００，９９９').rounded,7000000);
equal(calc('7,000,999').discarded,999);
equal(calc('7,000,999').tax,974000);
for(const s of ['', ' ', '-1','+1','1.5','1e6','NaN','Infinity','1,00','1,000,','1 000','0x10','330000001','9007199254740993','<script>']){
 assert.throws(()=>calc(s));assertions++;
}
assert.throws(()=>parseYen(null));assertions++;
// Independent oracle: sum the tax on each marginal slice. No quick-deduction table.
const tops=[1950000,3300000,6950000,9000000,18000000,40000000,330000000];
const rates=[5,10,20,23,33,40,45];
function marginal(value){
 const n=BigInt(value-value%1000);let total=0n,bottom=0n;
 for(let i=0;i<tops.length;i++){const top=BigInt(tops[i]);const upper=n<top?n:top;
  if(upper>bottom)total+=(upper-bottom)*BigInt(rates[i])/100n;bottom=top;
 }
 return Number(total);
}
for(let n=0;n<=RULE.maxInput;n+=1000)equal(calc(String(n)).tax,marginal(n));
for(const b of [0,1000,...tops])for(const d of [-1001,-1000,-1,0,1,999,1000]){
 const n=b+d;if(n<0||n>RULE.maxInput)continue;equal(calc(String(n)).tax,marginal(n));
}
for(const [n,rate] of [[1949999,5],[1950000,10],[3299999,10],[3300000,20],[6949999,20],[6950000,23],[8999999,23],[9000000,33],[17999999,33],[18000000,40],[39999999,40],[40000000,45]])equal(calc(String(n)).ratePercent,rate);
equal(calc(String(RULE.maxInput)).tax,143704000);
console.log('T22 income-tax: '+assertions+' assertions passed; NTA examples, every 1000-yen point, band edges, rounding and invalid inputs.');
