import { describe, expect, it } from 'vitest';
import { ALTURAS, LAYERS, PX_PER_CELL, colOf, layerMargins, layerPlane, layerSize, rowOf } from '../exteriorLayout';

// El sillón del piso de prueba frente a su ventana: 5,25 celdas de la pared, y el hueco de 3,2 a 4,8
const eye = { s: 3.3, z: 1.85, d: 5.25 };
const pane = { s0: 3.2, s1: 4.8, z0: 1.5, z1: 3.2 };
const centre = 4;

describe('capas del exterior', () => {
  it('están ordenadas de cerca a lejos y son pequeñas', () => {
    expect(LAYERS.near.depth).toBeLessThan(LAYERS.mid.depth);
    expect(LAYERS.mid.depth).toBeLessThan(LAYERS.far.depth);
    const texels = Object.keys(LAYERS).reduce((sum, name) => sum + layerSize(name)[0] * layerSize(name)[1], 0);
    // Menos que el único lienzo de 512 × 512 de antes
    expect(texels).toBeLessThan(512 * 512);
  });

  it('desde el sillón, las tres se alinean sobre la pared', () => {
    for (const name of Object.keys(LAYERS)) {
      const plane = layerPlane(name, eye, centre);
      const k = eye.d / (eye.d + plane.depth);
      expect(eye.s + (plane.s - eye.s) * k).toBeCloseTo(centre, 5);
      expect(plane.width * k).toBeCloseTo(LAYERS[name].wide, 5);
    }
  });

  it('con todo el giro no se ve el final de ninguna capa', () => {
    // La cabeza se mueve 0,06 celdas a cada lado (`yaw * 0.1`)
    const eyes = [-0.06, 0, 0.06].map((shift) => ({ ...eye, s: eye.s + shift }));
    for (const name of Object.keys(LAYERS)) {
      const m = layerMargins(name, layerPlane(name, eye, centre), pane, eyes);
      // La cercana y la media no tienen nada arriba: por ahí su lámina es transparente
      const sides = name === 'far' ? [m.left, m.right, m.top, m.bottom] : [m.left, m.right, m.bottom];
      for (const side of sides) expect(side).toBeGreaterThan(0);
    }
  });

  it('avisa si un ojo llega a ver el final de una capa', () => {
    const m = layerMargins('near', layerPlane('near', eye, centre), pane, [{ s: -30, z: 1.85, d: 5.25 }]);
    expect(m.right).toBeLessThan(0);
  });

  it('filas y columnas parten del borde del lienzo', () => {
    expect(rowOf('far', LAYERS.far.z1)).toBe(0);
    expect(rowOf('far', LAYERS.far.z0)).toBe(layerSize('far')[1]);
    expect(colOf('far', 0)).toBe(Math.round((LAYERS.far.wide / 2) * PX_PER_CELL));
  });

  it('cuanto más alta la planta, más bajos quedan los tejados', () => {
    expect(ALTURAS[1].roofGap).toBeLessThan(ALTURAS[2].roofGap);
    expect(ALTURAS[2].roofGap).toBeLessThan(ALTURAS[3].roofGap);
  });
});
