// 1.121 · Las reglas de los clientes del café en la app: qué se pide (solo lo que tu estantería puede cumplir, sin repetir
// mientras se pueda), qué encaja, el habitual que pregunta por el último que terminaste, las sesiones que traen habituales
// y el aspecto de los clientes (siempre válido y sin prendas que se ganan). Revisión del 12-11-2026: recetas, estrellas,
// tres fichas para recomendar y el excéntrico del día.
import { describe, expect, it } from 'vitest';
import { isPrenda, validateAvatar } from '../actor';
import {
  EXCENTRICOS,
  HABITUALES,
  PEDIDO_ACERTIJO,
  PEDIDOS,
  PEDIDO_LIBRE,
  aciertosDe,
  aspectoDe,
  clientesDelDia,
  comandaAcertijo,
  comandaClara,
  contextoPedidos,
  estrellasDe,
  librosParaRecomendar,
  pedidoPorId,
  pedidosDelDia,
  pedidosPosibles,
  premio,
  recetaDe,
  recetaPide,
  sesionesDeHoy,
} from '../cafe/cafeClientes';

const libro = (id, extra = {}) => ({
  id,
  title: `Libro ${id}`,
  author: `Autoría ${id}`,
  status: 'read',
  pageCount: 320,
  categories: [],
  publishedDate: '2012',
  finishedAt: '2026-10-01T10:00:00Z',
  ...extra,
});

describe('los clientes del café', () => {
  it('solo se pide lo que la estantería puede cumplir; si no hay nada, «lo que tú me recomiendes»', () => {
    const libros = [libro('a', { categories: ['Fantasy'] }), libro('b', { pageCount: 120 })];
    expect(pedidosPosibles(libros).map((p) => p.id)).toEqual(['fantasia', 'corto', 'ultimo']);
    const dia = { clientes: [1, 2, 3].map((n) => ({ n, semilla: n * 3 })), habituales: [] };
    const { pedidos } = pedidosDelDia(dia, libros, '2026-11-12');
    // tres clientes, tres pedidos distintos
    expect(new Set(Object.values(pedidos).map((p) => p.id)).size).toBe(3);
    expect(pedidosDelDia(dia, [], '2026-11-12').pedidos[1]).toBe(PEDIDO_LIBRE);
    expect(PEDIDO_LIBRE.encaja(libro('x'))).toBe(true);
  });

  it('el autor que más tienes (con 2 o más) y el último que terminaste', () => {
    const libros = [libro('a', { author: 'Elena Faro' }), libro('b', { author: 'Elena Faro', finishedAt: '2026-11-10T10:00:00Z' }), libro('c')];
    const ctx = contextoPedidos(libros);
    expect(ctx).toEqual({ autor: 'Elena Faro', ultimo: 'b' });
    expect(contextoPedidos([libro('a'), libro('b')]).autor).toBeNull();
  });

  it('un habitual pregunta por el que terminaste ayer u hoy', () => {
    const libros = [libro('a', { finishedAt: '2026-11-11T20:00:00Z' }), libro('b', { categories: ['Mystery'] }), libro('c', { categories: ['Fantasy'] }), libro('d', { pageCount: 120 })];
    const dia = { clientes: [{ n: 1, semilla: 0 }], habituales: [{ n: 101, quien: 2, semilla: 3 }] };
    expect(pedidosDelDia(dia, libros, '2026-11-12').pedidos[101].id).toBe('ultimo');
    expect(pedidosDelDia(dia, libros, '2026-11-20').pedidos[101].id).not.toBe('ultimo');
  });

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
    for (const p of [...PEDIDOS, PEDIDO_LIBRE]) expect(PEDIDO_ACERTIJO[p.id]).toBeTruthy();
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

  it('para recomendar, tres fichas: una encaja si alguna puede, y no siempre la primera', () => {
    const libros = [libro('a', { categories: ['Fantasy'] }), libro('b', { pageCount: 120 }), libro('c', { pageCount: 600 }), libro('d'), libro('e'), libro('f')];
    const ctx = contextoPedidos(libros);
    const posiciones = new Set();
    for (const semilla of [0, 1, 2, 3, 4, 5, 6, 7, 8]) {
      const tres = librosParaRecomendar(pedidoPorId('fantasia'), libros, ctx, semilla);
      expect(tres).toHaveLength(3);
      expect(new Set(tres).size).toBe(3);
      expect(tres.filter((b) => b.id === 'a')).toHaveLength(1);
      posiciones.add(tres.findIndex((b) => b.id === 'a'));
    }
    expect(posiciones.size).toBeGreaterThan(1);
    expect(librosParaRecomendar(pedidoPorId('fantasia'), libros.slice(0, 2), ctx, 0)).toHaveLength(2);
  });
});
