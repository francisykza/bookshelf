// «Registrar lectura» desde el libro de la cama (SPEC §38.4, §45, §46): una vista enfocada con un selector de lectura
// visible al principio, la fecha y el MISMO formulario de registro de siempre (`ReadingEntryForm`: tres modos, un
// único campo, vista previa, validación, correcciones y guardado sin duplicados). Al guardar se cierra y la
// habitación ofrece «Deshacer». Cerrar con algo escrito pide confirmación: nunca se descarta en silencio.
//
// Selector (1.48): empieza en el libro con el que se abrió (el de la cama) o en «Elige una lectura»; nunca escoge uno
// por su cuenta. Muestra primero las lecturas en curso y, con «Elegir otro libro», el resto (pendientes y
// abandonados). Cada libro visitado conserva su propio formulario montado (y su borrador) mientras la vista está
// abierta, así que cambiar de libro no arrastra ni pierde lo escrito; el guardado usa siempre el libro de su
// formulario. Elegir aquí no cambia el libro de la cama ni el estado de ninguno.
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { progressLabel, shelfSort } from '../../domain/books';
import { dayKey } from '../../domain/dates';
import { normalizeText } from '../../domain/bookSearch';
import { useLibrary } from '../../state/useLibrary';
import { Cover } from '../shelf/BookItem';
import { PanelShell } from './PanelShell';
import { ReadingEntryForm } from './ReadingEntryForm';

/** Con más de estas lecturas en curso aparece un buscador dentro de la lista. */
const SEARCH_FROM = 6;

function BookOption({ book, selected, onPick }) {
  return (
    <li role="option" aria-selected={selected} className="log-pick__option" data-selected={selected || undefined} tabIndex={-1} onClick={() => onPick(book.id)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onPick(book.id))}>
      <span className="log-pick__cover">
        <Cover book={book} />
      </span>
      <span className="log-pick__text">
        <b>{book.title}</b>
        <small>{progressLabel(book)}</small>
      </span>
      {selected && <Check className="log-pick__check" aria-hidden="true" />}
    </li>
  );
}

