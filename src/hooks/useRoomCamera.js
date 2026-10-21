// Cámara de la habitación (SPEC §12.2, 1.18.0): escribe la transformación de `.world` directamente (sin
// re-render en cada movimiento), conserva el centro lógico al rotar y, en móvil (cover), deja arrastrar el
// escenario dentro de sus límites. Más de 8 px de arrastre cancela la activación del objeto al soltar; dos
// dedos nunca activan nada; el foco de teclado trae a la vista el objeto enfocado.
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { cameraCss, clampOffset, logicalCenter, offsetCentering, offsetShowing } from '../scene/camera';

const DRAG_PX = 8;

export function useRoomCamera({ camera, shelfFocus = null, worldRef, surfaceRef, enabled = true }) {
  const offsetRef = useRef(null);
  const prevCamera = useRef(null);
  const frame = useRef(0);
  const enabledRef = useRef(enabled);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const apply = useCallback(() => {
    const node = worldRef.current;
    if (!node || !offsetRef.current) return;
    node.style.transform = cameraCss(camera, offsetRef.current, shelfFocus);
  }, [camera, shelfFocus, worldRef]);

  // Rotación, barras del navegador o teclado: mismo centro lógico y límites nuevos, aplicado sin transición
  useLayoutEffect(() => {
    const prev = prevCamera.current;
    offsetRef.current = prev && offsetRef.current ? offsetCentering(camera, logicalCenter(prev, offsetRef.current)) : clampOffset(camera, camera.centerX, camera.centerY);
    prevCamera.current = camera;
    apply();
  }, [camera, apply]);

  const schedule = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(apply);
  }, [apply]);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // Arrastre del escenario (solo cover)
  useEffect(() => {
    const el = surfaceRef.current;
    if (!el || !camera.cover) return undefined;
    const pointers = new Set();
    let drag = null;
    let suppress = false;
    const stop = (event) => {
      try {
        if (drag?.moved && el.hasPointerCapture?.(event.pointerId)) el.releasePointerCapture(event.pointerId);
      } catch {
        // El puntero ya no existe (cancelado por el navegador): nada que liberar
      }
      drag = null;
      delete el.dataset.dragging;
    };
    const down = (event) => {
      if (!enabledRef.current) return;
      pointers.add(event.pointerId);
      suppress = false;
      // Dos dedos: es un gesto del navegador (pinch-zoom), nunca la activación de un objeto
      if (pointers.size > 1) {
        suppress = true;
        stop(event);
        return;
      }
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, ox: offsetRef.current.x, oy: offsetRef.current.y, moved: false };
    };
    const move = (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!drag.moved) {
        if (Math.hypot(dx, dy) < DRAG_PX) return;
        drag.moved = true;
        el.dataset.dragging = 'true';
        try {
          el.setPointerCapture?.(event.pointerId);
        } catch {
          // Puntero ya inactivo: el arrastre sigue con los eventos que lleguen
        }
      }
      offsetRef.current = clampOffset(camera, drag.ox + dx, drag.oy + dy);
      schedule();
    };
    const up = (event) => {
      pointers.delete(event.pointerId);
      if (drag && event.pointerId === drag.id) {
        if (drag.moved) suppress = true;
        stop(event);
      }
    };
    const cancel = (event) => {
      pointers.delete(event.pointerId);
      suppress = true;
      stop(event);
    };
    // El clic que sigue a un arrastre (o a un gesto de dos dedos) no llega a ningún objeto
    const click = (event) => {
      if (!suppress) return;
      suppress = false;
      event.preventDefault();
      event.stopPropagation();
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', cancel);
    el.addEventListener('click', click, true);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', cancel);
      el.removeEventListener('click', click, true);
      delete el.dataset.dragging;
    };
  }, [camera, schedule, surfaceRef]);

  // Teclado: el objeto enfocado fuera del encuadre se trae a la vista con 16 px de margen
  useEffect(() => {
    const el = worldRef.current;
    if (!el || !camera.cover) return undefined;
    const onFocus = (event) => {
      if (!(event.target instanceof Element) || !offsetRef.current) return;
      const next = offsetShowing(camera, offsetRef.current, event.target.getBoundingClientRect(), 16);
      if (next.x === offsetRef.current.x && next.y === offsetRef.current.y) return;
      offsetRef.current = next;
      apply();
    };
    el.addEventListener('focusin', onFocus);
    return () => el.removeEventListener('focusin', onFocus);
  }, [camera, apply, worldRef]);
}
