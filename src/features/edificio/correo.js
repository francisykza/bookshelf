// El correo del buzón del portal (1.73, 1.78): lo que te ha llegado de tus vecinos y lo que ya has leído en este aparato. Lo
// comparten el buzón dibujado de la fachada y Libo, que en tu piso te dice si hay cartas sin leer (docs/qa/libo.md, bloque 3).
import { FIRMAS, catalogItem } from './catalog';

/** El texto de una firma del libro de visitas. */
export const firmaTexto = (id) => FIRMAS.find((x) => x.id === id)?.texto ?? '';

/** Las cartas de tus vecinos (regalos y firmas), como las escribe el buzón: el buzón recuerda lo leído por su texto. */
export function lineasCorreo(social) {
  if (!social) return [];
  return [
    ...(social.regalos ?? []).slice(0, 5).map((r) => `${r.alias ?? 'Un vecino'} te regaló: ${catalogItem(r.mueble).nombre.toLowerCase()}.`),
    ...(social.visitas ?? []).slice(0, 5).map((v) => `${v.alias ?? 'Un vecino'} firmó en tu libro de visitas: «${firmaTexto(v.frase)}».`),
  ];
}

// Lo del buzón que ya has leído (1.78): la carta y su número solo cuentan lo nuevo; se guarda por usuario en este aparato
const clave = (uid) => `bookshelf:edificio:correo-leido:${uid}`;

/** Lo ya leído en este aparato (por su texto). */
export function correoLeido(uid) {
  try {
    return new Set(JSON.parse(localStorage.getItem(clave(uid)) ?? '[]'));
  } catch {
    return new Set();
  }
}

/** Dar por leídas unas cartas. */
export function marcarCorreo(uid, lines) {
  try {
    localStorage.setItem(clave(uid), JSON.stringify(lines.slice(0, 40)));
  } catch {
    // Sin almacenamiento, lo leído vale mientras la fachada está abierta
  }
}

/** ¿Cuántas cartas de tus vecinos no has leído? */
export const correoSinLeer = (social, leido) => lineasCorreo(social).filter((l) => !leido.has(l)).length;
