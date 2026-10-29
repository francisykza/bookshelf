// 1.54 (SPEC §52): importación de Goodreads con fixtures sintéticos (sin datos personales), retirada de la edición
// visual ebook y baldas de la habitación con toda la biblioteca.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';
import { describe, expect, it } from 'vitest';
import { FORMATS, SELECTABLE_EDITION_IDS, createBook, isDigital, visualEdition } from '../../../domain/books';
import { editionFromFormat } from '../../../domain/bookSearch';
import { roomShelfQueue } from '../../../domain/library';
import { reducer } from '../../../state/useLibrary';
import { ImportError, MAX_ROWS, cellText, dayToIso, decodeUtf8, parseDate, parseGoodreadsCsv, parseIsbn, parseRating } from '../goodreadsParser';
import { planCounts, planImport } from '../importPlanner';
import { applyImportBatch, createImportRecord, importSummary, planValidFor, resumableImport } from '../importService';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => readFileSync(join(here, 'fixtures', name), 'utf8');
const LF = String.fromCharCode(10);
const CRLF = String.fromCharCode(13, 10);
const BOM = String.fromCharCode(0xfeff);
const parse = (text) => parseGoodreadsCsv(Papa, text).records;

/** Estado mínimo de biblioteca para el reducer (sin los libros de ejemplo). */
const emptyState = (books = []) => ({ version: 6, books, settings: { owner: 'Prueba' }, progress: { readingLog: [], pomodoros: [], claimed: {}, companion: {}, figures: { owned: {}, boxes: 0, seals: [], pity: {} } } });

/** Importa un CSV de principio a fin con las acciones por defecto (y `choose` para decidir filas). */
function importAll(state, text, { choose = (it) => it, id = 'imp-1', userId = 'u1', batch = 50 } = {}) {
  const items = planImport(parse(text), state.books).map(choose);
  const record = createImportRecord({ items, userId, fileHash: 'h', fileName: 'goodreads.csv', id, now: '2026-10-29T10:00:00.000Z' });
  let s = reducer(state, { type: 'importStart', record });
  const keys = record.ops.map((o) => o.key);
  for (let i = 0; i < keys.length; i += batch) s = reducer(s, { type: 'importBatch', id, keys: keys.slice(i, i + batch) });
  s = reducer(s, { type: 'importStatus', id, status: 'done' });
  return { state: s, items, record: s.imports.find((r) => r.id === id) };
}

