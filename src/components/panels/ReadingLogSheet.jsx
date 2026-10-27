// «Registrar lectura» desde el libro de la cama (SPEC §38.4): una vista enfocada con el libro y su progreso, la
// fecha y el MISMO formulario de registro de siempre (`ReadingEntryForm`: tres modos, un único campo, vista previa,
// validación, correcciones y guardado sin duplicados). Al guardar se cierra y la habitación ofrece «Deshacer».
// Las acciones van en el flujo del formulario (no fijas encima de los campos) y el campo activo se desplaza a la
// vista cuando aparece el teclado.
import { useEffect, useRef, useState } from 'react';
import { progressLabel } from '../../domain/books';
import { dayKey } from '../../domain/dates';
import { useLibrary } from '../../state/useLibrary';
import { Cover } from '../shelf/BookItem';
import { PanelShell } from './PanelShell';
import { ReadingEntryForm } from './ReadingEntryForm';

export function ReadingLogSheet({ bookId, onClose, onSaved, onComplete }) {
  const { state } = useLibrary();
  const book = state.books.find((b) => b.id === bookId);
  const today = dayKey();
  const [date, setDate] = useState(today);
  const bodyRef = useRef(null);

  // Teclado del móvil: el campo enfocado se coloca en la parte visible del visor
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;
    const keep = () => {
      const el = document.activeElement;
      if (el instanceof HTMLElement && bodyRef.current?.contains(el) && el.matches('input, select, textarea')) el.scrollIntoView({ block: 'center', behavior: 'auto' });
    };
    vv.addEventListener('resize', keep);
    return () => vv.removeEventListener('resize', keep);
  }, []);

  if (!book) return null;
  return (
    <PanelShell onClose={onClose} label={`Registrar lectura de ${book.title}`} variant="log">
      <div className="log-sheet" ref={bodyRef}>
        <header className="log-sheet__head">
          <span className="log-sheet__cover">
            <Cover book={book} />
          </span>
          <div>
            <p className="log-sheet__kicker">Registrar lectura</p>
            <h2 className="log-sheet__title">{book.title}</h2>
            {book.author && <p className="log-sheet__author">{book.author}</p>}
            <p className="log-sheet__now">Ahora: {progressLabel(book)}</p>
          </div>
        </header>
        <label className="log-sheet__date reading-form__field">
          <span>Fecha</span>
          <input type="date" value={date} max={today} onChange={(e) => e.target.value && e.target.value <= today && setDate(e.target.value)} />
        </label>
        {/* Un formulario por fecha: cambiarla recalcula la posición anterior de ese día */}
        <ReadingEntryForm key={date} date={date} bookId={book.id} source="room" onCancel={onClose} onDone={(entry, meta) => onSaved?.(entry, meta)} onComplete={onComplete} />
      </div>
    </PanelShell>
  );
}

/** Aviso tras guardar con «Deshacer» de la operación completa (registro, posición del libro y sellos). */
export function LogUndoToast({ item, onUndo, onDismiss }) {
  useEffect(() => {
    if (!item) return undefined;
    const id = setTimeout(onDismiss, 8000);
    return () => clearTimeout(id);
  }, [item, onDismiss]);
  if (!item) return null;
  return (
    <div className="log-toast" role="status">
      <span>
        Lectura registrada · <b>{item.text}</b>
      </span>
      <button type="button" onClick={onUndo}>
        Deshacer
      </button>
    </div>
  );
}
