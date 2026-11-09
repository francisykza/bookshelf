// Tablón libre: reglas puras del lienzo. Las coordenadas son del lienzo, independientes del dispositivo:
// pantalla = origenViewport + (puntoLienzo − pan) × zoom.
export const PAPERS = { crema: '#F7EDD5', salvia: '#BFCBA3', azul: '#B7CFD8', melocoton: '#DFB399' };
export const PAPER_NAMES = { crema: 'Crema', salvia: 'Salvia', azul: 'Azul', melocoton: 'Melocotón' };
export const INK = '#382B22';
export const PINS = { laton: 'Latón', plata: 'Plata', terracota: 'Terracota' };
export const PIN_COLORS = { laton: '#C69845', plata: '#B9BDBE', terracota: '#A8553A' };
export const STICKERS = { estrella: 'Estrella', hoja: 'Hoja', libro: 'Libro' };
export const THREADS = { terracota: '#B23A2A', laton: '#C69845', salvia: '#6F8A5C', azul: '#2E6A86' };
export const THREAD_NAMES = { terracota: 'Terracota', laton: 'Latón', salvia: 'Salvia', azul: 'Azul' };
export const BASE = { x: 0, y: 0, w: 1600, h: 1000 };
export const MAX_NOTE = 200;
export const MAX_LABEL = 40;
export const MAX_TITLE = 60;
export const SLOP = 8;
export const ZOOM = [0.2, 2.5];
export const SIZE = { minW: 80, maxW: 900, minH: 60, maxH: 900 };

export const uid = () => crypto.randomUUID();
const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 9973, 7);
/** Qué objeto es cada tarjeta: las notas propias varían, siempre igual para una misma nota. */
export const formatOf = (item) => ({ book: 'libro', quote: 'cita', received: 'correo' })[item.kind] ?? ['adhesiva', 'rayada', 'ficha'][hash(item.id) % 3];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const clampZoom = (z) => clamp(z, ZOOM[0], ZOOM[1]);
export const normalizeAngle = (a) => {
  const n = ((a + 180) % 360 + 360) % 360 - 180;
  return Math.round(n * 10) / 10;
};

export const emptyDoc = () => ({ items: [], edges: [] });

/** Un punto del lienzo en coordenadas del viewport. */
export const toScreen = (view, p) => ({ x: (p.x - view.x) * view.zoom, y: (p.y - view.y) * view.zoom });
/** Un punto del viewport en coordenadas del lienzo. */
export const toWorld = (view, p) => ({ x: p.x / view.zoom + view.x, y: p.y / view.zoom + view.y });
/** Cambia el zoom dejando quieto el punto del viewport `p`. */
export function zoomAt(view, p, zoom) {
  const next = clampZoom(zoom);
  const w = toWorld(view, p);
  return { zoom: next, x: w.x - p.x / next, y: w.y - p.y / next };
}

const rotate = (x, y, deg) => {
  const r = (deg * Math.PI) / 180;
  return { x: x * Math.cos(r) - y * Math.sin(r), y: x * Math.sin(r) + y * Math.cos(r) };
};
export const centerOf = (i) => ({ x: i.x + i.width / 2, y: i.y + i.height / 2 });
/** Dónde está un ancla de la tarjeta, teniendo en cuenta su giro: la chincheta va arriba, centrada. */
export function anchorOf(item, anchor = 'pin') {
  const c = centerOf(item);
  const local = { pin: [0, -item.height / 2], top: [0, -item.height / 2], bottom: [0, item.height / 2], left: [-item.width / 2, 0], right: [item.width / 2, 0] }[anchor] ?? [0, -item.height / 2];
  const p = rotate(local[0], local[1], item.rotation);
  return { x: c.x + p.x, y: c.y + p.y };
}

/** Cambia el tamaño dejando quieta la esquina superior izquierda, aunque la tarjeta esté girada. */
export function resized(item, width, height) {
  const w = clamp(width, SIZE.minW, SIZE.maxW);
  const h = clamp(height, SIZE.minH, SIZE.maxH);
  const corner = rotate(-item.width / 2, -item.height / 2, item.rotation);
  const fixed = { x: centerOf(item).x + corner.x, y: centerOf(item).y + corner.y };
  const nextCorner = rotate(-w / 2, -h / 2, item.rotation);
  return { width: w, height: h, x: fixed.x - nextCorner.x - w / 2, y: fixed.y - nextCorner.y - h / 2 };
}