describe('lector CSV de Goodreads', () => {
  it('1 · BOM y saltos de línea de Windows dan lo mismo que el archivo limpio', () => {
    const text = fixture('goodreads-basico.csv');
    const windows = BOM + text.split(LF).join(CRLF);
    expect(parse(windows)).toEqual(parse(text));
    expect(parse(windows)).toHaveLength(8);
  });

  it('2 · comas, comillas y saltos de línea dentro de la reseña; HTML como texto', () => {
    const [first] = parse(fixture('goodreads-basico.csv'));
    expect(first.review).toBe(`Me encantó, de verdad.${LF}${LF}Un "clásico"${LF}multilínea`);
    expect(first.shelves).toEqual(['favoritos', 'mar']);
  });

  it('3 · ISBN como texto: envoltorio ="…", ceros iniciales, guiones y dígito de control', () => {
    expect(cellText('="0306406152"')).toBe('0306406152');
    expect(parseIsbn('="0306406152"')).toEqual({ raw: '0306406152', isbn: '0306406152', key: '9780306406157' });
    expect(parseIsbn('978-0-306-40615-7').isbn).toBe('9780306406157');
    expect(parseIsbn('1234567890').isbn).toBe('');
    const rows = parse(fixture('goodreads-basico.csv'));
    expect(rows[0].isbn).toBe('9780306406157');
    expect(rows[5].isbn).toBe('');
    expect(rows[5].isbnRaw).toEqual(['1234567890']);
    // Una fórmula no se evalúa: queda como texto
    expect(cellText('=HYPERLINK("x")')).toBe('=HYPERLINK("x")');
  });

  it('4 · «My Rating» 0 es sin puntuación; nunca se usa «Average Rating»', () => {
    const rows = parse(fixture('goodreads-basico.csv'));
    expect(rows[0].rating).toBe(4);
    expect(rows[1].rating).toBe(null);
    expect(parseRating('0')).toBe(null);
    expect(parseRating('')).toBe(null);
    expect(parseRating('6')).toBe(null);
  });

  it('5 · fechas vacías, válidas y ambiguas sin adivinar ni desplazar el día', () => {
    expect(parseDate('2023/05/14').day).toBe('2023-05-14');
    expect(parseDate('2025-06-30').day).toBe('2025-06-30');
    expect(parseDate('').day).toBe(null);
    expect(parseDate('03/04/2020')).toMatchObject({ day: null, ambiguous: true });
    expect(parseDate('2024/02/30')).toMatchObject({ day: null, ambiguous: true });
    expect(parseDate('2019/07')).toMatchObject({ day: null, partial: '2019-07' });
    expect(dayToIso('2023-05-14')).toBe('2023-05-14T12:00:00.000Z');
    const rows = parse(fixture('goodreads-basico.csv'));
    expect(rows[5].dateRead).toBe(null);
    expect(rows[5].issues.join(' ')).toMatch(/ambigua/);
  });

  it('6 · estados conocidos y desconocidos; «dnf» solo se sugiere', () => {
    const rows = parse(fixture('goodreads-basico.csv'));
    expect(rows.slice(0, 4).map((r) => r.status)).toEqual(['read', 'want', 'reading', null]);
    expect(rows[3]).toMatchObject({ suggestAbandon: true, exclusive: 'dnf' });
    expect(rows[2].pageCount).toBe(null);
    expect(rows[1].pageCount).toBe(null);
  });

  it('errores comprensibles: no es Goodreads, no es UTF-8, demasiadas filas', () => {
    expect(() => parse('nombre,apellido\nAna,López')).toThrow(ImportError);
    expect(() => parse('')).toThrow(/vacío/);
    expect(() => decodeUtf8(new Uint8Array([0x54, 0xe9, 0x74, 0x65]).buffer)).toThrow(/UTF-8/);
    const many = ['Title,Author,Exclusive Shelf', ...Array.from({ length: MAX_ROWS + 1 }, (_, i) => `Libro ${i},Autor,to-read`)].join(LF);
    expect(() => parse(many)).toThrow(/máximo/);
    // Punto y coma como delimitador: se detecta por la cabecera
    expect(parse('Title;Author;Exclusive Shelf\nUno;Autora;read')[0]).toMatchObject({ title: 'Uno', status: 'read' });
  });
});

describe('revisión y duplicados', () => {
  it('7 · duplicados dentro del archivo y fila sin título', () => {
    const items = planImport(parse(fixture('goodreads-basico.csv')), []);
    expect(items[4].match.kind).toBe('file');
    expect(items[4].action).toBe('skip');
    expect(items[6].match.kind).toBe('invalid');
    // Mismo título y autor con otro ISBN dentro del archivo: dudosa, no se omite ni se fusiona sola
    expect(items[7]).toMatchObject({ match: { kind: 'file-title' }, action: 'decide' });
    const c = planCounts(items);
    expect(c).toMatchObject({ total: 7, present: 1, possible: 1, review: 1, invalid: 1 });
  });

  it('8 · reimportar el mismo archivo no añade nada', () => {
    const first = importAll(emptyState(), fixture('goodreads-basico.csv'));
    const added = first.state.books.length;
    expect(added).toBe(4);
    const again = planImport(parse(fixture('goodreads-basico.csv')), first.state.books);
    expect(again.filter((it) => it.action === 'add')).toHaveLength(0);
    const second = importAll(first.state, fixture('goodreads-basico.csv'), { id: 'imp-2' });
    expect(second.state.books).toHaveLength(added);
  });

  it('9 · una exportación nueva solo trae los libros nuevos', () => {
    const first = importAll(emptyState(), fixture('goodreads-basico.csv'));
    const next = planImport(parse(fixture('goodreads-nueva-exportacion.csv')), first.state.books);
    expect(next.map((it) => it.match.kind)).toEqual(['imported', 'imported', 'new']);
    const done = importAll(first.state, fixture('goodreads-nueva-exportacion.csv'), { id: 'imp-2' });
    const nuevo = done.state.books.find((b) => b.title === 'Un libro nuevo de prueba');
    expect(nuevo).toMatchObject({ status: 'read', rating: 3, pageCount: 280, finishedAt: '2025-06-30T12:00:00.000Z', source: 'goodreads' });
    expect(nuevo.importRef).toMatchObject({ goodreadsId: '2001', shelves: ['verano'], readCount: 1, additionalAuthors: 'Coautora Nueva' });
  });

  it('10 · mismo título con otra edición: posible coincidencia, nunca fusión automática', () => {
    const mine = createBook({ id: 'mio', title: 'La casa de las mareas', author: 'Autora Ficticia', isbn: '9788420412146', pageCount: null, status: 'read', rating: 5, review: 'La mía' });
    const items = planImport(parse(fixture('goodreads-basico.csv')), [mine]);
    // Fila 1001 con ISBN distinto al mío: dudosa; la 1007 tiene MI ISBN: ya presente
    expect(items[0]).toMatchObject({ match: { kind: 'title', bookId: 'mio' }, action: 'decide' });
    expect(items[7]).toMatchObject({ match: { kind: 'isbn', bookId: 'mio' }, action: 'skip' });
    // «Completar» nunca reemplaza mi reseña ni mi puntuación
    expect(items[0].fill).not.toHaveProperty('review');
    expect(items[0].fill).not.toHaveProperty('rating');
    expect(items[0].fill).toMatchObject({ pageCount: 352 });
    const { state } = importAll(emptyState([mine]), fixture('goodreads-basico.csv'), { choose: (it) => (it.line === 2 ? { ...it, action: 'fill' } : it) });
    const after = state.books.find((b) => b.id === 'mio');
    expect(after).toMatchObject({ review: 'La mía', rating: 5, pageCount: 352, isbn: '9788420412146' });
    expect(state.books.filter((b) => b.title === 'La casa de las mareas')).toHaveLength(1);
  });

  it('las filas dudosas no impiden importar las resueltas', () => {
    const { state, record } = importAll(emptyState(), fixture('goodreads-basico.csv'));
    expect(state.books.map((b) => b.title).sort()).toEqual(['Fecha dudosa', 'Ficción sintética', 'La casa de las mareas', 'Lectura en curso']);
    expect(importSummary(record).issues.some((x) => x.reason === 'Sin decidir')).toBe(true);
  });
});

