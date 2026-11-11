// La calle del edificio en 3D (encargo de Francisco del 11-11-2026, «Exteriores en 3D»: que salir a la calle no descuadre
// después del piso y la recepción en 3D). El mismo edificio de la fachada 2D (facade.js), visto desde el muelle a la
// altura de una persona, de pie junto a la limusina: se mira un poco hacia arriba y se gira a los lados.
//
// Cómo se hace sin dibujarlo dos veces: las cajas de la fachada (drawFacadeBody) se «graban» en vez de pintarse, con un
// rasterizador de mentira que guarda cada caja con su color, su veta, su id y su función de detalles (`face`). Cada cara
// visible se pinta luego en una lámina de textura con las mismas rampas, el mismo tramado y los mismos detalles que en el
// 2D, y todas van juntas en una sola malla. La luz de la tarde y la de las ventanas ya van pintadas en las láminas,
// como en el piso y la recepción: Three.js a 320 px de ancho, ampliado sin suavizar, y solo se dibuja cuando algo cambia.
// Bloque 1: el edificio, los vecinos, el muelle y el cielo, y tu vista. Los toques (pisos, tienda, buzón, limusina), en
// el siguiente.
import {
  BufferGeometry,
  CanvasTexture,
  CylinderGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  PerspectiveCamera,
  PlaneGeometry,
  SRGBColorSpace,
  Scene,
  Vector3,
  WebGLRenderer,
  BackSide,
  RepeatWrapping,
} from 'three';
import { createRaster, hash, noise, rgb } from '../minigames/libreria-puerto/raster';
import { FACADE_PARTS, FACADE_SKY, FLATS, drawFacadeBody, neighbour, signGlyphs } from './facade';
import { windowPictures } from './windowView';

const ART_W = 320;
const { BW, BD, GROUND_H, FLOOR_H, TOP, TOWER_H, SIGN_X0, SIGN_X1, SIGN_Y, SIGN_Z0, SIGN_Z1, GLOW_BIT, GLASS_ID, colors: C } = FACADE_PARTS;

/** Dónde estás: en el muelle, frente al portal, un paso por delante de la limusina. Mundo de la app (x, y, z = altura). */
export const EYE = { x: BW / 2, y: BD + 8.6, z: 1.6 };
/** Cuánto más alto va el cartel que en el 2D (para que el antepecho no lo tape visto desde abajo). */
const SIGN_LIFT = 0.8;
/** Lo más alto del edificio (el cartel, o el remate de los torreones): la vista de siempre lo deja dentro, arriba. */
const ROOF_TOP = Math.max(TOP + TOWER_H + 0.62, SIGN_Z1 + SIGN_LIFT);
/** Campo de visión horizontal en vertical (móvil), y vertical en apaisado. Tope vertical para no deformar. */
const HFOV = 54;
const VFOV_LANDSCAPE = 74; // más que en la recepción: el edificio entero, del portal al cartel
const VFOV_MAX = 90;
/** Cuánto se gira a cada lado (radianes) y cuánto se baja la vista desde la de siempre. */
const YAW_MAX = 0.5;
/**
 * Por dónde se anda (bloque 2, «salir a pie»): al salir de tu piso apareces en el umbral del portal, mirando al muelle, y
 * te das la vuelta hasta la vista de siempre; a la limusina y a la tienda se va andando. Mundo de la app (x, y).
 */
export const SPOTS = {
  home: { x: EYE.x, y: EYE.y },
  door: { x: BW / 2, y: BD + 0.55 },
  turn: { x: BW / 2 - 0.45, y: BD + 3.6 },
  limo: { x: 5.7, y: BD + 3.3 },
  shop: { x: 6.5, y: BD + 3.5 },
};
// La calle se monta para verse bien desde todos ellos (solo se pintan las caras que se ven desde alguno)
const EYES = Object.values(SPOTS).map((p) => [p.x, p.y, EYE.z]);
const PITCH_DOWN = 0.3;
const PX = 32; // píxeles de textura por unidad, como el piso y la recepción
const GROUND_PX = 24;
const DRAG = 0.004;
const KEY_STEP = 0.08;
const TAP_SLOP = 6;
// Los 14 × 22 píxeles de la ventana de la fachada 2D: por dentro se ve lo mismo, a doble tamaño
const WIN_W = 14;
const WIN_H = 22;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const R = (c) => c & 255;
const G = (c) => (c >> 8) & 255;
const B = (c) => (c >> 16) & 255;

// Solo se usa por sus rampas de tonos y su tramado: no dibuja nada
let probeRaster = null;
const probe = () => (probeRaster ??= createRaster({ W: 2, H: 2, S: 1, yaw: 0, ox: 0, oy: 0 }));

/**
 * Un rasterizador de mentira con lo que usa drawFacadeBody: guarda las cajas en vez de pintarlas. `project` solo da un
 * píxel para el tramado de la pared (en el 3D, el de la textura); las sombras proyectadas se guardan para el suelo.
 */
