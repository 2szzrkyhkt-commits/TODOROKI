const day = 86_400_000;
const jstCutover = 5 * 3_600_000; // UTC+9 minus the 04:00 JST boundary.
const midnight = date => Date.parse(date+'T00:00:00Z');

export function archiveSelection({minAge, candidates}, latest, now = Date.now(), limit = 24) {
  const dayIndex = Math.floor((now+jstCutover)/day);
  const eligible = candidates.filter(entry =>
    !latest.has(entry.url) && midnight(entry.date) <= (dayIndex-minAge)*day)
    .sort((a, b) => a.url.localeCompare(b.url));
  if (!eligible.length) return [];
  const count = Math.min(limit, eligible.length > 1 ? eligible.length - 1 : 1);
  const start = ((dayIndex*count)%eligible.length+eligible.length)%eligible.length;
  return Array.from({length:count}, (_, index) => eligible[(start+index)%eligible.length]);
}

function ticker(element, eventName) {
  const windowElement = element.querySelector('.news-ticker-window');
  const track = element.querySelector('.news-ticker-track');
  const button = element.querySelector('button');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let primary = track.firstElementChild;
  let paused = false;
  const update = () => {
    const width = primary?.getBoundingClientRect().width ?? 0;
    const motion = width >= windowElement.clientWidth && width > 0 && !reduced.matches;
    element.dataset.motion = String(motion);
    track.style.setProperty('--ticker-duration', (width/62)+'s');
    button.hidden = !motion;
  };
  button.addEventListener('click', () => {
    paused = !paused;
    element.dataset.paused = String(paused);
    button.textContent = paused ? '再生' : '停止';
    const label = element.id === 'news-ticker' ? 'テロップ' : 'おすすめテロップ';
    button.setAttribute('aria-label', label + (paused ? 'を再生' : 'を一時停止'));
  });
  reduced.addEventListener('change', update);
  const resize = new ResizeObserver(update);
  resize.observe(windowElement);
  const observer = new IntersectionObserver(([entry]) => {
    element.dataset.outside = String(!entry.isIntersecting);
  });
  observer.observe(element);
  let signature;
  return entries => {
    const key = JSON.stringify(entries);
    if (key === signature || element.contains(document.activeElement)) return;
    signature = key;
    if (!entries.length) return;
    if (primary) resize.unobserve(primary);
    primary = document.createElement('div');
    primary.className = 'news-ticker-group';
    for (const entry of entries) primary.append(articleLink(entry, eventName));
    const copy = primary.cloneNode(true);
    copy.setAttribute('aria-hidden','true');
    for (const link of copy.querySelectorAll('a')) link.tabIndex = -1;
    track.replaceChildren(primary, copy);
    element.hidden = false;
    resize.observe(primary);
    update();
  };
}

function articleLink(entry, eventName) {
  const anchor = document.createElement('a');
  anchor.href = entry.url;
  anchor.textContent = entry.title;
  anchor.dataset.articleEvent = eventName;
  return anchor;
}

function init() {
  const latestTicker = ticker(document.querySelector('#news-ticker'), 'ticker_new_click');
  const archive = document.querySelector('#archive-ticker');
  const archiveTicker = archive ? ticker(archive, 'ticker_archive_click') : () => {};
  const entries = [...document.querySelectorAll('#home-article-catalog > .card-link')].map(card => ({
    url:card.getAttribute('href'), title:card.querySelector('h3')?.textContent.trim(),
    date:card.querySelector('time')?.dateTime,
  }));
  let data;
  try { data = JSON.parse(document.querySelector('#archive-article-data')?.textContent); } catch {}
  const directory = document.querySelector('#recommended-archive');
  let timer;
  let archiveKey;
  function update() {
    const now = Date.now();
    const today = new Date(now+9*3_600_000).toISOString().slice(0,10);
    const seen = new Set();
    const latest = entries.filter(entry => {
      if (!/^\/[a-z0-9-]+$/.test(entry.url) || !entry.title ||
          !/^\d{4}-\d{2}-\d{2}$/.test(entry.date) || entry.date > today || seen.has(entry.url)) return false;
      seen.add(entry.url);
      return true;
    }).sort((a,b) => b.date.localeCompare(a.date)).slice(0,10);
    latestTicker(latest);
    if (Array.isArray(data?.candidates)) {
      const selected = archiveSelection(data, new Set(latest.map(entry => entry.url)), now);
      if (selected.length) {
        archiveTicker(selected);
        const key = JSON.stringify(selected);
        if (directory && archiveKey !== key && !directory.contains(document.activeElement)) {
          directory.querySelector('ul').replaceChildren(...selected.map(entry => {
            const item = document.createElement('li');
            item.append(articleLink(entry,'recommended_article_click'));
            return item;
          }));
          directory.hidden = false;
          archiveKey = key;
        }
      }
    }
    clearTimeout(timer);
    const since = now+jstCutover;
    timer = setTimeout(update, day - (since%day) + 25);
  }
  update();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) update(); });
  document.addEventListener('focusout', () => queueMicrotask(update));
}

if (typeof document !== 'undefined' && document.querySelector('#news-ticker')) init();
