// «La librería del puerto» (prototipo, solo desarrollo): niveles hechos a mano, cada uno con una solución comprobable
// (`solution`, en el orden en que se colocan: primero lo que sostiene). Los libros son de demostración, inventados.
//
// Medidas en celdas de la cuadrícula de cada balda: `grosor` (lomo) y `alto`. De pie ocupa grosor × alto; tumbado,
// alto × grosor (girar intercambia ancho y alto). Las baldas miden `ancho` × `alto` celdas.
//
// El mínimo de movimientos de un nivel es su número de libros (cada uno se coloca una vez); las estrellas y el ranking
// se cuentan contra ese mínimo (ver `stars` en puzzle.js).

/** Colores de la paleta de BookShelf (lomos): terracota, salvia, crema, latón, tinta, mar, ciruela, ocre. */
export const SPINE = {
  terracota: [176, 92, 64],
  salvia: [112, 132, 96],
  crema: [222, 206, 170],
  laton: [190, 150, 70],
  tinta: [62, 58, 74],
  mar: [70, 112, 140],
  ciruela: [120, 72, 92],
  ocre: [200, 150, 82],
};

const book = (id, titulo, grosor, alto, color) => ({ id, titulo, grosor, alto, color });

export const LEVELS = [
  {
    id: 'n1',
    nombre: 'Primer pedido',
    objetivo: 'Coloca los cuatro libros en la balda.',
    baldas: [{ id: 'A', ancho: 6, alto: 4 }],
    libros: [book('cuaderno-sal', 'Cuaderno de sal', 1, 3, 'salvia'), book('faros', 'Faros del sur', 1, 3, 'terracota'), book('mareas', 'Mareas', 2, 3, 'mar'), book('atlas-calas', 'Atlas de calas', 2, 4, 'laton')],
    solution: [
      { libro: 'cuaderno-sal', balda: 'A', x: 0, y: 0, orient: 'pie' },
      { libro: 'faros', balda: 'A', x: 1, y: 0, orient: 'pie' },
      { libro: 'mareas', balda: 'A', x: 2, y: 0, orient: 'pie' },
      { libro: 'atlas-calas', balda: 'A', x: 4, y: 0, orient: 'pie' },
    ],
  },
  {
    id: 'n2',
    nombre: 'Dos baldas',
    objetivo: 'Reparte los ocho libros: los altos solo caben arriba.',
    baldas: [
      { id: 'A', ancho: 6, alto: 4 },
      { id: 'B', ancho: 5, alto: 3 },
    ],
    libros: [
      book('velas', 'Velas blancas', 1, 4, 'crema'),
      book('olivos', 'Bajo los olivos', 1, 4, 'salvia'),
      book('cartas-mar', 'Cartas de mar', 2, 4, 'mar'),
      book('terrazas', 'Terrazas', 2, 3, 'terracota'),
      book('pan-higos', 'Pan e higos', 2, 3, 'ocre'),
      book('azulejos', 'Azulejos', 1, 3, 'tinta'),
      book('redes', 'Redes', 1, 3, 'ciruela'),
      book('brisa', 'Brisa', 1, 3, 'laton'),
    ],
    solution: [
      { libro: 'velas', balda: 'A', x: 0, y: 0, orient: 'pie' },
      { libro: 'olivos', balda: 'A', x: 1, y: 0, orient: 'pie' },
      { libro: 'cartas-mar', balda: 'A', x: 2, y: 0, orient: 'pie' },
      { libro: 'terrazas', balda: 'A', x: 4, y: 0, orient: 'pie' },
      { libro: 'pan-higos', balda: 'B', x: 0, y: 0, orient: 'pie' },
      { libro: 'azulejos', balda: 'B', x: 2, y: 0, orient: 'pie' },
      { libro: 'redes', balda: 'B', x: 3, y: 0, orient: 'pie' },
      { libro: 'brisa', balda: 'B', x: 4, y: 0, orient: 'pie' },
    ],
  },
  {
    id: 'n3',
    nombre: 'Los grandes, tumbados',
    objetivo: 'Dos libros no caben de pie en ninguna balda: túmbalos y apila encima.',
    baldas: [
      { id: 'A', ancho: 7, alto: 4 },
      { id: 'B', ancho: 6, alto: 3 },
    ],
    libros: [
      book('gran-atlas', 'Gran atlas del puerto', 2, 5, 'laton'),
      book('diccionario', 'Diccionario marinero', 1, 5, 'tinta'),
      book('nautica', 'Náutica', 1, 4, 'mar'),
      book('islas', 'Islas', 1, 4, 'salvia'),
      book('limones', 'Limones', 1, 3, 'ocre'),
      book('puertos', 'Puertos', 1, 3, 'terracota'),
      book('gaviotas', 'Gaviotas', 1, 3, 'crema'),
      book('anclas', 'Anclas', 1, 3, 'ciruela'),
      book('cocina-mar', 'Cocina de mar', 2, 3, 'terracota'),
    ],
    solution: [
      { libro: 'gran-atlas', balda: 'A', x: 0, y: 0, orient: 'tumbado' },
      { libro: 'diccionario', balda: 'A', x: 0, y: 2, orient: 'tumbado' },
      { libro: 'nautica', balda: 'A', x: 5, y: 0, orient: 'pie' },
      { libro: 'islas', balda: 'A', x: 6, y: 0, orient: 'pie' },
      { libro: 'limones', balda: 'B', x: 0, y: 0, orient: 'pie' },
      { libro: 'puertos', balda: 'B', x: 1, y: 0, orient: 'pie' },
      { libro: 'gaviotas', balda: 'B', x: 2, y: 0, orient: 'pie' },
      { libro: 'anclas', balda: 'B', x: 3, y: 0, orient: 'pie' },
      { libro: 'cocina-mar', balda: 'B', x: 4, y: 0, orient: 'pie' },
    ],
  },
  {
    id: 'n4',
    nombre: 'Tres baldas',
    objetivo: 'La balda de abajo es bajita y la del medio, larga: cada libro tiene su sitio.',
    baldas: [
      { id: 'A', ancho: 4, alto: 4 },
      { id: 'B', ancho: 6, alto: 3 },
      { id: 'C', ancho: 4, alto: 2 },
    ],
    libros: [
      book('velero', 'El velero azul', 2, 4, 'mar'),
      book('haikus', 'Haikus del muelle', 2, 2, 'salvia'),
      book('coplas', 'Coplas de faro', 2, 2, 'ciruela'),
      book('carta-nautica', 'Carta náutica', 2, 6, 'laton'),
      book('cuentos', 'Cuentos de bajamar', 1, 6, 'terracota'),
      book('bitacora', 'Bitácora', 1, 4, 'tinta'),
      book('postales', 'Postales', 1, 4, 'ocre'),
    ],
    solution: [
      { libro: 'velero', balda: 'A', x: 0, y: 0, orient: 'pie' },
      { libro: 'haikus', balda: 'A', x: 2, y: 0, orient: 'pie' },
      { libro: 'coplas', balda: 'A', x: 2, y: 2, orient: 'pie' },
      { libro: 'carta-nautica', balda: 'B', x: 0, y: 0, orient: 'tumbado' },
      { libro: 'cuentos', balda: 'B', x: 0, y: 2, orient: 'tumbado' },
      { libro: 'bitacora', balda: 'C', x: 0, y: 0, orient: 'tumbado' },
      { libro: 'postales', balda: 'C', x: 0, y: 1, orient: 'tumbado' },
    ],
  },
  {
    id: 'n5',
    nombre: 'Sin un hueco',
    objetivo: 'Las dos baldas quedan justas: no sobra ni un hueco.',
    baldas: [
      { id: 'A', ancho: 7, alto: 4 },
      { id: 'B', ancho: 5, alto: 3 },
    ],
    libros: [
      book('mapa-costa', 'Mapa de la costa', 2, 7, 'salvia'),
      book('recetario', 'Recetario de lonja', 2, 3, 'ocre'),
      book('diario-faro', 'Diario del faro', 2, 4, 'terracota'),
      book('faro-ilustrado', 'Faros ilustrados', 2, 3, 'crema'),
      book('marea-1', 'Mareas I', 1, 3, 'mar'),
      book('marea-2', 'Mareas II', 1, 3, 'mar'),
      book('marea-3', 'Mareas III', 1, 3, 'mar'),
    ],
    solution: [
      { libro: 'mapa-costa', balda: 'A', x: 0, y: 0, orient: 'tumbado' },
      { libro: 'recetario', balda: 'A', x: 0, y: 2, orient: 'tumbado' },
      { libro: 'diario-faro', balda: 'A', x: 3, y: 2, orient: 'tumbado' },
      { libro: 'faro-ilustrado', balda: 'B', x: 0, y: 0, orient: 'pie' },
      { libro: 'marea-1', balda: 'B', x: 2, y: 0, orient: 'pie' },
      { libro: 'marea-2', balda: 'B', x: 3, y: 0, orient: 'pie' },
      { libro: 'marea-3', balda: 'B', x: 4, y: 0, orient: 'pie' },
    ],
  },
];

export const levelById = (id) => LEVELS.find((l) => l.id === id) ?? null;
