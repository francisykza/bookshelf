// La tienda del bajo con el mismo motor que los pisos (1.68, encargo de Francisco del 1-11-2026: «muy plano, no lo veo
// con el mismo diseño que las habitaciones»). Un local isométrico de cajas, con veta, sombras, oclusión, bordes de píxel
// y la luz de tarde de las lámparas, igual que un piso (render.js), pero más grande y amueblado para vender:
// - a la izquierda, estanterías de libros y el cartel «VIDEOCLUB» que quedó del bajo (guiño a «Aquí no hay quien viva»,
//   nunca su decorado ni su logotipo); al fondo, el escaparate al puerto de noche y la guirnalda;
// - el rincón de muebles sueltos (alfombra, sillón, lámpara, mesilla), el expositor de sobres con los sobres de la
//   temporada de pie en sus gradas, la caja de reciclaje y el mostrador con la dependienta (propia) y su caja.
// `renderShopRoom()` da el local entero y los recuadros de lo que se toca (las tres secciones); `renderShopCounter(mood)`
// da el mostrador de cerca, con la cámara más próxima, para abrir sobres. Todo propio, sin dibujos ajenos.
import { createRaster, hash, noise, rgb } from '../minigames/libreria-puerto/raster';
import { catalogItem } from './catalog';
import { SOBRES } from './economy';
import { PACK_H, PACK_NEAR_H, PACK_NEAR_TAB, PACK_NEAR_TEAR, PACK_NEAR_W, PACK_W, packArt } from './shopArt';
import { shapeOf } from './furniture';
import { floorColor } from './render';

const YAW = Math.PI / 4;
const SW = 10;
const SD = 8;
const WH = 4.2;
const WALL_T = 0.3;
const GLOW = 0x8000;
// Lo que se toca en el local (identificadores en el búfer de toques)
const ID = { sobres: 1, muebles: 2, reciclar: 3 };
// Dónde cuelga el letrero de cada sección (un punto del mundo, encima de su objeto)
const TAG_AT = { sobres: [2.5, 5.6, 2.75], muebles: [2.9, 2.45, 2.05], reciclar: [5.85, 5.35, 1.75] };

const WOOD = [150, 98, 60];
const WOOD_D = [104, 66, 42];
const WOOD_L = [190, 140, 92];
const PLASTER = [224, 196, 150];
const WAINSCOT = [120, 84, 58];
const GREEN = [76, 110, 80];
const GREEN_D = [52, 80, 60];
const CREAM = [238, 226, 200];
const RED = [150, 58, 46];
const BRASS = [204, 160, 76];
const SKIN = [240, 196, 156];
const HAIR = [112, 68, 42];
const HAIR_L = [146, 92, 56];
const KNIT = [212, 158, 62];
const DARK = [56, 40, 34];
const LIT = [255, 228, 164];
const SPINES = [[150, 66, 52], [72, 96, 120], [118, 136, 100], [204, 158, 70], [96, 70, 98], [184, 98, 70], [226, 208, 172]];

