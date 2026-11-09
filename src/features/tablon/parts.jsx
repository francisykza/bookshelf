// Piezas compartidas del tablón: la hoja que se abre encima y el detalle de una tarjeta.
import { useEffect, useRef, useState } from 'react';
import { formatOf, KIND_NAMES, PAPERS } from './model';

/** El tablón descolgado: marco de madera, corcho y su placa. */
export function BoardFrame({ title, children }) {
  return (
    <div className="tb-frame">
      <div className="tb-frame__cork">{children}</div>
      <div className="tb-plaque">{title}</div>
    </div>
  );
}

/** Una hoja con su propio scroll. Escape la cierra a ella sola y el foco queda dentro. */
export function Sheet({ title, onClose, children, footer }) {
  const ref = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.querySelector('h3')?.focus({ preventScroll: true });
    const onKey = (e) => {
      if (e.key !== 'Escape' || !ref.current || ref.current.querySelector('.tb-sheet')) return;
      e.stopPropagation();
      close.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      previous?.focus?.({ preventScroll: true });
    };
  }, []);
  return (
    <div className="tb-veil" data-escape-local="open">
      <section ref={ref} className="tb-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <h3 tabIndex={-1}>{title}</h3>
          <button type="button" className="tb-btn" onClick={onClose}>Cerrar</button>
        </header>
        <div className="tb-sheet__body">{children}</div>
        {footer && <footer>{footer}</footer>}
      </section>
    </div>
  );
}

export function DetailSheet({ item, onClose, actions }) {
  const [shown, setShown] = useState(!item.spoiler);
  return (
    <Sheet title={KIND_NAMES[item.kind]} onClose={onClose} footer={actions}>
      <article className="tb-detail" data-format={item.id ? formatOf(item) : undefined} style={{ '--paper': PAPERS[item.paper] }}>
        {item.retirada ? (
          <p>Esta nota la ha retirado quien la escribió.</p>
        ) : shown ? (
          <>
            {item.kind === 'book' && item.cover && <img src={item.cover} alt="" />}
            <p>{item.body}</p>
            {item.caption && <small>{item.caption}</small>}
            {item.firma && <small>De {item.firma}</small>}
          </>
        ) : (
          <button type="button" className="tb-btn" onClick={() => setShown(true)}>Revelar spoiler</button>
        )}
      </article>
    </Sheet>
  );
}
