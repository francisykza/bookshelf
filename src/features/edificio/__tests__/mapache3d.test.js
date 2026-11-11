// 1.109 · El mapache crupier en 3D (mapache3d.js): cajas bien formadas, de su tamaño, y una pose honesta con el
// movimiento reducido (sin malabares ni guiños).
import { describe, expect, it } from 'vitest';
import { MAPACHE, poseMapache } from '../mapache3d';

const cajas = () => [...MAPACHE.cuerpo, ...MAPACHE.cola, ...MAPACHE.ficha, ...MAPACHE.parpados];

describe('el mapache crupier en 3D', () => {
  it('sus cajas están bien formadas y mide lo que dice', () => {
    for (const { b, c } of cajas()) {
      expect(b[0]).toBeLessThan(b[3]);
      expect(b[1]).toBeLessThan(b[4]);
      expect(b[2]).toBeLessThan(b[5]);
      expect(c).toHaveLength(3);
    }
    const alto = Math.max(...MAPACHE.cuerpo.map((x) => x.b[5]));
    expect(alto).toBeGreaterThan(0.7);
    expect(alto).toBeLessThanOrEqual(MAPACHE.alto);
    expect(Math.min(...MAPACHE.cuerpo.map((x) => x.b[2]))).toBe(0);
  });

  it('quieto hace malabares con tres fichas por fuera de la cara; al trote, una en la mano', () => {
    for (let t = 0; t < 10; t += 0.37) {
      const p = poseMapache(t);
      expect(p.fichas.every(Boolean)).toBe(true);
      // La cara ocupa x ±0,18 entre z 0,44 y 0,7: una ficha a esa altura va por fuera
      for (const [x, , z] of p.fichas) if (z > 0.44 && z < 0.7) expect(Math.abs(x)).toBeGreaterThan(0.18);
      const andando = poseMapache(t, { moving: true });
      expect(andando.fichas.filter(Boolean)).toHaveLength(1);
      expect(andando.parpados).toEqual([false, false]);
    }
  });

  it('con movimiento reducido, quieto: sin malabares, sin bote y con los ojos abiertos', () => {
    for (const t of [0, 1.5, 4.3]) {
      expect(poseMapache(t, { quieto: true })).toEqual({ bote: 0, cola: 0, fichas: [[0.18, 0.24, 0.3], null, null], parpados: [false, false] });
    }
  });
});
