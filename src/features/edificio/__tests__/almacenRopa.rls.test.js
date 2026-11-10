// 1.105 · La ropa propia de la planta de ropa del almacén en un Postgres real (PGlite) con todas las migraciones: los precios
// son los del cliente, se compra todo o nada, la clave repetida no cobra dos veces, lo de misiones, casino y estiba no se vende,
// solo se lleva lo que tienes y el pulso de la visita sabe de la planta de abajo.
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects } from '../../social/__tests__/supabaseHarness';
import { DEFAULT_AVATAR, ROPA_TIENDA } from '../actor';
import { starterRoom } from '../demo';

let db;
let A, B;
const call = (u, sql, params) => as(db, u, (q) => q(sql, params)).then((r) => Object.values(r[0])[0]);
const comprar = (u, clave, prendas, esperado) => call(u, 'select piso_almacen_ropa_comprar($1::uuid, $2::jsonb, $3)', [clave, JSON.stringify(prendas), esperado]);
const tickets = (u) => db.query('select tickets from piso_cuentas where user_id = $1', [u]).then((r) => r.rows[0].tickets);
const prendas = (u) => db.query('select prenda from piso_prendas where user_id = $1 order by prenda', [u]).then((r) => r.rows.map((x) => x.prenda));
const vestir = (u, p) => as(db, u, (q) => q('update pisos set personaje = $1::jsonb where user_id = auth.uid()', [JSON.stringify(p)]));
const K = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

beforeAll(async () => {
  db = await createDatabase();
  [A, B] = await createUsers(db, 2);
  for (const [i, u] of [A, B].entries()) {
    await as(db, u, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', true)", [`Cliente ${i}`]));
    await call(u, 'select piso_almacen_estado()');
  }
  await db.query('update piso_cuentas set tickets = 100 where user_id = $1', [A]);
  await as(db, A, (q) => q('insert into pisos (layout) values ($1::jsonb)', [JSON.stringify(starterRoom())]));
}, 60000);

describe('la ropa de la planta', () => {
  it('los precios del servidor son los del cliente', async () => {
    const r = await db.query('select piso_almacen_ropa() as t');
    expect(r.rows[0].t).toEqual(ROPA_TIENDA);
    // Es interna (20261130120000_almacen_ropa_permisos.sql): nadie la llama directamente, ni con sesión
    expect(await rejects(call(A, 'select piso_almacen_ropa()'))).toMatch(/permission denied/);
  });

  it('se compra todo junto y va al armario', async () => {
    const r = await comprar(A, K(1), ['jersey:19', 'complemento:pompon'], 46);
    expect(r).toMatchObject({ repetida: false, total: 46, ropa: ['jersey:19', 'complemento:pompon'] });
    expect(r.prendas).toEqual(expect.arrayContaining(['jersey:19', 'complemento:pompon']));
    expect(await tickets(A)).toBe(54);
  });

  it('la misma clave no cobra dos veces', async () => {
    const r = await comprar(A, K(1), ['jersey:19', 'complemento:pompon'], 46);
    expect(r.repetida).toBe(true);
    expect(await tickets(A)).toBe(54);
  });

  it('lo que ya tienes, lo de misiones, casino o estiba, el total que no cuadra o sin saldo: no se cobra nada', async () => {
    await rejects(comprar(A, K(2), ['jersey:19'], 30), /almacen:ya_tuya/);
    await rejects(comprar(A, K(3), ['jersey:12'], 0), /almacen:no_se_vende/);
    await rejects(comprar(A, K(4), ['jersey:16'], 0), /almacen:no_se_vende/);
    await rejects(comprar(A, K(5), ['pantalon:10'], 0), /almacen:no_se_vende/);
    await rejects(comprar(A, K(6), ['jersey:18', 'jersey:18'], 60), /almacen:linea/);
    await rejects(comprar(A, K(7), ['jersey:18'], 10), /almacen:precio/);
    await rejects(comprar(A, K(8), ['jersey:18', 'jersey:20', 'jersey:21'], 86), /almacen:saldo/);
    await rejects(comprar(A, K(9), [], 0), /almacen:vacio/);
    expect(await tickets(A)).toBe(54);
    expect(await prendas(A)).toEqual(['complemento:pompon', 'jersey:19']);
  });

  it('una clave de otra persona no sirve', async () => {
    await rejects(comprar(B, K(1), ['jersey:19'], 30), /almacen:clave/);
  });

  it('solo se lleva lo que tienes', async () => {
    await vestir(A, { ...DEFAULT_AVATAR, jersey: 19, complemento: 'pompon' });
    await rejects(vestir(A, { ...DEFAULT_AVATAR, jersey: 21 }), /planta de ropa del almacén/);
  });

  it('el pulso guarda la planta de abajo como la zona «ropa»', async () => {
    await db.query('insert into follows (follower, followed) values ($1, $2), ($2, $1)', [A, B]);
    const { sala } = await call(A, 'select piso_almacen_invitar($1::uuid)', [B]);
    await call(B, 'select piso_almacen_unirse($1::uuid)', [sala]);
    const pulso = (u, zona) => call(u, 'select piso_almacen_pulso($1::uuid, 11.5, 9, 0, $2, null, 0, null)', [sala, zona]);
    await pulso(A, 'ropa');
    const r = await pulso(B, 'pasillos');
    expect(r.otros[0].zona).toBe('ropa');
    await pulso(A, 'sotano');
    expect((await pulso(B, 'pasillos')).otros[0].zona).toBe('pasillos');
  });
});
