// El mueble de la habitación con doble integración (SPEC §7.2 y §16.7). Cada balda es un rectángulo local
// proyectado (`rectToQuad`) sobre el cuadrilátero medido en la ilustración nueva, una sola vez:
// - Las dos baldas de arriba del hueco derecho: la vitrina con las figuras que tienes (desprecintadas si hay
//   recurso con transparencia; si no, su caja recortada), con la sombra del tablón.
// - Las dos baldas de abajo: los lomos reales de lo que lees y de tus favoritos.
// Fase 1: sin la oclusión de hiedra heredada (recortaba la ilustración anterior).
import { useEffect, useMemo, useState } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { rankOf } from '../../domain/figures';
import { sprayedEdge, spineColor, spineHeight, spineWidth } from '../../domain/books';
import { projectPoint, rectToQuad } from '../../scene/homography';
import { ROOM_SHELVES } from '../../scene/sceneMap';
import { FigureArt, figureAspect } from '../figures/FigureArt';
import { canUnbox, shownDisplay } from '../figures/figureDisplay';
import { useFigureCatalog } from '../figures/figureCatalog';

const GAP = 0.6;
const shelfOf = (id) => ROOM_SHELVES.find((s) => s.id === id);

const BOOK_SHELVES = ['cabinet', 'cabinet2'];

/** Lomos de las dos baldas bajas: primero lo que estás leyendo, luego tus favoritos; lo que no cabe, a la siguiente. */
function spinesFor(books, currentId) {
  const reading = books.filter((b) => b.status === 'reading').sort((a, b) => (a.id === currentId ? -1 : b.id === currentId ? 1 : 0));
  const favorites = books.filter((b) => b.favorite && b.status !== 'reading');
  const queue = [...reading, ...favorites];
  return BOOK_SHELVES.map((id) => {
    const shelf = shelfOf(id);
    const items = [];
    let used = 3;
    while (queue.length) {
      const w = spineWidth(queue[0].pageCount, 0.026, 7);
      if (used + w > shelf.width - 2) break;
      items.push({ book: queue.shift(), w, x: used });
      used += w + GAP;
    }
    return { shelf, items, used };
  });
}

/** Hasta 3 figuras por balda; con pocas, se reparten entre las dos baldas. */
const PER_SHELF = 3;
function layoutFigures(figs) {
  const topCount = Math.min(PER_SHELF, Math.ceil(figs.length / 2));
  const groups = { top: figs.slice(0, topCount), middle: figs.slice(topCount, topCount + PER_SHELF) };
  return groups;
}

/** Cada pocos segundos un libro asoma un poco de la balda, como si alguien lo hubiera rozado. */
const PEEK_MS = 2600;

export function RoomShelfBooks({ books, currentId, onOpenShelf, onHover, awake = false, active = true }) {
  const rows = useMemo(() => spinesFor(books, currentId), [books, currentId]);
  const reducedMotion = useReducedMotion();
  const [peek, setPeek] = useState(null);
  const ids = useMemo(() => rows.flatMap((r) => r.items.map((i) => i.book.id)), [rows]);

  useEffect(() => {
    if (!active || reducedMotion || ids.length === 0) return undefined;
    const id = setInterval(() => {
      setPeek((current) => {
        let next = ids[Math.floor(Math.random() * ids.length)];
        if (next === current && ids.length > 1) next = ids[(ids.indexOf(next) + 1) % ids.length];
        return next;
      });
    }, PEEK_MS);
    return () => clearInterval(id);
  }, [active, reducedMotion, ids]);

  return (
    <div className="room-shelves" data-awake={awake} aria-label="Lo que lees y tus favoritos, en las baldas de abajo">
      {rows.map(({ shelf, items, used }) =>
        items.length ? (
          <div key={shelf.id} className="room-shelf" data-shelf={shelf.id} style={{ width: shelf.width, height: shelf.height, transform: rectToQuad(shelf.width, shelf.height, shelf.quad) }}>
            <span className="room-shelf__back" style={{ width: Math.min(shelf.width, used + 2) }} />
            {items.map(({ book, w, x }, index) => {
              const h = Math.min(shelf.height - 4, shelf.height * 0.86 * spineHeight(book));
              const anchor = projectPoint(shelf.width, shelf.height, shelf.quad, x + w / 2, shelf.height - h);
              const label = { id: `spine-${book.id}`, x: anchor.x, y: anchor.y - 6, title: book.title, text: 'Toca para ver tu librería', meta: 'Mi librería de roble' };
              return (
                <button
                  key={book.id}
                  type="button"
                  className="room-spine"
                  data-status={book.status}
                  data-edition={book.editionType}
                  data-edge={sprayedEdge(book) || undefined}
                  data-peek={peek === book.id}
                  style={{ left: x, width: w, height: h, '--spine': spineColor(book), '--i': index }}
                  aria-label={`${book.title}, de ${book.author}. Ver tu librería`}
                  onClick={(event) => {
                    // Cualquier libro de la habitación te lleva a la librería completa
                    event.stopPropagation();
                    onOpenShelf();
                  }}
                  onPointerEnter={() => onHover(label)}
                  onPointerLeave={() => onHover(null)}
                  onFocus={() => onHover(label)}
                  onBlur={() => onHover(null)}
                >
                  <span className="room-spine__bands" />
                  {book.editionType === 'leatherbound' && (
                    <span className="room-spine__nerves" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                      <i />
                    </span>
                  )}
                  {book.status === 'reading' && <span className="room-spine__ribbon" />}
                </button>
              );
            })}
            <span className="room-shelf__shade" aria-hidden="true" />
          </div>
        ) : null,
      )}
    </div>
  );
}