function recorder() {
  const p = probe();
  const boxes = [];
  const shadows = [];
  let id = 0;
  return {
    boxes,
    shadows,
    rampOf: p.rampOf,
    bayerAt: p.bayerAt,
    setId: (v) => {
      id = v;
    },
    project: (x, y, z) => ({
      sx: Math.round(x * PX),
      sy: Math.round(-z * PX),
      d: 0,
    }),
    castShadow: (x, y, z, r) => shadows.push({ x: x + z, y: y - 0.25 * z, r }),
    box(x0, y0, z0, x1, y1, z1, c, { seed = 0, grain = 1, face = null } = {}) {
      boxes.push({ b: [x0, y0, z0, x1, y1, z1], c, seed, grain, face, id });
    },
  };
}

/** Graba la calle: el edificio de siempre y, como desde el muelle se ve más a los lados, dos vecinos más. */
function recordStreet(flats) {
  const rec = recorder();
  neighbour(rec, -11.5, -5.1, GROUND_H + FLOOR_H * 3 + 0.2, 3);
  neighbour(rec, 13.1, 19, GROUND_H + FLOOR_H + 0.5, 4);
  drawFacadeBody(rec, flats);
  // Desde abajo, el antepecho de la azotea tapaba la mitad del cartel: aquí va más alto, con las patas más largas
  const near = (a, b) => Math.abs(a - b) < 1e-6;
  for (const box of rec.boxes) {
    const [x0, y0, z0, x1, , z1] = box.b;
    if (near(x0, SIGN_X0) && near(x1, SIGN_X1) && near(z0, SIGN_Z0) && near(z1, SIGN_Z1)) {
      box.lift = SIGN_LIFT;
      box.b = box.b.map((v, i) => (i === 2 || i === 5 ? v + SIGN_LIFT : v));
    } else if (near(z0, TOP + 0.2) && near(z1, TOP + 1.2) && near(y0, SIGN_Y - 0.05)) box.b[5] += SIGN_LIFT;
  }
  // Las farolas del bordillo, a los lados del portal (se ven al girar)
  for (const x of LAMPS) {
    rec.box(x - 0.14, LAMP_Y - 0.14, 0, x + 0.14, LAMP_Y + 0.14, 0.35, C.IRON, {
      grain: 0,
    });
    rec.box(x - 0.05, LAMP_Y - 0.05, 0.35, x + 0.05, LAMP_Y + 0.05, 3.1, C.IRON, { grain: 0 });
    rec.box(x - 0.2, LAMP_Y - 0.2, 3.1, x + 0.2, LAMP_Y + 0.2, 3.16, C.IRON, {
      grain: 0,
    });
    rec.setId(GLOW_BIT);
    rec.box(x - 0.15, LAMP_Y - 0.15, 3.16, x + 0.15, LAMP_Y + 0.15, 3.5, C.LIT, { grain: 0 });
    rec.setId(0);
    rec.box(x - 0.22, LAMP_Y - 0.22, 3.5, x + 0.22, LAMP_Y + 0.22, 3.58, C.IRON, { grain: 0 });
    rec.box(x - 0.06, LAMP_Y - 0.06, 3.58, x + 0.06, LAMP_Y + 0.06, 3.72, C.IRON, { grain: 0 });
  }
  return rec;
}
const LAMPS = [-0.7, BW + 0.7];
const LAMP_Y = BD + 1.3;

/**
 * Las caras de una caja que se ven desde los ojos, cada una con su esquina de arriba a la izquierda (`o`), sus dos
 * lados (`u`, a lo ancho; `v`, hacia abajo), qué función de detalles le toca (la del 2D: 'top', 'front' o 'side'),
 * su tono de partida en la rampa (los del 2D: arriba 3,4, frente 2,3, lateral 1,2; los que el 2D no ve, más oscuros) y
 * cómo se pasa de un punto del mundo a las dos coordenadas (a, b) de esa función.
 */
function facesOf({ b: [x0, y0, z0, x1, y1, z1] }) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dz = z1 - z0;
  const out = [];
  const add = (f) => {
    const n = f.n;
    if (EYES.some((e) => n[0] * (e[0] - f.o[0]) + n[1] * (e[1] - f.o[1]) + n[2] * (e[2] - f.o[2]) > 1e-6)) out.push(f);
  };
  if (dx > 1e-4 && dz > 1e-4)
    add({
      kind: 'front',
      fn: 'front',
      base: 2.3,
      n: [0, 1, 0],
      o: [x0, y1, z1],
      u: [dx, 0, 0],
      v: [0, 0, -dz],
      ab: (p) => [p[0], p[2]],
    });
  if (dy > 1e-4 && dz > 1e-4)
    add({
      kind: 'side',
      fn: 'side',
      base: 1.2,
      n: [1, 0, 0],
      o: [x1, y1, z1],
      u: [0, -dy, 0],
      v: [0, 0, -dz],
      ab: (p) => [p[1], p[2]],
    });
  if (dy > 1e-4 && dz > 1e-4)
    add({
      kind: 'side0',
      fn: 'side',
      base: 1.9,
      n: [-1, 0, 0],
      o: [x0, y0, z1],
      u: [0, dy, 0],
      v: [0, 0, -dz],
      ab: (p) => [p[1], p[2]],
    });
  if (dx > 1e-4 && dy > 1e-4)
    add({
      kind: 'top',
      fn: 'top',
      base: 3.4,
      n: [0, 0, 1],
      o: [x0, y0, z1],
      u: [dx, 0, 0],
      v: [0, dy, 0],
      ab: (p) => [p[0], p[1]],
    });
  if (dx > 1e-4 && dy > 1e-4 && z0 > 0.01)
    add({
      kind: 'bottom',
      fn: 'top',
      base: 1.0,
      n: [0, 0, -1],
      o: [x0, y1, z0],
      u: [dx, 0, 0],
      v: [0, -dy, 0],
      ab: (p) => [p[0], p[1]],
    });
  return out;
}

