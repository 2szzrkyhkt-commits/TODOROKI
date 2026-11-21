(function () {
  'use strict';
  const link = document.querySelector('a[data-article-tool-market="jp"][href="/#equity-research-tool"]');
  if (!link) return;
  link.addEventListener('click', function (event) {
    // The existing privacy loader only creates gtag for permitted, opted-in analytics.
    if (!event.isTrusted || event.defaultPrevented || navigator.globalPrivacyControl === true || typeof window.gtag !== 'function') return;
    try {
      window.gtag('event', 'article_tool_click', {market: 'jp'});
    } catch {
      // Analytics must never block or delay the normal native link.
    }
  });
})();
