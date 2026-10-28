// «Registrar lectura» desde el libro de la cama (SPEC §38.4, §45): una vista enfocada con el libro y su progreso, la
// fecha y el MISMO formulario de registro de siempre (`ReadingEntryForm`: tres modos, un único campo, vista previa,
// validación, correcciones y guardado sin duplicados). Al guardar se cierra y la habitación ofrece «Deshacer».
// Las acciones van en el flujo del formulario (no fijas encima de los campos) y el campo activo se desplaza a la
// vista cuando aparece el teclado. Cerrar con algo escrito pide confirmación: nunca se descarta en silencio.
import { X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  const [dirty, setDirty] = useState(false);
  const [asking, setAsking] = useState(false);
  const bodyRef = useRef(null);
  const keepRef = useRef(null);

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

  // Todas las salidas (×, «Cancelar», Escape, tocar fuera) pasan por aquí
  const requestClose = useCallback(() => {
    if (dirty) setAsking(true);
    else onClose();
  }, [dirty, onClose]);
  useEffect(() => {
    if (asking) keepRef.current?.focus();
  }, [asking]);

  if (!book) return null;
  return (
    <PanelShell onClose={requestClose} label={`Registrar lectura de ${book.title}`} variant="log">
      <div className="log-sheet" ref={bodyRef}>
        <button type="button" className="log-sheet__close" onClick={requestClose} aria-label="Cerrar">
          <X aria-hidden="true" />
        </button>
        <header className="log-sheet__head">
          <span className="log-sheet__cover">
            <Cover book={book} />
          </span>
          <div>
            <p className="log-sheet__kicker">Registrar lectura</p>
            <h2 className="log-sheet__title">{book.title}</h2>
            <p className="log-sheet__now">
              {book.author && <span className="log-sheet__author">{book.author} · </span>}
              Ahora: {progressLabel(book)}
            </p>
          </div>
        </header>
        <label className="log-sheet__date">
          <span>Fecha</span>
          <input type="date" value={date} max={today} onChange={(e) => e.target.value && e.target.value <= today && setDate(e.target.value)} />
        </label>
        {asking && (
          <div className="log-sheet__confirm" role="alertdialog" aria-label="Cambios sin guardar">
            <p>Tienes una lectura escrita sin guardar.</p>
            <div>
              <button ref={keepRef} type="button" className="link-btn" onClick={() => setAsking(false)}>
                Seguir editando
              </button>
              <button type="button" className="link-btn log-sheet__discard" onClick={onClose}>
                Descartar
              </button>
            </div>
          </div>
        )}
        {/* Un formulario por fecha: cambiarla recalcula la posición anterior de ese día */}
        <ReadingEntryForm key={date} date={date} bookId={book.id} source="room" onCancel={requestClose} onDirtyChange={setDirty} onDone={(entry, meta) => onSaved?.(entry, meta)} onComplete={onComplete} />
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
