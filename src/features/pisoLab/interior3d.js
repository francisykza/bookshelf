// El interior del piso en primera persona (piloto, solo en el laboratorio). Este módulo es el único que importa Three.js
// y se carga bajo demanda al cruzar la puerta. No tiene modelos propios: lee las mismas cajas de `furniture.js` y las
// mismas coordenadas, giros y colores del `layout` que dibuja `render.js`, así que lo que mueves en el editor es lo que
// ves aquí. La geometría de cada pieza del catálogo se comparte entre pisos; lo demás (materiales, texturas, luces y el
// lienzo) es de cada montaje y `destroy()` lo libera. Solo se dibuja cuando algo cambia.
import { AmbientLight, BoxGeometry, BufferAttribute, BufferGeometry, CanvasTexture, Color, DirectionalLight, DoubleSide, Float32BufferAttribute, Group, HemisphereLight, LinearFilter, Mesh, MeshBasicMaterial, MeshLambertMaterial, NearestFilter, PerspectiveCamera, PlaneGeometry, PointLight, Raycaster, RepeatWrapping, SRGBColorSpace, Scene, Vector2, Vector3, WebGLRenderer } from 'three';
import { PAREDES, catalogItem } from '../edificio/catalog';
import { shapeOf } from '../edificio/furniture';
import { ROOM, heightOf } from '../edificio/room';
import { bookDims, wrapTitle } from './bookLayout';
import { paintExterior } from './exterior';
import { LAYERS, WATER_FRAMES, WATER_MS, PX_PER_CELL, layerMargins, layerPlane, rowOf } from './exteriorLayout';
import { BALDA, baldaShadowTexture, bookTexture, contactShadowTexture, floorTexture, footShadowTexture, grainTexture, lampTexture, pagesTexture, pixelBook, pixelLamp, pixelTable, pixelWindow, shelfTexture, sillShadowTexture, spineAtlas, tableTexture, upholsteredArmchair, upholsteryTexture, wallPlates, wallTexture, windowTexture, woodShelf, computerTexture, doorTexture, drawerTexture, pixelComputer, pixelDoor } from './materials';

