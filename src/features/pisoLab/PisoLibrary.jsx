// Toda la biblioteca, desde la estantería: búsqueda y filtros sobre todos los ejemplares, resultados por bloques y solo unas
// pocas filas montadas a la vez. Las filas miden siempre lo mismo, así que saber cuáles se ven no obliga a medir nada. Una
// portada solo se pide si su fila sigue montada un momento: pasar de largo no descarga nada.
import { ArrowLeft, Filter, LayoutGrid, List, X } from 'lucide-react';
import { memo, useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Cover, coverLoaded } from '../../components/shelf/BookItem';
import { STATUS } from '../../domain/books';
import { normalize } from '../../domain/bookPicker';
import { LIBRARY_STATUSES, filterLibrary } from '../../domain/library';
import { uniqueBooks } from '../../domain/roomShelf';
import { chosenIds } from './roomSelection';

export const ROW_H = 76;
export const BLOCK = 40;
/** Filas montadas de más por encima y por debajo de lo que se ve. */
const OVERSCAN = 4;
/** Lo que una fila tiene que seguir montada para pedir su portada. */
const COVER_DELAY = 160;
/** Desplazándose más rápido que esto (px/ms) nadie llega a ver la portada: se espera, y no se descarga. */
const FAST_SCROLL = 1;
/** Hasta cuándo se considera que la lista sigue yendo rápido. Hay una sola lista a la vez. */
const motion = { until: 0 };
/** Cada estado con su tono: el color nunca es la única señal, también van nombre e icono. */
const FILTERS = [
  { id: 'all', label: 'Todos', tone: 'sage' },
  { id: 'reading', label: 'Leyendo', tone: 'blue' },
  { id: 'want', label: 'Pendientes', tone: 'mustard' },
  { id: 'read', label: 'Leídos', tone: 'terracotta' },
  { id: 'abandoned', label: 'Abandonados', tone: 'mauve' },
].filter((f) => f.id === 'all' || LIBRARY_STATUSES.includes(f.id));
const ORDERS = [
  { id: 'title', label: 'Título' },
  { id: 'author', label: 'Autoría' },
  { id: 'added', label: 'Añadidos recientemente' },
  { id: 'finished', label: 'Terminados recientemente' },
];
const byDate = (field) => (a, b) => String(b[1][field] ?? '').localeCompare(String(a[1][field] ?? '')) || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
const SORTERS = {
  title: (a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0),
  author: (a, b) => normalize(a[1].author ?? '').localeCompare(normalize(b[1].author ?? '')) || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0),
  added: byDate('addedAt'),
  finished: byDate('finishedAt'),
};
/** Portadas por fila según el ancho: 3 en el móvil y 2 si no caben cómodas; en pantallas grandes, las que quepan con unos 130 px. */
const columnsFor = (width) => (width < 360 ? 2 : width < 600 ? 3 : Math.min(8, Math.floor((width - 12) / 142)));
const coverRowHeight = (width) => {
  const cols = columnsFor(width);
  return Math.round((((width - 24 - (cols - 1) * 12) / cols) * 3) / 2) + 35;
};

// Un icono de píxeles para cada estado: cada filtro se reconoce por su forma además de por su color
const PIXELES = {
  all: ['##.##.##.', '##.##.##.', '##.##.##.', '##.##.##.', '##.##.##.', '##.##.##.', '##.##.##.', '#########'],
  reading: ['.........', '##.....##', '#.##.##.#', '#..#.#..#', '#..#.#..#', '#..#.#..#', '###.#.###', '.########'],
  want: ['..#####..', '..#####..', '..#####..', '..#####..', '..#####..', '..##.##..', '..#...#..'],
  read: ['........#', '.......##', '......##.', '#....##..', '##..##...', '.####....', '..##.....'],
  abandoned: ['#.......#', '##.....##', '.##...##.', '..##.##..', '...###...', '..##.##..', '.##...##.', '##.....##', '#.......#'],
  add: ['...###...', '...###...', '...###...', '#########', '#########', '#########', '...###...', '...###...', '...###...'],
};

