// 1.134 · El almacén en el ordenador: lo nuevo, las ofertas de hoy y lo ya visto; 1.135, lo que sigues (docs/qa/almacen-ordenador.md).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ARTICULOS } from '../almacenLayout';
import { TALLERES } from '../../talleres';
import {
  DE_SIEMPRE,
  DIAS_NUEVO,
  EN_TARJETA,
  LLEGADAS,
  TOPE_DESEADOS,
  avisosDe,
  claveOferta,
  diasEntre,
  fechaCorta,
  hastaOferta,
  lunesDe,
  marcarMonitor,
  marcarVistos,
  monitorPendiente,
  nuevosDelAlmacen,
  resumenAlmacen,
  sePuedeSeguir,
  vistosDelAlmacen,
} from '../almacenAvisos';

const HEROES = ['sillon-capa', 'estanteria-comics', 'foco-heroe', 'maniqui-capa', 'cartel-vinetas', 'neon-rayo'];
// 1.149: las cuatro habitaciones del ala nueva, con sus veinte muebles (llegan el día que se publican)
const ALA_NUEVA = TALLERES.filter((t) => ['lumbre', 'invernadero', 'octubre', 'medianoche'].includes(t.id)).flatMap((t) => t.muebles);
const estado = (extra = {}) => ({ dia: '2026-11-15', vuelve: 1, semana_hasta: 2, tickets: 120, ofertas: [], ...extra });

