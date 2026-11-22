// Libo, el gato guía (docs/qa/libo.md): recorta la mascota de Francisco de su fondo marrón y la deja lista para la app.
// El original está fuera del repositorio, en `libotown-marca/` junto a la carpeta del proyecto (como los iconos, §136.5).
// Uso: node scripts/libo-recorte.mjs [carpeta de los originales]
// El fondo se quita rellenando desde los bordes (no por color en toda la imagen: la nariz y las sombras son casi del mismo
// marrón), con un borde suavizado de un píxel.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const ORIGEN = process.argv[2] ?? '../libotown-marca';
const DESTINO = join('public', 'assets', 'libo');
const TOLERANCIA = 16;

const { data, info } = await sharp(join(ORIGEN, 'libotown-mascota.webp')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;
const at = (x, y) => (y * W + x) * 4;
// El color del fondo: la media de las cuatro esquinas
const esquinas = [at(0, 0), at(W - 1, 0), at(0, H - 1), at(W - 1, H - 1)];
const fondo = [0, 1, 2].map((c) => esquinas.reduce((s, i) => s + data[i + c], 0) / 4);
const lejos = (i) => Math.hypot(data[i] - fondo[0], data[i + 1] - fondo[1], data[i + 2] - fondo[2]);

const fuera = new Uint8Array(W * H);
const pila = [];
for (let x = 0; x < W; x += 1) pila.push(x, x + (H - 1) * W);
for (let y = 0; y < H; y += 1) pila.push(y * W, y * W + W - 1);
while (pila.length) {
  const p = pila.pop();
  if (fuera[p]) continue;
  if (lejos(p * 4) > TOLERANCIA) continue;
  fuera[p] = 1;
  const x = p % W;
  const y = (p - x) / W;
  if (x > 0) pila.push(p - 1);
  if (x < W - 1) pila.push(p + 1);
  if (y > 0) pila.push(p - W);
  if (y < H - 1) pila.push(p + W);
}
// Transparente lo de fuera; el borde, a medias (suaviza la escalera sin emborronar los vóxeles)
for (let p = 0; p < W * H; p += 1) {
  if (fuera[p]) {
    data[p * 4 + 3] = 0;
    continue;
  }
  const x = p % W;
  const vecinos = [p - 1, p + 1, p - W, p + W].filter((q) => q >= 0 && q < W * H && Math.abs((q % W) - x) <= 1);
  if (vecinos.some((q) => fuera[q])) data[p * 4 + 3] = 170;
}

mkdirSync(DESTINO, { recursive: true });
const recortada = await sharp(data, { raw: { width: W, height: H, channels: 4 } }).trim({ threshold: 1 }).png().toBuffer();
const meta = await sharp(recortada).metadata();
console.log('recorte', meta.width, '×', meta.height);
// Dos tamaños: la esquina (pequeño) y la guía (grande), en WebP con transparencia
for (const [nombre, alto] of [
  ['libo-320.webp', 320],
  ['libo-640.webp', 640],
]) {
  await sharp(recortada).resize({ height: alto, kernel: 'lanczos3' }).webp({ quality: 90, alphaQuality: 100 }).toFile(join(DESTINO, nombre));
  console.log(nombre);
}