// Letra de 3 × 5 (la M, de 5) para el cartel del videoclub
const FONT = {
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  O: ['###', '#.#', '#.#', '#.#', '###'],
  C: ['###', '#..', '#..', '#..', '###'],
  L: ['#..', '#..', '#..', '#..', '###'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
};

/** Coordenadas de un mueble del catálogo → mundo (como toWorld de render.js). */
function toWorld(item, cat, base, lx, ly, lz) {
  if (cat.capa === 'pared') return item.pared === 'fondo' ? [item.a + lx, ly, lz] : [ly, item.a + lx, lz];
  const { w, d } = cat;
  let x = lx;
  let y = ly;
  if (item.rot === 1) [x, y] = [d - ly, lx];
  else if (item.rot === 2) [x, y] = [w - lx, d - ly];
  else if (item.rot === 3) [x, y] = [ly, w - lx];
  return [item.x + x, item.y + y, base + lz];
}

/** El local, amueblado. `mood` de la dependienta: 'base' o 'happy'. Devuelve las luces (puntos del mundo). */
// `vacio` (1.119, el café-librería del bajo, bloque 1): el local en traspaso, sin el cartel del videoclub, sin el rincón de
// muebles, el reciclaje ni el expositor de sobres; en su sitio, cajas de mudanza y lo que queda bajo sábanas.
function buildShop(r, mood, near = false, vacio = false) {
  const lights = [];
  const box = (x0, y0, z0, x1, y1, z1, c, opts = {}) => {
    r.setId((opts.id ?? 0) | (opts.glow ? GLOW : 0));
    r.box(x0, y0, z0, x1, y1, z1, c, { seed: opts.seed ?? x0 * 7 + y0 * 3, grain: opts.grain ?? 1, face: opts.face ?? null, step: Math.min(opts.step ?? 0.04, near ? 0.02 : 0.04) });
    r.setId(0);
  };
  const shade = (c, k) => c.map((v) => Math.max(0, Math.min(255, Math.round(v * k))));
  const item = (id, props, tono = 0, id2 = 0, base = 0) => {
    const cat = catalogItem(id);
    const it = { rot: 0, ...props, id };
    shapeOf(id, cat.tonos[tono]).forEach((bx, k) => {
      const p = toWorld(it, cat, base, bx.b[0], bx.b[1], bx.b[2]);
      const q = toWorld(it, cat, base, bx.b[3], bx.b[4], bx.b[5]);
      box(Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.min(p[2], q[2]), Math.max(p[0], q[0]), Math.max(p[1], q[1]), Math.max(p[2], q[2]), bx.c, { id: id2, glow: bx.glow, grain: bx.grain ?? 1, seed: k * 13 + (props.x ?? 0) });
    });
    if (cat.luz) lights.push(toWorld(it, cat, base, ...cat.luz));
    if (cat.capa === 'suelo') {
      const w = it.rot % 2 ? cat.d : cat.w;
      const d = it.rot % 2 ? cat.w : cat.d;
      r.castShadow(it.x + w / 2, it.y + d / 2, 0.25, Math.min(w, d) * 0.55, 1, 0.5);
    }
  };

  // ── Suelo en damero y paredes de yeso cálido con zócalo de madera ──
  r.floor((x, y, ix, iy) => (x < 0 || y < 0 || x > SW || y > SD ? 0 : floorColor(r, 'damero', x, y, ix, iy)));
  const plaster = r.rampOf(PLASTER);
  const wains = r.rampOf(WAINSCOT);
  const wood = r.rampOf(WOOD);
  const wallFace = (a, b, ix, iy) => {
    if (b > WH - 0.08) return wood[2];
    if (b < 1.1) return wains[Math.abs((a % 0.9) - 0.45) < 0.035 ? 1 : b > 1.0 ? 3 : 2];
    if (b < 1.2) return wood[3];
    const n = noise(a * 2.6 + 7, b * 2.6);
    const d = r.bayerAt(ix, iy);
    return plaster[n > 0.78 && d > 0.7 ? 4 : n < 0.22 && d > 0.8 ? 2 : 3];
  };
  const at = (x, y, z) => {
    const p = r.project(x, y, z);
    return [p.sx | 0, p.sy | 0];
  };
  r.box(-WALL_T, -WALL_T, 0, SW, 0, WH, PLASTER, { grain: 0, step: near ? 0.018 : 0.035, face: (f, a, b) => (f === 'front' ? wallFace(a, b, ...at(a, 0, b)) : f === 'top' ? wood[3] : wood[1]) });
  r.box(-WALL_T, 0, 0, 0, SD, WH, PLASTER, { grain: 0, step: near ? 0.018 : 0.035, face: (f, a, b) => (f === 'side' ? wallFace(a, b, ...at(0, a, b)) : f === 'top' ? wood[3] : wood[1]) });
  box(0, 0, 0, SW, 0.08, 0.16, WOOD_D, { grain: 0 });
  box(0, 0, 0, 0.08, SD, 0.16, WOOD_D, { grain: 0 });

  // ── Escaparate al puerto de noche, en la pared del fondo ──
  const WX0 = 0.9;
  const WX1 = 4.9;
  const WZ0 = 1.35;
  const WZ1 = 3.7;
  const sky = (a, b) => {
    const t = (b - WZ0) / (WZ1 - WZ0);
    const ix = Math.floor(a * 18);
    const iz = Math.floor(b * 18);
    if (t > 0.55 && hash(ix, iz) > 0.975) return rgb(250, 240, 210);
    if (t > 0.42) {
      const c = [40 + (1 - t) * 50, 50 + (1 - t) * 40, 92 + (1 - t) * 40];
      return rgb(...c);
    }
    const hill = 0.36 + Math.sin(a * 2.2) * 0.03;
    if (t > hill) return rgb(46, 58, 92);
    // Casas con luces y el agua con sus reflejos
    if (t > 0.22) {
      const house = Math.floor(a * 5);
      const roof = 0.3 + hash(house, 3) * 0.06;
      if (t > roof) return rgb(46, 58, 92);
      const lit = Math.floor(a * 18) % 3 !== 0 && Math.floor(b * 18) % 2 === 0 && hash(ix, iz) > 0.3;
      return lit ? rgb(255, 210, 120) : hash(house, 1) > 0.5 ? rgb(170, 150, 132) : rgb(140, 120, 110);
    }
    if (hash(Math.floor(a * 6), iz) > 0.82 && iz % 2 === 0) return rgb(232, 190, 112);
    return rgb(32, 46, 80);
  };
  box(WX0, 0, WZ0, WX1, 0.03, WZ1, [40, 60, 96], { grain: 0, face: (f, a, b) => (f === 'front' ? sky(a, b) : null) });
  // Faro a la derecha del cristal
  box(4.15, 0.03, 2.05, 4.3, 0.05, 2.75, CREAM, { grain: 0, face: (f, a, b) => (f === 'front' && Math.floor(b * 10) % 2 ? rgb(196, 70, 56) : null) });
  box(4.12, 0.03, 2.75, 4.33, 0.06, 2.85, [255, 230, 150], { grain: 0, glow: true });
  // Marco verde, parteluces y repisa
  for (const [x0, z0, x1, z1] of [[WX0 - 0.1, WZ0 - 0.1, WX1 + 0.1, WZ0], [WX0 - 0.1, WZ1, WX1 + 0.1, WZ1 + 0.12], [WX0 - 0.1, WZ0, WX0, WZ1], [WX1, WZ0, WX1 + 0.1, WZ1], [2.86, WZ0, 2.94, WZ1], [WX0, 3.05, WX1, 3.11]]) box(x0, 0, z0, x1, 0.14, z1, GREEN, { grain: 0 });
  for (const x of [1.9, 3.9]) box(x - 0.03, 0, 3.11, x + 0.03, 0.1, WZ1, GREEN_D, { grain: 0 });
  box(WX0 - 0.2, 0, WZ0 - 0.18, WX1 + 0.2, 0.36, WZ0 - 0.08, WOOD_L);
  // Hiedra que cae del escaparate
  for (let k = 0; k < 46; k += 1) {
    const x = WX0 - 0.15 + hash(k, 2) * (WX1 - WX0 + 0.3);
    const z = WZ1 + 0.18 - Math.abs(Math.sin(k)) * (k % 5 === 0 ? 1.2 : 0.35);
    box(x, 0.06, z, x + 0.1, 0.16, z + 0.1, k % 3 ? [96, 126, 82] : [136, 160, 100], { grain: 0 });
  }

  // ── Pared de la izquierda: estanterías llenas y el cartel del videoclub de antes ──
  for (const y of [0.3, 2.35]) item('estanteria', { x: 0, y, rot: 3 });
  if (vacio) cajasDeMudanza(box, r);
  if (!vacio) {
  // Cartel (de madera, con letras de píxel pintadas en su cara)
  const label = 'VIDEOCLUB';
  const cols = [...label].reduce((w, ch) => w + FONT[ch][0].length + 1, 1);
  const SY0 = 0.45;
  const SY1 = 3.95;
  const SZ0 = 3.55;
  const SZ1 = 4.05;
  const letterAt = (yy, zz) => {
    const col = Math.floor(((SY1 - yy) / (SY1 - SY0)) * (cols + 1)) - 1;
    const row = Math.floor(((SZ1 - zz) / (SZ1 - SZ0)) * 7) - 1;
    if (row < 0 || row > 4 || col < 0) return false;
    let x = 0;
    for (const ch of label) {
      const g = FONT[ch];
      if (col >= x && col < x + g[0].length) return g[row][col - x] === '#';
      x += g[0].length + 1;
    }
    return false;
  };
  box(0, SY0, SZ0, 0.1, SY1, SZ1, [46, 40, 52], { grain: 0, face: (f, a, b) => (f === 'side' ? (letterAt(a, b) ? rgb(236, 226, 196) : null) : null) });

  // ── El rincón de muebles sueltos (sección «Muebles») ──
  box(1.4, 1.55, 0, 4.4, 3.55, 0.012, RED, {
    id: ID.muebles,
    grain: 0,
    face: (f, a, b) => {
      if (f !== 'top') return null;
      const e = Math.min(a - 1.4, 4.4 - a, b - 1.55, 3.55 - b);
      if (e < 0.08) return rgb(...CREAM);
      if (e < 0.16) return rgb(214, 168, 96);
      return (Math.abs(a - 2.9) + Math.abs(b - 2.55) * 1.3) % 0.6 < 0.07 ? rgb(214, 168, 96) : null;
    },
  });
  item('sillon', { x: 1.9, y: 1.4 }, 0, ID.muebles);
  item('lampara-pie', { x: 0.75, y: 1.1 }, 1, ID.muebles);
  item('mesilla', { x: 3.9, y: 1.35 }, 0, ID.muebles);
  item('lampara-mesa', { x: 3.9, y: 1.35 }, 0, ID.muebles, 0.9);
  // Etiqueta del precio colgando del sillón
  box(3.3, 3.42, 0.95, 3.52, 3.44, 1.22, CREAM, { id: ID.muebles, grain: 0 });
  }

  // ── Guirnalda y cuadro en la pared del fondo, sobre el mostrador ──
  item('guirnalda', { pared: 'fondo', a: 5.6 }, 0);
  item('cuadro', { pared: 'fondo', a: 5.4 }, 0);
  // Baldas detrás del mostrador con tarros y libros
  for (const z of [2.05, 2.85]) {
    box(7.0, 0, z, 9.8, 0.45, z + 0.08, WOOD_L);
    for (let x = 7.1; x < 9.6; x += 0.32) {
      const k = Math.floor(hash(x * 3, z) * 4);
      if (k === 0) box(x, 0.08, z + 0.08, x + 0.2, 0.3, z + 0.36, [216, 222, 210], { grain: 0 });
      else if (k === 1) box(x, 0.06, z + 0.08, x + 0.14, 0.36, z + 0.45, SPINES[Math.floor(hash(z, x) * SPINES.length)]);
      else if (k === 2) box(x, 0.1, z + 0.08, x + 0.22, 0.32, z + 0.24, [196, 120, 84]);
    }
  }

  // ── La dependienta, detrás del mostrador ──
  const cx = 8.35;
  const cy = 1.75;
  box(cx - 0.34, cy - 0.2, 0.8, cx + 0.34, cy + 0.2, 1.92, KNIT, { seed: 3 });
  box(cx - 0.17, cy + 0.2, 0.8, cx + 0.17, cy + 0.23, 1.74, GREEN, { grain: 0 });
  box(cx - 0.1, cy + 0.2, 1.74, cx + 0.1, cy + 0.24, 1.9, [244, 236, 220], { grain: 0 });
  // Brazos hacia el mostrador, con las manos encima
  for (const s of [-1, 1]) {
    box(cx + s * 0.34 - (s > 0 ? 0 : 0.12), cy - 0.12, 1.3, cx + s * 0.34 + (s > 0 ? 0.12 : 0), cy + 0.5, 1.6, KNIT, { seed: 5 });
    box(cx + s * 0.2 - 0.08, cy + 0.5, 1.46, cx + s * 0.2 + 0.08, cy + 0.72, 1.58, SKIN, { grain: 0 });
  }
  box(cx - 0.07, cy - 0.06, 1.92, cx + 0.07, cy + 0.06, 1.98, shade(SKIN, 0.85), { grain: 0 });
  const HX0 = cx - 0.25;
  const HX1 = cx + 0.25;
  const HY0 = cy - 0.22;
  const HY1 = cy + 0.24;
  const HZ0 = 1.98;
  const HZ1 = 2.48;
  // Cara: gafas redondas, ojos (o en arco, sonriendo), mofletes y boca, pintados sobre la cara de delante
  const faceAt = (a, b) => {
    const u = (a - HX0) / (HX1 - HX0);
    const v = (HZ1 - b) / (HZ1 - HZ0);
    for (const ec of [0.3, 0.7]) {
      const d = Math.hypot((u - ec) * 1.0, (v - 0.47) * 1.0);
      if (d > 0.14 && d < 0.19) return rgb(86, 56, 40);
      if (mood === 'happy') {
        if (Math.abs(v - (0.5 - (0.06 - Math.abs(u - ec)) * 0.9)) < 0.03 && Math.abs(u - ec) < 0.07) return rgb(52, 34, 28);
      } else if (Math.abs(u - ec) < 0.035 && Math.abs(v - 0.48) < 0.05) return rgb(44, 30, 26);
    }
    if (Math.abs(u - 0.5) < 0.05 && Math.abs(v - 0.45) < 0.02) return rgb(86, 56, 40);
    if (v > 0.6 && v < 0.66 && Math.abs(u - 0.15) < 0.06) return rgb(236, 150, 130);
    if (v > 0.6 && v < 0.66 && Math.abs(u - 0.85) < 0.06) return rgb(236, 150, 130);
    const mouth = mood === 'happy' ? Math.abs(v - (0.74 + (u - 0.5) ** 2 * -3)) < 0.03 && Math.abs(u - 0.5) < 0.1 : Math.abs(v - (0.75 + (u - 0.5) ** 2 * -2)) < 0.025 && Math.abs(u - 0.5) < 0.07;
    if (mouth) return rgb(168, 80, 64);
    if (v < 0.22) return rgb(...(hash(Math.floor(a * 40), Math.floor(b * 40)) > 0.7 ? HAIR_L : HAIR));
    if (v < 0.32 && (u < 0.15 || u > 0.85 || hash(Math.floor(a * 30), 2) > 0.55)) return rgb(...HAIR);
    return null;
  };
  box(HX0, HY0, HZ0, HX1, HY1, HZ1, SKIN, { grain: 0, step: 0.02, face: (f, a, b) => (f === 'front' ? faceAt(a, b) : f === 'side' && (b > HZ1 - 0.2 || a < cy + 0.02) ? rgb(...HAIR) : null) });
  // Pelo rizado: casquete, melena por detrás y por los lados, y el moño
  box(HX0 - 0.04, HY0 - 0.05, HZ1 - 0.06, HX1 + 0.04, HY1 - 0.08, HZ1 + 0.08, HAIR, { seed: 9 });
  box(HX0 - 0.05, HY0 - 0.06, HZ0 + 0.06, HX1 + 0.05, cy - 0.04, HZ1, HAIR, { seed: 11 });
  box(HX1, cy - 0.04, HZ0 + 0.12, HX1 + 0.05, HY1 - 0.06, HZ1, HAIR, { seed: 13 });
  box(cx + 0.02, cy - 0.2, HZ1 + 0.08, cx + 0.24, cy + 0.0, HZ1 + 0.3, HAIR_L, { seed: 15 });

  // ── El mostrador, con paneles, su caja verde, una lamparita y un timbre ──
  const panels = (a, b, from, to) => {
    const p = ((a - from) / (to - from)) * 3;
    const f = p % 1;
    if (b < 0.12 || b > 1.25) return null;
    if (f < 0.08 || f > 0.92 || b < 0.2 || b > 1.17) return rgb(...shade(WOOD, 0.75));
    if (f < 0.12 || f > 0.88 || b < 0.24 || b > 1.13) return rgb(...shade(WOOD, 1.08));
    return null;
  };
  // De cerca (la apertura de sobres, 1.76) el tablero es más hondo, para que el sobre y las cartas se apoyen en él:
  // tablas a lo largo con su veta y la misma madera, rampa y luz de tarde
  const front = near ? COUNTER_FRONT_NEAR : 3.38;
  const plank = (f, a) => (f === 'top' && near && (a - 6.3) % 0.62 < 0.025 ? rgb(...shade(WOOD, 0.62)) : null);
  box(6.4, 2.55, 0, 9.9, front - 0.13, 1.35, WOOD, { face: (f, a, b) => (f === 'front' ? panels(a, b, 6.4, 9.9) : null) });
  box(6.3, 2.45, 1.35, 10, front, 1.46, WOOD_L, { seed: 21, face: plank });
  box(7.0, 2.6, 1.46, 7.75, 3.15, 1.86, GREEN, { face: (f, a, b) => (f === 'front' && b > 1.66 && b < 1.8 && a > 7.12 && a < 7.63 ? rgb(150, 214, 160) : f === 'top' && (Math.floor(a * 12) + Math.floor(b * 12)) % 2 === 0 ? rgb(...shade(GREEN, 1.2)) : null) });
  box(7.15, 3.15, 1.5, 7.6, 3.2, 1.6, BRASS, { grain: 0 });
  if (!near) item('lampara-mesa', { x: 9.0, y: 2.5 }, 1, 0, 1.46);
  item('planta-pequena', { x: 6.45, y: 2.45 }, 0, 0, 1.46);
  box(8.3, 2.9, 1.46, 8.5, 3.1, 1.56, BRASS, { grain: 0 });
  box(8.37, 2.97, 1.56, 8.43, 3.03, 1.6, shade(BRASS, 0.7), { grain: 0 });
  r.castShadow(8.15, 2.9, 0.4, 1.9, 1, 0.5);

  const packs = [];
  if (!vacio) {
  // ── La caja de reciclaje (sección «Reciclar»): listones, cosas asomando y su cartelito con flechas ──
  const RX = near ? -20 : 5.3;
  const RY = 4.9;
  box(RX, RY, 0, RX + 1.1, RY + 0.9, 0.85, [176, 132, 86], {
    id: ID.reciclar,
    face: (f, a, b) => {
      const t = f === 'top' ? null : b;
      if (t !== null && (Math.abs(t - 0.28) < 0.04 || Math.abs(t - 0.58) < 0.04)) return rgb(120, 86, 54);
      if (f === 'front' && (Math.abs(a - RX - 0.06) < 0.05 || Math.abs(a - RX - 1.04) < 0.05)) return rgb(132, 96, 60);
      if (f === 'top') return Math.abs(a - RX - 0.55) < 0.48 && Math.abs(b - RY - 0.45) < 0.38 ? rgb(90, 64, 42) : null;
      return null;
    },
  });
  box(RX + 0.2, RY + 0.25, 0.7, RX + 0.6, RY + 0.55, 1.05, SPINES[1], { id: ID.reciclar });
  box(RX + 0.6, RY + 0.3, 0.75, RX + 0.66, RY + 0.36, 1.4, WOOD_D, { id: ID.reciclar, grain: 0 });
  box(RX + 0.68, RY + 0.4, 0.8, RX + 0.95, RY + 0.6, 0.95, [216, 222, 210], { id: ID.reciclar, grain: 0 });
  box(RX + 0.45, RY + 0.95, 0.15, RX + 0.5, RY + 1.0, 1.25, WOOD_D, { id: ID.reciclar, grain: 0 });
  box(RX + 0.15, RY + 0.95, 1.0, RX + 0.8, RY + 1.0, 1.42, CREAM, {
    id: ID.reciclar,
    grain: 0,
    face: (f, a, b) => {
      if (f !== 'front') return null;
      const u = (a - RX - 0.15) / 0.65;
      const v = (b - 1.0) / 0.42;
      const d = Math.hypot(u - 0.5, (v - 0.5) * 1.5);
      return d > 0.2 && d < 0.32 && !(u > 0.52 && v > 0.42 && v < 0.62) ? rgb(76, 120, 80) : null;
    },
  });
  r.castShadow(RX + 0.55, RY + 0.45, 0.25, 0.7, 1, 0.5);

  // ── El expositor de sobres (sección «Sobres»): gradas de madera con un tapete y los sobres de pie ──
  // 1.76: más ancho y con los sobres más grandes (maqueta), que se reconozcan desde la puerta
  const EX = 0.45;
  const EY = 5.35;
  const EW = 4.1;
  box(EX, EY, 0, EX + EW, EY + 1.25, 0.45, WOOD, { id: ID.sobres, face: (f, a, b) => (f === 'front' && b > 0.12 && b < 0.36 && Math.floor(a * 8) % 2 === 0 ? rgb(...shade(RED, 1.05)) : f === 'front' && b > 0.1 && b < 0.38 ? rgb(...RED) : null) });
  box(EX, EY, 0.45, EX + EW, EY + 0.65, 0.9, WOOD_D, { id: ID.sobres });
  box(EX, EY, 0.9, EX + EW, EY + 0.12, 2.0, WOOD_D, { id: ID.sobres });
  // La cara de cada sobre es el mismo dibujo del selector y del mostrador (packArt de shopArt.js), muestreado
  const packFace = (sobre, x0, x1, z0, z1) => {
    const { pixels } = packArt(sobre);
    return (f, a, b) => {
      if (f !== 'front') return null;
      const ix = Math.min(PACK_W - 1, Math.max(0, Math.floor(((a - x0) / (x1 - x0)) * PACK_W)));
      const iy = Math.min(PACK_H - 1, Math.max(0, Math.floor(((z1 - b) / (z1 - z0)) * PACK_H)));
      const i = (iy * PACK_W + ix) * 4;
      return pixels[i + 3] ? rgb(pixels[i], pixels[i + 1], pixels[i + 2]) : null;
    };
  };
  SOBRES.forEach((s, i) => {
    // En fila en la grada baja, de pie, cada uno con su taco detrás
    const x0 = EX + 0.12 + i * 0.98;
    const x1 = x0 + 0.9;
    const y = EY + 0.75;
    const z0 = 0.45;
    const z1 = z0 + 1.35;
    box(x0, y, z0, x1, y + 0.06, z1, [74, 112, 76], { id: ID.sobres, grain: 0, step: 0.02, face: packFace(s, x0, x1, z0, z1) });
    // Los de detrás de cada sobre (un taco)
    box(x0 + 0.04, y - 0.08, z0, x1 - 0.04, y, z1 - 0.06, shade([74, 112, 76], 0.7), { id: ID.sobres, grain: 0 });
    packs.push([x0, y, z0, x1, y + 0.06, z1]);
  });
  r.castShadow(EX + EW / 2, EY + 0.6, 0.3, EW / 2, 1, 0.5);
  }

  // ── Plantas y lámparas colgadas ──
  if (!near) item('planta-grande', { x: 9.0, y: 6.8 }, 0);
  item('planta-grande', { x: 0.1, y: 4.3 }, 1);
  for (const [lx, ly] of [[3.2, 3.6], [8.2, 4.4]]) {
    if (!near) box(lx - 0.03, ly - 0.03, 3.4, lx + 0.03, ly + 0.03, WH, DARK, { grain: 0 });
    box(lx - 0.32, ly - 0.32, 3.12, lx + 0.32, ly + 0.32, 3.42, GREEN, { seed: lx });
    box(lx - 0.2, ly - 0.2, 3.04, lx + 0.2, ly + 0.2, 3.12, [255, 236, 170], { glow: true, grain: 0 });
    lights.push([lx, ly, 3.0]);
  }
  lights.push([2.9, 0.4, 2.6]);
  return { lights, packs };
}

// El local en traspaso: cajas de cartón con su cinta, una escalera de pintor y lo que queda tapado con sábanas
const CARTON = [184, 142, 92];
const SABANA = [226, 220, 204];
function cajasDeMudanza(box, r) {
  const caja = (x, y, z, w, d, h, k) =>
    box(x, y, z, x + w, y + d, z + h, k % 2 ? CARTON : [170, 128, 82], {
      seed: k * 5 + 1,
      face: (f, a, b) => (f === 'top' && Math.abs(a - x - w / 2) < 0.05 ? rgb(214, 196, 150) : f !== 'top' && Math.abs(b - z - h + 0.06) < 0.04 ? rgb(214, 196, 150) : null),
    });
  // Dos montones en el rincón donde estaban los muebles sueltos y uno donde estaba el reciclaje
  caja(1.6, 1.8, 0, 0.9, 0.8, 0.62, 0);
  caja(1.7, 1.85, 0.62, 0.7, 0.7, 0.5, 1);
  caja(2.7, 2.1, 0, 0.8, 0.7, 0.55, 2);
  caja(5.3, 4.9, 0, 0.9, 0.8, 0.6, 3);
  caja(5.35, 4.95, 0.6, 0.8, 0.7, 0.45, 4);
  r.castShadow(2.3, 2.3, 0.25, 1.2, 1, 0.5);
  r.castShadow(5.75, 5.3, 0.25, 0.7, 1, 0.5);
  // Lo que queda del expositor y de una mesa, tapado con sábanas que caen hasta el suelo
  box(0.55, 5.4, 0, 3.4, 6.5, 0.85, SABANA, { seed: 31, face: (f, a, b) => (f !== 'top' && Math.floor(a * 6 + b * 3) % 3 === 0 ? rgb(204, 196, 178) : null) });
  box(0.75, 5.5, 0.85, 3.2, 6.4, 1.05, SABANA, { seed: 33 });
  box(3.7, 5.6, 0, 4.7, 6.4, 0.72, SABANA, { seed: 35 });
  r.castShadow(2.4, 6.0, 0.3, 2.0, 1, 0.5);
  // La escalera de pintor, abierta
  for (const [x0, x1] of [
    [4.1, 4.16],
    [4.5, 4.56],
  ])
    box(x0, 3.0, 0, x1, 3.06, 1.9, [150, 118, 80], { grain: 0 });
  for (let z = 0.4; z < 1.9; z += 0.45) box(4.1, 3.0, z, 4.56, 3.06, z + 0.05, [150, 118, 80], { grain: 0 });
}

/** Luz de tarde, como en los pisos: todo un poco más oscuro y tintado, y cada luz alumbra a su alrededor. */
export function evening(r, lights, radius) {
  const pts = lights.map(([x, y, z]) => r.project(x, y, z));
  const lit = r.rampOf(LIT);
  const { pix, ids, W } = r;
  for (let i = 0; i < pix.length; i += 1) {
    if (r.zb[i] < -1e8) continue;
    const p = pix[i];
    // Un píxel vacío (0) es transparente: el sobre tumbado tiene huecos entre los dientes
    if (!p) continue;
    if (ids[i] & GLOW) {
      const lum = ((p & 255) + ((p >> 8) & 255) + ((p >> 16) & 255)) / 765;
      pix[i] = lit[lum > 0.75 ? 4 : lum > 0.5 ? 3 : 2];
      continue;
    }
    const ix = i % W;
    const iy = (i / W) | 0;
    let g = 0;
    for (const l of pts) {
      const d = Math.hypot(ix - l.sx, (iy - l.sy) * 1.25) / radius;
      if (d < 1) g += (1 - d) ** 1.7;
    }
    g = Math.min(1, g);
    pix[i] = rgb((p & 255) * (0.72 + g * 0.45), ((p >> 8) & 255) * (0.66 + g * 0.38), ((p >> 16) & 255) * (0.8 + g * 0.06));
  }
}

export function toDataURL(r, fill, k = 1) {
  const c = document.createElement('canvas');
  c.width = r.W;
  c.height = r.H;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(r.W, r.H);
  for (let i = 0; i < r.pix.length; i += 1) if (!r.pix[i] || r.zb[i] < -1e8) r.pix[i] = fill(i % r.W, (i / r.W) | 0);
  img.data.set(new Uint8ClampedArray(r.pix.buffer));
  ctx.putImageData(img, 0, 0);
  if (k === 1) return c.toDataURL();
  const big = document.createElement('canvas');
  big.width = r.W * k;
  big.height = r.H * k;
  const bctx = big.getContext('2d');
  bctx.imageSmoothingEnabled = false;
  bctx.drawImage(c, 0, 0, big.width, big.height);
  return big.toDataURL();
}

const S_ROOM = 17;

/** Encuadre del local entero. */
function roomFrame() {
  const probe = createRaster({ W: 1, H: 1, S: S_ROOM, yaw: YAW, ox: 0, oy: 0 });
  const pts = [[SW, SD, 0], [SW, -WALL_T, 0], [-WALL_T, SD, 0], [-WALL_T, -WALL_T, WH], [SW, -WALL_T, WH], [-WALL_T, SD, WH]].map(([x, y, z]) => probe.project(x, y, z));
  const minX = Math.min(...pts.map((p) => p.sx));
  const maxX = Math.max(...pts.map((p) => p.sx));
  const minY = Math.min(...pts.map((p) => p.sy));
  const maxY = Math.max(...pts.map((p) => p.sy));
  return { W: Math.ceil(maxX - minX) + 6, H: Math.ceil(maxY - minY) + 6, ox: Math.round(3 - minX), oy: Math.round(3 - minY) };
}

const FRAME = roomFrame();
export const SHOP_ROOM_W = FRAME.W;
export const SHOP_ROOM_H = FRAME.H;

let roomCache = null;

/** El contorno de una sección: los píxeles de fuera que tocan a los suyos, en dorado (se enciende el de la elegida). */
export function outlineOf(r, id) {
  const { W, H, ids } = r;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(W, H);
  const out = new Uint32Array(img.data.buffer);
  const is = (x, y) => x >= 0 && y >= 0 && x < W && y < H && (ids[y * W + x] & ~GLOW) === id;
  for (let y = 0; y < H; y += 1)
    for (let x = 0; x < W; x += 1) {
      if (is(x, y)) continue;
      if (is(x - 1, y) || is(x + 1, y) || is(x, y - 1) || is(x, y + 1)) out[y * W + x] = rgb(255, 222, 120);
      else if (is(x - 1, y - 1) || is(x + 1, y - 1) || is(x - 1, y + 1) || is(x + 1, y + 1)) out[y * W + x] = rgb(122, 70, 36);
    }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL();
}

/**
 * El local entero: { scene, spots, tags, outlines, hit }. `spots`: el recuadro de cada sección (fracciones del dibujo);
 * `tags`: dónde cuelga su letrero; `outlines`: su contorno encendido (imagen del tamaño del dibujo); `hit(fx, fy)`:
 * qué sección hay bajo un punto (fracciones), o null.
 */
export function renderShopRoom({ vacio = false } = {}) {
  if (vacio) return renderVacio();
  if (roomCache) return roomCache;
  const r = createRaster({ W: FRAME.W, H: FRAME.H, S: S_ROOM, yaw: YAW, ox: FRAME.ox, oy: FRAME.oy });
  r.clear(0);
  const { lights } = buildShop(r, 'base');
  r.applyShadows();
  r.bakeOcclusion();
  r.shadeEdges();
  evening(r, lights, 70);
  // Recuadro de cada sección a partir de sus píxeles
  const spots = {};
  for (const [name, id] of Object.entries(ID)) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -1;
    let y1 = -1;
    for (let i = 0; i < r.ids.length; i += 1) {
      if ((r.ids[i] & ~GLOW) !== id) continue;
      const x = i % r.W;
      const y = (i / r.W) | 0;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
    spots[name] = { left: x0 / r.W, top: y0 / r.H, width: (x1 - x0 + 1) / r.W, height: (y1 - y0 + 1) / r.H };
  }
  const tags = Object.fromEntries(
    Object.entries(TAG_AT).map(([name, [x, y, z]]) => {
      const p = r.project(x, y, z);
      return [name, { left: p.sx / r.W, top: p.sy / r.H }];
    }),
  );
  const outlines = Object.fromEntries(Object.entries(ID).map(([name, id]) => [name, outlineOf(r, id)]));
  const names = Object.fromEntries(Object.entries(ID).map(([name, id]) => [id, name]));
  const ids = r.ids.slice();
  const { W, H } = r;
  // Con un poco de margen: lo que está a 2 píxeles de un objeto también cuenta como tocarlo
  const hit = (fx, fy) => {
    const cx = Math.floor(fx * W);
    const cy = Math.floor(fy * H);
    for (const [dx, dy] of [[0, 0], [-2, 0], [2, 0], [0, -2], [0, 2]]) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const name = names[ids[y * W + x] & ~GLOW];
      if (name) return name;
    }
    return null;
  };
  const scene = toDataURL(r, (x, y) => rgb(...(y < r.H * 0.5 ? [58, 42, 46] : [46, 34, 38])));
  roomCache = { scene, spots, tags, outlines, hit };
  return roomCache;
}

