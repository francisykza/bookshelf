// El interior del piso en primera persona (piloto, solo en el laboratorio). Este módulo es el único que importa Three.js
// y se carga bajo demanda al cruzar la puerta. No tiene modelos propios: lee las mismas cajas de `furniture.js` y las
// mismas coordenadas, giros y colores del `layout` que dibuja `render.js`, así que lo que mueves en el editor es lo que
// ves aquí. La geometría de cada pieza del catálogo se comparte entre pisos; lo demás (materiales, texturas, luces y el
// lienzo) es de cada montaje y `destroy()` lo libera. Solo se dibuja cuando algo cambia.
import { Sprite, SpriteMaterial, AmbientLight, Box3, BoxGeometry, BufferGeometry, CanvasTexture, Color, DirectionalLight, DoubleSide, Float32BufferAttribute, Group, HemisphereLight, LinearFilter, Matrix4, Mesh, MeshBasicMaterial, MeshLambertMaterial, NearestFilter, PerspectiveCamera, PlaneGeometry, PointLight, Raycaster, RepeatWrapping, SRGBColorSpace, Scene, Vector2, Vector3, WebGLRenderer } from 'three';
import { PAREDES, catalogItem } from '../edificio/catalog';
import { shapeOf } from '../edificio/furniture';
import { tintar } from '../edificio/acabados';
import { misticoOf, misticoSprite } from '../edificio/misticos';
import { ROOM, heightOf, itemsOn, rectOf } from '../edificio/room';
import { essentialItems, mainShelf, readingTable } from './essentials';
import { asientoDe } from '../edificio/esenciales';
import { EFECTOS_APAGADOS, isRetirado, tieneVida } from '../edificio/retirados';
import { bookDims, wrapTitle } from './bookLayout';
import { paintExterior } from './exterior';
import { LAYERS, WATER_FRAMES, WATER_MS, PX_PER_CELL, layerMargins, layerPlane, rowOf } from './exteriorLayout';
import { BALDA, baldaShadowTexture, bookTexture, contactShadowTexture, floorTexture, footShadowTexture, grainTexture, lampTexture, pixelBook, pixelLamp, pixelTable, pixelWindow, shelfTexture, sillShadowTexture, tableTexture, upholsteredArmchair, upholsteryTexture, wallPlates, wallTexture, windowTexture, woodShelf, computerTexture, doorTexture, drawerTexture, pixelComputer, pixelDoor } from './materials';

/** Ojos de una persona sentada: un poco por encima del respaldo del sillón (1,75 celdas, furniture.js). */
export const EYE = 1.85;
const FOV = 72;
/** Dónde te sientas, en coordenadas del sillón: pegado al respaldo y arrimado a un brazo, para verlo en primer plano. */
const SEAT = { lx: 0.35, ly: 0.375 };
/** Cabeza algo baja y girada hacia el centro de la habitación: menos techo y más mesa. */
/** Cuánto se espera a la cubierta para enseñar ya el piso con ella; si tarda más, llega después. */
const COVER_WAIT = 2200;
const TILT = 0.215;
const TURN = 0.06;
const ART_W = 320;
const YAW_MAX = 0.6;
/** Hasta dónde se puede girar si hace falta para ver un esencial. Más allá, el respaldo del sillón: se llega por el menú. */
const YAW_REACH = 2.6;
/** Con la mirada en la balda, lo que se deja libre: los lados y la barra de arriba, en px. */
// Abajo, sitio para la tarjeta del libro elegido, que no tape los lomos
const ROW_MARGIN = { side: 12, top: 66, bottom: 84 };
/** Radio del dedo: un toque que cae justo al lado de un mueble lo sigue eligiendo. */
const FINGER = 14;
const MAX_LAMPS = 4;
const TABLES = new Set(['mesa-baja', 'mesilla', 'mesa']);
/** Las mesas de tablero y patas, dibujadas en píxel; la mesilla, que es un mueble cerrado, sigue con su veta. */
const PIXEL_TABLES = new Set(['mesa-baja', 'mesa', 'escritorio']);
/** Piezas con su propio dibujo, más abajo. */
const OWN_PIECES = new Set(['ventana', 'ordenador', 'puerta-piso']);
/** El libro se deja algo girado respecto a quien lo mira: se ven el pie, las hojas y el lomo, y la portada se sigue leyendo. */
const BOOK_TURN = 0.5;
/** Inclinarse sobre el libro: breve y sin perderlo de vista. */
const LEAN = 0.34;
const LEAN_MS = 280;
/** Lo que se espera a que el navegador devuelva el contexto de la GPU antes de renunciar. */
const RESTORE_MS = 3000;
const BOOK_SHADOW = 0.045;
/** El ancho de la vista no depende de lo alta que sea la pantalla: lo que sobra de alto, se ve de más arriba y abajo. */
const WIDE_ASPECT = 0.586;
const PANE = { x0: 0.2, x1: 1.8, z0: 1.5, z1: 3.2 };
/** Por encima de esto, una ventana no se ve nunca desde el sillón y no se pinta su exterior (grados a cada lado de la mirada). */
const REACH_MARGIN = 0.75;
/** Las cajas de `bookcase` que son armazón; el resto, sus libros de adorno. */
const SHELF_FRAME = 7;
/** Cada balda se mira desde la dirección del sillón: se acerca sin rodeos y se ve el lateral con su reflejo. De abajo arriba. */
// De cerca (1.88): la balda y sus libros en el centro, casi de frente; el recorrido empieza cerca y se aleja lo justo
const ROW_VIEW = { x: 1.08, y: 0.9, dist: 2.25, near: 0.9, side: 0.22, rows: [{ z: 0.56, up: 0.62 }, { z: 1.66, up: 0.2 }, { z: 2.76, up: 0.12 }] };
const ROW_FLOOR = [0.14, 1.24, BALDA.z1];
const TWEEN_MS = 680;
/** Un toque: el dedo apenas se mueve y se levanta pronto. Lo demás es girar o una pulsación que no pide nada. */
const TAP_SLOP = 8;
const TAP_MS = 450;
const PULL = 0.15;
const COVER_TURN = -0.2;
const MOTION = '(prefers-reduced-motion: reduce)';
const reduced = () => typeof matchMedia === 'function' && matchMedia(MOTION).matches;

const linear = ([r, g, b]) => new Color().setRGB(r / 255, g / 255, b / 255, SRGBColorSpace);

// Las seis caras de una caja: mundo de la app (x, y a lo hondo, z arriba) → Three (x, z, y)
function pushBox(out, [x0, y0, z0, x1, y1, z1], color) {
  const faces = [
    [[x0, z0, y1], [x1, z0, y1], [x1, z1, y1], [x0, z1, y1], [0, 0, 1]],
    [[x1, z0, y0], [x0, z0, y0], [x0, z1, y0], [x1, z1, y0], [0, 0, -1]],
    [[x1, z0, y1], [x1, z0, y0], [x1, z1, y0], [x1, z1, y1], [1, 0, 0]],
    [[x0, z0, y0], [x0, z0, y1], [x0, z1, y1], [x0, z1, y0], [-1, 0, 0]],
    [[x0, z1, y1], [x1, z1, y1], [x1, z1, y0], [x0, z1, y0], [0, 1, 0]],
    [[x0, z0, y0], [x1, z0, y0], [x1, z0, y1], [x0, z0, y1], [0, -1, 0]],
  ];
  for (const [a, b, c, d, n] of faces) {
    for (const p of [a, b, c, a, c, d]) {
      out.pos.push(...p);
      out.nor.push(...n);
      out.col.push(color.r, color.g, color.b);
    }
  }
}

function geometryOf(boxes) {
  const solid = { pos: [], nor: [], col: [] };
  const glow = { pos: [], nor: [], col: [] };
  for (const box of boxes) pushBox(box.glow ? glow : solid, box.b, linear(box.c));
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute([...solid.pos, ...glow.pos], 3));
  g.setAttribute('normal', new Float32BufferAttribute([...solid.nor, ...glow.nor], 3));
  g.setAttribute('color', new Float32BufferAttribute([...solid.col, ...glow.col], 3));
  g.addGroup(0, solid.pos.length / 3, 0);
  g.addGroup(solid.pos.length / 3, glow.pos.length / 3, 1);
  return g;
}

/** Deshace `turned` para un punto: de relativas al mueble a sus coordenadas locales. */
function unturned(cat, rot, x, y) {
  const { w, d } = cat;
  if (rot === 1) return [y, d - x];
  if (rot === 2) return [w - x, d - y];
  if (rot === 3) return [w - y, x];
  return [x, y];
}

/** Locales → relativas al mueble, igual que `toWorld` de render.js (cuartos de vuelta, sin girar la malla). */
function turned(cat, rot, b) {
  const { w, d } = cat;
  const at = (lx, ly) => {
    if (rot === 1) return [d - ly, lx];
    if (rot === 2) return [w - lx, d - ly];
    if (rot === 3) return [ly, w - lx];
    return [lx, ly];
  };
  const p = at(b[0], b[1]);
  const q = at(b[3], b[4]);
  return [Math.min(p[0], q[0]), Math.min(p[1], q[1]), b[2], Math.max(p[0], q[0]), Math.max(p[1], q[1]), b[5]];
}

// Geometría del catálogo, compartida: una por pieza, tono y giro. La memoria de la tarjeta se libera al salir; estos
// datos se quedan para la siguiente entrada y su número lo acota el catálogo, no las visitas.
const shared = new Map();

function catalogGeometry(item, cat, ownBooks = false) {
  const placing = cat.capa === 'pared' ? item.pared : item.rot;
  const key = `${item.id}|${item.tono}|${item.acabado ?? ''}|${placing}|${ownBooks}`;
  if (!shared.has(key)) {
    // Con acabado, la misma pieza con su piel: cada color pasa por `tintar`, como en render.js (1.88.2)
    const tono = tintar(cat.tonos[item.tono], item.acabado);
    let boxes = cat.capa === 'alfombra' ? [{ b: [0, 0, 0, cat.w, cat.d, 0.05], c: tono }] : shapeOf(item.id, tono);
    if (item.acabado) boxes = boxes.map((box) => ({ ...box, c: tintar(box.c, item.acabado) }));
    // El armazón va aparte, con su madera; en la balda de la lámpara, tus libros en vez de los de adorno
    if (item.id === 'estanteria') boxes = ownBooks ? [] : boxes.slice(SHELF_FRAME);
    if (item.id === 'sillon') {
      shared.set(key, upholsteredArmchair(tono, (b) => turned(cat, item.rot, b), (x, y) => unturned(cat, item.rot, x, y)));
      return shared.get(key);
    }
    if (item.id === 'lampara-pie') {
      shared.set(key, pixelLamp((b) => turned(cat, item.rot, b)));
      return shared.get(key);
    }
    const placed = boxes.map((box) => {
      if (cat.capa !== 'pared') return { ...box, b: turned(cat, item.rot, box.b) };
      const [x0, y0, z0, x1, y1, z1] = box.b;
      return { ...box, b: item.pared === 'fondo' ? box.b : [y0, x0, z0, y1, x1, z1] };
    });
    shared.set(key, geometryOf(placed));
  }
  return shared.get(key);
}

/** La vista desde el sillón: mira hacia donde mira su frente (y = d en sus coordenadas), como en `toWorld` de render.js. */
function seatView(seat) {
  // Pegado al respaldo y arrimado a un brazo, en proporción: el sillón da 0,7 y 0,75; un sofá o una mecedora, lo suyo
  const cat = catalogItem(seat.id);
  const lx = cat.w * SEAT.lx;
  const ly = cat.d * SEAT.ly;
  const [a, b] = turned(cat, seat.rot, [lx, ly, 0, lx, ly, 0]);
  const facing = [[0, 1], [-1, 0], [0, -1], [1, 0]][seat.rot];
  const dir = new Vector3(facing[0], -TILT, facing[1]).applyAxisAngle(new Vector3(0, 1, 0), TURN);
  return { pos: new Vector3(seat.x + a, EYE, seat.y + b), dir, side: new Vector3(-facing[1], 0, facing[0]) };
}

function wallSegments(length, panes) {
  // Trozos de pared alrededor de los huecos de las ventanas: [s0, s1, z0, z1]
  const out = [];
  let s = 0;
  for (const p of [...panes].sort((a, b) => a.a - b.a)) {
    const s0 = p.a + PANE.x0;
    const s1 = p.a + PANE.x1;
    out.push([s, s0, 0, ROOM.wallH], [s0, s1, 0, PANE.z0], [s0, s1, PANE.z1, ROOM.wallH]);
    s = s1;
  }
  out.push([s, length, 0, ROOM.wallH]);
  return out;
}

