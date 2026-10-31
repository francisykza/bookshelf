// Cuenta y copia en la nube con Supabase (SPEC §9ter, 1.16.0). Sin las variables VITE_SUPABASE_* la app
// funciona solo en el dispositivo. El cliente se carga bajo demanda para no pesar en el arranque.
const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const TABLE = 'libraries';

export const cloudEnabled = Boolean(URL && KEY);

let clientPromise = null;

/** El cliente de Supabase (o null si la nube no está configurada). */
export function getClient() {
  if (!cloudEnabled) return Promise.resolve(null);
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'bookshelf:auth' } }),
  );
  return clientPromise;
}

/** Crea la cuenta. Devuelve true si ya hay sesión, false si falta confirmar el correo. */
export async function signUp(email, password) {
  const sb = await getClient();
  const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
  if (error) throw error;
  // Supabase no revela si el correo ya existía: en ese caso devuelve un usuario sin identidades
  if (data.user && data.user.identities?.length === 0) throw new Error('User already registered');
  return Boolean(data.session);
}

export async function signIn(email, password) {
  const sb = await getClient();
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut() {
  const sb = await getClient();
  await sb?.auth.signOut({ scope: 'local' });
}

/**
 * La fila del usuario: { data, updated_at } o null si aún no hay nada guardado. La biblioteca es UN documento (una fila
 * por cuenta), así que el límite de filas por respuesta de la API no la recorta; aun así, una copia sin su lista de
 * libros se rechaza (nunca se toma una respuesta incompleta por una biblioteca vacía).
 */
export async function fetchLibrary(userId) {
  const sb = await getClient();
  const { data, error } = await sb.from(TABLE).select('data, updated_at').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (data && !Array.isArray(data.data?.books)) throw new Error('La copia de la nube ha llegado incompleta; no se ha aplicado.');
  return data;
}

/** Solo la fecha de la última escritura (unos bytes): para saber si hace falta bajar la biblioteca entera. */
export async function fetchLibraryStamp(userId) {
  const sb = await getClient();
  const { data, error } = await sb.from(TABLE).select('updated_at').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data?.updated_at ?? null;
}

/**
 * Guarda el estado. Con `expected` (el último `updated_at` visto) la escritura solo se aplica si nadie
 * ha escrito entretanto; devuelve el nuevo `updated_at`, o null si otro dispositivo se adelantó.
 */
export async function saveLibrary(userId, state, expected) {
  const sb = await getClient();
  const row = { data: state, version: state.version };
  const query = expected
    ? sb.from(TABLE).update(row).eq('user_id', userId).eq('updated_at', expected)
    : sb.from(TABLE).insert({ ...row, user_id: userId });
  const { data, error } = await query.select('updated_at');
  if (error) {
    // Insertar cuando ya existe la fila (otro dispositivo la creó antes): es un conflicto, no un fallo
    if (error.code === '23505') return null;
    throw error;
  }
  return data?.[0]?.updated_at ?? null;
}
