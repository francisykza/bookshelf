// `SHELF_VIEW` (SPEC §27.3–27.5, §28.4, §35): la librería como un mueble de madera gouache. Cabecera compacta
// (volver, título, buscador, «Añadir libro», «Vista y herramientas» y filtros), una balda por estado con los libros
// de tres en tres en móvil y su encabezado ligero, y el tablón de recuerdos plegable al final.
import { ArrowLeft, Book, BookOpen, ChevronDown, CircleCheck, Hourglass, Library, Plus, Search, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { SectionIcon } from '../SectionIcon';
import { WaxSeal } from '../primitives';
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
  { id: 'reading', label: 'Leyendo', empty: 'Ningún libro abierto: elige uno de Pendientes' },
  { id: 'want', label: 'Pendientes', empty: 'Tu lista de deseos está vacía' },
  { id: 'read', label: 'Leídos', empty: 'Aquí irán los libros terminados' },
  // 1.47 (SPEC §43): en «Todos» solo aparece si tiene algún libro
  { id: 'abandoned', label: 'Abandonados', empty: 'No has dejado ningún libro a medias' },
];

/** Baldas por estado, cada una en su orden de estantería. */
function groupByStatus(list) {
  const g = { reading: [], want: [], read: [], abandoned: [] };
  list.forEach((b) => g[b.status]?.push(b));
  Object.keys(g).forEach((k) => g[k].sort(shelfSort(k)));
  return g;
}

/** Fila textil de la cabecera (SPEC §44): cada etiqueta con su tela, su icono y su nombre como texto real. */
const FILTERS = [
  { id: 'all', label: 'Todos', cloth: 'marfil' },
  { id: 'reading', label: 'Leyendo', cloth: 'terracota' },
  { id: 'want', label: 'Pendientes', cloth: 'crema' },
  { id: 'read', label: 'Leídos', cloth: 'salvia' },
  { id: 'abandoned', label: 'Abandonados', cloth: 'malva' },
];
const FILTER_ICON = { all: Sprig, reading: BookOpen, want: Hourglass, read: CircleCheck, abandoned: Book };

/** Ramita del hueco «Añadir un libro». */
function Sprig(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" {...props}>
      <path d="M4 20C9 15 14 10 20 4" />
      <path d="M8 16c-2 0-3-1-4-3M11 13c0-2 1-4 3-5M12 12c-2 0-4-1-5-3M15 9c1-2 2-3 4-3" />
    </svg>
  );
}

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
const shortDate = (iso) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

const FOLD_KEY = 'bookshelf:memories-folded';
const readFolded = () => {
  try {
    return localStorage.getItem(FOLD_KEY) === 'true';
  } catch {
    return false;
  }
};

/**
 * Tablón de recuerdos (SPEC §27.5, §28.4): dentro del mueble, una nota con el último libro terminado con fecha
 * fiable, la postal de la cita solo si la clavó el usuario y «Ver más recuerdos». Se pliega (recordado en este
 * dispositivo) para dejar sitio a los libros. Sin nada que recordar no se pinta nada.
 */
