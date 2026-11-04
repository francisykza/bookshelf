// 1.79 · La suite de la semana, decorada entre todos (paso B de docs/qa/gran-hotel.md §9.3): cada semana empieza
// vacía, cada huésped lleva un mueble suyo (sin perderlo) que tiene que caber como en un piso, se ve quién trajo cada
// cosa y con cuatro semanas aportando llega la placa, una vez. Postgres real (PGlite) con todas las migraciones.
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects } from '../../social/__tests__/supabaseHarness';
import { starterRoom } from '../demo';

// La sala ya no está en la app (1.81), pero sus funciones siguen en la base de datos, con lo que ya se ganó
const SUITE_PLACA_SEMANAS = 4;

let db;
let A, B, C;
const call = (u, sql, params) => as(db, u, (q) => q(sql, params)).then((r) => Object.values(r[0])[0]);
const suite = (u) => call(u, 'select piso_suite()');
const llevar = (u, item) => call(u, 'select piso_suite_llevar($1::jsonb)', [JSON.stringify(item)]);
const placas = (u) => db.query("select copias from piso_inventario where user_id = $1 and mueble = 'placa-suite'", [u]).then((r) => r.rows[0]?.copias ?? 0);
const SILLON = { id: 'sillon', tono: 0, x: 3, y: 3, rot: 0 };

