// Service worker de BookShelf (SPEC §9bis y §11.6, 1.17.0): la app abre sin conexión y a pantalla completa.
// - Navegación: primero la red (versiones nuevas) y, sin conexión, la copia guardada.
// - Assets con hash (/assets/): caché primero; nunca cambian de contenido.
// - Imágenes con nombre estable (ilustración, figuras, iconos): caché y refresco por detrás.
// - catalog.json: red primero; solo sustituye la copia guardada si es un catálogo válido.
// - Portadas de Open Library / Google Books: caché limitada, sin red si ya está y revalidada de vez en cuando (Fase 2).
// - Nada de Supabase ni de otros orígenes; nunca se guardan respuestas fallidas.
const PREFIX = 'bookshelf-';
const VERSION = `${PREFIX}v1.102.0`;
// Sin la versión de la app en el nombre: actualizar no vacía las portadas. Solo cambia si cambia el esquema de lo guardado
const COVERS = `${PREFIX}portadas-v1`;
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
  // Diagnóstico de las pruebas de caché: la interfaz no lo usa
  if (event.data?.tipo === 'portadas-metricas') event.waitUntil(coverReport().then((r) => event.ports[0]?.postMessage(r)));
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
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const net = fetch(request)
    .then((res) => {
      if (isImage(res)) cache.put(request, res.clone());
      return res;
    })
    .catch(() => hit);
  return hit ?? net;
}

// ── Portadas (Fase 2) ──
// Una sola caché para las <img> y para la escena 3D. Solo las de COVER_HOSTS, que son públicas: una imagen privada o de otro origen
// nunca entra, así que no hay nada que separar por cuenta ni que borrar al cerrar sesión. La caché es prescindible: si falla o el
// navegador la expulsa, se vuelve a pedir la portada y ya está.
const COVER_BUDGET = { bytes: 40 * 1024 * 1024, count: 300 };
/** Una respuesta opaca (origen sin CORS) no deja medir su tamaño: cuenta por esta cifra fija en el presupuesto. */
const OPAQUE_COST = 256 * 1024;
const COVER_REVALIDATE = 30 * 24 * 3600 * 1000;
/** Por debajo de esto no es una portada: Open Library responde a veces con un píxel transparente. */
const COVER_MIN_BYTES = 200;
const COVER_ACTIVE = 6;
const COVER_DB = 'bookshelf-portadas';
const coverNoCors = new Set();
const coverStats = { aciertos: 0, fallos: 0, revalidaciones: 0, descargas: 0, bytesRed: 0, errores: 0, cuota: 0, desalojadas: 0, agrupadas: 0 };

