// Menú principal del piso: el organizador de madera de Puerto Pixel. Cada objeto del atlas es un botón real con su placa; el estado del sonido se
// lee en la suya. Es un diálogo: el foco no sale de él, Escape lo cierra y el foco vuelve al botón. La tecla M lo abre.
import { useEffect, useRef, useState } from 'react';
import { useSoundState } from '../../audio/audioController';
import { playUiSound } from '../../audio/uiSounds';
import { PixelControl, PixelIcon } from '../../ui/PixelIcon';
import { PortIcon } from '../../ui/PortIcon';

const CLOSE_MS = 120;

// Qué objeto del atlas corresponde a cada acceso; los que no tienen objeto se dibujan como una placa ancha
const ART = { ordenador: 'ordenador', estanteria: 'biblioteca', edificio: 'edificio', altavoz: 'sonido', pincel: 'decorar', ajustes: 'ajustes', calendario: 'calendario', cuaderno: 'diario' };

function Item({ item, onChoose }) {
  const art = !item.plain && ART[item.icon];
  if (item.primary)
    return (
      <li className="pp-menu__wide">
        <button type="button" className="pp-btn pp-btn--primary pp-menu__primary" aria-label={item.name} onClick={() => onChoose(item)}>
          <PixelIcon name="lectura" size={44} />
          <span>
            {item.label}
            <small>{item.sub}</small>
          </span>
        </button>
      </li>
    );
  if (!art)
    return (
      <li className="pp-menu__wide">
        <button type="button" className="pp-btn pp-menu__plaque" onClick={() => onChoose(item)}>
          <PortIcon name={item.icon} />
          <span>{item.name}</span>
        </button>
      </li>
    );
  return (
    <li>
      <button type="button" className="pp-slot" data-small={item.small || undefined} onClick={() => onChoose(item)}>
        <PixelIcon name={art} size={item.small ? 48 : 88} />
        <span className="pp-plate">
          {item.name}
          {item.status && <small>{item.status}</small>}
        </span>
      </button>
    </li>
  );
}

/**
 * `main`: los accesos principales; `more`: [{ title, items }] con el resto. `off`: hay algo abierto encima, y la tecla no debe abrir el menú
 * debajo. `title`: en casa, «Tu rincón»; de visita, el nombre del piso.
 */
export function PisoMenu({ main, more = [], title = 'Tu rincón', off = false }) {
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const sound = useSoundState();
  const sheet = useRef(null);
  const toggle = useRef(null);
  const blocked = useRef(off);
  const timer = useRef(0);
  useEffect(() => {
    blocked.current = off;
  }, [off]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const show = () => {
    playUiSound('panel-open');
    setLeaving(false);
    setOpen(true);
  };
  const hide = (after) => {
    setLeaving(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setOpen(false);
      setLeaving(false);
      after?.();
    }, CLOSE_MS);
  };
  const dismiss = () => {
    playUiSound('panel-close');
    toggle.current?.focus({ preventScroll: true });
    hide();
  };
  const stateRef = useRef({ open, show, dismiss });
  stateRef.current = { open, show, dismiss };

  useEffect(() => {
    const onKey = (e) => {
      const field = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName ?? '') || e.target?.isContentEditable;
      if ((e.key === 'm' || e.key === 'M') && !field && !e.ctrlKey && !e.metaKey && !e.altKey && !blocked.current && !toggle.current?.closest('[inert]')) {
        e.preventDefault();
        if (stateRef.current.open) stateRef.current.dismiss();
        else stateRef.current.show();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) sheet.current?.querySelector('li button')?.focus({ preventScroll: true });
  }, [open]);

  const choose = (item) => {
    hide(item.run);
  };
  const withStatus = (item) => (item.sound ? { ...item, status: sound.on ? 'Activado' : 'Silenciado' } : item);

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      dismiss();
      return;
    }
    if (e.key !== 'Tab') return;
    e.stopPropagation();
    const all = [...sheet.current.querySelectorAll('button')];
    const first = all[0];
    const last = all[all.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="plab-menu" data-escape-local={open ? 'open' : undefined}>
      <button ref={toggle} type="button" className="plab-tool" aria-label="Menú de accesos" aria-expanded={open} aria-keyshortcuts="M" onClick={() => (open ? dismiss() : show())}>
        <PortIcon name="menu" />
        <span>Menú</span>
      </button>
      {open && (
        <div className="port-menu" data-leaving={leaving || undefined} onKeyDown={onKeyDown}>
          <div className="port-menu__veil" onClick={dismiss} aria-hidden="true" />
          <div ref={sheet} className="port-menu__sheet" role="dialog" aria-modal="true" aria-label={title}>
            <header className="pp-menu__head">
              <h2>{title}</h2>
              <button type="button" className="pp-btn pp-btn--icon" onClick={dismiss} aria-label="Cerrar el menú">
                <PixelControl name="close" />
              </button>
            </header>
            <nav aria-label="Accesos del piso">
              <ul className="pp-menu__shelves">
                {main.map((item) => (
                  <Item key={item.name} item={withStatus(item)} onChoose={choose} />
                ))}
              </ul>
              {more.map((group) => (
                <section key={group.title} aria-label={group.title}>
                  <ul className="pp-menu__shelves">
                    {group.items.map((item) => (
                      <Item key={item.name} item={item} onChoose={choose} />
                    ))}
                  </ul>
                </section>
              ))}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
