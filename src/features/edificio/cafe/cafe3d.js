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
import { COLORES_PELO, DEFAULT_AVATAR, PIELES, actorBoxes } from '../actor';
import { INFLUENCERS, NIVELES_INFLUENCER } from './cafeInfluencers';
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
  ruta,
  ALTAS,
  CHIMENEA,
  VENTANAL,
  ALA,
  paredIzquierda,
  BODEGA,
  BODEGA_TOSTADERO,
  BODEGA_CATAS,
  ESCALERA_CATAS,
  bodegaDe,
  escaleraDe,
  llegadaDe,
  sitioDe,
  ENFRIADOR,
  TAMBOR,
  ANTE_TOSTADOR,
  TRAMPILLA,
  ESCALERA_BODEGA,
  ANTE_TRAMPILLA,
  plantaEn,
  PUERTA_TALLER,
  ANTE_TALLER,
  TALLER,
  BANCO,
  LIBRO_BANCO,
  PRENSA_TALLER,
  CELESTINO,
} from './cafeLayout';
import { ASIENTOS, CUADRICULA, SOTANO, casillaValida, columnasDe, filasDe, medidas, sotanoDe } from './cafeCatalogo';
import { cajasDe, colorDe } from './cafeMuebles';
import { footprint } from '../room';
import { estanteLibreria } from './cafeLibreria';
import { LIBRO_TALLER, PLIEGUE, letrasTapa, manchasDe, semillaEncargo } from './cafeTallerGestos';
import { PLIEGO_PX, TAPA_PX, lienzo, pintarPliego, pintarTapa } from './cafeTallerPintura';

const ART_W = 320;
const PX = 16; // píxeles de textura por unidad en suelo, paredes y techo
const HFOV = 66;
const VFOV_LANDSCAPE = 62;
const VFOV_MAX = 90;
const PITCH = -0.06;
const DRAG = 0.005;
const KEY_STEP = 0.1;
const WALK = 2.6; // unidades por segundo
const TAP_SLOP = 12;
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
/** Bloque 6a (1.125): los dos faroles de hierro de la bodega y la luz del café que cae por la escalera. Lejos del local: no lo tocan. */
const LUZ_BODEGA = [
  { at: [42.3, 3.7, 2.55], k: 0.9, reach: 4.6 },
  { at: [44.9, 3.7, 2.55], k: 0.85, reach: 4.6 },
  { at: [46.85, 6.3, 3.3], k: 0.55, reach: 3.0 },
];
/**
 * Bloque 6b (1.127): la bodega del nivel 7, más ancha: un farol más sobre las columnas nuevas y el resplandor de la boca del
 * hogar del tostador, a ras de suelo.
 */
const LUZ_TOSTADERO = [{ at: [39.0, 3.7, 2.55], k: 0.85, reach: 4.4 }, ...LUZ_BODEGA, { at: [37.2, 1.4, 0.35], k: 0.5, reach: 1.7 }];
/**
 * Bloque 6c (1.129): la sala de catas, más ancha por la derecha: un farol más sobre las columnas nuevas y la luz del café, que
 * ahora cae por la escalera de la pared nueva.
 */
const LUZ_CATAS = [
  { at: [39.0, 3.7, 2.55], k: 0.85, reach: 4.4 },
  LUZ_BODEGA[0],
  LUZ_BODEGA[1],
  { at: [47.3, 3.7, 2.55], k: 0.85, reach: 4.4 },
  { at: [48.85, 6.9, 3.3], k: 0.55, reach: 3.0 },
  { at: [37.2, 1.4, 0.35], k: 0.5, reach: 1.7 },
];
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
/**
 * El escaparate (nivel 5): una peana de madera con tus tres libros de cara a la calle y una lamparita que los alumbra. 1.126:
 * con `portadas` (el lienzo pixelado de cada portada real, o null), la cubierta es su portada: devuelve dónde va cada una
 * ({ lienzo, x, y, z } del centro, en el mundo de la app) para pintarla encima sin suavizar.
 */
