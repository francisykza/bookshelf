// La sala de lectura del Gran Hotel en primera persona (encargo de Francisco del 11-11-2026, bloque a de
// docs/qa/sala-lectura-3d.md), con el mismo modo de hacer que el casino (`casino3d.js`), el almacén y la recepción:
// Three.js a 320 px de ancho ampliado sin suavizar, texturas de píxel pintadas una vez con las rampas y el tramado del
// dibujo isométrico y la luz ya pintada en ellas (las lámparas de los sillones, las verdes de la mesa larga, la chimenea,
// la araña y la luna del ventanal); sin luces ni sombras en tiempo real. Solo se dibuja cuando algo cambia, salvo el fuego,
// la lluvia, el péndulo y los compañeros, que se mueven despacio (y nada con movimiento reducido).
// - Una biblioteca de noche, de doble altura: parqué en espiga, librerías de nogal hasta el techo con su galería alta y su
//   barandilla, la escalera de caracol y la corredera, el ventanal al puerto con lluvia y el faro, el reloj de pie (es el
//   reloj del Pomodoro), la chimenea de piedra con el sofá para dos, la mesa larga con lámparas verdes, seis sillones de
//   cuero con su lámpara y su mesita, y la librería común junto a la entrada, con los lomos que deja la gente.
// - Quien lee, sentado en su sillón con su personaje, un libro en las manos y su compañero al lado. Tu sillón tiene tu libro
//   en la mesita; al sentarte, la cámara baja al sillón y tienes tu libro abierto delante.
// Todo propio: ni arte, ni logos, ni decorados de bibliotecas, hoteles ni juegos reales.
import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  Color,
  Float32BufferAttribute,
  Fog,
  Group,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  LinearFilter,
  PerspectiveCamera,
  Plane,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Raycaster,
  SRGBColorSpace,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { createRaster, hash, noise, rgb } from '../../minigames/libreria-puerto/raster';
import { DEFAULT_AVATAR, actorBoxes } from '../actor';
import { MAPACHE, poseMapache } from '../mapache3d';
import { misticoOf, misticoSprite } from '../misticos';
import {
  CHIMENEA,
  EYE,
  GALERIA,
  GALERIA_ALTA,
  INICIO,
  LIBRERIA,
  MESA,
  NODOS,
  NUDO_SILLON,
  ORDEN_BALDAS,
  PUERTA,
  RELOJ,
  SD,
  SEAT_H,
  SH,
  SILLONES,
  SITIOS,
  SOFA,
  SW,
  VENTANAL,
  asientoDe,
  plazaDe,
  PLAZA_SOFA,
  dentro,
  lamparaDe,
  lomoDe,
  mesitaDe,
  onNet,
  route,
} from './salaLayout';

const ART_W = 320;
const PX = 16; // píxeles de textura por casilla en suelo, paredes y techo
const HFOV = 64;
const VFOV_LANDSCAPE = 62;
const VFOV_MAX = 92;
const PITCH = 0.03; // un poco hacia arriba: la sala es de triple altura y se mira la bóveda
const DRAG = 0.005;
const KEY_STEP = 0.1;
const WALK = 3.4; // casillas por segundo
const TAP_SLOP = 8;
const TAG_LEJOS = 22;
/** Cada cuánto se mueven el fuego, la lluvia, el péndulo y los compañeros (unos 12 cuadros por segundo). */
const VIVO_MS = 84;

const linear = ([r, g, b]) => new Color().setRGB(r / 255, g / 255, b / 255, SRGBColorSpace);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const frac = (v) => v - Math.floor(v);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
/** Un color de CSS (#rrggbb, hsl(), rgb()…) o [r, g, b] en [r, g, b]. */
function hex(c) {
  if (Array.isArray(c)) return c;
  let s = String(c ?? '#8a5a3a');
  if (!/^#[0-9a-f]{6}$/i.test(s)) {
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.fillStyle = '#8a5a3a';
    ctx.fillStyle = s;
    s = ctx.fillStyle;
  }
  const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(s);
  if (m) return [+m[1], +m[2], +m[3]];
  return [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
}

let probeRaster = null;
const probe = () => (probeRaster ??= createRaster({ W: 2, H: 2, S: 1, yaw: 0, ox: 0, oy: 0 }));
const unpack = (p) => [p & 255, (p >> 8) & 255, (p >> 16) & 255];

// ── La paleta de la biblioteca ──
const WALNUT = [98, 60, 40];
const WALNUT_D = [70, 42, 30];
const OAK = [150, 104, 64];
const GOLD = [226, 184, 100];
const GOLD_D = [150, 110, 52];
const LEATHER = [126, 56, 38];
const VELVET = [52, 92, 70];
const STONE = [150, 140, 128];
const STONE_D = [104, 96, 90];
const RUG = [44, 74, 104];
const RUG_R = [126, 40, 46];
const CREAM = [242, 232, 208];
const PAPER = [236, 226, 200];
const LAMP = [255, 204, 128];
const GREEN_LAMP = [70, 150, 96];
const GLASS = [26, 40, 78];
const PLASTER = [196, 178, 150];
const BOOKS = [
  [150, 54, 48],
  [52, 92, 110],
  [176, 136, 70],
  [64, 104, 76],
  [120, 70, 110],
  [214, 196, 160],
  [84, 60, 100],
  [168, 90, 52],
];

// ── La luz, pintada: la lámpara de cada sillón, las verdes de la mesa, la chimenea, la araña, la luna y la entrada ──
const LUCES = [
  ...SILLONES.map((_, k) => {
    const l = lamparaDe(k);
    return { at: [l.x, l.y, 1.75], k: 0.8, reach: 3.5 };
  }),
  { at: [MESA.x0 + 0.9, (MESA.y0 + MESA.y1) / 2, 1.4], k: 0.5, reach: 2.2 },
  { at: [MESA.x1 - 0.9, (MESA.y0 + MESA.y1) / 2, 1.4], k: 0.5, reach: 2.2 },
  { at: [0.9, (CHIMENEA.y0 + CHIMENEA.y1) / 2, 0.6], k: 1.0, reach: 4.4 },
  { at: [7, 9.5, SH - 3.4], k: 0.6, reach: 7.5 },
  { at: [7, 9.5, SH - 0.6], k: 0.3, reach: 5.5 },
  { at: [7, 0.4, 2.2], k: 0.3, reach: 4.0 },
  { at: [7, SD - 0.3, 2.6], k: 0.45, reach: 3.4 },
];
function glowAt(x, y, z) {
  let g = 0.08;
  for (const { at, k, reach } of LUCES) {
    const d = Math.hypot(x - at[0], y - at[1], (z - at[2]) * 1.15) / reach;
    if (d < 1) g += k * (1 - d) ** 1.5;
  }
  return Math.min(1, g);
}
// De lejos, azul de noche; de cerca de una lámpara, ámbar
const FAR = [0.66, 0.55, 0.62];
const NEAR = [1.14, 0.95, 0.7];
const BANDS = 6;
function lit(c, g, ix, iy) {
  const r = probe();
  const band = clamp(Math.floor(g * BANDS + 0.5 + (r.bayerAt(ix, iy) - 0.5) * 0.35), 0, BANDS) / BANDS;
  const [cr, cg, cb] = typeof c === 'number' ? unpack(c) : c;
  return rgb(cr * lerp(FAR[0], NEAR[0], band), cg * lerp(FAR[1], NEAR[1], band), cb * lerp(FAR[2], NEAR[2], band));
}
function litColor(c, g, tone) {
  const band = Math.round(g * BANDS) / BANDS;
  const cc = typeof c === 'number' ? unpack(c) : c;
  return linear([0, 1, 2].map((i) => clamp(cc[i] * tone * lerp(FAR[i], NEAR[i], band), 0, 255)));
}

function texture(canvas, smooth = false) {
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  t.magFilter = smooth ? LinearFilter : NearestFilter;
  t.minFilter = smooth ? LinearFilter : NearestFilter;
  return t;
}
function canvasOf(w, h, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const pixels = new Uint32Array(w * h);
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) pixels[y * w + x] = paint(x, y);
  canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(pixels.buffer), w, h), 0, 0);
  return canvas;
}

// ── El suelo: parqué en espiga, una alfombra azul delante del ventanal y otra granate ante la chimenea ──
function paintFloor() {
  const r = probe();
  const oak = r.rampOf(OAK);
  const rug = r.rampOf(RUG);
  const rugR = r.rampOf(RUG_R);
  const gold = r.rampOf(GOLD_D);
  return canvasOf(SW * PX, SD * PX, (ix, iy) => {
    const x = (ix + 0.5) / PX;
    const y = (iy + 0.5) / PX; // el suelo, girado −90°: la fila de arriba de la textura es la pared del fondo (y = 0)
    const g = glowAt(x, y, 0);
    // La alfombra del ventanal, con su filete dorado y un dibujo de rombos
    const alfombra = (x0, x1, y0, y1, ramp) => {
      if (x < x0 || x > x1 || y < y0 || y > y1) return null;
      const e = Math.min(x - x0, x1 - x, y - y0, y1 - y);
      if (e < 0.08) return lit(ramp[1], g, ix, iy);
      if (e > 0.16 && e < 0.22) return lit(gold[3], g, ix, iy);
      if (e < 0.3) return lit(ramp[2], g, ix, iy);
      const u = Math.abs(frac((x - x0) / 0.9) - 0.5) + Math.abs(frac((y - y0) / 0.9) - 0.5);
      if (Math.abs(u - 0.32) < 0.04) return lit(ramp[4], g, ix, iy);
      return lit(ramp[noise(x * 5, y * 5) > 0.75 ? 2 : 3], g, ix, iy);
    };
    const a = alfombra(3.3, 10.7, 1.2, 4.6, rug) ?? alfombra(1.3, 4.3, 8.4, 11.6, rugR);
    if (a != null) return a;
    // La espiga: tablillas a 45° que cambian de sentido en cada hilera
    const row = Math.floor(x / 0.5);
    const u = (row % 2 ? y + x : y - x) / 0.34;
    const plank = Math.floor(u);
    if (frac(u) < 0.08 || frac(x / 0.5) < 0.05) return lit(oak[1], g, ix, iy);
    const d = (r.bayerAt(ix, iy) - 0.5) * 0.5;
    return lit(oak[Math.max(1, Math.min(4, Math.floor(2.5 + (noise(plank, row * 3) - 0.5) * 1.6 + d)))], g, ix, iy);
  });
}

/** Una librería pintada: armarios abajo, baldas de nogal con lomos de colores, la galería y la cornisa. */
function shelfPx(a, b, g, ix, iy, seed) {
  const r = probe();
  const walnut = r.rampOf(WALNUT);
  const gold = r.rampOf(GOLD);
  if (b > SH - 0.42) return lit(b > SH - 0.12 ? gold[2] : walnut[b > SH - 0.3 ? 3 : 2], g, ix, iy);
  if (b < 0.55) {
    // Los armarios bajos, con su moldura
    const u = a % 1.0;
    return lit(walnut[u < 0.05 || u > 0.95 || b < 0.08 || b > 0.48 ? 1 : 3], g, ix, iy);
  }
  // La galería pasa a esta altura: su canto de nogal (el suelo es una caja aparte)
  if (b > GALERIA.z - 0.05 && b < GALERIA.z + 0.24) return lit(walnut[b > GALERIA.z + 0.18 ? 3 : 1], g, ix, iy);
  if (b > GALERIA_ALTA.z - 0.05 && b < GALERIA_ALTA.z + 0.24) return lit(walnut[b > GALERIA_ALTA.z + 0.18 ? 3 : 1], g, ix, iy);
  if (a % 1.5 < 0.09) return lit(walnut[2], g, ix, iy);
  const base = b > GALERIA_ALTA.z ? GALERIA_ALTA.z + 0.24 : b > GALERIA.z ? GALERIA.z + 0.24 : 0.55;
  const band = (b - base) % 0.5;
  if (band < 0.07) return lit(walnut[band < 0.03 ? 4 : 3], g, ix, iy);
  const spine = Math.floor(a * 10 + seed);
  const shelf = Math.floor((b - base) / 0.5);
  const n = noise(spine * 1.7 + seed, shelf * 3.1 + seed * 0.3);
  if (band > 0.3 + n * 0.17) return lit(walnut[0], g, ix, iy);
  if (n < 0.1) return lit(walnut[0], g, ix, iy);
  const c = BOOKS[Math.floor(n * 53) % BOOKS.length];
  const k = (a * 10) % 1 < 0.14 ? 0.62 : r.bayerAt(ix, iy) > 0.85 ? 1.1 : band > 0.25 && band < 0.29 && n > 0.5 ? 1.35 : 0.92;
  return lit([c[0] * k, c[1] * k, c[2] * k], g, ix, iy);
}

function paintWall(w, world, extra = () => null, seed = 0) {
  const h = Math.round(SH * PX);
  return canvasOf(Math.round(w * PX), h, (ix, iy) => {
    const a = (ix + 0.5) / PX;
    const b = SH - (iy + 0.5) / PX;
    const own = extra(a, b, ix, iy);
    if (own != null) return own;
    return shelfPx(a, b, glowAt(...world(a, b)), ix, iy, seed);
  });
}

// El ventanal al puerto (bajo la galería) y los ventanucos altos, de noche
function fondoExtra(a, b, ix, iy) {
  const r = probe();
  const walnut = r.rampOf(WALNUT);
  const gold = r.rampOf(GOLD);
  const g = glowAt(a, 0.3, b);
  const { x0, x1, z0, z1 } = VENTANAL;
  if (a > x0 - 0.18 && a < x1 + 0.18 && b > z0 - 0.15 && b < z1 + 0.12) {
    if (a < x0 || a > x1 || b < z0 || b > z1) return lit(walnut[a < x0 - 0.1 || a > x1 + 0.1 || b < z0 - 0.08 ? 2 : 3], g, ix, iy);
    // Parteluces: tres huecos con su cruz
    const hueco = (x1 - x0) / 3;
    const u = (a - x0) % hueco;
    if (u < 0.06 || u > hueco - 0.06 || Math.abs(b - (z0 + z1) / 2 - 0.4) < 0.04) return lit(walnut[3], g, ix, iy);
    return ventanaNoche(a, b);
  }
  // Los tres ventanucos altos de medio punto, sobre la galería
  for (const cx of [4.2, 7, 9.8]) {
    const dx = a - cx;
    const top = GALERIA.z + 2.3;
    if (Math.abs(dx) < 0.85 && b > GALERIA.z + 0.55 && (b < top || Math.hypot(dx, b - top) < 0.85)) {
      const borde = Math.abs(dx) > 0.75 || b < GALERIA.z + 0.63 || (b > top && Math.hypot(dx, b - top) > 0.75);
      if (borde) return lit(gold[2], g + 0.05, ix, iy);
      if (Math.abs(dx) < 0.03) return lit(walnut[3], g, ix, iy);
      const luna = cx === 7 && Math.hypot(dx - 0.3, b - top - 0.1) < 0.28;
      if (luna) return Math.hypot(dx - 0.42, b - top - 0.2) < 0.22 ? rgb(...GLASS) : rgb(236, 232, 206);
      return noise(a * 17, b * 17) > 0.94 ? rgb(214, 214, 236) : rgb(...GLASS);
    }
  }
  return null;
}
/** El puerto de noche por el ventanal: cielo, el faro en su cabo, el agua con los reflejos y las luces del muelle. */
function ventanaNoche(a, b) {
  const { x0, x1, z0 } = VENTANAL;
  const u = (a - x0) / (x1 - x0);
  const horizonte = z0 + 1.15;
  if (b < horizonte) {
    // El agua: franjas de reflejos de las luces del muelle
    const ola = noise(a * 9, b * 30);
    if (b < z0 + 0.35) return ola > 0.55 ? rgb(70, 64, 60) : rgb(48, 44, 48);
    const luz = Math.abs(frac(u * 5) - 0.5) < 0.05 && ola > 0.4;
    return luz ? rgb(214, 170, 96) : ola > 0.82 ? rgb(46, 66, 104) : rgb(18, 28, 54);
  }
  // El cabo con el faro, a la izquierda
  const cabo = horizonte + 0.32 * Math.max(0, 1 - u * 3.2);
  if (b < cabo) return rgb(14, 18, 30);
  if (u > 0.12 && u < 0.15 && b < cabo + 0.62) return b > cabo + 0.5 ? rgb(255, 236, 170) : Math.floor(b * 14) % 2 ? rgb(214, 210, 200) : rgb(160, 50, 50);
  // Las luces del otro lado del puerto
  if (b < horizonte + 0.05 && noise(a * 21, 3) > 0.7) return rgb(236, 196, 120);
  return noise(a * 13, b * 13) > 0.95 ? rgb(214, 214, 236) : rgb(...GLASS);
}

