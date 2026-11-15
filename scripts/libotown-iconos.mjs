// Iconos de Libotown (1.136, SPEC §136.5) a partir del material de Francisco. Los originales no van a git: están en
// `libotown-marca/`, junto a la carpeta del proyecto. Uso: node scripts/libotown-iconos.mjs [carpeta de los originales]
//
// - El icono de la cabeza llega con fondo transparente, pero el gato está al 99 % de opacidad y lleva un halo casi
//   invisible alrededor: se limpia (opaco o transparente del todo) y se recorta a lo que ocupa.
// - Fondo de marca: el marrón del logo con nombre (#351c0e), el mismo de la pantalla de carga y del manifest.
// - Nada se dibuja nuevo: solo se escala, se centra y se compone sobre ese fondo.
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ORIGEN = process.argv[2] ?? '../libotown-marca';
const DESTINO = 'public/icons';
export const FONDO = { r: 53, g: 28, b: 14, alpha: 1 };

mkdirSync(DESTINO, { recursive: true });

/** El gato de la cabeza, limpio y recortado, en RGBA. */
async function gatoLimpio() {
  const { data, info } = await sharp(join(ORIGEN, 'libotown-icono-cabeza.png')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 3; i < data.length; i += 4) data[i] = data[i] >= 110 ? 255 : 0;
  const limpio = await sharp(data, { raw: info }).png().toBuffer();
  return sharp(limpio)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 0 })
    .png()
    .toBuffer();
}

const gato = await gatoLimpio();
const { width: GW, height: GH } = await sharp(gato).metadata();
console.log(`gato recortado: ${GW} × ${GH}`);

/** El gato a `ancho` px de ancho (manteniendo la proporción). */
const gatoA = (ancho) =>
  sharp(gato)
    .resize({ width: Math.round(ancho), kernel: 'lanczos3' })
    .png()
    .toBuffer();

/** Un cuadrado de `lado` px con el gato a `proporcion` del ancho, centrado, sobre el fondo de marca o transparente. */
async function cuadrado(lado, proporcion, fondo = FONDO) {
  const g = await gatoA(lado * proporcion);
  const { width, height } = await sharp(g).metadata();
  return sharp({ create: { width: lado, height: lado, channels: 4, background: fondo } })
    .composite([{ input: g, left: Math.round((lado - width) / 2), top: Math.round((lado - height) / 2) }])
    .png({ compressionLevel: 9, palette: true, quality: 95, effort: 10 })
    .toBuffer();
}

const TRANSPARENTE = { r: 0, g: 0, b: 0, alpha: 0 };
const salidas = {
  // «any»: el gato al 70 % sobre el marrón, a sangre (Android lo usa también en la pantalla de arranque)
  'libotown-512.png': await cuadrado(512, 0.7),
  'libotown-192.png': await cuadrado(192, 0.7),
  // «maskable»: todo el gato dentro de la zona segura (el círculo del 80 % central)
  'libotown-maskable-512.png': await cuadrado(512, 0.58),
  'libotown-maskable-192.png': await cuadrado(192, 0.58),
  // iPhone: sin transparencia (iOS la rellena de negro) y el sistema redondea las esquinas
  'libotown-apple-180.png': await cuadrado(180, 0.72),
};
for (const [nombre, png] of Object.entries(salidas)) writeFileSync(join(DESTINO, nombre), png);

// Favicon: el gato solo, sin fondo, ocupando el cuadrado (legible en pestañas claras y oscuras)
const fav128 = await cuadrado(128, 1, TRANSPARENTE);
const svg = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">',
  '<title>Libotown</title>',
  `<image width="64" height="64" href="data:image/png;base64,${fav128.toString('base64')}"/>`,
  '</svg>',
  '',
].join(String.fromCharCode(10));
writeFileSync(join(DESTINO, 'libotown.svg'), svg);

// favicon.ico con 16, 32 y 48 px (PNG dentro del ICO): es lo que piden por defecto algunos navegadores
const icoTallas = [16, 32, 48];
const icoPngs = await Promise.all(icoTallas.map((t) => cuadrado(t, 1, TRANSPARENTE)));
const cabecera = Buffer.alloc(6 + 16 * icoTallas.length);
cabecera.writeUInt16LE(0, 0);
cabecera.writeUInt16LE(1, 2);
cabecera.writeUInt16LE(icoTallas.length, 4);
let desplazamiento = cabecera.length;
icoTallas.forEach((t, k) => {
  const o = 6 + 16 * k;
  cabecera.writeUInt8(t, o);
  cabecera.writeUInt8(t, o + 1);
  cabecera.writeUInt8(0, o + 2);
  cabecera.writeUInt8(0, o + 3);
  cabecera.writeUInt16LE(1, o + 4);
  cabecera.writeUInt16LE(32, o + 6);
  cabecera.writeUInt32LE(icoPngs[k].length, o + 8);
  cabecera.writeUInt32LE(desplazamiento, o + 12);
  desplazamiento += icoPngs[k].length;
});
writeFileSync('public/favicon.ico', Buffer.concat([cabecera, ...icoPngs]));

// El logo con nombre, para la pantalla de carga (hasta 420 px de ancho en pantalla, a doble densidad)
await sharp(join(ORIGEN, 'libotown-logo-con-nombre.webp')).resize({ width: 840, kernel: 'lanczos3' }).webp({ quality: 88 }).toFile(join(DESTINO, 'libotown-logo.webp'));

// Imagen al compartir el enlace (1200 × 630): el logo a toda la altura, sobre el mismo marrón
const logo630 = await sharp(join(ORIGEN, 'libotown-logo-con-nombre.webp')).resize({ height: 630, kernel: 'lanczos3' }).png().toBuffer();
const { width: LW } = await sharp(logo630).metadata();
await sharp({ create: { width: 1200, height: 630, channels: 3, background: FONDO } })
  .composite([{ input: logo630, left: Math.round((1200 - LW) / 2), top: 0 }])
  .jpeg({ quality: 88, mozjpeg: true })
  .toFile(join(DESTINO, 'libotown-compartir.jpg'));

console.log('listo:', [...Object.keys(salidas), 'libotown.svg', '../favicon.ico', 'libotown-logo.webp', 'libotown-compartir.jpg'].join(', '));
