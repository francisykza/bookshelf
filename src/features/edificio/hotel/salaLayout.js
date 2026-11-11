// La sala de lectura del Gran Hotel en 3D (encargo de Francisco del 11-11-2026, plan en docs/qa/sala-lectura-3d.md, bloque a):
// el plano, sin dibujo. Una biblioteca de doble altura, de noche: el ventanal al puerto al fondo con el reloj de pie a su
// lado, una galería alta con barandilla, la chimenea con el sofá para dos a la izquierda, seis sillones con su lámpara (tres
// delante del ventanal y tres contra la librería de la derecha), la mesa larga del centro y, junto a la entrada, la librería
// común donde se dejan los lomos. Lo usan la escena (`sala3d.js`) y los mandos (`SalaLectura.jsx`).
// Mundo de la app, como en el casino: x a lo ancho, y a lo hondo (de la pared del fondo, y = 0, a la entrada), z arriba.

/** Ancho, hondo y alto de la sala (de doble altura). */
export const SW = 14;
export const SD = 18;
// De triple altura desde el 11-11-2026 (Francisco: «sensación de magnificencia, como una gran biblioteca mágica»)
export const SH = 10.6;
/** Ojos de quien la recorre. */
export const EYE = 2.0;

/** La galería alta: un pasillo con barandilla a lo largo de las dos librerías laterales y del fondo, sobre el ventanal. */
export const GALERIA = { z: 3.9, fondo: 1.15, y1: 14.2 };
/** La galería de arriba: un anillo más estrecho por las cuatro paredes, bajo la bóveda. */
export const GALERIA_ALTA = { z: 7.3, fondo: 0.85 };
/** El ventanal del fondo, al puerto (bajo la galería), y los ventanucos altos de encima. */
export const VENTANAL = { x0: 3.6, x1: 10.4, z0: 0.55, z1: 3.55 };
/** El reloj de pie, a la derecha del ventanal: es el reloj del Pomodoro. */
export const RELOJ = { x: 11.7, y: 0.42, alto: 2.6 };
/** La chimenea de piedra en la pared izquierda, con su repisa. */
export const CHIMENEA = { y0: 8.6, y1: 11.4, fondo: 0.85, boca: [9.3, 10.7, 1.15] };
/** El sofá para dos, delante de la chimenea y mirándola (hacia −x). */
export const SOFA = { x: 3.3, y: 10, ancho: 2.3 };
/** La mesa larga del centro, con sus lámparas verdes. */
// (Atravesada y cerca de la entrada: así no tapa a quien lee junto al ventanal.)
export const MESA = { x0: 5.2, x1: 8.8, y0: 10.6, y1: 12.0, alto: 0.95 };
/** La librería común, contra la pared derecha junto a la entrada: cinco baldas donde se dejan los lomos. */
export const LIBRERIA = { y0: 13.4, y1: 17.2, fondo: 0.5, baldas: 5, z0: 0.55, paso: 0.48 };
/** La puerta acristalada de la entrada, en la pared de delante. */
export const PUERTA = { x0: 5.8, x1: 8.2, alto: 3.1 };

/**
 * Los seis sillones: x, y y hacia dónde mira el que se sienta (0: hacia la entrada, +y; 3: hacia −x, el centro). Tres
 * delante del ventanal y tres contra la librería de la derecha, todos de cara a quien entra.
 */
export const SILLONES = [
  [4.6, 2.7, 0],
  [7.0, 2.7, 0],
  [9.4, 2.7, 0],
  [12.3, 5.4, 3],
  [12.3, 7.9, 3],
  [12.3, 10.4, 3],
];
export const SEAT_H = 0.72;
/**
 * 1.117: las dos plazas del sofá para dos (la cita de lectura) van detrás de los seis sillones, como los asientos 6 y 7:
 * la 6 es la de quien invita y la 7 la de quien viene. Miran a la chimenea.
 */
