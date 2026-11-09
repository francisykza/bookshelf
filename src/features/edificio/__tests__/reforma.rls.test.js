// Reestructuración de muebles (Francisco, 9-11-2026) en un Postgres real (PGlite) con todas las migraciones: la lista de
// retirados del servidor es la de retirados.js; los sobres están cerrados por reforma (también el de la caja del
// casino) y lo retirado no se compra, no se cambia en el casino ni en la lata, no se regala ni se pone en la Lonja.
// Lo de la casa se sigue comprando. Nada se borra: quien tenía una copia retirada la conserva.
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects } from '../../social/__tests__/supabaseHarness';
import { starterRoom } from '../demo';
import { RETIRADOS } from '../retirados';

let db;
let A, B;
const call = (u, sql, params) => as(db, u, (q) => q(sql, params)).then((r) => Object.values(r[0])[0]);
const hoy = () => new Date().toISOString().slice(0, 10);

beforeAll(async () => {
  db = await createDatabase();
  [A, B] = await createUsers(db, 2);
  for (const [i, u] of [A, B].entries()) {
    await as(db, u, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', true)", [`Vecino ${i}`]));
    await as(db, u, (q) => q('select asignar_edificio()'));
    await as(db, u, (q) => q('insert into pisos (layout) values ($1::jsonb)', [JSON.stringify(starterRoom())]));
  }
  await db.query('update piso_cuentas set tickets = 500 where user_id = $1', [A]);
  // A tiene tres sofás de antes de la reforma
  await db.query("insert into piso_inventario (user_id, mueble, copias) values ($1, 'sofa', 3) on conflict (user_id, mueble) do update set copias = 3", [A]);
}, 60000);

describe('la reforma en el servidor', () => {
  it('la lista de retirados es la de retirados.js', async () => {
    const { rows } = await db.query('select piso_retirados() as l');
    expect([...rows[0].l].sort()).toEqual([...RETIRADOS].sort());
  });

  it('las listas no se pueden llamar desde la app', async () => {
    for (const rol of ['anon', 'authenticated']) {
      for (const f of ['public.piso_retirados()', 'public.piso_retirado(text)']) {
        const { rows } = await db.query('select has_function_privilege($1, $2, $3) as p', [rol, f, 'execute']);
        expect(rows[0].p, `${rol} ${f}`).toBe(false);
      }
    }
  });

  it('los sobres están cerrados por reforma y no cobran', async () => {
    for (const s of ['salon', 'luces', 'balcon', 'coleccion']) {
      expect(await rejects(call(A, 'select piso_abrir_sobre($1, 1)', [s]))).toMatch(/cerrados por reforma/);
    }
    expect((await db.query('select tickets from piso_cuentas where user_id = $1', [A])).rows[0].tickets).toBe(500);
  });

  it('lo retirado no se compra; lo de la casa, sí', async () => {
    expect(await rejects(call(A, "select piso_comprar('sofa')"))).toMatch(/en reforma/);
    expect(await rejects(call(A, "select piso_comprar('lampara-mesa')"))).toMatch(/en reforma/);
    await call(A, "select piso_comprar('sillon')");
    const { rows } = await db.query("select copias from piso_inventario where user_id = $1 and mueble = 'sillon'", [A]);
    expect(rows[0].copias).toBeGreaterThan(0);
  });

  it('ni en el casino ni en la lata, ni se regala ni se pone en la Lonja', async () => {
    expect(await rejects(call(A, "select piso_casino_canjear($1::date, 'gramola')", [hoy()]))).toMatch(/en reforma/);
    expect(await rejects(call(A, "select piso_casino_canjear($1::date, 'mesa-tapete')", [hoy()]))).toMatch(/en reforma/);
    expect(await rejects(call(A, "select piso_casino_lata_canjear($1::date, 'tarro-garbanzos')", [hoy()]))).toMatch(/en reforma/);
    expect(await rejects(call(A, "select piso_regalar($1, 'sofa')", [B]))).toMatch(/en reforma/);
    expect(await rejects(call(A, "select piso_lonja_poner('sofa', null, 10)"))).toMatch(/en reforma/);
  });

  it('nada se borra: los sofás de A siguen ahí', async () => {
    const { rows } = await db.query("select copias from piso_inventario where user_id = $1 and mueble = 'sofa'", [A]);
    expect(rows[0].copias).toBe(3);
  });
});
