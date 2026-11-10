// 1.102 (SPEC §102) · La ropa del probador del almacén: qué filas hay, qué se puede poner y si has cambiado algo.
import { COMPLEMENTOS, JERSEYS, PANTALONES, PRENDAS, ROPA_CASINO, ROPA_ESTIBA, ROPA_TIENDA, isPrenda, prendaKey } from '../actor';

/** Las filas del probador: solo la ropa (el pelo y la piel se cambian en el armario de tu piso). */
export const FILAS_ROPA = [
  { key: 'jersey', nombre: 'Jersey', frame: 'torso', options: JERSEYS.map((p) => ({ value: p.id, nombre: p.nombre })) },
  { key: 'pantalon', nombre: 'Pantalón', frame: 'legs', options: PANTALONES.map((p) => ({ value: p.id, nombre: p.nombre })) },
  {
    key: 'gafas',
    nombre: 'Gafas',
    frame: 'head',
    options: [
      { value: false, nombre: 'Sin gafas' },
      { value: true, nombre: 'Con gafas' },
    ],
  },
  { key: 'complemento', nombre: 'Complementos', corto: 'Extras', frame: 'head', options: COMPLEMENTOS.map((p) => ({ value: p.id, nombre: p.nombre })) },
];
const ROPA_KEYS = new Set(FILAS_ROPA.map((f) => f.key));
/** Toda la ropa que se gana (misiones, casino y estiba) o se compra (la planta de ropa), para contar cuánta tienes. */
export const GANABLES = [...PRENDAS, ...ROPA_CASINO, ...ROPA_ESTIBA, ...Object.keys(ROPA_TIENDA)].filter((p) => ROPA_KEYS.has(p.split(':')[0]));

/** Lo que se puede poner de una fila: lo de serie, lo ganado y lo que ya llevas puesto. */
export function opcionesDe(fila, prendas, base) {
  return fila.options.filter((o) => !isPrenda(fila.key, o.value) || (prendas ?? []).includes(prendaKey(fila.key, o.value)) || base[fila.key] === o.value);
}

export const mismoLook = (a, b) => FILAS_ROPA.every((f) => a?.[f.key] === b?.[f.key]);

