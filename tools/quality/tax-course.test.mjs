import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {course} from '../../assets/tax-course-content.mjs';
import {grade,decodeProgress,encodeProgress,lessonIds} from '../../assets/tax-course-engine.mjs';
import {generatedCourse} from './tax-course-render.mjs';
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
const ids=['boki','financial','income','corporate','inheritance','consumption','liquor','collection','resident','business','property'];
eq(course.subjects.map(s=>s.id),ids);eq(course.examYear,2026);eq(course.lessons.length,22);eq(new Set(lessonIds).size,22);
const oracle={'boki-receivable':'c','boki-prepaid':'a','financial-position':'c','financial-depreciation':'a','income-base':'b','income-progressive':'b','corporate-adjustment':'c','corporate-depreciation':'a','inheritance-exemption':'b','inheritance-process':'c','consumption-rates':'a','consumption-classification':'b','liquor-taxpayer':'c','liquor-licence':'a','collection-process':'b','collection-deferral':'c','resident-year':'a','resident-address':'b','business-base':'c','business-adjustment':'a','property-owner':'b','property-base':'c'};
for(const id of ids)eq(course.lessons.filter(l=>l.subject===id).length,2);
for(const l of course.lessons){
 eq(l.reviewedAt,'2026-11-17');assert.ok(l.body.length>=2&&l.body.every(p=>p.length>20));checks++;
 assert.ok(l.example.condition&&l.example.steps.length>=2);checks++;
 eq(l.quiz.choices.length,3);eq(new Set(l.quiz.choices.map(c=>c.id)).size,3);
 assert.ok(l.quiz.explanation.length>20&&l.sources.length>0);checks++;
 for(const id of l.sources){const s=course.sources[id];assert.ok(s&&s.basis);checks++;eq(new URL(s.url).protocol,'https:');assert.ok(['www.nta.go.jp','laws.e-gov.go.jp','www.pref.shizuoka.jp','www.city.iwata.shizuoka.jp'].includes(new URL(s.url).hostname));checks++;}
 eq(grade(l.id,oracle[l.id]).correct,true);
 for(const c of l.quiz.choices.filter(c=>c.id!==oracle[l.id]))eq(grade(l.id,c.id).correct,false);
 eq(grade(l.id,undefined).valid,false);eq(grade(l.id,'z').valid,false);
}
eq(grade('unknown','a').valid,false);
// Independent arithmetic oracles for all original worked examples.
for(const l of course.lessons.filter(l=>l.numeric)){
 const n=l.numeric;let expected;
 switch(n.kind){
  case 'receivable':expected=n.amount-n.collected;break;
  case 'allocation':expected=n.amount*n.months/n.totalMonths;break;
  case 'equity':expected=n.assets-n.liabilities;break;
  case 'depreciation':expected=(n.cost-n.residual)/n.years;break;
  case 'incomeTax':expected=Math.floor(n.amount/1000)*1000*n.rate/100-n.deduction;break;
  case 'adjustment':expected=n.profit+n.add-n.subtract;break;
  case 'excess':expected=n.expense-n.limit;break;
  case 'inheritance':eq(n.exemption,30000000+6000000*n.heirs);expected=n.estate-n.exemption;break;
  case 'consumption':eq(n.tax,n.net*n.rate/100);expected=n.net+n.tax;break;
  case 'businessBase':expected=n.income-n.deduction;break;
  case 'businessMonths':expected=n.annual*n.months/12;break;
  case 'propertyTax':expected=Math.round(n.base*14/1000);break;
  default:throw Error('unknown numeric oracle');
 }
 eq(n.result,expected);
}
eq(decodeProgress(null),{readable:true,ids:[]});
eq(decodeProgress(encodeProgress(['income-base','income-base'])),{readable:true,ids:['income-base']});
eq(decodeProgress('broken').readable,false);eq(decodeProgress('{"schema":2,"correctOnce":[]}').readable,false);
eq(decodeProgress('{"schema":1,"correctOnce":["<script>"]}').readable,false);
eq(decodeProgress('{"schema":1,"correctOnce":["future-safe-lesson"]}').ids,['future-safe-lesson']);
const html=await fs.readFile('tax-study.html','utf8');
eq(html.match(/<!-- tax-course:start -->\n([\s\S]*?)\n<!-- tax-course:end -->/)?.[1],generatedCourse());
eq((html.match(/data-tax-quiz=/g)||[]).length,22);eq((html.match(/data-tax-lesson=/g)||[]).length,22);
assert.ok(html.includes('id="income-tax-form"')&&html.includes('/assets/income-tax-ui.mjs'));checks++;
assert.ok(html.includes('2027年度試験対応は未確認'));checks++;
console.log('T19 course: '+checks+' assertions passed; 11 subjects/22 lessons/22 question oracles, independent arithmetic, official sources, static generation, progress and existing calculator.');
