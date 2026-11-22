// Borrar la cuenta (Play Store, docs/qa/play-store.md §2.1; `20261228120000_cuenta_borrar.sql`) sobre Postgres real (PGlite)
// con todas las migraciones. Decisión de Francisco (20-11-2026): lo que la cuenta dejó a otros queda como «Lector anónimo».
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects } from './supabaseHarness';

let db;
let A, B, C;
let club, clubSolo, obra, mensaje, nota, lomo;

const borrar = (u, palabra = 'BORRAR') => as(db, u, (q) => q('select cuenta_borrar($1)', [palabra]));

/** ¿Queda el id en alguna columna uuid o jsonb de las tablas públicas? Devuelve las tablas donde aparece. */
async function dondeQueda(id) {
  const { rows: cols } = await db.query(
    `select c.table_name, c.column_name, c.data_type from information_schema.columns c
       join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
      where c.table_schema = 'public' and t.table_type = 'BASE TABLE' and c.data_type in ('uuid', 'jsonb', 'ARRAY')`,
  );
  const quedan = [];
  for (const { table_name: t, column_name: c, data_type: tipo } of cols) {
    const cond = tipo === 'uuid' ? `"${c}" = $1::uuid` : `"${c}"::text like '%' || $1 || '%'`;
    const { rows } = await db.query(`select count(*)::int as n from public."${t}" where ${cond}`, [id]);
    if (rows[0].n > 0) quedan.push(`${t}.${c}`);
  }
  return quedan;
}

beforeAll(async () => {
  db = await createDatabase();
  [A, B, C] = await createUsers(db, 3);
  for (const [i, u] of [A, B, C].entries()) await as(db, u, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', true)", [`Lector ${i}`]));
  await as(db, A, (q) => q("insert into libraries (data, version) values ('{\"books\": []}'::jsonb, 1)"));
  // Una reseña pública de A
  obra = (await as(db, A, (q) => q("insert into works (kind, title, author) values ('local', 'El mar', 'Alguien') returning id")))[0].id;
  await as(db, A, (q) => q("insert into public_reviews (work_id, status, body, rating_quarters) values ($1, 'published', 'Precioso', 16)", [obra]));
  // Y muchas más (más que el límite de escrituras por minuto): dejarlas sin dueño no puede impedir el borrado
  for (let i = 0; i < 24; i += 1) {
    const w = (await db.query("insert into works (kind, title, author) values ('local', $1, 'Alguien') returning id", [`Libro ${i}`])).rows[0].id;
    await db.query("insert into public_reviews (work_id, user_id, status, body) values ($1, $2, 'published', 'Bien')", [w, A]);
  }
  // Un club de A con B dentro (y un mensaje de A) y otro club de A sin nadie más
  club = (await as(db, A, (q) => q("insert into clubs (name, description, discussion_point) values ('Club del mar', 'Leemos despacio', 'Hasta el 8') returning id")))[0].id;
  const token = (await as(db, A, (q) => q('insert into club_invites (club_id) values ($1) returning token', [club])))[0].token;
  await as(db, B, (q) => q('select accept_club_invite($1)', [token]));
  mensaje = (await as(db, A, (q) => q("insert into club_messages (club_id, body) values ($1, 'Bienvenidos') returning id", [club])))[0].id;
  clubSolo = (await as(db, A, (q) => q("insert into clubs (name, description, discussion_point) values ('Solo yo', 'Nadie', 'Nada') returning id")))[0].id;
  // Un post-it de A en el tablón de B y un lomo de A en la librería común (el recorrido completo está en sus pruebas)
  nota = (await db.query("insert into tablon_recibidas (recipient_id, sender_id, body) values ($1, $2, 'Gracias por el libro') returning id", [B, A])).rows[0].id;
  lomo = (await db.query("insert into sala_lomos (user_id, titulo) values ($1, 'El mar') returning id", [A])).rows[0].id;
  // Alguien sigue a A y A sigue a C
  await as(db, B, (q) => q('insert into follows (followed) values ($1)', [A]));
  await as(db, A, (q) => q('insert into follows (followed) values ($1)', [C]));
}, 60000);

describe('borrar la cuenta', () => {
  it('sin sesión, o sin escribir BORRAR, no se borra nada', async () => {
    expect(await rejects(as(db, null, (q) => q("select cuenta_borrar('BORRAR')")))).toMatch(/permission denied/);
    expect(await rejects(borrar(A, 'borrar'))).toMatch(/cuenta:confirmacion/);
    expect(await rejects(borrar(A, null))).toMatch(/cuenta:confirmacion/);
    expect((await db.query('select count(*)::int as n from auth.users where id = $1', [A])).rows[0].n).toBe(1);
  });

  it('borra solo la cuenta de quien llama y no queda su id en ninguna tabla', async () => {
    await borrar(A);
    expect((await db.query('select id from auth.users order by id')).rows.map((r) => r.id).sort()).toEqual([B, C].sort());
    expect(await dondeQueda(A)).toEqual([]);
    // B y C siguen como estaban
    expect((await as(db, B, (q) => q('select alias from profiles where user_id = $1', [B])))[0].alias).toBe('Lector 1');
    expect(await as(db, B, (q) => q('select followed from follows'))).toEqual([]);
  });

  it('su reseña queda sin dueño, se sigue viendo y contando', async () => {
    const vistas = await as(db, B, (q) => q('select user_id, body from public_reviews where work_id = $1', [obra]));
    expect(vistas).toEqual([{ user_id: null, body: 'Precioso' }]);
    expect((await as(db, B, (q) => q('select reviews from work_review_stats where work_id = $1', [obra])))[0].reviews).toBe(1);
  });

  it('su club pasa al miembro más antiguo; el club sin nadie más se borra', async () => {
    expect((await db.query('select owner from clubs where id = $1', [club])).rows[0].owner).toBe(B);
    expect((await as(db, B, (q) => q('select user_id, role from club_members where club_id = $1', [club])))).toEqual([{ user_id: B, role: 'owner' }]);
    expect((await db.query('select count(*)::int as n from clubs where id = $1', [clubSolo])).rows[0].n).toBe(0);
    expect(await as(db, B, (q) => q('select user_id, body from club_messages where id = $1', [mensaje]))).toEqual([{ user_id: null, body: 'Bienvenidos' }]);
  });

  it('su post-it sigue en el tablón de B, sin remitente, y su lomo en la librería común', async () => {
    expect((await db.query('select sender_id, body from tablon_recibidas where id = $1', [nota])).rows).toEqual([{ sender_id: null, body: 'Gracias por el libro' }]);
    const lib = (await as(db, C, (q) => q('select sala_libreria() as l')))[0].l;
    expect(lib.lomos).toEqual([{ id: lomo, titulo: 'El mar', alias: null, mio: false }]);
    expect(lib.total).toBe(1);
  });

  it('una sesión de una cuenta ya borrada no puede volver a borrar ni escribir', async () => {
    await borrar(A); // no hay nada que borrar: no falla ni toca a nadie
    expect((await db.query('select count(*)::int as n from auth.users')).rows[0].n).toBe(2);
    expect(await rejects(as(db, A, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ('Vuelvo', 'gato-lector', true)")))).toMatch(/foreign key|violates/);
  });
});
