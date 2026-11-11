// El Gran Hotel del Puerto en 3D («Exteriores en 3D», bloque 3, 11-11-2026): el rascacielos de la fachada 2D
// (hotelArt.js) visto desde la plaza del muelle, a la altura de una persona y de noche. Se mira hacia arriba para verlo
// entero, de la marquesina a la aguja, y se gira a los lados. Las mismas cajas que el 2D (drawHotelBody), grabadas y
// pintadas con el motor de los exteriores (exterior3d.js): las ventanas encendidas, las cornisas y las pilastras doradas
// dan su propia luz; lo demás, de noche, se apaga salvo cerca de las farolas, la marquesina y la terraza. El rótulo
// «GRAN HOTEL / DEL PUERTO» va en neón con la letra de píxeles del 2D, y el naipe rosa sobre la puerta del casino.
import { AdditiveBlending, BufferGeometry, DoubleSide, Float32BufferAttribute, Mesh, MeshBasicMaterial, PlaneGeometry, RepeatWrapping } from 'three';
import { hash, noise, rgb } from '../../minigames/libreria-puerto/raster';
import { B, G, PX, R, buildMesh, canvasFrom, clamp, meshOf, mountExterior, probe, recorder, SKY_H, SKY_R, texture } from '../exterior3d';
import { drawHotelBody, GLYPHS, HOTEL_PARTS } from './hotelArt';

const { TD, SPIRE, U, GLOW, TAG_WIN, TAG_LIMO } = HOTEL_PARTS;
/** En 3D la plaza es más honda que en el 2D: te pones lejos para ver la torre entera. */
const QUAY = TD + 17;
export const EYE_Z = 1.6;
/** Dónde estás: en la plaza, de cara a la marquesina. Mundo del 2D (x, y; la fachada mira hacia +y). */
export const SPOTS = {
  home: { x: 5, y: TD + 13 },
  // Junto a la limusina, al bajarte (la puerta de atrás, del lado de la plaza)
  curb: { x: 3.9, y: TD + 4.75 },
  // Camino de la puerta, rodeando la limusina por detrás (hotelView3d.js)
  rodeo: { x: 2.7, y: TD + 5.4 },
  alfombra: { x: 2.7, y: TD + 2.6 },
  door: { x: 5, y: TD + 1.6 },
};
const EYES = Object.values(SPOTS).map((p) => [p.x, p.y, EYE_Z]);
const GROUND_PX = 24;
const GROUND = { x0: -24, x1: 34, y0: -1, y1: QUAY + 0.5 };

const STONE = [150, 138, 128];
const COBBLE = [132, 124, 120];
const WATER = [26, 44, 74];
const NEON = rgb(255, 214, 128);
const NEON_PINK = rgb(255, 150, 170);
// La noche (como el 2D): lo que no da luz se apaga y se enfría, salvo cerca de las luces
const NIGHT = [0.46, 0.47, 0.72];
// Marcas de las cajas que se decoran después: el tablero del rótulo y la placa del naipe
const SIGN = { x0: 1.5, x1: 8.5, z0: 2.45, z1: 4.8 };
const SPADE_BOX = [8.82, TD + 0.36, 2.45, 9.38, TD + 0.4, 3.05];

// La gente de la plaza, con cuerpo: abrigos y vestidos de noche, pantalones, pelo, sombreros y algún bolso
const COATS = [
  [196, 82, 70],
  [92, 120, 96],
  [74, 92, 150],
  [214, 170, 80],
  [150, 92, 138],
  [226, 216, 196],
  [60, 58, 74],
  [168, 112, 78],
];
const SKINS = [
  [236, 196, 160],
  [208, 156, 116],
  [150, 100, 70],
  [110, 72, 52],
];
const HAIRS = [
  [52, 36, 30],
  [120, 72, 40],
  [220, 186, 120],
  [30, 26, 30],
  [170, 160, 156],
];
const TROUSERS = [
  [44, 42, 56],
  [70, 62, 58],
  [36, 46, 70],
];

/**
 * Una persona de unos 1,5 de alto en (x, y) (la esquina del 2D), mirando a la plaza. `k` la hace distinta: color del
 * abrigo, piel, pelo, falda o pantalón, sombrero, bolso y un brazo levantado (charlando). El botones lleva su uniforme.
 */
