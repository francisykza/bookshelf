// 1.126 · Jornadas de prueba del café (solo las cuentas de `cafe_probadores`, la de Francisco), en un Postgres real (PGlite)
// con todas las migraciones: quien prueba juega un día propio (desde el 1-1-3000) con sus clientes; al atender a todos abre
// otra jornada, con clientes nuevos; lo ganado se suma como siempre y no se borra nada. Para el resto no cambia nada: el día,
// solo hoy o ayer, y no pueden abrir jornadas ni añadirse como probadores.
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects } from '../../social/__tests__/supabaseHarness';
import { recetaPide } from '../cafe/cafeClientes';

let db;
let F, B;
let hoy;
const call = (u, sql, params) => as(db, u, (q) => q(sql, params)).then((r) => Object.values(r[0])[0]);
const dia = (u, d) => call(u, 'select cafe_dia($1::date)', [d]);
const servir = (u, d, cliente, receta) => call(u, 'select cafe_servir($1::date, $2, $3::text[], $4, null)', [d, cliente, receta, false]);
const jornada = (u) => call(u, 'select cafe_jornada()::text');
const otra = (u) => call(u, 'select cafe_nueva_jornada()::text');
const atenderTodos = async (u, d) => {
  const r = await dia(u, d);
  let ultimo = r;
  for (const c of r.dia.clientes) ultimo = await servir(u, d, c.n, recetaPide(c));
  return ultimo;
};

beforeAll(async () => {
  db = await createDatabase();
  [F, B] = await createUsers(db, 2);
  for (const [i, u] of [F, B].entries()) {
    await as(db, u, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', true)", [`Lectora ${i}`]));
    await as(db, u, (q) => q('select asignar_edificio()'));
    await call(u, 'select cafe_mio()');
    await call(u, 'select cafe_inaugurar($1)', ['Taza y Lomo']);
  }
  hoy = (await db.query('select cafe_hoy()::text as h')).rows[0].h;
  // Como el script `cafe_probador.sql`: a mano, solo la cuenta de Francisco
  await db.query('insert into cafe_probadores (user_id) values ($1)', [F]);
}, 60000);

describe('jornadas de prueba del café', () => {
  it('solo quien está en la lista tiene jornada; nadie puede leer ni añadirse a la lista', async () => {
    expect(await jornada(F)).toBe('3000-01-01');
    expect(await jornada(B)).toBeNull();
    expect(await rejects(as(db, B, (q) => q('insert into cafe_probadores (user_id) values ($1)', [B])))).toMatch(/permission denied/);
    expect(await rejects(as(db, B, (q) => q('select * from cafe_probadores')))).toMatch(/permission denied/);
    expect(await rejects(as(db, null, (q) => q('select cafe_jornada()')))).toMatch(/permission denied/);
    expect(await rejects(otra(B))).toMatch(/cafe:probador/);
  });

  it('el resto sigue igual: solo hoy o ayer, nunca un día de prueba', async () => {
    expect(await rejects(dia(B, '3000-01-01'))).toMatch(/cafe:dia/);
    expect((await dia(B, hoy)).dia.clientes.length).toBeGreaterThan(0);
    // Ni quien prueba puede jugar otra jornada que no sea la suya
    expect(await rejects(dia(F, '3000-01-02'))).toMatch(/cafe:dia/);
  });

  it('quien prueba juega su jornada, abre otra al atender a todos y lo ganado se suma; no se borra nada', async () => {
    const r1 = await dia(F, '3000-01-01');
    expect(r1.dia.clientes.length).toBeGreaterThan(0);
    // Con alguien por atender, no hay otra jornada
    expect(await rejects(otra(F))).toMatch(/cafe:pendientes/);
    const fin1 = await atenderTodos(F, '3000-01-01');
    const rep1 = fin1.cafe.reputacion;
    expect(rep1).toBeGreaterThan(0);
    expect(await otra(F)).toBe('3000-01-02');
    expect(await jornada(F)).toBe('3000-01-02');
    // La jornada nueva trae clientes nuevos, sin atender, y la anterior ya no se juega
    const r2 = await dia(F, '3000-01-02');
    expect(r2.dia.clientes.every((c) => !c.servido)).toBe(true);
    expect(await rejects(dia(F, '3000-01-01'))).toMatch(/cafe:dia/);
    const fin2 = await atenderTodos(F, '3000-01-02');
    expect(fin2.cafe.reputacion).toBeGreaterThan(rep1);
    // Lo de la primera jornada sigue guardado
    expect((await db.query('select count(*)::int n from cafe_servicios where user_id = $1 and dia = $2', [F, '3000-01-01'])).rows[0].n).toBe(r1.dia.clientes.length);
    // Y el día de hoy también se puede jugar
    expect((await dia(F, hoy)).dia.clientes.length).toBeGreaterThan(0);
  });
});
