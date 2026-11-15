// El café-librería del bajo, 1.133 (encargo de Francisco del 14-11-2026; plan en docs/qa/cafe-libreria.md §16.3, cifras
// aprobadas el mismo día, «Sí, esas cifras del taller»): el taller de la trastienda, primera tanda (bloque 2 de §16.6).
// - Desde el nivel 3 (la Librería), una puerta baja detrás de la barra lleva al taller: el banco de don Celestino, un
//   encuadernador jubilado del barrio que te lo deja y te enseña el primer encargo.
// - Como mucho un encargo de un cliente al día. No caduca: el que llega espera en el banco hasta que lo hagas, y el siguiente
//   llega otro día. Sin prisas ni reloj.
// - Cada libro (un clásico de dominio público, de una lista cerrada, con su cubierta dibujada y gastada) trae de 2 a 5 daños
//   según el nivel, y cada daño se arregla con su gesto, su objeto y su sonido (`cafeTallerGestos.js`). En esta tanda, cinco:
//   polvo y moho, manchas y lápiz, página arrugada, lomo despegado (cola y prensa) y título borrado (pan de oro).
// - Al terminar, el ex libris del taller en la guarda y la ficha «antes / después».
// - Estrellas de 1 a 3 según el mimo de cada daño (nunca cero; se ve qué se podía mejorar). Paga 6 / 9 / 12 granos y 15 / 22 /
//   30 de reputación, aparte del tope diario y sin tickets. Pilar no restaura.
// Las cifras y las listas son las de la migración `20261220120000_cafe_taller.sql` (una prueba lo comprueba). Solo reglas:
// sin React ni Three.

/** El nivel desde el que se abre el taller (la Librería). */
export const TALLER_NIVEL = 3;

/** Lo que paga un encargo según sus estrellas: [granos, reputación]. */
export const PREMIO_TALLER = { 1: [6, 15], 2: [9, 22], 3: [12, 30] };
/** Bloque 3 (aún no está): el encargo de un amigo paga la mitad (cifras aprobadas el 14-11-2026). */
export const PREMIO_AMIGO = { 1: [3, 8], 2: [5, 11], 3: [6, 15] };

/** Los daños de esta tanda, en el orden en que se trabajan. */
export const DANOS = ['polvo', 'manchas', 'arrugas', 'lomo', 'dorado'];

/**
 * Cada daño: su nombre, su objeto, lo que se pide y su ayuda, el atajo (un toque, con movimiento reducido o con el teclado)
 * y lo que dice don Celestino según cómo quede (`bien`) o qué se podía mejorar (`mejor`).
 */
export const DANO = {
  polvo: {
    nombre: 'Polvo y moho',
    objeto: 'la brocha de pelo suave',
    orden: 'Quita el polvo con la brocha',
    ayuda: 'Pasadas largas y suaves por toda la tapa, también por las manchas de moho.',
    atajo: 'Cepillar',
    bien: '«Mira cómo brilla el polvo a contraluz. Así, sin prisa.»',
    mejor: 'Con pasadas más largas y suaves, el polvo no se mete en la tela.',
  },
  manchas: {
    nombre: 'Manchas y lápiz',
    objeto: 'la goma de miga',
    orden: 'Frota las manchas con la goma de miga',
    ayuda: 'Círculos pequeños sobre cada mancha.',
    barrer: 'Barre las migas con el canto de la mano',
    ayudaBarrer: 'Una pasada de lado a lado de la página.',
    atajo: 'Borrar las manchas',
    bien: '«Ni se nota que estuvieron. La miga no daña el papel.»',
    mejor: 'Con círculos más pequeños, solo sobre la mancha, el papel no se cansa.',
  },
  arrugas: {
    nombre: 'Página arrugada',
    objeto: 'la plegadera de hueso',
    orden: 'Alisa el pliegue con la plegadera',
    // 1.133.2 (Francisco: que se entienda sin explicarlo): se ve la cresta, y baja por tramos bajo la plegadera
    ayuda: 'Desliza la plegadera por encima del pliegue hasta que quede plano.',
    atajo: 'Alisar la página',
    bien: '«Lisa como el primer día. Pegada al pliegue, así se hace.»',
    mejor: 'Pegada al pliegue, la plegadera alisa sin marcar el papel de alrededor.',
  },
  lomo: {
    nombre: 'Lomo despegado',
    objeto: 'la cola caliente y la prensa',
    orden: 'Pincela el lomo con cola caliente',
    ayuda: 'Una capa fina y pareja, de la cabeza al pie.',
    prensa: 'Gira el husillo de la prensa hasta el tope',
    ayudaPrensa: 'Vueltas tranquilas alrededor del husillo; cuando cruja la madera, ya está.',
    atajo: 'Encolar y prensar',
    bien: '«Ese lomo aguanta otros cien años.»',
    mejor: 'Una capa más fina: la cola de más rezuma por la cabeza del libro.',
  },
  dorado: {
    nombre: 'Título borrado',
    objeto: 'el pan de oro y el hierro caliente',
    orden: 'Dora el título letra a letra',
    ayuda: 'Aprieta y mantén el hierro caliente sobre cada letra, en su centro.',
    atajo: 'Dorar el título',
    bien: '«Fíjate cómo se encienden las letras. Oro fino, bien centrado.»',
    mejor: 'Con el hierro justo en el centro de cada letra, el oro no se sale del surco.',
  },
};

