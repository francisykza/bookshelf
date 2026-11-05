// El interior del piso en primera persona (piloto, solo en el laboratorio). Este módulo es el único que importa Three.js
// y se carga bajo demanda al cruzar la puerta. No tiene modelos propios: lee las mismas cajas de `furniture.js` y las
// mismas coordenadas, giros y colores del `layout` que dibuja `render.js`, así que lo que mueves en el editor es lo que
// ves aquí. La geometría de cada pieza del catálogo se comparte entre pisos; lo demás (materiales, texturas, luces y el
// lienzo) es de cada montaje y `destroy()` lo libera. Solo se dibuja cuando algo cambia.
import { AmbientLight, BoxGeometry, BufferGeometry, CanvasTexture, Color, DirectionalLight, DoubleSide, Float32BufferAttribute, Group, HemisphereLight, LinearFilter, Mesh, MeshBasicMaterial, MeshLambertMaterial, NearestFilter, PerspectiveCamera, PlaneGeometry, PointLight, Raycaster, SRGBColorSpace, Scene, Vector2, Vector3, WebGLRenderer } from 'three';
import { PAREDES, catalogItem } from '../edificio/catalog';
import { shapeOf } from '../edificio/furniture';
import { ROOM, heightOf } from '../edificio/room';
import { HORIZON, paintExterior } from './exterior';
import { contactShadowTexture, floorTexture, grainTexture, lampTexture, pixelLamp, upholsteredArmchair, upholsteryTexture, wallPlates, wallTexture } from './materials';

/** Ojos de una persona sentada: un poco por encima del respaldo del sillón (1,75 celdas, furniture.js). */
export const EYE = 1.85;
const FOV = 72;
/** Dónde te sientas, en coordenadas del sillón: pegado al respaldo y arrimado a un brazo, para verlo en primer plano. */
const SEAT = { lx: 0.7, ly: 0.75 };
/** Cabeza algo baja y girada hacia el centro de la habitación: menos techo y más mesa. */
/** Cuánto se espera a la cubierta para enseñar ya el piso con ella; si tarda más, llega después. */
const COVER_WAIT = 2200;
const TILT = 0.19;
const TURN = 0.06;
const ART_W = 320;
const YAW_MAX = 0.6;
const MAX_LAMPS = 4;
const TABLES = new Set(['mesa-baja', 'mesilla', 'mesa']);
const PANE = { x0: 0.2, x1: 1.8, z0: 1.5, z1: 3.2 };
const OUT_DEPTH = 6;
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

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

