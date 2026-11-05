// Piloto «Del portal al sillón» (solo en el laboratorio): los dos pisos de prueba y su guardado local. Los campos son los
// del edificio real (docs/qa/piso-primera-persona.md): edificio y puerta (planta + letra) identifican el piso, y su
// `layout` es el mismo de `room.js`: uid, id, x, y, rot, tono (o pared y a, en la pared). Todo pasa por `validateRoom`,
// igual que en `savePiso` de service.js; lo único que cambia es el destino: este navegador y nunca Supabase.
import { catalogItem, isMistico } from '../edificio/catalog';
import { shapeOf } from '../edificio/furniture';
import { createRoom, exportRoom, importRoom, validateRoom } from '../edificio/room';

// «plano2»: los pisos de prueba cambiaron de distribución; un guardado del plano anterior dejaría el sillón mirando a la pared
const KEY = (id) => `bookshelf:lab:piso-primera-persona:plano2:${id}`;

/** Altura del horizonte por planta, respecto a los ojos (en celdas de la habitación). */
export const PLANTAS = { 1: { horizonte: -0.15 }, 2: { horizonte: 0.1 }, 3: { horizonte: 0.35 } };
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
        f('planta-grande', 7, 0),
        w('ventana', 'fondo', 3),
        w('ventana', 'izq', 5),
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
        f('lampara-pie', 1, 4, 0, 1),
        f('planta-grande', 0, 0, 0, 1),
        f('mesilla', 6, 0),
        w('ventana', 'izq', 2, 1),
        w('cuadro', 'fondo', 3, 1),
      ]),
  },
];

export const pisoById = (id) => PISOS.find((p) => p.id === id) ?? null;
export const doorLabel = (p) => `${p.puerta[0]}.º ${p.puerta[1]}`;
/** Permiso: mirar, cualquiera; editar, solo quien vive allí (como `editable={mine}` en EdificioPanel). */
export const canEdit = (piso) => Boolean(piso?.propio);

export function loadRoom(piso) {
  let saved = null;
  try {
    saved = localStorage.getItem(KEY(piso.id));
  } catch {
    // Sin almacenamiento, el piso de partida
  }
  return (saved && importRoom(saved)) || piso.seed();
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
      return { uid: i.uid, pared: i.pared, a: i.a, tono: i.tono, vista, hotel: vista === 'hotel', horizonte: PLANTAS[piso.planta].horizonte };
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