/** En ejes de la tarjeta, cuánto mide un desplazamiento en el lienzo. */
export const localDelta = (item, dx, dy) => rotate(dx, dy, -item.rotation);

export function boundsOf(items) {
  if (!items.length) return { ...BASE };
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const i of items) {
    const c = centerOf(i);
    const r = Math.hypot(i.width, i.height) / 2;
    x0 = Math.min(x0, c.x - r);
    y0 = Math.min(y0, c.y - r);
    x1 = Math.max(x1, c.x + r);
    y1 = Math.max(y1, c.y + r);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** La vista que enseña todo con un margen. */
export function fitView(items, width, height, margin = 28) {
  const b = boundsOf(items);
  const zoom = clampZoom(Math.min((width - margin * 2) / Math.max(b.w, 1), (height - margin * 2) / Math.max(b.h, 1)));
  return { zoom, x: b.x + b.w / 2 - width / zoom / 2, y: b.y + b.h / 2 - height / zoom / 2 };
}

/** Las tarjetas cerca de lo visible; las demás no se montan. */
export function nearView(items, view, width, height, keep) {
  const m = 320;
  const x0 = view.x - m;
  const y0 = view.y - m;
  const x1 = view.x + width / view.zoom + m;
  const y1 = view.y + height / view.zoom + m;
  return items.filter((i) => {
    if (i.id === keep) return true;
    const c = centerOf(i);
    const r = Math.hypot(i.width, i.height) / 2;
    return c.x + r >= x0 && c.x - r <= x1 && c.y + r >= y0 && c.y - r <= y1;
  });
}

export const topZ = (items) => items.reduce((m, i) => Math.max(m, i.z), 0) + 1;
export const bottomZ = (items) => items.reduce((m, i) => Math.min(m, i.z), 0) - 1;
export const sortedItems = (items) => [...items].sort((a, b) => a.z - b.z);

export function newItem(kind, at, items, extra = {}) {
  const size = kind === 'book' ? { width: 190, height: 250 } : { width: 240, height: 180 };
  // Un poco desordenado para que parezca clavado a mano, siempre igual para un mismo número de tarjetas
  const rotation = [-3, 2, -1.5, 3, 0, -2][items.length % 6];
  return { id: uid(), kind, body: '', caption: null, cover: null, source_ref: null, x: at.x - size.width / 2, y: at.y - size.height / 2, ...size, rotation, z: topZ(items), paper: 'crema', pin: 'laton', sticker: null, spoiler: false, received_note_id: null, ...extra };
}

/** Quita una tarjeta y, a la vez, las conexiones que llegan a ella. */
export const removeItem = (doc, id) => ({ items: doc.items.filter((i) => i.id !== id), edges: doc.edges.filter((e) => e.source_item_id !== id && e.target_item_id !== id) });
export const patchItem = (doc, id, patch) => ({ ...doc, items: doc.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) });
export const patchEdge = (doc, id, patch) => ({ ...doc, edges: doc.edges.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
export const removeEdge = (doc, id) => ({ ...doc, edges: doc.edges.filter((e) => e.id !== id) });
export function addEdge(doc, source, target) {
  if (source === target || doc.edges.some((e) => (e.source_item_id === source && e.target_item_id === target) || (e.source_item_id === target && e.target_item_id === source))) return doc;
  return { ...doc, edges: [...doc.edges, { id: uid(), source_item_id: source, target_item_id: target, source_anchor: 'pin', target_anchor: 'pin', color: 'terracota', label: null }] };
}

/** La portada solo viaja si es una dirección pública: ni datos incrustados ni archivos del dispositivo. */
export const safeCover = (url) => (typeof url === 'string' && /^https:\/\//.test(url) && url.length <= 600 ? url : null);

export const itemSummary = (i) => {
  if (i.retirada) return 'Nota retirada por quien la escribió';
  if (i.spoiler) return 'Contiene spoiler';
  return i.body || 'Sin texto';
};
export const KIND_NAMES = { note: 'Nota', book: 'Libro', quote: 'Cita', received: 'Recibida' };

/** Hora local a la que se podrá dejar otro post-it. */
export const nextSendLabel = (iso) => new Date(iso).toLocaleString('es-ES', { weekday: 'long', hour: '2-digit', minute: '2-digit' });