function catalogGeometry(item, cat) {
  const placing = cat.capa === 'pared' ? item.pared : item.rot;
  const key = `${item.id}|${item.tono}|${placing}`;
  if (!shared.has(key)) {
    const tono = cat.tonos[item.tono];
    let boxes = cat.capa === 'alfombra' ? [{ b: [0, 0, 0, cat.w, cat.d, 0.05], c: tono }] : shapeOf(item.id, tono);
    // La ventana real tiene hueco: su mar y su cielo pintados se cambian por la vista de verdad
    if (item.id === 'ventana') boxes = boxes.slice(3);
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
  tarde: { hemi: 1, hemiColor: '#f4e2dc', ambient: 0.16, sun: 0.62, sunColor: '#ffc4a4', lamp: 3, clear: '#d68078', fabric: '#e6dcda', brass: '#f2d8bc' },
  dia: { hemi: 1.55, hemiColor: '#fff1d6', ambient: 0, sun: 1.35, sunColor: '#ffe6bf', lamp: 1.5, clear: '#b8d5e2', fabric: '#ffffff', brass: '#ffffff' },
  noche: { hemi: 0.5, hemiColor: '#6f7099', ambient: 0.35, sun: 0.1, sunColor: '#ffe6bf', lamp: 6, clear: '#14142a', fabric: '#8a86a0', brass: '#a08878' },
};

/** Una cubierta de tela con el título, como la de un libro sin portada en el resto de la app. */
function clothCover({ title, color }) {
  const c = document.createElement('canvas');
  c.width = 136;
  c.height = 200;
  const g = c.getContext('2d');
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#f3e7c8';
  g.textAlign = 'center';
  g.font = 'bold 22px serif';
  const words = String(title).split(' ');
  words.forEach((w, k) => g.fillText(w, c.width / 2, 92 + (k - (words.length - 1) / 2) * 26, c.width - 16));
  return c;
}

/**
 * `room`, `piso`: el layout y sus datos. `ventanas`: de `ventanasDe`. `book`: { title, color, thickness, height } de tu
 * lectura actual (en un piso ajeno, null). Avisa con `onBook()`, `onShelf()` y `onLost()` (se ha perdido la GPU).
 * Lanza un error si no se puede crear WebGL: quien monta ofrece entonces la salida en HTML.
 */
export async function mountInterior(container, { room, piso, ventanas, book = null, hora: startHora = 'tarde', onBook = () => {}, onShelf = () => {}, onLost = () => {} }) {
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
  let zoom = null; // { pos, target }: mirando la balda de cerca
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
    if (!cat) continue;
    const geometry = catalogGeometry(item, cat);
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

  // La veta de las mesas: sobre su tablero real, con la rampa de su color
  for (const item of room.items) {
    if (!TABLES.has(item.id)) continue;
    const cat = catalogItem(item.id);
    const top = shapeOf(item.id, cat.tonos[item.tono]).reduce((a, b) => (b.b[5] > a.b[5] ? b : a));
    const [x0, y0, , x1, y1, z1] = turned(cat, item.rot, top.b);
    const tex = own('textures', grainTexture(cat.tonos[item.tono], item.uid));
    if (y1 - y0 > x1 - x0) {
      tex.center.set(0.5, 0.5);
      tex.rotation = Math.PI / 2;
    }
    const plate = new Mesh(own('geometries', new PlaneGeometry(x1 - x0, y1 - y0)), own('materials', new MeshLambertMaterial({ map: tex })));
    plate.rotation.x = -Math.PI / 2;
    plate.position.set(item.x + (x0 + x1) / 2, heightOf(room, item) + z1 + 0.003, item.y + (y0 + y1) / 2);
    plate.userData = { id: item.id };
    furniture.add(plate);
  }

  // Tu lectura actual: sobre la mesa si hay una; si no, en el brazo del sillón
  let bookGroup = null;
  let coverReal = false;
  let coverReady = Promise.resolve();
  if (book) {
    const table = room.items.find((i) => TABLES.has(i.id));
    const chair = room.items.find((i) => i.id === 'sillon');
    const spot = table ?? chair;
    if (spot) {
      const cat = catalogItem(spot.id);
      const top = table ? (cat.sup ?? 0.7) : 1.12;
      const [bx, bz] = table ? [spot.x + cat.w / 2, spot.y + cat.d / 2] : [spot.x + 0.3, spot.y + 1.2];
      const t = Math.max(0.1, book.thickness);
      const size = 0.62 * book.height;
      // Dos tapas y el lomo de su color, y entre ellas las páginas, para que se lea como un libro y no como un cojín
      const plate = Math.max(0.02, t * 0.16);
      const plateGeo = own('geometries', new BoxGeometry(size * 0.68, plate, size));
      const spineGeo = own('geometries', new BoxGeometry(plate, t, size));
      const coverMat = own('materials', new MeshLambertMaterial({ color: book.color }));
      const pagesGeo = own('geometries', new BoxGeometry(size * 0.64, t - plate * 2, size * 0.96));
      const pagesMat = own('materials', new MeshLambertMaterial({ color: '#efe3c6' }));
      const pickGeo = own('geometries', new BoxGeometry(1.1, 0.7, 1.2));
      bookGroup = new Group();
      bookGroup.position.set(bx, top + t / 2 + 0.008, bz);
      bookGroup.rotation.y = 0.18;
      // La tapa de arriba es la cubierta de tu lectura; mientras llega, o si no la hay, tela con su título
      const coverTex = own('textures', new CanvasTexture(clothCover(book)));
      coverTex.colorSpace = SRGBColorSpace;
      const coverFace = own('materials', new MeshLambertMaterial({ map: coverTex }));
      coverReady = Promise.resolve(book.coverLoad).then((image) => {
        if (!image || destroyed) return;
        // Reducida de antemano y con suavizado: en la mesa se ve pequeña y, si no, sus letras se rompen
        const small = document.createElement('canvas');
        small.width = 180;
        small.height = 270;
        const g = small.getContext('2d');
        g.imageSmoothingQuality = 'high';
        g.drawImage(image, 0, 0, small.width, small.height);
        const tex = own('textures', new CanvasTexture(small));
        tex.colorSpace = SRGBColorSpace;
        tex.minFilter = LinearFilter;
        tex.generateMipmaps = false;
        coverFace.map = tex;
        coverFace.needsUpdate = true;
        coverReal = true;
        invalidate();
      });
      const coverTop = new Mesh(plateGeo, [coverMat, coverMat, coverFace, coverMat, coverMat, coverMat]);
      coverTop.position.y = (t - plate) / 2;
      const coverBottom = new Mesh(plateGeo, coverMat);
      coverBottom.position.y = -(t - plate) / 2;
      const spine = new Mesh(spineGeo, coverMat);
      spine.position.x = -size * 0.34 + plate / 2;
      const pages = new Mesh(pagesGeo, pagesMat);
      const hit = new Mesh(pickGeo, pick);
      for (const m of [coverTop, coverBottom, spine, pages, hit]) m.userData = { id: 'libro' };
      // Sombra de contacto, un poco hacia ti: la lámpara y la ventana están delante
      const shadowMap = own('textures', contactShadowTexture());
      const shadow = new Mesh(own('geometries', new PlaneGeometry(size * 0.68 + 0.2, size + 0.2)), own('materials', new MeshBasicMaterial({ map: shadowMap, color: '#1a0d08', transparent: true, depthWrite: false })));
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.set(0.012, -t / 2 - 0.004, 0.022);
      bookGroup.add(coverTop, coverBottom, spine, pages, hit, shadow);
      scene.add(bookGroup);
      meshes.push(hit);
    }
  }

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

  // Lo que se ve por cada ventana, a cierta distancia para que tenga profundidad al mirar
  const outGeo = own('geometries', new PlaneGeometry(1, 1));
  const outside = [];
  const horizonInfo = [];
  async function paintWindows() {
    for (const v of ventanas) {
      const canvas2d = await paintExterior(v.vista, hora);
      if (destroyed) return;
      const tex = new CanvasTexture(canvas2d);
      tex.colorSpace = SRGBColorSpace;
      tex.magFilter = NearestFilter;
      tex.minFilter = LinearFilter;
      tex.generateMipmaps = false;
      let entry = outside.find((o) => o.uid === v.uid);
      if (entry) {
        entry.material.map.dispose();
        entry.material.map = tex;
        entry.material.needsUpdate = true;
        continue;
      }
      const material = new MeshBasicMaterial({ map: tex, side: DoubleSide });
      const mesh = new Mesh(outGeo, material);
      const s = v.a + (PANE.x0 + PANE.x1) / 2;
      const midZ = (PANE.z0 + PANE.z1) / 2;
      const wallPoint = v.pared === 'fondo' ? new Vector3(s, midZ, 0) : new Vector3(0, midZ, s);
      const ray = wallPoint.clone().sub(home.pos);
      const flat = v.pared === 'fondo' ? -home.pos.z : -home.pos.x;
      const k = (flat - OUT_DEPTH) / flat;
      const centre = home.pos.clone().add(ray.clone().multiplyScalar(k));
      const size = (PANE.x1 - PANE.x0) * k * 2.6;
      // El horizonte queda a la altura de los ojos más lo que diga su planta
      const horizonY = EYE + v.horizonte;
      centre.y = horizonY + (HORIZON - 0.5) * size;
      mesh.position.copy(centre);
      mesh.scale.set(size, size, 1);
      if (v.pared === 'izq') mesh.rotation.y = Math.PI / 2;
      scene.add(mesh);
      entry = { uid: v.uid, material, mesh };
      outside.push(entry);
      horizonInfo.push({ uid: v.uid, pared: v.pared, vista: v.vista, hotel: v.hotel, horizonY });
    }
    invalidate();
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

  function draw() {
    raf = 0;
    if (destroyed) return;
    aim();
    renderer.render(scene, camera);
  }
  function invalidate() {
    if (!raf && !destroyed) raf = requestAnimationFrame(draw);
  }

  function resize() {
    const rect = container.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const h = Math.max(1, Math.round((ART_W * rect.height) / rect.width));
    renderer.setSize(ART_W, h, false);
    camera.aspect = rect.width / rect.height;
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
      press = { x: e.clientX, y: e.clientY, yaw, moved: false };
      canvas.setPointerCapture?.(e.pointerId);
    },
    on,
  );
  canvas.addEventListener(
    'pointermove',
    (e) => {
      if (!press || zoom) return;
      const dx = e.clientX - press.x;
      if (Math.abs(dx) > 6) press.moved = true;
      if (press.moved) {
        yaw = Math.max(-YAW_MAX, Math.min(YAW_MAX, press.yaw - dx * 0.004));
        invalidate();
      }
    },
    on,
  );
  canvas.addEventListener('pointercancel', () => (press = null), on);
  canvas.addEventListener(
    'pointerup',
    (e) => {
      const tapped = press && !press.moved;
      press = null;
      if (!tapped || zoom) return;
      const rect = canvas.getBoundingClientRect();
      ray.setFromCamera(new Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1), camera);
      const hit = ray.intersectObjects(meshes, false)[0]?.object.userData.id;
      if (hit === 'libro') onBook();
      else if (hit === 'estanteria') onShelf();
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
      e.preventDefault();
      onLost();
    },
    on,
  );

  const observer = new ResizeObserver(resize);
  observer.observe(container);
  applyLight();
  resize();
  // El piso se enseña entero: con su vista por la ventana y, si llega a tiempo, con la cubierta sobre la mesa
  await paintWindows();
  if (destroyed) return null;
  await Promise.race([coverReady, new Promise((resolve) => setTimeout(resolve, COVER_WAIT))]);
  if (destroyed) return null;
  container.append(canvas);
  draw();

  const shelf = room.items.find((i) => i.id === 'estanteria');
  const shelfPoint = (lx, ly, lz) => {
    const cat = catalogItem('estanteria');
    const [a, b] = turned(cat, shelf.rot, [lx, ly, 0, lx, ly, 0]);
    return new Vector3(shelf.x + a, lz, shelf.y + b);
  };

  return {
    canvas,
    hasShelf: Boolean(shelf),
    setHora(value) {
      hora = value;
      applyLight();
      paintWindows();
      invalidate();
    },
    /** Acerca la cámara a la balda (o la devuelve al sillón); termina cuando ha llegado. */
    zoomShelf(on2) {
      cancelAnimationFrame(tween);
      if (!shelf) return Promise.resolve();
      // De cerca solo cuenta la estantería: lo que se interponga (el sillón, el libro) no tapa la balda
      for (const m of furniture.children) m.visible = !on2 || m.userData.id === 'estanteria' || catalogItem(m.userData.id)?.capa === 'pared';
      if (bookGroup) bookGroup.visible = !on2;
      const finish = (value) => {
        zoom = value;
        draw();
      };
      if (!on2) {
        finish(null);
        return Promise.resolve();
      }
      const target = shelfPoint(1, 0.9, 1.75);
      const out = shelfPoint(1, 1, 1.75).sub(shelfPoint(1, 0.9, 1.75)).normalize();
      const end = { pos: target.clone().addScaledVector(out, 3.1), target };
      if (reduced()) {
        finish(end);
        return Promise.resolve();
      }
      aim();
      const from = camera.position.clone();
      const look = camera.position.clone().add(camera.getWorldDirection(new Vector3()).multiplyScalar(4));
      const t0 = performance.now();
      return new Promise((resolve) => {
        const step = (now) => {
          if (destroyed) return resolve();
          const t = Math.min(1, (now - t0) / 420);
          const e = t * t * (3 - 2 * t);
          finish({ pos: from.clone().lerp(end.pos, e), target: look.clone().lerp(end.target, e) });
          if (t < 1) tween = requestAnimationFrame(step);
          else resolve();
        };
        tween = requestAnimationFrame(step);
      });
    },
    /** Dónde caen en pantalla (px dentro del contenedor) `n` portadas de frente en la balda del medio. */
    coverSlots(n) {
      if (!shelf) return [];
      const rect = container.getBoundingClientRect();
      const project = (p) => {
        const q = p.clone().project(camera);
        return { x: ((q.x + 1) / 2) * rect.width, y: ((1 - q.y) / 2) * rect.height };
      };
      const width = 1.6 / n;
      return Array.from({ length: n }, (_, k) => {
        const a = project(shelfPoint(0.2 + k * width + 0.02, 1, 2.1));
        const b = project(shelfPoint(0.2 + (k + 1) * width - 0.02, 1, 1.26));
        return { left: Math.min(a.x, b.x), top: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) };
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
    /** Dónde tocar (px de la ventana) para alcanzar el libro o la estantería: lo usan las pruebas. */
    screenOf(what) {
      aim();
      camera.updateMatrixWorld();
      const point = what === 'libro' ? bookGroup?.position.clone() : shelf && shelfPoint(1.7, 1, 1.75);
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
        book: bookGroup ? { color: book.color, coverReal } : null,
        hora,
        eye: camera.position.y,
      };
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(tween);
      stop.abort();
      observer.disconnect();
      for (const o of outside) {
        o.material.map.dispose();
        o.material.dispose();
      }
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
