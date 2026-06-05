const CACHE = 'budget-v6';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './js/config.js',
  './js/auth.js',
  './js/db.js',
  './js/offline.js',
  './js/db.js',
  './js/categories.js',
  './js/recurring.js',
  './js/compare.js',
  './js/app.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first: immer frischen Code laden wenn online,
// Cache dient nur als Offline-Fallback. Supabase/CDN ungecacht.
self.addEventListener('fetch', e => {
  const url = e.request.url;
  if (url.includes('supabase.co') || url.includes('jsdelivr.net')) return;
  if (e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request).then(c => c || caches.match('./index.html')))
  );
});
