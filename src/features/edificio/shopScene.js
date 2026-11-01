// Dentro de la tienda del bajo (1.67, SPEC §67): el local, en el mismo pixel art que el edificio y en perspectiva
// central. Encargo de Francisco (1-11-2026): la pared de sobres colgados de una tienda de cartas, con más perspectiva,
// mezclada con el videoclub de barrio de los 2000 que era este bajo (guiño a «Aquí no hay quien viva»: el tema, nunca su
// decorado, su logotipo ni sus personajes). Cartel «VIDEOCLUB» tachado con un papel que dice «MUEBLES», estanterías de
// cintas a la izquierda, fluorescentes, suelo de baldosas, un póster propio y el mostrador con su dependiente (un
// personaje propio, sin parecido con nadie). Los sobres no se pintan aquí: son botones encima de sus huecos (`slots`).

export const SHOP_W = 180;
export const SHOP_H = 120;
const BX0 = 36;
const BX1 = 144;
const BY0 = 14;
const BY1 = 78;
const CLERK = { x: 150, y: 54, w: 20, h: 34 };
const FACE = { x: 2, y: 8, w: 16, h: 11 };
/** Huecos de la pared para los sobres (en píxeles del dibujo): cuatro, de 20 × 30. */
const SLOTS = [44, 68, 92, 116].map((x) => ({ x, y: 36, w: 20, h: 30 }));

const OUT = [59, 38, 24];
const mix = ([r, g, b], k) => (k >= 0 ? [r + (255 - r) * k, g + (255 - g) * k, b + (255 - b) * k] : [r * (1 + k), g * (1 + k), b * (1 + k)]).map(Math.round);
const hash = (a, b) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

// Letra de 3 × 5 (la M, de 5)
const FONT = {
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  O: ['###', '#.#', '#.#', '#.#', '###'],
  C: ['###', '#..', '#..', '#..', '###'],
  L: ['#..', '#..', '#..', '#..', '###'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  S: ['###', '#..', '###', '..#', '###'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
};
const textWidth = (t) => [...t].reduce((w, ch) => w + FONT[ch][0].length + 1, -1);

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const px = (x, y, color) => {
    ctx.fillStyle = `rgb(${color[0]} ${color[1]} ${color[2]})`;
    ctx.fillRect(x, y, 1, 1);
  };
  return { c, ctx, px };
}

function text(px, t, x0, y0, color) {
  let x = x0;
  for (const ch of t) {
    FONT[ch].forEach((row, y) => [...row].forEach((v, dx) => v === '#' && px(x + dx, y0 + y, color)));
    x += FONT[ch][0].length + 1;
  }
}

/** El dependiente (propio): pelo castaño con moño, gafas redondas, chaqueta de punto mostaza y su chapa. */
function clerkPixels(frame) {
  const P = new Map();
  const set = (x, y, c) => P.set(`${x},${y}`, c);
  const HAIR = [92, 58, 40];
  const SKIN = [236, 190, 150];
  const SKIN_D = [214, 160, 124];
  const KNIT = [204, 158, 70];
  const KNIT_D = [168, 124, 48];
  const EYE = [40, 28, 24];
  const GLASS = [86, 62, 50];
  for (let y = 22; y < CLERK.h; y += 1) {
    const inset = Math.max(1, 25 - y);
    for (let x = inset; x < CLERK.w - inset; x += 1) {
      const shirt = Math.abs(x - 9.5) < (y - 21) * 0.55 && y < 29;
      set(x, y, shirt ? [240, 232, 214] : x <= inset + 1 || x >= CLERK.w - inset - 2 ? KNIT_D : KNIT);
    }
  }
  for (const [x, y] of [[8, 29], [8, 31]]) set(x, y, [120, 84, 40]);
  for (let x = 12; x <= 15; x += 1) for (const y of [26, 27]) set(x, y, x === 12 ? [180, 70, 52] : [250, 244, 230]);
  // Manos apoyadas en el mostrador
  for (const x of [3, 4, 5, 14, 15, 16]) for (const y of [31, 32]) set(x, y, SKIN);
  for (let y = 19; y < 22; y += 1) for (let x = 8; x <= 11; x += 1) set(x, y, SKIN_D);
  for (let y = 3; y < 20; y += 1)
    for (let x = 1; x < 19; x += 1) {
      const head = ((x - 9.5) / 6.5) ** 2 + ((y - 11.5) / 7.5) ** 2 <= 1;
      const hair = ((x - 9.5) / 7.3) ** 2 + ((y - 10.5) / 8.2) ** 2 <= 1 && (y < 9 || (y < 15 && (x < 4 || x > 15)));
      if (hair) set(x, y, y < 6 && x > 5 && x < 10 ? [124, 82, 56] : HAIR);
      else if (head) set(x, y, x > 13 ? SKIN_D : SKIN);
    }
  for (let y = 0; y < 6; y += 1) for (let x = 13; x < 20; x += 1) if ((x - 16) ** 2 + (y - 3) ** 2 <= 6.5) set(x, y, HAIR);
  set(2, 12, SKIN);
  set(17, 12, SKIN_D);
  // Gafas: dos lentes y el puente
  for (const lx of [5, 11]) for (let y = 11; y <= 14; y += 1) for (let x = lx; x <= lx + 3; x += 1) if (y === 11 || y === 14 || x === lx || x === lx + 3) set(x, y, GLASS);
  set(9, 12, GLASS);
  set(10, 12, GLASS);
  if (frame === 'blink') for (const x of [6, 7, 12, 13]) set(x, 13, EYE);
  else for (const [x, y] of [[7, 12], [7, 13], [12, 12], [12, 13]]) set(x, y, EYE);
  set(5, 16, [232, 150, 130]);
  set(14, 16, [232, 150, 130]);
  if (frame === 'talk') for (const [x, y] of [[8, 16], [11, 16], [9, 16], [10, 16], [9, 17], [10, 17]]) set(x, y, x === 8 || x === 11 ? [168, 80, 64] : [90, 40, 36]);
  else for (const [x, y] of [[8, 16], [9, 17], [10, 17], [11, 16]]) set(x, y, [168, 80, 64]);
  // Contorno (menos por abajo, que lo tapa el mostrador)
  const filled = new Set(P.keys());
  for (const key of filled) {
    const [x, y] = key.split(',').map(Number);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, -1]]) if (!filled.has(`${x + dx},${y + dy}`) && !P.has(`${x + dx},${y + dy}`)) set(x + dx, y + dy, OUT);
  }
  return P;
}

