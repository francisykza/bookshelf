// Formulario «Guardar lectura» (SPEC §14.8, 1.20.0): tres formas de registrar —páginas leídas, página
// alcanzada o porcentaje alcanzado— con una sola activa, vista previa de posición y avance por separado y
// guardado idempotente (el mismo id hasta que termina). Lo usan el calendario, Sesiones, la ficha de los
// libros por porcentaje y el temporizador: no hay otra implementación del registro.
// 1.28.0 (SPEC §22.6–22.7): el selector de un registro NUEVO ofrece solo las lecturas activas (sin «Otros…»);
// sin ninguna, se dice y se ofrece abrir la librería, sin cambiar el estado de ningún libro. Si el guardado
// termina el libro (de < 100 % a 100 %), avisa con `onComplete` solo tras confirmar el guardado; si falla, el
// registro se deshace en memoria y se conserva lo escrito. El borrador es estado local de esta instancia (una por
// día editado): no lo tocan el reloj del temporizador ni las sincronizaciones. Sin autoFocus ni desplazamientos.
import { useEffect, useId, useRef, useState } from 'react';
import { playUiSound } from '../../audio/uiSounds';
import { choiceLabels, initialReadingOrder, readingChoices } from '../../domain/bookPicker';
import { completesReading, formatPercent, newId, trackUnit } from '../../domain/books';
import { parseDay } from '../../domain/dates';
import { MODES, buildEntry, defaultMode, modesFor, previewLines } from '../../domain/reading';
import { useLibrary } from '../../state/useLibrary';

const fmtDate = (key) => parseDay(key).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });

