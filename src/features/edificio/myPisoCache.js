// Lo último que esta pestaña sabe de tu piso (1.88, ver myPiso.js): solo en memoria y separado por usuario. Sin
// dependencias, para que CommunityProvider pueda olvidarlo al cambiar de cuenta sin cargar el edificio al arrancar.

/** { userId, edificio, puerta, room } o null. */
let mine = null;

/** Lo recordado de tu piso, solo si es de esta cuenta. */
export const cachedMyPiso = (userId) => (userId && mine?.userId === userId ? mine : null);

export function rememberMyPiso(userId, patch) {
  if (!userId) return;
  mine = { ...(cachedMyPiso(userId) ?? {}), ...patch, userId };
}

/** Cambio de cuenta o cierre de sesión: fuera lo del usuario anterior. */
export function forgetMyPiso() {
  mine = null;
}
