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
 * Huecos útiles de la estantería (px de la imagen), de arriba abajo. La estantería está en la pared izquierda y en
 * perspectiva: el borde cercano está en x ≈ 14 y el fondo en x ≈ 144; cada base baja hacia el fondo (no es horizontal en
 * pantalla). `top` es la cara inferior de la balda de encima y `base`, la superficie donde se apoyan los libros.
 * Medido sobre habitacion-v1.webp a resolución nativa (1.58.1).
 */
export const SHELF_NEAR = 14;
export const SHELF_FAR = 144;
export const SHELF_ROWS = [
  { top: [230, 307], base: [371, 435] },
  { top: [400, 468], base: [543, 585] },
  { top: [570, 603], base: [717, 739] },
  { top: [745, 758], base: [863, 879] },
];
/** Lomos por balda: con más libros compartidos, la lista completa sigue en «Libros compartidos». */
export const SPINES_PER_ROW = 6;
export const SHELF_CAPACITY = SHELF_ROWS.length * SPINES_PER_ROW;

const lerp = (a, b, t) => a + (b - a) * t;
const at = ([n, f], x) => lerp(n, f, (x - SHELF_NEAR) / (SHELF_FAR - SHELF_NEAR));
const HEIGHTS = [0.8, 0.72, 0.86, 0.76, 0.82, 0.7];

/**
 * Lomos de los libros compartidos, balda a balda y de cerca a lejos, apoyados en cada base inclinada: polígonos en px
 * de la imagen y su caja (en fracciones). Más estrechos hacia el fondo, sin invadir la pared ni la balda de encima.
 * Nunca más de los que caben (SHELF_CAPACITY); sin libros, ninguno (las baldas se quedan vacías, sin rellenos).
 */
export function shelfSpines(count) {
  const n = Math.max(0, Math.min(SHELF_CAPACITY, Math.floor(count) || 0));
  return Array.from({ length: n }, (_, k) => {
    const row = SHELF_ROWS[Math.floor(k / SPINES_PER_ROW)];
    const j = k % SPINES_PER_ROW;
    // Juntos, como en una balda de verdad: anchos que se estrechan hacia el fondo, uno al lado del otro
    const width = (i) => lerp(18, 12, i / (SPINES_PER_ROW - 1));
    const x0 = SHELF_NEAR + 6 + Array.from({ length: j }, (_, i) => width(i) + 1).reduce((acc, v) => acc + v, 0);
    const x1 = x0 + width(j);
    const height = HEIGHTS[(k * 5 + j) % HEIGHTS.length];
    const top = (x) => at(row.base, x) - (at(row.base, x) - at(row.top, x) - 6) * height;
    const points = [
      [x0, at(row.base, x0)],
      [x1, at(row.base, x1)],
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

let warmed = false;
/**
 * 1.59 (SPEC §59.6): al tocar «Visitar rincón» se adelanta lo que la visita necesita primero (su código y la casa ya
 * decodificada), para que al abrirse no haya ni un instante de pantalla vacía. Una sola vez por sesión.
 */
export function warmVisit() {
  if (warmed || typeof Image === 'undefined') return;
  warmed = true;
  import('./components/ReaderVisit').catch(() => {});
  const img = new Image();
  img.src = VISIT_MEDIA.house;
  img.decode?.().catch(() => {});
}
