// La sala de lectura del Gran Hotel por dentro (1.83, docs/qa/gran-hotel.md §9.5), con el mismo motor isométrico que el
// casino (raster.js): una biblioteca de noche. Parqué en espiga, librerías de nogal hasta el techo, una ventana al puerto,
// una alfombra en el centro y seis sillones de cuero con su lámpara. Quien lee se dibuja dentro de la escena, sentado y
// con un libro en las manos, con su profundidad y la luz de la sala; su compañero va encima (SalaLectura.jsx). Todo propio.
import { actorBoxes } from '../actor';
import { createRaster, noise, rgb } from '../../minigames/libreria-puerto/raster';
import { evening, toDataURL } from '../shopRoom';

const YAW = Math.PI / 4;
const SW = 9;
const SD = 7;
const WH = 4.2;
const WALL_T = 0.3;
const S_SALA = 18;
const GLOW = 0x8000;

const WALNUT = [98, 60, 40];
const OAK = [150, 104, 64];
const GOLD = [236, 190, 96];
const LAMP = [255, 222, 150];
const LEATHER = [122, 58, 40];
const RUG = [44, 74, 92];
const GLASS = [34, 52, 92];
const BOOKS = [
  [150, 54, 48],
  [52, 92, 110],
  [176, 136, 70],
  [64, 104, 76],
  [120, 70, 110],
  [214, 196, 160],
];

/** Cada sillón: x, y y hacia dónde mira. Tres bajo la ventana y tres junto a la librería, todos de cara a quien mira. */
export const SILLONES = [
  [2.9, 1.5, 0],
  [4.8, 1.5, 0],
  [6.7, 1.5, 0],
  [1.5, 2.9, 3],
  [1.5, 4.45, 3],
  [1.5, 6.0, 3],
];
const SEAT_H = 0.7;

