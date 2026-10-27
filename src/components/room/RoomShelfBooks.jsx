// El mueble de la habitación con doble integración (SPEC §7.2 y §16.7). Cada balda es un rectángulo local
// proyectado (`rectToQuad`) sobre el cuadrilátero medido en la ilustración nueva, una sola vez:
// - Las dos baldas de arriba del hueco derecho: la vitrina con las figuras que tienes (desprecintadas si hay
//   recurso con transparencia; si no, su caja recortada), con la sombra del tablón.
// - Las dos baldas de abajo: los lomos reales de lo que lees y de tus favoritos.
// Fase 1: sin la oclusión de hiedra heredada (recortaba la ilustración anterior).
import { useEffect, useMemo, useState } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { shelfSlots } from '../../domain/figures';
import { EDITIONS, isDevice, sprayedEdge } from '../../domain/books';
import { spineArtSize } from '../../domain/spineArt';
import { projectPoint, rectToQuad } from '../../scene/homography';
import { useSceneArt } from '../../hooks/useSceneArt';
import { ROOM_SHELVES, SCENE_H, SCENE_W, SHELF_LIPS, asset, pts } from '../../scene/sceneMap';
import { useSvgIds } from '../../hooks/useSvgIds';
import { calculateBookPhysics, stableHash } from '../../utils/vibeEngine';
import { FigureArt } from '../figures/FigureArt';
import { useFigureCatalog } from '../figures/figureCatalog';

/** Separación entre lomos en px de la ilustración (≈ 1–2 px CSS en móvil). */
const GAP = 2;
const shelfOf = (id) => ROOM_SHELVES.find((s) => s.id === id);

const BOOK_SHELVES = ['cabinet', 'cabinet2'];

/**
 * Escala física común de las dos baldas (SPEC §20.3): el hueco mide ≈ 28 cm de alto, así que 1 cm son
 * 130 / 28 px de la ilustración en las dos. El tamaño de cada libro sale del motor (`calculateBookPhysics`:
 * grosor relativo y variación de altura) y de su edición (alto y tapas); nunca se encoge para que quepan más.
 */
const PX_PER_CM = 130 / 28;
function spineSize(book, shelfHeight) {
  const physics = calculateBookPhysics(book);
  const edition = EDITIONS[book.editionType] ?? EDITIONS.paperback;
  const cm = isDevice(book) ? (book.editionType === 'kindle' ? 1 : 2.6) : 0.5 + 2.4 * physics.thickness + edition.cm;
  const heightCm = 21.5 * edition.height * (isDevice(book) ? 1 : physics.height);
  return { w: Math.round(cm * PX_PER_CM * 10) / 10, h: Math.min(shelfHeight - 8, Math.round(heightCm * PX_PER_CM)), physics };
}

/**
 * Lomos de las dos baldas bajas: primero lo que estás leyendo, luego tus favoritos; lo que no cabe pasa a la
 * siguiente y, si tampoco, se queda fuera (subconjunto estable: el mismo orden siempre; la librería completa
 * sigue a un toque). No se inventan libros para rellenar huecos.
 */
function spinesFor(books, currentId) {
  const reading = books.filter((b) => b.status === 'reading').sort((a, b) => (a.id === currentId ? -1 : b.id === currentId ? 1 : 0));
  const favorites = books.filter((b) => b.favorite && b.status !== 'reading');
  const queue = [...reading, ...favorites];
  return BOOK_SHELVES.map((id) => {
    const shelf = shelfOf(id);
    const items = [];
    let used = 3;
    while (queue.length) {
      const size = spineSize(queue[0], shelf.height);
      if (used + size.w > shelf.width - 2) break;
      items.push({ book: queue.shift(), ...size, x: used });
      used += size.w + GAP;
    }
    return { shelf, items, used };
  });
}

/** Hasta 3 figuras por balda; con pocas, se reparten entre las dos baldas. */

/** Cada pocos segundos un libro asoma un poco de la balda, como si alguien lo hubiera rozado. */
const PEEK_MS = 2600;

/** Tamaño mínimo en pantalla (px CSS) para que el título del lomo se lea; si no, color y marca discreta. */
const TITLE_MIN_W = 11;
const TITLE_MIN_H = 48;

/**
 * Lomos ilustrados (SPEC §23.3): doce texturas gouache recortadas de la lámina «Colección de doce lomos en
 * gouache-1» (relieves, nervios y ornamentos ya pintados). `ratio` = ancho / alto de la textura; `ink`, la tinta
 * del título según la luminancia medida de cada una (oscura en las claras, crema en las oscuras).
 */
