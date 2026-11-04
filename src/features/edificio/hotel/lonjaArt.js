// La Lonja del entresuelo del Gran Hotel (docs/qa/gran-hotel.md §9.2), con el mismo motor isométrico que las salas. Es la
// primera sala de dos plantas y se ve entera de una vez, en corte, como una casa de muñecas: abajo, la nave del mercado, donde
// cada puesto es una persona de verdad, de pie tras su mostrador y con sus muebles encima; arriba, el altillo, que es tuyo: tu
// puesto, tu almacén, tu pizarra y tu libro de cuentas. El altillo solo ocupa el fondo (ALT_W × ALT_D), lo justo para que no
// tape lo de abajo, y la escalera sube pegada a la pared del fondo, donde no estorba. Quien lleva la nave es Remedios, la lonjera. Todo propio.
import { DEFAULT_AVATAR, actorBoxes } from '../actor';
import { catalogItem } from '../catalog';
import { shapeOf } from '../furniture';
import { createRaster, noise, rgb } from '../../minigames/libreria-puerto/raster';
import { evening, outlineOf, toDataURL } from '../shopRoom';

const YAW = Math.PI / 4;
const LW = 13;
const LD = 8;
const ALTO = 6; // A qué altura está el suelo del altillo
const ALT_D = 4.4; // Hasta dónde llega hacia delante
const ALT_W = 9; // Y hasta dónde a lo ancho: lo que queda a la derecha es la nave a doble altura
const TECHO = 9.6;
const FORJADO = 0.8;
const WALL_T = 0.3;
const S_L = 15;
const GLOW = 0x8000;

const BRICK = [132, 70, 52];
const MORTAR = [84, 60, 54];
const TILE_A = [176, 162, 136];
const TILE_B = [104, 118, 118];
const PLANK = [138, 96, 62];
const WOOD = [128, 88, 56];
const WOOD_D = [78, 52, 36];
const IRON = [44, 40, 48];
const LAMP = [255, 222, 150];
const CREAM = [226, 212, 176];
const GLASS = [34, 52, 92];
const SLATE = [38, 46, 44];
const GREEN = [38, 78, 62];
const BRASS = [214, 170, 84];
const CAT = [216, 132, 60];
export const TOLDOS = [
  [168, 56, 52],
  [52, 96, 130],
  [46, 112, 84],
  [186, 136, 52],
  [124, 72, 128],
  [196, 96, 58],
];

/** Los toldos que se canjean con sellos: los ve todo el mundo y no dan nada más. */
export const TOLDOS_ESPECIALES = {
  noche: { nombre: 'Toldo noche', color: [36, 44, 96] },
  menta: { nombre: 'Toldo menta', color: [88, 176, 148] },
  coral: { nombre: 'Toldo coral', color: [232, 112, 104] },
  ciruela: { nombre: 'Toldo ciruela', color: [96, 40, 88] },
};

/** Los cinco sitios de la nave: dos bajo el altillo, uno a la derecha y dos junto a la pared de la izquierda. */
const SITIOS = [
  { x: 2.3, y: 1.7, frontal: true },
  { x: 5.2, y: 1.7, frontal: true },
  { x: 10.9, y: 3.4, frontal: true },
  { x: 1.7, y: 4.1, frontal: false },
  { x: 1.7, y: 6.6, frontal: false },
];
export const PUESTOS_POR_PASILLO = SITIOS.length;

// La escalera sube pegada a la pared del fondo, de la derecha hasta el costado del altillo
const ESC = { y0: 0.1, y1: 1.5, peldanos: 14 };
const ID_REMEDIOS = 20;
const ID_PUESTO = 21;
const ID_LIBRO = 22;

export const REMEDIOS = { ...DEFAULT_AVATAR, pelo: 'mono', colorPelo: 3, jersey: 2, pantalon: 1, gafas: true };

