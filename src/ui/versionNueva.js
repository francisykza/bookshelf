// 1.162.2 · La versión nueva llega de verdad (Francisco, 28-11-2026: a su compañera, en el iPhone, el café se le veía «a veces»
// con el dibujo isométrico que se quitó en la 1.155, y al tocar Comunidad se quedaba la pantalla marrón). Hasta ahora la versión
// nueva se instalaba al pasar la app a segundo plano, pero sin recargar (SPEC §11.6): en el iPhone la pestaña sigue viva días con
// el código de antes en memoria, y cuando ese código pide un trozo que ya no está (la comunidad), no llega nada.
// Ahora: si mientras estabas fuera se ha puesto una versión nueva, al volver a la app se recarga (la ubicación vive en el
// historial y lo tuyo en el almacenamiento, así que vuelves a donde estabas). Nunca con el teclado abierto en un campo (se
// espera a la próxima vuelta) ni en la primera instalación. Y cada vez que vuelves (como mucho cada 15 minutos) se pregunta si
// hay una versión nueva, porque una app instalada casi nunca navega y el navegador no lo comprobaría solo.

export const BUSCAR_CADA_MS = 15 * 60 * 1000;

/** Hay un campo de texto con el foco (escribiendo una reseña, una nota…): no se recarga. */
export function escribiendo(doc = document) {
  const el = doc.activeElement;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === 'TEXTAREA' || tag === 'SELECT' || (tag === 'INPUT' && !['button', 'checkbox', 'radio', 'range', 'submit', 'reset'].includes(el.type));
}

/**
 * Vigila las versiones. `sw`: navigator.serviceWorker; `reg`: su registro. Devuelve una función para dejar de vigilar.
 * `recargar`, `ahora` y `doc` se pueden cambiar en las pruebas.
 */
export function vigilarVersion(sw, reg, { doc = document, recargar = () => location.reload(), ahora = () => Date.now() } = {}) {
  // Con controlador al abrir, ya había una versión: un cambio es una versión nueva. Sin él, es la primera instalación
  const habia = Boolean(sw.controller);
  let nueva = false;
  let buscada = ahora();
  const alCambiar = () => {
    if (habia) nueva = true;
  };
  const alVolver = () => {
    if (doc.visibilityState === 'hidden') {
      // La versión nueva que espera se pone mientras nadie mira
      if (reg.waiting) reg.waiting.postMessage('activar-version');
      return;
    }
    if (nueva && !escribiendo(doc)) {
      nueva = false;
      recargar();
      return;
    }
    if (ahora() - buscada >= BUSCAR_CADA_MS) {
      buscada = ahora();
      reg.update?.().catch(() => {});
    }
  };
  sw.addEventListener('controllerchange', alCambiar);
  doc.addEventListener('visibilitychange', alVolver);
  return () => {
    sw.removeEventListener('controllerchange', alCambiar);
    doc.removeEventListener('visibilitychange', alVolver);
  };
}
