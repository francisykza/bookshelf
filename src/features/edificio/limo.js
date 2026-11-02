// La limusina negra de lujo (1.74, SPEC §74; Francisco, 2-11-2026: «para llegar al gran hotel, tengas que coger una
// limusina lujosa negra»). Dibujo propio, con el mismo rasterizador que las fachadas: larga, negra y brillante, con el
// filo cromado, los cristales tintados, tapacubos, los faros encendidos y su chófer de gorra junto a la puerta de atrás.
// Espera aparcada en el muelle, delante del portal del edificio, y espera también bajo la marquesina del hotel.
import { createRaster } from '../minigames/libreria-puerto/raster';

export const LIMO_L = 3.3; // de la trasera al morro (el morro mira hacia +x)
export const LIMO_D = 0.9; // de ancho

const BLACK = [54, 52, 66];
const ROOF = [40, 38, 50];
const CHROME = [204, 208, 220];
const TINT = [72, 90, 128];
const TYRE = [22, 20, 26];
const HEAD = [255, 236, 180];
const TAIL = [196, 44, 48];
const SUIT = [30, 28, 36];
const SHIRT = [236, 232, 222];
const SKIN = [214, 164, 124];

/**
 * La dibuja en un dibujo ya empezado (`r`, de createRaster), entre x … x + LIMO_L e y … y + LIMO_D, del suelo hacia
 * arriba. `glowId`: el id con el que ese dibujo enciende las luces (los faros). `shadow`: si deja su sombra en el suelo
 * (hay que llamar luego a r.applyShadows, como hace la fachada). Devuelve dónde cae en la pantalla (en píxeles).
 */
