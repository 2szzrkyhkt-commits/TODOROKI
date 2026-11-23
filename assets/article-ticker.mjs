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

function mountTicker(element, eventName) {
  const windowElement = element?.querySelector('.news-ticker-window');
  const track = element?.querySelector('.news-ticker-track');
  const button = element?.querySelector('button');
  if (!windowElement || !track || !button) return () => {};
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let primary = track.firstElementChild;
  let copies = 0;
  let paused = false;
  const update = () => {
    const width = primary?.getBoundingClientRect().width ?? 0;
    if (!width || !windowElement.clientWidth) return;
    const motion = !reduced.matches;
    const repetitions = motion ? Math.ceil(windowElement.clientWidth / width) : 1;
    const requiredCopies = repetitions * 2 - 1;
    // Both halves must contain the same sequence for translateX(-50%) to wrap.
    while (copies > requiredCopies) {
      track.lastElementChild.remove();
      copies--;
    }
    while (copies < requiredCopies) {
      const copy = primary.cloneNode(true);
      copy.setAttribute('aria-hidden', 'true');
      for (const link of copy.querySelectorAll('a')) link.tabIndex = -1;
      track.append(copy);
      copies++;
    }
    track.style.setProperty('--ticker-duration', (width * repetitions / 62) + 's');
    element.dataset.motion = String(motion);
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
  if (primary) {
    for (const link of primary.querySelectorAll('a')) link.dataset.articleEvent = eventName;
    resize.observe(primary);
  }
  update();
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
    track.replaceChildren(primary);
    copies = 0;
    element.hidden = false;
    resize.observe(primary);
    update();
  };
}

function ticker(element, eventName) {
  let render;
  try {
    render = mountTicker(element, eventName);
  } catch (error) {
    console.error(eventName, error);
  }
  return entries => {
    try {
      render?.(entries);
    } catch (error) {
      console.error(eventName, error);
    }
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
