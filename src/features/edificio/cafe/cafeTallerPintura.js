// El café-librería del bajo, 1.133: el libro del taller, pintado píxel a píxel (la tapa, las dos páginas al abrirlo y la
// ficha «antes / después»). Lo que se ve sale del encargo (`encargoDe`, con su libro y sus daños) y de lo que va quedando de
// cada gesto (`vista` de `crearGestoTaller`): el polvo y el moho que se van, las manchas que se borran, el pliego que se alisa,
// la cola que brilla en el lomo y el oro que se enciende letra a letra. Las cubiertas son nuestras (tela, filete y un adorno
// dibujado), nunca la de una edición real. Solo lienzos: sin React ni Three (lo usan la escena y el cuadro del taller).
import { LIBRO_TALLER, MEDIDAS_TALLER, PLIEGUE, TAPA_PX, TRAMOS_PLIEGUE, arrugaEn, letrasTapa, manchasDe, polvoInicial, semillaEncargo } from './cafeTallerGestos';

export { TAPA_PX };
/** Los píxeles de las dos páginas, con el libro abierto. */
export const PLIEGO_PX = { w: 160, h: 110 };
/** El lomo, en la tapa: la franja de la izquierda (lo que se encola). */
const LOMO_U = MEDIDAS_TALLER.lomoAncho;

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const mezcla = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * clamp(t)));
const oscuro = (c, k) => c.map((v) => Math.round(v * k));
const claro = (c, d) => c.map((v) => Math.min(255, v + d));
const hash = (x, y, s = 0) => {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
// Un ruido suave (valor por casillas, interpolado) para las manchas de humedad, el jaspeado de la guarda y el moho
function ruido(x, y, s = 0) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash(x0, y0, s);
  const b = hash(x0 + 1, y0, s);
  const c = hash(x0, y0 + 1, s);
  const d = hash(x0 + 1, y0 + 1, s);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

const ORO = [232, 190, 92];
const ORO_L = [255, 232, 156];
const ORO_D = [168, 124, 52];
const ORO_VIEJO = [176, 140, 74];
const POLVO = [176, 166, 148];
const MOHO = [118, 132, 100];
const MOHO_D = [86, 100, 78];
const PAPEL = [236, 226, 200];
const PAPEL_D = [214, 200, 168];
const TINTA = [70, 56, 48];
const CARTON = [150, 128, 100];
const HILO = [226, 214, 186];
const COLA = [188, 142, 80];
const COLA_BRILLO = [236, 206, 146];
const MIGA = [222, 206, 200];
const SELLO = [132, 50, 44];

/** Un lienzo de `w` × `h` (o el que ya había, si se pasa). */
export function lienzo(w, h, c = null) {
  const canvas = c ?? document.createElement('canvas');
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  return canvas;
}
function buffer(w, h) {
  const data = new Uint8ClampedArray(w * h * 4);
  const put = (x, y, [r, g, b], a = 1) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = ((y | 0) * w + (x | 0)) * 4;
    if (a >= 1) {
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    } else if (a > 0) {
      data[i] += (r - data[i]) * a;
      data[i + 1] += (g - data[i + 1]) * a;
      data[i + 2] += (b - data[i + 2]) * a;
    }
    data[i + 3] = 255;
  };
  const get = (x, y) => {
    const i = ((y | 0) * w + (x | 0)) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };
  return { data, put, get, w, h };
}
function volcar(canvas, buf) {
  canvas.getContext('2d').putImageData(new ImageData(buf.data, buf.w, buf.h), 0, 0);
  return canvas;
}

