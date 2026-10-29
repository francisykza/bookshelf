// Revisión de una importación (SPEC §52.3): se analiza el archivo entero contra la biblioteca antes de escribir nada.
// Coincidencias, por orden: referencia de Goodreads ya importada, ISBN válido igual (fiables: se omiten) y título +
// autor normalizados (dudosa: pendiente de decisión, nunca se fusiona sola). También los duplicados del propio archivo.
import { STATUS } from '../../domain/books';
import { normalizeText } from '../../domain/bookSearch';
import { dayToIso, isbnMatchKey } from './goodreadsParser';

const titleKey = (title, author) => `${normalizeText(title)}|${normalizeText(String(author ?? '').split(',')[0])}`;

/** Qué se ve de cada coincidencia en la lista de revisión. */
export const MATCH_TEXT = {
  new: 'Nuevo',
  imported: 'Ya importado antes',
  isbn: 'Ya está (mismo ISBN)',
  file: 'Repetido en el archivo',
  title: 'Posible coincidencia (mismo título y autor)',
  'file-title': 'Posible repetido en el archivo',
  invalid: 'No válido',
};

/** Campos que «Completar datos vacíos» puede escribir, con su nombre visible. */
const FILL_LABELS = { author: 'Autor', isbn: 'ISBN', pageCount: 'Páginas', rating: 'Puntuación', review: 'Reseña', finishedAt: 'Fecha de lectura' };
export const fillLabel = (k) => FILL_LABELS[k] ?? k;

const empty = (v) => v == null || v === '' || (typeof v === 'number' && !Number.isFinite(v));

/**
 * Lo que «Completar datos vacíos» cambiaría en un libro existente: solo campos vacíos allí y presentes en el archivo.
 * Nunca toca valores ya escritos (tampoco la reseña ni la puntuación propias).
 */
export function fillPatch(record, book) {
  const patch = {};
  if (empty(book.author) && record.author) patch.author = record.author;
  if (empty(book.isbn) && record.isbn) patch.isbn = record.isbn;
  if (empty(book.pageCount) && record.pageCount) patch.pageCount = record.pageCount;
  if (empty(book.rating) && record.rating != null) patch.rating = record.rating;
  if (empty(book.review?.trim?.() ?? book.review) && record.review) patch.review = record.review;
  if (book.status === 'read' && empty(book.finishedAt) && record.dateRead) patch.finishedAt = dayToIso(record.dateRead);
  return patch;
}

/**
 * Plan de importación: una entrada por fila con su coincidencia y la acción por defecto (añadir los nuevos válidos,
 * omitir las coincidencias fiables, decidir las dudosas y las de estado desconocido). `status` empieza con el del
 * archivo (null = por revisar).
 */
export function planImport(records, books) {
  const byGoodreads = new Map();
  const byIsbn = new Map();
  const byTitle = new Map();
  for (const b of books) {
    if (b.importRef?.source === 'goodreads' && b.importRef.goodreadsId) byGoodreads.set(b.importRef.goodreadsId, b);
    const k = isbnMatchKey(b.isbn);
    if (k && !byIsbn.has(k)) byIsbn.set(k, b);
    const t = titleKey(b.title, b.author);
    if (!byTitle.has(t)) byTitle.set(t, b);
  }
  const seenGr = new Map();
  const seenIsbn = new Map();
  const seenTitle = new Map();
  return records.map((record) => {
    const base = { line: record.line, record, status: record.status, fill: {} };
    if (record.invalid) return { ...base, match: { kind: 'invalid' }, action: 'skip', reason: record.invalid };
    const t = titleKey(record.title, record.author);
    const remember = () => {
      if (record.goodreadsId && !seenGr.has(record.goodreadsId)) seenGr.set(record.goodreadsId, record.line);
      if (record.isbnKey && !seenIsbn.has(record.isbnKey)) seenIsbn.set(record.isbnKey, record.line);
      if (!seenTitle.has(t)) seenTitle.set(t, record.line);
    };
    const existing = (kind, book, action) => {
      remember();
      return { ...base, match: { kind, bookId: book.id, bookTitle: book.title }, action, fill: fillPatch(record, book) };
    };
    if (record.goodreadsId && byGoodreads.has(record.goodreadsId)) return existing('imported', byGoodreads.get(record.goodreadsId), 'skip');
    if (record.isbnKey && byIsbn.has(record.isbnKey)) return existing('isbn', byIsbn.get(record.isbnKey), 'skip');
    const dupLine = (record.goodreadsId && seenGr.get(record.goodreadsId)) || (record.isbnKey && seenIsbn.get(record.isbnKey));
    if (dupLine) return { ...base, match: { kind: 'file', line: dupLine }, action: 'skip', reason: `Repite la fila ${dupLine}` };
    if (byTitle.has(t)) return existing('title', byTitle.get(t), 'decide');
    if (seenTitle.has(t)) {
      const line = seenTitle.get(t);
      remember();
      return { ...base, match: { kind: 'file-title', line }, action: 'decide' };
    }
    remember();
    return { ...base, match: { kind: 'new' }, action: record.status ? 'add' : 'decide' };
  });
}

/** Estado elegible en la revisión cuando el archivo no lo da (o para cambiarlo antes de importar). */
export const STATUS_CHOICES = Object.entries(STATUS).map(([id, label]) => ({ id, label }));

/** ¿La fila está resuelta? Añadir necesita estado; completar necesita algún campo que escribir. */
export function isResolved(item) {
  if (item.action === 'skip') return true;
  if (item.action === 'add') return Boolean(item.status);
  if (item.action === 'fill') return Object.keys(item.fill).length > 0;
  return false;
}

/** Recuentos reales de la revisión. */
export function planCounts(items) {
  const c = { total: 0, fresh: 0, present: 0, possible: 0, review: 0, invalid: 0, toAdd: 0, toFill: 0, undecided: 0 };
  for (const it of items) {
    if (it.match.kind === 'invalid') c.invalid++;
    else {
      c.total++;
      if (it.match.kind === 'imported' || it.match.kind === 'isbn' || it.match.kind === 'file') c.present++;
      else if (it.match.kind === 'title' || it.match.kind === 'file-title') c.possible++;
      else if (it.record.status) c.fresh++;
      else c.review++;
    }
    if (it.action === 'add' && it.status) c.toAdd++;
    else if (it.action === 'fill' && Object.keys(it.fill).length) c.toFill++;
    else if (!isResolved(it)) c.undecided++;
  }
  return c;
}
