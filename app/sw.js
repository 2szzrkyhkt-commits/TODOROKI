// Only the app shell is cached. Financial data, logins, and cross-origin services are never cached.
const CACHE='todoroki-app-shell-v2';
const SHELL=['/app/','/app/manifest.webmanifest'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('todoroki-app-shell-')&&key!==CACHE).map(key=>caches.delete(key)))),self.clients.claim()]))});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin)return;
 if(url.pathname==='/app/'&&request.mode==='navigate'){
   event.respondWith(fetch(request).catch(()=>caches.match('/app/')));return;
 }
 if(url.pathname==='/app/manifest.webmanifest'){
   event.respondWith(fetch(request).catch(()=>caches.match(request)));return;
 }
 // All other requests use the browser's normal network handling.
});