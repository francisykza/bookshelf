// Vistas de la visita (SPEC §56; 1.61, §61): «Los libros de X» (biblioteca frontal con las baldas y el libro físico de
// la biblioteca propia, buscador y nada de edición) y la ficha de un libro compartido. Son referencias públicas de OTRA
// persona: nunca se abre su ficha con BookDetailModal ni con un id de la biblioteca propia; lo único que se puede hacer
// es «Añadir a pendientes», de forma explícita.
import { ArrowLeft, Search, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ReaderAvatar } from '../../../components/avatars/ReaderAvatar';
import { PhysicalBook } from '../../../components/shelf/BookItem';
import { normalizeText } from '../../../domain/figureCatalog';
import { ReviewCard } from '../../reviews/ReadersPanel';
import { reviewsFor } from '../visit';
import { AddToPending } from './AddToPending';

/** Libro público como objeto físico (sin edición inventada: tapa dura neutra, como en el perfil). */
const asBook = (ref, key) => ({ id: key, title: ref.title, author: ref.author ?? '', cover: ref.cover ?? '', editionType: 'hardcover' });

function SheetHead({ title, onBack, backLabel }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return (
    <header className="reader-visit__sheet-head">
      <button type="button" className="reader-visit__icon" onClick={onBack} aria-label={backLabel}>
        <ArrowLeft aria-hidden="true" />
      </button>
      <h3 ref={ref} tabIndex={-1}>
        {title}
      </h3>
    </header>
  );
}

/** Filas a partir de las cuales solo se montan las cercanas a la vista (las demás: la misma balda, vacía y con su alto). */
const VIRTUAL_FROM = 12;
/** Margen de filas montadas por encima y por debajo de la vista, en pantallas. */
const OVERSCAN = 1.5;

const plural = (n) => `${n} ${n === 1 ? 'libro compartido' : 'libros compartidos'}`;

/**
 * «Los libros de X»: lo que esa persona comparte (destacados, los que le representan, lecturas, recuerdos y colecciones
 * visibles; nunca su biblioteca privada), de tres en tres en el móvil sobre las baldas de la biblioteca. Todo llega
 * completo en una sola consulta (no hay paginación), así que el número es el total real. Con muchas filas solo se
 * montan las cercanas a la vista. Sigue montada bajo la ficha de un libro: búsqueda y posición se conservan.
 */
