// El Almacén del Puerto (encargo de Francisco del 9-11-2026: la Lonja pasa a ser un gran almacén de muebles en 3D).
// Aquí está el plano, sin dibujo: las medidas de la nave, los pasillos por los que se anda, dónde está cada expositor y qué
// mueble enseña, y las rutas de un sitio a otro. Lo usan la escena (`almacen3d.js`) y los mandos (`AlmacenVista.jsx`).
// Mundo de la app, como en la recepción: x a lo ancho, y a lo hondo (de la pared del fondo, y = 0, a la entrada), z arriba.
import { catalogItem, zonaOf } from '../catalog';
import { TIENDA, precioDe } from '../economy';
import { shapeOf } from '../furniture';

/** Ancho, hondo y alto de la nave. */
export const AW = 18;
export const AD = 26;
export const AH = 6;
/** Ojos de quien recorre el almacén. */
export const EYE = 2.0;

// ── Por dónde se anda: una red de pasillos (tramos rectos entre nudos) ──
// Pasillo izquierdo (x = 4,2), central (x = 11) y derecho (x = 15,5); el cruce de delante (y = 20,6) y el del fondo (y = 4,2).
// Desde la 1.101, el cruce del fondo sigue por el paso de la pared derecha hasta las habitaciones, y el pasillo 4 las recorre.
export const NODOS = {
  entrada: [15.5, 23.6],
  fr: [15.5, 20.6],
  fc: [11, 20.6],
  fl: [4.2, 20.6],
  caja: [4.2, 21.6],
  br: [15.5, 4.2],
  bc: [11, 4.2],
  bl: [4.2, 4.2],
  hab: [23.5, 4.2],
  hf: [23.5, 14.6],
};
export const TRAMOS = [
  ['entrada', 'fr'],
  ['fr', 'fc'],
  ['fc', 'fl'],
  ['fl', 'caja'],
  ['fl', 'bl'],
  ['fc', 'bc'],
  ['fr', 'br'],
  ['bl', 'bc'],
  ['bc', 'br'],
  ['br', 'hab'],
  ['hab', 'hf'],
];

/**
 * El punto de la red más cercano a (x, y): { x, y, tramo } (tramo = índice en TRAMOS). Al otro lado de la pared derecha (las
 * habitaciones, 1.101) solo cuentan los tramos de allí, y en la nave no cuenta el pasillo 4: así no se cruza una pared.
 */
export function onNet(x, y) {
  let best = null;
  const alla = x >= AW;
  TRAMOS.forEach(([a, b], k) => {
    if (alla ? a !== 'hab' && b !== 'hab' : a === 'hab' && b === 'hf') return;
    const [ax, ay] = NODOS[a];
    const [bx, by] = NODOS[b];
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    const px = ax + dx * t;
    const py = ay + dy * t;
    const d = Math.hypot(x - px, y - py);
    if (!best || d < best.d) best = { x: px, y: py, tramo: k, d };
  });
  return { x: best.x, y: best.y, tramo: best.tramo };
}

/**
 * La ruta por los pasillos de `from` a `to` (puntos ya sobre la red, con su tramo): la lista de puntos por los que se
 * pasa, sin el de salida. Dijkstra sobre los nudos, con los dos puntos colgados de los extremos de su tramo.
 */
