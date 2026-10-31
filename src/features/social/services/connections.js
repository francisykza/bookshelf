// Servicio de la entrega 3 (SPEC §25.8–25.12): seguir, actividad, rincón compartido, leer en compañía, club de
// lectura y tropos. Mismo cliente y mismos errores que `community.js`; consultas por lotes y paginadas de 20.
import { PAGE_SIZE, client, fail } from './community';

const titlesFor = async (sb, rows) => {
  const ids = [...new Set(rows.map((r) => r.work_id))];
  if (!ids.length) return rows;
  const { data, error } = await sb.from('works').select('id, title, author').in('id', ids);
  fail(error);
  const byId = Object.fromEntries((data ?? []).map((w) => [w.id, w]));
  return rows.map((r) => ({ ...r, work: byId[r.work_id] ?? null }));
};

// ── Seguir ─────────────────────────────────────────────────────────────────────────────────────────────────
export async function fetchFollowing(userId) {
  const sb = await client();
  const { data, error } = await sb.from('follows').select('followed').eq('follower', userId);
  fail(error);
  return (data ?? []).map((r) => r.followed);
}

/** Seguir (idempotente). */
export async function follow(userId) {
  const sb = await client();
  const { error } = await sb.from('follows').upsert({ followed: userId }, { onConflict: 'follower,followed', ignoreDuplicates: true });
  fail(error);
}

export async function unfollow(userId) {
  const sb = await client();
  const { error } = await sb.from('follows').delete().eq('followed', userId);
  fail(error);
}

/** Actividad inicial: reseñas publicadas por personas seguidas (las 20 más recientes) y novedades de mis clubes. */
export async function fetchActivity(following) {
  const sb = await client();
  let reviews = [];
  if (following.length) {
    const res = await sb.from('public_reviews').select('id, user_id, work_id, rating_quarters, body, has_spoilers, published_at').in('user_id', following).eq('status', 'published').order('published_at', { ascending: false }).limit(PAGE_SIZE);
    fail(res.error);
    reviews = await titlesFor(sb, res.data ?? []);
  }
  const clubs = await sb.from('clubs').select('id, name, discussion_point, status, updated_at').order('updated_at', { ascending: false }).limit(10);
  fail(clubs.error);
  return { reviews, clubs: clubs.data ?? [], more: reviews.length === PAGE_SIZE };
}

/** 1.62 (SPEC §62): la página siguiente de opiniones de quien sigues (más antiguas que `before`). */
export async function fetchMoreActivity(following, before) {
  if (!following.length || !before) return { reviews: [], more: false };
  const sb = await client();
  const res = await sb.from('public_reviews').select('id, user_id, work_id, rating_quarters, body, has_spoilers, published_at').in('user_id', following).eq('status', 'published').lt('published_at', before).order('published_at', { ascending: false }).limit(PAGE_SIZE);
  fail(res.error);
  const reviews = await titlesFor(sb, res.data ?? []);
  return { reviews, more: reviews.length === PAGE_SIZE };
}

// ── Rincón compartido ──────────────────────────────────────────────────────────────────────────────────────
const CORNER_COLUMNS = 'user_id, visible, featured_books, figure_ids, guardian_id, show_current, current_title, updated_at';

export async function fetchCorner(userId) {
  const sb = await client();
  const { data, error } = await sb.from('corners').select(CORNER_COLUMNS).eq('user_id', userId).maybeSingle();
  fail(error);
  return data;
}

/** Varios rincones a la vez (sillones: el Guardián expuesto de cada participante). */
export async function fetchCorners(ids) {
  if (!ids.length) return {};
  const sb = await client();
  const { data, error } = await sb.from('corners').select('user_id, visible, guardian_id').in('user_id', ids);
  fail(error);
  return Object.fromEntries((data ?? []).map((c) => [c.user_id, c]));
}

export async function saveCorner(userId, corner) {
  const sb = await client();
  const { data, error } = await sb.from('corners').upsert({ user_id: userId, ...corner }, { onConflict: 'user_id' }).select(CORNER_COLUMNS).single();
  fail(error);
  return data;
}

/** Opiniones publicadas por una persona (su perfil autorizado). */
export async function fetchReviewsBy(userId) {
  const sb = await client();
  const { data, error } = await sb.from('public_reviews').select('id, user_id, work_id, rating_quarters, body, has_spoilers, published_at').eq('user_id', userId).eq('status', 'published').order('published_at', { ascending: false }).limit(PAGE_SIZE);
  fail(error);
  return titlesFor(sb, data ?? []);
}

// ── Leer en compañía ───────────────────────────────────────────────────────────────────────────────────────
/** Sentarse o renovar la presencia (la hora la pone el servidor). Sin compartir el libro no se envía su título. */
export async function sitDown({ shareBook, bookTitle }) {
  const sb = await client();
  const { error } = await sb.from('reading_presence').upsert({ share_book: Boolean(shareBook), book_title: shareBook ? (bookTitle ?? '').slice(0, 300) || null : null }, { onConflict: 'user_id' });
  fail(error);
}

