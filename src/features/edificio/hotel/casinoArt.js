// El casino del sótano del Gran Hotel por dentro (1.80, docs/qa/gran-hotel.md §9.4), con el mismo motor isométrico
// que el vestíbulo (raster.js): un casino art déco de los años 20, de noche. Moqueta roja con rombos dorados, papel
// pintado verde botella con pilastras de latón y zócalo de nogal, la lámpara de flecos sobre la mesa de tapete verde y
// el crupier con chaleco, pajarita y visera. Al fondo, la ventanilla de la caja con su reja (el canje, en el bloque
// siguiente) y un rótulo de neón «21». Sin tragaperras ni ruletas: aquí solo se juega a «Las 21 páginas». Todo propio.
import { createRaster, noise, rgb } from '../../minigames/libreria-puerto/raster';
import { evening, outlineOf, toDataURL } from '../shopRoom';

const YAW = Math.PI / 4;
const SW = 9;
const SD = 7;
const WH = 4.2;
const WALL_T = 0.3;
const S_CASINO = 18;
const GLOW = 0x8000;
// Lo que se toca (identificadores en el búfer de toques)
const ID = { mesa: 1, caja: 2 };
// Dónde van las cartas, los letreros y el bocadillo del crupier (`cabeza`), en puntos del mundo
const AT = { crupier: [3.75, 2.95, 1.02], tuyas: [5.35, 4.55, 1.02], caja: [0, 2.3, 3.25], mesa: [4.6, 3.8, 1.02], cabeza: [4.6, 2.35, 2.75] };

const GOLD = [236, 190, 96];
const WALNUT = [98, 60, 40];
const BOTTLE = [34, 74, 60];
const CARPET = [138, 30, 40];
const FELT = [40, 118, 74];
const SKIN = [236, 196, 160];
const DARK = [30, 26, 32];
const SHIRT = [240, 234, 220];
const VEST = [128, 32, 42];
const VISOR = [70, 170, 110];
const LAMP = [255, 222, 150];
const NEON = [255, 120, 170];
const LEAF = [70, 120, 80];

