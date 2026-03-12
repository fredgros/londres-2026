const CACHE_NAME = 'londres-2026-v1';

// Ressources essentielles a cacher immediatement
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// Pre-cacher les tuiles pour la zone Londres (zoom 12-16)
// Bounding box: lat 51.47-51.54, lng -0.22 a -0.06
function getTileUrls() {
  const urls = [];
  const subdomains = ['a', 'b', 'c'];
  // Zoom 13 : vue d'ensemble (9 tuiles)
  for (let x = 4088; x <= 4096; x++) {
    for (let y = 2722; y <= 2728; y++) {
      const s = subdomains[(x + y) % 3];
      urls.push(`https://${s}.basemaps.cartocdn.com/light_all/13/${x}/${y}.png`);
    }
  }
  // Zoom 14 : vue intermediaire (25 tuiles)
  for (let x = 8178; x <= 8192; x++) {
    for (let y = 5446; y <= 5456; y++) {
      const s = subdomains[(x + y) % 3];
      urls.push(`https://${s}.basemaps.cartocdn.com/light_all/14/${x}/${y}.png`);
    }
  }
  // Zoom 15 : vue rapprochee quartiers (50 tuiles)
  for (let x = 16358; x <= 16384; x += 2) {
    for (let y = 10894; y <= 10912; y += 2) {
      const s = subdomains[(x + y) % 3];
      urls.push(`https://${s}.basemaps.cartocdn.com/light_all/15/${x}/${y}.png`);
    }
  }
  return urls;
}

// Installation : cacher les ressources essentielles
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(CORE_ASSETS).then(() => {
        // Cacher les tuiles en arriere-plan (ne bloque pas l'installation)
        const tileUrls = getTileUrls();
        const batchSize = 10;
        let promise = Promise.resolve();
        for (let i = 0; i < tileUrls.length; i += batchSize) {
          const batch = tileUrls.slice(i, i + batchSize);
          promise = promise.then(() =>
            Promise.allSettled(batch.map(url =>
              fetch(url).then(r => r.ok ? cache.put(url, r) : null).catch(() => {})
            ))
          );
        }
        return promise;
      });
    })
  );
  self.skipWaiting();
});

// Activation : nettoyer les anciens caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch : cache-first pour tout, network-first pour le HTML principal
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Tuiles de carte : cache-first, puis reseau
  if (url.includes('basemaps.cartocdn.com')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => new Response('', { status: 404 }));
      })
    );
    return;
  }

  // Tout le reste : cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
