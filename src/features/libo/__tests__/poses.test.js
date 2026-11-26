import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { POSES, gestoEnCalma, muchosToques, poseAlHablar, poseDelPaso, poseEnReposo, poseUrl, reaccionALectura } from '../poses';

describe('las poses de Libo', () => {
  it('cada pose tiene su imagen recortada', () => {
    for (const p of POSES) expect(existsSync(`public${poseUrl(p)}`), p).toBe(true);
    expect(poseUrl('inventada')).toBe('/assets/libo/poses/de-pie.webp');
  });

  it('sin tocar nada, primero lee y luego se duerme; con «Solo cuando le llamo», lee desde el principio', () => {
    expect(poseEnReposo({ quieto: 0 })).toBe('de-pie');
    expect(poseEnReposo({ quieto: 30 })).toBe('lee');
    expect(poseEnReposo({ quieto: 30, gatito: true })).toBe('gatito');
    expect(poseEnReposo({ quieto: 90 })).toBe('duerme');
    expect(poseEnReposo({ modo: 'llamar', quieto: 0, gatito: true })).toBe('lee');
  });

  it('al hablar, la pose va con lo que cuenta', () => {
    expect(poseAlHablar({})).toBe('saluda');
    expect(poseAlHablar({ avisos: [{ id: 'correo' }] })).toBe('sorpresa');
    expect(poseAlHablar({ sugerencia: { id: 'resena:1' } })).toBe('abraza');
    expect(poseAlHablar({ sugerencia: { id: 'parado:1' } })).toBe('duda');
    expect(poseAlHablar({ sugerencia: { id: 'idea:registrar' } })).toBe('duda');
    expect(poseAlHablar({ sugerencia: { id: 'ver:cafe' } })).toBe('camina');
    expect(poseAlHablar({ sugerencia: { id: 'vacia' } })).toBe('saluda');
  });

  it('en la guía saluda, acompaña y celebra el final', () => {
    expect([0, 1, 2, 3].map((i) => poseDelPaso(i, 4))).toEqual(['saluda', 'camina', 'de-pie', 'celebra']);
  });

  it('celebra lo que acabas de leer, no lo que trae la nube al arrancar', () => {
    expect(reaccionALectura(null, { terminados: 1, registros: 1 })).toBe(null);
    expect(reaccionALectura({ terminados: 3, registros: 10 }, { terminados: 3, registros: 11 })).toBe('celebra');
    expect(reaccionALectura({ terminados: 3, registros: 10 }, { terminados: 4, registros: 11 })).toBe('abraza');
    expect(reaccionALectura({ terminados: 0, registros: 0 }, { terminados: 20, registros: 300 })).toBe(null);
    expect(reaccionALectura({ terminados: 3, registros: 10 }, { terminados: 3, registros: 10 })).toBe(null);
  });

  it('muchos toques seguidos', () => {
    expect(muchosToques([0, 500, 900, 1400], 1500)).toBe(true);
    expect(muchosToques([0, 500, 900], 1500)).toBe(false);
    expect(muchosToques([0, 100, 200, 300], 5000)).toBe(false);
  });

  it('en calma hace gestos pequeños, pero no dormido ni a mitad de otra cosa', () => {
    expect(gestoEnCalma('de-pie', 0.2)).toBe('salta');
    expect(gestoEnCalma('de-pie', 0.8)).toBe('mira');
    expect(gestoEnCalma('lee', 0.2)).toBe('mira');
    for (const p of ['duerme', 'gatito', 'celebra', 'corre', 'saluda']) expect(gestoEnCalma(p, 0.2)).toBe(null);
  });
});
