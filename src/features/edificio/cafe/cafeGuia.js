// La guía del café en sus menús y botones (1.150, bloque 2; Francisco, 26-11-2026: «que en la cafetería también tenga una
// especie de guía como Libo en los menús y botones»). La da quien atiende: Olmo con la suscripción (o en vista previa) y Pilar
// sin ella, cada uno con su voz y su retrato. Libo presenta el café y se aparta («a partir de aquí te lo explica ella/él»); esto
// es lo que viene después.
//
// Reglas puras, sin React. Cada capítulo es un sitio del café (el local, Decorar, la balda de libros, el ranking, el cuaderno);
// cada paso señala un control (`ancla`, un selector dentro del café; una lista vale el primero que se vea) y se marca como visto
// por separado (`capitulo:paso`), así que cuando el café crece y aparece un botón nuevo, la guía enseña solo ese. Lo visto va en
// los ajustes de la biblioteca (`settings.guiaCafe`), como lo de Libo: viaja con tu cuenta sin migración.
// Todo lo que dicen está escrito aquí, a mano.

/** Cómo se dice cada paso: `{ olmo, pilar }`; la pose del retrato de Olmo (`retratoOlmo`). */
const P = (id, ancla, titulo, olmo, pilar, pose = 'apunta') => ({ id, ancla, titulo, texto: { olmo, pilar }, pose });

/** El local, con el café abierto: los botones de la franja y de arriba, y los sitios que se tocan en 3D. */
const LOCAL = [
  P(
    'hola',
    null,
    'Los botones de la casa',
    'Hu-hum. ¿Te enseño los botones de la casa? Como un índice: uno a uno y sin prisa.',
    '¿Te enseño dónde está cada cosa? Al principio despista; a mí también me pasó.',
    'contento',
  ),
  P(
    'retrato',
    '[data-guia="retrato"]',
    'Aquí hablo yo',
    'Te cuento lo que pasa en el café. Si algún día te pierdes, toca mi retrato y repasamos lo que haga falta.',
    'Aquí te hablo yo. Si te pierdes, toca mi retrato y te lo vuelvo a enseñar.',
    'normal',
  ),
  P(
    'atender',
    '[data-guia="atender"]',
    'Atender',
    'Cuando hay clientes esperando: lees su comanda, preparas su taza y le recomiendas un libro. Lo más bonito del oficio.',
    'Cuando hay clientes esperando: lees lo que piden, preparas la taza y les recomiendas un libro.',
  ),
  P('hablar', '[data-guia="hablar"]', 'Charlar', 'Si no hay nadie esperando, ven a charlar. Tengo una frase para cada página del día.', 'Si no hay nadie esperando, ven a charlar un rato conmigo.'),
  P(
    'decorar',
    '[data-guia="decorar"]',
    'Decorar',
    'Mueves, giras y compras muebles. Un café se lee mejor con buena luz y un sillón cómodo.',
    'Mueves, giras y compras muebles. Ponlo a tu gusto, que el local es tuyo.',
  ),
  P(
    'libros',
    '.cf3-libros-btn',
    'Tus libros',
    'Los que llegan en cajas y los que pones en la balda para recomendar. Una balda bien surtida es media recomendación.',
    'Los libros del café: los que llegan en cajas y los que pones en la balda para recomendar.',
    'lee',
  ),
  P(
    'ranking',
    '.cf3-ranking-btn',
    'Los cafés del barrio',
    'Cómo le va a cada café del puerto y a cuál puedes ir de visita. Asomarse a otros cafés también inspira.',
    'Cómo le va a cada café del barrio y a cuál puedes ir de visita.',
  ),
  P(
    'cuaderno',
    '.cf3-cuaderno-btn',
    'Mi cuaderno',
    'Tareas que puedo hacer yo por ti, a cambio de granos. Tengo buena letra y mejor memoria.',
    'Tareas que puedo hacer yo por ti, a cambio de granos.',
    'lee',
  ),
  P(
    'horno',
    '.cf3-horno-btn',
    'El horno',
    'Cuando algo se hornea, asoma aquí. Si suena la campanilla, ya está listo: tócalo y vamos a sacarlo.',
    'Cuando algo se hornea, asoma aquí. Con la campanilla, ya está listo: tócalo y vamos a sacarlo.',
  ),
  P('subir', '.cf3-subir-btn', 'Volver arriba', 'Desde la bodega, esto te sube al café. Cuidado con el tercer escalón.', 'Desde la bodega, esto te sube al café.'),
  P(
    'escaparate',
    '.cf3-tag[data-sitio="escaparate"]:not([data-off="true"])',
    'El escaparate',
    'Tres de tus leídos, a la vista de todo el muelle. Elige los que más te hayan hecho pensar.',
    'Tres de tus leídos, a la vista de la calle. Elige los que más te hayan gustado.',
  ),
  P(
    'trampilla',
    '.cf3-tag[data-sitio="trampilla"]:not([data-off="true"])',
    'La bodega',
    'La trampilla baja a la bodega: más sitio para mesas y lectores. Huele a madera y a libros antiguos.',
    'La trampilla baja a la bodega: más sitio para mesas y lectores.',
  ),
  P(
    'tostador',
    '.cf3-tag[data-sitio="tostador"]:not([data-off="true"])',
    'El tostador',
    'Cada mañana, un saco del día para el tueste de la casa. El olor llega hasta la última página.',
    'Cada mañana, un saco del día para el tueste de la casa.',
  ),
  P(
    'obrador',
    '.cf3-tag[data-sitio="obrador"]:not([data-off="true"])',
    'El obrador',
    'Masas, horno y lo que se vende en la vitrina. Lo que se hornea despacio se disfruta despacio.',
    'Masas, horno y lo que se vende en la vitrina.',
  ),
  P(
    'taller',
    '.cf3-tag[data-sitio="taller"]:not([data-off="true"])',
    'El taller',
    'El taller de don Celestino: libros encuadernados por encargo. Si le preguntas, te cuenta historias de cada tapa.',
    'El taller de don Celestino: libros encuadernados por encargo.',
  ),
  P('fin', null, 'Y eso es todo', 'Por ahora. Cuando se abra algo nuevo en el café, te lo enseño yo. Hu-hum.', 'Por ahora. Cuando se abra algo nuevo, te lo enseño.', 'contento'),
];

