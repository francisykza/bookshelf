// Servicio de comunidad (SPEC §25): todas las lecturas y escrituras sociales pasan por aquí, con el cliente de
// Supabase de la app (clave pública; la seguridad la dan las políticas RLS de las migraciones). Consultas por
// lotes y paginadas; los agregados los calcula el servidor. La caché es por usuario y se vacía al cambiar de
// cuenta o cerrar sesión (`clearSocialCache`).
import { getClient } from '../../../services/cloud';

export const PAGE_SIZE = 20;

const cache = { userId: null, profiles: new Map(), stats: new Map() };

/** Vacía todo lo social que dependa del usuario anterior (cerrar sesión, cambiar de cuenta). */
export function clearSocialCache(userId = null) {
  cache.userId = userId;
  cache.profiles.clear();
  cache.stats.clear();
}

async function client() {
  const sb = await getClient();
  if (!sb) throw Object.assign(new Error('La nube no está configurada en esta versión.'), { code: 'off' });
  return sb;
}

const fail = (error) => {
  // Tabla o función inexistente: la migración social aún no está aplicada en este proyecto
  if (error && ['42P01', 'PGRST205', 'PGRST202', '42883'].includes(error.code)) throw Object.assign(new Error('La comunidad aún no está disponible en este servidor.'), { code: 'unavailable' });
  if (error) throw Object.assign(new Error(error.message), { code: error.code });
};

/** ¿Está aplicada la migración social? (una consulta mínima a `profiles`) */
export async function probeCommunity() {
  const sb = await client();
  const { error } = await sb.from('profiles').select('user_id').limit(1);
  fail(error);
  return true;
}

// ── Perfil ──────────────────────────────────────────────────────────────────────────────────────────────────
export async function fetchMyProfile(userId) {
  const sb = await client();
  const { data, error } = await sb.from('profiles').select('user_id, alias, avatar_id, community_enabled').eq('user_id', userId).maybeSingle();
  fail(error);
  return data;
}

export async function saveMyProfile(userId, { alias, avatar_id, community_enabled }) {
  const sb = await client();
  const { data, error } = await sb.from('profiles').upsert({ user_id: userId, alias, avatar_id, community_enabled }, { onConflict: 'user_id' }).select('user_id, alias, avatar_id, community_enabled').single();
  if (error?.code === '23505') throw Object.assign(new Error('Ese alias ya lo usa otra persona.'), { code: 'alias' });
  fail(error);
  cache.profiles.set(userId, data);
  return data;
}

/** Alias y avatar de varios autores en una sola consulta (con caché por usuario). */
export async function fetchProfiles(ids) {
  const missing = [...new Set(ids)].filter((id) => !cache.profiles.has(id));
  if (missing.length) {
    const sb = await client();
    const { data, error } = await sb.from('profiles').select('user_id, alias, avatar_id').in('user_id', missing);
    fail(error);
    for (const p of data ?? []) cache.profiles.set(p.user_id, p);
  }
  return Object.fromEntries(ids.map((id) => [id, cache.profiles.get(id) ?? null]));
}

// ── Obras ──────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * Identidad de obra para publicar: la obra externa verificada (Open Library) se comparte por su referencia; si no
 * la hay, una obra local nueva con identificador propio. Nunca se busca ni se fusiona por título.
 */
export async function ensureWork({ externalId, title, author }) {
  const sb = await client();
  if (externalId) {
    const row = { kind: 'external', source: 'openlibrary', external_id: externalId, title: title.slice(0, 300), author: (author ?? '').slice(0, 300) };
    const { error: upErr } = await sb.from('works').upsert(row, { onConflict: 'source,external_id', ignoreDuplicates: true });
    fail(upErr);
    const { data, error } = await sb.from('works').select('id').eq('source', 'openlibrary').eq('external_id', externalId).single();
    fail(error);
    return data.id;
  }
  const { data, error } = await sb.from('works').insert({ kind: 'local', title: title.slice(0, 300), author: (author ?? '').slice(0, 300) }).select('id').single();
  fail(error);
  return data.id;
}

// ── Opiniones ──────────────────────────────────────────────────────────────────────────────────────────────
const REVIEW_COLUMNS = 'id, user_id, work_id, rating_quarters, body, has_spoilers, pace, emotion, surprise, romance, status, published_at';

/** Publica o actualiza la opinión pública vigente (idempotente: una por persona y obra). */
export async function publishReview(workId, copy) {
  const sb = await client();
  const { data, error } = await sb.from('public_reviews').upsert({ work_id: workId, ...copy, status: 'published' }, { onConflict: 'work_id,user_id' }).select(REVIEW_COLUMNS).single();
  fail(error);
  cache.stats.delete(workId);
  return data;
}

/** Retira la publicación (idempotente); el borrador privado no se toca. */
export async function withdrawReview(workId, userId) {
  const sb = await client();
  const { error } = await sb.from('public_reviews').update({ status: 'withdrawn' }).eq('work_id', workId).eq('user_id', userId).neq('status', 'moderated');
  fail(error);
  cache.stats.delete(workId);
}

export async function fetchStats(workId, { fresh = false } = {}) {
  if (!fresh && cache.stats.has(workId)) return cache.stats.get(workId);
  const sb = await client();
  const { data, error } = await sb.from('work_review_stats').select('*').eq('work_id', workId).maybeSingle();
  fail(error);
  cache.stats.set(workId, data);
  return data;
}

/**
 * Una página de opiniones publicadas (20), en orden estable por fecha e id; `cursor` = última fila de la página
 * anterior. `authors`: limitar a esos autores (lectores seguidos).
 */
export async function fetchReviews(workId, { cursor = null, authors = null } = {}) {
  const sb = await client();
  let q = sb.from('public_reviews').select(REVIEW_COLUMNS).eq('work_id', workId).eq('status', 'published');
  if (authors) q = q.in('user_id', authors.length ? authors : ['00000000-0000-0000-0000-000000000000']);
  if (cursor) q = q.or(`published_at.lt.${cursor.published_at},and(published_at.eq.${cursor.published_at},id.lt.${cursor.id})`);
  const { data, error } = await q.order('published_at', { ascending: false }).order('id', { ascending: false }).limit(PAGE_SIZE);
  fail(error);
  return data ?? [];
}

// ── Bloqueos y denuncias ───────────────────────────────────────────────────────────────────────────────────
export async function blockUser(userId) {
  const sb = await client();
  const { error } = await sb.from('blocks').upsert({ blocked: userId }, { onConflict: 'blocker,blocked', ignoreDuplicates: true });
  fail(error);
  cache.stats.clear();
}

export async function reportContent(targetType, targetId, reason) {
  const sb = await client();
  const { error } = await sb.from('reports').upsert({ target_type: targetType, target_id: targetId, reason: reason.slice(0, 500) }, { onConflict: 'reporter,target_type,target_id', ignoreDuplicates: true });
  fail(error);
}
