// Service worker de BookShelf (SPEC §9bis, 1.13.0): la app abre sin conexión y a pantalla completa.
// - Páginas: primero la red (para recibir versiones nuevas), y si no hay conexión, la copia guardada.
// - Recursos propios (JS/CSS con hash, la ilustración, las figuras): primero la caché.
// - Portadas de Open Library / Google Books: se sirven de caché y se refrescan por detrás.
const VERSION = 'bookshelf-v1.16.4';
const CORE = ['/', '/index.html', '/manifest.webmanifest', '/cozy-book-room.png', '/favicon.svg', '/icons/icon-192.png', '/icons/icon-512.png', '/figures/catalog.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const COVER_HOSTS = ['covers.openlibrary.org', 'books.google.com', 'books.googleusercontent.com'];

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Navegación: red y, sin conexión, la app guardada
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html')),
    );
    return;
  }

  // Portadas: caché y actualización en segundo plano
  if (COVER_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.open(`${VERSION}-covers`).then(async (cache) => {
        const hit = await cache.match(request);
        const net = fetch(request)
          .then((res) => {
            if (res.ok || res.type === 'opaque') cache.put(request, res.clone());
            return res;
          })
          .catch(() => hit);
        return hit ?? net;
      }),
    );
    return;
  }

  // El catálogo de figuras puede cambiar sin recompilar: red primero
  if (url.origin === self.location.origin && url.pathname === '/figures/catalog.json') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  // Recursos propios: caché primero
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(request, copy));
            }
            return res;
          }),
      ),
    );
  }
});
