// Flecha discreta de desplazamiento (SPEC §13.4, 1.19.0): chevron de latón sin cápsula, que solo existe cuando
// hay contenido fuera en esa dirección (si no, no se pinta ni recibe foco). La primera que aparece en la sesión
// hace un único desplazamiento de descubrimiento de 3 px; después queda quieta.
import { useEffect, useState } from 'react';

let nudged = false;

export function ScrollChevron(props) {
  return props.available ? <Chevron {...props} /> : null;
}

function Chevron({ dir, onClick, className = '', style }) {
  const [nudge] = useState(() => (nudged ? undefined : dir));
  useEffect(() => {
    nudged = true;
  }, []);
  return (
    <button
      type="button"
      className={`scroll-chevron scroll-chevron--${dir} ${className}`}
      data-nudge={nudge}
      style={style}
      aria-label={dir === 'left' ? 'Ver más a la izquierda' : 'Ver más a la derecha'}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      <svg viewBox="0 0 14 22" aria-hidden="true">
        <path d={dir === 'left' ? 'M11 2 L3 11 L11 20' : 'M3 2 L11 11 L3 20'} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