/** La luz de la tarde (la de la fachada 2D) con lo que alumbran las ventanas y los faroles cerca de `p`. */
function lightsOf(flats) {
  const out = [];
  for (const f of FLATS) if (flats[f.puerta]) for (const [w0, w1] of f.wins) out.push([(w0 + w1) / 2, BD + 0.3, (f.gz0 + f.gz1) / 2]);
  for (let k = 0; k < 3; k += 1) out.push([4, BD + 0.3, GROUND_H + k * FLOOR_H + 1.2]);
  out.push([5.05, BD + 0.5, 1.3], [1.6, BD + 0.3, 1.1], [6.4, BD + 0.3, 1.1]);
  for (const x of LAMPS) out.push([x, LAMP_Y, 3.3], [x, LAMP_Y, 1.2]);
  return out;
}
function dusk(c, p, lights) {
  let g = 0;
  for (const l of lights) {
    const d = Math.hypot(p[0] - l[0], p[1] - l[1], (p[2] - l[2]) * 1.3) / 1.7;
    if (d < 1) g += (1 - d) ** 1.6;
  }
  g = Math.min(1, g);
  return rgb(R(c) * (0.8 + g * 0.4), G(c) * (0.72 + g * 0.32), B(c) * (0.82 + g * 0.04));
}
const lum = (c) => (R(c) + G(c) + B(c)) / 765;

/**
 * Pinta una cara en `pix` (w × h): el color de la caja con su veta y tramado, los detalles de su `face`, lo de dentro de
 * las ventanas de los pisos, las letras del cartel y la luz de la tarde. Un filo un poco más oscuro, como los bordes del
 * dibujo 2D.
 */
function paintFace(box, f, w, h, ctx) {
  const r = probe();
  const ramp = r.rampOf(box.c);
  const [x0, y0, , x1, y1] = box.b;
  const longX = x1 - x0 >= y1 - y0;
  const g = (a, b) => (box.grain ? noise(a, b) : 0.5);
  const pix = new Uint32Array(w * h);
  const glassK = box.id >= GLASS_ID && box.id < GLASS_ID + FLATS.length ? box.id - GLASS_ID : -1;
  const flat = glassK >= 0 ? FLATS[glassK] : null;
  const occupied = flat && ctx.flats[flat.puerta];
  const glow = box.id & GLOW_BIT;
  // Dónde empieza cada texel en la rejilla del mundo, para que el tramado siga de una cara a la de al lado
  const ox = Math.round((f.kind === 'side' || f.kind === 'side0' ? f.o[1] : f.o[0]) * PX);
  const oy = Math.round(-f.o[2] * PX) + (f.kind === 'top' || f.kind === 'bottom' ? Math.round(f.o[1] * PX) : 0);
  for (let j = 0; j < h; j += 1) {
    for (let i = 0; i < w; i += 1) {
      const s = (i + 0.5) / w;
      const t = (j + 0.5) / h;
      const p = [f.o[0] + f.u[0] * s + f.v[0] * t, f.o[1] + f.u[1] * s + f.v[1] * t, f.o[2] + f.u[2] * s + f.v[2] * t];
      const [a, b] = f.ab(box.lift ? [p[0], p[1], p[2] - box.lift] : p);
      let c;
      if (f.kind === 'front' && flat) {
        c = windowTexel(flat, a, b, occupied, ctx, r.bayerAt(i, j) > 0.5);
        if (c != null) {
          pix[j * w + i] = occupied ? c : dusk(c, p, ctx.lights);
          continue;
        }
      }
      const grain = f.fn === 'top' ? (longX ? g(a * 0.8 + box.seed, b * 9) : g(a * 9, b * 0.8 + box.seed)) : g(a * 0.8 + box.seed, b * 9);
      c = box.face?.(f.fn, a, b) ?? ramp[clamp(Math.floor(f.base + (grain - 0.5) * 1.3 + (r.bayerAt(ox + i, oy + j) - 0.5) * 0.5), 0, 4)];
      if (glow) c = ctx.lit[lum(c) > 0.45 ? 3 : 1];
      else c = dusk(c, p, ctx.lights);
      // El filo de la cara, un poco más oscuro (en lo que mide más de tres texels)
      if (w > 3 && h > 3 && (i === 0 || j === 0 || i === w - 1 || j === h - 1) && !glow) c = rgb(R(c) * 0.86, G(c) * 0.84, B(c) * 0.9);
      pix[j * w + i] = c;
    }
  }
  if (f.kind === 'front' && Math.abs(x0 - SIGN_X0) < 1e-6 && Math.abs(x1 - SIGN_X1) < 1e-6 && box.lift) {
    // Las letras del cartel, a doble tamaño (cada píxel del 2D, dos por dos texels)
    signGlyphs(Math.floor(w / 2), (x, y, c) => {
      for (let dy = 0; dy < 2; dy += 1)
        for (let dx = 0; dx < 2; dx += 1) {
          const px = x * 2 + dx;
          const py = y * 2 + dy;
          if (px >= 0 && py >= 0 && px < w && py < h) pix[py * w + px] = c;
        }
    });
  }
  return pix;
}

