// Temporizador de lectura (SPEC §6): cuenta con marcas de tiempo absolutas, así sigue siendo exacto
// aunque se cierre la bandeja o la pestaña pase a segundo plano.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNow } from './useReducedMotion';

export function useReadingTimer({ focusMinutes, breakMinutes, onFocusDone, onBreakDone }) {
  const [timer, setTimer] = useState(() => ({ phase: 'focus', running: false, endAt: 0, left: focusMinutes * 60000 }));
  const now = useNow(500, timer.running);
  const callbacks = useRef({ onFocusDone, onBreakDone });
  useEffect(() => {
    callbacks.current = { onFocusDone, onBreakDone };
  }, [onFocusDone, onBreakDone]);

  // Una sesión puede tener su propia duración (p. ej. «Leer 15 min juntos» con Miel)
  const total = timer.phase === 'focus' && timer.custom ? timer.custom : (timer.phase === 'focus' ? focusMinutes : breakMinutes) * 60000;
  const remaining = timer.running ? Math.max(0, timer.endAt - now) : timer.left;

  // Si cambia la duración con el reloj parado, se reajusta
  useEffect(() => {
    setTimer((t) => (t.running || t.custom ? t : { ...t, left: (t.phase === 'focus' ? focusMinutes : breakMinutes) * 60000 }));
  }, [focusMinutes, breakMinutes]);

  useEffect(() => {
    if (!timer.running || remaining > 0) return;
    if (timer.phase === 'focus') {
      callbacks.current.onFocusDone?.(timer.custom ? Math.round(timer.custom / 60000) : focusMinutes);
      setTimer({ phase: 'break', running: true, endAt: Date.now() + breakMinutes * 60000, left: breakMinutes * 60000 });
    } else {
      callbacks.current.onBreakDone?.();
      setTimer({ phase: 'focus', running: false, endAt: 0, left: focusMinutes * 60000 });
    }
  }, [remaining, timer.running, timer.phase, timer.custom, focusMinutes, breakMinutes]);

  const start = useCallback(() => setTimer((t) => (t.running ? t : { ...t, running: true, endAt: Date.now() + t.left })), []);
  const startFor = useCallback(
    (minutes) => setTimer((t) => (t.running ? t : { phase: 'focus', running: true, endAt: Date.now() + minutes * 60000, left: minutes * 60000, custom: minutes * 60000 })),
    [],
  );
  const pause = useCallback(() => setTimer((t) => (t.running ? { ...t, running: false, left: Math.max(0, t.endAt - Date.now()) } : t)), []);
  const reset = useCallback(() => setTimer({ phase: 'focus', running: false, endAt: 0, left: focusMinutes * 60000 }), [focusMinutes]);
  const skipBreak = useCallback(() => setTimer({ phase: 'focus', running: false, endAt: 0, left: focusMinutes * 60000 }), [focusMinutes]);

  return { ...timer, remaining, total, start, startFor, pause, reset, skipBreak };
}
