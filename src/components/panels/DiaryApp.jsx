// «Mi diario» del portátil (SPEC §28.6): Hoy · Calendario · Notas. Una sola fuente de datos: el registro de
// lectura (`progress.readingLog`) y las anotaciones de cada libro (`book.quotes`). Registrar desde Hoy usa el
// mismo `ReadingEntryForm` que el calendario y la ficha; el Calendario es el `CalendarApp` de siempre; las Notas
// son las mismas anotaciones del diario de cada libro (crear, editar, filtrar y borrar con confirmación).
import { BookOpen, ChevronRight, Pencil, Plus, Search, Sun } from 'lucide-react';
import { useMemo, useState } from 'react';
import { playUiSound } from '../../audio/uiSounds';
import { STATUS, formatPercent, newId, percentRead } from '../../domain/books';
import { dayKey, parseDay } from '../../domain/dates';
import { latestEntries, weekOf } from '../../domain/diary';
import { COLOR_IDS, meaningOf } from '../../domain/quoteMeanings';
import { activeDays, entryText } from '../../domain/reading';
import { useLibrary } from '../../state/useLibrary';
import { AnnotationForm, AnnotationItem, useConfirmedSave } from '../book/Annotations';
import { Cover } from '../shelf/BookItem';
import { CalendarApp } from './ReadingCalendar';
import { ReadingEntryForm } from './ReadingEntryForm';

const VIEWS = [
  { id: 'today', label: 'Hoy' },
  { id: 'calendar', label: 'Calendario' },
  { id: 'notes', label: 'Notas' },
];
const WEEK = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const WEEK_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const shortDate = (iso) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
const validIso = (iso) => Boolean(iso) && !Number.isNaN(new Date(iso).getTime());

