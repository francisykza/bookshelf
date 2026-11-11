// Catálogo de muebles de «El edificio del puerto» (1.63, SPEC §63). Solo datos: medidas en celdas de la
// cuadrícula del piso, capa, superficie y tonos. La forma de cada mueble está en furniture.js y el dibujo en render.js.
//
// Capas: 'alfombra' (en el suelo, debajo de todo), 'suelo' (muebles: no se pisan entre sí), 'encima' (cosas pequeñas
// que van sobre un mueble con superficie) y 'pared' (en la pared del fondo o en la de la izquierda). Todo es gratis en
// el prototipo: no hay monedas, piezas ni cajas (decisión de Francisco: no se tocan esas reglas).
//
// Rareza (1.67, §67): 'comun' si no se dice; 'poco-comun' y 'raro' salen en los sobres de la tienda (economy.js).
// Místicos (docs/qa/misticos.md): rareza 'mistico' (se colocan sobre su peana y se mueven solos) o 'legendario' (no se
// colocan: te acompañan, `compania: true`). Su dibujo animado está en misticos.js; la peana, en furniture.js.
// Mascotas (1.78): `mascota: true`, un mueble de los de siempre (su cojín) con un animal animado encima (misticos.js).
// Especiales (1.79): rareza 'especial', premios que no se compran, no salen en sobres y no se regalan ni se reciclan (la
// «Placa de la suite», por llevar muebles cuatro semanas a la suite del Gran Hotel).

export const CATEGORIES = [
  { id: 'asientos', nombre: 'Para sentarse' },
  { id: 'mesas', nombre: 'Mesas y muebles' },
  { id: 'luz', nombre: 'Luz' },
  { id: 'plantas', nombre: 'Plantas' },
  { id: 'detalles', nombre: 'Detalles' },
  { id: 'pared', nombre: 'Pared' },
  { id: 'alfombras', nombre: 'Alfombras' },
  // Sin pestaña «Sagas» desde la reestructuración de muebles (9-11-2026): sus piezas siguen en CATALOG, retiradas
  { id: 'misticos', nombre: 'Místicos' },
];

/**
 * Zonas de la casa (reestructuración de muebles, decisión de Francisco del 9-11-2026: «por zona de la casa», no por tipo).
 * Es como se agrupan los muebles en la balda y en la mudanza; `cat` sigue siendo el tipo, que usan los sobres y el
 * servidor. La quinta zona, «Paredes y suelo», es la pestaña de la casa: lo de pared, las alfombras, los colores y el suelo.
 */
export const ZONAS = [
  { id: 'lectura', nombre: 'Rincón de lectura', corto: 'Lectura', icono: 'sillon' },
  { id: 'salon', nombre: 'Salón', corto: 'Salón', icono: 'mesa-baja' },
  { id: 'dormitorio', nombre: 'Dormitorio', corto: 'Dormitorio', icono: 'cama' },
  { id: 'estudio', nombre: 'Estudio', corto: 'Estudio', icono: 'escritorio' },
];
export const ZONA_PAREDES = 'paredes';
const ZONA_DE = {
  lectura: ['sillon', 'sillon-capa', 'estanteria-comics', 'lampara-pie', 'estanteria', 'mecedora', 'puf', 'libros', 'cesto-mantas', 'tetera', 'taza', 'velas'],
  dormitorio: ['cama', 'mesilla', 'comoda', 'baul', 'perchero', 'lampara-mesa'],
  estudio: ['escritorio', 'silla', 'globo', 'telescopio', 'ordenador'],
};
/** La zona de un mueble: la suya si la tiene; lo de pared y las alfombras, «Paredes y suelo»; lo demás, el salón. */
export function zonaOf(cat) {
  if (!cat) return null;
  if (cat.cat === 'misticos') return 'misticos';
  for (const [zona, ids] of Object.entries(ZONA_DE)) if (ids.includes(cat.id)) return zona;
  return cat.cat === 'pared' || cat.cat === 'alfombras' ? ZONA_PAREDES : 'salon';
}

