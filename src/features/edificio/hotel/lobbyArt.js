// El vestíbulo del Gran Hotel por dentro (1.75, SPEC §75; paso A de docs/qa/gran-hotel.md §9). Con el mismo motor
// isométrico que la tienda del bajo y los pisos (raster.js), de noche y art déco: suelo de mármol en damero con filete
// dorado, paredes de estuco crema con pilastras doradas y zócalo de nogal, la lámpara de araña, el diván redondo con su
// palmera, el carrito de equipajes y una huésped esperando. Lo que se toca: la recepción con el conserje y su casillero
// de llaves (los encargos de la semana), el ascensor de latón con la esfera de plantas (la navegación del hotel), el
// tablón «Busco quien lea…» y el guardarropa. Todo propio.
import { createRaster, hash, noise, rgb } from '../../minigames/libreria-puerto/raster';
import { evening, outlineOf, toDataURL } from '../shopRoom';
// Medidas y colores compartidos con la recepción en 3D
import { CREAM, GOLD, GOLD_D, HUESPED, MARBLE, MARBLE_D, RED, SD, SW, VELVET, WALL_T, WALNUT, WALNUT_L, WH } from './lobbyLayout';

const YAW = Math.PI / 4;
const S_LOBBY = 16;
const GLOW = 0x8000;
// Lo que se toca (identificadores en el búfer de toques)
const ID = { recepcion: 1, ascensor: 2, tablon: 3, guardarropa: 4 };
// Dónde cuelga el letrero de cada cosa (un punto del mundo, encima de ella)
const TAG_AT = { recepcion: [3.0, 0.9, 3.5], ascensor: [7.9, 0.1, 4.45], tablon: [0, 2.0, 3.2], guardarropa: [0, 5.5, 3.45] };

const CORK = [176, 128, 80];
const LEAF = [70, 120, 80];
const SKIN = [236, 196, 160];
const SKIN_D = [176, 124, 92];
const DARK = [34, 30, 36];
const LAMP = [255, 230, 168];

