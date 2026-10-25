// Derivados de los recursos de la 1.36.0 (SPEC §29.1): cabecera mediterránea, cuaderno de cuero y módulo de balda.
// Lee los originales de `material-diseno/` (no se modifican) y escribe WebP en `public/assets/ui/` y
// `public/assets/library/` más `manifest.json` con las medidas que usa el CSS. Uso: npm run art:mediterranean
import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'material-diseno');
const UI = path.join(ROOT, 'public', 'assets', 'ui');
const LIB = path.join(ROOT, 'public', 'assets', 'library');
await mkdir(UI, { recursive: true });
await mkdir(LIB, { recursive: true });
const size = async (f) => (await stat(f)).size;
const manifest = {};

// ── Cabecera: proporción original 2021 × 778 (2,6:1), sin recortes; dos anchos ──
{
  const src = path.join(SRC, 'Rincón mediterráneo entre libros y mar-2.png');
  for (const w of [1600, 800]) {
    const out = path.join(LIB, `header-${w}.webp`);
    await sharp(src).resize({ width: w }).webp({ quality: 80, effort: 6 }).toFile(out);
  }
  const m = await sharp(src).metadata();
  manifest.header = { source: 'Rincón mediterráneo entre libros y mar-2.png', width: m.width, height: m.height, ratio: +(m.width / m.height).toFixed(4), files: ['header-1600.webp', 'header-800.webp'], wall: { from: 0.2, to: 0.6 }, shelfTop: +(680 / 778).toFixed(4) };
}

// ── Cuaderno: el cuerpo (alfa 253) se vuelve opaco y el halo rojo de alfa < 16 se elimina; se recorta a su caja.
// Para no estirar las anillas se compone un derivado: tira superior sin anilla + UN periodo de anilla (repetible)
// + tira inferior sin anilla. El CSS lo pinta con border-image en nueve regiones (vertical «round»). ──
{
  const src = path.join(SRC, 'Marco de cuero con página en blanco-1.png');
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 16) data[i] = 0;
    else if (data[i] >= 224) data[i] = 255;
  }
  const clean = sharp(data, { raw: info });
  const box = { left: 25, top: 58, width: 838, height: 1678 }; // caja con alfa medida (x 25–862, y 58–1735)
  const trimmed = await clean.extract(box).png().toBuffer();
  // Medidas en la imagen recortada: anillas en y ≈ 131, 232, 336, 435… (periodo ≈ 106); tramo [182, 288) contiene
  // una anilla centrada; tira superior [0, 30) (tapa y canto, sin anilla); tira inferior [1590, 1678) (hojas y tapa)
  const TOP = 30;
  const PERIOD = [182, 288];
  const BOTTOM = [1590, 1678];
  const part = (top, height) => sharp(trimmed).extract({ left: 0, top, width: box.width, height }).png().toBuffer();
  const pieces = [await part(0, TOP), await part(PERIOD[0], PERIOD[1] - PERIOD[0]), await part(BOTTOM[0], BOTTOM[1] - BOTTOM[0])];
  const H = TOP + (PERIOD[1] - PERIOD[0]) + (BOTTOM[1] - BOTTOM[0]);
  const out = path.join(UI, 'notebook-frame.webp');
  await sharp({ create: { width: box.width, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: pieces[0], top: 0, left: 0 },
      { input: pieces[1], top: TOP, left: 0 },
      { input: pieces[2], top: TOP + PERIOD[1] - PERIOD[0], left: 0 },
    ])
    .webp({ quality: 84, alphaQuality: 90, effort: 6 })
    .toFile(out);
  // Página suelta (solo papel) para hojas interiores que no llevan marco
  manifest.notebook = {
    source: 'Marco de cuero con página en blanco-1.png',
    file: 'notebook-frame.webp',
    width: box.width,
    height: H,
    slice: { top: TOP, right: 60, bottom: BOTTOM[1] - BOTTOM[0], left: 96 },
    ringPeriod: PERIOD[1] - PERIOD[0],
    note: 'tira superior + 1 periodo de anilla + tira inferior; border-image vertical round',
  };
}

