// Ayudantes de los dibujos de píxel del hotel (la Lonja, `hotel/lonjaArt.js`): la luz de tarde, pasar el dibujo a imagen y
// el contorno de lo que se toca. Vivían en `shopRoom.js`, la tienda isométrica del bajo, retirada en la 1.155
// (docs/qa/amigos-vecinos.md, bloque 5).
import { rgb } from '../minigames/libreria-puerto/raster';

/** Bit de los ids que marca lo que da luz propia (no se oscurece de tarde). */
export const GLOW = 0x8000;
const LIT = [255, 228, 164];

/** Luz de tarde, como en los pisos: todo un poco más oscuro y tintado, y cada luz alumbra a su alrededor. */
export function evening(r, lights, radius) {
  const pts = lights.map(([x, y, z]) => r.project(x, y, z));
  const lit = r.rampOf(LIT);
  const { pix, ids, W } = r;
  for (let i = 0; i < pix.length; i += 1) {
    if (r.zb[i] < -1e8) continue;
    const p = pix[i];
    // Un píxel vacío (0) es transparente: el sobre tumbado tiene huecos entre los dientes
    if (!p) continue;
    if (ids[i] & GLOW) {
      const lum = ((p & 255) + ((p >> 8) & 255) + ((p >> 16) & 255)) / 765;
      pix[i] = lit[lum > 0.75 ? 4 : lum > 0.5 ? 3 : 2];
      continue;
    }
    const ix = i % W;
    const iy = (i / W) | 0;
    let g = 0;
    for (const l of pts) {
      const d = Math.hypot(ix - l.sx, (iy - l.sy) * 1.25) / radius;
      if (d < 1) g += (1 - d) ** 1.7;
    }
    g = Math.min(1, g);
    pix[i] = rgb((p & 255) * (0.72 + g * 0.45), ((p >> 8) & 255) * (0.66 + g * 0.38), ((p >> 16) & 255) * (0.8 + g * 0.06));
  }
}

export function toDataURL(r, fill, k = 1) {
  const c = document.createElement('canvas');
  c.width = r.W;
  c.height = r.H;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(r.W, r.H);
  for (let i = 0; i < r.pix.length; i += 1) if (!r.pix[i] || r.zb[i] < -1e8) r.pix[i] = fill(i % r.W, (i / r.W) | 0);
  img.data.set(new Uint8ClampedArray(r.pix.buffer));
  ctx.putImageData(img, 0, 0);
  if (k === 1) return c.toDataURL();
  const big = document.createElement('canvas');
  big.width = r.W * k;
  big.height = r.H * k;
  const bctx = big.getContext('2d');
  bctx.imageSmoothingEnabled = false;
  bctx.drawImage(c, 0, 0, big.width, big.height);
  return big.toDataURL();
}

/** El contorno de una sección: los píxeles de fuera que tocan a los suyos, en dorado (se enciende el de la elegida). */
export function outlineOf(r, id) {
  const { W, H, ids } = r;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(W, H);
  const out = new Uint32Array(img.data.buffer);
  const is = (x, y) => x >= 0 && y >= 0 && x < W && y < H && (ids[y * W + x] & ~GLOW) === id;
  for (let y = 0; y < H; y += 1)
    for (let x = 0; x < W; x += 1) {
      if (is(x, y)) continue;
      if (is(x - 1, y) || is(x + 1, y) || is(x, y - 1) || is(x, y + 1)) out[y * W + x] = rgb(255, 222, 120);
      else if (is(x - 1, y - 1) || is(x + 1, y - 1) || is(x - 1, y + 1) || is(x + 1, y + 1)) out[y * W + x] = rgb(122, 70, 36);
    }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL();
}
