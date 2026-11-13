// El café-librería del bajo, bloque 2 (1.120, SPEC §120): lo que se puede poner en el local y sus reglas, sin dibujo.
// Las cifras y listas son las mismas que en el servidor (`20261210120000_cafe_local.sql`); `cafe.rls.test.js` lo comprueba.
// El plano se guarda en casillas de una cuadrícula de 6 × 6 delante de la cortina; `cafeLayout.js` la pasa al mundo.
import { catalogItem } from '../catalog';
import { isRetirado } from '../retirados';
import { footprint } from '../room';

/** La cuadrícula que se decora (en casillas): 6 de ancho (x) por 6 de hondo (y, de la cortina al escaparate). */
export const CUADRICULA = { w: 6, d: 6 };
export const MAX_COSAS = 24;
/** Bloque 4b (1.123): con el ala lateral y la terraza caben más cosas (24 hasta el nivel 3; 32 desde el 4; 40 desde el 6, con la bodega). */
export const maxCosas = (nivel = 1) => (nivel >= 6 ? 40 : nivel >= 4 ? 32 : MAX_COSAS);
/**
 * Bloque 4a (1.122): desde el nivel 2 se recogen las cortinas y la cuadrícula crece 3 filas hacia el fondo (las filas −3 a −1,
 * detrás de donde estaba la cortina); las casillas de antes no cambian de número. Lo mismo en el servidor.
 */
export const FONDO = 3;
export const filasDe = (nivel = 1) => ({ desde: nivel >= 2 ? -FONDO : 0, hasta: CUADRICULA.d });
/**
 * Bloque 4b (1.123, cifras aprobadas por Francisco el 12-11-2026): en el nivel 4 se abre la pared de la izquierda y el ala
 * lateral añade 3 columnas (−3 a −1): la cuadrícula del local pasa a 9 × 9. En el nivel 5, la terraza de la acera: tres filas
 * (7 a 9) delante del escaparate, columnas 0 a 5 (la fila 6 es la pared). Lo mismo en el servidor.
 */
export const LADO = 3;
export const columnasDe = (nivel = 1) => ({ desde: nivel >= 4 ? -LADO : 0, hasta: CUADRICULA.w });
export const TERRAZA = { x0: 0, x1: 6, y0: 7, y1: 10 };
/**
 * Bloque 6a (1.125, cifras aprobadas por Francisco el 13-11-2026): en el nivel 6 se abre la trampilla de detrás de la barra y
 * la bodega del sótano tiene su propia cuadrícula de 5 × 5, en el mismo plano: columnas 0 a 4 y filas 20 a 24 (lejos de las
 * de la calle, para que nunca se mezclen). Crecerá en los niveles 7 y 8. Lo mismo en el servidor.
 */
export const SOTANO = { x0: 0, x1: 5, y0: 20, y1: 25 };
/**
 * Bloque 6b (1.127, cifras aprobadas por Francisco el 13-11-2026): en el nivel 7 el sótano crece con el tostadero y su
 * cuadrícula pasa a 7 × 5: dos columnas más por la izquierda (−2 y −1), hacia donde se abre el muro. Lo mismo en el servidor.
 */
export const TOSTADERO_COLS = 2;
export const sotanoDe = (nivel = 6) => ({ ...SOTANO, x0: nivel >= 7 ? SOTANO.x0 - TOSTADERO_COLS : SOTANO.x0 });
/** ¿En qué planta está una casilla? ('calle' o 'bodega') */
export const plantaDe = (y) => (y >= SOTANO.y0 ? 'bodega' : 'calle');
/** ¿Es una casilla del local (o de la terraza, o de la bodega) en este nivel? */
export function casillaValida(x, y, nivel = 1) {
  const c = columnasDe(nivel);
  const f = filasDe(nivel);
  if (x >= c.desde && x < c.hasta && y >= f.desde && y < f.hasta) return true;
  const s = sotanoDe(nivel);
  if (nivel >= 6 && x >= s.x0 && x < s.x1 && y >= s.y0 && y < s.y1) return true;
  return nivel >= 5 && x >= TERRAZA.x0 && x < TERRAZA.x1 && y >= TERRAZA.y0 && y < TERRAZA.y1;
}
/** Todas las casillas de un nivel (para buscar hueco y para la rejilla); con `planta`, solo las de esa planta. */
export function casillasDe(nivel = 1, planta = null) {
  const out = [];
  for (let y = filasDe(nivel).desde; y < SOTANO.y1; y += 1)
    for (let x = Math.min(columnasDe(nivel).desde, sotanoDe(nivel).x0); x < CUADRICULA.w; x += 1) if (casillaValida(x, y, nivel) && (!planta || plantaDe(y) === planta)) out.push({ x, y });
  return out;
}

