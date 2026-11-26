// Las poses de Libo (Francisco, 26-11-2026: «añádelas a lo largo de la app, para que parezca que libo está vivo y le dé más
// alegría»). Las dibujó él; `scripts/libo-poses.mjs` las recorta de su hoja en lienzos iguales (420 × 400, apoyadas abajo y a la
// misma escala), así que cambiar de pose no cambia el tamaño de Libo. Reglas puras, sin React: qué pose toca en cada momento.

export const POSES = Object.freeze(['de-pie', 'saluda', 'lee', 'camina', 'celebra', 'duerme', 'duda', 'carino', 'enfado', 'sorpresa', 'abraza', 'corre', 'gatito', 'asoma', 'espaldas']);

/** El lienzo de todas las poses y lo que ocupa Libo de pie en él (para que se vea del mismo tamaño que antes). */
export const LIENZO = Object.freeze({ w: 420, h: 400, dePie: 365 });

/** La imagen de una pose (si no existe, de pie). */
export const poseUrl = (pose) => `/assets/libo/poses/${POSES.includes(pose) ? pose : 'de-pie'}.webp`;

/** Cuánto dura cada reacción antes de volver a su pose de siempre (ms). */
export const DURA = Object.freeze({ celebra: 3000, abraza: 3800, enfado: 1500, carino: 1900, espaldas: 1300, corre: 800 });

/** Sin tocar nada: primero se sienta a leer y, mucho rato después, se duerme (segundos). */
export const REPOSO = Object.freeze({ lee: 30, duerme: 90 });

/** La pose en su esquina cuando no pasa nada: según cómo se porta, y según el rato que llevas sin tocar nada. */
export function poseEnReposo({ modo = 'sugiere', quieto = 0, gatito = false } = {}) {
  if (quieto >= REPOSO.duerme) return 'duerme';
  // Con «Solo cuando le llamo» se queda leyendo en su rincón hasta que le tocas
  if (quieto >= REPOSO.lee || modo === 'llamar') return gatito && modo !== 'llamar' ? 'gatito' : 'lee';
  return 'de-pie';
}

/** La pose con su bocadillo abierto: lo que te cuenta decide cómo te lo cuenta. */
export function poseAlHablar({ avisos = [], sugerencia = null } = {}) {
  if (avisos.length) return 'sorpresa';
  const id = sugerencia?.id ?? '';
  if (!id) return 'saluda';
  if (id.startsWith('resena:')) return 'abraza';
  if (id.startsWith('parado:') || id.startsWith('idea:')) return 'duda';
  if (id.startsWith('ver:')) return 'camina';
  return 'saluda';
}

/** La pose de cada paso de una guía: saluda al empezar, te acompaña andando y celebra el final. */
export function poseDelPaso(i, total) {
  if (i === 0) return 'saluda';
  if (i >= total - 1) return 'celebra';
  return i % 2 ? 'camina' : 'de-pie';
}

/**
 * Si tu lectura ha cambiado lo bastante para que Libo lo celebre: un libro terminado (lo abraza) o un registro nuevo (lo celebra).
 * Solo uno o dos de golpe: más es la nube trayendo tu biblioteca al arrancar, no algo que acabas de hacer.
 */
export function reaccionALectura(antes, ahora) {
  if (!antes || !ahora) return null;
  const terminados = ahora.terminados - antes.terminados;
  const registros = ahora.registros - antes.registros;
  if (terminados >= 1 && terminados <= 2) return 'abraza';
  if (registros >= 1 && registros <= 2) return 'celebra';
  return null;
}

/** Muchos toques seguidos (4 en 2 s): se enfada un momento y enseguida se le pasa. */
export function muchosToques(instantes, ahora, { cuantos = 4, ventana = 2000 } = {}) {
  return instantes.filter((t) => ahora - t <= ventana).length >= cuantos;
}

// Vivo aunque no le toques (Francisco, 26-11-2026: «que libo tenga un ligero movimiento incluso cuando no estés tocándolo»): además
// de respirar y mecerse (CSS), de vez en cuando hace un gesto pequeño. Nunca pide nada ni hace ruido.
/** Cada cuánto, como poco y como mucho, hace un gesto (ms). */
export const ESPERA_GESTO = Object.freeze([7000, 14000]);
/** Cuánto dura cada gesto (ms): un saltito, o mirar un momento hacia el otro lado. */
export const DURA_GESTO = Object.freeze({ salta: 700, mira: 2400 });

/** El gesto que toca en calma (azar de 0 a 1): de pie, un saltito o mirar al otro lado; leyendo, solo mira; dormido o en otra pose, nada. */
export function gestoEnCalma(pose, azar) {
  if (pose === 'lee') return 'mira';
  if (pose === 'de-pie') return azar < 0.5 ? 'salta' : 'mira';
  return null;
}
