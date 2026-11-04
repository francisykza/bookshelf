// Los talleres del puerto (1.86): cada mueble de la tienda sale de un taller con nombre (inventados: ninguno es una marca real).
// Tener una copia de todo lo de un taller da su placa para la pared y unos sellos, una sola vez. La misma lista que piso_talleres
// en el servidor (una prueba lo comprueba). Quedan fuera las sagas, los místicos, las mascotas y los premios.

export const PREMIO_TALLER = 30;

export const TALLERES = [
  {
    id: 'ebanisteria',
    nombre: 'Ebanistería Marín',
    lema: 'Madera de barco, a escuadra y sin prisa.',
    color: [132, 84, 48],
    muebles: ['silla', 'mesa', 'mesa-baja', 'mesilla', 'comoda', 'baul', 'escritorio', 'estanteria', 'piano'],
  },
  {
    id: 'tapiceria',
    nombre: 'Tapicerías La Bahía',
    lema: 'Lo blando de la casa, cosido a mano.',
    color: [176, 92, 84],
    muebles: ['sillon', 'banco', 'puf', 'sofa', 'mecedora', 'cama', 'alfombra', 'alfombra-redonda', 'alfombra-rayas', 'cesto-mantas'],
  },
  {
    id: 'faro',
    nombre: 'Lámparas del Faro',
    lema: 'Que no se quede a oscuras ni un rincón.',
    color: [214, 164, 72],
    muebles: ['lampara-pie', 'lampara-mesa', 'velas', 'estufa', 'farol', 'chimenea', 'guirnalda'],
  },
  {
    id: 'vivero',
    nombre: 'Vivero del Muelle',
    lema: 'Plantas y compañía que aguantan el salitre.',
    color: [86, 128, 88],
    muebles: ['planta-grande', 'planta-pequena', 'cactus', 'monstera', 'jarron', 'pecera', 'gato'],
  },
  {
    id: 'almoneda',
    nombre: 'Almoneda del Capitán',
    lema: 'Lo que trajeron los barcos y nadie reclamó.',
    color: [70, 96, 132],
    muebles: ['globo', 'telescopio', 'mapa', 'reloj', 'radio', 'tocadiscos', 'tapiz'],
  },
  {
    id: 'menaje',
    nombre: 'Menaje Las Dos Anclas',
    lema: 'Lo pequeño, que es lo que hace casa.',
    color: [122, 92, 140],
    muebles: ['libros', 'tetera', 'taza', 'perchero', 'ventana', 'cuadro', 'estante-pared', 'espejo'],
  },
];

export const tallerDe = (mueble) => TALLERES.find((t) => t.muebles.includes(mueble)) ?? null;
export const placaDe = (taller) => `placa-${taller}`;
