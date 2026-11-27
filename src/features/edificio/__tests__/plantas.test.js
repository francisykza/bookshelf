// 1.152 · El edificio de 3 a 5 plantas en el cliente: cuántas plantas tiene, sus puertas en orden y lo que sube con ellas.
import { describe, expect, it } from 'vitest';
import { FLATS, alturas, plantasValidas, puertasDe } from '../facade';
import { doorsOf, plantasDe } from '../service';

describe('las plantas del edificio en el cliente', () => {
  it('3 de estreno, como mucho 5; las del servidor mandan y, sin ellas, las del vecino más alto', () => {
    expect(plantasDe([{ puerta: '1A' }])).toBe(3);
    expect(plantasDe([{ puerta: '1A' }, { puerta: '4B' }])).toBe(4);
    expect(plantasDe([{ puerta: '1A' }], 5)).toBe(5);
    expect(plantasDe([], 9)).toBe(5);
    expect(plantasValidas('4')).toBe(4);
    expect(plantasValidas(undefined)).toBe(3);
  });

  it('las puertas, de arriba abajo y la A antes que la B', () => {
    expect(puertasDe(3)).toEqual(['3A', '3B', '2A', '2B', '1A', '1B']);
    expect(puertasDe(5).slice(0, 2)).toEqual(['5A', '5B']);
    expect(puertasDe(5)).toHaveLength(10);
    const vecinos = [{ puerta: '4A', alias: 'Ana' }];
    const puertas = doorsOf(vecinos, 4);
    expect(puertas.map((d) => d.puerta)).toEqual(puertasDe(4));
    expect(puertas[0].vecino.alias).toBe('Ana');
    expect(puertas.filter((d) => d.vecino)).toHaveLength(1);
  });

  it('con cada planta, la azotea y el cartel suben lo mismo; los pisos de siempre no cambian de sitio', () => {
    const tres = alturas(3);
    const cinco = alturas(5);
    expect(cinco.TOP - tres.TOP).toBeCloseTo(cinco.SIGN_Z1 - tres.SIGN_Z1);
    expect(cinco.TOP).toBeGreaterThan(tres.TOP);
    expect(FLATS).toHaveLength(10);
    // El cristal de cada piso es GLASS_ID + su índice: los seis de antes siguen en su sitio
    expect(FLATS.slice(0, 6).map((f) => f.puerta)).toEqual(['1A', '1B', '2A', '2B', '3A', '3B']);
  });
});
