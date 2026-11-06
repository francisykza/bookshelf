// Piloto «Del portal al sillón» (solo en el laboratorio): los dos pisos de prueba y su guardado local. Los campos son los
// del edificio real (docs/qa/piso-primera-persona.md): edificio y puerta (planta + letra) identifican el piso, y su
// `layout` es el mismo de `room.js`: uid, id, x, y, rot, tono (o pared y a, en la pared). Todo pasa por `validateRoom`,
// igual que en `savePiso` de service.js; lo único que cambia es el destino: este navegador y nunca Supabase.
import { catalogItem, isMistico } from '../edificio/catalog';
import './essentialItems';
import { LAYOUTS, repairRoom, withGuard } from './essentials';
import { shapeOf } from '../edificio/furniture';
import { createRoom, exportRoom, importRoom, validateRoom } from '../edificio/room';

// «plano2»: los pisos de prueba cambiaron de distribución; un guardado del plano anterior dejaría el sillón mirando a la pared
const KEY = (id) => `bookshelf:lab:piso-primera-persona:plano2:${id}`;
/** Lo que al reparar una distribución no ha cabido en ningún sitio: se vuelve a intentar en cada carga. */
const STORED_KEY = (id) => `${KEY(id)}:sin-sitio`;
/** La distribución tal como estaba antes de la primera reparación. */
const BEFORE_KEY = (id) => `${KEY(id)}:antes`;

/** Altura del horizonte en el hueco por planta, respecto a los ojos (en celdas de la habitación). Sube poco, para que la corona del hotel siga dentro del hueco; lo que más baja con la planta son los tejados: `ALTURAS`. */
export const PLANTAS = { 1: { horizonte: 0.45 }, 2: { horizonte: 0.49 }, 3: { horizonte: 0.53 } };
/** Qué se ve desde cada pared según la fachada a la que da el piso. Solo `hotel` enseña el Gran Hotel. */
export const FACHADAS = {
  sur: { fondo: 'hotel', izq: 'mar' },
  norte: { fondo: 'mar', izq: 'monte' },
};

let uid = 0;
const f = (id, x, y, rot = 0, tono = 0) => ({ uid: (uid += 1), id, x, y, rot, tono });
const w = (id, pared, a, tono = 0) => ({ uid: (uid += 1), id, pared, a, tono });

function seed(pared, suelo, items) {
  uid = 0;
  const room = validateRoom(createRoom({ pared, suelo, items: items() }));
  if (!room) throw new Error('Piso de prueba no válido');
  return room;
}

export const PISOS = [
  {
    id: 'lab-1A',
    edificio: 'lab',
    puerta: '1A',
    planta: 1,
    fachada: 'sur',
    propio: true,
    nombre: 'Tu piso',
    // La pared a la que mira la cámara al entrar
    mira: 'fondo',
    seed: () =>
      seed('yeso', 'tablas', () => [
        f('alfombra', 2, 2),
        f('estanteria', 0, 0),
        // El sillón es donde estás sentado: mira a la ventana (giro 2), con la mesa al alcance de la mano
        f('sillon', 2, 4, 2),
        f('lampara-pie', 2, 0),
        f('mesa-baja', 2, 3),
        f('planta-grande', 8, 2),
        f('escritorio', 5, 0),
        f('ordenador', 5, 0),
        w('ventana', 'fondo', 3),
        w('ventana', 'izq', 5),
        w('puerta-piso', 'fondo', 7),
      ]),
  },
  {
    id: 'lab-2B',
    edificio: 'lab',
    puerta: '2B',
    planta: 2,
    fachada: 'norte',
    propio: false,
    nombre: 'Vecina de prueba',
    mira: 'izq',
    seed: () =>
      seed('salvia', 'damero', () => [
        f('estanteria', 0, 7, 3, 1),
        f('sillon', 2, 2, 1, 1),
        f('lampara-pie', 0, 2, 0, 1),
        f('planta-grande', 0, 0, 0, 1),
        f('mesilla', 6, 0),
        f('mesa-baja', 1, 2, 1),
        f('escritorio', 3, 0),
        f('ordenador', 3, 0),
        w('ventana', 'izq', 2, 1),
        w('cuadro', 'fondo', 3, 1),
        w('puerta-piso', 'izq', 5),
      ]),
  },
];