const SPINE_ART = [
  { ratio: 0.1861, ink: 'light' },
  { ratio: 0.1889, ink: 'dark' },
  { ratio: 0.1833, ink: 'light' },
  { ratio: 0.1944, ink: 'light' },
  { ratio: 0.1889, ink: 'dark' },
  { ratio: 0.1944, ink: 'light' },
  { ratio: 0.1944, ink: 'light' },
  { ratio: 0.1861, ink: 'light' },
  { ratio: 0.1889, ink: 'dark' },
  { ratio: 0.1889, ink: 'dark' },
  { ratio: 0.2111, ink: 'light' },
  { ratio: 0.1722, ink: 'dark' },
].map((art, i) => ({ ...art, src: asset(`images/room-refresh/lomos/web/lomo-${String(i + 1).padStart(2, '0')}.webp`) }));
/**
 * Un lomo ilustrado (SPEC §23.3): textura gouache elegida de forma determinista por el id del libro, con el
 * tamaño del libro y su edición (`spineSize`), título en Lora cuando se lee a la escala actual y una sombra de
 * contacto cálida. Los e-readers y audiolibros conservan su aspecto de objeto fabricado (sin textura de libro).
 * Si la textura no carga, queda el color determinista del motor.
 */
function RoomSpine({ book, physics, x, w, h, index, lean, peek, scale, onOpenShelf, onHover, label }) {
  const art = isDevice(book) ? null : SPINE_ART[stableHash(`spine:${book.id ?? book.title}`) % SPINE_ART.length];
  const size = art ? spineArtSize(w, h, art.ratio) : null;
  const showTitle = w * scale >= TITLE_MIN_W && h * scale >= TITLE_MIN_H;
  const showAuthor = showTitle && w * scale >= 20 && Boolean(book.author);
  return (
    <button
      type="button"
      className="room-spine"
      data-status={book.status}
      data-edition={book.editionType}
      data-material={physics.material}
      data-art={art ? SPINE_ART.indexOf(art) + 1 : undefined}
      data-ink={art?.ink ?? 'light'}
      data-edge={sprayedEdge(book) || undefined}
      data-peek={peek}
      data-lean={lean || undefined}
      style={{
        left: x,
        width: w,
        height: h,
        '--spine': physics.spineColor,
        '--i': index,
        ...(art ? { backgroundImage: `url(${art.src})`, backgroundSize: `${size.w.toFixed(2)}px ${size.h.toFixed(2)}px` } : null),
      }}
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
      {showTitle && (
        <span className="room-spine__title" aria-hidden="true">
          {book.title}
          {showAuthor && <small>{book.author}</small>}
        </span>
      )}
      {book.status === 'reading' && <span className="room-spine__ribbon" />}
    </button>
  );
}

/** Canto delantero de cada balda de libros, recortado de la propia ilustración: tapa ligeramente la base. */
function ShelfLips() {
  const sid = useSvgIds();
  const { src: sceneSrc } = useSceneArt();
  return (
    <svg className="room-shelf-lips" viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} width={SCENE_W} height={SCENE_H} aria-hidden="true">
      <defs>
        <clipPath clipPathUnits="userSpaceOnUse" id={sid('clip-lips')}>
          {Object.values(SHELF_LIPS).map((poly, i) => (
            <polygon key={i} points={pts(poly)} />
          ))}
        </clipPath>
      </defs>
      <image href={sceneSrc} width={SCENE_W} height={SCENE_H} clipPath={sid.url('clip-lips')} />
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
            {items.map(({ book, physics, w, h, x }, index) => {
              const anchor = projectPoint(shelf.width, shelf.height, shelf.quad, x + w / 2, shelf.height - h);
              const label = { id: `spine-${book.id}`, x: anchor.x, y: anchor.y - 6, title: book.title, text: 'Toca para ver tu librería', meta: 'Mi librería de roble' };
              // Solo el último de la fila se apoya inclinado, y solo si le sobra sitio a la derecha (sin cruzarse)
              const lean = index === items.length - 1 && shelf.width - used > 8;
              return <RoomSpine key={book.id} book={book} physics={physics} x={x} w={w} h={h} index={index} lean={lean} peek={peek === book.id} scale={scale} onOpenShelf={onOpenShelf} onHover={onHover} label={label} />;
            })}
            <span className="room-shelf__shade" aria-hidden="true" />
          </div>
        ) : null,
      )}
      <ShelfLips />
    </div>
  );
}

/**
 * Las dos baldas superiores (SPEC §37): cuatro posiciones, dos por balda, ancladas a la ilustración (px de 941 ×
 * 1672, el mismo mundo escalado que el fondo). Cada objeto conserva su proporción y cabe en el hueco por sus
 * límites visibles (los recursos ya vienen sin márgenes transparentes); se apoya detrás del canto, que tapa su base
 * (recorte por la línea del canto), con una inclinación suave que acompaña la balda sin doblar la perspectiva de las
 * cajas dibujadas en tres cuartos. Tocar un objeto abre su detalle; la madera de alrededor sigue abriendo el Ático.
 */
