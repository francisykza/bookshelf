// 1.34.0 (SPEC §27.7): el diario se construye solo con datos existentes, agrupado por día y sin inventar fechas.
import { describe, expect, it } from 'vitest';
import { journalDays } from '../journal';

const book = (over = {}) => ({ id: 'b1', status: 'reading', quotes: [], review: '', finishedAt: null, ...over });
const session = (id, date, to) => ({ id, bookId: 'b1', date, kind: 'read', unit: 'pages', mode: 'reached', from: to - 10, to, delta: 10, pages: 10, total: 100, active: true, source: 'form', createdAt: `${date}T10:00:00.000Z` });

describe('journalDays', () => {
  it('vacío sin sesiones, citas ni reseña', () => {
    expect(journalDays(book(), [])).toEqual([]);
  });

  it('agrupa sesiones y citas por día, de la más reciente a la más antigua, sin mezclar otros libros', () => {
    const log = [session('s1', '2026-10-20', 40), session('s2', '2026-10-24', 60), { ...session('x', '2026-10-24', 9), bookId: 'otro' }];
    const quotes = [{ id: 'q1', text: 'Frase', color: 'gold', page: 12, createdAt: '2026-10-24T18:00:00.000Z' }];
    const days = journalDays(book({ quotes }), log);
    expect(days.map((d) => d.key)).toEqual(['2026-10-24', '2026-10-20']);
    expect(days[0].items.map((i) => i.kind).sort()).toEqual(['quote', 'session']);
    expect(days.flatMap((d) => d.items).some((i) => i.entry?.bookId === 'otro')).toBe(false);
  });

  it('una cita sin fecha fiable va al final, sin fecha inventada', () => {
    const days = journalDays(book({ quotes: [{ id: 'q', text: 'x', color: 'yellow', createdAt: 'no es una fecha' }] }), [session('s1', '2026-10-20', 40)]);
    expect(days.at(-1)).toMatchObject({ key: null });
    expect(days.at(-1).items[0].kind).toBe('quote');
  });

  it('la reseña al terminar solo aparece con el libro terminado y texto', () => {
    expect(journalDays(book({ review: 'Precioso', status: 'reading' }), [])).toEqual([]);
    const days = journalDays(book({ review: 'Precioso', status: 'read', finishedAt: '2026-10-11T09:00:00.000Z' }), []);
    expect(days).toEqual([{ key: '2026-10-11', items: [expect.objectContaining({ kind: 'review' })] }]);
  });
});
