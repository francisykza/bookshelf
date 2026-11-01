// Rasterizador de píxeles para «La librería del puerto» (prototipo, solo desarrollo).
//
// Adaptado de `engine.js` de Pixel Plays (https://github.com/amirmushichge/pixel-plays), bajo licencia MIT:
//
//   MIT License
//
//   Copyright (c) 2026 Amir Mushich
//
//   Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
//   documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
//   rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
//   permit persons to whom the Software is furnished to do so, subject to the following conditions:
//
//   The above copyright notice and this permission notice shall be included in all copies or substantial portions of
//   the Software.
//
//   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
//   WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS
//   OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
//   OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
//
// Qué se ha tomado: la cámara ortográfica inclinada 30°, el búfer de profundidad, las rampas de color con el matiz
// desplazado (sombras hacia el violeta, luces hacia el amarillo cálido), el tramado Bayer, las cajas con veta, las
// sombras proyectadas, la oclusión horneada y los bordes a partir de la profundidad. Qué cambia: todo vive dentro de una
// instancia (`createRaster`) en vez de en variables globales, el giro de la cámara es configurable (20° en vez de 45°,
// para que la estantería se lea casi de frente en un móvil vertical) y el tamaño del lienzo lo decide la escena.
// No se ha copiado música ni ningún otro recurso del repositorio.

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const COOL = [46, 38, 84];
const WARM = [255, 232, 180];

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);

export function hash(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function noise(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = ease(x - ix);
  const fy = ease(y - iy);
  return lerp(lerp(hash(ix, iy), hash(ix + 1, iy), fx), lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), fx), fy);
}

export const rgb = (r, g, b) => ((255 << 24) | (Math.min(255, Math.max(0, b | 0)) << 16) | (Math.min(255, Math.max(0, g | 0)) << 8) | Math.min(255, Math.max(0, r | 0))) >>> 0;

/**
 * Una instancia de dibujo sobre un lienzo de `W` × `H` píxeles lógicos. `S`: píxeles por unidad del mundo; `yaw`: giro
 * de la cámara (radianes); `ox`, `oy`: dónde cae el origen del mundo. `shadow`: dirección de las sombras por altura.
 */
