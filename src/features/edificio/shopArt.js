// Dibujos de la tienda del bajo (1.67, SPEC §67), en el mismo pixel art que el piso. Desde la 1.76 (maquetas de
// Francisco, §76) hay **una sola definición del sobre por colección**, que se usa en los tres sitios: el expositor de
// la tienda (shopRoom.js la muestrea píxel a píxel sobre la cara del sobre), el selector y el mostrador de la apertura.
// Sus rasgos: el cuerpo verde de la casa, una faja crema ancha con el mueble de portada en grande (de la colección,
// tomado del catálogo real), la tira de arriba del color de la colección con su línea perforada, la pestaña roja que se
// agarra para rasgarla y la casita del edificio abajo. En el primer plano (`detail`) se añaden los pliegues y la costura.
// El sobre se separa en tira (lo que se rasga) y cuerpo. El reverso de las cartas lleva el color de su colección. Todo
// propio: ningún logotipo ni diseño ajeno.
import { renderThumb } from './render';

const OUT = [59, 38, 24];
// La miniatura (selector, expositor) y el primer plano (mostrador)
export const PACK_W = 32;
export const PACK_H = 48;
export const PACK_NEAR_W = 48;
export const PACK_NEAR_H = 72;
// Arriba queda un hueco transparente de un par de píxeles: por ahí sobresale la pestaña roja
const lipOf = (h) => Math.max(1, Math.round(h * 0.03));
const tearOf = (h) => lipOf(h) + Math.round((h - lipOf(h)) * 0.21);
/** Hasta dónde llega la tira que se rasga (pestaña, dientes, banda de color y perforación), en la miniatura. */
export const PACK_TEAR = tearOf(PACK_H);
export const PACK_NEAR_TEAR = tearOf(PACK_NEAR_H);
// La pestaña roja: columnas y última fila (en el lienzo entero), de la misma pieza que la tira
const tabOf = (W, H) => ({ x0: Math.round(W * 0.7), x1: Math.round(W * 0.86), y1: tearOf(H) - 2 });
/** La pestaña del primer plano: el mostrador la dibuja levantada sobre el sobre. */
export const PACK_NEAR_TAB = tabOf(PACK_NEAR_W, PACK_NEAR_H);

// El verde de la casa (el del sobre de las maquetas) y la crema de la faja
const BODY = [74, 112, 76];
const CREAM = [246, 236, 210];
const TAB = [176, 64, 52];
const GOLD = [236, 190, 96];

const mix = ([r, g, b], k) => (k >= 0 ? [r + (255 - r) * k, g + (255 - g) * k, b + (255 - b) * k] : [r * (1 + k), g * (1 + k), b * (1 + k)]).map(Math.round);

/** El mueble de portada recortado a lo dibujado y ampliado por enteros hasta llenar `size` (lienzo transparente). */
export function fitThumb(id, size) {
  const big = Math.max(size, 44);
  const src = renderThumb(id, 0, big);
  const { data } = src.getContext('2d').getImageData(0, 0, big, big);
  let x0 = big;
  let y0 = big;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < big; y += 1)
    for (let x = 0; x < big; x += 1)
      if (data[(y * big + x) * 4 + 3] > 0) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
  const out = document.createElement('canvas');
  out.width = size;
  out.height = size;
  if (x1 < 0) return out;
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  // Por enteros si cabe al menos al doble; si no, reducido a lo que quepa (pixel art de la miniatura)
  const fit = Math.min(size / w, size / h);
  const k = fit >= 1 ? Math.floor(fit) : fit;
  const dw = Math.max(1, Math.round(w * k));
  const dh = Math.max(1, Math.round(h * k));
  ctx.drawImage(src, x0, y0, w, h, Math.floor((size - dw) / 2), Math.floor((size - dh) / 2), dw, dh);
  return out;
}

/**
 * Pinta el sobre de `sobre` en un lienzo de W × H. `detail`: el primer plano, con los pliegues del envoltorio y la
 * costura. Todo va en proporción al tamaño, así la miniatura y el primer plano son el mismo sobre.
 */
