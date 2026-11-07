// La cara de cada ejemplar de la estantería del piso (1.88). Cada libro de la balda es el mismo modelo que el de la mesa,
// con la portada real de su edición en su tapa. Solo se piden las portadas de los ejemplares que se dibujan, en miniatura
// (el tamaño mediano de Open Library o de Google Books), cuatro a la vez y con una caché acotada.
//
// El lomo: si el libro trae la imagen auténtica del lomo de su edición (`book.spine`), se usa esa. Si solo hay portada, el
// lomo es una RECONSTRUCCIÓN (no el lomo original): los colores de la portada, el título y el apellido del autor, en píxel.

/** Cuántas caras se recuerdan: el doble de los libros que caben en la estantería. */
export const LOOKS_MAX = 64;
const CONCURRENT = 4;
/** Medidas de un lomo en la textura del libro (las de materials.js). */
export const SPINE_PX = { w: 28, h: 128 };
/** La portada en la tapa: lo bastante para reconocerla de cerca, sin pedir la imagen grande. */
const COVER_PX = 150;

const cache = new Map();
let running = 0;
const waiting = [];

/** La miniatura de una portada: la misma imagen en mediano, cuando el servicio la ofrece. */
export function thumbUrl(url) {
  if (!url || typeof url !== 'string') return '';
  if (url.includes('covers.openlibrary.org')) return url.replace(/-[LS]\.jpg/, '-M.jpg');
  if (url.includes('books.google')) return `${url.replace(/&fife=w\d+-h\d+/, '')}&fife=w200-h300`;
  return url;
}

function remember(key, make) {
  if (cache.has(key)) {
    const hit = cache.get(key);
    // La más reciente, al final: se van las que llevan más tiempo sin dibujarse
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const made = make();
  cache.set(key, made);
  // Lo que no carga también se recuerda (hasta salir de la caché o recargar): no se vuelve a pedir en cada vuelta
  while (cache.size > LOOKS_MAX) cache.delete(cache.keys().next().value);
  return made;
}

function turn(task) {
  return new Promise((resolve) => {
    const run = () => {
      running += 1;
      task().then(resolve, () => resolve(null)).finally(() => {
        running -= 1;
        waiting.shift()?.();
      });
    };
    if (running < CONCURRENT) run();
    else waiting.push(run);
  });
}

function imageOf(src) {
  return turn(
    () =>
      new Promise((resolve) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.referrerPolicy = 'no-referrer';
        image.decoding = 'async';
        image.onload = () => resolve(image);
        image.onerror = () => resolve(null);
        image.src = src;
      }),
  );
}

const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/**
 * Los colores del lomo reconstruido: el del borde de la portada que da al lomo (`edge`, los píxeles de la izquierda), que es
 * el que suele seguir por el lomo, y para los detalles el color principal de la portada si es distinto, o su detalle.
 * Solo colores: nunca se pinta la portada sobre el lomo.
 */
export function spinePalette(edge, whole) {
  const e = paletteOf(edge);
  const w = paletteOf(whole);
  if (!e) return w;
  if (!w) return e;
  const accent = dist(w.base, e.base) > 90 ? w.base : dist(w.accent, e.base) > 60 ? w.accent : e.accent;
  return { base: e.base, accent, ink: lum(e.base) > 140 ? 'dark' : 'light' };
}

/** Tres colores de una portada: el que más ocupa, otro bien distinto para los detalles, y la tinta que se lee encima. */
export function paletteOf(data) {
  const buckets = new Map();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue;
    const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    const b = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    b.n += 1;
    b.r += data[i];
    b.g += data[i + 1];
    b.b += data[i + 2];
    buckets.set(key, b);
  }
  const ranked = [...buckets.values()].sort((a, b) => b.n - a.n).map((b) => [Math.round(b.r / b.n), Math.round(b.g / b.n), Math.round(b.b / b.n)]);
  if (!ranked.length) return null;
  const base = ranked[0];
  const accent = ranked.find((c) => dist(c, base) > 90) ?? (lum(base) > 128 ? base.map((v) => Math.round(v * 0.55)) : base.map((v) => Math.round(v + (255 - v) * 0.6)));
  return { base, accent, ink: lum(base) > 140 ? 'dark' : 'light' };
}

/** La portada reducida (para la tapa) y sus colores (para el lomo reconstruido). null si no se puede leer. */
function coverFace(image) {
  const aspect = image.naturalWidth / image.naturalHeight || 0.66;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(COVER_PX * Math.min(1, aspect));
  canvas.height = Math.round(canvas.width / aspect);
  const g = canvas.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingQuality = 'high';
  g.drawImage(image, 0, 0, canvas.width, canvas.height);
  try {
    // Sin permiso para leer sus píxeles (CORS) tampoco se puede usar como textura
    const sample = document.createElement('canvas');
    sample.width = 32;
    sample.height = 48;
    const s = sample.getContext('2d', { willReadFrequently: true });
    s.drawImage(canvas, 0, 0, 32, 48);
    return { cover: canvas, aspect, look: spinePalette(s.getImageData(0, 0, 5, 48).data, s.getImageData(0, 0, 32, 48).data) };
  } catch {
    return null;
  }
}

function spinePixels(image) {
  const canvas = document.createElement('canvas');
  canvas.width = SPINE_PX.w;
  canvas.height = SPINE_PX.h;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  g.drawImage(image, 0, 0, SPINE_PX.w, SPINE_PX.h);
  try {
    return g.getImageData(0, 0, SPINE_PX.w, SPINE_PX.h).data;
  } catch {
    return null;
  }
}

/**
 * Promesa de la cara de un ejemplar: `{ cover, aspect, look }` (la portada reducida, su proporción y los colores del lomo
 * reconstruido), con `look.pixels` si hay lomo auténtico; o null (sin portada: tela con su título y el color de siempre).
 * La clave es la imagen, no el libro: si cambia la portada o el lomo, se pide la nueva.
 */
export function bookFace(book) {
  const src = thumbUrl(book?.cover);
  const spine = typeof book?.spine === 'string' && book.spine ? book.spine : '';
  if (!src && !spine) return Promise.resolve(null);
  return remember(`${src}|${spine}`, async () => {
    const [image, spineImage] = await Promise.all([src ? imageOf(src) : null, spine ? imageOf(spine) : null]);
    const face = image ? coverFace(image) : null;
    const pixels = spineImage ? spinePixels(spineImage) : null;
    if (!face && !pixels) return null;
    return { cover: face?.cover ?? null, aspect: face?.aspect ?? null, look: pixels ? { pixels, authentic: true } : (face?.look ?? null) };
  });
}

/** Para las pruebas: cuántas caras se recuerdan ahora mismo. */
export const looksCached = () => cache.size;