function Pixeles({ name }) {
  const d = PIXELES[name].flatMap((row, y) => [...row].map((c, x) => (c === '#' ? `M${x} ${y}h1v1h-1z` : ''))).join('');
  return (
    <svg viewBox="0 0 9 9" width="14" height="14" shapeRendering="crispEdges" fill="currentColor" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/** Una memoria nueva para `memory`: lo que hay que recuperar al volver de la ficha de un libro. */
export const emptyLibraryMemory = () => ({ query: '', status: 'all', count: BLOCK, top: 0, focusId: null, view: 'covers', order: 'title', onlyChosen: false });

function RowCover({ book }) {
  // Una portada ya mostrada no espera: el retardo solo evita pedir imágenes nuevas mientras se desplaza la lista
  const [wanted, setWanted] = useState(() => coverLoaded(book.cover));
  useEffect(() => {
    if (wanted) return undefined;
    let timer = 0;
    const ask = () => {
      if (performance.now() < motion.until) timer = setTimeout(ask, COVER_DELAY);
      else setWanted(true);
    };
    timer = setTimeout(ask, COVER_DELAY);
    return () => clearTimeout(timer);
    // Solo decide al montarse
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <span className="plab-row__cover">{wanted ? <Cover book={book} eager reuse /> : <span className="cover-img cover-img--wait" aria-hidden="true" />}</span>;
}

// Al desplazar solo cambian las filas que entran y salen: las demás no se vuelven a dibujar
/** Una balda de portadas. Una sola etiqueta con todo lo que se sabe del libro: sin títulos repetidos bajo cada portada. */
const CoverRow = memo(function CoverRow({ books, top, height, cols, chosen, onOpen }) {
  return (
    <li className="lit-fila" style={{ top, height, gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {books.map((book) => (
        <button key={book.id} type="button" className="lit-libro" data-book={book.id} aria-label={`${book.title}, de ${book.author}. ${STATUS[book.status]}${chosen.has(book.id) ? '. Expuesto en la habitación' : ''}`} onClick={() => onOpen(book)}>
          <RowCover book={book} />
          {book.status === 'reading' && <i className="lit-libro__marca" aria-hidden="true" />}
        </button>
      ))}
    </li>
  );
});

const Row = memo(function Row({ book, index, total, placed, chosen, onOpen, onToggle }) {
  const isReading = book.status === 'reading';
  const note = placed ? 'En la estantería' : chosen ? 'Expuesto, no cabe ahora' : null;
  return (
    <li className="plab-row" style={{ top: index * ROW_H, height: ROW_H }} aria-setsize={total} aria-posinset={index + 1}>
      <button type="button" className="plab-row__open" data-book={book.id} onClick={() => onOpen(book)}>
        <RowCover book={book} />
        <span className="plab-row__text">
          <strong>{book.title}</strong>
          <span>{book.author}</span>
          <small>
            {STATUS[book.status]}
            {note ? ` · ${note}` : ''}
          </small>
        </span>
      </button>
      {/* Una lectura actual ya está en la habitación: no hay nada que elegir */}
      {!isReading && (
        <button type="button" className="px-btn plab-row__exhibit" aria-pressed={chosen} aria-label={`${chosen ? 'Retirar de la estantería' : 'Exponer en la estantería'}: ${book.title}`} onClick={() => onToggle(book)}>
          {chosen ? 'Expuesto' : 'Exponer'}
        </button>
      )}
    </li>
  );
});

export function PisoLibrary({ books, settings, placed, memory, notice, onBack, onOpen, onToggle, onAdd }) {
  const [query, setQuery] = useState(memory.query);
  const [status, setStatus] = useState(memory.status === 'chosen' ? 'all' : memory.status);
  const [count, setCount] = useState(memory.count);
  const [view, setView] = useState({ top: memory.top, height: 0, width: typeof window === 'undefined' ? 390 : window.innerWidth });
  const [layout, setLayout] = useState(memory.view ?? 'covers');
  const [order, setOrder] = useState(memory.order ?? 'title');
  // Una memoria antigua con «Expuestos» como estado pasa a ser el filtro adicional
  const [onlyChosen, setOnlyChosen] = useState(Boolean(memory.onlyChosen) || memory.status === 'chosen');
  const [optionsOpen, setOptionsOpen] = useState(false);
  const searched = useDeferredValue(query);
  const root = useRef(null);
  const list = useRef(null);
  const heading = useRef(null);

  const sorted = useMemo(() => {
    const keyed = uniqueBooks(books).map((book) => [normalize(book.title), book]);
    keyed.sort(SORTERS[order]);
    return keyed.map((pair) => pair[1]);
  }, [books, order]);
  const chosen = useMemo(() => new Set(chosenIds(settings)), [settings]);
  const found = useMemo(() => {
    const matches = filterLibrary(sorted, { query: searched, status });
    return onlyChosen ? matches.filter((b) => chosen.has(b.id)) : matches;
  }, [sorted, searched, status, chosen, onlyChosen]);

  // Al cambiar la búsqueda o el filtro se empieza por arriba; al volver de una ficha, no
  const asked = `${searched}|${status}|${order}|${onlyChosen}|${layout}`;
  const lastAsked = useRef(asked);
  useEffect(() => {
    if (lastAsked.current === asked) return;
    lastAsked.current = asked;
    setCount(BLOCK);
    list.current?.scrollTo(0, 0);
    setView((v) => ({ ...v, top: 0 }));
  }, [asked]);

  const shown = Math.min(count, found.length);
  const covers = layout === 'covers';
  const cols = covers ? columnsFor(view.width) : 1;
  const rowH = covers ? coverRowHeight(view.width) : ROW_H;
  const rowRef = useRef(rowH);
  rowRef.current = rowH;
  // En portadas, una «fila» de la lista virtual es una balda
  const totalRows = Math.ceil(shown / cols);
  const firstRow = Math.max(0, Math.floor(view.top / rowH) - OVERSCAN);
  const lastRow = Math.min(totalRows, Math.ceil((view.top + view.height) / rowH) + OVERSCAN);
  const first = firstRow * cols;
  const last = Math.min(shown, lastRow * cols);

  // El siguiente bloque llega antes de tocar fondo
  useEffect(() => {
    if (view.height && last >= shown - OVERSCAN && shown < found.length) setCount((c) => Math.min(found.length, c + BLOCK));
  }, [last, shown, found.length, view.height]);

  // Qué se ve, como mucho una vez por fotograma y solo si cambia la fila
  useLayoutEffect(() => {
    const el = list.current;
    if (!el) return undefined;
    el.scrollTop = memory.top;
    let frame = 0;
    let lastTop = el.scrollTop;
    let lastAt = performance.now();
    const read = () => {
      frame = 0;
      const now = performance.now();
      if (Math.abs(el.scrollTop - lastTop) > FAST_SCROLL * (now - lastAt)) motion.until = now + COVER_DELAY;
      lastTop = el.scrollTop;
      lastAt = now;
      memory.top = el.scrollTop;
      const top = Math.floor(el.scrollTop / rowRef.current) * rowRef.current;
      const height = el.clientHeight;
      const width = el.clientWidth;
      setView((v) => (v.top === top && v.height === height && v.width === width ? v : { top, height, width }));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    read();
    el.addEventListener('scroll', onScroll, { passive: true });
    const observer = new ResizeObserver(onScroll);
    observer.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('scroll', onScroll);
      observer.disconnect();
    };
    // `memory` es siempre el mismo objeto
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    Object.assign(memory, { query, status, count, view: layout, order, onlyChosen });
  }, [memory, query, status, count, layout, order, onlyChosen]);

  // El teclado del móvil tapa parte de la pantalla: la vista se queda en lo que sigue a la vista
  useEffect(() => {
    const vv = window.visualViewport;
    const el = root.current;
    if (!vv || !el) return undefined;
    const fit = () => {
      const whole = el.parentElement?.clientHeight ?? vv.height;
      el.style.height = `${Math.min(whole, Math.round(vv.height))}px`;
      el.style.transform = vv.offsetTop ? `translateY(${Math.round(vv.offsetTop)}px)` : '';
    };
    fit();
    vv.addEventListener('resize', fit);
    vv.addEventListener('scroll', fit);
    return () => {
      vv.removeEventListener('resize', fit);
      vv.removeEventListener('scroll', fit);
    };
  }, []);

  // Al volver de la ficha, el foco a la fila de la que vienes; al abrir, al título: abrir el teclado sin pedirlo tapa la lista
  useEffect(() => {
    const row = memory.focusId && root.current?.querySelector(`[data-book="${CSS.escape(memory.focusId)}"]`);
    const list = root.current?.querySelector('.plab-library__list');
    const top = list?.scrollTop ?? 0;
    (row || heading.current)?.focus({ preventScroll: true });
    // WebKit mueve la lista al enfocar pese a preventScroll
    if (list) list.scrollTop = top;
    memory.focusId = null;
    // Solo al abrir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlers = useRef(null);
  useLayoutEffect(() => {
    handlers.current = { onOpen, onToggle };
  });
  const open = useCallback(
    (book) => {
      memory.focusId = book.id;
      handlers.current.onOpen(book);
    },
    [memory],
  );
  const toggle = useCallback((...args) => handlers.current.onToggle(...args), []);
  const rows = [];
  if (covers) for (let r = firstRow; r < lastRow; r += 1) {
    const group = found.slice(r * cols, Math.min(shown, (r + 1) * cols));
    if (group.length) rows.push(<CoverRow key={group[0].id} books={group} top={r * rowH} height={rowH} cols={cols} chosen={chosen} onOpen={open} />);
  }
  else for (let i = first; i < last; i += 1) rows.push(<Row key={found[i].id} book={found[i]} index={i} total={found.length} placed={placed.has(found[i].id)} chosen={chosen.has(found[i].id)} onOpen={open} onToggle={toggle} />);

  return (
    <section ref={root} className="plab-library bs-literary" aria-labelledby="plab-library-title">
      <div className="lit-cabecera">
        <button type="button" className="lit-boton" onClick={onBack} aria-label="Volver">
          <ArrowLeft aria-hidden="true" width="20" height="20" />
        </button>
        <h2 ref={heading} id="plab-library-title" tabIndex={-1}>
          Biblioteca
        </h2>
      </div>
      <header className="plab-library__head">
        <div className="plab-library__buscar">
        <form
          className="plab-library__search"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            e.currentTarget.querySelector('input')?.blur();
          }}
        >
          <input type="search" value={query} placeholder="Título, autor o ISBN" aria-label="Buscar por título, autor o ISBN" enterKeyHint="search" autoComplete="off" onChange={(e) => setQuery(e.target.value)} />
          {query && (
            <button type="button" className="plab-library__clear" aria-label="Borrar la búsqueda" onClick={() => setQuery('')}>
              <X aria-hidden="true" />
            </button>
          )}
        </form>
        {onAdd && (
          <button type="button" className="lit-boton lit-boton--verde" onClick={onAdd} aria-label="Añadir libro">
            <Pixeles name="add" />
          </button>
        )}
        </div>
        <div className="plab-library__filters" role="group" aria-label="Filtrar">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" className="plab-filter color-tab" data-filtro={f.id} data-tone={f.tone} aria-pressed={status === f.id} onClick={() => setStatus(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="lit-barra">
        <p className="plab-library__count" role="status">
          {notice || (found.length ? `${found.length.toLocaleString('es-ES')} ${found.length === 1 ? 'libro' : 'libros'}${shown < found.length ? `, ${shown.toLocaleString('es-ES')} cargados` : ''}` : sorted.length ? 'Ningún libro coincide' : 'Aún no hay libros')}
        </p>
        <span className="lit-segmento">
        <button type="button" className="lit-boton" aria-label="Ver portadas" aria-pressed={covers} onClick={() => setLayout('covers')}>
          <LayoutGrid aria-hidden="true" width="20" height="20" />
        </button>
        <button type="button" className="lit-boton" aria-label="Ver lista" aria-pressed={!covers} onClick={() => setLayout('list')}>
          <List aria-hidden="true" width="20" height="20" />
        </button>
        </span>
        <span className="lit-separa" aria-hidden="true" />
        <button type="button" className="lit-boton" aria-label="Filtros y orden" aria-expanded={optionsOpen} onClick={() => setOptionsOpen((v) => !v)}>
          <Filter aria-hidden="true" width="20" height="20" />
        </button>
        </div>
        {optionsOpen && (
          <div className="lit-opciones">
            <label>
              Ordenar por
              <select value={order} onChange={(e) => setOrder(e.target.value)}>
                {ORDERS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <input type="checkbox" checked={onlyChosen} onChange={(e) => setOnlyChosen(e.target.checked)} /> Solo los expuestos en la habitación
            </label>
          </div>
        )}
        {onlyChosen && (
          <button type="button" className="lit-boton" onClick={() => setOnlyChosen(false)} aria-label="Quitar el filtro Expuestos">
            Expuestos <X aria-hidden="true" width="16" height="16" />
          </button>
        )}
      </header>
      <div ref={list} className="plab-library__list">
        <ul style={{ height: totalRows * rowH }}>{rows}</ul>
        {covers && found.length > 0 && shown >= found.length && (
          <p className="lit-pie">
            <img src="/assets/puerto/acabado/book.svg" alt="" />
            Tu biblioteca, a tu ritmo
          </p>
        )}
        {shown < found.length && (
          <button type="button" className="px-btn plab-library__more" onClick={() => setCount((c) => Math.min(found.length, c + BLOCK))}>
            Cargar {Math.min(BLOCK, found.length - shown)} más
          </button>
        )}
      </div>
    </section>
  );
}
