// Reglas del piso de «El edificio del puerto» (1.63, SPEC §63). Funciones puras, sin dibujo ni DOM: el piso siempre es
// válido (cada cambio se comprueba antes de aplicarse) y `validateRoom` hace lo mismo que el servidor (`piso_valido`,
// comparados en edificio.rls.test.js) antes de guardar un piso o enseñarlo: solo muebles del catálogo, dentro de la
// cuadrícula y sin solapes.
import { acabadoOf, admiteAcabado } from './acabados';
import { CATALOG, PAREDES, SUELOS, catalogItem } from './catalog';

/** Medidas del piso en celdas; `wallH`: altura de las paredes (en celdas); `maxItems`: cosas como mucho. */
export const ROOM = { w: 9, d: 9, wallH: 4.2, maxItems: 40 };
export const ROOM_VERSION = 1;
const ORDER = { alfombra: 0, suelo: 1, encima: 2, pared: 3 };

export function createRoom(extra = {}) {
  return { v: ROOM_VERSION, pared: 'yeso', suelo: 'tablas', items: [], ...extra };
}

/** Medidas en el suelo según el giro (0..3): girado un cuarto, el ancho y el fondo se cambian. */
export function footprint(cat, rot = 0) {
  return rot % 2 ? { w: cat.d, d: cat.w } : { w: cat.w, d: cat.d };
}

export const wallLength = (pared) => (pared === 'fondo' ? ROOM.w : ROOM.d);

export function rectOf(item) {
  const cat = catalogItem(item.id);
  const f = footprint(cat, item.rot);
  return { x0: item.x, y0: item.y, x1: item.x + f.w, y1: item.y + f.d };
}

const overlap = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const inside = (a, b) => a.x0 >= b.x0 && a.x1 <= b.x1 && a.y0 >= b.y0 && a.y1 <= b.y1;
const capaOf = (item) => catalogItem(item.id)?.capa;

/**
 * ¿Puede ir `item` donde dice? Devuelve `{ ok: true, support }` (el mueble que lo sostiene, si va encima) o
 * `{ ok: false, reason, con }` (`con`: el id del catálogo con el que choca). `ignore`: uids que no cuentan.
 */
export function check(room, item, { ignore = [] } = {}) {
  const cat = catalogItem(item.id);
  if (!cat || !Number.isInteger(item.tono) || item.tono < 0 || item.tono >= cat.tonos.length) return { ok: false, reason: 'desconocido' };
  if (item.acabado && !(acabadoOf(item.acabado) && admiteAcabado(cat))) return { ok: false, reason: 'desconocido' };
  const others = room.items.filter((i) => i.uid !== item.uid && !ignore.includes(i.uid));
  if (cat.capa === 'pared') {
    if (!['fondo', 'izq'].includes(item.pared) || !Number.isInteger(item.a)) return { ok: false, reason: 'fuera' };
    if (item.a < 0 || item.a + cat.w > wallLength(item.pared)) return { ok: false, reason: 'fuera' };
    const hit = others.find((o) => o.pared === item.pared && capaOf(o) === 'pared' && item.a < o.a + catalogItem(o.id).w && o.a < item.a + cat.w);
    if (hit) return { ok: false, reason: 'choque', con: hit.id };
    return room.guard?.check(room, item, null) ?? { ok: true };
  }
  if (![item.x, item.y, item.rot].every(Number.isInteger) || item.rot < 0 || item.rot > 3) return { ok: false, reason: 'fuera' };
  const r = rectOf(item);
  if (r.x0 < 0 || r.y0 < 0 || r.x1 > ROOM.w || r.y1 > ROOM.d) return { ok: false, reason: 'fuera' };
  let support = null;
  if (cat.capa === 'encima') {
    support = others.find((o) => capaOf(o) === 'suelo' && catalogItem(o.id).sup && inside(r, rectOf(o)));
    if (!support) return { ok: false, reason: 'apoyo' };
  }
  const hit = others.find((o) => capaOf(o) === cat.capa && overlap(r, rectOf(o)));
  if (hit) return { ok: false, reason: 'choque', con: hit.id };
  // Una habitación puede traer reglas propias (`guard`): el piloto del piso protege así sus elementos esenciales
  const veto = room.guard?.check(room, item, support?.uid ?? null);
  if (veto) return veto;
  return { ok: true, support: support?.uid ?? null };
}

/** Lo que hay encima de un mueble (lámparas, plantas, libros…). */
export function itemsOn(room, uid) {
  const base = room.items.find((i) => i.uid === uid);
  if (!base || capaOf(base) !== 'suelo' || !catalogItem(base.id).sup) return [];
  const r = rectOf(base);
  return room.items.filter((i) => capaOf(i) === 'encima' && inside(rectOf(i), r));
}

