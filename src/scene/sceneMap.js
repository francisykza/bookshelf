// Mapa de la ilustración (SPEC §2.1): todas las medidas en píxeles de `cozy-book-room.png` (984 × 1599).
// El escenario escala un lienzo de ese tamaño, así que cada capa usa directamente estas coordenadas.

export const SCENE_W = 984;
export const SCENE_H = 1599;
export const SCENE_SRC = '/cozy-book-room.png';

/** Polígono → atributo `points` de SVG. */
export const pts = (list) => list.map(([x, y]) => `${x},${y}`).join(' ');

/** La bahía: agua azul entre el pueblo, el horizonte y la barandilla del balcón. */
export const SEA = [
  [702, 622],
  [727, 611],
  [905, 611],
  [905, 752],
  [813, 758],
  [497, 765],
  [497, 711],
  [582, 698],
  [727, 686],
  [723, 647],
];

/** Franja del mar donde el sol de la mañana cae de lleno (más destellos). */
export const SUN_PATH = { x: 760, y: 612, w: 145, h: 140 };

/** Cielo libre de flores y hojas (gaviotas, estrellas, luna). */
export const SKY = { x: 500, y: 300, w: 450, h: 270 };
export const MOON = { x: 772, y: 236, r: 17 };
/** El astro que cambia la hora: sol alto, sol poniente sobre los montes y luna. */
export const SUN_DIAL = { morning: { x: 772, y: 236 }, sunset: { x: 866, y: 528 }, night: { x: 772, y: 236 } };

/** Pueblo de la costa y orilla de enfrente: ventanas que se encienden al anochecer. */
export const TOWN = { x: 430, y: 612, w: 295, h: 88 };
export const FAR_COAST = { x: 727, y: 598, w: 200, h: 14 };

/** Zonas que se mecen con la brisa. */
export const IVY_REGION = { x: 120, y: 0, w: 135, h: 640 };
/** Cortina blanca de gasa junto a la ventana (se mece con la hiedra que la cruza). */
export const CURTAIN_REGION = { x: 255, y: 0, w: 78, h: 648 };
/** Plantas y flores que la brisa mueve dentro de la habitación y en el balcón. */
export const PLANTS = {
  left: { x: 0, y: 495, w: 118, h: 268 },
  desk: { x: 256, y: 650, w: 172, h: 152 },
  balconyLeft: { x: 484, y: 782, w: 68, h: 180 },
  balconyRight: { x: 684, y: 782, w: 126, h: 92 },
  vase: { x: 906, y: 572, w: 78, h: 122 },
  monstera: { x: 756, y: 955, w: 228, h: 250 },
};
/** Lámpara colgante: se balancea desde el punto donde cuelga. */
export const LAMP_SWING = { x: 0, y: 318, w: 112, h: 136, pivotX: 46, pivotY: 322 };
/** Tapa del portátil (brillo que la recorre) y vaso de té (burbujas). */
export const LAPTOP_LID = [[452, 1062], [724, 1050], [724, 1286], [512, 1240], [452, 1238]];
export const TEA_GLASS = { x: 744, y: 1180, w: 72, h: 145 };
/** Interior del vaso de té (se vacía con el temporizador): bordes izquierdo y derecho que se estrechan. */
export const TEA_LIQUID = {
  x: 724,
  w: 108,
  top: 1156,
  bottom: 1328,
  shape: [[724, 1148], [836, 1148], [826, 1330], [732, 1330]],
  edgesAt: (y) => {
    const t = (y - 1148) / 182;
    return [724 + 8 * t, 836 - 10 * t];
  },
};

