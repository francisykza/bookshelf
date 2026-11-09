// La recepción del Gran Hotel en primera persona (encargo de Francisco del 9-11-2026). El mismo modo de hacer que el piso
// (`pisoLab/interior3d.js`): Three.js a 320 px de ancho y ampliado sin suavizar, texturas de píxel pintadas una vez con las
// rampas y el tramado del dibujo isométrico, y la luz ya pintada en ellas (de noche: apliques y lámpara de araña). Las
// medidas salen de `lobbyLayout.js`, las mismas del vestíbulo isométrico (`lobbyArt.js`).
// Bloque 1: la sala (suelo de mármol, estuco con pilastras, zócalo, cornisa, techo artesonado, ventanales al puerto, la
// entrada, los apliques y la lámpara de araña) y tu vista: de pie, recién entrado, en la esquina por la que mira el dibujo
// isométrico. Solo se dibuja cuando algo cambia.
import { BoxGeometry, BufferGeometry, CanvasTexture, Color, Float32BufferAttribute, Mesh, MeshBasicMaterial, NearestFilter, PerspectiveCamera, PlaneGeometry, Raycaster, SRGBColorSpace, Scene, Vector2, Vector3, WebGLRenderer } from 'three';
import { createRaster, hash, noise, rgb } from '../../minigames/libreria-puerto/raster';
import { APLIQUES, ASCENSOR, CARRITO, CORNISA, CREAM, DARK, DIVAN, FILETE, GOLD, GOLD_D, GUARDARROPA, HUESPED, LAMP, MARBLE, MARBLE_D, PILASTRA, PILASTRA_W, RECEPCION, RED, SD, SW, TABLON, VELVET, WALNUT, WALNUT_L, WH, ZOCALO } from './lobbyLayout';

const ART_W = 320;
/** Ojos de una persona de pie (la huésped del dibujo mide 2,2 con el sombrero). */
export const EYE = 2.1;
/** Dónde estás: recién entrado, junto a la puerta, en la esquina desde la que mira el dibujo isométrico. */
export const HOME = { x: 9.7, y: 7.25 };
/** Hacia dónde miras al entrar: la recepción a la izquierda y el ascensor a la derecha. */
const LOOK = { x: 6.0, y: 1.0 };
const PITCH = -0.02;
/** Campo de visión horizontal en vertical (móvil), y vertical en apaisado. Tope vertical para no deformar. */
const HFOV = 54;
const VFOV_LANDSCAPE = 60;
const VFOV_MAX = 90;
/** Lo que se alcanza girando: del guardarropa (izquierda) al carrito junto al ascensor (derecha), con este margen. */
const REACH = [
  [0.2, 5.6],
  [9.55, 2.2],
];
const REACH_INSET = 0.2;
const PX = 32; // píxeles de textura por celda, como el suelo del piso
const DRAG = 0.004;
const KEY_STEP = 0.08;

const linear = ([r, g, b]) => new Color().setRGB(r / 255, g / 255, b / 255, SRGBColorSpace);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

// Solo se usa por sus rampas de tonos y su tramado: no dibuja nada
let probeRaster = null;
const probe = () => (probeRaster ??= createRaster({ W: 2, H: 2, S: 1, yaw: 0, ox: 0, oy: 0 }));
const unpack = (p) => [p & 255, (p >> 8) & 255, (p >> 16) & 255];

// ── La cabina del ascensor, detrás de sus puertas (mundo de la app: y < 0, al otro lado de la pared del fondo) ──
// El hueco de las puertas, la cabina (un poco más ancha que el hueco) y la placa de la botonera en su pared derecha.
const HUECO = { x0: ASCENSOR.x0 + 0.18, x1: ASCENSOR.x1 - 0.18, h: 2.85 };
const CAB = { x0: ASCENSOR.x0 - 0.1, x1: ASCENSOR.x1 + 0.1, y0: -2.3, y1: -0.06, h: 3.0 };
CAB.xm = (CAB.x0 + CAB.x1) / 2;
CAB.ym = (CAB.y0 + CAB.y1) / 2;
/** La placa de latón de la botonera, en la pared derecha de la cabina: [y0, y1] a lo largo y [z0, z1] de alto. */
const PLACA = { y0: CAB.ym - 0.5, y1: CAB.ym + 0.5, z0: 0.98, z1: 2.14, x: CAB.x1 - 0.07 };