function person3d(r, x0, y0, z, k, { doorman = false } = {}) {
  const h = (n) => hash(k * 7.3 + n, 3.1 + n * 1.7);
  const x = x0 + 0.085;
  const y = y0 + 0.065;
  const coat = doorman ? [150, 34, 40] : COATS[k % COATS.length];
  const skin = SKINS[Math.floor(h(1) * SKINS.length)];
  const hair = HAIRS[Math.floor(h(2) * HAIRS.length)];
  const legs = doorman ? [40, 34, 44] : TROUSERS[Math.floor(h(3) * TROUSERS.length)];
  const tall = 1.38 + h(4) * 0.22;
  const s = tall / 1.5;
  const skirt = !doorman && h(5) > 0.6;
  const o = { grain: 0 };
  const box = (a0, b0, c0, a1, b1, c1, col) => r.box(x + a0, y + b0, z + c0 * s, x + a1, y + b1, z + c1 * s, col, o);
  // Zapatos y piernas (o falda hasta la rodilla)
  box(-0.13, -0.05, 0, -0.02, 0.1, 0.06, [30, 26, 30]);
  box(0.02, -0.05, 0, 0.13, 0.1, 0.06, [30, 26, 30]);
  if (skirt) {
    box(-0.11, -0.03, 0.06, -0.04, 0.05, 0.42, skin);
    box(0.04, -0.03, 0.06, 0.11, 0.05, 0.42, skin);
    box(-0.2, -0.11, 0.4, 0.2, 0.13, 0.78, coat);
  } else {
    box(-0.12, -0.04, 0.06, -0.02, 0.07, 0.74, legs);
    box(0.02, -0.04, 0.06, 0.12, 0.07, 0.74, legs);
  }
  // Cuerpo, con el abrigo un poco más largo, y los brazos
  box(-0.17, -0.09, 0.7, 0.17, 0.11, 1.2, coat);
  const sleeve = coat.map((v) => v * 0.82);
  const talk = !doorman && h(6) > 0.7;
  box(-0.25, -0.06, 0.74, -0.17, 0.07, 1.18, sleeve);
  if (talk) box(0.17, -0.06, 1.06, 0.25, 0.07, 1.42, sleeve);
  else box(0.17, -0.06, 0.74, 0.25, 0.07, 1.18, sleeve);
  box(-0.25, -0.05, 0.66, -0.17, 0.06, 0.74, skin);
  if (talk) box(0.17, -0.05, 1.42, 0.25, 0.06, 1.48, skin);
  else box(0.17, -0.05, 0.66, 0.25, 0.06, 0.74, skin);
  // Un bolso colgado de la mano de algunos
  if (!doorman && h(7) > 0.75) box(-0.3, -0.07, 0.5, -0.17, 0.08, 0.7, [120, 70, 44]);
  // Cuello, cabeza y pelo
  box(-0.05, -0.04, 1.2, 0.05, 0.05, 1.26, skin);
  box(-0.1, -0.08, 1.26, 0.1, 0.09, 1.5, skin);
  box(-0.11, -0.09, 1.46, 0.11, 0.1, 1.54, hair);
  box(-0.11, 0.06, 1.3, 0.11, 0.1, 1.5, hair);
  if (skirt && h(8) > 0.4) box(-0.11, 0.06, 1.12, 0.11, 0.11, 1.32, hair);
  // Sombrero (de ala) o la gorra del botones
  if (doorman) {
    box(-0.11, -0.09, 1.5, 0.11, 0.1, 1.62, [150, 34, 40]);
    box(-0.04, -0.1, 1.2, 0.04, -0.09, 1.0, [240, 196, 104]);
  } else if (k % 4 === 1) {
    box(-0.17, -0.14, 1.5, 0.17, 0.16, 1.53, [70, 50, 40]);
    box(-0.1, -0.08, 1.53, 0.1, 0.1, 1.66, [70, 50, 40]);
  }
}

