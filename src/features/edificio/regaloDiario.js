// Cuándo regalaste por última vez desde este aparato (la cuenta de verdad la lleva el servidor: un regalo al día). Lo usan la
// mesa del vecino (VecinoMesa.jsx) y, desde la 1.164, la caja de regalo de la visita 3D (VisitaPiso.jsx), que se ve cerrada.
export const DAY_MS = 24 * 60 * 60 * 1000;
const giftKey = (uid) => `bookshelf:edificio:ultimo-regalo:${uid}`;

export const lastGift = (uid) => {
  try {
    return Number(localStorage.getItem(giftKey(uid))) || 0;
  } catch {
    return 0;
  }
};

export const markGift = (uid) => {
  try {
    localStorage.setItem(giftKey(uid), String(Date.now()));
  } catch {
    // Sin almacenamiento, el servidor sigue diciendo que no
  }
};

/** Si ya regalaste hoy desde este aparato. */
export const regaloHechoHoy = (uid) => Date.now() - lastGift(uid) < DAY_MS;
