// Dibujo de un piso de «El edificio del puerto» (1.63, SPEC §63) con el rasterizador de píxeles de «La
// librería del puerto» (adaptado de Pixel Plays, MIT: ver ../libreria-puerto/raster.js). Cámara isométrica (giro de
// 45°): se ven la pared del fondo (a la derecha), la de la izquierda y el suelo. Lo que no se mueve se hornea una vez por
// cambio; en cada fotograma solo se dibuja lo que se lleva en la mano y su contorno. Cada píxel guarda qué objeto lo
// pinta (para tocar sobre el dibujo) y si es una parte que se enciende de tarde.
import { createRaster, hash, noise, rgb } from '../minigames/libreria-puerto/raster';
import { actorBoxes } from './actor';
import { PAREDES, catalogItem } from './catalog';
import { shapeOf } from './furniture';
import { misticoOf, misticoThumb } from './misticos';
import { clearFrame, createFrame, painterFor } from '../../vendor/pixelfx/core/index.js';
import { ROOM, heightOf, rectOf } from './room';

const S = 18;
const YAW = Math.PI / 4;
const WALL_T = 0.3;
const GLOW_BIT = 0x8000;
// Fuera de la habitación, al hornear, nada (0); al dibujar se rellena con el telón tramado de backdrop() (§64)
const BG = 0;
// El telón detrás del piso: tres tonos de arriba abajo y la sombra que el piso deja debajo, de día y de tarde
const BACKDROP = {
  day: { tones: [[244, 232, 206], [236, 219, 186], [225, 203, 165]], shadow: [204, 178, 140] },
  evening: { tones: [[104, 84, 98], [88, 70, 86], [72, 58, 74]], shadow: [52, 42, 56] },
};
const WOOD = [150, 98, 60];
const WAINSCOT = [132, 112, 84];
const FLOOR_WOOD = [198, 156, 112];
const TILE_A = [232, 220, 196];
const TILE_B = [168, 92, 70];
const CLAY = [196, 120, 84];
const GROUT = [214, 196, 168];
const CREAM = [226, 208, 172];
const SAGE = [118, 136, 100];
const OK_LINE = rgb(62, 92, 56);
const OK_FILL = [120, 150, 96];
const BAD_LINE = rgb(168, 60, 40);
const LIT = [255, 228, 164];
// Identificador del personaje en el búfer de toques (los muebles usan uids pequeños)
export const ACTOR_ID = 0x7ffe;

/** Encuadre: el tamaño del lienzo se calcula una vez para que quepan el suelo y las dos paredes enteras. */
function frame(s) {
  const probe = createRaster({ W: 1, H: 1, S: s, yaw: YAW, ox: 0, oy: 0 });
  const pts = [];
  for (const [x, y, z] of [
    [ROOM.w, ROOM.d, 0],
    [ROOM.w, -WALL_T, 0],
    [-WALL_T, ROOM.d, 0],
    [-WALL_T, -WALL_T, ROOM.wallH],
    [ROOM.w, -WALL_T, ROOM.wallH],
    [-WALL_T, ROOM.d, ROOM.wallH],
  ])
    pts.push(probe.project(x, y, z));
  const minX = Math.min(...pts.map((p) => p.sx));
  const maxX = Math.max(...pts.map((p) => p.sx));
  const minY = Math.min(...pts.map((p) => p.sy));
  const maxY = Math.max(...pts.map((p) => p.sy));
  const W = Math.ceil(maxX - minX) + 8;
  const H = Math.ceil(maxY - minY) + 8;
  return { W, H, ox: Math.round(4 - minX), oy: Math.round(4 - minY) };
}

const FRAME = frame(S);
export const ART_W = FRAME.W;
export const ART_H = FRAME.H;

/** Coordenadas locales de un mueble → mundo, según su giro (o su pared). */
function toWorld(item, cat, base, lx, ly, lz) {
  if (cat.capa === 'pared') return item.pared === 'fondo' ? [item.a + lx, ly, lz] : [ly, item.a + lx, lz];
  const { w, d } = cat;
  let x = lx;
  let y = ly;
  if (item.rot === 1) [x, y] = [d - ly, lx];
  else if (item.rot === 2) [x, y] = [w - lx, d - ly];
  else if (item.rot === 3) [x, y] = [ly, w - lx];
  return [item.x + x, item.y + y, base + lz];
}

