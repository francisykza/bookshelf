// Los materiales del interior, sacados de los de la vista isométrica: el mismo suelo (`floorColor`), la misma rampa de tonos
// y el mismo tapizado por cajas del sillón (`armchair` de furniture.js), con volumen y costura porque aquí se ve de cerca.
import { BoxGeometry, BufferAttribute, BufferGeometry, CanvasTexture, Color, Float32BufferAttribute, NearestFilter, RepeatWrapping, SRGBColorSpace } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { createRaster, noise, rgb } from '../minigames/libreria-puerto/raster';
import { floorColor } from '../edificio/render';
import { ROOM } from '../edificio/room';

const FLOOR_PX = 32; // por celda de la habitación
const shade = (c, k) => c.map((v) => Math.max(0, Math.min(255, Math.round(v * k))));
const color = ([r, g, b]) => new Color().setRGB(r / 255, g / 255, b / 255, SRGBColorSpace);
const WOOD_DARK = [110, 70, 46];
/** Los colores de la lámpara de furniture.js y la luz de tarde de render.js. */
const LATON = [196, 156, 76];
const HIERRO = [92, 90, 94];
const LIT = [255, 228, 164];
const WHITE = 0xffffffff;
const multiply = (p, [r, g, b]) => rgb((p & 255) * r, ((p >> 8) & 255) * g, ((p >> 16) & 255) * b);
const clampTone = (v) => Math.max(0, Math.min(4, Math.floor(v)));

// Solo se usa por sus rampas de tonos y su tramado: no dibuja nada
let probeRaster = null;
const probe = () => (probeRaster ??= createRaster({ W: 2, H: 2, S: 1, yaw: 0, ox: 0, oy: 0 }));

function texture(canvas, { repeat = false } = {}) {
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  t.magFilter = NearestFilter;
  t.minFilter = NearestFilter;
  if (repeat) {
    t.wrapS = RepeatWrapping;
    t.wrapT = RepeatWrapping;
  }
  return t;
}

function canvasOf(w, h, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  const pixels = new Uint32Array(w * h);
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) pixels[y * w + x] = paint(x, y);
  g.putImageData(new ImageData(new Uint8ClampedArray(pixels.buffer), w, h), 0, 0);
  return canvas;
}

/** El suelo del decorador, pintado una sola vez para toda la habitación: no hay baldosa que se repita. */
export function floorTexture(suelo) {
  const r = probe();
  const w = ROOM.w * FLOOR_PX;
  const h = ROOM.d * FLOOR_PX;
  return texture(canvasOf(w, h, (x, y) => floorColor(r, suelo, x / FLOOR_PX, y / FLOOR_PX, x, y)));
}

/** Veta discreta para el tablero de una mesa: dos tonos de su propia rampa, a lo largo de la pieza. */
export function grainTexture(tono, seed = 3) {
  const r = probe();
  const ramp = r.rampOf(tono);
  const t = texture(
    canvasOf(192, 96, (x, y) => {
      const long = noise(x * 0.012 + seed, y * 0.16);
      const fine = noise(x * 0.05 + seed * 3, y * 0.7);
      // El canto del tablero, un tono más oscuro: separa la mesa del suelo de madera que queda detrás
      if (y < 3 || x < 2 || x >= 190) return ramp[1];
      return ramp[(long - 0.5) * 1.5 + (fine - 0.5) * 0.7 + (r.bayerAt(x, y) - 0.5) * 0.2 > 0.22 ? 3 : 2];
    }),
  );
  return t;
}

/**
 * La luz de la lámpara sobre una pared, con la fórmula de la tarde de `evening` (render.js): el tono del catálogo, por una
 * luz que va del malva de la habitación a la calidez junto a la lámpara. Va por bandas, y el tramado Bayer solo cubre el
 * paso de una banda a otra. Mismos píxeles por celda que el suelo, y pegados a la pared: no bailan al girar.
 * `lights`: [{ s, z, depth }] en celdas, a lo largo de la pared, en altura y separada de ella.
 */
export function wallTexture(tono, { w, h, lights, hora, warmth = 0, panes = [] }) {
  const r = probe();
  const ramp = r.rampOf(tono);
  const BANDS = 5;
  const BLEND = 0.2;
  // Cuánta luz lleva cada banda: las de fuera, más cerca entre sí para que el halo se funda con el malva
  const WARMTH = [0, 0.12, 0.28, 0.56, 0.8, 1];
  const size = [w * FLOOR_PX, Math.round(h * FLOOR_PX)];
  const canvas = canvasOf(size[0], size[1], (x, y) => {
    const s = (x + 0.5) / FLOOR_PX;
    const z = h - (y + 0.5) / FLOOR_PX;
    let g = 0;
    for (const l of lights) {
      // De noche, un halo algo mayor alrededor de la lámpara; lejos de ella, la pared sigue en penumbra
      const reach = (2.25 + l.depth * 0.26) * (hora === 'noche' ? 1.2 : 1);
      const d = Math.hypot(s - l.s, (z - l.z) * 1.12) / reach;
      if (d < 1) g += (1 - d) ** 1.7 * Math.max(0.15, 1 - l.depth * 0.1);
    }
    g = Math.min(1, g);
    const band = Math.max(0, Math.min(BANDS, Math.floor(g * BANDS + 0.5 + (r.bayerAt(x, y) - 0.5) * BLEND)));
    const k = WARMTH[band];
    // Lo más alejado de la luz, junto al techo, un tono por debajo: da cuerpo a la pared sin añadir nada
    const top = band === 0 && z + (r.bayerAt(x, y) - 0.5) * 0.06 > h - 0.36;
    // Enlucido a mano: zonas amplias e irregulares que nunca se repiten, siempre en el color elegido
    const jitter = r.bayerAt(x, y) - 0.5;
    const plaster = noise(s * 0.55 + w * 3, z * 0.8 + 7) * 0.62 + noise(s * 2.1 + 11, z * 1.5 + w) * 0.38 + jitter * 0.05;
    const patch = plaster < 0.38 ? 0.972 : plaster < 0.6 ? 0.99 : 1;
    // Sombra de las uniones: rodapié, cornisa, esquinas y alrededor del marco de la ventana, tramada solo en su borde
    const foot = z + jitter * 0.08 < 0.42 ? 0.95 : 1;
    const crown = z + jitter * 0.08 > h - 0.2 ? 0.88 : z + jitter * 0.12 > h - 0.46 ? 0.94 : 1;
    const corner = Math.min(s, w - s) + jitter * 0.08;
    const seam = corner < 0.12 ? 0.88 : corner < 0.3 ? 0.94 : 1;
    const around = panes.some((p) => {
      const out = Math.max(p.a + 0.02 - s, s - p.a - 1.98, 1.3 - z, z - 3.38) + jitter * 0.05;
      return out > 0 && out < 0.1;
    })
      ? 0.92
      : 1;
    const shadow = patch * foot * crown * seam * around;
    const tone = multiply(band >= BANDS - 1 ? ramp[4] : top ? ramp[2] : ramp[3], [shadow, shadow, shadow]);
    if (hora === 'dia') return tone;
    if (hora === 'noche') return multiply(tone, [0.29 + warmth * 0.02 + k * 1.0, 0.29 + warmth * 0.01 + k * 0.74, 0.47 - warmth * 0.03 + k * 0.08]);
    return multiply(tone, [0.6 + k * 0.55, 0.56 + k * 0.42, 0.74 + k * 0.06]);
  });
  return texture(canvas);
}