/** Graba el hotel con las luces de la noche (en unidades del mundo: el 2D las da en píxeles, 6 por unidad). */
function recordHotel() {
  const rec = recorder();
  const lights = [];
  const light = (x, y, z, radius, color = [255, 200, 130]) => lights.push({ p: [x, y, z], r: radius / 6, c: color });
  const { crowd } = drawHotelBody(rec, { light, quay: QUAY, drawPerson: person3d });
  // La placa oscura del naipe del casino (en el 2D se pinta encima del dibujo)
  rec.box(...SPADE_BOX, [42, 30, 44], { grain: 0 });
  // En la plaza honda, más farolas a los lados del camino hasta el muelle
  for (const [x, y] of [
    [-2.4, TD + 9],
    [12.4, TD + 9],
    [-2.4, TD + 14],
    [12.4, TD + 14],
  ]) {
    rec.box(x, y, 0, x + 0.1, y + 0.1, 2.2, [52, 48, 56], { grain: 0 });
    rec.setId(GLOW);
    rec.box(x - 0.1, y - 0.1, 2.2, x + 0.2, y + 0.2, 2.55, [255, 222, 156], { grain: 0 });
    rec.setId(0);
    rec.box(x - 0.14, y - 0.14, 2.55, x + 0.24, y + 0.24, 2.62, [52, 48, 56], { grain: 0 });
    light(x, y, 2.4, 26);
  }
  // Cada ventana encendida alumbra un poco la pared de alrededor (en el 2D lo hace el resplandor)
  for (const box of rec.boxes) {
    const tag = box.id & 0x7fff;
    if (!(box.id & GLOW) || tag < TAG_WIN || tag >= TAG_WIN + 0x800) continue;
    const [x0, y0, z0, x1, y1, z1] = box.b;
    const side = x1 - x0 < y1 - y0;
    lights.push({ p: side ? [x1 + 0.2, (y0 + y1) / 2, (z0 + z1) / 2] : [(x0 + x1) / 2, y1 + 0.2, (z0 + z1) / 2], r: 0.95, c: box.c });
  }
  return { rec, lights, crowd };
}

/** Lo que suma una luz en `p` (o 0 si no llega). */
function reach(l, p) {
  const d = Math.hypot(p[0] - l.p[0], p[1] - l.p[1], (p[2] - l.p[2]) * 0.8) / l.r;
  return d < 1 ? (1 - d) ** 1.7 : 0;
}
/** El color `c` de noche con la luz (g0, g1, g2) que le llega. */
const lit = (c, g0, g1, g2) => rgb(R(c) * (NIGHT[0] + Math.min(0.75, g0 * 0.75)), G(c) * (NIGHT[1] + Math.min(0.62, g1 * 0.62)), B(c) * (NIGHT[2] + Math.min(0.3, g2 * 0.3)));
function night(c, p, lights) {
  let g0 = 0;
  let g1 = 0;
  let g2 = 0;
  for (const l of lights) {
    const k = reach(l, p);
    if (k) {
      g0 += (k * l.c[0]) / 255;
      g1 += (k * l.c[1]) / 255;
      g2 += (k * l.c[2]) / 255;
    }
  }
  return lit(c, g0, g1, g2);
}

const near = (a, b) => Math.abs(a - b) < 1e-6;

/** Las letras de píxeles de una línea, en `put(x, y)` (cada píxel de la letra, `k` × `k` texels). */
function neonLine(line, x0, y0, k, put) {
  let x = x0;
  for (const ch of line) {
    if (ch === ' ') {
      x += 2 * k;
      continue;
    }
    const g = GLYPHS[ch];
    g.forEach((bits, gy) => [...bits].forEach((bit, gx) => bit === '#' && put(x + gx * k, y0 + gy * k, k)));
    x += (g[0].length + 1) * k;
  }
}
const widthOf = (line) => [...line].reduce((w, ch) => w + (ch === ' ' ? 2 : GLYPHS[ch][0].length + 1), -1);