function paintPack(ctx, sobre, W, FULL_H, detail) {
  const img = ctx.createImageData(W, FULL_H);
  // El sobre se dibuja bajo el hueco de arriba (lip); `raw` pinta en el lienzo entero (la pestaña sobresale)
  const lip = lipOf(FULL_H);
  const H = FULL_H - lip;
  const raw = (x, y, c) => {
    if (x < 0 || y < 0 || x >= W || y >= FULL_H) return;
    const i = (y * W + x) * 4;
    img.data[i] = c[0];
    img.data[i + 1] = c[1];
    img.data[i + 2] = c[2];
    img.data[i + 3] = 255;
  };
  const put = (x, y, c) => y >= 0 && y < H && raw(x, y + lip, c);
  const gold = sobre.id === 'coleccion';
  const edge = gold ? GOLD : sobre.color;
  const crimp = Math.max(3, Math.round(H * 0.0625));
  const tear = tearOf(FULL_H) - lip;
  // La faja, alta: el mueble de portada cabe dentro con aire alrededor
  const bandY0 = Math.round(H * 0.3);
  const bandY1 = Math.round(H * 0.76);
  const houseY = Math.round(H * 0.865);
  for (let y = 0; y < H; y += 1)
    for (let x = 0; x < W; x += 1) {
      const top = y < crimp;
      const bottom = y >= H - crimp;
      // Sellados de arriba y abajo, en crema y con estrías: dientes en el borde exterior y rayas verticales
      if (top || bottom) {
        const outer = top ? y === 0 : y === H - 1;
        if (outer && x % 2 === 1) continue;
        const inner = top ? y === crimp - 1 : y === H - crimp;
        put(x, y, inner ? mix(CREAM, -0.3) : x % 2 ? mix(CREAM, -0.16) : CREAM);
        continue;
      }
      if (x === 0 || x === W - 1) {
        put(x, y, OUT);
        continue;
      }
      // La tira de arriba, del color de la colección, con la perforación en su borde de abajo
      if (y < tear) {
        // La línea de rasgado, discontinua: trazos crema sobre el color de la tira
        if (y === tear - 1) put(x, y, x % 4 < 2 ? CREAM : mix(edge, -0.25));
        else put(x, y, mix(edge, y === crimp ? 0.3 : (x + y) % 9 === 0 ? 0.12 : -0.05));
        continue;
      }
      // Cuerpo verde: más claro arriba a la izquierda, más oscuro abajo a la derecha
      const t = (x / W) * 0.5 + ((y - tear) / (H - tear)) * 0.7;
      let c = mix(BODY, 0.16 - t * 0.38);
      // La faja crema, con un filo del color de la colección arriba y abajo
      if (y >= bandY0 && y <= bandY1) {
        if (y === bandY0 || y === bandY1) c = mix(edge, -0.1);
        else if (y === bandY0 + 1 || y === bandY1 - 1) c = mix(CREAM, -0.12);
        else c = mix(CREAM, x > W * 0.7 ? -0.05 : 0);
      }
      put(x, y, c);
    }
  // La pestaña roja, a la derecha: de la misma pieza que la tira dentada (sale con ella al rasgar), asoma un poco por
  // encima de los dientes y acaba justo antes de la perforación
  const { x0: tx0, x1: tx1, y1: ty1 } = tabOf(W, FULL_H);
  // En el primer plano la pestaña está levantada: su sombra cae sobre la tira, abajo a la derecha
  if (detail)
    for (let y = lip + 2; y <= ty1 + 2; y += 1)
      for (let x = tx0 + 2; x <= tx1 + 2; x += 1) {
        if (x <= tx1 && y <= ty1) continue;
        const i = (y * W + x) * 4;
        if (x >= W - 1 || !img.data[i + 3]) continue;
        for (let k = 0; k < 3; k += 1) img.data[i + k] = Math.round(img.data[i + k] * 0.62);
      }
  for (let y = 0; y <= ty1; y += 1)
    for (let x = tx0; x <= tx1; x += 1) {
      const rim = x === tx0 || x === tx1 || y === 0 || y === ty1;
      raw(x, y, rim ? mix(TAB, -0.45) : mix(TAB, y <= lip ? 0.25 : x === tx0 + 1 ? 0.1 : 0));
    }
  // Las rayitas del borde: costura y pliegues en el primer plano
  if (detail) {
    for (let y = tear + 2; y < H - crimp - 1; y += 3) {
      if (y >= bandY0 - 1 && y <= bandY1 + 1) continue;
      put(2, y, mix(BODY, -0.35));
      put(W - 3, y, mix(BODY, -0.45));
    }
    // Tres pliegues en el verde: una arista clara con su sombra debajo (abajo a cada lado y uno bajo la tira)
    const fold = (x, y, dx, slope, n) => {
      for (let k = 0; k < n; k += 1) {
        const fx = x + k * dx;
        const fy = y + Math.round(k * slope);
        if (fy >= bandY0 - 1 && fy <= bandY1 + 1) return;
        put(fx, fy, mix(BODY, 0.34));
        put(fx, fy + 1, mix(BODY, -0.36));
      }
    };
    fold(2, H - crimp - 3, 1, -0.55, Math.round(W * 0.32));
    fold(W - 3, H - crimp - 4, -1, -0.4, Math.round(W * 0.26));
    fold(3, tear + 1, 1, 0.3, Math.round(W * 0.22));
    // La línea de la costura de la faja (puntadas)
    for (let x = 2; x < W - 2; x += 2) {
      put(x, bandY0 + 2, mix(CREAM, -0.2));
      put(x, bandY1 - 2, mix(CREAM, -0.2));
    }
  }
  // La casita del edificio, abajo y en crema
  const HOUSE = ['..#..', '.###.', '#####', '.#.#.', '.###.'];
  const hk = W >= 48 ? 2 : 1;
  const hx = Math.round(W / 2 - (5 * hk) / 2);
  HOUSE.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch !== '#') return;
      for (let a = 0; a < hk; a += 1) for (let b = 0; b < hk; b += 1) put(hx + x * hk + a, houseY - 2 * hk + y * hk + b, gold ? GOLD : CREAM);
    }),
  );
  // Destellos del de coleccionista
  if (gold)
    for (const [fx, fy] of [
      [0.2, 0.3],
      [0.78, 0.3],
      [0.16, 0.78],
      [0.84, 0.86],
    ]) {
      const x = Math.round(W * fx);
      const y = Math.round(H * fy);
      for (const [dx, dy] of [
        [0, 0],
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ])
        put(x + dx, y + dy, dx || dy ? GOLD : [255, 252, 230]);
    }
  ctx.putImageData(img, 0, 0);
  // El mueble de portada, dentro de la faja y con margen alrededor (no la pisa)
  const size = Math.min(Math.round(W * 0.6), bandY1 - bandY0 - 3);
  const motif = fitThumb(sobre.portada, size);
  ctx.drawImage(motif, Math.round((W - size) / 2), lip + Math.round((bandY0 + bandY1) / 2 - size / 2));
}

