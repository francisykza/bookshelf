// Lo que se ve por una ventana del piloto, en tres distancias y con los dibujos del edificio y del hotel:
//   cerca: la barandilla de hierro del balcón de tu propia fachada, con las macetas que se ven desde el portal;
//   media: los tejados del barrio, con el mismo rasterizador y las mismas tejas, y la casa vecina de `facade.js`;
//   lejos: cielo, puerto y, si la ventana da a él, el Gran Hotel, con su miniatura sacada del dibujo de `hotelArt.js`.
// Devuelve lienzos pequeños; quien los usa los convierte en texturas y las libera al salir. Las piezas sin color de la hora
// se calculan una vez por sesión, y la miniatura del hotel solo se carga si alguna ventana visible da a él.
import { FACADE_SKY, LEAF, POT, neighbour } from '../edificio/facade';
import { createRaster, hash, noise, rgb } from '../minigames/libreria-puerto/raster';
import { ALTURAS, GLINT_ROWS, LAYERS, WATER_FRAMES, colOf, layerSize, rowOf } from './exteriorLayout';

/** El hotel, en la capa lejana: su sitio, en el cristal izquierdo. */
const HOTEL_S = -0.4;
const LIT_ID = 900;
const BOAT_S = [0.2, -0.84, 0.5];
/** Cuánto oscurece el color de la hora a lo que no es cielo: los mismos números de tarde que la fachada. */
const TINT = { dia: [1, 1, 1], tarde: [0.8, 0.72, 0.82], noche: [0.3, 0.3, 0.52] };
/** Lo cercano está a contraluz: más oscuro que la media distancia, para que se separe del cielo. */
const NEAR_TINT = { dia: [1, 1, 1], tarde: [0.9, 0.78, 0.92], noche: [0.5, 0.5, 0.74] };
/** De noche el hotel recibe la luz de la luna: más claro que su cielo, para que no se pierda la silueta. */
const HOTEL_TINT = { dia: [1, 1, 1], tarde: [0.8, 0.72, 0.82], noche: [0.42, 0.4, 0.6] };
const SKY = {
  dia: [[112, 170, 204], [156, 200, 218], [214, 226, 214], [240, 224, 190]],
  tarde: FACADE_SKY,
  noche: [[12, 14, 38], [22, 22, 58], [42, 36, 82], [74, 56, 104]],
};
const WATER = { dia: [[58, 110, 140], [78, 134, 158]], tarde: [[74, 66, 110], [120, 84, 118]], noche: [[16, 22, 48], [26, 34, 66]] };
const GLINT = { dia: [196, 224, 230], tarde: [246, 184, 136], noche: [120, 136, 176] };
const REFLECT = { dia: [150, 176, 190], tarde: [255, 214, 150], noche: [255, 206, 132] };
const RIDGE = { dia: [130, 150, 150], tarde: [112, 74, 112], noche: [28, 28, 60] };
const MOUNT = { dia: [127, 154, 132], tarde: [84, 66, 95], noche: [35, 38, 63] };
/** Lo que vela la distancia a cada capa, hacia el color del horizonte. */
const VEIL_MID = { dia: 0.1, tarde: 0.12, noche: 0.06 };
const VEIL_HOTEL = { dia: 0.22, tarde: 0.2, noche: 0.12 };
const WALLS = [[228, 196, 182], [222, 210, 188], [226, 186, 78], [196, 140, 128], [214, 196, 160]];
const TILE = [176, 98, 72];
const LIT = [255, 214, 150];

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const channels = (p) => [p & 255, (p >> 8) & 255, (p >> 16) & 255];

function toCanvas(w, h, pix) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(pix.buffer, pix.byteOffset, w * h * 4), w, h), 0, 0);
  return canvas;
}

