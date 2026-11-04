// Inventario de muebles (1.66, SPEC §66; fase 1 de docs/qa/economia-muebles.md). Reglas puras: cuántas copias de un
// mueble te quedan libres y qué se puede elegir de inicio. La regla de verdad está en el servidor
// (supabase/migrations/20261103120000_edificio_inventario.sql); esto solo sirve para que la balda no ofrezca lo que el
// servidor rechazaría. Sin inventario (`null`: la migración no está aplicada, o el prototipo de desarrollo), todo es
// libre como antes.
import { acabadoOf } from './acabados';
import { CATALOG, catalogItem, isMistico } from './catalog';

/** Muebles comunes que se eligen de inicio (una sola vez). */
export const START_PICKS = 6;

/** Los muebles de sagas no cuentan: siguen libres hasta que se desbloqueen leyendo (fase 5). */
export const isCounted = (id) => {
  const cat = catalogItem(id);
  return Boolean(cat) && !cat.set;
};

const rarezaOf = (cat) => cat.rareza ?? 'comun';

/** Lo que se puede elegir de inicio: los comunes que no son de sagas. */
export const STARTER_CHOICES = CATALOG.filter((c) => !c.set && rarezaOf(c) === 'comun');

/** Cuántos hay colocados de cada mueble: { id: n }. */
export function placedCounts(room) {
  const out = {};
  for (const i of room?.items ?? []) out[i.id] = (out[i.id] ?? 0) + 1;
  return out;
}

/** Copias que tienes de un mueble (Infinity si no cuenta o no hay inventario; los místicos, sin inventario, ninguna). */
export function ownedCopies(inventory, id) {
  if (!inventory && isMistico(catalogItem(id))) return 0;
  if (!inventory || !isCounted(id)) return Infinity;
  return inventory.copias?.[id] ?? 0;
}

/** Copias de cada acabado que tienes de un mueble (1.86): { acabado: n }. */
export const acabadosDe = (inventory, id) => inventory?.acabados?.[id] ?? {};

/** Copias lisas: las que no llevan acabado. */
export function plainCopies(inventory, id) {
  const owned = ownedCopies(inventory, id);
  return owned === Infinity ? owned : owned - Object.values(acabadosDe(inventory, id)).reduce((a, b) => a + b, 0);
}

/** Copias libres (sin colocar) de un mueble en este piso: las lisas, o las de un acabado. */
export function freeCopies(inventory, room, id, acabado = null) {
  const owned = acabado ? (acabadosDe(inventory, id)[acabado] ?? 0) : plainCopies(inventory, id);
  if (owned === Infinity) return Infinity;
  const puestos = (room?.items ?? []).filter((i) => i.id === id && (i.acabado ?? null) === acabado).length;
  return Math.max(0, owned - puestos);
}

/** El primer mueble del piso del que no hay copias suficientes (null si todo cabe), como `piso_falta_copia`. */
export function missingCopy(inventory, room) {
  if (!inventory) return null;
  const placed = placedCounts(room);
  const sobra = (id) => {
    const puestos = room.items.filter((i) => i.id === id);
    if (puestos.filter((i) => !i.acabado).length > plainCopies(inventory, id)) return true;
    return puestos.some((i) => i.acabado && puestos.filter((o) => o.acabado === i.acabado).length > (acabadosDe(inventory, id)[i.acabado] ?? 0));
  };
  return Object.keys(placed).sort().find((id) => isCounted(id) && (placed[id] > ownedCopies(inventory, id) || sobra(id))) ?? null;
}

/** ¿Es válida una elección de inicio? Seis comunes (se pueden repetir). */
export function validStart(ids) {
  return Array.isArray(ids) && ids.length === START_PICKS && ids.every((id) => STARTER_CHOICES.some((c) => c.id === id));
}

/** Lo que llega del servidor, limpio: { inicioElegido, copias: { id: n }, tickets, sinRaro } (solo ids del catálogo y enteros). */
export function normalizeInventory(data) {
  if (!data || typeof data !== 'object') return null;
  const copias = {};
  for (const [id, n] of Object.entries(data.copias ?? {})) if (catalogItem(id) && Number.isInteger(n) && n > 0) copias[id] = Math.min(99, n);
  // 1.67: saldo de tickets y sobres seguidos sin nada raro (para el pity)
  const n = (v) => (Number.isInteger(v) && v >= 0 ? v : 0);
  // `tienda`: el servidor ya tiene la migración de la tienda (si no, el escaparate no se abre)
  // `reclamadas`: claves `mision:<id>:<lunes>` de las misiones ya cobradas en tickets
  const reclamadas = (Array.isArray(data.reclamadas) ? data.reclamadas : []).filter((k) => typeof k === 'string' && /^mision:[a-z]{2,20}:\d{4}-\d{2}-\d{2}$/.test(k));
  // 1.86: cuántas de esas copias llevan cada acabado
  const acabados = {};
  for (const [id, tiene] of Object.entries(data.acabados ?? {})) {
    const limpio = Object.fromEntries(Object.entries(tiene ?? {}).filter(([k, v]) => acabadoOf(k) && Number.isInteger(v) && v > 0));
    if (copias[id] && Object.keys(limpio).length) acabados[id] = limpio;
  }
  return { inicioElegido: data.inicio_elegido === true, copias, acabados, tickets: n(data.tickets), sinRaro: n(data.sin_raro), tienda: Number.isInteger(data.tickets), reclamadas };
}