let vacioCache = null;
/** El local vacío, en traspaso (1.119): solo la imagen (sin WebGL, el café-librería se ve así). */
function renderVacio() {
  if (vacioCache) return vacioCache;
  const r = createRaster({ W: FRAME.W, H: FRAME.H, S: S_ROOM, yaw: YAW, ox: FRAME.ox, oy: FRAME.oy });
  r.clear(0);
  const { lights } = buildShop(r, 'base', false, true);
  r.applyShadows();
  r.bakeOcclusion();
  r.shadeEdges();
  evening(r, lights, 70);
  vacioCache = { scene: toDataURL(r, (x, y) => rgb(...(y < r.H * 0.5 ? [58, 42, 46] : [46, 34, 38]))) };
  return vacioCache;
}

export const COUNTER_W = 150;
export const COUNTER_H = 262;
// Se dibuja a la mitad, con la misma densidad de píxel que los pisos, y se amplía ×2 (píxel grande y nítido)
const S_NEAR = 44;
const YAW_NEAR = 0.2;
const NEAR_K = 1;
// Hasta dónde llega el tablero hacia la cámara en el plano de cerca (1.76), y dónde queda su fondo en la imagen
// El encuadre (1.76) baja la cámara: la dependienta queda arriba, con la cara libre, y el tablero se ve entero, con
// madera detrás de la primera fila de cartas y delante de la segunda
const COUNTER_FRONT_NEAR = 8.05;
const COUNTER_Z = 1.46;
const ANCHOR_Y = 0.344;
// Las dos filas de cartas (3 + 2): el fondo del tablero donde apoya cada una, y su ancho en fracciones de la imagen
const ROW_BACK = 5.05;
const ROW_FRONT = 7.65;
export const CARD_W = 0.26;
export const CARD_W1 = 0.34;
const counterCache = {};