/** Lo que se ve por el cristal de un piso (como en la fachada 2D): su interior con cortinas y travesaño, o la persiana. */
function windowTexel(f, a, b, occupied, ctx, sheenHere) {
  const wk = a > (f.wins[0][1] + f.wins[1][0]) / 2 ? 1 : 0;
  const win = f.wins[wk];
  const wu = (a - win[0]) / (win[1] - win[0]);
  const v = (f.gz1 - b) / (f.gz1 - f.gz0);
  if (wu < 0 || wu > 1 || v < 0 || v > 1) return null;
  if (!occupied) return ctx.blind[(b * 9) % 1 < 0.25 ? 1 : v < 0.08 ? 2 : 3];
  const lx = clamp(Math.floor(wu * WIN_W), 0, WIN_W - 1);
  const ly = clamp(Math.floor(v * WIN_H), 0, WIN_H - 1);
  if (ly === Math.round(WIN_H * 0.1)) return ctx.frameWood[2];
  if (lx === 0 || lx === WIN_W - 1 || ly < Math.round(WIN_H * 0.1)) return ctx.curtain[ly < Math.round(WIN_H * 0.1) ? 2 : (ly >> 1) % 2 ? 4 : 3];
  const c = ctx.pictures[f.puerta][wk][ly * WIN_W + lx];
  // Un reflejo del cielo en la esquina de arriba del cristal
  return sheenHere && lx + ly < 4 ? rgb(R(c) + 22, G(c) + 22, B(c) + 26) : c;
}

/** Reparte las láminas en un atlas (por estantes, de la más alta a la más baja), con un texel de margen repetido. */
function packAtlas(items, width = 2048) {
  const order = [...items.keys()].sort((p, q) => items[q].h - items[p].h);
  let x = 0;
  let y = 0;
  let row = 0;
  for (const k of order) {
    const it = items[k];
    const w = it.w + 2;
    const h = it.h + 2;
    if (x + w > width) {
      y += row;
      x = 0;
      row = 0;
    }
    it.ax = x + 1;
    it.ay = y + 1;
    x += w;
    row = Math.max(row, h);
  }
  const height = y + row;
  const data = new Uint32Array(width * height);
  for (const it of items) {
    for (let j = -1; j <= it.h; j += 1) {
      const sj = clamp(j, 0, it.h - 1);
      for (let i = -1; i <= it.w; i += 1) data[(it.ay + j) * width + it.ax + i] = it.pix[sj * it.w + clamp(i, 0, it.w - 1)];
    }
  }
  return { width, height, data };
}

function texture(canvas) {
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  t.magFilter = NearestFilter;
  t.minFilter = NearestFilter;
  t.generateMipmaps = false;
  return t;
}
function canvasFrom(w, h, data) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data.buffer), w, h), 0, 0);
  return canvas;
}

/** Las cajas grabadas, en una sola malla con su atlas. Mundo de la app → Three: (x, z, y). */
function buildStreet(flats) {
  const rec = recordStreet(flats);
  const r = probe();
  const ctx = {
    flats,
    lights: lightsOf(flats),
    lit: r.rampOf(C.LIT),
    curtain: r.rampOf(C.CURTAIN),
    frameWood: r.rampOf(C.FRAME_WOOD),
    blind: r.rampOf(C.BLIND),
    pictures: Object.fromEntries(Object.entries(flats).map(([puerta, fl]) => [puerta, windowPictures(fl.room, WIN_W, WIN_H)])),
  };
  const items = [];
  for (const box of rec.boxes) {
    for (const f of facesOf(box)) {
      const len = (v) => Math.hypot(v[0], v[1], v[2]);
      const w = Math.max(1, Math.round(len(f.u) * PX));
      const h = Math.max(1, Math.round(len(f.v) * PX));
      items.push({ f, w, h, pix: paintFace(box, f, w, h, ctx) });
    }
  }
  const atlas = packAtlas(items);
  const pos = [];
  const uv = [];
  const index = [];
  for (const { f, w, h, ax, ay } of items) {
    const corners = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    const base = pos.length / 3;
    for (const [s, t] of corners) {
      const p = [f.o[0] + f.u[0] * s + f.v[0] * t, f.o[1] + f.u[1] * s + f.v[1] * t, f.o[2] + f.u[2] * s + f.v[2] * t];
      pos.push(p[0], p[2], p[1]);
      uv.push((ax + s * w) / atlas.width, (ay + t * h) / atlas.height);
    }
    // El orden de los triángulos, para que miren hacia fuera (en Three, con y y z cambiados)
    const n3 = [f.n[0], f.n[2], f.n[1]];
    const u3 = [f.u[0], f.u[2], f.u[1]];
    const v3 = [f.v[0], f.v[2], f.v[1]];
    const cross = [u3[1] * v3[2] - u3[2] * v3[1], u3[2] * v3[0] - u3[0] * v3[2], u3[0] * v3[1] - u3[1] * v3[0]];
    if (cross[0] * n3[0] + cross[1] * n3[1] + cross[2] * n3[2] > 0) index.push(base, base + 1, base + 2, base, base + 2, base + 3);
    else index.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }
  return {
    pos,
    uv,
    index,
    atlasCanvas: canvasFrom(atlas.width, atlas.height, atlas.data),
    groundCanvas: paintGround(rec.shadows, ctx),
    faces: items.length,
    atlas: [atlas.width, atlas.height],
  };
}

