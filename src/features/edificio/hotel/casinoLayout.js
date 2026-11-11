// El casino del sótano en 3D (encargo de Francisco del 10-11-2026, plan en docs/qa/casino-3d.md, bloque a): el plano, sin
// dibujo. Medidas de la sala, la escalera de mármol por la que se baja desde el hotel, los pasillos por los que se anda y
// dónde está cada cosa: la mesa de «Las 21 páginas», la ruleta de premios, «Las tres chisteras», la ventanilla de la caja,
// la vitrina de premios y la barra. Lo usan la escena (`casino3d.js`) y los mandos (`Casino.jsx`).
// Mundo de la app, como en el almacén: x a lo ancho, y a lo hondo (de la pared del fondo, y = 0, a la entrada), z arriba.

/** Ancho, hondo y alto de la sala. */
export const CW = 16;
export const CD = 22;
export const CH = 6.6;
/** Ojos de quien la recorre. */
export const EYE = 2.0;

/** El rellano de la entrada, a media altura, y la escalera de mármol que baja de él a la sala (hacia el fondo). */
export const RELLANO = { x0: 3.4, x1: 12.6, y0: 19.6, y1: CD, z: 2.2 };
export const ESCALERA = { x0: 6.3, x1: 9.7, y0: 15.8, y1: RELLANO.y0, peldanos: 12 };
/** La altura del suelo en un punto (la escalera sube del suelo al rellano). */
export function zDe(x, y) {
  if (y >= RELLANO.y0 && x > RELLANO.x0 && x < RELLANO.x1) return RELLANO.z;
  if (y > ESCALERA.y0 && y < ESCALERA.y1 && x > ESCALERA.x0 && x < ESCALERA.x1) return (RELLANO.z * (y - ESCALERA.y0)) / (ESCALERA.y1 - ESCALERA.y0);
  return 0;
}

// ── Lo que hay en la sala ──
/** La ruleta de premios: una rueda grande de pie contra la pared del fondo, en su tarima. */
export const RULETA = { x: 8, y: 0.95, z: 3.2, r: 1.65, tarima: [5.4, 0, 10.6, 2.5] };
/** La mesa de «Las 21 páginas»: media luna contra la pared izquierda, el crupier detrás y tres taburetes delante. */
export const MESA = { x0: 1.35, x1: 3.35, y0: 6.3, y1: 8.7, alto: 0.95, crupier: [0.85, 7.5] };
/** «Las tres chisteras»: una mesa redonda con sus tres chisteras, a la derecha. */
export const CHISTERAS = { x: 12.7, y: 7.5, r: 1.15, alto: 0.95 };
/** La ventanilla de la caja, en la pared izquierda, con su reja; dentro, la cajera. */
export const CAJA = { x0: 0, x1: 1.25, y0: 11.5, y1: 14.5, cajera: [0.55, 13.0] };
/** La vitrina de premios: tres armarios de cristal contra la pared derecha. */
export const VITRINA = { x0: 14.85, x1: CW, armarios: [[10.3, 11.95], [12.15, 13.85], [14.05, 15.7]], alto: 2.85 };
/** La barra del fondo, a la izquierda de la ruleta. */
export const BARRA = { x0: 0, x1: 3.6, y0: 0, y1: 2.2 };
/** Las cuatro columnas de la sala. */
export const COLUMNAS = [
  [4.8, 4.0],
  [11.2, 4.0],
  [4.8, 11.0],
  [11.2, 11.0],
];
/** Las tres lámparas de araña: dos a los lados de la sala y una alta sobre el pie de la escalera (ninguna tapa la ruleta). */
export const ARANAS = [
  [4.9, 8.4, 5.55],
  [11.1, 8.4, 5.55],
  [8, 16.2, 5.85],
];

