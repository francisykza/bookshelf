// El Almacén del Puerto en primera persona (encargo de Francisco del 9-11-2026: la Lonja pasa a ser un gran almacén de
// muebles en 3D). El mismo modo de hacer que la recepción (`recepcion3d.js`): Three.js a 320 px de ancho ampliado sin
// suavizar, texturas de píxel pintadas una vez con las rampas y el tramado del dibujo isométrico, la luz ya pintada en
// ellas (lámparas colgadas sobre los pasillos) y nada de luces, sombras ni físicas en tiempo real. Solo se dibuja cuando
// algo cambia.
// - La nave: ladrillo abajo y encalado arriba, cerchas de acero, lucernarios al cielo de noche, suelo de hormigón con el
//   camino pintado y sus flechas.
// - Los muebles son los del catálogo (`shapeOf`, las mismas cajas que en el piso), en tarimas o colgados en el muro.
//   Se cargan por zonas: una zona se monta al acercarse y se esconde al alejarse (los modelos y el material se comparten).
// - Se anda por los pasillos (tocar el suelo lleva hasta allí por la red de `almacenLayout.js`), se mira arrastrando y se
//   toca un mueble para verlo de cerca: con más resolución, girándolo con el dedo y en el tono elegido.
// - Quien te acompaña se ve con su personaje (`actorBoxes`) y su carretilla, sin lo que lleva dentro.
import { BoxGeometry, BufferGeometry, CanvasTexture, Color, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, NearestFilter, PerspectiveCamera, Plane, PlaneGeometry, Raycaster, SRGBColorSpace, Scene, Vector2, Vector3, WebGLRenderer } from 'three';
// 1.99 (§99): «Sella el albarán» se juega en el propio mostrador de la caja (la cinta, el sello colgado de su carril, los
// planos y la tinta), con la cámara encima; la página solo pone el botón y la marcha del albarán.
import { createRaster, hash, noise, rgb } from '../../minigames/libreria-puerto/raster';
import { DEFAULT_AVATAR, actorBoxes } from '../actor';
import { catalogItem } from '../catalog';
import { shapeOf } from '../furniture';
import { AD, AH, AMBIENTES, AW, CAJA, DIRECTORIO, EXPOSITORES, EYE, HAB, HABITACIONES, INICIO, ISLA, MUELLE, MURO, NODOS, PASO, PROBADOR, PUERTA, RACKS, RINCON, TRAMOS, dentro, onNet, route } from './almacenLayout';

const ART_W = 320;
/** De cerca, al examinar un mueble, la imagen tiene más resolución (sigue siendo de píxel). */
const ART_W_CERCA = 480;
const PX = 16; // píxeles de textura por casilla en suelo, paredes y techo
const HFOV = 64;
const VFOV_LANDSCAPE = 62;
const VFOV_MAX = 92;
const PITCH = -0.13;
const DRAG = 0.005;
const SPIN = 0.012;
const KEY_STEP = 0.1;
const WALK = 3.8; // casillas por segundo
const TAP_SLOP = 8;
const TWEEN_MS = 700;
/** Una zona se monta a menos de esta distancia y se esconde a más de la segunda. */
const CERCA = 15;
const LEJOS = 18;
/** Las etiquetas de precio, solo de lo cercano y como mucho estas. */
const ETIQUETAS = 6;
const ETIQUETA_LEJOS = 7;

const linear = ([r, g, b]) => new Color().setRGB(r / 255, g / 255, b / 255, SRGBColorSpace);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

let probeRaster = null;
const probe = () => (probeRaster ??= createRaster({ W: 2, H: 2, S: 1, yaw: 0, ox: 0, oy: 0 }));
const unpack = (p) => [p & 255, (p >> 8) & 255, (p >> 16) & 255];

// ── Los colores de la casa: ladrillo del puerto, encalado, acero, el verde azulado de la marca y latón ──
const BRICK = [146, 74, 56];
const CAL = [214, 206, 190];
const STEEL = [64, 72, 80];
const STEEL_D = [40, 46, 54];
const TEAL = [40, 100, 96];
const TEAL_D = [26, 70, 68];
const BRASS = [214, 162, 76];
const CONCRETE = [150, 144, 134];
const OAK = [178, 132, 86];
const CARTON = [190, 146, 96];
const PATH = [184, 96, 66];
const LAMP = [255, 226, 168];
const PAPER = [240, 232, 212];
const CAJERO = { ...DEFAULT_AVATAR, piel: 3, pelo: 'corto', colorPelo: 4, jersey: 17, pantalon: 1, gafas: true };

// ── La luz, pintada: lámparas de campana sobre los pasillos, la de la caja y la de la entrada ──
const LUCES = [
  ...[4.2, 11, 15.5].flatMap((x) => [7, 12.6, 18].map((y) => ({ at: [x, y, 4.3], k: 0.75, reach: 5.6 }))),
  { at: [8, 2.6, 4.4], k: 0.7, reach: 6 },
  { at: [14, 2.6, 4.4], k: 0.6, reach: 5 },
  { at: [4.4, 23.6, 3.4], k: 0.9, reach: 4.6 },
  { at: [15.5, 23.2, 4.2], k: 0.6, reach: 4.4 },
  { at: [1.4, 11.3, 2.7], k: 0.45, reach: 2.6 },
  { at: [1.6, 17.3, 2.4], k: 0.35, reach: 2.4 },
  // 1.101 · Las habitaciones: dos campanas sobre el pasillo 4, una lámpara en cada habitación y el foco del rincón especial
  { at: [23.5, 6.8, 4.3], k: 0.7, reach: 5.4 },
  { at: [23.5, 12.4, 4.3], k: 0.7, reach: 5.4 },
  { at: [20.1, 7.8, 3.1], k: 0.5, reach: 3.2 },
  { at: [20.1, 13.0, 3.1], k: 0.5, reach: 3.2 },
  { at: [27.2, 9.6, 3.6], k: 0.55, reach: 3.6 },
  { at: [28.2, 14.0, 1.8], k: 0.6, reach: 2.8 },
];
function glowAt(x, y, z) {
  let g = 0.08;
  for (const { at, k, reach } of LUCES) {
    const d = Math.hypot(x - at[0], y - at[1], (z - at[2]) * 1.15) / reach;
    if (d < 1) g += k * (1 - d) ** 1.5;
  }
  return Math.min(1, g);
}
const FAR = [0.72, 0.7, 0.82];
const NEAR = [1.1, 1.02, 0.88];
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

