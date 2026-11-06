// Los cuatro elementos sin los que el piso no funciona como entrada a BookShelf. Siempre hay uno de cada en la habitación, pero
// cada cual los coloca donde quiere: se mueven, se giran y cambian de color como cualquier mueble; lo único que no se puede es
// guardarlos, y delante de ellos tiene que quedar paso. Las reglas viajan con la habitación (`room.guard`, que `room.js` consulta
// si existe), así que el decorador no necesita saber qué es esencial para respetarlo. Puro, sin dibujo ni almacenamiento.
import { ROOM, check, createRoom, findFreeSpot, footprint, itemsOn, rectOf } from '../edificio/room';
import { catalogItem } from '../edificio/catalog';

/** `depth`: las celdas libres que necesita delante, según hacia dónde mire. `exempt`: lo que sí puede estar ahí. */
export const SPECS = {
  estanteria: { nombre: 'Estantería', ids: ['estanteria'], depth: 1 },
  mesa: { nombre: 'Mesa de lectura', ids: ['mesa-baja', 'mesa'], depth: 1, exempt: ['sillon'] },
  escritorio: { nombre: 'Escritorio', ids: ['escritorio'], depth: 1 },
  ordenador: { nombre: 'Ordenador', ids: ['ordenador'], depth: 0 },
  puerta: { nombre: 'Puerta de salida', ids: ['puerta-piso'], depth: 2 },
};

/** Dónde aparecen en cada piso cuando hay que añadirlos: es solo el punto de partida. */
export const LAYOUTS = {
  'lab-1A': {
    estanteria: { x: 0, y: 0, rot: 0 },
    mesa: { x: 2, y: 3, rot: 0 },
    escritorio: { x: 5, y: 0, rot: 0 },
    ordenador: { x: 5, y: 0, rot: 0 },
    puerta: { pared: 'fondo', a: 7 },
  },
  'lab-2B': {
    estanteria: { x: 0, y: 7, rot: 3 },
    mesa: { x: 1, y: 2, rot: 3 },
    escritorio: { x: 3, y: 0, rot: 0 },
    ordenador: { x: 3, y: 0, rot: 0 },
    puerta: { pared: 'izq', a: 5 },
  },
};

const specOf = (id) => Object.values(SPECS).find((spec) => spec.ids.includes(id)) ?? null;

/** Cuál de los ejemplares cuenta como esencial: el más antiguo, y el escritorio, el que tiene el ordenador. */
export function essentialOf(room, spec) {
  const all = room.items.filter((i) => spec.ids.includes(i.id) && i.uid > 0).sort((a, b) => a.uid - b.uid);
  if (spec === SPECS.escritorio) return all.find((desk) => itemsOn(room, desk.uid).some((t) => t.id === 'ordenador')) ?? all[0] ?? null;
  return all[0] ?? null;
}

export const readingTable = (room) => essentialOf(room, SPECS.mesa);
export const mainShelf = (room) => essentialOf(room, SPECS.estanteria);
export const essentialItems = (room) => Object.values(SPECS).map((spec) => essentialOf(room, spec)).filter(Boolean);
export const essentialName = (item) => specOf(item.id)?.nombre ?? catalogItem(item.id).nombre;

/** ¿Lo es? Lo que se está colocando (sin uid) cuenta si no queda otro igual en la habitación. */
export function isEssential(room, item) {
  const spec = specOf(item.id);
  if (!spec) return false;
  if (item.uid > 0) return essentialOf(room, spec)?.uid === item.uid;
  return !room.items.some((i) => spec.ids.includes(i.id));
}

