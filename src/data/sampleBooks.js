// Colección inicial (SPEC §5): ediciones variadas (cuero, tela, cantos pintados, e-reader, audiolibro…),
// fechas relativas al primer arranque para que estadísticas y misiones
// tengan vida desde el principio. Sinopsis escritas para BookShelf.
import { createBook, isbnCover } from '../domain/books';
import { addDays, dayKey } from '../domain/dates';

const ago = (days) => addDays(new Date(), -days).toISOString();

const SAMPLE = [
  {
    id: 'circe',
    title: 'Circe',
    author: 'Madeline Miller',
    isbn: '9780316556347',
    pageCount: 420,
    currentPage: 184,
    status: 'reading',
    editionType: 'leatherbound',
    categories: ['Fantasía', 'Mitología'],
    publishedDate: '2018',
    synopsis:
      'La hija del titán Helios, despreciada por los dioses, descubre en el destierro de su isla el poder de la brujería y una voz propia frente a héroes, monstruos y divinidades.',
    startedAt: ago(16),
    addedAt: ago(40),
  },
  {
    id: 'hail-mary',
    title: 'Proyecto Hail Mary',
    author: 'Andy Weir',
    isbn: '9780593135204',
    pageCount: 496,
    currentPage: 61,
    status: 'reading',
    editionType: 'kindle',
    categories: ['Ciencia ficción'],
    publishedDate: '2021',
    synopsis:
      'Un profesor despierta solo en una nave a años luz de la Tierra, sin recordar quién es, con la misión de salvar al Sol de una extraña plaga… y un aliado inesperado.',
    startedAt: ago(5),
    addedAt: ago(60),
  },
  {
    id: 'principito',
    title: 'El Principito',
    author: 'Antoine de Saint-Exupéry',
    isbn: '9780156012195',
    pageCount: 96,
    currentPage: 74,
    status: 'reading',
    editionType: 'clothbound',
    rating: 0,
    categories: ['Clásico', 'Fábula'],
    publishedDate: '1943',
    synopsis:
      'Un aviador perdido en el desierto conoce a un niño llegado de un asteroide diminuto, que le cuenta sus viajes por planetas habitados por adultos muy extraños.',
    quotes: [{ id: 'q-principito', text: 'Lo esencial es invisible a los ojos.', page: 72, color: 'gold', createdAt: ago(2) }],
    startedAt: ago(3),
    addedAt: ago(200),
  },
  {
    id: 'nombre-viento',
    title: 'El Nombre del Viento',
    author: 'Patrick Rothfuss',
    isbn: '9780756404741',
    pageCount: 880,
    currentPage: 880,
    status: 'read',
    editionType: 'leatherbound',
    rating: 5,
    favorite: true,
    categories: ['Fantasía'],
    publishedDate: '2007',
    synopsis:
      'Kvothe, ahora posadero bajo otro nombre, relata su vida: la troupe de artistas, la calle, la Universidad y la búsqueda obstinada de quienes destruyeron a su familia.',
    review: 'La música en la prosa. Volvería a la Universidad solo por el Archivo.',
    reviewedAt: ago(90),
    finishedAt: ago(95),
    startedAt: ago(130),
    addedAt: ago(160),
  },
  {
    id: 'alas-sangre',
    title: 'Alas de Sangre',
    author: 'Rebecca Yarros',
    isbn: '9781649374042',
    pageCount: 736,
    currentPage: 736,
    status: 'read',
    editionType: 'sprayed_edges',
    sprayedEdgeStyle: 'dragon_fire',
    rating: 5,
    favorite: true,
    categories: ['Fantasía', 'Romántica'],
    publishedDate: '2023',
    synopsis:
      'Violet Sorrengail, destinada a ser escriba, es obligada a entrar en el Colegio de Guerra de Basgiath, donde los jinetes de dragones se gradúan o mueren en el intento.',
    review: 'Tairn y Andarna se han quedado a vivir en mi cabeza. Las últimas cien páginas, sin respirar.',
    reviewedAt: ago(12),
    finishedAt: ago(14),
    startedAt: ago(24),
    addedAt: ago(30),
  },
  {
    id: 'castillo',
    title: 'El Castillo Ambulante',
    author: 'Diana Wynne Jones',
    isbn: '9780061478789',
    pageCount: 336,
    currentPage: 336,
    status: 'read',
    editionType: 'sprayed_edges',
    sprayedEdgeStyle: 'botanical',
    rating: 5,
    favorite: true,
    categories: ['Fantasía', 'Juvenil'],
    publishedDate: '1986',
    synopsis:
      'Sophie, convertida en anciana por una bruja, encuentra refugio en el castillo errante del mago Howl, junto a un demonio de fuego con muy mal carácter.',
    review: 'Sophie es mi heroína. Calcifer, mi mascota soñada.',
    reviewedAt: ago(48),
    finishedAt: ago(50),
    startedAt: ago(58),
    addedAt: ago(120),
  },
  {
    id: 'sombra-viento',
    title: 'La Sombra del Viento',
    author: 'Carlos Ruiz Zafón',
    isbn: '9780143034902',
    pageCount: 576,
    currentPage: 576,
    status: 'read',
    editionType: 'annotated',
    rating: 5,
    categories: ['Misterio', 'Literaria'],
    publishedDate: '2001',
    synopsis:
      'En la Barcelona de posguerra, Daniel elige un libro en el Cementerio de los Libros Olvidados y se descubre persiguiendo el rastro de su autor desaparecido.',
    finishedAt: ago(26),
    startedAt: ago(45),
    addedAt: ago(300),
  },
  {
    id: 'orgullo',
    title: 'Orgullo y prejuicio',
    author: 'Jane Austen',
    isbn: '9780141439518',
    pageCount: 432,
    currentPage: 432,
    status: 'read',
    editionType: 'paperback',
    rating: 4,
    categories: ['Clásico', 'Romance'],
    publishedDate: '1813',
    synopsis:
      'Elizabeth Bennet y el señor Darcy se miden a golpe de ingenio, orgullo y malentendidos en la Inglaterra rural de la Regencia.',
    quotes: [
      {
        id: 'q-orgullo',
        text: 'Es una verdad universalmente reconocida que un hombre soltero, poseedor de una gran fortuna, necesita una esposa.',
        page: 5,
        color: 'yellow',
        createdAt: ago(70),
      },
    ],
    finishedAt: ago(66),
    startedAt: ago(80),
    addedAt: ago(250),
  },
  {
    id: 'momo',
    title: 'Momo',
    author: 'Michael Ende',
    isbn: '9780140317534',
    pageCount: 272,
    status: 'want',
    editionType: 'paperback',
    categories: ['Fantasía', 'Juvenil'],
    publishedDate: '1973',
    synopsis:
      'Una niña que sabe escuchar como nadie se enfrenta a los hombres grises, que roban el tiempo a los habitantes de la ciudad.',
    addedAt: ago(35),
  },
  {
    id: 'kafka',
    title: 'Kafka en la orilla',
    author: 'Haruki Murakami',
    isbn: '9781400079278',
    pageCount: 592,
    status: 'want',
    editionType: 'audiobook',
    audioHours: 19,
    categories: ['Literaria', 'Realismo mágico'],
    publishedDate: '2002',
    synopsis:
      'Un adolescente que huye de casa y un anciano que habla con los gatos recorren caminos paralelos que se acercan sin tocarse.',
    addedAt: ago(110),
  },
  {
    id: 'guerra-paz',
    title: 'Guerra y paz',
    author: 'León Tolstói',
    isbn: '9781400079988',
    pageCount: 1296,
    status: 'want',
    editionType: 'hardcover',
    categories: ['Clásico', 'Histórica'],
    publishedDate: '1869',
    synopsis:
      'Varias familias de la aristocracia rusa atraviesan las guerras napoleónicas entre bailes, batallas, amores y preguntas sobre el sentido de la historia.',
    addedAt: ago(214),
  },
  {
    id: 'hobbit',
    title: 'El Hobbit',
    author: 'J. R. R. Tolkien',
    isbn: '9780547928227',
    pageCount: 320,
    status: 'want',
    editionType: 'hardcover',
    categories: ['Fantasía', 'Aventura'],
    publishedDate: '1937',
    synopsis:
      'Bilbo Bolsón, que adoraba su sillón y su despensa, acaba en una aventura con trece enanos y un mago rumbo a la montaña de un dragón.',
    addedAt: ago(20),
  },
  {
    id: 'mistborn',
    title: 'Nacidos de la bruma: El imperio final',
    author: 'Brandon Sanderson',
    isbn: '9780765311788',
    pageCount: 688,
    status: 'want',
    editionType: 'hardcover',
    categories: ['Fantasía'],
    publishedDate: '2006',
    synopsis:
      'En un imperio donde cae ceniza del cielo y la bruma cubre las noches, una joven ladrona descubre que puede quemar metales para obtener poderes y se une a un plan imposible contra el Lord Legislador.',
    addedAt: ago(6),
  },
  {
    id: 'medianoche',
    title: 'La biblioteca de la medianoche',
    author: 'Matt Haig',
    isbn: '9780525559474',
    pageCount: 336,
    status: 'want',
    editionType: 'paperback',
    categories: ['Ficción', 'Fantasía'],
    publishedDate: '2020',
    synopsis:
      'Entre la vida y la muerte existe una biblioteca infinita donde cada libro es una vida que podrías haber vivido.',
    addedAt: ago(9),
  },
];

