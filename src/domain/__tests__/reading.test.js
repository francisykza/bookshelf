// Pruebas de valoraciones en cuartos y del registro de lecturas (SPEC §14): normalización, conversión de
// porcentaje a página, ebooks sin total, historial inmutable, lectura frente a corrección y persistencia
// sin duplicados.
import { describe, expect, it } from 'vitest';
import { createBook, formatRating, normalizeRating, percentRead, progressLabel, withTracking } from '../books';
import { appendEntry, buildEntry, describeEntry, entryText, formatPP, groupByDay, isActive, normalizeLog, parseDecimal, quickUpdate, summarize, validateInput } from '../reading';
import { EMPTY_FIGURES, grantSeal } from '../figures';
import { hydrate } from '../../state/useLibrary';

const TODAY = '2026-10-21';
const sp = (text) => text.replace(new RegExp(String.fromCharCode(160), 'g'), ' ');
const paper = (extra = {}) => createBook({ id: 'p', title: 'Papel', pageCount: 420, currentPage: 185, status: 'reading', ...extra });
const ebook = (extra = {}) => createBook({ id: 'e', title: 'Ebook', editionType: 'kindle', pageCount: null, status: 'reading', ...extra });
const opts = (extra) => ({ date: TODAY, today: TODAY, now: `${TODAY}T10:00:00.000Z`, id: 'x', ...extra });

describe('valoraciones en cuartos de estrella', () => {
  it('conserva cada cuarto de 0,25 a 5', () => {
    [0.25, 0.5, 0.75, 1, 3.25, 3.5, 3.75, 5].forEach((v) => expect(normalizeRating(v)).toBe(v));
  });

  it('0, vacío o no numérico es «sin valorar» (null explícito); fuera de rango se acota', () => {
    expect(normalizeRating(0)).toBeNull();
    expect(normalizeRating('')).toBeNull();
    expect(normalizeRating(null)).toBeNull();
    expect(normalizeRating(Number.NaN)).toBeNull();
    expect(normalizeRating(Infinity)).toBeNull();
    expect(normalizeRating(7)).toBe(5);
    expect(normalizeRating(0.1)).toBe(0.25);
    expect(normalizeRating('3.75')).toBe(3.75);
  });

  it('no redondea a enteros y guarda el original si estaba fuera de contrato', () => {
    expect(normalizeRating(3.3)).toBe(3.25);
    const book = createBook({ title: 'x', rating: 3.3 });
    expect(book.rating).toBe(3.25);
    expect(book.ratingOriginal).toBe(3.3);
    expect(createBook({ title: 'y', rating: 4 }).ratingOriginal).toBeUndefined();
  });

  it('se formatea con coma decimal', () => {
    expect(formatRating(3.75)).toBe('3,75');
    expect(formatRating(4)).toBe('4');
  });
});

describe('entrada numérica', () => {
  it('acepta coma o punto y rechaza lo ambiguo', () => {
    expect(parseDecimal('42,5').value).toBe(42.5);
    expect(parseDecimal('42.5').value).toBe(42.5);
    expect(parseDecimal('').error).toBeTruthy();
    expect(parseDecimal('1.234,5').error).toBeTruthy();
    expect(parseDecimal('-3').error).toBeTruthy();
    expect(parseDecimal('12a').error).toBeTruthy();
  });

  it('valida unidad y rango', () => {
    expect(validateInput(paper(), 'page', '421').error).toMatch(/420/);
    expect(validateInput(paper(), 'page', '20,5').error).toMatch(/enteros/);
    expect(validateInput(ebook(), 'percent', '100,1').error).toBeTruthy();
    expect(validateInput(ebook(), 'percent', '42,55').error).toMatch(/decimal/);
    expect(validateInput(ebook(), 'percent', '42,5').value).toBe(42.5);
  });
});

