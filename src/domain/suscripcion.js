// La suscripción de Libotown (1.149): todavía no existe. Este es el único sitio de la app que dice si quien usa la app es
// suscriptor; en el servidor, su gemelo es `public.piso_es_suscriptor()` (migración 20261229120000_almacen_colecciones.sql).
// Hoy los dos dicen siempre «no». Cuando la suscripción exista, se enchufa aquí (y en esa función del servidor) sin tocar el
// catálogo ni los precios: economy.js pregunta a `esSuscriptor()` cada vez que calcula un precio de la colección premium.
// Decisión de Francisco (26-11-2026): la colección premium la ve todo el mundo, se compra con tickets a precios muy altos y
// quien pague la suscripción la tiene mucho más barata.

let estado = { suscriptor: false };

/** ¿Es suscriptor quien usa la app? Hoy, siempre no. */
export const esSuscriptor = () => estado.suscriptor === true;

/**
 * Para enchufar la suscripción más adelante: quien sepa la verdad (la cuenta, al sincronizar con el servidor) la apunta aquí.
 * Hoy no lo llama nadie. El servidor manda: si este valor y `piso_es_suscriptor()` no coinciden, la compra no cuadra y no se
 * cobra nada («almacen:precio»).
 */
export function fijarSuscripcion(suscriptor) {
  estado = { suscriptor: suscriptor === true };
}
