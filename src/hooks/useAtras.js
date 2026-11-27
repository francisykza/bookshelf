// Libo, bloque 4 (docs/qa/libo.md §3.6; play-store.md §3.4): el botón Atrás del móvil cierra lo último que se abrió dentro de una
// escena (una sala del hotel, una pantalla del café, el armario, el bocadillo de Libo…) antes que la escena entera. Cada capa
// abierta tiene su entrada en el historial, apilada sobre la del panel (`history.state.capas`, la lista de capas de esa entrada);
// Atrás la quita y la capa se cierra como con su propio botón de volver. Si en ese momento no se puede salir (a mitad de una
// taza, guardando…), Atrás no hace nada y la entrada vuelve a su sitio. La navegación de paneles (domain/navigation.js) salta
// estas entradas al cerrar un panel con su botón.
import { useEffect, useRef } from 'react';
import { retirandoCapas } from '../domain/navigation';

const capas = []; // { id, cerrar: ref, empujada, base }
let instalado = false;
let programado = null;
let siguiente = 1;

const enEstado = () => (Array.isArray(window.history.state?.capas) ? window.history.state.capas : []);
// La ubicación de la app en la entrada actual (domain/navigation.js): una capa solo vive sobre la entrada en la que se abrió
const aqui = () => JSON.stringify(window.history.state?.bookshelf?.loc ?? null);

/** Pone el historial de acuerdo con las capas abiertas: quita de arriba las cerradas y apila las nuevas. */
function sincronizar() {
  programado = null;
  const estado = enEstado();
  let quitar = 0;
  for (let i = estado.length - 1; i >= 0; i -= 1) {
    if (capas.some((c) => c.id === estado[i] && c.empujada)) break;
    quitar += 1;
  }
  if (quitar) {
    // Lo cerrado con su propio botón: fuera del historial (al llegar `popstate`, se vuelve a mirar)
    retirandoCapas();
    window.history.go(-quitar);
    return;
  }
  const donde = aqui();
  for (const c of capas) {
    // Una capa de un panel que se está cerrando (Atrás le llevó a otra ubicación) no se vuelve a apilar en la de destino
    if (c.empujada || (c.base != null && c.base !== donde)) continue;
    c.empujada = true;
    c.base = donde;
    window.history.pushState({ ...(window.history.state ?? {}), capas: [...enEstado(), c.id] }, '');
  }
}

function programar(ms = 0) {
  if (programado) clearTimeout(programado);
  programado = setTimeout(sincronizar, ms);
}

function instalar() {
  if (instalado) return;
  instalado = true;
  window.addEventListener('popstate', () => {
    const estado = enEstado();
    const donde = aqui();
    // De la más reciente a la más antigua: Atrás cierra la de arriba
    for (const c of [...capas].reverse()) {
      if (!c.empujada || estado.includes(c.id)) continue;
      c.empujada = false;
      // Si Atrás sale del panel entero (su botón de volver salta las capas de una vez), la capa se va con él: no se toca
      if (c.base !== donde) continue;
      // Si no se puede cerrar ahora, o sigue abierta (p. ej. se cerró algo de dentro), se vuelve a apilar su entrada
      c.cerrar.current?.();
    }
    // Un momento para que la escena se repinte (si la capa se cerró, ya no estará)
    programar(60);
  });
}

/**
 * Mientras `abierta`, Atrás llama a `cerrar` en vez de salir de la escena. `cerrar` hace lo mismo que el botón de volver de esa
 * capa; si devuelve `false` (ahora no se puede salir), Atrás no hace nada.
 */
export function useAtras(abierta, cerrar) {
  const ref = useRef(cerrar);
  useEffect(() => {
    ref.current = cerrar;
  });
  useEffect(() => {
    if (!abierta || typeof window === 'undefined') return undefined;
    instalar();
    const capa = { id: `c${Date.now().toString(36)}${siguiente}`, cerrar: ref, empujada: false, base: null };
    siguiente += 1;
    capas.push(capa);
    programar();
    return () => {
      const i = capas.indexOf(capa);
      if (i >= 0) capas.splice(i, 1);
      programar();
    };
  }, [abierta]);
}

/** Pulsa el botón de volver visible dentro de `raiz` (el último marcado con `data-atras`). Devuelve si había uno. */
export function pulsarAtras(raiz) {
  const botones = [...(raiz?.querySelectorAll('[data-atras]') ?? [])].filter((b) => !b.disabled && b.getClientRects().length > 0);
  const b = botones.at(-1);
  if (!b) return false;
  b.click();
  return true;
}

/** Cuántas entradas de capas hay encima de la del panel actual (la navegación de paneles las salta). */
export const capasEncima = () => (typeof window === 'undefined' ? 0 : enEstado().length);
