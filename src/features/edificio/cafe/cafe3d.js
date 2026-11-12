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
  CAJA_LIBROS,
  SW,
  dentro,
  enCasilla,
  enMundo,
  hastaDonde,
  ALTAS,
  CHIMENEA,
  VENTANAL,
  ALA,
  paredIzquierda,
} from './cafeLayout';
import { ASIENTOS, CUADRICULA, casillaValida, columnasDe, filasDe, medidas } from './cafeCatalogo';
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
/**
 * Bloque 4b (1.123): la luz del ala lateral (tres campanas de latón) y la de los farolillos de la terraza. Solo cuentan desde
 * su nivel (`LUCES_NIVEL`, que pone setLocal): así lo de los niveles 1 a 3 se ve igual que antes.
 */
const LUZ_ALA = { at: [-1.7, 6.0, 3.6], k: 0.8, reach: 5.2 };
const LUZ_TERRAZA = { at: [3.6, SD + 2.3, 2.3], k: 0.75, reach: 4.0 };
let LUCES_NIVEL = [];
/** Pinta con estas luces de nivel encendidas (las láminas del ala y de la calle se pintan al montar). */
function conLuces(luces, fn) {
  const antes = LUCES_NIVEL;
  LUCES_NIVEL = luces;
  try {
    return fn();
  } finally {
    LUCES_NIVEL = antes;
  }
}
function glowAt(x, y, z) {
  let g = 0.06;
  for (const { at, k, reach } of LUCES_NIVEL.length ? [...LUCES, ...LUCES_NIVEL] : LUCES) {
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

// La pared de delante: el escaparate con su marco verde y la puerta acristalada. Con `abierto` (nivel 5, la terraza), el
// cristal se ve a través (transparente: detrás está la acera de verdad) y la puerta queda abierta.
const delanteExtra = delanteDe(false);
function delanteDe(abierto) {
  return (a, b, ix, iy) => delanteDePx(a, b, ix, iy, abierto);
}
function delanteDePx(a, b, ix, iy, abierto) {
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
    return abierto ? 0 : calle(x, b);
  }
  if (x > PUERTA.x0 - 0.14 && x < PUERTA.x1 + 0.14 && b < PUERTA.alto + 0.14) {
    if (x < PUERTA.x0 || x > PUERTA.x1 || b > PUERTA.alto) return lit(wood[1], g, ix, iy);
    if (abierto) return 0;
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
function paintCeiling(x0 = 0, ancho = SW) {
  const r = probe();
  const wood = r.rampOf(WOOD_D);
  const plaster = r.rampOf(PLASTER);
  return canvasOf(Math.round(ancho * PX), SD * PX, (ix, iy) => {
    const x = x0 + (ix + 0.5) / PX;
    const y = SD - (iy + 0.5) / PX;
    const g = glowAt(x, y, SH) * 0.7;
    const v = frac(y / 1.8);
    if (v < 0.12) return lit(wood[v < 0.03 || v > 0.1 ? 1 : 3], g, ix, iy);
    return lit(plaster[noise(x * 3, y * 3) > 0.8 ? 2 : 3], g, ix, iy);
  });
}

// ── Bloque 4b (1.123): lo que se abre en los niveles 4 y 5 ──
/** El suelo del ala lateral: el mismo damero, con polvo junto a las paredes nuevas. */
function paintSueloAla() {
  const r = probe();
  const red = r.rampOf(TILE_R);
  const cream = r.rampOf(TILE_C);
  const ancho = ALA.x1 - ALA.x0;
  return canvasOf(Math.round(ancho * PX), SD * PX, (ix, iy) => {
    const x = ALA.x0 + (ix + 0.5) / PX;
    const y = (iy + 0.5) / PX;
    const g = glowAt(x, y, 0);
    const T = 0.62;
    const tx = Math.floor(x / T);
    const ty = Math.floor(y / T);
    const ramp = (((tx + ty) % 2) + 2) % 2 ? red : cream;
    if (frac(x / T) < 0.05 || frac(y / T) < 0.05) return lit(ramp[1], g, ix, iy);
    const borde = Math.min(x - ALA.x0, y, SD - y);
    const polvo = noise(x * 3, y * 3) * 0.6 + (borde < 0.7 ? (0.7 - borde) * 0.6 : 0);
    return lit(ramp[clamp(3 - (noise(tx * 2.1, ty * 1.7) > 0.72 ? 1 : 0) + (polvo > 0.78 ? 1 : 0), 1, 4)], g, ix, iy);
  });
}
/** La ventanita del ala en la pared de delante: marco verde y la calle de noche detrás. */
function ventanaAla(a, b, ix, iy) {
  const x = ALA.x1 - a;
  if (x < -2.5 || x > -0.9 || b < 1.3 || b > 3.1) return null;
  const r = probe();
  const green = r.rampOf(GREEN);
  const g = glowAt(x, SD - 0.3, b);
  if (x < -2.4 || x > -1.0 || b < 1.4 || b > 3.0 || Math.abs(x + 1.7) < 0.035) return lit(green[x < -2.45 || x > -0.95 ? 1 : 2], g, ix, iy);
  return calle(x + 6.3, b);
}
const MOSTAZA = [206, 158, 78];
const PIEDRA = [150, 140, 126];
/** El café visto desde la acera (nivel 5): zócalo de piedra, estuco mostaza, cornisa, el escaparate (con el cristal a través) y la puerta abierta. Va de x = −6 a 16. */
const FUERA = { x0: -6, x1: 16, alto: SH + 1.4 };
function paintFachadaFuera() {
  const r = probe();
  const stucco = r.rampOf(MOSTAZA);
  const stone = r.rampOf(PIEDRA);
  const green = r.rampOf(GREEN);
  const wood = r.rampOf(WOOD);
  const W = FUERA.x1 - FUERA.x0;
  return canvasOf(W * PX, Math.round(FUERA.alto * PX), (ix, iy) => {
    const x = FUERA.x0 + (ix + 0.5) / PX;
    const b = FUERA.alto - (iy + 0.5) / PX;
    const g = glowAt(x, SD + 0.25, b);
    const { x0, x1, z0, z1 } = ESCAPARATE;
    if (x > x0 - 0.16 && x < x1 + 0.16 && b > z0 - 0.16 && b < z1 + 0.14) {
      if (x < x0 || x > x1 || b < z0 || b > z1) return lit(green[x < x0 - 0.1 || x > x1 + 0.1 || b < z0 - 0.1 ? 1 : 2], g, ix, iy);
      if (Math.abs(x - (x0 + (x1 - x0) / 3)) < 0.04 || Math.abs(x - (x0 + (2 * (x1 - x0)) / 3)) < 0.04 || Math.abs(b - (z1 - 0.55)) < 0.04) return lit(green[2], g, ix, iy);
      return 0;
    }
    if (x > PUERTA.x0 - 0.14 && x < PUERTA.x1 + 0.14 && b < PUERTA.alto + 0.14) {
      if (x < PUERTA.x0 || x > PUERTA.x1 || b > PUERTA.alto) return lit(wood[1], g, ix, iy);
      return 0;
    }
    // La ventanita del ala, encendida por dentro
    if (x > -2.5 && x < -0.9 && b > 1.3 && b < 3.1) {
      if (x < -2.4 || x > -1.0 || b < 1.4 || b > 3.0 || Math.abs(x + 1.7) < 0.035) return lit(green[2], g, ix, iy);
      return b > 2.6 ? rgb(214, 170, 104) : rgb(236, 196, 124);
    }
    // Las esquinas del bajo, de piedra; el zócalo; la cornisa
    if (b < 0.45 || x < ALA.x0 + 0.25 || x > SW - 0.25) return lit(stone[noise(x * 5, b * 5) > 0.7 ? 2 : 3], g, ix, iy);
    if (b > SH - 0.34 && b < SH - 0.08) return lit(stone[b > SH - 0.14 ? 2 : 3], g, ix, iy);
    if (x < ALA.x0 || x > SW) return lit(stone[1], g * 0.6, ix, iy);
    const n = noise(x * 2.2, b * 2.2);
    return lit(stucco[n > 0.8 ? 2 : n < 0.25 ? 4 : 3], g, ix, iy);
  });
}
/** La acera mojada delante del café: adoquines con el reflejo de los farolillos. Va de x = −6 a 16 y de SD a SD + 5. */
function paintAcera() {
  const r = probe();
  const adoquin = r.rampOf([70, 76, 98]);
  const W = FUERA.x1 - FUERA.x0;
  return canvasOf(W * PX, 5 * PX, (ix, iy) => {
    const x = FUERA.x0 + (ix + 0.5) / PX;
    const y = SD + (iy + 0.5) / PX;
    const g = glowAt(x, y, 0);
    if (y > SD + 4.4) return lit(r.rampOf(PIEDRA)[y > SD + 4.55 ? 2 : 3], g, ix, iy);
    const cy = Math.floor(y / 0.3);
    const junta = frac(x / 0.36 + (cy % 2) * 0.5) < 0.08 || frac(y / 0.3) < 0.1;
    if (junta) return lit(adoquin[1], g * 0.8, ix, iy);
    const brillo = g > 0.45 && noise(x * 7, y * 9) > 0.62;
    return brillo ? rgb(214, 170, 104) : lit(adoquin[noise(x * 4, y * 5) > 0.7 ? 3 : 2], g, ix, iy);
  });
}
/** Al otro lado de la acera, el muelle de noche: el agua con reflejos, la otra orilla con sus luces, el faro y estrellas. */
function paintMuelle() {
  const w = 26 * 8;
  const h = 7 * 8;
  return canvasOf(w, h, (ix, iy) => {
    const x = -8 + (ix + 0.5) / 8;
    const z = 7 - (iy + 0.5) / 8;
    if (z < 0.2) return rgb(96, 92, 90);
    if (z < 1.5) {
      const ola = noise(x * 6, z * 22);
      if (Math.abs(x - 3.6) < 0.8 && ola > 0.5) return rgb(200, 150, 90);
      return ola > 0.8 ? rgb(46, 66, 104) : rgb(18, 28, 54);
    }
    if (z < 1.75) {
      if (Math.abs(x - 11) < 0.1) return rgb(214, 210, 200);
      return noise(x * 13, 3) > 0.72 ? rgb(236, 196, 120) : rgb(16, 20, 32);
    }
    if (Math.abs(x - 11) < 0.08 && z < 2.3) return Math.floor(z * 10) % 2 ? rgb(214, 210, 200) : rgb(160, 50, 50);
    if (Math.abs(x - 11) < 0.14 && z > 2.3 && z < 2.45) return rgb(255, 236, 170);
    if (hash(Math.floor(x * 8), Math.floor(z * 8)) > 0.985) return rgb(214, 214, 236);
    const k = clamp((z - 1.75) / 4, 0, 1);
    return rgb(20 + k * 6, 26 + k * 4, 56 + k * 10);
  });
}
/** Los pilares que quedan de la pared de la izquierda, la viga que la sustituye y las tres campanas de latón del ala. */
function alaKit(s) {
  const ladrillo = [150, 82, 62];
  for (const [y0, y1] of [
    [0, ALA.pilar],
    [SD - ALA.pilar, SD],
  ]) {
    pushBox(s, [-0.2, y0, 0, 0.2, y1, SH], ladrillo);
    for (let z = 0.25; z < SH - 0.5; z += 0.25) pushBox(s, [-0.205, y0, z, 0.205, y1, z + 0.02], [120, 64, 48]);
  }
  pushBox(s, [-0.24, 0, SH - 0.5, 0.24, SD, SH], [104, 70, 44]);
  pushBox(s, [-0.25, 0, SH - 0.52, 0.25, SD, SH - 0.47], [82, 54, 34]);
  for (const y of [3.0, 6.0, 9.0]) {
    const x = -1.7;
    pushBox(s, [x - 0.012, y - 0.012, 3.5, x + 0.012, y + 0.012, SH], [40, 34, 32], { g: 0.4 });
    pushBox(s, [x - 0.17, y - 0.17, 3.3, x + 0.17, y + 0.17, 3.5], BRASS, { g: 0.85 });
    pushBox(s, [x - 0.11, y - 0.11, 3.22, x + 0.11, y + 0.11, 3.3], BULB, { glow: true });
  }
}
/** El toldo de la terraza (rayas granate y crema), sus brazos de hierro y la guirnalda de farolillos de su borde. */
function toldoKit(s) {
  const [xa, xb] = [0.35, 6.85];
  const fondo = 3.0;
  const za = 3.5;
  const zb = 2.75;
  const tramos = 8;
  for (let k = 0; k < tramos; k += 1) {
    const y0 = SD + (fondo * k) / tramos;
    const y1 = SD + (fondo * (k + 1)) / tramos;
    const z = za + ((zb - za) * (k + 0.5)) / tramos;
    for (let x = xa, i = 0; x < xb; x += 0.4, i += 1) pushBox(s, [x, y0 - 0.01, z - 0.06, Math.min(xb, x + 0.4), y1 + 0.01, z + 0.06], i % 2 ? [236, 226, 204] : [150, 52, 50], { g: 0.7 });
  }
  // El faldón con sus ondas
  for (let x = xa, i = 0; x < xb; x += 0.4, i += 1) {
    pushBox(s, [x, SD + fondo - 0.02, zb - 0.22, Math.min(xb, x + 0.4), SD + fondo + 0.02, zb], i % 2 ? [236, 226, 204] : [150, 52, 50], { g: 0.72 });
    pushBox(s, [x + 0.1, SD + fondo - 0.02, zb - 0.3, x + 0.3, SD + fondo + 0.02, zb - 0.22], i % 2 ? [236, 226, 204] : [150, 52, 50], { g: 0.72 });
  }
  for (const x of [xa + 0.2, xb - 0.2]) {
    const xf = giro([x, SD, za - 0.4], 'x', -0.95);
    pushBox(s, [x - 0.025, SD, za - 0.42, x + 0.025, SD + 0.05, za - 0.4 + 2.6], [52, 50, 56], { g: 0.6, xf });
  }
  // La guirnalda: un cable que cuelga un poco y una bombilla cálida cada medio metro
  for (let x = xa + 0.25; x < xb - 0.1; x += 0.5) {
    const u = (x - xa) / (xb - xa);
    const z = zb - 0.34 - Math.sin(u * Math.PI) * 0.18;
    pushBox(s, [x - 0.25, SD + fondo - 0.04, z + 0.03, x + 0.25, SD + fondo - 0.02, z + 0.04], [40, 34, 32], { g: 0.4 });
    pushBox(s, [x - 0.035, SD + fondo - 0.07, z - 0.08, x + 0.035, SD + fondo + 0.0, z], Math.round(x * 2) % 3 ? [255, 214, 140] : [255, 176, 120], { glow: true });
  }
}
/** La puerta del café, abierta hacia dentro (nivel 5: se sale a la terraza). */
function puertaAbiertaKit(s) {
  const x = PUERTA.x1 - 0.04;
  const y1 = SD - 0.05;
  const y0 = y1 - (PUERTA.x1 - PUERTA.x0);
  pushBox(s, [x - 0.05, y0, 0, x, y1, PUERTA.alto], WOOD, { g: 0.6 });
  pushBox(s, [x - 0.055, y0 + 0.14, 1.0, x - 0.045, y1 - 0.14, PUERTA.alto - 0.14], [70, 86, 120], { g: 0.7 });
  pushBox(s, [x - 0.09, y0 + 0.1, 1.0, x - 0.05, y0 + 0.16, 1.08], BRASS, { g: 0.7 });
}
/** El escaparate (nivel 5): una peana de madera con tus tres libros de cara a la calle y una lamparita que los alumbra. */
function escaparateKit(s, libros = []) {
  const y0 = SD - 0.5;
  const y1 = SD - 0.16;
  pushBox(s, [1.1, y0, 0, 5.7, y1, 0.5], WOOD_D);
  pushBox(s, [1.08, y0 - 0.02, 0.5, 5.72, y1 + 0.02, 0.54], WOOD_L);
  const xs = [2.0, 3.4, 4.8];
  // El del centro, un poco más alto, sobre su peana
  pushBox(s, [2.95, y0 + 0.02, 0.54, 3.85, y1 - 0.02, 0.74], WOOD_D);
  pushBox(s, [2.93, y0, 0.74, 3.87, y1, 0.77], WOOD_L);
  libros.slice(0, 3).forEach((titulo, k) => {
    const x = xs[k];
    const z = k === 1 ? 0.77 : 0.54;
    const c = colorDe(titulo);
    const claro = c.map((v) => Math.min(255, v + 80));
    // El libro de pie, de cara a la calle, apoyado en su atril; la cubierta con su recuadro y el título en bandas claras
    pushBox(s, [x - 0.04, y1 - 0.24, z, x + 0.04, y1 - 0.16, z + 0.5], WOOD_D);
    pushBox(s, [x - 0.3, y1 - 0.12, z + 0.02, x + 0.3, y1 - 0.02, z + 0.86], c);
    pushBox(s, [x - 0.3, y1 - 0.13, z + 0.02, x - 0.26, y1 - 0.02, z + 0.86], c.map((v) => Math.max(0, v - 40)));
    pushBox(s, [x - 0.24, y1 - 0.021, z + 0.08, x + 0.24, y1 - 0.016, z + 0.8], claro);
    pushBox(s, [x - 0.2, y1 - 0.016, z + 0.12, x + 0.2, y1 - 0.011, z + 0.76], c);
    pushBox(s, [x - 0.15, y1 - 0.011, z + 0.56, x + 0.15, y1 - 0.006, z + 0.64], claro);
    pushBox(s, [x - 0.11, y1 - 0.011, z + 0.46, x + 0.11, y1 - 0.006, z + 0.5], claro);
    pushBox(s, [x - 0.08, y1 - 0.011, z + 0.2, x + 0.08, y1 - 0.006, z + 0.34], claro);
  });
  // La lamparita de pinza que alumbra los libros
  pushBox(s, [5.5, y0 + 0.05, 0.54, 5.56, y0 + 0.11, 1.4], [52, 50, 56]);
  pushBox(s, [5.36, y0 + 0.02, 1.36, 5.6, y0 + 0.26, 1.5], BRASS);
  pushBox(s, [5.4, y0 + 0.06, 1.33, 5.56, y0 + 0.22, 1.36], BULB, { glow: true });
}

// ── Cajas: mundo de la app (x, y a lo hondo, z arriba) → Three (x, z, y) ──
const FACE_TONE = { top: 1.06, bottom: 0.6, front: 0.92, back: 0.74, right: 0.84, left: 0.8 };
function pushBox(out, [x0, y0, z0, x1, y1, z1], color, { glow = false, g = null, xf = null } = {}) {
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
      out.pos.push(...(xf ? xf(p) : p));
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
/** La caja de reparto de la distribuidora (§121.3): cartón con la cinta, las solapas a medio abrir y un lomo asomando. */
function cajaDeReparto(s) {
  const { x0, y0, x1, y1, alto } = CAJA_LIBROS;
  const carton = [178, 134, 86];
  const lado = [150, 108, 66];
  const cinta = [214, 190, 140];
  pushBox(s, [x0, y0, 0, x1, y1, alto], carton);
  pushBox(s, [x0 - 0.005, y0 + 0.03, 0.02, x0, y1 - 0.03, alto - 0.04], lado);
  pushBox(s, [x0 + 0.04, y0 - 0.005, 0.04, x1 - 0.04, y0, alto - 0.04], lado);
  // La cinta, por encima y bajando por los lados
  const cx = (x0 + x1) / 2;
  pushBox(s, [cx - 0.05, y0 - 0.008, alto - 0.18, cx + 0.05, y1 + 0.008, alto + 0.005], cinta);
  // Las solapas, levantadas hacia fuera
  pushBox(s, [x0 - 0.12, y0 + 0.02, alto - 0.02, x0 + 0.02, y1 - 0.02, alto + 0.03], [196, 150, 98]);
  pushBox(s, [x1 - 0.02, y0 + 0.02, alto - 0.02, x1 + 0.12, y1 - 0.02, alto + 0.03], [196, 150, 98]);
  // Lomos asomando
  const colores = [
    [176, 72, 62],
    [74, 116, 82],
    [210, 160, 70],
  ];
  colores.forEach((c, k) => pushBox(s, [x0 + 0.12 + k * 0.13, y0 + 0.14, alto - 0.05, x0 + 0.21 + k * 0.13, y1 - 0.14, alto + 0.09 + (k % 2) * 0.04], c));
}
/** Los lomos de tus libros en la estantería vieja de la pared (de cara al local, +x). */
function lomosPared(s, libros, dx = 0) {
  const { y0, y1, fondo, alto } = ESTANTERIA;
  let k = 0;
  for (let z = 0.08; z + 0.4 < alto && k < libros.length; z += 0.58) {
    let y = y0 + 0.1;
    while (y < y1 - 0.16 && k < libros.length) {
      const ancho = 0.06 + ((k * 7) % 4) * 0.012;
      const altoL = 0.26 + ((k * 5) % 5) * 0.024;
      pushBox(s, [dx + 0.06, y, z + 0.05, dx + fondo - 0.04, y + ancho, z + 0.05 + altoL], colorDe(libros[k]));
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
function paintRejilla(filas = CUADRICULA.d, cols = CUADRICULA.w) {
  const n = 16;
  const c = document.createElement('canvas');
  c.width = cols * n;
  c.height = filas * n;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(231,183,101,0.10)';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = 'rgba(244,206,140,0.75)';
  for (let k = 0; k <= cols; k += 1) ctx.fillRect(Math.min(c.width - 1, k * n), 0, 1, c.height);
  for (let k = 0; k <= filas; k += 1) ctx.fillRect(0, Math.min(c.height - 1, k * n), c.width, 1);
  return c;
}

// ── Bloque 4a (1.122): lo que se abre al crecer el café ──
/** El puerto por el ventanal: cielo de tarde, el mar con su brillo, el espigón con el faro y dos velas. */
function paintPuerto() {
  const w = 120;
  const h = 70;
  return canvasOf(w, h, (ix, iy) => {
    const hor = 38;
    if (iy < hor) {
      // El cielo: de azul claro arriba a melocotón junto al mar, con dos nubes
      const k = iy / hor;
      let c = [Math.round(150 + 96 * k), Math.round(186 + 20 * k), Math.round(214 - 60 * k)];
      const nube = (iy > 8 && iy < 12 && ix > 14 && ix < 38) || (iy > 16 && iy < 19 && ix > 70 && ix < 98) || (iy === 11 && ix > 18 && ix < 32);
      if (nube) c = [250, 236, 222];
      // El sol, bajo, a la derecha
      if (Math.hypot(ix - 92, iy - 30) < 5) c = [255, 226, 160];
      // El faro, en el espigón de la izquierda
      if (ix >= 22 && ix <= 25 && iy >= 22) c = iy < 25 ? [196, 70, 60] : iy < 28 ? [244, 238, 226] : iy < 31 ? [196, 70, 60] : [244, 238, 226];
      if (ix >= 21 && ix <= 26 && iy === 21) c = [70, 64, 60];
      if (ix >= 22 && ix <= 25 && iy === 20) c = [255, 220, 130];
      // Las velas
      for (const [vx, vy, vh] of [
        [58, 30, 7],
        [80, 33, 5],
      ]) {
        const d = iy - vy;
        if (d >= 0 && d < vh && ix >= vx && ix <= vx + Math.round((d * 4) / vh)) c = [250, 246, 236];
        if (ix === vx && d >= 0 && d < vh + 1) c = [90, 70, 56];
      }
      return rgb(...c);
    }
    // El espigón de piedra, que entra en el mar
    if (iy < hor + 4 && ix < 34 - (iy - hor) * 2) return rgb(118, 112, 104);
    // Los cascos de los barcos
    if (iy === hor && ((ix >= 56 && ix <= 63) || (ix >= 78 && ix <= 84))) return rgb(120, 60, 48);
    // El mar, con el brillo del sol en ondas
    const k = (iy - hor) / (h - hor);
    const onda = noise(ix * 0.35, iy * 1.4) > 0.62;
    const brillo = Math.abs(ix - 92) < 6 - k * 3 && hash(ix, iy) > 0.45;
    const c = brillo ? [255, 222, 168] : onda ? [120, 170, 196] : [Math.round(70 - 20 * k), Math.round(124 - 30 * k), Math.round(164 - 30 * k)];
    return rgb(...c);
  });
}
/** El ventanal del fondo: marco de madera con sus parteluces, el alféizar y unas macetas. */
function ventanal(s) {
  const { x0, x1, z0, z1 } = VENTANAL;
  const m = [96, 64, 42];
  const y = 0.04;
  pushBox(s, [x0 - 0.12, 0, z0 - 0.12, x1 + 0.12, y + 0.08, z0], m);
  pushBox(s, [x0 - 0.12, 0, z1, x1 + 0.12, y + 0.08, z1 + 0.14], m);
  pushBox(s, [x0 - 0.12, 0, z0, x0, y + 0.08, z1], m);
  pushBox(s, [x1, 0, z0, x1 + 0.12, y + 0.08, z1], m);
  for (let x = x0 + 1.25; x < x1 - 0.2; x += 1.25) pushBox(s, [x - 0.04, 0, z0, x + 0.04, y + 0.06, z1], m);
  pushBox(s, [x0, 0, z1 - 0.72, x1, y + 0.06, z1 - 0.66], m);
  // El alféizar, ancho, con macetas de geranios
  pushBox(s, [x0 - 0.2, 0, z0 - 0.2, x1 + 0.2, 0.32, z0 - 0.12], WOOD_L);
  for (const x of [x0 + 0.5, x0 + 2.4, x1 - 0.7]) {
    pushBox(s, [x - 0.12, 0.08, z0 - 0.12, x + 0.12, 0.28, z0 + 0.08], [176, 92, 64]);
    pushBox(s, [x - 0.14, 0.06, z0 + 0.08, x + 0.14, 0.3, z0 + 0.22], [86, 128, 70]);
    pushBox(s, [x - 0.06, 0.1, z0 + 0.2, x + 0.04, 0.2, z0 + 0.27], [214, 74, 80], { glow: true });
  }
}
/** Donde estaba la cortina: una viga de roble de pared a pared, como un arco abierto. */
function viga(s) {
  const y = CORTINA.y;
  pushBox(s, [0, y - 0.14, SH - 0.42, SW, y + 0.14, SH], [104, 70, 44]);
  pushBox(s, [0, y - 0.15, SH - 0.44, SW, y + 0.15, SH - 0.4], [82, 54, 34]);
}
/** Nivel 3: estanterías de pared hasta el techo, llenas de lomos, con su escalera de biblioteca. */
function estanteriasAltas(s) {
  const { y0, y1, fondo } = ALTAS;
  const alto = SH - 0.12;
  pushBox(s, [0, y0, 0, fondo, y0 + 0.07, alto], WOOD_D);
  pushBox(s, [0, y1 - 0.07, 0, fondo, y1, alto], WOOD_D);
  pushBox(s, [0, y0, alto - 0.12, fondo + 0.06, y1, alto + 0.08], WOOD_D);
  const paleta = [
    [150, 60, 52],
    [60, 90, 120],
    [200, 170, 96],
    [78, 110, 80],
    [120, 80, 110],
    [210, 196, 170],
    [176, 104, 60],
  ];
  for (let z = 0.06, fila = 0; z < alto - 0.5; z += 0.52, fila += 1) {
    pushBox(s, [0, y0, z, fondo, y1, z + 0.05], WOOD);
    for (let y = y0 + 0.08, k = 0; y < y1 - 0.12; k += 1) {
      const ancho = 0.05 + hash(k, fila) * 0.05;
      const altoL = 0.3 + hash(fila, k) * 0.14;
      if (hash(k * 3, fila * 7) > 0.92) {
        y += 0.1;
        continue;
      }
      pushBox(s, [0.05, y, z + 0.05, fondo - 0.05, y + ancho, z + 0.05 + altoL], paleta[Math.floor(hash(k * 7 + fila, fila) * paleta.length)]);
      y += ancho + 0.004;
    }
  }
  // La barra de latón arriba y la escalera apoyada
  pushBox(s, [fondo + 0.12, y0 + 0.1, alto - 0.6, fondo + 0.16, y1 - 0.1, alto - 0.56], BRASS, { g: 0.6 });
  const xf = giro([fondo + 0.55, 1.9, 0], 'y', -0.2);
  for (const dy of [-0.2, 0.2]) pushBox(s, [fondo + 0.52, 1.9 + dy - 0.03, 0, fondo + 0.58, 1.9 + dy + 0.03, alto - 0.5], WOOD_L, { xf });
  for (let z = 0.35; z < alto - 0.6; z += 0.38) pushBox(s, [fondo + 0.52, 1.7, z, fondo + 0.58, 2.1, z + 0.04], WOOD_L, { xf });
}
/** Nivel 3: la chimenea de ladrillo con su repisa, el fuego encendido (brasa y llamas) y la losa de piedra. */
function chimenea(s) {
  const { x0, x1, hondo, alto } = CHIMENEA;
  const ladrillo = [150, 82, 62];
  pushBox(s, [x0, 0, 0, x1, hondo, alto], ladrillo);
  for (let z = 0.2; z < alto; z += 0.2) pushBox(s, [x0 - 0.005, hondo, z, x1 + 0.005, hondo + 0.004, z + 0.014], [120, 64, 48]);
  pushBox(s, [x0 + 0.2, 0, alto + 0.08, x1 - 0.2, hondo - 0.12, SH], [140, 76, 58]);
  pushBox(s, [x0 - 0.12, 0, alto, x1 + 0.12, hondo + 0.1, alto + 0.09], WOOD_D);
  // La boca, oscura, y el fuego
  const bx0 = x0 + 0.38;
  const bx1 = x1 - 0.38;
  pushBox(s, [bx0, hondo, 0.1, bx1, hondo + 0.006, 0.86], [34, 22, 18]);
  pushBox(s, [bx0 - 0.06, hondo, 0.86, bx1 + 0.06, hondo + 0.03, 0.96], [120, 64, 48]);
  pushBox(s, [bx0 + 0.08, hondo + 0.01, 0.12, bx1 - 0.08, hondo + 0.16, 0.2], [70, 44, 30]);
  pushBox(s, [bx0 + 0.16, hondo + 0.03, 0.2, bx1 - 0.16, hondo + 0.13, 0.26], [92, 58, 38]);
  pushBox(s, [bx0 + 0.1, hondo + 0.02, 0.2, bx1 - 0.1, hondo + 0.12, 0.24], [255, 120, 40], { glow: true });
  const cx = (bx0 + bx1) / 2;
  for (const [dx, w, z1, c] of [
    [-0.16, 0.07, 0.52, [255, 150, 60]],
    [0.02, 0.09, 0.66, [255, 176, 70]],
    [0.18, 0.06, 0.48, [255, 150, 60]],
    [-0.04, 0.05, 0.5, [255, 226, 130]],
    [0.1, 0.04, 0.44, [255, 226, 130]],
  ])
    pushBox(s, [cx + dx - w / 2, hondo + 0.05, 0.24, cx + dx + w / 2, hondo + 0.1, z1], c, { glow: true });
  // La losa de piedra delante y dos candelabros en la repisa
  pushBox(s, [x0 - 0.2, hondo, 0, x1 + 0.2, hondo + 0.42, 0.04], [128, 122, 114]);
  for (const x of [x0 + 0.2, x1 - 0.2]) {
    pushBox(s, [x - 0.04, 0.15, alto + 0.09, x + 0.04, 0.25, alto + 0.12], BRASS);
    pushBox(s, [x - 0.015, 0.185, alto + 0.12, x + 0.015, 0.215, alto + 0.3], [240, 230, 210]);
    pushBox(s, [x - 0.01, 0.19, alto + 0.3, x + 0.01, 0.21, alto + 0.34], [255, 210, 120], { glow: true });
  }
}
/** El resplandor del fuego en el suelo, delante de la chimenea (transparente, sumado). */
function paintResplandor() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,160,80,0.42)');
  g.addColorStop(1, 'rgba(255,140,60,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
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
// ── La barra (revisión del bloque 3, 12-11-2026; rehecha el mismo día para que cada paso tenga su gesto y su objeto): sobre el
// mostrador, de izquierda a derecha, las jarritas de leche, el molinillo de manivela, los tarros, el portafiltro con su
// prensador, la cafetera de palanca de cobre (con la lanza de vapor), la taza en su plato, la tetera de hierro, la lata de
// canela y el tarro de miel. Lo que se mueve (la manivela, el prensador, la palanca, la tetera, la cuchara, el colador, la
// jarra, el bote y el cazo) se dibuja girado o desplazado según la postura del gesto (`cafeGestos.js`). Todo propio. ──
const COBRE = [190, 112, 70];
const COBRE_L = [226, 150, 96];
const LOZA = [238, 230, 212];
const ACERO = [176, 178, 182];
const ACERO_D = [112, 114, 120];
const NOGAL = [92, 58, 38];
const BARRA_Z = 1.05;
const TAZA_EN = { x: 7.47, y: 6.05 };
/** Tras la extracción (o la infusión), la taza sale del grupo a la madera, delante, para la leche y el toque. */
const TAZA_FUERA = { x: 7.36, y: 6.12 };
const tazaPos = (est = {}) => (est.hechos?.palanca || est.hechos?.colador || est.hechos?.cazo || est.hechos?.coctelera ? TAZA_FUERA : TAZA_EN);
const MOLINILLO = { x: 7.46, y: 5.54 };
const PORTA = { x: 7.43, y: 5.8 };
const VAPOR = { x: 7.54, y: 5.84 };
const TETERA = { x: 7.72, y: 6.45 };
const TARROS = { suave: 5.49, intenso: 5.69 };
const TARRO_X = 7.74;
const JARRAS = { entera: 5.08, avena: 5.26 };
const JARRA_X = 7.39;
const CANELA = { x: 7.44, y: 6.4 };
const MIEL = { x: 7.44, y: 6.6 };
/** Bloque 4a: el hornillo con el cazo de cobre del chocolate (detrás de la tetera) y el bol de la nata (junto a la miel). */
const CAZO = { x: 7.85, y: 6.68 };
const BOL = { x: 7.44, y: 6.82 };
/** Bloque 4b: al final de la barra, la tabla con la vaina de vainilla y, al fondo, la coctelera y la cubitera de latón. */
const VAINA = { x: 7.4, y: 7.12 };
const COCTELERA = { x: 7.8, y: 7.12 };
const CUBITERA = { x: 7.8, y: 7.32 };
/** Dónde está cada cosa de la barra que se elige tocándola (caja del mundo) y qué elige. */
export const BARRA_COSAS = {
  'barra:bebida:cafe': { box: [7.6, 5.9, BARRA_Z, 7.93, 6.2, BARRA_Z + 0.8], parte: 'bebida', valor: 'cafe' },
  'barra:bebida:te': { box: [7.6, 6.34, BARRA_Z, 7.84, 6.56, BARRA_Z + 0.34], parte: 'bebida', valor: 'te' },
  'barra:grano:suave': { box: [7.67, TARROS.suave - 0.08, BARRA_Z, 7.81, TARROS.suave + 0.08, BARRA_Z + 0.28], parte: 'grano', valor: 'suave' },
  'barra:grano:intenso': { box: [7.67, TARROS.intenso - 0.08, BARRA_Z, 7.81, TARROS.intenso + 0.08, BARRA_Z + 0.28], parte: 'grano', valor: 'intenso' },
  'barra:leche:entera': { box: [7.32, JARRAS.entera - 0.07, BARRA_Z, 7.46, JARRAS.entera + 0.07, BARRA_Z + 0.17], parte: 'leche', valor: 'entera' },
  'barra:leche:avena': { box: [7.32, JARRAS.avena - 0.07, BARRA_Z, 7.46, JARRAS.avena + 0.07, BARRA_Z + 0.17], parte: 'leche', valor: 'avena' },
  'barra:toque:canela': { box: [7.37, 6.33, BARRA_Z, 7.51, 6.47, BARRA_Z + 0.2], parte: 'toque', valor: 'canela' },
  'barra:toque:miel': { box: [7.37, 6.53, BARRA_Z, 7.51, 6.67, BARRA_Z + 0.26], parte: 'toque', valor: 'miel' },
  // Lo de la carta (bloque 4a): están en la barra desde el principio, pero solo se eligen con su hito
  'barra:bebida:chocolate': { box: [CAZO.x - 0.09, CAZO.y - 0.09, BARRA_Z, CAZO.x + 0.09, CAZO.y + 0.09, BARRA_Z + 0.3], parte: 'bebida', valor: 'chocolate', carta: 'chocolate' },
  'barra:toque:nata': { box: [BOL.x - 0.075, BOL.y - 0.075, BARRA_Z, BOL.x + 0.075, BOL.y + 0.075, BARRA_Z + 0.22], parte: 'toque', valor: 'nata', carta: 'nata' },
  'barra:toque:vainilla': { box: [VAINA.x - 0.095, VAINA.y - 0.07, BARRA_Z, VAINA.x + 0.095, VAINA.y + 0.07, BARRA_Z + 0.08], parte: 'toque', valor: 'vainilla', carta: 'vainilla' },
  'barra:bebida:frio': { box: [CUBITERA.x - 0.08, CUBITERA.y - 0.08, BARRA_Z, CUBITERA.x + 0.08, CUBITERA.y + 0.08, BARRA_Z + 0.2], parte: 'bebida', valor: 'frio', carta: 'hielo' },
};
/** Puntos de la barra (para la cámara y para saber dónde caen en la pantalla). */
export const BARRA_MARCAS = {
  taza: [TAZA_EN.x, TAZA_EN.y, BARRA_Z + 0.09],
  manivela: [MOLINILLO.x, MOLINILLO.y, BARRA_Z + 0.27],
  portafiltro: [PORTA.x, PORTA.y, BARRA_Z + 0.08],
  palanca: [7.64, 6.05, BARRA_Z + 0.6],
  tetera: [TETERA.x, TETERA.y, BARRA_Z + 0.15],
  vapor: [VAPOR.x, VAPOR.y, BARRA_Z + 0.1],
  tarros: [TARRO_X, 5.59, BARRA_Z + 0.14],
  jarras: [JARRA_X, 5.17, BARRA_Z + 0.08],
  toques: [7.44, 6.5, BARRA_Z + 0.1],
  cazo: [CAZO.x, CAZO.y, BARRA_Z + 0.17],
  bol: [BOL.x, BOL.y, BARRA_Z + 0.1],
  vaina: [VAINA.x, VAINA.y, BARRA_Z + 0.03],
  coctelera: [COCTELERA.x, COCTELERA.y, BARRA_Z + 0.16],
};
/** La cámara de cada paso: de lado y desde arriba, con el objeto en la parte alta de la pantalla (abajo va el cuadro). */
function enfoque([x, y, z], d, { alto = 0.75, bajo = 0.75, lado = 0 } = {}) {
  return { p: [x - d * 0.75, y - d * lado, z + d * alto], m: [x + d * 0.1, y + d * lado * 0.2, z - d * bajo] };
}
/** El enfoque de la taza, esté donde esté. */
const enTaza =
  (d, op, dz = 0.09) =>
  (est) => {
    const { x, y } = tazaPos(est);
    return enfoque([x, y, BARRA_Z + dz], d, op);
  };
const ENFOQUES = {
  general: { p: [6.6, 6.08, 2.02], m: [7.66, 6.08, 0.5] },
  // Con el chocolate en la carta, la cámara se abre un poco para que entre el cazo
  // Con el chocolate en la carta, la cámara se abre un poco para que entre el cazo; con el hielo, también la cubitera
  bebida: (est) =>
    est.carta?.includes('hielo')
      ? enfoque([7.72, 6.62, BARRA_Z + 0.3], 1.45)
      : est.carta?.includes('chocolate')
        ? enfoque([7.7, 6.4, BARRA_Z + 0.3], 1.15)
        : enfoque([7.68, 6.2, BARRA_Z + 0.3], 1.0),
  grano: enfoque([7.6, 5.6, BARRA_Z + 0.14], 0.72),
  manivela: enfoque(BARRA_MARCAS.manivela, 0.5, { alto: 0.95 }),
  cuchara: enfoque([7.62, 5.8, BARRA_Z + 0.28], 0.85, { alto: 0.5, bajo: 0.45 }),
  apisonar: enfoque(BARRA_MARCAS.portafiltro, 0.66, { alto: 0.5, bajo: 0.55, lado: 0.5 }),
  palanca: enfoque([7.6, 6.02, BARRA_Z + 0.4], 0.95, { alto: 0.45, bajo: 0.5, lado: 0.75 }),
  tetera: enfoque([7.62, 6.22, BARRA_Z + 0.22], 0.95, { alto: 0.6 }),
  colador: enfoque(BARRA_MARCAS.taza, 0.55, { alto: 0.6, lado: 0.4 }),
  leche: enfoque(BARRA_MARCAS.jarras, 0.6),
  vapor: enfoque([VAPOR.x, VAPOR.y, BARRA_Z + 0.18], 0.62, { alto: 0.55 }),
  verter: enTaza(0.62, { alto: 0.85, lado: 0.35 }),
  toque: (est) =>
    est.carta?.includes('vainilla')
      ? enfoque([7.44, 6.78, BARRA_Z + 0.1], 0.95)
      : est.carta?.includes('nata')
        ? enfoque([7.44, 6.62, BARRA_Z + 0.1], 0.72)
        : enfoque(BARRA_MARCAS.toques, 0.62),
  rascar: enfoque(BARRA_MARCAS.vaina, 0.42, { alto: 1.0 }),
  coctelera: enfoque([COCTELERA.x, COCTELERA.y, BARRA_Z + 0.2], 0.85, { alto: 0.55, bajo: 0.5 }),
  molinillo: enfoque(BARRA_MARCAS.cazo, 0.5, { alto: 0.95 }),
  cazo: enfoque([7.66, 6.36, BARRA_Z + 0.22], 0.95, { alto: 0.6 }),
  batir: enfoque(BARRA_MARCAS.bol, 0.48, { alto: 0.95 }),
  agitar: enTaza(0.8, { alto: 0.5, bajo: 0.22, lado: 0.3 }, 0.16),
  hilo: enTaza(0.55, { alto: 1.1, lado: 0.2 }),
  lista: enTaza(0.55),
};

/** Un giro alrededor de `piv` ([x, y, z] de la app) sobre el eje 'z' (vertical), 'y' (de fondo) o 'x'; luego, `luego`. */
function giro(piv, eje, ang, luego = null) {
  const [px, py, pz] = piv;
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return (p) => {
    const x = p[0] - px;
    const z = p[1] - pz;
    const y = p[2] - py;
    let nx = x;
    let ny = y;
    let nz = z;
    if (eje === 'z') {
      nx = x * c - y * s;
      ny = x * s + y * c;
    } else if (eje === 'y') {
      nx = x * c + z * s;
      nz = -x * s + z * c;
    } else {
      ny = y * c - z * s;
      nz = y * s + z * c;
    }
    const out = [nx + px, nz + pz, ny + py];
    return luego ? luego(out) : out;
  };
}
/** Un desplazamiento (en la app) para pushBox. */
const desplaza = (dx, dy, dz) => (p) => [p[0] + dx, p[1] + dz, p[2] + dy];

/** El color de la bebida: café o té, su fuerza, cuánto color ha soltado el té y la leche que lleva (0 a 1). */
function colorBebida({ bebida, grano }, { leche = 0, tipoLeche = 'entera', color = 1 } = {}) {
  let base =
    bebida === 'te'
      ? grano === 'intenso'
        ? [150, 74, 36]
        : [196, 150, 64]
      : bebida === 'chocolate'
        ? grano === 'intenso'
          ? [74, 40, 28]
          : [128, 76, 46]
        : bebida === 'frio'
          ? grano === 'intenso'
            ? [88, 54, 34]
            : [128, 84, 52]
          : grano === 'intenso'
            ? [62, 34, 22]
            : [104, 62, 36];
  if (bebida === 'te') base = base.map((c, k) => Math.round([214, 198, 160][k] + (c - [214, 198, 160][k]) * color));
  if (!leche) return base;
  const l = tipoLeche === 'avena' ? [226, 204, 160] : [244, 236, 220];
  return base.map((c, k) => Math.round(c + (c * 0.45 + l[k] * 0.55 - c) * leche));
}
const ARTE = {
  corazon: ['.......', '.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'],
  hoja: ['...X...', '.X.X.X.', '..XXX..', '.X.X.X.', '..XXX..', '.X.X.X.', '...X...'],
};
const PUNTOS_CANELA = [
  [-0.02, -0.01],
  [0.012, 0.018],
  [0.02, -0.02],
  [-0.008, 0.024],
  [0.026, 0.006],
  [-0.026, 0.012],
  [0.004, -0.028],
  [-0.016, -0.024],
  [0.016, 0.03],
  [0.0, 0.0],
];
/**
 * La taza con su plato, hueca, centrada en (cx, cy) sobre z0. `v`: lo que lleva (`vistaTaza`): cuánto (0 a 1), la leche, el
 * color del té, la crema, el dibujo de la leche, la canela y la miel.
 */
function taza(s, cx, cy, z0, receta = {}, v = {}, { humo = false, g = null } = {}) {
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
  const lleno = Math.min(1, v.lleno ?? 0);
  if (!receta.bebida || lleno <= 0) return;
  const top = b + 0.012 + lleno * 0.078;
  const c = colorBebida(receta, { leche: v.leche ?? 0, tipoLeche: receta.leche, color: v.color ?? 1 });
  const i0 = -0.05 + t;
  pushBox(s, [cx + i0, cy + i0, b + 0.012, cx - i0, cy - i0, top], c, o);
  // La crema del café (sin leche encima), en tostado claro
  if (v.crema && !(v.leche > 0.2))
    pushBox(
      s,
      [cx + i0, cy + i0, top, cx - i0, cy - i0, top + 0.002],
      c.map((k) => Math.min(255, k + 70)),
      o,
    );
  // El dibujo de la leche, cuadradito a cuadradito: el corazón o la hoja
  const arte = ARTE[v.arte];
  if (arte) {
    const k = (2 * -i0) / 7;
    const filas = Math.ceil((v.arteParcial ?? 1) * 7);
    arte.forEach((fila, r) =>
      [...fila].forEach((ch, col) => {
        if (ch !== 'X' || r >= filas) return;
        const x = cx - i0 - (r + 1) * k;
        const y = cy + i0 + col * k;
        pushBox(s, [x, y, top, x + k, y + k, top + 0.003], [236, 226, 206], { g: 0.82 });
      }),
    );
  }
  const canela = Math.round((v.canela ?? 0) * PUNTOS_CANELA.length);
  for (const [dx, dy] of PUNTOS_CANELA.slice(0, canela)) pushBox(s, [cx + dx - 0.005, cy + dy - 0.005, top, cx + dx + 0.005, cy + dy + 0.005, top + 0.004], [120, 62, 34], o);
  for (const [u, w] of v.miel ?? []) {
    const x = cx - w * 0.034;
    const y = cy + u * 0.034;
    pushBox(s, [x - 0.004, y - 0.004, top, x + 0.004, y + 0.004, top + 0.004], [214, 146, 48], { g: 0.85 });
  }
  // La nata montada: una nube con picos que sobresale de la taza
  if (v.nata > 0) {
    const n = [250, 246, 236];
    pushBox(s, [cx + i0, cy + i0, top, cx - i0, cy - i0, top + 0.016], n, { g: 0.8 });
    pushBox(s, [cx - 0.028, cy - 0.028, top + 0.016, cx + 0.028, cy + 0.028, top + 0.03], n, { g: 0.76 });
    pushBox(s, [cx - 0.014, cy - 0.014, top + 0.03, cx + 0.014, cy + 0.014, top + 0.042], n, { g: 0.72 });
    pushBox(s, [cx - 0.004, cy - 0.004, top + 0.042, cx + 0.004, cy + 0.004, top + 0.05], n, { g: 0.7 });
  }
  if (v.hojas) pushBox(s, [cx - 0.02, cy - 0.02, top, cx + 0.02, cy + 0.02, top + 0.002], receta.grano === 'intenso' ? [60, 40, 28] : [110, 140, 70], o);
  // Bloque 4b: los cubitos del café con hielo, que asoman (con su brillo), y las semillas negras de la vainilla
  if (v.hielo > 0)
    for (const [dx, dy, dz] of [
      [-0.018, -0.014, 0.004],
      [0.016, -0.004, 0.008],
      [-0.004, 0.018, 0.002],
    ]) {
      pushBox(s, [cx + dx - 0.014, cy + dy - 0.014, top - 0.01 + dz, cx + dx + 0.014, cy + dy + 0.014, top + 0.012 + dz], [214, 232, 240], { g: 0.86 });
      pushBox(s, [cx + dx - 0.006, cy + dy - 0.006, top + 0.012 + dz, cx + dx + 0.004, cy + dy + 0.004, top + 0.014 + dz], [250, 254, 255], { glow: true });
    }
  const semillas = Math.round((v.vainilla ?? 0) * 12);
  for (let k = 0; k < semillas; k += 1) {
    const a = k * 2.4;
    const r = 0.008 + (k % 4) * 0.008;
    pushBox(s, [cx + Math.cos(a) * r - 0.0025, cy + Math.sin(a) * r - 0.0025, top, cx + Math.cos(a) * r + 0.0025, cy + Math.sin(a) * r + 0.0025, top + 0.003], [34, 24, 20], o);
  }
  if (humo)
    for (const [dx, dz, w] of [
      [-0.015, 0.05, 0.012],
      [0.012, 0.09, 0.01],
      [-0.006, 0.13, 0.008],
    ])
      pushBox(s, [cx + dx - w * 0.6, cy - w * 0.6, top + dz, cx + dx + w * 0.6, cy + w * 0.6, top + dz + w * 1.2], [214, 204, 190], o);
}
/** El marco en la barra alrededor de una cosa: ámbar si se puede elegir ahora. */
function marcoBarra(s, [x0, y0, , x1, y1], color = [255, 206, 120]) {
  const z = BARRA_Z + 0.004;
  const e = 0.012;
  for (const bx of [
    [x0, y0, z, x1, y0 + e, z + 0.006],
    [x0, y1 - e, z, x1, y1, z + 0.006],
    [x0, y0, z, x0 + e, y1, z + 0.006],
    [x1 - e, y0, z, x1, y1, z + 0.006],
  ])
    pushBox(s, bx, color, { glow: true });
}
/** Un aro cuadrado (el borde de un cazo o la franja de un bol), hueco por dentro: radio exterior `r` y grosor `e`. */
function aro(s, x, y, r, e, z0, z1, color, o) {
  pushBox(s, [x - r, y - r, z0, x + r, y - r + e, z1], color, o);
  pushBox(s, [x - r, y + r - e, z0, x + r, y + r, z1], color, o);
  pushBox(s, [x - r, y - r, z0, x - r + e, y + r, z1], color, o);
  pushBox(s, [x + r - e, y - r, z0, x + r, y + r, z1], color, o);
}
/** Un chorro fino entre dos alturas (glow, para que se vea). */
function chorro(s, x, y, z0, z1, color, w = 0.006) {
  pushBox(s, [x - w, y - w, z0, x + w, y + w, z1], color, { glow: true });
}
/** Una jarrita de leche (loza con franja y pico hacia ti; asa detrás), con `xf` si se mueve; `espuma`, de 0 a 1. */
function jarrita(s, x, y, tipo, { xf = null, espuma = 0, g = 0.86 } = {}) {
  const z = BARRA_Z;
  const cuerpo = tipo === 'avena' ? [218, 200, 156] : [240, 236, 226];
  const franja = tipo === 'avena' ? [128, 152, 84] : [86, 118, 168];
  const o = { g, xf };
  pushBox(s, [x - 0.06, y - 0.06, z, x + 0.06, y + 0.06, z + 0.14], cuerpo, o);
  pushBox(s, [x - 0.062, y - 0.062, z + 0.1, x + 0.062, y + 0.062, z + 0.115], franja, o);
  pushBox(s, [x - 0.09, y - 0.025, z + 0.11, x - 0.06, y + 0.025, z + 0.14], cuerpo, o);
  pushBox(s, [x + 0.06, y - 0.012, z + 0.04, x + 0.095, y + 0.012, z + 0.115], cuerpo, o);
  if (espuma > 0) pushBox(s, [x - 0.05, y - 0.05, z + 0.14, x + 0.05, y + 0.05, z + 0.14 + espuma * 0.035], [232, 224, 208], { g: 0.78, xf });
}

/**
 * Todo lo de la barra. `est`: { receta, gesto (el que se hace ahora), pose (su postura), pulsado, hechos ({ gesto: pose }),
 * vista (`vistaTaza`), elige (la parte que se elige ahora: sus cosas, con marco), lista (taza terminada) }.
 */
function barraKit(s, est = {}) {
  const { receta = {}, gesto = null, pose = {}, pulsado = false, hechos = {}, vista = {}, elige = null, lista = false, carta = [] } = est;
  const z = BARRA_Z;
  const g = 0.86;
  const o = { g };
  const te = receta.bebida === 'te';
  const T = tazaPos(est);
  const ahora = (k) => gesto === k;
  const p = (k) => (ahora(k) ? pose : hechos[k]) ?? {};

  // ── La cafetera de palanca: cobre con aros de latón, cúpula, manómetro, el grupo hacia ti y la lanza de vapor ──
  pushBox(s, [7.6, 5.9, z, 7.93, 6.2, z + 0.06], [74, 50, 36], o);
  pushBox(s, [7.65, 5.94, z + 0.06, 7.89, 6.16, z + 0.44], COBRE, o);
  pushBox(s, [7.645, 5.935, z + 0.13, 7.895, 6.165, z + 0.16], BRASS, o);
  pushBox(s, [7.645, 5.935, z + 0.36, 7.895, 6.165, z + 0.39], BRASS, o);
  pushBox(s, [7.68, 5.97, z + 0.44, 7.86, 6.13, z + 0.5], COBRE_L, o);
  pushBox(s, [7.74, 6.03, z + 0.5, 7.8, 6.07, z + 0.58], BRASS, o);
  // El manómetro: se enciende mientras cae el café
  const extrayendo = ahora('palanca') && pulsado && (pose.bajada ?? 0) >= 0.85;
  pushBox(s, [7.645, 5.99, z + 0.26, 7.65, 6.05, z + 0.32], extrayendo ? [255, 236, 190] : [222, 214, 196], { glow: true });
  pushBox(s, [7.643, 6.017, z + 0.27, 7.646, 6.023, extrayendo ? z + 0.315 : z + 0.29], [170, 40, 30], { glow: true });
  // El grupo y, si ya está apisonado, el portafiltro encajado con su mango de nogal
  pushBox(s, [7.54, 6.0, z + 0.2, 7.65, 6.1, z + 0.27], BRASS, o);
  if (hechos.apisonar) {
    pushBox(s, [7.52, 6.0, z + 0.17, 7.6, 6.1, z + 0.2], ACERO, o);
    pushBox(s, [7.555, 5.9, z + 0.175, 7.585, 6.0, z + 0.2], NOGAL, o);
    pushBox(s, [7.55, 5.86, z + 0.17, 7.59, 5.9, z + 0.205], NOGAL, o);
  }
  // La lanza de vapor, a la izquierda, con su llave
  pushBox(s, [7.6, 5.86, z + 0.32, 7.65, 5.9, z + 0.35], ACERO, o);
  pushBox(s, [VAPOR.x - 0.008, VAPOR.y - 0.008, z + 0.17, VAPOR.x + 0.008, VAPOR.y + 0.008, z + 0.35], ACERO, o);
  pushBox(s, [7.6, 5.84, z + 0.36, 7.63, 5.87, z + 0.4], NOGAL, o);
  // La palanca: gira hacia ti desde lo alto del grupo
  const bajada = ahora('palanca') ? (pose.bajada ?? 0) : 0;
  const xfP = giro([7.64, 6.05, z + 0.42], 'y', -bajada * 1.75);
  pushBox(s, [7.625, 6.04, z + 0.42, 7.655, 6.06, z + 0.78], [58, 44, 36], { g, xf: xfP });
  pushBox(s, [7.615, 6.025, z + 0.78, 7.665, 6.075, z + 0.86], NOGAL, { g, xf: xfP });
  // La lucecita: encendida si hoy toca café
  pushBox(s, [7.645, 6.09, z + 0.08, 7.65, 6.12, z + 0.11], ['cafe', 'frio'].includes(receta.bebida) ? [255, 120, 70] : [90, 40, 30], { glow: ['cafe', 'frio'].includes(receta.bebida) });
  if (extrayendo) {
    chorro(s, 7.51, 6.04, z + 0.12, z + 0.17, colorBebida({ ...receta, bebida: 'cafe' }), 0.004);
    chorro(s, 7.51, 6.06, z + 0.12, z + 0.17, colorBebida({ ...receta, bebida: 'cafe' }), 0.004);
  }

  // ── El molinillo de manivela: caja de nogal con su cajón, la tolva de latón y la manivela que gira ──
  const { x: mx, y: my } = MOLINILLO;
  pushBox(s, [mx - 0.1, my - 0.1, z, mx + 0.1, my + 0.1, z + 0.16], NOGAL, o);
  pushBox(s, [mx - 0.105, my - 0.06, z + 0.03, mx - 0.1, my + 0.06, z + 0.09], WOOD_L, o);
  pushBox(s, [mx - 0.115, my - 0.012, z + 0.05, mx - 0.105, my + 0.012, z + 0.07], BRASS, o);
  pushBox(s, [mx - 0.08, my - 0.08, z + 0.16, mx + 0.08, my + 0.08, z + 0.2], BRASS, o);
  const molido = p('manivela').molido ?? 0;
  if ((receta.grano && !te && elige !== 'grano') || molido > 0) {
    // El grano en la tolva (baja al moler) y el molido que asoma en el cajón
    const tostado = receta.grano === 'intenso' ? [58, 34, 24] : [150, 98, 56];
    pushBox(s, [mx - 0.06, my - 0.06, z + 0.17, mx + 0.06, my + 0.06, z + 0.2 + 0.02 * (1 - molido)], tostado, o);
    if (molido > 0)
      pushBox(
        s,
        [mx - 0.103, my - 0.05, z + 0.032, mx - 0.1, my + 0.05, z + 0.032 + 0.05 * molido],
        tostado.map((c) => c + 20),
        o,
      );
  }
  const xfM = giro([mx, my, z + 0.2], 'z', p('manivela').angulo ?? 0);
  pushBox(s, [mx - 0.012, my - 0.012, z + 0.2, mx + 0.012, my + 0.012, z + 0.27], ACERO_D, o);
  pushBox(s, [mx - 0.012, my - 0.012, z + 0.26, mx + 0.012, my + 0.13, z + 0.275], ACERO, { g, xf: xfM });
  pushBox(s, [mx - 0.016, my + 0.11, z + 0.275, mx + 0.016, my + 0.14, z + 0.33], NOGAL, { g, xf: xfM });

  // ── Los tarros: cristal con corcho y etiqueta; dentro, grano (u hoja si toca té), claro o tostado ──
  for (const [tipo, y] of Object.entries(TARROS)) {
    const fuerte = tipo === 'intenso';
    const dentro = te ? (fuerte ? [72, 52, 36] : [126, 150, 78]) : fuerte ? [58, 34, 24] : [168, 112, 62];
    const x = TARRO_X;
    pushBox(s, [x - 0.06, y - 0.07, z, x + 0.06, y + 0.07, z + 0.19], dentro, o);
    pushBox(
      s,
      [x - 0.05, y - 0.06, z + 0.06, x + 0.05, y + 0.06, z + 0.07],
      dentro.map((c) => Math.max(0, c - 26)),
      o,
    );
    for (const [dx, dy] of [
      [-0.07, -0.08],
      [0.06, -0.08],
      [-0.07, 0.07],
      [0.06, 0.07],
    ])
      pushBox(s, [x + dx + 0.003, y + dy + 0.003, z, x + dx + 0.009, y + dy + 0.009, z + 0.21], [176, 196, 196], o);
    pushBox(s, [x - 0.065, y - 0.075, z + 0.19, x + 0.065, y + 0.075, z + 0.205], [176, 196, 196], o);
    pushBox(s, [x - 0.05, y - 0.06, z + 0.22, x + 0.05, y + 0.06, z + 0.27], [172, 128, 82], o);
    pushBox(s, [x - 0.075, y - 0.04, z + 0.07, x - 0.065, y + 0.04, z + 0.14], PAPER, o);
    pushBox(s, [x - 0.078, y - 0.015, z + 0.095, x - 0.074, y + 0.015, z + 0.115], fuerte ? [58, 34, 24] : [168, 112, 62], o);
  }

  // ── El portafiltro y el prensador (solo café): hasta apisonar, sobre la madera; luego, en el grupo ──
  if (!te && !hechos.apisonar) {
    const { x, y } = PORTA;
    pushBox(s, [x - 0.05, y - 0.05, z, x + 0.05, y + 0.05, z + 0.04], ACERO, o);
    pushBox(s, [x - 0.2, y - 0.015, z + 0.012, x - 0.05, y + 0.015, z + 0.036], NOGAL, o);
    if (hechos.manivela) pushBox(s, [x - 0.04, y - 0.04, z + 0.04, x + 0.04, y + 0.04, z + 0.046 - 0.004 * (p('apisonar').bajada ?? 0)], receta.grano === 'intenso' ? [70, 44, 30] : [160, 108, 64], o);
    const baja = (ahora('apisonar') ? (pose.bajada ?? 0) : 0) * 0.09;
    const xfT = desplaza(0, 0, -baja);
    pushBox(s, [x - 0.04, y - 0.04, z + 0.14, x + 0.04, y + 0.04, z + 0.16], ACERO, { g, xf: xfT });
    pushBox(s, [x - 0.015, y - 0.015, z + 0.16, x + 0.015, y + 0.015, z + 0.22], NOGAL, { g, xf: xfT });
    pushBox(s, [x - 0.028, y - 0.028, z + 0.22, x + 0.028, y + 0.028, z + 0.25], NOGAL, { g, xf: xfT });
  }

  // ── La tetera de hierro: en su salvamanteles o, al levantarla, sobre la taza e inclinada ──
  const alzada = ahora('tetera') ? (pose.alzada ?? 0) : 0;
  pushBox(s, [TETERA.x - 0.12, TETERA.y - 0.1, z, TETERA.x + 0.12, TETERA.y + 0.1, z + 0.02], BRASS, o);
  {
    const k = Math.min(1, alzada / 0.6);
    const xfK = giro([TETERA.x, TETERA.y, z + 0.02], 'x', k * 0.7, desplaza(k * (7.56 - TETERA.x), k * (6.22 - TETERA.y), k * 0.2));
    const ok = { g, xf: xfK };
    const { x, y } = TETERA;
    pushBox(s, [x - 0.1, y - 0.08, z + 0.02, x + 0.1, y + 0.08, z + 0.18], [52, 78, 76], ok);
    pushBox(s, [x - 0.06, y - 0.04, z + 0.18, x + 0.06, y + 0.04, z + 0.21], [44, 64, 62], ok);
    pushBox(s, [x - 0.02, y - 0.02, z + 0.21, x + 0.02, y + 0.02, z + 0.24], BRASS, ok);
    // El pico, hacia la taza
    pushBox(s, [x - 0.02, y - 0.14, z + 0.07, x + 0.02, y - 0.08, z + 0.11], [52, 78, 76], ok);
    pushBox(s, [x - 0.02, y - 0.17, z + 0.11, x + 0.02, y - 0.13, z + 0.14], [52, 78, 76], ok);
    pushBox(s, [x - 0.01, y - 0.06, z + 0.24, x + 0.01, y - 0.04, z + 0.32], BRASS, ok);
    pushBox(s, [x - 0.01, y + 0.04, z + 0.24, x + 0.01, y + 0.06, z + 0.32], BRASS, ok);
    pushBox(s, [x - 0.01, y - 0.06, z + 0.32, x + 0.01, y + 0.06, z + 0.34], BRASS, ok);
    if (ahora('tetera') && pulsado && alzada >= 0.6) chorro(s, TAZA_EN.x + 0.01, TAZA_EN.y + 0.01, z + 0.1, z + 0.3, [214, 220, 214], 0.005);
  }

  // ── El colador sobre la taza (té): con las hojas dentro; sube y baja con el dedo ──
  if (te && !hechos.colador) {
    const alto = (p('colador').altura ?? 0) * 0.05;
    const xfC = desplaza(0, 0, ahora('colador') ? alto : 0);
    const { x, y } = TAZA_EN;
    pushBox(s, [x - 0.04, y - 0.04, z + 0.13, x + 0.04, y + 0.04, z + 0.15], BRASS, { g, xf: xfC });
    pushBox(s, [x - 0.008, y + 0.04, z + 0.14, x + 0.008, y + 0.12, z + 0.15], BRASS, { g, xf: xfC });
    if (vista.hojas) pushBox(s, [x - 0.03, y - 0.03, z + 0.15, x + 0.03, y + 0.03, z + 0.16], receta.grano === 'intenso' ? [60, 40, 28] : [110, 140, 70], { g, xf: xfC });
  }
  // La cuchara del té: del tarro elegido al colador, por encima
  if (ahora('cuchara') && receta.grano) {
    const tt = pose.t ?? 0;
    const y0 = TARROS[receta.grano];
    const x = TARRO_X + (TAZA_EN.x - TARRO_X) * tt;
    const y = y0 + (TAZA_EN.y - y0) * tt;
    const zz = z + 0.3 + Math.sin(tt * Math.PI) * 0.08;
    pushBox(s, [x - 0.035, y - 0.03, zz, x + 0.035, y + 0.03, zz + 0.014], BRASS, o);
    pushBox(s, [x - 0.025, y - 0.022, zz + 0.014, x + 0.025, y + 0.022, zz + 0.03], receta.grano === 'intenso' ? [60, 40, 28] : [110, 140, 70], o);
    pushBox(s, [x - 0.16, y - 0.009, zz + 0.012, x - 0.035, y + 0.009, zz + 0.022], BRASS, o);
    pushBox(s, [x - 0.18, y - 0.014, zz + 0.014, x - 0.15, y + 0.014, zz + 0.026], NOGAL, o);
  }

  // ── Las jarritas de leche: la elegida va bajo la lanza para cremarla y luego sobre la taza para servir ──
  for (const [tipo, y] of Object.entries(JARRAS)) {
    const mia = receta.leche === tipo;
    if (mia && ahora('vapor')) {
      const inc = pose.inclina ?? 0;
      const xf = giro([JARRA_X, y, z], 'x', inc * 0.45, desplaza(VAPOR.x - JARRA_X, VAPOR.y - y, 0.01));
      jarrita(s, JARRA_X, y, tipo, { xf, espuma: pose.espuma ?? 0 });
      if (pulsado && Math.abs(inc) >= 0.5)
        for (const [dx, dz] of [
          [0.02, 0.24],
          [-0.015, 0.3],
          [0.01, 0.36],
        ])
          pushBox(s, [VAPOR.x + dx - 0.01, VAPOR.y - 0.01, z + dz, VAPOR.x + dx + 0.01, VAPOR.y + 0.01, z + dz + 0.02], [228, 222, 214], o);
    } else if (mia && ahora('verter')) {
      const xf = giro([JARRA_X, y, z], 'y', -(0.5 + (pose.vertido ?? 0) * 0.4), desplaza(T.x + 0.17 - JARRA_X, T.y + (pose.x ?? 0) * 0.025 - y, 0.1));
      jarrita(s, JARRA_X, y, tipo, { xf, espuma: 1, g: 0.72 });
      if (pulsado) chorro(s, T.x + 0.035, T.y + (pose.x ?? 0) * 0.025, z + 0.1, z + 0.19, [236, 228, 212], 0.005);
    } else jarrita(s, JARRA_X, y, tipo, { espuma: mia && hechos.vapor && !hechos.verter ? 1 : 0 });
  }

  // ── La lata de canela (se agita sobre la taza) y el tarro de miel con su cazo (dibuja el hilo) ──
  if (ahora('agitar')) {
    // Boca abajo, justo encima de la taza: gira sobre su centro y se balancea con el dedo; el polvo cae en vertical
    const vai = pose.x ?? 0;
    const sobre = 0.25;
    const xf = giro([CANELA.x, CANELA.y, z + 0.075], 'x', Math.PI + vai * 0.25, desplaza(T.x - CANELA.x, T.y - CANELA.y + vai * 0.025, sobre - 0.075));
    pushBox(s, [CANELA.x - 0.05, CANELA.y - 0.05, z, CANELA.x + 0.05, CANELA.y + 0.05, z + 0.13], [150, 78, 48], { g, xf });
    pushBox(s, [CANELA.x - 0.055, CANELA.y - 0.055, z + 0.13, CANELA.x + 0.055, CANELA.y + 0.055, z + 0.15], BRASS, { g, xf });
    if (pulsado)
      for (let k = 0; k < 4; k += 1) {
        const dz = 0.12 + k * 0.012;
        const dy = vai * 0.025 + [-0.012, 0.008, -0.004, 0.012][k];
        pushBox(s, [T.x - 0.004, T.y + dy - 0.004, z + dz, T.x + 0.004, T.y + dy + 0.004, z + dz + 0.006], [140, 72, 40], o);
      }
  } else {
    pushBox(s, [CANELA.x - 0.06, CANELA.y - 0.06, z, CANELA.x + 0.06, CANELA.y + 0.06, z + 0.13], [150, 78, 48], o);
    pushBox(s, [CANELA.x - 0.065, CANELA.y - 0.065, z + 0.13, CANELA.x + 0.065, CANELA.y + 0.065, z + 0.15], BRASS, o);
    pushBox(s, [CANELA.x - 0.03, CANELA.y - 0.03, z + 0.15, CANELA.x - 0.015, CANELA.y + 0.03, z + 0.19], [128, 66, 36], o);
  }
  pushBox(s, [MIEL.x - 0.06, MIEL.y - 0.06, z, MIEL.x + 0.06, MIEL.y + 0.06, z + 0.12], [222, 164, 52], o);
  pushBox(s, [MIEL.x - 0.05, MIEL.y - 0.05, z + 0.02, MIEL.x + 0.05, MIEL.y + 0.05, z + 0.1], [255, 196, 84], { glow: true });
  pushBox(s, [MIEL.x - 0.065, MIEL.y - 0.065, z + 0.12, MIEL.x + 0.065, MIEL.y + 0.065, z + 0.14], [176, 120, 60], o);
  {
    const ult = ahora('hilo') ? pose.puntos?.at(-1) : null;
    const [cx, cy, cz] = ult ? [T.x - ult[1] * 0.034, T.y + ult[0] * 0.034, z + 0.15] : [MIEL.x, MIEL.y, z + 0.14];
    const xfD = ult ? giro([cx, cy, cz], 'y', -0.7) : null;
    pushBox(s, [cx - 0.006, cy - 0.006, cz, cx + 0.006, cy + 0.006, cz + 0.12], [150, 100, 60], { g, xf: xfD });
    pushBox(s, [cx - 0.016, cy - 0.016, cz - 0.02, cx + 0.016, cy + 0.016, cz + 0.01], [176, 118, 64], { g, xf: xfD });
    if (ult && pulsado) pushBox(s, [cx - 0.003, cy - 0.003, z + 0.11, cx + 0.003, cy + 0.003, cz - 0.02], [214, 146, 48], { g: 0.85 });
  }

  // ── Bloque 4a: el hornillo de hierro con el cazo de cobre del chocolate y su molinillo de madera ──
  {
    const { x, y } = CAZO;
    const choco = receta.bebida === 'chocolate';
    pushBox(s, [x - 0.09, y - 0.09, z, x + 0.09, y + 0.09, z + 0.05], [52, 48, 46], o);
    pushBox(s, [x - 0.095, y - 0.095, z + 0.05, x + 0.095, y + 0.095, z + 0.06], [74, 68, 64], o);
    // El fuego, bajito, solo si hoy toca chocolate
    pushBox(s, [x - 0.05, y - 0.05, z + 0.06, x + 0.05, y + 0.05, z + 0.064], choco ? [255, 150, 70] : [90, 60, 50], { glow: choco });
    for (const [dx, dy] of [
      [-0.06, -0.06],
      [0.06, -0.06],
      [-0.06, 0.06],
      [0.06, 0.06],
    ])
      pushBox(s, [x + dx - 0.006, y + dy - 0.006, z - 0.01, x + dx + 0.006, y + dy + 0.006, z], [40, 36, 34], o);
    // El cazo: en el hornillo o, al servir, sobre la taza e inclinado (como la tetera)
    const inc = ahora('cazo') ? (pose.inclina ?? 0) : 0;
    const servido = p('cazo').servido ?? 0;
    const k = Math.min(1, inc / 0.6);
    const xfZ = ahora('cazo') ? giro([x, y, z + 0.064], 'x', k * 0.85, desplaza(k * (TAZA_EN.x + 0.06 - x), k * (TAZA_EN.y + 0.16 - y), k * 0.2)) : null;
    const oz = { g, xf: xfZ };
    const zc = z + 0.064;
    pushBox(s, [x - 0.07, y - 0.07, zc, x + 0.07, y + 0.07, zc + 0.012], COBRE, oz);
    pushBox(s, [x - 0.07, y - 0.07, zc, x - 0.058, y + 0.07, zc + 0.11], COBRE, oz);
    pushBox(s, [x + 0.058, y - 0.07, zc, x + 0.07, y + 0.07, zc + 0.11], COBRE, oz);
    pushBox(s, [x - 0.07, y - 0.07, zc, x + 0.07, y - 0.058, zc + 0.11], COBRE, oz);
    pushBox(s, [x - 0.07, y + 0.058, zc, x + 0.07, y + 0.07, zc + 0.11], COBRE, oz);
    aro(s, x, y, 0.074, 0.016, zc + 0.1, zc + 0.112, COBRE_L, oz);
    // El pico, hacia la taza, y el mango de nogal hacia ti
    pushBox(s, [x - 0.015, y - 0.09, zc + 0.09, x + 0.015, y - 0.07, zc + 0.11], COBRE_L, oz);
    pushBox(s, [x - 0.24, y - 0.012, zc + 0.08, x - 0.07, y + 0.012, zc + 0.1], NOGAL, oz);
    pushBox(s, [x - 0.26, y - 0.016, zc + 0.078, x - 0.22, y + 0.016, zc + 0.102], BRASS, oz);
    // Dentro, el chocolate (en cuanto se elige el cacao), que se espesa al remover y baja al servir
    if (choco && receta.grano && servido < 1) {
      const c = colorBebida(receta);
      const nivel = zc + 0.012 + 0.07 * (1 - servido * 0.85);
      pushBox(s, [x - 0.058, y - 0.058, zc + 0.012, x + 0.058, y + 0.058, nivel], c, oz);
      // Los remolinos, más claros, que deja el molinillo
      const espeso = p('molinillo').espeso ?? 0;
      const giros = Math.round(espeso * 6);
      for (let q = 0; q < giros; q += 1) {
        const a = q * 1.05 + (p('molinillo').angulo ?? 0) * 0.2;
        const r = 0.018 + (q % 3) * 0.011;
        pushBox(
          s,
          [x + Math.cos(a) * r - 0.006, y + Math.sin(a) * r - 0.006, nivel, x + Math.cos(a) * r + 0.006, y + Math.sin(a) * r + 0.006, nivel + 0.003],
          c.map((v) => Math.min(255, v + 46)),
          oz,
        );
      }
      // Un poco de vapor cuando ya está espeso
      if (espeso >= 1 && !ahora('cazo'))
        for (const [dx, dz] of [
          [-0.015, 0.05],
          [0.012, 0.09],
        ])
          pushBox(s, [x + dx - 0.007, y - 0.007, nivel + dz, x + dx + 0.007, y + 0.007, nivel + dz + 0.014], [222, 212, 200], o);
    }
    if (ahora('cazo') && pulsado && inc >= 0.6) chorro(s, TAZA_EN.x, TAZA_EN.y + 0.01, z + 0.1, z + 0.3, colorBebida(receta), 0.006);
    // El molinillo: un palo torneado con la cabeza de aros. Mientras se remueve, dentro del cazo y girando; si no, en la madera
    if (ahora('molinillo')) {
      const a = pose.angulo ?? 0;
      const r = 0.032;
      const mx = x + Math.cos(a) * r;
      const my = y + Math.sin(a) * r;
      pushBox(s, [mx - 0.007, my - 0.007, zc + 0.03, mx + 0.007, my + 0.007, zc + 0.3], WOOD_L, { g });
      pushBox(s, [mx - 0.022, my - 0.022, zc + 0.03, mx + 0.022, my + 0.022, zc + 0.05], WOOD_L, { g });
      pushBox(s, [mx - 0.016, my - 0.016, zc + 0.055, mx + 0.016, my + 0.016, zc + 0.07], NOGAL, { g });
      pushBox(s, [mx - 0.012, my - 0.012, zc + 0.28, mx + 0.012, my + 0.012, zc + 0.31], NOGAL, { g });
    } else if (!hechos.molinillo || !choco) {
      const yy = y + 0.13;
      pushBox(s, [x - 0.14, yy - 0.006, z, x + 0.1, yy + 0.006, z + 0.012], WOOD_L, o);
      pushBox(s, [x + 0.06, yy - 0.02, z, x + 0.1, yy + 0.02, z + 0.035], WOOD_L, o);
      pushBox(s, [x + 0.07, yy - 0.016, z + 0.035, x + 0.09, yy + 0.016, z + 0.04], NOGAL, o);
    }
  }
  // ── Bloque 4a: el bol de loza con la nata y las varillas de alambre ──
  {
    const { x, y } = BOL;
    const azul = [96, 128, 170];
    pushBox(s, [x - 0.05, y - 0.05, z, x + 0.05, y + 0.05, z + 0.012], LOZA, o);
    pushBox(s, [x - 0.07, y - 0.07, z + 0.012, x - 0.058, y + 0.07, z + 0.09], LOZA, o);
    pushBox(s, [x + 0.058, y - 0.07, z + 0.012, x + 0.07, y + 0.07, z + 0.09], LOZA, o);
    pushBox(s, [x - 0.07, y - 0.07, z + 0.012, x + 0.07, y - 0.058, z + 0.09], LOZA, o);
    pushBox(s, [x - 0.07, y + 0.058, z + 0.012, x + 0.07, y + 0.07, z + 0.09], LOZA, o);
    aro(s, x, y, 0.072, 0.014, z + 0.065, z + 0.075, azul, o);
    // La nata: líquida al principio; al batir sube y le salen picos
    const montada = p('batir').montada ?? 0;
    const nata = [248, 244, 234];
    if (!hechos.batir || receta.toque !== 'nata') {
      const alto = z + 0.03 + 0.03 * montada;
      pushBox(s, [x - 0.058, y - 0.058, z + 0.012, x + 0.058, y + 0.058, alto], nata, { g: 0.82 });
      const picos = Math.round(montada * 5);
      for (const [dx, dy] of [
        [-0.03, -0.02],
        [0.02, 0.03],
        [0.03, -0.025],
        [-0.02, 0.028],
        [0, 0],
      ].slice(0, picos))
        pushBox(s, [x + dx - 0.01, y + dy - 0.01, alto, x + dx + 0.01, y + dy + 0.01, alto + 0.016], nata, { g: 0.76 });
    }
    // Las varillas: girando en el bol mientras se bate; si no, apoyadas dentro
    const a = ahora('batir') ? (pose.angulo ?? 0) : 0.7;
    const r = ahora('batir') ? 0.022 : 0.012;
    const vx = x + Math.cos(a) * r;
    const vy = y + Math.sin(a) * r;
    const xfV = ahora('batir') ? null : giro([x, y, z + 0.03], 'x', 0.35);
    for (const [ox, oy] of [
      [-0.018, 0],
      [0.018, 0],
      [0, -0.018],
      [0, 0.018],
    ]) {
      pushBox(s, [vx + ox - 0.0025, vy + oy - 0.0025, z + 0.03, vx + ox + 0.0025, vy + oy + 0.0025, z + 0.14], ACERO, { g, xf: xfV });
    }
    pushBox(s, [vx - 0.02, vy - 0.02, z + 0.026, vx + 0.02, vy + 0.02, z + 0.032], ACERO, { g, xf: xfV });
    pushBox(s, [vx - 0.01, vy - 0.01, z + 0.14, vx + 0.01, vy + 0.01, z + 0.25], NOGAL, { g, xf: xfV });
  }

  // ── Bloque 4b: la tabla de la vainilla, con la vaina negra y el cuchillo pequeño; se rasca de arriba abajo ──
  {
    const { x, y } = VAINA;
    pushBox(s, [x - 0.095, y - 0.07, z, x + 0.095, y + 0.07, z + 0.018], WOOD_L, o);
    pushBox(s, [x - 0.095, y - 0.07, z + 0.018, x + 0.095, y - 0.064, z + 0.02], NOGAL, o);
    const raspados = p('rascar').raspados ?? 0;
    const usada = receta.toque === 'vainilla' && hechos.rascar;
    // La vaina: abierta a lo largo cuando ya se ha rascado (se ve el interior más claro)
    pushBox(s, [x - 0.085, y - 0.008, z + 0.018, x + 0.085, y + 0.008, z + 0.03], [42, 28, 24], o);
    if (raspados > 0 || usada) pushBox(s, [x - 0.08, y - 0.003, z + 0.03, x + 0.08, y + 0.003, z + 0.032], [96, 66, 40], o);
    // Las semillas que van quedando en la tabla
    for (let k = 0; k < raspados * 5; k += 1) pushBox(s, [x - 0.07 + k * 0.01, y + 0.012, z + 0.018, x - 0.066 + k * 0.01, y + 0.016, z + 0.021], [24, 16, 12], o);
    // El cuchillo: mientras se rasca, sobre la vaina y bajando hacia ti; si no, apoyado en la tabla
    const tt = ahora('rascar') ? (pose.t ?? 0) : 0;
    const kx = ahora('rascar') ? x + 0.075 - tt * 0.15 : x;
    const ky = ahora('rascar') ? y : y + 0.045;
    const kz = ahora('rascar') ? z + 0.034 : z + 0.018;
    pushBox(s, [kx - 0.006, ky - 0.004, kz, kx + 0.03, ky + 0.004, kz + 0.006], ACERO, o);
    pushBox(s, [kx + 0.03, ky - 0.007, kz, kx + 0.075, ky + 0.007, kz + 0.012], NOGAL, o);
  }
  // ── Bloque 4b: la cubitera de latón con hielo y la coctelera de acero, que se agita de lado a lado ──
  {
    const { x, y } = CUBITERA;
    pushBox(s, [x - 0.07, y - 0.07, z, x + 0.07, y + 0.07, z + 0.13], BRASS, o);
    aro(s, x, y, 0.074, 0.012, z + 0.12, z + 0.135, [214, 180, 96], o);
    const hielo = receta.bebida === 'frio';
    for (const [dx, dy, dz] of [
      [-0.03, -0.025, 0],
      [0.02, -0.02, 0.006],
      [-0.012, 0.024, 0.004],
      [0.028, 0.026, 0],
    ])
      pushBox(s, [x + dx - 0.018, y + dy - 0.018, z + 0.1 + dz, x + dx + 0.018, y + dy + 0.018, z + 0.136 + dz], [206, 226, 236], { glow: hielo });
  }
  {
    const { x, y } = COCTELERA;
    const ag = ahora('coctelera');
    const px_ = ag ? (pose.x ?? 0) : 0;
    // Agitando: sube, se ladea con el vaivén y va de un lado a otro
    const xfC = ag ? giro([x, y, z + 0.05], 'x', px_ * 0.5, desplaza(0, px_ * 0.07, 0.12)) : null;
    const oc = { g, xf: xfC };
    pushBox(s, [x - 0.04, y - 0.04, z, x + 0.04, y + 0.04, z + 0.2], ACERO, oc);
    pushBox(s, [x - 0.043, y - 0.043, z + 0.17, x + 0.043, y + 0.043, z + 0.185], ACERO_D, oc);
    pushBox(s, [x - 0.03, y - 0.03, z + 0.2, x + 0.03, y + 0.03, z + 0.25], ACERO, oc);
    pushBox(s, [x - 0.012, y - 0.012, z + 0.25, x + 0.012, y + 0.012, z + 0.275], ACERO_D, oc);
    // La escarcha: se va cubriendo al agitar
    const frio = p('coctelera').agitado ?? 0;
    if (frio > 0) pushBox(s, [x - 0.041, y - 0.041, z + 0.02, x + 0.041, y + 0.041, z + 0.02 + frio * 0.14], [226, 236, 242], { g: 0.9, xf: xfC });
  }

  // ── La taza, bajo el grupo ──
  taza(s, T.x, T.y, z, receta, vista, { humo: lista && !reduced() && receta.bebida !== 'frio', g });
  // Lo que se puede elegir ahora, con su marco
  if (elige) for (const cosa of Object.values(BARRA_COSAS)) if (cosa.parte === elige && (!cosa.carta || carta.includes(cosa.carta))) marcoBarra(s, cosa.box, receta[elige] === cosa.valor ? [255, 226, 160] : [214, 150, 70]);
}
/** La taza que llevas en la mano (en el sitio de la cámara: x a la derecha, z arriba, y hacia ti), con lo que lleve. */
function tazaEnMano({ receta = {}, vista = {} } = {}) {
  const s = kit();
  taza(s, 0, 0, 0, receta, { ...vista, lleno: 1 }, { humo: true, g: 0.62 });
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
  // Izquierda (x = 0, a es y desde la entrada): el hueco claro de los carteles de antes. Desde el nivel 4, al fondo del ala
  const paredIzq = plane(
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
  const frente = plane(
    SW,
    SH,
    paintWall(SW, (a, b) => [SW - a, SD - 0.05, b], delanteExtra, [[SW - 6.0, 3.7, SW - 0.8, 4.5]]),
    (m) => {
      m.rotation.y = Math.PI;
      m.position.set(SW / 2, SH / 2, SD);
    },
  );
  // Bloque 4b: la misma pared con el cristal a través y la puerta abierta (nivel 5, la terraza)
  const frenteAbierto = plane(
    SW,
    SH,
    conLuces([LUZ_TERRAZA], () => paintWall(SW, (a, b) => [SW - a, SD - 0.05, b], delanteDe(true), [[SW - 6.0, 3.7, SW - 0.8, 4.5]])),
    (m) => {
      m.rotation.y = Math.PI;
      m.position.set(SW / 2, SH / 2, SD);
      m.visible = false;
    },
    { cut: true },
  );
  // ── Bloque 4b: el ala lateral (nivel 4): suelo, techo, sus paredes, los pilares, la viga y la luz ──
  const alaGrupo = new Group();
  let alaPilares = null;
  alaGrupo.visible = false;
  scene.add(alaGrupo);
  conLuces([LUZ_ALA], () => {
    const ancho = ALA.x1 - ALA.x0;
    const cx = (ALA.x0 + ALA.x1) / 2;
    alaGrupo.add(
      plane(ancho, SD, paintSueloAla(), (m) => {
        m.rotation.x = -Math.PI / 2;
        m.position.set(cx, 0.001, SD / 2);
      }),
    );
    alaGrupo.add(
      plane(ancho, SD, paintCeiling(ALA.x0, ancho), (m) => {
        m.rotation.x = Math.PI / 2;
        m.position.set(cx, SH, SD / 2);
      }),
    );
    alaGrupo.add(
      plane(
        ancho,
        SH,
        paintWall(ancho, (a, b) => [ALA.x0 + a, 0.05, b]),
        (m) => m.position.set(cx, SH / 2, 0),
      ),
    );
    alaGrupo.add(
      plane(
        ancho,
        SH,
        paintWall(ancho, (a, b) => [ALA.x1 - a, SD - 0.05, b], ventanaAla),
        (m) => {
          m.rotation.y = Math.PI;
          m.position.set(cx, SH / 2, SD);
        },
      ),
    );
    const s = kit();
    alaKit(s);
    alaPilares = new Mesh(own(geometryOf(s)), flat);
    alaGrupo.add(alaPilares);
  });
  // ── Bloque 4b: la terraza (nivel 5): la acera, el muelle enfrente, la fachada por fuera, el toldo y la puerta abierta ──
  const fueraGrupo = new Group();
  fueraGrupo.visible = false;
  scene.add(fueraGrupo);
  const fachadaFuera = conLuces([LUZ_TERRAZA], () => {
    const ancho = FUERA.x1 - FUERA.x0;
    fueraGrupo.add(
      plane(ancho, 5, paintAcera(), (m) => {
        m.rotation.x = -Math.PI / 2;
        m.position.set((FUERA.x0 + FUERA.x1) / 2, 0.001, SD + 2.5);
      }),
    );
    fueraGrupo.add(
      plane(26, 7, paintMuelle(), (m) => {
        m.rotation.y = Math.PI;
        m.position.set(5, 3.5, SD + 5);
      }),
    );
    const s = kit();
    puertaAbiertaKit(s);
    fueraGrupo.add(new Mesh(own(geometryOf(s)), flat));
    return plane(
      ancho,
      FUERA.alto,
      paintFachadaFuera(),
      (m) => {
        m.position.set((FUERA.x0 + FUERA.x1) / 2, FUERA.alto / 2, SD + 0.02);
        m.visible = false;
      },
      { cut: true },
    );
  });
  const toldo = conLuces([LUZ_TERRAZA], () => {
    const s = kit();
    toldoKit(s);
    const m = new Mesh(own(geometryOf(s)), flat);
    m.visible = false;
    scene.add(m);
    return m;
  });
  // Lo que tapa el fondo en el nivel 1 (la cortina y el caballete), que se recoge al subir al nivel 2
  const telon = (() => {
    const s = kit();
    cortina(s);
    caballete(s);
    const m = new Mesh(own(geometryOf(s)), flat);
    scene.add(m);
    return m;
  })();
  // Bloque 4a: el nivel 2 (la viga y el ventanal con el puerto) y el nivel 3 (estanterías altas y chimenea)
  const nivel2 = (() => {
    const s = kit();
    viga(s);
    ventanal(s);
    const m = new Mesh(own(geometryOf(s)), flat);
    m.visible = false;
    scene.add(m);
    return m;
  })();
  const puerto = plane(VENTANAL.x1 - VENTANAL.x0, VENTANAL.z1 - VENTANAL.z0, paintPuerto(), (m) => {
    m.position.set((VENTANAL.x0 + VENTANAL.x1) / 2, (VENTANAL.z0 + VENTANAL.z1) / 2, 0.03);
    m.visible = false;
  });
  const estanteriaVieja = (() => {
    const s = kit();
    estanteria(s);
    const m = new Mesh(own(geometryOf(s)), flat);
    scene.add(m);
    return m;
  })();
  const altasM = (() => {
    const s = kit();
    estanteriasAltas(s);
    const m = new Mesh(own(geometryOf(s)), flat);
    m.visible = false;
    scene.add(m);
    return m;
  })();
  const nivel3 = (() => {
    const s = kit();
    chimenea(s);
    const m = new Mesh(own(geometryOf(s)), flat);
    m.visible = false;
    scene.add(m);
    return m;
  })();
  const resplandor = plane(
    2.6,
    1.8,
    paintResplandor(),
    (m) => {
      m.rotation.x = -Math.PI / 2;
      m.position.set((CHIMENEA.x0 + CHIMENEA.x1) / 2, 0.02, CHIMENEA.hondo + 0.7);
      m.visible = false;
    },
    { glow: true, smooth: true },
  );
  {
    const s = kit();
    mostrador(s);
    bombilla(s);
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
  const laminaPlano = plane(1.3, 0.98, lamina, (m) => m.position.set(CABALLETE.x, 1.33, CABALLETE.y + 0.13));
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
  let rotuloFuera = null;
  function ponerRotulo(nombre) {
    if (rotulo) {
      scene.remove(rotulo);
      rotulo.material.map.dispose();
      rotulo.material.dispose();
      rotulo.geometry.dispose();
      rotulo = null;
    }
    if (rotuloFuera) {
      scene.remove(rotuloFuera);
      rotuloFuera.material.dispose();
      rotuloFuera.geometry.dispose();
      rotuloFuera = null;
    }
    if (!nombre) return;
    const map = texture(paintRotulo(nombre, 120, 22, { px: 11 }));
    rotulo = new Mesh(new PlaneGeometry(3.0, 0.55), new MeshBasicMaterial({ map }));
    rotulo.rotation.y = -Math.PI / 2;
    rotulo.position.set(SW - 0.05, 3.55, PILAR.y);
    scene.add(rotulo);
    rotuloFuera = new Mesh(new PlaneGeometry(3.6, 0.6), new MeshBasicMaterial({ map }));
    rotuloFuera.position.set((ESCAPARATE.x0 + ESCAPARATE.x1) / 2, 4.15, SD + 0.05);
    rotuloFuera.visible = false;
    scene.add(rotuloFuera);
  }
  const cordel = (() => {
    const s = kit();
    pushBox(s, [CARTEL.x - 0.5, SD - 0.08, CARTEL.z + CARTEL.alto / 2, CARTEL.x - 0.48, SD - 0.06, CARTEL.z + 0.6], [60, 50, 40], { g: 0.4 });
    pushBox(s, [CARTEL.x + 0.48, SD - 0.08, CARTEL.z + CARTEL.alto / 2, CARTEL.x + 0.5, SD - 0.06, CARTEL.z + 0.6], [60, 50, 40], { g: 0.4 });
    pushBox(s, [CARTEL.x - 0.03, SD - 0.1, CARTEL.z + 0.58, CARTEL.x + 0.03, SD - 0.04, CARTEL.z + 0.64], BRASS, { g: 0.5 });
    const m = new Mesh(own(geometryOf(s)), flat);
    scene.add(m);
    return m;
  })();
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
  const CABEN = { 'cafe-estanteria': LIBROS_POR_ESTANTERIA, 'cafe-estanteria-alta': 96, 'cafe-biombo': 24 };
  const planoGrupo = new Group();
  scene.add(planoGrupo);
  let estado = { inaugurado: false, nombre: null, plano: { v: 1, items: [] }, libros: [], cajas: 0, vacias: false, nivel: 1, escaparate: [] };
  let modo = { decorar: false, sel: null, mal: false };
  let piezas = [];
  let obstaculos = [];
  const rejillaDe = (c0, c1, f0, f1) => {
    const [cols, filas] = [c1 - c0, f1 - f0];
    const m = plane(
      cols * CUADRO.celda,
      filas * CUADRO.celda,
      paintRejilla(filas, cols),
      (p) => {
        p.rotation.x = -Math.PI / 2;
        const o = enMundo(c0, f0);
        p.position.set(o.x + (cols * CUADRO.celda) / 2, 0.012, o.y + (filas * CUADRO.celda) / 2);
        p.visible = false;
      },
      { glow: true },
    );
    m.renderOrder = 2;
    return m;
  };
  const hacerRejilla = (nivel) => {
    const c = columnasDe(nivel);
    const f = filasDe(nivel);
    const out = [rejillaDe(c.desde, c.hasta, f.desde, f.hasta)];
    // La terraza (nivel 5), aparte: la fila 6 es la pared
    if (nivel >= 5) out.push(rejillaDe(0, CUADRICULA.w, 7, 10));
    return out;
  };
  const rejillas = { 1: hacerRejilla(1), 2: hacerRejilla(2), 4: hacerRejilla(4), 5: hacerRejilla(5) };
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
    let usados = 0;
    // Los libros que no caben en las estanterías del café van a la de la pared (la alta, 1.122, tiene cinco baldas)
    const enCafe = estado.plano.items.reduce((s, i) => s + (CABEN[i.id] ?? 0), 0);
    for (const it of estado.plano.items) {
      const med = medidas(it.id);
      if (!med) continue;
      const f = footprint(med, it.rot);
      const o = enMundo(it.x, it.y);
      const cabe = CABEN[it.id] ?? 0;
      const tramo = cabe ? estado.libros.slice(usados, usados + cabe) : [];
      // Con los libros en cajas, una estantería sin ejemplares se queda vacía (sin lomos de relleno)
      const libros = estado.vacias && !tramo.length && cabe ? null : tramo;
      usados += cabe;
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
      if (estado.inaugurado) lomosPared(s, estado.libros.slice(enCafe), paredIzquierda(estado.nivel));
      // Bloque 4b: el escaparate con tus tres libros (nivel 5)
      if (estado.inaugurado && estado.nivel >= 5) escaparateKit(s, estado.escaparate);
      if (estado.inaugurado && estado.cajas > 0) cajaDeReparto(s);
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
    // Bloque 4a: el fondo del local según el nivel (la cortina hasta el 2; luego, la viga y el ventanal; en el 3, más)
    const n = estado.inaugurado ? estado.nivel : 1;
    telon.visible = n < 2;
    laminaPlano.visible = n < 2;
    nivel2.visible = n >= 2;
    puerto.visible = n >= 2;
    nivel3.visible = n >= 3;
    resplandor.visible = n >= 3;
    // Bloque 4b: el ala lateral (la pared de la izquierda, con sus estanterías, se va al fondo del ala) y la terraza
    altasM.visible = n >= 3;
    for (const m of [paredIzq, altasM, estanteriaVieja]) m.position.x = paredIzquierda(n);
    alaGrupo.visible = n >= 4;
    alaPilares.visible = !modo.decorar;
    const terraza = n >= 5;
    // En la terraza no llueve: la noche está despejada
    lluvia.visible = !terraza;
    frente.visible = !terraza;
    frenteAbierto.visible = terraza;
    fueraGrupo.visible = terraza;
    fachadaFuera.visible = terraza && !modo.decorar;
    toldo.visible = terraza && !modo.decorar;
    if (rotuloFuera) rotuloFuera.visible = terraza && !modo.decorar;
    cordel.visible = !terraza;
    if (terraza) abierto.visible = false;
    const clave = n >= 5 ? 5 : n >= 4 ? 4 : n >= 2 ? 2 : 1;
    for (const [k, ms] of Object.entries(rejillas)) for (const m of ms) m.visible = modo.decorar && Number(k) === clave;
    canvas.setAttribute(
      'aria-label',
      estado.inaugurado
        ? `${estado.nombre ?? 'Tu café'}, tu café-librería. Arrastra o usa las flechas para mirar; toca el suelo para andar y a Pilar, en el mostrador, para hablar con ella.`
        : 'El bajo, vacío y en traspaso. Arrastra o usa las flechas para mirar; toca el suelo para andar y a Pilar, en el mostrador, para hablar con ella.',
    );
    montarClientes();
    montarBarra();
  }
  const opcionesPaso = () => ({ limpio: estado.inaugurado, muebles: [...obstaculos, ...obstaculosClientes], nivel: estado.inaugurado ? estado.nivel : 1 });

  // ── Bloque 3 (1.121): los clientes del día, sentados en las sillas y taburetes del plano (los que esperan, sin libro y
  // con su letrero; los atendidos, leyendo el libro que les diste). Si faltan asientos, de pie junto al escaparate. ──
  const clientesGrupo = new Group();
  scene.add(clientesGrupo);
  let clientes = [];
  let pickersClientes = [];
  let obstaculosClientes = [];
  let sitiosClientes = {};
  // Bloque 4b: cuentan todos los asientos del plano (los mismos que `ASIENTOS` del catálogo, que deciden cuántos clientes vienen
  // en los niveles 4 y 5); el banco y el sofá, dos sitios. La altura del asiento, por mueble (0,5 si no se dice).
  const ALTO_ASIENTO = { 'cafe-silla': 0.51, 'cafe-taburete': 0.82, 'taburete-barra': 0.82, 'cafe-orejero': 0.5, 'cafe-silla-terraza': 0.48, sofa: 0.45, puf: 0.4 };
  const ASIENTO = Object.fromEntries(Object.entries(ASIENTOS).map(([id, n]) => [id, { n, h: ALTO_ASIENTO[id] ?? 0.5 }]));
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
      const o = enMundo(it.x, it.y);
      for (let k = 0; k < a.n; k += 1) {
        const ax = ((k + 0.5) * med.w) / a.n;
        const t = girar(med, it.rot, [ax, 0.42, 0, ax, 0.42, 0]);
        out.push({ x: o.x + t[0], y: o.y + t[1], h: a.h, facing: it.rot ?? 0 });
      }
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
  let barra = { activa: false, est: {} };
  // De 0 (tus ojos) a 1 (la vista de la barra): un paso corto, directo con movimiento reducido
  let barraT = 0;
  // La cámara de la barra va de un paso a otro (de cerca a cada objeto): «vista» es dónde está y «vistaMeta», adónde va
  let vistaMeta = ENFOQUES.general;
  let vista = { p: [...ENFOQUES.general.p], m: [...ENFOQUES.general.m] };
  const vistaQuieta = () => vista.p.every((v, k) => Math.abs(v - vistaMeta.p[k]) < 0.002) && vista.m.every((v, k) => Math.abs(v - vistaMeta.m[k]) < 0.002);
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
      barraKit(s, barra.activa ? barra.est : {});
      barraGrupo.add(new Mesh(geometryOf(s), flat));
    }
    invalidate();
  }
  let enMano = null;
  const sobreTodo = own(new MeshBasicMaterial({ vertexColors: true }));
  function ponerEnMano(lleva) {
    if (enMano) {
      camera.remove(enMano);
      enMano.geometry.dispose();
      enMano = null;
    }
    if (lleva) {
      enMano = new Mesh(geometryOf(tazaEnMano(lleva)), sobreTodo);
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
  // Bloque 4a: el recorrido de cámara al subir de nivel ({ t0, paso, puntos: [{ p, m }], fin }) o null
  let tour = null;
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
    if (!vistaQuieta()) {
      const k = reduced() ? 1 : 1 - Math.exp(-dt * 7);
      for (const c of ['p', 'm']) vista[c] = vista[c].map((v, i) => (Math.abs(vistaMeta[c][i] - v) < 0.002 ? vistaMeta[c][i] : v + (vistaMeta[c][i] - v) * k));
      moving = true;
    }
    // En Decorar de los niveles 4 y 5, desde tan arriba, la niebla se aparta: el local entero se ve con su luz
    const lejos = modo.decorar && estado.nivel >= 4;
    scene.fog.near = lejos ? 12 : 7;
    scene.fog.far = lejos ? 36 : 22;
    if (modo.decorar) {
      const { desde, hasta } = filasDe(estado.nivel);
      const c = columnasDe(estado.nivel);
      // Con la terraza, la vista llega hasta la acera
      const fin = estado.nivel >= 5 ? 10 : hasta;
      const o = enMundo((c.desde + c.hasta) / 2, (desde + fin) / 2);
      const [alto, atras, baja] = estado.nivel >= 5 ? [11.4, 5.2, 0.9] : estado.nivel >= 4 ? [10.2, 3.6, 0.1] : desde < 0 ? [8.6, 2.6, 0.2] : [6.4, 2.2, 0.4];
      camera.position.set(o.x, alto, (estado.nivel >= 5 ? enMundo(0, fin).y : SD) + atras);
      camera.lookAt(o.x, 0, o.y - baja);
    } else if (tour) {
      // El recorrido al subir de nivel: de tu vista a lo nuevo y vuelta (con movimiento reducido no hay recorrido)
      // (el reloj del cuadro puede ir unos milisegundos por detrás del inicio del recorrido)
      const ahora = Math.max(0, (now - tour.t0) / 1000);
      const tramo = Math.min(tour.puntos.length - 2, Math.floor(ahora / tour.paso));
      const u = Math.min(1, (ahora - tramo * tour.paso) / tour.paso);
      const k = u * u * (3 - 2 * u);
      const [a, b] = [tour.puntos[tramo], tour.puntos[tramo + 1]];
      const lerp = (x, y) => x.map((v, i) => v + (y[i] - v) * k);
      const p = lerp(a.p, b.p);
      const m = lerp(a.m, b.m);
      camera.position.set(p[0], p[2], p[1]);
      camera.lookAt(m[0], m[2], m[1]);
      moving = true;
      if (ahora >= tour.paso * (tour.puntos.length - 1)) {
        const fin = tour.fin;
        tour = null;
        fin?.();
      }
    } else {
      const k = barraT * barraT * (3 - 2 * barraT);
      const mezcla = (a, b) => a + (b - a) * k;
      camera.position.set(mezcla(px, vista.p[0]), mezcla(EYE, vista.p[2]), mezcla(py, vista.p[1]));
      camera.lookAt(mezcla(px + Math.sin(yaw) * 6, vista.m[0]), mezcla(EYE + Math.tan(PITCH) * 6, vista.m[2]), mezcla(py + Math.cos(yaw) * 6, vista.m[1]));
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
      const hay = id === 'libros' ? estado.inaugurado && estado.cajas > 0 : id === 'cortina' ? !(estado.inaugurado && estado.nivel >= 2) : true;
      if (tour) {
        out[id] = { ...p, visible: false };
        continue;
      }
      out[id] = { ...p, visible: hay && !walk && !modo.decorar && !barra.activa && barraT === 0 && p.front };
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
    const sitios = pickers.filter((m) => (m.userData.id === 'libros' ? estado.inaugurado && estado.cajas > 0 : m.userData.id === 'cortina' ? !(estado.inaugurado && estado.nivel >= 2) : true));
    return ray.intersectObjects(barra.activa ? pickersBarra : [...sitios, ...pickersClientes], false)[0]?.object.userData.id ?? null;
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
    return casillaValida(c.x, c.y, estado.nivel) ? c : null;
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
    settled: () => !walk && vistaQuieta() && (barra.activa ? barraT === 1 : barraT === 0),
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
    setLocal({ inaugurado = false, nombre = null, plano = { v: 1, items: [] }, libros = [], cajas = 0, vacias = false, nivel = 1, escaparate = [] } = {}) {
      const nombreAntes = estado.nombre;
      const abre = inaugurado && !estado.inaugurado;
      estado = { inaugurado, nombre, plano, libros, cajas, vacias, nivel, escaparate };
      // Las luces del ala y de la terraza alumbran lo colocado solo desde su nivel
      const n = inaugurado ? nivel : 1;
      LUCES_NIVEL = [...(n >= 4 ? [LUZ_ALA] : []), ...(n >= 5 ? [LUZ_TERRAZA] : [])];
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
    /**
     * Bloque 4a: el recorrido de cámara al subir de nivel, para enseñar lo que se ha abierto (al 2, el fondo con el ventanal;
     * al 3, además, la chimenea y las estanterías altas) y volver a tu vista. Promesa que acaba al volver. Con movimiento
     * reducido, nada (se ve al andar).
     */
    recorrido(nivel) {
      if (reduced() || nivel < 2) return Promise.resolve();
      walk = null;
      const ojo = { p: [px, py, EYE], m: [px + Math.sin(yaw) * 6, py + Math.cos(yaw) * 6, EYE + Math.tan(PITCH) * 6] };
      const puntos = [ojo];
      if (nivel === 2 || nivel === 3) puntos.push({ p: [4.2, 9.4, 3.1], m: [3.8, 1.0, 1.4] }, { p: [3.8, 5.2, 2.0], m: [3.8, 0, 2.2] });
      if (nivel === 3) puntos.push({ p: [5.2, 4.4, 2.0], m: [8.3, 0.4, 0.9] }, { p: [3.0, 4.2, 2.4], m: [0, 1.9, 2.6] });
      // Bloque 4b: al 4, el ala lateral que se abre a la izquierda; al 5, el escaparate y la terraza desde la acera
      if (nivel === 4) puntos.push({ p: [4.6, 8.6, 2.6], m: [-2.0, 5.6, 1.0] }, { p: [1.6, 3.2, 2.4], m: [-2.6, 8.4, 1.0] });
      if (nivel >= 5) puntos.push({ p: [3.4, 7.0, 2.0], m: [3.4, 14.0, 1.2] }, { p: [8.4, SD + 3.7, 2.1], m: [2.6, SD - 0.4, 1.5] }, { p: [0.8, SD + 3.5, 1.9], m: [5.2, SD + 0.6, 1.1] });
      puntos.push(ojo);
      return new Promise((fin) => {
        tour = { t0: performance.now(), paso: 1.5, puntos, fin };
        invalidate();
      });
    },
    /** ¿Está el recorrido en marcha? (para las pruebas) */
    enRecorrido: () => Boolean(tour),
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
      barra = { activa: Boolean(on), est: {} };
      vistaMeta = ENFOQUES.general;
      if (on && barraT === 0) vista = { p: [...ENFOQUES.general.p], m: [...ENFOQUES.general.m] };
      ponerEnMano(on ? null : llevar);
      montarBarra();
    },
    /**
     * Lo que se ve en la barra en este momento: { receta, gesto, pose, pulsado, hechos, vista (`vistaTaza`), elige, lista,
     * enfoque } (el enfoque, un paso o un gesto de `ENFOQUES`: la cámara se acerca a ese objeto).
     */
    setBarra(est = {}) {
      barra = { ...barra, est };
      const e = ENFOQUES[est.enfoque] ?? ENFOQUES.general;
      vistaMeta = typeof e === 'function' ? e(est) : e;
      montarBarra();
    },
    /** La taza en la mano ({ receta, vista }) o nada. */
    llevar(lleva) {
      ponerEnMano(lleva);
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
    barraEnPantalla(id, { cima = false } = {}) {
      aim(performance.now());
      const b = BARRA_COSAS[id]?.box;
      if (!b) return null;
      // `cima`: encima de la cosa (donde va la «!» de ayuda), no en su centro; en la cafetera, sobre el cuerpo y no la palanca
      const p = project((b[0] + b[3]) / 2, (b[1] + b[4]) / 2, cima ? Math.min(b[5], b[2] + 0.34) + 0.03 : (b[2] + b[5]) / 2);
      const rect = canvas.getBoundingClientRect();
      return { x: rect.left + p.x, y: rect.top + p.y, front: p.front };
    },
    /** Dónde cae en la pantalla una marca de la barra ('taza', 'manivela', 'portafiltro'…), en px de la ventana. */
    barraMarca(nombre) {
      aim(performance.now());
      const tp = tazaPos(barra.est);
      const m = nombre === 'taza' ? [tp.x, tp.y, BARRA_Z + 0.09] : BARRA_MARCAS[nombre];
      if (!m) return null;
      const p = project(...m);
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
