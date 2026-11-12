// 1.123 · El café-librería del bajo, bloque 4b, en un Postgres real (PGlite) con todas las migraciones: la carta con la
// vainilla y el café con hielo es la de la app; los clientes del día salen de los asientos en los niveles 4 y 5 (entre 5 y 6
// o 7); el plano admite el ala lateral desde el nivel 4 y la terraza desde el 5 (y 32 cosas); el escaparate solo desde el
// nivel 5 y con tres títulos como mucho; y la calle ve tu café sin crearlo.
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects } from '../../social/__tests__/supabaseHarness';
import { recetaDe } from '../cafe/cafeClientes';
import { ASIENTOS, asientosDe, casillaValida, maxCosas } from '../cafe/cafeCatalogo';
import { clientesDelNivel } from '../cafe/cafeClientes';
import { cartaDe, umbralHito } from '../cafe/cafeNiveles';

let db;
let A, B, C;
let hoy, ayer;
const call = (u, sql, params) => as(db, u, (q) => q(sql, params)).then((r) => Object.values(r[0])[0]);
const ponLocal = (u, campos) =>
  db.query(
    `update cafe_locales set ${Object.keys(campos)
      .map((k, i) => `${k} = $${i + 2}`)
      .join(', ')} where user_id = $1`,
    [u, ...Object.values(campos)],
  );
const sillas = (n, desde = 0) => Array.from({ length: n }, (_, k) => ({ uid: `s${k}`, id: 'cafe-silla', x: (desde + k) % 6, y: Math.floor((desde + k) / 6), rot: 0 }));
const valido = (plano, nivel) => db.query('select cafe_plano_valido($1::jsonb, $2) v', [plano, nivel]).then((r) => r.rows[0].v);

