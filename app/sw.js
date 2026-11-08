// Service worker: app shell works offline; data and catalog are network-first (so GitHub refreshes show up),
// with the last good copy used when offline. Map tiles are cached as you browse.
const BUILD = '__BUILD__';
const V = '?v=' + BUILD;                       // the build stamps the same version on every shell URL
const SHELL = `nwg-shell-${BUILD}`, DATA = `nwg-data-${BUILD}`, TILES = 'nwg-tiles-v1';
const SHELL_FILES = ['./', 'index.html', 'css/app.css' + V, 'js/app.js' + V, 'js/engine.js' + V,
                     'js/loading.js' + V, 'js/quality.js' + V, 'js/vector-worker.js' + V,
                     'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (e) => {
  // The first catalog request precedes controllerchange, so cache it explicitly for a
  // first-visit offline reload. Keep it in DATA: later network-first refreshes replace
  // this same entry and cannot be shadowed by an older shell-cache copy.
  e.waitUntil(Promise.all([
    caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)),
    caches.open(DATA).then((c) => c.addAll(['catalog.json'])),
  ]).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('message', (e) => {
  if (e.data === 'skip-waiting') self.skipWaiting();
  if (e.data === 'version') e.source && e.source.postMessage({ type: 'version', build: BUILD });
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== SHELL && k !== DATA && k !== TILES).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) {
    if (/arcgisonline\.com|tile\.openstreetmap\.org|opentopomap\.org/.test(url.hostname)) {
      e.respondWith(caches.open(TILES).then(async (c) => { const hit = await c.match(req); if (hit) return hit; try { const r = await fetch(req); if (r.ok) { c.put(req, r.clone()); trim(c, 600); } return r; } catch { return hit || Response.error(); } }));
    }
    return;
  }
  if (url.pathname.endsWith('catalog.json') || url.pathname.endsWith('quality-register.json') || url.pathname.includes('/data/')) {
    e.respondWith(fetch(req).then((r) => { if (r.ok) { const cp = r.clone(); caches.open(DATA).then((c) => c.put(req, cp)); } return r; }).catch(() => caches.match(req)));
    return;
  }
  // app shell: network first (so a deploy shows up at once), cache when offline
  e.respondWith(fetch(req).then((r) => { if (r.ok) { const cp = r.clone(); caches.open(SHELL).then((c) => c.put(req, cp)); } return r; }).catch(() => caches.match(req).then((hit) => hit || caches.match('index.html'))));
});
async function trim(c, n) { const ks = await c.keys(); if (ks.length > n) for (const k of ks.slice(0, ks.length - n)) await c.delete(k); }