export function route(from, to) {
  if (from.tramo === to.tramo) return [[to.x, to.y]];
  const dist = new Map();
  const prev = new Map();
  const edges = new Map();
  const link = (a, b, w) => {
    if (!edges.has(a)) edges.set(a, []);
    if (!edges.has(b)) edges.set(b, []);
    edges.get(a).push([b, w]);
    edges.get(b).push([a, w]);
  };
  const at = (id) => (id === '@from' ? [from.x, from.y] : id === '@to' ? [to.x, to.y] : NODOS[id]);
  const len = (a, b) => Math.hypot(at(a)[0] - at(b)[0], at(a)[1] - at(b)[1]);
  TRAMOS.forEach(([a, b], k) => {
    if (k === from.tramo || k === to.tramo) {
      if (k === from.tramo) {
        link('@from', a, len('@from', a));
        link('@from', b, len('@from', b));
      }
      if (k === to.tramo) {
        link('@to', a, len('@to', a));
        link('@to', b, len('@to', b));
      }
    } else link(a, b, len(a, b));
  });
  const queue = new Set(edges.keys());
  for (const id of queue) dist.set(id, Infinity);
  dist.set('@from', 0);
  while (queue.size) {
    let u = null;
    for (const id of queue) if (u === null || dist.get(id) < dist.get(u)) u = id;
    queue.delete(u);
    if (u === '@to') break;
    for (const [v, w] of edges.get(u) ?? []) {
      const nd = dist.get(u) + w;
      if (nd < dist.get(v)) {
        dist.set(v, nd);
        prev.set(v, u);
      }
    }
  }
  const path = [];
  for (let id = '@to'; id && id !== '@from'; id = prev.get(id)) path.unshift(at(id));
  return path;
}

// ── Lo que hay en la nave ──
/** La isla entre el pasillo izquierdo y el central: espina baja en x = 7,5 y expositores a cada lado. */
export const ISLA = { x0: 5.3, x1: 9.9, y0: 5.8, y1: 19.4, espina: [7.45, 7.75], alto: 1.5 };
/** El muro de exposición, entre el pasillo central y el derecho: lo de pared, colgado en su cara oeste. */
export const MURO = { x0: 13.0, x1: 13.3, y0: 6.0, y1: 19.2, alto: 4.1 };
/** Los ambientes montados, contra la pared izquierda. */
export const AMBIENTES = [
  { id: 'amb-lectura', nombre: 'Rincón de lectura montado', y0: 6.0, y1: 12.2, alfombra: [86, 112, 142] },
  { id: 'amb-salon', nombre: 'Salón montado', y0: 13.0, y1: 19.4, alfombra: [184, 98, 70] },
];
/** Las estanterías de autoservicio del fondo, con los paquetes planos, y el muelle de carga (lleva al mercadillo). */
export const RACKS = { x0: 1.6, x1: 14.6, y0: 0.35, y1: 1.95, niveles: [0.15, 1.45, 2.75, 4.05] };
export const MUELLE = { x0: 15.4, x1: 17.6, alto: 3.5 };
/** La caja: el mostrador con su cajero, contra la pared de delante, a la izquierda. */
export const CAJA = { x0: 1.4, x1: 7.0, y0: 23.5, y1: 24.3, cajero: [4.2, 25.1] };
/** El directorio, junto a la entrada. */
export const DIRECTORIO = { x: 13.2, y: 22.0 };
/** La puerta de cristal de la entrada, en la pared de delante. */
export const PUERTA = { x0: 14.1, x1: 16.9, alto: 3.1 };
/**
 * Las habitaciones (1.101, encargo de Francisco del 9-11-2026): una sala contigua a la nave, a la derecha del cruce del fondo,
 * con habitaciones pequeñas montadas como en una tienda de muebles, abiertas al pasillo 4. La primera es la temática de
 * superhéroes, «Capa y Antifaz», con su rincón especial (el escenario del foco y el mural de la ciudad); a su alrededor,
 * dos normales con muebles de la casa, para que no quede vacía. Se entra por un paso en la pared derecha.
 */
