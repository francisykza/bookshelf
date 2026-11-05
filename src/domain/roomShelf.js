// La estantería del rincón (Rincón 01): un libro expuesto de frente arriba y lomos en grupos en las baldas de abajo.
// Reglas puras, sin React: qué ejemplar se expone, en qué orden van los demás y cuántos caben en cada balda (el número de
// nodos lo acota la madera, no la biblioteca). Las medidas son px de la ilustración (941 × 1672).
import { EDITIONS, currentBook, isDevice, visualEdition } from './books';
import { roomShelfQueue } from './library';
import { calculateBookPhysics, stableHash } from '../utils/vibeEngine';

/** El hueco mide ≈ 28 cm de alto: 1 cm son 130 / 28 px de la ilustración (la escala de siempre, SPEC §20.3). */
export const PX_PER_CM = 130 / 28;
/** Entre lomos de un mismo grupo, entre grupos (el hueco para respirar) y margen con los postes. */
export const SPINE_GAP = 0.8;
export const GROUP_GAP = 10;
export const SHELF_PAD = 5;
/** Tamaños de grupo que se repiten (deterministas: nada se baraja al pintar). */
const GROUP_SIZES = [4, 3, 5, 2, 4, 3, 5];

/** Un ejemplar por id (la nube o una importación pueden traer el mismo dos veces). */
export function uniqueBooks(books) {
  const seen = new Set();
  const out = [];
  for (const b of books ?? []) {
    if (!b || b.id == null || seen.has(b.id)) continue;
    seen.add(b.id);
    out.push(b);
  }
  return out;
}

const byUpdated = (a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '') || String(a.id).localeCompare(String(b.id));

/**
 * El libro que se expone de frente: el que elegiste para exponer (`settings.roomFeaturedId`) si sigue en tu biblioteca;
 * si no, tu lectura actual, tu favorito más reciente o el primer libro. Devuelve { book, reason } o null sin libros.
 */
export function featuredBook(books, settings = {}) {
  const pool = uniqueBooks(books);
  if (!pool.length) return null;
  const chosen = settings.roomFeaturedId != null ? pool.find((b) => b.id === settings.roomFeaturedId) : null;
  if (chosen) return { book: chosen, reason: 'elegido' };
  const reading = currentBook(pool, settings);
  if (reading) return { book: reading, reason: 'lectura' };
  const favorite = pool.filter((b) => b.favorite).sort(byUpdated)[0];
  if (favorite) return { book: favorite, reason: 'favorito' };
  return { book: pool[0], reason: 'primero' };
}

/** Orden de los lomos: primero las lecturas actuales (la de la cama delante), después el resto de tus libros. */
export function spineQueue(books, settings = {}, skipId = null) {
  const pool = uniqueBooks(books).filter((b) => b.id !== skipId);
  const bed = settings.currentBookId;
  const reading = pool.filter((b) => b.status === 'reading').sort((a, b) => (a.id === bed ? -1 : b.id === bed ? 1 : byUpdated(a, b)));
  const rest = roomShelfQueue(
    pool.filter((b) => b.status !== 'reading'),
    null,
  );
  return [...reading, ...rest];
}

/**
 * Tamaño físico de un lomo: estrecho (grosor real por páginas y edición, sin los lomos anchos de la maqueta) y de alto
 * variado según la edición y el propio libro. Nunca se encoge para que quepan más.
 */
export function spineSize(book, shelfHeight) {
  const physics = calculateBookPhysics(book);
  const edition = EDITIONS[visualEdition(book)];
  const cm = isDevice(book) ? 2.2 : 0.55 + 1.5 * physics.thickness + edition.cm * 0.6;
  // Alto: 19–24 cm, según la edición y el libro (determinista)
  const vary = 0.9 + (stableHash(`alto:${book.id ?? book.title}`) % 1000) / 1000 * 0.16;
  const heightCm = 21 * edition.height * (isDevice(book) ? 0.92 : vary);
  return {
    w: Math.round(cm * PX_PER_CM * 10) / 10,
    h: Math.min(shelfHeight - 10, Math.round(heightCm * PX_PER_CM)),
    physics,
  };
}

/**
 * Reparte la cola en las baldas (`shelves`: [{ id, width, height }]) en grupos con hueco entre ellos. Solo se mira lo
 * que cabe: con mil libros se calculan los de las baldas y nada más. Devuelve [{ shelf, groups: [{ index, items }] }],
 * cada item { book, x, w, h, physics } en px de la balda (x desde el poste izquierdo).
 */