// ── Módulo de balda: se usa el tramo y 46–930 (sin travesaño superior ni el resto de la balda de abajo): el canto de
// una balda hace de techo de la siguiente y nunca se duplican travesaños. Travesaño aparte para la primera. ──
{
  const src = path.join(SRC, 'Compartimento de madera mediterránea vacío-3.png');
  const mod = path.join(LIB, 'shelf-module.webp');
  await sharp(src).extract({ left: 0, top: 46, width: 1612, height: 884 }).webp({ quality: 80, effort: 6 }).toFile(mod);
  const bar = path.join(LIB, 'shelf-crossbar.webp');
  await sharp(src).extract({ left: 0, top: 0, width: 1612, height: 50 }).webp({ quality: 80, effort: 6 }).toFile(bar);
  // Madera clara del canto frontal como superficie de la franja de herramientas
  const light = path.join(LIB, 'wood-light.webp');
  await sharp(src).extract({ left: 120, top: 800, width: 1360, height: 124 }).webp({ quality: 80, effort: 6 }).toFile(light);
  manifest.shelf = {
    source: 'Compartimento de madera mediterránea vacío-3.png',
    module: { file: 'shelf-module.webp', width: 1612, height: 884, slice: { top: 30, right: 107, bottom: 208, left: 105 }, surfaceTop: 676, frontEdgeTop: 749, bookBase: 719 },
    crossbar: { file: 'shelf-crossbar.webp', width: 1612, height: 50 },
    woodLight: { file: 'wood-light.webp', width: 1360, height: 124 },
  };
}

for (const dir of [UI, LIB]) for (const k of Object.keys(manifest)) manifest[k].bytes ??= {};
manifest.header.bytes = { 1600: await size(path.join(LIB, 'header-1600.webp')), 800: await size(path.join(LIB, 'header-800.webp')) };
manifest.notebook.bytes = await size(path.join(UI, 'notebook-frame.webp'));
manifest.shelf.bytes = { module: await size(path.join(LIB, 'shelf-module.webp')), crossbar: await size(path.join(LIB, 'shelf-crossbar.webp')), woodLight: await size(path.join(LIB, 'wood-light.webp')) };
await writeFile(path.join(LIB, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 1));

// ── 1.37.0 · Placas de latón y marcapáginas (SPEC §30.1). Recorte a la caja con alfa medida; las placas sencillas
// se pintan en tres cortes horizontales (los extremos con cadenas o escuadras no se estiran). ──
{
  const OUT = path.join(ROOT, 'public', 'assets', 'ui');
  const items = [
    // id, archivo, caja (left, top, width, height), ancho final, cortes laterales en px del derivado
    ['plaque-hanging', 'Placa colgante de estantería en latón antiguo-1 (1).png', [102, 19, 1785, 733], 560, null],
    ['plaque-chains', 'Placa de latón con cadenas-4 (1).png', [54, 290, 1875, 421], 640, 92],
    ['plaque-brackets', 'Placa de latón envejecido sin texto-2 (1).png', [70, 170, 1844, 436], 640, 86],
    ['plaque-strap', 'Placa de latón para estantería-3 (1).png', [74, 127, 2025, 431], 560, null],
    ['bookmark-olive', 'Marcapáginas de cuero oliva y latón.png', [259, 130, 290, 1676], 160, null],
  ];
  manifest.plaques = {};
  for (const [id, file, [left, top, width, height], w, side] of items) {
    const out = path.join(OUT, `${id}.webp`);
    const img = sharp(path.join(SRC, file)).extract({ left, top, width, height }).resize({ width: w });
    await img.webp({ quality: 84, alphaQuality: 92, effort: 6 }).toFile(out);
    const m = await sharp(out).metadata();
    manifest.plaques[id] = { source: file, file: `${id}.webp`, width: m.width, height: m.height, side, bytes: await size(out) };
  }
  await writeFile(path.join(LIB, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}