export function drawLimo(r, x, y, { glowId = 0, chauffeur = true, shadow = true } = {}) {
  const L = LIMO_L;
  const D = LIMO_D;
  const chrome = r.rampOf(CHROME);
  const tint = r.rampOf(TINT);
  const tail = r.rampOf(TAIL);
  if (shadow) for (let k = 0; k <= 4; k += 1) r.castShadow(x + 0.3 + (k * (L - 0.6)) / 4, y + D / 2, 0.15, 0.62);
  // Ruedas, con su tapacubos cromado
  for (const a of [0.55, L - 0.6]) {
    r.box(x + a - 0.21, y + 0.04, 0, x + a + 0.21, y + D - 0.04, 0.27, TYRE, {
      grain: 0,
      step: 0.03,
    });
    r.box(x + a - 0.09, y + D - 0.04, 0.08, x + a + 0.09, y + D - 0.02, 0.2, CHROME, { grain: 0, step: 0.02 });
  }
  // Parachoques cromados
  r.box(x - 0.07, y + 0.06, 0.15, x, y + D - 0.06, 0.29, CHROME, {
    grain: 0,
    step: 0.03,
  });
  r.box(x + L, y + 0.06, 0.15, x + L + 0.07, y + D - 0.06, 0.29, CHROME, {
    grain: 0,
    step: 0.03,
  });
  // La carrocería: negra, con un filo cromado a lo largo y los pilotos rojos atrás
  r.box(x, y + 0.03, 0.17, x + L, y + D - 0.03, 0.53, BLACK, {
    grain: 0.4,
    step: 0.025,
    face: (f, a, b) => {
      // Arriba, el brillo del charol: una raya clara a lo largo
      if (f === 'top') return Math.abs(b - y - D * 0.62) < 0.05 ? chrome[2] : undefined;
      if (b > 0.33 && b < 0.4) return chrome[3];
      if (f === 'front' && a < x + 0.07 && b > 0.4 && b < 0.49) return tail[3];
      // Las puertas: una raya fina en cada junta
      if (f === 'front' && b > 0.2 && [0.95, 1.65, 2.35].some((j) => Math.abs(a - x - j) < 0.013)) return r.rampOf(ROOF)[1];
      return undefined;
    },
  });
  // El morro: rejilla cromada y los dos faros encendidos
  r.box(x + L, y + 0.3, 0.22, x + L + 0.02, y + D - 0.3, 0.45, CHROME, {
    grain: 0,
    step: 0.02,
    face: (f, a) => (f === 'side' && Math.floor(a * 40) % 2 ? chrome[1] : undefined),
  });
  r.setId(glowId);
  for (const [a0, a1] of [
    [0.08, 0.26],
    [D - 0.26, D - 0.08],
  ])
    r.box(x + L, y + a0, 0.37, x + L + 0.025, y + a1, 0.47, HEAD, {
      grain: 0,
      step: 0.02,
    });
  r.setId(0);
  // La figurita del capó
  r.box(x + L - 0.12, y + D / 2 - 0.03, 0.53, x + L - 0.06, y + D / 2 + 0.03, 0.62, CHROME, { grain: 0, step: 0.02 });
  // El habitáculo: largo y bajo, con los cristales tintados y un reflejo
  const c0 = x + 0.45;
  const c1 = x + L - 0.95;
  r.box(c0, y + 0.1, 0.53, c1, y + D - 0.1, 0.86, ROOF, {
    grain: 0,
    step: 0.025,
    face: (f, a, b) => {
      if (f === 'top' || b < 0.58 || b > 0.81) return undefined;
      // Los montantes, entre ventanilla y ventanilla
      if (f === 'front' && (a < c0 + 0.08 || a > c1 - 0.06 || [0.65, 1.35].some((j) => Math.abs(a - c0 - j) < 0.035))) return undefined;
      if (f === 'side' && (a < y + 0.16 || a > y + D - 0.16)) return undefined;
      const glint = f === 'front' ? Math.abs((((a - c0) * 1.6 + b * 2.2) % 1.3) - 0.5) < 0.05 : Math.abs((((a - y) * 2 + b * 2) % 1) - 0.5) < 0.05;
      return glint ? tint[4] : tint[b > 0.74 ? 2 : 1];
    },
  });
  // El chófer, de pie detrás del coche, esperándote: traje negro, camisa blanca y gorra de plato
  if (chauffeur) {
    const hx = x - 0.35;
    const hy = y + D - 0.05;
    r.box(hx - 0.1, hy - 0.08, 0, hx + 0.1, hy + 0.08, 0.5, SUIT, {
      grain: 0,
      step: 0.02,
    });
    r.box(hx - 0.13, hy - 0.09, 0.5, hx + 0.13, hy + 0.09, 0.92, SUIT, {
      grain: 0,
      step: 0.02,
      face: (f, a, b) => (f === 'front' && Math.abs(a - hx) < 0.035 && b > 0.74 ? r.rampOf(SHIRT)[3] : undefined),
    });
    r.box(hx - 0.08, hy - 0.07, 0.92, hx + 0.08, hy + 0.07, 1.1, SKIN, {
      grain: 0,
      step: 0.02,
    });
    r.box(hx - 0.1, hy - 0.09, 1.1, hx + 0.1, hy + 0.09, 1.16, SUIT, {
      grain: 0,
      step: 0.02,
    });
    r.box(hx - 0.06, hy + 0.09, 1.08, hx + 0.06, hy + 0.15, 1.11, SUIT, {
      grain: 0,
      step: 0.02,
    });
    if (shadow) r.castShadow(hx, hy, 0.2, 0.2);
  }
  const pts = [];
  for (const px of [x - (chauffeur ? 0.5 : 0.07), x + L + 0.07]) for (const py of [y, y + D + (chauffeur ? 0.05 : 0)]) for (const pz of [0, chauffeur ? 1.16 : 0.86]) pts.push(r.project(px, py, pz));
  const xs = pts.map((p) => p.sx);
  const ys = pts.map((p) => p.sy);
  return {
    x0: Math.min(...xs),
    y0: Math.min(...ys),
    x1: Math.max(...xs),
    y1: Math.max(...ys),
  };
}

/**
 * La limusina sola, sin chófer, en un lienzo transparente (para el viaje hasta el hotel). `S`: píxeles por unidad.
 * Devuelve { canvas, ox, oy }: dónde cae en el lienzo el punto del suelo bajo su trasera (x = 0, y = 0).
 */
export function limoSprite(S = 22, yaw = 0.3) {
  const probe = createRaster({ W: 1, H: 1, S, yaw, ox: 0, oy: 0 });
  const pts = [];
  for (const px of [-0.1, LIMO_L + 0.1]) for (const py of [0, LIMO_D]) for (const pz of [0, 0.9]) pts.push(probe.project(px, py, pz));
  const minX = Math.min(...pts.map((p) => p.sx));
  const minY = Math.min(...pts.map((p) => p.sy));
  const W = Math.ceil(Math.max(...pts.map((p) => p.sx)) - minX) + 4;
  const H = Math.ceil(Math.max(...pts.map((p) => p.sy)) - minY) + 4;
  const r = createRaster({
    W,
    H,
    S,
    yaw,
    ox: Math.round(2 - minX),
    oy: Math.round(2 - minY),
  });
  r.clear(0);
  drawLimo(r, 0, 0, { chauffeur: false, shadow: false });
  r.shadeEdges();
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(W, H);
  image.data.set(new Uint8ClampedArray(r.pix.buffer));
  ctx.putImageData(image, 0, 0);
  return { canvas, ox: Math.round(2 - minX), oy: Math.round(2 - minY) };
}
