import {validateAnswers,validateConditionDocument,readConditions,runSupport} from './conditions.js';
export const ENGINE_VERSION='2026-11-16.1';
export function validDate(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
export const japanDay=clock=>new Date(+clock+9*3600000).toISOString().slice(0,10);
// Legal age attainment is at the end of the day preceding the birthday.
// Equivalent for this fiscal-year boundary: Apr 1 belongs to the earlier cohort.
export function childFiscalEnd(birth){
 if(!validDate(birth))throw Error('invalid_birth_date');
 const year=Number(birth.slice(0,4))+18,monthDay=birth.slice(5);
 return String(year+(monthDay>'04-01'?1:0)).padStart(4,'0')+'-03-31';
}
export function assessDocument(document,input,asOf) {
 validateConditionDocument(document);if(!validDate(asOf))throw Error('invalid_assessment_date');
 const a=validateAnswers(document,input),reasons=[];
 const reason=(id,status,message)=>{const c=document.clauses.find(c=>c.id===id);reasons.push({id,status,message,source:c?document.sources.find(s=>s.id===c.source)?.url:null,locator:c?.locator||null});};
 const result={engineVersion:ENGINE_VERSION,programId:document.programId,conditionVersion:document.version,assessedOn:asOf,sourceCheckedOn:document.sourceCheckedOn,adjudication:'not_performed',requiresAuthorityReview:true,status:'needs_review',reasons,applicationOffice:'要確認',coverage:'収録中の児童手当1制度。この児童の支給対象条件の照合。受給認定・金額・他制度・兄姉の人数算定は含みません。'};
 if(document.programId!=='jp-child-allowance'||document.version!=='2026-11-16.1'){reason('engine','review','この条件版の判定手順は未対応です。');return result;}
 const ageOfSource=(Date.parse(asOf)-Date.parse(document.sourceCheckedOn))/86400000;
 if(asOf<document.effectiveFrom||document.effectiveTo&&asOf>document.effectiveTo||ageOfSource<0||ageOfSource>30){reason('engine','review','適用時点または資料確認から30日以内という運用上の鮮度条件を確認できません。最新資料の再照合が必要です。');return result;}
 if(a.child_birth_date&&a.child_birth_date>asOf)throw Error('future_birth_date');
 const end=a.child_birth_date?childFiscalEnd(a.child_birth_date):null;
 reason('age',end?(asOf<=end?'matched':'not_matched'):'missing',end?(asOf<=end?'支給対象児童の年齢範囲内です。':'この児童は支給対象年齢の年度末を過ぎています。兄姉の人数算定は別の確認です。'):'児童の生年月日が未入力です。');
 if(a.child_residence===null)reason('residence','missing','児童の居住状況が未入力です。');
 else if(a.child_residence==='japan')reason('residence','matched','児童は国内居住の条件に一致します。');
 else if(a.study_abroad===false)reason('residence','not_matched','国外居住で留学の例外に該当しないという入力です。');
 else reason('residence',a.study_abroad===null?'missing':'review','国外居住の留学要件・再留学の例外は窓口確認が必要です。');
 reason('income','matched','この条件版には所得制限を設けていません。所得情報は入力・送信しません。');
 const missing=[];const needed=['recipient_role','custody','livelihood_relationship','recipient_residence','facility_or_foster_placement','separated_parents'];
 for(const f of needed)if(a[f]===null||a[f]==='unconfirmed')missing.push(f);
 if(a.recipient_role==='parent'){
  reason('recipient',a.custody===false||a.recipient_residence==='overseas'?'not_matched':missing.length?'missing':'matched','父母の監護・国内住所・生計同一の入力を照合します。後見・他の受給者との関係は別途確認が必要です。');
 }else reason('recipient',a.recipient_role===null?'missing':'review','父母指定者・後見人・その他養育者・施設等の受給者確認を窓口で行ってください。');
 const exceptional=a.recipient_role==='parent'&&a.livelihood_relationship==='maintains_livelihood'||a.facility_or_foster_placement===true||a.separated_parents===true||a.child_residence==='overseas'||a.recipient_role!==null&&a.recipient_role!=='parent';
 for(const c of document.clauses.filter(c=>!['age','residence','income','recipient'].includes(c.id))){
  const procedural=c.category==='procedure';
  reason(c.id,'review',procedural?'申請・認定・申請先と手続期限は窓口で確認してください。未申請や申請遅れだけで制度全体の対象外とは判定しません。':'例外や受給者の優先関係について個別確認が必要です。');
 }
 // Do not apply a parent's custody/livelihood test to a facility/foster route.
 const fails=reasons.some(r=>r.status==='not_matched'&&(r.id!=='recipient'||!exceptional));
 if(fails)result.status='not_matching';
 else if(reasons.some(r=>['age','residence'].includes(r.id)&&r.status==='missing')||a.recipient_role===null||!exceptional&&missing.length)result.status='insufficient_input';
 else if(exceptional)result.status='needs_review';
 else result.status='candidate';
 if(a.recipient_role==='facility_or_foster'||a.facility_or_foster_placement===true)result.applicationOffice='施設・里親等の受給者区分を窓口確認（公務員の里親も勤務先とは限りません）';
 else if(a.public_servant===true)result.applicationOffice='勤務先（所属庁）。受給者区分は要確認';
 else if(a.public_servant===false)result.applicationOffice='原則、受給者の居住市区町村';
 if(a.municipal_certification!=='approved')reason('application','review','認定済みとの入力はありません。候補表示は支給認定を意味しません。');
 // Return no input answers, birth date, or named personal information.
 return result;
}
function text(value,max){if(value===undefined)return '';if(typeof value!=='string'||value.length>max)throw Error('invalid_search');return value.trim();}
export async function searchPrograms(env,filters={}) {
 const q=text(filters.q,100),region=text(filters.region,30)||'all',category=text(filters.category,100)||'all';
 if(!['all','national','prefecture','municipality','local'].includes(region))throw Error('invalid_search');
 const escaped=q.replace(/[\\%_]/g,m=>'\\'+m);
 const sql="SELECT id,name,category,region_level,agency,summary,application_url,verification,status FROM programs WHERE (name LIKE ? ESCAPE '\\' OR summary LIKE ? ESCAPE '\\') AND (?='all' OR region_level=? OR (?='local' AND region_level IN ('prefecture','municipality'))) AND (?='all' OR category=?) ORDER BY name LIMIT 101";
 const r=await env.DB.prepare(sql).bind('%'+escaped+'%','%'+escaped+'%',region,region,region,category,category).all();
 if(r.results.length>100)throw Error('search_scope_limit');return {programs:r.results,coverage:'現在収録1制度。検索結果0件は支援制度が存在しないことを意味しません。'};
}
export async function assessStored(env,programId,answers,clock=new Date()) {
 if(!Number.isFinite(+clock))throw Error('invalid_clock');
 const saved=await readConditions(env,programId);if(!saved)return null;
 const p=await env.DB.prepare('SELECT id,status,verification FROM programs WHERE id=?').bind(programId).first();if(!p)return null;
 const result=assessDocument(saved.document,answers,japanDay(clock));
 if(p.status==='ended'||p.verification==='rejected'){result.status='needs_review';result.reasons.unshift({id:'program_status',status:'review',message:'制度の終了・資料の確認状況を確認してください。',source:null,locator:null});}
 result.programVerification=p.verification;
 result.conditionSha256=saved.sha256;return result;
}
export async function readBoundedJSON(request){
 if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||''))throw Error('invalid_content_type');
 const reader=request.body?.getReader();if(!reader)throw Error('invalid_json');let size=0;const chunks=[];
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8192)throw Error('input_too_large');chunks.push(value)}}finally{await reader.cancel().catch(()=>{});}
 const bytes=new Uint8Array(size);let i=0;for(const c of chunks){bytes.set(c,i);i+=c.length;}return JSON.parse(new TextDecoder().decode(bytes));
}

