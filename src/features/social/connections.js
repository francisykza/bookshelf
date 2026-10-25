// Reglas de la entrega 3 sin React ni red (SPEC §25.8–25.12): tropos, presencia en los sillones, rincón y club.

/** Catálogo curado de tropos (los mismos ids que la restricción del servidor). `spoiler`: puede revelar la trama. */
export const TROPES = [
  { id: 'familia-encontrada', label: 'Familia encontrada', spoiler: false },
  { id: 'enemigos-a-amantes', label: 'De enemigos a amantes', spoiler: true },
  { id: 'fuego-lento', label: 'Romance a fuego lento', spoiler: true },
  { id: 'academia', label: 'Academia', spoiler: false },
  { id: 'viaje-iniciatico', label: 'Viaje iniciático', spoiler: false },
  { id: 'intriga-politica', label: 'Intriga política', spoiler: false },
];
export const TROPE_CONSENSUS_MIN = 5;

/** Respuesta al apartado de tropos para la copia pública: sin responder, «ninguna encaja» o una selección. */
export function tropeAnswer({ answered, none, selected = [] }) {
  if (!answered) return { tropes: null, tropes_none: false };
  if (none) return { tropes: [], tropes_none: true };
  const ids = TROPES.map((t) => t.id).filter((id) => selected.includes(id));
  return ids.length ? { tropes: ids, tropes_none: false } : { tropes: null, tropes_none: false };
}

/**
 * Presentación de `work_trope_stats`: siempre con el denominador («3 de 8 lectores») y porcentaje solo con al
 * menos 5 respuestas (antes no se presenta como consenso). `respondents` = quienes respondieron al apartado.
 */
export function tropeView(rows) {
  const respondents = Number(rows.find((r) => r.respondents != null)?.respondents ?? 0);
  const votes = Object.fromEntries(rows.filter((r) => r.trope).map((r) => [r.trope, Number(r.votes)]));
  return {
    respondents,
    consensus: respondents >= TROPE_CONSENSUS_MIN,
    items: TROPES.map((t) => {
      const n = votes[t.id] ?? 0;
      return { ...t, votes: n, text: `${n} de ${respondents} ${respondents === 1 ? 'lector' : 'lectores'}`, percent: respondents >= TROPE_CONSENSUS_MIN ? Math.round((n / respondents) * 100) : null };
    }).filter((t) => t.votes > 0),
  };
}

/** Presencia vigente: renovada hace menos de 3 minutos (la misma caducidad que aplica el servidor). */
export const PRESENCE_TTL_MS = 3 * 60 * 1000;
export const isPresent = (row, now = Date.now()) => now - new Date(row.last_seen).getTime() < PRESENCE_TTL_MS;

/**
 * Reparto en los sillones visibles: primero yo (si estoy sentado) y luego por orden de llegada; los que no caben
 * se cuentan en «+N lectores». Los sillones vacíos quedan vacíos (nunca se inventa a nadie).
 */
export function seatParticipants(rows, me, capacity, now = Date.now()) {
  const present = rows.filter((r) => isPresent(r, now));
  const ordered = [...present.filter((r) => r.user_id === me), ...present.filter((r) => r.user_id !== me)];
  return { seated: ordered.slice(0, capacity), extra: Math.max(0, ordered.length - capacity), all: ordered };
}

/** Tiempo de la sesión voluntaria a partir de su marca de inicio (sin escribir nada cada segundo). */
export function sessionMinutes(startedAt, now = Date.now()) {
  const m = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 60000));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

/** Selección del rincón: como mucho 3 libros (solo id, título, autor, portada) y 3 figuras desbloqueadas. */
export function cornerSelection({ books = [], figures = [], owned = {}, guardian = null, showCurrent = false, currentTitle = '' }) {
  return {
    featured_books: books.slice(0, 3).map((b) => ({ id: b.id, title: b.title, author: b.author ?? '', cover: b.cover ?? '' })),
    figure_ids: figures.filter((id) => owned[id]).slice(0, 3),
    guardian_id: guardian && owned[guardian] ? guardian : null,
    show_current: Boolean(showCurrent && currentTitle),
    current_title: showCurrent && currentTitle ? currentTitle.slice(0, 300) : null,
  };
}

export const CLUB_MESSAGE_MAX = 2000;

/** Enlace de invitación al club (el token va en el fragmento: no viaja a los registros del servidor web). */
export const inviteLink = (origin, token) => `${origin}/#club=${token}`;
export const inviteTokenFromHash = (hash) => /^#club=([0-9a-f]{64})$/.exec(hash ?? '')?.[1] ?? null;
