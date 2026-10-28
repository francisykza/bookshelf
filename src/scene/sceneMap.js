// Mapa de las ilustraciones (SPEC §16.7, Fase 1). Todas las medidas de MAIN_ROOM son píxeles de
// `images/cozy-book-room.jpg` (941 × 1672), medidas sobre una rejilla de la propia imagen; las de SOCIAL_ROOM,
// de `images/cozy-social-room.jpg` (900 × 1600). Cada capa del escenario usa directamente estas coordenadas.

/** Rutas de recursos según la base del despliegue (raíz en Vercel; `BASE_URL` si algún día va en subruta). */
export const asset = (path) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;

/**
 * Habitaciones del panorama. `framing`: qué parte del sobrante se recorta por la izquierda (x) y por arriba
 * (y) según la relación de aspecto del panel (ancho / alto). Es la única fuente del encuadre.
 */
export const ROOMS = {
  MAIN_ROOM: {
    id: 'MAIN_ROOM',
    src: asset('images/cozy-book-room.jpg'),
    width: 941,
    height: 1672,
    // Bahía de la puerta-ventana: agua a la derecha del pueblo y bajo él, entre los cipreses y la hiedra
    // (pueblo, montes, cipreses, hiedra y carpintería quedan fuera de la máscara)
    sea: {
      water: [
        // 1.33.0: algo más de agua visible arriba y a la derecha (sin tocar costa, árboles ni hiedra)
        [[798, 642], [884, 616], [884, 748], [845, 750], [806, 738], [798, 700]],
        [[770, 770], [868, 766], [878, 800], [870, 862], [800, 876], [770, 862]],
      ],
      // Veleros pintados en la ilustración (con su reflejo): la ondulación del agua no los toca (cx, cy, rx, ry)
      paintedBoats: [
        [777, 800, 10, 20],
        [804, 826, 13, 30],
      ],
      // Veleros pintados en (775, 792) y (805, 820): los carriles van por encima del pueblo y al pie de la bahía
      lanes: [
        { from: [816, 690], to: [868, 682], size: 14 },
        { from: [782, 852], to: [858, 846], size: 18 },
      ],
      interactive: 1,
    },
    framing: [
      // Móvil vertical: la imagen sobra a los lados; algo más de recorte a la izquierda para que el té y el
      // portátil no se corten (la lámpara, si queda fuera, pasa al control «Fuera de vista»)
      { maxAspect: 0.62, x: 0.62, y: 0.5 },
      // Tableta y ventanas casi cuadradas: un poco hacia la cama y la mesita
      { maxAspect: 1, x: 0.5, y: 0.62 },
      // Horizontal: franja de la mesita, el portátil, el té, los auriculares y el borde del libro
      { maxAspect: 1.8, x: 0.5, y: 0.79 },
      // Móvil apaisado (muy ancho): un poco más arriba, para que la esquina de controles no tape el portátil
      { maxAspect: Infinity, x: 0.5, y: 0.75 },
    ],
  },
  SOCIAL_ROOM: {
    id: 'SOCIAL_ROOM',
    src: asset('images/cozy-social-room.jpg'),
    width: 900,
    height: 1600,
    // Bahía vista por el ventanal izquierdo (dentro del cristal: el marco queda fuera del agua)
    sea: {
      water: [[[45, 640], [150, 615], [190, 620], [180, 660], [165, 700], [195, 720], [230, 735], [225, 760], [150, 775], [100, 770], [70, 740], [45, 700]]],
      paintedBoats: [
        [94, 692, 10, 18],
        [162, 758, 12, 22],
      ],
      // Veleros pintados en (94, 688) y (162, 754): los carriles pasan lejos de ellos
      lanes: [
        { from: [64, 662], to: [166, 646], size: 14 },
        { from: [104, 732], to: [188, 738], size: 18 },
      ],
      interactive: 1,
    },
    framing: [
      { maxAspect: 0.62, x: 0.5, y: 0.5 },
      { maxAspect: 1, x: 0.5, y: 0.58 },
      { maxAspect: Infinity, x: 0.5, y: 0.62 },
    ],
  },
};

export const SCENE_W = ROOMS.MAIN_ROOM.width;
export const SCENE_H = ROOMS.MAIN_ROOM.height;
export const SCENE_SRC = ROOMS.MAIN_ROOM.src;

/**
 * Escena recompuesta (SPEC §24): el fondo limpio (misma geometría que la ilustración: se ha comprobado que pantalla,
 * vaso, vela, baldas y agua caen en el mismo sitio) con la vegetación y la cortina como capas propias, colocadas
 * con recorte de márgenes, escala proporcional y posición (sin estirar). `motion`: cómo se mueve cada capa
 * (`sway`, giro y desplazamiento sobre su anclaje; `drape`, solo la tela libre bajo el recogido); sin `motion`,
 * fija (la cortina de arriba y la enredadera con su poste rígido). Hasta que todo carga, se ve la ilustración original.
 */
