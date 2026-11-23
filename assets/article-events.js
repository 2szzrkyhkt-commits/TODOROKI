document.addEventListener('click', event => {
  if (!event.isTrusted || event.defaultPrevented || navigator.globalPrivacyControl === true ||
      typeof window.gtag !== 'function') return;
  const link = event.target.closest('a[data-article-event]');
  if (!link || link.origin !== location.origin) return;
  try {
    window.gtag('event', link.dataset.articleEvent, {article_path: link.pathname});
  } catch {
    // Preserve native navigation even when analytics is unavailable.
  }
});
