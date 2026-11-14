// El café-librería del bajo, 1.132 (encargo de Francisco del 14-11-2026, con las cuatro decisiones recomendadas; plan en
// docs/qa/cafe-libreria.md §16): el influencer de cada nivel.
// - Al llenar la barra del nivel, el café está «a punto de subir» y llega el influencer de esa subida: siete personajes
//   propios, uno por nivel del 2 al 8, cada uno con su accesorio, su receta fija y lo que publica. El nivel sube al
//   despedirle, salga como salga; mientras tanto, la reputación de más espera aparte (no se pierde).
// - El reloj de arena: 150 segundos, sin números ni alarmas, desde que vas a la barra hasta que le das la taza y el libro.
//   Si se acaba la arena, paga como un cliente normal y el café sube igual: solo se pierde lo especial.
// - A tiempo y con 3 estrellas, «el vídeo se hace viral»: el siguiente día que abras el café llegan 3 clientes más por su
//   vídeo, y su foto firmada se cuelga en la pared (una por influencer: una colección de siete).
// - Paga como el excéntrico; se atiende siempre a mano (Pilar no lo prepara).
// Personajes originales, nunca parecidos a influencers reales. Las cifras y las recetas son las de la migración
// `20261219120000_cafe_influencer.sql` (una prueba lo comprueba). Solo reglas y cuentas: sin React ni Three, y sin importar
// nada (cafeClientes.js y cafeLibreria.js lo usan a él).

/** Lo que dura la arena del reloj (segundos). */
export const ARENA_SEGUNDOS = 150;
/** El margen del servidor por la conexión (segundos): solo lo usa él, para no ser injusto con una red lenta. */
export const ARENA_MARGEN = 10;
/** Clientes de más el día siguiente a un vídeo viral. */
export const VIRALES = 3;
/** Los números de cliente: los virales, del 201 al 203; el influencer, 300 más el nivel al que sube. */
export const VIRAL_DESDE = 201;
export const numeroInfluencer = (nivel) => 300 + nivel;

/**
 * Los siete influencers, por el nivel al que sube el café al despedirlos. `pide`: [bebida, grano, leche, toque] (siempre con lo
 * que ya está en la carta con la barra del nivel anterior llena); `libro`: la extensión y la forma (el género, de tu balda).
 */
export const INFLUENCERS = {
  2: {
    nombre: 'La Bloguera del Muelle',
    accesorio: 'palo',
    tema: [236, 122, 98],
    avatar: { piel: 1, pelo: 'largo', colorPelo: 3, jersey: 2, pantalon: 0, gafas: false, complemento: 'ninguno' },
    pide: ['cafe', 'suave', 'avena', 'canela'],
    libro: { extension: 'corto', forma: 'llevar' },
    saludo: '¡Hola, hola! Estoy en directo para mi blog del muelle. Mientras cae la arena, ¿me preparas esto?',
    publica: 'El café más bonito del muelle',
  },
  3: {
    nombre: 'El Booktuber de las Gafas Redondas',
    accesorio: 'aro',
    tema: [112, 168, 232],
    avatar: { piel: 3, pelo: 'rizos', colorPelo: 0, jersey: 5, pantalon: 1, gafas: true, complemento: 'ninguno' },
    pide: ['te', 'intenso', 'sin', 'miel'],
    libro: { extension: 'largo', forma: 'aqui' },
    saludo: '¿Grabando? ¡Grabando! Hoy reseño cafés y libros, y el anillo de luz ya está encendido. Tú, a la barra: la arena no espera.',
    publica: 'Un té, un libro largo y un café que crece',
  },
  4: {
    nombre: 'La Crítica de la Libreta Roja',
    accesorio: 'libreta',
    tema: [204, 64, 64],
    avatar: { piel: 0, pelo: 'mono', colorPelo: 0, jersey: 7, pantalon: 1, gafas: true, complemento: 'ninguno' },
    pide: ['chocolate', 'intenso', 'entera', 'nata'],
    libro: { extension: 'corto', forma: 'aqui' },
    saludo: 'Vengo a escribir la crítica de este local. Lo apuntaré todo en mi libreta… también cuánto tarda. Empiece cuando quiera.',
    publica: 'Cinco tazas sobre cinco',
  },
  5: {
    nombre: 'El Fotógrafo de Escaparates',
    accesorio: 'camara',
    tema: [228, 186, 84],
    avatar: { piel: 2, pelo: 'corto', colorPelo: 4, jersey: 3, pantalon: 2, gafas: false, complemento: 'ninguno' },
    pide: ['cafe', 'suave', 'entera', 'vainilla'],
    libro: { extension: 'corto', forma: 'regalar' },
    saludo: 'Fotografío los mejores escaparates del puerto, y el tuyo está a punto de salir. ¿Me preparas esto mientras se revela la foto?',
    publica: 'Un escaparate con alma',
  },
  6: {
    nombre: 'La del Directo de Medianoche',
    accesorio: 'auriculares',
    tema: [152, 112, 222],
    avatar: { piel: 4, pelo: 'melena', colorPelo: 1, jersey: 6, pantalon: 1, gafas: false, complemento: 'ninguno' },
    pide: ['frio', 'intenso', 'avena', 'nada'],
    libro: { extension: 'largo', forma: 'llevar' },
    saludo: '¡Buenas noches, lectores trasnochadores! Emito en directo desde tu café. Prepárame esto antes de que se acabe la emisión.',
    publica: 'Bajando a una bodega secreta',
  },
  7: {
    nombre: 'El Catador de Cafés',
    accesorio: 'cata',
    tema: [164, 108, 64],
    avatar: { piel: 1, pelo: 'rapado', colorPelo: 5, jersey: 0, pantalon: 3, gafas: false, complemento: 'ninguno' },
    pide: ['cafe', 'intenso', 'sin', 'nada'],
    libro: { extension: 'largo', forma: 'aqui' },
    saludo: 'Pruebo cafés por todo el puerto y los puntúo en mi canal. Sin adornos: quiero sentir el grano. El reloj ya corre.',
    publica: 'Aquí huele a tostadero',
  },
  8: {
    nombre: 'La Autora de «Cafés con alma»',
    accesorio: 'gabardina',
    tema: [108, 152, 122],
    avatar: { piel: 2, pelo: 'largo', colorPelo: 5, jersey: 4, pantalon: 2, gafas: true, complemento: 'ninguno' },
    pide: ['frio', 'suave', 'entera', 'vainilla'],
    libro: { extension: 'largo', forma: 'regalar' },
    saludo: 'Escribo una guía de los cafés con más alma del país. El tuyo podría tener su capítulo… si me sorprendes antes de que caiga la arena.',
    publica: 'Un capítulo para tu café en «Cafés con alma»',
  },
};
export const NIVELES_INFLUENCER = Object.keys(INFLUENCERS).map(Number);
export const influencerDe = (nivel) => INFLUENCERS[nivel] ?? null;