function worldBox(item, cat, base, b) {
  const p = toWorld(item, cat, base, b[0], b[1], b[2]);
  const q = toWorld(item, cat, base, b[3], b[4], b[5]);
  return [Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.min(p[2], q[2]), Math.max(p[0], q[0]), Math.max(p[1], q[1]), Math.max(p[2], q[2])];
}

/** Color de una alfombra en un punto del suelo (0 si el punto queda fuera, en la trenzada redonda). */
function rugColor(r, item, x, y, ix, iy) {
  const cat = catalogItem(item.id);
  const T = cat.tonos[item.tono];
  const rc = rectOf(item);
  const cx = (rc.x0 + rc.x1) / 2;
  const cy = (rc.y0 + rc.y1) / 2;
  const ex = (x - cx) / ((rc.x1 - rc.x0) / 2 - 0.08);
  const ey = (y - cy) / ((rc.y1 - rc.y0) / 2 - 0.08);
  const dither = (r.bayerAt(ix, iy) - 0.5) * 0.4;
  const level = (k) => Math.max(0, Math.min(4, Math.floor(2.9 + (noise(x * 4, y * 4) - 0.5) * 0.8 + dither + k)));
  if (item.id === 'alfombra-redonda') {
    const e = Math.hypot(ex, ey);
    if (e > 1) return 0;
    // Trenzada: anillos que alternan el tono, crema y una vuelta más oscura
    const ring = Math.floor(e * 6.5 + (hash(Math.floor(Math.atan2(ey, ex) * 8), 1) - 0.5) * 0.15);
    const ramp = r.rampOf(ring % 3 === 1 ? CREAM : T);
    return ramp[level(ring % 3 === 2 ? -0.9 : 0)];
  }
  const e = Math.max(Math.abs(ex), Math.abs(ey));
  if (e > 1) return 0;
  if (item.id === 'alfombra-rayas') {
    // Rayas a lo largo del lado corto (en su tono, crema y un tono más oscuro) y un fleco claro en los extremos
    const long = rc.x1 - rc.x0 > rc.y1 - rc.y0;
    const along = long ? Math.abs(ex) : Math.abs(ey);
    if (along > 0.93) return r.rampOf(CREAM)[level(0.4)];
    const t = long ? x - rc.x0 : y - rc.y0;
    const k = Math.floor(t * 2.6) % 3;
    return r.rampOf(k === 1 ? CREAM : T)[level(k === 2 ? -0.9 : 0)];
  }
  // De lana: ribete en su tono, franja crema y rombos salvia (o crema, si la alfombra ya es salvia)
  const band = 1 - e;
  let ramp = r.rampOf(T);
  if (band > 0.1 && band < 0.18) ramp = r.rampOf(CREAM);
  else if (band >= 0.18 && (Math.abs((x - cx) * 1.4) + Math.abs((y - cy) * 1.4)) % 1.4 < 0.28) ramp = r.rampOf(T === SAGE ? CREAM : SAGE);
  return ramp[level(0)];
}

export function floorColor(r, suelo, x, y, ix, iy) {
  const dither = (r.bayerAt(ix, iy) - 0.5) * 0.4;
  if (suelo === 'damero') {
    const odd = (Math.floor(x) + Math.floor(y)) % 2;
    const edge = x % 1 < 0.05 || y % 1 < 0.05;
    const ramp = r.rampOf(odd ? TILE_B : TILE_A);
    return ramp[Math.max(0, Math.min(4, Math.floor(3 + (noise(x * 3, y * 3) - 0.5) * 0.7 + dither - (edge ? 1 : 0))))];
  }
  if (suelo === 'barro') {
    const tx = Math.floor(x * 1.5);
    const ty = Math.floor(y * 1.5);
    if ((x * 1.5) % 1 < 0.07 || (y * 1.5) % 1 < 0.07) return r.rampOf(GROUT)[2];
    return r.rampOf(CLAY)[Math.max(0, Math.min(4, Math.floor(3 + (hash(tx, ty) - 0.5) * 1.1 + (noise(x * 5, y * 5) - 0.5) * 0.6 + dither)))];
  }
  const plank = Math.floor(y * 1.6);
  const seam = (y * 1.6) % 1 < 0.07 || ((x + hash(plank, 9) * 3) % 3) < 0.04;
  let level = 3 + (noise(x * 0.7 + plank * 13, y * 6) - 0.5) * 1.2 + (hash(plank, 3) - 0.5) * 0.6 + dither;
  if (seam) level -= 1.2;
  return r.rampOf(FLOOR_WOOD)[Math.max(0, Math.min(4, Math.floor(level)))];
}