export const PLAZAS_SOFA = [
  [SOFA.x - 0.1, SOFA.y - 0.55, 3],
  [SOFA.x - 0.1, SOFA.y + 0.55, 3],
];
export const PLAZA_SOFA = SILLONES.length;
/** Un asiento: un sillón (0 a 5) o una plaza del sofá (6 y 7). */
export const plazaDe = (k) => (k >= PLAZA_SOFA ? PLAZAS_SOFA[k - PLAZA_SOFA] : SILLONES[k]);
/** Dónde está el asiento de cada sillón o plaza del sofá (donde se sienta el personaje) y hacia dónde mira. */
export function asientoDe(k) {
  const [x, y, facing] = plazaDe(k);
  return facing === 0 ? { x, y: y - 0.1, mira: [x, y + 6] } : { x: x + 0.1, y, mira: [x - 6, y] };
}
/** La mesita de cada sillón (donde está tu libro cuando no lo estás leyendo), a su derecha según se sienta. */
export function mesitaDe(k) {
  const [x, y, facing] = SILLONES[k];
  return facing === 0 ? { x: x - 0.98, y: y + 0.1 } : { x: x + 0.05, y: y - 1.0 };
}
/** La lámpara de pie de cada sillón, al otro lado de la mesita. */
export function lamparaDe(k) {
  const [x, y, facing] = SILLONES[k];
  return facing === 0 ? { x: x + 0.86, y: y - 0.2 } : { x: x + 0.3, y: y + 0.86 };
}

// ── Por dónde se anda: una red de pasillos (tramos rectos entre nudos; la sala es de una planta: z = 0) ──
export const NODOS = {
  entrada: [7, 16.4],
  centro: [7, 13.4],
  izquierda: [4.2, 13.4],
  sofa: [4.6, 11.6],
  oeste: [4.2, 5.0],
  ventana: [7, 5.0],
  este: [10.3, 5.0],
  derecha: [10.3, 13.4],
  libreria: [12.3, 15.3],
  s3: [10.9, 5.4],
  s4: [10.9, 7.9],
  s5: [10.9, 10.4],
  s0: [4.6, 4.2],
  s1: [7.0, 4.2],
  s2: [9.4, 4.2],
};
export const TRAMOS = [
  ['entrada', 'centro'],
  ['centro', 'izquierda'],
  ['centro', 'derecha'],
  ['izquierda', 'sofa'],
  ['izquierda', 'oeste'],
  ['oeste', 'ventana'],
  ['ventana', 'este'],
  ['este', 'derecha'],
  ['derecha', 'libreria'],
  ['oeste', 's0'],
  ['ventana', 's1'],
  ['este', 's2'],
  ['este', 's3'],
  ['derecha', 's5'],
  ['s3', 's4'],
  ['s4', 's5'],
];

/** Dónde se empieza: recién entrado por la puerta, con toda la sala delante. */
export const INICIO = { x: 7, y: 16.4, yaw: Math.PI };

/** El nudo de cada sillón (desde donde se sienta). */
export const NUDO_SILLON = ['s0', 's1', 's2', 's3', 's4', 's5'];

/**
 * Los sitios que se tocan: su caja en el mundo (para el toque), dónde va su letrero, a qué nudo se va y hacia dónde se
 * mira al llegar. Los sillones se tocan cada uno (`sillon-k`).
 */
export const SITIOS = {
  libreria: {
    nombre: 'La librería de la sala',
    box: [SW - LIBRERIA.fondo - 0.1, LIBRERIA.y0, 0, SW, LIBRERIA.y1, 3.2],
    tag: [SW - 0.3, (LIBRERIA.y0 + LIBRERIA.y1) / 2, 3.35],
    nudo: 'libreria',
    mira: [SW, 15.3],
  },
  sofa: {
    nombre: 'Sofá para dos',
    box: [SOFA.x - 0.55, SOFA.y - SOFA.ancho / 2, 0, SOFA.x + 0.55, SOFA.y + SOFA.ancho / 2, 1.3],
    tag: [SOFA.x, SOFA.y, 1.75],
    nudo: 'sofa',
    mira: [0, 10],
  },
  reloj: { nombre: 'El reloj', box: [RELOJ.x - 0.45, 0, 0, RELOJ.x + 0.45, 0.9, RELOJ.alto + 0.3], tag: [RELOJ.x, 0.5, RELOJ.alto + 0.5], nudo: 'este', mira: [RELOJ.x, 0] },
};
SILLONES.forEach(([x, y], k) => {
  SITIOS[`sillon-${k}`] = { nombre: 'Sillón', box: [x - 0.62, y - 0.62, 0, x + 0.62, y + 0.62, 1.7], tag: [x, y, 2.35], nudo: NUDO_SILLON[k], mira: asientoDe(k).mira, sillon: k };
});

