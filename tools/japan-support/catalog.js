// Fixed, reviewed open-data adapter. No discovery or linked-page crawling.
export const CATALOG_SOURCE='noshiro-support-csv';
export const CATALOG_URL='https://www.city.noshiro.lg.jp/up/files/www/city/opendata/oopun/052027_support_system_information%281%29.csv';
export const PARSER_VERSION='2026-11-17.1';
export const COLUMNS=['番号','所管部','所管課','支援名称','支援内容','対象者種別_個人_事業者_自治体','対象者詳細','支給額','制限・条件','受付時期','支援制度(給付金)の申請期限','根拠法令','制度名','詳細URL','分類','備考'];
export async function sha256(text){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');}
// RFC4180-style quotes, escaped quotes and multiline fields; reject malformed input.
export function parseCSV(text){
 if(typeof text!=='string'||text.includes('\u0000')||text.includes('\ufffd')||text.length>524288)throw Error('invalid_csv');
 text=text.replace(/^\ufeff/,'');const rows=[];let row=[],field='',quoted=false,closed=false;
 const cell=()=>{if(field.length>16000)throw Error('csv_cell_too_large');row.push(field);field='';closed=false;};
 const line=()=>{cell();if(row.some(s=>s!==''))rows.push(row);row=[];if(rows.length>201)throw Error('csv_too_many_rows');};
 for(let i=0;i<text.length;i++){const c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;}
  else if(c===',')cell();else if(c==='\r'||c==='\n'){if(c==='\r'&&text[i+1]==='\n')i++;line();}
  else if(c==='"'){if(field||closed)throw Error('invalid_csv_quote');quoted=true;}
  else {if(closed)throw Error('invalid_csv_quote');field+=c;}
 }
 if(quoted)throw Error('invalid_csv_quote');if(field||row.length||closed)line();return rows;
}
export function normalizeCatalog(text,clock=new Date()){
 if(!Number.isFinite(+clock))throw Error('invalid_clock');const [head,...rows]=parseCSV(text);
 if(!head||JSON.stringify(head)!==JSON.stringify(COLUMNS)||!rows.length)throw Error('unexpected_csv_schema');
 const seen=new Set();const items=rows.map(r=>{
  if(r.length!==COLUMNS.length)throw Error('invalid_csv_width');const n=r[0].trim();
  if(!/^\d{1,6}$/.test(n)||seen.has(n)||!r[3].trim())throw Error('invalid_catalog_identity');seen.add(n);
  const fields=Object.fromEntries(COLUMNS.map((k,i)=>[k,r[i].trim()||null]));
  let detailURL=null;try{const u=new URL(fields['詳細URL']);if(u.protocol==='https:'&&u.hostname==='www.city.noshiro.lg.jp'&&!u.username&&!u.password)detailURL=u.href;}catch{}
  return{id:CATALOG_SOURCE+':'+n,municipalityCode:'052027',name:fields['支援名称'],fields,detailURL,verification:'not_individually_verified',eligibility:'not_evaluated',amount:'not_calculated'};
 });
 return{schemaVersion:1,sourceId:CATALOG_SOURCE,parserVersion:PARSER_VERSION,sourceURL:CATALOG_URL,acquiredAt:clock.toISOString(),publisher:'秋田県能代市',license:'CC BY 4.0',licenseURL:'https://creativecommons.org/licenses/by/4.0/',catalogURL:'https://www.city.noshiro.lg.jp/city/opendata/oopun/25108',publisherPageUpdatedOn:'2026-08-31',publisherMetadataUpdatedOn:'2025-06-18',freshness:'publisher_dates_inconsistent_verify_individual_program',attribution:'支援制度(給付金)情報、秋田県能代市、CC BY 4.0。TODOROKIがCSVの項目整理・空欄のnull化・ID付与を実施。市作成の判定結果ではありません。',coverage:'one_municipality_published_dataset_not_nationwide',itemCount:items.length,items};
}
export async function saveCatalog(db,text,sourceHash,clock=new Date()){
 if(await sha256(text)!==sourceHash)throw Error('catalog_source_hash_mismatch');
 const d=normalizeCatalog(text,clock),json=JSON.stringify(d),hash=await sha256(json);
 // Immutable source-content snapshots; changed source never overwrites the old one.
 await db.prepare('INSERT OR IGNORE INTO support_catalog_snapshots(source_id,source_hash,parser_version,document_hash,document_json,acquired_at) VALUES(?,?,?,?,?,?)').bind(CATALOG_SOURCE,sourceHash,PARSER_VERSION,hash,json,clock.toISOString()).run();
 const saved=await readCatalog(db,sourceHash);if(!saved||saved.document.itemCount!==d.itemCount)throw Error('catalog_readback_failed');return{itemCount:saved.document.itemCount,sourceHash,documentHash:saved.sha256};
}
export async function readCatalog(db,sourceHash=null){
 const q=sourceHash?db.prepare('SELECT * FROM support_catalog_snapshots WHERE source_id=? AND source_hash=? AND parser_version=?').bind(CATALOG_SOURCE,sourceHash,PARSER_VERSION):db.prepare('SELECT * FROM support_catalog_snapshots WHERE source_id=? AND parser_version=? ORDER BY acquired_at DESC LIMIT 1').bind(CATALOG_SOURCE,PARSER_VERSION);
 const row=await q.first();if(!row)return null;if(await sha256(row.document_json)!==row.document_hash)throw Error('catalog_integrity_failed');
 const d=JSON.parse(row.document_json);if(d.schemaVersion!==1||d.sourceId!==CATALOG_SOURCE||d.parserVersion!==PARSER_VERSION||!Array.isArray(d.items)||d.itemCount!==d.items.length||!d.itemCount||d.itemCount>200)throw Error('catalog_invalid_snapshot');return{document:d,sha256:row.document_hash,sourceSha256:row.source_hash};
}