export function ReadingLogSheet({ bookId, onClose, onSaved, onComplete }) {
  const { state } = useLibrary();
  const today = dayKey();
  const [date, setDate] = useState(today);
  // Libro elegido en el formulario (no el de la cama: cambiarlo aquí no toca nada fuera)
  const [selectedId, setSelectedId] = useState(() => (state.books.some((b) => b.id === bookId) ? bookId : null));
  // Formularios ya abiertos en esta vista: cada uno guarda su borrador
  const [visited, setVisited] = useState(() => (selectedId ? [selectedId] : []));
  const [dirtyMap, setDirtyMap] = useState({});
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [open, setOpen] = useState(false);
  const [showOthers, setShowOthers] = useState(false);
  const [filter, setFilter] = useState('');
  const bodyRef = useRef(null);
  const keepRef = useRef(null);
  const listRef = useRef(null);
  const triggerRef = useRef(null);

  const book = state.books.find((b) => b.id === selectedId) ?? null;
  const readings = useMemo(() => state.books.filter((b) => b.status === 'reading').sort(shelfSort('reading')), [state.books]);
  const others = useMemo(
    () => [...state.books.filter((b) => b.status === 'want').sort(shelfSort('want')), ...state.books.filter((b) => b.status === 'abandoned').sort(shelfSort('abandoned'))],
    [state.books],
  );
  const terms = normalizeText(filter).split(' ').filter(Boolean);
  const matches = (b) => terms.every((t) => normalizeText(`${b.title} ${b.author}`).includes(t));

  // Teclado del móvil: el campo enfocado se coloca en la parte visible del visor
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;
    const keep = () => {
      const el = document.activeElement;
      if (!(el instanceof HTMLElement) || !bodyRef.current?.contains(el) || !el.matches('input, select, textarea')) return;
      // 1.59 (SPEC §59.8): se desplaza el panel por dentro, no la página (eso subía el título bajo la barra de iOS)
      const panel = el.closest('.panel');
      if (!panel) return;
      const box = panel.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      if (r.top < box.top + 12 || r.bottom > box.bottom - 12) panel.scrollTop += r.top - box.top - (box.height - r.height) / 2;
    };
    vv.addEventListener('resize', keep);
    return () => vv.removeEventListener('resize', keep);
  }, []);

  const dirty = Object.values(dirtyMap).some(Boolean);
  // Todas las salidas (×, «Cancelar», Escape, tocar fuera) pasan por aquí
  const requestClose = useCallback(() => {
    if (busy) return;
    if (dirty) setAsking(true);
    else onClose();
  }, [busy, dirty, onClose]);
  useEffect(() => {
    if (asking) keepRef.current?.focus();
  }, [asking]);

  // Lista desplegable: el elegido (o el primero) recibe el foco; Escape la cierra sin cerrar la vista
  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    (list?.querySelector('[aria-selected="true"]') ?? list?.querySelector('[role="option"]'))?.focus();
  }, [open, showOthers]);
  const closeList = () => {
    setOpen(false);
    setFilter('');
    triggerRef.current?.focus();
  };
  const pick = (id) => {
    if (busy) return;
    setSelectedId(id);
    setVisited((v) => (v.includes(id) ? v : [...v, id]));
    setOpen(false);
    setFilter('');
    triggerRef.current?.focus();
  };
  const onListKey = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      closeList();
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = [...(listRef.current?.querySelectorAll('[role="option"]') ?? [])];
    const at = items.indexOf(document.activeElement);
    items[Math.max(0, Math.min(items.length - 1, at + (e.key === 'ArrowDown' ? 1 : -1)))]?.focus();
  };
  const setDirtyFor = useCallback((id, value) => setDirtyMap((m) => (m[id] === value ? m : { ...m, [id]: value })), []);

  const shownReadings = readings.filter(matches);
  const shownOthers = others.filter(matches);

  return (
    <PanelShell onClose={requestClose} label={book ? `Registrar lectura de ${book.title}` : 'Registrar lectura'} variant="log">
      <div className="log-sheet" ref={bodyRef}>
        <button type="button" className="log-sheet__close" onClick={requestClose} aria-label="Cerrar" disabled={busy}>
          <X aria-hidden="true" />
        </button>
        <h2 className="log-sheet__heading">Registrar lectura</h2>

        {/* Selector de lectura: una tarjeta de papel con portada, título, progreso y flecha */}
        <div className="log-pick" data-escape-local={open ? 'open' : undefined}>
          <span className="log-pick__label" id="log-pick-label">
            Lectura
          </span>
          <button
            ref={triggerRef}
            type="button"
            className="log-pick__trigger"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-labelledby="log-pick-label log-pick-value"
            disabled={busy}
            onClick={() => (open ? closeList() : setOpen(true))}
          >
            {book ? (
              <>
                <span className="log-pick__cover">
                  <Cover book={book} />
                </span>
                <span className="log-pick__text" id="log-pick-value">
                  <b>{book.title}</b>
                  <small>{progressLabel(book)}</small>
                </span>
              </>
            ) : (
              <span className="log-pick__text" id="log-pick-value">
                <b>Elige una lectura</b>
              </span>
            )}
            <ChevronDown className="log-pick__chev" aria-hidden="true" />
          </button>
          {open && (
            <div className="log-pick__pop" onKeyDown={onListKey}>
              {readings.length + (showOthers ? others.length : 0) > SEARCH_FROM && (
                <label className="log-pick__search">
                  <Search aria-hidden="true" />
                  <input type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Buscar en la lista" aria-label="Buscar en la lista de libros" />
                </label>
              )}
              <ul ref={listRef} className="log-pick__list" role="listbox" aria-label="Lecturas">
                {shownReadings.length > 0 && (
                  <li className="log-pick__group" role="presentation">
                    Leyendo
                  </li>
                )}
                {shownReadings.map((b) => (
                  <BookOption key={b.id} book={b} selected={b.id === selectedId} onPick={pick} />
                ))}
                {!readings.length && (
                  <li className="log-pick__empty" role="presentation">
                    No tienes ninguna lectura en curso.
                  </li>
                )}
                {showOthers && shownOthers.length > 0 && (
                  <li className="log-pick__group" role="presentation">
                    Otros libros de tu biblioteca
                  </li>
                )}
                {showOthers && shownOthers.map((b) => <BookOption key={b.id} book={b} selected={b.id === selectedId} onPick={pick} />)}
              </ul>
              {!showOthers && others.length > 0 && (
                <button type="button" className="link-btn log-pick__more" onClick={() => setShowOthers(true)}>
                  Elegir otro libro
                </button>
              )}
            </div>
          )}
        </div>

        <label className="log-sheet__date">
          <span>Fecha</span>
          <input type="date" value={date} max={today} disabled={busy} onChange={(e) => e.target.value && e.target.value <= today && setDate(e.target.value)} />
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
        {!book && <p className="log-sheet__hint">Elige qué libro quieres registrar en «Lectura».</p>}
        {/* Un formulario por libro visitado: solo se ve el elegido; los demás guardan su borrador. Cambiar la fecha no
            los recrea (cada uno recalcula su vista previa con ella), así que tampoco se pierde lo escrito */}
        {visited.map((id) => (
          <div key={id} hidden={id !== selectedId}>
            <ReadingEntryForm
              date={date}
              bookId={id}
              source="room"
              onCancel={requestClose}
              onDirtyChange={(value) => setDirtyFor(id, value)}
              onBusyChange={setBusy}
              onDone={(entry, meta) => onSaved?.(entry, meta)}
              onComplete={onComplete}
            />
          </div>
        ))}
      </div>
    </PanelShell>
  );
}

/** Cuánto dura «Deshacer» desde el registro (no desde que se ve el aviso). */
export const UNDO_MS = 8000;

/**
 * Aviso tras guardar con «Deshacer» de la operación completa (registro, posición del libro y sellos). Su caducidad la
 * lleva quien lo crea (App, con la hora del registro): aquí solo se pinta, y nunca después de caducar.
 */
export function LogUndoToast({ item, onUndo }) {
  if (!item || Date.now() >= item.at + UNDO_MS) return null;
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