/** Lo que debe quedar libre delante, en celdas: hacia +y sin girar y, con cada giro, un cuarto de vuelta. */
export function zoneOf(item, depth) {
  if (item.pared === 'fondo') return { x0: item.a, y0: 0, x1: item.a + catalogItem(item.id).w, y1: depth };
  if (item.pared === 'izq') return { x0: 0, y0: item.a, x1: depth, y1: item.a + catalogItem(item.id).w };
  const r = rectOf(item);
  if (item.rot === 1) return { x0: r.x0 - depth, y0: r.y0, x1: r.x0, y1: r.y1 };
  if (item.rot === 2) return { x0: r.x0, y0: r.y0 - depth, x1: r.x1, y1: r.y0 };
  if (item.rot === 3) return { x0: r.x1, y0: r.y0, x1: r.x1 + depth, y1: r.y1 };
  return { x0: r.x0, y0: r.y1, x1: r.x1, y1: r.y1 + depth };
}

const overlap = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const inRoom = (z) => z.x0 >= 0 && z.y0 >= 0 && z.x1 <= ROOM.w && z.y1 <= ROOM.d;
const isFloor = (item) => catalogItem(item.id)?.capa === 'suelo';

export const guard = {
  // Las reglas viajan con la habitación, pero no se guardan con ella
  toJSON: () => undefined,
  essential: isEssential,
  /** Es el último de su clase: se puede llevar a otro sitio, pero no guardar. */
  keeps(room, item) {
    const spec = specOf(item.id);
    return Boolean(spec) && room.items.filter((i) => spec.ids.includes(i.id)).length === 1;
  },
  /** El escritorio gira con el ordenador encima. */
  turnsWithTops: (tops) => tops.every((t) => t.id === 'ordenador'),
  check(room, item, support) {
    const capa = catalogItem(item.id)?.capa;
    if (capa === 'encima') {
      const base = room.items.find((i) => i.uid === support);
      if (item.id === 'ordenador') return base?.id === 'escritorio' ? null : { ok: false, reason: 'escritorio' };
      return base && base.uid === readingTable(room)?.uid ? { ok: false, reason: 'reservado' } : null;
    }
    if (capa === 'alfombra') return null;
    const others = room.items.filter((i) => i.uid !== item.uid);
    // Lo que se coloca no puede quitar el paso a otro esencial…
    if (capa === 'suelo') {
      for (const spec of Object.values(SPECS)) {
        if (!spec.depth || spec.exempt?.includes(item.id)) continue;
        const owner = essentialOf({ ...room, items: others }, spec);
        if (owner && overlap(rectOf(item), zoneOf(owner, spec.depth))) return { ok: false, reason: 'zona', con: owner.id };
      }
    }
    // …y un esencial necesita paso allí donde se ponga
    const spec = specOf(item.id);
    if (spec?.depth && isEssential({ ...room, items: item.uid > 0 ? [...others, item] : others }, item)) {
      const zone = zoneOf(item, spec.depth);
      if (!inRoom(zone)) return { ok: false, reason: 'zona', con: item.id };
      const hit = others.find((o) => isFloor(o) && !spec.exempt?.includes(o.id) && overlap(rectOf(o), zone));
      if (hit) return { ok: false, reason: 'zona', con: item.id };
    }
    return null;
  },
};

export const withGuard = (room) => ({ ...room, guard });

/** El mismo contenido, sin importar el orden en que esté guardado ni el de sus campos. */
const fingerprint = (room) => JSON.stringify([...room.items].sort((a, b) => a.uid - b.uid).map((i) => [i.uid, i.id, i.tono, i.x, i.y, i.rot, i.pared, i.a, i.acabado]));

const nearOf = (item) => (item.pared ? null : { x: item.x + 0.5, y: item.y + 0.5 });
const keepFinish = (item) => (item.acabado ? { acabado: item.acabado } : null);

/**
 * Añade lo que falte y deja paso, respetando la distribución de cada cual: un esencial que ya está no se mueve si no molesta. Lo
 * que estorba va al sitio libre más cercano y lo que no cabe se devuelve en `stored`, para intentarlo la próxima vez.
 * Devuelve { room, stored, added, moved, changed }, donde `added` son los esenciales nuevos.
 */