export const HAB = { x0: AW, x1: 29.5, y0: 0.85, y1: 15.6 };
export const PASO = { y0: 3.0, y1: 5.4, alto: 3.4 };
export const HABITACIONES = [
  { id: 'hab-estudio', nombre: 'Estudio con vistas', x0: AW, x1: 22.2, y0: 5.4, y1: 10.2, alto: 2.8, suelo: [150, 98, 60], papel: [222, 206, 170], raya: [196, 172, 128] },
  { id: 'hab-salita', nombre: 'Salita de tarde', x0: AW, x1: 22.2, y0: 10.2, y1: 15.6, alto: 2.8, suelo: [86, 112, 142], papel: [200, 214, 196], raya: [140, 162, 128] },
  { id: 'hab-heroes', nombre: 'Capa y Antifaz', x0: 24.8, x1: 29.5, y0: 5.4, y1: 15.6, alto: 3.6, suelo: [44, 50, 92], papel: [40, 46, 86], raya: [62, 70, 120], heroes: true },
];
/** El rincón especial de la habitación de superhéroes: un escenario redondo con el foco, el maniquí y el mural de la ciudad. */
export const RINCON = { x: 28.0, y: 14.0, r: 1.25 };
/**
 * 1.102 · El probador, en la entrada de las habitaciones, contra la pared del norte: un espejo grande con marco de latón
 * (`espejo`: de x0 a x1 y de z0 a z1) y dos cabinas con cortina (`cabinas`: de x0 a x1, hondas hasta `fondo`). `mira`:
 * dónde se para quien va al espejo, en el pasillo del paso.
 */
export const PROBADOR = { espejo: { x0: 19.9, x1: 22.3, z0: 0.12, z1: 2.62 }, cabinas: [[23.7, 25.6], [25.8, 27.7]], fondo: 1.75, mira: [21.1, 4.2] };
/** ¿Se puede andar (o tocar el suelo) en este punto? En la nave o en las habitaciones. */
export const dentro = (x, y) => (x > 0 && x < AW && y > 0 && y < AD) || (x >= AW && x < HAB.x1 && y > HAB.y0 && y < HAB.y1);

/** Dónde se empieza: recién entrado, mirando hacia el fondo y un poco a la izquierda. */
export const INICIO = { x: 15.5, y: 23.6, yaw: Math.PI + 0.38 };

/** Las secciones del directorio. Cada expositor dice en cuál está. */
export const SECCIONES = [
  { id: 'lectura', nombre: 'Rincón de lectura', donde: 'Pasillo 1' },
  { id: 'salon', nombre: 'Salón y estudio', donde: 'Pasillo 2' },
  { id: 'paredes', nombre: 'Paredes', donde: 'Pasillo 2, en el muro' },
  { id: 'ambientes', nombre: 'Ambientes montados', donde: 'Pasillo 1, contra la pared' },
  { id: 'heroes', nombre: 'Capa y Antifaz · superhéroes', donde: 'Pasillo 4, las habitaciones' },
  { id: 'habitaciones', nombre: 'Habitaciones montadas', donde: 'Pasillo 4, las habitaciones' },
];
/** Las secciones que repiten muebles de otras, montados como en casa: no salen en el directorio ni son su expositor principal. */
export const DE_PASO = new Set(['ambientes', 'habitaciones']);

