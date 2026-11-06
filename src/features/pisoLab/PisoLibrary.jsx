// Toda la biblioteca, desde la estantería: búsqueda y filtros sobre todos los ejemplares, resultados por bloques y solo unas
// pocas filas montadas a la vez. Las filas miden siempre lo mismo, así que saber cuáles se ven no obliga a medir nada. Una
// portada solo se pide si su fila sigue montada un momento: pasar de largo no descarga nada.
import { ArrowLeft, X } from 'lucide-react';
import { memo, useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Cover } from '../../components/shelf/BookItem';
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
const FILTERS = [{ id: 'all', label: 'Todos' }, ...LIBRARY_STATUSES.map((id) => ({ id, label: STATUS[id] })), { id: 'chosen', label: 'Expuestos' }];

/** Una memoria nueva para `memory`: lo que hay que recuperar al volver de la ficha de un libro. */
export const emptyLibraryMemory = () => ({ query: '', status: 'all', count: BLOCK, top: 0, focusId: null });

function RowCover({ book }) {
  const [wanted, setWanted] = useState(false);
  useEffect(() => {
    let timer = 0;
    const ask = () => {
      if (performance.now() < motion.until) timer = setTimeout(ask, COVER_DELAY);
      else setWanted(true);
    };
    timer = setTimeout(ask, COVER_DELAY);
    return () => clearTimeout(timer);
  }, []);
  return <span className="plab-row__cover">{wanted ? <Cover book={book} eager /> : <span className="cover-img cover-img--wait" aria-hidden="true" />}</span>;
}

// Al desplazar solo cambian las filas que entran y salen: las demás no se vuelven a dibujar
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

export function PisoLibrary({ books, settings, placed, memory, notice, onBack, onOpen, onToggle }) {
  const [query, setQuery] = useState(memory.query);
  const [status, setStatus] = useState(memory.status);
  const [count, setCount] = useState(memory.count);
  const [view, setView] = useState({ top: memory.top, height: 0 });
  const searched = useDeferredValue(query);
  const root = useRef(null);
  const list = useRef(null);
  const heading = useRef(null);

  const sorted = useMemo(() => {
    const keyed = uniqueBooks(books).map((book) => [normalize(book.title), book]);
    keyed.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    return keyed.map((pair) => pair[1]);
  }, [books]);
  const chosen = useMemo(() => new Set(chosenIds(settings)), [settings]);
  const found = useMemo(() => {
    const matches = filterLibrary(sorted, { query: searched, status: status === 'chosen' ? 'all' : status });
    return status === 'chosen' ? matches.filter((b) => chosen.has(b.id)) : matches;
  }, [sorted, searched, status, chosen]);

  // Al cambiar la búsqueda o el filtro se empieza por arriba; al volver de una ficha, no
  const asked = `${searched}|${status}`;
  const lastAsked = useRef(asked);
  useEffect(() => {
    if (lastAsked.current === asked) return;
    lastAsked.current = asked;
    setCount(BLOCK);
    list.current?.scrollTo(0, 0);
    setView((v) => ({ ...v, top: 0 }));
  }, [asked]);

  const shown = Math.min(count, found.length);
  const first = Math.max(0, Math.floor(view.top / ROW_H) - OVERSCAN);
  const last = Math.min(shown, Math.ceil((view.top + view.height) / ROW_H) + OVERSCAN);

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
      const top = Math.floor(el.scrollTop / ROW_H) * ROW_H;
      const height = el.clientHeight;
      setView((v) => (v.top === top && v.height === height ? v : { top, height }));
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
    Object.assign(memory, { query, status, count });
  }, [memory, query, status, count]);

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
    (row || heading.current)?.focus({ preventScroll: true });
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
  for (let i = first; i < last; i += 1) rows.push(<Row key={found[i].id} book={found[i]} index={i} total={found.length} placed={placed.has(found[i].id)} chosen={chosen.has(found[i].id)} onOpen={open} onToggle={toggle} />);

  return (
    <section ref={root} className="plab-library" aria-labelledby="plab-library-title">
      <header className="plab-library__head">
        <div className="plab-library__top">
          <button type="button" className="px-btn" onClick={onBack}>
            <ArrowLeft aria-hidden="true" /> Volver a la balda
          </button>
          <h2 ref={heading} id="plab-library-title" tabIndex={-1} className="plab-title">
            Tu biblioteca
          </h2>
        </div>
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
        <div className="plab-library__filters" role="group" aria-label="Filtrar">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" className="plab-filter" aria-pressed={status === f.id} onClick={() => setStatus(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
        <p className="plab-library__count" role="status">
          {notice || (found.length ? `${found.length.toLocaleString('es-ES')} ${found.length === 1 ? 'libro' : 'libros'}${shown < found.length ? `, ${shown.toLocaleString('es-ES')} cargados` : ''}` : sorted.length ? 'Ningún libro coincide' : 'Aún no hay libros')}
        </p>
      </header>
      <div ref={list} className="plab-library__list">
        <ul style={{ height: shown * ROW_H }}>{rows}</ul>
        {shown < found.length && (
          <button type="button" className="px-btn plab-library__more" onClick={() => setCount((c) => Math.min(found.length, c + BLOCK))}>
            Cargar {Math.min(BLOCK, found.length - shown)} más
          </button>
        )}
      </div>
    </section>
  );
}
