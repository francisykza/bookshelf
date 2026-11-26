// Las poses de Libo (Francisco, 26-11-2026: «te paso a libo en diferentes poses, añádelas a lo largo de la app, para que parezca
// que libo está vivo y le dé más alegría»). Recorta las 15 poses de su hoja (fondo negro) y las deja en
// `public/assets/libo/poses/`, todas en un lienzo del mismo tamaño y a la misma escala, apoyadas abajo: así, al cambiar de pose,
// Libo no cambia de tamaño ni salta. El original está fuera del repositorio, en `libotown-marca/` (como la mascota, §136.5).
// Uso: node scripts/libo-poses.mjs [hoja de poses]
// El fondo se quita por lo que está unido a los bordes y casi negro (máx. ≤ 16): el gatito negro de la pose 13 (≈ 40) y los ojos
// se quedan. El borde se suaviza según lo oscuro que sea (el halo negro de la compresión se vuelve transparente).
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const ORIGEN = process.argv[2] ?? '../libotown-marca/libo-poses.webp';
const DESTINO = join('public', 'assets', 'libo', 'poses');
// En el orden de la hoja: por filas, de izquierda a derecha
export const POSES = ['de-pie', 'saluda', 'lee', 'camina', 'celebra', 'duerme', 'duda', 'carino', 'enfado', 'sorpresa', 'abraza', 'corre', 'gatito', 'asoma', 'espaldas'];
const LIENZO = { w: 420, h: 400 };
// La hoja dibuja la 2.ª y la 3.ª fila más pequeñas que la 1.ª (de pie, ≈ 300 px frente a 365): se igualan para que Libo tenga
// siempre el mismo tamaño
const ESCALA_FILA = [1, 1.2, 1.2];
const NEGRO = 16;

const { data, info } = await sharp(ORIGEN).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;
const brillo = (p) => Math.max(data[p * 3], data[p * 3 + 1], data[p * 3 + 2]);

// Fondo: lo casi negro unido a los bordes
const fondo = new Uint8Array(W * H);
const pila = [];
for (let x = 0; x < W; x += 1) pila.push(x, x + (H - 1) * W);
for (let y = 0; y < H; y += 1) pila.push(y * W, y * W + W - 1);
while (pila.length) {
  const p = pila.pop();
  if (fondo[p] || brillo(p) > NEGRO) continue;
  fondo[p] = 1;
  const x = p % W;
  if (x > 0) pila.push(p - 1);
  if (x < W - 1) pila.push(p + 1);
  if (p >= W) pila.push(p - W);
  if (p < W * (H - 1)) pila.push(p + W);
}

// Las piezas (cada pose y sus adornos sueltos: «!», «?», corazones, «zZ», el polvo al correr)
const etiqueta = new Int32Array(W * H).fill(-1);
const piezas = [];
for (let s = 0; s < W * H; s += 1) {
  if (fondo[s] || etiqueta[s] >= 0) continue;
  const id = piezas.length;
  const pz = { id, n: 0, x0: W, y0: H, x1: 0, y1: 0 };
  const cola = [s];
  etiqueta[s] = id;
  while (cola.length) {
    const p = cola.pop();
    pz.n += 1;
    const x = p % W;
    const y = (p - x) / W;
    pz.x0 = Math.min(pz.x0, x);
    pz.x1 = Math.max(pz.x1, x);
    pz.y0 = Math.min(pz.y0, y);
    pz.y1 = Math.max(pz.y1, y);
    for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p >= W ? p - W : -1, p < W * (H - 1) ? p + W : -1]) {
      if (q >= 0 && !fondo[q] && etiqueta[q] < 0) {
        etiqueta[q] = id;
        cola.push(q);
      }
    }
  }
  piezas.push(pz);
}
// Los 15 cuerpos son las piezas grandes; se ordenan por fila y, dentro de cada una, de izquierda a derecha
const fila = (pz) => (pz.y0 < 200 ? 0 : pz.y0 < 600 ? 1 : 2);
const cuerpos = piezas
  .filter((pz) => pz.n > 20000)
  .sort((a, b) => fila(a) - fila(b) || a.x0 - b.x0);
if (cuerpos.length !== POSES.length) throw new Error(`Esperaba ${POSES.length} poses y hay ${cuerpos.length}`);
// Cada adorno va con el cuerpo más cercano (los motas de menos de 30 px, fuera)
const centro = (pz) => [(pz.x0 + pz.x1) / 2, (pz.y0 + pz.y1) / 2];
const distancia = (pz, c) => {
  const [x, y] = centro(pz);
  const dx = Math.max(c.x0 - x, 0, x - c.x1);
  const dy = Math.max(c.y0 - y, 0, y - c.y1);
  return Math.hypot(dx, dy);
};
const dueno = new Map();
for (const pz of piezas) {
  if (pz.n < 30) continue;
  let mejor = 0;
  cuerpos.forEach((c, i) => {
    if (distancia(pz, c) < distancia(pz, cuerpos[mejor])) mejor = i;
  });
  if (cuerpos.includes(pz) || distancia(pz, cuerpos[mejor]) < 90) dueno.set(pz.id, mejor);
}

mkdirSync(DESTINO, { recursive: true });
for (let i = 0; i < POSES.length; i += 1) {
  const suyas = piezas.filter((pz) => dueno.get(pz.id) === i);
  const caja = suyas.reduce((c, pz) => ({ x0: Math.min(c.x0, pz.x0), y0: Math.min(c.y0, pz.y0), x1: Math.max(c.x1, pz.x1), y1: Math.max(c.y1, pz.y1) }), { x0: W, y0: H, x1: 0, y1: 0 });
  const w = caja.x1 - caja.x0 + 1;
  const h = caja.y1 - caja.y0 + 1;
  const f = ESCALA_FILA[fila(cuerpos[i])];
  const wf = Math.round(w * f);
  const hf = Math.round(h * f);
  if (wf > LIENZO.w || hf > LIENZO.h - 4) throw new Error(`${POSES[i]} no cabe: ${wf} × ${hf}`);
  const rgba = Buffer.alloc(w * h * 4);
  const ids = new Set(suyas.map((pz) => pz.id));
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const p = (caja.y0 + y) * W + caja.x0 + x;
      const o = (y * w + x) * 4;
      if (!ids.has(etiqueta[p])) continue;
      rgba[o] = data[p * 3];
      rgba[o + 1] = data[p * 3 + 1];
      rgba[o + 2] = data[p * 3 + 2];
      const px = p % W;
      const borde = [px > 0 ? p - 1 : -1, px < W - 1 ? p + 1 : -1, p - W, p + W].some((q) => q >= 0 && q < W * H && fondo[q]);
      // En el borde, lo oscuro es el halo del fondo: cuanto más negro, más transparente
      rgba[o + 3] = borde ? Math.round(255 * Math.min(1, Math.max(0.3, (brillo(p) - NEGRO) / 60))) : 255;
    }
  }
  const pieza = f === 1 ? await sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer() : await sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).resize(wf, hf, { kernel: 'lanczos3' }).png().toBuffer();
  // En el lienzo común: centrada y apoyada abajo (4 px de margen)
  await sharp({ create: { width: LIENZO.w, height: LIENZO.h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: pieza, left: Math.round((LIENZO.w - wf) / 2), top: LIENZO.h - 4 - hf }])
    .webp({ quality: 90, alphaQuality: 100 })
    .toFile(join(DESTINO, `${POSES[i]}.webp`));
  console.log(POSES[i], `${wf} × ${hf}`, `${suyas.length} pieza(s)`);
}
