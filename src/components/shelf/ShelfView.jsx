// `SHELF_VIEW` (SPEC §27.3–27.5): la librería como un mueble modular de madera gouache. Cabecera compacta
// (volver, buscador, pestañas de estado, vista y herramientas), una balda por estado con su tramo de panel y su
// tabla, un único recuerdo destacado tras la primera balda y, como mucho, dos ramas de hiedra detrás de los libros.
import { RatingStars } from '../book/Rating';
import { ArrowLeft, BookOpen, ChevronDown, Library, Plus, Search, Sparkles, Trophy, Wrench, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { pageRustle } from '../../audio/ambientAudio';
import { ratingText, shelfSort } from '../../domain/books';
import { EMPTY_TEXT, filterLibrary, libraryEmptyState } from '../../domain/library';
import { PRESET_SAGAS } from '../../domain/sagas';
import { SCENE_H, SCENE_SRC, SCENE_W } from '../../scene/sceneMap';
import { useCloud } from '../../state/cloudSync';
import { useLibrary } from '../../state/useLibrary';
import { MiniFigurePin } from '../figures/MiniFigurePin';
import { figureForBook, useFigureCatalog } from '../figures/figureCatalog';
import { EditionMenu } from '../book/EditionPicker';
import { BookItem, Cover } from './BookItem';
import { ScrollChevron } from './ScrollChevron';

/** Recorte de la ilustración como fondo CSS que llena el elemento. */
export function cropStyle(region) {
  return {
    backgroundImage: `url(${SCENE_SRC})`,
    backgroundSize: `${(SCENE_W / region.w) * 100}% ${(SCENE_H / region.h) * 100}%`,
    backgroundPosition: `${(region.x / (SCENE_W - region.w)) * 100}% ${(region.y / (SCENE_H - region.h)) * 100}%`,
  };
}

const ROWS = [
  { id: 'reading', label: 'Leyendo ahora', empty: 'Ningún libro abierto: elige uno de Pendientes' },
  { id: 'want', label: 'Pendientes', empty: 'Tu lista de deseos está vacía' },
  { id: 'read', label: 'Terminados', empty: 'Aquí irán los libros terminados' },
];

/** Baldas por estado, cada una en su orden de estantería. */
function groupByStatus(list) {
  const g = { reading: [], want: [], read: [] };
  list.forEach((b) => g[b.status]?.push(b));
  Object.keys(g).forEach((k) => g[k].sort(shelfSort(k)));
  return g;
}

const FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'reading', label: 'Leyendo' },
  { id: 'want', label: 'Pendientes' },
  { id: 'read', label: 'Terminados' },
];

const DIE_DOTS = {
  1: [[20, 20]],
  2: [[12, 12], [28, 28]],
  3: [[12, 12], [20, 20], [28, 28]],
  4: [[12, 12], [28, 12], [12, 28], [28, 28]],
  5: [[12, 12], [28, 12], [20, 20], [12, 28], [28, 28]],
  6: [[12, 11], [28, 11], [12, 20], [28, 20], [12, 29], [28, 29]],
};

const validDate = (iso) => Boolean(iso) && !Number.isNaN(new Date(iso).getTime());
const longDate = (iso) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * Recuerdo destacado (SPEC §27.5): el último libro terminado con fecha fiable, su valoración y la cita solo si
 * la clavó el usuario. Los demás terminados, plegados. Sin nada que recordar no se pinta nada.
 */
