// Pruebas de la 1.25.0 (SPEC §19): cuadrícula del mes de la pantalla del portátil, línea de progreso del libro
// abierto y racha de lectura compartida con el panel del portátil.
import { describe, expect, it } from 'vitest';
import { formatPercent } from '../books';
import { monthCells, progressLine } from '../roomSurfaces';
import { activeDays, readingStreak } from '../reading';

describe('cuadrícula del mes', () => {
  it('empieza en lunes con huecos delante', () => {
    // 1 de octubre de 2026 es jueves: tres huecos (L, M, X)
    const cells = monthCells('2026-10-24');
    expect(cells.slice(0, 4)).toEqual([null, null, null, '2026-10-01']);
    expect(cells.filter(Boolean)).toHaveLength(31);
    expect(cells.at(-1)).toBe('2026-10-31');
  });

  it('mes que empieza en lunes no tiene huecos; febrero bisiesto tiene 29 días', () => {
    expect(monthCells('2026-06-10')[0]).toBe('2026-06-01');
    expect(monthCells('2028-02-03').filter(Boolean)).toHaveLength(29);
  });

  it('domingo 1 cae en la séptima columna', () => {
    // 1 de noviembre de 2026 es domingo
    expect(monthCells('2026-11-05').indexOf('2026-11-01')).toBe(6);
  });
});

describe('línea de progreso del libro abierto', () => {
  it('páginas con total', () => {
    expect(progressLine({ trackBy: 'pages', currentPage: 120, pageCount: 480 })).toBe(`Página 120 de 480 · ${formatPercent(25)}`);
  });

  it('por porcentaje', () => {
    expect(progressLine({ trackBy: 'percent', currentPercent: 37.5 })).toBe(`${formatPercent(37.5)} leído`);
  });

  it('datos incompletos: nunca NaN ni undefined', () => {
    for (const book of [{}, { trackBy: 'pages', pageCount: 300 }, { trackBy: 'percent' }, { currentPage: 40 }]) {
      expect(progressLine(book)).not.toMatch(/NaN|undefined/);
    }
  });
});

describe('racha de lectura', () => {
  const e = (date, pages = 10) => ({ date, pages });
  const today = new Date(2026, 9, 24);

  it('cuenta días seguidos hasta hoy, o hasta ayer si hoy aún no hay lectura', () => {
    expect(readingStreak([e('2026-10-24'), e('2026-10-23'), e('2026-10-22'), e('2026-10-20')], today)).toBe(3);
    expect(readingStreak([e('2026-10-23'), e('2026-10-22')], today)).toBe(2);
    expect(readingStreak([e('2026-10-21')], today)).toBe(0);
  });

  it('sin tope de 14 días y sin contar correcciones ni días a cero', () => {
    const long = Array.from({ length: 30 }, (_, i) => e(`2026-10-${String(24 - i).padStart(2, '0')}`)).filter((x) => !x.date.endsWith('-00') && x.date >= '2026-10-01');
    expect(readingStreak(long, today)).toBe(24);
    expect(activeDays([e('2026-10-24', 0), { date: '2026-10-23', pages: 5, kind: 'correction' }, e('2026-10-22')])).toEqual(new Set(['2026-10-22']));
    expect(readingStreak(undefined, today)).toBe(0);
  });
});
