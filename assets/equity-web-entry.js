// Keep installed apps and direct links on their existing entry path.
(() => {
  if (navigator.standalone === true ||
      matchMedia('(display-mode: standalone), (display-mode: minimal-ui), (display-mode: fullscreen), (display-mode: window-controls-overlay)').matches ||
      !/\b(?:iPhone|Android)\b/i.test(navigator.userAgent)) return;

  document.querySelector('a[href="/api/tools/equity"]')?.setAttribute('href', '/api/tools/equity?flow=auto');
})();
