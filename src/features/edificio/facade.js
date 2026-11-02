// Fachada de «El edificio del puerto» (SPEC §64), con el mismo rasterizador de píxeles que los pisos: un edificio
// clásico de estuco mostaza (pilastras, impostas, ventanas altas con recerco, un balconcito de hierro por ventana,
// cornisa con dentículos, dos torreones y, en la azotea, el cartel «AQUÍ NO HAY QUIEN LEA», guiño de Francisco a la
// serie; la letra es propia, en píxeles, no el logotipo de la serie) sobre el muelle, al atardecer, entre dos vecinos más
// bajos. Cada piso es un cuerpo de dos ventanas (A a la izquierda, B a la derecha); en el centro, la escalera. Por las
// ventanas de cada piso se ve su interior, dibujado de frente para que se reconozca (windowView.js), el recerco toma el color de su pared y el
// balcón cuenta algo de quien vive dentro (macetas, guirnalda, el gato). Las puertas libres tienen la persiana bajada.
// Devuelve el dibujo y dónde cae cada piso (para los botones).
import { createRaster, hash, noise, rgb } from '../minigames/libreria-puerto/raster';
import { windowPictures } from './windowView';

const S = 18;
const YAW = 0.3;
const W = 180;
const GLOW_BIT = 0x8000;
const GLASS_ID = 100;

// Medidas del edificio (unidades del mundo)
const BW = 8;
const BD = 2.4;
const GROUND_H = 2.3;
const FLOOR_H = 2.25;
const TOP = GROUND_H + FLOOR_H * 3;
const TOWER_H = 2.1;
const SIGN_X0 = 1.95;
const SIGN_X1 = 6.05;
const SIGN_Y = BD - 0.85;
const SIGN_Z0 = TOP + 1.15;
const SIGN_Z1 = TOP + 2.3;

