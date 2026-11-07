// Pantalla inicial (versión privada, 7-11-2026): la habitación en primera persona es el inicio y su puerta lleva al
// edificio del puerto. Mientras dure la prueba se puede volver a la experiencia anterior (la habitación ilustrada) y
// regresar; la elección se guarda solo en este dispositivo, fuera de la biblioteca, así que no toca libros, lecturas,
// decoración ni la copia de la nube.
//
// Dónde está activa por defecto: lo decide la compilación (`__PISO_INICIO__`, en `vite.config.js`). Desde la 1.87, en
// todo lo que compila Vercel (producción incluida); en local y en las pruebas, no, salvo con PISO_INICIO=1.

export const INICIO_KEY = 'bookshelf:inicio';
/** La habitación del inicio: tu piso del edificio, el de tu cuenta (1.88, `useMyPiso.js`). Los pisos del piloto
 * (`labStore.js`) solo se abren en el modo de demostración, con ?piloto=piso. */
export const HOME_PISO = 'mio';

/* global __PISO_INICIO__ */
const BUILD_DEFAULT = typeof __PISO_INICIO__ !== 'undefined' && __PISO_INICIO__ === true;

const read = (store) => {
  try {
    return store?.getItem(INICIO_KEY) ?? null;
  } catch {
    return null;
  }
};

/** ¿Se ofrece la habitación nueva? Si esta versión la trae por defecto, o si ya se probó en este dispositivo (aunque luego se volviera a la anterior). */
export const newRoomAvailable = (store = globalThis.localStorage) => BUILD_DEFAULT || read(store) != null;

/** ¿Se arranca en la habitación? `?inicio=habitacion|anterior` lo fija en este dispositivo (para probar). */
export function startsInRoom(place = globalThis.location, store = globalThis.localStorage) {
  const asked = new URLSearchParams(place?.search ?? '').get('inicio');
  if (asked === 'habitacion' || asked === 'anterior') choose(asked, store);
  const chosen = read(store);
  if (chosen === 'anterior') return false;
  if (chosen === 'habitacion') return true;
  return BUILD_DEFAULT;
}

/** Guarda la elección en este dispositivo ('habitacion' o 'anterior'). */
export function choose(value, store = globalThis.localStorage) {
  try {
    store?.setItem(INICIO_KEY, value);
  } catch {
    // Sin almacenamiento: la elección dura lo que la visita
  }
}