export function layoutSpines(queue, shelves) {
  // Con pocos libros se reparten entre las baldas (ninguna se queda vacía mientras otra va llena); si la reserva no
  // basta, se llena una tras otra
  const even = packSpines(queue, shelves, Math.ceil(queue.length / shelves.length));
  const placed = even.reduce((n, r) => n + r.groups.reduce((m, g) => m + g.items.length, 0), 0);
  return placed === queue.length ? even : packSpines(queue, shelves, Infinity);
}

function packSpines(queue, shelves, perShelf) {
  let next = 0;
  let groupNo = 0;
  return shelves.map((shelf) => {
    const groups = [];
    let x = SHELF_PAD;
    const limit = shelf.width - SHELF_PAD;
    const stop = Math.min(queue.length, next + perShelf);
    while (next < stop) {
      const size = GROUP_SIZES[groupNo % GROUP_SIZES.length];
      const items = [];
      let gx = x;
      while (items.length < size && next < stop) {
        const s = spineSize(queue[next], shelf.height);
        if (gx + s.w > limit) break;
        items.push({ book: queue[next], x: gx, ...s });
        gx += s.w + SPINE_GAP;
        next += 1;
      }
      if (!items.length) break;
      groups.push({ index: groups.length, items });
      groupNo += 1;
      x = gx - SPINE_GAP + GROUP_GAP;
      // Lo que no cabe en el grupo pasa a la siguiente balda
      if (items.length < size && next < queue.length) break;
      if (x >= limit) break;
    }
    return { shelf, groups };
  });
}

/**
 * Corrección visual de la fase 01 (prueba en la balda de debajo del expuesto): tres ejemplares al tamaño aparente de la
 * maqueta. Uno de frente, ligeramente girado para que se vea su canto, y a su lado dos de lomo con sus proporciones
 * naturales (grosor por páginas, alto por edición). El grupo ocupa unos dos tercios del ancho útil y deja madera encima
 * y a la derecha. En esta balda 1 cm son SHOWCASE_PX_PER_CM px: la cubierta (23 cm) llega a unos dos tercios del hueco y deja madera encima.
 */
export const SHOWCASE_PX_PER_CM = 4.7;
const SHOWCASE_COVER_CM = 23;

/** Grosor natural de un libro en cm: papel (≈ 0,055 mm por página) más las tapas. */
export function bookThicknessCm(book) {
  const pages = Math.max(48, Number(book.pageCount) || 300);
  const boards = 0.2 + EDITIONS[visualEdition(book)].cm * 0.7;
  return Math.min(6.5, boards + pages * 0.0055);
}

export function showcaseRow(queue, shelf) {
  if (!queue.length) return { row: { shelf, groups: [], showcase: true }, rest: [] };
  const front = queue.find((b) => b.cover) ?? queue[0];
  const spines = queue.filter((b) => b !== front).slice(0, 2);
  const k = SHOWCASE_PX_PER_CM;
  const coverH = Math.round(SHOWCASE_COVER_CM * k);
  const coverW = Math.round(coverH * 0.66);
  const edge = Math.max(5, Math.round(bookThicknessCm(front) * k * 0.4));
  const items = [];
  let x = SHELF_PAD + 4 + edge;
  items.push({ book: front, front: true, x, w: coverW, h: coverH, edge, spineW: Math.round(bookThicknessCm(front) * k), physics: calculateBookPhysics(front) });
  x += coverW + 3;
  for (const book of spines) {
    const edition = EDITIONS[visualEdition(book)];
    const vary = 0.94 + ((stableHash(`alto:${book.id ?? book.title}`) % 1000) / 1000) * 0.1;
    const h = Math.min(shelf.height - 14, Math.round(21.5 * edition.height * vary * k));
    const w = Math.max(5, Math.round(bookThicknessCm(book) * k));
    items.push({ book, x, w, h, physics: calculateBookPhysics(book) });
    x += w + SPINE_GAP;
  }
  const used = new Set(items.map((i) => i.book.id));
  return { row: { shelf, groups: [{ index: 0, items }], showcase: true }, rest: queue.filter((b) => !used.has(b.id)) };
}

/** Tinta del título según el color del lomo (#rgb o #rrggbb): oscura sobre tela clara, crema sobre la oscura. */
export function inkFor(color) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(color || '').trim());
  if (!m) return 'light';
  const hex = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55 ? 'dark' : 'light';
}

/** Cuántos libros quedan dentro de la estantería (para decirlo en el nombre accesible). */
export const shownCount = (rows, featured) => rows.reduce((n, r) => n + r.groups.reduce((m, g) => m + g.items.length, 0), 0) + (featured ? 1 : 0);
