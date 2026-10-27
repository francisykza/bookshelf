// Buscador real de libros sin API key (SPEC §5.2, §40): Google Books y, si no responde o no encuentra nada,
// Open Library. Por título, autor o ISBN (un ISBN válido se busca como tal y su coincidencia exacta va primero).
// Cada resultado de Google es una edición; los de Open Library son obras, cuyas ediciones se piden al elegirlas.
// Los datos de una edición nunca se completan con los de otra: lo que falta se deja vacío para completarlo a mano.
import { stripHtml } from '../domain/books';
import { dedupeResults, isbnKey, langCode, normalizeEditions, normalizeText, parseIsbn, rankResults, userLanguage, yearOf } from '../domain/bookSearch';

const GOOGLE = 'https://www.googleapis.com/books/v1/volumes';
const OPEN_LIBRARY = 'https://openlibrary.org';
/** Tras un 429 de Google (cuota compartida sin clave) se pregunta directamente a Open Library un rato. */
const GOOGLE_COOLDOWN_MS = 10 * 60 * 1000;
let googleBlockedUntil = 0;
/** Respuestas recientes por consulta normalizada: repetir una búsqueda no vuelve a pedirla (máx. 30). */
const cache = new Map();
const CACHE_MAX = 30;

function googleCover(links) {
  const url = links?.extraLarge || links?.large || links?.medium || links?.thumbnail || links?.smallThumbnail;
  if (!url) return '';
  // Portada más grande y sin la esquina doblada que Google añade a las miniaturas
  return url.replace(/^http:/, 'https:').replace('&edge=curl', '').replace(/zoom=\d/, 'zoom=1') + '&fife=w600-h900';
}

function normalizeGoogle(item) {
  const v = item.volumeInfo ?? {};
  const isbn =
    v.industryIdentifiers?.find((i) => i.type === 'ISBN_13')?.identifier ||
    v.industryIdentifiers?.find((i) => i.type === 'ISBN_10')?.identifier ||
    '';
  return {
    key: `google:${item.id}`,
    source: 'google',
    kind: 'edition',
    title: v.subtitle && v.title.length < 24 ? `${v.title}: ${v.subtitle}` : v.title || 'Sin título',
    author: v.authors?.join(', ') || 'Autor desconocido',
    cover: googleCover(v.imageLinks),
    synopsis: stripHtml(v.description),
    // Google describe una edición concreta: su fecha es la de esa edición (la de la obra no la da)
    editionDate: v.publishedDate || '',
    firstPublished: '',
    publisher: v.publisher || '',
    categories: (v.categories ?? []).flatMap((c) => c.split('/').map((s) => s.trim())).slice(0, 4),
    pageCount: v.pageCount || null,
    isbn: isbnKey(isbn) || isbn,
    language: langCode(v.language),
  };
}

function normalizeOpenLibrary(doc) {
  return {
    key: `ol:${doc.key}`,
    source: 'openlibrary',
    kind: 'work',
    workKey: doc.key,
    title: doc.title || 'Sin título',
    author: doc.author_name?.join(', ') || 'Autor desconocido',
    cover: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : '',
    synopsis: '',
    // Año de la primera publicación de la OBRA; la fecha de la edición llega al elegir una
    firstPublished: doc.first_publish_year ? String(doc.first_publish_year) : '',
    editionDate: '',
    publisher: '',
    categories: (doc.subject ?? []).slice(0, 4),
    // La mediana de páginas mezcla ediciones: no se usa como dato de ninguna
    pageCount: null,
    editionCount: doc.edition_count || 0,
    isbn: '',
    languages: (doc.language ?? []).map(langCode),
    language: '',
  };
}

async function searchGoogle(query, isbn, signal) {
  const q = isbn ? `isbn:${isbn}` : query;
  const url = `${GOOGLE}?q=${encodeURIComponent(q)}&maxResults=20&printType=books&orderBy=relevance`;
  const res = await fetch(url, { signal });
  if (res.status === 429) googleBlockedUntil = Date.now() + GOOGLE_COOLDOWN_MS;
  if (!res.ok) throw new Error(`Google Books respondió ${res.status}`);
  const data = await res.json();
  return (data.items ?? []).map(normalizeGoogle);
}

const OL_FIELDS = 'key,title,author_name,cover_i,first_publish_year,edition_count,subject,language';

async function searchOpenLibrary(query, isbn, signal, lang) {
  const url = `${OPEN_LIBRARY}/search.json?${isbn ? `isbn=${isbn}` : `q=${encodeURIComponent(query)}`}&limit=20&fields=${OL_FIELDS}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Open Library respondió ${res.status}`);
  const docs = ((await res.json()).docs ?? []).map(normalizeOpenLibrary);
  if (!isbn || !docs.length) return docs;
  // Por ISBN: la edición exacta con sus propios datos, dentro de su obra
  const edition = await fetchIsbnEdition(isbn, signal, lang);
  return edition ? [{ ...docs[0], ...edition, title: edition.title || docs[0].title, key: `ol:${edition.editionKey}`, kind: 'edition', firstPublished: docs[0].firstPublished }, ...docs.slice(1)] : docs;
}