// ── La luz, pintada: apliques de pared y la lámpara de araña sobre el diván ──
const LUCES = [
  ...APLIQUES.fondo.map((x) => ({ at: [x, 0.3, APLIQUES.z], k: 0.6, reach: 3.0 })),
  ...APLIQUES.izq.map((y) => ({ at: [0.3, y, APLIQUES.z], k: 0.6, reach: 3.0 })),
  { at: [DIVAN.x, DIVAN.y, 3.4], k: 0.95, reach: 6.8 },
  // El flexo verde de la recepción, pequeño
  { at: [1.6, 1.3, 1.5], k: 0.35, reach: 1.6 },
  // Dentro de la cabina del ascensor (detrás de la pared del fondo, y < 0): su plafón y el brillo de la botonera
  { at: [CAB.xm, CAB.ym, CAB.h - 0.15], k: 1.0, reach: 2.7, inside: true },
  { at: [CAB.x1 - 0.1, CAB.ym, 1.6], k: 0.3, reach: 1.2, inside: true },
];
function glowAt(x, y, z) {
  let g = 0;
  const inside = y < -0.02;
  for (const { at, k, reach, inside: own = false } of LUCES) {
    if (own !== inside) continue;
    const d = Math.hypot(x - at[0], y - at[1], (z - at[2]) * 1.1) / reach;
    if (d < 1) g += k * (1 - d) ** 1.6;
  }
  return Math.min(1, g);
}
/** De noche lejos de la luz (malva frío) a la calidez junto a ella. Por bandas; el tramado solo cubre el paso. */
const FAR = [0.8, 0.74, 0.8];
const NEAR = [1.1, 1.0, 0.84];
const BANDS = 6;
function lit(c, g, ix, iy) {
  const r = probe();
  const band = clamp(Math.floor(g * BANDS + 0.5 + (r.bayerAt(ix, iy) - 0.5) * 0.35), 0, BANDS) / BANDS;
  const [cr, cg, cb] = typeof c === 'number' ? unpack(c) : c;
  return rgb(cr * lerp(FAR[0], NEAR[0], band), cg * lerp(FAR[1], NEAR[1], band), cb * lerp(FAR[2], NEAR[2], band));
}
/** El mismo cálculo para un color de vértice (una cara entera): sin tramado. */
function litColor(c, g, tone) {
  const band = Math.round(g * BANDS) / BANDS;
  return linear([0, 1, 2].map((i) => clamp(c[i] * tone * lerp(FAR[i], NEAR[i], band), 0, 255)));
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

// ── El suelo: mármol crema y verde en damero, con vetas, el filete dorado y la alfombra roja hasta el ascensor ──
function paintFloor() {
  const r = probe();
  const light = r.rampOf(MARBLE);
  const dark = r.rampOf(MARBLE_D);
  const gold = r.rampOf(GOLD);
  const ax0 = ASCENSOR.x0 + 0.25;
  const ax1 = ASCENSOR.x1 - 0.25;
  return canvasOf(SW * PX, SD * PX, (ix, iy) => {
    const x = (ix + 0.5) / PX;
    const y = (iy + 0.5) / PX;
    let c;
    if (x > ax0 && x < ax1 && y > 0.25 && y < SD - 0.6) {
      const e = Math.min(x - ax0, ax1 - x, y - 0.25);
      c = e < 0.06 ? unpack(gold[3]) : e < 0.12 ? [110, 26, 34] : (y * 2.2) % 1 < 0.06 ? [176, 64, 60] : RED;
    } else {
      const edge = Math.min(x, y, SW - x, SD - y);
      if (edge > 0.42 && edge < 0.5) c = unpack(gold[3]);
      else {
        const ramp = (Math.floor(x) + Math.floor(y)) % 2 ? dark : light;
        const vein = Math.abs(noise(x * 2.2 + y * 0.8, y * 2.2) - 0.5) < 0.025;
        const seam = x % 1 < 0.035 || y % 1 < 0.035;
        const d = (r.bayerAt(ix, iy) - 0.5) * 0.4;
        c = ramp[clamp(Math.floor(3 + (noise(x * 3, y * 3) - 0.5) * 0.6 + d - (seam ? 1 : 0) - (vein ? 1 : 0)), 0, 4)];
      }
    }
    // El mármol brilla bajo la araña: un tono más de luz en un círculo tramado
    const shine = Math.hypot(x - DIVAN.x, y - DIVAN.y) < 2.4 + (r.bayerAt(ix, iy) - 0.5) * 0.3 ? 0.12 : 0;
    return lit(c, Math.min(1, glowAt(x, y, 0) + shine), ix, iy);
  });
}

// ── Las paredes: estuco crema, zócalo de nogal con sus paneles, y en cada una lo suyo ──
/** Una pared de `w` celdas: `a` a lo largo de ella, `b` en altura. `extra(a, b)` pinta lo propio de esa pared (o null). */
function paintWall(w, world, extra = () => null) {
  const r = probe();
  const plaster = r.rampOf(CREAM);
  const walnut = r.rampOf(WALNUT);
  const gold = r.rampOf(GOLD);
  const h = Math.round(WH * PX);
  return canvasOf(w * PX, h, (ix, iy) => {
    const a = (ix + 0.5) / PX;
    const b = WH - (iy + 0.5) / PX;
    const own = extra(a, b, ix, iy);
    if (own != null) return own;
    let c;
    if (b < ZOCALO) {
      const panel = a % 1.1;
      const inset = Math.max(Math.abs(panel - 0.55) / 0.42, Math.abs(b - 0.58) / 0.32);
      c = walnut[Math.abs(panel - 0.55) > 0.5 ? 1 : b > ZOCALO - 0.1 || b < 0.16 ? 4 : inset > 1.1 ? 3 : inset > 1 ? 1 : 2];
    } else if (b < FILETE) c = gold[3];
    else {
      const n = noise(a * 2.4 + 5 + w, b * 2.4);
      const k = r.bayerAt(ix, iy);
      c = plaster[n > 0.74 && k > 0.6 ? 4 : 3];
      // Sombra en las esquinas y bajo la cornisa
      const corner = Math.min(a, w - a) + (k - 0.5) * 0.08;
      if (corner < 0.14 || b > WH - CORNISA - 0.16 + (k - 0.5) * 0.06) c = plaster[2];
    }
    return lit(c, glowAt(...world(a, b)), ix, iy);
  });
}

/** Lo que se ve por los ventanales y la puerta: el puerto de noche, con sus luces y el agua. */
function nightView(u, v, seed) {
  // u: 0..1 a lo ancho; v: altura en celdas desde el pie del cristal
  const horizon = 0.75;
  if (v < horizon) {
    const sparkle = hash(Math.floor(u * 40) + seed, Math.floor(v * 30)) > 0.93 && (v * 30) % 1 < 0.4;
    return sparkle ? rgb(236, 190, 110) : rgb(22 + v * 10, 30 + v * 12, 64 + v * 14);
  }
  if (v < horizon + 0.12) {
    const lamp = hash(Math.floor(u * 26) + seed * 3, 7) > 0.62;
    return lamp ? rgb(255, 214, 140) : rgb(36, 32, 54);
  }
  const t = clamp((v - horizon) / 2.4, 0, 1);
  const star = hash(Math.floor(u * 60) + seed, Math.floor(v * 40)) > 0.985;
  return star ? rgb(244, 236, 214) : rgb(lerp(70, 18, t), lerp(54, 18, t), lerp(104, 46, t));
}

/** Ventanales de medio punto en la pared de la derecha: [inicio, fin] a lo largo de ella. */
const VENTANALES = [
  [1.5, 3.1],
  [4.6, 6.2],
];
const WIN_FOOT = 1.3;
const WIN_SPRING = 3.3;
function windowPaint(a, b, gold) {
  for (let k = 0; k < VENTANALES.length; k += 1) {
    const [w0, w1] = VENTANALES[k];
    const mid = (w0 + w1) / 2;
    const rad = (w1 - w0) / 2;
    const inArch = b < WIN_SPRING ? a > w0 && a < w1 && b > WIN_FOOT : Math.hypot(a - mid, b - WIN_SPRING) < rad;
    if (!inArch) continue;
    const edge = b < WIN_SPRING ? Math.min(a - w0, w1 - a, b - WIN_FOOT) : rad - Math.hypot(a - mid, b - WIN_SPRING);
    if (edge < 0.08) return gold[edge < 0.03 ? 1 : 3];
    // Parteluz, travesaño y los radios del arco
    if (Math.abs(a - mid) < 0.025 || Math.abs(b - 2.35) < 0.025) return gold[2];
    if (b > WIN_SPRING && Math.abs(Math.sin(Math.atan2(b - WIN_SPRING, a - mid) * 3)) < 0.06) return gold[2];
    return nightView((a - w0) / (w1 - w0), b - WIN_FOOT, k * 17);
  }
  return null;
}

/** La entrada, en la pared de enfrente: dos hojas de cristal con marco de latón y un abanico encima. */
const PUERTA = { x0: 7.0, x1: 8.8, top: 3.0 };
function doorPaint(a, b, gold) {
  const { x0, x1, top } = PUERTA;
  if (a < x0 || a > x1 || b > top + 0.75) return null;
  const mid = (x0 + x1) / 2;
  if (b > top) {
    const d = Math.hypot(a - mid, b - top);
    if (d > (x1 - x0) / 2) return null;
    if (d > (x1 - x0) / 2 - 0.07 || b - top < 0.06) return gold[3];
    return Math.abs(Math.sin(Math.atan2(b - top, a - mid) * 5)) < 0.12 ? gold[2] : nightView((a - x0) / (x1 - x0), 2 + b - top, 5);
  }
  const edge = Math.min(a - x0, x1 - a, top - b);
  if (edge < 0.1 || Math.abs(a - mid) < 0.04) return gold[edge < 0.04 ? 1 : 3];
  if (Math.abs(b - 1.05) < 0.05) return gold[4]; // tirador de barra
  return nightView((a - x0) / (x1 - x0), b, 9);
}

// ── El techo: artesonado crema con filetes dorados y el medallón de la araña ──
function paintCeiling() {
  const r = probe();
  const plaster = r.rampOf(CREAM);
  const gold = r.rampOf(GOLD);
  return canvasOf(SW * PX, SD * PX, (ix, iy) => {
    const x = (ix + 0.5) / PX;
    const y = SD - (iy + 0.5) / PX;
    let c;
    const md = Math.hypot(x - DIVAN.x, y - DIVAN.y);
    if (md < 1.25) c = md > 1.15 || Math.abs(md - 0.7) < 0.05 ? gold[3] : plaster[md < 0.7 ? 4 : 3];
    else {
      const bx = x % PILASTRA;
      const by = y % 2;
      const beam = bx < 0.24 || by < 0.24;
      const inset = bx < 0.36 || by < 0.36;
      c = beam ? ((bx < 0.24 && (bx < 0.03 || bx > 0.21)) || (by < 0.24 && (by < 0.03 || by > 0.21)) ? gold[2] : plaster[3]) : inset ? gold[3] : plaster[4];
    }
    return lit(c, glowAt(x, y, WH), ix, iy);
  });
}

// ── Las cajas: pilastras, zócalo, cornisa, apliques y la araña. Mundo de la app (x, y a lo hondo, z arriba) → Three (x, z, y) ──
const FACE_TONE = { top: 1.06, bottom: 0.6, front: 0.92, back: 0.74, right: 0.84, left: 0.8 };
function pushBox(out, [x0, y0, z0, x1, y1, z1], color, glow = false) {
  const g = glow ? 0 : glowAt((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  const faces = [
    ['front', [[x0, z0, y1], [x1, z0, y1], [x1, z1, y1], [x0, z1, y1]], [0, 0, 1]],
    ['back', [[x1, z0, y0], [x0, z0, y0], [x0, z1, y0], [x1, z1, y0]], [0, 0, -1]],
    ['right', [[x1, z0, y1], [x1, z0, y0], [x1, z1, y0], [x1, z1, y1]], [1, 0, 0]],
    ['left', [[x0, z0, y0], [x0, z0, y1], [x0, z1, y1], [x0, z1, y0]], [-1, 0, 0]],
    ['top', [[x0, z1, y1], [x1, z1, y1], [x1, z1, y0], [x0, z1, y0]], [0, 1, 0]],
    ['bottom', [[x0, z0, y0], [x1, z0, y0], [x1, z0, y1], [x0, z0, y1]], [0, -1, 0]],
  ];
  for (const [name, [a, b, c, d], n] of faces) {
    const col = glow ? linear(color) : litColor(color, g, FACE_TONE[name]);
    for (const p of [a, b, c, a, c, d]) {
      out.pos.push(...p);
      out.nor.push(...n);
      out.col.push(col.r, col.g, col.b);
    }
  }
}

function buildBoxes() {
  const solid = { pos: [], nor: [], col: [] };
  const glow = { pos: [], nor: [], col: [] };
  const gold = GOLD;
  const goldDark = GOLD_D;
  // Cada pared como un tramo a lo largo de ella: [eje, posición fija, desde dónde se separa, largo]
  const walls = [
    { along: 'x', at: 0, inward: 1, length: SW, skip: [[ASCENSOR.x0 - 0.25, ASCENSOR.x1 + 0.25]], bare: [[1.1, 4.8]] },
    { along: 'y', at: 0, inward: 1, length: SD, skip: [], bare: [[TABLON.y0 - 0.1, TABLON.y1 + 0.1], [GUARDARROPA.y0 - 0.1, GUARDARROPA.y1 + 0.1]] },
    { along: 'y', at: SW, inward: -1, length: SD, skip: VENTANALES.map(([a, b]) => [a - 0.2, b + 0.2]) },
    { along: 'x', at: SD, inward: -1, length: SW, skip: [[PUERTA.x0 - 0.2, PUERTA.x1 + 0.2]] },
  ];
  const strip = (wall, s0, s1, z0, z1, depth, color, out = solid) => {
    const d0 = wall.at;
    const d1 = wall.at + wall.inward * depth;
    const [n0, n1] = [Math.min(d0, d1), Math.max(d0, d1)];
    pushBox(out, wall.along === 'x' ? [s0, n0, z0, s1, n1, z1] : [n0, s0, z0, n1, s1, z1], color, out === glow);
  };
  const free = (wall, s0, s1) => {
    const runs = [];
    let from = s0;
    for (const [k0, k1] of wall.skip) {
      if (k0 > from) runs.push([from, Math.min(k0, s1)]);
      from = Math.max(from, k1);
    }
    if (from < s1) runs.push([from, s1]);
    return runs;
  };
  for (const wall of walls) {
    // Rodapié oscuro y el filete dorado sobre el zócalo (se corta en la puerta)
    for (const [s0, s1] of free(wall, 0, wall.length)) {
      strip(wall, s0, s1, 0, 0.12, 0.05, [70, 44, 32]);
      strip(wall, s0, s1, ZOCALO, FILETE, 0.06, gold);
    }
    // Cornisa en dos escalones, entera
    strip(wall, 0, wall.length, WH - CORNISA, WH, 0.14, gold);
    strip(wall, 0, wall.length, WH - CORNISA - 0.08, WH - CORNISA, 0.07, goldDark);
    // Pilastras con su basa y su capitel, donde no hay hueco
    for (let s = 0; s <= wall.length - PILASTRA_W + 0.01; s += PILASTRA) {
      const s0 = s;
      const s1 = s + PILASTRA_W;
      if ([...wall.skip, ...(wall.bare ?? [])].some(([k0, k1]) => s1 > k0 && s0 < k1)) continue;
      strip(wall, s0, s1, FILETE, WH - CORNISA - 0.08, 0.07, gold);
      strip(wall, s0 - 0.05, s1 + 0.05, FILETE, FILETE + 0.14, 0.1, goldDark);
      strip(wall, s0 - 0.06, s1 + 0.06, WH - CORNISA - 0.24, WH - CORNISA - 0.08, 0.11, gold);
    }
  }
  // Apliques: abanico de latón con su luz
  for (const x of APLIQUES.fondo) {
    pushBox(solid, [x - 0.22, 0, APLIQUES.z - 0.15, x + 0.22, 0.12, APLIQUES.z + 0.2], gold);
    pushBox(glow, [x - 0.16, 0.02, APLIQUES.z - 0.08, x + 0.16, 0.16, APLIQUES.z + 0.14], LAMP, true);
  }
  for (const y of APLIQUES.izq) {
    pushBox(solid, [0, y - 0.2, APLIQUES.z - 0.15, 0.12, y + 0.2, APLIQUES.z + 0.2], gold);
    pushBox(glow, [0.02, y - 0.15, APLIQUES.z - 0.08, 0.16, y + 0.15, APLIQUES.z + 0.14], LAMP, true);
  }
  // Alféizar de mármol de los ventanales
  for (const [a, b] of VENTANALES) pushBox(solid, [SW - 0.16, a - 0.08, WIN_FOOT - 0.1, SW, b + 0.08, WIN_FOOT], MARBLE);
  // La lámpara de araña, sobre el diván: vástago, aro, cuerpo de luz y cuatro velas
  const { x: cx, y: cy } = DIVAN;
  pushBox(solid, [cx - 0.03, cy - 0.03, 3.85, cx + 0.03, cy + 0.03, WH], goldDark);
  pushBox(solid, [cx - 0.55, cy - 0.55, 3.62, cx + 0.55, cy + 0.55, 3.72], gold);
  pushBox(glow, [cx - 0.4, cy - 0.4, 3.45, cx + 0.4, cy + 0.4, 3.62], LAMP, true);
  pushBox(glow, [cx - 0.2, cy - 0.2, 3.72, cx + 0.2, cy + 0.2, 3.92], LAMP, true);
  for (const [dx, dy] of [
    [-0.55, 0],
    [0.55, 0],
    [0, -0.55],
    [0, 0.55],
  ]) {
    pushBox(solid, [cx + dx - 0.08, cy + dy - 0.08, 3.26, cx + dx + 0.08, cy + dy + 0.08, 3.32], gold);
    pushBox(glow, [cx + dx - 0.05, cy + dy - 0.05, 3.32, cx + dx + 0.05, cy + dy + 0.05, 3.58], [255, 240, 200], true);
  }
  // Cristales colgando del aro, en dos alturas
  for (let k = 0; k < 12; k += 1) {
    const a = (k / 12) * Math.PI * 2;
    const px = cx + Math.cos(a) * 0.5;
    const py = cy + Math.sin(a) * 0.5;
    const drop = k % 2 ? 0.26 : 0.16;
    pushBox(solid, [px - 0.012, py - 0.012, 3.62 - drop, px + 0.012, py + 0.012, 3.62], GOLD_D);
    pushBox(glow, [px - 0.035, py - 0.035, 3.62 - drop - 0.08, px + 0.035, py + 0.035, 3.62 - drop], [255, 246, 222], true);
  }
  return { solid, glow };
}

// ── Bloque 2: los muebles y las personas, los mismos del dibujo isométrico (lobbyArt.js) y en el mismo sitio ──
// Las cajas llevan su color con la luz del sitio; lo que en el dibujo es un dibujo sobre una cara (las puertas del ascensor,
// los casilleros, las notas del tablón, los abrigos, las caras) va en una calcomanía pegada a esa cara.
// Cara de una calcomanía, por hacia dónde mira: '+y' (hacia la entrada), '+x' (desde la pared izquierda), '-x'.
const DECAL_PX = 48;

/** Pinta una calcomanía: `paint(s, z)` en coordenadas del mundo (s a lo largo de la cara), o 0 si allí no hay nada. */
function paintDecal({ normal, s: [s0, s1], z: [z0, z1], at, paint, glow = false, px = DECAL_PX }) {
  const w = s1 - s0;
  const h = z1 - z0;
  const W = Math.max(1, Math.round(w * px));
  const H = Math.max(1, Math.round(h * px));
  const rising = normal === '+y' || normal === '-x';
  const canvas = canvasOf(W, H, (ix, iy) => {
    const t = (ix + 0.5) / W;
    const s = rising ? s0 + t * w : s1 - t * w;
    const z = z1 - ((iy + 0.5) / H) * h;
    const c = paint(s, z, ix, iy);
    if (!c) return 0;
    if (glow) return c;
    return lit(c, glowAt(...(normal.endsWith('y') ? [s, at, z] : [at, s, z])), ix, iy);
  });
  return { canvas, w, h };
}
function placeDecal(mesh, { normal, s: [s0, s1], z: [z0, z1], at }) {
  const sm = (s0 + s1) / 2;
  const zm = (z0 + z1) / 2;
  if (normal === '+y') mesh.position.set(sm, zm, at);
  else if (normal === '-y') {
    mesh.rotation.y = Math.PI;
    mesh.position.set(sm, zm, at);
  } else if (normal === '+x') {
    mesh.rotation.y = Math.PI / 2;
    mesh.position.set(at, zm, sm);
  } else {
    mesh.rotation.y = -Math.PI / 2;
    mesh.position.set(at, zm, sm);
  }
}

function furnish() {
  const r = probe();
  const solid = { pos: [], nor: [], col: [] };
  const glow = { pos: [], nor: [], col: [] };
  const decals = [];
  const box = (x0, y0, z0, x1, y1, z1, c) => pushBox(solid, [x0, y0, z0, x1, y1, z1], c);
  const light = (x0, y0, z0, x1, y1, z1, c) => pushBox(glow, [x0, y0, z0, x1, y1, z1], c, true);
  const decal = (d) => decals.push(d);
  const gold = r.rampOf(GOLD);
  const walnut = r.rampOf(WALNUT);
  const marbleD = r.rampOf(MARBLE_D);
  const C = (c) => rgb(...c);
  const SKIN = [236, 196, 160];
  const SKIN_D = [176, 124, 92];
  const UNI = [120, 34, 44];
  const LEAF = [70, 120, 80];

  // ── El ascensor: marco de mármol oscuro, puertas de latón con abanico déco, la esfera de plantas y el botón ──
  const { x0: EX0, x1: EX1 } = ASCENSOR;
  const EM = (EX0 + EX1) / 2;
  box(EX0 - 0.1, 0, 0, HUECO.x0, 0.12, 3.12, MARBLE_D);
  box(HUECO.x1, 0, 0, EX1 + 0.1, 0.12, 3.12, MARBLE_D);
  box(HUECO.x0, 0, HUECO.h, HUECO.x1, 0.12, 3.12, MARBLE_D);
  // El umbral de latón, y el fondo del hueco hasta la cabina
  box(HUECO.x0, -0.08, 0, HUECO.x1, 0.12, 0.015, GOLD_D);
  box(HUECO.x0 - 0.02, -0.08, 0, HUECO.x0, 0.0, HUECO.h, [56, 40, 30]);
  box(HUECO.x1, -0.08, 0, HUECO.x1 + 0.02, 0.0, HUECO.h, [56, 40, 30]);
  box(HUECO.x0, -0.08, HUECO.h - 0.02, HUECO.x1, 0.0, HUECO.h, [56, 40, 30]);
  decal({
    normal: '+y',
    s: [EX0 - 0.1, EX1 + 0.1],
    z: [0, 3.12],
    at: 0.125,
    paint: (a, b) => {
      if (a < HUECO.x0 || a > HUECO.x1 || b > HUECO.h) {
        // El marco: mármol oscuro con vetas claras
        const vein = Math.abs(noise(a * 3 + b * 1.4, b * 3) - 0.5) < 0.03;
        return marbleD[vein ? 4 : noise(a * 6, b * 6) > 0.6 ? 3 : 2];
      }
      return 0;
    },
  });
  box(EX0 - 0.2, 0, 3.12, EX1 + 0.2, 0.16, 3.26, GOLD);
  // La esfera: semicírculo de latón con una marca por planta y la aguja en el vestíbulo
  const DZ = 3.36;
  box(EM - 0.62, 0, 3.26, EM + 0.62, 0.06, 3.98, GOLD_D);
  decal({
    normal: '+y',
    s: [EM - 0.62, EM + 0.62],
    z: [3.26, 3.98],
    at: 0.065,
    px: 96,
    paint: (a, b) => {
      const dx = a - EM;
      const dz = b - DZ;
      const d = Math.hypot(dx, dz * 1.05);
      if (d > 0.6) return gold[1];
      if (d > 0.54) return gold[3];
      const ang = Math.atan2(dz, dx);
      const mark = ((Math.PI - ang) / Math.PI) * 9;
      if (d > 0.4 && Math.abs(mark - Math.round(mark)) < 0.09) return rgb(70, 46, 26);
      const needle = Math.PI - (1 / 9) * Math.PI;
      if (d < 0.46 && Math.abs(Math.sin(ang - needle)) * d < 0.025 && Math.cos(ang - needle) > 0) return rgb(150, 40, 46);
      if (d < 0.07) return rgb(70, 46, 26);
      return rgb(246, 232, 196);
    },
  });
  box(EX1 + 0.32, 0, 1.25, EX1 + 0.52, 0.08, 1.6, GOLD);
  light(EX1 + 0.37, 0.06, 1.38, EX1 + 0.47, 0.11, 1.48, [255, 200, 120]);

  // ── La recepción: el casillero de llaves, de verdad hueco, el conserje y el mostrador de nogal y mármol ──
  // El casillero es un mueble con fondo: diez columnas por cinco filas de huecos con su balda y su separador, llaves de
  // latón colgadas con su borla y cartas apoyadas, sobre un aparador de cajones y con su copete de latón.
  const K = { x0: 1.3, x1: 4.6, z0: 1.55, z1: 3.45, depth: 0.34, cols: 10, rows: 5 };
  const cw = (K.x1 - K.x0) / K.cols;
  const rh = (K.z1 - K.z0) / K.rows;
  const T = 0.035; // grosor de baldas y separadores
  // El fondo de los huecos, oscuro, y los costados del mueble
  box(K.x0, 0, K.z0, K.x1, 0.05, K.z1, [56, 34, 26]);
  box(K.x0 - 0.1, 0, K.z0 - 0.05, K.x0, K.depth + 0.02, K.z1 + 0.05, WALNUT_L);
  box(K.x1, 0, K.z0 - 0.05, K.x1 + 0.1, K.depth + 0.02, K.z1 + 0.05, WALNUT_L);
  for (let c = 1; c < K.cols; c += 1) box(K.x0 + c * cw - T / 2, 0.05, K.z0, K.x0 + c * cw + T / 2, K.depth, K.z1, WALNUT);
  for (let w = 0; w <= K.rows; w += 1) box(K.x0, 0.05, K.z0 + w * rh - T / 2, K.x1, K.depth, K.z0 + w * rh + T / 2, WALNUT_L);
  for (let c = 0; c < K.cols; c += 1) {
    for (let w = 0; w < K.rows; w += 1) {
      const k = hash(c, w);
      const mx = K.x0 + (c + 0.5) * cw;
      const floorZ = K.z0 + w * rh + T / 2;
      // Plaquita de latón con el número del hueco, en el canto de la balda
      box(mx - 0.05, K.depth, floorZ - T / 2 - 0.005, mx + 0.05, K.depth + 0.01, floorZ + 0.012, GOLD);
      if (k > 0.55) {
        // La llave colgada del gancho, con su borla granate
        const topZ = K.z0 + (w + 1) * rh - T / 2;
        box(mx - 0.008, 0.12, topZ - 0.08, mx + 0.008, 0.14, topZ, GOLD_D);
        box(mx - 0.025, 0.11, topZ - 0.16, mx + 0.025, 0.15, topZ - 0.08, GOLD);
        box(mx - 0.035, 0.11, topZ - 0.25, mx + 0.035, 0.15, topZ - 0.16, RED);
      } else if (k < 0.2) {
        // Una carta apoyada en el fondo
        box(mx - 0.1, 0.06, floorZ, mx + 0.1, 0.09, floorZ + 0.22, [244, 236, 214]);
        box(mx - 0.02, 0.09, floorZ + 0.08, mx + 0.02, 0.095, floorZ + 0.12, RED);
      } else if (k < 0.3) {
        // Un paquete atado con cordel
        box(mx - 0.11, 0.08, floorZ, mx + 0.11, 0.26, floorZ + 0.12, [176, 132, 92]);
        box(mx - 0.11, 0.08, floorZ + 0.05, mx + 0.11, 0.265, floorZ + 0.07, [236, 220, 190]);
      }
    }
  }
  // El copete: cornisa de latón escalonada con un abanico en el centro
  box(K.x0 - 0.16, 0, K.z1 + 0.05, K.x1 + 0.16, K.depth + 0.08, K.z1 + 0.14, GOLD);
  box(K.x0 - 0.1, 0, K.z1 + 0.14, K.x1 + 0.1, K.depth + 0.02, K.z1 + 0.2, GOLD_D);
  const KM = (K.x0 + K.x1) / 2;
  // El abanico, recortado: una chapa fina de latón sobre la cornisa
  box(KM - 0.42, 0.24, K.z1 + 0.2, KM + 0.42, 0.3, K.z1 + 0.24, GOLD_D);
  decal({
    normal: '+y',
    s: [KM - 0.42, KM + 0.42],
    z: [K.z1 + 0.2, K.z1 + 0.62],
    at: 0.305,
    px: 96,
    paint: (a, b) => {
      const d = Math.hypot(a - KM, (b - K.z1 - 0.2) * 1.9);
      if (d > 0.42) return 0;
      if (d > 0.37 || d < 0.08) return gold[4];
      const ang = Math.atan2(b - K.z1 - 0.2, a - KM);
      return Math.abs(((ang / Math.PI) * 9) % 1 - 0.5) < 0.18 ? gold[2] : gold[3];
    },
  });
  // Debajo, un aparador de cajones con tiradores (asoma por encima del mostrador)
  box(K.x0 - 0.1, 0, 0, K.x1 + 0.1, 0.3, K.z0 - 0.05, WALNUT);
  for (let c = 0; c < 5; c += 1) {
    const x0 = K.x0 + c * ((K.x1 - K.x0) / 5) + 0.04;
    const x1 = K.x0 + (c + 1) * ((K.x1 - K.x0) / 5) - 0.04;
    box(x0, 0.3, 1.18, x1, 0.33, K.z0 - 0.1, WALNUT_L);
    box((x0 + x1) / 2 - 0.06, 0.33, 1.3, (x0 + x1) / 2 + 0.06, 0.36, 1.34, GOLD);
  }

  // El conserje: chaqueta granate entallada con charreteras y dos filas de botones, camisa y pajarita, gorra de plato con
  // visera y galón, patillas y bigote; las manos, apoyadas en el mostrador.
  const [cx, cy] = RECEPCION.conserje;
  const UNI_D = [92, 24, 34];
  const HAIR = [58, 40, 32];
  box(cx - 0.29, cy - 0.18, 0.75, cx + 0.29, cy + 0.18, 1.3, UNI);
  box(cx - 0.3, cy - 0.185, 1.08, cx + 0.3, cy + 0.185, 1.14, UNI_D); // cinturón de la chaqueta
  box(cx - 0.34, cy - 0.2, 1.3, cx + 0.34, cy + 0.2, 1.86, UNI);
  box(cx - 0.38, cy - 0.21, 1.78, cx + 0.38, cy + 0.21, 1.94, UNI);
  decal({
    normal: '+y',
    s: [cx - 0.34, cx + 0.34],
    z: [1.14, 1.94],
    at: cy + 0.205,
    px: 96,
    paint: (a, b) => {
      const u = a - cx;
      // Pechera blanca en pico, pajarita negra y solapas más oscuras
      const v = 1.94 - b;
      if (v < 0.36 && Math.abs(u) < 0.13 - v * 0.33) return Math.abs(u) < 0.07 && v > 0.04 && v < 0.11 ? rgb(30, 26, 30) : rgb(246, 240, 228);
      if (v < 0.5 && Math.abs(u) < 0.2 - v * 0.2 && Math.abs(u) > 0.1 - v * 0.2) return rgb(...UNI_D);
      // Dos filas de botones dorados
      for (const bx of [-0.12, 0.12]) for (let k = 0; k < 4; k += 1) if (Math.abs(u - bx) < 0.028 && Math.abs(b - 1.22 - k * 0.15) < 0.028) return gold[4];
      return 0;
    },
  });
  // Charreteras con flecos
  for (const s of [-1, 1]) {
    box(cx + s * 0.26 - 0.11, cy - 0.14, 1.94, cx + s * 0.26 + 0.11, cy + 0.14, 1.99, GOLD);
    for (let k = 0; k < 4; k += 1) box(cx + s * 0.36 - 0.015, cy - 0.12 + k * 0.08, 1.86, cx + s * 0.36 + 0.015, cy - 0.1 + k * 0.08, 1.94, GOLD_D);
  }
  // Brazos: del hombro al codo, y el antebrazo hacia delante hasta el mostrador, con su bocamanga de galón
  for (const s of [-1, 1]) {
    const ax0 = s > 0 ? cx + 0.34 : cx - 0.47;
    const ax1 = s > 0 ? cx + 0.47 : cx - 0.34;
    box(ax0, cy - 0.12, 1.36, ax1, cy + 0.12, 1.9, UNI);
    box(ax0, cy - 0.1, 1.3, ax1, cy + 0.5, 1.46, UNI);
    box(ax0 - 0.005, cy + 0.42, 1.29, ax1 + 0.005, cy + 0.5, 1.47, GOLD);
    const hx = cx + s * 0.32;
    box(hx - 0.08, cy + 0.5, 1.3, hx + 0.08, cy + 0.72, 1.4, SKIN);
    box(hx - 0.08 + (s > 0 ? -0.04 : 0.12), cy + 0.52, 1.32, hx - 0.04 + (s > 0 ? -0.04 : 0.12), cy + 0.62, 1.4, SKIN_D);
  }
  // Cuello de la camisa y cuello
  box(cx - 0.1, cy - 0.08, 1.94, cx + 0.1, cy + 0.1, 2.0, [246, 240, 228]);
  box(cx - 0.08, cy - 0.06, 2.0, cx + 0.08, cy + 0.06, 2.04, SKIN_D);
  // La cabeza, con orejas, nariz, patillas, bigote y la cara pintada
  const HX0 = cx - 0.22;
  const HX1 = cx + 0.22;
  const HZ0 = 2.03;
  const HZ1 = 2.47;
  box(HX0, cy - 0.2, HZ0, HX1, cy + 0.22, HZ1, SKIN);
  box(HX0 + 0.04, cy - 0.17, HZ0 - 0.03, HX1 - 0.04, cy + 0.18, HZ0, SKIN_D); // barbilla
  for (const s of [-1, 1]) {
    box(cx + s * 0.22 - 0.035, cy - 0.04, 2.18, cx + s * 0.22 + 0.035, cy + 0.06, 2.32, SKIN_D);
    box(cx + s * 0.2 - 0.04, cy - 0.06, 2.22, cx + s * 0.2 + 0.04, cy + 0.225, 2.42, HAIR);
  }
  box(HX0, cy - 0.21, 2.2, HX1, cy - 0.05, HZ1, HAIR); // nuca
  box(cx - 0.04, cy + 0.22, 2.2, cx + 0.04, cy + 0.29, 2.3, SKIN_D);
  box(cx - 0.14, cy + 0.22, 2.13, cx + 0.14, cy + 0.27, 2.19, HAIR);
  decal({
    normal: '+y',
    s: [HX0, HX1],
    z: [HZ0, HZ1],
    at: cy + 0.225,
    px: 128,
    paint: (a, b) => {
      const u = (a - HX0) / (HX1 - HX0);
      const v = (HZ1 - b) / (HZ1 - HZ0);
      // Cejas, ojos con su blanco, mejillas y la boca bajo el bigote
      for (const ec of [0.3, 0.7]) {
        if (Math.abs(u - ec) < 0.09 && Math.abs(v - 0.3) < 0.03) return rgb(...HAIR);
        if (Math.abs(u - ec) < 0.07 && Math.abs(v - 0.42) < 0.06) return Math.abs(u - ec - (ec < 0.5 ? 0.025 : -0.025)) < 0.035 ? rgb(40, 30, 44) : rgb(250, 246, 236);
      }
      if (v > 0.55 && v < 0.64 && (Math.abs(u - 0.15) < 0.07 || Math.abs(u - 0.85) < 0.07)) return rgb(232, 150, 132);
      if (v > 0.8 && v < 0.85 && Math.abs(u - 0.5) < 0.1) return rgb(150, 70, 66);
      return 0;
    },
  });
  // La gorra de plato: copa granate, cinta de galón, insignia y visera negra
  box(HX0 - 0.03, cy - 0.23, HZ1 - 0.04, HX1 + 0.03, cy + 0.25, HZ1 + 0.06, GOLD);
  box(HX0 - 0.06, cy - 0.26, HZ1 + 0.06, HX1 + 0.06, cy + 0.29, HZ1 + 0.2, UNI);
  box(HX0 - 0.04, cy - 0.24, HZ1 + 0.2, HX1 + 0.04, cy + 0.27, HZ1 + 0.23, UNI_D);
  box(cx - 0.05, cy + 0.29, HZ1 + 0.08, cx + 0.05, cy + 0.3, HZ1 + 0.17, GOLD);
  box(HX0 - 0.02, cy + 0.1, HZ1 - 0.07, HX1 + 0.02, cy + 0.38, HZ1 - 0.03, [30, 26, 30]);
  // El mostrador: nogal con estrías, filetes dorados y zócalo oscuro, y tablero de mármol
  const { x0: MX0, x1: MX1, y0: MY0, y1: MY1 } = RECEPCION;
  box(MX0, MY0, 0, MX1, MY1, 1.12, WALNUT);
  const counterFace = (a, b) => {
    if (b < 0.1) return C(DARK);
    if (Math.abs(b - 0.95) < 0.035 || Math.abs(b - 0.2) < 0.03) return gold[3];
    if ((a * 4) % 1 < 0.08) return walnut[1];
    return walnut[noise(a * 1.5, b * 8) > 0.6 ? 4 : 3];
  };
  decal({ normal: '+y', s: [MX0, MX1], z: [0, 1.12], at: MY1 + 0.005, paint: counterFace });
  decal({ normal: '-x', s: [MY0, MY1], z: [0, 1.12], at: MX1 + 0.005, paint: (a, b) => counterFace(a + 7, b) });
  box(MX0 - 0.08, MY0 - 0.06, 1.12, MX1 + 0.08, MY1 + 0.07, 1.24, MARBLE);
  // Flexo de banquero verde, timbre y libro de registro
  box(1.45, 1.15, 1.24, 1.65, 1.35, 1.3, GOLD);
  box(1.53, 1.22, 1.3, 1.57, 1.27, 1.52, GOLD);
  box(1.3, 1.12, 1.52, 1.85, 1.42, 1.66, [52, 120, 84]);
  light(1.36, 1.18, 1.48, 1.8, 1.36, 1.52, LAMP);
  box(4.2, 1.2, 1.24, 4.42, 1.42, 1.29, GOLD);
  light(4.26, 1.26, 1.29, 4.36, 1.36, 1.4, [255, 220, 140]);
  box(2.6, 1.1, 1.24, 3.5, 1.55, 1.28, [244, 236, 214]);
  box(3.03, 1.1, 1.28, 3.07, 1.55, 1.285, RED);

  // ── El tablón «Busco quien lea…»: corcho con notas de papel y chinchetas, en la pared izquierda ──
  const NOTES = [
    [1.25, 1.95, 2.2],
    [1.8, 2.55, 2.45],
    [2.3, 1.75, 2.15],
    [2.55, 2.25, 2.55],
    [1.45, 1.7, 1.75],
    [2.15, 2.6, 1.8],
  ];
  const PINS = [
    [150, 40, 46],
    [52, 98, 96],
    [236, 190, 96],
  ];
  const cork = r.rampOf([176, 128, 80]);
  box(0, TABLON.y0, TABLON.z0, 0.08, TABLON.y1, TABLON.z1, WALNUT_L);
  decal({
    normal: '+x',
    s: [TABLON.y0, TABLON.y1],
    z: [TABLON.z0, TABLON.z1],
    at: 0.085,
    paint: (a, b) => {
      if (Math.min(a - TABLON.y0, TABLON.y1 - a, b - TABLON.z0, TABLON.z1 - b) < 0.07) return C(WALNUT_L);
      for (let k = 0; k < NOTES.length; k += 1) {
        const [ny, nz] = NOTES[k];
        if (a > ny - 0.27 && a < ny + 0.27 && b > nz - 0.3 && b < nz + 0.12) {
          if (Math.abs(a - ny) < 0.04 && Math.abs(b - nz - 0.05) < 0.04) return C(PINS[k % 3]);
          if ((nz - b) % 0.09 < 0.025 && b < nz - 0.02 && Math.abs(a - ny) < 0.19) return rgb(150, 140, 128);
          return rgb(246, 238, 218);
        }
      }
      return cork[noise(a * 14, b * 14) > 0.6 ? 2 : 3];
    },
  });

  // ── El guardarropa: el hueco con los abrigos colgados y su media puerta con mostrador ──
  const COATS = [
    [96, 70, 98],
    [64, 84, 120],
    [150, 88, 60],
    [44, 44, 52],
    [176, 110, 80],
    [80, 110, 84],
    [150, 40, 46],
    [120, 98, 72],
  ];
  const { y0: GY0, y1: GY1 } = GUARDARROPA;
  box(0, GY0, 0, 0.06, GY1, 3.0, DARK);
  decal({
    normal: '+x',
    s: [GY0, GY1],
    z: [0, 3.0],
    at: 0.065,
    paint: (a, b) => {
      if (Math.min(a - GY0, GY1 - a) < 0.1 || b > 2.9) return gold[2];
      if (Math.abs(b - 2.6) < 0.025) return gold[3];
      const k = Math.floor((a - GY0 - 0.1) / 0.27);
      const u = ((a - GY0 - 0.1) / 0.27) % 1;
      if (b < 2.58 && b > 1.25 - hash(k, 2) * 0.35 && u > 0.12 && u < 0.92) {
        const c = COATS[k % COATS.length];
        return rgb(...c.map((v) => v * (u < 0.3 ? 0.75 : 1)));
      }
      if (b > 2.62 && b < 2.82 && hash(k, 5) > 0.6 && u > 0.2 && u < 0.8) return rgb(70, 52, 44);
      return rgb(28, 24, 30);
    },
  });
  box(0, GY0, 0, 0.5, GY1, 1.1, WALNUT);
  decal({ normal: '+x', s: [GY0, GY1], z: [0, 1.1], at: 0.505, paint: (a, b) => (Math.abs(b - 0.95) < 0.035 || Math.abs(b - 0.2) < 0.03 ? gold[3] : b < 0.1 ? C(DARK) : (a * 3) % 1 < 0.06 ? walnut[1] : walnut[3]) });
  box(0, GY0 - 0.05, 1.1, 0.62, GY1 + 0.05, 1.2, MARBLE);
  box(0.15, 5.0, 1.2, 0.45, 5.3, 1.24, [30, 26, 30]);
  box(0.2, 5.05, 1.24, 0.4, 5.25, 1.3, RED);
  box(0.2, 5.05, 1.3, 0.4, 5.25, 1.5, [30, 26, 30]);
  // El paraguas apoyado
  box(0.3, 5.9, 1.2, 0.34, 5.94, 1.85, [30, 26, 30]);

  // ── El diván redondo del centro, con su palmera ──
  const { x: OX, y: OY } = DIVAN;
  for (const [a0, b0, a1, b1] of [
    [OX - 1.0, OY - 0.6, OX + 1.0, OY + 0.6],
    [OX - 0.6, OY - 1.0, OX + 0.6, OY + 1.0],
    [OX - 0.85, OY - 0.85, OX + 0.85, OY + 0.85],
  ]) {
    box(a0, b0, 0, a1, b1, 0.12, DARK);
    box(a0 + 0.02, b0 + 0.02, 0.12, a1 - 0.02, b1 - 0.02, 0.5, VELVET);
  }
  box(OX - 0.38, OY - 0.38, 0.5, OX + 0.38, OY + 0.38, 1.0, GOLD_D);
  box(OX - 0.3, OY - 0.3, 1.0, OX + 0.3, OY + 0.3, 1.06, [70, 50, 40]);
  palm(OX, OY, 1.06, 1.0);

  // ── Palmeras en macetas de latón, en las esquinas ──
  for (const [px, py] of [
    [10.3, 0.75],
    [0.75, 7.35],
  ]) {
    box(px - 0.32, py - 0.32, 0, px + 0.32, py + 0.32, 0.7, GOLD);
    box(px - 0.33, py - 0.33, 0.52, px + 0.33, py + 0.33, 0.58, GOLD_D);
    palm(px, py, 0.7, 1.15);
  }

  // ── El carrito de equipajes de latón, con maletas, junto al ascensor ──
  const { x: LX, y: LY } = CARRITO;
  box(LX - 0.55, LY - 0.35, 0.12, LX + 0.55, LY + 0.35, 0.22, RED);
  for (const s of [-1, 1]) box(LX + s * 0.5 - 0.04, LY - 0.04, 0.22, LX + s * 0.5 + 0.04, LY + 0.04, 1.95, GOLD);
  box(LX - 0.54, LY - 0.05, 1.88, LX + 0.54, LY + 0.05, 1.98, GOLD);
  for (const [w0, w1] of [
    [LX - 0.48, LY - 0.3],
    [LX + 0.48, LY + 0.3],
    [LX - 0.48, LY + 0.3],
    [LX + 0.48, LY - 0.3],
  ])
    box(w0 - 0.06, w1 - 0.06, 0, w0 + 0.06, w1 + 0.06, 0.12, DARK);
  box(LX - 0.42, LY - 0.28, 0.22, LX + 0.1, LY + 0.28, 0.72, [150, 100, 60]);
  box(LX - 0.43, LY - 0.29, 0.45, LX + 0.11, LY + 0.29, 0.49, GOLD);
  box(LX + 0.12, LY - 0.25, 0.22, LX + 0.44, LY + 0.25, 0.92, [64, 84, 120]);
  box(LX - 0.36, LY - 0.22, 0.72, LX + 0.05, LY + 0.22, 0.98, [196, 160, 110]);

  // ── Una huésped esperando el ascensor, con su maleta ──
  guest(HUESPED.x, HUESPED.y, [214, 120, 88], [70, 46, 34]);
  // La maleta, con correas y el asa bajo su mano
  box(HUESPED.x + 0.3, HUESPED.y - 0.15, 0, HUESPED.x + 0.54, HUESPED.y + 0.3, 0.64, [96, 120, 170]);
  for (const dz of [0.18, 0.46]) box(HUESPED.x + 0.295, HUESPED.y - 0.155, dz, HUESPED.x + 0.545, HUESPED.y + 0.305, dz + 0.04, [70, 52, 44]);
  box(HUESPED.x + 0.35, HUESPED.y - 0.04, 0.64, HUESPED.x + 0.42, HUESPED.y + 0.08, 0.78, DARK);

  return { solid, glow, decals };

  function palm(x, y, z, h) {
    box(x - 0.06, y - 0.06, z, x + 0.06, y + 0.06, z + h, [120, 86, 54]);
    const top = z + h;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [0.7, 0.7],
      [-0.7, -0.7],
      [0.7, -0.7],
      [-0.7, 0.7],
    ]) {
      for (let k = 0; k < 4; k += 1) {
        const t = (k + 1) / 4;
        const lx = x + dx * t * 0.6;
        const ly = y + dy * t * 0.6;
        const lz = top - t * t * 0.45;
        box(lx - 0.09, ly - 0.09, lz - 0.05, lx + 0.09, ly + 0.09, lz + 0.03, LEAF.map((v) => v * (0.85 + k * 0.08)));
      }
    }
  }

  function guest(x, y, coat, hair) {
    // La huésped: abrigo de vuelo con cinturón y cuello de piel, medias y zapatos de tacón, melena corta con flequillo,
    // sombrero de ala con cinta y pluma, y la mano derecha en el asa de la maleta; un bolso colgado del otro brazo.
    const COAT_D = coat.map((v) => v * 0.78);
    const FUR = [236, 224, 204];
    const TIGHTS = [70, 56, 62];
    // Piernas y zapatos
    for (const s of [-1, 1]) {
      const lx = x + s * 0.085;
      box(lx - 0.055, y - 0.05, 0.06, lx + 0.055, y + 0.05, 0.62, TIGHTS);
      box(lx - 0.06, y - 0.07, 0, lx + 0.06, y + 0.11, 0.07, [40, 26, 30]);
      box(lx - 0.025, y - 0.07, 0, lx + 0.025, y - 0.03, 0.06, [40, 26, 30]);
    }
    // El abrigo: falda acampanada, talle con cinturón y hebilla, cuerpo y hombros
    box(x - 0.3, y - 0.2, 0.55, x + 0.3, y + 0.2, 0.9, coat);
    box(x - 0.27, y - 0.18, 0.9, x + 0.27, y + 0.18, 1.12, coat);
    box(x - 0.24, y - 0.17, 1.12, x + 0.24, y + 0.17, 1.2, COAT_D);
    box(x - 0.05, y + 0.17, 1.12, x + 0.05, y + 0.185, 1.2, GOLD);
    box(x - 0.26, y - 0.17, 1.2, x + 0.26, y + 0.17, 1.6, coat);
    box(x - 0.3, y - 0.18, 1.52, x + 0.3, y + 0.18, 1.66, coat);
    // Botones y la abertura del abrigo
    box(x - 0.008, y + 0.2, 0.55, x + 0.008, y + 0.205, 1.12, COAT_D);
    for (let k = 0; k < 3; k += 1) box(x + 0.035, y + 0.18, 1.28 + k * 0.1, x + 0.075, y + 0.19, 1.32 + k * 0.1, GOLD);
    // Cuello de piel
    box(x - 0.22, y - 0.16, 1.62, x + 0.22, y + 0.2, 1.74, FUR);
    // Brazos: el izquierdo con el bolso; el derecho baja hasta el asa de la maleta
    box(x - 0.39, y - 0.11, 0.98, x - 0.28, y + 0.11, 1.62, coat);
    box(x - 0.39, y - 0.1, 0.9, x - 0.28, y + 0.1, 0.98, FUR);
    box(x - 0.38, y - 0.07, 0.8, x - 0.29, y + 0.07, 0.9, SKIN);
    box(x - 0.47, y - 0.04, 0.92, x - 0.44, y + 0.04, 1.42, [120, 40, 52]); // asa del bolso
    box(x - 0.52, y - 0.12, 0.72, x - 0.39, y + 0.12, 0.96, [120, 40, 52]);
    box(x - 0.525, y - 0.03, 0.88, x - 0.385, y + 0.03, 0.9, GOLD);
    box(x + 0.28, y - 0.11, 0.98, x + 0.39, y + 0.11, 1.62, coat);
    box(x + 0.3, y - 0.1, 0.88, x + 0.41, y + 0.1, 0.98, FUR);
    box(x + 0.31, y - 0.06, 0.78, x + 0.41, y + 0.07, 0.88, SKIN);
    // Cuello y cabeza, con nariz y la cara pintada
    box(x - 0.06, y - 0.04, 1.74, x + 0.06, y + 0.05, 1.79, SKIN);
    const H0 = 1.78;
    const H1 = 2.16;
    box(x - 0.19, y - 0.18, H0, x + 0.19, y + 0.19, H1, SKIN);
    box(x - 0.03, y + 0.19, 1.92, x + 0.03, y + 0.24, 2.0, [222, 176, 140]);
    decal({
      normal: '+y',
      s: [x - 0.19, x + 0.19],
      z: [H0, H1],
      at: y + 0.195,
      px: 128,
      paint: (a, b) => {
        const u = (a - x + 0.19) / 0.38;
        const v = (H1 - b) / (H1 - H0);
        for (const ec of [0.3, 0.7]) {
          if (Math.abs(u - ec) < 0.09 && Math.abs(v - 0.36) < 0.025) return rgb(...hair);
          if (Math.abs(u - ec) < 0.065 && Math.abs(v - 0.47) < 0.055) return Math.abs(u - ec) < 0.032 ? rgb(52, 38, 60) : rgb(250, 246, 236);
        }
        if (v > 0.6 && v < 0.69 && (Math.abs(u - 0.16) < 0.07 || Math.abs(u - 0.84) < 0.07)) return rgb(236, 150, 140);
        if (v > 0.78 && v < 0.85 && Math.abs(u - 0.5) < 0.09) return rgb(176, 48, 62);
        return 0;
      },
    });
    // Melena corta con flequillo, por los lados hasta la barbilla
    box(x - 0.22, y - 0.21, 2.02, x + 0.22, y + 0.17, 2.2, hair);
    box(x - 0.22, y - 0.21, 1.8, x + 0.22, y - 0.06, 2.06, hair);
    for (const s of [-1, 1]) box(x + s * 0.2 - 0.04, y - 0.18, 1.82, x + s * 0.2 + 0.04, y + 0.14, 2.08, hair);
    box(x - 0.17, y + 0.17, 2.07, x + 0.09, y + 0.21, 2.15, hair);
    // Sombrero de ala con cinta dorada y una pluma
    box(x - 0.33, y - 0.32, 2.17, x + 0.33, y + 0.32, 2.21, [60, 50, 70]);
    box(x - 0.2, y - 0.2, 2.21, x + 0.2, y + 0.18, 2.26, GOLD);
    box(x - 0.19, y - 0.19, 2.26, x + 0.19, y + 0.17, 2.36, [60, 50, 70]);
    for (let k = 0; k < 4; k += 1) box(x + 0.16 + k * 0.035, y - 0.04, 2.24 + k * 0.06, x + 0.2 + k * 0.035, y + 0.0, 2.32 + k * 0.06, [236, 220, 196]);
  }
}

function geometryOf({ pos, nor, col }) {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  return g;
}

/** Ángulo de un punto visto desde donde estás (Three: x, z). */
const azimuth = (from, x, y) => Math.atan2(x - from.x, y - from.z);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// ── La cabina del ascensor (petición de Francisco del 9-11-2026: «que se abra y entres, que sea todo muy lujoso y veas las
// opciones como los botones de él»). Nogal con marquetería e hilos de latón, espejos biselados, friso déco, banco de
// terciopelo, pasamanos de latón, suelo de mármol con una estrella y un plafón de abanico. La botonera es una placa de latón
// en la pared derecha: los botones de verdad los pone la página encima (son la botonera del ascensor de siempre).
const ESPEJO = [74, 92, 104];
/** La pared de la cabina: `s` a lo largo de ella (de 0 a `w`), `z` de alto. `centro(s, z)` pinta lo propio de esa pared. */
function cabWall(r, s, z, w, centro = () => null) {
  const gold = r.rampOf(GOLD);
  const walnut = r.rampOf(WALNUT);
  if (z < 0.12) return rgb(60, 38, 28);
  if (z < 0.98) {
    // Paneles de nogal con un hilo de latón embutido
    const n = Math.max(1, Math.round(w / 0.55));
    const pw = w / n;
    const u = s % pw;
    const e = Math.min(u, pw - u, z - 0.12, 0.98 - z);
    if (e < 0.025) return walnut[1];
    if (Math.abs(e - 0.075) < 0.012) return gold[3];
    return walnut[noise(s * 7, z * 1.5) > 0.6 ? 3 : 2];
  }
  if (z < 1.06) return gold[z < 1.01 ? 2 : 3];
  if (z < 2.55) {
    const own = centro(s, z);
    if (own) return own;
    // Espejos biselados entre montantes de nogal
    const n = Math.max(1, Math.round(w / 0.7));
    const pw = w / n;
    const u = s % pw;
    const e = Math.min(u, pw - u, z - 1.06, 2.55 - z);
    if (e < 0.05) return walnut[1];
    if (e < 0.075) return gold[e < 0.06 ? 4 : 3];
    // El reflejo: más claro arriba, dos franjas en diagonal y algún destello cálido
    const k = (z - 1.06) / 1.49;
    const streak = ((s * 1.3 + z) % 0.9) < 0.07 || ((s * 1.3 + z + 0.2) % 0.9) < 0.025;
    const glint = hash(Math.floor(s * 40), Math.floor(z * 40)) > 0.992;
    if (glint) return rgb(255, 226, 170);
    const base = ESPEJO.map((v, i) => v + k * [40, 40, 36][i] + (streak ? 46 : 0));
    return rgb(...base);
  }
  if (z < 2.62) return gold[3];
  // Friso: zigzag de latón sobre nogal oscuro
  const zz = Math.abs(((s * 5) % 2) - 1) * 0.22;
  const fz = z - 2.66;
  if (fz < 0) return walnut[1];
  if (Math.abs(fz - zz - 0.04) < 0.022) return gold[4];
  if (z > CAB.h - 0.12) return gold[2];
  return walnut[1];
}

function buildCabina() {
  const r = probe();
  const solid = { pos: [], nor: [], col: [] };
  const glow = { pos: [], nor: [], col: [] };
  const decals = [];
  const box = (x0, y0, z0, x1, y1, z1, c) => pushBox(solid, [x0, y0, z0, x1, y1, z1], c);
  const light = (x0, y0, z0, x1, y1, z1, c) => pushBox(glow, [x0, y0, z0, x1, y1, z1], c, true);
  const gold = r.rampOf(GOLD);
  const walnut = r.rampOf(WALNUT);
  const { x0, x1, y0, y1, h, xm, ym } = CAB;
  const W = x1 - x0;
  const D = y1 - y0;

  // El fondo: un sol de marquetería de nogal y latón en el centro, con espejos a los lados
  decal({
    normal: '+y',
    s: [x0, x1],
    z: [0, h],
    at: y0 + 0.002,
    px: 64,
    paint: (a, b) =>
      cabWall(r, a - x0, b, W, (s, z) => {
        const dx = a - xm;
        if (Math.abs(dx) > 0.6) return null;
        if (Math.abs(dx) > 0.56) return gold[3];
        const ang = Math.atan2(z - 1.1, dx);
        const d = Math.hypot(dx, z - 1.1);
        if (d < 0.2) return gold[d < 0.17 ? 4 : 2];
        const ray = Math.floor((ang / Math.PI) * 13);
        if (Math.abs(((ang / Math.PI) * 13) % 1) < 0.08) return gold[3];
        return walnut[ray % 2 ? 3 : 1];
      }),
  });
  // A la izquierda: espejos y paneles
  decal({ normal: '+x', s: [y0, y1], z: [0, h], at: x0 + 0.002, px: 64, paint: (a, b) => cabWall(r, a - y0, b, D) });
  // A la derecha: lo mismo, con el sitio de la botonera en nogal liso
  decal({
    normal: '-x',
    s: [y0, y1],
    z: [0, h],
    at: x1 - 0.002,
    px: 96,
    paint: (a, b) => {
      if (a > PLACA.y0 - 0.14 && a < PLACA.y1 + 0.14 && b > 0.5 && b < PLACA.z1 + 0.16) return walnut[noise(a * 7, b * 1.5) > 0.6 ? 3 : 2];
      return cabWall(r, a - y0, b, D);
    },
  });
  // La pared de las puertas, por dentro: nogal con el hueco recercado de latón
  decal({
    normal: '-y',
    s: [x0, x1],
    z: [0, h],
    at: y1 - 0.002,
    px: 64,
    paint: (a, b) => {
      if (a > HUECO.x0 && a < HUECO.x1 && b < HUECO.h) return 0;
      const e = Math.min(Math.abs(a - HUECO.x0), Math.abs(a - HUECO.x1), Math.abs(b - HUECO.h));
      if (e < 0.06 && b < HUECO.h + 0.06) return gold[3];
      return cabWall(r, a - x0, b, W, () => walnut[2]);
    },
  });
  // Pasamanos de latón con sus soportes (el de la derecha se para antes de la botonera)
  const rail = (ax0, ay0, ax1, ay1) => {
    box(ax0, ay0, 0.93, ax1, ay1, 0.98, GOLD);
    for (const [px, py] of [
      [ax0, ay0],
      [ax1, ay1],
    ])
      box(px - 0.02, py - 0.02, 0.88, px + 0.02, py + 0.02, 0.93, GOLD_D);
  };
  rail(x0 + 0.07, y0 + 0.2, x0 + 0.11, y1 - 0.25);
  rail(x1 - 0.11, y0 + 0.2, x1 - 0.07, PLACA.y0 - 0.2);
  rail(x0 + 0.25, y0 + 0.07, x1 - 0.25, y0 + 0.11);
  // Montantes de latón en las esquinas y la cornisa
  for (const [cx, cy] of [
    [x0, y0],
    [x1, y0],
    [x0, y1],
    [x1, y1],
  ])
    box(cx - 0.04, cy - 0.04, 0, cx + 0.04, cy + 0.04, h, GOLD_D);
  box(x0, y0, h - 0.1, x1, y0 + 0.06, h, GOLD);
  box(x0, y0, h - 0.1, x0 + 0.06, y1, h, GOLD);
  box(x1 - 0.06, y0, h - 0.1, x1, y1, h, GOLD);
  // El banco de terciopelo granate, contra el fondo, con su copete de latón
  box(xm - 0.62, y0, 0, xm + 0.62, y0 + 0.36, 0.4, WALNUT);
  box(xm - 0.62, y0 + 0.34, 0.06, xm + 0.62, y0 + 0.37, 0.38, WALNUT_L);
  box(xm - 0.64, y0, 0.4, xm + 0.64, y0 + 0.4, 0.42, GOLD);
  box(xm - 0.6, y0, 0.42, xm + 0.6, y0 + 0.38, 0.52, RED);
  for (let k = 0; k < 3; k += 1) box(xm - 0.6 + k * 0.4 + 0.02, y0 + 0.36, 0.43, xm - 0.6 + (k + 1) * 0.4 - 0.02, y0 + 0.385, 0.51, [150, 44, 50]);
  for (const s of [-1, 1]) box(xm + s * 0.62 - 0.03, y0 + 0.3, 0, xm + s * 0.62 + 0.03, y0 + 0.36, 0.06, GOLD_D);
  // La placa de la botonera: marco de latón oscuro, placa y una lucecita encima
  box(PLACA.x - 0.01, PLACA.y0 - 0.06, PLACA.z0 - 0.06, x1, PLACA.y1 + 0.06, PLACA.z1 + 0.06, GOLD_D);
  box(PLACA.x - 0.025, PLACA.y0, PLACA.z0, PLACA.x - 0.01, PLACA.y1, PLACA.z1, GOLD);
  box(PLACA.x - 0.04, ym - 0.1, PLACA.z1 + 0.1, x1, ym + 0.1, PLACA.z1 + 0.2, GOLD_D);
  light(PLACA.x - 0.05, ym - 0.07, PLACA.z1 + 0.12, PLACA.x - 0.03, ym + 0.07, PLACA.z1 + 0.18, [255, 210, 130]);
  // El plafón: un abanico de luz bajo una tapa de latón
  box(xm - 0.42, ym - 0.42, h - 0.06, xm + 0.42, ym + 0.42, h - 0.02, GOLD);
  light(xm - 0.34, ym - 0.34, h - 0.14, xm + 0.34, ym + 0.34, h - 0.06, LAMP);
  light(xm - 0.18, ym - 0.18, h - 0.2, xm + 0.18, ym + 0.18, h - 0.14, [255, 246, 222]);
  for (const [dx, dy] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ])
    box(xm + dx * 0.36 - 0.03, ym + dy * 0.36 - 0.03, h - 0.16, xm + dx * 0.36 + 0.03, ym + dy * 0.36 + 0.03, h - 0.06, GOLD_D);

  // El suelo: mármol verde con la cenefa crema, el filete de latón y una estrella de ocho puntas
  const marble = r.rampOf(MARBLE);
  const marbleD = r.rampOf(MARBLE_D);
  const floor = canvasOf(Math.round(W * PX * 1.5), Math.round(D * PX * 1.5), (ix, iy) => {
    const x = x0 + (ix + 0.5) / (PX * 1.5);
    const y = y0 + (iy + 0.5) / (PX * 1.5);
    const edge = Math.min(x - x0, x1 - x, y - y0, y1 - y);
    let c;
    if (edge < 0.05) c = unpack(gold[1]);
    else if (edge < 0.2) c = unpack(marble[edge > 0.17 || edge < 0.08 ? 2 : 3]);
    else if (edge < 0.23) c = unpack(gold[3]);
    else {
      const dx = x - xm;
      const dy = y - ym;
      const d = Math.hypot(dx, dy);
      const ang = Math.atan2(dy, dx);
      const star = 0.55 * (0.45 + 0.55 * Math.abs(Math.cos(ang * 4)) ** 4);
      if (d < star) c = unpack((Math.floor(((ang + Math.PI) / Math.PI) * 8) % 2 ? gold : marble)[3]);
      else if (Math.abs(d - 0.62) < 0.02) c = unpack(gold[3]);
      else {
        const vein = Math.abs(noise(x * 2.4 + y, y * 2.4) - 0.5) < 0.03;
        c = unpack(marbleD[vein ? 4 : noise(x * 4, y * 4) > 0.6 ? 3 : 2]);
      }
    }
    return lit(c, glowAt(x, y, 0), ix, iy);
  });
  // El techo: casetones crema con filetes de latón alrededor del plafón
  const plaster = r.rampOf(CREAM);
  const ceiling = canvasOf(Math.round(W * PX), Math.round(D * PX), (ix, iy) => {
    const x = x0 + (ix + 0.5) / PX;
    const y = y1 - (iy + 0.5) / PX;
    const edge = Math.min(x - x0, x1 - x, y - y0, y1 - y);
    const d = Math.max(Math.abs(x - xm), Math.abs(y - ym));
    let c;
    if (edge < 0.12) c = unpack(gold[2]);
    else if (Math.abs(d - 0.55) < 0.03 || Math.abs(edge - 0.2) < 0.02) c = unpack(gold[3]);
    else c = unpack(plaster[d < 0.55 ? 4 : 3]);
    return lit(c, glowAt(x, y, h), ix, iy);
  });
  return { solid, glow, decals, floor, ceiling };

  function decal(d) {
    decals.push(d);
  }
}