/** Luz de cada hora. La inicial, 'tarde', es la de la fachada: se sale del portal y se entra a la misma hora. */
const LIGHT = {
  tarde: { hemi: 1, hemiColor: '#f4e2dc', ambient: 0.16, sun: 0.62, sunColor: '#ffc4a4', lamp: 3, clear: '#d68078', fabric: '#e6dcda', brass: '#f2d8bc', wood: '#e0c4b4' },
  dia: { hemi: 1.55, hemiColor: '#fff1d6', ambient: 0, sun: 1.35, sunColor: '#ffe6bf', lamp: 1.5, clear: '#b8d5e2', fabric: '#ffffff', brass: '#ffffff', wood: '#ffffff' },
  noche: { hemi: 0.5, hemiColor: '#6f7099', ambient: 0.35, sun: 0.1, sunColor: '#ffe6bf', lamp: 6, clear: '#14142a', fabric: '#8a86a0', brass: '#a08878', wood: '#857c98' },
};

/** Una cubierta de tela con el título, como la de un libro sin portada en el resto de la app. Un título largo se reparte y, si hace falta, se corta. */
function clothCover({ title, color }) {
  const c = document.createElement('canvas');
  c.width = 136;
  c.height = 200;
  const g = c.getContext('2d');
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = '#f3e7c8';
  g.lineWidth = 2;
  g.strokeRect(7, 7, c.width - 14, c.height - 14);
  g.fillStyle = '#f3e7c8';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const room = c.width - 28;
  let size = 24;
  let fit = null;
  for (; size >= 13; size -= 2) {
    g.font = `bold ${size}px serif`;
    fit = wrapTitle(title, (text) => g.measureText(text).width <= room, Math.floor((c.height - 34) / (size * 1.16)));
    if (!fit.cut) break;
  }
  size = Math.max(size, 13);
  g.font = `bold ${size}px serif`;
  fit.lines.forEach((line, k) => g.fillText(line, c.width / 2, c.height / 2 + (k - (fit.lines.length - 1) / 2) * size * 1.16));
  return c;
}

/** La cubierta reducida de antemano y con suavizado: se ve pequeña y, si no, sus letras se rompen. */
function coverCanvas(image, width, height) {
  const small = document.createElement('canvas');
  small.width = width;
  small.height = height;
  const g = small.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(image, 0, 0, width, height);
  return small;
}

/**
 * `room`, `piso`: el layout y sus datos. `ventanas`: de `ventanasDe`. `book`: { title, color, thickness, height } de tu
 * lectura actual (en un piso ajeno, null). `shelfBooks`: { cover, rows } con ejemplares reales, de `shelfRows` (la cubierta lleva
 * { id, title, color, thickness, height, coverLoad }; en un piso ajeno, null). Avisa con `onBook()`, `onShelf(balda)`, `onShelfTap()` (de cerca, fuera de un libro) y `onLost()` (se ha perdido la GPU).
 * Lanza un error si no se puede crear WebGL: quien monta ofrece entonces la salida en HTML.
 */
