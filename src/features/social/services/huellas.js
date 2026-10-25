// Servicio del rincón ilustrado, colecciones y distinciones (SPEC §28.10). Si la migración 1.35.0 aún no está
// aplicada en el servidor, las lecturas devuelven «no disponible» sin romper el perfil de la entrega 3, y las
// escrituras lo explican (nunca se simula que se ha guardado).
import { client, fail } from './community';

const MISSING = ['42703', 'PGRST204', '42P01', 'PGRST205', 'PGRST202', '42883'];
const missing = (error) => Boolean(error && (MISSING.includes(error.code) || /column .* does not exist|schema cache/i.test(error.message ?? '')));
const unavailable = () => Object.assign(new Error('Esta parte del rincón aún no está disponible en el servidor (falta aplicar la migración 1.35.0).'), { code: 'unavailable' });

const EXTRA_COLUMNS = 'user_id, memories, last_book, next_book, signature_books, scene';

export async function fetchCornerExtras(userId) {
  const sb = await client();
  const { data, error } = await sb.from('corners').select(EXTRA_COLUMNS).eq('user_id', userId).maybeSingle();
  if (missing(error)) return { unavailable: true };
  fail(error);
  return data ?? null;
}

export async function saveCornerExtras(userId, extras) {
  const sb = await client();
  const { data, error } = await sb.from('corners').upsert({ user_id: userId, ...extras }, { onConflict: 'user_id' }).select(EXTRA_COLUMNS).single();
  if (missing(error)) throw unavailable();
  fail(error);
  return data;
}

/** Adornos estéticos de varias personas (`{ [userId]: adornmentId }`). */
export async function fetchAdornments(ids) {
  if (!ids.length) return {};
  const sb = await client();
  const { data, error } = await sb.from('profiles').select('user_id, adornment_id').in('user_id', ids);
  if (missing(error)) return {};
  fail(error);
  return Object.fromEntries((data ?? []).filter((p) => p.adornment_id).map((p) => [p.user_id, p.adornment_id]));
}

export async function saveAdornment(userId, adornmentId) {
  const sb = await client();
  const { error } = await sb.from('profiles').update({ adornment_id: adornmentId }).eq('user_id', userId);
  if (missing(error)) throw unavailable();
  fail(error);
}

const COLLECTION_COLUMNS = 'id, owner, title, dedication, books, visible, created_at, updated_at';

export async function fetchCollections(owner) {
  const sb = await client();
  const { data, error } = await sb.from('collections').select(COLLECTION_COLUMNS).eq('owner', owner).order('updated_at', { ascending: false });
  if (missing(error)) return { unavailable: true, items: [] };
  fail(error);
  return { unavailable: false, items: data ?? [] };
}

export async function saveCollection(id, payload) {
  const sb = await client();
  const query = id ? sb.from('collections').update(payload).eq('id', id) : sb.from('collections').insert(payload);
  const { data, error } = await query.select(COLLECTION_COLUMNS).single();
  if (missing(error)) throw unavailable();
  fail(error);
  return data;
}

export async function deleteCollection(id) {
  const sb = await client();
  const { error } = await sb.from('collections').delete().eq('id', id);
  if (missing(error)) throw unavailable();
  fail(error);
}

/** Distinciones asignadas por administración y si modera. Sin migración: ninguna (no se inventan). */
export async function fetchDistinctions(userId) {
  const sb = await client();
  const [rows, mods] = await Promise.all([sb.from('distinctions').select('kind, note, awarded_on').eq('user_id', userId), sb.rpc('moderators_among', { ids: [userId] })]);
  return {
    rows: missing(rows.error) || rows.error ? [] : rows.data ?? [],
    moderator: !mods.error && (mods.data ?? []).some((x) => (typeof x === 'string' ? x : x?.moderators_among) === userId),
  };
}
