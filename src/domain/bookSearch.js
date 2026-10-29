// Reglas puras del buscador (SPEC §40), sin red ni React: texto normalizado (mayúsculas, tildes y puntuación),
// ISBN con su dígito de control, orden de resultados (ISBN exacto, coincidencia de título, idioma del usuario) sin
// ocultar ediciones, ediciones de una obra y detección de libros que ya están en la biblioteca.

/** Minúsculas, sin tildes ni puntuación y con espacios simples: «¡Balada de Pájaros!» → «balada de pajaros». */
export function normalizeText(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function isbn10Ok(d) {
  let sum = 0;
  for (let i = 0; i < 10; i += 1) sum += (d[i] === 'X' ? 10 : Number(d[i])) * (10 - i);
  return sum % 11 === 0;
}

function isbn13Ok(d) {
  let sum = 0;
  for (let i = 0; i < 13; i += 1) sum += Number(d[i]) * (i % 2 ? 3 : 1);
  return sum % 10 === 0;
}

/** ISBN-10 → ISBN-13 (prefijo 978). */
export function isbn10to13(d) {
  const core = `978${d.slice(0, 9)}`;
  let sum = 0;
  for (let i = 0; i < 12; i += 1) sum += Number(core[i]) * (i % 2 ? 3 : 1);
  return `${core}${(10 - (sum % 10)) % 10}`;
}

/**
 * Si el texto es un ISBN válido (con o sin guiones o espacios, 10 o 13 cifras y dígito de control correcto),
 * devuelve su forma ISBN-13; si no, null. Un número cualquiera no se trata como ISBN.
 */
export function parseIsbn(text) {
  const raw = String(text ?? '').trim();
  if (!/^[0-9Xx][0-9Xx\s-]{8,20}$/.test(raw)) return null;
  const d = raw.replace(/[\s-]/g, '').toUpperCase();
  if (d.length === 13 && /^\d{13}$/.test(d) && isbn13Ok(d)) return d;
  if (d.length === 10 && /^\d{9}[\dX]$/.test(d) && isbn10Ok(d)) return isbn10to13(d);
  return null;
}

/** ISBN-13 comparable de un resultado o libro (acepta ISBN-10). */
export const isbnKey = (isbn) => parseIsbn(isbn) ?? '';

/** Códigos de idioma de los proveedores (ISO 639-1 de Google, 639-2 de Open Library) → dos letras. */
const LANG3 = { spa: 'es', eng: 'en', fre: 'fr', fra: 'fr', ger: 'de', deu: 'de', ita: 'it', por: 'pt', cat: 'ca', glg: 'gl', baq: 'eu', eus: 'eu', dut: 'nl', nld: 'nl', jpn: 'ja', rus: 'ru', chi: 'zh', zho: 'zh' };
export function langCode(code) {
  const c = String(code ?? '').toLowerCase().replace(/^\/languages\//, '');
  if (!c) return '';
  if (c.length === 2) return c;
  return LANG3[c] ?? c;
}

export const LANG_NAMES = { es: 'Español', en: 'Inglés', fr: 'Francés', de: 'Alemán', it: 'Italiano', pt: 'Portugués', ca: 'Catalán', gl: 'Gallego', eu: 'Euskera', nl: 'Neerlandés', ja: 'Japonés', ru: 'Ruso', zh: 'Chino' };
/** Nombre del idioma; un código desconocido se muestra en mayúsculas y un texto escrito a mano, tal cual. */
export const languageName = (code) => LANG_NAMES[langCode(code)] ?? (/^[a-z]{2,3}$/i.test(code ?? '') ? String(code).toUpperCase() : String(code ?? ''));

/** Idioma preferido del usuario (dos letras) a partir del navegador; español si no se sabe. */
export function userLanguage(nav = typeof navigator !== 'undefined' ? navigator : null) {
  return langCode((nav?.language || 'es').split('-')[0]) || 'es';
}

/**
 * Orden de resultados: 1) ISBN idéntico al buscado; 2) título que coincide con la consulta (exacto, empieza por
 * ella o la contiene, ignorando tildes y puntuación); 3) idioma del usuario. Es un orden estable: nada se quita,
 * las demás ediciones e idiomas siguen en la lista en el orden del proveedor.
 */
export function rankResults(results, { query = '', isbn = null, lang = 'es' } = {}) {
  const q = normalizeText(query);
  const score = (r) => {
    let s = 0;
    if (isbn && isbnKey(r.isbn) === isbn) s += 1000;
    const t = normalizeText(r.title);
    const a = normalizeText(r.author);
    if (q) {
      if (t === q) s += 120;
      else if (t.startsWith(q)) s += 80;
      else if (t.includes(q) || `${t} ${a}`.includes(q)) s += 40;
    }
    if (r.languages?.some((l) => langCode(l) === lang) || langCode(r.language) === lang) s += 30;
    return s;
  };
  return results
    .map((r, i) => ({ r, i, s: score(r) }))
    .sort((x, y) => y.s - x.s || x.i - y.i)
    .map((x) => x.r);
}

/**
 * Quita solo duplicados reales: la misma obra de Open Library o el mismo ISBN. Dos ediciones distintas con el mismo
 * título y autor se conservan (son ediciones diferentes, no repeticiones).
 */
export function dedupeResults(results) {
  const seen = new Set();
  return results.filter((r) => {
    const ids = [r.workKey && !r.editionKey ? `w:${r.workKey}` : null, r.editionKey ? `e:${r.editionKey}` : null, isbnKey(r.isbn) ? `i:${isbnKey(r.isbn)}` : null, r.key ? `k:${r.key}` : null].filter(Boolean);
    if (ids.some((id) => seen.has(id))) return false;
    ids.forEach((id) => seen.add(id));
    return true;
  });
}

/**
 * Ediciones de una obra de Open Library → una lista coherente. Cada edición conserva SOLO sus datos (título,
 * páginas, idioma, portada, editorial, fecha, formato e ISBN): nada se rellena con otra edición ni con la obra.
 * Primero las del idioma del usuario y, dentro, las que tienen más datos; las demás no se ocultan.
 */
export function normalizeEditions(entries, { lang = 'es' } = {}) {
  const list = (entries ?? []).map((e) => {
    const isbn = e.isbn_13?.[0] || e.isbn_10?.[0] || '';
    const language = langCode(e.languages?.[0]?.key);
    return {
      editionKey: e.key,
      title: [e.title, e.subtitle].filter(Boolean).join(': ') || '',
      publisher: e.publishers?.[0] || '',
      editionDate: e.publish_date || '',
      pageCount: Number.isFinite(e.number_of_pages) && e.number_of_pages > 0 ? e.number_of_pages : null,
      language,
      cover: e.covers?.find((c) => c > 0) ? `https://covers.openlibrary.org/b/id/${e.covers.find((c) => c > 0)}-L.jpg` : '',
      format: e.physical_format || '',
      isbn: isbnKey(isbn) || isbn,
    };
  });
  const richness = (e) => [e.cover, e.pageCount, e.publisher, e.isbn, e.editionDate].filter(Boolean).length;
  return list
    .map((e, i) => ({ e, i }))
    .sort((a, b) => (b.e.language === lang) - (a.e.language === lang) || richness(b.e) - richness(a.e) || a.i - b.i)
    .map((x) => x.e);
}

/** Formato físico declarado por el proveedor → edición de BookShelf, solo si es inequívoco (si no, null). */
export function editionFromFormat(format) {
  const f = normalizeText(format);
  if (!f) return null;
  if (/hardcover|hardback|tapa dura|cartone/.test(f)) return 'hardcover';
  if (/paperback|mass market|bolsillo|rustica|tapa blanda|softcover/.test(f)) return 'paperback';
  // 1.54: el formato digital ya no deduce edición visual (el e-reader se retiró): queda la predeterminada
  if (/ebook|e book|kindle|epub|electronic/.test(f)) return null;
  if (/audio/.test(f)) return 'audiobook';
  return null;
}

/**
 * ¿Ya está en la biblioteca? `isbn`: el mismo ISBN (la misma edición); `title`: mismo título y autor normalizados
 * (puede ser otra edición: se avisa sin impedir añadirla); null si no.
 */
export function ownedMatch(result, books) {
  const isbn = isbnKey(result.isbn);
  if (isbn && books.some((b) => isbnKey(b.isbn) === isbn)) return 'isbn';
  const t = normalizeText(result.title);
  const a = normalizeText(result.author);
  if (t && books.some((b) => normalizeText(b.title) === t && (!a || !normalizeText(b.author) || normalizeText(b.author) === a))) return 'title';
  return null;
}

/** Año de una fecha libre del proveedor («2020-05-19», «May 19, 2020», «2020»). */
export function yearOf(date) {
  return String(date ?? '').match(/\d{4}/)?.[0] ?? '';
}
