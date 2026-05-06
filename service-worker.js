/* ============================================================
   MI ENTRENAMIENTO — service-worker.js
   Estrategia: Cache-first para assets estáticos
   ============================================================ */

const CACHE_NAME    = 'mi-entrenamiento-v1';
const CACHE_DYNAMIC = 'mi-entrenamiento-dynamic-v1';

const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// ── Install: pre-cachear assets estáticos ──────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Pre-caching assets estáticos');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Error en install:', err))
  );
});

// ── Activate: limpiar caches viejos ────────────────────────────
self.addEventListener('activate', event => {
  const CURRENT_CACHES = [CACHE_NAME, CACHE_DYNAMIC];
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => !CURRENT_CACHES.includes(key))
          .map(key => {
            console.log('[SW] Eliminando cache viejo:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: Cache-first para estáticos, Network-first para el resto ──
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo interceptar requests del mismo origen o Google Fonts
  if (
    url.origin !== location.origin &&
    !url.hostname.includes('fonts.googleapis.com') &&
    !url.hostname.includes('fonts.gstatic.com')
  ) {
    return;
  }

  // Ignorar requests que no son GET
  if (request.method !== 'GET') return;

  // Fuentes de Google: Cache-first
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(cacheFirst(request, CACHE_DYNAMIC));
    return;
  }

  // Assets estáticos: Cache-first
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, CACHE_NAME));
    return;
  }

  // Todo lo demás: Network-first con fallback a cache
  event.respondWith(networkFirst(request));
});

// ── Estrategia Cache-first ─────────────────────────────────────
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type !== 'opaque') {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    console.warn('[SW] Cache-first fetch failed:', err);
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

// ── Estrategia Network-first ───────────────────────────────────
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(CACHE_DYNAMIC);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return caches.match('./index.html');
  }
}

// ── Helper ────────────────────────────────────────────────────
function isStaticAsset(pathname) {
  const staticExts = ['.html', '.css', '.js', '.png', '.jpg', '.svg', '.ico', '.json', '.woff', '.woff2'];
  return staticExts.some(ext => pathname.endsWith(ext));
}