function buildSala(r, lectores) {
  const lights = [];
  const box = (x0, y0, z0, x1, y1, z1, c, opts = {}) => {
    r.setId(opts.glow ? GLOW : 0);
    r.box(x0, y0, z0, x1, y1, z1, c, { seed: opts.seed ?? x0 * 7 + y0 * 3, grain: opts.grain ?? 1, face: opts.face ?? null, step: opts.step ?? 0.035 });
    r.setId(0);
  };
  const walnut = r.rampOf(WALNUT);
  const gold = r.rampOf(GOLD);
  const at = (x, y, z) => {
    const p = r.project(x, y, z);
    return [p.sx | 0, p.sy | 0];
  };

  // ── Parqué en espiga ──
  const oak = r.rampOf(OAK);
  r.floor((x, y, ix, iy) => {
    if (x < 0 || y < 0 || x > SW || y > SD) return 0;
    const row = Math.floor(y * 2.5);
    const u = x + (row % 2 ? 0.3 : 0);
    if ((u * 1.6) % 1 < 0.05 || (y * 2.5) % 1 < 0.06) return oak[1];
    const d = (r.bayerAt(ix, iy) - 0.5) * 0.5;
    return oak[Math.max(1, Math.min(4, Math.floor(2.4 + (noise(Math.floor(u * 1.6), row) - 0.5) * 1.4 + d)))];
  });

  // ── Librerías hasta el techo: baldas de nogal y lomos de colores ──
  const shelfFace = (a, b, ix, iy) => {
    if (b > WH - 0.24) return b > WH - 0.1 ? gold[2] : walnut[3];
    if (b < 0.7) return walnut[Math.abs((a % 1.2) - 0.6) < 0.03 ? 1 : 2];
    if (a % 1.5 < 0.1) return walnut[3];
    const band = (b - 0.7) % 0.72;
    if (band < 0.08) return walnut[3];
    const spine = Math.floor(a * 9);
    const shelf = Math.floor((b - 0.7) / 0.72);
    const n = noise(spine * 1.7, shelf * 3.1);
    if (band > 0.42 + n * 0.24) return walnut[0];
    if (n < 0.12) return walnut[0];
    const c = BOOKS[Math.floor(n * 37) % BOOKS.length];
    const k = (a * 9) % 1 < 0.14 ? 0.6 : r.bayerAt(ix, iy) > 0.8 ? 1.1 : 0.9;
    return rgb(c[0] * k, c[1] * k, c[2] * k);
  };
  // La pared del fondo lleva una ventana grande al puerto, de noche
  const WX0 = 3.4;
  const WX1 = 5.6;
  const backFace = (a, b, ix, iy) => {
    if (a > WX0 && a < WX1 && b > 1.0 && b < 3.5) {
      if (Math.abs(a - (WX0 + WX1) / 2) < 0.04 || Math.abs(b - 2.3) < 0.04 || a < WX0 + 0.07 || a > WX1 - 0.07 || b < 1.07 || b > 3.43) return walnut[3];
      if (b < 1.5) return noise(a * 8, b * 12) > 0.8 ? rgb(236, 190, 96) : rgb(22, 34, 66);
      return noise(a * 13, b * 13) > 0.93 ? rgb(230, 230, 200) : rgb(...GLASS);
    }
    return shelfFace(a, b, ix, iy);
  };
  r.box(-WALL_T, -WALL_T, 0, SW, 0, WH, WALNUT, { grain: 0, step: 0.03, face: (f, a, b) => (f === 'front' ? backFace(a, b, ...at(a, 0, b)) : f === 'top' ? walnut[3] : walnut[1]) });
  r.box(-WALL_T, 0, 0, 0, SD, WH, WALNUT, { grain: 0, step: 0.03, face: (f, a, b) => (f === 'side' ? shelfFace(a, b, ...at(0, a, b)) : f === 'top' ? walnut[3] : walnut[1]) });

  // ── La alfombra del centro, con su filete dorado ──
  const rug = r.rampOf(RUG);
  box(2.9, 2.7, 0, 6.1, 4.3, 0.03, RUG, {
    grain: 0,
    step: 0.02,
    face: (f, a, b) => {
      if (f !== 'top') return null;
      const e = Math.min(a - 2.9, 6.1 - a, b - 2.7, 4.3 - b);
      if (e > 0.12 && e < 0.17) return gold[3];
      return rug[noise(a * 6, b * 6) > 0.7 ? 3 : 2];
    },
  });

  // ── La mesa baja del centro, con una pila de libros y una tetera ──
  box(3.9, 3.2, 0.34, 5.1, 3.8, 0.42, WALNUT, { grain: 0 });
  for (const [x, y] of [
    [4, 3.3],
    [5, 3.3],
    [4, 3.7],
    [5, 3.7],
  ])
    box(x - 0.05, y - 0.05, 0.03, x + 0.05, y + 0.05, 0.34, WALNUT, { grain: 0 });
  [0, 1, 2].forEach((k) => box(4.1 + k * 0.02, 3.34, 0.42 + k * 0.08, 4.5 - k * 0.03, 3.64, 0.5 + k * 0.08, BOOKS[k], { grain: 0 }));
  box(4.68, 3.4, 0.42, 4.9, 3.6, 0.6, [214, 196, 160], { grain: 0 });

  // ── Los sillones, cada uno con su lámpara de pie ──
  SILLONES.forEach(([x, y, facing], i) => {
    const frontal = facing === 0;
    box(x - 0.56, y - 0.56, 0, x + 0.56, y + 0.56, SEAT_H, LEATHER, { seed: i });
    if (frontal) box(x - 0.56, y - 0.56, SEAT_H, x + 0.56, y - 0.36, 1.6, LEATHER, { seed: i + 1 });
    else box(x - 0.56, y - 0.56, SEAT_H, x - 0.36, y + 0.56, 1.6, LEATHER, { seed: i + 1 });
    for (const s of [-1, 1]) {
      if (frontal) box(x + s * 0.48 - 0.08, y - 0.56, SEAT_H, x + s * 0.48 + 0.08, y + 0.56, 1.0, LEATHER, { seed: i + 2 });
      else box(x - 0.56, y + s * 0.48 - 0.08, SEAT_H, x + 0.56, y + s * 0.48 + 0.08, 1.0, LEATHER, { seed: i + 2 });
    }
    if (lectores[i]) {
      const atras = 0.14;
      const state = { x: frontal ? x : x - atras, y: frontal ? y - atras : y, facing, pose: 'sit', h: SEAT_H, libro: BOOKS[i % BOOKS.length] };
      actorBoxes(lectores[i], state).forEach((bx, k) => {
        const [x0, y0, z0, x1, y1, z1] = bx.b;
        r.box(x0, y0, z0, x1, y1, z1, bx.c, { seed: 501 + k, grain: bx.grain ?? 0.6, step: bx.step ?? 0.03 });
      });
    }
    const lx = frontal ? x + 0.8 : x - 0.3;
    const ly = frontal ? y - 0.3 : y + 0.74;
    box(lx - 0.14, ly - 0.14, 0, lx + 0.14, ly + 0.14, 0.05, GOLD, { grain: 0 });
    box(lx - 0.025, ly - 0.025, 0.05, lx + 0.025, ly + 0.025, 1.7, GOLD, { grain: 0 });
    box(lx - 0.2, ly - 0.2, 1.7, lx + 0.2, ly + 0.2, 2.02, LAMP, { glow: true, grain: 0 });
    lights.push([lx, ly, 1.7]);
  });
  return lights;
}

