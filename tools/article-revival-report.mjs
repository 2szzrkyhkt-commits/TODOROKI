import fs from 'node:fs/promises';
import {synchronizeArticles} from './sync-article-revival.mjs';

const origin = 'https://todoroki-gold.com';
const day = 86_400_000;
const reviews = [
  {url:'/price-value', checked:'2026-11-23', copy:'株価が安いだけで「割安」と言える？ 株価と企業価値の違いを押さえ、買値を考えるときの基準を整理します。'},
  {url:'/margin-of-safety', checked:'2026-11-23', copy:'推定した企業価値と買付価格の間に、どれだけ余裕を取るか。グレアムの「安全域」を数字の例で確認できます。'},
];

function searchRows(snapshot) {
  const entries = new Map();
  for (const row of snapshot?.rows ?? []) {
    const url = row.keys?.[0];
    if (!url?.startsWith(origin+'/') || !['impressions','clicks','position'].every(k => Number.isFinite(row[k]) && row[k]>=0) ||
        row.clicks>row.impressions) continue;
    const path = new URL(url).pathname;
    if (entries.has(path)) throw Error('Search Console must be grouped by page only: '+path);
    entries.set(path, row);
  }
  return entries;
}

export function reviewQueue(inventory, {current, previous, indexing} = {}, now = Date.now()) {
  const currentRows = searchRows(current), previousRows = searchRows(previous);
  const period = snapshot => (Date.parse(snapshot?.end)-Date.parse(snapshot?.start))/day+1;
  const comparable = period(current)>0 && period(current)===period(previous) &&
    Date.parse(previous?.end)+day===Date.parse(current?.start);
  return inventory.flatMap(article => {
    const date = article.published ?? article.observedBy;
    const age = (now-Date.parse(date))/day;
    if (age < 30) return [];
    const row = currentRows.get(article.url), old = previousRows.get(article.url);
    const ctr = row?.impressions > 0 ? row.clicks/row.impressions : null;
    const decline = comparable && row && old && old.clicks > 0 ? (row.clicks-old.clicks)/old.clicks : null;
    const reasons = [];
    if (row?.impressions >= 100 && ctr < 0.02) reasons.push('表示100回以上・CTR2%未満');
    if (decline !== null && decline <= -0.25) reasons.push('検索クリック25%以上減少');
    if (article.timeSensitive) reasons.push('数値・対象時点・一次資料の確認');
    if (article.internalArticleLinks < 2) reasons.push('本文の関連記事リンクが2件未満');
    if (!date) reasons.push('公開・掲載時点を確認');
    if (!reasons.length) return [];
    return [{url:article.url,title:article.title,reasons, clicks:row?.clicks ?? null,
      impressions:row?.impressions ?? null, ctr, position:row?.position ?? null, clickChange:decline,
      impressionChange:comparable && row && old ? row.impressions-old.impressions : null,
      positionChange:comparable && row && old ? row.position-old.position : null,
      indexing:indexing?.[article.url] ?? null}];
  }).sort((a,b) => Number(b.reasons.some(r=>/CTR|クリック/.test(r))) -
    Number(a.reasons.some(r=>/CTR|クリック/.test(r))) || (b.impressions ?? 0) - (a.impressions ?? 0) ||
    a.url.localeCompare(b.url));
}

export function xDraft(inventory, posted, now = Date.now()) {
  for (const review of reviews) {
    const article = inventory.find(item => item.url===review.url);
    if (!article?.archiveEligible || (now-Date.parse(review.checked))/day > 90 ||
        (now-Date.parse(article.published ?? article.observedBy))/day < 30) continue;
    if (posted.some(row => row.url===review.url && (now-Date.parse(row.date))/day<90)) continue;
    return {url:review.url, checked:review.checked, text:review.copy+'\n'+origin+review.url};
  }
  return null;
}

if (process.argv[1]?.endsWith('/article-revival-report.mjs')) {
  const {inventory, opportunities} = await synchronizeArticles({write:false});
  const input = process.argv[2] ? JSON.parse(await fs.readFile(process.argv[2],'utf8')) : {};
  const result = {searchPeriods:{current:input.current?.end ? [input.current.start,input.current.end] : null,
    previous:input.previous?.end ? [input.previous.start,input.previous.end] : null},
    review:reviewQueue(inventory,input), internalLinkCandidates:opportunities.filter(entry=>entry.bodyLinks.length),
    xDraft:Array.isArray(input.posted) ? xDraft(inventory,input.posted) : null};
  console.log(JSON.stringify(result,null,2));
}
