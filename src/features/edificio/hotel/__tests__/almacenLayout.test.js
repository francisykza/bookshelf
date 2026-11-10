// La red de pasillos del Almacén del Puerto con sus dos plantas (2.ª ampliación, 10-11-2026): las escaleras mecánicas
// solo van en su sentido, en ellas no se para nadie y cada planta tiene sus pasillos.
import { describe, expect, it } from 'vitest';
import { BAJO, NODOS, dentro, onNet, route, zEscalera } from '../almacenLayout';

const ruta = (a, b) => route(onNet(...a), onNet(...b));

describe('almacenLayout · dos plantas', () => {
  it('cada punto cae en la red de su planta', () => {
    expect(onNet(15.5, 22, 0).z).toBe(0);
    const abajo = onNet(11.6, 15, BAJO.z);
    expect(abajo.z).toBe(BAJO.z);
    expect(abajo.x).toBeCloseTo(11.5);
  });
  it('en la escalera no se para nadie', () => {
    const p = onNet(16.5, 15, 0);
    expect(p.x).toBeCloseTo(15.5);
  });
  it('se baja por la de bajada y se sube por la de subida', () => {
    const baja = ruta([15.5, 23.6, 0], [11.5, 15, BAJO.z]);
    expect(baja.some((p) => p[0] === NODOS.eb2[0] && p[1] === NODOS.eb2[1])).toBe(true);
    expect(baja.some((p) => p[0] === NODOS.es2[0])).toBe(false);
    expect(baja.filter((p) => p[3]).length).toBe(3);
    const sube = ruta([11.5, 15, BAJO.z], [15.5, 23.6, 0]);
    expect(sube.some((p) => p[0] === NODOS.es2[0] && p[1] === NODOS.es2[1])).toBe(true);
    expect(sube.some((p) => p[0] === NODOS.eb2[0])).toBe(false);
    expect(sube.at(-1)[2]).toBe(0);
  });
  it('dentro de la planta de abajo, menos bajo las escaleras', () => {
    expect(dentro(10, 10, BAJO.z)).toBe(true);
    expect(dentro(17, 15, BAJO.z)).toBe(false);
    expect(dentro(22, 10, BAJO.z)).toBe(false);
    expect(dentro(22, 10, 0)).toBe(true);
  });
  it('la altura de la escalera va de la nave a la planta de abajo', () => {
    expect(zEscalera(19.5)).toBe(0);
    expect(zEscalera(11)).toBe(BAJO.z);
    expect(zEscalera(15.2)).toBeCloseTo(BAJO.z / 2, 1);
  });
});
