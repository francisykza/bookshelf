// 1.80 · El casino del sótano (docs/qa/gran-hotel.md §9.4): «Las 21 páginas», tres manos al día sin apostar. Cada mano
// da fichas según cómo acaba (nunca se pierde nada), con un tope semanal; el servidor reparte, esconde la carta tapada
// del crupier y puntúa. Postgres real (PGlite) con todas las migraciones. Para probar finales concretos se coloca el
// mazo a mano, como superusuario.
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects } from '../../social/__tests__/supabaseHarness';
import { CASINO, valor } from '../hotel/veintiuna';

let db;
let A, B;
const call = (u, sql, params) => as(db, u, (q) => q(sql, params)).then((r) => Object.values(r[0])[0]);
const HOY = new Date().toISOString().slice(0, 10);
const casino = (u, dia = HOY) => call(u, 'select piso_casino($1::date)', [dia]);
const repartir = (u, dia = HOY) => call(u, 'select piso_casino_repartir($1::date)', [dia]);
const jugar = (u, accion, dia = HOY) => call(u, 'select piso_casino_jugar($1::date, $2)', [dia, accion]);
// Cartas: palo × 13 + valor (0 es el as, 9 el diez, 10–12 las figuras)
const colocar = (u, n, { tuyas, crupier, mazo }) =>
  db.query('update piso_casino_manos set tuyas = $3, crupier = $4, mazo = $5 where user_id = $1 and mano = $2 and dia = current_date', [u, n, tuyas, crupier, mazo]);
const fichas = (u) => db.query('select fichas from piso_casino_cuentas where user_id = $1', [u]).then((r) => r.rows[0]?.fichas ?? 0);

