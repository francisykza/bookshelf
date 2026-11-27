// Reglas del panorama de dos habitaciones (SPEC §16.6): sin React, para poder probarlas.

export const MAIN_ROOM = 'MAIN_ROOM';
export const SOCIAL_ROOM = 'SOCIAL_ROOM';

/** Desplazamiento horizontal mínimo (px CSS) y dominancia sobre el vertical para reconocer un swipe. */
export const SWIPE_MIN = 50;
export const SWIPE_RATIO = 1.3;

/** Habitación de destino de un gesto, o `null`: a la izquierda desde MAIN, a la derecha desde SOCIAL, sin bucle. */
export function swipeTarget(room, dx, dy) {
  if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) <= Math.abs(dy) * SWIPE_RATIO) return null;
  if (dx < 0 && room === MAIN_ROOM) return SOCIAL_ROOM;
  if (dx > 0 && room === SOCIAL_ROOM) return MAIN_ROOM;
  return null;
}