export const pisoById = (id) => PISOS.find((p) => p.id === id) ?? null;
export const doorLabel = (p) => `${p.puerta[0]}.º ${p.puerta[1]}`;
/** Permiso: mirar, cualquiera; editar, solo quien vive allí (como `editable={mine}` en EdificioPanel). */
export const canEdit = (piso) => Boolean(piso?.propio);

// Lo que se ha completado desde la última vez que se preguntó, para decirlo una sola vez
const lastRepair = new Map();

function readStored(piso) {
  try {
    const list = JSON.parse(localStorage.getItem(STORED_KEY(piso.id)) ?? '[]');
    return Array.isArray(list) ? list.filter((i) => i && Number.isInteger(i.uid) && catalogItem(i.id)) : [];
  } catch {
    return [];
  }
}

/** El piso con sus elementos esenciales: una distribución antigua se completa sin perder lo que tenía. */
export function loadRoom(piso) {
  let saved = null;
  try {
    saved = localStorage.getItem(KEY(piso.id));
  } catch {
    // Sin almacenamiento, el piso de partida
  }
  const layout = LAYOUTS[piso.id];
  const before = readStored(piso);
  const fixed = repairRoom((saved && importRoom(saved)) || piso.seed(), layout, before);
  if (saved && fixed.changed && canEdit(piso)) {
    try {
      if (!localStorage.getItem(BEFORE_KEY(piso.id))) localStorage.setItem(BEFORE_KEY(piso.id), saved);
    } catch {
      // Sin sitio para la copia: la reparación no borra nada de todos modos
    }
    saveRoom(piso, fixed.room);
    if (fixed.added.length || fixed.moved.length) lastRepair.set(piso.id, { added: fixed.added, moved: fixed.moved.length });
  }
  if (canEdit(piso) && JSON.stringify(before) !== JSON.stringify(fixed.stored)) {
    try {
      if (fixed.stored.length) localStorage.setItem(STORED_KEY(piso.id), JSON.stringify(fixed.stored));
      else localStorage.removeItem(STORED_KEY(piso.id));
    } catch {
      // Sigue en memoria hasta la próxima carga
    }
  }
  return withGuard(fixed.room, layout);
}

/** Qué se ha completado y cuántos objetos siguen sin sitio. Lo primero, solo la primera vez que se pregunta. */
export function repairNews(piso) {
  const news = lastRepair.get(piso.id) ?? { added: [], moved: 0 };
  lastRepair.delete(piso.id);
  return { ...news, stored: readStored(piso).length };
}

/** Vuelve a la distribución de partida, que ya trae los esenciales. */
export function resetRoom(piso) {
  try {
    localStorage.removeItem(KEY(piso.id));
    localStorage.removeItem(STORED_KEY(piso.id));
  } catch {
    // Sin almacenamiento, ya estaba en la de partida
  }
  return loadRoom(piso);
}

/** Guarda un piso propio, limpio. Devuelve si se ha guardado; el de un vecino nunca se escribe. */
export function saveRoom(piso, room) {
  if (!canEdit(piso)) return false;
  const clean = validateRoom(room);
  if (!clean) return false;
  try {
    localStorage.setItem(KEY(piso.id), exportRoom(clean));
    return true;
  } catch {
    return false;
  }
}

/** Datos mínimos de las puertas del portal: nada de libros, portadas ni Three.js. */
export const portalFlats = () => PISOS.map((piso) => ({ piso, room: loadRoom(piso) }));

/** Ventanas del piso con lo que se ve desde cada una. */
export function ventanasDe(piso, room) {
  return room.items
    .filter((i) => i.id === 'ventana')
    .map((i) => {
      const vista = FACHADAS[piso.fachada][i.pared];
      return { uid: i.uid, pared: i.pared, a: i.a, tono: i.tono, vista, hotel: vista === 'hotel', planta: piso.planta, horizonte: PLANTAS[piso.planta].horizonte, plants: room.items.some((p) => p.id === 'planta-grande' || p.id === 'planta-pequena') };
    });
}

/** Lo que aún no se puede ver bien por dentro: se avisa y queda la vista de siempre como salida. */
export function pendientes(room) {
  const out = new Map();
  for (const item of room.items) {
    const cat = catalogItem(item.id);
    if (!cat) continue;
    const sinForma = cat.capa !== 'alfombra' && shapeOf(item.id, cat.tonos[item.tono]).length === 0;
    if (sinForma || isMistico(cat) || item.acabado) out.set(item.id, cat.nombre);
  }
  return [...out.values()];
}
