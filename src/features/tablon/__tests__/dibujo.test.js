import { describe, expect, it } from 'vitest';
import { pinDe, silueta } from '../dibujo';

const celda = (m, x, y) => m[y * 140 + x];

describe('forma recortada de un dibujo', () => {
  const cuadrado = { v: 1, s: [{ c: 0, p: [30, 30, 90, 30, 90, 90, 30, 90, 30, 30] }] };
  const linea = { v: 1, s: [{ c: 0, p: [30, 60, 90, 60] }] };

  it('lo que queda encerrado por un trazo es papel; lo de fuera, no', () => {
    const { encerrado, solido } = silueta(cuadrado);
    expect(celda(encerrado, 70, 70)).toBe(1);
    expect(celda(solido, 70, 70)).toBe(0);
    expect(celda(solido, 5, 5)).toBe(0);
    expect(celda(encerrado, 5, 5)).toBe(0);
  });

  it('una línea abierta no encierra nada y sigue teniendo borde', () => {
    const { encerrado, solido } = silueta(linea);
    expect(encerrado.some(Boolean)).toBe(false);
    expect(celda(solido, 70, 70)).toBe(1);
    expect(celda(solido, 70, 90)).toBe(0);
  });

  it('un trazo pegado al borde de la hoja no se sale del recorte', () => {
    expect(() => silueta({ v: 1, s: [{ c: 0, p: [0, 0, 120, 120] }] })).not.toThrow();
  });

  it('la chincheta va arriba y centrada sobre papel', () => {
    const pin = pinDe(cuadrado);
    expect(pin.x).toBeCloseTo(0.5, 1);
    expect(pin.y).toBeGreaterThan(0.2);
    expect(pin.y).toBeLessThan(0.4);
  });

  it('si el centro está vacío, busca la columna con papel más cercana', () => {
    expect(pinDe({ v: 1, s: [{ c: 0, p: [100, 60] }] }).x).toBeGreaterThan(0.6);
  });
});
