// 1.110 · «Las tres chisteras»: el servidor baraja cada ronda (de nuevo cada vez que se mira), comprueba la elección una
// sola vez por ronda y da las fichas al acabar, dentro del tope de la semana. Postgres real (PGlite) con todas las migraciones.
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects } from '../../social/__tests__/supabaseHarness';
import { CHISTERAS_JUEGO, conejoTras, fichasPor } from '../hotel/chisteras';
import { starterRoom } from '../demo';

let db;
let A, B, C, D;
const call = (u, sql, params) => as(db, u, (q) => q(sql, params)).then((r) => Object.values(r[0])[0]);
const HOY = new Date().toISOString().slice(0, 10);
const ver = (u, dia = HOY) => call(u, 'select piso_casino_chisteras_ver($1::date)', [dia]);
const elegir = (u, n, dia = HOY) => call(u, 'select piso_casino_chisteras_elegir($1::date, $2::integer)', [dia, n]);
const partida = (u, dia = HOY) => call(u, 'select piso_casino_chisteras($1::date)', [dia]);
const cuenta = async (u) => (await db.query('select fichas from piso_casino_cuentas where user_id = $1', [u])).rows[0]?.fichas ?? 0;
/** Juega una ronda: acierta o falla a propósito, con lo que enseñó el servidor. */
async function ronda(u, acertar) {
  const v = await ver(u);
  const bien = conejoTras(v.inicio, v.cambios);
  return elegir(u, acertar ? bien : (bien + 1) % 3);
}

