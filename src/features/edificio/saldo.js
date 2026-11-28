// Libocoins, bloques 2 y 3 (docs/qa/libocoins.md): el saldo que se ve junto a Libo. Un solo dato para toda la app, sin React ni
// servidor: lo publica cada respuesta del servidor que trae el saldo (el inventario, la Lonja, la caja del almacén…) y lo leen
// quienes lo enseñan. Al cambiar de cuenta o cerrar sesión se olvida (useCommunity), para no enseñar nunca el de otra cuenta.
// Bloque 3: si el saldo sube respecto al último que se sabía, se apunta lo ganado hasta que Libo lo celebra (`tomarGanado`).
// La primera cifra de una sesión nunca cuenta como ganada: es lo que ya tenías.

let actual = { tickets: null, t: 0, ganado: 0 };
const oyentes = new Set();
const avisar = () => oyentes.forEach((f) => f());

/** Apunta el saldo que acaba de dar el servidor. Lo que no sea una cifra válida no cambia nada. */
export function publicarSaldo(tickets) {
  if (!Number.isInteger(tickets) || tickets < 0) return;
  const antes = actual.tickets;
  const sube = antes !== null && tickets > antes ? tickets - antes : 0;
  // Lo que aún no se ha celebrado nunca supera el saldo (si se gasta antes de verlo, se celebra menos)
  const ganado = Math.min(tickets, actual.ganado + sube);
  if (antes === tickets && ganado === actual.ganado) {
    actual = { ...actual, t: Date.now() };
    return;
  }
  actual = { tickets, t: Date.now(), ganado };
  avisar();
}

/** Lo ganado y aún sin celebrar; al tomarlo queda a cero. */
export function tomarGanado() {
  const g = actual.ganado;
  if (g) {
    actual = { ...actual, ganado: 0 };
    avisar();
  }
  return g;
}

/** Olvida el saldo (cambio de cuenta, cierre de sesión o las pruebas). */
export function olvidarSaldo() {
  actual = { tickets: null, t: 0, ganado: 0 };
  avisar();
}

/** { tickets: número o null, t: cuándo llegó (ms), ganado }. El mismo objeto mientras no cambie (para useSyncExternalStore). */
export const leerSaldo = () => actual;

export function oirSaldo(f) {
  oyentes.add(f);
  return () => oyentes.delete(f);
}
