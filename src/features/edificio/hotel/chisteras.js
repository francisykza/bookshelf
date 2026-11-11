// «Las tres chisteras» (1.110, SPEC §110; plan en docs/qa/casino-3d.md, bloque d): el tercer juego del casino. El conejo
// de la chistera se mete bajo una de las tres chisteras de la mesa y las chisteras cambian de sitio; tú sigues con la vista
// dónde está. Tres rondas al día, cada una con más cambios y más deprisa. Es de habilidad (observación): nada de azar en el
// premio, que depende solo de cuántas aciertas.
// Baraja y comprueba el servidor (supabase/migrations/20261202120000_casino_chisteras.sql): cada vez que se mira una ronda
// la baraja de nuevo (volver a mirarla no ayuda) y es él quien sabe si has acertado. Estas cifras son las mismas que
// `piso_casino_chisteras_reglas` (una prueba lo comprueba).

/**
 * 1.112 · Los premios de las chisteras: cada partida perfecta (tres de tres) es un sello, y los sellos se cambian por estos
 * premios, una vez cada uno (los mismos que `piso_casino_chisteras_premios`; una prueba lo comprueba). Nunca con dinero ni
 * tickets. El acabado se pone en una copia lisa tuya, que eliges.
 */
export const PREMIOS_CHISTERAS = [
  { id: 'complemento:chistera-mago', tipo: 'prenda', sellos: 2, nombre: 'Chistera de mago', texto: 'De terciopelo añil, con estrellas que se encienden de tarde.' },
  { id: 'complemento:varita', tipo: 'prenda', sellos: 4, nombre: 'Varita de mago', texto: 'De ébano con la punta de marfil: la llevas en la mano.' },
  { id: 'baul-mago', tipo: 'mueble', sellos: 6, nombre: 'Baúl de mago', texto: 'Añil, con flejes de latón y una luna pintada.' },
  { id: 'acabado:polvo-estrellas', tipo: 'acabado', sellos: 10, nombre: 'Polvo de estrellas', texto: 'Un acabado para una copia lisa tuya: añil y dorado.' },
];
export const premioChisteras = (id) => PREMIOS_CHISTERAS.find((p) => p.id === id) ?? null;

/** Las reglas: rondas al día, cambios de cada ronda y fichas según cuántas aciertas (0, 1, 2 o 3). */
export const CHISTERAS_JUEGO = { rondas: 3, cambios: [3, 5, 7], premios: [1, 3, 6, 10] };

/** Cada cambio cruza dos chisteras: 0 = izquierda y medio, 1 = medio y derecha, 2 = izquierda y derecha. */
export const PARES = [
  [0, 1],
  [1, 2],
  [0, 2],
];

/** Lo que tarda cada cambio en cada ronda (ms): cada ronda, más deprisa. */
export const CAMBIO_MS = [640, 470, 340];
/** Con movimiento reducido, los cambios van paso a paso: la chistera salta a su sitio y se espera esto entre uno y otro. */
export const PASO_MS = 1100;

/** El nombre de cada sitio, de izquierda a derecha según se mira la mesa. */
export const SITIO = ['la de la izquierda', 'la del medio', 'la de la derecha'];
export const SITIO_CORTO = ['Izquierda', 'En medio', 'Derecha'];

/** Dónde acaba el conejo si empieza bajo `inicio` y se hacen `cambios`. */
export function conejoTras(inicio, cambios) {
  let pos = inicio;
  for (const k of cambios) {
    const [a, b] = PARES[k];
    if (pos === a) pos = b;
    else if (pos === b) pos = a;
  }
  return pos;
}

/** Las fichas de una partida según cuántas rondas se aciertan. */
export const fichasPor = (aciertos) => CHISTERAS_JUEGO.premios[Math.max(0, Math.min(CHISTERAS_JUEGO.rondas, aciertos))];

/** Un cambio dicho en palabras (para quien no ve la mesa). */
export function cambioDicho(k) {
  const [a, b] = PARES[k];
  return `Cambian ${SITIO[a]} y ${SITIO[b]}.`;
}
