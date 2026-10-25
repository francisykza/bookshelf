// Buscador real de libros sin API key (SPEC §5.2): Google Books y, como respaldo automático, Open Library.
import { stripHtml } from '../domain/books';

const GOOGLE = 'https://www.googleapis.com/books/v1/volumes';
const OPEN_LIBRARY = 'https://openlibrary.org';
/** Tras un 429 de Google (cuota compartida sin clave) se pregunta directamente a Open Library un rato. */
const GOOGLE_COOLDOWN_MS = 10 * 60 * 1000;
let googleBlockedUntil = 0;

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
    title: v.subtitle && v.title.length < 24 ? `${v.title}: ${v.subtitle}` : v.title || 'Sin título',
    author: v.authors?.join(', ') || 'Autor desconocido',
    cover: googleCover(v.imageLinks),
    synopsis: stripHtml(v.description),
    publishedDate: v.publishedDate || '',
    categories: (v.categories ?? []).flatMap((c) => c.split('/').map((s) => s.trim())).slice(0, 4),
    pageCount: v.pageCount || 0,
    isbn,
    language: v.language || '',
  };
}

function normalizeOpenLibrary(doc) {
  return {
    key: `ol:${doc.key}`,
    source: 'openlibrary',
    workKey: doc.key,
    title: doc.title || 'Sin título',
    author: doc.author_name?.join(', ') || 'Autor desconocido',
    cover: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : '',
    synopsis: '',
    publishedDate: doc.first_publish_year ? String(doc.first_publish_year) : '',
    categories: (doc.subject ?? []).slice(0, 4),
    pageCount: doc.number_of_pages_median || 0,
    isbn: doc.isbn?.find((i) => i.length === 13) || doc.isbn?.[0] || '',
    language: doc.language?.[0] || '',
  };
}

async function searchGoogle(query, signal) {
  const url = `${GOOGLE}?q=${encodeURIComponent(query)}&maxResults=20&printType=books&orderBy=relevance`;
  const res = await fetch(url, { signal });
  if (res.status === 429) googleBlockedUntil = Date.now() + GOOGLE_COOLDOWN_MS;
  if (!res.ok) throw new Error(`Google Books respondió ${res.status}`);
  const data = await res.json();
  return (data.items ?? []).map(normalizeGoogle);
}

async function searchOpenLibrary(query, signal) {
  const fields = 'key,title,author_name,cover_i,first_publish_year,number_of_pages_median,subject,isbn,language';
  const url = `${OPEN_LIBRARY}/search.json?q=${encodeURIComponent(query)}&limit=20&fields=${fields}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Open Library respondió ${res.status}`);
  const data = await res.json();
  return (data.docs ?? []).map(normalizeOpenLibrary);
}

/**
 * Busca por título o autor. Devuelve `{ results, source }`; si Google falla o no encuentra nada,
 * pregunta a Open Library. Solo lanza si ambas fuentes fallan (o si se aborta).
 */
export async function searchBooks(query, { signal } = {}) {
  const q = query.trim();
  if (q.length < 2) return { results: [], source: null };
  let googleError = null;
  if (Date.now() >= googleBlockedUntil) {
    try {
      const results = await searchGoogle(q, signal);
      if (results.length) return { results: dedupe(results), source: 'google' };
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      googleError = error;
    }
  }
  try {
    const results = await searchOpenLibrary(q, signal);
    return { results: dedupe(results), source: 'openlibrary', fallbackReason: googleError?.message };
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('No hemos podido conectar con Google Books ni con Open Library. Revisa tu conexión.');
  }
}

function dedupe(results) {
  const seen = new Set();
  return results.filter((r) => {
    const id = `${r.title.toLowerCase()}|${r.author.toLowerCase()}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

/** Open Library guarda algunas sinopsis en Markdown con créditos y enlaces al final. */
function cleanMarkdown(text) {
  return text
    .split(/\n-{3,}|\(\[source\]/)[0]
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, '$1')
    .trim();
}

/** Completa sinopsis y páginas de un resultado de Open Library al elegirlo. */
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
