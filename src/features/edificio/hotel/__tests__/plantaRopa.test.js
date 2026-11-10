// 2.ª ampliación del almacén, bloque 2: el plano de la planta de ropa y sus reglas (de dónde sale cada prenda, la cesta).
import { describe, expect, it } from 'vitest';
import { ROPA_CASINO, ROPA_ESTIBA } from '../../actor';
import { NODOS, onNet } from '../almacenLayout';
import { CESTA_MAX, ZONAS_ROPA, cambioDe, cestaSana, esTuya, origenDe, zonaRopa } from '../plantaRopa';

describe('la planta de ropa', () => {
  it('cada prenda cuelga en una sola zona, y la de casino y estiba solo en «Fiesta y faena»', () => {
    const todas = ZONAS_ROPA.flatMap((z) => z.prendas);
    expect(new Set(todas).size).toBe(todas.length);
    for (const p of [...ROPA_CASINO, ...ROPA_ESTIBA]) expect(zonaRopa('fiesta').prendas).toContain(p);
    for (const z of ZONAS_ROPA.filter((x) => x.id !== 'fiesta')) for (const p of z.prendas) expect(['serie', 'misiones', 'tienda']).toContain(origenDe(p));
  });
  it('desde cada zona se mira desde un pasillo de abajo', () => {
    for (const z of ZONAS_ROPA) {
      const p = onNet(z.mira[0], z.mira[1], -4.6);
      expect(p.z).toBe(-4.6);
      expect(Math.hypot(p.x - z.mira[0], p.y - z.mira[1])).toBeLessThan(0.05);
    }
    expect(NODOS.m2[2]).toBe(-4.6);
  });
  it('de serie es de todos; lo que se gana, solo si lo tienes', () => {
    expect(esTuya('jersey:0', [])).toBe(true);
    expect(esTuya('jersey:13', [])).toBe(false);
    expect(esTuya('jersey:13', ['jersey:13'])).toBe(true);
    expect(cambioDe('gafas:true')).toEqual({ gafas: true });
    expect(cambioDe('complemento:capa')).toEqual({ complemento: 'capa' });
  });
  it('la cesta, limpia: sin repetir, solo de la planta y como mucho CESTA_MAX', () => {
    const todas = ZONAS_ROPA.flatMap((z) => z.prendas);
    expect(cestaSana(['jersey:0', 'jersey:0', 'sofa:1', 7])).toEqual(['jersey:0']);
    expect(cestaSana(todas)).toHaveLength(CESTA_MAX);
    expect(cestaSana('nada')).toEqual([]);
  });
});

describe('la ropa propia de la planta (bloque 3)', () => {
  it('cuelga en su zona, con su precio, y no se gana: se compra', async () => {
    const { ROPA_TIENDA } = await import('../../actor');
    const { precioRopa } = await import('../plantaRopa');
    const todas = ZONAS_ROPA.flatMap((z) => z.prendas);
    for (const p of Object.keys(ROPA_TIENDA)) {
      expect(todas).toContain(p);
      expect(origenDe(p)).toBe('tienda');
      expect(precioRopa(p)).toBeGreaterThan(0);
      expect(esTuya(p, [])).toBe(false);
    }
    expect(precioRopa('jersey:12')).toBeNull();
    expect(precioRopa('jersey:16')).toBeNull();
  });
});
