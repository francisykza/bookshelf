// El café-librería del bajo, bloque 2 (1.120, SPEC §120): lo que se puede poner en el local y sus reglas, sin dibujo.
// Las cifras y listas son las mismas que en el servidor (`20261210120000_cafe_local.sql`); `cafe.rls.test.js` lo comprueba.
// El plano se guarda en casillas de una cuadrícula de 6 × 6 delante de la cortina; `cafeLayout.js` la pasa al mundo.
import { catalogItem } from '../catalog';
import { isRetirado } from '../retirados';
import { footprint } from '../room';

/** La cuadrícula que se decora (en casillas): 6 de ancho (x) por 6 de hondo (y, de la cortina al escaparate). */
export const CUADRICULA = { w: 6, d: 6 };
export const MAX_COSAS = 24;

/** Los muebles propios del café: medidas en casillas, precio en granos y nivel desde el que se venden. */
export const CAFE_MUEBLES = [
  { id: 'cafe-mesa', nombre: 'Mesa redonda de mármol', w: 1, d: 1, precio: 40, nivel: 1 },
  { id: 'cafe-silla', nombre: 'Silla de bistró', w: 1, d: 1, precio: 30, nivel: 1 },
  { id: 'cafe-taburete', nombre: 'Taburete de barra', w: 1, d: 1, precio: 25, nivel: 1 },
  { id: 'cafe-estanteria', nombre: 'Estantería baja', w: 2, d: 1, precio: 80, nivel: 1 },
  { id: 'cafe-lampara', nombre: 'Lámpara de cristal', w: 1, d: 1, precio: 60, nivel: 1 },
];
export const cafeMueble = (id) => CAFE_MUEBLES.find((m) => m.id === id) ?? null;

/** Los nombres del café, una lista cerrada (sin texto libre): los ven tus amigos. */
/** Los cinco niveles del café y la reputación total para llegar a cada uno (plan, §6). */
export const CAFE_NIVELES = [
  { nivel: 1, nombre: 'Rincón', desde: 0 },
  { nivel: 2, nombre: 'Café', desde: 300 },
  { nivel: 3, nombre: 'Librería', desde: 1000 },
  { nivel: 4, nombre: 'Altillo', desde: 2500 },
  { nivel: 5, nombre: 'Terraza y escaparate', desde: 5000 },
];
/** Cómo va la barra del nivel: el nombre del nivel, lo que llevas dentro de él y lo que falta para el siguiente. */
export function progresoNivel(nivel = 1, reputacion = 0) {
  const n = CAFE_NIVELES.find((x) => x.nivel === nivel) ?? CAFE_NIVELES[0];
  const sig = CAFE_NIVELES.find((x) => x.nivel === n.nivel + 1) ?? null;
  if (!sig) return { nombre: n.nombre, hecho: 1, lleva: reputacion, meta: null };
  const lleva = Math.max(0, reputacion - n.desde);
  return { nombre: n.nombre, hecho: Math.min(1, lleva / (sig.desde - n.desde)), lleva, meta: sig.desde - n.desde };
}

export const CAFE_NOMBRES = [
  'La Última Página',
  'El Marcapáginas',
  'Café del Muelle',
  'Taza y Lomo',
  'El Rincón del Faro',
  'Tinta y Canela',
  'La Biblioteca de Pilar',
  'Capítulo Uno',
  'El Farolillo',
  'Las Tres Tazas',
  'Hojas de Té',
  'La Buena Pluma',
];

/** Lo que se recibe al inaugurar, ya colocado. */
export const PLANO_INICIAL = {
  v: 1,
  items: [
    { uid: 'i1', id: 'cafe-estanteria', x: 1, y: 0, rot: 0 },
    { uid: 'i2', id: 'cafe-mesa', x: 1, y: 2, rot: 0 },
    { uid: 'i3', id: 'cafe-silla', x: 0, y: 2, rot: 3 },
    { uid: 'i4', id: 'cafe-silla', x: 2, y: 2, rot: 1 },
    { uid: 'i5', id: 'cafe-mesa', x: 3, y: 4, rot: 0 },
    { uid: 'i6', id: 'cafe-silla', x: 3, y: 3, rot: 0 },
    { uid: 'i7', id: 'cafe-silla', x: 3, y: 5, rot: 2 },
    { uid: 'i8', id: 'cafe-taburete', x: 5, y: 0, rot: 1 },
    { uid: 'i9', id: 'cafe-taburete', x: 5, y: 2, rot: 1 },
    { uid: 'i10', id: 'cafe-lampara', x: 0, y: 4, rot: 0 },
  ],
};