// Cada expositor: el mueble y su tono, el centro de su planta (x, y), hacia dónde mira su frente (n) y su zona de carga.
// Lo de suelo va en una tarima baja; lo de pared, colgado (pared: true, el centro es el punto del muro).
const E = (id, tono, x, y, n, zona, extra = {}) => ({ id, tono, x, y, n, zona, ...extra });
const OESTE = [-1, 0];
const ESTE = [1, 0];
const SUR = [0, 1];
const BASE = [
  // Pasillo 1 (cara oeste de la isla): el rincón de lectura y el muestrario de sillones
  E('sillon', 0, 6.35, 7.2, OESTE, 'isla', { seccion: 'lectura' }),
  E('lampara-pie', 0, 6.85, 9.6, OESTE, 'isla', { seccion: 'lectura' }),
  E('estanteria', 0, 6.85, 11.6, OESTE, 'isla', { seccion: 'lectura' }),
  E('sillon', 1, 6.35, 14.3, OESTE, 'isla', { seccion: 'lectura', muestra: true }),
  E('sillon', 2, 6.35, 16.8, OESTE, 'isla', { seccion: 'lectura', muestra: true }),
  // Pasillo 2 (cara este de la isla): salón y estudio
  E('mesa', 0, 8.85, 7.2, ESTE, 'isla', { seccion: 'salon' }),
  E('mesa-baja', 0, 8.35, 9.9, ESTE, 'isla', { seccion: 'salon' }),
  E('escritorio', 0, 8.35, 12.3, ESTE, 'isla', { seccion: 'salon' }),
  E('mesa-baja', 1, 8.35, 14.9, ESTE, 'isla', { seccion: 'salon', muestra: true }),
  E('escritorio', 2, 8.35, 17.4, ESTE, 'isla', { seccion: 'salon', muestra: true }),
  // El muro de exposición, cara oeste (se ve desde el pasillo 2): lo de pared
  E('cuadro', 0, MURO.x0, 7.4, OESTE, 'muro', { seccion: 'paredes', pared: true }),
  E('mapa', 0, MURO.x0, 9.8, OESTE, 'muro', { seccion: 'paredes', pared: true }),
  E('reloj', 0, MURO.x0, 11.6, OESTE, 'muro', { seccion: 'paredes', pared: true }),
  E('tapiz', 0, MURO.x0, 13.5, OESTE, 'muro', { seccion: 'paredes', pared: true }),
  E('espejo', 0, MURO.x0, 15.3, OESTE, 'muro', { seccion: 'paredes', pared: true }),
  E('estante-pared', 0, MURO.x0, 17.4, OESTE, 'muro', { seccion: 'paredes', pared: true }),
  // La pared de la derecha (se ve desde el pasillo 3): la ventana y la guirnalda, que piden pared grande
  E('ventana', 0, AW, 9.0, OESTE, 'derecha', { seccion: 'paredes', pared: true }),
  E('guirnalda', 0, AW, 13.6, OESTE, 'derecha', { seccion: 'paredes', pared: true }),
  E('ventana', 1, AW, 17.6, OESTE, 'derecha', { seccion: 'paredes', pared: true, muestra: true }),
  // Los ambientes montados, contra la pared izquierda: los mismos muebles en otros tonos, puestos como en casa
  E('estanteria', 2, 0.55, 7.6, ESTE, 'ambientes', { seccion: 'ambientes' }),
  E('sillon', 3, 1.75, 9.6, ESTE, 'ambientes', { seccion: 'ambientes' }),
  E('lampara-pie', 1, 0.75, 11.3, ESTE, 'ambientes', { seccion: 'ambientes' }),
  E('cuadro', 1, 0, 9.6, ESTE, 'ambientes', { seccion: 'ambientes', pared: true }),
  E('mesa-baja', 2, 2.0, 16.2, ESTE, 'ambientes', { seccion: 'ambientes' }),
  E('sillon', 4, 1.15, 14.3, SUR, 'ambientes', { seccion: 'ambientes' }),
  E('escritorio', 1, 0.55, 18.3, ESTE, 'ambientes', { seccion: 'ambientes' }),
  E('ventana', 2, 0, 16.2, ESTE, 'ambientes', { seccion: 'ambientes', pared: true }),
  E('reloj', 1, 0, 13.4, ESTE, 'ambientes', { seccion: 'ambientes', pared: true }),
  // Las habitaciones (1.101). Capa y Antifaz, contra la pared del fondo de la sala: lo que se vende de la colección
  E('estanteria-comics', 0, 28.8, 7.0, OESTE, 'habitaciones', { seccion: 'heroes' }),
  E('sillon-capa', 0, 27.7, 10.2, OESTE, 'habitaciones', { seccion: 'heroes' }),
  E('cartel-vinetas', 0, HAB.x1, 10.2, OESTE, 'habitaciones', { seccion: 'heroes', pared: true }),
  E('neon-rayo', 0, 26.6, 5.5, SUR, 'habitaciones', { seccion: 'heroes', pared: true }),
  // Su rincón especial: en el escenario, el maniquí y el foco que apunta al mural
  E('maniqui-capa', 0, 28.3, 13.1, OESTE, 'habitaciones', { seccion: 'heroes', sobre: 0.16 }),
  E('foco-heroe', 0, 27.3, 14.6, ESTE, 'habitaciones', { seccion: 'heroes', sobre: 0.16 }),
  // El estudio con vistas y la salita de tarde: muebles de la casa en otros tonos, puestos como en casa
  E('estanteria', 1, 18.6, 6.6, ESTE, 'habitaciones', { seccion: 'habitaciones' }),
  E('escritorio', 0, 18.7, 8.9, ESTE, 'habitaciones', { seccion: 'habitaciones' }),
  E('lampara-pie', 2, 20.4, 9.5, ESTE, 'habitaciones', { seccion: 'habitaciones' }),
  E('mapa', 1, AW, 8.9, ESTE, 'habitaciones', { seccion: 'habitaciones', pared: true }),
  E('reloj', 2, 20.6, 5.5, SUR, 'habitaciones', { seccion: 'habitaciones', pared: true }),
  E('sillon', 1, 19.4, 12.4, ESTE, 'habitaciones', { seccion: 'habitaciones' }),
  E('mesa-baja', 1, 21.3, 12.4, ESTE, 'habitaciones', { seccion: 'habitaciones' }),
  E('lampara-pie', 0, 18.75, 14.7, ESTE, 'habitaciones', { seccion: 'habitaciones' }),
  E('cuadro', 2, AW, 12.4, ESTE, 'habitaciones', { seccion: 'habitaciones', pared: true }),
  E('ventana', 1, 20.2, 15.6, [0, -1], 'habitaciones', { seccion: 'habitaciones', pared: true }),
];

