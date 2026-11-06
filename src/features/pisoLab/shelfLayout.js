// Qué libros caben en la estantería del piloto. Reparte con las reglas de la balda de siempre (`layoutSpines` y `spineSize`
// de roomShelf.js) y solo convierte sus medidas a celdas de la habitación. Lo que no cabe no se dibuja: nunca se encoge.
import { currentBook, spineColor, visualEdition } from '../../domain/books';
import { PX_PER_CM, featuredBook, inkFor, layoutSpines, uniqueBooks } from '../../domain/roomShelf';
import { ROOM_LIMIT, roomSelection } from './roomSelection';

/** Ancho útil entre laterales, en celdas. */
export const SHELF_INNER = 1.72;
/** Hueco que deja la cubierta de frente en la balda de arriba. */
export const COVER_SPACE = 0.66;
// El alto va a escala; el grosor, algo exagerado, porque a esta distancia un lomo real no se podría tocar
const TALL = 0.034 / PX_PER_CM;
const WIDE = 0.075 / PX_PER_CM;
/** Las baldas, de abajo arriba. La de la lámpara, con la cubierta, es la última. */
export const TOP_ROW = 2;

const toItem = (item) => ({
  id: item.book.id,
  book: item.book,
  title: item.book.title,
  color: spineColor(item.book),
  ink: inkFor(spineColor(item.book)),
  edition: visualEdition(item.book),
  x: item.x * WIDE,
  w: item.w * WIDE,
  h: item.h * TALL,
});

/**
 * { cover, rows: [abajo, medio, arriba], hidden, placed } con tu lectura de frente, o null si la biblioteca está vacía. Solo
 * se reparte la selección (`roomSelection`, como mucho `limit` ejemplares con la cubierta); `hidden` es lo que se queda fuera.
 */
export function shelfRows(books, settings = {}, limit = ROOM_LIMIT) {
  const pool = uniqueBooks(books);
  const lead = currentBook(pool, settings) ?? featuredBook(pool, settings)?.book;
  if (!lead) return null;
  const queue = roomSelection(pool, settings, limit, lead.id);
  const width = (cells) => cells / WIDE;
  const tall = 1000;
  const packed = layoutSpines(queue, [
    { id: 'arriba', width: width(SHELF_INNER - COVER_SPACE), height: tall },
    { id: 'medio', width: width(SHELF_INNER), height: tall },
    { id: 'abajo', width: width(SHELF_INNER), height: tall },
  ]);
  const [top, middle, bottom] = packed.map((row) => row.groups.flatMap((group) => group.items.map(toItem)));
  const shown = top.length + middle.length + bottom.length;
  return { cover: lead, rows: [bottom, middle, top], hidden: pool.length - 1 - shown, placed: new Set([lead.id, ...[top, middle, bottom].flat().map((i) => i.id)]) };
}

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
