// 1.88: la cara de cada lomo sale de su portada (en miniatura) y la escena se vuelve a pintar si cambia la portada o la
// edición aunque el libro sea el mismo.
import { describe, expect, it } from 'vitest';
import { paletteOf, thumbUrl } from '../spineLooks';
import { bookLooks, sceneKey } from '../shelfLayout';

const pixels = (colors) => new Uint8ClampedArray(colors.flatMap(([r, g, b]) => [r, g, b, 255]));

describe('miniaturas de portada', () => {
  it('pide el tamaño pequeño de Open Library y de Google Books; lo demás, tal cual', () => {
    expect(thumbUrl('https://covers.openlibrary.org/b/id/12345-L.jpg')).toBe('https://covers.openlibrary.org/b/id/12345-S.jpg');
    expect(thumbUrl('https://covers.openlibrary.org/b/isbn/978-L.jpg?default=false')).toBe('https://covers.openlibrary.org/b/isbn/978-S.jpg?default=false');
    expect(thumbUrl('https://books.google.com/books/content?id=x&zoom=1&fife=w600-h900')).toBe('https://books.google.com/books/content?id=x&zoom=1&fife=w80-h120');
    expect(thumbUrl('/lab/covers/c1.png?n=1')).toBe('/lab/covers/c1.png?n=1');
    expect(thumbUrl('')).toBe('');
    expect(thumbUrl(null)).toBe('');
  });
});

describe('paleta de una portada', () => {
  it('el color que más ocupa, otro bien distinto para los detalles y la tinta que se lee encima', () => {
    const navy = [20, 30, 90];
    const gold = [220, 180, 60];
    const p = paletteOf(pixels([...Array(30).fill(navy), ...Array(8).fill(gold), [21, 31, 91]]));
    expect(p.base).toEqual([20, 30, 90]);
    expect(p.accent).toEqual(gold);
    expect(p.ink).toBe('light');
  });

  it('una portada de un solo color clara lleva tinta oscura y un detalle más oscuro', () => {
    const p = paletteOf(pixels(Array(20).fill([240, 236, 220])));
    expect(p.ink).toBe('dark');
    expect(p.accent.every((v, k) => v < p.base[k])).toBe(true);
  });

  it('sin píxeles opacos, nada', () => {
    expect(paletteOf(new Uint8ClampedArray([0, 0, 0, 0]))).toBeNull();
  });
});

describe('la escena se repinta con lo que se ve del libro', () => {
  const book = { id: 'a', title: 'Momo', author: 'Michael Ende', cover: '/c1.png', editionType: 'paperback', color: '#335577' };
  const shelf = (b) => ({ cover: b, rows: [[{ id: b.id, book: b }], [], []] });

  it('cambia con la portada o la edición aunque el id sea el mismo', () => {
    const base = sceneKey(book, shelf(book));
    expect(sceneKey({ ...book, cover: '/c2.png' }, shelf({ ...book, cover: '/c2.png' }))).not.toBe(base);
    expect(bookLooks({ ...book, editionType: 'hardcover' })).not.toBe(bookLooks(book));
    expect(bookLooks({ ...book, spine: '/lomo.png' })).not.toBe(bookLooks(book));
  });

  it('registrar una página no la cambia', () => {
    expect(sceneKey({ ...book, currentPage: 40 }, shelf(book))).toBe(sceneKey(book, shelf(book)));
  });
});
