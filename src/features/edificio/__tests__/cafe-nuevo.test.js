// 1.128 (SPEC §128.1): la «!» roja de lo nuevo del café. Lo desbloqueado con cada reputación, la primera vez como visto y
// marcar lo que se ve.
import { beforeEach, describe, expect, it } from 'vitest';
import { desbloqueados, marcarVisto, nuevosDe, vistosDe } from '../cafe/cafeNuevo';
import { umbralHito } from '../cafe/cafeNiveles';

const CLAVE = 'bookshelf:cafe-visto';

describe('cafeNuevo', () => {
  beforeEach(() => {
    const datos = new Map();
    globalThis.localStorage = {
      getItem: (k) => (datos.has(k) ? datos.get(k) : null),
      setItem: (k, v) => datos.set(k, String(v)),
      removeItem: (k) => datos.delete(k),
    };
  });

  it('lo desbloqueado crece con la reputación: muebles, carta y sitios', () => {
    const uno = desbloqueados(0);
    expect(uno.some((k) => k.startsWith('mueble:'))).toBe(true);
    expect(uno).not.toContain('carta:chocolate');
    const dos = desbloqueados(umbralHito(2, 2));
    expect(dos).toContain('carta:chocolate');
    for (const k of uno) expect(dos).toContain(k);
    expect(desbloqueados(umbralHito(5, 1))).toContain('sitio:escaparate');
    expect(desbloqueados(umbralHito(4, 3))).not.toContain('sitio:escaparate');
    expect(desbloqueados(umbralHito(7, 2))).toEqual(expect.arrayContaining(['sitio:trampilla', 'sitio:tostador', 'carta:casa']));
  });

  it('la primera vez, todo lo que ya tenías cuenta como visto (sin «!» de golpe)', () => {
    const rep = umbralHito(3, 2);
    const vistos = vistosDe('cafe', rep);
    expect(nuevosDe(rep, vistos).size).toBe(0);
    expect(JSON.parse(localStorage.getItem(CLAVE)).cafe).toEqual(vistos);
    // Lo que se abre después sí es nuevo
    const nuevos = nuevosDe(umbralHito(4, 2), vistos);
    expect(nuevos.has('carta:vainilla')).toBe(true);
  });

  it('marcar como visto lo quita de lo nuevo y se recuerda', () => {
    const vistos = vistosDe('cafe', 0);
    const rep = umbralHito(2, 2);
    expect(nuevosDe(rep, vistos).has('carta:chocolate')).toBe(true);
    const tras = marcarVisto('cafe', vistos, 'carta:chocolate');
    expect(nuevosDe(rep, tras).has('carta:chocolate')).toBe(false);
    expect(vistosDe('cafe', rep)).toEqual(tras);
    // Marcar lo ya visto no cambia nada
    expect(marcarVisto('cafe', tras, ['carta:chocolate'])).toBe(tras);
  });

  it('sin almacenamiento, no rompe', () => {
    globalThis.localStorage = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
    };
    const v = vistosDe('cafe', 0);
    expect(v.length).toBeGreaterThan(0);
    expect(marcarVisto('cafe', v, 'carta:chocolate')).toContain('carta:chocolate');
  });
});
