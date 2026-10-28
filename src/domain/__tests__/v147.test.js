// 1.47 (SPEC §43, §45): vista previa del registro con el ejemplo del encargo y estado «Abandonado».
import { describe, expect, it } from 'vitest';
import { STATUS, createBook, withStatus } from '../books';
import { EMPTY_TEXT, LIBRARY_STATUSES, abandonedBooks, activeReadings, filterLibrary } from '../library';
import { buildEntry, previewLines } from '../reading';

const book = () => createBook({ id: 'b1', title: 'Libro', pageCount: 528, currentPage: 25, status: 'reading', trackBy: 'pages' });

describe('vista previa del registro', () => {
  const opts = { date: '2026-10-28', today: '2026-10-28', id: 's1' };
  it('«He leído 20» desde la página 25 de 528', () => {
    const { entry } = buildEntry(book(), [], { ...opts, mode: 'added', text: '20' });
    expect(previewLines(entry)).toEqual(['Registrarás 20 páginas', 'Pasarás de la página 25 a la 45', '8,5 % leído']);
  });
  it('«Voy por la página 45» da el mismo resultado', () => {
    const { entry } = buildEntry(book(), [], { ...opts, mode: 'page', text: '45' });
    expect(previewLines(entry)).toEqual(['Registrarás 20 páginas', 'Pasarás de la página 25 a la 45', '8,5 % leído']);
  });
  it('una página anterior es una corrección, no una sesión', () => {
    const { entry, correction } = buildEntry(book(), [], { ...opts, mode: 'page', text: '10' });
    expect(correction).toBe(true);
    expect(previewLines(entry)).toEqual(['Corregirás tu posición: de la página 25 a la página 10', 'No suma páginas ni cuenta para la racha']);
  });
  it('valores imposibles o vacíos no producen registro', () => {
    expect(buildEntry(book(), [], { ...opts, mode: 'page', text: '600' }).error).toBeTruthy();
    expect(buildEntry(book(), [], { ...opts, mode: 'added', text: '-3' }).error).toBeTruthy();
    expect(buildEntry(book(), [], { ...opts, mode: 'added', text: '' }).error).toBeTruthy();
  });
});

describe('abandonado', () => {
  it('es un estado propio que conserva la posición y no cuenta como terminado', () => {
    expect(STATUS.abandoned).toBe('Abandonado');
    expect(LIBRARY_STATUSES).toContain('abandoned');
    const b = withStatus(book(), 'abandoned', '2026-10-28T10:00:00.000Z');
    expect(b).toMatchObject({ status: 'abandoned', currentPage: 25, finishedAt: null, abandonedAt: '2026-10-28T10:00:00.000Z' });
    expect(activeReadings([b])).toHaveLength(0);
    expect(abandonedBooks([b])).toHaveLength(1);
    expect(EMPTY_TEXT.abandoned).toBeTruthy();
  });
  it('se retoma como «Leyendo» desde su progreso', () => {
    const back = withStatus(withStatus(book(), 'abandoned'), 'reading');
    expect(back).toMatchObject({ status: 'reading', currentPage: 25, abandonedAt: null });
  });
  it('«Todos» lo incluye y el filtro se combina con la búsqueda', () => {
    const list = [withStatus(book(), 'abandoned'), createBook({ id: 'b2', title: 'Otro libro', status: 'want' })];
    expect(filterLibrary(list)).toHaveLength(2);
    expect(filterLibrary(list, { status: 'abandoned' }).map((b) => b.id)).toEqual(['b1']);
    expect(filterLibrary(list, { status: 'abandoned', query: 'otro' })).toHaveLength(0);
    expect(filterLibrary(list, { status: 'all', query: 'otro' }).map((b) => b.id)).toEqual(['b2']);
  });
});