/** Tres paredes como láminas pegadas a las de verdad, con los huecos de sus ventanas: [{ pared, segments, length }]. */
export function wallPlates(walls) {
  const out = {};
  for (const { pared, segments, length, h } of walls) {
    const pos = [];
    const uv = [];
    for (const [s0, s1, z0, z1] of segments) {
      const at = (s, z) => (pared === 'fondo' ? [s, z, 0.002] : pared === 'izq' ? [0.002, z, s] : [ROOM.w - 0.002, z, s]);
      const q = [[s0, z0], [s1, z0], [s1, z1], [s0, z0], [s1, z1], [s0, z1]];
      for (const [s, z] of q) {
        pos.push(...at(s, z));
        uv.push(s / length, z / h);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
    out[pared] = g;
  }
  return out;
}

// La lámpara: lámina pequeña con cada cara a la misma densidad que el suelo. [x, y, ancho, alto] en píxeles
const LAMP_SIZE = 64;
const LAMP = { front: [0, 0, 20, 20], side: [20, 0, 20, 20], top: [40, 0, 14, 20], under: [0, 20, 20, 20], rodFront: [58, 0, 3, 64], rodSide: [61, 0, 3, 64], footTop: [20, 20, 14, 14], footSide: [34, 20, 14, 4] };

/** Los dibujos de la lámpara. `lit`: encendida (tarde y noche), con la rampa cálida con la que la enciende el decorador. */
export function lampTexture(tono, lit) {
  const r = probe();
  const cloth = r.rampOf(tono);
  const glow = r.rampOf(LIT);
  const brass = r.rampOf(LATON);
  const inside = ([x0, y0, w, h], x, y) => x >= x0 && x < x0 + w && y >= y0 && y < y0 + h;
  const bayer = (x, y) => (r.bayerAt(x, y) - 0.5) * 0.45;
  return texture(
    canvasOf(LAMP_SIZE, LAMP_SIZE, (x, y) => {
      if (inside(LAMP.front, x, y) || inside(LAMP.side, x, y)) {
        const front = inside(LAMP.front, x, y);
        const [x0] = front ? LAMP.front : LAMP.side;
        // El borde inferior, siempre en sombra: dos filas de la tela apagada
        if (y >= 18) return y === 19 ? cloth[0] : cloth[1];
        const u = Math.abs((x - x0 + 0.5) / 20 - 0.5) * 2;
        const v = (y + 0.5) / 18;
        // Más clara abajo, de donde sale la luz, y apagada hacia los cantos
        const band = (v > 0.34 ? 0.55 : 0) + (v > 0.66 ? 0.45 : 0) - (u > 0.86 ? 0.55 : 0);
        if (!lit) return cloth[clampTone((front ? 2.9 : 1.4) + band * 0.5 + bayer(x, y))];
        return glow[clampTone((front ? 2.9 : 1.7) + band)];
      }
      if (inside(LAMP.top, x, y)) return lit ? glow[4] : cloth[4];
      if (inside(LAMP.under, x, y)) {
        const u = Math.abs((x + 0.5) / 20 - 0.5) * 2;
        const v = Math.abs((y - 20 + 0.5) / 20 - 0.5) * 2;
        const rim = Math.max(u, v);
        if (rim > 0.8) return cloth[0];
        return lit ? glow[clampTone(4.6 - rim * 3 + bayer(x, y))] : cloth[1];
      }
      // La varilla: un filo claro, su cuerpo y motas oscuras cada pocos píxeles, como en el catálogo
      if (inside(LAMP.rodFront, x, y)) return x === 58 ? brass[3] : x === 60 && y % 11 === 4 ? brass[0] : brass[2];
      if (inside(LAMP.rodSide, x, y)) return y % 13 === 6 ? brass[0] : brass[1];
      if (inside(LAMP.footTop, x, y)) {
        const u = Math.abs((x - 20 + 0.5) / 14 - 0.5) * 2;
        const v = Math.abs((y - 20 + 0.5) / 14 - 0.5) * 2;
        return brass[clampTone(3.9 - Math.max(u, v) * 1.5 + bayer(x, y))];
      }
      if (inside(LAMP.footSide, x, y)) return brass[y === 23 ? 0 : 1];
      return cloth[1];
    }),
  );
}

/** Una caja con cada cara apuntando a su dibujo. El giro la recoloca: `front` es lo que mira a lo hondo de la habitación. */
function lampBox([x0, y0, z0, x1, y1, z1], faces, out) {
  const quads = [
    [[x0, z0, y1], [x1, z0, y1], [x1, z1, y1], [x0, z1, y1], faces.front],
    [[x1, z0, y0], [x0, z0, y0], [x0, z1, y0], [x1, z1, y0], faces.front],
    [[x1, z0, y1], [x1, z0, y0], [x1, z1, y0], [x1, z1, y1], faces.side],
    [[x0, z0, y0], [x0, z0, y1], [x0, z1, y1], [x0, z1, y0], faces.side],
    [[x0, z1, y1], [x1, z1, y1], [x1, z1, y0], [x0, z1, y0], faces.top],
    [[x0, z0, y0], [x1, z0, y0], [x1, z0, y1], [x0, z0, y1], faces.under],
  ];
  for (const [a, b, c, d, [rx, ry, rw, rh]] of quads) {
    // Sin llegar al filo de cada dibujo: así no se cuela el de al lado
    const u0 = (rx + 0.2) / LAMP_SIZE;
    const u1 = (rx + rw - 0.2) / LAMP_SIZE;
    const v0 = 1 - (ry + rh - 0.2) / LAMP_SIZE;
    const v1 = 1 - (ry + 0.2) / LAMP_SIZE;
    const uv = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
    for (const k of [0, 1, 2, 0, 2, 3]) {
      out.pos.push(...[a, b, c, d][k]);
      out.uv.push(...uv[k]);
    }
  }
}

/** La lámpara de pie, con las medidas de furniture.js: pie y varilla de latón (grupo 0) y pantalla (grupo 1). */
export function pixelLamp(place) {
  const body = { pos: [], uv: [] };
  const shadeBox = { pos: [], uv: [] };
  lampBox(place([0.3, 0.3, 0, 0.7, 0.7, 0.1]), { front: LAMP.footSide, side: LAMP.footSide, top: LAMP.footTop, under: LAMP.footSide }, body);
  lampBox(place([0.46, 0.46, 0.1, 0.54, 0.54, 2.2]), { front: LAMP.rodFront, side: LAMP.rodSide, top: LAMP.rodSide, under: LAMP.rodSide }, body);
  lampBox(place([0.2, 0.2, 2.2, 0.8, 0.8, 2.8]), { front: LAMP.front, side: LAMP.side, top: LAMP.top, under: LAMP.under }, shadeBox);
  const g = new BufferGeometry();
  const count = body.pos.length / 3;
  g.setAttribute('position', new Float32BufferAttribute([...body.pos, ...shadeBox.pos], 3));
  g.setAttribute('uv', new Float32BufferAttribute([...body.uv, ...shadeBox.uv], 2));
  g.addGroup(0, count, 0);
  g.addGroup(count, shadeBox.pos.length / 3, 1);
  return g;
}

// La estantería: las medidas de `bookcase` (furniture.js) y un dibujo por cara, a la misma densidad que el suelo
const SHELF_SIZE = 256;
const SHELF = { back: [0, 0, 64, 109], innerL: [64, 0, 28, 109], innerR: [92, 0, 28, 109], outerL: [120, 0, 32, 109], outerR: [152, 0, 32, 109], frontL: [184, 0, 5, 109], frontR: [190, 0, 5, 109], cap: [196, 0, 5, 32], canto: [0, 112, 56, 5], board: [0, 118, 56, 5], top: [60, 112, 56, 28], under: [118, 112, 56, 28] };
const BOARDS = [0, 1.1, 2.2, 3.26];
const BOARD_THICK = 0.14;
const SHELF_H = 3.4;
/** La balda a la altura de la lámpara: su tablón asoma un poco para que el canto se lea como una pieza aparte. */
export const BALDA = { z0: 2.2, z1: 2.34, ceiling: 3.26, x0: 0.14, x1: 1.86, front: 1.03 };

/**
 * La madera de la estantería, con la rampa del catálogo. Tablón con canto de tres tonos, sombra bajo la balda y, si
 * `lit`, un reflejo cálido por bandas en el lateral que da a cada lámpara. `lights`: [{ x, y, z }] en coordenadas del mueble.
 */
export function shelfTexture(tono, { lights, lit }) {
  const r = probe();
  const ramp = r.rampOf(tono);
  const warm = r.rampOf([Math.min(255, tono[0] * 1.16), tono[1] * 1.02, tono[2] * 0.84]);
  const inside = ([x0, y0, w, h], x, y) => x >= x0 && x < x0 + w && y >= y0 && y < y0 + h;
  const dither = (x, y, amount) => (r.bayerAt(x, y) - 0.5) * amount;
  const wood = (along, across, base, x, y) => clampTone(base + (noise(along * 0.012 + 3, across * 0.16) - 0.5) * 0.7 + (noise(along * 0.05 + 9, across * 0.7) - 0.5) * 0.32 + dither(x, y, 0.08));
  // La sombra que cae bajo cada tablón: mucho más marcada bajo la balda de la lámpara
  const hollow = (z, x, y) => {
    let dark = 0;
    for (const board of BOARDS) {
      const under = board - z + dither(x, y, 0.05);
      if (under > 0 && under < 0.42) dark = Math.max(dark, 1.5 * (under < 0.12 ? 1 : under < 0.26 ? 0.62 : 0.3));
      // Contacto: una línea oscura donde el fondo se apoya en el tablón de abajo
      const above = z - (board + BOARD_THICK);
      if (above >= 0 && above < 0.07) dark = Math.max(dark, 0.9);
    }
    return dark;
  };
  // El reflejo en un lateral: `side` es 1 si mira hacia x creciente; siempre discreto, sin pasar del tono medio
  const glowAt = (side, ly, z) => {
    if (!lit) return 0;
    let g = 0;
    for (const l of lights) {
      const depth = side > 0 ? l.x - 2 : -l.x;
      if (depth <= 0) continue;
      const d = Math.hypot(ly - l.y, z - l.z) / 1.45;
      if (d < 1) g += (1 - d) ** 1.7 * Math.max(0.2, 1 - depth * 0.25);
    }
    return Math.min(1, g);
  };
  const lamp = lights.some((l) => l.x > 2) ? 1 : lights.some((l) => l.x < 0) ? -1 : 0;
  const outer = (region, side, x, y) => {
    const [x0, , w, h] = region;
    const across = (x - x0 + 0.5) / w;
    const ly = side > 0 ? 1 - across : across;
    const z = SHELF_H * (1 - (y + 0.5) / h);
    const band = Math.floor(glowAt(side, ly, z) * 4 + 0.5 + dither(x, y, 0.2)) / 4;
    const tone = wood(y, x, 1.5 + band * 1.25, x, y);
    return band > 0 ? warm[tone] : ramp[tone];
  };
  return texture(
    canvasOf(SHELF_SIZE, SHELF_SIZE, (x, y) => {
      const z = SHELF_H * (1 - (y + 0.5) / 109);
      if (inside(SHELF.back, x, y)) {
        // Contacto con los laterales: el fondo oscurece junto a ellos
        const corner = x >= 5 && x <= 7 ? 0.8 : x >= 56 && x <= 58 ? 0.8 : 0;
        return ramp[wood(y, x, 1.35 - Math.max(corner, hollow(z, x, y)), x, y)];
      }
      if (inside(SHELF.innerL, x, y) || inside(SHELF.innerR, x, y)) {
        const left = inside(SHELF.innerL, x, y);
        const region = left ? SHELF.innerL : SHELF.innerR;
        const deep = left ? 1 - (x - region[0] + 0.5) / region[2] : (x - region[0] + 0.5) / region[2];
        return ramp[wood(y, x, (left ? 1.75 : 1.4) - Math.max(deep > 0.84 ? 0.8 : 0, hollow(z, x, y)), x, y)];
      }
      if (inside(SHELF.outerL, x, y)) return outer(SHELF.outerL, -1, x, y);
      if (inside(SHELF.outerR, x, y)) return outer(SHELF.outerR, 1, x, y);
      if (inside(SHELF.frontL, x, y) || inside(SHELF.frontR, x, y)) {
        const right = inside(SHELF.frontR, x, y);
        // Solo el filo que da a la lámpara coge algo de su luz
        const rim = right ? x === SHELF.frontR[0] + 4 && glowAt(1, 1, z) > 0.2 : x === SHELF.frontL[0] && glowAt(-1, 1, z) > 0.2;
        return rim ? warm[3] : ramp[wood(y, x, 2.4, x, y)];
      }
      if (inside(SHELF.canto, x, y)) {
        const row = y - SHELF.canto[1];
        const toLamp = lit && lamp ? Math.max(0, lamp > 0 ? (x + 0.5) / SHELF.canto[2] - 0.74 : 0.26 - (x + 0.5) / SHELF.canto[2]) : 0;
        // Filo claro arriba, cuerpo con veta y sombra abajo: se lee el grosor del tablón
        if (row === 0) return (toLamp > 0 ? warm : ramp)[4];
        if (row === 4) return ramp[0];
        const tone = wood(x, y * 3, row === 3 ? 1.9 : 2.8, x, y);
        return (toLamp > 0.06 ? warm : ramp)[tone];
      }
      if (inside(SHELF.board, x, y)) {
        const row = y - SHELF.board[1];
        // Mismo canto de tres tonos que la balda de la lámpara, sin su luz: las baldas se separan bien del fondo oscuro
        if (row === 0) return ramp[4];
        if (row === 4) return ramp[0];
        return ramp[wood(x, y * 3, row === 3 ? 1.9 : 2.8, x, y)];
      }
      if (inside(SHELF.top, x, y)) {
        // El tablón por arriba: se apaga hacia el fondo y junto a los laterales, donde apoya
        const row = y - SHELF.top[1];
        const edge = x - SHELF.top[0];
        const rear = row < 5 ? 1.1 : row < 9 ? 0.5 : 0;
        const side = edge < 2 || edge >= SHELF.top[2] - 2 ? 0.7 : 0;
        return ramp[wood(edge, y, 3.2 - Math.max(rear, side), x, y)];
      }
      if (inside(SHELF.under, x, y)) return ramp[wood(x - SHELF.under[0], y, 0.5, x, y)];
      if (inside(SHELF.cap, x, y)) return ramp[wood(y, x, 3, x, y)];
      return ramp[1];
    }),
  );
}

/** El armazón de la estantería, sin los libros. `place(box)` lo coloca como `toWorld` de render.js. */
export function woodShelf(place) {
  const out = { pos: [], uv: [] };
  const P = (x, y, z) => {
    const [a, b] = place([x, y, 0, x, y, 0]);
    return [a, z, b];
  };
  const box = ([x0, y0, z0, x1, y1, z1], faces) => {
    const quads = {
      front: [P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)],
      right: [P(x1, y1, z0), P(x1, y0, z0), P(x1, y0, z1), P(x1, y1, z1)],
      left: [P(x0, y0, z0), P(x0, y1, z0), P(x0, y1, z1), P(x0, y0, z1)],
      top: [P(x0, y1, z1), P(x1, y1, z1), P(x1, y0, z1), P(x0, y0, z1)],
      under: [P(x0, y0, z0), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0)],
    };
    for (const [name, [rx, ry, rw, rh]] of Object.entries(faces)) {
      const u0 = (rx + 0.2) / SHELF_SIZE;
      const u1 = (rx + rw - 0.2) / SHELF_SIZE;
      const v0 = 1 - (ry + rh - 0.2) / SHELF_SIZE;
      const v1 = 1 - (ry + 0.2) / SHELF_SIZE;
      const uv = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
      for (const k of [0, 1, 2, 0, 2, 3]) {
        out.pos.push(...quads[name][k]);
        out.uv.push(...uv[k]);
      }
    }
  };
  box([0, 0, 0, 2, 0.14, SHELF_H], { front: SHELF.back, top: SHELF.cap });
  box([0, 0, 0, 0.14, 1, SHELF_H], { front: SHELF.frontL, left: SHELF.outerL, right: SHELF.innerL, top: SHELF.cap });
  box([1.86, 0, 0, 2, 1, SHELF_H], { front: SHELF.frontR, right: SHELF.outerR, left: SHELF.innerR, top: SHELF.cap });
  for (const z of BOARDS) {
    const isBalda = z === BALDA.z0;
    box([0.14, 0.14, z, 1.86, BALDA.front, z + BOARD_THICK], { front: isBalda ? SHELF.canto : SHELF.board, top: SHELF.top, under: SHELF.under });
  }
  // Zócalo entre los laterales y moldura de remate: se lee como mueble apoyado y con unión, sin cambiar su medida
  box([0.14, 0.9, 0, 1.86, 1.02, 0.14], { front: SHELF.canto });
  box([-0.03, 0.1, SHELF_H - 0.12, 0, 1.04, SHELF_H], { left: SHELF.cap, front: SHELF.cap, top: SHELF.cap });
  box([2, 0.1, SHELF_H - 0.12, 2.03, 1.04, SHELF_H], { right: SHELF.cap, front: SHELF.cap, top: SHELF.cap });
  box([-0.03, 1, SHELF_H - 0.12, 2.03, 1.04, SHELF_H], { front: SHELF.canto, top: SHELF.cap, under: SHELF.under });
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(out.pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(out.uv, 2));
  return g;
}