const cache = new Map();

function build(sobre, W, H, tear, detail) {
  const full = document.createElement('canvas');
  full.width = W;
  full.height = H;
  paintPack(full.getContext('2d'), sobre, W, H, detail);
  const part = (y0, y1) => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = y1 - y0;
    c.getContext('2d').drawImage(full, 0, y0, W, y1 - y0, 0, 0, W, y1 - y0);
    return c.toDataURL();
  };
  return { canvas: full, full: full.toDataURL(), top: part(0, tear), body: part(tear, H) };
}

/**
 * El sobre de una colección: { full, top, body, pixels, near: { full, top, body } }. `full`, `top` y `body` son la
 * miniatura (1 píxel por píxel del dibujo; el CSS las escala nítidas), `pixels` sus píxeles para pintarlos en el
 * expositor de la tienda, y `near` el primer plano del mostrador, con pliegues y costura (y sus `pixels`, para tumbarlo
 * en el tablero con la proyección del mostrador).
 */
export function packArt(sobre) {
  if (cache.has(sobre.id)) return cache.get(sobre.id);
  const thumb = build(sobre, PACK_W, PACK_H, PACK_TEAR, false);
  const near = build(sobre, PACK_NEAR_W, PACK_NEAR_H, PACK_NEAR_TEAR, true);
  const pixels = thumb.canvas.getContext('2d').getImageData(0, 0, PACK_W, PACK_H).data;
  const nearPixels = near.canvas.getContext('2d').getImageData(0, 0, PACK_NEAR_W, PACK_NEAR_H).data;
  const art = { full: thumb.full, top: thumb.top, body: thumb.body, pixels, near: { full: near.full, top: near.top, body: near.body, pixels: nearPixels } };
  cache.set(sobre.id, art);
  return art;
}

const backCache = new Map();

/** El reverso de las cartas, del color de su colección: marco crema con esquinas y la casita en el centro. */
export function cardBackArt(sobre = null) {
  const key = sobre?.id ?? '';
  if (backCache.has(key)) return backCache.get(key);
  const W = 24;
  const H = 32;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  const base = sobre ? (sobre.id === 'coleccion' ? [150, 104, 30] : mix(BODY, -0.1)) : [138, 90, 56];
  // Un filete dorado alrededor y la casita en crema
  const line = sobre?.id === 'coleccion' ? GOLD : [214, 176, 96];
  const house = sobre?.id === 'coleccion' ? GOLD : [234, 222, 190];
  const px = (x, y, rgb) => {
    ctx.fillStyle = `rgb(${rgb.join(' ')})`;
    ctx.fillRect(x, y, 1, 1);
  };
  for (let y = 0; y < H; y += 1)
    for (let x = 0; x < W; x += 1) {
      if ((x === 0 || x === W - 1) && (y === 0 || y === H - 1)) continue;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) px(x, y, OUT);
      else if (x === 2 || y === 2 || x === W - 3 || y === H - 3) px(x, y, line);
      else if ((x === 4 || x === W - 5) && (y === 4 || y === H - 5)) px(x, y, line);
      else px(x, y, mix(base, (x + y) % 7 === 0 ? 0.08 : 0));
    }
  const HOUSE = ['...#...', '..###..', '.#####.', '#######', '.#...#.', '.#.#.#.', '.#####.'];
  HOUSE.forEach((row, y) => [...row].forEach((ch, x) => ch === '#' && px(8 + x, 12 + y, house)));
  const url = c.toDataURL();
  backCache.set(key, url);
  return url;
}
