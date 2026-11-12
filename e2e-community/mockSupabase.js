// Simulador mínimo de Supabase (PostgREST + Auth) para las pruebas de INTERFAZ de la comunidad (SPEC §25.15).
// No sustituye a las pruebas de autorización: esas se hacen contra Postgres real con las migraciones
// (`src/features/social/__tests__/*.rls.test.js`). Aquí solo se responde a `http://supabase.test` para poder
// recorrer las pantallas con una sesión iniciada. Imita lo que la app necesita: filtros eq/neq/in, orden,
// límite, objeto único, upsert con conflicto y la vista de estadísticas.
import { randomUUID } from 'node:crypto';
import { CATALOG } from '../src/features/edificio/catalog.js';
import { SOBRES, isDeHabitacionEspecial } from '../src/features/edificio/economy.js';
import { starterRoom } from '../src/features/edificio/demo.js';
import { PRENDAS, ROPA_TIENDA } from '../src/features/edificio/actor.js';
import { missionsOf } from '../src/features/edificio/dailyMissions.js';
import { CAJA, CASINO, LATA, valor } from '../src/features/edificio/hotel/veintiuna.js';
import { RULETA, RULETA_REPETIDO, lunesDe } from '../src/features/edificio/hotel/ruleta.js';
import { CHISTERAS_JUEGO, PREMIOS_CHISTERAS, conejoTras } from '../src/features/edificio/hotel/chisteras.js';
import { ALBARAN, DESCUENTOS } from '../src/features/edificio/hotel/albaran.js';
import { isRetirado } from '../src/features/edificio/retirados.js';

export const SUPABASE = 'http://supabase.test';

// 1.99 · El Almacén del Puerto
const ALMACEN_RPC = ['estado', 'empezar', 'sellar', 'comprar', 'ropa_comprar', 'amigos', 'invitar', 'unirse', 'salir', 'pulso'].map((x) => `rpc/piso_almacen_${x}`);
const madrid = (t = Date.now()) => new Date(t).toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
/** La próxima medianoche de Madrid, en ms (busca el primer minuto en que cambia el día). */
function vuelveMadrid() {
  const hoy = madrid();
  let t = Date.now();
  while (madrid(t) === hoy) t += 15 * 60000;
  t -= 15 * 60000;
  while (madrid(t) === hoy) t += 60000;
  return t - (t % 60000);
}
function descuentoDe(d) {
  const P = ALBARAN.plano[d.modo];
  const fin = d.empezado + ALBARAN.previo + 3 * P + ALBARAN.margen;
  const aciertos = d.marcas.filter((m) => m === true).length;
  const pendientes = d.marcas.filter((m) => m == null).length;
  const estado = d.usado ? 'usado' : pendientes > 0 && Date.now() < fin ? 'jugando' : 'hecho';
  return { estado, modo: d.modo, empezado: d.empezado, marcas: d.marcas, aciertos, pct: estado === 'jugando' ? null : DESCUENTOS[aciertos] };
}

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
const OWNER = { pisos: 'user_id', piso_sellos: 'de', profiles: 'user_id', works: 'created_by', public_reviews: 'user_id', libraries: 'user_id', blocks: 'blocker', reports: 'reporter', follows: 'follower', corners: 'user_id', reading_presence: 'user_id', clubs: 'owner', club_members: 'user_id', club_invites: 'created_by', club_messages: 'user_id', collections: 'owner', distinctions: '__admin__' };

/** Parte una lista PostgREST por las comas de primer nivel (respetando los paréntesis de `and(...)`). */
function splitTop(text) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of text) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

/**
 * 1.62 (§62.4): una condición de `or=(…)`: `col.op.valor` o `and(…)`. Solo `eq` y `lt`, lo que usa la paginación por
 * cursor de los mensajes del club (las fechas llevan puntos: el valor es todo lo que sigue al operador).
 */
function orCondition(row, cond) {
  if (cond.startsWith('and(')) return splitTop(cond.slice(4, -1)).every((c) => orCondition(row, c));
  const [col, op, ...rest] = cond.split('.');
  const val = rest.join('.');
  const cell = row[col] == null ? null : String(row[col]);
  if (op === 'eq') return cell === val;
  if (op === 'lt') return cell != null && cell < val;
  return true;
}

function matches(row, params) {
  for (const [k, v] of params) {
    if (k === 'or') {
      if (!splitTop(v.replace(/^\(|\)$/g, '')).some((c) => orCondition(row, c))) return false;
      continue;
    }
    if (['select', 'order', 'limit', 'on_conflict', 'columns'].includes(k)) continue;
    const [op, ...rest] = v.split('.');
    const val = rest.join('.');
    const cell = row[k] == null ? null : String(row[k]);
    if (op === 'eq' && cell !== val) return false;
    if (op === 'neq' && cell === val) return false;
    if (op === 'in' && !val.replace(/^\(|\)$/g, '').split(',').map((s) => s.replace(/^"|"$/g, '')).includes(cell)) return false;
    // 1.62: búsqueda por alias y página siguiente de opiniones
    if (op === 'ilike' && !(cell ?? '').toLowerCase().includes(val.replace(/[%*]/g, '').toLowerCase())) return false;
    if (op === 'lt' && !(cell != null && cell < val)) return false;
  }
  return true;
}

