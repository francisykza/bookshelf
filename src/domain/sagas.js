// Atlas de Sagas (SPEC §6bis, 1.13.0): sagas preconfiguradas y propias, emparejadas con tu estantería.
// Regla visual: lo leído se ve en gris (camino recorrido), lo que toca leer ahora a todo color y destacado,
// y los siguientes en color unidos por una ruta de puntos dorados.
import { fold } from './figures';

export const PRESET_SAGAS = [
  {
    id: 'mistborn',
    name: 'Nacidos de la Bruma',
    alt: 'Mistborn',
    author: 'Brandon Sanderson',
    books: [
      { n: 1, title: 'El imperio final', match: ['imperio final', 'final empire'], pages: 688, isbn: '9780765311788', year: 2006 },
      { n: 2, title: 'El Pozo de la Ascensión', match: ['pozo de la ascension', 'well of ascension'], pages: 784, isbn: '9780765316882', year: 2007 },
      { n: 3, title: 'El Héroe de las Eras', match: ['heroe de las eras', 'hero of ages'], pages: 800, isbn: '9780765316899', year: 2008 },
    ],
  },
  {
    id: 'empyrean',
    name: 'Saga Empíreo',
    alt: 'The Empyrean',
    author: 'Rebecca Yarros',
    books: [
      { n: 1, title: 'Alas de Sangre', match: ['alas de sangre', 'fourth wing'], pages: 736, isbn: '9781649374042', year: 2023 },
      { n: 2, title: 'Alas de Hierro', match: ['alas de hierro', 'iron flame'], pages: 880, isbn: '9781649374172', year: 2023 },
      { n: 3, title: 'Alas de Ónice', match: ['alas de onice', 'onyx storm'], pages: 720, isbn: '9781649374189', year: 2025 },
    ],
  },
  {
    id: 'cementerio',
    name: 'El Cementerio de los Libros Olvidados',
    author: 'Carlos Ruiz Zafón',
    books: [
      { n: 1, title: 'La Sombra del Viento', match: ['sombra del viento', 'shadow of the wind'], pages: 576, isbn: '9780143034902', year: 2001 },
      { n: 2, title: 'El Juego del Ángel', match: ['juego del angel', "angel's game"], pages: 544, isbn: '9780385528702', year: 2008 },
      { n: 3, title: 'El Prisionero del Cielo', match: ['prisionero del cielo', 'prisoner of heaven'], pages: 352, isbn: '9780062206282', year: 2011 },
      { n: 4, title: 'El Laberinto de los Espíritus', match: ['laberinto de los espiritus', 'labyrinth of the spirits'], pages: 816, isbn: '9780062668707', year: 2016 },
    ],
  },
  {
    id: 'kingkiller',
    name: 'Crónica del Asesino de Reyes',
    alt: 'The Kingkiller Chronicle',
    author: 'Patrick Rothfuss',
    books: [
      { n: 1, title: 'El Nombre del Viento', match: ['nombre del viento', 'name of the wind'], pages: 880, isbn: '9780756404741', year: 2007 },
      { n: 2, title: 'El Temor de un Hombre Sabio', match: ['temor de un hombre sabio', "wise man's fear"], pages: 1200, isbn: '9780756404734', year: 2011 },
    ],
  },
  {
    id: 'lotr',
    name: 'El Señor de los Anillos',
    alt: 'The Lord of the Rings',
    author: 'J. R. R. Tolkien',
    books: [
      { n: 0, label: 'Precuela', title: 'El Hobbit', match: ['el hobbit', 'the hobbit'], pages: 320, isbn: '9780547928227', year: 1937 },
      { n: 1, title: 'La Comunidad del Anillo', match: ['comunidad del anillo', 'fellowship of the ring'], pages: 576, isbn: '9780547928210', year: 1954 },
      { n: 2, title: 'Las Dos Torres', match: ['las dos torres', 'two towers'], pages: 448, isbn: '9780547928203', year: 1954 },
      { n: 3, title: 'El Retorno del Rey', match: ['retorno del rey', 'return of the king'], pages: 512, isbn: '9780547928197', year: 1955 },
    ],
  },
];

/** Saga propia creada por la lectora a partir de una lista de títulos. */
export function customSaga({ name, author, titles }, id) {
  return {
    id,
    custom: true,
    name: name.trim(),
    author: author.trim(),
    books: titles
      .split('\n')
      .map((t) => t.trim())
      .filter(Boolean)
      .map((title, i) => ({ n: i + 1, title, match: [fold(title)] })),
  };
}

/** El libro de tu estantería que corresponde a una entrada de la saga (por título, sin acentos). */
export function findInLibrary(entry, books) {
  const keys = [fold(entry.title), ...(entry.match ?? []).map(fold)];
  return books.find((b) => {
    const t = fold(b.title);
    return keys.some((k) => k && (t === k || t.includes(k)));
  });
}

/**
 * Paradas de la ruta: cada libro con su estado. «Ahora» es el que estás leyendo de la saga o, si no lees
 * ninguno, el primero sin terminar; lo leído queda en gris y lo demás, pendiente en color.
 */
export function sagaRoute(saga, books) {
  const stops = saga.books.map((entry) => {
    const book = findInLibrary(entry, books) ?? null;
    return { entry, book, read: book?.status === 'read' };
  });
  const readingIdx = stops.findIndex((s) => s.book?.status === 'reading');
  const nowIdx = readingIdx >= 0 ? readingIdx : stops.findIndex((s) => !s.read);
  return stops.map((s, i) => ({ ...s, state: s.read ? 'read' : i === nowIdx ? 'now' : 'next' }));
}

export const sagaDone = (route) => route.filter((s) => s.read).length;
