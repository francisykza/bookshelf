// `SHELF_VIEW` (SPEC §3.3): el mueble de roble de la ilustración visto de cerca, con la textura de madera
// recortada de la propia imagen, postales clavadas, macetas y hiedra. Tres baldas (Leyendo ahora con el
// la mini-figura de su saga bajo cada libro, Pendientes y Leídos) y controles como placas de latón.
import { ArrowLeft, BookOpen, Library, Plus, Trophy, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { pageRustle } from '../../audio/ambientAudio';
import { shelfSort } from '../../domain/books';
import { SCENE_H, SCENE_SRC, SCENE_W, WOOD_PLANK, WOOD_SIDE } from '../../scene/sceneMap';
import { useLibrary } from '../../state/useLibrary';
import { MiniFigurePin } from '../figures/MiniFigurePin';
import { figureForBook, useFigureCatalog } from '../figures/figureCatalog';
import { EditionMenu } from '../book/EditionPicker';
import { ElegantQuoteCard } from '../quotes/ElegantQuoteCard';
import { BookItem, Cover } from './BookItem';

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
  { id: 'read', label: 'Leídos', empty: 'Aquí irán los libros terminados' },
];

/** Sombras de hojas de hiedra sobre el mueble, más densas hacia el balcón (derecha). */
const SHELF_LEAVES = Array.from({ length: 22 }, (_, i) => {
  const r = (n) => {
    const v = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
    return v - Math.floor(v);
  };
  return [520 + r(1) * 480, r(2) * 700, 18 + r(3) * 30, 8 + r(4) * 12, r(5) * 180];
});

const FILTERS = [
  { id: 'all', label: 'Todas', color: '#f3e3c2' },
  { id: 'reading', label: 'Leyendo', color: '#c4623a' },
  { id: 'want', label: 'Pendientes', color: '#d9a441' },
  { id: 'read', label: 'Leídos', color: '#5d8a3c' },
];

const DIE_DOTS = {
  1: [[20, 20]],
  2: [[12, 12], [28, 28]],
  3: [[12, 12], [20, 20], [28, 28]],
  4: [[12, 12], [28, 12], [12, 28], [28, 28]],
  5: [[12, 12], [28, 12], [20, 20], [12, 28], [28, 28]],
  6: [[12, 11], [28, 11], [12, 20], [28, 20], [12, 29], [28, 29]],
};

/** Hiedra que cuelga del copete sobre la primera balda. */
const IVY_STRANDS = [0.1, 0.46, 0.82];

function IvyStrand({ length, delay }) {
  const leaves = Math.round(length / 14);
  return (
    <svg className="ivy-strand" viewBox={`0 0 40 ${length}`} style={{ height: length, animationDelay: `${delay}s` }} aria-hidden="true">
      <path d={`M20 0 C14 ${length * 0.3} 26 ${length * 0.6} 19 ${length}`} stroke="#4a6b2c" strokeWidth="1.6" fill="none" />
      {Array.from({ length: leaves }, (_, i) => {
        const y = 8 + i * 14;
        const side = i % 2 ? 1 : -1;
        const x = 20 + Math.sin(i * 1.7) * 3;
        return (
          <path
            key={i}
            d={`M${x} ${y} c${side * 6} -6 ${side * 14} -2 ${side * 13} 5 c${-side * 4} 4 ${-side * 10} 3 ${-side * 13} -5 Z`}
            fill={i % 3 === 0 ? '#9cc15a' : i % 3 === 1 ? '#6f9a3c' : '#577f30'}
            stroke="#2f4a1a"
            strokeWidth="0.6"
          />
        );
      })}
    </svg>
  );
}

function Plant({ variant }) {
  return (
    <svg className={`plant plant--${variant}`} viewBox="0 0 80 90" aria-hidden="true">
      <g className="plant__leaves">
        {variant === 'fern'
          ? [-58, -34, -12, 10, 32, 56].map((r) => (
              <path key={r} d="M40 58 C36 40 38 22 40 6 C44 22 46 40 40 58 Z" fill="#6f9a3c" stroke="#2f4a1a" strokeWidth="0.7" transform={`rotate(${r} 40 58)`} />
            ))
          : [
              [24, 30, -30],
              [52, 26, 28],
              [38, 18, 0],
              [18, 44, -60],
              [60, 42, 58],
            ].map(([x, y, r]) => (
              <ellipse key={x} cx={x} cy={y} rx="10" ry="15" fill="#4f7a3a" stroke="#2a4519" strokeWidth="0.8" transform={`rotate(${r} ${x} ${y})`} />
            ))}
      </g>
      <path d="M20 58 H60 L55 86 H25 Z" fill="#c4623a" stroke="#6b2e16" strokeWidth="1.2" />
      <path d="M18 56 H62 V63 H18 Z" fill="#d97a4e" stroke="#6b2e16" strokeWidth="1.2" />
      <path d="M26 70 Q40 74 54 70" stroke="#f0b48a" strokeWidth="1" fill="none" opacity="0.6" />
    </svg>
  );
}

