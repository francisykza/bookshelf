// 1.125 · El café-librería del bajo, bloque 6a (la bodega, nivel 6), en un Postgres real (PGlite) con todas las migraciones: las
// cifras del nivel 6 son las de la app (desde 10.000, 80 tickets, 48 huecos, sus hitos y 20 granos en el 3.º); la cuadrícula de
// la bodega (columnas 0 a 4, filas 20 a 24) solo desde el nivel 6, con 40 cosas; los asientos de abajo cuentan y vienen hasta 8
// clientes; y al subir al 6 se cobra una vez, con sus hitos.
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers } from '../../social/__tests__/supabaseHarness';
import { recetaPide } from '../cafe/cafeClientes';
import { ASIENTOS, CAFE_NIVELES, SOTANO, asientosDe, casillaValida, maxCosas } from '../cafe/cafeCatalogo';
import { clientesDelNivel } from '../cafe/cafeClientes';
import { HUECOS, TICKETS_NIVEL, cartaDe, granosHito, nivelDe, novedades, ticketsDelDia, umbralHito } from '../cafe/cafeNiveles';

let db;
let A;
let hoy;
const call = (u, sql, params) => as(db, u, (q) => q(sql, params)).then((r) => Object.values(r[0])[0]);
const valido = (plano, nivel) => db.query('select cafe_plano_valido($1::jsonb, $2) v', [JSON.stringify(plano), nivel]).then((r) => r.rows[0].v);
const abajo = (n) => Array.from({ length: n }, (_, k) => ({ uid: `b${k}`, id: 'cafe-silla', x: k % 5, y: SOTANO.y0 + Math.floor(k / 5), rot: 0 }));