let coverDb = null;
function openCoverDb() {
  coverDb ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(COVER_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('entradas', { keyPath: 'key' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).catch((e) => {
    coverDb = null;
    throw e;
  });
  return coverDb;
}
async function coverIndex(mode, work) {
  const db = await openCoverDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('entradas', mode);
    const req = work(tx.objectStore('entradas'));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Clave estable: lo que identifica la portada, sin los parámetros de una dirección que cambian entre consultas. */
function coverKey(url) {
  if (url.hostname === 'covers.openlibrary.org') return `ol${url.pathname}`;
  const id = url.searchParams.get('id');
  if (id) return `gb/${id}/${url.searchParams.get('zoom') ?? ''}/${url.searchParams.get('printsec') ?? ''}`;
  const kept = [...url.searchParams].filter(([k]) => !['imgtk', 'edge', 'source', 'sig'].includes(k)).sort();
  return `${url.hostname}${url.pathname}?${new URLSearchParams(kept)}`;
}
const coverSlot = (key) => new Request(`/__portada/${encodeURIComponent(key)}`);

const coverUsed = new Set();
let coverUseTimer = 0;
function touchCover(key) {
  coverUsed.add(key);
  clearTimeout(coverUseTimer);
  coverUseTimer = setTimeout(flushCoverUse, 1000);
}
async function flushCoverUse() {
  const keys = [...coverUsed];
  coverUsed.clear();
  try {
    const cache = await caches.open(COVERS);
    const now = Date.now();
    for (const key of keys) {
      const known = await coverIndex('readonly', (s) => s.get(key));
      if (known) await coverIndex('readwrite', (s) => s.put({ ...known, used: now }));
      else {
        // Quedaba en la caché sin índice (índice expulsado): se vuelve a contar
        const hit = await cache.match(coverSlot(key));
        if (!hit) continue;
        const opaque = hit.type === 'opaque';
        const size = opaque ? OPAQUE_COST : (await hit.blob()).size;
        await coverIndex('readwrite', (s) => s.put({ key, size, opaque, used: now, stored: now }));
      }
    }
  } catch {
    // Solo se pierde el orden de uso
  }
}

let coverEvicting = Promise.resolve();
function evictCovers(extra = 0) {
  coverEvicting = coverEvicting
    .then(async () => {
      const cache = await caches.open(COVERS);
      const all = (await coverIndex('readonly', (s) => s.getAll())).sort((a, b) => a.used - b.used);
      let bytes = all.reduce((n, e) => n + e.size, 0);
      let count = all.length;
      for (const entry of all) {
        if (bytes <= COVER_BUDGET.bytes - extra && count <= COVER_BUDGET.count) break;
        await cache.delete(coverSlot(entry.key));
        await coverIndex('readwrite', (s) => s.delete(entry.key));
        bytes -= entry.size;
        count -= 1;
        coverStats.desalojadas += 1;
      }
    })
    .catch(() => {});
  return coverEvicting;
}

async function storeCover(key, response, size, opaque) {
  let cache = null;
  try {
    cache = await caches.open(COVERS);
    await cache.put(coverSlot(key), response);
    const now = Date.now();
    await coverIndex('readwrite', (s) => s.put({ key, size, opaque, used: now, stored: now }));
    await evictCovers();
  } catch {
    // Cuota llena o índice no disponible: la portada se ha servido igual. Sin índice no se guarda, para no crecer sin límite
    coverStats.cuota += 1;
    await cache?.delete(coverSlot(key)).catch(() => {});
    await evictCovers(COVER_BUDGET.bytes / 10);
  }
}

/** Descarga con CORS, para que la misma copia valga a la 3D; si el origen no lo permite, una <img> la recibe opaca. */
async function fetchCover(key, url, revalidate = false) {
  const init = { credentials: 'omit', referrerPolicy: 'no-referrer', ...(revalidate ? { cache: 'no-cache' } : null) };
  const host = new URL(url).hostname;
  let res;
  try {
    // Google Books no permite CORS: una vez visto, no se repite el intento en cada portada
    if (coverNoCors.has(host)) throw new Error('sin CORS');
    res = await fetch(url, { ...init, mode: 'cors' });
  } catch {
    if (revalidate) return null;
    try {
      res = await fetch(url, { ...init, mode: 'no-cors' });
      coverNoCors.add(host);
    } catch {
      coverStats.errores += 1;
      return Response.error();
    }
  }
  if (res.type === 'opaque') {
    if (revalidate) return null;
    coverStats.descargas += 1;
    await storeCover(key, res.clone(), OPAQUE_COST, true);
    return res;
  }
  if (!isImage(res)) {
    coverStats.errores += 1;
    return res;
  }
  const blob = await res.clone().blob();
  coverStats.descargas += 1;
  coverStats.bytesRed += blob.size;
  if (blob.size < COVER_MIN_BYTES) return res;
  // Respuesta propia, sin cabeceras del origen: sirve igual a una <img> y a una textura
  const copy = new Response(blob, { headers: { 'content-type': blob.type || 'image/jpeg' } });
  await storeCover(key, copy.clone(), blob.size, false);
  return copy;
}

const coverQueue = [];
let coverRunning = 0;
function nextCover() {
  while (coverRunning < COVER_ACTIVE && coverQueue.length) {
    // Primero lo último pedido: al desplazarse rápido, es lo que está a la vista
    const run = coverQueue.pop();
    coverRunning += 1;
    run().finally(() => {
      coverRunning -= 1;
      nextCover();
    });
  }
}
const limitCover = (work) =>
  new Promise((resolve) => {
    coverQueue.push(() => work().then(resolve, () => resolve(Response.error())));
    nextCover();
  });

const coverJobs = new Map();
function downloadCover(key, url) {
  let job = coverJobs.get(key);
  if (job) coverStats.agrupadas += 1;
  else {
    job = limitCover(() => fetchCover(key, url)).finally(() => coverJobs.delete(key));
    coverJobs.set(key, job);
  }
  return job;
}

async function revalidateCover(key, url) {
  if (coverJobs.has(key)) return;
  coverStats.revalidaciones += 1;
  const job = limitCover(() => fetchCover(key, url, true).then((r) => r ?? Response.error())).finally(() => coverJobs.delete(key));
  coverJobs.set(key, job);
  await job;
}

async function serveCover(event) {
  const { request } = event;
  const url = new URL(request.url);
  const key = coverKey(url);
  const wantsCors = request.mode === 'cors';
  let hit = null;
  try {
    hit = await (await caches.open(COVERS)).match(coverSlot(key));
  } catch {
    // Sin caché disponible: se va a la red
  }
  if (hit && !(wantsCors && hit.type === 'opaque')) {
    coverStats.aciertos += 1;
    touchCover(key);
    const entry = await coverIndex('readonly', (s) => s.get(key)).catch(() => null);
    if (entry && Date.now() - entry.stored > COVER_REVALIDATE) event.waitUntil(revalidateCover(key, url.href).catch(() => {}));
    return hit;
  }
  coverStats.fallos += 1;
  const res = await downloadCover(key, url.href);
  // Una copia opaca no le sirve a quien la pidió con CORS (no se podría usar como textura)
  if (wantsCors && res.type === 'opaque') return Response.error();
  return res.type === 'error' ? res : res.clone();
}

async function coverReport() {
  const all = await coverIndex('readonly', (s) => s.getAll()).catch(() => []);
  return { ...coverStats, entradas: all.length, bytes: all.reduce((n, e) => n + e.size, 0), claves: all.map((e) => e.key) };
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
    event.respondWith(serveCover(event));
    return;
  }

  // Otros orígenes (Supabase, fuentes, APIs de libros): directo a la red, sin guardar nada
  if (url.origin !== self.location.origin) return;

  // 1.58 (SPEC §56): vídeo y fondos de la visita social (/media/): siempre la red y la caché HTTP del navegador. Nunca
  // la caché propia (las peticiones de vídeo llegan por rangos y una respuesta parcial 206 no es el archivo entero)
  if (url.pathname.startsWith('/media/') || request.headers.has('range')) return;

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