/** Los esenciales del piso (con copia gratis) y las piezas fijas se quedan en casa. */
const SOLO_CASA = new Set(['sillon', 'estanteria', 'escritorio', 'tablon', 'ventana', 'ordenador', 'puerta-piso']);
const RAREZAS_CASA = new Set(['comun', 'poco-comun', 'raro', 'especial']);

/** ¿Puede ir este mueble de casa al café? De suelo, sin saga, sin místicos ni retirados y no un esencial. */
export function deCasa(id) {
  const cat = catalogItem(id);
  if (!cat || cat.capa !== 'suelo' || cat.set || SOLO_CASA.has(id) || isRetirado(id)) return false;
  return RAREZAS_CASA.has(cat.rareza ?? 'comun');
}

/** Medidas de lo que hay en el plano, del café o de casa. */
export function medidas(id) {
  const m = cafeMueble(id);
  if (m) return { w: m.w, d: m.d };
  const cat = catalogItem(id);
  return cat ? { w: cat.w, d: cat.d } : null;
}

/** Las casillas que ocupa una cosa del plano (con su giro). */
export function rectoDe(item) {
  const f = footprint(medidas(item.id), item.rot);
  return { x0: item.x, y0: item.y, x1: item.x + f.w, y1: item.y + f.d };
}

const solapan = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/** ¿Cabe `item` donde dice? Dentro de la cuadrícula y sin pisar a otra cosa (salvo `ignorar`). */
export function cabe(plano, item, ignorar = item.uid) {
  if (!medidas(item.id) || ![item.x, item.y, item.rot].every(Number.isInteger) || item.rot < 0 || item.rot > 3) return false;
  const r = rectoDe(item);
  if (r.x0 < 0 || r.y0 < 0 || r.x1 > CUADRICULA.w || r.y1 > CUADRICULA.d) return false;
  return !plano.items.some((o) => o.uid !== ignorar && solapan(r, rectoDe(o)));
}

/** El primer hueco libre para `id` (girado como pueda), empezando cerca de (x, y); null si no cabe en ningún sitio. */
export function hueco(plano, id, cerca = { x: 2, y: 3 }) {
  const opciones = [];
  for (let y = 0; y < CUADRICULA.d; y += 1) for (let x = 0; x < CUADRICULA.w; x += 1) opciones.push({ x, y, dist: Math.hypot(x - cerca.x, y - cerca.y) });
  opciones.sort((a, b) => a.dist - b.dist);
  for (const rot of [0, 1]) {
    for (const o of opciones) {
      const item = { uid: '__nuevo', id, x: o.x, y: o.y, rot };
      if (cabe(plano, item, '__nuevo')) return { x: o.x, y: o.y, rot };
    }
  }
  return null;
}

/** Copias de cada mueble en un plano (o en el `layout` del piso). */
export function cuenta(plano) {
  const n = {};
  for (const it of plano?.items ?? []) n[it.id] = (n[it.id] ?? 0) + 1;
  return n;
}

/** Cuántas copias de un mueble de casa quedan libres: las del inventario menos las del piso y las del café. */
export function libresDeCasa(inventario, layoutPiso, plano, id) {
  const total = inventario?.copias?.[id] ?? 0;
  return total - (cuenta(layoutPiso)[id] ?? 0) - (cuenta(plano)[id] ?? 0);
}

/** Copias libres de un mueble del café: las compradas o recibidas menos las puestas. */
export const libresDelCafe = (inventarioCafe, plano, id) => (inventarioCafe?.[id] ?? 0) - (cuenta(plano)[id] ?? 0);

/** Un uid nuevo que no esté en el plano. */
export function uidNuevo(plano) {
  let k = plano.items.length + 1;
  while (plano.items.some((i) => i.uid === `c${k}`)) k += 1;
  return `c${k}`;
}