// La chimenea, en la pared izquierda (el pecho de piedra es una caja; aquí, la piedra que sube hasta la galería)
function izquierdaExtra(a, b, ix, iy) {
  const y = SD - a;
  if (y < CHIMENEA.y0 || y > CHIMENEA.y1 || b > GALERIA.z) return null;
  const r = probe();
  const stone = r.rampOf(STONE);
  const g = glowAt(0.3, y, b);
  const fila = Math.floor(b / 0.32);
  const u = (y + (fila % 2) * 0.27) / 0.54;
  if (frac(u) < 0.05 || frac(b / 0.32) < 0.08) return lit(stone[1], g, ix, iy);
  return lit(stone[noise(Math.floor(u), fila) > 0.6 ? 3 : 2], g, ix, iy);
}

// La puerta acristalada de la entrada, con la luz del pasillo del hotel al otro lado
function delanteExtra(a, b, ix, iy) {
  const x = SW - a;
  if (x < PUERTA.x0 - 0.2 || x > PUERTA.x1 + 0.2 || b > PUERTA.alto + 0.6) return null;
  const r = probe();
  const walnut = r.rampOf(WALNUT);
  const gold = r.rampOf(GOLD);
  const g = glowAt(x, SD - 0.3, b);
  if (x < PUERTA.x0 || x > PUERTA.x1 || b > PUERTA.alto) {
    // El dintel con su cartela de latón
    if (b > PUERTA.alto + 0.18 && b < PUERTA.alto + 0.48 && Math.abs(x - 7) < 0.9) return lit(gold[Math.abs(x - 7) > 0.84 || b < PUERTA.alto + 0.22 ? 2 : 4], g + 0.15, ix, iy);
    return lit(walnut[2], g, ix, iy);
  }
  const u = x - PUERTA.x0;
  const mitad = (PUERTA.x1 - PUERTA.x0) / 2;
  const v = u % mitad;
  if (v < 0.1 || v > mitad - 0.1 || b < 0.9 || b > PUERTA.alto - 0.1) return lit(walnut[v < 0.04 || b < 0.05 ? 1 : 3], g, ix, iy);
  // Cristal con su retícula; al otro lado, la luz cálida del pasillo
  if (Math.abs(((b - 0.9) % 0.55) - 0.27) > 0.25 || Math.abs((v % 0.5) - 0.25) > 0.235) return lit(gold[2], g, ix, iy);
  return noise(x * 6, b * 6) > 0.85 ? rgb(255, 230, 176) : rgb(232, 196, 136);
}

// ── El techo: artesonado de nogal con el rosetón de la araña ──
function paintCeiling() {
  const r = probe();
  const walnut = r.rampOf(WALNUT_D);
  const plaster = r.rampOf(PLASTER);
  const gold = r.rampOf(GOLD_D);
  return canvasOf(SW * PX, SD * PX, (ix, iy) => {
    const x = (ix + 0.5) / PX;
    const y = SD - (iy + 0.5) / PX;
    const g = glowAt(x, y, SH) * 0.9;
    const d = Math.hypot(x - 7, y - 9.5);
    if (d < 1.5) {
      // El rosetón: anillos de oro y rayos
      const rayo = Math.abs(frac((Math.atan2(y - 9.5, x - 7) / Math.PI) * 8) - 0.5) < 0.12;
      if (Math.abs(d - 1.4) < 0.06 || Math.abs(d - 0.9) < 0.05 || d < 0.3) return lit(gold[4], g + 0.25, ix, iy);
      return lit(rayo && d > 0.3 && d < 0.9 ? gold[3] : plaster[d < 0.9 ? 3 : 2], g + 0.15, ix, iy);
    }
    const u = frac(x / 2.0);
    const v = frac(y / 2.0);
    if (u < 0.08 || v < 0.08) return lit(walnut[u < 0.03 || v < 0.03 ? 1 : 3], g, ix, iy);
    const marco = u < 0.14 || v < 0.14 || u > 0.94 || v > 0.94;
    if (marco) return lit(gold[u < 0.11 || v < 0.11 || u > 0.97 || v > 0.97 ? 2 : 3], g + 0.1, ix, iy);
    // Dentro de cada artesón, el cielo: azul de noche, estrellas y alguna constelación dorada
    const n = noise(x * 9, y * 9);
    const estrella = hash(Math.floor(x * 10), Math.floor(y * 10));
    if (estrella > 0.993) return rgb(255, 228, 160);
    if (estrella > 0.984) return rgb(200, 196, 230);
    const azul = 0.7 + 0.3 * (1 - Math.min(1, Math.hypot(u - 0.55, v - 0.55) * 1.6));
    return rgb(28 * azul + n * 6, 30 * azul + n * 6, 70 * azul + n * 10);
  });
}

// ── Cajas: mundo de la app (x, y a lo hondo, z arriba) → Three (x, z, y) ──
const FACE_TONE = { top: 1.06, bottom: 0.6, front: 0.92, back: 0.74, right: 0.84, left: 0.8 };
function pushBox(out, [x0, y0, z0, x1, y1, z1], color, { glow = false, g = null } = {}) {
  const gl = glow ? 0 : (g ?? glowAt((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2));
  const faces = [
    [
      'front',
      [
        [x0, z0, y1],
        [x1, z0, y1],
        [x1, z1, y1],
        [x0, z1, y1],
      ],
      [0, 0, 1],
    ],
    [
      'back',
      [
        [x1, z0, y0],
        [x0, z0, y0],
        [x0, z1, y0],
        [x1, z1, y0],
      ],
      [0, 0, -1],
    ],
    [
      'right',
      [
        [x1, z0, y1],
        [x1, z0, y0],
        [x1, z1, y0],
        [x1, z1, y1],
      ],
      [1, 0, 0],
    ],
    [
      'left',
      [
        [x0, z0, y0],
        [x0, z0, y1],
        [x0, z1, y1],
        [x0, z1, y0],
      ],
      [-1, 0, 0],
    ],
    [
      'top',
      [
        [x0, z1, y1],
        [x1, z1, y1],
        [x1, z1, y0],
        [x0, z1, y0],
      ],
      [0, 1, 0],
    ],
    [
      'bottom',
      [
        [x0, z0, y0],
        [x1, z0, y0],
        [x1, z0, y1],
        [x0, z0, y1],
      ],
      [0, -1, 0],
    ],
  ];
  for (const [name, [a, b, c, d], n] of faces) {
    const col = glow ? linear(typeof color === 'number' ? unpack(color) : color) : litColor(color, gl, FACE_TONE[name]);
    for (const p of [a, b, c, a, c, d]) {
      out.pos.push(...p);
      out.nor.push(...n);
      out.col.push(col.r, col.g, col.b);
    }
  }
}
const kit = () => ({ pos: [], nor: [], col: [] });
function geometryOf({ pos, nor, col }) {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  return g;
}
/** Un disco hecho de franjas (mesitas redondas): `r` de radio. */
function disco(s, x, y, r, z0, z1, color, opt, n = 8) {
  const dy = (2 * r) / n;
  for (let k = 0; k < n; k += 1) {
    const ya = y - r + k * dy;
    const t = (k + 0.5) / n;
    const w = r * Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2));
    if (w > 0.01) pushBox(s, [x - w, ya, z0, x + w, ya + dy, z1], color, opt);
  }
}

/** La galería alta: el suelo de nogal, su barandilla de balaustres y el pasamanos de latón, en los dos lados y el fondo. */
function galeria(s) {
  const z = GALERIA.z;
  const f = GALERIA.fondo;
  const tramos = [
    [0, 0, f, GALERIA.y1],
    [SW - f, 0, SW, GALERIA.y1],
    [f, 0, SW - f, f],
  ];
  for (const [x0, y0, x1, y1] of tramos) pushBox(s, [x0, y0, z - 0.22, x1, y1, z], WALNUT);
  // Los balaustres y el pasamanos, a lo largo del borde
  const rail = (ax, ay, bx, by) => {
    const n = Math.max(2, Math.round(Math.hypot(bx - ax, by - ay) / 0.32));
    for (let k = 0; k <= n; k += 1) {
      const x = lerp(ax, bx, k / n);
      const y = lerp(ay, by, k / n);
      pushBox(s, [x - 0.035, y - 0.035, z, x + 0.035, y + 0.035, z + 0.82], WALNUT_D);
    }
    const w = 0.05;
    pushBox(s, [Math.min(ax, bx) - w, Math.min(ay, by) - w, z + 0.82, Math.max(ax, bx) + w, Math.max(ay, by) + w, z + 0.9], GOLD);
    pushBox(s, [Math.min(ax, bx) - w, Math.min(ay, by) - w, z + 0.1, Math.max(ax, bx) + w, Math.max(ay, by) + w, z + 0.14], WALNUT_D);
  };
  rail(f, f, f, GALERIA.y1);
  rail(SW - f, f, SW - f, GALERIA.y1);
  rail(f, f, SW - f, f);
  rail(0, GALERIA.y1, f, GALERIA.y1);
  rail(SW - f, GALERIA.y1, SW, GALERIA.y1);
  // Las ménsulas que la sostienen
  for (let y = 1.5; y < GALERIA.y1; y += 2.0) {
    for (const x of [f - 0.12, SW - f]) pushBox(s, [x, y - 0.08, z - 0.6, x + 0.12, y + 0.08, z - 0.22], WALNUT_D);
  }
  // La escalera de caracol, en la esquina de delante a la izquierda: un mástil y peldaños en abanico
  const cx = 1.05;
  const cy = 15.4;
  pushBox(s, [cx - 0.07, cy - 0.07, 0, cx + 0.07, cy + 0.07, z + 1.0], GOLD_D);
  const pasos = 14;
  for (let k = 0; k < pasos; k += 1) {
    const ang = (k / pasos) * Math.PI * 1.7 - Math.PI * 0.2;
    const zz = ((k + 1) / pasos) * z;
    const ex = cx + Math.cos(ang) * 0.48;
    const ey = cy + Math.sin(ang) * 0.48;
    pushBox(s, [Math.min(cx, ex) - 0.12, Math.min(cy, ey) - 0.12, zz - 0.06, Math.max(cx, ex) + 0.12, Math.max(cy, ey) + 0.12, zz], WALNUT);
    pushBox(s, [ex - 0.02, ey - 0.02, zz, ex + 0.02, ey + 0.02, zz + 0.8], GOLD_D);
  }
  // Un rellano que la une a la galería
  pushBox(s, [0, GALERIA.y1, z - 0.22, 1.5, 15.0, z], WALNUT);
}

/** La galería alta: un anillo de nogal por las cuatro paredes, con balaustres y pasamanos dorado, bajo la bóveda. */
function galeriaAlta(s) {
  const { z, fondo: f } = GALERIA_ALTA;
  for (const [x0, y0, x1, y1] of [
    [0, 0, f, SD],
    [SW - f, 0, SW, SD],
    [f, 0, SW - f, f],
    [f, SD - f, SW - f, SD],
  ])
    pushBox(s, [x0, y0, z - 0.2, x1, y1, z], WALNUT);
  const rail = (ax, ay, bx, by) => {
    const n = Math.max(2, Math.round(Math.hypot(bx - ax, by - ay) / 0.3));
    for (let k = 0; k <= n; k += 1) {
      const x = lerp(ax, bx, k / n);
      const y = lerp(ay, by, k / n);
      pushBox(s, [x - 0.03, y - 0.03, z, x + 0.03, y + 0.03, z + 0.75], WALNUT_D);
    }
    const w = 0.045;
    pushBox(s, [Math.min(ax, bx) - w, Math.min(ay, by) - w, z + 0.75, Math.max(ax, bx) + w, Math.max(ay, by) + w, z + 0.82], GOLD, { g: 0.75 });
  };
  rail(f, f, f, SD - f);
  rail(SW - f, f, SW - f, SD - f);
  rail(f, f, SW - f, f);
  rail(f, SD - f, SW - f, SD - f);
  // Ménsulas talladas y, en cada una, un farolillo que alumbra la galería
  for (let y = 1.6; y < SD - 1; y += 2.4) {
    for (const x of [f - 0.1, SW - f]) {
      pushBox(s, [x, y - 0.07, z - 0.55, x + 0.1, y + 0.07, z - 0.2], WALNUT_D);
      const lx = x < SW / 2 ? f + 0.05 : SW - f - 0.15;
      pushBox(s, [lx, y - 0.05, z + 0.82, lx + 0.1, y + 0.05, z + 0.98], LAMP, { glow: true });
    }
  }
}

/** La escalera corredera de latón, apoyada en la librería de la derecha. */
function corredera(s) {
  const x = SW - 0.62;
  const y = 12.2;
  for (const dy of [-0.26, 0.26]) pushBox(s, [x - 0.03, y + dy - 0.03, 0, x + 0.03, y + dy + 0.03, GALERIA.z - 0.3], WALNUT_D);
  for (let z = 0.3; z < GALERIA.z - 0.4; z += 0.36) pushBox(s, [x - 0.02, y - 0.26, z, x + 0.02, y + 0.26, z + 0.04], GOLD);
  pushBox(s, [SW - 0.35, y - 0.5, GALERIA.z - 0.42, SW - 0.3, y + 0.5, GALERIA.z - 0.36], GOLD);
}