// Lo pintado (lo que tarda) se guarda: si el portal se vuelve a montar con los mismos pisos (llega el correo, vuelves de
// un piso), solo se suben las láminas a la tarjeta gráfica
let cached = null;
function streetOf(flats) {
  const key = JSON.stringify(
    Object.entries(flats)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([puerta, f]) => [puerta, f.room?.pared ?? '', (f.room?.items ?? []).map((i) => [i.id, i.x ?? i.a ?? 0])]),
  );
  if (cached?.key !== key) cached = { key, data: buildStreet(flats) };
  return cached.data;
}
let skyCanvas = null;
let waterCanvas = null;

/** El agua del puerto más allá del muelle (se ve al salir del portal): una lámina pequeña que se repite. */
const WATER_TILE = 2; // unidades que mide cada lámina
function paintWater() {
  const r = probe();
  const water = r.rampOf(C.WATER);
  const n = WATER_TILE * GROUND_PX;
  const data = new Uint32Array(n * n);
  for (let j = 0; j < n; j += 1)
    for (let i = 0; i < n; i += 1) {
      const u = (2 * Math.PI * i) / n;
      const v = (2 * Math.PI * j) / n;
      const ripple = Math.sin(u + v * 3 + Math.sin(v * 2 + u) * 1.6);
      const c = water[ripple > 0.86 ? 4 : ripple < -0.55 ? 1 : 2];
      data[j * n + i] = rgb(R(c) * 0.8, G(c) * 0.72, B(c) * 0.82);
    }
  return canvasFrom(n, n, data);
}

/** El muelle: adoquines como los de la fachada, la acera de piedra junto a las casas y, al fondo detrás de ti, el agua. */
const GROUND = { x0: -14, x1: 22, y0: -0.5, y1: BD + 16 };
const QUAY_EDGE = BD + 13;
const PUDDLES = [
  [2.0, BD + 4.6, 0.7, 0.3],
  [6.6, BD + 3.4, 0.5, 0.22],
  [10.2, BD + 5.2, 0.9, 0.32],
  [-2.6, BD + 3.8, 0.8, 0.3],
];
function paintGround(shadows, ctx) {
  const r = probe();
  const cobble = r.rampOf(C.COBBLE);
  const stone = r.rampOf(C.STONE);
  const water = r.rampOf(C.WATER);
  const w = Math.round((GROUND.x1 - GROUND.x0) * GROUND_PX);
  const h = Math.round((GROUND.y1 - GROUND.y0) * GROUND_PX);
  const data = new Uint32Array(w * h);
  for (let j = 0; j < h; j += 1) {
    for (let i = 0; i < w; i += 1) {
      const x = GROUND.x0 + (i + 0.5) / GROUND_PX;
      const y = GROUND.y0 + (j + 0.5) / GROUND_PX;
      const d = (r.bayerAt(i, j) - 0.5) * 0.5;
      let c;
      if (y > QUAY_EDGE + 0.4) {
        const ripple = Math.sin(x * 3.1 + y * 7 + noise(x, y * 2) * 4);
        c = water[ripple > 0.82 ? 4 : ripple < -0.6 ? 1 : 2];
      } else if (y > QUAY_EDGE || y < BD + 0.55) {
        // El bordillo del muelle y la acera de losas pegada a las casas
        const slab = y < BD + 0.55 && ((x * 1.25) % 1 < 0.05 || y > BD + 0.5);
        c = stone[y > QUAY_EDGE ? 1 : slab ? 2 : 3];
      } else {
        // Adoquines más menudos que en el 2D (de cerca se ven grandes) y con menos tramado
        const cy = Math.floor(y * 3.6);
        const cx = Math.floor(x * 3 + (cy % 2) * 0.5);
        const seam = (x * 3 + (cy % 2) * 0.5) % 1 < 0.14 || (y * 3.6) % 1 < 0.16;
        c = cobble[clamp(Math.floor(3 + (hash(cx, cy) - 0.5) * 1.2 + d * 0.4 - (seam ? 1.3 : 0)), 0, 4)];
      }
      // Charcos (reflejan el cielo y la luz de los escaparates) y hojas de otoño
      const puddle = PUDDLES.some(([px, py, rx, ry]) => Math.hypot((x - px) / rx, (y - py) / ry) + noise(x * 3, y * 3) * 0.35 < 1);
      if (puddle && y > BD + 0.6 && y < QUAY_EDGE) {
        // Agua oscura que refleja el cielo, con algún destello de luz
        const glint = Math.sin(x * 11 + y * 3) > 0.94 && r.bayerAt(i, j) > 0.5;
        c = glint ? rgb(236, 190, 140) : r.rampOf([92, 84, 124])[Math.floor(noise(x * 4, y * 9) * 2.6 + 0.6)];
      } else if (y > BD + 0.6 && y < QUAY_EDGE && hash(Math.floor(x * 7), Math.floor(y * 7)) > 0.985) c = [rgb(196, 112, 52), rgb(214, 160, 70), rgb(160, 70, 48)][Math.floor(hash(x, y) * 3)];
      // Sombra al pie de las fachadas y las de la limusina y el bolardo
      let shade = y < BD + 0.3 && y > -0.2 ? 1 : 0;
      for (const s of shadows) {
        const e = Math.hypot((x - s.x) / (s.r * 1.05), (y - s.y) / (s.r * 0.7));
        if (e + (r.bayerAt(i, j) - 0.5) * 0.4 < 1) shade = 1;
      }
      if (shade) c = rgb(R(c) * 0.78, G(c) * 0.76, B(c) * 0.86);
      data[j * w + i] = y > QUAY_EDGE + 0.4 ? rgb(R(c) * 0.8, G(c) * 0.72, B(c) * 0.82) : dusk(c, [x, y, 0], ctx.lights);
    }
  }
  return canvasFrom(w, h, data);
}

