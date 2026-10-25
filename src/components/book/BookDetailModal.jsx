// Apertura del libro en 3D (SPEC §5.4): la cubierta gira y revela dos páginas de papel crema.
// Izquierda: ex-libris, progreso con % y horas restantes, estrellas, estado, formato y sinopsis.
// Derecha: diario de lectura con citas subrayadas por color y reseña manuscrita.
import { BookMarked, Feather, Heart, Minus, PenLine, Plus, Trash2, X } from 'lucide-react';
import { Suspense, lazy, useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { pageRustle } from '../../audio/ambientAudio';
import { playUiSound } from '../../audio/uiSounds';
import { EDGE_NAMES, FORMATS, STATUS, audioHours, formatHours, formatPercent, hoursLeft, percentRead, progress, progressLabel, sprayedEdge, trackUnit } from '../../domain/books';
import { dayKey } from '../../domain/dates';
import { ReadingEntryForm } from '../panels/ReadingEntryForm';
import { RatingInput } from './Rating';
import { QuoteMeaningsEditor } from './QuoteMeaningsEditor';
import { COLOR_IDS, meaningOf } from '../../domain/quoteMeanings';
import { useLibrary } from '../../state/useLibrary';
import { modalRoot } from '../panels/modalRoot';
import { PanelShell } from '../panels/PanelShell';
import { Cover, bezel } from '../shelf/BookItem';
import { EdgePicker } from './EditionPicker';
import { ElegantQuoteCard } from '../quotes/ElegantQuoteCard';
import { PublishControls } from '../../features/reviews/PublishControls';

// Las opiniones de la comunidad se cargan solo al abrirlas
const ReadersPanel = lazy(() => import('../../features/reviews/ReadersPanel').then((m) => ({ default: m.ReadersPanel })));

function ExLibris({ owner, onRename }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(owner);
  const id = useId();
  return (
    <div className="ex-libris">
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <defs>
          <path id={`${id}-arc`} d="M18 60 A42 42 0 0 1 102 60" />
        </defs>
        <circle cx="60" cy="60" r="56" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="60" cy="60" r="50" fill="none" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 3" />
        <text className="ex-libris__arc">
          <textPath href={`#${id}-arc`} startOffset="50%" textAnchor="middle">
            EX · LIBRIS
          </textPath>
        </text>
        {/* Velero sobre las olas de la bahía */}
        <path d="M60 44 L60 74 M60 46 L76 70 L60 70 Z M58 50 L46 70 L58 70 Z" fill="currentColor" opacity="0.85" />
        <path d="M40 76 L80 76 L74 82 L46 82 Z" fill="currentColor" />
        <path d="M30 90 q7 -5 14 0 t14 0 t14 0 t14 0 t14 0" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
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

/**
 * Unidad de seguimiento (SPEC §14.5): páginas o porcentaje, con la posición convertida con el total; y el
 * total, que puede ser desconocido (un ebook sin paginación), en cuyo caso solo cabe porcentaje.
 */
function Tracking({ book, onTracking, onTotal }) {
  const unit = trackUnit(book);
  return (
    <div className="tracking">
      <div className="tracking__unit" role="radiogroup" aria-label="Seguir el progreso por">
        <span>Seguir por</span>
        <button type="button" role="radio" aria-checked={unit === 'pages'} disabled={!book.pageCount} onClick={() => onTracking('pages')}>
          Páginas
        </button>
        <button type="button" role="radio" aria-checked={unit === 'percent'} onClick={() => onTracking('percent')}>
          Porcentaje
        </button>
      </div>
      <label className="tracking__total">
        <input type="checkbox" checked={!book.pageCount} onChange={(e) => onTotal(e.target.checked ? null : 300)} />
        <span>Total de páginas desconocido</span>
      </label>
    </div>
  );
}

/** Libro por porcentaje: posición, barra y el mismo formulario de registro del calendario. */
function PercentControls({ book, onTotal }) {
  const pct = percentRead(book);
  return (
    <div className="page-controls">
      <div className="page-controls__stats">
        <strong>{formatPercent(pct)} leído</strong>
        {book.pageCount ? (
          <label className="page-controls__total">
            Total
            <input
              type="number"
              className="ink-input ink-input--num"
              min="1"
              value={book.pageCount}
              onChange={(e) => onTotal(Math.max(1, Number(e.target.value) || 1))}
              aria-label="Total de páginas"
            />
            págs.
          </label>
        ) : (
          <span>Sin paginación: el avance se registra en porcentaje.</span>
        )}
      </div>
      <span className="page-controls__bar" style={{ '--p': `${pct}%` }} aria-hidden="true" />
      <div className="page-controls__log">
        <h3>Actualizar %</h3>
        <ReadingEntryForm date={dayKey()} bookId={book.id} keepOpen />
      </div>
    </div>
  );
}

function PageControls({ book, pagesPerHour, onPage, onTotal, onSpeed }) {
  const pct = progress(book);
  const left = hoursLeft(book, pagesPerHour);
  return (
    <div className="page-controls">
      <div className="page-controls__line">
        <span>Página</span>
        <button type="button" className="round-btn" onClick={() => onPage(book.currentPage - 10)} aria-label="Retroceder 10 páginas">
          −10
        </button>
        <button type="button" className="round-btn" onClick={() => onPage(book.currentPage - 1)} aria-label="Retroceder una página">
          <Minus aria-hidden="true" />
        </button>
        <input
          type="number"
          className="ink-input ink-input--num"
          min="0"
          max={book.pageCount}
          value={book.currentPage}
          onChange={(e) => onPage(Number(e.target.value))}
          aria-label="Página actual"
        />
        <button type="button" className="round-btn" onClick={() => onPage(book.currentPage + 1)} aria-label="Avanzar una página">
          <Plus aria-hidden="true" />
        </button>
        <button type="button" className="round-btn" onClick={() => onPage(book.currentPage + 10)} aria-label="Avanzar 10 páginas">
          +10
        </button>
        <span>de</span>
        <input
          type="number"
          className="ink-input ink-input--num"
          min="1"
          value={book.pageCount}
          onChange={(e) => onTotal(Math.max(1, Number(e.target.value) || 1))}
          aria-label="Total de páginas"
        />
      </div>
      <input
        type="range"
        className="page-range"
        min="0"
        max={book.pageCount}
        value={book.currentPage}
        onChange={(e) => onPage(Number(e.target.value))}
        style={{ '--p': `${pct}%` }}
        aria-label="Progreso de lectura"
      />
      <div className="page-controls__stats">
        <strong>{formatPercent(percentRead(book))} leído</strong>
        <span>
          {left > 0 ? `≈ ${formatHours(left)} restantes a ` : '¡Terminado! Leído a '}
          <input
            type="number"
            className="ink-input ink-input--tiny"
            min="5"
            max="300"
            value={pagesPerHour}
            onChange={(e) => onSpeed(Math.max(5, Math.min(300, Number(e.target.value) || 40)))}
            aria-label="Velocidad de lectura en páginas por hora"
          />{' '}
          págs./h
        </span>
      </div>
    </div>
  );
}

/**
 * Diario de citas (SPEC §17.4): cada color tiene el significado que elija el usuario (para todos sus libros). El
 * filtro recuerda su selección por ID de color, así que renombrar un significado no la pierde.
 */
function Quotes({ book, meanings, onAdd, onRemove, onShow }) {
  const [text, setText] = useState('');
  const [page, setPage] = useState(book.currentPage || '');
  const [color, setColor] = useState('yellow');
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState('');
  const sorted = [...book.quotes].sort((a, b) => (a.page || 0) - (b.page || 0));
  const counts = sorted.reduce((acc, q) => {
    const id = meaningOf(meanings, q.color).id ?? 'unknown';
    acc[id] = (acc[id] ?? 0) + 1;
    return acc;
  }, {});
  const visible = filter === 'all' ? sorted : sorted.filter((q) => (meaningOf(meanings, q.color).id ?? 'unknown') === filter);
  const current = meaningOf(meanings, color);
  return (
    <div className="quotes">
      {sorted.length > 0 && (
        <div className="quote-filter" role="radiogroup" aria-label="Filtrar citas por significado">
          <button type="button" role="radio" aria-checked={filter === 'all'} onClick={() => setFilter('all')}>
            Todas · {sorted.length}
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
      {visible.length ? (
        <ul className="quotes__list">
          {visible.map((q) => {
            const m = meaningOf(meanings, q.color);
            return (
              <li key={q.id} className="quote" style={{ '--marker': m.hex, '--marker-ink': m.ink }}>
                <blockquote>
                  <mark>{q.text}</mark>
                </blockquote>
                <footer>
                  <span>pág. {q.page || '—'}</span>
                  <span className="quote__tag" title={m.description || undefined}>
                    {m.label}
                  </span>
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
      ) : (
        <p className="quotes__empty">{sorted.length ? 'No hay citas con este significado.' : 'Aún no has subrayado nada. Las citas que guardes asomarán como post-its por el borde del libro.'}</p>
      )}
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
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Copia aquí la frase que te ha atrapado…" aria-label="Nueva cita" />
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
          <button type="submit" className="stamp-btn stamp-btn--small" disabled={!text.trim()}>
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

export function BookDetailModal({ bookId, onClose, onSwitch, onOpenProfile, onOpenReader }) {
  const { state, actions } = useLibrary();
  const book = state.books.find((b) => b.id === bookId);
  const [opened, setOpened] = useState(false);
  const [page, setPage] = useState('left');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [review, setReview] = useState(book?.review ?? '');
  const [shownQuote, setShownQuote] = useState(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setOpened(true));
    playUiSound('bookOpen');
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!book) return undefined;
    if (review === book.review) return undefined;
    const id = setTimeout(() => actions.updateBook(book.id, { review }), 600);
    return () => clearTimeout(id);
  }, [review, book, actions]);

  if (!book) return null;
  const { settings } = state;
  const edge = sprayedEdge(book);
  const isMain = settings.currentBookId === book.id;
  const readingNow = state.books.filter((b) => b.status === 'reading');
  const update = (patch) => actions.updateBook(book.id, patch);

  return (
    <PanelShell onClose={onClose} label={`${book.title}, de ${book.author}`} variant="book">
      <div
        className="open-book"
        data-opened={opened}
        data-page={page}
        data-edition={book.editionType}
        data-edge={edge || undefined}
        data-bezel={book.editionType === 'kindle' ? bezel(book) : undefined}
      >
        {/* Los libros que estás leyendo, como lomos con marcapáginas: toca otro para abrirlo en la cama */}
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
        <div className="open-book__ribbons" role="tablist" aria-label="Páginas del libro">
          <button
            type="button"
            role="tab"
            aria-selected={page === 'left'}
            onClick={() => {
              if (page !== 'left') playUiSound('diaryTab');
              setPage('left');
            }}
          >
            Ficha
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={page === 'right'}
            onClick={() => {
              if (page !== 'right') playUiSound('diaryTab');
              setPage('right');
            }}
          >
            Diario
          </button>
          {/* Opiniones de la comunidad (SPEC §25.5): una hoja plana aparte, fuera de la perspectiva del libro */}
          <button
            type="button"
            role="tab"
            data-readers
            aria-selected={page === 'readers'}
            onClick={() => {
              if (page !== 'readers') playUiSound('diaryTab');
              setPage(page === 'readers' ? 'left' : 'readers');
            }}
          >
            Lectores
          </button>
        </div>
        <button type="button" className="open-book__close" onClick={onClose} aria-label="Cerrar el libro">
          <X aria-hidden="true" />
        </button>

        <div className="open-book__spread">
          <span className="open-book__board" aria-hidden="true" />
          {/* Herrajes y cantos de la edición alrededor del libro abierto */}
          {book.editionType === 'leatherbound' &&
            ['tl', 'tr', 'bl', 'br'].map((c) => <span key={c} className="open-book__corner" data-corner={c} aria-hidden="true" />)}
          {edge && (
            <>
              <span className={`open-book__edges edge--${edge}`} data-side="left" aria-hidden="true" />
              <span className={`open-book__edges edge--${edge}`} data-side="right" aria-hidden="true" />
            </>
          )}
          {book.editionType === 'kindle' && (
            <span className="open-book__ereader-bar" aria-hidden="true">
              <span className="ereader__battery" style={{ '--b': '72%' }} />
              <span>{trackUnit(book) === 'percent' ? progressLabel(book) : `${progressLabel(book)} · ${formatPercent(percentRead(book))}`}</span>
            </span>
          )}
          {/* Página izquierda */}
          <span className="washi washi--page-l" aria-hidden="true" />
          <span className="brass-clip brass-clip--page-r" aria-hidden="true" />
          <section className="page page--left" aria-label="Ficha del libro">
            <ExLibris owner={settings.owner} onRename={(owner) => actions.setSettings({ owner })} />
            <header className="page__head">
              <h2>{book.title}</h2>
              <p>
                {book.author}
                {book.publishedDate && <span> · {book.publishedDate.slice(0, 4)}</span>}
              </p>
              {!!book.categories.length && (
                <ul className="chips">
                  {book.categories.slice(0, 4).map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              )}
            </header>

            {trackUnit(book) === 'percent' ? (
              <PercentControls book={book} onTotal={(pageCount) => update({ pageCount })} />
            ) : (
              <PageControls
                book={book}
                pagesPerHour={settings.pagesPerHour}
                onPage={(p) => {
                  actions.setPage(book.id, p);
                  if (p > book.currentPage) pageRustle(0.6);
                }}
                onTotal={(pageCount) => update({ pageCount })}
                onSpeed={(pagesPerHour) => actions.setSettings({ pagesPerHour })}
              />
            )}
            <Tracking book={book} onTracking={(unit) => actions.setTracking(book.id, unit)} onTotal={(pageCount) => update({ pageCount })} />

            <div className="page__row">
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

            <div className="field-group" role="radiogroup" aria-label="Balda">
              {Object.entries(STATUS).map(([k, v]) => (
                <button key={k} type="button" role="radio" aria-checked={book.status === k} className="paper-chip" onClick={() => update({ status: k })}>
                  {v}
                </button>
              ))}
            </div>
            {book.status === 'reading' && (
              <button type="button" className="link-btn" aria-pressed={isMain} onClick={() => actions.setSettings({ currentBookId: book.id })}>
                <BookMarked aria-hidden="true" />
                {isMain ? 'Es el libro abierto sobre tu cama' : 'Dejarlo abierto sobre la cama'}
              </button>
            )}

            <label className="format-select">
              <span>Edición</span>
              <select value={book.editionType} onChange={(e) => update({ editionType: e.target.value })}>
                {Object.entries(FORMATS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            {book.editionType === 'sprayed_edges' && (
              <EdgePicker value={book.sprayedEdgeStyle} onChange={(sprayedEdgeStyle) => update({ sprayedEdgeStyle })} />
            )}
            {book.editionType === 'audiobook' && (
              <label className="format-select">
                <span>Duración</span>
                <input
                  type="number"
                  className="ink-input ink-input--tiny"
                  min="1"
                  max="99"
                  value={audioHours(book)}
                  onChange={(e) => update({ audioHours: Math.max(1, Math.min(99, Number(e.target.value) || 1)) })}
                  aria-label="Duración del audiolibro en horas"
                />
                <span>horas</span>
              </label>
            )}
            <p className="edition-note">{EDITION_NOTES[book.editionType]}{edge === 'gilded' ? ` · cantos en ${EDGE_NAMES.gilded.toLowerCase()}` : ''}</p>

            <div className="synopsis">
              <h3>Sinopsis</h3>
              <p>{book.synopsis || 'Sin sinopsis todavía. Puedes escribir tus primeras impresiones en el diario.'}</p>
            </div>

            <div className="page__foot">
              {confirmDelete ? (
                <span className="confirm-inline">
                  ¿Sacarlo de tu librería?
                  <button type="button" className="link-btn link-btn--danger" onClick={() => { actions.removeBook(book.id); onClose(); }}>
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

          {/* Página derecha */}
          <section className="page page--right" aria-label="Diario de lectura">
            <h3 className="diary-title">Diario de lectura</h3>
            <p className="diary-sub">Citas subrayadas</p>
            <Quotes book={book} meanings={settings.quoteMeanings} onAdd={(q) => actions.addQuote(book.id, q)} onRemove={(qid) => actions.removeQuote(book.id, qid)} onShow={setShownQuote} />
            <h3 className="diary-title diary-title--small">Mis pensamientos</h3>
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
            {book.status === 'read' && <span className="finished-stamp">Leído</span>}
          </section>
        </div>
        {page === 'readers' && (
          <section className="open-book__readers" aria-label="Lectores">
            <h3 className="diary-title">Voces de lectores</h3>
            <Suspense fallback={<p className="social-note">Abriendo…</p>}>
              <ReadersPanel book={book} onUpdate={update} onOpenReader={onOpenReader} />
            </Suspense>
          </section>
        )}

        {/* Cubierta que gira al abrir */}
        <div className="open-book__cover" aria-hidden="true">
          <span className="open-book__cover-front">
            <Cover book={book} />
          </span>
          <span className="open-book__cover-back" />
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
