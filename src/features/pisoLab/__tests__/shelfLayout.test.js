import { describe, expect, it } from 'vitest';
import { COVER_SPACE, SHELF_INNER, TOP_ROW, fitSlots, shelfRows } from '../shelfLayout';

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
