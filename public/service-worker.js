/**
 * Mawutor Dezor Enterprise - Service Worker v3.0
 * Offline-first PWA + Background Sync for MoMo Transactions
 * Caches app shell, serves offline, queues writes
 */
const CACHE_NAME = 'mawutor-v3-momo-pwa';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/icons/icon-96.png',
  '/icons/icon-144.png',
  '/icons/icon-180.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-512-maskable.png'
];

// Install - cache app shell
self.addEventListener('install', (event) => {
  console.log('[SW] Install v3');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate v3');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('[SW] Deleting old cache', k);
          return caches.delete(k);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Helper: is API request?
function isApiRequest(url){
  return url.pathname.startsWith('/api/');
}
function isSocketIo(url){
  return url.pathname.startsWith('/socket.io/');
}

// Fetch handler
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip socket.io - always network
  if (isSocketIo(url)) return;

  // API Requests
  if (isApiRequest(url)){
    // For GET - Network first, cache fallback
    if (req.method === 'GET'){
      event.respondWith(
        fetch(req)
          .then(res => {
            // Clone and cache successful GETs for offline viewing
            if (res.ok){
              const clone = res.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(req, clone);
              });
            }
            return res;
          })
          .catch(async () => {
            // Offline - try cache
            const cached = await caches.match(req);
            if (cached) {
              console.log('[SW] Serving API from cache (offline):', url.pathname);
              return cached;
            }
            // Return offline JSON
            return new Response(JSON.stringify({ error: 'Offline - data from cache not available', offline: true }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            });
          })
      );
    } else {
      // POST/PUT/DELETE - Network only, if fails, let client handle queue (app.js offline queue)
      // We don't cache writes
      event.respondWith(
        fetch(req).catch(() => {
          return new Response(JSON.stringify({ error: 'Offline - transaction queued', offlineQueued: true }), {
            status: 202,
            headers: { 'Content-Type': 'application/json' }
          });
        })
      );
    }
    return;
  }

  // Static assets & navigation - Cache first, network fallback
  if (req.mode === 'navigate' || req.destination === 'document'){
    event.respondWith(
      fetch(req)
        .then(res => {
          // Cache page
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          const cache = await caches.open(CACHE_NAME);
          const fallback = await cache.match('/index.html') || await cache.match('/');
          if (fallback) return fallback;
          return new Response('<h1>Offline</h1><p>Mawutor Dezor Enterprise is offline. Your data is safe. Connect to internet to sync.</p>', {
            headers: { 'Content-Type': 'text/html' }
          });
        })
    );
    return;
  }

  // For CSS, JS, images, icons - Cache first
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        // Cache successful
        if (res.ok){
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
        }
        return res;
      }).catch(() => {
        // If both fail, return cached index for JS? Or empty
        return cached || Response.error();
      });
    })
  );
});

// Background Sync - for queued transactions (if browser supports)
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  if (event.tag === 'sync-momo-transactions'){
    event.waitUntil(syncOfflineQueue());
  }
});

async function syncOfflineQueue(){
  // Notify clients to sync
  const clients = await self.clients.matchAll();
  clients.forEach(c => c.postMessage({ type: 'SYNC_OFFLINE_QUEUE' }));
  return Promise.resolve();
}

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING'){
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'GET_CACHE_SIZE'){
    caches.open(CACHE_NAME).then(cache => {
      cache.keys().then(keys => {
        event.ports[0].postMessage({ size: keys.length });
      });
    });
  }
});

// Push notification placeholder (future)
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : { title: 'Mawutor Dezor', body: 'New transaction synced' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-96.png',
      tag: 'mawutor-sync'
    })
  );
});
