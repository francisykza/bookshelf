// 1.122 · El café-librería del bajo, bloque 4a, en un Postgres real (PGlite) con todas las migraciones: las cifras de niveles,
// tickets, hitos, huecos y carta son las de la app; los tickets del nivel se cobran una vez (el 1, con el primer cliente) y
// los del día una vez al día; subir de nivel va en la misma llamada que el servicio; cada hito se apunta una vez y el 3.º da
// 15 granos; el mueble de un hito no se vende antes del hito; la carta del día la fija el servidor al abrir el día y el
// chocolate no se puede servir antes de abrirlo; y las tablas nuevas no se leen ni se tocan directamente.
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects } from '../../social/__tests__/supabaseHarness';
import { recetaDe, recetaPide } from '../cafe/cafeClientes';
import { CAFE_NIVELES } from '../cafe/cafeCatalogo';
import { GRANOS_HITO, HUECOS, TICKETS_NIVEL, cartaDe, nivelDe, ticketsDelDia, umbralHito } from '../cafe/cafeNiveles';

let db;
let A, B;
let hoy, ayer;
const call = (u, sql, params) => as(db, u, (q) => q(sql, params)).then((r) => Object.values(r[0])[0]);
const dia = (u, d) => call(u, 'select cafe_dia($1::date)', [d]);
const servir = (u, d, cliente, receta) => call(u, 'select cafe_servir($1::date, $2, $3::text[], $4, $5)', [d, cliente, receta, null, null]);
const tickets = async (u) => (await db.query('select tickets from piso_cuentas where user_id = $1', [u])).rows[0].tickets;
const local = async (u) => (await db.query('select nivel, reputacion, granos from cafe_locales where user_id = $1', [u])).rows[0];
const ponReputacion = (u, r) => db.query('update cafe_locales set reputacion = $2 where user_id = $1', [u, r]);

