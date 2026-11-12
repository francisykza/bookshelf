// El café-librería del bajo en primera persona (encargo de Francisco del 11-11-2026, plan en docs/qa/cafe-libreria.md;
// bloque 1, 1.119): el antiguo videoclub, vacío y en traspaso. El mismo modo de hacer que las salas del hotel (`sala3d.js`,
// `casino3d.js`): Three.js a 320 px de ancho ampliado sin suavizar, texturas de píxel pintadas una vez con las rampas y el
// tramado del dibujo isométrico y la luz ya pintada en ellas (la bombilla desnuda, la lamparita del mostrador y la farola de
// la calle por el escaparate); sin luces ni sombras en tiempo real. Solo se dibuja cuando algo cambia, salvo la lluvia del
// escaparate y el polvo en la luz de la bombilla, que se mueven despacio (y nada con movimiento reducido).
// - Suelo de damero gastado, zócalo de madera, yeso con las marcas claras de lo que colgaba antes, vigas en el techo.
// - El escaparate y la puerta a la calle del puerto, de noche y lloviendo; en la puerta, el cartel «SE TRASPASA».
// - El mostrador viejo con su caja registradora y Pilar detrás; cajas de mudanza, sábanas, una escalera de pintor y la
//   estantería vacía; al fondo, la cortina de terciopelo con su caballete, que tapa lo que se abrirá al crecer el café.
// Todo propio: ni arte, ni logos, ni decorados de cafeterías, series ni juegos reales.
import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Group,
  Color,
  Fog,
  Float32BufferAttribute,
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
import {
  ANTE_PILAR,
  BOMBILLA,
  CABALLETE,
  CAJAS,
  CARTEL,
  CORTINA,
  ESCALERA,
  ESCAPARATE,
  CUADRO,
  ESTANTERIA,
  EYE,
  INICIO,
  INICIO_ABIERTO,
  LAMPARITA,
  MOSTRADOR,
  PILAR,
  PILAR_ASPECTO,
  PUERTA,
  SABANAS,
  SD,
  SH,
  SITIOS,
  SW,
  dentro,
  enCasilla,
  enMundo,
  hastaDonde,
} from './cafeLayout';
import { CUADRICULA, medidas } from './cafeCatalogo';
import { cajasDe, colorDe } from './cafeMuebles';
import { footprint } from '../room';

const ART_W = 320;
const PX = 16; // píxeles de textura por unidad en suelo, paredes y techo
const HFOV = 66;
const VFOV_LANDSCAPE = 62;
const VFOV_MAX = 90;
const PITCH = -0.06;
const DRAG = 0.005;
const KEY_STEP = 0.1;
const WALK = 2.6; // unidades por segundo
const TAP_SLOP = 8;
/** Cada cuánto se mueven la lluvia y el polvo (unos 12 cuadros por segundo). */
const VIVO_MS = 84;
/** La vista de la barra: desde delante del mostrador, mirando la barra desde arriba (que quede por encima del cuadro de abajo). */
const BARRA_CAM = { x: 6.6, y: 6.08, z: 2.02 };
const BARRA_MIRA = { x: 7.66, y: 6.08, z: 0.5 };

const linear = ([r, g, b]) => new Color().setRGB(r / 255, g / 255, b / 255, SRGBColorSpace);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const frac = (v) => v - Math.floor(v);

let probeRaster = null;
const probe = () => (probeRaster ??= createRaster({ W: 2, H: 2, S: 1, yaw: 0, ox: 0, oy: 0 }));
const unpack = (p) => [p & 255, (p >> 8) & 255, (p >> 16) & 255];

// ── La paleta del bajo ──
const WOOD = [150, 98, 60];
const WOOD_D = [98, 62, 40];
const WOOD_L = [190, 140, 92];
const PLASTER = [178, 156, 128];
const TILE_R = [150, 64, 56];
const TILE_C = [222, 206, 176];
const VELVET = [124, 36, 50];
const BRASS = [214, 170, 92];
const GREEN = [76, 110, 80];
const CARTON = [184, 142, 92];
const CARTON_D = [164, 122, 80];
const SABANA = [226, 220, 204];
const PAPER = [238, 230, 208];
const BULB = [255, 214, 140];

// ── La luz, pintada: la bombilla, la lamparita del mostrador, la farola por el escaparate y la luz de la puerta ──
const LUCES = [
  { at: [BOMBILLA.x, BOMBILLA.y, BOMBILLA.z], k: 0.95, reach: 5.6 },
  { at: [LAMPARITA.x, LAMPARITA.y, LAMPARITA.z + 0.4], k: 0.75, reach: 3.0 },
  { at: [2.0, SD - 0.3, 2.4], k: 0.32, reach: 4.2 },
  { at: [(PUERTA.x0 + PUERTA.x1) / 2, SD - 0.3, 2.0], k: 0.2, reach: 3.0 },
];
function glowAt(x, y, z) {
  let g = 0.06;
  for (const { at, k, reach } of LUCES) {
    const d = Math.hypot(x - at[0], y - at[1], (z - at[2]) * 1.15) / reach;
    if (d < 1) g += k * (1 - d) ** 1.5;
  }
  return Math.min(1, g);
}
// De lejos, azul de noche; de cerca de la bombilla, ámbar
const FAR = [0.4, 0.36, 0.5];
const NEAR = [1.2, 0.98, 0.7];
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

// ── El suelo: damero rojo y crema gastado, con polvo junto a las paredes y las marcas de lo que se ha llevado ──
function paintFloor() {
  const r = probe();
  const red = r.rampOf(TILE_R);
  const cream = r.rampOf(TILE_C);
  return canvasOf(SW * PX, SD * PX, (ix, iy) => {
    const x = (ix + 0.5) / PX;
    const y = (iy + 0.5) / PX;
    const g = glowAt(x, y, 0);
    const T = 0.62;
    const tx = Math.floor(x / T);
    const ty = Math.floor(y / T);
    const junta = frac(x / T) < 0.05 || frac(y / T) < 0.05;
    const ramp = (tx + ty) % 2 ? red : cream;
    if (junta) return lit(ramp[1], g, ix, iy);
    // Polvo: más cerca de las paredes, en manchas; y una huella clara donde estuvo el expositor de sobres
    const borde = Math.min(x, y - CORTINA.y, SW - x, SD - y);
    const polvo = noise(x * 3, y * 3) * 0.7 + (borde < 0.8 ? (0.8 - borde) * 0.6 : 0);
    const huella = x > 1.2 && x < 4.6 && y > 6.4 && y < 7.6 && !(x > 1.3 && x < 4.5 && y > 6.5 && y < 7.5);
    const desgaste = noise(tx * 2.1, ty * 1.7) > 0.7 ? 1 : 0;
    const i = clamp(3 - desgaste + (polvo > 0.75 || huella ? 1 : 0), 1, 4);
    return lit(ramp[i], g, ix, iy);
  });
}

/** Yeso con zócalo de madera y, más claro, el hueco de lo que colgaba antes (carteles y baldas del videoclub). */
function wallPx(a, b, g, ix, iy, huecos = []) {
  const r = probe();
  const wood = r.rampOf(WOOD);
  const plaster = r.rampOf(PLASTER);
  if (b > SH - 0.14) return lit(wood[2], g, ix, iy);
  if (b < 1.1) return lit(wood[Math.abs((a % 0.8) - 0.4) < 0.03 ? 1 : b > 1.0 ? 3 : 2], g, ix, iy);
  if (b < 1.18) return lit(wood[3], g, ix, iy);
  for (const [a0, b0, a1, b1] of huecos) {
    if (a > a0 && a < a1 && b > b0 && b < b1) {
      const e = Math.min(a - a0, a1 - a, b - b0, b1 - b);
      return lit(plaster[e < 0.04 ? 3 : 4], g + 0.04, ix, iy);
    }
  }
  // Desconchones y humedad, en manchas
  const n = noise(a * 2.4 + 7, b * 2.4);
  const d = r.bayerAt(ix, iy);
  if (n > 0.86 && b > 3.2) return lit(plaster[1], g, ix, iy);
  return lit(plaster[n > 0.74 && d > 0.6 ? 4 : n < 0.2 && d > 0.75 ? 2 : 3], g, ix, iy);
}
function paintWall(w, world, extra = () => null, huecos = []) {
  const h = Math.round(SH * PX);
  return canvasOf(Math.round(w * PX), h, (ix, iy) => {
    const a = (ix + 0.5) / PX;
    const b = SH - (iy + 0.5) / PX;
    const own = extra(a, b, ix, iy);
    if (own != null) return own;
    return wallPx(a, b, glowAt(...world(a, b)), ix, iy, huecos);
  });
}

/** La calle del puerto de noche, vista por el cristal (x del mundo, z altura): acera mojada, la farola, el muelle y el agua. */
function calle(x, z) {
  const farola = 2.0;
  // La farola: el poste y su farol encendido
  if (Math.abs(x - farola) < 0.05 && z < 2.6) return rgb(30, 30, 38);
  if (Math.abs(x - farola) < 0.18 && z > 2.6 && z < 2.95) return Math.abs(x - farola) < 0.13 && z > 2.66 && z < 2.9 ? rgb(255, 222, 150) : rgb(40, 40, 48);
  if (z < 0.85) {
    // Adoquines mojados, con el reflejo de la farola
    const refl = Math.abs(x - farola) < 0.25 + (0.85 - z) * 0.4 && noise(x * 9, z * 30) > 0.35;
    if (refl) return rgb(214, 170, 104);
    const junta = frac(x / 0.32 + Math.floor(z / 0.16) * 0.5) < 0.1 || frac(z / 0.16) < 0.12;
    return junta ? rgb(30, 32, 44) : noise(x * 4, z * 6) > 0.7 ? rgb(70, 76, 98) : rgb(52, 58, 80);
  }
  if (z < 1.0) return rgb(96, 92, 90); // el bordillo del muelle
  if (z < 1.55) {
    const ola = noise(x * 8, z * 28);
    if (Math.abs(x - farola) < 0.3 && ola > 0.45) return rgb(200, 150, 90);
    return ola > 0.8 ? rgb(46, 66, 104) : rgb(18, 28, 54);
  }
  if (z < 1.72) {
    // La otra orilla, con sus luces y el faro a la derecha
    if (Math.abs(x - 5.2) < 0.06 && z < 1.72) return rgb(214, 210, 200);
    return noise(x * 21, 3) > 0.72 ? rgb(236, 196, 120) : rgb(16, 20, 32);
  }
  if (Math.abs(x - 5.2) < 0.05 && z < 2.0) return Math.floor(z * 14) % 2 ? rgb(214, 210, 200) : rgb(160, 50, 50);
  if (Math.abs(x - 5.2) < 0.08 && z > 2.0 && z < 2.1) return rgb(255, 236, 170);
  const estrella = hash(Math.floor(x * 12), Math.floor(z * 12));
  if (estrella > 0.985) return rgb(214, 214, 236);
  const t = clamp((z - 1.72) / 1.6, 0, 1);
  return rgb(20 + t * 6, 26 + t * 4, 56 + t * 10);
}

