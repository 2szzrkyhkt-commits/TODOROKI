import {MAX_BYTES, MAX_ROWS, SUBJECTS, publicRow} from '../../assets/tax-public-metadata.mjs';
import {effectiveState, japanDay} from './history.mjs';
import {ntaURL} from './nta.mjs';

const prefixes = ['revision:', 'nta:page:'];
const snapshotKey = 'public-tax-catalog';
const progressKey = 'public-tax-catalog-progress';

function subjectsFor(title, path = '') {
  const hits = SUBJECTS.filter(s => title.includes(s));
  const topics = [
    ['簿記論', /簿記|帳簿|会社計算規則/],
    ['財務諸表論', /財務諸表|会計基準|会社計算規則/],
    ['所得税法', /所得税|源泉徴収|\/shotoku\b|\/gensen\b/],
    ['法人税法', /法人税|\/hojin\b/],
    ['相続税法', /相続税|贈与税|\/sozoku\b|\/zoyo\b/],
    ['消費税法', /消費税|インボイス|\/shohi\b/],
    ['酒税法', /酒税/],
    ['国税徴収法', /国税徴収/],
    ...['住民税', '事業税', '固定資産税'].map(subject => [subject, /地方税法/]),
  ];
  for (const [subject, pattern] of topics) if (pattern.test(title + ' ' + path)) hits.push(subject);
  return hits.length ? [...new Set(hits)] : ['実務・関連資料'];
}

export function projectCatalogRecord(key, meta, now) {
  if (!meta || typeof meta.title !== 'string' || !/^[a-f0-9]{64}$/.test(meta.sha256) ||
      !Number.isSafeInteger(meta.bytes) || meta.bytes < 1) return null;
  if (key.startsWith('revision:')) {
    const revision = meta.revision_info;
    if (!revision || key !== 'revision:' + meta.revision_id || revision.law_revision_id !== meta.revision_id ||
        !meta.revision_id.startsWith(meta.law_id + '_')) return null;
    return publicRow({kind: 'law', title: meta.title, checked: meta.collected_at, number: meta.revision_id,
      subjects: subjectsFor(meta.title), state: effectiveState(revision, japanDay(now)),
      promulgated: revision.amendment_promulgate_date, effective: revision.amendment_enforcement_date});
  }
  if (!/^nta:page:[a-f0-9]{64}$/.test(key) || typeof meta.url !== 'string' || ntaURL(meta.url) !== meta.url ||
      meta.source !== '国税庁' || meta.source_url !== meta.url ||
      meta.raw_key !== 'nta:raw:' + key.slice('nta:page:'.length) + ':' + meta.sha256) return null;
  const path = new URL(meta.url).pathname;
  const kind = path.startsWith('/law/tsutatsu/') ? 'circular' : path.includes('/taxanswer/') ? 'answer' : null;
  return publicRow({kind, title: meta.title.replace(/\s+/g, ' ').slice(0, 300), checked: meta.checked_at,
    subjects: subjectsFor(meta.title, path)});
}

// A complete scan replaces the public snapshot in one write. Failed pages retain
// the previous snapshot and cursor. Only the existing collection tick calls this.
export async function advancePublicCatalog(kv, now = new Date().toISOString()) {
  const progress = await kv.get(progressKey, 'json') || {phase: 0, cursor: null, rows: [], held: 0};
  const page = await kv.list({prefix: prefixes[progress.phase], limit: 50, ...(progress.cursor ? {cursor: progress.cursor} : {})});
  if (!page.list_complete && (!page.cursor || page.cursor === progress.cursor)) throw Error('catalog_cursor');
  const keys = page.keys.map(key => key.name);
  const records = keys.length ? await kv.get(keys, 'json') : new Map();
  for (const key of keys) {
    const meta = records.get(key);
    if (!meta) throw Error('catalog_metadata_unavailable');
    const row = projectCatalogRecord(key, meta, now);
    if (row) progress.rows.push(row);
    else progress.held++;
  }
  if (progress.rows.length > MAX_ROWS) throw Error('catalog_row_limit');
  if (page.list_complete) {
    progress.phase++;
    progress.cursor = null;
  } else {
    progress.cursor = page.cursor;
  }
  if (progress.phase === prefixes.length) {
    const snapshot = JSON.stringify({updated: now, rows: progress.rows});
    if (new TextEncoder().encode(snapshot).length > MAX_BYTES) throw Error('catalog_size_limit');
    await kv.put(snapshotKey, snapshot);
    await kv.put(progressKey, JSON.stringify({phase: 0, cursor: null, rows: [], held: 0}));
    return {state: 'published', published: progress.rows.length, held: progress.held};
  }
  await kv.put(progressKey, JSON.stringify(progress));
  return {state: 'scanning', verified_metadata: progress.rows.length, held: progress.held};
}

export const readPublicCatalog = kv => kv.get(snapshotKey, 'json');
