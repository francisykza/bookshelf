// 1.128 (Francisco, 13-11-2026: «que aparezcan exclamaciones rojas en aquellas cosas que has desbloqueado, que desaparezca
// cuando las pulses o veas»). Lo desbloqueado del café: los muebles nuevos de la tienda, lo nuevo de la carta y los sitios
// nuevos del local (el escaparate, la trampilla de la bodega y el tostador). Lo que ya viste se recuerda en el dispositivo.
// La primera vez se da por visto todo lo que ya tenías: la «!» roja es solo para lo que se abra a partir de ahora.
// Distinta de la «!» ámbar de las ayudas (lo siguiente que hay que tocar): la roja dice «esto es nuevo».
import { CAFE_MUEBLES } from './cafeCatalogo';
import { cartaDe, nivelDe, umbralHito } from './cafeNiveles';

const CLAVE = 'bookshelf:cafe-visto';
/** Desde qué nivel está cada sitio nuevo del local. */
export const SITIOS_NUEVOS = { escaparate: 5, trampilla: 6, tostador: 7 };

/** Todo lo desbloqueado con esta reputación, como claves: 'mueble:cafe-saco', 'carta:casa', 'sitio:tostador'. */
export function desbloqueados(reputacion = 0) {
  const nivel = nivelDe(reputacion);
  const out = [];
  for (const m of CAFE_MUEBLES) if (m.nivel <= nivel && (!m.hito || reputacion >= umbralHito(m.nivel, m.hito))) out.push(`mueble:${m.id}`);
  for (const c of cartaDe(reputacion)) out.push(`carta:${c}`);
  for (const [id, n] of Object.entries(SITIOS_NUEVOS)) if (nivel >= n) out.push(`sitio:${id}`);
  return out;
}

function leer(cuenta) {
  try {
    const todo = JSON.parse(localStorage.getItem(CLAVE) || '{}');
    const m = todo?.[cuenta];
    return Array.isArray(m) ? m : null;
  } catch {
    return null;
  }
}
function escribir(cuenta, vistos) {
  try {
    const todo = JSON.parse(localStorage.getItem(CLAVE) || '{}') || {};
    todo[cuenta] = vistos;
    localStorage.setItem(CLAVE, JSON.stringify(todo));
  } catch {
    // Sin almacenamiento: la «!» vuelve a salir la próxima vez, sin más
  }
}

/**
 * Lo visto de una cuenta (`cuenta`, su id o 'local'). La primera vez, todo lo desbloqueado hasta ahora. Devuelve la lista
 * para el estado de React.
 */
export function vistosDe(cuenta, reputacion = 0) {
  const ya = leer(cuenta);
  if (ya) return ya;
  const base = desbloqueados(reputacion);
  escribir(cuenta, base);
  return base;
}

/** Lo nuevo: lo desbloqueado que aún no se ha visto. */
export const nuevosDe = (reputacion, vistos) => {
  const ya = new Set(vistos ?? []);
  return new Set(desbloqueados(reputacion).filter((k) => !ya.has(k)));
};

/** Marcar como visto (una clave o varias); devuelve la lista nueva para el estado. */
export function marcarVisto(cuenta, vistos, claves) {
  const ya = new Set(vistos ?? []);
  const nuevas = [].concat(claves).filter((k) => k && !ya.has(k));
  if (!nuevas.length) return vistos;
  const lista = [...(vistos ?? []), ...nuevas];
  escribir(cuenta, lista);
  return lista;
}