function paintClerk(px, frame, ox, oy, region = null) {
  for (const [key, color] of clerkPixels(frame)) {
    const [x, y] = key.split(',').map(Number);
    if (region && (x < region.x || y < region.y || x >= region.x + region.w || y >= region.y + region.h)) continue;
    px(ox + x - (region?.x ?? 0), oy + y - (region?.y ?? 0), color);
  }
}

let cached = null;

/**
 * El local entero: { scene (imagen), slots, face, blink, talk } con `slots` y `face` en fracciones del dibujo (para
 * colocar encima los botones de los sobres y los fotogramas de la cara del dependiente: parpadeo y hablando).
 */
export function renderShop() {
  if (cached) return cached;
  const { c, px } = makeCanvas(SHOP_W, SHOP_H);
  const topY = (x) => (x < BX0 ? (BY0 * x) / BX0 : x >= BX1 ? (BY0 * (SHOP_W - x)) / (SHOP_W - BX1) : BY0);
  const botY = (x) => (x < BX0 ? SHOP_H - ((SHOP_H - BY1) * x) / BX0 : x >= BX1 ? SHOP_H - ((SHOP_H - BY1) * (SHOP_W - x)) / (SHOP_W - BX1) : BY1);
  const VHS = [[44, 58, 92], [140, 46, 46], [40, 40, 46], [70, 104, 70], [190, 150, 60], [226, 220, 206], [110, 70, 110]];
  for (let y = 0; y < SHOP_H; y += 1)
    for (let x = 0; x < SHOP_W; x += 1) {
      const ty = topY(x);
      const by = botY(x);
      const dither = (x + y) % 2;
      if (y < ty) {
        // Techo con dos fluorescentes
        const tube = y >= 4 && y <= 6 && ((x >= 60 && x <= 86) || (x >= 94 && x <= 120));
        const lit = y === 5 && ((x >= 62 && x <= 84) || (x >= 96 && x <= 118));
        px(x, y, lit ? [255, 248, 226] : tube ? [150, 150, 150] : mix([118, 86, 66], -0.1 + (y / BY0) * 0.1));
      } else if (y > by) {
        // Baldosas en perspectiva, terracota y crema
        const t = (y - BY1) / (SHOP_H - BY1);
        const hw = (BX1 - BX0) / 2 + (SHOP_W / 2 - (BX1 - BX0) / 2) * t;
        const u = (x - SHOP_W / 2) / hw;
        const v = 1 / (0.18 + t * 0.82);
        const tile = (Math.floor((u + 1) * 5) + Math.floor(v * 2.2)) % 2;
        const seam = Math.abs(((u + 1) * 5) % 1) < 0.05 || ((v * 2.2) % 1) < 0.06;
        const base = tile ? [176, 98, 74] : [232, 214, 180];
        px(x, y, mix(base, seam ? -0.25 : -0.22 * (1 - t) + (dither && t > 0.5 ? 0.03 : 0)));
      } else if (x < BX0) {
        // Pared izquierda: las estanterías de cintas del videoclub
        const wu = x / BX0;
        const wv = (y - ty) / (by - ty);
        const wall = mix([206, 176, 128], -0.12 + wu * 0.1);
        if (wv < 0.1 || wv > 0.9) {
          px(x, y, wv > 0.9 ? mix(wall, -0.25) : wall);
          continue;
        }
        const band = (wv - 0.1) / 0.2;
        const k = Math.floor(band);
        const f = band - k;
        if (f > 0.84 || wu < 0.05) {
          px(x, y, f > 0.92 ? [96, 62, 42] : [150, 104, 70]);
          continue;
        }
        const col = Math.floor(wu * 15);
        const edge = (wu * 15) % 1 < 0.18;
        const tall = 0.1 + hash(col, k) * 0.12;
        if (f < tall) {
          px(x, y, mix(wall, -0.35));
          continue;
        }
        const box = VHS[Math.floor(hash(k, col) * VHS.length)];
        const label = f > 0.42 && f < 0.56 && !edge;
        px(x, y, edge ? mix(box, -0.45) : label ? [240, 232, 210] : mix(box, (wu - 0.5) * 0.2));
      } else if (x >= BX1) {
        // Pared derecha: un póster propio (atardecer en el puerto) y la luz del local
        const wu = (SHOP_W - x) / (SHOP_W - BX1);
        const wv = (y - ty) / (by - ty);
        const wall = mix([214, 184, 136], -0.12 + wu * 0.1);
        if (wu > 0.58 && wu < 0.92 && wv > 0.14 && wv < 0.44) {
          const pv = (wv - 0.14) / 0.3;
          const pu = (wu - 0.58) / 0.34;
          const frame = pv < 0.06 || pv > 0.94 || pu < 0.08 || pu > 0.92;
          const sun = (pu - 0.5) ** 2 + ((pv - 0.48) * 1.6) ** 2 < 0.03;
          px(x, y, frame ? [60, 44, 34] : sun ? [255, 214, 120] : pv < 0.55 ? mix([214, 128, 120], -pv * 0.4) : [54, 92, 112]);
          continue;
        }
        px(x, y, wv > 0.9 ? mix(wall, -0.25) : wall);
      } else {
        // Pared del fondo: estuco claro con zócalo de madera y la luz de los fluorescentes por arriba
        const light = 0.12 * (1 - (y - BY0) / (BY1 - BY0));
        px(x, y, y >= 71 ? (y === 71 ? [110, 72, 48] : [150, 104, 70]) : mix([236, 214, 170], light - (dither ? 0.015 : 0)));
      }
    }
  // Cartel de madera con «VIDEOCLUB» tachado y, pegado con celo, un papel que dice «MUEBLES»
  for (let y = 15; y <= 27; y += 1) for (let x = 52; x <= 128; x += 1) px(x, y, y === 15 || y === 27 || x === 52 || x === 128 ? [96, 62, 42] : [46, 64, 52]);
  const vw = textWidth('VIDEOCLUB');
  text(px, 'VIDEOCLUB', 90 - Math.floor(vw / 2), 17, [236, 226, 196]);
  for (let x = 90 - Math.floor(vw / 2) - 2; x <= 90 + Math.ceil(vw / 2) + 1; x += 1) px(x, 19, [214, 72, 52]);
  const mw = textWidth('MUEBLES');
  for (let y = 23; y <= 31; y += 1) for (let x = 104 - 3; x <= 104 + mw + 2; x += 1) px(x, y, y === 31 ? [210, 196, 168] : [251, 243, 223]);
  text(px, 'MUEBLES', 104, 25, [180, 64, 46]);
  for (const [x, y] of [[100, 23], [101, 23], [104 + mw + 1, 23], [104 + mw + 2, 23]]) px(x, y, [200, 210, 214]);
  // Panel perforado y, en cada hueco, una pila de sobres (los de detrás, en sombra) colgados de su gancho
  for (let y = 32; y <= 69; y += 1) for (let x = 40; x <= 140; x += 1) px(x, y, y === 32 || y === 69 || x === 40 || x === 140 ? [110, 72, 48] : x % 4 === 2 && y % 4 === 1 ? [128, 88, 56] : [176, 128, 84]);
  for (const s of SLOTS) {
    for (const off of [2, 1]) for (let y = s.y + off; y < s.y + s.h + off; y += 1) for (let x = s.x + off; x < s.x + s.w + off; x += 1) px(x, y, off === 2 ? [96, 66, 46] : [120, 84, 58]);
    for (let x = s.x + s.w / 2 - 2; x <= s.x + s.w / 2 + 1; x += 1) px(x, s.y - 2, [196, 196, 204]);
    px(s.x + s.w / 2 - 1, s.y - 1, [150, 150, 160]);
  }
  // El dependiente detrás del mostrador
  paintClerk(px, 'base', CLERK.x, CLERK.y);
  // Mostrador: tablero claro, frente de lamas, la caja registradora y un timbre de latón
  for (let y = 86; y < SHOP_H; y += 1)
    for (let x = 124; x < SHOP_W; x += 1) {
      if (y <= 90) px(x, y, y === 86 ? [96, 62, 42] : y === 90 ? [120, 80, 52] : [188, 136, 92]);
      else px(x, y, x < 128 ? [104, 68, 44] : (x - 128) % 7 === 0 ? [112, 74, 48] : [146, 96, 62]);
    }
  for (let y = 76; y <= 86; y += 1)
    for (let x = 130; x <= 146; x += 1) {
      const display = y >= 77 && y <= 79 && x >= 132 && x <= 144;
      const key = y >= 82 && y <= 85 && (x - 131) % 3 === 0 && x < 146;
      px(x, y, x === 130 || x === 146 || y === 76 ? OUT : display ? [140, 214, 150] : key ? [230, 226, 214] : [124, 118, 112]);
    }
  for (const [x, y, k] of [[160, 83, 0], [161, 83, 0], [159, 84, 1], [160, 84, 1], [161, 84, 1], [162, 84, 1], [158, 85, 2], [163, 85, 2], [159, 85, 1], [160, 85, 1], [161, 85, 1], [162, 85, 1]]) px(x, y, [[240, 195, 90], [214, 160, 60], [120, 84, 40]][k]);
  const frameOf = (name) => {
    const f = makeCanvas(FACE.w, FACE.h);
    paintClerk(f.px, name, 0, 0, FACE);
    return f.c.toDataURL();
  };
  const frac = (r) => ({ left: r.x / SHOP_W, top: r.y / SHOP_H, width: r.w / SHOP_W, height: r.h / SHOP_H });
  cached = {
    scene: c.toDataURL(),
    slots: SLOTS.map(frac),
    face: frac({ x: CLERK.x + FACE.x, y: CLERK.y + FACE.y, w: FACE.w, h: FACE.h }),
    blink: frameOf('blink'),
    talk: frameOf('talk'),
  };
  return cached;
}