/**
 * El mostrador de cerca (fondo de la apertura de sobres): la misma tienda con la cámara junto a la caja. `mood`: 'base'
 * o 'happy' (la dependienta sonríe con los ojos cerrados). Devuelve { scene, top, edge, at }: la imagen, dónde empieza y
 * acaba el tablero (fracciones de la altura) y `at(x, y)`, el punto del tablero (x, y del mundo, a la altura del tablero)
 * en fracciones del ancho y del alto de la imagen: ahí se apoyan el sobre y las cartas (1.76).
 */
/** La cámara del mostrador de cerca: el mismo encuadre para la escena, el sobre tumbado y los puntos del tablero. */
function counterCamera() {
  const probe = createRaster({ W: 1, H: 1, S: S_NEAR, yaw: YAW_NEAR, ox: 0, oy: 0 });
  // Casi centrada en la dependienta (algo a la izquierda, para que no se vea dónde acaba el local)
  const anchor = { sx: probe.project(7.85, 1.75, 1.46).sx, sy: probe.project(8.35, 2.9, 1.46).sy };
  const w = COUNTER_W / NEAR_K;
  const h = Math.round(COUNTER_H / NEAR_K);
  const ox = Math.round(w / 2 - anchor.sx);
  const oy = Math.round(h * ANCHOR_Y - anchor.sy);
  const raster = () => createRaster({ W: w, H: h, S: S_NEAR, yaw: YAW_NEAR, ox, oy });
  // Un punto del mundo (por defecto, a la altura del tablero) en fracciones del ancho y del alto de la imagen
  const at = (x, y, z = COUNTER_Z) => {
    const p = probe.project(x, y, z);
    return { left: (p.sx + ox) / w, top: (p.sy + oy) / h };
  };
  // Y al revés: el punto del tablero bajo un punto de la imagen (fracciones)
  const onBoard = (left, top) => probe.unprojectAtHeight(left * w - ox, top * h - oy, COUNTER_Z);
  return { w, h, raster, at, onBoard };
}

