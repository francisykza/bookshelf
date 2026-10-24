// Color dominante aproximado de una portada (SPEC §18.4, fase IA-1). El libro se pinta al momento con su color
// determinista; la portada se analiza en segundo plano y, si todo va bien, sustituye solo ese color. Si falla
// (CORS, descarga, decodificación, tiempo), se queda el color inicial. Sin proxies, sin reintentos infinitos,
// sin guardar portadas: caché en memoria (200 entradas), una tarea por URL y como máximo 2 análisis a la vez.

const SIZE = 32;
const HEX = /^#[0-9a-f]{6}$/i;
const toHex = (r, g, b) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`.toUpperCase();

/**
 * Color representativo de una lista de píxeles RGBA: descarta transparentes, agrupa por cuantización (4 bits por
 * canal) y, si hay bastante contenido con color, no deja que márgenes blancos o negros dominen. `null` si la
 * imagen es monocromática (blanco, negro o gris) y no sirve como lomo.
 */
export function dominantColor(data) {
  const all = new Map();
  const colorful = new Map();
  let opaque = 0;
  let colored = 0;
  for (let i = 0; i + 3 < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (data[i + 3] < 128) continue;
    opaque += 1;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const add = (map) => {
      const e = map.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
      e.n += 1;
      e.r += r;
      e.g += g;
      e.b += b;
      map.set(key, e);
    };
    add(all);
    // Con color: ni casi blanco, ni casi negro, ni gris
    if (max > 28 && min < 232 && max - min > 24) {
      colored += 1;
      add(colorful);
    }
  }
  if (!opaque) return null;
  const pool = colored >= Math.max(8, opaque * 0.15) ? colorful : null;
  if (!pool) return null;
  let best = null;
  for (const [key, e] of pool) if (!best || e.n > best.n || (e.n === best.n && key < best.key)) best = { ...e, key };
  return toHex(best.r / best.n, best.g / best.n, best.b / best.n);
}

/** Lienzo compartido y reutilizado (nunca uno por libro). */
let canvas = null;
function pixelsOf(img) {
  if (!canvas) {
    canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(SIZE, SIZE) : document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
  }
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const scale = Math.min(1, SIZE / Math.max(img.naturalWidth || SIZE, img.naturalHeight || SIZE));
  const w = Math.max(1, Math.round((img.naturalWidth || SIZE) * scale));
  const h = Math.max(1, Math.round((img.naturalHeight || SIZE) * scale));
  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.drawImage(img, 0, 0, w, h);
  // Lanza SecurityError si la portada no permite CORS: se captura arriba y queda el color inicial
  return ctx.getImageData(0, 0, w, h).data;
}

/** Cargador del navegador: crossOrigin antes de src, con tiempo máximo; devuelve los píxeles reducidos. */
export function browserLoader(url, { timeoutMs }) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    let done = false;
    const finish = (fn, value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      fn(value);
    };
    const timer = setTimeout(() => {
      finish(reject, new Error('timeout'));
      img.src = '';
    }, timeoutMs);
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => {
      try {
        finish(resolve, pixelsOf(img));
      } catch (err) {
        finish(reject, err);
      }
    };
    img.onerror = () => finish(reject, new Error('error de carga'));
    img.src = url;
  });
}

/**
 * Servicio con caché LRU, deduplicación por URL y límite de concurrencia. Cancelar a un consumidor (`signal`) no
 * cancela la tarea compartida: los demás consumidores de esa portada siguen recibiendo el resultado.
 */
export function createCoverColorService({ load = browserLoader, maxConcurrent = 2, cacheSize = 200, defaultTimeout = 3000 } = {}) {
  const cache = new Map();
  const inflight = new Map();
  const queue = [];
  let active = 0;

  const remember = (url, color) => {
    cache.delete(url);
    cache.set(url, color);
    while (cache.size > cacheSize) cache.delete(cache.keys().next().value);
  };

  const pump = () => {
    while (active < maxConcurrent && queue.length) {
      const job = queue.shift();
      active += 1;
      let timer;
      // El tiempo máximo vale para cualquier cargador (también uno que no responda nunca)
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), job.timeoutMs);
      });
      Promise.race([Promise.resolve().then(() => load(job.url, { timeoutMs: job.timeoutMs })), timeout])
        .finally(() => clearTimeout(timer))
        .then((pixels) => dominantColor(pixels))
        .catch(() => null)
        .then((color) => {
          // También se recuerdan los fallos: no se reintenta en bucle
          remember(job.url, color);
          inflight.delete(job.url);
          active -= 1;
          job.resolve(color);
          pump();
        });
    }
  };

  const colorFor = (url, timeoutMs) => {
    if (cache.has(url)) {
      const color = cache.get(url);
      remember(url, color);
      return Promise.resolve(color);
    }
    if (!inflight.has(url)) {
      inflight.set(
        url,
        new Promise((resolve) => {
          queue.push({ url, timeoutMs, resolve });
          pump();
        }),
      );
    }
    return inflight.get(url);
  };

  return {
    get(url, { fallbackColor, signal, timeoutMs = defaultTimeout } = {}) {
      const fallback = HEX.test(fallbackColor ?? '') ? fallbackColor.toUpperCase() : '#77644F';
      const fail = { color: fallback, source: 'fallback' };
      if (typeof url !== 'string' || !/^(https?:|data:|blob:|\/)/.test(url)) return Promise.resolve(fail);
      if (signal?.aborted) return Promise.resolve(fail);
      const work = colorFor(url, timeoutMs).then((color) => (color ? { color, source: 'cover' } : fail));
      if (!signal) return work;
      return Promise.race([work, new Promise((resolve) => signal.addEventListener('abort', () => resolve(fail), { once: true }))]);
    },
    stats: () => ({ cached: cache.size, inflight: inflight.size, active, queued: queue.length }),
  };
}

const shared = createCoverColorService();

/** Color dominante aproximado de una portada: `{ color, source: 'cover' | 'fallback' }`. */
export const extractCoverColor = (coverUrl, options) => shared.get(coverUrl, options);