// ── Los adornos de las cubiertas: dibujos nuestros, en una cuadrícula de -1 a 1 (y hacia abajo) ──
const ADORNOS = {
  molino: (x, y) => {
    const r = Math.hypot(x, y + 0.2);
    const aspa = (Math.abs(x - (y + 0.2)) < 0.13 || Math.abs(x + (y + 0.2)) < 0.13) && r < 0.92 && r > 0.12;
    const torre = y > -0.05 && y < 0.95 && Math.abs(x) < 0.16 + (y + 0.05) * 0.26;
    const puerta = y > 0.62 && Math.abs(x) < 0.08;
    return (aspa && !(torre && y > 0)) || (torre && !puerta) || r < 0.1;
  },
  torre: (x, y) => {
    const cuerpo = Math.abs(x) < 0.34 && y > -0.42 && y < 0.92;
    const almenas = Math.abs(x) < 0.5 && y > -0.74 && y <= -0.42 && ((x + 0.5) * 3.3) % 1 < 0.55;
    const puerta = Math.abs(x) < 0.13 && y > 0.5 && Math.hypot(x, y - 0.5) > 0 && (y > 0.58 || Math.hypot(x, y - 0.58) < 0.13);
    const ventana = Math.abs(x) < 0.07 && y > -0.2 && y < 0.08;
    return almenas || (cuerpo && !puerta && !ventana);
  },
  golondrina: (x, y) => {
    const ala = Math.abs(y - (0.62 * Math.abs(x) ** 1.3 - 0.32)) < 0.14 * (1 - Math.abs(x) * 0.55) && Math.abs(x) < 0.92;
    const cola = y > 0.0 && y < 0.62 && (Math.abs(x - (y - 0.0) * 0.5) < 0.07 || Math.abs(x + (y - 0.0) * 0.5) < 0.07);
    return ala || cola || Math.hypot(x, y + 0.24) < 0.16;
  },
  flor: (x, y) => {
    const r = Math.hypot(x, y + 0.12);
    const a = Math.atan2(y + 0.12, x);
    const petalo = r < 0.3 + 0.38 * Math.abs(Math.cos(2.5 * a));
    const tallo = Math.abs(x) < 0.06 && y > 0.4 && y < 0.95;
    return (petalo && r > 0.13) || r < 0.07 || tallo;
  },
  hoja: (x, y) => {
    const a = (x - y) / Math.SQRT2;
    const b = (x + y) / Math.SQRT2;
    const limbo = (a / 0.88) ** 2 + (b / 0.4) ** 2 < 1;
    const nervio = Math.abs(b) < 0.05 && a > -0.8;
    const tallo = Math.abs(b) < 0.06 && a < -0.8 && a > -1.05;
    return (limbo && !nervio) || tallo;
  },
  rosa: (x, y) => {
    const r = Math.hypot(x, y + 0.18);
    const a = Math.atan2(y + 0.18, x) / (Math.PI * 2);
    const capullo = r < 0.55 && (((a + r * 1.7) % 1) + 1) % 1 < 0.6;
    const tallo = Math.abs(x) < 0.06 && y > 0.35 && y < 0.95;
    const hoja = Math.hypot(x - 0.24, y - 0.62) < 0.16 && x > 0.06;
    return capullo || tallo || hoja;
  },
  espada: (x, y) => {
    const hoja = Math.abs(x) < 0.1 - (y < -0.75 ? (-0.75 - y) * 0.4 : 0) && y > -0.95 && y < 0.36;
    const guarda = Math.abs(y - 0.42) < 0.07 && Math.abs(x) < 0.46;
    const puno = Math.abs(x) < 0.07 && y > 0.42 && y < 0.78;
    return hoja || guarda || puno || Math.hypot(x, y - 0.86) < 0.12;
  },
  barca: (x, y) => {
    const casco = y > 0.26 && y < 0.58 && Math.abs(x) < 0.86 - (y - 0.26) * 1.1;
    const mastil = Math.abs(x) < 0.05 && y > -0.84 && y <= 0.26;
    const vela = x > 0.1 && y > -0.74 && y < 0.16 && x < 0.1 + (y + 0.74) * 0.72;
    const agua = Math.abs(y - 0.78 - 0.06 * Math.sin(x * 9)) < 0.05 && Math.abs(x) < 0.9;
    return casco || mastil || vela || agua;
  },
  estrella: (x, y) => {
    const r = Math.hypot(x, y);
    const k = ((Math.atan2(y, x) + Math.PI / 2) * 5) / (Math.PI * 2);
    const f = Math.abs((((k % 1) + 1) % 1) - 0.5) * 2;
    return r < 0.36 + 0.56 * (1 - f) ** 1.6;
  },
  llave: (x, y) => {
    const ojo = Math.abs(Math.hypot(x + 0.52, y) - 0.28) < 0.1;
    const cana = Math.abs(y) < 0.08 && x > -0.26 && x < 0.86;
    const dientes = (x > 0.46 && x < 0.58 && y > 0 && y < 0.32) || (x > 0.7 && x < 0.86 && y > 0 && y < 0.26);
    return ojo || cana || dientes;
  },
  ola: (x, y) => [-0.45, 0.05, 0.55].some((o) => Math.abs(y - o - 0.2 * Math.sin(x * 3.3 + o * 2)) < 0.1) && Math.abs(x) < 0.9,
  pluma: (x, y) => {
    const t = clamp((0.75 - y) / 1.6);
    const ex = -0.55 + t * 1.1 - x;
    const ancho = t > 0.18 ? 0.26 * Math.sin(Math.PI * ((t - 0.18) / 0.82)) + 0.05 : 0.04;
    const barbas = Math.abs(ex) < ancho && ((t * 14) % 1 < 0.8 || Math.abs(ex) < 0.05);
    return barbas && y > -0.9 && y < 0.92;
  },
  sol: (x, y) => {
    const r = Math.hypot(x, y);
    const a = Math.atan2(y, x);
    return r < 0.4 || (r > 0.55 && r < 0.95 && (((a * 6) / Math.PI) % 1 + 1) % 1 < 0.38);
  },
  luna: (x, y) => Math.hypot(x, y) < 0.8 && Math.hypot(x - 0.34, y - 0.14) > 0.62,
  taza: (x, y) => {
    const cuerpo = x > -0.62 && x < 0.34 && y > -0.12 && y < 0.56;
    const asa = Math.abs(Math.hypot(x - 0.42, y - 0.18) - 0.2) < 0.08 && x > 0.34;
    const plato = Math.abs(y - 0.7) < 0.07 && Math.abs(x + 0.12) < 0.78;
    const humo = y < -0.25 && y > -0.92 && [-0.36, 0.04].some((o) => Math.abs(x - o - 0.1 * Math.sin(y * 7)) < 0.06);
    return cuerpo || asa || plato || humo;
  },
  ancla: (x, y) => {
    const cana = Math.abs(x) < 0.08 && y > -0.62 && y < 0.62;
    const aro = Math.abs(Math.hypot(x, y + 0.76) - 0.15) < 0.07;
    const cepo = Math.abs(y + 0.44) < 0.07 && Math.abs(x) < 0.4;
    const brazos = Math.abs(Math.hypot(x, y - 0.06) - 0.62) < 0.09 && y > 0.28;
    const unas = Math.hypot(Math.abs(x) - 0.6, y - 0.3) < 0.12;
    return cana || aro || cepo || brazos || unas;
  },
};

