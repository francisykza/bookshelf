// Tu piso del edificio (1.88): el mismo para la habitación de inicio (primera persona, vista de siempre y Decorar) y para
// el edificio. Se lee y se guarda con el servicio de siempre (`loadEdificio`, `savePiso`), con sus permisos: solo el tuyo
// se escribe y el servidor lo valida. Lo último que esta pestaña sabe de él se recuerda en memoria, separado por usuario,
// para que pasar de una vista a otra no enseñe una versión anterior mientras llega la del servidor. Al cambiar de cuenta
// o cerrar sesión se olvida (`forgetMyPiso`, desde CommunityProvider). Nada de esto va a localStorage.
import { starterRoom } from './demo';
import { cachedMyPiso, rememberMyPiso } from './myPisoCache';
import { loadEdificio, savePiso } from './service';

export { cachedMyPiso, rememberMyPiso };

let queue = Promise.resolve();

/** Guarda tu piso, en orden: un guardado no adelanta al anterior aunque vengan de vistas distintas. */
export function saveMyPiso(userId, room) {
  rememberMyPiso(userId, { room });
  const job = queue.then(() => savePiso(userId, room));
  queue = job.catch(() => {});
  return job;
}

/**
 * Del portal que acaba de llegar, tu piso tal como lo tiene esta pestaña: si lo has cambiado aquí, esa versión (su
 * guardado puede ir aún de camino); si es la primera vez y no tienes piso, el de partida, guardado ya (como siempre en el
 * edificio). Devuelve el portal con tu `room` puesto.
 */
export function adoptMyPiso(userId, data) {
  const me = data.vecinos.find((v) => v.yo);
  if (!me) return data;
  const known = cachedMyPiso(userId)?.room;
  if (known) me.room = known;
  else if (!me.room) {
    me.room = starterRoom();
    saveMyPiso(userId, me.room).catch(() => {});
  }
  rememberMyPiso(userId, { edificio: data.edificio, puerta: data.puerta, room: me.room });
  return data;
}

/** Tu piso para la habitación de inicio: de memoria si ya está; si no, del servidor. */
export async function loadMyPiso(userId) {
  const known = cachedMyPiso(userId);
  if (known?.room && known.puerta) return known;
  const data = await loadEdificio();
  adoptMyPiso(userId, data);
  return cachedMyPiso(userId);
}
