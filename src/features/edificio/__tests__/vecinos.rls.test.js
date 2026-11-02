// 1.71 · Vecinos (SPEC §71): regalar copias libres de muebles, libro de visitas con frases cerradas y «me gusta» por
// mueble, solo entre vecinos visibles. Postgres real (PGlite) con todas las migraciones.
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects } from '../../social/__tests__/supabaseHarness';
import { FIRMAS } from '../catalog';
import { starterRoom } from '../demo';

let db;
let A, B, C, Z;
const call = (u, sql, params) => as(db, u, (q) => q(sql, params)).then((r) => Object.values(r[0])[0]);
const copias = (u, m) => db.query('select copias from piso_inventario where user_id = $1 and mueble = $2', [u, m]).then((r) => r.rows[0]?.copias ?? 0);
const social = (u, piso) => call(u, 'select piso_social($1)', [piso]);

beforeAll(async () => {
  db = await createDatabase();
  [A, B, C, Z] = await createUsers(db, 4);
  for (const [i, u] of [A, B, C, Z].entries()) {
    await as(db, u, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', true)", [`Vecino ${i}`]));
    await as(db, u, (q) => q('select asignar_edificio()'));
    await as(db, u, (q) => q('insert into pisos (layout) values ($1::jsonb)', [JSON.stringify(starterRoom())]));
    await call(u, 'select piso_mi_inventario()');
  }
  // C bloquea a A: no se ven
  await as(db, C, (q) => q('insert into blocks (blocked) values ($1)', [A]));
  // Z vive en otro edificio
  const { rows } = await db.query('select edificio from edificio_vecinos where user_id = $1', [A]);
  await db.query("insert into edificios default values");
  await db.query('update edificio_vecinos set edificio = (select id from edificios where id <> $1 order by id limit 1) where user_id = $2', [rows[0].edificio, Z]);
}, 60000);

describe('regalar muebles', () => {
  it('una copia libre pasa de tu inventario al del vecino y él lo ve en su libro', async () => {
    await db.query("insert into piso_inventario (user_id, mueble, copias) values ($1, 'puf', 2) on conflict (user_id, mueble) do update set copias = 2", [A]);
    const inv = await call(A, "select piso_regalar($1, 'puf')", [B]);
    expect(inv.copias.puf).toBe(1);
    expect(await copias(B, 'puf')).toBe(1);
    const s = await social(B, B);
    expect(s.regalos[0]).toMatchObject({ de: A, alias: 'Vecino 0', mueble: 'puf' });
    // A los demás no se les enseñan los regalos de B
    expect((await social(A, B)).regalos).toEqual([]);
  });

  it('no se regala lo que está puesto, ni de sagas, ni a quien no es vecino visible', async () => {
    // El sillón del piso inicial está colocado: no hay copia libre
    expect(await rejects(call(A, "select piso_regalar($1, 'sillon')", [B]))).toMatch(/copias libres/);
    expect(await rejects(call(A, "select piso_regalar($1, 'puf')", [C]))).toMatch(/vecino de tu edificio/);
    expect(await rejects(call(A, "select piso_regalar($1, 'puf')", [Z]))).toMatch(/vecino de tu edificio/);
    expect(await rejects(call(A, "select piso_regalar($1, 'puf')", [A]))).toMatch(/vecino de tu edificio/);
    const saga = (await db.query('select id from piso_catalogo where saga is not null limit 1')).rows[0].id;
    await db.query('insert into piso_inventario (user_id, mueble, copias) values ($1, $2, 3) on conflict (user_id, mueble) do update set copias = 3', [A, saga]);
    expect(await rejects(call(A, 'select piso_regalar($1, $2)', [B, saga]))).toMatch(/no se puede regalar/);
  });

  it('como mucho cinco al día', async () => {
    await db.query("insert into piso_inventario (user_id, mueble, copias) values ($1, 'taza', 9) on conflict (user_id, mueble) do update set copias = 9", [A]);
    for (let k = 0; k < 4; k += 1) await call(A, "select piso_regalar($1, 'taza')", [B]);
    expect(await rejects(call(A, "select piso_regalar($1, 'taza')", [B]))).toMatch(/cinco regalos/);
  });
});

describe('libro de visitas', () => {
  it('una frase cerrada por día y piso; el dueño y los vecinos la leen', async () => {
    await call(B, "select piso_firmar($1, 'leer')", [A]);
    const s = await call(B, "select piso_firmar($1, 'cafe')", [A]);
    expect(s.visitas).toHaveLength(1);
    expect(s.visitas[0]).toMatchObject({ de: B, alias: 'Vecino 1', frase: 'cafe' });
    expect((await social(A, A)).visitas[0].frase).toBe('cafe');
    expect(await rejects(call(B, "select piso_firmar($1, 'Hola, soy yo')", [A]))).toMatch(/no está en el libro/);
    expect(await rejects(call(A, "select piso_firmar($1, 'leer')", [A]))).toMatch(/vecino de tu edificio/);
    expect(await rejects(call(Z, "select piso_firmar($1, 'leer')", [A]))).toMatch(/vecino de tu edificio/);
    // Las frases son las del cliente
    expect((await db.query('select piso_firmas() as f')).rows[0].f).toEqual(FIRMAS.map((f) => f.id));
  });

  it('quien me ha bloqueado no ve mi firma ni yo la suya', async () => {
    await call(A, "select piso_firmar($1, 'saludo')", [B]);
    await call(C, "select piso_firmar($1, 'pronto')", [B]);
    expect((await social(C, B)).visitas.map((v) => v.de)).not.toContain(A);
    expect((await social(A, B)).visitas.map((v) => v.de)).not.toContain(C);
    expect((await social(B, B)).visitas.map((v) => v.de).sort()).toEqual([A, C].sort());
  });
});

describe('me gusta por mueble', () => {
  it('cuenta por mueble del piso y se puede quitar', async () => {
    const sillon = starterRoom().items.find((i) => i.id === 'sillon').uid;
    await call(A, 'select piso_megusta($1, $2, true)', [B, sillon]);
    let s = await call(C, 'select piso_megusta($1, $2, true)', [B, sillon]);
    expect(s.megusta[sillon]).toBe(2);
    expect(s.mios).toEqual([sillon]);
    s = await call(A, 'select piso_megusta($1, $2, false)', [B, sillon]);
    expect(s.megusta[sillon]).toBe(1);
    expect(s.mios).toEqual([]);
    expect(await rejects(call(A, 'select piso_megusta($1, 999, true)', [B]))).toMatch(/ya no está/);
    expect(await rejects(call(A, 'select piso_megusta($1, $2, true)', [A, sillon]))).toMatch(/vecino de tu edificio/);
  });

  it('si el mueble se va del piso, sus «me gusta» dejan de contar', async () => {
    const sillon = starterRoom().items.find((i) => i.id === 'sillon').uid;
    const room = starterRoom();
    room.items = room.items.filter((i) => i.uid !== sillon);
    await as(db, B, (q) => q('update pisos set layout = $1::jsonb', [JSON.stringify(room)]));
    expect((await social(B, B)).megusta[sillon]).toBeUndefined();
  });

  it('las tablas no se tocan directamente', async () => {
    for (const t of ['piso_regalos', 'piso_visitas', 'piso_megusta']) {
      expect(await rejects(as(db, A, (q) => q(`select * from ${t}`)))).toMatch(/permission denied/);
      expect(await rejects(as(db, null, (q) => q(`select * from ${t}`)))).toMatch(/permission denied/);
    }
    expect(await rejects(as(db, null, (q) => q('select piso_social($1)', [A])))).toMatch(/permission denied/);
  });
});
