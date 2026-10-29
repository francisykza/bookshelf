// Guardado recuperable e idempotente de una importación (SPEC §52.3). Funciones puras sobre el estado de la
// biblioteca que usa el reducer (`importStart`, `importBatch`, `importStatus`, `importUndo`): nunca reemplazan la
// biblioteca, cada fila es una operación con clave `importId:fila` y repetir una operación ya hecha no duplica nada.
// El registro (`state.imports`) vive en la biblioteca privada del usuario y viaja con ella a su cuenta.
import { createBook, isbnCover, newId } from '../../domain/books';
import { dayToIso } from './goodreadsParser';
import { isResolved } from './importPlanner';

export const BATCH_SIZE = 50;

/** Huella SHA-256 del archivo (reconoce reintentos del mismo archivo; no sustituye a la detección de duplicados). */
export async function fileFingerprint(buffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Datos del libro nuevo a partir de la fila: solo lo que trae el archivo, sin inventar progreso, fechas ni sesiones. */
export function bookFromRecord(record, status, { importId, key, now }) {
  const pageCount = record.pageCount ?? null;
  const finished = status === 'read' ? dayToIso(record.dateRead) : null;
  return {
    title: record.title,
    author: record.author,
    isbn: record.isbn,
    cover: record.isbn ? isbnCover(record.isbn) : '',
    pageCount,
    trackBy: pageCount ? 'pages' : 'percent',
    // Leído: el libro entero; el resto, sin posición registrada (el archivo no trae el progreso)
    currentPage: status === 'read' && pageCount ? pageCount : 0,
    currentPercent: status === 'read' ? 100 : 0,
    status,
    rating: record.rating,
    review: record.review,
    reviewedAt: record.review ? now : null,
    finishedAt: finished,
    abandonedAt: status === 'abandoned' ? now : null,
    startedAt: null,
    addedAt: dayToIso(record.dateAdded) ?? now,
    updatedAt: now,
    source: 'goodreads',
    editionType: 'paperback',
    importRef: {
      source: 'goodreads',
      importId,
      opKey: key,
      goodreadsId: record.goodreadsId || null,
      isbnRaw: record.isbnRaw.length ? record.isbnRaw : undefined,
      shelves: record.shelves.length ? record.shelves : undefined,
      exclusiveShelf: record.exclusive || undefined,
      readCount: record.readCount ?? undefined,
      dateAdded: record.dateAdded ?? undefined,
      dateReadPartial: record.dateReadPartial ?? undefined,
      additionalAuthors: record.additionalAuthors || undefined,
      importedAt: now,
    },
  };
}

/**
 * Registro de importación a partir del plan revisado. Solo las filas resueltas como «añadir» o «completar» son
 * operaciones; el resto queda como omitido con su motivo. Las operaciones guardan su carga hasta aplicarse (así se
 * puede reanudar tras un fallo o una recarga).
 */
export function createImportRecord({ items, userId, fileHash, fileName, now = new Date().toISOString(), id = newId('imp') }) {
  const ops = [];
  const skipped = [];
  for (const it of items) {
    const key = `${id}:${it.line}`;
    const title = it.record.title || `Fila ${it.line}`;
    if (it.action === 'add' && isResolved(it)) ops.push({ key, line: it.line, kind: 'add', title, s: 'pending', book: bookFromRecord(it.record, it.status, { importId: id, key, now }) });
    else if (it.action === 'fill' && isResolved(it)) ops.push({ key, line: it.line, kind: 'fill', title, s: 'pending', bookId: it.match.bookId, patch: it.fill });
    else skipped.push({ line: it.line, title, reason: it.reason ?? (it.action === 'skip' ? (it.match.kind === 'new' ? 'Omitido' : 'Ya estaba en tu biblioteca') : 'Sin decidir') });
  }
  return { id, source: 'goodreads', userId: userId ?? null, fileHash, fileName, createdAt: now, status: 'running', ops, skipped };
}

const replaceRecord = (state, record) => ({ ...state, imports: (state.imports ?? []).map((r) => (r.id === record.id ? record : r)) });

export function startImport(state, record) {
  if ((state.imports ?? []).some((r) => r.id === record.id)) return state;
  return { ...state, imports: [...(state.imports ?? []), record] };
}

/**
 * Aplica un lote de operaciones pendientes. Idempotente: una operación ya hecha no se repite, y si su libro ya existe
 * (misma clave de operación, o la misma referencia de Goodreads llegada por otra importación) se enlaza, no se duplica.
 */
export function applyImportBatch(state, importId, keys, now = new Date().toISOString()) {
  const record = (state.imports ?? []).find((r) => r.id === importId);
  if (!record) return state;
  const want = new Set(keys);
  let books = state.books;
  const ops = record.ops.map((op) => {
    if (!want.has(op.key) || (op.s !== 'pending' && op.s !== 'failed')) return op;
    try {
      if (op.kind === 'add') {
        const gr = op.book.importRef.goodreadsId;
        const same = books.find((b) => b.importRef?.opKey === op.key);
        if (same) return { key: op.key, line: op.line, kind: op.kind, title: op.title, s: 'done', b: same.id, at: same.importRef.importedAt };
        if (gr && books.some((b) => b.importRef?.source === 'goodreads' && b.importRef.goodreadsId === gr)) return { key: op.key, line: op.line, kind: op.kind, title: op.title, s: 'skipped', reason: 'Ya estaba en tu biblioteca' };
        const book = createBook({ ...op.book, id: newId() });
        books = [...books, book];
        return { key: op.key, line: op.line, kind: op.kind, title: op.title, s: 'done', b: book.id, at: book.updatedAt };
      }
      // Completar: solo los campos que siguen vacíos AHORA; se apunta qué había y qué se escribió para poder deshacer
      const target = books.find((b) => b.id === op.bookId);
      if (!target) return { key: op.key, line: op.line, kind: op.kind, title: op.title, s: 'skipped', reason: 'El libro ya no está' };
      const written = {};
      const prev = {};
      for (const [k, v] of Object.entries(op.patch)) {
        const cur = target[k];
        if (cur == null || cur === '') {
          written[k] = v;
          prev[k] = cur ?? null;
        }
      }
      if (!Object.keys(written).length) return { key: op.key, line: op.line, kind: op.kind, title: op.title, s: 'skipped', reason: 'Sus datos ya estaban completos' };
      const patched = createBook({ ...target, ...written, ...(written.pageCount ? { trackBy: target.trackBy } : null) });
      books = books.map((b) => (b.id === target.id ? patched : b));
      return { key: op.key, line: op.line, kind: op.kind, title: op.title, s: 'done', b: target.id, w: written, p: prev };
    } catch (e) {
      return { ...op, s: 'failed', error: String(e?.message ?? e) };
    }
  });
  return replaceRecord({ ...state, books }, { ...record, ops, updatedAt: now });
}

/** Cambia el estado de la importación (pausa por error, cancelación, fin). Reanudar vuelve a poner las fallidas en cola. */
export function setImportStatus(state, importId, status, error = null) {
  const record = (state.imports ?? []).find((r) => r.id === importId);
  if (!record) return state;
  const ops = status === 'running' ? record.ops.map((o) => (o.s === 'failed' ? { ...o, s: 'pending', error: undefined } : o)) : record.ops;
  return replaceRecord(state, { ...record, ops, status, error });
}

/** Resumen honesto de un registro: guardado, pendiente, fallido y no importado. */
export function importSummary(record) {
  const s = { added: 0, filled: 0, pending: 0, failed: 0, skipped: record.skipped.length, undone: 0, issues: [...record.skipped] };
  for (const o of record.ops) {
    if (o.s === 'done') {
      if (o.kind === 'add') s.added++;
      else s.filled++;
    } else if (o.s === 'pending') s.pending++;
    else if (o.s === 'failed') {
      s.failed++;
      s.issues.push({ line: o.line, title: o.title, reason: `Error al guardar: ${o.error}` });
    } else if (o.s === 'skipped') {
      s.skipped++;
      s.issues.push({ line: o.line, title: o.title, reason: o.reason });
    } else if (o.s === 'undone') s.undone++;
  }
  s.issues.sort((a, b) => a.line - b.line);
  return s;
}

/**
 * Deshacer limitado a los cambios del lote: quita los libros creados que siguen EXACTAMENTE como se importaron (sin
 * cambios posteriores, notas ni sesiones) y devuelve los campos completados que conservan el valor escrito. Lo demás
 * se conserva y se informa (`conflicts`). Repetirlo no hace nada nuevo.
 */
export function undoImport(state, importId) {
  const record = (state.imports ?? []).find((r) => r.id === importId);
  if (!record) return state;
  const log = state.progress?.readingLog ?? [];
  let books = state.books;
  const conflicts = [...(record.conflicts ?? [])];
  const ops = record.ops.map((op) => {
    if (op.s !== 'done') return op;
    const book = books.find((b) => b.id === op.b);
    if (!book) return { ...op, s: 'undone' };
    if (op.kind === 'add') {
      const untouched = book.importRef?.opKey === op.key && book.updatedAt === op.at && !book.quotes?.length && !log.some((e) => e.bookId === book.id);
      if (!untouched) {
        conflicts.push({ line: op.line, title: op.title, reason: 'Lo has cambiado después: se queda' });
        return { ...op, s: 'kept' };
      }
      books = books.filter((b) => b.id !== book.id);
      return { ...op, s: 'undone' };
    }
    const restore = {};
    for (const [k, v] of Object.entries(op.w ?? {})) {
      if (book[k] === v) restore[k] = op.p?.[k] ?? null;
      else conflicts.push({ line: op.line, title: op.title, reason: `«${k}» ha cambiado después: se queda` });
    }
    if (Object.keys(restore).length) books = books.map((b) => (b.id === book.id ? createBook({ ...b, ...restore }) : b));
    return { ...op, s: 'undone' };
  });
  return { ...replaceRecord({ ...state, books }, { ...record, ops, conflicts, status: 'undone' }) };
}

/** Importación de esta cuenta que quedó a medias (fallo, cierre o recarga) y se puede reanudar; otra cuenta, nunca. */
export const resumableImport = (imports, userId) =>
  (imports ?? []).find((r) => r.userId === (userId ?? null) && ['running', 'paused', 'cancelled'].includes(r.status) && r.ops.some((o) => o.s === 'pending' || o.s === 'failed')) ?? null;

/** Una revisión solo vale para la cuenta con la que se hizo: si cambia, hay que volver a analizar el archivo. */
export const planValidFor = (plan, userId) => Boolean(plan) && plan.userId === (userId ?? null);