describe('guardado recuperable, cuentas, deshacer y recompensas', () => {
  it('11 · un lote repetido (reintento o red perdida) no duplica; reanudar solo aplica lo pendiente', () => {
    const items = planImport(parse(fixture('goodreads-basico.csv')), []);
    const record = createImportRecord({ items, userId: 'u1', fileHash: 'h', fileName: 'g.csv', id: 'imp-r' });
    let s = reducer(emptyState(), { type: 'importStart', record });
    const keys = record.ops.map((o) => o.key);
    s = reducer(s, { type: 'importBatch', id: 'imp-r', keys: keys.slice(0, 2) });
    // «Fallo»: se pausa; el mismo lote se reenvía y luego se reanuda todo
    s = reducer(s, { type: 'importStatus', id: 'imp-r', status: 'paused', error: 'storage' });
    expect(resumableImport(s.imports, 'u1')?.id).toBe('imp-r');
    s = reducer(s, { type: 'importBatch', id: 'imp-r', keys: keys.slice(0, 2) });
    expect(s.books).toHaveLength(2);
    s = reducer(s, { type: 'importStatus', id: 'imp-r', status: 'running' });
    s = reducer(s, { type: 'importBatch', id: 'imp-r', keys });
    s = reducer(s, { type: 'importBatch', id: 'imp-r', keys });
    expect(s.books).toHaveLength(keys.length);
    expect(importSummary(s.imports[0]).pending).toBe(0);
    // Aunque otra importación con otra clave traiga la misma referencia, se enlaza como ya presente
    const dup = createImportRecord({ items, userId: 'u1', fileHash: 'h', fileName: 'g.csv', id: 'imp-x' });
    let t = reducer(s, { type: 'importStart', record: dup });
    t = applyImportBatch(t, 'imp-x', dup.ops.map((o) => o.key));
    expect(t.books).toHaveLength(keys.length);
  });

  it('12 · cambiar de cuenta invalida la revisión y no reanuda importaciones de otra cuenta', () => {
    expect(planValidFor({ userId: 'u1' }, 'u1')).toBe(true);
    expect(planValidFor({ userId: 'u1' }, 'u2')).toBe(false);
    expect(planValidFor({ userId: null }, null)).toBe(true);
    const items = planImport(parse(fixture('goodreads-basico.csv')), []);
    const record = createImportRecord({ items, userId: 'u1', fileHash: 'h', fileName: 'g.csv', id: 'imp-a' });
    const s = reducer(emptyState(), { type: 'importStart', record });
    expect(resumableImport(s.imports, 'u2')).toBe(null);
  });

  it('13 · deshacer quita solo lo intacto, conserva lo cambiado y es idempotente', () => {
    const mine = createBook({ id: 'mio', title: 'La casa de las mareas', author: 'Autora Ficticia', isbn: '', pageCount: null, status: 'read' });
    let { state } = importAll(emptyState([mine]), fixture('goodreads-basico.csv'), {
      choose: (it) => (it.line === 2 ? { ...it, action: 'fill' } : it),
    });
    const touched = state.books.find((b) => b.title === 'Lectura en curso');
    const noted = state.books.find((b) => b.title === 'Ficción sintética');
    state = reducer(state, { type: 'updateBook', id: touched.id, patch: { favorite: true } });
    state = reducer(state, { type: 'addQuote', id: noted.id, quote: { id: 'q1', text: 'Una nota', color: 'yellow' } });
    // Después de importar, cambio a mano las páginas completadas: esas se quedan; el ISBN completado vuelve a vacío
    state = reducer(state, { type: 'updateBook', id: 'mio', patch: { pageCount: 999 } });
    const undone = reducer(state, { type: 'importUndo', id: 'imp-1' });
    const titles = undone.books.map((b) => b.title);
    expect(titles).toContain('Lectura en curso');
    expect(titles).toContain('Ficción sintética');
    expect(titles).not.toContain('Fecha dudosa');
    const restored = undone.books.find((b) => b.id === 'mio');
    expect(restored.isbn).toBe('');
    expect(restored.pageCount).toBe(999);
    expect(undone.imports[0].conflicts.length).toBeGreaterThanOrEqual(3);
    expect(reducer(undone, { type: 'importUndo', id: 'imp-1' })).toEqual(undone);
  });

  it('14 · importar no crea sesiones, sellos, figuras ni publicaciones', () => {
    const before = emptyState();
    const { state } = importAll(before, fixture('goodreads-basico.csv'));
    expect(state.progress).toEqual(before.progress);
    for (const b of state.books) {
      expect(b.publicReview ?? null).toBe(null);
      expect(b.startedAt).toBe(null);
      expect(b.source).toBe('goodreads');
      expect(b.editionType).toBe('paperback');
    }
    // Leyendo sin progreso en el archivo: sin posición registrada (no se inventa)
    expect(state.books.find((b) => b.status === 'reading')).toMatchObject({ currentPage: 0, currentPercent: 0, pageCount: null, trackBy: 'percent' });
  });
});