export function createRaster({ W, H, S, yaw, ox, oy, shadowX = 1.0, shadowY = -0.25 }) {
  const SIN = 0.5;
  const COS = Math.sqrt(3) / 2;
  const ca = Math.cos(yaw);
  const sa = Math.sin(yaw);
  const pix = new Uint32Array(W * H);
  const zb = new Float32Array(W * H);
  const ground = new Uint8Array(W * H);
  const groundZ = new Float32Array(W * H);
  const shadowMask = new Uint8Array(W * H);
  // Qué objeto pinta cada píxel (para tocar sobre el dibujo; 0 = nada). Lo usa «El edificio del puerto».
  const ids = new Uint16Array(W * H);
  let curId = 0;
  const ramps = new Map();

  const bayerAt = (ix, iy) => BAYER[(iy & 3) * 4 + (ix & 3)];

  // Rampa de cinco tonos con el matiz desplazado (como en Pixel Plays)
  function rampOf(c) {
    const key = c.join(',');
    let ramp = ramps.get(key);
    if (ramp) return ramp;
    const mix = (m, tint, k) => rgb(lerp(c[0] * m, tint[0], k), lerp(c[1] * m, tint[1], k), lerp(c[2] * m, tint[2], k));
    ramp = [mix(0.4, COOL, 0.34), mix(0.62, COOL, 0.18), mix(0.84, COOL, 0.05), mix(1, WARM, 0), mix(1.1, WARM, 0.22)];
    ramps.set(key, ramp);
    return ramp;
  }

  function tint(i, r, g, b) {
    const c = pix[i];
    pix[i] = rgb((c & 255) * r, ((c >> 8) & 255) * g, ((c >> 16) & 255) * b);
  }

  function project(x, y, z) {
    const u = x * ca - y * sa;
    const v = x * sa + y * ca;
    return { sx: ox + u * S, sy: oy + (v * SIN - z * COS) * S, d: v * COS + z * SIN };
  }

  /** Punto del mundo bajo un píxel, sobre el plano y = `planeY` (la cara frontal de una balda). */
  function unprojectOnPlaneY(sx, sy, planeY) {
    const x = ((sx - ox) / S + planeY * sa) / ca;
    const v = x * sa + planeY * ca;
    const z = (v * SIN - (sy - oy) / S) / COS;
    return { x, z };
  }

  /** Punto del mundo bajo un píxel, sobre el plano x = `planeX` (una pared lateral). */
  function unprojectOnPlaneX(sx, sy, planeX) {
    const u = (sx - ox) / S;
    const y = (planeX * ca - u) / sa;
    const v = planeX * sa + y * ca;
    const z = (v * SIN - (sy - oy) / S) / COS;
    return { y, z };
  }

  /** Punto del mundo bajo un píxel, sobre un plano horizontal a la altura `z` (el tablero de una mesa). */
  function unprojectAtHeight(sx, sy, z) {
    return unprojectGround(sx, sy + z * COS * S);
  }

  /** Punto del mundo bajo un píxel, sobre el suelo (z = 0). */
  function unprojectGround(sx, sy) {
    const u = (sx - ox) / S;
    const v = (sy - oy) / (S * SIN);
    return { x: u * ca + v * sa, y: -u * sa + v * ca };
  }

  function clear(color) {
    pix.fill(color);
    zb.fill(-1e9);
    ground.fill(0);
    ids.fill(0);
  }

  function paint(x, y, z, ramp, base, grain, overlay) {
    const p = project(x, y, z);
    const ix = p.sx | 0;
    const iy = p.sy | 0;
    if (ix < 0 || iy < 0 || ix >= W || iy >= H) return;
    const i = iy * W + ix;
    if (p.d <= zb[i]) return;
    zb[i] = p.d;
    ids[i] = curId;
    pix[i] = overlay ?? ramp[clamp(Math.floor(base + (grain - 0.5) * 1.3 + (bayerAt(ix, iy) - 0.5) * 0.5), 0, 4)];
  }

  /**
   * Caja con veta (la `box` de Pixel Plays): cara de arriba clara, frente medio y lateral oscuro. `face(face, a, b)`
   * opcional devuelve un color para pintar detalles (rótulos, franjas) sobre una cara.
   */
  function box(x0, y0, z0, x1, y1, z1, c, { seed = 0, grain = 1, face = null, step = 0.045 } = {}) {
    const ramp = rampOf(c);
    const g = (a, b) => (grain ? noise(a, b) : 0.5);
    const longX = x1 - x0 >= y1 - y0;
    for (let a = x0; a <= x1; a += step) for (let b = y0; b <= y1; b += step) paint(a, b, z1, ramp, 3.4, longX ? g(a * 0.8 + seed, b * 9) : g(a * 9, b * 0.8 + seed), face?.('top', a, b));
    for (let a = x0; a <= x1; a += step) for (let b = z0; b <= z1; b += step) paint(a, y1, b, ramp, 2.3, g(a * 0.8 + seed, b * 9), face?.('front', a, b));
    for (let a = y0; a <= y1; a += step) for (let b = z0; b <= z1; b += step) paint(x1, a, b, ramp, 1.2, g(a * 0.8 + seed, b * 9), face?.('side', a, b));
  }

  /** Suelo plano: marca los píxeles como «suelo» para las sombras y la oclusión. */
  function floor(colorAt) {
    for (let iy = 0; iy < H; iy += 1) {
      for (let ix = 0; ix < W; ix += 1) {
        const g = unprojectGround(ix + 0.5, iy + 0.5);
        const c = colorAt(g.x, g.y, ix, iy);
        if (!c) continue;
        const i = iy * W + ix;
        pix[i] = c;
        ground[i] = 1;
        ids[i] = curId;
        zb[i] = (g.x * sa + g.y * ca) * COS;
      }
    }
    groundZ.set(zb);
  }

  function castShadow(x, y, z, r, strength = 1, dither = 0.4) {
    const p = project(x + shadowX * z, y + shadowY * z, 0);
    const rx = r * S * 1.05;
    const ry = rx * SIN + 1;
    const y0 = Math.max(0, Math.floor(p.sy - ry));
    const y1 = Math.min(H - 1, Math.ceil(p.sy + ry));
    const x0 = Math.max(0, Math.floor(p.sx - rx));
    const x1 = Math.min(W - 1, Math.ceil(p.sx + rx));
    for (let iy = y0; iy <= y1; iy += 1) {
      for (let ix = x0; ix <= x1; ix += 1) {
        const dx = (ix + 0.5 - p.sx) / rx;
        const dy = (iy + 0.5 - p.sy) / ry;
        if (dx * dx + dy * dy + (bayerAt(ix, iy) - 0.5) * dither > 1) continue;
        const i = iy * W + ix;
        if (shadowMask[i] < strength) shadowMask[i] = strength;
      }
    }
  }

  function applyShadows() {
    for (let i = 0; i < pix.length; i += 1) {
      const s = shadowMask[i];
      if (!s) continue;
      shadowMask[i] = 0;
      if (!ground[i] || zb[i] !== groundZ[i]) continue;
      if (s === 1) tint(i, 0.62, 0.6, 0.76);
      else tint(i, 0.42, 0.4, 0.6);
    }
  }

  /** Oclusión horneada alrededor de lo que toca el suelo. */
  function bakeOcclusion() {
    const offsets = [];
    for (const r of [2, 4]) for (let k = 0; k < 8; k += 1) offsets.push([Math.round(Math.cos((k * Math.PI) / 4) * r), Math.round(Math.sin((k * Math.PI) / 4) * r * 0.7)]);
    for (let iy = 4; iy < H - 4; iy += 1) {
      for (let ix = 4; ix < W - 4; ix += 1) {
        const i = iy * W + ix;
        if (!ground[i] || zb[i] !== groundZ[i]) continue;
        let hits = 0;
        for (const [ox2, oy2] of offsets) {
          const j = (iy + oy2) * W + ix + ox2;
          if (zb[j] !== groundZ[j]) hits += 1;
        }
        if (!hits) continue;
        if (hits >= 8) tint(i, 0.6, 0.58, 0.74);
        else if (hits / 8 > bayerAt(ix, iy)) tint(i, 0.78, 0.76, 0.86);
      }
    }
  }

  /** Bordes de píxel a partir de la profundidad: silueta oscura sobre el suelo y un filo cálido sobre otro objeto. */
  function shadeEdges() {
    const GRADIENT_Y = COS / (S * SIN);
    const EDGE = 0.28;
    for (let iy = 1; iy < H - 1; iy += 1) {
      for (let ix = 1; ix < W - 1; ix += 1) {
        const i = iy * W + ix;
        const d = zb[i];
        if (d < -1e8 || d === groundZ[i]) continue;
        const a = i - W;
        const b = i + W;
        const c = i - 1;
        const e = i + 1;
        if (zb[a] === groundZ[a] || zb[b] === groundZ[b] || zb[c] === groundZ[c] || zb[e] === groundZ[e] || zb[a] < -1e8 || zb[c] < -1e8 || zb[e] < -1e8 || zb[b] < -1e8) {
          tint(i, 0.7, 0.68, 0.78);
        } else if (d - zb[a] - GRADIENT_Y > EDGE || d - zb[c] > EDGE) {
          const p = pix[i];
          pix[i] = rgb(lerp(p & 255, WARM[0], 0.3), lerp((p >> 8) & 255, WARM[1], 0.3), lerp((p >> 16) & 255, WARM[2], 0.22));
        } else if (zb[e] - d > EDGE || zb[b] - GRADIENT_Y - d > EDGE) {
          tint(i, 0.76, 0.74, 0.84);
        }
      }
    }
  }

  /** Línea de píxeles (para contornos de la previsualización), opcionalmente discontinua. */
  function line(x0, y0, x1, y1, color, dash = 0) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let k = 0; k <= n; k += 1) {
      if (dash && Math.floor(k / dash) % 2) continue;
      const ix = Math.round(lerp(x0, x1, k / n));
      const iy = Math.round(lerp(y0, y1, k / n));
      if (ix >= 0 && iy >= 0 && ix < W && iy < H) pix[iy * W + ix] = color;
    }
  }

  const setId = (n) => {
    curId = n;
  };

  return { W, H, S, pix, zb, ids, setId, unprojectOnPlaneX, unprojectAtHeight, project, unprojectOnPlaneY, unprojectGround, clear, rampOf, box, floor, castShadow, applyShadows, bakeOcclusion, shadeEdges, line, tint, bayerAt };
}
