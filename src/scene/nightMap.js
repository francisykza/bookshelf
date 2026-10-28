// Mapa de la habitación nocturna (1.51, SPEC §49). Todas las medidas son píxeles de
// `images/room-night/dormitorio-noche.webp` (851 × 1848, proporción de la maqueta nocturna), medidas sobre una
// rejilla de la propia imagen. Es otra ilustración que la de día (`sceneMap.js`): baldas, ventanal, cama y mesa
// están en otro sitio, así que tiene su propio sistema de coordenadas. El libro abierto es un recurso aparte
// (`libro-abierto-noche.webp`, 1697 × 768, con transparencia) colocado sobre el edredón.
import { asset } from './sceneMap';

export const NIGHT_ROOM = {
  id: 'MAIN_ROOM',
  src: asset('images/room-night/dormitorio-noche.webp'),
  width: 851,
  height: 1848,
  framing: [
    // Vertical: la proporción de la maqueta (0,46); en pantallas algo más anchas se recorta arriba y abajo, centrado
    { maxAspect: 0.62, x: 0.5, y: 0.5 },
    // Tableta y ventanas casi cuadradas: hacia la cama y el libro
    { maxAspect: 1, x: 0.5, y: 0.88 },
    // Horizontal y escritorio: la franja inferior entera (cama, libro completo, cascos y mesa)
    { maxAspect: Infinity, x: 0.5, y: 1 },
  ],
};

/** Objetos tocables (px de la ilustración). `label`: punto de anclaje de su nombre. */
export const NIGHT_SPOTS = {
  shelf: { shape: [[0, 60], [330, 150], [330, 1190], [0, 1190]], title: 'Mi librería' },
  figures: { shape: [[85, 190], [265, 230], [265, 365], [85, 330]], title: 'Vitrina de figuras: El Ático' },
  lamp: { shape: [[0, 365], [52, 368], [62, 400], [110, 455], [112, 502], [0, 506]], title: 'Lámpara' },
  laptop: { shape: [[615, 1060], [851, 1050], [851, 1335], [615, 1330]], title: 'Portátil: estadísticas y calendario' },
  lantern: { shape: [[782, 1262], [848, 1262], [848, 1362], [782, 1362]], title: 'Vela' },
  headphones: { shape: [[0, 1290], [40, 1266], [110, 1260], [180, 1284], [208, 1330], [208, 1396], [150, 1412], [70, 1416], [0, 1410]], title: 'Auriculares: sonido ambiental' },
};

/** Pantalla del portátil: cuatro esquinas interiores del bisel (la derecha la corta el borde de la ilustración). */
export const NIGHT_SCREEN = [[779, 1081], [851, 1070], [851, 1244], [748, 1219]];

/**
 * Libro abierto sobre el edredón: el recurso (px propios) escalado de forma uniforme y girado, sin estirarlo.
 * `cx, cy`: centro en la escena; `scale`; `angle` en grados. Medido contra la maqueta (bbox ≈ 40–848 × 1385–1795).
 */
export const NIGHT_BOOK = {
  src: asset('images/room-night/libro-abierto-noche.webp'),
  w: 1697,
  h: 768,
  cx: 446,
  cy: 1606,
  scale: 0.515,
  angle: 5,
  // Zonas útiles de cada página en px del recurso: centro, tamaño y giro del texto (acompaña con moderación la
  // perspectiva de su papel), lejos del pliegue, de la cinta y de los ramitos pintados
  left: { cx: 615, cy: 275, w: 530, h: 380, angle: 6 },
  right: { cx: 1255, cy: 445, w: 500, h: 470, angle: 4.5 },
};

/** Carteles fijados a su soporte: trapecio en px de la ilustración (arriba-izq., arriba-der., abajo-der., abajo-izq.). */
export const NIGHT_PLAQUES = {
  // Frente plano de la balda bajo la última fila de libros (los lomos acaban en y ≈ 890)
  shelf: [[80, 898], [295, 896], [295, 950], [80, 952]],
  // Frente de la mesa del portátil, que baja ≈ 12° hacia la derecha
  diary: [[632, 1322], [806, 1358], [795, 1412], [621, 1376]],
};

/** «Social ›»: esquina superior izquierda, junto al marco del ventanal (px de la ilustración). */
export const NIGHT_SOCIAL = { x: 660, y: 532 };

/** Luces localizadas que se apagan con su objeto (centro y radio en px de la ilustración). */
export const NIGHT_LIGHTS = {
  lamp: { x: 50, y: 470, r: 300 },
  candle: { x: 815, y: 1305, r: 150 },
};