/** Lo que la tienda vende (los de la tienda del bajo, sin retirados): solo eso se expone. */
const VENDE = new Set(TIENDA.map((c) => c.id));
export const EXPOSITORES = BASE.filter((e) => VENDE.has(e.id) && catalogItem(e.id)?.tonos?.[e.tono]).map((e, i) => ({ ...e, i }));

/** Los muebles a la venta, en el orden del directorio: una ficha por mueble (los tonos se eligen en ella). */
export const ARTICULOS = TIENDA.map((c) => ({
  id: c.id,
  nombre: c.nombre,
  precio: precioDe(c.id),
  zona: zonaOf(c),
  tonos: c.tonos.length,
  expositor: EXPOSITORES.find((e) => e.id === c.id && !e.muestra && !DE_PASO.has(e.seccion))?.i ?? EXPOSITORES.find((e) => e.id === c.id)?.i ?? null,
}));

/** Alto de un mueble (en casillas), sacado de su forma. Lo de pared: lo que mide de alto el dibujo. */
export function altoDe(id) {
  const cat = catalogItem(id);
  let boxes = [];
  try {
    boxes = shapeOf(id, cat.tonos[0]);
  } catch {
    boxes = [];
  }
  if (!boxes.length) return null;
  const z0 = Math.min(...boxes.map((b) => b.b[2]));
  const z1 = Math.max(...boxes.map((b) => b.b[5]));
  return cat.capa === 'pared' ? z1 - z0 : z1;
}

/** Las medidas que enseña la ficha: «2 × 2 casillas, 1,8 de alto» o «2 casillas de pared, 1,6 de alto». */
export function medidasDe(id) {
  const cat = catalogItem(id);
  const h = altoDe(id);
  const alto = h == null ? '' : `, ${h.toFixed(1).replace('.', ',')} de alto`;
  if (cat.capa === 'pared') return `${cat.w} ${cat.w === 1 ? 'casilla' : 'casillas'} de pared${alto}`;
  return `${cat.w} × ${cat.d} casillas de suelo${alto}`;
}

/** Nombres de los tonos del catálogo, para las muestras de la ficha. */
const TONOS = {
  '128,150,112': 'Salvia',
  '184,98,70': 'Terracota',
  '204,158,70': 'Mostaza',
  '86,112,142': 'Azul mar',
  '206,144,140': 'Rosa',
  '232,218,190': 'Crema',
  '150,98,60': 'Madera',
  '190,142,96': 'Madera clara',
  '110,70,46': 'Nogal',
};
export const nombreTono = (c) => TONOS[c.join(',')] ?? 'Tono';

/** Dónde se pone uno para mirar un expositor de cerca, desde su pasillo: un punto de la red delante de él. */
export function puntoDeMirar(e) {
  const p = onNet(e.x + e.n[0] * 2.4, e.y + e.n[1] * 2.4);
  return p;
}
