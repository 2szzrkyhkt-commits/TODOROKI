import assert from 'node:assert/strict';
import {test} from 'node:test';
import {archiveSelection} from '../../assets/article-ticker.mjs';
import {synchronizeArticles} from '../sync-article-revival.mjs';

const day = 86_400_000;
const candidates = Array.from({length:60}, (_, index) => ({
  url:'/entry-'+index, title:'Entry '+index, date:'2026-10-23',
}));
const data = {minAge:30,candidates};

test('rotates at 04:00 JST, excluding new articles and retaining distinct targets', () => {
  const boundary = Date.parse('2026-11-21T19:00:00Z');
  const latest = new Set(['/entry-3']);
  assert.deepEqual(archiveSelection(data,latest,boundary-1), []);
  const today = archiveSelection(data,latest,boundary);
  const tomorrow = archiveSelection(data,latest,boundary+day);
  assert.equal(today.length,24);
  assert.equal(new Set(today.map(a=>a.url)).size,24);
  assert(!today.some(a=>latest.has(a.url)));
  assert.deepEqual(archiveSelection(data,latest,boundary+day-1),today);
  assert.notDeepEqual(tomorrow,today);
});

test('gives every eligible article equal exposure over a rotation cycle', () => {
  const start = Date.parse('2026-11-23T10:00:00Z');
  const exposure = new Map(candidates.map(entry => [entry.url,0]));
  for (let i=0; i<60; i++) for (const entry of archiveSelection(data,new Set(),start+i*day)) {
    exposure.set(entry.url,exposure.get(entry.url)+1);
  }
  assert.deepEqual(new Set(exposure.values()),new Set([24]));
});

test('maintains original link targets and filters non-articles, self links and duplicates', async () => {
  const result = await synchronizeArticles({write:false,now:Date.parse('2026-11-23T05:00:00Z')});
  const byUrl = new Map(result.inventory.map(article => [article.url,article]));
  assert(result.selected > 0);
  assert(!byUrl.has('/site-map'));
  assert(!byUrl.get('/nvidia-jensen-huang-spy-allegations-2026').archiveEligible);
  assert.equal(byUrl.get('/price-value').published,null);
  for (const {url,candidates} of result.opportunities) {
    assert(candidates.length <= 5);
    assert.equal(new Set(candidates.map(a=>a.url)).size,candidates.length);
    for (const candidate of candidates) {
      assert(byUrl.has(candidate.url));
      assert.notEqual(candidate.url,url);
    }
  }
});

test('uses measured GSC data only with missing rows left null', async () => {
  const {reviewQueue} = await import('../article-revival-report.mjs');
  const inventory = ['/a','/b'].map(url=>({url,title:url,observedBy:'2026-10-08',internalArticleLinks:1}));
  const row = clicks => ({keys:['https://todoroki-gold.com/a'],clicks,impressions:200,position:10});
  const results = reviewQueue(inventory,{
    current:{start:'2026-11-15',end:'2026-11-21',rows:[row(2)]},
    previous:{start:'2026-11-08',end:'2026-11-14',rows:[row(5)]},
  },Date.parse('2026-11-23'));
  assert.equal(results[0].ctr,0.01);
  assert.equal(results[0].clickChange,-0.6);
  assert.equal(results[1].clicks,null);
  assert.equal(results[1].indexing,null);
});

test('X drafts skip recently posted or unreviewed pages', async () => {
  const {xDraft} = await import('../article-revival-report.mjs');
  const inventory = ['/price-value','/margin-of-safety'].map(url=>({url,archiveEligible:true,observedBy:'2026-10-23'}));
  const now = Date.parse('2026-11-23');
  assert.equal(xDraft(inventory,[{url:'/price-value',date:'2026-11-22'}],now).url,'/margin-of-safety');
  assert.equal(xDraft(inventory,inventory.map(({url})=>({url,date:'2026-11-22'})),now),null);
});