function buildCasino(r) {
  const lights = [];
  const box = (x0, y0, z0, x1, y1, z1, c, opts = {}) => {
    r.setId((opts.id ?? 0) | (opts.glow ? GLOW : 0));
    r.box(x0, y0, z0, x1, y1, z1, c, { seed: opts.seed ?? x0 * 7 + y0 * 3, grain: opts.grain ?? 1, face: opts.face ?? null, step: opts.step ?? 0.035 });
    r.setId(0);
  };
  const gold = r.rampOf(GOLD);
  const walnut = r.rampOf(WALNUT);
  const at = (x, y, z) => {
    const p = r.project(x, y, z);
    return [p.sx | 0, p.sy | 0];
  };

  // ── Moqueta roja con una celosía de rombos dorados ──
  const carpet = r.rampOf(CARPET);
  r.floor((x, y, ix, iy) => {
    if (x < 0 || y < 0 || x > SW || y > SD) return 0;
    const u = (x + y) * 0.9;
    const v = (x - y) * 0.9;
    const lattice = Math.abs((u % 1) - 0.5) < 0.04 || Math.abs((((v % 1) + 1) % 1) - 0.5) < 0.04;
    if (lattice) return gold[r.bayerAt(ix, iy) > 0.5 ? 1 : 2];
    const d = (r.bayerAt(ix, iy) - 0.5) * 0.5;
    return carpet[Math.max(0, Math.min(4, Math.floor(2.6 + (noise(x * 4, y * 4) - 0.5) * 0.8 + d)))];
  });

  // ── Paredes: papel pintado verde botella con rombos, pilastras de latón, zócalo de nogal y cornisa ──
  const paper = r.rampOf(BOTTLE);
  const wallFace = (a, b, ix, iy) => {
    if (b > WH - 0.22) return b > WH - 0.1 ? gold[2] : gold[3];
    if (b < 0.95) return walnut[Math.abs((a % 1.1) - 0.55) < 0.03 ? 1 : b > 0.85 ? 3 : 2];
    if (b < 1.03) return gold[3];
    const pil = a % 1.8;
    if (pil < 0.14) return gold[pil < 0.04 || pil > 0.1 ? 2 : 4];
    // Un rombo pequeño del papel pintado cada medio metro
    const du = Math.abs(((a * 2) % 1) - 0.5) + Math.abs(((b * 2) % 1) - 0.5);
    if (du < 0.16) return paper[du < 0.08 ? 4 : 3];
    return paper[noise(a * 3 + 2, b * 3) > 0.75 && r.bayerAt(ix, iy) > 0.7 ? 3 : 2];
  };
  r.box(-WALL_T, -WALL_T, 0, SW, 0, WH, BOTTLE, { grain: 0, step: 0.03, face: (f, a, b) => (f === 'front' ? wallFace(a, b, ...at(a, 0, b)) : f === 'top' ? walnut[3] : walnut[1]) });
  r.box(-WALL_T, 0, 0, 0, SD, WH, BOTTLE, { grain: 0, step: 0.03, face: (f, a, b) => (f === 'side' ? wallFace(a, b, ...at(0, a, b)) : f === 'top' ? walnut[3] : walnut[1]) });

  // ── Apliques de abanico en la pared del fondo ──
  for (const x of [1.6, 7.6]) {
    box(x - 0.22, 0, 2.5, x + 0.22, 0.12, 2.85, GOLD, { grain: 0 });
    box(x - 0.16, 0.02, 2.57, x + 0.16, 0.16, 2.79, LAMP, { glow: true, grain: 0 });
    lights.push([x, 0.3, 2.65]);
  }

  // ── El rótulo de neón «21» con un naipe, en la pared del fondo ──
  const glyph = {
    2: ['###', '..#', '###', '#..', '###'],
    1: ['.#', '##', '.#', '.#', '.#'],
  };
  const NX = 3.7;
  const NZ = 3.65;
  const px = 0.13;
  box(NX - 0.25, 0, NZ - 0.95, NX + 1.95, 0.06, NZ + 0.25, DARK, { grain: 0 });
  let gx = NX;
  for (const ch of ['2', '1']) {
    glyph[ch].forEach((row, gy) =>
      [...row].forEach((bit, k) => bit === '#' && box(gx + k * px, 0.06, NZ - gy * px - px, gx + k * px + px * 0.85, 0.1, NZ - gy * px, NEON, { glow: true, grain: 0, step: 0.02 })),
    );
    gx += glyph[ch][0].length * px + px;
  }
  // El naipe al lado, con su picas
  box(NX + 0.95, 0.06, NZ - 0.75, NX + 1.65, 0.1, NZ + 0.05, [214, 196, 176], {
    grain: 0,
    step: 0.02,
    face: (f, a, b) => {
      if (f !== 'front') return null;
      const u = (a - NX - 1.3) / 0.35;
      const v = (b - NZ + 0.35) / 0.4;
      if (Math.abs(u) > 0.86 || Math.abs(v) > 0.9) return rgb(255, 150, 180);
      if (v > -0.15 && Math.abs(u) < 0.5 - Math.abs(v - 0.25) * 0.9) return rgb(60, 40, 60);
      if (v < -0.1 && v > -0.6 && Math.abs(u) < 0.07) return rgb(60, 40, 60);
      return null;
    },
  });
  lights.push([NX + 0.9, 0.5, NZ - 0.3]);

  // ── La caja: una ventanilla de nogal con reja de latón en la pared de la izquierda ──
  const CY0 = 1.4;
  const CY1 = 3.3;
  box(0, CY0, 0, 0.55, CY1, 1.15, WALNUT, { id: ID.caja, grain: 0, face: (f, a, b) => (f === 'side' && Math.abs(b - 0.6) < 0.03 ? walnut[3] : null) });
  box(0, CY0 - 0.05, 1.15, 0.62, CY1 + 0.05, 1.24, [200, 190, 172], { id: ID.caja, grain: 0 });
  box(0, CY0, 1.24, 0.08, CY1, 2.75, WALNUT, {
    id: ID.caja,
    grain: 0,
    step: 0.02,
    face: (f, a, b) => {
      if (f !== 'side') return null;
      if (a < CY0 + 0.12 || a > CY1 - 0.12 || b > 2.6) return walnut[2];
      if (Math.abs((a * 7) % 1) < 0.18 || Math.abs(b - 2.0) < 0.03) return gold[3];
      return rgb(255, 214, 150);
    },
  });
  box(0, CY0 - 0.08, 2.75, 0.2, CY1 + 0.08, 3.0, GOLD, { id: ID.caja, grain: 0 });
  lights.push([0.4, (CY0 + CY1) / 2, 2.0]);

  // ── La mesa de «Las 21 páginas»: tapete verde con su filete dorado, borde de nogal acolchado y patas torneadas ──
  const TX0 = 2.7;
  const TX1 = 6.5;
  const TY0 = 2.7;
  const TY1 = 4.9;
  for (const [x, y] of [
    [TX0 + 0.4, TY0 + 0.4],
    [TX1 - 0.4, TY0 + 0.4],
    [TX0 + 0.4, TY1 - 0.4],
    [TX1 - 0.4, TY1 - 0.4],
  ])
    box(x - 0.1, y - 0.1, 0, x + 0.1, y + 0.1, 0.82, WALNUT, { grain: 0 });
  box(TX0, TY0, 0.82, TX1, TY1, 0.94, WALNUT, { id: ID.mesa, grain: 0 });
  const felt = r.rampOf(FELT);
  box(TX0 + 0.16, TY0 + 0.16, 0.94, TX1 - 0.16, TY1 - 0.16, 0.97, FELT, {
    id: ID.mesa,
    grain: 0,
    step: 0.02,
    face: (f, a, b) => {
      if (f !== 'top') return null;
      const e = Math.min(a - TX0 - 0.16, TX1 - 0.16 - a, b - TY0 - 0.16, TY1 - 0.16 - b);
      if (e > 0.12 && e < 0.16) return gold[3];
      // El arco donde se ponen tus cartas, en dorado tenue
      const d = Math.hypot((a - (TX0 + TX1) / 2) * 0.6, b - TY0 - 0.2);
      if (Math.abs(d - 1.6) < 0.025) return felt[3];
      return felt[noise(a * 6, b * 6) > 0.72 ? 3 : 2];
    },
  });
  // El borde acolchado de cuero delante, para apoyarse
  box(TX0 - 0.05, TY1 - 0.18, 0.94, TX1 + 0.05, TY1 + 0.05, 1.04, [70, 36, 30], { id: ID.mesa, grain: 0 });
  // Un mazo boca abajo y una torre de fichas junto al crupier
  box(TX1 - 0.95, TY0 + 0.35, 0.97, TX1 - 0.6, TY0 + 0.6, 1.07, VEST, { id: ID.mesa, grain: 0, face: (f, a, b) => (f === 'top' && ((a + b) * 12) % 1 < 0.3 ? rgb(236, 190, 96) : null) });
  [0, 1, 2, 3].forEach((k) => box(TX0 + 0.45, TY0 + 0.4, 0.97 + k * 0.05, TX0 + 0.68, TY0 + 0.63, 1.01 + k * 0.05, k % 2 ? [236, 226, 206] : [176, 52, 48], { id: ID.mesa, grain: 0 }));

  // ── La lámpara de flecos sobre la mesa ──
  const LX = (TX0 + TX1) / 2;
  const LY = (TY0 + TY1) / 2;
  box(LX - 0.02, LY - 0.02, 3.55, LX + 0.02, LY + 0.02, WH, GOLD, { grain: 0 });
  box(LX - 0.3, LY - 0.25, 3.5, LX + 0.3, LY + 0.25, 3.58, [42, 96, 70], { grain: 0 });
  box(LX - 0.62, LY - 0.4, 3.38, LX + 0.62, LY + 0.4, 3.5, [42, 96, 70], { grain: 0, face: (f, a, b) => (b < 3.41 ? gold[3] : null) });
  for (let a = -0.6; a <= 0.6; a += 0.08) box(LX + a, LY + 0.39, 3.26, LX + a + 0.03, LY + 0.42, 3.38, GOLD, { grain: 0, step: 0.02 });
  for (let a = -0.38; a <= 0.38; a += 0.08) box(LX + 0.61, LY + a, 3.26, LX + 0.64, LY + a + 0.03, 3.38, GOLD, { grain: 0, step: 0.02 });
  box(LX - 0.14, LY - 0.1, 3.3, LX + 0.14, LY + 0.1, 3.38, LAMP, { glow: true, grain: 0 });
  lights.push([LX, LY, 2.6], [LX - 1.2, LY + 0.6, 1.6], [LX + 1.2, LY + 0.6, 1.6]);

  // ── El crupier, detrás de la mesa: camisa blanca, chaleco granate, pajarita, visera verde y bigote ──
  const cx = LX;
  const cy = TY0 - 0.35;
  box(cx - 0.15, cy - 0.1, 0, cx - 0.03, cy + 0.1, 0.8, DARK, { grain: 0 });
  box(cx + 0.03, cy - 0.1, 0, cx + 0.15, cy + 0.1, 0.8, DARK, { grain: 0 });
  box(cx - 0.32, cy - 0.18, 0.8, cx + 0.32, cy + 0.18, 1.85, SHIRT, {
    seed: 3,
    face: (f, a, b) => {
      if (f !== 'front') return null;
      if (Math.abs(a - cx) > 0.12 && b < 1.7) return rgb(...VEST);
      if (b > 1.66 && b < 1.76 && Math.abs(a - cx) < 0.1) return rgb(...DARK);
      if (Math.abs(a - cx) < 0.12 && b < 1.6 && (b * 7) % 1 < 0.3) return rgb(236, 190, 96);
      return null;
    },
  });
  for (const s of [-1, 1]) {
    box(cx + s * 0.32 - (s > 0 ? 0 : 0.12), cy - 0.1, 1.3, cx + s * 0.32 + (s > 0 ? 0.12 : 0), cy + 0.5, 1.55, SHIRT, { seed: 5 });
    box(cx + s * 0.22 - 0.08, cy + 0.5, 1.0, cx + s * 0.22 + 0.08, cy + 0.68, 1.12, SKIN, { grain: 0 });
  }
  box(cx - 0.07, cy - 0.05, 1.85, cx + 0.07, cy + 0.05, 1.92, SKIN, { grain: 0 });
  const HX0 = cx - 0.24;
  const HX1 = cx + 0.24;
  const HZ0 = 1.92;
  const HZ1 = 2.38;
  box(HX0, cy - 0.2, HZ0, HX1, cy + 0.22, HZ1, SKIN, {
    grain: 0,
    step: 0.02,
    face: (f, a, b) => {
      if (f !== 'front') return null;
      const u = (a - HX0) / (HX1 - HX0);
      const v = (HZ1 - b) / (HZ1 - HZ0);
      for (const ec of [0.3, 0.7]) if (Math.abs(u - ec) < 0.05 && Math.abs(v - 0.45) < 0.05) return rgb(44, 30, 26);
      if (v > 0.62 && v < 0.72 && Math.abs(u - 0.5) < 0.22) return rgb(70, 48, 36);
      return null;
    },
  });
  box(HX0 - 0.02, cy - 0.22, HZ1 - 0.04, HX1 + 0.02, cy + 0.2, HZ1 + 0.06, [52, 40, 34], { seed: 6 });
  // La visera verde, translúcida de luz
  box(HX0 - 0.05, cy + 0.05, HZ1 - 0.1, HX1 + 0.05, cy + 0.42, HZ1 - 0.04, VISOR, { glow: true, grain: 0 });

  // ── Butacas de terciopelo delante de la mesa y dos palmeras en macetero ──
  for (const x of [3.4, 5.8]) {
    const y = TY1 + 0.75;
    box(x - 0.3, y - 0.3, 0, x + 0.3, y + 0.3, 0.5, [52, 98, 96], { seed: x });
    box(x - 0.3, y + 0.15, 0.5, x + 0.3, y + 0.3, 1.15, [52, 98, 96], { seed: x + 1 });
    box(x - 0.3, y - 0.3, 0.5, x + 0.3, y - 0.22, 0.52, GOLD, { grain: 0 });
  }
  for (const [x, y] of [
    [SW - 0.7, 0.7],
    [0.7, SD - 0.7],
  ]) {
    box(x - 0.3, y - 0.3, 0, x + 0.3, y + 0.3, 0.6, GOLD, { grain: 0 });
    box(x - 0.05, y - 0.05, 0.6, x + 0.05, y + 0.05, 1.6, [96, 70, 52], { grain: 0 });
    for (let k = 0; k < 7; k += 1) {
      const ang = (k / 7) * Math.PI * 2;
      for (let j = 1; j <= 4; j += 1) {
        const lx = x + Math.cos(ang) * j * 0.14;
        const ly = y + Math.sin(ang) * j * 0.14;
        const lz = 1.62 + j * 0.06 - (j > 2 ? (j - 2) * 0.12 : 0);
        box(lx - 0.07, ly - 0.07, lz, lx + 0.07, ly + 0.07, lz + 0.07, LEAF, { grain: 0, seed: k + j });
      }
    }
  }
  return lights;
}