// El centro de la imagen, a cada fondo del tablero (la cámara está algo girada)
const centerX = (y) => 7.85 + (y - 1.75) * Math.tan(YAW_NEAR);

export function renderShopCounter(mood = 'base') {
  if (counterCache[mood]) return counterCache[mood];
  const { h, raster, at } = counterCamera();
  const r = raster();
  r.clear(0);
  const { lights } = buildShop(r, mood, true);
  r.applyShadows();
  r.bakeOcclusion();
  r.shadeEdges();
  evening(r, lights, 190);
  const top = r.project(8.35, 2.45, COUNTER_Z).sy / h;
  const edge = r.project(8.35, COUNTER_FRONT_NEAR, COUNTER_Z).sy / h;
  counterCache[mood] = { scene: toDataURL(r, () => rgb(58, 42, 46), NEAR_K), top, edge, at, lights };
  return counterCache[mood];
}

// El sobre en el tablero (1.76, maqueta de Francisco): de frente a la cámara, un tercio del ancho de la imagen y con la
// base apoyada en la madera; se inclina (la parte de arriba levantada) lo justo para que su alto visible sea 1,4 veces
// su ancho, así la faja enseña el mueble en su proporción. Su base, en fracciones de la imagen: cerrado, en el centro
// del tablero; abierto (cinco cartas), a la izquierda, con las otras cuatro en 2 × 2 a la derecha
const PACK_SW = 1 / 3;
const PACK_W_WORLD = (PACK_SW * COUNTER_W) / S_NEAR;
const PACK_L_WORLD = (PACK_W_WORLD * PACK_NEAR_H) / PACK_NEAR_W;
// Alto en la imagen por unidad a lo largo del sobre: 0,5·cos θ + 0,866·sen θ (la proyección); se despeja θ
const PACK_TILT = Math.PI / 3 - Math.acos((1.4 * PACK_W_WORLD) / PACK_L_WORLD);
const PACK_BASE = { left: 0.5, top: 0.676 };
const PACK_SIDE = { left: 0.227, top: 0.7 };
// Cuánto se hunde en el sobre la carta que asoma (fracción del alto de la imagen) y su giro
const PEEK_DEPTH = 0.034;
export const PEEK_TURN = -7;
// Los cuatro dorsos que esperan, en 2 × 2 a la derecha: centros de columna, bases de fila y ancho
const WAIT_COLS = [0.575, 0.825];
const WAIT_ROWS = [0.55, 0.75];
export const WAIT_W = 0.22;
// La tira rasgada, en la madera justo encima del sobre abierto: cuánto se aparta (fracciones de la imagen) y su giro
const STRIP_REST = { left: 0.1, top: -0.1 };
export const STRIP_TURN = 9;
// Lo que se abomba el sobre por el centro (unidades del mundo)
const PUFF = 0.15;
const packCache = new Map();