/** El mismo dibujo con la luz de la hora: lo encendido queda igual y se vela hacia `veil`. */
function lightUp({ pix, lit }, hora, { tints = TINT, veil = null, veilAmount = 0 } = {}) {
  const out = new Uint32Array(pix.length);
  const tint = tints[hora];
  for (let i = 0; i < pix.length; i += 1) {
    const p = pix[i];
    if (!(p >>> 24)) continue;
    if (lit[i] && hora !== 'dia') {
      out[i] = rgb(...LIT);
      continue;
    }
    const [r, g, b] = channels(p);
    const c = [r * tint[0], g * tint[1], b * tint[2]];
    out[i] = rgb(...(veil ? mix(c, veil, veilAmount) : c));
  }
  return out;
}

function pieceOf(r, W, H, flip = false) {
  const pix = new Uint32Array(W * H);
  const lit = new Uint8Array(W * H);
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const from = y * W + (flip ? W - 1 - x : x);
      const to = y * W + x;
      pix[to] = r.pix[from];
      lit[to] = r.ids[from] === LIT_ID ? 1 : 0;
    }
  }
  return { pix, lit };
}

const nearCache = new Map();
const IRON = [78, 70, 80];
/** Hasta dónde sube la barandilla en el hueco: justo por encima del marco, dejando ver los tejados. */
const RAIL_TOP = 1.68;

/**
 * Lo cercano: la barandilla del balcón que hay bajo cada ventana de la fachada, en el mismo hierro y con las mismas macetas
 * si el piso tiene plantas. Barrotes más separados que de lejos, para que no tapen los tejados.
 */
function nearPiece(plants) {
  const key = String(plants);
  if (nearCache.has(key)) return nearCache.get(key);
  const [W, H] = layerSize('near');
  const S = 18;
  const Z = 4;
  const r = createRaster({ W, H, S, yaw: 0, ox: 0, oy: 0 });
  const top = r.project(0, 0.05, Z + 0.55);
  const front = createRaster({ W, H, S, yaw: 0, ox: 0, oy: rowOf('near', RAIL_TOP) - top.sy });
  front.clear(0);
  const span = W / S + 1;
  front.box(-0.5, 0, Z + 0.47, span, 0.05, Z + 0.55, IRON, { grain: 0 });
  front.box(-0.5, 0, Z + 0.06, span, 0.05, Z + 0.1, IRON, { grain: 0 });
  for (let a = -0.5; a < span; a += 0.22) front.box(a, 0, Z, a + 0.05, 0.05, Z + 0.47, IRON, { grain: 0 });
  if (plants) {
    // A los lados del hueco, para no tapar el puerto
    for (const s of [-0.66, 0.62]) {
      const px = colOf('near', s) / S;
      front.box(px, -0.3, Z, px + 0.3, -0.05, Z + 0.24, POT, { grain: 0 });
      for (let j = 0; j < 4; j += 1) front.box(px - 0.04 + j * 0.1, -0.2, Z + 0.24, px + 0.02 + j * 0.1, -0.1, Z + 0.42 + hash(px, j) * 0.4, LEAF, { grain: 0 });
    }
  }
  front.shadeEdges();
  const out = pieceOf(front, W, H);
  nearCache.set(key, out);
  return out;
}

const midCache = new Map();

