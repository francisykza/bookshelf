// ¿Este EPUB corresponde a este ejemplar? (SPEC §54.3). Solo propone: compara título y autor normalizados y usa el ISBN
// como evidencia; nunca fusiona libros ni decide por la persona. Sin red ni IA.

/**
 * Texto bibliográfico normalizado: minúsculas, sin diacríticos ni puntuación superficial, espacios simples. Los números
 * (volumen, entrega de una saga) se conservan: «En llamas 2» no es «En llamas».
 */
export function normalizeBib(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const numbers = (t) => (t.match(/\d+/g) ?? []).join(',');
const words = (t) => t.split(' ').filter((w) => w.length >= 3);
const isbnKey = (v) => String(v ?? '').replace(/[^0-9Xx]/g, '').toUpperCase();

/** Títulos equivalentes: iguales, o uno contiene al otro (subtítulos) con los mismos números. */
function sameTitle(a, b) {
  if (!a || !b) return null;
  if (numbers(a) !== numbers(b)) return false;
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 4 && (long.startsWith(`${short} `) || long.includes(` ${short} `) || long.endsWith(` ${short}`));
}

/** Autores compatibles: comparten alguna palabra significativa (apellido); desconocido si falta alguno. */
function sameAuthor(a, b) {
  if (!a || !b) return null;
  const wa = new Set(words(a));
  return words(b).some((w) => wa.has(w));
}

/**
 * Resultado de la comparación:
 * - `match`: título y autor parecen coincidir (y, si hay ISBN en los dos, es el mismo).
 * - `edition`: título y autor coinciden pero el ISBN declarado es otro (otra edición de la misma obra).
 * - `unknown`: el archivo no trae datos suficientes para comparar.
 * - `mismatch`: el archivo parece de otro libro.
 */
export function matchEpub(book, file) {
  const t = sameTitle(normalizeBib(book?.title), normalizeBib(file?.title));
  const a = sameAuthor(normalizeBib(book?.author), normalizeBib(file?.author));
  const ib = isbnKey(book?.isbn);
  const ifile = isbnKey(file?.isbn);
  if (ib && ifile && ib === ifile) return 'match';
  if (t === null) return 'unknown';
  if (t && a !== false) return ib && ifile ? 'edition' : 'match';
  // Mismo autor con otro título (una traducción, por ejemplo) o sin autor: se pregunta, no se afirma nada
  if (!t && a !== false) return 'unknown';
  return 'mismatch';
}

export const MATCH_MESSAGES = {
  match: 'El título y el autor parecen coincidir.',
  edition: 'Puedes leer otra edición conservando tu ejemplar.',
  unknown: '¿Este archivo corresponde a este libro?',
  mismatch: 'El archivo parece corresponder a otro libro. Revisa la vinculación.',
};
