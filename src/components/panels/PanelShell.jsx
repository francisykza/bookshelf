// Capa para los objetos que se acercan a la cámara (libro abierto, portátil, bandeja, ficha). Sin
// rectángulos negros: la habitación se desenfoca con un velo cálido y el objeto flota delante.
// Cierra con Escape o tocando fuera, devuelve el foco al cerrar y lo mantiene dentro mientras está abierta.
import { useEffect, useRef } from 'react';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

export function PanelShell({ onClose, label, variant, children }) {
  const ref = useRef(null);
  // El cierre se guarda en una referencia: si el padre re-renderiza (p. ej. el reloj del temporizador cada
  // medio segundo) el efecto no se repite, así no se roba el foco ni se cierran los desplegables abiertos.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previous = document.activeElement;
    const node = ref.current;
    if (!node?.contains(document.activeElement)) node?.querySelector(FOCUSABLE)?.focus({ preventScroll: true });
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        closeRef.current();
      } else if (event.key === 'Tab' && node) {
        const items = [...node.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      if (previous instanceof HTMLElement) previous.focus({ preventScroll: true });
    };
  }, []);

  return (
    <div
      className="panel-veil"
      data-variant={variant}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) closeRef.current();
      }}
    >
      <div ref={ref} className={`panel panel--${variant}`} role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </div>
    </div>
  );
}