const LETRAS = {
  L: ['10000', '10000', '10000', '10000', '11111'],
  O: ['01110', '10001', '10001', '10001', '01110'],
  N: ['10001', '11001', '10101', '10011', '10001'],
  J: ['00111', '00010', '00010', '10010', '01100'],
  A: ['01110', '10001', '11111', '10001', '10001'],
};

function pintor(r, lights) {
  let id = 0;
  let base = 0; // La planta en la que se dibuja
  const box = (x0, y0, z0, x1, y1, z1, c, opts = {}) => {
    r.setId(id | (opts.glow ? GLOW : 0));
    r.box(x0, y0, z0 + base, x1, y1, z1 + base, c, { seed: opts.seed ?? x0 * 7 + y0 * 3, grain: opts.grain ?? 0, face: opts.face ?? null, step: opts.step ?? 0.03 });
    r.setId(id);
  };
  const conId = (n, dibujar) => {
    id = n;
    r.setId(n);
    dibujar();
    id = 0;
    r.setId(0);
  };
  const luz = (x, y, z) => lights.push([x, y, z + base]);
  /** Un farol colgado de un cordón que llega hasta `hasta`. */
  const farol = (x, y, z, hasta) => {
    box(x - 0.1, y - 0.1, z, x + 0.1, y + 0.1, z + 0.22, LAMP, { glow: true });
    box(x - 0.015, y - 0.015, z + 0.22, x + 0.015, y + 0.015, hasta, IRON);
    luz(x, y, z);
  };
  /** Una farola de hierro, para lo que queda fuera del altillo. */
  const farola = (x, y) => {
    box(x - 0.16, y - 0.16, 0, x + 0.16, y + 0.16, 0.1, IRON);
    box(x - 0.04, y - 0.04, 0.1, x + 0.04, y + 0.04, 2.7, IRON);
    box(x - 0.14, y - 0.14, 2.7, x + 0.14, y + 0.14, 3.05, LAMP, { glow: true });
    box(x - 0.17, y - 0.17, 3.05, x + 0.17, y + 0.17, 3.12, IRON);
    luz(x, y, 2.8);
  };
  const persona = (avatar, state) =>
    actorBoxes(avatar, { pose: 'stand', ...state }).forEach((bx, k) => {
      const [x0, y0, z0, x1, y1, z1] = bx.b;
      r.box(x0, y0, z0 + base, x1, y1, z1 + base, bx.c, { seed: 501 + k, grain: bx.grain ?? 0.6, step: bx.step ?? 0.03 });
    });
  /** Un mueble de verdad, en pequeño, encima de algo: cabe en un cuadro de `tam` y se apoya en `z`. */
  const mueble = (mid, cx, cy, z, tam, seed = 1) => {
    const cat = catalogItem(mid);
    let cajas = [];
    try {
      cajas = cat ? shapeOf(mid, cat.tonos[0]) : [];
    } catch {
      cajas = [];
    }
    if (!cajas.length) {
      box(cx - tam / 2, cy - 0.12, z, cx + tam / 2, cy + 0.12, z + 0.24, [150, 92, 70], { seed }); // una alfombra, enrollada
      return;
    }
    const lim = (k) => [Math.min(...cajas.map((c) => c.b[k])), Math.max(...cajas.map((c) => c.b[k + 3]))];
    const [ax, bx] = lim(0);
    const [ay, by] = lim(1);
    const [az, bz] = lim(2);
    const s = Math.min(tam / (bx - ax), tam / (by - ay), 0.95 / (bz - az), 1);
    const ox = cx - ((ax + bx) / 2) * s;
    const oy = cy - ((ay + by) / 2) * s;
    const oz = z + base - az * s;
    cajas.forEach((c, k) => {
      const [x0, y0, z0, x1, y1, z1] = c.b;
      r.setId(id | (c.glow ? GLOW : 0));
      r.box(ox + x0 * s, oy + y0 * s, oz + z0 * s, ox + x1 * s, oy + y1 * s, oz + z1 * s, c.c, { seed: seed * 7 + k, grain: c.grain ?? 1, step: 0.02 });
      r.setId(id);
    });
  };
  /** Un puesto: mostrador, postes y toldo a rayas. Cerrado, con una lona y sin toldo. */
  const puesto = ({ x, y, frontal }, { toldo = null, muebles = [], avatar = null, seed = 1, ancho = 1.15 }) => {
    const w = frontal ? ancho : 0.42;
    const d = frontal ? 0.42 : ancho;
    box(x - w, y - d, 0, x + w, y + d, 0.95, WOOD, { seed, grain: 1 });
    box(x - w - 0.06, y - d - 0.06, 0.95, x + w + 0.06, y + d + 0.06, 1.03, WOOD_D);
    if (!toldo) {
      box(x - w + 0.08, y - d + 0.06, 1.03, x + w - 0.08, y + d - 0.06, 1.2, [92, 96, 84], { seed, grain: 1 });
      return;
    }
    if (avatar) persona(avatar, frontal ? { x, y: y - 0.86, facing: 0 } : { x: x - 0.86, y, facing: 3 });
    // El toldo se apoya atrás, sobre quien atiende, para que el mostrador se vea entero
    const [t0, t1, t2, t3] = frontal ? [x - w - 0.14, y - 1.34, x + w + 0.14, y - 0.2] : [x - 1.34, y - d - 0.14, x - 0.2, y + d + 0.14];
    for (const [px, py] of [
      [t0 + 0.1, t1 + 0.1],
      [t2 - 0.1, t1 + 0.1],
      [t0 + 0.1, t3 - 0.1],
      [t2 - 0.1, t3 - 0.1],
    ])
      box(px - 0.05, py - 0.05, 0, px + 0.05, py + 0.05, 2.5, WOOD_D);
    const raya = (f, a) => (Math.floor(a / 0.3) % 2 ? rgb(...CREAM) : rgb(...toldo));
    box(t0, t1, 2.5, t2, t3, 2.6, toldo, { face: raya });
    muebles.slice(0, 3).forEach((m, k, todos) => {
      const paso = todos.length === 1 ? 0 : (k - (todos.length - 1) / 2) * 0.74;
      mueble(m, frontal ? x + paso : x, frontal ? y : y + paso, 1.03, 0.68, seed + k);
    });
    luz(x, y, 2.2);
  };
  const gato = (x, y, z) => {
    box(x - 0.2, y - 0.11, z, x + 0.14, y + 0.11, z + 0.16, CAT, { seed: 9 });
    box(x + 0.1, y - 0.09, z + 0.06, x + 0.26, y + 0.09, z + 0.22, CAT, { seed: 10 });
    for (const dy of [-0.07, 0.05]) box(x + 0.17, y + dy, z + 0.22, x + 0.21, y + dy + 0.03, z + 0.27, CAT);
    box(x - 0.22, y + 0.08, z, x + 0.02, y + 0.14, z + 0.05, CAT, { seed: 11 });
  };
  const planta = (z) => {
    base = z;
  };
  return { box, conId, farol, farola, persona, mueble, puesto, gato, planta };
}

