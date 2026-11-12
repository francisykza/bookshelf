// El café-librería del bajo, bloque 4a (decisiones de Francisco del 12-11-2026; plan en docs/qa/cafe-libreria.md §12): subir de
// nivel, los tickets de cada nivel y los del día, los tres hitos de cada nivel, los huecos de la balda y lo que se abre en la
// carta. Las cifras son las mismas que en el servidor (`20261212120000_cafe_niveles.sql`); una prueba lo comprueba.
// Solo cuentas: sin React ni Three.
import { CAFE_NIVELES } from './cafeCatalogo';

/** Tickets al subir a cada nivel (el 1, al inaugurar: se cobra con el primer cliente). Aprobado: 10 / 20 / 40 / 60 / 100. */
export const TICKETS_NIVEL = { 1: 10, 2: 20, 3: 40, 4: 60, 5: 100 };
/** Tickets del día según el nivel, una vez al día al atender al primer cliente: 1 a 5, con tope de 5. */
export const ticketsDelDia = (nivel = 1) => Math.min(5, Math.max(1, nivel));
/** Libros que caben en la balda en cada nivel. Aprobado: 12 / 18 / 30 / 36 / 42. */
export const HUECOS = { 1: 12, 2: 18, 3: 30, 4: 36, 5: 42 };
export const huecosDelNivel = (nivel = 1) => HUECOS[Math.min(5, Math.max(1, nivel))];
/** Granos del tercer hito de cada nivel. */
export const GRANOS_HITO = 15;

/** Reputación desde la que empieza cada nivel. */
export const desdeNivel = (n) => CAFE_NIVELES.find((x) => x.nivel === n)?.desde ?? 0;
/** El tramo de la barra de un nivel (el 5 sigue 5.000 más, para sus hitos). */
export const tramoNivel = (n) => (n >= 5 ? 5000 : desdeNivel(n + 1) - desdeNivel(n));
/** El nivel que da una reputación. */
export function nivelDe(reputacion = 0) {
  let n = 1;
  for (const x of CAFE_NIVELES) if (reputacion >= x.desde) n = x.nivel;
  return n;
}
/** Dónde cae cada hito: a un cuarto, a la mitad y a tres cuartos de la barra (así ninguno coincide con la subida). */
export const umbralHito = (nivel, hito) => desdeNivel(nivel) + Math.floor((tramoNivel(nivel) * hito) / 4);

/**
 * Lo que da cada hito: 1.º un mueble nuevo del café a la venta, 2.º lo nuevo de la carta (del nivel 2 en adelante) y
 * 3.º 15 granos. Los muebles y la carta de los niveles 4 y 5 llegan con el bloque 4b.
 */
export const HITOS = {
  1: { 1: { mueble: 'cafe-maceta' }, 2: {}, 3: { granos: GRANOS_HITO } },
  2: { 1: { mueble: 'cafe-perchero' }, 2: { carta: 'chocolate' }, 3: { granos: GRANOS_HITO } },
  3: { 1: { mueble: 'cafe-reloj' }, 2: { carta: 'nata' }, 3: { granos: GRANOS_HITO } },
  4: { 1: {}, 2: {}, 3: { granos: GRANOS_HITO } },
  5: { 1: {}, 2: {}, 3: { granos: GRANOS_HITO } },
};
/** Lo nuevo de la carta, por orden: qué es y en qué nivel (se abre en su 2.º hito). */
export const CARTA = [
  { id: 'chocolate', nombre: 'Chocolate caliente', parte: 'bebida', nivel: 2 },
  { id: 'nata', nombre: 'Nata montada', parte: 'toque', nivel: 3 },
];
/** Lo que hay abierto en la carta con esta reputación. */
export const cartaDe = (reputacion = 0) => CARTA.filter((c) => reputacion >= umbralHito(c.nivel, 2)).map((c) => c.id);

/** Los hitos alcanzados con esta reputación: [{ nivel, hito }]. */
export function hitosDe(reputacion = 0) {
  const out = [];
  const tope = nivelDe(reputacion);
  for (let n = 1; n <= tope; n += 1) for (let k = 1; k <= 3; k += 1) if (reputacion >= umbralHito(n, k)) out.push({ nivel: n, hito: k });
  return out;
}
/** Lo que se gana al pasar de una reputación a otra: niveles nuevos (con sus tickets) e hitos nuevos (con lo que dan). */
export function novedades(antes = 0, despues = 0) {
  const ya = new Set(hitosDe(antes).map((h) => `${h.nivel}:${h.hito}`));
  const hitos = hitosDe(despues)
    .filter((h) => !ya.has(`${h.nivel}:${h.hito}`))
    .map((h) => ({ ...h, ...HITOS[h.nivel][h.hito] }));
  const niveles = [];
  for (let n = nivelDe(antes) + 1; n <= nivelDe(despues); n += 1) niveles.push({ nivel: n, tickets: TICKETS_NIVEL[n] });
  return { niveles, hitos };
}
/** El siguiente hito que falta en el nivel (para enseñarlo en la barra): { nivel, hito, umbral, ... } o null. */
export function siguienteHito(reputacion = 0) {
  const n = nivelDe(reputacion);
  for (let k = 1; k <= 3; k += 1) if (reputacion < umbralHito(n, k)) return { nivel: n, hito: k, umbral: umbralHito(n, k), ...HITOS[n][k] };
  return null;
}

/** Lo que se abre al subir a cada nivel (para el cartel de la subida; frases cerradas). */
export const ABRE = {
  2: ['4 clientes al día', '18 huecos en la balda', 'Muebles nuevos: banco corrido, vitrina de tartas y planta grande', 'Se recogen las cortinas: todo el bajo, con el ventanal al puerto'],
  3: ['5 clientes al día', '30 huecos en la balda', 'Muebles nuevos: estantería alta, sillón orejero y mesita con quinqué', 'Estanterías hasta el techo y la chimenea encendida'],
  4: ['36 huecos en la balda'],
  5: ['42 huecos en la balda'],
};
/** Lo que dice un hito, en una línea. */
export function textoHito(h, nombreMueble = (id) => id) {
  const x = HITOS[h.nivel]?.[h.hito] ?? {};
  if (x.mueble) return `Nuevo en la tienda: ${nombreMueble(x.mueble)}`;
  if (x.carta) return `Nuevo en la carta: ${CARTA.find((c) => c.id === x.carta)?.nombre ?? x.carta}`;
  if (x.granos) return `+${x.granos} granos`;
  return 'Un paso más hacia el siguiente nivel';
}
/** ¿Hay algo que contar tras un servicio? (Subidas, hitos o los tickets del día, con el primer cliente de cada día.) */
export const hayLogro = (p) => Boolean(p && (p.niveles.length || p.hitos.length || p.ticketsDia > 0));
