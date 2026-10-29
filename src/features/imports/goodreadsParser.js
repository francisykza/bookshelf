// Lectura y mapeo de la exportación de Goodreads (SPEC §52.3). Todo es local: el CSV nunca sale del dispositivo.
// El análisis CSV lo hace PapaParse (comillas, comillas escapadas, saltos de línea dentro de campos), cargado bajo
// demanda; este módulo solo traduce cada fila al lenguaje de BookShelf, sin inventar datos que el archivo no trae.
import { stripHtml } from '../../domain/books';

export const MAX_BYTES = 20 * 1024 * 1024;
export const MAX_ROWS = 10_000;

/** Columnas de Goodreads que se reconocen (las demás se ignoran sin error). */
export const COLUMNS = ['Book Id', 'Title', 'Author', 'Additional Authors', 'ISBN', 'ISBN13', 'My Rating', 'Number of Pages', 'Date Read', 'Date Added', 'Bookshelves', 'Exclusive Shelf', 'My Review', 'Read Count'];

const STATUS_BY_SHELF = { 'to-read': 'want', 'currently-reading': 'reading', read: 'read' };
/** Estanterías que suelen significar «lo dejé»: solo se SUGIERE «Abandonado», nunca se aplica solo. */
const ABANDON_SHELVES = ['dnf', 'did-not-finish', 'abandoned', 'abandonados', 'abandonado', 'dropped', 'no-terminado'];

export class ImportError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// ── Valores ───────────────────────────────────────────────────────────────────────────────────────────────────

/** Texto de una celda: quita el envoltorio `="…"` que Goodreads pone a los ISBN (no se evalúa ninguna fórmula). */
export function cellText(value) {
  const s = String(value ?? '').trim();
  const wrapped = /^="(.*)"$/s.exec(s);
  return (wrapped ? wrapped[1] : s).trim();
}

const isbn10Ok = (d) => {
  if (!/^\d{9}[\dX]$/.test(d)) return false;
  const sum = [...d].reduce((acc, c, i) => acc + (c === 'X' ? 10 : Number(c)) * (10 - i), 0);
  return sum % 11 === 0;
};
const isbn13Ok = (d) => {
  if (!/^\d{13}$/.test(d)) return false;
  const sum = [...d].reduce((acc, c, i) => acc + Number(c) * (i % 2 ? 3 : 1), 0);
  return sum % 10 === 0;
};
/** ISBN-10 válido → ISBN-13 (prefijo 978), para comparar ediciones con una sola clave. */
const to13 = (d10) => {
  const body = `978${d10.slice(0, 9)}`;
  const sum = [...body].reduce((acc, c, i) => acc + Number(c) * (i % 2 ? 3 : 1), 0);
  return `${body}${(10 - (sum % 10)) % 10}`;
};

/**
 * ISBN como cadena (conserva ceros iniciales): sin envoltorio, guiones ni espacios; válido solo con su longitud y dígito
 * de control. Devuelve `{ raw, isbn, key }`: `isbn` es el válido (o ''), `key` su forma ISBN-13 para comparar.
 */
export function parseIsbn(value) {
  const raw = cellText(value);
  const d = raw.replace(/[\s-]/g, '').toUpperCase();
  if (isbn13Ok(d)) return { raw, isbn: d, key: d };
  if (isbn10Ok(d)) return { raw, isbn: d, key: to13(d) };
  return { raw, isbn: '', key: '' };
}

/** Clave ISBN-13 de cualquier ISBN guardado en la biblioteca (o '' si no es válido). */
export const isbnMatchKey = (value) => parseIsbn(value).key;

/** «My Rating»: 0 o vacío = sin puntuación; 1–5 enteros (o cuartos, si viniesen) = la valoración personal. */
export function parseRating(value) {
  const n = Number(cellText(value).replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0 || n > 5) return null;
  return Math.round(n * 4) / 4;
}

/** Páginas: solo enteros positivos; vacío, cero o texto = desconocidas. */
export function parsePages(value) {
  const s = cellText(value);
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return n > 0 && n < 100000 ? n : null;
}

const validDay = (y, m, d) => {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};

/**
 * Fechas de Goodreads con reglas explícitas: `AAAA/MM/DD` o `AAAA-MM-DD` → día de calendario; `AAAA/MM` o `AAAA` →
 * fecha parcial (solo procedencia). Lo demás (p. ej. `03/04/2020`) es ambiguo y no se adivina.
 * Devuelve `{ day, partial, ambiguous, raw }`.
 */
export function parseDate(value) {
  const raw = cellText(value);
  if (!raw) return { day: null, partial: null, ambiguous: false, raw };
  let m = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(raw);
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (validDay(y, mo, d)) return { day: `${m[1]}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`, partial: null, ambiguous: false, raw };
    return { day: null, partial: null, ambiguous: true, raw };
  }
  m = /^(\d{4})(?:[/-](\d{1,2}))?$/.exec(raw);
  if (m && (!m[2] || (Number(m[2]) >= 1 && Number(m[2]) <= 12))) return { day: null, partial: m[2] ? `${m[1]}-${m[2].padStart(2, '0')}` : m[1], ambiguous: false, raw };
  return { day: null, partial: null, ambiguous: true, raw };
}

/** Día de calendario → instante guardado a mediodía UTC: el mismo día en cualquier zona horaria habitual. */
export const dayToIso = (day) => (day ? `${day}T12:00:00.000Z` : null);