// La ventana: las medidas de `ventana` (furniture.js) y un dibujo por cara, a la misma densidad que el suelo y la estantería
const WIN_SIZE = 128;
const WIN = { frontV: [0, 0, 5, 60], revealL: [6, 0, 10, 60], revealR: [17, 0, 10, 60], frontH: [28, 0, 58, 5], revealTop: [28, 6, 58, 10], revealBottom: [28, 17, 58, 10], sillTop: [28, 28, 64, 13], sillCanto: [28, 42, 64, 5], under: [28, 48, 64, 13], bar: [94, 0, 3, 56], barSide: [98, 0, 3, 56], rail: [28, 62, 54, 3], iron: [104, 0, 8, 8], brass: [114, 0, 8, 8] };
/** El marco atraviesa la pared hacia fuera y sobresale hacia dentro: de ahí sale su grosor. */
const WIN_OUT = -0.14;
const WIN_IN = 0.14;

/**
 * La madera de la ventana, con la rampa del catálogo. El marco tiene canto claro y veta; por dentro del hueco se oscurece hacia la
 * habitación y coge luz de la calle en el filo de fuera; el alféizar lleva la sombra de contacto del marco y un canto de tres
 * tonos, como las baldas. Si `lit`, un reflejo cálido en el lado de la lámpara. `lamp`: -1 a la izquierda, 1 a la derecha, 0 ninguna.
 */
export function windowTexture(tono, { lamp, lit }) {
  const r = probe();
  const ramp = r.rampOf(tono);
  const iron = r.rampOf(HIERRO);
  const brass = r.rampOf(LATON);
  const metal = (kind, [, y0, , h], y) => kind[y === y0 ? 4 : y === y0 + h - 1 ? 0 : 2];
  const warm = r.rampOf([Math.min(255, tono[0] * 1.16), tono[1] * 1.02, tono[2] * 0.84]);
  const inside = ([x0, y0, w, h], x, y) => x >= x0 && x < x0 + w && y >= y0 && y < y0 + h;
  const dither = (x, y, amount) => (r.bayerAt(x, y) - 0.5) * amount;
  const wood = (along, across, base, x, y) => clampTone(base + (noise(along * 0.012 + 5, across * 0.16) - 0.5) * 0.7 + (noise(along * 0.05 + 2, across * 0.7) - 0.5) * 0.32 + dither(x, y, 0.08));
  const toLamp = (u) => (lit && lamp ? Math.max(0, lamp > 0 ? u - 0.7 : 0.3 - u) : 0);
  // Por dentro del hueco: `out` es 1 en el filo que da a la calle y 0 en el que da a la habitación
  const reveal = (out, along, across, x, y, base = 1.1) => (out > 0.86 ? ramp[3] : ramp[wood(along, across, base + out * 0.8, x, y)]);
  return texture(
    canvasOf(WIN_SIZE, WIN_SIZE, (x, y) => {
      if (inside(WIN.iron, x, y)) return metal(iron, WIN.iron, y);
      if (inside(WIN.brass, x, y)) return metal(brass, WIN.brass, y);
      if (inside(WIN.frontV, x, y)) {
        const lx = x - WIN.frontV[0];
        // Las uniones de los ingletes, arriba y abajo
        if (y === 0 || y === WIN.frontV[3] - 1) return ramp[1];
        if (lx === 0) return ramp[1];
        if (lx === WIN.frontV[2] - 1) return ramp[4];
        return ramp[wood(y, x, 2.6, x, y)];
      }
      if (inside(WIN.revealL, x, y)) {
        const out = 1 - (x - WIN.revealL[0] + 0.5) / WIN.revealL[2];
        // El de la izquierda mira hacia la derecha: si la lámpara está a ese lado, le llega su luz
        if (lit && lamp > 0 && out < 0.5) return warm[wood(y, x, 2.1, x, y)];
        return reveal(out, y, x, x, y);
      }
      if (inside(WIN.revealR, x, y)) {
        const out = (x - WIN.revealR[0] + 0.5) / WIN.revealR[2];
        if (lit && lamp < 0 && out < 0.5) return warm[wood(y, x, 2.1, x, y)];
        return reveal(out, y, x, x, y);
      }
      if (inside(WIN.frontH, x, y)) {
        const row = y - WIN.frontH[1];
        const u = (x - WIN.frontH[0] + 0.5) / WIN.frontH[2];
        if (x === WIN.frontH[0] || x === WIN.frontH[0] + WIN.frontH[2] - 1) return ramp[1];
        if (row === 0) return ramp[4];
        if (row === WIN.frontH[3] - 1) return ramp[0];
        return (toLamp(u) > 0.06 ? warm : ramp)[wood(x, y * 3, 2.7, x, y)];
      }
      if (inside(WIN.revealTop, x, y)) return reveal((y - WIN.revealTop[1] + 0.5) / WIN.revealTop[3], x, y, x, y, 0.5);
      if (inside(WIN.revealBottom, x, y)) return reveal(1 - (y - WIN.revealBottom[1] + 0.5) / WIN.revealBottom[3], x, y, x, y, 2);
      if (inside(WIN.sillTop, x, y)) {
        // La primera fila, en la pared; la sombra de contacto del marco, tramada solo en su borde
        const row = y - WIN.sillTop[1];
        const u = (x - WIN.sillTop[0] + 0.5) / WIN.sillTop[2];
        const shadow = row < 5 ? 1.5 : row < 7 ? (r.bayerAt(x, y) < 0.5 ? 1.5 : 0.4) : 0;
        const tone = wood(x, y, 3.2 - shadow, x, y);
        return (toLamp(u) > 0.04 && !shadow ? warm : ramp)[tone];
      }
      if (inside(WIN.sillCanto, x, y)) {
        const row = y - WIN.sillCanto[1];
        const u = (x - WIN.sillCanto[0] + 0.5) / WIN.sillCanto[2];
        if (row === 0) return (toLamp(u) > 0 ? warm : ramp)[4];
        if (row === WIN.sillCanto[3] - 1) return ramp[0];
        return (toLamp(u) > 0.06 ? warm : ramp)[wood(x, y * 3, row === 3 ? 1.9 : 2.8, x, y)];
      }
      if (inside(WIN.under, x, y)) return ramp[wood(x, y, 0.5, x, y)];
      if (inside(WIN.bar, x, y)) return x === WIN.bar[0] ? ramp[3] : x === WIN.bar[0] + 2 ? ramp[1] : ramp[wood(y, x, 2.4, x, y)];
      if (inside(WIN.barSide, x, y)) return ramp[wood(y, x, 1.2, x, y)];
      if (inside(WIN.rail, x, y)) {
        const row = y - WIN.rail[1];
        return row === 0 ? ramp[3] : row === 2 ? ramp[1] : ramp[wood(x, y, 2.4, x, y)];
      }
      return ramp[1];
    }),
  );
}

