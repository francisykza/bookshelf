// Derivados de las piezas sueltas de la 1.39.0 (SPEC §31): siete recursos nuevos, cuatro recuerdos, cinco adornos
// de avatar y seis distinciones. Lee los originales de `material-diseno/` (no se modifican: los originales del
// proyecto viven ahí, que hace de `material-diseno/originales/`) y escribe WebP recortados a su silueta visible en
// `public/assets/bookshelf/…` más `manifest.json` con dimensiones, relación de aspecto y alfa. Uso: npm run art:pieces
import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'material-diseno');
const OUT = path.join(ROOT, 'public', 'assets', 'bookshelf');

// [carpeta, nombre de destino, original, ancho máximo del derivado]
const PIECES = [
  ['notebook', 'envelope-sage-open', 'Sobre salvia con papel marfil-1.png', 720],
  ['reading-corner', 'guardian-niche-empty', 'Nicho arqueado de madera vacío-4.png', 720],
  ['notebook', 'open-book-decoration', 'Pequeño libro abierto en gouache mediterráneo-3.png', 360],
  ['notebook', 'book-stack-decoration', 'Pila de tres libros antiguos-2.png', 320],
  ['notebook', 'botanical-sprig', 'Ramita botánica mediterránea en gouache-5.png', 160],
  ['notebook', 'brass-paper-clip', 'Clip bulldog de latón envejecido-6.png', 160],
  ['notebook', 'textile-tab-sage', 'Marcapáginas de lino salvia-7.png', 120],
  ['reading-corner', 'memory-sailboat', 'Velero artesanal de madera-1.png', 256],
  ['reading-corner', 'memory-potted-plant', 'Maceta terracota con hojas de salvia-2.png', 256],
  ['reading-corner', 'memory-inkwell-feather', 'Tintero azul con pluma crema-3.png', 256],
  ['reading-corner', 'memory-rolled-map', 'Mapa imaginario enrollado con cinta salvia-4.png', 320],
  ['profile/adornments', 'avatar-adornment-constellations', 'Adorno azul con luna y estrellas-5.png', 480],
  ['profile/adornments', 'avatar-adornment-dark-academia', 'Arco de hiedra y llave antigua-6.png', 480],
  ['profile/adornments', 'avatar-adornment-letter-garden', 'Arco botánico con flores y lazo-7.png', 480],
  ['profile/adornments', 'avatar-adornment-cherry', 'Arco floral de cerezos y salvia-8.png', 480],
  ['profile/adornments', 'avatar-adornment-ink-forest', 'Arco de helechos con setas y polilla-9.png', 480],
  ['profile/badges', 'badge-monthly-book-moon', 'Libro abierto, cinta azul y media luna-10.png', 128],
  ['profile/badges', 'badge-moderator-lantern', 'Linterna literaria de salvia y ámbar-11.png', 128],
  ['profile/badges', 'badge-weekly-star', 'Lazo terracota con estrella de latón-12.png', 128],
  ['profile/badges', 'badge-creator-key', 'Llave antigua sobre lazo de terciopelo-13.png', 128],
  ['profile/badges', 'badge-team-house-nib', 'Casita de papel con pluma dorada-14.png', 128],
  ['profile/badges', 'badge-founder-letter', 'Sobre con sello de libro abierto-15.png', 128],
];

const manifest = {};
for (const [dir, id, file, width] of PIECES) {
  const src = path.join(SRC, file);
  const buf = await readFile(src);
  const meta = await sharp(buf).metadata();
  await mkdir(path.join(OUT, dir), { recursive: true });
  // Alfa: el halo casi invisible (< 10) se elimina; la silueta se recorta con 2 px de margen
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width;
  let y0 = info.height;
  let x1 = 0;
  let y1 = 0;
  for (let y = 0; y < info.height; y += 1)
    for (let x = 0; x < info.width; x += 1) {
      const i = (y * info.width + x) * 4 + 3;
      if (data[i] < 10) data[i] = 0;
      else {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  const pad = 2;
  const box = { left: Math.max(0, x0 - pad), top: Math.max(0, y0 - pad), width: Math.min(info.width, x1 + pad + 1) - Math.max(0, x0 - pad), height: Math.min(info.height, y1 + pad + 1) - Math.max(0, y0 - pad) };
  const out = path.join(OUT, dir, `${id}.webp`);
  await sharp(data, { raw: info }).extract(box).resize({ width: Math.min(width, box.width) }).webp({ quality: 84, alphaQuality: 92, effort: 6 }).toFile(out);
  const m = await sharp(out).metadata();
  manifest[id] = {
    path: `/assets/bookshelf/${dir}/${id}.webp`,
    source: file,
    md5: createHash('md5').update(buf).digest('hex'),
    original: `${meta.width}x${meta.height}`,
    alpha: Boolean(meta.hasAlpha),
    crop: box,
    width: m.width,
    height: m.height,
    ratio: +(m.width / m.height).toFixed(4),
    bytes: (await stat(out)).size,
  };
}
await writeFile(path.join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
for (const [id, v] of Object.entries(manifest)) console.log(id.padEnd(34), v.width + 'x' + v.height, v.ratio, (v.bytes / 1024).toFixed(1) + 'KB');
