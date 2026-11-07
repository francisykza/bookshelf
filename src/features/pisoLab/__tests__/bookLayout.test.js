import { describe, expect, it } from 'vitest';
import { bookDims, wrapTitle } from '../bookLayout';

const fitsIn = (n) => (text) => text.length <= n;

describe('las medidas del libro de la mesa', () => {
  it('un libro normal tiene proporciones de libro: ni un cojín ni una hoja', () => {
    const { width, length, thick } = bookDims({ thickness: 0.19, height: 1 }, 2 / 3);
    expect(width / length).toBeCloseTo(2 / 3, 2);
    expect(thick / length).toBeGreaterThan(0.1);
    expect(thick / length).toBeLessThan(0.25);
  });

  it('un tomo enorme o un folleto se quedan dentro de lo razonable', () => {
    expect(bookDims({ thickness: 2, height: 1 }).thick).toBe(0.18);
    expect(bookDims({ thickness: 0.01, height: 1 }).thick).toBe(0.08);
  });

  it('una portada cuadrada o muy estrecha no deforma el libro', () => {
    expect(bookDims({ thickness: 0.2, height: 1 }, 1).width).toBeCloseTo(0.62 * 0.8);
    expect(bookDims({ thickness: 0.2, height: 1 }, 0.2).width).toBeCloseTo(0.62 * 0.58);
    expect(bookDims({ thickness: 0.2, height: 1 }, 0).width).toBeCloseTo(0.62 * 0.66);
  });
});

describe('el título de una cubierta sin portada', () => {
  it('reparte por palabras', () => {
    expect(wrapTitle('El nombre del viento', fitsIn(10), 4)).toEqual({ lines: ['El nombre', 'del viento'], cut: false });
  });

  it('sin título no pinta nada', () => {
    expect(wrapTitle('', fitsIn(10), 4)).toEqual({ lines: [], cut: false });
    expect(wrapTitle(undefined, fitsIn(10), 4)).toEqual({ lines: [], cut: false });
  });

  it('un título larguísimo acaba en puntos suspensivos sin salirse', () => {
    const { lines, cut } = wrapTitle('La increíble y triste historia de la cándida Eréndira y de su abuela desalmada', fitsIn(12), 3);
    expect(cut).toBe(true);
    expect(lines).toHaveLength(3);
    expect(lines[2].endsWith('…')).toBe(true);
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(12);
  });

  it('una palabra que no cabe se parte con guion', () => {
    const { lines } = wrapTitle('Supercalifragilístico', fitsIn(10), 4);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines[0].endsWith('-')).toBe(true);
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(10);
    expect(lines.join('').replaceAll('-', '')).toBe('Supercalifragilístico');
  });
});
