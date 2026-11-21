(() => {
  'use strict';
  const panel = document.querySelector('#behavior-study-progress');
  if (!panel) return;
  const key = 'todoroki.behavior-study.v1';
  const cards = [...document.querySelectorAll('[data-study-chapter]')];
  const ids = cards.map(card => card.dataset.studyChapter);
  if (ids.length !== 20 || new Set(ids).size !== 20) return;
  let state = {};
  let saving = false;
  const pref = panel.querySelector('input');
  const status = panel.querySelector('[data-study-status]');
  const review = panel.querySelector('[data-study-review]');
  const next = panel.querySelector('[data-study-recommend]');
  const reset = panel.querySelector('button');
  try {
    const existing = localStorage.getItem(key);
    if (existing !== null) {
      const saved = JSON.parse(existing);
      if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
        for (const id of ids) {
          if (Object.hasOwn(saved,id) && saved[id] && typeof saved[id] === 'object') {
            state[id] = {done:saved[id].done === true, result:['review','correct'].includes(saved[id].result) ? saved[id].result : ''};
          }
        }
        saving = true;
      }
    }
  } catch { /* unavailable storage never blocks learning */ }
  pref.checked = saving;
  function persist() {
    if (!saving) return;
    try { localStorage.setItem(key, JSON.stringify(state)); }
    catch {
      saving = false;
      pref.checked = false;
      panel.querySelector('[data-study-storage-note]').textContent = '保存できません。このページを開いている間だけ進捗を表示します。';
    }
  }
  function metric(event, name, id) {
    if (!event.isTrusted || navigator.globalPrivacyControl === true || typeof window.gtag !== 'function') return;
    window.gtag('event', name, {chapter_id:id});
  }
  function redraw() {
    const done = ids.filter(id => state[id]?.done).length;
    const wrong = ids.filter(id => state[id]?.result === 'review');
    status.textContent = `学習済み ${done} / ${ids.length}章。復習候補 ${wrong.length}章。`;
    reset.disabled = !saving && Object.keys(state).length === 0;
    review.replaceChildren();
    for (const id of wrong) {
      const a = document.createElement('a');
      a.href = '#chapter-' + id;
      a.textContent = '第' + id + '章を復習';
      const li = document.createElement('li');
      li.append(a);
      review.append(li);
    }
    const n = ids.find(id => !state[id]?.done);
    if (n) {
      next.href = '#chapter-' + n;
      next.textContent = '次のおすすめ：第' + n + '章';
    } else {
      next.href = '#behavior-study-roadmap';
      next.textContent = '全20章を学習済み。ロードマップに戻る';
    }
    for (const card of cards) {
      const record = state[card.dataset.studyChapter];
      const input = card.querySelector('[data-study-complete]');
      input.checked = !!record?.done;
      const label = card.querySelector('[data-study-mark]');
      label.textContent = record?.done ? '学習済み' : '未完了';
      card.querySelector('[data-study-saved-result]').textContent = record?.result === 'review' ? '復習候補' : '';
    }
  }
  pref.addEventListener('change', () => {
    saving = pref.checked;
    if (saving) persist();
    else try { localStorage.removeItem(key); }
    catch { panel.querySelector('[data-study-storage-note]').textContent = '端末の保存データを削除できませんでした。'; }
    redraw();
  });
  function clear() {
    try { localStorage.removeItem(key); }
    catch { panel.querySelector('[data-study-storage-note]').textContent = '端末の保存データを削除できませんでした。'; }
    saving = false;
    pref.checked = false;
    state = {};
    for (const card of cards) {
      const form = card.querySelector('form[data-study-quiz]');
      form.reset();
      form.querySelector('output').textContent = '';
    }
    redraw();
  }
  reset.addEventListener('click', clear);
  panel.hidden = false;
  for (const card of cards) {
    const id = card.dataset.studyChapter;
    const form = card.querySelector('form[data-study-quiz]');
    form.hidden = false;
    const input = card.querySelector('[data-study-complete]');
    input.closest('label').hidden = false;
    input.addEventListener('change', event => {
      const row = state[id] ??= {done:false,result:''};
      if (input.checked && !row.done) metric(event, 'be_study_complete', id);
      row.done = input.checked;
      persist();
      redraw();
    });
    form.addEventListener('submit', event => {
      event.preventDefault();
      const value = new FormData(form).get('choice');
      if (!['0','1','2'].includes(value)) return;
      const row = state[id] ??= {done:false,result:''};
      const correct = value === form.dataset.answer;
      row.result = correct ? 'correct' : 'review';
      form.querySelector('output').textContent = correct ? '正解です。解説で理由を確認できます。' : '復習候補に追加しました。下の解説を読んで再挑戦できます。';
      metric(event,'be_study_quiz_submit',id);
      persist();
      redraw();
    });
    card.addEventListener('click', event => {
      const link = event.target.closest?.('a[data-study-action]');
      const action = link?.dataset.studyAction;
      const name = {next:'be_study_next',pdf:'be_study_pdf',article:'be_study_article',tool:'be_study_tool'}[action];
      if (name) metric(event,name,id);
    });
  }
  redraw();
})();