export async function standUp(userId) {
  const sb = await client();
  const { error } = await sb.from('reading_presence').delete().eq('user_id', userId);
  fail(error);
}

/** Quién lee ahora: las políticas ya excluyen presencias caducadas, a quien no participa y los bloqueos. */
export async function fetchPresence() {
  const sb = await client();
  const { data, error } = await sb.from('reading_presence').select('user_id, share_book, book_title, started_at, last_seen').order('started_at', { ascending: true }).limit(50);
  fail(error);
  return data ?? [];
}

// ── Club de lectura ────────────────────────────────────────────────────────────────────────────────────────
const CLUB_COLUMNS = 'id, owner, name, description, work_id, work_title, discussion_point, status, created_at, updated_at';
const MESSAGE_COLUMNS = 'id, club_id, user_id, body, has_spoilers, status, created_at, edited_at';

export async function fetchMyClubs() {
  const sb = await client();
  const { data, error } = await sb.from('clubs').select(CLUB_COLUMNS).order('updated_at', { ascending: false });
  fail(error);
  return data ?? [];
}

export async function createClub({ name, description, workTitle }) {
  const sb = await client();
  const { data, error } = await sb.from('clubs').insert({ name, description, work_title: workTitle || null }).select(CLUB_COLUMNS).single();
  fail(error);
  return data;
}

export async function updateClub(id, patch) {
  const sb = await client();
  const { data, error } = await sb.from('clubs').update(patch).eq('id', id).select(CLUB_COLUMNS).single();
  fail(error);
  return data;
}

export async function fetchMembers(clubId) {
  const sb = await client();
  const { data, error } = await sb.from('club_members').select('user_id, role, joined_at').eq('club_id', clubId).order('joined_at');
  fail(error);
  return data ?? [];
}

/** Salir del club (o, si lo hace el propietario con otro id, retirar a ese miembro). */
export async function removeMember(clubId, userId) {
  const sb = await client();
  const { error } = await sb.from('club_members').delete().eq('club_id', clubId).eq('user_id', userId);
  fail(error);
}

export async function fetchInvites(clubId) {
  const sb = await client();
  const { data, error } = await sb.from('club_invites').select('id, token, revoked, expires_at, created_at').eq('club_id', clubId).eq('revoked', false).order('created_at', { ascending: false });
  fail(error);
  return data ?? [];
}

export async function createInvite(clubId) {
  const sb = await client();
  const { data, error } = await sb.from('club_invites').insert({ club_id: clubId }).select('id, token, expires_at').single();
  fail(error);
  return data;
}

export async function revokeInvite(inviteId) {
  const sb = await client();
  const { error } = await sb.from('club_invites').update({ revoked: true }).eq('id', inviteId);
  fail(error);
}

export async function acceptInvite(token) {
  const sb = await client();
  const { data, error } = await sb.rpc('accept_club_invite', { invite_token: token });
  fail(error);
  return data;
}

/** Página de 20 mensajes visibles, del más reciente al más antiguo; `cursor` = último de la página anterior. */
export async function fetchMessages(clubId, cursor = null) {
  const sb = await client();
  let q = sb.from('club_messages').select(MESSAGE_COLUMNS).eq('club_id', clubId).eq('status', 'visible');
  if (cursor) q = q.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`);
  const { data, error } = await q.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(PAGE_SIZE);
  fail(error);
  return data ?? [];
}

export async function postMessage(clubId, body, hasSpoilers) {
  const sb = await client();
  const { data, error } = await sb.from('club_messages').insert({ club_id: clubId, body: body.slice(0, 2000), has_spoilers: Boolean(hasSpoilers) }).select(MESSAGE_COLUMNS).single();
  fail(error);
  return data;
}

export async function editMessage(id, body, hasSpoilers) {
  const sb = await client();
  const { error } = await sb.from('club_messages').update({ body: body.slice(0, 2000), has_spoilers: Boolean(hasSpoilers) }).eq('id', id);
  fail(error);
}

/** El autor borra su mensaje; el propietario del club lo retira por moderación. */
export async function hideMessage(id, asOwner) {
  const sb = await client();
  const { error } = await sb.from('club_messages').update({ status: asOwner ? 'removed' : 'deleted' }).eq('id', id);
  fail(error);
}

// ── Tropos ─────────────────────────────────────────────────────────────────────────────────────────────────
export async function fetchTropeStats(workId) {
  const sb = await client();
  const { data, error } = await sb.from('work_trope_stats').select('trope, votes, respondents').eq('work_id', workId);
  fail(error);
  return data ?? [];
}