/** Los muebles propios del café: medidas en casillas, precio en granos y nivel desde el que se venden. */
export const CAFE_MUEBLES = [
  { id: 'cafe-mesa', nombre: 'Mesa redonda de mármol', w: 1, d: 1, precio: 40, nivel: 1 },
  { id: 'cafe-silla', nombre: 'Silla de bistró', w: 1, d: 1, precio: 30, nivel: 1 },
  { id: 'cafe-taburete', nombre: 'Taburete de barra', w: 1, d: 1, precio: 25, nivel: 1 },
  { id: 'cafe-estanteria', nombre: 'Estantería baja', w: 2, d: 1, precio: 80, nivel: 1 },
  { id: 'cafe-lampara', nombre: 'Lámpara de cristal', w: 1, d: 1, precio: 60, nivel: 1 },
  // Bloque 4a (1.122): los de la subida a los niveles 2 y 3, y los de los primeros hitos (`hito: 1`)
  { id: 'cafe-maceta', nombre: 'Maceta de barro', w: 1, d: 1, precio: 35, nivel: 1, hito: 1 },
  { id: 'cafe-banco', nombre: 'Banco corrido', w: 2, d: 1, precio: 70, nivel: 2 },
  { id: 'cafe-vitrina', nombre: 'Vitrina de tartas', w: 2, d: 1, precio: 90, nivel: 2 },
  { id: 'cafe-planta', nombre: 'Planta grande', w: 1, d: 1, precio: 45, nivel: 2 },
  { id: 'cafe-perchero', nombre: 'Perchero', w: 1, d: 1, precio: 40, nivel: 2, hito: 1 },
  { id: 'cafe-estanteria-alta', nombre: 'Estantería alta', w: 2, d: 1, precio: 140, nivel: 3 },
  { id: 'cafe-orejero', nombre: 'Sillón orejero', w: 1, d: 1, precio: 120, nivel: 3 },
  { id: 'cafe-mesita', nombre: 'Mesita con quinqué', w: 1, d: 1, precio: 80, nivel: 3 },
  { id: 'cafe-reloj', nombre: 'Reloj de pie', w: 1, d: 1, precio: 160, nivel: 3, hito: 1 },
  // Bloque 4b (1.123): los del ala lateral (nivel 4) y los de la terraza (nivel 5)
  { id: 'cafe-mesa-larga', nombre: 'Mesa larga compartida', w: 2, d: 1, precio: 150, nivel: 4 },
  { id: 'cafe-biombo', nombre: 'Biombo de librería', w: 2, d: 1, precio: 180, nivel: 4 },
  { id: 'cafe-bankers', nombre: 'Lámpara de bankers', w: 1, d: 1, precio: 120, nivel: 4 },
  { id: 'cafe-piano', nombre: 'Piano vertical', w: 2, d: 1, precio: 200, nivel: 4, hito: 1 },
  { id: 'cafe-mesa-hierro', nombre: 'Mesa de hierro', w: 1, d: 1, precio: 150, nivel: 5 },
  { id: 'cafe-silla-terraza', nombre: 'Silla de terraza', w: 1, d: 1, precio: 150, nivel: 5 },
  { id: 'cafe-macetero', nombre: 'Macetero largo', w: 2, d: 1, precio: 180, nivel: 5 },
  { id: 'cafe-farol', nombre: 'Farol de forja', w: 1, d: 1, precio: 250, nivel: 5, hito: 1 },
  // Bloque 6a (1.125): los de la bodega (nivel 6, de 200 a 300 granos); el candil, del primer hito
  { id: 'cafe-barrica', nombre: 'Mesa de barrica', w: 1, d: 1, precio: 220, nivel: 6 },
  { id: 'cafe-banco-bodega', nombre: 'Banco de bodega', w: 2, d: 1, precio: 260, nivel: 6 },
  { id: 'cafe-candil', nombre: 'Candil de hierro', w: 1, d: 1, precio: 300, nivel: 6, hito: 1 },
  // Bloque 6b (1.127): los del tostadero (nivel 7, de 250 a 350 granos); el saco es un asiento y las latas, del primer hito
  { id: 'cafe-saco', nombre: 'Saco de arpillera', w: 1, d: 1, precio: 250, nivel: 7 },
  { id: 'cafe-latas', nombre: 'Estantería de latas', w: 2, d: 1, precio: 350, nivel: 7, hito: 1 },
];
export const cafeMueble = (id) => CAFE_MUEBLES.find((m) => m.id === id) ?? null;