/** Muro de recuerdos: polaroids clavadas de los libros que has terminado, con fecha y estrellas. */
function MemoryBoard({ books, onOpenBook, pinned, onUnpin }) {
  const recent = [...books].sort((a, b) => (b.finishedAt || '').localeCompare(a.finishedAt || '')).slice(0, 8);
  return (
    <aside className="memory-board" aria-label="Muro de recuerdos: libros leídos">
      <span className="memory-board__title">Recuerdos</span>
      {/* La cita que dejaste clavada en la estantería */}
      {pinned && (
        <div className="pinned-quote">
          <span className="memory-polaroid__pin" aria-hidden="true" />
          <ElegantQuoteCard text={pinned.text} author={pinned.author} work={pinned.work} compact animate={false} />
          <button type="button" className="pinned-quote__off" onClick={onUnpin} aria-label="Desclavar la cita de la estantería" title="Desclavar">
            ×
          </button>
        </div>
      )}
      {recent.length === 0 && <p className="memory-board__empty">Aquí irán las fotos de los libros que termines.</p>}
      {recent.map((b, i) => (
        <button
          key={b.id}
          type="button"
          className="memory-polaroid"
          style={{ '--tilt': `${((i * 37) % 9) - 4}deg` }}
          onClick={() => onOpenBook(b)}
          aria-label={`${b.title}, leído el ${b.finishedAt ? new Date(b.finishedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }) : ''}${b.rating ? `, ${b.rating} estrellas` : ''}`}
        >
          <span className="memory-polaroid__pin" aria-hidden="true" />
          <span className="memory-polaroid__photo">
            <Cover book={b} />
          </span>
          <span className="memory-polaroid__date">
            {b.finishedAt ? new Date(b.finishedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
          </span>
          <span className="memory-polaroid__stars" aria-hidden="true">
            {'★'.repeat(b.rating || 0)}
            <i>{'★'.repeat(5 - (b.rating || 0))}</i>
          </span>
        </button>
      ))}
    </aside>
  );
}

function useRowHeight() {
  const get = () => Math.round(Math.max(118, Math.min(186, window.innerHeight * 0.2)));
  const [h, setH] = useState(get);
  useEffect(() => {
    const onResize = () => setH(get());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return h;
}

function ShelfRow({ row, books, mode, rowH, onOpenBook, onEdition, onAdd, pins, focused, onPlate, pickedId, onMove }) {
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
    <section className="shelf-row" data-row={row.id} style={{ '--row-h': `${rowH}px` }} aria-label={`${row.label}: ${books.length} libros`}>
      <div className="shelf-row__scroller">
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
            // Cada libro con, si es de una saga del catálogo, su mini-figura engarzada en el listón de debajo
            <span key={book.id} className="book-slot">
              <BookItem book={book} mode={mode} rowHeight={rowH} onOpen={onOpenBook} onEdition={onEdition} picked={book.id === pickedId} draggable />
              {pins(book)}
            </span>
          ))}
          {!books.length && <p className="shelf-row__empty">{row.empty}</p>}
          {onAdd && (
            <button type="button" className="add-slot" onClick={onAdd} style={{ height: Math.round(rowH * 0.82) }}>
              <Plus aria-hidden="true" />
              <span>Añadir libro</span>
            </button>
          )}
        </div>
      </div>
      <div className="shelf-row__plank" style={cropStyle(WOOD_PLANK)}>
        <button
          type="button"
          className="shelf-row__plate"
          aria-pressed={focused}
          onClick={onPlate}
          title={focused ? 'Volver a ver todas las baldas' : `Ver solo ${row.label.toLowerCase()}`}
        >
          {row.label} · {books.length}
        </button>
      </div>
    </section>
  );
}