function salaFrame() {
  const probe = createRaster({ W: 1, H: 1, S: S_SALA, yaw: YAW, ox: 0, oy: 0 });
  const pts = [
    [SW, SD, 0],
    [SW, -WALL_T, 0],
    [-WALL_T, SD, 0],
    [-WALL_T, -WALL_T, WH],
    [SW, -WALL_T, WH],
    [-WALL_T, SD, WH],
  ].map(([x, y, z]) => probe.project(x, y, z));
  const minX = Math.min(...pts.map((p) => p.sx));
  const maxX = Math.max(...pts.map((p) => p.sx));
  const minY = Math.min(...pts.map((p) => p.sy));
  const maxY = Math.max(...pts.map((p) => p.sy));
  return { W: Math.ceil(maxX - minX) + 6, H: Math.ceil(maxY - minY) + 6, ox: Math.round(3 - minX), oy: Math.round(3 - minY) };
}

const FRAME = salaFrame();
export const SALA_W = FRAME.W;
export const SALA_H = FRAME.H;
let cache = { key: null, value: null };

/**
 * La sala con quien lee: `lectores[k]` es el personaje sentado en el sillón k (o nada). Devuelve { scene, pies, cabezas },
 * en píxeles del dibujo: `pies` es dónde se queda el compañero de cada sillón, en el suelo a su lado, y `cabezas`, dónde
 * sale su saludo.
 */
export function renderSala(lectores = []) {
  const key = JSON.stringify(lectores);
  if (cache.key === key) return cache.value;
  const r = createRaster({ W: FRAME.W, H: FRAME.H, S: S_SALA, yaw: YAW, ox: FRAME.ox, oy: FRAME.oy });
  r.clear(0);
  const lights = buildSala(r, lectores);
  r.applyShadows();
  r.bakeOcclusion();
  r.shadeEdges();
  evening(r, lights, 90);
  const pies = SILLONES.map(([x, y, facing]) => {
    const p = facing === 0 ? r.project(x + 1.05, y + 0.45, 0) : r.project(x + 0.45, y + 0.85, 0);
    return { x: p.sx, y: p.sy };
  });
  const cabezas = SILLONES.map(([x, y]) => {
    const p = r.project(x, y, 2.3);
    return { x: p.sx, y: p.sy };
  });
  cache = { key, value: { scene: toDataURL(r, () => rgb(16, 12, 20)), pies, cabezas } };
  return cache.value;
}