/**
 * El marco y el alféizar, con su grosor. `place(a, b)` pasa de coordenadas de la pieza a las de la habitación. El parteluz y el
 * travesaño quedan a media profundidad, en el plano del cristal. Sus caras se ven por los dos lados, porque en la otra pared se reflejan.
 */
export function pixelWindow(place) {
  const out = { pos: [], uv: [] };
  const box = ([x0, y0, z0, x1, y1, z1], faces) => {
    const quads = {
      front: [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]],
      right: [[x1, y1, z0], [x1, y0, z0], [x1, y0, z1], [x1, y1, z1]],
      left: [[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]],
      top: [[x0, y1, z1], [x1, y1, z1], [x1, y0, z1], [x0, y0, z1]],
      under: [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]],
    };
    for (const [name, [rx, ry, rw, rh]] of Object.entries(faces)) {
      const u0 = (rx + 0.2) / WIN_SIZE;
      const u1 = (rx + rw - 0.2) / WIN_SIZE;
      const v0 = 1 - (ry + rh - 0.2) / WIN_SIZE;
      const v1 = 1 - (ry + 0.2) / WIN_SIZE;
      const uv = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
      for (const k of [0, 1, 2, 0, 2, 3]) {
        const [a, b, c] = quads[name][k];
        const [wx, wy] = place(a, b);
        out.pos.push(wx, c, wy);
        out.uv.push(...uv[k]);
      }
    }
  };
  box([0.12, WIN_OUT, 1.42, 0.24, WIN_IN, 3.28], { front: WIN.frontV, right: WIN.revealL, left: WIN.barSide });
  box([1.76, WIN_OUT, 1.42, 1.88, WIN_IN, 3.28], { front: WIN.frontV, left: WIN.revealR, right: WIN.barSide });
  box([0.24, WIN_OUT, 3.16, 1.76, WIN_IN, 3.28], { front: WIN.frontH, under: WIN.revealTop });
  box([0.24, WIN_OUT, 1.42, 1.76, WIN_IN, 1.54], { front: WIN.frontH, top: WIN.revealBottom });
  box([0.96, -0.08, 1.54, 1.04, 0.03, 3.16], { front: WIN.bar, left: WIN.barSide, right: WIN.barSide });
  box([0.24, -0.08, 2.62, 1.76, 0.03, 2.68], { front: WIN.rail, top: WIN.rail, under: WIN.rail });
  // Tapajuntas alrededor del marco, a ras de pared: el marco queda encajado y no pegado encima
  box([0.02, WIN_IN, 1.42, 0.12, WIN_IN + 0.03, 3.38], { front: WIN.frontV, left: WIN.barSide, right: WIN.barSide });
  box([1.88, WIN_IN, 1.42, 1.98, WIN_IN + 0.03, 3.38], { front: WIN.frontV, left: WIN.barSide, right: WIN.barSide });
  box([0.02, WIN_IN, 3.28, 1.98, WIN_IN + 0.03, 3.38], { front: WIN.frontH, under: WIN.revealTop, top: WIN.frontH });
  // El alféizar asoma hacia ti, con su canto y una ménsula debajo
  box([0.02, 0, 1.3, 1.98, 0.38, 1.42], { front: WIN.sillCanto, left: WIN.sillCanto, right: WIN.sillCanto, top: WIN.sillTop, under: WIN.under });
  box([0.16, 0, 1.2, 1.84, 0.07, 1.3], { front: WIN.frontH, under: WIN.under });
  // La hoja dentro del marco: un plano más hondo, que da profundidad al hueco
  const stile = { front: WIN.bar, left: WIN.barSide, right: WIN.barSide };
  const rail = { front: WIN.rail, top: WIN.rail, under: WIN.rail };
  box([0.24, -0.1, 1.54, 0.31, 0.02, 3.16], stile);
  box([1.69, -0.1, 1.54, 1.76, 0.02, 3.16], stile);
  box([0.31, -0.1, 3.09, 1.69, 0.02, 3.16], rail);
  box([0.31, -0.1, 1.54, 1.69, 0.02, 1.61], rail);
  // Moldura escalonada exterior del tapajuntas y ménsulas de dos piezas bajo el alféizar
  const band = { front: WIN.barSide, left: WIN.barSide, right: WIN.barSide };
  box([0.02, WIN_IN + 0.03, 1.42, 0.06, WIN_IN + 0.05, 3.38], band);
  box([1.94, WIN_IN + 0.03, 1.42, 1.98, WIN_IN + 0.05, 3.38], band);
  box([0.06, WIN_IN + 0.03, 3.34, 1.94, WIN_IN + 0.05, 3.38], { front: WIN.rail, under: WIN.rail });
  for (const x of [0.2, 1.66]) {
    box([x, 0, 1.12, x + 0.14, 0.3, 1.3], { front: WIN.frontV, left: WIN.barSide, right: WIN.barSide, under: WIN.under });
    box([x + 0.02, 0, 1.0, x + 0.12, 0.17, 1.12], { front: WIN.frontV, left: WIN.barSide, right: WIN.barSide, under: WIN.under });
  }
  // Herrajes: dos bisagras por lado y la falleba en el parteluz
  const iron = { front: WIN.iron, left: WIN.iron, right: WIN.iron, top: WIN.iron, under: WIN.iron };
  const brass = { front: WIN.brass, left: WIN.brass, right: WIN.brass, top: WIN.brass, under: WIN.brass };
  for (const z of [1.86, 2.72]) {
    box([0.19, WIN_IN, z, 0.27, WIN_IN + 0.016, z + 0.16], iron);
    box([1.73, WIN_IN, z, 1.81, WIN_IN + 0.016, z + 0.16], iron);
  }
  box([0.93, 0.03, 2.2, 1.07, 0.07, 2.3], brass);
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(out.pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(out.uv, 2));
  return g;
}

/** La sombra del alféizar sobre la pared: tramado corto, solo pegado a la pieza. */
export function sillShadowTexture() {
  const r = probe();
  const DARK = 0x58100806;
  return texture(canvasOf(64, 14, (x, y) => (y < 3 ? DARK : y < 7 && r.bayerAt(x, y) < 1 - (y - 2) / 5 ? DARK : 0)));
}

/** La sombra de la balda sobre lo que hay debajo: tramado suelto que se aclara al bajar, sin degradados. */
export function baldaShadowTexture() {
  const r = probe();
  const w = 56;
  const h = 12;
  const canvas = canvasOf(w, h, (x, y) => {
    if (y < 4) return 0x8c100806;
    if (y < 6) return r.bayerAt(x, y) < 0.5 ? 0x8c100806 : 0;
    return 0;
  });
  return texture(canvas);
}

/** La sombra del mueble en el suelo: tramado corto y solo junto a su base. El suelo, debajo, sigue siendo el mismo. */
export function footShadowTexture(w, d, margin, px = FLOOR_PX) {
  const r = probe();
  const W = Math.round((w + margin * 2) * px);
  const H = Math.round((d + margin * 2) * px);
  const edge = margin * px;
  const DARK = 0x78100806;
  return texture(
    canvasOf(W, H, (x, y) => {
      const out = Math.max(edge - x - 0.5, x + 0.5 - (W - edge), edge - y - 0.5, y + 0.5 - (H - edge));
      if (out <= 0) return DARK;
      return r.bayerAt(x, y) < 1 - out / edge ? DARK : 0;
    }),
  );
}

// Una celda del atlas de lomos: el lomo, su canto de color y, al final, las páginas
const SPINE_W = 28;
const SPINE_H = 128;
const SPINE_CELL = 32;
const SPINE_COLS = 12;

/**
 * El título que se puede pintar, en una sola línea a lo largo del lomo: píxeles sueltos, sin suavizado. Con `author`
 * (1.88), el apellido va abajo, más pequeño, como en un lomo de verdad; si no cabe, solo el título.
 */
function titleMask(title, w, h, author = '') {
  const room = h - 28;
  const canvas = document.createElement('canvas');
  canvas.width = room;
  canvas.height = w;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  const surname = String(author ?? '').split(/[,;&]| y /)[0].trim().split(/\s+/).pop() ?? '';
  g.font = 'bold 10px Georgia, serif';
  const byline = surname && g.measureText(surname).width <= room * 0.34 ? surname : '';
  const bylineW = byline ? Math.ceil(g.measureText(byline).width) + 8 : 0;
  const titleRoom = room - bylineW;
  let text = String(title);
  let size = 13;
  const fit = () => {
    g.font = `bold ${size}px Georgia, serif`;
    return g.measureText(text).width <= titleRoom;
  };
  while (!fit() && size > 10) size -= 1;
  // Si aun así no cabe, se corta por palabras: mejor un título corto que letras que no se leen
  while (!fit() && text.includes(' ')) text = text.slice(0, text.lastIndexOf(' '));
  g.textBaseline = 'middle';
  g.textAlign = 'center';
  g.fillText(text, titleRoom / 2, w / 2 + 0.5, titleRoom);
  if (byline) {
    g.font = 'bold 10px Georgia, serif';
    g.textAlign = 'right';
    g.fillText(byline, room - 1, w / 2 + 0.5);
  }
  const { data } = g.getImageData(0, 0, room, w);
  // A lo largo del lomo, de arriba abajo
  return (x, y) => {
    const mx = y - 14;
    const my = w - 1 - x;
    if (mx < 0 || mx >= room || my < 0 || my >= w) return false;
    return data[(my * room + mx) * 4 + 3] > 120;
  };
}

function spineTone(color, id) {
  const value = new Color(color).getHex();
  let hash = 7;
  for (const ch of String(id)) hash = (hash * 31 + ch.charCodeAt(0)) % 1009;
  const light = 0.84 + ((hash % 7) / 6) * 0.3;
  const skew = (((hash >> 3) % 5) - 2) * 0.05;
  const channel = (v, k) => Math.max(0, Math.min(255, Math.round(v * light * k)));
  return [channel((value >> 16) & 255, 1 + skew), channel((value >> 8) & 255, 1), channel(value & 255, 1 - skew)];
}

