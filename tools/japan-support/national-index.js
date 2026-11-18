import {sha256} from './catalog.js';
export const NATIONAL_SOURCE='mhlw-livelihood-index';
export const NATIONAL_URL='https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000059425.html';
export const NATIONAL_PARSER='2026-11-18.1';
export const NATIONAL_ATTRIBUTION='出典：厚生労働省「生活困窮者自立支援制度」（'+NATIONAL_URL+'）。TODOROKIが事業見出しの抽出・項目整理・ID付与を実施。厚生労働省による判定・推奨ではありません。';
const SECTION='生活困窮者自立支援制度の各事業の概要';
const text=s=>s.replace(/<[^>]*>/g,' ').replace(/&#x([\da-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();
export function nationalNames(html){
 if(typeof html!=='string'||html.length>524288||/[\u0000\ufffd]/.test(html))throw Error('invalid_national_index');
 const clean=html.replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|style|template|noscript|textarea)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'');
 if(/<(script|style|template|noscript|textarea)\b/i.test(clean))throw Error('invalid_national_index');
 const headings=[...clean.matchAll(/<h([23])\b[^>]*>([\s\S]*?)<\/h\1\s*>/gi)].map(m=>({level:Number(m[1]),name:text(m[2])}));
 const starts=headings.map((h,i)=>h.level===2&&h.name===SECTION?i:-1).filter(i=>i>=0);
 if(starts.length!==1)throw Error('national_section_missing');
 const names=[];for(let i=starts[0]+1;i<headings.length&&headings[i].level!==2;i++)names.push(headings[i].name);
 if(!names.length||names.length>30||new Set(names).size!==names.length||names.some(n=>!n||n.length>100||/[<>\u0000-\u001f]/.test(n)))throw Error('invalid_national_headings');
 return names;
}
export async function nationalCandidate(html,sourceHash){
 if(!/^[a-f0-9]{64}$/.test(sourceHash)||await sha256(html)!==sourceHash)throw Error('national_source_hash_mismatch');
 const names=nationalNames(html),items=[];
 for(const name of names)items.push({id:NATIONAL_SOURCE+':'+(await sha256(name)).slice(0,16),name,sourceURL:NATIONAL_URL,sourceHeading:name,verification:'pending',eligibility:'not_evaluated',amount:'not_calculated',localAvailability:'unconfirmed'});
 return {schemaVersion:1,kind:'national_support_program_index',sourceId:NATIONAL_SOURCE,parserVersion:NATIONAL_PARSER,sourceURL:NATIONAL_URL,sourceSha256:sourceHash,publisher:'厚生労働省',license:'conditional-PDL1.0',termsURL:'https://www.mhlw.go.jp/chosakuken/index.html',attribution:NATIONAL_ATTRIBUTION,coverage:'one_official_index_not_nationwide',publishedOn:null,verification:'pending',requires:'individual_program_fact_condition_amount_and_local_availability_review',itemCount:items.length,items};
}
export async function readNationalIndex(db,hash,expected=null){
 if(!/^[a-f0-9]{64}$/.test(hash||''))throw Error('national_archive_hash_invalid');
 const row=await db.prepare('SELECT candidate_json FROM revisions WHERE source_id=? AND content_hash=?').bind(NATIONAL_SOURCE,hash).first();
 if(!row||await sha256(row.candidate_json)!==hash)throw Error('national_readback_failed');
 const d=JSON.parse(row.candidate_json);
 if(d.schemaVersion!==1||d.kind!=='national_support_program_index'||d.sourceId!==NATIONAL_SOURCE||d.parserVersion!==NATIONAL_PARSER||d.sourceURL!==NATIONAL_URL||d.verification!=='pending'||d.coverage!=='one_official_index_not_nationwide'||!Array.isArray(d.items)||!d.items.length||d.items.length>30||d.itemCount!==d.items.length)throw Error('national_archive_invalid');
 if(expected&&row.candidate_json!==JSON.stringify(expected))throw Error('national_readback_failed');
 return {itemCount:d.itemCount,documentHash:hash,sourceHash:d.sourceSha256};
}