// ── Por dónde se anda: una red de pasillos (tramos rectos entre nudos; la tercera cifra, la altura del suelo) ──
export const NODOS = {
  rellano: [8, 21.0, RELLANO.z],
  arriba: [8, 19.6, RELLANO.z],
  pie: [8, 15.8, 0],
  centro: [8, 13.0, 0],
  caja: [3.7, 13.0, 0],
  vitrina: [10.6, 13.2, 0],
  medio: [8, 7.5, 0],
  mesa: [4.7, 7.5, 0],
  chisteras: [9.7, 7.5, 0],
  ruleta: [8, 6.4, 0],
};
export const TRAMOS = [
  ['rellano', 'arriba'],
  ['arriba', 'pie'],
  ['pie', 'centro'],
  ['centro', 'caja'],
  ['centro', 'vitrina'],
  ['centro', 'medio'],
  ['medio', 'mesa'],
  ['medio', 'chisteras'],
  ['medio', 'ruleta'],
  ['caja', 'mesa'],
  ['vitrina', 'chisteras'],
];

/** Dónde se empieza: en el rellano, recién bajado del hotel, con toda la sala delante. */
export const INICIO = { x: 8, y: 21.0, yaw: Math.PI };

/**
 * Los sitios que se tocan: su caja en el mundo (para el toque), dónde va su letrero, a qué nudo se va y hacia dónde se
 * mira al llegar. `pronto`: aún no se juega ahí (los bloques siguientes).
 */
export const SITIOS = {
  mesa: { nombre: 'Las 21 páginas', box: [MESA.x0 - 0.9, MESA.y0, 0, MESA.x1, MESA.y1, 2.0], tag: [2.3, 7.5, 2.75], nudo: 'mesa', mira: [0.85, 7.5] },
  ruleta: { nombre: 'La ruleta', box: [RULETA.x - RULETA.r - 0.3, 0, 0, RULETA.x + RULETA.r + 0.3, RULETA.tarima[3], RULETA.z + RULETA.r + 0.4], tag: [RULETA.x, RULETA.y + 0.4, RULETA.z + RULETA.r + 0.55], nudo: 'ruleta', mira: [RULETA.x, 0, RULETA.z - 0.6] },
  chisteras: { nombre: 'Las tres chisteras', box: [CHISTERAS.x - CHISTERAS.r, CHISTERAS.y - CHISTERAS.r, 0, CHISTERAS.x + CHISTERAS.r, CHISTERAS.y + CHISTERAS.r, 1.8], tag: [CHISTERAS.x, CHISTERAS.y, 2.35], nudo: 'chisteras', mira: [CHISTERAS.x, CHISTERAS.y] },
  caja: { nombre: 'La caja', box: [CAJA.x0, CAJA.y0, 0, CAJA.x1 + 0.1, CAJA.y1, 2.9], tag: [0.9, 13.0, 3.15], nudo: 'caja', mira: [0, 13.0] },
  vitrina: { nombre: 'La vitrina', box: [VITRINA.x0 - 0.1, VITRINA.armarios[0][0], 0, VITRINA.x1, VITRINA.armarios[2][1], VITRINA.alto + 0.2], tag: [15.2, 13.0, 3.25], nudo: 'vitrina', mira: [CW, 13.0] },
};

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
    if (!best || d < best.d) best = { x: px, y: py, z: zDe(px, py), tramo: k, d };
  });
  return { x: best.x, y: best.y, z: best.z, tramo: best.tramo };
}

/**
 * La ruta por los pasillos de `from` a `to` (puntos ya sobre la red, con su tramo): la lista de puntos [x, y, z] por los
 * que se pasa, sin el de salida. Dijkstra sobre los nudos, con los dos puntos colgados de los extremos de su tramo.
 */
export function route(from, to) {
  if (from.tramo === to.tramo) return [[to.x, to.y, to.z]];
  const at = (id) => (id === '@from' ? [from.x, from.y, from.z] : id === '@to' ? [to.x, to.y, to.z] : NODOS[id]);
  const len = (a, b) => Math.hypot(at(a)[0] - at(b)[0], at(a)[1] - at(b)[1], at(a)[2] - at(b)[2]);
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

/** ¿Se puede tocar el suelo aquí para ir andando? (La sala, sin la barra ni el bajo del rellano.) */
export const dentro = (x, y) => x > 0.2 && x < CW - 0.2 && y > 0.2 && y < RELLANO.y0 && !(x < BARRA.x1 && y < BARRA.y1);