export function repairRoom(source, layout, storedBefore = []) {
  const base = { ...source, guard };
  const added = [];
  const moved = [];
  let uid = Math.max(0, ...source.items.map((i) => i.uid), ...storedBefore.map((i) => i.uid));
  const nextUid = () => (uid += 1);
  const present = new Map(Object.entries(SPECS).map(([key, spec]) => [key, essentialOf(base, spec)]));

  // Lo que falta, primero donde no moleste a lo que ya hay
  let draft = base;
  const planned = new Map();
  for (const [key, spec] of Object.entries(SPECS)) {
    if (present.get(key)) continue;
    added.push(spec.nombre);
    if (key === 'ordenador') continue;
    const anchor = { ...layout[key], id: spec.ids[0], tono: 0, uid: -1 };
    let item = anchor;
    if (!check(draft, anchor).ok) item = findFreeSpot(draft, spec.ids[0], { rot: anchor.rot ?? 0, near: nearOf(anchor) }) ?? anchor;
    item = { ...item, uid: nextUid() };
    planned.set(key, item);
    draft = { ...draft, items: [...draft.items, item] };
  }

  // Se monta de nuevo: primero los esenciales y después todo lo demás, comprobando cada cosa
  let room = { ...createRoom({ pared: source.pared, suelo: source.suelo }), guard };
  const put = (item) => (room = { ...room, items: [...room.items, item] });
  const taken = new Set();
  for (const key of ['estanteria', 'mesa', 'escritorio', 'puerta']) {
    const own = present.get(key);
    const item = own ?? planned.get(key);
    if (own) taken.add(own.uid);
    if (check(room, item).ok) {
      put(item);
      continue;
    }
    // Choca con otro esencial: se le busca sitio, y solo si no lo hay se queda donde estaba
    const spot = findFreeSpot(room, item.id, { rot: item.rot ?? 0, tono: item.tono, near: nearOf(item) });
    put(spot ? { ...spot, uid: item.uid, ...keepFinish(item) } : item);
    if (own && spot) moved.push(item.id);
  }

  // El ordenador, sobre el escritorio: donde estaba si sigue encima y, si no, en el primer hueco
  const pc = present.get('ordenador');
  if (pc) taken.add(pc.uid);
  const desk = room.items.find((i) => i.id === 'escritorio');
  const { w, d } = footprint(catalogItem('escritorio'), desk.rot);
  const cells = [];
  for (let y = 0; y < d; y += 1) for (let x = 0; x < w; x += 1) cells.push({ x: desk.x + x, y: desk.y + y });
  const wanted = pc && check(room, pc).ok ? pc : null;
  // La decoración que ya está encima tiene preferencia sobre un ordenador nuevo
  const tops = source.items.filter((i) => catalogItem(i.id)?.capa === 'encima' && i.id !== 'ordenador');
  const free = cells.find((c) => !tops.some((t) => t.x === c.x && t.y === c.y)) ?? cells[0];
  put(wanted ?? { uid: pc?.uid ?? nextUid(), id: 'ordenador', tono: pc?.tono ?? 0, ...free, rot: desk.rot, ...(pc ? keepFinish(pc) : null) });

  const stored = [];
  const place = (item) => {
    if (room.items.length >= ROOM.maxItems) return false;
    if (check(room, item).ok) {
      put(item);
      return true;
    }
    const spot = findFreeSpot(room, item.id, { rot: item.rot ?? 0, tono: item.tono, near: nearOf(item) });
    if (!spot) return false;
    put({ ...spot, uid: item.uid, ...keepFinish(item) });
    moved.push(item.id);
    return true;
  };
  const order = { alfombra: 0, suelo: 1, encima: 2, pared: 3 };
  const capa = (item) => order[catalogItem(item.id).capa];
  const rest = source.items.filter((i) => !taken.has(i.uid));
  for (const item of [...rest].sort((a, b) => capa(a) - capa(b) || a.uid - b.uid)) if (!place(item)) stored.push(item);
  for (const item of storedBefore) if (!place(item)) stored.push(item);
  return { room, stored, added, moved, changed: fingerprint(room) !== fingerprint(source) };
}
