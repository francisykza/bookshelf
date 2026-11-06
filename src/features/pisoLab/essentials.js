// Los cuatro elementos sin los que el piso no funciona como entrada a BookShelf. Tienen un sitio fijo por piso: se puede
// cambiar su color, pero no moverlos, girarlos ni guardarlos, y delante de ellos tiene que quedar paso. Las reglas viajan con
// la habitación (`room.guard`, que `room.js` consulta si existe), así que el decorador no necesita saber qué es esencial para
// respetarlo. Puro, sin dibujo ni almacenamiento.
import { ROOM, check, createRoom, findFreeSpot, footprint, itemsOn } from '../edificio/room';
import { catalogItem } from '../edificio/catalog';

/** `zone`: [x0, y0, x1, y1], en celdas, lo que hay que dejar libre para usarlo. `exempt`: lo que sí puede estar ahí. */
export const LAYOUTS = {
  'lab-1A': {
    estanteria: { nombre: 'Estantería', ids: ['estanteria'], x: 0, y: 0, rot: 0, zone: [0, 1, 2, 2] },
    mesa: { nombre: 'Mesa de lectura', ids: ['mesa-baja', 'mesa'], x: 2, y: 3, rot: 0, zone: [2, 4, 4, 5], exempt: ['sillon'] },
    escritorio: { nombre: 'Escritorio', ids: ['escritorio'], x: 5, y: 0, rot: 0, zone: [5, 1, 7, 2] },
    ordenador: { nombre: 'Ordenador', ids: ['ordenador'], x: 5, y: 0, rot: 0 },
    puerta: { nombre: 'Puerta de salida', ids: ['puerta-piso'], pared: 'fondo', a: 7, zone: [7, 0, 9, 2] },
  },
  'lab-2B': {
    estanteria: { nombre: 'Estantería', ids: ['estanteria'], x: 0, y: 7, rot: 3, zone: [1, 7, 2, 9] },
    mesa: { nombre: 'Mesa de lectura', ids: ['mesa-baja', 'mesa'], x: 1, y: 2, rot: 1, zone: [2, 2, 3, 4], exempt: ['sillon'] },
    escritorio: { nombre: 'Escritorio', ids: ['escritorio'], x: 3, y: 0, rot: 0, zone: [3, 1, 5, 2] },
    ordenador: { nombre: 'Ordenador', ids: ['ordenador'], x: 3, y: 0, rot: 0 },
    puerta: { nombre: 'Puerta de salida', ids: ['puerta-piso'], pared: 'izq', a: 5, zone: [0, 5, 2, 7] },
  },
};

/** Lo que la mesa grande ocupa de más crece hacia atrás: el borde que da al sillón no cambia. */
function anchorOf(spec, id) {
  if (spec.pared) return { pared: spec.pared, a: spec.a };
  const near = footprint(catalogItem(spec.ids[0]), spec.rot).d;
  const own = footprint(catalogItem(id), spec.rot).d;
  return { x: spec.x, y: spec.y + near - own, rot: spec.rot };
}

const specOf = (layout, id) => Object.values(layout).find((spec) => spec.ids.includes(id)) ?? null;
const atAnchor = (spec, item) => Object.entries(anchorOf(spec, item.id)).every(([k, v]) => item[k] === v);

export function isEssential(layout, item) {
  const spec = specOf(layout, item.id);
  return Boolean(spec && atAnchor(spec, item));
}

export function makeGuard(layout) {
  return {
    // Las reglas viajan con la habitación, pero no se guardan con ella
    toJSON: () => undefined,
    locked: (item) => isEssential(layout, item),
    check(room, item, support) {
      if (isEssential(layout, item)) return null;
      const capa = catalogItem(item.id)?.capa;
      if (capa === 'encima' && support != null) {
        const base = room.items.find((i) => i.uid === support);
        if (base && layout.mesa.ids.includes(base.id) && isEssential(layout, base)) return { ok: false, reason: 'reservado' };
      }
      if (capa !== 'suelo') return null;
      const f = footprint(catalogItem(item.id), item.rot);
      for (const spec of Object.values(layout)) {
        if (!spec.zone || spec.exempt?.includes(item.id)) continue;
        const [x0, y0, x1, y1] = spec.zone;
        if (item.x < x1 && x0 < item.x + f.w && item.y < y1 && y0 < item.y + f.d) return { ok: false, reason: 'zona', con: spec.ids[0] };
      }
      return null;
    },
  };
}

