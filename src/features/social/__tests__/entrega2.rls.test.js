// Entrega 2 · autorización en un Postgres real (SPEC §25.7): dos cuentas independientes y una sesión sin
// autenticar haciendo peticiones directas, como lo haría cualquiera con la clave pública de la API.
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, createUsers, rejects } from './supabaseHarness';

let db;
let A;
let B;
let C;
let work;

beforeAll(async () => {
  db = await createDatabase();
  [A, B, C] = await createUsers(db, 3);
  for (const [u, alias] of [
    [A, 'Ana lectora'],
    [B, 'Bruno'],
  ]) {
    await as(db, u, (q) => q("insert into profiles (alias, avatar_id, community_enabled) values ($1, 'gato-lector', true)", [alias]));
  }
  // C tiene perfil pero NO ha activado la comunidad
  await as(db, C, (q) => q("insert into profiles (alias, avatar_id) values ('Carla', 'lectora-cafe')"));
  work = (await as(db, A, (q) => q("insert into works (kind, title, author) values ('local', 'Circe', 'Madeline Miller') returning id")))[0].id;
}, 60000);

describe('perfiles', () => {
  it('cada persona edita solo su perfil; nadie modifica el de otra cuenta', async () => {
    await as(db, A, (q) => q("update profiles set avatar_id = 'vidente-estrellas' where user_id = $1", [A]));
    // B intenta cambiar el perfil de A: la fila no es suya, la actualización no afecta a nada
    const touched = await as(db, B, (q) => q("update profiles set alias = 'pirata' where user_id = $1 returning user_id", [A]));
    expect(touched).toEqual([]);
    const a = await as(db, A, (q) => q('select alias, avatar_id from profiles where user_id = $1', [A]));
    expect(a[0]).toEqual({ alias: 'Ana lectora', avatar_id: 'vidente-estrellas' });
    expect(await rejects(as(db, B, (q) => q("insert into profiles (user_id, alias) values ($1, 'suplantación')", [A])))).toMatch(/row-level security|duplicate/);
  });

  it('el avatar debe ser del catálogo; el alias, de 2 a 40 caracteres', async () => {
    expect(await rejects(as(db, A, (q) => q("update profiles set avatar_id = 'data:image/png;base64,AAA' where user_id = $1", [A])))).toMatch(/check/);
    expect(await rejects(as(db, A, (q) => q("update profiles set alias = 'x' where user_id = $1", [A])))).toMatch(/check/);
    expect(await rejects(as(db, A, (q) => q('update profiles set alias = $2 where user_id = $1', [A, 'x'.repeat(41)])))).toMatch(/check/);
  });

  it('sin sesión no se ve nada; quien no activa la comunidad no aparece para otros', async () => {
    expect(await rejects(as(db, null, (q) => q('select * from profiles')))).toMatch(/permission denied/);
    const seenByA = await as(db, A, (q) => q('select alias from profiles order by alias'));
    expect(seenByA.map((r) => r.alias)).toEqual(['Ana lectora', 'Bruno']);
    // Los perfiles no tienen correo ni nada privado que filtrar
    const cols = await db.query("select column_name from information_schema.columns where table_name = 'profiles'");
    expect(cols.rows.map((r) => r.column_name).sort()).toEqual(['alias', 'avatar_id', 'community_enabled', 'created_at', 'updated_at', 'user_id']);
  });
});