/** El adorno de un libro, en un recuadro de `n` × `n` píxeles: un Set de "x,y". */
const adornoCache = new Map();
export function mascaraAdorno(nombre, n = 17) {
  const k = `${nombre}:${n}`;
  if (adornoCache.has(k)) return adornoCache.get(k);
  const f = ADORNOS[nombre] ?? ADORNOS.estrella;
  const out = new Set();
  for (let y = 0; y < n; y += 1) for (let x = 0; x < n; x += 1) if (f(((x + 0.5) / n) * 2 - 1, ((y + 0.5) / n) * 2 - 1)) out.add(`${x},${y}`);
  adornoCache.set(k, out);
  return out;
}
export const ADORNOS_TALLER = Object.keys(ADORNOS);

/** La letra de píxel del título (5 × 7): las mayúsculas y la Ñ (con su virgulilla, dos filas por encima). */
const FUENTE = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
};
FUENTE['Ñ'] = [...FUENTE.N];
const VIRGULILLA = ['.##.#', '#..#.'];
/** Las letras que sabe dibujar la tapa (las pruebas comprueban que caben todos los títulos). */
export const LETRAS_FUENTE = Object.keys(FUENTE);

/** Las letras del título, en píxeles de la tapa: [{ k, px: [[x, y]…] }] (una entrada por letra de `letrasTapa`). */
const letrasCache = new Map();
function letrasPx(tapa) {
  if (letrasCache.has(tapa)) return letrasCache.get(tapa);
  const out = letrasTapa(tapa).map((l) => {
    const px = [];
    (FUENTE[l.ch] ?? FUENTE.O).forEach((fila, dy) => [...fila].forEach((q, dx) => q === '#' && px.push([l.x + dx, l.y + dy])));
    if (l.ch === 'Ñ') VIRGULILLA.forEach((fila, dy) => [...fila].forEach((q, dx) => q === '#' && px.push([l.x + dx, l.y - 3 + dy])));
    return { k: l.k, px };
  });
  letrasCache.set(tapa, out);
  return out;
}

/** Lo de cada gesto al llegar el libro (lo que aún no se ha tocado): el polvo, las manchas, el pliego, la cola y el oro. */
export function vistasIniciales(encargo) {
  const semilla = semillaEncargo(encargo);
  const d = new Set(encargo?.danos ?? []);
  const ini = polvoInicial(semilla);
  return {
    polvo: d.has('polvo') ? { polvo: ini.polvo, moho: ini.moho, nube: [] } : null,
    manchas: d.has('manchas') ? { manchas: manchasDe(semilla).map((m) => ({ ...m, alfa: 1 })), migas: [], barrido: 0 } : null,
    arrugas: d.has('arrugas') ? { arruga: 1, tramos: new Array(TRAMOS_PLIEGUE).fill(1) } : null,
    cola: d.has('lomo') ? { cola: new Array(10).fill(0) } : null,
    prensa: d.has('lomo') ? { prensa: 0, angulo: 0 } : null,
    dorado: d.has('dorado') ? { oro: letrasTapa(encargo?.tapa ?? '').map(() => 0), letra: -1 } : null,
    exlibris: { exlibris: { baja: 0, presion: 0, sellado: false, u: 0.25, v: 0.5 } },
    pegado: !d.has('lomo'),
  };
}
/** Todo hecho (la ficha de «después»). */
export function vistasHechas(encargo, exlibris = null) {
  return { polvo: null, manchas: null, arrugas: null, cola: null, prensa: null, dorado: null, exlibris: { exlibris: exlibris ?? { baja: 0, presion: 1, sellado: true, u: 0.25, v: 0.5 } }, pegado: true };
}
/**
 * Las vistas de ahora: las iniciales, con lo que ya ha hecho cada gesto encima (`hechas`: { polvo, manchas, …, la vista de
 * cada gesto empezado o terminado }). El lomo queda pegado en cuanto empieza la prensa.
 */
