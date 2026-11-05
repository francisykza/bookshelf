// Los materiales del interior, sacados de los de la vista isométrica: el mismo suelo (`floorColor`), la misma rampa de tonos
// y el mismo tapizado por cajas del sillón (`armchair` de furniture.js), con volumen y costura porque aquí se ve de cerca.
import { BoxGeometry, BufferAttribute, BufferGeometry, CanvasTexture, Color, Float32BufferAttribute, NearestFilter, RepeatWrapping, SRGBColorSpace } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { createRaster, noise, rgb } from '../minigames/libreria-puerto/raster';
import { floorColor } from '../edificio/render';
import { ROOM } from '../edificio/room';

const FLOOR_PX = 32; // por celda de la habitación
const shade = (c, k) => c.map((v) => Math.max(0, Math.min(255, Math.round(v * k))));
const color = ([r, g, b]) => new Color().setRGB(r / 255, g / 255, b / 255, SRGBColorSpace);
const WOOD_DARK = [110, 70, 46];
/** Los colores de la lámpara de furniture.js y la luz de tarde de render.js. */
const LATON = [196, 156, 76];
const LIT = [255, 228, 164];
const WHITE = 0xffffffff;
const multiply = (p, [r, g, b]) => rgb((p & 255) * r, ((p >> 8) & 255) * g, ((p >> 16) & 255) * b);
const clampTone = (v) => Math.max(0, Math.min(4, Math.floor(v)));

// Solo se usa por sus rampas de tonos y su tramado: no dibuja nada
let probeRaster = null;
const probe = () => (probeRaster ??= createRaster({ W: 2, H: 2, S: 1, yaw: 0, ox: 0, oy: 0 }));

function texture(canvas, { repeat = false } = {}) {
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  t.magFilter = NearestFilter;
  t.minFilter = NearestFilter;
  if (repeat) {
    t.wrapS = RepeatWrapping;
    t.wrapT = RepeatWrapping;
  }
  return t;
}

function canvasOf(w, h, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  const pixels = new Uint32Array(w * h);
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) pixels[y * w + x] = paint(x, y);
  g.putImageData(new ImageData(new Uint8ClampedArray(pixels.buffer), w, h), 0, 0);
  return canvas;
}

/** El suelo del decorador, pintado una sola vez para toda la habitación: no hay baldosa que se repita. */
export function floorTexture(suelo) {
  const r = probe();
  const w = ROOM.w * FLOOR_PX;
  const h = ROOM.d * FLOOR_PX;
  return texture(canvasOf(w, h, (x, y) => floorColor(r, suelo, x / FLOOR_PX, y / FLOOR_PX, x, y)));
}

/** Veta discreta para el tablero de una mesa: dos tonos de su propia rampa, a lo largo de la pieza. */
export function grainTexture(tono, seed = 3) {
  const r = probe();
  const ramp = r.rampOf(tono);
  const t = texture(
    canvasOf(192, 96, (x, y) => {
      const long = noise(x * 0.012 + seed, y * 0.16);
      const fine = noise(x * 0.05 + seed * 3, y * 0.7);
      // El canto del tablero, un tono más oscuro: separa la mesa del suelo de madera que queda detrás
      if (y < 3 || x < 2 || x >= 190) return ramp[1];
      return ramp[(long - 0.5) * 1.5 + (fine - 0.5) * 0.7 + (r.bayerAt(x, y) - 0.5) * 0.2 > 0.22 ? 3 : 2];
    }),
  );
  return t;
}

/**
 * La luz de la lámpara sobre una pared, con la fórmula de la tarde de `evening` (render.js): el tono del catálogo, por una
 * luz que va del malva de la habitación a la calidez junto a la lámpara. Va por bandas, y el tramado Bayer solo cubre el
 * paso de una banda a otra. Mismos píxeles por celda que el suelo, y pegados a la pared: no bailan al girar.
 * `lights`: [{ s, z, depth }] en celdas, a lo largo de la pared, en altura y separada de ella.
 */
