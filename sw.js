// ---------------------------------------------------------------------------
// Service worker — installable, offline-tolerant app shell
//
// The tracker is a live timetable, so freshness matters more than saving
// bytes: navigations, code and data go network-first, fonts and icons are
// cached hard. Map tiles are cross-origin and deliberately left alone —
// caching them would be huge and they change far too often.
//
// Precache stores unversioned copies of the app files. Requests normally carry
// a `?v=` build tag, so when the exact URL is missing offline the handler
// falls back to the unversioned copy with `ignoreSearch`.
// ---------------------------------------------------------------------------

const VERSION = 'hmlive-2026-11-05-5';
const SHELL = `hmlive-shell-${VERSION}`;
const RUNTIME = `hmlive-runtime-${VERSION}`;
const DATA = `hmlive-data-${VERSION}`;

const PRECACHE = [
  './',
  './index.html',
  './offline.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/main.js',
  './js/config.js',
  './js/network.js',
  './js/sim.js',
  './js/infrastructure.js',
  './js/station.js',
  './js/train.js',
  './js/world.js',
  './js/materials.js',
  './js/geomutil.js',
  './js/lighting.js',
  './js/geo.js',
  './js/viaduct.js',
  './vendor/maplibre-gl.js',
  './vendor/maplibre-gl.css',
  './vendor/three.module.js',
  './assets/data/network.json',
  './assets/icons/favicon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/maskable-192.png',
  './assets/icons/maskable-512.png',
  './assets/fonts/Inter-400.woff2',
  './assets/fonts/JetBrainsMono-400.woff2',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      // One missing file must not block the install.
      await Promise.allSettled(PRECACHE.map((url) => cache.add(url)));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL, RUNTIME, DATA]);
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith('hmlive-') && !keep.has(n)).map((n) => caches.delete(n)));
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

function isSameOrigin(url) {
  return new URL(url, self.location.href).origin === self.location.origin;
}

function pathOf(url) {
  return new URL(url, self.location.href).pathname;
}

function isFontOrIcon(url) {
  return /\/assets\/fonts\/|\/assets\/icons\//.test(pathOf(url));
}

function isData(url) {
  return /\/assets\/data\//.test(pathOf(url));
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  if (cached) {
    network.catch(() => {});
    return cached;
  }
  const fresh = await network;
  return fresh || Response.error();
}

// Network-first with an exact cache hit, then the unversioned precached copy.
async function networkFirst(request, cacheName, fallbacks = []) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const exact = await cache.match(request);
    if (exact) return exact;
    for (const name of fallbacks) {
      const alt = await caches.open(name);
      const hit = (await alt.match(request)) || (await alt.match(request, { ignoreSearch: true }));
      if (hit) return hit;
    }
    const loose = await cache.match(request, { ignoreSearch: true });
    if (loose) return loose;
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (!isSameOrigin(request.url)) return; // tiles, glyphs, basemap: network only

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const preload = await event.preloadResponse;
          if (preload) return preload;
          return await networkFirst(request, SHELL);
        } catch (err) {
          const cache = await caches.open(SHELL);
          return (
            (await cache.match('./index.html')) ||
            (await cache.match('./')) ||
            (await cache.match('./offline.html')) ||
            Response.error()
          );
        }
      })()
    );
    return;
  }

  if (isFontOrIcon(request.url)) {
    // Immutable-ish and reused across builds, so serve from cache immediately.
    event.respondWith(staleWhileRevalidate(request, SHELL));
    return;
  }

  if (isData(request.url)) {
    event.respondWith(staleWhileRevalidate(request, DATA));
    return;
  }

  event.respondWith(networkFirst(request, RUNTIME, [SHELL]));
});
