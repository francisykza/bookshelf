// Pruebas de la 1.27.0 (SPEC §21.5): colocación de las etiquetas informativas respecto al viewport.
import { describe, expect, it } from 'vitest';
import { placeLabel } from '../../scene/guidePlacement';

const panel = { w: 390, h: 844 };
const none = { top: 0, right: 0, bottom: 0, left: 0 };
const size = { w: 186, h: 57 };

describe('etiquetas ancladas', () => {
  it('encima del ancla y centrada cuando cabe', () => {
    expect(placeLabel(panel, { x: 200, y: 500 }, size, none)).toMatchObject({ x: 107, y: 433, side: 'above', fits: true });
  });

  it('junto al borde derecho: se limita a 12 px del borde (el caso del temporizador)', () => {
    const p = placeLabel(panel, { x: 380, y: 544 }, size, none);
    expect(p.x).toBe(390 - 12 - 186);
    expect(p.x + size.w).toBeLessThanOrEqual(390 - 12);
  });

  it('sin sitio arriba cambia de lado', () => {
    expect(placeLabel(panel, { x: 200, y: 40 }, size, none)).toMatchObject({ side: 'below', y: 50 });
  });

  it('respeta las áreas seguras', () => {
    const p = placeLabel(panel, { x: 10, y: 60 }, size, { top: 47, right: 0, bottom: 34, left: 20 });
    expect(p.x).toBe(32);
    expect(p.y).toBeGreaterThanOrEqual(59);
  });

  it('ancla fuera de la pantalla: la etiqueta sigue dentro', () => {
    const p = placeLabel(panel, { x: 600, y: -100 }, size, none);
    expect(p.x).toBeLessThanOrEqual(390 - 12 - 186);
    expect(p.y).toBeGreaterThanOrEqual(12);
  });

  it('más grande que el espacio: lo indica y queda centrada', () => {
    const p = placeLabel({ w: 200, h: 100 }, { x: 100, y: 50 }, { w: 300, h: 150 }, none);
    expect(p.fits).toBe(false);
    expect(p.x).toBe((12 + (200 - 12 - 300)) / 2);
  });
});