beforeAll(async () => {
  db = await createDatabase();
  [A, B, C] = await createUsers(db, 3);
  for (const [i, u] of [A, B, C].entries()) {
    await as(db, u, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', true)", [`Huésped ${i}`]));
    await as(db, u, (q) => q('select asignar_edificio()'));
    await as(db, u, (q) => q('insert into pisos (layout) values ($1::jsonb)', [JSON.stringify(starterRoom())]));
    await call(u, 'select piso_mi_inventario()');
  }
}, 60000);

describe('la suite de la semana', () => {
  it('empieza vacía, con su pared y su suelo de la semana', async () => {
    const s = await suite(A);
    expect(s).toMatchObject({ aportes: [], mio: null, semanas: 0, placa: false, meta: SUITE_PLACA_SEMANAS });
    expect(s.layout.items).toEqual([]);
    expect(['yeso', 'salvia', 'rosa', 'noche']).toContain(s.layout.pared);
    expect(['tablas', 'damero', 'barro']).toContain(s.layout.suelo);
  });

  it('cada cual lleva un mueble suyo, sin perderlo, y se ve quién lo trajo', async () => {
    const antes = (await db.query("select copias from piso_inventario where user_id = $1 and mueble = 'sillon'", [A])).rows[0].copias;
    const s = await llevar(A, SILLON);
    expect(s.mio).toEqual(SILLON);
    expect(s.layout.items).toEqual([{ ...SILLON, uid: 1 }]);
    expect(s.aportes).toEqual([{ uid: 1, alias: 'Huésped 0', avatar_id: 'gato-lector', mueble: 'sillon', yo: true }]);
    expect((await suite(B)).aportes[0]).toMatchObject({ alias: 'Huésped 0', yo: false });
    expect((await db.query("select copias from piso_inventario where user_id = $1 and mueble = 'sillon'", [A])).rows[0].copias).toBe(antes);
  });

  it('tiene que caber: no se pisa lo de otro', async () => {
    expect(await rejects(llevar(B, { ...SILLON, x: 4 }))).toMatch(/no cabe/);
    expect((await llevar(B, { id: 'sillon', tono: 1, x: 6, y: 6, rot: 0 })).aportes).toHaveLength(2);
  });

  it('uno por persona: llevar otro cambia el tuyo de sitio o por otro', async () => {
    const s = await llevar(A, { ...SILLON, x: 0, y: 0 });
    expect(s.aportes.filter((a) => a.yo)).toHaveLength(1);
    expect(s.mio).toMatchObject({ x: 0, y: 0 });
  });

  it('solo lo corriente que tienes, de suelo, alfombra o pared', async () => {
    expect(await rejects(llevar(A, { id: 'piano', tono: 0, x: 5, y: 0, rot: 0 }))).toMatch(/que tengas/);
    const saga = (await db.query("select id from piso_catalogo where saga is not null and capa = 'suelo' limit 1")).rows[0].id;
    expect(await rejects(llevar(A, { id: saga, tono: 0, x: 5, y: 0, rot: 0 }))).toMatch(/corriente/);
    await db.query("insert into piso_inventario (user_id, mueble, copias) values ($1, 'buho-estrellas', 1), ($1, 'libros', 1) on conflict (user_id, mueble) do update set copias = 1", [A]);
    expect(await rejects(llevar(A, { id: 'buho-estrellas', tono: 0, x: 5, y: 0, rot: 0 }))).toMatch(/corriente/);
    expect(await rejects(llevar(A, { id: 'libros', tono: 0, x: 0, y: 0, rot: 0 }))).toMatch(/corriente/);
    expect(await rejects(llevar(A, { ...SILLON, uid: 7 }))).toMatch(/no se puede llevar/);
    expect(await rejects(llevar(A, { ...SILLON, x: 8 }))).toMatch(/no cabe/);
  });

  it('lo de quien tiene un bloqueo contigo no se enseña', async () => {
    await as(db, C, (q) => q('insert into blocks (blocked) values ($1)', [A]));
    const s = await suite(C);
    expect(s.aportes.map((a) => a.alias)).toEqual(['Huésped 1']);
    expect(s.layout.items).toHaveLength(1);
    await db.query('delete from blocks');
  });

  it('retirarlo lo saca de la suite', async () => {
    const s = await call(B, 'select piso_suite_retirar()');
    expect(s.mio).toBeNull();
    expect(s.aportes.map((a) => a.alias)).toEqual(['Huésped 0']);
  });

  it('con cuatro semanas distintas aportando, la placa (una vez y sin tickets)', async () => {
    // A ya aportó esta semana; le añadimos dos semanas pasadas: tres en total, todavía sin placa
    for (const k of [1, 2]) await db.query("insert into piso_suite_aportes (semana, user_id, item) values (date_trunc('week', current_date)::date - 7 * $2::int, $1, '{}'::jsonb)", [A, k]);
    expect((await llevar(A, SILLON)).semanas).toBe(3);
    expect(await placas(A)).toBe(0);
    await db.query("insert into piso_suite_aportes (semana, user_id, item) values (date_trunc('week', current_date)::date - 21, $1, '{}'::jsonb)", [A]);
    const tickets = (await db.query('select tickets from piso_cuentas where user_id = $1', [A])).rows[0].tickets;
    const s = await llevar(A, { ...SILLON, x: 1 });
    expect(s).toMatchObject({ semanas: 4, placa: true });
    expect(await placas(A)).toBe(1);
    await llevar(A, { ...SILLON, x: 2 });
    expect(await placas(A)).toBe(1);
    expect((await db.query('select tickets from piso_cuentas where user_id = $1', [A])).rows[0].tickets).toBe(tickets);
  });

  it('la placa no se recicla, no se regala ni se vende', async () => {
    expect(await rejects(call(A, "select piso_reciclar('placa-suite')"))).toMatch(/no se puede reciclar/);
    expect(await rejects(call(A, "select piso_comprar('placa-suite')"))).toMatch(/no se vende/);
    await db.query("update piso_inventario set copias = 2 where user_id = $1 and mueble = 'placa-suite'", [A]);
    expect(await rejects(call(A, "select piso_regalar($1, 'placa-suite')", [B]))).toMatch(/raro/);
  });

  it('sin sesión no se llega a nada, y las tablas no se tocan', async () => {
    for (const sql of ['select piso_suite()', `select piso_suite_llevar('{}'::jsonb)`, 'select piso_suite_retirar()']) {
      expect(await rejects(as(db, null, (q) => q(sql)))).toMatch(/permission denied/);
    }
    for (const t of ['piso_suite_aportes', 'piso_suite_semanas', 'piso_suite_placas']) expect(await rejects(as(db, A, (q) => q(`select * from ${t}`)))).toMatch(/permission denied/);
    expect(await rejects(as(db, A, (q) => q('select piso_suite_semana()')))).toMatch(/permission denied/);
  });
});