/** El vestíbulo, amueblado. Devuelve las luces (puntos del mundo). */
function buildLobby(r) {
  const lights = [];
  const box = (x0, y0, z0, x1, y1, z1, c, opts = {}) => {
    r.setId((opts.id ?? 0) | (opts.glow ? GLOW : 0));
    r.box(x0, y0, z0, x1, y1, z1, c, { seed: opts.seed ?? x0 * 7 + y0 * 3, grain: opts.grain ?? 1, face: opts.face ?? null, step: opts.step ?? 0.035 });
    r.setId(0);
  };
  const gold = r.rampOf(GOLD);
  const at = (x, y, z) => {
    const p = r.project(x, y, z);
    return [p.sx | 0, p.sy | 0];
  };

  // ── Suelo: mármol crema y verde en damero, con vetas y un filete dorado alrededor ──
  const light = r.rampOf(MARBLE);
  const dark = r.rampOf(MARBLE_D);
  r.floor((x, y, ix, iy) => {
    if (x < 0 || y < 0 || x > SW || y > SD) return 0;
    const e = Math.min(x, y, SW - x, SD - y);
    if (e > 0.42 && e < 0.5) return gold[3];
    const odd = (Math.floor(x) + Math.floor(y)) % 2;
    const ramp = odd ? dark : light;
    const vein = Math.abs(noise(x * 2.2 + y * 0.8, y * 2.2) - 0.5) < 0.025;
    const d = (r.bayerAt(ix, iy) - 0.5) * 0.4;
    const seam = x % 1 < 0.035 || y % 1 < 0.035;
    return ramp[Math.max(0, Math.min(4, Math.floor(3 + (noise(x * 3, y * 3) - 0.5) * 0.6 + d - (seam ? 1 : 0) - (vein ? 1 : 0))))];
  });

  // ── Paredes: estuco crema, pilastras doradas, zócalo de nogal y cornisa ──
  const plaster = r.rampOf(CREAM);
  const walnut = r.rampOf(WALNUT);
  const wallFace = (a, b, ix, iy) => {
    if (b > WH - 0.22) return b > WH - 0.1 ? gold[2] : gold[3];
    if (b < 1.05) return walnut[Math.abs((a % 1.1) - 0.55) < 0.03 ? 1 : b > 0.95 ? 3 : 2];
    if (b < 1.13) return gold[3];
    const pil = a % 2.2;
    if (pil < 0.16) return gold[pil < 0.05 || pil > 0.11 ? 2 : 4];
    const n = noise(a * 2.4 + 5, b * 2.4);
    return plaster[n > 0.78 && r.bayerAt(ix, iy) > 0.7 ? 4 : n < 0.22 && r.bayerAt(ix, iy) > 0.8 ? 2 : 3];
  };
  r.box(-WALL_T, -WALL_T, 0, SW, 0, WH, CREAM, { grain: 0, step: 0.03, face: (f, a, b) => (f === 'front' ? wallFace(a, b, ...at(a, 0, b)) : f === 'top' ? walnut[3] : walnut[1]) });
  r.box(-WALL_T, 0, 0, 0, SD, WH, CREAM, { grain: 0, step: 0.03, face: (f, a, b) => (f === 'side' ? wallFace(a, b, ...at(0, a, b)) : f === 'top' ? walnut[3] : walnut[1]) });

  // ── Apliques de pared (abanicos de luz) ──
  for (const x of [5.6, 10.2]) {
    box(x - 0.22, 0, 2.55, x + 0.22, 0.12, 2.9, GOLD, { grain: 0 });
    box(x - 0.16, 0.02, 2.62, x + 0.16, 0.16, 2.84, LAMP, { glow: true, grain: 0 });
    lights.push([x, 0.3, 2.7]);
  }
  box(0, 3.55, 2.55, 0.12, 3.95, 2.9, GOLD, { grain: 0 });
  box(0.02, 3.6, 2.62, 0.16, 3.9, 2.84, LAMP, { glow: true, grain: 0 });
  lights.push([0.3, 3.75, 2.7]);

  // ── El ascensor: marco de mármol oscuro, puertas de latón con abanico déco y la esfera de plantas encima ──
  const EX0 = 6.95;
  const EX1 = 8.85;
  const EM = (EX0 + EX1) / 2;
  const doors = (a, b) => {
    if (a < EX0 + 0.18 || a > EX1 - 0.18 || b > 2.85) return null;
    if (Math.abs(a - EM) < 0.025) return rgb(70, 46, 26);
    const half = a < EM ? EX0 + 0.18 : EM;
    const u = (a - half) / ((EX1 - EX0 - 0.36) / 2);
    // Abanico de rayos que sale del pie de cada hoja, arriba; y cuarterones abajo
    if (b > 1.7) {
      const ang = Math.atan2(b - 1.7, (u - 0.5) * 0.9);
      if (Math.abs(((ang * 7) % 1) - 0.5) < 0.09) return gold[4];
      return gold[2];
    }
    if (Math.abs(b - 0.95) < 0.03 || Math.abs(u - 0.1) < 0.04 || Math.abs(u - 0.9) < 0.04) return gold[1];
    return gold[noise(a * 9, b * 2) > 0.62 ? 4 : 3];
  };
  box(EX0 - 0.1, 0, 0, EX1 + 0.1, 0.12, 3.12, MARBLE_D, { id: ID.ascensor, grain: 0, step: 0.02, face: (f, a, b) => (f === 'front' ? doors(a, b) : null) });
  box(EX0 - 0.2, 0, 3.12, EX1 + 0.2, 0.16, 3.26, GOLD, { id: ID.ascensor, grain: 0 });
  // La esfera: un semicírculo de latón con una marca por planta y la aguja en el vestíbulo
  const DX = EM;
  const DZ = 3.36;
  box(DX - 0.62, 0, 3.26, DX + 0.62, 0.08, 3.98, GOLD, {
    id: ID.ascensor,
    grain: 0,
    step: 0.015,
    face: (f, a, b) => {
      if (f !== 'front') return null;
      const dx = a - DX;
      const dz = b - DZ;
      const d = Math.hypot(dx, dz * 1.05);
      if (d > 0.6) return 0;
      if (d > 0.54) return gold[2];
      const ang = Math.atan2(dz, dx);
      // Diez plantas, de la izquierda (sótano) a la derecha (corona); la aguja en la segunda
      const mark = ((Math.PI - ang) / Math.PI) * 9;
      if (d > 0.4 && Math.abs(mark - Math.round(mark)) < 0.09) return rgb(70, 46, 26);
      const needle = Math.PI - (1 / 9) * Math.PI;
      if (d < 0.46 && Math.abs(Math.sin(ang - needle)) * d < 0.025 && Math.cos(ang - needle) > 0) return rgb(150, 40, 46);
      if (d < 0.07) return rgb(70, 46, 26);
      return rgb(246, 232, 196);
    },
  });
  // Botón de llamada, encendido
  box(EX1 + 0.32, 0, 1.25, EX1 + 0.52, 0.08, 1.6, GOLD, { id: ID.ascensor, grain: 0 });
  box(EX1 + 0.37, 0.06, 1.38, EX1 + 0.47, 0.11, 1.48, [255, 200, 120], { id: ID.ascensor, glow: true, grain: 0 });
  // Alfombra roja hasta el ascensor
  box(EX0 + 0.25, 0.25, 0, EX1 - 0.25, SD - 0.6, 0.012, RED, {
    grain: 0,
    face: (f, a, b) => {
      if (f !== 'top') return null;
      const e = Math.min(a - EX0 - 0.25, EX1 - 0.25 - a);
      if (e < 0.06) return gold[3];
      if (e < 0.12) return rgb(110, 26, 34);
      return (b * 2.2) % 1 < 0.06 ? rgb(176, 64, 60) : null;
    },
  });

  // ── La recepción: casillero de llaves, el conserje y el mostrador de nogal y mármol ──
  box(1.3, 0, 1.55, 4.6, 0.16, 3.45, WALNUT, {
    id: ID.recepcion,
    grain: 0,
    step: 0.02,
    face: (f, a, b) => {
      if (f !== 'front') return null;
      const cu = (a - 1.3) / 0.33;
      const cv = (b - 1.55) / 0.38;
      const fu = cu % 1;
      const fv = cv % 1;
      if (fu < 0.12 || fv < 0.12) return walnut[3];
      const k = hash(Math.floor(cu), Math.floor(cv));
      // En algunos casilleros cuelga la llave con su borla; en otros, una carta
      if (k > 0.55 && Math.abs(fu - 0.55) < 0.08 && fv > 0.3 && fv < 0.8) return fv < 0.45 ? gold[4] : rgb(150, 40, 46);
      if (k < 0.18 && fu > 0.25 && fu < 0.85 && fv > 0.2 && fv < 0.5) return rgb(244, 236, 214);
      return walnut[0];
    },
  });
  box(1.2, 0, 3.45, 4.7, 0.24, 3.58, GOLD, { id: ID.recepcion, grain: 0 });
  // El conserje: uniforme granate con botones dorados, gorra con galón y bigote
  const cx = 3.0;
  const cy = 0.55;
  const UNI = [120, 34, 44];
  box(cx - 0.34, cy - 0.2, 0.75, cx + 0.34, cy + 0.2, 1.95, UNI, {
    id: ID.recepcion,
    seed: 2,
    face: (f, a, b) => (f === 'front' && Math.abs(a - cx) < 0.04 && (b * 6) % 1 < 0.35 && b > 1.1 ? gold[4] : null),
  });
  for (const s of [-1, 1]) {
    box(cx + s * 0.34 - (s > 0 ? 0 : 0.12), cy - 0.12, 1.35, cx + s * 0.34 + (s > 0 ? 0.12 : 0), cy + 0.55, 1.62, UNI, { id: ID.recepcion, seed: 4 });
    box(cx + s * 0.2 - 0.08, cy + 0.55, 1.48, cx + s * 0.2 + 0.08, cy + 0.74, 1.6, SKIN, { id: ID.recepcion, grain: 0 });
  }
  box(cx - 0.08, cy - 0.06, 1.95, cx + 0.08, cy + 0.06, 2.02, SKIN_D, { id: ID.recepcion, grain: 0 });
  const HX0 = cx - 0.25;
  const HX1 = cx + 0.25;
  const HZ0 = 2.02;
  const HZ1 = 2.5;
  const face = (a, b) => {
    const u = (a - HX0) / (HX1 - HX0);
    const v = (HZ1 - b) / (HZ1 - HZ0);
    for (const ec of [0.3, 0.7]) if (Math.abs(u - ec) < 0.04 && Math.abs(v - 0.42) < 0.05) return rgb(44, 30, 26);
    if (v > 0.6 && v < 0.68 && Math.abs(u - 0.5) < 0.24 && Math.abs(u - 0.5) > 0.03) return rgb(92, 62, 44);
    if (v > 0.52 && v < 0.6 && (Math.abs(u - 0.14) < 0.06 || Math.abs(u - 0.86) < 0.06)) return rgb(232, 150, 132);
    return null;
  };
  box(HX0, cy - 0.22, HZ0, HX1, cy + 0.24, HZ1, SKIN, { id: ID.recepcion, grain: 0, step: 0.02, face: (f, a, b) => (f === 'front' ? face(a, b) : null) });
  box(HX0 - 0.03, cy - 0.25, HZ1 - 0.04, HX1 + 0.03, cy + 0.27, HZ1 + 0.18, UNI, { id: ID.recepcion, seed: 6, face: (f, a, b) => (b < HZ1 + 0.02 ? gold[3] : null) });
  box(HX0 - 0.03, cy + 0.1, HZ1 - 0.06, HX1 + 0.03, cy + 0.36, HZ1 - 0.02, [30, 26, 30], { id: ID.recepcion, grain: 0 });
  // El mostrador
  box(1.1, 1.0, 0, 4.9, 1.65, 1.12, WALNUT, {
    id: ID.recepcion,
    seed: 8,
    face: (f, a, b) => {
      if (f === 'top') return null;
      if (b < 0.1) return rgb(...DARK);
      if (Math.abs(b - 0.95) < 0.035 || Math.abs(b - 0.2) < 0.03) return gold[3];
      if (f === 'front' && (a * 4) % 1 < 0.08) return walnut[1];
      return null;
    },
  });
  box(1.02, 0.94, 1.12, 4.98, 1.72, 1.24, MARBLE, { id: ID.recepcion, grain: 0 });
  // Lámpara de banquero, timbre y libro de registro
  box(1.45, 1.15, 1.24, 1.65, 1.35, 1.3, GOLD, { id: ID.recepcion, grain: 0 });
  box(1.53, 1.22, 1.3, 1.57, 1.27, 1.52, GOLD, { id: ID.recepcion, grain: 0 });
  box(1.3, 1.12, 1.52, 1.85, 1.42, 1.66, [52, 120, 84], { id: ID.recepcion, grain: 0 });
  box(1.36, 1.18, 1.48, 1.8, 1.36, 1.52, LAMP, { id: ID.recepcion, glow: true, grain: 0 });
  lights.push([1.6, 1.3, 1.5]);
  box(4.2, 1.2, 1.24, 4.42, 1.42, 1.29, GOLD, { id: ID.recepcion, grain: 0 });
  box(4.26, 1.26, 1.29, 4.36, 1.36, 1.4, [255, 220, 140], { id: ID.recepcion, glow: true, grain: 0 });
  box(2.6, 1.1, 1.24, 3.5, 1.55, 1.28, [244, 236, 214], { id: ID.recepcion, grain: 0, face: (f, a) => (f === 'top' && Math.abs(a - 3.05) < 0.03 ? rgb(150, 40, 46) : null) });

  // ── El tablón «Busco quien lea…»: corcho con notas de papel y chinchetas ──
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
  box(0, 1.05, 1.45, 0.08, 2.95, 2.95, CORK, {
    id: ID.tablon,
    grain: 0,
    step: 0.018,
    face: (f, a, b) => {
      if (f !== 'side') return null;
      if (Math.min(a - 1.05, 2.95 - a, b - 1.45, 2.95 - b) < 0.07) return rgb(...WALNUT_L);
      for (let k = 0; k < NOTES.length; k += 1) {
        const [ny, nz] = NOTES[k];
        if (a > ny - 0.27 && a < ny + 0.27 && b > nz - 0.3 && b < nz + 0.12) {
          if (Math.abs(a - ny) < 0.04 && Math.abs(b - nz - 0.05) < 0.04) return rgb(...PINS[k % 3]);
          if ((nz - b) % 0.09 < 0.025 && b < nz - 0.02 && Math.abs(a - ny) < 0.19) return rgb(150, 140, 128);
          return rgb(246, 238, 218);
        }
      }
      return r.rampOf(CORK)[noise(a * 14, b * 14) > 0.6 ? 2 : 3];
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
  box(0, 4.3, 0, 0.06, 6.9, 3.0, DARK, {
    id: ID.guardarropa,
    grain: 0,
    step: 0.02,
    face: (f, a, b) => {
      if (f !== 'side') return null;
      if (Math.min(a - 4.3, 6.9 - a) < 0.1 || b > 2.9) return gold[2];
      if (Math.abs(b - 2.6) < 0.025) return gold[3];
      const k = Math.floor((a - 4.4) / 0.27);
      const u = ((a - 4.4) / 0.27) % 1;
      if (b < 2.58 && b > 1.25 - hash(k, 2) * 0.35 && u > 0.12 && u < 0.92) {
        const c = COATS[k % COATS.length];
        return rgb(...c.map((v) => v * (u < 0.3 ? 0.75 : 1)));
      }
      if (b > 2.62 && b < 2.82 && hash(k, 5) > 0.6 && u > 0.2 && u < 0.8) return rgb(70, 52, 44);
      return rgb(28, 24, 30);
    },
  });
  box(0, 4.3, 0, 0.5, 6.9, 1.1, WALNUT, { id: ID.guardarropa, seed: 12, face: (f, a, b) => (Math.abs(b - 0.95) < 0.035 ? gold[3] : null) });
  box(0, 4.25, 1.1, 0.62, 6.95, 1.2, MARBLE, { id: ID.guardarropa, grain: 0 });
  // Una chistera y un paraguas sobre el mostrador del guardarropa
  box(0.15, 5.0, 1.2, 0.45, 5.3, 1.24, [30, 26, 30], { id: ID.guardarropa, grain: 0 });
  box(0.2, 5.05, 1.24, 0.4, 5.25, 1.5, [30, 26, 30], { id: ID.guardarropa, grain: 0, face: (f, a, b) => (b < 1.3 ? rgb(150, 40, 46) : null) });

  // ── El diván redondo del centro, con su palmera ──
  const OX = 4.2;
  const OY = 4.4;
  for (const [a0, b0, a1, b1] of [
    [OX - 1.0, OY - 0.6, OX + 1.0, OY + 0.6],
    [OX - 0.6, OY - 1.0, OX + 0.6, OY + 1.0],
  ]) {
    box(a0, b0, 0, a1, b1, 0.12, DARK, { grain: 0 });
    box(a0 + 0.02, b0 + 0.02, 0.12, a1 - 0.02, b1 - 0.02, 0.5, VELVET, { seed: a0, face: (f, a) => (f !== 'top' && (a * 5) % 1 < 0.08 ? rgb(36, 72, 72) : null) });
  }
  box(OX - 0.38, OY - 0.38, 0.5, OX + 0.38, OY + 0.38, 1.0, GOLD_D, { seed: 3 });
  box(OX - 0.3, OY - 0.3, 1.0, OX + 0.3, OY + 0.3, 1.06, [70, 50, 40], { grain: 0 });
  palm(OX, OY, 1.06, 1.0);
  r.castShadow(OX, OY, 0.3, 1.1, 1, 0.5);

  // ── Palmeras en macetas de latón, en las esquinas ──
  for (const [px, py] of [
    [10.3, 0.75],
    [0.75, 7.35],
  ]) {
    box(px - 0.32, py - 0.32, 0, px + 0.32, py + 0.32, 0.7, GOLD, { seed: px, face: (f, a, b) => (Math.abs(b - 0.55) < 0.04 ? gold[1] : null) });
    palm(px, py, 0.7, 1.15);
    r.castShadow(px, py, 0.2, 0.5, 1, 0.5);
  }

  // ── El carrito de equipajes de latón, con maletas, junto al ascensor ──
  const LX = 9.55;
  const LY = 2.2;
  box(LX - 0.55, LY - 0.35, 0.12, LX + 0.55, LY + 0.35, 0.22, [150, 40, 46], { grain: 0 });
  for (const s of [-1, 1]) box(LX + s * 0.5 - 0.04, LY - 0.04, 0.22, LX + s * 0.5 + 0.04, LY + 0.04, 1.95, GOLD, { grain: 0 });
  box(LX - 0.54, LY - 0.05, 1.88, LX + 0.54, LY + 0.05, 1.98, GOLD, { grain: 0 });
  for (const [cx0, cy0] of [
    [LX - 0.48, LY - 0.3],
    [LX + 0.48, LY + 0.3],
    [LX - 0.48, LY + 0.3],
    [LX + 0.48, LY - 0.3],
  ])
    box(cx0 - 0.06, cy0 - 0.06, 0, cx0 + 0.06, cy0 + 0.06, 0.12, DARK, { grain: 0 });
  box(LX - 0.42, LY - 0.28, 0.22, LX + 0.1, LY + 0.28, 0.72, [150, 100, 60], { seed: 4, face: (f, a, b) => (Math.abs(b - 0.47) < 0.03 ? gold[3] : null) });
  box(LX + 0.12, LY - 0.25, 0.22, LX + 0.44, LY + 0.25, 0.92, [64, 84, 120], { seed: 5 });
  box(LX - 0.36, LY - 0.22, 0.72, LX + 0.05, LY + 0.22, 0.98, [196, 160, 110], { seed: 6 });
  r.castShadow(LX, LY, 0.2, 0.7, 1, 0.5);

  // ── Una huésped esperando el ascensor, con su maleta ──
  // Junto al ascensor, sin tapar al conserje desde la entrada (1.98: la misma huésped que en la recepción en 3D)
  guest(HUESPED.x, HUESPED.y, [214, 120, 88], [70, 46, 34], SKIN);
  box(HUESPED.x + 0.35, HUESPED.y - 0.15, 0, HUESPED.x + 0.6, HUESPED.y + 0.3, 0.55, [96, 120, 170], { seed: 9 });
  r.castShadow(HUESPED.x + 0.1, HUESPED.y + 0.05, 0.2, 0.4, 1, 0.5);

  // ── La lámpara de araña, sobre el diván ──
  const CX = OX;
  const CY = OY;
  box(CX - 0.03, CY - 0.03, 3.85, CX + 0.03, CY + 0.03, WH, GOLD_D, { grain: 0 });
  box(CX - 0.55, CY - 0.55, 3.62, CX + 0.55, CY + 0.55, 3.72, GOLD, { grain: 0 });
  box(CX - 0.4, CY - 0.4, 3.45, CX + 0.4, CY + 0.4, 3.62, LAMP, { glow: true, grain: 0 });
  box(CX - 0.2, CY - 0.2, 3.72, CX + 0.2, CY + 0.2, 3.92, LAMP, { glow: true, grain: 0 });
  for (const [dx, dy] of [
    [-0.55, 0],
    [0.55, 0],
    [0, -0.55],
    [0, 0.55],
  ])
    box(CX + dx - 0.06, CY + dy - 0.06, 3.3, CX + dx + 0.06, CY + dy + 0.06, 3.62, [255, 240, 200], { glow: true, grain: 0 });
  lights.push([CX, CY, 3.4], [CX, CY, 3.4]);
  return lights;

  function palm(x, y, z, h) {
    box(x - 0.06, y - 0.06, z, x + 0.06, y + 0.06, z + h, [120, 86, 54], { grain: 0 });
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
        box(lx - 0.09, ly - 0.09, lz - 0.05, lx + 0.09, ly + 0.09, lz + 0.03, LEAF, { seed: k + dx * 3 + dy });
      }
    }
  }

  function guest(x, y, coat, hair, skin) {
    box(x - 0.14, y - 0.1, 0, x - 0.03, y + 0.1, 0.75, DARK, { grain: 0 });
    box(x + 0.03, y - 0.1, 0, x + 0.14, y + 0.1, 0.75, DARK, { grain: 0 });
    box(x - 0.26, y - 0.17, 0.7, x + 0.26, y + 0.17, 1.7, coat, { seed: 7 });
    box(x - 0.07, y - 0.05, 1.7, x + 0.07, y + 0.05, 1.77, skin, { grain: 0 });
    box(x - 0.2, y - 0.19, 1.77, x + 0.2, y + 0.2, 2.18, skin, {
      grain: 0,
      face: (f, a, b) => (f === 'front' && b > 1.9 && b < 1.98 && (Math.abs(a - x + 0.08) < 0.03 || Math.abs(a - x - 0.08) < 0.03) ? rgb(44, 30, 26) : null),
    });
    box(x - 0.23, y - 0.22, 2.06, x + 0.23, y + 0.16, 2.28, hair, { seed: 8 });
    box(x - 0.23, y - 0.22, 1.82, x + 0.23, y - 0.05, 2.1, hair, { seed: 9 });
    // Sombrero de ala con cinta
    box(x - 0.32, y - 0.3, 2.24, x + 0.32, y + 0.3, 2.28, [60, 50, 70], { grain: 0 });
    box(x - 0.2, y - 0.2, 2.28, x + 0.2, y + 0.18, 2.44, [60, 50, 70], { grain: 0, face: (f, a, b) => (b < 2.33 ? rgb(236, 190, 96) : null) });
  }
}

/** Encuadre del vestíbulo entero. */
function lobbyFrame() {
  const probe = createRaster({ W: 1, H: 1, S: S_LOBBY, yaw: YAW, ox: 0, oy: 0 });
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

const FRAME = lobbyFrame();
export const LOBBY_W = FRAME.W;
export const LOBBY_H = FRAME.H;
let cache = null;

/**
 * El vestíbulo entero: { scene, tags, outlines, hit }. `tags`: dónde cuelga el letrero de cada cosa (fracciones del
 * dibujo); `outlines`: su contorno encendido; `hit(fx, fy)`: qué hay bajo un punto (fracciones), o null.
 */
export function renderLobby() {
  if (cache) return cache;
  const r = createRaster({ W: FRAME.W, H: FRAME.H, S: S_LOBBY, yaw: YAW, ox: FRAME.ox, oy: FRAME.oy });
  r.clear(0);
  const lights = buildLobby(r);
  r.applyShadows();
  r.bakeOcclusion();
  r.shadeEdges();
  evening(r, lights, 95);
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
  const hit = (fx, fy) => {
    const cx = Math.floor(fx * W);
    const cy = Math.floor(fy * H);
    for (const [dx, dy] of [
      [0, 0],
      [-2, 0],
      [2, 0],
      [0, -2],
      [0, 2],
    ]) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const name = names[ids[y * W + x] & ~GLOW];
      if (name) return name;
    }
    return null;
  };
  const scene = toDataURL(r, () => rgb(20, 18, 34));
  cache = { scene, tags, outlines, hit };
  return cache;
}