describe('edición visual ebook retirada', () => {
  it('15 · un ebook antiguo se dibuja como bolsillo y conserva su dato y su porcentaje', () => {
    const old = createBook({ id: 'k', title: 'Antiguo', editionType: 'kindle', pageCount: null, currentPercent: 42.5, trackBy: 'percent', status: 'reading' });
    expect(old.editionType).toBe('kindle');
    expect(old).toMatchObject({ trackBy: 'percent', currentPercent: 42.5, pageCount: null });
    expect(visualEdition(old)).toBe('paperback');
    expect(isDigital(old)).toBe(true);
    expect(visualEdition({ editionType: 'inventada' })).toBe('paperback');
    expect(visualEdition({ editionType: 'leatherbound' })).toBe('leatherbound');
    expect(SELECTABLE_EDITION_IDS).not.toContain('kindle');
    expect(Object.keys(FORMATS)).not.toContain('kindle');
    expect(editionFromFormat('Kindle Edition')).toBe(null);
    // Un libro nuevo no puede estrenar la edición retirada
    const s = reducer(emptyState(), { type: 'addBook', book: { title: 'Nuevo', editionType: 'kindle' } });
    expect(s.books[0].editionType).toBe('paperback');
  });
});

describe('baldas de la habitación con toda la biblioteca', () => {
  const lib = (statuses) => statuses.map((status, i) => createBook({ id: `b${i}`, title: `Libro ${i}`, status, addedAt: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z` }));
  it('solo pendientes o solo leídos también llenan las baldas', () => {
    expect(roomShelfQueue(lib(['want', 'want', 'want']), null)).toHaveLength(3);
    expect(roomShelfQueue(lib(['read', 'read']), null).map((b) => b.status)).toEqual(['read', 'read']);
  });
  it('biblioteca mixta: el libro de la cama primero y todos los estados al principio, en orden estable', () => {
    const books = lib(['want', 'want', 'read', 'abandoned', 'reading', 'reading', 'read']);
    const q = roomShelfQueue(books, 'b5');
    expect(q[0].id).toBe('b5');
    expect(new Set(q.slice(0, 5).map((b) => b.status))).toEqual(new Set(['reading', 'read', 'want', 'abandoned']));
    expect(q).toHaveLength(books.length);
    expect(roomShelfQueue([...books].reverse(), 'b5').map((b) => b.id)).toEqual(q.map((b) => b.id));
  });
});
