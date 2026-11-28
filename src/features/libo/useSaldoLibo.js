// Libocoins, bloque 2 (docs/qa/libocoins.md): tu saldo, para la moneda que Libo lleva al lado. Se lee del dato común
// (`edificio/saldo.js`), que ya rellenan las respuestas del servidor que lo traen (el inventario de tu piso, la Lonja, la caja
// del almacén…). Al llegar a una escena, si lo último que se sabe tiene más de unos segundos, se pregunta una vez por el
// inventario (la misma consulta que tu piso); si falla (sin red, sin la migración), la moneda no sale.
import { useEffect, useSyncExternalStore } from 'react';
import { leerSaldo, oirSaldo } from '../edificio/saldo';
import { loadInventario } from '../edificio/service';

const FRESCO_MS = 10000;
let pidiendo = null;

/** El saldo de Libocoins (número) o null si no hay que enseñarlo (`activo` falso) o aún no se sabe. */
export function useSaldoLibo(activo) {
  const saldo = useSyncExternalStore(oirSaldo, leerSaldo, leerSaldo);
  useEffect(() => {
    if (!activo || pidiendo || Date.now() - leerSaldo().t < FRESCO_MS) return;
    pidiendo = loadInventario()
      .catch(() => null)
      .finally(() => {
        pidiendo = null;
      });
  }, [activo]);
  return activo ? saldo.tickets : null;
}
