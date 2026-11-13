// 1.128 (Francisco, 13-11-2026: «a mi pareja le salen así los libros», sin portada en las fichas). Los libros importados de
// Goodreads piden la portada a Open Library por su ISBN y, si allí no está, se quedaban en la tapa de color. Ahora, si esa
// falla, se busca la portada de la misma edición (el mismo ISBN, nunca otra) en Google Books, como hace el buscador al añadir
// un libro. Solo para enseñarla en el café: no se guarda en el libro ni cambia tu biblioteca.
// Lo encontrado se recuerda en el dispositivo (también que no hay), para no volver a preguntar cada vez.
import { isbnKey } from '../../../domain/bookSearch';
import { searchBooks } from '../../../services/bookApi';

const CLAVE = 'bookshelf:cafe-portadas';
const MAX = 400;
// Lo que no se encontró se vuelve a probar pasada una semana; lo encontrado, en un mes
const CADUCA_NADA = 7 * 24 * 3600 * 1000;
const CADUCA_ALGO = 30 * 24 * 3600 * 1000;
const enCurso = new Map();

function leer() {
  try {
    const m = JSON.parse(localStorage.getItem(CLAVE) || '{}');
    return m && typeof m === 'object' ? m : {};
  } catch {
    return {};
  }
}

function guardar(isbn, url) {
  try {
    const m = leer();
    m[isbn] = { u: url, t: Date.now() };
    const claves = Object.keys(m);
    if (claves.length > MAX) for (const k of claves.sort((a, b) => m[a].t - m[b].t).slice(0, claves.length - MAX)) delete m[k];
    localStorage.setItem(CLAVE, JSON.stringify(m));
  } catch {
    // Sin almacenamiento (modo privado…): se vuelve a preguntar la próxima vez
  }
}

/** Lo que ya se sabe de ese ISBN en este dispositivo: la URL, '' si no hay, o undefined si no se sabe (o caducó). */
export function portadaRecordada(isbn) {
  const k = isbnKey(isbn);
  if (!k) return '';
  const e = leer()[k];
  if (!e || typeof e.u !== 'string') return undefined;
  return Date.now() - e.t > (e.u ? CADUCA_ALGO : CADUCA_NADA) ? undefined : e.u;
}

/** La portada de esa misma edición en Google Books ('' si no la tiene o no hay red). Una sola petición por ISBN a la vez. */
export function portadaPorIsbn(isbn) {
  const k = isbnKey(isbn);
  if (!k) return Promise.resolve('');
  const sabida = portadaRecordada(k);
  if (sabida !== undefined) return Promise.resolve(sabida);
  if (!enCurso.has(k)) {
    enCurso.set(
      k,
      searchBooks(k)
        .then(({ results }) => {
          const misma = (results ?? []).find((r) => r.cover && isbnKey(r.isbn) === k);
          const url = misma?.cover ?? '';
          guardar(k, url);
          return url;
        })
        // Sin red no se recuerda nada: se probará la próxima vez
        .catch(() => '')
        .finally(() => enCurso.delete(k)),
    );
  }
  return enCurso.get(k);
}
