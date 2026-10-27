// Contrato del catálogo de figuras (SPEC §11.7, 1.17.0): normalización y validación en un único punto, sin
// React, para que `public/figures/catalog.json` admita los campos canónicos y los alias anteriores. También la
// vinculación figura ↔ libro por saga y título (nunca solo por autor).
import { RARITY, fold } from './figures';
import { PRESET_SAGAS } from './sagas';

export const PARTICLE_PRESETS = ['mist', 'embers', 'stardust', 'wind', 'gold'];
export const DEFAULTS = { accentColor: '#E8C46A', secondaryColor: '#C59B27', particlePreset: 'gold', imageSize: { w: 1024, h: 1536 } };
/** Entradas añadidas a partir de esta versión del catálogo deben traer 5 sellos y 5 piezas. */
export const STRICT_SINCE = 2;

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const isSize = (s) => s && Number.isFinite(s.w) && Number.isFinite(s.h) && s.w > 0 && s.h > 0;
const isRect = (r) => r && ['x', 'y', 'w', 'h'].every((k) => Number.isFinite(r[k])) && r.w > 0 && r.h > 0;
const inside = (r, size) => isRect(r) && r.x >= 0 && r.y >= 0 && r.x + r.w <= size.w + 0.5 && r.y + r.h <= size.h + 0.5;
const pointsInside = (list, size) =>
  Array.isArray(list) && list.length >= 3 && list.every((p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && p[0] >= 0 && p[1] >= 0 && p[0] <= size.w && p[1] <= size.h);

/** Texto comparable: sin acentos ni mayúsculas, la puntuación como espacio y los espacios colapsados. */
export function normalizeText(text) {
  return fold(text)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** ¿Aparece `phrase` como palabras completas dentro de `text`? (ambos ya normalizados) */
const hasPhrase = (text, phrase) => Boolean(phrase) && ` ${text} `.includes(` ${phrase} `);

const assetUrl = (base, src) => (typeof src === 'string' && src ? (/^(https?:)?\//.test(src) ? src : base + src) : null);

/**
 * Normaliza una entrada. Devuelve `{ figure }` o `{ error }` (la entrada se descarta sin romper el resto) y
 * una lista de avisos para lo que se corrige por compatibilidad.
 */
export function normalizeFigure(entry, { imageSize, base = '/figures/' } = {}) {
  const warnings = [];
  if (!entry || typeof entry !== 'object') return { error: 'no es un objeto', warnings };
  const id = typeof entry.id === 'string' ? entry.id.trim() : '';
  if (!id) return { error: 'sin id', warnings };
  if (typeof entry.boxImage !== 'string' || !entry.boxImage) return { error: `${id}: sin boxImage`, warnings };
  const strict = (entry.since ?? 1) >= STRICT_SINCE;
  const fail = (msg) => ({ error: `${id}: ${msg}`, warnings });

  const rarity = RARITY[entry.rarity] ? entry.rarity : null;
  if (!rarity) {
    if (strict) return fail(`rareza «${entry.rarity}» no implementada`);
    warnings.push(`${id}: rareza «${entry.rarity}» no implementada, se usa «rare»`);
  }
  const particlePreset = entry.particlePreset ?? entry.particles ?? DEFAULTS.particlePreset;
  if (!PARTICLE_PRESETS.includes(particlePreset)) {
    if (strict) return fail(`partículas «${particlePreset}» no implementadas`);
    warnings.push(`${id}: partículas «${particlePreset}» no implementadas, se usa «gold»`);
  }
  const color = (value, fallback, name) => {
    if (value == null) return fallback;
    if (HEX.test(value)) return value;
    warnings.push(`${id}: ${name} «${value}» no es un color válido`);
    return fallback;
  };
  if (entry.matchKeywords != null && !Array.isArray(entry.matchKeywords)) warnings.push(`${id}: matchKeywords debe ser una lista`);
  const matchKeywords = (Array.isArray(entry.matchKeywords) ? entry.matchKeywords : []).filter((k) => typeof k === 'string' && k.trim());
  const loreSeals = (entry.loreSeals ?? []).filter((s) => typeof s === 'string' && s.trim());
  const rawParts = Array.isArray(entry.blisterParts) ? entry.blisterParts : [];
  if (strict && loreSeals.length !== 5) return fail('las figuras nuevas llevan 5 sellos');
  if (strict && rawParts.length !== 5) return fail('las figuras nuevas llevan 5 piezas');

  const boxSize = isSize(entry.boxSize) ? entry.boxSize : isSize(entry.imageSize) ? entry.imageSize : isSize(imageSize) ? imageSize : DEFAULTS.imageSize;
  // Dos rutas para la figura desprecintada: asset propio con alfa, o legacy (recorte de la foto de la caja)
  const ownUnboxed = typeof entry.unboxedImage === 'string' && entry.unboxedImage && entry.unboxedImage !== entry.boxImage && !entry.unboxedSilhouette;
  const unboxedSize = ownUnboxed ? (isSize(entry.unboxedSize) ? entry.unboxedSize : boxSize) : null;

  const boxOutline = entry.boxOutline == null ? null : pointsInside(entry.boxOutline, boxSize) ? entry.boxOutline : (warnings.push(`${id}: boxOutline fuera de la imagen`), null);
  const boxWindow = entry.boxWindow == null ? null : inside(entry.boxWindow, boxSize) ? entry.boxWindow : (warnings.push(`${id}: boxWindow fuera de la imagen`), null);
  const pinSource = entry.pinImage ? 'pin' : ownUnboxed ? 'unboxed' : 'box';
  const pinSize = pinSource === 'pin' ? (isSize(entry.pinSize) ? entry.pinSize : boxSize) : pinSource === 'unboxed' ? unboxedSize : boxSize;
  const pinCrop = entry.pinCrop == null ? null : inside(entry.pinCrop, pinSize) ? entry.pinCrop : (warnings.push(`${id}: pinCrop fuera de la imagen`), null);

  const parts = rawParts.map((p, i) => {
    if (typeof p === 'string') return { name: p, kind: 'relic', crop: null };
    const crop = p?.crop == null ? null : inside(p.crop, boxSize) ? p.crop : (warnings.push(`${id}: recorte de la pieza ${i + 1} fuera de la imagen`), null);
    return { name: p?.name ?? `Pieza ${i + 1}`, kind: p?.kind ?? 'relic', crop };
  });

  const unlockedByDefault = Boolean(entry.unlockedByDefault ?? entry.starter ?? false);
  const accentColor = color(entry.accentColor ?? entry.accent, DEFAULTS.accentColor, 'accentColor');
  const preset = PARTICLE_PRESETS.includes(particlePreset) ? particlePreset : DEFAULTS.particlePreset;
  const figure = {
    id,
    name: entry.name ?? id,
    sagaTitle: entry.sagaTitle ?? '',
    subtitle: entry.subtitle ?? '',
    matchKeywords,
    sagaId: typeof entry.sagaId === 'string' ? entry.sagaId : null,
    authors: (Array.isArray(entry.authors) ? entry.authors : []).filter((a) => typeof a === 'string' && a.trim()),
    rarity: rarity ?? 'rare',
    unlockedByDefault,
    accentColor,
    secondaryColor: color(entry.secondaryColor, DEFAULTS.secondaryColor, 'secondaryColor'),
    particlePreset: preset,
    boxImage: assetUrl(base, entry.boxImage),
    boxSize,
    // 1.45.0: la caja es su propio recorte con transparencia (ya en tres cuartos): sin contorno ni cantos dibujados
    boxAlpha: entry.boxAlpha === true,
    boxOutline,
    boxWindow,
    unboxedAvailable: ownUnboxed,
    unboxedImage: ownUnboxed ? assetUrl(base, entry.unboxedImage) : null,
    unboxedSize,
    pinImage: pinSource === 'pin' ? assetUrl(base, entry.pinImage) : pinSource === 'unboxed' ? assetUrl(base, entry.unboxedImage) : assetUrl(base, entry.boxImage),
    pinSize,
    pinCrop,
    loreSeals: loreSeals.slice(0, 5),
    parts,
    // Alias internos que aún usan los consumidores (1.14–1.16)
    starter: unlockedByDefault,
    accent: accentColor,
    particles: preset,
    img: boxSize,
  };
  return { figure, warnings };
}

/** Catálogo completo: `{ version, imageSize, figures }`. IDs repetidos: gana la primera entrada. */
export function normalizeCatalog(json, options = {}) {
  const warnings = [];
  const errors = [];
  if (!json || typeof json !== 'object' || !Array.isArray(json.figures)) return { figures: [], warnings, errors: ['el catálogo no tiene la lista «figures»'] };
  const seen = new Set();
  const figures = [];
  json.figures.forEach((entry, i) => {
    const { figure, error, warnings: w } = normalizeFigure(entry, { imageSize: json.imageSize, ...options });
    warnings.push(...w);
    if (error) {
      errors.push(`figura ${i + 1}: ${error}`);
      return;
    }
    if (seen.has(figure.id)) {
      errors.push(`figura ${i + 1}: id repetido «${figure.id}»`);
      return;
    }
    seen.add(figure.id);
    figures.push(figure);
  });
  return { figures, warnings, errors };
}

/** ¿El libro pertenece a la saga `sagaId`? (por los títulos de la saga, presets o propias) */
function inSaga(sagas, sagaId, title) {
  const saga = sagas.find((s) => s.id === sagaId);
  if (!saga) return false;
  return saga.books.some((b) => [b.title, ...(b.match ?? [])].some((m) => hasPhrase(title, normalizeText(m))));
}

/**
 * Figura guardiana de un libro: primero la saga explícita, después las palabras clave como palabras
 * completas del título. El autor solo desambigua: si la figura declara `authors` y el libro tiene otro, no
 * se vincula. Ningún libro se vincula solo por compartir autor.
 */
export function figureForBook(catalog, book, sagas = PRESET_SAGAS) {
  const title = normalizeText(book?.title);
  if (!title) return null;
  const author = normalizeText(book?.author);
  const authorAgrees = (fig) => !fig.authors?.length || !author || fig.authors.some((a) => {
    const n = normalizeText(a);
    return author.includes(n) || n.includes(author);
  });
  const bySaga = catalog.find((fig) => fig.sagaId && inSaga(sagas, fig.sagaId, title) && authorAgrees(fig));
  if (bySaga) return bySaga;
  const hits = catalog.filter((fig) => fig.matchKeywords.some((k) => hasPhrase(title, normalizeText(k))));
  return hits.find(authorAgrees) ?? null;
}

/**
 * Cargador del catálogo con caché en memoria. Un fallo (red, HTTP, JSON) no se guarda: la próxima llamada
 * vuelve a intentarlo. `fetchFn` se inyecta en las pruebas.
 */
export function createCatalogLoader({ url = '/figures/catalog.json', base = '/figures/', fetchFn = (...a) => fetch(...a), log = console } = {}) {
  let cache = null;
  let pending = null;
  return {
    get: () => cache,
    load() {
      if (cache) return Promise.resolve(cache);
      if (!pending) {
        pending = fetchFn(url, { cache: 'no-cache' })
          .then((r) => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.json();
          })
          .then((json) => {
            const { figures, warnings, errors } = normalizeCatalog(json, { base });
            if (!Array.isArray(json?.figures)) throw new Error(errors[0]);
            [...warnings, ...errors].forEach((m) => log.warn?.(`[catálogo de figuras] ${m}`));
            cache = figures;
            return cache;
          })
          .catch((err) => {
            log.warn?.(`[catálogo de figuras] no se pudo cargar: ${err.message}`);
            return null;
          })
          .finally(() => {
            pending = null;
          });
      }
      return pending;
    },
  };
}

/** Datos mínimos para las reglas puras de las Cajas Sorpresa. */
export const forRules = (catalog) => catalog.map((f) => ({ id: f.id, rarity: f.rarity, parts: f.parts }));