/** Los tejados del barrio, en tres hileras: el mismo rasterizador y la misma teja que las torres de la fachada. */
function midPiece(planta, horizonZ) {
  if (midCache.has(planta)) return midCache.get(planta);
  const [W, H] = layerSize('mid');
  const S = 9;
  const r = createRaster({ W, H, S, yaw: 0.1, ox: 0, oy: 0 });
  // La hilera de atrás marca dónde acaban los tejados
  const ROWS = [{ y: 0, tall: 3 }, { y: 4, tall: 3 }, { y: 8, tall: 3.3 }];
  const world = W / S + 8;
  const probe = r.project(world / 2 - 4, 0, ROWS[0].tall + 1.1);
  const target = rowOf('mid', horizonZ - ALTURAS[planta].roofGap);
  const out = createRaster({ W, H, S, yaw: 0.1, ox: 0, oy: target - probe.sy });
  out.clear(0);
  const tile = out.rampOf(TILE);
  const roofTile = (a, b) => tile[(b * 3) % 1 < 0.2 ? 1 : (Math.floor(a * 1.5) + Math.floor(b * 3)) % 2 ? 3 : 2];
  ROWS.forEach(({ y, tall }, row) => {
    let x = -5 - row * 0.8;
    let n = 0;
    while (x < world) {
      const wide = 2.1 + hash(n, row + 11) * 1.8;
      const h = tall + hash(n, row + 3) * 1.1;
      const wall = WALLS[Math.floor(hash(n + 2, row + 7) * WALLS.length)];
      const roofed = (f, a, b) => (f === 'top' ? roofTile(a, b) : undefined);
      // Muro hasta el fondo del lienzo, cornisa y dos faldones escalonados, como los remates de los torreones de la fachada
      out.box(x, y, -6, x + wide, y + 2.1, h, wall, { grain: 0, step: 0.09, face: (f) => (f === 'top' ? tile[1] : undefined) });
      out.box(x, y + 2.1, h - 0.1, x + wide, y + 2.2, h + 0.06, [240, 232, 214], { grain: 0, step: 0.06 });
      out.box(x + 0.12, y + 0.12, h + 0.12, x + wide - 0.12, y + 1.98, h + 0.42, TILE, { grain: 0, step: 0.09, face: roofed });
      out.box(x + 0.42, y + 0.45, h + 0.42, x + wide - 0.42, y + 1.65, h + 0.72, TILE, { grain: 0, step: 0.09, face: roofed });
      if (hash(n, row + 21) > 0.55) out.box(x + wide * 0.7, y + 0.8, h + 0.42, x + wide * 0.7 + 0.28, y + 1.05, h + 1.02, [150, 84, 62], { grain: 0, step: 0.06 });
      // Una o dos ventanas por casa: por la noche algunas se encienden
      for (let k = 0; k < 3; k += 1) {
        const wx = x + 0.4 + k * 0.72;
        if (wx + 0.3 > x + wide) break;
        const on = hash(wx * 3, row + h) > 0.62;
        out.setId(on ? LIT_ID : 0);
        out.box(wx, y + 2.1, h - 1.05, wx + 0.28, y + 2.14, h - 0.45, on ? [236, 190, 120] : [66, 62, 76], { grain: 0, step: 0.06 });
        out.setId(0);
      }
      x += wide + (hash(n, row + 31) > 0.82 ? 0.25 : 0.02);
      n += 1;
    }
  });
  // La casa vecina de la fachada, en la hilera de atrás: asoma sobre los tejados, a la derecha del hueco
  const beyond = colOf('mid', 0.42) / S / Math.cos(0.1);
  neighbour(out, beyond, beyond + 9, 5.1 + (planta - 1) * -0.2, 5, LIT_ID);
  out.shadeEdges();
  const piece = pieceOf(out, W, H);
  midCache.set(planta, piece);
  return piece;
}

let hotelCache = null;

/** La miniatura del hotel: se pide solo si alguna ventana visible da a él. */
function hotelArt() {
  hotelCache ??= import('./hotelMini.js').then(({ HOTEL_MINI: mini }) => {
    const bytes = Uint8Array.from(atob(mini.data), (c) => c.charCodeAt(0));
    const pix = new Uint32Array(mini.W * mini.H);
    const glow = new Uint8Array(mini.W * mini.H);
    for (let i = 0; i < pix.length; i += 1) {
      const flag = bytes[i * 4 + 3];
      if (!flag) continue;
      pix[i] = rgb(bytes[i * 4], bytes[i * 4 + 1], bytes[i * 4 + 2]);
      glow[i] = flag === 2 ? 1 : 0;
    }
    return { W: mini.W, H: mini.H, pix, glow, tip: mini.tip };
  });
  return hotelCache;
}

