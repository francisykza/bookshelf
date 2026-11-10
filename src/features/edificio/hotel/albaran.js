// «Sella el albarán», el minijuego de la caja del almacén (1.99, §99): tres planos pasan por el mostrador y se sellan
// cuando su casilla queda bajo la marca del sello. Los tiempos son los del servidor (`piso_almacen_tiempos`): el reloj
// cuenta desde que empezó el albarán, así que recargar no da otra pasada. Con «sin prisa» el plano avanza a saltos de un
// segundo y la casilla buena se queda quieta bajo la marca un segundo entero: no hacen falta reflejos rápidos.

export const ALBARAN = { previo: 1500, plano: { rapido: 3800, sinprisa: 9000 }, margen: 2500 };
/** Descuento según los planos acertados (0, 1, 2 o 3). */
export const DESCUENTOS = [0, 3, 6, 10];
/** Dónde está la marca del sello en cada plano (fracción del recorrido). */
export const MARCAS = [0.62, 0.38, 0.5];
/** Pasos de «sin prisa»: uno por segundo. */
export const PASOS = 9;
/** Margen de acierto en el modo normal (fracción del recorrido, a cada lado de la marca). */
export const TOLERANCIA = 0.075;

const ms = (modo) => ALBARAN.plano[modo] ?? ALBARAN.plano.rapido;
/** La marca de un plano: en «sin prisa», la del paso que cae bajo ella. */
export const marcaDe = (modo, k) => (modo === 'sinprisa' ? Math.round(MARCAS[k] * (PASOS - 1)) / (PASOS - 1) : MARCAS[k]);
/** Cuánto dura el albarán entero, de empezar a la última pasada. */
export const duracion = (modo) => ALBARAN.previo + 3 * ms(modo);

/** Qué plano pasa en el instante `t` (ms desde que empezó): -1 antes del primero, 3 después del último. */
export function planoEn(modo, t) {
  if (t < ALBARAN.previo) return -1;
  return Math.min(3, Math.floor((t - ALBARAN.previo) / ms(modo)));
}

/** Dónde va el plano `k` en el instante `t`: de 0 (entra por la izquierda) a 1 (sale por la derecha). */
export function posicion(modo, k, t) {
  const u = Math.max(0, Math.min(1, (t - ALBARAN.previo - k * ms(modo)) / ms(modo)));
  if (modo === 'sinprisa') return Math.min(PASOS - 1, Math.floor(u * PASOS)) / (PASOS - 1);
  return -0.08 + u * 1.16;
}

/** ¿Está la casilla del plano bajo la marca? */
export function acierta(modo, k, pos) {
  if (modo === 'sinprisa') return Math.abs(pos - marcaDe(modo, k)) < 1e-6;
  return Math.abs(pos - MARCAS[k]) <= TOLERANCIA;
}

/** El descuento de unas marcas ([true, false, null]). */
export const pctDe = (marcas) => DESCUENTOS[(marcas ?? []).filter((m) => m === true).length] ?? 0;
