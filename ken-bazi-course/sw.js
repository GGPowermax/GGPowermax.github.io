/* 甲木八字學苑 service worker — scope: this folder only */
const CACHE_NAME = 'jiawood-course-v1.0';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS.map(u => new Request(u, {cache: 'reload'})))));
});
self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('jiawood-course-') && k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Self-heal: another app on this origin may clear our cache; re-cache everything on the next online visit.
function heal() { return caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)).catch(() => {}); }
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    // cache first = instant + offline; a new version arrives via a new sw.js and the in-app update bar
    e.respondWith(caches.match('./index.html').then(hit => hit || fetch(req).then(res => { heal(); return res; })));
    return;
  }
  e.respondWith(caches.match(req, {ignoreSearch: true}).then(hit => hit || fetch(req)));
});
