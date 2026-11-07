// La habitación de inicio es tu piso del edificio (1.88): el de tu cuenta, leído y guardado con el servicio del edificio
// (src/features/edificio/myPiso.js) y con sus permisos. Mientras se resuelve la sesión o llega el piso, `state` lo dice y
// no se enseña ningún piso; los del piloto (`labStore.js`) solo existen en el modo de demostración, con ?piloto=piso.
//
// Aquí no se repara nada: el piso se dibuja tal como está guardado. La puerta de salida y el ordenador, que solo existen
// en el piloto y el servidor no admite, se añaden solo al dibujo en primera persona y solo donde caben sin mover nada
// (`withDoorAndComputer`); nunca se guardan.
import { useEffect, useState } from 'react';
import { check, findFreeSpot } from '../edificio/room';
import { loadInventario } from '../edificio/service';
import { cachedMyPiso, loadMyPiso } from '../edificio/myPiso';
import { useCommunity } from '../social/hooks/useCommunity';
import './essentialItems';

/** Las piezas que solo se dibujan: si aparecen en un guardado, se quitan antes de enviarlo. */
export const DRAWN_ONLY = new Set(['puerta-piso', 'ordenador']);

/** Los datos de dibujo de tu piso: planta según la puerta; todas las ventanas dan a la fachada del hotel. */
export function pisoFrom(userId, mine) {
  const planta = Math.min(3, Math.max(1, Number(mine.puerta[0]) || 1));
  return { id: `cuenta:${userId}`, real: true, userId, edificio: mine.edificio, puerta: mine.puerta, planta, fachada: 'sur', propio: true, nombre: 'Tu piso', mira: 'fondo' };
}

/** Tu piso con la puerta de salida y el ordenador, solo para la vista en primera persona y solo si caben. */
export function withDoorAndComputer(room) {
  let items = room.items;
  let next = items.reduce((max, i) => Math.max(max, i.uid), 0) + 1;
  const add = (item) => {
    items = [...items, { ...item, uid: next }];
    next += 1;
  };
  if (!items.some((i) => i.id === 'puerta-piso')) {
    const spot = findFreeSpot({ ...room, items }, 'puerta-piso');
    if (spot) add(spot);
  }
  if (!items.some((i) => i.id === 'ordenador')) {
    for (const desk of items.filter((i) => i.id === 'escritorio')) {
      const pc = { uid: -1, id: 'ordenador', x: desk.x, y: desk.y, rot: desk.rot ?? 0, tono: 0 };
      if (check({ ...room, items }, pc).ok) {
        add(pc);
        break;
      }
    }
  }
  return items === room.items ? room : { ...room, items };
}

/** Lo que se guarda: sin las piezas que solo se dibujan. */
export const savable = (room) => (room.items.some((i) => DRAWN_ONLY.has(i.id)) ? { ...room, items: room.items.filter((i) => !DRAWN_ONLY.has(i.id)) } : room);

/**
 * `state`: 'loading' (sesión o piso en camino), 'signed-out' (sin cuenta o sin nube), 'no-member' (sin la comunidad
 * activada: el edificio es solo para quien la tiene), 'unavailable', 'error' o 'ready'. `piso` y `room`, solo en 'ready'.
 */
export function useMyPiso() {
  const community = useCommunity({ autoload: true });
  const { status, member, userId } = community;
  const [found, setFound] = useState(() => cachedMyPiso(userId));
  // { userId, attempt, text }: el fallo de esta cuenta y de este intento
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  // Mis copias de cada mueble, para Decorar como en el edificio ({ userId, inv }); null: sin la migración del inventario
  const [inventory, setInventory] = useState(null);
  const wanted = status === 'ready' && member && userId;

  useEffect(() => {
    if (!wanted) return undefined;
    let alive = true;
    loadMyPiso(userId).then(
      (p) => alive && setFound(p),
      (e) => alive && setError({ userId, attempt, text: e?.message || 'No se ha podido abrir tu piso.' }),
    );
    loadInventario().then(
      (inv) => alive && setInventory({ userId, inv }),
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [wanted, userId, attempt]);

  const failed = error && error.userId === userId && error.attempt === attempt ? error.text : '';
  // Lo de otra cuenta no se enseña nunca, ni un instante. Lo recordado manda: es lo último que has cambiado aquí
  const fresh = cachedMyPiso(userId) ?? found;
  const mine = fresh && fresh.userId === userId && fresh.room && fresh.puerta ? fresh : null;
  let state;
  if (status === 'off' || status === 'signed-out') state = 'signed-out';
  else if (status === 'unavailable' || status === 'error') state = 'unavailable';
  else if (status !== 'ready') state = 'loading';
  else if (!member) state = 'no-member';
  else if (failed) state = 'error';
  else if (!mine) state = 'loading';
  else state = 'ready';
  return {
    state,
    userId,
    piso: state === 'ready' ? pisoFrom(userId, mine) : null,
    room: state === 'ready' ? mine.room : null,
    inventory: inventory?.userId === userId ? inventory.inv : null,
    error: failed || community.error || '',
    retry: () => setAttempt((n) => n + 1),
  };
}
