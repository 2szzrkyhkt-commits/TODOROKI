// The separate-window GET may lose its source metadata on mobile. Submit the
// same-origin form from the user's real tap; the Worker still verifies Origin.
(() => {
  // The legacy preview origin relies on its existing canonical GET redirect.
  if (location.hostname === 'todoroki.8njb5bzfbz.workers.dev') return;
  const iosPlatform = /^(?:iPhone|iPad|iPod)$/.test(navigator.platform);
  const touchApple = navigator.platform === 'MacIntel' &&
    (navigator.maxTouchPoints > 1 || matchMedia('(pointer: coarse)').matches);
  if (!iosPlatform && !touchApple && !/\b(?:iPhone|iPad|iPod|Android)\b/i.test(navigator.userAgent)) return;

  for (const slug of ['jp', 'us']) {
    const action = '/api/tools/' + slug + '?flow=auto';
    const link = document.querySelector('a[href="/api/tools/' + slug + '"], a[href="' + action + '"]');
    if (!link) continue;
    link.addEventListener('click', event => {
      // Preserve modified/new-tab interactions and all non-native activations.
      if (!event.isTrusted || event.defaultPrevented || event.button !== 0 ||
          event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const form = document.createElement('form');
      form.hidden = true;
      form.method = 'post';
      form.action = action;
      form.target = '_self';
      document.body.append(form);
      try {
        form.submit();
        event.preventDefault();
      } catch {
        form.remove(); // The original GET/recovery remains available.
      }
    });
  }
})();