/** Decorar: la primera vez que entras. */
const DECORAR = [
  P(
    'mover',
    '.cf3-balda__titulo',
    'Mover un mueble',
    'Toca un mueble del local para cogerlo; luego, una casilla libre para dejarlo. Sin prisa: los muebles no se quejan.',
    'Toca un mueble del local para cogerlo y luego una casilla libre para dejarlo.',
  ),
  P(
    'pestanas',
    '.cf3-balda__pestanas',
    'De dónde sacarlos',
    'Lo que ya es del café, lo que te traes de casa y la tienda, que paga en granos.',
    'Lo que ya es del café, lo que te traes de casa y la tienda, que se paga en granos.',
  ),
  P('plantas', '.cf3-plantas', 'Las dos plantas', 'Aquí eliges si decoras el café o la bodega.', 'Aquí eliges si decoras el café o la bodega.'),
  P(
    'listo',
    '[data-guia="listo"]',
    'Guardar',
    '«Listo» lo deja todo como está; «Cancelar», como estaba. Hu-hum, como un marcapáginas.',
    '«Listo» lo guarda tal como está; «Cancelar» lo deja como estaba.',
    'contento',
  ),
];

/** Los menús de arriba, la primera vez que se abren: un paso cada uno. */
const LIBROS = [
  P(
    'balda',
    '.cf3-libros',
    'La balda de libros',
    'Lo que llega en las cajas lo subes a la balda; lo que está en la balda se recomienda y se vende. Ordénalo a tu manera.',
    'Lo que llega en las cajas lo subes a la balda; lo que está en la balda se recomienda y se vende.',
    'lee',
  ),
];
const RANKING = [
  P(
    'barrio',
    '.cf3-ranking',
    'Los cafés del barrio',
    'Aquí ves cómo le va a cada café y puedes ir de visita. Mirar no cuesta nada; aprender, tampoco.',
    'Aquí ves cómo le va a cada café y puedes ir de visita.',
  ),
];
const CUADERNO = [
  P(
    'tareas',
    '.cf3-cuaderno',
    'Mi cuaderno',
    'Cada tarea la hago yo por ti a cambio de granos, y cada grado la hago mejor. Lo apunto todo, con lápiz.',
    'Cada tarea la hago yo por ti a cambio de granos, y cada grado la hago mejor.',
    'lee',
  ),
];