beforeAll(async () => {
  db = await createDatabase(Infinity);
  [A, B, C, D] = await createUsers(db, 4);
  for (const [i, u] of [A, B, C].entries()) {
    await as(db, u, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', true)", [`Jugador ${i}`]));
    await as(db, u, (q) => q('select asignar_edificio()'));
    await as(db, u, (q) => q('insert into pisos (layout) values ($1::jsonb)', [JSON.stringify(starterRoom())]));
    await call(u, 'select piso_casino($1::date)', [HOY]);
  }
  // D, sin la comunidad
  await as(db, D, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ('Sin comunidad', 'gato-lector', false)"));
}, 60000);

describe('las tres chisteras', () => {
  it('las reglas de la app son las del servidor, y el conejo acaba donde dicen los dos', async () => {
    expect((await db.query('select piso_casino_chisteras_reglas() as r')).rows[0].r).toEqual(CHISTERAS_JUEGO);
    for (const [inicio, cambios] of [
      [0, []],
      [0, [0]],
      [1, [0, 1, 2]],
      [2, [2, 2, 1, 0, 1]],
      [1, [1, 1, 1, 0, 2, 2, 0]],
    ]) {
      const s = (await db.query('select piso_casino_chisteras_final($1, $2::smallint[]) as r', [inicio, cambios])).rows[0].r;
      expect(s).toBe(conejoTras(inicio, cambios));
    }
    expect([0, 1, 2, 3].map(fichasPor)).toEqual([1, 3, 6, 10]);
  });

  it('antes de mirar no se sabe nada, y mirar baraja la ronda de nuevo cada vez', async () => {
    const p = await partida(A);
    expect(p).toMatchObject({ estado: null, ronda: 1, aciertos: 0, fichas: 0, perfectas: 0, tope: 150 });
    expect(p.inicio).toBeUndefined();
    expect(p.cambios).toBeUndefined();
    await rejects(as(db, A, (q) => q('select piso_casino_chisteras_elegir($1::date, 0)', [HOY])), /Primero mira la ronda/);
    const vistas = [];
    for (let i = 0; i < 6; i += 1) vistas.push(await ver(A));
    for (const v of vistas) {
      expect(v).toMatchObject({ estado: 'jugando', ronda: 1 });
      expect(v.cambios).toHaveLength(CHISTERAS_JUEGO.cambios[0]);
      expect(v.cambios.every((k) => [0, 1, 2].includes(k))).toBe(true);
      expect([0, 1, 2]).toContain(v.inicio);
    }
    // Barajadas distintas (seis iguales seguidas serían una casualidad de 1 entre 81⁵)
    expect(new Set(vistas.map((v) => JSON.stringify([v.inicio, v.cambios]))).size).toBeGreaterThan(1);
    // Lo que no se ha enseñado no se puede leer de ningún otro modo
    const leida = await partida(A);
    expect(leida.inicio).toBeUndefined();
    await rejects(as(db, A, (q) => q('select * from piso_casino_chisteras')), /permission denied/);
  });

  it('se comprueba con la última barajada, una vez por ronda, y cada ronda trae más cambios', async () => {
    const v1 = await ver(A);
    const r1 = await elegir(A, conejoTras(v1.inicio, v1.cambios));
    expect(r1).toMatchObject({ acierto: true, ronda: 2, aciertos: 1, estado: 'jugando', fichas: 0 });
    expect(r1.rondas).toEqual([{ elegida: r1.conejo, conejo: r1.conejo, acierto: true }]);
    // Sin volver a mirar, no se elige otra vez
    await rejects(as(db, A, (q) => q('select piso_casino_chisteras_elegir($1::date, 0)', [HOY])), /Primero mira la ronda/);
    const v2 = await ver(A);
    expect(v2.cambios).toHaveLength(CHISTERAS_JUEGO.cambios[1]);
    const bien = conejoTras(v2.inicio, v2.cambios);
    const r2 = await elegir(A, (bien + 2) % 3);
    expect(r2).toMatchObject({ acierto: false, conejo: bien, ronda: 3, aciertos: 1 });
    const v3 = await ver(A);
    expect(v3.cambios).toHaveLength(CHISTERAS_JUEGO.cambios[2]);
    const antes = await cuenta(A);
    const r3 = await elegir(A, conejoTras(v3.inicio, v3.cambios));
    expect(r3).toMatchObject({ acierto: true, estado: 'hecha', aciertos: 2, fichas: fichasPor(2), perfectas: 0 });
    expect(r3.rondas).toHaveLength(3);
    expect(await cuenta(A)).toBe(antes + fichasPor(2));
    // Una partida al día
    await rejects(as(db, A, (q) => q('select piso_casino_chisteras_ver($1::date)', [HOY])), /Hoy ya has jugado/);
    await rejects(as(db, A, (q) => q('select piso_casino_chisteras_elegir($1::date, 1)', [HOY])), /Hoy ya has jugado/);
  });

  it('tres de tres es una partida perfecta; sin acertar ninguna, una ficha igual', async () => {
    for (let i = 0; i < 3; i += 1) await ronda(B, true);
    const b = await partida(B);
    expect(b).toMatchObject({ estado: 'hecha', aciertos: 3, fichas: 10, perfectas: 1 });
    for (let i = 0; i < 3; i += 1) await ronda(C, false);
    expect(await partida(C)).toMatchObject({ estado: 'hecha', aciertos: 0, fichas: 1, perfectas: 0 });
  });

  it('las fichas van dentro del tope de la semana, junto a las manos del 21', async () => {
    const semana = (await partida(B)).semana;
    expect(semana).toBeGreaterThanOrEqual(10);
    // Mañana, con la semana casi llena (otra partida a mano en la misma semana), solo da lo que cabe
    const lunes = (await db.query("select date_trunc('week', $1::date)::date as l", [HOY])).rows[0].l;
    const otro = (await db.query("select (case when $1::date = $2::date then $1::date + 1 else $1::date - 1 end)::text as d", [HOY, lunes])).rows[0].d;
    await db.query('delete from piso_casino_chisteras where user_id = $1 and dia = $2::date', [B, HOY]);
    const sin = (await partida(B)).semana;
    expect(sin).toBe(semana - 10);
    await db.query("insert into piso_casino_chisteras (user_id, dia, estado, aciertos, fichas) values ($1, $2::date, 'hecha', 3, $3)", [B, otro, 146 - sin]);
    expect((await partida(B)).semana).toBe(146);
    const antes = await cuenta(B);
    for (let i = 0; i < 3; i += 1) await ronda(B, true);
    const b = await partida(B);
    expect(b).toMatchObject({ fichas: 4, semana: 150 });
    expect(await cuenta(B)).toBe(antes + 4);
  });

  it('una chistera que no está en la mesa, otro día, sin comunidad o sin sesión: no', async () => {
    await rejects(as(db, C, (q) => q('select piso_casino_chisteras_elegir($1::date, 3)', [HOY])), /no está en la mesa/);
    await rejects(as(db, C, (q) => q("select piso_casino_chisteras_ver((current_date - 5)::date)")), /ya no se puede jugar/);
    await rejects(as(db, D, (q) => q('select piso_casino_chisteras_ver($1::date)', [HOY])), /Activa la comunidad/);
    await rejects(as(db, null, (q) => q('select piso_casino_chisteras_ver($1::date)', [HOY])), /permission denied|Inicia sesión/);
    await rejects(as(db, A, (q) => q('select piso_casino_chisteras_vista($1::uuid, $2::date)', [B, HOY])), /permission denied/);
  });
});