const hexOf = (c) => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;

/**
 * Cada edición tiene su lomo, como en la balda de siempre: lo que los distingue son datos del propio libro. `look` (1.88,
 * spineLooks.js): el lomo real del libro (`pixels`), que se pinta tal cual, o los colores de su portada (`base`, `accent`,
 * `ink`), que sustituyen al color de siempre.
 */
function spinePixel(r, { id, edition, color, ink, look }, mask) {
  if (look?.pixels) {
    const px = look.pixels;
    return (x, y) => {
      const i = (y * SPINE_W + x) * 4;
      return rgb(px[i], px[i + 1], px[i + 2]);
    };
  }
  const ramp = r.rampOf(spineTone(look?.base ? hexOf(look.base) : color, id));
  const gold = r.rampOf([214, 176, 96]);
  // Las bandas del lomo, del segundo color de la portada; el dorado de las ediciones especiales no cambia
  const band = look?.accent ? r.rampOf(look.accent) : gold;
  const cream = r.rampOf([232, 220, 190]);
  // `inkFor` dice qué tinta se lee mejor sobre este lomo: clara u oscura (con portada, la de sus colores)
  const inkTone = (look?.ink ?? ink) === 'light' ? rgb(240, 230, 205) : rgb(44, 32, 30);
  const W = SPINE_W;
  const H = SPINE_H;
  const body = (x) => ramp[x === 0 || x === W - 1 ? 1 : x <= 2 ? 4 : x >= W - 3 ? 2 : 3];
  // Lomo reconstruido (sin imagen propia): los colores de la portada en uno de cinco diseños, fijo para cada libro, para que
  // la balda no sea una fila de lomos iguales. Es un lomo inventado con sus colores, no el de la edición
  let hash = 11;
  for (const ch of String(id)) hash = (hash * 31 + ch.charCodeAt(0)) % 1009;
  const design = hash % 5;
  const rebuilt = (x, y, lettered) => {
    const near = (row, wide = 0) => Math.abs(y - row) <= wide;
    const ink = lettered ? inkTone : null;
    if (design === 1) {
      // Bloque del segundo color arriba, con una raya
      if (y < 20) return near(19) ? ramp[1] : band[x <= 1 || x >= W - 2 ? 1 : 2];
      return ink ?? body(x);
    }
    if (design === 2) {
      // Dos filetes a lo largo
      if (x === 3 || x === W - 4) return band[3];
      return ink ?? body(x);
    }
    if (design === 3) {
      // Pie de otro color, donde va la editorial, y una raya fina arriba
      if (y > H - 24) return near(H - 24) ? ramp[1] : y > H - 12 && x > W / 2 - 4 && x < W / 2 + 3 && y < H - 6 ? ramp[4] : band[2];
      if (near(5)) return band[3];
      return ink ?? body(x);
    }
    if (design === 4) {
      // Filetes dobles arriba y una marca cuadrada abajo
      if (near(7) || near(10) || near(H - 8) || near(H - 11)) return band[3];
      if (y > H - 22 && y < H - 14 && x > W / 2 - 4 && x < W / 2 + 3) return band[2];
      return ink ?? body(x);
    }
    if (near(4, 1) || near(H - 5, 1)) return band[2];
    return ink ?? body(x);
  };
  return (x, y) => {
    const near = (row, wide = 0) => Math.abs(y - row) <= wide;
    const lettered = mask(x, y);
    if (edition === 'leatherbound') {
      if (near(10, 1) || near(H - 11, 1) || near(38, 1) || near(H - 39, 1)) return near(10) || near(H - 11) || near(38) || near(H - 39) ? gold[3] : ramp[1];
      return lettered ? gold[4] : body(x);
    }
    if (edition === 'clothbound') {
      // Tela con una etiqueta de papel: el título, en tinta oscura sobre ella
      if (x >= 4 && x < W - 4 && y >= 12 && y < H - 12) return lettered ? ramp[0] : cream[3];
      return (x + y) % 2 ? body(x) : ramp[2];
    }
    if (edition === 'paperback') {
      if (look?.base) return rebuilt(x, y, lettered);
      if (near(3) || near(H - 4)) return look?.accent ? band[2] : ramp[1];
      return lettered ? inkTone : ramp[x === 0 || x === W - 1 ? 2 : 3];
    }
    if (edition === 'sprayed_edges') {
      if (near(7) || near(11) || near(H - 8) || near(H - 12)) return gold[3];
      return lettered ? gold[4] : body(x);
    }
    if (edition === 'annotated') {
      // Las marcas de colores asoman por un lado
      if (x >= W - 3 && (near(24, 2) || near(52, 2) || near(88, 2))) return near(24, 2) ? 0xff5ac8f0 : near(52, 2) ? 0xff7ab8f5 : 0xff8ad8a0;
      if (near(6) || near(H - 7)) return ramp[1];
      return lettered ? inkTone : body(x);
    }
    if (look?.base) return rebuilt(x, y, lettered);
    if (near(6) || near(H - 7)) return band[2];
    return lettered ? inkTone : body(x);
  };
}

/**
 * Un atlas para todos los lomos de la estantería: una sola textura y un solo material, aunque haya muchos libros.
 * `list`: [{ id, title, author, color, ink, edition, look? }]. Devuelve { texture, size, spine(id), side(id), pages } con
 * recortes en píxeles, y `repaint(looks)` (1.88): vuelve a pintar la misma textura cuando llegan las caras de los lomos
 * (`looks`: Map de id a la cara de spineLooks.js), sin rehacer la estantería.
 */
export function spineAtlas(list) {
  const r = probe();
  const size = [SPINE_COLS * SPINE_CELL, (Math.floor(list.length / SPINE_COLS) + 1) * SPINE_H];
  const slot = new Map(list.map((b, k) => [b.id, [(k % SPINE_COLS) * SPINE_CELL, Math.floor(k / SPINE_COLS) * SPINE_H]]));
  const masks = new Map(list.map((b) => [b.id, titleMask(b.title, SPINE_W, SPINE_H, b.author)]));
  const paper = r.rampOf([222, 206, 170]);
  const pagesAt = [size[0] - SPINE_CELL, size[1] - SPINE_H];
  const paintAll = (looks) => {
    const painters = list.map((b) => {
      const look = looks?.get(b.id) ?? null;
      const tone = look?.base ? hexOf(look.base) : b.color;
      return { at: slot.get(b.id), paint: spinePixel(r, { ...b, look }, masks.get(b.id)), side: r.rampOf(spineTone(tone, b.id))[2] };
    });
    const lookup = new Map(painters.map((p) => [`${p.at[0]},${p.at[1]}`, p]));
    return (x, y) => {
      const cx = x - (x % SPINE_CELL);
      const cy = y - (y % SPINE_H);
      if (cx === pagesAt[0] && cy === pagesAt[1]) return paper[x % 3 === 0 ? 2 : 3];
      const p = lookup.get(`${cx},${cy}`);
      if (!p) return paper[1];
      const lx = x - cx;
      return lx < SPINE_W ? p.paint(lx, y - cy) : p.side;
    };
  };
  const canvas = canvasOf(size[0], size[1], paintAll(null));
  const tex = texture(canvas);
  return {
    texture: tex,
    size,
    spine: (id) => [...slot.get(id), SPINE_W, SPINE_H],
    side: (id) => [slot.get(id)[0] + SPINE_W + 1, slot.get(id)[1] + 2, 2, SPINE_H - 4],
    pages: [...pagesAt, SPINE_CELL, SPINE_H],
    repaint(looks) {
      const fresh = canvasOf(size[0], size[1], paintAll(looks));
      canvas.getContext('2d').drawImage(fresh, 0, 0);
      tex.needsUpdate = true;
    },
  };
}

// La mesa: las medidas de furniture.js y un dibujo por cara, a la densidad del tapizado, porque es lo que tienes más cerca
const TABLE_W = 208;
const TABLE_H = 128;
const TABLE = { top: [0, 0, 176, 80], canto: [0, 82, 176, 7], end: [178, 0, 7, 80], leg: [187, 0, 14, 60], under: [0, 91, 176, 20], apron: [0, 112, 176, 12], iron: [180, 84, 8, 8], brass: [190, 84, 8, 8] };

/**
 * La madera de una mesa, con la rampa del catálogo. El tablero son tablas a lo largo, con su junta y un empalme; la veta va a
 * rodales y en tonos vecinos, para que no compita con el libro. Canto de tres tonos, como las baldas. Si `lit`, la luz de las
 * lámparas por bandas. `size`: [ancho, hondo] del tablero. `lights`: [{ x, y, z }] en coordenadas del tablero, a su altura.
 */