describe('progreso por páginas o porcentaje', () => {
  it('185 → 200 de 420 son +15 páginas', () => {
    const { entry, position } = buildEntry(paper(), [], opts({ mode: 'page', text: '200' }));
    expect(entry).toMatchObject({ unit: 'pages', from: 185, to: 200, delta: 15, pages: 15, kind: 'read', active: true });
    expect(position).toBe(200);
    expect(sp(entryText(entry))).toBe('Página 200 de 420 · +15 páginas');
  });

  it('un porcentaje en un libro con total se convierte a página', () => {
    const { entry, position } = buildEntry(paper(), [], opts({ mode: 'percent', text: '50' }));
    expect(entry.to).toBe(210);
    expect(entry.entered).toEqual({ percent: 50 });
    expect(position).toBe(210);
  });

  it('un ebook sin total va por porcentaje y no inventa páginas', () => {
    const book = ebook({ currentPercent: 35 });
    expect(book.pageCount).toBeNull();
    expect(book.trackBy).toBe('percent');
    expect(sp(progressLabel(book))).toBe('35 % leído');
    const { entry } = buildEntry(book, [], opts({ mode: 'percent', text: '42,5' }));
    expect(entry).toMatchObject({ unit: 'percent', from: 35, to: 42.5, delta: 7.5, pages: 0, total: null });
    expect(sp(entryText(entry))).toBe('42,5 % leído · +7,5 puntos porcentuales');
    expect(sp(entryText(entry, { compact: true }))).toBe('42,5 % leído · +7,5 pp');
  });

  it('el primer 42,5 % de un ebook es una posición, no un avance desde cero', () => {
    const { entry } = buildEntry(ebook(), [], opts({ mode: 'percent', text: '42,5', declared: false }));
    expect(entry.from).toBeNull();
    expect(entry.delta).toBeNull();
    expect(sp(entryText(entry))).toBe('42,5 % leído');
    expect(isActive(entry)).toBe(false);
    expect(isActive(buildEntry(ebook(), [], opts({ mode: 'percent', text: '42,5', declared: true })).entry)).toBe(true);
  });

  it('un retroceso es una corrección: sin páginas, racha ni avance', () => {
    const res = buildEntry(ebook({ currentPercent: 42.5 }), [], opts({ mode: 'percent', text: '40' }));
    expect(res.correction).toBe(true);
    expect(res.entry).toMatchObject({ kind: 'correction', pages: 0, active: false });
    expect(isActive(res.entry)).toBe(false);
    expect(res.position).toBe(40);
    expect(summarize([res.entry], [ebook()]).text).toBe('');
  });

  it('un registro retrospectivo no baja la posición actual', () => {
    const book = paper({ currentPage: 200 });
    const log = [{ id: 'hoy', bookId: 'p', date: TODAY, createdAt: `${TODAY}T09:00:00Z`, kind: 'read', unit: 'pages', from: 185, to: 200, pages: 15, delta: 15 }];
    const res = buildEntry(book, log, opts({ date: '2026-10-19', mode: 'page', text: '150' }));
    expect(res.position).toBeNull();
    expect(res.entry.kind).toBe('read');
  });

  it('un día pasado por debajo de la posición actual se guarda como dato histórico', () => {
    const res = buildEntry(paper({ currentPage: 200 }), [], opts({ date: '2026-10-19', mode: 'page', text: '150' }));
    expect(res.entry).toMatchObject({ kind: 'read', from: null, delta: null, to: 150 });
    expect(res.position).toBeNull();
  });

  it('avisa si choca con un registro posterior', () => {
    const log = [{ id: 'b', bookId: 'p', date: '2026-10-20', createdAt: 'z', kind: 'read', unit: 'pages', from: 100, to: 150, pages: 50, delta: 50 }];
    const res = buildEntry(paper({ currentPage: 150 }), log, opts({ date: '2026-10-18', mode: 'page', text: '180' }));
    expect(res.conflict?.id).toBe('b');
  });

  it('el historial no cambia al avanzar el libro', () => {
    const first = buildEntry(paper(), [], opts({ mode: 'page', text: '200' })).entry;
    const later = { ...paper(), currentPage: 300 };
    const days = groupByDay([first], [later]);
    expect(sp(entryText(days[TODAY][0].entries[0]))).toBe('Página 200 de 420 · +15 páginas');
  });

  it('cambiar de unidad convierte la posición con el total', () => {
    const toPct = withTracking(paper({ currentPage: 210 }), 'percent');
    expect(toPct.currentPercent).toBe(50);
    expect(percentRead(toPct)).toBe(50);
    expect(withTracking(toPct, 'pages').currentPage).toBe(210);
    expect(withTracking(ebook(), 'pages').trackBy).toBe('percent');
  });
});