/** Encuadre de la sala entera. */
function casinoFrame() {
  const probe = createRaster({ W: 1, H: 1, S: S_CASINO, yaw: YAW, ox: 0, oy: 0 });
  const pts = [
    [SW, SD, 0],
    [SW, -WALL_T, 0],
    [-WALL_T, SD, 0],
    [-WALL_T, -WALL_T, WH],
    [SW, -WALL_T, WH],
    [-WALL_T, SD, WH],
  ].map(([x, y, z]) => probe.project(x, y, z));
  const minX = Math.min(...pts.map((p) => p.sx));
  const maxX = Math.max(...pts.map((p) => p.sx));
  const minY = Math.min(...pts.map((p) => p.sy));
  const maxY = Math.max(...pts.map((p) => p.sy));
  return { W: Math.ceil(maxX - minX) + 6, H: Math.ceil(maxY - minY) + 6, ox: Math.round(3 - minX), oy: Math.round(3 - minY) };
}

const FRAME = casinoFrame();
export const CASINO_W = FRAME.W;
export const CASINO_H = FRAME.H;
const cache = {};

/**
 * La sala del casino: { scene, at, outlines }. `at`: dónde van las cartas del crupier, las tuyas y los letreros
 * (fracciones del dibujo); `outlines`: el contorno encendido de la mesa y de la caja. `apagada`: la sala en penumbra,
 * como se ve si hoy aún no has leído (la puerta no se enciende).
 */