async function fetchIsbnEdition(isbn, signal, lang) {
  try {
    const res = await fetch(`${OPEN_LIBRARY}/isbn/${isbn}.json`, { signal });
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) return null;
    const raw = await res.json();
    return normalizeEditions([raw], { lang })[0] ?? null;
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    return null;
  }
}

/**
 * Busca por título, autor o ISBN. Devuelve `{ results, source, isbn }` ordenados (ISBN exacto, título, idioma del
 * usuario) sin ocultar ediciones; si Google falla o no encuentra nada, pregunta a Open Library. Solo lanza si
 * ambas fuentes fallan (o si se aborta). Las consultas iguales salvo mayúsculas, tildes o puntuación comparten
 * respuesta en memoria.
 */
export async function searchBooks(query, { signal, lang = userLanguage() } = {}) {
  const q = query.trim();
  const isbn = parseIsbn(q);
  const norm = isbn ?? normalizeText(q);
  if (!isbn && norm.length < 2) return { results: [], source: null, isbn: null };
  const cacheKey = `${lang}|${norm}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const finish = (results, source) => {
    const out = { results: rankResults(dedupeResults(results), { query: q, isbn, lang }), source, isbn };
    cache.set(cacheKey, out);
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
    return out;
  };
  if (Date.now() >= googleBlockedUntil) {
    try {
      const results = await searchGoogle(q, isbn, signal);
      if (results.length) return finish(results, 'google');
    } catch (error) {
      if (error.name === 'AbortError') throw error;
    }
  }
  try {
    return finish(await searchOpenLibrary(q, isbn, signal, lang), 'openlibrary');
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('No hemos podido conectar con Google Books ni con Open Library. Revisa tu conexión.', { cause: error });
  }
}

/** Vacía la memoria de búsquedas (pruebas). */
export const clearSearchCache = () => cache.clear();

/**
 * Ediciones de una obra de Open Library, cada una con sus propios datos y las del idioma del usuario primero.
 * `{ editions, total }`; lista vacía si el proveedor no responde (se puede seguir con los datos de la obra).
 */
export async function fetchEditions(workKey, { signal, lang = userLanguage() } = {}) {
  if (!/^\/works\/OL\d+W$/.test(workKey ?? '')) return { editions: [], total: 0 };
  try {
    const res = await fetch(`${OPEN_LIBRARY}${workKey}/editions.json?limit=60`, { signal });
    if (!res.ok) return { editions: [], total: 0 };
    const data = await res.json();
    return { editions: normalizeEditions(data.entries, { lang }), total: data.size ?? data.entries?.length ?? 0 };
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    return { editions: [], total: 0 };
  }
}

/** Open Library guarda algunas sinopsis en Markdown con créditos y enlaces al final. */
function cleanMarkdown(text) {
  return text
    .split(/\n-{3,}|\(\[source\]/)[0]
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, '$1')
    .trim();
}

/** Completa la sinopsis (dato de la obra, válido para cualquier edición) de un resultado de Open Library. */
export async function fetchDetails(result, { signal } = {}) {
  if (result.source !== 'openlibrary' || !result.workKey) return result;
  try {
    const res = await fetch(`${OPEN_LIBRARY}${result.workKey}.json`, { signal });
    if (!res.ok) return result;
    const work = await res.json();
    const description = typeof work.description === 'string' ? work.description : work.description?.value;
    return {
      ...result,
      synopsis: cleanMarkdown(stripHtml(description || result.synopsis)),
      categories: result.categories.length ? result.categories : (work.subjects ?? []).slice(0, 4),
      firstPublished: result.firstPublished || yearOf(work.first_publish_date),
    };
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    return result;
  }
}

/**
 * Obra de Open Library a la que pertenece una edición por su ISBN (SPEC §25.2): una referencia verificada (la
 * que da el propio catálogo para ese ISBN), no una coincidencia de título. Devuelve `/works/OL…W` o null.
 */
export async function workKeyForIsbn(isbn, { signal } = {}) {
  const clean = String(isbn ?? '').replace(/[^0-9Xx]/g, '');
  if (clean.length !== 10 && clean.length !== 13) return null;
  const res = await fetch(`${OPEN_LIBRARY}/isbn/${clean}.json`, { signal });
  if (!res.ok) return null;
  const key = (await res.json())?.works?.[0]?.key;
  return /^\/works\/OL\d+W$/.test(key ?? '') ? key : null;
}
