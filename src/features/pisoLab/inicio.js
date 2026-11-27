// Pantalla inicial: tu piso del edificio del puerto, siempre (1.157). Hasta la 1.156 se podía volver a la experiencia
// anterior (la habitación ilustrada de la 1.86) y la elección se guardaba en `bookshelf:inicio`; la habitación está ahora
// en `archivo/habitacion-ilustrada/`, fuera de la app, y esa preferencia se ignora (no se borra).

/** La habitación del inicio: tu piso del edificio, el de tu cuenta (1.88, `useMyPiso.js`). Los pisos del piloto
 * (`labStore.js`) solo se abren en el modo de demostración, con ?piloto=piso. */
export const HOME_PISO = 'mio';
