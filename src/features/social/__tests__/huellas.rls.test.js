// 1.35.0 · Las historias dejan huella: autorización en un Postgres real (SPEC §28.10) con dos cuentas, una
// tercera ajena y anónimo. Rincón (recuerdos, última/próxima, libros que te representan), adorno, colecciones y
// distinciones (solo administración).
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects } from './supabaseHarness';

let db;
let A;
let B;
let C;

const library = (books) => JSON.stringify({ books: books.map((id) => ({ id, title: `Libro ${id}`, author: 'X', quotes: ['privada'], review: 'privada', currentPage: 40 })), progress: { figures: { owned: {} } } });
const ref = (id, extra = {}) => ({ id, title: `Libro ${id}`, author: 'X', cover: '', ...extra });

beforeAll(async () => {
  db = await createDatabase();
  [A, B, C] = await createUsers(db, 3);
  for (const [u, alias, on] of [
    [A, 'Ana', true],
    [B, 'Bruno', true],
    [C, 'Carla', false],
  ]) {
    await as(db, u, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', $2)", [alias, on]));
  }
  await as(db, A, (q) => q('insert into libraries (data) values ($1::jsonb)', [library(['a1', 'a2', 'a3', 'a4', 'a5', 'a6'])]));
  await as(db, B, (q) => q('insert into libraries (data) values ($1::jsonb)', [library(['b1'])]));
}, 60000);

describe('rincón ilustrado', () => {
  it('recuerdos: objeto del catálogo, libro propio, dedicatoria breve y como mucho tres', async () => {
    const mem = (over = {}) => ({ id: 'm1', object: 'farol', book: ref('a1'), dedication: 'Mi primera gran aventura', ...over });
    await as(db, A, (q) => q('insert into corners (visible) values (true)'));
    expect(await rejects(as(db, A, (q) => q('update corners set memories = $1::jsonb', [JSON.stringify([mem({ object: 'cohete' })])])))).toMatch(/recuerdo/);
    expect(await rejects(as(db, A, (q) => q('update corners set memories = $1::jsonb', [JSON.stringify([mem({ book: ref('ajeno') })])])))).toMatch(/recuerdo/);
    expect(await rejects(as(db, A, (q) => q('update corners set memories = $1::jsonb', [JSON.stringify([mem({ emotion: 'nostalgia' })])])))).toMatch(/recuerdo/);
    expect(await rejects(as(db, A, (q) => q('update corners set memories = $1::jsonb', [JSON.stringify([mem({ dedication: 'x'.repeat(201) })])])))).toMatch(/recuerdo/);
    expect(await rejects(as(db, A, (q) => q('update corners set memories = $1::jsonb', [JSON.stringify([1, 2, 3, 4].map((i) => mem({ id: `m${i}` })))])))).toMatch(/check/);
    await as(db, A, (q) => q('update corners set memories = $1::jsonb', [JSON.stringify([mem()])]));
    expect((await as(db, B, (q) => q('select memories from corners where user_id = $1', [A])))[0].memories).toEqual([mem()]);
  });

  it('última, próxima y libros que te representan: solo libros propios, sin campos privados, hasta cinco', async () => {
    expect(await rejects(as(db, A, (q) => q('update corners set next_book = $1::jsonb', [JSON.stringify(ref('a2', { review: 'privada' }))])))).toMatch(/próxima/);
    expect(await rejects(as(db, A, (q) => q('update corners set last_book = $1::jsonb', [JSON.stringify(ref('b1'))])))).toMatch(/última/);
    expect(await rejects(as(db, A, (q) => q('update corners set next_book = $1::jsonb', [JSON.stringify({})])))).toMatch(/próxima/);
    expect(await rejects(as(db, A, (q) => q('update corners set signature_books = $1::jsonb', [JSON.stringify(['a1', 'a2', 'a3', 'a4', 'a5', 'a6'].map((id) => ref(id)))])))).toMatch(/check/);
    expect(await rejects(as(db, A, (q) => q('update corners set signature_books = $1::jsonb', [JSON.stringify([ref('a1', { phrase: 'x'.repeat(161) })])])))).toMatch(/rincón/);
    await as(db, A, (q) => q('update corners set last_book = $1::jsonb, next_book = $2::jsonb, signature_books = $3::jsonb, scene = $4', [JSON.stringify(ref('a1')), JSON.stringify(ref('a2')), JSON.stringify([ref('a3', { phrase: 'Me cambió' })]), 'lluvia']));
    const row = (await as(db, B, (q) => q('select last_book, next_book, signature_books, scene from corners where user_id = $1', [A])))[0];
    expect(row).toEqual({ last_book: ref('a1'), next_book: ref('a2'), signature_books: [ref('a3', { phrase: 'Me cambió' })], scene: 'lluvia' });
    expect(await rejects(as(db, A, (q) => q("update corners set scene = 'tormenta'")))).toMatch(/check/);
  });

  it('nadie más edita el rincón; sin comunidad o anónimo no se ve', async () => {
    expect(await as(db, B, (q) => q("update corners set scene = 'noche' where user_id = $1 returning user_id", [A]))).toEqual([]);
    // La política (entrega 3) solo exige que el DUEÑO tenga la comunidad activada: Carla puede ver un rincón visible
    expect(await as(db, C, (q) => q('select user_id from corners where user_id = $1', [A]))).toEqual([{ user_id: A }]);
    expect(await rejects(as(db, null, (q) => q('select * from corners')))).toMatch(/permission denied/);
  });
});

describe('adorno del avatar', () => {
  it('es una preferencia de una lista cerrada que solo cambia su dueño', async () => {
    await as(db, A, (q) => q("update profiles set adornment_id = 'constelaciones' where user_id = $1", [A]));
    expect(await rejects(as(db, A, (q) => q("update profiles set adornment_id = 'moderacion' where user_id = $1", [A])))).toMatch(/check/);
    expect(await as(db, B, (q) => q("update profiles set adornment_id = 'cerezo' where user_id = $1 returning user_id", [A]))).toEqual([]);
    expect((await as(db, B, (q) => q('select adornment_id from profiles where user_id = $1', [A])))[0].adornment_id).toBe('constelaciones');
  });
});

describe('colecciones', () => {
  it('individuales, con libros propios; privadas hasta hacerlas visibles', async () => {
    expect(await rejects(as(db, A, (q) => q("insert into collections (title, books) values ('Lluvia', $1::jsonb)", [JSON.stringify([ref('b1')])])))).toMatch(/colección/);
    expect(await rejects(as(db, A, (q) => q("insert into collections (title, books) values ('Vacía', '[]'::jsonb)")))).toMatch(/check/);
    const [{ id }] = await as(db, A, (q) => q("insert into collections (title, dedication, books) values ('Historias para días de lluvia', 'Para leer con manta', $1::jsonb) returning id", [JSON.stringify([ref('a1', { phrase: 'Empieza aquí' }), ref('a2'), ref('a3')])]));
    expect(await as(db, B, (q) => q('select id from collections where id = $1', [id]))).toEqual([]);
    await as(db, A, (q) => q('update collections set visible = true where id = $1', [id]));
    expect((await as(db, B, (q) => q('select title, books from collections where id = $1', [id])))[0].books).toHaveLength(3);
    // Sin edición colaborativa: Bruno no puede tocarla ni crearla a nombre de Ana
    expect(await as(db, B, (q) => q("update collections set title = 'Mía' where id = $1 returning id", [id]))).toEqual([]);
    expect(await as(db, B, (q) => q('delete from collections where id = $1 returning id', [id]))).toEqual([]);
    expect(await rejects(as(db, B, (q) => q("insert into collections (owner, title, books) values ($1, 'Falsa', $2::jsonb)", [A, JSON.stringify([ref('a1')])])))).toMatch(/row-level security/);
    expect(await rejects(as(db, A, (q) => q('update collections set owner = $1 where id = $2', [B, id])))).toMatch(/row-level security|dueño/);
    expect(await rejects(as(db, null, (q) => q('select * from collections')))).toMatch(/permission denied/);
    // Bloquear oculta las colecciones en ambos sentidos
    await as(db, A, (q) => q('insert into blocks (blocked) values ($1)', [B]));
    expect(await as(db, B, (q) => q('select id from collections where id = $1', [id]))).toEqual([]);
    await as(db, A, (q) => q('delete from blocks where blocked = $1', [B]));
  });
});

describe('distinciones y roles', () => {
  it('nadie se concede una distinción desde la app; las asignadas por administración se ven', async () => {
    expect(await rejects(as(db, A, (q) => q("insert into distinctions (user_id, kind) values ($1, 'equipo')", [A])))).toMatch(/permission denied/);
    expect(await rejects(as(db, A, (q) => q('update distinctions set kind = $1', ['equipo'])))).toMatch(/permission denied/);
    expect(await as(db, B, (q) => q('select * from distinctions'))).toEqual([]);
    // Asignación administrativa (superusuario = SQL Editor)
    await db.query("insert into distinctions (user_id, kind, note, awarded_on) values ($1, 'fundadora', 'Comunidad fundadora', '2026-10-25')", [A]);
    expect(await as(db, B, (q) => q('select kind, note from distinctions where user_id = $1', [A]))).toEqual([{ kind: 'fundadora', note: 'Comunidad fundadora' }]);
    expect(await rejects(as(db, null, (q) => q('select * from distinctions')))).toMatch(/permission denied/);
  });

  it('el rol de moderación se consulta sin exponer la tabla y no se puede autoasignar', async () => {
    expect(await rejects(as(db, B, (q) => q('insert into moderators (user_id) values ($1)', [B])))).toMatch(/permission denied/);
    expect(await as(db, A, (q) => q('select * from moderators_among($1::uuid[])', [[A, B]]))).toEqual([]);
    await db.query('insert into moderators (user_id) values ($1)', [B]);
    expect(await as(db, A, (q) => q('select moderators_among as id from moderators_among($1::uuid[])', [[A, B]]))).toEqual([{ id: B }]);
    expect(await rejects(as(db, A, (q) => q('select * from moderators')))).toMatch(/permission denied/);
  });
});