/** Dibuja un mueble (todas sus cajas) con su identificador en el búfer de toques. */
function drawItem(r, room, item, { lift = 0 } = {}) {
  const cat = catalogItem(item.id);
  const base = heightOf(room, item) + lift;
  const boxes = shapeOf(item.id, cat.tonos[item.tono]);
  boxes.forEach((bx, k) => {
    const wb = worldBox(item, cat, base, bx.b);
    r.setId(item.uid | (bx.glow ? GLOW_BIT : 0));
    r.box(wb[0], wb[1], wb[2], wb[3], wb[4], wb[5], bx.c, { seed: item.uid * 7 + k, grain: bx.grain ?? 1, step: bx.step ?? 0.045 });
  });
  r.setId(0);
  if (cat.capa === 'suelo' || (cat.capa === 'encima' && lift > 0 && !heightOf(room, item))) {
    const rc = rectOf(item);
    const size = Math.min(rc.x1 - rc.x0, rc.y1 - rc.y0);
    r.castShadow((rc.x0 + rc.x1) / 2, (rc.y0 + rc.y1) / 2, 0.25 + lift, size * 0.55, 1, 0.5);
  }
}

/** Alfombra que se lleva en la mano: se pinta a ras de suelo, por debajo de los muebles. */
function drawFlatRug(r, item) {
  const rc = rectOf(item);
  const ca = Math.cos(YAW);
  const sa = Math.sin(YAW);
  const pts = [r.project(rc.x0, rc.y0, 0), r.project(rc.x1, rc.y0, 0), r.project(rc.x0, rc.y1, 0), r.project(rc.x1, rc.y1, 0)];
  const x0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p.sx))));
  const x1 = Math.min(r.W - 1, Math.ceil(Math.max(...pts.map((p) => p.sx))));
  const y0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p.sy))));
  const y1 = Math.min(r.H - 1, Math.ceil(Math.max(...pts.map((p) => p.sy))));
  for (let iy = y0; iy <= y1; iy += 1) {
    for (let ix = x0; ix <= x1; ix += 1) {
      const g = r.unprojectGround(ix + 0.5, iy + 0.5);
      if (g.x < rc.x0 || g.x > rc.x1 || g.y < rc.y0 || g.y > rc.y1) continue;
      const c = rugColor(r, item, g.x, g.y, ix, iy);
      if (!c) continue;
      const i = iy * r.W + ix;
      const d = (g.x * sa + g.y * ca) * (Math.sqrt(3) / 2);
      if (r.zb[i] > d + 0.02) continue;
      r.pix[i] = c;
      r.ids[i] = item.uid;
    }
  }
}

/** Paredes con zócalo de madera, moldura y yeso con algún punto de cal; arriba, el canto de madera. */
function drawWalls(r, room) {
  const color = PAREDES.find((p) => p.id === room.pared)?.color ?? PAREDES[0].color;
  const plaster = r.rampOf(color);
  const wainscot = r.rampOf(WAINSCOT);
  const wood = r.rampOf(WOOD);
  const face = (a, b, ix, iy) => {
    if (b > ROOM.wallH - 0.08) return wood[2];
    if (b < 1.0) return wainscot[Math.abs((a % 1.1) - 0.55) < 0.04 ? 1 : b > 0.9 ? 3 : 2];
    if (b < 1.12) return wood[3];
    const n = noise(a * 2.6 + 7, b * 2.6);
    const d = r.bayerAt(ix, iy);
    return plaster[n > 0.78 && d > 0.7 ? 4 : n < 0.22 && d > 0.8 ? 2 : 3];
  };
  const at = (x, y, z) => {
    const p = r.project(x, y, z);
    return [p.sx | 0, p.sy | 0];
  };
  r.setId(0);
  r.box(-WALL_T, -WALL_T, 0, ROOM.w, 0, ROOM.wallH, color, { grain: 0, step: 0.04, face: (f, a, b) => (f === 'front' ? face(a, b, ...at(a, 0, b)) : f === 'top' ? wood[3] : wood[1]) });
  r.box(-WALL_T, 0, 0, 0, ROOM.d, ROOM.wallH, color, { grain: 0, step: 0.04, face: (f, a, b) => (f === 'side' ? face(a, b, ...at(0, a, b)) : f === 'top' ? wood[3] : wood[1]) });
  // Rodapié: un listón oscuro donde la pared toca el suelo
  r.box(0, 0, 0, ROOM.w, 0.08, 0.16, WOOD, { grain: 0 });
  r.box(0, 0, 0, 0.08, ROOM.d, 0.16, WOOD, { grain: 0 });
}