export function sampleBooks() {
  return SAMPLE.map((b) =>
    createBook({ ...b, cover: isbnCover(b.isbn), source: 'sample', updatedAt: b.startedAt || b.addedAt }),
  );
}

/** Dos semanas de lectura previas para que el portátil tenga datos desde el primer día. */
export function sampleReadingLog() {
  const pattern = [22, 0, 35, 18, 41, 0, 27, 30, 12, 46, 0, 24, 38, 16];
  const books = ['circe', 'circe', 'circe', 'principito', 'circe', 'hail-mary', 'circe', 'hail-mary', 'circe', 'principito', 'circe', 'hail-mary', 'circe', 'principito'];
  return pattern
    .map((pages, i) => ({ date: dayKey(addDays(new Date(), i - pattern.length)), bookId: books[i], pages }))
    .filter((e) => e.pages > 0);
}

/** Ediciones de la colección inicial: se aplican al migrar bibliotecas guardadas antes de la 1.10.0. */
export const SAMPLE_EDITIONS = Object.fromEntries(
  SAMPLE.map((b) => [b.id, { editionType: b.editionType, sprayedEdgeStyle: b.sprayedEdgeStyle, audioHours: b.audioHours }]),
);

/** Libros de ejemplo añadidos en versiones posteriores. */
export function sampleBook(id) {
  return sampleBooks().find((b) => b.id === id);
}