/** Una hoja de las puertas, vista desde el vestíbulo: latón con el abanico déco arriba y el tirador. `k`: 0 izquierda, 1 derecha. */
function paintHoja(k) {
  const r = probe();
  const gold = r.rampOf(GOLD);
  const LW = (HUECO.x1 - HUECO.x0) / 2;
  const s0 = HUECO.x0 + k * LW;
  return canvasOf(Math.round(LW * DECAL_PX), Math.round(HUECO.h * DECAL_PX), (ix, iy) => {
    const u = (ix + 0.5) / (LW * DECAL_PX);
    const a = s0 + u * LW;
    const b = HUECO.h - (iy + 0.5) / DECAL_PX;
    let c;
    // El canto donde se juntan las dos hojas, oscuro
    if ((k === 0 && u > 0.97) || (k === 1 && u < 0.03)) c = [70, 46, 26];
    else if (b > 1.7) {
      const ang = Math.atan2(b - 1.7, (u - 0.5) * 0.9);
      c = unpack(Math.abs(((ang * 7) % 1) - 0.5) < 0.09 ? gold[4] : gold[2]);
    } else if (Math.abs(b - 0.95) < 0.03 || Math.abs(u - 0.1) < 0.04 || Math.abs(u - 0.9) < 0.04) c = unpack(gold[1]);
    else c = unpack(gold[noise(a * 9, b * 2) > 0.62 ? 4 : 3]);
    return lit(c, glowAt(a, 0.13, b), ix, iy);
  });
}