/** La vitrina: las dos baldas superiores, forradas de roble en penumbra, con tus figuras (tocar → El Ático). */
export function RoomFigureShelves({ figures, onOpenVault, onHover }) {
  const catalog = useFigureCatalog();
  // El Guardián primero, luego el resto por orden de llegada
  const groups = useMemo(() => {
    const owned = catalog.filter((f) => figures.owned[f.id]);
    owned.sort((a, b) => (a.id === figures.guardian ? -1 : b.id === figures.guardian ? 1 : (figures.owned[a.id].obtainedAt || '').localeCompare(figures.owned[b.id].obtainedAt || '')));
    return layoutFigures(owned);
  }, [catalog, figures]);

  return (
    <div className="room-figures" aria-label="Vitrina de tus figuras de coleccionista">
      {['top', 'middle'].map((id) => {
        const shelf = shelfOf(id);
        const list = groups[id];
        const cell = shelf.width / Math.max(1, list.length);
        return (
          <div
            key={id}
            className="room-shelf room-shelf--figures"
            data-shelf={id}
            style={{ width: shelf.width, height: shelf.height, transform: rectToQuad(shelf.width, shelf.height, shelf.quad) }}
            onClick={() => onOpenVault()}
          >
            {/* Roble en penumbra cálida con luz lateral del balcón: tapa los libros y el cuadro pintados */}
            <span className="room-shelf__oak" aria-hidden="true" />
            {list.map((fig, i) => {
              const entry = figures.owned[fig.id];
              const rank = rankOf(fig.parts.length, entry);
              // En la habitación se ve la figura desprecintada cuando tiene recurso con transparencia
              const display = canUnbox(fig) ? 'unboxed' : shownDisplay(fig, entry.display);
              const h = shelf.height * (display === 'unboxed' ? 0.86 : 0.84);
              const w = Math.min(cell - 8, h * figureAspect(fig, display));
              const x = cell * (i + 0.5) - w / 2;
              const anchor = projectPoint(shelf.width, shelf.height, shelf.quad, x + w / 2, shelf.height - h);
              const label = { id: `fig-${fig.id}`, x: anchor.x, y: anchor.y - 4, title: fig.name, text: `${fig.sagaTitle} · ${'★'.repeat(rank)}`, meta: 'Toca: El Ático del Coleccionista' };
              return (
                <button
                  key={fig.id}
                  type="button"
                  className="room-figure"
                  data-display={display}
                  style={{ left: x, width: w, height: h }}
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenVault(fig.id);
                  }}
                  onPointerEnter={() => onHover(label)}
                  onPointerLeave={() => onHover(null)}
                  onFocus={() => onHover(label)}
                  onBlur={() => onHover(null)}
                  aria-label={`${fig.name}: abrir El Ático del Coleccionista`}
                >
                  <span className="room-figure__contact" aria-hidden="true" />
                  <FigureArt fig={fig} display={display} />
                </button>
              );
            })}
            {/* Sombra interior del tablón de encima */}
            <span className="room-shelf__inset" aria-hidden="true" />
          </div>
        );
      })}
    </div>
  );
}