function MemoryBoard({ books, onOpenBook, pinned, onUnpin }) {
  const [folded, setFolded] = useState(readFolded);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const dated = books.filter((b) => validDate(b.finishedAt)).sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));
  const [last, ...rest] = dated;
  if (!last && !pinned) return null;
  const toggle = () => {
    const next = !folded;
    setFolded(next);
    try {
      localStorage.setItem(FOLD_KEY, String(next));
    } catch {
      // sin almacenamiento: se pliega solo en esta visita
    }
  };
  return (
    <aside className="keepsake-board" aria-label="Recuerdos" data-folded={folded}>
      {/* Etiqueta de papel a la izquierda: pliega y despliega la franja */}
      <h2 className="keepsake-board__tag">
        <button type="button" className="keepsake-board__toggle" aria-expanded={!folded} aria-controls="keepsake-board-pins" onClick={toggle}>
          <span>Recuerdos</span>
          <ChevronDown aria-hidden="true" />
          <span className="sr-only-focus">{folded ? 'Mostrar' : 'Plegar'}</span>
        </button>
        {!folded && rest.length > 0 && (
          <button type="button" className="keepsake-board__more-btn" aria-expanded={moreOpen} aria-controls="keepsake-more" onClick={() => setMoreOpen((v) => !v)}>
            Ver más · {rest.length}
          </button>
        )}
      </h2>
      {!folded && (
        <div id="keepsake-board-pins" className="keepsake-board__pins">
          {/* Papel central: la cita clavada por el usuario con su sello; si no hay, el último libro terminado */}
          <div className="keepsake-paper">
            {pinned ? (
              <figure className="keepsake-postcard" data-open={quoteOpen || undefined}>
                <button type="button" className="keepsake-postcard__quote" aria-expanded={quoteOpen} onClick={() => setQuoteOpen((v) => !v)}>
                  <blockquote>{pinned.text}</blockquote>
                </button>
                <figcaption>
                  <span>{[pinned.author, pinned.work].filter(Boolean).join(' · ')}</span>
                  <button type="button" className="keepsake-postcard__unpin" onClick={onUnpin} aria-label="Desclavar la cita de la estantería" title="Desclavar">
                    <X aria-hidden="true" />
                  </button>
                </figcaption>
              </figure>
            ) : (
              <p className="keepsake-paper__note">
                Tu último libro terminado:
                <b>{last.title}</b>
              </p>
            )}
            <WaxSeal className="keepsake-paper__seal" size={26} />
          </div>
          {/* Fotografía: la portada del último libro terminado, con su fecha */}
          {last && (
            <button type="button" className="keepsake-photo keepsake-note" onClick={() => onOpenBook(last)} aria-label={`${last.title}, terminado el ${longDate(last.finishedAt)}${last.rating ? `, ${ratingText(last.rating)}` : ''}`}>
              <span className="keepsake-photo__img" aria-hidden="true">
                <Cover book={last} />
              </span>
              <span className="keepsake-photo__caption" aria-hidden="true">
                <small>{shortDate(last.finishedAt)}</small>
              </span>
            </button>
          )}
        </div>
      )}
      {!folded && moreOpen && rest.length > 0 && (
        <ul id="keepsake-more" className="keepsake-board__list">
          {rest.slice(0, 11).map((b) => (
            <li key={b.id}>
              <button type="button" onClick={() => onOpenBook(b)}>
                <span>{b.title}</span>
                <small>{new Date(b.finishedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</small>
              </button>
            </li>
          ))}
        </ul>
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
  // Móvil (SPEC §30.7): tres libros completos en el hueco útil del módulo. Ancho interior = ancho − laterales del
  // módulo (212 px del recurso × escala, la de library-module.css) − relleno y dos separaciones (40 px); cada hueco
  // resta ≈ 6 px de canto y la portada mide ≈ 0,7 × alto. Escritorio, según el alto de la ventana.
  const get = () => {
    const vw = window.innerWidth;
    if (vw <= 760) {
      const scale = vw >= 600 ? 0.32 : vw >= 420 ? 0.26 : 0.235;
      const slot = (vw - 212 * scale - 40) / 3 - 6;
      return Math.round(Math.max(110, Math.min(200, slot / 0.7)));
    }
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

/** Escaparate (SPEC §35.1): los libros de tres en tres (móvil), cada fila sobre su balda; sin carrusel ni recortes. */
function CoverShelves({ books, cols, onOpenBook, onEdition, pins, pickedId, onAdd, emptyText, trackRef, dropProps, drop }) {
  const cells = [...books.map((book) => ({ book })), ...(onAdd ? [{ add: true }] : [])];
  const lines = [];
  for (let i = 0; i < cells.length; i += cols) lines.push(cells.slice(i, i + cols));
  return (
    <div ref={trackRef} className="lib-shelves" data-dropping={drop ? 'true' : undefined} style={{ '--cols': cols }} {...dropProps}>
      {drop && <span className="drop-marker" style={{ left: drop.x, top: drop.y }} aria-hidden="true" />}
      {!books.length && <p className="shelf-row__empty">{emptyText}</p>}
      {lines.map((line, li) => (
        <div key={li} className="lib-shelf">
          <div className="lib-shelf__books">
            {line.map((cell) =>
              cell.add ? (
                <span key="add" className="book-slot book-slot--add">
                  <button type="button" className="add-slot" onClick={onAdd}>
                    <Plus aria-hidden="true" />
                    <span>Añadir un libro</span>
                    <Sprig aria-hidden="true" className="add-slot__sprig" />
                  </button>
                </span>
              ) : (
                <span key={cell.book.id} className="book-slot">
                  <BookItem book={cell.book} mode="cover" rowHeight={0} onOpen={onOpenBook} onEdition={onEdition} picked={cell.book.id === pickedId} draggable />
                  {pins(cell.book)}
                </span>
              ),
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ShelfRow({ row, index, books, mode, rowH, cols, onOpenBook, onEdition, onAdd, pins, focused, onPlate, pickedId, onMove, emptyText, ivy }) {
  const scrollerRef = useRef(null);
  const edges = useScrollEdges(scrollerRef, [books, mode, rowH]);
  const page = (dir) => {
    const el = scrollerRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: smooth() });
  };
  const trackRef = useRef(null);
  const [drop, setDrop] = useState(null);

  /** Dónde caería el libro: delante del primer libro (en orden de lectura) que queda tras el cursor. */
  const dropTarget = (event) => {
    const track = trackRef.current;
    const nodes = [...track.querySelectorAll('.book-slot > [data-book-id]')];
    const base = track.getBoundingClientRect();
    const before = nodes.find((n) => {
      const r = n.getBoundingClientRect();
      return event.clientY < r.top || (event.clientY <= r.bottom && event.clientX < r.left + r.width / 2);
    });
    const last = before ?? nodes[nodes.length - 1];
    const r = last?.getBoundingClientRect();
    const x = !r ? 12 : before ? r.left - base.left - 6 : r.right - base.left + 4;
    const y = r ? r.top - base.top : 0;
    return { beforeId: before?.dataset.bookId ?? null, x, y };
  };
  const dropProps = {
    onDragOver: (event) => {
      if (!event.dataTransfer.types.includes('application/x-bookshelf')) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      const next = dropTarget(event);
      setDrop((d) => (d && d.beforeId === next.beforeId && Math.abs(d.x - next.x) < 1 && d.y === next.y ? d : next));
    },
    onDragLeave: (event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setDrop(null);
    },
    onDrop: (event) => {
      const id = event.dataTransfer.getData('application/x-bookshelf');
      event.preventDefault();
      const target = dropTarget(event);
      setDrop(null);
      if (id && id !== target.beforeId) onMove(id, row.id, target.beforeId);
    },
  };

  return (
    <section className="shelf-row" data-row={row.id} data-panel-slice={index % 3} style={{ '--row-h': `${rowH}px` }} aria-label={`${row.label}: ${books.length} libros`}>
      {/* Hiedra solo en la vista de lomos: el escaparate deja la madera limpia */}
      {ivy && mode !== 'cover' && <Ivy side={ivy} />}
      <span className="shelf-row__side shelf-row__side--left" aria-hidden="true" />
      <span className="shelf-row__side shelf-row__side--right" aria-hidden="true" />
      {/* Encabezado ligero del grupo con su cantidad real; pulsarlo deja solo esa balda (o vuelve a todas) */}
      <h2 className="shelf-row__head">
        <button type="button" className="shelf-row__title" aria-pressed={focused} onClick={onPlate} title={focused ? 'Volver a ver todas las baldas' : `Ver solo ${row.label.toLowerCase()}`}>
          {row.label} <span className="shelf-row__count">· {books.length}</span>
        </button>
      </h2>
      {mode === 'cover' ? (
        <CoverShelves books={books} cols={cols} onOpenBook={onOpenBook} onEdition={onEdition} pins={pins} pickedId={pickedId} onAdd={onAdd} emptyText={emptyText ?? row.empty} trackRef={trackRef} dropProps={dropProps} drop={drop} />
      ) : (
        <>
      <div ref={scrollerRef} className="shelf-row__scroller">
        <div ref={trackRef} className="shelf-row__track" data-dropping={drop ? 'true' : undefined} {...dropProps}>
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
            <button type="button" className="add-slot" onClick={onAdd} style={{ height: Math.round(rowH * 0.92) }}>
              <Plus aria-hidden="true" />
              <span>Añadir un libro</span>
              <Sprig aria-hidden="true" className="add-slot__sprig" />
            </button>
          )}
        </div>
      </div>
      <ScrollChevron dir="left" available={edges.left} onClick={() => page(-1)} />
      <ScrollChevron dir="right" available={edges.right} onClick={() => page(1)} />
        </>
      )}
      {/* Tabla de madera en tres cortes: los libros apoyan en su superficie superior */}
      <div className="shelf-row__plank" aria-hidden="true" />
    </section>
  );
}

/** Herramientas (SPEC §30.2, §35.1): libro al azar, recomendación y vitrina, con su nombre a la vista. */
function ToolTiles({ dieFace, rolling, onRoll, onAskLibrarian, onOpenVault }) {
  return (
    <div className="lib-tiles" role="group" aria-label="Herramientas">
      <button type="button" className="lib-tool lib-tool--die" data-rolling={rolling} onClick={onRoll}>
        <svg viewBox="0 0 40 40" aria-hidden="true" className="lib-tool__die">
          <rect x="5" y="5" width="30" height="30" rx="7" className="shelf-die__face" />
          {DIE_DOTS[dieFace].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="3" className="shelf-die__dot" />
          ))}
        </svg>
        <span>Libro al azar</span>
      </button>
      {onAskLibrarian && (
        <button type="button" className="lib-tool" onClick={onAskLibrarian}>
          <Sparkles aria-hidden="true" />
          <span>Pedir una recomendación</span>
        </button>
      )}
      {/* Acceso a la colección con su icono ilustrado (ya trae baldosa marfil: sin otra baldosa) */}
      <button type="button" className="lib-tool lib-tool--art" onClick={() => onOpenVault()}>
        <SectionIcon name="coleccion" size={32} />
        <span>Vitrina de Figuras</span>
      </button>
    </div>
  );
}

/** Libros por fila: tres completos en móvil; en pantallas anchas, los que quepan a ≈ 150 px. */
function useColumns() {
  const get = () => {
    const vw = window.innerWidth;
    if (vw <= 760) return 3;
    return Math.max(4, Math.min(7, Math.floor(Math.min(vw, 1180) / 165)));
  };
  const [n, setN] = useState(get);
  useEffect(() => {
    const onResize = () => setN(get());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return n;
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
  const cols = useColumns();
  const mode = settings.viewMode;
  const backRef = useRef(null);
  // «Vista y herramientas»: panel plegable bajo la barra (Escape lo cierra y devuelve el foco)
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsBtn = useRef(null);
  // La etiqueta elegida siempre a la vista en la fila textil (que puede desplazarse en horizontal)
  const filtersRef = useRef(null);
  useEffect(() => {
    const row = filtersRef.current;
    const el = row?.querySelector('[aria-checked="true"]');
    if (!row || !el) return;
    if (el.offsetLeft < row.scrollLeft) row.scrollLeft = el.offsetLeft - 8;
    else if (el.offsetLeft + el.offsetWidth > row.scrollLeft + row.clientWidth) row.scrollLeft = el.offsetLeft + el.offsetWidth - row.clientWidth + 8;
  }, [filter]);

  // Al salir se deja lista para la próxima visita desde la habitación: «Todos» y sin búsqueda (el foco al
  // abrir va a «Volver», nunca al buscador)
  useEffect(() => {
    // El foco va a «Volver» sin anillo visible si no se ha usado el teclado (focusVisible donde se admite)
    if (open) backRef.current?.focus({ preventScroll: true, focusVisible: false });
    else {
      setPick(null);
      setEditionMenu(null);
      setFilter('all');
      setQuery('');
      setToolsOpen(false);
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

  // En «Todos» la balda de abandonados solo aparece si tiene libros (con la búsqueda, si alguno coincide)
  const visibleRows = filter === 'all' ? ROWS.filter((r) => r.id !== 'abandoned' || found.abandoned.length) : ROWS.filter((r) => r.id === filter);
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

  const memory = <MemoryBoard books={grouped.read} onOpenBook={onOpenBook} pinned={settings.pinnedQuote} onUnpin={() => actions.setSettings({ pinnedQuote: null })} />;

  return (
    <div className="library" data-mode={mode} data-open={showing} data-phase={phase} aria-hidden={!open} inert={!open ? true : undefined} onTransitionEnd={onTransitionEnd}>
      <div className="library__case">
        <header className="lib-head lib-head--147">
          {/* Encabezado semántico de la pantalla (el título grande ya no se pinta: los libros suben) */}
          <h1 className="sr-only-focus">Mi biblioteca, la biblioteca junto al mar de {settings.owner}</h1>
          {/* Franja ilustrada compacta: volver, herramientas y el buscador siempre visible */}
          <div className="lib-head__strip">
            <div className="lib-head__bar">
              <button ref={backRef} type="button" className="lib-hero__back" onClick={onBack} aria-label="Volver a la cama">
                <ArrowLeft aria-hidden="true" />
                <span>Volver al rincón</span>
              </button>
              <button
                ref={toolsBtn}
                type="button"
                className="lib-tools-icon"
                aria-label="Vista y herramientas"
                title="Vista y herramientas"
                aria-expanded={toolsOpen}
                aria-controls="lib-tools"
                onClick={() => setToolsOpen((v) => !v)}
              >
                <SlidersHorizontal aria-hidden="true" />
              </button>
            </div>
            <div className="shelf-search craft craft--paper" role="search">
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
                placeholder="Buscar título o autor…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button type="button" className="shelf-search__clear" onClick={() => setQuery('')} aria-label="Limpiar búsqueda" title="Limpiar búsqueda">
                  <X aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
          {/* Herramientas: nacen de la cabecera y empujan las baldas (no tapan portadas). Cerradas por defecto */}
          {toolsOpen && (
            <div
              id="lib-tools"
              className="lib-tools lib-tools--147"
              role="group"
              aria-label="Vista y herramientas"
              onKeyDown={(e) => {
                if (e.key !== 'Escape') return;
                e.stopPropagation();
                setToolsOpen(false);
                toolsBtn.current?.focus();
              }}
            >
              <button type="button" className="lib-btn lib-strip__add craft craft--terra" onClick={onAddBook}>
                <Plus aria-hidden="true" />
                <span>Añadir libro</span>
              </button>
              <div className="lib-toggle" role="radiogroup" aria-label="Vista de la librería">
                <button type="button" role="radio" aria-checked={mode === 'cover'} onClick={() => actions.setSettings({ viewMode: 'cover' })}>
                  <BookOpen aria-hidden="true" />
                  <span>Escaparate</span>
                </button>
                <button type="button" role="radio" aria-checked={mode === 'spine'} onClick={() => actions.setSettings({ viewMode: 'spine' })}>
                  <Library aria-hidden="true" />
                  <span>Lomos</span>
                </button>
              </div>
              <ToolTiles dieFace={dieFace} rolling={rolling} onRoll={roll} onAskLibrarian={onAskLibrarian} onOpenVault={onOpenVault} />
            </div>
          )}
          {/* Fila textil de estados: un único filtro; se desplaza en horizontal si no caben las cinco */}
          <div className="lib-cloths">
            <div ref={filtersRef} className="lib-cloths__row" role="radiogroup" aria-label="Qué baldas ver">
              {FILTERS.map((f) => {
                const Icon = FILTER_ICON[f.id];
                return (
                  <button key={f.id} type="button" role="radio" aria-checked={filter === f.id} data-status={f.id} data-cloth={f.cloth} className="lib-cloth" onClick={() => setFilter(f.id)}>
                    <Icon aria-hidden="true" className="lib-cloth__icon" />
                    <span>{f.label}</span>
                  </button>
                );
              })}
            </div>
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
                cols={cols}
                focused={filter === row.id}
                onPlate={() => setFilter((f) => (f === row.id ? 'all' : row.id))}
                onOpenBook={onOpenBook}
                onEdition={(book, event) => {
                  // Con teclado (tecla de menú) no hay coordenadas: se abre junto al libro
                  const r = event.currentTarget.getBoundingClientRect();
                  const fromKey = event.clientX === 0 && event.clientY === 0;
                  setEditionMenu({ id: book.id, x: fromKey ? r.right + 6 : event.clientX + 4, y: fromKey ? r.top : event.clientY + 4, from: event.currentTarget });
                }}
                // 1.47: sin hueco de «Añadir libro» en la estantería (está en las herramientas de la cabecera)
                onAdd={null}
                pickedId={pick}
                onMove={actions.moveBook}
                pins={pins}
                ivy={i === 0 ? 'right' : i === visibleRows.length - 1 && i > 0 ? 'left' : null}
              />
            </div>
          ))}
          {/* Recuerdos al final: los libros aparecen antes */}
          {memory}
        </div>
      </div>
    </div>
  );
}
