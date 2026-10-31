// 1.62 (SPEC §62.2): la tarjeta del sillón siempre dentro de la pantalla y la lista de lecturas en curso.
import { describe, expect, it } from 'vitest';
import { placeCard } from '../components/SeatCard';
import { readingBooks } from '../components/SeatChoice';

const view = { width: 390, height: 844 };
const anchor = (left, top, size = 60) => ({ left, top, width: size, height: size, bottom: top + size });

describe('tarjeta anclada al sillón', () => {
  it('encima del asiento si cabe, centrada en él y sin salirse por los lados', () => {
    expect(placeCard(anchor(165, 600), { width: 300, height: 200 }, view)).toEqual({ left: 45, top: 390, width: 300, side: 'arriba' });
    expect(placeCard(anchor(0, 600), { width: 300, height: 200 }, view).left).toBe(12);
    expect(placeCard(anchor(380, 600), { width: 300, height: 200 }, view).left).toBe(390 - 12 - 300);
  });

  it('debajo si arriba no cabe; y si tampoco, pegada abajo con su propio scroll', () => {
    expect(placeCard(anchor(165, 100), { width: 300, height: 200 }, view)).toMatchObject({ top: 170, side: 'abajo' });
    const tall = placeCard(anchor(130, 300), { width: 340, height: 900 }, { width: 320, height: 640 });
    expect(tall).toMatchObject({ left: 12, top: 12, width: 296, side: 'encima', maxHeight: 616 });
  });
});

describe('lecturas en curso para sentarse', () => {
  it('la actual primero y solo libros empezados', () => {
    const books = [
      { id: 'a', status: 'reading', updatedAt: '2026-01-01' },
      { id: 'b', status: 'want', updatedAt: '2026-05-01' },
      { id: 'c', status: 'reading', updatedAt: '2026-03-01' },
      { id: 'd', status: 'reading', updatedAt: '2026-02-01' },
    ];
    expect(readingBooks(books, { currentBookId: 'd' }).map((b) => b.id)).toEqual(['d', 'c', 'a']);
    expect(readingBooks([], {})).toEqual([]);
  });
});