/** El nombre con el que se le conoce: una mesa baja, aquí, es la mesa de lectura. */
export const essentialName = (layout, item) => specOf(layout, item.id)?.nombre ?? catalogItem(item.id).nombre;

export const withGuard = (room, layout) => ({ ...room, guard: makeGuard(layout) });

/** El mismo contenido, sin importar el orden en que esté guardado ni el de sus campos. */
const fingerprint = (room) => JSON.stringify([...room.items].sort((a, b) => a.uid - b.uid).map((i) => [i.uid, i.id, i.tono, i.x, i.y, i.rot, i.pared, i.a, i.acabado]));

/**
 * Deja una distribución cumpliendo las reglas, sin perder nada: lo que ya había conserva su color; lo que estorba va al sitio
 * libre más cercano, y lo que no cabe en ningún sitio se devuelve en `stored`, para intentarlo la próxima vez.
 * Devuelve { room, stored, added, moved, changed }, donde `added` son los esenciales nuevos.
 */
export function repairRoom(source, layout, storedBefore = []) {
  const guard = makeGuard(layout);
  const carried = new Map();
  const taken = new Set();
  const essentials = [];
  const added = [];
  for (const spec of Object.values(layout)) {
    const candidates = source.items.filter((i) => spec.ids.includes(i.id) && !taken.has(i.uid));
    const found = candidates.find((i) => atAnchor(spec, i)) ?? candidates.sort((a, b) => spec.ids.indexOf(a.id) - spec.ids.indexOf(b.id) || a.uid - b.uid)[0];
    if (!found) added.push(spec.nombre);
    const id = found?.id ?? spec.ids[0];
    const next = { uid: found?.uid ?? 0, id, tono: found?.tono ?? 0, ...(found?.acabado ? { acabado: found.acabado } : null), ...anchorOf(spec, id) };
    if (found) {
      taken.add(found.uid);
      // Lo que tiene encima se va con él
      if (next.x !== undefined && found.x !== undefined) for (const top of itemsOn(source, found.uid)) carried.set(top.uid, { dx: next.x - found.x, dy: next.y - found.y });
    }
    essentials.push(next);
  }
  // Los uid nuevos, sin repetir ninguno de los que hay o estaban sin sitio
  let uid = Math.max(0, ...source.items.map((i) => i.uid), ...storedBefore.map((i) => i.uid));
  for (const item of essentials) if (!item.uid) item.uid = (uid += 1);

  const order = { alfombra: 0, suelo: 1, encima: 2, pared: 3 };
  const capa = (item) => order[catalogItem(item.id).capa];
  let room = { ...createRoom({ pared: source.pared, suelo: source.suelo }), guard };
  const put = (item) => (room = { ...room, items: [...room.items, item] });
  // Primero lo que sostiene: el ordenador va sobre el escritorio
  [...essentials].sort((a, b) => capa(a) - capa(b)).forEach(put);

  const moved = [];
  const stored = [];
  const place = (item) => {
    if (room.items.length >= ROOM.maxItems) return false;
    if (check(room, item).ok) {
      put(item);
      return true;
    }
    const near = item.pared ? null : { x: item.x + 0.5, y: item.y + 0.5 };
    const spot = findFreeSpot(room, item.id, { rot: item.rot ?? 0, tono: item.tono, near });
    if (!spot) return false;
    put({ ...spot, uid: item.uid, ...(item.acabado ? { acabado: item.acabado } : null) });
    moved.push(item.id);
    return true;
  };
  const rest = source.items
    .filter((i) => !taken.has(i.uid))
    .map((i) => {
      const off = carried.get(i.uid);
      return off ? { ...i, x: i.x + off.dx, y: i.y + off.dy } : i;
    });
  for (const item of [...rest].sort((a, b) => capa(a) - capa(b) || a.uid - b.uid)) if (!place(item)) stored.push(item);
  for (const item of storedBefore) if (!place(item)) stored.push(item);
  return { room, stored, added, moved, changed: fingerprint(room) !== fingerprint(source) };
}