beforeAll(async () => {
  db = await createDatabase();
  [A, B] = await createUsers(db, 2);
  for (const [i, u] of [A, B].entries()) {
    await as(db, u, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', true)", [`Jugador ${i}`]));
  }
}, 60000);

describe('las 21 páginas', () => {
  it('las cifras de la app son las del servidor', async () => {
    const r = (await db.query('select piso_casino_reglas() as r')).rows[0].r;
    expect(r).toEqual(CASINO);
    for (const cartas of [
      [0, 12],
      [0, 0, 9],
      [5, 6, 9],
      [0, 0, 0, 0],
      [12, 11, 1],
    ]) {
      const v = (await db.query('select piso_casino_valor($1::smallint[]) as v', [cartas])).rows[0].v;
      expect(v).toBe(valor(cartas));
    }
  });

  it('se empieza sin fichas y con tres manos por jugar', async () => {
    expect(await casino(A)).toMatchObject({ fichas: 0, semana: 0, tope: 150, manos: [], quedan: 3, jugando: false });
  });

  it('al repartir solo se ve la primera carta del crupier, y no el mazo', async () => {
    const s = await repartir(A);
    // Si salió una veintiuna servida, la mano ya está cerrada: se vuelve a colocar para seguir la prueba
    await db.query("update piso_casino_manos set estado = 'jugando', fichas = 0 where user_id = $1", [A]);
    await db.query('update piso_casino_cuentas set fichas = 0 where user_id = $1', [A]);
    await colocar(A, 1, { tuyas: [9, 6], crupier: [8, 5], mazo: [12, 1, 2, 3] });
    const t = await casino(A);
    expect(s.manos).toHaveLength(1);
    expect(t.manos[0]).toMatchObject({ mano: 1, tuyas: [9, 6], crupier: [8], tu: 17, suyo: null, estado: 'jugando' });
    expect(JSON.stringify(t)).not.toContain('mazo');
    expect(t).toMatchObject({ jugando: true, quedan: 2 });
    expect(await rejects(repartir(A))).toMatch(/Termina antes/);
  });

  it('plantarse: el crupier pide hasta 17 y, si se pasa, ganas 8 fichas', async () => {
    const s = await jugar(A, 'plantarse');
    expect(s.manos[0]).toMatchObject({ crupier: [8, 5, 12], suyo: 25, estado: 'ganada', fichas: CASINO.ganada });
    expect(s).toMatchObject({ fichas: 8, semana: 8, jugando: false });
    expect(await rejects(jugar(A, 'plantarse'))).toMatch(/ninguna mano abierta/);
  });

  it('pedir y pasarse: gana el crupier, pero te llevas 2 fichas', async () => {
    await repartir(A);
    await db.query("update piso_casino_manos set estado = 'jugando', fichas = 0 where user_id = $1 and mano = 2", [A]);
    await db.query('update piso_casino_cuentas set fichas = 8 where user_id = $1', [A]);
    await colocar(A, 2, { tuyas: [9, 4], crupier: [9, 7], mazo: [11, 1] });
    const s = await jugar(A, 'pedir');
    expect(s.manos[1]).toMatchObject({ tuyas: [9, 4, 11], tu: 25, estado: 'perdida', fichas: CASINO.perdida });
    expect(await fichas(A)).toBe(10);
  });

  it('pedir hasta 21 justos te planta solo; empate con el crupier, 4 fichas', async () => {
    await repartir(A);
    await db.query("update piso_casino_manos set estado = 'jugando', fichas = 0 where user_id = $1 and mano = 3", [A]);
    await db.query('update piso_casino_cuentas set fichas = 10 where user_id = $1', [A]);
    await colocar(A, 3, { tuyas: [9, 4], crupier: [9, 5], mazo: [5, 4] });
    const s = await jugar(A, 'pedir');
    expect(s.manos[2]).toMatchObject({ tu: 21, crupier: [9, 5, 4], suyo: 21, estado: 'empate', fichas: CASINO.empate });
    expect(s).toMatchObject({ fichas: 14, quedan: 0 });
  });

  it('tres manos al día: la cuarta no se reparte', async () => {
    expect(await rejects(repartir(A))).toMatch(/tres manos/);
    expect(await rejects(jugar(A, 'doblar'))).toMatch(/no se puede hacer/);
  });

  it('solo hoy, ayer o mañana', async () => {
    expect(await rejects(repartir(A, '2026-01-01'))).toMatch(/ya no se puede jugar/);
  });

  it('el tope de la semana: lo que pasa de 150 no se suma', async () => {
    // B ya ganó 146 esta semana (manos de otros días de la misma semana, o de hoy si es lunes)
    await call(B, 'select piso_casino($1::date)', [HOY]);
    await db.query("insert into piso_casino_manos (user_id, dia, mano, mazo, tuyas, crupier, estado, fichas) values ($1, date_trunc('week', current_date)::date, 3, '{}', '{}', '{}', 'ganada', 146)", [
      B,
    ]);
    const antes = (await casino(B)).manos.length;
    await repartir(B);
    const n = antes + 1;
    await db.query("update piso_casino_manos set estado = 'jugando', fichas = 0 where user_id = $1 and dia = current_date and mano = $2", [B, n]);
    await db.query('update piso_casino_cuentas set fichas = 0 where user_id = $1', [B]);
    await colocar(B, n, { tuyas: [9, 8], crupier: [9, 5], mazo: [12] });
    const s = await jugar(B, 'plantarse');
    expect(s.semana).toBe(150);
    expect(s.manos.at(-1)).toMatchObject({ estado: 'ganada', fichas: 4 });
  });

  it('sin sesión no se llega a nada, y las tablas no se tocan', async () => {
    for (const sql of [`select piso_casino('${HOY}')`, `select piso_casino_repartir('${HOY}')`, `select piso_casino_jugar('${HOY}', 'pedir')`]) {
      expect(await rejects(as(db, null, (q) => q(sql)))).toMatch(/permission denied/);
    }
    for (const t of ['piso_casino_cuentas', 'piso_casino_manos']) expect(await rejects(as(db, A, (q) => q(`select * from ${t}`)))).toMatch(/permission denied/);
    expect(await rejects(as(db, A, (q) => q(`select piso_casino_cerrar('${A}', '${HOY}', 1::smallint, 'ganada')`)))).toMatch(/permission denied/);
  });
});
