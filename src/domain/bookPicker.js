// Selector de libro del registro de lectura (SPEC §17.2 y §22.6): SOLO las lecturas activas, en un orden
// estable. 1.28.0: sin «Otros…» (la biblioteca completa se busca en la librería). Sin React ni red.

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

/** ¿Es un ID de libro guardable? (nunca un vacío ni un id que no esté en la biblioteca) */
export const isBookId = (books, id) => Boolean(id) && books.some((b) => b.id === id);