/** Ojos de una persona sentada: un poco por encima del respaldo del sillón (1,75 celdas, furniture.js). */
export const EYE = 1.85;
const FOV = 72;
/** Dónde te sientas, en coordenadas del sillón: pegado al respaldo y arrimado a un brazo, para verlo en primer plano. */
const SEAT = { lx: 0.7, ly: 0.75 };
/** Cabeza algo baja y girada hacia el centro de la habitación: menos techo y más mesa. */
/** Cuánto se espera a la cubierta para enseñar ya el piso con ella; si tarda más, llega después. */
const COVER_WAIT = 2200;
const TILT = 0.215;
const TURN = 0.06;
const ART_W = 320;
const YAW_MAX = 0.6;
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
const ROW_VIEW = { x: 1.08, y: 0.9, dist: 2.25, side: 0.44, rows: [{ z: 0.56, up: 0.74 }, { z: 1.66, up: 0.24 }, { z: 2.76, up: 0.18 }] };
const ROW_FLOOR = [0.14, 1.24, BALDA.z1];
const TWEEN_MS = 680;
/** Un toque: el dedo apenas se mueve y se levanta pronto. Lo demás es girar o una pulsación que no pide nada. */
const TAP_SLOP = 8;
const TAP_MS = 450;
const PULL = 0.15;
const PULL_MS = 150;
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
  const key = `${item.id}|${item.tono}|${placing}|${ownBooks}`;
  if (!shared.has(key)) {
    const tono = cat.tonos[item.tono];
    let boxes = cat.capa === 'alfombra' ? [{ b: [0, 0, 0, cat.w, cat.d, 0.05], c: tono }] : shapeOf(item.id, tono);
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
  const cat = catalogItem('sillon');
  const [a, b] = turned(cat, seat.rot, [SEAT.lx, SEAT.ly, 0, SEAT.lx, SEAT.ly, 0]);
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
export async function mountInterior(container, { room, piso, ventanas, book = null, shelfBooks = null, hora: startHora = 'tarde', onBook = () => {}, onShelf = () => {}, onShelfTap = () => {}, onLost = () => {}, onDesk = null, onDoor = null }) {
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
  const seat = room.items.find((i) => i.id === 'sillon');
  const home = seat ? seatView(seat) : piso.mira === 'izq' ? { pos: new Vector3(8.6, EYE, 4.4), dir: new Vector3(-1, -TILT, 0), side: new Vector3(0, 0, -1) } : { pos: new Vector3(2.9, EYE, 8.6), dir: new Vector3(0, -TILT, -1), side: new Vector3(1, 0, 0) };
  let yaw = 0;
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
  pushBox(shell, [0, 0, 0, ROOM.w, 0.05, 0.18], skirt);
  pushBox(shell, [0, 0, 0, 0.05, ROOM.d, 0.18], skirt);
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
    if (!cat || OWN_PIECES.has(item.id) || PIXEL_TABLES.has(item.id)) continue;
    const geometry = catalogGeometry(item, cat, item.id === 'estanteria' && Boolean(shelfBooks));
    usedShared.add(geometry);
    const kit = item.id === 'lampara-pie' ? lampKit(cat.tonos[item.tono]) : null;
    const mesh = new Mesh(geometry, item.id === 'sillon' ? fabricOf(cat.tonos[item.tono]) : kit ? [kit.body, kit.shade] : [solid, glow]);
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
  const shelf = room.items.find((i) => i.id === 'estanteria');
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
  let shelfLights = [];
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
    shelfLights = lights;
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

  // Tus libros: tu lectura de frente, un poco girada, en la balda de la lámpara, y lomos reales hasta donde quepan.
  // Comparten atlas y material; la luz de la lámpara les llega por vértice, según lo cerca que estén de ella
  const shelfSpots = [];
  const warmers = [];
  let shelfCoverReal = false;
  let shelfCoverReady = Promise.resolve();
  // Lo que se tira y se rehace al cambiar los libros: la memoria de cada tanda no se queda en la tarjeta
  const freshKit = () => ({ materials: [], textures: [], geometries: [], meshes: [] });
  const release = (kit) => {
    for (const m of kit.materials) m.dispose();
    for (const t of kit.textures) t.dispose();
    for (const g of kit.geometries) g.dispose();
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
    warmers.length = 0;
    shelfCoverReal = false;
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
    const tinted = (material) => {
      if (!material.map) material.userData.base = material.color.clone();
      woodMats.push(material);
      return own('materials', material);
    };
    const meshesAdd = (mesh) => {
      kit.meshes.push(mesh);
      meshes.push(mesh);
    };
    const shelfBooks = data;
    const base = [0, -Math.PI / 2, Math.PI, Math.PI / 2][shelf.rot ?? 0];
    const lift = heightOf(room, shelf);
    const DEPTH = 0.56;
    const FRONT_Y = 0.6;
    const list = shelfBooks.rows.flat();
    const atlas = spineAtlas(list);
    own('textures', atlas.texture);
    const spineMat = tinted(new MeshBasicMaterial({ map: atlas.texture, vertexColors: true }));
    const pages = tinted(new MeshBasicMaterial({ map: own('textures', pagesTexture()) }));
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
    // Una cara de la caja, a un recorte del atlas
    const faceUv = (geometry, face, [rx, ry, rw, rh]) => {
      const uv = geometry.attributes.uv;
      const [W, H] = atlas.size;
      const corners = [[rx, ry], [rx + rw, ry], [rx, ry + rh], [rx + rw, ry + rh]];
      corners.forEach(([u, v], k) => uv.setXY(face * 4 + k, u / W, 1 - v / H));
    };
    const warmOf = (x, z) => {
      let g = 0;
      for (const l of shelfLights) {
        const d = Math.hypot(x - l.x, FRONT_Y - l.y, z - l.z) / 2.6;
        if (d < 1) g += (1 - d) ** 1.5;
      }
      return Math.min(1, g);
    };
    const place = (id, row, x, z, height, width, depth, turn, tilt = 0) => {
      const group = new Group();
      group.position.copy(shelfPoint(x, FRONT_Y, z + height / 2 + lift));
      group.rotation.y = base + turn;
      group.rotation.z = tilt;
      group.userData = { size: [width, height, depth] };
      return group;
    };

    const c = shelfBooks.cover;
    const coverThick = Math.max(0.1, Math.min(0.2, c.thickness));
    const coverHeight = Math.min(BALDA.ceiling - BALDA.z1 - 0.06, 0.72 * c.height);
    const COVER_X = 1.42;
    const coverWidth = Math.max(0.46, 0.5 * c.height);
    const coverGroup = place(c.id, 2, COVER_X, BALDA.z1, coverHeight, coverWidth, coverThick, COVER_TURN);
    const coverHit = new Mesh(own('geometries', new BoxGeometry(coverWidth, coverHeight, coverThick)));
    coverHit.userData = { id: 'estanteria' };
    const clothTex = own('textures', new CanvasTexture(clothCover(c)));
    clothTex.colorSpace = SRGBColorSpace;
    clothTex.minFilter = LinearFilter;
    clothTex.generateMipmaps = false;
    const face = tinted(new MeshBasicMaterial({ map: clothTex }));
    const cloth = tinted(new MeshBasicMaterial({ color: c.color }));
    coverHit.material = [pages, cloth, pages, pages, face, cloth];
    coverGroup.add(coverHit);
    layer.add(coverGroup);
    plateOf(COVER_X, BALDA.z1, coverWidth + 0.16, coverThick + 0.2, COVER_TURN);
    shelfSpots.push({ id: c.id, row: 2, group: coverGroup, hit: coverHit, pull: 0 });
    meshesAdd(coverHit);
    shelfCoverReady = Promise.resolve(c.coverLoad).then((image) => {
      if (!image || destroyed || shelfKit !== kit) return;
      const aspect = image.naturalWidth / image.naturalHeight;
      const [w0, h] = coverGroup.userData.size;
      const w = Math.min(0.66, h * aspect);
      coverHit.scale.x = w / w0;
      coverGroup.userData.size[0] = w;
      const width = 140;
      const tex = own('textures', new CanvasTexture(coverCanvas(image, width, Math.round(width / aspect))));
      tex.colorSpace = SRGBColorSpace;
      tex.minFilter = LinearFilter;
      tex.generateMipmaps = false;
      face.map = tex;
      face.needsUpdate = true;
      shelfCoverReal = true;
      invalidate();
    });

    shelfBooks.rows.forEach((items, row) => {
      if (!items.length) return;
      const floorZ = ROW_FLOOR[row];
      const lastEnd = items[items.length - 1].x + items[items.length - 1].w;
      // Arriba se arriman a la cubierta; en las otras baldas, el último se apoya en sus vecinos si hay sitio
      const shift = row === 2 ? Math.max(0, COVER_X - coverWidth / 2 - 0.05 - (BALDA.x0 + lastEnd)) : 0;
      const roomLeft = 1.72 - lastEnd;
      items.forEach((item, k) => {
        const lean = row !== 2 && k === items.length - 1 && k > 0 && roomLeft > 0.14 ? 0.1 : 0;
        const x = BALDA.x0 + shift + item.x + item.w / 2 + (lean ? 0.045 : 0);
        const height = Math.min((row === 2 ? BALDA.ceiling - BALDA.z1 : 0.96) - 0.06, item.h);
        const z = floorZ + (lean ? (item.w / 2) * Math.sin(lean) : 0);
        const group = place(item.id, row, x, z, height, item.w, DEPTH, 0, lean);
        const geometry = own('geometries', new BoxGeometry(item.w, height, DEPTH));
        for (const side of [0, 1, 3, 5]) faceUv(geometry, side, atlas.side(item.id));
        faceUv(geometry, 2, atlas.pages);
        faceUv(geometry, 4, atlas.spine(item.id));
        const count = geometry.attributes.position.count;
        const colors = new Float32Array(count * 3);
        geometry.setAttribute('color', new BufferAttribute(colors, 3));
        const g = warmOf(x, floorZ + height / 2);
        warmers.push((lit) => {
          const k2 = lit ? g : 0;
          for (let v = 0; v < count; v += 1) colors.set([1 + 0.26 * k2, 1 + 0.08 * k2, 1 - 0.1 * k2], v * 3);
          geometry.attributes.color.needsUpdate = true;
        });
        const hit = new Mesh(geometry, spineMat);
        hit.userData = { id: 'estanteria' };
        group.add(hit);
        layer.add(group);
        shelfSpots.push({ id: item.id, row, group, hit, pull: 0 });
        meshesAdd(hit);
      });
      const from = BALDA.x0 + shift;
      plateOf(from + lastEnd / 2, floorZ, lastEnd + 0.14, DEPTH + 0.16);
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
    const tono = cat.tonos[item.tono];
    // Los frentes de los cajones y sus tiradores van pintados, no como patas
    const boxes = shapeOf(item.id, tono).filter((box) => item.id !== 'escritorio' || box.b[4] - box.b[1] > 0.1);
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
      if (item.id === 'escritorio' && !item.rot) {
        const front = new Mesh(own('geometries', new PlaneGeometry(0.65, 1)), tinted(new MeshBasicMaterial({ map: own('textures', drawerTexture(tono)) })));
        front.position.set(item.x + 0.425, lift + 0.6, item.y + 0.905);
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
    const table = room.items.find((i) => TABLES.has(i.id));
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
    const place = door ? (item.pared === 'fondo' ? (a, b) => [item.a + a, b] : (a, b) => [b, item.a + a]) : (a, b) => [a, b];
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
      if (Math.abs(delta) < YAW_MAX + REACH_MARGIN) return true;
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
    for (const w of warmers) w(hora !== 'dia');
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
    camera.position.copy(home.pos).addScaledVector(home.side, yaw * 0.1);
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
    invalidate();
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
        yaw = Math.max(-YAW_MAX, Math.min(YAW_MAX, press.yaw - dx * 0.004));
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
      const rect = canvas.getBoundingClientRect();
      ray.setFromCamera(new Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1), camera);
      // Una lámpara o una planta por delante no quitan el toque a lo que se puede usar
      const hits = ray.intersectObjects(meshes, false);
      const found = hits.find(({ object: { userData: u } }) => u.id === 'libro' || u.id === 'puerta-piso' || u.id === 'ordenador' || u.id === 'escritorio' || u.id === 'estanteria');
      const hit = found?.object.userData.id;
      if (hit === 'libro') onBook();
      else if (hit === 'puerta-piso') onDoor?.();
      else if (hit === 'ordenador' || (hit === 'escritorio' && room.guard?.locked(room.items.find((i) => i.uid === found.object.userData.uid)))) onDesk?.();
      else if (hit === 'estanteria') onShelf(found.point.y - heightOf(room, shelf) < 1.17 ? 0 : found.point.y - heightOf(room, shelf) < 2.27 ? 1 : 2);
    },
    on,
  );
  canvas.addEventListener(
    'keydown',
    (e) => {
      if (zoom || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
      e.preventDefault();
      yaw = Math.max(-YAW_MAX, Math.min(YAW_MAX, yaw + (e.key === 'ArrowLeft' ? -0.08 : 0.08)));
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
        for (const view of ROW_VIEW.rows) {
          const target = shelfPoint(ROW_VIEW.x, ROW_VIEW.y, view.z);
          const out2 = shelfPoint(1, 1, 0).sub(shelfPoint(1, 0, 0)).normalize();
          const across = shelfPoint(1, 0, 0).sub(shelfPoint(0, 0, 0)).normalize();
          const pos = target.clone().addScaledVector(out2, ROW_VIEW.dist).addScaledVector(across, ROW_VIEW.dist * ROW_VIEW.side);
          pos.y += view.up;
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
      const view = ROW_VIEW.rows[on2 ? row : 2];
      const target = shelfPoint(ROW_VIEW.x, ROW_VIEW.y, view.z);
      const out = shelfPoint(1, 1, 0).sub(shelfPoint(1, 0, 0)).normalize();
      const across = shelfPoint(1, 0, 0).sub(shelfPoint(0, 0, 0)).normalize();
      const pos = target.clone().addScaledVector(out, ROW_VIEW.dist).addScaledVector(across, ROW_VIEW.dist * ROW_VIEW.side);
      pos.y += view.up;
      return fly(on2 ? { pos, target } : null, TWEEN_MS, instant);
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
    /** Dónde poner una indicación junto al libro (o, sin libro, sobre la mesa), en px del contenedor. */
    bookAnchor() {
      const table = room.items.find((i) => TABLES.has(i.id));
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
    /** Saca un poco de su sitio el libro elegido y devuelve el anterior; con null, los devuelve todos. */
    selectBook(id) {
      cancelAnimationFrame(pullRaf);
      const set = (k) => {
        for (const s of shelfSpots) {
          s.pull += ((s.id === id ? PULL : 0) - s.pull) * k;
          s.hit.position.z = s.pull;
        }
        draw();
      };
      if (reduced()) return set(1);
      const t0 = performance.now();
      const step = (now) => {
        if (destroyed) return;
        const t = Math.min(1, (now - t0) / PULL_MS);
        set(t < 1 ? 0.35 : 1);
        if (t < 1) pullRaf = requestAnimationFrame(step);
      };
      pullRaf = requestAnimationFrame(step);
      return undefined;
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
    /** Coloca la mirada en un giro exacto y dibuja ya: lo usan las comprobaciones de parpadeo. */
    lookTo(value) {
      yaw = Math.max(-YAW_MAX, Math.min(YAW_MAX, value));
      draw();
    },
    /** Giro sostenido para medir la fluidez: fotogramas por segundo y percentil 95 del tiempo de fotograma. */
    measureYaw(ms = 3000) {
      return new Promise((resolve) => {
        const frames = [];
        const t0 = performance.now();
        let last = t0;
        const step = (now) => {
          frames.push(now - last);
          last = now;
          yaw = Math.sin((now - t0) / 700) * YAW_MAX;
          aim();
          renderer.render(scene, camera);
          if (destroyed || now - t0 >= ms) {
            frames.shift();
            const sorted = [...frames].sort((a, b) => a - b);
            const total = frames.reduce((s, v) => s + v, 0);
            yaw = 0;
            invalidate();
            resolve({ fps: Math.round((frames.length * 10000) / total) / 10, p95ms: Math.round(sorted[Math.floor(sorted.length * 0.95)] * 10) / 10, frames: frames.length });
          } else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    },
    /** Dónde tocar (px de la ventana) para alcanzar el libro, la estantería o, con 'balda', la cubierta en ella: lo usan las pruebas. */
    screenOf(what) {
      aim();
      camera.updateMatrixWorld();
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
        shelf: { coverReal: shelfCoverReal, books: shelfSpots.map((s) => s.id), rows: [0, 1, 2].map((r) => shelfSpots.filter((s) => s.row === r).length) },
        zoomed: Boolean(zoom),
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
