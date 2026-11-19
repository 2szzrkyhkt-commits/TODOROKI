import {validDate,fiscalEndAtAge,japanDay,runSupportWithEligibility} from './eligibility.js';
import {readConditions} from './conditions.js';
import {amountRules} from './amount-rules.js';
export const AMOUNT_ENGINE_VERSION='2026-11-16.1';
const validMonth=m=>typeof m==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(m);
const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,'0')).join('');
export function validateAmountRules(d){
 if(!d||d.programId!=='jp-child-allowance'||d.schemaVersion!==1||d.version!==AMOUNT_ENGINE_VERSION||d.effectiveFromMonth!=='2024-10'||!validDate(d.checkedOn)||d.birthdayMonthInclusive!==true||d.payFiscalAge!==18||d.countFiscalAge!==22||JSON.stringify(d.rates)!==JSON.stringify({under3:15000,older:10000,third:30000})||JSON.stringify(d.multiChildTypes)!=='["individual"]'||!d.attribution?.includes('TODOROKI'))throw Error('invalid_amount_rules');
 if(!Array.isArray(d.sources)||d.sources.length<4)throw Error('invalid_amount_rules');
 for(const s of d.sources){let u;try{u=new URL(s.url)}catch{throw Error('invalid_amount_rules')};if(u.protocol!=='https:'||u.username||u.password||!['www.cfa.go.jp','laws.e-gov.go.jp'].includes(u.hostname)||!s.section||!Number.isFinite(Date.parse(s.checkedAt))||!s.checkedAt.startsWith(d.checkedOn)||!/^[a-f0-9]{64}$/.test(s.sha256))throw Error('invalid_amount_rules');}
 if(!d.sources.some(s=>s.id==='law'&&s.revisionStatus==='CurrentEnforced'))throw Error('invalid_amount_rules');return d;
}
export function calculateAmount(d,request,clock=new Date()){
 validateAmountRules(d);if(!Number.isFinite(+clock))throw Error('invalid_clock');
 if(!request||typeof request!=='object'||Array.isArray(request)||Object.keys(request).some(k=>!['programId','beneficiaryType','month','assumptionsConfirmed','children'].includes(k))||request.programId!==d.programId||!validMonth(request.month)||![null,'individual','corporate_guardian','facility'].includes(request.beneficiaryType)||![null,false,true].includes(request.assumptionsConfirmed)||!Array.isArray(request.children)||request.children.length<1||request.children.length>20)throw Error('invalid_amount_input');
 const day=japanDay(clock),month=request.month,first=month+'-01',nowMonth=day.slice(0,7),futureLimit=String(Number(nowMonth.slice(0,4))+1)+nowMonth.slice(4);
 const result={engineVersion:AMOUNT_ENGINE_VERSION,ruleVersion:d.version,programId:d.programId,month,currency:'JPY',status:'needs_review',amountYen:null,breakdown:null,adjudication:'not_performed',checkedOn:d.checkedOn,sources:d.sources.map(s=>({url:s.url,section:s.section})),notes:['入力した受給者区分・当月の認定/算定資格・対象期間が正しいという仮定の月額試算です。実際の受給可否・振込額は確定しません。','出生月は含めず、原則の出生翌月以降で算定。申請遅れ・遡及・資格変更・振込日・控除/徴収は窓口で確認してください。','18歳年度末超の兄姉等は、監護相当の世話と生計費負担等の算定要件を確認した場合だけ含めてください。延長者等は別途確認が必要です。']};
 // Validate every row, even when the rule is stale. Do not echo personal dates.
 const children=request.children.map(c=>{if(!c||typeof c!=='object'||Array.isArray(c)||Object.keys(c).some(k=>!['birthDate','status','startMonth','endMonth'].includes(k))||c.birthDate!=null&&c.birthDate!==''&&(!validDate(c.birthDate)||c.birthDate>day)||!['confirmed','excluded','unknown'].includes(c.status)||c.startMonth!=null&&!validMonth(c.startMonth)||c.endMonth!=null&&!validMonth(c.endMonth)||c.startMonth&&c.endMonth&&c.startMonth>c.endMonth)throw Error('invalid_amount_input');return {...c,birthDate:c.birthDate||null};});
 if(month<d.effectiveFromMonth||month>futureLimit||(Date.parse(day)-Date.parse(d.checkedOn))/86400000>30||day<d.checkedOn){result.notes.unshift('この時点または資料の鮮度では計算できません。旧制度・1年を超える将来・未確認の変更は要確認です。');return result;}
 if(!request.beneficiaryType||request.assumptionsConfirmed!==true){result.notes.unshift('受給者区分と、当月の支給/算定資格・開始月の前提確認が必要です。');return result;}
 let under3=0,older=0,countOnly=0,unknown=0;const individual=request.beneficiaryType==='individual';
 for(const c of children){
  if(c.status==='excluded')continue;
  if(!c.birthDate){unknown++;continue;}
  if(c.birthDate.slice(0,7)>=month||c.startMonth&&month<c.startMonth||c.endMonth&&month>c.endMonth)continue;
  const payEnd=fiscalEndAtAge(c.birthDate,18),countEnd=fiscalEndAtAge(c.birthDate,22);
  if(first>(individual?countEnd:payEnd))continue;
  if(c.status==='unknown'){unknown++;continue;}
  if(first>payEnd){if(individual)countOnly++;continue;}
  const thirdBirthdayMonth=String(Number(c.birthDate.slice(0,4))+3).padStart(4,'0')+c.birthDate.slice(4,7);
  if(month<=thirdBirthdayMonth)under3++;else older++;
 }
 if(unknown){result.notes.unshift('支給額や第3子算定に影響する確認待ちの子がいます。未確認を0人として計算しません。');return result;}
 const olderBasic=individual?Math.min(older,Math.max(0,2-countOnly)):older;
 const under3Basic=individual?Math.min(under3,Math.max(0,2-countOnly-older)):under3;
 const multi=individual?older-olderBasic+under3-under3Basic:0;
 result.amountYen=olderBasic*d.rates.older+under3Basic*d.rates.under3+multi*d.rates.third;
 result.breakdown={countOnly,olderBasic,olderBasicYen:olderBasic*d.rates.older,under3Basic,under3BasicYen:under3Basic*d.rates.under3,multi,multiYen:multi*d.rates.third};result.status='calculated';
 if(month>nowMonth)result.notes.unshift('将来月の試算：現在確認した制度と入力の資格/監護等の状態が続く仮定です。');
 if(!individual)result.notes.unshift('法人後見人・施設等の区分には第3子加算を適用しません。');
 return result;
}
export async function saveAmountRules(env,clock=new Date()){
 validateAmountRules(amountRules);if(amountRules.sources.some(s=>Date.parse(s.checkedAt)>+clock))throw Error('future_amount_sources');
 const p=await env.DB.prepare('SELECT id FROM programs WHERE id=?').bind(amountRules.programId).first();if(!p)throw Error('amount_program_missing');
 const json=JSON.stringify(amountRules),digest=await hash(json);
 const previous=await env.DB.prepare('SELECT content_hash FROM support_amount_versions WHERE program_id=? AND version=?').bind(amountRules.programId,amountRules.version).first();
 if(previous){if(previous.content_hash!==digest)throw Error('amount_version_collision');return{status:'saved',changed:false,sha256:digest};}
 await env.DB.prepare('INSERT OR IGNORE INTO support_amount_versions(program_id,version,content_hash,document_json,stored_at) VALUES(?,?,?,?,?)').bind(amountRules.programId,amountRules.version,digest,json,clock.toISOString()).run();
 const check=await env.DB.prepare('SELECT content_hash FROM support_amount_versions WHERE program_id=? AND version=?').bind(amountRules.programId,amountRules.version).first();if(check?.content_hash!==digest)throw Error('amount_version_collision');return{status:'saved',changed:true,sha256:digest};
}
export async function readAmountRules(env){const row=await env.DB.prepare('SELECT content_hash,document_json FROM support_amount_versions WHERE program_id=? AND version=?').bind(amountRules.programId,AMOUNT_ENGINE_VERSION).first();if(!row)return null;if(await hash(row.document_json)!==row.content_hash)throw Error('amount_integrity_failed');return{document:validateAmountRules(JSON.parse(row.document_json)),sha256:row.content_hash};}
export async function calculateStoredAmount(env,request,clock=new Date()){
 const saved=await readAmountRules(env);if(!saved)return null;
 const conditions=await readConditions(env,amountRules.programId);if(!conditions)throw Error('conditions_missing');
 const p=await env.DB.prepare('SELECT id,status,verification FROM programs WHERE id=?').bind(amountRules.programId).first();if(!p)return null;
 return calculateLoadedAmount(saved,conditions,p,request,clock);
}
function calculateLoadedAmount(saved,conditions,p,request,clock){
 const result=calculateAmount(saved.document,request,clock);result.rulesSha256=saved.sha256;result.conditionSha256=conditions.sha256;
 if(p.status==='ended'||p.verification==='rejected'||conditions.document.version!=='2026-11-16.1'){result.status='needs_review';result.amountYen=null;result.breakdown=null;result.notes.unshift('制度・条件の状態/版を再確認してください。');}return result;
}
export async function checkStoredAmounts(env,clock=new Date()){
 const saved=await readAmountRules(env);if(!saved)throw Error('amount_rules_missing');const conditions=await readConditions(env,amountRules.programId),p=await env.DB.prepare('SELECT id,status,verification FROM programs WHERE id=?').bind(amountRules.programId).first();if(!conditions||!p)throw Error('amount_conditions_missing');const month=japanDay(clock).slice(0,7),y=Number(month.slice(0,4));
 const c=(age,status='confirmed')=>({birthDate:`${y-age}-01-02`,status});const req=(type,children)=>({programId:amountRules.programId,beneficiaryType:type,month,assumptionsConfirmed:true,children});
 const tests=[[req('individual',[c(8),c(6),c(1)]),50000],[req('individual',[c(20),c(8),c(6)]),40000],[req('facility',[c(1),c(1),c(1)]),45000],[req('corporate_guardian',[c(8),c(6),c(1)]),35000],[req('individual',[c(8,'unknown')]),null],[{...req('individual',[c(1)]),assumptionsConfirmed:false},null]];
 const sourceAge=(Date.parse(japanDay(clock))-Date.parse(saved.document.checkedOn))/86400000,fresh=sourceAge>=0&&sourceAge<=30;
 for(const [request,expected]of tests){const r=calculateLoadedAmount(saved,conditions,p,request,clock);if(r?.amountYen!==(fresh?expected:null)||r.adjudication!=='not_performed')throw Error('amount_canary_failed');}
 return{kind:'synthetic_amount_checks',checkedAt:clock.toISOString(),engineVersion:AMOUNT_ENGINE_VERSION,rulesSha256:saved.sha256,passed:6,failed:0,sourceReviewRequired:!fresh};
}
export async function runSupportWithAmounts(env){let result,error;try{result=await runSupportWithEligibility(env)}catch(e){error=e}let amounts;
 try{const saved=await saveAmountRules(env),check=await checkStoredAmounts(env);const persisted=await env.DB.prepare('INSERT INTO support_feature_checks(feature_id,result_json,checked_at) VALUES(?,?,?) ON CONFLICT(feature_id) DO UPDATE SET result_json=excluded.result_json,checked_at=excluded.checked_at').bind('amounts',JSON.stringify(check),check.checkedAt).run();if(persisted?.success!==true)throw Error('amount_check_storage_failed');amounts={status:'passed',passed:check.passed,changed:saved.changed,sourceReviewRequired:check.sourceReviewRequired};}catch{amounts={status:'failed',code:'amount_checks_failed'}}if(error)throw error;return{...result,amounts};}
