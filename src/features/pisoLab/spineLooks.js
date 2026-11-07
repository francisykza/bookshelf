// La cara de cada lomo de la estantería del piso (1.88). Solo se piden las portadas de los ejemplares que se dibujan,
// en miniatura (el tamaño pequeño de Open Library o de Google Books), cuatro a la vez y con una caché acotada: de cada
// portada solo se guardan tres colores. Si el libro trae su propio lomo (`book.spine`, una imagen), se usa ese, reducido
// al tamaño del atlas; si no, el lomo se pinta con los colores de su portada, su título y su autor (materials.js).
// Sin portada, o si la portada no deja leer sus píxeles, queda el color de siempre (`spineColor`).

/** Cuántas portadas y lomos se recuerdan: el doble de los libros que caben en la estantería. */
export const LOOKS_MAX = 64;
const CONCURRENT = 4;
/** Medidas de una celda del atlas (las de materials.js). */
export const SPINE_PX = { w: 28, h: 128 };

const cache = new Map();
let running = 0;
const waiting = [];

/** La miniatura de una portada: la misma imagen en pequeño, cuando el servicio la ofrece. */
export function thumbUrl(url) {
  if (!url || typeof url !== 'string') return '';
  if (url.includes('covers.openlibrary.org')) return url.replace(/-[LM]\.jpg/, '-S.jpg');
  if (url.includes('books.google')) return `${url.replace(/&fife=w\d+-h\d+/, '')}&fife=w80-h120`;
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

function pixelsOf(src, w, h, fit) {
  return turn(
    () =>
      new Promise((resolve) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.referrerPolicy = 'no-referrer';
        image.decoding = 'async';
        image.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const g = canvas.getContext('2d', { willReadFrequently: true });
            g.imageSmoothingEnabled = true;
            fit(g, image, w, h);
            resolve(g.getImageData(0, 0, w, h).data);
          } catch {
            // Sin permiso para leer sus píxeles (CORS): el color de siempre
            resolve(null);
          }
        };
        image.onerror = () => resolve(null);
        image.src = src;
      }),
  );
}

const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

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

/** La portada entera en pequeño (32 × 48), para sacar sus colores. */
const fitCover = (g, image, w, h) => g.drawImage(image, 0, 0, w, h);
/** El lomo real, ocupando la celda del atlas. */
const fitSpine = (g, image, w, h) => g.drawImage(image, 0, 0, w, h);

/**
 * Promesa de la cara de un lomo: `{ pixels }` (el lomo real, RGBA de 28 × 128), `{ base, accent, ink }` (de su portada) o
 * null (el color de siempre). La clave es la imagen, no el libro: si cambia la portada o el lomo, se pide la nueva.
 */
export function spineLook(book) {
  const spine = typeof book?.spine === 'string' && book.spine ? book.spine : '';
  if (spine) return remember(`lomo|${spine}`, () => pixelsOf(spine, SPINE_PX.w, SPINE_PX.h, fitSpine).then((pixels) => (pixels ? { pixels } : null)));
  const src = thumbUrl(book?.cover);
  if (!src) return Promise.resolve(null);
  return remember(`portada|${src}`, () => pixelsOf(src, 32, 48, fitCover).then((pixels) => (pixels ? paletteOf(pixels) : null)));
}

/** Para las pruebas: cuántas caras se recuerdan ahora mismo. */
export const looksCached = () => cache.size;