export function ReadingEntryForm({ date, bookId: fixedId, source = 'form', onDone, onCancel, keepOpen = false, onComplete, onOpenLibrary, onDirtyChange, onBusyChange }) {
  const { state, actions } = useLibrary();
  const uid = useId();
  const log = state.progress.readingLog;
  // Orden de las lecturas activas fijado al abrir: no se reordena mientras el formulario está abierto
  const [order] = useState(() => initialReadingOrder(state.books, state.settings.currentBookId));
  const choices = fixedId ? [] : readingChoices(state.books, order);
  const labels = choiceLabels(choices);
  // Sin lecturas activas no se elige nada en silencio
  const [bookId, setBookId] = useState(() => fixedId ?? choices[0]?.id ?? '');
  const [savedAt, setSavedAt] = useState(0);
  const book = state.books.find((b) => b.id === (fixedId ?? bookId));
  const missing = Boolean(bookId) && !book;
  const [mode, setMode] = useState(() => (book ? defaultMode(book, log) : 'added'));
  // Un valor por modalidad: cambiar entre página y porcentaje no borra lo escrito en la otra
  const [texts, setTexts] = useState({});
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
  const text = texts[activeMode] ?? '';
  const setText = (value) => setTexts((t) => ({ ...t, [activeMode]: value }));
  // La vista previa y el guardado son el mismo registro (cálculo puro y barato en cada render)
  const draft = book && text.trim() ? buildEntry(book, log, { date, mode: activeMode, text, declared, id: attemptId, source }) : null;

  // Hay algo escrito sin guardar: quien abrió el formulario puede pedir confirmación antes de cerrarlo
  const dirty = Object.values(texts).some((t) => String(t).trim());
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  // Mientras se guarda, quien contiene el formulario bloquea cambios (p. ej. el selector de lectura)
  useEffect(() => {
    onBusyChange?.(saving);
  }, [saving, onBusyChange]);

  // «Guardado» se ve ≈ 1200 ms y se anuncia una vez
  useEffect(() => {
    if (!savedAt) return undefined;
    const id = setTimeout(() => setSavedAt(0), 1200);
    return () => clearTimeout(id);
  }, [savedAt]);

  const unit = book ? trackUnit(book) : 'pages';
  const fieldId = `${uid}-value`;
  const errorId = `${uid}-error`;
  const error = draft?.error ?? (touched && !text.trim() ? 'Escribe un número.' : '');
  const preview = draft?.entry ? true : null;
  const unknownAdvance = draft?.entry && draft.entry.kind === 'read' && !(draft.entry.delta > 0);

  // Si el libro elegido deja de estar activo (p. ej. se acaba de terminar), la selección pasa a otra lectura
  // activa DESPUÉS de la operación en curso; nunca mientras se guarda
  const stale = !fixedId && !saving && book && book.status !== 'reading';
  const nextActive = choices[0]?.id ?? '';
  useEffect(() => {
    if (!stale) return;
    setBookId(nextActive);
    const next = state.books.find((b) => b.id === nextActive);
    if (next) setMode(defaultMode(next, log));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stale, nextActive]);

  const switchBook = (id) => {
    playUiSound('select');
    setBookId(id);
    const next = state.books.find((b) => b.id === id);
    if (next) setMode(defaultMode(next, log));
    setTexts({});
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
    // Transición real a terminado: antes por debajo del total (o del 100 %) y ahora en él (419/420 no termina)
    const before = book;
    const figuresBefore = state.progress.figures;
    const completes = completesReading(before, draft.position);
    actions.logReading(draft.entry, draft.position);
    // Progreso, sesión y estado se guardan juntos en una sola escritura; si falla, se deshace en memoria (no
    // se muestra como terminada) y el formulario conserva sus datos para reintentar con el mismo id
    setTimeout(() => {
      lock.current = false;
      setSaving(false);
      if (!actions.persistNow()) {
        actions.revertLog(draft.entry.id, before, figuresBefore);
        setFailure('No se ha podido guardar en este dispositivo. Tus datos siguen aquí: vuelve a intentarlo.');
        return;
      }
      // Éxito confirmado: ahora sí el sello y «Guardado» (una sola vez por guardado)
      const saved = draft.entry;
      playUiSound('save');
      setSavedAt(Date.now());
      setAttemptId(newId('s'));
      setTexts({});
      setTouched(false);
      setConfirmCorrection(false);
      // Con el libro y los sellos de antes, quien lo abrió puede ofrecer «Deshacer» de la operación completa
      onDone?.(saved, { keepOpen, before, figuresBefore, completes });
      // Solo tras el guardado confirmado y una vez por operación (el id del intento ya ha cambiado)
      if (completes) onComplete?.(before.id, saved);
    }, 0);
  };

  const picker = !fixedId && (
    <div className="reading-form__picker">
      {choices.length ? (
        <label className="reading-form__field">
          <span>Libro</span>
          <select value={book && choices.some((c) => c.id === book.id) ? book.id : ''} onChange={(e) => switchBook(e.target.value)} disabled={saving}>
            {!book && (
              <option value="" disabled>
                Selecciona un libro
              </option>
            )}
            {choices.map((b) => (
              <option key={b.id} value={b.id}>
                {labels[b.id]}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <div className="reading-form__none">
          <p>No tienes ninguna lectura en curso</p>
          {onOpenLibrary && (
            <button type="button" className="link-btn" onClick={onOpenLibrary}>
              Elegir un libro de mi biblioteca
            </button>
          )}
        </div>
      )}
      {missing && <p className="reading-form__error">Ese libro ya no está en tu biblioteca: elige otro.</p>}
    </div>
  );

  if (!book || (!fixedId && book.status !== 'reading')) {
    return (
      <form className="reading-form" onSubmit={(e) => e.preventDefault()} noValidate>
        {picker || <p className="cal-pop__empty">No hay libro para registrar.</p>}
        {/* Sin lectura activa el registro queda deshabilitado (no se elige nada en silencio) */}
        {!fixedId && (
          <div className="reading-form__actions">
            <button type="submit" className="stamp-btn reading-form__save" disabled>
              Guardar lectura
            </button>
          </div>
        )}
      </form>
    );
  }

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
      {picker}
      {modes.length > 1 && (
        <div className="reading-form__modes" role="radiogroup" aria-label="Cómo quieres registrarlo">
          {modes.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={activeMode === m}
              onClick={() => {
                if (m !== activeMode) playUiSound('select');
                setMode(m);
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
            placeholder={activeMode === 'percent' ? 'Ej. 42,5' : activeMode === 'page' ? `Ej. ${Math.min(book.pageCount || Infinity, (book.currentPage || 0) + 20)}` : 'Ej. 20'}
            onChange={(e) => {
              setText(e.target.value);
              setConfirmCorrection(false);
              setFailure('');
            }}
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

      {/* Sin nada escrito, una pista; con un valor inválido manda su error (nunca «Escribe un valor») */}
      {!preview && !text.trim() && (
        <div className="reading-form__preview reading-form__preview--empty">
          <span className="reading-form__preview-label">Se guardará · {fmtDate(date)}</span>
          <span>Escribe un valor para ver cómo quedará.</span>
        </div>
      )}
      {preview && (
        <div className="reading-form__preview" data-correction={draft.correction || undefined} aria-live="polite">
          <span className="reading-form__preview-label">Se guardará · {fmtDate(date)}</span>
          {previewLines(draft.entry).map((line, i) => (
            <span key={i} className={i === 0 ? 'reading-form__preview-main' : undefined}>
              {line}
            </span>
          ))}
          {!draft.correction && draft.entry.from == null && draft.entry.kind === 'read' && !(draft.entry.delta > 0) && <span>Sin posición anterior conocida</span>}
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
        <span className="reading-form__saved" aria-live="polite">
          {savedAt ? '✓ Guardado' : ''}
        </span>
        {onCancel && (
          <button type="button" className="link-btn" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
