// Qué ejemplares representa la habitación: una selección acotada, nunca toda la biblioteca. Primero las lecturas actuales,
// después los elegidos para exponer y, si queda sitio, el orden de siempre de los lomos. Elegir solo toca los ajustes: el
// estado de lectura de un libro no depende de que se vea o no en la estantería.
import { SHELF_STATES, roomShelfQueue, shelfQueueOrder } from '../../domain/library';
import { spineQueue, uniqueBooks } from '../../domain/roomShelf';

/** Cuántos libros se ven en la habitación. Se cambia aquí o, para probar, con `&visibles=N` en la dirección. */
export const ROOM_LIMIT = 30;
const MAX_LIMIT = 120;

export function roomLimit(search = '') {
  const asked = new URLSearchParams(search).get('visibles');
  const n = Number(asked);
  return asked && Number.isInteger(n) && n >= 1 && n <= MAX_LIMIT ? n : ROOM_LIMIT;
}

/** Los elegidos: el expuesto de siempre (`roomFeaturedId`) y los que se añaden desde la biblioteca (`roomExhibit`). */
export function chosenIds(settings = {}) {
  return [...new Set([settings.roomFeaturedId, ...(settings.roomExhibit ?? [])])].filter((id) => id != null);
}

/**
 * Lo que hay que cambiar en los ajustes para exponer o retirar un libro, o null si la selección ya está llena. No devuelve
 * nada que afecte a los libros.
 */
export function toggleExhibit(settings = {}, id, limit = ROOM_LIMIT) {
  if (settings.roomFeaturedId === id) return { roomFeaturedId: null };
  const list = settings.roomExhibit ?? [];
  if (list.includes(id)) return { roomExhibit: list.filter((other) => other !== id) };
  // La lectura de la mesa ocupa siempre un sitio
  if (chosenIds(settings).length >= limit - 1) return null;
  return { roomExhibit: [...list, id] };
}

/** Los k primeros según `compare`, de una pasada: no hace falta ordenar toda la biblioteca para quedarse con unos pocos. */
export function firstOf(list, compare, k) {
  const out = [];
  for (const item of list) {
    if (out.length === k && compare(item, out[k - 1]) >= 0) continue;
    let lo = 0;
    let hi = out.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (compare(item, out[mid]) < 0) hi = mid;
      else lo = mid + 1;
    }
    out.splice(lo, 0, item);
    if (out.length > k) out.pop();
  }
  return out;
}

/** La selección, en orden, sin `skipId` (la cubierta de frente, que ocupa uno de los sitios). */
export function roomSelection(books, settings = {}, limit = ROOM_LIMIT, skipId = null) {
  const pool = uniqueBooks(books);
  const room = Math.max(0, limit - (skipId == null ? 0 : 1));
  const byId = new Map(pool.map((b) => [b.id, b]));
  const reading = spineQueue(
    pool.filter((b) => b.status === 'reading'),
    settings,
    skipId,
  );
  const chosen = chosenIds(settings)
    .map((id) => byId.get(id))
    .filter((b) => b && b.id !== skipId && b.status !== 'reading');
  const taken = new Set(chosen.map((b) => b.id));
  // Cada estado aporta como mucho `room`, así que el principio de la cola es el mismo que con la biblioteca entera
  const rest = SHELF_STATES.filter((s) => s !== 'reading').flatMap((status) =>
    firstOf(
      pool.filter((b) => b.status === status && b.id !== skipId && !taken.has(b.id)),
      shelfQueueOrder(status),
      room,
    ),
  );
  return [...reading, ...chosen, ...roomShelfQueue(rest, null)].slice(0, room);
}
