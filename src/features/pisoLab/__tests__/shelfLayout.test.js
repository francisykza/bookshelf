import { describe, expect, it } from 'vitest';
import { COVER_SPACE, SHELF_INNER, TOP_ROW, composeRow, copyData, fitSlots, shelfRows } from '../shelfLayout';
import { bookDims } from '../bookLayout';

const book = (id, extra = {}) => ({ id, title: `Libro ${id}`, author: 'Autora', isbn: `978${id}`, status: 'want', pageCount: 320, editionType: 'hardcover', ...extra });
const library = (n) => [book('lectura', { status: 'reading' }), ...Array.from({ length: n }, (_, k) => book(`b${k}`))];
const end = (item) => item.x + item.w;

describe('fitSlots', () => {
  const slot = (id, left, width) => ({ id, left, top: 0, width, height: 100 });
  it('un lomo fino gana ancho a sus vecinos, sin solaparse', () => {
    const out = fitSlots([slot('a', 0, 40), slot('b', 40, 18), slot('c', 58, 40)]);
    expect(out[1].width).toBe(30);
    expect(out[0].left + out[0].width).toBeCloseTo(out[1].left, 5);
    expect(out[1].left + out[1].width).toBeCloseTo(out[2].left, 5);
    expect(out[0].width).toBeGreaterThanOrEqual(30);
    expect(out[2].width).toBeGreaterThanOrEqual(30);
  });
  it('los anchos no se tocan y dos finos se reparten el sitio', () => {
    expect(fitSlots([slot('a', 0, 60)])[0].width).toBe(60);
    const out = fitSlots([slot('a', 0, 18), slot('b', 18, 18)]);
    expect(out[0].left + out[0].width).toBeCloseTo(out[1].left, 5);
  });
});

describe('shelfRows', () => {
  it('sin libros no hay nada que dibujar', () => {
    expect(shelfRows([], {})).toBeNull();
  });

  it('tu lectura va de frente y no se repite como lomo', () => {
    const { cover, rows } = shelfRows(library(8), {});
    expect(cover.id).toBe('lectura');
    expect(rows.flat().map((i) => i.id)).not.toContain('lectura');
  });

  it('ningún libro aparece dos veces', () => {
    const ids = shelfRows(library(30), {}).rows.flat().map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('con una biblioteca grande solo se dibuja lo que cabe, sin salirse ni encoger los lomos', () => {
    const small = shelfRows(library(3), {}).rows.flat()[0];
    const { rows, hidden } = shelfRows(library(400), {});
    expect(hidden).toBeGreaterThan(300);
    rows.forEach((row, k) => {
      const room = k === TOP_ROW ? SHELF_INNER - COVER_SPACE : SHELF_INNER;
      expect(row.length).toBeGreaterThan(0);
      for (const item of row) expect(end(item)).toBeLessThanOrEqual(room);
    });
    expect(rows[0][0].w).toBeCloseTo(small.w, 5);
  });

  it('con pocos libros se reparten: ninguna balda se llena mientras otra queda vacía', () => {
    const { rows, hidden } = shelfRows(library(9), {});
    expect(hidden).toBe(0);
    for (const row of rows) expect(row.length).toBeGreaterThan(0);
  });

  it('un libro solo queda de frente y las baldas vacías', () => {
    const { cover, rows, hidden } = shelfRows(library(0), {});
    expect(cover.id).toBe('lectura');
    expect(rows.flat()).toEqual([]);
    expect(hidden).toBe(0);
  });
});

const sized = (n) => Array.from({ length: n }, (_, i) => ({ id: `m${i}`, title: `Libro ${i}`, author: 'Autora', status: i ? 'read' : 'reading', pageCount: 180 + ((i * 37) % 900), cover: 'x', editionType: i % 4 ? 'paperback' : 'hardcover' }));
const ends = (i) => [i.x + i.w / 2 - i.extent / 2, i.x + i.w / 2 + i.extent / 2];

// 1.88: con las medidas del libro de la mesa caben de 20 a 30 ejemplares, sin salirse de su balda ni pisar a su vecino, ni girados
describe('la estantería del piso con las medidas de la mesa', () => {
  it('con 28 libros caben al menos 20 (la lectura de frente aparte), sin salirse ni pisarse', () => {
    const shelf = shelfRows(sized(28), { currentBookId: 'm0' });
    const shown = shelf.rows.reduce((n, r) => n + r.length, 0) + 1;
    expect(shown).toBeGreaterThanOrEqual(20);
    expect(shown).toBeLessThanOrEqual(30);
    shelf.rows.forEach((row, k) => {
      const room = k === 2 ? SHELF_INNER - COVER_SPACE : SHELF_INNER;
      expect(row.dropped).toBe(0);
      row.forEach((item, j) => {
        const [a, b] = ends(item);
        expect(a).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThanOrEqual(room + 1e-9);
        if (j) expect(a).toBeGreaterThanOrEqual(ends(row[j - 1])[1]);
      });
    });
  });

  it('con mil libros sigue el límite de 30', () => {
    const shelf = shelfRows(sized(1000), { currentBookId: 'm0' });
    expect(shelf.rows.reduce((n, r) => n + r.length, 0) + 1).toBeLessThanOrEqual(30);
  });

  it('el ejemplar de la balda tiene las medidas del de la mesa', () => {
    const book = sized(6)[3];
    const shelf = shelfRows(sized(6), { currentBookId: 'm0' });
    const item = shelf.rows.flat().find((i) => i.id === book.id);
    expect(item.dims).toEqual(bookDims(copyData(book)));
    expect(item.w).toBe(item.dims.thick);
  });

  it('lo que no cabe se queda fuera, nunca se encoge', () => {
    const big = sized(12).map((b) => ({ ...b, pageCount: 1200, editionType: 'hardcover' }));
    const row = composeRow([big.map((b) => ({ ...copyData(b), dims: bookDims(copyData(b)), w: bookDims(copyData(b)).thick, depthMax: bookDims(copyData(b), 1).width }))], 1, true);
    expect(row.dropped).toBeGreaterThan(0);
    expect(row.every((i) => i.w === i.dims.thick)).toBe(true);
  });
});
