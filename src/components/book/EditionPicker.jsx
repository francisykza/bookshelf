// Selector de edición (SPEC §5.3, 1.10.0): las 8 ediciones con una muestra física de cada una y, en
// los cantos pintados, el sub-selector con los 4 diseños del canto. Lo usan el libro abierto y el menú
// rápido de la estantería (clic derecho o pulsación larga sobre un libro).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { modalRoot } from '../panels/modalRoot';
import { EDGE_STYLES, EDITIONS, SELECTABLE_EDITION_IDS, visualEdition } from '../../domain/books';

export function EdgePicker({ value, onChange }) {
  return (
    <div className="edge-picker" role="radiogroup" aria-label="Diseño de los cantos">
      {Object.entries(EDGE_STYLES).map(([k, label]) => (
        <button key={k} type="button" role="radio" aria-checked={value === k} onClick={() => onChange(k)} title={label}>
          <span className={`edge-picker__chip edge--${k}`} aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}

/** Menú flotante junto al libro: elige la edición sin abrirlo. */
export function EditionMenu({ book, x, y, onChange, onClose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: x, top: y });

  // Que no se salga de la pantalla
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      left: Math.max(8, Math.min(x, window.innerWidth - r.width - 8)),
      top: Math.max(8, Math.min(y, window.innerHeight - r.height - 8)),
    });
  }, [x, y, book.editionType]);

  useEffect(() => {
    ref.current?.querySelector('[aria-checked="true"]')?.focus({ preventScroll: true });
    const onDown = (event) => !ref.current?.contains(event.target) && onClose();
    // Escape cierra solo el menú, no la librería que hay debajo
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onClose();
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onClose);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', onClose);
    };
    // Solo al abrir: onClose cambia en cada render del padre
  }, []);

  /** Flechas arriba y abajo para recorrer las ediciones. */
  const onKeyDown = (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const items = [...ref.current.querySelectorAll('.edition-menu__item')];
    const i = items.indexOf(document.activeElement);
    items[(i + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
  };

  // En #modal-root: por encima de la librería y del libro abierto, sin ancestros transformados
  return createPortal(
    <div ref={ref} className="edition-menu" role="dialog" aria-label={`Edición de ${book.title}`} style={pos} onKeyDown={onKeyDown}>
      <p className="edition-menu__title">Edición · {book.title}</p>
      <ul role="radiogroup" aria-label="Edición">
        {SELECTABLE_EDITION_IDS.map((k) => (
          <li key={k}>
            <button
              type="button"
              role="radio"
              aria-checked={visualEdition(book) === k}
              className="edition-menu__item"
              onClick={() => onChange({ editionType: k })}
            >
              <span className="edition-swatch" data-edition={k} aria-hidden="true" />
              {EDITIONS[k].label}
            </button>
          </li>
        ))}
      </ul>
      {visualEdition(book) === 'sprayed_edges' && (
        <EdgePicker value={book.sprayedEdgeStyle} onChange={(sprayedEdgeStyle) => onChange({ sprayedEdgeStyle })} />
      )}
    </div>,
    modalRoot(),
  );
}
