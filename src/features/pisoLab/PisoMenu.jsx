// Atajos del piso: lo mismo que se puede tocar en la habitación, sin tener que encontrarlo. Una lista de botones corriente, que
// se recorre con el tabulador y la lee cualquier lector de pantalla. La tecla M lo abre y Escape lo cierra.
import { useEffect, useRef, useState } from 'react';
import { pixelIconSmallSrc } from '../edificio/pixelUi';

/** `off`: hay algo abierto encima, y la tecla no debe abrir el menú debajo. */
export function PisoMenu({ items, off = false }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const toggle = useRef(null);
  const blocked = useRef(off);
  useEffect(() => {
    blocked.current = off;
  }, [off]);
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) toggle.current?.focus({ preventScroll: true });
  };

  useEffect(() => {
    const onKey = (e) => {
      const field = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName ?? '') || e.target?.isContentEditable;
      if ((e.key === 'm' || e.key === 'M') && !field && !e.ctrlKey && !e.metaKey && !e.altKey && !blocked.current && !toggle.current?.closest('[inert]')) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    root.current?.querySelector('li button')?.focus({ preventScroll: true });
    const away = (e) => {
      if (!root.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  return (
    <div
      ref={root}
      className="plab-menu"
      data-escape-local={open ? 'open' : undefined}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          close();
        }
      }}
    >
      <button ref={toggle} type="button" className="px-btn plab-tool" aria-label="Menú de accesos" aria-expanded={open} aria-keyshortcuts="M" onClick={() => setOpen(!open)}>
        <img src={pixelIconSmallSrc('lista')} alt="" width={22} height={22} />
        <span>Menú</span>
      </button>
      {open && (
        <nav className="plab-menu__sheet" aria-label="Accesos del piso">
          <ul>
            {items.map((item) => (
              <li key={item.name}>
                <button
                  type="button"
                  onClick={() => {
                    close(false);
                    item.run();
                  }}
                >
                  {item.name}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
