// 1.151 · El edificio de tus amigos (docs/qa/amigos-vecinos.md, bloque 1), en un Postgres real (PGlite) con las migraciones
// tal cual: cada cuenta estrena su edificio; la llave (un uso, 7 días, 3 vivas) y la mudanza con tu piso; irse a uno propio; y
// el reparto de una vez de los edificios mezclados, por grupos de amigos.
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects } from '../../social/__tests__/supabaseHarness';
import { starterRoom } from '../demo';

let db;
let A, B, C, D, E, F, G, X;

const call = (u, sql, params) => as(db, u, (q) => q(sql, params));
const uno = async (u, sql, params) => Object.values((await call(u, sql, params))[0])[0];
const edificioDe = async (u) => (await db.query('select edificio, puerta from edificio_vecinos where user_id = $1', [u])).rows[0] ?? null;
const darLlave = (u) => uno(u, 'select edificio_dar_llave()');
const seguirse = async (a, b) => {
  await call(a, 'insert into follows (followed) values ($1)', [b]);
  await call(b, 'insert into follows (followed) values ($1)', [a]);
};

beforeAll(async () => {
  // El bloque 1 tal cual (con seis puertas); crecer por plantas se prueba en edificioPlantas.rls.test.js
  db = await createDatabase(Infinity, { sin: ['20261231120000_edificio_plantas.sql'] });
  const users = await createUsers(db, 8);
  [A, B, C, D, E, F, G, X] = users;
  for (const [i, u] of users.entries()) {
    await call(u, "insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', $2)", [`Lectora ${i}`, u !== X]);
  }
  for (const u of [A, B, C, D, E, F, G]) {
    await call(u, 'select asignar_edificio()');
    await call(u, 'insert into pisos (layout) values ($1::jsonb)', [JSON.stringify(starterRoom())]);
  }
}, 60000);

describe('la llave de tu edificio', () => {
  it('es un código de 8 letras legibles que caduca a los 7 días; como mucho 3 vivas, y se pueden retirar', async () => {
    const l1 = await darLlave(A);
    expect(l1.codigo).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    const dias = (new Date(l1.caduca) - Date.now()) / 86400000;
    expect(dias).toBeGreaterThan(6.9);
    expect(dias).toBeLessThan(7.1);
    await darLlave(A);
    await darLlave(A);
    expect(await rejects(darLlave(A))).toMatch(/tres llaves sin usar/);
    expect(await uno(A, 'select edificio_mis_llaves()')).toHaveLength(3);
    expect(await uno(A, 'select edificio_retirar_llave($1)', [l1.codigo])).toBe(true);
    expect(await uno(A, 'select edificio_mis_llaves()')).toHaveLength(2);
    // Nadie retira la llave de otra
    const mias = await uno(A, 'select edificio_mis_llaves()');
    expect(await uno(B, 'select edificio_retirar_llave($1)', [mias[0].codigo])).toBeNull();
    // Una retirada ya no sirve
    expect((await uno(B, 'select edificio_ver_llave($1)', [l1.codigo])).motivo).toBe('no_sirve');
    for (const l of mias) await call(A, 'select edificio_retirar_llave($1)', [l.codigo]);
  });

  it('sin la comunidad o sin piso no se dan; las tablas no se leen ni se escriben a mano', async () => {
    expect(await rejects(darLlave(X))).toMatch(/Activa la comunidad/);
    expect(await rejects(darLlave(null))).toMatch(/permission denied/);
    expect(await rejects(call(A, 'select * from edificio_llaves'))).toMatch(/permission denied/);
    expect(await rejects(call(A, "insert into edificio_llaves (codigo, edificio, de) values ('ABCDEFGH', gen_random_uuid(), auth.uid())"))).toMatch(/permission denied/);
  });

  it('antes de usarla se ve de quién es y cuántos vecinos hay; con espacios o en minúsculas también vale', async () => {
    const { codigo } = await darLlave(A);
    const vista = await uno(B, 'select edificio_ver_llave($1)', [` ${codigo.slice(0, 4).toLowerCase()}-${codigo.slice(4)} `]);
    expect(vista.motivo).toBeNull();
    expect(vista.de.alias).toBe('Lectora 0');
    expect(vista.vecinos).toBe(1);
    expect((await uno(A, 'select edificio_ver_llave($1)', [codigo])).motivo).toBe('ya_vives');
    expect((await uno(B, 'select edificio_ver_llave($1)', ['ZZZZZZZZ'])).motivo).toBe('no_sirve');
    await call(A, 'select edificio_retirar_llave($1)', [codigo]);
  });
});

