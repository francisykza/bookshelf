// Piso inicial y vecinos inventados de «El edificio del puerto». Los vecinos solo salen en /dev/edificio-puerto.html
// y en las pruebas: nadie de aquí existe, sirven para ver cómo se vería un edificio con gente dentro. Cada piso pasa por `validateRoom`, igual que pasaría uno real.
import { createRoom, validateRoom } from './room';

let uid = 0;
const f = (id, x, y, rot = 0, tono = 0) => ({ uid: (uid += 1), id, x, y, rot, tono });
const w = (id, pared, a, tono = 0) => ({ uid: (uid += 1), id, pared, a, tono });

function room(pared, suelo, items) {
  uid = 0;
  const built = validateRoom(createRoom({ pared, suelo, items: items() }));
  if (!built) throw new Error('Piso de demostración no válido');
  return built;
}

/** Tu piso al empezar: pocas cosas, para que haya sitio para decorar. */
export function starterRoom() {
  return room('yeso', 'tablas', () => [
    f('alfombra', 3, 4),
    f('sillon', 5, 0),
    f('lampara-pie', 7, 0, 0, 0),
    f('estanteria', 1, 0),
    f('planta-grande', 0, 0),
    f('mesa-baja', 4, 4),
    f('libros', 4, 4),
    f('tetera', 5, 4),
    w('ventana', 'fondo', 5),
    w('cuadro', 'izq', 3),
  ]);
}

/** El edificio: tres plantas con dos pisos. `podio`: distinción del ranking de la librería (también inventada). */
export const NEIGHBOURS = [
  {
    id: '3b',
    puerta: '3.º B',
    nombre: 'Noa',
    room: () =>
      room('yeso', 'damero', () => [
        f('alfombra', 5, 5, 0, 1),
        f('cama', 6, 0, 0, 2),
        f('mesilla', 5, 0),
        f('lampara-mesa', 5, 0, 0, 1),
        f('sillon', 1, 1, 0, 4),
        f('lampara-pie', 0, 0, 0, 1),
        f('mesa-baja', 3, 1, 1),
        f('planta-pequena', 3, 1),
        f('gato', 6, 5, 0, 1),
        w('guirnalda', 'izq', 2, 1),
        w('cuadro', 'fondo', 2, 1),
      ]),
  },
  {
    id: '3a',
    puerta: '3.º A',
    nombre: 'Iker',
    room: () =>
      room('yeso', 'barro', () => [
        f('mesa', 3, 3),
        f('silla', 3, 2, 0),
        f('silla', 4, 5, 2),
        f('silla', 2, 3, 3),
        f('silla', 5, 4, 1),
        f('tetera', 3, 3, 0, 1),
        f('planta-pequena', 4, 4),
        f('estufa', 7, 0),
        f('banco', 0, 6, 1, 1),
        f('planta-grande', 0, 0, 0, 1),
        w('ventana', 'fondo', 2),
        w('reloj', 'fondo', 5),
      ]),
  },
  {
    id: '2b',
    puerta: '2.º B',
    nombre: 'Tú',
    propio: true,
  },
  {
    id: '2a',
    puerta: '2.º A',
    nombre: 'Lucía',
    podio: 'semana',
    room: () =>
      room('rosa', 'tablas', () => [
        f('alfombra-redonda', 3, 3, 0, 2),
        f('estanteria', 1, 0),
        f('estanteria', 3, 0, 0, 1),
        f('estanteria', 0, 2, 3),
        f('sillon', 4, 4, 0, 1),
        f('lampara-pie', 6, 4, 0, 1),
        f('mesilla', 6, 6),
        f('tetera', 6, 6, 0, 2),
        f('libros', 1, 0, 0, 1),
        f('planta-pequena', 3, 0),
        f('radio', 4, 0),
        f('planta-grande', 8, 0),
        w('ventana', 'fondo', 6, 1),
      ]),
  },
  {
    id: '1b',
    puerta: '1.º B',
    nombre: 'Joan',
    podio: 'mes',
    room: () =>
      room('noche', 'damero', () => [
        f('alfombra', 3, 3, 0, 2),
        f('sofa', 3, 0, 0, 3),
        f('mesa-baja', 4, 3, 0, 2),
        f('tetera', 4, 3),
        f('lampara-pie', 6, 0, 0, 1),
        f('lampara-pie', 2, 0),
        f('estufa', 0, 4, 0, 1),
        f('planta-grande', 8, 8),
        f('gato', 1, 6, 0, 2),
        w('cuadro', 'fondo', 3, 1),
        w('reloj', 'izq', 2),
      ]),
  },
  {
    id: '1a',
    puerta: '1.º A',
    nombre: 'Marta',
    room: () =>
      room('salvia', 'barro', () => [
        f('cama', 0, 0, 0, 1),
        f('mesilla', 3, 0),
        f('lampara-mesa', 3, 0),
        f('alfombra-redonda', 4, 4),
        f('sillon', 6, 1, 0, 2),
        f('planta-grande', 8, 0),
        f('estanteria', 4, 0, 0, 2),
        f('planta-pequena', 4, 0, 0, 2),
        f('radio', 5, 0, 0, 1),
        w('guirnalda', 'fondo', 3),
        w('ventana', 'izq', 5, 2),
      ]),
  },
];

export { SELLOS } from './catalog';

/** Sellos que «han dejado» los vecinos inventados en tu buzón. */
export const DEMO_INBOX = [
  { de: 'Marta', puerta: '1.º A', sello: 'acogedor' },
  { de: 'Lucía', puerta: '2.º A', sello: 'estanteria' },
];
