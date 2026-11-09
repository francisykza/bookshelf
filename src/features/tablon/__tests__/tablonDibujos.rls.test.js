// Dibujos del tablón sobre Postgres real (PGlite) con todas las migraciones: límites, cupo compartido, permiso público y retirada.
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects } from '../../social/__tests__/supabaseHarness';

let db;
let A, B, C;
const call = (u, sql, params) => as(db, u, (q) => q(sql, params)).then((r) => Object.values(r[0])[0]);
const cargar = (u) => call(u, 'select tablon_cargar()');
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const D = { v: 1, s: [{ c: 1, p: [10, 10, 50, 60] }] };
const dibujar = (u, d, dib, clave, permite = false, forma = true) => call(u, 'select tablon_enviar_dibujo($1, $2::jsonb, $3, $4, $5)', [d, JSON.stringify(dib), forma, permite, clave]);
const guardar = (u, comp, base, items) => call(u, 'select tablon_guardar($1, $2, $3, $4::jsonb, $5::jsonb)', [comp, base, 'Mi tablón', JSON.stringify(items), '[]']);
const item = (n, extra) => ({ id: uuid(n), body: '', x: 0, y: 0, width: 240, height: 240, rotation: 0, z: n, paper: 'crema', pin: 'laton', spoiler: false, ...extra });

beforeAll(async () => {
  db = await createDatabase();
  [A, B, C] = await createUsers(db, 3);
  for (const [i, u] of [A, B, C].entries()) {
    await as(db, u, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', true)", [`Lector ${i}`]));
    await as(db, u, (q) => q('select asignar_edificio()'));
    await call(u, 'select tablon_ajustes($1)', [true]);
  }
}, 60000);

describe('dibujos del tablón', () => {
  it('rechaza lo que no sea un dibujo dentro de los límites', async () => {
    const mal = (dib, n) => dibujar(B, A, dib, uuid(100 + n));
    expect(await rejects(mal({ v: 1, s: [] }, 1))).toMatch(/dibujo/i);
    expect(await rejects(mal({ v: 1, s: [{ c: 9, p: [1, 1] }] }, 2))).toMatch(/dibujo/i);
    expect(await rejects(mal({ v: 1, s: [{ c: 0, p: [1, 121] }] }, 3))).toMatch(/dibujo/i);
    expect(await rejects(mal({ v: 1, s: [{ c: 0, p: [1, 1.5] }] }, 4))).toMatch(/dibujo/i);
    expect(await rejects(mal({ v: 1, s: [{ c: 0, p: [1, 1, 2] }] }, 5))).toMatch(/dibujo/i);
    expect(await rejects(mal({ v: 1, s: Array.from({ length: 151 }, () => ({ c: 0, p: [1, 1] })) }, 6))).toMatch(/dibujo/i);
    expect(await rejects(mal({ v: 1, s: [{ c: 0, p: Array(8002).fill(1) }] }, 7))).toMatch(/dibujo/i);
    expect(await rejects(mal({ v: 1, s: [{ c: 0, p: 'x' }] }, 8))).toMatch(/dibujo/i);
  });

  it('llega al buzón, sin datos de más, y comparte cupo con el post-it', async () => {
    const r = await dibujar(B, A, { ...D, extra: 'nada', s: [{ ...D.s[0], ojo: 1 }] }, uuid(1));
    expect(r.repetida).toBe(false);
    expect((await dibujar(B, A, D, uuid(1))).repetida).toBe(true);
    const nota = (await cargar(A)).recibidas[0];
    expect(nota.dibujo).toEqual(D);
    expect(nota.recortado).toBe(true);
    expect(await rejects(call(B, 'select tablon_enviar_nota($1, $2, $3, $4, $5, $6)', [A, 'hola', 'crema', false, false, uuid(2)]))).toMatch(/hoy/);
    expect(await rejects(dibujar(B, A, D, uuid(3)))).toMatch(/hoy/);
  });

  it('al clavarlo el dibujo sale del buzón: no se puede falsear, pero se elige hoja o forma', async () => {
    const { actual, recibidas } = await cargar(A);
    await guardar(A, actual.id, actual.revision, [item(1, { kind: 'received', received_note_id: recibidas[0].id, dibujo: { v: 1, s: [{ c: 0, p: [1, 1] }] }, recortado: false })]);
    const i = (await cargar(A)).actual.items[0];
    expect(i.dibujo).toEqual(D);
    expect(i.recortado).toBe(false);
  });

  it('sin permiso de quien dibujó no se publica', async () => {
    const { actual } = await cargar(A);
    const r = await call(A, 'select tablon_publicar($1, $2)', [actual.id, actual.revision]);
    expect(r.faltan).toHaveLength(1);
  });

  it('quien dibujó puede retirarlo y desaparece también del mapa', async () => {
    const [enviada] = await call(B, 'select tablon_mis_enviadas()');
    expect(enviada.dibujo).toEqual(D);
    await call(B, 'select tablon_retirar_nota($1)', [enviada.id]);
    const c = await cargar(A);
    expect(c.recibidas[0].dibujo).toBeNull();
    expect(c.actual.items[0].dibujo).toBeNull();
    expect(c.actual.items[0].retirada).toBe(true);
  });

  it('un dibujo propio se valida, y con permiso llega a la copia pública', async () => {
    const { actual } = await cargar(C);
    expect(await rejects(guardar(C, actual.id, actual.revision, [item(2, { kind: 'drawing', dibujo: { v: 1, s: [{ c: 7, p: [1, 1] }] } })]))).toMatch(/dibujo/i);
    expect(await rejects(guardar(C, actual.id, actual.revision, [item(2, { kind: 'drawing' })]))).toMatch(/dibujo/i);
    await guardar(C, actual.id, actual.revision, [item(2, { kind: 'drawing', dibujo: D, recortado: true })]);
    await call(C, 'select tablon_publicar($1, $2)', [actual.id, actual.revision + 1]);
    const v = await call(A, 'select tablon_visita($1)', [C]);
    expect(v.publico.items[0].dibujo).toEqual(D);
    expect(v.publico.items[0].recortado).toBe(true);
  });

  it('no se puede enviar sin relación con la persona ni leer la columna a mano', async () => {
    expect(await rejects(as(db, B, (q) => q('select dibujo from tablon_recibidas')))).toMatch(/permission denied/);
  });
});
