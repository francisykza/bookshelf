// 1.112 · Los premios nuevos del casino: el reloj y la alfombra de la caja, y los premios de las chisteras, que se cambian
// por sellos de partidas perfectas (la chistera de mago, la varita, el baúl y el acabado «Polvo de estrellas»). Postgres real
// (PGlite): los sellos los cuenta el servidor, cada premio una vez y nunca con tickets.
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects } from '../../social/__tests__/supabaseHarness';
import { PREMIOS_CHISTERAS } from '../hotel/chisteras';
import { PREMIOS_QUE_SE_TIENEN } from '../hotel/vitrina';
import { CAJA } from '../hotel/veintiuna';
import { COMPLEMENTOS, DEFAULT_AVATAR, ROPA_CHISTERAS } from '../actor';
import { CATALOG, catalogItem } from '../catalog';
import { isRetirado } from '../retirados';
import { admiteAcabado } from '../acabados';
import { starterRoom } from '../demo';

let db;
let A, B;
const call = (u, sql, params) => as(db, u, (q) => q(sql, params)).then((r) => Object.values(r[0])[0]);
const HOY = new Date().toISOString().slice(0, 10);
const canjear = (u, premio, mueble = null) => call(u, 'select piso_casino_chisteras_canjear($1::date, $2, $3)', [HOY, premio, mueble]);
const chisteras = (u) => call(u, 'select piso_casino_chisteras($1::date)', [HOY]);
const vestir = (u, p) => as(db, u, (q) => q('update pisos set personaje = $1::jsonb', [JSON.stringify({ ...DEFAULT_AVATAR, ...p })]));
/** `n` partidas perfectas en días pasados (desde `desde` días atrás). */
async function perfectas(u, n, desde = 30) {
  for (let k = 0; k < n; k += 1) {
    await db.query("insert into piso_casino_chisteras (user_id, dia, estado, ronda, aciertos, fichas) values ($1, current_date - $2::integer, 'hecha', 3, 3, 10)", [u, desde + k]);
  }
}
const dar = (u, m, n) => db.query('insert into piso_inventario (user_id, mueble, copias) values ($1, $2, $3) on conflict (user_id, mueble) do update set copias = $3', [u, m, n]);

