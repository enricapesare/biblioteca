const VERSION = 'biblioteca-1.1.0';   // aggiornata da scripts/release.sh
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'vendor/zxing.min.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];
const COVER_HOSTS = ['books.google.com', 'books.googleusercontent.com', 'covers.openlibrary.org', 'archive.org'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Copertine: dalla cache se già viste, altrimenti rete e salvataggio
  if (COVER_HOSTS.some(h => url.hostname === h || url.hostname.endsWith('.' + h)) && req.destination === 'image') {
    e.respondWith(caches.open(VERSION).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      try { const r = await fetch(req); c.put(req, r.clone()); return r; } catch (err) { return Response.error(); }
    }));
    return;
  }
  // File dell'app: cache prima, aggiornamento in background
  if (url.origin === location.origin) {
    e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => {
      const net = fetch(req).then(r => { caches.open(VERSION).then(c => c.put(req, r.clone())); return r; }).catch(() => hit);
      return hit || net;
    }));
  }
});