/** La capa lejana: cielo por bandas tramadas, colinas, puerto, hotel y agua. Devuelve también dónde empieza el agua. */
async function paintFar(vista, hora, horizonZ) {
  const [W, H] = layerSize('far');
  const pix = new Uint32Array(W * H);
  const line = rowOf('far', horizonZ);
  const sky = SKY[hora];
  const bayer = (x, y) => [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5][(y & 3) * 4 + (x & 3)] / 16;
  // Por encima de donde empezaba (`sky`), el mismo color de lo más alto del cielo: el degradado no cambia
  const top = Math.max(0, rowOf('far', LAYERS.far.sky));
  for (let y = 0; y < line; y += 1) {
    const band = (Math.max(0, y - top) / (line - top)) * (sky.length - 1);
    for (let x = 0; x < W; x += 1) {
      const k = Math.max(0, Math.min(sky.length - 2, Math.floor(band + (bayer(x, y) - 0.5) * 0.22)));
      const c = mix(sky[k], sky[k + 1], Math.floor(Math.max(0, Math.min(1, band - k)) * 4) / 4);
      const star = hora !== 'dia' && y < top + (line - top) * (hora === 'noche' ? 0.8 : 0.28) && hash(x, y) > (hora === 'noche' ? 0.995 : 0.998);
      pix[y * W + x] = star ? rgb(250, 240, 220) : rgb(...c);
    }
  }
  // Colinas al otro lado del puerto, como detrás de la fachada, con sus luces lejanas
  const ridgeColor = vista === 'monte' ? MOUNT[hora] : RIDGE[hora];
  const lift = vista === 'monte' ? 34 : 12;
  for (let x = 0; x < W; x += 1) {
    const ridge = Math.round(line - 2 - noise(x * 0.04, 3) * lift - noise(x * 0.16, 8) * 3);
    for (let y = Math.max(0, ridge); y < line; y += 1) {
      const house = hora !== 'dia' && hash(Math.floor(x / 2), Math.floor(y / 2)) > 0.95 && y > ridge + 2;
      pix[y * W + x] = house ? rgb(...LIT) : rgb(...ridgeColor);
    }
  }
  // El muelle lejano: una línea de piedra sobre la que se apoya todo
  const quay = mix(ridgeColor, hora === 'noche' ? [60, 56, 88] : [190, 170, 150], 0.45);
  for (let x = 0; x < W; x += 1) pix[(line - 1) * W + x] = rgb(...quay);
  let hotel = null;
  if (vista === 'hotel') {
    const art = await hotelArt();
    const x0 = colOf('far', HOTEL_S) - Math.round(art.W / 2);
    const y0 = line - art.H;
    const veil = sky[sky.length - 1];
    for (let y = 0; y < art.H; y += 1) {
      for (let x = 0; x < art.W; x += 1) {
        const i = y * art.W + x;
        const p = art.pix[i];
        if (!(p >>> 24)) continue;
        const [r, g, b] = channels(p);
        const tint = HOTEL_TINT[hora];
        const c = i === art.tip && hora !== 'dia' ? [255, 90, 76] : art.glow[i] && hora !== 'dia' ? LIT : mix([r * tint[0], g * tint[1], b * tint[2]], veil, VEIL_HOTEL[hora]);
        const to = (y0 + y) * W + x0 + x;
        if (to >= 0 && to < pix.length) pix[to] = rgb(...c);
      }
    }
    hotel = { x0, x1: x0 + art.W };
  }
  // El agua: dos tonos de la hora, tramados, más clara hacia el horizonte
  const [deep, shallow] = WATER[hora];
  for (let y = line; y < H; y += 1) {
    const t = Math.max(0, 1 - (y - line) / 34);
    for (let x = 0; x < W; x += 1) pix[y * W + x] = rgb(...(t + (bayer(x, y) - 0.5) * 0.14 > 0.5 ? shallow : deep));
  }
  // Unos barcos amarrados, con su mástil: dan escala y dicen «puerto»
  const boat = mix(ridgeColor, hora === 'noche' ? [10, 10, 26] : [40, 34, 54], 0.6);
  const hull = rgb(...boat);
  const sail = rgb(...mix(boat, hora === 'dia' ? [240, 232, 214] : [214, 170, 150], hora === 'noche' ? 0.2 : 0.7));
  BOAT_S.forEach((s, k) => {
    const cx = colOf('far', s);
    const cy = line + 4 + k * 3;
    const put = (x, y, c) => {
      if (x >= 0 && x < W && y >= 0 && y < H) pix[y * W + x] = c;
    };
    for (let x = -3 - (k % 2); x <= 3; x += 1) put(cx + x, cy, hull);
    for (let x = -2; x <= 2; x += 1) put(cx + x, cy + 1, hull);
    for (let y = 1; y <= 6 + k; y += 1) put(cx, cy - y, sail);
  });
  return { canvas: toCanvas(W, H, pix), line, hotel };
}