/** Reseña de Goodreads (HTML ligero con `<br/>`) → texto plano con sus párrafos. Nada se interpreta como HTML. */
export const reviewText = (value) => stripHtml(String(value ?? '').replace(/\r\n?/g, '\n')).trim();

// ── Filas ─────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Una fila del CSV (objeto columna → texto) en un registro de importación. `status` es null si la estantería exclusiva
 * no es una de las tres de Goodreads («Estado por revisar»). `issues` explica lo que no se ha podido usar.
 */
export function mapRow(row, line) {
  const get = (k) => cellText(row[k]);
  const title = get('Title');
  const author = get('Author');
  const issues = [];
  if (!title) return { line, invalid: 'Sin título', title: '', author, issues };
  const isbn13 = parseIsbn(row.ISBN13);
  const isbn10 = parseIsbn(row.ISBN);
  const isbn = isbn13.isbn ? isbn13 : isbn10;
  const badIsbn = [isbn13, isbn10].filter((x) => x.raw && !x.isbn).map((x) => x.raw);
  if (badIsbn.length && !isbn.isbn) issues.push('ISBN no válido: no se usa para buscar coincidencias');
  const shelves = get('Bookshelves')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const exclusive = get('Exclusive Shelf').toLowerCase();
  const status = STATUS_BY_SHELF[exclusive] ?? null;
  const suggestAbandon = [exclusive, ...shelves.map((s) => s.toLowerCase())].some((s) => ABANDON_SHELVES.includes(s));
  if (!status) issues.push(exclusive ? `Estantería «${get('Exclusive Shelf')}»: elige su estado` : 'Sin estantería: elige su estado');
  const read = parseDate(row['Date Read']);
  const added = parseDate(row['Date Added']);
  if (read.ambiguous) issues.push(`Fecha de lectura «${read.raw}» ambigua: no se usa`);
  if (added.ambiguous) issues.push(`Fecha de alta «${added.raw}» ambigua: no se usa`);
  if (!author) issues.push('Sin autor en el archivo');
  const readCount = parsePages(row['Read Count']);
  return {
    line,
    title,
    author,
    additionalAuthors: get('Additional Authors'),
    goodreadsId: /^\d+$/.test(get('Book Id')) ? get('Book Id') : '',
    isbn: isbn.isbn,
    isbnKey: isbn.key,
    isbnRaw: badIsbn,
    rating: parseRating(row['My Rating']),
    pageCount: parsePages(row['Number of Pages']),
    dateRead: read.day,
    dateReadPartial: read.partial,
    dateAdded: added.day,
    shelves: shelves.filter((s) => !STATUS_BY_SHELF[s.toLowerCase()]),
    exclusive,
    status,
    suggestAbandon,
    review: reviewText(row['My Review']),
    readCount,
    issues,
  };
}

// ── Archivo ───────────────────────────────────────────────────────────────────────────────────────────────────

const DELIMITERS = [',', ';', '\t'];

/** Delimitador cuya cabecera reconoce columnas de Goodreads (con «Title» al menos); si ninguno, null. */
function detectDelimiter(Papa, text) {
  let best = null;
  for (const d of DELIMITERS) {
    const head = Papa.parse(text, { preview: 1, delimiter: d }).data[0] ?? [];
    const known = head.filter((h) => COLUMNS.includes(String(h).trim())).length;
    if (head.some((h) => String(h).trim() === 'Title') && known >= 2 && (!best || known > best.known)) best = { d, known };
  }
  return best?.d ?? null;
}

/**
 * Texto CSV → registros. Lanza `ImportError` con un mensaje comprensible si no es una exportación de Goodreads, si
 * tiene filas malformadas que cambiarían los datos o si supera el límite de filas.
 */
export function parseGoodreadsCsv(Papa, input) {
  const text = String(input ?? '').replace(/^﻿/, '');
  if (!text.trim()) throw new ImportError('empty', 'El archivo está vacío.');
  const delimiter = detectDelimiter(Papa, text);
  if (!delimiter) throw new ImportError('format', 'No parece una exportación de Goodreads: no encontramos sus columnas (Title, Author, Exclusive Shelf…).');
  const out = Papa.parse(text, { header: true, delimiter, skipEmptyLines: 'greedy', transformHeader: (h) => h.trim() });
  const serious = out.errors.filter((e) => e.type === 'Quotes' || e.code === 'TooManyFields');
  if (serious.length) throw new ImportError('structure', `El archivo tiene filas mal formadas (por ejemplo, la fila ${serious[0].row + 2}): revisa que sea la exportación original de Goodreads.`);
  if (out.data.length > MAX_ROWS) throw new ImportError('rows', `El archivo tiene ${out.data.length.toLocaleString('es-ES')} filas y el máximo es ${MAX_ROWS.toLocaleString('es-ES')}. Divide la exportación en partes más pequeñas.`);
  const records = out.data.map((row, i) => mapRow(row, i + 2));
  return { delimiter, columns: out.meta.fields ?? [], records };
}

/** Bytes del archivo → texto UTF-8 (con o sin BOM). Un archivo que no es UTF-8 da error, no texto corrupto. */
export function decodeUtf8(buffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    throw new ImportError('encoding', 'No hemos podido leer el archivo: no está en UTF-8. Descárgalo de nuevo desde Goodreads sin abrirlo en otro programa.');
  }
}
