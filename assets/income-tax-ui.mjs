import {calculateIncomeTax} from './income-tax.mjs';
const form=document.querySelector('#income-tax-form'),input=document.querySelector('#taxable-income');
const result=document.querySelector('#income-tax-result'),error=document.querySelector('#income-tax-error');
for(const el of form.querySelectorAll('input,button'))el.disabled=false;
const yen=n=>new Intl.NumberFormat('ja-JP').format(n)+'円';
function clear(){result.hidden=true;error.textContent='';input.removeAttribute('aria-invalid');}
function show(){
 clear();
 try{
  const r=calculateIncomeTax(input.value);
  document.querySelector('#taxable-rounded').textContent=yen(r.rounded);
  document.querySelector('#tax-rounding').textContent=yen(r.discarded);
  document.querySelector('#income-tax-amount').textContent=yen(r.tax);
  document.querySelector('#income-tax-formula').textContent=yen(r.rounded)+' × '+r.ratePercent+'% − '+yen(r.quickDeduction)+' ＝ '+yen(r.tax);
  result.hidden=false;
 }catch(e){input.setAttribute('aria-invalid','true');error.textContent=e.message;input.focus();}
}
form.addEventListener('submit',e=>{e.preventDefault();show();});
input.addEventListener('input',clear);
form.addEventListener('reset',clear);
document.querySelector('#income-tax-example').addEventListener('click',()=>{input.value='7,000,000';show();});
