// «La librería del puerto» (prototipo, solo desarrollo): el nivel de la semana. Se genera a partir de una semilla (la
// semana ISO, p. ej. «2026-W44»), así que todo el mundo juega el mismo nivel y el servidor podría generarlo igual.
// Lógica pura: sin DOM ni red.
//
// Cómo se construye: se llena cada balda de izquierda a derecha con bloques que la ocupan a lo ancho, sin huecos:
// - «de pie»: un libro de grosor 1 o 2 y alto hasta el de la balda;
// - «pila»: varios libros tumbados del mismo largo (su `alto`), uno encima de otro.
// Esa construcción es la solución del nivel, de modo que siempre se puede resolver y el mínimo de movimientos es el
// número de libros. Los libros de la pila con un largo mayor que la balda más alta solo caben tumbados.
import { SPINE } from './levels';

/** Límites para que la caja de recién llegados quepa en el lienzo y la estantería en su alto. */
export const LIMITS = { maxBooks: 9, maxThickness: 11, maxShelfHeight: 9 };

const TITLES = [
  'Bajamar',
  'Cartas del faro',
  'La red y el remo',
  'Sal gruesa',
  'Velas de octubre',
  'El último ferry',
  'Muelle norte',
  'Diario de a bordo',
  'Conchas',
  'Brisa de poniente',
  'Mapas del cabo',
  'Islas menores',
  'La lonja',
  'Noches de faro',
  'Redes al sol',
  'El patrón',
  'Corrientes',
  'Sargazo',
  'Atlas del estrecho',
  'Marea alta',
  'Puerto viejo',
  'Rumbo sur',
  'Calma chicha',
  'El vigía',
  'Faros perdidos',
  'Algas y espuma',
];

/** Semana ISO de una fecha (lunes a domingo), como «2026-W44». */
export function weekId(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const week = Math.ceil(((d - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/** Lunes (00:00 UTC, en milisegundos) de una semana ISO «2026-W44». */
export function weekStart(id) {
  const [y, w] = id.split('-W').map(Number);
  const jan4 = Date.UTC(y, 0, 4);
  const day = new Date(jan4).getUTCDay() || 7;
  return jan4 - (day - 1) * 86400000 + (w - 1) * 7 * 86400000;
}

/** Semana anterior a otra («2026-W01» → «2025-W52» o «2025-W53»). */
export const previousWeek = (id) => weekId(new Date(weekStart(id) - 3 * 86400000));

/** Mes de una semana para el ranking mensual: el del jueves de esa semana (como el año ISO), «2026-10». */
export function monthOfWeek(id) {
  const thursday = new Date(weekStart(id) + 3 * 86400000);
  return `${thursday.getUTCFullYear()}-${String(thursday.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Generador pseudoaleatorio reproducible (mulberry32) a partir de un texto. */
function rngFrom(text) {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i += 1) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function attempt(rand) {
  const int = (a, b) => a + Math.floor(rand() * (b - a + 1));
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const three = rand() < 0.3;
  const heights = three ? [4, 3, 2] : [pick([3, 4]), 3];
  const baldas = heights.map((alto, i) => ({ id: 'ABC'[i], ancho: int(5, 7), alto }));
  const books = [];
  const solution = [];
  for (const shelf of baldas) {
    let x = 0;
    while (x < shelf.ancho) {
      const left = shelf.ancho - x;
      if (left >= 3 && rand() < 0.38) {
        // Pila de libros tumbados del mismo largo; a veces más largos que cualquier balda (solo caben tumbados)
        const w = int(3, left);
        let y = 0;
        const layers = int(1, shelf.alto);
        while (y < layers) {
          const g = Math.min(int(1, 2), shelf.alto - y);
          books.push({ grosor: g, alto: w });
          solution.push({ balda: shelf.id, x, y, orient: 'tumbado', ref: books.length - 1 });
          y += g;
        }
        x += w;
      } else {
        const g = Math.min(left, rand() < 0.7 ? 1 : 2);
        const alto = Math.max(2, shelf.alto - (rand() < 0.3 ? 1 : 0));
        books.push({ grosor: g, alto });
        solution.push({ balda: shelf.id, x, y: 0, orient: 'pie', ref: books.length - 1 });
        x += g;
      }
    }
  }
  const thickness = books.reduce((n, b) => n + b.grosor, 0);
  const ok = books.length <= LIMITS.maxBooks && books.length >= 5 && thickness <= LIMITS.maxThickness && heights.reduce((n, h) => n + h, 0) <= LIMITS.maxShelfHeight;
  // Un libro tumbado de largo ≤ balda más alta también cabría de pie: no rompe nada, solo da más caminos
  return ok ? { baldas, books, solution } : null;
}

/** El nivel de una semilla (siempre el mismo para la misma semilla). */
export function generateLevel(seed) {
  const rand = rngFrom(`libreria-puerto:${seed}`);
  let made = null;
  for (let k = 0; k < 400 && !made; k += 1) made = attempt(rand);
  if (!made) throw new Error(`Sin nivel para ${seed}`);
  // Títulos y colores sin repetir color seguido; la caja trae los libros barajados
  const colors = Object.keys(SPINE);
  const titles = [...TITLES];
  let last = null;
  const libros = made.books.map((b, i) => {
    const title = titles.splice(Math.floor(rand() * titles.length), 1)[0];
    let color = colors[Math.floor(rand() * colors.length)];
    if (color === last) color = colors[(colors.indexOf(color) + 1) % colors.length];
    last = color;
    return { id: `s${i + 1}`, titulo: title, grosor: b.grosor, alto: b.alto, color };
  });
  const order = libros.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return {
    id: `semana-${seed}`,
    nombre: 'Nivel de la semana',
    objetivo: 'Las baldas quedan justas. Cada movimiento cuenta para el ranking.',
    semana: seed,
    baldas: made.baldas,
    libros: order.map((i) => libros[i]),
    solution: made.solution.map(({ ref, ...s }) => ({ libro: libros[ref].id, ...s })),
  };
}
