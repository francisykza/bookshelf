// El mueble de la habitación con doble integración (SPEC §7.2 y §16.7). Cada balda es un rectángulo local
// proyectado (`rectToQuad`) sobre el cuadrilátero medido en la ilustración nueva, una sola vez:
// - Las dos baldas de arriba del hueco derecho: la vitrina con las figuras que tienes (desprecintadas si hay
//   recurso con transparencia; si no, su caja recortada), con la sombra del tablón.
// - Las dos baldas de abajo: los lomos reales de lo que lees y de tus favoritos.
// Fase 1: sin la oclusión de hiedra heredada (recortaba la ilustración anterior).
import { useEffect, useMemo, useState } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { rankOf } from '../../domain/figures';
import { sprayedEdge, spineHeight, spineWidth } from '../../domain/books';
import { projectPoint, rectToQuad } from '../../scene/homography';
import { ROOM_SHELVES, SCENE_H, SCENE_SRC, SCENE_W, SHELF_LIPS, pts } from '../../scene/sceneMap';
import { useCoverColor } from '../../hooks/useCoverColor';
import { useSvgIds } from '../../hooks/useSvgIds';
import { calculateBookPhysics } from '../../utils/vibeEngine';
import { FigureArt, figureAspect } from '../figures/FigureArt';
import { canUnbox, shownDisplay } from '../figures/figureDisplay';
import { useFigureCatalog } from '../figures/figureCatalog';

/** Separación entre lomos en px de la ilustración (≈ 1–2 px CSS en móvil). */
const GAP = 2;
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

/** Tamaño mínimo en pantalla (px CSS) para que el título del lomo se lea; si no, color y marca discreta. */
const TITLE_MIN_W = 11;
const TITLE_MIN_H = 48;

/**
 * Un lomo físico (SPEC §19.4): su color (el de la portada cuando se puede, si no el determinista), el material de
 * su edición, canto oscuro a un lado y luz estrecha al otro, textura mate y dorado solo en cuero y tela. Título
 * vertical cuando cabe legible a la escala actual.
 */
function RoomSpine({ book, x, w, h, index, lean, peek, scale, onOpenShelf, onHover, label }) {
  const [color, observe] = useCoverColor(book);
  const physics = calculateBookPhysics(book);
  const showTitle = w * scale >= TITLE_MIN_W && h * scale >= TITLE_MIN_H;
  return (
    <button
      ref={observe}
      type="button"
      className="room-spine"
      data-status={book.status}
      data-edition={book.editionType}
      data-material={physics.material}
      data-foil={physics.goldFoil || undefined}
      data-edge={sprayedEdge(book) || undefined}
      data-peek={peek}
      data-lean={lean || undefined}
      style={{ left: x, width: w, height: h, '--spine': color, '--i': index }}
      aria-label={`${book.title}, de ${book.author}. Ver tu librería`}
      title={book.title}
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
      {physics.goldFoil && <span className="room-spine__bands" />}
      {book.editionType === 'leatherbound' && (
        <span className="room-spine__nerves" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
      )}
      {showTitle && (
        <span className="room-spine__title" aria-hidden="true">
          {book.title}
        </span>
      )}
      {book.status === 'reading' && <span className="room-spine__ribbon" />}
    </button>
  );
}

/** Canto delantero de cada balda de libros, recortado de la propia ilustración: tapa ligeramente la base. */
function ShelfLips() {
  const sid = useSvgIds();
  return (
    <svg className="room-shelf-lips" viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} width={SCENE_W} height={SCENE_H} aria-hidden="true">
      <defs>
        <clipPath clipPathUnits="userSpaceOnUse" id={sid('clip-lips')}>
          {Object.values(SHELF_LIPS).map((poly, i) => (
            <polygon key={i} points={pts(poly)} />
          ))}
        </clipPath>
      </defs>
      <image href={SCENE_SRC} width={SCENE_W} height={SCENE_H} clipPath={sid.url('clip-lips')} />
    </svg>
  );
}

export function RoomShelfBooks({ books, currentId, onOpenShelf, onHover, awake = false, active = true, scale = 1 }) {
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
            {items.map(({ book, w, x }, index) => {
              const h = Math.min(shelf.height - 4, shelf.height * 0.86 * spineHeight(book));
              const anchor = projectPoint(shelf.width, shelf.height, shelf.quad, x + w / 2, shelf.height - h);
              const label = { id: `spine-${book.id}`, x: anchor.x, y: anchor.y - 6, title: book.title, text: 'Toca para ver tu librería', meta: 'Mi librería de roble' };
              // Solo el último de la fila se apoya inclinado, y solo si le sobra sitio a la derecha (sin cruzarse)
              const lean = index === items.length - 1 && shelf.width - used > 8;
              return <RoomSpine key={book.id} book={book} x={x} w={w} h={h} index={index} lean={lean} peek={peek === book.id} scale={scale} onOpenShelf={onOpenShelf} onHover={onHover} label={label} />;
            })}
            <span className="room-shelf__shade" aria-hidden="true" />
          </div>
        ) : null,
      )}
      <ShelfLips />
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