export function wallTexture(tono, { w, h, lights, hora }) {
  const r = probe();
  const ramp = r.rampOf(tono);
  const BANDS = 5;
  const BLEND = 0.2;
  const size = [w * FLOOR_PX, Math.round(h * FLOOR_PX)];
  const canvas = canvasOf(size[0], size[1], (x, y) => {
    const s = (x + 0.5) / FLOOR_PX;
    const z = h - (y + 0.5) / FLOOR_PX;
    let g = 0;
    for (const l of lights) {
      const reach = 2.25 + l.depth * 0.26;
      const d = Math.hypot(s - l.s, (z - l.z) * 1.12) / reach;
      if (d < 1) g += (1 - d) ** 1.7 * Math.max(0.15, 1 - l.depth * 0.1);
    }
    g = Math.min(1, g);
    const band = Math.max(0, Math.min(BANDS, Math.floor(g * BANDS + 0.5 + (r.bayerAt(x, y) - 0.5) * BLEND)));
    const k = band / BANDS;
    // Lo más alejado de la luz, junto al techo, un tono por debajo: da cuerpo a la pared sin añadir nada
    const top = band === 0 && z + (r.bayerAt(x, y) - 0.5) * 0.06 > h - 0.36;
    const tone = band >= BANDS - 1 ? ramp[4] : top ? ramp[2] : ramp[3];
    if (hora === 'dia') return tone;
    if (hora === 'noche') return multiply(tone, [0.38 + k * 0.82, 0.36 + k * 0.62, 0.54 + k * 0.1]);
    return multiply(tone, [0.6 + k * 0.55, 0.56 + k * 0.42, 0.74 + k * 0.06]);
  });
  return texture(canvas);
}

