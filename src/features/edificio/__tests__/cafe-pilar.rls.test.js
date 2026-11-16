// 1.142 (§142), en un Postgres real (PGlite): el cuaderno de Pilar. Mejoras para siempre, pagadas con granos y con grados:
// colocar la caja (nivel 1, 60; y «Pilar pide a la distribuidora», nivel 4, 300: 3 libros más en el reparto), la hucha de
// propinas (nivel 2; 120 / 250 / 450 para 8 / 15 / 25 al día, hasta 7 días) y la pizarra de la acera (150 / 350 desde el nivel
// 3 y 700 desde el 5, para 1 / 2 / 3 clientes más al día). Y lo que ha dado cada una. Nada toca los tickets.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers } from '../../social/__tests__/supabaseHarness';

const DIR = join(import.meta.dirname, '..', '..', '..', '..', 'supabase', 'migrations');
const FILES = readdirSync(DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort();

let db;
let A, B;
const call = async (u, sql, params = []) => {
  let rows;
  await as(db, u, async (q) => {
    rows = await q(sql, params);
  });
  return rows;
};
const mejorar = async (u, m) => (await call(u, 'select cafe_pilar_mejorar($1) as r', [m]))[0].r;
const hucha = async (u) => (await call(u, 'select cafe_hucha() as r'))[0].r;
const local = async (u) => (await db.query('select * from cafe_locales where user_id = $1', [u])).rows[0];
const tickets = async (u) => (await db.query('select tickets from piso_cuentas where user_id = $1', [u])).rows[0]?.tickets ?? null;
const hoy = async () => (await db.query("select (now() at time zone 'utc')::date::text as d")).rows[0].d;

beforeAll(async () => {
  db = await createDatabase(FILES.length);
  [A, B] = await createUsers(db, 2);
  for (const [i, u] of [A, B].entries()) {
    await call(u, "insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', true)", [`Lector ${i}`]);
    await call(u, 'select cafe_mio()');
    await call(u, 'select cafe_inaugurar($1)', ['Taza y Lomo']);
  }
}, 60000);

describe('el cuaderno de Pilar', () => {
  it('sin granos o sin nivel, nada; una tarea desconocida falla; cafe_json lo cuenta', async () => {
    await db.query('update cafe_locales set granos = 10 where user_id = $1', [A]);
    await expect(mejorar(A, 'caja')).rejects.toThrow(/cafe:granos/);
    await db.query('update cafe_locales set granos = 2000 where user_id = $1', [A]);
    await expect(mejorar(A, 'hucha')).rejects.toThrow(/cafe:cuaderno_nivel/);
    await expect(mejorar(A, 'pizarra')).rejects.toThrow(/cafe:cuaderno_nivel/);
    await expect(mejorar(A, 'barrer')).rejects.toThrow(/cafe:cuaderno$/);
    const c = (await call(A, 'select cafe_mio() as c'))[0].c;
    expect(c.pilar).toEqual({ caja: 0, hucha: 0, pizarra: 0, hucha_dia: 0, hucha_lista: 0, dado: { hucha: 0, colocados: 0, clientes: 0, pedidos: 0 } });
  });

  it('colocar la caja: 60 granos; coloca lo que espera y, cada mañana, lo del reparto; con el 2.º grado (nivel 4, 300), 3 libros más', async () => {
    // 15 ejemplares en la caja y 12 huecos en el nivel 1
    await db.query("insert into cafe_libros (user_id, clave, titulo, genero, caja, balda) values ($1, 'cat:a', 'A', 'novela', 10, 0), ($1, 'cat:b', 'B', 'poesia', 5, 0)", [A]);
    const tk = await tickets(A);
    const r = await mejorar(A, 'caja');
    expect(r.cafe.granos).toBe(1940);
    expect(r.cafe.pilar.caja).toBe(1);
    const enBalda = r.libros.libros.reduce((n, b) => n + b.balda, 0);
    const enCaja = r.libros.libros.reduce((n, b) => n + b.caja, 0);
    expect([enBalda, enCaja]).toEqual([12, 3]);
    expect(r.cafe.pilar.dado.colocados).toBe(12);
    await expect(mejorar(A, 'caja')).rejects.toThrow(/cafe:cuaderno_nivel/);
    // Se venden dos (salen de la balda) y, al abrir el día, Pilar sube lo que cabe
    await db.query("update cafe_libros set balda = balda - 2 where user_id = $1 and clave = 'cat:a'", [A]);
    const dia = await hoy();
    let d = (await call(A, 'select cafe_dia($1::date) as d', [dia]))[0].d;
    expect(d.libros.libros.reduce((n, b) => n + b.balda, 0)).toBe(12);
    expect(d.cafe.pilar.dado.colocados).toBe(14);
    // «Pilar pide a la distribuidora»: con sitio de sobra, el reparto trae su cupo (8 en el nivel 4) y 3 más
    await db.query('update cafe_locales set nivel = 4, granos = 1000 where user_id = $1', [A]);
    await db.query('update cafe_libros set balda = 0, caja = 0 where user_id = $1', [A]);
    expect((await mejorar(A, 'caja')).cafe).toMatchObject({ granos: 700, pilar: { caja: 2 } });
    await expect(mejorar(A, 'caja')).rejects.toThrow(/cafe:cuaderno$/);
    await db.query('delete from cafe_dias where user_id = $1', [A]);
    d = (await call(A, 'select cafe_dia($1::date) as d', [dia]))[0].d;
    expect(d.dia.reparto.claves).toHaveLength(11);
    expect(d.dia.reparto.pilar).toBe(3);
    expect(d.cafe.pilar.dado.pedidos).toBe(3);
    expect(await tickets(A)).toBe(tk);
  });

  it('la hucha: desde el nivel 2, 8 / 15 / 25 granos por día entero, hasta 7 días; al subir de grado, se cobra lo de antes', async () => {
    await db.query('update cafe_locales set nivel = 2, granos = 1000 where user_id = $1', [A]);
    let r = await mejorar(A, 'hucha');
    expect(r.cafe.granos).toBe(880);
    expect(r.cafe.pilar).toMatchObject({ hucha: 1, hucha_dia: 8, hucha_lista: 0 });
    expect((await hucha(A)).recogido).toBe(0);
    // Dos días y medio: 16 granos, y medio día sigue guardado
    await db.query("update cafe_locales set hucha_desde = now() - interval '60 hours' where user_id = $1", [A]);
    r = await hucha(A);
    expect(r.recogido).toBe(16);
    expect(r.cafe.granos).toBe(896);
    expect((await hucha(A)).recogido).toBe(0);
    const resto = await db.query('select extract(epoch from now() - hucha_desde) / 3600 as h from cafe_locales where user_id = $1', [A]);
    expect(Number(resto.rows[0].h)).toBeCloseTo(12, 0);
    // Veinte días fuera: solo guarda 7
    await db.query("update cafe_locales set hucha_desde = now() - interval '20 days' where user_id = $1", [A]);
    expect((await call(A, 'select cafe_mio() as c'))[0].c.pilar.hucha_lista).toBe(56);
    expect((await hucha(A)).recogido).toBe(56);
    // Grado 2 (250): lo de antes, al precio de antes; luego 15 al día
    await db.query("update cafe_locales set hucha_desde = now() - interval '2 days' where user_id = $1", [A]);
    const antes = (await local(A)).granos;
    r = await mejorar(A, 'hucha');
    expect(r.cafe.granos).toBe(antes + 16 - 250);
    expect(r.cafe.pilar).toMatchObject({ hucha: 2, hucha_dia: 15 });
    expect(r.cafe.pilar.dado.hucha).toBe(88);
    await db.query('update cafe_locales set granos = 1000 where user_id = $1', [A]);
    expect((await mejorar(A, 'hucha')).cafe.pilar.hucha_dia).toBe(25);
    await expect(mejorar(A, 'hucha')).rejects.toThrow(/cafe:cuaderno$/);
  });

  it('la pizarra: 1 y 2 clientes más desde el nivel 3, 3 desde el nivel 5 (desde el día siguiente)', async () => {
    await db.query('update cafe_locales set nivel = 3, granos = 2000 where user_id = $1', [B]);
    const dia = await hoy();
    const base = (await call(B, 'select cafe_dia($1::date) as d', [dia]))[0].d.dia.clientes.length;
    expect((await mejorar(B, 'pizarra')).cafe.granos).toBe(1850);
    expect((await mejorar(B, 'pizarra')).cafe.granos).toBe(1500);
    await expect(mejorar(B, 'pizarra')).rejects.toThrow(/cafe:cuaderno_nivel/);
    // Hoy, igual; el día nuevo, con dos más (el último sigue siendo el excéntrico)
    expect((await call(B, 'select cafe_dia($1::date) as d', [dia]))[0].d.dia.clientes).toHaveLength(base);
    await db.query('delete from cafe_dias where user_id = $1', [B]);
    let d = (await call(B, 'select cafe_dia($1::date) as d', [dia]))[0].d;
    expect(d.dia.clientes).toHaveLength(base + 2);
    expect(d.dia.clientes.at(-1).excentrico).toBe(true);
    expect(d.cafe.pilar.dado.clientes).toBe(2);
    // El 3.er grado (700), desde el nivel 5; en el nivel 8, hasta 13
    await db.query('update cafe_locales set nivel = 5 where user_id = $1', [B]);
    expect((await mejorar(B, 'pizarra')).cafe).toMatchObject({ granos: 800, pilar: { pizarra: 3 } });
    await expect(mejorar(B, 'pizarra')).rejects.toThrow(/cafe:cuaderno$/);
    await db.query('update cafe_locales set nivel = 8 where user_id = $1', [B]);
    await db.query('delete from cafe_dias where user_id = $1', [B]);
    d = (await call(B, 'select cafe_dia($1::date) as d', [dia]))[0].d;
    expect(d.dia.clientes.length).toBeLessThanOrEqual(13);
    expect(d.cafe.pilar.dado.clientes).toBe(5);
  });

  it('las columnas siguen cerradas y las funciones internas no se pueden llamar', async () => {
    await expect(call(A, 'select hucha from cafe_locales')).rejects.toThrow(/permission denied/);
    await expect(call(A, 'select cafe_pilar_coloca($1)', [A])).rejects.toThrow(/permission denied/);
    await expect(call(A, 'select cafe_hucha_cobrar($1)', [A])).rejects.toThrow(/permission denied/);
  });
});