export function renderCasino({ apagada = false } = {}) {
  const key = apagada ? 'off' : 'on';
  if (cache[key]) return cache[key];
  const r = createRaster({ W: FRAME.W, H: FRAME.H, S: S_CASINO, yaw: YAW, ox: FRAME.ox, oy: FRAME.oy });
  r.clear(0);
  const lights = buildCasino(r);
  r.applyShadows();
  r.bakeOcclusion();
  r.shadeEdges();
  evening(r, apagada ? [] : lights, 90);
  if (apagada) {
    // Penumbra: todo más oscuro y frío, y el neón apagado
    for (let i = 0; i < r.pix.length; i += 1) {
      const p = r.pix[i];
      if (!p) continue;
      r.pix[i] = rgb((p & 255) * 0.32, ((p >> 8) & 255) * 0.34, ((p >> 16) & 255) * 0.42);
    }
  }
  const at = Object.fromEntries(
    Object.entries(AT).map(([name, [x, y, z]]) => {
      const p = r.project(x, y, z);
      return [name, { left: p.sx / r.W, top: p.sy / r.H }];
    }),
  );
  const outlines = Object.fromEntries(Object.entries(ID).map(([name, id]) => [name, outlineOf(r, id)]));
  const scene = toDataURL(r, () => rgb(16, 12, 20));
  cache[key] = { scene, at, outlines };
  return cache[key];
}
