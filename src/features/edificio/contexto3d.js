// 1.162.2 · El 3D que se pierde y vuelve (Francisco, 28-11-2026: a su compañera, en el iPhone, el café se le veía «a veces» con
// el dibujo de respaldo). Los móviles quitan el WebGL a una página en segundo plano (al ir a WhatsApp y volver) o cuando
// hay muchos abiertos, y casi siempre lo devuelven al volver. Las escenas del edificio y del hotel renunciaban en el acto y se
// quedaban con el respaldo sin 3D; ahora, como tu piso (`pisoLab/interior3d.js`), esperan: con la página delante, unos segundos
// a que vuelva (`webglcontextrestored`), y solo si no vuelve se rinden (`onLost`). En segundo plano no cuenta el tiempo.

/** Cuánto se espera, con la página delante, a que el navegador devuelva el contexto antes de pasar al respaldo. */
export const ESPERA_CONTEXTO_MS = 3000;

/**
 * Vigila el contexto WebGL de `canvas`. `onLost()`: se perdió y no volvió. `invalidate()`: pide un cuadro (al volver, el
 * lienzo está vacío). `on`: las opciones de los oyentes de la escena (con su `signal`, que al cancelarse lo suelta todo).
 */
export function vigilarContexto(canvas, { onLost, invalidate, on, espera = ESPERA_CONTEXTO_MS }) {
  let perdido = false;
  let timer = 0;
  const esperar = () => {
    clearTimeout(timer);
    if (document.visibilityState === 'hidden') return;
    timer = setTimeout(() => {
      if (perdido && !on?.signal?.aborted) onLost();
    }, espera);
  };
  canvas.addEventListener(
    'webglcontextlost',
    (e) => {
      // Sin esto, el navegador no lo devuelve nunca
      e.preventDefault();
      perdido = true;
      esperar();
    },
    on,
  );
  canvas.addEventListener(
    'webglcontextrestored',
    () => {
      perdido = false;
      clearTimeout(timer);
      invalidate();
    },
    on,
  );
  document.addEventListener(
    'visibilitychange',
    () => {
      if (!perdido) return;
      if (document.visibilityState === 'hidden') clearTimeout(timer);
      else esperar();
    },
    on,
  );
  on?.signal?.addEventListener('abort', () => clearTimeout(timer), { once: true });
  return { perdido: () => perdido };
}
