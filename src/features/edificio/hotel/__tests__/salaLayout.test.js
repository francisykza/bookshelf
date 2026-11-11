// 1.116 · El plano de la sala de lectura en 3D: los pasillos llegan a todos los sitios, los sillones se reparten sin
// pisarse (el tuyo, para ti) y cada libro tiene siempre el mismo lomo.
import { describe, expect, it } from 'vitest';
import { INICIO, NODOS, SILLONES, SITIOS, TONOS_LOMO, dentro, lomoDe, onNet, repartoSillones, route } from '../salaLayout';

describe('la sala de lectura en 3D', () => {
  it('desde la entrada se llega andando a cada sitio de la sala', () => {
    const desde = onNet(INICIO.x, INICIO.y);
    for (const [id, sitio] of Object.entries(SITIOS)) {
      const [x, y] = NODOS[sitio.nudo];
      const ruta = route(desde, onNet(x, y));
      expect(ruta.length, id).toBeGreaterThan(0);
      const [fx, fy] = ruta.at(-1);
      expect(Math.hypot(fx - x, fy - y), id).toBeLessThan(1e-6);
    }
  });

  it('los nudos de los pasillos están en suelo que se pisa', () => {
    for (const [id, [x, y]] of Object.entries(NODOS)) expect(dentro(x, y), id).toBe(true);
  });

  it('te sientas en tu sillón y los demás ocupan los libres, sin repetir', () => {
    const r = repartoSillones(['yo', 'a', 'b'], 'yo', 4);
    expect(r.get('yo')).toBe(4);
    expect(new Set(r.values()).size).toBe(3);
    expect([r.get('a'), r.get('b')]).toEqual([0, 1]);
  });

  it('sin sillón propio, o con más lectores que sillones, nadie se queda con dos', () => {
    const ids = Array.from({ length: SILLONES.length + 2 }, (_, k) => `p${k}`);
    const r = repartoSillones(ids, 'p0', null);
    expect(r.size).toBe(SILLONES.length);
    expect(new Set(r.values()).size).toBe(SILLONES.length);
    expect(repartoSillones(['a'], 'yo', 2).get('a')).toBe(0);
  });

  it('el mismo título da siempre el mismo lomo', () => {
    const a = lomoDe('El faro del fin');
    expect(lomoDe('El faro del fin')).toEqual(a);
    expect(TONOS_LOMO).toContain(a.color);
    expect(a.alto).toBeGreaterThanOrEqual(0.72);
    expect(a.alto).toBeLessThanOrEqual(1);
  });
});