function paintFace(box, f, w, h, lights) {
  const r = probe();
  const ramp = r.rampOf(box.c);
  const [x0, y0, z0, x1, y1, z1] = box.b;
  const longX = x1 - x0 >= y1 - y0;
  const g = (a, b) => (box.grain ? noise(a, b) : 0.5);
  const pix = new Uint32Array(w * h);
  const glow = box.id & GLOW;
  const limo = box.id === TAG_LIMO;
  // Solo las luces que llegan a esta cara
  const lo = [0, 1, 2].map((k) => Math.min(f.o[k], f.o[k] + f.u[k], f.o[k] + f.v[k], f.o[k] + f.u[k] + f.v[k]));
  const hi = [0, 1, 2].map((k) => Math.max(f.o[k], f.o[k] + f.u[k], f.o[k] + f.v[k], f.o[k] + f.u[k] + f.v[k]));
  const here = glow ? [] : lights.filter((l) => Math.hypot(...[0, 1, 2].map((k) => Math.max(lo[k] - l.p[k], 0, l.p[k] - hi[k]) * (k === 2 ? 0.8 : 1))) < l.r);
  const ox = Math.round((f.kind === 'side' || f.kind === 'side0' ? f.o[1] : f.o[0]) * PX);
  const oy = Math.round(-f.o[2] * PX) + (f.kind === 'top' || f.kind === 'bottom' ? Math.round(f.o[1] * PX) : 0);
  // La luz de la noche, estampada luz a luz solo en los texels a los que llega (mucho más rápido que mirar todas en cada uno)
  const acc = new Float32Array(w * h * 3).fill(limo ? 0.25 : 0);
  const at = (i, j) => {
    const s = (i + 0.5) / w;
    const t = (j + 0.5) / h;
    return [f.o[0] + f.u[0] * s + f.v[0] * t, f.o[1] + f.u[1] * s + f.v[1] * t, f.o[2] + f.u[2] * s + f.v[2] * t];
  };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const uu = dot(f.u, f.u);
  const vv = dot(f.v, f.v);
  for (const l of here) {
    const rel = [l.p[0] - f.o[0], l.p[1] - f.o[1], l.p[2] - f.o[2]];
    const s = dot(rel, f.u) / uu;
    const t = dot(rel, f.v) / vv;
    const rs = (l.r * 1.3) / Math.sqrt(uu);
    const rt = (l.r * 1.3) / Math.sqrt(vv);
    const i0 = clamp(Math.floor((s - rs) * w), 0, w - 1);
    const i1 = clamp(Math.ceil((s + rs) * w), 0, w - 1);
    const j0 = clamp(Math.floor((t - rt) * h), 0, h - 1);
    const j1 = clamp(Math.ceil((t + rt) * h), 0, h - 1);
    for (let j = j0; j <= j1; j += 1)
      for (let i = i0; i <= i1; i += 1) {
        const k = reach(l, at(i, j));
        if (!k) continue;
        const n = (j * w + i) * 3;
        acc[n] += (k * l.c[0]) / 255;
        acc[n + 1] += (k * l.c[1]) / 255;
        acc[n + 2] += (k * l.c[2]) / 255;
      }
  }
  for (let j = 0; j < h; j += 1) {
    for (let i = 0; i < w; i += 1) {
      const p = at(i, j);
      const [a, b] = f.ab(p);
      const grain = f.fn === 'top' ? (longX ? g(a * 0.8 + box.seed, b * 9) : g(a * 9, b * 0.8 + box.seed)) : g(a * 0.8 + box.seed, b * 9);
      let c = box.face?.(f.fn, a, b) ?? ramp[clamp(Math.floor(f.base + (grain - 0.5) * 1.3 + (r.bayerAt(ox + i, oy + j) - 0.5) * 0.5), 0, 4)];
      // Lo que da luz no se apaga; la limusina negra, algo alumbrada por la marquesina para que se lea
      if (!glow) c = lit(c, acc[(j * w + i) * 3], acc[(j * w + i) * 3 + 1], acc[(j * w + i) * 3 + 2]);
      if (w > 3 && h > 3 && (i === 0 || j === 0 || i === w - 1 || j === h - 1) && !glow) c = rgb(R(c) * 0.86, G(c) * 0.84, B(c) * 0.9);
      // El perfil de la limusina, con un filo de luz arriba (como el 2D)
      if (limo && f.kind === 'top') c = rgb(R(c) + 40, G(c) + 36, B(c) + 40);
      pix[j * w + i] = c;
    }
  }
  if (f.kind === 'front' && near(x0, SIGN.x0) && near(x1, SIGN.x1) && near(z0, SIGN.z0) && near(z1, SIGN.z1)) {
    // «GRAN HOTEL» en neón dorado y «DEL PUERTO» en rosa, centrados en el tablero
    const k = Math.max(1, Math.floor(Math.min(w / (widthOf('GRAN HOTEL') + 4), h / 15)));
    const top = Math.round((h - 11 * k) / 2);
    ['GRAN HOTEL', 'DEL PUERTO'].forEach((line, row) =>
      neonLine(line, Math.round((w - widthOf(line) * k) / 2), top + row * 6 * k, k, (x, y, n) => {
        for (let dy = 0; dy < n; dy += 1) for (let dx = 0; dx < n; dx += 1) if (x + dx < w && y + dy < h) pix[(y + dy) * w + x + dx] = row ? NEON_PINK : NEON;
      }),
    );
  }
  if (f.kind === 'front' && near(x0, SPADE_BOX[0]) && near(z1, SPADE_BOX[5])) {
    const SPADE = ['..#..', '.###.', '#####', '#####', '..#..'];
    const k = Math.floor(Math.min(w, h) / 6);
    const left = Math.round((w - 5 * k) / 2);
    const top = Math.round((h - 5 * k) / 2);
    SPADE.forEach((row, gy) => [...row].forEach((bit, gx) => bit === '#' && Array.from({ length: k * k }, (_, n) => (pix[(top + gy * k + ((n / k) | 0)) * w + left + gx * k + (n % k)] = NEON_PINK))));
  }
  return pix;
}