function escaparateKit(s, libros = [], portadas = []) {
  const conPortada = [];
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
    const lienzo = portadas[k];
    if (lienzo) {
      // La portada real, sobre la cubierta (a la derecha del lomo)
      conPortada.push({ lienzo, x: x + 0.02, y: y1 - 0.014, z: z + 0.44 });
      return;
    }
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
  return conPortada;
}
/** El material de cada portada del escaparate (uno por lienzo, que ya se pide una vez por URL). */
const materialPortada = new WeakMap();
function portadaMaterial(lienzo) {
  if (!materialPortada.has(lienzo)) {
    // Sin luz propia: un poco más apagada que el lienzo para que no brille más que la madera de al lado
    materialPortada.set(lienzo, new MeshBasicMaterial({ map: texture(lienzo), color: 0xe6ddd2 }));
  }
  return materialPortada.get(lienzo);
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
/** Bloque 6b (1.127): el saco del tostadero, junto a los tarros (el tueste de la casa, solo para el café). */
const SACO_BARRA = { x: 7.76, y: 5.31 };
const CANELA = { x: 7.44, y: 6.4 };
const MIEL = { x: 7.44, y: 6.6 };
/** Bloque 4a: el hornillo con el cazo de cobre del chocolate (detrás de la tetera) y el bol de la nata (junto a la miel). */
const CAZO = { x: 7.85, y: 6.68 };
const BOL = { x: 7.44, y: 6.82 };
/** Bloque 4b: al final de la barra, la tabla con la vaina de vainilla y, al fondo, la coctelera y la cubitera de latón. */
const VAINA = { x: 7.4, y: 7.12 };
const COCTELERA = { x: 7.8, y: 7.12 };
const CUBITERA = { x: 7.8, y: 7.32 };
/**
 * Bloque 6c (1.129): el mortero de piedra del chai, al principio de la barra (antes de la caja registradora), y, al final, el azucarero y el
 * soplete del brûlée.
 */
const MORTERO_BARRA = { x: 7.72, y: 4.5 };
const AZUCAR = { x: 7.4, y: 7.3 };
const SOPLETE = { x: 7.52, y: 7.4 };
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
  // Bloque 6b: el saco del tostadero, solo para el café (y el café con hielo)
  // Bloque 6c: el mortero (el chai) y el azucarero con el soplete (el brûlée)
  'barra:bebida:chai': { box: [MORTERO_BARRA.x - 0.08, MORTERO_BARRA.y - 0.07, BARRA_Z, MORTERO_BARRA.x + 0.08, MORTERO_BARRA.y + 0.07, BARRA_Z + 0.18], parte: 'bebida', valor: 'chai', carta: 'chai' },
  'barra:toque:brulee': { box: [AZUCAR.x - 0.06, AZUCAR.y - 0.06, BARRA_Z, SOPLETE.x + 0.05, SOPLETE.y + 0.06, BARRA_Z + 0.2], parte: 'toque', valor: 'brulee', carta: 'brulee' },
  'barra:grano:casa': { box: [SACO_BARRA.x - 0.08, SACO_BARRA.y - 0.08, BARRA_Z, SACO_BARRA.x + 0.08, SACO_BARRA.y + 0.08, BARRA_Z + 0.24], parte: 'grano', valor: 'casa', carta: 'casa', solo: ['cafe', 'frio'] },
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
  mortero: [MORTERO_BARRA.x, MORTERO_BARRA.y, BARRA_Z + 0.1],
  soplete: [SOPLETE.x, SOPLETE.y, BARRA_Z + 0.1],
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
  // Bloque 6c: con el chai, del mortero (al principio de la barra) a la cubitera (al final): la cámara se abre del todo
  bebida: (est) =>
    est.carta?.includes('chai')
      ? enfoque([7.7, 5.6, BARRA_Z + 0.3], 2.6)
      : est.carta?.includes('hielo')
      ? enfoque([7.72, 6.62, BARRA_Z + 0.3], 1.45)
      : est.carta?.includes('chocolate')
        ? enfoque([7.7, 6.4, BARRA_Z + 0.3], 1.15)
        : enfoque([7.68, 6.2, BARRA_Z + 0.3], 1.0),
  grano: (est) => (est.carta?.includes('casa') && ['cafe', 'frio'].includes(est.receta?.bebida) ? enfoque([7.62, 5.5, BARRA_Z + 0.14], 0.86) : enfoque([7.6, 5.6, BARRA_Z + 0.14], 0.72)),
  manivela: enfoque(BARRA_MARCAS.manivela, 0.5, { alto: 0.95 }),
  cuchara: enfoque([7.62, 5.8, BARRA_Z + 0.28], 0.85, { alto: 0.5, bajo: 0.45 }),
  apisonar: enfoque(BARRA_MARCAS.portafiltro, 0.66, { alto: 0.5, bajo: 0.55, lado: 0.5 }),
  // 1.128: más bajo en la pantalla, para que el asa no quede pegada a la comanda y haya sitio para bajarla
  palanca: enfoque([7.6, 6.02, BARRA_Z + 0.4], 1.0, { alto: 0.5, bajo: 0.22, lado: 0.75 }),
  tetera: enfoque([7.62, 6.22, BARRA_Z + 0.22], 0.95, { alto: 0.6 }),
  colador: enfoque(BARRA_MARCAS.taza, 0.55, { alto: 0.6, lado: 0.4 }),
  leche: enfoque(BARRA_MARCAS.jarras, 0.6),
  vapor: enfoque([VAPOR.x, VAPOR.y, BARRA_Z + 0.18], 0.62, { alto: 0.55 }),
  verter: enTaza(0.62, { alto: 0.85, lado: 0.35 }),
  toque: (est) =>
    est.carta?.includes('brulee')
      ? enfoque([7.44, 6.9, BARRA_Z + 0.1], 1.15)
      : est.carta?.includes('vainilla')
      ? enfoque([7.44, 6.78, BARRA_Z + 0.1], 0.95)
      : est.carta?.includes('nata')
        ? enfoque([7.44, 6.62, BARRA_Z + 0.1], 0.72)
        : enfoque(BARRA_MARCAS.toques, 0.62),
  rascar: enfoque(BARRA_MARCAS.vaina, 0.42, { alto: 1.0 }),
  // Desde el principio de la barra, de lado (de frente, la cámara se metía en lo que hay encima; desde el molinillo, en él)
  mortero: enfoque([MORTERO_BARRA.x, MORTERO_BARRA.y, BARRA_Z + 0.1], 0.65, { alto: 0.95, lado: 0.5 }),
  soplete: enTaza(0.6, { alto: 0.95, lado: 0.2 }),
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
    bebida === 'chai'
      ? grano === 'intenso'
        ? [146, 84, 44]
        : [182, 122, 70]
      : bebida === 'te'
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
            : grano === 'casa'
              ? [82, 46, 28]
              : [104, 62, 36];
  if (bebida === 'te' || bebida === 'chai') base = base.map((c, k) => Math.round([214, 198, 160][k] + (c - [214, 198, 160][k]) * color));
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
  if (v.hojas) pushBox(s, [cx - 0.02, cy - 0.02, top, cx + 0.02, cy + 0.02, top + 0.002], receta.bebida === 'chai' ? [124, 72, 40] : receta.grano === 'intenso' ? [60, 40, 28] : [110, 140, 70], o);
  // Bloque 6c: la costra de azúcar del brûlée, que pasa de blanca a dorada (y tostada en algún punto) con el soplete
  if (v.brulee > 0) {
    const d = Math.min(1, v.dorado ?? 0);
    const c0 = [238, 228, 204];
    const c1 = [198, 132, 56];
    const cc = c0.map((k, i) => Math.round(k + (c1[i] - k) * d));
    pushBox(s, [cx + i0, cy + i0, top, cx - i0, cy - i0, top + 0.005], cc, { g: 0.82 });
    if (d > 0.55)
      for (const [dx, dy] of PUNTOS_CANELA.slice(0, Math.round((d - 0.5) * 12)))
        pushBox(s, [cx + dx - 0.006, cy + dy - 0.006, top + 0.005, cx + dx + 0.006, cy + dy + 0.006, top + 0.006], [120, 66, 30], o);
  }
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
 * 1.131 (Francisco, 14-11-2026: «que cuando pilar prepara el café ella se haga más orgánico y no tan robótico»): cuando prepara
 * ella, la mano de Pilar agarra lo que se mueve. El puño en el mango (`punto`, que se mueve con `xf`) y la muñeca con el puño
 * de su jersey mostaza, que apunta hacia su lado de la barra (detrás) y se inclina con el movimiento: el hombro se queda entre
 * donde estaba el mango y donde está, así que la mano tira de la manga y no al revés. Su piel y su jersey son los de su figura
 * (`PILAR_ASPECTO`).
 */
const PIEL_PILAR = [236, 192, 152];
const MANGA_PILAR = [204, 158, 70];
function manoPilar(s, [x, y, z], { xf = null, g = 0.86, hacia = [0.8, 0.22, 0.55], largo = 0.42, manga = 0.15 } = {}) {
  const q = xf ? xf([x, z, y]) : [x, z, y];
  const [hx, hy, hz] = [q[0], q[2], q[1]];
  // El hombro: a medio camino entre el mango quieto y el que se mueve, hacia su lado de la barra (sobre todo detrás, que es
  // donde está ella; un poco a la derecha de la pantalla y algo por encima). Si subiera mucho, el brazo vendría hacia la
  // cámara y se vería como un tablón que cruza la pantalla.
  const [bx, by, bz] = [(hx + x) / 2 + hacia[0] * largo, (hy + y) / 2 + hacia[1] * largo, (hz + z) / 2 + hacia[2] * largo];
  const [dx, dy, dz] = [bx - hx, by - hy, bz - hz];
  const L = Math.hypot(dx, dy, dz) || 1;
  // La muñeca y un trozo de manga, de una pieza: una caja de pie sobre el puño, inclinada hacia el hombro (primero hacia atrás,
  // luego de lado). Solo un palmo (`manga`): a lo largo, el brazo cruzaba la pantalla y tapaba la barra; así se lee como su
  // mano, con el puño del jersey, y apunta hacia donde está ella.
  const xfB = giro([hx, hy, hz], 'y', Math.acos(Math.max(-1, Math.min(1, dz / L))), giro([hx, hy, hz], 'z', Math.atan2(dy, dx)));
  const o = { g, xf: xfB };
  const fin = Math.min(L, manga);
  pushBox(s, [hx - 0.013, hy - 0.013, hz + 0.012, hx + 0.013, hy + 0.013, hz + 0.05], PIEL_PILAR, o);
  pushBox(s, [hx - 0.022, hy - 0.022, hz + 0.045, hx + 0.022, hy + 0.022, hz + 0.075], OSCURO_DE(MANGA_PILAR, 0.8), o);
  pushBox(s, [hx - 0.02, hy - 0.02, hz + 0.075, hx + 0.02, hy + 0.02, hz + fin], MANGA_PILAR, o);
  // El puño, cerrado sobre el mango, con la línea de los nudillos y el pulgar
  const oh = { g };
  pushBox(s, [hx - 0.02, hy - 0.022, hz - 0.016, hx + 0.02, hy + 0.022, hz + 0.02], PIEL_PILAR, oh);
  pushBox(s, [hx - 0.023, hy - 0.02, hz + 0.006, hx - 0.018, hy + 0.02, hz + 0.016], OSCURO_DE(PIEL_PILAR, 0.84), oh);
  pushBox(s, [hx - 0.025, hy - 0.024, hz - 0.01, hx - 0.014, hy - 0.012, hz + 0.004], CLARO_DE(PIEL_PILAR, 8), oh);
}

/**
 * Todo lo de la barra. `est`: { receta, gesto (el que se hace ahora), pose (su postura), pulsado, hechos ({ gesto: pose }),
 * vista (`vistaTaza`), elige (la parte que se elige ahora: sus cosas, con marco), lista (taza terminada), pilar (lo prepara
 * ella: se ven sus manos) }.
 */
function barraKit(s, est = {}) {
  const { receta = {}, gesto = null, pose = {}, pulsado = false, hechos = {}, vista = {}, elige = null, lista = false, carta = [] } = est;
  const z = BARRA_Z;
  const g = 0.86;
  const o = { g };
  const te = receta.bebida === 'te' || receta.bebida === 'chai';
  const T = tazaPos(est);
  const ahora = (k) => gesto === k;
  const p = (k) => (ahora(k) ? pose : hechos[k]) ?? {};
  /** 1.131: la mano de Pilar en el mango de lo que mueve ahora, si lo prepara ella. */
  const mano = (k, punto, op = {}) => {
    if (est.pilar && ahora(k)) manoPilar(s, punto, { g, ...op });
  };

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
  mano('palanca', [7.64, 6.05, z + 0.83], { xf: xfP });
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
    const tostado = receta.grano === 'intenso' ? [58, 34, 24] : receta.grano === 'casa' ? [96, 58, 34] : [150, 98, 56];
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
  mano('manivela', [mx, my + 0.125, z + 0.31], { xf: xfM });

  // ── Bloque 6b: el saco de arpillera del tostadero, más o menos lleno según las tazas que te quedan ──
  if (carta.includes('casa')) {
    const { x: sx, y: sy } = SACO_BARRA;
    const lleno = Math.min(1, (est.tazas ?? 0) / 5);
    const h = 0.05 + 0.14 * lleno;
    const ARPILLERA = [176, 142, 94];
    for (let k = 0; k < 4; k += 1) {
      const a = k === 0 ? 0.07 : k === 3 ? 0.055 : 0.075;
      pushBox(s, [sx - a, sy - a, z + (h * k) / 4, sx + a, sy + a, z + (h * (k + 1)) / 4], k % 2 ? ARPILLERA : [164, 130, 86], o);
    }
    // La boca doblada y, si queda, el grano tostado asomando
    pushBox(s, [sx - 0.065, sy - 0.065, z + h, sx + 0.065, sy + 0.065, z + h + 0.025], [190, 158, 108], o);
    if (lleno > 0) pushBox(s, [sx - 0.045, sy - 0.045, z + h + 0.01, sx + 0.045, sy + 0.045, z + h + 0.03], [82, 46, 28], o);
    // La etiqueta de tela con la marca del café (sin letras)
    pushBox(s, [sx - 0.071, sy - 0.03, z + h * 0.35, sx - 0.07, sy + 0.03, z + h * 0.75], [226, 214, 186], o);
  }
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
    mano('apisonar', [x, y, z + 0.265], { xf: xfT });
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
    mano('tetera', [x, y, z + 0.345], { xf: xfK });
    if (ahora('tetera') && pulsado && alzada >= 0.6) chorro(s, TAZA_EN.x + 0.01, TAZA_EN.y + 0.01, z + 0.1, z + 0.3, [214, 220, 214], 0.005);
  }

  // ── El colador sobre la taza (té): con las hojas dentro; sube y baja con el dedo ──
  if (te && !hechos.colador) {
    const alto = (p('colador').altura ?? 0) * 0.05;
    const xfC = desplaza(0, 0, ahora('colador') ? alto : 0);
    const { x, y } = TAZA_EN;
    pushBox(s, [x - 0.04, y - 0.04, z + 0.13, x + 0.04, y + 0.04, z + 0.15], BRASS, { g, xf: xfC });
    pushBox(s, [x - 0.008, y + 0.04, z + 0.14, x + 0.008, y + 0.12, z + 0.15], BRASS, { g, xf: xfC });
    mano('colador', [x, y + 0.115, z + 0.16], { xf: xfC });
    if (vista.hojas) pushBox(s, [x - 0.03, y - 0.03, z + 0.15, x + 0.03, y + 0.03, z + 0.16], receta.bebida === 'chai' ? [124, 72, 40] : receta.grano === 'intenso' ? [60, 40, 28] : [110, 140, 70], { g, xf: xfC });
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
    mano('cuchara', [x - 0.15, y, zz + 0.03]);
  }

  // ── Las jarritas de leche: la elegida va bajo la lanza para cremarla y luego sobre la taza para servir ──
  for (const [tipo, y] of Object.entries(JARRAS)) {
    const mia = receta.leche === tipo;
    if (mia && ahora('vapor')) {
      const inc = pose.inclina ?? 0;
      const xf = giro([JARRA_X, y, z], 'x', inc * 0.45, desplaza(VAPOR.x - JARRA_X, VAPOR.y - y, 0.01));
      jarrita(s, JARRA_X, y, tipo, { xf, espuma: pose.espuma ?? 0 });
      mano('vapor', [JARRA_X + 0.085, y, z + 0.08], { xf });
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
      mano('verter', [JARRA_X + 0.085, y, z + 0.08], { xf });
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
    mano('agitar', [CANELA.x, CANELA.y, z + 0.06], { xf });
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
    if (ult) mano('hilo', [cx, cy, cz + 0.11], { xf: xfD });
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
    mano('cazo', [x - 0.2, y, zc + 0.09], { xf: xfZ });
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
      mano('molinillo', [mx, my, zc + 0.25]);
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
    mano('batir', [vx, vy, z + 0.21]);
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
    mano('rascar', [kx + 0.06, ky, kz + 0.022]);
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
    mano('coctelera', [x, y, z + 0.13], { xf: xfC });
    // La escarcha: se va cubriendo al agitar
    const frio = p('coctelera').agitado ?? 0;
    if (frio > 0) pushBox(s, [x - 0.041, y - 0.041, z + 0.02, x + 0.041, y + 0.041, z + 0.02 + frio * 0.14], [226, 236, 242], { g: 0.9, xf: xfC });
  }

  // ── Bloque 6c: el mortero de piedra con su mano; dentro, las especias (canela, cardamomo, clavo), que se machacan a golpes ──
  if (carta.includes('chai')) {
    const { x, y } = MORTERO_BARRA;
    const PIEDRA = [138, 132, 124];
    const PIEDRA_D = [104, 98, 92];
    pushBox(s, [x - 0.05, y - 0.05, z, x + 0.05, y + 0.05, z + 0.02], PIEDRA_D, o);
    pushBox(s, [x - 0.065, y - 0.065, z + 0.02, x + 0.065, y + 0.065, z + 0.09], PIEDRA, o);
    pushBox(s, [x - 0.068, y - 0.068, z + 0.08, x + 0.068, y + 0.068, z + 0.095], PIEDRA_D, o);
    const golpes = p('mortero').golpes ?? 0;
    const machacado = Math.min(1, golpes / 4);
    const enChai = receta.bebida === 'chai';
    // Enteras al principio; cada golpe las rompe en polvo cobrizo
    if (!enChai || machacado < 1) {
      pushBox(s, [x - 0.04, y - 0.01, z + 0.09, x + 0.03, y + 0.008, z + 0.1], [150, 86, 44], o);
      pushBox(s, [x - 0.02, y + 0.02, z + 0.09, x + 0.0, y + 0.04, z + 0.102], [140, 156, 86], o);
      pushBox(s, [x + 0.015, y - 0.035, z + 0.09, x + 0.03, y - 0.02, z + 0.104], [70, 40, 28], o);
    }
    if (enChai && machacado > 0) pushBox(s, [x - 0.05, y - 0.05, z + 0.092, x + 0.05, y + 0.05, z + 0.094 + machacado * 0.006], [128, 74, 40], o);
    // La mano: apoyada, inclinada; machacando, de pie, y abajo al golpear
    if (ahora('mortero')) {
      const baja = (pose.maza ?? 0) > 0 && pulsado;
      const zz = baja ? z + 0.07 : z + 0.13;
      pushBox(s, [x - 0.018, y - 0.018, zz, x + 0.018, y + 0.018, zz + 0.04], PIEDRA, o);
      pushBox(s, [x - 0.013, y - 0.013, zz + 0.04, x + 0.013, y + 0.013, zz + 0.15], [92, 58, 38], o);
      mano('mortero', [x, y, zz + 0.13]);
      if (baja && !reduced()) for (const [dx, dy] of [
        [-0.05, 0.03],
        [0.045, -0.02],
        [0.02, 0.05],
      ])
        pushBox(s, [x + dx - 0.004, y + dy - 0.004, z + 0.1, x + dx + 0.004, y + dy + 0.004, z + 0.108], [176, 112, 60], o);
    } else {
      const xfM = giro([x + 0.03, y, z + 0.09], 'y', 0.75);
      pushBox(s, [x - 0.005, y - 0.012, z + 0.06, x + 0.02, y + 0.012, z + 0.2], [92, 58, 38], { g, xf: xfM });
      pushBox(s, [x - 0.01, y - 0.017, z + 0.04, x + 0.025, y + 0.017, z + 0.07], PIEDRA, { g, xf: xfM });
    }
  }
  // ── Bloque 6c: el azucarero de loza y el soplete de cocina; al dorar, el soplete va sobre la taza con su llama azul ──
  if (carta.includes('brulee')) {
    const { x: ax, y: ay } = AZUCAR;
    pushBox(s, [ax - 0.04, ay - 0.04, z, ax + 0.04, ay + 0.04, z + 0.07], LOZA, o);
    pushBox(s, [ax - 0.042, ay - 0.042, z + 0.05, ax + 0.042, ay + 0.042, z + 0.056], [150, 74, 60], o);
    pushBox(s, [ax - 0.034, ay - 0.034, z + 0.07, ax + 0.034, ay + 0.034, z + 0.076], [244, 238, 222], o);
    pushBox(s, [ax - 0.008, ay - 0.008, z + 0.076, ax + 0.008, ay + 0.008, z + 0.09], [244, 238, 222], o);
    const dorando = ahora('soplete');
    const llama = dorando && pose.llama;
    const sx = dorando ? T.x + (pose.x ?? 0) * 0.035 : SOPLETE.x;
    const sy = dorando ? T.y : SOPLETE.y;
    const sz = dorando ? z + 0.2 : z;
    const ROJO = [176, 52, 40];
    if (dorando) {
      // Inclinado hacia la taza: el cuerpo encima y la boquilla hacia abajo
      pushBox(s, [sx - 0.02, sy - 0.02, sz + 0.03, sx + 0.02, sy + 0.02, sz + 0.13], ROJO, o);
      pushBox(s, [sx - 0.022, sy - 0.022, sz + 0.1, sx + 0.022, sy + 0.022, sz + 0.112], ACERO_D, o);
      pushBox(s, [sx - 0.008, sy - 0.008, sz - 0.01, sx + 0.008, sy + 0.008, sz + 0.03], BRASS, o);
      mano('soplete', [sx, sy, sz + 0.09]);
      if (llama) {
        pushBox(s, [sx - 0.009, sy - 0.009, sz - 0.045, sx + 0.009, sy + 0.009, sz - 0.01], [120, 168, 255], { glow: true });
        pushBox(s, [sx - 0.004, sy - 0.004, sz - 0.06, sx + 0.004, sy + 0.004, sz - 0.045], [220, 236, 255], { glow: true });
      }
    } else {
      pushBox(s, [sx - 0.025, sy - 0.025, sz, sx + 0.025, sy + 0.025, sz + 0.012], ACERO_D, o);
      pushBox(s, [sx - 0.02, sy - 0.02, sz + 0.012, sx + 0.02, sy + 0.02, sz + 0.12], ROJO, o);
      pushBox(s, [sx - 0.022, sy - 0.022, sz + 0.1, sx + 0.022, sy + 0.022, sz + 0.112], ACERO_D, o);
      pushBox(s, [sx - 0.008, sy - 0.03, sz + 0.12, sx + 0.008, sy + 0.012, sz + 0.14], BRASS, o);
      pushBox(s, [sx + 0.02, sy - 0.006, sz + 0.06, sx + 0.03, sy + 0.006, sz + 0.08], [40, 36, 36], o);
    }
  }

  // ── La taza, bajo el grupo ──
  taza(s, T.x, T.y, z, receta, vista, { humo: lista && !reduced() && receta.bebida !== 'frio', g });
  // Lo que se puede elegir ahora, con su marco
  if (elige)
    for (const cosa of Object.values(BARRA_COSAS))
      if (cosa.parte === elige && (!cosa.carta || carta.includes(cosa.carta)) && (!cosa.solo || cosa.solo.includes(receta.bebida))) marcoBarra(s, cosa.box, receta[elige] === cosa.valor ? [255, 226, 160] : [214, 150, 70]);
}
/**
 * La taza que llevas en la mano (en el sitio de la cámara: x a la derecha, z arriba, y hacia ti), con lo que lleve. 1.130: con
 * `paquete` (el libro ya preparado), en una bandeja, con el paquete de papel, el libro con su marcapáginas o la bolsa al lado.
 */
function tazaEnMano({ receta = {}, vista = {}, paquete = null } = {}) {
  const s = kit();
  taza(s, 0, 0, 0, receta, { ...vista, lleno: 1 }, { humo: true, g: 0.62 });
  if (paquete) {
    const o = { g: 0.62 };
    pushBox(s, [-0.36, -0.13, -0.022, 0.12, 0.13, -0.002], WOOD_L, o);
    pushBox(s, [-0.36, -0.13, -0.002, 0.12, -0.115, 0.018], WOOD, o);
    pushBox(s, [-0.36, 0.115, -0.002, 0.12, 0.13, 0.018], WOOD, o);
    const c = colorDe(paquete.titulo ?? '');
    if (paquete.forma === 'regalar') {
      pushBox(s, [-0.3, -0.1, 0, -0.12, 0.1, 0.05], KRAFT, o);
      pushBox(s, [-0.3, -0.008, 0.05, -0.12, 0.008, 0.054], CORDEL, o);
      pushBox(s, [-0.218, -0.1, 0.05, -0.202, 0.1, 0.054], CORDEL, o);
      pushBox(s, [-0.24, -0.03, 0.054, -0.18, 0.03, 0.07], CORDEL, o);
    } else if (paquete.forma === 'aqui') {
      pushBox(s, [-0.3, -0.1, 0, -0.14, 0.1, 0.035], c, o);
      pushBox(s, [-0.296, -0.096, 0.004, -0.144, 0.094, 0.031], PAPER, o);
      pushBox(s, [-0.24, 0.1, 0.012, -0.226, 0.15, 0.016], MARCA_COLOR, o);
    } else {
      pushBox(s, [-0.3, -0.07, 0, -0.12, 0.07, 0.26], KRAFT_L, o);
      pushBox(s, [-0.302, -0.072, 0.2, -0.118, 0.072, 0.26], KRAFT_D, o);
      pushBox(s, [-0.24, 0.072, 0.21, -0.18, 0.075, 0.25], TINTA, o);
    }
  }
  return s;
}

// ── 1.130: la librería (Francisco, 14-11-2026: «que quiero que le pongas especial mimo de detalle, sonido, atractivo visual y
// mecanicas»). La estantería de la pared, por secciones: una por género con ejemplares, con sus sujetalibros de hierro y su
// placa de latón, y un lomo por ejemplar (grueso según sus páginas, con sus bandas y su tejuelo). Al atender, la tabla
// extraíble que sale de la estantería con la bandeja y la taza, el rollo de papel de estraza y el cordel, el tarro de los
// marcapáginas, las bolsas de papel y el sello del café con su tampón; y el libro, envuelto, abierto o en su bolsa. ──
const KRAFT = [196, 150, 98];
const KRAFT_D = [166, 122, 76];
const KRAFT_L = [214, 176, 122];
const CORDEL = [196, 66, 60];
const CORDEL_B = [236, 222, 200];
const TINTA = [132, 50, 44];
const HIERRO = [62, 58, 66];
const MARCA_COLOR = [170, 58, 70];
const GUARDA = [222, 206, 176];
/** La altura de la tabla extraíble (entre la fila de abajo y la del pecho), cuánto sale y su ancho a cada lado. */
const TABLA_Z = 0.95;
const TABLA_SALE = 0.55;
const TABLA_MEDIA = 0.72;
const CLARO_DE = (c, d = 56) => c.map((v) => Math.min(255, v + d));
const OSCURO_DE = (c, k = 0.62) => c.map((v) => Math.round(v * k));
const hashClave = (t) => {
  let h = 2166136261;
  for (const ch of String(t)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
};
/** Un lomo de pie, de cara al local (+x): el cuerpo, las bandas de la cabeza y el pie, el tejuelo o el título, y el canto. */
function lomoKit(s, [x0, y0, z0, x1, y1, z1], c, v, o = {}) {
  pushBox(s, [x0, y0, z0, x1, y1, z1], c, o);
  const h = z1 - z0;
  const e = 0.004;
  const f = x1;
  const oro = v % 3 === 0;
  const banda = oro ? [226, 188, 108] : CLARO_DE(c, 64);
  pushBox(s, [f, y0 + 0.004, z1 - h * 0.13, f + e, y1 - 0.004, z1 - h * 0.09], banda, o);
  pushBox(s, [f, y0 + 0.004, z0 + h * 0.07, f + e, y1 - 0.004, z0 + h * 0.11], banda, o);
  if (v % 4 === 1) {
    // El tejuelo: una etiqueta clara con el título en dos rayas
    pushBox(s, [f, y0 + 0.008, z0 + h * 0.46, f + e, y1 - 0.008, z0 + h * 0.7], [232, 220, 192], o);
    pushBox(s, [f + e, y0 + 0.014, z0 + h * 0.62, f + e * 1.5, y1 - 0.014, z0 + h * 0.65], OSCURO_DE(c, 0.5), o);
    pushBox(s, [f + e, y0 + 0.014, z0 + h * 0.52, f + e * 1.5, y1 - 0.014, z0 + h * 0.55], OSCURO_DE(c, 0.5), o);
  } else {
    // El título, de arriba abajo, en una columna de rayitas claras
    const n = 3 + (v % 4);
    for (let k = 0; k < n; k += 1) {
      const z = z0 + h * (0.68 - k * 0.075);
      pushBox(s, [f, y0 + 0.012, z, f + e, y1 - 0.012, z + h * 0.035], v % 2 ? banda : CLARO_DE(c, 90), o);
    }
  }
  // El canto de las páginas, arriba, entre las tapas
  pushBox(s, [x0 + 0.03, y0 + 0.004, z1, x1 - 0.012, y1 - 0.004, z1 + 0.003], PAPER, o);
}
/** Un sujetalibros de hierro con su remate de latón. */
function sujetaKit(s, dx, y, z) {
  const { fondo } = ESTANTERIA;
  pushBox(s, [dx + 0.1, y, z, dx + fondo - 0.07, y + 0.012, z + 0.2], HIERRO);
  pushBox(s, [dx + 0.12, y - 0.004, z + 0.19, dx + fondo - 0.09, y + 0.016, z + 0.215], BRASS);
}
/**
 * Los lomos de la balda en la estantería de la pared, por secciones (`estanteLibreria`), con los sujetalibros; `sin`: la sección
 * que se está mirando al atender (esa se dibuja aparte, para que el lomo elegido pueda salir). Devuelve las placas.
 */
function lomosLibreria(s, tramos, dx = 0, { sin = null } = {}) {
  const { fondo } = ESTANTERIA;
  const placas = [];
  for (const t of tramos) {
    const z = t.z + 0.05;
    // Cada sección, en su hueco, entre dos sujetalibros
    sujetaKit(s, dx, t.y0 + 0.014, z);
    sujetaKit(s, dx, t.y1 + 0.006, z);
    if (t.placa) {
      const { y, ancho } = t.placa;
      // La placa de latón, atornillada al canto de la balda, con un filete más oscuro
      pushBox(s, [dx + fondo, y - ancho / 2 - 0.006, t.z - 0.016, dx + fondo + 0.007, y + ancho / 2 + 0.006, t.z + 0.062], [120, 86, 44]);
      placas.push({ genero: t.genero, nombre: t.nombre, y, z: t.z + 0.023, ancho, x: dx + fondo + 0.0075 });
    }
    if (t.genero === sin) continue;
    for (const l of t.lomos) lomoKit(s, [dx + 0.06, l.y0, z, dx + fondo - 0.04, l.y1, z + l.alto], colorDe(l.titulo), hashClave(l.clave));
  }
  return placas;
}
/** La placa de latón de una sección: el nombre grabado, en oscuro y sin medias tintas (si no cabe entero, rayas grabadas). */
function paintPlaca(nombre, ancho) {
  const h = 16;
  const w = Math.max(24, Math.round((ancho / 0.066) * h));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const laton = [206, 164, 90];
  const brillo = [236, 204, 136];
  const sombra = [150, 110, 56];
  const grabado = [74, 48, 26];
  ctx.fillStyle = `rgb(${laton.join(',')})`;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = `rgb(${brillo.join(',')})`;
  ctx.fillRect(1, 1, w - 2, 1);
  ctx.fillStyle = `rgb(${sombra.join(',')})`;
  ctx.fillRect(1, h - 2, w - 2, 1);
  ctx.fillRect(0, 0, 1, h);
  ctx.fillRect(w - 1, 0, 1, h);
  // Los dos tornillos
  ctx.fillStyle = `rgb(${grabado.join(',')})`;
  ctx.fillRect(2, 7, 2, 2);
  ctx.fillRect(w - 4, 7, 2, 2);
  ctx.font = 'bold 9px Georgia, serif';
  const cabe = ctx.measureText(nombre).width <= w - 12;
  if (cabe) {
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(nombre, w / 2, h / 2 + 1);
    const img = ctx.getImageData(6, 2, w - 12, h - 4);
    for (let i = 0; i < img.data.length; i += 4) {
      if (img.data[i] > 110) continue;
      img.data[i] = grabado[0];
      img.data[i + 1] = grabado[1];
      img.data[i + 2] = grabado[2];
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 6, 2);
  } else {
    ctx.fillStyle = `rgb(${grabado.join(',')})`;
    ctx.fillRect(7, 6, w - 14, 1);
    ctx.fillRect(9, 9, w - 18, 1);
  }
  return c;
}
/** La tabla extraíble, ya fuera (`D`, cuánto ha salido), con su canto, el tirador de latón y la lamparita de pinza. */
function tablaKit(s, F, yc, D, o) {
  const [y0, y1] = [yc - TABLA_MEDIA, yc + TABLA_MEDIA];
  pushBox(s, [F - 0.04, y0, TABLA_Z - 0.035, F + D, y1, TABLA_Z], WOOD_L, o);
  pushBox(s, [F + D - 0.03, y0, TABLA_Z - 0.06, F + D, y1, TABLA_Z + 0.008], WOOD_D, o);
  pushBox(s, [F + D, yc - 0.08, TABLA_Z - 0.04, F + D + 0.02, yc + 0.08, TABLA_Z - 0.02], BRASS, o);
  // Las guías de debajo
  for (const y of [y0 + 0.06, y1 - 0.08]) pushBox(s, [F - 0.04, y, TABLA_Z - 0.07, F + D - 0.04, y + 0.02, TABLA_Z - 0.035], WOOD_D, o);
  // Las vetas
  for (let k = 0; k < 4; k += 1) pushBox(s, [F, y0 + 0.2 + k * 0.33, TABLA_Z, F + D - 0.05, y0 + 0.205 + k * 0.33, TABLA_Z + 0.001], WOOD, o);
}
/** Lo de envolver, en la tabla (a su altura, a la derecha de la pantalla): el rollo y el cordel, el tarro, las bolsas y el tampón. */
function utilesKit(s, ox, yc, { bolsas = 6, sello = null, rollo = 1 } = {}, o = {}) {
  const z = TABLA_Z;
  // El rollo de papel de estraza, detrás del libro, en su soporte de madera (sale hacia ti)
  for (const y of [yc - 0.25, yc + 0.23]) pushBox(s, [ox + 0.0, y, z, ox + 0.1, y + 0.02, z + 0.12], WOOD_D, o);
  const r = 0.04 + 0.01 * rollo;
  pushBox(s, [ox + 0.05 - r, yc - 0.23, z + 0.075 - r, ox + 0.05 + r, yc + 0.23, z + 0.075 + r], KRAFT, o);
  pushBox(s, [ox + 0.05 - r * 0.8, yc - 0.231, z + 0.075 - r * 0.8, ox + 0.05 + r * 0.8, yc + 0.231, z + 0.075 + r * 0.8], KRAFT_D, o);
  pushBox(s, [ox + 0.045, yc - 0.27, z + 0.07, ox + 0.055, yc + 0.27, z + 0.08], WOOD, o);
  // La bobina del cordel, a rayas rojas y blancas
  for (let k = 0; k < 4; k += 1) pushBox(s, [ox + 0.13, yc - 0.33 + k * 0.012, z, ox + 0.19, yc - 0.33 + (k + 1) * 0.012, z + 0.06], k % 2 ? CORDEL_B : CORDEL, o);
  pushBox(s, [ox + 0.125, yc - 0.334, z + 0.06, ox + 0.195, yc - 0.28, z + 0.066], WOOD_D, o);
  // El tarro de cristal con los marcapáginas asomando
  const [tx, ty] = [ox + 0.27, yc - 0.52];
  pushBox(s, [tx - 0.05, ty - 0.05, z, tx + 0.05, ty + 0.05, z + 0.12], [150, 176, 182], o);
  pushBox(s, [tx - 0.046, ty - 0.046, z + 0.004, tx + 0.046, ty + 0.046, z + 0.1], [120, 150, 160], o);
  pushBox(s, [tx - 0.052, ty - 0.052, z + 0.115, tx + 0.052, ty + 0.052, z + 0.128], BRASS, o);
  [MARCA_COLOR, [70, 110, 86], [214, 170, 80], [86, 96, 150]].forEach((c, k) =>
    pushBox(s, [tx - 0.03 + k * 0.018, ty - 0.012 + (k % 2) * 0.01, z + 0.04, tx - 0.02 + k * 0.018, ty + 0.012 + (k % 2) * 0.01, z + 0.17 + (k % 3) * 0.015], c, o),
  );
  // Las bolsas de papel, plegadas y apiladas
  for (let k = 0; k < Math.max(1, bolsas); k += 1) pushBox(s, [ox + 0.37, yc - 0.66, z + k * 0.006, ox + 0.52, yc - 0.42, z + (k + 1) * 0.006], k % 2 ? KRAFT_L : CLARO_DE(KRAFT_L, 10), o);
  pushBox(s, [ox + 0.43, yc - 0.56, z + Math.max(1, bolsas) * 0.006, ox + 0.47, yc - 0.52, z + Math.max(1, bolsas) * 0.006 + 0.002], TINTA, o);
  // El tampón y, si no está en la mano, el sello encima
  pushBox(s, [ox + 0.39, yc - 0.37, z, ox + 0.51, yc - 0.25, z + 0.016], HIERRO, o);
  pushBox(s, [ox + 0.4, yc - 0.36, z + 0.016, ox + 0.5, yc - 0.26, z + 0.019], [104, 40, 36], o);
  if (!sello) selloKit(s, ox + 0.27, yc - 0.32, z, 0, o);
}
/** El sello del café: la goma de tinta, el taco y el pomo de madera. `presion`, cuánto se aplasta al apretar. */
function selloKit(s, x, y, z, presion = 0, o = {}) {
  const ap = 0.006 * presion;
  pushBox(s, [x - 0.032, y - 0.032, z, x + 0.032, y + 0.032, z + 0.012 - ap], TINTA, o);
  pushBox(s, [x - 0.03, y - 0.03, z + 0.012 - ap, x + 0.03, y + 0.03, z + 0.036 - ap], WOOD, o);
  pushBox(s, [x - 0.012, y - 0.012, z + 0.036 - ap, x + 0.012, y + 0.012, z + 0.08 - ap], WOOD_L, o);
  pushBox(s, [x - 0.02, y - 0.02, z + 0.08 - ap, x + 0.02, y + 0.02, z + 0.1 - ap], WOOD_L, o);
}
/** La marca del sello en una superficie horizontal: el cuadrado de tinta con su taza dentro. */
function marcaSello(s, x, y, z, o = {}) {
  pushBox(s, [x - 0.03, y - 0.03, z, x + 0.03, y + 0.03, z + 0.0015], TINTA, o);
  pushBox(s, [x - 0.022, y - 0.022, z + 0.0015, x + 0.022, y + 0.022, z + 0.002], [212, 168, 120], o);
  pushBox(s, [x - 0.008, y - 0.012, z + 0.002, x + 0.012, y + 0.01, z + 0.0025], TINTA, o);
  pushBox(s, [x + 0.012, y - 0.004, z + 0.002, x + 0.018, y + 0.004, z + 0.0025], TINTA, o);
}
/** Un tramo de cordel a rayas (de `a` a `b` sobre el eje `eje`, en la otra coordenada `c` y a la altura `z`). */
function cordelKit(s, eje, a, b, c, z, o = {}) {
  const paso = 0.03;
  for (let t = a, k = 0; t < b - 0.001; t += paso, k += 1) {
    const u = Math.min(b, t + paso);
    pushBox(s, eje === 'x' ? [t, c - 0.006, z, u, c + 0.006, z + 0.006] : [c - 0.006, t, z, c + 0.006, u, z + 0.006], k % 2 ? CORDEL_B : CORDEL, o);
  }
}
const suaveT = (t) => 1 - (1 - clamp(t, 0, 1)) ** 3;
/**
 * El libro en la tabla y lo que se le hace según la forma (`e.forma`) y los gestos (`e.gesto` con `e.pose`, el que se hace
 * ahora; `e.hechos`, los ya hechos). `B`: dónde está y cómo es ({ cx, cy, z, alto, ancho, g, c }); tumbado, la cabeza de la
 * portada mira a la estantería (-x) y el lomo queda a la izquierda de la pantalla (+y). Devuelve dónde va la portada real
 * ({ x, y, z, w, h, de: 'arriba' | 'frente' }, o null si no se ve) y dónde cae el sello (`objetivo`).
 */
function libroKit(s, B, e, o = {}) {
  const v = (n) => (e.gesto === n ? e.pose : e.hechos?.[n]) ?? null;
  const { cx, cy, alto, ancho, g, c } = B;
  const z0 = B.z;
  const [bx0, bx1, by0, by1] = [cx - alto / 2, cx + alto / 2, cy - ancho / 2, cy + ancho / 2];
  const claro = CLARO_DE(c, 70);
  const forma = e.forma;
  const sellado = Boolean(v('sello')?.sellado);
  // ── Para llevar: la bolsa abierta y el libro, de pie, que baja dentro ──
  if (forma === 'llevar' && v('bolsa')?.abierta) {
    const soplo = e.soplo ?? 1;
    // De un soplido: crece con un rebote pequeño
    const k = soplo >= 1 ? 1 : 1 + Math.sin(soplo * Math.PI) * 0.12 - (1 - soplo) * 0.7;
    const H = (alto + 0.07) * Math.max(0.15, k);
    const gx = g / 2 + 0.022;
    const gy = ancho / 2 + 0.025;
    const pl = v('pliegue')?.doblado ?? 0;
    const zt = z0 + alto + 0.004;
    const alta = pl > 0 ? Math.min(H, zt - z0) : H;
    pushBox(s, [cx - gx, cy - gy, z0, cx + gx, cy + gy, z0 + 0.004], KRAFT_D, o);
    pushBox(s, [cx + gx, cy - gy, z0, cx + gx + 0.004, cy + gy, z0 + alta], KRAFT_L, o);
    pushBox(s, [cx - gx - 0.004, cy - gy, z0, cx - gx, cy + gy, z0 + alta], KRAFT_L, o);
    pushBox(s, [cx - gx - 0.004, cy - gy - 0.004, z0, cx + gx + 0.004, cy - gy, z0 + alta], KRAFT, o);
    pushBox(s, [cx - gx - 0.004, cy + gy, z0, cx + gx + 0.004, cy + gy + 0.004, z0 + alta], KRAFT, o);
    // El pliegue del fuelle en la cara de delante y el borde dentado de arriba
    pushBox(s, [cx + gx + 0.004, cy - gy, z0 + alta * 0.18, cx + gx + 0.0055, cy + gy, z0 + alta * 0.2], KRAFT_D, o);
    if (pl <= 0) for (let y = cy - gy; y < cy + gy - 0.01; y += 0.024) pushBox(s, [cx + gx, y, z0 + alta, cx + gx + 0.0045, y + 0.012, z0 + alta + 0.006], KRAFT_L, o);
    // El libro, de pie, de cara a ti, bajando a la bolsa
    const dentro = v('meter')?.dentro ?? 0;
    const zb = z0 + 0.004 + (1 - suaveT(dentro)) * (H + 0.05);
    pushBox(s, [cx - g / 2, cy - ancho / 2, zb, cx + g / 2, cy + ancho / 2, zb + alto], c, o);
    pushBox(s, [cx - g / 2 + 0.003, cy - ancho / 2 + 0.003, zb + alto, cx + g / 2 - 0.003, cy + ancho / 2 - 0.006, zb + alto + 0.002], PAPER, o);
    let objetivo = [cx, cy, zt + 0.005];
    if (pl > 0) {
      // El borde de la bolsa, cerrado y doblado hacia ti
      const t = 2 * gx + 0.008;
      pushBox(s, [cx - gx - 0.004, cy - gy - 0.004, zt, cx + gx + 0.004, cy + gy + 0.004, zt + 0.004], KRAFT_D, o);
      pushBox(s, [cx + gx + 0.004 - t, cy - gy - 0.004, zt, cx + gx + 0.004, cy + gy + 0.004, zt + 0.07], KRAFT_L, { ...o, xf: giro([cx + gx + 0.004, cy, zt], 'y', Math.PI * suaveT(pl)) });
      objetivo = [cx + 0.01, cy, zt + 0.005];
      if (sellado) {
        // El precinto del sello: arriba y bajando por la solapa
        marcaSello(s, cx + 0.005, cy, zt + 0.0045, o);
        pushBox(s, [cx + gx + 0.004 + t, cy - 0.02, zt - 0.06, cx + gx + 0.0055 + t, cy + 0.02, zt - 0.005], TINTA, o);
      }
    }
    const asoma = zb + alto > z0 + alta - 0.01;
    return { portada: asoma || dentro < 0.98 ? { x: cx + g / 2 + 0.0008, y: cy, z: zb + alto / 2, w: ancho * 0.96, h: alto * 0.96, de: 'frente' } : null, objetivo };
  }
  // ── Para regalar: el papel de estraza debajo, las solapas que se doblan y el cordel ──
  const papel = forma === 'regalar' ? v('papel') : null;
  const dob = forma === 'regalar' ? v('doblar') : null;
  const sobre = papel ? 0.002 : 0;
  const zl = z0 + sobre;
  const top = zl + g;
  if (papel) {
    const largo = papel.rasgado ? 1 : clamp(papel.papel, 0, 1);
    const [sx0, sy0, sy1] = [cx - 0.21, cy - 0.23, cy + 0.23];
    const sx1 = sx0 + 0.43 * largo;
    const f1 = dob ? clamp(dob.pliegues, 0, 1) : 0;
    const f2 = dob ? clamp(dob.pliegues - 1, 0, 1) : 0;
    if (f2 >= 1) {
      // Envuelto: el paquete, con su costura y los extremos remetidos
      pushBox(s, [bx0 - 0.012, by0 - 0.004, z0, bx1 + 0.014, by1 + 0.004, top + 0.006], KRAFT, o);
      pushBox(s, [bx0 - 0.012, cy + 0.02, top + 0.006, bx1 + 0.014, cy + 0.027, top + 0.0072], KRAFT_D, o);
      for (const x of [bx0 - 0.014, bx1 + 0.014]) pushBox(s, [x, by0 + 0.01, z0 + g * 0.35, x + 0.002, by1 - 0.01, z0 + g * 0.65], KRAFT_D, o);
    } else {
      // El papel: lo que va bajo el libro y las dos solapas, que se doblan por encima (la de la derecha primero)
      pushBox(s, [sx0, Math.max(sy0, by0), z0, sx1, Math.min(sy1, by1), z0 + 0.002], KRAFT, o);
      // Cada solapa sube por el canto del libro (la primera mitad) y se tumba encima (la segunda); `lado`: -1, la de la derecha
      // de la pantalla (-y); 1, la de la izquierda. `alza`: la segunda queda un poco por encima de la primera.
      const solapa = (lado, f, alza) => {
        const borde = lado < 0 ? by0 : by1;
        const m = lado < 0 ? by0 - sy0 : sy1 - by1;
        const tramo = (len, z) => (lado < 0 ? [sx0, borde - len, z, sx1, borde, z + 0.002] : [sx0, borde, z, sx1, borde + len, z + 0.002]);
        if (f <= 0) return pushBox(s, tramo(m, z0), KRAFT_L, o);
        if (f <= 0.5) return pushBox(s, tramo(m, z0), KRAFT_L, { ...o, xf: giro([cx, borde, z0], 'x', lado * (Math.PI / 2) * suaveT(f / 0.5)) });
        pushBox(s, lado < 0 ? [sx0, by0 - 0.002, z0, sx1, by0, top] : [sx0, by1, z0, sx1, by1 + 0.002, top], KRAFT_L, o);
        return pushBox(s, tramo(Math.max(0.02, m - g), top + alza), KRAFT_L, { ...o, xf: giro([cx, borde, top + alza], 'x', lado * (Math.PI / 2) * (1 + suaveT((f - 0.5) / 0.5))) });
      };
      solapa(-1, f1, 0.003);
      solapa(1, f2, 0.006);
      // El borde rasgado, con sus fibras
      if (papel.rasgado) for (let y = sy0; y < sy1 - 0.01; y += 0.028) pushBox(s, [sx1 - 0.006, y, z0 + 0.0005, sx1 + 0.004 * ((Math.round(y * 100) % 3) - 1), y + 0.014, z0 + 0.0025], KRAFT_L, o);
    }
    if (f2 >= 1) {
      const cor = v('cordel');
      const a = cor ? clamp(cor.atado ?? 0, 0, 1) : 0;
      const zt = top + 0.006;
      if (a > 0) cordelKit(s, 'x', bx0 - 0.014, bx0 - 0.014 + (bx1 - bx0 + 0.03) * Math.min(1, a * 2), cy - 0.004, zt, o);
      if (a > 0.5) cordelKit(s, 'y', by0 - 0.006, by0 - 0.006 + (by1 - by0 + 0.012) * Math.min(1, (a - 0.5) * 2), cx, zt + 0.001, o);
      if (a >= 1) {
        // El lazo: dos lazadas, el nudo y las dos puntas
        pushBox(s, [cx - 0.012, cy - 0.058, zt + 0.007, cx + 0.012, cy - 0.01, zt + 0.026], CORDEL, o);
        pushBox(s, [cx - 0.012, cy + 0.006, zt + 0.007, cx + 0.012, cy + 0.054, zt + 0.026], CORDEL, o);
        pushBox(s, [cx - 0.006, cy - 0.044, zt + 0.011, cx + 0.006, cy - 0.024, zt + 0.027], CORDEL_B, o);
        pushBox(s, [cx - 0.006, cy + 0.02, zt + 0.011, cx + 0.006, cy + 0.04, zt + 0.027], CORDEL_B, o);
        pushBox(s, [cx - 0.011, cy - 0.011, zt + 0.006, cx + 0.011, cy + 0.009, zt + 0.024], CORDEL_B, o);
        pushBox(s, [cx + 0.008, cy - 0.032, zt + 0.006, cx + 0.07, cy - 0.022, zt + 0.01], CORDEL, o);
        pushBox(s, [cx + 0.008, cy + 0.016, zt + 0.006, cx + 0.062, cy + 0.026, zt + 0.01], CORDEL, o);
      }
      if (sellado) marcaSello(s, bx0 + 0.06, by0 + 0.055, zt + 0.0005, o);
      return { portada: null, objetivo: [bx0 + 0.06, by0 + 0.055, zt + 0.001] };
    }
  }
  // ── El libro tumbado: la contratapa, las páginas, el lomo y la tapa (que se abre para leerlo aquí) ──
  const ab = forma === 'aqui' ? (v('abrir')?.abierto ?? 0) * (1 - (e.cerrar ?? 0)) : 0;
  pushBox(s, [bx0, by0, zl, bx1, by1, zl + 0.005], c, o);
  pushBox(s, [bx0 + 0.005, by0 + 0.003, zl + 0.005, bx1 - 0.005, by1 - 0.007, top - 0.005], PAPER, o);
  // Las hojas, en el canto de delante
  for (let k = 1; k < 4; k += 1) pushBox(s, [bx1 - 0.005, by0 + 0.006, zl + 0.005 + (g - 0.01) * (k / 4), bx1 - 0.004, by1 - 0.01, zl + 0.0056 + (g - 0.01) * (k / 4)], [200, 188, 164], o);
  pushBox(s, [bx0, by1 - 0.008, zl, bx1, by1, top], OSCURO_DE(c, 0.82), o);
  const ptop = top - 0.005;
  if (ab > 0.02) {
    // La primera página, con sus renglones
    for (let x = bx0 + 0.05; x < bx1 - 0.04; x += 0.028) pushBox(s, [x, by0 + 0.03, ptop, x + 0.006, by1 - 0.035, ptop + 0.0006], [150, 138, 120], o);
    if (sellado) marcaSello(s, bx0 + 0.055, by0 + 0.05, ptop + 0.0008, o);
  }
  const ang = -Math.PI * suaveT(ab);
  const xfTapa = ab > 0 ? { ...o, xf: giro([cx, by1, top], 'x', ang, (p) => [p[0], p[1] - (g - 0.006) * suaveT(ab), p[2]]) } : o;
  pushBox(s, [bx0, by0, top - 0.003, bx1, by1, top], c, xfTapa);
  pushBox(s, [bx0 + 0.003, by0 + 0.003, top - 0.005, bx1 - 0.003, by1 - 0.003, top - 0.003], GUARDA, xfTapa);
  if (!e.portada && ab <= 0.02) {
    // Sin portada real, la tapa de color con su recuadro y el título en bandas (la cabeza, hacia la estantería)
    pushBox(s, [bx0 + 0.018, by0 + 0.018, top, bx1 - 0.018, by1 - 0.018, top + 0.0008], claro, o);
    pushBox(s, [bx0 + 0.026, by0 + 0.026, top + 0.0008, bx1 - 0.026, by1 - 0.026, top + 0.0012], c, o);
    pushBox(s, [bx0 + 0.05, by0 + 0.04, top + 0.0012, bx0 + 0.085, by1 - 0.04, top + 0.0016], claro, o);
    pushBox(s, [bx0 + 0.1, by0 + 0.06, top + 0.0012, bx0 + 0.118, by1 - 0.06, top + 0.0016], claro, o);
  }
  // El marcapáginas: baja desde el tarro y se queda entre las hojas, con la borla asomando por delante
  const mk = forma === 'aqui' ? v('marca') : null;
  if (mk) {
    if ((e.cerrar ?? 0) > 0.5) {
      pushBox(s, [bx1 - 0.01, by1 - 0.042, zl + g * 0.5, bx1 + 0.05, by1 - 0.018, zl + g * 0.5 + 0.002], MARCA_COLOR, o);
      pushBox(s, [bx1 + 0.05, by1 - 0.036, zl + g * 0.5 - 0.004, bx1 + 0.068, by1 - 0.024, zl + g * 0.5 + 0.006], [226, 186, 100], o);
    } else {
      const d = suaveT(mk.dentro ?? 0);
      const [dx, dz] = [-0.24 * (1 - d), 0.09 * (1 - d) ** 1.5];
      pushBox(s, [bx0 + 0.012 + dx, by1 - 0.042, ptop + 0.001 + dz, bx1 + 0.05 + dx, by1 - 0.018, ptop + 0.0026 + dz], MARCA_COLOR, o);
      pushBox(s, [bx1 + 0.05 + dx, by1 - 0.036, ptop - 0.002 + dz, bx1 + 0.068 + dx, by1 - 0.024, ptop + 0.008 + dz], [226, 186, 100], o);
    }
  }
  const tapada = forma === 'regalar' && dob && dob.pliegues > 0.4;
  return { portada: ab <= 0.02 && !tapada ? { x: cx, y: cy, z: top + 0.0006, w: ancho * 0.96, h: alto * 0.96, de: 'arriba' } : null, objetivo: forma === 'aqui' ? [bx0 + 0.055, by0 + 0.05, ptop + 0.001] : [cx, cy, top] };
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

// ── 1.132 (§16.2): el influencer y sus fotos firmadas ──
/** Una caja en las coordenadas de la figura (x a su derecha, y hacia donde mira), girada como ella (`facing`) y llevada a (cx, cy). */
function cajaDe([x0, y0, z0, x1, y1, z1], facing, cx, cy) {
  const f = [(x, y) => [x, y], (x, y) => [-y, x], (x, y) => [-x, -y], (x, y) => [y, -x]][facing & 3];
  const p = f(x0, y0);
  const q = f(x1, y1);
  return [Math.min(p[0], q[0]) + cx, Math.min(p[1], q[1]) + cy, z0, Math.max(p[0], q[0]) + cx, Math.max(p[1], q[1]) + cy, z1];
}
const NEGRO_INF = [36, 34, 40];
const PLATA_INF = [190, 196, 206];
const BLANCO_INF = [246, 240, 230];
const ROJO_REC = [229, 72, 60];
/**
 * Lo que solo llevan los influencers (no es ninguna prenda): lo de la cabeza y lo que tienen en la mano derecha (el palo del
 * móvil, el anillo de luz, la libreta, la cámara, los auriculares y el micro, el cuenco de cata o su libro), un aro redondo de
 * píxel de su color en el suelo (el del excéntrico es cuadrado y con chispas) y, mientras espera, la lucecita roja «REC»
 * sobre la cabeza. `boxes`: las cajas de la figura ya en el mundo; (sx, sy) y `facing`: dónde está y adónde mira.
 */
function adornoInfluencer(s, boxes, { accesorio, tema }, sx, sy, facing = 2, espera = false) {
  const all = boxes.map((b) => b.b);
  const top = Math.max(...all.map((b) => b[5]));
  const cabeza = all.filter((b) => b[5] > top - 0.3);
  const hx = (Math.min(...cabeza.map((b) => b[0])) + Math.max(...cabeza.map((b) => b[3]))) / 2;
  const hy = (Math.min(...cabeza.map((b) => b[1])) + Math.max(...cabeza.map((b) => b[4]))) / 2;
  const t = top - 0.02;
  const o = { g: glowAt(sx, sy, 1.2) + 0.06 };
  const oscuro = tema.map((c) => Math.round(c * 0.55));
  const claro = tema.map((c) => Math.min(255, c + 40));
  // En la cabeza (alrededor de su centro) y en la mano (a su derecha, un poco por delante)
  const enCabeza = (b, c, op = o) => pushBox(s, cajaDe(b, facing, hx, hy), c, op);
  const enMano = (b, c, op = o) => pushBox(s, cajaDe(b, facing, sx, sy), c, op);
  const m = top - 0.66;
  if (accesorio === 'palo') {
    // La gorra de visera y el palo del móvil, con la pantalla encendida mirándola
    enCabeza([-0.19, -0.19, t, 0.19, 0.19, t + 0.08], tema);
    enCabeza([-0.16, 0.17, t, 0.16, 0.34, t + 0.03], oscuro);
    enMano([0.33, 0.18, m, 0.36, 0.21, top + 0.16], PLATA_INF);
    enMano([0.27, 0.15, top + 0.12, 0.43, 0.21, top + 0.4], NEGRO_INF);
    enMano([0.29, 0.145, top + 0.15, 0.41, 0.15, top + 0.37], [214, 236, 246], { glow: true });
  } else if (accesorio === 'aro') {
    // El gorro de lana con su pompón y el anillo de luz en su palo
    enCabeza([-0.19, -0.19, t - 0.02, 0.19, 0.19, t + 0.12], tema);
    enCabeza([-0.2, -0.2, t - 0.04, 0.2, 0.2, t + 0.01], oscuro);
    enCabeza([-0.05, -0.05, t + 0.12, 0.05, 0.05, t + 0.2], BLANCO_INF);
    enMano([0.35, 0.2, m, 0.38, 0.23, top - 0.06], NEGRO_INF);
    const [cx, cz, r, e] = [0.365, top + 0.12, 0.19, 0.045];
    const luz = [255, 246, 222];
    enMano([cx - r, 0.19, cz + r - e, cx + r, 0.24, cz + r], luz, { glow: true });
    enMano([cx - r, 0.19, cz - r, cx + r, 0.24, cz - r + e], luz, { glow: true });
    enMano([cx - r, 0.19, cz - r, cx - r + e, 0.24, cz + r], luz, { glow: true });
    enMano([cx + r - e, 0.19, cz - r, cx + r, 0.24, cz + r], luz, { glow: true });
  } else if (accesorio === 'libreta') {
    // La boina y la libreta roja con su lápiz
    enCabeza([-0.22, -0.2, t, 0.21, 0.21, t + 0.06], tema);
    enCabeza([-0.02, -0.02, t + 0.06, 0.02, 0.02, t + 0.11], oscuro);
    enMano([0.22, 0.12, m, 0.4, 0.17, m + 0.25], tema);
    enMano([0.235, 0.17, m + 0.015, 0.385, 0.175, m + 0.235], BLANCO_INF);
    enMano([0.41, 0.13, m + 0.04, 0.435, 0.155, m + 0.32], [236, 196, 84]);
  } else if (accesorio === 'camara') {
    // La gorra plana y la cámara de fotos, con el objetivo hacia delante y el flash
    enCabeza([-0.19, -0.19, t, 0.19, 0.19, t + 0.07], oscuro);
    enCabeza([-0.17, 0.15, t, 0.17, 0.3, t + 0.03], oscuro.map((c) => Math.round(c * 0.8)));
    enMano([0.2, 0.1, m + 0.06, 0.45, 0.25, m + 0.22], NEGRO_INF);
    enMano([0.27, 0.25, m + 0.09, 0.38, 0.34, m + 0.19], PLATA_INF);
    enMano([0.29, 0.34, m + 0.11, 0.36, 0.345, m + 0.17], [70, 110, 150], { glow: true });
    enMano([0.38, 0.12, m + 0.22, 0.43, 0.17, m + 0.26], BLANCO_INF, { glow: true });
    enMano([0.2, 0.14, m + 0.22, 0.24, 0.17, top - 0.2], tema);
  } else if (accesorio === 'auriculares') {
    // Los auriculares (la diadema y los dos cascos de su color) y el micro de mano
    enCabeza([-0.21, -0.03, t - 0.01, 0.21, 0.03, t + 0.05], NEGRO_INF);
    enCabeza([-0.26, -0.08, top - 0.32, -0.18, 0.08, top - 0.12], tema, { glow: true });
    enCabeza([0.18, -0.08, top - 0.32, 0.26, 0.08, top - 0.12], tema, { glow: true });
    enMano([0.3, 0.16, m, 0.35, 0.21, m + 0.2], NEGRO_INF);
    enMano([0.28, 0.14, m + 0.2, 0.37, 0.23, m + 0.3], PLATA_INF);
  } else if (accesorio === 'cata') {
    // El sombrero pequeño con su cinta y el cuenco de cata con la cuchara
    enCabeza([-0.24, -0.24, t, 0.24, 0.24, t + 0.03], oscuro);
    enCabeza([-0.16, -0.16, t + 0.03, 0.16, 0.16, t + 0.17], oscuro);
    enCabeza([-0.165, -0.165, t + 0.04, 0.165, 0.165, t + 0.08], claro);
    enMano([0.22, 0.12, m + 0.02, 0.4, 0.3, m + 0.1], BLANCO_INF);
    enMano([0.24, 0.14, m + 0.1, 0.38, 0.28, m + 0.106], [70, 40, 24]);
    enMano([0.38, 0.2, m + 0.06, 0.41, 0.23, m + 0.32], PLATA_INF);
  } else {
    // La autora: el sombrero de ala ancha y su guía en la mano, con el título dorado
    enCabeza([-0.3, -0.3, t, 0.3, 0.3, t + 0.03], tema);
    enCabeza([-0.17, -0.17, t + 0.03, 0.17, 0.17, t + 0.19], tema);
    enCabeza([-0.175, -0.175, t + 0.04, 0.175, 0.175, t + 0.08], oscuro);
    enMano([0.22, 0.1, m, 0.42, 0.16, m + 0.29], tema);
    enMano([0.25, 0.16, m + 0.19, 0.39, 0.165, m + 0.22], [236, 190, 90], { glow: true });
  }
  // Mientras espera, la lucecita «REC» sobre la cabeza (una placa oscura con el punto rojo encendido)
  if (espera) {
    pushBox(s, [hx - 0.13, hy - 0.03, top + 0.34, hx + 0.13, hy + 0.03, top + 0.46], NEGRO_INF, o);
    pushBox(s, [hx - 0.1, hy - 0.04, top + 0.37, hx - 0.04, hy + 0.04, top + 0.43], ROJO_REC, { glow: true });
    pushBox(s, [hx - 0.01, hy - 0.035, top + 0.385, hx + 0.1, hy + 0.035, top + 0.415], BLANCO_INF, o);
  }
  // El aro del suelo: un círculo de píxeles de su color
  const r = 0.58;
  const p = 0.05;
  for (let i = -r - p; i <= r + p; i += p)
    for (let j = -r - p; j <= r + p; j += p) {
      const d = Math.hypot(i + p / 2, j + p / 2);
      if (Math.abs(d - r) < p * 0.62) pushBox(s, [sx + i, sy + j, 0.012, sx + i + p, sy + j + p, 0.02], tema, { glow: true });
    }
}

/** Dónde cuelga cada foto firmada: en el hueco del cartel viejo de la pared de la derecha, 4 arriba y 3 abajo (una por nivel). */
const FOTOS = (() => {
  const [w, h, hueco] = [0.36, 0.46, 0.08];
  const fila = (niveles, z0) => niveles.map((n, k) => ({ nivel: n, y0: 9.3 - (niveles.length * w + (niveles.length - 1) * hueco) / 2 + k * (w + hueco), z0, w, h }));
  return [...fila(NIVELES_INFLUENCER.slice(0, 4), 3.21), ...fila(NIVELES_INFLUENCER.slice(4), 2.63)];
})();
/**
 * Las fotos enmarcadas y firmadas de los influencers que se hicieron virales (`niveles`); donde falta una, solo su clavo. Un
 * retrato pequeño en su color, el paspartú y la firma a tinta.
 */
function fotosKit(s, niveles = []) {
  const x = SW - 0.006;
  for (const f of FOTOS) {
    const [y0, y1, z0, z1] = [f.y0, f.y0 + f.w, f.z0, f.z0 + f.h];
    const yc = (y0 + y1) / 2;
    const o = { g: glowAt(SW - 0.4, yc, (z0 + z1) / 2) + 0.05 };
    // La foto y el paspartú, algo más claros que la pared (papel satinado): que se lea quién es aunque la luz quede lejos
    const op = { g: Math.min(1, o.g + 0.22) };
    const ficha = INFLUENCERS[f.nivel];
    if (!niveles.includes(f.nivel) || !ficha) {
      pushBox(s, [x - 0.04, yc - 0.014, z1 - 0.06, x, yc + 0.014, z1 - 0.032], [70, 64, 60], o);
      continue;
    }
    const piel = PIELES[ficha.avatar.piel]?.color ?? PIELES[1].color;
    const pelo = COLORES_PELO[ficha.avatar.colorPelo]?.color ?? COLORES_PELO[0].color;
    const tema = ficha.tema;
    // El clavo, el marco de nogal y el paspartú
    pushBox(s, [x - 0.03, yc - 0.012, z1 + 0.01, x, yc + 0.012, z1 + 0.036], [70, 64, 60], o);
    pushBox(s, [x - 0.04, y0, z0, x, y1, z1], [92, 58, 36], o);
    pushBox(s, [x - 0.046, y0 + 0.03, z0 + 0.03, x - 0.04, y1 - 0.03, z1 - 0.03], [240, 228, 200], op);
    // La foto: su color de fondo, los hombros con su jersey del color del tema, la cabeza y el pelo
    const fx = x - 0.05;
    pushBox(s, [fx, y0 + 0.06, z0 + 0.11, x - 0.046, y1 - 0.06, z1 - 0.06], tema.map((c) => Math.min(255, Math.round(c * 0.45 + 140))), op);
    pushBox(s, [fx - 0.004, y0 + 0.09, z0 + 0.11, fx, y1 - 0.09, z0 + 0.2], tema.map((c) => Math.round(c * 0.7)), op);
    pushBox(s, [fx - 0.004, yc - 0.05, z0 + 0.2, fx, yc + 0.05, z0 + 0.3], piel, op);
    pushBox(s, [fx - 0.006, yc - 0.055, z0 + 0.28, fx, yc + 0.055, z0 + 0.32], pelo, op);
    // La firma, a tinta sobre el paspartú
    pushBox(s, [x - 0.048, y0 + 0.07, z0 + 0.06, x - 0.046, yc + 0.01, z0 + 0.075], [52, 40, 70], op);
    pushBox(s, [x - 0.048, yc - 0.01, z0 + 0.07, x - 0.046, y1 - 0.08, z0 + 0.085], [52, 40, 70], op);
  }
}

// ── Bloque 6a (1.125): la bodega del sótano (nivel 6) y la trampilla de detrás de la barra ──
const LADRILLO = [150, 84, 62];
const MORTERO = [168, 150, 126];
const LOSA = [128, 118, 104];
const ROBLE = [128, 82, 50];
const ROBLE_D = [92, 58, 36];
const HIERRO_B = [58, 52, 52];
const BOTELLA = [44, 74, 58];
/** Ladrillo visto a soga (medio ladrillo de desfase por hilada) sobre un zócalo de piedra; `a`, a lo ancho y `b`, altura. */
function ladrilloPx(a, b, g, ix, iy) {
  const r = probe();
  if (b < 0.5) {
    const piedra = r.rampOf(LOSA);
    const hilada = Math.floor(b / 0.25);
    const u = frac((a + (hilada % 2) * 0.35) / 0.7);
    if (u < 0.05 || frac(b / 0.25) < 0.1) return lit(piedra[1], g, ix, iy);
    return lit(piedra[noise(a * 3, b * 3) > 0.72 ? 2 : 3], g, ix, iy);
  }
  const ramp = r.rampOf(LADRILLO);
  const hilada = Math.floor(b / 0.25);
  const desfase = hilada % 2 ? 0.25 : 0;
  const u = frac((a + desfase) / 0.5);
  if (u < 0.08 || frac(b / 0.25) < 0.16) return lit(r.rampOf(MORTERO)[2], g * 0.9, ix, iy);
  const k = Math.floor((a + desfase) / 0.5);
  const h = hash(k, hilada);
  // Salitre: manchas claras abajo, como en las bodegas de verdad
  if (b < 1.0 && noise(a * 0.9, b * 1.2) > 0.84) return lit(ramp[2], g + 0.04, ix, iy);
  return lit(ramp[h > 0.9 ? 2 : h < 0.08 ? 4 : 3], g, ix, iy);
}
/** La bodega que se está pintando (la del nivel 6 o, desde el 7, la del tostadero, más ancha). */
let BOD = BODEGA;
/** La escalera de la bodega que se pinta (en la sala de catas, en la pared nueva). */
const escBod = () => (BOD === BODEGA_CATAS ? ESCALERA_CATAS : ESCALERA_BODEGA);
function paintMuro(w, world, extra = () => null) {
  const alto = BOD.alto;
  return canvasOf(Math.round(w * PX), Math.round(alto * PX), (ix, iy) => {
    const a = (ix + 0.5) / PX;
    const b = alto - (iy + 0.5) / PX;
    const own = extra(a, b, ix, iy);
    if (own != null) return own;
    return ladrilloPx(a, b, glowAt(...world(a, b)), ix, iy);
  });
}
/** El ventanuco de la pared de delante, alto, con sus barrotes: deja ver la noche del muelle a ras de la acera. */
function ventanuco(a, b, ix, iy) {
  const x = BOD.x1 - a;
  if (x < 41.4 || x > 43.2 || b < 2.35 || b > 3.0) return null;
  const r = probe();
  const g = glowAt(x, BOD.y1 - 0.3, b);
  if (x < 41.48 || x > 43.12 || b < 2.42 || b > 2.93) return lit(r.rampOf(MORTERO)[1], g, ix, iy);
  if (Math.abs(frac((x - 41.48) / 0.27) - 0.5) > 0.42) return lit(HIERRO_B, g + 0.1, ix, iy);
  // La acera mojada y la luz de la farola, al fondo
  if (b < 2.55) return rgb(52, 50, 60);
  return hash(ix, iy) > 0.96 ? rgb(214, 210, 236) : rgb(26 + (b - 2.55) * 20, 32, 62);
}
/** El suelo de losas de piedra, colocadas a matajunta. */
function paintSueloBodega() {
  const r = probe();
  const piedra = r.rampOf(LOSA);
  const [ancho, hondo] = [BOD.x1 - BOD.x0, BOD.y1 - BOD.y0];
  return canvasOf(Math.round(ancho * PX), Math.round(hondo * PX), (ix, iy) => {
    const x = BOD.x0 + (ix + 0.5) / PX;
    const y = BOD.y0 + (iy + 0.5) / PX;
    const g = glowAt(x, y, 0);
    const fy = Math.floor(y / 0.8);
    const off = fy % 2 ? 0.45 : 0;
    const fx = Math.floor((x + off) / 0.9);
    if (frac((x + off) / 0.9) < 0.05 || frac(y / 0.8) < 0.06) return lit(piedra[1], g, ix, iy);
    const n = noise(x * 2.6, y * 2.6);
    return lit(piedra[n > 0.8 ? 4 : hash(fx, fy) > 0.66 ? 2 : 3], g, ix, iy);
  });
}
/** La bóveda, vista desde abajo: ladrillo a lo largo y, sobre la escalera, el hueco de la trampilla con la luz del café. */
function paintBovedaBodega() {
  const r = probe();
  const ramp = r.rampOf(LADRILLO);
  const [ancho, hondo] = [BOD.x1 - BOD.x0, BOD.y1 - BOD.y0];
  return canvasOf(Math.round(ancho * PX), Math.round(hondo * PX), (ix, iy) => {
    const x = BOD.x0 + (ix + 0.5) / PX;
    const y = BOD.y1 - (iy + 0.5) / PX;
    const g = glowAt(x, y, BOD.alto) * 0.75;
    if (x > escBod().x0 + 0.05 && y > BOD.y1 - 1.25) {
      const borde = Math.min(x - escBod().x0, BOD.y1 - 0.02 - y, y - (BOD.y1 - 1.25)) < 0.08;
      return borde ? lit(ROBLE_D, 0.7, ix, iy) : rgb(196, 140, 82);
    }
    const hilada = Math.floor(x / 0.25);
    const u = frac((y + (hilada % 2) * 0.25) / 0.5);
    if (u < 0.08 || frac(x / 0.25) < 0.16) return lit(r.rampOf(MORTERO)[2], g * 0.9, ix, iy);
    return lit(ramp[hash(Math.floor(y / 0.5), hilada) > 0.9 ? 2 : 3], g, ix, iy);
  });
}
/** Los arcos de ladrillo de la bóveda (dos, de pared a pared), con sus pilastras. */
function arcosBodega(s) {
  const { x0, x1, alto } = BOD;
  const ancho = x1 - x0;
  for (const y of [2.1, 5.3]) {
    for (let k = 0; k < 41; k += 1) {
      const xa = x0 + (k * ancho) / 41;
      const xb = x0 + ((k + 1) * ancho) / 41;
      const u = (k + 0.5) / 41;
      const z = 2.2 + 1.05 * Math.sqrt(Math.sin(Math.PI * u));
      pushBox(s, [xa, y - 0.2, z - 0.16, xb, y + 0.2, alto], k % 2 ? LADRILLO : [134, 72, 54]);
      pushBox(s, [xa, y - 0.21, z - 0.2, xb, y + 0.21, z - 0.16], MORTERO);
    }
    // En el nivel 7, la pilastra de la izquierda del primer arco deja sitio al tostador
    if (BOD === BODEGA || y > 3) {
      pushBox(s, [x0, y - 0.24, 0, x0 + 0.24, y + 0.24, 2.3], [138, 78, 58]);
      for (let z = 0.25; z < 2.3; z += 0.25) pushBox(s, [x0, y - 0.245, z, x0 + 0.245, y + 0.245, z + 0.03], MORTERO);
    }
    if (y < escBod().y0) {
      pushBox(s, [x1 - 0.24, y - 0.24, 0, x1, y + 0.24, 2.3], [138, 78, 58]);
      for (let z = 0.25; z < 2.3; z += 0.25) pushBox(s, [x1 - 0.245, y - 0.245, z, x1, y + 0.245, z + 0.03], MORTERO);
    }
  }
}
/** Una barrica tumbada (el eje a lo ancho, x), con la cara redonda al local: duelas, aros, la espita y su número de tiza. */
function barricaTumbada(s, cy, cz, r, x0, x1) {
  for (let k = -5; k <= 5; k += 1) {
    const dz = (k / 5.5) * r;
    const half = Math.sqrt(Math.max(0, r * r - dz * dz));
    const z0 = cz + dz - r / 11;
    pushBox(s, [x0, cy - half, z0, x1, cy + half, z0 + (2 * r) / 11], Math.abs(k) % 3 === 1 ? ROBLE_D : ROBLE);
  }
  for (const xa of [x0 + 0.08, x1 - 0.14]) pushBox(s, [xa, cy - r - 0.01, cz - r - 0.01, xa + 0.05, cy + r + 0.01, cz + r + 0.01], HIERRO_B);
  pushBox(s, [x1, cy - r * 0.78, cz - r * 0.78, x1 + 0.02, cy + r * 0.78, cz + r * 0.78], [150, 104, 66]);
  pushBox(s, [x1 + 0.02, cy - 0.05, cz - r * 0.55, x1 + 0.1, cy + 0.05, cz - r * 0.45], BRASS, { g: 0.7 });
  pushBox(s, [x1 + 0.021, cy - 0.12, cz + 0.08, x1 + 0.024, cy + 0.1, cz + 0.13], [232, 226, 210]);
}
function barricasBodega(s) {
  const { x0 } = BOD;
  // Bloque 6b: en el nivel 7, las barricas se corren al fondo de la pared (delante va el tostador)
  if (BOD !== BODEGA) {
    pushBox(s, [x0, 3.3, 0, x0 + 0.95, 6.7, 0.14], ROBLE_D);
    for (const cy of [3.8, 4.75, 6.2]) barricaTumbada(s, cy, 0.6, 0.46, x0 + 0.02, x0 + 0.92);
    barricaTumbada(s, 4.28, 1.43, 0.4, x0 + 0.06, x0 + 0.86);
    return;
  }
  // La cuna de madera y tres barricas; una cuarta, encima
  pushBox(s, [x0, 0.5, 0, x0 + 0.95, 5.4, 0.14], ROBLE_D);
  for (const cy of [1.3, 2.9, 4.5]) barricaTumbada(s, cy, 0.6, 0.46, x0 + 0.02, x0 + 0.92);
  barricaTumbada(s, 3.7, 1.43, 0.4, x0 + 0.06, x0 + 0.86);
}
/** El botellero de la pared del fondo: casillas de madera con las botellas tumbadas (el culo a la vista). */
function botelleroBodega(s) {
  const [xa, xb, y0, y1, alto] = [40.6, 45.6, BOD.y0, BOD.y0 + 0.42, 2.2];
  pushBox(s, [xa, y0, 0, xb, y0 + 0.04, alto], ROBLE_D);
  for (let x = xa; x <= xb + 0.01; x += 0.5) pushBox(s, [x - 0.03, y0, 0, x + 0.03, y1, alto], ROBLE);
  for (let z = 0; z <= alto + 0.01; z += 0.36) pushBox(s, [xa, y0, z, xb, y1, z + 0.04], ROBLE);
  for (let x = xa + 0.06, i = 0; x < xb - 0.05; x += 0.5, i += 1)
    for (let z = 0.06, j = 0; z < alto - 0.2; z += 0.36, j += 1)
      for (const dx of [0.08, 0.24]) {
        if (hash(i * 5 + (dx > 0.1 ? 1 : 0), j) > 0.86) continue;
        pushBox(s, [x + dx, y1 - 0.1, z + 0.06, x + dx + 0.12, y1 - 0.02, z + 0.18], BOTELLA);
        pushBox(s, [x + dx + 0.03, y1 - 0.02, z + 0.12, x + dx + 0.06, y1 - 0.015, z + 0.15], [150, 200, 170], { g: 0.6 });
      }
}
/**
 * Bloque 6c: el mostrador de catas contra la pared del fondo, en las columnas nuevas: la tabla de roble, dos baldas con tarros
 * de cristal de cada tueste (del más claro al más oscuro) y, encima de la tabla, las tazas de cata boca abajo y una balanza.
 */
const TUESTES = [
  [204, 160, 100],
  [168, 112, 62],
  [128, 78, 44],
  [92, 56, 34],
  [62, 38, 26],
];
function mostradorCatas(s) {
  if (BOD !== BODEGA_CATAS) return;
  const [xa, xb, y0] = [45.95, 47.95, BOD.y0];
  pushBox(s, [xa, y0, 0, xb, y0 + 0.5, 0.84], ROBLE_D);
  for (let x = xa + 0.2; x < xb - 0.1; x += 0.4) pushBox(s, [x, y0 + 0.5, 0.06, x + 0.22, y0 + 0.505, 0.78], ROBLE);
  pushBox(s, [xa - 0.04, y0, 0.84, xb + 0.04, y0 + 0.56, 0.9], ROBLE);
  for (const z of [1.42, 1.94]) {
    pushBox(s, [xa, y0, z, xb, y0 + 0.3, z + 0.04], ROBLE);
    for (let k = 0; k < 6; k += 1) {
      const x = xa + 0.1 + k * 0.32;
      const c = TUESTES[(k + (z > 1.6 ? 2 : 0)) % TUESTES.length];
      // El grano, a la vista; del cristal, solo los cantos y el brillo (si no, tapaba el tueste)
      pushBox(s, [x + 0.01, y0 + 0.07, z + 0.04, x + 0.19, y0 + 0.25, z + 0.22], c);
      pushBox(s, [x + 0.01, y0 + 0.07, z + 0.22, x + 0.19, y0 + 0.25, z + 0.3], [150, 168, 166], { g: 0.6 });
      for (const xx of [x, x + 0.185]) pushBox(s, [xx, y0 + 0.06, z + 0.04, xx + 0.015, y0 + 0.26, z + 0.3], [196, 214, 208], { g: 0.75 });
      pushBox(s, [x + 0.03, y0 + 0.25, z + 0.08, x + 0.05, y0 + 0.262, z + 0.26], [236, 244, 240], { g: 0.85 });
      pushBox(s, [x - 0.01, y0 + 0.05, z + 0.3, x + 0.21, y0 + 0.27, z + 0.34], BRASS, { g: 0.6 });
    }
  }
  for (let k = 0; k < 5; k += 1) {
    const x = xa + 0.18 + k * 0.3;
    pushBox(s, [x, y0 + 0.24, 0.9, x + 0.16, y0 + 0.4, 0.99], [236, 230, 216]);
  }
  pushBox(s, [xb - 0.42, y0 + 0.12, 0.9, xb - 0.12, y0 + 0.36, 0.94], BRASS, { g: 0.65 });
  pushBox(s, [xb - 0.3, y0 + 0.2, 0.94, xb - 0.24, y0 + 0.28, 1.1], BRASS, { g: 0.6 });
  pushBox(s, [xb - 0.4, y0 + 0.14, 1.1, xb - 0.14, y0 + 0.34, 1.12], BRASS, { g: 0.7 });
}
/** La escalera de obra con peldaños de madera, que sube a la trampilla, y su barandilla de hierro del lado del local. */
function escaleraBodega(s) {
  const { x0, x1, y0, y1 } = escBod();
  const n = 14;
  const fondo = (y1 - y0) / n;
  const sube = BOD.alto / n;
  for (let k = 0; k < n; k += 1) {
    const ya = y0 + k * fondo;
    pushBox(s, [x0 + 0.05, ya, 0, x1, ya + fondo, (k + 1) * sube - 0.05], [118, 106, 94]);
    pushBox(s, [x0 + 0.02, ya - 0.02, (k + 1) * sube - 0.05, x1, ya + fondo, (k + 1) * sube], [150, 104, 66]);
  }
  for (let k = 0; k <= n; k += 3) {
    const ya = y0 + k * fondo + 0.1;
    const z = k * sube;
    pushBox(s, [x0 - 0.02, ya, z, x0 + 0.03, ya + 0.05, z + 0.95], HIERRO_B);
  }
  for (let k = 0; k < n; k += 1) {
    const ya = y0 + k * fondo;
    pushBox(s, [x0 - 0.04, ya, k * sube + 0.92, x0 + 0.05, ya + fondo, k * sube + 0.98], BRASS, { g: 0.55 });
  }
}
/** Los dos faroles de hierro que cuelgan de la bóveda, encendidos. */
function farolesBodega(s) {
  for (const { at } of BOD === BODEGA ? LUZ_BODEGA.slice(0, 2) : BOD === BODEGA_CATAS ? LUZ_CATAS.slice(0, 4) : LUZ_TOSTADERO.slice(0, 3)) {
    const [x, y, z] = at;
    pushBox(s, [x - 0.012, y - 0.012, z + 0.3, x + 0.012, y + 0.012, BOD.alto], [40, 34, 32], { g: 0.4 });
    pushBox(s, [x - 0.16, y - 0.16, z + 0.22, x + 0.16, y + 0.16, z + 0.3], HIERRO_B, { g: 0.7 });
    pushBox(s, [x - 0.12, y - 0.12, z - 0.2, x + 0.12, y + 0.12, z + 0.22], BULB, { glow: true });
    for (const [dx, dy] of [
      [-0.13, -0.13],
      [0.11, -0.13],
      [-0.13, 0.11],
      [0.11, 0.11],
    ])
      pushBox(s, [x + dx, y + dy, z - 0.22, x + dx + 0.02, y + dy + 0.02, z + 0.22], HIERRO_B, { g: 0.6 });
    pushBox(s, [x - 0.15, y - 0.15, z - 0.26, x + 0.15, y + 0.15, z - 0.2], HIERRO_B, { g: 0.6 });
  }
}
/** La trampilla abierta de detrás de la barra (nivel 6): el marco, el hueco con los peldaños alumbrados desde abajo, la tapa apoyada y la barandilla. */
function trampillaKit(s) {
  const { x0, x1, y0, y1 } = TRAMPILLA;
  pushBox(s, [x0 - 0.07, y0 - 0.07, 0, x1 + 0.07, y1 + 0.07, 0.02], WOOD_D, { g: 0.55 });
  pushBox(s, [x0, y0, 0.02, x1, y1, 0.024], [34, 22, 18], { g: 0.3 });
  for (let k = 0; k < 4; k += 1) {
    const xa = x0 + 0.12 + k * 0.24;
    pushBox(s, [xa, y0 + 0.1, 0.024, xa + 0.15, y1 - 0.1, 0.027], [196 - k * 34, 140 - k * 26, 84 - k * 16], { g: 0.95 - k * 0.2 });
  }
  // La tapa, abierta contra la pared, con sus dos bisagras
  pushBox(s, [x1 + 0.06, y0, 0, x1 + 0.13, y1, 1.15], WOOD, { g: 0.5 });
  for (const ya of [y0 + 0.3, y1 - 0.42]) pushBox(s, [x1 + 0.03, ya, 0.03, x1 + 0.14, ya + 0.12, 0.2], HIERRO_B, { g: 0.5 });
  for (let ya = y0 + 0.2; ya < y1; ya += 0.35) pushBox(s, [x1 + 0.055, ya, 0.05, x1 + 0.06, ya + 0.02, 1.1], WOOD_D, { g: 0.45 });
  // La barandilla de latón en los dos lados cortos (se entra por el del local)
  for (const ya of [y0 - 0.05, y1 + 0.02]) {
    for (const xa of [x0 - 0.05, x1 - 0.02]) pushBox(s, [xa, ya, 0, xa + 0.05, ya + 0.04, 0.9], BRASS, { g: 0.6 });
    pushBox(s, [x0 - 0.05, ya - 0.005, 0.86, x1 + 0.03, ya + 0.045, 0.92], BRASS, { g: 0.65 });
  }
}

// ── Bloque 6b (1.127): el tostador del sótano (nivel 7) ──
const HIERRO_T = [56, 50, 48];
const GRANO_T = [104, 62, 36];
/** La cara del tambor, de cara a la sala (x creciente), y la trampilla, abajo en ella. */
const CARA_T = TAMBOR.x - 0.32;
const TRAMPILLA_T = { y0: TAMBOR.y - 0.14, y1: TAMBOR.y + 0.14, z: TAMBOR.z - TAMBOR.r * 0.78, alto: 0.2 };
/** Lo que no se mueve: el pedestal con el hogar, la carcasa y el tambor, la tolva, la chimenea y el enfriador con su eje. */
function tostadorKit(s) {
  const { y, z, r } = TAMBOR;
  pushBox(s, [35.85, 0.7, 0, CARA_T + 0.06, 2.1, 0.5], [96, 72, 60]);
  pushBox(s, [35.85, 0.68, 0.48, CARA_T + 0.08, 2.12, 0.53], [130, 92, 66]);
  pushBox(s, [CARA_T + 0.06, 1.12, 0.08, CARA_T + 0.09, 1.68, 0.12], HIERRO_B);
  pushBox(s, [CARA_T + 0.06, 1.12, 0.36, CARA_T + 0.09, 1.68, 0.4], HIERRO_B);
  // La carcasa de hierro con sus remaches de latón
  pushBox(s, [35.9, 0.82, 0.53, CARA_T, 1.98, 1.5], HIERRO_T);
  for (const za of [0.62, 1.42]) for (let ya = 0.9; ya < 1.95; ya += 0.18) pushBox(s, [CARA_T, ya, za, CARA_T + 0.012, ya + 0.03, za + 0.03], BRASS, { g: 0.6 });
  // La cara del tambor: redonda (en escalones), con su aro de latón
  for (let k = -6; k <= 6; k += 1) {
    const dz = (k / 6.5) * r;
    const half = Math.sqrt(Math.max(0, r * r - dz * dz));
    const z0 = z + dz - r / 13;
    pushBox(s, [CARA_T, y - half, z0, CARA_T + 0.08, y + half, z0 + (2 * r) / 13], k % 2 ? [70, 62, 58] : [62, 55, 52]);
    pushBox(s, [CARA_T + 0.08, y - half - 0.015, z0, CARA_T + 0.095, y - half + 0.03, z0 + (2 * r) / 13], BRASS, { g: 0.65 });
    pushBox(s, [CARA_T + 0.08, y + half - 0.03, z0, CARA_T + 0.095, y + half + 0.015, z0 + (2 * r) / 13], BRASS, { g: 0.65 });
  }
  // La placa del tostadero, sin letras, y el termómetro
  pushBox(s, [CARA_T + 0.08, y - 0.2, z + r * 0.45, CARA_T + 0.095, y + 0.2, z + r * 0.62], BRASS, { g: 0.75 });
  pushBox(s, [CARA_T + 0.08, y + 0.2, z + 0.02, CARA_T + 0.11, y + 0.3, z + 0.12], [226, 220, 204], { g: 0.7 });
  pushBox(s, [CARA_T + 0.11, y + 0.245, z + 0.06, CARA_T + 0.115, y + 0.255, z + 0.11], [180, 40, 34], { g: 0.7 });
  // La manivela del tambor, a un lado
  pushBox(s, [CARA_T + 0.02, 1.98, z - 0.03, CARA_T + 0.06, 2.12, z + 0.03], HIERRO_B);
  pushBox(s, [CARA_T + 0.02, 2.1, z - 0.2, CARA_T + 0.06, 2.14, z + 0.03], HIERRO_B);
  pushBox(s, [CARA_T + 0.0, 2.08, z - 0.26, CARA_T + 0.08, 2.16, z - 0.18], ROBLE_D);
  // La tolva, arriba: tres tramos que se abren hacia arriba
  for (let k = 0; k < 3; k += 1) {
    const h = 0.1 + k * 0.07;
    pushBox(s, [36.35 - h, y - h, 1.5 + k * 0.13, 36.35 + h, y + h, 1.63 + k * 0.13], k === 2 ? ACERO : ACERO_D);
  }
  // La chimenea de humos, hasta la bóveda, con su collar
  pushBox(s, [35.98, 0.86, 1.5, 36.2, 1.08, BODEGA.alto], [44, 40, 38]);
  pushBox(s, [35.96, 0.84, 2.2, 36.22, 1.1, 2.26], BRASS, { g: 0.55 });
  // La rampa de la trampilla al enfriador
  const xf = giro([CARA_T + 0.1, y, TRAMPILLA_T.z - 0.02], 'y', 0.28);
  pushBox(s, [CARA_T + 0.1, y - 0.11, TRAMPILLA_T.z - 0.05, ENFRIADOR.x - ENFRIADOR.r * 0.55, y + 0.11, TRAMPILLA_T.z - 0.02], ACERO_D, { xf });
  for (const ya of [y - 0.12, y + 0.1]) pushBox(s, [CARA_T + 0.1, ya, TRAMPILLA_T.z - 0.05, ENFRIADOR.x - ENFRIADOR.r * 0.55, ya + 0.02, TRAMPILLA_T.z + 0.03], ACERO_D, { xf });
  // El enfriador: la bandeja redonda sobre tres patas, el borde de latón y el eje del brazo
  const { x: ex, y: ey, z: ez, r: er } = ENFRIADOR;
  for (let k = 0; k < 3; k += 1) {
    const a = (k / 3) * Math.PI * 2 + 0.5;
    const [lx, ly] = [ex + Math.cos(a) * er * 0.7, ey + Math.sin(a) * er * 0.7];
    pushBox(s, [lx - 0.025, ly - 0.025, 0, lx + 0.025, ly + 0.025, ez - 0.04], HIERRO_B);
  }
  for (let k = -6; k <= 6; k += 1) {
    const dx = (k / 6.5) * er;
    const half = Math.sqrt(Math.max(0, er * er - dx * dx));
    pushBox(s, [ex + dx - er / 13, ey - half, ez - 0.05, ex + dx + er / 13, ey + half, ez - 0.02], k % 2 ? [84, 80, 76] : [74, 70, 66]);
  }
  for (let k = 0; k < 20; k += 1) {
    const a = (k / 20) * Math.PI * 2;
    const [rx, ry] = [ex + Math.cos(a) * er, ey + Math.sin(a) * er];
    pushBox(s, [rx - 0.05, ry - 0.05, ez - 0.05, rx + 0.05, ry + 0.05, ez + 0.06], BRASS, { g: 0.6 });
  }
  pushBox(s, [ex - 0.025, ey - 0.025, ez - 0.02, ex + 0.025, ey + 0.025, ez + 0.2], ACERO);
  // Dos sacos vacíos doblados, junto a la pared
  pushBox(s, [35.9, 2.2, 0, 36.5, 2.85, 0.1], [170, 140, 96]);
  pushBox(s, [35.92, 2.24, 0.1, 36.46, 2.8, 0.16], [184, 154, 108]);
}
/**
 * Lo que se mueve o cambia (est, de setTostador): la boca del hogar y la mirilla, encendidas con el tueste en la carta
 * (encendido) y más vivas con el saco listo (listo); la trampilla con su asa (abierta, 0 a 1); los granos que caen (cae, 0 a 1,
 * y fase); los del enfriador (caido, 0 a 1) y el brazo que los remueve (brazo, en radianes).
 */
function tostadorVivoKit(s, est = {}) {
  const { y, z } = TAMBOR;
  const { encendido = false, listo = false, abierta = 0, cae = 0, caido = 0, brazo = 0, fase = 0 } = est;
  pushBox(s, [CARA_T + 0.06, 1.14, 0.12, CARA_T + 0.065, 1.66, 0.36], encendido ? (listo ? [255, 150, 64] : [214, 96, 44]) : [40, 26, 22], { glow: encendido, g: 0.3 });
  pushBox(s, [CARA_T + 0.08, y - 0.06, z + 0.1, CARA_T + 0.1, y + 0.06, z + 0.2], encendido && listo ? [255, 186, 92] : [52, 40, 34], { glow: encendido && listo, g: 0.4 });
  // La trampilla, con la bisagra abajo: se abre hacia ti
  const { y0, y1, z: tz, alto } = TRAMPILLA_T;
  if (abierta > 0.05) pushBox(s, [CARA_T + 0.075, y0 + 0.01, tz + 0.01, CARA_T + 0.08, y1 - 0.01, tz + alto - 0.01], [26, 16, 12], { g: 0.4 });
  const xf = giro([CARA_T + 0.08, y, tz], 'y', abierta * 1.35);
  pushBox(s, [CARA_T + 0.08, y0, tz, CARA_T + 0.105, y1, tz + alto], [78, 70, 66], { xf });
  pushBox(s, [CARA_T + 0.105, y - 0.09, tz + alto - 0.06, CARA_T + 0.17, y - 0.07, tz + alto - 0.04], BRASS, { g: 0.75, xf });
  pushBox(s, [CARA_T + 0.105, y + 0.07, tz + alto - 0.06, CARA_T + 0.17, y + 0.09, tz + alto - 0.04], BRASS, { g: 0.75, xf });
  pushBox(s, [CARA_T + 0.15, y - 0.1, tz + alto - 0.07, CARA_T + 0.19, y + 0.1, tz + alto - 0.03], ROBLE_D, { xf });
  // Los granos que caen por la rampa
  const { x: ex, y: ey, z: ez, r: er } = ENFRIADOR;
  if (cae > 0 && abierta > 0.5) {
    for (let k = 0; k < 14; k += 1) {
      const t = (k / 14 + fase) % 1;
      const gx = CARA_T + 0.12 + (ex - er * 0.4 - CARA_T - 0.12) * t;
      const gz = tz + 0.02 - (tz - ez + 0.04) * t * t;
      const gy = y + (hash(k, 3) - 0.5) * 0.14;
      pushBox(s, [gx - 0.018, gy - 0.014, gz, gx + 0.018, gy + 0.014, gz + 0.022], k % 3 ? GRANO_T : [80, 46, 28], { g: 0.5 });
    }
  }
  // Los granos en la bandeja y el brazo que los remueve
  if (caido > 0) {
    const h = 0.012 + caido * 0.05;
    for (let k = -5; k <= 5; k += 1) {
      const dx = (k / 5.5) * er * 0.92;
      const half = Math.sqrt(Math.max(0, (er * 0.92) ** 2 - dx * dx));
      pushBox(s, [ex + dx - er / 11, ey - half, ez - 0.02, ex + dx + er / 11, ey + half, ez - 0.02 + h * (0.7 + 0.3 * hash(k, 9))], k % 2 ? GRANO_T : [92, 54, 32], { g: 0.5 });
    }
  }
  const xb = giro([ex, ey, ez], 'z', brazo);
  pushBox(s, [ex - er * 0.86, ey - 0.018, ez + 0.05, ex + er * 0.86, ey + 0.018, ez + 0.09], ACERO, { xf: xb, g: 0.6 });
  pushBox(s, [ex - 0.018, ey - er * 0.86, ez + 0.05, ex + 0.018, ey + er * 0.86, ez + 0.09], ACERO, { xf: xb, g: 0.6 });
  pushBox(s, [ex - 0.04, ey - 0.04, ez + 0.18, ex + 0.04, ey + 0.04, ez + 0.24], BRASS, { g: 0.7 });
}
/** Las marcas del tostador (para la ayuda «!» y las pruebas): el asa de la trampilla y el enfriador. */
const TOSTADOR_MARCAS = {
  asa: [CARA_T + 0.18, TAMBOR.y, TRAMPILLA_T.z + TRAMPILLA_T.alto - 0.05],
  enfriador: [ENFRIADOR.x, ENFRIADOR.y, ENFRIADOR.z + 0.05],
  tambor: [CARA_T + 0.09, TAMBOR.y, TAMBOR.z],
};
/** La cámara delante del tostador: de cara a la trampilla, con el enfriador abajo. */
// ── 1.133: el taller de la trastienda (nivel 3; plan en docs/qa/cafe-libreria.md §16.3). Aparte en el mundo, como la bodega:
// el banco de don Celestino con su tapete verde, la prensa de husillo, la lámpara de brazo con lupa, los hilos de colores, los
// botes de cola y engrudo, los papeles jaspeados colgados y un ventanuco con lluvia. Su paleta: verde botella, cuero y latón. ──
const VERDE_B = [46, 86, 62];
const TAPETE = [56, 104, 72];
const CUERO = [124, 80, 48];
const CUERO_D = [88, 56, 34];
const LATON_T = [210, 168, 94];
const LATON_TD = [150, 112, 58];
const ROBLE_T = [140, 94, 58];
const ROBLE_TD = [104, 68, 42];
const YESO_T = [200, 184, 156];
const HIERRO_TL = [62, 58, 58];
const PAPEL_T = [236, 226, 200];
const HUESO = [232, 222, 196];
const MIGA_T = [222, 206, 200];
const COLA_T = [188, 142, 80];
const PIEL_T = [236, 192, 152];
/** Los hilos de coser cuadernillos (los carretes de la balda) y las telas de los libros que esperan en la estantería. */
const HILOS_T = [
  [178, 52, 48],
  [60, 96, 150],
  [214, 170, 70],
  [86, 130, 80],
  [150, 84, 120],
  [226, 214, 186],
];
const LOMOS_T = [CUERO, CUERO_D, [122, 44, 46], [50, 86, 64], [44, 56, 96], [150, 120, 80], [96, 40, 40], [72, 78, 86]];
/** Los papeles jaspeados que se secan colgados del cordel: [paleta, x del centro]. */
const JASPEADOS = [
  [[[64, 92, 140], [196, 160, 92], [150, 60, 54], [40, 52, 86]], 60.62],
  [[[58, 110, 84], [214, 186, 120], [120, 70, 46], [34, 62, 52]], 61.06],
  [[[150, 84, 110], [86, 110, 150], [226, 200, 150], [70, 44, 70]], 61.5],
];
/** La luz del taller: la lámpara de brazo sobre el tapete, la de techo y, muy poca, la del ventanuco. */
const LUZ_TALLER = [
  { at: [61.6, 0.4, 1.3], k: 1.0, reach: 2.3 },
  { at: [61.9, 1.45, 2.4], k: 0.55, reach: 3.4 },
  { at: [62.38, 0.2, 1.75], k: 0.16, reach: 1.3 },
];
/** El ventanuco, en la pared del fondo, encima del banco (x de un lado al otro; z de abajo arriba). */
const VENTANUCO_T = { x0: 61.98, x1: 62.78, z0: 1.45, z1: 2.05 };
/** La puerta del taller, por dentro (en la pared de delante). */
const PUERTA_T = { x0: 62.9, x1: 63.7, alto: 1.95 };
/**
 * El libro del taller, en su sitio (x desde el lomo, y desde la cabeza, z desde lo que lo sostiene): la bisagra de la tapa, la
 * tapa cerrada por encima, la primera página y la guarda (con la tapa abierta, sobre el tapete), y su grueso.
 */
const LIBRO_Z = { bisagra: 0.023, tapa: 0.0462, pagina: 0.0425, guarda: 0.0042, grueso: 0.046 };
/** La vista al entrar: el banco, la lámpara, el ventanuco y don Celestino a la izquierda (también en un móvil en vertical). */
const VISTA_ENTRADA = { p: [62.45, 3.3, 1.6], m: [61.7, 0.5, 1.0] };
/** Donde queda el libro dentro de la prensa (su esquina, como `LIBRO_BANCO`) y lo que sube su base sobre el banco. */
const LIBRO_PRENSA = { x: PRENSA_TALLER.x - LIBRO_TALLER.ancho / 2, y: PRENSA_TALLER.y - LIBRO_TALLER.hondo / 2, z: 0.06 };
/**
 * Don Celestino, hecho a mano y no con la figura de los clientes (Francisco, tras ver la 1.133: «que se vea mucho más único»):
 * calvo, con la herradura de pelo blanco, los tufos sobre las orejas y la visera verde de encuadernador; cejas pobladas, bigote de
 * morsa, gafas de media luna de latón por las que mira por encima y la nariz colorada; la camisa remangada con ligas negras, la
 * pajarita granate, el chaleco verde botella con la cadena del reloj, el mandil de cuero con remaches y su bolsillo (la plegadera
 * de hueso y un lápiz), pantalón de pana con el bajo vuelto y zapatos color sangre de toro. Un lápiz detrás de la oreja y la
 * espalda un poco cargada, de tantos años inclinado sobre el banco. Mismo marco que `actorBoxes`: el frente mira a +y.
 */
function celestinoKit(luz) {
  const s = kit();
  const b = (x0, y0, z0, x1, y1, z1, c) => pushBox(s, [x0, y0, z0, x1, y1, z1], c, { g: luz });
  const piel = PIELES[1].color;
  const oreja = [222, 172, 134];
  const canas = [238, 234, 226];
  const canasS = [206, 200, 190];
  const camisa = [238, 234, 222];
  const puno = [222, 216, 198];
  const chaleco = [46, 88, 66];
  const chalecoD = [30, 62, 46];
  const pana = [118, 88, 60];
  const panaD = [92, 66, 44];
  const zapato = [104, 36, 34];
  const granate = [132, 34, 50];
  const visera = [96, 170, 112];
  const viseraD = [48, 108, 68];
  const negro = [38, 32, 34];
  const tinta = [44, 30, 26];
  const cristal = [214, 228, 232];
  const lapiz = [226, 182, 58];
  const goma = [222, 140, 150];
  // Zapatos con la puntera brillante, la pana con sus rayas y el bajo vuelto
  for (const [x0, x1] of [
    [-0.2, -0.03],
    [0.03, 0.2],
  ]) {
    b(x0 - 0.01, -0.09, 0, x1 + 0.01, 0.15, 0.1, zapato);
    b(x0, 0.15, 0.03, x1, 0.158, 0.08, [140, 58, 50]);
    b(x0, -0.09, 0.1, x1, 0.09, 0.72, pana);
    b(x0 - 0.008, -0.098, 0.1, x1 + 0.008, 0.098, 0.15, panaD);
    for (const x of [x0 + 0.035, x0 + 0.08, x0 + 0.125]) b(x, 0.09, 0.16, x + 0.012, 0.096, 0.42, panaD);
  }
  // La cintura, el chaleco verde botella (con algo de tripa por delante y la chepa por detrás)
  b(-0.25, -0.13, 0.7, 0.25, 0.13, 0.86, pana);
  b(-0.26, -0.14, 0.82, 0.26, 0.14, 1.4, chaleco);
  b(-0.2, 0.14, 0.86, 0.2, 0.172, 1.1, chaleco);
  b(-0.22, -0.172, 1.16, 0.22, -0.14, 1.38, chaleco);
  // La camisa en el pico del chaleco, los botones de latón, el bolsillo del reloj y la cadena hasta el ojal
  b(-0.075, 0.14, 1.27, 0.075, 0.152, 1.4, camisa);
  b(-0.04, 0.14, 1.17, 0.04, 0.152, 1.27, camisa);
  for (const z of [0.95, 1.04]) b(-0.02, 0.172, z, 0.02, 0.186, z + 0.035, LATON_T);
  b(-0.02, 0.152, 1.125, 0.02, 0.164, 1.16, LATON_T);
  b(-0.2, 0.172, 1.03, -0.1, 0.18, 1.045, chalecoD);
  b(-0.16, 0.174, 0.99, -0.09, 0.186, 1.003, LATON_T);
  b(-0.09, 0.174, 0.978, -0.03, 0.186, 0.991, LATON_T);
  // El mandil de cuero, de la cintura a las rodillas: la correa con su hebilla, el bolsillo con remaches, la plegadera y el lápiz
  b(-0.265, -0.15, 0.86, 0.265, 0.19, 0.92, CUERO_D);
  b(0.11, 0.19, 0.866, 0.165, 0.2, 0.914, LATON_T);
  b(-0.22, 0.17, 0.4, 0.22, 0.2, 0.88, CUERO);
  b(-0.222, 0.172, 0.4, 0.222, 0.202, 0.43, CUERO_D);
  b(-0.16, 0.2, 0.55, 0.06, 0.212, 0.72, [104, 66, 40]);
  b(-0.16, 0.2, 0.705, 0.06, 0.214, 0.72, CUERO_D);
  for (const x of [-0.16, 0.035]) b(x, 0.212, 0.69, x + 0.025, 0.222, 0.715, LATON_T);
  b(-0.13, 0.204, 0.64, -0.1, 0.216, 0.8, HUESO);
  b(-0.06, 0.204, 0.64, -0.04, 0.216, 0.78, lapiz);
  b(-0.06, 0.204, 0.78, -0.04, 0.216, 0.8, goma);
  // Los brazos, un poco adelantados: camisa remangada, ligas negras, el puño vuelto, los antebrazos y las manos
  for (const [x0, x1] of [
    [-0.37, -0.26],
    [0.26, 0.37],
  ]) {
    b(x0, -0.07, 1.04, x1, 0.13, 1.4, camisa);
    b(x0 - 0.006, -0.076, 1.2, x1 + 0.006, 0.136, 1.245, negro);
    b(x0 - 0.008, -0.078, 0.97, x1 + 0.008, 0.138, 1.05, puno);
    b(x0 + 0.01, -0.05, 0.86, x1 - 0.01, 0.13, 0.97, piel);
    b(x0 + 0.008, -0.04, 0.74, x1 - 0.008, 0.12, 0.86, oreja);
  }
  // El cuello de la camisa y la pajarita granate
  b(-0.1, -0.03, 1.38, 0.1, 0.15, 1.47, piel);
  b(-0.17, -0.1, 1.38, 0.17, 0.16, 1.455, camisa);
  b(-0.11, 0.16, 1.37, -0.025, 0.178, 1.44, granate);
  b(0.025, 0.16, 1.37, 0.11, 0.178, 1.44, granate);
  b(-0.03, 0.16, 1.385, 0.03, 0.19, 1.43, [98, 22, 36]);
  // La cabeza, adelantada: la calva, la herradura de canas, las orejas, los tufos y el lápiz detrás de la oreja
  const y = 0.05;
  b(-0.24, -0.21 + y, 1.45, 0.24, 0.23 + y, 1.93, piel);
  b(-0.27, -0.24 + y, 1.52, -0.24, 0.1 + y, 1.8, canas);
  b(0.24, -0.24 + y, 1.52, 0.27, 0.1 + y, 1.8, canas);
  b(-0.27, -0.24 + y, 1.52, 0.27, -0.21 + y, 1.8, canas);
  b(-0.3, 0.0 + y, 1.6, -0.27, 0.08 + y, 1.72, oreja);
  b(0.27, 0.0 + y, 1.6, 0.3, 0.08 + y, 1.72, oreja);
  b(-0.31, -0.08 + y, 1.72, -0.26, 0.07 + y, 1.82, canas);
  b(0.262, -0.08 + y, 1.75, 0.305, 0.07 + y, 1.82, canas);
  b(0.268, -0.12 + y, 1.72, 0.3, 0.14 + y, 1.748, lapiz);
  b(0.272, 0.14 + y, 1.724, 0.296, 0.175 + y, 1.744, [70, 56, 46]);
  b(0.268, -0.15 + y, 1.72, 0.3, -0.12 + y, 1.748, goma);
  // La visera verde: la cinta alrededor de la cabeza y el ala, en dos escalones hacia abajo, con el canto oscuro
  b(-0.255, -0.225 + y, 1.78, 0.255, 0.235 + y, 1.835, viseraD);
  b(-0.25, 0.235 + y, 1.8, 0.25, 0.33 + y, 1.83, visera);
  b(-0.24, 0.33 + y, 1.775, 0.24, 0.405 + y, 1.805, visera);
  b(-0.24, 0.405 + y, 1.768, 0.24, 0.415 + y, 1.8, viseraD);
  // La cara: cejas pobladas (caídas por fuera), los ojos por encima de las gafas de media luna, mejillas, nariz y bigote de morsa
  for (const sx of [-1, 1]) {
    const x = sx * 0.11;
    b(x - 0.075, 0.22 + y, 1.72, x + 0.075, 0.268 + y, 1.765, canas);
    b(sx > 0 ? x + 0.055 : x - 0.1, 0.22 + y, 1.695, sx > 0 ? x + 0.1 : x - 0.055, 0.264 + y, 1.725, canas);
    b(x - 0.022, 0.23 + y, 1.665, x + 0.022, 0.245 + y, 1.705, tinta);
    b(x - 0.08, 0.23 + y, 1.6, x + 0.08, 0.25 + y, 1.66, LATON_T);
    b(x - 0.065, 0.23 + y, 1.61, x + 0.065, 0.256 + y, 1.65, cristal);
    b(Math.min(sx * 0.19, sx * 0.245), 0.23 + y, 1.645, Math.max(sx * 0.19, sx * 0.245), 0.244 + y, 1.658, LATON_TD);
    b(Math.min(sx * 0.24, sx * 0.252), 0.1 + y, 1.645, Math.max(sx * 0.24, sx * 0.252), 0.24 + y, 1.658, LATON_TD);
    b(x - 0.035, 0.23 + y, 1.56, x + 0.035, 0.242 + y, 1.6, [232, 150, 130]);
  }
  b(-0.03, 0.23 + y, 1.64, 0.03, 0.252 + y, 1.655, LATON_T);
  b(-0.04, 0.23 + y, 1.555, 0.04, 0.29 + y, 1.635, [216, 140, 116]);
  b(-0.02, 0.29 + y, 1.6, 0.005, 0.296 + y, 1.62, [238, 172, 150]);
  b(-0.15, 0.23 + y, 1.5, 0.15, 0.285 + y, 1.562, canas);
  b(-0.13, 0.23 + y, 1.49, 0.13, 0.27 + y, 1.5, canasS);
  b(-0.175, 0.23 + y, 1.455, -0.11, 0.28 + y, 1.52, canas);
  b(0.11, 0.23 + y, 1.455, 0.175, 0.28 + y, 1.52, canas);
  return s;
}

/** Un punto de la tapa (u, v) en el mundo, con el libro en `L` (la esquina de su lomo y su cabeza). */
const enTapa = (L, u, v) => [L.x + u * LIBRO_TALLER.ancho, L.y + v * LIBRO_TALLER.hondo, L.z + LIBRO_Z.tapa];
/** Un punto de las dos páginas (u, v): la guarda a la izquierda del lomo (más baja, sobre el tapete) y la página a la derecha. */
const enPliego = (L, u, v) => [L.x + (u * 2 - 1) * LIBRO_TALLER.ancho, L.y + v * LIBRO_TALLER.hondo, L.z + (u < 0.5 ? LIBRO_Z.guarda : LIBRO_Z.pagina)];
/** La altura de la platina de la prensa (su cara de abajo) según lo apretada (0, arriba; 1, sobre el libro). */
const platinaZ = (baja = 0) => lerp(1.1, BANCO.z + LIBRO_PRENSA.z + LIBRO_Z.grueso, clamp(baja, 0, 1));
/** Lo alto del husillo (la cruceta), que baja con la platina. */
const husilloZ = (baja = 0) => platinaZ(baja) + 0.56;

/** Las paredes del taller: zócalo de tablas verde botella con su moldura de roble y, encima, yeso crema con su cornisa. */
function paintParedTaller(w, world, extra = () => null) {
  const r = probe();
  const verde = r.rampOf(VERDE_B);
  const roble = r.rampOf(ROBLE_T);
  const yeso = r.rampOf(YESO_T);
  const alto = TALLER.alto;
  return canvasOf(Math.round(w * PX), Math.round(alto * PX), (ix, iy) => {
    const a = (ix + 0.5) / PX;
    const b = alto - (iy + 0.5) / PX;
    const g = glowAt(...world(a, b));
    const suyo = extra(a, b, ix, iy, g);
    if (suyo != null) return suyo;
    if (b < 0.08) return lit(roble[1], g, ix, iy);
    if (b < 0.92) return lit(verde[frac(a / 0.2) < 0.08 ? 1 : b > 0.86 ? 3 : 2], g, ix, iy);
    if (b < 1.0) return lit(roble[b > 0.97 ? 3 : 2], g, ix, iy);
    if (b > alto - 0.1) return lit(roble[b > alto - 0.04 ? 1 : 2], g, ix, iy);
    const n = noise(a * 2.2 + 3, b * 2.2);
    return lit(yeso[n > 0.8 ? 2 : n < 0.15 && r.bayerAt(ix, iy) > 0.7 ? 4 : 3], g, ix, iy);
  });
}
/** El ventanuco de la pared del fondo: el marco de roble con su cruz y, fuera, la noche del barrio (tejados y una ventana). */
function ventanucoTaller(a, b, ix, iy, g) {
  const x = TALLER.x0 + a;
  const { x0, x1, z0, z1 } = VENTANUCO_T;
  if (x < x0 - 0.06 || x > x1 + 0.06 || b < z0 - 0.06 || b > z1 + 0.06) return null;
  const r = probe();
  if (x < x0 || x > x1 || b < z0 || b > z1) return lit(r.rampOf(ROBLE_TD)[2], g, ix, iy);
  if (Math.abs(x - (x0 + x1) / 2) < 0.025 || Math.abs(b - (z0 + z1) / 2) < 0.025) return lit(r.rampOf(ROBLE_TD)[3], g, ix, iy);
  const u = (x - x0) / (x1 - x0);
  const tejado = z0 + 0.12 + (u < 0.35 ? 0.08 : u < 0.62 ? 0.02 : 0.11);
  if (b < tejado) {
    if (u > 0.68 && u < 0.8 && b > tejado - 0.1 && b < tejado - 0.04) return rgb(236, 180, 96);
    return rgb(30, 28, 40);
  }
  return noise(x * 6, b * 6) > 0.72 ? rgb(58, 62, 92) : rgb(38 + (b - z0) * 18, 44, 74);
}
/** La puerta del taller, por dentro: tablas verdes, su marco y el pomo de latón. */
function puertaTallerDentro(a, b, ix, iy, g) {
  const x = TALLER.x1 - a;
  const { x0, x1, alto } = PUERTA_T;
  if (x < x0 - 0.07 || x > x1 + 0.07 || b > alto + 0.07) return null;
  const r = probe();
  if (x < x0 || x > x1 || b > alto) return lit(r.rampOf(ROBLE_TD)[2], g, ix, iy);
  if (Math.abs(x - (x0 + 0.1)) < 0.03 && Math.abs(b - 0.95) < 0.03) return lit(LATON_T, g + 0.2, ix, iy);
  return lit(r.rampOf(VERDE_B)[frac((x - x0) / 0.2) < 0.08 ? 1 : b > 1.0 && b < 1.08 ? 3 : 2], g, ix, iy);
}
/** El suelo de tablas de roble a matajunta, con la alfombra gastada delante del banco. */
function paintSueloTaller() {
  const r = probe();
  const roble = r.rampOf(ROBLE_T);
  const alfombra = r.rampOf([132, 54, 50]);
  const orla = r.rampOf([196, 150, 82]);
  const { x0, x1, y0, y1 } = TALLER;
  return canvasOf(Math.round((x1 - x0) * PX), Math.round((y1 - y0) * PX), (ix, iy) => {
    const x = x0 + (ix + 0.5) / PX;
    const y = y0 + (iy + 0.5) / PX;
    const g = glowAt(x, y, 0);
    if (x > 61.0 && x < 63.4 && y > 1.15 && y < 2.15) {
      const e = Math.min(x - 61.0, 63.4 - x, y - 1.15, 2.15 - y);
      if (e < 0.07) return lit(orla[e < 0.03 ? 1 : 2], g, ix, iy);
      if (e < 0.13) return lit(alfombra[1], g, ix, iy);
      const rombo = Math.abs(frac((x - 61.0) / 0.4) - 0.5) + Math.abs(frac((y - 1.15) / 0.4) - 0.5) < 0.18;
      return lit(rombo ? orla[2] : alfombra[noise(x * 5, y * 5) > 0.75 ? 3 : 2], g, ix, iy);
    }
    const fila = Math.floor(y / 0.19);
    const off = (fila % 3) * 0.55;
    const tabla = Math.floor((x + off) / 1.3);
    if (frac(y / 0.19) < 0.09 || frac((x + off) / 1.3) < 0.012) return lit(roble[0], g, ix, iy);
    const h = hash(tabla, fila);
    const tono = h > 0.6 ? 3 : h < 0.2 ? 1 : 2;
    return lit(roble[noise(x * 4, y * 9) > 0.78 ? Math.min(4, tono + 1) : tono], g, ix, iy);
  });
}
/** El techo: yeso con vigas oscuras a lo hondo. */
function paintTechoTaller() {
  const r = probe();
  const viga = r.rampOf(ROBLE_TD);
  const yeso = r.rampOf(YESO_T);
  const { x0, x1, y0, y1, alto } = TALLER;
  return canvasOf(Math.round((x1 - x0) * PX), Math.round((y1 - y0) * PX), (ix, iy) => {
    const x = x0 + (ix + 0.5) / PX;
    const y = y1 - (iy + 0.5) / PX;
    const g = glowAt(x, y, alto) * 0.75;
    const v = frac((x - x0) / 1.1);
    if (v < 0.14) return lit(viga[v < 0.03 || v > 0.11 ? 1 : 2], g, ix, iy);
    return lit(yeso[noise(x * 3, y * 3) > 0.8 ? 2 : 3], g, ix, iy);
  });
}
/** Un papel jaspeado (de aguas): vetas que se doblan, en los colores de cada uno, con su hilo claro. */
function paintJaspeado(paleta, semilla, g) {
  const W = 22;
  const H = 28;
  return canvasOf(W, H, (ix, iy) => {
    const x = ix / W;
    const y = iy / H;
    const t = noise(x * 3 + semilla, y * 2.4) * 2.2 + y * 3.1 + Math.sin(x * 7 + semilla) * 0.35;
    const vena = Math.abs(frac(t * paleta.length) - 0.5) < 0.06;
    return lit(vena ? PAPEL_T : paleta[Math.floor(frac(t) * paleta.length)], g, ix, iy);
  });
}
/** Un palo de cajitas de `a` a `b` (brazos de lámpara, mangos y cordeles inclinados). */
function paloKit(s, a, b, grueso, color, o = {}) {
  const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / (grueso * 0.8)));
  const h = grueso / 2;
  for (let k = 0; k <= n; k += 1) {
    const [x, y, z] = [0, 1, 2].map((i) => a[i] + ((b[i] - a[i]) * k) / n);
    pushBox(s, [x - h, y - h, z - h, x + h, y + h, z + h], color, o);
  }
}

/**
 * La puerta baja del taller, en la pared de la derecha, detrás de la barra: verde botella, con su placa de latón (un libro
 * abierto) y un hilo de luz por debajo. Abierta, gira hacia el café y deja ver la luz cálida del taller.
 */
function puertaTallerKit(s, abre) {
  const { y0, y1, alto } = PUERTA_TALLER;
  const X = SW;
  const yc = (y0 + y1) / 2;
  pushBox(s, [X - 0.06, y0 - 0.07, 0, X, y0, alto + 0.07], ROBLE_TD);
  pushBox(s, [X - 0.06, y1, 0, X, y1 + 0.07, alto + 0.07], ROBLE_TD);
  pushBox(s, [X - 0.06, y0 - 0.07, alto, X, y1 + 0.07, alto + 0.07], ROBLE_TD);
  if (!abre) {
    pushBox(s, [X - 0.012, y0 + 0.04, 0, X - 0.006, y1 - 0.04, 0.012], [255, 196, 120], { glow: true });
  }
  const o = abre ? { xf: giro([X - 0.03, y1, 0], 'z', -1.25) } : {};
  pushBox(s, [X - 0.05, y0 + 0.01, 0.012, X - 0.012, y1 - 0.01, alto - 0.005], VERDE_B, o);
  for (const z of [0.35, 1.3]) pushBox(s, [X - 0.058, y0 + 0.05, z, X - 0.05, y1 - 0.05, z + 0.1], [38, 72, 52], o);
  for (let y = y0 + 0.2; y < y1 - 0.1; y += 0.2) pushBox(s, [X - 0.054, y, 0.05, X - 0.05, y + 0.012, alto - 0.05], [36, 68, 50], o);
  pushBox(s, [X - 0.085, y0 + 0.08, 0.92, X - 0.05, y0 + 0.13, 0.97], LATON_T, o);
  pushBox(s, [X - 0.056, yc - 0.12, 1.52, X - 0.05, yc + 0.12, 1.68], LATON_T, o);
  pushBox(s, [X - 0.06, yc - 0.085, 1.56, X - 0.056, yc - 0.006, 1.64], PAPEL_T, o);
  pushBox(s, [X - 0.06, yc + 0.006, 1.56, X - 0.056, yc + 0.085, 1.64], PAPEL_T, o);
}

/** Lo que se ve del taller por la puerta abierta, desde el café: el banco a contraluz bajo la lámpara, en pequeño. */
function paintHuecoTaller() {
  const W = 13;
  const H = 29;
  return canvasOf(W, H, (ix, iy) => {
    const a = (ix + 0.5) / W;
    const b = 1 - (iy + 0.5) / H;
    const luz = Math.max(0, 1 - Math.hypot((a - 0.42) * 1.4, b - 0.48) * 1.7);
    const c = (k) => rgb(...[226, 168, 104].map((v) => Math.min(255, v * (0.55 + luz * k))));
    if (b < 0.12) return rgb(92, 58, 38);
    if (b > 0.43 && b < 0.47 && a > 0.08) return rgb(120, 78, 46);
    if (b > 0.14 && b < 0.43 && (Math.abs(a - 0.2) < 0.04 || Math.abs(a - 0.86) < 0.04)) return rgb(70, 46, 32);
    if (b > 0.47 && b < 0.49 && a > 0.3 && a < 0.62) return rgb(56, 104, 72);
    if (b > 0.6 && b < 0.64 && a > 0.34 && a < 0.5) return rgb(46, 86, 62);
    if (b > 0.585 && b < 0.6 && a > 0.38 && a < 0.46) return rgb(255, 236, 190);
    if (b < 0.4) return rgb(...[46, 86, 62].map((v) => v * (0.7 + luz * 0.6)));
    return c(0.8);
  });
}
/** Lo que no se mueve del taller: el banco con el tapete, la prensa, las lámparas, las herramientas colgadas y lo de las baldas. */
function tallerKit(s) {
  const { x0, x1, y0, y1, z } = BANCO;
  // El banco de roble: el tablero, el faldón con dos cajones, las patas y la balda de abajo con cartones y resmas
  pushBox(s, [x0, y0, z - 0.045, x1, y1, z - 0.005], ROBLE_T);
  pushBox(s, [x0 + 0.03, y1 - 0.04, z - 0.25, x1 - 0.03, y1, z - 0.045], ROBLE_TD);
  for (const [a, b] of [
    [60.55, 61.45],
    [62.95, 63.85],
  ]) {
    pushBox(s, [a, y1, z - 0.22, b, y1 + 0.012, z - 0.07], ROBLE_T);
    pushBox(s, [(a + b) / 2 - 0.05, y1 + 0.012, z - 0.16, (a + b) / 2 + 0.05, y1 + 0.03, z - 0.13], LATON_T);
  }
  for (const x of [x0 + 0.03, (x0 + x1) / 2 - 0.04, x1 - 0.11]) for (const y of [y0 + 0.04, y1 - 0.12]) pushBox(s, [x, y, 0, x + 0.08, y + 0.08, z - 0.25], ROBLE_TD);
  pushBox(s, [x0 + 0.05, y0 + 0.06, 0.16, x1 - 0.05, y1 - 0.06, 0.2], ROBLE_T);
  for (let k = 0; k < 5; k += 1) pushBox(s, [60.6, 0.25, 0.2 + k * 0.025, 61.3 + (k % 2) * 0.06, 0.8, 0.222 + k * 0.025], k % 2 ? CARTON : CARTON_D);
  for (let k = 0; k < 4; k += 1) pushBox(s, [62.3, 0.3, 0.2 + k * 0.04, 62.8, 0.75, 0.236 + k * 0.04], k % 2 ? PAPEL_T : [222, 210, 184]);
  // El tapete verde, con su pespunte claro
  pushBox(s, [61.25, 0.1, z - 0.005, 62.9, 0.94, z], TAPETE);
  for (const [a, b, c, d] of [
    [61.28, 0.13, 62.87, 0.138],
    [61.28, 0.902, 62.87, 0.91],
    [61.28, 0.13, 61.288, 0.91],
    [62.862, 0.13, 62.87, 0.91],
  ])
    pushBox(s, [a, b, z, c, d, z + 0.0006], [116, 156, 116]);

  // La prensa de husillo: la base, los dos montantes, el puente con su tuerca de latón
  const P = PRENSA_TALLER;
  pushBox(s, [P.x - 0.3, P.y - 0.28, z, P.x + 0.3, P.y + 0.28, z + LIBRO_PRENSA.z], ROBLE_T);
  for (const d of [-1, 1]) {
    const xa = P.x + d * 0.31;
    pushBox(s, [xa - 0.05, P.y - 0.1, z, xa + 0.05, P.y + 0.1, 1.44], ROBLE_TD);
    pushBox(s, [xa - 0.035, P.y - 0.035, 1.46, xa + 0.035, P.y + 0.035, 1.49], LATON_T);
  }
  pushBox(s, [P.x - 0.38, P.y - 0.12, 1.36, P.x + 0.38, P.y + 0.12, 1.46], ROBLE_TD);
  pushBox(s, [P.x - 0.045, P.y - 0.045, 1.46, P.x + 0.045, P.y + 0.045, 1.49], LATON_T);

  // La lámpara de brazo, con su pantalla verde y la bombilla, y la lupa en su brazo, por encima del tapete
  pushBox(s, [60.9, 0.1, z, 61.0, 0.2, z + 0.04], LATON_TD);
  paloKit(s, [60.95, 0.15, z + 0.04], [60.95, 0.15, 1.38], 0.022, LATON_T);
  paloKit(s, [60.95, 0.15, 1.38], [61.52, 0.3, 1.46], 0.018, LATON_T);
  paloKit(s, [61.52, 0.3, 1.46], [61.58, 0.36, 1.4], 0.018, LATON_T);
  pushBox(s, [61.5, 0.28, 1.36, 61.66, 0.44, 1.4], VERDE_B);
  pushBox(s, [61.47, 0.25, 1.33, 61.69, 0.47, 1.36], [38, 74, 52]);
  pushBox(s, [61.54, 0.32, 1.315, 61.62, 0.4, 1.333], [255, 222, 156], { glow: true });
  paloKit(s, [60.95, 0.15, 1.08], [61.3, 0.36, 1.13], 0.014, LATON_T);
  for (let k = 0; k < 14; k += 1) {
    const a = (k / 14) * Math.PI * 2;
    const [lx, ly] = [61.36 + Math.cos(a) * 0.065, 0.42 + Math.sin(a) * 0.065];
    pushBox(s, [lx - 0.009, ly - 0.009, 1.12, lx + 0.009, ly + 0.009, 1.14], LATON_T);
  }
  pushBox(s, [61.33, 0.39, 1.128, 61.35, 0.41, 1.132], [226, 240, 244], { glow: true });

  // La lámpara de techo, con su pantalla de esmalte verde
  paloKit(s, [61.9, 1.45, TALLER.alto], [61.9, 1.45, 2.6], 0.012, [40, 36, 34]);
  pushBox(s, [61.8, 1.35, 2.52, 62.0, 1.55, 2.6], VERDE_B);
  pushBox(s, [61.76, 1.31, 2.48, 62.04, 1.59, 2.52], [38, 74, 52]);
  pushBox(s, [61.86, 1.41, 2.46, 61.94, 1.49, 2.48], [255, 222, 156], { glow: true });

  // Las herramientas colgadas de su listón: martillo, tijeras, punzones, plegaderas, brochas y la cuchilla
  pushBox(s, [60.5, 0.02, 1.2, 62.3, 0.06, 1.26], ROBLE_T);
  pushBox(s, [60.62, 0.06, 0.98, 60.645, 0.08, 1.2], ROBLE_TD);
  pushBox(s, [60.58, 0.055, 0.96, 60.69, 0.085, 1.0], HIERRO_TL);
  pushBox(s, [60.84, 0.06, 1.0, 60.855, 0.075, 1.2], [176, 178, 182]);
  pushBox(s, [60.875, 0.06, 1.0, 60.89, 0.075, 1.2], [176, 178, 182]);
  pushBox(s, [60.83, 0.058, 1.12, 60.9, 0.078, 1.16], LATON_T);
  for (let k = 0; k < 3; k += 1) {
    const xa = 61.12 + k * 0.05;
    pushBox(s, [xa, 0.062, 1.04 + k * 0.02, xa + 0.008, 0.07, 1.16], [176, 178, 182]);
    pushBox(s, [xa - 0.012, 0.058, 1.16, xa + 0.02, 0.078, 1.2], ROBLE_TD);
  }
  for (const xa of [61.38, 61.44]) pushBox(s, [xa, 0.062, 1.0, xa + 0.03, 0.07, 1.2], HUESO);
  for (const [xa, c] of [
    [61.86, [196, 176, 140]],
    [62.0, [170, 150, 120]],
  ]) {
    pushBox(s, [xa, 0.06, 1.08, xa + 0.02, 0.08, 1.2], ROBLE_TD);
    pushBox(s, [xa - 0.012, 0.058, 1.04, xa + 0.032, 0.082, 1.08], LATON_T);
    pushBox(s, [xa - 0.014, 0.058, 0.99, xa + 0.034, 0.082, 1.04], c);
  }
  pushBox(s, [62.14, 0.06, 1.02, 62.2, 0.07, 1.12], [196, 198, 202]);
  pushBox(s, [62.15, 0.058, 1.12, 62.19, 0.078, 1.2], ROBLE_TD);

  // El cordel de los papeles jaspeados, con sus pinzas de madera
  pushBox(s, [60.38, 0.12, 2.245, 61.78, 0.13, 2.252], [92, 80, 66]);
  for (const [, xc] of JASPEADOS) for (const d of [-0.12, 0.12]) pushBox(s, [xc + d - 0.012, 0.115, 2.19, xc + d + 0.012, 0.14, 2.26], WOOD_L);

  // El alféizar del ventanuco, con una maceta pequeña
  pushBox(s, [VENTANUCO_T.x0 - 0.08, 0, VENTANUCO_T.z0 - 0.06, VENTANUCO_T.x1 + 0.08, 0.1, VENTANUCO_T.z0 - 0.02], ROBLE_T);
  const maceta = VENTANUCO_T.x0 + 0.12;
  pushBox(s, [maceta, 0.03, VENTANUCO_T.z0 - 0.02, maceta + 0.1, 0.09, VENTANUCO_T.z0 + 0.06], [176, 92, 60]);
  for (const [dx, dz] of [
    [0, 0.06],
    [-0.025, 0.1],
    [0.025, 0.11],
    [0, 0.15],
  ])
    pushBox(s, [maceta + 0.035 + dx, 0.05, VENTANUCO_T.z0 + dz, maceta + 0.065 + dx, 0.07, VENTANUCO_T.z0 + dz + 0.04], [86, 130, 80]);

  // Los carretes de hilo de colores, en su balda, a la derecha del ventanuco
  pushBox(s, [63.0, 0.02, 1.84, 63.58, 0.11, 1.87], ROBLE_T);
  HILOS_T.forEach((c, k) => {
    const xa = 63.04 + k * 0.088;
    pushBox(s, [xa, 0.03, 1.87, xa + 0.06, 0.09, 1.88], WOOD_L);
    pushBox(s, [xa + 0.006, 0.036, 1.88, xa + 0.054, 0.084, 1.95], c);
    pushBox(s, [xa, 0.03, 1.95, xa + 0.06, 0.09, 1.96], WOOD_L);
  });

  // El hornillo con el cazo de la cola caliente y el bote de engrudo (el pincel de la cola, con lo que se mueve)
  pushBox(s, [60.5, 0.5, z, 60.72, 0.72, z + 0.08], HIERRO_TL);
  pushBox(s, [60.53, 0.718, z + 0.02, 60.69, 0.722, z + 0.045], [255, 140, 70], { glow: true });
  pushBox(s, [60.53, 0.53, z + 0.08, 60.69, 0.69, z + 0.18], [190, 112, 70]);
  pushBox(s, [60.525, 0.525, z + 0.17, 60.695, 0.695, z + 0.185], [226, 150, 96]);
  pushBox(s, [60.545, 0.545, z + 0.172, 60.675, 0.675, z + 0.178], COLA_T);
  pushBox(s, [60.69, 0.59, z + 0.12, 60.78, 0.63, z + 0.14], ROBLE_TD);
  pushBox(s, [60.8, 0.62, z, 60.94, 0.76, z + 0.11], [176, 120, 82]);
  pushBox(s, [60.79, 0.61, z + 0.1, 60.95, 0.77, z + 0.12], [150, 98, 66]);
  pushBox(s, [60.81, 0.63, z + 0.115, 60.93, 0.75, z + 0.118], [240, 236, 226]);

  // La estantería de la pared de la izquierda: libros a la espera, tarros de colores y pieles de cuero enrolladas
  const E = { x0: TALLER.x0, x1: TALLER.x0 + 0.32, y0: 1.95, y1: 3.35 };
  pushBox(s, [E.x0, E.y0 - 0.04, 0, E.x1, E.y0, 2.2], ROBLE_TD);
  pushBox(s, [E.x0, E.y1, 0, E.x1, E.y1 + 0.04, 2.2], ROBLE_TD);
  [0.08, 0.6, 1.12, 1.64, 2.16].forEach((zb, i) => {
    pushBox(s, [E.x0, E.y0, zb, E.x1, E.y1, zb + 0.035], ROBLE_T);
    if (i === 4) return;
    let y = E.y0 + 0.03;
    for (let k = 0; y < E.y1 - 0.08; k += 1) {
      const h = hash(i * 7 + 1, k);
      if (i === 1 && h > 0.72) {
        // Un tarro de cristal con su color (pigmentos, engrudo, granos de cola)
        const c = HILOS_T[k % HILOS_T.length];
        pushBox(s, [E.x0 + 0.08, y, zb + 0.035, E.x0 + 0.22, y + 0.13, zb + 0.2], [196, 214, 206]);
        pushBox(s, [E.x0 + 0.09, y + 0.01, zb + 0.04, E.x0 + 0.215, y + 0.12, zb + 0.12], c);
        pushBox(s, [E.x0 + 0.075, y - 0.005, zb + 0.2, E.x0 + 0.225, y + 0.135, zb + 0.22], ROBLE_TD);
        y += 0.15;
        continue;
      }
      if (i === 3 && h > 0.6) {
        pushBox(s, [E.x0 + 0.04, y, zb + 0.035, E.x1 - 0.02, y + 0.11, zb + 0.14], k % 2 ? CUERO : CUERO_D);
        y += 0.13;
        continue;
      }
      const ancho = 0.03 + hash(k, i + 7) * 0.035;
      const alto = 0.24 + hash(i + 3, k) * 0.18;
      pushBox(s, [E.x0 + 0.04, y, zb + 0.035, E.x1 - 0.03 - h * 0.03, y + ancho, zb + 0.035 + alto], LOMOS_T[Math.floor(hash(k, i) * LOMOS_T.length)]);
      y += ancho + 0.004;
    }
  });

  // La cajonera de los papeles, en la pared de la derecha, con sus tiradores y los rollos encima
  const C = { x0: TALLER.x1 - 0.42, x1: TALLER.x1, y0: 1.4, y1: 2.95, alto: 1.02 };
  pushBox(s, [C.x0, C.y0, 0, C.x1, C.y1, C.alto], ROBLE_TD);
  for (let k = 0; k < 6; k += 1) {
    const zb = 0.08 + k * 0.155;
    pushBox(s, [C.x0 - 0.01, C.y0 + 0.04, zb, C.x0, C.y1 - 0.04, zb + 0.13], ROBLE_T);
    pushBox(s, [C.x0 - 0.03, (C.y0 + C.y1) / 2 - 0.08, zb + 0.05, C.x0 - 0.01, (C.y0 + C.y1) / 2 + 0.08, zb + 0.075], LATON_T);
  }
  for (const [ya, c] of [
    [1.5, CUERO],
    [1.75, [214, 200, 168]],
    [2.0, CUERO_D],
    [2.3, [196, 160, 92]],
  ])
    pushBox(s, [C.x0 + 0.04, ya, C.alto, C.x1 - 0.04, ya + 0.16, C.alto + 0.15], c);

  // El taburete alto de don Celestino
  const T = { x: 61.1, y: 1.62 };
  for (const [dx, dy] of [
    [-0.13, -0.13],
    [0.1, -0.13],
    [-0.13, 0.1],
    [0.1, 0.1],
  ])
    pushBox(s, [T.x + dx, T.y + dy, 0, T.x + dx + 0.03, T.y + dy + 0.03, 0.72], ROBLE_TD);
  pushBox(s, [T.x - 0.16, T.y - 0.16, 0.72, T.x + 0.16, T.y + 0.16, 0.77], ROBLE_T);
  pushBox(s, [T.x - 0.13, T.y - 0.13, 0.3, T.x + 0.13, T.y + 0.13, 0.32], ROBLE_TD);
}

/** Lo que se mueve de la prensa: la platina, que baja con el husillo, la rosca y la cruceta que gira (`p`, la vista de la prensa). */
function prensaVivaKit(s, p = {}) {
  const { x, y } = PRENSA_TALLER;
  const z0 = platinaZ(p.prensa ?? 0);
  const tope = husilloZ(p.prensa ?? 0);
  pushBox(s, [x - 0.25, y - 0.24, z0, x + 0.25, y + 0.24, z0 + 0.05], ROBLE_T);
  pushBox(s, [x - 0.016, y - 0.016, z0 + 0.05, x + 0.016, y + 0.016, tope], HIERRO_TL);
  for (let zz = z0 + 0.08; zz < tope - 0.04; zz += 0.035) pushBox(s, [x - 0.019, y - 0.019, zz, x + 0.019, y + 0.019, zz + 0.012], [92, 88, 86]);
  const xf = giro([x, y, tope], 'z', p.angulo ?? 0);
  pushBox(s, [x - 0.2, y - 0.012, tope - 0.024, x + 0.2, y + 0.012, tope], HIERRO_TL, { xf });
  for (const d of [-1, 1]) pushBox(s, [x + d * 0.2 - 0.022, y - 0.022, tope - 0.034, x + d * 0.2 + 0.022, y + 0.022, tope + 0.01], LATON_T, { xf });
  pushBox(s, [x - 0.03, y - 0.03, tope - 0.03, x + 0.03, y + 0.03, tope + 0.006], LATON_TD);
}

/** Las herramientas del banco, en su sitio (menos la que tienes en la mano): brocha, goma, plegadera, sello, hierro y pan de oro. */
function utilesTaller(s, mano) {
  const z = BANCO.z;
  if (mano !== 'brocha') {
    pushBox(s, [62.38, 0.845, z, 62.56, 0.87, z + 0.02], ROBLE_TD);
    pushBox(s, [62.56, 0.84, z, 62.59, 0.875, z + 0.024], LATON_T);
    pushBox(s, [62.59, 0.838, z, 62.645, 0.877, z + 0.022], [196, 176, 140]);
  }
  if (mano !== 'goma') pushBox(s, [62.7, 0.8, z, 62.75, 0.84, z + 0.026], MIGA_T);
  if (mano !== 'plegadera') pushBox(s, [62.36, 0.71, z, 62.56, 0.735, z + 0.006], HUESO);
  if (mano !== 'sello') selloKit(s, 62.79, 0.62, z);
  // El hierro de dorar, sobre su hornillo con las brasas, y el librillo de pan de oro
  pushBox(s, [62.56, 0.22, z, 62.72, 0.36, z + 0.05], HIERRO_TL);
  pushBox(s, [62.58, 0.36, z + 0.015, 62.7, 0.362, z + 0.03], [255, 140, 70], { glow: true });
  if (mano !== 'hierro') {
    pushBox(s, [62.6, 0.28, z + 0.05, 62.62, 0.3, z + 0.068], [255, 176, 96], { glow: true });
    paloKit(s, [62.62, 0.29, z + 0.062], [62.74, 0.29, z + 0.07], 0.01, LATON_T);
    paloKit(s, [62.74, 0.29, z + 0.07], [62.86, 0.29, z + 0.076], 0.018, ROBLE_TD);
  }
  pushBox(s, [62.36, 0.22, z, 62.46, 0.32, z + 0.006], [196, 168, 120]);
  pushBox(s, [62.37, 0.23, z + 0.006, 62.45, 0.31, z + 0.007], [236, 196, 100]);
  // El pincel de la cola, apoyado en el cazo
  if (mano !== 'pincel') paloKit(s, [60.61, 0.6, z + 0.15], [60.67, 0.66, z + 0.32], 0.014, ROBLE_TD);
}

/**
 * La herramienta en la mano, apoyada en `c` (el punto del libro donde está el dedo): la brocha, la goma de miga, el canto de la
 * mano, la plegadera de hueso, el pincel de la cola o el hierro caliente (el sello del ex libris va aparte, con `selloKit`). Sin
 * apretar, flota un poco por encima; el mango sube hacia la derecha y hacia ti, como en una mano derecha.
 */
function herramientaKit(s, nombre, [x, y, z], { baja = 0 } = {}) {
  const z0 = z + (1 - clamp(baja, 0, 1)) * 0.025;
  const o = { g: 0.9 };
  const mango = (desde, largo, color, grueso = 0.01) => paloKit(s, desde, [desde[0] + largo * 0.3, desde[1] + largo * 0.6, desde[2] + largo * 0.74], grueso, color, o);
  if (nombre === 'brocha') {
    // La paletina ancha de pelo de cabra (tras ver la 1.133: limpia en unas cuatro pasadas), con su virola de latón
    pushBox(s, [x - 0.045, y - 0.008, z0, x + 0.045, y + 0.008, z0 + 0.026], [214, 196, 160], o);
    pushBox(s, [x - 0.045, y - 0.0085, z0, x + 0.045, y + 0.0085, z0 + 0.006], [176, 156, 120], o);
    pushBox(s, [x - 0.043, y - 0.01, z0 + 0.026, x + 0.043, y + 0.01, z0 + 0.04], LATON_T, o);
    pushBox(s, [x - 0.03, y - 0.008, z0 + 0.04, x + 0.03, y + 0.008, z0 + 0.05], ROBLE_TD, o);
    mango([x, y, z0 + 0.05], 0.08, ROBLE_TD);
  } else if (nombre === 'goma') {
    pushBox(s, [x - 0.022, y - 0.016, z0, x + 0.022, y + 0.016, z0 + 0.026 - baja * 0.004], MIGA_T, o);
  } else if (nombre === 'mano') {
    pushBox(s, [x - 0.01, y - 0.045, z0, x + 0.01, y + 0.045, z0 + 0.035], PIEL_T, o);
    pushBox(s, [x - 0.004, y - 0.045, z0 + 0.035, x + 0.05, y + 0.045, z0 + 0.05], PIEL_T, o);
    paloKit(s, [x + 0.045, y + 0.02, z0 + 0.06], [x + 0.09, y + 0.08, z0 + 0.11], 0.04, [150, 140, 72], o);
  } else if (nombre === 'plegadera') {
    paloKit(s, [x, y, z0 + 0.004], [x + 0.03, y + 0.09, z0 + 0.04], 0.012, HUESO, o);
  } else if (nombre === 'pincel') {
    pushBox(s, [x - 0.008, y - 0.008, z0, x + 0.008, y + 0.008, z0 + 0.02], COLA_T, o);
    pushBox(s, [x - 0.007, y - 0.007, z0 + 0.02, x + 0.007, y + 0.007, z0 + 0.034], LATON_T, o);
    mango([x, y, z0 + 0.038], 0.08, ROBLE_TD, 0.008);
  } else if (nombre === 'hierro') {
    // El mango viene hacia ti y un poco a la izquierda, bajo el título y hacia lo ya dorado (hacia la derecha o hacia arriba
    // taparía las letras que faltan)
    pushBox(s, [x - 0.012, y - 0.012, z0, x + 0.012, y + 0.012, z0 + 0.018], [255, 176, 96], { glow: true });
    paloKit(s, [x, y, z0 + 0.02], [x - 0.004, y + 0.032, z0 + 0.034], 0.007, LATON_T, o);
    paloKit(s, [x - 0.004, y + 0.032, z0 + 0.034], [x - 0.018, y + 0.09, z0 + 0.05], 0.011, ROBLE_TD, o);
  }
}

/** El polvo que levanta la brocha: motas a contraluz que suben y se van apartando (`nube`, de la vista del polvo; `ahora`, su reloj). */
function nubeKit(s, nube, ahora, punto) {
  nube.forEach((n, i) => {
    const edad = (ahora - n.t) / 1000;
    if (!(edad >= 0 && edad < 1.6)) return;
    for (let k = 0; k < 3; k += 1) {
      const [h1, h2, h3] = [hash(i, k + 1), hash(i, k + 5), hash(i, k + 9)];
      const [x, y, z] = punto(n.u + (h1 - 0.5) * 0.12, n.v + (h2 - 0.5) * 0.12);
      const sube = edad * (0.05 + h3 * 0.07);
      const dx = (h1 - 0.5) * edad * 0.05;
      const d = 0.0012;
      pushBox(s, [x + dx - d, y - d, z + sube, x + dx + d, y + d, z + sube + d * 2], [255, 238, 205], { glow: true });
    }
  });
}

/** El cuerpo del libro (en su sitio, ver `LIBRO_Z`): la tapa de atrás, el bloque de hojas con sus cantos y el lomo con sus nervios. */
function libroTallerKit(s, tela) {
  const { ancho: A, hondo: H } = LIBRO_TALLER;
  const o = { g: 0.86 };
  const osc = tela.map((v) => Math.round(v * 0.72));
  pushBox(s, [0, -0.002, 0, A + 0.002, H + 0.002, 0.004], tela, o);
  pushBox(s, [0.004, 0.004, 0.004, A - 0.004, H - 0.004, LIBRO_Z.pagina], PAPEL_T, o);
  for (const zz of [0.012, 0.021, 0.03]) pushBox(s, [0.004, H - 0.0045, zz, A - 0.004, H - 0.0035, zz + 0.0015], [206, 192, 160], o);
  pushBox(s, [-0.008, -0.002, 0, 0.004, H + 0.002, LIBRO_Z.grueso], osc, o);
  for (const yy of [0.06, 0.14, 0.22, 0.3]) pushBox(s, [-0.01, yy, 0.006, -0.007, yy + 0.012, LIBRO_Z.grueso - 0.006], osc.map((v) => Math.round(v * 0.85)), o);
}
/** La tapa de delante, que gira sobre el lomo: el cartón forrado, centrado a lo hondo en su bisagra. */
function tapaTallerKit(s, tela) {
  const { ancho: A, hondo: H } = LIBRO_TALLER;
  pushBox(s, [0, -H / 2 - 0.002, 0.019, A + 0.002, H / 2 + 0.002, 0.0228], tela, { g: 0.86 });
}

const ENFOQUE_TOSTADOR = { p: [39.6, 1.45, 1.75], m: [37.0, 1.45, 0.65] };

export function mountCafe(container, { onPick = () => {}, onFrame = () => {}, onLost = () => {}, onMove = () => {}, onDecor = () => {}, onSonido = () => {} } = {}) {
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
  // ── Bloque 6a: la bodega (nivel 6), aparte en el mundo, y la trampilla de detrás de la barra ──
  // Bloque 6b: dos bodegas, la del nivel 6 y la del 7 (más ancha, con el tostador); se ve una u otra
  const bodegaKit = (B, luces, bodegaGrupo) => conLuces(luces, () => {
    const { x0, x1, y0, y1, alto } = B;
    const [ancho, hondo, cx, cy] = [x1 - x0, y1 - y0, (x0 + x1) / 2, (y0 + y1) / 2];
    bodegaGrupo.add(
      plane(ancho, hondo, paintSueloBodega(), (m) => {
        m.rotation.x = -Math.PI / 2;
        m.position.set(cx, 0, cy);
      }),
    );
    bodegaGrupo.add(
      plane(ancho, hondo, paintBovedaBodega(), (m) => {
        m.rotation.x = Math.PI / 2;
        m.position.set(cx, alto, cy);
      }),
    );
    bodegaGrupo.add(
      plane(
        ancho,
        alto,
        paintMuro(ancho, (a, b) => [x0 + a, y0 + 0.05, b]),
        (m) => m.position.set(cx, alto / 2, y0),
      ),
    );
    bodegaGrupo.add(
      plane(
        hondo,
        alto,
        paintMuro(hondo, (a, b) => [x0 + 0.05, y1 - a, b]),
        (m) => {
          m.rotation.y = Math.PI / 2;
          m.position.set(x0, alto / 2, cy);
        },
      ),
    );
    bodegaGrupo.add(
      plane(
        hondo,
        alto,
        paintMuro(hondo, (a, b) => [x1 - 0.05, y0 + a, b]),
        (m) => {
          m.rotation.y = -Math.PI / 2;
          m.position.set(x1, alto / 2, cy);
        },
      ),
    );
    bodegaGrupo.add(
      plane(
        ancho,
        alto,
        paintMuro(ancho, (a, b) => [x1 - a, y1 - 0.05, b], ventanuco),
        (m) => {
          m.rotation.y = Math.PI;
          m.position.set(cx, alto / 2, y1);
        },
      ),
    );
    // Lo que no se ve desde arriba al decorar: los arcos, las barricas, el botellero, la escalera y los faroles
    const s = kit();
    arcosBodega(s);
    barricasBodega(s);
    botelleroBodega(s);
    mostradorCatas(s);
    escaleraBodega(s);
    farolesBodega(s);
    const m = new Mesh(own(geometryOf(s)), flat);
    bodegaGrupo.add(m);
    return m;
  });
  const montarBodega = (B, luces) => {
    const grupo = new Group();
    grupo.visible = false;
    scene.add(grupo);
    const antes = BOD;
    BOD = B;
    try {
      return { grupo, piezas: bodegaKit(B, luces, grupo) };
    } finally {
      BOD = antes;
    }
  };
  const bodega6 = montarBodega(BODEGA, LUZ_BODEGA);
  const bodega7 = montarBodega(BODEGA_TOSTADERO, LUZ_TOSTADERO);
  const bodega8 = montarBodega(BODEGA_CATAS, LUZ_CATAS);
  // Bloque 6c: el tostador, en su sitio en el 7 y en el 8 (la pared de la izquierda no se mueve)
  const tostadorFijo = new Group();
  tostadorFijo.visible = false;
  scene.add(tostadorFijo);
  conLuces(LUZ_TOSTADERO, () => {
    const s = kit();
    tostadorKit(s);
    tostadorFijo.add(new Mesh(own(geometryOf(s)), flat));
  });
  // Lo que se mueve del tostador, que se vuelve a montar con cada cambio
  const tostadorGrupo = new Group();
  tostadorFijo.add(tostadorGrupo);
  let tost = { activa: false, est: {} };
  function montarTostador() {
    for (const m of tostadorGrupo.children.slice()) {
      tostadorGrupo.remove(m);
      m.geometry.dispose();
    }
    conLuces(LUZ_TOSTADERO, () => {
      const s = kit();
      tostadorVivoKit(s, tost.est);
      tostadorGrupo.add(new Mesh(geometryOf(s), flat));
    });
    invalidate();
  }
  const trampillaM = (() => {
    const s = kit();
    trampillaKit(s);
    const m = new Mesh(own(geometryOf(s)), flat);
    m.visible = false;
    scene.add(m);
    return m;
  })();
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
    // 1.130: la caja oscura olvidada en la estantería vieja se va con los trastos (ahí van las secciones)
    pushBox(s, [0.08, ESTANTERIA.y0 + 1.6, 1.32, 0.3, ESTANTERIA.y0 + 1.72, 1.66], [46, 40, 52]);
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

  // ── 1.133: el taller de la trastienda (nivel 3): la puerta baja de detrás de la barra y, aparte en el mundo, el cuarto de don
  // Celestino. `tall.est`, lo que se ve al trabajar (Taller.jsx): { vista ('entrada', 'tapa', 'titulo', 'lomo', 'pliego',
  // 'izquierda', 'derecha', 'prensa' o 'ficha'), encargo (de `encargoDe`, o null: el banco vacío), vistas (de `vistasDe`), abre
  // (el libro, de 0 a 1), enPrensa (de 0 a 1, el libro que va a la prensa), herramienta (la que tienes en la mano), superficie
  // ('tapa' o 'pliego'), pose ({ u, v, baja }), nube (el polvo que sube) y ahora (su reloj, en ms) }. ──
  const puertaTaller = [0, 1].map((abre) => {
    const s = kit();
    puertaTallerKit(s, abre);
    const m = new Mesh(own(geometryOf(s)), flat);
    m.visible = false;
    scene.add(m);
    return m;
  });
  const huecoTaller = plane(
    PUERTA_TALLER.y1 - PUERTA_TALLER.y0,
    PUERTA_TALLER.alto,
    paintHuecoTaller(),
    (m) => {
      m.rotation.y = -Math.PI / 2;
      m.position.set(SW - 0.004, PUERTA_TALLER.alto / 2, (PUERTA_TALLER.y0 + PUERTA_TALLER.y1) / 2);
      m.visible = false;
    },
  );
  let puertaAbierta = false;
  const verPuerta = () => {
    const hay = estado.inaugurado && estado.nivel >= SITIOS.taller.nivel;
    puertaTaller[0].visible = hay && !puertaAbierta;
    puertaTaller[1].visible = hay && puertaAbierta;
    huecoTaller.visible = hay && puertaAbierta;
  };
  const tallerGrupo = new Group();
  tallerGrupo.visible = false;
  scene.add(tallerGrupo);
  const lluviaTallerCanvas = document.createElement('canvas');
  lluviaTallerCanvas.width = 26;
  lluviaTallerCanvas.height = 20;
  let lluviaTaller = null;
  conLuces(LUZ_TALLER, () => {
    const { x0, x1, y0, y1, alto } = TALLER;
    const [ancho, hondo, cx, cy] = [x1 - x0, y1 - y0, (x0 + x1) / 2, (y0 + y1) / 2];
    tallerGrupo.add(
      plane(ancho, hondo, paintSueloTaller(), (m) => {
        m.rotation.x = -Math.PI / 2;
        m.position.set(cx, 0, cy);
      }),
    );
    tallerGrupo.add(
      plane(ancho, hondo, paintTechoTaller(), (m) => {
        m.rotation.x = Math.PI / 2;
        m.position.set(cx, alto, cy);
      }),
    );
    tallerGrupo.add(plane(ancho, alto, paintParedTaller(ancho, (a, b) => [x0 + a, y0 + 0.05, b], ventanucoTaller), (m) => m.position.set(cx, alto / 2, y0)));
    tallerGrupo.add(
      plane(hondo, alto, paintParedTaller(hondo, (a, b) => [x0 + 0.05, y1 - a, b]), (m) => {
        m.rotation.y = Math.PI / 2;
        m.position.set(x0, alto / 2, cy);
      }),
    );
    tallerGrupo.add(
      plane(hondo, alto, paintParedTaller(hondo, (a, b) => [x1 - 0.05, y0 + a, b]), (m) => {
        m.rotation.y = -Math.PI / 2;
        m.position.set(x1, alto / 2, cy);
      }),
    );
    tallerGrupo.add(
      plane(ancho, alto, paintParedTaller(ancho, (a, b) => [x1 - a, y1 - 0.05, b], puertaTallerDentro), (m) => {
        m.rotation.y = Math.PI;
        m.position.set(cx, alto / 2, y1);
      }),
    );
    const s = kit();
    tallerKit(s);
    tallerGrupo.add(new Mesh(own(geometryOf(s)), flat));
    // Los papeles jaspeados, secándose en el cordel
    JASPEADOS.forEach(([paleta, xc], k) => tallerGrupo.add(plane(0.36, 0.44, paintJaspeado(paleta, k * 3.7, glowAt(xc, 0.2, 2.0)), (m) => m.position.set(xc, 2.0, 0.135))));
    // Don Celestino, junto a su taburete, mirando al banco y a la puerta
    const c = new Mesh(own(geometryOf(celestinoKit(glowAt(CELESTINO.x, CELESTINO.y, 1.5) + 0.06))), flat);
    c.position.set(CELESTINO.x, 0, CELESTINO.y);
    c.rotation.y = Math.atan2(VISTA_ENTRADA.p[0] - CELESTINO.x, VISTA_ENTRADA.p[1] - CELESTINO.y);
    tallerGrupo.add(c);
    // La lluvia en el cristal del ventanuco
    const V = VENTANUCO_T;
    lluviaTaller = plane(V.x1 - V.x0, V.z1 - V.z0, lluviaTallerCanvas, (m) => m.position.set((V.x0 + V.x1) / 2, (V.z0 + V.z1) / 2, y0 + 0.025), { glow: true });
    tallerGrupo.add(lluviaTaller);
  });
  // El libro del banco: el cuerpo (la tapa de atrás, las hojas y el lomo), la primera página y la tapa, que gira sobre el lomo
  // con su cara (la tapa pintada) y su revés (la guarda). La tapa y las dos páginas se pintan en dos lienzos (`cafeTallerPintura`).
  const tapaLienzo = lienzo(TAPA_PX.w, TAPA_PX.h);
  const pliegoLienzo = lienzo(PLIEGO_PX.w, PLIEGO_PX.h);
  const tapaTex = own(texture(tapaLienzo));
  const guardaTex = own(texture(pliegoLienzo));
  guardaTex.repeat.set(0.5, 1);
  const paginaTex = own(texture(pliegoLienzo));
  paginaTex.repeat.set(0.5, 1);
  paginaTex.offset.set(0.5, 0);
  const hojaGeo = own(new PlaneGeometry(LIBRO_TALLER.ancho, LIBRO_TALLER.hondo));
  const hoja = (map) => new Mesh(hojaGeo, own(new MeshBasicMaterial({ map, color: 0xeee2d0 })));
  const libroT = new Group();
  libroT.visible = false;
  tallerGrupo.add(libroT);
  const paginaM = hoja(paginaTex);
  paginaM.rotation.x = -Math.PI / 2;
  paginaM.position.set(LIBRO_TALLER.ancho / 2, LIBRO_Z.pagina, LIBRO_TALLER.hondo / 2);
  libroT.add(paginaM);
  const tapaG = new Group();
  tapaG.position.set(0, LIBRO_Z.bisagra, LIBRO_TALLER.hondo / 2);
  libroT.add(tapaG);
  const tapaM = hoja(tapaTex);
  tapaM.rotation.x = -Math.PI / 2;
  tapaM.position.set(LIBRO_TALLER.ancho / 2, LIBRO_Z.tapa - LIBRO_Z.bisagra, 0);
  tapaG.add(tapaM);
  // El revés de la tapa: girado para que, con el libro abierto (la tapa dada la vuelta), la guarda se lea derecha
  const guardaM = hoja(guardaTex);
  guardaM.rotation.set(-Math.PI / 2, 0, Math.PI, 'ZYX');
  guardaM.position.set(LIBRO_TALLER.ancho / 2, LIBRO_Z.bisagra - LIBRO_Z.guarda, 0);
  tapaG.add(guardaM);
  let cuerpoM = null;
  let placaM = null;
  let libroDe = null;
  // Lo último pintado en los lienzos (al cambiar de libro, nada)
  const SIN_PINTAR = {};
  let vistasPintadas = SIN_PINTAR;
  // Lo que se mueve (la prensa, las herramientas y el polvo), que se vuelve a montar con cada cambio
  const tallerVivo = new Group();
  tallerGrupo.add(tallerVivo);
  let tall = { activa: false, est: {} };
  // El polvo que flota en la luz de la lámpara de brazo y el vaho del cazo de la cola
  const MOTAS_T = 30;
  const VAHO = 10;
  const motaTGeo = own(new BufferGeometry());
  motaTGeo.setAttribute('position', new Float32BufferAttribute(new Float32Array((MOTAS_T + VAHO) * 3), 3));
  motaTGeo.setAttribute('color', new Float32BufferAttribute(new Float32Array((MOTAS_T + VAHO) * 3), 3));
  const motasT = new Points(motaTGeo, own(new PointsMaterial({ size: 1, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending })));
  motasT.frustumCulled = false;
  motasT.renderOrder = 3;
  tallerGrupo.add(motasT);
  const moverMotasT = (t) => {
    const p = motaTGeo.attributes.position;
    const c = motaTGeo.attributes.color;
    for (let k = 0; k < MOTAS_T; k += 1) {
      const [a, b, d, e] = [hash(k, 11), hash(k, 12), hash(k, 13), hash(k, 14)];
      const ang = a * Math.PI * 2 + t * 0.06 * (0.5 + d);
      const rad = 0.05 + b * 0.32;
      p.setXYZ(k, 61.62 + Math.cos(ang) * rad, 0.92 + frac(e + t * 0.012 * (0.4 + d)) * 0.4, 0.45 + Math.sin(ang) * rad * 0.7);
      const brillo = 0.55 + 0.45 * Math.sin(t * 1.3 + k);
      c.setXYZ(k, 0.85 * brillo, 0.74 * brillo, 0.55 * brillo);
    }
    for (let k = 0; k < VAHO; k += 1) {
      const f = frac(hash(k, 21) + t * 0.16);
      p.setXYZ(MOTAS_T + k, 60.61 + Math.sin(t * 0.9 + k * 1.7) * 0.02 * (1 + f * 2), BANCO.z + 0.19 + f * 0.32, 0.61 + Math.cos(t * 0.7 + k) * 0.015);
      const v = (1 - f) * 0.32;
      c.setXYZ(MOTAS_T + k, v, v, v * 0.95);
    }
    p.needsUpdate = true;
    c.needsUpdate = true;
  };
  /** Dónde está el libro (ver `enTapa`): en el banco o, al prensar, de camino a la prensa (sube, va y entra por delante). */
  function libroOrigen(e = tall.est) {
    const t = clamp(e.enPrensa ?? 0, 0, 1);
    const tramos = [
      [LIBRO_BANCO.x, LIBRO_BANCO.y, BANCO.z],
      [LIBRO_BANCO.x, 0.62, BANCO.z + 0.13],
      [LIBRO_PRENSA.x, 0.62, BANCO.z + 0.13],
      [LIBRO_PRENSA.x, LIBRO_PRENSA.y, BANCO.z + LIBRO_PRENSA.z],
    ];
    const f = t * 3;
    const i = Math.min(2, Math.floor(f));
    const u = f - i;
    const k = u * u * (3 - 2 * u);
    const [x, y, z] = tramos[i].map((v, j) => v + (tramos[i + 1][j] - v) * k);
    return { x, y, z };
  }
  /** La cámara del taller según lo que se hace: de cerca a cada cosa, desde delante y arriba (el cuadro va abajo: lo que se toca queda arriba). */
  function vistaTaller(e = tall.est) {
    const L = libroOrigen(e);
    const { ancho: A, hondo: H } = LIBRO_TALLER;
    const ta = tanAncho();
    const tv = Math.tan((camera.fov * Math.PI) / 360);
    const encima = ([x, y, z], ancho, el = 1.0, sube = 0.3) => {
      const d = Math.max(ancho / 2 / ta, (ancho * 0.72) / tv);
      return { p: [x, y + d * Math.cos(el), z + d * Math.sin(el)], m: [x, y + d * sube, z] };
    };
    const letras = letrasTapa(e.encargo?.tapa ?? '');
    const centro = letras.length ? [letras.reduce((s2, l) => s2 + l.u, 0) / letras.length, letras[0].v] : [0.58, 0.2];
    switch (e.vista) {
      case 'tapa':
        return encima(enTapa(L, 0.5, 0.5), 0.36);
      case 'titulo':
        // el título, más al centro que lo demás (debajo viene el mango del hierro)
        return encima(enTapa(L, ...centro), 0.24, 1.0, 0.12);
      case 'lomo':
        return encima(enTapa(L, 0.3, 0.5), 0.3);
      case 'pliego':
        return encima([L.x, L.y + H / 2, L.z + 0.025], 0.62);
      case 'izquierda':
        return encima(enPliego(L, 0.25, 0.5), 0.36);
      case 'derecha':
        return encima(enPliego(L, 0.75, 0.5), 0.36);
      case 'prensa':
        return encima([PRENSA_TALLER.x, PRENSA_TALLER.y + 0.02, 1.15], 1.0, 0.55, 0.22);
      case 'ficha':
        return encima([L.x + A / 2 + 0.1, L.y + H / 2, BANCO.z], 0.8, 0.9);
      default:
        return VISTA_ENTRADA;
    }
  }
  /** Lo del taller que se mueve: el libro (su sitio, la tapa y lo pintado), la prensa, las herramientas y el polvo. */
  function montarTaller() {
    for (const m of tallerVivo.children.slice()) {
      tallerVivo.remove(m);
      m.geometry.dispose();
    }
    const e = tall.est;
    const enc = tallerGrupo.visible ? (e.encargo ?? null) : null;
    libroT.visible = Boolean(enc);
    const L = libroOrigen(e);
    if (enc) {
      const clave = `${enc.n}:${enc.libro}`;
      if (libroDe !== clave) {
        for (const m of [cuerpoM, placaM]) {
          if (!m) continue;
          m.parent.remove(m);
          m.geometry.dispose();
        }
        const a = kit();
        libroTallerKit(a, enc.tela);
        cuerpoM = new Mesh(geometryOf(a), flat);
        libroT.add(cuerpoM);
        const b = kit();
        tapaTallerKit(b, enc.tela);
        placaM = new Mesh(geometryOf(b), flat);
        tapaG.add(placaM);
        libroDe = clave;
        vistasPintadas = SIN_PINTAR;
      }
      if (e.vistas !== vistasPintadas) {
        pintarTapa(tapaLienzo, enc, e.vistas ?? undefined);
        pintarPliego(pliegoLienzo, enc, e.vistas ?? undefined);
        tapaTex.needsUpdate = true;
        guardaTex.needsUpdate = true;
        paginaTex.needsUpdate = true;
        vistasPintadas = e.vistas;
      }
      libroT.position.set(L.x, L.z, L.y);
      tapaG.rotation.z = Math.PI * suaveT(e.abre ?? 0);
    }
    if (tallerGrupo.visible) {
      const s = kit();
      conLuces(LUZ_TALLER, () => {
        prensaVivaKit(s, e.vistas?.prensa ?? {});
        const mano = enc ? e.herramienta : null;
        utilesTaller(s, mano);
        const pose = e.pose ?? {};
        if (mano === 'sello') {
          const x = e.vistas?.exlibris?.exlibris ?? {};
          const [tx, ty, tz] = enPliego(L, x.u ?? 0.25, x.v ?? 0.62);
          const alza = x.sellado ? 0.06 : x.baja ? 0.004 * (1 - (x.presion ?? 0)) : 0.04;
          selloKit(s, tx, ty, tz + alza, x.baja && !x.sellado ? (x.presion ?? 0) : 0, { g: 0.9 });
        } else if (mano && pose.u != null) {
          const punto = (e.superficie ?? 'tapa') === 'pliego' ? enPliego : enTapa;
          herramientaKit(s, mano, punto(L, pose.u, pose.v), pose);
        }
        if (enc && e.nube?.length && !reduced()) nubeKit(s, e.nube, e.ahora ?? 0, (u, v) => enTapa(L, u, v));
      });
      tallerVivo.add(new Mesh(geometryOf(s), flat));
    }
    invalidate();
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
    // 1.133: la lluvia del ventanuco y el polvo y el vaho del taller, solo si se ve
    if (tallerGrupo.visible) {
      paintLluvia(lluviaTallerCanvas, t, quieto);
      lluviaTaller.material.map.needsUpdate = true;
      moverMotasT(quieto ? 0 : t);
    }
  };
  pintaVivo(0);

  // ── El plano: lo colocado, con tus libros en las estanterías ──
  const LIBROS_POR_ESTANTERIA = 56;
  const CABEN = { 'cafe-estanteria': LIBROS_POR_ESTANTERIA, 'cafe-estanteria-alta': 96, 'cafe-biombo': 24 };
  const planoGrupo = new Group();
  scene.add(planoGrupo);
  let estado = { inaugurado: false, nombre: null, plano: { v: 1, items: [] }, libros: [], cajas: 0, vacias: false, nivel: 1, escaparate: [], portadas: [], balda: null, decor: [] };
  let modo = { decorar: false, sel: null, mal: false, planta: 'calle' };
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
  const rejillas = { 1: hacerRejilla(1), 2: hacerRejilla(2), 4: hacerRejilla(4), 5: hacerRejilla(5), bodega: [rejillaDe(SOTANO.x0, SOTANO.x1, SOTANO.y0, SOTANO.y1)],
    bodega7: [rejillaDe(sotanoDe(7).x0, sotanoDe(7).x1, SOTANO.y0, sotanoDe(7).y1)],
    bodega8: [rejillaDe(sotanoDe(8).x0, sotanoDe(8).x1, SOTANO.y0, sotanoDe(8).y1)],
  };
  // Bloque 6a: en qué planta estás ('calle' o 'bodega')
  let planta = 'calle';
  function vaciarGrupo() {
    for (const m of planoGrupo.children.slice()) {
      planoGrupo.remove(m);
      m.geometry.dispose();
    }
  }
  // ── 1.130: la librería. `lib.est`, lo que se ve al atender (Libreria.jsx): { fase ('estanteria', 'seccion', 'tabla',
  // 'mirar', 'forma', 'gesto' o 'listo'), genero, foco (el lomo que asoma), sale (cuánto ha salido), tabla (cuánto ha salido la
  // tabla), posa (el libro que cae en ella), libro ({ k, clave, titulo, alto, g }), portada (su lienzo), forma, gesto, pose,
  // hechos, soplo (la bolsa que se abre), cerrar (el libro que se cierra) y bandeja (el paquete que va con la taza) }. ──
  const libGrupo = new Group();
  scene.add(libGrupo);
  let lib = { activa: false, est: {}, lleva: null };
  let libTramos = [];
  const placaMat = new Map();
  function materialPlaca(genero, nombre, ancho) {
    const k = `${genero}:${Math.round(ancho * 100)}`;
    if (!placaMat.has(k)) placaMat.set(k, own(new MeshBasicMaterial({ map: own(texture(paintPlaca(nombre, ancho))), color: 0xd2c4ac })));
    return placaMat.get(k);
  }
  /** El tramo de la sección que se mira (el del lomo elegido o el que asoma; si no, el primero). */
  function libTramo(e = lib.est) {
    const ts = libTramos.filter((t) => t.genero === e.genero);
    const k = e.libro?.k ?? e.foco;
    return (k != null && ts.find((t) => t.lomos.some((l) => l.k === k))) || ts[0] || null;
  }
  /** Dónde sale la tabla: a la altura de la sección, sin pasarse de los extremos de la estantería. */
  function libMesa(e = lib.est) {
    const t = libTramo(e);
    const { y0, y1, fondo } = ESTANTERIA;
    const X = paredIzquierda(estado.inaugurado ? estado.nivel : 1);
    return { X, F: X + fondo, yc: clamp(t ? (t.y0 + t.y1) / 2 : (y0 + y1) / 2, y0 + TABLA_MEDIA + 0.03, y1 - TABLA_MEDIA - 0.03) };
  }
  const TAN_H = Math.tan((HFOV / 2) * (Math.PI / 180));
  /** La tangente del medio ancho que se ve de verdad (en un móvil en vertical, menos que `HFOV`: manda el alto). */
  const tanAncho = () => Math.min(TAN_H, Math.tan((camera.fov * Math.PI) / 360) * camera.aspect);
  /** La cámara de la librería: toda la estantería, una sección de cerca o la tabla desde arriba (el cuadro va abajo). */
  function vistaLib(e = lib.est) {
    const { F, yc } = libMesa(e);
    const fase = e.fase ?? 'estanteria';
    if (fase === 'estanteria' || !e.genero) {
      const ts = libTramos.length ? libTramos : [{ y0: ESTANTERIA.y0 + 0.2, y1: ESTANTERIA.y1 - 0.2, z: 0.66 }];
      // Con el hueco de cada sección (donde va su placa), no solo sus lomos
      const [ya, yb] = [Math.min(...ts.map((t) => Math.min(t.y0, (t.y0 + t.y1) / 2 - (t.hueco ?? 0) / 2))), Math.max(...ts.map((t) => Math.max(t.y1, (t.y0 + t.y1) / 2 + (t.hueco ?? 0) / 2)))];
      const [za, zb] = [Math.min(...ts.map((t) => t.z)), Math.max(...ts.map((t) => t.z)) + 0.42];
      const [yy, zz] = [(ya + yb) / 2, (za + zb) / 2];
      const d = clamp(((yb - ya) / 2 + 0.12) / tanAncho(), 1.7, 3.3);
      return { p: [F + d, yy, zz + d * 0.26], m: [F - 0.2, yy, zz - d * 0.32] };
    }
    if (fase === 'seccion') {
      // 1.131 (Francisco, 14-11-2026: «la cámara un poco más cerca»): los lomos más grandes y en el centro del hueco libre
      const t = libTramo(e);
      const [yy, zz] = [(t.y0 + t.y1) / 2, t.z + 0.22];
      const d = clamp(((t.y1 - t.y0) / 2 + 0.14) / tanAncho(), 0.6, 1.5);
      return { p: [F + d, yy, zz + d * 0.3], m: [F - 0.1 * d, yy, zz - d * 0.16] };
    }
    // Al elegir cómo se lo lleva (y al abrir una bolsa), la cámara se corre hacia el tarro y las bolsas: en un móvil en vertical
    // la tabla no cabe entera y se quedaban fuera; al terminar, hacia la bandeja (con la taza entera)
    const dy = fase === 'listo' ? 0.45 : fase === 'forma' || (fase === 'gesto' && e.gesto === 'bolsa') ? -0.27 : 0;
    // Con la bolsa ya abierta (meter el libro, doblar el borde y sellarla), más de lado y a media altura: la bolsa es alta y
    // el libro baja desde arriba
    const bolsaAlta = fase === 'gesto' && e.forma === 'llevar' && e.gesto !== 'bolsa';
    const c = [F + 0.3, yc + dy, TABLA_Z + (bolsaAlta ? 0.3 : 0)];
    // 1.131: más cerca. Al envolver, el libro llena el hueco libre (antes, media pantalla de suelo); al elegir y con las bolsas,
    // solo lo justo para que quepan el papel, el tarro y las bolsas a 360 px. `d`, a qué distancia de `c`; `alto`, desde qué
    // ángulo (rad, sobre la tabla); `baja`, cuánto queda `c` por debajo del centro de la pantalla (rad), donde no lo tapan el
    // marcador ni el cuadro.
    const ancha = fase === 'forma' || fase === 'listo' || (fase === 'gesto' && e.gesto === 'bolsa');
    const [d, alto, baja] = bolsaAlta ? [0.8, 0.7, 0.02] : ancha ? [fase === 'listo' ? 0.86 : 1.0, 0.98, 0.03] : [0.78, 1.02, 0.055];
    const [ca, sa, cb, sb] = [Math.cos(alto), Math.sin(alto), Math.cos(alto - baja), Math.sin(alto - baja)];
    const p = [c[0] + d * ca, c[1], c[2] + d * sa];
    return { p, m: [p[0] - d * cb, c[1], p[2] - d * sb] };
  }
  /** Lo que queda entre la cámara y la estantería (muebles y clientes) no se ve mientras estás en la librería. */
  function despejar() {
    const { F } = libMesa();
    const v = vistaLib();
    const ts = lib.est.genero && lib.est.fase === 'seccion' ? [libTramo()].filter(Boolean) : libTramos;
    const [ya, yb] = lib.est.fase && !['estanteria', 'seccion'].includes(lib.est.fase) ? [libMesa().yc - 1.1, libMesa().yc + 1.1] : [Math.min(ESTANTERIA.y1, ...ts.map((t) => t.y0)) - 0.6, Math.max(ESTANTERIA.y0, ...ts.map((t) => t.y1)) + 0.6];
    const tapa = (x0, y0, x1, y1) => lib.activa && x1 > F && x0 < v.p[0] + 0.45 && y1 > ya && y0 < yb;
    piezas.forEach((m, k) => {
      const b = obstaculos[k];
      m.visible = !(b && tapa(b[0] - 0.1, b[1] - 0.1, b[3] + 0.1, b[4] + 0.1));
    });
    for (const m of clientesGrupo.children) {
      const xy = m.userData.xy;
      m.visible = !(xy && tapa(xy[0] - 0.35, xy[1] - 0.35, xy[0] + 0.35, xy[1] + 0.35));
    }
    if (alaPilares) alaPilares.visible = !modo.decorar && !lib.activa;
  }
  /** Lo de la librería que se mueve: la sección que se mira, la tabla y lo que hay en ella. */
  function montarLibreria() {
    for (const m of libGrupo.children.slice()) {
      libGrupo.remove(m);
      m.geometry.dispose();
    }
    if (!lib.activa) {
      invalidate();
      return;
    }
    const e = lib.est;
    const { X, F, yc } = libMesa(e);
    const s = kit();
    const D = TABLA_SALE * suaveT(e.tabla ?? 0);
    // La sección que se mira: el lomo bajo el dedo asoma y, al tirar, sale de la balda; el que está en la tabla deja su hueco
    if (e.genero)
      for (const t of libTramos) {
        if (t.genero !== e.genero) continue;
        const z = t.z + 0.05;
        for (const l of t.lomos) {
          if (e.libro && e.libro.k === l.k && D > 0.002) continue;
          const foco = e.foco === l.k;
          const sale = foco ? suaveT(e.sale ?? 0) : 0;
          const o = foco ? { xf: giro([F - 0.04, l.y0, z], 'y', 0.17 + sale * 0.3, (p) => [p[0] + sale * 0.36, p[1] + sale * 0.06, p[2]]) } : {};
          lomoKit(s, [X + 0.06, l.y0, z, F - 0.04, l.y1, z + l.alto], colorDe(l.titulo), hashClave(l.clave), o);
          // El que asoma, con un filo de luz en la cabeza (lo que tocas)
          if (foco && sale < 0.05) pushBox(s, [F - 0.06, l.y0 + 0.004, z + l.alto, F - 0.035, l.y1 - 0.004, z + l.alto + 0.006], [255, 214, 150], { glow: true, xf: o.xf });
        }
      }
    let portada = null;
    if (D > 0.002) {
      const o = { g: 0.6 };
      tablaKit(s, F, yc, D, o);
      const ox = F + D - TABLA_SALE;
      const papel = e.forma === 'regalar' && (e.gesto === 'papel' || e.hechos?.papel);
      const bolsa = e.forma === 'llevar' && (e.hechos?.bolsa || (e.gesto === 'bolsa' && e.pose?.abierta));
      utilesKit(s, ox, yc, { bolsas: bolsa ? 5 : 6, sello: e.gesto === 'sello', rollo: papel ? 0.7 : 1 }, o);
      // La bandeja, con la taza que has traído de la barra
      pushBox(s, [ox + 0.06, yc + 0.26, TABLA_Z, ox + 0.52, yc + 0.7, TABLA_Z + 0.008], WOOD, o);
      for (const b of [
        [ox + 0.06, yc + 0.26, ox + 0.52, yc + 0.275],
        [ox + 0.06, yc + 0.685, ox + 0.52, yc + 0.7],
        [ox + 0.06, yc + 0.26, ox + 0.075, yc + 0.7],
        [ox + 0.505, yc + 0.26, ox + 0.52, yc + 0.7],
      ])
        pushBox(s, [b[0], b[1], TABLA_Z + 0.008, b[2], b[3], TABLA_Z + 0.03], WOOD_D, o);
      if (lib.lleva) taza(s, ox + 0.17, yc + 0.6, TABLA_Z + 0.008, lib.lleva.receta ?? {}, { ...(lib.lleva.vista ?? {}), lleno: 1 }, { humo: !reduced() && lib.lleva.receta?.bebida !== 'frio', g: 0.62 });
      if (e.libro) {
        const b = suaveT(e.bandeja ?? 0);
        const alto = e.libro.alto ?? 0.3;
        const B = { cx: ox + 0.3 + 0.04 * b, cy: yc + 0.4 * b, z: TABLA_Z + 0.008 * b + (1 - suaveT(e.posa ?? 1)) * 0.14, alto, ancho: alto * 0.68, g: e.libro.g ?? 0.05, c: colorDe(e.libro.titulo ?? '') };
        const r = libroKit(s, B, e, o);
        portada = r.portada;
        // El sello del café, en la mano: sobre lo que se sella, baja al apretar y se aplasta un poco; luego sube
        if (e.gesto === 'sello') {
          const p = e.pose ?? {};
          const [tx, ty, tz] = r.objetivo;
          const alza = p.sellado ? 0.12 : p.baja ? 0.004 * (1 - (p.presion ?? 0)) : 0.13;
          selloKit(s, tx, ty, tz + alza, p.baja && !p.sellado ? (p.presion ?? 0) : 0, o);
        }
      }
    }
    libGrupo.add(new Mesh(geometryOf(s), flat));
    if (portada && e.portada) {
      const m = new Mesh(new PlaneGeometry(portada.w, portada.h), portadaMaterial(e.portada));
      if (portada.de === 'arriba') m.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
      else m.rotation.set(0, Math.PI / 2, 0);
      m.position.set(portada.x, portada.z, portada.y);
      libGrupo.add(m);
    }
    despejar();
    invalidate();
  }
  /** Al salir de la librería, de pie delante de la estantería (en un sitio libre) y mirándola. */
  function dePieAnteEstanteria() {
    const { F, yc } = libMesa();
    const op = opcionesPaso();
    for (const dx of [0.95, 1.25, 1.6, 2.0, 2.5])
      for (const dy of [0, -0.5, 0.5, -1, 1]) {
        if (dentro(F + dx, yc + dy, op)) {
          px = F + dx;
          py = yc + dy;
          yaw = -Math.PI / 2;
          return;
        }
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
      // 1.130: con la balda por secciones en la pared, los muebles enseñan tus leídos, de adorno (`decor`)
      const fuente = estado.balda ? estado.decor : estado.libros;
      const tramo = cabe ? fuente.slice(usados, usados + cabe) : [];
      // Con los libros en cajas, una estantería sin ejemplares se queda vacía (sin lomos de relleno)
      const libros = (estado.vacias || estado.balda) && !tramo.length && cabe ? null : tramo;
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
      // 1.130: la estantería de la pared, por secciones (una por género con ejemplares, con su placa); sin la migración de los
      // libros, como antes
      libTramos = estado.inaugurado && estado.balda ? estanteLibreria(estado.balda) : [];
      if (estado.inaugurado && estado.balda) {
        const X = paredIzquierda(estado.nivel);
        for (const p of lomosLibreria(s, libTramos, X, { sin: lib.activa ? lib.est.genero : null })) {
          const m = new Mesh(new PlaneGeometry(p.ancho, 0.066), materialPlaca(p.genero, p.nombre, p.ancho));
          m.rotation.y = Math.PI / 2;
          m.position.set(p.x, p.z, p.y);
          planoGrupo.add(m);
        }
      } else if (estado.inaugurado) lomosPared(s, estado.libros.slice(enCafe), paredIzquierda(estado.nivel));
      // Bloque 4b: el escaparate con tus tres libros (nivel 5)
      if (estado.inaugurado && estado.nivel >= 5)
        for (const pt of escaparateKit(s, estado.escaparate, estado.portadas)) {
          // De cara a la calle: el plano mira a +z de Three, que es hacia la acera
          const m = new Mesh(new PlaneGeometry(0.56, 0.84), portadaMaterial(pt.lienzo));
          m.position.set(pt.x, pt.z, pt.y);
          planoGrupo.add(m);
        }
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
    alaPilares.visible = !modo.decorar && !lib.activa;
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
    // Bloque 6a: la bodega y la trampilla, desde el nivel 6
    bodega6.grupo.visible = n === 6;
    bodega7.grupo.visible = n === 7;
    bodega8.grupo.visible = n >= 8;
    tostadorFijo.visible = n >= 7;
    bodega6.piezas.visible = !modo.decorar;
    bodega7.piezas.visible = !modo.decorar;
    bodega8.piezas.visible = !modo.decorar;
    trampillaM.visible = n >= 6;
    verPuerta();
    const clave = modo.planta === 'bodega' ? (n >= 8 ? 'bodega8' : n >= 7 ? 'bodega7' : 'bodega') : String(n >= 5 ? 5 : n >= 4 ? 4 : n >= 2 ? 2 : 1);
    for (const [k, ms] of Object.entries(rejillas)) for (const m of ms) m.visible = modo.decorar && k === clave;
    canvas.setAttribute(
      'aria-label',
      tall.activa
        ? ARIA_TALLER
        : estado.inaugurado
        ? planta === 'bodega'
          ? `La bodega de ${estado.nombre ?? 'tu café'}, en el sótano. Arrastra o usa las flechas para mirar; toca el suelo para andar y la escalera para subir al café.`
          : `${estado.nombre ?? 'Tu café'}, tu café-librería. Arrastra o usa las flechas para mirar; toca el suelo para andar y a Pilar, en el mostrador, para hablar con ella.${n >= 3 ? ' Detrás de la barra, una puerta baja lleva al taller de la trastienda.' : ''}${n >= 6 ? ' Detrás de la barra, la trampilla baja a la bodega.' : ''}`
        : 'El bajo, vacío y en traspaso. Arrastra o usa las flechas para mirar; toca el suelo para andar y a Pilar, en el mostrador, para hablar con ella.',
    );
    montarClientes();
    montarBarra();
    despejar();
  }
  const opcionesPaso = () => ({ limpio: estado.inaugurado, muebles: [...obstaculos, ...obstaculosClientes], nivel: estado.inaugurado ? estado.nivel : 1, planta });

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
    // Bloque 6a: los de la calle primero; la bodega se llena después
    return out.sort((a, b) => (plantaEn(a.x) === 'bodega') - (plantaEn(b.x) === 'bodega'));
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
      if (c.influencer) adornoInfluencer(s, boxes, c.influencer, sx, sy, estadoFigura.facing, !c.servido);
      const figura = new Mesh(geometryOf(s), flat);
      figura.userData.xy = [sx, sy];
      clientesGrupo.add(figura);
      const alto = sentado ? sentado.h + 0.95 : 1.95;
      const m = new Mesh(new BoxGeometry(0.7, alto, 0.7), hidden);
      m.position.set(sx, alto / 2, sy);
      m.userData.id = `cliente:${c.n}`;
      m.userData.xy = [sx, sy];
      clientesGrupo.add(m);
      pickersClientes.push(m);
      if (!sentado) obstaculosClientes.push([sx - 0.3, sy - 0.3, 0, sx + 0.3, sy + 0.3, 1.8]);
      sitiosClientes[c.n] = { x: sx, y: sy, z: alto + 0.15, espera: !c.servido, mira: sentado ? sentado.facing : 2, planta: plantaEn(sx) };
    });
    invalidate();
  }

  // ── 1.132: las fotos firmadas de los influencers, en la pared de la derecha ──
  const fotosGrupo = new Group();
  scene.add(fotosGrupo);
  let fotos = [];
  function montarFotos() {
    for (const m of fotosGrupo.children.slice()) {
      fotosGrupo.remove(m);
      m.geometry.dispose();
    }
    if (estado.inaugurado) {
      const s = kit();
      fotosKit(s, fotos);
      fotosGrupo.add(new Mesh(geometryOf(s), flat));
    }
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
  // 1.133: el plano de la tapa o de las páginas del libro del taller, para saber dónde cae el dedo
  const planoTaller = new Plane();
  const arribaTaller = new Vector3(0, 1, 0);

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

  // 1.126: los pasos suenan según lo andado (madera en el café, piedra en la bodega, losas en la acera de la terraza)
  let andado = 0;
  let pasoN = 0;
  const PASO = 0.62;
  function pisada(d) {
    andado += d;
    if (andado < PASO) return;
    andado -= PASO;
    pasoN += 1;
    onSonido('paso', { suelo: planta === 'bodega' ? 'piedra' : py > SD ? 'acera' : 'madera', n: pasoN });
  }
  function advance(dt) {
    if (!walk) return false;
    // 1.133.1: al llegar a un recodo del camino, sin pararse, hacia el siguiente
    if (walk.siguientes?.length && Math.hypot(walk.tx - px, walk.ty - py) < 0.12) {
      const p = walk.siguientes.shift();
      walk.tx = p.x;
      walk.ty = p.y;
    }
    const { tx, ty } = walk;
    const face = walk.siguientes?.length ? null : walk.face;
    const dx = tx - px;
    const dy = ty - py;
    const d = Math.hypot(dx, dy);
    const want = d > 0.05 ? Math.atan2(dx, dy) : face ? Math.atan2(face[0] - px, face[1] - py) : yaw;
    yaw += wrapA(want - yaw) * Math.min(1, dt * 6);
    if (d > 0.02) {
      const k = Math.min(1, (WALK * dt) / d);
      px += dx * k;
      py += dy * k;
      pisada(d * k);
      return true;
    }
    if (face && Math.abs(wrapA(want - yaw)) > 0.01) return true;
    const done = walk.done;
    walk = null;
    andado = PASO * 0.5;
    onMove({ x: px, y: py, yaw });
    done?.();
    return false;
  }
  function aim(now) {
    const dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0;
    lastT = now;
    let moving = advance(dt);
    const meta = barra.activa || tost.activa || lib.activa || tall.activa ? 1 : 0;
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
    const lejos = modo.decorar && (estado.nivel >= 4 || modo.planta === 'bodega');
    scene.fog.near = lejos ? 12 : 7;
    scene.fog.far = lejos ? 36 : 22;
    if (modo.decorar && modo.planta === 'bodega') {
      // Bloque 6a: la bodega desde arriba (la bóveda no se ve por encima), con la escalera a la derecha
      const so = sotanoDe(estado.nivel);
      const ancha = estado.nivel >= 7;
      const catas = estado.nivel >= 8;
      const o = enMundo((so.x0 + so.x1) / 2 + (ancha ? -0.2 : 0.3), (so.y0 + so.y1) / 2);
      camera.position.set(o.x, catas ? 9.8 : ancha ? 8.6 : 7.4, bodegaDe(estado.nivel).y1 + (catas ? 3.1 : ancha ? 2.9 : 2.4));
      camera.lookAt(o.x, 0, o.y - 0.2);
    } else if (modo.decorar) {
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
      // Un corte: se salta de golpe (de la trampilla a la escalera de la bodega, o al revés)
      const lerp = (x, y) => (b.corte ? y : x.map((v, i) => v + (y[i] - v) * k));
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
  /** ¿Está a la vista y se puede tocar este sitio? (Según tu planta, el nivel y lo que haya en el local.) */
  function sitioActivo(id) {
    const s = sitioDe(id, estado.nivel);
    if ((s.planta ?? 'calle') !== planta) return false;
    if (s.nivel && !(estado.inaugurado && estado.nivel >= s.nivel)) return false;
    return id === 'libros' ? estado.inaugurado && estado.cajas > 0 : id === 'cortina' ? !(estado.inaugurado && estado.nivel >= 2) : true;
  }
  function tags() {
    const out = {};
    for (const id of Object.keys(SITIOS)) {
      const s = sitioDe(id, estado.nivel);
      const p = project(...s.tag);
      const hay = sitioActivo(id);
      if (tour) {
        out[id] = { ...p, visible: false };
        continue;
      }
      out[id] = { ...p, visible: hay && !walk && !modo.decorar && !barra.activa && !tost.activa && !lib.activa && !tall.activa && !yendoTaller && barraT === 0 && p.front };
    }
    for (const [n, c] of Object.entries(sitiosClientes)) {
      const p = project(c.x, c.y, c.z);
      out[`cliente:${n}`] = { ...p, visible: !tour && !walk && !modo.decorar && !barra.activa && !tost.activa && !lib.activa && !tall.activa && !yendoTaller && barraT === 0 && c.espera && c.planta === planta && p.front };
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
    if (tour) return null;
    const sitios = pickers.filter((m) => sitioActivo(m.userData.id));
    const suyos = pickersClientes.filter((m) => sitiosClientes[m.userData.id.slice(8)]?.planta === planta);
    if (tost.activa || lib.activa || tall.activa || yendoTaller) return null;
    return ray.intersectObjects(barra.activa ? pickersBarra : [...sitios, ...suyos], false)[0]?.object.userData.id ?? null;
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

  /**
   * Ir andando hasta (x, y); `face`, adónde mirar al llegar. 1.133.1: rodeando lo que haya en medio (`ruta`) y, si allí no se
   * puede estar, hasta el sitio libre más cercano. Sin camino, como antes: en línea recta, parando antes de chocar.
   */
  function walkTo(x, y, { face = null } = {}) {
    return new Promise((done) => {
      const camino = ruta(px, py, x, y, opcionesPaso()) ?? [hastaDonde(px, py, x, y, opcionesPaso())];
      const to = camino[camino.length - 1];
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
      walk = { tx: camino[0].x, ty: camino[0].y, siguientes: camino.slice(1), face, done };
      invalidate();
    });
  }

  /**
   * Bloque 6a: pasar a la otra planta. Se anda hasta la trampilla (o hasta el pie de la escalera) y la cámara baja por el hueco
   * y la escalera de la bodega (o sube por ella y sale por la trampilla). Con movimiento reducido, directo. Promesa que acaba al llegar.
   */
  let cambiando = null;
  function cambiarPlanta(destino) {
    if (destino === planta || (destino === 'bodega' && !(estado.inaugurado && estado.nivel >= 6))) return Promise.resolve();
    if (cambiando) return cambiando;
    const llegar = () => {
      const p = destino === 'bodega' ? llegadaDe(estado.nivel) : ANTE_TRAMPILLA;
      planta = destino;
      walk = null;
      px = p.x;
      py = p.y;
      yaw = p.yaw;
      onMove({ x: px, y: py, yaw, planta });
      montarPlano();
    };
    const sitio = sitioDe(destino === 'bodega' ? 'trampilla' : 'subir', estado.nivel);
    cambiando = walkTo(sitio.ir.x, sitio.ir.y, { face: sitio.mira })
      .then(
        () =>
          new Promise((fin) => {
            if (reduced()) {
              llegar();
              fin();
              return;
            }
            const ojo = { p: [px, py, EYE], m: [px + Math.sin(yaw) * 6, py + Math.cos(yaw) * 6, EYE + Math.tan(PITCH) * 6] };
            const al = destino === 'bodega' ? llegadaDe(estado.nivel) : ANTE_TRAMPILLA;
            const E = escaleraDe(estado.nivel);
            const fondoB = bodegaDe(estado.nivel).y1;
            const final = { p: [al.x, al.y, EYE], m: [al.x + Math.sin(al.yaw) * 6, al.y + Math.cos(al.yaw) * 6, EYE + Math.tan(PITCH) * 6] };
            const [tx, ty] = [(TRAMPILLA.x0 + TRAMPILLA.x1) / 2, (TRAMPILLA.y0 + TRAMPILLA.y1) / 2];
            const ex = (E.x0 + E.x1) / 2;
            const puntos =
              destino === 'bodega'
                ? [
                    ojo,
                    { p: [tx - 0.85, ty, 1.55], m: [tx + 0.1, ty, -0.4] },
                    { p: [tx - 0.4, ty, 1.15], m: [tx + 0.2, ty, -0.6] },
                    { corte: true, p: [ex, fondoB - 0.3, 3.05], m: [ex, E.y0 - 0.5, 1.0] },
                    { p: [ex, E.y0 + 1.4, 2.1], m: [ex - 1.2, 0.6, 1.1] },
                    final,
                  ]
                : [
                    ojo,
                    { p: [ex, E.y0 + 1.0, 1.9], m: [ex, fondoB, 2.8] },
                    { p: [ex, fondoB - 0.5, 3.0], m: [ex, fondoB + 0.6, 4.0] },
                    { corte: true, p: [tx - 0.3, ty, 1.0], m: [tx - 2.0, ty + 1.2, 1.6] },
                    { p: [tx - 0.7, ty, 1.5], m: [4.0, 6.0, 1.3] },
                    final,
                  ];
            tour = {
              t0: performance.now(),
              paso: 0.85,
              puntos,
              fin: () => {
                llegar();
                fin();
              },
            };
            onSonido('planta', { destino, duracion: 0.85 * (puntos.length - 1) });
            invalidate();
          }),
      )
      .finally(() => {
        cambiando = null;
      });
    return cambiando;
  }

  /**
   * 1.133: entrar en el taller: se anda hasta delante de la puerta, la cámara pasa por encima de la barra, la puerta se abre y,
   * de la luz del hueco, se pasa al cuarto de don Celestino. Al salir, al revés: quedas delante de la barra, mirando al café.
   * Con movimiento reducido, directo. `est`, lo que ya se ve en el banco al llegar.
   */
  let yendoTaller = null;
  const ARIA_TALLER = 'El taller de la trastienda: el banco de don Celestino con su tapete verde, la prensa de husillo y la lámpara de brazo. Lo que se hace, en el cuadro de abajo.';
  function entrarTaller(est = {}) {
    if (tall.activa) return Promise.resolve();
    if (yendoTaller) return yendoTaller;
    const s = sitioDe('taller', estado.nivel);
    yendoTaller = cambiarPlanta('calle')
      .then(() => walkTo(s.ir.x, s.ir.y, { face: s.mira }))
      .then(
        () =>
          new Promise((fin) => {
            tall = { activa: false, est: { vista: 'entrada', ...est } };
            tallerGrupo.visible = true;
            montarTaller();
            const dentroYa = () => {
              puertaAbierta = false;
              verPuerta();
              tall = { ...tall, activa: true };
              vistaMeta = vistaTaller(tall.est);
              vista = { p: [...vistaMeta.p], m: [...vistaMeta.m] };
              barraT = 1;
              walk = null;
              canvas.setAttribute('aria-label', ARIA_TALLER);
              montarTaller();
              fin();
            };
            onSonido('tallerPuerta');
            if (reduced()) {
              dentroYa();
              return;
            }
            puertaAbierta = true;
            verPuerta();
            const yc = (PUERTA_TALLER.y0 + PUERTA_TALLER.y1) / 2 - 0.12;
            const ojo = { p: [px, py, EYE], m: [px + Math.sin(yaw) * 6, py + Math.cos(yaw) * 6, EYE + Math.tan(PITCH) * 6] };
            tour = {
              t0: performance.now(),
              paso: 0.8,
              puntos: [
                ojo,
                { p: [MOSTRADOR.x1 + 0.4, yc, 1.62], m: [SW, yc + 0.12, 1.0] },
                { p: [SW - 1.05, yc + 0.12, 1.3], m: [SW, yc + 0.12, 1.0] },
                { corte: true, p: [(PUERTA_T.x0 + PUERTA_T.x1) / 2, TALLER.y1 - 0.08, 1.55], m: [61.6, 0.6, 1.0] },
                vistaTaller(tall.est),
              ],
              fin: dentroYa,
            };
            invalidate();
          }),
      )
      .finally(() => {
        yendoTaller = null;
      });
    return yendoTaller;
  }
  function salirTaller() {
    if (!tall.activa) return Promise.resolve();
    if (yendoTaller) return yendoTaller;
    yendoTaller = new Promise((fin) => {
      const fuera = () => {
        tallerGrupo.visible = false;
        puertaAbierta = false;
        tall = { activa: false, est: {} };
        montarTaller();
        walk = null;
        px = ANTE_TALLER.x;
        py = ANTE_TALLER.y;
        yaw = -Math.PI / 2;
        onMove({ x: px, y: py, yaw });
        montarPlano();
        fin();
      };
      const desde = { p: [...vista.p], m: [...vista.m] };
      tall = { ...tall, activa: false };
      barraT = 0;
      onSonido('tallerPuerta');
      if (reduced()) {
        fuera();
        return;
      }
      puertaAbierta = true;
      verPuerta();
      const yc = (PUERTA_TALLER.y0 + PUERTA_TALLER.y1) / 2;
      const P = (PUERTA_T.x0 + PUERTA_T.x1) / 2;
      tour = {
        t0: performance.now(),
        paso: 0.8,
        puntos: [
          desde,
          { p: [P, TALLER.y1 - 0.3, 1.55], m: [P, TALLER.y1 + 1, 1.35] },
          { corte: true, p: [SW - 0.3, yc, 1.25], m: [SW - 2, yc - 0.1, 1.2] },
          { p: [MOSTRADOR.x1 + 0.4, yc - 0.12, 1.62], m: [4.5, yc - 0.3, 1.3] },
          { p: [ANTE_TALLER.x, ANTE_TALLER.y, EYE], m: [ANTE_TALLER.x - 6, ANTE_TALLER.y, EYE + Math.tan(PITCH) * 6] },
        ],
        fin: fuera,
      };
      invalidate();
    }).finally(() => {
      yendoTaller = null;
    });
    return yendoTaller;
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
      if (!press.moved || walk || barra.activa || tost.activa || lib.activa || tall.activa || yendoTaller || tour) return;
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
    if (cambiando) return;
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
    if (barra.activa || tost.activa || lib.activa || tall.activa || yendoTaller || tour) return;
    const p = sueloBajo(e.clientX, e.clientY);
    if (p) walkTo(p.x, p.y, p.mueble ? { face: [p.x, p.y] } : {});
  };
  /**
   * 1.133.1: adónde lleva un toque. Lo primero que se ve bajo el dedo (el suelo, un mueble, una mesa o la pared), bajado al
   * suelo; `walkTo` llega hasta allí o hasta el sitio libre más cercano. `mueble`: no era suelo libre (al llegar, se mira hacia allí).
   */
  function sueloBajo(clientX, clientY) {
    rayAt(clientX, clientY);
    // Solo lo que se ve: ni las cajas invisibles de lo que se toca (sitios, clientes, la barra) ni lo oculto
    const visible = (o) => {
      const mats = [o.material].flat();
      if (!mats.some((m) => m && m.visible !== false && !(m.transparent && m.depthWrite === false))) return false;
      for (let q = o; q; q = q.parent) if (!q.visible) return false;
      return true;
    };
    const golpe = ray.intersectObjects(scene.children, true).find((h) => h.object.isMesh && visible(h.object));
    // El techo (o lo alto, mirando hacia arriba) no lleva a ninguna parte
    if (golpe && ray.ray.direction.y > 0 && golpe.point.y > 2.8) return null;
    // Un mueble o la pared: el pie de lo tocado. Sin nada debajo, el suelo (como antes)
    let p = golpe ? { x: golpe.point.x, y: golpe.point.z } : null;
    if (!p && ray.ray.intersectPlane(floorPlane, hit)) p = { x: hit.x, y: hit.z };
    if (!p) return null;
    return { ...p, mueble: !dentro(p.x, p.y, opcionesPaso()) };
  }
  canvas.addEventListener('pointerup', release, on);
  canvas.addEventListener('pointercancel', release, on);
  canvas.addEventListener(
    'keydown',
    (e) => {
      if (modo.decorar || barra.activa || tost.activa || lib.activa || tall.activa || yendoTaller || cambiando || tour) return;
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
    /** Cuántas portadas reales del escaparate tiene la escena (las pruebas lo miran). */
    portadasEscaparate: () => (estado.portadas ?? []).filter(Boolean).length,
    pose: () => ({ x: px, y: py, yaw }),
    settled: () => !walk && vistaQuieta() && (barra.activa || tost.activa || lib.activa || tall.activa ? barraT === 1 : barraT === 0),
    /**
     * 1.131: ¿la cámara de la barra ya casi ha llegado a lo que mira? (A `tol` del final; sin esperar a que se pare del todo.)
     * Pilar espera a esto antes de empezar cada gesto, como quien alarga la mano hasta la siguiente herramienta.
     */
    vistaCerca: (tol = 0.05) =>
      barraT === 1 && Math.max(...vista.p.map((v, k) => Math.abs(v - vistaMeta.p[k])), ...vista.m.map((v, k) => Math.abs(v - vistaMeta.m[k]))) < tol,
    /** Ir a un sitio ('pilar', 'cortina', 'escaparate' o 'entrada'). Promesa que acaba al llegar. */
    go(id) {
      if (id === 'entrada') return cambiarPlanta('calle').then(() => walkTo(INICIO.x, INICIO.y, { face: [INICIO.x + Math.sin(INICIO.yaw), INICIO.y + Math.cos(INICIO.yaw)] }));
      // Bloque 6a: la trampilla baja a la bodega y la escalera sube al café
      if (id === 'trampilla') return cambiarPlanta('bodega');
      if (id === 'subir') return cambiarPlanta('calle');
      const s = sitioDe(id, estado.nivel);
      if (!s) return Promise.resolve();
      // Un sitio de la otra planta: primero se cambia de planta
      return cambiarPlanta(s.planta ?? 'calle').then(() => walkTo(s.ir.x, s.ir.y, { face: s.mira }));
    },
    /** Bloque 6a: en qué planta estás ('calle' o 'bodega'). */
    planta: () => planta,
    /** ¿Se está cambiando de planta? (para las pruebas) */
    cambiando: () => Boolean(cambiando),
    /** Ponerse en un sitio de golpe (para las pruebas y las capturas). */
    place(x, y, yawTo = yaw) {
      walk = null;
      planta = plantaEn(x);
      px = x;
      py = y;
      yaw = yawTo;
      onMove({ x: px, y: py, yaw });
      invalidate();
    },
    /** Dónde cae en la pantalla un sitio (para las pruebas). */
    onScreen(id) {
      aim(performance.now());
      const b = sitioDe(id, estado.nivel).box;
      const p = project((b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2);
      const rect = canvas.getBoundingClientRect();
      return { x: rect.left + p.x, y: rect.top + p.y, front: p.front };
    },
    /** Lo que se ve en el camino al andar: los bultos de lo colocado y de los clientes (para las pruebas). */
    pasos: () => opcionesPaso(),
    /** Adónde llevaría un toque en ese punto de la pantalla (para las pruebas). */
    toqueEn(clientX, clientY) {
      aim(performance.now());
      return sueloBajo(clientX, clientY);
    },
    /** Dónde cae en la pantalla un punto del mundo (para las pruebas). */
    punto(x, y, z = 0) {
      aim(performance.now());
      const p = project(x, y, z);
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
    setLocal({ inaugurado = false, nombre = null, plano = { v: 1, items: [] }, libros = [], cajas = 0, vacias = false, nivel = 1, escaparate = [], portadas = [], balda = null, decor = [] } = {}) {
      const nombreAntes = estado.nombre;
      const abre = inaugurado && !estado.inaugurado;
      const cambiaAbierto = inaugurado !== estado.inaugurado;
      // 1.130: `balda`, lo que hay en la balda ({ clave, title, genero, paginas, ejemplares }) para la estantería por secciones;
      // `decor`, tus leídos (títulos), para las estanterías de los muebles
      estado = { inaugurado, nombre, plano, libros, cajas, vacias, nivel, escaparate, portadas, balda, decor };
      // Las luces del ala y de la terraza alumbran lo colocado solo desde su nivel
      const n = inaugurado ? nivel : 1;
      LUCES_NIVEL = [...(n >= 4 ? [LUZ_ALA] : []), ...(n >= 5 ? [LUZ_TERRAZA] : []), ...(n >= 8 ? LUZ_CATAS : n >= 7 ? LUZ_TOSTADERO : n >= 6 ? LUZ_BODEGA : [])];
      // Bloque 6c: la escalera que sube al café se toca donde esté (en el 8, en la pared nueva)
      const sub = pickers.find((m) => m.userData.id === 'subir');
      if (sub) {
        const [x0, y0, z0, x1, y1, z1] = sitioDe('subir', n).box;
        sub.position.set((x0 + x1) / 2, (z0 + z1) / 2, (y0 + y1) / 2);
        sub.updateMatrixWorld();
      }
      // Al abrir el café (o entrar ya abierto), la vista de todo el rincón
      if (abre) {
        walk = null;
        px = INICIO_ABIERTO.x;
        py = INICIO_ABIERTO.y;
        yaw = INICIO_ABIERTO.yaw;
      }
      if (nombre !== nombreAntes || (inaugurado && !rotulo)) ponerRotulo(inaugurado ? nombre : null);
      // Sin bodega (por debajo del nivel 6), al café
      if (planta === 'bodega' && !(inaugurado && nivel >= 6)) {
        planta = 'calle';
        px = INICIO.x;
        py = INICIO.y;
      }
      // Si lo colocado te deja dentro de un mueble, un paso al pasillo (en la bodega, al pie de la escalera)
      if (!dentro(px, py, opcionesPaso()) && !walk && !tour) {
        px = planta === 'bodega' ? llegadaDe(n).x : INICIO.x;
        py = planta === 'bodega' ? llegadaDe(n).y : INICIO.y;
      }
      montarPlano();
      // 1.132: las fotos de la pared, solo con el café abierto
      if (cambiaAbierto) montarFotos();
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
      if (nivel === 5) puntos.push({ p: [3.4, 7.0, 2.0], m: [3.4, 14.0, 1.2] }, { p: [8.4, SD + 3.7, 2.1], m: [2.6, SD - 0.4, 1.5] }, { p: [0.8, SD + 3.5, 1.9], m: [5.2, SD + 0.6, 1.1] });
      // Bloque 6a: al 6, la trampilla abierta tras la barra y, abajo, la bodega (se salta de una a otra)
      // Bloque 6b: al 7, la bodega más ancha y el tostador
      // Bloque 6c: al 8, la sala de catas: bajando por la escalera nueva, las columnas de la derecha y el mostrador de catas
      if (nivel >= 8)
        puntos.push(
          { corte: true, p: [48.85, 7.1, 2.9], m: [43.6, 2.4, 0.8] },
          { p: [44.2, 6.8, 2.1], m: [47.6, -0.2, 1.0] },
          { p: [46.4, 3.4, 1.7], m: [47.0, -0.6, 1.1] },
        );
      else if (nivel >= 7)
        puntos.push(
          { corte: true, p: [46.9, 6.5, 2.9], m: [41.6, 2.2, 0.8] },
          { p: [42.4, 5.8, 2.0], m: [37.0, 1.6, 0.9] },
          { p: [39.4, 2.6, 1.6], m: [36.8, 1.3, 0.8] },
        );
      else if (nivel >= 6)
        puntos.push(
          { p: [6.2, 4.6, 2.4], m: [9.0, 2.1, 0.2] },
          { corte: true, p: [46.9, 6.5, 2.9], m: [43.6, 2.2, 0.8] },
          { p: [45.6, 6.2, 1.9], m: [41.0, 0.6, 1.0] },
          { p: [41.8, 6.2, 1.8], m: [44.8, 0.8, 1.2] },
        );
      puntos.push(nivel >= 6 ? { ...ojo, corte: true } : ojo);
      return new Promise((fin) => {
        tour = { t0: performance.now(), paso: 1.5, puntos, fin };
        invalidate();
      });
    },
    /** ¿Está el recorrido en marcha? (para las pruebas) */
    enRecorrido: () => Boolean(tour),
    /**
     * Decorar: la vista desde arriba con la rejilla; `sel`, la pieza elegida; `mal`, si no cabe donde está; `planta`, la que se
     * decora ('calle' o, desde el nivel 6, 'bodega').
     */
    decorar(on, { sel = null, mal = false, planta: dePlanta = 'calle' } = {}) {
      // 1.128: solo al entrar o estar en Decorar (si no, cada repintado del local cortaba el paseo hasta el cliente)
      if (on || modo.decorar) walk = null;
      modo = { decorar: Boolean(on), sel, mal, planta: dePlanta === 'bodega' && estado.nivel >= 6 ? 'bodega' : 'calle' };
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
    /** Los clientes del día: [{ n, aspecto, raro, influencer, servido, libro (título del que les diste) }]. */
    setClientes(lista = []) {
      clientes = lista;
      montarClientes();
    },
    /** 1.132: las fotos firmadas de la pared (los niveles de los influencers que se hicieron virales). */
    setFotos(niveles = []) {
      fotos = (Array.isArray(niveles) ? niveles : []).filter((n) => NIVELES_INFLUENCER.includes(n));
      montarFotos();
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
      // 1.128: salir de la barra sin estar en ella (al abrir o cerrar el panel de atender) no corta el paseo hasta el cliente
      if (on || barra.activa) walk = null;
      if (on && planta === 'bodega') {
        planta = 'calle';
        px = ANTE_PILAR.x;
        py = ANTE_PILAR.y;
        yaw = Math.PI / 2;
      }
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
      // Bloque 6a: si está en la otra planta, se baja (o se sube) con la taza y luego se va hasta él
      if (c.planta !== planta) return cambiarPlanta(c.planta).then(() => this.irACliente(n));
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
    /**
     * Bloque 6b: la vista del tostador (on), delante de la trampilla del tambor; al salir, delante del tostador. Sin letreros ni
     * toques mientras dura (el gesto lo lleva Tostadero.jsx).
     */
    tostador(on) {
      walk = null;
      if (on && planta !== 'bodega') return;
      if (on) {
        px = ANTE_TOSTADOR.x;
        py = ANTE_TOSTADOR.y;
        yaw = ANTE_TOSTADOR.yaw;
        if (barraT === 0) vista = { p: [...ENFOQUE_TOSTADOR.p], m: [...ENFOQUE_TOSTADOR.m] };
        vistaMeta = ENFOQUE_TOSTADOR;
      } else if (tost.activa) {
        onMove({ x: px, y: py, yaw });
      }
      tost = { ...tost, activa: Boolean(on) };
      montarTostador();
    },
    /** Lo que se ve del tostador: { encendido, listo, abierta, cae, caido, brazo, fase } (ver tostadorVivoKit). */
    setTostador(est = {}) {
      tost = { ...tost, est };
      montarTostador();
    },
    /** Dónde cae en la pantalla una marca del tostador ('asa', 'enfriador', 'tambor'), en px de la ventana. */
    tostadorMarca(nombre) {
      aim(performance.now());
      const m = TOSTADOR_MARCAS[nombre];
      if (!m) return null;
      const p = project(...m);
      const rect = canvas.getBoundingClientRect();
      return { x: rect.left + p.x, y: rect.top + p.y, front: p.front };
    },
    enTostador: () => tost.activa && barraT === 1,
    /**
     * 1.130: la librería (on): la cámara va de la barra (o de tus ojos) a la estantería de la pared; con `lleva` ({ receta, vista }),
     * la taza espera en la bandeja de la tabla. Al salir quedas de pie delante de la estantería y, con `llevar` ({ receta, vista,
     * paquete }), con la bandeja en la mano. Sin letreros ni toques en la escena mientras dura (los gestos los lleva Libreria.jsx).
     */
    libreria(on, { lleva = null, llevar = null } = {}) {
      // Salir sin estar dentro (al cerrar el cuadro de atender) no toca nada: ni el paseo ni la taza en la mano
      if (!on && !lib.activa) return;
      walk = null;
      if (on) {
        if (planta === 'bodega') planta = 'calle';
        lib = { activa: true, est: { fase: 'estanteria' }, lleva };
        if (barraT === 0) vista = { p: [...vistaLib().p], m: [...vistaLib().m] };
        vistaMeta = vistaLib();
        ponerEnMano(null);
      } else {
        if (lib.activa) {
          dePieAnteEstanteria();
          onMove({ x: px, y: py, yaw });
        }
        lib = { activa: false, est: {}, lleva: null };
        ponerEnMano(llevar);
      }
      montarPlano();
      montarLibreria();
    },
    /** Lo que se ve en la librería (ver `lib.est`): la cámara sigue a la fase y a la sección. */
    setLibreria(est = {}) {
      if (!lib.activa) return;
      const antes = lib.est.genero;
      lib = { ...lib, est };
      vistaMeta = vistaLib(est);
      if (est.genero !== antes) montarPlano();
      montarLibreria();
    },
    /**
     * Dónde cae en la pantalla una marca de la librería (en px de la ventana): 'placa:<género>', 'lomo:<k>' (de la sección que se
     * mira), 'libro', 'rollo', 'tarro', 'bolsas', 'sello', 'bandeja' o 'tabla'.
     */
    libreriaMarca(nombre) {
      aim(performance.now());
      const e = lib.est;
      const { F, yc } = libMesa(e);
      const ox = F + TABLA_SALE * suaveT(e.tabla ?? 0) - TABLA_SALE;
      const [tipo, cual] = String(nombre).split(':');
      let m = null;
      if (tipo === 'placa') {
        const t = libTramos.find((x) => x.genero === cual && x.placa);
        if (t) m = [F + 0.01, t.placa.y, t.z + 0.023];
      } else if (tipo === 'lomo') {
        for (const t of libTramos) {
          const l = t.genero === e.genero && t.lomos.find((x) => String(x.k) === cual);
          if (l) m = [F - 0.04, (l.y0 + l.y1) / 2, t.z + 0.05 + l.alto * 0.55];
        }
      } else {
        const g = e.libro?.g ?? 0.05;
        const b = suaveT(e.bandeja ?? 0);
        m = {
          libro: [ox + 0.3 + 0.04 * b, yc + 0.4 * b, TABLA_Z + g + 0.01],
          // Para llevar: el libro, de pie sobre la bolsa abierta, y el borde de la bolsa
          libroAlto: [ox + 0.3, yc, TABLA_Z + (e.libro?.alto ?? 0.3) * 1.5 + 0.12],
          bolsaBorde: [ox + 0.3, yc, TABLA_Z + (e.libro?.alto ?? 0.3) + 0.06],
          rollo: [ox + 0.06, yc, TABLA_Z + 0.09],
          tarro: [ox + 0.27, yc - 0.52, TABLA_Z + 0.15],
          bolsas: [ox + 0.445, yc - 0.54, TABLA_Z + 0.05],
          sello: [ox + 0.27, yc - 0.32, TABLA_Z + 0.1],
          bandeja: [ox + 0.29, yc + 0.48, TABLA_Z + 0.05],
          tabla: [ox + 0.3, yc, TABLA_Z],
        }[tipo] ?? null;
      }
      if (!m) return null;
      const p = project(...m);
      const rect = canvas.getBoundingClientRect();
      return { x: rect.left + p.x, y: rect.top + p.y, front: p.front };
    },
    /**
     * Las secciones de la estantería en la pantalla: [{ genero, nombre, x, y, ancho, front }] (donde va cada placa; `ancho`, los
     * px de su hueco, para que el nombre no pise al de al lado).
     */
    libreriaPlacas() {
      aim(performance.now());
      const { F } = libMesa();
      const rect = canvas.getBoundingClientRect();
      return libTramos
        .filter((t) => t.placa)
        .map((t) => {
          const p = project(F + 0.01, t.placa.y, t.z + 0.023);
          const h = (t.hueco ?? t.placa.ancho) / 2;
          const ancho = Math.abs(project(F + 0.01, t.placa.y + h, t.z + 0.023).x - project(F + 0.01, t.placa.y - h, t.z + 0.023).x);
          return { genero: t.genero, nombre: t.nombre, x: rect.left + p.x, y: rect.top + p.y, ancho, front: p.front };
        });
    },
    /**
     * Los lomos de la sección que se mira, en la pantalla (de izquierda a derecha): [{ k, clave, titulo, paginas, x, x0, x1,
     * y, front }] (x0 y x1, sus bordes a media altura; y, su cabeza).
     */
    libreriaLomos() {
      aim(performance.now());
      const e = lib.est;
      const { F } = libMesa(e);
      const rect = canvas.getBoundingClientRect();
      const out = [];
      for (const t of libTramos) {
        if (t.genero !== e.genero) continue;
        const z = t.z + 0.05;
        for (const l of t.lomos) {
          const a = project(F - 0.04, l.y1, z + l.alto * 0.5);
          const b = project(F - 0.04, l.y0, z + l.alto * 0.5);
          const c = project(F - 0.04, (l.y0 + l.y1) / 2, z + l.alto);
          out.push({ k: l.k, clave: l.clave, titulo: l.titulo, paginas: l.paginas, x: rect.left + (a.x + b.x) / 2, x0: rect.left + Math.min(a.x, b.x), x1: rect.left + Math.max(a.x, b.x), y: rect.top + c.y, front: a.front && b.front });
        }
      }
      return out.sort((p, q) => p.x - q.x);
    },
    enLibreria: () => lib.activa && barraT === 1,
    /**
     * 1.133: el taller de la trastienda (on): andas hasta la puerta de detrás de la barra, la cámara pasa por encima, la puerta
     * se abre y entras (con `est`, lo que ya se ve en el banco al llegar; ver `tall.est`). Al salir, al revés. Promesa que acaba al
     * llegar. Sin letreros ni toques en la escena mientras dura (los gestos los lleva Taller.jsx).
     */
    taller(on, est = {}) {
      return on ? entrarTaller(est) : salirTaller();
    },
    /** Lo que se ve en el taller (ver `tall.est`): la cámara sigue a la vista y al libro. */
    setTaller(est = {}) {
      if (!tall.activa) return;
      tall = { ...tall, est };
      vistaMeta = vistaTaller(est);
      montarTaller();
    },
    /**
     * El punto del libro bajo el dedo, en `u` y `v` de la superficie ('tapa': la tapa cerrada; 'pliego': las dos páginas, con la
     * guarda a la izquierda), sin recortar (fuera del libro sale de 0 a 1), o null.
     */
    tallerPunto(clientX, clientY, sup = tall.est.superficie ?? 'tapa') {
      aim(performance.now());
      rayAt(clientX, clientY);
      const L = libroOrigen();
      const { ancho: A, hondo: H } = LIBRO_TALLER;
      const corta = (z) => ray.ray.intersectPlane(planoTaller.set(arribaTaller, -z), hit);
      if (sup === 'tapa') return corta(L.z + LIBRO_Z.tapa) ? { u: (hit.x - L.x) / A, v: (hit.z - L.y) / H } : null;
      if (!corta(L.z + LIBRO_Z.pagina)) return null;
      let u = (hit.x - L.x + A) / (2 * A);
      let v = (hit.z - L.y) / H;
      if (u < 0.5 && corta(L.z + LIBRO_Z.guarda)) {
        u = Math.min(0.4999, (hit.x - L.x + A) / (2 * A));
        v = (hit.z - L.y) / H;
      }
      return { u, v };
    },
    /**
     * Dónde cae en la pantalla una marca del taller (en px de la ventana): 'tapa:u:v', 'pliego:u:v', 'letra:<k>', 'mancha:<k>',
     * 'pliegue' (o 'pliegue:a' y 'pliegue:b', sus puntas), 'husillo', 'lomo', 'libro', 'guarda', 'prensa' o 'celestino'.
     */
    tallerMarca(nombre) {
      aim(performance.now());
      const e = tall.est;
      const L = libroOrigen(e);
      const enc = e.encargo;
      const [tipo, a, b] = String(nombre).split(':');
      let m = null;
      if (tipo === 'tapa') m = enTapa(L, Number(a), Number(b));
      else if (tipo === 'pliego') m = enPliego(L, Number(a), Number(b));
      else if (tipo === 'letra') {
        const l = letrasTapa(enc?.tapa ?? '')[Number(a)];
        if (l) m = enTapa(L, l.u, l.v);
      } else if (tipo === 'mancha') {
        const k = manchasDe(semillaEncargo(enc))[Number(a)];
        if (k) m = enPliego(L, k.u, k.v);
      } else if (tipo === 'pliegue') {
        const [u, v] = a === 'a' ? PLIEGUE.a : a === 'b' ? PLIEGUE.b : [(PLIEGUE.a[0] + PLIEGUE.b[0]) / 2, (PLIEGUE.a[1] + PLIEGUE.b[1]) / 2];
        m = enPliego(L, u, v);
      } else
        m =
          {
            husillo: [PRENSA_TALLER.x, PRENSA_TALLER.y, husilloZ(e.vistas?.prensa?.prensa ?? 0) - 0.012],
            lomo: enTapa(L, 0.08, 0.5),
            libro: enTapa(L, 0.5, 0.5),
            guarda: enPliego(L, 0.25, 0.62),
            prensa: [PRENSA_TALLER.x, PRENSA_TALLER.y, 1.0],
            celestino: [CELESTINO.x, CELESTINO.y, 1.95],
          }[tipo] ?? null;
      if (!m) return null;
      const p = project(...m);
      const rect = canvas.getBoundingClientRect();
      return { x: rect.left + p.x, y: rect.top + p.y, front: p.front };
    },
    /** ¿Estás en el taller, con la cámara ya en su sitio? */
    enTaller: () => tall.activa && barraT === 1 && !tour,
    /** ¿Se está entrando o saliendo del taller? (para las pruebas) */
    yendoTaller: () => Boolean(yendoTaller),
    destroy() {
      ponerEnMano(null);
      destroyed = true;
      lib = { activa: false, est: {}, lleva: null };
      montarLibreria();
      tall = { activa: false, est: {} };
      tallerGrupo.visible = false;
      montarTaller();
      for (const m of [cuerpoM, placaM]) m?.geometry.dispose();
      vaciarGrupo();
      clientes = [];
      montarClientes();
      fotos = [];
      for (const m of fotosGrupo.children.slice()) {
        fotosGrupo.remove(m);
        m.geometry.dispose();
      }
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