function TodayView({ onComplete, onOpenBook }) {
  const { state, actions } = useLibrary();
  const today = dayKey();
  const reading = state.books.filter((b) => b.status === 'reading');
  const [chosen, setChosen] = useState(() => (reading.some((b) => b.id === state.settings.currentBookId) ? state.settings.currentBookId : (reading[0]?.id ?? null)));
  const book = reading.find((b) => b.id === chosen) ?? reading[0] ?? null;
  const [logging, setLogging] = useState(false);
  const [writing, setWriting] = useState(false);
  const adding = useConfirmedSave((id) => Boolean(book?.quotes.some((q) => q.id === id)));
  const days = useMemo(() => activeDays(state.progress.readingLog), [state.progress.readingLog]);
  const week = weekOf(today);
  const readDays = week.filter((d) => days.has(d)).length;
  const latest = latestEntries(state.books, state.progress.readingLog);
  const lastNote = book ? ([...book.quotes].filter((q) => validIso(q.createdAt)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null) : null;
  const date = parseDay(today);

  return (
    <div className="pcd-today">
      <header className="pcd-date">
        <h3>{date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}</h3>
        <p>
          <Sun aria-hidden="true" />
          {cap(date.toLocaleDateString('es-ES', { weekday: 'long' }))}, {date.getFullYear()}
        </p>
      </header>

      <section className="pcd-section" aria-labelledby="diary-reading-title">
        <h4 id="diary-reading-title">La lectura de hoy</h4>
        {!book ? (
          <p className="pcd-empty">No tienes ninguna lectura abierta. Elige un libro de Pendientes en tu biblioteca.</p>
        ) : (
          <>
            {reading.length > 1 && (
              <label className="pcd-picker">
                <span>Lectura</span>
                <select
                  value={book.id}
                  onChange={(e) => {
                    setChosen(e.target.value);
                    setLogging(false);
                  }}
                >
                  {reading.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="pcd-book">
              <button type="button" className="pcd-book__cover" onClick={() => onOpenBook(book.id, 'left')} aria-label={`Abrir la ficha de ${book.title}`}>
                <Cover book={book} />
              </button>
              <div className="pcd-book__text">
                <b>{book.title}</b>
                <span>{book.author}</span>
                <span className="pcd-chip">{book.status === 'reading' ? 'Leyendo' : STATUS[book.status]}</span>
                <p className="pcd-book__pos">{book.trackBy === 'pages' && book.pageCount ? `Página ${book.currentPage} de ${book.pageCount}` : `${formatPercent(percentRead(book))} leído`}</p>
                <span className="pcd-book__progress">
                  <span className="pcd-bar" style={{ '--p': `${percentRead(book)}%` }} aria-hidden="true" />
                  <span className="pcd-book__pct">{formatPercent(percentRead(book))}</span>
                </span>
                <button type="button" className="pc-btn pc-btn--primary pcd-book__log" aria-expanded={logging} onClick={() => setLogging((v) => !v)}>
                  <Plus aria-hidden="true" />
                  Registrar lectura
                </button>
              </div>
            </div>
            {logging && <ReadingEntryForm key={book.id} date={today} bookId={book.id} keepOpen onCancel={() => setLogging(false)} onComplete={(id) => onComplete?.(id, today)} />}
          </>
        )}
      </section>

      {book && (
        <section className="pcd-section" aria-labelledby="diary-take-title">
          <h4 id="diary-take-title">Lo que me llevo de estas páginas</h4>
          {/* La última nota real de este libro, a mano; «Escribir una nota» abre el formulario (no suma páginas) */}
          {!writing && (
            <div className="pcd-reflection">
              {lastNote ? <p className="pcd-reflection__text">{lastNote.text}</p> : <p className="pcd-reflection__empty">Aún no has escrito nada de este libro.</p>}
              <button type="button" className="pcd-reflection__write" onClick={() => setWriting(true)}>
                <Pencil aria-hidden="true" />
                Escribir una nota
              </button>
            </div>
          )}
          {writing && (
            <AnnotationForm
              key={book.id}
              book={book}
              meanings={state.settings.quoteMeanings}
              title="Nueva nota"
              autoFocus
              onCancel={() => setWriting(false)}
              submitLabel="Guardar nota"
              placeholder="Una idea, una frase, lo que te ha removido…"
              draftable
              status={adding.status}
              onRetry={adding.retry}
              onSubmit={(quote, done) => {
                const id = newId('q');
                adding.save(
                  () => actions.addQuote(book.id, { id, ...quote }),
                  id,
                  () => {
                    done();
                    playUiSound('noteSave');
                  },
                );
              }}
            />
          )}
        </section>
      )}

      <section className="pcd-section" aria-labelledby="diary-week-title">
        <h4 id="diary-week-title">Mi semana lectora</h4>
        <ol className="pcd-week" aria-label={`${readDays} de 7 días con lectura registrada esta semana`}>
          {week.map((d, i) => (
            <li key={d} data-read={days.has(d) || undefined} data-today={d === today || undefined} data-future={d > today || undefined}>
              <span className="pcd-week__day" aria-hidden="true">
                {WEEK[i]}
                <small>{parseDay(d).getDate()}</small>
              </span>
              <i aria-hidden="true" />
              <span className="sr-only-focus">
                {WEEK_NAMES[i]}: {days.has(d) ? 'con lectura' : d > today ? 'aún no ha llegado' : 'sin lectura'}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="pcd-section" aria-labelledby="diary-latest-title">
        <h4 id="diary-latest-title">Últimas anotaciones</h4>
        {latest.length === 0 ? (
          <p className="pcd-empty">Aquí aparecerán tus registros y notas.</p>
        ) : (
          <ul className="pcd-latest">
            {latest.map((it) => (
              <li key={it.kind === 'note' ? it.quote.id : it.entry.id}>
                <button type="button" onClick={() => onOpenBook(it.book.id, it.kind === 'note' ? 'notes' : 'history')} title={it.book.title}>
                  <span className="pcd-latest__icon" aria-hidden="true">
                    {it.kind === 'note' ? <Pencil /> : <BookOpen />}
                  </span>
                  <span className="pcd-latest__text">
                    <span>
                      {shortDate(it.kind === 'note' ? it.at : `${it.date}T12:00:00`)} · {it.kind === 'note' ? it.quote.text : entryText(it.entry)}
                    </span>
                    <small className="sr-only-focus">{it.book.title}</small>
                  </span>
                  <ChevronRight aria-hidden="true" className="pcd-latest__go" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function NotesView({ onOpenBook }) {
  const { state, actions } = useLibrary();
  const meanings = state.settings.quoteMeanings;
  const [query, setQuery] = useState('');
  const [bookId, setBookId] = useState('all');
  const [color, setColor] = useState('all');
  const [editId, setEditId] = useState(null);
  const withNotes = state.books.filter((b) => b.quotes.length);
  const all = withNotes.flatMap((b) => b.quotes.map((q) => ({ book: b, quote: q })));
  const editing = useConfirmedSave(({ bookId: bid, id, text, page, color: c }) =>
    state.books.some((b) => b.id === bid && b.quotes.some((q) => q.id === id && q.text === text && (q.page ?? null) === page && q.color === c)),
  );
  const needle = query.trim().toLocaleLowerCase('es');
  const shown = all
    .filter((n) => bookId === 'all' || n.book.id === bookId)
    .filter((n) => color === 'all' || (meaningOf(meanings, n.quote.color).id ?? 'unknown') === color)
    .filter((n) => !needle || n.quote.text.toLocaleLowerCase('es').includes(needle) || n.book.title.toLocaleLowerCase('es').includes(needle))
    .sort((a, b) => (b.quote.createdAt ?? '').localeCompare(a.quote.createdAt ?? ''));
  const counts = all.reduce((acc, n) => {
    const id = meaningOf(meanings, n.quote.color).id ?? 'unknown';
    acc[id] = (acc[id] ?? 0) + 1;
    return acc;
  }, {});

  if (!all.length) return <p className="pcd-empty">Todavía no tienes anotaciones. Puedes escribir la primera desde Hoy o desde el diario de cualquier libro.</p>;

  return (
    <div className="pcd-notes">
      <div className="pcd-notes__filters">
        <label className="pcd-search">
          <Search aria-hidden="true" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar en mis notas…" aria-label="Buscar en mis notas" />
        </label>
        <label className="pcd-picker">
          <span>Libro</span>
          <select value={bookId} onChange={(e) => setBookId(e.target.value)}>
            <option value="all">Todos los libros</option>
            {withNotes.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
              </option>
            ))}
          </select>
        </label>
        <div className="quote-filter" role="radiogroup" aria-label="Filtrar notas por categoría">
          <button type="button" role="radio" aria-checked={color === 'all'} onClick={() => setColor('all')}>
            Todas · {all.length}
          </button>
          {[...COLOR_IDS, ...(counts.unknown ? ['unknown'] : [])]
            .filter((id) => counts[id])
            .map((id) => {
              const m = meaningOf(meanings, id === 'unknown' ? null : id);
              return (
                <button key={id} type="button" role="radio" aria-checked={color === id} style={{ '--marker': m.hex }} onClick={() => setColor(id)}>
                  <span className="quote-filter__dot" aria-hidden="true" />
                  {m.label} · {counts[id]}
                </button>
              );
            })}
        </div>
      </div>
      <p className="pcd-note" role="status">
        {shown.length === all.length ? `${all.length} ${all.length === 1 ? 'nota' : 'notas'}` : `${shown.length} de ${all.length} notas`}
      </p>
      <ul className="pcd-notes__list journal-day__items">
        {shown.map(({ book, quote }) =>
          editId === quote.id ? (
            <li key={quote.id} className="journal-entry journal-entry--editing">
              <AnnotationForm
                book={book}
                meanings={meanings}
                initial={quote}
                title={`Editar nota · ${book.title}`}
                submitLabel="Guardar cambios"
                autoFocus
                status={editing.status}
                onRetry={editing.retry}
                onCancel={() => setEditId(null)}
                onSubmit={(patch) =>
                  editing.save(
                    () => actions.updateQuote(book.id, quote.id, patch),
                    { bookId: book.id, id: quote.id, ...patch },
                    () => {
                      setEditId(null);
                      playUiSound('noteSave');
                    },
                  )
                }
              />
            </li>
          ) : (
            <AnnotationItem
              key={quote.id}
              quote={quote}
              book={book}
              meanings={meanings}
              context={
                <button type="button" className="pcd-notes__book" onClick={() => onOpenBook(book.id, 'notes')}>
                  {book.title}
                  {validIso(quote.createdAt) && <small> · {shortDate(quote.createdAt)}</small>}
                </button>
              }
              onEdit={() => {
                editing.setStatus('idle');
                setEditId(quote.id);
              }}
              onDelete={() => actions.removeQuote(book.id, quote.id)}
            />
          ),
        )}
        {!shown.length && <li className="journal__none">Ninguna nota coincide con la búsqueda.</li>}
      </ul>
    </div>
  );
}

export function DiaryApp({ initialView = 'calendar', selectDay, onComplete, onOpenLibrary, onOpenBook }) {
  const [view, setView] = useState(initialView);
  return (
    <div className="pc-diary" data-view={view}>
      <div className="diary__tabs pc-seg" role="tablist" aria-label="Mi diario">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            id={`diary-tab-${v.id}`}
            aria-selected={view === v.id}
            aria-controls={`diary-view-${v.id}`}
            data-view={v.id}
            onClick={() => {
              if (v.id !== view) playUiSound('diaryTab');
              setView(v.id);
            }}
          >
            {v.label}
          </button>
        ))}
      </div>
      <div className="diary__view" role="tabpanel" id={`diary-view-${view}`} aria-labelledby={`diary-tab-${view}`}>
        {view === 'today' && <TodayView onComplete={onComplete} onOpenBook={onOpenBook} />}
        {view === 'calendar' && <CalendarApp inline selectDay={selectDay} onComplete={onComplete} onOpenLibrary={onOpenLibrary} />}
        {view === 'notes' && <NotesView onOpenBook={onOpenBook} />}
      </div>
    </div>
  );
}