/** La plaza: adoquines con la rosa de los vientos delante de la puerta, el bordillo del muelle y las sombras de la gente. */
// La plaza acaba de llover: cada luz baja (farolas, marquesina, rótulo) deja en el suelo una estela que se alarga hacia
// quien mira desde la plaza, y en los charcos se ve mucho más. Es un reflejo fingido (fijo, pintado en el suelo), pero
// desde los sitios a los que se anda la estela cae donde tocaría.
function glintsOf(lights) {
  const glints = lights.filter((l) => l.r > 1.5 && l.p[2] > 0.6 && l.p[2] < 6 && l.p[1] > TD - 0.2).map((l) => ({ x: l.p[0], y: l.p[1], z: l.p[2], c: l.c, k: 0.9 }));
  // El rótulo: oro arriba, rosa abajo, a lo ancho
  for (let x = SIGN.x0 + 0.5; x < SIGN.x1; x += 0.7) {
    glints.push({ x, y: TD + 0.05, z: 4.2, c: [255, 214, 110], k: 1.6 });
    glints.push({ x, y: TD + 0.05, z: 3.0, c: [255, 110, 170], k: 1.6 });
  }
  return glints;
}
function puddleAt(x, y) {
  return noise(x * 0.42 + 7, y * 0.6) + noise(x * 1.3, y * 1.9 + 3) * 0.35;
}