/** El sillón de cuero de orejas, mirando a `facing` (0: +y; 3: −x). */
function sillon(s, x, y, facing, seed) {
  const frontal = facing === 0;
  const box = (b, c = LEATHER, opt) => {
    // En el mundo: girar las cajas del sillón «de frente» un cuarto si mira a −x
    const [x0, y0, z0, x1, y1, z1] = b;
    if (frontal) return pushBox(s, [x + x0, y + y0, z0, x + x1, y + y1, z1], c, opt);
    return pushBox(s, [x - y1, y + x0, z0, x - y0, y + x1, z1], c, opt);
  };
  const piel = [LEATHER[0] + (seed % 3) * 6, LEATHER[1], LEATHER[2]];
  const clara = [piel[0] * 1.14, piel[1] * 1.1, piel[2] * 1.1];
  const honda = [piel[0] * 0.62, piel[1] * 0.6, piel[2] * 0.6];
  // El cuerpo, el faldón con su vivo y el cojín del asiento (con su costura)
  box([-0.56, -0.5, 0.14, 0.56, 0.56, SEAT_H - 0.12], piel);
  box([-0.57, 0.5, 0.14, 0.57, 0.58, 0.2], honda);
  box([-0.46, -0.36, SEAT_H - 0.12, 0.46, 0.52, SEAT_H], clara);
  box([-0.46, 0.5, SEAT_H - 0.07, 0.46, 0.53, SEAT_H - 0.05], honda);
  // El respaldo alto, con un cojín de cabeza
  box([-0.56, -0.62, 0.14, 0.56, -0.38, 1.62], piel);
  box([-0.4, -0.4, 1.28, 0.4, -0.3, 1.52], clara);
  // Las orejas, redondeadas por arriba
  for (const sx of [-1, 1]) {
    box([sx * 0.56 - (sx > 0 ? 0.16 : 0), -0.62, 1.1, sx * 0.56 + (sx > 0 ? 0 : 0.16), -0.2, 1.5], piel);
    box([sx * 0.56 - (sx > 0 ? 0.13 : 0.03), -0.6, 1.5, sx * 0.56 + (sx > 0 ? -0.03 : 0.13), -0.24, 1.56], piel);
  }
  // Los brazos enrollados, con su voluta delante
  for (const sx of [-1, 1]) {
    box([sx * 0.56 - (sx > 0 ? 0.14 : 0), -0.5, SEAT_H - 0.12, sx * 0.56 + (sx > 0 ? 0 : 0.14), 0.56, 0.92], piel);
    box([sx * 0.56 - (sx > 0 ? 0.17 : -0.03), -0.46, 0.92, sx * 0.56 + (sx > 0 ? 0.03 : 0.17), 0.58, 1.0], clara);
    box([sx * 0.56 - (sx > 0 ? 0.12 : 0.02), 0.56, 0.78, sx * 0.56 + (sx > 0 ? -0.02 : 0.12), 0.6, 0.94], honda);
    // Las tachuelas doradas por el frente del brazo
    for (let z = 0.24; z < 0.9; z += 0.07) box([sx * 0.56 - (sx > 0 ? 0.08 : -0.055), 0.56, z, sx * 0.56 + (sx > 0 ? -0.055 : 0.08), 0.575, z + 0.022], GOLD, { g: 0.85 });
  }
  // El capitoné en rombo: tres hileras de botones, la del medio desplazada
  for (const [bz, xs] of [
    [0.96, [-0.3, 0, 0.3]],
    [1.12, [-0.15, 0.15]],
    [1.28, [-0.3, 0, 0.3]],
  ])
    for (const bx of xs) box([bx - 0.03, -0.39, bz - 0.03, bx + 0.03, -0.37, bz + 0.03], honda);
  // Las patas torneadas de nogal con su rueda de latón
  for (const [px, py] of [
    [-0.48, -0.54],
    [0.48, -0.54],
    [-0.48, 0.5],
    [0.48, 0.5],
  ]) {
    box([px - 0.05, py - 0.05, 0.05, px + 0.05, py + 0.05, 0.14], WALNUT_D);
    box([px - 0.03, py - 0.03, 0, px + 0.03, py + 0.03, 0.05], GOLD, { g: 0.7 });
  }
}

/** La lámpara de pie de latón con su pantalla encendida. */
function lampara(s, x, y) {
  // El pie escalonado, la vara con su nudo y la pantalla plisada con ribetes de latón
  disco(s, x, y, 0.17, 0, 0.04, GOLD_D, undefined, 8);
  disco(s, x, y, 0.11, 0.04, 0.1, GOLD, undefined, 8);
  pushBox(s, [x - 0.022, y - 0.022, 0.1, x + 0.022, y + 0.022, 1.64], GOLD_D);
  pushBox(s, [x - 0.045, y - 0.045, 0.8, x + 0.045, y + 0.045, 0.88], GOLD);
  pushBox(s, [x - 0.04, y - 0.04, 1.55, x + 0.04, y + 0.04, 1.62], GOLD);
  const pliegue = [255, 182, 104];
  for (let k = 0; k < 8; k += 1) {
    const a0 = -0.22 + k * 0.055;
    const c = k % 2 ? LAMP : pliegue;
    pushBox(s, [x + a0, y - 0.22, 1.62, x + a0 + 0.055, y - 0.2, 1.97], c, { glow: true });
    pushBox(s, [x + a0, y + 0.2, 1.62, x + a0 + 0.055, y + 0.22, 1.97], c, { glow: true });
    pushBox(s, [x - 0.22, y + a0, 1.62, x - 0.2, y + a0 + 0.055, 1.97], c, { glow: true });
    pushBox(s, [x + 0.2, y + a0, 1.62, x + 0.22, y + a0 + 0.055, 1.97], c, { glow: true });
  }
  pushBox(s, [x - 0.235, y - 0.235, 1.6, x + 0.235, y + 0.235, 1.63], GOLD, { g: 0.95 });
  pushBox(s, [x - 0.235, y - 0.235, 1.96, x + 0.235, y + 0.235, 1.99], GOLD, { g: 0.95 });
  pushBox(s, [x - 0.02, y - 0.02, 1.99, x + 0.02, y + 0.02, 2.07], GOLD, { g: 0.9 });
}

/** La mesita redonda de cada sillón. */
function mesita(s, x, y) {
  // Tablero redondo con su canto y una galería de latón, fuste torneado y tres patas en trípode
  disco(s, x, y, 0.3, 0.62, 0.66, WALNUT, undefined, 10);
  disco(s, x, y, 0.31, 0.58, 0.62, WALNUT_D, undefined, 10);
  for (let k = 0; k < 16; k += 1) {
    const a = (k / 16) * Math.PI * 2;
    const px = x + Math.cos(a) * 0.29;
    const py = y + Math.sin(a) * 0.29;
    pushBox(s, [px - 0.012, py - 0.012, 0.66, px + 0.012, py + 0.012, 0.7], GOLD, { g: 0.75 });
  }
  pushBox(s, [x - 0.035, y - 0.035, 0.12, x + 0.035, y + 0.035, 0.58], WALNUT_D);
  pushBox(s, [x - 0.06, y - 0.06, 0.3, x + 0.06, y + 0.06, 0.38], WALNUT);
  for (let k = 0; k < 3; k += 1) {
    const a = (k / 3) * Math.PI * 2 + 0.5;
    for (let q = 0.04; q < 0.24; q += 0.05) {
      const px = x + Math.cos(a) * q;
      const py = y + Math.sin(a) * q;
      const z = 0.14 - q * 0.5;
      pushBox(s, [px - 0.03, py - 0.03, Math.max(0, z - 0.04), px + 0.03, py + 0.03, z + 0.03], WALNUT_D);
    }
  }
}

/** La mesa larga con sus sillas y cuatro lámparas de banquero verdes. */
function mesaLarga(s) {
  const { x0, x1, y0, y1, alto } = MESA;
  // El tablero con su canto moldurado y un filete de latón embutido, y la cintura con cajones
  pushBox(s, [x0, y0, alto - 0.08, x1, y1, alto], WALNUT);
  pushBox(s, [x0 - 0.03, y0 - 0.03, alto - 0.11, x1 + 0.03, y1 + 0.03, alto - 0.08], WALNUT_D);
  pushBox(s, [x0 + 0.05, y0 + 0.05, alto - 0.24, x1 - 0.05, y1 - 0.05, alto - 0.11], WALNUT_D);
  for (const yy of [y0 + 0.04, y1 - 0.06]) {
    for (let x = x0 + 0.35; x < x1 - 0.3; x += 0.9) {
      pushBox(s, [x, yy, alto - 0.22, x + 0.6, yy + 0.02, alto - 0.13], WALNUT);
      pushBox(s, [x + 0.27, yy - 0.01, alto - 0.19, x + 0.33, yy + 0.03, alto - 0.16], GOLD, { g: 0.8 });
    }
  }
  pushBox(s, [x0 + 0.12, y0 + 0.12, alto, x1 - 0.12, y0 + 0.15, alto + 0.004], GOLD_D);
  pushBox(s, [x0 + 0.12, y1 - 0.15, alto, x1 - 0.12, y1 - 0.12, alto + 0.004], GOLD_D);
  // Patas torneadas (bulbo, anillo y pie), unidas por un travesaño
  for (const [x, y] of [
    [x0 + 0.14, y0 + 0.14],
    [x1 - 0.14, y0 + 0.14],
    [x0 + 0.14, y1 - 0.14],
    [x1 - 0.14, y1 - 0.14],
  ]) {
    pushBox(s, [x - 0.07, y - 0.07, 0, x + 0.07, y + 0.07, 0.08], WALNUT_D);
    pushBox(s, [x - 0.05, y - 0.05, 0.08, x + 0.05, y + 0.05, alto - 0.24], WALNUT_D);
    pushBox(s, [x - 0.09, y - 0.09, 0.3, x + 0.09, y + 0.09, 0.5], WALNUT);
    pushBox(s, [x - 0.07, y - 0.07, 0.5, x + 0.07, y + 0.07, 0.54], GOLD_D);
  }
  pushBox(s, [x0 + 0.14, (y0 + y1) / 2 - 0.04, 0.16, x1 - 0.14, (y0 + y1) / 2 + 0.04, 0.22], WALNUT_D);
  for (const x of [x0 + 0.14, x1 - 0.14]) pushBox(s, [x - 0.04, y0 + 0.14, 0.16, x + 0.04, y1 - 0.14, 0.22], WALNUT_D);
  // El tapete de piel verde del centro, con su filete dorado
  pushBox(s, [x0 + 0.25, y0 + 0.25, alto, x1 - 0.25, y1 - 0.25, alto + 0.01], [58, 92, 62]);
  pushBox(s, [x0 + 0.3, y0 + 0.3, alto + 0.01, x1 - 0.3, y0 + 0.32, alto + 0.014], GOLD_D);
  pushBox(s, [x0 + 0.3, y1 - 0.32, alto + 0.01, x1 - 0.3, y1 - 0.3, alto + 0.014], GOLD_D);
  // Las lámparas de banquero, a lo largo del eje (la mesa va atravesada, a lo ancho de la sala)
  const ym = (y0 + y1) / 2;
  for (const x of [x0 + 0.9, x1 - 0.9]) {
    const y = ym;
    pushBox(s, [x - 0.1, y - 0.15, alto, x + 0.1, y + 0.15, alto + 0.04], GOLD);
    pushBox(s, [x - 0.06, y - 0.09, alto + 0.04, x + 0.06, y + 0.09, alto + 0.07], GOLD_D);
    pushBox(s, [x - 0.02, y - 0.02, alto + 0.07, x + 0.02, y + 0.02, alto + 0.36], GOLD);
    pushBox(s, [x - 0.12, y - 0.3, alto + 0.36, x + 0.12, y + 0.3, alto + 0.5], GREEN_LAMP, { glow: true });
    pushBox(s, [x - 0.13, y - 0.31, alto + 0.47, x + 0.13, y + 0.31, alto + 0.5], GOLD, { g: 0.95 });
    pushBox(s, [x - 0.1, y - 0.26, alto + 0.33, x + 0.1, y + 0.26, alto + 0.36], LAMP, { glow: true });
    // La cadenita del interruptor
    pushBox(s, [x + 0.08, y + 0.1, alto + 0.22, x + 0.095, y + 0.115, alto + 0.36], GOLD, { g: 0.9 });
  }
  // Encima: una pila de libros, un libro abierto, el tintero con su pluma y un globo terráqueo
  pushBox(s, [x0 + 1.5, y0 + 0.3, alto + 0.01, x0 + 1.85, y0 + 0.75, alto + 0.1], BOOKS[1]);
  pushBox(s, [x0 + 1.52, y0 + 0.32, alto + 0.1, x0 + 1.8, y0 + 0.72, alto + 0.17], BOOKS[2]);
  pushBox(s, [x0 + 1.55, y0 + 0.36, alto + 0.17, x0 + 1.78, y0 + 0.68, alto + 0.22], BOOKS[4]);
  pushBox(s, [x1 - 1.9, y1 - 0.8, alto + 0.01, x1 - 1.4, y1 - 0.3, alto + 0.04], PAPER);
  pushBox(s, [x1 - 1.66, y1 - 0.8, alto + 0.04, x1 - 1.64, y1 - 0.3, alto + 0.06], [180, 160, 130]);
  pushBox(s, [x1 - 1.3, y1 - 0.62, alto + 0.01, x1 - 1.2, y1 - 0.52, alto + 0.09], [30, 34, 52]);
  pushBox(s, [x1 - 1.27, y1 - 0.59, alto + 0.09, x1 - 1.23, y1 - 0.55, alto + 0.11], GOLD);
  for (let k = 0; k < 5; k += 1)
    pushBox(s, [x1 - 1.26 + k * 0.025, y1 - 0.58 - k * 0.02, alto + 0.1 + k * 0.05, x1 - 1.24 + k * 0.025, y1 - 0.56 - k * 0.02, alto + 0.16 + k * 0.05], CREAM, { g: 0.9 });
  globo(s, x0 + 0.45, ym, alto, 0.17);
  // Las sillas, tres por lado (de cara a la mesa): respaldo de barrotes con remates, asiento de piel con tachuelas
  for (const x of [x0 + 0.6, (x0 + x1) / 2, x1 - 0.6]) {
    for (const lado of [-1, 1]) {
      const cy = lado < 0 ? y0 - 0.42 : y1 + 0.42;
      pushBox(s, [x - 0.24, cy - 0.24, 0.5, x + 0.24, cy + 0.24, 0.58], WALNUT);
      pushBox(s, [x - 0.2, cy - 0.2, 0.58, x + 0.2, cy + 0.2, 0.63], LEATHER);
      for (let k = -2; k <= 2; k += 1) pushBox(s, [x + k * 0.09 - 0.012, cy + lado * 0.2, 0.585, x + k * 0.09 + 0.012, cy + lado * 0.215, 0.6], GOLD, { g: 0.8 });
      const by = lado < 0 ? cy - 0.24 : cy + 0.2;
      for (const px of [-0.22, 0.22]) {
        pushBox(s, [x + px - 0.025, by, 0.58, x + px + 0.025, by + 0.04, 1.25], WALNUT_D);
        pushBox(s, [x + px - 0.03, by - 0.005, 1.25, x + px + 0.03, by + 0.045, 1.31], GOLD_D);
      }
      pushBox(s, [x - 0.24, by, 1.12, x + 0.24, by + 0.04, 1.22], WALNUT);
      pushBox(s, [x - 0.2, by, 0.88, x + 0.2, by + 0.04, 0.93], WALNUT);
      for (const px of [-0.1, 0, 0.1]) pushBox(s, [x + px - 0.015, by + 0.005, 0.63, x + px + 0.015, by + 0.035, 1.12], WALNUT);
      for (const [px, py] of [
        [-0.2, -0.2],
        [0.2, -0.2],
        [-0.2, 0.2],
        [0.2, 0.2],
      ]) {
        pushBox(s, [x + px - 0.03, cy + py - 0.03, 0, x + px + 0.03, cy + py + 0.03, 0.5], WALNUT_D);
        pushBox(s, [x + px - 0.04, cy + py - 0.04, 0.22, x + px + 0.04, cy + py + 0.04, 0.28], WALNUT);
      }
    }
  }
}