const ventana = (a, b, x0, x1, z0, z1) => {
  if (a < x0 || a > x1 || b < z0 || b > z1) return null;
  if (a < x0 + 0.07 || a > x1 - 0.07 || b < z0 + 0.07 || b > z1 - 0.07 || Math.abs(a - (x0 + x1) / 2) < 0.035 || Math.abs(b - (z0 + z1) / 2) < 0.035) return rgb(...IRON);
  return noise(a * 11, b * 11) > 0.94 ? rgb(236, 226, 180) : rgb(...GLASS);
};

function buildLonja(r, { puestos, personaje, toldo, ofertas, hechos, tope, libres }) {
  const lights = [];
  const { box, conId, farol, farola, persona, mueble, puesto, gato, planta } = pintor(r, lights);
  const ta = r.rampOf(TILE_A);
  const tb = r.rampOf(TILE_B);
  const m = r.rampOf(MORTAR);
  const ladrillo = r.rampOf(BRICK);
  const tabla = r.rampOf(PLANK);

  r.floor((x, y, ix, iy) => {
    if (x < 0 || y < 0 || x > LW || y > LD) return 0;
    const u = Math.floor(x * 1.1);
    const v = Math.floor(y * 1.1);
    const ramp = (u + v) % 2 ? ta : tb;
    const d = (r.bayerAt(ix, iy) - 0.5) * 0.3;
    return ramp[Math.max(2, Math.min(4, Math.floor(3 + (noise(u, v) - 0.5) * 1.2 + d)))];
  });

  // ── Las paredes: ladrillo en la nave y tablas en el altillo ──
  const muro = (a, b) => {
    const fila = Math.floor(b / 0.28);
    const u = a + (fila % 2 ? 0.28 : 0);
    if (b % 0.28 < 0.05 || u % 0.56 < 0.05) return m[2];
    const n = noise(Math.floor(u / 0.56), fila);
    return ladrillo[n > 0.75 ? 3 : n < 0.2 ? 1 : 2];
  };
  const madera = (a) => {
    if (a % 0.9 < 0.05) return tabla[1];
    return tabla[noise(Math.floor(a / 0.9), 1) > 0.7 ? 3 : 2];
  };
  // Una red de pesca colgada, de cuando aquí se vendía pescado
  const red = (a, b) => {
    if (a < 6.9 || a > 8.5 || b < ALTO + 1.2 + Math.abs(a - 7.7) * 0.5 || b > ALTO + 3.1) return null;
    return (a + b) % 0.3 < 0.05 || (a - b + 19) % 0.3 < 0.05 ? rgb(214, 196, 150) : null;
  };
  // La pizarra del día: un palote por cada cambio hecho, de los que dé el tope
  const pizarra = (a, b) => {
    const [A0, A1, B0, B1] = [0.7, 3.5, ALTO + 1.1, ALTO + 2.7];
    if (a < A0 || a > A1 || b < B0 || b > B1) return null;
    if (a < A0 + 0.09 || a > A1 - 0.09 || b < B0 + 0.09 || b > B1 - 0.09) return rgb(...WOOD);
    for (let k = 0; k < tope; k += 1) {
      const c = A0 + 0.7 + k * 0.7;
      if (Math.abs(a - c) < 0.1 && b > B0 + 0.4 && b < B1 - 0.4) return k < hechos ? rgb(...CREAM) : rgb(70, 82, 78);
    }
    return rgb(...SLATE);
  };
  const fondo = (a, b) => {
    if (a > ALT_W) return ventana(a, b, 10.2, 12.2, 4.6, 8.8) ?? muro(a, b);
    if (b < ALTO) return ventana(a, b, 0.7, 2.1, 0.9, 2.3) ?? muro(a, b);
    return ventana(a, b, 1.2, 2.8, ALTO + 1.2, ALTO + 2.8) ?? red(a, b) ?? madera(a);
  };
  const lado = (a, b) => (b < ALTO ? (ventana(a, b, 5.0, 6.4, 1.5, 3.2) ?? muro(a, b)) : (pizarra(a, b) ?? madera(a)));
  r.box(-WALL_T, -WALL_T, 0, LW, 0, TECHO, BRICK, { grain: 0, step: 0.03, face: (f, a, b) => (f === 'front' ? fondo(a, b) : f === 'top' ? m[3] : m[1]) });
  r.box(-WALL_T, 0, 0, 0, ALT_D, TECHO, BRICK, { grain: 0, step: 0.03, face: (f, a, b) => (f === 'side' ? lado(a, b) : f === 'top' ? m[3] : m[1]) });
  r.box(-WALL_T, ALT_D, 0, 0, LD, ALTO, BRICK, { grain: 0, step: 0.03, face: (f, a, b) => (f === 'side' ? lado(a, b) : f === 'top' ? m[3] : m[1]) });

  // ── La escalera, peldaño a peldaño, y su barandilla ──
  const paso = (LW - ALT_W) / ESC.peldanos;
  const sube = ALTO / ESC.peldanos;
  for (let k = 0; k < ESC.peldanos; k += 1) {
    const x1 = LW - k * paso;
    const z = (k + 1) * sube;
    box(x1 - paso, ESC.y0, k * sube, x1, ESC.y1, z, PLANK, { seed: k, grain: 1 });
    box(x1 - 0.03, ESC.y1, z, x1, ESC.y1 + 0.05, z + 0.9, IRON);
    box(x1 - paso, ESC.y1, z + 0.86, x1, ESC.y1 + 0.06, z + 0.92, IRON);
  }

  // ── El forjado del altillo: tablas por arriba y, de frente, la viga con el rótulo ──
  const rotulo = (a, b) => {
    const X0 = 0.9;
    const Z0 = ALTO - FORJADO + 0.06;
    const PX = 0.135;
    const col = Math.floor((a - X0) / PX);
    const fil = 4 - Math.floor((b - Z0) / PX);
    const letra = 'LONJA'[Math.floor(col / 6)];
    if (letra && col >= 0 && col % 6 < 5 && fil >= 0 && fil < 5 && LETRAS[letra][fil][col % 6] === '1') return rgb(...BRASS);
    return a > X0 - 0.2 && a < X0 + 4.1 ? rgb(...GREEN) : tabla[1];
  };
  const tablas = (a, b) => {
    const fila = Math.floor(b * 2.2);
    const u = a + (fila % 3) * 0.7;
    if ((b * 2.2) % 1 < 0.07 || u % 2.4 < 0.04) return tabla[1];
    return tabla[noise(Math.floor(u / 2.4), fila) > 0.55 ? 4 : 3];
  };
  r.box(0, 0, ALTO - FORJADO, ALT_W, ALT_D, ALTO, PLANK, { grain: 0, step: 0.03, face: (f, a, b) => (f === 'top' ? tablas(a, b) : f === 'front' ? rotulo(a, b) : tabla[1]) });
  // La columna de la derecha va hacia dentro: en la esquina taparía los puestos del fondo
  box(ALT_W - 0.2, 3.1, 0, ALT_W - 0.02, 3.28, ALTO - FORJADO, IRON);
  box(ALT_W - 0.3, 3.0, 0, ALT_W + 0.08, 3.38, 0.14, IRON);
  for (const x of [0.3]) {
    box(x - 0.09, ALT_D - 0.18, 0, x + 0.09, ALT_D, ALTO - FORJADO, IRON);
    box(x - 0.2, ALT_D - 0.28, 0, x + 0.2, ALT_D + 0.08, 0.14, IRON);
  }

  // ── La nave: los puestos que hay y, en los sitios que sobran, un puesto tapado ──
  SITIOS.forEach((sitio, i) => {
    const p = puestos[i];
    conId(i + 1, () => puesto(sitio, p ? { toldo: p.color ?? TOLDOS[p.tono % TOLDOS.length], muebles: p.muebles, avatar: p.personaje, seed: i + 2 } : { seed: i + 2 }));
  });
  // La mesa de Remedios: la balanza y la campana
  conId(ID_REMEDIOS, () => {
    persona(REMEDIOS, { x: 7.3, y: 4.9, facing: 0 });
    box(6.2, 5.35, 0, 8.4, 6.05, 0.95, WOOD, { seed: 31, grain: 1 });
    box(6.14, 5.29, 0.95, 8.46, 6.11, 1.03, WOOD_D);
    box(7.72, 5.5, 1.03, 7.92, 5.7, 1.08, BRASS);
    box(7.78, 5.56, 1.08, 7.86, 5.64, 1.24, BRASS, { glow: true });
    box(6.42, 5.56, 1.03, 6.62, 5.76, 1.32, IRON);
    box(6.24, 5.6, 1.32, 6.8, 5.72, 1.36, BRASS);
  });
  farol(4.2, 3.3, 3.4, ALTO - FORJADO);
  farol(6.6, 3.3, 3.4, ALTO - FORJADO);
  farola(4.6, 5.6);
  farola(11.8, 6.4);
  // Cajas, un carrito y el gato de la lonja, que duerme donde quiere
  for (const [x, y, n] of [
    [4.2, 7.2, 2],
    [5.0, 7.4, 1],
    [12.5, 7.3, 3],
  ])
    for (let k = 0; k < n; k += 1) box(x - 0.34, y - 0.34, k * 0.5, x + 0.34, y + 0.34, k * 0.5 + 0.48, WOOD, { seed: x + k, grain: 1 });
  gato(5.0, 7.4, 0.48);
  box(7.0, 6.9, 0.3, 8.6, 7.7, 0.72, WOOD, { grain: 1 });
  for (const x of [7.2, 8.4]) box(x - 0.05, 6.82, 0, x + 0.05, 7.78, 0.3, IRON);
  box(7.3, 7.1, 0.72, 8.0, 7.5, 1.12, CREAM);

  // ── El altillo ──
  planta(ALTO);
  // La barandilla del borde, con el hueco de la escalera en el costado
  box(0, ALT_D - 0.1, 0.9, ALT_W, ALT_D - 0.02, 1.0, IRON);
  for (let x = 0.4; x < ALT_W; x += 0.8) box(x, ALT_D - 0.09, 0, x + 0.06, ALT_D - 0.03, 0.9, IRON);
  box(ALT_W - 0.1, ESC.y1 + 0.1, 0.9, ALT_W - 0.02, ALT_D, 1.0, IRON);
  for (let y = ESC.y1 + 0.1; y < ALT_D; y += 0.8) box(ALT_W - 0.09, y, 0, ALT_W - 0.03, y + 0.06, 0.9, IRON);
  // Tu puesto, más ancho que los de abajo: caben tus tres ofertas
  conId(ID_PUESTO, () => puesto({ x: 4.6, y: 2.5, frontal: true }, { toldo: toldo ?? BRASS, muebles: ofertas, avatar: personaje, seed: 41, ancho: 1.5 }));
  // El atril con el libro de cuentas
  conId(ID_LIBRO, () => {
    box(1.7, 2.6, 0, 2.0, 2.9, 1.05, WOOD_D);
    box(1.35, 2.4, 1.05, 2.35, 3.1, 1.13, WOOD);
    box(1.45, 2.5, 1.13, 2.25, 3.0, 1.2, CREAM);
    box(1.84, 2.5, 1.13, 1.86, 3.0, 1.21, WOOD_D);
  });
  // Tu almacén: una caja por copia libre (hasta nueve) y, delante, lo primero que tienes para ofrecer
  const ids = Object.keys(libres);
  const copias = Object.values(libres).reduce((n, c) => n + c, 0);
  for (let k = 0; k < Math.min(9, copias); k += 1) {
    const x = 6.7 + (k % 3) * 0.8;
    const y = 0.8 + (Math.floor(k / 3) % 2) * 0.8;
    const z = k >= 6 ? 0.56 : 0;
    box(x - 0.34, y - 0.34, z, x + 0.34, y + 0.34, z + 0.5, [176, 132, 84], { seed: k, grain: 1 });
    box(x - 0.36, y - 0.06, z + 0.5, x + 0.36, y + 0.06, z + 0.53, CREAM);
  }
  if (ids[0]) mueble(ids[0], 7.6, 3.2, 0, 1.2, 7);
  // Un rollo de cuerda
  box(0.5, 3.3, 0, 1.2, 4.0, 0.3, [190, 164, 112], { seed: 5, grain: 1 });
  box(0.7, 3.5, 0.3, 1.0, 3.8, 0.34, WOOD_D);
  farol(2.6, 2.4, 2.6, TECHO - ALTO);
  farol(6.6, 2.4, 2.6, TECHO - ALTO);
  planta(0);
  return lights;
}