const lineY = (a, b, x) => a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
/** Parte de la pendiente de la balda que se aplica a los objetos (el resto lo cubre el canto). */
const SKEW_SHARE = 0.5;
// El hueco empieza algo dentro del poste izquierdo: a 360 px el encuadre corta los primeros píxeles de la balda
const SLOT_INSET = { left: 144, right: 326, gap: 6 };

/**
 * Reparto de una balda: con dos objetos, el ancho se reparte según la forma de cada uno (una caja horizontal
 * necesita más que una vertical) y, si no caben a la altura máxima, los dos se reducen por igual; con uno solo,
 * se queda en su mitad con algo más de margen. Devuelve { x, w, h } por posición (px de la ilustración).
 */
function shelfLayout(shelfId, ratios) {
  const { quad } = shelfOf(shelfId);
  const [tl, tr, br, bl] = quad;
  const slope = (br[1] - bl[1]) / (br[0] - bl[0]);
  const avail = SLOT_INSET.right - SLOT_INSET.left;
  const maxH = br[1] - tr[1] - 8;
  const present = ratios.filter(Boolean);
  let items;
  if (present.length === 2) {
    const natural = ratios.map((r) => r * maxH);
    const k = Math.min(1, (avail - SLOT_INSET.gap) / (natural[0] + natural[1]));
    const ws = natural.map((w) => w * k);
    const used = ws[0] + ws[1] + SLOT_INSET.gap;
    const x0 = SLOT_INSET.left + (avail - used) / 2;
    items = [{ x: x0, w: ws[0] }, { x: x0 + ws[0] + SLOT_INSET.gap, w: ws[1] }];
  } else {
    items = ratios.map((r, i) => {
      if (!r) return null;
      const w = Math.min(avail * 0.62, r * maxH);
      const cx = SLOT_INSET.left + avail * (i === 0 ? 0.27 : 0.73);
      return { x: Math.max(SLOT_INSET.left, Math.min(SLOT_INSET.right - w, cx - w / 2)), w };
    });
  }
  return {
    slope,
    clip: quad,
    items: items.map((it, i) => {
      if (!it || !ratios[i]) return null;
      const h = it.w / ratios[i];
      const cx = it.x + it.w / 2;
      return { ...it, h, cx, lip: lineY(bl, br, cx), ceiling: lineY(tl, tr, cx) };
    }),
  };
}

export function RoomFigureShelves({ figures, onOpenFigure, onHover }) {
  const catalog = useFigureCatalog();
  const slots = useMemo(() => shelfSlots(figures, catalog), [catalog, figures]);
  const byId = useMemo(() => new Map(catalog.map((fig) => [fig.id, fig])), [catalog]);
  return (
    <div className="room-figures" aria-label="Figuras expuestas en las baldas">
      {['top', 'middle'].map((shelfId, si) => {
        const pair = [slots[si * 2], slots[si * 2 + 1]].map((slot) => {
          const fig = slot && byId.get(slot.id);
          if (!fig) return null;
          const size = slot.display === 'unboxed' ? fig.unboxedSize : fig.boxSize;
          return { fig, slot, ratio: size.w / size.h };
        });
        const layout = shelfLayout(shelfId, pair.map((p) => p?.ratio ?? null));
        const clip = `polygon(${layout.clip.map(([x, y]) => `${x}px ${y}px`).join(', ')})`;
        return (
          <div key={shelfId} className="room-figures__shelf" data-shelf={shelfId} style={{ clipPath: clip }}>
            {pair.map((item, k) => {
              const box = layout.items[k];
              if (!item || !box) return null;
              const { fig, slot } = item;
              const { w, h } = box;
              const skew = Math.atan(layout.slope * SKEW_SHARE);
              // Lo que el canto tapa de la base: lo justo para que ninguna esquina quede en el aire
              const sink = (layout.slope * (1 - SKEW_SHARE) * w) / 2 + 3;
              const top = box.lip + sink - h;
              const label = { id: `fig-${fig.id}`, x: box.cx, y: top - 4, title: fig.name, text: fig.sagaTitle, meta: 'Toca para verla de cerca' };
              return (
                <button
                  key={fig.id}
                  type="button"
                  className="room-figure"
                  data-display={slot.display}
                  style={{ left: box.x, top, width: w, height: h, '--skew': `${skew}rad` }}
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenFigure(fig.id);
                  }}
                  onPointerEnter={() => onHover(label)}
                  onPointerLeave={() => onHover(null)}
                  onFocus={() => onHover(label)}
                  onBlur={() => onHover(null)}
                  aria-label={`${fig.name}, ${slot.display === 'unboxed' ? 'figura suelta' : 'en su caja'}: ver de cerca`}
                >
                  <FigureArt fig={fig} display={slot.display} />
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