/** Un globo terráqueo con su meridiano de latón: de sobremesa (h, la altura del pie) o de pie. */
function globo(s, x, y, h, r) {
  const mar = [52, 92, 120];
  const tierra = [176, 150, 96];
  disco(s, x, y, r * 0.55, h, h + 0.03, GOLD_D, undefined, 8);
  pushBox(s, [x - 0.015, y - 0.015, h + 0.03, x + 0.015, y + 0.015, h + r * 0.6], GOLD_D);
  const c = h + r * 0.6 + r;
  const capas = 7;
  for (let k = 0; k < capas; k += 1) {
    const t = (k + 0.5) / capas;
    const zz = c - r + t * 2 * r;
    const w = r * Math.sqrt(1 - (2 * t - 1) ** 2);
    disco(s, x, y, w, zz - r / capas, zz + r / capas, k === 3 || k === 5 ? tierra : mar, { g: 0.75 }, 8);
  }
  // El meridiano, un arco de latón alrededor
  for (let k = 0; k <= 12; k += 1) {
    const a = (k / 12) * Math.PI;
    const px = x + Math.cos(a) * (r + 0.03);
    const pz = c + Math.sin(a - Math.PI / 2) * (r + 0.03);
    pushBox(s, [px - 0.012, y - 0.012, pz - 0.012, px + 0.012, y + 0.012, pz + 0.012], GOLD, { g: 0.85 });
  }
}

/** La chimenea de piedra con su repisa, el hogar, los morillos y lo de encima de la repisa. */
function chimenea(s) {
  const { y0, y1, fondo, boca } = CHIMENEA;
  const [b0, b1, bz] = boca;
  const g = 0.75;
  // Las jambas, el dintel y el fondo negro del hogar
  pushBox(s, [0, y0, 0, fondo, b0, 2.2], STONE, { g });
  pushBox(s, [0, b1, 0, fondo, y1, 2.2], STONE, { g });
  pushBox(s, [0, b0, bz, fondo, b1, 2.2], STONE_D, { g });
  pushBox(s, [0, b0, 0, 0.18, b1, bz], [24, 18, 18], { g: 0.2 });
  // La repisa de nogal y el pecho que sube hasta la galería
  pushBox(s, [0, y0 - 0.15, 2.2, fondo + 0.2, y1 + 0.15, 2.34], WALNUT, { g });
  pushBox(s, [0, y0 + 0.2, 2.34, fondo - 0.2, y1 - 0.2, GALERIA.z - 0.22], STONE, { g: 0.55 });
  // El hogar de piedra en el suelo
  pushBox(s, [fondo, y0 - 0.1, 0, fondo + 0.5, y1 + 0.1, 0.06], STONE_D, { g });
  // Los morillos y los troncos
  for (const y of [b0 + 0.25, b1 - 0.25]) pushBox(s, [0.3, y - 0.03, 0, 0.62, y + 0.03, 0.24], [40, 34, 34], { g: 0.6 });
  pushBox(s, [0.28, b0 + 0.18, 0.16, 0.5, b1 - 0.18, 0.32], [92, 56, 36], { g: 0.95 });
  pushBox(s, [0.42, b0 + 0.3, 0.3, 0.6, b1 - 0.3, 0.44], [110, 66, 40], { g: 0.95 });
  // Encima de la repisa: un reloj de sobremesa, dos candelabros y unos libros
  const ym = (y0 + y1) / 2;
  pushBox(s, [0.25, ym - 0.22, 2.34, 0.55, ym + 0.22, 2.78], WALNUT_D, { g });
  pushBox(s, [0.55, ym - 0.13, 2.48, 0.56, ym + 0.13, 2.7], CREAM, { g: 0.9 });
  for (const y of [y0 + 0.35, y1 - 0.35]) {
    pushBox(s, [0.35, y - 0.06, 2.34, 0.47, y + 0.06, 2.4], GOLD, { g });
    pushBox(s, [0.38, y - 0.02, 2.4, 0.44, y + 0.02, 2.68], CREAM, { g: 0.9 });
    pushBox(s, [0.39, y - 0.012, 2.68, 0.43, y + 0.012, 2.76], LAMP, { glow: true });
  }
  pushBox(s, [0.2, y0 + 0.7, 2.34, 0.6, y0 + 0.82, 2.66], BOOKS[0], { g });
  pushBox(s, [0.2, y0 + 0.82, 2.34, 0.6, y0 + 0.93, 2.62], BOOKS[3], { g });
}

/** El sofá para dos, de terciopelo verde, delante de la chimenea y mirándola. Con su manta y dos cojines. */
function sofa(s) {
  const { x, y, ancho } = SOFA;
  const h = ancho / 2;
  pushBox(s, [x - 0.5, y - h, 0.1, x + 0.5, y + h, 0.6], VELVET);
  pushBox(s, [x - 0.45, y - h + 0.2, 0.6, x + 0.35, y - 0.03, 0.72], [VELVET[0] * 1.15, VELVET[1] * 1.15, VELVET[2] * 1.15]);
  pushBox(s, [x - 0.45, y + 0.03, 0.6, x + 0.35, y + h - 0.2, 0.72], [VELVET[0] * 1.15, VELVET[1] * 1.15, VELVET[2] * 1.15]);
  pushBox(s, [x + 0.3, y - h, 0.1, x + 0.55, y + h, 1.35], VELVET);
  for (const sy of [-1, 1]) pushBox(s, [x - 0.5, sy > 0 ? y + h - 0.22 : y - h, 0.1, x + 0.55, sy > 0 ? y + h : y - h + 0.22, 0.95], VELVET);
  for (const sy of [-1, 1]) pushBox(s, [x + 0.12, y + sy * 0.55 - 0.24, 0.72, x + 0.3, y + sy * 0.55 + 0.24, 1.15], sy > 0 ? [196, 150, 80] : [168, 76, 64]);
  // El capitoné del respaldo, las tachuelas de los brazos y las borlas doradas de los cojines
  for (const [bz, ys] of [
    [0.88, [-0.75, -0.25, 0.25, 0.75]],
    [1.06, [-0.5, 0, 0.5]],
    [1.22, [-0.75, -0.25, 0.25, 0.75]],
  ])
    for (const by of ys) pushBox(s, [x + 0.28, y + by - 0.03, bz - 0.03, x + 0.3, y + by + 0.03, bz + 0.03], [VELVET[0] * 0.6, VELVET[1] * 0.6, VELVET[2] * 0.6]);
  for (const sy of [-1, 1])
    for (let px = -0.45; px < 0.5; px += 0.09) pushBox(s, [x + px, y + sy * (h - 0.22) - (sy > 0 ? 0.02 : 0), 0.86, x + px + 0.035, y + sy * (h - 0.22) + (sy > 0 ? 0 : 0.02), 0.9], GOLD, { g: 0.85 });
  for (const sy of [-1, 1])
    for (const dz of [0.72, 1.15]) for (const dy of [-0.24, 0.24]) pushBox(s, [x + 0.1, y + sy * 0.55 + dy - 0.025, dz - 0.05, x + 0.14, y + sy * 0.55 + dy + 0.025, dz + 0.01], GOLD, { g: 0.85 });
  // La manta doblada sobre el brazo
  pushBox(s, [x - 0.42, y + h - 0.26, 0.95, x + 0.4, y + h + 0.02, 1.0], [180, 160, 120]);
  for (const [px, py] of [
    [-0.42, -h + 0.08],
    [0.48, -h + 0.08],
    [-0.42, h - 0.08],
    [0.48, h - 0.08],
  ])
    pushBox(s, [x + px - 0.04, y + py - 0.04, 0, x + px + 0.04, y + py + 0.04, 0.1], WALNUT_D);
  // El carrito del té, a su lado, con la tetera y dos tazas
  const tx = 2.3;
  const ty = 7.6;
  for (const z of [0.3, 0.8]) pushBox(s, [tx - 0.4, ty - 0.26, z, tx + 0.4, ty + 0.26, z + 0.04], WALNUT);
  for (const [px, py] of [
    [-0.38, -0.24],
    [0.38, -0.24],
    [-0.38, 0.24],
    [0.38, 0.24],
  ])
    pushBox(s, [tx + px - 0.02, ty + py - 0.02, 0.06, tx + px + 0.02, ty + py + 0.02, 0.84], GOLD);
  pushBox(s, [tx - 0.2, ty - 0.12, 0.84, tx + 0.04, ty + 0.12, 1.06], CREAM);
  pushBox(s, [tx + 0.04, ty - 0.03, 0.92, tx + 0.13, ty + 0.03, 0.98], CREAM);
  for (const px of [0.18, 0.3]) pushBox(s, [tx + px - 0.05, ty - 0.05, 0.84, tx + px + 0.05, ty + 0.05, 0.92], [236, 228, 214]);
}

/** El reloj de pie (sin la esfera ni el péndulo, que se mueven). */
function relojPie(s) {
  const { x, y, alto } = RELOJ;
  // Zócalo con patas de bollo, caja con filetes de latón y la capilla de arriba con su frontón partido y tres remates
  for (const [px, py] of [
    [-0.3, -0.24],
    [0.3, -0.24],
    [-0.3, 0.24],
    [0.3, 0.24],
  ])
    pushBox(s, [x + px - 0.06, y + py - 0.06, 0, x + px + 0.06, y + py + 0.06, 0.07], WALNUT_D);
  pushBox(s, [x - 0.36, y - 0.3, 0.07, x + 0.36, y + 0.3, 0.42], WALNUT);
  pushBox(s, [x - 0.38, y - 0.32, 0.4, x + 0.38, y + 0.32, 0.45], WALNUT_D);
  pushBox(s, [x - 0.28, y - 0.24, 0.45, x + 0.28, y + 0.24, alto - 0.75], WALNUT);
  for (const px of [-0.27, 0.25]) pushBox(s, [x + px, y + 0.24, 0.5, x + px + 0.02, y + 0.255, alto - 0.8], GOLD_D);
  // La puerta de cristal del péndulo, con su marco
  pushBox(s, [x - 0.22, y + 0.24, 0.58, x + 0.22, y + 0.25, alto - 0.88], WALNUT_D);
  pushBox(s, [x - 0.18, y + 0.25, 0.62, x + 0.18, y + 0.26, alto - 0.92], [30, 30, 46], { g: 0.35 });
  pushBox(s, [x - 0.38, y - 0.32, alto - 0.78, x + 0.38, y + 0.32, alto - 0.74], WALNUT_D);
  pushBox(s, [x - 0.36, y - 0.3, alto - 0.74, x + 0.36, y + 0.3, alto], WALNUT);
  // Las columnillas a los lados de la esfera
  for (const px of [-0.32, 0.28]) pushBox(s, [x + px, y + 0.28, alto - 0.7, x + px + 0.04, y + 0.32, alto - 0.04], GOLD_D, { g: 0.75 });
  pushBox(s, [x - 0.4, y - 0.34, alto, x + 0.4, y + 0.34, alto + 0.08], WALNUT_D);
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 4; k += 1) pushBox(s, [x + sx * (0.4 - k * 0.07) - 0.04, y - 0.3, alto + 0.08 + k * 0.05, x + sx * (0.4 - k * 0.07) + 0.04, y + 0.3, alto + 0.13 + k * 0.05], WALNUT);
  }
  for (const px of [-0.36, 0, 0.36]) {
    pushBox(s, [x + px - 0.04, y - 0.04, alto + (px ? 0.08 : 0.2), x + px + 0.04, y + 0.04, alto + (px ? 0.16 : 0.28)], GOLD, { g: 0.85 });
    pushBox(s, [x + px - 0.015, y - 0.015, alto + (px ? 0.16 : 0.28), x + px + 0.015, y + 0.015, alto + (px ? 0.26 : 0.4)], GOLD, { g: 0.85 });
  }
}

/** La araña del centro, colgada del rosetón. */
function arana(s) {
  const cx = 7;
  const cy = 9.5;
  const z = SH - 3.4;
  pushBox(s, [cx - 0.03, cy - 0.03, z + 1.2, cx + 0.03, cy + 0.03, SH], GOLD_D, { g: 0.6 });
  disco(s, cx, cy, 0.08, z - 0.3, z + 1.2, GOLD_D, { g: 0.8 }, 6);
  disco(s, cx, cy, 0.2, z + 0.25, z + 0.45, GOLD, { g: 0.85 }, 8);
  disco(s, cx, cy, 0.17, z - 0.5, z - 0.3, GOLD, { g: 0.9 }, 8);
  const corona = (r, zz, n) => {
    // Un aro calado (no un plato): tramos cortos de latón alrededor, y unos brazos hasta el mástil
    for (let j = 0; j < 36; j += 1) {
      const b = (j / 36) * Math.PI * 2;
      const x = cx + Math.cos(b) * r;
      const y = cy + Math.sin(b) * r;
      pushBox(s, [x - 0.06, y - 0.06, zz, x + 0.06, y + 0.06, zz + 0.05], GOLD, { g: 0.85 });
    }
    for (let j = 0; j < 4; j += 1) {
      const b = (j / 4) * Math.PI * 2 + 0.4;
      for (let q = 0.2; q < r; q += 0.12)
        pushBox(s, [cx + Math.cos(b) * q - 0.03, cy + Math.sin(b) * q - 0.03, zz, cx + Math.cos(b) * q + 0.03, cy + Math.sin(b) * q + 0.03, zz + 0.04], GOLD_D, { g: 0.75 });
    }
    for (let k = 0; k < n; k += 1) {
      const a = (k / n) * Math.PI * 2;
      const x = cx + Math.cos(a) * (r - 0.05);
      const y = cy + Math.sin(a) * (r - 0.05);
      pushBox(s, [x - 0.035, y - 0.035, zz + 0.07, x + 0.035, y + 0.035, zz + 0.28], CREAM, { glow: true });
      pushBox(s, [x - 0.05, y - 0.05, zz + 0.28, x + 0.05, y + 0.05, zz + 0.4], LAMP, { glow: true });
      // Las lágrimas de cristal que cuelgan de la corona
      pushBox(s, [x - 0.015, y - 0.015, zz - 0.3, x + 0.015, y + 0.015, zz], [236, 226, 210], { glow: true });
    }
  };
  corona(1.15, z, 12);
  corona(0.7, z + 0.6, 8);
}

