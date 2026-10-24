// Pruebas de la 1.26.0 (SPEC §20): lo leído hoy en la pantalla del portátil y el progreso de la página derecha.
import { describe, expect, it } from 'vitest';
import { formatPercent } from '../books';
import { groupByDay } from '../reading';
import { progressParts, todayReading } from '../roomSurfaces';

const books = [
  { id: 'a', title: 'Circe', pageCount: 420, currentPage: 184 },
  { id: 'b', title: 'Dune', pageCount: 600, currentPage: 20 },
  { id: 'e', title: 'Ebook', trackBy: 'percent', currentPercent: 40 },
];
const day = '2026-10-24';
const e = (id, bookId, extra) => ({ id, bookId, date: day, kind: 'read', unit: 'pages', createdAt: `${day}T0${id.length}:00:00Z`, ...extra });
const groups = (log) => groupByDay(log, books)[day];

describe('lo leído hoy', () => {
  it('sin registros hoy: invitación, sin datos inventados', () => {
    expect(todayReading(undefined)).toMatchObject({ kind: 'none', value: '' });
    expect(todayReading(groups([e('1', 'a', { pages: 0, active: false })]) ?? [])).toMatchObject({ kind: 'none' });
  });

  it('suma las páginas registradas hoy, no la página actual', () => {
    const r = todayReading(groups([e('1', 'a', { pages: 6, from: 178, to: 184 })]));
    expect(r).toMatchObject({ kind: 'pages', value: '6', label: 'páginas leídas', title: 'Circe', more: 0 });
  });

  it('varias lecturas: el libro con más páginas primero y «+N»', () => {
    const r = todayReading(groups([e('1', 'a', { pages: 5 }), e('22', 'b', { pages: 30 })]));
    expect(r).toMatchObject({ value: '35', title: 'Dune', more: 1 });
    expect(todayReading(groups([e('1', 'a', { pages: 1 })])).label).toBe('página leída');
  });

  it('solo porcentaje: la posición del libro, nunca NaN', () => {
    const r = todayReading(groups([e('1', 'e', { unit: 'percent', pages: 0, active: true, to: 40 })]));
    expect(r.kind).toBe('percent');
    expect(r.title).toBe('Ebook');
    expect(r.value).not.toMatch(/NaN|undefined/);
  });

  it('las correcciones no cuentan como lectura', () => {
    expect(todayReading(groups([e('1', 'a', { kind: 'correction', pages: 0 })]) ?? []).kind).toBe('none');
  });
});

describe('progreso de la página derecha', () => {
  it('páginas con total: línea principal, porcentaje secundario y fracción', () => {
    expect(progressParts({ trackBy: 'pages', currentPage: 61, pageCount: 496 })).toEqual({ main: 'Página 61 de 496', secondary: `${formatPercent((61 / 496) * 100)} leído`, fraction: 61 / 496 });
  });

  it('por porcentaje: sin «Página» ni secundario', () => {
    expect(progressParts({ trackBy: 'percent', currentPercent: 12 })).toMatchObject({ main: `${formatPercent(12)} leído`, secondary: '' });
  });

  it('datos incompletos: nunca NaN ni undefined', () => {
    for (const b of [{}, { trackBy: 'percent' }, { trackBy: 'pages', pageCount: 300 }]) {
      const p = progressParts(b);
      expect(`${p.main} ${p.secondary}`).not.toMatch(/NaN|undefined/);
    }
  });
});