/** Tres paredes como láminas pegadas a las de verdad, con los huecos de sus ventanas: [{ pared, segments, length }]. */
export function wallPlates(walls) {
  const out = {};
  for (const { pared, segments, length, h } of walls) {
    const pos = [];
    const uv = [];
    for (const [s0, s1, z0, z1] of segments) {
      const at = (s, z) => (pared === 'fondo' ? [s, z, 0.002] : pared === 'izq' ? [0.002, z, s] : [ROOM.w - 0.002, z, s]);
      const q = [[s0, z0], [s1, z0], [s1, z1], [s0, z0], [s1, z1], [s0, z1]];
      for (const [s, z] of q) {
        pos.push(...at(s, z));
        uv.push(s / length, z / h);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
    out[pared] = g;
  }
  return out;
}

// La lámpara: lámina pequeña con cada cara a la misma densidad que el suelo. [x, y, ancho, alto] en píxeles
const LAMP_SIZE = 64;
const LAMP = { front: [0, 0, 20, 20], side: [20, 0, 20, 20], top: [40, 0, 14, 20], under: [0, 20, 20, 20], rodFront: [58, 0, 3, 64], rodSide: [61, 0, 3, 64], footTop: [20, 20, 14, 14], footSide: [34, 20, 14, 4] };

/** Los dibujos de la lámpara. `lit`: encendida (tarde y noche), con la rampa cálida con la que la enciende el decorador. */
export function lampTexture(tono, lit) {
  const r = probe();
  const cloth = r.rampOf(tono);
  const glow = r.rampOf(LIT);
  const brass = r.rampOf(LATON);
  const inside = ([x0, y0, w, h], x, y) => x >= x0 && x < x0 + w && y >= y0 && y < y0 + h;
  const bayer = (x, y) => (r.bayerAt(x, y) - 0.5) * 0.45;
  return texture(
    canvasOf(LAMP_SIZE, LAMP_SIZE, (x, y) => {
      if (inside(LAMP.front, x, y) || inside(LAMP.side, x, y)) {
        const front = inside(LAMP.front, x, y);
        const [x0] = front ? LAMP.front : LAMP.side;
        // El borde inferior, siempre en sombra: dos filas de la tela apagada
        if (y >= 18) return y === 19 ? cloth[0] : cloth[1];
        const u = Math.abs((x - x0 + 0.5) / 20 - 0.5) * 2;
        const v = (y + 0.5) / 18;
        // Más clara abajo, de donde sale la luz, y apagada hacia los cantos
        const band = (v > 0.34 ? 0.55 : 0) + (v > 0.66 ? 0.45 : 0) - (u > 0.86 ? 0.55 : 0);
        if (!lit) return cloth[clampTone((front ? 2.9 : 1.4) + band * 0.5 + bayer(x, y))];
        return glow[clampTone((front ? 2.9 : 1.7) + band)];
      }
      if (inside(LAMP.top, x, y)) return lit ? glow[4] : cloth[4];
      if (inside(LAMP.under, x, y)) {
        const u = Math.abs((x + 0.5) / 20 - 0.5) * 2;
        const v = Math.abs((y - 20 + 0.5) / 20 - 0.5) * 2;
        const rim = Math.max(u, v);
        if (rim > 0.8) return cloth[0];
        return lit ? glow[clampTone(4.6 - rim * 3 + bayer(x, y))] : cloth[1];
      }
      // La varilla: un filo claro, su cuerpo y motas oscuras cada pocos píxeles, como en el catálogo
      if (inside(LAMP.rodFront, x, y)) return x === 58 ? brass[3] : x === 60 && y % 11 === 4 ? brass[0] : brass[2];
      if (inside(LAMP.rodSide, x, y)) return y % 13 === 6 ? brass[0] : brass[1];
      if (inside(LAMP.footTop, x, y)) {
        const u = Math.abs((x - 20 + 0.5) / 14 - 0.5) * 2;
        const v = Math.abs((y - 20 + 0.5) / 14 - 0.5) * 2;
        return brass[clampTone(3.9 - Math.max(u, v) * 1.5 + bayer(x, y))];
      }
      if (inside(LAMP.footSide, x, y)) return brass[y === 23 ? 0 : 1];
      return cloth[1];
    }),
  );
}

/** Una caja con cada cara apuntando a su dibujo. El giro la recoloca: `front` es lo que mira a lo hondo de la habitación. */
function lampBox([x0, y0, z0, x1, y1, z1], faces, out) {
  const quads = [
    [[x0, z0, y1], [x1, z0, y1], [x1, z1, y1], [x0, z1, y1], faces.front],
    [[x1, z0, y0], [x0, z0, y0], [x0, z1, y0], [x1, z1, y0], faces.front],
    [[x1, z0, y1], [x1, z0, y0], [x1, z1, y0], [x1, z1, y1], faces.side],
    [[x0, z0, y0], [x0, z0, y1], [x0, z1, y1], [x0, z1, y0], faces.side],
    [[x0, z1, y1], [x1, z1, y1], [x1, z1, y0], [x0, z1, y0], faces.top],
    [[x0, z0, y0], [x1, z0, y0], [x1, z0, y1], [x0, z0, y1], faces.under],
  ];
  for (const [a, b, c, d, [rx, ry, rw, rh]] of quads) {
    // Sin llegar al filo de cada dibujo: así no se cuela el de al lado
    const u0 = (rx + 0.2) / LAMP_SIZE;
    const u1 = (rx + rw - 0.2) / LAMP_SIZE;
    const v0 = 1 - (ry + rh - 0.2) / LAMP_SIZE;
    const v1 = 1 - (ry + 0.2) / LAMP_SIZE;
    const uv = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
    for (const k of [0, 1, 2, 0, 2, 3]) {
      out.pos.push(...[a, b, c, d][k]);
      out.uv.push(...uv[k]);
    }
  }
}

/** La lámpara de pie, con las medidas de furniture.js: pie y varilla de latón (grupo 0) y pantalla (grupo 1). */
export function pixelLamp(place) {
  const body = { pos: [], uv: [] };
  const shadeBox = { pos: [], uv: [] };
  lampBox(place([0.3, 0.3, 0, 0.7, 0.7, 0.1]), { front: LAMP.footSide, side: LAMP.footSide, top: LAMP.footTop, under: LAMP.footSide }, body);
  lampBox(place([0.46, 0.46, 0.1, 0.54, 0.54, 2.2]), { front: LAMP.rodFront, side: LAMP.rodSide, top: LAMP.rodSide, under: LAMP.rodSide }, body);
  lampBox(place([0.2, 0.2, 2.2, 0.8, 0.8, 2.8]), { front: LAMP.front, side: LAMP.side, top: LAMP.top, under: LAMP.under }, shadeBox);
  const g = new BufferGeometry();
  const count = body.pos.length / 3;
  g.setAttribute('position', new Float32BufferAttribute([...body.pos, ...shadeBox.pos], 3));
  g.setAttribute('uv', new Float32BufferAttribute([...body.uv, ...shadeBox.uv], 2));
  g.addGroup(0, count, 0);
  g.addGroup(count, shadeBox.pos.length / 3, 1);
  return g;
}

// El tapizado: píxeles agrupados según la forma, a unos 96 por celda. [x, y, ancho, alto]
const FABRIC_SIZE = 128;
const FABRIC = { cushion: [0, 0, 84, 116], arm: [86, 0, 36, 118], side: [124, 0, 2, 118], thread: [126, 122, 2, 2] };
const smooth = (a, b, v) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Tapizado de una sola lámina, con la rampa del color del catálogo. El cojín se aclara en su parte más alta y se apaga
 * hacia las costuras; el brazo, en su lomo. Tramado solo donde una mancha de tono pasa a la siguiente.
 */
export function upholsteryTexture(tono) {
  const r = probe();
  const ramp = r.rampOf(tono);
  const light = r.rampOf(shade(tono, 1.12));
  const bayer = (x, y) => (r.bayerAt(x, y) - 0.5) * 0.28;
  const inside = ([x0, y0, w, h], x, y) => x >= x0 && x < x0 + w && y >= y0 && y < y0 + h;
  return texture(
    canvasOf(FABRIC_SIZE, FABRIC_SIZE, (x, y) => {
      if (inside(FABRIC.cushion, x, y)) {
        const u = (x + 0.5) / FABRIC.cushion[2];
        // v = 1 es el frente del cojín, junto a tus rodillas
        const v = (y + 0.5) / FABRIC.cushion[3];
        const edge = Math.min(Math.min(u, 1 - u) * 0.86, Math.min(v, 1 - v) * 1.2);
        const puff = smooth(0, 0.2, edge);
        const crown = Math.max(0, 1 - ((u - 0.5) / 0.42) ** 2 - ((v - 0.8) / 0.3) ** 2);
        return light[clampTone(0.9 + puff * 1.75 + crown ** 0.7 * 1.35 + bayer(x, y))];
      }
      if (inside(FABRIC.arm, x, y)) {
        const a = (x - FABRIC.arm[0] + 0.5) / FABRIC.arm[2];
        const v = (y + 0.5) / FABRIC.arm[3];
        const ridge = Math.sin(Math.PI * a) ** 0.8;
        return ramp[clampTone(0.8 + ridge * 2.9 - smooth(0.82, 1, v) * 0.9 + bayer(x, y))];
      }
      if (inside(FABRIC.side, x, y)) {
        const v = (y + 0.5) / FABRIC.side[3];
        return ramp[clampTone(2.4 - v * 2.2 + bayer(x, y))];
      }
      return inside(FABRIC.thread, x, y) ? WHITE : ramp[1];
    }),
  );
}

/** Sombra de contacto: oscura junto a la pieza y desvanecida hacia fuera. `margin`: fracción del lienzo que es desvanecido. */
export function contactShadowTexture(margin = 0.28) {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  const image = g.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = Math.abs((x + 0.5) / size - 0.5) * 2;
      const v = Math.abs((y + 0.5) / size - 0.5) * 2;
      const edge = Math.max(u, v);
      const a = edge < 1 - margin ? 1 : Math.max(0, 1 - (edge - (1 - margin)) / margin);
      image.data[(y * size + x) * 4 + 3] = Math.round(165 * a * a);
    }
  }
  g.putImageData(image, 0, 0);
  const t = new CanvasTexture(canvas);
  return t;
}

