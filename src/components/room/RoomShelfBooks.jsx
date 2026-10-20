// El mueble izquierdo de la habitación con doble integración (SPEC §7.2, 1.14.0). Cada balda es un rectángulo
// local proyectado con `perspective` + `matrix3d` sobre el cuadrilátero medido de la ilustración:
// - Arriba (las dos baldas sobre las postales): la vitrina con las figuras que tienes, en caja o en peana,
//   con la sombra del tablón, el sol de la tarde en su lado derecho y la hiedra y las hojas por delante.
// - Abajo (la balda bajo la cámara, junto a la vela): los lomos reales de lo que lees y de tus favoritos, con
//   su textura de edición, la luz parpadeante de la vela por la izquierda y la sombra del estante de encima.
import { useEffect, useMemo, useState } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { rankOf } from '../../domain/figures';
import { sprayedEdge, spineColor, spineHeight, spineWidth } from '../../domain/books';
import { projectPoint, rectToQuad } from '../../scene/homography';
import { IVY_REGION, PLANTS, ROOM_SHELVES, SCENE_H, SCENE_SRC, SCENE_W, pts } from '../../scene/sceneMap';
import { FigureArt, FigureParticles, figureAspect } from '../figures/FigureArt';
import { useFigureCatalog } from '../figures/figureCatalog';
import { IVY_SWAY, LEAF_ALPHA, LEAF_KEY, PLANT_SWAY, SwayFilter } from './SceneLayers';

const GAP = 0.6;
const shelfOf = (id) => ROOM_SHELVES.find((s) => s.id === id);

/** Lomos de la balda de la vela: primero lo que estás leyendo (el de la cama delante), luego tus favoritos. */
function spinesFor(books, currentId) {
  const shelf = shelfOf('cabinet');
  const reading = books.filter((b) => b.status === 'reading').sort((a, b) => (a.id === currentId ? -1 : b.id === currentId ? 1 : 0));
  const favorites = books.filter((b) => b.favorite && b.status !== 'reading');
  const items = [];
  let used = 3;
  for (const book of [...reading, ...favorites]) {
    const w = spineWidth(book.pageCount, 0.026, 7);
    if (used + w > shelf.width - 2) break;
    items.push({ book, w, x: used });
    used += w + GAP;
  }
  return { shelf, items, used };
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
  const { shelf, items, used } = useMemo(() => spinesFor(books, currentId), [books, currentId]);
  const reducedMotion = useReducedMotion();
  const [peek, setPeek] = useState(null);

  useEffect(() => {
    if (!active || reducedMotion || items.length === 0) return undefined;
    const ids = items.map((i) => i.book.id);
    const id = setInterval(() => {
      setPeek((current) => {
        let next = ids[Math.floor(Math.random() * ids.length)];
        if (next === current && ids.length > 1) next = ids[(ids.indexOf(next) + 1) % ids.length];
        return next;
      });
    }, PEEK_MS);
    return () => clearInterval(id);
  }, [active, reducedMotion, items]);

  return (
    <div className="room-shelves" data-awake={awake} aria-label="Lo que lees y tus favoritos, en la balda de la vela">
      <div className="room-shelf" data-shelf="cabinet" style={{ width: shelf.width, height: shelf.height, transform: rectToQuad(shelf.width, shelf.height, shelf.quad) }}>
        {/* El fondo oscuro solo llega hasta el último libro: a su lado siguen los libros pintados */}
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
        {/* Sombra del estante de la cámara y resplandor de la vela que entra por la izquierda */}
        <span className="room-shelf__shade" aria-hidden="true" />
        <span className="room-shelf__candle" aria-hidden="true" />
        <span className="room-shelf__light" style={{ width: Math.min(shelf.width, used + 2) }} />
      </div>
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
              const h = shelf.height * (entry.display === 'unboxed' ? 0.86 : 0.84);
              const w = Math.min(cell - 8, h * figureAspect(fig, entry.display));
              const x = cell * (i + 0.5) - w / 2;
              const anchor = projectPoint(shelf.width, shelf.height, shelf.quad, x + w / 2, shelf.height - h);
              const label = { id: `fig-${fig.id}`, x: anchor.x, y: anchor.y - 4, title: fig.name, text: `${fig.sagaTitle} · ${'★'.repeat(rank)}`, meta: 'Toca: El Ático del Coleccionista' };
              return (
                <button
                  key={fig.id}
                  type="button"
                  className="room-figure"
                  data-display={entry.display}
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
                  <FigureArt fig={fig} display={entry.display} />
                  {rank >= 3 && <FigureParticles kind={fig.particles} strong={rank >= 5} />}
                  <span className="room-figure__sun" aria-hidden="true" />
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

/** Oclusión frontal (z-30): la hiedra y las hojas pintadas, ya mecidas por la brisa, por delante de figuras y libros. */
export function RoomOcclusion() {
  const [top, middle, cabinet] = ROOM_SHELVES;
  return (
    <svg className="room-occlusion" viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} width={SCENE_W} height={SCENE_H} aria-hidden="true">
      <defs>
        <SwayFilter id="f-ivy-front" region={IVY_REGION} keyMatrix={LEAF_KEY} freq={IVY_SWAY.freq} amp={IVY_SWAY.amp} dur={IVY_SWAY.dur} seed="3" outAlpha={LEAF_ALPHA} />
        <SwayFilter id="f-plant-front" region={PLANTS.left} keyMatrix={LEAF_KEY} freq={PLANT_SWAY.freq} amp={PLANT_SWAY.amp} dur={PLANT_SWAY.dur} seed="13" outAlpha={LEAF_ALPHA} />
        <filter id="f-leaf-front" x="0" y="0" width="1" height="1" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values={`1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  ${LEAF_ALPHA}`} />
          <feComponentTransfer>
            <feFuncA type="linear" slope="1.6" intercept="-0.1" />
          </feComponentTransfer>
        </filter>
        <clipPath id="clip-shelves-ivy">
          <polygon points={pts(top.quad)} />
          <polygon points={pts(middle.quad)} />
        </clipPath>
        <clipPath id="clip-shelf-cabinet">
          <polygon points={pts(cabinet.quad)} />
        </clipPath>
      </defs>
      {/* Baldas altas: la hiedra de la derecha y las hojas de la maceta pasan por delante de las figuras */}
      <g clipPath="url(#clip-shelves-ivy)">
        <g filter="url(#f-ivy-front)">
          <image href={SCENE_SRC} width={SCENE_W} height={SCENE_H} />
        </g>
      </g>
      <g clipPath="url(#clip-shelf-cabinet)">
        <image href={SCENE_SRC} width={SCENE_W} height={SCENE_H} filter="url(#f-leaf-front)" />
        <g filter="url(#f-plant-front)">
          <image href={SCENE_SRC} width={SCENE_W} height={SCENE_H} />
        </g>
      </g>
    </svg>
  );
}