/** El cielo de la tarde (los colores de la fachada 2D) alrededor, con las colinas, sus casitas encendidas y estrellas. */
const SKY_R = 70;
const SKY_H = 200;
function paintSky() {
  const w = 2048;
  const h = 768;
  const data = new Uint32Array(w * h);
  const r = probe();
  const sky = FACADE_SKY;
  for (let j = 0; j < h; j += 1) {
    // La fila j está a esta altura del cilindro (de arriba abajo) y se ve con esta elevación desde los ojos
    const hgt = SKY_H - ((j + 0.5) / h) * (SKY_H + 5) - 5;
    const elev = (Math.atan2(hgt - EYE.z, SKY_R) * 180) / Math.PI;
    for (let i = 0; i < w; i += 1) {
      const ridge = 1.2 + noise(i * 0.012, 3) * 4.5 + noise(i * 0.05, 8) * 1.2;
      let c;
      if (elev < ridge) {
        const house = hash(Math.floor(i / 3), Math.floor(j / 3)) > 0.93 && elev < ridge - 0.8 && elev > -0.5;
        c = house ? rgb(255, 214, 150) : rgb(84 + (ridge - elev) * 6, 66, 98);
      } else {
        const band = clamp(1 - (elev - 2) / 42, 0, 1) * (sky.length - 1);
        const k = clamp(Math.floor(band + (r.bayerAt(i, j) - 0.5) * 0.6), 0, sky.length - 2);
        const m = clamp(band - k, 0, 1);
        const a = sky[k];
        const b = sky[k + 1];
        const star = elev > 24 && hash(i, j) > 0.995;
        c = star ? rgb(250, 240, 220) : rgb(a[0] + (b[0] - a[0]) * m, a[1] + (b[1] - a[1]) * m, a[2] + (b[2] - a[2]) * m);
      }
      data[j * w + i] = c;
    }
  }
  return canvasFrom(w, h, data);
}

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Monta la calle en `container`. `flats`: { [puerta]: { room } } de las puertas ocupadas (como renderFacade).
 * Devuelve el control de la vista (para la app y las pruebas).
 */
/**
 * `dragArea` (opcional): el elemento que recibe el arrastre (por defecto, el lienzo). La app pone encima los botones de
 * los pisos: arrastrar sobre ellos también gira, y un arrastre no cuenta como toque.
 */
