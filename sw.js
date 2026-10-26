// Keeps the whole app on the device so it opens with no internet.
// Bump VERSION whenever any file below changes; the iPads pick up the new copy the next time they are online.
const VERSION = 'ttc-2026-10-26b';
const FILES = [
  './', './index.html', './app.js', './games.js', './manifest.webmanifest',
  './vendor/supabase.js', './vendor/fonts.css',
  './vendor/fonts/AbrilFatface-0.woff2', './vendor/fonts/AlfaSlabOne-1.woff2', './vendor/fonts/LilitaOne-2.woff2', './vendor/fonts/Nunito-3.woff2',
  './audio/jungle-adventure.mp3', './audio/jungle-danger.mp3', './audio/ogre-laugh.m4a', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES.map(f => new Request(f, {cache: 'reload'})))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION && !k.startsWith('ttc-photos')).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Same-site files: answer from the device at once, refresh the copy in the background (past the browser's own
// 10-minute cache, so a new version lands on the next open, not two opens later).
// Everything else (the sign-in and sync service) goes straight to the network.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Videos go straight to the network: Safari asks for them in pieces, which this cache cannot answer.
  if (url.pathname.includes('/clips/') || e.request.headers.has('range')) return;
  e.respondWith(caches.open(VERSION).then(async cache => {
    const key = e.request.mode === 'navigate' ? './index.html' : e.request;
    const hit = await cache.match(key, { ignoreSearch: true });
    const fresh = fetch(e.request, {cache: 'no-cache'}).then(res => {
      if (res.ok && res.type === 'basic') cache.put(key, res.clone());
      return res;
    }).catch(() => null);
    if (hit) { e.waitUntil(fresh); return hit; }
    return (await fresh) || Response.error();
  }));
});