export const CAPITULOS_CAFE = Object.freeze({ local: LOCAL, decorar: DECORAR, libros: LIBROS, ranking: RANKING, cuaderno: CUADERNO });

/** Los pasos que van de saludo y despedida (no cuentan como «algo nuevo» y solo salen con más pasos). */
const MARCOS = new Set(['hola', 'fin']);
const clave = (capitulo, paso) => `${capitulo}:${paso}`;

/** Lo que hay guardado de la guía del café, siempre con forma válida. */
export function guiaCafeDe(settings) {
  const g = settings?.guiaCafe && typeof settings.guiaCafe === 'object' ? settings.guiaCafe : {};
  return { vistos: Array.isArray(g.vistos) ? g.vistos.filter((x) => typeof x === 'string') : [] };
}

/**
 * Los pasos de un capítulo que tocan ahora. `visible(ancla)`: si ese control se ve en pantalla. `todos`: el repaso (al tocar el
 * retrato), con todo lo que se ve; si no, solo lo que no has visto. El saludo y la despedida solo van si hay al menos dos pasos
 * que enseñar y, sin `todos`, solo la primera vez (luego, lo nuevo va directo, sin ceremonia).
 */
export function pasosDe(capitulo, settings, visible, { todos = false } = {}) {
  const lista = CAPITULOS_CAFE[capitulo] ?? [];
  const vistos = new Set(guiaCafeDe(settings).vistos);
  // «capitulo:*»: el capítulo entero, ya visto (lo apunta el simulador de las pruebas en este dispositivo)
  if (!todos && vistos.has(clave(capitulo, '*'))) return [];
  const cuerpo = lista.filter((p) => !MARCOS.has(p.id) && p.ancla && visible(p.ancla) && (todos || !vistos.has(clave(capitulo, p.id))));
  if (!cuerpo.length) return [];
  const primeraVez = !vistos.has(clave(capitulo, 'hola'));
  const marcos = cuerpo.length >= 2 && (todos || primeraVez);
  const hola = lista.find((p) => p.id === 'hola');
  const fin = lista.find((p) => p.id === 'fin');
  return [...(marcos && hola ? [hola] : []), ...cuerpo, ...(marcos && fin ? [fin] : [])];
}

/** El cambio de ajustes que marca estos pasos como vistos (null si no cambia nada). */
export function marcarVistos(settings, capitulo, pasos) {
  const antes = guiaCafeDe(settings).vistos;
  const nuevos = pasos.map((p) => clave(capitulo, p.id)).filter((k) => !antes.includes(k));
  return nuevos.length ? { guiaCafe: { ...guiaCafeDe(settings), vistos: [...antes, ...nuevos] } } : null;
}

/**
 * Marca de este dispositivo, como la de Libo (`bookshelf:libo`): lo visto aquí, por si los ajustes aún no han llegado de la
 * nube. Se suma a lo de los ajustes.
 */
export const GUIA_CAFE_KEY = 'bookshelf:guia-cafe';

function vistosAqui(storage) {
  try {
    const lista = JSON.parse(storage?.getItem(GUIA_CAFE_KEY) || '[]');
    return Array.isArray(lista) ? lista.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Los ajustes con lo visto en este dispositivo sumado (para `pasosDe` y `marcarVistos`). */
export function conLoDeAqui(settings, storage = globalThis.localStorage) {
  const aqui = vistosAqui(storage);
  if (!aqui.length) return settings;
  const vistos = [...new Set([...guiaCafeDe(settings).vistos, ...aqui])];
  return { ...settings, guiaCafe: { ...guiaCafeDe(settings), vistos } };
}

/** Apunta en este dispositivo lo que se acaba de ver. */
export function marcarAqui(capitulo, pasos, storage = globalThis.localStorage) {
  const antes = vistosAqui(storage);
  const lista = [...new Set([...antes, ...pasos.map((p) => clave(capitulo, p.id))])];
  if (lista.length === antes.length) return;
  try {
    storage?.setItem(GUIA_CAFE_KEY, JSON.stringify(lista));
  } catch {
    // Sin almacenamiento: vale lo guardado en los ajustes
  }
}

/** Lo que dice un paso quien atiende ('olmo' o 'pilar'). */
export const textoDe = (paso, quien) => paso.texto[quien] ?? paso.texto.pilar;
