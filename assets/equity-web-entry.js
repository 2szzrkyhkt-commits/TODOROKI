// Supplements server selection when Safari's browser context looks desktop-like.
// Keep the historical filename for already-loaded homepage versions.
(() => {
  if (navigator.standalone === true ||
      matchMedia('(display-mode: standalone), (display-mode: minimal-ui), (display-mode: fullscreen), (display-mode: window-controls-overlay)').matches) return;
  const touchApple = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  if (!touchApple && !/\b(?:iPhone|iPad|iPod|Android)\b/i.test(navigator.userAgent)) return;

  for (const slug of ['equity','jp','us']) {
    const href = '/api/tools/' + slug;
    document.querySelector('a[href="' + href + '"]')?.setAttribute('href', href + '?flow=auto');
  }
})();