/**
 * La geometría del sobre en el tablero, sin dibujarlo: `point(u, v, lift)` es el punto del mundo en (u, v) del dibujo
 * (u de izquierda a derecha, v de abajo arriba, 0…1) levantado `lift` sobre su cara, y `normal` la de la cara.
 */
function packFrame() {
  const { at, onBoard } = counterCamera();
  const ca = Math.cos(YAW_NEAR);
  const sa = Math.sin(YAW_NEAR);
  const c = Math.cos(PACK_TILT);
  const sn = Math.sin(PACK_TILT);
  const base = onBoard(PACK_BASE.left, PACK_BASE.top);
  // A lo ancho, recto en la pantalla; a lo largo, hacia el fondo y hacia arriba
  const U = [ca, -sa, 0];
  const V = [-sa * c, -ca * c, sn];
  const N = [sa * sn, ca * sn, c];
  const point = (u, v, lift = 0) => [0, 1, 2].map((k) => [base.x, base.y, COUNTER_Z][k] + (u - 0.5) * PACK_W_WORLD * U[k] + v * PACK_L_WORLD * V[k] + lift * N[k]);
  const screen = (p) => at(p[0], p[1], p[2]);
  return { U, V, N, point, screen, at };
}

/** El abombado del sobre en (u, v): nada en los bordes ni en los sellados de arriba y abajo, lleno en el centro. */
function puffAt(u, v) {
  const crimp = Math.max(3, Math.round(PACK_NEAR_H * 0.0625)) / PACK_NEAR_H;
  const lip = 2 / PACK_NEAR_H;
  const t = (v - crimp) / (1 - lip - 2 * crimp);
  if (t <= 0 || t >= 1 || u <= 0 || u >= 1) return 0;
  return PUFF * Math.sin(Math.PI * u) ** 0.55 * Math.sin(Math.PI * t) ** 0.4;
}