export function tableTexture(tono, { size: [boardW, boardD], lights, lit }) {
  const r = probe();
  const ramp = r.rampOf(tono);
  const warm = r.rampOf([Math.min(255, tono[0] * 1.16), tono[1] * 1.02, tono[2] * 0.84]);
  const inside = ([x0, y0, w, h], x, y) => x >= x0 && x < x0 + w && y >= y0 && y < y0 + h;
  const dither = (x, y, amount) => (r.bayerAt(x, y) - 0.5) * amount;
  const [topX, topY, topW, topH] = TABLE.top;
  const iron = r.rampOf(HIERRO);
  const brass = r.rampOf(LATON);
  const metal = (kind, [, y0, , h], y) => kind[y === y0 ? 4 : y === y0 + h - 1 ? 0 : 2];
  const planks = Math.max(2, Math.round(boardD / 0.27));
  const glowAt = (u, v) => {
    if (!lit) return 0;
    let g = 0;
    for (const l of lights) {
      const d = Math.hypot(u * boardW - l.x, v * boardD - l.y, l.z) / 3.4;
      if (d < 1) g += (1 - d) ** 1.6;
    }
    return Math.min(1, g);
  };
  const paintTop = (x, y) => {
    const v = y / topH;
    const row = v * planks;
    const plank = Math.floor(row);
    // Junta entre tablas: una línea oscura y, justo debajo, el filo de la siguiente
    const rowPx = Math.floor((plank / planks) * topH);
    if (plank > 0 && y === rowPx) return ramp[1];
    const joint = Math.floor(((plank * 0.37 + 0.21) % 1) * topW);
    if (plank % 2 === 0 && x === joint) return ramp[1];
    const band = Math.floor(glowAt((x + 0.5) / topW, (y + 0.5) / topH) * 3 + 0.5 + dither(x, y, 0.3)) / 3;
    let tone = 2.72 + ((plank * 5) % 3 - 1) * 0.2 + band * 0.9;
    if (plank > 0 && y === rowPx + 1) tone += 0.5;
    // La veta, a rodales: en cada tabla hay tramos con veta y tramos limpios
    const patch = noise(x * 0.012 + plank * 7.3, plank * 3.1 + 0.5);
    const streak = noise(x * 0.022 + plank * 11, y * 0.62 + plank * 5);
    if (patch > 0.5 && streak > 0.58) tone -= 0.55;
    tone += dither(x, y, 0.06);
    // El borde del tablero: claro en el filo que da a ti, apagado en los otros
    if (y === topH - 1) tone = 4;
    else if (y < 2 || x === 0 || x === topW - 1) tone = Math.min(tone, 1.4);
    return (band > 0 ? warm : ramp)[clampTone(tone)];
  };
  const canto = (x, y, h) => {
    if (y === 0) return ramp[4];
    if (y === h - 1) return ramp[0];
    return ramp[clampTone((y === h - 2 ? 1.9 : 2.7) + (noise(x * 0.03 + 3, y * 0.5) - 0.5) * 0.5 + dither(x, y, 0.06))];
  };
  return texture(
    canvasOf(TABLE_W, TABLE_H, (x, y) => {
      if (inside(TABLE.iron, x, y)) return metal(iron, TABLE.iron, y);
      if (inside(TABLE.brass, x, y)) return metal(brass, TABLE.brass, y);
      if (inside(TABLE.apron, x, y)) {
        const ly = y - TABLE.apron[1];
        // Faldón: la sombra del tablero arriba y un junquillo abajo
        if (ly < 2) return ramp[0];
        if (ly === 2) return ramp[1];
        if (ly === TABLE.apron[3] - 2) return ramp[3];
        if (ly === TABLE.apron[3] - 1) return ramp[0];
        return ramp[clampTone(1.7 + (noise(x * 0.03 + 9, ly * 0.5) - 0.5) * 0.5 + dither(x, y, 0.06))];
      }
      if (inside(TABLE.top, x, y)) return paintTop(x - topX, y - topY);
      if (inside(TABLE.canto, x, y)) return canto(x, y - TABLE.canto[1], TABLE.canto[3]);
      if (inside(TABLE.end, x, y)) return canto(y, x - TABLE.end[0], TABLE.end[2]);
      if (inside(TABLE.leg, x, y)) {
        const lx = x - TABLE.leg[0];
        const ly = y - TABLE.leg[1];
        // Contacto: arriba, la sombra del tablero
        if (ly < 7) return ramp[ly < 3 ? 0 : 1];
        // Las dos clavijas del ensamblaje con el faldón
        if (ly >= 10 && ly < 12 && (lx === 3 || lx === 10)) return ramp[0];
        if (lx === 0) return ramp[3];
        if (lx === TABLE.leg[2] - 1) return ramp[0];
        return ramp[clampTone(1.9 + (noise(lx * 0.5, ly * 0.04) - 0.5) * 0.7 + dither(x, y, 0.06))];
      }
      if (inside(TABLE.under, x, y)) return ramp[clampTone(0.5 + dither(x, y, 0.2))];
      return ramp[1];
    }),
  );
}

/** Caras con su recorte: `turn` gira el recorte un cuarto, para lo que se dibuja a lo largo y se pega de través. */
function quads(out, atlas, P, [x0, y0, z0, x1, y1, z1], faces) {
  const all = {
    front: [P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)],
    back: [P(x1, y0, z0), P(x0, y0, z0), P(x0, y0, z1), P(x1, y0, z1)],
    right: [P(x1, y1, z0), P(x1, y0, z0), P(x1, y0, z1), P(x1, y1, z1)],
    left: [P(x0, y0, z0), P(x0, y1, z0), P(x0, y1, z1), P(x0, y0, z1)],
    top: [P(x0, y1, z1), P(x1, y1, z1), P(x1, y0, z1), P(x0, y0, z1)],
    under: [P(x0, y0, z0), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0)],
  };
  for (const [name, face] of Object.entries(faces)) {
    const [rx, ry, rw, rh] = face.rect ?? face;
    const u0 = (rx + 0.2) / atlas[0];
    const u1 = (rx + rw - 0.2) / atlas[0];
    const v0 = 1 - (ry + rh - 0.2) / atlas[1];
    const v1 = 1 - (ry + 0.2) / atlas[1];
    const uv = face.turn ? [[u0, v1], [u0, v0], [u1, v0], [u1, v1]] : [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
    for (const k of [0, 1, 2, 0, 2, 3]) {
      out.pos.push(...all[name][k]);
      out.uv.push(...uv[k]);
    }
  }
}

/** El frente de los cajones del escritorio: dos cajones con cuarterón rehundido y la placa de latón de su tirador, que va aparte y con volumen. */
export function drawerTexture(tono) {
  const r = probe();
  const ramp = r.rampOf(tono);
  const brass = r.rampOf(LATON);
  const W = 40;
  const H = 56;
  const dither = (x, y, amount) => (r.bayerAt(x, y) - 0.5) * amount;
  return texture(
    canvasOf(W, H, (x, y) => {
      if (x < 2 || x >= W - 2) return ramp[x < 2 ? 3 : 0];
      const row = y % 28;
      if (row < 2) return ramp[0];
      if (row === 2) return ramp[3];
      if (row === 27) return ramp[1];
      if (row >= 11 && row < 17 && x >= 12 && x < 28) return brass[row === 11 ? 3 : row === 16 ? 0 : 1];
      if (row >= 17 && row < 19 && x >= 13 && x < 27) return ramp[1];
      const panel = x >= 5 && x < W - 5 && row >= 6 && row < 24;
      if (panel && (x === 5 || row === 6)) return ramp[1];
      if (panel && (x === W - 6 || row === 23)) return ramp[3];
      return ramp[clampTone((panel ? 2 : 2.5) + (noise(x * 0.04 + y, y * 0.5) - 0.5) * 0.6 + dither(x, y, 0.08))];
    }),
  );
}

// El ordenador: una pantalla pequeña con su escritorio pintado, como el resto del mobiliario
const PC_W = 64;
const PC_H = 64;
const PC = { face: [0, 0, 48, 34], body: [0, 36, 24, 12], keys: [26, 36, 34, 14], foot: [0, 50, 20, 8], stand: [50, 0, 10, 12] };

export function computerTexture(tono, { lit }) {
  const r = probe();
  const ramp = r.rampOf(tono);
  const sea = r.rampOf(lit ? [120, 150, 170] : [96, 150, 170]);
  const sun = r.rampOf([240, 196, 110]);
  const paper = r.rampOf([240, 228, 200]);
  const inside = ([x0, y0, w, h], x, y) => x >= x0 && x < x0 + w && y >= y0 && y < y0 + h;
  const dither = (x, y, amount) => (r.bayerAt(x, y) - 0.5) * amount;
  const screen = (x, y) => {
    // La bahía de fondo, una ventana de papel y el dock abajo
    if (x >= 10 && x < 30 && y >= 4 && y < 16) {
      if (y === 4 || y === 15 || x === 10 || x === 29) return ramp[0];
      if (y === 6) return sea[1];
      return y % 3 === 0 && x > 12 && x < 26 ? paper[1] : paper[4];
    }
    if (y >= 21) return (x + 2) % 6 < 4 && y >= 22 && y < 25 ? sun[3] : sea[0];
    return sea[clampTone(y < 10 ? 3.6 : 2.4 + dither(x, y, 1))];
  };
  return texture(
    canvasOf(PC_W, PC_H, (x, y) => {
      if (inside(PC.face, x, y)) {
        const lx = x - PC.face[0];
        const ly = y - PC.face[1];
        if (ly === 0) return ramp[4];
        if (ly === PC.face[3] - 1 || lx === PC.face[2] - 1) return ramp[1];
        if (lx === 0) return ramp[3];
        if (lx >= 5 && lx < 43 && ly >= 3 && ly < 28) return lx === 5 || ly === 3 ? ramp[0] : screen(lx - 5, ly - 3);
        return ramp[clampTone(2.8 + dither(x, y, 0.1))];
      }
      if (inside(PC.keys, x, y)) {
        const lx = x - PC.keys[0];
        const ly = y - PC.keys[1];
        if (ly === 0 || lx === 0) return ramp[4];
        if (ly === PC.keys[3] - 1) return ramp[0];
        return ly % 3 === 0 || lx % 3 === 0 ? ramp[1] : ramp[3];
      }
      if (inside(PC.foot, x, y)) return ramp[clampTone(y - PC.foot[1] < 2 ? 3 : 1.8 + dither(x, y, 0.2))];
      if (inside(PC.stand, x, y)) return ramp[x === PC.stand[0] ? 3 : 1];
      return ramp[clampTone(1.7 + dither(x, y, 0.3))];
    }),
  );
}

/** `place(x, y)` pasa de la pieza a la habitación. */
export function pixelComputer(place) {
  const out = { pos: [], uv: [] };
  const P = (x, y, z) => {
    const [a, b] = place(x, y);
    return [a, z, b];
  };
  const size = [PC_W, PC_H];
  quads(out, size, P, [0.34, 0.2, 0, 0.66, 0.46, 0.04], { top: PC.foot, front: PC.foot, left: PC.foot, right: PC.foot });
  quads(out, size, P, [0.44, 0.28, 0.04, 0.56, 0.36, 0.16], { front: PC.stand, back: PC.stand, left: PC.stand, right: PC.stand });
  quads(out, size, P, [0.1, 0.16, 0.16, 0.9, 0.44, 0.72], { front: PC.face, back: PC.body, left: PC.body, right: PC.body, top: PC.body, under: PC.body });
  quads(out, size, P, [0.18, 0.56, 0, 0.82, 0.86, 0.035], { top: PC.keys, front: PC.foot, left: PC.foot, right: PC.foot });
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(out.pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(out.uv, 2));
  return g;
}

// La puerta de salida, de la misma madera que el marco de la ventana
const DOOR_W = 112;
const DOOR_H = 176;
const DOOR = { leaf: [0, 0, 80, 150], jamb: [84, 0, 8, 150], jambSide: [94, 0, 6, 150], head: [0, 154, 92, 8], headUnder: [0, 164, 92, 6], knob: [104, 0, 6, 6] };