/** Crea el simulador. `db` es el estado compartido entre páginas de la misma prueba. */
export function createMockSupabase(db = {}, { isbnWorks = {} } = {}) {
  // 1.63: el edificio solo existe si la prueba lo pide (`db.edificio_vecinos`); si no, como sin la migración aplicada
  const EDIFICIO = ['pisos', 'piso_sellos'];
  for (const t of Object.keys(OWNER)) if (!EDIFICIO.includes(t) || db.edificio_vecinos) db[t] ??= [];
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
    // Los toques de la mesa para dos (1.82) no llevan datos: la prueba mueve la mesa a mano
    if (url.pathname.startsWith('/realtime/')) return route.fulfill({ status: 202, contentType: 'application/json', body: '{}' });
    const table = url.pathname.replace('/rest/v1/', '');
    // 1.63 (SPEC §63): el edificio del puerto, como la migración (reparto, portal y RLS de pisos y sellos)
    if (['pisos', 'piso_sellos', 'rpc/asignar_edificio', 'rpc/edificio_portal'].includes(table) && !db.edificio_vecinos) {
      return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST205', message: 'Could not find the table in the schema cache' }) });
    }
    const json = (body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    const blockedWith = (other) => db.blocks.some((b) => (b.blocker === userId && b.blocked === other) || (b.blocker === other && b.blocked === userId));
    // Como un servidor sin la migración del tablón; las pruebas del tablón ponen su propia ruta encima
    // El café del bajo (1.120): sin `simularCafe` (cafeMock.js), el servidor aún no tiene su migración
    if (table.startsWith('rpc/cafe_')) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST202', message: 'Could not find the function' }) });
    if (table.startsWith('rpc/tablon_') ||table.startsWith('rpc/piso_publicar_expuestos') || table.startsWith('rpc/piso_expuestos_de')) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST202', message: 'Could not find the function' }) });
    if (table === 'rpc/sala_lectura_personajes') return json(db.sala_personajes ?? []);
    // La Lonja: `db.lonja` es lo que devuelve `piso_lonja`; las reglas de verdad se prueban en lonja.rls.test.js
    if (table.startsWith('rpc/piso_lonja') || table === 'rpc/piso_estiba_zarpar' || table === 'rpc/piso_taller_recoger') {
      const l = db.lonja;
      if (!l) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST202', message: 'no existe' }) });
      const body = req.postDataJSON?.() ?? {};
      if (table === 'rpc/piso_lonja_poner') {
        l.mias.push({ id: randomUUID(), da: body.doy, busca_mueble: body.pido, busca_tickets: body.precio, busca_rareza: body.clase, creada: new Date().toISOString() });
        l.libres[body.doy] -= 1;
      }
      if (table === 'rpc/piso_lonja_retirar') {
        const o = l.mias.find((x) => x.id === body.cual);
        l.mias = l.mias.filter((x) => x !== o);
        l.libres[o.da] = (l.libres[o.da] ?? 0) + 1;
      }
      if (table === 'rpc/piso_lonja_aceptar') {
        const o = l.puestos.find((x) => x.id === body.cual);
        l.puestos = l.puestos.filter((x) => x !== o);
        l.tickets -= o.busca_tickets ?? 0;
        l.cambios.hechos += 1;
      }
      if (table === 'rpc/piso_lonja_buscar') l.buscas = body.quiere ? [...(l.buscas ?? []), body.cual] : l.buscas.filter((m) => m !== body.cual);
      if (table === 'rpc/piso_taller_recoger') {
        l.talleres.find((t) => t.id === body.cual).recogido = true;
        l.sellos += 30;
      }
      // La estiba simulada: cuenta los huecos sin comprobar la carga (eso se prueba en estiba.rls.test.js)
      if (table === 'rpc/piso_estiba_zarpar') {
        const e = l.estiba;
        const celdas = body.carga.reduce((n, c) => n + e.piezas.find((p) => p.id === c.pieza).celdas.length, 0);
        const sellos = celdas >= e.total ? 7 : celdas * 100 >= e.total * 80 ? 4 : celdas * 100 >= e.total * 50 ? 2 : 1;
        e.hecha = { carga: body.carga, celdas, total: e.total, sellos };
        l.sellos += sellos;
      }
      if (table === 'rpc/piso_lonja_canjear') {
        const premio = l.estiba?.pared.find((a) => a.id === body.que);
        const acabado = body.que.startsWith('acabado:') ? body.que.split(':') : null;
        if (premio) {
          l.sellos -= premio.precio;
          premio.tienes = true;
        } else if (acabado) {
          l.sellos -= l.estiba.acabados[acabado[1]];
          l.libres[acabado[2]] -= 1;
          l.libresAcabado.push({ mueble: acabado[2], acabado: acabado[1], libres: 1 });
        } else {
          l.sellos -= body.que === 'sin-comision' ? 10 : body.que === 'hueco' ? 14 : 18;
          if (body.que === 'sin-comision') l.sinComision = (l.sinComision ?? 0) + 1;
          if (body.que.startsWith('toldo:')) l.toldos = [...l.toldos, body.que.slice(6)];
        }
      }
      return json(l);
    }
    // 1.118 · Gestos y placas del sofá: `db.parejas` = { placas, gestos (los que te llegan: [{ de, gesto }]), enviados,
    // cupo (a quién ya no se puede hacer otro gesto todavía) }. Sin él, como si no estuviera la migración.
    if (['rpc/sala_gesto', 'rpc/sala_gestos_nuevos', 'rpc/sala_placas', 'rpc/sala_placa_libro'].includes(table)) {
      if (!db.parejas) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST202', message: 'no existe' }) });
      const p = db.parejas;
      const body = req.postDataJSON?.() ?? {};
      p.placas ??= [];
      if (table === 'rpc/sala_gesto') {
        (p.enviados ??= []).push({ quien: body.quien, gesto: body.gesto });
        if ((p.cupo ?? []).includes(body.quien)) return json(false);
        (p.cupo ??= []).push(body.quien);
        return json(true);
      }
      if (table === 'rpc/sala_gestos_nuevos') return json((p.gestos ?? []).splice(0));
      if (table === 'rpc/sala_placa_libro') {
        const uid = db.citas?.mia?.cita === body.cita ? db.citas.mia.uid : null;
        const placa = p.placas.find((x) => x.uid === uid);
        if (!placa) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'P0001', message: 'sala:placa' }) });
        const titulo = String(body.titulo ?? '').trim();
        if (!placa.libros.some((l) => l.titulo.toLowerCase() === titulo.toLowerCase())) placa.libros.push({ titulo, mio: true });
        (p.apuntados ??= []).push({ cita: body.cita, titulo });
      }
      return json(p.placas);
    }
    // 1.117 · La cita de lectura: `db.citas` = { amigos, invitaciones, mia, otroLate (el amigo late a la vez) }. Sin él,
    // como si no estuviera la migración. La hora es la de este reloj.
    if (table.startsWith('rpc/sala_cita')) {
      if (!db.citas) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST202', message: 'no existe' }) });
      const c = db.citas;
      const body = req.postDataJSON?.() ?? {};
      const ahora = Date.now();
      c.amigos ??= [];
      c.invitaciones ??= [];
      (c.llamadas ??= []).push({ rpc: table.slice(4), body });
      const vista = (x) => {
        if (!x) return null;
        const estado = x.estado === 'aceptada' && x.fin <= ahora ? 'terminada' : x.estado;
        return { ...x, estado, otro_aqui: Boolean(c.otroLate) && estado === 'aceptada' && ahora >= x.empieza };
      };
      if (table === 'rpc/sala_citas') return json({ amigos: c.amigos, invitaciones: c.invitaciones.map(vista), mia: vista(c.mia), ahora });
      if (table === 'rpc/sala_cita_invitar') {
        const amigo = c.amigos.find((x) => x.uid === body.amigo);
        const empieza = ahora + body.en_min * 60000;
        c.mia = { cita: randomUUID(), soy: 'anfitrion', uid: amigo.uid, alias: amigo.alias, avatar_id: amigo.avatar_id, minutos: body.minutos, empieza, fin: empieza + body.minutos * 60000, estado: 'invitada', juntos: 0, mios: 0 };
        return json(vista(c.mia));
      }
      if (table === 'rpc/sala_cita_responder') {
        const inv = c.invitaciones.find((x) => x.cita === body.cita);
        c.invitaciones = c.invitaciones.filter((x) => x !== inv);
        if (body.acepta) {
          const empieza = Math.max(inv.empieza, ahora);
          c.mia = { ...inv, soy: 'invitado', estado: 'aceptada', empieza, fin: empieza + inv.minutos * 60000, juntos: 0, mios: 0 };
        } else c.mia = { ...inv, soy: 'invitado', estado: 'no_vino' };
        return json(vista(c.mia));
      }
      if (table === 'rpc/sala_cita_latido') {
        const m = c.mia;
        if (m?.cita === body.cita && m.estado === 'aceptada' && ahora >= m.empieza && ahora < m.fin) {
          const minuto = Math.floor((ahora - m.empieza) / 60000);
          m.minutos_latidos = [...new Set([...(m.minutos_latidos ?? []), minuto])];
          m.mios = m.minutos_latidos.length;
          if (c.otroLate) m.juntos = m.mios;
        }
        return json(vista(m));
      }
      if (table === 'rpc/sala_cita_dejar') {
        const m = c.mia;
        if (m?.cita === body.cita) c.mia = m.estado === 'aceptada' && ahora >= m.empieza ? { ...m, estado: 'terminada' } : null;
        return json(null);
      }
      return json(null);
    }
    // La sala: `db.sala` = { lomos, saludos (quien te saluda), enviados }. Sin él, como si no estuviera la migración
    if (['rpc/sala_libreria', 'rpc/sala_lomo_dejar', 'rpc/sala_lomo_retirar', 'rpc/sala_saludar', 'rpc/sala_saludos_nuevos'].includes(table)) {
      if (!db.sala) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST202', message: 'no existe' }) });
      const sala = db.sala;
      const body = req.postDataJSON?.() ?? {};
      const vista = () => ({ total: sala.lomos.length, lomos: sala.lomos });
      if (table === 'rpc/sala_lomo_dejar') sala.lomos.unshift({ id: randomUUID(), titulo: body.nuevo, alias: 'Ana lectora', mio: true });
      if (table === 'rpc/sala_lomo_retirar') sala.lomos = sala.lomos.filter((l) => l.id !== body.lomo);
      if (table === 'rpc/sala_saludar') {
        (sala.enviados ??= []).push(body.quien);
        return json(true);
      }
      if (table === 'rpc/sala_saludos_nuevos') return json((sala.saludos ?? []).splice(0));
      return json(vista());
    }
    if (table === 'rpc/asignar_edificio') {
      let mine = db.edificio_vecinos.find((v) => v.user_id === userId);
      if (!mine) {
        const ed = 'edificio-1';
        const free = ['1A', '1B', '2A', '2B', '3A', '3B'].find((p) => !db.edificio_vecinos.some((v) => v.edificio === ed && v.puerta === p));
        mine = { user_id: userId, edificio: ed, puerta: free };
        db.edificio_vecinos.push(mine);
      }
      return json({ edificio: mine.edificio, puerta: mine.puerta });
    }
    // La visita desde la Comunidad, como la migración: vecinos o seguidos, con comunidad activa y sin bloqueo
    if (table === 'rpc/piso_visita') {
      if (db.sinPisoVisita) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST202', message: 'Could not find the function' }) });
      const lector = route.request().postDataJSON()?.lector;
      const yo = db.edificio_vecinos.find((v) => v.user_id === userId);
      const suyo = db.edificio_vecinos.find((v) => v.user_id === lector);
      const perfil = db.profiles.find((p) => p.user_id === lector);
      const piso = db.pisos.find((p) => p.user_id === lector);
      const puede = perfil?.community_enabled && !blockedWith(lector) && (suyo?.edificio === yo?.edificio || db.follows.some((f) => f.follower === userId && f.followed === lector));
      return json(puede && suyo && piso ? { user_id: lector, alias: perfil.alias, avatar_id: perfil.avatar_id, puerta: suyo.puerta, layout: piso.layout } : null);
    }
    if (table === 'rpc/edificio_portal') {
      const mine = db.edificio_vecinos.find((v) => v.user_id === userId);
      if (!mine) return json(null);
      const vecinos = db.edificio_vecinos
        .filter((v) => v.edificio === mine.edificio)
        .map((v) => ({ v, p: db.profiles.find((x) => x.user_id === v.user_id) }))
        .filter(({ v, p }) => v.user_id === userId || (p?.community_enabled && !blockedWith(v.user_id)))
        .map(({ v, p }) => ({
          user_id: v.user_id,
          puerta: v.puerta,
          alias: p?.alias ?? null,
          avatar_id: p?.avatar_id ?? null,
          yo: v.user_id === userId,
          layout: db.pisos.find((x) => x.user_id === v.user_id)?.layout ?? null,
          // 1.69 (SPEC §69): el personaje, si la prueba simula la migración (db.personajes = true)
          ...(db.personajes ? { personaje: db.pisos.find((x) => x.user_id === v.user_id)?.personaje ?? null } : {}),
          // Místicos, bloque 2: el legendario que acompaña, si la prueba simula la migración (db.misticos = true)
          ...(db.misticos ? { companero: db.pisos.find((x) => x.user_id === v.user_id)?.companero ?? null } : {}),
          sello_dado: db.piso_sellos.find((x) => x.de === userId && x.para === v.user_id)?.sello ?? null,
          sello_recibido: db.piso_sellos.find((x) => x.de === v.user_id && x.para === userId)?.sello ?? null,
        }));
      return json({ edificio: mine.edificio, puerta: mine.puerta, vecinos });
    }
    // 1.71 (SPEC §71): libro de visitas y «me gusta» por mueble (solo si la prueba lo pide con db.vecinosSocial)
    if (['rpc/piso_social', 'rpc/piso_firmar', 'rpc/piso_megusta'].includes(table)) {
      if (!db.vecinosSocial) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST202', message: 'Could not find the function in the schema cache' }) });
      const body = req.postDataJSON();
      const fail = (message) => route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'P0001', message }) });
      const piso = body.piso;
      const mio = db.edificio_vecinos.find((v) => v.user_id === userId);
      const visibleUser = (u) => u !== userId && mio && db.edificio_vecinos.find((v) => v.user_id === u)?.edificio === mio.edificio && db.profiles.find((p) => p.user_id === u)?.community_enabled && !blockedWith(u);
      if (piso !== userId && !visibleUser(piso)) return fail('Ese piso no está en tu edificio.');
      db.piso_visitas ??= [];
      db.piso_megusta ??= [];
      const items = db.pisos.find((p) => p.user_id === piso)?.layout.items ?? [];
      const alias = (u) => db.profiles.find((p) => p.user_id === u)?.alias ?? null;
      const social = () => ({
        visitas: db.piso_visitas.filter((v) => v.piso === piso && (v.de === userId || visibleUser(v.de))).sort((a, b) => b.creado.localeCompare(a.creado)).slice(0, 20).map((v) => ({ de: v.de, alias: alias(v.de), avatar_id: null, frase: v.frase, dia: v.dia })),
        megusta: db.piso_megusta.filter((m) => m.piso === piso && items.some((i) => i.uid === m.uid && i.id === m.mueble)).reduce((acc, m) => ({ ...acc, [m.uid]: (acc[m.uid] ?? 0) + 1 }), {}),
        mios: db.piso_megusta.filter((m) => m.piso === piso && m.de === userId).map((m) => m.uid),
        regalos: piso === userId ? (db.piso_regalos ?? []).filter((r) => r.para === userId).map((r) => ({ ...r, alias: alias(r.de) })).reverse() : [],
      });
      if (table === 'rpc/piso_social') return json(social());
      if (piso === userId) return fail('Solo se puede en el piso de un vecino de tu edificio.');
      if (table === 'rpc/piso_firmar') {
        if (!['saludo', 'leer', 'luz', 'cafe', 'pronto', 'gracias'].includes(body.frase)) return fail('Esa frase no está en el libro de visitas.');
        const dia = new Date().toISOString().slice(0, 10);
        const hoy = db.piso_visitas.find((v) => v.piso === piso && v.de === userId && v.dia === dia);
        if (hoy) Object.assign(hoy, { frase: body.frase, creado: new Date().toISOString() });
        else db.piso_visitas.push({ piso, de: userId, dia, frase: body.frase, creado: new Date().toISOString() });
        return json(social());
      }
      const item = items.find((i) => i.uid === body.uid);
      if (!item) return fail('Ese mueble ya no está en su piso.');
      db.piso_megusta = db.piso_megusta.filter((m) => !(m.piso === piso && m.de === userId && m.uid === body.uid));
      if (body.si) db.piso_megusta.push({ piso, de: userId, uid: body.uid, mueble: item.id });
      return json(social());
    }
    // 1.80: el casino del sótano, como 20261110120000_hotel_casino.sql (solo si la prueba lo pide con db.casino =
    // { fichas, semana, manos: [], barajas: [[cartas…], …] }). Cada reparto usa la siguiente baraja de `barajas` (sin
    // ellas, una fija): así la prueba sabe qué sale. La mesa para dos, con `amigos` y `mesas` (el amigo es simulado:
    // la prueba mueve su mano a mano en mock.db.casino.mesas[i].suya). La caja, con `caja` (los ids que ya tienes) y
    // `sobre` (los premios que trae el sobre del casino; sin él, uno fijo)
    if (
      [
        'rpc/piso_casino',
        'rpc/piso_casino_repartir',
        'rpc/piso_casino_jugar',
        'rpc/piso_casino_invitar',
        'rpc/piso_casino_aceptar',
        'rpc/piso_casino_rechazar',
        'rpc/piso_casino_mesa_jugar',
        'rpc/piso_casino_canjear',
        'rpc/piso_casino_invitar_garbanzos',
        'rpc/piso_casino_lata_canjear',
        'rpc/piso_casino_cambiar',
        'rpc/piso_casino_ruleta',
        'rpc/piso_casino_ruleta_girar',
        'rpc/piso_casino_chisteras',
        'rpc/piso_casino_chisteras_ver',
        'rpc/piso_casino_chisteras_elegir',
        'rpc/piso_casino_chisteras_canjear',
        'rpc/piso_casino_vitrina',
      ].includes(table)
    ) {
      if (!db.casino) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST202', message: 'Could not find the function in the schema cache' }) });
      const ca = db.casino;
      ca.fichas ??= 0;
      ca.semana ??= 0;
      ca.manos ??= [];
      ca.barajas ??= [];
      ca.garbanzos ??= CASINO.garbanzosInicio;
      ca.amigos ??= [];
      ca.mesas ??= [];
      ca.caja ??= [];
      ca.lata ??= [];
      ca.tickets ??= 30;
      ca.cambio ??= { aTickets: 0, aGarbanzos: 0 };
      const body = req.postDataJSON?.() ?? {};
      const mesa = body.mesa ? ca.mesas.find((m) => m.id === body.mesa) : null;
      if (mesa) body.dia = mesa.dia;
      const llegar = () => {
        if (ca.garbanzosDia !== body.dia) ca.garbanzos += CASINO.garbanzosDia;
        ca.garbanzosDia = body.dia;
      };
      const fail = (message) => route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'P0001', message }) });
      const hoy = ca.manos.filter((m) => m.dia === body.dia && m.mano <= 3);
      const deGarbanzos = ca.manos.filter((m) => m.dia === body.dia && m.mano > 3);
      const delDia = () => ca.manos.filter((m) => m.dia === body.dia && m.mano <= 3);
      const garbanzosHoy = () => ca.manos.filter((m) => m.dia === body.dia && m.mano > 3);
      const abierta = hoy.find((m) => m.estado === 'jugando' && !m.mesa);
      const guardadas = ca.mesas.filter((m) => m.anfitrion && m.dia === body.dia && m.estado === 'invitada' && !m.solo_garbanzos).length;
      const cerrar = (m, fin, extra = 0) => {
        const premio = Math.min(CASINO[fin] + extra, Math.max(0, CASINO.tope - ca.semana));
        m.estado = fin;
        m.fichas = premio;
        ca.semana += premio;
        ca.fichas += premio;
      };
      const estado = () => ({
        dia: body.dia,
        fichas: ca.fichas,
        semana: ca.semana,
        tope: CASINO.tope,
        manos: delDia()
          .map((m) => ({
            mano: m.mano,
            mesa: m.mesa ?? null,
            tuyas: m.tuyas,
            crupier: ['jugando', 'esperando'].includes(m.estado) ? m.crupier.slice(0, 1) : m.crupier,
            tu: valor(m.tuyas),
            suyo: ['jugando', 'esperando'].includes(m.estado) ? null : valor(m.crupier),
            estado: m.estado,
            fichas: m.fichas,
          })),
        quedan: Math.max(0, CASINO.manos - delDia().length),
        quedanGarbanzos: Math.max(0, CASINO.mesasGarbanzos - garbanzosHoy().length - ca.mesas.filter((m) => m.anfitrion && m.solo_garbanzos && m.estado === 'invitada').length),
        tickets: ca.tickets,
        lata: LATA.map((a) => ({ id: a.id, precio: a.precio, tienes: ca.lata.includes(a.id) })),
        cambio: ca.cambio,
        jugando: ca.manos.some((m) => m.dia === body.dia && m.estado === 'jugando' && !m.mesa),
        garbanzos: ca.garbanzos,
        amigos: ca.amigos,
        mesas: ca.mesas
          .filter((m) => ['invitada', 'jugando'].includes(m.estado) || m.dia === body.dia)
          .map((m) => {
            const mia = ca.manos.find((h) => h.mesa === m.id);
            const cerrada = m.estado === 'cerrada';
            return {
              id: m.id,
              dia: m.dia,
              anfitrion: m.anfitrion,
              solo_garbanzos: Boolean(m.solo_garbanzos),
              amigo: m.amigo,
              estado: m.estado,
              fichas: m.fichas,
              garbanzos: m.garbanzos,
              crupier: cerrada ? m.crupier : m.estado === 'jugando' ? m.crupier.slice(0, 1) : [],
              suyo: cerrada ? valor(m.crupier) : null,
              mia: mia ? { mano: mia.mano, tuyas: mia.tuyas, tu: valor(mia.tuyas), estado: mia.estado, fichas: mia.fichas } : null,
              suya: m.suya ? { estado: m.suya.estado, cartas: m.suya.tuyas.length, tuyas: cerrada ? m.suya.tuyas : null, tu: cerrada ? valor(m.suya.tuyas) : null } : null,
              apuesta: cerrada ? m.apuesta : null,
            };
          }),
        caja: CAJA.map((a) => ({ id: a.id, tipo: a.tipo, precio: a.precio, tienes: ca.caja.includes(a.id) })),
      });
      const final = (tuyas, crupier) => {
        const tu = valor(tuyas);
        const suyo = valor(crupier);
        if (tu > 21) return 'perdida';
        if (tu === 21 && tuyas.length === 2) return suyo === 21 && crupier.length === 2 ? 'empate' : 'veintiuna';
        return suyo > 21 || tu > suyo ? 'ganada' : tu === suyo ? 'empate' : 'perdida';
      };
      // Con los dos terminados, el crupier destapa y pide hasta 17; la apuesta, a quien quede más cerca de 21
      const resolver = (m) => {
        const mia = ca.manos.find((h) => h.mesa === m.id);
        if (m.estado !== 'jugando' || mia.estado === 'jugando' || m.suya.estado === 'jugando') return;
        while (valor(m.crupier) < 17) m.crupier.push(m.mazo.shift());
        mia.crupier = m.crupier;
        if (m.solo_garbanzos) mia.estado = final(mia.tuyas, m.crupier);
        else cerrar(mia, final(mia.tuyas, m.crupier), CASINO.compania);
        const puntos = (t) => (valor(t) > 21 ? -1 : valor(t));
        const yo = puntos(mia.tuyas);
        const otro = puntos(m.suya.tuyas);
        m.apuesta = yo > otro ? 'ganas' : yo < otro ? 'pierdes' : 'empate';
        if (m.apuesta === 'ganas') {
          ca.fichas += 2 * m.fichas;
          ca.garbanzos += 2 * m.garbanzos;
        } else if (m.apuesta === 'empate') {
          ca.fichas += m.fichas;
          ca.garbanzos += m.garbanzos;
        }
        m.estado = 'cerrada';
      };
      if (table === 'rpc/piso_casino_invitar') {
        const amigo = ca.amigos.find((a) => a.uid === body.amigo);
        if (!amigo) return fail('Solo se juega en pareja con un amigo: alguien a quien sigues y te sigue.');
        if (body.fichas > CASINO.apuestaFichas || body.garbanzos > CASINO.apuestaGarbanzos) return fail('Se apuestan como mucho 10 fichas y 50 garbanzos.');
        llegar();
        if (ca.fichas < body.fichas || ca.garbanzos < body.garbanzos) return fail('No tienes tanto para apostar.');
        if (hoy.length + guardadas >= CASINO.manos) return fail('Hoy ya has jugado tus tres manos, o las que quedan están guardadas para otras mesas: vuelve mañana.');
        if (ca.mesas.some((m) => m.amigo.uid === amigo.uid && m.dia === body.dia && m.estado !== 'rechazada' && !m.solo_garbanzos)) return fail('Hoy ya tenéis una mesa los dos: una al día por pareja.');
        ca.mesas.unshift({ id: `mesa-${ca.mesas.length + 1}`, dia: body.dia, anfitrion: true, amigo, estado: 'invitada', fichas: body.fichas, garbanzos: body.garbanzos });
        return json(estado());
      }
      if (table === 'rpc/piso_casino_invitar_garbanzos') {
        const amigo = ca.amigos.find((a) => a.uid === body.amigo);
        if (!amigo) return fail('Solo se juega en pareja con un amigo: alguien a quien sigues y te sigue.');
        if (!(body.garbanzos >= 1 && body.garbanzos <= CASINO.apuestaGarbanzos)) return fail('En una mesa de garbanzos se apuesta de 1 a 50.');
        llegar();
        if (ca.garbanzos < body.garbanzos) return fail('No tienes tanto para apostar.');
        ca.mesas.unshift({ id: `mesa-${ca.mesas.length + 1}`, dia: body.dia, anfitrion: true, amigo, estado: 'invitada', fichas: 0, garbanzos: body.garbanzos, solo_garbanzos: true });
        return json(estado());
      }
      if (table === 'rpc/piso_casino_lata_canjear') {
        const a = LATA.find((x) => x.id === body.articulo);
        if (!a) return fail('Eso no está en la lata.');
        if (ca.lata.includes(a.id)) return fail('Eso ya lo tienes.');
        if (ca.garbanzos < a.precio) return fail('Te faltan garbanzos para eso.');
        ca.garbanzos -= a.precio;
        ca.lata.push(a.id);
        return json(estado());
      }
      if (table === 'rpc/piso_casino_cambiar') {
        const aTickets = body.sentido === 'a-tickets';
        const hecho = aTickets ? ca.cambio.aTickets : ca.cambio.aGarbanzos;
        if (hecho + CASINO.cambioTickets > CASINO.topeCambio) return fail('Esta semana ya has cambiado todo lo que se puede.');
        if (aTickets) {
          ca.garbanzos -= CASINO.cambioGarbanzos;
          ca.tickets += CASINO.cambioTickets;
          ca.cambio.aTickets += CASINO.cambioTickets;
        } else {
          ca.tickets -= CASINO.cambioTickets;
          ca.garbanzos += CASINO.vueltaGarbanzos;
          ca.cambio.aGarbanzos += CASINO.cambioTickets;
        }
        return json(estado());
      }
      if (table === 'rpc/piso_casino_ruleta' || table === 'rpc/piso_casino_ruleta_girar') {
        if (!ca.ruleta) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST202', message: 'Could not find the function in the schema cache' }) });
        const ru = ca.ruleta;
        ru.giros ??= {};
        ru.tienes ??= [];
        const lunes = lunesDe(body.dia);
        const vista = () => ({
          semana: lunes,
          casillas: RULETA.map((c) => ({ ...c, tienes: ru.tienes.includes(c.id) })),
          repetido: RULETA_REPETIDO,
          giro: ru.giros[lunes] ?? null,
          fichas: ca.fichas,
          garbanzos: ca.garbanzos,
        });
        if (table === 'rpc/piso_casino_ruleta') return json(vista());
        if (ru.giros[lunes]) return fail('Esta semana ya has girado la ruleta.');
        llegar();
        const n = ru.sale ?? 0;
        const c = RULETA[n];
        const giro = { casilla: n, premio: c.id, repetido: false, fichas: 0, garbanzos: 0 };
        if (c.tipo === 'fichas') giro.fichas = c.cantidad;
        else if (c.tipo === 'garbanzos') giro.garbanzos = c.cantidad;
        else if (ru.tienes.includes(c.id)) Object.assign(giro, { repetido: true, fichas: RULETA_REPETIDO });
        // (muebles, prenda y el mapache, que es un compañero)
        else ru.tienes.push(c.id);
        ca.fichas += giro.fichas;
        ca.garbanzos += giro.garbanzos;
        ru.giros[lunes] = giro;
        return json(vista());
      }
      // 1.111 · La vitrina: `ca.vitrina = { tienes, hitos, amigos: { [uid]: { alias, tienes, hitos, fichas, garbanzos } } }`
      if (table === 'rpc/piso_casino_vitrina') {
        if (!ca.vitrina) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST202', message: 'Could not find the function in the schema cache' }) });
        const vi = ca.vitrina;
        if (body.otro) {
          const o = vi.amigos?.[body.otro];
          if (!o) return fail('Solo se ve la vitrina de un amigo: os tenéis que seguir los dos.');
          return json({ uid: body.otro, alias: o.alias, tienes: o.tienes ?? [], hitos: o.hitos ?? [], fichas: o.fichas ?? 0, garbanzos: o.garbanzos ?? 0 });
        }
        return json({ uid: userId, tienes: vi.tienes ?? [], hitos: vi.hitos ?? [], fichas: ca.fichas, garbanzos: ca.garbanzos });
      }
      // 1.110 · Las chisteras: `ca.chisteras = { barajas: [[inicio, cambios]…], partidas: {} }` (las barajas, en orden; sin
      // ellas, al azar)
      if (table.startsWith('rpc/piso_casino_chisteras')) {
        if (!ca.chisteras) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST202', message: 'Could not find the function in the schema cache' }) });
        const ch = ca.chisteras;
        ch.partidas ??= {};
        ch.perfectas ??= 0;
        const p = ch.partidas[body.dia];
        const vista = (extra = {}) => ({
          dia: body.dia,
          estado: p?.estado ?? null,
          ronda: p?.ronda ?? 1,
          rondas: p?.rondas ?? [],
          aciertos: p?.aciertos ?? 0,
          fichas: p?.fichas ?? 0,
          perfectas: ch.perfectas,
          reglas: CHISTERAS_JUEGO,
          semana: ca.semana,
          tope: CASINO.tope,
          fichasCuenta: ca.fichas,
          // 1.112 · Los sellos (`ch.canjes`: lo ya cambiado; `ch.acabables`: muebles con copia lisa), solo con `ch.premios`
          tienda: ch.premios
            ? {
                sellos: ch.perfectas - (ch.canjes ?? []).reduce((n, id) => n + PREMIOS_CHISTERAS.find((x) => x.id === id).sellos, 0),
                premios: PREMIOS_CHISTERAS.map((x) => ({ id: x.id, tipo: x.tipo, sellos: x.sellos, tienes: (ch.canjes ?? []).includes(x.id) })),
                acabables: ch.acabables ?? [],
              }
            : undefined,
          ...extra,
        });
        if (table === 'rpc/piso_casino_chisteras') return json(vista());
        if (table === 'rpc/piso_casino_chisteras_canjear') {
          const x = PREMIOS_CHISTERAS.find((q) => q.id === body.premio);
          if (!x) return fail('Eso no se cambia por sellos.');
          ch.canjes ??= [];
          if (ch.canjes.includes(x.id)) return fail('Eso ya lo tienes.');
          if (vista().tienda.sellos < x.sellos) return fail('Te faltan sellos: se gana uno con cada partida perfecta.');
          if (x.tipo === 'acabado' && !(ch.acabables ?? []).includes(body.mueble)) return fail('Necesitas una copia lisa guardada de ese mueble, sin colocar ni recién llegada.');
          ch.canjes.push(x.id);
          if (ca.vitrina) ca.vitrina.tienes = [...(ca.vitrina.tienes ?? []), x.id];
          return json(vista());
        }
        if (p?.estado === 'hecha') return fail('Hoy ya has jugado a las chisteras: mañana, más.');
        if (table === 'rpc/piso_casino_chisteras_ver') {
          llegar();
          const q = (ch.partidas[body.dia] ??= { estado: 'jugando', ronda: 1, rondas: [], aciertos: 0, fichas: 0 });
          const n = CHISTERAS_JUEGO.cambios[q.ronda - 1];
          const [inicio, cambios] = ch.barajas?.shift() ?? [Math.floor(Math.random() * 3), Array.from({ length: n }, () => Math.floor(Math.random() * 3))];
          Object.assign(q, { inicio, cambios });
          const r = vista({ inicio, cambios });
          return json({ ...r, estado: 'jugando' });
        }
        if (!p?.cambios) return fail('Primero mira la ronda.');
        const conejo = conejoTras(p.inicio, p.cambios);
        const acierto = conejo === body.chistera;
        p.aciertos += acierto ? 1 : 0;
        p.rondas.push({ elegida: body.chistera, conejo, acierto });
        p.cambios = null;
        if (p.ronda >= CHISTERAS_JUEGO.rondas) {
          p.estado = 'hecha';
          p.fichas = Math.min(CHISTERAS_JUEGO.premios[p.aciertos], Math.max(0, CASINO.tope - ca.semana));
          ca.fichas += p.fichas;
          ca.semana += p.fichas;
          if (p.aciertos === 3) ch.perfectas += 1;
        } else p.ronda += 1;
        return json(vista({ elegida: body.chistera, conejo, acierto }));
      }
      if (table === 'rpc/piso_casino_canjear') {
        const a = CAJA.find((x) => x.id === body.articulo);
        if (!a) return fail('Eso no está en la caja.');
        if (a.tipo !== 'sobre' && ca.caja.includes(a.id)) return fail('Eso ya lo tienes.');
        if (ca.fichas < a.precio) return fail('Te faltan fichas para eso.');
        ca.fichas -= a.precio;
        if (a.tipo !== 'sobre') {
          ca.caja.push(a.id);
          return json(estado());
        }
        return json({ ...estado(), premios: ca.sobre ?? [{ mueble: 'sofa', rareza: 'poco-comun', nuevo: true }] });
      }
      if (table === 'rpc/piso_casino_rechazar') {
        if (!mesa || mesa.estado !== 'invitada') return fail('Esa mesa ya no se puede retirar.');
        mesa.estado = 'rechazada';
        return json(estado());
      }
      if (table === 'rpc/piso_casino_aceptar') {
        if (!mesa || mesa.anfitrion || mesa.estado !== 'invitada') return fail('Esa mesa ya no te espera.');
        llegar();
        if (!mesa.solo_garbanzos && hoy.length >= CASINO.manos) return fail('Alguno de los dos ya ha jugado sus tres manos de hoy.');
        if (ca.fichas < mesa.fichas || ca.garbanzos < mesa.garbanzos) return fail('Alguno de los dos ya no tiene lo que se apostaba.');
        ca.fichas -= mesa.fichas;
        ca.garbanzos -= mesa.garbanzos;
        const mazo = ca.barajas.shift() ?? [9, 8, 6, 5, 22, 12, 1, 2, 3, 4, 7, 10, 11];
        // Como el servidor: anfitrión [1, 3], invitado [2, 4], crupier [5, 6]; aquí, el invitado eres tú
        ca.manos.push({ dia: body.dia, mano: mesa.solo_garbanzos ? 11 + deGarbanzos.length : hoy.length + 1, mesa: mesa.id, tuyas: [mazo[1], mazo[3]], crupier: [mazo[4], mazo[5]], mazo: [], estado: 'jugando', fichas: 0 });
        mesa.suya = { tuyas: [mazo[0], mazo[2]], estado: 'jugando' };
        mesa.crupier = [mazo[4], mazo[5]];
        mesa.mazo = mazo.slice(6);
        mesa.estado = 'jugando';
        return json(estado());
      }
      if (table === 'rpc/piso_casino_mesa_jugar') {
        const mia = mesa && ca.manos.find((h) => h.mesa === mesa.id && h.estado === 'jugando');
        if (!mesa || mesa.estado !== 'jugando' || !mia) return fail('No tienes ninguna mano abierta en esa mesa.');
        if (body.accion === 'pedir') {
          mia.tuyas.push(mesa.mazo.shift());
          if (valor(mia.tuyas) >= 21) mia.estado = 'esperando';
        } else mia.estado = 'esperando';
        resolver(mesa);
        return json(estado());
      }
      if (table === 'rpc/piso_casino') {
        // El amigo simulado juega «por su cuenta» (la prueba mueve su mano): su jugada resuelve la mesa, como en el servidor
        ca.mesas.forEach(resolver);
        return json(estado());
      }
      if (table === 'rpc/piso_casino_repartir') {
        llegar();
        if (abierta) return fail('Termina antes la mano que tienes.');
        if (hoy.length >= CASINO.manos) return fail('Hoy ya has jugado tus tres manos: vuelve mañana.');
        if (hoy.length + guardadas >= CASINO.manos) return fail('Esa mano la tienes guardada para la mesa a la que has invitado: retira la invitación si prefieres jugarla a solas.');
        const mazo = ca.barajas.shift() ?? [9, 8, 6, 5, 12, 1, 2, 3, 4, 7, 10, 11];
        const m = { dia: body.dia, mano: hoy.length + 1, tuyas: [mazo[0], mazo[2]], crupier: [mazo[1], mazo[3]], mazo: mazo.slice(4), estado: 'jugando', fichas: 0 };
        ca.manos.push(m);
        if (valor(m.tuyas) === 21) cerrar(m, valor(m.crupier) === 21 ? 'empate' : 'veintiuna');
        return json(estado());
      }
      if (!abierta) return fail('No tienes ninguna mano abierta.');
      if (body.accion === 'pedir') {
        abierta.tuyas.push(abierta.mazo.shift());
        if (valor(abierta.tuyas) > 21) {
          cerrar(abierta, 'perdida');
          return json(estado());
        }
        if (valor(abierta.tuyas) < 21) return json(estado());
      }
      while (valor(abierta.crupier) < 17) abierta.crupier.push(abierta.mazo.shift());
      const tu = valor(abierta.tuyas);
      const suyo = valor(abierta.crupier);
      cerrar(abierta, suyo > 21 || tu > suyo ? 'ganada' : tu === suyo ? 'empate' : 'perdida');
      return json(estado());
    }
    // 1.70 (SPEC §70): armario y misiones del día, como la migración (solo si la prueba lo pide con db.diarias)
    if (['rpc/piso_mi_armario', 'rpc/piso_mision_diaria'].includes(table)) {
      if (!db.diarias) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST202', message: 'Could not find the function in the schema cache' }) });
      const body = req.postDataJSON();
      const mine = (db.diarias[userId] ??= { prendas: [], dias: {} });
      const armario = (dia, nueva = null, tickets = 0) => ({ prendas: [...mine.prendas], hechas: [...(mine.dias[dia] ?? [])], nueva, tickets });
      if (table === 'rpc/piso_mi_armario') return json(armario(body.dia));
      const hoy = missionsOf(body.dia).map((m) => m.id);
      if (!hoy.includes(body.mision)) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'P0001', message: 'Esa no es una misión de ese día.' }) });
      const hechas = (mine.dias[body.dia] ??= []);
      let nueva = null;
      let tickets = 0;
      if (!hechas.includes(body.mision)) {
        hechas.push(body.mision);
        if (hoy.every((m) => hechas.includes(m))) {
          nueva = PRENDAS.find((p) => !mine.prendas.includes(p)) ?? null;
          if (nueva) mine.prendas.push(nueva);
          // 1.79: con todo el armario, 5 tickets (como 20261109120000_edificio_diarias_tickets.sql)
          else {
            tickets = 5;
            db.diarias_tickets = (db.diarias_tickets ?? 0) + tickets;
            if (db.piso_cuentas?.[userId]) db.piso_cuentas[userId].tickets += tickets;
          }
        }
      }
      return json(armario(body.dia, nueva, tickets));
    }
    // 1.66 (SPEC §66): inventario de muebles, como la migración (solo si la prueba lo pide con `db.piso_cuentas`)
    // 1.67 (SPEC §67): tickets, tienda y sobres. El sorteo del mock es fijo: la prueba pone los premios en `db.piso_sorteo`.
    if (['rpc/piso_mi_inventario', 'rpc/piso_elegir_inicio', 'rpc/piso_reclamar_mision', 'rpc/piso_comprar', 'rpc/piso_abrir_sobre', 'rpc/piso_reciclar', 'rpc/piso_regalar', ...ALMACEN_RPC].includes(table)) {
      if (ALMACEN_RPC.includes(table) && !db.almacen) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST202', message: 'Could not find the function in the schema cache' }) });
      if (table === 'rpc/piso_regalar' && !db.vecinosSocial) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST202', message: 'Could not find the function in the schema cache' }) });
      if (!db.piso_cuentas) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST202', message: 'Could not find the function in the schema cache' }) });
      const counted = (id) => CATALOG.some((c) => c.id === id && !c.set);
      db.piso_inventario ??= {};
      if (!db.piso_cuentas[userId]) {
        db.piso_cuentas[userId] = { inicio_elegido: false, tickets: 30, sin_raro: 0 };
        const count = (items) => items.filter((i) => counted(i.id)).reduce((m, i) => ({ ...m, [i.id]: (m[i.id] ?? 0) + 1 }), {});
        const placed = count(db.pisos.find((p) => p.user_id === userId)?.layout.items ?? []);
        const start = count(starterRoom().items);
        const inv = {};
        for (const id of new Set([...Object.keys(placed), ...Object.keys(start)])) inv[id] = Math.max(placed[id] ?? 0, start[id] ?? 0);
        db.piso_inventario[userId] = inv;
      }
      const cuenta = db.piso_cuentas[userId];
      cuenta.tickets ??= 30;
      cuenta.sin_raro ??= 0;
      const reclamadas = () => (db.piso_reclamos ?? []).filter((k) => k.startsWith(`${userId}:`)).map((k) => `mision:${k.split(':').slice(1).join(':')}`).sort();
      const mine = () => ({ inicio_elegido: cuenta.inicio_elegido, tickets: cuenta.tickets, sin_raro: cuenta.sin_raro, acabados: db.piso_acabados?.[userId] ?? {}, reclamadas: reclamadas(), copias: db.piso_inventario[userId] });
      const fail = (message) => route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'P0001', message }) });
      const cat = (id) => CATALOG.find((c) => c.id === id && !c.set);
      const rareza = (id) => cat(id)?.rareza ?? 'comun';
      // 1.106: lo de las habitaciones especiales, al doble (20261129120000_almacen_especiales.sql)
      const precio = (id) => {
        const p = ({ comun: 20, 'poco-comun': 40 })[rareza(id)] ?? null;
        return p != null && isDeHabitacionEspecial(id) ? p * 2 : p;
      };
      const sumar = (id, n) => (db.piso_inventario[userId][id] = Math.max(0, (db.piso_inventario[userId][id] ?? 0) + n));
      if (table === 'rpc/piso_reclamar_mision') {
        const { mision, semana } = req.postDataJSON();
        db.piso_reclamos ??= [];
        const clave = `${userId}:${mision}:${semana}`;
        if (!db.piso_reclamos.includes(clave)) {
          db.piso_reclamos.push(clave);
          cuenta.tickets += 12;
        }
        return json(mine());
      }
      if (table === 'rpc/piso_comprar') {
        const { mueble } = req.postDataJSON();
        if (!cat(mueble) || precio(mueble) == null) return fail('Eso no se vende en la tienda.');
        if (cuenta.tickets < precio(mueble)) return fail('No tienes tickets suficientes.');
        cuenta.tickets -= precio(mueble);
        sumar(mueble, 1);
        return json(mine());
      }
      // 1.99 (SPEC §99): el Almacén del Puerto, como 20261124120000_hotel_almacen.sql (solo si la prueba pone `db.almacen = {}`).
      // `db.almacen.cortar`: cuántas compras siguientes se hacen pero la respuesta no llega (fallo de red tras cobrar).
      // `db.almacen.caida`: cuántas compras siguientes no llegan al servidor.
      // `db.almacen.ofertas`: las ofertas de hoy, como 20261125120000_almacen_ofertas.sql ([{ id, pct, tipo }]; sin ponerlas, ninguna).
      if (ALMACEN_RPC.includes(table)) {
        const al = db.almacen;
        al.dias ??= {};
        al.compras ??= {};
        al.salas ??= [];
        al.presencia ??= {};
        const body = req.postDataJSON() ?? {};
        const hoy = madrid();
        const dia = al.dias[`${userId}:${hoy}`] ?? null;
        const estado = () => {
          const d = al.dias[`${userId}:${hoy}`];
          return {
            dia: hoy,
            ahora: Date.now(),
            vuelve: vuelveMadrid(),
            semana_hasta: vuelveMadrid() + 3 * 86400000,
            ofertas: al.ofertas ?? [],
            tickets: cuenta.tickets,
            descuento: d ? descuentoDe(d) : { estado: 'libre' },
          };
        };
        const amigo = (otro) => otro && otro !== userId && db.follows.some((x) => x.follower === userId && x.followed === otro) && db.follows.some((x) => x.follower === otro && x.followed === userId) && !blockedWith(otro);
        const perfil = (uid) => db.profiles.find((p) => p.user_id === uid) ?? {};
        if (table === 'rpc/piso_almacen_estado') return json(estado());
        if (table === 'rpc/piso_almacen_empezar') {
          if (!['rapido', 'sinprisa'].includes(body.modo)) return fail('almacen:modo');
          al.dias[`${userId}:${hoy}`] ??= { modo: body.modo, empezado: Date.now(), marcas: [null, null, null], usado: false };
          return json(estado());
        }
        if (table === 'rpc/piso_almacen_sellar') {
          if (!dia || dia.usado) return fail('almacen:sin_albaran');
          const { plano, acierto } = body;
          if (!(plano >= 0 && plano <= 2)) return fail('almacen:plano');
          if (dia.marcas[plano] == null) {
            const P = ALBARAN.plano[dia.modo];
            const t = Date.now() - dia.empezado;
            dia.marcas[plano] = Boolean(acierto) && t >= ALBARAN.previo + plano * P - 600 && t <= ALBARAN.previo + (plano + 1) * P + ALBARAN.margen;
          }
          return json(estado());
        }
        if (table === 'rpc/piso_almacen_comprar') {
          const { compra, articulos, esperado, usar_descuento } = body;
          if ((al.caida ?? 0) > 0) {
            al.caida -= 1;
            return route.abort('failed');
          }
          const hecha = al.compras[compra];
          if (hecha) {
            if (hecha.user !== userId) return fail('almacen:clave');
            return json({ ...hecha.r, repetida: true, inventario: mine() });
          }
          if (!Array.isArray(articulos) || !articulos.length || articulos.length > 12) return fail('almacen:vacio');
          const ids = new Set();
          let subtotal = 0;
          let rebajable = 0;
          let ahorro = 0;
          for (const l of articulos) {
            if (typeof l?.id !== 'string' || !Number.isInteger(l.n) || l.n < 1 || l.n > 10 || ids.has(l.id)) return fail('almacen:linea');
            ids.add(l.id);
            if (isRetirado(l.id)) return fail('almacen:retirado');
            if (!cat(l.id) || precio(l.id) == null) return fail('almacen:no_se_vende');
            const especial = isDeHabitacionEspecial(l.id);
            const pctO = especial ? 0 : ((al.ofertas ?? []).find((o) => o.id === l.id)?.pct ?? 0);
            const unidad = precio(l.id) - Math.floor((precio(l.id) * pctO) / 100);
            subtotal += unidad * l.n;
            if (!especial) rebajable += unidad * l.n;
            ahorro += (precio(l.id) - unidad) * l.n;
          }
          let pct = 0;
          if (usar_descuento) {
            if (!dia || descuentoDe(dia).estado !== 'hecho') return fail('almacen:descuento');
            pct = descuentoDe(dia).pct;
          }
          const descuento = Math.floor((rebajable * pct) / 100);
          const total = subtotal - descuento;
          if (esperado !== total) return fail('almacen:precio');
          if (cuenta.tickets < total) return fail('almacen:saldo');
          cuenta.tickets -= total;
          for (const l of articulos) sumar(l.id, l.n);
          if (usar_descuento) dia.usado = true;
          const r = { compra, repetida: false, subtotal, ahorro, pct, descuento, total, articulos };
          al.compras[compra] = { user: userId, r };
          al.cobros = (al.cobros ?? 0) + 1;
          if ((al.cortar ?? 0) > 0) {
            al.cortar -= 1;
            return route.abort('failed');
          }
          return json({ ...r, inventario: mine() });
        }
        // 1.105: la ropa de la planta, como 20261128120000_almacen_ropa.sql (al armario de db.diarias)
        if (table === 'rpc/piso_almacen_ropa_comprar') {
          const { compra, prendas, esperado } = body;
          const armario = ((db.diarias ??= {})[userId] ??= { prendas: [], dias: {} });
          const hecha = al.compras[compra];
          if (hecha) {
            if (hecha.user !== userId || !hecha.r.ropa) return fail('almacen:clave');
            return json({ ...hecha.r, repetida: true, prendas: [...armario.prendas] });
          }
          if (!Array.isArray(prendas) || !prendas.length || prendas.length > 8) return fail('almacen:vacio');
          if (new Set(prendas).size !== prendas.length || prendas.some((p) => typeof p !== 'string')) return fail('almacen:linea');
          if (prendas.some((p) => ROPA_TIENDA[p] == null)) return fail('almacen:no_se_vende');
          if (prendas.some((p) => armario.prendas.includes(p))) return fail('almacen:ya_tuya');
          const total = prendas.reduce((t, p) => t + ROPA_TIENDA[p], 0);
          if (esperado !== total) return fail('almacen:precio');
          if (cuenta.tickets < total) return fail('almacen:saldo');
          cuenta.tickets -= total;
          armario.prendas.push(...prendas);
          const r = { compra, repetida: false, total, ropa: [...prendas] };
          al.compras[compra] = { user: userId, r };
          if ((al.cortar ?? 0) > 0) {
            al.cortar -= 1;
            return route.abort('failed');
          }
          return json({ ...r, prendas: [...armario.prendas] });
        }
        if (table === 'rpc/piso_almacen_amigos') {
          const vivas = al.salas.filter((x) => x.estado !== 'cerrada');
          const amigos = db.follows.filter((x) => x.follower === userId && amigo(x.followed)).map((x) => ({ uid: x.followed, alias: perfil(x.followed).alias, avatar_id: perfil(x.followed).avatar_id }));
          const invitaciones = vivas.filter((x) => x.invitado === userId && amigo(x.anfitrion)).map((x) => ({ sala: x.id, uid: x.anfitrion, alias: perfil(x.anfitrion).alias, avatar_id: perfil(x.anfitrion).avatar_id, estado: x.estado }));
          const m = vivas.find((x) => x.anfitrion === userId);
          return json({ amigos, invitaciones, mia: m ? { sala: m.id, uid: m.invitado, alias: perfil(m.invitado).alias, avatar_id: perfil(m.invitado).avatar_id, estado: m.estado } : null });
        }
        if (table === 'rpc/piso_almacen_invitar') {
          if (!amigo(body.amigo)) return fail('almacen:no_amigo');
          let sala = al.salas.find((x) => x.anfitrion === userId && x.invitado === body.amigo && x.estado !== 'cerrada');
          if (!sala) {
            for (const x of al.salas) if (x.anfitrion === userId) x.estado = 'cerrada';
            sala = { id: randomUUID(), anfitrion: userId, invitado: body.amigo, estado: 'invitada' };
            al.salas.push(sala);
          }
          return json({ sala: sala.id, estado: sala.estado });
        }
        const sala = al.salas.find((x) => x.id === body.sala);
        if (table === 'rpc/piso_almacen_unirse') {
          if (!sala || sala.invitado !== userId || sala.estado === 'cerrada' || !amigo(sala.anfitrion)) return fail('almacen:sala');
          sala.estado = 'abierta';
          return json({ sala: sala.id, estado: 'abierta' });
        }
        if (table === 'rpc/piso_almacen_salir') {
          if (sala) {
            delete al.presencia[`${sala.id}:${userId}`];
            if (sala.anfitrion === userId) sala.estado = 'cerrada';
          }
          return json(null);
        }
        if (table === 'rpc/piso_almacen_pulso') {
          if (!sala || ![sala.anfitrion, sala.invitado].includes(userId)) return fail('almacen:sala');
          if (sala.invitado === userId && sala.estado === 'invitada') return json({ estado: 'invitada', otros: [] });
          if (sala.estado === 'cerrada') return json({ estado: 'cerrada', otros: [] });
          const clamp = (v, a, b, d) => (Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : d);
          const sello = body.sello && ['rapido', 'sinprisa'].includes(body.sello.modo) ? { modo: body.sello.modo, empezado: body.sello.empezado, marcas: (body.sello.marcas ?? []).slice(0, 3).map((m) => (m === true || m === false ? m : null)) } : null;
          al.presencia[`${sala.id}:${userId}`] = { uid: userId, x: clamp(body.x, 0, 29.5, 15.5), y: clamp(body.y, 0, 26, 23.6), yaw: clamp(body.yaw, -7, 7, 3.5), zona: ['pasillos', 'caja', 'mercadillo', 'ropa'].includes(body.zona) ? body.zona : 'pasillos', mira: cat(body.mira) && !isRetirado(body.mira) ? body.mira : null, mira_n: body.mira_n ?? 0, sello, visto: Date.now() };
          const otros = Object.entries(al.presencia)
            .filter(([k, p]) => k.startsWith(`${sala.id}:`) && p.uid !== userId && Date.now() - p.visto < 20000)
            .map(([, p]) => ({ ...p, alias: perfil(p.uid).alias, avatar_id: perfil(p.uid).avatar_id, personaje: db.pisos.find((x) => x.user_id === p.uid)?.personaje ?? null, hace: (Date.now() - p.visto) / 1000 }));
          return json({ estado: sala.estado, otros });
        }
      }
      if (table === 'rpc/piso_abrir_sobre') {
        const { sobre, cuantos } = req.postDataJSON();
        const def = SOBRES.find((s) => s.id === sobre);
        if (!def) return fail('Ese sobre no está a la venta.');
        const coste = { 1: def.coste1, 5: def.coste5 }[cuantos];
        if (!coste) return fail('Los sobres son de 1 o de 5.');
        if (cuenta.tickets < coste) return fail('No tienes tickets suficientes.');
        db.piso_sorteo ??= [];
        const premios = [];
        for (let i = 0; i < cuantos; i += 1) {
          const [mueble, acabado = null] = String(db.piso_sorteo.shift() ?? 'silla').split('@');
          if (acabado) {
            const mios = ((db.piso_acabados ??= {})[userId] ??= {});
            (mios[mueble] ??= {})[acabado] = (mios[mueble][acabado] ?? 0) + 1;
          }
          const nuevo = !(db.piso_inventario[userId][mueble] > 0);
          sumar(mueble, 1);
          cuenta.sin_raro = ['raro', 'mistico', 'legendario'].includes(rareza(mueble)) ? 0 : cuenta.sin_raro + 1;
          premios.push({ mueble, rareza: rareza(mueble), nuevo, acabado });
        }
        cuenta.tickets -= coste;
        return json({ premios, inventario: mine() });
      }
      // 1.71 (SPEC §71): regalar una copia libre a un vecino visible (1.78: con las reglas de 20261108120000)
      if (table === 'rpc/piso_regalar') {
        const { para, mueble } = req.postDataJSON();
        const mio = db.edificio_vecinos.find((v) => v.user_id === userId);
        const suyo = db.edificio_vecinos.find((v) => v.user_id === para);
        const visible = para !== userId && mio && suyo && mio.edificio === suyo.edificio && db.profiles.find((p) => p.user_id === para)?.community_enabled && !blockedWith(para);
        if (!visible) return fail('Solo se puede regalar a un vecino de tu edificio.');
        // 1.78: solo hasta «raro», uno al día y solo si tienes más de uno
        if (!cat(mueble) || !['comun', 'poco-comun', 'raro'].includes(rareza(mueble))) return fail('Ese mueble no se puede regalar: solo hasta «raro».');
        if ((db.piso_regalos ?? []).some((r) => r.de === userId && Date.now() - Date.parse(r.creado) < 864e5)) return fail('Ya has hecho tu regalo de hoy; mañana, otro.');
        const tengo = db.piso_inventario[userId][mueble] ?? 0;
        if (tengo < 2) return fail('Solo se regala un mueble del que tengas más de uno.');
        const puestos = (db.pisos.find((p) => p.user_id === userId)?.layout.items ?? []).filter((i) => i.id === mueble).length;
        if (tengo - puestos < 1) return fail('No tienes copias libres de ese mueble: guárdalo antes de regalarlo.');
        sumar(mueble, -1);
        db.piso_inventario[para] ??= {};
        db.piso_inventario[para][mueble] = (db.piso_inventario[para][mueble] ?? 0) + 1;
        (db.piso_regalos ??= []).push({ de: userId, para, mueble, creado: new Date().toISOString() });
        return json(mine());
      }
      if (table === 'rpc/piso_reciclar') {
        const { mueble } = req.postDataJSON();
        if (!cat(mueble)) return fail('Eso no se puede reciclar.');
        const puestos = (db.pisos.find((p) => p.user_id === userId)?.layout.items ?? []).filter((i) => i.id === mueble).length;
        if ((db.piso_inventario[userId][mueble] ?? 0) - puestos < 1) return fail('No tienes copias libres de ese mueble: guárdalo antes de reciclarlo.');
        sumar(mueble, -1);
        cuenta.tickets += { comun: 3, 'poco-comun': 8, raro: 20 }[rareza(mueble)];
        return json(mine());
      }
      if (table === 'rpc/piso_elegir_inicio') {
        const { muebles } = req.postDataJSON();
        if (db.piso_cuentas[userId].inicio_elegido) return fail('Ya elegiste tus muebles de inicio.');
        if (muebles?.length !== 6) return fail('Elige seis muebles.');
        if (!muebles.every((id) => counted(id) && rareza(id) === 'comun')) return fail('Solo se eligen muebles comunes del catálogo.');
        for (const id of muebles) db.piso_inventario[userId][id] = (db.piso_inventario[userId][id] ?? 0) + 1;
        db.piso_cuentas[userId].inicio_elegido = true;
      }
      return json(mine());
    }
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
      // Como la RLS real (is_blocked_pair): con un bloqueo en cualquier sentido, ni perfil, ni rincón, ni colecciones
      const blockedPair = (other) => other !== userId && db.blocks.some((b) => (b.blocker === userId && b.blocked === other) || (b.blocker === other && b.blocked === userId));
      if (table === 'profiles') rows = rows.filter((p) => p.user_id === userId || (p.community_enabled && !blockedPair(p.user_id)));
      if (table === 'follows') rows = rows.filter((f) => f.follower === userId || f.followed === userId);
      if (table === 'corners') rows = rows.filter((c) => c.user_id === userId || (c.visible && !blockedPair(c.user_id)));
      if (table === 'collections') rows = rows.filter((c) => c.owner === userId || (c.visible && !blockedPair(c.owner)));
      // La biblioteca sincronizada solo la ve su dueño
      if (table === 'libraries') rows = rows.filter((l) => l.user_id === userId);
      if (table === 'piso_sellos') rows = rows.filter((x) => x.de === userId || x.para === userId);
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
      // Sin la migración del personaje (1.69), la columna no existe
      if (table === 'pisos' && 'personaje' in body && !db.personajes) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST204', message: "Could not find the 'personaje' column of 'pisos' in the schema cache" }) });
      // Sin la migración de los místicos, la columna no existe; con ella, solo un legendario que tienes
      if (table === 'pisos' && 'companero' in body) {
        if (!db.misticos) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST204', message: "Could not find the 'companero' column of 'pisos' in the schema cache" }) });
        const legendario = CATALOG.some((c) => c.id === body.companero && c.rareza === 'legendario');
        if (body.companero !== null && (!legendario || !(db.piso_inventario?.[userId]?.[body.companero] > 0))) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'P0001', message: 'Aún no tienes ese místico.' }) });
      }
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