/**
 * Una caja del sillón, en coordenadas de la app (x, y a lo hondo, z arriba), lista para unir. `skin` dice qué dibujo lleva
 * arriba ('cushion', 'arm'); `local` deshace el giro, para que el dibujo siga a la pieza y no a la habitación.
 */
function part([x0, y0, z0, x1, y1, z1], c, radius, skin = null, local = null) {
  const w = x1 - x0;
  const h = z1 - z0;
  const d = y1 - y0;
  const base = radius ? new RoundedBoxGeometry(w, h, d, 3, radius) : new BoxGeometry(w, h, d);
  const g = base.index ? base.toNonIndexed() : base;
  g.translate((x0 + x1) / 2, (z0 + z1) / 2, (y0 + y1) / 2);
  const tint = color(c);
  const count = g.attributes.position.count;
  const colors = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  const { position: p, normal: n } = g.attributes;
  const toUv = ([rx, ry, rw, rh], a, b) => [(rx + Math.max(0.02, Math.min(0.98, a)) * rw) / FABRIC_SIZE, 1 - (ry + Math.max(0.02, Math.min(0.98, b)) * rh) / FABRIC_SIZE];
  for (let t = 0; t < count; t += 3) {
    const up = (n.getY(t) + n.getY(t + 1) + n.getY(t + 2)) / 3;
    for (let i = t; i < t + 3; i += 1) {
      colors.set([tint.r, tint.g, tint.b], i * 3);
      if (!skin) {
        uvs.set(toUv(FABRIC.thread, 0.5, 0.5), i * 2);
        continue;
      }
      const [lx, ly, lx0, ly0, lx1, ly1] = local(p.getX(i), p.getZ(i));
      const a = (lx - lx0) / (lx1 - lx0);
      const b = (ly - ly0) / (ly1 - ly0);
      if (up > 0.55 && skin !== 'side') uvs.set(toUv(FABRIC[skin], a, b), i * 2);
      else uvs.set(toUv(FABRIC.side, 0.5, 1 - (p.getY(i) - z0) / h), i * 2);
    }
  }
  g.setAttribute('color', new BufferAttribute(colors, 3));
  g.setAttribute('uv', new BufferAttribute(uvs, 2));
  return g;
}

