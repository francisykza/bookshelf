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
import { BoxGeometry, BufferGeometry, CanvasTexture, Color, Float32BufferAttribute, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, NearestFilter, PerspectiveCamera, Plane, PlaneGeometry, Raycaster, SRGBColorSpace, Scene, Vector2, Vector3, WebGLRenderer } from 'three';
// 1.99 (§99): «Sella el albarán» se juega en el propio mostrador de la caja (la cinta, el sello colgado de su carril, los
// planos y la tinta), con la cámara encima; la página solo pone el botón y la marcha del albarán.
import { createRaster, hash, noise, rgb } from '../../minigames/libreria-puerto/raster';
import { DEFAULT_AVATAR, JERSEYS, PANTALONES, PIELES, actorBoxes } from '../actor';
import { catalogItem } from '../catalog';
import { shapeOf } from '../furniture';
import { AD, AH, AMBIENTES, AW, BAJO, CAJA, DIRECTORIO, ESCALERA, EXPOSITORES, EYE, HAB, HABITACIONES, INICIO, PLAZA, ISLA, MUELLE, MURO, NODOS, PASO, PROBADOR, PUERTA, RACKS, RINCON, TRAMOS, dentro, onNet, plantaDe, route, zEscalera } from './almacenLayout';
import { ESCAPARATE, ZONAS_ROPA } from './plantaRopa';

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
const RIDE = 1.7; // 2.ª ampliación: lo que avanza (a lo hondo) la escalera mecánica, por segundo
const PELDANO = 0.4;
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
  // 2.ª ampliación · La lámpara de araña de la placita y una campana sobre el ala nueva
  { at: [23.5, 17.1, 3.4], k: 0.85, reach: 5.0 },
  { at: [23.5, 22.6, 4.3], k: 0.6, reach: 5.0 },
  // 2.ª ampliación · La planta de abajo: plafones en el techo, sobre los pasillos (solo alumbran su planta)
  ...[5, 11.5, 16.4].flatMap((x) => [3.6, 9, 15, 21].map((y) => ({ at: [x, y, BAJO.z + BAJO.alto - 0.1], k: x > 16 && y > 10 && y < 20 ? 0.35 : 0.72, reach: 5.4, bajo: true }))),
];
/** Lo que está por debajo de la losa de la nave lo alumbra la planta de abajo; lo de encima, la nave. */
const esDeAbajo = (z) => z < -0.3;
function glowAt(x, y, z) {
  let g = 0.08;
  const abajo = esDeAbajo(z);
  for (const { at, k, reach, bajo = false } of LUCES) {
    if (bajo !== abajo) continue;
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
const enNave = ([a, b, mec]) => !mec && !NODOS[a][2] && !NODOS[b][2];
const SEGS = TRAMOS.filter(enNave).map(([a, b]) => [NODOS[a], NODOS[b]]);
const SEGS_BAJO = TRAMOS.filter(([a, b, mec]) => !mec && NODOS[a][2] && NODOS[b][2]).map(([a, b]) => [NODOS[a], NODOS[b]]);
/** ¿Cae en el hueco de la losa, por donde pasan las escaleras mecánicas? */
const enHueco = (x, y) => x > ESCALERA.x0 && x < ESCALERA.x1 && y > ESCALERA.y0 && y < ESCALERA.y1;
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
    if (enHueco(x, y)) return 0;
    // 1.101 · El suelo de cada habitación montada
    const hab = HABITACIONES.find((h) => x > h.x0 + 0.08 && x < h.x1 - 0.06 && y > h.y0 + 0.12 && y < h.y1 - 0.06);
    if (hab) return lit(sueloHab(r, hab, x, y, ix, iy), glowAt(x, y, 0), ix, iy);
    // 2.ª ampliación · Fuera de las habitaciones, la sala tiene tarima, alfombra y la baldosa de la placita
    if (x > AW) return lit(sueloSala(r, x, y, ix, iy), glowAt(x, y, 0), ix, iy);
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
function paintWall(w, world, extra = () => null, alto = AH) {
  const r = probe();
  const brick = r.rampOf(BRICK);
  const cal = r.rampOf(CAL);
  const teal = r.rampOf(TEAL);
  const brass = r.rampOf(BRASS);
  const steel = r.rampOf(STEEL);
  const h = Math.round(alto * PX);
  return canvasOf(Math.round(w * PX), h, (ix, iy) => {
    const a = (ix + 0.5) / PX;
    const b = alto - (iy + 0.5) / PX;
    const own = extra(a, b, ix, iy);
    if (own != null) return own;
    let c;
    if (b < 1.3) c = brickAt(r, a, b, ix, iy, brick);
    else if (b < 1.44) c = b > 1.4 ? brass[3] : teal[2];
    else if (alto === AH && b > 4.55 && b < 5.45 && a % 3.2 > 0.9 && a % 3.2 < 2.3) {
      // Ventanas altas con su carpintería de acero
      const u = a % 3.2;
      const frame = u < 0.98 || u > 2.22 || b < 4.63 || b > 5.37 || Math.abs(u - 1.6) < 0.035;
      c = frame ? steel[1] : nightSky((u - 0.9) / 1.4, (b - 4.55) / 0.9, Math.floor(a / 3.2) * 7);
      return c;
    } else {
      const bc = brickAt(r, a, b, ix, iy, cal);
      c = bc === cal[1] ? cal[2] : cal[3];
      if (b > alto - 0.25) c = cal[1];
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
  for (const y of [4.6, 10.2, 15.8, 21.4]) {
    pushBox(s, [HAB.x0, y - 0.1, AH - 0.32, HAB.x1, y + 0.1, AH - 0.08], STEEL_D);
    pushBox(s, [HAB.x0, y - 0.06, AH - 1.0, HAB.x1, y + 0.06, AH - 0.92], STEEL);
    for (let x = HAB.x0 + 0.6; x < HAB.x1; x += 1.5) pushBox(s, [x - 0.04, y - 0.04, AH - 0.92, x + 0.04, y + 0.04, AH - 0.32], STEEL);
  }
  // Las campanas del pasillo 4
  for (const [x, y] of [
    [23.5, 6.8],
    [23.5, 12.4],
    [23.5, 22.6],
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
    // Si otra habitación empieza donde acaba esta, su tabique ya está: no se dibuja dos veces
    if (!HABITACIONES.some((o) => o !== h && o.x0 === h.x0 && Math.abs(o.y1 - h.y0) < 0.01 && o.y0 < h.y0)) tabique(h.y0);
    if (h.y1 < HAB.y1 - 0.2 && !HABITACIONES.some((o) => o !== h && o.x0 === h.x0 && Math.abs(o.y0 - h.y1) < 0.01)) tabique(h.y1);
    // El frente, abierto al pasillo: dos postes y un dintel con su remate
    const xf = h.x0 === AW ? h.x1 : h.x0;
    for (const y of [h.y0, h.y1]) pushBox(s, [xf - 0.09, y - 0.09, 0, xf + 0.09, y + 0.09, h.alto], trim);
    pushBox(s, [xf - 0.1, h.y0, h.alto - 0.34, xf + 0.1, h.y1, h.alto], trim);
    pushBox(s, [xf - 0.12, h.y0, h.alto - 0.38, xf + 0.12, h.y1, h.alto - 0.34], h.heroes ? BRASS : [142, 106, 69]);
    if (h.cerrada) {
      cortina(s, h, xf);
      continue;
    }
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
  buildPlaza(s);
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
  return s;
}

/**
 * 2.ª ampliación · La cortina de una habitación cerrada: terciopelo corrido de lado a lado (pliegues verticales, con luz y
 * sombra), la barra de latón con sus remates bajo una galería de roble, el bajo con fleco dorado y, delante, un caballete
 * con una pizarra (el texto lo pone el letrero del arco). Nada de chapa: el ala nueva se espera como un estreno.
 */
function cortina(s, h, xf) {
  const dx = h.x0 === AW ? 1 : -1;
  const top = h.alto - 0.4;
  const tela = h.tela ?? [128, 40, 52];
  const base = xf + dx * 0.06;
  const hacia = (a, d) => (dx > 0 ? [a, a + d] : [a - d, a]);
  // Los pliegues: tiras de 0,18 que salen y entran (la de fuera, más clara)
  for (let y = h.y0 + 0.1, k = 0; y < h.y1 - 0.1; y += 0.18, k++) {
    const [a, b] = hacia(base, k % 2 ? 0.05 : 0.11);
    pushBox(s, [a, y, 0.06, b, Math.min(h.y1 - 0.1, y + 0.18), top], shade3(tela, k % 2 ? 0.78 : 1.06));
  }
  // El centro, donde se juntan las dos hojas: un pliegue hondo y oscuro
  const yc = (h.y0 + h.y1) / 2;
  const [ca, cb] = hacia(base, 0.13);
  pushBox(s, [ca, yc - 0.03, 0.06, cb, yc + 0.03, top], shade3(tela, 0.55));
  // El bajo con su fleco dorado
  pushBox(s, [ca, h.y0 + 0.1, 0, cb, h.y1 - 0.1, 0.07], BRASS);
  for (let y = h.y0 + 0.14; y < h.y1 - 0.12; y += 0.09) pushBox(s, [ca, y, 0, cb, y + 0.03, 0.1], shade3(BRASS, 0.82));
  // La barra con sus remates y la galería de roble que la tapa, con su filete dorado
  const [ba, bb] = hacia(base + dx * 0.02, 0.1);
  pushBox(s, [ba, h.y0 + 0.02, top, bb, h.y1 - 0.02, top + 0.08], BRASS);
  for (const y of [h.y0 + 0.02, h.y1 - 0.14]) pushBox(s, [ba - 0.02, y, top - 0.03, bb + 0.02, y + 0.12, top + 0.11], shade3(BRASS, 1.12));
  const [ga, gb] = hacia(xf, 0.2);
  pushBox(s, [ga, h.y0 + 0.05, top + 0.08, gb, h.y1 - 0.05, top + 0.34], OAK);
  const [fa, fb] = hacia(xf + dx * 0.2, 0.02);
  pushBox(s, [fa, h.y0 + 0.05, top + 0.14, fb, h.y1 - 0.05, top + 0.18], BRASS);
  // El caballete con la pizarra, delante y a un lado, para no tapar el pasillo
  const ex = xf + dx * 0.42;
  const ey = h.y0 + (h.y1 - h.y0) * 0.3;
  for (const d of [-0.28, 0.28]) pushBox(s, [ex - 0.03, ey + d - 0.03, 0, ex + 0.03, ey + d + 0.03, 1.55], OAK);
  pushBox(s, [ex - dx * 0.3 - 0.03, ey - 0.03, 0, ex - dx * 0.3 + 0.03, ey + 0.03, 1.4], shade3(OAK, 0.8));
  pushBox(s, [ex - 0.04, ey - 0.36, 0.62, ex + 0.04, ey + 0.36, 0.68], OAK);
  pushBox(s, [ex - 0.035, ey - 0.33, 0.68, ex + 0.035, ey + 0.33, 1.34], [150, 112, 74]);
  const [pa, pb] = hacia(ex + dx * 0.035, 0.01);
  pushBox(s, [pa, ey - 0.29, 0.72, pb, ey + 0.29, 1.3], [42, 62, 54]);
  const [ta, tb] = hacia(ex + dx * 0.045, 0.005);
  pushBox(s, [ta, ey - 0.2, 1.16, tb, ey + 0.2, 1.21], [226, 222, 206]);
  for (const [w, z] of [
    [0.16, 1.04],
    [0.22, 0.96],
    [0.12, 0.88],
  ])
    pushBox(s, [ta, ey - w, z, tb, ey + w, z + 0.03], [196, 200, 186]);
  // Una estrellita de tiza en la esquina
  pushBox(s, [ta, ey + 0.17, 0.78, tb, ey + 0.23, 0.84], [236, 210, 120]);
}

/**
 * 2.ª ampliación · La placita: dos bancos de madera contra las paredes, cuatro macetas con planta, una lámpara de araña de
 * latón en el centro y, al fondo, el arco de madera que abre el ala nueva, con su tablilla colgada.
 */
function buildPlaza(s) {
  const { y0, y1, cx, cy } = PLAZA;
  const MACETA = [176, 96, 64];
  const HOJA = [70, 120, 70];
  // Los bancos, contra las paredes de los lados
  for (const [a, b] of [
    [AW + 0.15, AW + 0.75],
    [HAB.x1 - 0.75, HAB.x1 - 0.15],
  ]) {
    pushBox(s, [a, cy - 0.85, 0.4, b, cy + 0.85, 0.48], OAK);
    for (const y of [cy - 0.75, cy + 0.65]) pushBox(s, [a + 0.05, y, 0, b - 0.05, y + 0.1, 0.4], shade3(OAK, 0.7));
    const [ra, rb] = a < cx ? [a, a + 0.08] : [b - 0.08, b];
    pushBox(s, [ra, cy - 0.85, 0.48, rb, cy + 0.85, 0.95], shade3(OAK, 0.9));
    for (const z of [0.6, 0.78]) pushBox(s, [ra - 0.01, cy - 0.85, z, rb + 0.01, cy + 0.85, z + 0.06], shade3(OAK, 1.12));
  }
  // Las macetas, en las cuatro esquinas de la placita
  for (const x of [AW + 0.45, HAB.x1 - 0.45])
    for (const y of [y0 + 0.5, y1 - 0.5]) {
      pushBox(s, [x - 0.28, y - 0.28, 0, x + 0.28, y + 0.28, 0.5], MACETA);
      pushBox(s, [x - 0.31, y - 0.31, 0.44, x + 0.31, y + 0.31, 0.52], shade3(MACETA, 1.15));
      pushBox(s, [x - 0.04, y - 0.04, 0.5, x + 0.04, y + 0.04, 1.1], [96, 70, 44]);
      for (const [ox, oy, oz, r, k] of [
        [0, 0, 1.25, 0.34, 0.95],
        [0.16, -0.1, 1.0, 0.24, 0.8],
        [-0.14, 0.12, 1.05, 0.26, 0.88],
        [0.05, 0.15, 1.5, 0.22, 1.1],
      ])
        pushBox(s, [x + ox - r, y + oy - r, oz - r * 0.8, x + ox + r, y + oy + r, oz + r * 0.8], shade3(HOJA, k));
    }
  // La lámpara de araña: el vástago, un aro de latón con seis brazos y sus luces
  pushBox(s, [cx - 0.02, cy - 0.02, 3.6, cx + 0.02, cy + 0.02, AH - 0.32], STEEL_D);
  pushBox(s, [cx - 0.08, cy - 0.08, 3.3, cx + 0.08, cy + 0.08, 3.65], BRASS);
  for (let k = 0; k < 6; k += 1) {
    const ang = (k / 6) * Math.PI * 2;
    const x = cx + Math.cos(ang) * 0.55;
    const y = cy + Math.sin(ang) * 0.55;
    pushBox(s, [Math.min(cx, x) - 0.02, Math.min(cy, y) - 0.02, 3.32, Math.max(cx, x) + 0.02, Math.max(cy, y) + 0.02, 3.36], BRASS);
    pushBox(s, [x - 0.05, y - 0.05, 3.36, x + 0.05, y + 0.05, 3.44], BRASS);
    pushBox(s, [x - 0.04, y - 0.04, 3.44, x + 0.04, y + 0.04, 3.58], LAMP, { glow: true });
  }
  // El arco del ala nueva, sobre el pasillo: dos pilares, el dintel con su moldura, las ménsulas y la tablilla colgada
  for (const x of [22.2, 24.8]) pushBox(s, [x - 0.16, y1 - 0.16, 0, x + 0.16, y1 + 0.16, 3.3], OAK);
  pushBox(s, [22.0, y1 - 0.18, 3.0, 25.0, y1 + 0.18, 3.42], OAK);
  pushBox(s, [21.95, y1 - 0.2, 3.42, 25.05, y1 + 0.2, 3.5], BRASS);
  for (const [a, b] of [
    [22.36, 22.62],
    [24.38, 24.64],
  ])
    pushBox(s, [a, y1 - 0.2, 2.78, b, y1 + 0.2, 3.0], shade3(OAK, 0.85));
  for (const x of [23.0, 24.0]) pushBox(s, [x - 0.01, y1 - 0.01, 2.62, x + 0.01, y1 + 0.01, 3.0], STEEL_D);
  pushBox(s, [22.75, y1 - 0.04, 2.25, 24.25, y1 + 0.04, 2.66], [36, 60, 56]);
  pushBox(s, [22.7, y1 - 0.05, 2.62, 24.3, y1 + 0.05, 2.68], BRASS);
  pushBox(s, [22.7, y1 - 0.05, 2.2, 24.3, y1 + 0.05, 2.26], BRASS);
  for (const [w, z] of [
    [0.55, 2.48],
    [0.38, 2.36],
  ])
    pushBox(s, [cx - w, y1 - 0.06, z, cx + w, y1 + 0.06, z + 0.05], [230, 214, 160]);
}

/**
 * 2.ª ampliación · El suelo de la sala de las habitaciones fuera de ellas: tarima de espiga y, por el pasillo 4, una
 * alfombra larga verde con cenefa dorada; en la placita, baldosa hidráulica de terracota y crema con su orla.
 */
function sueloSala(r, x, y, ix, iy) {
  const { y0, y1, cx } = PLAZA;
  if (y > y0 && y < y1) {
    const e = Math.min(y - y0, y1 - y);
    if (e < 0.18) return r.rampOf(OAK)[e < 0.06 ? 1 : 2];
    if (e < 0.32) return r.rampOf([176, 96, 64])[2];
    const u = Math.floor((x - AW) / 0.5);
    const v = Math.floor((y - y0) / 0.5);
    const fx = ((x - AW) / 0.5) % 1;
    const fy = ((y - y0) / 0.5) % 1;
    const rombo = Math.abs(fx - 0.5) + Math.abs(fy - 0.5) < 0.28;
    return (u + v) % 2 ? r.rampOf([226, 210, 176])[rombo ? 2 : 3] : r.rampOf([176, 96, 64])[rombo ? 4 : 2];
  }
  // La alfombra del pasillo 4 (desde el paso hasta el fondo)
  const lat = Math.abs(x - cx);
  if (y > 5.6 && lat < 0.75) {
    if (lat > 0.62) return r.rampOf(BRASS)[lat > 0.7 ? 2 : 3];
    const motivo = Math.abs(lat - 0.36) < 0.05 && Math.floor(y / 0.4) % 2 === 0;
    return motivo ? r.rampOf(BRASS)[2] : r.rampOf(TEAL)[clamp(Math.floor(2.5 + (noise(x * 5, y * 5) - 0.5) * 0.8 + (r.bayerAt(ix, iy) - 0.5) * 0.4), 1, 3)];
  }
  // Tarima en espiga
  const a = x + y;
  const b = x - y;
  const fila = Math.floor(a / 0.5);
  const lado = (fila % 2 ? b : -b) + 50;
  const seam = a % 0.5 < 0.03 || lado % 0.9 < 0.03;
  return r.rampOf(OAK)[seam ? 1 : clamp(Math.floor(2.4 + hash(fila, Math.floor(lado / 0.9)) * 1.4 + (r.bayerAt(ix, iy) - 0.5) * 0.3), 2, 4)];
}

/** Hondo del marco del espejo: dentro cabe el reflejo de tu personaje, detrás del cristal. */
const ESPEJO_HONDO = 0.78;
/**
 * 1.102 · El probador: el espejo grande de pie contra la pared (marco de latón hondo, copete y dos apliques), la alfombra
 * redonda y el puf delante; y dos cabinas de roble con su cortina corrida a medias, la barra y una percha dentro.
 */
function buildProbador(s) {
  const { espejo: m, cabinas, fondo, y0 } = PROBADOR;
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
    const tela = CORTINAS[k % 2];
    const ancho = (x1 - x0) * 0.58;
    const de = k % 2 ? x1 - ancho : x0;
    for (let x = de, j = 0; x < de + ancho - 0.01; x += 0.12, j++) pushBox(s, [x, yc - 0.12 + (j % 2) * 0.04, 0.08, Math.min(de + ancho, x + 0.12), yc - 0.04 + (j % 2) * 0.04, 2.22], shade3(tela, j % 2 ? 0.82 : 1.06));
    pushBox(s, [de, yc - 0.13, 1.0, de + ancho, yc - 0.0, 1.08], BRASS);
  });
  // El letrero de esmalte encima de las cabinas: una percha
  const lx = (cabinas[0][0] + cabinas.at(-1)[1]) / 2;
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
  return s;
}

/** El personaje de quien te acompaña y su carretilla, en coordenadas propias (mira hacia +y). */
function peerKit(avatar, { carretilla = true, cesta = false, g: luz = 0.55 } = {}) {
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
  if (cesta) {
    // Bloque 3 · En la planta de ropa, una cesta de mimbre colgada del brazo derecho, sin decir qué lleva
    const MIMBRE = [190, 146, 96];
    pushBox(s, [0.36, -0.14, 0.62, 0.62, 0.16, 0.8], MIMBRE, { g: luz });
    pushBox(s, [0.37, -0.13, 0.66, 0.61, 0.15, 0.68], shade3(MIMBRE, 0.75), { g: luz });
    pushBox(s, [0.38, -0.02, 0.8, 0.6, 0.02, 0.98], STEEL, { g: luz });
    return s;
  }
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

// ── 2.ª ampliación (encargo de Francisco del 10-11-2026) · La planta de abajo y las escaleras mecánicas ──
const BZ = BAJO.z;
const TECHO_BAJO = BAJO.z + BAJO.alto;
const ALU = [176, 180, 188];
const GOMA = [34, 34, 40];
const CRISTAL = [178, 214, 224];
const AMARILLO = [222, 186, 64];
const LOSA_C = [170, 162, 150];

/** El suelo de abajo: tarima de roble clara, a lo ancho, y los pasillos de baldosa de piedra con su filete verde. */
function paintFloorBajo() {
  const r = probe();
  const oak = r.rampOf([196, 150, 104]);
  const stone = r.rampOf([214, 204, 186]);
  const teal = r.rampOf(TEAL);
  const rampas = new Map(ZONAS_ROPA.map((z) => [z.id, r.rampOf(z.suelo)]));
  const crema = r.rampOf([222, 206, 170]);
  return canvasOf(AW * PX, AD * PX, (ix, iy) => {
    const x = (ix + 0.5) / PX;
    const y = (iy + 0.5) / PX;
    const k = r.bayerAt(ix, iy);
    const g = glowAt(x, y, BZ);
    for (const [[ax, ay], [bx, by]] of SEGS_BAJO) {
      const dx = bx - ax;
      const dy = by - ay;
      const L = Math.hypot(dx, dy);
      const t = ((x - ax) * dx + (y - ay) * dy) / (L * L);
      if (t * L < -0.8 || t * L > L + 0.8) continue;
      const lat = Math.abs(((x - ax) * dy - (y - ay) * dx) / L);
      if (lat > 0.8) continue;
      if (lat > 0.7) return lit(teal[2], g, ix, iy);
      const junta = x % 0.8 < 0.04 || y % 0.8 < 0.04;
      return lit(stone[junta ? 2 : clamp(Math.floor(3 + (noise(x * 3, y * 3) - 0.5) * 0.9 + (k - 0.5) * 0.4), 2, 4)], g, ix, iy);
    }
    // Bloque 2 · el suelo de cada zona de ropa: moqueta con su cenefa; delante del probador, una alfombra crema
    const zr = ZONAS_ROPA.find(({ area: [a, b, c, d] }) => x > a && x < c && y > b && y < d);
    if (zr) {
      const [a, b, c2, d] = zr.area;
      const e = Math.min(x - a, c2 - x, y - b, d - y);
      const ramp = rampas.get(zr.id);
      return lit(ramp[e < 0.12 ? 1 : e < 0.2 ? 4 : clamp(Math.floor(2.6 + (noise(x * 6, y * 6) - 0.5) * 0.7 + (k - 0.5) * 0.4), 2, 3)], g, ix, iy);
    }
    if (x > 5.9 && x < 16.9 && y > 0.1 && y < 2.9) {
      return lit(crema[(Math.floor(x * 2) + Math.floor(y * 2)) % 2 ? 3 : 4], g, ix, iy);
    }
    const row = Math.floor(y / 0.25);
    const off = hash(row, 7) * 2.4;
    const joint = y % 0.25 < 0.03 || (x + off) % 2.4 < 0.03;
    const lvl = joint ? 1 : clamp(Math.floor(2.7 + (hash(Math.floor((x + off) / 2.4), row) - 0.5) * 1.3 + (k - 0.5) * 0.4), 2, 4);
    return lit(oak[lvl], g, ix, iy);
  });
}

/** El techo de abajo: placas de escayola en retícula, con el hueco de las escaleras. */
function paintCeilingBajo() {
  const r = probe();
  const cal = r.rampOf(CAL);
  return canvasOf(AW * PX, AD * PX, (ix, iy) => {
    const x = (ix + 0.5) / PX;
    const y = AD - (iy + 0.5) / PX;
    if (enHueco(x, y)) return 0;
    const grid = x % 1.2 < 0.04 || y % 1.2 < 0.04;
    return lit(cal[grid ? 2 : 4], glowAt(x, y, TECHO_BAJO - 0.05) * 0.9, ix, iy);
  });
}

/** Un cuadrilátero de las dos caras (para lo que va en rampa: los costados, el cristal y el pasamanos). */
function pushQuad(out, pts, color, { g = null, tone = 1 } = {}) {
  const c = [0, 1, 2].map((i) => pts.reduce((sum, p) => sum + p[i], 0) / 4);
  const col = litColor(color, g ?? glowAt(...c), tone);
  const P = pts.map(([x, y, z]) => [x, z, y]);
  for (const i of [0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2]) {
    out.pos.push(...P[i]);
    out.nor.push(0, 1, 0);
    out.col.push(col.r, col.g, col.b);
  }
}
/** Por dónde se parte la escalera para dibujarla, de yA a yB (yA > yB): cada medio paso y en los dos quiebros. */
function cortes(yA, yB) {
  const ys = new Set([yA, yB, ESCALERA.ya, ESCALERA.yb].filter((y) => y <= yA && y >= yB));
  for (let y = Math.ceil(yB * 2) / 2; y < yA; y += 0.5) ys.add(y);
  return [...ys].sort((a, b) => b - a);
}
/** Una banda de pie en x = X, de zLo(y) a zHi(y), a lo largo de la escalera. */
function banda(out, X, ys, zLo, zHi, color, opt) {
  for (let i = 0; i + 1 < ys.length; i += 1) {
    const [a, b] = [ys[i], ys[i + 1]];
    pushQuad(out, [[X, a, zLo(a)], [X, b, zLo(b)], [X, b, zHi(b)], [X, a, zHi(a)]], color, opt);
  }
}
/** Una faja tumbada de xa a xb, a la altura zf(y), a lo largo de la escalera. */
function faja(out, xa, xb, ys, zf, color, opt) {
  for (let i = 0; i + 1 < ys.length; i += 1) {
    const [a, b] = [ys[i], ys[i + 1]];
    pushQuad(out, [[xa, a, zf(a)], [xb, a, zf(a)], [xb, b, zf(b)], [xa, b, zf(b)]], color, opt);
  }
}
/** Una flecha de latón en la cara de un cartel (en y = Y, mirando a `cara`: 1 hacia +y, −1 hacia −y). */
function flecha(s, cx, Y, cara, zc, arriba) {
  const y0 = cara > 0 ? Y : Y - 0.03;
  const y1 = y0 + 0.03;
  pushBox(s, [cx - 0.035, y0, zc - 0.17, cx + 0.035, y1, zc + 0.17], BRASS, { glow: true });
  for (let k = 0; k < 4; k += 1) {
    const w = 0.04 + k * 0.045;
    const z = arriba ? zc + 0.17 - k * 0.045 : zc - 0.17 + k * 0.045;
    pushBox(s, [cx - w, y0, z - 0.023, cx + w, y1, z + 0.023], BRASS, { glow: true });
  }
}

/**
 * Las escaleras mecánicas: la armadura verde con la panza de acero (se ve desde abajo), los faldones, el cristal (aparte,
 * transparente) con su pasamanos de goma, los peines de arriba y de abajo, la barandilla del hueco en la nave, los cantos
 * de la losa y los carteles con su flecha. Los peldaños van aparte, porque se mueven.
 */
function buildEscaleras() {
  const s = kit();
  const v = kit();
  const { x0, x1, y0, y1, baja, sube, ya } = ESCALERA;
  const sz = zEscalera;
  const largo = cortes(y1 + 0.55, y0 - 0.55);
  const hueco = cortes(y1, y0);
  const panza = (y) => Math.max(BZ, sz(y) - 0.95);
  for (const X of [x0 + 0.01, x1 - 0.01]) banda(s, X, hueco, panza, (y) => sz(y) + 0.14, TEAL_D, { tone: 0.85 });
  faja(s, x0, x1, hueco, panza, STEEL_D, { tone: 0.6 });
  pushBox(s, [x0, y1 - 0.02, -0.95, x1, y1 + 0.06, TECHO_BAJO], TEAL_D);
  for (const [a, b] of [baja, sube]) {
    for (const X of [a, b]) {
      banda(s, X, largo, (y) => sz(y) - 0.02, (y) => sz(y) + 0.14, ALU, { tone: 0.9 });
      banda(v, X, largo, (y) => sz(y) + 0.14, (y) => sz(y) + 0.92, CRISTAL, { g: 0.75 });
      faja(s, X - 0.05, X + 0.05, largo, (y) => sz(y) + 0.99, GOMA, { tone: 1.15 });
      for (const d of [-0.05, 0.05]) banda(s, X + d, largo, (y) => sz(y) + 0.92, (y) => sz(y) + 0.99, GOMA, { tone: 0.85 });
    }
    pushBox(s, [a, y1, 0, b, y1 + 0.55, 0.03], ALU);
    pushBox(s, [a, y1, 0.03, b, y1 + 0.06, 0.045], AMARILLO);
    pushBox(s, [a, y0 - 0.55, BZ, b, y0, BZ + 0.03], ALU);
    pushBox(s, [a, y0 - 0.06, BZ + 0.03, b, y0, BZ + 0.045], AMARILLO);
  }
  for (const [xa, xb] of [
    [baja[1], sube[0]],
    [x0, baja[0]],
    [sube[1], x1],
  ])
    faja(s, xa, xb, largo, (y) => sz(y) + 0.14, ALU);
  // La barandilla del hueco, en la nave: cristal, pasamanos de acero y postes
  pushQuad(v, [[x0, y0, 0.05], [x0, ya, 0.05], [x0, ya, 1.0], [x0, y0, 1.0]], CRISTAL, { g: 0.75 });
  pushQuad(v, [[x0, y0, 0.05], [x1, y0, 0.05], [x1, y0, 1.0], [x0, y0, 1.0]], CRISTAL, { g: 0.75 });
  pushBox(s, [x0 - 0.04, y0 - 0.04, 1.0, x0 + 0.04, ya, 1.06], STEEL);
  pushBox(s, [x0, y0 - 0.04, 1.0, x1, y0 + 0.04, 1.06], STEEL);
  for (let k = 0; k <= 6; k += 1) {
    const y = y0 + ((ya - y0) * k) / 6;
    pushBox(s, [x0 - 0.03, y - 0.03, 0, x0 + 0.03, y + 0.03, 1.0], STEEL);
  }
  pushBox(s, [x1 - 0.06, y0 - 0.03, 0, x1, y0 + 0.03, 1.0], STEEL);
  // Los cantos de la losa, alrededor del hueco
  pushBox(s, [x0 - 0.06, y0 - 0.06, TECHO_BAJO, x0, y1 + 0.06, 0], LOSA_C);
  pushBox(s, [x0, y0 - 0.06, TECHO_BAJO, x1, y0, 0], LOSA_C);
  pushBox(s, [x1 - 0.02, y0, TECHO_BAJO, x1, y1, 0], LOSA_C);
  // Los carteles: arriba, sobre las cabezas (mira a la entrada); abajo, sobre el pie de la de subida (mira al fondo)
  const mid = (p) => (p[0] + p[1]) / 2;
  for (const [Y, z0, cara] of [
    [y1 + 0.5, 2.9, 1],
    [y0 - 0.55, BZ + 2.9, -1],
  ]) {
    const techo = z0 > 0 ? AH - 0.32 : TECHO_BAJO;
    for (const xr of [x0 + 0.3, x1 - 0.3]) pushBox(s, [xr - 0.02, Y - 0.02, z0 + 0.55, xr + 0.02, Y + 0.02, techo], STEEL_D);
    pushBox(s, [x0 + 0.1, Y - 0.05, z0, x1 - 0.1, Y + 0.05, z0 + 0.55], TEAL);
    pushBox(s, [x0 + 0.06, Y - 0.06, z0 - 0.04, x1 - 0.06, Y + 0.06, z0], BRASS);
    const zc = z0 + 0.275;
    if (cara > 0) {
      flecha(s, mid(baja), Y + 0.05, 1, zc, false);
      flecha(s, mid(sube), Y + 0.05, 1, zc, true);
    } else flecha(s, mid(sube), Y - 0.05, -1, zc, true);
  }
  return { s, v };
}

/** Lo de la planta de abajo que no es ropa: el rodapié de roble, los plafones y el cartel de la planta. */
function buildBajo() {
  const s = kit();
  pushBox(s, [0, 0, BZ, AW, 0.06, BZ + 0.14], OAK);
  pushBox(s, [0, AD - 0.06, BZ, AW, AD, BZ + 0.14], OAK);
  pushBox(s, [0, 0, BZ, 0.06, AD, BZ + 0.14], OAK);
  pushBox(s, [AW - 0.06, 0, BZ, AW, AD, BZ + 0.14], OAK);
  for (const { at, bajo } of LUCES) {
    if (!bajo || enHueco(at[0], at[1])) continue;
    const [x, y] = at;
    pushBox(s, [x - 0.5, y - 0.5, TECHO_BAJO - 0.05, x + 0.5, y + 0.5, TECHO_BAJO], STEEL);
    pushBox(s, [x - 0.44, y - 0.44, TECHO_BAJO - 0.07, x + 0.44, y + 0.44, TECHO_BAJO - 0.05], LAMP, { glow: true });
  }
  // El cartel de la planta, colgado sobre el pasillo central (el texto va en la etiqueta)
  const [cx, cy] = CARTELES['c:moda'];
  for (const dx of [-0.6, 0.6]) pushBox(s, [cx + dx - 0.02, cy - 0.02, BZ + 3.4, cx + dx + 0.02, cy + 0.02, TECHO_BAJO], STEEL_D);
  pushBox(s, [cx - 0.85, cy - 0.05, BZ + 2.95, cx + 0.85, cy + 0.05, BZ + 3.4], TEAL);
  pushBox(s, [cx - 0.89, cy - 0.06, BZ + 2.9, cx + 0.89, cy + 0.06, BZ + 2.95], BRASS);
  return s;
}


// ── 2.ª ampliación, bloque 2 · La planta de ropa: cada zona con lo suyo, como en una tienda de ropa ──
const COMPLEMENTO_COLOR = {
  bufanda: [176, 44, 48],
  gorro: [204, 158, 70],
  boina: [62, 66, 84],
  auriculares: [40, 40, 46],
  flor: [222, 124, 150],
  sombrero: [214, 186, 120],
  gorra: [40, 56, 96],
  capa: [42, 50, 92],
  visera: [56, 132, 90],
  fedora: [70, 64, 66],
  'gorro-estibador': [176, 60, 48],
  // Bloque 3 · los de la planta
  panuelo: [196, 54, 62],
  pompon: [224, 132, 60],
  bandolera: [126, 78, 46],
};
/** El color de una prenda de la planta. */
function colorPrenda(p) {
  const [key, raw] = p.split(':');
  if (key === 'jersey') return JERSEYS.find((j) => j.id === Number(raw))?.color ?? CAL;
  if (key === 'pantalon') return PANTALONES.find((j) => j.id === Number(raw))?.color ?? CAL;
  if (key === 'gafas') return [40, 36, 42];
  return COMPLEMENTO_COLOR[raw] ?? CAL;
}
/**
 * Una caja de una prenda colgada, en coordenadas de la prenda: `a` a lo ancho, `d` a lo hondo, z arriba. `eje` 'x': la
 * prenda mira hacia ±x (lo ancho va en y); 'y': mira hacia ±y.
 */
const enPrenda = (s, cx, cy, eje) => (a0, a1, d0, d1, z0, z1, c) =>
  eje === 'x' ? pushBox(s, [cx + d0, cy + a0, z0, cx + d1, cy + a1, z1], c) : pushBox(s, [cx + a0, cy + d0, z0, cx + a1, cy + d1, z1], c);
/** Un jersey en su percha, colgado con lo alto del gancho en zTop. */
function jerseyColgado(s, cx, cy, zTop, eje, c) {
  const b = enPrenda(s, cx, cy, eje);
  b(-0.015, 0.015, -0.015, 0.015, zTop - 0.08, zTop, BRASS);
  b(-0.25, 0.25, -0.016, 0.016, zTop - 0.11, zTop - 0.08, OAK);
  b(-0.24, 0.24, -0.04, 0.04, zTop - 0.66, zTop - 0.1, c);
  b(-0.33, -0.24, -0.035, 0.035, zTop - 0.6, zTop - 0.13, shade3(c, 0.84));
  b(0.24, 0.33, -0.035, 0.035, zTop - 0.6, zTop - 0.13, shade3(c, 0.84));
  b(-0.24, 0.24, -0.045, 0.045, zTop - 0.71, zTop - 0.64, shade3(c, 0.78));
  b(-0.08, 0.08, -0.045, 0.045, zTop - 0.14, zTop - 0.1, shade3(c, 0.7));
}
/** Un pantalón en su percha de pinzas. */
function pantalonColgado(s, cx, cy, zTop, eje, c) {
  const b = enPrenda(s, cx, cy, eje);
  b(-0.015, 0.015, -0.015, 0.015, zTop - 0.08, zTop, BRASS);
  b(-0.21, 0.21, -0.016, 0.016, zTop - 0.1, zTop - 0.07, STEEL);
  b(-0.19, 0.19, -0.04, 0.04, zTop - 0.18, zTop - 0.1, shade3(c, 0.82));
  b(-0.19, -0.015, -0.035, 0.035, zTop - 0.95, zTop - 0.18, c);
  b(0.015, 0.19, -0.035, 0.035, zTop - 0.95, zTop - 0.18, c);
}
function prendaColgada(s, p, cx, cy, zTop, eje) {
  if (p.startsWith('pantalon:')) pantalonColgado(s, cx, cy, zTop, eje, colorPrenda(p));
  else jerseyColgado(s, cx, cy, zTop, eje, colorPrenda(p));
}
/** Una pila de prendas dobladas (n), con el pliegue marcado. */
function doblados(s, x, y, z, c, n = 3) {
  for (let k = 0; k < n; k += 1) {
    const z0 = z + k * 0.055;
    const dx = ((k * 7) % 3) * 0.01 - 0.01;
    pushBox(s, [x - 0.17 + dx, y - 0.13, z0, x + 0.17 + dx, y + 0.13, z0 + 0.05], shade3(c, k % 2 ? 0.92 : 1));
    pushBox(s, [x - 0.17 + dx, y - 0.005, z0 + 0.05, x + 0.17 + dx, y + 0.005, z0 + 0.053], shade3(c, 0.75));
  }
}
/** Un complemento en su busto (la cabeza de madera clara en un pie), con la base en z. */
function complementoEn(s, x, y, z, id) {
  const c = COMPLEMENTO_COLOR[id] ?? CAL;
  const MADERA = [222, 204, 176];
  pushBox(s, [x - 0.06, y - 0.06, z, x + 0.06, y + 0.06, z + 0.02], STEEL_D);
  pushBox(s, [x - 0.015, y - 0.015, z + 0.02, x + 0.015, y + 0.015, z + 0.24], STEEL_D);
  if (id === 'capa') {
    pushBox(s, [x - 0.06, y - 0.05, z + 0.24, x + 0.06, y + 0.05, z + 0.46], MADERA);
    pushBox(s, [x - 0.16, y - 0.06, z + 0.04, x + 0.16, y + 0.07, z + 0.42], c);
    for (const [a, b] of [
      [-0.1, 0.3],
      [0.05, 0.18],
      [0.1, 0.36],
    ])
      pushBox(s, [x + a, y + 0.07, z + b, x + a + 0.025, y + 0.075, z + b + 0.025], LAMP, { glow: true });
    return;
  }
  pushBox(s, [x - 0.08, y - 0.08, z + 0.24, x + 0.08, y + 0.08, z + 0.45], MADERA);
  const h = z + 0.45;
  if (id === 'bufanda') {
    pushBox(s, [x - 0.1, y - 0.1, z + 0.22, x + 0.1, y + 0.1, z + 0.29], c);
    pushBox(s, [x + 0.04, y + 0.08, z + 0.06, x + 0.1, y + 0.11, z + 0.27], shade3(c, 0.85));
  } else if (id === 'gorro' || id === 'gorro-estibador') {
    pushBox(s, [x - 0.09, y - 0.09, h - 0.06, x + 0.09, y + 0.09, h + 0.07], c);
    pushBox(s, [x - 0.095, y - 0.095, h - 0.07, x + 0.095, y + 0.095, h - 0.03], shade3(c, 0.8));
    if (id === 'gorro') pushBox(s, [x - 0.035, y - 0.035, h + 0.07, x + 0.035, y + 0.035, h + 0.13], PAPER);
  } else if (id === 'panuelo') {
    pushBox(s, [x - 0.1, y - 0.1, z + 0.22, x + 0.1, y + 0.1, z + 0.29], c);
    pushBox(s, [x - 0.04, y + 0.08, z + 0.12, x + 0.04, y + 0.12, z + 0.25], shade3(c, 0.88));
    for (const [a, b] of [
      [-0.06, 0.26],
      [0.05, 0.24],
    ])
      pushBox(s, [x + a, y + 0.1, z + b, x + a + 0.025, y + 0.105, z + b + 0.02], PAPER);
  } else if (id === 'pompon') {
    pushBox(s, [x - 0.09, y - 0.09, h - 0.06, x + 0.09, y + 0.09, h + 0.07], c);
    pushBox(s, [x - 0.095, y - 0.095, h - 0.07, x + 0.095, y + 0.095, h - 0.03], shade3(c, 0.8));
    pushBox(s, [x - 0.05, y - 0.05, h + 0.07, x + 0.05, y + 0.05, h + 0.15], PAPER);
  } else if (id === 'bandolera') {
    for (let k = 0; k < 4; k += 1) pushBox(s, [x + 0.06 - k * 0.04, y + 0.08, z + 0.22 - k * 0.04, x + 0.09 - k * 0.04, y + 0.1, z + 0.26 - k * 0.04], c);
    pushBox(s, [x - 0.13, y + 0.02, z + 0.02, x - 0.01, y + 0.12, z + 0.12], c);
    pushBox(s, [x - 0.135, y + 0.02, z + 0.08, x - 0.005, y + 0.125, z + 0.125], shade3(c, 1.2));
  } else if (id === 'boina') {
    pushBox(s, [x - 0.11, y - 0.1, h - 0.02, x + 0.09, y + 0.1, h + 0.03], c);
  } else if (id === 'auriculares') {
    pushBox(s, [x - 0.09, y - 0.015, h - 0.01, x + 0.09, y + 0.015, h + 0.02], c);
    for (const d of [-1, 1]) pushBox(s, [x + d * 0.08 - 0.025, y - 0.04, z + 0.3, x + d * 0.08 + 0.025, y + 0.04, z + 0.4], shade3(c, 1.4));
  } else if (id === 'flor') {
    pushBox(s, [x + 0.03, y - 0.03, h - 0.06, x + 0.1, y + 0.04, h + 0.01], c);
    pushBox(s, [x + 0.05, y - 0.01, h - 0.04, x + 0.08, y + 0.02, h - 0.01], AMARILLO);
  } else if (id === 'sombrero' || id === 'fedora') {
    const ala = id === 'sombrero' ? 0.17 : 0.13;
    pushBox(s, [x - ala, y - ala, h - 0.01, x + ala, y + ala, h + 0.01], c);
    pushBox(s, [x - 0.085, y - 0.085, h + 0.01, x + 0.085, y + 0.085, h + 0.1], shade3(c, 1.05));
    pushBox(s, [x - 0.088, y - 0.088, h + 0.01, x + 0.088, y + 0.088, h + 0.035], id === 'sombrero' ? [150, 44, 52] : [30, 28, 32]);
  } else if (id === 'gorra' || id === 'visera') {
    pushBox(s, [x - 0.09, y - 0.09, h - 0.03, x + 0.09, y + 0.09, h + (id === 'gorra' ? 0.05 : 0.0)], c);
    pushBox(s, [x - 0.08, y + 0.07, h - 0.04, x + 0.08, y + 0.17, h - 0.02], shade3(c, 0.8));
  }
}
/** Un par de gafas redondas, en un atril pequeño. */
function gafasEn(s, x, y, z) {
  pushBox(s, [x - 0.06, y - 0.03, z, x + 0.06, y + 0.03, z + 0.03], OAK);
  for (const d of [-1, 1]) pushBox(s, [x + d * 0.045 - 0.035, y - 0.006, z + 0.03, x + d * 0.045 + 0.035, y + 0.006, z + 0.09], [40, 36, 42]);
  pushBox(s, [x - 0.012, y - 0.006, z + 0.065, x + 0.012, y + 0.006, z + 0.075], [40, 36, 42]);
}
/** El letrero colgado de una zona (el texto va en la etiqueta, que es el botón de la zona). */
function letreroZona(s, x, y, zTag, ancho = 1.5) {
  for (const dx of [-ancho / 2 + 0.15, ancho / 2 - 0.15]) pushBox(s, [x + dx - 0.02, y - 0.02, zTag - 0.05, x + dx + 0.02, y + 0.02, TECHO_BAJO], STEEL_D);
  pushBox(s, [x - ancho / 2, y - 0.05, zTag - 0.5, x + ancho / 2, y + 0.05, zTag - 0.05], TEAL);
  pushBox(s, [x - ancho / 2 - 0.04, y - 0.06, zTag - 0.54, x + ancho / 2 + 0.04, y + 0.06, zTag - 0.5], BRASS);
}

/**
 * La planta de ropa: los jerséis en la pared izquierda (de cara, en brazos, con sus pilas dobladas encima y una mesa), los
 * pantalones en burros de cuatro brazos, la vitrina de las gafas con los complementos en bustos, la ropa de fiesta y de
 * faena (casino y estiba) en barras junto a las escaleras, y el escaparate de delante con su tarima. `v`: el cristal.
 */
function buildPlantaRopa(v) {
  const s = kit();
  const z0 = BZ;
  const zona = (id) => ZONAS_ROPA.find((z) => z.id === id);
  const CROMO = [196, 200, 206];
  const MADERA_O = [120, 84, 52];
  // ── Jerséis: la pared de listones, el zócalo de cajones, los brazos con cada jersey de cara y las pilas de encima ──
  {
    const { prendas, area } = zona('jerseis');
    const [, ya, , yb] = area;
    pushBox(s, [0.06, ya, z0, 0.14, yb, z0 + 2.9], OAK);
    for (let y = ya + 0.2; y < yb; y += 0.4) pushBox(s, [0.14, y, z0 + 0.5, 0.16, y + 0.02, z0 + 2.9], MADERA_O);
    pushBox(s, [0.14, ya, z0, 0.62, yb, z0 + 0.45], MADERA_O);
    for (let y = ya + 0.5; y < yb - 0.3; y += 1.05) pushBox(s, [0.62, y - 0.3, z0 + 0.2, 0.63, y + 0.3, z0 + 0.26], BRASS);
    pushBox(s, [0.14, ya, z0 + 2.3, 0.62, yb, z0 + 2.35], OAK);
    const paso = Math.min(1.05, (yb - ya - 0.9) / Math.max(1, prendas.length - 1));
    prendas.forEach((p, k) => {
      const y = ya + 0.45 + k * paso;
      const c = colorPrenda(p);
      pushBox(s, [0.14, y - 0.015, z0 + 1.68, 0.62, y + 0.015, z0 + 1.71], CROMO);
      jerseyColgado(s, 0.55, y, z0 + 1.71, 'x', shade3(c, 0.9));
      jerseyColgado(s, 0.4, y, z0 + 1.71, 'x', c);
      doblados(s, 0.38, y, z0 + 2.35, c, 4);
    });
    // La mesa del centro, con más pilas
    pushBox(s, [2.0, 11.0, z0, 3.2, 14.2, z0 + 0.72], OAK);
    pushBox(s, [2.05, 11.05, z0, 3.15, 14.15, z0 + 0.66], MADERA_O);
    prendas.slice(0, 8).forEach((p, k) => doblados(s, 2.3 + (k % 2) * 0.6, 11.4 + Math.floor(k / 2) * 0.75, z0 + 0.72, colorPrenda(p), 2 + (k % 3)));
    letreroZona(s, ...zona('jerseis').tag);
  }
  // ── Pantalones: tres burros de cuatro brazos y una mesa ──
  {
    const { prendas } = zona('pantalones');
    const burros = [
      [7.4, 12.4],
      [9.4, 15.4],
      [7.4, 18.4],
    ];
    let k = 0;
    for (const [cx, cy] of burros) {
      pushBox(s, [cx - 0.35, cy - 0.03, z0, cx + 0.35, cy + 0.03, z0 + 0.04], CROMO);
      pushBox(s, [cx - 0.03, cy - 0.35, z0, cx + 0.03, cy + 0.35, z0 + 0.04], CROMO);
      pushBox(s, [cx - 0.03, cy - 0.03, z0, cx + 0.03, cy + 0.03, z0 + 1.62], CROMO);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        pushBox(s, [cx + Math.min(0, dx * 0.62) - 0.015, cy + Math.min(0, dy * 0.62) - 0.015, z0 + 1.5, cx + Math.max(0, dx * 0.62) + 0.015, cy + Math.max(0, dy * 0.62) + 0.015, z0 + 1.53], CROMO);
        const p = prendas[k % prendas.length];
        k += 1;
        for (const r of [0.38, 0.55]) prendaColgada(s, p, cx + dx * r, cy + dy * r, z0 + 1.53, dx ? 'x' : 'y');
      }
    }
    pushBox(s, [8.6, 19.6, z0, 10.2, 21.0, z0 + 0.72], OAK);
    prendas.slice(0, 6).forEach((p, j) => doblados(s, 8.95 + (j % 3) * 0.45, 19.95 + Math.floor(j / 3) * 0.6, z0 + 0.72, colorPrenda(p), 3));
    letreroZona(s, ...zona('pantalones').tag);
  }
  // ── Gafas y complementos: la vitrina, con las gafas dentro y los complementos en bustos encima ──
  {
    const { prendas } = zona('complementos');
    pushBox(s, [6.6, 5.8, z0, 10.2, 7.0, z0 + 0.82], MADERA_O);
    pushBox(s, [6.56, 5.76, z0 + 0.82, 10.24, 7.04, z0 + 0.86], BRASS);
    pushBox(s, [6.56, 5.76, z0 + 1.16, 10.24, 7.04, z0 + 1.2], BRASS);
    for (const [x, y] of [
      [6.58, 5.78],
      [10.22, 5.78],
      [6.58, 7.02],
      [10.22, 7.02],
    ])
      pushBox(s, [x - 0.02, y - 0.02, z0 + 0.86, x + 0.02, y + 0.02, z0 + 1.16], BRASS);
    pushQuad(v, [[6.6, 7.0, z0 + 0.86], [10.2, 7.0, z0 + 0.86], [10.2, 7.0, z0 + 1.16], [6.6, 7.0, z0 + 1.16]], CRISTAL, { g: 0.75 });
    pushQuad(v, [[6.6, 5.8, z0 + 0.86], [10.2, 5.8, z0 + 0.86], [10.2, 5.8, z0 + 1.16], [6.6, 5.8, z0 + 1.16]], CRISTAL, { g: 0.75 });
    for (let j = 0; j < 6; j += 1) gafasEn(s, 7.0 + j * 0.6, 6.4, z0 + 0.86);
    pushBox(s, [6.6, 5.8, z0 + 1.2, 10.2, 7.0, z0 + 1.21], [214, 232, 238], { glow: true });
    const bustos = prendas.filter((p) => p.startsWith('complemento:'));
    const paso = Math.min(0.47, 3.0 / Math.max(1, bustos.length - 1));
    bustos.forEach((p, j) => complementoEn(s, 6.9 + j * paso, 6.4, z0 + 1.21, p.split(':')[1]));
    letreroZona(s, ...zona('complementos').tag);
  }
  // ── Fiesta y faena: tres barras con lo del casino y la estiba, y un perchero de sombreros ──
  {
    const barras = [
      [12.2, ['jersey:15', 'jersey:16']],
      [14.8, ['pantalon:9', 'pantalon:10']],
      [17.4, ['jersey:17']],
    ];
    for (const [y, lista] of barras) {
      for (const x of [12.7, 15.4]) pushBox(s, [x - 0.03, y - 0.03, z0, x + 0.03, y + 0.03, z0 + 1.75], STEEL_D);
      for (const x of [12.7, 15.4]) pushBox(s, [x - 0.03, y - 0.3, z0, x + 0.03, y + 0.3, z0 + 0.04], STEEL_D);
      pushBox(s, [12.7, y - 0.015, z0 + 1.7, 15.4, y + 0.015, z0 + 1.73], BRASS);
      for (let j = 0; j < 8; j += 1) prendaColgada(s, lista[j % lista.length], 12.95 + j * 0.3, y, z0 + 1.73, 'x');
    }
    const [hx, hy] = [14.0, 20.1];
    pushBox(s, [hx - 0.25, hy - 0.25, z0, hx + 0.25, hy + 0.25, z0 + 0.05], STEEL_D);
    pushBox(s, [hx - 0.03, hy - 0.03, z0, hx + 0.03, hy + 0.03, z0 + 1.2], STEEL_D);
    for (const [dx, id] of [
      [-0.35, 'visera'],
      [0, 'fedora'],
      [0.35, 'gorro-estibador'],
    ]) {
      pushBox(s, [hx + Math.min(0, dx), hy - 0.02, z0 + 1.18, hx + Math.max(0, dx), hy + 0.02, z0 + 1.21], STEEL_D);
      complementoEn(s, hx + dx, hy, z0 + 1.21, id);
    }
    // Dos placas de esmalte: Casino (granate) y Estiba (azul mahón)
    for (const [y, c] of [
      [12.2, [128, 34, 48]],
      [17.4, [46, 72, 112]],
    ]) {
      pushBox(s, [12.62, y - 0.32, z0 + 1.8, 12.66, y + 0.32, z0 + 2.1], BRASS);
      pushBox(s, [12.6, y - 0.28, z0 + 1.83, 12.62, y + 0.28, z0 + 2.07], c);
    }
    letreroZona(s, ...zona('fiesta').tag);
  }
  // ── El escaparate de delante: la tarima con su filo de latón ──
  {
    const [x0, y0, x1, y1] = ESCAPARATE.area;
    pushBox(s, [x0, y0, z0, x1, y1, z0 + 0.25], [214, 204, 186]);
    pushBox(s, [x0 - 0.03, y0 - 0.03, z0 + 0.22, x1 + 0.03, y0 + 0.03, z0 + 0.27], BRASS);
    for (const m of ESCAPARATE.maniquies) pushBox(s, [m.x - 0.3, (y0 + y1) / 2 - 0.3, z0 + 0.25, m.x + 0.3, (y0 + y1) / 2 + 0.3, z0 + 0.3], [150, 44, 52]);
  }
  return s;
}
/** Un maniquí con un conjunto: el personaje de la casa, de marfil (sin piel ni pelo de color). */
function maniquiKit(look) {
  const avatar = { ...DEFAULT_AVATAR, piel: 0, pelo: 'rapado', colorPelo: 0, ...look };
  const piel = PIELES[0].color.join(',');
  const s = kit();
  const boxes = actorBoxes(avatar, { pose: 'stand', x: 0, y: 0, facing: 0 });
  const all = boxes.map((b) => b.b);
  const cx = (Math.min(...all.map((b) => b[0])) + Math.max(...all.map((b) => b[3]))) / 2;
  const cy = (Math.min(...all.map((b) => b[1])) + Math.max(...all.map((b) => b[4]))) / 2;
  for (const bx of boxes) {
    const c = (Array.isArray(bx.c) ? bx.c : unpack(bx.c)).join(',') === piel ? [236, 230, 220] : bx.c;
    pushBox(s, [bx.b[0] - cx, bx.b[1] - cy, bx.b[2], bx.b[3] - cx, bx.b[4] - cy, bx.b[5]], c, { g: 0.62 });
  }
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
  // 2.ª ampliación · abajo, en la planta de ropa
  probador: {
    box: [PROBADOR.cabinas[0][0] - 0.1, PROBADOR.y0, PROBADOR.z, PROBADOR.espejo.x1 + 0.3, PROBADOR.y0 + PROBADOR.fondo, PROBADOR.z + 3.2],
    tag: [(PROBADOR.espejo.x0 + PROBADOR.espejo.x1) / 2, PROBADOR.y0 + 1.1, PROBADOR.z + 3.0],
  },
  // Las zonas de la planta de ropa: su letrero es el botón
  ...Object.fromEntries(ZONAS_ROPA.map((z) => [`ropa:${z.id}`, { box: [z.area[0], z.area[1], BAJO.z, z.area[2], z.area[3], BAJO.z + 2.9], tag: z.tag }])),
  // 2.ª ampliación · Las escaleras mecánicas: arriba, las cabezas (se baja); abajo, el pie de la de subida (se sube)
  bajar: { box: [ESCALERA.x0, ESCALERA.y1 - 1.6, -0.2, ESCALERA.x1, ESCALERA.y1 + 0.6, 3.45], tag: [(ESCALERA.x0 + ESCALERA.x1) / 2, ESCALERA.y1 + 0.5, 3.5] },
  subir: { box: [ESCALERA.x0, ESCALERA.y0 - 0.6, BAJO.z, ESCALERA.x1, ESCALERA.y0 + 1.6, BAJO.z + 3.45], tag: [(ESCALERA.x0 + ESCALERA.x1) / 2, ESCALERA.y0 - 0.55, BAJO.z + 3.5] },
};
/** La planta de lo que tiene esta altura (los letreros de abajo, por debajo de la losa). */
const plantaTag = (z) => (z < -0.3 ? BAJO.z : 0);
/** Los carteles colgados de los pasillos (solo dicen dónde se está). */
export const CARTELES = {
  'c:lectura': [4.2, 12.6, 4.05],
  'c:salon': [11, 9.4, 4.05],
  'c:ambientes': [1.6, 12.6, 4.05],
  'c:paredes': [(MURO.x0 + MURO.x1) / 2, 12.6, MURO.alto + 0.45],
  'c:autoservicio': [8, 1.2, 5.2],
  'c:habitaciones': [AW - 0.3, (PASO.y0 + PASO.y1) / 2, PASO.alto + 0.5],
  'c:heroes': [24.8, 10.5, 4.1],
  // 2.ª ampliación · El arco del ala nueva, pasada la placita
  'c:pronto': [23.5, 18.6, 3.75],
  'c:moda': [11.5, 14.5, BAJO.z + 3.45],
};

export function mountAlmacen(container, { onPick = () => {}, onFrame = () => {}, onLost = () => {}, onSettle = () => {}, onMove = () => {}, puedeBajar = () => true, onBloqueo = () => {} } = {}) {
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
  plane(
    AW,
    AD,
    paintFloor(),
    (m) => {
      m.rotation.x = -Math.PI / 2;
      m.position.set(AW / 2, 0, AD / 2);
    },
    true,
  );
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

  // ── 2.ª ampliación · La planta de abajo (suelo, techo con el hueco y sus cuatro paredes) y las escaleras mecánicas ──
  plane(AW, AD, paintFloorBajo(), (m) => {
    m.rotation.x = -Math.PI / 2;
    m.position.set(AW / 2, BZ, AD / 2);
  });
  plane(
    AW,
    AD,
    paintCeilingBajo(),
    (m) => {
      m.rotation.x = Math.PI / 2;
      m.position.set(AW / 2, TECHO_BAJO, AD / 2);
    },
    true,
  );
  const paredBajo = (w, world, place) => plane(w, BAJO.alto, paintWall(w, world, () => null, BAJO.alto), place);
  paredBajo(AW, (a, b) => [a, 0.05, BZ + b], (m) => m.position.set(AW / 2, BZ + BAJO.alto / 2, 0));
  paredBajo(
    AD,
    (a, b) => [0.05, AD - a, BZ + b],
    (m) => {
      m.rotation.y = Math.PI / 2;
      m.position.set(0, BZ + BAJO.alto / 2, AD / 2);
    },
  );
  paredBajo(
    AD,
    (a, b) => [AW - 0.05, a, BZ + b],
    (m) => {
      m.rotation.y = -Math.PI / 2;
      m.position.set(AW, BZ + BAJO.alto / 2, AD / 2);
    },
  );
  paredBajo(
    AW,
    (a, b) => [AW - a, AD - 0.05, BZ + b],
    (m) => {
      m.rotation.y = Math.PI;
      m.position.set(AW / 2, BZ + BAJO.alto / 2, AD);
    },
  );
  scene.add(new Mesh(own(geometryOf(buildBajo())), flat));
  // Bloque 2 · la planta de ropa (con su cristal), los maniquíes del escaparate y el probador, que baja aquí
  {
    const v = kit();
    scene.add(new Mesh(own(geometryOf(buildPlantaRopa(v))), flat));
    scene.add(new Mesh(own(geometryOf(v)), own(new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.3, depthWrite: false }))));
    const ym = (ESCAPARATE.area[1] + ESCAPARATE.area[3]) / 2;
    for (const m of ESCAPARATE.maniquies) {
      const mesh = new Mesh(own(geometryOf(maniquiKit(m.look))), flat);
      mesh.position.set(m.x, BZ + 0.3, ym);
      mesh.rotation.y = Math.PI;
      scene.add(mesh);
    }
    const prob = new Mesh(own(geometryOf(buildProbador(kit()))), flat);
    prob.position.y = PROBADOR.z;
    scene.add(prob);
  }
  {
    const { s: e, v } = buildEscaleras();
    scene.add(new Mesh(own(geometryOf(e)), flat));
    scene.add(new Mesh(own(geometryOf(v)), own(new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.3, depthWrite: false }))));
  }
  // Los peldaños: uno solo, repetido, que avanza mientras se dibuja (en la de bajada hacia el fondo; en la otra, al revés)
  const PELDANOS = Math.ceil((ESCALERA.y1 - ESCALERA.y0) / PELDANO) + 1;
  const peldanos = (() => {
    const k = kit();
    const g = 0.55;
    pushBox(k, [-0.4, -PELDANO / 2, -0.25, 0.4, PELDANO / 2, 0], [118, 124, 134], { g });
    for (let x = -0.32; x < 0.33; x += 0.11) pushBox(k, [x, -PELDANO / 2 + 0.01, -0.004, x + 0.035, PELDANO / 2 - 0.01, 0.004], [88, 94, 104], { g });
    pushBox(k, [-0.4, PELDANO / 2 - 0.05, -0.003, 0.4, PELDANO / 2, 0.006], AMARILLO, { g });
    for (const x of [-0.4, 0.36]) pushBox(k, [x, -PELDANO / 2, -0.003, x + 0.04, PELDANO / 2, 0.006], AMARILLO, { g });
    const m = new InstancedMesh(own(geometryOf(k)), flat, 2 * PELDANOS);
    m.frustumCulled = false;
    scene.add(m);
    return m;
  })();
  const m4 = new Matrix4();
  const media = new Matrix4().makeRotationY(Math.PI);
  const nada = new Matrix4().makeScale(0, 0, 0);
  function moverPeldanos(now) {
    const ciclo = PELDANOS * PELDANO;
    const libre = ESCALERA.y1 - ESCALERA.y0 - PELDANO;
    const off = ((now / 1000) * RIDE) % ciclo;
    for (let i = 0; i < PELDANOS; i += 1) {
      const u = (i * PELDANO + off) % ciclo;
      for (const [k, sube] of [
        [0, false],
        [1, true],
      ]) {
        if (u > libre) {
          peldanos.setMatrixAt(k * PELDANOS + i, nada);
          continue;
        }
        const [a, b] = sube ? ESCALERA.sube : ESCALERA.baja;
        const y = sube ? ESCALERA.y0 + PELDANO / 2 + u : ESCALERA.y1 - PELDANO / 2 - u;
        m4.makeTranslation((a + b) / 2, zEscalera(y), y);
        if (sube) m4.multiply(media);
        peldanos.setMatrixAt(k * PELDANOS + i, m4);
      }
    }
    peldanos.instanceMatrix.needsUpdate = true;
  }
  moverPeldanos(0);

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

  // ── Bloque 2 · La cesta de la planta de ropa: de mimbre, con asa, y lo que llevas doblado dentro ──
  const cesta = new Group();
  cesta.visible = false;
  camera.add(cesta);
  const cestaCarga = new Mesh(own(new BufferGeometry()), flat);
  {
    const k = kit();
    const g = CARRO_G;
    const MIMBRE = [190, 146, 96];
    pushBox(k, [-0.26, -0.78, -0.42, 0.26, -0.36, -0.4], shade3(MIMBRE, 0.8), { g });
    for (const [a, b, c, d] of [
      [-0.26, -0.24, -0.78, -0.36],
      [0.24, 0.26, -0.78, -0.36],
    ])
      pushBox(k, [a, c, -0.4, b, d, -0.22], MIMBRE, { g });
    for (const y of [-0.78, -0.38]) pushBox(k, [-0.26, y, -0.4, 0.26, y + 0.02, -0.22], MIMBRE, { g });
    // El trenzado, solo en las cuatro paredes (por dentro se ve lo que llevas)
    for (let z = -0.37; z < -0.22; z += 0.05)
      for (const b of [
        [-0.265, -0.785, z, 0.265, -0.775, z + 0.012],
        [-0.265, -0.365, z, 0.265, -0.355, z + 0.012],
        [-0.265, -0.785, z, -0.255, -0.355, z + 0.012],
        [0.255, -0.785, z, 0.265, -0.355, z + 0.012],
      ])
        pushBox(k, b, shade3(MIMBRE, 0.72), { g });
    for (const x of [-0.18, 0.16]) pushBox(k, [x, -0.6, -0.22, x + 0.02, -0.56, -0.02], STEEL, { g });
    pushBox(k, [-0.18, -0.6, -0.04, 0.18, -0.56, -0.02], STEEL, { g });
    cesta.add(capaCarro(new Mesh(own(geometryOf(k)), flat)));
    cesta.add(capaCarro(cestaCarga));
  }
  let cestaN = 0;
  function cargarCesta(lista = []) {
    const k = kit();
    lista.slice(0, 8).forEach((p, j) => {
      const c = colorPrenda(p);
      const col = j % 2;
      const fila = Math.floor(j / 2);
      const x0 = col ? 0.01 : -0.23;
      const y0 = -0.75 + (fila % 2) * 0.18;
      const z0 = -0.34 + Math.floor(fila / 2) * 0.04 + (col ? 0.01 : 0);
      pushBox(k, [x0, y0, z0, x0 + 0.22, y0 + 0.2, z0 + 0.04], c, { g: CARRO_G });
      pushBox(k, [x0, y0 + 0.095, z0 + 0.04, x0 + 0.22, y0 + 0.105, z0 + 0.043], shade3(c, 0.75), { g: CARRO_G });
    });
    cestaCarga.geometry.dispose();
    cestaCarga.geometry = geometryOf(k);
    cestaN = Math.min(8, lista.length);
    invalidate();
  }
  /** El carro (o la cesta), abajo en la pantalla (cuánto, según el campo de visión) y solo mientras se anda. */
  function colocarCarro() {
    const t = Math.tan((camera.fov * Math.PI) / 360);
    for (const g of [carro, cesta]) {
      g.scale.setScalar(0.8);
      g.position.set(0, -0.64 * t * 0.6, -0.64);
    }
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
    m.userData.planta = plantaTag(z0);
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
    vidrio.position.set((x0 + x1) / 2, PROBADOR.z + (z0 + z1) / 2, PROBADOR.y0 + ESPEJO_HONDO - 0.01);
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
    reflejoMesh.position.set((PROBADOR.espejo.x0 + PROBADOR.espejo.x1) / 2, PROBADOR.z + PROBADOR.espejo.z0, PROBADOR.y0 + ESPEJO_HONDO / 2);
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
  let pz = 0; // la altura del suelo bajo tus pies: 0 en la nave, BAJO.z abajo y lo de en medio en la escalera
  let tilt = 0; // en la escalera mecánica se mira un poco hacia donde va
  let yaw = INICIO.yaw;
  let walk = null; // { pts: [[x, y, z, mec]…], face: [x, y] | null, done }
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

  const walkView = () => ({ eye: [px, py, pz + EYE], at: [px + Math.sin(yaw) * 6, py + Math.cos(yaw) * 6, pz + EYE + Math.tan(PITCH + tilt) * 6], lift: 0 });
  /** La planta en la que estás (en la escalera, la de la mitad más cercana). */
  const planta = () => plantaDe(pz);
  /** ¿Vas en la escalera mecánica? (Entonces no se cambia de camino: se espera a llegar.) */
  const enEscalera = () => Boolean(walk?.pts[0]?.[3]);
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
    for (const [z, [zx, zy, zz = 0]] of Object.entries(ZONAS)) {
      const d = Math.hypot(px - zx, py - zy, (pz - zz) * 2.5);
      if (d < CERCA || z === keep) montar(z).group.visible = true;
      else if (zonas[z] && d > LEJOS) zonas[z].group.visible = false;
    }
  }

  function advance(dt) {
    let wantTilt = 0;
    if (walk) {
      let t = dt;
      while (t > 0 && walk.pts.length) {
        const [tx, ty, tz = pz, mec = false] = walk.pts[0];
        const v = mec ? RIDE : WALK;
        const dx = tx - px;
        const dy = ty - py;
        const d = Math.hypot(dx, dy);
        if (d > 0.02) {
          const want = Math.atan2(dx, dy);
          yaw += wrapA(want - yaw) * Math.min(1, dt * (mec ? 4 : 7));
          if (mec) wantTilt = Math.atan2(tz - pz, d) * 0.7;
        }
        if (d <= v * t) {
          px = tx;
          py = ty;
          pz = tz;
          t -= d / v;
          walk.pts.shift();
        } else {
          const k = (v * t) / d;
          px += dx * k;
          py += dy * k;
          pz += (tz - pz) * k;
          t = 0;
        }
      }
    }
    tilt += (wantTilt - tilt) * Math.min(1, dt * 3);
    if (Math.abs(tilt) < 0.002) tilt = 0;
    if (!walk) return;
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
      onMove({ x: px, y: py, z: pz, yaw });
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
    moverPeldanos(now);
    // En la escalera mecánica el carro no se enseña: se ve el viaje
    carro.visible = !fixed && !examining && !mostrador.visible && (!step || step.to === 'home') && !enEscalera() && pz === 0;
    cesta.visible = !fixed && !examining && !mostrador.visible && (!step || step.to === 'home') && !enEscalera() && pz === BZ;
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
      p.mesh.position.set(p.x, p.z ?? 0, p.y);
      p.mesh.rotation.y = p.yaw;
    }
    return moving || tilt !== 0;
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
    // 2.ª ampliación · y de tu planta: lo de la otra lo tapa la losa
    const nivel = planta();
    for (const [id, s] of Object.entries(SITIOS)) {
      const p = project(...s.tag);
      out[id] = { ...p, visible: !quiet && alla(s.tag[0]) === aqui && plantaTag(s.tag[2]) === nivel && p.front && Math.hypot(px - s.tag[0], py - s.tag[1]) < 16 };
    }
    for (const [id, at] of Object.entries(CARTELES)) {
      const p = project(...at);
      out[id] = { ...p, visible: !quiet && alla(at[0]) === aqui && plantaTag(at[2]) === nivel && p.front && Math.hypot(px - at[0], py - at[1]) < 13 };
    }
    // Precios de lo cercano y a la vista (como mucho ETIQUETAS)
    const near = EXPOSITORES.filter((e) => nivel === 0 && zonas[e.zona]?.group.visible && ladoDe(e) === aqui)
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
    if (carro.visible || cesta.visible) {
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
    const nivel = planta();
    const visible = Object.values(zonas)
      .filter((z) => z.group.visible && nivel === 0)
      .flatMap((z) => z.items.filter((it) => ladoDe(it.e) === aqui).map((it) => it.pick));
    return (
      ray.intersectObjects([...visible, ...pickers.filter((m) => m.userData.alla === aqui && m.userData.planta === nivel), ...(carro.visible ? [carroPick] : [])], false)[0]?.object.userData.id ?? null
    );
  }

  /**
   * Ir andando por los pasillos hasta el punto de la red más cercano a (x, y) en la planta de la altura `z` (la nave, si no
   * se dice); `face`, adónde mirar al llegar. Si se va en la escalera mecánica, primero se llega a su final. Para bajar a
   * la planta de abajo con muebles en el carrito hay que pasar antes por caja (`puedeBajar`): se para en lo alto de la
   * escalera y avisa (`onBloqueo`).
   */
  function walkTo(x, y, { face = null, z = 0 } = {}) {
    if (enEscalera()) {
      return new Promise((done) => {
        const k = walk.pts.findIndex((p) => !p[3]);
        if (k >= 0) walk.pts = walk.pts.slice(0, k);
        walk.face = null;
        walk.done = () => walkTo(x, y, { face, z }).then(done);
      });
    }
    return new Promise((done) => {
      const from = onNet(px, py, pz);
      const to = onNet(x, y, z);
      let pts = Math.hypot(from.x - px, from.y - py, from.z - pz) > 0.02 ? [[from.x, from.y, from.z, false], ...route(from, to)] : route(from, to);
      let arrive = done;
      if (planta() === 0 && pts.some((p) => plantaDe(p[2]) !== 0) && !puedeBajar()) {
        const k = pts.findIndex((p) => p[3]);
        pts = k > 0 ? pts.slice(0, k) : [];
        face = [NODOS.eb[0], ESCALERA.yb];
        arrive = () => {
          onBloqueo('caja');
          done();
        };
      }
      seq = [];
      step = null;
      if (reduced() || !pts.length) {
        [px, py, pz] = pts.length ? pts.at(-1) : [px, py, pz];
        if (face) yaw = Math.atan2(face[0] - px, face[1] - py);
        walk = null;
        stream();
        invalidate();
        onMove({ x: px, y: py, z: pz, yaw });
        arrive();
        return;
      }
      walk = { pts, face, done: arrive };
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
    if (moved && !examining) onMove({ x: px, y: py, z: pz, yaw });
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
    if (enEscalera()) return;
    rayAt(e.clientX, e.clientY);
    floorPlane.constant = -planta();
    if (ray.ray.intersectPlane(floorPlane, hit) && dentro(hit.x, hit.z, planta())) walkTo(hit.x, hit.z, { z: planta() });
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
        onMove({ x: px, y: py, z: pz, yaw });
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const k = e.key === 'ArrowUp' ? 1.2 : -1.2;
        if (!enEscalera()) walkTo(px + Math.sin(yaw) * k, py + Math.cos(yaw) * k, { z: planta() }).then(() => {});
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
    pose: () => ({ x: px, y: py, z: pz, yaw }),
    settled: () => !step && !walk,
    /** 2.ª ampliación · La planta en la que estás: 0 (la nave) o BAJO.z (la de ropa). */
    planta,
    /**
     * Ir a un sitio: 'caja', 'mercadillo', 'entrada', 'probador', 'ropa' (la planta de abajo, por la escalera), 'arriba'
     * (la nave, por la otra) o un expositor (su índice). Promesa que acaba al llegar.
     */
    go(target) {
      if (examining) api.leave(true);
      if (target === 'ropa') return walkTo(NODOS.m2[0], NODOS.m2[1], { z: BAJO.z, face: [NODOS.m2[0], 20] });
      if (target === 'arriba') return walkTo(...NODOS.fr, { face: [11, 12] });
      if (target === 'caja') return walkTo(...NODOS.caja, { face: [CAJA.cajero[0], CAJA.cajero[1]] });
      if (target === 'mercadillo') return walkTo(...NODOS.br, { face: [(MUELLE.x0 + MUELLE.x1) / 2, 0] });
      if (target === 'entrada') return walkTo(...NODOS.entrada, { face: [11, 12] });
      // 2.ª ampliación · El fondo del pasillo 4, entre las habitaciones cerradas, mirando hacia el paso
      if (target === 'pasillo4') return walkTo(...NODOS.hf, { face: [NODOS.hf[0], 4] });
      if (target === 'probador') return walkTo(PROBADOR.mira[0], PROBADOR.mira[1], { z: PROBADOR.z, face: [PROBADOR.mira[0], PROBADOR.y0] });
      if (String(target).startsWith('ropa:')) {
        const z = ZONAS_ROPA.find((x) => `ropa:${x.id}` === target);
        return z ? walkTo(z.mira[0], z.mira[1], { z: BAJO.z, face: z.cara }) : Promise.resolve();
      }
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
      const { y0, z } = PROBADOR;
      run([{ to: { eye: [cx, y0 + 4.3, z + 1.75], at: [cx, y0 + ESPEJO_HONDO / 2, z + z1 * 0.55], lift: clamp(0.5 - top / 2, 0, 0.42) }, ms: TWEEN_MS }]);
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
        const key = JSON.stringify(p.avatar ?? null) + ((p.z ?? 0) < 0 ? ':abajo' : '');
        let cur = peers.get(p.uid);
        if (!cur || cur.key !== key) {
          if (cur) {
            scene.remove(cur.mesh);
            cur.mesh.geometry.dispose();
          }
          const mesh = new Mesh(geometryOf(peerKit(p.avatar, { cesta: (p.z ?? 0) < 0 })), flat);
          scene.add(mesh);
          cur = { mesh, key, x: p.x, y: p.y, z: p.z ?? 0, yaw: p.yaw, tx: p.x, ty: p.y, tyaw: p.yaw };
          peers.set(p.uid, cur);
        }
        // 2.ª ampliación · Si cambia de planta, aparece en la otra (sin bajar por el aire)
        if ((p.z ?? 0) !== cur.z) {
          cur.z = p.z ?? 0;
          cur.x = p.x;
          cur.y = p.y;
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
    /**
     * Ponerse en un punto de la escalera mecánica de golpe, a media bajada o subida (para las capturas): `y`, a lo hondo;
     * `sube`, en la de subida.
     */
    enLaEscalera(y, sube = false) {
      walk = null;
      seq = [];
      step = null;
      fixed = null;
      px = sube ? NODOS.es1[0] : NODOS.eb1[0];
      py = y;
      pz = zEscalera(y);
      yaw = sube ? 0 : Math.PI;
      tilt = (sube ? 1 : -1) * Math.atan2(-BAJO.z, ESCALERA.ya - ESCALERA.yb) * 0.7;
      stream();
      invalidate();
    },
    /** Ponerse en un sitio de golpe (para las pruebas y las capturas). */
    place(x, y, yawTo = yaw, z = 0) {
      walk = null;
      seq = [];
      step = null;
      fixed = null;
      const p = onNet(x, y, z);
      px = p.x;
      py = p.y;
      pz = p.z;
      tilt = 0;
      yaw = yawTo;
      stream();
      onMove({ x: px, y: py, z: pz, yaw });
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
    /** Bloque 2 · Lo que llevas en la cesta de la planta de ropa: ['jersey:12', …]. */
    cesta(lista) {
      cargarCesta(lista);
    },
    cestaN: () => cestaN,
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