export function mountCalle(container, { flats = {}, startYaw = 0, startPitch = null, dragArea = null, onLost = () => {}, onFrame = () => {} } = {}) {
  const renderer = new WebGLRenderer({
    antialias: false,
    powerPreference: 'low-power',
    preserveDrawingBuffer: true,
  });
  const canvas = renderer.domElement;
  canvas.className = 'calle-canvas';
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'El edificio del puerto desde el muelle. Arrastra o usa las flechas para mirar.');
  renderer.setPixelRatio(1);
  const top = FACADE_SKY[0];
  renderer.setClearColor((top[0] << 16) | (top[1] << 8) | top[2]);

  const scene = new Scene();
  const camera = new PerspectiveCamera(70, 1, 0.2, 400);
  const owned = [];
  const own = (x) => (owned.push(x), x);

  const street = streetOf(flats);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(street.pos, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(street.uv, 2));
  geometry.setIndex(street.index);
  const atlasTex = texture(street.atlasCanvas);
  atlasTex.flipY = false;
  scene.add(new Mesh(own(geometry), own(new MeshBasicMaterial({ map: own(atlasTex) }))));
  const ground = new Mesh(
    own(new PlaneGeometry(GROUND.x1 - GROUND.x0, GROUND.y1 - GROUND.y0)),
    own(
      new MeshBasicMaterial({
        map: own(texture(street.groundCanvas)),
      }),
    ),
  );
  // El plano mira hacia arriba; la fila de arriba de su lámina, hacia las casas (y pequeña)
  ground.rotation.x = -Math.PI / 2;
  ground.position.set((GROUND.x0 + GROUND.x1) / 2, 0, (GROUND.y0 + GROUND.y1) / 2);
  scene.add(ground);
  const waterTex = own(texture((waterCanvas ??= paintWater())));
  waterTex.wrapS = RepeatWrapping;
  waterTex.wrapT = RepeatWrapping;
  const WATER = { x0: -120, x1: 130, y0: GROUND.y1 - 0.02, y1: GROUND.y1 + 140 };
  waterTex.repeat.set((WATER.x1 - WATER.x0) / WATER_TILE, (WATER.y1 - WATER.y0) / WATER_TILE);
  const sea = new Mesh(own(new PlaneGeometry(WATER.x1 - WATER.x0, WATER.y1 - WATER.y0)), own(new MeshBasicMaterial({ map: waterTex })));
  sea.rotation.x = -Math.PI / 2;
  sea.position.set((WATER.x0 + WATER.x1) / 2, -0.01, (WATER.y0 + WATER.y1) / 2);
  scene.add(sea);
  const sky = new Mesh(
    own(new CylinderGeometry(SKY_R, SKY_R, SKY_H + 5, 48, 1, true)),
    own(
      new MeshBasicMaterial({
        map: own(texture((skyCanvas ??= paintSky()))),
        side: BackSide,
        depthWrite: false,
      }),
    ),
  );
  sky.position.set(EYE.x, (SKY_H - 5) / 2, EYE.y);
  sky.renderOrder = -1;
  scene.add(sky);

  let yaw = clamp(startYaw, -YAW_MAX, YAW_MAX);
  // Dónde están los ojos (se mueven solo al andar) y el paseo en curso: { keys: [{ x, y, yaw, pitch }], t0, ms, done }
  const at = { ...SPOTS.home };
  let path = null;
  let pitch = 0;
  let pitchHome = 0;
  const pitchRange = () => [pitchHome - PITCH_DOWN, pitchHome];
  let raf = 0;
  let destroyed = false;
  let renders = 0;
  let pitchStart = startPitch;
  // Un paseo de la vista (al llegar): { from: [yaw, pitch], to, t0, ms }
  let glide = null;

  function aim() {
    if (glide) {
      const k = Math.min(1, (performance.now() - glide.t0) / glide.ms);
      const e = 1 - (1 - k) ** 3;
      yaw = glide.from[0] + (glide.to[0] - glide.from[0]) * e;
      pitch = glide.from[1] + (glide.to[1] - glide.from[1]) * e;
      if (k >= 1) glide = null;
    }
    if (path) {
      const k = Math.min(1, (performance.now() - path.t0) / path.ms);
      // Arranca y para despacio; cada tramo dura lo que mide (andar y girar)
      const e = k * k * (3 - 2 * k);
      const { keys, lens, total } = path;
      let dist = e * total;
      let i = 0;
      while (i < lens.length - 1 && dist > lens[i]) {
        dist -= lens[i];
        i += 1;
      }
      const t = lens[i] ? Math.min(1, dist / lens[i]) : 1;
      const a = keys[i];
      const b = keys[i + 1];
      at.x = a.x + (b.x - a.x) * t;
      at.y = a.y + (b.y - a.y) * t;
      yaw = a.yaw + (b.yaw - a.yaw) * t;
      // La vista de siempre se mira al pintar: si el móvil gira a medio paso, se llega a la nueva
      const pa = a.pitch === 'home' ? pitchHome : a.pitch;
      pitch = pa + ((b.pitch === 'home' ? pitchHome : b.pitch) - pa) * t;
      if (k >= 1) {
        const done = path.done;
        path = null;
        done();
      }
    }
    camera.position.set(at.x, EYE.z, at.y);
    sky.position.x = at.x;
    sky.position.z = at.y;
    const d = 10;
    camera.lookAt(at.x + Math.sin(yaw) * d, EYE.z + Math.tan(pitch) * d, at.y - Math.cos(yaw) * d);
  }
  function draw() {
    raf = 0;
    if (destroyed || document.visibilityState === 'hidden') return;
    aim();
    renderer.render(scene, camera);
    renders += 1;
    onFrame();
    if (glide || path) invalidate();
  }
  function invalidate() {
    if (!raf && !destroyed) raf = requestAnimationFrame(draw);
  }
  function resize() {
    const rect = container.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    renderer.setSize(ART_W, Math.max(1, Math.round((ART_W * rect.height) / rect.width)), false);
    camera.aspect = rect.width / rect.height;
    const portrait = (2 * Math.atan(Math.tan((HFOV * Math.PI) / 360) / camera.aspect) * 180) / Math.PI;
    camera.fov = camera.aspect < 1 ? Math.min(VFOV_MAX, portrait) : VFOV_LANDSCAPE;
    camera.updateProjectionMatrix();
    // La vista de siempre: lo más alto del edificio, justo dentro por arriba (si cabe, sin mirar hacia arriba de más)
    const up = Math.atan2(ROOF_TOP - EYE.z, EYE.y - BD);
    const was = pitch - pitchHome;
    pitchHome = clamp(up - (camera.fov * Math.PI) / 360 + 0.06, 0, 0.7);
    pitch = clamp(pitchHome + was, ...pitchRange());
    if (pitchStart != null) {
      pitch = clamp(pitchHome + pitchStart, ...pitchRange());
      pitchStart = null;
    }
    invalidate();
  }

  // Mirar: arrastrar (a los lados gira; arriba y abajo, solo hasta la vista de siempre) o las flechas
  const stop = new AbortController();
  const on = { signal: stop.signal };
  let press = null;
  const pad = dragArea ?? canvas;
  // Tras un arrastre, el «click» que el navegador manda al soltar no es un toque
  let dragged = false;
  pad.addEventListener(
    'click',
    (e) => {
      if (!dragged) return;
      dragged = false;
      e.preventDefault();
      e.stopPropagation();
    },
    { capture: true, signal: stop.signal },
  );
  pad.addEventListener(
    'pointerdown',
    (e) => {
      if (press) return;
      press = {
        x: e.clientX,
        y: e.clientY,
        yaw,
        pitch,
        id: e.pointerId,
        moved: false,
      };
      dragged = false;
    },
    on,
  );
  pad.addEventListener(
    'pointermove',
    (e) => {
      if (!press || e.pointerId !== press.id) return;
      if (!press.moved && Math.hypot(e.clientX - press.x, e.clientY - press.y) > TAP_SLOP) {
        press.moved = true;
        dragged = true;
        glide = null;
        try {
          pad.setPointerCapture?.(e.pointerId);
        } catch {
          // Sin captura, se sigue mientras el dedo esté encima
        }
      }
      if (!press.moved || path) return;
      yaw = clamp(press.yaw + (e.clientX - press.x) * DRAG, -YAW_MAX, YAW_MAX);
      pitch = clamp(press.pitch + (e.clientY - press.y) * DRAG, ...pitchRange());
      invalidate();
    },
    on,
  );
  const release = (e) => {
    if (press && e.pointerId === press.id) press = null;
  };
  pad.addEventListener('pointerup', release, on);
  pad.addEventListener('pointercancel', release, on);
  canvas.addEventListener(
    'keydown',
    (e) => {
      const k = {
        ArrowLeft: [-KEY_STEP, 0],
        ArrowRight: [KEY_STEP, 0],
        ArrowUp: [0, KEY_STEP],
        ArrowDown: [0, -KEY_STEP],
      }[e.key];
      if (!k || path) return;
      e.preventDefault();
      yaw = clamp(yaw + k[0], -YAW_MAX, YAW_MAX);
      pitch = clamp(pitch + k[1], ...pitchRange());
      invalidate();
    },
    on,
  );
  canvas.addEventListener(
    'webglcontextlost',
    (e) => {
      e.preventDefault();
      onLost();
    },
    on,
  );
  document.addEventListener('visibilitychange', invalidate, on);
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  container.append(canvas);
  resize();

  const tmp = new Vector3();
  return {
    canvas,
    yaw: () => yaw,
    pitch: () => pitch,
    setView(y, p = pitchHome) {
      yaw = clamp(y, -YAW_MAX, YAW_MAX);
      pitch = clamp(p, ...pitchRange());
      invalidate();
    },
    pitchHome: () => pitchHome,
    /** Llevar la vista poco a poco hasta (yaw, cabeceo respecto a la de siempre). Con movimiento reducido, de golpe. */
    /**
     * Andar por `keys` ([{ x, y, yaw, pitch }]; `pitch: 'home'` es la vista de siempre, y un punto con `spot` toma su
     * sitio de SPOTS) desde donde estás (o desde `from`). Con movimiento reducido, de golpe. La promesa se cumple al llegar.
     */
    walk(keys, { ms = null, from = null } = {}) {
      glide = null;
      const fix = (k) => {
        const p = k.spot ? SPOTS[k.spot] : k;
        return { x: p.x, y: p.y, yaw: k.yaw ?? 0, pitch: k.pitch == null ? 'home' : k.pitch };
      };
      if (from) {
        const f = fix(from);
        Object.assign(at, { x: f.x, y: f.y });
        yaw = f.yaw;
        pitch = f.pitch === 'home' ? pitchHome : f.pitch;
      }
      const list = [{ x: at.x, y: at.y, yaw, pitch }, ...keys.map(fix)];
      const lens = list.slice(1).map((b, i) => Math.hypot(b.x - list[i].x, b.y - list[i].y) + Math.abs(b.yaw - list[i].yaw) * 1.3 + 1e-3);
      const total = lens.reduce((a, b) => a + b, 0);
      return new Promise((resolve) => {
        if (reduced()) {
          const last = list[list.length - 1];
          Object.assign(at, { x: last.x, y: last.y });
          yaw = last.yaw;
          pitch = last.pitch === 'home' ? pitchHome : last.pitch;
          invalidate();
          resolve();
          return;
        }
        path = { keys: list, lens, total, t0: performance.now(), ms: ms ?? Math.max(500, total * 420), done: resolve };
        invalidate();
      });
    },
    walking: () => Boolean(path),
    where: () => ({ ...at }),
    glideTo(y, dp = 0, ms = 1100) {
      const to = [clamp(y, -YAW_MAX, YAW_MAX), clamp(pitchHome + dp, ...pitchRange())];
      if (reduced()) [yaw, pitch] = to;
      else glide = { from: [yaw, pitch], to, t0: performance.now(), ms };
      invalidate();
    },
    settled: () => !glide && !path,
    renders: () => renders,
    /** Cuántas caras y de qué tamaño es el atlas (para vigilar lo que pesa). */
    stats: () => ({ faces: street.faces, atlas: street.atlas }),
    /** Dónde cae en la pantalla un punto del mundo de la app (px del contenedor). */
    toScreen(x, y, z) {
      aim();
      tmp.set(x, z, y).project(camera);
      // Con el tamaño sin transformar (al asomarse, la vista se amplía con CSS)
      return {
        x: ((tmp.x + 1) / 2) * container.clientWidth,
        y: ((1 - tmp.y) / 2) * container.clientHeight,
        visible: tmp.z < 1,
      };
    },
    reduced,
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      stop.abort();
      observer.disconnect();
      for (const x of owned) x.dispose?.();
      renderer.dispose();
      canvas.remove();
    },
  };
}