/** Una instancia de dibujo para un lienzo. */
/** El telón tramado a `w` × `h` píxeles del dibujo, para el fondo de la página en la vista «dentro» (data URL). */
export function backdropImage(w, h, evening = false) {
  const { tones } = BACKDROP[evening ? 'evening' : 'day'];
  const probe = createRaster({ W: 1, H: 1, S: 1, yaw: YAW, ox: 0, oy: 0 });
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(w, h);
  const pix = new Uint32Array(image.data.buffer);
  for (let iy = 0; iy < h; iy += 1) {
    const t = (iy / Math.max(1, h - 1)) * (tones.length - 1);
    const band = Math.min(tones.length - 2, Math.floor(t));
    for (let ix = 0; ix < w; ix += 1) pix[iy * w + ix] = rgb(...tones[t - band > probe.bayerAt(ix, iy) ? band + 1 : band]);
  }
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL();
}

export function createRoomRenderer() {
  const r = createRaster({ W: ART_W, H: ART_H, S, yaw: YAW, ox: FRAME.ox, oy: FRAME.oy });
  const baked = new Uint32Array(ART_W * ART_H);
  const bakedZ = new Float32Array(ART_W * ART_H);
  const bakedIds = new Uint16Array(ART_W * ART_H);
  let bakedRoom = null;
  let excluded = new Set();
  const backdrops = {};

  /**
   * El telón tramado (se calcula una vez por luz: la silueta del piso no cambia). Con `clear`, solo la sombra: el
   * telón lo pone la página detrás (vista «dentro», backdropImage), para que no se note dónde acaba el lienzo.
   */
  function backdrop(kind, clear = false) {
    const key = `${kind}:${clear}`;
    if (backdrops[key]) return backdrops[key];
    const { tones, shadow } = BACKDROP[kind];
    const out = new Uint32Array(ART_W * ART_H);
    // Dónde acaba el piso en cada columna, para su sombra
    const bottom = new Int32Array(ART_W).fill(-1);
    for (let i = 0; i < bakedZ.length; i += 1) if (bakedZ[i] > -1e8) bottom[i % ART_W] = Math.max(bottom[i % ART_W], (i / ART_W) | 0);
    for (let iy = 0; iy < ART_H; iy += 1) {
      const t = (iy / (ART_H - 1)) * (tones.length - 1);
      const band = Math.min(tones.length - 2, Math.floor(t));
      for (let ix = 0; ix < ART_W; ix += 1) {
        const d = r.bayerAt(ix, iy);
        const below = bottom[ix] < 0 ? 99 : iy - bottom[ix];
        if (below > 0 && below <= 7 && (8 - below) / 9 > d) out[iy * ART_W + ix] = rgb(...shadow);
        else if (!clear) out[iy * ART_W + ix] = rgb(...tones[t - band > d ? band + 1 : band]);
      }
    }
    backdrops[key] = out;
    return out;
  }

  function bake(room, exclude = []) {
    bakedRoom = room;
    excluded = new Set(exclude);
    const rugs = room.items.filter((i) => catalogItem(i.id).capa === 'alfombra' && !excluded.has(i.uid));
    r.clear(BG);
    r.floor((x, y, ix, iy) => {
      if (x < 0 || y < 0 || x > ROOM.w || y > ROOM.d) {
        r.setId(0);
        return 0;
      }
      for (const rug of rugs) {
        const rc = rectOf(rug);
        if (x < rc.x0 || x > rc.x1 || y < rc.y0 || y > rc.y1) continue;
        const c = rugColor(r, rug, x, y, ix, iy);
        if (c) {
          r.setId(rug.uid);
          return c;
        }
      }
      r.setId(0);
      return floorColor(r, room.suelo, x, y, ix, iy);
    });
    r.setId(0);
    drawWalls(r, room);
    for (const item of room.items) {
      if (excluded.has(item.uid) || catalogItem(item.id).capa === 'alfombra') continue;
      drawItem(r, room, item);
    }
    r.applyShadows();
    r.bakeOcclusion();
    baked.set(r.pix);
    bakedZ.set(r.zb);
    bakedIds.set(r.ids);
  }

  function outline(room, item, ok) {
    const cat = catalogItem(item.id);
    const color = ok ? OK_LINE : BAD_LINE;
    const dash = ok ? 0 : 2;
    let corners;
    if (cat.capa === 'pared') {
      const [z0, z1] = [1.3, 3.4];
      const p = (s, z) => (item.pared === 'fondo' ? r.project(item.a + s, 0.02, z) : r.project(0.02, item.a + s, z));
      corners = [p(0, z0), p(cat.w, z0), p(cat.w, z1), p(0, z1)];
    } else {
      const rc = rectOf(item);
      const z = heightOf(room, item) + 0.02;
      corners = [r.project(rc.x0, rc.y0, z), r.project(rc.x1, rc.y0, z), r.project(rc.x1, rc.y1, z), r.project(rc.x0, rc.y1, z)];
      if (ok) {
        const fill = r.rampOf(OK_FILL);
        for (let x = rc.x0; x <= rc.x1; x += 0.04) {
          for (let y = rc.y0; y <= rc.y1; y += 0.04) {
            const p = r.project(x, y, z);
            const ix = p.sx | 0;
            const iy = p.sy | 0;
            if (ix < 0 || iy < 0 || ix >= ART_W || iy >= ART_H || (ix + iy) % 2) continue;
            const i = iy * ART_W + ix;
            if (r.zb[i] > p.d + 0.05) continue;
            r.pix[i] = fill[3];
          }
        }
      }
    }
    for (let k = 0; k < 4; k += 1) {
      const a = corners[k];
      const b = corners[(k + 1) % 4];
      r.line(a.sx, a.sy, b.sx, b.sy, color, dash);
    }
    if (!ok) {
      r.line(corners[0].sx, corners[0].sy, corners[2].sx, corners[2].sy, color, 2);
      r.line(corners[1].sx, corners[1].sy, corners[3].sx, corners[3].sy, color, 2);
    }
  }

  /** De tarde: la habitación se oscurece y se tiñe, y cada luz (lámparas, estufa, guirnalda) ilumina a su alrededor. */
  function evening(room) {
    const lights = [];
    for (const item of room.items) {
      const cat = catalogItem(item.id);
      if (!cat.luz) continue;
      const w = toWorld(item, cat, heightOf(room, item), cat.luz[0], cat.luz[1], cat.luz[2]);
      lights.push(r.project(w[0], w[1], w[2]));
    }
    const lit = r.rampOf(LIT);
    const { pix, ids } = r;
    for (let i = 0; i < pix.length; i += 1) {
      // El papel de fuera de la habitación no cambia
      if (r.zb[i] < -1e8) continue;
      const p = pix[i];
      if (ids[i] & GLOW_BIT) {
        const lum = ((p & 255) + ((p >> 8) & 255) + ((p >> 16) & 255)) / 765;
        pix[i] = lit[lum > 0.75 ? 4 : lum > 0.5 ? 3 : 2];
        continue;
      }
      const ix = i % ART_W;
      const iy = (i / ART_W) | 0;
      let g = 0;
      for (const l of lights) {
        const d = Math.hypot(ix - l.sx, (iy - l.sy) * 1.25) / 78;
        if (d < 1) g += (1 - d) ** 1.7;
      }
      g = Math.min(1, g);
      pix[i] = rgb((p & 255) * (0.6 + g * 0.55), ((p >> 8) & 255) * (0.56 + g * 0.42), ((p >> 16) & 255) * (0.74 + g * 0.06));
    }
  }

  // Los místicos (docs/qa/misticos.md): cada uno se pinta con pixelfx en su propio lienzo y se mezcla con el piso
  // respetando la profundidad (lo que está delante lo tapa); su luz se suma encima. Sus píxeles llevan el uid del
  // mueble, para poder tocarlo.
  const fxFrame = createFrame(ART_W, ART_H);
  function drawBeings(beings, t) {
    const { pix, zb, ids } = r;
    const C = fxFrame.color;
    const L = fxFrame.light;
    for (const b of beings) {
      const m = misticoOf(b.id);
      if (!m) continue;
      const at = r.project(b.x, b.y, b.z ?? 0);
      clearFrame(fxFrame);
      const p = painterFor(fxFrame);
      p.place(Math.round(at.sx), Math.round(at.sy), !!b.flip);
      m.draw(p, t, { moving: !!b.moving, perch: !!b.perch, tono: b.tono, full: !!b.full });
      const d = at.d + 0.15;
      for (let i = 0; i < C.length; i += 1) {
        const c = C[i];
        const l = L[i] & 0xffffff;
        if (!c && !l) continue;
        if (zb[i] > d) continue;
        let o = pix[i];
        const a = (c >>> 24) / 255;
        if (a > 0) {
          if (!o) o = c | 0xff000000;
          const mixc = (s) => (((c >>> s) & 255) * a + ((o >>> s) & 255) * (1 - a)) & 255;
          o = (0xff000000 | (mixc(16) << 16) | (mixc(8) << 8) | mixc(0)) >>> 0;
          if (a > 0.5 && b.uid) ids[i] = b.uid;
        }
        if (l && o) {
          const add = (s) => Math.min(255, ((o >>> s) & 255) + ((l >>> s) & 255));
          o = (0xff000000 | (add(16) << 16) | (add(8) << 8) | add(0)) >>> 0;
        }
        pix[i] = o;
      }
    }
  }

  /**
   * Un fotograma. `held`: { items: [objetos en la mano, ya con su posición], room: el piso con ellos dentro, ok } o null.
   * `selected`: objeto elegido (se dibuja su contorno). `evening`: luz de tarde.
   */
  function draw(ctx, image, { held = null, selected = null, ok = true, evening: isEvening = false, inside = false, actor = null, beings = null, t = 0 } = {}) {
    r.pix.set(baked);
    r.zb.set(bakedZ);
    r.ids.set(bakedIds);
    const room = held?.room ?? bakedRoom;
    if (held) {
      for (const item of held.items) {
        if (catalogItem(item.id).capa === 'alfombra') drawFlatRug(r, item);
        else drawItem(r, room, item);
      }
    }
    // El personaje (§69): sus cajas, con su identificador para poder tocarlo, y su sombra si está de pie en el suelo
    if (actor) {
      r.setId(ACTOR_ID);
      actor.boxes.forEach((bx, k) => {
        const [x0, y0, z0, x1, y1, z1] = bx.b;
        r.box(x0, y0, z0, x1, y1, z1, bx.c, { seed: 501 + k, grain: bx.grain ?? 0.6, step: bx.step ?? 0.03 });
      });
      r.setId(0);
      if (actor.shadow) r.castShadow(actor.shadow.x, actor.shadow.y, 0.2, 0.3, 1, 0.5);
    }
    if (held || actor) r.applyShadows();
    r.shadeEdges();
    if (selected) outline(room, selected, ok);
    if (isEvening) evening(room);
    if (beings?.length) drawBeings(beings, t);
    const back = backdrop(isEvening ? 'evening' : 'day', inside);
    const { pix } = r;
    for (let i = 0; i < pix.length; i += 1) if (pix[i] === 0) pix[i] = back[i];
    image.data.set(new Uint8ClampedArray(r.pix.buffer));
    ctx.putImageData(image, 0, 0);
  }

  /** Qué objeto hay bajo un punto del lienzo (uid o 0). Mira un poco alrededor para que tocar sea fácil. */
  function pick(ax, ay) {
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) {
      const ix = Math.round(ax + dx);
      const iy = Math.round(ay + dy);
      if (ix < 0 || iy < 0 || ix >= ART_W || iy >= ART_H) continue;
      const id = r.ids[iy * ART_W + ix] & ~GLOW_BIT;
      if (id) return id;
    }
    return 0;
  }

  /** Punto del suelo, de una superficie a la altura `z` o de una pared bajo un punto del lienzo. */
  const groundAt = (ax, ay, z = 0) => (z ? r.unprojectAtHeight(ax, ay, z) : r.unprojectGround(ax, ay));
  function wallAt(ax, ay) {
    const back = r.unprojectOnPlaneY(ax, ay, 0);
    if (back.x >= 0 && back.x <= ROOM.w && back.z >= 0 && back.z <= ROOM.wallH + 0.5) return { pared: 'fondo', s: back.x, z: back.z };
    const left = r.unprojectOnPlaneX(ax, ay, 0);
    if (left.y >= 0 && left.y <= ROOM.d && left.z >= 0 && left.z <= ROOM.wallH + 0.5) return { pared: 'izq', s: left.y, z: left.z };
    return null;
  }

  /** Punto del lienzo de un punto del mundo (para las pruebas y para colocar con el dedo). */
  const project = (x, y, z) => r.project(x, y, z);

  return { bake, draw, pick, groundAt, wallAt, project, raster: r };
}

