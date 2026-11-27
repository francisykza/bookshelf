// 1.152 · El edificio crece por plantas (docs/qa/amigos-vecinos.md, bloque 2), en un Postgres real (PGlite) con todas las
// migraciones: 3 plantas hasta que se llenan, una más cada vez que entra alguien con el edificio lleno, hasta 5 (10 vecinos), y
// vuelve a su altura si se va quien vivía arriba.
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects } from '../../social/__tests__/supabaseHarness';

let db;
let users;

const call = (u, sql, params) => as(db, u, (q) => q(sql, params));
const uno = async (u, sql, params) => Object.values((await call(u, sql, params))[0])[0];
const puertaDe = async (u) => (await db.query('select puerta from edificio_vecinos where user_id = $1', [u])).rows[0]?.puerta ?? null;
const darLlave = async (u) => (await uno(u, 'select edificio_dar_llave()')).codigo;

beforeAll(async () => {
  db = await createDatabase();
  users = await createUsers(db, 12);
  for (const [i, u] of users.entries()) {
    await call(u, "insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', true)", [`Lectora ${i}`]);
    await call(u, 'select asignar_edificio()');
  }
}, 60000);

describe('el edificio crece por plantas', () => {
  it('estrena con 3 plantas y la puerta en una de ellas', async () => {
    const portal = await uno(users[0], 'select edificio_portal()');
    expect(portal.plantas).toBe(3);
    expect(portal.libres).toBe(9);
    expect(portal.puerta).toMatch(/^[1-3][AB]$/);
  });

  it('se llenan primero las 3 plantas; después, una más cada vez, hasta 5', async () => {
    const [A, ...resto] = users;
    // Los cinco siguientes entran en las plantas que hay
    for (const u of resto.slice(0, 5)) {
      await call(u, 'select edificio_mudarse($1)', [await darLlave(A)]);
      expect(await puertaDe(u)).toMatch(/^[1-3][AB]$/);
    }
    let portal = await uno(A, 'select edificio_portal()');
    expect(portal.plantas).toBe(3);
    expect(portal.libres).toBe(4);
    // El 7.º estrena la 4.ª planta, y el 8.º la completa
    await call(resto[5], 'select edificio_mudarse($1)', [await darLlave(A)]);
    expect(await puertaDe(resto[5])).toMatch(/^4[AB]$/);
    expect((await uno(A, 'select edificio_portal()')).plantas).toBe(4);
    await call(resto[6], 'select edificio_mudarse($1)', [await darLlave(A)]);
    expect(await puertaDe(resto[6])).toMatch(/^4[AB]$/);
    // La 5.ª planta, con los dos últimos
    await call(resto[7], 'select edificio_mudarse($1)', [await darLlave(A)]);
    expect(await puertaDe(resto[7])).toMatch(/^5[AB]$/);
    await call(resto[8], 'select edificio_mudarse($1)', [await darLlave(A)]);
    portal = await uno(A, 'select edificio_portal()');
    expect(portal.plantas).toBe(5);
    expect(portal.libres).toBe(0);
    expect(portal.vecinos).toHaveLength(10);
    expect(new Set(portal.vecinos.map((v) => v.puerta)).size).toBe(10);
  });

  it('con 10 vecinos está lleno: la llave lo dice y no deja entrar', async () => {
    const [A] = users;
    const codigo = await darLlave(A);
    const fuera = users[10];
    const vista = await uno(fuera, 'select edificio_ver_llave($1)', [codigo]);
    expect(vista.motivo).toBe('lleno');
    expect(vista.plantas).toBe(5);
    expect(await rejects(call(fuera, 'select edificio_mudarse($1)', [codigo]))).toMatch(/está lleno/);
    await call(A, 'select edificio_retirar_llave($1)', [codigo]);
  });

  it('si se va quien vive arriba y la planta se queda vacía, el edificio vuelve a su altura', async () => {
    const arriba = [];
    for (const u of users.slice(0, 10)) if (/^5/.test(await puertaDe(u))) arriba.push(u);
    expect(arriba).toHaveLength(2);
    // Una vecina que se queda (la primera ya dio 10 llaves hoy, el tope)
    const queda = users.slice(1, 10).find((u) => !arriba.includes(u));
    await call(arriba[0], 'select edificio_irse()');
    expect((await uno(queda, 'select edificio_portal()')).plantas).toBe(5);
    await call(arriba[1], 'select edificio_irse()');
    const portal = await uno(queda, 'select edificio_portal()');
    expect(portal.plantas).toBe(4);
    expect(portal.libres).toBe(2);
    // Quien se va lo hace con su puerta del 5.º, a un edificio propio de 5 plantas (la suya)
    expect(await puertaDe(arriba[0])).toMatch(/^5[AB]$/);
    expect((await uno(arriba[0], 'select edificio_portal()')).plantas).toBe(5);
    // Y quien entra ahora ocupa primero el hueco de abajo (la 4.ª ya está llena: estrena otra vez la 5.ª)
    await call(users[11], 'select edificio_mudarse($1)', [await darLlave(queda)]);
    expect(await puertaDe(users[11])).toMatch(/^5[AB]$/);
  });

  it('las puertas van del 1.º A al 5.º B: ninguna otra cabe en la tabla', async () => {
    const ed = (await db.query('select edificio from edificio_vecinos where user_id = $1', [users[0]])).rows[0].edificio;
    await expect(db.query("update edificio_vecinos set puerta = '6A' where user_id = $1 and edificio = $2", [users[0], ed])).rejects.toThrow(/puerta_check/);
    await expect(db.query("update edificio_vecinos set puerta = '0B' where user_id = $1", [users[0]])).rejects.toThrow(/puerta_check/);
  });
});
