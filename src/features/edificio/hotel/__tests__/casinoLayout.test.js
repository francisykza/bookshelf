// 1.107 · El plano del casino en 3D: la escalera sube del suelo al rellano, se llega andando a cada sitio y nada se cruza
// con las columnas.
import { describe, expect, it } from 'vitest';
import { COLUMNAS, ESCALERA, INICIO, NODOS, RELLANO, SITIOS, TRAMOS, dentro, onNet, route, zDe } from '../casinoLayout';

describe('el plano del casino', () => {
  it('la escalera sube del suelo al rellano sin saltos', () => {
    expect(zDe(8, ESCALERA.y0 - 0.1)).toBe(0);
    expect(zDe(8, RELLANO.y0)).toBe(RELLANO.z);
    expect(zDe(8, (ESCALERA.y0 + ESCALERA.y1) / 2)).toBeCloseTo(RELLANO.z / 2, 5);
  });

  it('se empieza en el rellano y desde allí se llega a cada sitio', () => {
    const from = onNet(INICIO.x, INICIO.y);
    expect(from.z).toBe(RELLANO.z);
    for (const [id, s] of Object.entries(SITIOS)) {
      const [x, y] = NODOS[s.nudo];
      const path = route(from, onNet(x, y));
      expect(path.length, id).toBeGreaterThan(0);
      const [lx, ly, lz] = path.at(-1);
      expect(Math.hypot(lx - x, ly - y), id).toBeLessThan(1e-6);
      expect(lz, id).toBe(0);
    }
  });

  it('los pasillos no atraviesan las columnas', () => {
    for (const [a, b] of TRAMOS) {
      const [ax, ay] = NODOS[a];
      const [bx, by] = NODOS[b];
      for (const [cx, cy] of COLUMNAS) {
        const dx = bx - ax;
        const dy = by - ay;
        const t = Math.max(0, Math.min(1, ((cx - ax) * dx + (cy - ay) * dy) / (dx * dx + dy * dy)));
        expect(Math.hypot(ax + dx * t - cx, ay + dy * t - cy), `${a}-${b}`).toBeGreaterThan(0.6);
      }
    }
  });

  it('los nudos de la sala se pueden tocar en el suelo', () => {
    for (const [id, [x, y, z]] of Object.entries(NODOS)) if (z === 0) expect(dentro(x, y), id).toBe(true);
  });
});
