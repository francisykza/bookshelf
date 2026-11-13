// Los muebles propios del café (1.120, SPEC §120): modelos de cajas, como los de la casa (`furniture.js`), en las
// coordenadas de su casilla: x a lo ancho (0..w), y a lo hondo (0..d), z arriba, una casilla = una unidad del local. El
// frente de cada mueble mira a +y (las sillas tienen el respaldo en y = 0). Diseños propios, sin parecido a cafés reales.
import { shapeOf } from '../furniture';
import { catalogItem } from '../catalog';

const MARMOL = [228, 222, 210];
const MARMOL_D = [176, 168, 156];
const HIERRO = [52, 46, 48];
const LATON = [206, 164, 90];
const MADERA = [116, 72, 44];
const MADERA_D = [82, 50, 32];
const MADERA_L = [168, 118, 74];
const CUERO = [142, 50, 44];
const CRISTAL = [255, 196, 120];

const b = (box, c, extra = {}) => ({ b: box, c, ...extra });

/** Mesa redonda de bistró: pie de hierro con tres patas y tapa de mármol con su canto. */
function mesa() {
  const out = [];
  out.push(b([0.32, 0.47, 0, 0.68, 0.53, 0.04], HIERRO), b([0.47, 0.32, 0, 0.53, 0.68, 0.04], HIERRO));
  out.push(b([0.46, 0.46, 0.04, 0.54, 0.54, 0.7], HIERRO), b([0.43, 0.43, 0.62, 0.57, 0.57, 0.68], HIERRO));
  // La tapa redonda, con escalones de píxel
  out.push(b([0.2, 0.28, 0.7, 0.8, 0.72, 0.75], MARMOL_D), b([0.28, 0.2, 0.7, 0.72, 0.8, 0.75], MARMOL_D));
  out.push(b([0.22, 0.3, 0.75, 0.78, 0.7, 0.77], MARMOL), b([0.3, 0.22, 0.75, 0.7, 0.78, 0.77], MARMOL));
  // Una taza y su plato
  out.push(b([0.52, 0.36, 0.77, 0.66, 0.5, 0.78], [236, 232, 222]), b([0.55, 0.39, 0.78, 0.63, 0.47, 0.86], [244, 240, 232]));
  return out;
}

/** Silla de bistró: madera curvada oscura, asiento de rejilla y respaldo de dos aros. */
function silla() {
  const out = [];
  for (const [x, y] of [
    [0.27, 0.22],
    [0.67, 0.22],
    [0.27, 0.68],
    [0.67, 0.68],
  ])
    out.push(b([x, y, 0, x + 0.06, y + 0.06, 0.44], MADERA_D));
  out.push(b([0.24, 0.2, 0.44, 0.76, 0.76, 0.5], MADERA), b([0.28, 0.24, 0.5, 0.72, 0.72, 0.51], [196, 170, 120]));
  out.push(b([0.3, 0.3, 0.16, 0.7, 0.7, 0.19], MADERA_D));
  // El respaldo, en y = 0.2, con sus dos aros
  out.push(b([0.27, 0.2, 0.5, 0.33, 0.26, 1.02], MADERA_D), b([0.67, 0.2, 0.5, 0.73, 0.26, 1.02], MADERA_D));
  out.push(b([0.27, 0.19, 0.96, 0.73, 0.25, 1.04], MADERA), b([0.27, 0.19, 0.74, 0.73, 0.24, 0.79], MADERA));
  return out;
}

/** Taburete alto de barra: asiento redondo de cuero rojo y patas de latón con su aro para los pies. */
function taburete() {
  const out = [];
  for (const [x, y] of [
    [0.3, 0.3],
    [0.64, 0.3],
    [0.3, 0.64],
    [0.64, 0.64],
  ])
    out.push(b([x, y, 0, x + 0.06, y + 0.06, 0.72], LATON));
  out.push(b([0.3, 0.3, 0.3, 0.7, 0.7, 0.33], LATON));
  out.push(b([0.26, 0.32, 0.72, 0.74, 0.68, 0.8], CUERO), b([0.32, 0.26, 0.72, 0.68, 0.74, 0.8], CUERO));
  out.push(b([0.32, 0.34, 0.8, 0.68, 0.66, 0.82], [168, 64, 56]));
  return out;
}

