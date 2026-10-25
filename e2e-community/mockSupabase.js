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
  follows: () => ({ created_at: new Date().toISOString() }),
  corners: () => ({ visible: false, featured_books: [], figure_ids: [], guardian_id: null, show_current: false, current_title: null, memories: [], last_book: null, next_book: null, signature_books: [], scene: 'dia', updated_at: new Date().toISOString() }),
  collections: () => ({ id: randomUUID(), dedication: null, visible: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
  distinctions: () => ({ id: randomUUID(), note: null, awarded_on: null }),
  reading_presence: () => ({ share_book: false, book_title: null }),
  clubs: () => ({ id: randomUUID(), description: '', work_id: null, work_title: null, discussion_point: '', status: 'active', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
  club_members: () => ({ joined_at: new Date().toISOString() }),
  club_invites: () => ({ id: randomUUID(), token: (randomUUID() + randomUUID()).replace(/-/g, ''), revoked: false, expires_at: new Date(Date.now() + 14 * 864e5).toISOString(), created_at: new Date().toISOString() }),
  club_messages: () => ({ id: randomUUID(), has_spoilers: false, status: 'visible', created_at: new Date().toISOString(), edited_at: null }),
};
const OWNER = { profiles: 'user_id', works: 'created_by', public_reviews: 'user_id', libraries: 'user_id', blocks: 'blocker', reports: 'reporter', follows: 'follower', corners: 'user_id', reading_presence: 'user_id', clubs: 'owner', club_members: 'user_id', club_invites: 'created_by', club_messages: 'user_id', collections: 'owner', distinctions: '__admin__' };

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
export function createMockSupabase(db = {}, { isbnWorks = {} } = {}) {
  for (const t of Object.keys(OWNER)) db[t] ??= [];
  const memberOf = (clubId, userId) => db.club_members.some((m) => m.club_id === clubId && m.user_id === userId);
  const ownerOf = (clubId, userId) => db.clubs.some((c) => c.id === clubId && c.owner === userId);
  const fresh = (r) => Date.now() - new Date(r.last_seen).getTime() < 180000;
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
    if (table === 'rpc/accept_club_invite') {
      const { invite_token } = req.postDataJSON();
      const inv = db.club_invites.find((i) => i.token === invite_token && !i.revoked);
      if (!inv) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'P0001', message: 'Esta invitación no es válida o ha caducado.' }) });
      if (!memberOf(inv.club_id, userId)) db.club_members.push({ club_id: inv.club_id, user_id: userId, role: 'member', joined_at: new Date().toISOString() });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(inv.club_id) });
    }
    if (table === 'work_trope_stats') {
      const answered = db.public_reviews.filter((r) => r.status === 'published' && r.tropes != null);
      const out = [];
      for (const workId of new Set(answered.map((r) => r.work_id))) {
        const rs = answered.filter((r) => r.work_id === workId);
        const counts = {};
        rs.forEach((r) => r.tropes.forEach((t) => (counts[t] = (counts[t] ?? 0) + 1)));
        out.push(...Object.entries(counts).map(([trope, votes]) => ({ work_id: workId, trope, votes, respondents: rs.length })), { work_id: workId, trope: null, votes: 0, respondents: rs.length });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out.filter((r) => matches(r, [...url.searchParams.entries()]))) });
    }
    if (table === 'rpc/moderators_among') {
      const { ids } = req.postDataJSON();
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify((db.moderators ?? []).filter((id) => ids.includes(id))) });
    }
    if (table === 'rpc/my_blocked_profiles') {
      const rows = db.blocks.filter((b) => b.blocker === userId).map((b) => {
        const p = db.profiles.find((x) => x.user_id === b.blocked);
        return { user_id: b.blocked, alias: p?.alias ?? null, avatar_id: p?.avatar_id ?? null, blocked_at: b.created_at };
      });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
    }
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
      if (table === 'follows') rows = rows.filter((f) => f.follower === userId || f.followed === userId);
      if (table === 'corners') rows = rows.filter((c) => c.user_id === userId || c.visible);
      if (table === 'collections') rows = rows.filter((c) => c.owner === userId || c.visible);
      if (table === 'reading_presence') rows = rows.filter((r) => r.user_id === userId || fresh(r));
      if (table === 'clubs') rows = rows.filter((c) => memberOf(c.id, userId));
      if (table === 'club_members') rows = rows.filter((m) => memberOf(m.club_id, userId));
      if (table === 'club_invites') rows = rows.filter((i) => ownerOf(i.club_id, userId));
      if (table === 'club_messages') rows = rows.filter((m) => memberOf(m.club_id, userId) && (m.status === 'visible' || m.user_id === userId));
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
          if (table === 'reading_presence') existing.last_seen = new Date().toISOString();
          out.push(existing);
        } else {
          if (table === 'profiles' && db.profiles.some((p) => p.alias?.toLowerCase() === row.alias?.toLowerCase())) return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ code: '23505', message: 'duplicate key value violates unique constraint "profiles_alias_unique"' }) });
          if (table === 'libraries') row.updated_at = new Date().toISOString();
          if (table === 'reading_presence') Object.assign(row, { started_at: new Date().toISOString(), last_seen: new Date().toISOString() });
          if (table === 'clubs') db.club_members.push({ club_id: row.id, user_id: userId, role: 'owner', joined_at: new Date().toISOString() });
          db[table].push(row);
          out.push(row);
        }
      }
      return send(out);
    }
    if (req.method() === 'DELETE') {
      const gone = db[table].filter((r) => (r[OWNER[table]] === userId || (table === 'club_members' && ownerOf(r.club_id, userId) && r.role !== 'owner')) && matches(r, params));
      db[table] = db[table].filter((r) => !gone.includes(r));
      return route.fulfill({ status: 204, body: '' });
    }
    if (req.method() === 'PATCH') {
      const rows = db[table].filter((r) => (r[OWNER[table]] === userId || (['club_invites', 'club_messages'].includes(table) && ownerOf(r.club_id, userId))) && matches(r, params));
      if (table === 'reading_presence') rows.forEach((r) => (r.last_seen = new Date().toISOString()));
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
      // Catálogo de Open Library (ISBN → obra): solo los ISBN indicados; el resto, sin obra
      await page.route('https://openlibrary.org/isbn/**', (route) => {
        const isbn = new URL(route.request().url()).pathname.split('/').pop().replace('.json', '');
        const key = isbnWorks[isbn];
        return key ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ key: `/books/X`, works: [{ key }] }) }) : route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
      });
    },
  };
}
