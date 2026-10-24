// Pruebas de la 1.26.0–1.27.0 (SPEC §20–21): progreso de la página «Por donde vas» del libro abierto.
import { describe, expect, it } from 'vitest';
import { formatPercent } from '../books';
import { progressParts } from '../roomSurfaces';

describe('progreso de la página derecha', () => {
  it('páginas con total: línea principal, porcentaje secundario y fracción', () => {
    expect(progressParts({ trackBy: 'pages', currentPage: 61, pageCount: 496 })).toEqual({ main: 'Página 61', secondary: `de 496 · ${formatPercent((61 / 496) * 100)}`, fraction: 61 / 496 });
    // El ejemplo de la captura: «de 496 · 12,3 %»
    expect(progressParts({ trackBy: 'pages', currentPage: 61, pageCount: 496 }).secondary).toMatch(/^de 496 · 12,3\s%$/);
  });

  it('por porcentaje: el porcentaje como dato y «leído»', () => {
    expect(progressParts({ trackBy: 'percent', currentPercent: 12 })).toMatchObject({ main: formatPercent(12), secondary: 'leído' });
  });

  it('datos incompletos: nunca NaN ni undefined', () => {
    for (const b of [{}, { trackBy: 'percent' }, { trackBy: 'pages', pageCount: 300 }]) {
      const p = progressParts(b);
      expect(`${p.main} ${p.secondary}`).not.toMatch(/NaN|undefined/);
    }
  });
});