/** Una línea de puntadas: tramos cortos, a lo largo de `x` o de `y`. */
function stitches(out, from, to, z, c) {
  const [ax, ay] = from;
  const [bx, by] = to;
  const length = Math.hypot(bx - ax, by - ay);
  const ux = (bx - ax) / length;
  const uy = (by - ay) / length;
  const LONG = 0.045;
  const GAP = 0.035;
  const WIDE = 0.009;
  for (let s = 0; s + LONG <= length; s += LONG + GAP) {
    const x0 = ax + ux * s;
    const y0 = ay + uy * s;
    const x1 = x0 + ux * LONG;
    const y1 = y0 + uy * LONG;
    out.push([Math.min(x0, x1) - (ux ? 0 : WIDE / 2), Math.min(y0, y1) - (uy ? 0 : WIDE / 2), z, Math.max(x0, x1) + (ux ? 0 : WIDE / 2), Math.max(y0, y1) + (uy ? 0 : WIDE / 2), z + 0.006, c]);
  }
}

/**
 * El sillón verde de la app, con las mismas cajas y medidas que `armchair` de furniture.js (base, respaldo, dos brazos y
 * asiento), con cantos redondeados y costura. `place(box)` lo coloca como `toWorld` de render.js y `unplace(x, y)` lo deshace.
 */
export function upholsteredArmchair(tono, place, unplace) {
  const thread = shade(tono, 1.24);
  const fold = shade(tono, 0.62);
  const white = [255, 255, 255];
  const x1 = 1.85;
  const parts = [];
  const skinned = ([a, b, c, d, e, f], radius, skin, tint = white) => {
    const local = (x, y) => {
      const [lx, ly] = unplace(x, y);
      return [lx, ly, a, b, d, e];
    };
    parts.push(part(place([a, b, c, d, e, f]), tint, radius, skin, local));
  };
  for (const [lx, ly] of [[0.2, 0.2], [1.68, 0.2], [0.2, 1.68], [1.68, 1.68]]) parts.push(part(place([lx, ly, 0, lx + 0.12, ly + 0.12, 0.22]), WOOD_DARK, 0));
  skinned([0.15, 0.25, 0.22, x1, 1.85, 0.7], 0.05, 'side');
  skinned([0.15, 0.2, 0.7, x1, 0.62, 1.75], 0.11, 'side', shade(white, 0.92));
  // Los brazos: el canto de arriba bien redondo, como en el dibujo isométrico
  skinned([0.15, 0.62, 0.66, 0.55, 1.85, 1.12], 0.13, 'arm');
  skinned([x1 - 0.4, 0.62, 0.66, x1, 1.85, 1.12], 0.13, 'arm');
  // El cojín del asiento, algo hinchado, y el pliegue oscuro que lo separa de los brazos
  parts.push(part(place([0.53, 0.6, 0.69, 0.57, 1.83, 0.86]), fold, 0));
  parts.push(part(place([x1 - 0.42, 0.6, 0.69, x1 - 0.38, 1.83, 0.86]), fold, 0));
  skinned([0.57, 0.62, 0.7, x1 - 0.42, 1.82, 0.94], 0.09, 'cushion');
  // Costura: dos líneas por brazo, el contorno del cojín y el remate del respaldo
  const seams = [];
  for (const left of [0.15, x1 - 0.4]) {
    stitches(seams, [left + 0.125, 0.7], [left + 0.125, 1.78], 1.118, thread);
    stitches(seams, [left + 0.275, 0.7], [left + 0.275, 1.78], 1.118, thread);
  }
  stitches(seams, [0.66, 1.72], [x1 - 0.51, 1.72], 0.938, thread);
  stitches(seams, [0.66, 0.72], [0.66, 1.72], 0.938, thread);
  stitches(seams, [x1 - 0.51, 0.72], [x1 - 0.51, 1.72], 0.938, thread);
  stitches(seams, [0.3, 0.63], [x1 - 0.15, 0.63], 1.65, thread);
  for (const [a, b, c, d, e, f, tint] of seams) parts.push(part(place([a, b, c, d, e, f]), tint, 0));
  const merged = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));
  for (const g of parts) g.dispose();
  return merged;
}
