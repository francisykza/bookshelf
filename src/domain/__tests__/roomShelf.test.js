import { describe, expect, it } from 'vitest';
import { featuredBook, layoutSpines, showcaseRow, shownCount, spineQueue, spineSize, uniqueBooks } from '../roomShelf';

const book = (id, extra = {}) => ({ id, title: `Libro ${id}`, author: 'Autora', status: 'read', pageCount: 320, editionType: 'paperback', ...extra });
const SHELVES = [
  { id: 'middle', width: 205, height: 150 },
  { id: 'cabinet', width: 205, height: 130 },
  { id: 'cabinet2', width: 205, height: 120 },
];
const count = (rows) => rows.reduce((n, r) => n + r.groups.reduce((m, g) => m + g.items.length, 0), 0);

describe('libro expuesto', () => {
  it('sin libros no hay nada que exponer', () => {
    expect(featuredBook([], {})).toBe(null);
  });
  it('el elegido manda; si no está, lectura actual, favorito y primero, en ese orden', () => {
    const books = [book('a'), book('b', { favorite: true }), book('c', { status: 'reading' })];
    expect(featuredBook(books, { roomFeaturedId: 'a' })).toEqual({ book: books[0], reason: 'elegido' });
    expect(featuredBook(books, { roomFeaturedId: 'retirado' }).reason).toBe('lectura');
    expect(featuredBook(books.slice(0, 2), {}).book.id).toBe('b');
    expect(featuredBook([book('x'), book('y')], {}).book.id).toBe('x');
  });
  it('al retirar el expuesto se aplica el mismo orden de sustitución', () => {
    const books = [book('a'), book('b', { favorite: true })];
    const settings = { roomFeaturedId: 'a' };
    expect(featuredBook(books, settings).book.id).toBe('a');
    expect(featuredBook(books.filter((b) => b.id !== 'a'), settings)).toEqual({ book: books[1], reason: 'favorito' });
  });
});

describe('lomos', () => {
  it('un ejemplar por id', () => {
    expect(uniqueBooks([book('a'), book('a'), book('b')]).map((b) => b.id)).toEqual(['a', 'b']);
  });
  it('primero las lecturas actuales (la de la cama delante) y sin el expuesto', () => {
    const books = [book('r1'), book('l1', { status: 'reading', updatedAt: '2026-01-01' }), book('l2', { status: 'reading', updatedAt: '2026-02-01' }), book('f')];
    const q = spineQueue(books, { currentBookId: 'l1' }, 'f').map((b) => b.id);
    expect(q.slice(0, 2)).toEqual(['l1', 'l2']);
    expect(q).not.toContain('f');
  });
  it('lomos estrechos: ningún libro de bolsillo pasa de 4 cm', () => {
    expect(spineSize(book('a', { pageCount: 900 }), 130).w).toBeLessThan(4 * (130 / 28));
  });
  it('con cuatro libros se ven los cuatro', () => {
    const rows = layoutSpines([book(1), book(2), book(3), book(4)], SHELVES);
    expect(count(rows)).toBe(4);
  });
  it('con más de mil, lo que cabe en las baldas y ni uno más', () => {
    const many = Array.from({ length: 1200 }, (_, i) => book(`b${i}`, { pageCount: 120 + (i % 7) * 90 }));
    const rows = layoutSpines(many, SHELVES);
    const n = count(rows);
    expect(n).toBeGreaterThan(20);
    expect(n).toBeLessThan(80);
    for (const { shelf, groups } of rows) {
      for (const g of groups) for (const it of g.items) expect(it.x + it.w).toBeLessThanOrEqual(shelf.width);
    }
    expect(shownCount(rows, { id: 'x' })).toBe(n + 1);
  });
  it('los grupos dejan hueco entre ellos', () => {
    const rows = layoutSpines(Array.from({ length: 30 }, (_, i) => book(`g${i}`)), SHELVES);
    const [a, b] = rows[0].groups;
    const endA = a.items.at(-1).x + a.items.at(-1).w;
    expect(b.items[0].x - endA).toBeGreaterThanOrEqual(9);
  });
  it('determinista: la misma biblioteca da el mismo reparto', () => {
    const books = Array.from({ length: 40 }, (_, i) => book(`d${i}`));
    expect(JSON.stringify(layoutSpines(books, SHELVES))).toBe(JSON.stringify(layoutSpines(books, SHELVES)));
  });
});

describe('balda de prueba (corrección visual)', () => {
  it('uno de frente (el primero con portada) y dos de lomo, cada uno una vez; el resto sigue en la cola', () => {
    const books = [book('a'), book('b', { cover: 'x.jpg' }), book('c', { pageCount: 880 }), book('d'), book('e')];
    const { row, rest } = showcaseRow(books, SHELVES[0]);
    const items = row.groups[0].items;
    expect(items.map((i) => i.book.id)).toEqual(['b', 'a', 'c']);
    expect(items[0].front).toBe(true);
    expect(rest.map((b) => b.id)).toEqual(['d', 'e']);
    // Proporciones naturales: el de 880 páginas es más grueso; el grupo, unos dos tercios de la balda, sin tocar el techo
    expect(items[2].w).toBeGreaterThan(items[1].w);
    const right = items.at(-1).x + items.at(-1).w;
    expect(right / SHELVES[0].width).toBeGreaterThan(0.55);
    expect(right / SHELVES[0].width).toBeLessThan(0.75);
    for (const i of items) expect(i.h).toBeLessThan(SHELVES[0].height * 0.85);
  });

  it('con menos de tres libros pone los que hay, y sin libros deja la madera', () => {
    expect(showcaseRow([book('a')], SHELVES[0]).row.groups[0].items).toHaveLength(1);
    expect(showcaseRow([], SHELVES[0]).row.groups).toEqual([]);
  });
});
