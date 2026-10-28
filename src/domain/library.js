// Selectores de la biblioteca (SPEC §22.4–22.6), sin React ni red. La biblioteca completa son todos los libros
// guardados (los borrados salen del array); las lecturas activas son solo los de estado «leyendo». La librería
// parte de la biblioteca completa; el formulario para registrar lectura, de las lecturas activas.
import { normalize } from './bookPicker';

/** Estados: leyendo, pendiente, terminado y (1.47) abandonado. */
export const LIBRARY_STATUSES = ['reading', 'want', 'read', 'abandoned'];

/** Biblioteca completa: todos los ejemplares guardados. */
export const libraryBooks = (books) => books ?? [];
/** Lecturas activas: solo los ejemplares cuyo estado real es «leyendo». */
export const activeReadings = (books) => libraryBooks(books).filter((b) => b.status === 'reading');
export const pendingBooks = (books) => libraryBooks(books).filter((b) => b.status === 'want');
export const finishedBooks = (books) => libraryBooks(books).filter((b) => b.status === 'read');
export const abandonedBooks = (books) => libraryBooks(books).filter((b) => b.status === 'abandoned');

/** Texto en el que se busca: título, autor e ISBN guardado (sin mayúsculas, tildes ni espacios sobrantes). */
const searchText = (book) => normalize(`${book.title ?? ''} ${book.author ?? ''} ${book.isbn ?? ''}`);

/**
 * Búsqueda y filtro de estado a la vez sobre TODA la biblioteca (no solo lo pintado). `status`: 'all' o uno
 * de `LIBRARY_STATUSES`; `query`: cada palabra debe aparecer en título, autor o ISBN.
 */
export function filterLibrary(books, { status = 'all', query = '' } = {}) {
  const terms = normalize(query).split(' ').filter(Boolean);
  return libraryBooks(books).filter((b) => (status === 'all' || b.status === status) && terms.every((t) => searchText(b).includes(t)));
}

/**
 * Estado vacío que corresponde (o `null` si hay libros que mostrar). Mientras la cuenta o la biblioteca cargan
 * no se elige ninguno: `loading` devuelve 'loading'.
 */
export function libraryEmptyState({ total, shown, status = 'all', query = '', loading = false }) {
  if (loading) return 'loading';
  if (shown > 0) return null;
  if (total === 0) return 'library';
  if (normalize(query)) return 'search';
  return status === 'all' ? 'library' : 'filter';
}

export const EMPTY_TEXT = {
  library: 'Tu estantería espera su primera historia',
  filter: 'Todavía no tienes libros en este apartado',
  abandoned: 'No has dejado ningún libro a medias',
  search: 'No encontramos ese libro en tu biblioteca',
  loading: 'Abriendo tu biblioteca…',
};
