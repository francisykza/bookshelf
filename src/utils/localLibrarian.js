// Bibliotecario local (SPEC §18.5, fase IA-1): un sistema de REGLAS sobre la biblioteca del usuario, sin red ni
// modelos. Reconoce unas pocas intenciones y negaciones simples con un diccionario explícito; no entiende
// cualquier petición y no lo finge. Devuelve como máximo dos libros del catálogo recibido, nunca inventados.
import { normalizeTag } from './vibeEngine';

export const LIMITS = { mood: 500, catalog: 5000, tags: 20 };
export const SCORES = { intent: 5, genre: 4, short: 3, long: 3, pending: 1, rejected: -8 };
const WEATHERS = ['clear', 'rain', 'fog', 'starlight'];

/** Intenciones: palabras de la petición → etiquetas del libro que las cumplen. */
export const INTENTS = {
  calm: {
    words: ['tranquilo', 'tranquila', 'relajante', 'relajarme', 'acogedor', 'acogedora', 'cozy', 'calma', 'sereno', 'serena'],
    tags: ['acogedor', 'cozy', 'feel good', 'slice of life', 'fabula', 'poesia', 'tranquilo'],
    weather: 'rain',
    reason: 'tiene un tono tranquilo según sus etiquetas',
  },
  mystery: {
    words: ['misterio', 'misterios', 'intriga', 'suspense', 'thriller', 'enigma'],
    tags: ['misterio', 'mystery', 'intriga', 'suspense', 'thriller', 'novela negra', 'policiaca', 'policiaco'],
    weather: 'fog',
    reason: 'sus etiquetas hablan de misterio',
  },
  adventure: {
    words: ['aventura', 'aventuras', 'epico', 'epica', 'epicas', 'epicos'],
    tags: ['aventura', 'aventuras', 'adventure', 'epica', 'epico', 'fantasia epica', 'epic fantasy'],
    weather: 'starlight',
    reason: 'sus etiquetas prometen aventura',
  },
  romance: {
    words: ['romantico', 'romantica', 'romance', 'amor', 'enamorarme'],
    tags: ['romance', 'romantica', 'romantico', 'amor', 'love', 'romantasy'],
    weather: 'clear',
    reason: 'sus etiquetas incluyen romance',
  },
};

/** Géneros que se pueden pedir por su nombre. */
export const GENRES = {
  fantasia: ['fantasia', 'fantasy'],
  'ciencia ficcion': ['ciencia ficcion', 'science fiction', 'sci fi', 'scifi'],
  clasico: ['clasico', 'clasicos', 'classic'],
  juvenil: ['juvenil', 'young adult'],
  mitologia: ['mitologia', 'mythology'],
  terror: ['terror', 'horror'],
  historica: ['historica', 'historical'],
  literaria: ['literaria', 'literary'],
  poesia: ['poesia', 'poetry'],
};
const SHORT = ['corto', 'corta', 'breve', 'breves', 'cortito', 'rapido', 'rapida'];
const LONG = ['largo', 'larga', 'extenso', 'extensa', 'tocho', 'largos'];
const NEGATORS = [['sin'], ['nada', 'de'], ['no', 'quiero'], ['no', 'me', 'apetece'], ['evitar'], ['ni']];