/** Altura a la que se apoya una cosa de la capa «encima» (0 si no tiene mueble debajo). */
export function heightOf(room, item) {
  if (capaOf(item) !== 'encima') return 0;
  const r = rectOf(item);
  const base = room.items.find((o) => o.uid !== item.uid && capaOf(o) === 'suelo' && catalogItem(o.id).sup && inside(r, rectOf(o)));
  return base ? catalogItem(base.id).sup : 0;
}

const nextUid = (room) => room.items.reduce((n, i) => Math.max(n, i.uid), 0) + 1;
const replace = (room, changed) => ({ ...room, items: room.items.map((i) => changed.find((c) => c.uid === i.uid) ?? i) });

/** Primer sitio libre para algo nuevo, lo más cerca posible de `near` (por defecto, el centro del piso). */
export function findFreeSpot(room, id, { rot = 0, tono = 0, near = null } = {}) {
  const cat = catalogItem(id);
  if (!cat) return null;
  const uid = -1;
  if (cat.capa === 'pared') {
    for (const pared of ['fondo', 'izq']) {
      const centre = Math.floor((wallLength(pared) - cat.w) / 2);
      const order = [...Array(wallLength(pared) - cat.w + 1).keys()].sort((a, b) => Math.abs(a - centre) - Math.abs(b - centre));
      for (const a of order) {
        const item = { uid, id, pared, a, tono };
        if (check(room, item).ok) return item;
      }
    }
    return null;
  }
  const f = footprint(cat, rot);
  const cx = near?.x ?? ROOM.w / 2;
  const cy = near?.y ?? ROOM.d / 2;
  const spots = [];
  for (let y = 0; y + f.d <= ROOM.d; y += 1) for (let x = 0; x + f.w <= ROOM.w; x += 1) spots.push({ x, y, dist: Math.hypot(x + f.w / 2 - cx, y + f.d / 2 - cy) });
  spots.sort((a, b) => a.dist - b.dist || a.y - b.y || a.x - b.x);
  for (const s of spots) {
    const item = { uid, id, x: s.x, y: s.y, rot, tono };
    if (check(room, item).ok) return item;
  }
  return null;
}

/** Añade algo del catálogo en el primer sitio libre. Devuelve `{ room, item }` o `{ error }`. */
export function addItem(room, id, opts = {}) {
  if (!catalogItem(id)) return { error: 'desconocido' };
  if (room.items.length >= ROOM.maxItems) return { error: 'lleno' };
  const spot = findFreeSpot(room, id, opts);
  if (!spot) return { error: 'sitio' };
  const item = { ...spot, uid: nextUid(room), ...(opts.acabado ? { acabado: opts.acabado } : null) };
  return { room: { ...room, items: [...room.items, item] }, item };
}

/**
 * Mueve un objeto a `target` ({ x, y } en el suelo o { pared, a } en la pared). Lo que tiene encima se mueve con él.
 * Devuelve `{ room }` o `{ error, con }`.
 */
export function moveItem(room, uid, target) {
  const item = room.items.find((i) => i.uid === uid);
  if (!item) return { error: 'desconocido' };
  const tops = itemsOn(room, uid);
  const moved = { ...item, ...target };
  const res = check(room, moved, { ignore: tops.map((t) => t.uid) });
  if (!res.ok) return { error: res.reason, con: res.con };
  const dx = (moved.x ?? 0) - (item.x ?? 0);
  const dy = (moved.y ?? 0) - (item.y ?? 0);
  return { room: replace(room, [moved, ...tops.map((t) => ({ ...t, x: t.x + dx, y: t.y + dy }))]) };
}

/** Gira un cuarto de vuelta. Si girado no cabe donde está, busca el sitio libre más cercano. */
export function rotateItem(room, uid) {
  const item = room.items.find((i) => i.uid === uid);
  if (!item) return { error: 'desconocido' };
  if (capaOf(item) === 'pared') return { error: 'pared' };
  const tops = itemsOn(room, uid);
  if (tops.length && !room.guard?.turnsWithTops(tops)) return { error: 'encima' };
  const turned = { ...item, rot: (item.rot + 1) % 4 };
  // Lo que va encima gira con él, en su misma celda del mueble (solo piezas de una celda)
  const depth = footprint(catalogItem(item.id), item.rot).d;
  const carried = (at) => tops.map((t) => ({ ...t, x: at.x + depth - 1 - (t.y - item.y), y: at.y + (t.x - item.x), rot: (t.rot + 1) % 4 }));
  const ignore = tops.map((t) => t.uid);
  if (check(room, turned, { ignore }).ok) return { room: replace(room, [turned, ...carried(turned)]) };
  const r = rectOf(item);
  const spot = findFreeSpot({ ...room, items: room.items.filter((i) => i.uid !== uid && !ignore.includes(i.uid)) }, item.id, { rot: turned.rot, tono: item.tono, near: { x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 } });
  if (!spot || Math.hypot(spot.x - item.x, spot.y - item.y) > 3) return { error: 'gira' };
  const placed = { ...turned, x: spot.x, y: spot.y };
  return { room: replace(room, [placed, ...carried(placed)]) };
}

