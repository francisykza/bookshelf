// Qué libros caben en la estantería del piloto. Reparte con las reglas de la balda de siempre (`layoutSpines` y `spineSize`
// de roomShelf.js) y solo convierte sus medidas a celdas de la habitación. Lo que no cabe no se dibuja: nunca se encoge.
import { EDITIONS, currentBook, spineColor, visualEdition } from '../../domain/books';
import { PX_PER_CM, bookThicknessCm, featuredBook, inkFor, layoutSpines, spineSize, uniqueBooks } from '../../domain/roomShelf';
import { bookDims } from './bookLayout';
import { ROOM_LIMIT, roomSelection } from './roomSelection';

/** Ancho útil entre laterales, en celdas. */
export const SHELF_INNER = 1.72;
/** Hueco que deja la cubierta de frente en la balda de arriba. */
export const COVER_SPACE = 0.66;
// Para repartir con las reglas de la balda de siempre: su ancho de lomo, a celdas
const WIDE = 0.075 / PX_PER_CM;
/** Las baldas, de abajo arriba. La de la lámpara, con la cubierta, es la última. */
export const TOP_ROW = 2;
/**
 * 1.88: en las dos baldas de abajo, el último ejemplar se gira para enseñar su portada (`DISPLAY_TURN`, en radianes), y
 * para eso se le guarda sitio (`DISPLAY_SPACE`, en celdas). Los demás, de lomo, con un giro mínimo cada uno.
 */
export const DISPLAY_SPACE = 0.4;
export const DISPLAY_TURN = 0.8;
const JITTER = 0.016;
/** Huecos de la balda, en celdas: entre libros, entre grupos y a los lados. */
const GAP = 0.01;
const GROUP_GAP = 0.05;
const EDGE = 0.02;
/** Lo que se reparte de más, como mucho, en cada hueco: separaciones que dejan ver un poco de las portadas. */
const SPREAD_MAX = 0.035;
const hashOf = (id) => [...String(id)].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 1009, 7);

/** Ocupa a lo ancho de la balda un libro de grosor `w`, hondo `d` y girado `turn`. */
export const footprint = (w, d, turn) => w * Math.cos(turn) + d * Math.sin(Math.abs(turn));

/**
 * Los datos de un ejemplar para dibujarlo (1.88): los mismos en la mesa y en la estantería, para que sea el mismo libro.
 * `thickness` y `height` dan sus medidas con `bookDims`; la portada (y con ella su proporción) llega después.
 */
export const copyData = (book) => {
  const edition = visualEdition(book);
  return { id: book.id, title: book.title, author: book.author ?? '', color: spineColor(book), ink: inkFor(spineColor(book)), edition, thickness: bookThicknessCm(book) * 0.06, height: EDITIONS[edition].height };
};

/**
 * Coloca una balda (`groups`: los grupos de `layoutSpines`, ya con sus medidas): cada libro con un giro pequeño y fijo y
 * el sitio que ocupa girado, para que ninguno atraviese a su vecino; si `display`, el último, de cara. Lo que sobra se
 * reparte en los huecos. Si algo no cabe, se queda fuera (`dropped`); nunca se encoge.
 */
export function composeRow(groups, room, display) {
  let items = groups.flatMap((g, gi) => g.map((i, k) => ({ ...i, starts: gi > 0 && k === 0 })));
  const turnOf = (i) => ((hashOf(i.id) % 5) - 2) * JITTER;
  const place = (list) => {
    const showing = display && list.length >= 2;
    let cursor = EDGE;
    const out = list.map((i, k) => {
      const face = showing && k === list.length - 1;
      const turn = face ? -DISPLAY_TURN : turnOf(i);
      // Hondo con la portada más ancha que se admite: cuando llegue la de verdad, nunca ocupa más
      const e = footprint(i.w, i.depthMax, turn) + (face ? 0.03 : 0);
      if (k > 0) cursor += i.starts ? GROUP_GAP : GAP;
      const centre = cursor + e / 2;
      cursor += e;
      return { ...i, x: centre - i.w / 2, extent: e, turn, display: face };
    });
    return { out, end: cursor + EDGE };
  };
  let laid = place(items);
  let dropped = 0;
  while (laid.end > room && items.length > 1) {
    items = items.slice(0, -1);
    dropped += 1;
    laid = place(items);
  }
  // Lo que sobra, repartido en los huecos (sin pasar de SPREAD_MAX en cada uno)
  const gaps = laid.out.length - 1;
  const extra = gaps > 0 ? Math.min(SPREAD_MAX, (room - laid.end) / gaps) : 0;
  const out = laid.out.map((i, k) => ({ ...i, x: i.x + extra * k }));
  return Object.assign(out, { dropped });
}

