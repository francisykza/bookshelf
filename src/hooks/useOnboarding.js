// Estado del onboarding (SPEC §16, Anexo B). Arranca solo una vez —también en StrictMode— cuando la habitación
// principal está decodificada y medida y nada prioritario está abierto; se repite desde «Guías».
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CURRENT_PHASE, STOPS, back, createDoneStore, isStop, next } from '../domain/onboarding';

const store = createDoneStore();

export function useOnboarding({ ready, blocked }) {
  const [state, setState] = useState('idle');
  const started = useRef(false);
  const opener = useRef(null);

  useEffect(() => {
    if (started.current || !ready || blocked || store.isDone()) return;
    started.current = true;
    setState('welcome');
  }, [ready, blocked]);

  const close = useCallback((final) => {
    store.markDone();
    setState(final);
    const el = opener.current;
    opener.current = null;
    requestAnimationFrame(() => {
      if (el?.isConnected && !el.closest('[inert]')) el.focus({ preventScroll: true });
    });
  }, []);

  // `from`: el control que la abre (WebKit no enfoca un botón al pulsarlo, así que no basta con activeElement)
  const start = useCallback((from) => {
    started.current = true;
    const el = from instanceof HTMLElement ? from : document.activeElement;
    opener.current = el instanceof HTMLElement && el !== document.body ? el : null;
    setState('welcome');
  }, []);
  const advance = useCallback(() => {
    const n = next(state, CURRENT_PHASE);
    if (n === 'completed') close('completed');
    else setState(n);
  }, [state, close]);
  const previous = useCallback(() => setState((s) => back(s, CURRENT_PHASE)), []);
  // Saltar también marca la guía como vista (no se repite en cada entrada)
  const skip = useCallback(() => close('completed'), [close]);

  const active = isStop(state, CURRENT_PHASE);
  return useMemo(
    () => ({ state, active, visible: active && !blocked, stop: active ? STOPS[state] : null, start, advance, previous, skip }),
    [state, active, blocked, start, advance, previous, skip],
  );
}
