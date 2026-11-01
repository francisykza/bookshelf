// Dibujos de la tienda del bajo (1.67, SPEC §67), en el mismo pixel art que el piso: los sobres de la pared (como los
// de cartas de toda la vida: metalizados, con dientes arriba y abajo y el mueble de portada en una ventana), separados
// en tira de arriba y cuerpo para rasgarlos, y el reverso de las cartas. Todo propio: ningún logotipo ni diseño ajeno.
import { hash } from '../minigames/libreria-puerto/raster';
import { renderThumb } from './render';

const OUT = '#3b2618';
export const PACK_W = 32;
export const PACK_H = 48;
/** Hasta dónde llega la tira que se rasga (dientes y banda de arriba). */
export const PACK_TEAR = 10;

const css = ([r, g, b]) => `rgb(${r} ${g} ${b})`;
const mix = ([r, g, b], k) => (k >= 0 ? [r + (255 - r) * k, g + (255 - g) * k, b + (255 - b) * k] : [r * (1 + k), g * (1 + k), b * (1 + k)]).map(Math.round);

/** Pinta el sobre entero en un lienzo de PACK_W × PACK_H. */
function paintPack(ctx, sobre) {
  const px = (x, y, c) => {
    ctx.fillStyle = typeof c === 'string' ? c : css(c);
    ctx.fillRect(x, y, 1, 1);
  };
  const base = sobre.color;
  const gold = sobre.id === 'coleccion';
  for (let y = 0; y < PACK_H; y += 1)
    for (let x = 0; x < PACK_W; x += 1) {
      const crimpTop = y < 3;
      const crimpBottom = y >= PACK_H - 3;
      if (crimpTop || crimpBottom) {
        // Dientes del sellado: el borde exterior en zigzag y rayitas plateadas
        const edge = crimpTop ? y === 0 : y === PACK_H - 1;
        if (edge && x % 2 === 1) continue;
        px(x, y, x % 2 ? [176, 168, 160] : [222, 216, 206]);
        continue;
      }
      if (x === 0 || x === PACK_W - 1) {
        px(x, y, OUT);
        continue;
      }
      // Metalizado: más claro arriba a la izquierda, con una banda de brillo en diagonal y algo de grano
      const t = (x + y * 0.6) / (PACK_W + PACK_H * 0.6);
      const shine = Math.abs(((x - y * 0.55 + 40) % 34) - 8) < 2 ? 0.35 : 0;
      const grain = hash(x * 3.1, y * 1.7) > 0.88 ? 0.12 : 0;
      px(x, y, mix(base, 0.28 - t * 0.55 + shine + grain));
    }
  // Banda de arriba (la que se rasga): oscura, con un ancla de latón y el número de temporada
  for (let y = 3; y < PACK_TEAR; y += 1) for (let x = 1; x < PACK_W - 1; x += 1) px(x, y, y === PACK_TEAR - 1 ? mix(base, -0.6) : mix(base, -0.45));
  const brass = gold ? [255, 236, 160] : [240, 195, 90];
  for (const [x, y] of [[5, 4], [4, 5], [5, 5], [6, 5], [5, 6], [5, 7], [4, 7], [6, 7], [3, 6], [7, 6]]) px(x, y, brass);
  // «1» de la temporada, a la derecha
  for (const [x, y] of [[26, 4], [27, 4], [27, 5], [27, 6], [27, 7], [26, 7], [28, 7]]) px(x, y, brass);
  // Ventana con rayos del color del sobre y el mueble de portada
  const wx0 = 3;
  const wx1 = PACK_W - 4;
  const wy0 = 12;
  const wy1 = 36;
  const cx = (wx0 + wx1) / 2;
  const cy = (wy0 + wy1) / 2;
  for (let y = wy0; y <= wy1; y += 1)
    for (let x = wx0; x <= wx1; x += 1) {
      if (x === wx0 || x === wx1 || y === wy0 || y === wy1) {
        px(x, y, gold ? [255, 224, 138] : mix(base, -0.55));
        continue;
      }
      const a = Math.atan2(y - cy, x - cx);
      const ray = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 14) % 2 === 0;
      px(x, y, ray ? mix(base, 0.78) : [251, 243, 223]);
    }
  const thumb = renderThumb(sobre.portada, 0, 26);
  ctx.drawImage(thumb, Math.round(cx - 13), Math.round(cy - 13));
  // Banda de abajo: tres rombos (dorados en el de coleccionista)
  for (let y = 38; y < 44; y += 1) for (let x = 1; x < PACK_W - 1; x += 1) px(x, y, mix(base, -0.45));
  for (const k of [-6, 0, 6]) for (const [dx, dy] of [[0, -1], [-1, 0], [0, 0], [1, 0], [0, 1]]) px(16 + k + dx, 41 + dy, gold ? [255, 236, 160] : mix(base, 0.55));
  // Destellos del de coleccionista
  if (gold) for (const [x, y] of [[6, 15], [24, 18], [9, 31], [22, 33], [15, 13]]) px(x, y, [255, 252, 230]);
}

const cache = new Map();

/** El sobre de la pared: { full, top, body } (imágenes de 1 píxel por píxel del dibujo; el CSS las escala nítidas). */
export function packArt(sobre) {
  if (cache.has(sobre.id)) return cache.get(sobre.id);
  const full = document.createElement('canvas');
  full.width = PACK_W;
  full.height = PACK_H;
  paintPack(full.getContext('2d'), sobre);
  const part = (y0, y1) => {
    const c = document.createElement('canvas');
    c.width = PACK_W;
    c.height = y1 - y0;
    c.getContext('2d').drawImage(full, 0, y0, PACK_W, y1 - y0, 0, 0, PACK_W, y1 - y0);
    return c.toDataURL();
  };
  const art = { full: full.toDataURL(), top: part(0, PACK_TEAR), body: part(PACK_TEAR, PACK_H) };
  cache.set(sobre.id, art);
  return art;
}

/** El reverso de las cartas: madera con una trama de rombos y un sobre pequeño en el centro. */
export function cardBackArt() {
  const W = 24;
  const H = 32;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  const px = (x, y, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
  };
  for (let y = 0; y < H; y += 1)
    for (let x = 0; x < W; x += 1) {
      if ((x === 0 || x === W - 1) && (y === 0 || y === H - 1)) continue;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) px(x, y, OUT);
      else if (x === 2 || y === 2 || x === W - 3 || y === H - 3) px(x, y, '#c8946a');
      else px(x, y, (x + y) % 6 === 0 || (x - y + 60) % 6 === 0 ? '#c8946a' : '#8a5a38');
    }
  for (let y = 12; y <= 19; y += 1)
    for (let x = 7; x <= 16; x += 1) {
      const edge = x === 7 || x === 16 || y === 12 || y === 19;
      const v = Math.abs(y - 12 - Math.min(x - 7, 16 - x) * 0.8) < 0.5;
      px(x, y, edge || v ? OUT : '#fbf3df');
    }
  return c.toDataURL();
}