/** Miniatura de un mueble del catálogo (para los botones), dibujada con el mismo motor. */
export function renderThumb(id, tonoIndex = 0, size = 44) {
  if (misticoOf(id)) return misticoThumb(id, size);
  const cat = catalogItem(id);
  const item = cat.capa === 'pared' ? { uid: 1, id, pared: 'fondo', a: 0, tono: tonoIndex } : { uid: 1, id, x: 0, y: 0, rot: 0, tono: tonoIndex };
  const boxes = cat.capa === 'alfombra' ? [{ b: [0, 0, 0, cat.w, cat.d, 0.05] }] : shapeOf(id, cat.tonos[tonoIndex]);
  const probe = createRaster({ W: 1, H: 1, S: 1, yaw: YAW, ox: 0, oy: 0 });
  const pts = [];
  for (const bx of boxes) {
    const wb = worldBox(item, cat, 0, bx.b);
    for (const x of [wb[0], wb[3]]) for (const y of [wb[1], wb[4]]) for (const z of [wb[2], wb[5]]) pts.push(probe.project(x, y, z));
  }
  const minX = Math.min(...pts.map((p) => p.sx));
  const maxX = Math.max(...pts.map((p) => p.sx));
  const minY = Math.min(...pts.map((p) => p.sy));
  const maxY = Math.max(...pts.map((p) => p.sy));
  const s = Math.min((size - 6) / (maxX - minX), (size - 6) / (maxY - minY), 22);
  const r = createRaster({ W: size, H: size, S: s, yaw: YAW, ox: Math.round((size - (maxX - minX) * s) / 2 - minX * s), oy: Math.round((size - (maxY - minY) * s) / 2 - minY * s) });
  r.clear(0);
  if (cat.capa === 'alfombra') {
    r.floor((x, y, ix, iy) => (x >= 0 && y >= 0 && x <= cat.w && y <= cat.d ? rugColor(r, item, x, y, ix, iy) : 0));
  } else {
    shapeOf(id, cat.tonos[tonoIndex]).forEach((bx, k) => {
      const wb = worldBox(item, cat, 0, bx.b);
      r.box(wb[0], wb[1], wb[2], wb[3], wb[4], wb[5], bx.c, { seed: 7 + k, grain: bx.grain ?? 1, step: Math.min(0.045, 0.7 / s) });
    });
    r.shadeEdges();
  }
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(size, size);
  image.data.set(new Uint8ClampedArray(r.pix.buffer));
  ctx.putImageData(image, 0, 0);
  return canvas;
}