// La pared de delante: el escaparate con su marco verde y la puerta acristalada
function delanteExtra(a, b, ix, iy) {
  const x = SW - a;
  const r = probe();
  const green = r.rampOf(GREEN);
  const wood = r.rampOf(WOOD);
  const g = glowAt(x, SD - 0.3, b);
  const { x0, x1, z0, z1 } = ESCAPARATE;
  if (x > x0 - 0.16 && x < x1 + 0.16 && b > z0 - 0.16 && b < z1 + 0.14) {
    if (x < x0 || x > x1 || b < z0 || b > z1) return lit(green[x < x0 - 0.1 || x > x1 + 0.1 || b < z0 - 0.1 ? 1 : 2], g, ix, iy);
    // Dos parteluces y un travesaño alto (el montante)
    if (Math.abs(x - (x0 + (x1 - x0) / 3)) < 0.04 || Math.abs(x - (x0 + (2 * (x1 - x0)) / 3)) < 0.04 || Math.abs(b - (z1 - 0.55)) < 0.04) return lit(green[2], g, ix, iy);
    return calle(x, b);
  }
  if (x > PUERTA.x0 - 0.14 && x < PUERTA.x1 + 0.14 && b < PUERTA.alto + 0.14) {
    if (x < PUERTA.x0 || x > PUERTA.x1 || b > PUERTA.alto) return lit(wood[1], g, ix, iy);
    const u = x - PUERTA.x0;
    if (u < 0.12 || u > PUERTA.x1 - PUERTA.x0 - 0.12 || b < 1.0 || b > PUERTA.alto - 0.12) return lit(wood[u < 0.05 || b < 0.06 ? 1 : 3], g, ix, iy);
    // El pomo de latón
    return calle(x, b);
  }
  return null;
}
// La pared de la derecha, detrás del mostrador: dos baldas viejas con algún tarro olvidado
function derechaExtra(a, b, ix, iy) {
  const y = a;
  if (y < MOSTRADOR.y0 - 0.2 || y > MOSTRADOR.y1 + 0.2 || b < 1.6 || b > 3.1) return null;
  const r = probe();
  const wood = r.rampOf(WOOD_L);
  const g = glowAt(SW - 0.2, y, b);
  for (const z of [1.9, 2.7]) {
    if (b > z && b < z + 0.07) return lit(wood[b < z + 0.02 ? 1 : 3], g, ix, iy);
    if (b > z + 0.07 && b < z + 0.38) {
      const k = Math.floor(y / 0.42);
      if (hash(k, z) > 0.62 && frac(y / 0.42) > 0.25 && frac(y / 0.42) < 0.7) return lit(hash(k, 3) > 0.5 ? [196, 214, 206] : [176, 120, 84], g, ix, iy);
    }
  }
  return null;
}