function frameOf() {
  const probe = createRaster({ W: 1, H: 1, S: S_L, yaw: YAW, ox: 0, oy: 0 });
  const pts = [
    [LW, LD, 0],
    [LW, -WALL_T, 0],
    [-WALL_T, LD, 0],
    [-WALL_T, LD, ALTO],
    [-WALL_T, -WALL_T, TECHO],
    [LW, -WALL_T, TECHO],
    [-WALL_T, ALT_D, TECHO],
  ].map(([x, y, z]) => probe.project(x, y, z));
  const minX = Math.min(...pts.map((p) => p.sx));
  const maxX = Math.max(...pts.map((p) => p.sx));
  const minY = Math.min(...pts.map((p) => p.sy));
  const maxY = Math.max(...pts.map((p) => p.sy));
  return { W: Math.ceil(maxX - minX) + 6, H: Math.ceil(maxY - minY) + 6, ox: Math.round(3 - minX), oy: Math.round(3 - minY) };
}

const FRAME = frameOf();
export const LONJA_W = FRAME.W;
export const LONJA_H = FRAME.H;
let cache = { key: null, value: null };

function zonas(r, ids) {
  const spots = {};
  const outlines = {};
  for (const [nombre, id] of Object.entries(ids)) {
    let [x0, y0, x1, y1] = [Infinity, Infinity, -1, -1];
    for (let i = 0; i < r.ids.length; i += 1) {
      if ((r.ids[i] & ~GLOW) !== id) continue;
      const x = i % r.W;
      const y = (i / r.W) | 0;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
    if (x1 < 0) continue;
    spots[nombre] = { left: x0 / r.W, top: y0 / r.H, width: (x1 - x0 + 1) / r.W, height: (y1 - y0 + 1) / r.H };
    outlines[nombre] = outlineOf(r, id);
  }
  // Qué hay bajo un toque, por píxeles: los recuadros de los puestos se pisan unos a otros
  const nombres = Object.fromEntries(Object.entries(ids).map(([nombre, id]) => [id, nombre]));
  const mapa = r.ids.slice();
  const { W, H } = r;
  const hit = (fx, fy) => {
    const cx = Math.floor(fx * W);
    const cy = Math.floor(fy * H);
    for (const [dx, dy] of [
      [0, 0],
      [-2, 0],
      [2, 0],
      [0, -2],
      [0, 2],
    ]) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const nombre = nombres[mapa[y * W + x] & ~GLOW];
      if (nombre) return nombre;
    }
    return null;
  };
  return { spots, outlines, hit };
}

/**
 * La Lonja entera. `puestos[k]` = { personaje, muebles, tono, color } (hasta cinco); el resto, lo tuyo: { personaje, toldo,
 * ofertas (ids), hechos, tope, libres }. Devuelve { scene, spots, outlines, hit }.
 */
export function renderLonja(datos) {
  const key = JSON.stringify(datos);
  if (cache.key === key) return cache.value;
  const r = createRaster({ W: FRAME.W, H: FRAME.H, S: S_L, yaw: YAW, ox: FRAME.ox, oy: FRAME.oy });
  r.clear(0);
  const lights = buildLonja(r, datos);
  r.applyShadows();
  r.bakeOcclusion();
  r.shadeEdges();
  evening(r, lights, 84);
  const ids = Object.fromEntries(datos.puestos.slice(0, SITIOS.length).map((_, i) => [`p${i}`, i + 1]));
  const { spots, outlines, hit } = zonas(r, { ...ids, remedios: ID_REMEDIOS, puesto: ID_PUESTO, libro: ID_LIBRO });
  cache = { key, value: { scene: toDataURL(r, () => rgb(16, 12, 20)), spots, outlines, hit } };
  return cache.value;
}