/**
 * Los brillos del agua, en un atlas de `WATER_FRAMES` tiras: solo se cambia de tira, sin pintar nada nuevo. Pocos, cortos y a
 * medio tono entre el agua y su luz. Bajo el hotel se concentran y toman el color de sus luces.
 */
function paintGlint(hora, line, hotel) {
  const [W, H] = layerSize('far');
  const band = Math.min(H - line, GLINT_ROWS);
  const pix = new Uint32Array(W * band * WATER_FRAMES);
  const water = WATER[hora][1];
  const glint = rgb(...mix(water, GLINT[hora], 0.55));
  const warm = rgb(...mix(water, REFLECT[hora], 0.7));
  for (let f = 0; f < WATER_FRAMES; f += 1) {
    for (let y = 1; y < band; y += 3) {
      // Más cortos hacia el horizonte, más largos cerca: la perspectiva del agua
      const long = 2 + Math.min(3, Math.floor(y / 10));
      for (let x = (y * 5) % 7; x < W; x += long + 5) {
        const seed = hash(x, y + 3);
        const phase = Math.floor(seed * WATER_FRAMES);
        const under = hotel && x >= hotel.x0 + 4 && x <= hotel.x1 - 4 && y < 30;
        const shown = under ? (phase + f) % WATER_FRAMES < 2 : (phase + f) % WATER_FRAMES === 0 && hash(x + 7, y) > 0.55;
        if (!shown) continue;
        const shift = f * ((Math.floor(seed * 7) % 3) - 1);
        const c = under ? warm : glint;
        for (let k = 0; k < long; k += 1) {
          const px = x + k + shift;
          if (px >= 0 && px < W) pix[f * band * W + y * W + px] = c;
        }
      }
    }
  }
  return { canvas: toCanvas(W, band * WATER_FRAMES, pix), band };
}

/**
 * Los lienzos de una ventana: { far, mid, near, glint, horizonZ, band }. `vista`: 'hotel' | 'mar' | 'monte'. `planta`: 1 a 3.
 * `plants`: si tu piso tiene plantas, también están en su balcón, como en la fachada.
 */
export async function paintExterior({ vista, hora, planta, horizonZ, plants }) {
  const [nw, nh] = layerSize('near');
  const [mw, mh] = layerSize('mid');
  const far = await paintFar(vista, hora, horizonZ);
  const glint = paintGlint(hora, far.line, far.hotel);
  const horizon = SKY[hora][SKY[hora].length - 1];
  return {
    far: far.canvas,
    glint: glint.canvas,
    band: glint.band,
    mid: toCanvas(mw, mh, lightUp(midPiece(planta, horizonZ), hora, { veil: horizon, veilAmount: VEIL_MID[hora] })),
    near: toCanvas(nw, nh, lightUp(nearPiece(plants), hora, { tints: NEAR_TINT })),
  };
}