export function doorTexture(tono, { lit }) {
  const r = probe();
  const ramp = r.rampOf(tono);
  const warm = r.rampOf([Math.min(255, tono[0] * 1.16), tono[1] * 1.02, tono[2] * 0.84]);
  const brass = r.rampOf(LATON);
  const use = lit ? warm : ramp;
  const inside = ([x0, y0, w, h], x, y) => x >= x0 && x < x0 + w && y >= y0 && y < y0 + h;
  const dither = (x, y, amount) => (r.bayerAt(x, y) - 0.5) * amount;
  const wood = (along, across, base, x, y) => clampTone(base + (noise(along * 0.012 + 5, across * 0.16) - 0.5) * 0.7 + dither(x, y, 0.07));
  const panel = (lx, ly, [x0, y0, x1, y1]) => {
    if (lx < x0 || lx >= x1 || ly < y0 || ly >= y1) return null;
    if (ly === y0 || lx === x0) return ramp[0];
    if (ly === y1 - 1 || lx === x1 - 1) return ramp[4];
    if (ly === y0 + 1 || lx === x0 + 1) return ramp[1];
    return use[wood(ly, lx, 2.1, lx, ly)];
  };
  return texture(
    canvasOf(DOOR_W, DOOR_H, (x, y) => {
      if (inside(DOOR.leaf, x, y)) {
        const lx = x - DOOR.leaf[0];
        const ly = y - DOOR.leaf[1];
        if (lx === 0 || ly === 0) return ramp[0];
        if (lx === DOOR.leaf[2] - 1 || ly === DOOR.leaf[3] - 1) return ramp[1];
        return panel(lx, ly, [12, 12, 68, 66]) ?? panel(lx, ly, [12, 82, 68, 138]) ?? use[wood(ly, lx, 2.8, lx, ly)];
      }
      if (inside(DOOR.jamb, x, y)) {
        const lx = x - DOOR.jamb[0];
        return lx === 0 ? ramp[4] : lx === DOOR.jamb[2] - 1 ? ramp[0] : use[wood(y, x, 2.6, x, y)];
      }
      if (inside(DOOR.jambSide, x, y)) return ramp[wood(y, x, 1.3, x, y)];
      if (inside(DOOR.head, x, y)) {
        const row = y - DOOR.head[1];
        return row === 0 ? ramp[4] : row === DOOR.head[3] - 1 ? ramp[0] : use[wood(x, y * 3, 2.7, x, y)];
      }
      if (inside(DOOR.headUnder, x, y)) return ramp[wood(x, y, 0.5, x, y)];
      if (inside(DOOR.knob, x, y)) return brass[y === 0 ? 4 : y === DOOR.knob[3] - 1 ? 1 : 3];
      return ramp[1];
    }),
  );
}

/** `place(a, b)`: a lo largo de la pared y hacia la habitación, como `pixelWindow`. */
export function pixelDoor(place) {
  const out = { pos: [], uv: [] };
  const P = (x, y, z) => {
    const [a, b] = place(x, y);
    return [a, z, b];
  };
  const size = [DOOR_W, DOOR_H];
  quads(out, size, P, [0.2, 0, 0, 1.8, 0.03, 3.02], { front: DOOR.leaf });
  quads(out, size, P, [0.08, 0, 0, 0.2, 0.12, 3.14], { front: DOOR.jamb, left: DOOR.jambSide, right: DOOR.jambSide });
  quads(out, size, P, [1.8, 0, 0, 1.92, 0.12, 3.14], { front: DOOR.jamb, left: DOOR.jambSide, right: DOOR.jambSide });
  quads(out, size, P, [0.08, 0, 3.02, 1.92, 0.14, 3.16], { front: DOOR.head, top: DOOR.head, under: DOOR.headUnder });
  quads(out, size, P, [1.54, 0.03, 1.42, 1.66, 0.12, 1.54], { front: DOOR.knob, top: DOOR.knob, left: DOOR.knob, right: DOOR.knob });
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(out.pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(out.uv, 2));
  return g;
}

/** La mesa con su madera: `boxes`, las cajas de furniture.js; la más alta es el tablero y las demás, las patas. */
export function pixelTable(boxes, place, pulls = []) {
  const out = { pos: [], uv: [] };
  const P = (x, y, z) => {
    const [a, b] = place([x, y, 0, x, y, 0]);
    return [a, z, b];
  };
  const size = [TABLE_W, TABLE_H];
  const top = boxes.reduce((a, b) => (b.b[5] > a.b[5] ? b : a));
  for (const box of boxes) {
    if (box === top) quads(out, size, P, box.b, { top: TABLE.top, front: TABLE.canto, back: TABLE.canto, left: TABLE.end, right: TABLE.end, under: TABLE.under });
    else quads(out, size, P, box.b, { front: TABLE.leg, back: TABLE.leg, left: TABLE.leg, right: TABLE.leg });
  }
  // El faldón bajo el tablero, entre las patas: es la unión que hace que parezca una mesa montada
  const legs = boxes.filter((b) => b !== top && b.b[5] <= top.b[2] + 0.001);
  // Bajo el tablero, un segundo filo retranqueado: el canto se lee en dos planos
  const [tx0, ty0, tz0, tx1, ty1] = top.b;
  quads(out, size, P, [tx0 + 0.05, ty0 + 0.05, tz0 - 0.04, tx1 - 0.05, ty1 - 0.05, tz0], { front: TABLE.apron, back: TABLE.apron, left: TABLE.end, right: TABLE.end });
  // Regatones de hierro en las patas finas; los tiradores, de latón y con volumen
  const shoe = { front: TABLE.iron, back: TABLE.iron, left: TABLE.iron, right: TABLE.iron };
  for (const { b: [x0, y0, z0, x1, y1] } of legs) if (x1 - x0 < 0.3 && y1 - y0 < 0.3) quads(out, size, P, [x0 - 0.012, y0 - 0.012, z0, x1 + 0.012, y1 + 0.012, z0 + 0.07], shoe);
  for (const b of pulls) quads(out, size, P, b, { front: TABLE.brass, left: TABLE.brass, right: TABLE.brass, top: TABLE.brass, under: TABLE.brass });
  if (legs.length >= 4) {
    const x0 = Math.min(...legs.map((b) => b.b[0])) + 0.03;
    const x1 = Math.max(...legs.map((b) => b.b[3])) - 0.03;
    const y0 = Math.min(...legs.map((b) => b.b[1])) + 0.03;
    const y1 = Math.max(...legs.map((b) => b.b[4])) - 0.03;
    const z1 = top.b[2];
    const z0 = z1 - 0.13;
    const face = { front: TABLE.apron, back: TABLE.apron, left: TABLE.apron, right: TABLE.apron, under: TABLE.under };
    quads(out, size, P, [x0, y0, z0, x1, y0 + 0.05, z1], face);
    quads(out, size, P, [x0, y1 - 0.05, z0, x1, y1, z1], face);
    quads(out, size, P, [x0, y0, z0, x0 + 0.05, y1, z1], face);
    quads(out, size, P, [x1 - 0.05, y0, z0, x1, y1, z1], face);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(out.pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(out.uv, 2));
  return g;
}

// El libro de la mesa: el lomo es el de su balda, y las páginas, con su sombra bajo la tapa
const BOOK_W = 64;
const BOOK = { spine: [0, 0, SPINE_W, SPINE_H], pages: [30, 0, 10, 64], edge: [42, 0, 4, 64], inner: [48, 0, 4, 64] };

/**
 * `data`: { id, title, author?, color, ink, edition, look? }. Con `look.pixels`, el lomo auténtico de su edición; con los
 * colores de la portada (`look.base`…), un lomo reconstruido con su título y su autor (1.88); sin nada, el de siempre.
 */
export function bookTexture(data) {
  const r = probe();
  const paint = spinePixel(r, data, titleMask(data.title, SPINE_W, SPINE_H, data.author));
  const ramp = r.rampOf(spineTone(data.look?.base ? hexOf(data.look.base) : data.color, data.id));
  const paper = r.rampOf([222, 206, 170]);
  const inside = ([x0, y0, w, h], x, y) => x >= x0 && x < x0 + w && y >= y0 && y < y0 + h;
  return texture(
    canvasOf(BOOK_W, SPINE_H, (x, y) => {
      if (inside(BOOK.spine, x, y)) return paint(x, y);
      if (inside(BOOK.pages, x, y)) {
        const lx = x - BOOK.pages[0];
        // De abajo (0) arriba: bajo la tapa, la sombra; lo demás, las hojas
        if (lx === BOOK.pages[2] - 1) return paper[0];
        if (lx === BOOK.pages[2] - 2) return paper[1];
        if (lx === 0) return paper[1];
        return paper[lx % 2 ? 3 : 2];
      }
      if (inside(BOOK.edge, x, y)) return ramp[x === BOOK.edge[0] ? 1 : 2];
      if (inside(BOOK.inner, x, y)) return ramp[1];
      return ramp[2];
    }),
  );
}

/**
 * El libro tumbado, apoyado en y = 0: dos tapas que sobresalen de las hojas, el lomo a la izquierda y el pie hacia z creciente.
 * El grupo 0 usa `bookTexture`, y el grupo 1 es la cubierta, con su imagen entera.
 */
export function pixelBook({ width, length, thick, board }) {
  const body = { pos: [], uv: [] };
  const face = { pos: [], uv: [] };
  const P = (x, y, z) => [x - width / 2, z, y - length / 2];
  const size = [BOOK_W, SPINE_H];
  const over = board * 0.9;
  const hinge = board * 1.3;
  const tall = { rect: BOOK.edge };
  const pages = { rect: BOOK.pages, turn: true };
  // Las tapas: se ve su canto y, por dentro, su color
  const lower = [0, 0, 0, width, length, board];
  const upper = [0, 0, thick - board, width, length, thick];
  quads(body, size, P, lower, { front: tall, back: tall, right: tall, top: BOOK.inner, under: BOOK.inner });
  quads(body, size, P, upper, { front: tall, back: tall, right: tall, under: BOOK.inner });
  // El lomo, entero de tapa a tapa, con el dibujo de su balda
  quads(body, size, P, [0, 0, 0, hinge, length, thick], { left: { rect: BOOK.spine, turn: true }, front: tall, back: tall });
  // Las hojas, un poco metidas
  quads(body, size, P, [hinge, over, board, width - over, length - over, thick - board], { front: pages, back: pages, right: pages });
  const count = body.pos.length / 3;
  quads(face, [1, 1], P, upper, { top: [-0.2, -0.2, 1.4, 1.4] });
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute([...body.pos, ...face.pos], 3));
  g.setAttribute('uv', new Float32BufferAttribute([...body.uv, ...face.uv], 2));
  g.addGroup(0, count, 0);
  g.addGroup(count, face.pos.length / 3, 1);
  return g;
}

