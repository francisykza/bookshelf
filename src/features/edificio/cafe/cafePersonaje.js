// Quién atiende el café (1.150): Pilar o, con la suscripción de Libotown, Olmo, el búho librero (decisión de Francisco del
// 26-11-2026). Las cuentas de `cafe_probadores` lo ven en vista previa (`conOlmo`, src/domain/suscripcion.js). Aquí está todo
// lo que cambia entre los dos: el nombre, cómo se habla de él o de ella, su retrato, su sonido y su voz en los momentos de
// siempre. Lo que hace es lo mismo: Olmo prepara, hornea, coloca y vende igual que Pilar.
//
// La voz de Olmo: sabio y tranquilo, habla despacio, huele los libros, mide las cosas en páginas y suspira un «hu-hum» cuando
// algo le gusta. Nunca tiene prisa y nunca mete prisa.
import { conOlmo } from '../../../domain/suscripcion';
import { PILAR } from './cafeIconos';
import { retratoOlmo } from './olmo3d';

const retratos = new Map();
/** El retrato de Olmo en una pose ('normal', 'contento', 'apunta' o 'lee'), sacado de su modelo 3D (una vez por pose). */
export function retratoDeOlmo(pose = 'normal') {
  if (!retratos.has(pose)) retratos.set(pose, retratoOlmo(pose));
  return retratos.get(pose);
}

const PILAR_P = {
  id: 'pilar',
  nombre: 'Pilar',
  /** «hablar con ella», «te lo explica ella» */
  pron: 'ella',
  /** «Pilar, la camarera» */
  quienEs: 'la camarera',
  sonido: 'pilar',
  retrato: () => PILAR,
  dice: {
    bordo: 'Deja, que esto lo bordo yo.',
    ofrece: 'Esto ya lo bordas; si quieres, te lo preparo yo.',
    ofreceProxima: 'Esto ya lo bordas. La próxima vez, si quieres, te lo preparo yo.',
    huele: (nombre) => `¡Qué bien huele hoy «${nombre}»! Si quieres cambiar algo de sitio, toca Decorar.`,
    pronto: 'Pronto vendrán clientes a pedirte libros. Yo pongo los cafés; tú recomiendas.',
    otraJornada: 'Ya está todo el mundo atendido. Como estás probando el café, abro otra jornada cuando quieras.',
    leeUnRato: 'Hoy ya está todo el mundo atendido. Si lees un rato, vendrá algún habitual.',
    atendidos: 'Hoy ya está todo el mundo atendido. El local es tuyo para decorar.',
    esperando: (frase) => frase,
  },
  frases: null,
};

/** Lo que dice Olmo si le tocas en la barra, una cada vez (frases propias). */
export const FRASES_OLMO = [
  'Este libro huele a lluvia… te va a gustar.',
  'Hu-hum. Un café se enfría; un buen libro, nunca.',
  'Los libros esperan sin prisa. Por eso me caen tan bien.',
  'Si un cliente no sabe qué leer, pregúntale qué echa de menos.',
  'La canela, en su justa medida. Como los adjetivos.',
  'Llevo el lápiz siempre en la bufanda: hay frases que piden subrayado.',
  'Mis gafas no son para leer. Son para leer despacio.',
  '¿Oyes la lluvia en el escaparate? No hay mejor punto de lectura.',
  'Un libro prestado siempre vuelve con un poco de quien lo leyó.',
  'Leo de noche, claro. Las mejores páginas se leen cuando el muelle duerme.',
  'La bufanda me la tejió una lectora del muelle. Tardó tres inviernos: leía entre punto y punto.',
  'Hu-hum. Hoy me apetece un clásico. Mañana, quién sabe.',
];

const OLMO_P = {
  id: 'olmo',
  nombre: 'Olmo',
  pron: 'él',
  quienEs: 'el búho librero',
  sonido: 'olmo',
  retrato: (pose) => retratoDeOlmo(pose),
  dice: {
    bordo: 'Deja, deja: esto lo tengo bajo el ala.',
    ofrece: 'Esto ya lo dominas. Si quieres, lo preparo yo y tú charlas con el cliente.',
    ofreceProxima: 'Ya lo dominas. La próxima vez, si quieres, me encargo yo.',
    huele: (nombre) => `Hu-hum… hoy «${nombre}» huele a café y a papel viejo, mi olor favorito. Si quieres cambiar algo de sitio, toca Decorar.`,
    pronto: 'Pronto vendrán clientes a pedirte libros. Yo pongo los cafés; tú, las historias.',
    otraJornada: 'Todo el mundo atendido. Como estás probando el café, abro otra jornada cuando quieras: las páginas no se acaban.',
    leeUnRato: 'Hoy ya está todo el mundo atendido. Si lees un rato, vendrá algún habitual: les atrae el rumor de las páginas.',
    atendidos: 'Hoy ya está todo el mundo atendido. Este silencio de después es como cerrar un buen libro. El local es tuyo para decorar.',
    esperando: (frase) => `Hu-hum. ${frase}`,
  },
  frases: FRASES_OLMO,
};

/**
 * Un texto de los datos del café que nombra a Pilar (el cuaderno, las mejoras del obrador, los avisos…), dicho de quien atiende
 * ahora: con Olmo, su nombre y en masculino («la coloca ella sola» → «él solo»). Sin Olmo, tal cual.
 */
export function conQuien(texto) {
  if (!conOlmo() || typeof texto !== 'string') return texto;
  return texto.replace(/\bPilar\b/g, 'Olmo').replace(/\bella sola\b/g, 'él solo');
}

/** Quién atiende ahora el café: Olmo (con la suscripción o en vista previa) o Pilar. */
export const anfitrion = () => (conOlmo() ? OLMO_P : PILAR_P);