describe('mudarse con una llave', () => {
  it('te mudas con tu piso y tus muebles; la llave se gasta y tu edificio vacío desaparece', async () => {
    const antes = await edificioDe(B);
    const pisoAntes = (await db.query('select layout from pisos where user_id = $1', [B])).rows[0].layout;
    const { codigo } = await darLlave(A);
    const r = await uno(B, 'select edificio_mudarse($1)', [codigo]);
    expect(r.edificio).toBe((await edificioDe(A)).edificio);
    expect(r.puerta).not.toBe((await edificioDe(A)).puerta);
    expect((await db.query('select layout from pisos where user_id = $1', [B])).rows[0].layout).toEqual(pisoAntes);
    expect((await db.query('select count(*)::int as n from edificios where id = $1', [antes.edificio])).rows[0].n).toBe(0);
    // Ya no abre: ni para C ni otra vez para B
    expect(await rejects(call(C, 'select edificio_mudarse($1)', [codigo]))).toMatch(/ya no abre/);
    // Los dos se ven en el portal
    const portal = await uno(A, 'select edificio_portal()');
    expect(portal.vecinos.map((v) => v.user_id).sort()).toEqual([A, B].sort());
    expect(portal.plantas).toBe(3);
    expect(portal.libres).toBe(4);
  });

  it('la llave puede darla cualquier vecino, pero no se usa la propia ni para el edificio donde ya vives', async () => {
    const deB = await darLlave(B);
    expect(await rejects(call(B, 'select edificio_mudarse($1)', [deB.codigo]))).toMatch(/ya no abre/);
    expect(await rejects(call(A, 'select edificio_mudarse($1)', [deB.codigo]))).toMatch(/Ya vives en este edificio/);
    await call(C, 'select edificio_mudarse($1)', [deB.codigo]);
    expect((await edificioDe(C)).edificio).toBe((await edificioDe(A)).edificio);
  });

  it('con un bloqueo con alguien de dentro, la llave no abre', async () => {
    const { codigo } = await darLlave(A);
    await call(D, 'insert into blocks (blocked) values ($1)', [C]);
    expect((await uno(D, 'select edificio_ver_llave($1)', [codigo])).motivo).toBeNull();
    expect(await rejects(call(D, 'select edificio_mudarse($1)', [codigo]))).toMatch(/ya no abre/);
    await call(D, 'delete from blocks where blocked = $1', [C]);
    await call(A, 'select edificio_retirar_llave($1)', [codigo]);
  });

  it('con seis vecinos el edificio está lleno', async () => {
    for (const u of [D, E, F]) {
      const { codigo } = await darLlave(A);
      await call(u, 'select edificio_mudarse($1)', [codigo]);
    }
    const { codigo } = await darLlave(A);
    expect((await uno(G, 'select edificio_ver_llave($1)', [codigo])).motivo).toBe('lleno');
    expect(await rejects(call(G, 'select edificio_mudarse($1)', [codigo]))).toMatch(/está lleno/);
    expect((await uno(A, 'select edificio_portal()')).libres).toBe(0);
    await call(A, 'select edificio_retirar_llave($1)', [codigo]);
  });

  it('irse: a un edificio propio con la misma puerta, y tus llaves sin usar dejan de abrir', async () => {
    const { codigo } = await darLlave(F);
    const antes = await edificioDe(F);
    const r = await uno(F, 'select edificio_irse()');
    expect(r.edificio).not.toBe(antes.edificio);
    expect(r.puerta).toBe(antes.puerta);
    expect((await uno(G, 'select edificio_ver_llave($1)', [codigo])).motivo).toBe('no_sirve');
    // Sola ya en el suyo, no hay de dónde irse
    expect(await rejects(call(F, 'select edificio_irse()'))).toMatch(/Ya vives sola o solo/);
  });
});

describe('el reparto de una vez: cada grupo de amigos, su comunidad', () => {
  it('se queda el grupo más grande; otro grupo se muda junto y quien no tiene amigos, a uno propio', async () => {
    // Un edificio mezclado como los de antes: A, B y C amigos; D y E amigos entre sí; G sin amigos dentro
    const ed = (await edificioDe(A)).edificio;
    // (F se fue en la prueba anterior: G ocupa su hueco)
    await db.query('update edificio_vecinos set edificio = $1, puerta = edificio_puerta_libre($1) where user_id = $2', [ed, G]);
    const ocupadas = (await db.query('select user_id, puerta from edificio_vecinos where edificio = $1', [ed])).rows;
    expect(ocupadas).toHaveLength(6);
    await seguirse(A, B);
    await seguirse(B, C);
    await seguirse(D, E);
    // G sigue a A, pero A no a G: no son amigos
    await call(G, 'insert into follows (followed) values ($1)', [A]);
    const puertas = Object.fromEntries(ocupadas.map((r) => [r.user_id, r.puerta]));
    const { rows } = await db.query('select edificio_repartir_por_amigos($1) as n', [ed]);
    expect(rows[0].n).toBe(3);
    for (const u of [A, B, C]) expect((await edificioDe(u)).edificio).toBe(ed);
    const de = await edificioDe(D);
    expect(de.edificio).not.toBe(ed);
    expect((await edificioDe(E)).edificio).toBe(de.edificio);
    const g = await edificioDe(G);
    expect([ed, de.edificio]).not.toContain(g.edificio);
    // Con su misma puerta, y nada se borra
    for (const u of [A, B, C, D, E, G]) expect((await edificioDe(u)).puerta).toBe(puertas[u]);
    expect((await db.query('select count(*)::int as n from pisos')).rows[0].n).toBe(7);
  });

  it('la migración lo apunta para no repetirlo', async () => {
    const { rows } = await db.query('select count(*)::int as n from edificio_reparto_amigos');
    expect(rows[0].n).toBe(1);
  });
});