describe('almacenAvisos · llegadas', () => {
  it('todo lo que vende el almacén es de siempre o tiene su fecha de llegada (y no las dos cosas)', () => {
    for (const a of ARTICULOS) expect(DE_SIEMPRE.has(a.id) !== Boolean(LLEGADAS[a.id]), a.id).toBe(true);
    for (const d of Object.values(LLEGADAS)) expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it('un mueble es nuevo durante 30 días desde que llega', () => {
    expect(DIAS_NUEVO).toBe(30);
    expect(diasEntre('2026-11-10', '2026-12-10')).toBe(30);
    expect(nuevosDelAlmacen('2026-11-09')).toEqual([]);
    expect(
      nuevosDelAlmacen('2026-11-10')
        .map((n) => n.id)
        .sort(),
    ).toEqual([...HEROES].sort());
    expect(nuevosDelAlmacen('2026-12-09')).toHaveLength(6 + ALA_NUEVA.length);
    expect(
      nuevosDelAlmacen('2026-12-10')
        .map((n) => n.id)
        .sort(),
    ).toEqual([...ALA_NUEVA].sort());
    expect(nuevosDelAlmacen('2026-12-26')).toEqual([]);
    expect(nuevosDelAlmacen('mañana')).toEqual([]);
  });
  it('dice la fecha en corto', () => {
    expect(fechaCorta('2026-11-10')).toBe('10 de noviembre');
    expect(fechaCorta('')).toBe('');
  });
});

describe('almacenAvisos · ofertas de hoy', () => {
  it('hasta cuándo vale cada una, con las palabras del almacén', () => {
    expect(hastaOferta('dia', estado())).toBe('hasta medianoche');
    expect(hastaOferta('semana', estado())).toBe('hasta el domingo');
    expect(hastaOferta('semana', estado({ semana_hasta: 1 }))).toBe('hasta medianoche');
  });
  it('la de la semana primero, con el precio del servidor; lo especial nunca se rebaja y lo desconocido se ignora', () => {
    const r = resumenAlmacen(
      estado({
        ofertas: [
          { id: 'mesa', pct: 20, tipo: 'dia' },
          { id: 'reloj', pct: 50, tipo: 'semana' },
          { id: 'sillon-capa', pct: 20, tipo: 'dia' },
          { id: 'sofa-volador', pct: 20, tipo: 'dia' },
        ],
      }),
      HEROES,
    );
    expect(r.ofertas.map((o) => [o.id, o.precio, o.hoy, o.oferta.tipo])).toEqual([
      ['reloj', 40, 20, 'semana'],
      ['mesa', 20, 16, 'dia'],
    ]);
    expect(r.todos.find((t) => t.id === 'sillon-capa')).toMatchObject({ especial: true, oferta: null, hoy: 80 });
    expect(r.tickets).toBe(120);
  });
  it('sin estado (sin la migración o sin conexión), nada', () => {
    expect(resumenAlmacen(null)).toBeNull();
    expect(resumenAlmacen({ ofertas: [] })).toBeNull();
  });
});

describe('almacenAvisos · la tarjeta y la «!»', () => {
  it('primero lo nuevo sin ver, luego las ofertas, sin repetir y como mucho tres', () => {
    const r = resumenAlmacen(
      estado({
        ofertas: [
          { id: 'mesa', pct: 20, tipo: 'dia' },
          { id: 'reloj', pct: 50, tipo: 'semana' },
        ],
      }),
      HEROES.slice(2),
    );
    expect([...r.sinVer].sort()).toEqual(['estanteria-comics', 'sillon-capa']);
    expect(r.tarjeta.map((t) => [t.id, t.motivo])).toEqual([
      ['sillon-capa', 'nuevo'],
      ['estanteria-comics', 'nuevo'],
      ['reloj', 'oferta'],
    ]);
    expect(r.tarjeta).toHaveLength(EN_TARJETA);
  });
  it('con todo visto, la tarjeta son las ofertas y los nuevos siguen en su apartado sin «!»', () => {
    const r = resumenAlmacen(estado({ ofertas: [{ id: 'mesa', pct: 20, tipo: 'dia' }] }), HEROES);
    expect(r.sinVer.size).toBe(0);
    expect(r.nuevos).toHaveLength(6);
    expect(r.nuevos.every((n) => !n.sinVer)).toBe(true);
    expect(r.tarjeta.map((t) => t.id)).toEqual(['mesa']);
  });
});

describe('almacenAvisos · lo visto', () => {
  let guardado;
  beforeEach(() => {
    guardado = new Map();
    globalThis.localStorage = { getItem: (k) => guardado.get(k) ?? null, setItem: (k, v) => guardado.set(k, String(v)), removeItem: (k) => guardado.delete(k) };
  });
  afterEach(() => {
    delete globalThis.localStorage;
  });
  it('la primera vez se da por visto lo que ya era nuevo', () => {
    expect(vistosDelAlmacen('2026-11-15').nuevos.sort()).toEqual([...HEROES].sort());
    expect(resumenAlmacen(estado(), vistosDelAlmacen('2026-11-15')).sinVer.size).toBe(0);
  });
  it('lo que llega después sí lleva la «!» hasta verlo, y lo que deja de ser nuevo se olvida', () => {
    guardado.set('bookshelf:almacen-visto', JSON.stringify({ nuevos: [] }));
    expect(resumenAlmacen(estado(), vistosDelAlmacen('2026-11-15')).sinVer.size).toBe(6);
    expect(marcarVistos(['neon-rayo', 'sofa-volador'], '2026-11-15').nuevos).toEqual(['neon-rayo']);
    expect(resumenAlmacen(estado(), vistosDelAlmacen('2026-11-15')).sinVer.has('neon-rayo')).toBe(false);
    expect(marcarVistos([], '2026-12-20').nuevos).toEqual([]);
  });
  it('lee lo que guardaba la 1.134 (solo la lista de nuevos)', () => {
    guardado.set('bookshelf:almacen-visto', JSON.stringify({ nuevos: ['neon-rayo'] }));
    expect(vistosDelAlmacen('2026-11-15')).toEqual({ nuevos: ['neon-rayo'], ofertas: [], monitor: [] });
    expect(resumenAlmacen(estado(), ['neon-rayo']).sinVer.size).toBe(5);
  });
  it('marcar algo sin haber abierto nunca el ordenador (desde el almacén) parte de la base', () => {
    expect(marcarVistos([], '2026-11-15', ['mesa@2026-11-15'])).toMatchObject({ ofertas: ['mesa@2026-11-15'] });
    expect(vistosDelAlmacen('2026-11-15').nuevos.sort()).toEqual([...HEROES].sort());
  });
  it('sin almacenamiento no falla', () => {
    delete globalThis.localStorage;
    expect(vistosDelAlmacen('2026-11-15').nuevos).toHaveLength(6);
    expect(() => marcarVistos(['neon-rayo'], '2026-11-15', ['reloj@2026-11-09'])).not.toThrow();
  });
});

describe('almacenAvisos · lo que sigues (1.135)', () => {
  let guardado;
  beforeEach(() => {
    guardado = new Map();
    globalThis.localStorage = { getItem: (k) => guardado.get(k) ?? null, setItem: (k, v) => guardado.set(k, String(v)), removeItem: (k) => guardado.delete(k) };
  });
  afterEach(() => {
    delete globalThis.localStorage;
  });
  const OFERTAS = [
    { id: 'reloj', pct: 50, tipo: 'semana' },
    { id: 'mesa', pct: 20, tipo: 'dia' },
    { id: 'sillon', pct: 20, tipo: 'dia' },
  ];
  const TODO_VISTO = { nuevos: HEROES, ofertas: [], monitor: [] };

  it('se sigue lo que vende el almacén, nunca lo de las habitaciones especiales; tope de 40', () => {
    expect(TOPE_DESEADOS).toBe(40);
    expect(sePuedeSeguir('mesa')).toBe(true);
    expect(sePuedeSeguir('reloj')).toBe(true);
    for (const id of [...HEROES, ...ALA_NUEVA]) expect(sePuedeSeguir(id), id).toBe(false);
    expect(sePuedeSeguir('sofa-volador')).toBe(false);
    expect(ARTICULOS.filter((a) => sePuedeSeguir(a.id))).toHaveLength(ARTICULOS.length - HEROES.length - ALA_NUEVA.length);
  });

  it('una oferta se reconoce por su día, o por el lunes de su semana', () => {
    expect(lunesDe('2026-11-15')).toBe('2026-11-09');
    expect(lunesDe('2026-11-16')).toBe('2026-11-16');
    expect(lunesDe('2026-11-11')).toBe('2026-11-09');
    expect(claveOferta('reloj', 'semana', '2026-11-15')).toBe('reloj@2026-11-09');
    expect(claveOferta('mesa', 'dia', '2026-11-15')).toBe('mesa@2026-11-15');
  });

  it('sin la migración no se puede seguir nada (y nada falla)', () => {
    const r = resumenAlmacen(estado({ ofertas: OFERTAS }), TODO_VISTO);
    expect(r.deseables).toBe(false);
    expect(r.deseados).toEqual([]);
    expect(r.ofertasSinVer).toEqual([]);
  });

  it('lo que sigues, con su precio de hoy; lo rebajado lleva la «!» hasta verlo, una vez por oferta', () => {
    const e = estado({ ofertas: OFERTAS, deseados: ['mapa', 'mesa', 'reloj', 'sillon-capa', 'nada'] });
    const r = resumenAlmacen(e, TODO_VISTO);
    expect(r.deseables).toBe(true);
    // Lo especial y lo desconocido no se siguen aunque lleguen
    expect(r.deseados.map((m) => m.id)).toEqual(['mapa', 'mesa', 'reloj']);
    const mapa = r.deseados.find((m) => m.id === 'mapa');
    expect(mapa).toMatchObject({ oferta: null, hoy: mapa.precio, sigo: true, sinVer: false });
    expect(r.deseados.find((m) => m.id === 'reloj')).toMatchObject({ oferta: { pct: 50, tipo: 'semana' }, hoy: 20, precio: 40, sinVer: true, clave: 'reloj@2026-11-09' });
    expect(r.ofertasSinVer.sort()).toEqual(['mesa@2026-11-15', 'reloj@2026-11-09']);
    // La de la semana primero entre lo rebajado
    expect(r.rebajados.map((m) => m.id)).toEqual(['reloj', 'mesa']);
    // En todas las listas, la misma «!» y la misma marca de seguido
    expect(r.ofertas.find((m) => m.id === 'mesa')).toMatchObject({ sigo: true, sinVer: true });
    expect(r.ofertas.find((m) => m.id === 'sillon')).toMatchObject({ sigo: false, sinVer: false });
    expect(r.todos.find((m) => m.id === 'mapa')).toMatchObject({ sigo: true, sinVer: false });

    // Visto el reloj: solo la mesa sigue avisando
    marcarVistos([], '2026-11-15', ['reloj@2026-11-09']);
    expect(resumenAlmacen(e, vistosDelAlmacen('2026-11-15')).ofertasSinVer).toEqual(['mesa@2026-11-15']);
    // El lunes, otra semana: si el reloj vuelve a estar de oferta, vuelve a avisar; lo de la semana pasada se olvida
    const lunes = estado({ dia: '2026-11-16', ofertas: [{ id: 'reloj', pct: 50, tipo: 'semana' }], deseados: ['reloj'] });
    expect(resumenAlmacen(lunes, vistosDelAlmacen('2026-11-16')).ofertasSinVer).toEqual(['reloj@2026-11-16']);
    expect(marcarVistos([], '2026-11-16').ofertas).toEqual([]);
  });

  it('la tarjeta: lo que sigues rebajado primero (lo no visto antes), luego lo nuevo sin ver, luego las ofertas', () => {
    const e = estado({ ofertas: OFERTAS, deseados: ['mesa', 'reloj'] });
    const vistos = { nuevos: HEROES.slice(1), ofertas: ['reloj@2026-11-09'], monitor: [] };
    const r = resumenAlmacen(e, vistos);
    expect(r.tarjeta.map((m) => [m.id, m.motivo, m.sinVer])).toEqual([
      ['mesa', 'sigues', true],
      ['reloj', 'sigues', false],
      ['sillon-capa', 'nuevo', true],
    ]);
    expect(r.tarjeta).toHaveLength(EN_TARJETA);
  });

  it('la «!» del monitor: solo por lo que avisa, y se apaga al abrir el ordenador hasta que haya algo más', () => {
    const e = estado({ ofertas: OFERTAS, deseados: ['mesa'] });
    guardado.set('bookshelf:almacen-visto', JSON.stringify(TODO_VISTO));
    let r = resumenAlmacen(e, vistosDelAlmacen('2026-11-15'));
    expect(avisosDe(r)).toEqual(['o:mesa@2026-11-15']);
    expect(monitorPendiente(r, vistosDelAlmacen('2026-11-15'))).toBe(true);
    marcarMonitor(r);
    expect(monitorPendiente(r, vistosDelAlmacen('2026-11-15'))).toBe(false);
    // Sigues otro que está rebajado: vuelve a encenderse
    r = resumenAlmacen({ ...e, deseados: ['mesa', 'sillon'] }, vistosDelAlmacen('2026-11-15'));
    expect(monitorPendiente(r, vistosDelAlmacen('2026-11-15'))).toBe(true);
    // Sin nada que avisar, apagado
    expect(monitorPendiente(resumenAlmacen(estado(), TODO_VISTO), TODO_VISTO)).toBe(false);
    expect(monitorPendiente(null, TODO_VISTO)).toBe(false);
  });
});