beforeAll(async () => {
  db = await createDatabase();
  [A, B] = await createUsers(db, 2);
  for (const [i, u] of [A, B].entries()) {
    await as(db, u, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', true)", [`Lectora ${i}`]));
    await as(db, u, (q) => q('select asignar_edificio()'));
    await call(u, 'select cafe_mio()');
    await call(u, 'select cafe_inaugurar($1)', ['Taza y Lomo']);
  }
  const f = (await db.query('select cafe_hoy()::text as h, (cafe_hoy() - 1)::text as a')).rows[0];
  [hoy, ayer] = [f.h, f.a];
}, 60000);

describe('el café-librería del bajo, bloque 4a: niveles, tickets, hitos y carta', () => {
  it('las cifras del servidor son las de la app', async () => {
    for (const n of [1, 2, 3, 4, 5]) {
      const q = (await db.query('select cafe_nivel_desde($1) d, cafe_tickets_nivel($1) t, cafe_tickets_dia($1) td, cafe_huecos($1) h', [n])).rows[0];
      expect(q).toEqual({ d: CAFE_NIVELES[n - 1].desde, t: TICKETS_NIVEL[n], td: ticketsDelDia(n), h: HUECOS[n] });
      for (const k of [1, 2, 3]) expect((await db.query('select cafe_hito_umbral($1, $2) u', [n, k])).rows[0].u).toBe(umbralHito(n, k));
    }
    expect([1, 2, 3, 4, 5].reduce((a, n) => a + TICKETS_NIVEL[n], 0)).toBe(230);
    for (const r of [0, 299, 300, 474, 475, 999, 1000, 1749, 1750, 2500, 5000, 9999]) {
      const q = (await db.query('select cafe_nivel_de($1) n, cafe_carta($1) c', [r])).rows[0];
      expect(q).toEqual({ n: nivelDe(r), c: cartaDe(r) });
    }
    for (const carta of [[], ['chocolate'], ['chocolate', 'nata']])
      for (const r of [0, 1, 5, 13, 36, 71, 431, 999]) expect((await db.query('select cafe_receta_carta($1, $2::text[]) r', [r, carta])).rows[0].r).toEqual(recetaDe(r, carta));
  });

  it('el primer cliente cobra los tickets del nivel 1 y los del día; el segundo, nada más', async () => {
    const t0 = await tickets(A);
    const c = (await dia(A, hoy)).dia.clientes;
    const r = await servir(A, hoy, 1, recetaPide(c[0], []));
    expect(r.progreso).toMatchObject({ de: 1, a: 1, niveles: [{ nivel: 1, tickets: 10 }], tickets_dia: 1, tickets: 11 });
    expect(await tickets(A)).toBe(t0 + 11);
    expect(r.dia).toMatchObject({ carta: [], tickets: 1 });
    const r2 = await servir(A, hoy, 2, recetaPide(c[1], []));
    expect(r2.progreso).toMatchObject({ niveles: [], tickets_dia: 0, tickets: 0 });
    expect(await tickets(A)).toBe(t0 + 11);
    // Ayer es otro día: sus tickets del día, una vez
    const a = (await dia(A, ayer)).dia.clientes;
    expect((await servir(A, ayer, 1, recetaPide(a[0], []))).progreso).toMatchObject({ niveles: [], tickets_dia: 1, tickets: 1 });
  });

  it('subir de nivel en el mismo servicio: los tickets del nivel una vez, los hitos una vez y el 3.º con 15 granos', async () => {
    const [h1, h2, h3] = [1, 2, 3].map((k) => umbralHito(1, k));
    await ponReputacion(A, h3 - 1);
    const antes = await local(A);
    const t0 = await tickets(A);
    const c = (await dia(A, hoy)).dia.clientes;
    const r = await servir(A, hoy, 3, recetaPide(c[2], []));
    // Los hitos 1, 2 y 3 del nivel 1 llegan juntos (la reputación se puso a mano), una sola vez
    expect(r.progreso.hitos).toEqual([
      { nivel: 1, hito: 1 },
      { nivel: 1, hito: 2 },
      { nivel: 1, hito: 3 },
    ]);
    expect(r.progreso.granos).toBe(GRANOS_HITO);
    expect((await local(A)).granos).toBe(antes.granos + r.dado.granos + GRANOS_HITO);
    expect(h1 < h2 && h2 < h3 && h3 < 300).toBe(true);
    // Al día siguiente (ayer, que sigue abierto) sube al 2: 20 tickets, una vez
    await ponReputacion(A, 299);
    const a = (await dia(A, ayer)).dia.clientes;
    const r2 = await servir(A, ayer, 2, recetaPide(a[1], []));
    expect(r2.progreso).toMatchObject({ de: 1, a: 2, niveles: [{ nivel: 2, tickets: 20 }], tickets_dia: 0 });
    expect(r2.cafe).toMatchObject({ nivel: 2 });
    expect(await tickets(A)).toBe(t0 + 20);
    const r3 = await servir(A, ayer, 3, recetaPide(a[2], []));
    expect(r3.progreso.niveles).toEqual([]);
    expect(await tickets(A)).toBe(t0 + 20);
  });

  it('el mueble de un hito no se vende antes del hito; los de la subida, con el nivel', async () => {
    await db.query('update cafe_locales set granos = 500 where user_id = $1', [B]);
    expect(await rejects(call(B, 'select cafe_comprar($1)', ['cafe-maceta']))).toMatch(/cafe:mueble/);
    expect(await rejects(call(B, 'select cafe_comprar($1)', ['cafe-vitrina']))).toMatch(/cafe:mueble/);
    await ponReputacion(B, umbralHito(1, 1));
    expect((await call(B, 'select cafe_comprar($1)', ['cafe-maceta'])).inventario['cafe-maceta']).toBe(1);
    await db.query('update cafe_locales set nivel = 2, reputacion = 300 where user_id = $1', [B]);
    expect((await call(B, 'select cafe_comprar($1)', ['cafe-vitrina'])).inventario['cafe-vitrina']).toBe(1);
    expect(await rejects(call(B, 'select cafe_comprar($1)', ['cafe-perchero']))).toMatch(/cafe:mueble/);
    expect(await rejects(call(B, 'select cafe_comprar($1)', ['cafe-reloj']))).toMatch(/cafe:mueble/);
  });

  it('la carta: el chocolate no se sirve antes de abrirlo; lo que piden, con la carta de su día', async () => {
    // B abre hoy en el nivel 2 sin el 2.º hito: carta vacía
    const d = await dia(B, hoy);
    expect(d.dia.carta).toEqual([]);
    expect(await rejects(servir(B, hoy, 1, ['chocolate', 'suave', 'sin', 'nada']))).toMatch(/cafe:receta/);
    // Al llegar al 2.º hito del nivel 2 el chocolate ya se puede servir, pero hoy siguen pidiendo con la carta de hoy
    await ponReputacion(B, umbralHito(2, 2));
    const r = await servir(B, hoy, 1, ['chocolate', 'suave', 'sin', 'nada']);
    expect(r.dado.pide).toEqual(recetaPide(d.dia.clientes[0], []));
    // Ayer se abre ahora, con el chocolate en la carta
    const a = await dia(B, ayer);
    expect(a.dia.carta).toEqual(['chocolate']);
    expect(a.dia.clientes.length).toBe(4);
    expect((await servir(B, ayer, 1, recetaPide(a.dia.clientes[0], ['chocolate']))).dado.aciertos).toBe(4);
    expect(await rejects(servir(B, ayer, 2, ['te', 'suave', 'sin', 'nata']))).toMatch(/cafe:receta/);
  });

  it('desde el nivel 2, la cuadrícula llega al fondo (filas -3 a -1); en el 1, no', async () => {
    const guardar = (u, plano) => call(u, 'select cafe_guardar($1::jsonb)', [JSON.stringify(plano)]);
    const { plano } = await call(B, 'select cafe_mio()');
    const alFondo = { v: 1, items: [...plano.items.filter((i) => i.id !== 'cafe-silla'), { uid: 'fondo', id: 'cafe-silla', x: 1, y: -2, rot: 0 }] };
    await db.query('update cafe_locales set nivel = 1 where user_id = $1', [B]);
    expect(await rejects(guardar(B, alFondo))).toMatch(/cafe:plano/);
    await db.query('update cafe_locales set nivel = 2 where user_id = $1', [B]);
    const r = await guardar(B, alFondo);
    expect(r.plano.items.find((i) => i.uid === 'fondo')).toMatchObject({ x: 1, y: -2 });
    // Más allá de la fila -3, ni en el nivel 5; y sin solaparse con lo de las filas de antes
    await db.query('update cafe_locales set nivel = 5 where user_id = $1', [B]);
    expect(await rejects(guardar(B, { v: 1, items: [{ uid: 'x', id: 'cafe-silla', x: 0, y: -4, rot: 0 }] }))).toMatch(/cafe:plano/);
    expect(await rejects(guardar(B, { v: 1, items: [{ uid: 'x', id: 'cafe-estanteria', x: 0, y: -1, rot: 1 }, { uid: 'y', id: 'cafe-silla', x: 0, y: 0, rot: 0 }] }))).toMatch(/cafe:plano/);
    // La de un argumento (la del bloque 2) es la del nivel 1
    expect((await db.query('select cafe_plano_valido($1::jsonb) v', [JSON.stringify(alFondo)])).rows[0].v).toBe(false);
  });

  it('las tablas nuevas no se leen ni se tocan; las funciones internas no se llaman', async () => {
    for (const t of ['cafe_niveles_cobrados', 'cafe_hitos']) {
      expect(await rejects(as(db, A, (q) => q(`select * from ${t}`)))).toMatch(/permission denied/);
      expect(await rejects(as(db, null, (q) => q(`select * from ${t}`)))).toMatch(/permission denied/);
    }
    for (const fn of ['cafe_progreso($1::uuid, current_date)', 'cafe_carta(1)', 'cafe_receta_carta(1, null)', 'cafe_hito_umbral(1, 1)', 'cafe_nivel_de(1)'])
      expect(await rejects(as(db, A, (q) => q(`select ${fn}`, fn.includes('$1') ? [A] : [])))).toMatch(/permission denied/);
  });
});
