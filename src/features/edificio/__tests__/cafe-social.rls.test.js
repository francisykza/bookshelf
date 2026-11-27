// 1.141 (§141), en un Postgres real (PGlite): los cafés de los demás. El ranking del edificio y el de quien sigues (tú siempre
// sales), con los granos ganados (sin restar lo gastado) y la reputación de la semana; y la visita, con los mismos permisos
// que la del piso y sin los títulos de los leídos de nadie.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, juntarComoAntes } from '../../social/__tests__/supabaseHarness';

const DIR = join(import.meta.dirname, '..', '..', '..', '..', 'supabase', 'migrations');
const FILES = readdirSync(DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort();

let db;
let A, B, C, D;
const call = async (u, sql, params = []) => {
  let rows;
  await as(db, u, async (q) => {
    rows = await q(sql, params);
  });
  return rows;
};
const ranking = async (u, ambito) => (await call(u, 'select cafe_ranking($1) as r', [ambito]))[0].r;
const visita = async (u, lector) => (await call(u, 'select cafe_visita($1) as v', [lector]))[0].v;

beforeAll(async () => {
  db = await createDatabase(FILES.length);
  [A, B, C, D] = await createUsers(db, 4);
  for (const [i, u] of [A, B, C, D].entries()) {
    await call(u, "insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', true)", [`Lector ${i}`]);
    await call(u, 'select asignar_edificio()');
  }
  await juntarComoAntes(db, [A, B, C, D]);
  // C vive en otro edificio
  await db.query('with nuevo as (insert into edificios default values returning id) update edificio_vecinos set edificio = (select id from nuevo) where user_id = $1', [C]);
  // A, B y C abren su café; D no
  for (const u of [A, B, C]) {
    await call(u, 'select cafe_mio()');
    await call(u, 'select cafe_inaugurar($1)', ['Taza y Lomo']);
  }
  await db.query('update cafe_locales set nivel = 3, reputacion = 2000 where user_id = $1', [B]);
  await db.query('update cafe_locales set nivel = 2, reputacion = 700 where user_id = $1', [C]);
}, 60000);

describe('cafe_ranking', () => {
  it('el del edificio: tus vecinos con café y tú, por nivel y reputación; quien no ha abierto, no', async () => {
    const r = await ranking(A, 'edificio');
    expect(r.map((x) => x.user_id)).toEqual([B, A]);
    expect(r.find((x) => x.yo).user_id).toBe(A);
    expect(Object.keys(r[0]).sort()).toEqual(['alias', 'avatar_id', 'cafe', 'ganados', 'nivel', 'reputacion', 'semana', 'user_id', 'yo']);
    expect(r[0]).toMatchObject({ alias: 'Lector 1', cafe: 'Taza y Lomo', nivel: 3 });
  });

  it('el de quien sigues: solo a quien sigues (y tú), aunque viva en otro edificio', async () => {
    expect((await ranking(A, 'seguidos')).map((x) => x.user_id)).toEqual([A]);
    await call(A, 'insert into follows (followed) values ($1)', [C]);
    expect((await ranking(A, 'seguidos')).map((x) => x.user_id)).toEqual([C, A]);
    // Seguir no es recíproco
    expect((await ranking(C, 'seguidos')).map((x) => x.user_id)).toEqual([C]);
  });

  it('los granos ganados no bajan al gastar; la reputación de la semana empieza de cero cada lunes', async () => {
    await db.query('update cafe_locales set granos = granos + 30 where user_id = $1', [A]);
    await db.query('update cafe_locales set granos = granos - 25 where user_id = $1', [A]);
    await db.query('update cafe_locales set granos = granos + 5, reputacion = reputacion + 40 where user_id = $1', [A]);
    let yo = (await ranking(A, 'edificio')).find((x) => x.yo);
    expect(yo.ganados).toBe(35);
    expect(yo.semana).toBe(40);
    // Una subida de la semana pasada no cuenta en esta
    await db.query("update cafe_locales set semana = date_trunc('week', now() at time zone 'utc')::date - 7 where user_id = $1", [A]);
    yo = (await ranking(A, 'edificio')).find((x) => x.yo);
    expect(yo.semana).toBe(0);
    await db.query('update cafe_locales set reputacion = reputacion + 12 where user_id = $1', [A]);
    yo = (await ranking(A, 'edificio')).find((x) => x.yo);
    expect(yo.semana).toBe(12);
  });

  it('sin comunidad activa, vacío; un ámbito desconocido falla; con bloqueo, fuera', async () => {
    await expect(ranking(A, 'todos')).rejects.toThrow(/cafe:ambito/);
    await call(B, 'insert into blocks (blocked) values ($1)', [A]);
    expect((await ranking(A, 'edificio')).map((x) => x.user_id)).toEqual([A]);
    await db.query('delete from blocks where blocker = $1', [B]);
    await db.query('update profiles set community_enabled = false where user_id = $1', [A]);
    expect(await ranking(A, 'edificio')).toEqual([]);
    await db.query('update profiles set community_enabled = true where user_id = $1', [A]);
  });
});

describe('cafe_visita', () => {
  it('el de una vecina: su local, sin los títulos de sus leídos; los del catálogo, enteros', async () => {
    await db.query(
      "insert into cafe_libros (user_id, clave, titulo, genero, caja, balda) values ($1, 'mi-libro', 'Mi diario secreto', 'novela', 0, 2), ($1, 'cat:nada', 'Nada', 'novela', 0, 1), ($1, 'cat:otro', 'Otro', 'poesia', 3, 0)",
      [B],
    );
    const v = await visita(A, B);
    expect(v).toMatchObject({ user_id: B, alias: 'Lector 1', nombre: 'Taza y Lomo', nivel: 3, escaparate: [] });
    expect(v.plano.items.length).toBeGreaterThan(0);
    expect(v.libros).toEqual([
      { clave: 'cat:nada', titulo: 'Nada', genero: 'novela', balda: 1 },
      { genero: 'novela', balda: 2 },
    ]);
    expect(JSON.stringify(v)).not.toContain('Mi diario secreto');
    expect(JSON.stringify(v)).not.toContain('mi-libro');
    expect(v).not.toHaveProperty('granos');
  });

  it('de otro edificio, solo si le sigues; nunca el tuyo ni uno sin abrir; sin comunidad o con bloqueo, nada', async () => {
    expect((await visita(A, C)).user_id).toBe(C);
    expect(await visita(B, C)).toBeNull();
    expect(await visita(A, A)).toBeNull();
    expect(await visita(A, D)).toBeNull();
    await call(C, 'insert into blocks (blocked) values ($1)', [A]);
    expect(await visita(A, C)).toBeNull();
    await db.query('update profiles set community_enabled = false where user_id = $1', [B]);
    expect(await visita(A, B)).toBeNull();
  });

  it('las tablas siguen cerradas y las funciones internas no se pueden llamar', async () => {
    await expect(call(A, 'select granos_ganados from cafe_locales')).rejects.toThrow(/permission denied/);
    await expect(call(A, 'select cafe_puedo_ver($1)', [B])).rejects.toThrow(/permission denied/);
  });
});
