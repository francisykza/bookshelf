// Geometría y recursos de la visita social (SPEC §56). Los tres recursos son comunes a todas las visitas y comparten un
// marco 9:16 de 720 × 1280 px; todas las zonas van en coordenadas normalizadas de esa imagen (nunca en píxeles de la
// pantalla). Calibrado sobre los fondos a resolución nativa (docs/design/visita-social-recursos.md).

export const VISIT_W = 720;
export const VISIT_H = 1280;

/** Rutas versionadas: fuera de /assets/ (el service worker no las guarda; la caché HTTP las reutiliza). */
export const VISIT_MEDIA = {
  house: '/media/social-visit/casa-v1.webp',
  video: '/media/social-visit/entrada-v1.mp4',
  room: '/media/social-visit/habitacion-v1.webp',
};

/** Ventana inferior derecha de la casa: la única que recorre el vídeo. */
export const HOUSE_WINDOW = { x0: 0.48, x1: 0.73, y0: 0.46, y1: 0.64 };

/** Mueble de la izquierda en la habitación final (zona tocable de «Libros compartidos»). */
export const ROOM_SHELF = { x0: 0, x1: 0.23, y0: 0.08, y1: 0.83 };

/**
 * Hueco de la balda superior útil (px de la imagen). La estantería está en la pared izquierda y en perspectiva: el borde
 * cercano está en x ≈ 14 y el fondo en x ≈ 144; la base sube hacia el espectador (no es horizontal en pantalla).
 */
export const SHELF_GAP = { near: 14, far: 144, top: [230, 307], base: [371, 435] };

const lerp = (a, b, t) => a + (b - a) * t;
const at = ([n, f], x) => lerp(n, f, (x - SHELF_GAP.near) / (SHELF_GAP.far - SHELF_GAP.near));

/**
 * Lomos de hasta tres libros destacados, apoyados en la base inclinada de la balda: polígonos en px de la imagen y su
 * caja (en fracciones) para el botón accesible. Más estrechos hacia el fondo, sin invadir la pared ni la balda superior.
 */
export function shelfSpines(count) {
  const slots = [0.16, 0.44, 0.7];
  return slots.slice(0, Math.min(3, count)).map((t, i) => {
    const x0 = lerp(SHELF_GAP.near + 8, SHELF_GAP.far - 14, t);
    const w = lerp(22, 13, t);
    const x1 = x0 + w;
    const height = [0.82, 0.74, 0.86][i];
    const top = (x) => at(SHELF_GAP.base, x) - (at(SHELF_GAP.base, x) - at(SHELF_GAP.top, x) - 6) * height;
    const points = [
      [x0, at(SHELF_GAP.base, x0)],
      [x1, at(SHELF_GAP.base, x1)],
      [x1, top(x1)],
      [x0, top(x0)],
    ];
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    return {
      points,
      box: { left: Math.min(...xs) / VISIT_W, top: Math.min(...ys) / VISIT_H, width: (Math.max(...xs) - Math.min(...xs)) / VISIT_W, height: (Math.max(...ys) - Math.min(...ys)) / VISIT_H },
    };
  });
}
