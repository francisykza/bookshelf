// La vitrina de premios del casino (1.111, SPEC §111; plan en docs/qa/casino-3d.md, bloque e y §4): tres armarios de
// cristal contra la pared derecha de la sala que enseñan TODO lo que se gana en el casino. Lo ganado, iluminado en 3D en su
// balda; lo que falta, tapado con un paño de terciopelo y, al tocarlo, cómo se gana. Las fichas y los garbanzos, como pilas
// que crecen. Y doce copas de hitos, cuatro por juego, solo decorativas. Los amigos (os seguís los dos) la ven, sin tocar.
// Lo que tiene cada cuenta y qué hitos ha logrado lo dice el servidor (supabase/migrations/20261203120000_casino_vitrina.sql);
// los ids de los hitos son los mismos que los de `piso_casino_vitrina_hitos` (una prueba lo comprueba).
import { CAJA, LATA } from './veintiuna';
import { RULETA, premioNombre } from './ruleta';
import { premioChisteras } from './chisteras';

const caja = (id) => CAJA.find((a) => a.id === id);
const lata = (id) => LATA.find((a) => a.id === id);
const ruleta = (id) => RULETA.find((c) => c.id === id);
const deCaja = (id) => ({ id, tipo: caja(id).tipo, nombre: caja(id).nombre, como: `Se cambia por ${caja(id).precio} fichas en la caja.` });
const deLata = (id) => ({ id, tipo: 'mueble', nombre: lata(id).nombre, como: `Se cambia por ${lata(id).precio} garbanzos en la lata de la caja.` });
const deChisteras = (id) => ({ id, tipo: premioChisteras(id).tipo, nombre: premioChisteras(id).nombre, como: `Se cambia por ${premioChisteras(id).sellos} sellos de las chisteras (un sello por partida perfecta).` });
const deRuleta = (id) => ({ id, tipo: ruleta(id).tipo, nombre: premioNombre(ruleta(id)), como: `Puede tocar en la ruleta de la semana (${ruleta(id).peso} %).` });

/** Los hitos: cuatro por juego, en el orden de su balda. Solo decorativos (copas, placas y chisteras de oro). */
export const HITOS = [
  { id: '21-primera', juego: '21', nombre: 'Primera mano ganada', como: 'Gana una mano en «Las 21 páginas».' },
  { id: '21-veintiuna', juego: '21', nombre: 'Veintiuna servida', como: 'Saca una veintiuna servida (as y figura en las dos primeras).' },
  { id: '21-diez', juego: '21', nombre: 'Diez manos ganadas', como: 'Gana diez manos en «Las 21 páginas».' },
  { id: '21-cincuenta', juego: '21', nombre: 'Cincuenta manos', como: 'Juega cincuenta manos, ganes o no.' },
  { id: 'ruleta-primera', juego: 'ruleta', nombre: 'Primer giro', como: 'Gira la ruleta por primera vez.' },
  { id: 'ruleta-cuatro', juego: 'ruleta', nombre: 'Cuatro semanas de ruleta', como: 'Gira la ruleta cuatro semanas.' },
  { id: 'ruleta-premio', juego: 'ruleta', nombre: 'Un premio de la rueda', como: 'Llévate de la ruleta un mueble, la prenda o el mapache.' },
  { id: 'ruleta-dorada', juego: 'ruleta', nombre: 'La casilla dorada', como: 'Que la ruleta se pare en la casilla dorada.' },
  { id: 'chisteras-primera', juego: 'chisteras', nombre: 'Primera partida', como: 'Juega una partida entera de «Las tres chisteras».' },
  { id: 'chisteras-perfecta', juego: 'chisteras', nombre: 'Partida perfecta', como: 'Acierta las tres rondas de las chisteras.' },
  { id: 'chisteras-cinco', juego: 'chisteras', nombre: 'Cinco perfectas', como: 'Haz cinco partidas perfectas.' },
  { id: 'chisteras-diez', juego: 'chisteras', nombre: 'Diez partidas', como: 'Juega diez partidas de las chisteras.' },
];

/**
 * Lo que hay en cada armario (de izquierda a derecha según se mira la pared: el de la caja, el de la ruleta y la lata, y el
 * de las chisteras y las copas) y en cada balda (0 la de abajo, 2 la de arriba), de izquierda a derecha. `tipo`: 'prenda' (en un maniquí),
 * 'mueble' (su modelo), 'companero', 'acabado', 'pila' (fichas o garbanzos) o 'copa'.
 */
export const ARMARIOS = [
  {
    nombre: 'La caja',
    baldas: [
      [deCaja('neon-veintiuna'), deCaja('mesa-tapete'), deCaja('alfombra-rombos'), deCaja('gramola')],
      [deCaja('jersey:15'), deCaja('complemento:fedora'), deCaja('complemento:reloj-bolsillo'), deCaja('jersey:16')],
      [deCaja('complemento:visera'), deCaja('pantalon:9'), deCaja('conejo-chistera')],
    ],
  },
  {
    nombre: 'La ruleta y la lata',
    baldas: [
      [deLata('taburete-barra'), { id: 'fichas', tipo: 'pila', nombre: 'Tus fichas', como: 'Se ganan en las tres mesas y en la ruleta.' }, { id: 'garbanzos', tipo: 'pila', nombre: 'Tus garbanzos', como: 'Cien al empezar y veinte más cada día que juegas.' }],
      [deRuleta('lampara-flecos'), deRuleta('ruleta-sobremesa'), deLata('tarro-garbanzos'), deLata('baraja-naipes')],
      [deRuleta('jersey:22'), deRuleta('reloj-deco'), deRuleta('mapache-crupier')],
    ],
  },
  {
    // 1.112: abajo, los premios de las chisteras; encima, las copas (las de las chisteras y la ruleta juntas)
    nombre: 'Chisteras y copas',
    baldas: [
      [deChisteras('complemento:chistera-mago'), deChisteras('complemento:varita'), deChisteras('baul-mago'), deChisteras('acabado:polvo-estrellas')],
      HITOS.filter((h) => h.juego === 'chisteras' || h.juego === 'ruleta').map((h) => ({ ...h, tipo: 'copa' })),
      HITOS.filter((h) => h.juego === '21').map((h) => ({ ...h, tipo: 'copa' })),
    ],
  },
];

/** Todo lo de la vitrina, en una lista. */
export const PREMIOS_VITRINA = ARMARIOS.flatMap((a) => a.baldas.flat());
/** Los premios que se tienen o no (sin las pilas ni las copas): los ids que el servidor mira en tu inventario y tu armario. */
export const PREMIOS_QUE_SE_TIENEN = PREMIOS_VITRINA.filter((p) => !['pila', 'copa'].includes(p.tipo)).map((p) => p.id);
export const premioVitrina = (id) => PREMIOS_VITRINA.find((p) => p.id === id) ?? null;
