// Simulador mínimo de Supabase (PostgREST + Auth) para las pruebas de INTERFAZ de la comunidad (SPEC §25.15).
// No sustituye a las pruebas de autorización: esas se hacen contra Postgres real con las migraciones
// (`src/features/social/__tests__/*.rls.test.js`). Aquí solo se responde a `http://supabase.test` para poder
// recorrer las pantallas con una sesión iniciada. Imita lo que la app necesita: filtros eq/neq/in, orden,
// límite, objeto único, upsert con conflicto y la vista de estadísticas.
import { randomUUID } from 'node:crypto';

export const SUPABASE = 'http://supabase.test';

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

/** Sesión guardada como la dejaría Supabase Auth (clave de almacenamiento de la app). */
export function sessionScript(user) {
  const exp = Math.floor(Date.now() / 1000) + 3600 * 24;
  const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: user.id, email: user.email, role: 'authenticated', aud: 'authenticated', exp })}.firma-de-prueba`;
  const session = { access_token: token, refresh_token: 'refresco-de-prueba', token_type: 'bearer', expires_in: 86400, expires_at: exp, user: { id: user.id, aud: 'authenticated', role: 'authenticated', email: user.email, app_metadata: {}, user_metadata: {} } };
  return `localStorage.setItem('bookshelf:auth', ${JSON.stringify(JSON.stringify(session))}); localStorage.setItem('bookshelf_onboarding_done', 'true');`;
}

const DEFAULTS = {
  profiles: () => ({ avatar_id: null, community_enabled: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
  works: () => ({ id: randomUUID(), source: null, external_id: null, created_at: new Date().toISOString() }),
  public_reviews: () => ({ id: randomUUID(), rating_quarters: null, body: '', has_spoilers: false, pace: null, emotion: null, surprise: null, romance: null, status: 'published', published_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
  libraries: () => ({ version: 5 }),
  blocks: () => ({ created_at: new Date().toISOString() }),
  reports: () => ({ id: randomUUID(), created_at: new Date().toISOString() }),
};
const OWNER = { profiles: 'user_id', works: 'created_by', public_reviews: 'user_id', libraries: 'user_id', blocks: 'blocker', reports: 'reporter' };

function matches(row, params) {
  for (const [k, v] of params) {
    if (['select', 'order', 'limit', 'on_conflict', 'or', 'columns'].includes(k)) continue;
    const [op, ...rest] = v.split('.');
    const val = rest.join('.');
    const cell = row[k] == null ? null : String(row[k]);
    if (op === 'eq' && cell !== val) return false;
    if (op === 'neq' && cell === val) return false;
    if (op === 'in' && !val.replace(/^\(|\)$/g, '').split(',').map((s) => s.replace(/^"|"$/g, '')).includes(cell)) return false;
  }
  return true;
}

/** Crea el simulador. `db` es el estado compartido entre páginas de la misma prueba. */
export function createMockSupabase(db = { profiles: [], works: [], public_reviews: [], libraries: [], blocks: [], reports: [] }) {
  const stats = (userId) =>
    Object.values(
      db.public_reviews
        .filter((r) => r.status === 'published' && db.profiles.find((p) => p.user_id === r.user_id)?.community_enabled && !db.blocks.some((b) => (b.blocker === userId && b.blocked === r.user_id) || (b.blocker === r.user_id && b.blocked === userId)))
        .reduce((acc, r) => {
          const s = (acc[r.work_id] ??= { work_id: r.work_id, reviews: 0, ratings: 0, sum: 0, band_1: 0, band_2: 0, band_3: 0, band_4: 0, band_5: 0 });
          s.reviews += 1;
          if (r.rating_quarters != null) {
            s.ratings += 1;
            s.sum += r.rating_quarters;
            s[`band_${Math.ceil(r.rating_quarters / 4)}`] += 1;
          }
          for (const d of ['pace', 'emotion', 'surprise', 'romance']) {
            if (r[d] != null) {
              s[`${d}_n`] = (s[`${d}_n`] ?? 0) + 1;
              s[`${d}_sum`] = (s[`${d}_sum`] ?? 0) + r[d];
            }
          }
          return acc;
        }, {}),
    ).map((s) => {
      const out = { ...s, average: s.ratings ? s.sum / s.ratings / 4 : null };
      for (const d of ['pace', 'emotion', 'surprise', 'romance']) out[`${d}_avg`] = s[`${d}_n`] ? s[`${d}_sum`] / s[`${d}_n`] : null;
      return out;
    });

  async function handle(route, userId) {
    const req = route.request();
    const url = new URL(req.url());
    if (url.pathname.startsWith('/auth/v1/')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: userId }) });
    const table = url.pathname.replace('/rest/v1/', '');
    const params = [...url.searchParams.entries()];
    const single = (req.headers().accept ?? '').includes('vnd.pgrst.object');
    const prefer = req.headers().prefer ?? '';
    const send = (rows) => {
      if (single) {
        if (rows.length !== 1) return route.fulfill({ status: 406, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST116', details: `The result contains ${rows.length} rows`, message: 'JSON object requested, multiple (or no) rows returned' }) });
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows[0]) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
    };
    if (req.method() === 'GET') {
      let rows = table === 'work_review_stats' ? stats(userId) : (db[table] ?? []).filter((r) => table !== 'public_reviews' || r.user_id === userId || (r.status === 'published' && !db.blocks.some((b) => (b.blocker === userId && b.blocked === r.user_id) || (b.blocker === r.user_id && b.blocked === userId))));
      if (table === 'profiles') rows = rows.filter((p) => p.user_id === userId || p.community_enabled);
      rows = rows.filter((r) => matches(r, params));
      const order = url.searchParams.get('order');
      if (order) rows = [...rows].sort((a, b) => String(b.published_at).localeCompare(String(a.published_at)) || String(b.id).localeCompare(String(a.id)));
      const limit = Number(url.searchParams.get('limit'));
      if (limit) rows = rows.slice(0, limit);
      return send(rows);
    }
    const body = req.postDataJSON();
    if (req.method() === 'POST') {
      const conflict = url.searchParams.get('on_conflict')?.split(',');
      const out = [];
      for (const raw of Array.isArray(body) ? body : [body]) {
        const row = { ...DEFAULTS[table]?.(), [OWNER[table]]: userId, ...raw };
        const existing = conflict && db[table].find((r) => conflict.every((c) => String(r[c]) === String(row[c])));
        if (existing) {
          if (prefer.includes('ignore-duplicates')) continue;
          if (!prefer.includes('merge-duplicates')) return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ code: '23505', message: 'duplicate key value violates unique constraint' }) });
          Object.assign(existing, raw, { updated_at: new Date().toISOString() });
          out.push(existing);
        } else {
          if (table === 'profiles' && db.profiles.some((p) => p.alias?.toLowerCase() === row.alias?.toLowerCase())) return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ code: '23505', message: 'duplicate key value violates unique constraint "profiles_alias_unique"' }) });
          if (table === 'libraries') row.updated_at = new Date().toISOString();
          db[table].push(row);
          out.push(row);
        }
      }
      return send(out);
    }
    if (req.method() === 'PATCH') {
      const rows = db[table].filter((r) => r[OWNER[table]] === userId && matches(r, params));
      for (const r of rows) Object.assign(r, body, { updated_at: new Date().toISOString() });
      return send(rows);
    }
    return route.fulfill({ status: 405, body: '' });
  }

  return {
    db,
    /** Engancha el simulador a una página con la sesión de `user`. */
    async attach(page, user) {
      await page.addInitScript(sessionScript(user));
      await page.route(`${SUPABASE}/**`, (route) => handle(route, user.id));
    },
  };
}
