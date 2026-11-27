// Libo, el gato guía (docs/qa/libo.md). Reglas puras, sin React: su modo y los capítulos que ya has visto. Se guardan en
// los ajustes de la biblioteca (`settings.libo`), así viajan con tu cuenta sin migración nueva.
// Libo no es un chat ni una IA: todo lo que dice está escrito aquí, a mano.
import { conOlmo } from '../../domain/suscripcion';

/** Cómo se porta Libo (se elige en «Tu cuenta»). */
export const MODOS = Object.freeze({
  sugiere: 'Libo me sugiere cosas',
  llamar: 'Solo cuando le llamo',
  descansa: 'Libo descansa',
});
export const MODO_INICIAL = 'sugiere';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Lo que hay guardado de Libo, siempre con forma válida (ajustes antiguos o rotos incluidos). */
export function liboDe(settings) {
  const l = settings?.libo && typeof settings.libo === 'object' ? settings.libo : {};
  const d = l.dia && typeof l.dia === 'object' ? l.dia : null;
  const callados = l.callados && typeof l.callados === 'object' && !Array.isArray(l.callados) ? l.callados : {};
  return {
    modo: Object.hasOwn(MODOS, l.modo) ? l.modo : MODO_INICIAL,
    vistos: Array.isArray(l.vistos) ? l.vistos.filter((x) => typeof x === 'string') : [],
    // Bloque 3: la sugerencia del día ({ fecha, sugerencia, asomo }) y las que ya contestaste (id → fecha), para no repetirlas
    dia: d && FECHA.test(d.fecha ?? '') ? { fecha: d.fecha, sugerencia: typeof d.sugerencia === 'string' ? d.sugerencia : null, asomo: d.asomo === true } : null,
    callados: Object.fromEntries(Object.entries(callados).filter(([k, v]) => typeof k === 'string' && typeof v === 'string' && FECHA.test(v))),
  };
}

/** ¿Se ve Libo en su esquina? Solo deja de verse si descansa. */
export const estaVisible = (settings) => liboDe(settings).modo !== 'descansa';

/** ¿Has visto ya este capítulo? */
export const haVisto = (settings, capitulo) => liboDe(settings).vistos.includes(capitulo);

/** ¿Abre Libo este capítulo por su cuenta? Solo si no lo has visto y te sugiere cosas; si no, espera a que le llames. */
export const abrePorSuCuenta = (settings, capitulo) => liboDe(settings).modo === 'sugiere' && !haVisto(settings, capitulo);

/**
 * Marca de este dispositivo: los capítulos que Libo ya abrió aquí. Si los ajustes aún no han llegado de la nube (o se
 * pierden), no los repite. Va aparte de la biblioteca, como la de la guía antigua (`bookshelf_onboarding_done`). Se guarda
 * como una lista; el valor «presentado» del bloque 1 equivale al saludo y la bienvenida.
 */
export const LIBO_KEY = 'bookshelf:libo';

