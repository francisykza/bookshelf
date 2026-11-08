// Las cifras esperadas están calculadas a mano en cada caso, no con la propia función.
import { describe, expect, it } from 'vitest';
import { cardPages, cleanNote, finishDay, monthSummary, shiftMonth } from '../monthSummary';

const HOY = new Date(2026, 10, 8, 12);
const libro = (id, extra = {}) => ({ id, title: `Libro ${id}`, status: 'want', pageCount: 300, finishedAt: null, ...extra });
const sesion = (id, bookId, date, extra = {}) => ({ id, bookId, date, kind: 'read', unit: 'pages', mode: 'added', from: 0, to: 10, pages: 10, delta: 10, total: 300, active: true, ...extra });
const resumen = (datos, mes = '2026-10') => monthSummary(datos, mes, HOY);

describe('fechas de finalización', () => {
  it('conserva el día de una fecha sin hora y de una importación, y rechaza lo inválido', () => {
    expect(finishDay('2026-10-31')).toBe('2026-10-31');
    expect(finishDay('2025-06-30T12:00:00.000Z')).toBe('2025-06-30');
    expect(finishDay('2026-02-31')).toBeNull();
    expect(finishDay('hace tiempo')).toBeNull();
    expect(finishDay(null)).toBeNull();
  });
  it('agrupa un momento con hora por el día local, sin contarlo en dos meses', () => {
    const fin = new Date(2026, 9, 31, 23, 59, 30);
    const inicio = new Date(2026, 10, 1, 0, 0, 0);
    const books = [libro('a', { status: 'read', finishedAt: fin.toISOString() }), libro('b', { status: 'read', finishedAt: inicio.toISOString() })];
    expect(resumen({ books }, '2026-10').finished.map((f) => f.book.id)).toEqual(['a']);
    expect(resumen({ books }, '2026-11').finished.map((f) => f.book.id)).toEqual(['b']);
  });
});

describe('libros terminados', () => {
  it('mes vacío: todo a cero y sin actividad', () => {
    expect(resumen({ books: [libro('a')], log: [] })).toMatchObject({ finishedCount: 0, pages: 0, days: 0, hasActivity: false, finished: [] });
  });
  it('un leído sin fecha no cae en ningún mes y se avisa', () => {
    const s = resumen({ books: [libro('a', { status: 'read', finishedAt: null, addedAt: '2026-10-05T10:00:00.000Z', updatedAt: '2026-10-05T10:00:00.000Z' })] });
    expect(s.finishedCount).toBe(0);
    expect(s.undated.map((b) => b.id)).toEqual(['a']);
  });
  it('una importación cuenta en su fecha de lectura, no en la de importación', () => {
    const books = [libro('a', { status: 'read', finishedAt: '2025-06-30T12:00:00.000Z', addedAt: '2026-10-02T10:00:00.000Z' })];
    expect(resumen({ books }, '2026-10').finishedCount).toBe(0);
    expect(resumen({ books }, '2025-06').finishedCount).toBe(1);
  });
  it('dos lecturas del mismo libro en el mes: una portada y dos lecturas', () => {
    const books = [libro('a', { status: 'read', finishedAt: '2026-10-20T10:00:00.000Z', pastReads: [{ startedAt: null, finishedAt: '2026-10-02T10:00:00.000Z' }] })];
    const s = resumen({ books });
    expect(s.finished).toHaveLength(1);
    expect(s.finished[0].count).toBe(2);
    expect(s.finishedCount).toBe(2);
  });
  it('un libro que se está releyendo conserva la lectura terminada', () => {
    const books = [libro('a', { status: 'reading', finishedAt: null, pastReads: [{ finishedAt: '2026-10-02T10:00:00.000Z' }] })];
    expect(resumen({ books }).finishedCount).toBe(1);
  });
  it('corregir la fecha mueve el libro entre los dos meses', () => {
    const antes = [libro('a', { status: 'read', finishedAt: '2026-10-20T10:00:00.000Z' })];
    const despues = [libro('a', { status: 'read', finishedAt: '2026-09-20T10:00:00.000Z' })];
    expect([resumen({ books: antes }, '2026-10').finishedCount, resumen({ books: antes }, '2026-09').finishedCount]).toEqual([1, 0]);
    expect([resumen({ books: despues }, '2026-10').finishedCount, resumen({ books: despues }, '2026-09').finishedCount]).toEqual([0, 1]);
  });
});

