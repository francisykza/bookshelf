// Las medidas del libro de la mesa y el título de una cubierta sin portada. Sin Three.js ni lienzo: se prueban solos.

const BOOK_LENGTH = 0.62;
/** Una cubierta rara no deforma el libro: fuera de esto, se ajusta a lo más cercano. */
const ASPECT_MIN = 0.58;
const ASPECT_MAX = 0.8;
const ASPECT_CLOTH = 0.66;
const THICK_MIN = 0.07;
const THICK_MAX = 0.15;
/** `thickness` viene exagerado para los lomos de la estantería; encima de la mesa, a la misma escala que su alto. */
const THICK_SCALE = 0.55;

/** { width, length, thick, board } en celdas. `data`: { thickness, height }. `aspect`: ancho / alto de su portada, si hay. */
export function bookDims(data, aspect = ASPECT_CLOTH) {
  const length = BOOK_LENGTH * data.height;
  const thick = Math.max(THICK_MIN, Math.min(THICK_MAX, data.thickness * THICK_SCALE));
  const width = length * Math.max(ASPECT_MIN, Math.min(ASPECT_MAX, aspect || ASPECT_CLOTH));
  return { width, length, thick, board: Math.max(0.012, thick * 0.11) };
}

/** Corta una palabra que por sí sola no cabe en una línea. */
function splitWord(word, fits) {
  const parts = [];
  let rest = word;
  while (rest && !fits(rest)) {
    let n = rest.length - 1;
    while (n > 1 && !fits(`${rest.slice(0, n)}-`)) n -= 1;
    parts.push(`${rest.slice(0, n)}-`);
    rest = rest.slice(n);
  }
  if (rest) parts.push(rest);
  return parts;
}

/**
 * Reparte el título en líneas que caben. Si sobran, la última acaba en «…», sin salirse. `fits(texto)`: si cabe en una
 * línea. Devuelve { lines, cut }.
 */
export function wrapTitle(title, fits, maxLines) {
  const words = String(title ?? '').trim().split(/\s+/).filter(Boolean).flatMap((word) => splitWord(word, fits));
  const lines = [];
  for (const word of words) {
    const last = lines[lines.length - 1];
    if (last !== undefined && !last.endsWith('-') && fits(`${last} ${word}`)) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  if (lines.length <= maxLines) return { lines, cut: false };
  const kept = lines.slice(0, maxLines);
  let tail = kept[maxLines - 1].replace(/-$/, '');
  while (tail.length > 1 && !fits(`${tail}…`)) tail = tail.slice(0, -1).trimEnd();
  kept[maxLines - 1] = `${tail}…`;
  return { lines: kept, cut: true };
}