/** Los tonos de los lomos de la librería común (los mismos en la balda del panel y en la de la sala). */
export const TONOS_LOMO = ['#96362f', '#345c6e', '#b08846', '#40684c', '#78466e', '#8a5a3a'];
/** El mismo libro siempre tiene el mismo lomo: color y alto (de 0,72 a 1) salen del título. */
export function lomoDe(titulo) {
  let n = 7;
  for (const c of titulo) n = (n * 31 + c.charCodeAt(0)) % 9973;
  return { color: TONOS_LOMO[n % TONOS_LOMO.length], alto: 0.72 + (n % 5) * 0.07, n };
}
/** Las baldas de la librería común por orden de llenado: primero las de la altura de los ojos. */
export const ORDEN_BALDAS = [3, 2, 4, 1, 0];

/** El punto de la red más cercano a (x, y): { x, y, z, tramo }. */
export function onNet(x, y) {
  let best = null;
  TRAMOS.forEach(([a, b], k) => {
    const [ax, ay] = NODOS[a];
    const [bx, by] = NODOS[b];
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    const px = ax + dx * t;
    const py = ay + dy * t;
    const d = Math.hypot(x - px, y - py);
    if (!best || d < best.d) best = { x: px, y: py, z: 0, tramo: k, d };
  });
  return { x: best.x, y: best.y, z: 0, tramo: best.tramo };
}

/**
 * La ruta por los pasillos de `from` a `to` (puntos ya sobre la red, con su tramo): la lista de puntos [x, y, z] por los
 * que se pasa, sin el de salida. Dijkstra sobre los nudos, con los dos puntos colgados de los extremos de su tramo.
 */
export function route(from, to) {
  if (from.tramo === to.tramo) return [[to.x, to.y, 0]];
  const at = (id) => (id === '@from' ? [from.x, from.y, 0] : id === '@to' ? [to.x, to.y, 0] : [...NODOS[id], 0]);
  const len = (a, b) => Math.hypot(at(a)[0] - at(b)[0], at(a)[1] - at(b)[1]);
  const edges = new Map();
  const link = (a, b) => {
    const w = len(a, b);
    if (!edges.has(a)) edges.set(a, []);
    if (!edges.has(b)) edges.set(b, []);
    edges.get(a).push([b, w]);
    edges.get(b).push([a, w]);
  };
  TRAMOS.forEach(([a, b], k) => {
    if (k !== from.tramo && k !== to.tramo) link(a, b);
    if (k === from.tramo) {
      link('@from', a);
      link('@from', b);
    }
    if (k === to.tramo) {
      link('@to', a);
      link('@to', b);
    }
  });
  const dist = new Map([...edges.keys()].map((id) => [id, Infinity]));
  const prev = new Map();
  dist.set('@from', 0);
  const queue = new Set(edges.keys());
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
  for (let id = '@to'; id && id !== '@from'; id = prev.get(id)) path.unshift([...at(id)]);
  return path;
}

/** ¿Se puede tocar el suelo aquí para ir andando? (La sala, sin la chimenea, la mesa larga ni la librería común.) */
export const dentro = (x, y) =>
  x > 0.3 && x < SW - 0.3 && y > 0.3 && y < SD - 0.3 && !(x < CHIMENEA.fondo + 0.2 && y > CHIMENEA.y0 && y < CHIMENEA.y1) && !(x > MESA.x0 - 0.1 && x < MESA.x1 + 0.1 && y > MESA.y0 && y < MESA.y1);

/**
 * En qué sillón se sienta cada uno: tú en el tuyo (si lo tienes y está libre de ti) y los demás, por orden, en los que
 * quedan. `ids` son los que leen (tú primero si estás sentado). Devuelve un mapa id → sillón.
 */
export function repartoSillones(ids, me, mio) {
  const out = new Map();
  const libres = SILLONES.map((_, k) => k);
  const quitar = (k) => libres.splice(libres.indexOf(k), 1);
  if (me && ids.includes(me) && mio != null && mio >= 0 && mio < SILLONES.length) {
    out.set(me, mio);
    quitar(mio);
  }
  for (const id of ids) {
    if (out.has(id) || !libres.length) continue;
    out.set(id, libres[0]);
    quitar(libres[0]);
  }
  return out;
}
