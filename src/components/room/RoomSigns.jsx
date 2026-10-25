// Señales físicas de la habitación (SPEC §28.9, corrección 1.35.1): cada rótulo parece sujeto a su objeto real
// —placas de latón mate en la librería y la vitrina, «Mis sagas» colgada con cadena del aro del astrolabio, pestaña
// de papel en el borde del portátil, etiqueta de tela junto a los auriculares, etiqueta de infusión con cordel en el
// vaso y una cinta que sale del libro—. Se anclan en px de la ilustración (rejilla sobre `cozy-book-room.jpg`) y son
// decorativas (`aria-hidden`, sin eventos de puntero): el control es siempre el hotspot del objeto entero, que queda
// debajo y recibe el toque. No tapan libros, figuras ni controles.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SUN_DIAL } from '../../scene/sceneMap';
import { HangingPlaque } from '../primitives';

// Punto de sujeción de cada señal en px de la escena 941 × 1672
export const SIGNS = {
  // 1.37.0 (SPEC §30.3): placas de latón ilustradas de /assets/ui, como en habitacion-senales-2-maqueta.png
  figures: { x: 228, y: 168, kind: 'brass', text: 'Colección' },
  shelf: { x: 228, y: 512, kind: 'brass', text: 'Mi biblioteca' },
  // Marcapáginas de cuero y latón que sale del canto izquierdo del libro abierto
  book: { x: 372, y: 1396, kind: 'bookmark', text: 'Mi lectura' },
  // Placa con escuadras apoyada en el borde frontal del portátil
  laptop: { x: 700, y: 1146, kind: 'bracket', text: 'Mi diario' },
  // Etiqueta de latón colgada del vaso con un cordel
  tray: { x: 846, y: 1098, kind: 'teabag', text: 'Tiempo de lectura' },
  // Placa con correas de cuero sobre la diadema de los auriculares
  headphones: { x: 160, y: 1284, kind: 'strap', text: 'Ambiente' },
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
  // Placas ilustradas: la imagen es el fondo y el texto es HTML sobre su zona lisa
  if (['brass', 'bracket', 'strap', 'bookmark', 'hanging'].includes(sign.kind))
    return (
      <span {...common}>
        {/* Contenedor común: la imagen es el fondo de la placa y el texto se coloca en su superficie útil */}
        <span className="room-sign__plate">
          <span className="room-sign__text">{sign.text}</span>
        </span>
      </span>
    );
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

export function RoomSigns({ timeOfDay, guideActive }) {
  const hint = useSignsHint(guideActive);
  const ref = useRef(null);
  // Las placas no se desplazan para caber: siguen ancladas a su objeto (los anclajes están dentro de cada objeto)
  const dial = SUN_DIAL[timeOfDay] ?? SUN_DIAL.morning;
  return (
    <>
      <div ref={ref} className="room-signs" data-hint={hint.show || undefined} aria-hidden="true">
        {Object.entries(SIGNS).map(([id, sign]) => (
          <Sign key={id} id={id} sign={sign} highlight={hint.show && id === 'shelf'} />
        ))}
        {/* «Mis sagas» cuelga del aro del astrolabio (sigue al astro en cada hora del día) */}
        <Sign id="sagas" sign={{ x: dial.x, y: dial.y + 30, kind: 'hanging', text: 'Mis sagas' }} />
      </div>
      {/* La ayuda va fuera del mundo escalado (portal): siempre a la vista, sea cual sea el encuadre */}
      {hint.show &&
        createPortal(
          <div className="room-signs-hint" role="note">
            <p>Las placas señalan lo que puedes tocar. Empieza por tu biblioteca.</p>
            <button type="button" onClick={hint.dismiss}>
              Entendido
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
