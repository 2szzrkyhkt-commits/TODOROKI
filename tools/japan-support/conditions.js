import {conditionDocuments} from './conditions-data.js';
import {collectAndMonitor} from './monitor.js';
const id = value => typeof value==='string' && /^[a-z][a-z0-9_-]{0,79}$/.test(value);
const day = value => typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value;
const fail=()=>{throw Error('invalid_condition_document')};
const kinds=new Set(['fiscal_age_limit','residence_with_exception','no_income_limit','case_review','all_with_exception','certification_required','application_office','relative_deadline']);
const categories=new Set(['eligibility','recipient','priority','exception','procedure']);
export function validateConditionDocument(d) {
 if(!d || d.schemaVersion!==1 || !id(d.programId) || typeof d.version!=='string' || !/^\d{4}-\d{2}-\d{2}\.\d+$/.test(d.version) || d.verification!=='source_checked_not_adjudicated' || d.scope!=='current_catalog_only' || !day(d.sourceCheckedOn) || !day(d.effectiveFrom) || (d.effectiveTo!==null&&!day(d.effectiveTo)) || (d.effectiveTo && d.effectiveTo<d.effectiveFrom))fail();
 if(typeof d.attribution!=='string'||!d.attribution.includes('TODOROKI')||!Array.isArray(d.notices)||!d.notices.length)fail();
 if(!Array.isArray(d.sources)||!d.sources.length||d.sources.length>20)fail();
 const refs=new Set();
 for(const s of d.sources){let u;try{u=new URL(s.url)}catch{fail()};if(!id(s.id)||refs.has(s.id)||u.protocol!=='https:'||u.username||u.password||!['www.cfa.go.jp','lifedesign-information.cfa.go.jp','laws.e-gov.go.jp'].includes(u.hostname)||!s.section||!day(s.checkedOn)||!/^\d{4}-\d{2}-\d{2}T/.test(s.checkedAt||'')||!Number.isFinite(Date.parse(s.checkedAt))||s.checkedAt.slice(0,10)!==s.checkedOn||!/^([0-9a-f]{64})$/.test(s.sha256||''))fail();refs.add(s.id);}
 if(!Array.isArray(d.fields)||!d.fields.length||d.fields.length>100)fail();const fields=new Set();
 for(const f of d.fields){if(!id(f.id)||fields.has(f.id)||!['boolean','date','enum','integer'].includes(f.type)||f.missing!=='requires_review'||f.required!==false||!Array.isArray(f.values))fail();if(f.type==='enum'&&(!f.values.length||new Set(f.values).size!==f.values.length||f.values.some(v=>!id(v))))fail();if(f.type!=='enum'&&f.values.length)fail();fields.add(f.id);}
 if(!Array.isArray(d.clauses)||!d.clauses.length||d.clauses.length>100)fail();const clauses=new Set();
 for(const c of d.clauses){if(!id(c.id)||clauses.has(c.id)||!categories.has(c.category)||!kinds.has(c.kind)||!['source_checked','requires_review'].includes(c.verification)||!refs.has(c.source)||!c.locator||c.missing!=='requires_review'||!Array.isArray(c.fields)||c.fields.some(f=>!fields.has(f))||!c.value||Array.isArray(c.value)||typeof c.value!=='object')fail();
  if(c.kind==='no_income_limit' && c.value.incomeLimit!==null)fail();
  if(c.kind==='fiscal_age_limit'&&(!Number.isInteger(c.value.age)||c.value.age<1||c.value.age>125||c.value.end!=='first_march31_on_or_after_age_attainment'||c.value.inclusive!==true))fail();
  if(c.kind==='relative_deadline'&&(!Number.isInteger(c.value.days)||c.value.days<1||c.value.days>366||c.value.count_from!=='day_after_event'))fail();
  if(c.kind==='all_with_exception'&&(!c.value.all||Object.entries(c.value.all).some(([f,v])=>!fields.has(f)||typeof v!=='boolean')))fail();
  clauses.add(c.id);
 }
 for(const c of d.clauses)if(c.value.exception&&!clauses.has(c.value.exception))fail();
 if(JSON.stringify(d).length>100000)fail();return d;
}
export function validateAnswers(document,answers) {
 validateConditionDocument(document);
 if(!answers||typeof answers!=='object'||Array.isArray(answers))throw Error('invalid_answers');
 const result={},fields=new Map(document.fields.map(f=>[f.id,f]));
 for(const [key,value] of Object.entries(answers)) {
  const f=fields.get(key);if(!f)throw Error('unknown_answer_field');
  if(value===null||value===''){result[key]=null;continue;}
  if((f.type==='boolean'&&typeof value!=='boolean')||(f.type==='date'&&!day(value))||(f.type==='enum'&&!f.values.includes(value))||(f.type==='integer'&&!Number.isSafeInteger(value)))throw Error('invalid_answer_type');
  result[key]=value;
 }
 // No truthiness conversion and no adjudication: missing information stays null.
 for(const f of fields.values())if(!(f.id in result))result[f.id]=null;
 return result;
}
async function digest(s) {return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,'0')).join('');}
export async function saveConditionDocuments(env,documents=conditionDocuments,clock=new Date()) {
 if(!Number.isFinite(+clock))throw Error('invalid_clock');
 // Validate the entire package before the first write.
 documents.forEach(validateConditionDocument);
 const keys=documents.map(d=>d.programId+'@'+d.version);if(new Set(keys).size!==keys.length)throw Error('duplicate_condition_version');
 let saved=0,unchanged=0;
 for(const d of documents){
  if(d.sourceCheckedOn>clock.toISOString().slice(0,10)||d.sources.some(s=>Date.parse(s.checkedAt)>+clock))throw Error('future_source_check');
  const program=await env.DB.prepare('SELECT id FROM programs WHERE id=?').bind(d.programId).first();if(!program)throw Error('condition_program_missing');
  const json=JSON.stringify(d),hash=await digest(json);
  const previous=await env.DB.prepare('SELECT content_hash,document_json FROM support_condition_versions WHERE program_id=? AND version=?').bind(d.programId,d.version).first();
  if(previous){if(previous.content_hash!==hash)throw Error('condition_version_collision');if(previous.document_json!==json)throw Error('condition_integrity_failed');unchanged++;continue;}
  const r=await env.DB.prepare('INSERT OR IGNORE INTO support_condition_versions(program_id,version,content_hash,document_json,stored_at) VALUES(?,?,?,?,?)').bind(d.programId,d.version,hash,json,clock.toISOString()).run();
  const check=await env.DB.prepare('SELECT content_hash,document_json FROM support_condition_versions WHERE program_id=? AND version=?').bind(d.programId,d.version).first();if(check?.content_hash!==hash)throw Error('condition_version_collision');if(check.document_json!==json)throw Error('condition_integrity_failed');
  if(r.meta?.changes)saved++;else unchanged++;
 }
 return {status:'saved',documents:documents.length,saved,unchanged};
}
export async function readConditions(env,programId) {
 if(!id(programId))return null;
 const rows=await env.DB.prepare('SELECT version,content_hash,document_json,stored_at FROM support_condition_versions WHERE program_id=? ORDER BY stored_at DESC,version DESC LIMIT 1').bind(programId).first();
 if(!rows)return null;
 if(await digest(rows.document_json)!==rows.content_hash)throw Error('condition_integrity_failed');
 const document=validateConditionDocument(JSON.parse(rows.document_json));if(document.programId!==programId||document.version!==rows.version)throw Error('condition_integrity_failed');
 return {document,storedAt:rows.stored_at,sha256:rows.content_hash,adjudication:'not_performed'};
}
export async function runSupport(env) {
 let result,error;try{result=await collectAndMonitor(env)}catch(e){error=e}
 let conditions;try{conditions=await saveConditionDocuments(env)}catch{conditions={status:'failed',code:'conditions_storage_failed'}}
 if(error)throw error;
 return {...result,conditions};
}