/** Los nombres del café, una lista cerrada (sin texto libre): los ven tus amigos. */
/** Los cinco niveles del café y la reputación total para llegar a cada uno (plan, §6). */
export const CAFE_NIVELES = [
  { nivel: 1, nombre: 'Rincón', desde: 0 },
  { nivel: 2, nombre: 'Café', desde: 300 },
  { nivel: 3, nombre: 'Librería', desde: 1000 },
  { nivel: 4, nombre: 'Ala lateral', desde: 2500 },
  { nivel: 5, nombre: 'Terraza y escaparate', desde: 5000 },
  // Bloque 6a (1.125): el sótano. Bloque 6b (1.127): el tostadero. El 8 (la sala de catas, 21.000) llega en el bloque 6c
  { nivel: 6, nombre: 'La bodega', desde: 10000 },
  { nivel: 7, nombre: 'El tostadero', desde: 15000 },
];
/** La barra del último nivel abierto (para sus hitos): 5.000 de reputación. */
export const TRAMO_FINAL = 5000;
/**
 * Bloque 6b: el nivel 8 ya tiene su umbral aprobado (21.000, la sala de catas) aunque aún no esté abierto; la barra del 7 llega
 * hasta él (6.000), para que sus hitos no se muevan cuando se abra. Lo mismo en el servidor.
 */
export const DESDE_PROXIMO = { 8: 21000 };
/** Lo que mide la barra del último nivel abierto. */
export const tramoUltimo = (nivel) => (DESDE_PROXIMO[nivel + 1] ? DESDE_PROXIMO[nivel + 1] - (CAFE_NIVELES.find((x) => x.nivel === nivel)?.desde ?? 0) : TRAMO_FINAL);
/** Cómo va la barra del nivel: el nombre del nivel, lo que llevas dentro de él y lo que falta para el siguiente. */
export function progresoNivel(nivel = 1, reputacion = 0) {
  const n = CAFE_NIVELES.find((x) => x.nivel === nivel) ?? CAFE_NIVELES[0];
  const sig = CAFE_NIVELES.find((x) => x.nivel === n.nivel + 1) ?? null;
  const lleva = Math.max(0, reputacion - n.desde);
  // El último nivel abierto también tiene su barra, para ver llegar sus hitos
  if (!sig) {
    const meta = tramoUltimo(n.nivel);
    return { nombre: n.nombre, hecho: Math.min(1, lleva / meta), lleva, meta };
  }
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

/** ¿Cabe `item` donde dice? Todas sus casillas en el local (o en la terraza) del nivel y sin pisar a otra cosa (salvo `ignorar`). */
export function cabe(plano, item, ignorar = item.uid, nivel = 1) {
  if (!medidas(item.id) || ![item.x, item.y, item.rot].every(Number.isInteger) || item.rot < 0 || item.rot > 3) return false;
  const r = rectoDe(item);
  for (let y = r.y0; y < r.y1; y += 1) for (let x = r.x0; x < r.x1; x += 1) if (!casillaValida(x, y, nivel)) return false;
  return !plano.items.some((o) => o.uid !== ignorar && solapan(r, rectoDe(o)));
}

/**
 * Bloque 4b (1.123): los asientos de lo colocado (los bancos y el sofá, dos). En los niveles 4 y 5 vienen tantos clientes
 * como asientos, entre 5 y 6 (nivel 4) o 7 (nivel 5). La misma tabla que `cafe_asientos` en el servidor.
 */
export const ASIENTOS = {
  'cafe-silla': 1,
  'cafe-taburete': 1,
  'cafe-banco': 2,
  'cafe-orejero': 1,
  'cafe-silla-terraza': 1,
  'cafe-banco-bodega': 2,
  'cafe-saco': 1,
  silla: 1,
  banco: 2,
  sofa: 2,
  puf: 1,
  mecedora: 1,
  'taburete-barra': 1,
  'sillon-capa': 1,
};
export const asientosDe = (plano) => (plano?.items ?? []).reduce((n, it) => n + (ASIENTOS[it.id] ?? 0), 0);

/**
 * El primer hueco libre para `id` (girado como pueda), empezando cerca de (x, y); null si no cabe en ningún sitio. Con
 * `planta` ('calle' o 'bodega', la que se está decorando), solo en esa planta.
 */
export function hueco(plano, id, cerca = null, nivel = 1, planta = null) {
  // Lo nuevo va primero a lo recién abierto: el fondo (nivel 2), el ala lateral (nivel 4) y la terraza (nivel 5); en la bodega, al centro
  const c = cerca ?? (planta === 'bodega' ? { x: nivel >= 7 ? -1 : 2, y: SOTANO.y0 + 2 } : nivel >= 5 ? { x: 2, y: 8 } : nivel >= 4 ? { x: -2, y: 2 } : nivel >= 2 ? { x: 2, y: -2 } : { x: 2, y: 3 });
  const opciones = casillasDe(nivel, planta).map((o) => ({ ...o, dist: Math.hypot(o.x - c.x, o.y - c.y) }));
  opciones.sort((a, b) => a.dist - b.dist);
  for (const rot of [0, 1]) {
    for (const o of opciones) {
      const item = { uid: '__nuevo', id, x: o.x, y: o.y, rot };
      if (cabe(plano, item, '__nuevo', nivel)) return { x: o.x, y: o.y, rot };
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