function MemoryHighlight({ books, onOpenBook, pinned, onUnpin }) {
  const dated = books.filter((b) => validDate(b.finishedAt)).sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));
  const [last, ...rest] = dated;
  if (!last && !pinned) return null;
  return (
    <aside className="lib-memory" aria-label="Recuerdos">
      <h2 className="lib-memory__title">Recuerdos</h2>
      {last && (
        <button type="button" className="lib-memory__book" onClick={() => onOpenBook(last)} aria-label={`${last.title}, terminado el ${longDate(last.finishedAt)}${last.rating ? `, ${ratingText(last.rating)}` : ''}`}>
          <span className="lib-memory__cover" aria-hidden="true">
            <Cover book={last} />
          </span>
          <span className="lib-memory__text" aria-hidden="true">
            <b>{last.title}</b>
            <small>Terminado el {longDate(last.finishedAt)}</small>
            {last.rating > 0 && <RatingStars value={last.rating} />}
          </span>
        </button>
      )}
      {pinned && (
        <figure className="lib-memory__quote">
          <blockquote>{pinned.text}</blockquote>
          <figcaption>
            {[pinned.author, pinned.work].filter(Boolean).join(' · ')}
            <button type="button" className="lib-memory__unpin" onClick={onUnpin} aria-label="Desclavar la cita de la estantería" title="Desclavar">
              <X aria-hidden="true" />
            </button>
          </figcaption>
        </figure>
      )}
      {rest.length > 0 && (
        <details className="lib-memory__more">
          <summary>Ver más recuerdos · {rest.length}</summary>
          <ul>
            {rest.slice(0, 11).map((b) => (
              <li key={b.id}>
                <button type="button" onClick={() => onOpenBook(b)}>
                  <span>{b.title}</span>
                  <small>{new Date(b.finishedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</small>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </aside>
  );
}

/** Rama de hiedra pintada detrás de los libros; se mece solo mientras se ve. */
function Ivy({ side }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([entry]) => {
      el.dataset.visible = entry.isIntersecting ? 'true' : 'false';
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <span ref={ref} className="lib-ivy" data-side={side} aria-hidden="true" />;
}

function useRowHeight() {
  // Móvil: portada de clamp(96px, 28vw, 140px) de ancho (proporción 0,66); escritorio, según el alto
  const get = () => {
    if (window.innerWidth <= 760) return Math.round(Math.max(96, Math.min(140, window.innerWidth * 0.28)) / 0.66);
    return Math.round(Math.max(150, Math.min(196, window.innerHeight * 0.21)));
  };
  const [h, setH] = useState(get);
  useEffect(() => {
    const onResize = () => setH(get());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return h;
}

/** ¿Queda balda por ver a cada lado? Se recalcula con el scroll y el tamaño, una sola vez por fotograma. */
function useScrollEdges(ref, deps) {
  const [edges, setEdges] = useState({ left: false, right: false });
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let frame = 0;
    const read = () => {
      const overflow = el.scrollWidth > el.clientWidth + 2;
      const left = overflow && el.scrollLeft > 2;
      const right = overflow && el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
      setEdges((e) => (e.left === left && e.right === right ? e : { left, right }));
    };
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(read);
    };
    read();
    el.addEventListener('scroll', measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('scroll', measure);
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return edges;
}

const smooth = () => (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

function ShelfRow({ row, index, books, mode, rowH, onOpenBook, onEdition, onAdd, pins, focused, onPlate, pickedId, onMove, emptyText, ivy }) {
  const scrollerRef = useRef(null);
  const edges = useScrollEdges(scrollerRef, [books, mode, rowH]);
  const page = (dir) => {
    const el = scrollerRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: smooth() });
  };
  const trackRef = useRef(null);
  const [drop, setDrop] = useState(null);

  /** Dónde caería el libro: delante del primer libro cuyo centro queda a la derecha del cursor. */
  const dropTarget = (event) => {
    const track = trackRef.current;
    const nodes = [...track.querySelectorAll(':scope > .book-slot > [data-book-id]')];
    const base = track.getBoundingClientRect().left;
    const before = nodes.find((n) => {
      const r = n.getBoundingClientRect();
      return event.clientX < r.left + r.width / 2;
    });
    const last = before ?? nodes[nodes.length - 1];
    const r = last?.getBoundingClientRect();
    const x = !r ? 12 : before ? r.left - base - 6 : r.right - base + 4;
    return { beforeId: before?.dataset.bookId ?? null, x };
  };

  return (
    <section className="shelf-row" data-row={row.id} data-panel-slice={index % 3} style={{ '--row-h': `${rowH}px` }} aria-label={`${row.label}: ${books.length} libros`}>
      {ivy && <Ivy side={ivy} />}
      <div className="shelf-row__head">
        <button
          type="button"
          className="shelf-row__plate"
          aria-pressed={focused}
          onClick={onPlate}
          title={focused ? 'Volver a ver todas las baldas' : `Ver solo ${row.label.toLowerCase()}`}
        >
          {row.label} <span className="shelf-row__count">{books.length}</span>
        </button>
      </div>
      <div ref={scrollerRef} className="shelf-row__scroller">
        <div
          ref={trackRef}
          className="shelf-row__track"
          data-dropping={drop ? 'true' : undefined}
          onDragOver={(event) => {
            if (!event.dataTransfer.types.includes('application/x-bookshelf')) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            const next = dropTarget(event);
            setDrop((d) => (d && d.beforeId === next.beforeId && Math.abs(d.x - next.x) < 1 ? d : next));
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setDrop(null);
          }}
          onDrop={(event) => {
            const id = event.dataTransfer.getData('application/x-bookshelf');
            event.preventDefault();
            const target = dropTarget(event);
            setDrop(null);
            if (id && id !== target.beforeId) onMove(id, row.id, target.beforeId);
          }}
        >
          {drop && <span className="drop-marker" style={{ left: drop.x }} aria-hidden="true" />}
          {books.map((book) => (
            // Cada libro con, si es de una saga del catálogo, su mini-figura engarzada en el canto de la tabla
            <span key={book.id} className="book-slot">
              <BookItem book={book} mode={mode} rowHeight={rowH} onOpen={onOpenBook} onEdition={onEdition} picked={book.id === pickedId} draggable />
              {pins(book)}
            </span>
          ))}
          {!books.length && <p className="shelf-row__empty">{emptyText ?? row.empty}</p>}
          {onAdd && (
            <button type="button" className="add-slot" onClick={onAdd} style={{ height: Math.round(rowH * 0.82) }}>
              <Plus aria-hidden="true" />
              <span>Añadir libro</span>
            </button>
          )}
        </div>
      </div>
      <ScrollChevron dir="left" available={edges.left} onClick={() => page(-1)} />
      <ScrollChevron dir="right" available={edges.right} onClick={() => page(1)} />
      {/* Tabla de madera en tres cortes: los libros apoyan en su superficie superior */}
      <div className="shelf-row__plank" aria-hidden="true" />
    </section>
  );
}

/** «Herramientas»: las acciones secundarias de la librería, plegadas en una hoja de papel. */
function ToolsMenu({ dieFace, rolling, onRoll, onAskLibrarian, onOpenVault }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const buttonRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => {
      if (!wrapRef.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);
  const pick = (fn) => () => {
    setOpen(false);
    fn();
  };
  return (
    <div ref={wrapRef} className="lib-tools">
      <button ref={buttonRef} type="button" className="lib-btn lib-btn--ghost" aria-expanded={open} aria-controls="lib-tools-list" onClick={() => setOpen((v) => !v)}>
        <Wrench aria-hidden="true" />
        <span>Herramientas</span>
        <ChevronDown aria-hidden="true" className="lib-tools__caret" />
      </button>
      {open && (
        <ul id="lib-tools-list" className="lib-tools__list">
          <li>
            <button type="button" className="shelf-die" data-rolling={rolling} onClick={pick(onRoll)}>
              <svg viewBox="0 0 40 40" aria-hidden="true">
                <rect x="3" y="3" width="34" height="34" rx="8" className="shelf-die__face" />
                {DIE_DOTS[dieFace].map(([cx, cy]) => (
                  <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="3.4" className="shelf-die__dot" />
                ))}
              </svg>
              <span>Libro al azar</span>
            </button>
          </li>
          {onAskLibrarian && (
            <li>
              <button type="button" onClick={pick(onAskLibrarian)}>
                <Sparkles aria-hidden="true" />
                <span>Pedir una recomendación</span>
              </button>
            </li>
          )}
          <li>
            <button type="button" onClick={pick(() => onOpenVault())}>
              <Trophy aria-hidden="true" />
              <span>Vitrina de Figuras</span>
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}

export function ShelfView({ phase = 'room', onTransitionEnd, onBack, onOpenBook, onAddBook, onOpenVault, onAskLibrarian }) {
  // Interactiva solo cuando ya ha entrado; visible (opaca o entrando/saliendo) en cualquier fase salvo «room»
  const open = phase === 'shelf';
  const showing = phase === 'enteringShelf' || phase === 'shelf';
  const { state, actions } = useLibrary();
  const { books, settings, progress } = state;
  const [pick, setPick] = useState(null);
  const [rolling, setRolling] = useState(false);
  const [filter, setFilter] = useState('all');
  // Búsqueda en la biblioteca personal: se conserva al alternar Escaparate/Lomos (no se desmonta nada)
  const [query, setQuery] = useState('');
  const { status: cloudStatus } = useCloud();
  // Menú rápido de edición: clic derecho (o pulsación larga / tecla de menú) sobre un libro
  const [editionMenu, setEditionMenu] = useState(null);
  const rowH = useRowHeight();
  const mode = settings.viewMode;
  const backRef = useRef(null);

  // Al salir se deja lista para la próxima visita desde la habitación: «Todos» y sin búsqueda (el foco al
  // abrir va a «Volver», nunca al buscador)
  useEffect(() => {
    if (open) backRef.current?.focus({ preventScroll: true });
    else {
      setPick(null);
      setEditionMenu(null);
      setFilter('all');
      setQuery('');
    }
  }, [open]);

  // Biblioteca completa por estado (dado, recuerdos) y la misma con la búsqueda aplicada (baldas)
  const grouped = useMemo(() => groupByStatus(books), [books]);
  const found = useMemo(() => groupByStatus(filterLibrary(books, { query })), [books, query]);

  // Libro al azar: entre los pendientes (o, si no hay, entre los que no has terminado)
  const pool = grouped.want.length ? grouped.want : [...grouped.reading, ...grouped.want];
  const pickedBook = books.find((b) => b.id === pick) ?? null;
  const dieFace = pick ? (books.findIndex((b) => b.id === pick) % 6) + 1 : 5;
  // Ruleta: un foco salta de libro en libro, cada vez más despacio, hasta detenerse en el elegido
  const rollTimers = useRef([]);
  useEffect(() => () => rollTimers.current.forEach(clearTimeout), []);
  const roll = () => {
    if (!pool.length || rolling) return;
    const others = pool.filter((b) => b.id !== pick);
    const next = (others.length ? others : pool)[Math.floor(Math.random() * (others.length || pool.length))];
    if (filter !== 'all' && filter !== next.status) setFilter('all');
    if (query) setQuery('');
    setPick(null);
    setRolling(true);
    requestAnimationFrame(() => {
      const nodes = [...document.querySelectorAll('.library [data-book-id]')];
      const target = nodes.find((n) => n.dataset.bookId === next.id);
      const hops = 13;
      const path = [];
      let last = null;
      for (let i = 0; i < hops - 1; i += 1) {
        let node = nodes[Math.floor(Math.random() * nodes.length)];
        if (node === last && nodes.length > 1) node = nodes[(nodes.indexOf(node) + 1) % nodes.length];
        path.push(node);
        last = node;
      }
      if (target) path.push(target);
      let at = 0;
      path.forEach((node, i) => {
        at += 70 + i * i * 4.2;
        rollTimers.current.push(
          setTimeout(() => {
            nodes.forEach((n) => delete n.dataset.scanning);
            node.dataset.scanning = 'true';
            pageRustle(0.25);
          }, at),
        );
      });
      rollTimers.current.push(
        setTimeout(() => {
          nodes.forEach((n) => delete n.dataset.scanning);
          setPick(next.id);
          setRolling(false);
          target?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }, at + 380),
      );
    });
  };

  const visibleRows = filter === 'all' ? ROWS : ROWS.filter((r) => r.id === filter);
  const shownCount = visibleRows.reduce((n, r) => n + found[r.id].length, 0);
  // Ningún estado vacío mientras la cuenta trae la biblioteca de la nube
  const empty = libraryEmptyState({ total: books.length, shown: shownCount, status: filter, query, loading: cloudStatus === 'loading' && books.length === 0 });
  const rowEmpty = empty === 'loading' ? EMPTY_TEXT.loading : query ? EMPTY_TEXT.search : filter !== 'all' ? EMPTY_TEXT.filter : undefined;

  // Mini-figuras de saga bajo los libros, y los libros de cada saga para la sinergia ×2 de pity
  const figCatalog = useFigureCatalog();
  const figs = progress.figures;
  // Sagas explícitas (las preconfiguradas y las tuyas) para vincular cada libro con su figura
  const sagas = useMemo(() => [...PRESET_SAGAS, ...(settings.customSagas ?? [])], [settings.customSagas]);
  const pins = (book) => {
    const fig = figureForBook(figCatalog, book, sagas);
    return fig ? <MiniFigurePin fig={fig} owned={Boolean(figs?.owned[fig.id])} onOpen={onOpenVault} /> : null;
  };
  useEffect(() => {
    if (!figCatalog.length || !figs) return;
    const map = {};
    books.forEach((b) => {
      const fig = figureForBook(figCatalog, b, sagas);
      if (fig && figs.owned[fig.id]) (map[fig.id] ??= []).push(b.id);
    });
    if (JSON.stringify(map) !== JSON.stringify(figs.placements ?? {})) actions.syncFigureBooks(map);
  }, [figCatalog, books, figs, actions, sagas]);

  const memory = <MemoryHighlight books={grouped.read} onOpenBook={onOpenBook} pinned={settings.pinnedQuote} onUnpin={() => actions.setSettings({ pinnedQuote: null })} />;

  return (
    <div className="library" data-open={showing} data-phase={phase} aria-hidden={!open} inert={!open ? true : undefined} onTransitionEnd={onTransitionEnd}>
      <div className="library__case">
        <header className="lib-head">
          <div className="lib-head__row lib-head__row--title">
            <button ref={backRef} type="button" className="lib-btn lib-btn--back" onClick={onBack} aria-label="Volver a la cama">
              <ArrowLeft aria-hidden="true" />
              <span>Volver</span>
            </button>
            <h1 className="library__title">
              <span>La biblioteca junto al mar</span>
              <small>de {settings.owner}</small>
            </h1>
          </div>
          <div className="lib-head__row lib-head__row--search">
            {/* Ficha de búsqueda en la biblioteca personal (sin Google Books ni Open Library) */}
            <div className="shelf-search" role="search">
              <label className="shelf-search__label" htmlFor="shelf-search-input">
                <Search aria-hidden="true" />
                <span className="sr-only-focus">Buscar en mi biblioteca</span>
              </label>
              <input
                key="shelf-search"
                id="shelf-search-input"
                className="shelf-search__input"
                type="search"
                enterKeyHint="search"
                autoComplete="off"
                aria-label="Buscar en mi biblioteca"
                placeholder="Título o autor…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button type="button" className="shelf-search__clear" onClick={() => setQuery('')} aria-label="Limpiar búsqueda" title="Limpiar búsqueda">
                  <X aria-hidden="true" />
                </button>
              )}
            </div>
            <button type="button" className="lib-btn lib-btn--accent" onClick={onAddBook}>
              <Plus aria-hidden="true" />
              <span>Añadir libro</span>
            </button>
          </div>
          {/* Pestañas de papel: qué baldas ver */}
          <div className="lib-tabs" role="radiogroup" aria-label="Qué baldas ver">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" role="radio" aria-checked={filter === f.id} className="lib-tab" data-status={f.id} onClick={() => setFilter(f.id)}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="lib-head__row lib-head__row--tools">
            <div className="lib-toggle" role="radiogroup" aria-label="Vista de la librería">
              <button type="button" role="radio" aria-checked={mode === 'cover'} aria-label="Escaparate" onClick={() => actions.setSettings({ viewMode: 'cover' })}>
                <BookOpen aria-hidden="true" />
                <span>Escaparate</span>
              </button>
              <button type="button" role="radio" aria-checked={mode === 'spine'} aria-label="Lomos" onClick={() => actions.setSettings({ viewMode: 'spine' })}>
                <Library aria-hidden="true" />
                <span>Lomos</span>
              </button>
            </div>
            <ToolsMenu dieFace={dieFace} rolling={rolling} onRoll={roll} onAskLibrarian={onAskLibrarian} onOpenVault={onOpenVault} />
          </div>
        </header>

        {pickedBook && !rolling && (
          <div className="pick-note" role="status">
            <button type="button" className="icon-btn icon-btn--tiny" onClick={() => setPick(null)} aria-label="Descartar la propuesta">
              <X aria-hidden="true" />
            </button>
            <span className="pick-note__lead">El dado ha hablado…</span>
            <strong>¿Y si lees «{pickedBook.title}»?</strong>
            <span className="pick-note__meta">
              {pickedBook.author} · {pickedBook.pageCount ? `${pickedBook.pageCount} págs.` : 'sin paginación'}
            </span>
            <div className="pick-note__actions">
              <button type="button" className="stamp-btn stamp-btn--small" onClick={() => onOpenBook(pickedBook)}>
                <BookOpen aria-hidden="true" /> Abrirlo
              </button>
              <button type="button" className="link-btn" onClick={roll}>
                Tirar otra vez
              </button>
            </div>
          </div>
        )}

        {editionMenu && books.some((b) => b.id === editionMenu.id) && (
          <EditionMenu
            book={books.find((b) => b.id === editionMenu.id)}
            x={editionMenu.x}
            y={editionMenu.y}
            onChange={(patch) => {
              actions.updateBook(editionMenu.id, patch);
              pageRustle(0.35);
            }}
            onClose={() => {
              editionMenu.from?.focus?.({ preventScroll: true });
              setEditionMenu(null);
            }}
          />
        )}

        <div className="library__shelves">
          {empty && (
            <p className="library__empty" role="status">
              {EMPTY_TEXT[empty]}
            </p>
          )}
          {visibleRows.map((row, i) => (
            <div key={row.id} className="library__module">
              <ShelfRow
                row={row}
                index={i}
                books={found[row.id]}
                emptyText={rowEmpty}
                mode={mode}
                rowH={rowH}
                focused={filter === row.id}
                onPlate={() => setFilter((f) => (f === row.id ? 'all' : row.id))}
                onOpenBook={onOpenBook}
                onEdition={(book, event) => {
                  // Con teclado (tecla de menú) no hay coordenadas: se abre junto al libro
                  const r = event.currentTarget.getBoundingClientRect();
                  const fromKey = event.clientX === 0 && event.clientY === 0;
                  setEditionMenu({ id: book.id, x: fromKey ? r.right + 6 : event.clientX + 4, y: fromKey ? r.top : event.clientY + 4, from: event.currentTarget });
                }}
                onAdd={row.id === 'want' ? onAddBook : null}
                pickedId={pick}
                onMove={actions.moveBook}
                pins={pins}
                ivy={i === 0 ? 'right' : i === visibleRows.length - 1 && i > 0 ? 'left' : null}
              />
              {i === 0 && memory}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