// ── El techo: yeso con vigas de madera a lo ancho ──
function paintCeiling() {
  const r = probe();
  const wood = r.rampOf(WOOD_D);
  const plaster = r.rampOf(PLASTER);
  return canvasOf(SW * PX, SD * PX, (ix, iy) => {
    const x = (ix + 0.5) / PX;
    const y = SD - (iy + 0.5) / PX;
    const g = glowAt(x, y, SH) * 0.7;
    const v = frac(y / 1.8);
    if (v < 0.12) return lit(wood[v < 0.03 || v > 0.1 ? 1 : 3], g, ix, iy);
    return lit(plaster[noise(x * 3, y * 3) > 0.8 ? 2 : 3], g, ix, iy);
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

// ── Lo que hay en el local ──
/** La cortina de terciopelo con sus pliegues, la barra de latón y, encima, el tabique provisional hasta el techo. */
function cortina(s) {
  const { y, x0, x1, alto } = CORTINA;
  const paso = 0.32;
  for (let x = x0; x < x1 - 0.01; x += paso) {
    const k = Math.round((x - x0) / paso);
    const hondo = k % 2 ? 0.16 : 0.06;
    pushBox(s, [x, y - hondo, 0.02, Math.min(x1, x + paso), y + 0.04, alto], k % 2 ? VELVET : [104, 28, 42]);
  }
  // El bandó y la barra
  pushBox(s, [x0, y - 0.24, alto - 0.3, x1, y - 0.16, alto + 0.05], [92, 24, 36]);
  pushBox(s, [x0, y - 0.2, alto + 0.05, x1, y - 0.12, alto + 0.11], BRASS, { g: 0.55 });
  // El tabique de tablas, de la barra al techo
  pushBox(s, [0, y - 0.02, alto + 0.11, SW, y + 0.1, SH], [120, 84, 56]);
  for (let x = 0.5; x < SW; x += 0.9) pushBox(s, [x, y - 0.04, alto + 0.11, x + 0.03, y - 0.02, SH], WOOD_D);
  // Las borlas que recogen un poco la cortina en los extremos
  for (const x of [x0 + 0.3, x1 - 0.5]) pushBox(s, [x, y - 0.3, 1.2, x + 0.2, y - 0.1, 1.42], BRASS, { g: 0.5 });
}
/** El caballete de pintor con una lámina en blanco (lo que será el local, aún sin dibujar). */
function caballete(s) {
  const { x, y } = CABALLETE;
  const pata = [110, 78, 50];
  pushBox(s, [x - 0.62, y - 0.04, 0, x - 0.56, y + 0.04, 1.75], pata);
  pushBox(s, [x + 0.56, y - 0.04, 0, x + 0.62, y + 0.04, 1.75], pata);
  pushBox(s, [x - 0.03, y - 0.42, 0, x + 0.03, y - 0.36, 1.7], pata);
  pushBox(s, [x - 0.64, y - 0.02, 0.78, x + 0.64, y + 0.12, 0.84], pata);
}
/** El mostrador del videoclub: madera con paneles, el tablero claro y la caja registradora de latón. */
function mostrador(s) {
  const { x0, x1, y0, y1, alto } = MOSTRADOR;
  pushBox(s, [x0, y0, 0, x1, y1, alto - 0.08], WOOD);
  for (let y = y0 + 0.2; y < y1 - 0.4; y += 0.9) pushBox(s, [x0 - 0.02, y, 0.18, x0, y + 0.7, alto - 0.26], WOOD_D);
  pushBox(s, [x0 - 0.1, y0 - 0.06, alto - 0.08, x1 + 0.04, y1 + 0.06, alto], WOOD_L);
  // La caja registradora
  const cy = y0 + 0.9;
  pushBox(s, [x0 + 0.15, cy, alto, x1 - 0.05, cy + 0.6, alto + 0.32], BRASS);
  pushBox(s, [x0 + 0.1, cy + 0.05, alto + 0.32, x0 + 0.4, cy + 0.55, alto + 0.5], [186, 140, 70]);
  for (let k = 0; k < 4; k += 1) pushBox(s, [x0 + 0.05, cy + 0.08 + k * 0.12, alto + 0.12, x0 + 0.15, cy + 0.16 + k * 0.12, alto + 0.2], PAPER);
  // La lamparita verde de banquero
  const { x, y, z } = LAMPARITA;
  pushBox(s, [x - 0.1, y - 0.1, z, x + 0.1, y + 0.1, z + 0.04], BRASS);
  pushBox(s, [x - 0.02, y - 0.02, z + 0.04, x + 0.02, y + 0.02, z + 0.36], BRASS);
  pushBox(s, [x - 0.18, y - 0.1, z + 0.32, x + 0.18, y + 0.1, z + 0.44], GREEN, { g: 0.7 });
  pushBox(s, [x - 0.14, y - 0.07, z + 0.3, x + 0.14, y + 0.07, z + 0.33], BULB, { glow: true });
  // Un timbre y un taco de papeles
  pushBox(s, [x0 + 0.2, y1 - 0.5, alto, x0 + 0.36, y1 - 0.34, alto + 0.08], BRASS);
  pushBox(s, [x0 + 0.12, y0 + 2.75, alto, x0 + 0.32, y0 + 2.98, alto + 0.03], PAPER);
}
/** La bombilla desnuda colgando de su cable. */
function bombilla(s) {
  const { x, y, z } = BOMBILLA;
  pushBox(s, [x - 0.015, y - 0.015, z + 0.18, x + 0.015, y + 0.015, SH], [40, 34, 32], { g: 0.4 });
  pushBox(s, [x - 0.06, y - 0.06, z + 0.1, x + 0.06, y + 0.06, z + 0.2], [70, 60, 50], { g: 0.6 });
  pushBox(s, [x - 0.09, y - 0.09, z - 0.08, x + 0.09, y + 0.09, z + 0.1], BULB, { glow: true });
}
/** Las sábanas sobre lo que queda (un bulto alto y otro bajo), con sus pliegues que caen. */
function sabanas(s) {
  for (const [x0, y0, z0, x1, y1, z1] of SABANAS) {
    pushBox(s, [x0, y0, z0, x1, y1, z1 - 0.12], SABANA);
    pushBox(s, [x0 + 0.1, y0 + 0.1, z1 - 0.12, x1 - 0.1, y1 - 0.1, z1], [236, 230, 216]);
    for (let x = x0 + 0.15; x < x1 - 0.1; x += 0.38) pushBox(s, [x, y1, 0, x + 0.12, y1 + 0.04, z1 - 0.2], [206, 198, 180]);
    for (let y = y0 + 0.15; y < y1 - 0.1; y += 0.42) pushBox(s, [x0 - 0.04, y, 0, x0, y + 0.12, z1 - 0.2], [206, 198, 180]);
  }
}
/** Las cajas de mudanza, con su cinta. */
function cajas(s) {
  CAJAS.forEach(([x0, y0, z0, x1, y1, z1], k) => {
    pushBox(s, [x0, y0, z0, x1, y1, z1], k % 2 ? CARTON : CARTON_D);
    const xm = (x0 + x1) / 2;
    pushBox(s, [xm - 0.04, y0 - 0.005, z1 - 0.005, xm + 0.04, y1 + 0.005, z1 + 0.005], [222, 204, 160], { g: 0.5 });
    pushBox(s, [xm - 0.04, y1, z1 - 0.15, xm + 0.04, y1 + 0.006, z1], [222, 204, 160], { g: 0.5 });
  });
}
/** La escalera de pintor, abierta, con un bote de pintura en un peldaño. */
function escalera(s) {
  const { x, y } = ESCALERA;
  const c = [168, 132, 88];
  for (const dx of [-0.26, 0.2])
    for (const dy of [-0.4, 0.34]) {
      const z1 = 1.85;
      pushBox(s, [x + dx, y + dy, 0, x + dx + 0.06, y + dy + 0.06, z1], c);
    }
  for (let z = 0.45; z < 1.8; z += 0.45) pushBox(s, [x - 0.26, y - 0.4 + z * 0.08, z, x + 0.26, y - 0.3 + z * 0.08, z + 0.05], c);
  pushBox(s, [x - 0.12, y - 0.32, 0.95, x + 0.08, y - 0.14, 1.18], [196, 204, 214]);
  pushBox(s, [x - 0.12, y - 0.32, 1.12, x + 0.08, y - 0.14, 1.18], [120, 150, 170]);
}
/** La estantería vieja de la pared izquierda, vacía, con polvo y una sola caja de vídeo olvidada. */
function estanteria(s) {
  const { y0, y1, fondo, alto } = ESTANTERIA;
  pushBox(s, [0, y0, 0, fondo, y0 + 0.06, alto], WOOD_D);
  pushBox(s, [0, y1 - 0.06, 0, fondo, y1, alto], WOOD_D);
  pushBox(s, [0, y0, 0, 0.04, y1, alto], [86, 56, 36]);
  for (let z = 0.08; z < alto; z += 0.58) pushBox(s, [0, y0, z, fondo, y1, z + 0.05], WOOD);
  pushBox(s, [0, y0, alto - 0.05, fondo + 0.04, y1, alto], WOOD_D);
  pushBox(s, [0.08, y0 + 1.6, 1.32, 0.3, y0 + 1.72, 1.66], [46, 40, 52]);
}

/** De las coordenadas del mueble a las de su casilla, girado a cuartos de vuelta (como `turned` en el piso). */
function girar({ w, d }, rot, b) {
  const at = (lx, ly) => (rot === 1 ? [d - ly, lx] : rot === 2 ? [w - lx, d - ly] : rot === 3 ? [ly, w - lx] : [lx, ly]);
  const p = at(b[0], b[1]);
  const q = at(b[3], b[4]);
  return [Math.min(p[0], q[0]), Math.min(p[1], q[1]), b[2], Math.max(p[0], q[0]), Math.max(p[1], q[1]), b[5]];
}
/** Los lomos de tus libros en la estantería vieja de la pared (de cara al local, +x). */
function lomosPared(s, libros) {
  const { y0, y1, fondo, alto } = ESTANTERIA;
  let k = 0;
  for (let z = 0.08; z + 0.4 < alto && k < libros.length; z += 0.58) {
    let y = y0 + 0.1;
    while (y < y1 - 0.16 && k < libros.length) {
      const ancho = 0.06 + ((k * 7) % 4) * 0.012;
      const altoL = 0.26 + ((k * 5) % 5) * 0.024;
      pushBox(s, [0.06, y, z + 0.05, fondo - 0.04, y + ancho, z + 0.05 + altoL], colorDe(libros[k]));
      y += ancho + 0.012;
      k += 1;
    }
  }
}
/** Un letrero pintado con letra de píxel (el texto, duro, sin suavizar). */
function paintRotulo(texto, w, h, { fondo = [70, 44, 30], letra = [238, 214, 160], marco = [190, 146, 80], px = 9 } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = `rgb(${fondo.join(',')})`;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = `rgb(${marco.join(',')})`;
  ctx.fillRect(0, 0, w, 1);
  ctx.fillRect(0, h - 1, w, 1);
  ctx.fillRect(0, 0, 1, h);
  ctx.fillRect(w - 1, 0, 1, h);
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${px}px Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(texto, w / 2, h / 2 + 1, w - 6);
  // Sin medias tintas: cada píxel es letra o fondo
  const img = ctx.getImageData(2, 2, w - 4, h - 4);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = img.data[i] - fondo[0];
    const on = v > 90;
    img.data[i] = on ? letra[0] : fondo[0];
    img.data[i + 1] = on ? letra[1] : fondo[1];
    img.data[i + 2] = on ? letra[2] : fondo[2];
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 2, 2);
  return c;
}
/** La rejilla de Decorar: casillas con su filete ámbar, transparentes. */
function paintRejilla() {
  const n = 16;
  const c = document.createElement('canvas');
  c.width = CUADRICULA.w * n;
  c.height = CUADRICULA.d * n;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(231,183,101,0.10)';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = 'rgba(244,206,140,0.75)';
  for (let k = 0; k <= CUADRICULA.w; k += 1) ctx.fillRect(Math.min(c.width - 1, k * n), 0, 1, c.height);
  for (let k = 0; k <= CUADRICULA.d; k += 1) ctx.fillRect(0, Math.min(c.height - 1, k * n), c.width, 1);
  return c;
}

/** Pilar, de pie detrás del mostrador (el mismo personaje de cajas que en las salas), centrada en su sitio. */
function figuraKit(avatar, luz) {
  const s = kit();
  let boxes = [];
  try {
    boxes = actorBoxes(avatar, { pose: 'stand', x: 0, y: 0, facing: 0 });
  } catch {
    boxes = actorBoxes(DEFAULT_AVATAR, { pose: 'stand', x: 0, y: 0, facing: 0 });
  }
  const all = boxes.map((b) => b.b);
  const cx = (Math.min(...all.map((b) => b[0])) + Math.max(...all.map((b) => b[3]))) / 2;
  const cy = (Math.min(...all.map((b) => b[1])) + Math.max(...all.map((b) => b[4]))) / 2;
  for (const bx of boxes) pushBox(s, [bx.b[0] - cx, bx.b[1] - cy, bx.b[2], bx.b[3] - cx, bx.b[4] - cy, bx.b[5]], bx.c, { g: luz });
  // El delantal verde, por delante (el frente de la figura mira a +y)
  const maxY = Math.max(...all.map((b) => b[4])) - cy;
  pushBox(s, [-0.17, maxY - 0.02, 0.62, 0.17, maxY + 0.02, 1.22], GREEN, { g: luz });
  return s;
}

// ── Lo que se mueve: la lluvia del escaparate y el cartel de la puerta ──
const LETRAS = {
  S: ['###', '#..', '###', '..#', '###'],
  E: ['###', '#..', '##.', '#..', '###'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
};
/** El cartel de cartón, escrito a rotulador rojo: «SE» encima de «TRASPASA». */
function paintCartel() {
  const W = 40;
  const H = 16;
  const lineas = [
    ['SE', 2],
    ['TRASPASA', 9],
  ];
  const tinta = new Set();
  for (const [txt, y0] of lineas) {
    const ancho = txt.length * 4 - 1;
    let x = Math.floor((W - ancho) / 2);
    for (const ch of txt) {
      LETRAS[ch].forEach((row, dy) => [...row].forEach((c, dx) => c === '#' && tinta.add(`${x + dx},${y0 + dy}`)));
      x += 4;
    }
  }
  return canvasOf(W, H, (ix, iy) => {
    if (ix === 0 || iy === 0 || ix === W - 1 || iy === H - 1) return rgb(150, 112, 70);
    if (tinta.has(`${ix},${iy}`)) return rgb(178, 40, 40);
    return noise(ix * 0.7, iy * 0.7) > 0.7 ? rgb(196, 156, 104) : rgb(210, 170, 116);
  });
}
function paintLluvia(canvas, t, quieto) {
  const ctx = canvas.getContext('2d');
  const { width: W, height: H } = canvas;
  ctx.clearRect(0, 0, W, H);
  const img = ctx.getImageData(0, 0, W, H);
  const px = new Uint32Array(img.data.buffer);
  const alfa = (a, c) => ((a << 24) | (c & 0xffffff)) >>> 0;
  // Gotas que resbalan por el cristal, cada una a su paso, y su rastro
  for (let k = 0; k < 46; k += 1) {
    const x = Math.floor(hash(k, 1) * W);
    const v = 0.25 + hash(k, 2) * 0.6;
    const y = Math.floor(frac(hash(k, 3) + (quieto ? 0 : t * v * 0.18)) * (H + 6)) - 3;
    for (let d = 0; d < 4; d += 1) {
      const yy = y - d;
      if (yy < 0 || yy >= H) continue;
      px[yy * W + x] = alfa(d === 0 ? 150 : 70 - d * 15, d === 0 ? rgb(230, 236, 255) : rgb(170, 186, 230));
    }
  }
  // Gotitas quietas
  for (let k = 0; k < 90; k += 1) {
    const x = Math.floor(hash(k, 7) * W);
    const y = Math.floor(hash(k, 8) * H);
    px[y * W + x] = alfa(60, rgb(200, 214, 250));
  }
  ctx.putImageData(img, 0, 0);
}

/**
 * Monta el local en `container`. `onPick(id)`: se ha tocado un sitio ('pilar', 'cortina', 'escaparate'). `onFrame(tags)`:
 * en cada cuadro, dónde caen los letreros (x, y en px del contenedor, y si se ven). `onLost()`: se perdió el WebGL.
 */
// ── Revisión del bloque 3 (12-11-2026): la barra artesanal, sobre el mostrador a la izquierda de la lamparita. Una cafetera de
// palanca de cobre, la tetera de hierro con su colador, los tarros de grano (u hoja), las jarritas de leche, la lata de
// canela y el tarro de miel; la taza en su plato, que se llena de verdad. Tocar cada cosa la elige (marco ámbar). ──
const COBRE = [190, 112, 70];
const COBRE_L = [226, 150, 96];
const LOZA = [238, 230, 212];
const BARRA_Z = 1.05;
/** Dónde está cada cosa de la barra (caja del mundo para tocarla) y qué elige. */
export const BARRA_COSAS = {
  'barra:bebida:cafe': { box: [7.4, 5.88, BARRA_Z, 7.94, 6.22, BARRA_Z + 0.62], parte: 'bebida', valor: 'cafe' },
  'barra:bebida:te': { box: [7.5, 6.32, BARRA_Z, 7.88, 6.58, BARRA_Z + 0.34], parte: 'bebida', valor: 'te' },
  'barra:grano:suave': { box: [7.64, 5.44, BARRA_Z, 7.86, 5.64, BARRA_Z + 0.3], parte: 'grano', valor: 'suave' },
  'barra:grano:intenso': { box: [7.64, 5.66, BARRA_Z, 7.86, 5.86, BARRA_Z + 0.3], parte: 'grano', valor: 'intenso' },
  'barra:leche:entera': { box: [7.32, 5.5, BARRA_Z, 7.56, 5.7, BARRA_Z + 0.2], parte: 'leche', valor: 'entera' },
  'barra:leche:avena': { box: [7.32, 5.72, BARRA_Z, 7.56, 5.92, BARRA_Z + 0.2], parte: 'leche', valor: 'avena' },
  'barra:toque:canela': { box: [7.32, 6.3, BARRA_Z, 7.54, 6.48, BARRA_Z + 0.2], parte: 'toque', valor: 'canela' },
  'barra:toque:miel': { box: [7.32, 6.5, BARRA_Z, 7.54, 6.7, BARRA_Z + 0.26], parte: 'toque', valor: 'miel' },
};
/** El color de lo que hay en la taza: la bebida, su fuerza y la leche. */
function colorBebida({ bebida, grano, leche }) {
  const base = bebida === 'te' ? (grano === 'intenso' ? [150, 74, 36] : [206, 150, 64]) : grano === 'intenso' ? [62, 34, 22] : [104, 62, 36];
  if (!leche || leche === 'sin') return base;
  const l = leche === 'avena' ? [226, 204, 160] : [244, 236, 220];
  return base.map((c, k) => Math.round(c * 0.45 + l[k] * 0.55));
}
/** La taza con su plato, hueca, centrada en (cx, cy) sobre z0; `lleno` de 0 a 1. */
function taza(s, cx, cy, z0, { bebida = null, grano = null, leche = 'sin', toque = 'nada', lleno = 0, humo = false } = {}, g = null) {
  const o = { g };
  pushBox(s, [cx - 0.08, cy - 0.08, z0, cx + 0.08, cy + 0.08, z0 + 0.014], LOZA, o);
  const b = z0 + 0.014;
  const t = 0.012;
  pushBox(s, [cx - 0.05, cy - 0.05, b, cx + 0.05, cy + 0.05, b + 0.012], LOZA, o);
  pushBox(s, [cx - 0.05, cy - 0.05, b, cx - 0.05 + t, cy + 0.05, b + 0.1], LOZA, o);
  pushBox(s, [cx + 0.05 - t, cy - 0.05, b, cx + 0.05, cy + 0.05, b + 0.1], LOZA, o);
  pushBox(s, [cx - 0.05, cy - 0.05, b, cx + 0.05, cy - 0.05 + t, b + 0.1], LOZA, o);
  pushBox(s, [cx - 0.05, cy + 0.05 - t, b, cx + 0.05, cy + 0.05, b + 0.1], LOZA, o);
  pushBox(s, [cx + 0.05, cy - 0.012, b + 0.03, cx + 0.075, cy + 0.012, b + 0.042], LOZA, o);
  pushBox(s, [cx + 0.063, cy - 0.012, b + 0.042, cx + 0.075, cy + 0.012, b + 0.075], LOZA, o);
  pushBox(s, [cx + 0.05, cy - 0.012, b + 0.075, cx + 0.075, cy + 0.012, b + 0.087], LOZA, o);
  // Una franja de color en la loza
  pushBox(s, [cx - 0.051, cy - 0.051, b + 0.07, cx + 0.051, cy + 0.051, b + 0.078], [150, 74, 60], o);
  if (!bebida || lleno <= 0) return;
  const top = b + 0.012 + Math.min(1, lleno) * 0.078;
  const c = colorBebida({ bebida, grano, leche });
  pushBox(s, [cx - 0.05 + t, cy - 0.05 + t, b + 0.012, cx + 0.05 - t, cy + 0.05 - t, top], c, o);
  if (lleno >= 1 && leche && leche !== 'sin') pushBox(s, [cx - 0.03, cy - 0.03, top, cx + 0.03, cy + 0.03, top + 0.003], [250, 244, 230], { glow: true });
  if (lleno >= 1 && toque === 'canela')
    for (const [dx, dy] of [
      [-0.02, -0.01],
      [0.012, 0.018],
      [0.02, -0.02],
      [-0.008, 0.024],
    ])
      pushBox(s, [cx + dx - 0.005, cy + dy - 0.005, top, cx + dx + 0.005, cy + dy + 0.005, top + 0.004], [120, 62, 34], o);
  if (lleno >= 1 && toque === 'miel') {
    pushBox(s, [cx - 0.025, cy - 0.004, top, cx + 0.025, cy + 0.004, top + 0.004], [255, 200, 80], { glow: true });
    pushBox(s, [cx - 0.004, cy - 0.025, top, cx + 0.004, cy + 0.025, top + 0.004], [255, 200, 80], { glow: true });
  }
  if (humo)
    for (const [dx, dz, w] of [
      [-0.015, 0.05, 0.012],
      [0.012, 0.09, 0.01],
      [-0.006, 0.13, 0.008],
    ])
      pushBox(s, [cx + dx - w * 0.6, cy - w * 0.6, top + dz, cx + dx + w * 0.6, cy + w * 0.6, top + dz + w * 1.2], [214, 204, 190], o);
}
/** El marco ámbar en la barra alrededor de lo elegido. */
function marcoBarra(s, [x0, y0, , x1, y1]) {
  const z = BARRA_Z + 0.004;
  const e = 0.012;
  const c = [255, 206, 120];
  for (const bx of [
    [x0, y0, z, x1, y0 + e, z + 0.006],
    [x0, y1 - e, z, x1, y1, z + 0.006],
    [x0, y0, z, x0 + e, y1, z + 0.006],
    [x1 - e, y0, z, x1, y1, z + 0.006],
  ])
    pushBox(s, bx, c, { glow: true });
}
/** Todo lo de la barra, con lo elegido de la receta (y la taza, con lo que lleve). */
function barraKit(s, receta = {}, { lleno = 0, vertiendo = false, humo = false } = {}) {
  const z = BARRA_Z;
  const g = 0.86;
  const o = { g };
  // La cafetera de palanca: cobre con aros de latón, cúpula, manómetro, el grupo hacia ti y su palanca de madera
  pushBox(s, [7.6, 5.9, z, 7.93, 6.2, z + 0.06], [74, 50, 36], o);
  pushBox(s, [7.65, 5.94, z + 0.06, 7.89, 6.16, z + 0.44], COBRE, o);
  pushBox(s, [7.645, 5.935, z + 0.13, 7.895, 6.165, z + 0.16], BRASS, o);
  pushBox(s, [7.645, 5.935, z + 0.36, 7.895, 6.165, z + 0.39], BRASS, o);
  pushBox(s, [7.68, 5.97, z + 0.44, 7.86, 6.13, z + 0.5], COBRE_L, o);
  pushBox(s, [7.74, 6.03, z + 0.5, 7.8, 6.07, z + 0.58], BRASS, o);
  pushBox(s, [7.645, 5.99, z + 0.26, 7.65, 6.05, z + 0.32], [244, 236, 214], { glow: true });
  pushBox(s, [7.54, 6.0, z + 0.2, 7.65, 6.1, z + 0.27], BRASS, o);
  pushBox(s, [7.38, 6.035, z + 0.215, 7.54, 6.065, z + 0.245], [96, 58, 36], o);
  pushBox(s, [7.86, 6.04, z + 0.44, 7.89, 6.06, z + 0.72], [58, 44, 36], o);
  pushBox(s, [7.845, 6.025, z + 0.72, 7.905, 6.075, z + 0.79], [96, 58, 36], o);
  // La lucecita: encendida si hoy toca café
  pushBox(s, [7.645, 6.09, z + 0.08, 7.65, 6.12, z + 0.11], receta.bebida === 'cafe' ? [255, 120, 70] : [90, 40, 30], { glow: receta.bebida === 'cafe' });
  // La tetera de hierro en su salvamanteles, con asa de latón y el pico hacia la taza
  pushBox(s, [7.6, 6.35, z, 7.84, 6.55, z + 0.02], BRASS, o);
  pushBox(s, [7.62, 6.37, z + 0.02, 7.82, 6.53, z + 0.18], [52, 78, 76], o);
  pushBox(s, [7.66, 6.41, z + 0.18, 7.78, 6.49, z + 0.21], [44, 64, 62], o);
  pushBox(s, [7.7, 6.43, z + 0.21, 7.74, 6.47, z + 0.24], BRASS, o);
  pushBox(s, [7.55, 6.43, z + 0.07, 7.62, 6.47, z + 0.11], [52, 78, 76], o);
  pushBox(s, [7.52, 6.43, z + 0.11, 7.56, 6.47, z + 0.14], [52, 78, 76], o);
  pushBox(s, [7.66, 6.44, z + 0.24, 7.68, 6.46, z + 0.32], BRASS, o);
  pushBox(s, [7.76, 6.44, z + 0.24, 7.78, 6.46, z + 0.32], BRASS, o);
  pushBox(s, [7.66, 6.44, z + 0.32, 7.78, 6.46, z + 0.34], BRASS, o);
  // Los tarros: cristal con corcho y etiqueta; dentro, grano (u hoja si toca té), claro o tostado
  const te = receta.bebida === 'te';
  for (const [y, fuerte] of [
    [5.54, false],
    [5.76, true],
  ]) {
    const dentro = te ? (fuerte ? [72, 52, 36] : [126, 150, 78]) : fuerte ? [58, 34, 24] : [168, 112, 62];
    pushBox(s, [7.69, y - 0.07, z, 7.81, y + 0.07, z + 0.19], dentro, o);
    pushBox(
      s,
      [7.7, y - 0.06, z + 0.06, 7.8, y + 0.06, z + 0.07],
      dentro.map((c) => Math.max(0, c - 26)),
      o,
    );
    for (const [dx, dy] of [
      [-0.07, -0.08],
      [0.06, -0.08],
      [-0.07, 0.07],
      [0.06, 0.07],
    ])
      pushBox(s, [7.75 + dx + 0.003, y + dy + 0.003, z, 7.75 + dx + 0.009, y + dy + 0.009, z + 0.21], [176, 196, 196], o);
    pushBox(s, [7.685, y - 0.075, z + 0.19, 7.815, y + 0.075, z + 0.205], [176, 196, 196], o);
    pushBox(s, [7.7, y - 0.06, z + 0.22, 7.8, y + 0.06, z + 0.27], [172, 128, 82], o);
    pushBox(s, [7.675, y - 0.04, z + 0.07, 7.685, y + 0.04, z + 0.14], PAPER, o);
    pushBox(s, [7.672, y - 0.015, z + 0.095, 7.676, y + 0.015, z + 0.115], fuerte ? [58, 34, 24] : [168, 112, 62], o);
  }
  // Las jarritas de leche: de vaca (franja azul) y de avena (franja verde)
  for (const [y, cuerpo, franja] of [
    [5.6, [240, 236, 226], [86, 118, 168]],
    [5.82, [218, 200, 156], [128, 152, 84]],
  ]) {
    pushBox(s, [7.39, y - 0.06, z, 7.51, y + 0.06, z + 0.14], cuerpo, o);
    pushBox(s, [7.388, y - 0.062, z + 0.1, 7.512, y + 0.062, z + 0.115], franja, o);
    pushBox(s, [7.36, y - 0.025, z + 0.11, 7.39, y + 0.025, z + 0.14], cuerpo, o);
    pushBox(s, [7.51, y - 0.012, z + 0.04, 7.545, y + 0.012, z + 0.115], cuerpo, o);
  }
  // La lata de canela (con dos ramitas) y el tarro de miel con su cazo
  pushBox(s, [7.38, 6.34, z, 7.5, 6.46, z + 0.13], [150, 78, 48], o);
  pushBox(s, [7.375, 6.335, z + 0.13, 7.505, 6.465, z + 0.15], BRASS, o);
  pushBox(s, [7.41, 6.37, z + 0.15, 7.425, 6.43, z + 0.19], [128, 66, 36], o);
  pushBox(s, [7.44, 6.38, z + 0.15, 7.455, 6.44, z + 0.18], [128, 66, 36], o);
  pushBox(s, [7.38, 6.54, z, 7.5, 6.66, z + 0.12], [222, 164, 52], o);
  pushBox(s, [7.39, 6.55, z + 0.02, 7.49, 6.65, z + 0.1], [255, 196, 84], { glow: true });
  pushBox(s, [7.375, 6.535, z + 0.12, 7.505, 6.665, z + 0.14], [176, 120, 60], o);
  pushBox(s, [7.43, 6.59, z + 0.14, 7.45, 6.61, z + 0.25], [150, 100, 60], o);
  pushBox(s, [7.42, 6.58, z + 0.2, 7.46, 6.62, z + 0.23], [150, 100, 60], o);
  // El colador del té, sobre la taza, si toca té
  if (te) pushBox(s, [7.43, 6.01, z + 0.14, 7.51, 6.09, z + 0.16], BRASS, o);
  // La taza, bajo el grupo, y el chorro mientras se vierte
  taza(s, 7.47, 6.05, z, { ...receta, lleno, humo }, g);
  if (vertiendo && receta.bebida) {
    const tope = z + 0.026 + Math.min(1, lleno) * 0.078;
    pushBox(s, [7.465, 6.045, tope, 7.475, 6.055, te ? z + 0.14 : z + 0.2], colorBebida({ ...receta, leche: 'sin' }), { glow: true });
  }
  // Lo elegido, con su marco
  for (const cosa of Object.values(BARRA_COSAS)) if (receta[cosa.parte] === cosa.valor) marcoBarra(s, cosa.box);
}
/** La taza que llevas en la mano (en el sitio de la cámara: x a la derecha, z arriba, y hacia ti). */
function tazaEnMano(receta) {
  const s = kit();
  taza(s, 0, 0, 0, { ...receta, lleno: 1, humo: true }, 0.62);
  return s;
}
/**
 * Lo que solo llevan los excéntricos (no es ninguna prenda): su tocado sobre la cabeza, un aura de su color en el suelo y
 * unas chispas. `boxes`: las cajas de la figura ya en el mundo; `tema`: su color.
 */
function adornoExcentrico(s, boxes, { tocado, tema }, sx, sy) {
  const all = boxes.map((b) => b.b);
  const top = Math.max(...all.map((b) => b[5]));
  const cabeza = all.filter((b) => b[5] > top - 0.3);
  const hx = (Math.min(...cabeza.map((b) => b[0])) + Math.max(...cabeza.map((b) => b[3]))) / 2;
  const hy = (Math.min(...cabeza.map((b) => b[1])) + Math.max(...cabeza.map((b) => b[4]))) / 2;
  const t = top - 0.02;
  const o = { g: 1 };
  const oscuro = tema.map((c) => Math.round(c * 0.5));
  const oro = [236, 190, 90];
  if (tocado === 'turbante') {
    pushBox(s, [hx - 0.2, hy - 0.2, t, hx + 0.2, hy + 0.2, t + 0.12], tema, o);
    pushBox(
      s,
      [hx - 0.16, hy - 0.16, t + 0.12, hx + 0.16, hy + 0.16, t + 0.24],
      tema.map((c) => Math.min(255, c + 30)),
      o,
    );
    pushBox(s, [hx - 0.04, hy - 0.215, t + 0.06, hx + 0.04, hy - 0.2, t + 0.14], oro, { glow: true });
    pushBox(s, [hx - 0.015, hy - 0.2, t + 0.14, hx + 0.015, hy - 0.17, t + 0.42], [250, 240, 220], o);
  } else if (tocado === 'bombin') {
    pushBox(s, [hx - 0.26, hy - 0.26, t, hx + 0.26, hy + 0.26, t + 0.03], [40, 34, 32], o);
    pushBox(s, [hx - 0.17, hy - 0.17, t + 0.03, hx + 0.17, hy + 0.17, t + 0.22], [40, 34, 32], o);
    pushBox(s, [hx - 0.175, hy - 0.175, t + 0.04, hx + 0.175, hy + 0.175, t + 0.08], tema, o);
    // El reloj de oro que flota a su lado
    pushBox(s, [hx + 0.3, hy - 0.05, t - 0.2, hx + 0.4, hy + 0.05, t - 0.1], oro, { glow: true });
    pushBox(s, [hx + 0.33, hy - 0.06, t - 0.17, hx + 0.37, hy - 0.05, t - 0.13], [60, 40, 30], o);
  } else if (tocado === 'velo') {
    pushBox(s, [hx - 0.32, hy - 0.32, t + 0.02, hx + 0.32, hy + 0.32, t + 0.05], oscuro, o);
    pushBox(s, [hx - 0.16, hy - 0.16, t + 0.05, hx + 0.16, hy + 0.16, t + 0.18], oscuro, o);
    pushBox(s, [hx - 0.3, hy - 0.3, t - 0.3, hx - 0.28, hy + 0.3, t + 0.02], tema, { glow: true });
    pushBox(s, [hx + 0.28, hy - 0.3, t - 0.3, hx + 0.3, hy + 0.3, t + 0.02], tema, { glow: true });
    pushBox(s, [hx - 0.3, hy - 0.3, t - 0.3, hx + 0.3, hy - 0.28, t + 0.02], tema, { glow: true });
  } else if (tocado === 'tricornio') {
    pushBox(s, [hx - 0.28, hy - 0.16, t, hx + 0.28, hy + 0.16, t + 0.12], [36, 36, 48], o);
    pushBox(s, [hx - 0.16, hy - 0.28, t, hx + 0.16, hy + 0.16, t + 0.12], [36, 36, 48], o);
    pushBox(s, [hx - 0.29, hy - 0.17, t + 0.1, hx + 0.29, hy + 0.17, t + 0.13], oro, o);
    pushBox(s, [hx + 0.1, hy - 0.04, t + 0.12, hx + 0.13, hy + 0.04, t + 0.44], [246, 240, 230], o);
    pushBox(s, [hx + 0.13, hy - 0.03, t + 0.3, hx + 0.17, hy + 0.03, t + 0.46], [246, 240, 230], o);
  } else if (tocado === 'flores') {
    const flores = [
      [-0.18, -0.12, [250, 140, 180]],
      [0.0, -0.2, [255, 230, 120]],
      [0.18, -0.12, [250, 250, 250]],
      [-0.2, 0.08, [200, 120, 220]],
      [0.2, 0.08, [255, 170, 120]],
      [0.0, 0.18, [250, 140, 180]],
    ];
    for (const [dx, dy, c] of flores) pushBox(s, [hx + dx - 0.07, hy + dy - 0.07, t, hx + dx + 0.07, hy + dy + 0.07, t + 0.1], c, { glow: true });
    pushBox(s, [hx - 0.06, hy - 0.06, t + 0.08, hx + 0.06, hy + 0.06, t + 0.22], tema, { glow: true });
  } else {
    pushBox(s, [hx - 0.15, hy - 0.15, t, hx + 0.15, hy + 0.15, t + 0.1], [30, 30, 36], o);
    pushBox(s, [hx - 0.28, hy - 0.28, t + 0.1, hx + 0.28, hy + 0.28, t + 0.13], [30, 30, 36], o);
    pushBox(s, [hx - 0.02, hy - 0.02, t + 0.13, hx + 0.02, hy + 0.02, t + 0.15], oro, { glow: true });
    pushBox(s, [hx + 0.26, hy - 0.015, t - 0.12, hx + 0.29, hy + 0.015, t + 0.12], oro, { glow: true });
  }
  // El aura en el suelo y unas chispas alrededor
  const r = 0.6;
  const e = 0.03;
  for (const bx of [
    [sx - r, sy - r, 0.012, sx + r, sy - r + e, 0.02],
    [sx - r, sy + r - e, 0.012, sx + r, sy + r, 0.02],
    [sx - r, sy - r, 0.012, sx - r + e, sy + r, 0.02],
    [sx + r - e, sy - r, 0.012, sx + r, sy + r, 0.02],
  ])
    pushBox(s, bx, tema, { glow: true });
  for (const [dx, dy, dz] of [
    [-0.42, -0.3, 0.6],
    [0.45, -0.2, 1.1],
    [-0.35, 0.4, 1.4],
    [0.38, 0.38, 0.4],
    [0.05, -0.5, 1.7],
  ])
    pushBox(s, [sx + dx - 0.025, sy + dy - 0.025, dz, sx + dx + 0.025, sy + dy + 0.025, dz + 0.05], [255, 236, 170], { glow: true });
}

export function mountCafe(container, { onPick = () => {}, onFrame = () => {}, onLost = () => {}, onMove = () => {}, onDecor = () => {} } = {}) {
  const renderer = new WebGLRenderer({ antialias: false, powerPreference: 'low-power', preserveDrawingBuffer: true });
  const canvas = renderer.domElement;
  canvas.className = 'cf3-canvas';
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'El bajo, vacío y en traspaso. Arrastra o usa las flechas para mirar; toca el suelo para andar y a Pilar, en el mostrador, para hablar con ella.');
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x140e14);

  const scene = new Scene();
  scene.background = new Color(0x140e14);
  scene.fog = new Fog(0x1a1216, 7, 22);
  const camera = new PerspectiveCamera(70, 1, 0.06, 40);
  scene.add(camera);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new Vector2(ART_W, ART_W), 0.55, 0.6, 0.82));
  composer.addPass(new OutputPass());
  const owned = [];
  const own = (x) => (owned.push(x), x);
  const flat = own(new MeshBasicMaterial({ vertexColors: true }));
  const hidden = own(new MeshBasicMaterial({ visible: false }));
  const plane = (w, h, tex, place, { cut = false, glow = false, smooth = false } = {}) => {
    const map = own(texture(tex, smooth));
    const mat = glow ? new MeshBasicMaterial({ map, transparent: true, depthWrite: false }) : new MeshBasicMaterial({ map, alphaTest: cut ? 0.5 : 0, transparent: cut });
    own(mat);
    const mesh = new Mesh(own(new PlaneGeometry(w, h)), mat);
    place(mesh);
    scene.add(mesh);
    return mesh;
  };

  // ── El local: suelo, techo y las cuatro paredes ──
  plane(SW, SD, paintFloor(), (m) => {
    m.rotation.x = -Math.PI / 2;
    m.position.set(SW / 2, 0, SD / 2);
  });
  plane(SW, SD, paintCeiling(), (m) => {
    m.rotation.x = Math.PI / 2;
    m.position.set(SW / 2, SH, SD / 2);
  });
  // El fondo queda tras la cortina: yeso liso
  plane(
    SW,
    SH,
    paintWall(SW, (a, b) => [a, 0.05, b]),
    (m) => m.position.set(SW / 2, SH / 2, 0),
  );
  // Izquierda (x = 0, a es y desde la entrada): el hueco claro de los carteles de antes
  plane(
    SD,
    SH,
    paintWall(
      SD,
      (a, b) => [0.05, SD - a, b],
      () => null,
      [
        [3.0, 2.6, 4.4, 4.1],
        [SD - 4.5, 2.9, SD - 3.4, 4.3],
      ],
    ),
    (m) => {
      m.rotation.y = Math.PI / 2;
      m.position.set(0, SH / 2, SD / 2);
    },
  );
  // Derecha (x = SW, a es y desde el fondo): las baldas de detrás del mostrador y el hueco de un cartel
  plane(
    SD,
    SH,
    paintWall(SD, (a, b) => [SW - 0.05, a, b], derechaExtra, [[8.4, 2.4, 10.2, 3.9]]),
    (m) => {
      m.rotation.y = -Math.PI / 2;
      m.position.set(SW, SH / 2, SD / 2);
    },
  );
  // Delante (y = SD): escaparate y puerta; el hueco del rótulo viejo encima
  plane(
    SW,
    SH,
    paintWall(SW, (a, b) => [SW - a, SD - 0.05, b], delanteExtra, [[SW - 6.0, 3.7, SW - 0.8, 4.5]]),
    (m) => {
      m.rotation.y = Math.PI;
      m.position.set(SW / 2, SH / 2, SD);
    },
  );
  {
    const s = kit();
    cortina(s);
    caballete(s);
    mostrador(s);
    bombilla(s);
    estanteria(s);
    // El felpudo de la entrada
    pushBox(s, [PUERTA.x0 - 0.1, SD - 0.9, 0, PUERTA.x1 + 0.1, SD - 0.15, 0.02], [120, 92, 60]);
    scene.add(new Mesh(own(geometryOf(s)), flat));
  }
  // Los trastos del traspaso: se van al inaugurar
  const trastos = (() => {
    const s = kit();
    sabanas(s);
    cajas(s);
    escalera(s);
    const m = new Mesh(own(geometryOf(s)), flat);
    scene.add(m);
    return m;
  })();
  // La lámina en blanco del caballete (un papel con el boceto a lápiz de una fachada con toldo, muy flojo)
  const lamina = canvasOf(24, 18, (ix, iy) => {
    if (ix === 0 || iy === 0 || ix === 23 || iy === 17) return rgb(196, 186, 160);
    const boceto =
      (iy === 6 && ix > 3 && ix < 20) ||
      ((ix === 4 || ix === 19) && iy > 6 && iy < 15) ||
      (iy === 14 && ix > 3 && ix < 20) ||
      (iy === 4 && ix > 2 && ix < 21 && ix % 2 === 0) ||
      (iy === 5 && ix > 2 && ix < 21 && ix % 3 === 0);
    return boceto ? rgb(150, 144, 136) : rgb(236, 230, 214);
  });
  plane(1.3, 0.98, lamina, (m) => m.position.set(CABALLETE.x, 1.33, CABALLETE.y + 0.13));
  // El cartel «SE TRASPASA», colgado de la puerta de cara al local, con su cordel
  const cartel = plane(CARTEL.ancho, CARTEL.alto, paintCartel(), (m) => {
    m.rotation.y = Math.PI;
    m.position.set(CARTEL.x, CARTEL.z, SD - 0.07);
  });
  // Al inaugurar: «ABIERTO» en la puerta y el rótulo con el nombre del café en la pared de detrás de la barra
  const abierto = plane(CARTEL.ancho, CARTEL.alto, paintRotulo('ABIERTO', 40, 15, { fondo: [196, 160, 104], letra: [120, 40, 36], marco: [150, 110, 70], px: 10 }), (m) => {
    m.rotation.y = Math.PI;
    m.position.set(CARTEL.x, CARTEL.z, SD - 0.07);
    m.visible = false;
  });
  let rotulo = null;
  function ponerRotulo(nombre) {
    if (rotulo) {
      scene.remove(rotulo);
      rotulo.material.map.dispose();
      rotulo.material.dispose();
      rotulo.geometry.dispose();
      rotulo = null;
    }
    if (!nombre) return;
    const map = texture(paintRotulo(nombre, 120, 22, { px: 11 }));
    rotulo = new Mesh(new PlaneGeometry(3.0, 0.55), new MeshBasicMaterial({ map }));
    rotulo.rotation.y = -Math.PI / 2;
    rotulo.position.set(SW - 0.05, 3.55, PILAR.y);
    scene.add(rotulo);
  }
  {
    const s = kit();
    pushBox(s, [CARTEL.x - 0.5, SD - 0.08, CARTEL.z + CARTEL.alto / 2, CARTEL.x - 0.48, SD - 0.06, CARTEL.z + 0.6], [60, 50, 40], { g: 0.4 });
    pushBox(s, [CARTEL.x + 0.48, SD - 0.08, CARTEL.z + CARTEL.alto / 2, CARTEL.x + 0.5, SD - 0.06, CARTEL.z + 0.6], [60, 50, 40], { g: 0.4 });
    pushBox(s, [CARTEL.x - 0.03, SD - 0.1, CARTEL.z + 0.58, CARTEL.x + 0.03, SD - 0.04, CARTEL.z + 0.64], BRASS, { g: 0.5 });
    scene.add(new Mesh(own(geometryOf(s)), flat));
  }
  // Pilar, detrás del mostrador, mirando al local (−x)
  {
    const m = new Mesh(own(geometryOf(figuraKit(PILAR_ASPECTO, glowAt(PILAR.x, PILAR.y, 1.5) + 0.08))), flat);
    m.position.set(PILAR.x, 0, PILAR.y);
    m.rotation.y = -Math.PI / 2;
    scene.add(m);
  }

  // ── La lluvia en el escaparate y en el cristal de la puerta ──
  const lluviaCanvas = document.createElement('canvas');
  lluviaCanvas.width = 86;
  lluviaCanvas.height = 44;
  const ew = ESCAPARATE.x1 - ESCAPARATE.x0;
  const eh = ESCAPARATE.z1 - ESCAPARATE.z0;
  const lluvia = plane(
    ew,
    eh,
    lluviaCanvas,
    (m) => {
      m.rotation.y = Math.PI;
      m.position.set((ESCAPARATE.x0 + ESCAPARATE.x1) / 2, (ESCAPARATE.z0 + ESCAPARATE.z1) / 2, SD - 0.04);
    },
    { glow: true },
  );

  // ── El polvo que flota en la luz de la bombilla ──
  const MOTAS = 60;
  const semilla = Array.from({ length: MOTAS }, (_, k) => [hash(k, 1), hash(k, 2), hash(k, 3), hash(k, 4)]);
  const motaGeo = own(new BufferGeometry());
  motaGeo.setAttribute('position', new Float32BufferAttribute(new Float32Array(MOTAS * 3), 3));
  const motas = new Points(motaGeo, own(new PointsMaterial({ color: 0xffe2a8, size: 1, sizeAttenuation: false, transparent: true, opacity: 0.7, depthWrite: false, blending: AdditiveBlending })));
  motas.frustumCulled = false;
  motas.renderOrder = 3;
  scene.add(motas);
  const moverMotas = (t) => {
    const p = motaGeo.attributes.position;
    semilla.forEach(([a, b, c, d], k) => {
      const ang = a * Math.PI * 2 + t * 0.05 * (0.5 + c);
      const rad = 0.3 + b * 1.6;
      const z = 0.4 + frac(d + t * 0.015 * (0.3 + c)) * (BOMBILLA.z - 0.5);
      p.setXYZ(k, BOMBILLA.x + Math.cos(ang) * rad, z, BOMBILLA.y + Math.sin(ang) * rad * 0.8);
    });
    p.needsUpdate = true;
  };
  const pintaVivo = (t) => {
    const quieto = reduced();
    paintLluvia(lluviaCanvas, t, quieto);
    lluvia.material.map.needsUpdate = true;
    moverMotas(quieto ? 0 : t);
  };
  pintaVivo(0);

  // ── El plano: lo colocado, con tus libros en las estanterías ──
  const LIBROS_POR_ESTANTERIA = 56;
  const planoGrupo = new Group();
  scene.add(planoGrupo);
  let estado = { inaugurado: false, nombre: null, plano: { v: 1, items: [] }, libros: [] };
  let modo = { decorar: false, sel: null, mal: false };
  let piezas = [];
  let obstaculos = [];
  const rejilla = plane(
    CUADRICULA.w * CUADRO.celda,
    CUADRICULA.d * CUADRO.celda,
    paintRejilla(),
    (m) => {
      m.rotation.x = -Math.PI / 2;
      const o = enMundo(0, 0);
      m.position.set(o.x + (CUADRICULA.w * CUADRO.celda) / 2, 0.012, o.y + (CUADRICULA.d * CUADRO.celda) / 2);
      m.visible = false;
    },
    { glow: true },
  );
  rejilla.renderOrder = 2;
  function vaciarGrupo() {
    for (const m of planoGrupo.children.slice()) {
      planoGrupo.remove(m);
      m.geometry.dispose();
    }
  }
  function montarPlano() {
    vaciarGrupo();
    piezas = [];
    obstaculos = [];
    let estanterias = 0;
    // Los libros que no caben en las estanterías del café van a la de la pared
    const enCafe = estado.plano.items.filter((i) => i.id === 'cafe-estanteria').length * LIBROS_POR_ESTANTERIA;
    for (const it of estado.plano.items) {
      const med = medidas(it.id);
      if (!med) continue;
      const f = footprint(med, it.rot);
      const o = enMundo(it.x, it.y);
      const libros = it.id === 'cafe-estanteria' ? estado.libros.slice(estanterias * LIBROS_POR_ESTANTERIA, (estanterias + 1) * LIBROS_POR_ESTANTERIA) : [];
      if (it.id === 'cafe-estanteria') estanterias += 1;
      const s = kit();
      for (const box of cajasDe(it.id, libros)) {
        const t = girar(med, it.rot, box.b);
        pushBox(s, [o.x + t[0], o.y + t[1], t[2], o.x + t[3], o.y + t[4], t[5]], box.c, { glow: Boolean(box.glow) });
      }
      const mesh = new Mesh(geometryOf(s), flat);
      mesh.userData.uid = it.uid;
      planoGrupo.add(mesh);
      piezas.push(mesh);
      obstaculos.push([o.x + 0.1, o.y + 0.1, 0, o.x + f.w - 0.1, o.y + f.d - 0.1, 1]);
    }
    {
      const s = kit();
      if (estado.inaugurado) lomosPared(s, estado.libros.slice(enCafe));
      // La pieza elegida en Decorar: un marco ámbar en el suelo (rojo si no cabe donde está)
      const sel = modo.decorar && estado.plano.items.find((i) => i.uid === modo.sel);
      if (sel && medidas(sel.id)) {
        const f = footprint(medidas(sel.id), sel.rot);
        const o = enMundo(sel.x, sel.y);
        const c = modo.mal ? [236, 90, 70] : [255, 214, 140];
        const e = 0.06;
        for (const bx of [
          [o.x, o.y, 0, o.x + f.w, o.y + e, 0.05],
          [o.x, o.y + f.d - e, 0, o.x + f.w, o.y + f.d, 0.05],
          [o.x, o.y, 0, o.x + e, o.y + f.d, 0.05],
          [o.x + f.w - e, o.y, 0, o.x + f.w, o.y + f.d, 0.05],
        ])
          pushBox(s, bx, c, { glow: true });
      }
      if (s.pos.length) planoGrupo.add(new Mesh(geometryOf(s), flat));
    }
    trastos.visible = !estado.inaugurado;
    cartel.visible = !estado.inaugurado;
    abierto.visible = estado.inaugurado;
    rejilla.visible = modo.decorar;
    canvas.setAttribute(
      'aria-label',
      estado.inaugurado
        ? `${estado.nombre ?? 'Tu café'}, tu café-librería. Arrastra o usa las flechas para mirar; toca el suelo para andar y a Pilar, en el mostrador, para hablar con ella.`
        : 'El bajo, vacío y en traspaso. Arrastra o usa las flechas para mirar; toca el suelo para andar y a Pilar, en el mostrador, para hablar con ella.',
    );
    montarClientes();
    montarBarra();
  }
  const opcionesPaso = () => ({ limpio: estado.inaugurado, muebles: [...obstaculos, ...obstaculosClientes] });

  // ── Bloque 3 (1.121): los clientes del día, sentados en las sillas y taburetes del plano (los que esperan, sin libro y
  // con su letrero; los atendidos, leyendo el libro que les diste). Si faltan asientos, de pie junto al escaparate. ──
  const clientesGrupo = new Group();
  scene.add(clientesGrupo);
  let clientes = [];
  let pickersClientes = [];
  let obstaculosClientes = [];
  let sitiosClientes = {};
  const ASIENTO = { 'cafe-silla': { at: [0.5, 0.42], h: 0.51 }, 'cafe-taburete': { at: [0.5, 0.42], h: 0.82 } };
  const DE_PIE = [
    [1.4, 9.7],
    [2.5, 9.9],
    [3.6, 9.7],
    [4.7, 9.9],
    [5.6, 9.6],
    [2.0, 8.7],
    [3.1, 8.9],
  ];
  function asientos() {
    const out = [];
    for (const it of estado.plano.items) {
      const a = ASIENTO[it.id];
      const med = medidas(it.id);
      if (!a || !med) continue;
      const t = girar(med, it.rot, [a.at[0], a.at[1], 0, a.at[0], a.at[1], 0]);
      const o = enMundo(it.x, it.y);
      out.push({ x: o.x + t[0], y: o.y + t[1], h: a.h, facing: it.rot ?? 0 });
    }
    return out;
  }
  function montarClientes() {
    for (const m of clientesGrupo.children.slice()) {
      clientesGrupo.remove(m);
      m.geometry.dispose();
    }
    pickersClientes = [];
    obstaculosClientes = [];
    sitiosClientes = {};
    if (!estado.inaugurado || modo.decorar) {
      invalidate();
      return;
    }
    const libres = asientos();
    clientes.forEach((c, k) => {
      const sentado = k < libres.length ? libres[k] : null;
      const [sx, sy] = sentado ? [sentado.x, sentado.y] : DE_PIE[(k - libres.length) % DE_PIE.length];
      const estadoFigura = sentado ? { pose: 'sit', x: sx, y: sy, h: sentado.h, facing: sentado.facing, libro: c.libro ? colorDe(c.libro) : null } : { pose: 'stand', x: sx, y: sy, facing: 2 };
      let boxes = [];
      try {
        boxes = actorBoxes(c.aspecto, estadoFigura);
      } catch {
        boxes = actorBoxes(DEFAULT_AVATAR, estadoFigura);
      }
      const s = kit();
      const luz = glowAt(sx, sy, 1.2) + 0.04;
      for (const bx of boxes) pushBox(s, bx.b, bx.c, { g: luz });
      if (c.raro) adornoExcentrico(s, boxes, c.raro, sx, sy);
      clientesGrupo.add(new Mesh(geometryOf(s), flat));
      const alto = sentado ? sentado.h + 0.95 : 1.95;
      const m = new Mesh(new BoxGeometry(0.7, alto, 0.7), hidden);
      m.position.set(sx, alto / 2, sy);
      m.userData.id = `cliente:${c.n}`;
      clientesGrupo.add(m);
      pickersClientes.push(m);
      if (!sentado) obstaculosClientes.push([sx - 0.3, sy - 0.3, 0, sx + 0.3, sy + 0.3, 1.8]);
      sitiosClientes[c.n] = { x: sx, y: sy, z: alto + 0.15, espera: !c.servido, mira: sentado ? sentado.facing : 2 };
    });
    invalidate();
  }

  // ── La barra (revisión del bloque 3): la vista de la barra, lo elegido, la taza que se llena y la que llevas en la mano ──
  const barraGrupo = new Group();
  scene.add(barraGrupo);
  let barra = { activa: false, receta: {}, lleno: 0, vertiendo: false };
  // De 0 (tus ojos) a 1 (la vista de la barra): un paso corto, directo con movimiento reducido
  let barraT = 0;
  const pickersBarra = Object.entries(BARRA_COSAS).map(([id, cosa]) => {
    const [x0, y0, z0, x1, y1, z1] = cosa.box;
    const m = new Mesh(own(new BoxGeometry(x1 - x0, z1 - z0, y1 - y0)), hidden);
    m.position.set((x0 + x1) / 2, (z0 + z1) / 2, (y0 + y1) / 2);
    m.userData.id = id;
    scene.add(m);
    return m;
  });
  function montarBarra() {
    for (const m of barraGrupo.children.slice()) {
      barraGrupo.remove(m);
      m.geometry.dispose();
    }
    if (estado.inaugurado) {
      const s = kit();
      barraKit(s, barra.activa ? barra.receta : {}, { lleno: barra.activa ? barra.lleno : 0, vertiendo: barra.vertiendo, humo: barra.lleno >= 1 && !reduced() });
      barraGrupo.add(new Mesh(geometryOf(s), flat));
    }
    invalidate();
  }
  let enMano = null;
  const sobreTodo = own(new MeshBasicMaterial({ vertexColors: true }));
  function ponerEnMano(receta) {
    if (enMano) {
      camera.remove(enMano);
      enMano.geometry.dispose();
      enMano = null;
    }
    if (receta) {
      enMano = new Mesh(geometryOf(tazaEnMano(receta)), sobreTodo);
      enMano.position.set(0.15, -0.21, -0.58);
      enMano.rotation.y = -0.4;
      enMano.scale.setScalar(0.85);
      enMano.renderOrder = 10;
      camera.add(enMano);
    }
    invalidate();
  }

  // ── Lo que se toca: una caja invisible por sitio ──
  const pickers = [];
  for (const [id, s] of Object.entries(SITIOS)) {
    const [x0, y0, z0, x1, y1, z1] = s.box;
    const m = new Mesh(own(new BoxGeometry(x1 - x0, z1 - z0, y1 - y0)), hidden);
    m.position.set((x0 + x1) / 2, (z0 + z1) / 2, (y0 + y1) / 2);
    m.userData.id = id;
    scene.add(m);
    pickers.push(m);
  }
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

  function advance(dt) {
    if (!walk) return false;
    const { tx, ty, face } = walk;
    const dx = tx - px;
    const dy = ty - py;
    const d = Math.hypot(dx, dy);
    const want = d > 0.05 ? Math.atan2(dx, dy) : face ? Math.atan2(face[0] - px, face[1] - py) : yaw;
    yaw += wrapA(want - yaw) * Math.min(1, dt * 6);
    if (d > 0.02) {
      const k = Math.min(1, (WALK * dt) / d);
      px += dx * k;
      py += dy * k;
      return true;
    }
    if (face && Math.abs(wrapA(want - yaw)) > 0.01) return true;
    const done = walk.done;
    walk = null;
    onMove({ x: px, y: py, yaw });
    done?.();
    return false;
  }
  function aim(now) {
    const dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0;
    lastT = now;
    let moving = advance(dt);
    const meta = barra.activa ? 1 : 0;
    if (barraT !== meta) {
      barraT = reduced() ? meta : Math.min(1, Math.max(0, barraT + (meta ? 1 : -1) * dt * 2.6));
      moving = moving || barraT !== meta;
    }
    if (modo.decorar) {
      const o = enMundo(CUADRICULA.w / 2, CUADRICULA.d / 2);
      camera.position.set(o.x, 6.4, SD + 2.2);
      camera.lookAt(o.x, 0, o.y - 0.4);
    } else {
      const k = barraT * barraT * (3 - 2 * barraT);
      const mezcla = (a, b) => a + (b - a) * k;
      camera.position.set(mezcla(px, BARRA_CAM.x), mezcla(EYE, BARRA_CAM.z), mezcla(py, BARRA_CAM.y));
      camera.lookAt(mezcla(px + Math.sin(yaw) * 6, BARRA_MIRA.x), mezcla(EYE + Math.tan(PITCH) * 6, BARRA_MIRA.z), mezcla(py + Math.cos(yaw) * 6, BARRA_MIRA.y));
    }
    camera.updateMatrixWorld();
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
    for (const [id, s] of Object.entries(SITIOS)) {
      const p = project(...s.tag);
      out[id] = { ...p, visible: !walk && !modo.decorar && !barra.activa && barraT === 0 && p.front };
    }
    for (const [n, c] of Object.entries(sitiosClientes)) {
      const p = project(c.x, c.y, c.z);
      out[`cliente:${n}`] = { ...p, visible: !walk && !modo.decorar && !barra.activa && barraT === 0 && c.espera && p.front };
    }
    return out;
  }
  let viveHasta = 0;
  let vivoTimer = 0;
  function draw(now = performance.now()) {
    raf = 0;
    if (destroyed || document.visibilityState === 'hidden') return;
    const moving = aim(now);
    const quieto = reduced();
    if (!quieto || now - viveHasta > 1000) {
      pintaVivo((now - t0) / 1000);
      viveHasta = now;
    }
    composer.render();
    renders += 1;
    onFrame(tags());
    if (moving) invalidate();
    else {
      lastT = 0;
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
    const h = Math.max(1, Math.round((ART_W * rect.height) / rect.width));
    renderer.setSize(ART_W, h, false);
    composer.setSize(ART_W, h);
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
    return ray.intersectObjects(barra.activa ? pickersBarra : [...pickers, ...pickersClientes], false)[0]?.object.userData.id ?? null;
  }
  /** La pieza del plano bajo un punto de la pantalla (su uid), o null. */
  function piezaEn(clientX, clientY) {
    rayAt(clientX, clientY);
    return ray.intersectObjects(piezas, false)[0]?.object.userData.uid ?? null;
  }
  /** La casilla del suelo bajo un punto de la pantalla, o null si cae fuera de la cuadrícula. */
  function casillaEn(clientX, clientY) {
    rayAt(clientX, clientY);
    if (!ray.ray.intersectPlane(floorPlane, hit)) return null;
    const c = enCasilla(hit.x, hit.z);
    return c.x >= 0 && c.y >= 0 && c.x < CUADRICULA.w && c.y < CUADRICULA.d ? c : null;
  }

  /** Ir andando en línea recta hasta (x, y), parando antes de chocar; `face`, adónde mirar al llegar. */
  function walkTo(x, y, { face = null } = {}) {
    return new Promise((done) => {
      const to = hastaDonde(px, py, x, y, opcionesPaso());
      if (reduced()) {
        px = to.x;
        py = to.y;
        if (face) yaw = Math.atan2(face[0] - px, face[1] - py);
        walk = null;
        invalidate();
        onMove({ x: px, y: py, yaw });
        done();
        return;
      }
      walk = { tx: to.x, ty: to.y, face, done };
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
      press = { x: e.clientX, y: e.clientY, yaw, id: e.pointerId, moved: false, arrastra: null };
      // En Decorar, apretar sobre la pieza elegida la arrastra
      if (modo.decorar && modo.sel && piezaEn(e.clientX, e.clientY) === modo.sel) press.arrastra = modo.sel;
      canvas.setPointerCapture?.(e.pointerId);
    },
    on,
  );
  canvas.addEventListener(
    'pointermove',
    (e) => {
      if (!press || e.pointerId !== press.id) return;
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > TAP_SLOP) press.moved = true;
      if (modo.decorar) {
        if (press.moved && press.arrastra) {
          const c = casillaEn(e.clientX, e.clientY);
          if (c) onDecor({ tipo: 'arrastre', uid: press.arrastra, x: c.x, y: c.y });
        }
        return;
      }
      if (!press.moved || walk || barra.activa) return;
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
    if (moved && !modo.decorar) onMove({ x: px, y: py, yaw });
    if (!tap) return;
    if (modo.decorar) {
      const uid = piezaEn(e.clientX, e.clientY);
      if (uid) onDecor({ tipo: 'elegir', uid });
      else {
        const c = casillaEn(e.clientX, e.clientY);
        if (c) onDecor({ tipo: 'casilla', x: c.x, y: c.y });
      }
      return;
    }
    const id = pickAt(e.clientX, e.clientY);
    if (id) {
      onPick(id);
      return;
    }
    if (barra.activa) return;
    rayAt(e.clientX, e.clientY);
    if (ray.ray.intersectPlane(floorPlane, hit) && dentro(hit.x, hit.z, opcionesPaso())) walkTo(hit.x, hit.z);
  };
  canvas.addEventListener('pointerup', release, on);
  canvas.addEventListener('pointercancel', release, on);
  canvas.addEventListener(
    'keydown',
    (e) => {
      if (modo.decorar || barra.activa) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        yaw += e.key === 'ArrowLeft' ? KEY_STEP : -KEY_STEP;
        invalidate();
        onMove({ x: px, y: py, yaw });
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const k = e.key === 'ArrowUp' ? 1.0 : -1.0;
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
    settled: () => !walk,
    /** Ir a un sitio ('pilar', 'cortina', 'escaparate' o 'entrada'). Promesa que acaba al llegar. */
    go(id) {
      if (id === 'entrada') return walkTo(INICIO.x, INICIO.y, { face: [INICIO.x + Math.sin(INICIO.yaw), INICIO.y + Math.cos(INICIO.yaw)] });
      const s = SITIOS[id];
      if (!s) return Promise.resolve();
      return walkTo(s.ir.x, s.ir.y, { face: s.mira });
    },
    /** Ponerse en un sitio de golpe (para las pruebas y las capturas). */
    place(x, y, yawTo = yaw) {
      walk = null;
      px = x;
      py = y;
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
    /** El punto del suelo bajo un punto de la pantalla (para las pruebas), o null. */
    sueloEn(clientX, clientY) {
      aim(performance.now());
      rayAt(clientX, clientY);
      return ray.ray.intersectPlane(floorPlane, hit) ? { x: hit.x, y: hit.z, pick: pickAt(clientX, clientY) } : null;
    },
    invalidate,
    /** El estado del local: si está inaugurado, su nombre, el plano y tus libros (títulos) para las estanterías. */
    setLocal({ inaugurado = false, nombre = null, plano = { v: 1, items: [] }, libros = [] } = {}) {
      const nombreAntes = estado.nombre;
      const abre = inaugurado && !estado.inaugurado;
      estado = { inaugurado, nombre, plano, libros };
      // Al abrir el café (o entrar ya abierto), la vista de todo el rincón
      if (abre) {
        walk = null;
        px = INICIO_ABIERTO.x;
        py = INICIO_ABIERTO.y;
        yaw = INICIO_ABIERTO.yaw;
      }
      if (nombre !== nombreAntes || (inaugurado && !rotulo)) ponerRotulo(inaugurado ? nombre : null);
      // Si lo colocado te deja dentro de un mueble, un paso al pasillo
      if (!dentro(px, py, opcionesPaso()) && !walk) {
        px = INICIO.x;
        py = INICIO.y;
      }
      montarPlano();
    },
    /** Decorar: la vista desde arriba con la rejilla; `sel`, la pieza elegida; `mal`, si no cabe donde está. */
    decorar(on, { sel = null, mal = false } = {}) {
      walk = null;
      modo = { decorar: Boolean(on), sel, mal };
      montarPlano();
    },
    /** Dónde cae en la pantalla el centro de una casilla (para las pruebas). */
    casillaEnPantalla(cx, cy) {
      aim(performance.now());
      const o = enMundo(cx + 0.5, cy + 0.5);
      const p = project(o.x, o.y, 0);
      const rect = canvas.getBoundingClientRect();
      return { x: rect.left + p.x, y: rect.top + p.y };
    },
    /** Dónde cae en la pantalla una pieza del plano (para las pruebas), por su uid. */
    piezaEnPantalla(uid) {
      aim(performance.now());
      const it = estado.plano.items.find((i) => i.uid === uid);
      if (!it) return null;
      const f = footprint(medidas(it.id), it.rot);
      const o = enMundo(it.x + f.w / 2, it.y + f.d / 2);
      const p = project(o.x, o.y, 0.6);
      const rect = canvas.getBoundingClientRect();
      return { x: rect.left + p.x, y: rect.top + p.y };
    },
    piezas: () => estado.plano.items.length,
    /** Los clientes del día: [{ n, aspecto, servido, libro (título del que les diste) }]. */
    setClientes(lista = []) {
      clientes = lista;
      montarClientes();
    },
    /** Dónde cae en la pantalla un cliente (para las pruebas), o null. */
    clienteEnPantalla(n) {
      aim(performance.now());
      const c = sitiosClientes[n];
      if (!c) return null;
      const p = project(c.x, c.y, c.z - 0.6);
      const rect = canvas.getBoundingClientRect();
      return { x: rect.left + p.x, y: rect.top + p.y, front: p.front };
    },
    clientes: () => Object.keys(sitiosClientes).length,
    /**
     * La barra: entrar en su vista (receta vacía) o salir. Al salir quedas de pie ante el mostrador, mirando al local, y con
     * `llevar` (una receta), con la taza en la mano.
     */
    barra(on, { llevar = null } = {}) {
      walk = null;
      if (!on && barra.activa) {
        px = ANTE_PILAR.x;
        py = ANTE_PILAR.y;
        yaw = -Math.PI / 2;
        onMove({ x: px, y: py, yaw });
      }
      barra = { activa: Boolean(on), receta: {}, lleno: 0, vertiendo: false };
      ponerEnMano(on ? null : llevar);
      montarBarra();
    },
    /** Lo elegido en la barra ({ bebida, grano, leche, toque }), lo que lleva la taza (0 a 1) y si se está vertiendo. */
    setReceta(receta, { lleno = 0, vertiendo = false } = {}) {
      barra = { ...barra, receta, lleno, vertiendo };
      montarBarra();
    },
    /** La taza en la mano (una receta) o nada. */
    llevar(receta) {
      ponerEnMano(receta);
    },
    /** Ir con la taza hasta un cliente (hasta donde se pueda andar) y mirarle. Promesa que acaba al llegar. */
    irACliente(n) {
      const c = sitiosClientes[n];
      if (!c) return Promise.resolve();
      // A un paso del cliente y, si se puede, delante de él (nunca a su espalda ni encima de su silla): se prueban
      // puntos a su alrededor, primero los de su frente, y se va al primero al que se llega andando en línea recta
      const FRENTE = [
        [0, 1],
        [-1, 0],
        [0, -1],
        [1, 0],
      ];
      const [fx, fy] = FRENTE[c.mira ?? 2];
      const lados = [
        [fx, fy],
        [fx - fy, fy + fx],
        [fx + fy, fy - fx],
        [-fy, fx],
        [fy, -fx],
      ];
      const op = opcionesPaso();
      for (const dist of [1.7, 1.4, 2.1, 1.1]) {
        for (const [ax, ay] of lados) {
          const n = Math.hypot(ax, ay);
          const tx = c.x + (ax / n) * dist;
          const ty = c.y + (ay / n) * dist;
          const llega = hastaDonde(px, py, tx, ty, op);
          if (Math.hypot(llega.x - tx, llega.y - ty) < 0.12) return walkTo(tx, ty, { face: [c.x, c.y] });
        }
      }
      const d = Math.hypot(c.x - px, c.y - py);
      const k = d > 1 ? (d - 1) / d : 0;
      return walkTo(px + (c.x - px) * k, py + (c.y - py) * k, { face: [c.x, c.y] });
    },
    /** Dónde cae en la pantalla una cosa de la barra (para las pruebas). */
    barraEnPantalla(id) {
      aim(performance.now());
      const b = BARRA_COSAS[id]?.box;
      if (!b) return null;
      const p = project((b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2);
      const rect = canvas.getBoundingClientRect();
      return { x: rect.left + p.x, y: rect.top + p.y, front: p.front };
    },
    enBarra: () => barra.activa && barraT === 1,
    destroy() {
      ponerEnMano(null);
      destroyed = true;
      vaciarGrupo();
      clientes = [];
      montarClientes();
      if (rotulo) ponerRotulo(null);
      cancelAnimationFrame(raf);
      clearTimeout(vivoTimer);
      stop.abort();
      observer.disconnect();
      for (const x of owned) x.dispose?.();
      composer.dispose?.();
      renderer.dispose();
      canvas.remove();
    },
  };
}
