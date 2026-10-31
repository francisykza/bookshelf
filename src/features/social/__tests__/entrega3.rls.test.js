// Entrega 3 · autorización en un Postgres real (SPEC §25.15): seguir, rincones, presencia, clubes y tropos con
// dos cuentas (y una tercera ajena) haciendo peticiones directas.
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects } from './supabaseHarness';

let db;
let A;
let B;
let C;

const library = (books, owned) => JSON.stringify({ books: books.map((id) => ({ id, title: `Libro ${id}`, author: 'X', quotes: ['privada'], review: 'privada', currentPage: 40 })), progress: { figures: { owned: Object.fromEntries(owned.map((f) => [f, { display: 'box' }])), guardian: owned[0] ?? null } } });

beforeAll(async () => {
  db = await createDatabase();
  [A, B, C] = await createUsers(db, 3);
  for (const [u, alias] of [
    [A, 'Ana'],
    [B, 'Bruno'],
    [C, 'Carla'],
  ]) {
    await as(db, u, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', true)", [alias]));
  }
  await as(db, A, (q) => q('insert into libraries (data) values ($1::jsonb)', [library(['a1', 'a2'], ['dama_ceniza'])]));
}, 60000);

describe('seguir', () => {
  it('relación única, sin seguirse a uno mismo, idempotente y sin acceso a datos privados', async () => {
    await as(db, A, (q) => q('insert into follows (followed) values ($1) on conflict do nothing', [B]));
    await as(db, A, (q) => q('insert into follows (followed) values ($1) on conflict do nothing', [B]));
    expect(await as(db, A, (q) => q('select followed from follows where follower = $1', [A]))).toEqual([{ followed: B }]);
    expect(await rejects(as(db, A, (q) => q('insert into follows (followed) values ($1)', [A])))).toMatch(/check/);
    expect(await rejects(as(db, C, (q) => q('insert into follows (follower, followed) values ($1, $2)', [A, C])))).toMatch(/row-level security/);
    // Seguir no abre la biblioteca de nadie
    expect(await as(db, B, (q) => q('select * from libraries'))).toEqual([]);
    // C no ve a quién sigue A
    expect(await as(db, C, (q) => q('select * from follows'))).toEqual([]);
  });

  it('bloquear corta el seguimiento e impide volver a seguir', async () => {
    await as(db, B, (q) => q('insert into blocks (blocked) values ($1)', [A]));
    expect(await as(db, A, (q) => q('select followed from follows where follower = $1', [A]))).toEqual([]);
    expect(await rejects(as(db, A, (q) => q('insert into follows (followed) values ($1)', [B])))).toMatch(/row-level security/);
    await as(db, B, (q) => q('delete from blocks where blocked = $1', [A]));
  });
});

describe('rincón compartido', () => {
  it('solo expone libros propios y figuras desbloqueadas, sin campos privados', async () => {
    expect(await rejects(as(db, A, (q) => q("insert into corners (visible, figure_ids) values (true, '{jinete_dragones}')")))).toMatch(/figuras desbloqueadas/);
    expect(await rejects(as(db, A, (q) => q('insert into corners (visible, featured_books) values (true, $1::jsonb)', [JSON.stringify([{ id: 'ajeno', title: 'X' }])])))).toMatch(/no está en tu biblioteca/);
    expect(await rejects(as(db, A, (q) => q('insert into corners (visible, featured_books) values (true, $1::jsonb)', [JSON.stringify([{ id: 'a1', title: 'Libro a1', quotes: ['x'] }])])))).toMatch(/solo puede llevar/);
    expect(await rejects(as(db, A, (q) => q('insert into corners (visible, featured_books) values (true, $1::jsonb)', [JSON.stringify([1, 2, 3, 4].map((i) => ({ id: `a${i}` })))])))).toMatch(/check|no está/);
    await as(db, A, (q) => q("insert into corners (visible, featured_books, figure_ids, guardian_id) values (true, $1::jsonb, '{dama_ceniza}', 'dama_ceniza')", [JSON.stringify([{ id: 'a1', title: 'Libro a1', author: 'X', cover: '' }])]));
    const seen = await as(db, B, (q) => q('select featured_books, figure_ids, guardian_id, current_title from corners where user_id = $1', [A]));
    expect(seen).toEqual([{ featured_books: [{ id: 'a1', title: 'Libro a1', author: 'X', cover: '' }], figure_ids: ['dama_ceniza'], guardian_id: 'dama_ceniza', current_title: null }]);
  });

  it('la lectura actual solo con la opción activada; ocultar el rincón revoca la exposición', async () => {
    expect(await rejects(as(db, A, (q) => q("update corners set current_title = 'Circe' where user_id = $1", [A])))).toMatch(/check/);
    await as(db, A, (q) => q("update corners set show_current = true, current_title = 'Circe' where user_id = $1", [A]));
    expect((await as(db, B, (q) => q('select current_title from corners where user_id = $1', [A])))[0].current_title).toBe('Circe');
    await as(db, A, (q) => q('update corners set visible = false where user_id = $1', [A]));
    expect(await as(db, B, (q) => q('select * from corners where user_id = $1', [A]))).toEqual([]);
    expect(await as(db, B, (q) => q('update corners set visible = true where user_id = $1 returning user_id', [A]))).toEqual([]);
  });
});

describe('leer en compañía', () => {
  it('solo quien se sienta aparece; el servidor pone la hora y caduca a los 3 minutos', async () => {
    expect(await as(db, B, (q) => q('select * from reading_presence'))).toEqual([]);
    await as(db, A, (q) => q("insert into reading_presence (share_book, book_title, started_at, last_seen) values (true, 'Circe', now() - interval '5 hours', now() + interval '1 day')"));
    const row = (await as(db, B, (q) => q('select user_id, book_title, started_at, last_seen from reading_presence')))[0];
    expect(row.user_id).toBe(A);
    expect(Date.now() - new Date(row.started_at).getTime()).toBeLessThan(60_000);
    expect(new Date(row.last_seen).getTime() - Date.now()).toBeLessThan(60_000);
    // Sin compartir el libro no se puede enviar su título
    expect(await rejects(as(db, A, (q) => q("update reading_presence set share_book = false where user_id = $1", [A])))).toMatch(/check/);
    // Sin renovar durante más de 3 minutos deja de verse (se simula envejeciendo la fila)
    await db.exec("alter table reading_presence disable trigger reading_presence_clock; update reading_presence set last_seen = now() - interval '4 minutes'; alter table reading_presence enable trigger reading_presence_clock;");
    expect(await as(db, B, (q) => q('select * from reading_presence'))).toEqual([]);
    // Nadie se sienta en nombre de otro
    expect(await rejects(as(db, B, (q) => q('insert into reading_presence (user_id) values ($1)', [C])))).toMatch(/row-level security/);
  });
});

describe('club de lectura', () => {
  let club;
  let token;

  it('crear: el propietario es miembro; un no miembro no ve nada', async () => {
    club = (await as(db, A, (q) => q("insert into clubs (name, description, discussion_point) values ('Club del mar', 'Leemos despacio', 'Hasta el capítulo 8') returning id")))[0].id;
    expect(await as(db, A, (q) => q('select user_id, role from club_members where club_id = $1', [club]))).toEqual([{ user_id: A, role: 'owner' }]);
    expect(await as(db, B, (q) => q('select * from clubs where id = $1', [club]))).toEqual([]);
    expect(await as(db, B, (q) => q('select * from club_members where club_id = $1', [club]))).toEqual([]);
    expect(await rejects(as(db, B, (q) => q("insert into club_messages (club_id, body) values ($1, 'hola')", [club])))).toMatch(/row-level security/);
    // Nadie se añade solo ni se hace propietario
    expect(await rejects(as(db, B, (q) => q("insert into club_members (club_id, user_id, role) values ($1, $2, 'owner')", [club, B])))).toMatch(/permission denied/);
  });

  it('invitación: token largo, solo el propietario la ve, se acepta en el servidor y se puede revocar', async () => {
    token = (await as(db, A, (q) => q('insert into club_invites (club_id) values ($1) returning token', [club])))[0].token;
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(await as(db, B, (q) => q('select * from club_invites'))).toEqual([]);
    expect(await rejects(as(db, B, (q) => q('select accept_club_invite($1)', ['no-existe'])))).toMatch(/no es válida/);
    await as(db, B, (q) => q('select accept_club_invite($1)', [token]));
    expect((await as(db, B, (q) => q('select user_id from club_members where club_id = $1 order by role desc', [club]))).length).toBe(2);
    await as(db, A, (q) => q('update club_invites set revoked = true where token = $1', [token]));
    expect(await rejects(as(db, C, (q) => q('select accept_club_invite($1)', [token])))).toMatch(/no es válida/);
    expect(await as(db, C, (q) => q('select * from clubs where id = $1', [club]))).toEqual([]);
  });

  it('mensajes: miembros; el autor edita y borra; el propietario solo retira; nadie de fuera lee', async () => {
    const m = (await as(db, B, (q) => q("insert into club_messages (club_id, body, has_spoilers) values ($1, 'Me encanta el capítulo 3', true) returning id", [club])))[0].id;
    expect(await as(db, A, (q) => q('select body from club_messages where club_id = $1', [club]))).toEqual([{ body: 'Me encanta el capítulo 3' }]);
    expect(await as(db, C, (q) => q('select * from club_messages'))).toEqual([]);
    await as(db, B, (q) => q("update club_messages set body = 'Me encanta el capítulo 4' where id = $1", [m]));
    expect(await rejects(as(db, A, (q) => q("update club_messages set body = 'reescrito' where id = $1", [m])))).toMatch(/solo puede retirar/);
    expect(await rejects(as(db, B, (q) => q("update club_messages set status = 'removed' where id = $1", [m])))).toMatch(/Solo el propietario/);
    await as(db, A, (q) => q("update club_messages set status = 'removed' where id = $1", [m]));
    // Retirado: el propietario lo ve como retirado (moderación) y los demás miembros no lo ven
    expect(await as(db, A, (q) => q('select status from club_messages where id = $1', [m]))).toEqual([{ status: 'removed' }]);
    await as(db, A, (q) => q('insert into club_invites (club_id) values ($1)', [club]));
    const t2 = (await as(db, A, (q) => q('select token from club_invites where not revoked order by created_at desc limit 1')))[0].token;
    await as(db, C, (q) => q('select accept_club_invite($1)', [t2]));
    expect(await as(db, C, (q) => q('select * from club_messages where id = $1', [m]))).toEqual([]);
    await as(db, A, (q) => q('delete from club_members where club_id = $1 and user_id = $2', [club, C]));
    expect(await rejects(as(db, B, (q) => q('insert into club_messages (club_id, body) values ($1, $2)', [club, 'x'.repeat(2001)])))).toMatch(/check/);
  });

  it('salir, retirar miembros y archivar', async () => {
    expect(await rejects(as(db, B, (q) => q("update clubs set name = 'mío' where id = $1 returning id", [club])))).toBeNull();
    // 1.62 (§62.4): archivar es solo del propietario, aunque un miembro lo intente sin pasar por la interfaz
    expect(await as(db, B, (q) => q("update clubs set status = 'archived' where id = $1 returning id", [club]))).toEqual([]);
    expect((await as(db, A, (q) => q('select status from clubs where id = $1', [club])))[0].status).toBe('active');
    expect((await as(db, A, (q) => q('select name from clubs where id = $1', [club])))[0].name).toBe('Club del mar');
    // El propietario no puede ser expulsado ni salir como si fuera un miembro
    expect(await as(db, B, (q) => q('delete from club_members where club_id = $1 and user_id = $2 returning user_id', [club, A]))).toEqual([]);
    await as(db, A, (q) => q('delete from club_members where club_id = $1 and user_id = $2', [club, B]));
    expect(await as(db, B, (q) => q('select * from clubs where id = $1', [club]))).toEqual([]);
    await as(db, A, (q) => q("update clubs set status = 'archived' where id = $1", [club]));
    expect(await rejects(as(db, A, (q) => q("insert into club_messages (club_id, body) values ($1, 'eco')", [club])))).toMatch(/row-level security/);
  });
});

describe('tropos', () => {
  it('catálogo cerrado, «ninguna encaja» explícito y denominadores correctos', async () => {
    const w = (await as(db, A, (q) => q("insert into works (kind, title) values ('local', 'Obra tropos') returning id")))[0].id;
    expect(await rejects(as(db, A, (q) => q("insert into public_reviews (work_id, tropes) values ($1, '{inventado}')", [w])))).toMatch(/check/);
    await as(db, A, (q) => q("insert into public_reviews (work_id, tropes) values ($1, '{familia-encontrada,academia}')", [w]));
    await as(db, B, (q) => q("insert into public_reviews (work_id, tropes, tropes_none) values ($1, '{}', true)", [w]));
    await as(db, C, (q) => q("insert into public_reviews (work_id, body) values ($1, 'sin responder')", [w]));
    const rows = await as(db, A, (q) => q('select trope, votes, respondents from work_trope_stats where work_id = $1 and trope is not null order by trope', [w]));
    expect(rows.map((r) => [r.trope, Number(r.votes), Number(r.respondents)])).toEqual([
      ['academia', 1, 2],
      ['familia-encontrada', 1, 2],
    ]);
  });
});