/**
 * Miniatura del personaje (§69) para el armario de la balda, encuadrada en una parte (`frame`: 'head', 'torso',
 * 'legs' o 'all'; lo demás queda fuera). Mira hacia delante, un poco girado, como en la habitación.
 */
const THUMB_FRAMES = { head: (b) => b[2] >= 1.3, torso: (b) => b[2] >= 0.6 && b[5] <= 1.5, legs: (b) => b[5] <= 0.75, all: () => true };
export function renderActorThumb(avatar, { frame = 'all', size = 33 } = {}) {
  const boxes = actorBoxes(avatar, { x: 0, y: 0, facing: 0, pose: 'stand' });
  const framed = boxes.filter((bx) => THUMB_FRAMES[frame](bx.b));
  const probe = createRaster({ W: 1, H: 1, S: 1, yaw: YAW, ox: 0, oy: 0 });
  const pts = [];
  for (const { b } of framed) for (const x of [b[0], b[3]]) for (const y of [b[1], b[4]]) for (const z of [b[2], b[5]]) pts.push(probe.project(x, y, z));
  const minX = Math.min(...pts.map((p) => p.sx));
  const maxX = Math.max(...pts.map((p) => p.sx));
  const minY = Math.min(...pts.map((p) => p.sy));
  const maxY = Math.max(...pts.map((p) => p.sy));
  const s = Math.min((size - 4) / (maxX - minX), (size - 4) / (maxY - minY));
  const r = createRaster({ W: size, H: size, S: s, yaw: YAW, ox: Math.round((size - (maxX - minX) * s) / 2 - minX * s), oy: Math.round((size - (maxY - minY) * s) / 2 - minY * s) });
  r.clear(0);
  boxes.forEach((bx, k) => {
    const [x0, y0, z0, x1, y1, z1] = bx.b;
    r.box(x0, y0, z0, x1, y1, z1, bx.c, { seed: 501 + k, grain: bx.grain ?? 0.6, step: Math.min(bx.step ?? 0.03, 0.5 / s) });
  });
  r.shadeEdges();
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(size, size);
  image.data.set(new Uint8ClampedArray(r.pix.buffer));
  ctx.putImageData(image, 0, 0);
  return canvas;
}