/** Nubes sobre los montes: se hinchan y deshilachan despacio. */
export const CLOUD_REGION = { x: 480, y: 405, w: 358, h: 170 };
/** Tazas humeantes: mesita del balcón y mesa de la derecha. */
export const STEAM = [
  { x: 719, y: 884 },
  { x: 929, y: 692 },
];
/** Velero que cruza la bahía. */
export const BOAT_LANE = { from: 735, to: 900, y: 700 };
export const FLOWER_REGION = { x: 410, y: 0, w: 574, h: 340 };
export const RIGHT_VINES = { x: 840, y: 90, w: 144, h: 480 };
export const CHIME = { x: 846, y: 24, w: 70, h: 296, anchorX: 880, anchorY: 32 };

/** Exterior visto por las ventanas (la noche lo oscurece con la llave de azules). */
export const EXTERIOR = [
  [315, 170],
  [470, 120],
  [984, 0],
  [984, 820],
  [880, 800],
  [800, 780],
  [600, 790],
  [470, 780],
  [440, 700],
  [315, 690],
];

/** Luces cálidas que se encienden de noche. */
export const LAMP = { x: 39, y: 436, shade: { x: 0, y: 362, w: 104, h: 84 } };
export const LANTERN = { x: 458, y: 826 };
export const DESK_CANDLE = { x: 84, y: 754 };

/** Baldas pintadas de la pared izquierda: cuadriláteros TL, TR, BR, BL donde caben los libros. */
export const ROOM_SHELVES = [
  // 1.15.0: las dos baldas superiores enteras (la alta y la del cuadro del gato), medidas sobre la rejilla
  { id: 'top', quad: [[0, 42], [204, 112], [204, 212], [0, 148]], width: 204, height: 104 },
  { id: 'middle', quad: [[0, 172], [204, 232], [204, 346], [0, 306]], width: 204, height: 122 },
  { id: 'cabinet', quad: [[103, 663], [227, 655], [227, 768], [103, 771]], width: 126, height: 110 },
];
/** Zona de la estantería (clic → SHELF_VIEW) y de la capa de oclusión frontal. */
export const SHELF_AREA = { x: 0, y: 0, w: 262, h: 830 };

/** Objetos interactivos de la cama: contorno del botón y ancla de la etiqueta. */
export const HOTSPOTS = {
  book: {
    shape: [[162, 1330], [392, 1298], [600, 1296], [708, 1432], [430, 1488], [200, 1452]],
    label: { x: 430, y: 1290 },
    badge: { x: 612, y: 1318 },
  },
  // 1.14.0: el tercio alto del mueble es la vitrina de figuras (→ El Ático); el resto, la librería
  figures: {
    shape: [[0, 0], [250, 0], [254, 322], [206, 350], [0, 310]],
    label: { x: 120, y: 330 },
    badge: { x: 60, y: 120 },
  },
  shelf: {
    shape: [[0, 310], [206, 350], [254, 322], [262, 640], [240, 830], [0, 830]],
    label: { x: 170, y: 560 },
    badge: { x: 60, y: 560 },
  },
  laptop: {
    shape: [[443, 1060], [728, 1046], [728, 1290], [300, 1296], [298, 1238], [442, 1232]],
    label: { x: 590, y: 1040 },
    badge: { x: 706, y: 1068 },
  },
  headphones: {
    shape: [[0, 1380], [180, 1372], [312, 1440], [316, 1599], [0, 1599]],
    label: { x: 170, y: 1366 },
    badge: { x: 262, y: 1430 },
  },
  tray: {
    shape: [[604, 1312], [718, 1146], [840, 1146], [984, 1235], [984, 1510], [604, 1380]],
    label: { x: 800, y: 1136 },
    badge: { x: 868, y: 1196 },
  },
  lamp: {
    shape: [[0, 336], [58, 330], [106, 392], [108, 450], [0, 456]],
    label: { x: 74, y: 334 },
    badge: { x: 96, y: 372 },
  },
  lantern: {
    shape: [[430, 786], [486, 786], [488, 868], [428, 868]],
    label: { x: 458, y: 776 },
    badge: { x: 494, y: 800 },
  },
  chime: {
    shape: [[858, 28], [902, 28], [904, 312], [856, 312]],
    label: { x: 880, y: 330 },
    badge: { x: 920, y: 140 },
  },
};