describe('páginas y días', () => {
  const books = [libro('a'), libro('p', { pageCount: 200 }), libro('s', { pageCount: null })];
  it('varias sesiones el mismo día: suman páginas y cuentan un día', () => {
    const log = [sesion('1', 'a', '2026-10-05', { pages: 12 }), sesion('2', 'a', '2026-10-05', { pages: 8 }), sesion('3', 'a', '2026-10-06', { pages: 5 })];
    expect(resumen({ books, log })).toMatchObject({ pages: 25, days: 2 });
  });
  it('una sesión del último día y otra del primero van cada una a su mes', () => {
    const log = [sesion('1', 'a', '2026-10-31', { pages: 7 }), sesion('2', 'a', '2026-11-01', { pages: 9 })];
    expect(resumen({ books, log }, '2026-10').pages).toBe(7);
    expect(resumen({ books, log }, '2026-11').pages).toBe(9);
  });
  it('suma el avance, no la página absoluta, y una corrección no resta', () => {
    const log = [sesion('1', 'a', '2026-10-05', { mode: 'page', from: 100, to: 130, pages: 30, delta: 30 }), sesion('2', 'a', '2026-10-06', { kind: 'correction', from: 130, to: 120, pages: 0, delta: -10, active: false })];
    expect(resumen({ books, log })).toMatchObject({ pages: 30, days: 1 });
  });
  it('terminar sin sesión no añade páginas ni días', () => {
    const terminado = [libro('a', { status: 'read', finishedAt: '2026-10-20T10:00:00.000Z', currentPage: 300 })];
    expect(resumen({ books: terminado, log: [] })).toMatchObject({ finishedCount: 1, pages: 0, days: 0 });
  });
  it('un porcentaje con total se convierte: 10 puntos de 200 páginas son 20', () => {
    const log = [sesion('1', 'p', '2026-10-05', { unit: 'percent', mode: 'percent', from: 20, to: 30, pages: 0, delta: 10, total: 200 })];
    expect(resumen({ books, log })).toMatchObject({ pages: 20, converted: 20, unknown: 0, days: 1 });
  });
  it('un porcentaje sin total no inventa páginas, pero cuenta el día y se avisa', () => {
    const log = [sesion('1', 's', '2026-10-05', { unit: 'percent', mode: 'percent', from: 20, to: 30, pages: 0, delta: 10, total: null })];
    expect(resumen({ books, log })).toMatchObject({ pages: 0, unknown: 1, days: 1, hasActivity: true });
  });
  it('deshacer una sesión la quita del resumen', () => {
    const log = [sesion('1', 'a', '2026-10-05', { pages: 12 }), sesion('2', 'a', '2026-10-06', { pages: 8 })];
    expect(resumen({ books, log: log.filter((e) => e.id !== '2') })).toMatchObject({ pages: 12, days: 1 });
  });
  it('con sesiones y sin libros terminados hay actividad', () => {
    expect(resumen({ books, log: [sesion('1', 'a', '2026-10-05')] })).toMatchObject({ finishedCount: 0, pages: 10, hasActivity: true });
  });
});

describe('favorito y frase', () => {
  const books = [libro('a', { status: 'read', finishedAt: '2026-10-20T10:00:00.000Z' })];
  it('sin elección no hay favorito, aunque solo haya un libro', () => {
    expect(resumen({ books }).favorite).toBeNull();
  });
  it('si el libro deja de ser del mes, no se usa y se explica, sin borrar el dato', () => {
    const notes = { '2026-10': { favorite: 'b', quote: 'Otoño' } };
    expect(resumen({ books, notes })).toMatchObject({ favorite: null, favoriteLost: true, quote: 'Otoño' });
    expect(notes['2026-10'].favorite).toBe('b');
  });
  it('la frase se limita a 160 caracteres y lo vacío no se guarda', () => {
    expect(cleanNote({}, { quote: 'x'.repeat(200) }).quote).toHaveLength(160);
    expect(cleanNote({ favorite: 'a', quote: 'Algo' }, { favorite: null, quote: '   ' })).toEqual({});
  });
});

describe('meses y tarjetas', () => {
  it('cruza el cambio de año', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2025-12', 1)).toBe('2026-01');
  });
  it('marca el mes actual como en curso', () => {
    expect(resumen({}, '2026-11').current).toBe(true);
    expect(resumen({}, '2026-10').current).toBe(false);
  });
  it('reparte en tarjetas de 12 sin perder ninguno', () => {
    const lista = Array.from({ length: 25 }, (_, i) => i);
    expect(cardPages(lista).map((p) => p.length)).toEqual([12, 12, 1]);
    expect(cardPages([]).map((p) => p.length)).toEqual([0]);
  });
});
