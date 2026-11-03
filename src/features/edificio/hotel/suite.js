// La suite de la semana, decorada entre todos (1.79): qué se puede llevar y dónde cabe. Las mismas reglas que
// piso_suite_llevar en supabase/migrations/20261109130000_hotel_suite_semana.sql (lo decide el servidor).
import { CATALOG, catalogItem } from '../catalog';
import { check, findFreeSpot, ROOM } from '../room';

/** Las semanas distintas aportando que dan la «Placa de la suite» (piso_suite_placa_semanas). */
export const SUITE_PLACA_SEMANAS = 4;

/** ¿Se puede llevar a la suite? Lo corriente de suelo, alfombra o pared: ni sagas, ni místicos, ni premios, ni «encima». */
export const llevable = (cat) => Boolean(cat) && !cat.set && ['comun', 'poco-comun', 'raro'].includes(cat.rareza ?? 'comun') && ['suelo', 'alfombra', 'pared'].includes(cat.capa);

/** Lo que tienes que se puede llevar (al menos una copia), en el orden del catálogo. */
export const llevables = (inventory) => CATALOG.filter((c) => llevable(c) && (inventory?.copias?.[c.id] ?? 0) > 0);

// Los sitios que se prueban por orden con «Otro sitio»: el centro y luego alrededor
const NEAR = [
  { x: 4.5, y: 4.5 },
  { x: 1.5, y: 1.5 },
  { x: 7.5, y: 1.5 },
  { x: 1.5, y: 7.5 },
  { x: 7.5, y: 7.5 },
  { x: 4.5, y: 1.5 },
  { x: 1.5, y: 4.5 },
  { x: 7.5, y: 4.5 },
  { x: 4.5, y: 7.5 },
];

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Un sitio libre en la suite (`room`, sin lo tuyo) para el mueble `id`, distinto de `antes` si se puede. Devuelve el
 * mueble sin uid, como lo pide el servidor, o null si no cabe.
 */
export function sitioEnSuite(room, id, { antes = null, intento = 0 } = {}) {
  const cat = catalogItem(id);
  if (!llevable(cat) || room.items.length >= ROOM.maxItems) return null;
  const tries = [];
  if (cat.capa === 'pared') {
    for (const pared of ['fondo', 'izq']) for (let a = 0; a + cat.w <= ROOM.w; a += 1) tries.push({ id, tono: 0, pared, a });
  } else {
    for (let k = 0; k < NEAR.length; k += 1) {
      for (const rot of [0, 1]) {
        const spot = findFreeSpot(room, id, { rot, near: NEAR[(k + intento) % NEAR.length] });
        if (spot) tries.push({ id, tono: 0, x: spot.x, y: spot.y, rot });
      }
    }
  }
  const ok = tries.filter((t) => check(room, { ...t, uid: -1 }).ok);
  if (!ok.length) return null;
  const start = cat.capa === 'pared' ? intento % ok.length : 0;
  const ordered = [...ok.slice(start), ...ok.slice(0, start)];
  return ordered.find((t) => !same(t, antes)) ?? ordered[0];
}
