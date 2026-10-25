// Organización reproducible del material de diseño (SPEC §28.1).
// Copia (nunca mueve ni sobrescribe) las imágenes de `material-diseno/` a su destino con un nombre descriptivo,
// genera derivados WebP para producción y escribe `docs/design/asset-check.json` con las comprobaciones
// (formato real, dimensiones, alfa, duplicados exactos). Uso: npm run art:design
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'material-diseno');

// Origen → destino. Las maquetas van a docs (referencias, no fondos). `webp`: derivados de producción.
const PLAN = [
  { from: 'Biblioteca mediterránea en madera y gouache.png', to: 'docs/design/references/biblioteca-mediterranea-maqueta.png' },
  { from: 'Placas de latón suspendidas en biblioteca-1.png', to: 'docs/design/references/habitacion-senales-maqueta.png' },
  { from: 'Diario de lectura entre páginas.png', to: 'docs/design/references/diario-general-hoy-maqueta.png' },
  { from: 'Tríptico de diario y voces lectoras.png', to: 'docs/design/references/ficha-diario-resena-lectores-maqueta.png' },
  { from: 'BookShelf_ tres pantallas del salón literario.png', to: 'docs/design/references/salon-rincon-voces-maqueta.png' },
  { from: 'BookShelf_ tres pantallas del salón literario (1).png', duplicateOf: 'BookShelf_ tres pantallas del salón literario.png' },
  { from: 'Alba y las huellas botánicas-2.png', to: 'docs/design/references/perfil-rincon-huellas-maqueta.png' },
  { from: 'Huellas de lector_ tres retratos botánicos.png', to: 'docs/design/references/huellas-adornos-avatar-maqueta.png' },
  { from: 'Rincón mediterráneo junto al mar.png', to: 'public/assets/profile/rincon-dia.png', webp: [1536, 768], quality: 80 },
  { from: 'Rincón mediterráneo bajo la lluvia.png', to: 'public/assets/profile/rincon-lluvia.png', webp: [1536, 768], quality: 80 },
  { from: 'Rincón de lectura ante la bahía nocturna.png', to: 'public/assets/profile/rincon-noche.png', webp: [1536, 768], quality: 80 },
  { from: 'Farol artesanal de latón envejecido.png', to: 'public/assets/memories/farol.png', webp: [256], quality: 84, trim: true },
];

const exists = (p) =>
  stat(p).then(
    () => true,
    () => false,
  );
const md5 = (buf) => createHash('md5').update(buf).digest('hex');

async function check(file) {
  const buf = await readFile(file);
  const meta = await sharp(buf).metadata();
  const out = { format: meta.format, width: meta.width, height: meta.height, bytes: buf.length, md5: md5(buf), alpha: null };
  if (meta.hasAlpha) {
    const { data } = await sharp(buf).extractChannel(3).raw().toBuffer({ resolveWithObject: true });
    let clear = 0;
    let soft = 0;
    for (const v of data) {
      if (v === 0) clear += 1;
      else if (v < 255) soft += 1;
    }
    out.alpha = { transparent: +(clear / data.length).toFixed(3), soft: +(soft / data.length).toFixed(4) };
  }
  return out;
}

const report = [];
for (const item of PLAN) {
  const src = path.join(SRC, item.from);
  const info = await check(src);
  if (item.duplicateOf) {
    const other = await check(path.join(SRC, item.duplicateOf));
    report.push({ from: item.from, duplicateOf: item.duplicateOf, identical: other.md5 === info.md5, ...info });
    continue;
  }
  const dest = path.join(ROOT, item.to);
  await mkdir(path.dirname(dest), { recursive: true });
  const copied = !(await exists(dest));
  if (copied) await copyFile(src, dest);
  const entry = { from: item.from, to: item.to, copied, ...info, derivatives: [] };
  for (const width of item.webp ?? []) {
    const out = dest.replace(/\.png$/, `-${width}.webp`);
    let img = sharp(src);
    if (item.trim) img = img.trim({ threshold: 1 });
    // Sin ampliar: el ancho pedido es un máximo
    await img.resize({ width, withoutEnlargement: true }).webp({ quality: item.quality, alphaQuality: 90, effort: 6 }).toFile(out);
    const d = await check(out);
    entry.derivatives.push({ file: path.relative(ROOT, out).replaceAll('\\', '/'), width: d.width, height: d.height, bytes: d.bytes, alpha: d.alpha });
  }
  report.push(entry);
}

// Alineación de las variantes del rincón: diferencia media de bordes (Sobel aproximado) a 192 px
async function edges(file) {
  const { data, info } = await sharp(file).resize(192, 128, { fit: 'fill' }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const e = new Float32Array(info.width * info.height);
  for (let y = 1; y < info.height - 1; y += 1)
    for (let x = 1; x < info.width - 1; x += 1) {
      const i = y * info.width + x;
      e[i] = Math.abs(data[i + 1] - data[i - 1]) + Math.abs(data[i + info.width] - data[i - info.width]);
    }
  return e;
}
const corr = (a, b) => {
  const n = a.length;
  const ma = a.reduce((s, v) => s + v, 0) / n;
  const mb = b.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i += 1) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return +(num / Math.sqrt(da * db)).toFixed(3);
};
const day = await edges(path.join(SRC, 'Rincón mediterráneo junto al mar.png'));
const alignment = {
  lluvia: corr(day, await edges(path.join(SRC, 'Rincón mediterráneo bajo la lluvia.png'))),
  noche: corr(day, await edges(path.join(SRC, 'Rincón de lectura ante la bahía nocturna.png'))),
};

await mkdir(path.join(ROOT, 'docs/design'), { recursive: true });
await writeFile(path.join(ROOT, 'docs/design/asset-check.json'), `${JSON.stringify({ generated: new Date().toISOString(), alignment, report }, null, 2)}\n`);
console.log(JSON.stringify({ alignment, report: report.map((r) => ({ from: r.from, to: r.to, copied: r.copied, dup: r.duplicateOf && r.identical, derivatives: r.derivatives?.map((d) => `${d.file} ${d.width}x${d.height} ${(d.bytes / 1024).toFixed(1)}KB`) })) }, null, 1));
