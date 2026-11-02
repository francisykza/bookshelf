// Místicos, bloque 2 (docs/qa/misticos.md): en un Postgres real (PGlite) con todas las migraciones. El catálogo
// coincide con el del cliente; los místicos se colocan solo si los tienes; los legendarios no se colocan, acompañan
// (solo el que tienes) y el portal lo enseña a los vecinos; no se compran, reciclan ni regalan; desde la 1.73 salen en
// el sobre de coleccionista (bloque 3).
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects } from '../../social/__tests__/supabaseHarness';
import { CATALOG, COMPANEROS, isMistico } from '../catalog';
import { starterRoom } from '../demo';
import { addItem } from '../room';

let db;
let A, B;
const call = (u, sql, params) => as(db, u, (q) => q(sql, params)).then((r) => Object.values(r[0])[0]);
const portal = (u) => call(u, 'select edificio_portal()');
const give = (u, mueble, n = 1) => db.query('insert into piso_inventario (user_id, mueble, copias) values ($1, $2, $3) on conflict (user_id, mueble) do update set copias = excluded.copias', [u, mueble, n]);
const saveRoom = (u, room) => as(db, u, (q) => q('update pisos set layout = $1::jsonb', [JSON.stringify(room)]));
const setPal = (u, id) => as(db, u, (q) => q('update pisos set companero = $1', [id]));