function paintGround(shadows, lights) {
  // Solo las luces que llegan al suelo
  const low = lights.filter((l) => l.p[2] * 0.8 < l.r);
  const glints = glintsOf(lights);
  const r = probe();
  const cobble = r.rampOf(COBBLE);
  const stone = r.rampOf(STONE);
  const w = Math.round((GROUND.x1 - GROUND.x0) * GROUND_PX);
  const h = Math.round((GROUND.y1 - GROUND.y0) * GROUND_PX);
  const data = new Uint32Array(w * h);
  for (let j = 0; j < h; j += 1) {
    for (let i = 0; i < w; i += 1) {
      const x = GROUND.x0 + (i + 0.5) / GROUND_PX;
      const y = GROUND.y0 + (j + 0.5) / GROUND_PX;
      let c;
      if (y > QUAY) c = stone[(x * 1.6) % 1 < 0.08 ? 1 : 3];
      else {
        const dx = x - 5;
        const dy = y - (TD + 2.9);
        if (dx * dx + dy * dy * 1.6 < 2.2) c = stone[(Math.atan2(dy, dx) * 4) % 1.6 < 0.8 ? 4 : 3];
        else {
          const cy = Math.floor(y * 3.6);
          const cx = Math.floor(x * 3 + (cy % 2) * 0.5);
          const seam = (x * 3 + (cy % 2) * 0.5) % 1 < 0.14 || (y * 3.6) % 1 < 0.16;
          c = cobble[clamp(Math.floor(3 + (hash(cx, cy) - 0.5) * 1.2 - (seam ? 1.3 : 0)), 0, 4)];
        }
      }
      let shade = y < TD + 0.3 && y > -0.5 && x > -0.8 && x < 10.8 ? 1 : 0;
      for (const s of shadows) if (Math.hypot((x - s.x) / (s.r * 1.05), (y - s.y) / (s.r * 0.7)) + (r.bayerAt(i, j) - 0.5) * 0.4 < 1) shade = 1;
      if (shade) c = rgb(R(c) * 0.78, G(c) * 0.76, B(c) * 0.86);
      c = night(c, [x, y, 0], low);
      if (y < QUAY) {
        // Mojado: algo más oscuro y frío; en los charcos, casi espejo
        const pud = puddleAt(x, y) > 0.78;
        const wet = pud ? 1 : 0.22;
        let r0 = R(c) * (pud ? 0.62 : 0.9);
        let g0 = G(c) * (pud ? 0.64 : 0.9);
        let b0 = B(c) * (pud ? 0.8 : 0.95);
        if (pud) {
          r0 += 6;
          g0 += 8;
          b0 += 20;
        }
        let a0 = 0;
        let a1 = 0;
        let a2 = 0;
        for (const s of glints) {
          const dy = y - s.y;
          if (dy < 0) continue;
          const half = 0.1 + dy * 0.022;
          const dx = (x - s.x) / half;
          if (dx > 1.6 || dx < -1.6) continue;
          const ripple = 0.65 + 0.35 * Math.sin(y * 11 + noise(x * 2, y * 4) * 6);
          const a = Math.exp(-dx * dx * 1.6) * Math.exp(-dy / (s.z * 3.5 + 5)) * s.k * wet * ripple;
          a0 += s.c[0] * a;
          a1 += s.c[1] * a;
          a2 += s.c[2] * a;
        }
        // Las estelas que se cruzan no se suman sin fin: se saturan con suavidad
        const soft = (v) => 210 * (1 - Math.exp(-v / 210));
        r0 += soft(a0);
        g0 += soft(a1);
        b0 += soft(a2);
        c = rgb(Math.min(255, r0), Math.min(255, g0), Math.min(255, b0));
      }
      data[j * w + i] = c;
    }
  }
  return canvasFrom(w, h, data);
}

/** El agua del puerto de noche: una lámina que se repite, con destellos de las luces. */
const WATER_TILE = 2;
function paintWater() {
  const r = probe();
  const water = r.rampOf(WATER);
  const n = WATER_TILE * GROUND_PX;
  const data = new Uint32Array(n * n);
  for (let j = 0; j < n; j += 1)
    for (let i = 0; i < n; i += 1) {
      const u = (2 * Math.PI * i) / n;
      const v = (2 * Math.PI * j) / n;
      const ripple = Math.sin(u + v * 3 + Math.sin(v * 2 + u) * 1.6);
      data[j * n + i] = ripple > 0.9 ? rgb(214, 170, 120) : water[ripple > 0.5 ? 3 : ripple < -0.55 ? 1 : 2];
    }
  return canvasFrom(n, n, data);
}

