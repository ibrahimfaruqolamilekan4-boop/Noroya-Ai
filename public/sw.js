const CACHE_VERSION = 'quantsmc-pwa-v2';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const CHART_STATE_CACHE = `${CACHE_VERSION}-chart-states`;

const PRECACHE_URLS = [
  '/',
  '/dashboard',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch(() => {});
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE && key !== CHART_STATE_CACHE)
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Listen for messages from client to cache recent chart & quantitative analysis state
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CACHE_CHART_STATE') {
    const payload = JSON.stringify({
      savedAt: new Date().toISOString(),
      state: event.data.payload
    });
    caches.open(CHART_STATE_CACHE).then((cache) => {
      cache.put(
        new Request('/__cached_chart_state__.json'),
        new Response(payload, {
          headers: { 'Content-Type': 'application/json' }
        })
      );
    });
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Serve cached chart state endpoint for offline recovery
  if (url.pathname === '/__cached_chart_state__.json') {
    event.respondWith(
      caches.open(CHART_STATE_CACHE).then((cache) =>
        cache.match(request).then((res) => res || new Response(JSON.stringify({ state: null }), {
          headers: { 'Content-Type': 'application/json' }
        }))
      )
    );
    return;
  }

  // Never cache POST API requests or WebSocket connections
  if (request.method !== 'GET' || url.pathname.startsWith('/api/')) {
    return;
  }

  // Navigation requests (SPA routes like / and /dashboard): Network first, fallback to cached shell
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put('/index.html', copy));
          return response;
        })
        .catch(() => {
          return caches.match('/index.html').then((res) => res || caches.match('/'));
        })
    );
    return;
  }

  // Google Fonts & static assets: Cache-first with background refresh (Stale-While-Revalidate)
  if (
    url.origin === self.location.origin ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const networkFetch = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const copy = networkResponse.clone();
              caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || networkFetch;
      })
    );
  }
});
