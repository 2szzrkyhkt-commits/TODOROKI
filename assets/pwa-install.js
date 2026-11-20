// Keep installation and updates on the public home; navigation remains network-only.
(() => {
  const install = document.getElementById('td-install-app');
  const iosHelp = document.getElementById('td-install-ios-help');
  const standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  const iphoneSafari = /iPhone|iPod/.test(navigator.userAgent) &&
    /Version\/.+Safari\//.test(navigator.userAgent);
  let promptEvent = null;
  if (!standalone && iphoneSafari) iosHelp.hidden = false;
  if (!standalone) {
    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      promptEvent = event;
      install.hidden = false;
    });
    install.addEventListener('click', async () => {
      if (!promptEvent) return;
      const pending = promptEvent;
      promptEvent = null;
      install.hidden = true;
      try { await pending.prompt(); } catch { /* Browser declined the native prompt. */ }
    });
    window.addEventListener('appinstalled', () => {
      promptEvent = null;
      install.hidden = true;
      iosHelp.hidden = true;
    });
  }
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/app/sw.js', {scope: '/', updateViaCache: 'none'}).catch(() => {});
    }, {once: true});
  }
})();