/** El ex libris del taller, en la guarda, para terminar. */
export const EXLIBRIS = {
  orden: 'Pon el ex libris del taller en la guarda',
  ayuda: 'Aprieta y mantén el sello hasta que quede marcado.',
  atajo: 'Poner el ex libris',
  /** 1.133.2: lo que dice don Celestino nada más sellar. */
  sellado: '«¡Eso es! Ya lleva la marca de la casa.»',
};

/**
 * Los libros que traen los clientes: clásicos de dominio público (lista cerrada), con su cubierta dibujada por nosotros (su
 * tela, su adorno y el título en la tapa, en mayúsculas, hasta 9 letras). El índice es el que guarda el servidor.
 */
export const LIBROS_TALLER = [
  { titulo: 'Don Quijote de la Mancha', autor: 'Miguel de Cervantes', tapa: 'QUIJOTE', tela: [122, 44, 46], adorno: 'molino' },
  { titulo: 'La Regenta', autor: 'Leopoldo Alas «Clarín»', tapa: 'REGENTA', tela: [50, 86, 64], adorno: 'torre' },
  { titulo: 'Rimas y leyendas', autor: 'Gustavo Adolfo Bécquer', tapa: 'RIMAS', tela: [44, 56, 96], adorno: 'golondrina' },
  { titulo: 'Doña Perfecta', autor: 'Benito Pérez Galdós', tapa: 'PERFECTA', tela: [168, 120, 52], adorno: 'flor' },
  { titulo: 'Los pazos de Ulloa', autor: 'Emilia Pardo Bazán', tapa: 'ULLOA', tela: [78, 92, 50], adorno: 'hoja' },
  { titulo: 'Pepita Jiménez', autor: 'Juan Valera', tapa: 'PEPITA', tela: [150, 84, 92], adorno: 'rosa' },
  { titulo: 'Don Juan Tenorio', autor: 'José Zorrilla', tapa: 'TENORIO', tela: [40, 42, 58], adorno: 'espada' },
  { titulo: 'Cañas y barro', autor: 'Vicente Blasco Ibáñez', tapa: 'CAÑAS', tela: [64, 110, 104], adorno: 'barca' },
  { titulo: 'La vida es sueño', autor: 'Pedro Calderón de la Barca', tapa: 'SUEÑO', tela: [88, 58, 110], adorno: 'estrella' },
  { titulo: 'La isla del tesoro', autor: 'Robert Louis Stevenson', tapa: 'TESORO', tela: [146, 56, 40], adorno: 'llave' },
  { titulo: 'Moby Dick', autor: 'Herman Melville', tapa: 'MOBY DICK', tela: [40, 78, 112], adorno: 'ola' },
  { titulo: 'Orgullo y prejuicio', autor: 'Jane Austen', tapa: 'ORGULLO', tela: [120, 138, 156], adorno: 'pluma' },
  { titulo: 'Robinson Crusoe', autor: 'Daniel Defoe', tapa: 'ROBINSON', tela: [118, 82, 52], adorno: 'sol' },
  { titulo: 'Cumbres borrascosas', autor: 'Emily Brontë', tapa: 'CUMBRES', tela: [72, 78, 86], adorno: 'luna' },
  { titulo: 'Alicia en el país de las maravillas', autor: 'Lewis Carroll', tapa: 'ALICIA', tela: [62, 96, 150], adorno: 'taza' },
  { titulo: 'La Odisea', autor: 'Homero', tapa: 'ODISEA', tela: [158, 92, 62], adorno: 'ancla' },
];