describe('opiniones públicas', () => {
  it('publicar solo expone los campos de la copia pública; la biblioteca privada sigue cerrada', async () => {
    await as(db, A, (q) => q("insert into libraries (data) values ('{\"books\":[{\"title\":\"Circe\",\"quotes\":[\"subrayado privado\"]}]}')"));
    await as(db, A, (q) => q("insert into public_reviews (work_id, rating_quarters, body, has_spoilers, pace) values ($1, 15, 'Preciosa', false, 2)", [work]));
    const seen = await as(db, B, (q) => q('select * from public_reviews where work_id = $1', [work]));
    expect(seen).toHaveLength(1);
    expect(Object.keys(seen[0]).sort()).toEqual(['body', 'emotion', 'has_spoilers', 'id', 'pace', 'published_at', 'rating_quarters', 'romance', 'status', 'surprise', 'tropes', 'tropes_none', 'updated_at', 'user_id', 'work_id'].filter((k) => k in seen[0] || !k.startsWith('tropes')));
    // 3,75 se conserva como 15 cuartos
    expect(seen[0].rating_quarters / 4).toBe(3.75);
    // La biblioteca (diario, subrayados, páginas) de A no es visible para B
    expect(await as(db, B, (q) => q('select * from libraries'))).toEqual([]);
  });

  it('nadie publica en nombre de otro ni sin haber activado la comunidad', async () => {
    expect(await rejects(as(db, B, (q) => q('insert into public_reviews (work_id, user_id, body) values ($1, $2, $3)', [work, A, 'falsa'])))).toMatch(/row-level security/);
    expect(await rejects(as(db, C, (q) => q("insert into public_reviews (work_id, body) values ($1, 'hola')", [work])))).toMatch(/row-level security/);
  });

  it('una persona cuenta una vez por obra (no por edición ni por relectura)', async () => {
    expect(await rejects(as(db, A, (q) => q("insert into public_reviews (work_id, rating_quarters, body) values ($1, 4, 'otra')", [work])))).toMatch(/duplicate key/);
  });

  it('retirar deja de mostrar y de contar; volver a publicar es idempotente', async () => {
    await as(db, B, (q) => q("insert into public_reviews (work_id, rating_quarters, body) values ($1, 8, 'Bien')", [work]));
    let stats = (await as(db, A, (q) => q('select ratings, average from work_review_stats where work_id = $1', [work])))[0];
    expect(Number(stats.ratings)).toBe(2);
    expect(Number(stats.average)).toBeCloseTo((15 + 8) / 2 / 4);
    await as(db, B, (q) => q("update public_reviews set status = 'withdrawn' where work_id = $1 and user_id = $2", [work, B]));
    await as(db, B, (q) => q("update public_reviews set status = 'withdrawn' where work_id = $1 and user_id = $2", [work, B]));
    expect(await as(db, A, (q) => q('select id from public_reviews where user_id = $1', [B]))).toEqual([]);
    stats = (await as(db, A, (q) => q('select ratings, average from work_review_stats where work_id = $1', [work])))[0];
    expect(Number(stats.ratings)).toBe(1);
    expect(Number(stats.average)).toBe(3.75);
    // B sigue viendo su propia copia retirada (su borrador privado vive en su biblioteca)
    expect(await as(db, B, (q) => q('select status from public_reviews where user_id = $1', [B]))).toEqual([{ status: 'withdrawn' }]);
  });

  it('sin puntuación es null y no cuenta como cero en la media', async () => {
    const w2 = (await as(db, A, (q) => q("insert into works (kind, title) values ('local', 'Sin nota') returning id")))[0].id;
    await as(db, A, (q) => q("insert into public_reviews (work_id, body) values ($1, 'Solo texto')", [w2]));
    const s = (await as(db, B, (q) => q('select reviews, ratings, average from work_review_stats where work_id = $1', [w2])))[0];
    expect(Number(s.reviews)).toBe(1);
    expect(Number(s.ratings)).toBe(0);
    expect(s.average).toBeNull();
  });

  it('no se puede cambiar el autor o la obra ni falsear la moderación', async () => {
    expect(await rejects(as(db, A, (q) => q('update public_reviews set user_id = $2 where user_id = $1', [A, B])))).toMatch(/row-level security|autor/);
    expect(await rejects(as(db, A, (q) => q("update public_reviews set status = 'moderated' where user_id = $1", [A])))).toMatch(/row-level security/);
  });
});

describe('obras', () => {
  it('no se fusionan por título y una referencia externa es única', async () => {
    const twin = (await as(db, B, (q) => q("insert into works (kind, title, author) values ('local', 'Circe', 'Madeline Miller') returning id")))[0].id;
    expect(twin).not.toBe(work);
    await as(db, A, (q) => q("insert into works (kind, source, external_id, title) values ('external', 'openlibrary', '/works/OL17301948W', 'Circe')"));
    expect(await rejects(as(db, B, (q) => q("insert into works (kind, source, external_id, title) values ('external', 'openlibrary', '/works/OL17301948W', 'Circe')")))).toMatch(/duplicate key/);
    expect(await rejects(as(db, B, (q) => q("insert into works (kind, source, external_id, title) values ('external', 'openlibrary', 'cualquier cosa', 'X')")))).toMatch(/check/);
  });
});

