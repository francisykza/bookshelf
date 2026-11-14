// 1.121 · Las reglas de los clientes del café en la app: qué se pide (solo lo que tu estantería puede cumplir, sin repetir
// mientras se pueda), qué encaja, el habitual que pregunta por el último que terminaste, las sesiones que traen habituales
// y el aspecto de los clientes (siempre válido y sin prendas que se ganan). Revisión del 12-11-2026: recetas, estrellas,
// tres fichas para recomendar y el excéntrico del día. 1.130: los pedidos de libro salen de la balda (cafeLibreria.test.js).
import { describe, expect, it } from 'vitest';
import { isPrenda, validateAvatar } from '../actor';
import {
  EXCENTRICOS,
  HABITUALES,
  aciertosDe,
  aspectoDe,
  clientesDelDia,
  comandaAcertijo,
  comandaClara,
  estrellasDe,
  premio,
  recetaDe,
  recetaPide,
  sesionesDeHoy,
} from '../cafe/cafeClientes';

describe('los clientes del café', () => {
  it('las sesiones de hoy: lectura cozy de 15 min o más y el registro de hoy, como mucho 2', () => {
    const hoy = '2026-11-12';
    const at = new Date('2026-11-12T10:00:00').toISOString();
    expect(sesionesDeHoy({ pomodoros: [{ at, minutes: 10 }], readingLog: [] }, hoy)).toBe(0);
    expect(sesionesDeHoy({ pomodoros: [{ at, minutes: 25 }], readingLog: [] }, hoy)).toBe(1);
    expect(sesionesDeHoy({ pomodoros: [], readingLog: [{ date: hoy, pages: 12 }] }, hoy)).toBe(1);
    expect(
      sesionesDeHoy(
        {
          pomodoros: [
            { at, minutes: 25 },
            { at, minutes: 30 },
          ],
          readingLog: [{ date: hoy, pages: 5 }],
        },
        hoy,
      ),
    ).toBe(2);
    expect(sesionesDeHoy({ pomodoros: [], readingLog: [{ date: '2026-11-11', pages: 5 }] }, hoy)).toBe(0);
  });

  it('el aspecto de cada cliente es válido y sin prendas que se ganan; los habituales, también', () => {
    for (const s of [0, 1, 17, 999, 123456, 999999]) {
      const a = aspectoDe(s);
      expect(validateAvatar(a)).toBeTruthy();
      expect(Object.entries(a).some(([k, v]) => isPrenda(k, v))).toBe(false);
    }
    for (const h of HABITUALES) expect(Object.entries(h.avatar).some(([k, v]) => isPrenda(k, v))).toBe(false);
    const lista = clientesDelDia({ clientes: [{ n: 1, semilla: 4, servido: false }], habituales: [{ n: 101, quien: 3, semilla: 2, servido: true }] }, {});
    // Sin pedido de libro (la balda vacía): solo el café
    expect(lista.every((c) => c.pedido.id === 'nada')).toBe(true);
    expect(lista.map((c) => [c.n, c.nombre, c.habitual])).toEqual([
      [1, 'Cliente', false],
      [101, 'Marga', true],
    ]);
    for (const e of EXCENTRICOS) {
      expect(validateAvatar(e.avatar)).toBeTruthy();
      expect(Object.entries(e.avatar).some(([k, v]) => isPrenda(k, v))).toBe(false);
    }
  });

  it('la receta: cuatro partes que salen de la semilla; los habituales, siempre la misma; comandas clara y en acertijo', () => {
    const vistas = new Set();
    for (let r = 0; r < 36; r += 1) vistas.add(recetaDe(r).join());
    expect(vistas.size).toBe(36);
    expect(recetaPide({ n: 1, semilla: 13456 })).toEqual(recetaDe(13));
    expect(recetaPide({ n: 101, quien: 3, semilla: 1 })).toEqual(recetaPide({ n: 102, quien: 3, semilla: 999 }));
    expect(comandaClara(['cafe', 'intenso', 'avena', 'canela'])).toBe('Un café intenso con leche de avena y canela.');
    expect(comandaClara(['te', 'suave', 'sin', 'nada'])).toBe('Un té suave sin leche.');
    expect(comandaAcertijo(['te', 'suave', 'sin', 'nada'])).toHaveLength(4);
  });

  it('estrellas: fallar paga menos, nunca cero; el excéntrico bordado, el triple', () => {
    expect(aciertosDe(['cafe', 'suave', 'sin', 'miel'], ['cafe', 'suave', 'avena', 'miel'])).toBe(3);
    expect(estrellasDe(4, true)).toBe(3);
    expect(estrellasDe(4, false)).toBe(2);
    expect(estrellasDe(2, true)).toBe(2);
    expect(estrellasDe(0, false)).toBe(1);
    expect(premio('cliente', 3)).toEqual({ granos: 5, reputacion: 14 });
    expect(premio('cliente', 1).granos).toBeGreaterThan(0);
    expect(premio('excentrico', 3)).toEqual({ granos: 15, reputacion: 40 });
    expect(premio('excentrico', 3).granos).toBe(premio('cliente', 3).granos * 3);
  });
});