beforeAll(async () => {
  db = await createDatabase();
  [A, B, C] = await createUsers(db, 3);
  for (const [i, u] of [A, B, C].entries()) {
    await as(db, u, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', true)", [`Lectora ${i}`]));
    await as(db, u, (q) => q('select asignar_edificio()'));
  }
  for (const u of [A, B]) {
    await call(u, 'select cafe_mio()');
    await call(u, 'select cafe_inaugurar($1)', ['Taza y Lomo']);
  }
  const f = (await db.query('select cafe_hoy()::text as h, (cafe_hoy() - 1)::text as a')).rows[0];
  [hoy, ayer] = [f.h, f.a];
}, 60000);

describe('el café-librería del bajo, bloque 4b: ala lateral, terraza, asientos y escaparate', () => {
  it('la carta y las recetas con la vainilla y el café con hielo son las de la app', async () => {
    for (const r of [0, 2499, umbralHito(4, 2) - 1, umbralHito(4, 2), umbralHito(5, 2) - 1, umbralHito(5, 2), 20000]) {
      expect((await db.query('select cafe_carta($1) c', [r])).rows[0].c).toEqual(cartaDe(r));
    }
    for (const carta of [
      ['chocolate', 'nata', 'vainilla'],
      ['chocolate', 'nata', 'vainilla', 'hielo'],
    ])
      for (const r of [0, 1, 5, 13, 36, 71, 431, 999, 4321]) expect((await db.query('select cafe_receta_carta($1, $2::text[]) r', [r, carta])).rows[0].r).toEqual(recetaDe(r, carta));
  });

  it('los asientos y los clientes del día son los de la app', async () => {
    const plano = { v: 1, items: Object.keys(ASIENTOS).map((id, k) => ({ uid: `a${k}`, id, x: 0, y: 0, rot: 0 })) };
    expect((await db.query('select cafe_asientos($1::jsonb) n', [plano])).rows[0].n).toBe(asientosDe(plano));
    expect((await db.query("select cafe_asientos('{}'::jsonb) n")).rows[0].n).toBe(0);
    for (const n of [1, 2, 3, 4, 5]) for (const s of [0, 3, 5, 6, 7, 12]) expect((await db.query('select cafe_clientes_dia($1, $2) c', [n, s])).rows[0].c).toBe(clientesDelNivel(n, s));
  });

  it('en el nivel 5 vienen tantos clientes como asientos (de 5 a 7), fijados al abrir el día', async () => {
    await ponLocal(A, { nivel: 5, reputacion: 5000, plano: JSON.stringify({ v: 1, items: sillas(6) }) });
    expect((await call(A, 'select cafe_dia($1::date)', [hoy])).dia.clientes).toHaveLength(6);
    // Con más sillas, el día de hoy no cambia; el siguiente día abierto (aquí, ayer, que aún no estaba) ya cuenta 7
    await ponLocal(A, { plano: JSON.stringify({ v: 1, items: sillas(9) }) });
    expect((await call(A, 'select cafe_dia($1::date)', [hoy])).dia.clientes).toHaveLength(6);
    const d = (await call(A, 'select cafe_dia($1::date)', [ayer])).dia;
    expect(d.clientes).toHaveLength(7);
    // El último, el excéntrico, se puede atender
    expect(d.clientes.at(-1).excentrico).toBe(true);
    const r = await call(A, 'select cafe_servir($1::date, 7, $2::text[], null, null)', [ayer, ['cafe', 'suave', 'sin', 'nada']]);
    expect(r.dado.estrellas).toBeGreaterThan(0);
    // Pocos asientos: nunca menos de 5
    await ponLocal(B, { nivel: 4, reputacion: 2500, plano: JSON.stringify({ v: 1, items: sillas(1) }) });
    expect((await call(B, 'select cafe_dia($1::date)', [hoy])).dia.clientes).toHaveLength(5);
  });

  it('el plano: el ala lateral desde el nivel 4, la terraza desde el 5 y la fila de la pared nunca', async () => {
    for (const [x, y] of [
      [-1, 0],
      [-3, -3],
      [5, 5],
      [0, 7],
      [5, 9],
      [0, 6],
      [6, 8],
      [-1, 8],
      [2, 10],
    ])
      for (const n of [3, 4, 5]) {
        const p = { v: 1, items: [{ uid: 'u', id: 'cafe-silla', x, y, rot: 0 }] };
        expect([x, y, n, await valido(p, n)]).toEqual([x, y, n, casillaValida(x, y, n)]);
      }
    // Una mesa larga que cruzaría la pared (filas 5 y 6) no cabe
    expect(await valido({ v: 1, items: [{ uid: 'm', id: 'cafe-mesa-larga', x: 0, y: 5, rot: 1 }] }, 5)).toBe(false);
    // Solapes en el ala lateral
    expect(
      await valido(
        {
          v: 1,
          items: [
            { uid: 'a', id: 'cafe-piano', x: -3, y: 0, rot: 0 },
            { uid: 'b', id: 'cafe-silla', x: -2, y: 0, rot: 0 },
          ],
        },
        4,
      ),
    ).toBe(false);
    // 32 cosas desde el nivel 4; 24 antes
    const muchas = { v: 1, items: Array.from({ length: 32 }, (_, k) => ({ uid: `k${k}`, id: 'cafe-silla', x: (k % 9) - 3, y: Math.floor(k / 9) - 3, rot: 0 })) };
    expect(await valido(muchas, 4)).toBe(maxCosas(4) >= 32);
    expect(await valido({ ...muchas, items: muchas.items.slice(0, 25) }, 4)).toBe(true);
    expect(await valido({ ...muchas, items: muchas.items.slice(0, 25).map((i, k) => ({ ...i, x: k % 6, y: Math.floor(k / 6) - 3 })) }, 3)).toBe(false);
    // Guardar en el ala lateral: con nivel 4 sí; con nivel 3, no
    await ponLocal(B, { nivel: 4 });
    const g = await call(B, 'select cafe_guardar($1::jsonb)', [{ v: 1, items: [{ uid: 's', id: 'cafe-silla', x: -2, y: 1, rot: 0 }] }]);
    expect(g.plano.items).toHaveLength(1);
    await ponLocal(B, { nivel: 3 });
    expect(await rejects(as(db, B, (q) => q('select cafe_guardar($1::jsonb)', [{ v: 1, items: [{ uid: 's', id: 'cafe-silla', x: -2, y: 1, rot: 0 }] }])))).toMatch(/cafe:plano/);
  });

  it('el escaparate: desde el nivel 5, hasta tres títulos válidos; y la calle lo ve', async () => {
    const t = (k) => ({ clave: `b${k}`, titulo: `Libro ${k}`, genero: 'novela' });
    await ponLocal(B, { nivel: 4 });
    expect(await rejects(as(db, B, (q) => q('select cafe_poner_escaparate($1::jsonb)', [[t(1)]])))).toMatch(/cafe:nivel/);
    expect((await call(B, 'select cafe_fachada()')).escaparate).toEqual([]);
    await ponLocal(B, { nivel: 5 });
    expect(await rejects(as(db, B, (q) => q('select cafe_poner_escaparate($1::jsonb)', [[t(1), t(2), t(3), t(4)]])))).toMatch(/cafe:titulos/);
    expect(await rejects(as(db, B, (q) => q('select cafe_poner_escaparate($1::jsonb)', [[{ clave: 'x', titulo: 'X', genero: 'inventado' }]])))).toMatch(/cafe:titulos/);
    const r = await call(B, 'select cafe_poner_escaparate($1::jsonb)', [[t(1), t(2), t(2)]]);
    expect(r.escaparate.map((b) => b.clave)).toEqual(['b1', 'b2']);
    expect(await call(B, 'select cafe_fachada()')).toEqual({ inaugurado: true, nombre: 'Taza y Lomo', nivel: 5, escaparate: r.escaparate });
    // Quien no tiene café: la calle no lo crea
    expect(await call(C, 'select cafe_fachada()')).toBeNull();
    expect((await db.query('select count(*)::int n from cafe_locales where user_id = $1', [C])).rows[0].n).toBe(0);
  });

  it('las funciones nuevas internas no se pueden llamar desde fuera', async () => {
    for (const sql of ["select cafe_asientos('{}'::jsonb)", 'select cafe_clientes_dia(5, 7)', 'select cafe_casilla_valida(0, 0, 5)']) {
      expect(await rejects(as(db, A, (q) => q(sql)))).toMatch(/permission denied/);
    }
  });
});
