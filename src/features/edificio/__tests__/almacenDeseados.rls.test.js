// 1.135 · Los muebles que sigues en el almacén, en un Postgres real (PGlite) con todas las migraciones: una lista privada de cada
// cuenta, solo de lo que el almacén vende y se puede rebajar, con tope de 40, y que llega en el estado de la caja.
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects } from '../../social/__tests__/supabaseHarness';
import { TOPE_DESEADOS, sePuedeSeguir } from '../hotel/almacenAvisos';

let db;
let A;
let B;
const call = (u, sql, params) => as(db, u, (q) => q(sql, params)).then((r) => Object.values(r[0])[0]);
const desear = (u, mueble, quiere = true) => call(u, 'select piso_almacen_desear($1, $2)', [mueble, quiere]);
const estado = (u) => call(u, 'select piso_almacen_estado()');

beforeAll(async () => {
  db = await createDatabase();
  [A, B] = await createUsers(db, 2);
  for (const [u, alias] of [
    [A, 'Lectora'],
    [B, 'Vecina'],
  ])
    await as(db, u, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', true)", [alias]));
}, 60000);

describe('los muebles que sigues', () => {
  it('nadie toca la tabla directamente, ni siquiera la suya', async () => {
    expect(await rejects(as(db, A, (q) => q('select * from piso_almacen_deseados')))).toMatch(/permission denied/);
    expect(await rejects(as(db, A, (q) => q("insert into piso_almacen_deseados (user_id, mueble) values ($1, 'mesa')", [A])))).toMatch(/permission denied/);
    expect(await rejects(as(db, null, (q) => q('select * from piso_almacen_deseados')))).toMatch(/permission denied/);
    expect(await rejects(as(db, null, (q) => q("select piso_almacen_desear('mesa', true)")))).toMatch(/permission denied/);
    expect(await rejects(as(db, A, (q) => q('select piso_almacen_deseados_de($1)', [A])))).toMatch(/permission denied/);
  });

  it('lo que se puede seguir es lo mismo en el servidor y en el cliente', async () => {
    const { rows } = await db.query('select id from piso_catalogo');
    for (const { id } of rows) {
      const ok = (await rejects(desear(A, id))) == null;
      expect(ok, id).toBe(sePuedeSeguir(id));
      if (ok) await desear(A, id, false);
    }
    expect(await estado(A)).toMatchObject({ deseados: [] });
  });

  it('seguir y dejar de seguir; repetir no duplica; la lista llega en el estado de la caja, en orden', async () => {
    expect(await desear(A, 'mesa')).toEqual(['mesa']);
    expect(await desear(A, 'reloj')).toEqual(['mesa', 'reloj']);
    expect(await desear(A, 'mesa')).toEqual(['mesa', 'reloj']);
    expect((await estado(A)).deseados).toEqual(['mesa', 'reloj']);
    expect(await desear(A, 'mesa', false)).toEqual(['reloj']);
    // Dejar de seguir lo que no sigues no falla
    expect(await desear(A, 'espejo', false)).toEqual(['reloj']);
  });

  it('nunca lo de las habitaciones especiales, ni lo de saga, ni lo retirado, ni lo que no existe', async () => {
    expect(await rejects(desear(A, 'sillon-capa'))).toMatch(/almacen:deseo/);
    const saga = (await db.query('select id from piso_catalogo where saga is not null limit 1')).rows[0]?.id;
    if (saga) expect(await rejects(desear(A, saga))).toMatch(/almacen:deseo/);
    const retirado = (await db.query('select id from piso_catalogo where saga is null and piso_retirado(id) limit 1')).rows[0]?.id;
    expect(retirado).toBeTruthy();
    expect(await rejects(desear(A, retirado))).toMatch(/almacen:deseo/);
    expect(await rejects(desear(A, 'sofa-volador'))).toMatch(/almacen:deseo/);
    expect(await rejects(call(A, 'select piso_almacen_desear($1, $2)', ['mesa', null]))).toMatch(/almacen:deseo/);
  });

  it('es de cada cuenta: la otra no la ve ni la cambia', async () => {
    expect((await estado(B)).deseados).toEqual([]);
    expect(await desear(B, 'reloj', false)).toEqual([]);
    expect((await estado(A)).deseados).toEqual(['reloj']);
  });

  it(`como mucho ${TOPE_DESEADOS} a la vez (dejar de seguir siempre se puede)`, async () => {
    // El almacén vende menos de 40: se llena a mano para probar el tope
    await db.query("insert into piso_almacen_deseados (user_id, mueble) select $1, 'relleno-' || g from generate_series(1, $2) g", [B, TOPE_DESEADOS]);
    expect(await rejects(desear(B, 'mesa'))).toMatch(/almacen:deseos/);
    const lista = await desear(B, 'relleno-1', false);
    expect(lista).toHaveLength(TOPE_DESEADOS - 1);
    expect(await desear(B, 'mesa')).toHaveLength(TOPE_DESEADOS);
  });
});
