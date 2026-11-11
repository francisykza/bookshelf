// 1.111 · La vitrina de premios del casino: lo que tienes de la caja, la lata y la ruleta, tus fichas y garbanzos y los
// hitos logrados, calculados en el servidor; los amigos (os seguís los dos) la ven, los demás no. Postgres real (PGlite).
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects } from '../../social/__tests__/supabaseHarness';
import { HITOS, PREMIOS_QUE_SE_TIENEN } from '../hotel/vitrina';
import { starterRoom } from '../demo';

let db;
let A, B, C;
const call = (u, sql, params) => as(db, u, (q) => q(sql, params)).then((r) => Object.values(r[0])[0]);
const HOY = new Date().toISOString().slice(0, 10);
const vitrina = (u, otro = null) => call(u, 'select piso_casino_vitrina($1::uuid)', [otro]);
const seguir = (a, b) => db.query('insert into follows (follower, followed) values ($1, $2)', [a, b]);
/** Manos cerradas en días pasados (sin tocar las fichas). */
async function manos(u, estados) {
  for (const [i, e] of estados.entries()) {
    await db.query("insert into piso_casino_manos (user_id, dia, mano, mazo, tuyas, crupier, estado) values ($1, current_date - $2::integer, $3, '{}', '{}', '{}', $4)", [u, 100 + Math.floor(i / 3), (i % 3) + 1, e]);
  }
}

beforeAll(async () => {
  db = await createDatabase(Infinity);
  [A, B, C] = await createUsers(db, 3);
  for (const [i, u] of [A, B, C].entries()) {
    await as(db, u, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', true)", [`Jugador ${i}`]));
    await as(db, u, (q) => q('select asignar_edificio()'));
    await as(db, u, (q) => q('insert into pisos (layout) values ($1::jsonb)', [JSON.stringify(starterRoom())]));
    await call(u, 'select piso_casino($1::date)', [HOY]);
  }
  // A y B se siguen los dos; C solo sigue a A
  await seguir(A, B);
  await seguir(B, A);
  await seguir(C, A);
}, 60000);

describe('la vitrina de premios', () => {
  it('los premios y los hitos de la app son los del servidor', async () => {
    expect((await db.query('select piso_casino_vitrina_hitos() as r')).rows[0].r).toEqual(HITOS.map((h) => h.id));
    const r = (await db.query('select piso_casino_vitrina_premios() as r')).rows[0].r;
    expect([...r].sort()).toEqual([...PREMIOS_QUE_SE_TIENEN].sort());
  });

  it('al empezar, nada ganado: las fichas, los garbanzos del día y ningún hito', async () => {
    const v = await vitrina(A);
    expect(v).toMatchObject({ uid: A, tienes: [], fichas: 0, hitos: [] });
    expect(v.garbanzos).toBeGreaterThanOrEqual(100);
  });

  it('lo que tienes, de la caja, la lata y la ruleta, prendas y muebles', async () => {
    await db.query("insert into piso_prendas (user_id, prenda) values ($1, 'jersey:15'), ($1, 'jersey:22'), ($1, 'jersey:3')", [A]);
    await db.query("select piso_sumar($1, 'gramola', 1), piso_sumar($1, 'tarro-garbanzos', 1), piso_sumar($1, 'mapache-crupier', 1), piso_sumar($1, 'sofa', 1)", [A]);
    const v = await vitrina(A);
    // Lo que no es del casino (un jersey de misiones, un sofá) no sale
    expect([...v.tienes].sort()).toEqual(['gramola', 'jersey:15', 'jersey:22', 'mapache-crupier', 'tarro-garbanzos']);
  });

  it('los hitos: manos, ruleta y chisteras, cada uno en su número', async () => {
    await manos(A, [...Array(9).fill('ganada'), 'veintiuna', ...Array(40).fill('perdida')]);
    const lunes = (k) => `(date_trunc('week', current_date)::date - ${7 * k})`;
    for (const [k, premio, casilla] of [[1, 'fichas:20', 0], [2, 'fichas:40', 2], [3, 'reloj-deco', 7], [4, 'mapache-crupier', 8]]) {
      await db.query(`insert into piso_casino_ruleta (user_id, semana, casilla, premio) values ($1, ${lunes(k)}, $2, $3)`, [A, casilla, premio]);
    }
    for (let k = 0; k < 10; k += 1) {
      await db.query("insert into piso_casino_chisteras (user_id, dia, estado, ronda, aciertos, fichas) values ($1, current_date - $2::integer, 'hecha', 3, $3, 1)", [A, 10 + k, k < 5 ? 3 : 1]);
    }
    expect((await vitrina(A)).hitos).toEqual(HITOS.map((h) => h.id));
    // B, a medias: una mano ganada y una partida sin perfecta; un giro de fichas
    await manos(B, ['ganada', 'perdida']);
    await db.query(`insert into piso_casino_ruleta (user_id, semana, casilla, premio) values ($1, ${lunes(1)}, 0, 'fichas:20')`, [B]);
    await db.query("insert into piso_casino_chisteras (user_id, dia, estado, ronda, aciertos) values ($1, current_date - 20, 'hecha', 3, 2)", [B]);
    expect((await vitrina(B)).hitos).toEqual(['21-primera', 'ruleta-primera', 'chisteras-primera']);
  });

  it('un amigo ve tu vitrina, con tu alias; quien no os seguís los dos, no', async () => {
    const v = await vitrina(B, A);
    expect(v).toMatchObject({ uid: A, alias: 'Jugador 0' });
    expect(v.tienes).toContain('mapache-crupier');
    expect(v.hitos).toHaveLength(12);
    await rejects(as(db, C, (q) => q('select piso_casino_vitrina($1::uuid)', [A])), /os tenéis que seguir los dos/);
    await rejects(as(db, null, (q) => q('select piso_casino_vitrina(null)')), /permission denied|Inicia sesión/);
    await rejects(as(db, A, (q) => q('select piso_casino_vitrina_de_cuenta($1::uuid)', [C])), /permission denied/);
  });
});
