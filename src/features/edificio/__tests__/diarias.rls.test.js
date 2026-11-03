// 1.70 · Misiones del día (SPEC §70): las tres del día son las mismas en el cliente y en el servidor, cada una cuenta
// una vez, las tres juntas dan la siguiente prenda (y, desde la 1.79, 5 tickets si ya tienes toda la ropa) y solo se
// lleva la ropa que se tiene. Postgres real (PGlite) con todas las migraciones.
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects } from '../../social/__tests__/supabaseHarness';
import { DEFAULT_AVATAR, PRENDAS } from '../actor';
import { DAILY, DIARIA_TICKETS, missionsOf } from '../dailyMissions';
import { starterRoom } from '../demo';

let db;
let A, B;
let today;
const call = (u, sql, params) => as(db, u, (q) => q(sql, params)).then((r) => Object.values(r[0])[0]);
const contar = (u, mision, dia = today) => call(u, 'select piso_mision_diaria($1, $2::date)', [mision, dia]);
const tickets = (u) => db.query('select tickets from piso_cuentas where user_id = $1', [u]).then((r) => r.rows[0]?.tickets ?? 0);

beforeAll(async () => {
  db = await createDatabase();
  [A, B] = await createUsers(db, 2);
  for (const [i, u] of [A, B].entries()) {
    await as(db, u, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', true)", [`Vecino ${i}`]));
    await as(db, u, (q) => q('select asignar_edificio()'));
    await as(db, u, (q) => q('insert into pisos (layout) values ($1::jsonb)', [JSON.stringify(starterRoom())]));
  }
  today = (await db.query("select to_char(current_date, 'YYYY-MM-DD') as d")).rows[0].d;
}, 60000);

describe('misiones del día', () => {
  it('las tres del día coinciden con las del cliente, todo el año y sin repetirse', async () => {
    for (let k = -400; k < 400; k += 7) {
      const { rows } = await db.query("select to_char(date '2026-11-02' + $1::int, 'YYYY-MM-DD') as d, piso_diarias_del_dia(date '2026-11-02' + $1::int) as m", [k]);
      const mine = missionsOf(rows[0].d).map((m) => m.id);
      expect(rows[0].m).toEqual(mine);
      expect(new Set(mine).size).toBe(3);
    }
    // Cada misión sale algún día de la semana
    const week = new Set();
    for (let k = 0; k < 7; k += 1) missionsOf(`2026-11-${String(2 + k).padStart(2, '0')}`).forEach((m) => week.add(m.id));
    expect(week.size).toBe(DAILY.length);
  });

  it('cada una cuenta una vez; las tres dan la primera prenda y ningún ticket', async () => {
    const before = await tickets(A);
    const [m1, m2, m3] = missionsOf(today).map((m) => m.id);
    let r = await contar(A, m1);
    expect(r).toMatchObject({ hechas: [m1], prendas: [], nueva: null });
    r = await contar(A, m1);
    expect(r.hechas).toEqual([m1]);
    await contar(A, m2);
    r = await contar(A, m3);
    expect(r.nueva).toBe(PRENDAS[0]);
    expect(r.prendas).toEqual([PRENDAS[0]]);
    // Repetir no da otra
    expect((await contar(A, m3)).nueva).toBeNull();
    expect(await tickets(A)).toBe(before);
    expect(await call(A, 'select piso_mi_armario($1::date)', [today])).toMatchObject({ prendas: [PRENDAS[0]], hechas: [m1, m2, m3] });
  });

  it('no cuenta misiones de otro día ni inventadas', async () => {
    const otra = DAILY.find((d) => !missionsOf(today).some((m) => m.id === d.id)).id;
    expect(await rejects(contar(B, otra))).toMatch(/no es una misión de ese día/);
    expect(await rejects(contar(B, 'leer-mil-libros'))).toMatch(/no es una misión/);
    expect(await rejects(contar(B, missionsOf('2026-01-01')[0].id, '2026-01-01'))).toMatch(/ya no se puede contar/);
    expect(await rejects(as(db, A, (q) => q("insert into piso_prendas (user_id, prenda) values ($1, 'jersey:9')", [A])))).toMatch(/permission denied/);
    expect(await rejects(as(db, null, (q) => q('select * from piso_diarias')))).toMatch(/permission denied/);
    // Cada uno ve solo lo suyo
    expect((await as(db, B, (q) => q('select * from piso_prendas'))).length).toBe(0);
  });

  it('con toda la ropa ya ganada, las tres dan 5 tickets (una vez al día)', async () => {
    // B ya tiene todas las prendas (como quien lleva meses haciendo las misiones)
    for (const p of PRENDAS) await db.query('insert into piso_prendas (user_id, prenda) values ($1, $2) on conflict do nothing', [B, p]);
    const before = await tickets(B);
    const [m1, m2, m3] = missionsOf(today).map((m) => m.id);
    expect((await contar(B, m1)).tickets).toBe(0);
    await contar(B, m2);
    const r = await contar(B, m3);
    expect(r).toMatchObject({ nueva: null, tickets: DIARIA_TICKETS });
    expect(await tickets(B)).toBe(before + DIARIA_TICKETS);
    // Repetir no da más
    expect((await contar(B, m3)).tickets).toBe(0);
    expect(await tickets(B)).toBe(before + DIARIA_TICKETS);
    // Y quien aún tiene ropa por ganar no recibe tickets (lo comprueba también la prueba de arriba)
    await db.query('delete from piso_prendas where user_id = $1', [B]);
  });

  it('solo se lleva la ropa que se tiene', async () => {
    const set = (u, p) => as(db, u, (q) => q('update pisos set personaje = $1::jsonb', [JSON.stringify(p)]));
    // A tiene la bufanda; B no
    await set(A, { ...DEFAULT_AVATAR, complemento: 'bufanda' });
    expect(await rejects(set(B, { ...DEFAULT_AVATAR, complemento: 'bufanda' }))).toMatch(/Aún no tienes esa prenda/);
    expect(await rejects(set(A, { ...DEFAULT_AVATAR, jersey: 8 }))).toMatch(/Aún no tienes esa prenda/);
    await set(B, { ...DEFAULT_AVATAR, jersey: 7, complemento: 'ninguno' });
  });
});
