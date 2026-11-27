// Tarjeta anclada a un sillón del salón (1.62, SPEC §62.2): junto al asiento que la abre, siempre dentro de la pantalla
// (nunca recortada detrás de muebles: va fuera de la escena, encima de todo). Arriba del asiento si cabe; si no, debajo;
// y si tampoco, pegada al borde con su propio scroll. Escape, tocar fuera o la X la cierran y el foco vuelve al asiento.
import { X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const MARGIN = 12;
const GAP = 10;

/** Posición de la tarjeta (px de la ventana) para un ancla y un tamaño dados; pura para poder probarla. */
export function placeCard(anchor, size, view) {
  const width = Math.min(size.width, view.width - MARGIN * 2);
  const left = Math.min(Math.max(anchor.left + anchor.width / 2 - width / 2, MARGIN), view.width - MARGIN - width);
  const above = anchor.top - GAP - size.height;
  const below = anchor.bottom + GAP;
  if (above >= MARGIN) return { left, top: above, width, side: 'arriba' };
  if (below + size.height <= view.height - MARGIN) return { left, top: below, width, side: 'abajo' };
  const top = Math.max(MARGIN, view.height - MARGIN - size.height);
  return { left, top, width, side: 'encima', maxHeight: view.height - MARGIN * 2 };
}

export function SeatCard({ anchor, label, onClose, wide = false, children }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    const place = () => {
      const el = ref.current;
      if (!el || !anchor?.isConnected) return;
      const a = anchor.getBoundingClientRect();
      const next = placeCard(a, { width: el.offsetWidth, height: el.scrollHeight }, { width: window.innerWidth, height: window.innerHeight });
      // Solo si cambia: el observador no entra en bucle
      setPos((prev) => (prev && ['left', 'top', 'width', 'maxHeight', 'side'].every((k) => prev[k] === next[k]) ? prev : next));
    };
    place();
    // También cuando cambia su contenido (elegir «Solo mi alias» quita el selector, un error añade una línea)
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(place) : null;
    ro?.observe(ref.current);
    window.addEventListener('resize', place);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', place);
    };
  }, [anchor]);

  // Foco a la tarjeta al abrirla; al cerrarla, de vuelta al asiento que la abrió
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    return () => anchor?.isConnected && anchor.focus({ preventScroll: true });
  }, [anchor]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };
    const onDown = (e) => {
      if (ref.current?.contains(e.target) || anchor?.contains(e.target)) return;
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onDown, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onDown, true);
    };
  }, [anchor, onClose]);

  return createPortal(
    <div
      ref={ref}
      className="seat-card"
      data-wide={wide || undefined}
      data-side={pos?.side}
      role="dialog"
      aria-label={label}
      tabIndex={-1}
      style={pos ? { left: pos.left, top: pos.top, width: pos.width, maxHeight: pos.maxHeight } : { visibility: 'hidden' }}
    >
      <button type="button" className="seat-card__close" onClick={onClose} aria-label="Cerrar">
        <X aria-hidden="true" />
      </button>
      {children}
    </div>,
    document.body,
  );
}
