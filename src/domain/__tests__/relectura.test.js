// Piloto del piso (7-11-2026): la relectura se empieza a petición y conserva el historial; en la última página y aún en
// «Leyendo» se ofrece terminar el libro, sin terminarlo solo.
import { describe, expect, it } from 'vitest';
import { atLastPage, startReread } from '../books';
import { reducer } from '../../state/useLibrary';

const book = (over = {}) => ({ id: 'b1', title: 'Libro', pageCount: 300, trackBy: 'pages', currentPage: 300, currentPercent: 100, status: 'read', startedAt: '2026-10-01T10:00:00.000Z', finishedAt: '2026-10-20T10:00:00.000Z', ...over });

describe('relectura', () => {
  it('guarda la lectura anterior y empieza desde la página 0', () => {
    const next = startReread(book(), '2026-11-07T09:00:00.000Z');
    expect(next).toMatchObject({ status: 'reading', currentPage: 0, currentPercent: 0, startedAt: '2026-11-07T09:00:00.000Z', finishedAt: null });
    expect(next.pastReads).toEqual([{ startedAt: '2026-10-01T10:00:00.000Z', finishedAt: '2026-10-20T10:00:00.000Z' }]);
  });

  it('suma lecturas anteriores sin perder las que había', () => {
    const next = startReread(book({ pastReads: [{ startedAt: null, finishedAt: '2025-01-01T00:00:00.000Z' }] }), '2026-11-07T09:00:00.000Z');
    expect(next.pastReads).toHaveLength(2);
    expect(next.pastReads[0].finishedAt).toBe('2025-01-01T00:00:00.000Z');
  });

  it('solo de un libro terminado', () => {
    const reading = book({ status: 'reading', currentPage: 120, finishedAt: null });
    expect(startReread(reading)).toBe(reading);
  });

  it('en el reducer no toca las sesiones del registro', () => {
    const log = [{ id: 's1', bookId: 'b1', date: '2026-10-20', kind: 'read', delta: 40 }];
    const state = { books: [book()], progress: { readingLog: log } };
    const next = reducer(state, { type: 'startReread', id: 'b1' });
    expect(next.progress.readingLog).toBe(log);
    expect(next.books[0].status).toBe('reading');
    expect(next.books[0].pastReads).toHaveLength(1);
  });
});

describe('última página en «Leyendo»', () => {
  it('se ofrece terminar solo en la última página y en «Leyendo»', () => {
    expect(atLastPage(book({ status: 'reading', finishedAt: null }))).toBe(true);
    expect(atLastPage(book({ status: 'reading', currentPage: 299, finishedAt: null }))).toBe(false);
    expect(atLastPage(book())).toBe(false);
    expect(atLastPage(book({ status: 'reading', trackBy: 'percent', pageCount: 0, currentPage: 0, currentPercent: 100 }))).toBe(true);
  });
});