const refresh = (name) => asset(`images/room-refresh/escena/${name}.webp`);
export const SCENE_REFRESH = {
  base: refresh('fondo-limpio'),
  foreground: refresh('portatil-primer-plano'),
  layers: [
    { id: 'cortina-alta', x: 476, y: 0, w: 159, h: 495 },
    // `tip`: recorrido objetivo en px CSS de la punta más lejana (igual en todas las pantallas: se divide por la
    // escala de la escena); `reach`: distancia en px de la escena del anclaje a esa punta. `delay`: retardo de la
    // misma ráfaga (la cortina responde después de la vegetación)
    { id: 'cortina-caida', x: 476, y: 495, w: 159, h: 303, motion: { kind: 'drape', tip: 6, reach: 303, delay: '1.4s' } },
    { id: 'enredadera-poste', x: 340, y: 80, w: 129, h: 660 },
    { id: 'hiedra-izquierda', x: 0, y: 0, w: 443, h: 358, motion: { kind: 'sway', origin: [60, 10], tip: 5, reach: 517, delay: '0s' } },
    { id: 'hiedra-derecha', x: 437, y: 0, w: 504, h: 476, motion: { kind: 'sway', origin: [253, 0], tip: 5.5, reach: 538, delay: '0.8s' } },
  ].map((l) => ({ ...l, src: refresh(l.id) })),
};

/** Polígono → atributo `points` de SVG. */
export const pts = (list) => list.map(([x, y]) => `${x},${y}`).join(' ');

/** Exterior visto por la puerta-ventana (cielo, bahía y balcón): la noche lo oscurece más que el interior. */
export const EXTERIOR = [
  [655, 965],
  [655, 330],
  [700, 255],
  [780, 218],
  [860, 228],
  [941, 255],
  [941, 965],
];

/** El astro sobre el cielo libre de la puerta-ventana: sol alto, sol poniente sobre los montes y luna. */
export const SUN_DIAL = { morning: { x: 800, y: 345 }, sunset: { x: 836, y: 470 }, night: { x: 790, y: 352 } };

/** Lámpara de latón del estante izquierdo: bombilla (ancla de la luz) y pantalla. */
export const LAMP = { x: 75, y: 578, shade: { x: 23, y: 497, w: 105, h: 96 } };
/** Vela de la mesita: punta de la llama y tarro. */
export const CANDLE = { x: 798, y: 1166, jar: { x: 777, y: 1176, w: 42, h: 56 } };

/**
 * Pantalla del portátil (SPEC §20.1): las cuatro esquinas INTERIORES del bisel (TL, TR, BR, BL), medidas con
 * rejilla sobre la ilustración. Toda la pantalla se enciende; la planta y el vaso, que están delante, vuelven a
 * pintarse encima con `LAPTOP_FOREGROUND` (un recorte de la propia ilustración), así que no hay que encoger el
 * contenido para esquivarlos.
 */
export const LAPTOP_SCREEN = [[762, 998], [905, 1023], [872, 1149], [732, 1114]];
/** Lo que queda delante de la pantalla (monstera, florero y vaso de té), recortado de la ilustración con alfa. */
export const LAPTOP_FOREGROUND = { src: asset('images/laptop-foreground.png'), x: 725, y: 990, w: 216, h: 172 };

/** Interior del vaso de té helado (se vacía con el temporizador): bordes izquierdo y derecho a cada altura. */
export const TEA_LIQUID = {
  x: 820,
  w: 72,
  top: 1114,
  bottom: 1208,
  shape: [[824, 1112], [889, 1112], [884, 1208], [831, 1208]],
  edgesAt: (y) => {
    const t = (y - 1112) / 96;
    return [824 + 7 * t, 889 - 5 * t];
  },
};

/**
 * Baldas útiles del mueble (cuadriláteros TL, TR, BR, BL, de la cara del fondo al canto del tablón): el hueco
 * derecho tiene cuatro baldas en perspectiva. Las dos de arriba son la vitrina de figuras; las dos de abajo,
 * los libros. El hueco izquierdo lo ocupa la lámpara.
 */
export const ROOM_SHELVES = [
  { id: 'top', quad: [[127, 165], [328, 250], [328, 382], [127, 297]], width: 205, height: 132 },
  { id: 'middle', quad: [[127, 318], [328, 402], [328, 547], [127, 486]], width: 205, height: 150 },
  // 1.25.0: borde derecho medido de nuevo sobre el canto del tablón (estaba 12 px alto)
  { id: 'cabinet', quad: [[127, 504], [328, 562], [328, 682], [127, 650]], width: 205, height: 130 },
  { id: 'cabinet2', quad: [[127, 666], [328, 688], [328, 797], [127, 800]], width: 205, height: 120 },
];

