// Olmo vivo en la franja del café (1.156; Francisco: «añade a olmo con las animaciones que te paso igual que a libo»): si no tocas
// nada, primero se sienta a leer y, mucho rato después, se duerme; si le tocas muchas veces seguidas, se marea un momento. Como
// Libo (LiboRincon.jsx): cualquier toque, tecla o desplazamiento le despierta, y con movimiento reducido no cambia solo.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { muchosToques } from '../../libo/poses';
import { DURA_MAREO, POSES_OLMO, REPOSO_OLMO, poseOlmoUrl } from './olmoPoses';

// Las poses se piden una vez, en cuanto Olmo atiende: al cambiar de pose ya están y no parpadea el marco
let pedidas = false;
const pedirPoses = () => {
  if (pedidas || typeof Image === 'undefined') return;
  pedidas = true;
  POSES_OLMO.forEach((p) => (new Image().src = poseOlmoUrl(p)));
};

/** `{ quieto, mareado, tocado() }`: el rato sin tocar nada (0, 30 o 90 s), si está mareado y qué hacer al tocarle. */
export function useReposoOlmo(activo) {
  const reducido = useReducedMotion();
  const [quieto, setQuieto] = useState(0);
  const [mareado, setMareado] = useState(false);
  const toques = useRef([]);
  const reloj = useRef(null);

  useEffect(() => {
    if (activo) pedirPoses();
  }, [activo]);

  useEffect(() => {
    if (!activo || reducido) return undefined;
    let ultimo = Date.now();
    const despierta = () => {
      ultimo = Date.now();
      setQuieto((q) => (q ? 0 : q));
    };
    const opciones = { capture: true, passive: true };
    const eventos = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    eventos.forEach((ev) => window.addEventListener(ev, despierta, opciones));
    const id = setInterval(() => {
      const s = Math.floor((Date.now() - ultimo) / 1000);
      setQuieto(s >= REPOSO_OLMO.duerme ? REPOSO_OLMO.duerme : s >= REPOSO_OLMO.lee ? REPOSO_OLMO.lee : 0);
    }, 3000);
    return () => {
      clearInterval(id);
      eventos.forEach((ev) => window.removeEventListener(ev, despierta, opciones));
    };
  }, [activo, reducido]);

  useEffect(() => () => clearTimeout(reloj.current), []);

  const tocado = useCallback(() => {
    const ahora = Date.now();
    toques.current = [...toques.current.filter((t) => ahora - t <= 2000), ahora];
    if (!muchosToques(toques.current, ahora)) return;
    toques.current = [];
    setMareado(true);
    clearTimeout(reloj.current);
    reloj.current = setTimeout(() => setMareado(false), DURA_MAREO);
  }, []);

  // Sin Olmo o con movimiento reducido, nunca en reposo (lo que quedara contado de antes no cuenta)
  return { quieto: activo && !reducido ? quieto : 0, mareado, tocado };
}