export async function mountInterior(container, { room, piso, ventanas, book = null, shelfBooks = null, hora: startHora = 'tarde', startYaw = 0, onBook = () => {}, onShelf = () => {}, onShelfTap = () => {}, onLost = () => {}, onDesk = null, onDoor = null }) {
  const renderer = new WebGLRenderer({ antialias: false, powerPreference: 'low-power' });
  const canvas = renderer.domElement;
  canvas.className = 'plab-canvas';
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `Interior del piso ${piso.puerta}. Arrastra o usa las flechas para mirar.`);
  renderer.setPixelRatio(1);

  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 80);
  // La cámara sale del sillón real: si lo mueves o lo giras en el editor, te sientas donde esté
  const seat = asientoDe(room);
  const home = seat ? seatView(seat) : piso.mira === 'izq' ? { pos: new Vector3(8.6, EYE, 4.4), dir: new Vector3(-1, -TILT, 0), side: new Vector3(0, 0, -1) } : { pos: new Vector3(2.9, EYE, 8.6), dir: new Vector3(0, -TILT, -1), side: new Vector3(1, 0, 0) };
  // Un esencial puede estar en cualquier sitio: el giro llega hasta él, sea cual sea el reparto de la habitación
  const headingTo = (point) => {
    const to = point.clone().sub(home.pos);
    const a = Math.atan2(home.dir.x, home.dir.z) - Math.atan2(to.x, to.z);
    return Math.atan2(Math.sin(a), Math.cos(a));
  };
  const placeOf = (item) => {
    if (item.pared === 'fondo') return new Vector3(item.a + 1, 1.5, 0.05);
    if (item.pared === 'izq') return new Vector3(0.05, 1.5, item.a + 1);
    const r = rectOf(item);
    return new Vector3((r.x0 + r.x1) / 2, 1, (r.y0 + r.y1) / 2);
  };
  const yawRange = essentialItems(room).reduce(
    ([low, high], item) => {
      const a = Math.max(-YAW_REACH, Math.min(YAW_REACH, headingTo(placeOf(item))));
      return [Math.min(low, a), Math.max(high, a)];
    },
    [-YAW_MAX, YAW_MAX],
  );
  const clampYaw = (value) => Math.max(yawRange[0], Math.min(yawRange[1], value));
  let yaw = clampYaw(startYaw);
  let zoomRow = null;
  let veiled = [];
  let zoom = null; // { pos, target }: mirando una balda de cerca
  let pullRaf = 0;
  let frameHook = null;
  let stale = false;
  let mustDraw = false;
  let lost = false;
  let lostTimer = 0;
  let restores = 0;
  let hora = startHora;
  let raf = 0;
  let tween = 0;
  let destroyed = false;

  const owned = { materials: [], textures: [], geometries: [] };
  const own = (kind, x) => (owned[kind].push(x), x);

  const solid = own('materials', new MeshLambertMaterial({ vertexColors: true }));
  const glow = own('materials', new MeshBasicMaterial({ vertexColors: true }));
  const pick = own('materials', new MeshBasicMaterial({ visible: false }));
  // Tapizado y lámpara ya llevan su luz dibujada: no los toca la luz de la escena, solo un tinte según la hora
  const fabrics = new Map();
  const fabricOf = (tono) => {
    const key = tono.join();
    if (!fabrics.has(key)) fabrics.set(key, own('materials', new MeshBasicMaterial({ vertexColors: true, map: own('textures', upholsteryTexture(tono)) })));
    return fabrics.get(key);
  };
  const lampKits = new Map();
  const lampKit = (tono) => {
    const key = tono.join();
    if (!lampKits.has(key)) {
      const lit = own('textures', lampTexture(tono, true));
      const off = own('textures', lampTexture(tono, false));
      lampKits.set(key, { lit, off, body: own('materials', new MeshBasicMaterial({ map: lit })), shade: own('materials', new MeshBasicMaterial({ map: lit })) });
    }
    return lampKits.get(key);
  };

  // La estancia: suelo, paredes con el hueco de sus ventanas, techo y rodapié
  const wallColor = PAREDES.find((p) => p.id === room.pared)?.color ?? PAREDES[0].color;
  const shell = { pos: [], nor: [], col: [] };
  const wall = linear(wallColor);
  const skirt = linear([110, 78, 54]);
  const panesOf = (pared) => ventanas.filter((v) => v.pared === pared);
  for (const [s0, s1, z0, z1] of wallSegments(ROOM.w, panesOf('fondo'))) pushBox(shell, [s0, -0.14, z0, s1, 0, z1], wall);
  for (const [s0, s1, z0, z1] of wallSegments(ROOM.d, panesOf('izq'))) pushBox(shell, [-0.14, s0, z0, 0, s1, z1], wall);
  pushBox(shell, [ROOM.w, 0, 0, ROOM.w + 0.14, ROOM.d, ROOM.wallH], wall);
  pushBox(shell, [0, ROOM.d, 0, ROOM.w, ROOM.d + 0.14, ROOM.wallH], wall);
  pushBox(shell, [0, 0, ROOM.wallH, ROOM.w, ROOM.d, ROOM.wallH + 0.1], linear(wallColor.map((v) => v * 0.86)));
  // Rodapié con su remate y cornisa discreta, en las cuatro paredes; se interrumpe en la puerta. Geometría fija: no cuesta fotogramas
  const skirtCap = linear([136, 100, 72]);
  const cornice = linear(wallColor.map((v) => v * 0.93));
  const corniceLip = linear(wallColor.map((v) => v * 1.02));
  const doorOf = (pared) => room.items.find((i) => i.id === 'puerta-piso' && i.pared === pared);
  const runs = (length, door) => (door ? [[0, door.a + 0.06], [door.a + 1.94, length]] : [[0, length]]);
  for (const [s0, s1] of runs(ROOM.w, doorOf('fondo'))) {
    pushBox(shell, [s0, 0, 0, s1, 0.05, 0.24], skirt);
    pushBox(shell, [s0, 0, 0.24, s1, 0.065, 0.28], skirtCap);
  }
  for (const [s0, s1] of runs(ROOM.d, doorOf('izq'))) {
    pushBox(shell, [0, s0, 0, 0.05, s1, 0.24], skirt);
    pushBox(shell, [0, s0, 0.24, 0.065, s1, 0.28], skirtCap);
  }
  pushBox(shell, [ROOM.w - 0.05, 0, 0, ROOM.w, ROOM.d, 0.24], skirt);
  pushBox(shell, [ROOM.w - 0.065, 0, 0.24, ROOM.w, ROOM.d, 0.28], skirtCap);
  pushBox(shell, [0, ROOM.d - 0.05, 0, ROOM.w, ROOM.d, 0.24], skirt);
  pushBox(shell, [0, ROOM.d - 0.065, 0.24, ROOM.w, ROOM.d, 0.28], skirtCap);
  for (const box of [[0, 0, ROOM.w, 0.07], [0, 0, 0.07, ROOM.d], [ROOM.w - 0.07, 0, ROOM.w, ROOM.d], [0, ROOM.d - 0.07, ROOM.w, ROOM.d]]) {
    pushBox(shell, [box[0], box[1], ROOM.wallH - 0.12, box[2], box[3], ROOM.wallH], cornice);
  }
  for (const box of [[0, 0.07, ROOM.w, 0.1], [0.07, 0, 0.1, ROOM.d], [ROOM.w - 0.1, 0, ROOM.w - 0.07, ROOM.d], [0, ROOM.d - 0.1, ROOM.w, ROOM.d - 0.07]]) {
    pushBox(shell, [box[0], box[1], ROOM.wallH - 0.05, box[2], box[3], ROOM.wallH], corniceLip);
  }
  const shellGeo = own('geometries', new BufferGeometry());
  shellGeo.setAttribute('position', new Float32BufferAttribute(shell.pos, 3));
  shellGeo.setAttribute('normal', new Float32BufferAttribute(shell.nor, 3));
  shellGeo.setAttribute('color', new Float32BufferAttribute(shell.col, 3));
  scene.add(new Mesh(shellGeo, solid));

  const floorTex = own('textures', floorTexture(room.suelo));
  const floorMat = own('materials', new MeshLambertMaterial({ map: floorTex }));
  const floorGeo = own('geometries', new PlaneGeometry(ROOM.w, ROOM.d));
  const floor = new Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(ROOM.w / 2, 0, ROOM.d / 2);
  scene.add(floor);

  // Los muebles del layout: mismas celdas y giros que la vista isométrica
  const furniture = new Group();
  scene.add(furniture);
  const usedShared = new Set();
  const meshes = [];
  const lamps = [];
  for (const item of room.items) {
    const cat = catalogItem(item.id);
    // La ventana y las mesas tienen su propia pieza, más abajo
    if (!cat || OWN_PIECES.has(item.id) || PIXEL_TABLES.has(item.id) || isRetirado(item.id)) continue;
    const geometry = catalogGeometry(item, cat, item.id === 'estanteria' && Boolean(shelfBooks));
    usedShared.add(geometry);
    const skin = tintar(cat.tonos[item.tono], item.acabado);
    const kit = item.id === 'lampara-pie' ? lampKit(skin) : null;
    const mesh = new Mesh(geometry, item.id === 'sillon' ? fabricOf(skin) : kit ? [kit.body, kit.shade] : [solid, glow]);
    if (cat.capa === 'pared') mesh.position.set(item.pared === 'fondo' ? item.a : 0, 0, item.pared === 'fondo' ? 0 : item.a);
    else mesh.position.set(item.x, heightOf(room, item), item.y);
    mesh.userData = { uid: item.uid, id: item.id, rot: item.rot ?? 0 };
    furniture.add(mesh);
    meshes.push(mesh);
    if (cat.luz && lamps.length < MAX_LAMPS) {
      const [lx, ly, lz] = cat.luz;
      lamps.push({ item, mesh, at: cat.capa === 'pared' ? mesh.position.clone().add(new Vector3(item.pared === 'fondo' ? lx : 0.4, lz, item.pared === 'fondo' ? 0.4 : lx)) : mesh.position.clone().add(new Vector3(lx, lz, ly)) });
    }
  }

  // La estantería lleva su luz dibujada, como el sillón y la lámpara: así la luz del suelo no la quema y sigue igual
  const shelf = mainShelf(room);
  const shelfPoint = (lx, ly, lz) => {
    const cat = catalogItem('estanteria');
    const [a, b] = turned(cat, shelf.rot, [lx, ly, 0, lx, ly, 0]);
    return new Vector3(shelf.x + a, lz, shelf.y + b);
  };
  const woodMats = [];
  const pieceMats = [];
  const tinted = (material) => {
    if (!material.map) material.userData.base = material.color.clone();
    woodMats.push(material);
    return own('materials', material);
  };
  // 1.88.2: los seres del piso, como en el isométrico (`beingsNow` de piso.js): los místicos sobre su peana, la mascota
  // sobre su cojín, los muebles vivos y los destellos de un acabado. Cada uno es su mismo dibujo de pixelfx en un lienzo de
  // 72 px, de pie frente a la cámara, a la escala del piso isométrico (18 px por celda) y en el centro de su mueble, a la
  // altura de lo que lo sostiene (`heightOf`). Leen el piso guardado tal cual: no se guarda ni se cambia nada.
  const beings = [];
  const BEING_W = 72 / 18;
  const BEING_H = 72 / (18 * (Math.sqrt(3) / 2));
  for (const item of room.items) {
    const cat = catalogItem(item.id);
    if (!cat) continue;
    const rc = rectOf(item);
    const cx = (rc.x0 + rc.x1) / 2;
    const cy = (rc.y0 + rc.y1) / 2;
    const wants = [];
    if (!EFECTOS_APAGADOS && item.acabado && cat.capa !== 'pared') wants.push({ id: 'chispas-acabado', z: heightOf(room, item), opts: { acabado: item.acabado, ancho: Math.max(rc.x1 - rc.x0, rc.y1 - rc.y0) }, lit: false });
    if (tieneVida(item)) {
      const lift = cat.vivo ? 0 : cat.mascota ? 0.2 : 0.22;
      wants.push({ id: item.id, z: heightOf(room, item) + lift, opts: { tono: item.tono, flip: cat.mascota || cat.vivo ? item.rot === 1 || item.rot === 2 : false }, lit: Boolean(cat.mascota || cat.vivo) });
    }
    for (const w of wants) {
      if (!misticoOf(w.id)) continue;
      const art = misticoSprite(w.id);
      art.paint(1.3, w.opts);
      const map = own('textures', new CanvasTexture(art.canvas));
      map.magFilter = NearestFilter;
      map.minFilter = NearestFilter;
      map.generateMipmaps = false;
      map.colorSpace = SRGBColorSpace;
      const material = own('materials', new SpriteMaterial({ map, transparent: true, depthWrite: false, alphaTest: 0.02 }));
      // La mascota y lo vivo reciben la luz de la hora, como los muebles; los místicos y los destellos dan la suya
      if (w.lit) tinted(material);
      const sprite = new Sprite(material);
      sprite.center.set(art.ax / 72, 1 - art.ay / 72);
      sprite.scale.set(BEING_W, BEING_H, 1);
      sprite.position.set(cx, w.z, cy);
      sprite.userData = { uid: item.uid, id: w.id, being: true };
      sprite.raycast = () => {};
      scene.add(sprite);
      beings.push({ uid: item.uid, id: w.id, art, map, opts: w.opts, sprite });
    }
  }
  let woodLit = null;
  let woodOff = null;
  let woodMat = null;
  if (shelf) {
    const cat = catalogItem('estanteria');
    const tono = cat.tonos[shelf.tono];
    const lights = lamps.map((l) => {
      const [x, y] = unturned(cat, shelf.rot, l.at.x - shelf.x, l.at.z - shelf.y);
      return { x, y, z: l.at.y };
    });
    woodLit = own('textures', shelfTexture(tono, { lights, lit: true }));
    woodOff = own('textures', shelfTexture(tono, { lights, lit: false }));
    woodMat = tinted(new MeshBasicMaterial({ map: woodLit }));
    const key = `estanteria-armazon|${shelf.rot}`;
    if (!shared.has(key)) shared.set(key, woodShelf((b) => turned(cat, shelf.rot, b)));
    usedShared.add(shared.get(key));
    const frame = new Mesh(shared.get(key), woodMat);
    frame.position.set(shelf.x, heightOf(room, shelf), shelf.y);
    frame.userData = { uid: shelf.uid, id: 'estanteria', rot: shelf.rot ?? 0 };
    furniture.add(frame);
    meshes.push(frame);
    // Su sombra en el suelo, junto a la base: una lámina encima que no cambia el dibujo del suelo
    const [fx0, fy0, , fx1, fy1] = turned(cat, shelf.rot, [0, 0, 0, cat.w, cat.d, 0]);
    const MARGIN = 0.14;
    const foot = new Mesh(own('geometries', new PlaneGeometry(fx1 - fx0 + MARGIN * 2, fy1 - fy0 + MARGIN * 2)), own('materials', new MeshBasicMaterial({ map: own('textures', footShadowTexture(fx1 - fx0, fy1 - fy0, MARGIN)), transparent: true, alphaTest: 0.1, depthWrite: false })));
    foot.rotation.x = -Math.PI / 2;
    foot.position.set(shelf.x + (fx0 + fx1) / 2, heightOf(room, shelf) + 0.004, shelf.y + (fy0 + fy1) / 2);
    foot.userData = { id: 'estanteria' };
    furniture.add(foot);
  }

  // Tus libros (1.88): cada ejemplar es el mismo modelo que el libro de la mesa, de pie, con el lomo hacia ti y la portada
  // real de su edición en la tapa. Tu lectura, de frente en la balda de la lámpara; en las otras, el último se gira para
  // enseñar su portada. La luz es la de la hora, la misma que en la mesa
  const shelfSpots = [];
  // Lo que ocupan los libros de cada balda (en coordenadas de la estantería), para acercarse a ellos y no a la madera vacía
  const rowBoxes = [null, null, null];
  let shelfCoverReal = false;
  // Cuántos ejemplares llevan ya su portada real, y cuántos su lomo auténtico
  let shelfFaces = 0;
  let shelfSpines = 0;
  let shelfCoverReady = Promise.resolve();
  // Lo que se tira y se rehace al cambiar los libros: la memoria de cada tanda no se queda en la tarjeta
  const freshKit = () => ({ materials: [], textures: [], geometries: [], meshes: [] });
  const release = (kit) => {
    for (const m of kit.materials) m.dispose();
    for (const t of kit.textures) t.dispose();
    for (const g of kit.geometries) g.dispose();
  };
  // El libro de la mesa está tumbado (x: ancho, con el lomo en -x; y: grueso, con la tapa arriba; z: largo, el pie en +z).
  // De pie: el ancho va hacia dentro de la balda (el lomo, hacia ti), la tapa mira a +x y la cabeza queda arriba
  const UPRIGHT = new Matrix4().makeBasis(new Vector3(0, 0, -1), new Vector3(1, 0, 0), new Vector3(0, -1, 0));
  const standing = (dims) => {
    const g = pixelBook(dims);
    g.applyMatrix4(UPRIGHT);
    g.translate(-dims.thick / 2, 0, 0);
    return g;
  };
  const SHOW_MS = 420;
  const ease = (v) => {
    const t = Math.max(0, Math.min(1, v));
    return t * t * (3 - 2 * t);
  };
  /** Primero sale entero (lo bastante para girar sin rozar a sus vecinos) y después gira; al volver, al revés. */
  const poseSpot = (s) => {
    if (s.lead) {
      s.hit.position.z = PULL * ease(s.show);
      return;
    }
    // Entero por delante del canto de la estantería (sus laterales llegan a BALDA.front; los libros están en 0,6), con un
    // margen: así gira sin rozar a sus vecinos ni a los laterales
    const out = BALDA.front - 0.6 + 0.03 + s.width / 2 - s.depth;
    // Recto hacia fuera de la balda, aunque el libro esté un poco girado: así no se mete en el sitio de su vecino
    const along = out * ease(s.show / 0.45);
    const turning = ease((s.show - 0.45) / 0.55);
    // Al girar, la tapa quedaría corrida hacia un lado (gira sobre el lomo): ya fuera de la balda, se desliza para que
    // la portada quede delante de su sitio y, en los extremos, dentro de la fila que enseña la cámara
    const box = rowBoxes[s.row];
    const half = s.width / 2;
    const want = box && box.x1 - box.x0 > s.width ? Math.max(box.x0 + half, Math.min(box.x1 - half, s.x)) : s.x;
    s.hit.position.x = -along * Math.sin(s.turn) + (want - s.x + s.depth) * turning;
    s.hit.position.z = along * Math.cos(s.turn);
    s.hit.rotation.y = (-Math.PI / 2 - s.turn) * turning;
  };
  let shelfLayer = null;
  let shelfKit = null;
  const buildShelfBooks = (data) => {
    if (shelfLayer) {
      furniture.remove(shelfLayer);
      release(shelfKit);
      const gone = new Set(shelfKit.meshes);
      for (let k = meshes.length - 1; k >= 0; k -= 1) if (gone.has(meshes[k])) meshes.splice(k, 1);
      for (let k = woodMats.length - 1; k >= 0; k -= 1) if (shelfKit.materials.includes(woodMats[k])) woodMats.splice(k, 1);
    }
    shelfSpots.length = 0;
    rowBoxes.fill(null);
    shelfCoverReal = false;
    shelfFaces = 0;
    shelfSpines = 0;
    shelfCoverReady = Promise.resolve();
    shelfLayer = null;
    shelfKit = null;
    if (!shelf || !data) return;
    const kit = freshKit();
    shelfKit = kit;
    const layer = new Group();
    shelfLayer = layer;
    furniture.add(layer);
    const own = (kind, x) => (kit[kind].push(x), x);
    // Como en la mesa: la textura manda y la hora la tiñe
    const tinted = (material) => {
      woodMats.push(material);
      return own('materials', material);
    };
    const meshesAdd = (mesh) => {
      kit.meshes.push(mesh);
      meshes.push(mesh);
    };
    const canvasTex = (canvas) => {
      const tex = own('textures', new CanvasTexture(canvas));
      tex.colorSpace = SRGBColorSpace;
      tex.minFilter = LinearFilter;
      tex.generateMipmaps = false;
      return tex;
    };
    const base = [0, -Math.PI / 2, Math.PI, Math.PI / 2][shelf.rot ?? 0];
    const lift = heightOf(room, shelf);
    const DEPTH = 0.56;
    const FRONT_Y = 0.6;
    const shadowMap = own('textures', contactShadowTexture());
    const shadowMat = own('materials', new MeshBasicMaterial({ map: shadowMap, color: '#1a0d08', transparent: true, depthWrite: false }));
    const plateOf = (x, z, width, depth, turn = 0) => {
      const plate = new Mesh(own('geometries', new PlaneGeometry(width, depth)), shadowMat);
      plate.rotation.x = -Math.PI / 2;
      plate.rotation.z = base + turn;
      plate.position.copy(shelfPoint(x, FRONT_Y, z + lift + 0.003));
      plate.userData = { id: 'estanteria' };
      layer.add(plate);
    };
    const place = (x, z, height, size, turn) => {
      const group = new Group();
      group.position.copy(shelfPoint(x, FRONT_Y, z + height / 2 + lift));
      group.rotation.y = base + turn;
      // Lo que se toca: [ancho, alto, hondo], con la cara de delante en z = hondo / 2
      group.userData = { size };
      return group;
    };
    /**
     * Un ejemplar de pie con el modelo de la mesa: tela con su título hasta que llega su portada; entonces, la portada en la
     * tapa, la forma de su portada y el lomo (el auténtico si lo hay; si no, reconstruido con sus colores).
     */
    const standingBook = (item, length, thick, width, face) => {
      const dims = { width, length, thick, board: Math.max(0.012, thick * 0.11) };
      const cover = tinted(new MeshBasicMaterial({ map: canvasTex(clothCover(item)) }));
      const pages = tinted(new MeshBasicMaterial({ map: own('textures', bookTexture(item)) }));
      const body = new Mesh(own('geometries', standing(dims)), [pages, cover]);
      body.userData = { id: 'estanteria' };
      const ready = Promise.resolve(face)
        .catch(() => null)
        .then((got) => {
          if (!got || destroyed || shelfKit !== kit) return null;
          if (got.look) {
            pages.map = own('textures', bookTexture({ ...item, look: got.look }));
            pages.needsUpdate = true;
            if (got.look.authentic) shelfSpines += 1;
          }
          if (got.cover) {
            cover.map = canvasTex(got.cover);
            cover.needsUpdate = true;
            shelfFaces += 1;
          }
          invalidate();
          return got;
        });
      return { body, dims, ready };
    };

    // Tu lectura: el mismo ejemplar que en la mesa (medidas, lomo y portada), de pie y de frente
    // En una visita sin libros compartidos no hay cubierta: la estantería se queda vacía
    const c = data.cover;
    const COVER_X = 1.42;
    const coverWidth = c ? bookDims(c).width : 0;
    if (c) {
    const coverDims = bookDims(c);
    const coverThick = coverDims.thick;
    const coverHeight = coverDims.length;
    const coverGroup = place(COVER_X, BALDA.z1, coverHeight, [coverWidth, coverHeight, coverThick], COVER_TURN);
    // Tu lectura, de frente: el mismo libro girado para que su tapa mire hacia ti
    const coverHold = new Group();
    // La portada grande (la de la mesa) y el lomo de su cara: los dos, como en la mesa
    const coverFace = Promise.all([Promise.resolve(c.coverLoad).catch(() => null), Promise.resolve(c.face).catch(() => null)]).then(([image, face]) => (image ? { cover: coverCanvas(image, 180, Math.round(180 / (image.naturalWidth / image.naturalHeight))), aspect: image.naturalWidth / image.naturalHeight, look: face?.look ?? null } : face));
    const lead = standingBook(c, coverHeight, coverThick, coverWidth, coverFace);
    lead.body.rotation.y = -Math.PI / 2;
    coverHold.add(lead.body);
    coverGroup.add(coverHold);
    layer.add(coverGroup);
    plateOf(COVER_X, BALDA.z1, coverWidth + 0.16, coverThick + 0.2, COVER_TURN);
    shelfSpots.push({ id: c.id, row: 2, group: coverGroup, hit: coverHold, lead: true, show: 0, turn: 0, depth: 0, width: coverThick });
    meshesAdd(lead.body);
    rowBoxes[2] = { x0: COVER_X - coverWidth / 2, x1: COVER_X + coverWidth / 2, top: BALDA.z1 + coverHeight };
    shelfCoverReady = lead.ready.then((got) => {
      if (!got?.cover || shelfKit !== kit) return;
      const w = bookDims(c, got.aspect).width;
      lead.body.geometry = own('geometries', standing({ ...lead.dims, width: w }));
      coverGroup.userData.size[0] = w;
      shelfCoverReal = true;
    });
    }

    data.rows.forEach((items, row) => {
      if (!items.length) return;
      const floorZ = ROW_FLOOR[row];
      // Hasta donde llega lo que ocupa el último, girado
      const lastEnd = Math.max(...items.map((i) => i.x + i.w / 2 + (i.extent ?? i.w) / 2));
      // Arriba se arriman a la cubierta
      const shift = row === 2 ? Math.max(0, COVER_X - coverWidth / 2 - 0.05 - (BALDA.x0 + lastEnd)) : 0;
      items.forEach((item) => {
        // Las medidas del ejemplar, las de la mesa (`bookDims`), hasta que su portada le dé la proporción
        const length = Math.min((row === 2 ? BALDA.ceiling - BALDA.z1 : 0.96) - 0.06, item.dims.length);
        const width = item.dims.width;
        const x = BALDA.x0 + shift + item.x + item.w / 2;
        // El de cara se queda en medio de su hueco; los demás, con el lomo a ras del canto de la balda
        const depth = item.display ? 0 : DEPTH / 2 - width / 2;
        const group = place(x, floorZ, length, [item.w, length, item.display ? width : DEPTH], item.turn ?? 0);
        const hold = new Group();
        const made = standingBook(item, length, item.w, width, item.face);
        made.body.position.z = depth;
        hold.add(made.body);
        group.add(hold);
        layer.add(group);
        const spot = { id: item.id, row, group, hit: hold, lead: false, show: 0, turn: item.turn ?? 0, depth, width, x };
        shelfSpots.push(spot);
        meshesAdd(made.body);
        // El libro toma la forma de su portada, sin salirse de la balda
        made.ready.then((got) => {
          if (!got?.aspect || shelfKit !== kit) return;
          const w = Math.min(DEPTH, bookDims(item, got.aspect).width);
          spot.width = w;
          made.body.geometry = own('geometries', standing({ ...made.dims, width: w }));
          if (!item.display) {
            spot.depth = DEPTH / 2 - w / 2;
            made.body.position.z = spot.depth;
          } else group.userData.size[2] = w;
          invalidate();
        });
      });
      const from = BALDA.x0 + shift;
      plateOf(from + lastEnd / 2, floorZ, lastEnd + 0.14, DEPTH + 0.16);
      const first = Math.min(...items.map((i) => i.x + i.w / 2 - (i.extent ?? i.w) / 2));
      const tall = Math.max(...items.map((i) => i.dims.length));
      rowBoxes[row] = { x0: from + first, x1: row === 2 ? COVER_X + coverWidth / 2 : from + lastEnd, top: floorZ + Math.max(tall, row === 2 && c ? bookDims(c).length : 0) };
    });
  };
  buildShelfBooks(shelfBooks);
  // Lo que cada tablón deja en sombra debajo, también sobre los lomos de la balda de abajo
  if (shelf && shelfBooks) {
    const base = [0, -Math.PI / 2, Math.PI, Math.PI / 2][shelf.rot ?? 0];
    const lift = heightOf(room, shelf);
    const fallGeo = own('geometries', new PlaneGeometry(BALDA.x1 - BALDA.x0, 0.3));
    const fallMat = own('materials', new MeshBasicMaterial({ map: own('textures', baldaShadowTexture()), transparent: true, alphaTest: 0.1, depthWrite: false }));
    for (const board of [1.1, BALDA.z0, BALDA.ceiling]) {
      const fall = new Mesh(fallGeo, fallMat);
      fall.position.copy(shelfPoint(1, 0.89, board - 0.15 + lift));
      fall.rotation.y = base;
      fall.userData = { id: 'estanteria' };
      furniture.add(fall);
    }
  }

  // Las mesas: tablero, canto y patas en píxel, con su luz dibujada, y su sombra sobre el suelo. La mesilla, solo la veta
  const tableKits = [];
  for (const item of room.items) {
    if (!PIXEL_TABLES.has(item.id) && !TABLES.has(item.id)) continue;
    const cat = catalogItem(item.id);
    const tono = tintar(cat.tonos[item.tono], item.acabado);
    // Los frentes de los cajones y sus tiradores van pintados, no como patas
    const boxes = shapeOf(item.id, tono).map((box) => (item.acabado ? { ...box, c: tintar(box.c, item.acabado) } : box)).filter((box) => item.id !== 'escritorio' || box.b[4] - box.b[1] > 0.1);
    const top = boxes.reduce((a, b) => (b.b[5] > a.b[5] ? b : a));
    const [x0, y0, , x1, y1, z1] = turned(cat, item.rot, top.b);
    const lift = heightOf(room, item);
    if (PIXEL_TABLES.has(item.id)) {
      const lights = lamps.map((l) => {
        const [lx, ly] = unturned(cat, item.rot, l.at.x - item.x, l.at.z - item.y);
        return { x: lx - top.b[0], y: ly - top.b[1], z: l.at.y - lift - top.b[5] };
      });
      const size = [top.b[3] - top.b[0], top.b[4] - top.b[1]];
      const lit = own('textures', tableTexture(tono, { size, lights, lit: true }));
      const off = own('textures', tableTexture(tono, { size, lights, lit: false }));
      const material = tinted(new MeshBasicMaterial({ map: lit }));
      tableKits.push({ material, lit, off });
      if (item.id === 'escritorio') {
        const front = new Mesh(own('geometries', new PlaneGeometry(0.65, 1)), tinted(new MeshBasicMaterial({ map: own('textures', drawerTexture(tono)) })));
        const [fx, fy] = turned(cat, item.rot, [0.425, 0.905, 0, 0.425, 0.905, 0]);
        front.position.set(item.x + fx, lift + 0.6, item.y + fy);
        front.rotation.y = (-item.rot * Math.PI) / 2;
        furniture.add(front);
      }
      const key = `mesa|${item.id}|${item.rot}`;
      if (!shared.has(key)) shared.set(key, pixelTable(boxes, (b) => turned(cat, item.rot, b)));
      usedShared.add(shared.get(key));
      const mesh = new Mesh(shared.get(key), material);
      mesh.position.set(item.x, lift, item.y);
      mesh.userData = { uid: item.uid, id: item.id, rot: item.rot ?? 0 };
      furniture.add(mesh);
      meshes.push(mesh);
      const MARGIN = 0.12;
      const foot = new Mesh(own('geometries', new PlaneGeometry(x1 - x0 + MARGIN * 2, y1 - y0 + MARGIN * 2)), own('materials', new MeshBasicMaterial({ map: own('textures', footShadowTexture(x1 - x0, y1 - y0, MARGIN)), transparent: true, alphaTest: 0.1, depthWrite: false })));
      foot.rotation.x = -Math.PI / 2;
      // Por encima de una alfombra, si la hay: el suelo de debajo no cambia
      foot.position.set(item.x + (x0 + x1) / 2, lift + 0.056, item.y + (y0 + y1) / 2);
      furniture.add(foot);
      continue;
    }
    const tex = own('textures', grainTexture(tono, item.uid));
    if (y1 - y0 > x1 - x0) {
      tex.center.set(0.5, 0.5);
      tex.rotation = Math.PI / 2;
    }
    const plate = new Mesh(own('geometries', new PlaneGeometry(x1 - x0, y1 - y0)), own('materials', new MeshLambertMaterial({ map: tex })));
    plate.rotation.x = -Math.PI / 2;
    plate.position.set(item.x + (x0 + x1) / 2, lift + z1 + 0.003, item.y + (y0 + y1) / 2);
    plate.userData = { id: item.id };
    furniture.add(plate);
  }

  // Tu lectura actual: sobre la mesa si hay una; si no, en el brazo del sillón
  let bookGroup = null;
  let bookKit = null;
  let tableBook = null;
  let coverReal = false;
  let coverReady = Promise.resolve();
  const buildTableBook = (data) => {
    if (bookGroup) {
      scene.remove(bookGroup);
      for (let k = woodMats.length - 1; k >= 0; k -= 1) if (bookKit.materials.includes(woodMats[k])) woodMats.splice(k, 1);
      release(bookKit);
      const at = meshes.indexOf(bookGroup.userData.hit);
      if (at >= 0) meshes.splice(at, 1);
    }
    bookGroup = null;
    bookKit = null;
    tableBook = data;
    coverReal = false;
    coverReady = Promise.resolve();
    if (!data) return;
    const table = readingTable(room) ?? room.items.find((i) => TABLES.has(i.id));
    const chair = room.items.find((i) => i.id === 'sillon');
    const spot = table ?? chair;
    if (!spot) return;
    const kit = freshKit();
    bookKit = kit;
    const own = (kind, x) => (kit[kind].push(x), x);
    const tinted = (material) => {
      woodMats.push(material);
      return own('materials', material);
    };
    const cat = catalogItem(spot.id);
    const top = table ? (cat.sup ?? 0.7) : 1.12;
    const [bx, bz] = table ? [spot.x + cat.w / 2, spot.y + cat.d / 2] : [spot.x + 0.3, spot.y + 1.2];
    const dims = bookDims(data);
    const group = new Group();
    bookGroup = group;
    group.position.set(bx, top, bz);
    // Se gira respecto a tus ojos, estén donde estén la mesa y el sillón
    group.rotation.y = Math.atan2(home.pos.x - bx, home.pos.z - bz) + BOOK_TURN;
    // Mientras llega la portada, o si no la hay, tela con su título
    const coverTex = own('textures', new CanvasTexture(clothCover(data)));
    coverTex.colorSpace = SRGBColorSpace;
    coverTex.minFilter = LinearFilter;
    coverTex.generateMipmaps = false;
    const coverFace = tinted(new MeshBasicMaterial({ map: coverTex }));
    const pages = tinted(new MeshBasicMaterial({ map: own('textures', bookTexture(data)) }));
    const body = new Mesh(own('geometries', pixelBook(dims)), [pages, coverFace]);
    const hit = new Mesh(own('geometries', new BoxGeometry(dims.width + 0.22, dims.thick + 0.3, dims.length + 0.22)), pick);
    hit.position.y = dims.thick / 2;
    hit.userData = { id: 'libro' };
    body.userData = { id: 'libro' };
    group.userData.hit = hit;
    // Sombra de contacto: sale del propio libro y se tiende un poco hacia ti, porque la luz viene de delante
    const shadow = new Mesh(own('geometries', new PlaneGeometry(1, 1)), own('materials', new MeshBasicMaterial({ map: own('textures', footShadowTexture(dims.width, dims.length, BOOK_SHADOW, 96)), transparent: true, alphaTest: 0.1, depthWrite: false })));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(0.012, 0.004, 0.02);
    const fitShadow = ({ width, length }) => shadow.scale.set(width + BOOK_SHADOW * 2, length + BOOK_SHADOW * 2, 1);
    fitShadow(dims);
    group.add(shadow, body, hit);
    scene.add(group);
    meshes.push(hit);
    // El lomo, el mismo que el de su ejemplar en la estantería: el auténtico si lo hay; si no, reconstruido de su portada
    Promise.resolve(data.face)
      .catch(() => null)
      .then((got) => {
        if (!got?.look || destroyed || bookKit !== kit) return;
        pages.map = own('textures', bookTexture({ ...data, look: got.look }));
        pages.needsUpdate = true;
        invalidate();
      });
    coverReady = Promise.resolve(data.coverLoad).then((image) => {
      if (!image || destroyed || bookKit !== kit) return;
      // El libro toma la forma de su portada
      const fitted = bookDims(data, image.naturalWidth / image.naturalHeight);
      body.geometry = own('geometries', pixelBook(fitted));
      fitShadow(fitted);
      const tex = own('textures', new CanvasTexture(coverCanvas(image, 180, Math.round(180 * (fitted.length / fitted.width)))));
      tex.colorSpace = SRGBColorSpace;
      tex.minFilter = LinearFilter;
      tex.generateMipmaps = false;
      coverFace.map = tex;
      coverFace.needsUpdate = true;
      coverReal = true;
      invalidate();
    });
  };
  buildTableBook(book);

  // Luces: la de la hora, la que entra por la ventana y las lámparas del piso, en su sitio del layout
  const hemi = new HemisphereLight('#fff1d6', '#8a6a52', 1);
  const ambient = new AmbientLight('#8d8ab8', 0);
  const sun = new DirectionalLight('#ffe6bf', 1);
  sun.position.copy(piso.mira === 'izq' ? new Vector3(-6, 7, 3) : new Vector3(3, 7, -6));
  sun.target.position.set(ROOM.w / 2, 0, ROOM.d / 2);
  scene.add(hemi, ambient, sun, sun.target);
  const lampLights = lamps.map((l) => {
    const light = new PointLight('#ffc98a', 1, 9, 2);
    light.position.copy(l.at);
    scene.add(light);
    return light;
  });

  // Las paredes: su color y la luz de las lámparas de este piso, dibujados y a la misma densidad que el suelo
  const WALLS = [
    { pared: 'fondo', length: ROOM.w, h: ROOM.wallH, segments: wallSegments(ROOM.w, panesOf('fondo')), lights: lamps.map((l) => ({ s: l.at.x, z: l.at.y, depth: l.at.z })) },
    { pared: 'izq', length: ROOM.d, h: ROOM.wallH, segments: wallSegments(ROOM.d, panesOf('izq')), lights: lamps.map((l) => ({ s: l.at.z, z: l.at.y, depth: l.at.x })) },
    { pared: 'der', length: ROOM.d, h: ROOM.wallH, segments: wallSegments(ROOM.d, []), lights: lamps.map((l) => ({ s: l.at.z, z: l.at.y, depth: ROOM.w - l.at.x })) },
  ];
  const plates = wallPlates(WALLS);
  const wallLayers = WALLS.map((wallInfo) => {
    const geometry = own('geometries', plates[wallInfo.pared]);
    const material = own('materials', new MeshBasicMaterial({ side: DoubleSide }));
    scene.add(new Mesh(geometry, material));
    return { wallInfo, material, baked: new Map() };
  });
  function paintWalls() {
    for (const layer of wallLayers) {
      if (!layer.baked.has(hora)) layer.baked.set(hora, own('textures', wallTexture(wallColor, { w: layer.wallInfo.length, h: layer.wallInfo.h, lights: layer.wallInfo.lights, hora })));
      layer.material.map = layer.baked.get(hora);
      layer.material.needsUpdate = true;
    }
  }

  // El ordenador del escritorio y la puerta de salida: al tocarlos se abren las herramientas o se vuelve al portal
  const pieceKit = (make) => {
    const lit = own('textures', make(true));
    const off = own('textures', make(false));
    const material = own('materials', new MeshBasicMaterial({ map: lit, side: DoubleSide }));
    material.userData.lit = lit;
    material.userData.off = off;
    woodMats.push(material);
    pieceMats.push(material);
    return material;
  };
  for (const item of room.items) {
    if (item.id !== 'ordenador' && item.id !== 'puerta-piso') continue;
    const tono = catalogItem(item.id).tonos[item.tono];
    const door = item.id === 'puerta-piso';
    const material = pieceKit((lit) => (door ? doorTexture(tono, { lit }) : computerTexture(tono, { lit })));
    // El ordenador mira hacia donde esté girado, dentro de su celda
    const turn = [(a, b) => [a, b], (a, b) => [1 - b, a], (a, b) => [1 - a, 1 - b], (a, b) => [b, 1 - a]][item.rot ?? 0];
    const place = door ? (item.pared === 'fondo' ? (a, b) => [item.a + a, b] : (a, b) => [b, item.a + a]) : turn;
    const mesh = new Mesh(own('geometries', door ? pixelDoor(place) : pixelComputer(place)), material);
    if (!door) mesh.position.set(item.x, heightOf(room, item), item.y);
    mesh.userData = { uid: item.uid, id: item.id };
    furniture.add(mesh);
    meshes.push(mesh);
  }

  // El marco y el alféizar de cada ventana, con su madera y su luz dibujada; bajo el alféizar, su sombra sobre la pared
  const sillShadow = own('materials', new MeshBasicMaterial({ map: own('textures', sillShadowTexture()), transparent: true, alphaTest: 0.1, depthWrite: false }));
  const sillShadowGeo = own('geometries', new PlaneGeometry(1.96, 0.3));
  const frameKits = new Map();
  for (const v of ventanas) {
    const cat = catalogItem('ventana');
    const tono = cat.tonos[v.tono];
    const place = v.pared === 'fondo' ? (a, b) => [v.a + a, b] : (a, b) => [b, v.a + a];
    // De qué lado le llega la lámpara, si hay alguna cerca de esta pared
    const along = (l) => (v.pared === 'fondo' ? l.at.x : l.at.z);
    const near = lamps.find((l) => Math.abs(along(l) - (v.a + 1)) < 4.5);
    const lamp = near ? (along(near) < v.a + 1 ? -1 : 1) : 0;
    const key = `${v.tono}|${lamp}`;
    if (!frameKits.has(key)) {
      const lit = own('textures', windowTexture(tono, { lamp, lit: true }));
      const off = own('textures', windowTexture(tono, { lamp, lit: false }));
      const material = own('materials', new MeshBasicMaterial({ map: lit, side: DoubleSide }));
      material.userData.lit = lit;
      material.userData.off = off;
      woodMats.push(material);
      frameKits.set(key, material);
    }
    scene.add(new Mesh(own('geometries', pixelWindow(place)), frameKits.get(key)));
    const under = new Mesh(sillShadowGeo, sillShadow);
    if (v.pared === 'fondo') under.position.set(v.a + 1, 1.05, 0.006);
    else {
      under.position.set(0.006, 1.05, v.a + 1);
      under.rotation.y = Math.PI / 2;
    }
    scene.add(under);
  }

  // Lo que se ve por cada ventana: tres planos a su distancia, alineados desde el sillón, y un cuarto solo con los brillos del agua
  const outGeo = own('geometries', new PlaneGeometry(1, 1));
  const outside = [];
  const paneOf = (v) => {
    const s0 = v.a + PANE.x0;
    const s1 = v.a + PANE.x1;
    return { s0, s1, z0: PANE.z0, z1: PANE.z1 };
  };
  const wallEye = (v, from) => (v.pared === 'fondo' ? { s: from.x, z: from.y, d: from.z } : { s: from.z, z: from.y, d: from.x });
  const toWorld = (v, s, z, depth) => (v.pared === 'fondo' ? new Vector3(s, z, -depth) : new Vector3(-depth, z, s));
  /** Una ventana que nunca entra en el encuadre desde el sillón no gasta nada: ni texturas, ni el dibujo del hotel. */
  const reachable = (v) => {
    const pane = paneOf(v);
    for (const [s, z] of [[pane.s0, pane.z0], [pane.s1, pane.z0], [pane.s0, pane.z1], [pane.s1, pane.z1]]) {
      const to = (v.pared === 'fondo' ? new Vector3(s, z, 0) : new Vector3(0, z, s)).sub(home.pos);
      const a = Math.atan2(to.x, to.z) - Math.atan2(home.dir.x, home.dir.z);
      const delta = Math.atan2(Math.sin(a), Math.cos(a));
      // `delta` va al revés que el giro: girar a la derecha lo acerca
      if (-delta > yawRange[0] - REACH_MARGIN && -delta < yawRange[1] + REACH_MARGIN) return true;
    }
    return false;
  };
  const horizonInfo = ventanas.map((v) => ({ uid: v.uid, pared: v.pared, vista: v.vista, hotel: v.hotel, horizonY: EYE + v.horizonte, planta: v.planta, painted: false }));
  const pixelTexture = (canvas2d) => {
    const tex = new CanvasTexture(canvas2d);
    tex.colorSpace = SRGBColorSpace;
    tex.magFilter = NearestFilter;
    tex.minFilter = NearestFilter;
    tex.generateMipmaps = false;
    return tex;
  };
  let paintRun = 0;
  let paintMs = 0;
  async function paintWindows() {
    paintRun += 1;
    const run = paintRun;
    const t0 = performance.now();
    for (const v of ventanas) {
      if (!reachable(v)) continue;
      const horizonZ = EYE + v.horizonte;
      const art = await paintExterior({ vista: v.vista, hora, planta: v.planta, horizonZ, plants: v.plants });
      // Otra hora ha llegado antes de que acabara esta: se queda la última
      if (destroyed || run !== paintRun) return;
      const textures = { far: pixelTexture(art.far), mid: pixelTexture(art.mid), near: pixelTexture(art.near), glint: pixelTexture(art.glint) };
      textures.glint.wrapT = RepeatWrapping;
      textures.glint.repeat.y = 1 / WATER_FRAMES;
      let entry = outside.find((o) => o.uid === v.uid);
      if (!entry) {
        entry = { uid: v.uid, v, layers: {} };
        const centre = v.a + (PANE.x0 + PANE.x1) / 2;
        const eye = wallEye(v, home.pos);
        for (const name of ['far', 'glint', 'mid', 'near']) {
          const layer = name === 'glint' ? 'far' : name;
          const material = new MeshBasicMaterial(name === 'far' ? {} : { transparent: false, alphaTest: 0.5 });
          const mesh = new Mesh(outGeo, material);
          const plane = layerPlane(layer, eye, centre);
          if (name === 'glint') {
            // Solo la franja de agua, un pelo por delante del cielo
            const zTop = LAYERS.far.z1 - rowOf('far', horizonZ) / PX_PER_CELL;
            const k = (eye.d + LAYERS.far.depth) / eye.d;
            const bottom = eye.z + (zTop - art.band / PX_PER_CELL - eye.z) * k;
            const top = eye.z + (zTop - eye.z) * k;
            mesh.position.copy(toWorld(v, plane.s, (top + bottom) / 2, plane.depth - 0.02));
            mesh.scale.set(plane.width, top - bottom, 1);
          } else {
            mesh.position.copy(toWorld(v, plane.s, plane.z, plane.depth));
            mesh.scale.set(plane.width, plane.height, 1);
          }
          if (v.pared === 'izq') mesh.rotation.y = Math.PI / 2;
          scene.add(mesh);
          entry.layers[name] = { mesh, material, plane };
        }
        outside.push(entry);
        horizonInfo.find((h) => h.uid === v.uid).painted = true;
      }
      for (const name of Object.keys(textures)) {
        const { material } = entry.layers[name];
        material.map?.dispose();
        material.map = textures[name];
        material.needsUpdate = true;
      }
    }
    paintMs = performance.now() - t0;
    showWater();
    invalidate();
  }

  // El agua: solo cambia de tira en su atlas. No hay animación si la app está en segundo plano, si algo tapa el piso, si pides
  // menos movimiento o si la ventana no está a la vista; entonces no se redibuja nada y la imagen se queda quieta.
  let waterFrame = 0;
  let waterTimer = 0;
  let waterSteps = 0;
  let covered = false;
  let renders = 0;
  let renderMs = 0;
  const motion = typeof matchMedia === 'function' ? matchMedia(MOTION) : null;
  function showWater() {
    for (const o of outside) o.layers.glint.material.map.offset.y = (WATER_FRAMES - 1 - waterFrame) / WATER_FRAMES;
  }
  const waterAllowed = () => outside.length > 0 && !destroyed && !covered && !motion?.matches && document.visibilityState !== 'hidden';
  function windowInView() {
    camera.updateMatrixWorld();
    for (const o of outside) {
      const pane = paneOf(o.v);
      let x0 = Infinity;
      let x1 = -Infinity;
      let y0 = Infinity;
      let y1 = -Infinity;
      let behind = false;
      for (const [s, z] of [[pane.s0, pane.z0], [pane.s1, pane.z0], [pane.s0, pane.z1], [pane.s1, pane.z1]]) {
        const q = toWorld(o.v, s, z, 0).project(camera);
        if (q.z > 1) behind = true;
        x0 = Math.min(x0, q.x);
        x1 = Math.max(x1, q.x);
        y0 = Math.min(y0, q.y);
        y1 = Math.max(y1, q.y);
      }
      if (!behind && x1 > -1 && x0 < 1 && y1 > -1 && y0 < 1) return true;
    }
    return false;
  }
  function waterStep() {
    waterTimer = 0;
    if (!waterAllowed()) return;
    aim();
    if (windowInView()) {
      waterFrame = (waterFrame + 1) % WATER_FRAMES;
      waterSteps += 1;
      showWater();
      invalidate();
    }
    waterTimer = setTimeout(waterStep, WATER_MS);
  }
  function syncWater() {
    clearTimeout(waterTimer);
    waterTimer = 0;
    if (waterAllowed()) waterTimer = setTimeout(waterStep, WATER_MS);
    syncBeings();
  }

  // Los seres se mueven a unos 5 fotogramas por segundo, con las mismas condiciones que el agua (nada en segundo plano, si
  // algo tapa el piso o si pides menos movimiento: entonces se quedan en su postura de siempre, la de la miniatura)
  const BEING_MS = 200;
  let beingTimer = 0;
  let beingT = 1.3;
  let beingSteps = 0;
  const beingsAllowed = () => beings.length > 0 && !destroyed && !covered && !motion?.matches && document.visibilityState !== 'hidden';
  // Solo se repintan (y solo se redibuja la escena) si alguno está a la vista
  const beingInView = (b) => {
    const q = b.sprite.position.clone().project(camera);
    return q.z < 1 && Math.abs(q.x) < 1.4 && q.y > -1.2 && q.y < 1.8;
  };
  function beingStep() {
    beingTimer = 0;
    if (!beingsAllowed()) return;
    beingT += BEING_MS / 1000;
    aim();
    camera.updateMatrixWorld();
    const seen = beings.filter(beingInView);
    for (const b of seen) {
      b.art.paint(beingT, b.opts);
      b.map.needsUpdate = true;
    }
    if (seen.length) {
      beingSteps += 1;
      invalidate();
    }
    beingTimer = setTimeout(beingStep, BEING_MS);
  }
  function syncBeings() {
    clearTimeout(beingTimer);
    beingTimer = 0;
    if (beingsAllowed()) beingTimer = setTimeout(beingStep, BEING_MS);
  }

  function applyLight() {
    const light = LIGHT[hora];
    hemi.intensity = light.hemi;
    hemi.color.set(light.hemiColor);
    ambient.intensity = light.ambient;
    sun.intensity = light.sun;
    sun.color.set(light.sunColor);
    for (const l of lampLights) l.intensity = light.lamp;
    for (const f of fabrics.values()) f.color.set(light.fabric);
    for (const m of woodMats) {
      m.color.set(light.wood);
      if (m.userData.base) m.color.multiply(m.userData.base);
    }
    if (woodMat) {
      woodMat.map = hora === 'dia' ? woodOff : woodLit;
      woodMat.needsUpdate = true;
    }
    for (const t of tableKits) {
      t.material.map = hora === 'dia' ? t.off : t.lit;
      t.material.needsUpdate = true;
    }
    for (const f of [...frameKits.values(), ...pieceMats]) {
      f.map = hora === 'dia' ? f.userData.off : f.userData.lit;
      f.needsUpdate = true;
    }
    for (const k of lampKits.values()) {
      const map = hora === 'dia' ? k.off : k.lit;
      k.body.map = map;
      k.shade.map = map;
      k.body.color.set(light.brass);
      k.body.needsUpdate = true;
      k.shade.needsUpdate = true;
    }
    paintWalls();
    renderer.setClearColor(light.clear);
  }

  function aim() {
    if (zoom) {
      camera.position.copy(zoom.pos);
      camera.lookAt(zoom.target);
      return;
    }
    // Los ojos se mueven lo justo: más allá del giro de siempre solo gira la mirada, y el exterior ya está comprobado desde ahí
    camera.position.copy(home.pos).addScaledVector(home.side, Math.max(-YAW_MAX, Math.min(YAW_MAX, yaw)) * 0.1);
    const d = home.dir.clone().applyAxisAngle(new Vector3(0, 1, 0), -yaw);
    camera.lookAt(camera.position.clone().add(d));
  }

  // Oculta (en segundo plano, o tapada del todo por otra vista) la habitación no dibuja: se anota y se pinta al volver
  const paused = () => document.visibilityState === 'hidden' || lost || (covered && !mustDraw);
  function draw() {
    raf = 0;
    if (destroyed) return;
    if (paused()) {
      stale = true;
      return;
    }
    stale = false;
    mustDraw = false;
    aim();
    const t0 = performance.now();
    renderer.render(scene, camera);
    renderMs += performance.now() - t0;
    if (renders === 0) performance.mark('piso-lab:primer-dibujo');
    renders += 1;
    frameHook?.();
  }
  function invalidate() {
    if (raf || destroyed) return;
    if (paused()) {
      stale = true;
      return;
    }
    raf = requestAnimationFrame(draw);
  }

  function resize() {
    const rect = container.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const h = Math.max(1, Math.round((ART_W * rect.height) / rect.width));
    // Cambiar el tamaño borra el lienzo: con una hoja encima que no lo tapa del todo hay que repintarlo
    if (canvas.height !== h) mustDraw = true;
    renderer.setSize(ART_W, h, false);
    camera.aspect = rect.width / rect.height;
    camera.fov = camera.aspect >= WIDE_ASPECT ? FOV : (2 * Math.atan(Math.tan((FOV * Math.PI) / 360) * (WIDE_ASPECT / camera.aspect)) * 180) / Math.PI;
    camera.updateProjectionMatrix();
    if (zoomRow !== null && zoom) zoom = rowView(zoomRow);
    invalidate();
  }

  /**
   * Lo que se puede usar bajo el dedo. Una lámpara o una planta por delante no quitan el toque; de lo que se puede usar, gana
   * lo más cercano. Si el centro del dedo no da en nada, se mira a su alrededor.
   */
  function usableAt(x, y) {
    const rect = canvas.getBoundingClientRect();
    for (const [dx, dy] of [[0, 0], [FINGER, 0], [-FINGER, 0], [0, FINGER], [0, -FINGER]]) {
      ray.setFromCamera(new Vector2(((x + dx - rect.left) / rect.width) * 2 - 1, -((y + dy - rect.top) / rect.height) * 2 + 1), camera);
      const hits = ray.intersectObjects(meshes.filter((m) => m.visible), false);
      const found = hits.find(({ object: { userData: u } }) => u.id === 'libro' || u.id === 'puerta-piso' || u.id === 'ordenador' || u.id === 'escritorio' || u.id === 'estanteria');
      if (found) return found;
    }
    return null;
  }

  // Tocar y mirar. Un solo AbortController se lleva todos los oyentes al salir
  const stop = new AbortController();
  const on = { signal: stop.signal };
  const ray = new Raycaster();
  let press = null;
  canvas.addEventListener(
    'pointerdown',
    (e) => {
      // Un segundo dedo nunca es un toque: el gesto ya no cuenta
      if (press) {
        press.moved = true;
        return;
      }
      press = { x: e.clientX, y: e.clientY, yaw, moved: false, id: e.pointerId, t: performance.now() };
      canvas.setPointerCapture?.(e.pointerId);
    },
    on,
  );
  canvas.addEventListener(
    'pointermove',
    (e) => {
      if (!press || e.pointerId !== press.id) return;
      const dx = e.clientX - press.x;
      // Una vez que se ha movido, ya no es un toque aunque vuelva al mismo sitio
      if (Math.hypot(dx, e.clientY - press.y) > TAP_SLOP) press.moved = true;
      if (press.moved && !zoom) {
        yaw = clampYaw(press.yaw - dx * 0.004);
        invalidate();
      }
    },
    on,
  );
  canvas.addEventListener(
    'pointercancel',
    (e) => {
      if (press && e.pointerId === press.id) press = null;
    },
    on,
  );
  canvas.addEventListener(
    'pointerup',
    (e) => {
      if (!press || e.pointerId !== press.id) return;
      const tapped = !press.moved && performance.now() - press.t <= TAP_MS;
      press = null;
      if (!tapped) return;
      if (zoom) {
        onShelfTap();
        return;
      }
      const found = usableAt(e.clientX, e.clientY);
      const hit = found?.object.userData.id;
      if (hit === 'libro') onBook();
      else if (hit === 'puerta-piso') onDoor?.();
      else if (hit === 'ordenador' || (hit === 'escritorio' && itemsOn(room, found.object.userData.uid).some((t) => t.id === 'ordenador'))) onDesk?.();
      else if (hit === 'estanteria') onShelf(found.point.y - heightOf(room, shelf) < 1.17 ? 0 : found.point.y - heightOf(room, shelf) < 2.27 ? 1 : 2);
    },
    on,
  );
  canvas.addEventListener(
    'keydown',
    (e) => {
      if (zoom || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
      e.preventDefault();
      yaw = clampYaw(yaw + (e.key === 'ArrowLeft' ? -0.08 : 0.08));
      invalidate();
    },
    on,
  );
  canvas.addEventListener(
    'webglcontextlost',
    (e) => {
      // El navegador puede devolverlo, sobre todo al volver de segundo plano: solo se renuncia si no lo hace
      e.preventDefault();
      lost = true;
      cancelAnimationFrame(raf);
      raf = 0;
      syncWater();
      awaitContext();
    },
    on,
  );
  canvas.addEventListener(
    'webglcontextrestored',
    () => {
      lost = false;
      restores += 1;
      clearTimeout(lostTimer);
      syncWater();
      mustDraw = true;
      invalidate();
    },
    on,
  );
  // En segundo plano no corre el plazo
  function awaitContext() {
    clearTimeout(lostTimer);
    if (document.visibilityState === 'hidden') return;
    lostTimer = setTimeout(() => {
      if (lost && !destroyed) onLost();
    }, RESTORE_MS);
  }

  document.addEventListener(
    'visibilitychange',
    () => {
      syncWater();
      if (document.visibilityState === 'hidden') {
        cancelAnimationFrame(raf);
        raf = 0;
        return;
      }
      if (lost) {
        awaitContext();
        return;
      }
      // Algunos móviles vacían el lienzo en segundo plano
      mustDraw = true;
      invalidate();
    },
    on,
  );
  motion?.addEventListener('change', syncWater, on);
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  applyLight();
  resize();
  // El piso se enseña entero: con su vista por la ventana y, si llega a tiempo, con la cubierta sobre la mesa
  await paintWindows();
  if (destroyed) return null;
  await Promise.race([Promise.all([coverReady, shelfCoverReady]), new Promise((resolve) => setTimeout(resolve, COVER_WAIT))]);
  if (destroyed) return null;
  container.append(canvas);
  draw();
  syncWater();

  /** Dónde está la cámara sentada, con el giro de ahora. */
  function seatedView() {
    const was = zoom;
    zoom = null;
    aim();
    const view = { pos: camera.position.clone(), target: camera.position.clone().add(camera.getWorldDirection(new Vector3()).multiplyScalar(4)) };
    zoom = was;
    aim();
    return view;
  }
  /** La balda `row` entera en pantalla, sea cual sea su ancho: se aleja lo justo, sin salir de la habitación. */
  function rowView(row) {
    const view = ROW_VIEW.rows[row];
    const low = ROW_FLOOR[row];
    // Los libros de la balda, con un poco de madera alrededor; sin libros, la balda entera
    const box = rowBoxes[row] ?? { x0: BALDA.x0, x1: BALDA.x1, top: low + 0.9 };
    const [x0, x1] = [Math.max(0, box.x0 - 0.1), Math.min(2.16, box.x1 + 0.1)];
    const [z0, z1] = [low - 0.04, box.top + 0.1];
    const target = shelfPoint((x0 + x1) / 2, ROW_VIEW.y, (z0 + z1) / 2);
    const out = shelfPoint(1, 1, 0).sub(shelfPoint(1, 0, 0)).normalize();
    const across = shelfPoint(1, 0, 0).sub(shelfPoint(0, 0, 0)).normalize();
    const corners = [x0, x1].flatMap((x) => [z0, z1].map((z) => shelfPoint(x, 1.05, z)));
    const rect = canvas.getBoundingClientRect();
    const place = (dist) => {
      const pos = target.clone().addScaledVector(out, dist).addScaledVector(across, dist * ROW_VIEW.side);
      pos.y += view.up * (dist / ROW_VIEW.dist);
      pos.x = Math.max(0.3, Math.min(ROOM.w - 0.3, pos.x));
      pos.z = Math.max(0.3, Math.min(ROOM.d - 0.3, pos.z));
      return pos;
    };
    const was = { pos: camera.position.clone(), q: camera.quaternion.clone() };
    let pos = place(ROW_VIEW.near);
    for (let dist = ROW_VIEW.near; dist <= 6; dist += 0.05) {
      const next = place(dist);
      camera.position.copy(next);
      camera.lookAt(target);
      camera.updateMatrixWorld();
      pos = next;
      const fits = corners.every((c) => {
        const q = c.clone().project(camera);
        const [x, y] = [((q.x + 1) / 2) * rect.width, ((1 - q.y) / 2) * rect.height];
        return x >= ROW_MARGIN.side && x <= rect.width - ROW_MARGIN.side && y >= ROW_MARGIN.top && y <= rect.height - ROW_MARGIN.bottom;
      });
      if (fits) break;
    }
    camera.position.copy(was.pos);
    camera.quaternion.copy(was.q);
    camera.updateMatrixWorld();
    return { pos, target };
  }

  /** Lo que se interpone entre los ojos y la balda se aparta mientras la miras; al volver, a su sitio. Solo se oculta, no se mueve. */
  function clearSight(view, row) {
    showVeiled();
    const low = ROW_FLOOR[row];
    const spots = [0.1, 1.08, 2.06].flatMap((x) => [low + 0.1, low + 0.9].map((z) => shelfPoint(x, 1, z)));
    const veil = new Set();
    const line = new Raycaster();
    for (const spot of spots) {
      const dir = spot.clone().sub(view.pos);
      const far = dir.length();
      line.set(view.pos, dir.normalize());
      line.far = far;
      for (const { object } of line.intersectObjects(meshes, false)) {
        if (object.userData.id !== 'estanteria' && object.userData.id !== 'libro') veil.add(object);
      }
    }
    veiled = [...veil];
    for (const mesh of veiled) mesh.visible = false;
  }
  function showVeiled() {
    for (const mesh of veiled) mesh.visible = true;
    veiled = [];
  }

  /** Lleva la cámara a `to` ({ pos, target }) o, con null, a su sitio en el sillón. Termina al llegar. */
  function fly(to, ms, instant = false) {
    cancelAnimationFrame(tween);
    const finish = (value) => {
      zoom = value;
      draw();
    };
    if (instant || reduced()) {
      finish(to);
      return Promise.resolve();
    }
    const seated = seatedView();
    const from = zoom ?? seated;
    const end = to ?? seated;
    const t0 = performance.now();
    return new Promise((resolve) => {
      const step = (now) => {
        if (destroyed) return resolve();
        const t = Math.min(1, (now - t0) / ms);
        const e = t * t * (3 - 2 * t);
        if (t < 1) {
          finish({ pos: from.pos.clone().lerp(end.pos, e), target: from.target.clone().lerp(end.target, e) });
          tween = requestAnimationFrame(step);
        } else {
          finish(to);
          resolve();
        }
        return undefined;
      };
      tween = requestAnimationFrame(step);
    });
  }

  return {
    canvas,
    hasShelf: Boolean(shelf),
    setHora(value) {
      hora = value;
      applyLight();
      paintWindows();
      invalidate();
    },
    /** Con la ficha o el registro encima no se ve el piso: el agua se para. */
    setCovered(value) {
      covered = value;
      syncWater();
      if (!covered && stale) invalidate();
    },
    /** Recoloca los libros: lo que has dejado sobre la mesa y la estantería que depende de ello. Sin rehacer nada más. */
    setBooks({ book: nextBook, shelfBooks: nextShelf }) {
      buildShelfBooks(nextShelf);
      buildTableBook(nextBook);
      applyLight();
      invalidate();
    },
    /** Lo que sobra de cada capa, en metros, desde los ojos dados, para comprobar que nunca se ve su final. */
    exteriorMargins(eyes) {
      return outside.map((o) => ({
        uid: o.uid,
        pared: o.v.pared,
        layers: Object.fromEntries(['far', 'mid', 'near'].map((name) => [name, layerMargins(name, o.layers[name].plane, paneOf(o.v), eyes.map((e) => wallEye(o.v, new Vector3(...e))))])),
      }));
    },
    /** Los ojos reales: del sillón con todo el giro, y el recorrido hasta cada balda. */
    eyePath() {
      const saved = yaw;
      const out = [];
      for (const value of [-YAW_MAX, 0, YAW_MAX]) {
        yaw = value;
        aim();
        out.push(camera.position.toArray());
      }
      yaw = saved;
      aim();
      if (shelf) {
        const seated = { pos: camera.position.clone(), target: camera.position.clone().add(camera.getWorldDirection(new Vector3()).multiplyScalar(4)) };
        const wasZoom = zoom;
        for (const [row] of ROW_VIEW.rows.entries()) {
          const { pos, target } = rowView(row);
          // Solo los tramos del recorrido en los que la ventana está en el encuadre
          for (let k = 0.05; k <= 1; k += 0.05) {
            zoom = { pos: seated.pos.clone().lerp(pos, k), target: seated.target.clone().lerp(target, k) };
            aim();
            if (windowInView()) out.push(camera.position.toArray());
          }
        }
        zoom = wasZoom;
        aim();
      }
      return out;
    },
    /**
     * Se acerca a la balda `row` (0 abajo, 2 la de la lámpara) o, con null, vuelve al encuadre desde el que saliste: el
     * giro no cambia. Termina cuando ha llegado. `instant`: sin recorrido, al montar ya en la balda.
     */
    zoomShelf(row, { instant = false } = {}) {
      const on2 = row !== null;
      if (!shelf) return Promise.resolve();
      if (!on2 && !zoom) return Promise.resolve();
      zoomRow = on2 ? row : null;
      if (!on2) {
        showVeiled();
        return fly(null, TWEEN_MS, instant);
      }
      const view = rowView(row);
      clearSight(view, row);
      return fly(view, TWEEN_MS, instant);
    },
    /**
     * Inclinarse sobre el libro antes de registrar y, con false, volver al encuadre del que saliste, con el mismo giro. Con
     * movimiento reducido no se mueve nada: el registro se abre sin más.
     */
    leanToBook(on) {
      if (on) {
        if (!bookGroup || zoom || reduced()) return Promise.resolve();
        const from = seatedView();
        const target = bookGroup.position.clone();
        target.y += 0.06;
        return fly({ pos: from.pos.clone().lerp(target, LEAN), target }, LEAN_MS);
      }
      return zoom ? fly(null, LEAN_MS) : Promise.resolve();
    },
    /** Lo mismo con el ordenador: se acerca hasta que llena la pantalla sin salirse de ella, y el giro se conserva. */
    leanToDesk() {
      const pc = room.items.find((i) => i.id === 'ordenador');
      if (!pc || zoom || reduced()) return Promise.resolve();
      const from = seatedView();
      const target = placeOf(pc);
      target.y = heightOf(room, pc) + 0.4;
      const rect = canvas.getBoundingClientRect();
      const halfWide = Math.tan((camera.fov * Math.PI) / 360) * (rect.width / rect.height);
      // A esta distancia, el monitor (unos 0,8 m) ocupa algo más de la mitad del ancho
      const near = 0.8 / (0.6 * 2 * halfWide);
      const dist = from.pos.distanceTo(target);
      const k = Math.max(0, Math.min(0.8, 1 - near / Math.max(dist, 0.01)));
      return fly({ pos: from.pos.clone().lerp(target, k), target }, LEAN_MS);
    },
    /** El giro de ahora, para volver a él si se desmonta la habitación. */
    yaw: () => yaw,
    yawRange: () => [...yawRange],
    /** Dónde poner una indicación junto al libro (o, sin libro, sobre la mesa), en px del contenedor. */
    bookAnchor() {
      const table = readingTable(room) ?? room.items.find((i) => TABLES.has(i.id));
      // Más allá del libro, para no taparlo: por encima de su borde del fondo
      const far = bookGroup && new Vector3().subVectors(bookGroup.position, home.pos).setY(0).normalize();
      const point = bookGroup ? bookGroup.position.clone().addScaledVector(far, 0.42) : table ? new Vector3(table.x + catalogItem(table.id).w / 2, catalogItem(table.id).sup ?? 0.7, table.y + catalogItem(table.id).d / 2) : null;
      if (!point) return { shown: false, x: 0, y: 0 };
      point.y += 0.1;
      aim();
      camera.updateMatrixWorld();
      const q = point.project(camera);
      const rect = container.getBoundingClientRect();
      const x = ((q.x + 1) / 2) * rect.width;
      const y = ((1 - q.y) / 2) * rect.height;
      return { shown: !zoom && q.z < 1 && x > 0 && x < rect.width && y > 0 && y < rect.height, x, y, width: rect.width };
    },
    /** Avisa después de cada dibujo: lo que hay en HTML pegado a la escena se recoloca solo si la escena se ha movido. */
    onFrame(fn) {
      frameHook = fn;
    },
    /**
     * El libro elegido sale de la balda y gira hasta enseñarte su portada; el anterior vuelve antes a su sitio (primero se
     * gira y luego entra), y solo entonces sale el nuevo: dos libros nunca se mueven a la vez. Tu lectura, que ya está de
     * frente, solo se adelanta. Con movimiento reducido, sin animación. Con null, todos a su sitio.
     */
    selectBook(id) {
      cancelAnimationFrame(pullRaf);
      const goal = (s) => (s.id === id ? 1 : 0);
      if (reduced()) {
        for (const s of shelfSpots) {
          s.show = goal(s);
          poseSpot(s);
        }
        draw();
        return undefined;
      }
      let last = performance.now();
      const step = (now) => {
        if (destroyed) return;
        const dt = (now - last) / SHOW_MS;
        last = now;
        // Mientras otro no haya vuelto del todo, el elegido espera
        const busy = shelfSpots.some((s) => s.id !== id && s.show > 0);
        let moving = false;
        for (const s of shelfSpots) {
          const g = goal(s) && !busy ? 1 : 0;
          if (s.show !== g) {
            s.show = g > s.show ? Math.min(g, s.show + dt) : Math.max(g, s.show - dt);
          }
          moving = moving || s.show !== goal(s);
          poseSpot(s);
        }
        draw();
        if (moving) pullRaf = requestAnimationFrame(step);
      };
      pullRaf = requestAnimationFrame(step);
      return undefined;
    },
    /**
     * Para las pruebas: recorre la salida y el giro de cada ejemplar en `steps` posturas y dice con qué vecinos se cruzaría
     * (vistos desde arriba, cada libro es un rectángulo girado). También los cruces en reposo. [{ id, at, with }]
     */
    sweep(steps = 24) {
      const quad = (s) => {
        const body = s.hit.children[0];
        body.geometry.computeBoundingBox();
        const { min, max } = body.geometry.boundingBox;
        s.group.updateMatrixWorld(true);
        return [[min.x, min.z], [max.x, min.z], [max.x, max.z], [min.x, max.z]].map(([x, z]) => new Vector3(x, 0, z).applyMatrix4(body.matrixWorld)).map((v) => [v.x, v.z]);
      };
      // Separación por ejes (SAT): se cruzan si en ningún eje de los dos rectángulos quedan separados más de 2 mm
      const cross = (p, q) => {
        for (const poly of [p, q]) {
          for (let k = 0; k < 4; k += 1) {
            const [ax, az] = poly[k];
            const [bx, bz] = poly[(k + 1) % 4];
            const [nx, nz] = [az - bz, bx - ax];
            const len = Math.hypot(nx, nz);
            const proj = (pts) => pts.map(([x, z]) => (x * nx + z * nz) / len);
            const [pa, pb] = [proj(p), proj(q)];
            if (Math.max(...pa) <= Math.min(...pb) + 0.002 || Math.max(...pb) <= Math.min(...pa) + 0.002) return false;
          }
        }
        return true;
      };
      const saved = shelfSpots.map((s) => s.show);
      const found = [];
      for (const s of shelfSpots) s.show = 0;
      for (const s of shelfSpots) poseSpot(s);
      for (const s of shelfSpots) {
        const others = shelfSpots.filter((o) => o !== s && o.row === s.row);
        const rest = others.map((o) => [o.id, quad(o)]);
        for (let k = 0; k <= steps; k += 1) {
          s.show = k / steps;
          poseSpot(s);
          const mine = quad(s);
          const hit = rest.filter(([, q]) => cross(mine, q)).map(([oid]) => oid);
          if (hit.length) {
            found.push({ id: s.id, at: Math.round(s.show * 100) / 100, with: hit });
            break;
          }
        }
        s.show = 0;
        poseSpot(s);
      }
      shelfSpots.forEach((s, k) => {
        s.show = saved[k];
        poseSpot(s);
      });
      return found;
    },
    /** Dónde caen en pantalla (px dentro del contenedor) los ejemplares de una balda: [{ id, left, top, width, height }]. */
    bookSlots(row) {
      if (!shelf) return [];
      aim();
      camera.updateMatrixWorld();
      const rect = container.getBoundingClientRect();
      return shelfSpots.filter((s) => s.row === row).map(({ id, group }) => {
        const [w, h, d] = group.userData.size;
        group.updateMatrixWorld();
        let x0 = Infinity;
        let y0 = Infinity;
        let x1 = -Infinity;
        let y1 = -Infinity;
        // Solo la cara de delante, que es la que se toca; la de la cubierta, ya girada
        for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          const q = new Vector3((a * w) / 2, (b * h) / 2, d / 2).applyMatrix4(group.matrixWorld).project(camera);
          const sx = ((q.x + 1) / 2) * rect.width;
          const sy = ((1 - q.y) / 2) * rect.height;
          x0 = Math.min(x0, sx);
          x1 = Math.max(x1, sx);
          y0 = Math.min(y0, sy);
          y1 = Math.max(y1, sy);
        }
        return { id, left: x0, top: y0, width: x1 - x0, height: y1 - y0 };
      });
    },
    /**
     * Cuánto se ve de una pieza con la cámara de ahora: `inside`, la parte de su caja dentro de la pantalla; `clear`, de
     * los puntos de ella que llegan a la pantalla, los que no tapa otra cosa; `by`, quién tapa el resto.
     */
    frameOf(what) {
      aim();
      camera.updateMatrixWorld();
      const mine = meshes.filter(({ userData: u }) => u.id === what || (what === 'ordenador' && u.id === 'ordenador'));
      if (!mine.length) return null;
      const box = new Box3();
      for (const m of mine) box.expandByObject(m);
      const rect = canvas.getBoundingClientRect();
      let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
      for (let i = 0; i < 8; i += 1) {
        const q = new Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(camera);
        const [x, y] = [((q.x + 1) / 2) * rect.width, ((1 - q.y) / 2) * rect.height];
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
      const width = Math.max(0, Math.min(x1, rect.width) - Math.max(x0, 0));
      const height = Math.max(0, Math.min(y1, rect.height) - Math.max(y0, 0));
      const inside = ((width * height) / Math.max(1, (x1 - x0) * (y1 - y0)));
      let seen = 0;
      let free = 0;
      const by = {};
      for (let i = 0; i < 9; i += 1) {
        for (let j = 0; j < 9; j += 1) {
          const [x, y] = [x0 + ((x1 - x0) * (i + 0.5)) / 9, y0 + ((y1 - y0) * (j + 0.5)) / 9];
          if (x < 0 || y < 0 || x > rect.width || y > rect.height) continue;
          ray.setFromCamera(new Vector2((x / rect.width) * 2 - 1, -(y / rect.height) * 2 + 1), camera);
          const hits = ray.intersectObjects(meshes, false);
          if (!hits.some(({ object }) => mine.includes(object))) continue;
          seen += 1;
          if (mine.includes(hits[0].object)) free += 1;
          else by[hits[0].object.userData.id ?? 'otro'] = (by[hits[0].object.userData.id ?? 'otro'] ?? 0) + 1;
        }
      }
      return { inside: Math.round(inside * 100) / 100, clear: seen ? Math.round((free / seen) * 100) / 100 : 0, by, box: [x0, y0, x1, y1].map(Math.round), screen: [Math.round(rect.width), Math.round(rect.height)] };
    },
    /** Coloca la mirada en un giro exacto y dibuja ya: lo usan las comprobaciones de parpadeo. */
    lookTo(value) {
      yaw = clampYaw(value);
      draw();
    },
    /** Giro sostenido para medir la fluidez: fotogramas por segundo y percentil 95 del tiempo de fotograma. */
    measureYaw(ms = 3000, { sync = false } = {}) {
      return new Promise((resolve) => {
        const frames = [];
        const work = [];
        const saved = yaw;
        const t0 = performance.now();
        let last = t0;
        const step = (now) => {
          frames.push(now - last);
          last = now;
          yaw = Math.sin((now - t0) / 700) * YAW_MAX;
          aim();
          const before = performance.now();
          renderer.render(scene, camera);
          // Sin esto la GPU trabaja aparte y el tiempo de fotograma no la incluye: leer un píxel obliga a esperarla
          if (sync) renderer.getContext().readPixels(0, 0, 1, 1, renderer.getContext().RGBA, renderer.getContext().UNSIGNED_BYTE, new Uint8Array(4));
          work.push(performance.now() - before);
          if (destroyed || now - t0 >= ms) {
            frames.shift();
            const sorted = [...frames].sort((a, b) => a - b);
            const total = frames.reduce((s, v) => s + v, 0);
            yaw = saved;
            invalidate();
            const at = (q) => Math.round(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] * 10) / 10;
            resolve({ fps: Math.round((frames.length * 10000) / total) / 10, p50ms: at(0.5), p95ms: at(0.95), p99ms: at(0.99), maxMs: at(1), over33: frames.filter((v) => v > 33.4).length, frames: frames.length, dibujoMs: Math.round((work.reduce((s, v) => s + v, 0) / work.length) * 10) / 10 });
          } else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    },
    /**
     * Dónde tocar (px de la ventana) para alcanzar el libro, la estantería o, con 'balda', la cubierta en ella; con 'balda:N',
     * el centro de los libros de esa balda: lo usan las pruebas.
     */
    screenOf(what) {
      aim();
      camera.updateMatrixWorld();
      const rowOf = /^balda:([0-2])$/.exec(what);
      if (rowOf) {
        const row = Number(rowOf[1]);
        const spots = shelf ? shelfSpots.filter((sp) => sp.row === row) : [];
        if (!spots.length) return null;
        const q = spots.reduce((sum, sp) => sum.add(sp.group.position), new Vector3()).divideScalar(spots.length).project(camera);
        const r = canvas.getBoundingClientRect();
        return { x: r.left + ((q.x + 1) / 2) * r.width, y: r.top + ((1 - q.y) / 2) * r.height };
      }
      const piece = (what === 'ordenador' || what === 'puerta') && room.items.find((i) => i.id === (what === 'puerta' ? 'puerta-piso' : 'ordenador'));
      const point = piece ? (what === 'puerta' ? new Vector3(piece.pared === 'fondo' ? piece.a + 1 : 0.05, 1.5, piece.pared === 'fondo' ? 0.05 : piece.a + 1) : new Vector3(piece.x + 0.5, heightOf(room, piece) + 0.45, piece.y + 0.44)) : what === 'libro' ? bookGroup?.position.clone().add(new Vector3(0, 0.06, 0)) : shelf && (what === 'balda' ? shelfSpots[0]?.group.position.clone() : shelfPoint(1.7, 1, 1.75));
      if (!point) return null;
      const q = point.project(camera);
      const rect = canvas.getBoundingClientRect();
      return { x: rect.left + ((q.x + 1) / 2) * rect.width, y: rect.top + ((1 - q.y) / 2) * rect.height };
    },
    debug() {
      return {
        piso: piso.id,
        yaw,
        lamps: lamps.map((l) => ({ uid: l.item.uid, x: l.mesh.position.x, z: l.mesh.position.z, rot: l.mesh.userData.rot })),
        windows: horizonInfo,
        memory: { ...renderer.info.memory },
        calls: renderer.info.render.calls,
        book: bookGroup ? { id: tableBook.id, color: tableBook.color, coverReal } : null,
        shelf: { coverReal: shelfCoverReal, faces: shelfFaces, spines: shelfSpines, shown: shelfSpots.filter((sp) => sp.show === 1).map((sp) => sp.id), books: shelfSpots.map((s) => s.id), rows: [0, 1, 2].map((r) => shelfSpots.filter((s) => s.row === r).length) },
        // Dónde está la estantería que se dibuja (la del piso guardado): para comprobar que Decorar llega a la primera persona
        // Los seres dibujados (místicos, mascota, vivos y destellos de acabado) y dónde están
        // La cámara del asiento real: si queda en la habitación, si cae dentro de otro mueble y si llega a cada esencial
        camera: {
          seat: seat ? { uid: seat.uid, id: seat.id, x: seat.x, y: seat.y, rot: seat.rot } : null,
          x: home.pos.x,
          z: home.pos.z,
          inRoom: home.pos.x > 0.1 && home.pos.x < ROOM.w - 0.1 && home.pos.z > 0.1 && home.pos.z < ROOM.d - 0.1,
          inside: room.items
            .filter((i) => i.uid !== seat?.uid && catalogItem(i.id)?.capa === 'suelo')
            .filter((i) => {
              const r = rectOf(i);
              return home.pos.x > r.x0 && home.pos.x < r.x1 && home.pos.z > r.y0 && home.pos.z < r.y1;
            })
            .map((i) => i.id),
          yawRange: [...yawRange],
          reach: essentialItems(room).map((i) => ({ id: i.id, yaw: headingTo(placeOf(i)), ok: Math.abs(headingTo(placeOf(i))) <= YAW_REACH })),
        },
        beings: { list: beings.map((b) => ({ uid: b.uid, id: b.id, x: b.sprite.position.x, y: b.sprite.position.y, z: b.sprite.position.z })), steps: beingSteps, running: Boolean(beingTimer) },
        // Cada pieza del piso dibujada (una vez por uid) y dónde: para comparar con el piso guardado y su isométrico
        placed: (() => {
          const out = new Map();
          scene.traverse((o) => {
            const u = o.userData;
            if (u?.uid === undefined || u.being || out.has(u.uid)) return;
            const p = o.getWorldPosition(new Vector3());
            out.set(u.uid, { uid: u.uid, id: u.id, rot: u.rot ?? 0, x: Math.round(p.x * 1000) / 1000, y: Math.round(p.y * 1000) / 1000, z: Math.round(p.z * 1000) / 1000 });
          });
          return [...out.values()];
        })(),
        shelfAt: shelf ? { uid: shelf.uid, x: shelf.x, y: shelf.y, rot: shelf.rot ?? 0 } : null,
        zoomed: Boolean(zoom),
        // Para comparar encuadres entre navegadores: la balda, la cámara y el tamaño del lienzo
        view: { row: zoomRow, pos: zoom ? zoom.pos.toArray().map((v) => Math.round(v * 1000) / 1000) : null, target: zoom ? zoom.target.toArray().map((v) => Math.round(v * 1000) / 1000) : null, rect: (({ width, height }) => [Math.round(width), Math.round(height)])(canvas.getBoundingClientRect()), fov: Math.round(camera.fov * 100) / 100 },
        paused: paused(),
        contextLost: lost,
        restores,
        exterior: { paintMs: Math.round(paintMs), layers: outside.length * 4, windows: outside.length, waterSteps, waterFrame, waterRunning: Boolean(waterTimer), renders, renderMs: Math.round(renderMs * 10) / 10, inView: (aim(), windowInView()) },
        hora,
        eye: camera.position.y,
      };
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(tween);
      cancelAnimationFrame(pullRaf);
      clearTimeout(waterTimer);
      clearTimeout(beingTimer);
      clearTimeout(lostTimer);
      stop.abort();
      observer.disconnect();
      for (const o of outside) {
        for (const { material } of Object.values(o.layers)) {
          material.map?.dispose();
          material.dispose();
        }
      }
      if (shelfKit) release(shelfKit);
      if (bookKit) release(bookKit);
      for (const m of owned.materials) m.dispose();
      for (const t of owned.textures) t.dispose();
      for (const g of owned.geometries) g.dispose();
      for (const g of usedShared) g.dispose();
      scene.clear();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}

// Se exporta para las pruebas: cuántas piezas del catálogo están en memoria (acotado, no crece con las visitas)
export const sharedGeometries = () => shared.size;