/** El cielo de noche del 2D: degradado, estrellas y la ciudad al fondo con sus ventanas. */
function paintSky() {
  const w = 2048;
  const h = 768;
  const data = new Uint32Array(w * h);
  const r = probe();
  const sky = [
    [128, 70, 118],
    [64, 42, 100],
    [26, 24, 66],
    [10, 12, 34],
  ];
  for (let j = 0; j < h; j += 1) {
    const hgt = SKY_H - ((j + 0.5) / h) * (SKY_H + 5) - 5;
    const elev = (Math.atan2(hgt - EYE_Z, SKY_R) * 180) / Math.PI;
    for (let i = 0; i < w; i += 1) {
      const block = Math.floor(i / 9);
      const ridge = 0.6 + noise(i * 0.02, 1) * 2 + (hash(block, 3) > 0.55 ? 1.5 + hash(block, 5) * 5 : 0);
      let c;
      if (elev < ridge) {
        const lit = hash(Math.floor(i / 2), Math.floor(j / 2)) > 0.88 && i % 2 === 0 && j % 2 === 0 && elev > -0.6;
        c = lit ? rgb(255, 210, 140) : rgb(30 + (ridge - elev) * 4, 26, 56);
      } else {
        const band = clamp(elev / 50, 0, 1) * (sky.length - 1);
        const k = clamp(Math.floor(band + (r.bayerAt(i, j) - 0.5) * 0.7), 0, sky.length - 2);
        const m = clamp(band - k, 0, 1);
        const a = sky[k];
        const b = sky[k + 1];
        const star = elev > 12 && hash(i, j) > 0.993;
        c = star ? rgb(250, 240, 220) : rgb(a[0] + (b[0] - a[0]) * m, a[1] + (b[1] - a[1]) * m, a[2] + (b[2] - a[2]) * m);
      }
      data[j * w + i] = c;
    }
  }
  return canvasFrom(w, h, data);
}

/** La luna, en un lienzo con transparencia. */
function paintMoon() {
  const n = 48;
  const data = new Uint32Array(n * n);
  for (let j = 0; j < n; j += 1)
    for (let i = 0; i < n; i += 1) {
      const d = Math.hypot(i - n / 2 + 0.5, j - n / 2 + 0.5);
      if (d < 15) data[j * n + i] = noise(i * 0.4, j * 0.4) > 0.62 ? rgb(220, 210, 190) : rgb(250, 242, 220);
      else if (d < 22) {
        const a = Math.round((1 - (d - 15) / 7) * 70);
        data[j * n + i] = ((a << 24) | (200 << 16) | (220 << 8) | 240) >>> 0;
      }
    }
  return canvasFrom(n, n, data);
}

let cached = null;
function hotelOf() {
  if (cached) return cached;
  const { rec, lights } = recordHotel();
  const built = buildMesh(rec.boxes, EYES, (box, f, w, h) => paintFace(box, f, w, h, lights));
  cached = { ...built, groundCanvas: paintGround(rec.shadows, lights), waterCanvas: paintWater(), skyCanvas: paintSky(), moonCanvas: paintMoon() };
  return cached;
}

/** Monta la plaza del hotel en `container`. Las opciones, las de mountExterior (exterior3d.js). */
// Un punto de luz redondo (la baliza de la aguja, los destellos): blanco en el centro, que se apaga hacia el borde
function glowCanvas() {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  return c;
}

