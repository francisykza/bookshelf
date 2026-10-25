// Presencia del salón (SPEC §25.10), compartida por la pestaña «En la sala» y los sillones de la escena:
// - Ver quién lee: se consulta al empezar a mirar, cada 45 s mientras alguien mira y al volver a la app (nunca cada
//   segundo); sin nadie mirando, no se consulta.
// - Estar sentado/a: acción explícita; se renueva cada minuto mientras la app está visible y se reconcilia al volver
//   de una suspensión (el servidor caduca a los 3 minutos sin renovar, así que nadie queda «leyendo» para siempre).
// - Cambio de cuenta o cierre de sesión: `resetPresence` lo olvida todo.
import { useEffect, useSyncExternalStore } from 'react';
import { fetchPresence, sitDown, standUp } from '../services/connections';

const HEARTBEAT_MS = 60_000;
const POLL_MS = 45_000;

let snapshot = { rows: [], seat: null, failure: '' };
const listeners = new Set();
let watchers = 0;
let poll = null;
let beat = null;
let generation = 0;

const set = (patch) => {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((l) => l());
};

async function refresh() {
  const mine = generation;
  try {
    const rows = await fetchPresence();
    if (mine === generation) set({ rows, failure: '' });
  } catch (e) {
    if (mine === generation) set({ failure: e.message });
  }
}

function onVisible() {
  if (document.visibilityState !== 'visible') return;
  if (snapshot.seat) sitDown(snapshot.seat).catch(() => {});
  if (watchers) refresh();
}

function syncTimers() {
  if (watchers && !poll) poll = setInterval(refresh, POLL_MS);
  if (!watchers && poll) {
    clearInterval(poll);
    poll = null;
  }
  if (snapshot.seat && !beat) beat = setInterval(() => document.visibilityState === 'visible' && sitDown(snapshot.seat).catch(() => {}), HEARTBEAT_MS);
  if (!snapshot.seat && beat) {
    clearInterval(beat);
    beat = null;
  }
  if (watchers || snapshot.seat) document.addEventListener('visibilitychange', onVisible);
  else document.removeEventListener('visibilitychange', onVisible);
}

/** Olvida la presencia de la cuenta anterior (cerrar sesión, cambiar de cuenta). */
export function resetPresence() {
  generation += 1;
  snapshot = { rows: [], seat: null, failure: '' };
  syncTimers();
  listeners.forEach((l) => l());
}

export async function sitDownNow(choice) {
  try {
    await sitDown(choice);
    set({ seat: choice, failure: '' });
    syncTimers();
    await refresh();
  } catch (e) {
    set({ failure: e.message });
  }
}

export async function standUpNow(userId) {
  try {
    await standUp(userId);
    set({ seat: null, rows: snapshot.rows.filter((r) => r.user_id !== userId), failure: '' });
    syncTimers();
  } catch (e) {
    set({ failure: e.message });
  }
}

const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** `{ rows, me, failure }`; mientras `watching`, se consulta quién lee. */
export function usePresence({ enabled, userId, watching = true }) {
  const state = useSyncExternalStore(subscribe, () => snapshot);
  useEffect(() => {
    if (!enabled || !watching) return undefined;
    watchers += 1;
    syncTimers();
    refresh();
    return () => {
      watchers -= 1;
      syncTimers();
    };
  }, [enabled, watching]);
  const me = state.rows.find((r) => r.user_id === userId) ?? null;
  // Sentado/a desde otra pestaña o antes de recargar: se retoma la misma elección y su renovación
  useEffect(() => {
    if (me && !snapshot.seat) {
      set({ seat: { shareBook: me.share_book, bookTitle: me.book_title } });
      syncTimers();
    }
  }, [me]);
  return { rows: state.rows, me, failure: state.failure };
}
