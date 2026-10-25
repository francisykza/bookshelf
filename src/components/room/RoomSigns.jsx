// Señales físicas de la habitación (SPEC §28.9, corrección 1.35.1): cada rótulo parece sujeto a su objeto real
// —placas de latón mate en la librería y la vitrina, «Mis sagas» colgada con cadena del aro del astrolabio, pestaña
// de papel en el borde del portátil, etiqueta de tela junto a los auriculares, etiqueta de infusión con cordel en el
// vaso y una cinta que sale del libro—. Se anclan en px de la ilustración (rejilla sobre `cozy-book-room.jpg`) y son
// decorativas (`aria-hidden`, sin eventos de puntero): el control es siempre el hotspot del objeto entero, que queda
// debajo y recibe el toque. No tapan libros, figuras ni controles.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { SUN_DIAL } from '../../scene/sceneMap';
import { HangingPlaque } from '../primitives';

// Punto de sujeción de cada señal en px de la escena 941 × 1672
export const SIGNS = {
  figures: { x: 226, y: 122, kind: 'plaque', text: 'Colección' },
  shelf: { x: 232, y: 858, kind: 'plaque', text: 'Mi biblioteca' },
  // La cinta nace del canto inferior del libro abierto y cae sobre la colcha
  book: { x: 344, y: 1506, kind: 'ribbon', text: 'Mi lectura' },
  // Pestaña apoyada en el borde frontal de la base del portátil
  laptop: { x: 662, y: 1166, kind: 'tab', text: 'Calendario' },
  // Etiqueta de infusión: el cordel sale del borde del vaso
  tray: { x: 846, y: 1098, kind: 'teabag', text: 'Tiempo de lectura' },
  // Etiqueta de tela cosida, a la derecha de la diadema
  headphones: { x: 196, y: 1296, kind: 'fabric', text: 'Ambiente' },
};

const HINT_KEY = 'bookshelf:signs-hint-done';
const hintDone = () => {
  try {
    return localStorage.getItem(HINT_KEY) === 'true';
  } catch {
    return true;
  }
};

/** Ayuda inicial breve: solo destaca la biblioteca. Se descarta y vuelve a aparecer al terminar «Guías». */
function useSignsHint(guideActive) {
  const [show, setShow] = useState(() => !hintDone());
  const was = useRef(guideActive);
  useEffect(() => {
    if (was.current && !guideActive) {
      try {
        localStorage.removeItem(HINT_KEY);
      } catch {
        // sin almacenamiento
      }
      setShow(true);
    }
    was.current = guideActive;
  }, [guideActive]);
  const dismiss = () => {
    try {
      localStorage.setItem(HINT_KEY, 'true');
    } catch {
      // sin almacenamiento: se oculta en esta visita
    }
    setShow(false);
  };
  return { show: show && !guideActive, dismiss };
}

function Sign({ id, sign, highlight }) {
  const common = { className: `room-sign room-sign--${sign.kind}`, 'data-sign': id, 'data-highlight': highlight || undefined, style: { left: sign.x, top: sign.y } };
  if (sign.kind === 'plaque') return <HangingPlaque {...common}>{sign.text}</HangingPlaque>;
  if (sign.kind === 'chain')
    return (
      <span {...common}>
        {/* Cadena en V desde un único punto del aro del astrolabio hasta las dos esquinas de la placa */}
        <svg className="room-sign__chain" viewBox="0 0 60 22" preserveAspectRatio="none">
          <circle cx="30" cy="2.2" r="2" />
          <path d="M30 3.5 L6 22 M30 3.5 L54 22" />
        </svg>
        <span className="hanging-plaque__plate">{sign.text}</span>
      </span>
    );
  return (
    <span {...common}>
      {sign.kind === 'teabag' && <span className="room-sign__string" />}
      <span className="room-sign__label">{sign.text}</span>
    </span>
  );
}

/**
 * Mantiene cada señal dentro de la vista del panel: si el encuadre la corta, se desliza lo justo (como mucho
 * media señal) hacia dentro, sin separarse de su objeto. Se recalcula al cambiar el encuadre o el tamaño.
 */
function useKeepInView(ref, deps) {
  useLayoutEffect(() => {
    const root = ref.current;
    const panel = root?.closest('[data-panel]');
    const world = root?.closest('.scene-world');
    if (!root || !panel) return undefined;
    let frame = 0;
    const fit = () => {
      frame = 0;
      const box = panel.getBoundingClientRect();
      root.querySelectorAll('.room-sign').forEach((el) => {
        el.style.setProperty('--nudge', '0px');
        const r = el.getBoundingClientRect();
        const k = parseFloat(getComputedStyle(el).getPropertyValue('--k')) || 1;
        let dx = 0;
        if (r.right > box.right - 6) dx = box.right - 6 - r.right;
        else if (r.left < box.left + 6) dx = box.left + 6 - r.left;
        dx = Math.max(-r.width / 2, Math.min(r.width / 2, dx));
        el.style.setProperty('--nudge', `${(dx / k).toFixed(1)}px`);
      });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(fit);
    };
    schedule();
    const mo = new MutationObserver(schedule);
    if (world) mo.observe(world, { attributes: true, attributeFilter: ['style'] });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      mo.disconnect();
      window.removeEventListener('resize', schedule);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function RoomSigns({ timeOfDay, guideActive }) {
  const hint = useSignsHint(guideActive);
  const ref = useRef(null);
  useKeepInView(ref, [timeOfDay]);
  const dial = SUN_DIAL[timeOfDay] ?? SUN_DIAL.morning;
  return (
    <>
      <div ref={ref} className="room-signs" data-hint={hint.show || undefined} aria-hidden="true">
        {Object.entries(SIGNS).map(([id, sign]) => (
          <Sign key={id} id={id} sign={sign} highlight={hint.show && id === 'shelf'} />
        ))}
        {/* «Mis sagas» cuelga del aro del astrolabio (sigue al astro en cada hora del día) */}
        <Sign id="sagas" sign={{ x: dial.x, y: dial.y, kind: 'chain', text: 'Mis sagas' }} />
      </div>
      {hint.show && (
        <div className="room-signs-hint" role="note" style={{ left: SIGNS.shelf.x, top: SIGNS.shelf.y + 56 }}>
          <p>Las placas señalan lo que puedes tocar. Empieza por tu biblioteca.</p>
          <button type="button" onClick={hint.dismiss}>
            Entendido
          </button>
        </div>
      )}
    </>
  );
}
