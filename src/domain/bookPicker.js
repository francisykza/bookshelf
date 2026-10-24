// Selector de libro del registro de lectura (SPEC §17.2): primero las lecturas activas en un orden estable y,
// como acción secundaria, «Otros…» para buscar cualquier libro de la biblioteca. Sin React ni red.

/** Valor de la opción «Otros…»: una acción de interfaz, nunca un `bookId`. */
export const OTHER = '__other__';
export const PAGE = 8;

/** Texto comparable: sin mayúsculas, acentos ni espacios repetidos. */
export const normalize = (text) =>
  String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Orden inicial de las lecturas activas: el libro actual primero (si se está leyendo) y el resto en el orden de
 * la biblioteca. Se calcula una vez al abrir el formulario.
 */
export function initialReadingOrder(books, currentId) {
  const reading = books.filter((b) => b.status === 'reading').map((b) => b.id);
  return reading.includes(currentId) ? [currentId, ...reading.filter((id) => id !== currentId)] : reading;
}

/**
 * Lecturas activas que se muestran, respetando el orden congelado: las que dejan de leerse desaparecen y las
 * nuevas se añaden al final (la lista no se reordena mientras el formulario está abierto).
 */
export function readingChoices(books, order) {
  const byId = new Map(books.map((b) => [b.id, b]));
  const kept = order.map((id) => byId.get(id)).filter((b) => b && b.status === 'reading');
  const extra = books.filter((b) => b.status === 'reading' && !order.includes(b.id));
  return [...kept, ...extra];
}

/** Etiqueta de cada opción: el título y, si se repite, también el autor. */
export function choiceLabels(list) {
  const counts = new Map();
  list.forEach((b) => counts.set(normalize(b.title), (counts.get(normalize(b.title)) ?? 0) + 1));
  return Object.fromEntries(list.map((b) => [b.id, counts.get(normalize(b.title)) > 1 ? `${b.title} — ${b.author}` : b.title]));
}

/** Búsqueda local por título y autor; consulta vacía → `null` (se pide escribir, no se lista la biblioteca). */
export function searchLibrary(books, query) {
  const q = normalize(query);
  if (!q) return null;
  const terms = q.split(' ');
  return books.filter((b) => {
    const hay = `${normalize(b.title)} ${normalize(b.author)}`;
    return terms.every((t) => hay.includes(t));
  });
}

/** ¿Es un ID de libro guardable? (nunca la acción «Otros…» ni un vacío) */
export const isBookId = (books, id) => Boolean(id) && id !== OTHER && books.some((b) => b.id === id);