/** La librería común (sin lomos, que cambian): el mueble de nogal con sus cinco baldas y su cartela. */
function libreriaComun(s) {
  const { y0, y1, fondo, baldas, z0, paso } = LIBRERIA;
  const x0 = SW - fondo;
  const top = z0 + baldas * paso;
  pushBox(s, [x0, y0, 0, SW, y1, z0], WALNUT);
  pushBox(s, [x0 + 0.06, y0, z0, SW, y0 + 0.08, top + 0.1], WALNUT);
  pushBox(s, [x0 + 0.06, y1 - 0.08, z0, SW, y1, top + 0.1], WALNUT);
  pushBox(s, [x0 + 0.06, (y0 + y1) / 2 - 0.04, z0, SW, (y0 + y1) / 2 + 0.04, top], WALNUT);
  // El fondo, forrado de terciopelo verde biblioteca, para que los lomos que se dejan destaquen
  pushBox(s, [SW - 0.06, y0, z0, SW, y1, top], [47, 90, 68], { g: 0.62 });
  for (let k = 0; k <= baldas; k += 1) pushBox(s, [x0, y0, z0 + k * paso - 0.04, SW, y1, z0 + k * paso], WALNUT);
  // Bajo cada balda, una tira de luz cálida que alumbra la de abajo
  for (let k = 1; k <= baldas; k += 1) pushBox(s, [x0 + 0.05, y0 + 0.1, z0 + k * paso - 0.055, x0 + 0.09, y1 - 0.1, z0 + k * paso - 0.04], [206, 150, 86], { g: 0.62 });
  pushBox(s, [x0 - 0.06, y0 - 0.06, top, SW, y1 + 0.06, top + 0.18], WALNUT_D);
  // La cartela de latón del frontón y una lamparita que alumbra las baldas
  pushBox(s, [x0 - 0.08, (y0 + y1) / 2 - 0.55, top + 0.18, x0 - 0.02, (y0 + y1) / 2 + 0.55, top + 0.42], GOLD, { g: 0.9 });
  pushBox(s, [x0 - 0.12, (y0 + y1) / 2 - 0.5, top + 0.02, x0 - 0.04, (y0 + y1) / 2 + 0.5, top + 0.08], LAMP, { glow: true });
}

/**
 * El relieve de las librerías de pared: los cantos de las baldas, las pilastras cada 1,5 casillas, el zócalo de los
 * armarios bajos y la cornisa salen de la pared, así los lomos pintados quedan hundidos y la sala tiene fondo de verdad.
 * Cada pared: cómo se pasa de (a lo largo, hacia dentro) al mundo y sus huecos [a0, a1, z0, z1] (ventanal, chimenea…).
 */
const PAREDES = [
  // El fondo (y = 0)
  {
    largo: SW,
    en: (a, d) => [a, d],
    huecos: [
      [VENTANAL.x0 - 0.25, VENTANAL.x1 + 0.25, 0, 7.2],
      [RELOJ.x - 0.5, RELOJ.x + 0.5, 0, RELOJ.alto + 0.4],
    ],
  },
  // La izquierda (x = 0)
  { largo: SD, en: (a, d) => [d, a], huecos: [[CHIMENEA.y0 - 0.1, CHIMENEA.y1 + 0.1, 0, GALERIA.z]] },
  // La derecha (x = SW)
  { largo: SD, en: (a, d) => [SW - d, a], huecos: [[LIBRERIA.y0 - 0.1, LIBRERIA.y1 + 0.1, 0, 3.5]] },
  // La de delante (y = SD)
  { largo: SW, en: (a, d) => [a, SD - d], huecos: [[PUERTA.x0 - 0.3, PUERTA.x1 + 0.3, 0, PUERTA.alto + 0.65]] },
];
function relieve(s) {
  const caja = (p, a0, a1, d, z0, z1, color) => {
    const [ax, ay] = p.en(a0, 0);
    const [bx, by] = p.en(a1, d);
    pushBox(s, [Math.min(ax, bx), Math.min(ay, by), z0, Math.max(ax, bx), Math.max(ay, by), z1], color);
  };
  // Los tramos de [a0, a1] que no caen en un hueco a la altura z
  const tramos = (p, a0, a1, z) => {
    let out = [[a0, a1]];
    for (const [h0, h1, hz0, hz1] of p.huecos) {
      if (z < hz0 || z > hz1) continue;
      out = out.flatMap(([u, v]) => (h1 <= u || h0 >= v ? [[u, v]] : [h0 > u ? [u, h0] : null, h1 < v ? [h1, v] : null].filter(Boolean)));
    }
    return out.filter(([u, v]) => v - u > 0.12);
  };
  const filas = [];
  for (let z = 0.55; z < GALERIA.z - 0.1; z += 0.5) filas.push(z);
  for (let z = GALERIA.z + 0.24; z < GALERIA_ALTA.z - 0.1; z += 0.5) filas.push(z);
  for (let z = GALERIA_ALTA.z + 0.24; z < SH - 0.45; z += 0.5) filas.push(z);
  for (const p of PAREDES) {
    // Las baldas: un canto de nogal que sale 0,16
    for (const z of filas) for (const [u, v] of tramos(p, 0.12, p.largo - 0.12, z + 0.03)) caja(p, u, v, 0.16, z - 0.01, z + 0.06, WALNUT);
    // El zócalo de los armarios bajos y su encimera
    for (const [u, v] of tramos(p, 0.05, p.largo - 0.05, 0.3)) {
      caja(p, u, v, 0.26, 0, 0.5, WALNUT_D);
      caja(p, u, v, 0.32, 0.5, 0.57, WALNUT);
    }
    // La cornisa, arriba del todo
    caja(p, 0, p.largo, 0.3, SH - 0.42, SH - 0.3, WALNUT_D);
    caja(p, 0, p.largo, 0.36, SH - 0.3, SH - 0.24, GOLD_D);
    // Las pilastras, cada 1,5, de arriba abajo (cortadas por los huecos)
    for (let a = 1.5; a < p.largo - 0.2; a += 1.5) {
      for (const [z0, z1] of [
        [0.57, GALERIA.z - 0.22],
        [GALERIA.z + 0.24, GALERIA_ALTA.z - 0.2],
        [GALERIA_ALTA.z + 0.24, SH - 0.42],
      ]) {
        const libre = p.huecos.every(([h0, h1, hz0, hz1]) => a + 0.12 < h0 || a - 0.06 > h1 || z1 < hz0 || z0 > hz1);
        if (libre) caja(p, a - 0.06, a + 0.12, 0.22, z0, z1, WALNUT_D);
      }
    }
  }
}

/** El gato dormido en la galería, hecho un ovillo. */
function gato(s) {
  const x = SW - 0.6;
  const y = 6.2;
  const z = GALERIA.z;
  const pelo = [214, 140, 70];
  pushBox(s, [x - 0.22, y - 0.28, z, x + 0.2, y + 0.26, z + 0.2], pelo, { g: 0.45 });
  pushBox(s, [x - 0.16, y + 0.12, z + 0.08, x + 0.1, y + 0.36, z + 0.27], pelo, { g: 0.45 });
  for (const dx of [-0.11, 0.05]) pushBox(s, [x + dx, y + 0.22, z + 0.27, x + dx + 0.06, y + 0.3, z + 0.34], pelo, { g: 0.45 });
  pushBox(s, [x - 0.24, y - 0.3, z, x + 0.22, y - 0.18, z + 0.08], [180, 110, 52], { g: 0.45 });
  pushBox(s, [x - 0.26, y - 0.36, z - 0.01, x + 0.26, y + 0.4, z + 0.005], [150, 60, 60], { g: 0.4 });
}

/** El personaje sentado de quien lee, en cajas locales (de cara a +y), con su libro abierto en las manos. */
function lectorKit(avatar, libro, luz) {
  const s = kit();
  let boxes;
  try {
    boxes = actorBoxes(avatar, { pose: 'sit', x: 0, y: 0, facing: 0, h: SEAT_H, libro });
  } catch {
    boxes = actorBoxes(DEFAULT_AVATAR, { pose: 'sit', x: 0, y: 0, facing: 0, h: SEAT_H, libro });
  }
  for (const bx of boxes) pushBox(s, bx.b, bx.c, { g: luz });
  return s;
}

function mapacheKits(g) {
  const una = (boxes) => {
    const s = kit();
    for (const { b, c } of boxes) pushBox(s, b, c, { g });
    return s;
  };
  return { cuerpo: una(MAPACHE.cuerpo), cola: una(MAPACHE.cola), ficha: una(MAPACHE.ficha), parpados: MAPACHE.parpados.map((p) => una([p])) };
}

/** La esfera del reloj de pie: números romanos de píxel, la parte de la sesión que queda en un sector y la aguja. */
function paintEsfera(canvas, { frac: f = 1, descanso = false, activo = false } = {}) {
  const n = canvas.width;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(n, n);
  const r = probe();
  const gold = r.rampOf(GOLD);
  const cream = r.rampOf(CREAM);
  const sector = descanso ? r.rampOf([110, 170, 140])[3] : r.rampOf([196, 92, 70])[3];
  const ang = -Math.PI / 2 + (1 - f) * Math.PI * 2;
  const px = new Uint32Array(img.data.buffer);
  for (let y = 0; y < n; y += 1)
    for (let x = 0; x < n; x += 1) {
      const dx = x + 0.5 - n / 2;
      const dy = y + 0.5 - n / 2;
      const d = Math.hypot(dx, dy) / (n / 2);
      let c = 0;
      if (d <= 1) {
        if (d > 0.88) c = d > 0.95 ? gold[1] : gold[3];
        else {
          const a = Math.atan2(dy, dx);
          const rel = frac((a + Math.PI / 2) / (Math.PI * 2));
          const marca = d > 0.72 && d < 0.84 && Math.abs(frac(rel * 12 + 0.5) - 0.5) < 0.06;
          // La sesión que queda: un sector que se va cerrando (sin cifras ni prisas)
          const queda = activo && d < 0.66 && rel >= 1 - f;
          // La aguja, desde el centro
          const t = (dx * Math.cos(ang) + dy * Math.sin(ang)) / (n / 2);
          const perp = Math.abs(-dx * Math.sin(ang) + dy * Math.cos(ang));
          const aguja = activo && t > 0 && t < 0.8 && perp < 0.9;
          if (d < 0.1) c = gold[1];
          else if (aguja) c = r.rampOf([40, 32, 30])[2];
          else if (marca) c = r.rampOf([40, 32, 30])[3];
          else if (queda) c = sector;
          else c = cream[d > 0.8 ? 3 : 4];
        }
      }
      px[y * n + x] = c;
    }
  ctx.putImageData(img, 0, 0);
}

/** El fuego del hogar: lenguas de píxel que suben y bailan (`t` en segundos). */
function paintFuego(canvas, t) {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  const px = new Uint32Array(img.data.buffer);
  const step = Math.floor(t * 10);
  for (let y = 0; y < h; y += 1)
    for (let x = 0; x < w; x += 1) {
      const u = x / w;
      const v = 1 - y / h;
      const lengua = 0.55 + 0.4 * Math.sin(u * 13 + step * 0.9) * Math.sin(u * 5 - step * 0.4) + (hash(x, step) - 0.5) * 0.25;
      const borde = Math.min(u, 1 - u) * 3.2;
      const alto = lengua * Math.min(1, borde);
      if (v > alto) continue;
      const k = v / Math.max(0.01, alto);
      px[y * w + x] = k > 0.8 ? rgb(236, 120, 40) : k > 0.5 ? rgb(255, 176, 64) : k > 0.2 ? rgb(255, 222, 120) : rgb(255, 246, 200);
    }
  ctx.putImageData(img, 0, 0);
}

/** La lluvia en el ventanal y el haz del faro (que barre despacio): una capa transparente sobre el cristal. */
function paintLluvia(canvas, t, quieto) {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  const px = new Uint32Array(img.data.buffer);
  const caida = quieto ? 0 : Math.floor(t * 26);
  // El haz del faro: sale del cabo (a la izquierda) y gira
  const fx = Math.round(w * 0.135);
  const fy = Math.round(h * 0.42);
  const haz = quieto ? 0.35 : Math.sin(t * 0.55) * 0.6;
  for (let y = 0; y < h; y += 1)
    for (let x = 0; x < w; x += 1) {
      const gota = hash(x, Math.floor((y - caida - x * 0.3) / 6)) > 0.965 && (y - caida) % 6 < 3;
      const a = Math.atan2(fy - y, x - fx);
      const d = Math.hypot(x - fx, fy - y);
      const enHaz = x > fx && d > 2 && Math.abs(a - haz * 0.25) < 0.05 && y < fy;
      if (gota) px[y * w + x] = ((150 << 24) | (rgb(190, 206, 236) & 0xffffff)) >>> 0;
      else if (enHaz) px[y * w + x] = ((Math.round(110 * Math.max(0, 1 - d / w)) << 24) | (rgb(255, 240, 190) & 0xffffff)) >>> 0;
    }
  ctx.putImageData(img, 0, 0);
}

/** La cubierta de tela con el título (si el libro no tiene portada o no se puede usar como textura). */
function telaCubierta(title, color) {
  const c = document.createElement('canvas');
  c.width = 68;
  c.height = 100;
  const g = c.getContext('2d');
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = '#f3e7c8';
  g.lineWidth = 2;
  g.strokeRect(5, 5, c.width - 10, c.height - 10);
  g.fillStyle = '#f3e7c8';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = 'bold 11px serif';
  const words = String(title || '').split(/\s+/);
  const lines = [];
  for (const w of words) {
    const last = lines.at(-1);
    if (last && g.measureText(`${last} ${w}`).width < 54) lines[lines.length - 1] = `${last} ${w}`;
    else lines.push(w);
  }
  lines.slice(0, 5).forEach((l, k, all) => g.fillText(l, c.width / 2, c.height / 2 + (k - (all.length - 1) / 2) * 13));
  return c;
}

/**
 * Monta la sala en `container`. Avisa con `onPick(id)` ('libreria', 'sofa', 'reloj' o 'sillon-k'), `onLomo(id)` (un lomo
 * de la librería común, de cerca), `onFrame(tags)` (dónde van los letreros y los saludos), `onMove(pose)` y `onLost()`.
 */
