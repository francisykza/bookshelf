// Ficha del libro (SPEC §27.6–27.8, §28.5–28.8): un cuaderno de una página con tres pestañas. Ficha: ex-libris compacto,
// portada y título, estado, progreso, «Registrar lectura», valoración y favorito, y los detalles de la edición
// plegados. Diario: cuaderno de entradas fechadas con lo que ya existe (sesiones, citas subrayadas y la reseña).
// Lectores: las opiniones de la comunidad. Solo presentación: los datos y operaciones son los de siempre.
import { BookMarked, ChevronDown, ChevronRight, Feather, Heart, Lock, Minus, PenLine, Plus, Trash2, X } from 'lucide-react';
import { Suspense, lazy, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { pageRustle } from '../../audio/ambientAudio';
import { playUiSound } from '../../audio/uiSounds';
import { EDGE_NAMES, FORMATS, STATUS, audioHours, formatHours, formatPercent, hoursLeft, percentRead, progress, sprayedEdge, trackUnit } from '../../domain/books';
import { dayKey } from '../../domain/dates';
import { ReadingEntryForm } from '../panels/ReadingEntryForm';
import { RatingInput } from './Rating';
import { Journal } from './Annotations';
import { NotebookShell, ReviewLetter, WaxSeal } from '../primitives';
import { draftDiffers } from '../../features/reviews/opinion';
import { useLibrary } from '../../state/useLibrary';
import { modalRoot } from '../panels/modalRoot';
import { PanelShell } from '../panels/PanelShell';
import { Cover, PhysicalBook } from '../shelf/BookItem';
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

/** Progreso: posición y barra; por páginas, con el ajuste rápido de la página actual (la estimación vive en los detalles). */
function ProgressBlock({ book, onPage }) {
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
  const left = Math.max(0, (book.pageCount || 0) - book.currentPage);
  return (
    <div className="sheet-progress">
      <h3 className="sheet-progress__title">Tu lugar en esta historia</h3>
      {/* Valor actual / total en su propia línea; los ajustes rápidos, en una fila equilibrada aparte */}
      <div className="sheet-progress__pages">
        <label className="sheet-progress__current">
          <span className="sheet-progress__label">Página</span>
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
      </div>
      <div className="sheet-progress__steps">
        <button type="button" className="round-btn craft craft--paper" onClick={() => onPage(book.currentPage - 10)} aria-label="Retroceder 10 páginas">
          −10
        </button>
        <button type="button" className="round-btn craft craft--paper" onClick={() => onPage(book.currentPage - 1)} aria-label="Retroceder una página">
          <Minus aria-hidden="true" />
        </button>
        <button type="button" className="round-btn craft craft--paper" onClick={() => onPage(book.currentPage + 1)} aria-label="Avanzar una página">
          <Plus aria-hidden="true" />
        </button>
        <button type="button" className="round-btn craft craft--paper" onClick={() => onPage(book.currentPage + 10)} aria-label="Avanzar 10 páginas">
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
      </p>
      {/* Lo que queda, con los datos reales; terminado, sin cuentas negativas */}
      <p className="sheet-progress__left">{left > 0 ? `Te quedan ${left.toLocaleString('es-ES')} ${left === 1 ? 'página' : 'páginas'}` : '¡Terminado!'}</p>
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
  const left = unit === 'pages' ? hoursLeft(book, pagesPerHour) : 0;
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
        {left > 0 && <p className="edition-note">A este ritmo: ≈ {formatHours(left)} restantes</p>}
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

const TABS = [
  { id: 'left', label: 'Ficha' },
  { id: 'right', label: 'Diario' },
  { id: 'readers', label: 'Lectores' },
];

export function BookDetailModal({ bookId, initialPage, onClose, onSwitch, onOpenProfile, onOpenReader, onComplete }) {
  const { state, actions } = useLibrary();
  const book = state.books.find((b) => b.id === bookId);
  const [page, setPage] = useState(() => (TABS.some((t) => t.id === initialPage) ? initialPage : 'left'));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [review, setReview] = useState(book?.review ?? '');
  const [shownQuote, setShownQuote] = useState(null);
  const [logging, setLogging] = useState(false);
  const [othersOpen, setOthersOpen] = useState(false);
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
      <NotebookShell className="book-sheet" data-page={page} data-edition={book.editionType}>
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
                <PhysicalBook book={book} variant="sheet" />
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
                <button key={k} type="button" role="radio" aria-checked={book.status === k} className="paper-chip craft craft--choice" onClick={() => update({ status: k })}>
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
            {/* Otras lecturas abiertas: una línea con «Ver», que despliega el selector de siempre (toca otro para
                abrirlo en la cama); sin otras lecturas, no se pinta */}
            {book.status === 'reading' && readingNow.length > 1 && onSwitch && (
              <div className="reading-others">
                <span className="reading-others__label">Otras lecturas abiertas</span>
                <button type="button" className="reading-others__toggle" aria-expanded={othersOpen} aria-controls="reading-switch" onClick={() => setOthersOpen((v) => !v)}>
                  {othersOpen ? 'Ocultar' : 'Ver'}
                  <ChevronRight aria-hidden="true" />
                </button>
              </div>
            )}
            {book.status === 'reading' && readingNow.length > 1 && onSwitch && othersOpen && (
              <nav id="reading-switch" className="reading-switch" aria-label="Libros que estás leyendo">
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
              onPage={(p) => {
                actions.setPage(book.id, p);
                if (p > book.currentPage) pageRustle(0.6);
              }}
            />

            {/* El mismo formulario de registro del calendario; si termina el libro, abre la reseña de terminar */}
            <div className="sheet-log">
              <button type="button" className="sheet-btn sheet-btn--primary craft craft--terra" aria-expanded={logging} onClick={() => setLogging((v) => !v)}>
                <Plus aria-hidden="true" />
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
            <SheetSprig />
            <h3 className="sheet-title">Mi diario de lectura</h3>
            <p className="sheet-private">
              <Lock aria-hidden="true" /> Solo para ti
            </p>
            <Journal book={book} log={state.progress.readingLog} meanings={settings.quoteMeanings} onShow={setShownQuote} />
            <h3 className="sheet-title sheet-title--review" id="my-review-title">
              <SheetSprig />
              Mi reseña
            </h3>
            <p className="sheet-subtitle">Tu impresión de esta historia.</p>
            <ReviewLetter className="my-review" clip={false} aria-labelledby="my-review-title">
              <BinderClip />
              <div className="my-review__rating">
                <RatingInput value={book.rating} onChange={(rating) => update({ rating })} />
              </div>
              <textarea
                className="review"
                value={review}
                onChange={(e) => setReview(e.target.value)}
                onBlur={() => review !== book.review && update({ review })}
                placeholder="Lo que sentí al leerlo…"
                aria-label="Tu reseña"
                rows={5}
              />
              <p className="my-review__signature">
                <Feather aria-hidden="true" />
                {settings.owner || 'Lectora'}
              </p>
            </ReviewLetter>
            <ReviewState book={book} draft={review} />
            <PublishControls book={book} onUpdate={update} onOpenProfile={onOpenProfile} />
            <p className="my-review__note" aria-hidden="true">
              Tu reseña, con tu propia voz.
              <WaxSeal size={36} className="my-review__seal" />
            </p>
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
      </NotebookShell>
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

/** Ramita botánica en la esquina de los títulos del cuaderno (recurso ilustrado, decoración). */
function SheetSprig() {
  return <img className="sheet-sprig" src="/assets/bookshelf/notebook/botanical-sprig.webp" alt="" width="160" height="249" aria-hidden="true" />;
}

/** Pinza de latón ilustrada que sujeta la carta de la reseña (decoración, no intercepta toques). */
function BinderClip() {
  return <img className="binder-clip" src="/assets/bookshelf/notebook/brass-paper-clip.webp" alt="" width="160" height="128" aria-hidden="true" />;
}

/**
 * Estado inequívoco de la reseña (SPEC §28.8): privada, cambios sin publicar o publicada. Se deriva de los datos
 * reales (la copia pública guardada) y nunca cambia la visibilidad por sí sola.
 */
function ReviewState({ book, draft }) {
  const pub = book.publicReview;
  const published = pub?.status === 'published';
  const changed = published && draftDiffers({ ...book, review: draft });
  const saved = draft === book.review;
  const label = !published ? 'Privada · solo la ves tú' : changed ? 'Publicada · con cambios sin publicar' : 'Publicada · al día';
  return (
    <p className="review-state" data-state={!published ? 'private' : changed ? 'draft' : 'published'} role="status">
      {published && !changed ? <WaxSeal size={28} /> : <Lock aria-hidden="true" />}
      <span>{label}</span>
      <small>{saved ? 'Guardada en este dispositivo' : 'Guardando…'}</small>
    </p>
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