/** El nombre dentro de una frase, con el artículo en minúscula («y la Bloguera del Muelle viene…»). */
export const enFrase = (nombre = '') => nombre.replace(/^(El|La) /, (m) => m.toLowerCase());

/** Lo que dicen al pedir los que vienen por su vídeo viral. */
export function saludoViral(nivel) {
  const nombre = INFLUENCERS[nivel]?.nombre;
  if (!nombre) return '¡Hola! Vengo por un vídeo de tu café. ¿Me pones esto?';
  const de = nombre.startsWith('El ') ? `del ${nombre.slice(3)}` : nombre.startsWith('La ') ? `de la ${nombre.slice(3)}` : `de ${nombre}`;
  return `¡Hola! Vengo por el vídeo ${de}. ¿Me pones esto?`;
}

/** Lo que dice al despedirse, según cómo salió: viral (a tiempo y con 3 estrellas), a tiempo o con la arena acabada. */
export function despedidaInfluencer({ a_tiempo: aTiempo = false, viral = false } = {}) {
  if (viral) return '«¡Esto se va a hacer viral! Mis seguidores van a querer venir mañana mismo. Te dejo una foto firmada para la pared.»';
  if (aTiempo) return '«¡Justo a tiempo! No era del todo lo que pedí, pero el directo ha quedado precioso.»';
  return '«¡Se me acabó el directo! Igual tiene una pinta buenísima. Gracias.»';
}

/** Un número fijo por día y nivel (para el libro que pide: el mismo todo el día). */
export function semillaInfluencer(dia = '', nivel = 2) {
  let h = 2166136261;
  for (const ch of `${dia}:${nivel}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h % 1000000;
}

/**
 * Qué libro pide el influencer, de lo que se puede pedir hoy (`posibles`: los de `pedidosPosiblesBalda`, género y extensión):
 * su extensión y su forma (fijas) y, de género, uno de los que tengan esa extensión (si no hay ninguno, cualquiera de la
 * balda). Con la balda vacía, null (solo el café).
 */
export function pedidoInfluencer(nivel, posibles = [], semilla = 0) {
  const inf = influencerDe(nivel);
  if (!inf || !posibles.length) return null;
  const conSuExtension = posibles.filter((p) => p.extension === inf.libro.extension);
  const lista = conSuExtension.length ? conSuExtension : posibles;
  const p = lista[Math.abs(Math.floor(Number(semilla) || 0)) % lista.length];
  return { id: 'libro', genero: p.genero, extension: p.extension, forma: inf.libro.forma };
}

/** Lo que queda de arena (de 1 a 0) a los `ms` milisegundos. */
export const arenaQueda = (ms = 0) => Math.min(1, Math.max(0, 1 - ms / (ARENA_SEGUNDOS * 1000)));
/** Cómo se dice lo que queda, sin números (para los lectores de pantalla). */
export const arenaTexto = (queda = 1) =>
  queda <= 0 ? 'Se ha acabado la arena' : queda < 0.25 ? 'Queda muy poca arena' : queda < 0.5 ? 'Queda menos de la mitad de la arena' : queda < 0.75 ? 'Queda más de la mitad de la arena' : 'El reloj de arena acaba de empezar';
