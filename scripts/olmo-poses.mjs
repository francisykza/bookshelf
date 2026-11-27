// Las poses de Olmo (Francisco, 26-11-2026: «Para después añade a olmo con las animaciones que te paso igual que a libo»; 27-11-2026,
// «Igualar el 3D al dibujo»). Recorta las 22 poses de su hoja (fondo transparente) y las deja en `public/assets/olmo/poses/`, todas
// en un lienzo del mismo tamaño y a la misma escala, apoyadas abajo y centradas: así, al cambiar de pose, Olmo no cambia de tamaño
// ni salta. El original está fuera del repositorio, en `libotown-marca/` (como el de Libo, scripts/libo-poses.mjs).
// Uso: node scripts/olmo-poses.mjs [hoja de poses]
// Cada pose es una pieza grande y opaca; sus adornos sueltos («!», «?», corazones, «zZ», el polvo, el poste, el gatito…) van con
// el cuerpo más cercano.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const ORIGEN = process.argv[2] ?? '../libotown-marca/olmo-poses.png';
const DESTINO = join('public', 'assets', 'olmo', 'poses');
// En el orden de la hoja: por filas (6, 5, 5 y 6), de izquierda a derecha
export const POSES = [
  'libro',
  'saluda',
  'lee',
  'camina',
  'cafe',
  'celebra',
  'duerme',
  'duda',
  'carino',
  'enfado',
  'sorpresa',
  'lee-feliz',
  'corre',
  'gatito',
  'asoma',
  'espaldas',
  'mareado',
  'estudia',
  'descansa',
  'llora',
  'resopla',
  'estrella',
];
const MARGEN = 4;
const OPACO = 8;

const { data, info } = await sharp(ORIGEN).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;
const alfa = (p) => data[p * 4 + 3];

// Las piezas: lo que no es transparente, unido
const etiqueta = new Int32Array(W * H).fill(-1);
const piezas = [];
for (let s = 0; s < W * H; s += 1) {
  if (alfa(s) <= OPACO || etiqueta[s] >= 0) continue;
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
      if (q >= 0 && alfa(q) > OPACO && etiqueta[q] < 0) {
        etiqueta[q] = id;
        cola.push(q);
      }
    }
  }
  piezas.push(pz);
}
// Los cuerpos son las piezas grandes; por fila (cuatro bandas de la hoja) y, dentro de cada una, de izquierda a derecha
const fila = (pz) => Math.min(3, Math.floor((pz.y0 + pz.y1) / 2 / (H / 4)));
const cuerpos = piezas.filter((pz) => pz.n > 15000).sort((a, b) => fila(a) - fila(b) || a.x0 - b.x0);
if (cuerpos.length !== POSES.length) throw new Error(`Esperaba ${POSES.length} poses y hay ${cuerpos.length}`);
const centro = (pz) => [(pz.x0 + pz.x1) / 2, (pz.y0 + pz.y1) / 2];
const distancia = (pz, c) => {
  const [x, y] = centro(pz);
  const dx = Math.max(c.x0 - x, 0, x - c.x1);
  const dy = Math.max(c.y0 - y, 0, y - c.y1);
  return Math.hypot(dx, dy);
};
const dueno = new Map();
for (const pz of piezas) {
  if (pz.n < 20) continue;
  let mejor = 0;
  cuerpos.forEach((c, i) => {
    if (distancia(pz, c) < distancia(pz, cuerpos[mejor])) mejor = i;
  });
  if (cuerpos.includes(pz) || distancia(pz, cuerpos[mejor]) < 110) dueno.set(pz.id, mejor);
}

// El lienzo común: lo que ocupa la pose más ancha y la más alta
const cajas = POSES.map((_, i) =>
  piezas
    .filter((pz) => dueno.get(pz.id) === i)
    .reduce((c, pz) => ({ x0: Math.min(c.x0, pz.x0), y0: Math.min(c.y0, pz.y0), x1: Math.max(c.x1, pz.x1), y1: Math.max(c.y1, pz.y1) }), { x0: W, y0: H, x1: 0, y1: 0 }),
);
const LIENZO = {
  w: Math.max(...cajas.map((c) => c.x1 - c.x0 + 1)) + MARGEN * 2,
  h: Math.max(...cajas.map((c) => c.y1 - c.y0 + 1)) + MARGEN * 2,
};

mkdirSync(DESTINO, { recursive: true });
for (let i = 0; i < POSES.length; i += 1) {
  const caja = cajas[i];
  const ids = new Set(piezas.filter((pz) => dueno.get(pz.id) === i).map((pz) => pz.id));
  const w = caja.x1 - caja.x0 + 1;
  const h = caja.y1 - caja.y0 + 1;
  const rgba = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const p = (caja.y0 + y) * W + caja.x0 + x;
      const o = (y * w + x) * 4;
      // Solo lo suyo; el borde suave (alfa bajo) de sus piezas, también
      let suyo = ids.has(etiqueta[p]);
      if (!suyo && alfa(p) > 0) {
        const px = p % W;
        suyo = [px > 0 ? p - 1 : -1, px < W - 1 ? p + 1 : -1, p - W, p + W].some((q) => q >= 0 && q < W * H && ids.has(etiqueta[q]));
      }
      if (!suyo) continue;
      data.copy(rgba, o, p * 4, p * 4 + 4);
    }
  }
  const pieza = await sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toBuffer();
  await sharp({ create: { width: LIENZO.w, height: LIENZO.h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: pieza, left: Math.round((LIENZO.w - w) / 2), top: LIENZO.h - MARGEN - h }])
    .webp({ quality: 90, alphaQuality: 100 })
    .toFile(join(DESTINO, `${POSES[i]}.webp`));
  console.log(POSES[i], `${w} × ${h}`, `${ids.size} pieza(s)`);
}
console.log('Lienzo', `${LIENZO.w} × ${LIENZO.h}`);
