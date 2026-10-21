// Estados de transición habitación ↔ librería (SPEC §12.4, 1.18.0): una sola máquina de estados, sin
// temporizadores encadenados. La librería (plano superior, opaco) entra y sale por opacidad sobre la
// habitación, que sigue entera debajo hasta que la librería ha terminado de entrar.
import { useCallback, useEffect, useState } from 'react';

export const ROOM = 'room';
export const ENTERING = 'enteringShelf';
export const SHELF = 'shelf';
export const LEAVING = 'leavingShelf';

/** Estado final de una transición en curso (al llegar `transitionend` o el respaldo). */
export const settle = (phase) => (phase === ENTERING ? SHELF : phase === LEAVING ? ROOM : phase);

/** Siguiente estado al pedir ir a `target` desde `phase`; `instant` salta la animación. */
export function request(phase, target, instant = false) {
  if (target === SHELF) return phase === SHELF || phase === ENTERING ? phase : instant ? SHELF : ENTERING;
  return phase === ROOM || phase === LEAVING ? phase : instant ? ROOM : LEAVING;
}

export function useShelfTransition({ reducedMotion = false, mobile = false } = {}) {
  const [phase, setPhase] = useState(ROOM);

  const finish = useCallback(() => setPhase(settle), []);

  const go = useCallback(
    (target) => {
      // Con la pestaña oculta o movimiento reducido no hay nada que ver: estado final directo
      const instant = reducedMotion || document.hidden;
      setPhase((p) => request(p, target, instant));
    },
    [reducedMotion],
  );

  // Respaldo cancelable por si `transitionend` no llega (pestaña congelada, transición interrumpida)
  useEffect(() => {
    if (phase !== ENTERING && phase !== LEAVING) return undefined;
    const id = setTimeout(finish, mobile ? 240 : 900);
    const onVisibility = () => {
      if (document.hidden) finish();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearTimeout(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [phase, mobile, finish]);

  /** Para el `onTransitionEnd` de la librería: solo su propia opacidad cierra la transición. */
  const onTransitionEnd = useCallback(
    (event) => {
      if (event.target === event.currentTarget && event.propertyName === 'opacity') finish();
    },
    [finish],
  );

  return { phase, toShelf: () => go(SHELF), toRoom: () => go(ROOM), onTransitionEnd };
}