export function recolorItem(room, uid) {
  const item = room.items.find((i) => i.uid === uid);
  if (!item) return { error: 'desconocido' };
  return { room: replace(room, [{ ...item, tono: (item.tono + 1) % catalogItem(item.id).tonos.length }]) };
}

/** Guarda un objeto (lo quita del piso). Un mueble con cosas encima no se puede guardar. */
export function removeItem(room, uid) {
  const item = room.items.find((i) => i.uid === uid);
  if (!item) return { error: 'desconocido' };
  if (room.guard?.keeps(room, item)) return { error: 'esencial' };
  if (itemsOn(room, uid).length) return { error: 'encima' };
  return { room: { ...room, items: room.items.filter((i) => i.uid !== uid) } };
}

export function setWall(room, pared) {
  return PAREDES.some((p) => p.id === pared) ? { ...room, pared } : room;
}

export function setFloor(room, suelo) {
  return SUELOS.some((s) => s.id === suelo) ? { ...room, suelo } : room;
}

/**
 * Comprueba un piso que llega de fuera (guardado, de otro dispositivo o de un vecino) y devuelve una copia limpia, o
 * null si algo no vale. Es la misma comprobación que tendría que hacer el servidor antes de aceptarlo.
 */
export function validateRoom(data) {
  if (!data || typeof data !== 'object' || data.v !== ROOM_VERSION) return null;
  if (!PAREDES.some((p) => p.id === data.pared) || !SUELOS.some((s) => s.id === data.suelo)) return null;
  if (!Array.isArray(data.items) || data.items.length > ROOM.maxItems) return null;
  const seen = new Set();
  const clean = [];
  for (const raw of data.items) {
    if (!raw || typeof raw !== 'object' || !Number.isInteger(raw.uid) || raw.uid < 1 || seen.has(raw.uid)) return null;
    seen.add(raw.uid);
    const cat = catalogItem(raw.id);
    if (!cat) return null;
    const piel = raw.acabado ? { acabado: raw.acabado } : null;
    clean.push(cat.capa === 'pared' ? { uid: raw.uid, id: raw.id, pared: raw.pared, a: raw.a, tono: raw.tono, ...piel } : { uid: raw.uid, id: raw.id, x: raw.x, y: raw.y, rot: raw.rot, tono: raw.tono, ...piel });
  }
  // Se colocan por capas (primero lo que sostiene, luego lo de encima) y cada uno se comprueba con los anteriores
  clean.sort((a, b) => ORDER[capaOf(a)] - ORDER[capaOf(b)] || a.uid - b.uid);
  let room = createRoom({ pared: data.pared, suelo: data.suelo });
  for (const item of clean) {
    if (!check(room, item).ok) return null;
    room = { ...room, items: [...room.items, item] };
  }
  return room;
}

export const exportRoom = (room) => JSON.stringify(room);

export function importRoom(text) {
  try {
    return validateRoom(JSON.parse(text));
  } catch {
    return null;
  }
}

/** Texto para cada motivo de rechazo (en la interfaz y en el lector de pantalla). */
export function reasonText(reason, con = null) {
  const name = con ? catalogItem(con)?.nombre.toLowerCase() : null;
  switch (reason) {
    case 'fuera':
      return 'Ahí no cabe.';
    case 'choque':
      return name ? `Choca con: ${name}.` : 'Ahí ya hay algo.';
    case 'apoyo':
      return 'Va encima de una mesa, una mesilla, un banco o una estantería.';
    case 'encima':
      return 'Primero quita lo que tiene encima.';
    case 'lleno':
      return `Tu piso ya tiene ${ROOM.maxItems} cosas: guarda alguna antes.`;
    case 'sitio':
      return 'No queda sitio libre para eso.';
    case 'gira':
      return 'Girado no cabe aquí.';
    case 'pared':
      return 'Lo que va en la pared no se gira.';
    case 'esencial':
      return 'Es un elemento esencial: no se puede guardar. Puedes moverlo o cambiarle el color.';
    case 'escritorio':
      return 'El ordenador va sobre el escritorio.';
    case 'zona':
      return name ? `Ahí hay que dejar paso hasta: ${name}.` : 'Ahí hay que dejar paso.';
    case 'reservado':
      return 'Esa mesa está reservada para tu lectura.';
    default:
      return 'Eso no se puede hacer.';
  }
}

export const CATALOG_IDS = CATALOG.map((c) => c.id);