/** Quién trae el libro y lo que cuenta de él (frases cerradas). El índice es el que guarda el servidor. */
export const CLIENTES_TALLER = [
  { quien: 'Una vecina del tercero', dice: 'Era de mi abuela. Pasó un invierno junto a una gotera y ya ves cómo está.' },
  { quien: 'El patrón del Estrella del Norte', dice: 'Me ha acompañado en cada marea. Huele a salitre, pero es mi libro.' },
  { quien: 'Una estudiante de Bellas Artes', dice: 'Lo encontré en el rastro por dos duros. Quiero que vuelva a parecer lo que fue.' },
  { quien: 'El cartero del muelle', dice: 'Iba en mi cartera, debajo de todas las cartas. Un día de temporal se mojó.' },
  { quien: 'Una señora con sombrero de lluvia', dice: 'Me lo regaló mi primer novio en la feria del libro. No se lo cuentes a mi marido.' },
  { quien: 'El relojero de la calle Ancha', dice: 'Me lo leía mi padre en voz alta. Ahora quiero leérselo yo a mi nieta.' },
  { quien: 'Una maestra jubilada', dice: 'Con él aprendieron a leer treinta cursos. Se ha ganado un buen arreglo.' },
  { quien: 'El del puesto de castañas', dice: 'Estuvo años en la trastienda del puesto, entre sacos. Se merece un descanso.' },
  { quien: 'Una viajera con mochila', dice: 'Ha cruzado conmigo media Europa en trenes de noche.' },
  { quien: 'El bibliotecario del barrio', dice: 'Lo rescaté de una caja que iban a tirar. No podía dejarlo ahí.' },
  { quien: 'Una pareja recién casada', dice: 'Era de la pensión de su abuela: un huésped lo olvidó y nunca volvió a por él.' },
  { quien: 'Un niño con su abuelo', dice: 'Dice el abuelo que este libro le salvó un verano entero.' },
];

/** El primer encargo de cada cuenta, siempre el mismo, para que don Celestino lo enseñe: polvo, pliegue y oro. */
export const PRIMER_ENCARGO = { libro: 0, quien: 0, danos: ['polvo', 'arrugas', 'dorado'] };

/**
 * Cuántos daños trae un libro según el nivel del café y su semilla (la del servidor, 0 a 999.999): 2 o 3 en los niveles 3 y
 * 4, 3 o 4 en el 5 y el 6, y 4 o 5 desde el 7.
 */
export function cuantosDanos(nivel, semilla) {
  return Math.min(DANOS.length, 2 + Math.floor((Math.max(TALLER_NIVEL, nivel) - TALLER_NIVEL) / 2) + (semilla % 2));
}

/**
 * Las estrellas de un encargo según cómo quedó cada daño (`mimo`: 2, bien; 1, se podía mejorar): 3 con todos bien, 2 con al
 * menos la mitad y 1 si no. Nunca cero.
 */
export function estrellasTaller(mimo = []) {
  const n = mimo.length;
  if (!n) return 1;
  const bien = mimo.filter((m) => m === 2).length;
  if (bien === n) return 3;
  return bien * 2 >= n ? 2 : 1;
}

/** Lo que paga un encargo con esas estrellas: { granos, reputacion }. */
export function premioTaller(estrellas) {
  const [granos, reputacion] = PREMIO_TALLER[Math.min(3, Math.max(1, estrellas | 0))];
  return { granos, reputacion };
}

/** El encargo tal como llega del servidor, con su libro y su cliente (o null si no se entiende). */
export function encargoDe(e) {
  if (!e || !Number.isInteger(e.n) || !LIBROS_TALLER[e.libro] || !CLIENTES_TALLER[e.quien]) return null;
  const danos = Array.isArray(e.danos) ? e.danos.filter((d) => DANOS.includes(d)) : [];
  if (!danos.length) return null;
  return { n: e.n, libro: e.libro, quien: e.quien, danos, llega: e.llega ?? null, primero: e.n === 1, ...LIBROS_TALLER[e.libro], cliente: CLIENTES_TALLER[e.quien] };
}

/** Lo que dice don Celestino la primera vez (frases cerradas), antes del primer encargo. */
export const CELESTINO_PRIMERA = [
  'Pasa, pasa. Soy Celestino: cuarenta años encuadernando en este barrio. Ahora el banco es tuyo; yo miro y, si acaso, te digo.',
  'Cada daño tiene su herramienta. Despacio, que esto no es la barra: aquí no espera nadie.',
];
/** Al entrar sin encargo pendiente. */
export const CELESTINO_SIN = 'Por hoy no hay más encargos. Mañana alguien traerá otro libro; ya verás.';
/** Al terminar, según las estrellas. */
export const CELESTINO_FIN = {
  1: '«Ya está mejor que como llegó. Con la práctica, las manos aprenden solas.»',
  2: '«Buen trabajo. Su dueño va a ponerse muy contento.»',
  3: '«Así lo habría hecho yo. Mejor, quizá. No se lo digas a nadie.»',
};
