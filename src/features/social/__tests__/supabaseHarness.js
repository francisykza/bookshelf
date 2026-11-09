// Banco de pruebas de autorización (SPEC §25.0): un Postgres 17 real embebido (PGlite) con lo mínimo de Supabase
// —`auth.users`, `auth.uid()` leyendo la identidad de la petición y los roles `anon` y `authenticated`— para
// aplicar el esquema y las migraciones tal cual y probar las peticiones directas cuenta contra cuenta.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..');

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant usage on schema public to anon, authenticated;
`;

/** Base de datos con el esquema base y las migraciones indicadas (por prefijo de nombre, en orden). */
/**
 * La reestructuración de muebles (9-11-2026) cierra los sobres y lo retirado no se compra ni se mueve. Las pruebas de
 * esas reglas (para cuando se reabran) cargan todo menos esta migración, con `{ sin: [REFORMA_MUEBLES] }`; la reforma
 * se prueba en edificio/__tests__/reforma.rls.test.js.
 */
export const REFORMA_MUEBLES = '20261123120000_muebles_reforma.sql';

export async function createDatabase(upTo = Infinity, { sin = [] } = {}) {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  await db.exec(readFileSync(join(ROOT, 'supabase', 'schema.sql'), 'utf8'));
  const dir = join(ROOT, 'supabase', 'migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql') && !sin.includes(f)).sort();
  for (const [i, f] of files.entries()) if (i < upTo) await db.exec(readFileSync(join(dir, f), 'utf8'));
  return db;
}

/** Crea usuarios en `auth.users` (como lo haría Supabase Auth) y devuelve sus ids. */
export async function createUsers(db, n) {
  const ids = [];
  for (let i = 0; i < n; i += 1) {
    const { rows } = await db.query('insert into auth.users (id) values (gen_random_uuid()) returning id');
    ids.push(rows[0].id);
  }
  return ids;
}

/**
 * Ejecuta `fn(q)` con la identidad de `userId` (rol `authenticated`), o como `anon` si `userId` es null, igual que
 * una petición directa a la API con ese token. `q(sql, params)` devuelve las filas. Vuelve después a superusuario.
 */
export async function as(db, userId, fn) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId ?? '']);
  await db.exec(`set role ${userId ? 'authenticated' : 'anon'}`);
  try {
    return await fn(async (sql, params) => (await db.query(sql, params)).rows);
  } finally {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}

/** ¿Falla la operación? (devuelve el mensaje, o null si no ha fallado) */
export async function rejects(promise) {
  try {
    await promise;
    return null;
  } catch (e) {
    return e.message;
  }
}
