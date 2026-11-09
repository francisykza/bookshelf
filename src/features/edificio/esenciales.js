// Los esenciales de un piso (1.89, SPEC §89): ordenador, estantería y sillón son muebles normales del catálogo y del layout;
// aquí solo se dice qué mueble hace de cada cosa. El ordenador es un conjunto explícito: todo escritorio lleva uno encima,
// que se deduce al dibujar y nunca se guarda (el servidor no lo admite como mueble). Un piso antiguo al que le falta alguno no
// se toca ni se bloquea: se indica en la pestaña y se coloca si se quiere.
import '../pisoLab/essentialItems';
import { acabadosDe, freeCopies, plainCopies } from './inventory';
import { catalogItem } from './catalog';
import { check, findFreeSpot, footprint, itemsOn, moveItem, rectOf } from './room';
import { readingTable } from '../pisoLab/essentials';
import { isRetirado } from './retirados';

export const ESENCIALES_TAB = 'esenciales';
export const ROLES = [
  { id: 'ordenador', nombre: 'Ordenador', base: 'escritorio', modelos: ['escritorio'], falta: 'Un escritorio con su ordenador: tu diario y las demás apps.' },
  { id: 'estanteria', nombre: 'Estantería', base: 'estanteria', modelos: ['estanteria'], falta: 'Tus libros a la vista y toda la biblioteca.' },
  { id: 'sillon', nombre: 'Sillón', base: 'sillon', modelos: ['sillon', 'sofa', 'mecedora'], falta: 'Desde aquí lees y miras la habitación.' },
];
// El tablón no es un esencial del piso, pero tampoco se compra: siempre hay una copia para colocarlo si se quiere
export const BASICOS = ROLES.map((r) => r.base);
export const rolDe = (id) => ROLES.find((r) => r.modelos.includes(id)) ?? null;
export const itemsDeRol = (room, rol) => room.items.filter((i) => rol.modelos.includes(i.id)).sort((a, b) => rol.modelos.indexOf(a.id) - rol.modelos.indexOf(b.id) || a.uid - b.uid);
export const faltan = (room) => ROLES.filter((r) => !itemsDeRol(room, r).length);

/** Dónde se sienta la cámara: el sillón y, si se ha sustituido, lo que haga de sillón. */
export const asientoDe = (room) => itemsDeRol(room, ROLES[2])[0] ?? null;

/** Los modelos básicos no se compran: siempre tienes al menos una copia lisa (como `piso_falta_copia`). */
export function conBasicos(inv) {
  if (!inv) return inv;
  const copias = { ...inv.copias };
  for (const id of BASICOS) {
    const conAcabado = Object.values(acabadosDe(inv, id)).reduce((a, b) => a + b, 0);
    copias[id] = Math.max(copias[id] ?? 0, conAcabado + 1);
  }
  return { ...inv, copias };
}

/** El ordenador que le toca a este piso: sobre el primer escritorio con una celda libre, con el uid del escritorio. */
export function ordenadorDe(room) {
  if (room.items.some((i) => i.id === 'ordenador')) return null;
  for (const desk of room.items.filter((i) => i.id === 'escritorio').sort((a, b) => a.uid - b.uid)) {
    const r = rectOf(desk);
    for (let y = r.y0; y < r.y1; y += 1) {
      for (let x = r.x0; x < r.x1; x += 1) {
        const pc = { uid: -1, id: 'ordenador', x, y, rot: desk.rot ?? 0, tono: 0 };
        if (check({ ...room, guard: undefined }, pc).ok) return { ...pc, uid: desk.uid };
      }
    }
  }
  return null;
}

const tocaCelda = (r, c) => r.x0 < c.x + 1 && c.x < r.x1 && r.y0 < c.y + 1 && c.y < r.y1;

/**
 * 1.89.3: la celda de la mesa que es del libro de lectura: la más cercana al asiento (si empatan, la primera). `invasores`: lo que
 * un piso antiguo tiene ya encima de ella; `libres`: las celdas de la mesa sin nada. Se deduce siempre: no se guarda.
 */
export function zonaLibro(room) {
  const mesa = readingTable(room) ?? room.items.find((i) => i.id === 'mesilla') ?? null;
  if (!mesa) return null;
  const r = rectOf(mesa);
  const celdas = [];
  for (let y = r.y0; y < r.y1; y += 1) for (let x = r.x0; x < r.x1; x += 1) celdas.push({ x, y });
  const asiento = asientoDe(room);
  const s = asiento ? rectOf(asiento) : null;
  const dist = (c) => (s ? Math.hypot(c.x + 0.5 - (s.x0 + s.x1) / 2, c.y + 0.5 - (s.y0 + s.y1) / 2) : 0);
  const celda = celdas.reduce((best, c) => (dist(c) < dist(best) - 1e-6 ? c : best));
  const encima = itemsOn(room, mesa.uid).map(rectOf);
  const objetos = itemsOn(room, mesa.uid);
  return { mesa, celda, invasores: objetos.filter((t) => tocaCelda(rectOf(t), celda)), libres: celdas.filter((c) => !encima.some((t) => tocaCelda(t, c))) };
}

