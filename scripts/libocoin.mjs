// La moneda de los Libocoins (Francisco, 27-11-2026; docs/qa/libocoins.md): la dibujó él (Libo leyendo un libro verde, con su
// bufanda, estrellas y libritos alrededor). El original está fuera del repositorio, en `libotown-marca/libocoin.webp` (fondo
// transparente); este script solo lo recorta al borde de la moneda y lo reduce a los tamaños de la app. Nunca se redibuja.
// Uso: node scripts/libocoin.mjs [moneda]
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const ORIGEN = process.argv[2] ?? '../libotown-marca/libocoin.webp';
const DESTINO = join('public', 'assets', 'libo');
// Del icono pequeño junto a una cifra (24 px a 1×, 48 a 2×) a la moneda grande de las celebraciones (96 y 192)
const TAMANOS = [24, 48, 96, 192];

mkdirSync(DESTINO, { recursive: true });
const { data, info } = await sharp(ORIGEN).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
let x0 = info.width;
let y0 = info.height;
let x1 = 0;
let y1 = 0;
for (let y = 0; y < info.height; y += 1)
  for (let x = 0; x < info.width; x += 1)
    if (data[(y * info.width + x) * 4 + 3] > 20) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
// Cuadrado, centrado en la moneda
const lado = Math.max(x1 - x0, y1 - y0) + 1;
const left = Math.max(0, Math.round((x0 + x1 - lado) / 2));
const top = Math.max(0, Math.round((y0 + y1 - lado) / 2));
const recorte = await sharp(ORIGEN)
  .extract({ left, top, width: Math.min(lado, info.width - left), height: Math.min(lado, info.height - top) })
  .png()
  .toBuffer();
for (const n of TAMANOS) {
  const ruta = join(DESTINO, `libocoin-${n}.webp`);
  await sharp(recorte)
    .resize(n, n, { kernel: 'lanczos3', fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 90, alphaQuality: 100 })
    .toFile(ruta);
  console.log(ruta);
}