export function mountHotel3d(container, opts = {}) {
  const beams = [];
  let beacon = null;
  return mountExterior(
    container,
    {
      eye: { z: EYE_Z },
      spots: SPOTS,
      yawMax: 0.55,
      pitchDown: 0.5,
      clear: [10, 12, 34],
      className: 'calle-canvas hotel3d-canvas',
      label: 'El Gran Hotel del Puerto desde la plaza del muelle, de noche. Arrastra o usa las flechas para mirar.',
      sky: () => hotelOf().skyCanvas,
      // La vista de siempre: la aguja justo dentro por arriba, sin perder la puerta por abajo (en apaisado no cabe todo: se
      // mira hacia arriba arrastrando)
      homePitch: (fov) => {
        const spire = Math.atan2(SPIRE - EYE_Z, SPOTS.home.y - TD) - fov / 2 + 0.05;
        const door = -Math.atan2(EYE_Z, SPOTS.home.y - TD) + fov / 2 - 0.1;
        return clamp(Math.min(spire, door), 0, 0.75);
      },
      pitchUp: 0.5,
      // Lo que brilla (ventanas encendidas, neón, farolas, la aguja) suelta un halo; lo apagado no
      bloom: { strength: 0.85, radius: 0.35, threshold: 0.55 },
      // Los focos barren el cielo despacio, cada uno a su ritmo, y la baliza de la aguja late
      tick(now) {
        const t = now / 1000;
        beams.forEach((b, i) => {
          b.rotation.z = b.userData.tilt + 0.28 * Math.sin(t * (0.23 + i * 0.07) + i * 2.1);
          b.rotation.x = -0.12 + 0.08 * Math.sin(t * 0.17 + i);
        });
        if (beacon) {
          const pulse = Math.max(0, Math.sin(t * 2.4));
          beacon.material.opacity = 0.15 + 0.85 * pulse * pulse;
          beacon.scale.setScalar(0.8 + 0.5 * pulse);
        }
        return true;
      },
      build(scene, own) {
        const hotel = hotelOf();
        scene.add(meshOf(hotel, own));
        const ground = new Mesh(own(new PlaneGeometry(GROUND.x1 - GROUND.x0, GROUND.y1 - GROUND.y0)), own(new MeshBasicMaterial({ map: own(texture(hotel.groundCanvas)) })));
        ground.rotation.x = -Math.PI / 2;
        ground.position.set((GROUND.x0 + GROUND.x1) / 2, 0, (GROUND.y0 + GROUND.y1) / 2);
        scene.add(ground);
        const waterTex = own(texture(hotel.waterCanvas));
        waterTex.wrapS = RepeatWrapping;
        waterTex.wrapT = RepeatWrapping;
        const W = { x0: -120, x1: 130, y0: GROUND.y1 - 0.02, y1: GROUND.y1 + 140 };
        waterTex.repeat.set((W.x1 - W.x0) / WATER_TILE, (W.y1 - W.y0) / WATER_TILE);
        const sea = new Mesh(own(new PlaneGeometry(W.x1 - W.x0, W.y1 - W.y0)), own(new MeshBasicMaterial({ map: waterTex })));
        sea.rotation.x = -Math.PI / 2;
        sea.position.set((W.x0 + W.x1) / 2, -0.02, (W.y0 + W.y1) / 2);
        scene.add(sea);
        // Lo que se pinta sobre el cielo: la luna (arriba a la izquierda de la torre) y los dos focos de la corona
        const moon = new Mesh(own(new PlaneGeometry(7, 7)), own(new MeshBasicMaterial({ map: own(texture(hotel.moonCanvas)), transparent: true, depthWrite: false })));
        moon.position.set(-22, 46, -40);
        moon.lookAt(SPOTS.home.x, 30, SPOTS.home.y);
        moon.renderOrder = 0;
        scene.add(moon);
        const crown = [5, 29 + U, 3];
        // Cada foco, un abanico estrecho que se abre hacia arriba y se desvanece (sumando luz al cielo)
        const fan = own(new BufferGeometry());
        fan.setAttribute('position', new Float32BufferAttribute([-0.12, 0, 0, 0.12, 0, 0, 2.6, 140, 0, -2.6, 140, 0], 3));
        fan.setAttribute('color', new Float32BufferAttribute([0.3, 0.26, 0.18, 0.3, 0.26, 0.18, 0, 0, 0, 0, 0, 0], 3));
        fan.setIndex([0, 1, 2, 0, 2, 3]);
        const beamMat = own(new MeshBasicMaterial({ vertexColors: true, transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }));
        for (const tilt of [-0.22, 0.18]) {
          const beam = new Mesh(fan, beamMat);
          beam.position.set(crown[0], crown[1], crown[2]);
          beam.rotation.set(-0.12, 0, tilt);
          beam.userData.tilt = tilt;
          beams.push(beam);
          scene.add(beam);
        }
        // La baliza roja de lo alto de la aguja (se ve desde la plaza y suelta su halo)
        beacon = new Mesh(
          own(new PlaneGeometry(1.4, 1.4)),
          own(new MeshBasicMaterial({ map: own(texture(glowCanvas())), color: 0xff5040, transparent: true, blending: AdditiveBlending, depthWrite: false })),
        );
        beacon.position.set(5, SPIRE + 0.2, 2.9);
        beacon.lookAt(SPOTS.home.x, EYE_Z, SPOTS.home.y);
        scene.add(beacon);
        return { faces: hotel.faces, atlas: hotel.atlas };
      },
    },
    opts,
  );
}
