// Escena de «La librería del puerto» (prototipo, solo desarrollo): una librería pequeña junto al mar en píxeles.
// Lo estático (pared con ventana al mar, suelo con alfombra, estantería, caja, planta, lámpara, radio y la gata dormida)
// se hornea una vez por nivel; en cada fotograma solo se dibujan los libros, el que se lleva en la mano y la
// previsualización del encaje. Al terminar, la lámpara se enciende y la luz se vuelve de tarde (la librería abre). Geometría provisional hecha con cajas
// (no hay recursos de imagen): ver docs/qa/libreria-puerto.md, «Recursos que mejorarían el resultado».
import { footprint } from './puzzle';
import { createRaster, hash, lerp, noise, rgb } from './raster';
import { SPINE } from './levels';

export const ART_W = 200;
export const ART_H = 236;
const S = 12;
const YAW = (20 * Math.PI) / 180;

const PAPER = rgb(243, 234, 214);
const WOOD = [150, 98, 60];
const WOOD_DARK = [118, 76, 48];
const CRATE = [186, 140, 92];
const FLOOR = [198, 156, 112];
const LATON = [196, 156, 76];
const CREAM = [236, 226, 200];
const POT = [176, 96, 66];
const LEAF = [104, 128, 86];
const LEAF_LIGHT = [140, 160, 104];
const VALID = rgb(70, 92, 56);
const VALID_FILL = [120, 150, 96];
const INVALID = rgb(160, 64, 40);
const PLASTER = [226, 204, 178];
const WAINSCOT = [132, 112, 84];
const RUG = [168, 84, 62];
const RUG_CREAM = [226, 208, 172];
const RUG_SAGE = [118, 136, 100];
const SKY_HIGH = [236, 214, 186];
const SKY_LOW = [244, 196, 150];
const SEA = [78, 120, 146];
const SEA_LIGHT = [150, 182, 192];
const SUN = rgb(255, 236, 196);
const CAT = [206, 142, 86];
const CAT_LIGHT = [234, 196, 150];
const SHADE_LIT = [255, 228, 164];

/** Medidas del mundo (unidades: una celda de la cuadrícula). */
export const GEO = { side: 0.4, board: 0.4, base: 4.2, shelfDepth: 2.4, bookY0: 0.35, bookY1: 2.2, gap: 0.08, crateY0: 5.0, crateY1: 7.0, crateWall: 1.3, crateGap: 0.22, wallY: -0.5 };

/** Dónde está cada cosa en el mundo para un nivel. */
export function layoutFor(level) {
  const maxW = Math.max(...level.baldas.map((b) => b.ancho));
  const shelves = [];
  let z = GEO.base;
  // La primera balda del nivel va arriba: se apilan de abajo arriba en orden inverso
  for (const b of [...level.baldas].reverse()) {
    shelves.unshift({ ...b, x0: GEO.side, z0: z });
    z += b.alto + GEO.board;
  }
  const caseX1 = maxW + GEO.side * 2;
  const crateWidth = level.libros.reduce((n, b) => n + b.grosor + GEO.crateGap, GEO.crateGap) + 0.4;
  const centre = caseX1 / 2;
  const crate = { x0: centre - crateWidth / 2, x1: centre + crateWidth / 2, y0: GEO.crateY0, y1: GEO.crateY1 };
  const slots = {};
  let x = crate.x0 + 0.2 + GEO.crateGap;
  for (const b of level.libros) {
    slots[b.id] = x;
    x += b.grosor + GEO.crateGap;
  }
  return { maxW, caseX1, top: z, shelves, crate, slots };
}

/** Caja del mundo de un libro colocado en una balda. */
export function bookBox(layout, libro, p) {
  const shelf = layout.shelves.find((s) => s.id === p.balda);
  const { w, h } = footprint(libro, p.orient);
  const x0 = shelf.x0 + p.x + GEO.gap / 2;
  const z0 = shelf.z0 + p.y;
  return { x0, x1: x0 + w - GEO.gap, y0: GEO.bookY0, y1: GEO.bookY1, z0, z1: z0 + h - 0.02, orient: p.orient };
}

