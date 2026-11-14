// 1.131 (Francisco, 14-11-2026: «que cuando pilar prepara el café ella se haga más orgánico y no tan robótico»): el ritmo de
// la mano de Pilar. Siempre hacia delante, distinto en cada taza, y al final de cada gesto la misma postura y los mismos
// sonidos que antes.
import { describe, expect, it } from 'vitest';
import { MEDIDAS, crearGesto } from '../cafe/cafeGestos';
import { duracionPilar, PILAR_MS, poseAuto, respiroPilar, sonidosEntre, tiempoPilar } from '../cafe/cafePilar';

const SEMILLAS = [0, 0.13, 0.5, 0.77, 0.999];
const TIPOS = Object.keys(PILAR_MS);
/** Los sonidos de un gesto entero, en pasos del tamaño de un fotograma (60 por segundo). */
const sonidosDe = (tipo, semilla) => {
  const n = Math.round((PILAR_MS[tipo] / 1000) * 60);
  const out = [];
  for (let k = 1; k <= n; k += 1) out.push(...sonidosEntre(tipo, (k - 1) / n, k / n, semilla));
  return out;
};

describe('Pilar, a mano (1.131)', () => {
  it('el tiempo de la mano empieza en 0, acaba en 1 y nunca va hacia atrás', () => {
    for (const s of SEMILLAS) {
      expect(tiempoPilar(0, s)).toBe(0);
      expect(tiempoPilar(1, s)).toBeCloseTo(1, 9);
      let antes = 0;
      for (let k = 1; k <= 400; k += 1) {
        const u = tiempoPilar(k / 400, s);
        expect(u).toBeGreaterThanOrEqual(antes);
        antes = u;
      }
    }
  });

  it('no va a velocidad constante y cada taza es distinta', () => {
    expect(tiempoPilar(0.1, 0.5)).toBeLessThan(0.1);
    expect(tiempoPilar(0.5, 0.2)).not.toBeCloseTo(tiempoPilar(0.5, 0.7), 3);
    expect(poseAuto('agitar', 0.4, { semilla: 0.1 }).x).not.toBeCloseTo(poseAuto('agitar', 0.4, { semilla: 0.6 }).x, 3);
    expect(duracionPilar('manivela', 0)).toBeLessThan(duracionPilar('manivela', 1));
    expect(respiroPilar(0)).toBeLessThan(respiroPilar(1));
  });

  it('al acabar, cada gesto queda en la misma postura que a mano', () => {
    for (const tipo of TIPOS)
      for (const s of SEMILLAS) {
        const fin = poseAuto(tipo, 1, { semilla: s });
        const ref = crearGesto(tipo).completar().pose;
        for (const [k, v] of Object.entries(fin)) {
          if (k === 'puntos' || k === 'arte' || k === 'ondas') continue;
          if (typeof v === 'number' && typeof ref[k] === 'number') expect([tipo, k, v]).toEqual([tipo, k, expect.closeTo(ref[k], 6)]);
        }
      }
  });

  it('suenan los mismos golpes, clics y sacudidas que antes (y no se repiten)', () => {
    const esperado = {
      manivela: ['clic', MEDIDAS.vueltas * 8],
      apisonar: ['golpe', 1],
      palanca: ['abajo', 1],
      cuchara: ['hojas', 1],
      colador: ['plop', MEDIDAS.vecesColador],
      verter: ['onda', 3],
      agitar: ['sacudida', MEDIDAS.vecesAgitar],
      hilo: ['hilo', 5],
      molinillo: ['remueve', MEDIDAS.vueltasMolinillo * 4],
      batir: ['bate', MEDIDAS.vueltasBatir * 4],
      rascar: ['raspa', MEDIDAS.trazosRascar],
      coctelera: ['hielo', MEDIDAS.vecesCoctelera],
      mortero: ['machaca', MEDIDAS.golpesMortero],
      soplete: ['chispa', 1],
    };
    for (const [tipo, [nombre, n]] of Object.entries(esperado))
      for (const s of SEMILLAS) expect([tipo, s, sonidosDe(tipo, s)]).toEqual([tipo, s, Array(n).fill(nombre)]);
  });

  it('el golpe del mortero suena cuando la mano cae', () => {
    const n = 600;
    for (let k = 1; k <= n; k += 1) {
      const t = k / n;
      if (sonidosEntre('mortero', (k - 1) / n, t, 0.4).length) expect(poseAuto('mortero', t, { semilla: 0.4 }).maza).toBe(1);
    }
  });
});
