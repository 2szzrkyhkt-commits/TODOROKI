import {KINDS, MAX_BYTES, SUBJECTS, publicMetadata} from './tax-public-metadata.mjs';

const pageSize = 50;
const normalize = value => value.normalize('NFKC').trim().toLocaleLowerCase('ja');

export async function enhance(root, fetcher = fetch) {
  const find = id => root.querySelector('#tax-source-' + id);
  const note = find('live-status');
  try {
    const response = await fetcher('/api/tax-catalog', {credentials: 'omit', mode: 'same-origin', signal: AbortSignal.timeout(10000)});
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw Error('unavailable');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let bytes = 0;
    let text = '';
    try {
      for (;;) {
        const {done, value} = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_BYTES) throw Error('too_large');
        text += decoder.decode(value, {stream: true});
      }
      text += decoder.decode();
    } finally {
      await reader.cancel().catch(() => {});
    }
    const {updated, rows} = publicMetadata(JSON.parse(text));
    const kind = find('kind');
    const subject = find('subject');
    const query = find('query');
    const list = find('list');
    const previous = find('previous');
    const next = find('next');
    const count = find('count');
    let offset = 0;
    for (const value of SUBJECTS) subject.add(new Option(value, value));
    function render() {
      const needle = normalize(query.value);
      const matches = rows.filter(row =>
        (!kind.value || row.kind === kind.value) &&
        (!subject.value || row.subjects.includes(subject.value)) &&
        normalize(row.title + ' ' + (row.number ?? '')).includes(needle));
      list.replaceChildren(...matches.slice(offset, offset + pageSize).map(row => {
        const li = document.createElement('li');
        const details = row.kind === 'law'
          ? ['e-Gov法令検索', row.number, row.state, row.promulgated && '改正法令の公布日 ' + row.promulgated, row.effective && '改正施行日 ' + row.effective]
          : ['国税庁', KINDS[row.kind]];
        li.textContent = [row.title, ...details.filter(Boolean), row.subjects.join('・'), '保存確認日 ' + row.checked.slice(0, 10)].join(' ／ ');
        return li;
      }));
      count.textContent = matches.length ? `${offset + 1}〜${Math.min(offset + pageSize, matches.length)}件／該当${matches.length}件` : '該当する資料はありません。';
      previous.disabled = offset === 0;
      next.disabled = offset + pageSize >= matches.length;
    }
    for (const control of [kind, subject, query]) {
      control.disabled = false;
      control.addEventListener(control === query ? 'input' : 'change', () => { offset = 0; render(); });
    }
    previous.addEventListener('click', () => { offset -= pageSize; render(); });
    next.addEventListener('click', () => { offset += pageSize; render(); });
    note.textContent = `保存済み資料 ${rows.length}件。索引更新 ${new Date(updated).toLocaleString('ja-JP', {timeZone: 'Asia/Tokyo'})}（日本時間）`;
    render();
  } catch {
    note.textContent = '資料一覧を取得できませんでした。時間をおいて再読み込みしてください。';
  }
}

if (typeof document !== 'undefined') {
  const root = document.getElementById('tax-source-release');
  if (root) enhance(root);
}