function vistosAqui(storage) {
  try {
    const raw = storage?.getItem(LIBO_KEY);
    if (raw === 'presentado') return ['hola', 'bienvenida'];
    const lista = raw ? JSON.parse(raw) : [];
    return Array.isArray(lista) ? lista.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** ¿Abrió Libo ya este capítulo en este dispositivo? */
export const presentadoAqui = (capitulo = 'bienvenida', storage = globalThis.localStorage) => vistosAqui(storage).includes(capitulo);

/** Apunta en este dispositivo uno o varios capítulos como abiertos. */
export function marcarPresentadoAqui(capitulos = ['bienvenida'], storage = globalThis.localStorage) {
  const antes = vistosAqui(storage);
  const lista = [...new Set([...antes, ...[capitulos].flat()])];
  try {
    if (lista.length === antes.length && storage?.getItem(LIBO_KEY) !== 'presentado') return;
    storage?.setItem(LIBO_KEY, JSON.stringify(lista));
  } catch {
    // Sin almacenamiento: vale lo guardado en los ajustes
  }
}

/** El cambio de ajustes que marca un capítulo como visto (null si ya lo estaba). */
export function marcarVisto(settings, capitulo) {
  const l = liboDe(settings);
  return l.vistos.includes(capitulo) ? null : { libo: { ...l, vistos: [...l.vistos, capitulo] } };
}

/** El cambio de ajustes para otro modo (null si el modo no existe). */
export const cambiarModo = (settings, modo) => (Object.hasOwn(MODOS, modo) ? { libo: { ...liboDe(settings), modo } } : null);

/**
 * Capítulo 1, la bienvenida en tu piso de inicio. Cada paso señala un control de la pantalla (`ancla`, un selector); si no está a la
 * vista, el paso se salta; si es una lista, vale el primero que se vea. `texto` puede depender de si estás leyendo algo.
 */
export const BIENVENIDA = Object.freeze([
  {
    id: 'hola',
    ancla: null,
    titulo: 'Hola, soy Libo',
    texto: () => 'El gato de Libotown. Esta habitación es tu piso del edificio del puerto: aquí lees, guardas tus libros y lo decoras a tu manera. ¿Te enseño lo básico? Son cuatro cosas.',
  },
  {
    id: 'lectura',
    ancla: '.plab-controls .plab-primary',
    titulo: 'Tu lectura',
    texto: ({ leyendo }) =>
      leyendo
        ? 'Cuando leas, toca aquí y apunta por qué página vas. Así se llenan tu calendario y tu diario.'
        : 'Aquí eliges lo que vas a leer. Después, con un toque apuntas por qué página vas.',
  },
  {
    id: 'balda',
    ancla: '.plab-controls .plab-tool[aria-label="Ver la balda"], .plab-controls .plab-tool[aria-label^="Toda la biblioteca"]',
    titulo: 'Tus libros',
    texto: () => 'Tu estantería. Desde ella llegas a toda tu biblioteca y añades libros nuevos.',
  },
  {
    id: 'menu',
    ancla: '.plab-controls .plab-tool[aria-label="Menú de accesos"]',
    titulo: 'Tu rincón',
    texto: () => 'En el menú están el ordenador, con tu calendario y tu diario, Decorar, el sonido y los ajustes.',
  },
  {
    id: 'puerta',
    ancla: '.plab-bar > .px-btn',
    titulo: 'El edificio del puerto',
    texto: () => 'Por aquí bajas al edificio: tus vecinos, el café-librería del bajo y el Gran Hotel, con su limusina en la puerta.',
  },
  {
    id: 'fin',
    ancla: '.libo-rincon__gato',
    titulo: 'Aquí me quedo',
    texto: () => 'Estaré en esta esquina. Tócame cuando quieras repasar algo.',
  },
]);

/**
 * Capítulo 3, el edificio: la primera vez que llegas al portal. Señala las ventanas y los objetos de la calle, que son
 * botones de verdad (si la calle está girada y alguno no se ve, ese paso se salta).
 */
export const EDIFICIO = Object.freeze([
  {
    id: 'hola',
    ancla: null,
    titulo: 'El edificio del puerto',
    texto: () => 'Aquí está tu piso, con tus vecinos. Abajo, el café-librería; en el muelle, la limusina al Gran Hotel. ¿Te enseño dónde está cada cosa?',
  },
  {
    id: 'tu-ventana',
    ancla: '.ed-window--mine',
    titulo: 'Tu piso',
    texto: () => 'Tu ventana. Tócala para entrar en tu piso: lo decoras a tu gusto y tus vecinos lo ven tal como lo dejes.',
  },
  {
    id: 'vecinos',
    // La ventana de un vecino; si aún no hay ninguno, una puerta libre
    ancla: ['.ed-facade__flats .ed-window:not(.ed-window--mine):not(.ed-window--free):not(.ed-shop):not(.ed-limo):not(.ed-telefonillo)', '.ed-facade__flats .ed-window--free'],
    titulo: 'Tus vecinos',
    texto: () => 'Las demás ventanas son de tus vecinos: toca una para visitar su piso. Las que dicen «Libre» esperan a alguien nuevo.',
  },
  // 1.154 · El telefonillo del portal (docs/qa/amigos-vecinos.md, bloque 4)
  {
    id: 'telefonillo',
    ancla: '.ed-telefonillo',
    titulo: 'El telefonillo',
    texto: () => 'Junto al portal, el telefonillo: llamas a tus vecinos y das la llave de tu edificio a tus amigos.',
  },
  {
    id: 'cafe',
    ancla: '.ed-shop',
    titulo: 'El café-librería',
    texto: () => `El bajo es tuyo: un café-librería que abres, decoras y haces crecer con ${conOlmo() ? 'Olmo, el búho librero' : 'Pilar, la camarera'}. Allí sirves cafés y recomiendas libros.`,
  },
  {
    id: 'limusina',
    ancla: '.ed-limo',
    titulo: 'Al Gran Hotel',
    texto: () => 'La limusina te lleva al Gran Hotel: el almacén de muebles, la sala de lectura y el casino, entre otras plantas.',
  },
  {
    id: 'buzon',
    ancla: '.ed-mailbox',
    titulo: 'Tu buzón',
    texto: () => 'Aquí llegan los regalos y las firmas de tus vecinos, y los avisos del casino. Si asoma una carta, hay algo nuevo.',
  },
  {
    id: 'volver',
    ancla: '.ed-bar__close',
    titulo: 'De vuelta a casa',
    texto: () => 'Con la cruz vuelves a tu habitación. Y si arrastras la calle, miras alrededor.',
  },
]);

/** Capítulo 4, tu piso del edificio (la vista isométrica): la primera vez que entras. */
export const TU_PISO = Object.freeze([
  {
    id: 'hola',
    ancla: null,
    titulo: 'Tu piso del edificio',
    texto: () => 'Así lo ven tus vecinos cuando te visitan. Tu personaje va andando a donde toques: al suelo, a un sillón, a la cama…',
  },
  {
    id: 'decorar',
    ancla: '.ep-corner--right',
    titulo: 'Decorar',
    texto: () => 'Para colocar, girar y quitar muebles. Los tuyos salen en una balda de madera: arrástralos a la habitación.',
  },
  {
    id: 'armario',
    ancla: '.ep-corner--left3',
    titulo: 'El armario',
    texto: () => 'La ropa y los colores de tu personaje. Con las misiones diarias del piso ganas prendas nuevas.',
  },
  {
    id: 'luz',
    ancla: '.ep-corner--left',
    titulo: 'La luz',
    texto: () => 'Cambia la luz de la habitación, para verla a la hora que más te guste.',
  },
  {
    id: 'vista',
    ancla: '.ed-bar__view',
    titulo: 'Otra vista',
    texto: () => 'Si prefieres verlo como una ficha, toca aquí. Lo que elijas se recuerda en este dispositivo.',
  },
]);

/**
 * Capítulo 5, el café-librería: Libo lo presenta y se aparta, porque allí manda Pilar (ella explica la barra, los clientes y
 * los libros). Nunca se queda encima de la barra: durante el servicio, Libo no está.
 */
export const CAFE = Object.freeze([
  {
    id: 'hola',
    ancla: null,
    titulo: 'El café-librería del bajo',
    texto: () => 'Este local es tuyo. Preparas cafés en la barra, recomiendas libros de tu balda y, poco a poco, el café crece contigo.',
  },
  {
    id: 'nivel',
    ancla: '.cf3-placa',
    titulo: 'Tu nivel',
    texto: () => 'Cada cliente bien atendido da reputación. Al llenar esta barra, el café sube de nivel y se abren cosas nuevas.',
  },
  {
    id: 'granos',
    ancla: '.cf3-monedero',
    titulo: 'Los granos',
    texto: () => 'La moneda del café: se ganan atendiendo y solo sirven aquí, para libros y muebles del café.',
  },
  {
    id: 'pilar',
    ancla: '.cf3-franja',
    // 1.150: con la suscripción (o en vista previa), quien atiende es Olmo, el búho librero
    get titulo() {
      return conOlmo() ? 'Olmo' : 'Pilar';
    },
    texto: () =>
      conOlmo()
        ? 'Olmo es el búho librero y quien más sabe de esto. A partir de aquí te lo explica él, paso a paso y sin prisa.'
        : 'Pilar es la camarera y quien más sabe de esto. A partir de aquí te lo explica ella, paso a paso.',
  },
  {
    id: 'fin',
    ancla: '.libo-rincon__gato',
    titulo: 'Me aparto',
    texto: () => 'Te espero en esta esquina, sin estorbar. Mientras atiendes, me quito de en medio.',
  },
]);

/** Capítulo 6, el Gran Hotel: la primera vez que llegas en la limusina. */
export const HOTEL = Object.freeze([
  {
    id: 'hola',
    ancla: null,
    titulo: 'El Gran Hotel del Puerto',
    texto: () => 'Cada planta es un sitio distinto. Toca una en la fachada y vas andando hasta allí.',
  },
  {
    id: 'directorio',
    ancla: '.ed-bar__dir',
    titulo: 'El directorio',
    texto: () => 'La lista de las plantas. Ya están abiertos el vestíbulo, la sala de lectura del café-biblioteca, el almacén de muebles y el casino del sótano.',
  },
  {
    id: 'cartela',
    ancla: '.gh-plaque',
    titulo: 'La cartela',
    texto: () => 'Si tocas una planta que aún no ha abierto, aquí abajo te cuenta qué habrá en ella.',
  },
  {
    id: 'volver',
    ancla: '.ed-bar__back',
    titulo: 'Al puerto',
    texto: () => 'Por aquí vuelves al edificio en la limusina.',
  },
]);

/** Capítulo 7, la comunidad: solo si la tienes activada, la primera vez que abres su cuaderno. */
export const COMUNIDAD = Object.freeze([
  {
    id: 'hola',
    ancla: null,
    titulo: 'La comunidad',
    texto: () => 'Aquí te encuentras con otros lectores de Libotown. Te enseño las hojas del cuaderno.',
  },
  {
    id: 'lectores',
    ancla: '.social-hub__tabs [role="tab"]:nth-child(1)',
    titulo: 'Lectores',
    texto: () => 'A quién sigues y quién te sigue. Con «Visitar» entras en el piso de un lector y miras su biblioteca y su tablón.',
  },
  {
    id: 'salon',
    ancla: '.social-hub__tabs [role="tab"]:nth-child(2)',
    titulo: 'El salón',
    texto: () => 'Los sillones del salón: quién está leyendo ahora mismo, y la radio para leer con música.',
  },
  {
    id: 'clubes',
    ancla: '.social-hub__tabs [role="tab"]:nth-child(3)',
    titulo: 'Los clubes',
    texto: () => 'Clubes de lectura: un libro a la vez, comentado con más gente.',
  },
  {
    id: 'tuyo',
    ancla: '.social-own__btn',
    titulo: 'Lo tuyo',
    texto: () => 'En tu avatar están tu perfil lector y tu rincón.',
  },
]);

/**
 * 1.154 · Capítulo 8, el telefonillo del portal (docs/qa/amigos-vecinos.md, bloque 4): la primera vez que lo abres. Solo la
 * vista de inicio, con sus botones de verdad.
 */
export const TELEFONILLO = Object.freeze([
  {
    id: 'hola',
    ancla: null,
    titulo: 'El telefonillo',
    texto: () => 'Tu edificio es solo para tus amigos: nadie entra sin llave. Desde aquí llamas a tus vecinos y das llaves. ¿Te lo enseño?',
  },
  {
    id: 'botones',
    ancla: '.ed-tel__botones',
    titulo: 'Un botón por puerta',
    texto: () => 'El tuyo, en verde. Con el de un vecino llamas y entras en su piso; los apagados son puertas libres.',
  },
  {
    id: 'dar',
    ancla: '.ed-tel__acciones .ed-tel__accion--llave',
    titulo: 'Dar una llave',
    texto: () => 'Haces una llave para quien quieras de vecino: abre una sola vez y dura 7 días. Quien la usa se muda con su piso y sus muebles.',
  },
  {
    id: 'usar',
    ancla: '.ed-tel__acciones .ed-tel__accion:not(.ed-tel__accion--llave):not(.ed-tel__accion--suave)',
    titulo: 'Tengo una llave',
    texto: () => 'Si un amigo te da la suya, escribe aquí el código y te dice de quién es antes de mudarte.',
  },
  {
    id: 'crece',
    ancla: '.ed-tel__sub',
    titulo: 'Un edificio que crece',
    texto: () => 'Empieza con 3 plantas y, cuando se llenan, gana otra, hasta 5: diez amigos bajo el mismo tejado.',
  },
]);

/**
 * 1.154 · Capítulo 9, la agenda de Amigos del ordenador (bloque 4): la primera vez que la abres con la comunidad. Señala sus
 * cuatro pestañas.
 */
export const AMIGOS = Object.freeze([
  {
    id: 'hola',
    ancla: null,
    titulo: 'Tu agenda de amigos',
    texto: () => 'Amigos son quienes os seguís los dos. Aquí ves qué leen, os recomendáis libros y leéis a la vez. ¿Te enseño las pestañas?',
  },
  {
    id: 'amigos',
    ancla: '.am-pestana--amigos',
    titulo: 'Tus amigos',
    texto: () => 'Una ficha por amigo: qué lee y qué terminó, si lo comparte. Desde ella visitas su piso, le recomiendas un libro o le das tu llave.',
  },
  {
    id: 'buscar',
    ancla: '.am-pestana--buscar',
    titulo: 'Buscar',
    texto: () => 'Busca por alias o con un código de amigo, y pásale el tuyo a quien quieras. Aquí ves también quién te sigue.',
  },
  {
    id: 'buzon',
    ancla: '.am-pestana--buzon',
    titulo: 'El buzón',
    texto: () => 'Lo que te mandan: libros recomendados, propuestas para leer a la vez y llaves de otros edificios.',
  },
  {
    id: 'ajustes',
    ancla: '.am-pestana--ajustes',
    titulo: 'Lo que ven',
    texto: () => 'Tú eliges qué ven tus amigos de tu lectura. Nunca tus notas, tus reseñas privadas ni tus páginas por día.',
  },
]);

/** Cada capítulo con sus pasos y lo que dice el botón para repasarlo. */
export const CAPITULOS = Object.freeze({
  bienvenida: { pasos: BIENVENIDA, repaso: 'Repasar la bienvenida' },
  edificio: { pasos: EDIFICIO, repaso: 'Repasar el edificio' },
  'tu-piso': { pasos: TU_PISO, repaso: 'Repasar tu piso' },
  cafe: { pasos: CAFE, repaso: 'Repasar el café' },
  hotel: { pasos: HOTEL, repaso: 'Repasar el hotel' },
  comunidad: { pasos: COMUNIDAD, repaso: 'Repasar la comunidad' },
  telefonillo: { pasos: TELEFONILLO, repaso: 'Repasar el telefonillo' },
  amigos: { pasos: AMIGOS, repaso: 'Repasar la agenda' },
});

/** Lo que dice Libo al tocarle, según dónde estés (sin cuenta, con tu piso…). Frases cerradas. */
export const SALUDOS = Object.freeze({
  piso: 'Miau. ¿Repasamos tu habitación?',
  edificio: 'Miau. ¿Te recuerdo dónde está cada cosa del edificio?',
  'tu-piso': 'Miau. Tu piso, tal como lo ven tus vecinos. ¿Lo repasamos?',
  get cafe() {
    return conOlmo() ? 'Aquí manda Olmo: él te explica la barra y los libros. ¿Repasamos lo básico del café?' : 'Aquí manda Pilar: ella te explica la barra y los libros. ¿Repasamos lo básico del café?';
  },
  hotel: 'Miau. ¿Te recuerdo qué hay en el hotel?',
  comunidad: 'Miau. ¿Repasamos el cuaderno de la comunidad?',
  telefonillo: 'Miau. ¿Te recuerdo para qué sirve cada botón del telefonillo?',
  amigos: 'Miau. ¿Repasamos tu agenda de amigos?',
  'comunidad-off': 'Hola, soy Libo. Cuando actives la comunidad, te enseño este cuaderno. Tu biblioteca funciona igual sin ella.',
  'signed-out': 'Hola, soy Libo, el gato de Libotown. Cuando entres con tu cuenta, te enseño tu piso. Mientras, tu biblioteca funciona en este dispositivo.',
  'no-member': 'Hola, soy Libo. Tu piso está en el edificio del puerto, que es para quien activa la comunidad. Tu biblioteca funciona igual sin ella.',
  otro: 'Hola, soy Libo, el gato de Libotown. Tu biblioteca sigue aquí.',
});