describe('estadísticas sin mezclar unidades', () => {
  it('páginas y porcentajes se cuentan por separado', () => {
    const books = [paper(), ebook()];
    const entries = [
      { id: 'a', bookId: 'p', date: TODAY, kind: 'read', unit: 'pages', pages: 22, delta: 22, to: 207 },
      { id: 'b', bookId: 'e', date: TODAY, kind: 'read', unit: 'percent', pages: 0, delta: 7.5, to: 42.5 },
    ];
    expect(sp(summarize(entries, books).text)).toBe('22 páginas · avance registrado en 1 ebook');
  });

  it('un avance positivo diminuto no se muestra como +0', () => {
    expect(formatPP(0.04)).toBe('<0,1');
    expect(formatPP(7.5)).toBe('7,5');
    expect(sp(describeEntry({ kind: 'read', unit: 'percent', to: 42.54, delta: 0.04 }, { compact: true }).advance)).toBe('+<0,1 pp');
  });
});

describe('persistencia y migración', () => {
  it('varias sesiones del mismo libro en un día se conservan por separado', () => {
    const one = buildEntry(paper(), [], opts({ mode: 'added', text: '10', id: 's1' }));
    const book2 = { ...paper(), currentPage: one.position };
    const two = buildEntry(book2, [one.entry], opts({ mode: 'added', text: '5', id: 's2', now: `${TODAY}T11:00:00Z` }));
    const days = groupByDay([one.entry, two.entry], [book2]);
    expect(days[TODAY]).toHaveLength(1);
    expect(days[TODAY][0].entries.map((e) => e.id)).toEqual(['s1', 's2']);
    expect(days[TODAY][0].pages).toBe(15);
  });

  it('los botones rápidos se agrupan en un registro y deshacerlos lo elimina', () => {
    const book = paper();
    const a = quickUpdate(book, [], 186, { date: TODAY, id: 'q1' });
    const b = quickUpdate({ ...book, currentPage: 186 }, a.log, 196, { date: TODAY, id: 'q2' });
    expect(b.log).toHaveLength(1);
    expect(b.log[0]).toMatchObject({ id: 'q1', from: 185, to: 196, pages: 11 });
    const c = quickUpdate({ ...book, currentPage: 196 }, b.log, 185, { date: TODAY, id: 'q3' });
    expect(c.log).toHaveLength(0);
  });

  it('guardar dos veces el mismo intento no duplica ni da dos sellos', () => {
    const { entry } = buildEntry(paper(), [], opts({ mode: 'page', text: '200', id: 'dup' }));
    const once = appendEntry([], entry);
    expect(appendEntry(once, entry)).toBe(once);
    const fs = { ...EMPTY_FIGURES, guardian: 'a', seals: 0 };
    const sealed = grantSeal(fs, TODAY);
    expect(grantSeal(sealed, TODAY)).toBe(sealed);
    expect(sealed.seals).toBe(1);
  });

  it('los registros antiguos se migran sin inventar posiciones y la migración es idempotente', () => {
    const legacy = [{ date: '2026-10-01', bookId: 'circe', pages: 22 }];
    const once = normalizeLog(legacy);
    expect(once[0]).toMatchObject({ id: 'legacy-2026-10-01-circe', kind: 'read', unit: 'pages', pages: 22, from: null, to: null, source: 'legacy' });
    expect(normalizeLog(once)).toEqual(once);
    expect(sp(entryText(once[0]))).toBe('22 páginas registradas');
  });

  it('hydrate v5 → v6 conserva libros, valoraciones y figuras', () => {
    const saved = {
      version: 5,
      books: [{ id: 'circe', title: 'Circe', pageCount: 400, currentPage: 120, rating: 4, status: 'reading' }],
      progress: { readingLog: [{ date: '2026-10-01', bookId: 'circe', pages: 22 }], figures: { boxes: 3, seals: 2, owned: {}, pity: { relic: 4, figure: 7 } } },
    };
    const next = hydrate(saved);
    expect(next.version).toBe(6);
    expect(next.books[0]).toMatchObject({ id: 'circe', currentPage: 120, rating: 4, trackBy: 'pages', currentPercent: 30 });
    expect(next.progress.figures).toMatchObject({ boxes: 3, seals: 2, pity: { relic: 4, figure: 7 } });
    expect(next.progress.readingLog[0].pages).toBe(22);
    expect(hydrate(next).progress.readingLog).toEqual(next.progress.readingLog);
  });
});