/** Objetos interactivos: contorno medido del botón, ancla de la etiqueta y de la insignia de guía. */
export const HOTSPOTS = {
  book: {
    shape: [[335, 1343], [460, 1338], [550, 1390], [640, 1366], [700, 1380], [830, 1428], [845, 1440], [875, 1652], [800, 1662], [470, 1585], [300, 1540], [250, 1500], [225, 1458]],
    label: { x: 560, y: 1330 },
    badge: { x: 700, y: 1450 },
  },
  // Las dos baldas de arriba del hueco derecho: la vitrina de figuras (→ El Ático)
  figures: {
    shape: [[118, 136], [342, 230], [342, 552], [118, 492]],
    label: { x: 230, y: 160 },
    badge: { x: 300, y: 300 },
  },
  // El resto del mueble: la librería (los libros y la vitrina tienen sus propios botones por encima)
  shelf: {
    shape: [[0, 60], [118, 120], [118, 492], [342, 552], [342, 1000], [200, 1040], [0, 960]],
    label: { x: 200, y: 840 },
    badge: { x: 60, y: 760 },
    // Acceso «Mi biblioteca» (1.48): colgado del frente de la balda de los libros, que baja de (126, 648) a (328, 678)
    plaque: { x: 128, y: 653, angle: 8.4 },
  },
  laptop: {
    shape: [[757, 988], [908, 1010], [895, 1140], [860, 1175], [760, 1200], [606, 1150], [640, 1130], [722, 1118]],
    label: { x: 800, y: 975 },
    badge: { x: 760, y: 1060 },
    // Acceso «Mi diario» (1.48): colgado del borde de la mesa junto al portátil, que baja ≈ 12° hacia la derecha
    plaque: { x: 628, y: 1222, angle: 12 },
  },
  headphones: {
    shape: [[22, 1330], [60, 1295], [140, 1280], [200, 1290], [235, 1320], [248, 1370], [235, 1415], [180, 1428], [140, 1410], [80, 1400], [25, 1385]],
    label: { x: 130, y: 1268 },
    badge: { x: 200, y: 1330 },
  },
  // Vaso de té helado: el temporizador
  tray: {
    shape: [[818, 1090], [895, 1090], [890, 1222], [822, 1222]],
    label: { x: 858, y: 1078 },
    badge: { x: 880, y: 1140 },
  },
  lamp: {
    shape: [[0, 470], [70, 470], [92, 505], [128, 568], [128, 597], [24, 597], [0, 582]],
    label: { x: 75, y: 465 },
    badge: { x: 110, y: 540 },
  },
  // Vela de la mesita (id histórico «lantern» para no romper consumidores)
  lantern: {
    shape: [[780, 1158], [816, 1158], [822, 1176], [834, 1214], [834, 1242], [762, 1242], [762, 1214], [774, 1176]],
    label: { x: 798, y: 1146 },
    badge: { x: 760, y: 1200 },
  },
};

/**
 * Páginas del libro abierto (TL, TR, BR, BL) con sus márgenes impresos: cada una tiene su quad y nada cruza el
 * pliegue central (de (548, 1388) a (460, 1560)). Izquierda: lámina con la portada; derecha: «Tu lectura».
 */
// 1.26.0: área imprimible medida de nuevo sobre la rejilla (papel: izquierda (352,1340)–(546,1388)–(462,1562)–
// (228,1474); derecha (552,1390)–(807,1404)–(823,1598)–(467,1564)), con márgenes hacia el pliegue y los bordes
export const BOOK_LEFT_PAGE = [[366, 1354], [524, 1395], [446, 1548], [252, 1478]];
export const BOOK_RIGHT_PAGE = [[576, 1404], [794, 1417], [806, 1584], [500, 1556]];

/** Canto delantero de las baldas de libros: un hilo de la propia ilustración tapa la base de los lomos. */
export const SHELF_LIPS = {
  cabinet: [[124, 646], [330, 680], [330, 686], [124, 652]],
  cabinet2: [[124, 796], [330, 794], [330, 800], [124, 802]],
};

/** Aire delante de la puerta-ventana donde flotan motas de polvo a la luz del día. */
export const DUST_REGION = { x: 470, y: 430, w: 170, h: 520 };

/**
 * Siluetas de los objetos sueltos (halo dorado al señalar): las mismas medidas que sus hotspots, en ruta SVG.
 */
const path = (shape) => `M${shape.map(([x, y]) => `${x} ${y}`).join(' L')} Z`;
export const SILHOUETTES = {
  book: path(HOTSPOTS.book.shape),
  laptop: path(HOTSPOTS.laptop.shape),
  headphones: path(HOTSPOTS.headphones.shape),
  tray: path(HOTSPOTS.tray.shape),
};

/** Recortes de la madera del mueble para la librería de roble (canto de balda y poste entre huecos). */
export const WOOD_PLANK = { x: 132, y: 800, w: 196, h: 14 };
export const WOOD_SIDE = { x: 106, y: 160, w: 16, h: 300 };
