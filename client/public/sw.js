// Service Worker — network-first strategy
// JS/CSS bundles are always fetched fresh; only the app shell is cached for offline fallback.
// When a new SW version is detected, all clients are reloaded automatically.

const CACHE_NAME = 'reform-hub-v3';
const SHELL_ASSETS = [
  '/',
  '/manifest.json',
];

// ── Install: cache shell only ──────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  // Take over immediately — don't wait for old SW to stop
  self.skipWaiting();
});

// ── Activate: delete all old caches, then claim all clients ───────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Message: support manual skipWaiting from the page ─────────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── Fetch: network-first for everything except API calls ──────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // API + storage calls — always network only, never cache
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/manus-storage/')) return;

  // JS / CSS bundles — network first, no caching (ensures fresh code always)
  if (url.pathname.match(/\.(js|css|mjs)(\?|$)/)) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // Navigation requests — network first, fall back to cached shell
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/'))
    );
    return;
  }

  // Other static assets (images, fonts, manifest) — network first, cache as fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