function texture(canvas) {
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  t.magFilter = NearestFilter;
  t.minFilter = NearestFilter;
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

// ── El suelo: hormigón pulido con juntas, el camino pintado con sus flechas, las alfombras de los ambientes ──
const SEGS = TRAMOS.map(([a, b]) => [NODOS[a], NODOS[b]]);
function paintFloor(X0 = 0, Y0 = 0, W = AW, D = AD) {
  const r = probe();
  const con = r.rampOf(CONCRETE);
  const path = r.rampOf(PATH);
  const teal = r.rampOf(TEAL);
  return canvasOf(Math.round(W * PX), Math.round(D * PX), (ix, iy) => {
    const x = X0 + (ix + 0.5) / PX;
    const y = Y0 + (iy + 0.5) / PX;
    const k = r.bayerAt(ix, iy);
    let c;
    // 1.101 · El suelo de cada habitación montada
    const hab = HABITACIONES.find((h) => x > h.x0 + 0.08 && x < h.x1 - 0.06 && y > h.y0 + 0.12 && y < h.y1 - 0.06);
    if (hab) return lit(sueloHab(r, hab, x, y, ix, iy), glowAt(x, y, 0), ix, iy);
    // Las alfombras de los ambientes montados
    const amb = AMBIENTES.find((a) => x > 0.25 && x < 3.05 && y > a.y0 + 0.2 && y < a.y1 - 0.2);
    if (amb) {
      const ramp = r.rampOf(amb.alfombra);
      const e = Math.min(x - 0.25, 3.05 - x, y - amb.y0 - 0.2, amb.y1 - 0.2 - y);
      const border = e < 0.12 || (e > 0.22 && e < 0.28);
      c = ramp[border ? 1 : clamp(Math.floor(3 + (noise(x * 5, y * 5) - 0.5) * 0.8 + (k - 0.5) * 0.4), 2, 4)];
      return lit(c, glowAt(x, y, 0), ix, iy);
    }
    // El felpudo de la caja y el de la entrada
    if ((x > 1.6 && x < 6.8 && y > 21.7 && y < 23.3) || (x > PUERTA.x0 && x < PUERTA.x1 && y > AD - 1.6)) {
      const e = Math.min(Math.abs(x - 1.6), Math.abs(x - 6.8), Math.abs(y - 21.7), Math.abs(y - 23.3));
      c = teal[y > 23.3 ? ((ix + iy) % 3 ? 1 : 2) : e < 0.08 ? 4 : (ix + iy) % 4 ? 2 : 1];
      return lit(c, glowAt(x, y, 0), ix, iy);
    }
    // Hormigón: manchas suaves y juntas cada tres casillas
    const seam = x % 3 < 0.05 || y % 3 < 0.05;
    let level = clamp(Math.floor(2.8 + (noise(x * 1.7, y * 1.7) - 0.5) * 1.1 + (k - 0.5) * 0.5 - (seam ? 1 : 0)), 0, 4);
    if (hash(ix, iy) > 0.985) level = Math.max(0, level - 1);
    c = con[level];
    // El camino: una banda más clara por los pasillos con filete y flechas de terracota
    for (const [[ax, ay], [bx, by]] of SEGS) {
      const dx = bx - ax;
      const dy = by - ay;
      const L = Math.hypot(dx, dy);
      const t = ((x - ax) * dx + (y - ay) * dy) / (L * L);
      if (t < -0.02 || t > 1.02) continue;
      const lat = ((x - ax) * dy - (y - ay) * dx) / L;
      if (Math.abs(lat) > 0.62) continue;
      if (Math.abs(Math.abs(lat) - 0.56) < 0.045) c = path[2];
      else {
        c = con[Math.min(4, level + 1)];
        const along = (t * L) % 1.7;
        const u = along - 0.85;
        if (Math.abs(lat) < 0.3 && Math.abs(u - (0.22 - Math.abs(lat))) < 0.07) c = path[3];
      }
      break;
    }
    // Bajo las estanterías y en la junta del muelle, más oscuro
    if (y < RACKS.y1 + 0.15 && x > RACKS.x0 - 0.1 && x < RACKS.x1 + 0.1) c = con[1];
    return lit(c, glowAt(x, y, 0), ix, iy);
  });
}

/** 1.101 · El suelo de una habitación: tarima en el estudio, alfombra en la salita y, en la de superhéroes, tramas de viñeta. */
function sueloHab(r, h, x, y, ix, iy) {
  const ramp = r.rampOf(h.suelo);
  const e = Math.min(x - h.x0, h.x1 - x, y - h.y0, h.y1 - y);
  if (h.heroes) {
    if (e < 0.16) return r.rampOf(BRASS)[e < 0.06 ? 2 : 3];
    // Puntos de trama (como los de un cómic impreso), más grandes hacia el rincón del escenario
    const s = 0.22;
    const gx = x / s - Math.floor(x / s) - 0.5;
    const gy = y / s - Math.floor(y / s) - 0.5;
    const big = 0.18 + 0.14 * clamp(1 - Math.hypot(x - RINCON.x, y - RINCON.y) / 7, 0, 1);
    return Math.hypot(gx, gy) < big ? ramp[3] : ramp[2];
  }
  if (h.id === 'hab-salita') {
    const border = e < 0.3 || (e > 0.42 && e < 0.48);
    return ramp[border ? 1 : clamp(Math.floor(3 + (noise(x * 5, y * 5) - 0.5) * 0.8 + (r.bayerAt(ix, iy) - 0.5) * 0.4), 2, 4)];
  }
  // Tarima: lamas a lo largo de la habitación, con las juntas a tresbolillo
  const row = Math.floor(y / 0.32);
  const seam = y % 0.32 < 0.03 || (x + (row % 3) * 0.7) % 2.1 < 0.03;
  return ramp[seam ? 1 : clamp(Math.floor(2.5 + hash(Math.floor((x + (row % 3) * 0.7) / 2.1), row) * 1.4 + (r.bayerAt(ix, iy) - 0.5) * 0.3), 2, 4)];
}

/** 1.101 · El papel de las paredes de cada habitación montada (a lo largo de la pared, alto), con su zócalo de roble. */
function papelHab(r, h, a, b) {
  if (b < 0.42) return r.rampOf(OAK)[b > 0.36 ? 4 : 2];
  const ramp = r.rampOf(h.papel);
  if (h.heroes) {
    // Azul noche con una franja roja y dorada a media altura y estrellitas de trama
    if (b > 1.18 && b < 1.34) return b > 1.3 || b < 1.22 ? r.rampOf(BRASS)[3] : [176, 44, 48];
    const s = 0.3;
    const u = a / s - Math.floor(a / s) - 0.5;
    const v = b / s - Math.floor(b / s) - 0.5;
    return Math.abs(u) + Math.abs(v) < 0.16 ? r.rampOf(h.raya)[3] : ramp[2];
  }
  const stripe = h.id === 'hab-estudio' ? (a * 2.5) % 1 < 0.1 : (a * 3) % 1 < 0.18;
  return ramp[stripe ? 2 : 3];
}

/** 1.101 · El mural del rincón especial: la ciudad de noche y, en las nubes, la señal del foco (un rayo en un círculo de luz). */
function muralAt(r, y, b) {
  const y0 = 12.3;
  const y1 = 15.45;
  const b0 = 0.8;
  const b1 = 3.45;
  if (y < y0 || y > y1 || b < b0 || b > b1) return null;
  const brass = r.rampOf(BRASS);
  if (y - y0 < 0.08 || y1 - y < 0.08 || b - b0 < 0.08 || b1 - b < 0.08) return { c: brass[3] };
  const cx = 14.15;
  const cz = 2.7;
  const d = Math.hypot(y - cx, b - cz);
  if (d < 0.46) {
    const p = (y - cx) / 0.46;
    const q = (b - cz) / 0.46;
    // Un rayo en zigzag: baja de arriba a la derecha, un escalón y sigue hasta abajo a la izquierda
    const arriba = q > 0.02 && q < 0.74 && Math.abs(p - (-0.06 + (q - 0.02) * 0.5)) < 0.11;
    const escalon = q > -0.08 && q < 0.08 && p > -0.16 && p < 0.24;
    const abajo = q < -0.02 && q > -0.74 && Math.abs(p - (0.14 + (q + 0.02) * 0.5)) < 0.11;
    const bolt = arriba || escalon || abajo;
    return { c: bolt ? [40, 36, 54] : [252, 238, 196], glow: !bolt };
  }
  if (d < 0.6) return { c: [150, 146, 170] };
  // Los edificios recortados, con ventanas encendidas
  const col = Math.floor((y - y0) / 0.26);
  const h = 0.5 + hash(col, 41) * 1.1;
  if (b - b0 < h) {
    const lit = (y * 9) % 1 < 0.42 && (b * 7) % 1 < 0.45 && hash(Math.floor(y * 9), Math.floor(b * 7)) > 0.55;
    return { c: lit ? [255, 214, 120] : [26, 28, 52], glow: lit };
  }
  // El haz del foco, de abajo a la izquierda hasta la señal
  const t = (y - 12.6) / (cx - 12.6);
  if (t > 0 && t < 1 && Math.abs(b - (1.2 + t * (cz - 1.2))) < 0.08 + t * 0.3) return { c: [120, 116, 150] };
  const v = (b - b0) / (b1 - b0);
  return { c: [lerp(70, 34, v), lerp(56, 30, v), lerp(110, 70, v)] };
}

/** Ladrillo visto: hiladas de 0,18 con juntas, a tresbolillo. */
function brickAt(r, a, b, ix, iy, ramp) {
  const row = Math.floor(b / 0.18);
  const off = row % 2 ? 0.21 : 0;
  const joint = b % 0.18 < 0.025 || (a + off) % 0.42 < 0.025;
  if (joint) return ramp[1];
  const n = hash(Math.floor((a + off) / 0.42), row);
  return ramp[clamp(Math.floor(2.4 + n * 1.6 + (r.bayerAt(ix, iy) - 0.5) * 0.4), 2, 4)];
}

/** El cielo de noche por un lucernario o una ventana alta. */
function nightSky(u, v, seed) {
  const star = hash(Math.floor(u * 50) + seed, Math.floor(v * 30)) > 0.985;
  return star ? rgb(244, 236, 214) : rgb(lerp(56, 22, v), lerp(48, 24, v), lerp(96, 58, v));
}

// ── Las paredes: ladrillo abajo, encalado arriba, la franja de la casa y en cada una lo suyo ──
function paintWall(w, world, extra = () => null) {
  const r = probe();
  const brick = r.rampOf(BRICK);
  const cal = r.rampOf(CAL);
  const teal = r.rampOf(TEAL);
  const brass = r.rampOf(BRASS);
  const steel = r.rampOf(STEEL);
  const h = Math.round(AH * PX);
  return canvasOf(w * PX, h, (ix, iy) => {
    const a = (ix + 0.5) / PX;
    const b = AH - (iy + 0.5) / PX;
    const own = extra(a, b, ix, iy);
    if (own != null) return own;
    let c;
    if (b < 1.3) c = brickAt(r, a, b, ix, iy, brick);
    else if (b < 1.44) c = b > 1.4 ? brass[3] : teal[2];
    else if (b > 4.55 && b < 5.45 && a % 3.2 > 0.9 && a % 3.2 < 2.3) {
      // Ventanas altas con su carpintería de acero
      const u = a % 3.2;
      const frame = u < 0.98 || u > 2.22 || b < 4.63 || b > 5.37 || Math.abs(u - 1.6) < 0.035;
      c = frame ? steel[1] : nightSky((u - 0.9) / 1.4, (b - 4.55) / 0.9, Math.floor(a / 3.2) * 7);
      return c;
    } else {
      const bc = brickAt(r, a, b, ix, iy, cal);
      c = bc === cal[1] ? cal[2] : cal[3];
      if (b > AH - 0.25) c = cal[1];
    }
    return lit(c, glowAt(...world(a, b)), ix, iy);
  });
}

/** El escudo de la casa, pintado en el muro de la caja: un ancla de latón sobre un círculo verde, con un sillón en medio. */
function emblem(a, b, cx, cz, R, teal, brass) {
  const dx = a - cx;
  const dz = b - cz;
  const d = Math.hypot(dx, dz);
  if (d > R) return null;
  if (d > R - 0.08) return brass[3];
  // El ancla: caña, cepo, brazos en arco y la argolla
  const shaft = Math.abs(dx) < 0.07 && dz > -0.55 && dz < 0.5;
  const stock = Math.abs(dz - 0.32) < 0.05 && Math.abs(dx) < 0.32;
  const ring = Math.abs(Math.hypot(dx, dz - 0.6) - 0.1) < 0.04;
  const arms = dz < -0.15 && Math.abs(Math.hypot(dx, dz + 0.05) - 0.52) < 0.06 && dz > -0.62;
  if (shaft || stock || ring || arms) return brass[4];
  return teal[d > R - 0.2 ? 1 : 2];
}

// ── El techo: chapa de acero con sus ondas y tres lucernarios corridos ──
const LUCERNARIOS = [
  [6.4, 7.8],
  [12.0, 13.4],
  [17.6, 19.0],
];
function paintCeiling(X0 = 0, Y0 = 0, W = AW, D = AD) {
  const r = probe();
  const steel = r.rampOf(STEEL);
  return canvasOf(Math.round(W * PX), Math.round(D * PX), (ix, iy) => {
    const x = X0 + (ix + 0.5) / PX;
    const y = Y0 + D - (iy + 0.5) / PX;
    for (const [y0, y1] of LUCERNARIOS) {
      if (y > y0 && y < y1 && x > 1.5 && x < AW - 1.5) {
        const frame = y - y0 < 0.08 || y1 - y < 0.08 || x % 1.5 < 0.06;
        return frame ? steel[1] : nightSky((x - 1.5) / (AW - 3), (y - y0) / (y1 - y0), Math.floor(y0));
      }
    }
    const wave = (x * 4) % 1 < 0.5;
    return lit(steel[wave ? 2 : 1], glowAt(x, y, AH) * 0.8, ix, iy);
  });
}

// ── Cajas: mundo de la app (x, y a lo hondo, z arriba) → Three (x, z, y) ──
const FACE_TONE = { top: 1.06, bottom: 0.6, front: 0.92, back: 0.74, right: 0.84, left: 0.8 };
function pushBox(out, [x0, y0, z0, x1, y1, z1], color, { glow = false, g = null } = {}) {
  const gl = glow ? 0 : (g ?? glowAt((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2));
  const faces = [
    ['front', [[x0, z0, y1], [x1, z0, y1], [x1, z1, y1], [x0, z1, y1]], [0, 0, 1]],
    ['back', [[x1, z0, y0], [x0, z0, y0], [x0, z1, y0], [x1, z1, y0]], [0, 0, -1]],
    ['right', [[x1, z0, y1], [x1, z0, y0], [x1, z1, y0], [x1, z1, y1]], [1, 0, 0]],
    ['left', [[x0, z0, y0], [x0, z0, y1], [x0, z1, y1], [x0, z1, y0]], [-1, 0, 0]],
    ['top', [[x0, z1, y1], [x1, z1, y1], [x1, z1, y0], [x0, z1, y0]], [0, 1, 0]],
    ['bottom', [[x0, z0, y0], [x1, z0, y0], [x1, z0, y1], [x0, z0, y1]], [0, -1, 0]],
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

/** La nave: cerchas, lámparas de campana, columnas, el muro de exposición, la isla y el muelle. */
function buildShell() {
  const s = kit();
  // Cerchas de acero de lado a lado, con montantes, cada cinco casillas y media
  for (const y of [4.6, 10.2, 15.8, 21.4]) {
    pushBox(s, [0, y - 0.1, AH - 0.32, AW, y + 0.1, AH - 0.08], STEEL_D);
    pushBox(s, [0, y - 0.06, AH - 1.0, AW, y + 0.06, AH - 0.92], STEEL);
    for (let x = 0.6; x < AW; x += 1.5) pushBox(s, [x - 0.04, y - 0.04, AH - 0.92, x + 0.04, y + 0.04, AH - 0.32], STEEL);
  }
  // Lámparas de campana: cable, campana verde y la luz por debajo
  for (const { at } of LUCES.slice(0, 13)) {
    const [x, y, z] = at;
    pushBox(s, [x - 0.02, y - 0.02, z + 0.3, x + 0.02, y + 0.02, AH - 0.32], STEEL_D);
    pushBox(s, [x - 0.12, y - 0.12, z + 0.2, x + 0.12, y + 0.12, z + 0.3], TEAL_D);
    pushBox(s, [x - 0.34, y - 0.34, z, x + 0.34, y + 0.34, z + 0.2], TEAL);
    pushBox(s, [x - 0.26, y - 0.26, z - 0.05, x + 0.26, y + 0.26, z], LAMP, { glow: true });
  }
  // La lámpara de la caja, más baja, y la de la entrada
  for (const [x, y, z] of [
    [4.4, 23.6, 3.4],
    [15.5, 23.2, 4.2],
  ]) {
    pushBox(s, [x - 0.02, y - 0.02, z + 0.2, x + 0.02, y + 0.02, AH - 0.32], STEEL_D);
    pushBox(s, [x - 0.45, y - 0.2, z, x + 0.45, y + 0.2, z + 0.22], BRASS);
    pushBox(s, [x - 0.38, y - 0.14, z - 0.05, x + 0.38, y + 0.14, z], LAMP, { glow: true });
  }
  // Rodapié de acero
  pushBox(s, [0, 0, 0, AW, 0.06, 0.12], STEEL_D);
  pushBox(s, [0, AD - 0.06, 0, AW, AD, 0.12], STEEL_D);
  pushBox(s, [0, 0, 0, 0.06, AD, 0.12], STEEL_D);
  pushBox(s, [AW - 0.06, 0, 0, AW, AD, 0.12], STEEL_D);
  // La isla: la espina baja con su remate de latón y los carteles colgados sobre los pasillos
  const [e0, e1] = ISLA.espina;
  pushBox(s, [e0, ISLA.y0, 0, e1, ISLA.y1, ISLA.alto], TEAL);
  pushBox(s, [e0 - 0.04, ISLA.y0 - 0.04, ISLA.alto, e1 + 0.04, ISLA.y1 + 0.04, ISLA.alto + 0.06], BRASS);
  for (const y of [ISLA.y0, ISLA.y1]) pushBox(s, [e0 - 0.08, y - 0.08, 0, e1 + 0.08, y + 0.08, AH - 0.32], STEEL);
  // El muro de exposición, encalado, con zócalo verde y remate de latón
  pushBox(s, [MURO.x0, MURO.y0, 0, MURO.x1, MURO.y1, 0.9], TEAL);
  pushBox(s, [MURO.x0, MURO.y0, 0.9, MURO.x1, MURO.y1, MURO.alto], CAL);
  pushBox(s, [MURO.x0 - 0.04, MURO.y0 - 0.04, MURO.alto, MURO.x1 + 0.04, MURO.y1 + 0.04, MURO.alto + 0.08], BRASS);
  pushBox(s, [MURO.x0 - 0.03, MURO.y0, 0.9, MURO.x1 + 0.03, MURO.y1, 0.98], BRASS);
  // Los carteles colgados (el texto va en las etiquetas de latón de encima)
  for (const [x, y, w] of [
    [4.2, 12.6, 1.6],
    [11, 9.4, 1.6],
    [1.6, 12.6, 1.4],
    [4.4, 22.4, 1.2],
  ]) {
    pushBox(s, [x - 0.02, y - 0.02, 4.0, x + 0.02, y + 0.02, AH - 0.32], STEEL_D);
    pushBox(s, [x - w / 2, y - 0.05, 3.55, x + w / 2, y + 0.05, 4.0], TEAL);
    pushBox(s, [x - w / 2 - 0.04, y - 0.06, 3.5, x + w / 2 + 0.04, y + 0.06, 3.55], BRASS);
  }
  // Los dos ambientes montados: un tabique entre ellos, empapelado
  pushBox(s, [0, 12.45, 0, 3.15, 12.75, 2.7], [128, 150, 112]);
  pushBox(s, [0, 12.42, 2.7, 3.2, 12.78, 2.78], OAK);
  // La puerta de la entrada: marco de acero por dentro
  pushBox(s, [PUERTA.x0 - 0.12, AD - 0.1, 0, PUERTA.x0, AD, PUERTA.alto + 0.12], STEEL);
  pushBox(s, [PUERTA.x1, AD - 0.1, 0, PUERTA.x1 + 0.12, AD, PUERTA.alto + 0.12], STEEL);
  pushBox(s, [PUERTA.x0, AD - 0.1, PUERTA.alto, PUERTA.x1, AD, PUERTA.alto + 0.12], STEEL);
  // El muelle de carga: marco y topes de goma
  pushBox(s, [MUELLE.x0 - 0.16, 0, 0, MUELLE.x0, 0.14, MUELLE.alto + 0.16], STEEL_D);
  pushBox(s, [MUELLE.x1, 0, 0, MUELLE.x1 + 0.16, 0.14, MUELLE.alto + 0.16], STEEL_D);
  pushBox(s, [MUELLE.x0, 0, MUELLE.alto, MUELLE.x1, 0.14, MUELLE.alto + 0.16], STEEL_D);
  pushBox(s, [MUELLE.x0 + 0.3, 0, MUELLE.alto + 0.3, MUELLE.x1 - 0.3, 0.12, MUELLE.alto + 0.5], LAMP, { glow: true });
  for (const x of [MUELLE.x0 + 0.2, MUELLE.x1 - 0.4]) pushBox(s, [x, 0, 0.3, x + 0.2, 0.28, 0.75], [44, 42, 48]);
  return s;
}

/** Las estanterías de autoservicio del fondo: montantes verdes, largueros de latón y paquetes planos de cartón. */
function buildRacks() {
  const s = kit();
  const { x0, x1, y0, y1, niveles } = RACKS;
  const bays = Math.round((x1 - x0) / 2.6);
  const bw = (x1 - x0) / bays;
  for (let k = 0; k <= bays; k += 1) {
    const x = x0 + k * bw;
    for (const y of [y0, y1 - 0.1]) pushBox(s, [x - 0.06, y, 0, x + 0.06, y + 0.1, niveles.at(-1) + 0.9], TEAL);
  }
  niveles.forEach((z, n) => {
    pushBox(s, [x0, y1 - 0.1, z, x1, y1, z + 0.12], [196, 108, 64]);
    pushBox(s, [x0, y0, z, x1, y0 + 0.1, z + 0.12], [196, 108, 64]);
    pushBox(s, [x0, y0, z + 0.04, x1, y1, z + 0.08], STEEL);
    // Paquetes: pilas de cajas planas de cartón, cada una con su etiqueta de plano
    for (let k = 0; k < bays; k += 1) {
      const bx = x0 + k * bw;
      const many = 1 + Math.floor(hash(k * 7 + n, 3) * 3);
      let cx = bx + 0.2;
      for (let p = 0; p < many && cx < bx + bw - 0.6; p += 1) {
        const w = 0.6 + hash(k, n * 5 + p) * 0.5;
        const stack = 1 + Math.floor(hash(k + p, n) * 3);
        for (let q = 0; q < stack; q += 1) {
          const zz = z + 0.12 + q * 0.26;
          if (zz + 0.24 > (niveles[n + 1] ?? z + 1.2) - 0.05) break;
          pushBox(s, [cx, y0 + 0.2, zz, cx + w, y1 - 0.15, zz + 0.24], q % 2 ? CARTON : [176, 132, 86]);
          pushBox(s, [cx + w * 0.3, y1 - 0.15, zz + 0.06, cx + w * 0.7, y1 - 0.13, zz + 0.18], PAPER);
          pushBox(s, [cx + w * 0.36, y1 - 0.13, zz + 0.1, cx + w * 0.5, y1 - 0.12, zz + 0.14], [86, 112, 142]);
        }
        cx += w + 0.12;
      }
    }
  });
  return s;
}

/** La caja: mostrador con cinta, la registradora, el cesto de lápices y el cajero detrás. */
function buildCaja() {
  const s = kit();
  const { x0, x1, y0, y1, cajero } = CAJA;
  pushBox(s, [x0, y0, 0, x1, y1, 1.0], TEAL_D);
  pushBox(s, [x0 + 0.05, y0 - 0.02, 0.15, x1 - 0.05, y0, 0.9], TEAL);
  pushBox(s, [x0 - 0.05, y0 - 0.06, 1.0, x1 + 0.05, y1 + 0.04, 1.08], OAK);
  pushBox(s, [x0 + 0.15, y0 + 0.08, 1.08, x0 + 2.7, y1 - 0.08, 1.14], [44, 42, 48]);
  for (let x = x0 + 0.3; x < x0 + 2.6; x += 0.35) pushBox(s, [x, y0 + 0.1, 1.14, x + 0.04, y1 - 0.1, 1.15], [70, 66, 72]);
  // La registradora y su pantalla encendida
  pushBox(s, [x0 + 3.5, y0 + 0.12, 1.08, x0 + 4.3, y1 - 0.06, 1.34], STEEL_D);
  pushBox(s, [x0 + 3.62, y0 + 0.3, 1.34, x0 + 4.18, y0 + 0.36, 1.66], STEEL);
  pushBox(s, [x0 + 3.68, y0 + 0.28, 1.4, x0 + 4.12, y0 + 0.3, 1.6], [150, 220, 190], { glow: true });
  // El sello de caucho y el tampón (el del minijuego)
  pushBox(s, [x0 + 4.6, y0 + 0.2, 1.08, x0 + 5.1, y0 + 0.5, 1.13], [130, 50, 46]);
  pushBox(s, [x0 + 4.75, y0 + 0.28, 1.13, x0 + 4.9, y0 + 0.42, 1.36], OAK);
  // El cesto de lápices y metros de papel
  pushBox(s, [x1 - 0.5, y0 + 0.15, 1.08, x1 - 0.2, y0 + 0.45, 1.3], BRASS);
  for (let k = 0; k < 4; k += 1) pushBox(s, [x1 - 0.45 + k * 0.06, y0 + 0.25, 1.3, x1 - 0.42 + k * 0.06, y0 + 0.28, 1.5], k % 2 ? PAPER : [86, 112, 142]);
  // El cajero
  actorBoxes(CAJERO, { pose: 'stand', x: cajero[0], y: cajero[1], facing: 2 }).forEach((bx) => pushBox(s, bx.b, bx.c));
  return s;
}

/** El directorio, junto a la entrada: un tótem verde con marco de latón (lo escrito va en su papel). */
function buildDirectorio() {
  const s = kit();
  const { x, y } = DIRECTORIO;
  pushBox(s, [x - 0.06, y - 0.06, 0, x + 0.06, y + 0.06, 0.9], STEEL);
  pushBox(s, [x - 0.4, y - 0.4, 0, x + 0.4, y + 0.4, 0.06], STEEL_D);
  pushBox(s, [x - 0.12, y - 0.8, 0.9, x + 0.12, y + 0.8, 2.7], TEAL);
  pushBox(s, [x - 0.14, y - 0.84, 2.66, x + 0.14, y + 0.84, 2.76], BRASS);
  pushBox(s, [x - 0.14, y - 0.84, 0.86, x + 0.14, y + 0.84, 0.94], BRASS);
  // Las franjas de las secciones, con su color
  [[86, 112, 142], [184, 98, 70], [204, 158, 70], [128, 150, 112]].forEach((c, k) => {
    pushBox(s, [x + 0.12, y - 0.6, 2.3 - k * 0.36, x + 0.14, y + 0.6, 2.5 - k * 0.36], PAPER);
    pushBox(s, [x + 0.14, y - 0.6, 2.32 - k * 0.36, x + 0.15, y - 0.4, 2.48 - k * 0.36], c);
  });
  return s;
}

// ── Los muebles, tal cual el catálogo: cada uno su malla, en coordenadas propias centradas, girada hacia su pasillo ──
/** Las cajas de un mueble: [x0, y0, z0, x1, y1, z1] centradas en su planta (lo de pared, pegado a y = 0) y su alto. */
function itemBoxes(id, tono) {
  const cat = catalogItem(id);
  let boxes = [];
  try {
    boxes = shapeOf(id, cat.tonos[tono] ?? cat.tonos[0]);
  } catch {
    boxes = [];
  }
  const pared = cat.capa === 'pared';
  const w = cat.w ?? 1;
  const d = cat.d ?? 1;
  return boxes.map((bx) => ({
    ...bx,
    b: [bx.b[0] - w / 2, pared ? bx.b[1] : bx.b[1] - d / 2, bx.b[2], bx.b[3] - w / 2, pared ? bx.b[4] : bx.b[4] - d / 2, bx.b[5]],
  }));
}
const BASE_TARIMA = 0.18;
/** La malla de un expositor: el mueble (y su tarima, si es de suelo), con la luz del sitio. */
function itemKit(e, tono) {
  const s = kit();
  const cat = catalogItem(e.id);
  const boxes = itemBoxes(e.id, tono);
  const base = e.pared ? 0 : (e.sobre ?? BASE_TARIMA);
  for (const bx of boxes) {
    const [x0, y0, z0, x1, y1, z1] = bx.b;
    const g = glowAt(e.x + e.n[0] * 0.5, e.y + e.n[1] * 0.5, (z0 + z1) / 2 + base);
    pushBox(s, [x0, y0, z0 + base, x1, y1, z1 + base], bx.c, { glow: Boolean(bx.glow), g });
  }
  if (!e.pared && e.sobre == null) {
    const w = (cat.w ?? 1) / 2 + 0.16;
    const d = (cat.d ?? 1) / 2 + 0.16;
    const g = glowAt(e.x, e.y, 0.1);
    pushBox(s, [-w, -d, 0, w, d, 0.12], TEAL, { g });
    pushBox(s, [-w + 0.03, -d + 0.03, 0.12, w - 0.03, d - 0.03, BASE_TARIMA], OAK, { g });
    // La etiqueta de estraza clavada en la tarima, delante
    pushBox(s, [-0.22, d, 0.03, 0.22, d + 0.02, 0.15], [206, 174, 120], { g });
  }
  // Lo que ocupa (para tocarlo y para encuadrarlo de cerca)
  const all = boxes.map((bx) => bx.b);
  const box = all.length
    ? [Math.min(...all.map((b) => b[0])), Math.min(...all.map((b) => b[1])), Math.min(...all.map((b) => b[2])) + base, Math.max(...all.map((b) => b[3])), Math.max(...all.map((b) => b[4])), Math.max(...all.map((b) => b[5])) + base]
    : [-0.5, -0.5, 0, 0.5, 0.5, 1];
  if (!e.pared) box[2] = 0;
  return { kit: s, box };
}

const shade3 = (c, k) => c.map((v) => clamp(Math.round(v * k), 0, 255));
/** 1.101 · Las habitaciones: el marco del paso, tabiques, el frente de cada habitación, sus lámparas y el escenario del rincón. */
function buildHabitaciones() {
  const s = kit();
  // El paso en la pared derecha, con su marco de acero por los dos lados
  for (const [x0, x1] of [
    [AW - 0.14, AW + 0.14],
  ]) {
    pushBox(s, [x0, PASO.y0 - 0.14, 0, x1, PASO.y0, PASO.alto + 0.14], STEEL);
    pushBox(s, [x0, PASO.y1, 0, x1, PASO.y1 + 0.14, PASO.alto + 0.14], STEEL);
    pushBox(s, [x0, PASO.y0 - 0.14, PASO.alto, x1, PASO.y1 + 0.14, PASO.alto + 0.14], STEEL);
    pushBox(s, [x0 - 0.02, PASO.y0, 0, x1 + 0.02, PASO.y1, 0.03], BRASS);
  }
  // Frente al paso, en la pared del este: un letrero verde con marco de latón y tres dibujos (sillón, escritorio y capa)
  {
    const X = HAB.x1 - 0.06;
    const y0 = 1.9;
    const y1 = 4.9;
    pushBox(s, [X - 0.06, y0 - 0.08, 1.7, X, y1 + 0.08, 3.5], BRASS);
    pushBox(s, [X - 0.1, y0, 1.78, X - 0.06, y1, 3.42], TEAL);
    pushBox(s, [X - 0.12, y0 + 0.1, 3.12, X - 0.1, y1 - 0.1, 3.3], PAPER);
    pushBox(s, [X - 0.13, y0 + 0.3, 3.18, X - 0.12, y1 - 0.3, 3.24], STEEL_D);
    const icono = (yc, partes) => partes.forEach(([a, z0, b, z1, c]) => pushBox(s, [X - 0.14, yc + a, z0, X - 0.1, yc + b, z1], c));
    icono(2.5, [[-0.35, 2.0, 0.35, 2.25, [184, 98, 70]], [-0.35, 2.25, -0.2, 2.6, [184, 98, 70]], [0.2, 2.25, 0.35, 2.6, [184, 98, 70]], [-0.2, 2.25, 0.2, 2.8, [150, 76, 54]]]);
    icono(3.4, [[-0.38, 2.45, 0.38, 2.55, OAK], [-0.34, 2.0, -0.26, 2.45, OAK], [0.26, 2.0, 0.34, 2.45, OAK], [-0.1, 2.55, 0.14, 2.85, [86, 112, 142]]]);
    icono(4.3, [[-0.3, 2.0, 0.3, 2.65, [176, 44, 48]], [-0.18, 2.65, 0.18, 2.75, [176, 44, 48]], [-0.12, 2.75, 0.12, 2.95, PAPER], [-0.13, 2.82, 0.13, 2.87, [36, 32, 42]]]);
  }
  // Rodapié de la sala
  pushBox(s, [HAB.x0, HAB.y0, 0, HAB.x1, HAB.y0 + 0.06, 0.12], STEEL_D);
  pushBox(s, [HAB.x0, HAB.y1 - 0.06, 0, HAB.x1, HAB.y1, 0.12], STEEL_D);
  pushBox(s, [HAB.x1 - 0.06, HAB.y0, 0, HAB.x1, HAB.y1, 0.12], STEEL_D);
  // Cerchas, como en la nave
  for (const y of [4.6, 10.2]) {
    pushBox(s, [HAB.x0, y - 0.1, AH - 0.32, HAB.x1, y + 0.1, AH - 0.08], STEEL_D);
    pushBox(s, [HAB.x0, y - 0.06, AH - 1.0, HAB.x1, y + 0.06, AH - 0.92], STEEL);
    for (let x = HAB.x0 + 0.6; x < HAB.x1; x += 1.5) pushBox(s, [x - 0.04, y - 0.04, AH - 0.92, x + 0.04, y + 0.04, AH - 0.32], STEEL);
  }
  // Las campanas del pasillo 4
  for (const [x, y] of [
    [23.5, 6.8],
    [23.5, 12.4],
  ]) {
    pushBox(s, [x - 0.02, y - 0.02, 4.6, x + 0.02, y + 0.02, AH - 0.32], STEEL_D);
    pushBox(s, [x - 0.12, y - 0.12, 4.5, x + 0.12, y + 0.12, 4.6], TEAL_D);
    pushBox(s, [x - 0.34, y - 0.34, 4.3, x + 0.34, y + 0.34, 4.5], TEAL);
    pushBox(s, [x - 0.26, y - 0.26, 4.25, x + 0.26, y + 0.26, 4.3], LAMP, { glow: true });
  }
  for (const h of HABITACIONES) {
    const papel = h.papel;
    const trim = h.heroes ? [176, 44, 48] : OAK;
    // Los tabiques: el del lado del paso (y0) en todas; el del fondo (y1) solo si no es la pared de la sala
    const friso = h.heroes ? [28, 32, 62] : [150, 112, 74];
    const tabique = (y) => {
      pushBox(s, [h.x0, y - 0.1, 0, h.x1, y + 0.1, h.alto], papel);
      pushBox(s, [h.x0, y - 0.115, 0, h.x1, y + 0.115, 1.05], friso);
      pushBox(s, [h.x0, y - 0.13, 1.05, h.x1, y + 0.13, 1.12], h.heroes ? BRASS : OAK);
      pushBox(s, [h.x0, y - 0.125, 0, h.x1, y + 0.125, 0.14], shade3(friso, 0.7));
      // Las cuarterones del friso
      for (let x = h.x0 + 0.3; x + 0.7 < h.x1; x += 0.95) for (const dy of [-0.12, 0.12]) pushBox(s, [x, y + dy - 0.01, 0.3, x + 0.7, y + dy + 0.01, 0.9], shade3(friso, 1.12));
      pushBox(s, [h.x0, y - 0.13, h.alto, h.x1, y + 0.13, h.alto + 0.08], trim);
      if (h.heroes) pushBox(s, [h.x0, y - 0.105, 1.9, h.x1, y + 0.105, 2.02], [176, 44, 48]);
    };
    tabique(h.y0);
    if (h.y1 < HAB.y1 - 0.2) tabique(h.y1);
    // El frente, abierto al pasillo: dos postes y un dintel con su remate
    const xf = h.x0 === AW ? h.x1 : h.x0;
    for (const y of [h.y0, h.y1]) pushBox(s, [xf - 0.09, y - 0.09, 0, xf + 0.09, y + 0.09, h.alto], trim);
    pushBox(s, [xf - 0.1, h.y0, h.alto - 0.34, xf + 0.1, h.y1, h.alto], trim);
    pushBox(s, [xf - 0.12, h.y0, h.alto - 0.38, xf + 0.12, h.y1, h.alto - 0.34], h.heroes ? BRASS : [142, 106, 69]);
    // La lámpara de cada habitación: colgante en las normales; en la de superhéroes, un carril con dos focos
    const cx = (h.x0 + h.x1) / 2;
    const cy = h.heroes ? 9.6 : (h.y0 + h.y1) / 2;
    if (h.heroes) {
      pushBox(s, [cx - 0.03, h.y0 + 1.2, 3.9, cx + 0.03, h.y1 - 3.6, 3.96], STEEL_D);
      pushBox(s, [cx - 0.02, cy - 0.02, 3.96, cx + 0.02, cy + 0.02, AH - 0.32], STEEL_D);
      for (const y of [cy - 1.6, cy + 1.6]) {
        pushBox(s, [cx - 0.12, y - 0.12, 3.62, cx + 0.12, y + 0.12, 3.9], STEEL_D);
        pushBox(s, [cx - 0.09, y - 0.09, 3.58, cx + 0.09, y + 0.09, 3.62], LAMP, { glow: true });
      }
    } else {
      pushBox(s, [cx - 0.02, cy - 0.02, 3.4, cx + 0.02, cy + 0.02, AH - 0.32], STEEL_D);
      pushBox(s, [cx - 0.24, cy - 0.24, 3.16, cx + 0.24, cy + 0.24, 3.4], h.id === 'hab-estudio' ? [86, 112, 142] : [204, 158, 70]);
      pushBox(s, [cx - 0.18, cy - 0.18, 3.12, cx + 0.18, cy + 0.18, 3.16], LAMP, { glow: true });
    }
  }
  // El rincón especial: un escenario redondo (por franjas), con su filo dorado y dos escalones
  const { x, y, r } = RINCON;
  for (let dy = -r; dy < r; dy += 0.125) {
    const m = dy + 0.0625;
    const wTop = Math.sqrt(Math.max(0, r * r - m * m));
    const wBase = Math.sqrt(Math.max(0, (r + 0.08) ** 2 - m * m));
    pushBox(s, [x - wBase, y + dy, 0, x + wBase, y + dy + 0.125, 0.06], BRASS);
    pushBox(s, [x - wTop, y + dy, 0.06, x + wTop, y + dy + 0.125, 0.16], [120, 30, 36]);
  }
  pushBox(s, [x - 1.75, y - 0.4, 0, x - r + 0.1, y + 0.4, 0.08], [120, 30, 36]);
  pushBox(s, [x - 1.78, y - 0.42, 0.08, x - 1.5, y + 0.42, 0.1], BRASS);
  buildProbador(s);
  return s;
}

/** Hondo del marco del espejo: dentro cabe el reflejo de tu personaje, detrás del cristal. */
const ESPEJO_HONDO = 0.78;
/**
 * 1.102 · El probador: el espejo grande de pie contra la pared (marco de latón hondo, copete y dos apliques), la alfombra
 * redonda y el puf delante; y dos cabinas de roble con su cortina corrida a medias, la barra y una percha dentro.
 */
function buildProbador(s) {
  const { espejo: m, cabinas, fondo } = PROBADOR;
  const y0 = HAB.y0;
  const yf = y0 + ESPEJO_HONDO;
  const MARCO = [196, 146, 64];
  // El fondo del espejo: azogue claro, con un degradado de arriba abajo en franjas
  for (let z = m.z0, k = 0; z < m.z1 - 0.01; z += 0.25, k++) pushBox(s, [m.x0, y0 + 0.02, z, m.x1, y0 + 0.06, Math.min(m.z1, z + 0.25)], [176 + k * 3, 196 + k * 2, 204 + k], { glow: true });
  // Dentro del marco, todo es azogue (lados, techo y el suelo reflejado, con las baldosas del pasillo en frío): así el
  // hondo no se lee como una cabina sino como el otro lado del espejo
  pushBox(s, [m.x0, y0, 0, m.x1, yf, m.z0], [120, 128, 140], { glow: true });
  for (let x = m.x0 + 0.3; x < m.x1; x += 0.6) pushBox(s, [x, y0, m.z0, x + 0.02, yf, m.z0 + 0.005], [104, 112, 124], { glow: true });
  pushBox(s, [m.x0 - 0.16, y0, 0, m.x0, yf, m.z1 + 0.16], [156, 176, 186], { glow: true });
  pushBox(s, [m.x1, y0, 0, m.x1 + 0.16, yf, m.z1 + 0.16], [146, 166, 178], { glow: true });
  pushBox(s, [m.x0 - 0.16, y0, m.z1, m.x1 + 0.16, yf, m.z1 + 0.16], [166, 186, 196], { glow: true });
  // El marco, solo por delante: grueso, de latón viejo, con la moldura clara encima
  pushBox(s, [m.x0 - 0.3, yf - 0.1, 0, m.x0, yf, m.z1 + 0.3], MARCO);
  pushBox(s, [m.x1, yf - 0.1, 0, m.x1 + 0.3, yf, m.z1 + 0.3], MARCO);
  pushBox(s, [m.x0 - 0.3, yf - 0.1, m.z1, m.x1 + 0.3, yf, m.z1 + 0.3], MARCO);
  pushBox(s, [m.x0 - 0.3, yf - 0.1, 0, m.x1 + 0.3, yf, m.z0], MARCO);
  pushBox(s, [m.x0 - 0.36, y0, 0, m.x0 - 0.16, yf - 0.1, m.z1 + 0.36], [150, 108, 48]);
  pushBox(s, [m.x1 + 0.16, y0, 0, m.x1 + 0.36, yf - 0.1, m.z1 + 0.36], [150, 108, 48]);
  pushBox(s, [m.x0 - 0.36, y0, m.z1 + 0.16, m.x1 + 0.36, yf - 0.1, m.z1 + 0.36], [150, 108, 48]);
  // Moldura del frente, más clara, y el copete con su óvalo
  for (const [a, b, c, d] of [
    [m.x0 - 0.2, m.x0 - 0.12, m.z0, m.z1 + 0.2],
    [m.x1 + 0.12, m.x1 + 0.2, m.z0, m.z1 + 0.2],
    [m.x0 - 0.2, m.x1 + 0.2, m.z1 + 0.12, m.z1 + 0.2],
  ])
    pushBox(s, [a, yf, c, b, yf + 0.04, d], BRASS);
  const cx = (m.x0 + m.x1) / 2;
  pushBox(s, [cx - 0.55, yf - 0.1, m.z1 + 0.3, cx + 0.55, yf, m.z1 + 0.44], MARCO);
  pushBox(s, [cx - 0.24, yf - 0.1, m.z1 + 0.44, cx + 0.24, yf, m.z1 + 0.66], MARCO);
  pushBox(s, [cx - 0.13, yf, m.z1 + 0.48, cx + 0.13, yf + 0.03, m.z1 + 0.62], [150, 44, 52]);
  // Las patas del espejo de pie
  for (const x of [m.x0 - 0.3, m.x1 + 0.12]) pushBox(s, [x, yf, 0, x + 0.18, yf + 0.24, 0.12], MARCO);
  // Dos apliques encima, a los lados del copete
  for (const x of [m.x0 + 0.1, m.x1 - 0.1]) {
    pushBox(s, [x - 0.03, y0 + 0.02, m.z1 + 0.5, x + 0.03, y0 + 0.24, m.z1 + 0.56], BRASS);
    pushBox(s, [x - 0.1, y0 + 0.2, m.z1 + 0.5, x + 0.1, y0 + 0.4, m.z1 + 0.64], LAMP, { glow: true });
  }
  // La alfombra redonda y el puf, delante del espejo
  const ry = yf + 1.0;
  for (let dy = -0.85; dy < 0.85; dy += 0.1) {
    const w = Math.sqrt(Math.max(0, 0.85 * 0.85 - (dy + 0.05) ** 2));
    pushBox(s, [cx - w, ry + dy, 0, cx + w, ry + dy + 0.1, 0.02], Math.abs(dy + 0.05) > 0.62 || w < 0.2 ? [150, 44, 52] : [214, 186, 150]);
  }
  pushBox(s, [m.x1 + 0.5, yf + 0.25, 0, m.x1 + 1.0, yf + 0.75, 0.42], [86, 112, 142]);
  pushBox(s, [m.x1 + 0.48, yf + 0.23, 0.36, m.x1 + 1.02, yf + 0.77, 0.46], [104, 132, 162]);
  // Las cabinas: tabiques de roble, techo con friso, barra de latón y la cortina en pliegues, corrida a medias
  const CORTINAS = [
    [150, 44, 52],
    [40, 100, 96],
  ];
  const yc = y0 + fondo;
  const alto = 2.35;
  // Los tabiques, con zócalo, dos cuarterones por cara y un remate redondeado en el canto de delante
  for (const [x0, x1] of cabinas)
    for (const x of [x0, x1]) {
      pushBox(s, [x - 0.06, y0, 0, x + 0.06, yc, alto], OAK);
      pushBox(s, [x - 0.07, y0, 0, x + 0.07, yc + 0.02, 0.16], [120, 84, 52]);
      for (const [a, b] of [
        [0.3, 1.05],
        [1.2, 2.1],
      ])
        for (const d of [-0.075, 0.065]) pushBox(s, [x + d, y0 + 0.2, a, x + d + 0.01, yc - 0.2, b], [150, 108, 68]);
      pushBox(s, [x - 0.09, yc - 0.06, 0, x + 0.09, yc + 0.06, alto + 0.04], [142, 106, 69]);
    }
  cabinas.forEach(([x0, x1], k) => {
    pushBox(s, [x0 - 0.08, y0, alto, x1 + 0.08, yc + 0.06, alto + 0.12], [142, 106, 69]);
    pushBox(s, [x0 - 0.1, yc - 0.02, alto + 0.12, x1 + 0.1, yc + 0.08, alto + 0.22], BRASS);
    // Dentro: el fondo, un banco y una percha con una prenda colgada
    pushBox(s, [x0 + 0.06, y0 + 0.02, 0, x1 - 0.06, y0 + 0.06, alto], [222, 206, 170]);
    pushBox(s, [x0 + 0.2, y0 + 0.06, 0.38, x1 - 0.2, y0 + 0.5, 0.46], OAK);
    pushBox(s, [x0 + 0.2, y0 + 0.06, 0, x0 + 0.28, y0 + 0.5, 0.38], OAK);
    pushBox(s, [x1 - 0.28, y0 + 0.06, 0, x1 - 0.2, y0 + 0.5, 0.38], OAK);
    const hx = (x0 + x1) / 2;
    pushBox(s, [hx - 0.03, y0 + 0.06, 1.95, hx + 0.03, y0 + 0.12, 2.02], BRASS);
    pushBox(s, [hx - 0.3, y0 + 0.08, 1.86, hx + 0.3, y0 + 0.14, 1.92], BRASS);
    pushBox(s, [hx - 0.28, y0 + 0.1, 1.2, hx + 0.28, y0 + 0.2, 1.86], k ? [204, 158, 70] : [86, 112, 142]);
    // La barra y la cortina, que tapa la mitad de la boca
    pushBox(s, [x0 + 0.04, yc - 0.06, 2.22, x1 - 0.04, yc - 0.02, 2.26], BRASS);
    const tela = CORTINAS[k];
    const ancho = (x1 - x0) * 0.58;
    const de = k ? x1 - ancho : x0;
    for (let x = de, j = 0; x < de + ancho - 0.01; x += 0.12, j++) pushBox(s, [x, yc - 0.12 + (j % 2) * 0.04, 0.08, Math.min(de + ancho, x + 0.12), yc - 0.04 + (j % 2) * 0.04, 2.22], shade3(tela, j % 2 ? 0.82 : 1.06));
    pushBox(s, [de, yc - 0.13, 1.0, de + ancho, yc - 0.0, 1.08], BRASS);
  });
  // El letrero de esmalte encima de las cabinas: una percha
  const lx = (cabinas[0][0] + cabinas[1][1]) / 2;
  pushBox(s, [lx - 0.62, yc + 0.06, alto + 0.24, lx + 0.62, yc + 0.12, alto + 0.74], BRASS);
  pushBox(s, [lx - 0.56, yc + 0.12, alto + 0.3, lx + 0.56, yc + 0.14, alto + 0.68], TEAL);
  for (const [a, b, c, d] of [
    [-0.03, 0.03, 0.58, 0.64],
    [-0.3, 0.3, 0.36, 0.4],
    [-0.3, -0.03, 0.4, 0.46],
    [0.03, 0.3, 0.4, 0.46],
    [-0.06, 0.06, 0.52, 0.58],
  ])
    pushBox(s, [lx + a, yc + 0.14, alto + c, lx + b, yc + 0.16, alto + d], PAPER);
}

/** El personaje de quien te acompaña y su carretilla, en coordenadas propias (mira hacia +y). */
function peerKit(avatar, { carretilla = true, g: luz = 0.55 } = {}) {
  const s = kit();
  let boxes = [];
  try {
    boxes = actorBoxes(avatar ?? DEFAULT_AVATAR, { pose: 'stand', x: 0, y: 0, facing: 0 });
  } catch {
    boxes = actorBoxes(DEFAULT_AVATAR, { pose: 'stand', x: 0, y: 0, facing: 0 });
  }
  // `actorBoxes` deja al personaje en una casilla que empieza en (x, y): se centra en su planta
  const all = boxes.map((b) => b.b);
  const cx = (Math.min(...all.map((b) => b[0])) + Math.max(...all.map((b) => b[3]))) / 2;
  const cy = (Math.min(...all.map((b) => b[1])) + Math.max(...all.map((b) => b[4]))) / 2;
  for (const bx of boxes) pushBox(s, [bx.b[0] - cx, bx.b[1] - cy, bx.b[2], bx.b[3] - cx, bx.b[4] - cy, bx.b[5]], bx.c, { g: luz });
  if (!carretilla) return s;
  // La carretilla, delante y a un lado: plataforma, asa y dos paquetes que no dicen qué son
  const g = 0.5;
  pushBox(s, [0.35, 0.3, 0.12, 1.05, 1.2, 0.2], TEAL, { g });
  pushBox(s, [0.35, 0.3, 0.2, 0.42, 0.37, 1.0], STEEL, { g });
  pushBox(s, [0.98, 0.3, 0.2, 1.05, 0.37, 1.0], STEEL, { g });
  pushBox(s, [0.35, 0.3, 0.95, 1.05, 0.37, 1.02], BRASS, { g });
  for (const [x, y] of [
    [0.4, 1.12],
    [1.0, 1.12],
  ])
    pushBox(s, [x - 0.05, y - 0.05, 0, x + 0.05, y + 0.05, 0.12], STEEL_D, { g });
  pushBox(s, [0.45, 0.5, 0.2, 0.95, 1.1, 0.34], CARTON, { g });
  pushBox(s, [0.5, 0.55, 0.34, 0.9, 1.0, 0.44], [176, 132, 86], { g });
  return s;
}

/** 1.101 · ¿Está al otro lado de la pared derecha, en las habitaciones? Un expositor, por dónde mira su frente. */
const alla = (x) => x >= AW;
const ladoDe = (e) => alla(e.x + e.n[0] * 0.05);

/** Zonas de carga: su centro (para saber si se está cerca) y lo que se monta al llegar. */
const ZONAS = {
  isla: [7.6, 12.6],
  muro: [13.1, 12.6],
  derecha: [AW, 13.2],
  ambientes: [1.5, 12.7],
  fondo: [8, 1.2],
  habitaciones: [23.5, 10],
};
/** Lo que se toca y no es un mueble: la caja, el directorio y el muelle (mercadillo). */
export const SITIOS = {
  caja: { box: [CAJA.x0, CAJA.y0 - 0.1, 0, CAJA.x1, CAJA.cajero[1] + 0.5, 2.3], tag: [4.4, 22.4, 3.3] },
  directorio: { box: [DIRECTORIO.x - 0.2, DIRECTORIO.y - 0.85, 0, DIRECTORIO.x + 0.2, DIRECTORIO.y + 0.85, 2.8], tag: [DIRECTORIO.x, DIRECTORIO.y, 2.85] },
  mercadillo: { box: [MUELLE.x0, 0, 0, MUELLE.x1, 0.4, MUELLE.alto], tag: [(MUELLE.x0 + MUELLE.x1) / 2, 0.2, MUELLE.alto + 0.7] },
  // 1.102 · El probador: el espejo y las dos cabinas
  probador: { box: [PROBADOR.espejo.x0 - 0.25, HAB.y0, 0, PROBADOR.cabinas[1][1] + 0.1, HAB.y0 + PROBADOR.fondo, 3.2], tag: [(PROBADOR.espejo.x0 + PROBADOR.espejo.x1) / 2, HAB.y0 + 1.1, 3.0] },
};
/** Los carteles colgados de los pasillos (solo dicen dónde se está). */
export const CARTELES = {
  'c:lectura': [4.2, 12.6, 4.05],
  'c:salon': [11, 9.4, 4.05],
  'c:ambientes': [1.6, 12.6, 4.05],
  'c:paredes': [(MURO.x0 + MURO.x1) / 2, 12.6, MURO.alto + 0.45],
  'c:autoservicio': [8, 1.2, 5.2],
  'c:habitaciones': [AW - 0.3, (PASO.y0 + PASO.y1) / 2, PASO.alto + 0.5],
  'c:heroes': [24.8, 10.5, 4.1],
};

export function mountAlmacen(container, { onPick = () => {}, onFrame = () => {}, onLost = () => {}, onSettle = () => {}, onMove = () => {} } = {}) {
  const renderer = new WebGLRenderer({ antialias: false, powerPreference: 'low-power', preserveDrawingBuffer: true });
  const canvas = renderer.domElement;
  canvas.className = 'alm-canvas';
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'El Almacén del Puerto. Arrastra o usa las flechas para mirar; toca el suelo para andar y un mueble para verlo.');
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x16142a);

  const scene = new Scene();
  const camera = new PerspectiveCamera(70, 1, 0.08, 70);
  const owned = [];
  const own = (x) => (owned.push(x), x);
  const flat = own(new MeshBasicMaterial({ vertexColors: true }));
  const hidden = own(new MeshBasicMaterial({ visible: false }));
  const plane = (w, h, tex, place, cut = false) => {
    const mesh = new Mesh(own(new PlaneGeometry(w, h)), own(new MeshBasicMaterial({ map: own(texture(tex)), alphaTest: cut ? 0.5 : 0 })));
    place(mesh);
    scene.add(mesh);
    return mesh;
  };
  const r = probe();
  const teal = r.rampOf(TEAL);
  const brass = r.rampOf(BRASS);
  const steel = r.rampOf(STEEL);

  // ── La nave: suelo, techo y las cuatro paredes ──
  plane(AW, AD, paintFloor(), (m) => {
    m.rotation.x = -Math.PI / 2;
    m.position.set(AW / 2, 0, AD / 2);
  });
  plane(AW, AD, paintCeiling(), (m) => {
    m.rotation.x = Math.PI / 2;
    m.position.set(AW / 2, AH, AD / 2);
  });
  // Fondo (y = 0): el muelle de carga, con su persiana verde
  plane(
    AW,
    AH,
    paintWall(
      AW,
      (a, b) => [a, 0.05, b],
      (a, b, ix, iy) => {
        if (a < MUELLE.x0 || a > MUELLE.x1 || b > MUELLE.alto) return null;
        const slat = (b * 7) % 1 < 0.18;
        return lit(slat ? teal[1] : teal[b < 0.4 ? 1 : 3], glowAt(a, 0.3, b), ix, iy);
      },
    ),
    (m) => m.position.set(AW / 2, AH / 2, 0),
  );
  // Izquierda (x = 0): el papel pintado de los ambientes montados
  plane(
    AD,
    AH,
    paintWall(
      AD,
      (a, b) => [0.05, AD - a, b],
      (a, b, ix, iy) => {
        const y = AD - a;
        const amb = AMBIENTES.find((x) => y > x.y0 && y < x.y1);
        if (!amb || b > 3.4) return null;
        const ramp = r.rampOf(amb.id === 'amb-lectura' ? [96, 124, 112] : [222, 196, 160]);
        if (b < 0.5) return lit(r.rampOf(OAK)[b > 0.44 ? 4 : 2], glowAt(0.3, y, b), ix, iy);
        const stripe = amb.id === 'amb-lectura' ? (y * 3) % 1 < 0.18 : (y * 2.5) % 1 < 0.08 || ((y * 2.5 + 0.5) % 1 < 0.04 && (b * 3) % 1 < 0.5);
        return lit(ramp[stripe ? 2 : 3], glowAt(0.3, y, b), ix, iy);
      },
    ),
    (m) => {
      m.rotation.y = Math.PI / 2;
      m.position.set(0, AH / 2, AD / 2);
    },
  );
  plane(
    AD,
    AH,
    paintWall(
      AD,
      (a, b) => [AW - 0.05, a, b],
      (a, b) => (a > PASO.y0 && a < PASO.y1 && b < PASO.alto ? 0 : null),
    ),
    (m) => {
      m.rotation.y = -Math.PI / 2;
      m.position.set(AW, AH / 2, AD / 2);
    },
    true,
  );
  // ── 1.101 · La sala de las habitaciones, al otro lado del paso: suelo, techo y sus cuatro paredes ──
  {
    const W = HAB.x1 - HAB.x0;
    const D = HAB.y1 - HAB.y0;
    const cx = (HAB.x0 + HAB.x1) / 2;
    const cy = (HAB.y0 + HAB.y1) / 2;
    const habDe = (x, y, b) => HABITACIONES.find((h) => x > h.x0 - 0.05 && x < h.x1 + 0.05 && y > h.y0 - 0.05 && y < h.y1 + 0.05 && b < h.alto);
    plane(W, D, paintFloor(HAB.x0, HAB.y0, W, D), (m) => {
      m.rotation.x = -Math.PI / 2;
      m.position.set(cx, 0, cy);
    });
    plane(W, D, paintCeiling(HAB.x0, HAB.y0, W, D), (m) => {
      m.rotation.x = Math.PI / 2;
      m.position.set(cx, AH, cy);
    });
    // Oeste (x = AW, mira a +x): el paso y el papel del estudio y de la salita
    plane(
      D,
      AH,
      paintWall(
        D,
        (a, b) => [AW + 0.05, HAB.y1 - a, b],
        (a, b, ix, iy) => {
          const y = HAB.y1 - a;
          if (y > PASO.y0 && y < PASO.y1 && b < PASO.alto) return 0;
          const h = habDe(AW + 0.1, y, b);
          return h ? lit(papelHab(r, h, y, b), glowAt(AW + 0.3, y, b), ix, iy) : null;
        },
      ),
      (m) => {
        m.rotation.y = Math.PI / 2;
        m.position.set(AW + 0.001, AH / 2, cy);
      },
      true,
    );
    // Este (x = HAB.x1, mira a −x): el papel de la de superhéroes y el mural del rincón especial
    plane(
      D,
      AH,
      paintWall(
        D,
        (a, b) => [HAB.x1 - 0.05, HAB.y0 + a, b],
        (a, b, ix, iy) => {
          const y = HAB.y0 + a;
          const m = muralAt(r, y, b);
          if (m) return m.glow ? rgb(...m.c) : lit(m.c, glowAt(HAB.x1 - 0.3, y, b), ix, iy);
          const h = habDe(HAB.x1 - 0.1, y, b);
          return h ? lit(papelHab(r, h, y, b), glowAt(HAB.x1 - 0.3, y, b), ix, iy) : null;
        },
      ),
      (m) => {
        m.rotation.y = -Math.PI / 2;
        m.position.set(HAB.x1, AH / 2, cy);
      },
    );
    // Norte (y = HAB.y0, mira a +y)
    plane(W, AH, paintWall(W, (a, b) => [HAB.x0 + a, HAB.y0 + 0.05, b]), (m) => m.position.set(cx, AH / 2, HAB.y0));
    // Sur (y = HAB.y1, mira a −y): el papel de la salita y de la de superhéroes
    plane(
      W,
      AH,
      paintWall(
        W,
        (a, b) => [HAB.x1 - a, HAB.y1 - 0.05, b],
        (a, b, ix, iy) => {
          const x = HAB.x1 - a;
          const h = habDe(x, HAB.y1 - 0.1, b);
          return h ? lit(papelHab(r, h, x, b), glowAt(x, HAB.y1 - 0.3, b), ix, iy) : null;
        },
      ),
      (m) => {
        m.rotation.y = Math.PI;
        m.position.set(cx, AH / 2, HAB.y1);
      },
    );
    scene.add(new Mesh(own(geometryOf(buildHabitaciones())), flat));
  }
  // Delante (y = AD): la puerta de cristal y, tras la caja, el escudo de la casa
  plane(
    AW,
    AH,
    paintWall(
      AW,
      (a, b) => [AW - a, AD - 0.05, b],
      (a, b, ix, iy) => {
        const x = AW - a;
        if (x > PUERTA.x0 && x < PUERTA.x1 && b < PUERTA.alto) {
          const mid = (PUERTA.x0 + PUERTA.x1) / 2;
          if (Math.abs(x - mid) < 0.05 || Math.abs(b - 1.05) < 0.04) return steel[1];
          return nightSky((x - PUERTA.x0) / (PUERTA.x1 - PUERTA.x0), b / 3 + 0.2, 11);
        }
        const e = emblem(x, b, 4.2, 3.2, 0.95, teal, brass);
        return e == null ? null : lit(e, glowAt(x, AD - 0.3, b), ix, iy);
      },
    ),
    (m) => {
      m.rotation.y = Math.PI;
      m.position.set(AW / 2, AH / 2, AD);
    },
  );
  scene.add(new Mesh(own(geometryOf(buildShell())), flat));
  scene.add(new Mesh(own(geometryOf(buildCaja())), flat));
  scene.add(new Mesh(own(geometryOf(buildDirectorio())), flat));

  // ── El mostrador del albarán: la cinta de la caja, un carril con el sello colgado, los planos y la tinta ──
  const BELT = { x0: CAJA.x0 + 0.2, x1: CAJA.x0 + 2.65, y: (CAJA.y0 + CAJA.y1) / 2, z: 1.15 };
  // La cinta corre de izquierda a derecha en pantalla: desde aquí, la x grande queda a la izquierda
  const beltX = (u) => BELT.x1 - u * (BELT.x1 - BELT.x0);
  const mostrador = new Group();
  mostrador.visible = false;
  scene.add(mostrador);
  {
    const k = kit();
    const g = glowAt(BELT.x0, BELT.y, 1.4);
    for (const x of [BELT.x0 - 0.14, BELT.x1 + 0.14]) {
      pushBox(k, [x - 0.04, BELT.y - 0.04, 1.08, x + 0.04, BELT.y + 0.04, 1.82], BRASS, { g });
      pushBox(k, [x - 0.07, BELT.y - 0.07, 1.08, x + 0.07, BELT.y + 0.07, 1.12], STEEL_D, { g });
    }
    pushBox(k, [BELT.x0 - 0.18, BELT.y - 0.035, 1.76, BELT.x1 + 0.18, BELT.y + 0.035, 1.82], BRASS, { g });
    mostrador.add(new Mesh(own(geometryOf(k)), flat));
  }
  // El sello: carro en el carril, varilla, mango de madera, base y goma roja (se mueve entero; baja al sellar)
  const sello = new Group();
  {
    const k = kit();
    const g = glowAt(BELT.x0 + 1, BELT.y, 1.4);
    pushBox(k, [-0.07, -0.06, 1.72, 0.07, 0.06, 1.84], STEEL, { g });
    pushBox(k, [-0.015, -0.015, 1.5, 0.015, 0.015, 1.72], STEEL_D, { g });
    pushBox(k, [-0.05, -0.05, 1.38, 0.05, 0.05, 1.52], OAK, { g });
    pushBox(k, [-0.11, -0.09, 1.31, 0.11, 0.09, 1.38], [150, 142, 128], { g });
    pushBox(k, [-0.1, -0.08, 1.27, 0.1, 0.08, 1.31], [176, 52, 62], { g });
    sello.add(new Mesh(own(geometryOf(k)), flat));
  }
  mostrador.add(sello);
  const pequeno = (w, h, paint) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    paint(c.getContext('2d'), w, h);
    return c;
  };
  const tex = (c) => own(texture(c));
  // La marca: una cruz roja pintada en la cinta, bajo el sello
  const marcaMesh = new Mesh(
    own(new PlaneGeometry(0.2, 0.72)),
    own(
      new MeshBasicMaterial({
        transparent: true,
        alphaTest: 0.3,
        map: tex(
          pequeno(9, 33, (c) => {
            // Una raya roja a lo ancho de la cinta, con un triángulo en cada borde: se ve aunque el plano la tape
            c.fillStyle = '#e8505c';
            c.fillRect(4, 0, 1, 33);
            for (let i = 0; i < 4; i += 1) {
              c.fillRect(4 - i, i, 1 + i * 2, 1);
              c.fillRect(4 - i, 32 - i, 1 + i * 2, 1);
            }
          }),
        ),
      }),
    ),
  );
  marcaMesh.rotation.x = -Math.PI / 2;
  mostrador.add(marcaMesh);
  // Los planos: hoja azul con cuadrícula, casilla del sello en el centro y el dibujo del mueble en una esquina
  function pintarPlano(c, w, h, img) {
    c.fillStyle = '#2f5e8a';
    c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(255,255,255,0.18)';
    for (let x = 3; x < w; x += 6) c.fillRect(x, 0, 1, h);
    for (let y = 3; y < h; y += 6) c.fillRect(0, y, w, 1);
    c.fillStyle = '#eef3f6';
    c.fillRect(0, 0, w, 2);
    c.fillRect(0, h - 2, w, 2);
    c.fillRect(0, 0, 2, h);
    c.fillRect(w - 2, 0, 2, h);
    // La casilla: un cuadrado de rayas en el centro
    const q = 16;
    const x0 = Math.round(w / 2 - q / 2);
    const y0 = Math.round(h / 2 - q / 2);
    c.fillStyle = '#f6ecd8';
    for (let i = 0; i < q; i += 4) {
      c.fillRect(x0 + i, y0, 2, 1);
      c.fillRect(x0 + i, y0 + q - 1, 2, 1);
      c.fillRect(x0, y0 + i, 1, 2);
      c.fillRect(x0 + q - 1, y0 + i, 1, 2);
    }
    if (img) {
      const t = pequeno(14, 14, (d) => d.drawImage(img, 0, 0, 14, 14));
      const data = t.getContext('2d').getImageData(0, 0, 14, 14);
      for (let i = 0; i < data.data.length; i += 4) {
        const a = data.data[i + 3];
        data.data[i] = 214;
        data.data[i + 1] = 232;
        data.data[i + 2] = 248;
        data.data[i + 3] = a > 40 ? 220 : 0;
      }
      t.getContext('2d').putImageData(data, 0, 0);
      c.drawImage(t, 4, h - 18);
    }
  }
  const PW = 0.46;
  const PH = 0.38;
  const planos = [0, 1, 2].map(() => {
    const canvas = pequeno(48, 40, (c, w, h) => pintarPlano(c, w, h, null));
    const map = tex(canvas);
    const mat = own(new MeshBasicMaterial({ map }));
    const mesh = new Mesh(own(new PlaneGeometry(PW, PH)), mat);
    // Tumbado sobre la cinta y girado media vuelta: así se lee derecho desde la caja
    mesh.rotation.set(-Math.PI / 2, 0, Math.PI);
    mesh.visible = false;
    mostrador.add(mesh);
    // La tinta: un círculo rojo que se queda en el plano donde cayó
    const tinta = new Mesh(
      own(new PlaneGeometry(0.17, 0.17)),
      own(
        new MeshBasicMaterial({
          transparent: true,
          alphaTest: 0.3,
          map: tex(
            pequeno(12, 12, (c) => {
              c.fillStyle = '#c43440';
              c.beginPath();
              c.arc(6, 6, 5.6, 0, Math.PI * 2);
              c.arc(6, 6, 3.4, 0, Math.PI * 2, true);
              c.fill();
              c.fillRect(5, 5, 2, 2);
            }),
          ),
        }),
      ),
    );
    tinta.position.z = 0.004;
    tinta.visible = false;
    mesh.add(tinta);
    return { mesh, canvas, map, tinta };
  });
  function dibujosDe(urls = []) {
    planos.forEach((p, j) => {
      const url = urls.length ? urls[j % urls.length] : null;
      const pinta = (img) => {
        pintarPlano(p.canvas.getContext('2d'), p.canvas.width, p.canvas.height, img);
        p.map.needsUpdate = true;
        invalidate();
      };
      if (!url) return pinta(null);
      const img = new Image();
      img.onload = () => pinta(img);
      img.src = url;
    });
  }
  let golpe = 0; // cuándo bajó el sello por última vez (performance.now)
  let selloX = beltX(0.62);
  let selloTo = selloX;
  let tapJuego = null;
  let ultimaBaja = 0;
  /** Mueve el sello por su carril y lo baja si toca; devuelve si sigue moviéndose. */
  function tickMostrador(now, dt) {
    if (!mostrador.visible) return false;
    let vivo = false;
    if (Math.abs(selloTo - selloX) > 0.002) {
      selloX = reduced() ? selloTo : lerp(selloX, selloTo, 1 - Math.exp(-dt * 10));
      vivo = true;
    } else selloX = selloTo;
    let baja = 0;
    const d = (now - golpe) / 260;
    if (golpe && d < 1 && !reduced()) {
      baja = d < 0.35 ? d / 0.35 : d < 0.55 ? 1 : 1 - (d - 0.55) / 0.45;
      vivo = true;
    }
    sello.position.set(selloX, -baja * 0.11, BELT.y);
    return vivo;
  }

  // ── El carro que llevas delante: plataforma con asa y los paquetes planos de lo que vas comprando ──
  // Va pegado a la cámara. En sus coordenadas (las de la app): x a la derecha, z arriba e y hacia ti (delante es -y).
  scene.add(camera);
  const carro = new Group();
  camera.add(carro);
  // El carro va en su propia capa y se dibuja después, encima de todo: así nunca se mete dentro de un mueble cercano
  const CAPA_CARRO = 1;
  const capaCarro = (m) => (m.layers.set(CAPA_CARRO), m);
  renderer.autoClear = false;
  const CARRO_G = 0.5;
  {
    const k = kit();
    const g = CARRO_G;
    pushBox(k, [-0.27, -0.02, 0, 0.27, 0.01, 0.025], TEAL, { g });
    pushBox(k, [-0.29, -0.03, -0.02, -0.25, 0.02, 0.04], TEAL_D, { g });
    pushBox(k, [0.25, -0.03, -0.02, 0.29, 0.02, 0.04], TEAL_D, { g });
    for (const x of [-0.26, 0.23]) pushBox(k, [x, -0.05, -0.33, x + 0.03, -0.02, -0.01], STEEL, { g });
    pushBox(k, [-0.31, -0.8, -0.37, 0.31, -0.02, -0.33], STEEL_D, { g });
    pushBox(k, [-0.3, -0.79, -0.33, 0.3, -0.03, -0.315], [126, 96, 64], { g });
    for (const x of [-0.29, 0.25])
      for (const y of [-0.74, -0.1]) {
        pushBox(k, [x, y - 0.035, -0.44, x + 0.04, y + 0.035, -0.37], [34, 32, 40], { g });
        pushBox(k, [x + 0.005, y - 0.01, -0.405, x + 0.035, y + 0.01, -0.395], STEEL, { g });
      }
    carro.add(capaCarro(new Mesh(own(geometryOf(k)), flat)));
  }
  const carroCarga = new Mesh(own(new BufferGeometry()), flat);
  carro.add(capaCarro(carroCarga));
  // Pegatinas con el dibujo del mueble, encima del paquete de arriba de cada pila
  const pegatinas = [0, 1].map(() => {
    const c = document.createElement('canvas');
    c.width = 18;
    c.height = 18;
    const map = own(texture(c));
    const m = new Mesh(own(new PlaneGeometry(0.17, 0.17)), own(new MeshBasicMaterial({ map, transparent: true, alphaTest: 0.3 })));
    m.rotation.x = -Math.PI / 2;
    m.visible = false;
    carro.add(capaCarro(m));
    return { m, c, map, url: null };
  });
  const carroPick = new Mesh(own(new BoxGeometry(0.66, 0.5, 0.86)), hidden);
  carroPick.position.set(0, -0.2, -0.4);
  carroPick.userData.id = 'carrito';
  carro.add(carroPick);
  let carroN = 0;
  function pegatina(p, url) {
    if (p.url === url) return;
    p.url = url;
    const ctx = p.c.getContext('2d');
    const pinta = (img) => {
      ctx.clearRect(0, 0, 18, 18);
      ctx.fillStyle = '#f4ecd8';
      ctx.fillRect(0, 0, 18, 18);
      ctx.fillStyle = '#c6a672';
      ctx.fillRect(0, 17, 18, 1);
      ctx.fillRect(17, 0, 1, 18);
      if (img) ctx.drawImage(img, 1, 1, 16, 16);
      p.map.needsUpdate = true;
      invalidate();
    };
    if (!url) return pinta(null);
    const img = new Image();
    img.onload = () => p.url === url && pinta(img);
    img.src = url;
  }
  /** Los paquetes del carro: una caja plana por unidad (hasta 8), en dos pilas, con el dibujo del último encima. */
  function cargarCarro(lista = []) {
    const unidades = [];
    for (const l of lista) for (let j = 0; j < l.n && unidades.length < 8; j += 1) unidades.push(l);
    const k = kit();
    const g = CARRO_G;
    const altos = [0, 0];
    const cima = [null, null];
    unidades.forEach((l, j) => {
      const pila = j % 2;
      const y0 = pila ? -0.4 : -0.76;
      const h = 0.055 + ((l.id?.length ?? 0) % 3) * 0.012;
      const z0 = -0.315 + altos[pila];
      const dx = ((j * 37) % 5) * 0.008 - 0.016;
      const tono = (j * 13) % 3;
      const carton = [CARTON[0] - tono * 8, CARTON[1] - tono * 7, CARTON[2] - tono * 6];
      pushBox(k, [-0.25 + dx, y0, z0, 0.25 + dx, y0 + 0.34, z0 + h], carton, { g });
      // Cinta de embalar y la etiqueta blanca del frente
      pushBox(k, [-0.03 + dx, y0 - 0.002, z0 + h - 0.001, 0.03 + dx, y0 + 0.342, z0 + h + 0.002], [214, 186, 132], { g });
      pushBox(k, [0.1 + dx, y0 + 0.34, z0 + 0.012, 0.21 + dx, y0 + 0.343, z0 + h - 0.012], PAPER, { g });
      altos[pila] += h;
      cima[pila] = { l, y: y0 + 0.17, z: z0 + h, dx };
    });
    carroCarga.geometry.dispose();
    carroCarga.geometry = geometryOf(k);
    pegatinas.forEach((p, i) => {
      const c = cima[i];
      p.m.visible = Boolean(c);
      if (!c) return;
      p.m.position.set(-0.13 + c.dx, c.z + 0.004, c.y);
      pegatina(p, c.l.url ?? null);
    });
    carroN = unidades.length;
    invalidate();
  }

  /** El carro, abajo en la pantalla (cuánto, según el campo de visión) y solo mientras se anda. */
  function colocarCarro() {
    const t = Math.tan((camera.fov * Math.PI) / 360);
    carro.scale.setScalar(0.8);
    carro.position.set(0, -0.64 * t * 0.6, -0.64);
  }

  // ── Zonas de carga ──
  const zonas = {};
  const pickers = [];
  function montar(z) {
    if (zonas[z]) return zonas[z];
    const group = new Group();
    const items = [];
    if (z === 'fondo') group.add(new Mesh(own(geometryOf(buildRacks())), flat));
    for (const e of EXPOSITORES.filter((x) => x.zona === z)) {
      const { kit: k, box } = itemKit(e, e.tono);
      const mesh = new Mesh(own(geometryOf(k)), flat);
      mesh.position.set(e.x, 0, e.y);
      mesh.rotation.y = Math.atan2(e.n[0], e.n[1]);
      const pick = new Mesh(own(new BoxGeometry(box[3] - box[0] + 0.1, box[5] - box[2] + 0.05, box[4] - box[1] + 0.1)), hidden);
      pick.position.set((box[0] + box[3]) / 2, (box[2] + box[5]) / 2, (box[1] + box[4]) / 2);
      pick.userData.id = `e:${e.i}`;
      mesh.add(pick);
      group.add(mesh);
      items.push({ e, mesh, pick, box, tono: e.tono });
    }
    scene.add(group);
    zonas[z] = { group, items };
    return zonas[z];
  }
  const itemOf = (i) => {
    const e = EXPOSITORES[i];
    return e ? montar(e.zona).items.find((it) => it.e.i === i) : null;
  };
  for (const [id, { box: [x0, y0, z0, x1, y1, z1] }] of Object.entries(SITIOS)) {
    const m = new Mesh(own(new BoxGeometry(x1 - x0, z1 - z0, y1 - y0)), hidden);
    m.position.set((x0 + x1) / 2, (z0 + z1) / 2, (y0 + y1) / 2);
    m.userData.id = id;
    m.userData.alla = alla(x0);
    scene.add(m);
    pickers.push(m);
  }

  // ── 1.102 · El reflejo en el espejo del probador: tu personaje, de frente, detrás del cristal ──
  const reflejo = new Group();
  reflejo.visible = false;
  scene.add(reflejo);
  let reflejoMesh = null;
  let reflejoKey = '';
  {
    // El cristal: un velo frío casi transparente con dos brillos en diagonal, delante del reflejo
    const W = 48;
    const H = 64;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(214, 232, 240, 0.16)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    for (const [x, w] of [
      [6, 7],
      [18, 3],
    ])
      for (let y = 0; y < H; y++) ctx.fillRect(x + Math.round(y * 0.45) - 14, y, w, 1);
    const tex = own(new CanvasTexture(c));
    tex.magFilter = NearestFilter;
    tex.minFilter = NearestFilter;
    tex.colorSpace = SRGBColorSpace;
    const { x0, x1, z0, z1 } = PROBADOR.espejo;
    const vidrio = new Mesh(own(new PlaneGeometry(x1 - x0, z1 - z0)), own(new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })));
    vidrio.position.set((x0 + x1) / 2, (z0 + z1) / 2, HAB.y0 + ESPEJO_HONDO - 0.01);
    scene.add(vidrio);
  }
  function vestirReflejo(avatar) {
    const key = JSON.stringify(avatar ?? null);
    if (reflejoMesh && key === reflejoKey) return;
    if (reflejoMesh) {
      reflejo.remove(reflejoMesh);
      reflejoMesh.geometry.dispose();
    }
    reflejoKey = key;
    reflejoMesh = new Mesh(geometryOf(peerKit(avatar, { carretilla: false, g: 0.4 })), flat);
    // Detrás del cristal, de frente a ti (como los demás, mira hacia +y) y un poco más pequeño que el marco
    reflejoMesh.position.set((PROBADOR.espejo.x0 + PROBADOR.espejo.x1) / 2, PROBADOR.espejo.z0, HAB.y0 + ESPEJO_HONDO / 2);
    reflejo.add(reflejoMesh);
    invalidate();
  }

  // ── Quien te acompaña ──
  const peers = new Map();
  // La marca de «Mira esto», sobre un expositor
  const markKit = kit();
  pushBox(markKit, [-0.16, -0.16, 0.28, 0.16, 0.16, 0.5], BRASS, { glow: true });
  pushBox(markKit, [-0.08, -0.08, 0.1, 0.08, 0.08, 0.28], BRASS, { glow: true });
  pushBox(markKit, [-0.03, -0.03, 0, 0.03, 0.03, 0.1], LAMP, { glow: true });
  const mark = new Mesh(own(geometryOf(markKit)), flat);
  mark.visible = false;
  scene.add(mark);

  const ray = new Raycaster();
  const floorPlane = new Plane(new Vector3(0, 1, 0), 0);
  const hit = new Vector3();

  // ── Dónde estás y hacia dónde miras ──
  let px = INICIO.x;
  let py = INICIO.y;
  let yaw = INICIO.yaw;
  let walk = null; // { pts: [[x, y]…], face: [x, y] | null, done }
  let fixed = null; // vista fija al examinar
  let seq = [];
  let step = null;
  let cur = null;
  let examining = null; // { i, back: { x, y, yaw } }
  let spin = 0;
  let detail = false;
  let raf = 0;
  let destroyed = false;
  let renders = 0;
  let lastT = 0;

  const walkView = () => ({ eye: [px, py, EYE], at: [px + Math.sin(yaw) * 6, py + Math.cos(yaw) * 6, EYE + Math.tan(PITCH) * 6], lift: 0 });
  let lift = 0;
  function setLift(v) {
    if (Math.abs(v - lift) < 1e-4) return;
    lift = v;
    const w = renderer.domElement.width;
    const h = renderer.domElement.height;
    if (lift) camera.setViewOffset(w, h, 0, lift * h, w, h);
    else camera.clearViewOffset();
  }
  const resolve = (to) => (to === 'home' ? walkView() : to);
  function next() {
    const st = seq.shift();
    step = st ? { ...st, t0: performance.now(), from: cur ?? fixed ?? walkView() } : null;
    if (!st) onSettle();
  }
  function run(steps) {
    walk = null;
    if (reduced()) {
      for (const st of steps) fixed = st.to === 'home' ? null : st.to;
      seq = [];
      step = null;
      cur = null;
      invalidate();
      onSettle();
      return;
    }
    seq = [...steps];
    next();
    invalidate();
  }

  // Montar lo cercano y esconder lo lejano (solo se ve y se toca lo montado y visible)
  function stream() {
    const keep = examining ? EXPOSITORES[examining.i]?.zona : null;
    for (const [z, [zx, zy]] of Object.entries(ZONAS)) {
      const d = Math.hypot(px - zx, py - zy);
      if (d < CERCA || z === keep) montar(z).group.visible = true;
      else if (zonas[z] && d > LEJOS) zonas[z].group.visible = false;
    }
  }

  function advance(dt) {
    if (!walk) return;
    let left = WALK * dt;
    while (left > 0 && walk.pts.length) {
      const [tx, ty] = walk.pts[0];
      const dx = tx - px;
      const dy = ty - py;
      const d = Math.hypot(dx, dy);
      if (d > 0.02) {
        const want = Math.atan2(dx, dy);
        yaw += wrapA(want - yaw) * Math.min(1, dt * 7);
      }
      if (d <= left) {
        px = tx;
        py = ty;
        left -= d;
        walk.pts.shift();
      } else {
        px += (dx / d) * left;
        py += (dy / d) * left;
        left = 0;
      }
    }
    if (!walk.pts.length) {
      if (walk.face) {
        const want = Math.atan2(walk.face[0] - px, walk.face[1] - py);
        const delta = wrapA(want - yaw);
        if (Math.abs(delta) > 0.01) {
          yaw += delta * Math.min(1, dt * 8);
          return;
        }
        yaw = want;
      }
      const done = walk.done;
      walk = null;
      stream();
      onMove({ x: px, y: py, yaw });
      done?.();
    }
  }

  function aim(now) {
    const dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0;
    lastT = now;
    advance(dt);
    let v = fixed ?? walkView();
    if (step) {
      const k = Math.min(1, (now - step.t0) / step.ms);
      const e = ease(k);
      const to = resolve(step.to);
      v = {
        eye: step.from.eye.map((a, i) => lerp(a, to.eye[i], e)),
        at: step.from.at.map((a, i) => lerp(a, to.at[i], e)),
        lift: lerp(step.from.lift ?? 0, to.lift ?? 0, e),
      };
      if (k >= 1) {
        fixed = step.to === 'home' ? null : step.to;
        cur = v;
        next();
      }
    }
    cur = v;
    carro.visible = !fixed && !examining && !mostrador.visible && (!step || step.to === 'home');
    setLift(v.lift ?? 0);
    camera.position.set(v.eye[0], v.eye[2], v.eye[1]);
    camera.lookAt(v.at[0], v.at[2], v.at[1]);
    // Quien te acompaña se acerca a donde dijo que estaba, sin saltos
    let moving = false;
    const kp = 1 - Math.exp(-dt * 5);
    for (const p of peers.values()) {
      const d = Math.hypot(p.tx - p.x, p.ty - p.y);
      if (d > 4) {
        p.x = p.tx;
        p.y = p.ty;
      } else {
        p.x = lerp(p.x, p.tx, kp);
        p.y = lerp(p.y, p.ty, kp);
      }
      p.yaw += wrapA(p.tyaw - p.yaw) * kp;
      if (d > 0.01 || Math.abs(wrapA(p.tyaw - p.yaw)) > 0.01) moving = true;
      p.mesh.position.set(p.x, 0, p.y);
      p.mesh.rotation.y = p.yaw;
    }
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
    const quiet = Boolean(examining || step);
    // 1.101 · Lo que está al otro lado de la pared derecha no se rotula: la pared lo tapa
    const aqui = alla(px);
    for (const [id, s] of Object.entries(SITIOS)) {
      const p = project(...s.tag);
      out[id] = { ...p, visible: !quiet && alla(s.tag[0]) === aqui && p.front && Math.hypot(px - s.tag[0], py - s.tag[1]) < 16 };
    }
    for (const [id, at] of Object.entries(CARTELES)) {
      const p = project(...at);
      out[id] = { ...p, visible: !quiet && alla(at[0]) === aqui && p.front && Math.hypot(px - at[0], py - at[1]) < 13 };
    }
    // Precios de lo cercano y a la vista (como mucho ETIQUETAS)
    const near = EXPOSITORES.filter((e) => zonas[e.zona]?.group.visible && ladoDe(e) === aqui)
      .map((e) => ({ e, d: Math.hypot(px - e.x, py - e.y) }))
      .filter((x) => x.d < ETIQUETA_LEJOS)
      .sort((a, b) => a.d - b.d);
    let shown = 0;
    for (const e of EXPOSITORES) out[`e:${e.i}`] = { x: 0, y: 0, visible: false };
    for (const { e } of near) {
      if (quiet || shown >= ETIQUETAS) break;
      const it = itemOf(e.i);
      const top = it.box[5] + 0.3;
      const p = project(e.x + e.n[0] * (e.pared ? 0.3 : 0), e.y + e.n[1] * (e.pared ? 0.3 : 0), top);
      if (!p.front) continue;
      // Que se vea el frente: si se mira el mueble por detrás (a través de la espina), sin etiqueta
      if ((px - e.x) * e.n[0] + (py - e.y) * e.n[1] < 0) continue;
      out[`e:${e.i}`] = { ...p, visible: true };
      shown += 1;
    }
    for (const [uid, p] of peers) {
      const q = project(p.x, p.y, 2.75);
      out[`p:${uid}`] = { ...q, visible: q.front && !examining };
    }
    return out;
  }
  function draw(now = performance.now()) {
    raf = 0;
    if (destroyed || document.visibilityState === 'hidden') return;
    const dtM = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0.016;
    const moving = aim(now) | tickMostrador(now, dtM);
    renderer.clear();
    camera.layers.set(0);
    renderer.render(scene, camera);
    if (carro.visible) {
      renderer.clearDepth();
      camera.layers.set(CAPA_CARRO);
      renderer.render(scene, camera);
      camera.layers.set(0);
    }
    renders += 1;
    onFrame(tags());
    if (step || walk || moving) invalidate();
    else lastT = 0;
  }
  function invalidate() {
    if (!raf && !destroyed) raf = requestAnimationFrame(draw);
  }
  function resize() {
    const rect = container.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const w = detail ? ART_W_CERCA : ART_W;
    renderer.setSize(w, Math.max(1, Math.round((w * rect.height) / rect.width)), false);
    camera.aspect = rect.width / rect.height;
    const portrait = (2 * Math.atan(Math.tan((HFOV * Math.PI) / 360) / camera.aspect) * 180) / Math.PI;
    camera.fov = camera.aspect < 1 ? Math.min(VFOV_MAX, portrait) : VFOV_LANDSCAPE;
    colocarCarro();
    const keep = lift;
    lift = 0;
    camera.clearViewOffset();
    setLift(keep);
    camera.updateProjectionMatrix();
    invalidate();
  }
  function rayAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    ray.setFromCamera(new Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1), camera);
  }
  function pickAt(clientX, clientY) {
    rayAt(clientX, clientY);
    // 1.101 · Solo lo de este lado de la pared derecha (la nave o las habitaciones): lo de detrás no se toca a través de ella
    const aqui = alla(px);
    const visible = Object.values(zonas)
      .filter((z) => z.group.visible)
      .flatMap((z) => z.items.filter((it) => ladoDe(it.e) === aqui).map((it) => it.pick));
    return ray.intersectObjects([...visible, ...pickers.filter((m) => m.userData.alla === aqui), ...(carro.visible ? [carroPick] : [])], false)[0]?.object.userData.id ?? null;
  }

  /** Ir andando por los pasillos hasta el punto de la red más cercano a (x, y); `face`, adónde mirar al llegar. */
  function walkTo(x, y, { face = null } = {}) {
    return new Promise((done) => {
      const from = onNet(px, py);
      const to = onNet(x, y);
      const pts = Math.hypot(from.x - px, from.y - py) > 0.02 ? [[from.x, from.y], ...route(from, to)] : route(from, to);
      seq = [];
      step = null;
      if (reduced()) {
        [px, py] = pts.at(-1) ?? [px, py];
        if (face) yaw = Math.atan2(face[0] - px, face[1] - py);
        walk = null;
        stream();
        invalidate();
        onMove({ x: px, y: py, yaw });
        done();
        return;
      }
      walk = { pts, face, done };
      invalidate();
    });
  }

  // ── Mandos: arrastrar mira (o gira el mueble de cerca); un toque elige; tocar el suelo lleva hasta allí ──
  const stop = new AbortController();
  const on = { signal: stop.signal };
  let press = null;
  canvas.addEventListener(
    'pointerdown',
    (e) => {
      if (tapJuego) {
        if (e.button === 0) tapJuego();
        return;
      }
      if (press) return;
      press = { x: e.clientX, y: e.clientY, yaw, spin, id: e.pointerId, moved: false };
      canvas.setPointerCapture?.(e.pointerId);
    },
    on,
  );
  canvas.addEventListener(
    'pointermove',
    (e) => {
      if (!press || e.pointerId !== press.id) return;
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > TAP_SLOP) press.moved = true;
      if (!press.moved || step) return;
      if (examining) {
        spin = press.spin + (e.clientX - press.x) * SPIN;
        const it = itemOf(examining.i);
        if (it) it.mesh.rotation.y = Math.atan2(it.e.n[0], it.e.n[1]) + spin;
        invalidate();
        return;
      }
      if (fixed) return;
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
    if (moved && !examining) onMove({ x: px, y: py, yaw });
    if (!tap) return;
    const id = pickAt(e.clientX, e.clientY);
    if (id) {
      onPick(id);
      return;
    }
    if (examining || fixed) {
      onPick(null);
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
      if (examining || fixed || step) {
        if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && examining) {
          e.preventDefault();
          spin += e.key === 'ArrowLeft' ? -0.25 : 0.25;
          const it = itemOf(examining.i);
          if (it) it.mesh.rotation.y = Math.atan2(it.e.n[0], it.e.n[1]) + spin;
          invalidate();
        }
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        yaw += e.key === 'ArrowLeft' ? KEY_STEP : -KEY_STEP;
        invalidate();
        onMove({ x: px, y: py, yaw });
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const k = e.key === 'ArrowUp' ? 1.2 : -1.2;
        walkTo(px + Math.sin(yaw) * k, py + Math.cos(yaw) * k).then(() => {});
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
  stream();
  resize();

  const api = {
    canvas,
    renders: () => renders,
    pose: () => ({ x: px, y: py, yaw }),
    settled: () => !step && !walk,
    /** Ir a un sitio: 'caja', 'mercadillo', 'entrada' o un expositor (su índice). Promesa que acaba al llegar. */
    go(target) {
      if (examining) api.leave(true);
      if (target === 'caja') return walkTo(...NODOS.caja, { face: [CAJA.cajero[0], CAJA.cajero[1]] });
      if (target === 'mercadillo') return walkTo(...NODOS.br, { face: [(MUELLE.x0 + MUELLE.x1) / 2, 0] });
      if (target === 'entrada') return walkTo(...NODOS.entrada, { face: [11, 12] });
      if (target === 'probador') return walkTo(...PROBADOR.mira, { face: [PROBADOR.mira[0], HAB.y0] });
      const e = EXPOSITORES[target];
      if (!e) return Promise.resolve();
      return walkTo(e.x + e.n[0] * 3, e.y + e.n[1] * 3, { face: [e.x, e.y] });
    },
    /** Ver de cerca el expositor `i`; `top`: hasta qué fracción del alto queda libre por encima del papel. */
    examine(i, top = 1) {
      const it = itemOf(i);
      if (!it) return;
      montar(it.e.zona).group.visible = true;
      if (!examining) examining = { i, back: { x: px, y: py, yaw } };
      else {
        const prev = itemOf(examining.i);
        if (prev) prev.mesh.rotation.y = Math.atan2(prev.e.n[0], prev.e.n[1]);
        examining = { ...examining, i };
      }
      spin = 0;
      const { e, box } = it;
      const size = Math.max(box[3] - box[0], box[5] - box[2], box[4] - box[1]);
      const zc = (box[2] + box[5]) / 2;
      const dist = clamp(size * 1.25 + 0.9, 1.9, 3.6);
      const cx = e.x + (e.pared ? e.n[0] * 0.2 : 0);
      const cy = e.y + (e.pared ? e.n[1] * 0.2 : 0);
      const view = {
        eye: [cx + e.n[0] * dist, cy + e.n[1] * dist, zc + dist * 0.32],
        at: [cx, cy, zc],
        lift: clamp(0.5 - top / 2, 0, 0.4),
      };
      if (!detail) {
        detail = true;
        resize();
      }
      run([{ to: view, ms: TWEEN_MS }]);
    },
    /** Dejar de mirar de cerca: vuelve a donde estabas, mirando hacia donde mirabas. */
    leave(now = false) {
      reflejo.visible = false;
      if (!examining) return;
      const it = itemOf(examining.i);
      if (it) it.mesh.rotation.y = Math.atan2(it.e.n[0], it.e.n[1]);
      ({ x: px, y: py, yaw } = examining.back);
      examining = null;
      spin = 0;
      if (detail) {
        detail = false;
        resize();
      }
      if (now) {
        seq = [];
        step = null;
        fixed = null;
        cur = null;
        invalidate();
        return;
      }
      run([{ to: 'home', ms: TWEEN_MS }]);
    },
    examining: () => examining?.i ?? null,
    /** Mirar la caja desde un paso atrás: el cajero y el mostrador quedan en el hueco que deja el papel. */
    mirarCaja(top = 1) {
      if (!examining) examining = { i: null, back: { x: px, y: py, yaw } };
      run([{ to: { eye: [CAJA.cajero[0], CAJA.y0 - 3.4, 2.7], at: [CAJA.cajero[0], CAJA.y1, 1.5], lift: clamp(0.5 - top / 2, 0, 0.42) }, ms: TWEEN_MS }]);
    },
    /**
     * 1.102 · Ponerse delante del espejo del probador con `avatar` reflejado (o quitarlo, con `on` false); `top`: hasta qué
     * fracción del alto queda libre por encima del papel. Al salir, `leave()` vuelve a donde estabas.
     */
    probador(on, { avatar = null, top = 1 } = {}) {
      reflejo.visible = on;
      if (!on) {
        invalidate();
        return;
      }
      vestirReflejo(avatar);
      if (!examining) examining = { i: null, back: { x: px, y: py, yaw } };
      const { x0, x1, z1 } = PROBADOR.espejo;
      const cx = (x0 + x1) / 2;
      run([{ to: { eye: [cx, HAB.y0 + 4.3, 1.75], at: [cx, HAB.y0 + ESPEJO_HONDO / 2, z1 * 0.55], lift: clamp(0.5 - top / 2, 0, 0.42) }, ms: TWEEN_MS }]);
    },
    /** 1.102 · Lo que se ve en el espejo mientras te pruebas la ropa. */
    vestir(avatar) {
      vestirReflejo(avatar);
    },
    /** Cambiar el tono del mueble de un expositor (la ficha enseña así sus variantes). */
    setTono(i, tono) {
      const it = itemOf(i);
      if (!it || it.tono === tono) return;
      const { kit: k } = itemKit(it.e, tono);
      const old = it.mesh.geometry;
      it.mesh.geometry = geometryOf(k);
      owned.push(it.mesh.geometry);
      old.dispose();
      it.tono = tono;
      invalidate();
    },
    /** La marca de «Mira esto» sobre un expositor, o null para quitarla. */
    mark(i) {
      const it = i == null ? null : itemOf(i);
      mark.visible = Boolean(it);
      if (it) mark.position.set(it.e.x + it.e.n[0] * (it.e.pared ? 0.4 : 0), it.box[5] + 0.25, it.e.y + it.e.n[1] * (it.e.pared ? 0.4 : 0));
      invalidate();
    },
    /** Quienes te acompañan: [{ uid, avatar, x, y, yaw }]. Los que faltan se quitan. */
    setPeers(list) {
      const seen = new Set();
      for (const p of list) {
        seen.add(p.uid);
        const key = JSON.stringify(p.avatar ?? null);
        let cur = peers.get(p.uid);
        if (!cur || cur.key !== key) {
          if (cur) {
            scene.remove(cur.mesh);
            cur.mesh.geometry.dispose();
          }
          const mesh = new Mesh(geometryOf(peerKit(p.avatar)), flat);
          scene.add(mesh);
          cur = { mesh, key, x: p.x, y: p.y, yaw: p.yaw, tx: p.x, ty: p.y, tyaw: p.yaw };
          peers.set(p.uid, cur);
        }
        cur.tx = clamp(p.x, 0.3, HAB.x1 - 0.3);
        cur.ty = clamp(p.y, 0.3, AD - 0.3);
        cur.tyaw = p.yaw;
      }
      for (const [uid, p] of peers) {
        if (seen.has(uid)) continue;
        scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        peers.delete(uid);
      }
      invalidate();
    },
    /** Dónde cae en la pantalla un expositor o un sitio (para las pruebas). */
    onScreen(id) {
      aim(performance.now());
      let at;
      if (id in SITIOS) {
        const b = SITIOS[id].box;
        at = [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2];
      } else {
        const it = itemOf(Number(id));
        at = [it.e.x, it.e.y, (it.box[2] + it.box[5]) / 2];
      }
      const p = project(...at);
      const rect = canvas.getBoundingClientRect();
      return { x: rect.left + p.x, y: rect.top + p.y };
    },
    /** Zonas montadas y visibles ahora (para las pruebas de carga por zonas). */
    zonas: () => Object.fromEntries(Object.entries(zonas).map(([z, v]) => [z, v.group.visible])),
    /** Ponerse en un sitio de golpe (para las pruebas y las capturas). */
    place(x, y, yawTo = yaw) {
      walk = null;
      seq = [];
      step = null;
      fixed = null;
      const p = onNet(x, y);
      px = p.x;
      py = p.y;
      yaw = yawTo;
      stream();
      invalidate();
    },
    /**
     * El albarán en el mostrador. `on`: enseñarlo (y acercar la cámara a la cinta) o quitarlo; `top`: hasta qué
     * fracción del alto queda libre por encima de los mandos; `dibujos`: las miniaturas de los muebles del carrito.
     */
    mostrador(on, { top = 0.6, dibujos = [] } = {}) {
      mostrador.visible = on;
      if (!on) {
        tapJuego = null;
        planos.forEach((p) => {
          p.mesh.visible = false;
          p.tinta.visible = false;
        });
        invalidate();
        return;
      }
      dibujosDe(dibujos);
      if (!examining) examining = { i: null, back: { x: px, y: py, yaw } };
      const mid = (BELT.x0 + BELT.x1) / 2;
      // Desde arriba y delante: la cinta en el centro de la pantalla (el botón va abajo, el letrero arriba)
      run([{ to: { eye: [mid + 0.1, CAJA.y0 - 0.78, 2.4], at: [mid + 0.1, BELT.y + 0.12, 1.1], lift: clamp(0.5 - top / 2, 0, 0.12) }, ms: TWEEN_MS }]);
    },
    /**
     * Un fotograma del albarán: `k` (plano en la cinta: 0–2, o fuera), `pos` (0–1, de izquierda a derecha en pantalla),
     * `marca` (dónde está el sello), `tinta` (dónde estaba el plano al sellar, o null) y `baja` (cuántas veces ha bajado el
     * sello: si sube, baja ahora).
     */
    albaran({ k = -1, pos = null, marca = 0.5, tinta = null, sellado = null, baja = 0 } = {}) {
      if (!mostrador.visible) return;
      selloTo = beltX(marca);
      marcaMesh.position.set(beltX(marca), BELT.z + 0.004, BELT.y);
      if (baja !== ultimaBaja) {
        ultimaBaja = baja;
        if (baja) golpe = performance.now();
      }
      planos.forEach((p, j) => {
        const ve = j === k && pos != null;
        p.mesh.visible = ve;
        if (!ve) return;
        const x = beltX(pos);
        p.mesh.position.set(x, BELT.z + 0.007, BELT.y);
        p.mesh.material.color.setScalar(sellado === false ? 0.55 : 1);
        p.tinta.visible = tinta != null;
        // La tinta, donde estaba el sello respecto al plano al bajar (el plano está girado media vuelta)
        if (tinta != null) p.tinta.position.set(-(beltX(marca) - beltX(tinta)), 0, 0.004);
      });
      invalidate();
    },
    /** Los paquetes del carro: [{ id, n, url }] (url, el dibujo del mueble para la pegatina). */
    carga(lista) {
      cargarCarro(lista);
    },
    cargaN: () => carroN,
    /** Mientras se juega, un toque en la escena sella (`fn`); null lo quita. */
    juego(fn) {
      tapJuego = fn;
    },
    invalidate,
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      stop.abort();
      observer.disconnect();
      for (const p of peers.values()) p.mesh.geometry.dispose();
      for (const x of owned) x.dispose?.();
      renderer.dispose();
      canvas.remove();
    },
  };
  return api;
}