/** El corte de las páginas, con sus líneas finas. */
export function pagesTexture() {
  const r = probe();
  const paper = r.rampOf([222, 206, 170]);
  return texture(canvasOf(24, 24, (x) => paper[x % 3 === 0 ? 2 : 3]));
}

// El tapizado: píxeles agrupados según la forma, a unos 96 por celda. [x, y, ancho, alto]
const FABRIC_SIZE = 128;
const FABRIC = { cushion: [0, 0, 84, 116], arm: [86, 0, 36, 118], side: [124, 0, 2, 118], thread: [126, 122, 2, 2] };
const smooth = (a, b, v) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Tapizado de una sola lámina, con la rampa del color del catálogo. El cojín se aclara en su parte más alta y se apaga
 * hacia las costuras; el brazo, en su lomo. Tramado solo donde una mancha de tono pasa a la siguiente.
 */
export function upholsteryTexture(tono) {
  const r = probe();
  const ramp = r.rampOf(tono);
  const light = r.rampOf(shade(tono, 1.12));
  const bayer = (x, y) => (r.bayerAt(x, y) - 0.5) * 0.28;
  const inside = ([x0, y0, w, h], x, y) => x >= x0 && x < x0 + w && y >= y0 && y < y0 + h;
  return texture(
    canvasOf(FABRIC_SIZE, FABRIC_SIZE, (x, y) => {
      if (inside(FABRIC.cushion, x, y)) {
        const u = (x + 0.5) / FABRIC.cushion[2];
        // v = 1 es el frente del cojín, junto a tus rodillas
        const v = (y + 0.5) / FABRIC.cushion[3];
        const edge = Math.min(Math.min(u, 1 - u) * 0.86, Math.min(v, 1 - v) * 1.2);
        const puff = smooth(0, 0.2, edge);
        const crown = Math.max(0, 1 - ((u - 0.5) / 0.42) ** 2 - ((v - 0.8) / 0.3) ** 2);
        return light[clampTone(0.9 + puff * 1.75 + crown ** 0.7 * 1.35 + bayer(x, y))];
      }
      if (inside(FABRIC.arm, x, y)) {
        const a = (x - FABRIC.arm[0] + 0.5) / FABRIC.arm[2];
        const v = (y + 0.5) / FABRIC.arm[3];
        const ridge = Math.sin(Math.PI * a) ** 0.8;
        return ramp[clampTone(0.8 + ridge * 2.9 - smooth(0.82, 1, v) * 0.9 + bayer(x, y))];
      }
      if (inside(FABRIC.side, x, y)) {
        const v = (y + 0.5) / FABRIC.side[3];
        return ramp[clampTone(2.4 - v * 2.2 + bayer(x, y))];
      }
      return inside(FABRIC.thread, x, y) ? WHITE : ramp[1];
    }),
  );
}

/** Sombra de contacto: oscura junto a la pieza y desvanecida hacia fuera. `margin`: fracción del lienzo que es desvanecido. */
export function contactShadowTexture(margin = 0.28) {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  const image = g.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = Math.abs((x + 0.5) / size - 0.5) * 2;
      const v = Math.abs((y + 0.5) / size - 0.5) * 2;
      const edge = Math.max(u, v);
      const a = edge < 1 - margin ? 1 : Math.max(0, 1 - (edge - (1 - margin)) / margin);
      image.data[(y * size + x) * 4 + 3] = Math.round(165 * a * a);
    }
  }
  g.putImageData(image, 0, 0);
  const t = new CanvasTexture(canvas);
  return t;
}

/**
 * Una caja del sillón, en coordenadas de la app (x, y a lo hondo, z arriba), lista para unir. `skin` dice qué dibujo lleva
 * arriba ('cushion', 'arm'); `local` deshace el giro, para que el dibujo siga a la pieza y no a la habitación.
 */
function part([x0, y0, z0, x1, y1, z1], c, radius, skin = null, local = null) {
  const w = x1 - x0;
  const h = z1 - z0;
  const d = y1 - y0;
  const base = radius ? new RoundedBoxGeometry(w, h, d, 3, radius) : new BoxGeometry(w, h, d);
  const g = base.index ? base.toNonIndexed() : base;
  g.translate((x0 + x1) / 2, (z0 + z1) / 2, (y0 + y1) / 2);
  const tint = color(c);
  const count = g.attributes.position.count;
  const colors = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  const { position: p, normal: n } = g.attributes;
  const toUv = ([rx, ry, rw, rh], a, b) => [(rx + Math.max(0.02, Math.min(0.98, a)) * rw) / FABRIC_SIZE, 1 - (ry + Math.max(0.02, Math.min(0.98, b)) * rh) / FABRIC_SIZE];
  for (let t = 0; t < count; t += 3) {
    const up = (n.getY(t) + n.getY(t + 1) + n.getY(t + 2)) / 3;
    for (let i = t; i < t + 3; i += 1) {
      colors.set([tint.r, tint.g, tint.b], i * 3);
      if (!skin) {
        uvs.set(toUv(FABRIC.thread, 0.5, 0.5), i * 2);
        continue;
      }
      const [lx, ly, lx0, ly0, lx1, ly1] = local(p.getX(i), p.getZ(i));
      const a = (lx - lx0) / (lx1 - lx0);
      const b = (ly - ly0) / (ly1 - ly0);
      if (up > 0.55 && skin !== 'side') uvs.set(toUv(FABRIC[skin], a, b), i * 2);
      else uvs.set(toUv(FABRIC.side, 0.5, 1 - (p.getY(i) - z0) / h), i * 2);
    }
  }
  g.setAttribute('color', new BufferAttribute(colors, 3));
  g.setAttribute('uv', new BufferAttribute(uvs, 2));
  return g;
}

/** Una línea de puntadas: tramos cortos, a lo largo de `x` o de `y`. */
function stitches(out, from, to, z, c) {
  const [ax, ay] = from;
  const [bx, by] = to;
  const length = Math.hypot(bx - ax, by - ay);
  const ux = (bx - ax) / length;
  const uy = (by - ay) / length;
  const LONG = 0.045;
  const GAP = 0.035;
  const WIDE = 0.009;
  for (let s = 0; s + LONG <= length; s += LONG + GAP) {
    const x0 = ax + ux * s;
    const y0 = ay + uy * s;
    const x1 = x0 + ux * LONG;
    const y1 = y0 + uy * LONG;
    out.push([Math.min(x0, x1) - (ux ? 0 : WIDE / 2), Math.min(y0, y1) - (uy ? 0 : WIDE / 2), z, Math.max(x0, x1) + (ux ? 0 : WIDE / 2), Math.max(y0, y1) + (uy ? 0 : WIDE / 2), z + 0.006, c]);
  }
}

/**
 * El sillón verde de la app, con las mismas cajas y medidas que `armchair` de furniture.js (base, respaldo, dos brazos y
 * asiento), con cantos redondeados y costura. `place(box)` lo coloca como `toWorld` de render.js y `unplace(x, y)` lo deshace.
 */
export function upholsteredArmchair(tono, place, unplace) {
  const thread = shade(tono, 1.24);
  const fold = shade(tono, 0.62);
  const white = [255, 255, 255];
  const x1 = 1.85;
  const parts = [];
  const skinned = ([a, b, c, d, e, f], radius, skin, tint = white) => {
    const local = (x, y) => {
      const [lx, ly] = unplace(x, y);
      return [lx, ly, a, b, d, e];
    };
    parts.push(part(place([a, b, c, d, e, f]), tint, radius, skin, local));
  };
  for (const [lx, ly] of [[0.2, 0.2], [1.68, 0.2], [0.2, 1.68], [1.68, 1.68]]) parts.push(part(place([lx, ly, 0, lx + 0.12, ly + 0.12, 0.22]), WOOD_DARK, 0));
  // El bastidor de madera que une las patas, visible bajo la tapicería
  parts.push(part(place([0.2, 0.2, 0.15, 1.8, 1.8, 0.23]), WOOD_DARK, 0));
  skinned([0.15, 0.25, 0.22, x1, 1.85, 0.7], 0.05, 'side');
  skinned([0.15, 0.2, 0.7, x1, 0.62, 1.75], 0.11, 'side', shade(white, 0.92));
  // Los brazos: el canto de arriba bien redondo, como en el dibujo isométrico
  skinned([0.15, 0.62, 0.66, 0.55, 1.85, 1.12], 0.13, 'arm');
  skinned([x1 - 0.4, 0.62, 0.66, x1, 1.85, 1.12], 0.13, 'arm');
  // El cojín del asiento, algo hinchado, y el pliegue oscuro que lo separa de los brazos
  parts.push(part(place([0.53, 0.6, 0.69, 0.57, 1.83, 0.86]), fold, 0));
  parts.push(part(place([x1 - 0.42, 0.6, 0.69, x1 - 0.38, 1.83, 0.86]), fold, 0));
  skinned([0.57, 0.62, 0.7, x1 - 0.42, 1.82, 0.94], 0.09, 'cushion');
  // Costura: dos líneas por brazo, el contorno del cojín y el remate del respaldo
  const seams = [];
  for (const left of [0.15, x1 - 0.4]) {
    stitches(seams, [left + 0.125, 0.7], [left + 0.125, 1.78], 1.118, thread);
    stitches(seams, [left + 0.275, 0.7], [left + 0.275, 1.78], 1.118, thread);
  }
  stitches(seams, [0.66, 1.72], [x1 - 0.51, 1.72], 0.938, thread);
  stitches(seams, [0.66, 0.72], [0.66, 1.72], 0.938, thread);
  stitches(seams, [x1 - 0.51, 0.72], [x1 - 0.51, 1.72], 0.938, thread);
  stitches(seams, [0.3, 0.63], [x1 - 0.15, 0.63], 1.65, thread);
  for (const [a, b, c, d, e, f, tint] of seams) parts.push(part(place([a, b, c, d, e, f]), tint, 0));
  const merged = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));
  for (const g of parts) g.dispose();
  return merged;
}
