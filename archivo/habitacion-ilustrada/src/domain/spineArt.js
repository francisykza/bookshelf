// Ajuste de las texturas de lomo ilustradas (SPEC §23.3), sin React: la textura se estira como mucho
// `MAX_STRETCH` en ancho o alto; si el lomo es más fino o más grueso que eso, se recorta centrada (nunca se
// deforma de más). `ratio` = ancho / alto natural de la textura.
export const MAX_STRETCH = 1.35;

/** Tamaño de fondo (px del lienzo de la balda) para un lomo de `w × h`. */
export function spineArtSize(w, h, ratio) {
  const natural = h * ratio;
  if (w > natural * MAX_STRETCH) return { w, h: w / (ratio * MAX_STRETCH) };
  if (w < natural / MAX_STRETCH) return { w: (h * ratio) / MAX_STRETCH, h };
  return { w, h };
}