export function vistasDe(encargo, hechas = {}) {
  const ini = vistasIniciales(encargo);
  const out = { ...ini };
  for (const [k, v] of Object.entries(hechas)) if (v && k in out && k !== 'pegado') out[k] = v;
  if (hechas.prensa) out.pegado = true;
  return out;
}

/**
 * La tapa: la tela gastada con su filete y el adorno, el título (borrado si es uno de los daños; el oro que se va
 * encendiendo), el lomo (despegado, la cola húmeda, o ya en su sitio) y, encima, el polvo y el moho.
 * `vistas`, de `vistasDe`; `encargo`, de `encargoDe`.
 */
export function pintarTapa(canvas, encargo, vistas = vistasIniciales(encargo)) {
  const { w, h } = TAPA_PX;
  const b = buffer(w, h);
  const tela = encargo?.tela ?? [120, 60, 50];
  const semilla = semillaEncargo(encargo);
  const viejo = (encargo?.danos ?? []).length > 0;
  const lomoX = Math.round(LOMO_U * w);
  // La tela: trama de hilos y el desgaste de las esquinas y los cantos
  for (let y = 0; y < h; y += 1)
    for (let x = 0; x < w; x += 1) {
      const trama = (x + y) % 2 ? 1.04 : 0.97;
      const borde = Math.min(x, y, w - 1 - x, h - 1 - y);
      const gastado = borde < 2 ? 0.82 : borde < 4 ? 0.92 : 1;
      const mancha = viejo ? 0.94 + ruido(x / 9, y / 9, semilla) * 0.1 : 1;
      let c = tela.map((v) => clamp(v * trama * gastado * mancha, 0, 255));
      // Las esquinas comidas: asoma el cartón
      const esquina = Math.min(Math.hypot(x - w + 1, y), Math.hypot(x - w + 1, y - h + 1));
      if (viejo && esquina < 3.2) c = mezcla(c, CARTON, 0.6);
      b.put(x, y, c);
    }
  // El filete en seco (más oscuro), a 5 px del borde, con un punto en cada esquina
  const fil = oscuro(tela, 0.72);
  for (let x = lomoX + 5; x < w - 5; x += 1) {
    b.put(x, 5, fil);
    b.put(x, h - 6, fil);
  }
  for (let y = 5; y < h - 5; y += 1) {
    b.put(lomoX + 5, y, fil);
    b.put(w - 6, y, fil);
  }
  // El adorno, dorado viejo, en el centro de lo que queda de tapa
  const n = 19;
  const ax = Math.round((lomoX + w) / 2 - n / 2);
  const ay = Math.round(h * 0.56 - n / 2);
  const ad = mascaraAdorno(encargo?.adorno ?? 'estrella', n);
  for (const k of ad) {
    const [x, y] = k.split(',').map(Number);
    const sombra = !ad.has(`${x},${y + 1}`);
    b.put(ax + x, ay + y, viejo && hash(x, y, semilla) < 0.18 ? oscuro(ORO_VIEJO, 0.8) : sombra ? oscuro(ORO_VIEJO, 0.82) : ORO_VIEJO);
  }
  // El título: dorado (sano), borrado (el daño) o encendiéndose letra a letra
  const borrado = (encargo?.danos ?? []).includes('dorado');
  const oro = vistas?.dorado?.oro ?? null;
  const ls = letrasPx(encargo?.tapa ?? '');
  const surco = oscuro(tela, 0.62);
  for (const l of ls) {
    const ys = l.px.map((p) => p[1]);
    const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
    const hecho = !borrado || (oro ? oro[l.k] >= 1 : true);
    const llena = oro ? oro[l.k] ?? 0 : 1;
    for (const [x, y] of l.px) {
      const arriba = !l.px.some((p) => p[0] === x && p[1] === y - 1);
      if (hecho) b.put(x, y, arriba ? ORO_L : y === y1 ? ORO_D : ORO);
      else {
        // Lo que se va dorando sube desde el pie de la letra
        const sube = y1 - (y1 - y0 + 1) * llena;
        if (llena > 0 && y >= sube) b.put(x, y, mezcla(ORO_D, ORO, llena));
        else b.put(x, y, hash(x, y, semilla + 5) < 0.12 ? oscuro(ORO_VIEJO, 0.86) : surco);
      }
    }
    // Un brillo al terminar cada letra (solo la primera fila de arriba, un píxel más claro)
    if (hecho && l.px.length) {
      const [tx, ty] = l.px[Math.floor(l.px.length * 0.3)];
      b.put(tx, ty, [255, 248, 214]);
    }
  }
  // El lomo: sano (tela más oscura con sus nervios), despegado (el cartón y los hilos) o con la cola húmeda
  const cola = vistas?.cola?.cola ?? null;
  // Pegado: sin ese daño, o en cuanto el libro entra en la prensa (la tela vuelve a su sitio)
  const pegado = vistas?.pegado ?? !(encargo?.danos ?? []).includes('lomo');
  for (let y = 0; y < h; y += 1)
    for (let x = 0; x < lomoX; x += 1) {
      if (pegado || !cola) {
        const nervio = [0.18, 0.38, 0.58, 0.78].some((v) => Math.abs(y - v * h) < 1.2);
        const c = oscuro(tela, x === lomoX - 1 ? 0.55 : nervio ? 1.12 : (x + y) % 2 ? 0.86 : 0.8);
        b.put(x, y, nervio && x === 1 ? claro(c, 24) : c);
      } else {
        // El cartón al aire, con los hilos del cosido y el borde roto de la tela
        const hilo = x % 4 === 1 && (y % 9 < 6);
        let c = hilo ? HILO : (x + y) % 3 ? CARTON : oscuro(CARTON, 0.88);
        const k = Math.min(cola.length - 1, Math.floor((y / h) * cola.length));
        const q = cola[k] ?? 0;
        if (q > 0) c = mezcla(c, COLA, Math.min(1, q) * 0.55);
        if (q >= 1 && (x + y * 3) % 11 === 0) c = COLA_BRILLO;
        b.put(x, y, c);
      }
    }
  // La cola de más rezuma por los cantos del lomo
  if (cola && !pegado) {
    cola.forEach((q, k) => {
      if (q <= MEDIDAS_TALLER.colaDeMas) return;
      const y = Math.round(((k + 0.5) / cola.length) * h);
      for (let d = 0; d < 3; d += 1) b.put(lomoX + d, y + (d % 2), COLA);
    });
  }
  // El polvo y el moho, por encima de todo
  const pv = vistas?.polvo ?? null;
  if (pv) {
    const { polvoCols: C, polvoFilas: F } = MEDIDAS_TALLER;
    const val = (arr, u, v) => {
      const cx = clamp(u * C - 0.5, 0, C - 1);
      const cy = clamp(v * F - 0.5, 0, F - 1);
      const [x0, y0] = [Math.floor(cx), Math.floor(cy)];
      const [x1, y1] = [Math.min(C - 1, x0 + 1), Math.min(F - 1, y0 + 1)];
      const [fx, fy] = [cx - x0, cy - y0];
      const a = arr[y0 * C + x0] * (1 - fx) + arr[y0 * C + x1] * fx;
      const c = arr[y1 * C + x0] * (1 - fx) + arr[y1 * C + x1] * fx;
      return a * (1 - fy) + c * fy;
    };
    for (let y = 0; y < h; y += 1)
      for (let x = 0; x < w; x += 1) {
        const u = (x + 0.5) / w;
        const v = (y + 0.5) / h;
        const p = val(pv.polvo, u, v);
        if (p > 0.02) {
          // Una capa de polvo tramada: más densa donde hay más, con motas sueltas
          const d = hash(x, y, 77);
          b.put(x, y, POLVO, Math.min(0.82, p * 0.78) * (d < p ? 1 : 0.55));
          if (d > 0.985 && p > 0.3) b.put(x, y, claro(POLVO, 30));
        }
        const m = val(pv.moho, u, v);
        if (m > 0.04) {
          const forma = ruido(x / 2.6, y / 2.6, semilla + 3);
          if (forma < m * 0.95) b.put(x, y, forma < m * 0.45 ? MOHO_D : MOHO, Math.min(1, m * 1.4));
        }
      }
  }
  return volcar(lienzo(w, h, canvas), b);
}