describe('bloqueos, denuncias y moderación', () => {
  it('bloquear oculta las aportaciones en ambos sentidos', async () => {
    await as(db, B, (q) => q("update public_reviews set status = 'published' where user_id = $1", [B]));
    await as(db, A, (q) => q('insert into blocks (blocked) values ($1)', [B]));
    expect(await as(db, A, (q) => q('select id from public_reviews where user_id = $1', [B]))).toEqual([]);
    expect(await as(db, B, (q) => q('select id from public_reviews where user_id = $1', [A]))).toEqual([]);
    expect(await as(db, A, (q) => q('select alias from profiles where user_id = $1', [B]))).toEqual([]);
    // B no ve la lista de bloqueos de A
    expect(await as(db, B, (q) => q('select * from blocks'))).toEqual([]);
    await as(db, A, (q) => q('delete from blocks where blocked = $1', [B]));
  });

  it('la denuncia no es pública y nadie se da permisos de moderación', async () => {
    const rid = (await as(db, B, (q) => q('select id from public_reviews where user_id = $1', [A])))[0].id;
    await as(db, B, (q) => q("insert into reports (target_type, target_id, reason) values ('review', $1, 'spam')", [rid]));
    expect(await as(db, A, (q) => q('select * from reports'))).toEqual([]);
    expect(await as(db, B, (q) => q('select reason from reports'))).toEqual([{ reason: 'spam' }]);
    expect(await rejects(as(db, B, (q) => q('insert into moderators (user_id) values ($1)', [B])))).toMatch(/permission denied/);
    expect(await rejects(as(db, B, (q) => q('select moderate_review($1)', [rid])))).toMatch(/moderación autorizada/);
    // Moderación autorizada (asignada desde el SQL Editor): retira la opinión y deja de contar
    await db.query('insert into moderators (user_id) values ($1)', [C]);
    await as(db, C, (q) => q('select moderate_review($1)', [rid]));
    expect(await as(db, B, (q) => q('select id from public_reviews where id = $1', [rid]))).toEqual([]);
    expect(await as(db, C, (q) => q('select reason from reports'))).toEqual([{ reason: 'spam' }]);
    // El autor no puede «despublicar la moderación»
    const back = await as(db, A, (q) => q("update public_reviews set status = 'published' where id = $1 returning id", [rid]));
    expect(back).toEqual([]);
  });

  it('el límite de escritura está en el servidor', async () => {
    const w = (await as(db, B, (q) => q("insert into works (kind, title) values ('local', 'Ráfaga') returning id")))[0].id;
    await as(db, B, (q) => q("insert into public_reviews (work_id, body) values ($1, 'x')", [w]));
    const error = await rejects(
      as(db, B, async (q) => {
        for (let i = 0; i < 25; i += 1) await q('update public_reviews set body = $2 where work_id = $1', [w, `v${i}`]);
      }),
    );
    expect(error).toMatch(/Demasiadas escrituras/);
  });

  it('las vistas no eluden las políticas: sin sesión no hay estadísticas', async () => {
    expect(await rejects(as(db, null, (q) => q('select * from work_review_stats')))).toMatch(/permission denied/);
    expect(await rejects(as(db, null, (q) => q('select * from public_reviews')))).toMatch(/permission denied/);
  });
});

describe('lista de bloqueos', () => {
  it('cada persona ve solo a quien ella ha bloqueado, con alias y avatar; desbloquear lo quita', async () => {
    await as(db, A, (q) => q('insert into blocks (blocked) values ($1)', [B]));
    const mine = await as(db, A, (q) => q('select user_id, alias, avatar_id from my_blocked_profiles()'));
    expect(mine).toEqual([{ user_id: B, alias: 'Bruno', avatar_id: 'gato-lector' }]);
    // B no ve la lista de A (la suya está vacía) y sin sesión no se puede llamar
    expect(await as(db, B, (q) => q('select * from my_blocked_profiles()'))).toEqual([]);
    expect(await rejects(as(db, null, (q) => q('select * from my_blocked_profiles()')))).toMatch(/permission denied/);
    // B no puede borrar el bloqueo de A
    expect(await as(db, B, (q) => q('delete from blocks where blocker = $1 returning blocked', [A]))).toEqual([]);
    await as(db, A, (q) => q('delete from blocks where blocked = $1', [B]));
    expect(await as(db, A, (q) => q('select * from my_blocked_profiles()'))).toEqual([]);
    expect(await as(db, A, (q) => q('select alias from profiles where user_id = $1', [B]))).toEqual([{ alias: 'Bruno' }]);
  });
});
