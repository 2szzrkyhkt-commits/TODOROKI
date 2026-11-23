import fs from 'node:fs/promises';
import {themes, observedBy, archiveMinAge, evergreenTopics, anchorTargets} from './article-themes.mjs';
import {archiveSelection} from '../assets/article-ticker.mjs';

const origin = 'https://todoroki-gold.com';
const read = file => fs.readFile(file, 'utf8');
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const clean = text => text.replace(/<[^>]+>/g, '').replace(/&(amp|quot|lt|gt|nbsp|#39);/g,
  (_, key) => ({amp:'&', quot:'"', lt:'<', gt:'>', nbsp:' ', '#39':"'"}[key])).replace(/\s+/g, ' ').trim();
const links = html => [...html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)/gi)].map(([, href]) =>
  href.startsWith('/') && !href.startsWith('//') ? href.split(/[?#]/)[0].replace(/\.html$/, '') :
    href.startsWith(origin+'/') ? href.slice(origin.length).split(/[?#]/)[0].replace(/\.html$/, '') : '');
const list = (entries, event) => entries.map(({url, title}) =>
  '<li><a href="'+escape(url)+'"'+(event ? ' data-article-event="'+event+'"' : '')+'>'+escape(title)+'</a></li>').join('');
const fileFor = url => url.slice(1) + (url.endsWith('/') ? 'index.html' : '.html');
const region = (html, key, content, insert) => {
  const start = '<!-- article-revival:'+key+' -->';
  const end = '<!-- /article-revival:'+key+' -->';
  const existing = html.indexOf(start);
  const replacement = content ? start+content+end : '';
  if (existing >= 0) {
    const close = html.indexOf(end, existing);
    if (close < 0) throw Error('Unclosed generated region: '+key);
    return html.slice(0, existing)+replacement+html.slice(close+end.length);
  }
  return replacement ? insert(html, replacement) : html;
};
const before = (html, marker, text) => {
  if (!html.includes(marker)) throw Error('Missing insertion point '+marker);
  return html.replace(marker, () => text+marker);
};
const inMain = (html, content) => before(html, '</main>', content);
const styles = '<link rel="stylesheet" href="/assets/article-revival.css"><script defer src="/assets/article-events.js"></script>';
const prefix = url => url.match(/^\/(en|es|pt|zh-Hans|zh-Hant)\//)?.[1] ?? 'ja';
const labels = {ja:'関連記事', en:'Related articles', es:'Artículos relacionados', pt:'Artigos relacionados', 'zh-Hans':'相关文章', 'zh-Hant':'相關文章'};

export async function synchronizeArticles({write = true, now = Date.now()} = {}) {
  const index = await read('index.html');
  const catalog = index.split('id="home-article-catalog"')[1]?.split('</details>')[0];
  if (!catalog) throw Error('Missing homepage article catalog');
  const dated = new Map([...catalog.matchAll(/<a href="(\/[^"]+)"[^>]*><article\b(?:(?!<\/article>)[\s\S])*?<time datetime="(\d{4}-\d{2}-\d{2})"/g)]
    .map(([, url, date]) => [url, date]));
  const sitemap = await read('sitemap.xml');
  const urls = [...sitemap.matchAll(/<loc>https:\/\/todoroki-gold\.com(\/[^<]*)<\/loc>/g)].map(([, url]) => url);
  const redirects = await read('_redirects');
  const oldPaths = new Set(redirects.split('\n').map(line => line.trim().split(/\s+/)[0]));
  const pages = new Map(await Promise.all(urls.map(async url => [url, await read(fileFor(url))])));
  const categoryPaths = [...new Set(themes.map(([, , page]) => page).concat(['/current-affairs','/politics-society']))];
  const memberships = new Map(categoryPaths.map(url => [url, new Set(links(pages.get(url) ?? ''))]));
  const excluded = new Set(['/site-map','/editorial-policy','/data-use','/pdf-viewer','/sources']);
  const isThemeSeed = url => themes.some(([, , , order]) => order.includes(url.split('/').at(-1)));
  const articles = new Map();
  for (const [url, html] of pages) {
    if (url.endsWith('/') || oldPaths.has(url) || excluded.has(url) || categoryPaths.includes(url) ||
      /<meta\b[^>]*\b(?:name|http-equiv)=["'](?:robots|refresh)["'][^>]*\bcontent=["'][^"']*(?:noindex|url=)/i.test(html)) continue;
    if (!html.includes('</main>') || !(dated.has(url) || isThemeSeed(url) || Object.hasOwn(observedBy, url) ||
      /<meta\b[^>]*property=["']og:type["'][^>]*content=["']article["']/i.test(html) ||
      [...memberships.values()].some(set => set.has(url)) && !/^\/(?:[a-z-]+-list|about|sources|login|privacy|contact|glossary|pdf-library)$/.test(url))) continue;
    const title = clean(html.match(/<h1\b[^>]*>([\s\S]+?)<\/h1>/i)?.[1] ?? '');
    if (!title) continue;
    const main = html.split(/<main\b[^>]*>/i)[1]?.split('</main>')[0] ?? '';
    const body = main.replace(/<!-- article-revival:[\s\S]*?<!-- \/article-revival:[^>]*-->/g, '');
    const slug = url.split('/').at(-1);
    const explicit = html.match(/"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})/)?.[1];
    const description = clean(html.match(/<meta name="description" content="([^"]+)"/i)?.[1] ?? '');
    const topics = themes.filter(([, , , order, pattern]) => order.includes(slug) || pattern.test(title))
      .map(([name]) => name);
    if (/(決算|valuation-202|earnings-202|earnings-analysis-202)/.test(title+' '+slug)) topics.push('企業決算');
    if (/情報漏洩|パスワード|セキュリティ|サイバー|脆弱性/.test(title)) topics.push('情報セキュリティ');
    if (/M&A|企業買収|MBO/.test(title)) topics.push('企業買収');
    if (/選挙|議会|民主主義|政治資金/.test(title)) topics.push('政治制度');
    articles.set(url, {url, title, description, lang:prefix(url), published:explicit ?? dated.get(url) ?? null,
      observedBy:observedBy[url] ?? null, topics, body, outbound:new Set(links(body)),
      timeSensitive:/202[0-9]|決算|速報|今週|見通し|疑惑|補助金|脆弱性|辞任/.test(slug+' '+title)});
  }

  const replacements = new Map();
  const opportunities = [];
  const inventory = [];
  for (const article of articles.values()) {
    const {url, lang, title, published, observedBy: evidence, topics, timeSensitive, outbound, description} = article;
    const relatedBlocks = [...article.body.matchAll(/<section\b[^>]*>([\s\S]*?)<\/section>/gi)]
      .filter(([, section]) => /<h[23]\b[^>]*>\s*(?:関連記事|Related articles|Artículos relacionados|Artigos relacionados|相关文章|相關文章)\s*<\/h[23]>/i.test(section));
    const editorial = new Set(relatedBlocks.flatMap(([section]) => links(section)));
    const prose = article.body.replace(/<(?:aside|nav|script|style)\b[^>]*>[\s\S]*?<\/(?:aside|nav|script|style)>/gi, '');
    const paragraphs = [...prose.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(([, text]) => text);
    const bodyLinks = anchorTargets.flatMap(([anchor, target]) => {
      if (lang !== 'ja' || url === target || outbound.has(target) || !articles.has(target)) return [];
      if ([...prose.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)].some(([,text]) => clean(text).includes(anchor))) return [];
      const paragraph = paragraphs.find(text => !/<a\b/i.test(text) && clean(text).includes(anchor));
      return paragraph ? [{anchor,target,context:clean(paragraph).slice(0,200)}] : [];
    }).slice(0,3);
    const related = [...articles.values()].filter(other => other.lang === lang && other.url !== url)
      .map(other => ({...other, score:other.topics.filter(t => topics.includes(t)).length * 3 +
        Number(outbound.has(other.url)) * 2 + Number(other.outbound.has(url)) * 2}))
      .filter(other => other.score >= 2).sort((a,b) => b.score-a.score || a.url.localeCompare(b.url));
    const existing = [...editorial].filter(target => articles.has(target)).length;
    const picks = related.filter(other => !outbound.has(other.url)).slice(0, Math.max(0, 5-existing));
    if (picks.length || bodyLinks.length) opportunities.push({url, bodyLinks, candidates:picks.map(({url, title}) => ({url,title}))});
    const content = picks.length ? '<section class="revival-section"><h2>'+(existing && lang === 'ja' ? 'あわせて読む' : labels[lang])+'</h2><ul>'+
      list(picks, 'related_article_click')+'</ul></section>' : '';
    const original = pages.get(url);
    let html = region(original, 'related', content, inMain);
    html = region(html, 'assets', content ? styles : '', (html, text) => before(html, '</head>', text));
    if (html !== original) replacements.set(url, html);
    inventory.push({url,title,published,observedBy:evidence,topics,timeSensitive,description,
      internalArticleLinks:[...outbound].filter(target => articles.has(target)).length,
      archiveEligible:lang==='ja' && !timeSensitive && Boolean(published || evidence) &&
        (Boolean(evidence) || topics.some(topic => evergreenTopics.test(topic)))});
  }

  for (const url of new Set(themes.map(([, , hub]) => hub))) {
    const sections = themes.filter(([, , hub]) => hub === url).map(([name, intro, , order]) => {
      const entries = order.map(slug => articles.get('/'+slug)).filter(Boolean);
      if (entries.length < 2) return '';
      return '<section class="revival-section"><h2>'+escape(name)+'</h2><p>'+escape(intro)+'</p><ol>'+
        list(entries,'recommended_article_click')+'</ol></section>';
    }).join('');
    const original = pages.get(url);
    if (original && sections) {
      const slot = '<!-- article-reading-path-slot -->';
      let html = original.includes(slot) ? region(original, 'paths', sections, (html, text) => before(html, slot, text)) :
        region(original, 'paths', '<div id="reading-paths">'+sections+'</div>', inMain);
      html = region(html, 'assets', styles, (html, text) => before(html, '</head>', text));
      replacements.set(url, html);
    }
  }

  const candidates = inventory.filter(article => article.archiveEligible)
    .map(({url,title,published,observedBy}) => ({url,title,date:published ?? observedBy}));
  const payload = JSON.stringify({minAge:archiveMinAge,candidates}).replaceAll('<','\\u003c');
  const latest = new Set([...dated].sort((a,b) => b[1].localeCompare(a[1])).slice(0,10).map(([url]) => url));
  const selected = archiveSelection({minAge:archiveMinAge,candidates}, latest, now);
  const fallback = selected.length ? '<details class="revival-section archive-directory" id="recommended-archive"><summary>過去記事のおすすめ</summary>'+
    '<p>基礎解説を中心に、公開・掲載記録から'+archiveMinAge+'日以上経過した記事を日替わりで紹介します。</p>'+
    '<ul id="archive-recommendations">'+list(selected,'recommended_article_click')+'</ul></details>' : '';
  let homepage = region(index, 'catalog', '<script type="application/json" id="archive-article-data">'+payload+'</script>',
    (html, text) => before(html, '</body>', text));
  homepage = region(homepage, 'directory', fallback, (html, text) => before(html, '<details class="home-article-archive">', text));
  if (selected.length) {
    const anchors = list(selected,'ticker_archive_click').replaceAll(/<\/?li>/g, '');
    homepage = region(homepage, 'archive-row',
      '<div class="news-ticker" id="archive-ticker" aria-label="過去記事のおすすめ" data-motion="true">'+
      '<span class="news-ticker-label">おすすめ</span><div class="news-ticker-window">'+
      '<nav class="news-ticker-track" aria-label="過去記事へのリンク"><div class="news-ticker-group">'+anchors+
      '</div></nav></div><button type="button" class="news-ticker-toggle" aria-label="おすすめテロップを一時停止" hidden>停止</button></div>',
      (html, text) => before(html, '<!-- archive-ticker-slot -->', text));
  }
  replacements.set('/', homepage);
  for (const [url, html] of replacements) {
    if (write && html !== pages.get(url)) await fs.writeFile(fileFor(url), html);
  }
  return {inventory, opportunities, candidates:candidates.length, relatedPages:opportunities.filter(entry => entry.candidates.length).length, selected:selected.length};
}

if (process.argv[1]?.endsWith('/sync-article-revival.mjs')) {
  const result = await synchronizeArticles();
  console.log(JSON.stringify({articles:result.inventory.length, ...Object.fromEntries(
    ['candidates','relatedPages','selected'].map(key => [key,result[key]]))}));
}