const toItem = (item) => {
  const data = copyData(item.book);
  const dims = bookDims(data);
  return { ...data, book: item.book, dims, w: dims.thick, h: dims.length, depthMax: bookDims(data, 1).width };
};

/**
 * { cover, rows: [abajo, medio, arriba], hidden, placed } con tu lectura de frente, o null si la biblioteca está vacía. Solo
 * se reparte la selección (`roomSelection`, como mucho `limit` ejemplares con la cubierta); `hidden` es lo que se queda fuera.
 */
export function shelfRows(books, settings = {}, limit = ROOM_LIMIT) {
  const pool = uniqueBooks(books);
  const lead = currentBook(pool, settings) ?? featuredBook(pool, settings)?.book;
  if (!lead) return null;
  const queue = roomSelection(pool, settings, limit, lead.id);
  // Se reparte con las reglas de siempre, pero a la escala de los libros que se dibujan: su grosor real (el de la mesa)
  // frente al lomo de la balda de siempre, de media. Los huecos y los giros ocupan algo más: se prueba de más holgado a más
  // justo y se queda el reparto más lleno en el que no sobra ningún libro de ninguna balda
  const scale = queue.length ? queue.reduce((sum, b) => sum + bookDims(copyData(b)).thick / (spineSize(b, 1000).w * WIDE), 0) / queue.length : 1;
  const tall = 1000;
  const layout = (fill) => {
    const width = (cells) => (cells * fill) / (WIDE * scale);
    const packed = layoutSpines(queue, [
      { id: 'arriba', width: width(SHELF_INNER - COVER_SPACE), height: tall },
      { id: 'medio', width: width(SHELF_INNER - DISPLAY_SPACE), height: tall },
      { id: 'abajo', width: width(SHELF_INNER - DISPLAY_SPACE), height: tall },
    ]);
    const [top, middle, bottom] = packed.map((row) => row.groups.map((group) => group.items.map(toItem)));
    return [composeRow(bottom, SHELF_INNER, true), composeRow(middle, SHELF_INNER, true), composeRow(top, SHELF_INNER - COVER_SPACE, false)];
  };
  let rows = layout(0.8);
  for (const fill of [1.6, 1.4, 1.25, 1.1, 1]) {
    const tried = layout(fill);
    if (tried.every((r) => !r.dropped)) {
      rows = tried;
      break;
    }
  }
  const shown = rows.reduce((n, r) => n + r.length, 0);
  return { cover: lead, rows, hidden: pool.length - 1 - shown, placed: new Set([lead.id, ...rows.flat().map((i) => i.id)]) };
}

/** Lo que se ve de un libro (1.88): si cambia la portada, el lomo, la edición, el color, el título o el autor, se vuelve a dibujar. */
export const bookLooks = (b) => [b.id, b.cover, b.spine, visualEdition(b), spineColor(b), b.title, b.author].join('~');

/** Cambia si hay que recolocar o volver a pintar algo en la habitación; registrar una página, no. */
export const sceneKey = (reading, shelf) => [reading && bookLooks(reading), shelf?.cover && bookLooks(shelf.cover), ...(shelf?.rows.map((row) => row.map((i) => bookLooks(i.book)).join()) ?? [])].join('|');

/**
 * Las zonas de toque de una balda: un lomo muy fino gana ancho a costa de sus vecinos más anchos, sin solaparse. El libro
 * dibujado no cambia. `slots`: [{ id, left, top, width, height }], en px.
 */
export function fitSlots(slots, min = 30) {
  const out = [...slots].sort((a, b) => a.left - b.left).map((s) => ({ ...s, right: s.left + s.width }));
  out.forEach((s) => {
    const need = min - (s.right - s.left);
    if (need > 0) {
      s.left -= need / 2;
      s.right += need / 2;
      s.grown = true;
    }
  });
  for (let k = 1; k < out.length; k += 1) {
    const [a, b] = [out[k - 1], out[k]];
    if (a.right <= b.left) continue;
    // El que ha crecido manda sobre su vecino ancho; si han crecido los dos, a medias
    const edge = a.grown === b.grown ? (a.right + b.left) / 2 : a.grown ? a.right : b.left;
    a.right = edge;
    b.left = edge;
  }
  return out.map(({ id, left, top, height, right }) => ({ id, left, top, height, width: right - left }));
}
