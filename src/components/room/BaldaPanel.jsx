// Una balda de la estantería, de cerca (Rincón 01): cuando los lomos son demasiado estrechos para tocarlos uno a uno,
// tocar su grupo acerca la balda y aquí se elige el ejemplar. Es un panel con su entrada en el historial: Atrás, Escape o
// tocar fuera lo cierran. Los lomos son los mismos de la habitación, en el mismo orden, a un tamaño que se toca.
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { spineColor, sprayedEdge, visualEdition } from '../../domain/books';
import { useLibrary } from '../../state/useLibrary';
import { PanelShell } from '../panels/PanelShell';
import { inkFor } from '../../domain/roomShelf';
import { ROW_SHELVES, useBookcase } from './bookcaseLayout';

/** Aumento de la balda y lo mínimo que mide un lomo para tocarlo (px CSS). */
const ZOOM = 2.4;
const MIN_W = 28;

export function BaldaPanel({ shelfId, group, onClose, onOpenBook }) {
  const { state } = useLibrary();
  const { rows } = useBookcase(state.books, state.settings);
  const index = ROW_SHELVES.indexOf(shelfId);
  const row = rows[index];
  const activeGroup = Number(group);
  const plankRef = useRef(null);
  const items = row ? row.groups.flatMap((g) => g.items.map((item) => ({ ...item, group: g.index }))) : [];

  useEffect(() => {
    // Se empieza por el grupo que tocaste: a la vista y con el foco en su primer libro
    const first = plankRef.current?.querySelector(`[data-group="${activeGroup}"]`);
    first?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
    first?.focus({ preventScroll: true });
  }, [activeGroup]);

  const tall = Math.max(1, ...items.map((i) => i.h));
  return (
    <PanelShell onClose={onClose} label={`Balda ${index + 1} de tu estantería`} variant="balda">
      <header className="balda__head">
        <h2 className="balda__title">Balda {index + 1}</h2>
        <p className="balda__sub">{items.length === 1 ? '1 libro' : `${items.length} libros`} · elige uno para abrir su ficha</p>
        <button type="button" className="balda__close" onClick={onClose} aria-label="Cerrar la balda">
          <X aria-hidden="true" />
        </button>
      </header>
      {items.length ? (
        <div ref={plankRef} className="balda__plank" role="list" aria-label={`Libros de la balda ${index + 1}`} style={{ '--tall': `${Math.round(tall * ZOOM)}px` }}>
          {items.map((item) => (
            <div key={item.book.id} role="listitem" className="balda__slot" data-gap={item.group !== items[0].group && item === items.find((i) => i.group === item.group) ? 'true' : undefined}>
              <button
                type="button"
                className="balda__spine rb-spine"
                data-group={item.group}
                data-active={item.group === activeGroup || undefined}
                data-material={item.physics.material}
                data-edition={visualEdition(item.book)}
                data-gilt={item.physics.goldFoil || undefined}
                data-edge={sprayedEdge(item.book) || undefined}
                data-ink={inkFor(spineColor(item.book))}
                style={{ width: Math.max(MIN_W, Math.round((item.front ? item.spineW : item.w) * ZOOM)), height: Math.round(item.h * ZOOM), '--spine': spineColor(item.book) }}
                aria-label={`${item.book.title}${item.book.author ? `, de ${item.book.author}` : ''}. Abrir su ficha`}
                onClick={() => onOpenBook(item.book)}
              >
                <span className="rb-spine__title">{item.book.title}</span>
                {item.book.status === 'reading' && <span className="rb-spine__ribbon" />}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="balda__empty">En esta balda ya no queda ningún libro.</p>
      )}
    </PanelShell>
  );
}