export function ShelfView({ open, onBack, onOpenBook, onAddBook, onOpenVault }) {
  const { state, actions } = useLibrary();
  const { books, settings, progress } = state;
  const [pick, setPick] = useState(null);
  const [rolling, setRolling] = useState(false);
  const [filter, setFilter] = useState('all');
  // Menú rápido de edición: clic derecho (o pulsación larga / tecla de menú) sobre un libro
  const [editionMenu, setEditionMenu] = useState(null);
  const rowH = useRowHeight();
  const mode = settings.viewMode;
  const backRef = useRef(null);

  useEffect(() => {
    if (open) backRef.current?.focus({ preventScroll: true });
    else {
      setPick(null);
      setEditionMenu(null);
    }
  }, [open]);

  const grouped = useMemo(() => {
    const g = { reading: [], want: [], read: [] };
    books.forEach((b) => g[b.status]?.push(b));
    Object.keys(g).forEach((k) => g[k].sort(shelfSort(k)));
    return g;
  }, [books]);

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
  const shownRowH = filter === 'all' ? rowH : Math.round(rowH * 1.3);

  // Mini-figuras de saga bajo los libros, y los libros de cada saga para la sinergia ×2 de pity
  const figCatalog = useFigureCatalog();
  const figs = progress.figures;
  const pins = (book) => {
    const fig = figureForBook(figCatalog, book);
    return fig ? <MiniFigurePin fig={fig} owned={Boolean(figs?.owned[fig.id])} onOpen={onOpenVault} /> : null;
  };
  useEffect(() => {
    if (!figCatalog.length || !figs) return;
    const map = {};
    books.forEach((b) => {
      const fig = figureForBook(figCatalog, b);
      if (fig && figs.owned[fig.id]) (map[fig.id] ??= []).push(b.id);
    });
    if (JSON.stringify(map) !== JSON.stringify(figs.placements ?? {})) actions.syncFigureBooks(map);
  }, [figCatalog, books, figs, actions]);

  return (
    <div className="library" data-open={open} aria-hidden={!open} inert={!open ? true : undefined}>
      <div className="library__case">
        {/* Haz de sol diagonal y sombras de hiedra que entran desde el balcón */}
        <span className="library__sun" aria-hidden="true" />
        <svg className="library__leaves" viewBox="0 0 1000 700" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <filter id="f-shelf-leaves" x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur stdDeviation="9" />
            </filter>
          </defs>
          <g filter="url(#f-shelf-leaves)">
            {SHELF_LEAVES.map(([x, y, rx, ry, r], i) => (
              <ellipse key={i} cx={x} cy={y} rx={rx} ry={ry} transform={`rotate(${r} ${x} ${y})`} />
            ))}
          </g>
        </svg>
        <span className="library__side library__side--left" style={cropStyle(WOOD_SIDE)} />
        <span className="library__side library__side--right" style={cropStyle(WOOD_SIDE)} />

        <header className="library__crown">
          <Plant variant="fern" />
          <button ref={backRef} type="button" className="brass-btn brass-btn--back" onClick={onBack}>
            <ArrowLeft aria-hidden="true" />
            <span>Volver a la cama</span>
          </button>
          <h1 className="library__title">
            <span>La biblioteca junto al mar</span>
            <small>de {settings.owner}</small>
          </h1>
          <div className="library__tools">
            <div className="brass-toggle" role="radiogroup" aria-label="Vista de la librería">
              <button type="button" role="radio" aria-checked={mode === 'cover'} onClick={() => actions.setSettings({ viewMode: 'cover' })}>
                <BookOpen aria-hidden="true" />
                <span>Escaparate</span>
              </button>
              <button type="button" role="radio" aria-checked={mode === 'spine'} onClick={() => actions.setSettings({ viewMode: 'spine' })}>
                <Library aria-hidden="true" />
                <span>Lomos</span>
              </button>
            </div>

          {/* Dado de madera apoyado en el copete: tira y te propone un libro pendiente al azar */}
          <span className="shelf-die-wrap">
            <span className="shelf-die__tag">¿Al azar?</span>
            <button type="button" className="shelf-die" data-rolling={rolling} onClick={roll} aria-label="Elegir un libro al azar" title="Libro al azar">
            <svg viewBox="0 0 40 40" aria-hidden="true">
              <rect x="3" y="3" width="34" height="34" rx="8" className="shelf-die__face" />
              {DIE_DOTS[dieFace].map(([cx, cy]) => (
                <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="3.4" className="shelf-die__dot" />
              ))}
            </svg>
                      </button>
          </span>
            <button type="button" className="brass-btn brass-btn--vault" onClick={() => onOpenVault()}>
              <Trophy aria-hidden="true" />
              <span>🏆 Vitrina de Figuras</span>
            </button>
            <button type="button" className="brass-btn brass-btn--accent" onClick={onAddBook}>
              <Plus aria-hidden="true" />
              <span>Añadir libro</span>
            </button>
          </div>
          <Plant variant="leafy" />
          {/* Cintas marcapáginas que cuelgan del copete: eligen qué baldas ver */}
          <div className="shelf-ribbons" role="radiogroup" aria-label="Qué baldas ver">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="radio"
                aria-checked={filter === f.id}
                className="shelf-ribbon"
                data-light={f.id === 'all' || undefined}
                style={{ '--ribbon': f.color }}
                onClick={() => setFilter(f.id)}
              >
                <span>{f.label}</span>
              </button>
            ))}
          </div>
          <div className="library__ivy" aria-hidden="true">
            {IVY_STRANDS.map((f, i) => (
              <span key={f} style={{ left: `${f * 100}%` }}>
                <IvyStrand length={60 + i * 22} delay={-i * 1.4} />
              </span>
            ))}
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
              {pickedBook.author} · {pickedBook.pageCount} págs.
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

        <MemoryBoard books={grouped.read} onOpenBook={onOpenBook} pinned={settings.pinnedQuote} onUnpin={() => actions.setSettings({ pinnedQuote: null })} />

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
          {visibleRows.map((row) => (
            <ShelfRow
              key={row.id}
              row={row}
              books={grouped[row.id]}
              mode={mode}
              rowH={shownRowH}
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
            />
          ))}
        </div>
      </div>
    </div>
  );
}
