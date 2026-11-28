// Libocoins, bloque 2 (docs/qa/libocoins.md): el saldo que se ve junto a Libo. Un solo dato para toda la app, sin React ni
// servidor: lo publica cada respuesta del servidor que trae el saldo (el inventario, la Lonja, la caja del almacén…) y lo leen
// quienes lo enseñan. Al cambiar de cuenta o cerrar sesión se olvida (useCommunity), para no enseñar nunca el de otra cuenta.

let actual = { tickets: null, t: 0 };
const oyentes = new Set();

/** Apunta el saldo que acaba de dar el servidor. Lo que no sea una cifra válida no cambia nada. */
export function publicarSaldo(tickets) {
  if (!Number.isInteger(tickets) || tickets < 0) return;
  actual = { tickets, t: Date.now() };
  oyentes.forEach((f) => f());
}

/** Olvida el saldo (cambio de cuenta, cierre de sesión o las pruebas). */
export function olvidarSaldo() {
  actual = { tickets: null, t: 0 };
  oyentes.forEach((f) => f());
}

/** { tickets: número o null, t: cuándo llegó (ms) }. El mismo objeto mientras no cambie (para useSyncExternalStore). */
export const leerSaldo = () => actual;

export function oirSaldo(f) {
  oyentes.add(f);
  return () => oyentes.delete(f);
}
