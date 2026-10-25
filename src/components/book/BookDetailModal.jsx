// Ficha del libro (SPEC §27.6–27.8): una hoja de papel gouache con tres pestañas. Ficha: ex-libris compacto,
// portada y título, estado, progreso, «Registrar lectura», valoración y favorito, y los detalles de la edición
// plegados. Diario: cuaderno de entradas fechadas con lo que ya existe (sesiones, citas subrayadas y la reseña).
// Lectores: las opiniones de la comunidad. Solo presentación: los datos y operaciones son los de siempre.
import { BookMarked, ChevronDown, Feather, Heart, Minus, NotebookPen, PenLine, Plus, Trash2, X } from 'lucide-react';
import { Suspense, lazy, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { pageRustle } from '../../audio/ambientAudio';
import { playUiSound } from '../../audio/uiSounds';
import { EDGE_NAMES, FORMATS, STATUS, audioHours, formatHours, formatPercent, hoursLeft, percentRead, progress, sprayedEdge, trackUnit } from '../../domain/books';
import { dayKey, parseDay } from '../../domain/dates';
import { journalDays } from '../../domain/journal';
import { entryText } from '../../domain/reading';
import { ReadingEntryForm } from '../panels/ReadingEntryForm';
import { RatingInput, RatingStars } from './Rating';
import { QuoteMeaningsEditor } from './QuoteMeaningsEditor';
import { COLOR_IDS, meaningOf } from '../../domain/quoteMeanings';
import { useLibrary } from '../../state/useLibrary';
import { modalRoot } from '../panels/modalRoot';
import { PanelShell } from '../panels/PanelShell';
import { Cover } from '../shelf/BookItem';
import { EdgePicker } from './EditionPicker';
import { ElegantQuoteCard } from '../quotes/ElegantQuoteCard';
import { PublishControls } from '../../features/reviews/PublishControls';

// Las opiniones de la comunidad se cargan solo al abrirlas
const ReadersPanel = lazy(() => import('../../features/reviews/ReadersPanel').then((m) => ({ default: m.ReadersPanel })));

/** Sello del ex-libris (velero sobre las olas de la bahía), 48 px. */
function ExLibrisStamp() {
  const id = useId();
  return (
    <svg className="ex-libris__stamp" viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <path id={`${id}-arc`} d="M18 60 A42 42 0 0 1 102 60" />
      </defs>
      <circle cx="60" cy="60" r="56" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle cx="60" cy="60" r="49" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 3" />
      <text className="ex-libris__arc">
        <textPath href={`#${id}-arc`} startOffset="50%" textAnchor="middle">
          EX · LIBRIS
        </textPath>
      </text>
      <path d="M60 44 L60 74 M60 46 L76 70 L60 70 Z M58 50 L46 70 L58 70 Z" fill="currentColor" opacity="0.85" />
      <path d="M40 76 L80 76 L74 82 L46 82 Z" fill="currentColor" />
      <path d="M30 90 q7 -5 14 0 t14 0 t14 0 t14 0 t14 0" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function ExLibris({ owner, onRename }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(owner);
  return (
    <div className="ex-libris">
      <ExLibrisStamp />
      <p>
        De la biblioteca junto al mar de{' '}
        {editing ? (
          <input
            className="ex-libris__input"
            value={name}
            autoFocus
            maxLength={28}
            aria-label="Tu nombre en el ex-libris"
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              setEditing(false);
              onRename(name.trim() || owner);
            }}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
        ) : (
          <button type="button" className="ex-libris__name" onClick={() => setEditing(true)} aria-label={`Cambiar el nombre del ex-libris: ${owner}`}>
            {owner}
            <PenLine aria-hidden="true" />
          </button>
        )}
      </p>
    </div>
  );
}

/** Progreso: posición, barra y tiempo restante; por páginas, con el ajuste rápido de la página actual. */
function ProgressBlock({ book, pagesPerHour, onPage }) {
  const unit = trackUnit(book);
  const pct = percentRead(book);
  if (unit === 'percent') {
    return (
      <div className="sheet-progress">
        <p className="sheet-progress__line">
          <strong>{formatPercent(pct)} leído</strong>
          {!book.pageCount && <span>Sin paginación: el avance se registra en porcentaje.</span>}
        </p>
        <span className="page-controls__bar" style={{ '--p': `${pct}%` }} aria-hidden="true" />
      </div>
    );
  }
  const left = hoursLeft(book, pagesPerHour);
  return (
    <div className="sheet-progress">
      <div className="sheet-progress__pages">
        <button type="button" className="round-btn" onClick={() => onPage(book.currentPage - 10)} aria-label="Retroceder 10 páginas">
          −10
        </button>
        <button type="button" className="round-btn" onClick={() => onPage(book.currentPage - 1)} aria-label="Retroceder una página">
          <Minus aria-hidden="true" />
        </button>
        <label className="sheet-progress__current">
          <span className="sr-only-focus">Página actual</span>
          <input
            type="number"
            className="ink-input ink-input--num"
            min="0"
            max={book.pageCount}
            value={book.currentPage}
            onChange={(e) => onPage(Number(e.target.value))}
            aria-label="Página actual"
          />
        </label>
        <span className="sheet-progress__of">de {book.pageCount}</span>
        <button type="button" className="round-btn" onClick={() => onPage(book.currentPage + 1)} aria-label="Avanzar una página">
          <Plus aria-hidden="true" />
        </button>
        <button type="button" className="round-btn" onClick={() => onPage(book.currentPage + 10)} aria-label="Avanzar 10 páginas">
          +10
        </button>
      </div>
      <input
        type="range"
        className="page-range"
        min="0"
        max={book.pageCount}
        value={book.currentPage}
        onChange={(e) => onPage(Number(e.target.value))}
        style={{ '--p': `${progress(book)}%` }}
        aria-label="Progreso de lectura"
      />
      <p className="sheet-progress__line">
        <strong>{formatPercent(pct)} leído</strong>
        <span>{left > 0 ? `≈ ${formatHours(left)} restantes` : '¡Terminado!'}</span>
      </p>
    </div>
  );
}

/** Lo que tiene de especial cada edición, escrito como en la ficha de una librería anticuaria. */
const EDITION_NOTES = {
  hardcover: 'Tapas rígidas, bisagra marcada y sobrecubierta satinada.',
  paperback: 'Bolsillo de papel crema tostado, ya con marcas de lectura.',
  sprayed_edges: 'Cantos pintados a mano con el diseño que elijas.',
  leatherbound: 'Piel envejecida, cuatro nervios en el lomo y cantoneras de latón.',
  clothbound: 'Lino tejido con marco de foil dorado y cinta de seda.',
  annotated: 'Llena de post-its de colores y con su faja «Edición Anotada».',
  kindle: 'Tinta electrónica con luz cálida, ligera como una libreta.',
  audiobook: 'Estuche acrílico de colección con sus cascos.',
};

/** «Detalles de mi edición»: total de páginas, unidad de seguimiento, velocidad y edición (plegado). */
function EditionDetails({ book, pagesPerHour, onUpdate, onTracking, onSpeed }) {
  const unit = trackUnit(book);
  const edge = sprayedEdge(book);
  return (
    <details className="sheet-details">
      <summary>
        Detalles de mi edición
        <ChevronDown aria-hidden="true" />
      </summary>
      <div className="sheet-details__body">
        <label className="sheet-field">
          <span>Total de páginas</span>
          <input
            type="number"
            className="ink-input ink-input--num"
            min="1"
            value={book.pageCount ?? ''}
            disabled={!book.pageCount}
            onChange={(e) => onUpdate({ pageCount: Math.max(1, Number(e.target.value) || 1) })}
            aria-label="Total de páginas"
          />
        </label>
        <label className="sheet-check">
          <input type="checkbox" checked={!book.pageCount} onChange={(e) => onUpdate({ pageCount: e.target.checked ? null : 300 })} />
          <span>Total de páginas desconocido</span>
        </label>
        <div className="tracking__unit" role="radiogroup" aria-label="Seguir el progreso por">
          <span>Seguir por</span>
          <button type="button" role="radio" aria-checked={unit === 'pages'} disabled={!book.pageCount} onClick={() => onTracking('pages')}>
            Páginas
          </button>
          <button type="button" role="radio" aria-checked={unit === 'percent'} onClick={() => onTracking('percent')}>
            Porcentaje
          </button>
        </div>
        <label className="sheet-field">
          <span>Velocidad</span>
          <input
            type="number"
            className="ink-input ink-input--num"
            min="5"
            max="300"
            value={pagesPerHour}
            onChange={(e) => onSpeed(Math.max(5, Math.min(300, Number(e.target.value) || 40)))}
            aria-label="Velocidad de lectura en páginas por hora"
          />
          <span>págs./h</span>
        </label>
        <label className="sheet-field">
          <span>Edición</span>
          <select value={book.editionType} onChange={(e) => onUpdate({ editionType: e.target.value })}>
            {Object.entries(FORMATS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        {book.editionType === 'sprayed_edges' && <EdgePicker value={book.sprayedEdgeStyle} onChange={(sprayedEdgeStyle) => onUpdate({ sprayedEdgeStyle })} />}
        {book.editionType === 'audiobook' && (
          <label className="sheet-field">
            <span>Duración</span>
            <input
              type="number"
              className="ink-input ink-input--num"
              min="1"
              max="99"
              value={audioHours(book)}
              onChange={(e) => onUpdate({ audioHours: Math.max(1, Math.min(99, Number(e.target.value) || 1)) })}
              aria-label="Duración del audiolibro en horas"
            />
            <span>horas</span>
          </label>
        )}
        <p className="edition-note">
          {EDITION_NOTES[book.editionType]}
          {edge === 'gilded' ? ` · cantos en ${EDGE_NAMES.gilded.toLowerCase()}` : ''}
        </p>
      </div>
    </details>
  );
}

const dateLabel = (key) => (key ? parseDay(key).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Sin fecha');

/**
 * Diario como cuaderno (SPEC §27.7). Las citas conservan su id de color y muestran el significado que eligió el
 * usuario (para todos sus libros) con una marca lateral; el filtro recuerda su selección por id de color.
 */
function Journal({ book, log, meanings, onAdd, onRemove, onShow }) {
  const [text, setText] = useState('');
  const [page, setPage] = useState(book.currentPage || '');
  const [color, setColor] = useState('yellow');
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState('');
  const [writing, setWriting] = useState(false);
  const textRef = useRef(null);
  const days = useMemo(() => journalDays(book, log), [book, log]);
  const counts = book.quotes.reduce((acc, q) => {
    const id = meaningOf(meanings, q.color).id ?? 'unknown';
    acc[id] = (acc[id] ?? 0) + 1;
    return acc;
  }, {});
  const current = meaningOf(meanings, color);
  const showItem = (item) => filter === 'all' || (item.kind === 'quote' && (meaningOf(meanings, item.quote.color).id ?? 'unknown') === filter);
  const visibleDays = days.map((d) => ({ ...d, items: d.items.filter(showItem) })).filter((d) => d.items.length);
  const empty = days.length === 0;
  const formOpen = !empty || writing;

  useEffect(() => {
    if (writing) textRef.current?.focus({ preventScroll: false });
  }, [writing]);

  return (
    <div className="journal">
      {book.quotes.length > 0 && (
        <div className="quote-filter" role="radiogroup" aria-label="Filtrar citas por significado">
          <button type="button" role="radio" aria-checked={filter === 'all'} onClick={() => setFilter('all')}>
            Todo · {days.reduce((n, d) => n + d.items.length, 0)}
          </button>
          {[...COLOR_IDS, ...(counts.unknown ? ['unknown'] : [])]
            .filter((id) => counts[id])
            .map((id) => {
              const m = meaningOf(meanings, id === 'unknown' ? null : id);
              return (
                <button key={id} type="button" role="radio" aria-checked={filter === id} style={{ '--marker': m.hex }} onClick={() => setFilter(id)}>
                  <span className="quote-filter__dot" aria-hidden="true" />
                  {m.label} · {counts[id]}
                </button>
              );
            })}
        </div>
      )}

      {empty ? (
        <div className="journal__empty">
          <p>¿Qué te gustaría recordar de esta historia?</p>
          {!writing && (
            <button type="button" className="sheet-btn sheet-btn--primary" onClick={() => setWriting(true)}>
              <NotebookPen aria-hidden="true" />
              Escribir mi primera anotación
            </button>
          )}
        </div>
      ) : (
        <ol className="journal__days">
          {visibleDays.map((d) => (
            <li key={d.key ?? 'sin-fecha'} className="journal-day">
              <h4 className="journal-day__date">{dateLabel(d.key)}</h4>
              <ul className="journal-day__items">
                {d.items.map((item) => {
                  if (item.kind === 'session') {
                    return (
                      <li key={item.id} className="journal-entry journal-entry--session">
                        <span className="journal-entry__kind">Lectura</span>
                        <p>{entryText(item.entry)}</p>
                      </li>
                    );
                  }
                  if (item.kind === 'review') {
                    return (
                      <li key="review" className="journal-entry journal-entry--review">
                        <span className="journal-entry__kind">Reseña al terminar</span>
                        {book.rating > 0 && <RatingStars value={book.rating} />}
                        <p>{book.review}</p>
                      </li>
                    );
                  }
                  const q = item.quote;
                  const m = meaningOf(meanings, q.color);
                  return (
                    <li key={q.id} className="journal-entry quote" data-color={q.color} style={{ '--marker': m.hex, '--marker-ink': m.ink }}>
                      <blockquote>
                        <mark>{q.text}</mark>
                      </blockquote>
                      <footer>
                        <span className="quote__tag" title={m.description || undefined}>
                          {m.label}
                        </span>
                        {q.page ? <span className="quote__page">pág. {q.page}</span> : null}
                        <button type="button" className="icon-btn icon-btn--tiny" onClick={() => onShow(q)} aria-label="Ver esta cita como carta de algodón y lacre" title="Ver como carta">
                          <Feather aria-hidden="true" />
                        </button>
                        <button type="button" className="icon-btn icon-btn--tiny" onClick={() => onRemove(q.id)} aria-label="Borrar esta cita">
                          <X aria-hidden="true" />
                        </button>
                      </footer>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
          {!visibleDays.length && <li className="journal__none">No hay citas con este significado.</li>}
        </ol>
      )}

      {formOpen && (
        <form
          className="quote-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            onAdd({ text: text.trim(), page: Number(page) || null, color });
            setText('');
            playUiSound('save');
          }}
        >
          <h4 className="quote-form__title">Nueva anotación</h4>
          <textarea ref={textRef} value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Copia aquí la frase que te ha atrapado…" aria-label="Nueva cita" />
          <div className="quote-form__row">
            <label className="quote-form__page">
              pág.
              <input type="number" min="0" value={page} onChange={(e) => setPage(e.target.value)} className="ink-input ink-input--tiny" aria-label="Página de la cita" />
            </label>
            <div className="markers" role="radiogroup" aria-label="Color del marcador">
              {COLOR_IDS.map((key) => {
                const m = meaningOf(meanings, key);
                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={color === key}
                    className="marker"
                    style={{ '--marker': m.hex }}
                    onClick={() => {
                      if (color !== key) playUiSound('pencil');
                      setColor(key);
                    }}
                    title={m.label}
                  >
                    <span className="sr-only-focus">{m.label}</span>
                  </button>
                );
              })}
            </div>
            <button type="submit" className="sheet-btn sheet-btn--primary" disabled={!text.trim()}>
              Subrayar
            </button>
          </div>
          <p className="quote-form__legend">
            <span>{current.label}</span>
            <button type="button" className="link-btn quote-form__customize" aria-expanded={editing} onClick={() => setEditing((v) => !v)}>
              Personalizar colores
            </button>
          </p>
          {notice && (
            <p className="quote-form__notice" role="status">
              {notice}
            </p>
          )}
        </form>
      )}
      {editing && (
        <QuoteMeaningsEditor
          onClose={(saved) => {
            setEditing(false);
            setNotice(saved ? 'Significados guardados.' : '');
          }}
        />
      )}
    </div>
  );
}

const TABS = [
  { id: 'left', label: 'Ficha' },
  { id: 'right', label: 'Diario' },
  { id: 'readers', label: 'Lectores' },
];

export function BookDetailModal({ bookId, onClose, onSwitch, onOpenProfile, onOpenReader, onComplete }) {
  const { state, actions } = useLibrary();
  const book = state.books.find((b) => b.id === bookId);
  const [page, setPage] = useState('left');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [review, setReview] = useState(book?.review ?? '');
  const [shownQuote, setShownQuote] = useState(null);
  const [logging, setLogging] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    playUiSound('bookOpen');
  }, []);

  useEffect(() => {
    if (!book) return undefined;
    if (review === book.review) return undefined;
    const id = setTimeout(() => actions.updateBook(book.id, { review }), 600);
    return () => clearTimeout(id);
  }, [review, book, actions]);

  if (!book) return null;
  const { settings } = state;
  const isMain = settings.currentBookId === book.id;
  const readingNow = state.books.filter((b) => b.status === 'reading');
  const update = (patch) => actions.updateBook(book.id, patch);
  const goTo = (id) => {
    if (id !== page) playUiSound('diaryTab');
    setPage(id);
    scrollRef.current?.scrollTo({ top: 0 });
  };

  return (
    <PanelShell onClose={onClose} label={`${book.title}, de ${book.author}`} variant="sheet">
      <div className="book-sheet" data-page={page} data-edition={book.editionType}>
        <div className="book-sheet__bar">
          <div className="book-sheet__tabs" role="tablist" aria-label="Páginas del libro">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" data-readers={t.id === 'readers' || undefined} aria-selected={page === t.id} onClick={() => goTo(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
          <button type="button" className="book-sheet__close" onClick={onClose} aria-label="Cerrar">
            <X aria-hidden="true" />
          </button>
        </div>

        <div ref={scrollRef} className="book-sheet__scroll">
          <section className="sheet-page sheet-page--ficha" aria-label="Ficha del libro" hidden={page !== 'left'}>
            <ExLibris owner={settings.owner} onRename={(owner) => actions.setSettings({ owner })} />
            <header className="sheet-head">
              <span className="sheet-head__cover" aria-hidden="true">
                <Cover book={book} />
              </span>
              <div className="sheet-head__text">
                <h2>{book.title}</h2>
                <p>
                  {book.author}
                  {book.publishedDate && <span> · {book.publishedDate.slice(0, 4)}</span>}
                </p>
                {!!book.categories.length && (
                  <ul className="chips">
                    {book.categories.slice(0, 3).map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                )}
              </div>
            </header>

            <div className="sheet-status" role="radiogroup" aria-label="Balda">
              {Object.entries(STATUS).map(([k, v]) => (
                <button key={k} type="button" role="radio" aria-checked={book.status === k} className="paper-chip" onClick={() => update({ status: k })}>
                  {v}
                </button>
              ))}
            </div>
            {book.status === 'reading' && (
              <button type="button" className="link-btn sheet-main" aria-pressed={isMain} onClick={() => actions.setSettings({ currentBookId: book.id })}>
                <BookMarked aria-hidden="true" />
                {isMain ? 'Es el libro abierto sobre tu cama' : 'Dejarlo abierto sobre la cama'}
              </button>
            )}
            {/* Los libros que estás leyendo: toca otro para abrirlo en la cama */}
            {book.status === 'reading' && readingNow.length > 1 && onSwitch && (
              <nav className="reading-switch" aria-label="Libros que estás leyendo">
                <span className="reading-switch__label">Leyendo ahora</span>
                {readingNow.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    className="reading-switch__book"
                    aria-current={b.id === book.id ? 'true' : undefined}
                    onClick={() => {
                      if (b.id === book.id) return;
                      actions.setSettings({ currentBookId: b.id });
                      onSwitch(b.id);
                    }}
                    title={`${b.title} · ${formatPercent(percentRead(b))}`}
                  >
                    <span className="reading-switch__cover">
                      <Cover book={b} />
                    </span>
                    <span className="reading-switch__text">
                      <b>{b.title}</b>
                      <em>{formatPercent(percentRead(b))}</em>
                    </span>
                  </button>
                ))}
              </nav>
            )}

            <ProgressBlock
              book={book}
              pagesPerHour={settings.pagesPerHour}
              onPage={(p) => {
                actions.setPage(book.id, p);
                if (p > book.currentPage) pageRustle(0.6);
              }}
            />

            {/* El mismo formulario de registro del calendario; si termina el libro, abre la reseña de terminar */}
            <div className="sheet-log">
              <button type="button" className="sheet-btn sheet-btn--primary" aria-expanded={logging} onClick={() => setLogging((v) => !v)}>
                <NotebookPen aria-hidden="true" />
                Registrar lectura
              </button>
              {logging && (
                <ReadingEntryForm
                  date={dayKey()}
                  bookId={book.id}
                  keepOpen
                  onCancel={() => setLogging(false)}
                  onComplete={(id) => onComplete?.(id)}
                />
              )}
            </div>

            <div className="sheet-rating">
              <RatingInput value={book.rating} onChange={(rating) => update({ rating })} />
              <button
                type="button"
                className="fav-btn"
                aria-pressed={book.favorite}
                onClick={() => update({ favorite: !book.favorite })}
                title={book.favorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
              >
                <Heart aria-hidden="true" />
                <span>Favorito</span>
              </button>
            </div>

            <EditionDetails
              book={book}
              pagesPerHour={settings.pagesPerHour}
              onUpdate={update}
              onTracking={(unit) => actions.setTracking(book.id, unit)}
              onSpeed={(pagesPerHour) => actions.setSettings({ pagesPerHour })}
            />

            <details className="sheet-details">
              <summary>
                Sinopsis
                <ChevronDown aria-hidden="true" />
              </summary>
              <p className="sheet-details__body sheet-synopsis">{book.synopsis || 'Sin sinopsis todavía. Puedes escribir tus primeras impresiones en el diario.'}</p>
            </details>

            <div className="page__foot">
              {confirmDelete ? (
                <span className="confirm-inline">
                  ¿Sacarlo de tu librería?
                  <button
                    type="button"
                    className="link-btn link-btn--danger"
                    onClick={() => {
                      actions.removeBook(book.id);
                      onClose();
                    }}
                  >
                    Sí, quitar
                  </button>
                  <button type="button" className="link-btn" onClick={() => setConfirmDelete(false)}>
                    Cancelar
                  </button>
                </span>
              ) : (
                <button type="button" className="link-btn link-btn--danger" onClick={() => setConfirmDelete(true)}>
                  <Trash2 aria-hidden="true" /> Quitar de la librería
                </button>
              )}
            </div>
          </section>

          <section className="sheet-page sheet-page--journal" aria-label="Diario de lectura" hidden={page !== 'right'}>
            <h3 className="sheet-title">Diario de lectura</h3>
            <Journal
              book={book}
              log={state.progress.readingLog}
              meanings={settings.quoteMeanings}
              onAdd={(q) => actions.addQuote(book.id, q)}
              onRemove={(qid) => actions.removeQuote(book.id, qid)}
              onShow={setShownQuote}
            />
            <h3 className="sheet-title sheet-title--small">Mi reseña</h3>
            <textarea
              className="review"
              value={review}
              onChange={(e) => setReview(e.target.value)}
              onBlur={() => review !== book.review && update({ review })}
              placeholder="Lo que sentí al leerlo…"
              aria-label="Tu reseña"
              rows={5}
            />
            <PublishControls book={book} onUpdate={update} onOpenProfile={onOpenProfile} />
          </section>

          {page === 'readers' && (
            <section className="sheet-page sheet-page--readers" aria-label="Lectores">
              <h3 className="sheet-title">Voces de lectores</h3>
              <Suspense fallback={<p className="social-note">Abriendo…</p>}>
                <ReadersPanel book={book} onUpdate={update} onOpenReader={onOpenReader} />
              </Suspense>
            </section>
          )}
        </div>
      </div>
      {shownQuote && (
        <QuoteViewer
          quote={shownQuote}
          book={book}
          pinned={settings.pinnedQuote?.text === shownQuote.text}
          onPin={() =>
            actions.setSettings({
              pinnedQuote: settings.pinnedQuote?.text === shownQuote.text ? null : { text: shownQuote.text, author: book.author, work: book.title },
            })
          }
          onClose={() => setShownQuote(null)}
        />
      )}
    </PanelShell>
  );
}

/** Visor de una cita de tus libros como carta de algodón y lacre (ya vive en tu diario de lectura). */
function QuoteViewer({ quote, book, pinned, onPin, onClose }) {
  useEffect(() => {
    // Escape cierra solo la carta, no el libro abierto
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  return createPortal(
    <div className="equote-viewer" role="dialog" aria-label={`Cita de ${book.title}`} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="equote-viewer__inner">
        <button type="button" className="icon-btn equote-viewer__close" onClick={onClose} aria-label="Cerrar la carta">
          <X aria-hidden="true" />
        </button>
        <ElegantQuoteCard text={quote.text} author={book.author} work={`${book.title}${quote.page ? ` · pág. ${quote.page}` : ''}`} onPin={onPin} pinned={pinned} />
      </div>
    </div>,
    modalRoot(),
  );
}
