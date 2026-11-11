import { describe, expect, it } from 'vitest';
import { RULETA, anguloFinal, casillaEn, frenada, lunesDe, premioNombre } from '../ruleta';

describe('la ruleta de premios', () => {
  it('la rueda se para en la casilla decidida, siempre lejos de la raya', () => {
    const paso = (2 * Math.PI) / RULETA.length;
    for (let n = 0; n < RULETA.length; n += 1) {
      for (const desde of [0, 1.3, 40.2]) {
        for (const desvio of [-0.9, -0.3, 0, 0.3, 0.9]) {
          const a = anguloFinal(n, desde, 5, desvio);
          expect(casillaEn(a)).toBe(n);
          // Da al menos cinco vueltas y no más de seis
          expect(a - desde).toBeGreaterThanOrEqual(5 * 2 * Math.PI);
          expect(a - desde).toBeLessThan(6 * 2 * Math.PI + paso);
          // A más de un 20 % del ancho de la casilla de cada borde
          const dentro = (((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / paso - n;
          expect(dentro).toBeGreaterThanOrEqual(0.2 - 1e-9);
          expect(dentro).toBeLessThanOrEqual(0.8 + 1e-9);
        }
      }
    }
  });

  it('la frenada solo frena: sin pausas ni acelerones', () => {
    let antes = 0;
    let vel = Infinity;
    for (let k = 1; k <= 100; k += 1) {
      const v = frenada(k / 100) - antes;
      expect(v).toBeLessThanOrEqual(vel + 1e-12);
      vel = v;
      antes = frenada(k / 100);
    }
    expect(frenada(1)).toBe(1);
  });

  it('la semana empieza el lunes', () => {
    expect(lunesDe('2026-11-10')).toBe('2026-11-09');
    expect(lunesDe('2026-11-09')).toBe('2026-11-09');
    expect(lunesDe('2026-11-15')).toBe('2026-11-09');
    expect(lunesDe('2026-11-16')).toBe('2026-11-16');
  });

  it('cada casilla tiene nombre', () => {
    expect(RULETA.map(premioNombre)).toEqual([
      '20 fichas',
      'Esmoquin de terciopelo',
      '40 fichas',
      'Lámpara de flecos',
      '100 garbanzos',
      'Ruleta de sobremesa',
      '80 fichas',
      'Reloj de pie art déco',
      'Mapache crupier',
    ]);
  });
});