/** Caja del mundo de un libro en la caja de recién llegados (de pie). */
export function crateBox(layout, libro) {
  const x0 = layout.slots[libro.id];
  return { x0, x1: x0 + libro.grosor - GEO.gap, y0: GEO.crateY0 + 0.25, y1: GEO.crateY1 - 0.25, z0: 0.15, z1: 0.15 + libro.alto, orient: 'pie' };
}

export function createScene(level) {
  const layout = layoutFor(level);
  // Encuadre: el origen se elige para centrar todo lo que se ve (suelo, estantería, caja)
  const probe = createRaster({ W: ART_W, H: ART_H, S, yaw: YAW, ox: 0, oy: 0 });
  const floorRect = { x0: Math.min(-1.6, layout.crate.x0 - 0.8), x1: Math.max(layout.caseX1 + 1.4, layout.crate.x1 + 0.8), y0: -0.8, y1: GEO.crateY1 + 0.9 };
  const pts = [];
  for (const x of [floorRect.x0, floorRect.x1]) for (const y of [floorRect.y0, floorRect.y1]) pts.push(probe.project(x, y, 0));
  for (const x of [0, layout.caseX1]) pts.push(probe.project(x, 0, layout.top + 1.8));
  const minX = Math.min(...pts.map((p) => p.sx));
  const maxX = Math.max(...pts.map((p) => p.sx));
  const minY = Math.min(...pts.map((p) => p.sy));
  const maxY = Math.max(...pts.map((p) => p.sy));
  const r = createRaster({ W: ART_W, H: ART_H, S, yaw: YAW, ox: Math.round((ART_W - (maxX - minX)) / 2 - minX), oy: Math.round((ART_H - (maxY - minY)) / 2 - minY) });

  const baked = new Uint32Array(ART_W * ART_H);
  const bakedZ = new Float32Array(ART_W * ART_H);
  // Luz de la lámpara encendida: cuánto le llega a cada píxel (0..1) y qué píxeles son la pantalla de la lámpara
  const lampGlow = new Float32Array(ART_W * ART_H);
  let shadePixels = [];

  function bake() {
    r.clear(PAPER);
    const floorRamp = r.rampOf(FLOOR);
    // Suelo de tablas cálidas, con un borde algo más oscuro (sin marco de interfaz alrededor)
    const c = layout.crate;
    const rugC = { x: (c.x0 + c.x1) / 2, y: (c.y0 + c.y1) / 2, rx: (c.x1 - c.x0) / 2 + 1.3, ry: 1.9 };
    const rugRamps = [r.rampOf(RUG), r.rampOf(RUG_CREAM), r.rampOf(RUG_SAGE)];
    r.floor((x, y, ix, iy) => {
      if (y < GEO.wallY) return 0;
      const dither = (r.bayerAt(ix, iy) - 0.5) * 0.4;
      // Alfombra de lana bajo la caja: ribete terracota, franja crema y rombos salvia
      const ex = (x - rugC.x) / rugC.rx;
      const ey = (y - rugC.y) / rugC.ry;
      const e = Math.max(Math.abs(ex), Math.abs(ey));
      if (e < 1) {
        const band = 1 - e;
        let ramp = rugRamps[0];
        if (band > 0.1 && band < 0.18) ramp = rugRamps[1];
        else if (band >= 0.18 && (Math.abs((x - rugC.x) * 1.4) + Math.abs((y - rugC.y) * 1.4)) % 1.4 < 0.28) ramp = rugRamps[2];
        else if (band >= 0.18 && hash(Math.floor(x * 3), Math.floor(y * 3)) > 0.93) ramp = rugRamps[1];
        return ramp[Math.max(0, Math.min(4, Math.floor(2.9 + (noise(x * 4, y * 4) - 0.5) * 0.8 + dither)))];
      }
      const plank = Math.floor(y * 1.6);
      const seam = (y * 1.6) % 1 < 0.07;
      const grain = noise(x * 0.7 + plank * 13, y * 6) - 0.5;
      let level = 3 + grain * 1.2 + (hash(plank, 3) - 0.5) * 0.6 + dither;
      if (seam) level -= 1.2;
      return floorRamp[Math.max(0, Math.min(4, Math.floor(level)))];
    });

    // Pared del fondo: zócalo de madera, yeso cálido y una ventana al mar (de tarde, con el sol bajo)
    const wallTop = layout.top + 8;
    const win = { x0: -4.4, x1: -1.5, z0: 3.2, z1: 6.6 };
    const sky = [r.rampOf(SKY_HIGH), r.rampOf(SKY_LOW)];
    const sea = r.rampOf(SEA);
    const seaLight = r.rampOf(SEA_LIGHT);
    const wood = r.rampOf(WOOD);
    const plaster = r.rampOf(PLASTER);
    r.box(-12, GEO.wallY - 0.3, 0, layout.caseX1 + 12, GEO.wallY, wallTop, PLASTER, {
      seed: 21,
      grain: 0,
      step: 0.04,
      face: (f, a, b) => {
        if (f !== 'front') return null;
        const p = r.project(a, GEO.wallY, b);
        const d = r.bayerAt(p.sx | 0, p.sy | 0);
        if (b < 1.5) return r.rampOf(WAINSCOT)[Math.abs(((a + 12) % 1.2) - 0.6) < 0.05 ? 1 : b > 1.38 ? 3 : 2];
        if (b < 1.62) return wood[3];
        const inX = a > win.x0 && a < win.x1;
        const inZ = b > win.z0 && b < win.z1;
        if (inX && inZ) {
          const fx = Math.min(a - win.x0, win.x1 - a);
          const fz = Math.min(b - win.z0, win.z1 - b);
          if (fx < 0.16 || fz < 0.16) return wood[fx < 0.06 || fz < 0.06 ? 1 : 2];
          if (Math.abs(a - (win.x0 + win.x1) / 2) < 0.06 || Math.abs(b - (win.z0 + (win.z1 - win.z0) * 0.58)) < 0.06) return wood[2];
          const t = (b - win.z0) / (win.z1 - win.z0);
          const horizon = 0.36;
          if (t < horizon) {
            // Mar con brillos del sol en franjas
            const sparkle = Math.abs(a - (win.x0 + win.x1) / 2 - 0.4) < 0.5 * (horizon - t + 0.1) * 2 && Math.floor(b * 9) % 2 === 0;
            if (sparkle) return seaLight[4];
            return (t > horizon - 0.06 ? seaLight : sea)[Math.min(4, Math.floor(2 + t * 4 + d * 0.8))];
          }
          if (Math.hypot(a - (win.x0 + win.x1) / 2 - 0.4, (b - (win.z0 + (win.z1 - win.z0) * (horizon + 0.12))) * 1.1) < 0.42) return SUN;
          const k = (t - horizon) / (1 - horizon);
          return k + (d - 0.5) * 0.25 < 0.45 ? sky[1][3] : sky[0][Math.min(4, 3 + (k > 0.85 ? 1 : 0))];
        }
        // Yeso liso con algún punto de cal (tramado, muy suave)
        const n = noise(a * 2.6 + 7, b * 2.6);
        return plaster[n > 0.78 && d > 0.7 ? 4 : n < 0.22 && d > 0.8 ? 2 : 3];
      },
    });
    // Alféizar de la ventana
    r.box(win.x0 - 0.15, GEO.wallY, win.z0 - 0.18, win.x1 + 0.15, GEO.wallY + 0.35, win.z0, WOOD, { seed: 22 });
    // Un cuadro pequeño con un barco, a la derecha de la estantería
    const fr = { x0: layout.caseX1 + 0.9, x1: layout.caseX1 + 2.5, z0: 4.4, z1: 5.7 };
    r.box(fr.x0, GEO.wallY, fr.z0, fr.x1, GEO.wallY + 0.12, fr.z1, WOOD_DARK, {
      seed: 23,
      face: (f, a, b) => {
        if (f !== 'front') return null;
        if (a < fr.x0 + 0.14 || a > fr.x1 - 0.14 || b < fr.z0 + 0.14 || b > fr.z1 - 0.14) return null;
        const mx = (fr.x0 + fr.x1) / 2;
        if (b < fr.z0 + 0.45) return Math.abs(a - mx) < 0.4 && b > fr.z0 + 0.3 ? r.rampOf(RUG)[2] : sea[3];
        if (Math.abs(a - mx) < 0.04 && b < fr.z1 - 0.25) return wood[1];
        if (a > mx - 0.36 && a < mx - 0.04 && b < fr.z1 - 0.3 && (a - (mx - 0.36)) / 0.32 > (b - fr.z0 - 0.5) / 0.5) return r.rampOf(RUG_CREAM)[4];
        return sky[0][3];
      },
    });

    // Planta en su maceta de terracota, junto a la estantería
    const px = -0.9;
    const py = 1.2;
    r.box(px - 0.45, py - 0.45, 0, px + 0.45, py + 0.45, 0.9, POT, { seed: 3 });
    for (let k = 0; k < 26; k += 1) {
      const a = hash(k, 1) * Math.PI * 2;
      const d = Math.sqrt(hash(k, 2)) * 0.75;
      const z = 1 + hash(k, 3) * 1.6;
      const lx = px + Math.cos(a) * d * 0.9;
      const ly = py + Math.sin(a) * d * 0.7;
      r.box(lx - 0.16, ly - 0.16, z - 0.12, lx + 0.16, ly + 0.16, z + 0.12, hash(k, 4) > 0.55 ? LEAF_LIGHT : LEAF, { seed: k, step: 0.06 });
      if (k % 3 === 0) r.castShadow(lx, ly, z, 0.3);
    }
    r.castShadow(px, py, 0.6, 0.5);

    // Estantería: base cerrada con dos puertas, baldas, costados, fondo y remate
    const X1 = layout.caseX1;
    const D = GEO.shelfDepth;
    r.box(0, 0, 0, X1, D, GEO.base - GEO.board, WOOD_DARK, {
      seed: 1,
      face: (f, a, b) => {
        if (f !== 'front') return null;
        const door = Math.abs(a - X1 / 2) < 0.05 || Math.abs(b - (GEO.base - GEO.board) + 0.25) < 0.05 || b < 0.25;
        if (door) return r.rampOf(WOOD_DARK)[1];
        if (Math.abs(a - X1 / 2) < 0.45 && Math.abs(a - X1 / 2) > 0.3 && Math.abs(b - 2) < 0.1) return r.rampOf(LATON)[3];
        return null;
      },
    });
    r.box(0, 0, GEO.base - GEO.board, X1, D, GEO.base, WOOD, { seed: 2 });
    r.box(0, 0, GEO.base, X1, 0.25, layout.top, WOOD_DARK, { seed: 4 });
    r.box(0, 0, GEO.base, GEO.side, D, layout.top, WOOD, { seed: 5 });
    r.box(X1 - GEO.side, 0, GEO.base, X1, D, layout.top, WOOD, { seed: 6 });
    for (const s of layout.shelves) {
      r.box(0, 0, s.z0 + s.alto, X1, D, s.z0 + s.alto + GEO.board, WOOD, { seed: s.z0 });
      // Una balda más estrecha que la estantería: un tabique cierra el hueco que no se usa
      if (s.ancho < layout.maxW) r.box(s.x0 + s.ancho, 0.25, s.z0, X1 - GEO.side, D, s.z0 + s.alto, WOOD_DARK, { seed: 9 });
    }
    for (let z = 0.4; z < layout.top; z += 0.8) r.castShadow(X1 * 0.5, D * 0.5, z, X1 * 0.42, 1, 0.5);

    // Lámpara de latón y una radio pequeña sobre el remate
    const T = layout.top;
    r.box(0.7, 0.8, T, 1.2, 1.3, T + 0.18, LATON, { seed: 7 });
    r.box(0.9, 1.0, T + 0.18, 1.0, 1.1, T + 1.0, LATON, { seed: 7, grain: 0 });
    r.box(0.55, 0.65, T + 1.0, 1.35, 1.45, T + 1.55, CREAM, { seed: 8 });
    const cat = r.rampOf(CAT);
    const catLight = r.rampOf(CAT_LIGHT);
    r.box(1.75, 0.75, T, 3.15, 1.75, T + 0.62, CAT, {
      seed: 30,
      face: (f, a, b) => (f === 'front' && Math.floor(a * 3.2) % 2 && b > T + 0.2 ? cat[2] : f === 'top' && Math.floor(a * 3.2) % 2 ? cat[3] : null),
    });
    r.box(3.0, 1.0, T, 3.62, 1.62, T + 0.56, CAT, {
      seed: 31,
      face: (f, a, b) => {
        if (f !== 'front') return null;
        // Ojos cerrados (dos rayitas) y el hocico claro
        if (Math.abs(b - (T + 0.33)) < 0.035 && ((a > 3.1 && a < 3.24) || (a > 3.38 && a < 3.52))) return cat[0];
        if (b < T + 0.22 && a > 3.18 && a < 3.44) return catLight[3];
        return null;
      },
    });
    r.box(3.04, 1.15, T + 0.56, 3.2, 1.35, T + 0.76, CAT, { seed: 32, grain: 0 });
    r.box(3.42, 1.15, T + 0.56, 3.58, 1.35, T + 0.76, CAT, { seed: 33, grain: 0 });
    r.box(1.55, 1.6, T, 2.7, 1.86, T + 0.22, CAT, { seed: 34, face: (f, a) => (a < 1.8 ? catLight[3] : null) });
    const rx = X1 - 2.1;
    r.box(rx, 0.7, T, rx + 1.5, 1.6, T + 0.9, [150, 104, 70], {
      seed: 10,
      face: (f, a, b) => {
        if (f !== 'front') return null;
        if (a > rx + 0.15 && a < rx + 0.85 && b > T + 0.2 && b < T + 0.7) return Math.round(b * 10) % 2 ? r.rampOf(CREAM)[2] : r.rampOf(CREAM)[1];
        if (Math.hypot(a - (rx + 1.15), b - (T + 0.45)) < 0.16) return r.rampOf(LATON)[3];
        return null;
      },
    });

    // Caja de libros recién llegados: suelo y cuatro paredes de listones
    r.box(c.x0, c.y0, 0, c.x1, c.y1, 0.15, CRATE, { seed: 11 });
    const slat = (b) => (Math.floor(b / 0.43) % 3 === 2 ? r.rampOf(CRATE)[1] : null);
    r.box(c.x0, c.y0, 0, c.x1, c.y0 + 0.16, GEO.crateWall, CRATE, { seed: 12 });
    r.box(c.x0, c.y0, 0, c.x0 + 0.16, c.y1, GEO.crateWall, CRATE, { seed: 13 });
    r.box(c.x1 - 0.16, c.y0, 0, c.x1, c.y1, GEO.crateWall, CRATE, { seed: 14, face: (f, a, b) => (f === 'side' ? slat(b) : null) });
    for (let z = 0.3; z < GEO.crateWall; z += 0.45) r.castShadow((c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2, z, (c.x1 - c.x0) * 0.45, 1, 0.5);
    r.applyShadows();
    r.bakeOcclusion();
    baked.set(r.pix);
    bakedZ.set(r.zb);
    // Píxeles visibles de la pantalla de la lámpara (para encenderla sin volver a hornear)
    const shade = new Set();
    for (let a = 0.55; a <= 1.35; a += 0.03) {
      for (let b = T + 1.0; b <= T + 1.55; b += 0.03) {
        for (const p of [r.project(a, 1.45, b), r.project(1.35, 0.65 + (a - 0.55), b), r.project(a, 0.65 + (b - T - 1.0) * 1.45, T + 1.55)]) {
          const i = (p.sy | 0) * ART_W + (p.sx | 0);
          if (p.sx >= 0 && p.sy >= 0 && p.sx < ART_W && p.sy < ART_H && Math.abs(r.zb[i] - p.d) < 0.05) shade.add(i);
        }
      }
    }
    shadePixels = [...shade];
    const lamp = r.project(0.95, 1.05, T + 1.25);
    for (let iy = 0; iy < ART_H; iy += 1) {
      for (let ix = 0; ix < ART_W; ix += 1) {
        const dd = Math.hypot(ix - lamp.sx, (iy - lamp.sy) * 0.8) / 120;
        lampGlow[iy * ART_W + ix] = Math.max(0, 1 - dd) ** 1.6;
      }
    }
  }

  /** La pared delantera de la caja se dibuja encima de los libros que hay dentro (los tapa abajo, como una caja real). */
  function crateFront() {
    const c = layout.crate;
    r.box(c.x0, c.y1 - 0.16, 0, c.x1, c.y1, GEO.crateWall, CRATE, { seed: 15, face: (f, a, b) => (f === 'front' && Math.floor(b / 0.43) % 3 === 2 ? r.rampOf(CRATE)[1] : null) });
  }

  /** Un libro: lomo al frente (con dos bandas de latón), cantos de las páginas en crema y tapa en su color. */
  function drawBook(libro, b, { lifted = false, faded = false } = {}) {
    const color = SPINE[libro.color] ?? SPINE.crema;
    const ramp = r.rampOf(color);
    const laton = r.rampOf(LATON);
    const pages = r.rampOf(CREAM);
    const lying = b.orient === 'tumbado';
    const len = lying ? b.x1 - b.x0 : b.z1 - b.z0;
    r.box(b.x0, b.y0, b.z0, b.x1, b.y1, b.z1, color, {
      seed: libro.id.length * 3,
      face: (f, a, c) => {
        if (faded && (Math.floor(a * 9) + Math.floor(c * 9)) % 2) return pages[4];
        if (f === 'front') {
          // A lo largo del lomo: bandas a un 12 % y un 88 % y un rótulo claro en el centro
          const t = lying ? (a - b.x0) / len : (c - b.z0) / len;
          const across = lying ? (c - b.z0) / (b.z1 - b.z0) : (a - b.x0) / (b.x1 - b.x0);
          if ((t > 0.1 && t < 0.15) || (t > 0.85 && t < 0.9)) return laton[3];
          if (t > 0.42 && t < 0.58 && across > 0.25 && across < 0.75) return pages[3];
          return null;
        }
        if (f === 'top') {
          if (lying) return null;
          // Canto superior de un libro de pie: las páginas, con la tapa en los bordes
          return Math.abs(a - b.x0) < 0.09 || Math.abs(a - b.x1) < 0.09 ? ramp[2] : pages[(Math.floor(c * 10) % 2) + 2];
        }
        // Lateral: la tapa de pie; tumbado, el canto de las páginas
        return lying ? pages[(Math.floor(c * 10) % 2) + 1] : null;
      },
    });
    if (lifted) r.castShadow((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, b.z0 - 0.05, 0.5);
  }

  /** Previsualización del encaje: contorno continuo y relleno salvia si vale; discontinuo con aspa si no. */
  function drawPreview(box, ok) {
    const a = r.project(box.x0, box.y1 + 0.02, box.z0);
    const bb = r.project(box.x1, box.y1 + 0.02, box.z0);
    const c = r.project(box.x1, box.y1 + 0.02, box.z1);
    const d = r.project(box.x0, box.y1 + 0.02, box.z1);
    const color = ok ? VALID : INVALID;
    const dash = ok ? 0 : 2;
    if (ok) {
      const fill = r.rampOf(VALID_FILL);
      for (let u = 0; u <= 1; u += 0.04) {
        for (let v = 0; v <= 1; v += 0.04) {
          const x = lerp(box.x0, box.x1, u);
          const z = lerp(box.z0, box.z1, v);
          const p = r.project(x, box.y1 + 0.02, z);
          const ix = p.sx | 0;
          const iy = p.sy | 0;
          if (ix < 0 || iy < 0 || ix >= ART_W || iy >= ART_H || (ix + iy) % 2) continue;
          r.pix[iy * ART_W + ix] = fill[3];
        }
      }
    }
    for (const [p, q] of [
      [a, bb],
      [bb, c],
      [c, d],
      [d, a],
    ])
      r.line(p.sx, p.sy, q.sx, q.sy, color, dash);
    if (!ok) {
      r.line(a.sx, a.sy, c.sx, c.sy, color, 2);
      r.line(bb.sx, bb.sy, d.sx, d.sy, color, 2);
    }
  }

  /**
   * La librería abre: la pantalla de la lámpara se enciende y la luz se vuelve de tarde, más cálida cerca de la
   * lámpara y algo más tenue lejos (`k` de 0 a 1).
   */
  function applyLamp(k) {
    const lit = r.rampOf(SHADE_LIT);
    for (const i of shadePixels) {
      const p = r.pix[i];
      const lum = ((p & 255) + ((p >> 8) & 255) + ((p >> 16) & 255)) / 765;
      const target = lit[lum > 0.8 ? 4 : lum > 0.62 ? 3 : 2];
      r.pix[i] = rgb(lerp(p & 255, target & 255, k), lerp((p >> 8) & 255, (target >> 8) & 255, k), lerp((p >> 16) & 255, (target >> 16) & 255, k));
    }
    const pix = r.pix;
    for (let i = 0; i < pix.length; i += 1) {
      const g = lampGlow[i];
      const p = pix[i];
      const rr = (p & 255) * (1 + k * (g * 0.28 - 0.1));
      const gg = ((p >> 8) & 255) * (1 + k * (g * 0.16 - 0.14));
      const bb = ((p >> 16) & 255) * (1 + k * (-g * 0.04 - 0.2));
      pix[i] = rgb(rr, gg, bb);
    }
  }

  /** Marca suave sobre una balda completa (un brillo breve en su canto, sin partículas). */
  function drawShelfGlow(shelf, k) {
    const ramp = r.rampOf(LATON);
    const z = shelf.z0 + shelf.alto + GEO.board;
    const p0 = r.project(0, GEO.shelfDepth, z);
    const p1 = r.project(layout.caseX1, GEO.shelfDepth, z);
    const steps = Math.max(1, Math.round(p1.sx - p0.sx));
    for (let s = 0; s <= steps * k; s += 1) {
      const x = Math.round(lerp(p0.sx, p1.sx, s / steps));
      const y = Math.round(lerp(p0.sy, p1.sy, s / steps));
      if (x >= 0 && y >= 0 && x < ART_W && y < ART_H) r.pix[y * ART_W + x] = ramp[4];
    }
  }

  /**
   * Dibuja un fotograma. `books`: [{ libro, box, lifted, faded }]; `preview`: { box, ok } o null; `glow`: [{ shelf, k }].
   * Devuelve los rectángulos de pantalla de cada libro (para tocar) en píxeles del lienzo.
   */
  function draw(ctx, image, { books, inCrate, preview, glow = [], held = null, light = 0 }) {
    r.pix.set(baked);
    r.zb.set(bakedZ);
    const hits = [];
    const rect = (b) => {
      const ps = [];
      for (const x of [b.x0, b.x1]) for (const y of [b.y0, b.y1]) for (const z of [b.z0, b.z1]) ps.push(r.project(x, y, z));
      return { x0: Math.min(...ps.map((p) => p.sx)), x1: Math.max(...ps.map((p) => p.sx)), y0: Math.min(...ps.map((p) => p.sy)), y1: Math.max(...ps.map((p) => p.sy)) };
    };
    for (const item of books) {
      drawBook(item.libro, item.box, item);
      hits.push({ id: item.libro.id, ...rect(item.box) });
    }
    for (const item of inCrate) {
      drawBook(item.libro, item.box, item);
      hits.push({ id: item.libro.id, ...rect(item.box) });
    }
    if (inCrate.length) crateFront();
    for (const g of glow) drawShelfGlow(g.shelf, g.k);
    r.applyShadows();
    r.shadeEdges();
    if (preview) drawPreview(preview.box, preview.ok);
    // Lo que se lleva en la mano va por encima de todo (sigue al dedo; no se esconde tras la estantería)
    if (held) {
      r.zb.fill(-1e9);
      drawBook(held.libro, held.box, { lifted: true });
      r.applyShadows();
      r.shadeEdges();
    }
    if (light > 0) applyLamp(light);
    image.data.set(new Uint8ClampedArray(r.pix.buffer));
    ctx.putImageData(image, 0, 0);
    return hits;
  }

  return { layout, raster: r, bake, draw, project: r.project, unprojectOnPlaneY: r.unprojectOnPlaneY };
}