beforeAll(async () => {
  db = await createDatabase(Infinity);
  [A, B] = await createUsers(db, 2);
  for (const [i, u] of [A, B].entries()) {
    await as(db, u, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', true)", [`Jugador ${i}`]));
    await as(db, u, (q) => q('select asignar_edificio()'));
    await as(db, u, (q) => q('insert into pisos (layout) values ($1::jsonb)', [JSON.stringify(starterRoom())]));
    await call(u, 'select piso_casino($1::date)', [HOY]);
  }
}, 60000);

describe('los premios nuevos del casino', () => {
  it('los de la app son los del servidor: caja, chisteras, ropa, catálogo y vitrina', async () => {
    const caja = (await db.query('select piso_casino_caja_precios() as r')).rows[0].r;
    expect(caja).toMatchObject({ 'complemento:reloj-bolsillo': { tipo: 'prenda', precio: 180 }, 'alfombra-rombos': { tipo: 'mueble', precio: 350 } });
    expect(CAJA.map((a) => a.id)).toEqual(expect.arrayContaining(['complemento:reloj-bolsillo', 'alfombra-rombos']));
    const premios = (await db.query('select piso_casino_chisteras_premios() as r')).rows[0].r;
    expect(premios).toEqual(Object.fromEntries(PREMIOS_CHISTERAS.map((p) => [p.id, { tipo: p.tipo, sellos: p.sellos }])));
    expect((await db.query('select piso_casino_chisteras_ropa() as r')).rows[0].r).toEqual(ROPA_CHISTERAS);
    for (const id of ['alfombra-rombos', 'baul-mago']) {
      expect(catalogItem(id)).toMatchObject({ rareza: 'especial', casino: true });
      expect(isRetirado(id)).toBe(false);
      expect((await db.query('select rareza from piso_catalogo where id = $1', [id])).rows[0].rareza).toBe('especial');
    }
    for (const c of ['reloj-bolsillo', 'chistera-mago', 'varita']) expect(COMPLEMENTOS.map((x) => x.id)).toContain(c);
    const vit = (await db.query('select piso_casino_vitrina_premios() as r')).rows[0].r;
    expect([...vit].sort()).toEqual([...PREMIOS_QUE_SE_TIENEN].sort());
  });

  it('sin partidas perfectas no hay sellos; cada perfecta es uno y la tienda lo dice', async () => {
    const c = await chisteras(A);
    expect(c.tienda).toMatchObject({ sellos: 0 });
    expect(c.tienda.premios.map((p) => p.id)).toEqual(PREMIOS_CHISTERAS.map((p) => p.id));
    expect(await rejects(canjear(A, 'complemento:chistera-mago'))).toMatch(/faltan sellos/);
    // Una partida de dos aciertos no cuenta
    await db.query("insert into piso_casino_chisteras (user_id, dia, estado, ronda, aciertos, fichas) values ($1, current_date - 90, 'hecha', 3, 2, 6)", [A]);
    await perfectas(A, 3);
    expect((await chisteras(A)).tienda.sellos).toBe(3);
  });

  it('la chistera de mago se cambia una vez, gasta sus sellos y ya se puede llevar; la varita, aún no', async () => {
    const c = await canjear(A, 'complemento:chistera-mago');
    expect(c.tienda.sellos).toBe(1);
    expect(c.tienda.premios.find((p) => p.id === 'complemento:chistera-mago').tienes).toBe(true);
    expect(await rejects(canjear(A, 'complemento:chistera-mago'))).toMatch(/ya lo tienes/);
    await vestir(A, { complemento: 'chistera-mago' });
    expect(await rejects(vestir(A, { complemento: 'varita' }))).toMatch(/sellos de las chisteras/);
    // Ni el reloj de la caja sin cambiarlo antes por fichas
    expect(await rejects(vestir(A, { complemento: 'reloj-bolsillo' }))).toMatch(/fichas en la caja/);
  });

  it('el baúl, al inventario; el acabado, en una copia lisa tuya y solo en un mueble que lo admita', async () => {
    await perfectas(A, 20, 200);
    await canjear(A, 'complemento:varita');
    const b = await canjear(A, 'baul-mago');
    expect((await db.query("select copias from piso_inventario where user_id = $1 and mueble = 'baul-mago'", [A])).rows[0].copias).toBe(1);
    const m = CATALOG.find((x) => admiteAcabado(x) && !isRetirado(x.id) && x.rareza === undefined).id;
    expect(b.tienda.acabables).not.toContain(m);
    expect(await rejects(canjear(A, 'acabado:polvo-estrellas', m))).toMatch(/copia lisa/);
    expect(await rejects(canjear(A, 'acabado:polvo-estrellas', 'baul-mago'))).toMatch(/no admite/);
    expect(await rejects(canjear(A, 'acabado:polvo-estrellas'))).toMatch(/no admite/);
    await dar(A, m, 2);
    expect((await chisteras(A)).tienda.acabables).toContain(m);
    const v = await canjear(A, 'acabado:polvo-estrellas', m);
    expect(v.tienda.sellos).toBe(23 - 2 - 4 - 6 - 10);
    expect((await db.query('select acabado, copias from piso_acabados where user_id = $1 and mueble = $2', [A, m])).rows).toEqual([{ acabado: 'polvo-estrellas', copias: 1 }]);
    expect(await rejects(canjear(A, 'acabado:polvo-estrellas', m))).toMatch(/ya lo tienes/);
    // Y en la vitrina, los cuatro
    const vit = await call(A, 'select piso_casino_vitrina(null::uuid)');
    expect(vit.tienes).toEqual(expect.arrayContaining(PREMIOS_CHISTERAS.map((p) => p.id)));
  });

  it('los sellos son de cada uno, los premios no salen en sobres y no se cambian por tickets', async () => {
    expect((await chisteras(B)).tienda.sellos).toBe(0);
    expect(await rejects(canjear(B, 'tickets'))).toMatch(/no se cambia por sellos/);
    const ex = (await db.query('select piso_casino_exclusivos() as r')).rows[0].r;
    expect(ex).toEqual(expect.arrayContaining(['alfombra-rombos', 'baul-mago']));
    await rejects(as(db, A, (q) => q('select piso_casino_chisteras_sellos($1::uuid)', [B])), /permission denied/);
    await rejects(as(db, null, (q) => q('select piso_casino_chisteras_canjear(current_date, $1, null)', ['baul-mago'])), /permission denied|Inicia sesión/);
    await rejects(as(db, A, (q) => q('select * from piso_casino_chisteras_canjes')), /permission denied/);
  });
});