/** Dónde se dibuja el libro: su celda; con ella ocupada en un piso antiguo, otra libre de la mesa; si no hay, la suya. */
export function sitioDelLibro(room) {
  const zona = zonaLibro(room);
  if (!zona) return null;
  return zona.invasores.length ? (zona.libres[0] ?? zona.celda) : zona.celda;
}

/** El sitio válido más cercano para un objeto que quería ir a la celda del libro. */
export function sitioValido(room, item) {
  const sin = { ...room, items: room.items.filter((i) => i.uid !== item.uid) };
  const zona = zonaLibro(sin);
  const near = zona ? { x: zona.celda.x + 0.5, y: zona.celda.y + 0.5 } : { x: item.x + 0.5, y: item.y + 0.5 };
  const spot = findFreeSpot(sin, item.id, { rot: item.rot ?? 0, tono: item.tono, near });
  return spot ? { x: spot.x, y: spot.y } : null;
}

/** Solo si lo pide quien decora: aparta de la celda del libro lo que la ocupa, sin quitar nada del piso. O todo, o nada. */
export function dejarSitioAlLibro(room) {
  let next = room;
  const movidos = [];
  for (const item of zonaLibro(room)?.invasores ?? []) {
    const spot = sitioValido(next, item);
    if (!spot) return { error: 'sitio' };
    const res = moveItem(next, item.uid, spot);
    if (res.error) return { error: res.error };
    next = res.room;
    movidos.push(item);
  }
  return { room: next, movidos };
}

/** Las reglas de los esenciales en el decorador: no se guarda el último de cada tipo; lo demás, como cualquier mueble. */
export const GUARDIA = {
  toJSON: () => undefined,
  essential: (room, item) => Boolean(rolDe(item.id)),
  keeps: (room, item) => {
    const rol = rolDe(item.id);
    return Boolean(rol) && itemsDeRol(room, rol).length <= 1;
  },
  turnsWithTops: (tops, item) => Boolean(item && rolDe(item.id)) && tops.every((t) => catalogItem(t.id).w === 1 && catalogItem(t.id).d === 1),
  // 1.89.3: nada puede ponerse en la celda del libro de lectura
  check: (room, item, support) => {
    if (support == null || catalogItem(item.id)?.capa !== 'encima') return null;
    const zona = zonaLibro(room);
    return zona && zona.mesa.uid === support && tocaCelda(rectOf(item), zona.celda) ? { ok: false, reason: 'libro' } : null;
  },
};

/** Con qué se puede sustituir un esencial: otros modelos, otros colores si solo hay un modelo, y tus acabados libres. */
export function opcionesDe(inv, room, rol, item) {
  const sin = { ...room, items: room.items.filter((i) => i.uid !== item.uid) };
  const out = [];
  for (const id of rol.modelos) {
    // Lo retirado no se ofrece (reestructuración de muebles, 9-11-2026): no se dibujaría
    if (isRetirado(id)) continue;
    const cat = catalogItem(id);
    if (plainCopies(inv, id) > 0 && freeCopies(inv, sin, id) > 0) {
      if (rol.modelos.length === 1) {
        cat.tonos.forEach((_, tono) => {
          if (tono !== item.tono || item.acabado) out.push({ id, tono, acabado: null });
        });
      } else if (id !== item.id || item.acabado) out.push({ id, tono: Math.min(item.tono, cat.tonos.length - 1), acabado: null });
    }
    for (const acabado of Object.keys(acabadosDe(inv, id))) {
      if ((id !== item.id || acabado !== item.acabado) && freeCopies(inv, sin, id, acabado) > 0) out.push({ id, tono: Math.min(item.tono, cat.tonos.length - 1), acabado });
    }
  }
  return out;
}

/** Cambia un esencial por otro modelo en su sitio; si no cabe, en lo más cerca libre. Conserva uid, giro y lo que tiene encima. */
export function sustituir(room, uid, { id, tono = 0, acabado = null }) {
  const item = room.items.find((i) => i.uid === uid);
  const cat = catalogItem(id);
  if (!item || !cat || !rolDe(id) || rolDe(id) !== rolDe(item.id)) return { error: 'desconocido' };
  const tops = itemsOn(room, uid);
  const next = { uid, id, x: item.x, y: item.y, rot: item.rot, tono, ...(acabado ? { acabado } : null) };
  const swap = (placed) => ({ room: { ...room, items: room.items.map((i) => (i.uid === uid ? placed : i)) }, item: placed });
  if (tops.length) {
    const r = rectOf(next);
    const siguen = cat.sup && tops.every((t) => t.x >= r.x0 && t.x + 1 <= r.x1 && t.y >= r.y0 && t.y + 1 <= r.y1);
    if (!siguen) return { error: 'encima' };
  }
  const res = check(room, next, { ignore: tops.map((t) => t.uid) });
  if (res.ok) return swap(next);
  if (tops.length || (res.reason !== 'choque' && res.reason !== 'fuera')) return { error: res.reason, con: res.con };
  const sin = { ...room, items: room.items.filter((i) => i.uid !== uid) };
  const f = footprint(cat, item.rot);
  const spot = findFreeSpot(sin, id, { rot: item.rot, tono, near: { x: item.x + f.w / 2, y: item.y + f.d / 2 } });
  if (!spot || Math.hypot(spot.x - item.x, spot.y - item.y) > 2.5) return { error: 'sitio' };
  return swap({ ...next, x: spot.x, y: spot.y });
}