/**
 * La letra del sello (1.133.2): de 5 de alto y casi siempre 3 de ancho (la I, de uno; la N, de cuatro; la M y la W, de cinco),
 * para que quepa el nombre del café. Las tildes van una fila por encima.
 */
const LETRA_SELLO = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['#', '#', '#', '#', '#'],
  J: ['..#', '..#', '..#', '#.#', '.#.'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
  N: ['#..#', '##.#', '#.##', '#..#', '#..#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  Q: ['.#.', '#.#', '#.#', '##.', '.##'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  Z: ['###', '..#', '.#.', '#..', '###'],
};
export const LETRAS_SELLO = Object.keys(LETRA_SELLO);
const AGUDA = String.fromCharCode(0x301);
const VIRGULILLA_S = String.fromCharCode(0x303);
const anchoLetra = (ch) => (ch === ' ' ? 1 : (LETRA_SELLO[ch]?.[0].length ?? 0));
/** Las letras de un texto del sello, en mayúsculas y con su tilde aparte: [{ ch, tilde: null | 'aguda' | 'virgulilla' }]. */
function letrasSello(txt) {
  const out = [];
  for (const c of String(txt ?? '').toUpperCase().normalize('NFD')) {
    if (c === AGUDA && out.length) out[out.length - 1].tilde = 'aguda';
    else if (c === VIRGULILLA_S && out.length) out[out.length - 1].tilde = 'virgulilla';
    else if (c === ' ' || LETRA_SELLO[c]) out.push({ ch: c, tilde: null });
  }
  return out;
}
/** Lo que ocupa un texto del sello, en píxeles (un píxel entre letra y letra). */
export const anchoSello = (ls) => ls.reduce((s, l, i) => s + anchoLetra(l.ch) + (i ? 1 : 0), 0);
function textoSello(b, ls, x0, y0, put) {
  let x = x0;
  for (const l of ls) {
    const w = anchoLetra(l.ch);
    (LETRA_SELLO[l.ch] ?? []).forEach((row, dy) => [...row].forEach((q, dx) => q === '#' && put(x + dx, y0 + dy)));
    if (l.tilde === 'aguda') put(x + Math.min(w - 1, Math.floor(w / 2) + 1), y0 - 2);
    if (l.tilde === 'virgulilla') for (let dx = 1; dx < w - 1; dx += 1) put(x + dx, y0 - 2);
    x += w + 1;
  }
}

/** El ex libris del taller: su ancho (px del pliego) y lo de dentro que no cambia. */
export const EXLIBRIS_PX = { w: 58, dentro: 50 };
/**
 * El nombre del café, partido en renglones que quepan en el ex libris (hasta tres, por palabras): [[letras], …]. Sin nombre,
 * «El taller».
 */
export function renglonesExlibris(nombre) {
  const palabras = String(nombre || 'El taller')
    .split(/\s+/)
    .filter(Boolean)
    .map(letrasSello);
  const out = [];
  let linea = [];
  for (const p of palabras) {
    const prueba = linea.length ? [...linea, { ch: ' ', tilde: null }, ...p] : p;
    if (linea.length && anchoSello(prueba) > EXLIBRIS_PX.dentro) {
      out.push(linea);
      linea = p;
    } else linea = prueba;
  }
  if (linea.length) out.push(linea);
  return out.slice(0, 3);
}
/** El alto del ex libris (px del pliego): crece un renglón por cada línea del nombre. */
export const altoExlibris = (nombre) => 43 + 8 * (renglonesExlibris(nombre).length - 1);
/** El emblema del ex libris: una taza humeante sobre un libro abierto (24 × 14). */
export const EMBLEMA_EXLIBRIS = [
  '..........#..#..........',
  '.........#..#...........',
  '..........#..#..........',
  '........########........',
  '........#......###......',
  '........#......#.#......',
  '........#......###......',
  '.........######.........',
  '......############......',
  '........................',
  '.#######........#######.',
  '#.......###..###.......#',
  '#..........##..........#',
  '###########..###########',
];
const EX_LIBRIS = letrasSello('EX LIBRIS');

/**
 * El ex libris en la guarda (1.133.2, Francisco: «el sello necesito que sea mas impactante»): un recuadro de doble filete con
 * «EX LIBRIS», la taza sobre el libro y el nombre del café; la tinta entra según se aprieta (`presion`) y, recién puesto, un
 * brillo de tinta fresca la cruza (`brillo`, de 0 a 1).
 */
function pintarExlibris(b, ex, nombre) {
  const { w: PW, h: PH } = PLIEGO_PX;
  const a = ex.sellado ? 1 : clamp(ex.presion * 1.1);
  if (a <= 0) return;
  const renglones = renglonesExlibris(nombre);
  const W = EXLIBRIS_PX.w;
  const H = altoExlibris(nombre);
  const cx = clamp(Math.round(ex.u * PW), 32, 44);
  const cy = clamp(Math.round(ex.v * PH), Math.ceil(H / 2) + 3, PH - 4 - Math.ceil(H / 2));
  const x0 = cx - Math.floor(W / 2);
  const y0 = cy - Math.floor(H / 2);
  const [x1, y1] = [x0 + W - 1, y0 + H - 1];
  const brillo = ex.brillo > 0 && ex.brillo < 1 ? ex.brillo * (W + H) : null;
  const fresco = (x, y) => brillo != null && Math.abs(x - x0 + (y - y0) - brillo) < 2.5;
  const tinta = (x, y) => b.put(x, y, fresco(x, y) ? [206, 108, 94] : SELLO, a * (hash(x, y, 8) < 0.12 ? 0.5 : 1));
  // El papel del recuadro (las esquinas, escalonadas)
  for (let y = y0; y <= y1; y += 1)
    for (let x = x0; x <= x1; x += 1) {
      const esquina = (x === x0 || x === x1) && (y === y0 || y === y1);
      if (!esquina) b.put(x, y, fresco(x, y) ? [255, 248, 232] : [238, 228, 206], a * 0.94);
    }
  // El doble filete
  for (let x = x0 + 1; x < x1; x += 1) {
    tinta(x, y0);
    tinta(x, y1);
    if (x > x0 + 2 && x < x1 - 2) {
      tinta(x, y0 + 2);
      tinta(x, y1 - 2);
    }
  }
  for (let y = y0 + 1; y < y1; y += 1) {
    tinta(x0, y);
    tinta(x1, y);
    if (y > y0 + 2 && y < y1 - 2) {
      tinta(x0 + 2, y);
      tinta(x1 - 2, y);
    }
  }
  for (const [x, y] of [
    [x0 + 1, y0 + 1],
    [x1 - 1, y0 + 1],
    [x0 + 1, y1 - 1],
    [x1 - 1, y1 - 1],
  ])
    tinta(x, y);
  // «EX LIBRIS», un filete de puntos con su rombo, el emblema y el nombre del café
  const centrado = (ls) => cx - Math.floor(anchoSello(ls) / 2);
  textoSello(b, EX_LIBRIS, centrado(EX_LIBRIS), y0 + 5, tinta);
  for (let x = x0 + 8; x <= x1 - 8; x += 2) if (Math.abs(x - cx) > 2) tinta(x, y0 + 12);
  for (const [dx, dy] of [
    [0, -1],
    [-1, 0],
    [1, 0],
    [0, 1],
  ])
    tinta(cx + dx, y0 + 12 + dy);
  const ex0 = cx - 12;
  EMBLEMA_EXLIBRIS.forEach((row, dy) => [...row].forEach((q, dx) => q === '#' && tinta(ex0 + dx, y0 + 15 + dy)));
  renglones.forEach((ls, i) => textoSello(b, ls, centrado(ls), y0 + 32 + i * 8, tinta));
  for (const dx of [-3, 0, 3]) tinta(cx + dx, y1 - 5);
}

/** La portadilla (título y autor impresos, sin medias tintas), por libro. */
const portadillaCache = new Map();
function portadillaPx(encargo) {
  const k = encargo?.libro ?? 0;
  if (portadillaCache.has(k)) return portadillaCache.get(k);
  const { w, h } = PLIEGO_PX;
  const out = [];
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = w / 2;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w / 2, h);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const titulo = String(encargo?.titulo ?? '').toUpperCase();
    // El título, partido en dos renglones si no cabe
    const palabras = titulo.split(' ');
    const lineas = [];
    let linea = '';
    ctx.font = "bold 7px Georgia, 'Times New Roman', serif";
    for (const p of palabras) {
      const prueba = linea ? `${linea} ${p}` : p;
      if (ctx.measureText(prueba).width > w / 2 - 16 && linea) {
        lineas.push(linea);
        linea = p;
      } else linea = prueba;
    }
    if (linea) lineas.push(linea);
    lineas.slice(0, 3).forEach((l, i) => ctx.fillText(l, w / 4, 30 + i * 9, w / 2 - 12));
    ctx.font = "italic 6px Georgia, 'Times New Roman', serif";
    ctx.fillText(String(encargo?.autor ?? ''), w / 4, 30 + Math.min(3, lineas.length) * 9 + 6, w / 2 - 14);
    const img = ctx.getImageData(0, 0, w / 2, h).data;
    for (let y = 0; y < h; y += 1) for (let x = 0; x < w / 2; x += 1) if (img[(y * (w / 2) + x) * 4] > 110) out.push([x, y]);
  }
  portadillaCache.set(k, out);
  return out;
}

