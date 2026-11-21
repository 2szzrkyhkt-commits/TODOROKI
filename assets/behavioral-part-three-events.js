(() => {
  'use strict';
  const section = document.getElementById('part-three-roadmap');
  if (!section) return;
  const names = new Map([
    ['pdf', 'be_part3_pdf_open'],
    ['save', 'be_part3_pdf_save'],
    ['quiz', 'be_part3_quiz_open'],
    ['article', 'be_part3_related_article_open'],
    ['tool', 'be_part3_tool_entry_open']
  ]);
  section.addEventListener('click', event => {
    // Only the site's existing privacy script creates gtag after consent, region
    // checks and GPC. This helper never installs a tag, beacon or storage item.
    if (!event.isTrusted || event.defaultPrevented || navigator.globalPrivacyControl === true || typeof window.gtag !== 'function') return;
    const target = event.target instanceof Element ? event.target.closest('a[data-be-action], summary[data-be-action]') : null;
    const action = target?.dataset.beAction;
    if (!names.has(action)) return;
    const id = target.closest('.part-three-card')?.id?.match(/^part-three-chapter-(1[1-6])$/)?.[1];
    if (!id) return;
    if (action === 'quiz' ? target.tagName !== 'SUMMARY' || target.parentElement?.open !== false : target.tagName !== 'A') return;
    window.gtag('event', names.get(action), {chapter_id: id});
  });
})();
