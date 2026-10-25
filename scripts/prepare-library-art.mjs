// Preparación reproducible de las texturas gouache de la librería (SPEC §27.1).
// Lee los originales de `art-inbox/library-refresh/` (no se modifican ni se publican) y escribe derivados WebP
// en `public/art/library-refresh/` más `manifest.json` con dimensiones, recortes y medidas usadas por el CSS.
// Uso: npm run art:library
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'art-inbox', 'library-refresh');
const OUT = path.join(ROOT, 'public', 'art', 'library-refresh');

// Alfa del cuerpo de las pinturas: 224–254 (bruma del generador). Se vuelve opaco para que no transparente la
// madera; los bordes (alfa < 224) se conservan tal cual.
const ALPHA_BODY = 224;
// Umbral para recortar el lienzo transparente sobrante.
const ALPHA_TRIM = 16;

const ASSETS = [
  { id: 'panel', file: 'shelf-back-panel.png', max: { side: 1024 }, quality: 74, trim: false },
  { id: 'plank', file: 'shelf-plank.png', max: { width: 1536 }, quality: 80, trim: true },
  { id: 'ivy', file: 'shelf-ivy-corner.png', max: { side: 512 }, quality: 82, trim: true },
  { id: 'journal', file: 'journal-paper.png', max: { side: 768 }, quality: 72, trim: false },
  { id: 'letter', file: 'review-letter-paper.png', max: { side: 1024 }, quality: 76, trim: true },
];

/** Caja con alfa > umbral (px del original). */
function alphaBox(data, width, height, channels) {
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * channels + 3] > ALPHA_TRIM) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

/** Tamaño final sin ampliar nunca. */
function fit(w, h, max) {
  const k = Math.min(1, max.side ? max.side / Math.max(w, h) : max.width / w);
  return { width: Math.round(w * k), height: Math.round(h * k), scale: k };
}

/** Fila de la línea brillante del canto y comienzo del canto de la balda (px del derivado). */
function measurePlank(data, width, height, channels) {
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    let sum = 0;
    let n = 0;
    for (let x = Math.round(width * 0.2); x < width * 0.8; x += 2) {
      const i = (y * width + x) * channels;
      if (data[i + 3] < 200) continue;
      sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      n += 1;
    }
    rows.push(n ? sum / n : 0);
  }
  // La línea de luz del canto es el máximo de luminancia entre el 25 % y el 60 % de la altura
  let edge = Math.round(height * 0.25);
  for (let y = edge; y < height * 0.6; y += 1) if (rows[y] > rows[edge]) edge = y;
  return { edgeLight: edge, rows };
}

async function prepare(asset) {
  const input = path.join(SRC, asset.file);
  const original = await sharp(input).metadata();
  let img = sharp(input).ensureAlpha();
  let crop = { left: 0, top: 0, width: original.width, height: original.height };
  if (asset.trim) {
    const { data, info } = await img.clone().raw().toBuffer({ resolveWithObject: true });
    crop = alphaBox(data, info.width, info.height, info.channels);
    img = sharp(input).ensureAlpha().extract(crop);
  }
  const size = fit(crop.width, crop.height, asset.max);
  const { data, info } = await img.resize(size.width, size.height, { kernel: 'lanczos3' }).raw().toBuffer({ resolveWithObject: true });
  let partialAlpha = 0;
  for (let i = 3; i < data.length; i += info.channels) {
    if (data[i] >= ALPHA_BODY) data[i] = 255;
    else partialAlpha += 1;
  }
  const opaque = partialAlpha === 0;
  const out = path.join(OUT, `${asset.id}.webp`);
  const pipeline = sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } });
  await (opaque ? pipeline.removeAlpha() : pipeline).webp({ quality: asset.quality, alphaQuality: 90, effort: 6, smartSubsample: true }).toFile(out);
  const bytes = (await stat(out)).size;
  const entry = {
    file: `${asset.id}.webp`,
    source: asset.file,
    sourceSize: [original.width, original.height],
    crop: [crop.left, crop.top, crop.width, crop.height],
    size: [info.width, info.height],
    scale: Number(size.scale.toFixed(4)),
    alpha: !opaque,
    bytes,
  };
  if (asset.id === 'plank') {
    const m = measurePlank(data, info.width, info.height, info.channels);
    // Superficie superior: desde el borde superior pintado hasta la línea de luz; los libros apoyan a media
    // superficie (vista ligeramente cenital), el canto frontal empieza bajo la línea de luz.
    entry.surfaceTop = 0;
    entry.edgeLight = m.edgeLight;
    entry.baseline = Math.round(m.edgeLight * 0.66);
    entry.baselineRatio = Number((entry.baseline / info.height).toFixed(3));
    entry.capSlice = 44;
  }
  if (asset.id === 'letter') entry.slice = 40;
  return entry;
}

await mkdir(OUT, { recursive: true });
const manifest = { generatedBy: 'scripts/prepare-library-art.mjs', assets: {} };
let total = 0;
for (const asset of ASSETS) {
  const entry = await prepare(asset);
  manifest.assets[asset.id] = entry;
  total += entry.bytes;
  console.log(`${entry.file.padEnd(14)} ${entry.size.join('×').padEnd(10)} ${(entry.bytes / 1024).toFixed(1)} KB`);
}
manifest.totalBytes = total;
await writeFile(path.join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Total ${(total / 1024).toFixed(1)} KB`);
// Comprobación: los originales siguen intactos (solo se leen)
await readFile(path.join(SRC, ASSETS[0].file));
