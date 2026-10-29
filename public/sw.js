// Service worker de BookShelf (SPEC §9bis y §11.6, 1.17.0): la app abre sin conexión y a pantalla completa.
// - Navegación: primero la red (versiones nuevas) y, sin conexión, la copia guardada.
// - Assets con hash (/assets/): caché primero; nunca cambian de contenido.
// - Imágenes con nombre estable (ilustración, figuras, iconos): caché y refresco por detrás.
// - catalog.json: red primero; solo sustituye la copia guardada si es un catálogo válido.
// - Portadas de Open Library / Google Books: caché y refresco por detrás.
// - Nada de Supabase ni de otros orígenes; nunca se guardan respuestas fallidas.
const PREFIX = 'bookshelf-';
const VERSION = `${PREFIX}v1.53.0`;
const COVERS = `${VERSION}-covers`;
// Fase 1 (1.21.0): las dos ilustraciones nuevas del panorama. `/cozy-book-room.jpg` sigue publicado para una
// sesión abierta con la versión anterior, pero ya no se precarga.
const CORE = ['/', '/index.html', '/manifest.webmanifest', '/images/cozy-book-room.jpg', '/images/cozy-social-room.jpg', '/images/laptop-foreground.png', '/favicon.svg', '/icons/icon-192.png', '/icons/icon-512.png', '/figures/catalog.json'];
const COVER_HOSTS = ['covers.openlibrary.org', 'books.google.com', 'books.googleusercontent.com'];
const STABLE_IMAGES = /^\/(cozy-book-room\.jpg|images\/.+\.(png|jpe?g|webp)$|favicon\.svg|icons\/|figures\/.+\.(png|jpe?g|webp|svg)$|art\/library-refresh\/.+\.webp$|assets\/(profile|memories|ui|library)\/.+\.webp$)/;

self.addEventListener('install', (event) => {
  // Sin skipWaiting(): la versión nueva espera a que la app pase a segundo plano (ver 'message')
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(CORE)));
});

self.addEventListener('activate', (event) => {
  // Solo se borran cachés antiguas de BookShelf; el resto del origen no se toca
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== VERSION && k !== COVERS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// La página pide activar la versión nueva cuando nadie la está usando (pestaña oculta): sin recargar
self.addEventListener('message', (event) => {
  if (event.data === 'activar-version') self.skipWaiting();
});

const okToCache = (res) => res && res.ok && res.type !== 'opaqueredirect';
/** Una «imagen» que llega como HTML (respaldo de SPA de un servidor) no es una imagen: no se guarda. */
const isImage = (res) => okToCache(res) && (res.headers.get('content-type') ?? '').startsWith('image/');
const notHtml = (res) => okToCache(res) && !(res.headers.get('content-type') ?? '').includes('text/html');

async function put(cacheName, request, res, valid = okToCache) {
  if (!valid(res)) return;
  const cache = await caches.open(cacheName);
  await cache.put(request, res);
}

/** Caché y, a la vez, refresco por detrás (sin guardar errores). */
async function staleWhileRevalidate(request, cacheName, allowOpaque = false) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const net = fetch(request)
    .then((res) => {
      if (isImage(res) || (allowOpaque && res.type === 'opaque')) cache.put(request, res.clone());
      return res;
    })
    .catch(() => hit);
  return hit ?? net;
}

async function catalogFirstNetwork(request) {
  try {
    const res = await fetch(request);
    if (res.ok) {
      // Solo una respuesta que es de verdad un catálogo sustituye la copia buena
      const data = await res.clone().json().catch(() => null);
      if (data && Array.isArray(data.figures)) await put(VERSION, request, res.clone());
    }
    return res;
  } catch {
    return (await caches.match(request)) ?? Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (okToCache(res)) put(VERSION, '/index.html', res.clone());
          return res;
        })
        .catch(async () => (await caches.match('/index.html')) ?? Response.error()),
    );
    return;
  }

  if (COVER_HOSTS.includes(url.hostname)) {
    // IA-1: el análisis de color pide la portada con CORS; una copia opaca de la caché no le serviría, así que esa
    // petición va directa a la red (sin tocar la caché de portadas que usan las <img> normales)
    if (request.mode === 'cors') return;
    event.respondWith(staleWhileRevalidate(request, COVERS, true));
    return;
  }

  // Otros orígenes (Supabase, fuentes, APIs de libros): directo a la red, sin guardar nada
  if (url.origin !== self.location.origin) return;

  if (url.pathname === '/figures/catalog.json') {
    event.respondWith(catalogFirstNetwork(request));
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((res) => {
            put(VERSION, request, res.clone(), notHtml);
            return res;
          }),
      ),
    );
    return;
  }

  if (STABLE_IMAGES.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, VERSION));
  }
  // El resto (manifest, sw, rutas desconocidas): el navegador decide, sin caché propia
});
