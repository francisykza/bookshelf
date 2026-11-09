// 1.80 · La caja del casino: las fichas se cambian por un sobre de coleccionista (el mismo sorteo, sin tocar los
// tickets), ropa del personaje, muebles exclusivos y el conejo de la chistera. Lo de la caja se tiene una vez, no sale
// en sobres y no se recicla. Postgres real (PGlite) con todas las migraciones.
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects, REFORMA_MUEBLES } from '../../social/__tests__/supabaseHarness';
import { DEFAULT_AVATAR, PRENDAS } from '../actor';
import { catalogItem } from '../catalog';
import { starterRoom } from '../demo';
import { CAJA } from '../hotel/veintiuna';

let db;
let A, B;
const call = (u, sql, params) => as(db, u, (q) => q(sql, params)).then((r) => Object.values(r[0])[0]);
const HOY = new Date().toISOString().slice(0, 10);
const canjear = (u, articulo) => call(u, 'select piso_casino_canjear($1::date, $2)', [HOY, articulo]);
const darFichas = (u, n) => db.query('update piso_casino_cuentas set fichas = $2 where user_id = $1', [u, n]);
const fichas = (u) => db.query('select fichas from piso_casino_cuentas where user_id = $1', [u]).then((r) => r.rows[0].fichas);
const tickets = (u) => db.query('select tickets from piso_cuentas where user_id = $1', [u]).then((r) => r.rows[0].tickets);
const vestir = (u, p) => as(db, u, (q) => q('update pisos set personaje = $1::jsonb', [JSON.stringify({ ...DEFAULT_AVATAR, ...p })]));

beforeAll(async () => {
  // Reglas de sobres y muebles para cuando se reabran: sin la migración de la reforma (ver supabaseHarness)
  db = await createDatabase(Infinity, { sin: [REFORMA_MUEBLES] });
  [A, B] = await createUsers(db, 2);
  for (const [i, u] of [A, B].entries()) {
    await as(db, u, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', true)", [`Jugador ${i}`]));
    await as(db, u, (q) => q('select asignar_edificio()'));
    await as(db, u, (q) => q('insert into pisos (layout) values ($1::jsonb)', [JSON.stringify(starterRoom())]));
    await call(u, 'select piso_casino($1::date)', [HOY]);
  }
  await db.query('alter table pisos disable trigger pisos_rate');
}, 60000);

describe('la caja del casino', () => {
  it('los precios de la app son los del servidor, y lo de la caja está en el catálogo', async () => {
    const r = (await db.query('select piso_casino_caja_precios() as r')).rows[0].r;
    expect(r).toEqual(Object.fromEntries(CAJA.map((a) => [a.id, { tipo: a.tipo, precio: a.precio }])));
    for (const a of CAJA.filter((x) => x.tipo === 'mueble' || x.tipo === 'companero')) expect(catalogItem(a.id)).toMatchObject({ casino: true });
    // La ropa de la caja no se gana con las misiones del día
    const orden = (await db.query('select piso_prendas_orden() as o')).rows[0].o;
    for (const a of CAJA.filter((x) => x.tipo === 'prenda')) {
      expect(orden).not.toContain(a.id);
      expect(PRENDAS).not.toContain(a.id);
    }
  });

  it('el casino enseña la caja, de lo más barato a lo más caro, sin nada tuyo aún', async () => {
    const s = await call(A, 'select piso_casino($1::date)', [HOY]);
    expect(s.caja.map((a) => a.precio)).toEqual([...s.caja.map((a) => a.precio)].sort((x, y) => x - y));
    expect(s.caja.every((a) => a.tienes === false)).toBe(true);
    expect(await rejects(canjear(A, 'complemento:visera'))).toMatch(/Te faltan fichas/);
    expect(await rejects(canjear(A, 'tickets'))).toMatch(/no está en la caja/);
  });

  it('la ropa: se cambia una vez y entonces se puede llevar', async () => {
    await darFichas(A, 2500);
    expect(await rejects(vestir(A, { complemento: 'visera' }))).toMatch(/caja del casino/);
    const s = await canjear(A, 'complemento:visera');
    expect(s.fichas).toBe(2500 - 60);
    expect(s.caja.find((a) => a.id === 'complemento:visera').tienes).toBe(true);
    expect(await rejects(canjear(A, 'complemento:visera'))).toMatch(/ya lo tienes/);
    await vestir(A, { complemento: 'visera' });
    await canjear(A, 'jersey:16');
    await vestir(A, { jersey: 16, complemento: 'visera' });
    expect(await rejects(vestir(A, { jersey: 15 }))).toMatch(/caja del casino/);
    // Lo de siempre sigue diciendo de dónde sale
    expect(await rejects(vestir(A, { jersey: 8 }))).toMatch(/misiones del día/);
    expect(await fichas(A)).toBe(2500 - 60 - 200);
  });

  it('los muebles y el conejo: al inventario, una vez, y no se reciclan', async () => {
    await canjear(A, 'gramola');
    const s = await canjear(A, 'conejo-chistera');
    expect(s.caja.find((a) => a.id === 'conejo-chistera').tienes).toBe(true);
    const inv = await call(A, 'select piso_mi_inventario()');
    expect(inv.copias).toMatchObject({ gramola: 1, 'conejo-chistera': 1 });
    expect(await rejects(canjear(A, 'gramola'))).toMatch(/ya lo tienes/);
    for (const m of ['gramola', 'conejo-chistera']) expect(await rejects(call(A, 'select piso_reciclar($1)', [m]))).toMatch(/no se puede reciclar/);
    // El conejo te acompaña como los demás legendarios
    await as(db, A, (q) => q("update pisos set companero = 'conejo-chistera'"));
    expect(await fichas(A)).toBe(2500 - 60 - 200 - 400 - 1500);
  });

  it('el sobre: el mismo sorteo de coleccionista, y los tickets quedan igual', async () => {
    await darFichas(B, 360);
    // Con pocos tickets, con muchos y en el tope
    for (const t of [0, 500, 100000]) {
      await db.query('update piso_cuentas set tickets = $2 where user_id = $1', [B, t]);
      const s = await canjear(B, 'sobre');
      expect(s.premios).toHaveLength(1);
      expect(s.premios[0]).toHaveProperty('mueble');
      expect(await tickets(B)).toBe(t);
    }
    expect(await fichas(B)).toBe(0);
    expect(await rejects(canjear(B, 'sobre'))).toMatch(/Te faltan fichas/);
  });

  it('lo de la caja nunca sale en un sobre', async () => {
    const { rows } = await db.query("select piso_al_azar('legendario', null) as m from generate_series(1, 300)");
    expect(rows.some((r) => r.m === 'conejo-chistera')).toBe(false);
    const especial = await db.query("select piso_al_azar('especial', null) as m from generate_series(1, 100)");
    expect(especial.rows.some((r) => ['neon-veintiuna', 'mesa-tapete', 'gramola'].includes(r.m))).toBe(false);
  });

  it('sin sesión no se canjea nada, y las funciones internas no se llaman', async () => {
    expect(await rejects(as(db, null, (q) => q(`select piso_casino_canjear('${HOY}', 'sobre')`)))).toMatch(/permission denied/);
    expect(await rejects(as(db, A, (q) => q(`select piso_casino_caja('${A}')`)))).toMatch(/permission denied/);
  });
});
