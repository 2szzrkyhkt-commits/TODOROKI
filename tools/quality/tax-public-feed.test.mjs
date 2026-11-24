import test from 'node:test';
import assert from 'node:assert/strict';
import {taxPublicFeed} from '../../tax-public-feed.mjs';
import {advancePublicCatalog, readPublicCatalog} from '../tax/public-catalog.mjs';

const updated = '2026-11-24T06:00:00.000Z';
const endpoint = 'https://todoroki-gold.com/api/tax-catalog';
const row = {kind: 'law', title: '地方税法', subjects: ['住民税', '事業税', '固定資産税'], checked: updated,
  number: '325AC0000000226_20261201_508AC0000000012', state: '未施行', promulgated: '2026-03-31', effective: '2026-12-01'};

test('catalog publishes verified metadata only after both scans and preserves it on read failure', async () => {
  const key = 'revision:' + row.number;
  const source = new Map([[key, {title: row.title, law_id: '325AC0000000226', revision_id: row.number,
    source_url: 'https://example.org/private', bytes: 50, sha256: 'a'.repeat(64), collected_at: updated,
    revision_info: {law_revision_id: row.number, amendment_enforcement_date: row.effective, amendment_promulgate_date: row.promulgated}}]]);
  const kv = {
    async get(key) {return Array.isArray(key) ? new Map(key.map(k => [k, source.get(k)])) : source.get(key);},
    async put(key, value) {source.set(key, JSON.parse(value));},
    async list({prefix}) {return {list_complete: true, keys: [...source.keys()].filter(k => k.startsWith(prefix)).map(name => ({name}))};},
  };
  assert.equal((await advancePublicCatalog(kv, updated)).state, 'scanning');
  assert.equal(await readPublicCatalog(kv), undefined);
  assert.deepEqual(await advancePublicCatalog(kv, updated), {state: 'published', published: 1, held: 0});
  assert.deepEqual(await readPublicCatalog(kv), {updated, rows: [row]});
  kv.get = async () => {throw Error('unavailable');};
  await assert.rejects(advancePublicCatalog(kv, updated));
  assert.deepEqual(source.get('public-tax-catalog'), {updated, rows: [row]});
});

test('same-origin RPC strips private URLs and fields from response and cached data', async () => {
  let stored;
  let calls = 0;
  const cache = {async match() {return stored?.clone();}, async put(_, response) {stored = response;}};
  const env = {TAX_PUBLIC_FEED: {async catalog(...args) {
    assert.deepEqual(args, []);
    calls++;
    return {updated, rows: [{...row, official_url: 'https://example.org/private', raw_key: 'private'}]};
  }}};
  for (let i = 0; i < 2; i++) {
    const res = await taxPublicFeed(new Request(endpoint), env, cache);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), {updated, rows: [row]});
  }
  assert.equal(calls, 1);
  assert.equal((await taxPublicFeed(new Request(endpoint + '?key=private'), env, cache)).status, 400);
  assert.equal((await taxPublicFeed(new Request(endpoint), {}, null)).status, 503);
  const bad = {TAX_PUBLIC_FEED: {catalog: async () => ({updated, rows: [{...row, title: 'https://example.org'}]})}};
  assert.equal((await taxPublicFeed(new Request(endpoint), bad, null)).status, 503);
});