// Runs only as part of the existing internal collector capability. These fixed
// synthetic cases validate deployed reads; they are not real users or awards.
export async function checkStoredEligibility(env,clock=new Date()) {
 const day=japanDay(clock),fy=Number(day.slice(0,4))-(day.slice(5)<='03-31'?1:0);
 const common={child_birth_date:`${fy-18}-04-02`,child_residence:'japan',recipient_role:'parent',recipient_residence:'japan',custody:true,livelihood_relationship:'same_livelihood',facility_or_foster_placement:false,separated_parents:false,public_servant:false,municipal_certification:'not_applied'};
 const saved=await readConditions(env,'jp-child-allowance');if(!saved)throw Error('stored_conditions_missing');
 const sourceAge=(Date.parse(day)-Date.parse(saved.document.sourceCheckedOn))/86400000;
 const fresh=saved.document.version==='2026-11-16.1'&&sourceAge>=0&&sourceAge<=30;
 const tests=[['candidate',common],['not_matching',{...common,child_birth_date:`${fy-18}-04-01`}],['insufficient_input',{...common,child_birth_date:null}],['needs_review',{...common,child_residence:'overseas',study_abroad:true}]];
 for(const [expected,a]of tests){const r=await assessStored(env,'jp-child-allowance',a,clock);if(r?.status!==(fresh?expected:'needs_review')||r.adjudication!=='not_performed')throw Error('eligibility_canary_mismatch');}
 const search=await searchPrograms(env,{q:'児童手当',region:'national'});if(!search.programs.some(p=>p.id==='jp-child-allowance'))throw Error('search_canary_mismatch');
 return {kind:'synthetic_checks_against_stored_conditions',engineVersion:ENGINE_VERSION,conditionVersion:saved.document.version,conditionSha256:saved.sha256,checkedAt:clock.toISOString(),passed:5,failed:0,sourceReviewRequired:!fresh};
}

export async function runSupportWithEligibility(env) {
 let result,error;try{result=await runSupport(env)}catch(e){error=e}
 let eligibilityCheck;try{const check=await checkStoredEligibility(env);await env.DB.prepare("INSERT INTO support_feature_checks(feature_id,result_json,checked_at) VALUES(?,?,?) ON CONFLICT(feature_id) DO UPDATE SET result_json=excluded.result_json,checked_at=excluded.checked_at").bind('eligibility',JSON.stringify(check),check.checkedAt).run();eligibilityCheck={status:'passed',passed:check.passed,sourceReviewRequired:check.sourceReviewRequired};}catch{eligibilityCheck={status:'failed',code:'eligibility_check_failed'}}
 if(error)throw error;return {...result,eligibilityCheck};
}