// Letra de píxeles del cartel (propia): 4 × 5, la I y la Y de 3
const GLYPHS = {
  A: ['.##.', '#..#', '####', '#..#', '#..#'],
  Q: ['.##.', '#..#', '#..#', '#.##', '.###'],
  U: ['#..#', '#..#', '#..#', '#..#', '.##.'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  N: ['#..#', '##.#', '#.##', '#..#', '#..#'],
  O: ['.##.', '#..#', '#..#', '#..#', '.##.'],
  H: ['#..#', '#..#', '####', '#..#', '#..#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  E: ['###', '#..', '##.', '#..', '###'],
  L: ['#..', '#..', '#..', '#..', '###'],
};
const SIGN_LINES = ['AQUÍ NO HAY', 'QUIEN LEA'];

const MUSTARD = [226, 186, 78];
const ROOF_TILE = [176, 98, 72];
const PILASTER = [204, 160, 62];
const STONE = [176, 160, 140];
const WHITE = [240, 232, 214];
const IRON = [52, 48, 56];
const DOOR = [104, 66, 42];
const BRASS = [214, 172, 90];
const COBBLE = [150, 140, 132];
const WATER = [54, 92, 112];
const POT = [184, 98, 70];
const LEAF = [96, 132, 84];
const CURTAIN = [236, 214, 176];
const STAIR = [250, 206, 96];
const FRAME_WOOD = [84, 60, 46];
const BLIND = [214, 196, 160];
const LIT = [255, 226, 160];
const CAT = [206, 142, 86];
const PINK = [228, 196, 182];
const SAND = [222, 210, 188];

// Recerco de las ventanas: del color de la pared del piso (libre: gris azulado, como las del edificio de referencia)
const SURROUND = { yeso: [178, 150, 120], salvia: [134, 152, 120], rosa: [196, 140, 128], noche: [112, 124, 152] };
const SURROUND_FREE = [150, 158, 172];

const bayOf = (side) => (side === 'A' ? [0.35, 2.85] : [5.15, 7.65]);

/** Plantas (1, 2, 3) y piso (A a la izquierda, B a la derecha): el cuerpo y sus dos ventanas. */
export const FLATS = ['1A', '1B', '2A', '2B', '3A', '3B'].map((puerta) => {
  const floor = Number(puerta[0]);
  const z0 = GROUND_H + (floor - 1) * FLOOR_H;
  const [x0, x1] = bayOf(puerta[1]);
  const wins = [
    [x0 + 0.3, x0 + 1.1],
    [x1 - 1.1, x1 - 0.3],
  ];
  return { puerta, z0, x0, x1, wins, gz0: z0 + 0.5, gz1: z0 + 1.9 };
});

function frame() {
  const probe = createRaster({ W: 1, H: 1, S, yaw: YAW, ox: 0, oy: 0 });
  const pts = [];
  for (const x of [-0.3, BW + 0.3]) for (const y of [-0.3, BD + 0.7]) for (const z of [0, TOP + TOWER_H + 0.5]) pts.push(probe.project(x, y, z));
  const minX = Math.min(...pts.map((p) => p.sx));
  const maxX = Math.max(...pts.map((p) => p.sx));
  const minY = Math.min(...pts.map((p) => p.sy));
  const maxY = Math.max(...pts.map((p) => p.sy));
  const top = 12;
  return { ox: Math.round((W - (maxX - minX)) / 2 - minX), oy: Math.round(top - minY), H: Math.ceil(maxY - minY) + top + 28 };
}

const FRAME = frame();
export const FACADE_W = W;
export const FACADE_H = FRAME.H;

/**
 * Las letras del cartel, rojas con sombra y bailando un píxel arriba y abajo (como un rótulo de serie de los 2000,
 * pero con letra propia). Se pintan en la pantalla siguiendo la inclinación del cartel.
 */
function paintSign(r) {
  const p0 = r.project(SIGN_X0, SIGN_Y, SIGN_Z1);
  const p1 = r.project(SIGN_X1, SIGN_Y, SIGN_Z1);
  const slope = (p1.sy - p0.sy) / (p1.sx - p0.sx);
  const boardW = Math.round(p1.sx - p0.sx);
  const red = rgb(196, 52, 40);
  const dark = rgb(92, 30, 26);
  const put = (x, y, c) => {
    const sx = Math.round(p0.sx + x);
    const sy = Math.round(p0.sy + y + slope * x);
    if (sx >= 0 && sy >= 0 && sx < r.W && sy < r.H) r.pix[sy * r.W + sx] = c;
  };
  const widthOf = (line) => [...line].reduce((w, ch) => w + (ch === ' ' ? 3 : (GLYPHS[ch === 'Í' ? 'I' : ch][0].length + 1)), -1);
  SIGN_LINES.forEach((line, row) => {
    let x = Math.round((boardW - widthOf(line)) / 2);
    const y0 = 3 + row * 7;
    [...line].forEach((ch, k) => {
      if (ch === ' ') {
        x += 3;
        return;
      }
      const glyph = GLYPHS[ch === 'Í' ? 'I' : ch];
      const bounce = (k + row) % 3 === 1 ? -1 : 0;
      for (const pass of [dark, red]) {
        const d = pass === dark ? 1 : 0;
        glyph.forEach((rowBits, gy) => {
          [...rowBits].forEach((bit, gx) => {
            if (bit === '#') put(x + gx + d, y0 + gy + bounce + d, pass);
          });
        });
        if (ch === 'Í') put(x + 2 + d, y0 - 2 + bounce + d, pass);
      }
      x += glyph[0].length + 1;
    });
  });
}

/** Un edificio vecino, más bajo y rosado, con su rejilla de ventanas oscuras y balconcillos. */
function neighbour(r, x0, x1, height, seed) {
  r.box(x0, 0, 0, x1, BD - 0.15, height, PINK, { grain: 0, face: (f, a, b) => (f === 'front' && b < GROUND_H ? r.rampOf(SAND)[2] : undefined) });
  r.box(x0 - 0.1, -0.1, height, x1 + 0.1, BD - 0.05, height + 0.18, WHITE, { grain: 0 });
  r.box(x0, 0, height + 0.18, x1, BD - 0.3, height + 0.5, [150, 84, 62], { grain: 0 });
  for (let z = GROUND_H + 0.5; z + 1.3 < height; z += FLOOR_H) {
    for (let a = x0 + 0.5; a + 0.7 < x1; a += 1.4) {
      r.box(a - 0.08, BD - 0.15, z - 0.08, a + 0.78, BD - 0.1, z + 1.38, WHITE, { grain: 0 });
      r.box(a, BD - 0.1, z, a + 0.7, BD - 0.08, z + 1.3, hash(a, z + seed) > 0.6 ? [236, 190, 120] : [66, 62, 76], { grain: 0 });
      r.box(a - 0.1, BD - 0.1, z - 0.1, a + 0.8, BD + 0.25, z - 0.04, IRON, { grain: 0 });
      r.box(a - 0.1, BD + 0.2, z - 0.04, a + 0.8, BD + 0.25, z + 0.5, IRON, { grain: 0 });
    }
  }
}

/** Ventana alta: recerco de color, marco blanco con su guardapolvo encima y el cristal (con su identificador). */
function tallWindow(r, x0, x1, z0, z1, surround, glassId, glass) {
  r.box(x0 - 0.22, BD, z0 - 0.1, x1 + 0.22, BD + 0.02, z1 + 0.22, surround, { grain: 0 });
  r.box(x0 - 0.1, BD + 0.02, z0 - 0.05, x1 + 0.1, BD + 0.05, z1 + 0.08, WHITE, { grain: 0 });
  r.box(x0 - 0.2, BD, z1 + 0.22, x1 + 0.2, BD + 0.16, z1 + 0.36, WHITE, { grain: 0 });
  r.setId(glassId);
  r.box(x0, BD + 0.05, z0, x1, BD + 0.16, z1, glass, { grain: 0, step: 0.04 });
  r.setId(0);
}

/** Balconcito de hierro bajo una ventana. */
function balcony(r, x0, x1, z) {
  r.box(x0, BD, z - 0.1, x1, BD + 0.45, z, WHITE, { grain: 0 });
  r.box(x0, BD + 0.4, z + 0.5, x1, BD + 0.45, z + 0.55, IRON, { grain: 0 });
  r.box(x0, BD + 0.4, z, x1, BD + 0.45, z + 0.05, IRON, { grain: 0 });
  for (let a = x0; a <= x1 - 0.03; a += 0.13) r.box(a, BD + 0.41, z, a + 0.035, BD + 0.44, z + 0.5, IRON, { grain: 0 });
  r.box(x0, BD, z + 0.5, x0 + 0.05, BD + 0.45, z + 0.55, IRON, { grain: 0 });
  r.box(x1 - 0.05, BD, z + 0.5, x1, BD + 0.45, z + 0.55, IRON, { grain: 0 });
}

/**
 * Dibuja la fachada. `flats`: { [puerta]: { room } } para las puertas ocupadas;
 * las que no estén, libres. Devuelve { canvas, windows: [{ puerta, left, top, width, height }] (en fracciones del
 * dibujo), sign }.
 */
export function renderFacade(flats = {}) {
  const r = createRaster({ W, H: FRAME.H, S, yaw: YAW, ox: FRAME.ox, oy: FRAME.oy });
  const H = FRAME.H;
  r.clear(0);
  const at = (x, y, z) => {
    const p = r.project(x, y, z);
    return [p.sx | 0, p.sy | 0];
  };

  // Muelle de adoquines y, delante, el agua del puerto
  r.setId(0);
  const cobble = r.rampOf(COBBLE);
  const water = r.rampOf(WATER);
  r.floor((x, y, ix, iy) => {
    if (y < -1.2) return 0;
    const d = (r.bayerAt(ix, iy) - 0.5) * 0.5;
    if (y > BD + 2.6) {
      const ripple = Math.sin(x * 3.1 + y * 7 + noise(x, y * 2) * 4);
      return water[ripple > 0.82 ? 4 : ripple < -0.6 ? 1 : 2];
    }
    if (y > BD + 2.35) return r.rampOf(STONE)[1];
    const cy = Math.floor(y * 2.6);
    const cx = Math.floor(x * 2.2 + (cy % 2) * 0.5);
    const seam = (x * 2.2 + (cy % 2) * 0.5) % 1 < 0.12 || (y * 2.6) % 1 < 0.14;
    return cobble[Math.max(0, Math.min(4, Math.floor(3 + (hash(cx, cy) - 0.5) * 1.2 + d - (seam ? 1.3 : 0))))];
  });

  // Vecinos a los lados, más bajos
  neighbour(r, -5, -0.05, GROUND_H + FLOOR_H * 2 + 0.3, 1);
  neighbour(r, BW + 0.05, BW + 5, GROUND_H + FLOOR_H * 2 + 0.6, 2);

  // El edificio: planta baja de piedra y estuco mostaza con algo de pátina
  const mustard = r.rampOf(MUSTARD);
  const tile = r.rampOf(ROOF_TILE);
  const roofTile = (a, b) => tile[(a * 2.5) % 1 < 0.08 || (b * 2.5) % 1 < 0.08 ? 1 : (Math.floor(a * 2.5) + Math.floor(b * 2.5)) % 2 ? 3 : 2];
  const stone = r.rampOf(STONE);
  const wallFace = (a, b, ix, iy) => {
    if (b < GROUND_H) {
      const row = Math.floor(b / 0.4);
      const off = (row % 2) * 0.45;
      const seam = b % 0.4 < 0.05 || (a + off) % 0.9 < 0.05;
      return stone[seam ? 1 : Math.max(2, Math.min(4, Math.floor(3 + (hash(Math.floor((a + off) / 0.9), row) - 0.5) * 1.1)))];
    }
    const n = noise(a * 1.8, b * 1.4);
    const dd = r.bayerAt(ix, iy);
    // Pátina: el estuco se oscurece un poco hacia abajo y en manchas
    return mustard[n > 0.72 && dd > 0.55 ? 4 : (n < 0.3 && dd > 0.6) || (b < GROUND_H + 0.6 && dd > 0.8) ? 2 : 3];
  };
  r.box(0, 0, 0, BW, BD, TOP, MUSTARD, {
    grain: 0,
    step: 0.05,
    face: (f, a, b) => (f === 'front' ? wallFace(a, b, ...at(a, BD, b)) : f === 'side' ? (b < GROUND_H ? stone[1] : mustard[1]) : roofTile(a, b)),
  });
  // Pilastras entre cuerpos e impostas entre plantas
  for (const x of [0, 3.05, 4.75, BW - 0.2]) r.box(x, BD, GROUND_H, x + 0.2, BD + 0.08, TOP, PILASTER, { grain: 0 });
  for (let k = 0; k <= 3; k += 1) {
    const z = GROUND_H + k * FLOOR_H - 0.06;
    if (k < 3) r.box(-0.05, BD, z, BW + 0.05, BD + 0.12, z + 0.12, k === 0 ? WHITE : PILASTER, { grain: 0 });
  }
  // Cornisa con dentículos y antepecho de balaustres en la azotea
  r.box(-0.25, BD - 0.35, TOP - 0.12, BW + 0.25, BD + 0.32, TOP + 0.2, WHITE, { grain: 0 });
  r.box(-0.25, -0.1, TOP - 0.12, -0.05, BD - 0.35, TOP + 0.2, WHITE, { grain: 0 });
  r.box(BW + 0.05, -0.1, TOP - 0.12, BW + 0.25, BD - 0.35, TOP + 0.2, WHITE, { grain: 0 });
  for (let a = -0.15; a < BW + 0.15; a += 0.3) r.box(a, BD + 0.1, TOP - 0.32, a + 0.14, BD + 0.24, TOP - 0.12, WHITE, { grain: 0 });
  r.box(1.7, BD - 0.1, TOP + 0.2, BW - 1.7, BD + 0.05, TOP + 0.3, MUSTARD, { grain: 0 });
  r.box(1.7, BD - 0.1, TOP + 0.7, BW - 1.7, BD + 0.05, TOP + 0.82, MUSTARD, { grain: 0 });
  for (let a = 1.85; a < BW - 1.8; a += 0.28) r.box(a, BD - 0.05, TOP + 0.3, a + 0.1, BD, TOP + 0.7, WHITE, { grain: 0 });
  // Dos torreones en las esquinas, con su ventana, su cornisa y su remate
  for (const [t0, t1] of [
    [0, 1.7],
    [BW - 1.7, BW],
  ]) {
    r.box(t0, 0.2, TOP + 0.2, t1, BD, TOP + TOWER_H, MUSTARD, { grain: 0, face: (f, a, b) => (f === 'front' ? wallFace(a, b, ...at(a, BD, b)) : f === 'side' ? mustard[1] : roofTile(a, b)) });
    r.box(t0 - 0.12, 0.08, TOP + TOWER_H, t1 + 0.12, BD + 0.14, TOP + TOWER_H + 0.18, WHITE, { grain: 0 });
    r.box(t0 + 0.2, 0.4, TOP + TOWER_H + 0.18, t1 - 0.2, BD - 0.2, TOP + TOWER_H + 0.42, ROOF_TILE, { grain: 0, face: (f, a, b) => (f === 'top' ? roofTile(a, b) : undefined) });
    r.box(t0 + 0.5, 0.8, TOP + TOWER_H + 0.42, t1 - 0.5, BD - 0.6, TOP + TOWER_H + 0.62, ROOF_TILE, { grain: 0 });
    tallWindow(r, t0 + 0.5, t1 - 0.5, TOP + 0.55, TOP + 1.6, SURROUND_FREE, GLOW_BIT, [236, 196, 128]);
  }
  // El cartel de la azotea, sobre patas de hierro (las letras se pintan al final, en píxeles)
  for (const x of [2.3, 3.5, 4.5, 5.7]) r.box(x, SIGN_Y - 0.05, TOP + 0.2, x + 0.06, SIGN_Y + 0.01, TOP + 1.2, IRON, { grain: 0 });
  r.box(SIGN_X0, SIGN_Y - 0.1, SIGN_Z0, SIGN_X1, SIGN_Y, SIGN_Z1, WHITE, { grain: 0, face: (f, a, b) => (f === 'front' && (a < SIGN_X0 + 0.08 || a > SIGN_X1 - 0.08 || b < SIGN_Z0 + 0.08 || b > SIGN_Z1 - 0.08) ? r.rampOf([168, 70, 52])[2] : f === 'front' ? r.rampOf([246, 236, 214])[3] : undefined) });

  // Planta baja: portal en el centro, escaparate de librería a un lado y café al otro, y el farol
  r.box(3.35, BD, 0, 4.65, BD + 0.12, 2.0, WHITE, { grain: 0 });
  r.box(3.5, BD + 0.02, 0, 4.5, BD + 0.14, 1.82, DOOR, {
    seed: 3,
    face: (f, a, b) => (f === 'front' && (Math.abs(a - 4.0) < 0.03 || b % 0.45 < 0.04) ? r.rampOf(DOOR)[1] : undefined),
  });
  r.box(3.92, BD + 0.14, 0.9, 3.98, BD + 0.2, 0.98, BRASS, { grain: 0 });
  r.box(4.02, BD + 0.14, 0.9, 4.08, BD + 0.2, 0.98, BRASS, { grain: 0 });
  // Escaparate de la librería: lomos de colores en baldas
  r.box(0.5, BD, 0.35, 2.7, BD + 0.08, 1.85, FRAME_WOOD, { grain: 0 });
  r.setId(GLOW_BIT);
  r.box(0.6, BD + 0.08, 0.45, 2.6, BD + 0.16, 1.75, [236, 206, 150], { grain: 0 });
  r.setId(0);
  const spines = [[168, 70, 52], [86, 112, 142], [96, 132, 84], [204, 158, 70], [120, 70, 100]];
  for (let row = 0; row < 3; row += 1) {
    const z = 0.55 + row * 0.42;
    r.box(0.6, BD + 0.16, z - 0.04, 2.6, BD + 0.24, z, FRAME_WOOD, { grain: 0 });
    for (let a = 0.65; a < 2.55; a += 0.1) if (hash(a * 9, row) > 0.25) r.box(a, BD + 0.16, z, a + 0.08, BD + 0.22, z + 0.22 + hash(a, row) * 0.1, spines[Math.floor(hash(row, a * 7) * 5)], { grain: 0 });
  }
  r.box(0.4, BD, 1.92, 2.8, BD + 0.45, 2.05, [96, 124, 92], { grain: 0 });
  // La tienda del bajo (1.67, §67; antes, un café): escaparate iluminado con muebles, toldo a rayas, un cartel colgado
  // con un sobre lacrado y una maceta. Se toca para entrar (`shop`).
  r.box(5.3, BD, 0.35, 7.5, BD + 0.08, 1.85, FRAME_WOOD, { grain: 0 });
  r.setId(GLOW_BIT);
  r.box(5.4, BD + 0.08, 0.45, 7.4, BD + 0.16, 1.75, [240, 196, 124], { grain: 0 });
  r.setId(0);
  r.box(6.35, BD + 0.16, 0.45, 6.45, BD + 0.24, 1.75, FRAME_WOOD, { grain: 0 });
  // En el escaparate: una lámpara de pie y un sillón a la izquierda, una estantería a la derecha
  r.box(5.62, BD + 0.16, 0.45, 5.67, BD + 0.22, 1.25, IRON, { grain: 0 });
  r.box(5.5, BD + 0.16, 1.25, 5.8, BD + 0.24, 1.48, [214, 120, 88], { grain: 0 });
  r.box(5.85, BD + 0.16, 0.45, 6.28, BD + 0.24, 0.85, [118, 138, 104], { grain: 0 });
  r.box(5.85, BD + 0.16, 0.85, 5.95, BD + 0.24, 1.1, [118, 138, 104], { grain: 0 });
  r.box(6.6, BD + 0.16, 0.45, 7.2, BD + 0.22, 1.5, FRAME_WOOD, { grain: 0 });
  for (const z of [0.75, 1.1]) for (let a = 6.66; a < 7.12; a += 0.09) r.box(a, BD + 0.22, z, a + 0.07, BD + 0.25, z + 0.24, spines[Math.floor(hash(a * 11, z) * 5)], { grain: 0 });
  // Cartel colgado de una barra: un sobre con su lacre rojo
  r.box(7.62, BD, 1.62, 7.66, BD + 0.7, 1.66, IRON, { grain: 0 });
  r.box(7.5, BD + 0.38, 1.1, 7.6, BD + 0.98, 1.62, WHITE, { grain: 0 });
  r.box(7.6, BD + 0.6, 1.3, 7.63, BD + 0.76, 1.44, [168, 70, 52], { grain: 0 });
  r.box(5.2, BD, 1.92, 7.6, BD + 0.5, 2.05, [168, 70, 52], { grain: 0, face: (f, a) => (Math.floor(a * 4) % 2 ? r.rampOf(WHITE)[3] : undefined) });
  r.box(7.65, BD + 0.1, 0, 7.95, BD + 0.4, 0.3, POT, { grain: 0 });
  for (let k = 0; k < 4; k += 1) r.box(7.62 + k * 0.08, BD + 0.15, 0.3, 7.74 + k * 0.08, BD + 0.35, 0.6 + hash(k, 5) * 0.3, LEAF, { grain: 0 });
  // Farol de pared junto al portal
  r.box(4.85, BD, 1.45, 4.92, BD + 0.35, 1.52, IRON, { grain: 0 });
  r.box(4.92, BD + 0.22, 1.15, 5.18, BD + 0.48, 1.45, IRON, { grain: 0 });
  r.setId(GLOW_BIT);
  r.box(4.95, BD + 0.25, 1.18, 5.15, BD + 0.45, 1.42, LIT, { grain: 0 });
  r.setId(0);
  // El buzón (1.73): rojo, con su ranura de latón, en la pared entre la librería y el portal. Se toca para ver el correo
  r.box(2.9, BD, 0.8, 3.26, BD + 0.2, 1.3, [168, 70, 52], { seed: 5, face: (f, a, b) => (f === 'front' && b > 1.12 && b < 1.17 && a > 2.96 && a < 3.2 ? r.rampOf(BRASS)[1] : undefined) });
  r.box(2.88, BD, 1.3, 3.28, BD + 0.24, 1.36, [120, 48, 40], { grain: 0 });
  // Bolardo en el muelle, para que se lea «puerto»
  r.box(0.6, BD + 1.7, 0, 0.95, BD + 2.05, 0.45, IRON, { grain: 0 });
  r.box(0.55, BD + 1.65, 0.45, 1.0, BD + 2.1, 0.52, IRON, { grain: 0 });
  r.castShadow(0.8, BD + 1.9, 0.4, 0.25);

  // La escalera: dos ventanas pequeñas por planta en el cuerpo central, con cortinas amarillas encendidas
  for (let k = 0; k < 3; k += 1) {
    const z0 = GROUND_H + k * FLOOR_H + 0.75;
    for (const [a0, a1] of [
      [3.35, 3.8],
      [4.2, 4.65],
    ]) {
      r.box(a0 - 0.1, BD, z0 - 0.1, a1 + 0.1, BD + 0.04, z0 + 1.0, WHITE, { grain: 0 });
      r.box(a0 - 0.14, BD, z0 + 1.0, a1 + 0.14, BD + 0.12, z0 + 1.1, WHITE, { grain: 0 });
      r.setId(GLOW_BIT);
      r.box(a0, BD + 0.04, z0, a1, BD + 0.14, z0 + 0.9, STAIR, { grain: 0, face: (f, a, b) => (f === 'front' && (Math.abs(a - (a0 + a1) / 2) < 0.03 || b < z0 + 0.2) ? r.rampOf([214, 140, 60])[3] : undefined) });
      r.setId(0);
    }
  }

  // Los seis pisos
  const windows = [];
  const lights = [];
  // Cristales de los pisos ocupados (en fracciones del dibujo): la vista les pone una luz que respira (facadeView.js)
  const panes = [];
  for (const [k, f] of FLATS.entries()) {
    const flat = flats[f.puerta] ?? null;
    const room = flat?.room ?? null;
    const surround = flat ? (SURROUND[room?.pared] ?? SURROUND.yeso) : SURROUND_FREE;
    const ids = new Set((room?.items ?? []).map((i) => i.id));
    for (const [w0, w1] of f.wins) {
      tallWindow(r, w0, w1, f.gz0, f.gz1, surround, GLASS_ID + k, [120, 90, 70]);
      balcony(r, w0 - 0.2, w1 + 0.2, f.z0 + 0.45);
    }
    const bz = f.z0 + 0.45;
    if (ids.has('planta-grande') || ids.has('planta-pequena')) {
      for (const [w0] of f.wins) {
        const px = w0 - 0.1;
        r.box(px, BD + 0.08, bz, px + 0.3, BD + 0.36, bz + 0.24, POT, { grain: 0 });
        for (let j = 0; j < 4; j += 1) r.box(px - 0.04 + j * 0.1, BD + 0.1, bz + 0.24, px + 0.1 + j * 0.1, BD + 0.34, bz + 0.48 + hash(k, j) * 0.25, LEAF, { grain: 0 });
      }
    }
    if (ids.has('gato')) {
      const cx = f.wins[1][1] - 0.45;
      r.box(cx, BD + 0.1, bz, cx + 0.4, BD + 0.36, bz + 0.2, CAT, { grain: 0 });
      r.box(cx + 0.28, BD + 0.12, bz + 0.2, cx + 0.44, BD + 0.32, bz + 0.34, CAT, { grain: 0 });
    }
    if (ids.has('guirnalda')) {
      r.setId(GLOW_BIT);
      for (const [w0, w1] of f.wins) {
        for (let j = 0; j < 6; j += 1) {
          const a = w0 - 0.15 + j * ((w1 - w0 + 0.3) / 5);
          const sag = Math.sin((j / 5) * Math.PI) * 0.12;
          const c = [[255, 214, 140], [244, 170, 150], [250, 236, 190]][j % 3];
          r.box(a, BD + 0.43, bz + 0.5 - sag, a + 0.06, BD + 0.47, bz + 0.56 - sag, c, { grain: 0 });
        }
      }
      r.setId(0);
    }
    const p0 = r.project(f.x0 - 0.05, BD + 0.45, f.z0 + 0.25);
    const p1 = r.project(f.x1 + 0.05, BD, f.gz1 + 0.36);
    windows.push({ puerta: f.puerta, left: Math.min(p0.sx, p1.sx) / W, top: Math.min(p0.sy, p1.sy) / H, width: Math.abs(p1.sx - p0.sx) / W, height: Math.abs(p1.sy - p0.sy) / H });
    if (flat)
      for (const [w0, w1] of f.wins) {
        const a = r.project(w0, BD, f.gz1);
        const b = r.project(w1, BD, f.gz0);
        panes.push({ left: Math.min(a.sx, b.sx) / W, top: Math.min(a.sy, b.sy) / H, width: Math.abs(b.sx - a.sx) / W, height: Math.abs(b.sy - a.sy) / H });
      }
    if (flat) for (const [w0, w1] of f.wins) lights.push(r.project((w0 + w1) / 2, BD + 0.3, (f.gz0 + f.gz1) / 2));
  }
  for (let k = 0; k < 3; k += 1) lights.push(r.project(4, BD + 0.3, GROUND_H + k * FLOOR_H + 1.2));
  lights.push(r.project(5.05, BD + 0.5, 1.3), r.project(1.6, BD + 0.3, 1.1), r.project(6.4, BD + 0.3, 1.1));

  r.applyShadows();
  r.bakeOcclusion();
  r.shadeEdges();
  paintSign(r);

  // Por las ventanas de cada piso, su interior visto de frente (windowView.js), con cortinas y travesaño. Si el piso
  // está libre, la persiana está bajada.
  const WIN_W = Math.round(0.8 * S * Math.cos(YAW));
  const WIN_H = Math.round(1.4 * S * 0.866);
  const pictures = Object.fromEntries(Object.entries(flats).map(([puerta, f]) => [puerta, windowPictures(f.room, WIN_W, WIN_H)]));
  const lit = r.rampOf(LIT);
  const curtain = r.rampOf(CURTAIN);
  const frameWood = r.rampOf(FRAME_WOOD);
  const blind = r.rampOf(BLIND);
  for (let i = 0; i < r.pix.length; i += 1) {
    const id = r.ids[i];
    if (id < GLASS_ID || id >= GLASS_ID + FLATS.length) continue;
    const f = FLATS[id - GLASS_ID];
    const ix = i % W;
    const iy = (i / W) | 0;
    const q = r.unprojectOnPlaneY(ix + 0.5, iy + 0.5, BD + 0.16);
    const wk = q.x > (f.wins[0][1] + f.wins[1][0]) / 2 ? 1 : 0;
    const win = f.wins[wk];
    const wu = (q.x - win[0]) / (win[1] - win[0]);
    const v = (f.gz1 - q.z) / (f.gz1 - f.gz0);
    const flat = flats[f.puerta];
    if (!flat) {
      // Persiana enrollable bajada: lamas claras con su sombra
      r.pix[i] = blind[(q.z * 9) % 1 < 0.25 ? 1 : v < 0.08 ? 2 : 3];
      continue;
    }
    const lx = Math.max(0, Math.min(WIN_W - 1, Math.floor(wu * WIN_W)));
    const ly = Math.max(0, Math.min(WIN_H - 1, Math.floor(v * WIN_H)));
    // Travesaño de madera arriba y cortinas recogidas a los lados (de un píxel, para no tapar nada)
    if (ly === Math.round(WIN_H * 0.1)) {
      r.pix[i] = frameWood[2];
      continue;
    }
    if (lx === 0 || lx === WIN_W - 1 || ly < Math.round(WIN_H * 0.1)) {
      r.pix[i] = curtain[ly < Math.round(WIN_H * 0.1) ? 2 : (ly >> 1) % 2 ? 4 : 3];
      continue;
    }
    const c = pictures[f.puerta][wk][ly * WIN_W + lx];
    // Un reflejo del cielo en la esquina de arriba del cristal
    const sheen = lx + ly < 4 && r.bayerAt(ix, iy) > 0.5;
    r.pix[i] = sheen ? rgb((c & 255) + 22, ((c >> 8) & 255) + 22, ((c >> 16) & 255) + 26) : c;
  }

  // Cielo de atardecer con colinas y luces lejanas detrás; luz de tarde sobre todo lo demás
  const horizon = r.project(BW / 2, -1.2, 0).sy;
  const sky = [[54, 46, 92], [124, 78, 118], [214, 128, 120], [246, 184, 136]];
  for (let iy = 0; iy < H; iy += 1) {
    const t = Math.min(1, Math.max(0, iy / (horizon - 4)));
    const band = t * (sky.length - 1);
    for (let ix = 0; ix < W; ix += 1) {
      const i = iy * W + ix;
      if (r.zb[i] > -1e8) continue;
      const ridge = horizon - 16 - noise(ix * 0.045, 3) * 24 - noise(ix * 0.16, 8) * 6;
      if (iy > ridge) {
        const house = hash(Math.floor(ix / 3), Math.floor(iy / 3)) > 0.93 && iy > ridge + 4;
        r.pix[i] = house ? rgb(255, 214, 150) : rgb(84 + (iy - ridge) * 0.4, 66, 98);
        continue;
      }
      const k = Math.max(0, Math.min(sky.length - 2, Math.floor(band + (r.bayerAt(ix, iy) - 0.5) * 0.6)));
      const m = Math.min(1, Math.max(0, band - k));
      const a = sky[k];
      const b = sky[k + 1];
      const star = iy < horizon * 0.35 && hash(ix, iy) > 0.993;
      r.pix[i] = star ? rgb(250, 240, 220) : rgb(a[0] + (b[0] - a[0]) * m, a[1] + (b[1] - a[1]) * m, a[2] + (b[2] - a[2]) * m);
    }
  }
  for (let i = 0; i < r.pix.length; i += 1) {
    if (r.zb[i] < -1e8) continue;
    const id = r.ids[i];
    if (id >= GLASS_ID && id < GLASS_ID + FLATS.length && flats[FLATS[id - GLASS_ID].puerta]) continue;
    const p = r.pix[i];
    if (id & GLOW_BIT) {
      const lum = ((p & 255) + ((p >> 8) & 255) + ((p >> 16) & 255)) / 765;
      r.pix[i] = lit[lum > 0.45 ? 3 : 1];
      continue;
    }
    const ix = i % W;
    const iy = (i / W) | 0;
    let g = 0;
    for (const l of lights) {
      const d = Math.hypot(ix - l.sx, (iy - l.sy) * 1.3) / 30;
      if (d < 1) g += (1 - d) ** 1.6;
    }
    g = Math.min(1, g);
    r.pix[i] = rgb((p & 255) * (0.8 + g * 0.4), ((p >> 8) & 255) * (0.72 + g * 0.32), ((p >> 16) & 255) * (0.82 + g * 0.04));
  }

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(W, H);
  image.data.set(new Uint8ClampedArray(r.pix.buffer));
  ctx.putImageData(image, 0, 0);
  // Dónde empieza el agua (la orilla es una recta en la pantalla): para el brillo que corre por ella
  const shore = [r.project(-8, BD + 2.6, 0), r.project(BW + 8, BD + 2.6, 0)].map((p) => ({ x: p.sx / W, y: p.sy / H }));
  // La tienda del bajo: el escaparate con su toldo y su cartel (para el botón)
  const s0 = r.project(5.15, BD + 0.5, 0.2);
  const s1 = r.project(7.8, BD, 2.15);
  const shop = { left: Math.min(s0.sx, s1.sx) / W, top: Math.min(s0.sy, s1.sy) / H, width: Math.abs(s1.sx - s0.sx) / W, height: Math.abs(s1.sy - s0.sy) / H };
  // El buzón (para el botón y la carta que asoma)
  const m0 = r.project(2.88, BD + 0.24, 0.8);
  const m1 = r.project(3.28, BD, 1.36);
  const mailbox = { left: Math.min(m0.sx, m1.sx) / W, top: Math.min(m0.sy, m1.sy) / H, width: Math.abs(m1.sx - m0.sx) / W, height: Math.abs(m1.sy - m0.sy) / H };
  return { canvas, windows, panes, shore, shop, mailbox, sign: SIGN_LINES.join(' ') };
}
