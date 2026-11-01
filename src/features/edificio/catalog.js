// Catálogo de muebles de «El edificio del puerto» (1.63, SPEC §63). Solo datos: medidas en celdas de la
// cuadrícula del piso, capa, superficie y tonos. La forma de cada mueble está en furniture.js y el dibujo en render.js.
//
// Capas: 'alfombra' (en el suelo, debajo de todo), 'suelo' (muebles: no se pisan entre sí), 'encima' (cosas pequeñas
// que van sobre un mueble con superficie) y 'pared' (en la pared del fondo o en la de la izquierda). Todo es gratis en
// el prototipo: no hay monedas, piezas ni cajas (decisión de Francisco: no se tocan esas reglas).

export const CATEGORIES = [
  { id: 'asientos', nombre: 'Para sentarse' },
  { id: 'mesas', nombre: 'Mesas y muebles' },
  { id: 'luz', nombre: 'Luz' },
  { id: 'plantas', nombre: 'Plantas' },
  { id: 'detalles', nombre: 'Detalles' },
  { id: 'pared', nombre: 'Pared' },
  { id: 'alfombras', nombre: 'Alfombras' },
];

const SALVIA = [128, 150, 112];
const TERRACOTA = [184, 98, 70];
const MOSTAZA = [204, 158, 70];
const AZUL = [86, 112, 142];
const ROSA = [206, 144, 140];
const CREMA = [232, 218, 190];
const MADERA = [150, 98, 60];
const MADERA_CLARA = [190, 142, 96];
const NOGAL = [110, 70, 46];