/**
 * El sobre de `sobre` en el tablero del mostrador de cerca, dibujado con su misma cámara (raster.js) y de frente: la
 * tira de arriba (con la pestaña, levantada, y su sombra) y el cuerpo, cada uno en una imagen transparente del tamaño de
 * la escena, que se pone encima tal cual. Se abomba por el centro y la luz (del fondo a la izquierda) lo modela; en la
 * madera deja su sombra hacia delante a la derecha. Devuelve también, en fracciones de la imagen: `box` (su recuadro,
 * para tocarlo), `side` (cuánto se desliza a la izquierda al abrirse un sobre de cinco), `rest` y `stripAt` (dónde
 * queda la tira rasgada, girada `STRIP_TURN` grados alrededor de su centro), y `exit` / `stripExit`: cuánto se
 * desplazan a la izquierda, al terminar el reparto, hasta quedar fuera del encuadre (medido con sus píxeles dibujados,
 * sombra y giro incluidos, así no asoman ni en una pantalla estrecha).
 */
export function counterPack(sobre) {
  if (packCache.has(sobre.id)) return packCache.get(sobre.id);
  const { lights } = renderShopCounter('base');
  const { raster } = counterCamera();
  const { U, V, N, point } = packFrame();
  const px = packArt(sobre).near.pixels;
  const len = (a) => Math.hypot(...a);
  const unit = (a) => a.map((k) => k / len(a));
  // La luz llega del fondo a la izquierda y desde arriba
  const LIGHT = unit([-0.5, -0.6, 0.9]);
  const flat = N.reduce((acc, k, i) => acc + k * LIGHT[i], 0);
  const tab = PACK_NEAR_TAB;
  // Sombra en la madera, hacia delante y a la derecha según la altura
  const SHADOW = ((0x78 << 24) | (10 << 16) | (20 << 8) | 40) >>> 0;
  const part = (rows0, rows1) => {
    const r = raster();
    r.clear(0);
    const STEP = 3;
    const write = (p, color, d) => {
      const q = r.project(p[0], p[1], p[2]);
      const ix = q.sx | 0;
      const iy = q.sy | 0;
      if (ix < 0 || iy < 0 || ix >= r.W || iy >= r.H) return;
      const i = iy * r.W + ix;
      if ((d ?? q.d) <= r.zb[i]) return;
      r.zb[i] = d ?? q.d;
      r.pix[i] = color;
    };
    for (let iy = rows0 * STEP; iy < rows1 * STEP; iy += 1)
      for (let ix = 0; ix < PACK_NEAR_W * STEP; ix += 1) {
        const ax = Math.floor(ix / STEP);
        const ay = Math.floor(iy / STEP);
        const k = (ay * PACK_NEAR_W + ax) * 4;
        if (!px[k + 3]) continue;
        const u = (ix + 0.5) / (PACK_NEAR_W * STEP);
        const v = 1 - (iy + 0.5) / (PACK_NEAR_H * STEP);
        // La pestaña, levantada: se separa del sobre más cuanto más arriba
        const onTab = ax >= tab.x0 && ax <= tab.x1 && ay <= tab.y1;
        const lift = puffAt(u, v) + (onTab ? 0.03 + 0.06 * (1 - ay / tab.y1) : 0);
        // Normal del abombado (diferencias finitas) para la luz
        const e = 0.01;
        const du = (puffAt(u + e, v) - puffAt(u - e, v)) / (2 * e * PACK_W_WORLD);
        const dv = (puffAt(u, v + e) - puffAt(u, v - e)) / (2 * e * PACK_L_WORLD);
        const n = unit(N.map((c, i) => c - du * U[i] - dv * V[i]));
        const lit = n.reduce((acc, c, i) => acc + c * LIGHT[i], 0);
        const shade = Math.min(1.3, Math.max(0.62, 1 + 2.4 * (lit - flat)));
        write(point(u, v, lift), rgb(px[k] * shade, px[k + 1] * shade, px[k + 2] * shade));
      }
    evening(r, lights, 190);
    // La sombra en la madera: lo que queda a la vista a la derecha y delante del sobre
    for (let iy = rows0 * STEP; iy < rows1 * STEP; iy += 1)
      for (let ix = 0; ix < PACK_NEAR_W * STEP; ix += 1) {
        const k = (Math.floor(iy / STEP) * PACK_NEAR_W + Math.floor(ix / STEP)) * 4;
        if (!px[k + 3]) continue;
        const p = point((ix + 0.5) / (PACK_NEAR_W * STEP), 1 - (iy + 0.5) / (PACK_NEAR_H * STEP));
        const hgt = p[2] - COUNTER_Z;
        write([p[0] + 0.07 + hgt * 0.42, p[1] + 0.05 + hgt * 0.2, COUNTER_Z], SHADOW, -1e8 + 1);
      }
    // Lo dibujado de verdad (sobre y sombra), para saber cuánto hay que moverlo para que salga del encuadre
    const drawn = [];
    for (let i = 0; i < r.pix.length; i += 1) if (r.pix[i]) drawn.push([(i % r.W) + 1, ((i / r.W) | 0) + 0.5]);
    return { url: toDataURL(r, () => 0), drawn, W: r.W, H: r.H };
  };
  const strip = part(0, PACK_NEAR_TEAR);
  const body = part(PACK_NEAR_TEAR, PACK_NEAR_H);
  const geo = packGeometry();
  const MARGIN = 0.03;
  const bodyRight = Math.max(...body.drawn.map(([x]) => x)) / body.W;
  // La tira, ya en la madera: apartada `rest` y girada alrededor de su centro (la imagen se escala igual a lo ancho
  // y a lo alto, así que el giro en píxeles de la imagen es el mismo que en la pantalla)
  const turn = (STRIP_TURN * Math.PI) / 180;
  const o = [geo.stripAt.left * strip.W, geo.stripAt.top * strip.H];
  const stripRight = Math.max(...strip.drawn.map(([x, y]) => o[0] + (x - o[0]) * Math.cos(turn) - (y - o[1]) * Math.sin(turn))) / strip.W + STRIP_REST.left;
  const art = {
    strip: strip.url,
    body: body.url,
    ...geo,
    rest: STRIP_REST,
    exit: { left: -bodyRight - MARGIN, top: 0 },
    stripExit: { left: -stripRight - MARGIN, top: 0 },
  };
  packCache.set(sobre.id, art);
  return art;
}

