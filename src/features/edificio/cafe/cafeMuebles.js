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

const MODELOS = { 'cafe-mesa': mesa, 'cafe-silla': silla, 'cafe-taburete': taburete, 'cafe-estanteria': estanteria, 'cafe-lampara': lampara };

/** Las cajas de un mueble del plano (del café o de casa), sin girar. `libros`: títulos para la estantería. */
export function cajasDe(id, libros = []) {
  if (MODELOS[id]) return MODELOS[id](libros);
  const cat = catalogItem(id);
  if (!cat) return [];
  // Los de casa: el mismo modelo que en el piso, con su primer tono, un poco más bajo (el piso tiene techo más alto)
  return shapeOf(id, cat.tonos[0]).map((x) => ({ ...x, b: [x.b[0], x.b[1], x.b[2] * 0.9, x.b[3], x.b[4], x.b[5] * 0.9] }));
}

/** Si el mueble da luz (para que la escena lo sepa). */
export const daLuz = (id) => id === 'cafe-lampara' || Boolean(catalogItem(id)?.luz);
