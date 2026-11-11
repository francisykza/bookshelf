// El casino del sótano en primera persona (encargo de Francisco del 10-11-2026, bloque a de docs/qa/casino-3d.md): más
// grande e impactante, con el mismo modo de hacer que el almacén (`almacen3d.js`) y la recepción (`recepcion3d.js`):
// Three.js a 320 px de ancho ampliado sin suavizar, texturas de píxel pintadas una vez con las rampas y el tramado del
// dibujo isométrico, la luz ya pintada en ellas (dos lámparas de araña, la lámpara de flecos de la mesa, los neones) y nada
// de luces, sombras ni físicas en tiempo real. Solo se dibuja cuando algo cambia.
// - Un salón art déco de noche: moqueta granate con rombos dorados, zócalo de nogal con su barra de latón, papel pintado
//   verde botella con abanicos dorados, cornisa dorada y techo de casetones; cuatro columnas de mármol.
// - Se baja del hotel a un rellano y de allí, por una escalera de mármol con alfombra roja, a la sala: desde el rellano se
//   ve todo el salón.
// - La mesa de «Las 21 páginas» con su crupier, la ruleta de premios de pie contra el fondo con su abanico de rayos dorados,
//   la mesa de «Las tres chisteras», la ventanilla de la caja con su cajera y la lata, la vitrina de premios y la barra.
// Todo propio: ni arte, ni logos, ni decorados de juegos o casinos reales.
import { BoxGeometry, BufferGeometry, CanvasTexture, Color, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, NearestFilter, PerspectiveCamera, Plane, PlaneGeometry, Raycaster, SRGBColorSpace, Scene, Vector2, Vector3, WebGLRenderer } from 'three';
import { createRaster, hash, rgb } from '../../minigames/libreria-puerto/raster';
import { DEFAULT_AVATAR, actorBoxes } from '../actor';
import { ARANAS, BARRA, CAJA, CD, CH, CHISTERAS, COLUMNAS, CW, ESCALERA, EYE, INICIO, MESA, NODOS, RELLANO, RULETA as RUEDA, SITIOS, VITRINA, dentro, onNet, route } from './casinoLayout';
import { CASILLA_RARA, RULETA, anguloFinal, casillaEn, frenada } from './ruleta';
import { MAPACHE, poseMapache } from '../mapache3d';
import { CAMBIO_MS, PARES, PASO_MS } from './chisteras';
import { ARMARIOS, HITOS } from './vitrina';
import { shapeOf } from '../furniture';
import { catalogItem } from '../catalog';

const ART_W = 320;
const PX = 16; // píxeles de textura por casilla en suelo, paredes y techo
const HFOV = 64;
const VFOV_LANDSCAPE = 62;
const VFOV_MAX = 92;
const PITCH = -0.12;
const DRAG = 0.005;
const KEY_STEP = 0.1;
const WALK = 3.6; // casillas por segundo
const TAP_SLOP = 8;
/** Lejos de esto, un sitio no se rotula. */
const TAG_LEJOS = 24;
/** El bocadillo del crupier, solo de cerca. */
const DICE_CERCA = 7;

const linear = ([r, g, b]) => new Color().setRGB(r / 255, g / 255, b / 255, SRGBColorSpace);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const frac = (v) => v - Math.floor(v);

let probeRaster = null;
const probe = () => (probeRaster ??= createRaster({ W: 2, H: 2, S: 1, yaw: 0, ox: 0, oy: 0 }));
const unpack = (p) => [p & 255, (p >> 8) & 255, (p >> 16) & 255];

// ── La paleta del sótano ──
const WALNUT = [98, 60, 40];
const WALNUT_L = [140, 92, 60];
const GOLD = [226, 180, 90];
const GOLD_D = [150, 108, 48];
const BOTTLE = [30, 72, 60];
const CARPET = [128, 28, 40];
const FELT = [40, 118, 74];
const MARBLE = [224, 216, 202];
const MARBLE_D = [176, 166, 154];
const NEGRO = [28, 24, 30];
const CREAM = [242, 232, 208];
const LAMP = [255, 222, 150];
const NEON = [255, 112, 170];
const CIAN = [110, 226, 236];
const LEAF = [64, 116, 74];
const BLANCO = [236, 232, 226];
const CRUPIER = { ...DEFAULT_AVATAR, piel: 2, pelo: 'corto', colorPelo: 0, jersey: 15, pantalon: 9, complemento: 'visera' };
const CAJERA = { ...DEFAULT_AVATAR, piel: 3, pelo: 'melena', colorPelo: 3, jersey: 15, pantalon: 9, gafas: true };

// ── La luz, pintada: las dos arañas, la lámpara de flecos de la mesa, la de las chisteras, el foco de la ruleta, la caja,
// la vitrina, la barra y la entrada ──
const LUCES = [
  ...ARANAS.map(([x, y, z]) => ({ at: [x, y, z - 0.6], k: 0.85, reach: 7.4 })),
  { at: [2.2, 7.5, 2.9], k: 0.85, reach: 3.4 },
  { at: [CHISTERAS.x, CHISTERAS.y, 2.6], k: 0.8, reach: 3.4 },
  { at: [RUEDA.x, 3.2, 5.6], k: 0.75, reach: 5.2 },
  { at: [1.4, 13.0, 2.6], k: 0.6, reach: 3.0 },
  { at: [15.2, 13.0, 2.7], k: 0.7, reach: 3.4 },
  { at: [1.8, 1.2, 2.8], k: 0.55, reach: 3.0 },
  { at: [8.0, 21.2, 4.6], k: 0.6, reach: 4.6 },
];
function glowAt(x, y, z) {
  let g = 0.1;
  for (const { at, k, reach } of LUCES) {
    const d = Math.hypot(x - at[0], y - at[1], (z - at[2]) * 1.15) / reach;
    if (d < 1) g += k * (1 - d) ** 1.5;
  }
  return Math.min(1, g);
}
// De lejos, morado y fresco; de cerca de una lámpara, cálido
const FAR = [0.66, 0.6, 0.8];
const NEAR = [1.12, 1.0, 0.84];
const BANDS = 6;
function lit(c, g, ix, iy) {
  const r = probe();
  const band = clamp(Math.floor(g * BANDS + 0.5 + (r.bayerAt(ix, iy) - 0.5) * 0.35), 0, BANDS) / BANDS;
  const [cr, cg, cb] = typeof c === 'number' ? unpack(c) : c;
  return rgb(cr * lerp(FAR[0], NEAR[0], band), cg * lerp(FAR[1], NEAR[1], band), cb * lerp(FAR[2], NEAR[2], band));
}
function litColor(c, g, tone) {
  const band = Math.round(g * BANDS) / BANDS;
  const cc = typeof c === 'number' ? unpack(c) : c;
  return linear([0, 1, 2].map((i) => clamp(cc[i] * tone * lerp(FAR[i], NEAR[i], band), 0, 255)));
}

function texture(canvas) {
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  t.magFilter = NearestFilter;
  t.minFilter = NearestFilter;
  return t;
}
function canvasOf(w, h, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const pixels = new Uint32Array(w * h);
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) pixels[y * w + x] = paint(x, y);
  canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(pixels.buffer), w, h), 0, 0);
  return canvas;
}

// ── El suelo: moqueta granate con rombos dorados y su cenefa; mármol al pie de la escalera ──
function paintFloor() {
  const r = probe();
  const carpet = r.rampOf(CARPET);
  const gold = r.rampOf(GOLD_D);
  const marble = r.rampOf(MARBLE);
  return canvasOf(CW * PX, CD * PX, (ix, iy) => {
    const x = (ix + 0.5) / PX;
    const y = CD - (iy + 0.5) / PX;
    const g = glowAt(x, y, 0);
    // Al pie de la escalera, un descansillo de mármol en damero
    if (x > ESCALERA.x0 - 0.9 && x < ESCALERA.x1 + 0.9 && y > ESCALERA.y0 - 1.3 && y < ESCALERA.y0 + 0.02) {
      const edge = x < ESCALERA.x0 - 0.8 || x > ESCALERA.x1 + 0.8 || y < ESCALERA.y0 - 1.2;
      if (edge) return lit(gold[3], g, ix, iy);
      const chk = (Math.floor(x / 0.55) + Math.floor(y / 0.55)) % 2;
      return lit(marble[chk ? 3 : 4 - (hash(Math.floor(x * 9), Math.floor(y * 9)) > 0.92 ? 2 : 0)], g, ix, iy);
    }
    // La cenefa junto a las paredes
    const borde = Math.min(x, CW - x, y);
    if (borde < 0.55) {
      if (Math.abs(borde - 0.42) < 0.035) return lit(gold[3], g, ix, iy);
      return lit(carpet[1], g, ix, iy);
    }
    // Los rombos: dos familias de rayas finas y un punto dorado en cada cruce
    const u = (x + y) / 1.1;
    const v = (x - y) / 1.1;
    const du = Math.min(frac(u), 1 - frac(u));
    const dv = Math.min(frac(v), 1 - frac(v));
    if (du < 0.06 && dv < 0.06) return lit(gold[4], g, ix, iy);
    if (du < 0.025 || dv < 0.025) return lit(gold[2], g, ix, iy);
    // Un rombo pequeño en el centro de cada uno
    const cu = Math.abs(frac(u) - 0.5);
    const cv = Math.abs(frac(v) - 0.5);
    if (cu + cv < 0.12) return lit(carpet[4], g, ix, iy);
    return lit(carpet[3 - (r.bayerAt(ix, iy) > 0.85 ? 1 : 0)], g, ix, iy);
  });
}

// ── Las paredes: zócalo de nogal con su barra de latón, papel verde botella con abanicos dorados y la cornisa ──
function paintWall(w, world, extra = () => null) {
  const r = probe();
  const walnut = r.rampOf(WALNUT);
  const gold = r.rampOf(GOLD);
  const goldD = r.rampOf(GOLD_D);
  const bottle = r.rampOf(BOTTLE);
  const h = Math.round(CH * PX);
  return canvasOf(Math.round(w * PX), h, (ix, iy) => {
    const a = (ix + 0.5) / PX;
    const b = CH - (iy + 0.5) / PX;
    const own = extra(a, b, ix, iy);
    if (own != null) return own;
    const g = glowAt(...world(a, b));
    let c;
    if (b < 1.1) {
      // Paneles de nogal con su moldura
      const u = a % 0.9;
      const moldura = u < 0.06 || u > 0.84 || b < 0.12 || b > 0.98;
      c = moldura ? walnut[1] : b > 0.9 || b < 0.2 ? walnut[2] : walnut[3];
    } else if (b < 1.2) c = b > 1.16 ? gold[4] : gold[2];
    else if (b > CH - 0.7) {
      // La cornisa dorada, con sus dentellones
      const dent = b < CH - 0.5 && a % 0.25 < 0.12;
      c = b > CH - 0.12 ? goldD[1] : dent ? goldD[2] : gold[b > CH - 0.3 ? 3 : 2];
    } else {
      // El abanico art déco: medio círculo de anillos y rayos en una casilla de 1,0 × 1,2
      const tu = (a % 1.0) - 0.5;
      const tv = ((b - 1.2) % 1.2) - 0.05;
      const d = Math.hypot(tu, tv);
      const ang = Math.atan2(tv, tu);
      const ring = tv > 0 && (Math.abs(d - 0.48) < 0.022 || Math.abs(d - 0.32) < 0.018);
      const ray = tv > 0 && d < 0.48 && d > 0.1 && Math.abs(frac((ang / Math.PI) * 7) - 0.5) > 0.46;
      c = ring ? goldD[3] : ray ? goldD[1] : bottle[(Math.floor(a / 0.5) + Math.floor((b - 1.2) / 0.6)) % 2 ? 2 : 3];
    }
    return lit(c, g, ix, iy);
  });
}

// El abanico de rayos dorados detrás de la ruleta (pintado en la pared del fondo)
function rayosRuleta(a, b, ix, iy) {
  const dx = a - RUEDA.x;
  const dz = b - RUEDA.z;
  const d = Math.hypot(dx, dz);
  if (d > 3.05 || b < 1.2 || b > CH - 0.7) return null;
  const r = probe();
  const gold = r.rampOf(GOLD);
  const carpet = r.rampOf(CARPET);
  const g = glowAt(a, 0.2, b) + 0.1;
  if (Math.abs(d - 2.95) < 0.05) return lit(gold[3], g, ix, iy);
  const ang = Math.atan2(dz, dx);
  const rayo = Math.floor(((ang + Math.PI) / (2 * Math.PI)) * 24) % 2;
  return lit(rayo ? gold[d < 2.2 ? 3 : 2] : carpet[2], g, ix, iy);
}

// ── El techo: casetones de nogal granate con vigas doradas y un rosetón bajo cada araña ──
function paintCeiling() {
  const r = probe();
  const walnut = r.rampOf([92, 40, 40]);
  const gold = r.rampOf(GOLD_D);
  return canvasOf(CW * PX, CD * PX, (ix, iy) => {
    const x = (ix + 0.5) / PX;
    const y = CD - (iy + 0.5) / PX;
    const g = glowAt(x, y, CH) * 0.85;
    for (const [ax, ay] of ARANAS) {
      const d = Math.hypot(x - ax, y - ay);
      if (d < 0.9) return lit(Math.abs(d - 0.75) < 0.06 || d < 0.2 ? gold[4] : gold[2], g + 0.1, ix, iy);
    }
    const u = x % 2.0;
    const v = y % 2.0;
    const viga = u < 0.16 || v < 0.16;
    if (viga) return lit(gold[u < 0.05 || v < 0.05 ? 1 : 3], g, ix, iy);
    const marco = u < 0.3 || v < 0.3 || u > 1.86 || v > 1.86;
    return lit(walnut[marco ? 2 : 3], g, ix, iy);
  });
}

// ── Neones y rótulos: letras propias de píxel con su halo (se pintan una vez) ──
function rotulo(texto, color, { hpx = 14, halo = true, font = '"Courier New", monospace' } = {}) {
  const meas = document.createElement('canvas').getContext('2d');
  meas.font = `bold ${hpx}px ${font}`;
  const w = Math.ceil(meas.measureText(texto).width) + 8;
  const h = hpx + 8;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.font = `bold ${hpx}px ${font}`;
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#fff';
  ctx.fillText(texto, 4, 4);
  const src = ctx.getImageData(0, 0, w, h).data;
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i += 1) mask[i] = src[i * 4 + 3] > 110 ? 1 : 0;
  const out = ctx.createImageData(w, h);
  const core = color.map((v) => Math.round(lerp(v, 255, 0.5)));
  for (let y = 0; y < h; y += 1)
    for (let x = 0; x < w; x += 1) {
      const i = y * w + x;
      let px = null;
      if (mask[i]) px = [...core, 255];
      else if (halo) {
        let near = 3;
        for (let dy = -2; dy <= 2; dy += 1)
          for (let dx = -2; dx <= 2; dx += 1) {
            const xx = x + dx;
            const yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= w || yy >= h || !mask[yy * w + xx]) continue;
            near = Math.min(near, Math.max(Math.abs(dx), Math.abs(dy)));
          }
        // Junto al tubo, su sombra oscura (separa las letras); un poco más allá, el resplandor
        if (near === 1) px = [...color.map((v) => Math.round(v * 0.22)), 235];
        else if (near === 2) px = [...color, 90];
      }
      if (px) out.data.set(px, i * 4);
    }
  ctx.putImageData(out, 0, 0);
  return c;
}