/** Lo que no depende del dibujo: el recuadro del sobre, la boca, el centro de la tira y el deslizamiento a un lado. */
function packGeometry() {
  const { point, screen } = packFrame();
  const corners = [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ].map(([u, v]) => screen(point(u, v, 0)));
  const vTear = 1 - PACK_NEAR_TEAR / PACK_NEAR_H;
  return {
    box: {
      left: Math.min(...corners.map((c) => c.left)),
      right: Math.max(...corners.map((c) => c.left)),
      top: Math.min(...corners.map((c) => c.top)),
      bottom: Math.max(...corners.map((c) => c.top)),
    },
    mouth: screen(point(0.5, vTear, puffAt(0.5, vTear))),
    stripAt: screen(point(0.5, (1 + vTear) / 2, 0)),
    side: { left: PACK_SIDE.left - PACK_BASE.left, top: PACK_SIDE.top - PACK_BASE.top },
  };
}

/**
 * Dónde se apoyan las cartas en el tablero de cerca (1.76), en fracciones de la imagen del mostrador: la base de cada
 * una (abajo en el centro) y su ancho. `cards`: las posiciones definitivas (una centrada, o cinco en 3 + 2 dentro de
 * la madera), las mismas para revelarlas, elegirlas y tocarlas. `peek`: al abrir el sobre, la primera asoma por su
 * boca (girada `PEEK_TURN` grados) y, si son cinco, el sobre se ha deslizado a la izquierda y las otras cuatro
 * esperan boca abajo en 2 × 2 a la derecha, algo más pequeñas.
 */
export function counterLayout(n) {
  const { at } = counterCamera();
  const geo = packGeometry();
  const row = (y) => at(centerX(y), y);
  const shift = n === 1 ? { left: 0, top: 0 } : geo.side;
  const mouth = { left: geo.mouth.left + shift.left, top: geo.mouth.top + shift.top + PEEK_DEPTH, w: CARD_W };
  if (n === 1) {
    const one = row(5.25);
    return { side: shift, cards: [{ ...one, w: CARD_W1 }], peek: [mouth] };
  }
  // Cada fila, recta en la pantalla (el tablero está algo girado): su centro en el tablero y las cartas a los lados
  const back = row(ROW_BACK);
  const front = row(ROW_FRONT);
  const step = CARD_W + 0.05;
  const cards = [
    ...[-step, 0, step].map((dx) => ({ left: back.left + dx, top: back.top, w: CARD_W })),
    ...[-step / 2, step / 2].map((dx) => ({ left: front.left + dx, top: front.top, w: CARD_W })),
  ].slice(0, n);
  const waiting = WAIT_ROWS.flatMap((top) => WAIT_COLS.map((left) => ({ left, top, w: WAIT_W })));
  return { side: shift, cards, peek: [mouth, ...waiting].slice(0, n) };
}