/**
 * Las dos páginas, con el libro abierto: a la izquierda, la guarda jaspeada (donde va el ex libris); a la derecha, la
 * portadilla. Encima, las manchas (cerco de taza, lápiz y grasa), las migas de la goma, el pliego que se alisa y el sello.
 */
export function pintarPliego(canvas, encargo, vistas = vistasIniciales(encargo)) {
  const { w, h } = PLIEGO_PX;
  const b = buffer(w, h);
  const tela = encargo?.tela ?? [120, 60, 50];
  const semilla = semillaEncargo(encargo);
  const viejo = (encargo?.danos ?? []).length > 0;
  const mitad = w / 2;
  const guardaA = claro(tela, 40);
  const guardaB = [226, 210, 176];
  for (let y = 0; y < h; y += 1)
    for (let x = 0; x < w; x += 1) {
      const pliegue = Math.abs(x + 0.5 - mitad);
      let c;
      if (x < mitad) {
        // La guarda: un jaspeado de aguas en dos tonos, con su margen de tela (la vuelta de la tapa)
        if (x < 3 || y < 3 || y > h - 4) c = oscuro(tela, (x + y) % 2 ? 0.92 : 0.86);
        else {
          const q = ruido(x / 7 + Math.sin(y / 6) * 0.8, y / 11, 31);
          c = q > 0.62 ? guardaA : q > 0.5 ? mezcla(guardaA, guardaB, 0.5) : guardaB;
        }
      } else {
        // La página: el papel, algo tostado en los bordes si es viejo
        const borde = Math.min(w - 1 - x, y, h - 1 - y);
        c = viejo && borde < 3 ? PAPEL_D : PAPEL;
        if (viejo && ruido(x / 10, y / 10, semilla + 1) > 0.8) c = mezcla(c, PAPEL_D, 0.5);
      }
      // La sombra del lomo, en el centro
      if (pliegue < 4) c = oscuro(c, 0.78 + pliegue * 0.05);
      b.put(x, y, c);
    }
  // La portadilla
  for (const [x, y] of portadillaPx(encargo)) b.put(mitad + x, y, TINTA);
  // Un filete y el pie de imprenta, de adorno
  for (let x = mitad + 26; x < w - 26; x += 1) b.put(x, 76, oscuro(PAPEL_D, 0.86));
  for (let x = mitad + 32; x < w - 32; x += 2) b.put(x, 96, oscuro(PAPEL_D, 0.7));
  // El pliego que se alisa: luz a un lado y sombra al otro, más fuerte cuanto más arrugado
  const ar = vistas?.arrugas ?? null;
  if (ar) {
    const [ax, ay] = [PLIEGUE.a[0] * w, PLIEGUE.a[1] * h];
    const [bx, by] = [PLIEGUE.b[0] * w, PLIEGUE.b[1] * h];
    const L = Math.hypot(bx - ax, by - ay);
    const [nx, ny] = [-(by - ay) / L, (bx - ax) / L];
    for (let y = 0; y < h; y += 1)
      for (let x = mitad + 1; x < w; x += 1) {
        const s = ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / (L * L);
        if (s < -0.06 || s > 1.06) continue;
        const d = (x - ax) * nx + (y - ay) * ny;
        // Cada tramo, lo que le queda por alisar (1.133.2); el relieve lo pone la escena
        const k = clamp(ar.tramos ? arrugaEn(ar.tramos, s) : (ar.arruga ?? 1)) * (1 - Math.abs(s - 0.5) * 0.6);
        if (k <= 0) continue;
        // Arrugas finas que salen del pliegue, en abanico
        const onda = Math.sin(s * 34 + d * 0.9) * 0.5 + 0.5;
        if (Math.abs(d) < 1) b.put(x, y, d < 0 ? [252, 246, 228] : oscuro(PAPEL, 0.7), k);
        else if (Math.abs(d) < 5 + k * 6 && onda > 0.7) b.put(x, y, d < 0 ? [248, 240, 220] : oscuro(PAPEL, 0.84), k * (1 - Math.abs(d) / (11 + k * 6)));
      }
  }
  // Las manchas: un cerco de taza, un garabato de lápiz y una de grasa
  const mv = vistas?.manchas ?? null;
  if (mv) {
    const W = LIBRO_TALLER.ancho * 2;
    for (const m of mv.manchas) {
      if (m.alfa <= 0) continue;
      const [cx, cy] = [m.u * w, m.v * h];
      const r = (m.r / W) * w;
      for (let y = Math.floor(cy - r - 2); y <= cy + r + 2; y += 1)
        for (let x = Math.floor(cx - r - 2); x <= cx + r + 2; x += 1) {
          const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
          if (m.tipo === 'anillo') {
            const aro = Math.abs(d - r * 0.78);
            if (aro < 1.3 + ruido(x / 2, y / 2, 4) * 0.8) b.put(x, y, [150, 104, 62], m.alfa * (aro < 0.6 ? 0.85 : 0.5));
            else if (d < r * 0.78 && hash(x, y, 2) < 0.12) b.put(x, y, [196, 160, 112], m.alfa * 0.4);
          } else if (m.tipo === 'lapiz') {
            // Un garabato en zigzag
            const zig = Math.abs(((x - cx) * 0.8 + Math.sin((y - cy) * 1.4) * r * 0.5) % 5) < 0.9;
            if (d < r && zig && Math.abs(y - cy) < r * 0.6) b.put(x, y, [96, 96, 104], m.alfa * 0.8);
          } else if (d < r * (0.75 + ruido(x / 3, y / 3, 6) * 0.35)) b.put(x, y, [200, 178, 120], m.alfa * 0.55);
        }
    }
    for (const g of mv.migas) b.put(Math.round(g.u * w), Math.round(g.v * h), g.g > 0.5 ? MIGA : oscuro(MIGA, 0.88));
  }
  // El ex libris del taller, en la guarda, con el nombre del café (`vistas.nombre`)
  const ex = vistas?.exlibris?.exlibris ?? null;
  if (ex && (ex.presion > 0 || ex.sellado)) pintarExlibris(b, ex, vistas?.nombre);
  return volcar(lienzo(w, h, canvas), b);
}

/** La ficha «antes / después»: la tapa como llegó y como queda (dos lienzos). */
export function pintarFicha(encargo, { antes = null, despues = null } = {}) {
  return { antes: pintarTapa(antes, encargo, vistasIniciales(encargo)), despues: pintarTapa(despues, encargo, vistasHechas(encargo)) };
}