/**
 * El personaje andando (1.78, encargo del 3-11-2026: «que se vea yendo a los sitios»), para dibujos que no son la
 * habitación (la fachada): una tira de cuatro fotogramas (pierna adelante, juntas, la otra, juntas) mirando hacia
 * `facing`, con la escala `S` y el giro de cámara `yaw` de ese dibujo. Devuelve { canvas, w, h, ax, ay }: el tamaño
 * de cada fotograma y dónde caen los pies (el punto 0, 0, 0) dentro de él.
 */
export function renderActorWalk(avatar, { facing = 0, S: scale = 16, yaw = YAW } = {}) {
  const frames = [1, 0, 2, 0].map((step) => actorBoxes(avatar, { x: 0, y: 0, facing, pose: 'walk', step }));
  const probe = createRaster({ W: 1, H: 1, S: scale, yaw, ox: 0, oy: 0 });
  const pts = [];
  for (const boxes of frames) for (const { b } of boxes) for (const x of [b[0], b[3]]) for (const y of [b[1], b[4]]) for (const z of [b[2], b[5]]) pts.push(probe.project(x, y, z));
  const minX = Math.floor(Math.min(...pts.map((p) => p.sx))) - 1;
  const minY = Math.floor(Math.min(...pts.map((p) => p.sy))) - 1;
  const w = Math.ceil(Math.max(...pts.map((p) => p.sx))) - minX + 2;
  const h = Math.ceil(Math.max(...pts.map((p) => p.sy))) - minY + 2;
  const canvas = document.createElement('canvas');
  canvas.width = w * frames.length;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  frames.forEach((boxes, f) => {
    const r = createRaster({ W: w, H: h, S: scale, yaw, ox: -minX, oy: -minY });
    r.clear(0);
    boxes.forEach((bx, k) => {
      const [x0, y0, z0, x1, y1, z1] = bx.b;
      r.box(x0, y0, z0, x1, y1, z1, bx.c, { seed: 501 + k, grain: bx.grain ?? 0.6, step: Math.min(bx.step ?? 0.03, 0.5 / scale) });
    });
    r.shadeEdges();
    const image = ctx.createImageData(w, h);
    image.data.set(new Uint8ClampedArray(r.pix.buffer));
    ctx.putImageData(image, f * w, 0);
  });
  return { canvas, w, h, ax: -minX, ay: -minY };
}

export const ROOM_SCALE = S;
