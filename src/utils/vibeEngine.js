// Motor físico y ambiental local (SPEC §18.2–18.3, fase IA-1): funciones puras y deterministas, sin red, DOM ni
// almacenamiento. No modifican el libro recibido y aceptan datos incompletos.
//
// Prioridad: personalización explícita > edición física conocida > inferencia por géneros > valor por defecto.

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Texto comparable: minúsculas, sin acentos, espacios colapsados. */
export function normalizeTag(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Hash FNV-1a de 32 bits (solo operaciones enteras). */
export function stableHash(text) {
  let h = 2166136261;
  const s = String(text);
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Clave estable del libro: id → título normalizado → 'unknown-book'. */
const bookKey = (book) => {
  const id = typeof book?.id === 'string' || typeof book?.id === 'number' ? String(book.id).trim() : '';
  if (id) return id;
  const title = normalizeTag(book?.title);
  return title || 'unknown-book';
};

/** Etiquetas válidas del libro (categorías y tags), normalizadas y sin repetir. */
export function bookTags(book) {
  const raw = [].concat(Array.isArray(book?.tags) ? book.tags : [], Array.isArray(book?.categories) ? book.categories : []);
  return [...new Set(raw.filter((t) => typeof t === 'string').map(normalizeTag).filter(Boolean))];
}

export const SPINE_PALETTE = ['#6B4438', '#536753', '#405B70', '#8A7048', '#66516B', '#A27356', '#485C60', '#77644F'];
export const MATERIALS = ['leather', 'cloth', 'paper', 'metallic'];

/** Edición física → material (las demás conservan su tratamiento y el material es auxiliar). */
const EDITION_MATERIAL = { leatherbound: 'leather', clothbound: 'cloth', paperback: 'paper', annotated: 'paper', hardcover: 'cloth' };

/** Inferencia por géneros, en orden de prioridad (una sola coincidencia exacta por etiqueta). */
const MATERIAL_TAGS = [
  ['leather', ['clasico', 'clasicos', 'classic', 'classics']],
  ['cloth', ['poesia', 'poetry', 'poemas']],
  ['metallic', ['ciencia ficcion', 'sci fi', 'scifi', 'science fiction']],
];
const FOIL_TAGS = ['fantasia', 'fantasy', 'clasico', 'clasicos', 'classic', 'classics'];

/** Duración en minutos solo si se conoce su unidad: `durationMinutes` o `audioHours` (horas → × 60). */
function durationMinutes(book) {
  const m = Number(book?.durationMinutes);
  if (Number.isFinite(m) && m > 0) return m;
  const h = Number(book?.audioHours);
  if (Number.isFinite(h) && h > 0) return h * 60;
  return null;
}

/**
 * Física del libro: grosor (0,5–1,8), altura (0,95–1,08), material, pan de oro y color inicial del lomo.
 * El pan de oro inferido es un recurso visual, no una característica comercial verificada.
 */
export function calculateBookPhysics(book) {
  const b = book && typeof book === 'object' ? book : {};
  const pages = Number(b.pageCount);
  let thickness = 0.9;
  if (Number.isFinite(pages) && pages > 0) thickness = 0.5 + clamp((pages - 80) / (1000 - 80), 0, 1) * 1.3;
  else if (b.editionType === 'audiobook' || b.mediaType === 'audiobook') {
    const minutes = durationMinutes(b);
    if (minutes) thickness = 0.5 + clamp((minutes - 120) / (2400 - 120), 0, 1) * 1.3;
  }

  const h = stableHash(bookKey(b));
  const height = 0.95 + ((h % 10000) / 9999) * 0.13;
  const spineColor = SPINE_PALETTE[h % SPINE_PALETTE.length];

  const tags = bookTags(b);
  const custom = b.appearance && typeof b.appearance === 'object' ? b.appearance : {};
  let material = 'paper';
  let editionDecides = false;
  if (MATERIALS.includes(custom.material)) material = custom.material;
  else if (EDITION_MATERIAL[b.editionType]) {
    material = EDITION_MATERIAL[b.editionType];
    editionDecides = true;
  } else {
    const hit = MATERIAL_TAGS.find(([, names]) => names.some((n) => tags.includes(n)));
    if (hit) material = hit[0];
  }

  let goldFoil;
  if (typeof custom.goldFoil === 'boolean') goldFoil = custom.goldFoil;
  // La edición manda cuando define su presentación (cuero y tela ya llevan su dorado; bolsillo no)
  else if (editionDecides) goldFoil = b.editionType === 'leatherbound' || b.editionType === 'clothbound';
  else goldFoil = FOIL_TAGS.some((t) => tags.includes(t));

  return { thickness, height, material, goldFoil, spineColor };
}

/** Preajustes ambientales. `weather` y `ambientSound` son contratos de datos (el render y el audio pueden no soportarlos aún). */
export const VIBE_PRESETS = {
  fantasy: { lightColor: '#E7BD79', secondaryColor: '#68788F', weather: 'starlight', ambientSound: 'fireplace' },
  mystery: { lightColor: '#AAB8C6', secondaryColor: '#697384', weather: 'fog', ambientSound: 'rain_window' },
  romance: { lightColor: '#F0CAA8', secondaryColor: '#B58A91', weather: 'clear', ambientSound: 'library_silence' },
  science_fiction: { lightColor: '#A3C9D5', secondaryColor: '#777DA8', weather: 'starlight', ambientSound: 'night_crickets' },
  winter: { lightColor: '#DCE6EA', secondaryColor: '#97ADBE', weather: 'snow', ambientSound: 'fireplace' },
  default: { lightColor: '#E8C99B', secondaryColor: '#92A99B', weather: 'clear', ambientSound: 'library_silence' },
};

/**
 * Diccionario explícito de etiquetas (español e inglés) → preajuste, en orden de prioridad estable. Solo cuenta
 * la etiqueta entera normalizada: «romántica» no coincide dentro de «neorromántica».
 */
export const VIBE_PRIORITY = ['mystery', 'science_fiction', 'winter', 'fantasy', 'romance'];
export const VIBE_TAGS = {
  mystery: ['misterio', 'mystery', 'thriller', 'suspense', 'novela negra', 'policiaca', 'policiaco', 'crimen', 'crime', 'detective', 'detectives', 'intriga', 'noir'],
  science_fiction: ['ciencia ficcion', 'science fiction', 'sci fi', 'scifi', 'ci fi', 'distopia', 'dystopia', 'space opera', 'cyberpunk'],
  winter: ['invierno', 'winter', 'navidad', 'christmas', 'nieve', 'snow'],
  fantasy: ['fantasia', 'fantasy', 'fantasia epica', 'epic fantasy', 'alta fantasia', 'high fantasy', 'mitologia', 'mythology', 'dragones', 'magia', 'magic'],
  romance: ['romance', 'romantica', 'romantico', 'romantic', 'amor', 'love', 'romantasy'],
};

/** Ambiente determinista de un libro: el primer preajuste por prioridad cuyas etiquetas aparecen enteras. */
export function getDeterministicVibe(book) {
  const tags = new Set(bookTags(book));
  const presetId = VIBE_PRIORITY.find((id) => VIBE_TAGS[id].some((t) => tags.has(t))) ?? 'default';
  return { presetId, ...VIBE_PRESETS[presetId] };
}