// ── 1.109 · La rueda de la ruleta: ocho casillas, granate y verde (la rara, dorada), cada una con su premio pintado y
// de cara hacia fuera, aros dorados y el cubo. La casilla 0 queda arriba con la rueda quieta; siguen en el sentido del reloj
// (las de RULETA en ruleta.js) ──
const ICONO_CHIP = ['..ggggg..', '.gcgggcg.', 'ggGrrrGgg', 'gcGrrrGcg', 'ggGrrrGgg', '.gcgggcg.', '..ggggg..'];
const ICONO_GARBANZOS = ['....bbb....', '...bbbbB...', '.bbbbBBbbb.', 'bbbbBbbbbbB', 'bbbBB.bbbBB', '.BB....BB..'];
const ICONO_PAJARITA = ['gg.......gg', 'gggg...gggg', 'ggggGcGgggg', 'gggggGggggg', 'ggggGcGgggg', 'gggg.c.gggg', 'gg...c...gg', '.....c.....'];
const ICONO_LAMPARA = ['....rrr....', '...rrrrr...', '..rrrrrrr..', '.rrrrrrrrr.', 'ggggggggggg', 'g.g.g.g.g.g', 'g.g.g.g.g.g', '.....G.....', '.....G.....', '.....G.....', '.....G.....', '....GGG....', '...GGGGG...'];
const ICONO_MAPACHE = ['.vv.....vv.', 'vVVvvvvvVVv', '.vvvvvvvvv.', '.aawwawwaa.', 'akkkwawkkka', 'akckkakkcka', 'akkkwwwkkka', '.awwwkwwwa.', '..awwwwwa..', '...aaaaa...', '..aawwwaa..', '.aaawwwaaa.'];
const ICONO_RELOJ = ['..nnn..', '.nnnnn.', 'nncccnn', 'ncckccn', 'ncckkcn', 'nncccnn', '.nnnnn.', '.nkkkn.', '.nkGkn.', '.nkGkn.', '.nkgkn.', '.nnnnn.', 'nnnnnnn'];
/** La ruleta de sobremesa, en pequeño: aro dorado, casillas rojas y negras, plato verde, cubo dorado y su velador. */
const ICONO_RUEDITA = (() => {
  const rows = [];
  for (let y = 0; y < 11; y += 1) {
    let row = '';
    for (let x = 0; x < 11; x += 1) {
      const d = Math.hypot(x - 5, y - 5);
      const a = Math.atan2(y - 5, x - 5);
      if (d > 5.4) row += '.';
      else if (d > 4.4) row += 'g';
      else if (d > 3) row += Math.floor(((a + Math.PI) / (2 * Math.PI)) * 8) % 2 ? 'k' : 'r';
      else if (d > 1.4) row += 'v';
      else row += 'g';
    }
    rows.push(row);
  }
  return [...rows, '.....n.....', '...nnnnn...'];
})();
/** El dibujo de cada casilla: el icono y, si lo hay, la cifra debajo. */
function iconoDe(c) {
  const conCifra = (icono, n) => {
    const digitos = String(n).split('');
    const ancho = digitos.length * 4 - 1;
    const w = Math.max(icono[0].length, ancho);
    const pad = (row) => row.padStart(Math.floor((w - row.length) / 2) + row.length, '.').padEnd(w, '.');
    const cifra = [0, 1, 2, 3, 4].map((y) => pad(digitos.map((d) => GLIFOS[d][y].replace(/#/g, 'c')).join('.')));
    return [...icono.map(pad), '.'.repeat(w), ...cifra];
  };
  if (c.tipo === 'fichas') return conCifra(ICONO_CHIP, c.cantidad);
  if (c.tipo === 'garbanzos') return conCifra(ICONO_GARBANZOS, c.cantidad);
  if (c.tipo === 'prenda') return ICONO_PAJARITA;
  if (c.id === 'lampara-flecos') return ICONO_LAMPARA;
  if (c.id === 'reloj-deco') return ICONO_RELOJ;
  if (c.id === 'mapache-crupier') return ICONO_MAPACHE;
  return ICONO_RUEDITA;
}
function paintRueda(n = 256) {
  const r = probe();
  const gold = r.rampOf(GOLD);
  const carpet = r.rampOf(CARPET);
  const bottle = r.rampOf(BOTTLE);
  const cream = r.rampOf(CREAM);
  const negro = r.rampOf(NEGRO);
  const tinta = {
    g: gold[4],
    G: gold[2],
    c: cream[4],
    r: r.rampOf([196, 46, 58])[3],
    k: negro[3],
    v: r.rampOf(FELT)[3],
    b: r.rampOf([232, 200, 140])[4],
    B: r.rampOf([196, 150, 92])[3],
    n: r.rampOf([92, 52, 36])[2],
    a: r.rampOf([138, 132, 144])[3],
    w: r.rampOf([242, 238, 232])[4],
    V: r.rampOf([90, 176, 122])[3],
  };
  const casillas = RULETA.length;
  const ESCALA = 3;
  const sprites = RULETA.map((c, k) => {
    const theta = ((k + 0.5) / casillas) * 2 * Math.PI;
    const icono = iconoDe(c);
    const R = n * 0.3;
    return { ux: Math.sin(theta), uy: -Math.cos(theta), rx: Math.cos(theta), ry: Math.sin(theta), cx: n / 2 + Math.sin(theta) * R, cy: n / 2 - Math.cos(theta) * R, icono, w: icono[0].length, h: icono.length };
  });
  return canvasOf(n, n, (ix, iy) => {
    const dx = ix + 0.5 - n / 2;
    const dy = iy + 0.5 - n / 2;
    const d = Math.hypot(dx, dy) / (n / 2);
    if (d > 1) return 0;
    if (d > 0.9) return d > 0.97 ? gold[1] : Math.abs(d - 0.935) < 0.008 ? gold[2] : gold[4];
    if (d > 0.86) return cream[3];
    if (d < 0.17) return d > 0.15 ? gold[1] : d < 0.06 ? gold[4] : gold[3];
    if (d < 0.2) return negro[2];
    const ang = Math.atan2(dy, dx) + Math.PI / 2;
    const t = frac(ang / (2 * Math.PI)) * casillas;
    const k = Math.floor(t);
    const borde = Math.min(t - k, 1 - (t - k)) * ((2 * Math.PI * d * n) / 2 / casillas);
    if (borde < 1.4) return gold[3];
    // El premio de la casilla, de cara hacia fuera
    const sp = sprites[k];
    const vx = ix + 0.5 - sp.cx;
    const vy = iy + 0.5 - sp.cy;
    const lx = Math.floor((vx * sp.rx + vy * sp.ry) / ESCALA + sp.w / 2);
    const ly = Math.floor(-(vx * sp.ux + vy * sp.uy) / ESCALA + sp.h / 2);
    const ch = lx >= 0 && lx < sp.w && ly >= 0 && ly < sp.h ? sp.icono[ly][lx] : '.';
    if (ch !== '.') return tinta[ch];
    if (k === CASILLA_RARA) return gold[d < 0.5 ? 3 : 2];
    return (k % 2 ? bottle : carpet)[d < 0.5 ? 2 : 3];
  });
}

/** El aro de nogal de la ruleta, con un filo dorado por fuera y otro por dentro. */
function paintAro(n = 80) {
  const r = probe();
  const walnut = r.rampOf(WALNUT);
  const gold = r.rampOf(GOLD);
  const g = glowAt(RUEDA.x, 1.5, RUEDA.z) + 0.15;
  return canvasOf(n, n, (ix, iy) => {
    const d = Math.hypot(ix + 0.5 - n / 2, iy + 0.5 - n / 2) / (n / 2);
    if (d > 1) return 0;
    if (d > 0.95) return lit(gold[3], g, ix, iy);
    if (d < 0.86 && d > 0.83) return lit(gold[2], g, ix, iy);
    return lit(walnut[d > 0.9 ? 3 : 2], g, ix, iy);
  });
}

// ── Cajas: mundo de la app (x, y a lo hondo, z arriba) → Three (x, z, y) ──
const FACE_TONE = { top: 1.06, bottom: 0.6, front: 0.92, back: 0.74, right: 0.84, left: 0.8 };
function pushBox(out, [x0, y0, z0, x1, y1, z1], color, { glow = false, g = null } = {}) {
  const gl = glow ? 0 : (g ?? glowAt((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2));
  const faces = [
    ['front', [[x0, z0, y1], [x1, z0, y1], [x1, z1, y1], [x0, z1, y1]], [0, 0, 1]],
    ['back', [[x1, z0, y0], [x0, z0, y0], [x0, z1, y0], [x1, z1, y0]], [0, 0, -1]],
    ['right', [[x1, z0, y1], [x1, z0, y0], [x1, z1, y0], [x1, z1, y1]], [1, 0, 0]],
    ['left', [[x0, z0, y0], [x0, z0, y1], [x0, z1, y1], [x0, z1, y0]], [-1, 0, 0]],
    ['top', [[x0, z1, y1], [x1, z1, y1], [x1, z1, y0], [x0, z1, y0]], [0, 1, 0]],
    ['bottom', [[x0, z0, y0], [x1, z0, y0], [x1, z0, y1], [x0, z0, y1]], [0, -1, 0]],
  ];
  for (const [name, [a, b, c, d], n] of faces) {
    const col = glow ? linear(typeof color === 'number' ? unpack(color) : color) : litColor(color, gl, FACE_TONE[name]);
    for (const p of [a, b, c, a, c, d]) {
      out.pos.push(...p);
      out.nor.push(...n);
      out.col.push(col.r, col.g, col.b);
    }
  }
}
const kit = () => ({ pos: [], nor: [], col: [] });
function geometryOf({ pos, nor, col }) {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  return g;
}
/** Un disco hecho de franjas (mesas redondas y de media luna): `ancho(t)` da la media anchura en x para cada franja de y. */
function disco(s, { x0, y0, y1, z0, z1, n = 12, ancho, desde = null }, color, opt) {
  const dy = (y1 - y0) / n;
  for (let k = 0; k < n; k += 1) {
    const ya = y0 + k * dy;
    const t = (ya + dy / 2 - y0) / (y1 - y0);
    const w = ancho(t);
    if (w <= 0.01) continue;
    if (desde != null) pushBox(s, [desde, ya, z0, desde + w, ya + dy, z1], color, opt);
    else pushBox(s, [x0 - w, ya, z0, x0 + w, ya + dy, z1], color, opt);
  }
}

/** La sala: columnas, escalera con su alfombra y barandillas, el rellano, las arañas, la barra y las palmeras. */
function buildSala(glass) {
  const s = kit();
  // Las columnas de mármol, con basa y capitel dorados
  for (const [x, y] of COLUMNAS) {
    const g = glowAt(x, y, 2.5);
    pushBox(s, [x - 0.42, y - 0.42, 0, x + 0.42, y + 0.42, 0.32], WALNUT, { g });
    pushBox(s, [x - 0.38, y - 0.38, 0.32, x + 0.38, y + 0.38, 0.42], GOLD, { g });
    pushBox(s, [x - 0.3, y - 0.3, 0.42, x + 0.3, y + 0.3, CH - 0.95], MARBLE, { g });
    for (const z of [1.15, CH - 1.5]) pushBox(s, [x - 0.32, y - 0.32, z, x + 0.32, y + 0.32, z + 0.08], GOLD, { g });
    // Estrías: tres por cara
    for (const k of [-0.15, 0, 0.15]) {
      pushBox(s, [x + k - 0.02, y - 0.305, 0.5, x + k + 0.02, y - 0.3, CH - 1.0], MARBLE_D, { g });
      pushBox(s, [x + k - 0.02, y + 0.3, 0.5, x + k + 0.02, y + 0.305, CH - 1.0], MARBLE_D, { g });
      pushBox(s, [x - 0.305, y + k - 0.02, 0.5, x - 0.3, y + k + 0.02, CH - 1.0], MARBLE_D, { g });
      pushBox(s, [x + 0.3, y + k - 0.02, 0.5, x + 0.305, y + k + 0.02, CH - 1.0], MARBLE_D, { g });
    }
    pushBox(s, [x - 0.4, y - 0.4, CH - 0.95, x + 0.4, y + 0.4, CH - 0.8], GOLD, { g });
    pushBox(s, [x - 0.52, y - 0.52, CH - 0.8, x + 0.52, y + 0.52, CH - 0.7], GOLD_D, { g });
  }

  // El rellano: mármol arriba, nogal con molduras doradas en el frente, y su barandilla a cada lado de la escalera
  {
    const { x0, x1, y0, y1, z } = RELLANO;
    pushBox(s, [x0, y0, 0, x1, y1, z], WALNUT, { g: glowAt(8, y0, 1.2) });
    pushBox(s, [x0, y0 - 0.06, z - 0.08, x1, y1, z], MARBLE, { g: glowAt(8, y0, z) });
    for (let x = x0 + 0.3; x < x1 - 0.3; x += 1.1) {
      if (x > ESCALERA.x0 - 0.4 && x < ESCALERA.x1 + 0.4) continue;
      pushBox(s, [x, y0 - 0.02, 0.3, x + 0.8, y0, z - 0.3], WALNUT_L);
      pushBox(s, [x + 0.05, y0 - 0.03, 0.35, x + 0.75, y0 - 0.02, 0.4], GOLD);
      pushBox(s, [x + 0.05, y0 - 0.03, z - 0.4, x + 0.75, y0 - 0.02, z - 0.35], GOLD);
    }
    // La alfombra roja del rellano, de la puerta a la escalera
    pushBox(s, [7.2, y0, z, 8.8, y1, z + 0.012], CARPET, { g: glowAt(8, 20.5, z) });
    for (const [a, b] of [
      [x0, ESCALERA.x0],
      [ESCALERA.x1, x1],
    ]) {
      const g = glowAt((a + b) / 2, y0, z + 0.6);
      pushBox(s, [a, y0 - 0.02, z + 0.92, b, y0 + 0.1, z + 1.0], GOLD, { g });
      for (let x = a + 0.12; x < b - 0.05; x += 0.32) pushBox(s, [x, y0, z, x + 0.05, y0 + 0.05, z + 0.92], GOLD_D, { g });
    }
    // Las barandillas de los lados del rellano
    for (const x of [x0, x1 - 0.1]) {
      const g = glowAt(x, (y0 + y1) / 2, z + 0.6);
      pushBox(s, [x, y0, z + 0.92, x + 0.1, y1, z + 1.0], GOLD, { g });
      for (let y = y0 + 0.2; y < y1; y += 0.32) pushBox(s, [x + 0.03, y, z, x + 0.07, y + 0.05, z + 0.92], GOLD_D, { g });
    }
  }

  // La escalera de mármol: doce peldaños, alfombra roja con varillas de latón y barandillas que bajan con ella
  {
    const { x0, x1, y0, y1, peldanos } = ESCALERA;
    const d = (y1 - y0) / peldanos;
    const h = RELLANO.z / peldanos;
    for (let k = 0; k < peldanos; k += 1) {
      const ya = y0 + k * d;
      const zt = (k + 1) * h;
      const g = glowAt(8, ya, zt);
      pushBox(s, [x0, ya, 0, x1, ya + d, zt], MARBLE, { g });
      pushBox(s, [x0, ya - 0.015, zt - 0.03, x1, ya + d, zt], MARBLE_D, { g });
      pushBox(s, [7.2, ya - 0.012, zt - h, 8.8, ya + d, zt + 0.012], CARPET, { g });
      pushBox(s, [7.15, ya - 0.03, zt - 0.03, 8.85, ya, zt], GOLD, { g });
    }
    for (const x of [x0 - 0.1, x1]) {
      for (let k = 0; k <= peldanos; k += 2) {
        const y = y0 + k * d;
        const zt = k * h;
        const g = glowAt(x, y, zt + 0.5);
        pushBox(s, [x + 0.02, y, zt, x + 0.08, y + 0.06, zt + 0.95], GOLD_D, { g });
      }
      // El pasamanos, en tramos que suben
      for (let k = 0; k < peldanos; k += 1) {
        const y = y0 + k * d;
        pushBox(s, [x, y, (k + 0.5) * h + 0.9, x + 0.1, y + d, (k + 0.5) * h + 0.98], GOLD, { g: glowAt(x, y, 1.5) });
      }
      // Arranque: una bola dorada sobre su pilar
      const g = glowAt(x, y0, 0.6);
      pushBox(s, [x - 0.06, y0 - 0.2, 0, x + 0.16, y0 + 0.02, 1.0], WALNUT, { g });
      pushBox(s, [x - 0.04, y0 - 0.18, 1.0, x + 0.14, y0, 1.18], GOLD, { g });
    }
  }

  // Las lámparas de araña: cadena, tres aros dorados y sus lágrimas encendidas
  for (const [x, y, z] of ARANAS) {
    const g = 0.9;
    pushBox(s, [x - 0.03, y - 0.03, z, x + 0.03, y + 0.03, CH], GOLD_D, { g });
    [
      [0.95, 0],
      [0.68, -0.38],
      [0.4, -0.72],
    ].forEach(([R, dz]) => {
      const zz = z + dz;
      pushBox(s, [x - R, y - R, zz, x + R, y - R + 0.06, zz + 0.06], GOLD, { g });
      pushBox(s, [x - R, y + R - 0.06, zz, x + R, y + R, zz + 0.06], GOLD, { g });
      pushBox(s, [x - R, y - R, zz, x - R + 0.06, y + R, zz + 0.06], GOLD, { g });
      pushBox(s, [x + R - 0.06, y - R, zz, x + R, y + R, zz + 0.06], GOLD, { g });
      const n = 4;
      for (let i = 0; i <= n; i += 1) {
        const t = -R + (2 * R * i) / n;
        for (const [px, py] of [
          [x + t, y - R],
          [x + t, y + R],
          [x - R, y + t],
          [x + R, y + t],
        ])
          pushBox(s, [px - 0.035, py - 0.035, zz - 0.26, px + 0.035, py + 0.035, zz - 0.02], i % 2 ? LAMP : CREAM, { glow: true });
      }
      // Velas sobre el aro
      for (const [px, py] of [
        [x - R + 0.1, y - R + 0.1],
        [x + R - 0.1, y - R + 0.1],
        [x - R + 0.1, y + R - 0.1],
        [x + R - 0.1, y + R - 0.1],
      ]) {
        pushBox(s, [px - 0.04, py - 0.04, zz + 0.06, px + 0.04, py + 0.04, zz + 0.24], CREAM, { g });
        pushBox(s, [px - 0.025, py - 0.025, zz + 0.24, px + 0.025, py + 0.025, zz + 0.32], LAMP, { glow: true });
      }
    });
    pushBox(s, [x - 0.12, y - 0.12, z - 1.1, x + 0.12, y + 0.12, z - 0.72], LAMP, { glow: true });
  }

  // La barra del fondo: mostrador de nogal con su tapa de mármol, la balda de botellas y dos taburetes
  {
    const { x0, x1, y1 } = BARRA;
    const g = glowAt(1.8, 1.4, 1);
    pushBox(s, [x0, y1 - 0.6, 0, x1, y1, 1.05], WALNUT, { g });
    pushBox(s, [x0, y1 - 0.66, 1.05, x1 + 0.06, y1 + 0.06, 1.12], MARBLE, { g });
    pushBox(s, [x0, y1 + 0.02, 0.1, x1, y1 + 0.04, 0.16], GOLD, { g });
    pushBox(s, [x0, 0, 0, x1, 0.35, 2.6], WALNUT_L, { g: glowAt(1.8, 0.3, 1.8) });
    const botellas = [
      [40, 110, 70],
      [150, 60, 40],
      [210, 170, 80],
      [80, 50, 110],
      [180, 200, 210],
    ];
    for (const z of [1.3, 1.95]) {
      pushBox(s, [x0 + 0.1, 0.05, z - 0.04, x1 - 0.1, 0.42, z], GOLD_D, { g: glowAt(1.8, 0.5, z) });
      for (let k = 0; k < 9; k += 1) {
        const x = x0 + 0.3 + k * 0.36;
        const c = botellas[(k + (z > 1.5 ? 2 : 0)) % botellas.length];
        pushBox(s, [x, 0.12, z, x + 0.14, 0.26, z + 0.34], c, { g: glowAt(x, 0.5, z) + 0.15 });
        pushBox(s, [x + 0.04, 0.16, z + 0.34, x + 0.1, 0.22, z + 0.44], c, { g: glowAt(x, 0.5, z) + 0.15 });
      }
    }
    for (const x of [1.0, 2.6]) taburete(s, x, y1 + 0.55);
  }

  // Palmeras en macetero dorado, a los lados de la escalera
  for (const [x, y] of [
    [4.6, 17.6],
    [11.4, 17.6],
    [1.2, 20.6],
    [14.8, 20.6],
  ])
    palmera(s, x, y);
  // El cristal de la vitrina va aparte (transparente)
  vitrina(s, glass);
  return s;
}

function taburete(s, x, y) {
  const g = glowAt(x, y, 0.6);
  pushBox(s, [x - 0.22, y - 0.22, 0, x + 0.22, y + 0.22, 0.05], GOLD_D, { g });
  pushBox(s, [x - 0.04, y - 0.04, 0.05, x + 0.04, y + 0.04, 0.68], GOLD, { g });
  pushBox(s, [x - 0.22, y - 0.22, 0.68, x + 0.22, y + 0.22, 0.8], CARPET, { g });
  pushBox(s, [x - 0.2, y - 0.2, 0.8, x + 0.2, y + 0.2, 0.83], [160, 40, 52], { g });
}

function palmera(s, x, y) {
  const g = glowAt(x, y, 1);
  pushBox(s, [x - 0.32, y - 0.32, 0, x + 0.32, y + 0.32, 0.62], GOLD_D, { g });
  pushBox(s, [x - 0.34, y - 0.34, 0.5, x + 0.34, y + 0.34, 0.62], GOLD, { g });
  for (let z = 0.62; z < 2.0; z += 0.18) pushBox(s, [x - 0.07 + (z % 0.36 > 0.18 ? 0.01 : 0), y - 0.07, z, x + 0.07, y + 0.07, z + 0.16], [118, 84, 56], { g });
  for (let k = 0; k < 7; k += 1) {
    const a = (k / 7) * 2 * Math.PI;
    for (let i = 1; i <= 4; i += 1) {
      const px = x + Math.cos(a) * i * 0.22;
      const py = y + Math.sin(a) * i * 0.22;
      const pz = 2.05 + 0.18 * i - 0.09 * i * i;
      pushBox(s, [px - 0.1, py - 0.1, pz, px + 0.1, py + 0.1, pz + 0.05], i % 2 ? LEAF : [84, 140, 90], { g: g + 0.05 });
    }
  }
}

/** La vitrina de premios: tres armarios de nogal con cristal, baldas de cristal, terciopelo dentro y su luz. */
function vitrina(s, glass) {
  const { x0, x1, armarios, alto } = VITRINA;
  for (const [ya, yb] of armarios) {
    const g = glowAt(15.2, (ya + yb) / 2, 1.5);
    pushBox(s, [x0, ya, 0, x1, yb, 0.82], WALNUT, { g });
    pushBox(s, [x0 - 0.02, ya + 0.08, 0.2, x0, yb - 0.08, 0.7], WALNUT_L, { g });
    pushBox(s, [x0 - 0.03, ya + 0.12, 0.42, x0 - 0.02, yb - 0.12, 0.48], GOLD, { g });
    // El terciopelo del fondo, encendido por su luz
    pushBox(s, [x1 - 0.1, ya, 0.82, x1, yb, alto - 0.25], [150, 30, 50], { g: g + 0.25 });
    // Postes de latón y la cornisa
    for (const y of [ya, yb - 0.06]) pushBox(s, [x0, y, 0.82, x0 + 0.06, y + 0.06, alto - 0.25], GOLD, { g });
    pushBox(s, [x0 - 0.04, ya - 0.02, alto - 0.25, x1, yb + 0.02, alto], WALNUT, { g });
    pushBox(s, [x0 - 0.06, ya - 0.04, alto - 0.12, x1, yb + 0.04, alto - 0.07], GOLD, { g });
    pushBox(s, [x0 + 0.1, ya + 0.1, alto - 0.3, x1 - 0.12, yb - 0.1, alto - 0.26], LAMP, { glow: true });
    // Las baldas de cristal (y el cristal de delante), en la capa transparente
    for (const z of [1.42, 2.02]) pushBox(glass, [x0 + 0.05, ya + 0.06, z, x1 - 0.1, yb - 0.06, z + 0.03], [200, 230, 236], { g: 0.9 });
    pushBox(glass, [x0 + 0.01, ya + 0.06, 0.82, x0 + 0.03, yb - 0.06, alto - 0.25], [190, 222, 230], { g: 0.8 });
  }
}

/** La mesa de «Las 21 páginas»: media luna de tapete verde con su borde de nogal y latón, sus naipes y fichas, la lámpara de flecos y tres taburetes. */
function buildMesa() {
  const s = kit();
  const { x0, x1, y0, y1, alto } = MESA;
  const R = x1 - x0;
  const half = (t) => R * Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2));
  const g = glowAt(3, 7.5, 1);
  // Patas y faldón
  pushBox(s, [x0 + 0.15, y0 + 0.5, 0, x0 + 1.1, y1 - 0.5, 0.12], WALNUT, { g });
  pushBox(s, [x0 + 0.35, 7.15, 0.12, x0 + 0.85, 7.85, alto - 0.12], WALNUT_L, { g });
  disco(s, { y0, y1, z0: alto - 0.16, z1: alto - 0.06, n: 24, ancho: (t) => half(t) + 0.12, desde: x0 }, WALNUT, { g });
  disco(s, { y0: y0 + 0.02, y1: y1 - 0.02, z0: alto - 0.06, z1: alto - 0.02, n: 24, ancho: (t) => half(t) + 0.08, desde: x0 }, GOLD, { g });
  disco(s, { y0: y0 + 0.12, y1: y1 - 0.12, z0: alto - 0.02, z1: alto, n: 24, ancho: (t) => half(t) - 0.02, desde: x0 + 0.05 }, FELT, { g });
  // Un filete dorado pintado en el paño alrededor de donde caen las cartas (las del crupier y las tuyas)
  const filete = (ax, bx, ay, by) => {
    const c = [196, 160, 84];
    const t = 0.025;
    pushBox(s, [ax, ay, alto, bx, ay + t, alto + 0.002], c, { g });
    pushBox(s, [ax, by - t, alto, bx, by, alto + 0.002], c, { g });
    pushBox(s, [ax, ay, alto, ax + t, by, alto + 0.002], c, { g });
    pushBox(s, [bx - t, ay, alto, bx, by, alto + 0.002], c, { g });
  };
  filete(x0 + 0.17, x0 + 0.83, 6.8, 8.2);
  filete(x0 + 0.92, x0 + 1.58, 6.62, 8.38);
  // El sabot de naipes y el estante de fichas, del lado del crupier
  pushBox(s, [x0 + 0.1, 7.95, alto, x0 + 0.42, 8.3, alto + 0.16], [40, 40, 46], { g });
  pushBox(s, [x0 + 0.14, 7.99, alto + 0.16, x0 + 0.38, 8.26, alto + 0.18], BLANCO, { g });
  const fichas = [CARPET, [40, 90, 160], GOLD, BLANCO, [30, 30, 34]];
  fichas.forEach((c, k) => pushBox(s, [x0 + 0.08, 6.75 + k * 0.15, alto, x0 + 0.34, 6.87 + k * 0.15, alto + 0.08], c, { g }));
  // (Las cartas de la mano van aparte, 1.108: se reparten de verdad sobre el paño)
  // La lámpara de flecos, colgada sobre la mesa
  const zl = 2.95;
  const L = { x0: 1.6, x1: 2.8, y0: 6.9, y1: 8.1 };
  pushBox(s, [2.18, 7.47, zl + 0.3, 2.22, 7.53, CH], GOLD_D, { g: 0.6 });
  pushBox(s, [L.x0, L.y0, zl, L.x1, L.y1, zl + 0.28], [110, 24, 36], { g: 0.5 });
  pushBox(s, [L.x0 + 0.1, L.y0 + 0.1, zl + 0.28, L.x1 - 0.1, L.y1 - 0.1, zl + 0.34], GOLD, { g: 0.6 });
  pushBox(s, [L.x0 + 0.06, L.y0 + 0.06, zl - 0.02, L.x1 - 0.06, L.y1 - 0.06, zl], LAMP, { glow: true });
  for (let t = 0; t < 1; t += 0.1) {
    for (const [px, py] of [
      [L.x0 + t * 1.2, L.y0],
      [L.x0 + t * 1.2, L.y1 - 0.03],
      [L.x0, L.y0 + t * 1.2],
      [L.x1 - 0.03, L.y0 + t * 1.2],
    ])
      pushBox(s, [px, py, zl - 0.18, px + 0.03, py + 0.03, zl], GOLD, { g: 0.75 });
  }
  // Tres taburetes delante, del lado de quien juega
  for (const y of [7.5, 8.25]) taburete(s, x1 + 0.45, y);
  taburete(s, 2.2, 5.85);
  return s;
}

/** La ruleta de premios: tarima, pies de latón, el aro de bombillas y la flecha de arriba (la rueda va aparte, para girarla). */
function buildRuleta() {
  const s = kit();
  const { x, y, z, r, tarima } = RUEDA;
  const [tx0, ty0, tx1, ty1] = tarima;
  const g = glowAt(x, 1.5, 0.5);
  pushBox(s, [tx0, ty0, 0, tx1, ty1, 0.32], WALNUT, { g });
  pushBox(s, [tx0 - 0.04, ty1 - 0.04, 0.28, tx1 + 0.04, ty1 + 0.04, 0.34], GOLD, { g });
  pushBox(s, [tx0 + 0.2, ty1 - 0.02, 0.06, tx1 - 0.2, ty1, 0.26], CARPET, { g });
  // Cordón de terciopelo entre dos postes, delante de la tarima
  for (const px of [tx0 + 0.3, tx1 - 0.3]) {
    pushBox(s, [px - 0.06, ty1 + 0.25, 0, px + 0.06, ty1 + 0.37, 0.95], GOLD, { g: glowAt(px, ty1, 0.5) });
    pushBox(s, [px - 0.09, ty1 + 0.22, 0.95, px + 0.09, ty1 + 0.4, 1.05], GOLD, { g: glowAt(px, ty1, 0.5) });
  }
  for (let k = 0; k < 14; k += 1) {
    const t = k / 13;
    const px = lerp(tx0 + 0.36, tx1 - 0.36, t);
    const sag = 0.25 * Math.sin(Math.PI * t);
    pushBox(s, [px - 0.2, ty1 + 0.28, 0.82 - sag, px + 0.2, ty1 + 0.34, 0.88 - sag], CARPET, { g: glowAt(px, ty1, 0.8) });
  }
  // Pies de latón en uve que sujetan la rueda
  const gp = glowAt(x, y, 2);
  for (let k = 0; k < 10; k += 1) {
    const t = k / 10;
    const zz = 0.32 + t * (z - 0.32);
    for (const sg of [-1, 1]) {
      const px = x + sg * lerp(1.2, 0.12, t);
      pushBox(s, [px - 0.06, y - 0.06, zz, px + 0.06, y + 0.06, zz + (z - 0.32) / 10 + 0.02], GOLD, { g: gp });
    }
  }
  // Bombillas alrededor, alternando oro y rosa
  for (let k = 0; k < 20; k += 1) {
    const a = (k / 20) * 2 * Math.PI;
    const px = x + Math.cos(a) * (r + 0.16);
    const pz = z + Math.sin(a) * (r + 0.16);
    pushBox(s, [px - 0.065, y + 0.14, pz - 0.065, px + 0.065, y + 0.24, pz + 0.065], k % 2 ? NEON : LAMP, { glow: true });
  }
  // La flecha de arriba: un triángulo de latón que señala la casilla
  for (let i = 0; i < 4; i += 1) {
    const w = 0.24 - i * 0.06;
    const zz = z + r + 0.38 - i * 0.1;
    pushBox(s, [x - w, y + 0.24, zz, x + w, y + 0.36, zz + 0.1], GOLD, { g: 0.85 });
  }
  pushBox(s, [x - 0.05, y + 0.36, z + r + 0.2, x + 0.05, y + 0.4, z + r + 0.42], CARPET, { g: 0.85 });
  return s;
}

/** «Las tres chisteras»: mesa redonda de tapete con su borde y su lámpara (las chisteras y el conejo van aparte, 1.110). */
function buildChisteras() {
  const s = kit();
  const { x, y, r, alto } = CHISTERAS;
  const g = glowAt(x, y, 1);
  const circ = (rr) => (t) => rr * Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2));
  pushBox(s, [x - 0.5, y - 0.5, 0, x + 0.5, y + 0.5, 0.1], WALNUT, { g });
  pushBox(s, [x - 0.14, y - 0.14, 0.1, x + 0.14, y + 0.14, alto - 0.14], GOLD_D, { g });
  disco(s, { x0: x, y0: y - r - 0.1, y1: y + r + 0.1, z0: alto - 0.14, z1: alto - 0.05, n: 22, ancho: circ(r + 0.1) }, WALNUT, { g });
  disco(s, { x0: x, y0: y - r - 0.04, y1: y + r + 0.04, z0: alto - 0.05, z1: alto - 0.02, n: 22, ancho: circ(r + 0.04) }, GOLD, { g });
  disco(s, { x0: x, y0: y - r + 0.06, y1: y + r - 0.06, z0: alto - 0.02, z1: alto, n: 22, ancho: circ(r - 0.06) }, FELT, { g });
  // Una lámpara de globo sobre la mesa
  pushBox(s, [x - 0.02, y - 0.02, 2.85, x + 0.02, y + 0.02, CH], GOLD_D, { g: 0.6 });
  pushBox(s, [x - 0.26, y - 0.26, 2.58, x + 0.26, y + 0.26, 2.8], LAMP, { glow: true });
  pushBox(s, [x - 0.3, y - 0.3, 2.8, x + 0.3, y + 0.3, 2.86], GOLD, { g: 0.8 });
  return s;
}

// 1.110 · Las chisteras y el conejo, cada uno con su origen en el centro de su base (se mueven por la mesa)
/** Una chistera negra con su cinta granate y el ala; el hueco, por debajo. */
function kitChistera(g) {
  const s = kit();
  pushBox(s, [-0.21, -0.21, 0, 0.21, 0.21, 0.03], NEGRO, { g });
  pushBox(s, [-0.14, -0.14, 0.03, 0.14, 0.14, 0.36], NEGRO, { g: g + 0.05 });
  pushBox(s, [-0.145, -0.145, 0.07, 0.145, 0.145, 0.12], [150, 30, 50], { g });
  pushBox(s, [-0.15, -0.15, 0.36, 0.15, 0.15, 0.38], [48, 42, 52], { g });
  return s;
}
/** El conejo blanco de la chistera, sentado y mirando a quien juega (−x). */
function kitConejo(g) {
  const s = kit();
  pushBox(s, [-0.16, -0.14, 0, 0.12, 0.14, 0.22], BLANCO, { g });
  pushBox(s, [-0.12, -0.1, 0.22, 0.06, 0.1, 0.38], BLANCO, { g });
  for (const sg of [-1, 1]) {
    pushBox(s, [-0.06, sg * 0.06 - 0.03, 0.38, -0.01, sg * 0.06 + 0.03, 0.6], BLANCO, { g });
    pushBox(s, [-0.065, sg * 0.06 - 0.015, 0.42, -0.06, sg * 0.06 + 0.015, 0.57], [236, 160, 176], { g });
    pushBox(s, [-0.125, sg * 0.04 - 0.015, 0.3, -0.12, sg * 0.04 + 0.015, 0.33], NEGRO, { g });
  }
  pushBox(s, [-0.13, -0.015, 0.26, -0.12, 0.015, 0.28], [236, 160, 176], { g });
  // La bolita de la cola
  pushBox(s, [0.12, -0.05, 0.04, 0.17, 0.05, 0.12], BLANCO, { g });
  return s;
}
/** Dónde va cada chistera: en fila, de izquierda a derecha según se mira la mesa desde delante (de −x a +x: la y crece). */
const SITIO_X = CHISTERAS.x - 0.15;
const SITIO_Y = [CHISTERAS.y - 0.5, CHISTERAS.y, CHISTERAS.y + 0.5];
/** Donde espera el conejo: al otro lado de la mesa. */
const CONEJO_CASA = [CHISTERAS.x + 0.75, CHISTERAS.y];
/** Lo que sube una chistera al levantarla, y lo que se inclina hacia quien juega para que se vea debajo. */
const ALZA = 0.55;
const INCLINA = -0.35;

/** La ventanilla de la caja: mostrador de nogal, reja de latón con su hueco, el letrero y la lata de los garbanzos. */
function buildCaja() {
  const s = kit();
  const { x1, y0, y1 } = CAJA;
  const g = glowAt(1.2, 13, 1.4);
  pushBox(s, [0, y0, 0, x1, y1, 1.1], WALNUT, { g });
  for (let y = y0 + 0.15; y < y1 - 0.2; y += 0.75) {
    pushBox(s, [x1, y, 0.18, x1 + 0.02, y + 0.6, 0.92], WALNUT_L, { g });
    pushBox(s, [x1 + 0.02, y + 0.05, 0.5, x1 + 0.03, y + 0.55, 0.56], GOLD, { g });
  }
  pushBox(s, [0, y0 - 0.04, 1.1, x1 + 0.12, y1 + 0.04, 1.18], MARBLE, { g });
  // La reja, con el hueco de la ventanilla en medio
  for (let y = y0 + 0.06; y < y1; y += 0.13) {
    const hueco = y > 12.45 && y < 13.55;
    pushBox(s, [x1 - 0.04, y, hueco ? 2.08 : 1.18, x1, y + 0.03, 2.45], GOLD, { g });
  }
  pushBox(s, [x1 - 0.06, y0, 2.05, x1 + 0.01, y1, 2.1], GOLD_D, { g });
  pushBox(s, [x1 - 0.06, y0, 2.42, x1 + 0.02, y1, 2.48], GOLD_D, { g });
  // El copete con el letrero y el remate
  pushBox(s, [0, y0 - 0.1, 2.45, x1 + 0.08, y1 + 0.1, 2.95], WALNUT, { g });
  pushBox(s, [x1 + 0.08, y0 - 0.1, 2.48, x1 + 0.1, y1 + 0.1, 2.52], GOLD, { g });
  pushBox(s, [x1 + 0.08, y0 - 0.1, 2.88, x1 + 0.1, y1 + 0.1, 2.92], GOLD, { g });
  // La lata de los garbanzos, sobre el mostrador
  pushBox(s, [x1 - 0.32, 13.8, 1.18, x1 - 0.06, 14.06, 1.42], [196, 170, 120], { g });
  pushBox(s, [x1 - 0.33, 13.79, 1.25, x1 - 0.05, 14.07, 1.33], [150, 40, 52], { g });
  pushBox(s, [x1 - 0.34, 13.78, 1.42, x1 - 0.04, 14.08, 1.45], GOLD, { g });
  // Un platillo de latón en el hueco, para las fichas
  pushBox(s, [x1 - 0.2, 12.8, 1.18, x1 + 0.06, 13.2, 1.2], GOLD, { g });
  return s;
}

/** Un personaje del casino (el crupier, la cajera) de pie, centrado en su casilla. */
function figuraKit(avatar, luz = 0.55) {
  const s = kit();
  let boxes = [];
  try {
    boxes = actorBoxes(avatar, { pose: 'stand', x: 0, y: 0, facing: 0 });
  } catch {
    boxes = actorBoxes(DEFAULT_AVATAR, { pose: 'stand', x: 0, y: 0, facing: 0 });
  }
  const all = boxes.map((b) => b.b);
  const cx = (Math.min(...all.map((b) => b[0])) + Math.max(...all.map((b) => b[3]))) / 2;
  const cy = (Math.min(...all.map((b) => b[1])) + Math.max(...all.map((b) => b[4]))) / 2;
  for (const bx of boxes) pushBox(s, [bx.b[0] - cx, bx.b[1] - cy, bx.b[2], bx.b[3] - cx, bx.b[4] - cy, bx.b[5]], bx.c, { g: luz });
  return s;
}

// La puerta del hotel, en la pared de delante, a la altura del rellano
function puertaHotel(a, b, ix, iy) {
  const x = CW - a;
  const z0 = RELLANO.z;
  if (x < 6.7 || x > 9.3 || b < z0 || b > z0 + 3.1) return null;
  const r = probe();
  const walnut = r.rampOf(WALNUT);
  const gold = r.rampOf(GOLD);
  const g = glowAt(x, CD - 0.3, b);
  const u = x - 6.7;
  const v = b - z0;
  if (u < 0.12 || u > 2.48 || v > 2.98) return lit(gold[3], g, ix, iy);
  if (Math.abs(u - 1.3) < 0.03) return lit(gold[2], g, ix, iy);
  // Ojos de buey en cada hoja, con la luz de la recepción al otro lado
  for (const cx of [0.7, 1.9]) if (Math.hypot(u - cx, v - 2.1) < 0.28) return Math.hypot(u - cx, v - 2.1) > 0.23 ? lit(gold[4], g, ix, iy) : rgb(250, 226, 170);
  if (Math.abs(v - 1.05) < 0.03 && (u < 1.2 || u > 1.4)) return lit(gold[3], g, ix, iy);
  return lit(walnut[(Math.floor(u / 0.3) % 2 ? 2 : 3)], g, ix, iy);
}

// ── 1.108 · Las cartas-página de «Las 21 páginas», en píxeles: papel crema con su filete, el signo en la esquina (y del
// revés en la de abajo) y el palo grande en el centro; el dorso, granate con rombos dorados ──
const CARTA_W = 20;
const CARTA_H = 28;
const GLIFOS = {
  0: ['###', '#.#', '#.#', '#.#', '###'],
  1: ['.#.', '##.', '.#.', '.#.', '###'],
  2: ['###', '..#', '###', '#..', '###'],
  3: ['###', '..#', '.##', '..#', '###'],
  4: ['#.#', '#.#', '###', '..#', '..#'],
  5: ['###', '#..', '###', '..#', '###'],
  6: ['###', '#..', '###', '#.#', '###'],
  7: ['###', '..#', '.#.', '.#.', '.#.'],
  8: ['###', '#.#', '###', '#.#', '###'],
  9: ['###', '#.#', '###', '..#', '###'],
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  J: ['..#', '..#', '..#', '#.#', '.#.'],
  Q: ['.#.', '#.#', '#.#', '##.', '.##'],
  K: ['#.#', '##.', '#..', '##.', '#.#'],
};
const PALOS_PX = {
  picas: ['....#....', '...###...', '..#####..', '.#######.', '#########', '#########', '.##.#.##.', '....#....', '...###...'],
  corazones: ['.........', '.##...##.', '####.####', '#########', '#########', '.#######.', '..#####..', '...###...', '....#....'],
  tréboles: ['...###...', '..#####..', '..#####..', '##.###.##', '#########', '##.###.##', '....#....', '...###...', '.........'],
  diamantes: ['....#....', '...###...', '..#####..', '.#######.', '#########', '.#######.', '..#####..', '...###...', '....#....'],
};
const PALOS_ORDEN = ['picas', 'corazones', 'tréboles', 'diamantes'];
const FIGURAS_PX = { 0: 'A', 10: 'J', 11: 'Q', 12: 'K' };
const PAPEL = [246, 236, 212];
const TINTA = [36, 30, 40];
const ROJO_CARTA = [178, 36, 48];
/** Una carta del servidor (0–51), o el dorso (`null`), pintada en píxeles. */
function paintCarta(c) {
  if (c == null) {
    return canvasOf(CARTA_W, CARTA_H, (x, y) => {
      if (x === 0 || y === 0 || x === CARTA_W - 1 || y === CARTA_H - 1) return rgb(...TINTA);
      if (x === 1 || y === 1 || x === CARTA_W - 2 || y === CARTA_H - 2) return rgb(...GOLD);
      const d = (Math.abs(((x - 2) % 6) - 3) + Math.abs(((y - 2) % 6) - 3)) | 0;
      if (d === 3) return rgb(...GOLD_D);
      return rgb(...(d < 2 ? [150, 34, 50] : [118, 24, 38]));
    });
  }
  const v = c % 13;
  const palo = PALOS_ORDEN[Math.floor(c / 13)];
  const tinta = palo === 'corazones' || palo === 'diamantes' ? ROJO_CARTA : TINTA;
  const signo = FIGURAS_PX[v] ?? String(v + 1);
  const on = new Set();
  const glifo = (ch, ox, oy, rot) =>
    GLIFOS[ch].forEach((row, gy) =>
      [...row].forEach((b, gx) => {
        if (b !== '#') return;
        on.add(rot ? `${ox + 2 - gx},${oy + 4 - gy}` : `${ox + gx},${oy + gy}`);
      }),
    );
  // El signo arriba a la izquierda y, del revés, abajo a la derecha («10» va con sus dos cifras juntas)
  const chars = [...signo];
  const gw = chars.length * 4 - 1;
  chars.forEach((ch, k) => glifo(ch, 2 + k * 4, 2, false));
  chars.forEach((ch, k) => glifo(ch, CARTA_W - 3 - gw + (chars.length - 1 - k) * 4, CARTA_H - 7, true));
  // El palo grande en el centro; en las figuras, dentro de un marco dorado
  const pip = PALOS_PX[palo];
  const px0 = Math.floor((CARTA_W - 9) / 2);
  const py0 = Math.floor((CARTA_H - 9) / 2);
  pip.forEach((row, gy) => [...row].forEach((b, gx) => b === '#' && on.add(`${px0 + gx},${py0 + gy}`)));
  const figura = v >= 10;
  return canvasOf(CARTA_W, CARTA_H, (x, y) => {
    if (x === 0 || y === 0 || x === CARTA_W - 1 || y === CARTA_H - 1) return rgb(...TINTA);
    if (on.has(`${x},${y}`)) return rgb(...tinta);
    if (figura && (x === px0 - 2 || x === px0 + 10) && y >= py0 - 2 && y <= py0 + 10) return rgb(...GOLD_D);
    if (figura && (y === py0 - 2 || y === py0 + 10) && x >= px0 - 2 && x <= px0 + 10) return rgb(...GOLD_D);
    // Papel con un grano leve y un poco más oscuro hacia el borde
    const borde = x === 1 || y === 1 || x === CARTA_W - 2 || y === CARTA_H - 2;
    const k = (borde ? 0.92 : 1) - (hash(x, y) % 7 === 0 ? 0.04 : 0);
    return rgb(PAPEL[0] * k, PAPEL[1] * k, PAPEL[2] * k);
  });
}

/** Dónde se juega en la mesa: quien juega en el taburete del medio, mirando al crupier (−x). */
const ASIENTO = { x: MESA.x1 + 0.5, y: 7.5, z: 1.95, mira: [MESA.x0 + 0.75, 7.5, MESA.alto] };
/**
 * En la mesa para dos: el amigo, en un taburete en la punta de la media luna, mirando al paño; y la cámara, más atrás y
 * en diagonal, con el crupier y el amigo a la vista.
 */
const ASIENTO_AMIGO = [2.2, 5.85];
const AMIGO_MIRA = Math.atan2(2.2 - ASIENTO_AMIGO[0], 7.5 - ASIENTO_AMIGO[1]);
const ASIENTO_PAREJA = { x: 4.4, y: 8.6, z: 2.15, mira: [1.9, 6.9, MESA.alto] };
/** 1.109 · Delante de la ruleta: de pie, de frente a la rueda, con la rueda entera y su flecha a la vista. */
const ANTE_RUEDA = { x: RUEDA.x, y: 6.75, z: 3.35, mira: [RUEDA.x, RUEDA.y, 3.15] };
/** 1.111 · Delante de la vitrina: de pie, frente a uno de sus tres armarios (la cámara se desliza de uno a otro). */
const ANTE_VITRINA = { x: VITRINA.x0 - 1.75, z: 1.85, mira: [VITRINA.x0 + 0.5, 1.62] };
/** Las baldas de cada armario: dónde apoya cada una y cuánto alto cabe. */
const BALDAS = [
  [0.82, 0.56],
  [1.45, 0.5],
  [2.05, 0.42],
];
const armarioY = (k) => (VITRINA.armarios[k][0] + VITRINA.armarios[k][1]) / 2;
/** 1.110 · Delante de la mesa de las chisteras: de pie, un poco por encima, con las tres chisteras y el conejo a la vista. */
const ANTE_CHISTERAS = { x: CHISTERAS.x - 2.45, y: CHISTERAS.y, z: 2.5, mira: [CHISTERAS.x + 0.1, CHISTERAS.y, CHISTERAS.alto] };
/** Lo que tarda el giro (ms): cinco vueltas y una frenada larga, siempre igual. */
const GIRO_MS = 5200;
const CARTA = { w: 0.4, h: 0.58 };
const FILA_CRUPIER = MESA.x0 + 0.5;
const FILA_TUYA = MESA.x0 + 1.25;
const SABOT = [MESA.x0 + 0.26, 8.12, MESA.alto + 0.2];
const FICHAS_EN = [MESA.x1 - 0.35, 7.15];
const FICHA_COLORES = [CARPET, [40, 90, 160], GOLD, BLANCO, [30, 30, 34]];
const easeOut = (t) => 1 - (1 - t) ** 3;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

// ── 1.109 · El mapache crupier, tu compañero (si lo llevas): en volúmenes, te sigue por la sala ──
/** Por dónde puede andar el mapache: la sala, sin meterse en la barra, las mesas, la caja, la vitrina ni las columnas. */
function libreMascota(x, y) {
  if (x < 0.4 || x > CW - 0.4 || y < 0.4 || y > CD - 0.4) return false;
  if (x < BARRA.x1 + 0.3 && y < BARRA.y1 + 0.3) return false;
  if (x > MESA.x0 - 0.9 && x < MESA.x1 + 0.3 && y > MESA.y0 - 0.3 && y < MESA.y1 + 0.3) return false;
  if (Math.hypot(x - CHISTERAS.x, y - CHISTERAS.y) < CHISTERAS.r + 0.25) return false;
  if (x < CAJA.x1 + 0.3 && y > CAJA.y0 - 0.3 && y < CAJA.y1 + 0.3) return false;
  if (x > VITRINA.x0 - 0.4) return false;
  const [t0x, t0y, t1x, t1y] = RUEDA.tarima;
  if (x > t0x - 0.2 && x < t1x + 0.2 && y > t0y && y < t1y + 0.2) return false;
  if (COLUMNAS.some(([cx, cy]) => Math.hypot(x - cx, y - cy) < 0.75)) return false;
  // Bajo el rellano, solo la escalera
  if (y > ESCALERA.y0 && y < RELLANO.y0 && (x < ESCALERA.x0 + 0.3 || x > ESCALERA.x1 - 0.3)) return false;
  return true;
}
/** La altura del suelo en (x, y): la sala, la escalera o el rellano. */
function sueloEn(x, y) {
  if (y >= RELLANO.y0) return RELLANO.z;
  if (y > ESCALERA.y0 && x > ESCALERA.x0 && x < ESCALERA.x1) return ((y - ESCALERA.y0) / (RELLANO.y0 - ESCALERA.y0)) * RELLANO.z;
  return 0;
}
// ── 1.111 · Lo que se expone en la vitrina: cada premio como una lista de cajas { b, c } con el frente hacia +y y la base
// en z = 0 (como los muebles de furniture.js); la escena lo encaja en su hueco de la balda y lo gira de cara a la sala ──
const ORO = [222, 178, 74];
const PLATA = [196, 200, 206];
const BRONCE = [176, 112, 62];
const ORO_ROSA = [232, 160, 128];
const TERCIOPELO = [120, 22, 40];
/** Cada hito, de menos a más: bronce, plata, oro y oro con su gema. */
const METAL_HITO = [BRONCE, PLATA, ORO, ORO_ROSA];
const C = (b, c) => ({ b, c });
/** Una copa de «Las 21 páginas»: peana, pie, copa y asas. */
function copa21(m, gema) {
  const o = [
    C([-0.12, -0.12, 0, 0.12, 0.12, 0.05], [44, 30, 26]),
    C([-0.03, -0.03, 0.05, 0.03, 0.03, 0.17], m),
    // La copa, más ancha según sube, con su borde y dos asas altas
    C([-0.045, -0.045, 0.17, 0.045, 0.045, 0.21], m),
    C([-0.07, -0.07, 0.21, 0.07, 0.07, 0.26], m),
    C([-0.09, -0.09, 0.26, 0.09, 0.09, 0.33], m),
    C([-0.1, -0.1, 0.33, 0.1, 0.1, 0.35], m),
    C([-0.13, -0.02, 0.22, -0.11, 0.02, 0.32], m),
    C([-0.12, -0.02, 0.22, -0.07, 0.02, 0.24], m),
    C([0.11, -0.02, 0.22, 0.13, 0.02, 0.32], m),
    C([0.07, -0.02, 0.22, 0.12, 0.02, 0.24], m),
    // Un naipe grabado en el frente
    C([-0.03, 0.09, 0.25, 0.03, 0.095, 0.32], [240, 230, 210]),
  ];
  if (gema) o.push(C([-0.015, 0.095, 0.275, 0.015, 0.1, 0.295], [190, 30, 60]));
  return o;
}
/** Una medalla de la ruleta en su atril: un disco con la rueda grabada. */
function medallaRuleta(m, gema) {
  const o = [C([-0.12, -0.08, 0, 0.12, 0.06, 0.04], [44, 30, 26]), C([-0.02, -0.06, 0.04, 0.02, -0.02, 0.24], [44, 30, 26])];
  const r = 0.13;
  for (let k = 0; k < 7; k += 1) {
    const z = 0.06 + ((k + 0.5) / 7) * 2 * r;
    const w = r * Math.sqrt(Math.max(0, 1 - ((z - 0.06 - r) / r) ** 2));
    o.push(C([-w, -0.02, z - r / 7, w, 0.02, z + r / 7], m));
  }
  o.push(C([-0.06, 0.02, 0.13, 0.06, 0.025, 0.25], m === PLATA ? [150, 30, 50] : [30, 90, 60]));
  o.push(C([-0.015, 0.025, 0.18, 0.015, 0.03, 0.21], gema ? [190, 30, 60] : [240, 230, 210]));
  return o;
}
/** Una chistera de oro en su peana, con una estrella. */
function chisteraHito(m, gema) {
  return [
    C([-0.12, -0.12, 0, 0.12, 0.12, 0.05], [44, 30, 26]),
    C([-0.11, -0.11, 0.05, 0.11, 0.11, 0.07], m),
    C([-0.07, -0.07, 0.07, 0.07, 0.07, 0.26], m),
    C([-0.072, -0.072, 0.09, 0.072, 0.072, 0.12], [150, 30, 50]),
    C([-0.02, 0.07, 0.16, 0.02, 0.075, 0.2], gema ? [190, 30, 60] : [255, 240, 190]),
  ];
}
/** El conejo de la chistera, sentado en su chistera (como el de la mesa, mirando al frente). */
function conejoVitrina() {
  const w = BLANCO;
  const rosa = [236, 160, 176];
  return [
    C([-0.16, -0.16, 0, 0.16, 0.16, 0.03], [24, 22, 28]),
    C([-0.11, -0.11, 0.03, 0.11, 0.11, 0.26], [24, 22, 28]),
    C([-0.112, -0.112, 0.06, 0.112, 0.112, 0.1], [150, 30, 50]),
    C([-0.14, -0.12, 0.26, 0.14, 0.16, 0.46], w),
    C([-0.1, -0.06, 0.46, 0.1, 0.12, 0.6], w),
    ...[-1, 1].flatMap((sg) => [
      C([sg * 0.06 - 0.03, 0.01, 0.6, sg * 0.06 + 0.03, 0.06, 0.8], w),
      C([sg * 0.06 - 0.015, 0.06, 0.64, sg * 0.06 + 0.015, 0.065, 0.77], rosa),
      C([sg * 0.04 - 0.015, 0.12, 0.52, sg * 0.04 + 0.015, 0.125, 0.55], [30, 30, 34]),
    ]),
    C([-0.015, 0.12, 0.49, 0.015, 0.13, 0.51], rosa),
  ];
}
/** El mapache crupier, quieto con su ficha en la mano. */
function mapacheVitrina() {
  const [px, py, pz] = MAPACHE.pivoteCola;
  const mover = (bs, [ox, oy, oz]) => bs.map(({ b, c }) => C([b[0] + ox, b[1] + oy, b[2] + oz, b[3] + ox, b[4] + oy, b[5] + oz], c));
  return [...MAPACHE.cuerpo, ...mover(MAPACHE.cola, [px, py, pz]), ...mover(MAPACHE.ficha, [0.18, 0.24, 0.3])];
}
/** Una prenda, puesta en una figurita sobre su peana. */
function figuritaVitrina(id) {
  const [k, v] = id.split(':');
  const avatar = { ...DEFAULT_AVATAR, [k]: k === 'complemento' ? v : Number(v) };
  let boxes = [];
  try {
    boxes = actorBoxes(avatar, { pose: 'stand', x: 0, y: 0, facing: 0 });
  } catch {
    boxes = actorBoxes(DEFAULT_AVATAR, { pose: 'stand', x: 0, y: 0, facing: 0 });
  }
  return [C([-0.3, -0.3, -0.08, 0.3, 0.3, 0], [44, 30, 26]), C([-0.32, -0.32, -0.1, 0.32, 0.32, -0.08], ORO), ...boxes.map((x) => C(x.b, x.c))];
}
/** Las fichas, en pilas de colores: crecen con las que tienes (hasta cinco pilas de diez). */
function pilaFichas(n) {
  const fichas = Math.min(50, Math.max(1, Math.ceil(n / 15)));
  const colores = [CARPET, [40, 90, 160], GOLD, BLANCO, [30, 30, 34]];
  const o = [C([-0.24, -0.16, 0, 0.24, 0.16, 0.02], [30, 90, 60])];
  const sitios = [[-0.13, -0.05], [0, 0.04], [0.13, -0.05], [-0.07, 0.08], [0.07, -0.09]];
  for (let i = 0; i < fichas; i += 1) {
    const [x, y] = sitios[i % 5];
    const z = 0.02 + Math.floor(i / 5) * 0.026;
    o.push(C([x - 0.055, y - 0.055, z, x + 0.055, y + 0.055, z + 0.022], colores[i % 5]));
    o.push(C([x - 0.02, y - 0.056, z + 0.006, x + 0.02, y + 0.056, z + 0.016], BLANCO));
  }
  return o;
}
/** Los garbanzos, en un cuenco de latón: el montón crece con los que tienes. */
function pilaGarbanzos(n) {
  const o = [C([-0.17, -0.17, 0, 0.17, 0.17, 0.03], GOLD_D), C([-0.2, -0.2, 0.03, 0.2, 0.2, 0.12], GOLD)];
  const capas = Math.min(6, Math.max(1, Math.ceil(n / 120)));
  for (let k = 0; k < capas; k += 1) {
    const r = 0.17 - k * 0.025;
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2 + k;
      const x = Math.cos(a) * r * 0.6;
      const y = Math.sin(a) * r * 0.6;
      const z = 0.1 + k * 0.035;
      o.push(C([x - 0.035, y - 0.035, z, x + 0.035, y + 0.035, z + 0.04], i % 2 ? [222, 186, 118] : [206, 168, 100]));
    }
  }
  return o;
}
// ── 1.112 · Los premios nuevos que no son un mueble de pie ni una prenda que se vea bien en la figurita ──
const COJIN = [104, 24, 42];
/** Un cojín de terciopelo con su borla, para lo pequeño (el reloj y la varita). */
const cojin = () => [
  C([-0.2, -0.16, 0, 0.2, 0.16, 0.06], COJIN),
  C([-0.17, -0.13, 0.06, 0.17, 0.13, 0.08], [128, 34, 54]),
  ...[[-0.2, -0.16], [0.17, -0.16], [-0.2, 0.13], [0.17, 0.13]].map(([x, y]) => C([x, y, 0, x + 0.03, y + 0.03, 0.08], ORO)),
];
/** La alfombra de rombos, enrollada a medias: el rollo detrás y lo desenrollado delante, con su rombo dorado. */
function alfombraVitrina() {
  const T = COJIN;
  const o = [];
  // El rollo: un cilindro tumbado de lado a lado, con la espiral dorada en las puntas
  for (let k = 0; k < 7; k += 1) {
    const z = ((k + 0.5) / 7) * 0.22;
    const h = Math.sqrt(Math.max(0, 0.11 * 0.11 - (z - 0.11) ** 2));
    o.push(C([-0.42, -0.2 - h, z - 0.016, 0.42, -0.2 + h, z + 0.016], k % 3 === 1 ? [138, 36, 56] : T));
  }
  o.push(C([-0.425, -0.24, 0.07, 0.425, -0.16, 0.15], ORO));
  // Lo desenrollado: la lana, el ribete y un rombo
  o.push(C([-0.42, -0.2, 0, 0.42, 0.26, 0.02], T));
  o.push(C([-0.38, 0.2, 0.02, 0.38, 0.23, 0.025], ORO), C([-0.38, -0.12, 0.02, -0.35, 0.23, 0.025], ORO), C([0.35, -0.12, 0.02, 0.38, 0.23, 0.025], ORO));
  for (let k = -3; k <= 3; k += 1) {
    const w = 0.16 * (1 - Math.abs(k) / 4);
    o.push(C([-w, 0.04 + k * 0.025, 0.02, w, 0.065 + k * 0.025, 0.026], Math.abs(k) < 2 ? [190, 70, 90] : ORO));
  }
  for (let k = 0; k < 8; k += 1) o.push(C([-0.4 + k * 0.105, 0.26, 0, -0.37 + k * 0.105, 0.3, 0.012], k % 2 ? ORO : BLANCO));
  return o;
}
/** El reloj de bolsillo, de pie sobre su cojín, con la tapa abierta y la cadena enroscada. */
function relojVitrina() {
  const o = cojin();
  const r = 0.11;
  for (let k = 0; k < 7; k += 1) {
    const z = 0.1 + ((k + 0.5) / 7) * 2 * r;
    const w = r * Math.sqrt(Math.max(0, 1 - ((z - 0.1 - r) / r) ** 2));
    o.push(C([-w, -0.02, z - r / 7, w, 0.02, z + r / 7], ORO));
    if (w > 0.03) o.push(C([-w + 0.02, 0.02, z - r / 7, w - 0.02, 0.025, z + r / 7], [244, 236, 214]));
  }
  o.push(C([-0.006, 0.025, 0.2, 0.006, 0.03, 0.29], [40, 34, 40]), C([0, 0.025, 0.205, 0.06, 0.03, 0.215], [40, 34, 40]));
  o.push(C([-0.02, -0.02, 0.32, 0.02, 0.02, 0.35], ORO), C([-0.03, -0.01, 0.35, 0.03, 0.01, 0.37], ORO));
  // La tapa, abierta hacia atrás, y la cadena por el cojín
  o.push(C([-0.09, -0.07, 0.12, 0.09, -0.05, 0.3], [200, 156, 64]));
  for (let k = 0; k < 6; k += 1) o.push(C([0.04 + k * 0.022, 0.04 - (k % 2) * 0.03, 0.08, 0.06 + k * 0.022, 0.06 - (k % 2) * 0.03, 0.095], ORO));
  return o;
}
/** La varita, tumbada sobre su cojín, con la punta de marfil y su chispa. */
function varitaVitrina() {
  return [
    ...cojin(),
    C([-0.17, -0.015, 0.08, 0.12, 0.015, 0.11], [30, 24, 30]),
    C([-0.19, -0.02, 0.075, -0.15, 0.02, 0.115], ORO),
    C([0.12, -0.018, 0.08, 0.18, 0.018, 0.112], [244, 236, 214]),
    C([0.19, -0.02, 0.13, 0.23, 0.02, 0.17], [255, 226, 140]),
    C([0.2, -0.008, 0.1, 0.22, 0.008, 0.2], [255, 226, 140]),
  ];
}
/** «Polvo de estrellas»: un frasco de cristal con el polvo añil y dorado, su corcho y su etiqueta. */
function frascoPolvo() {
  const vidrio = [196, 206, 232];
  const o = [C([-0.14, -0.14, 0, 0.14, 0.14, 0.03], [44, 30, 26])];
  o.push(C([-0.1, -0.1, 0.03, 0.1, 0.1, 0.26], vidrio), C([-0.06, -0.06, 0.26, 0.06, 0.06, 0.31], vidrio), C([-0.045, -0.045, 0.31, 0.045, 0.045, 0.36], [170, 120, 74]));
  // El polvo, por dentro (se ve por el frente), y las chispas
  o.push(C([-0.09, 0.098, 0.04, 0.09, 0.102, 0.18], [60, 48, 134]), C([-0.09, 0.098, 0.12, 0.09, 0.103, 0.18], [120, 96, 210]));
  for (const [x, z] of [[-0.05, 0.08], [0.04, 0.13], [-0.02, 0.16], [0.06, 0.06], [-0.07, 0.15]]) o.push(C([x - 0.012, 0.1, z - 0.012, x + 0.012, 0.106, z + 0.012], [255, 233, 168]));
  o.push(C([-0.07, 0.1, 0.2, 0.07, 0.105, 0.24], [236, 224, 196]));
  for (const [x, z] of [[-0.12, 0.34], [0.12, 0.3], [0.02, 0.42]]) o.push(C([x - 0.015, -0.015, z - 0.015, x + 0.015, 0.015, z + 0.015], [255, 233, 168]));
  return o;
}
/** Las cajas de un premio de la vitrina (sin encajar). */
function cajasPremio(p, { fichas = 0, garbanzos = 0 } = {}) {
  if (p.tipo === 'copa') {
    // De menos a más dentro de su juego: bronce, plata, oro y oro con gema
    const i = HITOS.filter((h) => h.juego === p.juego).findIndex((h) => h.id === p.id);
    const f = { chisteras: chisteraHito, ruleta: medallaRuleta, 21: copa21 }[p.juego];
    return f(METAL_HITO[i], i === 3);
  }
  if (p.id === 'alfombra-rombos') return alfombraVitrina();
  if (p.id === 'complemento:reloj-bolsillo') return relojVitrina();
  if (p.id === 'complemento:varita') return varitaVitrina();
  if (p.id === 'acabado:polvo-estrellas') return frascoPolvo();
  if (p.id === 'fichas') return pilaFichas(fichas);
  if (p.id === 'garbanzos') return pilaGarbanzos(garbanzos);
  if (p.tipo === 'prenda') return figuritaVitrina(p.id);
  if (p.id === 'conejo-chistera') return conejoVitrina();
  if (p.id === 'mapache-crupier') return mapacheVitrina();
  const tono = catalogItem(p.id)?.tonos?.[0];
  return shapeOf(p.id, tono).map((x) => C(x.b, x.c));
}
/** Encaja unas cajas en un hueco de `ancho` × `fondo` × `alto`: centradas, con la base en 0 y sin pasar de `max` de escala. */
function encajar(boxes, ancho, fondo, alto, max = 0.62) {
  const all = boxes.map((x) => x.b);
  const x0 = Math.min(...all.map((b) => b[0]));
  const x1 = Math.max(...all.map((b) => b[3]));
  const y0 = Math.min(...all.map((b) => b[1]));
  const y1 = Math.max(...all.map((b) => b[4]));
  const z0 = Math.min(...all.map((b) => b[2]));
  const z1 = Math.max(...all.map((b) => b[5]));
  const k = Math.min(max, ancho / (x1 - x0), fondo / (y1 - y0), alto / (z1 - z0));
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  return {
    boxes: boxes.map(({ b, c }) => C([(b[0] - cx) * k, (b[1] - cy) * k, (b[2] - z0) * k, (b[3] - cx) * k, (b[4] - cy) * k, (b[5] - z0) * k], c)),
    medida: [(x1 - x0) * k, (y1 - y0) * k, (z1 - z0) * k],
  };
}
/** El paño de terciopelo que tapa lo que aún no tienes: cae sobre su silueta, con flecos dorados y su plaquita. */
function pano([w, d, h]) {
  const a = Math.max(0.16, w / 2 + 0.03);
  const b = Math.max(0.12, d / 2 + 0.03);
  const z = Math.max(0.14, h + 0.03);
  return [
    C([-a, -b, 0.03, a, b, z * 0.82], TERCIOPELO),
    C([-a * 0.82, -b * 0.82, z * 0.82, a * 0.82, b * 0.82, z], [134, 28, 48]),
    C([-a - 0.012, -b - 0.012, 0, a + 0.012, b + 0.012, 0.035], GOLD),
    // La plaquita de latón, delante
    C([-0.06, b + 0.012, 0.005, 0.06, b + 0.02, 0.04], GOLD_D),
  ];
}

