// 1.62 (SPEC §62.2): la lista de lecturas en curso.
import { describe, expect, it } from 'vitest';
import { readingBooks } from '../components/SeatChoice';

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
