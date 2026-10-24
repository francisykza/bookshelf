// Formulario «Guardar lectura» (SPEC §14.8, 1.20.0): tres formas de registrar —páginas leídas, página
// alcanzada o porcentaje alcanzado— con una sola activa, vista previa de posición y avance por separado y
// guardado idempotente (el mismo id hasta que termina). Lo usan el calendario, Sesiones, la ficha de los
// libros por porcentaje y el temporizador: no hay otra implementación del registro.
// 1.23.0 (SPEC §17.2–17.3): el selector ofrece solo las lecturas activas y «Otros…» abre un buscador de la
// biblioteca dentro del mismo formulario. El borrador es estado local de esta instancia (una por día editado):
// no lo tocan el reloj del temporizador ni las sincronizaciones. Sin autoFocus ni desplazamientos forzados.
import { useEffect, useId, useRef, useState } from 'react';
import { playUiSound } from '../../audio/uiSounds';
import { OTHER, PAGE, choiceLabels, initialReadingOrder, readingChoices, searchLibrary } from '../../domain/bookPicker';
import { STATUS, formatPercent, newId, trackUnit } from '../../domain/books';
import { parseDay } from '../../domain/dates';
import { MODES, buildEntry, defaultMode, describeEntry, modesFor } from '../../domain/reading';
import { useLibrary } from '../../state/useLibrary';
import { Cover } from '../shelf/BookItem';

const fmtDate = (key) => parseDay(key).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });

/**
 * Buscador de «Otros…»: solo la biblioteca del usuario (sin Google Books ni Open Library), por título y autor.
 */
function LibrarySearch({ books, onPick, onCancel }) {
  const uid = useId();
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const found = searchLibrary(books, query);
  const shown = found ? found.slice(0, limit) : [];
  const status = found === null ? 'Escribe el título o el autor.' : found.length ? `${found.length} ${found.length === 1 ? 'libro encontrado' : 'libros encontrados'}` : 'No hay libros que coincidan en tu biblioteca';
  return (
    <div className="book-search">
      <label className="reading-form__field" htmlFor={`${uid}-q`}>
        <span>Buscar en mi biblioteca</span>
      </label>
      <input
        id={`${uid}-q`}
        className="book-search__input"
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setLimit(PAGE);
        }}
      />
      <p className="book-search__status" aria-live="polite">
        {status}
      </p>
      {shown.length > 0 && (
        <ul className="book-search__results">
          {shown.map((b) => (
            <li key={b.id}>
              <button type="button" className="book-search__result" onClick={() => onPick(b.id)}>
                <span className="book-search__cover" aria-hidden="true">
                  <Cover book={b} />
                </span>
                <span className="book-search__text">
                  <b>{b.title}</b>
                  <span>{b.author}</span>
                  <em>{STATUS[b.status] ?? b.status}</em>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="book-search__more">
        {found && found.length > limit && (
          <button type="button" className="link-btn" onClick={() => setLimit((n) => n + PAGE)}>
            Mostrar más
          </button>
        )}
        <button type="button" className="link-btn" onClick={onCancel}>
          Volver
        </button>
      </div>
    </div>
  );
}

export function ReadingEntryForm({ date, bookId: fixedId, source = 'form', onDone, onCancel, keepOpen = false }) {
  const { state, actions } = useLibrary();
  const uid = useId();
  const log = state.progress.readingLog;
  // Orden de las lecturas activas fijado al abrir: no se reordena mientras el formulario está abierto
  const [order] = useState(() => initialReadingOrder(state.books, state.settings.currentBookId));
  const choices = fixedId ? [] : readingChoices(state.books, order);
  const labels = choiceLabels(choices);
  // Sin lecturas activas no se elige nada en silencio
  const [bookId, setBookId] = useState(() => fixedId ?? choices[0]?.id ?? '');
  const [searching, setSearching] = useState(false);
  const [savedAt, setSavedAt] = useState(0);
  const book = state.books.find((b) => b.id === (fixedId ?? bookId));
  const missing = Boolean(bookId) && !book;
  const pickedOther = !fixedId && book && !choices.some((b) => b.id === book.id);
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
  const preview = draft?.entry ? describeEntry(draft.entry) : null;
  const unknownAdvance = draft?.entry && draft.entry.kind === 'read' && !(draft.entry.delta > 0);

  const switchBook = (id) => {
    if (id === OTHER) {
      setSearching(true);
      return;
    }
    playUiSound('select');
    setSearching(false);
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
    actions.logReading(draft.entry, draft.position);
    // Tras confirmar el estado, se escribe al momento; si falla, el formulario conserva sus datos
    setTimeout(() => {
      lock.current = false;
      setSaving(false);
      if (!actions.persistNow()) {
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
      if (!keepOpen) onDone?.(saved);
      else onDone?.(saved, { keepOpen: true });
    }, 0);
  };

  const picker = !fixedId && (
    <div className="reading-form__picker">
      {searching ? (
        <LibrarySearch books={state.books} onPick={switchBook} onCancel={() => setSearching(false)} />
      ) : pickedOther ? (
        <div className="reading-form__chosen" aria-live="polite">
          <span className="book-search__cover" aria-hidden="true">
            <Cover book={book} />
          </span>
          <span className="book-search__text">
            <b>{book.title}</b>
            <span>{book.author}</span>
            <em>{STATUS[book.status] ?? book.status}</em>
          </span>
          <button type="button" className="link-btn" onClick={() => setSearching(true)}>
            Cambiar libro
          </button>
        </div>
      ) : (
        <label className="reading-form__field">
          <span>Libro</span>
          <select value={book ? book.id : ''} onChange={(e) => switchBook(e.target.value)}>
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
            <option value={OTHER}>Otros…</option>
          </select>
        </label>
      )}
      {missing && !searching && <p className="reading-form__error">Ese libro ya no está en tu biblioteca: elige otro.</p>}
    </div>
  );

  if (!book) {
    return (
      <form className="reading-form" onSubmit={(e) => e.preventDefault()} noValidate>
        {picker || <p className="cal-pop__empty">No hay libro para registrar.</p>}
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
      {!searching && modes.length > 1 && (
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
      <div className="reading-form__field" hidden={searching}>
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

      {!preview && !searching && (
        <div className="reading-form__preview reading-form__preview--empty">
          <span className="reading-form__preview-label">Se guardará · {fmtDate(date)}</span>
          <span>Escribe un valor para ver cómo quedará.</span>
        </div>
      )}
      {preview && !searching && (
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
      <div className="reading-form__actions" hidden={searching}>
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