/** Palabras de la petición; las comas, puntos, «y» y «pero» quedan como límites de cláusula («|»). */
const BOUNDARY = '|';
const tokens = (text) =>
  normalizeTag(text)
    .replace(/[,.;:!?()]+/g, ` ${BOUNDARY} `)
    .replace(/[^a-z0-9| ]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((t) => (t === 'y' || t === 'pero' || t === 'aunque' ? BOUNDARY : t));
const has = (toks, phrase) => {
  const p = phrase.split(' ');
  for (let i = 0; i + p.length <= toks.length; i += 1) if (p.every((w, j) => toks[i + j] === w)) return i;
  return -1;
};
const words = (s) => s.split(/\s+/).filter(Boolean).length;

/** Qué pide el usuario: intenciones, géneros, longitud y lo que rechaza (negaciones simples cercanas). */
export function parseMood(mood) {
  const toks = tokens(String(mood ?? '').slice(0, LIMITS.mood));
  // Zonas negadas: hasta tres palabras tras «sin», «nada de», «no quiero», «no me apetece», «evitar», «ni»,
  // dentro de su cláusula («no quiero romance, algo largo» no niega «largo»)
  const negated = new Set();
  for (let i = 0; i < toks.length; i += 1) {
    for (const neg of NEGATORS) {
      if (!neg.every((w, j) => toks[i + j] === w)) continue;
      // La negación alcanza como mucho tres palabras y nunca cruza un límite de cláusula
      for (let k = i + neg.length; k < Math.min(toks.length, i + neg.length + 3) && toks[k] !== BOUNDARY; k += 1) negated.add(k);
    }
  }
  const find = (list) => {
    let pos = null;
    let neg = false;
    for (const w of list) {
      const at = has(toks, w);
      if (at >= 0) {
        pos = at;
        neg = negated.has(at);
        if (!neg) break;
      }
    }
    return pos === null ? null : neg ? 'rejected' : 'wanted';
  };
  const intents = [];
  const rejectedTags = new Set();
  for (const [id, def] of Object.entries(INTENTS)) {
    const r = find(def.words);
    if (r === 'wanted') intents.push(id);
    if (r === 'rejected') def.tags.forEach((t) => rejectedTags.add(t));
  }
  const genres = [];
  for (const [id, names] of Object.entries(GENRES)) {
    const r = find(names);
    if (r === 'wanted') genres.push(id);
    if (r === 'rejected') names.forEach((t) => rejectedTags.add(t));
  }
  const short = find(SHORT) === 'wanted';
  const long = !short && find(LONG) === 'wanted';
  const recognized = intents.length > 0 || genres.length > 0 || short || long || rejectedTags.size > 0;
  return { intents, genres, short, long, rejectedTags: [...rejectedTags], recognized };
}

/** Catálogo saneado: entradas válidas, IDs únicos (gana la primera), etiquetas normalizadas y acotadas. */
export function sanitizeCatalog(catalog) {
  const seen = new Set();
  const out = [];
  for (const raw of (Array.isArray(catalog) ? catalog : []).slice(0, LIMITS.catalog)) {
    if (!raw || typeof raw !== 'object') continue;
    const id = typeof raw.id === 'string' || typeof raw.id === 'number' ? String(raw.id).trim() : '';
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const tags = [...new Set((Array.isArray(raw.tags) ? raw.tags : []).filter((t) => typeof t === 'string').slice(0, LIMITS.tags).map(normalizeTag).filter(Boolean))];
    const pages = Number(raw.pageCount);
    out.push({ id, title: typeof raw.title === 'string' ? raw.title.trim() : '', mediaType: raw.mediaType ?? 'book', tags, pageCount: Number.isFinite(pages) && pages > 0 ? pages : null, status: raw.status ?? null });
  }
  return out;
}

/** Puntuación explicable de un libro para una petición. */
export function scoreBook(book, want) {
  let score = 0;
  const reasons = [];
  for (const id of want.intents) {
    if (INTENTS[id].tags.some((t) => book.tags.includes(t))) {
      score += SCORES.intent;
      reasons.push(INTENTS[id].reason);
    }
  }
  for (const g of want.genres) {
    if (GENRES[g].some((t) => book.tags.includes(t))) {
      score += SCORES.genre;
      reasons.push(`es de ${g}`);
    }
  }
  if (want.short && book.pageCount && book.pageCount <= 250) {
    score += SCORES.short;
    reasons.push(`es breve (${book.pageCount} páginas)`);
  }
  if (want.long && book.pageCount && book.pageCount >= 500) {
    score += SCORES.long;
    reasons.push(`es largo (${book.pageCount} páginas)`);
  }
  if (score > 0 && book.status === 'want') {
    score += SCORES.pending;
    reasons.push('lo tienes pendiente');
  }
  if (want.rejectedTags.some((t) => book.tags.includes(t))) score += SCORES.rejected;
  return { score, reasons };
}

/** Frase breve (≤ 20 palabras), sin citas ni promesas de que gustará. */
function whisper(text) {
  const w = text.split(/\s+/).filter(Boolean);
  return w.length <= 20 ? text : `${w.slice(0, 19).join(' ')}…`;
}

/**
 * Recomendación local: `{ recommendedIds (≤ 2), librarianWhisper, suggestedWeather }`. Desempate estable por ID
 * (nunca por el orden del catálogo). El clima es una propuesta: quien llama decide si la aplica.
 */
export function recommendLocally({ userMood, catalog } = {}) {
  const books = sanitizeCatalog(catalog);
  if (!books.length) return { recommendedIds: [], librarianWhisper: 'Tu biblioteca está vacía: añade algún libro y te ayudo a elegir.', suggestedWeather: 'clear' };
  const want = parseMood(userMood);
  if (!want.recognized) {
    return { recommendedIds: [], librarianWhisper: 'No reconozco esa petición. Prueba con «algo corto», «misterio», «tranquilo» o «aventura».', suggestedWeather: 'clear' };
  }
  const weather = WEATHERS.includes(INTENTS[want.intents[0]]?.weather) ? INTENTS[want.intents[0]].weather : 'clear';
  const ranked = books
    .map((b) => ({ b, ...scoreBook(b, want) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || (a.b.id < b.b.id ? -1 : a.b.id > b.b.id ? 1 : 0));
  if (ranked.length) {
    const top = ranked.slice(0, 2);
    const first = top[0];
    const lead = first.b.title && words(first.b.title) <= 6 ? `«${first.b.title}» ` : 'Este libro ';
    const text = `${lead}${first.reasons[0] ?? 'encaja con tu petición'}${top.length > 1 ? '; te dejo otra opción' : ''}.`;
    return { recommendedIds: top.map((x) => x.b.id), librarianWhisper: whisper(text), suggestedWeather: weather };
  }
  // Sin coincidencias: una sugerencia neutra, dicha como tal (un pendiente no rechazado, por ID)
  const neutral = books
    .filter((b) => b.status === 'want' && !want.rejectedTags.some((t) => b.tags.includes(t)))
    .sort((a, b) => (a.id < b.id ? -1 : 1))[0];
  return {
    recommendedIds: neutral ? [neutral.id] : [],
    librarianWhisper: neutral ? 'Nada encaja del todo; como sugerencia neutra, un pendiente de tu estante.' : 'Nada de tu biblioteca encaja con eso. Prueba otra preferencia sencilla.',
    suggestedWeather: weather,
  };
}

/** Catálogo que recibe el bibliotecario: solo metadatos que ya están en la biblioteca del usuario. */
export const toCatalog = (books) =>
  (books ?? []).map((b) => ({ id: b.id, title: b.title, mediaType: b.editionType === 'audiobook' ? 'audiobook' : 'book', tags: b.categories ?? [], pageCount: b.pageCount, status: b.status }));