/** Esquina de la página derecha del libro abierto que levanta la brisa. */
export const PAGE_CORNER = { x: 707, y: 1430 };

/** Gato pintado: recorte para la marioneta y puntos de oreja y cola. */
export const PAINTED_CAT = {
  x: 0,
  y: 1030,
  w: 400,
  h: 150,
  ear: { x: 330, y: 1060, w: 44, h: 36, pivotX: 350, pivotY: 1092 },
  tail: { x: 0, y: 1052, w: 54, h: 70, pivotX: 54, pivotY: 1090 },
  heart: { x: 340, y: 1060 },
  // 1.11.0: la cabeza se recorta aparte para que Miel la levante o se asome al libro
  head: { x: 280, y: 1058, w: 122, h: 116, pivotX: 292, pivotY: 1142 },
  eyes: [
    { x: 320, y: 1130, r: -4 },
    { x: 356, y: 1135, r: 8 },
  ],
  neck: { x: 292, y: 1153 },
  paw: { x: 404, y: 1150 },
  // Patitas delanteras (amasar y zarpazo) y boca (bostezo)
  paws: { x: 360, y: 1142, w: 46, h: 38, pivotX: 366, pivotY: 1172 },
  mouth: { x: 340, y: 1158 },
};

/** Recortes de la textura de madera y de las postales para la librería de roble. */
export const WOOD_PLANK = { x: 40, y: 806, w: 300, h: 26 };
export const WOOD_SIDE = { x: 228, y: 230, w: 26, h: 420 };
export const POSTCARDS = [
  { x: 103, y: 352, w: 52, h: 62 },
  { x: 154, y: 368, w: 34, h: 42 },
  { x: 86, y: 470, w: 56, h: 68 },
  { x: 140, y: 515, w: 38, h: 46 },
  { x: 0, y: 470, w: 22, h: 52 },
  { x: 86, y: 224, w: 52, h: 74 },
];

/**
 * Siluetas exactas de los objetos sueltos de la cama (SPEC §3.2, 1.8.0): al pasar el ratón el objeto
 * pintado se aviva con un halo dorado que sigue su contorno y crece un 5 %. Rutas en px de la imagen.
 */
export const SILHOUETTES = {
  book: 'M163 1332 L176 1306 L384 1290 L478 1285 L607 1300 L700 1444 L496 1475 L312 1480 L232 1424 L172 1362 Z',
  laptop: 'M487 1093 L723 1059 L694 1246 L448 1287 L343 1278 L300 1240 L307 1212 L462 1203 Z',
  headphones:
    'M6 1470 L20 1420 L70 1388 L130 1375 L200 1376 L265 1390 L300 1418 L316 1460 L312 1530 L290 1560 L262 1576 L240 1599 L80 1599 L62 1562 L20 1502 Z',
  tray:
    'M722 1150 L797 1149 L806 1098 L814 1100 L808 1149 L836 1148 L830 1330 L812 1342 L745 1342 L726 1330 Z ' +
    'M832 1262 L905 1245 L984 1252 L984 1340 L935 1352 L870 1348 L840 1320 Z',
};

/** Página derecha del libro abierto (TL, TR, BR, BL): ahí descansa el marcapáginas con tu lectura. */
export const BOOK_PAGE = [[500, 1300], [598, 1306], [672, 1428], [512, 1458]];
/** Tapa del portátil (TL, TR, BR, BL): el post-it con la racha va pegado en su esquina. */
export const LAPTOP_LID_QUAD = [[487, 1093], [723, 1059], [694, 1246], [441, 1237]];
/** Primer plano (cama, portátil, libro, bandeja y monstera): la capa que más se mueve en el parallax. */
export const FRONT = [
  [0, 850], [120, 880], [220, 945], [310, 1005], [400, 1040], [480, 1062], [600, 1050],
  [730, 1040], [750, 940], [984, 930], [984, 1599], [0, 1599],
];
