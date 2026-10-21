// Formulario «Guardar lectura» (SPEC §14.8, 1.20.0): tres formas de registrar —páginas leídas, página
// alcanzada o porcentaje alcanzado— con una sola activa, vista previa de posición y avance por separado y
// guardado idempotente (el mismo id hasta que termina). Lo usan el calendario, Sesiones, la ficha de los
// libros por porcentaje y el temporizador: no hay otra implementación del registro.
import { useId, useRef, useState } from 'react';
import { formatPercent, newId, trackUnit } from '../../domain/books';
import { parseDay } from '../../domain/dates';
import { MODES, buildEntry, defaultMode, describeEntry, modesFor } from '../../domain/reading';
import { useLibrary } from '../../state/useLibrary';

const fmtDate = (key) => parseDay(key).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });

export function ReadingEntryForm({ date, books, bookId: fixedId, source = 'form', onDone, onCancel }) {
  const { state, actions } = useLibrary();
  const uid = useId();
  const log = state.progress.readingLog;
  const [bookId, setBookId] = useState(fixedId ?? books.find((b) => b.status === 'reading')?.id ?? books[0]?.id ?? '');
  const book = state.books.find((b) => b.id === (fixedId ?? bookId));
  const [mode, setMode] = useState(() => (book ? defaultMode(book, log) : 'added'));
  const [text, setText] = useState('');
  const [declared, setDeclared] = useState(true);
  const [confirmCorrection, setConfirmCorrection] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState('');
  const [touched, setTouched] = useState(false);
  // Un id por intento de guardado: el doble toque y el reintento repiten el mismo
  const [attemptId, setAttemptId] = useState(() => newId('s'));
  const lock = useRef(false);

  const modes = book ? modesFor(book) : [];
  const activeMode = modes.includes(mode) ? mode : modes[0];
  // La vista previa y el guardado son el mismo registro (cálculo puro y barato en cada render)
  const draft = book && text.trim() ? buildEntry(book, log, { date, mode: activeMode, text, declared, id: attemptId, source }) : null;

  if (!book) return <p className="cal-pop__empty">No hay libros que puedas seguir leyendo.</p>;

  const unit = trackUnit(book);
  const fieldId = `${uid}-value`;
  const errorId = `${uid}-error`;
  const error = draft?.error ?? (touched && !text.trim() ? 'Escribe un número.' : '');
  const preview = draft?.entry ? describeEntry(draft.entry) : null;
  const unknownAdvance = draft?.entry && draft.entry.kind === 'read' && !(draft.entry.delta > 0);

  const switchBook = (id) => {
    setBookId(id);
    const next = state.books.find((b) => b.id === id);
    if (next) setMode(defaultMode(next, log));
    setText('');
    setTouched(false);
    setConfirmCorrection(false);
  };

  const submit = (event) => {
    event.preventDefault();
    setTouched(true);
    if (lock.current || !draft?.entry) return;
    if (draft.correction && !confirmCorrection) {
      setConfirmCorrection(true);
      return;
    }
    lock.current = true;
    setSaving(true);
    setFailure('');
    actions.logReading(draft.entry, draft.position);
    // Tras confirmar el estado, se escribe al momento; si falla, el formulario conserva sus datos
    setTimeout(() => {
      lock.current = false;
      setSaving(false);
      if (!actions.persistNow()) {
        setFailure('No se ha podido guardar en este dispositivo. Tus datos siguen aquí: vuelve a intentarlo.');
        return;
      }
      const saved = draft.entry;
      setAttemptId(newId('s'));
      setText('');
      setTouched(false);
      setConfirmCorrection(false);
      onDone?.(saved);
    }, 0);
  };

  const label = activeMode === 'added' ? 'Páginas leídas' : activeMode === 'page' ? 'Página' : 'Porcentaje';
  const suffix = activeMode === 'percent' ? '%' : activeMode === 'page' && book.pageCount ? `de ${book.pageCount}` : 'págs.';
  const conversion =
    draft?.entry?.entered?.percent != null
      ? `= página ${draft.entry.to} de ${book.pageCount} · ${formatPercent((draft.entry.to / book.pageCount) * 100)}`
      : draft?.entry?.entered?.page != null
        ? `= ${formatPercent(draft.entry.to)} leído`
        : '';

  return (
    <form className="reading-form" onSubmit={submit} noValidate>
      {!fixedId && books.length > 1 && (
        <label className="reading-form__field">
          <span>Libro</span>
          <select value={bookId} onChange={(e) => switchBook(e.target.value)}>
            {books.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
              </option>
            ))}
          </select>
        </label>
      )}
      {modes.length > 1 && (
        <div className="reading-form__modes" role="radiogroup" aria-label="Cómo quieres registrarlo">
          {modes.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={activeMode === m}
              onClick={() => {
                setMode(m);
                setText('');
                setTouched(false);
                setConfirmCorrection(false);
              }}
            >
              {MODES[m].label}
            </button>
          ))}
        </div>
      )}
      <div className="reading-form__field">
        <label htmlFor={fieldId}>{modes.length > 1 ? label : MODES[activeMode].label}</label>
        <span className="reading-form__input">
          <input
            id={fieldId}
            type="text"
            inputMode={activeMode === 'percent' ? 'decimal' : 'numeric'}
            autoComplete="off"
            value={text}
            placeholder={activeMode === 'percent' ? '42,5' : activeMode === 'page' ? String(book.currentPage || 1) : '20'}
            onChange={(e) => {
              setText(e.target.value);
              setConfirmCorrection(false);
              setFailure('');
            }}
            onBlur={() => setTouched(true)}
            aria-invalid={!!error || undefined}
            aria-describedby={error ? errorId : undefined}
          />
          <span className="reading-form__suffix">{suffix}</span>
        </span>
        <small className="reading-form__help">{MODES[activeMode].help}</small>
        {error && (
          <small id={errorId} className="reading-form__error" role="alert">
            {error}
          </small>
        )}
        {conversion && !error && <small className="reading-form__help reading-form__num">{conversion}</small>}
      </div>

      {preview && (
        <div className="reading-form__preview" aria-live="polite">
          <span className="reading-form__preview-label">Se guardará · {fmtDate(date)}</span>
          {preview.position && (
            <span>
              Posición final: <b className="reading-form__num">{preview.position}</b>
            </span>
          )}
          <span>
            Avance: <b className="reading-form__num">{preview.advance ?? (draft.correction ? 'ninguno (corrección)' : 'sin posición anterior conocida')}</b>
          </span>
          {draft.correction && (
            <span className="reading-form__warn">
              Es menor que la posición anterior ({unit === 'percent' ? `${draft.entry.from} %` : `página ${draft.entry.from}`}). Se guardará como corrección: no suma páginas ni cuenta para la racha.
            </span>
          )}
          {draft.conflict && (
            <span className="reading-form__warn">
              El {fmtDate(draft.conflict.date)} registraste {unit === 'percent' ? `el ${draft.conflict.to} %` : `la página ${draft.conflict.to}`}, menos que esto. Revisa ese registro si no es correcto.
            </span>
          )}
        </div>
      )}
      {unknownAdvance && (
        <label className="reading-form__check">
          <input type="checkbox" checked={declared} onChange={(e) => setDeclared(e.target.checked)} />
          <span>Este día leí (cuenta para la racha)</span>
        </label>
      )}
      {failure && (
        <p className="reading-form__error" role="alert">
          {failure}
        </p>
      )}
      <div className="reading-form__actions">
        <button type="submit" className="stamp-btn reading-form__save" disabled={saving || !!draft?.error}>
          {saving ? 'Guardando…' : confirmCorrection ? 'Guardar corrección' : 'Guardar lectura'}
        </button>
        {onCancel && (
          <button type="button" className="link-btn" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