export function SharedLibrary({ items, alias, profile, reviews, openKey, onOpenBook, onBack }) {
  const [query, setQuery] = useState('');
  const scrollerRef = useRef(null);
  const headRef = useRef(null);
  // Sin tildes, mayúsculas ni signos («saint exupery» encuentra «Saint-Exupéry»)
  const needle = normalizeText(query);
  const shown = useMemo(() => (needle ? items.filter((it) => normalizeText(`${it.ref.title} ${it.ref.author ?? ''}`).includes(needle)) : items), [items, needle]);
  const [cols, setCols] = useState(() => (window.innerWidth > 760 ? 5 : 3));
  useEffect(() => {
    const onResize = () => setCols(window.innerWidth > 760 ? 5 : 3);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const lines = useMemo(() => {
    const out = [];
    for (let i = 0; i < shown.length; i += cols) out.push(shown.slice(i, i + cols));
    return out;
  }, [shown, cols]);

  // Filas virtuales: alto de una fila (todas miden igual: el hueco del libro es 2:3) y lo que se ve del desplazamiento
  const virtual = lines.length > VIRTUAL_FROM;
  const [rowH, setRowH] = useState(0);
  const [view, setView] = useState({ top: 0, height: 800 });
  const listRef = useRef(null);
  useLayoutEffect(() => {
    const first = listRef.current?.querySelector(':scope > .lib-shelf');
    const h = first?.offsetHeight ?? 0;
    if (h && Math.abs(h - rowH) > 0.5) setRowH(h);
  });
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !virtual) return undefined;
    let frame = 0;
    const read = () => {
      frame = 0;
      const top = el.scrollTop - (listRef.current?.offsetTop ?? 0);
      setView((v) => (Math.abs(v.top - top) < 40 && v.height === el.clientHeight ? v : { top, height: el.clientHeight }));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    read();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('scroll', onScroll);
    };
  }, [virtual]);
  const win = (() => {
    if (!virtual || !rowH) return { first: 0, last: virtual ? 1 : lines.length - 1 };
    const margin = view.height * OVERSCAN;
    return { first: Math.max(0, Math.floor((view.top - margin) / rowH)), last: Math.min(lines.length - 1, Math.ceil((view.top + view.height + margin) / rowH)) };
  })();

  // Al cerrar la ficha, el foco vuelve al libro que se abrió (si sigue montado) y, si no, a la cabecera
  const lastOpen = useRef(null);
  useEffect(() => {
    if (openKey) {
      lastOpen.current = openKey;
      return;
    }
    if (!lastOpen.current) {
      headRef.current?.focus({ preventScroll: true });
      return;
    }
    const btn = scrollerRef.current?.querySelector(`[data-key="${CSS.escape(lastOpen.current)}"]`);
    (btn ?? headRef.current)?.focus({ preventScroll: true });
  }, [openKey]);

  return (
    <section className="reader-visit__library" role="dialog" aria-modal="true" aria-label={`Libros compartidos por ${alias}`} inert={openKey ? true : undefined}>
      <div ref={scrollerRef} className="reader-visit__library-scroll">
        <header className="reader-visit__library-head">
          <div className="reader-visit__library-row">
            <button type="button" className="reader-visit__back" onClick={onBack}>
              <ArrowLeft aria-hidden="true" />
              <span>Volver al rincón</span>
            </button>
            <div className="reader-visit__library-who">
              <ReaderAvatar avatarId={profile?.avatar_id} alias={alias} size="list" decorative />
              <span>
                <h3 ref={headRef} tabIndex={-1}>
                  Los libros de {alias}
                </h3>
                <small role="status">{needle ? `${shown.length} de ${plural(items.length)}` : plural(items.length)}</small>
              </span>
            </div>
          </div>
          {items.length > 0 && (
            <label className="reader-visit__search">
              <Search aria-hidden="true" />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar en sus libros" aria-label="Buscar en sus libros" enterKeyHint="search" autoComplete="off" />
              {query && (
                <button type="button" onClick={() => setQuery('')} aria-label="Limpiar la búsqueda">
                  <X aria-hidden="true" />
                </button>
              )}
            </label>
          )}
        </header>

        <div ref={listRef} className="reader-visit__shelves" style={{ '--cols': cols }}>
          {!items.length && <p className="reader-visit__empty">{alias} aún no ha compartido libros.</p>}
          {items.length > 0 && !shown.length && <p className="reader-visit__empty">Ningún libro suyo coincide con «{query.trim()}».</p>}
          {lines.map((line, li) =>
            li >= win.first && li <= win.last ? (
              <div key={li} className="lib-shelf">
                <div className="lib-shelf__books">
                  {line.map((it) => (
                    <span key={it.key} className="reader-visit__slot">
                      <PhysicalBook
                        book={asBook(it.ref, it.key)}
                        variant="shelf"
                        type="button"
                        data-key={it.key}
                        onClick={() => onOpenBook(it.key)}
                        aria-label={`${it.ref.title}${it.ref.author ? `, de ${it.ref.author}` : ''}`}
                      />
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div key={li} className="lib-shelf lib-shelf--ghost" style={{ height: rowH || undefined }} aria-hidden="true" />
            ),
          )}
        </div>

        {reviews.length > 0 && (
          <section className="reader-visit__reviews" aria-label="Reseñas publicadas">
            <h4>Reseñas publicadas</h4>
            {reviews.map((r) => (
              <div key={r.id} className="reader-profile__review">
                {r.work && <p className="social-hand">{r.work.title}</p>}
                <ReviewCard review={r} author={profile} mine={false} />
              </div>
            ))}
          </section>
        )}
      </div>
    </section>
  );
}

export function VisitBookSheet({ item, alias, profile, reviews, onBack, backLabel = 'Volver a sus libros' }) {
  const own = item ? reviewsFor(reviews, item.ref) : [];
  return (
    <section className="reader-visit__sheet reader-visit__sheet--book" role="dialog" aria-modal="true" aria-label={item ? item.ref.title : 'Libro compartido'}>
      <SheetHead title={item ? item.ref.title : 'Libro compartido'} onBack={onBack} backLabel={backLabel} />
      <div className="reader-visit__sheet-body">
        {item ? (
          <>
            <div className="reader-visit__detail">
              <span className="reader-visit__detail-cover" aria-hidden="true">
                <PhysicalBook book={asBook(item.ref, item.key)} variant="corner" />
              </span>
              <div>
                <p className="reader-visit__detail-title">{item.ref.title}</p>
                {item.ref.author && <p className="reader-visit__detail-author">{item.ref.author}</p>}
                <ul className="reader-visit__origins">
                  {item.origins.map((o) => (
                    <li key={o}>{o}</li>
                  ))}
                </ul>
              </div>
            </div>
            {item.phrase && <blockquote className="reader-visit__phrase">«{item.phrase}»</blockquote>}
            <AddToPending book={item.ref} from={{ kind: 'corner', ownerAlias: alias }} />
            {own.map((r) => (
              <ReviewCard key={r.id} review={r} author={profile} mine={false} />
            ))}
          </>
        ) : (
          <p className="social-note">Este libro ya no está compartido.</p>
        )}
      </div>
    </section>
  );
}