// ── Bloque 3: lo que se toca. Cada cosa tiene una caja invisible para el dedo, un letrero encima y una vista de cerca. ──
/** Lo que se toca: la caja del dedo (mundo de la app), dónde cuelga su letrero y desde dónde se mira de cerca. */
export const SPOTS = {
  recepcion: { box: [1.0, 0, 0, 5.0, 1.8, 4.2], tag: [3.0, 0.3, 4.3], eye: [3.4, 3.9, 2.35], at: [3.0, 0.5, 1.35] },
  ascensor: { box: [6.75, 0, 0, 9.45, 0.45, 4.05], tag: [7.9, 0.1, 4.25], eye: [7.9, 4.9, 2.5], at: [7.9, 0, 2.75] },
  tablon: { box: [0, 0.95, 1.35, 0.35, 3.05, 3.05], tag: [0, 2.0, 3.3], eye: [2.7, 2.0, 2.15], at: [0, 2.0, 1.55] },
  guardarropa: { box: [0, 4.2, 0, 0.75, 7.0, 3.05], tag: [0, 5.6, 3.3], eye: [3.2, 5.6, 2.15], at: [0, 5.6, 1.3] },
};
const TWEEN_MS = 650;
const TAP_SLOP = 8;
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
// Entrar en el ascensor: delante de las puertas, se abren, se entra mirando al banco y se gira hacia la botonera
const ANTE = { eye: [(ASCENSOR.x0 + ASCENSOR.x1) / 2, 2.7, 1.95], at: [(ASCENSOR.x0 + ASCENSOR.x1) / 2, 0, 1.55] };
const DENTRO = { eye: [(ASCENSOR.x0 + ASCENSOR.x1) / 2, -0.85, 1.7], at: [(ASCENSOR.x0 + ASCENSOR.x1) / 2, -3.4, 1.4] };
const BOTONERA = { eye: [PLACA.x - 1.38, CAB.ym, 1.6], at: [CAB.x1, CAB.ym, (PLACA.z0 + PLACA.z1) / 2] };
const ENTRAR = [
  { to: ANTE, ms: 650 },
  { doors: 1, ms: 950 },
  { to: DENTRO, ms: 1100 },
  { to: BOTONERA, ms: 800 },
];
const SALIR = [
  { to: DENTRO, ms: 650 },
  { to: ANTE, ms: 1100 },
  { doors: 0, ms: 850 },
];