beforeAll(async () => {
  db = await createDatabase();
  [A] = await createUsers(db, 1);
  await as(db, A, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ('Lectora', 'gato-lector', true)"));
  await as(db, A, (q) => q('select asignar_edificio()'));
  await call(A, 'select cafe_mio()');
  await call(A, 'select cafe_inaugurar($1)', ['Taza y Lomo']);
  hoy = (await db.query('select cafe_hoy()::text as h')).rows[0].h;
}, 60000);

describe('el café-librería del bajo, bloque 6a: la bodega', () => {
  it('las cifras del nivel 6 son las de la app; los niveles 1 a 5 no cambian', async () => {
    expect(CAFE_NIVELES.at(-1)).toMatchObject({ nivel: 6, desde: 10000 });
    for (const n of [1, 2, 3, 4, 5, 6]) {
      const q = (await db.query('select cafe_nivel_desde($1) d, cafe_tickets_nivel($1) t, cafe_tickets_dia($1) td, cafe_huecos($1) h, cafe_granos_hito($1) g', [n])).rows[0];
      expect(q).toEqual({ d: CAFE_NIVELES[n - 1].desde, t: TICKETS_NIVEL[n], td: ticketsDelDia(n), h: HUECOS[n], g: granosHito(n) });
      for (const k of [1, 2, 3]) expect((await db.query('select cafe_hito_umbral($1, $2) u', [n, k])).rows[0].u).toBe(umbralHito(n, k));
    }
    expect([TICKETS_NIVEL[6], HUECOS[6], granosHito(5), granosHito(6), ticketsDelDia(6)]).toEqual([80, 48, 15, 20, 5]);
    // Los hitos del 5 siguen donde estaban; los del 6, a 11.250, 12.500 y 13.750
    expect([1, 2, 3].map((k) => umbralHito(5, k))).toEqual([6250, 7500, 8750]);
    expect([1, 2, 3].map((k) => umbralHito(6, k))).toEqual([11250, 12500, 13750]);
    for (const r of [5000, 9999, 10000, 13750, 20000, 99999]) {
      const q = (await db.query('select cafe_nivel_de($1) n, cafe_carta($1) c', [r])).rows[0];
      expect(q).toEqual({ n: nivelDe(r), c: cartaDe(r) });
    }
    expect(nivelDe(99999)).toBe(6);
  });

  it('la cuadrícula de la bodega, la misma en la app y en el servidor, y solo desde el nivel 6', async () => {
    for (const nivel of [5, 6])
      for (let y = -4; y <= 27; y += 1)
        for (let x = -4; x <= 10; x += 1) expect((await db.query('select cafe_casilla_valida($1, $2, $3) v', [x, y, nivel])).rows[0].v, `${x},${y} nivel ${nivel}`).toBe(casillaValida(x, y, nivel));
    expect(await valido({ v: 1, items: abajo(3) }, 5)).toBe(false);
    expect(await valido({ v: 1, items: abajo(3) }, 6)).toBe(true);
    // Una estantería de 2 no puede asomar fuera de la bodega (columna 5), ni solaparse
    expect(await valido({ v: 1, items: [{ uid: 'e', id: 'cafe-estanteria', x: 4, y: 21, rot: 0 }] }, 6)).toBe(false);
    expect(await valido({ v: 1, items: [{ uid: 'e', id: 'cafe-banco-bodega', x: 0, y: 24, rot: 0 }, { uid: 'f', id: 'cafe-barrica', x: 1, y: 24, rot: 0 }] }, 6)).toBe(false);
    // 40 cosas desde el nivel 6 (25 abajo y 15 arriba); 41, no
    const arriba = Array.from({ length: 15 }, (_, k) => ({ uid: `a${k}`, id: 'cafe-silla', x: k % 6, y: Math.floor(k / 6), rot: 0 }));
    const cuarenta = { v: 1, items: [...abajo(25), ...arriba] };
    expect(maxCosas(6)).toBe(40);
    expect(await valido(cuarenta, 6)).toBe(true);
    expect(await valido({ v: 1, items: [...cuarenta.items, { uid: 'z', id: 'cafe-silla', x: 5, y: 5, rot: 0 }] }, 6)).toBe(false);
    // Números de dos cifras, pero no de tres
    expect(await valido({ v: 1, items: [{ uid: 'e', id: 'cafe-silla', x: 0, y: 120, rot: 0 }] }, 6)).toBe(false);
  });

  it('los asientos de la bodega cuentan: hasta 8 clientes al día en el nivel 6', async () => {
    expect(ASIENTOS['cafe-banco-bodega']).toBe(2);
    const plano = { v: 1, items: [...abajo(3), { uid: 'bb', id: 'cafe-banco-bodega', x: 0, y: 23, rot: 0 }] };
    expect((await db.query('select cafe_asientos($1::jsonb) n', [JSON.stringify(plano)])).rows[0].n).toBe(asientosDe(plano));
    for (const asientos of [0, 4, 5, 6, 7, 8, 9, 14]) expect((await db.query('select cafe_clientes_dia(6, $1) n', [asientos])).rows[0].n).toBe(clientesDelNivel(6, asientos));
    expect(clientesDelNivel(6, 20)).toBe(8);
    expect(clientesDelNivel(5, 20)).toBe(7);
  });

  it('subir al nivel 6 en un servicio: 80 tickets una vez, sus hitos y 20 granos en el 3.º; vienen 8 si hay asientos', async () => {
    // A llega al nivel 5 con todo cobrado y, con 8 asientos (5 arriba y 3 abajo), sube al 6 en el primer servicio
    await db.query('update cafe_locales set nivel = 5, reputacion = 9000 where user_id = $1', [A]);
    const plano = { v: 1, items: [...abajo(3), ...Array.from({ length: 5 }, (_, k) => ({ uid: `a${k}`, id: 'cafe-silla', x: k, y: 0, rot: 0 }))] };
    await db.query('update cafe_locales set plano = $2::jsonb, reputacion = 13740 where user_id = $1', [A, JSON.stringify(plano)]);
    // Lo de los niveles 1 a 5, ya cobrado (como quien llega jugando)
    for (let n = 1; n <= 5; n += 1) {
      await db.query('insert into cafe_niveles_cobrados (user_id, nivel, tickets) values ($1, $2, 0) on conflict do nothing', [A, n]);
      for (const k of [1, 2, 3]) await db.query('insert into cafe_hitos (user_id, nivel, hito) values ($1, $2, $3) on conflict do nothing', [A, n, k]);
    }
    const t0 = (await db.query('select tickets from piso_cuentas where user_id = $1', [A])).rows[0].tickets;
    const d = await call(A, 'select cafe_dia($1::date)', [hoy]);
    // Hoy se abrió en el nivel 5: 7 como mucho
    expect(d.dia.clientes.length).toBe(7);
    const c = d.dia.clientes[0];
    const r = await call(A, 'select cafe_servir($1::date, $2, $3::text[], $4, $5)', [hoy, 1, recetaPide(c, d.dia.carta), null, null]);
    const rep = 13740 + r.dado.reputacion;
    // La reputación se puso a mano: los hitos del 6 que ya pasaba llegan todos en este servicio
    const esperado = novedades(9999, rep);
    expect(r.progreso).toMatchObject({ de: 5, a: 6, niveles: [{ nivel: 6, tickets: 80 }] });
    expect(r.progreso.hitos).toEqual(esperado.hitos.map(({ nivel, hito }) => ({ nivel, hito })));
    expect(r.progreso.granos).toBe(esperado.hitos.some((h) => h.hito === 3) ? 20 : 0);
    expect((await db.query('select tickets from piso_cuentas where user_id = $1', [A])).rows[0].tickets).toBe(t0 + 80 + ticketsDelDia(6));
    expect(r.cafe).toMatchObject({ nivel: 6 });
    // Otro servicio: nada se cobra dos veces
    const r2 = await call(A, 'select cafe_servir($1::date, $2, $3::text[], $4, $5)', [hoy, 2, recetaPide(d.dia.clientes[1], d.dia.carta), null, null]);
    expect(r2.progreso.niveles).toEqual([]);
    // Al día siguiente, con nivel 6 y 8 asientos, vienen 8 (el servidor lo fija al abrir el día)
    const manana = (await db.query("select (cafe_hoy() - 1)::text as m")).rows[0].m;
    expect((await call(A, 'select cafe_dia($1::date)', [manana])).dia.clientes.length).toBe(8);
  });
});