beforeAll(async () => {
  db = await createDatabase();
  [A, B] = await createUsers(db, 2);
  for (const [i, u] of [A, B].entries()) {
    await as(db, u, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', true)", [`Vecino ${i}`]));
    await as(db, u, (q) => q('select asignar_edificio()'));
    await as(db, u, (q) => q('insert into pisos (layout) values ($1::jsonb)', [JSON.stringify(starterRoom())]));
    await call(u, 'select piso_mi_inventario()');
  }
  // Tantas escrituras seguidas toparían con el límite de guardados por minuto
  await db.query('alter table pisos disable trigger pisos_rate');
}, 60000);

describe('místicos en el servidor', () => {
  it('el catálogo tiene los mismos que el cliente, con su rareza', async () => {
    const { rows } = await db.query("select id, rareza from piso_catalogo where rareza in ('mistico', 'legendario') order by id");
    expect(Object.fromEntries(rows.map((r) => [r.id, r.rareza]))).toEqual(Object.fromEntries(CATALOG.filter(isMistico).map((c) => [c.id, c.rareza])));
    expect(COMPANEROS.map((c) => c.id).sort()).toEqual(rows.filter((r) => r.rareza === 'legendario').map((r) => r.id));
  });

  it('un místico se coloca solo si lo tienes', async () => {
    const room = addItem(starterRoom(), 'farol-azul', { near: { x: 7, y: 1 } }).room;
    expect(await rejects(saveRoom(A, room))).toMatch(/copias suficientes/);
    await give(A, 'farol-azul');
    await saveRoom(A, room);
    expect((await portal(B)).vecinos.find((v) => v.user_id === A).layout.items.some((i) => i.id === 'farol-azul')).toBe(true);
  });

  it('los legendarios no se colocan, aunque los tengas', async () => {
    await give(A, 'dragoncillo');
    const room = addItem(starterRoom(), 'dragoncillo', { near: { x: 7, y: 6 } }).room;
    expect(await rejects(saveRoom(A, room))).toMatch(/no se colocan/);
  });

  it('te acompaña solo un legendario que tienes, y los vecinos lo ven', async () => {
    expect(await rejects(setPal(A, 'zorro-bruma'))).toMatch(/Aún no tienes/);
    expect(await rejects(setPal(A, 'farol-azul'))).toMatch(/Aún no tienes/);
    expect(await rejects(setPal(A, 'sillon'))).toMatch(/Aún no tienes/);
    await setPal(A, 'dragoncillo');
    expect((await portal(B)).vecinos.find((v) => v.user_id === A).companero).toBe('dragoncillo');
    expect((await portal(A)).vecinos.find((v) => v.user_id === B).companero).toBeNull();
    // Solo cada uno cambia el suyo
    await as(db, B, (q) => q('update pisos set companero = null where user_id = $1', [A]));
    expect((await portal(B)).vecinos.find((v) => v.user_id === A).companero).toBe('dragoncillo');
    await setPal(A, null);
    expect((await portal(B)).vecinos.find((v) => v.user_id === A).companero).toBeNull();
  });

  it('no se compran, ni se reciclan, ni se regalan', async () => {
    await give(A, 'rosa-estrellas', 2);
    expect(await rejects(call(A, "select piso_comprar('rosa-estrellas')"))).toMatch(/no se vende/);
    expect(await rejects(call(A, "select piso_reciclar('rosa-estrellas')"))).toMatch(/no se puede reciclar/);
    expect(await rejects(call(A, "select piso_reciclar('dragoncillo')"))).toMatch(/no se puede reciclar/);
    expect(await rejects(call(A, 'select piso_regalar($1, $2)', [B, 'rosa-estrellas']))).toMatch(/no se puede regalar/);
    // Lo de siempre sigue reciclándose
    await give(A, 'silla', 3);
    expect((await call(A, "select piso_reciclar('silla')")).copias.silla).toBe(2);
  });

  it('solo salen en «Edición coleccionista», con las cifras aprobadas', async () => {
    const def = (id) => db.query('select piso_sobre($1) as d', [id]).then((r) => r.rows[0].d);
    const col = await def('coleccion');
    expect([col.mistico, col.legendario, col.raro, col.poco]).toEqual([0.01, 0.25, 0.14, 0.35]);
    for (const id of ['salon', 'luces', 'balcon']) expect((await def(id)).mistico ?? 0).toBe(0);
    // Los demás sobres no los dan nunca
    await db.query('update piso_cuentas set tickets = 100000 where user_id = $1', [B]);
    for (const id of ['salon', 'luces', 'balcon']) {
      for (let k = 0; k < 4; k += 1) {
        const r = await call(B, 'select piso_abrir_sobre($1, 5)', [id]);
        for (const p of r.premios) expect(['mistico', 'legendario']).not.toContain(p.rareza);
      }
    }
  });

  // Cambia el sobre de coleccionista de esta base de pruebas para que siempre toque místico (las de después no lo usan)
  it('el sorteo del místico: uno de cada cuatro legendario, y cuenta como raro para el pity', async () => {
    await db.query("create or replace function public.piso_sobre(sobre text) returns jsonb language sql immutable set search_path = '' as $$ select case sobre when 'coleccion' then jsonb_build_object('coste1', 25, 'coste5', 110, 'raro', 0, 'poco', 0, 'mistico', 1, 'legendario', 0.25, 'muebles', null) else null end $$");
    await db.query('update piso_cuentas set tickets = 100000, sin_raro = 9 where user_id = $1', [B]);
    const premios = [];
    for (let k = 0; k < 40; k += 1) premios.push(...(await call(B, "select piso_abrir_sobre('coleccion', 5)")).premios);
    const ids = Object.fromEntries(CATALOG.filter(isMistico).map((c) => [c.id, c.rareza]));
    for (const p of premios) expect(ids[p.mueble], p.mueble).toBe(p.rareza);
    const leg = premios.filter((p) => p.rareza === 'legendario').length / premios.length;
    expect(leg).toBeGreaterThan(0.12);
    expect(leg).toBeLessThan(0.4);
    // Un místico reinicia el pity como lo raro
    expect((await db.query('select sin_raro from piso_cuentas where user_id = $1', [B])).rows[0].sin_raro).toBe(0);
    // El nuevo legendario puede acompañarte
    const pal = premios.find((p) => p.rareza === 'legendario').mueble;
    await as(db, B, (q) => q('update pisos set companero = $1', [pal]));
    expect((await portal(A)).vecinos.find((v) => v.user_id === B).companero).toBe(pal);
  });

  it('nadie lee ni cambia el compañero sin sesión', async () => {
    expect(await rejects(as(db, null, (q) => q('select companero from pisos')))).toMatch(/permission denied/);
    expect(await rejects(as(db, null, (q) => q('select edificio_portal()')))).toMatch(/permission denied/);
  });
});
