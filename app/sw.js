// Network-only navigation. Never serve a stale app shell, login or financial data.
const OLD_PREFIX='todoroki-app-shell-';
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(Promise.all([
  caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(OLD_PREFIX)).map(key=>caches.delete(key)))),
  self.clients.claim()
])));
// No fetch interception: browser handles every request directly.
