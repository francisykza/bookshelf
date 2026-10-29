// Ficha del libro (SPEC §27.6–27.8, §28.5–28.8): un cuaderno de una página con tres pestañas. Ficha: ex-libris compacto,
// portada y título, estado, progreso, «Registrar lectura», valoración y favorito, y los detalles de la edición
// plegados. Diario (1.53, SPEC §51): «Mi diario» con tres secciones independientes —Reseña (valoración y opinión, con
// guardado explícito y borrador por libro), Notas (las anotaciones) e Historial (las sesiones del registro)—.
// Lectores: las opiniones de la comunidad. Solo presentación: los datos y operaciones son los de siempre.
import { BookMarked, ChevronDown, ChevronRight, Heart, Lock, Minus, PenLine, Plus, Trash2, X } from 'lucide-react';
import { Suspense, lazy, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { pageRustle } from '../../audio/ambientAudio';
import { playUiSound } from '../../audio/uiSounds';
import { EDGE_NAMES, FORMATS, STATUS, audioHours, formatHours, formatPercent, hoursLeft, percentRead, progress, sprayedEdge, trackUnit } from '../../domain/books';
import { dayKey } from '../../domain/dates';
import { ReadingEntryForm } from '../panels/ReadingEntryForm';
import { RatingInput } from './Rating';
import { Journal, useConfirmedSave } from './Annotations';
import { NotebookShell, WaxSeal } from '../primitives';
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

/** Secciones de «Mi diario». Los accesos directos abren la suya: `tab` «notes» o «history»; «right» abre la reseña. */
const SECTIONS = [
  { id: 'review', label: 'Reseña' },
  { id: 'notes', label: 'Notas' },
  { id: 'history', label: 'Historial' },
];
const DIARY_ENTRY = { right: 'review', review: 'review', notes: 'notes', history: 'history' };

export function BookDetailModal({ bookId, initialPage, onClose, onSwitch, onOpenProfile, onOpenReader, onComplete }) {
  const { state, actions } = useLibrary();
  const book = state.books.find((b) => b.id === bookId);
  const [page, setPage] = useState(() => (DIARY_ENTRY[initialPage] ? 'right' : TABS.some((t) => t.id === initialPage) ? initialPage : 'left'));
  const [section, setSection] = useState(() => DIARY_ENTRY[initialPage] ?? 'review');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [shownQuote, setShownQuote] = useState(null);
  const [logging, setLogging] = useState(false);
  const [othersOpen, setOthersOpen] = useState(false);
  const scrollRef = useRef(null);
  const uid = useId();

  useEffect(() => {
    playUiSound('bookOpen');
  }, []);

  // Teclado del móvil: la hoja se ajusta a la parte visible del visor (el visor visual encoge; el de diseño, no), así
  // el campo activo y «Guardar reseña» no quedan debajo del teclado
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;
    const root = document.documentElement.style;
    const fit = () => {
      const covered = window.innerHeight - vv.height > 80;
      if (covered) {
        root.setProperty('--sheet-vv-h', `${Math.round(vv.height)}px`);
        root.setProperty('--sheet-vv-top', `${Math.round(vv.offsetTop)}px`);
      } else {
        root.removeProperty('--sheet-vv-h');
        root.removeProperty('--sheet-vv-top');
      }
      const el = document.activeElement;
      if (covered && el instanceof HTMLElement && el.matches('.book-sheet textarea, .book-sheet input')) requestAnimationFrame(() => el.scrollIntoView({ block: 'nearest' }));
    };
    vv.addEventListener('resize', fit);
    vv.addEventListener('scroll', fit);
    return () => {
      vv.removeEventListener('resize', fit);
      vv.removeEventListener('scroll', fit);
      root.removeProperty('--sheet-vv-h');
      root.removeProperty('--sheet-vv-top');
    };
  }, []);

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
  const goSection = (id) => {
    if (id !== section) playUiSound('diaryTab');
    setSection(id);
    scrollRef.current?.scrollTo({ top: 0 });
  };
  const reviewPublished = book.publicReview?.status === 'published';

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

          <section className="sheet-page sheet-page--journal" aria-label="Mi diario" hidden={page !== 'right'}>
            <header className="diary-head">
              <h3 className="sheet-title">Mi diario</h3>
              <p className="sheet-private">
                <Lock aria-hidden="true" /> {reviewPublished ? 'Solo para ti, salvo tu reseña publicada' : 'Solo para ti'}
              </p>
              <SheetSprig />
            </header>
            <div className="diary-sections" role="tablist" aria-label="Secciones del diario">
              {SECTIONS.map((t, i) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  id={`${uid}-tab-${t.id}`}
                  aria-controls={`${uid}-panel-${t.id}`}
                  aria-selected={section === t.id}
                  tabIndex={section === t.id ? 0 : -1}
                  onClick={() => goSection(t.id)}
                  onKeyDown={(e) => {
                    const dir = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
                    if (!dir) return;
                    e.preventDefault();
                    const next = (i + dir + SECTIONS.length) % SECTIONS.length;
                    goSection(SECTIONS[next].id);
                    e.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next]?.focus();
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {/* Las tres secciones siguen montadas: el borrador de la reseña o de una nota no se pierde al cambiar */}
            <div className="diary-panel" role="tabpanel" id={`${uid}-panel-review`} aria-labelledby={`${uid}-tab-review`} hidden={section !== 'review'}>
              <MyReview book={book} owner={settings.owner} onUpdate={update} onOpenProfile={onOpenProfile} onBack={() => goTo('left')} />
            </div>
            <div className="diary-panel" role="tabpanel" id={`${uid}-panel-notes`} aria-labelledby={`${uid}-tab-notes`} hidden={section !== 'notes'}>
              <Journal book={book} log={state.progress.readingLog} meanings={settings.quoteMeanings} onShow={setShownQuote} mode="notes" />
            </div>
            <div className="diary-panel" role="tabpanel" id={`${uid}-panel-history`} aria-labelledby={`${uid}-tab-history`} hidden={section !== 'history'}>
              <Journal book={book} log={state.progress.readingLog} meanings={settings.quoteMeanings} mode="history" />
            </div>
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


/**
 * Estado inequívoco de la reseña (SPEC §28.8): privada, cambios sin publicar o publicada. Se deriva de los datos
 * reales (la copia pública guardada) y nunca cambia la visibilidad por sí sola.
 */
function ReviewState({ book, draft }) {
  const pub = book.publicReview;
  const published = pub?.status === 'published';
  const changed = published && draftDiffers({ ...book, review: draft });
  const label = !published ? 'Privada · solo la ves tú' : changed ? 'Publicada · con cambios sin publicar' : 'Publicada · al día';
  return (
    <p className="review-state" data-state={!published ? 'private' : changed ? 'draft' : 'published'}>
      {published && !changed ? <WaxSeal size={28} /> : <Lock aria-hidden="true" />}
      <span>{label}</span>
    </p>
  );
}

// Borrador de la reseña por libro (sessionStorage, como las notas): sobrevive a cambiar de sección, cerrar la ficha o
// recargar, y se descarta solo cuando el guardado se confirma
const reviewDraftKey = (bookId) => `bookshelf:review-draft:${bookId}`;
function readReviewDraft(bookId) {
  try {
    return sessionStorage.getItem(reviewDraftKey(bookId));
  } catch {
    return null;
  }
}
function writeReviewDraft(bookId, text) {
  try {
    if (text == null) sessionStorage.removeItem(reviewDraftKey(bookId));
    else sessionStorage.setItem(reviewDraftKey(bookId), text);
  } catch {
    // sin almacenamiento de sesión: el borrador vive mientras la ficha siga abierta
  }
}

/**
 * «Mi reseña» (SPEC §51): valoración (la misma de la Ficha; se guarda al tocarla) y opinión con «Guardar reseña».
 * Guardar escribe en el dispositivo y lo confirma; nunca publica. Si falla, el texto sigue y se puede reintentar.
 */
function MyReview({ book, owner, onUpdate, onOpenProfile, onBack }) {
  const uid = useId();
  const saved = book.review ?? '';
  const [text, setText] = useState(() => readReviewDraft(book.id) ?? saved);
  const base = useRef(saved);
  const fieldRef = useRef(null);
  const saving = useConfirmedSave((t) => (book.review ?? '') === t);
  const dirty = text !== saved;

  // La reseña guardada cambia por otra vía (la nube, la reseña al terminar): si el campo no se ha tocado, se adopta;
  // si hay un borrador, se respeta
  useEffect(() => {
    if (saved === base.current) return;
    setText((t) => (t === base.current ? saved : t));
    base.current = saved;
  }, [saved]);
  useEffect(() => {
    writeReviewDraft(book.id, dirty || saving.status === 'error' ? text : null);
  }, [book.id, text, dirty, saving.status]);
  // El campo crece con el texto: un solo desplazamiento, el de la hoja
  useEffect(() => {
    const el = fieldRef.current;
    if (!el || !el.offsetParent) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  });

  const submit = () => {
    if (saving.status === 'saving') return;
    // Sin cambios: solo se confirma que lo guardado está escrito en el dispositivo (no se duplica nada)
    if (!dirty) return saving.retry();
    const value = text;
    saving.save(
      () => onUpdate({ review: value }),
      value,
      () => {
        base.current = value;
        writeReviewDraft(book.id, null);
        playUiSound('noteSave');
      },
    );
  };
  // Firma con el nombre del ex-libris; el valor de fábrica («Lectora») no es un nombre y no se firma con él
  const name = owner?.trim() && owner.trim() !== 'Lectora' ? owner.trim() : '';

  return (
    <div className="my-review-page" role="group" aria-labelledby={`${uid}-title`}>
      <h4 className="my-review-page__title" id={`${uid}-title`}>
        Mi reseña
      </h4>
      <p className="my-review-page__lead">Lo que esta historia te está dejando.</p>
      <p className="my-review-page__hint">Puedes escribirla mientras lees.</p>
      <div className="diary-sheet">
        <h5 className="diary-sheet__label" id={`${uid}-rating`}>
          Tu valoración
        </h5>
        <RatingInput variant="sheet" labelledBy={`${uid}-rating`} value={book.rating} onChange={(rating) => onUpdate({ rating })} />
        <textarea
          ref={fieldRef}
          className="diary-sheet__field"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (saving.status === 'saved') saving.setStatus('idle');
          }}
          placeholder="¿Qué te está haciendo sentir este libro?"
          aria-label="Tu reseña"
          rows={6}
        />
        <p className="diary-sheet__sign">
          {name && <span className="diary-sheet__name">— {name}</span>}
          <img className="diary-sheet__sprig" src="/assets/bookshelf/notebook/botanical-sprig.webp" alt="" width="160" height="249" aria-hidden="true" />
        </p>
      </div>
      <ReviewState book={book} draft={text} />
      <button type="button" className="sheet-btn sheet-btn--primary craft craft--terra review-save" disabled={saving.status === 'saving'} aria-busy={saving.status === 'saving' || undefined} aria-describedby={`${uid}-status`} onClick={submit}>
        {saving.status === 'saving' ? 'Guardando…' : 'Guardar reseña'}
      </button>
      <p id={`${uid}-status`} className="review-save__status" data-status={saving.status} role={saving.status === 'error' ? 'alert' : 'status'}>
        {saving.status === 'error' ? (
          <>
            No se ha podido guardar en este dispositivo. Tu texto sigue aquí.{' '}
            <button type="button" className="link-btn" onClick={saving.retry}>
              Reintentar
            </button>
          </>
        ) : saving.status === 'saved' && !dirty ? (
          'Reseña guardada en este dispositivo'
        ) : dirty ? (
          'Cambios sin guardar'
        ) : null}
      </p>
      <PublishControls book={book} onUpdate={onUpdate} onOpenProfile={onOpenProfile} unsaved={dirty} />
      <button type="button" className="link-btn review-back" onClick={onBack}>
        Volver a la ficha
      </button>
    </div>
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