/** Colores de lomo para los libros de la estantería: los de tus libros (por título) o unos de adorno. */
const LOMOS = [
  [150, 60, 52],
  [60, 90, 120],
  [200, 168, 96],
  [78, 110, 80],
  [118, 70, 110],
  [210, 196, 170],
  [40, 52, 72],
  [180, 110, 64],
];
export function colorDe(titulo = '') {
  let h = 0;
  for (const ch of String(titulo)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return LOMOS[h % LOMOS.length];
}

/** Estantería baja de dos casillas, tres baldas; los lomos son tus libros (`libros`: títulos), de izquierda a derecha. */
function estanteria(libros = []) {
  const out = [];
  out.push(b([0.08, 0.3, 0, 0.14, 0.82, 1.2], MADERA_D), b([1.86, 0.3, 0, 1.92, 0.82, 1.2], MADERA_D), b([0.98, 0.3, 0, 1.02, 0.82, 1.14], MADERA_D));
  out.push(b([0.08, 0.28, 0, 1.92, 0.34, 1.2], MADERA_D));
  const baldas = [0.06, 0.44, 0.82];
  for (const z of baldas) out.push(b([0.08, 0.3, z, 1.92, 0.84, z + 0.05], MADERA));
  out.push(b([0.04, 0.26, 1.16, 1.96, 0.86, 1.22], MADERA_L));
  // null: la estantería del café sin ejemplares (§121.3), vacía de verdad
  if (libros === null) return out;
  // De la balda de arriba (a la altura de los ojos) hacia abajo
  let k = 0;
  for (const z of [...baldas].reverse()) {
    for (const [a0, a1] of [
      [0.16, 0.96],
      [1.04, 1.84],
    ]) {
      let x = a0;
      while (x < a1 - 0.07) {
        const titulo = libros[k] ?? null;
        const ancho = 0.06 + ((k * 7) % 4) * 0.012;
        const alto = 0.24 + ((k * 5) % 5) * 0.022;
        if (!titulo && k >= libros.length && libros.length) break;
        out.push(b([x, 0.4, z + 0.05, x + ancho, 0.78, z + 0.05 + alto], titulo ? colorDe(titulo) : LOMOS[(k * 3) % LOMOS.length]));
        x += ancho + 0.01;
        k += 1;
      }
    }
  }
  return out;
}

/** Lámpara de pie con tulipa de cristal ámbar (la tulipa brilla). */
function lampara() {
  const out = [];
  out.push(b([0.32, 0.32, 0, 0.68, 0.68, 0.05], LATON), b([0.47, 0.47, 0.05, 0.53, 0.53, 1.5], LATON));
  out.push(b([0.32, 0.36, 1.46, 0.68, 0.64, 1.72], CRISTAL, { glow: true }), b([0.36, 0.32, 1.46, 0.64, 0.68, 1.72], CRISTAL, { glow: true }));
  out.push(b([0.3, 0.3, 1.72, 0.7, 0.7, 1.76], LATON));
  return out;
}

// ── Bloque 4a (1.122): los muebles de los niveles 1 a 3 y de sus hitos ──
const BARRO = [176, 96, 64];
const BARRO_D = [132, 70, 48];
const HOJA = [78, 124, 74];
const HOJA_D = [52, 92, 58];
const HOJA_L = [112, 156, 92];
const TERCIO = [96, 120, 92];
const TELA = [128, 84, 60];
const TARTA = [236, 206, 160];
const FRESA = [196, 70, 76];

/** Maceta de barro con una mata redonda (hito 1 del nivel 1). */
function maceta() {
  const out = [];
  out.push(b([0.32, 0.32, 0, 0.68, 0.68, 0.3], BARRO), b([0.29, 0.29, 0.3, 0.71, 0.71, 0.36], BARRO_D));
  out.push(b([0.3, 0.3, 0.36, 0.7, 0.7, 0.62], HOJA_D), b([0.24, 0.34, 0.42, 0.76, 0.66, 0.66], HOJA), b([0.34, 0.24, 0.48, 0.66, 0.76, 0.72], HOJA));
  out.push(b([0.38, 0.38, 0.7, 0.62, 0.62, 0.82], HOJA_L));
  return out;
}

/** Banco corrido de dos casillas, tapizado en terciopelo verde, con respaldo de madera (respaldo en y = 0). */
function banco() {
  const out = [];
  for (const x of [0.1, 0.94, 1.84]) out.push(b([x, 0.2, 0, x + 0.07, 0.8, 0.38], MADERA_D));
  out.push(b([0.08, 0.18, 0.38, 1.92, 0.82, 0.48], MADERA), b([0.12, 0.22, 0.48, 1.88, 0.8, 0.56], TERCIO));
  out.push(b([0.08, 0.16, 0.48, 1.92, 0.26, 1.08], MADERA_D), b([0.12, 0.24, 0.6, 1.88, 0.3, 1.0], TERCIO));
  for (const x of [0.5, 1.0, 1.5]) out.push(b([x, 0.29, 0.66, x + 0.04, 0.31, 0.94], [76, 98, 74]));
  return out;
}

/** Vitrina de tartas de dos casillas: mueble de madera, cristal y tres tartas en sus platos (las luces de dentro brillan). */
function vitrina() {
  const out = [];
  out.push(b([0.08, 0.2, 0, 1.92, 0.84, 0.86], MADERA_D), b([0.1, 0.82, 0.08, 1.9, 0.86, 0.8], MADERA));
  out.push(b([0.08, 0.2, 0.86, 1.92, 0.84, 0.9], LATON));
  // El cristal: cantos de latón y un velo claro
  for (const x of [0.08, 1.88]) out.push(b([x, 0.2, 0.9, x + 0.04, 0.84, 1.42], LATON));
  out.push(b([0.08, 0.8, 0.9, 1.92, 0.84, 0.94], LATON), b([0.08, 0.2, 1.4, 1.92, 0.84, 1.44], LATON));
  out.push(b([0.14, 0.26, 0.94, 1.86, 0.78, 0.95], [255, 236, 200], { glow: true }));
  for (const [x, c] of [
    [0.3, TARTA],
    [0.86, [120, 72, 50]],
    [1.42, TARTA],
  ]) {
    out.push(b([x - 0.06, 0.38, 0.95, x + 0.3, 0.66, 0.97], [240, 236, 228]));
    out.push(b([x, 0.42, 0.97, x + 0.24, 0.62, 1.12], c), b([x, 0.42, 1.12, x + 0.24, 0.62, 1.14], [250, 244, 236]));
    out.push(b([x + 0.09, 0.49, 1.14, x + 0.15, 0.55, 1.19], FRESA));
  }
  return out;
}

/** Planta grande en macetón: tronco y hojas anchas que se abren en abanico. */
function planta() {
  const out = [];
  out.push(b([0.26, 0.26, 0, 0.74, 0.74, 0.42], [200, 186, 160]), b([0.22, 0.22, 0.42, 0.78, 0.78, 0.48], [168, 152, 128]));
  out.push(b([0.46, 0.46, 0.48, 0.54, 0.54, 1.1], [104, 78, 52]));
  for (const [x0, y0, x1, y1, z] of [
    [0.06, 0.4, 0.46, 0.6, 1.0],
    [0.54, 0.4, 0.94, 0.6, 1.1],
    [0.4, 0.06, 0.6, 0.46, 1.2],
    [0.4, 0.54, 0.6, 0.94, 0.92],
    [0.2, 0.2, 0.5, 0.5, 1.34],
    [0.5, 0.5, 0.8, 0.8, 1.42],
  ])
    out.push(b([x0, y0, z, x1, y1, z + 0.08], HOJA), b([x0 + 0.04, y0 + 0.04, z + 0.08, x1 - 0.04, y1 - 0.04, z + 0.11], HOJA_L));
  out.push(b([0.38, 0.38, 1.5, 0.62, 0.62, 1.66], HOJA_D));
  return out;
}

/** Perchero de pie de madera curvada, con un abrigo y una bufanda (hito 1 del nivel 2). */
function perchero() {
  const out = [];
  out.push(b([0.26, 0.47, 0, 0.74, 0.53, 0.05], MADERA_D), b([0.47, 0.26, 0, 0.53, 0.74, 0.05], MADERA_D));
  out.push(b([0.46, 0.46, 0.05, 0.54, 0.54, 1.86], MADERA), b([0.42, 0.42, 1.86, 0.58, 0.58, 1.92], MADERA_L));
  for (const [x0, y0, x1, y1] of [
    [0.3, 0.47, 0.46, 0.53],
    [0.54, 0.47, 0.7, 0.53],
    [0.47, 0.3, 0.53, 0.46],
  ])
    out.push(b([x0, y0, 1.68, x1, y1, 1.74], MADERA_D));
  out.push(b([0.56, 0.4, 0.86, 0.74, 0.62, 1.7], TELA), b([0.52, 0.4, 1.5, 0.6, 0.62, 1.7], [104, 66, 46]));
  out.push(b([0.28, 0.44, 1.2, 0.36, 0.56, 1.72], [176, 60, 62]), b([0.3, 0.44, 1.14, 0.38, 0.56, 1.22], [196, 80, 76]));
  return out;
}

/** Estantería alta de dos casillas, cinco baldas hasta casi el techo; los lomos, tus libros como en la baja. */
function estanteriaAlta(libros = []) {
  const out = [];
  out.push(b([0.06, 0.26, 0, 0.14, 0.84, 2.6], MADERA_D), b([1.86, 0.26, 0, 1.94, 0.84, 2.6], MADERA_D), b([0.97, 0.3, 0, 1.03, 0.84, 2.54], MADERA_D));
  out.push(b([0.06, 0.24, 0, 1.94, 0.3, 2.6], MADERA_D));
  const baldas = [0.06, 0.56, 1.06, 1.56, 2.06];
  for (const z of baldas) out.push(b([0.06, 0.26, z, 1.94, 0.86, z + 0.05], MADERA));
  out.push(b([0.02, 0.22, 2.56, 1.98, 0.9, 2.66], MADERA_L), b([0.02, 0.84, 0, 1.98, 0.9, 0.06], MADERA_L));
  if (libros === null) return out;
  let k = 0;
  for (const z of [...baldas].reverse()) {
    for (const [a0, a1] of [
      [0.16, 0.95],
      [1.05, 1.84],
    ]) {
      let x = a0;
      while (x < a1 - 0.07) {
        const titulo = libros[k] ?? null;
        const ancho = 0.06 + ((k * 7) % 4) * 0.012;
        const alto = 0.26 + ((k * 5) % 5) * 0.024;
        if (!titulo && k >= libros.length && libros.length) break;
        out.push(b([x, 0.38, z + 0.05, x + ancho, 0.8, z + 0.05 + alto], titulo ? colorDe(titulo) : LOMOS[(k * 3) % LOMOS.length]));
        x += ancho + 0.01;
        k += 1;
      }
    }
  }
  return out;
}

/** Sillón orejero de cuero granate con orejas altas y botones (respaldo en y = 0). */
function orejero() {
  const out = [];
  for (const [x, y] of [
    [0.12, 0.22],
    [0.82, 0.22],
    [0.12, 0.8],
    [0.82, 0.8],
  ])
    out.push(b([x, y, 0, x + 0.06, y + 0.06, 0.16], MADERA_D));
  out.push(b([0.1, 0.18, 0.16, 0.9, 0.88, 0.42], CUERO), b([0.2, 0.3, 0.42, 0.8, 0.86, 0.5], [164, 62, 54]));
  out.push(b([0.08, 0.14, 0.16, 0.22, 0.88, 0.66], [126, 42, 38]), b([0.78, 0.14, 0.16, 0.92, 0.88, 0.66], [126, 42, 38]));
  out.push(b([0.1, 0.1, 0.42, 0.9, 0.28, 1.26], CUERO));
  out.push(b([0.04, 0.12, 0.88, 0.2, 0.36, 1.22], [126, 42, 38]), b([0.8, 0.12, 0.88, 0.96, 0.36, 1.22], [126, 42, 38]));
  for (const x of [0.3, 0.5, 0.7]) for (const z of [0.72, 0.98]) out.push(b([x - 0.02, 0.27, z, x + 0.02, 0.29, z + 0.04], LATON));
  return out;
}

/** Mesita auxiliar de madera con un quinqué apagado y una pila de libros. */
function mesita() {
  const out = [];
  for (const [x, y] of [
    [0.22, 0.22],
    [0.72, 0.22],
    [0.22, 0.72],
    [0.72, 0.72],
  ])
    out.push(b([x, y, 0, x + 0.06, y + 0.06, 0.56], MADERA_D));
  out.push(b([0.18, 0.18, 0.56, 0.82, 0.82, 0.62], MADERA), b([0.24, 0.24, 0.2, 0.76, 0.76, 0.23], MADERA_D));
  out.push(b([0.28, 0.3, 0.62, 0.56, 0.5, 0.68], [60, 90, 120]), b([0.3, 0.28, 0.68, 0.54, 0.48, 0.73], [200, 168, 96]));
  out.push(b([0.6, 0.56, 0.62, 0.72, 0.68, 0.66], LATON), b([0.63, 0.59, 0.66, 0.69, 0.65, 0.84], [255, 224, 170], { glow: true }));
  return out;
}

/** Reloj de pie de nogal, con su esfera, sus agujas y el péndulo de latón tras el cristal (hito 1 del nivel 3). */
function reloj() {
  const out = [];
  out.push(b([0.24, 0.3, 0, 0.76, 0.74, 0.12], MADERA_D), b([0.28, 0.34, 0.12, 0.72, 0.7, 1.5], MADERA));
  out.push(b([0.24, 0.3, 1.5, 0.76, 0.74, 2.04], MADERA_D), b([0.22, 0.28, 2.04, 0.78, 0.76, 2.12], MADERA_L));
  out.push(b([0.32, 0.7, 1.58, 0.68, 0.76, 1.96], [240, 230, 204]));
  out.push(b([0.49, 0.76, 1.76, 0.51, 0.77, 1.92], HIERRO), b([0.5, 0.76, 1.76, 0.62, 0.77, 1.78], HIERRO));
  out.push(b([0.34, 0.7, 0.3, 0.66, 0.72, 1.38], [60, 40, 30]), b([0.48, 0.72, 0.6, 0.52, 0.73, 1.34], LATON), b([0.43, 0.72, 0.5, 0.57, 0.74, 0.64], LATON));
  return out;
}

// ── Bloque 4b (1.123): los del ala lateral (nivel 4) y los de la terraza (nivel 5) ──
const VERDE_F = [44, 70, 58];
const VERDE_C = [70, 104, 80];
const CRISTAL_V = [64, 150, 96];

/** Mesa larga compartida de roble, de dos casillas, con caballetes, un camino de lino, tazas y una pila de libros. */
function mesaLarga() {
  const out = [];
  for (const x of [0.22, 1.72]) {
    out.push(b([x, 0.2, 0, x + 0.06, 0.8, 0.05], MADERA_D));
    out.push(b([x, 0.47, 0.05, x + 0.06, 0.53, 0.68], MADERA_D));
    out.push(b([x, 0.22, 0.6, x + 0.06, 0.78, 0.68], MADERA_D));
  }
  out.push(b([0.28, 0.48, 0.3, 1.72, 0.52, 0.34], MADERA_D));
  out.push(b([0.08, 0.16, 0.68, 1.92, 0.84, 0.74], MADERA), b([0.08, 0.16, 0.74, 1.92, 0.84, 0.76], MADERA_L));
  // El camino de lino a lo largo
  out.push(b([0.16, 0.42, 0.76, 1.84, 0.58, 0.765], [222, 210, 186]));
  out.push(b([0.36, 0.22, 0.76, 0.5, 0.36, 0.77], [236, 232, 222]), b([0.39, 0.25, 0.77, 0.47, 0.33, 0.85], [244, 240, 232]));
  out.push(b([1.46, 0.64, 0.76, 1.6, 0.78, 0.77], [236, 232, 222]), b([1.49, 0.67, 0.77, 1.57, 0.75, 0.85], [244, 240, 232]));
  out.push(b([0.9, 0.24, 0.76, 1.2, 0.42, 0.8], [60, 90, 120]), b([0.92, 0.26, 0.8, 1.18, 0.4, 0.84], [200, 168, 96]), b([0.94, 0.25, 0.84, 1.16, 0.41, 0.87], [150, 60, 52]));
  return out;
}

/** Biombo de librería: tres hojas de madera en zigzag, cada una con dos baldas de lomos (separa rincones sin cerrar). */
function biombo(libros = []) {
  const out = [];
  const hojas = [
    [0.06, 0.66, 0.26],
    [0.68, 1.3, 0.5],
    [1.32, 1.94, 0.26],
  ];
  let k = 0;
  for (const [x0, x1, y] of hojas) {
    out.push(b([x0, y, 0, x0 + 0.05, y + 0.22, 1.7], MADERA_D), b([x1 - 0.05, y, 0, x1, y + 0.22, 1.7], MADERA_D));
    out.push(b([x0, y, 0, x1, y + 0.04, 1.7], MADERA), b([x0 - 0.01, y - 0.01, 1.7, x1 + 0.01, y + 0.23, 1.76], MADERA_L));
    for (const z of [0.12, 0.66, 1.18]) {
      out.push(b([x0 + 0.05, y, z, x1 - 0.05, y + 0.22, z + 0.04], MADERA_L));
      if (z > 1 || libros === null) continue;
      let x = x0 + 0.08;
      while (x < x1 - 0.12) {
        const ancho = 0.05 + ((k * 7) % 4) * 0.01;
        const alto = 0.24 + ((k * 5) % 5) * 0.03;
        const titulo = libros[k];
        out.push(b([x, y + 0.05, z + 0.04, x + ancho, y + 0.2, z + 0.04 + alto], titulo ? colorDe(titulo) : LOMOS[(k * 3) % LOMOS.length]));
        x += ancho + 0.01;
        k += 1;
      }
    }
  }
  // Las bisagras de latón
  for (const x of [0.66, 1.3]) for (const z of [0.3, 1.4]) out.push(b([x - 0.02, 0.36, z, x + 0.02, 0.42, z + 0.08], LATON));
  return out;
}

/** Lámpara de bankers sobre su velador: pie de latón y pantalla de cristal verde que deja una luz cálida abajo. */
function bankers() {
  const out = [];
  out.push(b([0.3, 0.47, 0, 0.7, 0.53, 0.04], MADERA_D), b([0.47, 0.3, 0, 0.53, 0.7, 0.04], MADERA_D));
  out.push(b([0.46, 0.46, 0.04, 0.54, 0.54, 0.7], MADERA_D));
  out.push(b([0.24, 0.3, 0.7, 0.76, 0.7, 0.75], MADERA), b([0.3, 0.24, 0.7, 0.7, 0.76, 0.75], MADERA));
  // La lámpara: base, mástil, el brazo y la pantalla verde con su borde
  out.push(b([0.38, 0.42, 0.75, 0.62, 0.58, 0.79], LATON), b([0.48, 0.48, 0.79, 0.52, 0.52, 1.08], LATON));
  out.push(b([0.3, 0.44, 1.02, 0.7, 0.56, 1.06], LATON));
  out.push(b([0.28, 0.4, 1.06, 0.72, 0.6, 1.14], CRISTAL_V), b([0.32, 0.43, 1.14, 0.68, 0.57, 1.18], [92, 180, 120]));
  out.push(b([0.3, 0.42, 1.04, 0.7, 0.58, 1.06], [255, 222, 150], { glow: true }));
  out.push(b([0.6, 0.5, 0.92, 0.62, 0.52, 1.02], LATON), b([0.59, 0.49, 0.9, 0.63, 0.53, 0.93], LATON));
  return out;
}

/** Piano vertical de nogal con su banqueta, la tapa abierta, teclas blancas y negras y dos candelabros (hito del nivel 4). */
function piano() {
  const out = [];
  const N = [86, 52, 34];
  out.push(b([0.08, 0.1, 0, 1.92, 0.5, 1.36], N), b([0.04, 0.06, 1.36, 1.96, 0.54, 1.42], MADERA_L));
  out.push(b([0.08, 0.5, 0, 0.18, 0.62, 0.66], N), b([1.82, 0.5, 0, 1.92, 0.62, 0.66], N));
  out.push(b([0.16, 0.5, 0.62, 1.84, 0.66, 0.68], [244, 238, 222]));
  for (let x = 0.22; x < 1.8; x += 0.105) if (Math.round(x / 0.105) % 7 !== 2 && Math.round(x / 0.105) % 7 !== 6) out.push(b([x, 0.5, 0.68, x + 0.05, 0.6, 0.71], [28, 22, 22]));
  out.push(b([0.16, 0.48, 0.68, 1.84, 0.52, 0.86], N));
  // El atril con una partitura y el panel tallado
  out.push(b([0.6, 0.48, 0.92, 1.4, 0.5, 1.2], [232, 222, 196]), b([0.66, 0.47, 0.98, 1.34, 0.48, 1.0], [80, 70, 64]), b([0.66, 0.47, 1.06, 1.34, 0.48, 1.08], [80, 70, 64]));
  out.push(b([0.2, 0.49, 0.1, 1.8, 0.5, 0.5], [104, 66, 44]));
  // Los candelabros de latón, con su vela encendida
  for (const x of [0.22, 1.7]) {
    out.push(b([x, 0.5, 1.0, x + 0.08, 0.6, 1.04], LATON), b([x + 0.02, 0.52, 1.04, x + 0.06, 0.56, 1.16], [240, 230, 204]));
    out.push(b([x + 0.03, 0.53, 1.16, x + 0.05, 0.55, 1.2], [255, 214, 140], { glow: true }));
  }
  // La banqueta
  out.push(b([0.62, 0.74, 0, 0.68, 0.8, 0.44], N), b([1.32, 0.74, 0, 1.38, 0.8, 0.44], N), b([0.62, 0.92, 0, 0.68, 0.98, 0.44], N), b([1.32, 0.92, 0, 1.38, 0.98, 0.44], N));
  out.push(b([0.58, 0.7, 0.44, 1.42, 1.0, 0.52], CUERO));
  return out;
}

/** Mesa de hierro de terraza, pintada de verde, con la tapa de chapa calada y una taza. */
function mesaHierro() {
  const out = [];
  for (const [x, y] of [
    [0.24, 0.24],
    [0.7, 0.24],
    [0.24, 0.7],
    [0.7, 0.7],
  ])
    out.push(b([x, y, 0, x + 0.06, y + 0.06, 0.7], VERDE_F));
  out.push(b([0.28, 0.28, 0.24, 0.72, 0.72, 0.26], VERDE_F));
  out.push(b([0.18, 0.24, 0.7, 0.82, 0.76, 0.74], VERDE_C), b([0.24, 0.18, 0.7, 0.76, 0.82, 0.74], VERDE_C));
  // El calado: unas rendijas más oscuras en la chapa
  for (const x of [0.32, 0.44, 0.56, 0.68]) out.push(b([x, 0.3, 0.741, x + 0.03, 0.7, 0.745], VERDE_F));
  out.push(b([0.38, 0.38, 0.745, 0.52, 0.52, 0.755], [236, 232, 222]), b([0.41, 0.41, 0.755, 0.49, 0.49, 0.83], [244, 240, 232]));
  return out;
}

/** Silla de terraza de hierro verde, con el asiento de lamas y el respaldo de volutas (respaldo en y = 0). */
function sillaTerraza() {
  const out = [];
  for (const [x, y] of [
    [0.26, 0.2],
    [0.68, 0.2],
    [0.26, 0.7],
    [0.68, 0.7],
  ])
    out.push(b([x, y, 0, x + 0.05, y + 0.05, 0.44], VERDE_F));
  for (const y of [0.22, 0.36, 0.5, 0.64]) out.push(b([0.24, y, 0.44, 0.76, y + 0.1, 0.48], VERDE_C));
  out.push(b([0.26, 0.2, 0.48, 0.31, 0.25, 1.0], VERDE_F), b([0.69, 0.2, 0.48, 0.74, 0.25, 1.0], VERDE_F));
  out.push(b([0.26, 0.19, 0.94, 0.74, 0.24, 1.0], VERDE_C), b([0.26, 0.19, 0.6, 0.74, 0.23, 0.64], VERDE_C));
  // Las volutas del respaldo
  out.push(b([0.4, 0.19, 0.66, 0.46, 0.23, 0.92], VERDE_C), b([0.54, 0.19, 0.66, 0.6, 0.23, 0.92], VERDE_C), b([0.44, 0.19, 0.76, 0.56, 0.23, 0.8], VERDE_C));
  return out;
}

/** Macetero largo de madera pintada, con lavanda y unas flores, para cerrar la terraza. */
function macetero() {
  const out = [];
  out.push(b([0.06, 0.28, 0, 1.94, 0.72, 0.5], [104, 74, 56]), b([0.04, 0.26, 0.46, 1.96, 0.74, 0.52], MADERA_L));
  for (const x of [0.5, 1.0, 1.5]) out.push(b([x - 0.02, 0.27, 0.05, x + 0.02, 0.28, 0.46], [86, 60, 46]));
  out.push(b([0.1, 0.32, 0.5, 1.9, 0.68, 0.52], [66, 46, 36]));
  for (let k = 0; k < 13; k += 1) {
    const x = 0.14 + k * 0.135;
    const y = 0.36 + ((k * 5) % 3) * 0.1;
    const alto = 0.34 + ((k * 7) % 4) * 0.07;
    out.push(b([x, y, 0.52, x + 0.03, y + 0.03, 0.52 + alto], [86, 120, 78]));
    out.push(b([x - 0.02, y - 0.02, 0.52 + alto - 0.1, x + 0.05, y + 0.05, 0.52 + alto + 0.04], k % 4 === 1 ? [226, 196, 110] : [146, 120, 186]));
  }
  return out;
}

/** Farol de forja de pie, con su cristal encendido y volutas en el brazo (hito del nivel 5). */
function farol() {
  const out = [];
  out.push(b([0.32, 0.32, 0, 0.68, 0.68, 0.12], HIERRO), b([0.38, 0.38, 0.12, 0.62, 0.62, 0.2], HIERRO));
  out.push(b([0.46, 0.46, 0.2, 0.54, 0.54, 2.0], HIERRO));
  for (const z of [0.5, 1.4]) out.push(b([0.43, 0.43, z, 0.57, 0.57, z + 0.05], HIERRO));
  out.push(b([0.36, 0.48, 1.7, 0.46, 0.52, 1.74], HIERRO), b([0.54, 0.48, 1.7, 0.64, 0.52, 1.74], HIERRO));
  // El farol: base, cristales encendidos con sus montantes y el sombrerete
  out.push(b([0.36, 0.36, 2.0, 0.64, 0.64, 2.04], HIERRO));
  out.push(b([0.38, 0.38, 2.04, 0.62, 0.62, 2.36], [255, 214, 140], { glow: true }));
  for (const [x, y] of [
    [0.36, 0.36],
    [0.6, 0.36],
    [0.36, 0.6],
    [0.6, 0.6],
  ])
    out.push(b([x, y, 2.04, x + 0.04, y + 0.04, 2.36], HIERRO));
  out.push(b([0.33, 0.33, 2.36, 0.67, 0.67, 2.42], HIERRO), b([0.4, 0.4, 2.42, 0.6, 0.6, 2.5], HIERRO), b([0.47, 0.47, 2.5, 0.53, 0.53, 2.58], LATON));
  return out;
}

// ── Bloque 6a (1.125): la bodega ──
const ROBLE = [128, 82, 50];
const ROBLE_D = [92, 58, 36];
const ROBLE_L = [158, 106, 66];
const ARO = [64, 58, 56];

/** Mesa de barrica: un tonel de roble de pie, con sus aros de hierro, la tapa de madera y una vela en su palmatoria. */
function barrica() {
  const out = [];
  // El tonel, con la panza un poco más ancha (tres escalones de píxel) y las duelas marcadas
  out.push(b([0.26, 0.26, 0, 0.74, 0.74, 0.86], ROBLE_D));
  out.push(b([0.2, 0.24, 0.12, 0.8, 0.76, 0.74], ROBLE), b([0.24, 0.2, 0.12, 0.76, 0.8, 0.74], ROBLE));
  out.push(b([0.18, 0.28, 0.26, 0.82, 0.72, 0.6], ROBLE_L), b([0.28, 0.18, 0.26, 0.72, 0.82, 0.6], ROBLE_L));
  for (const x of [0.36, 0.5, 0.64]) out.push(b([x, 0.175, 0.14, x + 0.015, 0.18, 0.72], ROBLE_D), b([0.175, x, 0.14, 0.18, x + 0.015, 0.72], ROBLE_D));
  for (const z of [0.1, 0.36, 0.5, 0.76]) {
    const ancho = z === 0.36 || z === 0.5 ? 0.17 : 0.19;
    out.push(b([ancho, ancho + 0.06, z, 1 - ancho, 1 - ancho - 0.06, z + 0.04], ARO), b([ancho + 0.06, ancho, z, 1 - ancho - 0.06, 1 - ancho, z + 0.04], ARO));
  }
  // La tapa: un tablero redondo de roble, más ancho que el tonel
  out.push(b([0.12, 0.22, 0.86, 0.88, 0.78, 0.92], ROBLE_D), b([0.22, 0.12, 0.86, 0.78, 0.88, 0.92], ROBLE_D));
  out.push(b([0.14, 0.24, 0.92, 0.86, 0.76, 0.94], ROBLE_L), b([0.24, 0.14, 0.92, 0.76, 0.86, 0.94], ROBLE_L));
  // Una palmatoria de latón con su vela encendida y una taza
  out.push(b([0.3, 0.3, 0.94, 0.44, 0.44, 0.96], LATON), b([0.34, 0.34, 0.96, 0.4, 0.4, 1.08], [240, 230, 206]));
  out.push(b([0.355, 0.355, 1.08, 0.385, 0.385, 1.13], [255, 210, 130], { glow: true }));
  out.push(b([0.54, 0.52, 0.94, 0.68, 0.66, 0.95], [236, 232, 222]), b([0.57, 0.55, 0.95, 0.65, 0.63, 1.03], [244, 240, 232]));
  return out;
}

/** Banco de bodega: un tablón grueso de roble sobre dos pies de barrica cortada, con un cojín de arpillera (respaldo de pared). */
function bancoBodega() {
  const out = [];
  for (const x of [0.16, 1.5]) {
    out.push(b([x, 0.26, 0, x + 0.34, 0.74, 0.4], ROBLE));
    out.push(b([x - 0.02, 0.28, 0.06, x + 0.36, 0.72, 0.1], ARO), b([x - 0.02, 0.28, 0.3, x + 0.36, 0.72, 0.34], ARO));
  }
  out.push(b([0.08, 0.2, 0.4, 1.92, 0.8, 0.5], ROBLE_D), b([0.1, 0.22, 0.5, 1.9, 0.78, 0.52], ROBLE_L));
  // Las vetas del tablón y los dos cojines de arpillera
  for (const x of [0.5, 1.0, 1.5]) out.push(b([x, 0.22, 0.52, x + 0.02, 0.78, 0.521], ROBLE_D));
  out.push(b([0.2, 0.3, 0.52, 0.94, 0.72, 0.58], [170, 140, 98]), b([1.06, 0.3, 0.52, 1.8, 0.72, 0.58], [170, 140, 98]));
  // El respaldo, una tabla baja en y = 0.16
  out.push(b([0.12, 0.14, 0.5, 0.2, 0.22, 0.98], ROBLE_D), b([1.8, 0.14, 0.5, 1.88, 0.22, 0.98], ROBLE_D));
  out.push(b([0.1, 0.13, 0.72, 1.9, 0.21, 0.94], ROBLE));
  return out;
}

/** Saco de arpillera (nivel 7): un saco de café lleno, tumbado y mullido, con la boca atada; se sienta encima. */
function saco() {
  const out = [];
  const ARP = [176, 142, 94];
  const ARP_D = [148, 116, 74];
  const ARP_L = [196, 166, 116];
  // El cuerpo, con la panza en escalones de píxel
  out.push(b([0.14, 0.2, 0, 0.86, 0.8, 0.12], ARP_D));
  out.push(b([0.1, 0.16, 0.08, 0.9, 0.84, 0.32], ARP), b([0.16, 0.1, 0.1, 0.84, 0.9, 0.3], ARP));
  out.push(b([0.14, 0.2, 0.32, 0.86, 0.8, 0.42], ARP_L));
  // Las costuras, la marca de tinta (sin letras) y la boca atada con su cordel
  out.push(b([0.49, 0.1, 0.1, 0.51, 0.9, 0.42], ARP_D));
  out.push(b([0.28, 0.895, 0.16, 0.44, 0.9, 0.28], [92, 60, 44]), b([0.56, 0.895, 0.16, 0.72, 0.9, 0.28], [92, 60, 44]));
  out.push(b([0.86, 0.38, 0.18, 0.96, 0.62, 0.34], ARP_D), b([0.9, 0.42, 0.16, 0.94, 0.58, 0.36], [210, 190, 150]));
  out.push(b([0.95, 0.44, 0.2, 1.0, 0.56, 0.32], ARP_L));
  // Unos granos caídos al lado
  for (const [x, y] of [
    [0.06, 0.3],
    [0.04, 0.62],
    [0.92, 0.82],
  ])
    out.push(b([x, y, 0, x + 0.04, y + 0.03, 0.02], [92, 54, 32]));
  return out;
}

/** Estantería de latas (hito 1 del nivel 7): baldas de roble con latas de café de colores y una báscula de latón. */
function latas() {
  const out = [];
  // Los costados, el fondo y tres baldas (contra la pared, en y = 0)
  for (const x of [0.06, 1.88]) out.push(b([x, 0.16, 0, x + 0.06, 0.62, 1.7], ROBLE_D));
  out.push(b([0.06, 0.12, 0, 1.94, 0.16, 1.7], ROBLE));
  for (const z of [0.06, 0.6, 1.12, 1.64]) out.push(b([0.08, 0.16, z, 1.92, 0.62, z + 0.05], ROBLE_L));
  // Las latas: redondas en escalones, de varios colores, con su tapa de hojalata
  const COLORES = [
    [168, 52, 44],
    [52, 92, 74],
    [196, 150, 64],
    [44, 64, 112],
    [120, 60, 90],
  ];
  for (const [k, z] of [0.11, 0.65, 1.17].entries())
    for (let i = 0; i < 6; i += 1) {
      const x = 0.18 + i * 0.28;
      const alta = (i + k) % 3 === 0 ? 0.36 : 0.26;
      const c = COLORES[(i * 2 + k) % COLORES.length];
      out.push(b([x, 0.28, z, x + 0.2, 0.5, z + alta], c), b([x + 0.03, 0.25, z, x + 0.17, 0.53, z + alta], c));
      out.push(b([x + 0.02, 0.27, z + alta, x + 0.18, 0.51, z + alta + 0.03], [196, 196, 192]));
      out.push(b([x + 0.03, 0.525, z + alta * 0.35, x + 0.17, 0.531, z + alta * 0.7], [232, 222, 196]));
    }
  // Arriba, una báscula de latón con su platillo y un saquito
  out.push(b([0.3, 0.26, 1.69, 0.62, 0.5, 1.73], LATON), b([0.43, 0.35, 1.73, 0.49, 0.41, 1.92], LATON), b([0.32, 0.28, 1.92, 0.6, 0.48, 1.95], LATON));
  out.push(b([1.2, 0.24, 1.69, 1.62, 0.54, 1.9], [176, 142, 94]), b([1.3, 0.3, 1.9, 1.52, 0.48, 1.96], [196, 166, 116]));
  return out;
}

/** Candil de hierro de pie (hito del nivel 6): un pie de trípode y el candil colgado de su brazo, encendido. */
function candil() {
  const out = [];
  for (const [x0, y0, x1, y1] of [
    [0.24, 0.46, 0.5, 0.54],
    [0.5, 0.46, 0.76, 0.54],
    [0.46, 0.24, 0.54, 0.5],
  ])
    out.push(b([x0, y0, 0, x1, y1, 0.05], ARO));
  out.push(b([0.47, 0.47, 0.05, 0.53, 0.53, 1.7], ARO), b([0.44, 0.44, 0.9, 0.56, 0.56, 0.94], ARO));
  // El brazo y la voluta, hacia +y
  out.push(b([0.47, 0.47, 1.66, 0.53, 0.84, 1.7], ARO), b([0.47, 0.8, 1.58, 0.53, 0.84, 1.7], ARO));
  out.push(b([0.47, 0.53, 1.74, 0.53, 0.62, 1.78], ARO), b([0.47, 0.6, 1.7, 0.53, 0.64, 1.76], ARO));
  // El candil: la cazoleta de hierro, el pico con la llama y la cadenita
  out.push(b([0.49, 0.8, 1.42, 0.51, 0.82, 1.58], ARO));
  out.push(b([0.4, 0.72, 1.3, 0.6, 0.9, 1.42], ARO), b([0.43, 0.75, 1.42, 0.57, 0.87, 1.44], [120, 90, 60]));
  out.push(b([0.47, 0.9, 1.36, 0.53, 0.98, 1.42], ARO));
  out.push(b([0.48, 0.92, 1.42, 0.52, 0.96, 1.52], [255, 200, 110], { glow: true }), b([0.485, 0.925, 1.52, 0.515, 0.955, 1.57], [255, 236, 170], { glow: true }));
  return out;
}

const MODELOS = {
  'cafe-mesa': mesa,
  'cafe-silla': silla,
  'cafe-taburete': taburete,
  'cafe-estanteria': estanteria,
  'cafe-lampara': lampara,
  'cafe-maceta': maceta,
  'cafe-banco': banco,
  'cafe-vitrina': vitrina,
  'cafe-planta': planta,
  'cafe-perchero': perchero,
  'cafe-estanteria-alta': estanteriaAlta,
  'cafe-orejero': orejero,
  'cafe-mesita': mesita,
  'cafe-reloj': reloj,
  'cafe-mesa-larga': mesaLarga,
  'cafe-biombo': biombo,
  'cafe-bankers': bankers,
  'cafe-piano': piano,
  'cafe-mesa-hierro': mesaHierro,
  'cafe-silla-terraza': sillaTerraza,
  'cafe-macetero': macetero,
  'cafe-farol': farol,
  'cafe-barrica': barrica,
  'cafe-banco-bodega': bancoBodega,
  'cafe-candil': candil,
  'cafe-saco': saco,
  'cafe-latas': latas,
};
/** Los muebles del café que enseñan tus libros en sus baldas. */
export const ESTANTERIAS = ['cafe-estanteria', 'cafe-estanteria-alta', 'cafe-biombo'];

/** Las cajas de un mueble del plano (del café o de casa), sin girar. `libros`: títulos para la estantería. */
export function cajasDe(id, libros = []) {
  if (MODELOS[id]) return MODELOS[id](libros);
  const cat = catalogItem(id);
  if (!cat) return [];
  // Los de casa: el mismo modelo que en el piso, con su primer tono, un poco más bajo (el piso tiene techo más alto)
  return shapeOf(id, cat.tonos[0]).map((x) => ({ ...x, b: [x.b[0], x.b[1], x.b[2] * 0.9, x.b[3], x.b[4], x.b[5] * 0.9] }));
}

/** Si el mueble da luz (para que la escena lo sepa). */
export const daLuz = (id) => ['cafe-lampara', 'cafe-vitrina', 'cafe-bankers', 'cafe-farol', 'cafe-piano', 'cafe-candil', 'cafe-barrica'].includes(id) || Boolean(catalogItem(id)?.luz);