export const CATALOG = [
  { id: 'sillon', nombre: 'Sillón', cat: 'asientos', capa: 'suelo', w: 2, d: 2, tonos: [SALVIA, TERRACOTA, MOSTAZA, AZUL, ROSA] },
  { id: 'sofa', nombre: 'Sofá', cat: 'asientos', capa: 'suelo', w: 3, d: 2, tonos: [AZUL, SALVIA, TERRACOTA, MOSTAZA] },
  { id: 'silla', nombre: 'Silla', cat: 'asientos', capa: 'suelo', w: 1, d: 1, tonos: [MADERA, MADERA_CLARA, NOGAL] },
  { id: 'banco', nombre: 'Banco', cat: 'asientos', capa: 'suelo', w: 2, d: 1, sup: 0.7, tonos: [MADERA_CLARA, MADERA, NOGAL] },
  { id: 'mesa-baja', nombre: 'Mesa baja', cat: 'mesas', capa: 'suelo', w: 2, d: 1, sup: 0.7, tonos: [MADERA, MADERA_CLARA, NOGAL] },
  { id: 'mesa', nombre: 'Mesa', cat: 'mesas', capa: 'suelo', w: 2, d: 2, sup: 1.25, tonos: [MADERA_CLARA, MADERA, NOGAL] },
  { id: 'mesilla', nombre: 'Mesilla', cat: 'mesas', capa: 'suelo', w: 1, d: 1, sup: 0.9, tonos: [MADERA, MADERA_CLARA, NOGAL] },
  // La estantería es la puerta a «La librería del puerto»: en tu piso, al tocarla, se puede jugar
  { id: 'estanteria', nombre: 'Estantería', cat: 'mesas', capa: 'suelo', w: 2, d: 1, sup: 3.4, accion: 'libreria', tonos: [MADERA, NOGAL, MADERA_CLARA] },
  { id: 'cama', nombre: 'Cama', cat: 'mesas', capa: 'suelo', w: 3, d: 4, tonos: [CREMA, SALVIA, ROSA, AZUL] },
  { id: 'lampara-pie', nombre: 'Lámpara de pie', cat: 'luz', capa: 'suelo', w: 1, d: 1, luz: [0.5, 0.5, 2.5], tonos: [CREMA, MOSTAZA, SALVIA] },
  { id: 'estufa', nombre: 'Estufa de leña', cat: 'luz', capa: 'suelo', w: 1, d: 1, luz: [0.5, 0.86, 0.55], tonos: [[64, 60, 66], [96, 64, 52], [70, 90, 84]] },
  { id: 'lampara-mesa', nombre: 'Lámpara de mesa', cat: 'luz', capa: 'encima', w: 1, d: 1, luz: [0.5, 0.5, 0.85], tonos: [CREMA, TERRACOTA, SALVIA] },
  { id: 'planta-grande', nombre: 'Planta grande', cat: 'plantas', capa: 'suelo', w: 1, d: 1, tonos: [TERRACOTA, CREMA, AZUL] },
  { id: 'planta-pequena', nombre: 'Planta pequeña', cat: 'plantas', capa: 'encima', w: 1, d: 1, tonos: [TERRACOTA, CREMA, AZUL] },
  { id: 'libros', nombre: 'Pila de libros', cat: 'detalles', capa: 'encima', w: 1, d: 1, tonos: [TERRACOTA, AZUL, SALVIA] },
  { id: 'radio', nombre: 'Radio', cat: 'detalles', capa: 'encima', w: 1, d: 1, tonos: [[150, 104, 70], CREMA, SALVIA] },
  { id: 'tetera', nombre: 'Tetera', cat: 'detalles', capa: 'encima', w: 1, d: 1, tonos: [CREMA, AZUL, TERRACOTA] },
  { id: 'gato', nombre: 'Gato dormido', cat: 'detalles', capa: 'suelo', w: 1, d: 1, tonos: [[206, 142, 86], [128, 124, 128], [70, 64, 70]] },
  { id: 'ventana', nombre: 'Ventana al mar', cat: 'pared', capa: 'pared', w: 2, tonos: [MADERA, CREMA, SALVIA] },
  { id: 'cuadro', nombre: 'Cuadro del barco', cat: 'pared', capa: 'pared', w: 2, tonos: [NOGAL, MOSTAZA, MADERA] },
  { id: 'reloj', nombre: 'Reloj', cat: 'pared', capa: 'pared', w: 1, tonos: [NOGAL, MADERA_CLARA, CREMA] },
  { id: 'guirnalda', nombre: 'Guirnalda de luces', cat: 'pared', capa: 'pared', w: 3, luz: [1.5, 0.3, 3.55], tonos: [MOSTAZA, ROSA, CREMA] },
  { id: 'alfombra', nombre: 'Alfombra de lana', cat: 'alfombras', capa: 'alfombra', w: 3, d: 2, tonos: [TERRACOTA, SALVIA, AZUL] },
  { id: 'alfombra-redonda', nombre: 'Alfombra trenzada', cat: 'alfombras', capa: 'alfombra', w: 3, d: 3, tonos: [MOSTAZA, ROSA, SALVIA] },
];

export const catalogItem = (id) => CATALOG.find((c) => c.id === id) ?? null;

/** Colores de pared y suelo que se pueden elegir. */
export const PAREDES = [
  { id: 'yeso', nombre: 'Yeso cálido', color: [226, 204, 178] },
  { id: 'salvia', nombre: 'Salvia', color: [170, 184, 154] },
  { id: 'rosa', nombre: 'Rosa palo', color: [222, 186, 176] },
  { id: 'noche', nombre: 'Azul noche', color: [96, 108, 132] },
];

export const SUELOS = [
  { id: 'tablas', nombre: 'Tablas de madera' },
  { id: 'damero', nombre: 'Baldosa en damero' },
  { id: 'barro', nombre: 'Barro cocido' },
];

/** Sellos que se pueden dejar en el buzón de un vecino: frases cerradas, sin texto libre (no hace falta moderar). */
export const SELLOS = [
  { id: 'acogedor', texto: 'Qué acogedor' },
  { id: 'estanteria', texto: 'Menuda estantería' },
  { id: 'plantas', texto: 'Me encantan tus plantas' },
  { id: 'luz', texto: 'Qué buena luz' },
];
