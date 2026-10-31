// Capa para los objetos que se acercan a la cámara (libro abierto, portátil, bandeja, ficha). Sin
// rectángulos negros: la habitación se desenfoca con un velo cálido y el objeto flota delante.
// Cierra con Escape o tocando fuera, devuelve el foco al cerrar y lo mantiene dentro mientras está abierta.
// 1.17.0: se dibuja en #modal-root (portal, mismo árbol React) para que ninguna capa de la habitación lo tape.
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { modalRoot } from './modalRoot';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * 1.59 (SPEC §59.8): parte visible de la pantalla (con el teclado abierto en iOS es menor que la ventana y puede estar
 * desplazada). Se escribe como --vv-top y --vv-h en el propio velo (no en :root, que obligaría a recalcular el estilo de
 * toda la página); solo en los paneles con escritura que lo necesitan (`variant` «log»).
 */
function useVisualViewportVars(veilRef, enabled) {
  useEffect(() => {
    const vv = window.visualViewport;
    const root = veilRef.current;
    if (!enabled || !vv || !root) return undefined;
    const write = () => {
      root.style.setProperty('--vv-top', `${Math.round(vv.offsetTop)}px`);
      root.style.setProperty('--vv-h', `${Math.round(vv.height)}px`);
    };
    write();
    vv.addEventListener('resize', write);
    vv.addEventListener('scroll', write);
    return () => {
      vv.removeEventListener('resize', write);
      vv.removeEventListener('scroll', write);
    };
  }, [veilRef, enabled]);
}

export function PanelShell({ onClose, label, variant, children }) {
  const ref = useRef(null);
  const veilRef = useRef(null);
  useVisualViewportVars(veilRef, variant === 'log');
  // El cierre se guarda en una referencia: si el padre re-renderiza (p. ej. el reloj del temporizador cada
  // medio segundo) el efecto no se repite, así no se roba el foco ni se cierran los desplegables abiertos.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previous = document.activeElement;
    const node = ref.current;
    // Si no hay nada enfocable, el propio diálogo recibe el foco
    if (!node?.contains(document.activeElement)) (node?.querySelector(FOCUSABLE) ?? node)?.focus({ preventScroll: true });
    const onKey = (event) => {
      // Con otra capa encima (p. ej. el lector EPUB), este panel queda inerte y no atiende el teclado
      if (node?.closest('[inert]')) return;
      if (event.key === 'Escape') {
        // Un menú desplegable abierto dentro del panel (p. ej. «Más opciones») atiende su propio Escape
        if (node?.querySelector('[data-escape-local="open"]')) return;
        event.stopPropagation();
        closeRef.current();
      } else if (event.key === 'Tab' && node) {
        const items = [...node.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
        if (!items.length) {
          event.preventDefault();
          return;
        }
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

  return createPortal(
    <div
      ref={veilRef}
      className="panel-veil"
      data-variant={variant}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) closeRef.current();
      }}
    >
      <div ref={ref} className={`panel panel--${variant}`} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>
        {children}
      </div>
    </div>,
    modalRoot(),
  );
}