function mapacheKits(g) {
  const una = (boxes, [ox, oy, oz] = [0, 0, 0]) => {
    const s = kit();
    for (const { b, c } of boxes) pushBox(s, [b[0] - ox, b[1] - oy, b[2] - oz, b[3] - ox, b[4] - oy, b[5] - oz], c, { g });
    return s;
  };
  return { cuerpo: una(MAPACHE.cuerpo), cola: una(MAPACHE.cola), ficha: una(MAPACHE.ficha), parpados: MAPACHE.parpados.map((p) => una([p])) };
}

export function mountCasino(container, { onPick = () => {}, onFrame = () => {}, onLost = () => {}, onMove = () => {}, onChistera = () => {}, onPremio = () => {}, companero = null } = {}) {
  const renderer = new WebGLRenderer({ antialias: false, powerPreference: 'low-power', preserveDrawingBuffer: true });
  const canvas = renderer.domElement;
  canvas.className = 'cs3-canvas';
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'El casino del sótano. Arrastra o usa las flechas para mirar; toca el suelo para andar y una mesa para jugar.');
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x1a1020);

  const scene = new Scene();
  const camera = new PerspectiveCamera(70, 1, 0.08, 60);
  const owned = [];
  const own = (x) => (owned.push(x), x);
  const flat = own(new MeshBasicMaterial({ vertexColors: true }));
  const hidden = own(new MeshBasicMaterial({ visible: false }));
  const plane = (w, h, tex, place, { cut = false, glow = false } = {}) => {
    const mat = glow ? new MeshBasicMaterial({ map: own(texture(tex)), transparent: true, depthWrite: false }) : new MeshBasicMaterial({ map: own(texture(tex)), alphaTest: cut ? 0.5 : 0 });
    const mesh = new Mesh(own(new PlaneGeometry(w, h)), own(mat));
    place(mesh);
    scene.add(mesh);
    return mesh;
  };

  // ── La sala: suelo, techo y las cuatro paredes ──
  plane(CW, CD, paintFloor(), (m) => {
    m.rotation.x = -Math.PI / 2;
    m.position.set(CW / 2, 0, CD / 2);
  });
  plane(CW, CD, paintCeiling(), (m) => {
    m.rotation.x = Math.PI / 2;
    m.position.set(CW / 2, CH, CD / 2);
  });
  // Fondo (y = 0): el abanico de rayos detrás de la ruleta
  plane(
    CW,
    CH,
    paintWall(CW, (a, b) => [a, 0.05, b], rayosRuleta),
    (m) => m.position.set(CW / 2, CH / 2, 0),
  );
  // Izquierda (x = 0, mira a +x)
  plane(
    CD,
    CH,
    paintWall(CD, (a, b) => [0.05, CD - a, b]),
    (m) => {
      m.rotation.y = Math.PI / 2;
      m.position.set(0, CH / 2, CD / 2);
    },
  );
  // Derecha (x = CW, mira a −x)
  plane(
    CD,
    CH,
    paintWall(CD, (a, b) => [CW - 0.05, a, b]),
    (m) => {
      m.rotation.y = -Math.PI / 2;
      m.position.set(CW, CH / 2, CD / 2);
    },
  );
  // Delante (y = CD, mira a −y): la puerta por la que se baja del hotel
  plane(
    CW,
    CH,
    paintWall(CW, (a, b) => [CW - a, CD - 0.05, b], puertaHotel),
    (m) => {
      m.rotation.y = Math.PI;
      m.position.set(CW / 2, CH / 2, CD);
    },
  );
  {
    const glass = kit();
    scene.add(new Mesh(own(geometryOf(buildSala(glass))), flat));
    scene.add(new Mesh(own(geometryOf(glass)), own(new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.28, depthWrite: false }))));
  }
  scene.add(new Mesh(own(geometryOf(buildMesa())), flat));
  scene.add(new Mesh(own(geometryOf(buildRuleta())), flat));
  scene.add(new Mesh(own(geometryOf(buildChisteras())), flat));
  scene.add(new Mesh(own(geometryOf(buildCaja())), flat));

  // ── 1.111 · Lo de la vitrina: cada premio en su hueco (lo ganado, encendido; lo que falta, bajo su paño) ──
  const vitrinaGrupo = new Group();
  scene.add(vitrinaGrupo);
  const enVitrina = new Map(); // id → { mesh, picker, giro }
  let vitSel = null;
  let vitGiro = 0;
  function ponerVitrina(datos) {
    for (const { mesh, picker } of enVitrina.values()) {
      mesh.geometry.dispose();
      picker.geometry.dispose();
    }
    enVitrina.clear();
    vitrinaGrupo.clear();
    const tienes = new Set([...(datos?.tienes ?? []), ...(datos?.hitos ?? [])]);
    const fondo = VITRINA.x1 - 0.12 - (VITRINA.x0 + 0.06);
    const xc = (VITRINA.x0 + 0.06 + VITRINA.x1 - 0.12) / 2;
    ARMARIOS.forEach((armario, k) => {
      const [ya, yb] = VITRINA.armarios[k];
      armario.baldas.forEach((balda, n) => {
        const [z0, alto] = BALDAS[n];
        const ancho = (yb - ya - 0.2) / balda.length;
        balda.forEach((p, i) => {
          const yc = ya + 0.1 + (i + 0.5) * ancho;
          // Las pilas siempre están (con lo que haya); lo demás, si lo tienes
          const visto = Boolean(datos) && (p.tipo === 'pila' || tienes.has(p.id));
          const fit = encajar(cajasPremio(p, datos ?? {}), ancho * 0.84, Math.min(0.62, fondo * 0.7), alto * 0.9, p.tipo === 'copa' ? 1.2 : p.tipo === 'mueble' ? 0.42 : 0.62);
          const boxes = visto ? fit.boxes : pano(fit.medida);
          const s = kit();
          const g = glowAt(xc, yc, z0 + 0.2) + (visto ? 0.32 : 0.1);
          for (const { b, c } of boxes) pushBox(s, b, c, { g: Math.min(1, g) });
          const mesh = new Mesh(geometryOf(s), flat);
          // El frente (+y de las cajas) mira a la sala (−x); el conejo, como el de la mesa, ya mira así
          const giro = -Math.PI / 2;
          mesh.position.set(xc - 0.05, z0, yc);
          mesh.rotation.y = giro;
          vitrinaGrupo.add(mesh);
          const picker = new Mesh(new BoxGeometry(0.6, alto, ancho), hidden);
          picker.position.set(xc, z0 + alto / 2, yc);
          picker.userData.premio = p.id;
          vitrinaGrupo.add(picker);
          enVitrina.set(p.id, { mesh, picker, giro, visto, x: xc - 0.05 });
        });
      });
    });
    vitSel = null;
    invalidate();
  }

  // ── 1.110 · Las tres chisteras y el conejo, aparte: son los que se mueven ──
  const gChis = glowAt(CHISTERAS.x, CHISTERAS.y, 1);
  const chisGeo = own(geometryOf(kitChistera(gChis)));
  const sombreros = [0, 1, 2].map(() => {
    const m = new Mesh(chisGeo, flat);
    scene.add(m);
    return m;
  });
  const conejo = new Mesh(own(geometryOf(kitConejo(gChis))), flat);
  scene.add(conejo);
  // Qué chistera hay en cada sitio (son iguales: lo que cuenta es dónde está cada una), cuánto está levantada la de cada
  // sitio y dónde está el conejo
  const enSitio = [...sombreros];
  const alzada = [0, 0, 0];
  const conejoEn = [...CONEJO_CASA];
  const ponSombrero = (m, x, y, z = 0, inclina = 0) => {
    m.position.set(x, CHISTERAS.alto + z, y);
    m.rotation.z = inclina;
  };
  const alzar = (k, a) => {
    alzada[k] = a;
    ponSombrero(enSitio[k], SITIO_X, SITIO_Y[k], ALZA * a, INCLINA * a);
  };
  const ponConejo = (x, y, z = 0) => {
    conejoEn[0] = x;
    conejoEn[1] = y;
    conejo.position.set(x, CHISTERAS.alto + z, y);
  };
  enSitio.forEach((_, k) => alzar(k, 0));
  ponConejo(...CONEJO_CASA);
  // El juego en marcha: una lista de pasos ({ ms, r: ms con movimiento reducido, empieza(), at(t), fin(), resuelve }) que
  // se van cumpliendo uno detrás de otro; `done` se llama al acabar el paso que `resuelve` (o al final)
  let juego = null;
  let eligiendo = false;
  function pasoJuego(now) {
    while (juego) {
      const p = juego.pasos[juego.i];
      if (!p) {
        const done = juego.done;
        juego = null;
        done?.();
        return false;
      }
      if (juego.t0 == null) {
        juego.t0 = now;
        p.empieza?.();
      }
      const dur = reduced() ? (p.r ?? 0) : p.ms;
      const t = dur ? Math.min(1, (now - juego.t0) / dur) : 1;
      p.at?.(t);
      if (t < 1) return true;
      p.fin?.();
      if (p.resuelve && juego.done) {
        juego.done();
        juego.done = null;
      }
      juego.i += 1;
      juego.t0 = null;
    }
    return false;
  }
  const pausa = (ms, r = ms) => ({ ms, r });
  /** Bajar lo que esté levantado y que el conejo vuelva a su sitio, saltando. */
  function pasosRecoger() {
    const pasos = [];
    if (alzada.some((a) => a > 0)) {
      const de = [...alzada];
      pasos.push({ ms: 320, r: 0, at: (t) => de.forEach((a, k) => a > 0 && alzar(k, a * (1 - ease(t)))), fin: () => (conejo.visible = true) });
    }
    if (Math.hypot(conejoEn[0] - CONEJO_CASA[0], conejoEn[1] - CONEJO_CASA[1]) > 0.01) {
      let de = null;
      pasos.push({
        ms: 520,
        r: 0,
        empieza: () => {
          de = [...conejoEn];
          conejo.visible = true;
        },
        at: (t) => ponConejo(lerp(de[0], CONEJO_CASA[0], ease(t)), lerp(de[1], CONEJO_CASA[1], ease(t)), reduced() ? 0 : Math.sin(Math.PI * t) * 0.38),
      });
    }
    return pasos;
  }
  /** Un cambio: las dos chisteras se cruzan, una por delante y otra por detrás (sin chocar con la del medio). */
  function pasoCambio(k, ms, onCambio) {
    const [a, b] = PARES[k];
    let ma = null;
    let mb = null;
    const lejos = b - a === 2 ? 0.48 : 0.3;
    return {
      ms,
      r: PASO_MS,
      empieza: () => {
        ma = enSitio[a];
        mb = enSitio[b];
        onCambio?.(k);
      },
      at: (t) => {
        const e = reduced() ? t : ease(t);
        const off = Math.sin(Math.PI * e) * lejos;
        const bote = reduced() ? 0 : Math.sin(Math.PI * t) * 0.05;
        ponSombrero(ma, SITIO_X - off, lerp(SITIO_Y[a], SITIO_Y[b], e), bote);
        ponSombrero(mb, SITIO_X + off, lerp(SITIO_Y[b], SITIO_Y[a], e), bote);
      },
      fin: () => {
        [enSitio[a], enSitio[b]] = [enSitio[b], enSitio[a]];
      },
    };
  }
  function jugar(pasos) {
    return new Promise((done) => {
      const antes = juego;
      juego = { pasos, i: 0, t0: null, done };
      antes?.done?.();
      invalidate();
    });
  }
  // La cara de la rueda, aparte: es la que gira (1.109)
  // Detrás, el aro de nogal con su filo dorado, donde van las bombillas
  plane((RUEDA.r + 0.32) * 2, (RUEDA.r + 0.32) * 2, paintAro(), (m) => m.position.set(RUEDA.x, RUEDA.z, RUEDA.y + 0.12), { cut: true });
  const rueda = plane(RUEDA.r * 2, RUEDA.r * 2, paintRueda(), (m) => m.position.set(RUEDA.x, RUEDA.z, RUEDA.y + 0.22), { cut: true });
  // 1.109 · El giro: la rueda va de `desde` a `hasta` frenando sin parar (frenada), en `dur` ms
  let giro = null;
  // El crupier, detrás de la mesa, y la cajera en su ventanilla, mirando a la sala (+x)
  for (const [avatar, [x, y]] of [
    [CRUPIER, MESA.crupier],
    [CAJERA, CAJA.cajera],
  ]) {
    const m = new Mesh(own(geometryOf(figuraKit(avatar, glowAt(x, y, 1.5) + 0.05))), flat);
    m.position.set(x, 0, y);
    m.rotation.y = Math.PI / 2;
    scene.add(m);
  }

  // ── 1.109 · El mapache crupier: si es tu compañero, te sigue por la sala (a tu lado y un poco por delante, para que se
  // vea); al pararte se vuelve hacia ti y hace malabares. Con movimiento reducido, quieto a tu lado y sin malabares.
  const mapache = (() => {
    const k = mapacheKits(0.62);
    const raiz = new Group();
    const cuerpo = new Group();
    raiz.add(cuerpo);
    cuerpo.add(new Mesh(own(geometryOf(k.cuerpo)), flat));
    const cola = new Group();
    const [cx, cy, cz] = MAPACHE.pivoteCola;
    cola.position.set(cx, cz, cy);
    cola.add(new Mesh(own(geometryOf(k.cola)), flat));
    cuerpo.add(cola);
    const fichaGeo = own(geometryOf(k.ficha));
    const fichas = [0, 1, 2].map(() => {
      const m = new Mesh(fichaGeo, flat);
      cuerpo.add(m);
      return m;
    });
    const parpados = k.parpados.map((p) => {
      const m = new Mesh(own(geometryOf(p)), flat);
      cuerpo.add(m);
      return m;
    });
    raiz.visible = false;
    scene.add(raiz);
    return { raiz, cuerpo, cola, fichas, parpados, x: 0, y: 0, z: 0, rumbo: 0, moving: false, puesto: false };
  })();
  let conMapache = companero === 'mapache-crupier';
  const camDir = new Vector3();
  /** Adónde quiere ir el mapache: a tu lado (a la derecha) y un poco por delante; sentado, junto a tu taburete. */
  function metaMapache() {
    camera.getWorldDirection(camDir);
    const h = Math.hypot(camDir.x, camDir.z) || 1;
    const fx = camDir.x / h;
    const fy = camDir.z / h;
    // La derecha de la vista (mirando hacia +y, la derecha es −x)
    const rx = -fy;
    const ry = fx;
    const base = sentado ? [camera.position.x, camera.position.z] : [px, py];
    // Mientras andas, a tu lado y un poco por detrás (sin cruzarse delante de la vista); al pararte, se adelanta
    if (walk && !sentado) {
      for (const [a, b] of [[-0.5, 0.9], [-0.5, -0.9], [-1.0, 0], [0.2, 1.1], [0.2, -1.1]]) {
        const x = base[0] + fx * a + rx * b;
        const y = base[1] + fy * a + ry * b;
        if (libreMascota(x, y)) return [x, y];
      }
      return null;
    }
    if (sentado) {
      for (const [a, b] of [[0.5, 0.75], [0.5, -0.75], [1.2, 0.9]]) {
        const x = base[0] + fx * a + rx * b;
        const y = base[1] + fy * a + ry * b;
        if (libreMascota(x, y)) return [x, y];
      }
      return null;
    }
    // De pie: el primer hueco libre que se vea bien en pantalla (un poco a la derecha y por delante). Si no hay ninguno (p. ej.
    // pegado a la mesa de las chisteras), a tu lado, fuera de cuadro: mejor eso que medio cortado por abajo
    let libre = null;
    for (const [a, b] of [[0.3, 1.0], [0.3, -1.0], [-0.4, 0.9], [-0.4, -0.9]]) {
      const x = base[0] + fx * a + rx * b;
      const y = base[1] + fy * a + ry * b;
      if (libreMascota(x, y)) {
        libre = [x, y];
        break;
      }
    }
    // (Desde lo alto del rellano, mirando escalera abajo, también algo más lejos: en la sala no, para no cruzar mesas)
    for (const a of py > ESCALERA.y0 ? [2.4, 2.0, 2.8, 3.3, 4.0, 5.0, 6.0, 7.0] : [2.4, 2.0, 2.8, 1.7, 3.3, 1.4]) {
      for (const k of [0.22, -0.22, 0.1, -0.1, 0.34, -0.34]) {
        const x = base[0] + fx * a + rx * a * k;
        const y = base[1] + fy * a + ry * a * k;
        if (!libreMascota(x, y)) continue;
        tagPoint.set(x, sueloEn(x, y) + 0.4, y).project(camera);
        if (tagPoint.z < 1 && Math.abs(tagPoint.x) < 0.7 && tagPoint.y > -0.6 && tagPoint.y < 0.5) return [x, y];
      }
    }
    return libre;
  }
  function moverMapache(now, dt) {
    const m = mapache;
    m.raiz.visible = conMapache;
    if (!conMapache) return false;
    const meta = metaMapache();
    const quieto = reduced();
    if (!m.puesto || quieto) {
      if (meta) [m.x, m.y] = meta;
      else if (!m.puesto) [m.x, m.y] = [px, py];
      m.puesto = true;
      m.moving = false;
    } else if (meta) {
      const dx = meta[0] - m.x;
      const dy = meta[1] - m.y;
      const d = Math.hypot(dx, dy);
      // Arranca si te alejas un poco y va al trote (algo más rápido que tú, para alcanzarte)
      if (d > (m.moving ? 0.05 : 0.45)) {
        const paso = Math.min(d, WALK * 1.15 * dt);
        m.x += (dx / d) * paso;
        m.y += (dy / d) * paso;
        m.rumbo += wrapA(Math.atan2(dx, dy) - m.rumbo) * Math.min(1, dt * 9);
        m.moving = true;
      } else m.moving = false;
    }
    const sz = sueloEn(m.x, m.y);
    m.z = m.z && !quieto ? lerp(m.z, sz, Math.min(1, dt * 10)) : sz;
    // Quieto, se vuelve hacia ti
    if (!m.moving) {
      const want = Math.atan2(camera.position.x - m.x, camera.position.z - m.y);
      m.rumbo = quieto ? want : m.rumbo + wrapA(want - m.rumbo) * Math.min(1, dt * 5);
    }
    const p = poseMapache(now / 1000, { moving: m.moving, quieto });
    m.raiz.position.set(m.x, m.z, m.y);
    m.raiz.rotation.y = m.rumbo;
    m.cuerpo.position.y = p.bote;
    m.cola.rotation.y = p.cola;
    m.fichas.forEach((f, i) => {
      const at = p.fichas[i];
      f.visible = Boolean(at);
      if (at) f.position.set(at[0], at[2], at[1]);
    });
    m.parpados.forEach((e, i) => (e.visible = p.parpados[i]));
    return !quieto;
  }

  // ── 1.108 · La mano sobre el paño: cartas que salen del sabot y se deslizan hasta su sitio, la carta tapada del crupier
  // que se da la vuelta, las fichas de hoy apiladas a tu lado y, en la mesa para dos, tu amigo en el taburete de al lado ──
  const cartaGeo = own(new PlaneGeometry(CARTA.w, CARTA.h));
  // Tumbada sobre el paño y girada para que se lea derecha desde el asiento (la cabeza de la carta, hacia el crupier)
  cartaGeo.rotateX(-Math.PI / 2);
  cartaGeo.rotateY(Math.PI / 2);
  const cartaMats = new Map();
  const matCarta = (c) => {
    const key = c == null ? 'dorso' : c;
    if (!cartaMats.has(key)) cartaMats.set(key, own(new MeshBasicMaterial({ map: own(texture(paintCarta(c))) })));
    return cartaMats.get(key);
  };
  /** Las cartas en la mesa, por su sitio («c0», «t1», «s2»…): { mesh, c, desde, hasta, t0, dur, giro } */
  const enMesa = new Map();
  let manoId = null;
  let anim = false;
  let fichasMesh = null;
  let fichasN = -1;
  let amigoMesh = null;
  let amigoKey = '';
  let enPareja = false;
  const filaDe = (fila, k, n, pareja) => {
    if (fila === 'c') return [FILA_CRUPIER, 7.5 + (k - (n - 1) / 2) * 0.3];
    if (fila === 's') return [1.75 + k * 0.13, 6.62];
    return pareja ? [FILA_TUYA, 7.64 + k * 0.18] : [FILA_TUYA, 7.5 + (k - (n - 1) / 2) * 0.3];
  };
  function ponerMano({ id = null, crupier = [], tapada = false, tuyas = [], suyas = null, fichas = 0, amigo = null } = {}) {
    const now = performance.now();
    const quick = reduced();
    if (id !== manoId) {
      for (const { mesh } of enMesa.values()) scene.remove(mesh);
      enMesa.clear();
      manoId = id;
    }
    const pareja = Array.isArray(suyas);
    if (pareja !== enPareja) {
      enPareja = pareja;
      invalidate();
    }
    const filas = [
      ['c', [...crupier, ...(tapada ? [null] : [])]],
      ['t', tuyas],
      ['s', pareja ? suyas : []],
    ];
    // Se reparte por orden: primero lo tuyo, luego el crupier (como en la mesa); cada carta nueva, un poco después
    let nuevas = 0;
    const vivas = new Set();
    for (const [fila, cartas] of filas) {
      cartas.forEach((c, k) => {
        const key = `${fila}${k}`;
        vivas.add(key);
        const [x, y] = filaDe(fila, k, cartas.length, pareja);
        const hasta = [x, y, MESA.alto + 0.004 + k * 0.003];
        const ya = enMesa.get(key);
        if (!ya) {
          const mesh = new Mesh(cartaGeo, matCarta(c));
          scene.add(mesh);
          const e = { mesh, c, desde: quick ? hasta : [...SABOT], hasta, t0: now + nuevas * 140, dur: 320, giro: null };
          nuevas += 1;
          enMesa.set(key, e);
        } else {
          // La misma carta en otro sitio (cambia cuántas hay en la fila): se recoloca; si se destapa, se da la vuelta
          const pos = ya.mesh.position;
          ya.desde = quick ? hasta : [pos.x, pos.z, pos.y];
          ya.hasta = hasta;
          ya.t0 = now;
          ya.dur = 220;
          if (ya.c !== c) {
            ya.giro = { a: matCarta(ya.c), b: matCarta(c), t0: now, dur: quick ? 0 : 300 };
            ya.c = c;
            if (quick) ya.mesh.material = matCarta(c);
          }
        }
      });
    }
    for (const [key, e] of enMesa) {
      if (vivas.has(key)) continue;
      scene.remove(e.mesh);
      enMesa.delete(key);
    }
    // Las fichas de hoy, apiladas a tu derecha (una ficha de la pila por cada dos ganadas, hasta 30)
    const n = Math.min(30, Math.ceil(Math.max(0, fichas) / 2));
    if (n !== fichasN) {
      fichasN = n;
      if (fichasMesh) {
        scene.remove(fichasMesh);
        fichasMesh.geometry.dispose();
      }
      const s = kit();
      const g = glowAt(FICHAS_EN[0], FICHAS_EN[1], 1);
      for (let k = 0; k < n; k += 1) {
        const col = Math.floor(k / 10);
        const [fx, fy] = [FICHAS_EN[0] + col * 0.18, FICHAS_EN[1] - (col % 2) * 0.05];
        const z = MESA.alto + (k % 10) * 0.032;
        const c = FICHA_COLORES[(k + col) % FICHA_COLORES.length];
        pushBox(s, [fx - 0.08, fy - 0.08, z, fx + 0.08, fy + 0.08, z + 0.026], c, { g });
        pushBox(s, [fx - 0.07, fy - 0.07, z + 0.026, fx + 0.07, fy + 0.07, z + 0.03], BLANCO, { g });
      }
      fichasMesh = n ? new Mesh(geometryOf(s), flat) : null;
      if (fichasMesh) scene.add(fichasMesh);
    }
    // El amigo, sentado en su taburete, con su personaje
    const key = amigo ? JSON.stringify(amigo) : '';
    if (key !== amigoKey) {
      amigoKey = key;
      if (amigoMesh) {
        scene.remove(amigoMesh);
        amigoMesh.geometry.dispose();
        amigoMesh = null;
      }
      if (amigo) {
        const s = kit();
        let boxes = [];
        try {
          boxes = actorBoxes(amigo, { pose: 'sit', x: 0, y: 0, facing: 0, h: 0.83 });
        } catch {
          boxes = actorBoxes(DEFAULT_AVATAR, { pose: 'sit', x: 0, y: 0, facing: 0, h: 0.83 });
        }
        const luz = glowAt(ASIENTO_AMIGO[0], ASIENTO_AMIGO[1], 1.4) + 0.05;
        for (const bx of boxes) pushBox(s, [bx.b[0], bx.b[1] - 0.15, bx.b[2], bx.b[3], bx.b[4] - 0.15, bx.b[5]], bx.c, { g: luz });
        amigoMesh = new Mesh(geometryOf(s), flat);
        amigoMesh.position.set(ASIENTO_AMIGO[0], 0, ASIENTO_AMIGO[1]);
        amigoMesh.rotation.y = AMIGO_MIRA;
        scene.add(amigoMesh);
      }
    }
    anim = true;
    invalidate();
  }
  /** Mueve las cartas en vuelo; true si alguna sigue moviéndose. */
  function animarCartas(now) {
    let vivo = false;
    for (const e of enMesa.values()) {
      const t = e.dur ? clamp((now - e.t0) / e.dur, 0, 1) : 1;
      if (t < 1) vivo = true;
      const k = easeOut(t);
      const lift = Math.sin(Math.PI * t) * 0.09 * (e.desde[2] > e.hasta[2] + 0.05 ? 1 : 0.4);
      e.mesh.position.set(lerp(e.desde[0], e.hasta[0], k), lerp(e.desde[2], e.hasta[2], k) + lift, lerp(e.desde[1], e.hasta[1], k));
      e.mesh.visible = now >= e.t0 || e.desde === e.hasta;
      if (e.giro) {
        const g = e.giro.dur ? clamp((now - e.giro.t0) / e.giro.dur, 0, 1) : 1;
        // Se levanta un poco, se estrecha hasta el canto, cambia de cara y vuelve a abrirse
        e.mesh.material = g < 0.5 ? e.giro.a : e.giro.b;
        e.mesh.scale.set(1, 1, Math.max(0.04, Math.abs(Math.cos(Math.PI * g))));
        e.mesh.position.y += Math.sin(Math.PI * g) * 0.06;
        if (g < 1) vivo = true;
        else {
          e.mesh.scale.set(1, 1, 1);
          e.giro = null;
        }
      }
    }
    return vivo;
  }

  // ── Neones y letreros ──
  const neon = (texto, color, h, place, opt) => {
    const c = rotulo(texto, color, opt);
    return plane((h * c.width) / c.height, h, c, place, { glow: true });
  };
  neon('LA RULETA', NEON, 0.58, (m) => m.position.set(RUEDA.x, 5.98, 0.06));
  neon('21', NEON, 1.05, (m) => {
    m.rotation.y = Math.PI / 2;
    m.position.set(0.06, 4.15, 7.5);
  });
  neon('LAS TRES CHISTERAS', CIAN, 0.42, (m) => {
    m.rotation.y = -Math.PI / 2;
    m.position.set(CW - 0.06, 4.55, CHISTERAS.y);
  });
  neon('CAJA', GOLD, 0.34, (m) => {
    m.rotation.y = Math.PI / 2;
    m.position.set(CAJA.x1 + 0.11, 2.7, 13.0);
  });
  neon('VITRINA DE PREMIOS', GOLD, 0.3, (m) => {
    m.rotation.y = -Math.PI / 2;
    m.position.set(CW - 0.06, 3.3, 13.0);
  });
  neon('BAR', CIAN, 0.4, (m) => m.position.set(1.8, 3.15, 0.36));

  // Lo que se toca: una caja invisible por sitio
  const pickers = Object.entries(SITIOS).map(([id, { box }]) => {
    const [x0, y0, z0, x1, y1, z1] = box;
    const m = new Mesh(own(new BoxGeometry(x1 - x0, z1 - z0, y1 - y0)), hidden);
    m.position.set((x0 + x1) / 2, (z0 + z1) / 2, (y0 + y1) / 2);
    m.userData.id = id;
    scene.add(m);
    return m;
  });

  const ray = new Raycaster();
  const floorPlane = new Plane(new Vector3(0, 1, 0), 0);
  const hit = new Vector3();

  // ── Dónde estás y adónde miras ──
  let px = INICIO.x;
  let py = INICIO.y;
  let pz = RELLANO.z;
  let yaw = INICIO.yaw;
  let walk = null; // { pts: [[x, y, z]…], face: [x, y] | null, done }
  let raf = 0;
  let destroyed = false;
  let renders = 0;
  let lastT = 0;
  // Desde el rellano se mira un poco más hacia abajo: se ve la sala entera
  const pitch = () => PITCH - 0.04 * pz;
  // 1.108 · Sentado a la mesa: la cámara baja al taburete y mira el paño (0 de pie, 1 sentado)
  // 1.109: `sentado` es dónde ('mesa' o 'ruleta', delante de la rueda) o false; `ultimo`, adónde iba la cámara (para volver)
  let sentado = false;
  let ultimo = 'mesa';
  // 1.111 · Delante de la vitrina: qué armario (0 la caja, 1 la ruleta y la lata, 2 las copas) y dónde está la cámara
  let vitArmario = 1;
  let vitY = armarioY(1);
  let seatK = 0;

  function advance(dt) {
    if (!walk) return false;
    let t = dt;
    while (t > 0 && walk.pts.length) {
      const [tx, ty, tz] = walk.pts[0];
      const dx = tx - px;
      const dy = ty - py;
      const d = Math.hypot(dx, dy);
      if (d > 0.02) yaw += wrapA(Math.atan2(dx, dy) - yaw) * Math.min(1, dt * 7);
      if (d <= WALK * t) {
        px = tx;
        py = ty;
        pz = tz;
        t -= d / WALK;
        walk.pts.shift();
      } else {
        const k = (WALK * t) / d;
        px += dx * k;
        py += dy * k;
        pz += (tz - pz) * k;
        t = 0;
      }
    }
    if (walk.pts.length) return true;
    if (walk.face) {
      const want = Math.atan2(walk.face[0] - px, walk.face[1] - py);
      const delta = wrapA(want - yaw);
      if (Math.abs(delta) > 0.01) {
        yaw += delta * Math.min(1, dt * 8);
        return true;
      }
      yaw = want;
    }
    const done = walk.done;
    walk = null;
    onMove({ x: px, y: py, z: pz, yaw });
    done?.();
    return false;
  }

  /** Sentarse a la mesa o ponerse delante de la ruleta (`on`), o volver a estar de pie. */
  function ponerse(donde, on) {
    sentado = on ? donde : false;
    if (on) {
      ultimo = donde;
      walk = null;
      const p = onNet(NODOS[SITIOS[donde].nudo][0], NODOS[SITIOS[donde].nudo][1]);
      [px, py, pz] = [p.x, p.y, p.z];
      yaw = Math.atan2(SITIOS[donde].mira[0] - px, SITIOS[donde].mira[1] - py);
    }
    invalidate();
    return new Promise((done) => {
      const mira = () => (seatK === (sentado ? 1 : 0) ? done() : setTimeout(mira, 40));
      mira();
    });
  }

  function aim(now) {
    const dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0;
    lastT = now;
    let moving = advance(dt);
    const want = sentado ? 1 : 0;
    if (seatK !== want) {
      seatK = reduced() ? want : clamp(seatK + (want ? dt : -dt) / 0.7, 0, 1);
      moving = moving || seatK !== want;
    }
    if (animarCartas(now)) moving = true;
    else anim = false;
    if (giro) {
      const t = giro.dur ? (now - giro.t0) / giro.dur : 1;
      rueda.rotation.z = lerp(giro.desde, giro.hasta, frenada(t));
      if (t >= 1) {
        rueda.rotation.z = giro.hasta;
        const done = giro.done;
        giro = null;
        done();
      } else moving = true;
    }
    if (juego && pasoJuego(now)) moving = true;
    const e = [px, py, pz + EYE];
    const l = [e[0] + Math.sin(yaw) * 6, e[1] + Math.cos(yaw) * 6, e[2] + Math.tan(pitch()) * 6];
    const k = ease(seatK);
    if (ultimo === 'vitrina') {
      const quiere = armarioY(vitArmario);
      if (Math.abs(vitY - quiere) > 0.002 && !reduced()) {
        vitY += (quiere - vitY) * Math.min(1, dt * 5);
        moving = true;
      } else vitY = quiere;
      // El premio elegido gira despacio, como en un expositor
      for (const [id, v] of enVitrina) {
        const sel = id === vitSel;
        // De cerca: un poco más grande y adelantado en su balda
        v.mesh.scale.setScalar(sel ? 1.25 : 1);
        v.mesh.position.x = v.x - (sel ? 0.12 : 0);
        if (sel && !reduced()) {
          vitGiro += dt * 1.1;
          v.mesh.rotation.y = v.giro + vitGiro;
          moving = true;
        } else v.mesh.rotation.y = v.giro;
      }
    }
    const A =
      ultimo === 'ruleta'
        ? ANTE_RUEDA
        : ultimo === 'chisteras'
          ? ANTE_CHISTERAS
          : ultimo === 'vitrina'
            ? { x: ANTE_VITRINA.x, y: vitY, z: ANTE_VITRINA.z, mira: [ANTE_VITRINA.mira[0], vitY, ANTE_VITRINA.mira[1]] }
            : enPareja
              ? ASIENTO_PAREJA
              : ASIENTO;
    const m = A.mira;
    camera.position.set(lerp(e[0], A.x, k), lerp(e[2], A.z, k), lerp(e[1], A.y, k));
    camera.lookAt(lerp(l[0], m[0], k), lerp(l[2], m[2], k), lerp(l[1], m[1], k));
    camera.updateMatrixWorld();
    // El mapache se anima siempre (como los compañeros del piso), pero no cuenta como «moverse» para lo demás
    if (moverMapache(now, dt)) vivo = true;
    return moving;
  }

  const tagPoint = new Vector3();
  function project(x, y, z) {
    const rect = container.getBoundingClientRect();
    tagPoint.set(x, z, y).project(camera);
    return { x: ((tagPoint.x + 1) / 2) * rect.width, y: ((1 - tagPoint.y) / 2) * rect.height, front: tagPoint.z < 1 && Math.abs(tagPoint.x) < 0.95 && tagPoint.y < 0.97 && tagPoint.y > -0.9 };
  }
  function tags() {
    const out = {};
    const quiet = Boolean(walk) || seatK > 0;
    const dMesa = Math.hypot(px - NODOS.mesa[0], py - NODOS.mesa[1]);
    for (const [id, s] of Object.entries(SITIOS)) {
      const p = project(...s.tag);
      // De cerca de la mesa, el letrero cede el sitio al bocadillo del crupier
      const tapa = id === 'mesa' && dMesa < DICE_CERCA - 3;
      out[id] = { ...p, visible: !quiet && !tapa && p.front && Math.hypot(px - s.tag[0], py - s.tag[1]) < TAG_LEJOS };
    }
    const q = project(MESA.crupier[0] + 0.2, MESA.crupier[1], lerp(2.45, 1.92, ease(seatK)));
    out.dice = { ...q, visible: (sentado === 'mesa' ? seatK === 1 : !sentado && !walk && seatK === 0 && ultimo === 'mesa') && q.front && dMesa < DICE_CERCA };
    return out;
  }
  let vivo = false;
  function draw(now = performance.now()) {
    raf = 0;
    if (destroyed || document.visibilityState === 'hidden') return;
    vivo = false;
    const moving = aim(now) || vivo;
    renderer.render(scene, camera);
    renders += 1;
    onFrame(tags());
    if (moving) invalidate();
    else lastT = 0;
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
    invalidate();
  }
  function rayAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    ray.setFromCamera(new Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1), camera);
  }
  function pickAt(clientX, clientY) {
    rayAt(clientX, clientY);
    return ray.intersectObjects(pickers, false)[0]?.object.userData.id ?? null;
  }

  /** Ir andando por los pasillos hasta el punto de la red más cercano a (x, y); `face`, adónde mirar al llegar. */
  function walkTo(x, y, { face = null } = {}) {
    return new Promise((done) => {
      const from = onNet(px, py);
      const to = onNet(x, y);
      const pts = Math.hypot(from.x - px, from.y - py) > 0.02 ? [[from.x, from.y, from.z], ...route(from, to)] : route(from, to);
      if (reduced() || !pts.length) {
        [px, py, pz] = pts.length ? pts.at(-1) : [px, py, pz];
        if (face) yaw = Math.atan2(face[0] - px, face[1] - py);
        walk = null;
        invalidate();
        onMove({ x: px, y: py, z: pz, yaw });
        done();
        return;
      }
      walk = { pts, face, done };
      invalidate();
    });
  }

  // ── Mandos: arrastrar mira; un toque en un sitio lo elige; tocar el suelo lleva hasta allí ──
  const stop = new AbortController();
  const on = { signal: stop.signal };
  let press = null;
  canvas.addEventListener(
    'pointerdown',
    (e) => {
      if (press) return;
      press = { x: e.clientX, y: e.clientY, yaw, id: e.pointerId, moved: false };
      canvas.setPointerCapture?.(e.pointerId);
    },
    on,
  );
  canvas.addEventListener(
    'pointermove',
    (e) => {
      if (!press || e.pointerId !== press.id) return;
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > TAP_SLOP) press.moved = true;
      if (!press.moved || walk || sentado) return;
      yaw = press.yaw + (e.clientX - press.x) * DRAG;
      invalidate();
    },
    on,
  );
  const release = (e) => {
    if (!press || e.pointerId !== press.id) return;
    const tap = !press.moved && e.type === 'pointerup';
    const moved = press.moved;
    press = null;
    if (moved) onMove({ x: px, y: py, z: pz, yaw });
    if (tap && sentado === 'vitrina') {
      rayAt(e.clientX, e.clientY);
      const h = ray.intersectObjects(vitrinaGrupo.children.filter((m) => m.userData.premio), false)[0];
      if (h) onPremio(h.object.userData.premio);
      return;
    }
    if (tap && sentado === 'chisteras' && eligiendo) {
      rayAt(e.clientX, e.clientY);
      const h = ray.intersectObjects(sombreros, false)[0];
      if (h) onChistera(enSitio.indexOf(h.object));
      return;
    }
    if (!tap || sentado) return;
    const id = pickAt(e.clientX, e.clientY);
    if (id) {
      onPick(id);
      return;
    }
    rayAt(e.clientX, e.clientY);
    if (ray.ray.intersectPlane(floorPlane, hit) && dentro(hit.x, hit.z)) walkTo(hit.x, hit.z);
  };
  canvas.addEventListener('pointerup', release, on);
  canvas.addEventListener('pointercancel', release, on);
  canvas.addEventListener(
    'keydown',
    (e) => {
      if (sentado) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        yaw += e.key === 'ArrowLeft' ? KEY_STEP : -KEY_STEP;
        invalidate();
        onMove({ x: px, y: py, z: pz, yaw });
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const k = e.key === 'ArrowUp' ? 1.2 : -1.2;
        walkTo(px + Math.sin(yaw) * k, py + Math.cos(yaw) * k);
      }
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
  document.addEventListener('visibilitychange', () => invalidate(), on);
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  container.append(canvas);
  resize();

  // La vitrina, tapada hasta que llegue lo que tienes
  ponerVitrina(null);

  const api = {
    canvas,
    renders: () => renders,
    pose: () => ({ x: px, y: py, z: pz, yaw }),
    settled: () => !walk && seatK === (sentado ? 1 : 0) && !anim && !giro && !juego && !mapache.moving && (ultimo !== 'vitrina' || Math.abs(vitY - armarioY(vitArmario)) <= 0.002),
    /** 1.109 · El compañero que te sigue (solo el mapache crupier se ve en el casino). */
    setCompanero(id) {
      conMapache = id === 'mapache-crupier';
      mapache.puesto = false;
      invalidate();
    },
    /** 1.109 · Para las pruebas: dónde está el mapache y si se ve en pantalla. */
    mapache() {
      if (!conMapache) return null;
      const p = project(mapache.x, mapache.y, mapache.z + 0.4);
      return { x: mapache.x, y: mapache.y, z: mapache.z, moving: mapache.moving, sx: p.x, sy: p.y, front: p.front };
    },
    /** 1.108 · Sentarse a la mesa (o levantarse): la cámara baja al taburete del medio. Promesa que acaba al llegar. */
    sentarse: (on = true) => ponerse('mesa', on),
    sentado: () => sentado === 'mesa',
    /** 1.109 · Ponerse delante de la ruleta (o irse): la cámara, de frente a la rueda. Promesa que acaba al llegar. */
    anteRuleta: (on = true) => ponerse('ruleta', on),
    enRuleta: () => sentado === 'ruleta',
    /**
     * 1.109 · Girar la rueda hasta la casilla `n` (la que ya ha decidido el servidor): cinco vueltas y una frenada que solo
     * frena, parándose dentro de la casilla y lejos de la raya. Con movimiento reducido, directa. Promesa que acaba al parar.
     */
    girar(n, desvio = 0) {
      const desde = rueda.rotation.z;
      const hasta = anguloFinal(n, desde, 5, desvio);
      return new Promise((done) => {
        giro = { desde, hasta, t0: performance.now(), dur: reduced() ? 0 : GIRO_MS, done };
        invalidate();
      });
    },
    /** La rueda quieta en la casilla `n` (la del giro de esta semana), o en su sitio (null). */
    ruedaEn(n) {
      giro = null;
      rueda.rotation.z = n == null ? 0 : anguloFinal(n, 0, 0);
      invalidate();
    },
    /** 1.111 · Lo que enseña la vitrina: { tienes, hitos, fichas, garbanzos } (la tuya o la de un amigo); null, todo tapado. */
    vitrina: ponerVitrina,
    /** 1.111 · Ponerse delante de la vitrina, frente al armario `k` (o irse). Promesa que acaba al llegar. */
    anteVitrina(on = true, k = vitArmario) {
      vitArmario = k;
      if (!on) vitSel = null;
      if (on && sentado !== 'vitrina') vitY = armarioY(k);
      return ponerse('vitrina', on);
    },
    enVitrina: () => sentado === 'vitrina',
    /** 1.111 · Pasar a otro armario de la vitrina sin moverse de delante. */
    armario(k) {
      vitArmario = k;
      vitSel = null;
      invalidate();
    },
    /** 1.111 · El premio que se mira de cerca (gira en su balda), o ninguno. */
    elegirPremio(id) {
      vitSel = id;
      vitGiro = 0;
      invalidate();
    },
    /** 1.111 · Para las pruebas: dónde cae en la pantalla un premio, si se ve expuesto (o tapado) y si gira. */
    premio(id) {
      aim(performance.now());
      const v = enVitrina.get(id);
      if (!v) return null;
      const p = project(v.mesh.position.x, v.mesh.position.z, v.mesh.position.y + 0.15);
      const rect = canvas.getBoundingClientRect();
      return { x: rect.left + p.x, y: rect.top + p.y, front: p.front, visto: v.visto, girando: v.mesh.rotation.y !== v.giro, cerca: v.mesh.scale.x > 1 };
    },
    /** 1.110 · Ponerse delante de la mesa de las chisteras (o irse, recogiendo la mesa). Promesa que acaba al llegar. */
    anteChisteras(on = true) {
      if (!on) {
        eligiendo = false;
        const r = pasosRecoger();
        if (r.length) jugar(r);
      }
      return ponerse('chisteras', on);
    },
    enChisteras: () => sentado === 'chisteras',
    /**
     * 1.110 · Una ronda: el conejo salta bajo la chistera de `inicio` y luego se hacen los `cambios` (los que ha sorteado el
     * servidor), cada vez más deprisa según la `ronda` (1 a 3); con movimiento reducido, uno a uno y despacio. `onCambio(k)`,
     * al empezar cada cambio. Promesa que acaba cuando ya se puede elegir.
     */
    chisterasRonda(inicio, cambios, ronda = 1, onCambio = null) {
      eligiendo = false;
      const ms = CAMBIO_MS[Math.max(0, Math.min(CAMBIO_MS.length - 1, ronda - 1))];
      return jugar([
        ...pasosRecoger(),
        { ms: 320, r: 0, at: (t) => alzar(inicio, ease(t)) },
        {
          ms: 560,
          r: 900,
          empieza: () => (conejo.visible = true),
          at: (t) => {
            const e = reduced() ? 1 : ease(t);
            ponConejo(lerp(CONEJO_CASA[0], SITIO_X, e), lerp(CONEJO_CASA[1], SITIO_Y[inicio], e), reduced() ? 0 : Math.sin(Math.PI * t) * 0.42);
          },
        },
        pausa(380, 500),
        // Baja la chistera: el conejo queda dentro (no se ve)
        { ms: 320, r: 0, at: (t) => alzar(inicio, 1 - ease(t)), fin: () => (conejo.visible = false) },
        pausa(420, 700),
        ...cambios.flatMap((k, n) => (n ? [pausa(60, 450), pasoCambio(k, ms, onCambio)] : [pasoCambio(k, ms, onCambio)])),
        { ms: 0, r: 0, fin: () => (eligiendo = true) },
      ]);
    },
    /** 1.110 · ¿Se puede tocar ya una chistera? (al acabar los cambios; el panel lo apaga al elegir). */
    chisterasElegible(on) {
      eligiendo = Boolean(on);
    },
    /**
     * 1.110 · Enseñar la ronda: se levanta la chistera `elegida`; si el conejo estaba ahí, sale de un salto; si no, se levanta
     * después la de `conejoEn`, donde estaba (sin rodeos ni falsos «casi»). Promesa que acaba con todo a la vista.
     */
    chisterasRevelar(elegida, dondeEstaba) {
      eligiendo = false;
      const bien = elegida === dondeEstaba;
      const conejoAqui = () => {
        ponConejo(SITIO_X, SITIO_Y[dondeEstaba], 0);
        conejo.visible = true;
      };
      const pasos = [{ ms: 340, r: 0, empieza: bien ? conejoAqui : null, at: (t) => alzar(elegida, ease(t)) }];
      if (bien) pasos.push({ ms: 560, r: 0, at: (t) => ponConejo(SITIO_X, SITIO_Y[dondeEstaba], reduced() ? 0 : Math.sin(Math.PI * t) * 0.32) });
      else pasos.push(pausa(420, 500), { ms: 340, r: 0, empieza: conejoAqui, at: (t) => alzar(dondeEstaba, ease(t)) });
      pasos.push({ ...pausa(500, 400), resuelve: true });
      return jugar(pasos);
    },
    /** 1.110 · Recoger la mesa (bajar las chisteras y el conejo a su sitio). */
    chisterasRecoger() {
      eligiendo = false;
      const r = pasosRecoger();
      return r.length ? jugar(r) : Promise.resolve();
    },
    /** 1.110 · Para las pruebas: dónde cae en la pantalla la chistera del sitio `k`, si se puede elegir y si se mueve algo. */
    chistera(k) {
      aim(performance.now());
      const m = enSitio[k];
      const p = project(m.position.x, m.position.z, m.position.y + 0.2);
      const rect = canvas.getBoundingClientRect();
      return { x: rect.left + p.x, y: rect.top + p.y, front: p.front, alzada: alzada[k], eligiendo, jugando: Boolean(juego), conejo: conejo.visible };
    },
    /** La casilla que señala la flecha (para las pruebas). */
    casillaArriba: () => casillaEn(rueda.rotation.z),
    /** 1.108 · Lo que hay en la mesa: { id, crupier, tapada, tuyas, suyas (mesa para dos), fichas, amigo }. */
    mano: ponerMano,
    /** Cuántas cartas hay en la mesa (para las pruebas). */
    cartas: () => [...enMesa.keys()],
    /** Ir a un sitio ('mesa', 'ruleta', 'chisteras', 'caja', 'vitrina' o 'rellano'). Promesa que acaba al llegar. */
    go(id) {
      if (id === 'rellano') return walkTo(NODOS.rellano[0], NODOS.rellano[1], { face: [8, 10] });
      const s = SITIOS[id];
      if (!s) return Promise.resolve();
      const [x, y] = NODOS[s.nudo];
      return walkTo(x, y, { face: s.mira });
    },
    /** Ponerse en un sitio de golpe (para las pruebas y las capturas). */
    place(x, y, yawTo = yaw) {
      walk = null;
      const p = onNet(x, y);
      px = p.x;
      py = p.y;
      pz = p.z;
      yaw = yawTo;
      onMove({ x: px, y: py, z: pz, yaw });
      invalidate();
    },
    /** Dónde cae en la pantalla un sitio (para las pruebas). */
    onScreen(id) {
      aim(performance.now());
      const b = SITIOS[id].box;
      const p = project((b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2);
      const rect = canvas.getBoundingClientRect();
      return { x: rect.left + p.x, y: rect.top + p.y };
    },
    /** El punto del suelo bajo un punto de la pantalla (para las pruebas), o null. */
    sueloEn(clientX, clientY) {
      aim(performance.now());
      camera.updateMatrixWorld();
      rayAt(clientX, clientY);
      return ray.ray.intersectPlane(floorPlane, hit) ? { x: hit.x, y: hit.z, pick: pickAt(clientX, clientY) } : null;
    },
    /** La rueda de la ruleta. */
    rueda,
    invalidate,
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      stop.abort();
      observer.disconnect();
      fichasMesh?.geometry.dispose();
      amigoMesh?.geometry.dispose();
      for (const x of owned) x.dispose?.();
      renderer.dispose();
      canvas.remove();
    },
  };
  return api;
}