/**
 * Monta la recepción en `container`. `startYaw`: giro inicial (0, mirando a la recepción y al ascensor). `onPick(id)`: se
 * ha tocado algo (id de `SPOTS`) o nada (null). `onFrame(tags)`: tras cada dibujo, dónde caen los letreros en la pantalla
 * ({ id: { x, y, visible } } en px del contenedor). `onLost`: el navegador se ha quedado sin contexto de la GPU.
 */
export function mountRecepcion(container, { startYaw = 0, onPick = () => {}, onFrame = () => {}, onLost = () => {}, onSettle = () => {} } = {}) {
  const renderer = new WebGLRenderer({ antialias: false, powerPreference: 'low-power', preserveDrawingBuffer: true });
  const canvas = renderer.domElement;
  canvas.className = 'rcp-canvas';
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'La recepción del Gran Hotel. Arrastra o usa las flechas para mirar.');
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x14122a);

  const scene = new Scene();
  const camera = new PerspectiveCamera(70, 1, 0.1, 60);
  const eye = new Vector3(HOME.x, EYE, HOME.y);
  const baseAz = azimuth(eye, LOOK.x, LOOK.y);
  const rel = REACH.map(([x, y]) => wrap(azimuth(eye, x, y) - baseAz));
  const yawRange = [Math.min(0, Math.min(...rel) + REACH_INSET), Math.max(0, Math.max(...rel) - REACH_INSET)];
  const clampYaw = (v) => clamp(v, yawRange[0], yawRange[1]);
  let yaw = clampYaw(startYaw);

  const owned = [];
  const own = (x) => (owned.push(x), x);
  const plane = (w, h, tex, place, cut = false) => {
    const mesh = new Mesh(own(new PlaneGeometry(w, h)), own(new MeshBasicMaterial({ map: own(texture(tex)), alphaTest: cut ? 0.5 : 0 })));
    place(mesh);
    scene.add(mesh);
  };
  const r = probe();
  const gold = r.rampOf(GOLD);
  // Suelo y techo
  plane(SW, SD, paintFloor(), (m) => {
    m.rotation.x = -Math.PI / 2;
    m.position.set(SW / 2, 0, SD / 2);
  });
  plane(SW, SD, paintCeiling(), (m) => {
    m.rotation.x = Math.PI / 2;
    m.position.set(SW / 2, WH, SD / 2);
  });
  // Las cuatro paredes, cada una con su orientación (la textura va de izquierda a derecha según se mira)
  // La del fondo, con el hueco del ascensor abierto (detrás está la cabina)
  plane(SW, WH, paintWall(SW, (a, b) => [a, 0.05, b], (a, b) => (a > HUECO.x0 && a < HUECO.x1 && b < HUECO.h ? 0 : null)), (m) => m.position.set(SW / 2, WH / 2, 0), true);
  plane(SD, WH, paintWall(SD, (a, b) => [0.05, SD - a, b]), (m) => {
    m.rotation.y = Math.PI / 2;
    m.position.set(0, WH / 2, SD / 2);
  });
  plane(SD, WH, paintWall(SD, (a, b) => [SW - 0.05, a, b], (a, b) => windowPaint(a, b, gold)), (m) => {
    m.rotation.y = -Math.PI / 2;
    m.position.set(SW, WH / 2, SD / 2);
  });
  plane(SW, WH, paintWall(SW, (a, b) => [SW - a, SD - 0.05, b], (a, b) => doorPaint(SW - a, b, gold)), (m) => {
    m.rotation.y = Math.PI;
    m.position.set(SW / 2, WH / 2, SD);
  });
  const boxes = buildBoxes();
  const flat = own(new MeshBasicMaterial({ vertexColors: true }));
  scene.add(new Mesh(own(geometryOf(boxes.solid)), flat));
  scene.add(new Mesh(own(geometryOf(boxes.glow)), flat));
  // Bloque 2: los muebles y las personas, con sus caras dibujadas encima (calcomanías)
  const kit = furnish();
  scene.add(new Mesh(own(geometryOf(kit.solid)), flat));
  scene.add(new Mesh(own(geometryOf(kit.glow)), flat));
  for (const d of kit.decals) {
    const { canvas: art, w, h } = paintDecal(d);
    const mesh = new Mesh(own(new PlaneGeometry(w, h)), own(new MeshBasicMaterial({ map: own(texture(art)), alphaTest: 0.5 })));
    placeDecal(mesh, d);
    scene.add(mesh);
  }
  // La cabina del ascensor, detrás de la pared del fondo, y las dos hojas de sus puertas
  const cab = buildCabina();
  scene.add(new Mesh(own(geometryOf(cab.solid)), flat));
  scene.add(new Mesh(own(geometryOf(cab.glow)), flat));
  for (const d of cab.decals) {
    const { canvas: art, w, h } = paintDecal(d);
    const mesh = new Mesh(own(new PlaneGeometry(w, h)), own(new MeshBasicMaterial({ map: own(texture(art)), alphaTest: 0.5 })));
    placeDecal(mesh, d);
    scene.add(mesh);
  }
  plane(CAB.x1 - CAB.x0, CAB.y1 - CAB.y0 + 0.08, cab.floor, (m) => {
    m.rotation.x = -Math.PI / 2;
    m.position.set(CAB.xm, 0.001, CAB.ym + 0.04);
  });
  plane(CAB.x1 - CAB.x0, CAB.y1 - CAB.y0, cab.ceiling, (m) => {
    m.rotation.x = Math.PI / 2;
    m.position.set(CAB.xm, CAB.h, CAB.ym);
  });
  const LW = (HUECO.x1 - HUECO.x0) / 2;
  const hojas = [0, 1].map((k) => {
    const mesh = new Mesh(own(new PlaneGeometry(LW, HUECO.h)), own(new MeshBasicMaterial({ map: own(texture(paintHoja(k))) })));
    mesh.position.set(HUECO.x0 + LW * (k + 0.5), HUECO.h / 2, -0.03);
    scene.add(mesh);
    return mesh;
  });
  let doors = 0;
  function setDoors(v) {
    doors = v;
    hojas[0].position.x = HUECO.x0 + LW * 0.5 - v * LW * 0.98;
    hojas[1].position.x = HUECO.x0 + LW * 1.5 + v * LW * 0.98;
  }
  // Las cajas del dedo: invisibles, solo para saber qué hay bajo él
  const hidden = own(new MeshBasicMaterial({ visible: false }));
  const pickers = Object.entries(SPOTS).map(([id, { box: [x0, y0, z0, x1, y1, z1] }]) => {
    const m = new Mesh(own(new BoxGeometry(x1 - x0, z1 - z0, y1 - y0)), hidden);
    m.position.set((x0 + x1) / 2, (z0 + z1) / 2, (y0 + y1) / 2);
    m.userData.id = id;
    scene.add(m);
    return m;
  });
  const ray = new Raycaster();

  let raf = 0;
  let destroyed = false;
  let renders = 0;
  // Una vista fija (mundo de la app: [x, y, z] de los ojos y del punto al que se mira), o null para la de siempre
  let fixed = null;
  // Los pasos que quedan ({ to: vista | 'home', ms } o { doors: 0..1, ms }) y el que se está dando
  let seq = [];
  let step = null;
  let cur = null;
  let inCab = false;
  const homeView = () => {
    const az = baseAz + yaw;
    return { eye: [eye.x, eye.z, eye.y], at: [eye.x + Math.sin(az) * 6, eye.z + Math.cos(az) * 6, eye.y + Math.tan(PITCH) * 6], lift: 0 };
  };
  // `lift`: cuánto sube en la pantalla (fracción del alto) el punto al que se mira, para que lo de cerca quede en el hueco
  // que deja el papel abierto debajo (un desplazamiento de la lente, sin girar la cámara)
  let lift = 0;
  function setLift(v) {
    if (Math.abs(v - lift) < 1e-4) return;
    lift = v;
    const w = renderer.domElement.width;
    const h = renderer.domElement.height;
    if (lift) camera.setViewOffset(w, h, 0, lift * h, w, h);
    else camera.clearViewOffset();
  }
  const resolve = (to) => (to === 'home' ? homeView() : to);
  function next() {
    const st = seq.shift();
    step = st ? { ...st, t0: performance.now(), from: cur ?? fixed ?? homeView(), doorsFrom: doors } : null;
    if (!st) onSettle();
  }
  /** Dar estos pasos (con movimiento reducido, de golpe al final). */
  function run(steps) {
    if (reduced()) {
      for (const st of steps) {
        if ('doors' in st) setDoors(st.doors);
        if ('to' in st) fixed = st.to === 'home' ? null : st.to;
      }
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
  function aim() {
    let v = fixed ?? homeView();
    if (step) {
      const k = Math.min(1, (performance.now() - step.t0) / step.ms);
      const e = ease(k);
      if ('doors' in step) setDoors(lerp(step.doorsFrom, step.doors, e));
      if ('to' in step) {
        const to = resolve(step.to);
        v = {
          eye: step.from.eye.map((a, i) => lerp(a, to.eye[i], e)),
          at: step.from.at.map((a, i) => lerp(a, to.at[i], e)),
          lift: lerp(step.from.lift ?? 0, to.lift ?? 0, e),
        };
      }
      if (k >= 1) {
        if ('to' in step) fixed = step.to === 'home' ? null : step.to;
        cur = v;
        next();
      }
    }
    cur = v;
    setLift(v.lift ?? 0);
    camera.position.set(v.eye[0], v.eye[2], v.eye[1]);
    camera.lookAt(v.at[0], v.at[2], v.at[1]);
  }
  const tagPoint = new Vector3();
  function tags() {
    const rect = container.getBoundingClientRect();
    const out = {};
    for (const [id, s] of Object.entries(SPOTS)) {
      tagPoint.set(s.tag[0], s.tag[2], s.tag[1]).project(camera);
      out[id] = { x: ((tagPoint.x + 1) / 2) * rect.width, y: ((1 - tagPoint.y) / 2) * rect.height, visible: tagPoint.z < 1 && Math.abs(tagPoint.x) < 0.92 && tagPoint.y < 0.97 && tagPoint.y > -0.9 };
    }
    return out;
  }
  function draw() {
    raf = 0;
    if (destroyed || document.visibilityState === 'hidden') return;
    aim();
    renderer.render(scene, camera);
    renders += 1;
    onFrame(tags());
    if (step) invalidate();
  }
  function invalidate() {
    if (!raf && !destroyed) raf = requestAnimationFrame(draw);
  }
  function resize() {
    const rect = container.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    renderer.setSize(ART_W, Math.max(1, Math.round((ART_W * rect.height) / rect.width)), false);
    camera.aspect = rect.width / rect.height;
    const portrait = (2 * Math.atan(Math.tan((HFOV * Math.PI) / 360) / camera.aspect) * 180) / Math.PI;
    camera.fov = camera.aspect < 1 ? Math.min(VFOV_MAX, portrait) : VFOV_LANDSCAPE;
    const keep = lift;
    lift = 0;
    camera.clearViewOffset();
    setLift(keep);
    camera.updateProjectionMatrix();
    invalidate();
  }
  function pickAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    ray.setFromCamera(new Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1), camera);
    return ray.intersectObjects(pickers, false)[0]?.object.userData.id ?? null;
  }

  // Mirar: arrastrar (como coger la vista con el dedo) o las flechas. Un toque sin arrastrar elige lo que hay debajo.
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
      // De cerca no se gira: se vuelve a la entrada con «Volver»
      if (!press.moved || fixed || step) return;
      yaw = clampYaw(press.yaw + (e.clientX - press.x) * DRAG);
      invalidate();
    },
    on,
  );
  const release = (e) => {
    if (!press || e.pointerId !== press.id) return;
    const tap = !press.moved && e.type === 'pointerup';
    press = null;
    if (tap) onPick(pickAt(e.clientX, e.clientY));
  };
  canvas.addEventListener('pointerup', release, on);
  canvas.addEventListener('pointercancel', release, on);
  canvas.addEventListener(
    'keydown',
    (e) => {
      if ((e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') || fixed || step) return;
      e.preventDefault();
      yaw = clampYaw(yaw + (e.key === 'ArrowLeft' ? KEY_STEP : -KEY_STEP));
      invalidate();
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
  document.addEventListener('visibilitychange', invalidate, on);
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  container.append(canvas);
  resize();

  const api = {
    canvas,
    yaw: () => yaw,
    yawRange: () => [...yawRange],
    setYaw(value) {
      yaw = clampYaw(value);
      invalidate();
      return yaw;
    },
    renders: () => renders,
    /**
     * Acercarse a algo de `SPOTS`, o volver a la entrada con null. `top`: hasta qué fracción del alto, desde arriba, queda
     * libre (lo de debajo lo tapa el papel); lo enfocado se centra en ese hueco.
     */
    focus(id, top = 1) {
      // El ascensor no se mira de cerca: se abre y se entra, hasta la botonera
      if (id === 'ascensor') {
        if (inCab) return;
        inCab = true;
        run(ENTRAR);
        return;
      }
      const s = id ? SPOTS[id] : null;
      const out = inCab ? [...SALIR] : [];
      inCab = false;
      run([...out, { to: s ? { eye: s.eye, at: s.at, lift: clamp(0.5 - top / 2, 0, 0.42) } : 'home', ms: TWEEN_MS }]);
    },
    /** Quieto en la vista a la que va (para las capturas). */
    settled: () => !step,
    /** Dentro de la cabina, con la botonera delante. */
    inCabin: () => inCab && !step,
    /** Dónde cae la placa de la botonera en la pantalla (px del contenedor), para poner encima los botones. */
    plateRect() {
      const rect = container.getBoundingClientRect();
      const xs = [];
      const ys = [];
      for (const [y, z] of [
        [PLACA.y0, PLACA.z0],
        [PLACA.y1, PLACA.z1],
      ]) {
        tagPoint.set(PLACA.x - 0.026, z, y).project(camera);
        xs.push(((tagPoint.x + 1) / 2) * rect.width);
        ys.push(((1 - tagPoint.y) / 2) * rect.height);
      }
      return { left: Math.min(...xs), top: Math.min(...ys), width: Math.abs(xs[1] - xs[0]), height: Math.abs(ys[1] - ys[0]) };
    },
    /** Mirar desde otro sitio (mundo de la app); `null` vuelve a la entrada. */
    view(eyeAt, at) {
      seq = [];
      step = null;
      cur = null;
      fixed = eyeAt ? { eye: eyeAt, at } : null;
      invalidate();
    },
    /** Abrir o cerrar las puertas del ascensor de golpe (para las capturas). */
    doors(v) {
      setDoors(v);
      invalidate();
    },
    /** Dónde cae en la pantalla el centro de lo que se toca (para las pruebas). */
    spotOnScreen(id) {
      aim();
      const s = SPOTS[id].box;
      const p = new Vector3((s[0] + s[3]) / 2, (s[2] + s[5]) / 2, (s[1] + s[4]) / 2).project(camera);
      const rect = canvas.getBoundingClientRect();
      return { x: rect.left + ((p.x + 1) / 2) * rect.width, y: rect.top + ((1 - p.y) / 2) * rect.height };
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      stop.abort();
      observer.disconnect();
      for (const x of owned) x.dispose?.();
      renderer.dispose();
      canvas.remove();
    },
  };
  return api;
}
