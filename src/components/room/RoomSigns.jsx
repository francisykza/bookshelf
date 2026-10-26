// Nombres de los objetos de la habitación (SPEC §31.2). Decisión del usuario posterior al prompt de recursos: las
// placas de navegación de la habitación se sustituyen por un icono y un nombre que solo se muestran con «Guías»
// activadas; con las guías desactivadas, la escena queda limpia (los reflejos suaves sobre cada objeto están
// pendientes de sus máscaras, que se prepararán sobre el fondo original). Las placas siguen en otras secciones (baldas
// de la biblioteca). Los nombres son decorativos (`aria-hidden`, sin eventos de puntero): el control es el hotspot del
// objeto entero, que tiene su nombre accesible y recibe el toque. Anclados en px de la ilustración 941 × 1672.
import { BookOpen, CalendarDays, CupSoda, Headphones, Library, Moon, Trophy } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SUN_DIAL } from '../../scene/sceneMap';

// Centro de cada nombre, sobre su objeto
export const SIGNS = {
  figures: { x: 228, y: 168, text: 'Colección', icon: Trophy },
  shelf: { x: 228, y: 560, text: 'Mi biblioteca', icon: Library },
  book: { x: 560, y: 1450, text: 'Mi lectura', icon: BookOpen },
  laptop: { x: 770, y: 1060, text: 'Mi diario', icon: CalendarDays },
  tray: { x: 858, y: 1150, text: 'Tiempo de lectura', icon: CupSoda },
  headphones: { x: 140, y: 1350, text: 'Ambiente', icon: Headphones },
};

const HINT_KEY = 'bookshelf:signs-hint-done';
const hintDone = () => {
  try {
    return localStorage.getItem(HINT_KEY) === 'true';
  } catch {
    return true;
  }
};

/** Ayuda inicial breve. Se descarta y vuelve a aparecer al terminar el recorrido de bienvenida. */
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
  const Icon = sign.icon;
  return (
    <span className="room-sign room-sign--chip" data-sign={id} data-highlight={highlight || undefined} style={{ left: sign.x, top: sign.y }}>
      <Icon className="room-sign__icon" aria-hidden="true" />
      <span className="room-sign__text">{sign.text}</span>
    </span>
  );
}

/**
 * Nombres junto al borde del encuadre: si el recorte de la escena deja uno en parte fuera, se desliza hacia dentro lo
 * justo para leerlo (8 px de margen), sobre la parte visible de su objeto. Se recalcula al mover la cámara.
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
      const left = Math.max(box.left, 0) + 8;
      const right = Math.min(box.right, window.innerWidth) - 8;
      root.querySelectorAll('.room-sign').forEach((el) => {
        el.style.setProperty('--nudge', '0px');
        const r = el.getBoundingClientRect();
        const k = parseFloat(getComputedStyle(el).getPropertyValue('--k')) || 1;
        const dx = r.left < left ? left - r.left : r.right > right ? right - r.right : 0;
        if (dx) el.style.setProperty('--nudge', `${(dx / k).toFixed(1)}px`);
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

export function RoomSigns({ timeOfDay, guideActive, guides = false }) {
  const hint = useSignsHint(guideActive);
  const ref = useRef(null);
  useKeepInView(ref, [timeOfDay, guides]);
  const dial = SUN_DIAL[timeOfDay] ?? SUN_DIAL.morning;
  return (
    <>
      {guides && (
        <div ref={ref} className="room-signs" aria-hidden="true">
          {Object.entries(SIGNS).map(([id, sign]) => (
            <Sign key={id} id={id} sign={sign} />
          ))}
          <Sign id="sagas" sign={{ x: dial.x, y: dial.y + 46, text: 'Mis sagas', icon: Moon }} />
        </div>
      )}
      {/* La ayuda va fuera del mundo escalado (portal): siempre a la vista, sea cual sea el encuadre */}
      {hint.show &&
        createPortal(
          <div className="room-signs-hint" role="note">
            <p>Toca los objetos de la habitación. Con «Guías» verás el nombre de cada uno.</p>
            <button type="button" onClick={hint.dismiss}>
              Entendido
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