export function mountSala(container, { onPick = () => {}, onLomo = () => {}, onFrame = () => {}, onLost = () => {}, onMove = () => {} } = {}) {
  const renderer = new WebGLRenderer({ antialias: false, powerPreference: 'low-power', preserveDrawingBuffer: true });
  const canvas = renderer.domElement;
  canvas.className = 'sl3-canvas';
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'La sala de lectura del hotel. Arrastra o usa las flechas para mirar; toca el suelo para andar y un sillón para sentarte a leer.');
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x120e1c);

  const scene = new Scene();
  // Lo lejano se pierde en la penumbra, más oscuro y más azul: la profundidad de la sala
  scene.background = new Color(0x160e14);
  scene.fog = new Fog(0x1a1016, 9, 36);
  const camera = new PerspectiveCamera(70, 1, 0.06, 60);
  scene.add(camera);
  // El resplandor de lo que brilla (lámparas, araña, fuego, la luna), a la misma resolución baja que todo: sale en bloques
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new Vector2(ART_W, ART_W), 0.62, 0.6, 0.8));
  composer.addPass(new OutputPass());
  const owned = [];
  const own = (x) => (owned.push(x), x);
  const flat = own(new MeshBasicMaterial({ vertexColors: true }));
  const hidden = own(new MeshBasicMaterial({ visible: false }));
  const plane = (w, h, tex, place, { cut = false, glow = false, smooth = false } = {}) => {
    const map = own(texture(tex, smooth));
    const mat = glow ? new MeshBasicMaterial({ map, transparent: true, depthWrite: false }) : new MeshBasicMaterial({ map, alphaTest: cut ? 0.5 : 0, transparent: cut });
    const mesh = new Mesh(own(new PlaneGeometry(w, h)), own(mat));
    place(mesh);
    scene.add(mesh);
    return mesh;
  };

  // ── La sala: suelo, techo y las cuatro paredes (todas de librería) ──
  plane(SW, SD, paintFloor(), (m) => {
    m.rotation.x = -Math.PI / 2;
    m.position.set(SW / 2, 0, SD / 2);
  });
  plane(SW, SD, paintCeiling(), (m) => {
    m.rotation.x = Math.PI / 2;
    m.position.set(SW / 2, SH, SD / 2);
  });
  plane(
    SW,
    SH,
    paintWall(SW, (a, b) => [a, 0.05, b], fondoExtra, 0),
    (m) => m.position.set(SW / 2, SH / 2, 0),
  );
  plane(
    SD,
    SH,
    paintWall(SD, (a, b) => [0.05, SD - a, b], izquierdaExtra, 3),
    (m) => {
      m.rotation.y = Math.PI / 2;
      m.position.set(0, SH / 2, SD / 2);
    },
  );
  plane(
    SD,
    SH,
    paintWall(
      SD,
      (a, b) => [SW - 0.05, a, b],
      () => null,
      7,
    ),
    (m) => {
      m.rotation.y = -Math.PI / 2;
      m.position.set(SW, SH / 2, SD / 2);
    },
  );
  plane(
    SW,
    SH,
    paintWall(SW, (a, b) => [SW - a, SD - 0.05, b], delanteExtra, 11),
    (m) => {
      m.rotation.y = Math.PI;
      m.position.set(SW / 2, SH / 2, SD);
    },
  );
  {
    const s = kit();
    galeria(s);
    galeriaAlta(s);
    corredera(s);
    SILLONES.forEach(([x, y, f], k) => {
      sillon(s, x, y, f, k);
      const l = lamparaDe(k);
      lampara(s, l.x, l.y);
      const m = mesitaDe(k);
      mesita(s, m.x, m.y);
    });
    mesaLarga(s);
    globo(s, 2.0, 3.0, 0, 0.42);
    chimenea(s);
    sofa(s);
    relojPie(s);
    arana(s);
    libreriaComun(s);
    relieve(s);
    gato(s);
    scene.add(new Mesh(own(geometryOf(s)), flat));
  }

  // ── Los haces de la luna: de los tres ventanucos altos bajan en diagonal hasta el suelo, con motas de polvo ──
  const HAZ = { dz: -0.72, z0: GALERIA.z + 0.62, z1: GALERIA.z + 3.0, ancho: 0.72 };
  const alfa = (a, c) => ((a << 24) | (c & 0xffffff)) >>> 0;
  const hazCanvas = canvasOf(4, 24, (ix, iy) => {
    const v = (iy + 0.5) / 24;
    return alfa(Math.round(255 * 0.075 * (1 - v) ** 1.6 * (0.75 + 0.25 * probe().bayerAt(ix, iy))), rgb(150, 172, 236));
  });
  const hazMat = own(new MeshBasicMaterial({ map: own(texture(hazCanvas, true)), transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide }));
  const manchaCanvas = canvasOf(12, 20, (ix, iy) => {
    const borde = ix === 0 || ix === 11 || iy === 0 || iy === 19;
    const parteluz = ix === 5 || ix === 6;
    return alfa(borde ? 8 : parteluz ? 4 : probe().bayerAt(ix, iy) > 0.3 ? 24 : 16, rgb(170, 190, 245));
  });
  const manchaMat = own(new MeshBasicMaterial({ map: own(texture(manchaCanvas)), transparent: true, depthWrite: false, blending: AdditiveBlending }));
  const alSuelo = (z) => -z / HAZ.dz; // cuánto avanza en y la luz que sale a la altura z hasta llegar al suelo
  const haces = [];
  for (const cx of [4.2, 7, 9.8]) {
    const { z0, z1, ancho } = HAZ;
    const ven = (x, z) => [x, z, 0.08]; // en Three: x, arriba, hondo
    const sue = (x, z) => [x, 0.02, alSuelo(z)];
    const A = [cx - ancho, cx + ancho];
    const pos = [];
    const uv = [];
    const cara = (p0, p1, p2, p3) => {
      pos.push(...p0, ...p1, ...p2, ...p0, ...p2, ...p3);
      uv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
    };
    // Cuatro caras entre el ventanuco (v = 0 en la textura, lo más claro) y su mancha en el suelo
    cara(ven(A[0], z1), ven(A[1], z1), sue(A[1], z1), sue(A[0], z1));
    cara(ven(A[0], z0), ven(A[1], z0), sue(A[1], z0), sue(A[0], z0));
    cara(ven(A[0], z0), ven(A[0], z1), sue(A[0], z1), sue(A[0], z0));
    cara(ven(A[1], z0), ven(A[1], z1), sue(A[1], z1), sue(A[1], z0));
    const g = own(new BufferGeometry());
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
    const m = new Mesh(g, hazMat);
    m.renderOrder = 2;
    scene.add(m);
    // La mancha de luz en el suelo, con la sombra del parteluz
    const y0 = alSuelo(z0);
    const y1 = alSuelo(z1);
    const mancha = new Mesh(own(new PlaneGeometry(ancho * 2, y1 - y0)), manchaMat);
    mancha.rotation.x = -Math.PI / 2;
    mancha.position.set(cx, 0.015, (y0 + y1) / 2);
    mancha.renderOrder = 1;
    scene.add(mancha);
    haces.push(cx);
  }
  // Las motas de polvo que flotan en los haces
  const MOTAS = 72;
  const motaSemilla = Array.from({ length: MOTAS }, (_, k) => [hash(k, 1), hash(k, 2), hash(k, 3), hash(k, 4)]);
  const motaGeo = own(new BufferGeometry());
  motaGeo.setAttribute('position', new Float32BufferAttribute(new Float32Array(MOTAS * 3), 3));
  const motas = new Points(motaGeo, own(new PointsMaterial({ color: 0xe4ebff, size: 1, sizeAttenuation: false, transparent: true, opacity: 0.75, depthWrite: false, blending: AdditiveBlending })));
  motas.renderOrder = 3;
  motas.frustumCulled = false;
  scene.add(motas);
  const moverMotas = (t) => {
    const p = motaGeo.attributes.position;
    motaSemilla.forEach(([a, b, c, d], k) => {
      const cx = haces[k % haces.length];
      const s = (b + t * 0.012 * (0.5 + c)) % 1; // bajan despacio a lo largo del haz
      const z0 = lerp(HAZ.z0, HAZ.z1, a);
      const z = z0 * (1 - s) + 0.05;
      p.setXYZ(k, cx + (c - 0.5) * HAZ.ancho * 1.6 + Math.sin(t * 0.6 + d * 9) * 0.06, z, Math.min(SD - 0.5, alSuelo(z0) * s + 0.1));
    });
    p.needsUpdate = true;
  };
  moverMotas(0);

  // ── La magia de arriba: un corro de libros abiertos que vuelan despacio bajo la bóveda y chispas doradas que suben ──
  const corro = new Group();
  corro.position.set(7, 0, 9.5);
  scene.add(corro);
  const volando = [];
  for (let k = 0; k < 7; k += 1) {
    const b = kit();
    const tapa = BOOKS[(k * 3) % BOOKS.length];
    // Abierto en V: dos tapas y sus hojas, en local (el lomo en el origen, a lo largo de y)
    pushBox(b, [-0.36, -0.22, 0.1, -0.02, 0.22, 0.13], tapa, { g: 0.7 });
    pushBox(b, [0.02, -0.22, 0.1, 0.36, 0.22, 0.13], tapa, { g: 0.7 });
    pushBox(b, [-0.33, -0.2, 0.13, -0.02, 0.2, 0.16], PAPER, { g: 0.9 });
    pushBox(b, [0.02, -0.2, 0.13, 0.33, 0.2, 0.16], PAPER, { g: 0.9 });
    const m = new Mesh(own(geometryOf(b)), flat);
    const libro = new Group();
    libro.add(m);
    const a = (k / 7) * Math.PI * 2;
    const r = 2.6 + (k % 2) * 0.7;
    libro.position.set(Math.cos(a) * r, SH - 3.2 + (k % 3) * 0.55, Math.sin(a) * r);
    libro.rotation.y = -a;
    corro.add(libro);
    volando.push({ libro, y: libro.position.y, fase: k * 1.3 });
  }
  const CHISPAS = 110;
  const chispaSemilla = Array.from({ length: CHISPAS }, (_, k) => [hash(k, 11), hash(k, 12), hash(k, 13), hash(k, 14)]);
  const chispaGeo = own(new BufferGeometry());
  chispaGeo.setAttribute('position', new Float32BufferAttribute(new Float32Array(CHISPAS * 3), 3));
  const chispas = new Points(chispaGeo, own(new PointsMaterial({ color: 0xffcf7a, size: 1, sizeAttenuation: false, transparent: true, opacity: 0.85, depthWrite: false, blending: AdditiveBlending })));
  chispas.renderOrder = 3;
  chispas.frustumCulled = false;
  scene.add(chispas);
  const magia = (t) => {
    corro.rotation.y = t * 0.06;
    for (const v of volando) {
      v.libro.position.y = v.y + Math.sin(t * 0.9 + v.fase) * 0.12;
      v.libro.children[0].rotation.z = Math.sin(t * 2.2 + v.fase) * 0.08; // las hojas, como si respirasen
    }
    const p = chispaGeo.attributes.position;
    chispaSemilla.forEach(([a, b, c, d], k) => {
      const z = 3.2 + ((b * (SH - 3.6) + t * 0.08 * (0.4 + c)) % (SH - 3.6));
      p.setXYZ(k, 1.2 + a * (SW - 2.4) + Math.sin(t * 0.5 + d * 7) * 0.2, z, 1.2 + d * (SD - 2.4) + Math.cos(t * 0.4 + a * 5) * 0.2);
    });
    p.needsUpdate = true;
  };
  magia(0);

  // ── Lo que se mueve: la lluvia, el fuego, la esfera y el péndulo del reloj ──
  const lluviaCanvas = document.createElement('canvas');
  lluviaCanvas.width = 108;
  lluviaCanvas.height = 48;
  const lluvia = plane(VENTANAL.x1 - VENTANAL.x0, VENTANAL.z1 - VENTANAL.z0, lluviaCanvas, (m) => m.position.set((VENTANAL.x0 + VENTANAL.x1) / 2, (VENTANAL.z0 + VENTANAL.z1) / 2, 0.08), {
    glow: true,
  });
  const fuegoCanvas = document.createElement('canvas');
  fuegoCanvas.width = 22;
  fuegoCanvas.height = 16;
  const [b0, b1, bz] = CHIMENEA.boca;
  const fuego = plane(
    b1 - b0 - 0.2,
    bz - 0.1,
    fuegoCanvas,
    (m) => {
      m.rotation.y = Math.PI / 2;
      m.position.set(0.48, (bz - 0.1) / 2 + 0.2, (b0 + b1) / 2);
    },
    { glow: true },
  );
  const esferaCanvas = document.createElement('canvas');
  esferaCanvas.width = 24;
  esferaCanvas.height = 24;
  let reloj = { frac: 1, descanso: false, activo: false, running: false };
  paintEsfera(esferaCanvas, reloj);
  const esfera = plane(0.48, 0.48, esferaCanvas, (m) => m.position.set(RELOJ.x, RELOJ.alto - 0.37, RELOJ.y + 0.31), { cut: true });
  const pendulo = new Group();
  {
    const s = kit();
    pushBox(s, [-0.012, -0.012, -1.0, 0.012, 0.012, 0], GOLD_D, { g: 0.5 });
    pushBox(s, [-0.09, -0.02, -1.12, 0.09, 0.02, -0.94], GOLD, { g: 0.6 });
    pendulo.add(new Mesh(own(geometryOf(s)), flat));
    pendulo.position.set(RELOJ.x, RELOJ.alto - 0.92, RELOJ.y + 0.29);
    scene.add(pendulo);
  }
  const pintaVivo = (t) => {
    const quieto = reduced();
    paintLluvia(lluviaCanvas, t, quieto);
    lluvia.material.map.needsUpdate = true;
    paintFuego(fuegoCanvas, quieto ? 0.4 : t);
    fuego.material.map.needsUpdate = true;
    pendulo.rotation.z = reloj.running && !quieto ? Math.sin(t * Math.PI) * 0.16 : 0;
    moverMotas(quieto ? 0 : t);
    magia(quieto ? 0 : t);
  };
  pintaVivo(0);

  // ── La librería común: un lomo por libro dejado, a la altura de los ojos los más recientes ──
  const lomosGrupo = new Group();
  scene.add(lomosGrupo);
  let lomos = [];
  let lomoSel = null;
  const lomoMeshes = new Map(); // id → mesh (el lomo, que se toca)
  function ponerLomos(lista) {
    lomos = lista ?? [];
    for (const m of lomoMeshes.values()) {
      lomosGrupo.remove(m);
      m.geometry.dispose();
    }
    lomoMeshes.clear();
    const { y0, y1, z0, paso, fondo } = LIBRERIA;
    const mitad = (y0 + y1) / 2;
    // Cada balda tiene dos huecos a los lados del montante central; se llenan desde el centro hacia fuera (primero el
    // de la izquierda, hacia la izquierda, y luego el de la derecha), para que los primeros lomos queden delante de ti.
    const huecos = [
      { desde: mitad - 0.06, hasta: y0 + 0.1, sentido: -1 },
      { desde: mitad + 0.06, hasta: y1 - 0.1, sentido: 1 },
    ];
    let balda = 0;
    let hueco = 0;
    let cursor = huecos[0].desde;
    for (const l of lomos) {
      const { color, alto, n } = lomoDe(l.titulo);
      const ancho = 0.07 + (n % 4) * 0.015;
      const cabe = (hh, c) => (hh.sentido < 0 ? c - ancho >= hh.hasta : c + ancho <= hh.hasta);
      if (!cabe(huecos[hueco], cursor)) {
        hueco += 1;
        if (hueco >= huecos.length) {
          hueco = 0;
          balda += 1;
        }
        if (balda >= ORDEN_BALDAS.length) break;
        cursor = huecos[hueco].desde;
      }
      const sentido = huecos[hueco].sentido;
      const y = sentido < 0 ? cursor - ancho : cursor;
      const zb = z0 + ORDEN_BALDAS[balda] * paso;
      const h = (paso - 0.1) * alto;
      const s = kit();
      const sel = l.id === lomoSel;
      const x0 = SW - fondo + 0.08 - (sel ? 0.16 : 0);
      const base = hex(color);
      pushBox(s, [x0, y, zb, SW - 0.08, y + ancho, zb + h], base, { g: sel ? 0.95 : glowAt(SW - 0.4, y, zb + 0.2) + 0.2 });
      // Dos nervios dorados en el lomo; el tuyo, con una cinta clara arriba
      for (const k of [0.18, 0.78]) pushBox(s, [x0 - 0.005, y + 0.005, zb + h * k, x0, y + ancho - 0.005, zb + h * k + 0.02], GOLD, { g: 0.7 });
      if (l.mio) pushBox(s, [x0 - 0.006, y + ancho * 0.3, zb + h - 0.02, x0, y + ancho * 0.7, zb + h + 0.06], CREAM, { glow: true });
      const mesh = new Mesh(geometryOf(s), flat);
      mesh.userData.lomo = l.id;
      lomosGrupo.add(mesh);
      lomoMeshes.set(l.id, mesh);
      cursor += sentido * (ancho + 0.012);
    }
    invalidate();
  }

  // ── Quien lee: su personaje sentado en su sillón, con su libro, y su compañero al lado ──
  const lectoresGrupo = new Group();
  scene.add(lectoresGrupo);
  let lectoresKey = '';
  let lectores = []; // { sillon, avatar, libro, companero, yo }
  const sprites = []; // { mesh, sprite, tex }
  const mapaches = []; // { raiz, cuerpo, cola, fichas, parpados }
  const mapacheGeo = (() => {
    const k = mapacheKits(0.62);
    return { cuerpo: own(geometryOf(k.cuerpo)), cola: own(geometryOf(k.cola)), ficha: own(geometryOf(k.ficha)), parpados: k.parpados.map((p) => own(geometryOf(p))) };
  })();
  /** Dónde se queda el compañero de cada sillón: en el suelo, delante y a un lado, a la vista. */
  const pieDe = (k) => {
    const [x, y, f] = plazaDe(k);
    return f === 0 ? { x: x + 0.62, y: y + 0.98 } : { x: x - 0.98, y: y + 0.62 };
  };
  const rotDe = (k) => (plazaDe(k)[2] === 0 ? 0 : -Math.PI / 2);
  function ponerLectores(lista) {
    const key = JSON.stringify(lista.map((l) => [l.sillon, l.avatar, l.libro, l.companero, l.yo]));
    lectores = lista;
    if (key === lectoresKey) return;
    lectoresKey = key;
    for (const m of [...lectoresGrupo.children]) {
      lectoresGrupo.remove(m);
      if (m.isMesh && !Object.values(mapacheGeo).flat().includes(m.geometry)) m.geometry.dispose();
    }
    for (const sp of sprites.splice(0)) {
      sp.tex.dispose();
      sp.mesh.material.dispose();
      sp.mesh.geometry.dispose();
    }
    mapaches.length = 0;
    for (const l of lista) {
      const a = asientoDe(l.sillon);
      const mesh = new Mesh(geometryOf(lectorKit(l.avatar ?? DEFAULT_AVATAR, l.libro ? hex(l.libro) : BOOKS[l.sillon % BOOKS.length], glowAt(a.x, a.y, 1.2) + 0.08)), flat);
      mesh.position.set(a.x, 0, a.y);
      mesh.rotation.y = rotDe(l.sillon);
      mesh.userData.yo = Boolean(l.yo);
      mesh.userData.sillon = l.sillon;
      lectoresGrupo.add(mesh);
      const m = misticoOf(l.companero);
      if (!m?.legendario && l.companero !== 'mapache-crupier') continue;
      const p = pieDe(l.sillon);
      if (l.companero === 'mapache-crupier') {
        const raiz = new Group();
        const cuerpo = new Group();
        raiz.add(cuerpo);
        cuerpo.add(new Mesh(mapacheGeo.cuerpo, flat));
        const cola = new Group();
        const [cx, cy, cz] = MAPACHE.pivoteCola;
        cola.position.set(cx, cz, cy);
        cola.add(new Mesh(mapacheGeo.cola, flat));
        cuerpo.add(cola);
        const fichas = [0, 1, 2].map(() => {
          const f = new Mesh(mapacheGeo.ficha, flat);
          cuerpo.add(f);
          return f;
        });
        const parpados = mapacheGeo.parpados.map((g) => {
          const e = new Mesh(g, flat);
          cuerpo.add(e);
          return e;
        });
        raiz.position.set(p.x, 0, p.y);
        raiz.userData.sillon = l.sillon;
        lectoresGrupo.add(raiz);
        mapaches.push({ raiz, cuerpo, cola, fichas, parpados });
      } else {
        const sprite = misticoSprite(l.companero);
        sprite.paint(1.3);
        const tex = texture(sprite.canvas);
        const lado = 1.7;
        const geo = new PlaneGeometry(lado, lado);
        // El ancla del dibujo (los pies) en el suelo
        geo.translate(lado * (0.5 - sprite.ax / sprite.canvas.width), lado * (sprite.ay / sprite.canvas.height - 0.5), 0);
        const mat = new MeshBasicMaterial({ map: tex, alphaTest: 0.5, transparent: true });
        const mesh2 = new Mesh(geo, mat);
        mesh2.position.set(p.x, 0, p.y);
        mesh2.userData.sillon = l.sillon;
        lectoresGrupo.add(mesh2);
        sprites.push({ mesh: mesh2, sprite, tex });
      }
    }
    invalidate();
  }

  // ── Tu libro en la mesita de tu sillón (cerrado, con su portada y la cinta) y abierto en tus manos al sentarte ──
  let tuLibro = null; // { sillon, title, color, coverLoad }
  let libroMesa = null;
  let portada = null;
  let portadaTex = null;
  const enManos = new Group();
  camera.add(enManos);
  enManos.visible = false;
  function libroGeo(color, cover) {
    const group = new Group();
    const base = hex(color);
    const s = kit();
    // Tapas y hojas, tumbado: 0,46 × 0,66
    pushBox(s, [-0.23, -0.33, 0, 0.23, 0.33, 0.02], base, { g: 0.8 });
    pushBox(s, [-0.215, -0.32, 0.02, 0.225, 0.32, 0.075], PAPER, { g: 0.85 });
    pushBox(s, [-0.23, -0.33, 0.075, 0.23, 0.33, 0.095], base, { g: 0.8 });
    pushBox(s, [-0.24, -0.33, 0, -0.21, 0.33, 0.095], [base[0] * 0.8, base[1] * 0.8, base[2] * 0.8], { g: 0.8 });
    // La cinta del punto de lectura que asoma por abajo
    pushBox(s, [0.05, -0.42, 0.04, 0.09, -0.3, 0.05], [170, 40, 50], { g: 0.85 });
    group.add(new Mesh(geometryOf(s), flat));
    const cara = new Mesh(new PlaneGeometry(0.44, 0.64), new MeshBasicMaterial({ map: cover }));
    cara.rotation.x = -Math.PI / 2;
    cara.position.set(0.005, 0.097, 0);
    group.add(cara);
    return group;
  }
  function quitarLibroMesa() {
    if (!libroMesa) return;
    scene.remove(libroMesa);
    libroMesa.traverse((m) => {
      if (m.isMesh) {
        m.geometry.dispose();
        if (m.material !== flat) m.material.dispose();
      }
    });
    libroMesa = null;
  }
  function ponerLibroMesa() {
    quitarLibroMesa();
    if (!tuLibro || tuLibro.sillon == null) return;
    const m = mesitaDe(tuLibro.sillon);
    libroMesa = libroGeo(tuLibro.color, portadaTex);
    // En la mesita, algo girado, con la portada hacia quien se acerca
    libroMesa.position.set(m.x, 0.66, m.y);
    libroMesa.rotation.y = SILLONES[tuLibro.sillon][2] === 0 ? 0.35 : -Math.PI / 2 + 0.35;
    scene.add(libroMesa);
  }
  function ponerEnManos() {
    for (const c of [...enManos.children]) {
      enManos.remove(c);
      c.geometry?.dispose();
    }
    if (!tuLibro) return;
    const base = hex(tuLibro.color);
    const s = kit();
    // Abierto: dos páginas un poco en uve, con las tapas asomando
    pushBox(s, [-0.3, -0.005, -0.21, 0.3, 0.012, 0.21], base, { g: 0.85 });
    pushBox(s, [-0.285, 0.012, -0.2, -0.008, 0.04, 0.2], PAPER, { g: 0.9 });
    pushBox(s, [0.008, 0.012, -0.2, 0.285, 0.04, 0.2], PAPER, { g: 0.92 });
    for (let k = 0; k < 7; k += 1) {
      const z = -0.15 + k * 0.045;
      pushBox(s, [-0.25, 0.04, z, -0.04 - (k % 3) * 0.02, 0.042, z + 0.012], [150, 140, 120], { g: 0.9 });
      pushBox(s, [0.04, 0.04, z, 0.25 - (k % 2) * 0.03, 0.042, z + 0.012], [150, 140, 120], { g: 0.9 });
    }
    pushBox(s, [-0.006, 0.012, -0.2, 0.006, 0.05, 0.2], [120, 100, 80], { g: 0.6 });
    const libro = new Mesh(geometryOf(s), flat);
    // Delante y abajo de la vista, inclinado hacia ti
    libro.position.set(0, -0.42, -0.62);
    libro.rotation.x = 0.95;
    enManos.add(libro);
  }
  function setTuLibro(libro) {
    const cambio = JSON.stringify([libro?.sillon, libro?.title, libro?.color]) !== JSON.stringify([tuLibro?.sillon, tuLibro?.title, tuLibro?.color]);
    const nuevaPortada = libro?.coverLoad !== tuLibro?.coverLoad || libro?.title !== tuLibro?.title;
    tuLibro = libro ?? null;
    if (nuevaPortada) {
      portadaTex?.dispose();
      portadaTex = libro ? own(texture(telaCubierta(libro.title, libro.color), true)) : null;
      const pedido = libro?.coverLoad;
      portada = pedido;
      pedido?.then((img) => {
        if (destroyed || portada !== pedido || !img) return;
        try {
          const c = document.createElement('canvas');
          c.width = 88;
          c.height = 128;
          const g = c.getContext('2d');
          g.imageSmoothingQuality = 'high';
          g.drawImage(img, 0, 0, c.width, c.height);
          c.getContext('2d').getImageData(0, 0, 1, 1); // si la imagen no deja leerse, aquí salta y se queda la tela
          portadaTex = own(texture(c, true));
          ponerLibroMesa();
          invalidate();
        } catch {
          /* la tela con el título */
        }
      });
    }
    if (cambio || nuevaPortada) {
      ponerLibroMesa();
      ponerEnManos();
    }
    invalidate();
  }

  // Lo que se toca: una caja invisible por sitio
  const pickers = Object.entries(SITIOS).map(([id, { box }]) => {
    const [x0, y0, z0, x1, y1, z1] = box;
    const m = new Mesh(own(new BoxGeometry(x1 - x0, z1 - z0, y1 - y0)), hidden);
    m.position.set((x0 + x1) / 2, (z0 + z1) / 2, (y0 + y1) / 2);
    m.userData.id = id;
    scene.add(m);
    return m;
  });

  const ray = new Raycaster();
  const floorPlane = new Plane(new Vector3(0, 1, 0), 0);
  const hit = new Vector3();

  // ── Dónde estás y adónde miras ──
  let px = INICIO.x;
  let py = INICIO.y;
  let yaw = INICIO.yaw;
  let walk = null;
  let raf = 0;
  let destroyed = false;
  let renders = 0;
  let lastT = 0;
  const t0 = performance.now();
  // Sentado en un sillón (su número), delante de la librería ('libreria') o de pie (false); `seatK`, de 0 (de pie) a 1
  let sentado = false;
  let ultimo = 0;
  let seatK = 0;
  let sillonTag = 0;

  function advance(dt) {
    if (!walk) return false;
    let t = dt;
    while (t > 0 && walk.pts.length) {
      const [tx, ty] = walk.pts[0];
      const dx = tx - px;
      const dy = ty - py;
      const d = Math.hypot(dx, dy);
      if (d > 0.02) yaw += wrapA(Math.atan2(dx, dy) - yaw) * Math.min(1, dt * 7);
      if (d <= WALK * t) {
        px = tx;
        py = ty;
        t -= d / WALK;
        walk.pts.shift();
      } else {
        const k = (WALK * t) / d;
        px += dx * k;
        py += dy * k;
        t = 0;
      }
    }
    if (walk.pts.length) return true;
    if (walk.face) {
      const want = Math.atan2(walk.face[0] - px, walk.face[1] - py);
      const delta = wrapA(want - yaw);
      if (Math.abs(delta) > 0.01) {
        yaw += delta * Math.min(1, dt * 8);
        return true;
      }
      yaw = want;
    }
    const done = walk.done;
    walk = null;
    onMove({ x: px, y: py, yaw });
    done?.();
    return false;
  }

  /** Dónde va la cámara sentada o delante de la librería. */
  function anclaDe(donde) {
    if (donde === 'libreria') return { x: SW - 3.4, y: (LIBRERIA.y0 + LIBRERIA.y1) / 2, z: 1.6, mira: [SW, (LIBRERIA.y0 + LIBRERIA.y1) / 2, 1.4] };
    // En el sofá para dos, la vista va por detrás y un poco de tu lado: los dos sentados junto al fuego
    if (donde >= PLAZA_SOFA) {
      const lado = plazaDe(donde)[1] - SOFA.y;
      return { x: SOFA.x + 3.1, y: SOFA.y + lado * 2.4, z: 3.1, mira: [0.5, SOFA.y - lado * 0.4, 0.75] };
    }
    const a = asientoDe(donde);
    const f = plazaDe(donde)[2];
    // Los ojos de quien se sienta, un poco por delante del respaldo; mira la sala, algo hacia abajo (a su libro)
    const ex = f === 0 ? a.x : a.x - 0.05;
    const ey = f === 0 ? a.y + 0.05 : a.y;
    return { x: ex, y: ey, z: 1.68, mira: [a.mira[0], a.mira[1], 1.15] };
  }

  /** Sentarse en el sillón `k` o ponerse delante de la librería (`on`), o volver a estar de pie. */
  function ponerse(donde, on) {
    sentado = on ? donde : false;
    if (on) {
      ultimo = donde;
      walk = null;
      const nudo = donde === 'libreria' ? 'libreria' : (NUDO_SILLON[donde] ?? 'sofa');
      const p = onNet(NODOS[nudo][0], NODOS[nudo][1]);
      [px, py] = [p.x, p.y];
      const a = anclaDe(donde);
      yaw = Math.atan2(a.mira[0] - px, a.mira[1] - py);
    } else if (ultimo === 'libreria') {
      lomoSel = null;
      ponerLomos(lomos);
    }
    invalidate();
    return new Promise((done) => {
      const mira = () => (destroyed || seatK === (sentado !== false ? 1 : 0) ? done() : setTimeout(mira, 40));
      mira();
    });
  }

  function aim(now) {
    const dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0;
    lastT = now;
    let moving = advance(dt);
    const want = sentado !== false ? 1 : 0;
    if (seatK !== want) {
      seatK = reduced() ? want : clamp(seatK + (want ? dt : -dt) / 0.8, 0, 1);
      moving = moving || seatK !== want;
    }
    const e = [px, py, EYE];
    const l = [e[0] + Math.sin(yaw) * 6, e[1] + Math.cos(yaw) * 6, e[2] + Math.tan(PITCH) * 6];
    const k = ease(seatK);
    const A = anclaDe(ultimo);
    camera.position.set(lerp(e[0], A.x, k), lerp(e[2], A.z, k), lerp(e[1], A.y, k));
    camera.lookAt(lerp(l[0], A.mira[0], k), lerp(l[2], A.mira[2], k), lerp(l[1], A.mira[1], k));
    camera.updateMatrixWorld();
    // Sentado en tu sillón: no te ves a ti, y tu libro pasa de la mesita a tus manos
    // (en el sofá la vista va por detrás: te ves sentada y el libro lo tienes tú, no la cámara)
    const enSillon = typeof ultimo === 'number' && ultimo < PLAZA_SOFA && seatK > 0.6;
    for (const m of lectoresGrupo.children) if (m.userData.yo) m.visible = !(enSillon && m.userData.sillon === ultimo);
    enManos.visible = enSillon && typeof sentado === 'number';
    if (libroMesa) libroMesa.visible = !(enSillon && tuLibro?.sillon === ultimo);
    // Los compañeros dibujados miran siempre a la cámara
    for (const sp of sprites) sp.mesh.rotation.y = Math.atan2(camera.position.x - sp.mesh.position.x, camera.position.z - sp.mesh.position.z);
    return moving;
  }

  const tagPoint = new Vector3();
  function project(x, y, z) {
    const rect = container.getBoundingClientRect();
    tagPoint.set(x, z, y).project(camera);
    return { x: ((tagPoint.x + 1) / 2) * rect.width, y: ((1 - tagPoint.y) / 2) * rect.height, front: tagPoint.z < 1 && Math.abs(tagPoint.x) < 0.95 && tagPoint.y < 0.97 && tagPoint.y > -0.9 };
  }
  function tags() {
    const out = {};
    const quiet = Boolean(walk) || seatK > 0;
    for (const id of ['libreria', 'sofa', 'reloj']) {
      const s = SITIOS[id];
      const p = project(...s.tag);
      out[id] = { ...p, visible: !quiet && p.front && Math.hypot(px - s.tag[0], py - s.tag[1]) < TAG_LEJOS };
    }
    const s = SITIOS[`sillon-${sillonTag}`];
    const p = project(...s.tag);
    out.sillon = { ...p, visible: !quiet && p.front };
    // Dónde sale el saludo de cada sillón (sobre la cabeza de quien lee)
    SILLONES.forEach((_, k) => {
      const a = asientoDe(k);
      const q = project(a.x, a.y, 2.3);
      const ocupado = lectores.some((l) => l.sillon === k && !(l.yo && typeof ultimo === 'number' && ultimo === k && seatK > 0.6));
      out[`cabeza-${k}`] = { ...q, visible: ocupado && q.front };
    });
    return out;
  }
  let viveHasta = 0;
  let vivoTimer = 0;
  function draw(now = performance.now()) {
    raf = 0;
    if (destroyed || document.visibilityState === 'hidden') return;
    const moving = aim(now);
    const t = (now - t0) / 1000;
    const quieto = reduced();
    if (!quieto || now - viveHasta > 1000) {
      pintaVivo(t);
      viveHasta = now;
      // El mapache: malabares y parpadeo, mirando hacia ti
      for (const m of mapaches) {
        const p = poseMapache(t, { moving: false, quieto });
        m.cuerpo.position.y = p.bote;
        m.cola.rotation.y = p.cola;
        m.fichas.forEach((f, i) => {
          const at = p.fichas[i];
          f.visible = Boolean(at);
          if (at) f.position.set(at[0], at[2], at[1]);
        });
        m.parpados.forEach((e, i) => (e.visible = p.parpados[i]));
        m.raiz.rotation.y = Math.atan2(camera.position.x - m.raiz.position.x, camera.position.z - m.raiz.position.z);
      }
      for (const sp of sprites) {
        sp.sprite.paint(quieto ? 1.3 : t);
        sp.tex.needsUpdate = true;
      }
    }
    composer.render();
    renders += 1;
    onFrame(tags());
    if (moving) invalidate();
    else {
      lastT = 0;
      // Sin prisa: el fuego y la lluvia siguen a unos 12 cuadros por segundo; con movimiento reducido, quietos
      if (!quieto && !vivoTimer)
        vivoTimer = setTimeout(() => {
          vivoTimer = 0;
          invalidate();
        }, VIVO_MS);
    }
  }
  function invalidate() {
    if (!raf && !destroyed) raf = requestAnimationFrame(draw);
  }
  function resize() {
    const rect = container.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    renderer.setSize(ART_W, Math.max(1, Math.round((ART_W * rect.height) / rect.width)), false);
    composer.setSize(ART_W, Math.max(1, Math.round((ART_W * rect.height) / rect.width)));
    camera.aspect = rect.width / rect.height;
    const portrait = (2 * Math.atan(Math.tan((HFOV * Math.PI) / 360) / camera.aspect) * 180) / Math.PI;
    camera.fov = camera.aspect < 1 ? Math.min(VFOV_MAX, portrait) : VFOV_LANDSCAPE;
    camera.updateProjectionMatrix();
    invalidate();
  }
  function rayAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    ray.setFromCamera(new Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1), camera);
  }
  function pickAt(clientX, clientY) {
    rayAt(clientX, clientY);
    return ray.intersectObjects(pickers, false)[0]?.object.userData.id ?? null;
  }

  /** Ir andando por los pasillos hasta el punto de la red más cercano a (x, y); `face`, adónde mirar al llegar. */
  function walkTo(x, y, { face = null } = {}) {
    return new Promise((done) => {
      const from = onNet(px, py);
      const to = onNet(x, y);
      const pts = Math.hypot(from.x - px, from.y - py) > 0.02 ? [[from.x, from.y, 0], ...route(from, to)] : route(from, to);
      if (reduced() || !pts.length) {
        [px, py] = pts.length ? pts.at(-1) : [px, py];
        if (face) yaw = Math.atan2(face[0] - px, face[1] - py);
        walk = null;
        invalidate();
        onMove({ x: px, y: py, yaw });
        done();
        return;
      }
      walk = { pts, face, done };
      invalidate();
    });
  }

  // ── Mandos: arrastrar mira; un toque en un sitio lo elige; tocar el suelo lleva hasta allí ──
  const stop = new AbortController();
  const on = { signal: stop.signal };
  let press = null;
  canvas.addEventListener(
    'pointerdown',
    (e) => {
      if (press) return;
      press = { x: e.clientX, y: e.clientY, yaw, id: e.pointerId, moved: false };
      canvas.setPointerCapture?.(e.pointerId);
    },
    on,
  );
  canvas.addEventListener(
    'pointermove',
    (e) => {
      if (!press || e.pointerId !== press.id) return;
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > TAP_SLOP) press.moved = true;
      if (!press.moved || walk || sentado !== false) return;
      yaw = press.yaw + (e.clientX - press.x) * DRAG;
      invalidate();
    },
    on,
  );
  const release = (e) => {
    if (!press || e.pointerId !== press.id) return;
    const tap = !press.moved && e.type === 'pointerup';
    const moved = press.moved;
    press = null;
    if (moved) onMove({ x: px, y: py, yaw });
    if (tap && sentado === 'libreria') {
      rayAt(e.clientX, e.clientY);
      const h = ray.intersectObjects([...lomoMeshes.values()], false)[0];
      if (h) onLomo(h.object.userData.lomo);
      return;
    }
    if (!tap || sentado !== false) return;
    const id = pickAt(e.clientX, e.clientY);
    if (id) {
      onPick(id);
      return;
    }
    rayAt(e.clientX, e.clientY);
    if (ray.ray.intersectPlane(floorPlane, hit) && dentro(hit.x, hit.z)) walkTo(hit.x, hit.z);
  };
  canvas.addEventListener('pointerup', release, on);
  canvas.addEventListener('pointercancel', release, on);
  canvas.addEventListener(
    'keydown',
    (e) => {
      if (sentado !== false) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        yaw += e.key === 'ArrowLeft' ? KEY_STEP : -KEY_STEP;
        invalidate();
        onMove({ x: px, y: py, yaw });
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const k = e.key === 'ArrowUp' ? 1.2 : -1.2;
        walkTo(px + Math.sin(yaw) * k, py + Math.cos(yaw) * k);
      }
    },
    on,
  );
  canvas.addEventListener(
    'webglcontextlost',
    (e) => {
      e.preventDefault();
      onLost();
    },
    on,
  );
  document.addEventListener('visibilitychange', () => invalidate(), on);
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  container.append(canvas);
  resize();

  return {
    canvas,
    renders: () => renders,
    pose: () => ({ x: px, y: py, yaw }),
    settled: () => !walk && seatK === (sentado !== false ? 1 : 0),
    /** Quien lee: [{ sillon (0 a 5, o 6 y 7 en el sofá), avatar, libro (color [r, g, b]), companero, yo }]. */
    lectores: ponerLectores,
    /** Cuántos lectores se ven y en qué sillones (para las pruebas). */
    verLectores: () => lectores.map((l) => ({ sillon: l.sillon, yo: Boolean(l.yo), companero: l.companero ?? null })),
    /** Tu libro: { sillon, title, color (#rrggbb), coverLoad } o null. Va en la mesita de tu sillón y, sentado, en tus manos. */
    tuLibro: setTuLibro,
    /** Para las pruebas: si tu libro está en la mesita y si lo tienes en las manos. */
    verTuLibro: () => ({ mesa: Boolean(libroMesa?.visible), manos: enManos.visible && enManos.children.length > 0 }),
    /** El sillón que lleva el letrero («Tu sillón» o «Un sillón libre»). */
    sillonTag(k) {
      sillonTag = clamp(k ?? 0, 0, SILLONES.length - 1);
      invalidate();
    },
    /** Los lomos de la librería común (los de `sala_libreria`). */
    lomos: ponerLomos,
    /** El lomo que se mira de cerca (sale un poco de su balda), o ninguno. */
    elegirLomo(id) {
      lomoSel = id;
      ponerLomos(lomos);
    },
    /** Para las pruebas: dónde cae en la pantalla un lomo y si sale de la balda. */
    lomo(id) {
      aim(performance.now());
      const m = lomoMeshes.get(id);
      if (!m) return null;
      m.geometry.computeBoundingBox();
      const b = m.geometry.boundingBox;
      // El centro de la cara que se ve (la de delante): visto de lado, el centro del volumen cae sobre el lomo vecino
      const p = project(b.min.x + 0.01, (b.min.z + b.max.z) / 2, (b.min.y + b.max.y) / 2);
      const rect = canvas.getBoundingClientRect();
      return { x: rect.left + p.x, y: rect.top + p.y, front: p.front, fuera: id === lomoSel };
    },
    /** El reloj de pie: { frac (lo que queda, de 1 a 0), descanso, activo (hay sesión), running }. */
    reloj(r) {
      const next = { frac: clamp(r?.frac ?? 1, 0, 1), descanso: Boolean(r?.descanso), activo: Boolean(r?.activo), running: Boolean(r?.running) };
      const cambia = Math.abs(next.frac - reloj.frac) > 0.004 || next.descanso !== reloj.descanso || next.activo !== reloj.activo || next.running !== reloj.running;
      reloj = next;
      if (!cambia) return;
      paintEsfera(esferaCanvas, reloj);
      esfera.material.map.needsUpdate = true;
      invalidate();
    },
    /** Sentarse en el sillón `k` (o en la plaza 6 o 7 del sofá), o levantarse: la cámara baja al asiento. Promesa que acaba al llegar. */
    sentarse: (k, onOff = true) => ponerse(onOff ? k : ultimo, onOff),
    /** En qué sillón estás sentado (o null). */
    sentadoEn: () => (typeof sentado === 'number' ? sentado : null),
    /** Ponerse delante de la librería común (o irse). Promesa que acaba al llegar. */
    anteLibreria: (onOff = true) => ponerse('libreria', onOff),
    enLibreria: () => sentado === 'libreria',
    /** Ir a un sitio ('libreria', 'sofa', 'reloj', 'sillon-k' o 'entrada'). Promesa que acaba al llegar. */
    go(id) {
      if (id === 'entrada') return walkTo(NODOS.entrada[0], NODOS.entrada[1], { face: [7, 8] });
      const s = SITIOS[id];
      if (!s) return Promise.resolve();
      const [x, y] = NODOS[s.nudo];
      return walkTo(x, y, { face: s.mira });
    },
    /** Ponerse en un sitio de golpe (para las pruebas y las capturas). */
    place(x, y, yawTo = yaw) {
      walk = null;
      const p = onNet(x, y);
      px = p.x;
      py = p.y;
      yaw = yawTo;
      onMove({ x: px, y: py, yaw });
      invalidate();
    },
    /** Dónde cae en la pantalla un sitio (para las pruebas). */
    onScreen(id) {
      aim(performance.now());
      const b = SITIOS[id].box;
      const p = project((b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2);
      const rect = canvas.getBoundingClientRect();
      return { x: rect.left + p.x, y: rect.top + p.y, front: p.front };
    },
    /** El lomo bajo un punto de la pantalla (para las pruebas), o null. */
    lomoEn(clientX, clientY) {
      aim(performance.now());
      rayAt(clientX, clientY);
      return ray.intersectObjects([...lomoMeshes.values()], false)[0]?.object.userData.lomo ?? null;
    },
    /** El punto del suelo bajo un punto de la pantalla (para las pruebas), o null. */
    sueloEn(clientX, clientY) {
      aim(performance.now());
      rayAt(clientX, clientY);
      return ray.ray.intersectPlane(floorPlane, hit) ? { x: hit.x, y: hit.z, pick: pickAt(clientX, clientY) } : null;
    },
    invalidate,
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      clearTimeout(vivoTimer);
      stop.abort();
      observer.disconnect();
      quitarLibroMesa();
      for (const m of lomoMeshes.values()) m.geometry.dispose();
      for (const m of lectoresGrupo.children) if (m.isMesh) m.geometry.dispose();
      for (const sp of sprites) {
        sp.tex.dispose();
        sp.mesh.material.dispose();
        sp.mesh.geometry.dispose();
      }
      for (const x of owned) x.dispose?.();
      renderer.dispose();
      canvas.remove();
    },
  };
}
