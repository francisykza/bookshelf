// Posición en un EPUB (SPEC §54.4): automática, del archivo concreto (`hash`) y sin efectos en el registro de lectura.
// Se guarda en el dispositivo enseguida (clave por cuenta y libro) y en el libro sincronizado como mucho cada 60 s, al
// salir por la app y al ocultarse la pestaña. `rev` cuenta las escrituras sincronizadas: sirve para notar que otro
// dispositivo la cambió desde la misma base y preguntar dónde seguir (nunca se elige «la más avanzada» sin preguntar).

export const LOCAL_DELAY = 750;
export const SYNC_EVERY = 60_000;

const key = (userId, bookId) => `bookshelf:epub-pos:${userId || 'local'}:${bookId}`;

/** `{ pos, baseRev, dirty }` guardado en este dispositivo para esta cuenta, o null. */
export function readLocal(userId, bookId) {
  try {
    const v = JSON.parse(localStorage.getItem(key(userId, bookId)) ?? 'null');
    return v && typeof v === 'object' && v.pos ? v : null;
  } catch {
    return null;
  }
}

export function writeLocal(userId, bookId, entry) {
  try {
    localStorage.setItem(key(userId, bookId), JSON.stringify(entry));
    return true;
  } catch {
    return false;
  }
}

/** Posiciones válidas para un archivo: las de otro archivo (otra huella) no se aplican nunca. */
export const forFile = (pos, hash) => (pos && (!pos.hash || pos.hash === hash) ? pos : null);

const samePlace = (a, b) => a.href === b.href && (a.block ?? null) === (b.block ?? null) && Math.abs((a.frac ?? 0) - (b.frac ?? 0)) < 0.002;

/**
 * Dónde empezar a leer un archivo: la posición de este dispositivo si es la más reciente sobre la misma base, la
 * sincronizada si es más nueva y aquí no se movió nada, o un conflicto si las dos cambiaron desde la misma revisión.
 * Devuelve `{ pos, conflict }` (`conflict = { here, other }` o null).
 */
export function startPosition(local, synced, hash) {
  const here = local && forFile(local.pos, hash) ? local : null;
  const other = forFile(synced, hash);
  if (!here) return { pos: other, conflict: null };
  if (!other) return { pos: here.pos, conflict: null };
  const otherRev = other.rev ?? 0;
  if (otherRev <= (here.baseRev ?? 0)) return { pos: here.pos, conflict: null };
  // Otro dispositivo escribió después de nuestra base: si aquí no hubo cambios, gana el otro; si sí, se pregunta
  if (!here.dirty || samePlace(here.pos, other)) return { pos: other, conflict: null };
  return { pos: here.pos, conflict: { here: here.pos, other } };
}

/** Lo que se escribe en el libro sincronizado (sube la revisión). */
export const syncedPosition = (pos, current) => ({ ...pos, rev: (current?.rev ?? 0) + 1 });