// Sets de sagas (1.64, SPEC §64, encargo de Francisco): cada uno con nombre propio y un guiño a la saga que evoca.
// Los muebles son originales: evocan la saga con objetos corrientes (un brasero, un laúd, unas esferas de luz), nunca
// con portadas, logos, escudos ni diseños oficiales.
export const SETS = [
  { id: 'jinetes', nombre: 'Nido de jinetes', guino: 'Para quien leyó «Alas de sangre»' },
  { id: 'bruma', nombre: 'Bruma y ceniza', guino: 'Para quien leyó «Mistborn»' },
  { id: 'posada', nombre: 'La posada del camino', guino: 'Para quien leyó «El nombre del viento»' },
  { id: 'rosas', nombre: 'Corte de rosas y estrellas', guino: 'Para quien leyó «Una corte de rosas y espinas»' },
  { id: 'tormenta', nombre: 'Luz de tormenta', guino: 'Para quien leyó «El archivo de las tormentas»' },
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
const HIERRO = [64, 60, 66];
const BRONCE = [150, 104, 70];
const CUERO = [120, 70, 44];
const NEGRO = [58, 50, 56];
const GRANATE = [130, 50, 46];
const OBSIDIANA = [62, 54, 68];
const MUSGO = [74, 98, 80];
const PIZARRA = [72, 78, 92];
const ORO = [204, 170, 90];
const PLATA = [180, 184, 190];
const COBRE = [184, 120, 80];
const CRISTAL = [200, 214, 222];

export const CATALOG = [
  { id: 'sillon', nombre: 'Sillón', cat: 'asientos', capa: 'suelo', w: 2, d: 2, tonos: [SALVIA, TERRACOTA, MOSTAZA, AZUL, ROSA] },
  { id: 'sofa', rareza: 'poco-comun', nombre: 'Sofá', cat: 'asientos', capa: 'suelo', w: 3, d: 2, tonos: [AZUL, SALVIA, TERRACOTA, MOSTAZA] },
  { id: 'silla', nombre: 'Silla', cat: 'asientos', capa: 'suelo', w: 1, d: 1, tonos: [MADERA, MADERA_CLARA, NOGAL] },
  { id: 'banco', nombre: 'Banco', cat: 'asientos', capa: 'suelo', w: 2, d: 1, sup: 0.7, tonos: [MADERA_CLARA, MADERA, NOGAL] },
  { id: 'mesa-baja', nombre: 'Mesa baja', cat: 'mesas', capa: 'suelo', w: 2, d: 1, sup: 0.7, tonos: [MADERA, MADERA_CLARA, NOGAL] },
  { id: 'mesa', nombre: 'Mesa', cat: 'mesas', capa: 'suelo', w: 2, d: 2, sup: 1.25, tonos: [MADERA_CLARA, MADERA, NOGAL] },
  { id: 'mesilla', nombre: 'Mesilla', cat: 'mesas', capa: 'suelo', w: 1, d: 1, sup: 0.9, tonos: [MADERA, MADERA_CLARA, NOGAL] },
  // La estantería es la puerta a «La librería del puerto»: en tu piso, al tocarla, se puede jugar
  { id: 'estanteria', nombre: 'Estantería', cat: 'mesas', capa: 'suelo', w: 2, d: 1, sup: 3.4, accion: 'libreria', tonos: [MADERA, NOGAL, MADERA_CLARA] },
  { id: 'cama', rareza: 'poco-comun', nombre: 'Cama', cat: 'mesas', capa: 'suelo', w: 3, d: 4, tonos: [CREMA, SALVIA, ROSA, AZUL] },
  { id: 'lampara-pie', nombre: 'Lámpara de pie', cat: 'luz', capa: 'suelo', w: 1, d: 1, luz: [0.5, 0.5, 2.5], tonos: [CREMA, MOSTAZA, SALVIA] },
  { id: 'estufa', rareza: 'poco-comun', nombre: 'Estufa de leña', cat: 'luz', capa: 'suelo', w: 1, d: 1, luz: [0.5, 0.86, 0.55], tonos: [[64, 60, 66], [96, 64, 52], [70, 90, 84]] },
  { id: 'lampara-mesa', nombre: 'Lámpara de mesa', cat: 'luz', capa: 'encima', w: 1, d: 1, luz: [0.5, 0.5, 0.85], tonos: [CREMA, TERRACOTA, SALVIA] },
  { id: 'planta-grande', nombre: 'Planta grande', cat: 'plantas', capa: 'suelo', w: 1, d: 1, tonos: [TERRACOTA, CREMA, AZUL] },
  { id: 'planta-pequena', nombre: 'Planta pequeña', cat: 'plantas', capa: 'encima', w: 1, d: 1, tonos: [TERRACOTA, CREMA, AZUL] },
  { id: 'libros', nombre: 'Pila de libros', cat: 'detalles', capa: 'encima', w: 1, d: 1, tonos: [TERRACOTA, AZUL, SALVIA] },
  { id: 'radio', rareza: 'poco-comun', nombre: 'Radio', cat: 'detalles', capa: 'encima', w: 1, d: 1, tonos: [[150, 104, 70], CREMA, SALVIA] },
  { id: 'tetera', nombre: 'Tetera', cat: 'detalles', capa: 'encima', w: 1, d: 1, tonos: [CREMA, AZUL, TERRACOTA] },
  { id: 'gato', rareza: 'raro', nombre: 'Gato dormido', cat: 'detalles', capa: 'suelo', w: 1, d: 1, tonos: [[206, 142, 86], [128, 124, 128], [70, 64, 70]] },
  { id: 'ventana', nombre: 'Ventana al mar', cat: 'pared', capa: 'pared', w: 2, tonos: [MADERA, CREMA, SALVIA] },
  { id: 'cuadro', nombre: 'Cuadro del barco', cat: 'pared', capa: 'pared', w: 2, tonos: [NOGAL, MOSTAZA, MADERA] },
  { id: 'reloj', rareza: 'poco-comun', nombre: 'Reloj', cat: 'pared', capa: 'pared', w: 1, tonos: [NOGAL, MADERA_CLARA, CREMA] },
  { id: 'guirnalda', rareza: 'poco-comun', nombre: 'Guirnalda de luces', cat: 'pared', capa: 'pared', w: 3, luz: [1.5, 0.3, 3.55], tonos: [MOSTAZA, ROSA, CREMA] },
  { id: 'alfombra', nombre: 'Alfombra de lana', cat: 'alfombras', capa: 'alfombra', w: 3, d: 2, tonos: [TERRACOTA, SALVIA, AZUL] },
  { id: 'alfombra-redonda', nombre: 'Alfombra trenzada', cat: 'alfombras', capa: 'alfombra', w: 3, d: 3, tonos: [MOSTAZA, ROSA, SALVIA] },

  // ── Tanda 2 (1.69, SPEC §69: «más muebles», encargo de Francisco del 1-11-2026) ──
  { id: 'puf', nombre: 'Puf', cat: 'asientos', capa: 'suelo', w: 1, d: 1, tonos: [MOSTAZA, ROSA, SALVIA, TERRACOTA] },
  { id: 'mecedora', rareza: 'poco-comun', nombre: 'Mecedora', cat: 'asientos', capa: 'suelo', w: 1, d: 1, tonos: [MADERA, NOGAL, MADERA_CLARA] },
  { id: 'escritorio', nombre: 'Escritorio', cat: 'mesas', capa: 'suelo', w: 2, d: 1, sup: 1.22, tonos: [MADERA_CLARA, MADERA, NOGAL] },
  { id: 'comoda', nombre: 'Cómoda', cat: 'mesas', capa: 'suelo', w: 2, d: 1, sup: 1.3, tonos: [MADERA, CREMA, SALVIA] },
  { id: 'baul', nombre: 'Baúl', cat: 'mesas', capa: 'suelo', w: 2, d: 1, sup: 0.86, tonos: [MADERA, NOGAL, GRANATE] },
  { id: 'velas', nombre: 'Velas', cat: 'luz', capa: 'encima', w: 1, d: 1, luz: [0.5, 0.5, 0.55], tonos: [CREMA, ROSA, MOSTAZA] },
  { id: 'farol', rareza: 'poco-comun', nombre: 'Farol', cat: 'luz', capa: 'suelo', w: 1, d: 1, luz: [0.5, 0.5, 0.7], tonos: [HIERRO, BRONCE, MUSGO] },
  { id: 'cactus', nombre: 'Cactus', cat: 'plantas', capa: 'encima', w: 1, d: 1, tonos: [TERRACOTA, CREMA, AZUL] },
  { id: 'monstera', nombre: 'Costilla de Adán', cat: 'plantas', capa: 'suelo', w: 1, d: 1, tonos: [[196, 164, 112], CREMA, TERRACOTA] },
  { id: 'pecera', rareza: 'raro', nombre: 'Pecera', cat: 'detalles', capa: 'encima', w: 1, d: 1, luz: [0.5, 0.5, 0.3], tonos: [NEGRO, ORO, MADERA] },
  { id: 'globo', rareza: 'poco-comun', nombre: 'Bola del mundo', cat: 'detalles', capa: 'encima', w: 1, d: 1, tonos: [NOGAL, MADERA_CLARA, ORO] },
  { id: 'tocadiscos', rareza: 'poco-comun', nombre: 'Tocadiscos', cat: 'detalles', capa: 'encima', w: 1, d: 1, tonos: [MADERA, CREMA, AZUL] },
  { id: 'taza', nombre: 'Taza de té', cat: 'detalles', capa: 'encima', w: 1, d: 1, tonos: [CREMA, AZUL, TERRACOTA, MOSTAZA] },
  { id: 'estante-pared', nombre: 'Balda de pared', cat: 'pared', capa: 'pared', w: 2, tonos: [MADERA, NOGAL, MADERA_CLARA] },
  { id: 'espejo', nombre: 'Espejo', cat: 'pared', capa: 'pared', w: 1, tonos: [ORO, MADERA, NOGAL] },
  { id: 'tablon', rareza: 'especial', nombre: 'Tablón', cat: 'pared', capa: 'pared', w: 2, tonos: [[128, 80, 51]] },
  { id: 'mapa', rareza: 'poco-comun', nombre: 'Mapa del puerto', cat: 'pared', capa: 'pared', w: 2, tonos: [SALVIA, TERRACOTA, MOSTAZA] },
  { id: 'alfombra-rayas', nombre: 'Alfombra de rayas', cat: 'alfombras', capa: 'alfombra', w: 2, d: 3, tonos: [AZUL, TERRACOTA, SALVIA] },

  // ── Tanda 3 (1.78, encargo de Francisco del 3-11-2026: «otra tanda de muebles de todas las rarezas, incluida una
  // mascota»). La mascota (`mascota: true`) es un mueble raro, su cojín, y encima vive un perrito animado (misticos.js) ──
  { id: 'perchero', nombre: 'Perchero', cat: 'detalles', capa: 'suelo', w: 1, d: 1, tonos: [MADERA, NOGAL, MADERA_CLARA] },
  { id: 'cesto-mantas', nombre: 'Cesto de mantas', cat: 'detalles', capa: 'suelo', w: 1, d: 1, tonos: [TERRACOTA, SALVIA, AZUL] },
  { id: 'jarron', nombre: 'Jarrón de flores', cat: 'plantas', capa: 'encima', w: 1, d: 1, tonos: [AZUL, CREMA, TERRACOTA] },
  { id: 'chimenea', rareza: 'poco-comun', nombre: 'Chimenea', cat: 'luz', capa: 'suelo', w: 2, d: 1, sup: 1.3, luz: [1, 0.85, 0.5], tonos: [CREMA, TERRACOTA, PIZARRA] },
  { id: 'piano', rareza: 'poco-comun', nombre: 'Piano de pared', cat: 'mesas', capa: 'suelo', w: 2, d: 1, sup: 1.4, tonos: [NOGAL, NEGRO, MADERA] },
  { id: 'tapiz', rareza: 'poco-comun', nombre: 'Tapiz de olas', cat: 'pared', capa: 'pared', w: 2, tonos: [AZUL, SALVIA, TERRACOTA] },
  { id: 'telescopio', rareza: 'raro', nombre: 'Telescopio de latón', cat: 'detalles', capa: 'suelo', w: 1, d: 1, tonos: [ORO, COBRE, PLATA] },
  { id: 'perrito', rareza: 'raro', mascota: true, nombre: 'Perrito en su cojín', cat: 'detalles', capa: 'suelo', w: 1, d: 1, tonos: [[196, 140, 92], [236, 226, 206], [70, 62, 60]] },

  // ── Sagas ──
  // Nido de jinetes
  { id: 'brasero', nombre: 'Brasero', cat: 'sagas', set: 'jinetes', capa: 'suelo', w: 1, d: 1, luz: [0.5, 0.5, 1.15], tonos: [HIERRO, BRONCE] },
  { id: 'silla-montar', nombre: 'Silla de montar', cat: 'sagas', set: 'jinetes', capa: 'suelo', w: 1, d: 1, tonos: [CUERO, NEGRO, GRANATE] },
  { id: 'huevo-dragon', nombre: 'Huevo de dragón', cat: 'sagas', set: 'jinetes', capa: 'encima', w: 1, d: 1, luz: [0.5, 0.7, 0.4], tonos: [OBSIDIANA, BRONCE, MUSGO] },
  { id: 'dagas-pared', nombre: 'Dagas en la pared', cat: 'sagas', set: 'jinetes', capa: 'pared', w: 1, tonos: [NOGAL, MADERA, OBSIDIANA] },
  // Bruma y ceniza
  { id: 'farol-bruma', nombre: 'Farol de la bruma', cat: 'sagas', set: 'bruma', capa: 'suelo', w: 1, d: 1, luz: [0.5, 0.5, 2.8], tonos: [HIERRO, PIZARRA, BRONCE] },
  { id: 'viales', nombre: 'Viales de metal', cat: 'sagas', set: 'bruma', capa: 'encima', w: 1, d: 1, tonos: [MADERA, NOGAL] },
  { id: 'monedas', nombre: 'Montones de monedas', cat: 'sagas', set: 'bruma', capa: 'encima', w: 1, d: 1, tonos: [ORO, PLATA, COBRE] },
  { id: 'ventana-ceniza', nombre: 'Ventana de ceniza', cat: 'sagas', set: 'bruma', capa: 'pared', w: 2, tonos: [NOGAL, HIERRO, CREMA] },
  // La posada del camino
  { id: 'barra-posada', nombre: 'Barra de posada', cat: 'sagas', set: 'posada', capa: 'suelo', w: 3, d: 1, sup: 1.3, tonos: [MADERA, NOGAL, MADERA_CLARA] },
  { id: 'barril', nombre: 'Barril', cat: 'sagas', set: 'posada', capa: 'suelo', w: 1, d: 1, sup: 1, tonos: [MADERA, NOGAL, MADERA_CLARA] },
  { id: 'laud', nombre: 'Laúd', cat: 'sagas', set: 'posada', capa: 'pared', w: 1, tonos: [MADERA_CLARA, MADERA, NOGAL] },
  { id: 'espada-pared', nombre: 'Espada sobre la barra', cat: 'sagas', set: 'posada', capa: 'pared', w: 2, tonos: [NOGAL, MADERA, PIZARRA] },
  // Corte de rosas y estrellas
  { id: 'rosal', nombre: 'Rosal', cat: 'sagas', set: 'rosas', capa: 'suelo', w: 1, d: 1, tonos: [TERRACOTA, CREMA, PIZARRA] },
  { id: 'arco-rosas', nombre: 'Arco de rosas', cat: 'sagas', set: 'rosas', capa: 'suelo', w: 2, d: 1, tonos: [CREMA, MADERA, HIERRO] },
  { id: 'mascara', nombre: 'Máscara de baile', cat: 'sagas', set: 'rosas', capa: 'pared', w: 1, tonos: [ORO, NEGRO, PLATA] },
  { id: 'ventana-estrellas', nombre: 'Ventana de estrellas', cat: 'sagas', set: 'rosas', capa: 'pared', w: 2, luz: [1, 0.3, 2.6], tonos: [NOGAL, CREMA, PIZARRA] },
  // Luz de tormenta
  { id: 'esferas', nombre: 'Cuenco de esferas', cat: 'sagas', set: 'tormenta', capa: 'encima', w: 1, d: 1, luz: [0.5, 0.5, 0.3], tonos: [CRISTAL, ORO, HIERRO] },
  { id: 'lampara-gemas', nombre: 'Lámpara de gemas', cat: 'sagas', set: 'tormenta', capa: 'suelo', w: 1, d: 1, luz: [0.5, 0.5, 1.9], tonos: [HIERRO, BRONCE, MUSGO] },
  { id: 'atril', nombre: 'Atril de estudio', cat: 'sagas', set: 'tormenta', capa: 'suelo', w: 1, d: 1, tonos: [MADERA, NOGAL, MADERA_CLARA] },
  { id: 'cuadro-tormenta', nombre: 'Cuadro de la tormenta', cat: 'sagas', set: 'tormenta', capa: 'pared', w: 2, tonos: [NOGAL, MOSTAZA, MADERA] },

  // ── Místicos (primera tanda, decisión de Francisco del 2-11-2026) ──
  { id: 'farol-azul', rareza: 'mistico', nombre: 'Farol de llama azul', cat: 'misticos', capa: 'suelo', w: 1, d: 1, luz: [0.5, 0.5, 0.75], tonos: [OBSIDIANA], guino: 'Para quien leyó «El nombre del viento»' },
  { id: 'rosa-estrellas', rareza: 'mistico', nombre: 'Rosa bajo la lluvia de estrellas', cat: 'misticos', capa: 'suelo', w: 1, d: 1, tonos: [OBSIDIANA], guino: 'Para quien leyó «Una corte de rosas y espinas»' },
  { id: 'dragoncillo', rareza: 'legendario', compania: true, nombre: 'Dragoncillo de escamas rojas', cat: 'misticos', capa: 'suelo', w: 1, d: 1, tonos: [OBSIDIANA], guino: 'Para quien leyó «Alas de sangre»' },
  { id: 'zorro-bruma', rareza: 'legendario', compania: true, nombre: 'Zorro de bruma y ceniza', cat: 'misticos', capa: 'suelo', w: 1, d: 1, tonos: [OBSIDIANA], guino: 'Para quien leyó «Mistborn»' },
  // 1.78: el búho no lleva guiño a ninguna saga: es de quien lee hasta tarde
  { id: 'buho-estrellas', rareza: 'mistico', nombre: 'Búho de las constelaciones', cat: 'misticos', capa: 'suelo', w: 1, d: 1, tonos: [OBSIDIANA], guino: 'Para quien lee hasta tarde' },
  { id: 'cinta-tormenta', rareza: 'legendario', compania: true, nombre: 'Cinta de luz de tormenta', cat: 'misticos', capa: 'suelo', w: 1, d: 1, tonos: [OBSIDIANA], guino: 'Para quien leyó «El archivo de las tormentas»' },

  // ── Premios (1.79): la placa de quien ha decorado la suite de la semana del Gran Hotel ──
  { id: 'placa-suite', rareza: 'especial', nombre: 'Placa de la suite', cat: 'pared', capa: 'pared', w: 1, tonos: [ORO], guino: 'Por decorar cuatro semanas la suite del Gran Hotel' },

  // ── La caja del casino (1.80, `casino: true`): se cambian por fichas, se tienen una vez y no salen en sobres. Los
  // muebles son premios (rareza 'especial') con efectos; los `vivo` llevan encima algo animado (misticos.js). El conejo
  // es un legendario que te acompaña ──
  { id: 'neon-veintiuna', rareza: 'especial', casino: true, nombre: 'Rótulo de neón «21»', cat: 'pared', capa: 'pared', w: 2, luz: [1, 0.3, 2.95], tonos: [[255, 112, 170]], guino: 'De la caja del casino del Gran Hotel' },
  { id: 'mesa-tapete', rareza: 'especial', casino: true, vivo: true, nombre: 'Mesa de tapete verde', cat: 'mesas', capa: 'suelo', w: 2, d: 1, sup: 0.95, tonos: [[44, 122, 78]], guino: 'De la caja del casino del Gran Hotel' },
  { id: 'gramola', rareza: 'especial', casino: true, vivo: true, nombre: 'Gramola', cat: 'detalles', capa: 'suelo', w: 1, d: 1, luz: [0.5, 0.6, 1.2], tonos: [[110, 58, 40]], guino: 'De la caja del casino del Gran Hotel' },
  { id: 'conejo-chistera', rareza: 'legendario', compania: true, casino: true, nombre: 'Conejo de la chistera', cat: 'misticos', capa: 'suelo', w: 1, d: 1, tonos: [OBSIDIANA], guino: 'De la caja del casino del Gran Hotel' },
  // 1.112 (docs/qa/casino-3d.md §4): la alfombra de la caja y el baúl de las chisteras (este, con sellos de partidas perfectas)
  { id: 'alfombra-rombos', rareza: 'especial', casino: true, nombre: 'Alfombra de rombos dorados', cat: 'alfombras', capa: 'alfombra', w: 3, d: 2, tonos: [[104, 24, 42]], guino: 'De la caja del casino del Gran Hotel' },
  { id: 'baul-mago', rareza: 'especial', casino: true, nombre: 'Baúl de mago', cat: 'mesas', capa: 'suelo', w: 2, d: 1, sup: 0.88, tonos: [[50, 42, 100]], guino: 'De las tres chisteras del casino' },

  // ── La pared de la Lonja (1.86): la gaviota, que como el conejo no sale en sobres (por eso `casino`) ──
  { id: 'gaviota-puerto', rareza: 'legendario', compania: true, casino: true, nombre: 'Gaviota del puerto', cat: 'misticos', capa: 'suelo', w: 1, d: 1, tonos: [OBSIDIANA], guino: 'De la pared de premios de la Lonja' },

  // ── Las placas de los talleres (1.86, talleres.js): premios, como la de la suite ──
  { id: 'placa-ebanisteria', rareza: 'especial', nombre: 'Placa de Ebanistería Marín', cat: 'pared', capa: 'pared', w: 1, tonos: [[132, 84, 48]], guino: 'Por completar Ebanistería Marín' },
  { id: 'placa-tapiceria', rareza: 'especial', nombre: 'Placa de Tapicerías La Bahía', cat: 'pared', capa: 'pared', w: 1, tonos: [[176, 92, 84]], guino: 'Por completar Tapicerías La Bahía' },
  { id: 'placa-faro', rareza: 'especial', nombre: 'Placa de Lámparas del Faro', cat: 'pared', capa: 'pared', w: 1, tonos: [[214, 164, 72]], guino: 'Por completar Lámparas del Faro' },
  { id: 'placa-vivero', rareza: 'especial', nombre: 'Placa de Vivero del Muelle', cat: 'pared', capa: 'pared', w: 1, tonos: [[86, 128, 88]], guino: 'Por completar Vivero del Muelle' },
  { id: 'placa-almoneda', rareza: 'especial', nombre: 'Placa de Almoneda del Capitán', cat: 'pared', capa: 'pared', w: 1, tonos: [[70, 96, 132]], guino: 'Por completar Almoneda del Capitán' },
  { id: 'placa-menaje', rareza: 'especial', nombre: 'Placa de Menaje Las Dos Anclas', cat: 'pared', capa: 'pared', w: 1, tonos: [[122, 92, 140]], guino: 'Por completar Menaje Las Dos Anclas' },
  { id: 'placa-heroes', rareza: 'especial', nombre: 'Placa de Capa y Antifaz', cat: 'pared', capa: 'pared', w: 1, tonos: [[168, 44, 52]], guino: 'Por completar Capa y Antifaz' },

  // ── La colección de superhéroes (1.101, encargo de Francisco del 9-11-2026): la primera habitación temática del Almacén
  // del Puerto. Muebles originales del género (capas, antifaces, viñetas, focos y rayos), nunca personajes, emblemas ni logos.
  // Son del taller «Capa y Antifaz» (talleres.js) ──
  { id: 'sillon-capa', coleccion: 'heroes', rareza: 'poco-comun', nombre: 'Sillón de la capa', cat: 'asientos', capa: 'suelo', w: 2, d: 2, tonos: [AZUL, GRANATE, PIZARRA] },
  { id: 'estanteria-comics', coleccion: 'heroes', nombre: 'Expositor de cómics', cat: 'mesas', capa: 'suelo', w: 2, d: 1, tonos: [MADERA, NEGRO, AZUL] },
  { id: 'foco-heroe', coleccion: 'heroes', rareza: 'poco-comun', nombre: 'Foco de la señal', cat: 'luz', capa: 'suelo', w: 1, d: 1, luz: [0.5, 0.85, 1.4], tonos: [HIERRO, GRANATE, ORO] },
  { id: 'maniqui-capa', coleccion: 'heroes', rareza: 'poco-comun', nombre: 'Maniquí con capa', cat: 'detalles', capa: 'suelo', w: 1, d: 1, tonos: [AZUL, GRANATE, MUSGO] },
  { id: 'cartel-vinetas', coleccion: 'heroes', nombre: 'Lámina de viñetas', cat: 'pared', capa: 'pared', w: 2, tonos: [NEGRO, GRANATE, AZUL] },
  { id: 'neon-rayo', coleccion: 'heroes', rareza: 'poco-comun', nombre: 'Neón del rayo', cat: 'pared', capa: 'pared', w: 1, luz: [0.5, 0.3, 2.7], tonos: [[250, 206, 80], [110, 210, 240], [240, 110, 150]] },

  // ── La lata de los garbanzos (1.82): premios humildes, con las mismas reglas que los de la caja ──
  { id: 'tarro-garbanzos', rareza: 'especial', casino: true, nombre: 'Tarro de garbanzos', cat: 'detalles', capa: 'encima', w: 1, d: 1, tonos: [[222, 186, 118]], guino: 'De la lata de los garbanzos del casino' },
  { id: 'baraja-naipes', rareza: 'especial', casino: true, nombre: 'Baraja de naipes', cat: 'detalles', capa: 'encima', w: 1, d: 1, tonos: [[122, 30, 44]], guino: 'De la lata de los garbanzos del casino' },
  { id: 'taburete-barra', rareza: 'especial', casino: true, nombre: 'Taburete de barra', cat: 'asientos', capa: 'suelo', w: 1, d: 1, tonos: [[122, 30, 44]], guino: 'De la lata de los garbanzos del casino' },

  // ── La ruleta de premios del casino (1.109, hotel/ruleta.js): premios con las mismas reglas que los de la caja (`ruleta`:
  // salen en la ruleta de la semana). El reloj es la casilla rara ──
  { id: 'lampara-flecos', rareza: 'especial', casino: true, ruleta: true, nombre: 'Lámpara de flecos', cat: 'luz', capa: 'suelo', w: 1, d: 1, luz: [0.5, 0.5, 2.5], tonos: [[150, 40, 62]], guino: 'De la ruleta del casino del Gran Hotel' },
  { id: 'ruleta-sobremesa', rareza: 'especial', casino: true, ruleta: true, nombre: 'Ruleta de sobremesa', cat: 'detalles', capa: 'suelo', w: 1, d: 1, tonos: [[118, 70, 46]], guino: 'De la ruleta del casino del Gran Hotel' },
  { id: 'reloj-deco', rareza: 'especial', casino: true, ruleta: true, nombre: 'Reloj de pie art déco', cat: 'detalles', capa: 'suelo', w: 1, d: 1, tonos: [[84, 50, 40]], guino: 'De la ruleta del casino del Gran Hotel' },
  // La casilla más rara: un compañero legendario que te acompaña a todas partes, como el conejo y la gaviota
  { id: 'mapache-crupier', rareza: 'legendario', compania: true, casino: true, ruleta: true, nombre: 'Mapache crupier', cat: 'misticos', capa: 'suelo', w: 1, d: 1, tonos: [OBSIDIANA], guino: 'La casilla más rara de la ruleta del casino' },
];

/** Los premios (rareza 'especial'): no se compran, no salen en sobres y no se regalan ni se reciclan. */
export const isEspecial = (c) => c?.rareza === 'especial';

/** Si un mueble es místico (de los que se colocan o de los que acompañan). */
export const isMistico = (c) => c?.rareza === 'mistico' || c?.rareza === 'legendario';
/** Los legendarios: te acompañan, no se colocan. */
export const COMPANEROS = CATALOG.filter((c) => c.compania);

// Piezas de un laboratorio: se encuentran por su id, pero no están en el catálogo que se vende ni en el del servidor
const EXTRA = new Map();
export const registerCatalogItem = (item) => EXTRA.set(item.id, item);
export const catalogItem = (id) => CATALOG.find((c) => c.id === id) ?? EXTRA.get(id) ?? null;
export const setOf = (id) => SETS.find((s) => s.id === id) ?? null;

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

// Las frases del libro de visitas (1.71, §71): sin texto libre; las mismas que piso_firmas() en el servidor
export const FIRMAS = [
  { id: 'saludo', texto: 'Pasé a saludar' },
  { id: 'leer', texto: 'Me quedaría aquí a leer' },
  { id: 'luz', texto: 'Qué luz tan bonita' },
  { id: 'cafe', texto: 'Otro día traigo café' },
  { id: 'pronto', texto: 'Vuelvo pronto' },
  { id: 'gracias', texto: 'Gracias por abrirme' },
];
