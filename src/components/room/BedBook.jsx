// Primer plano de la habitación (SPEC §38): el libro abierto grande sobre la cama con la lectura actual, la
// cabecera «Mi rincón» y los accesos de papel a la biblioteca y al diario. Todo va en la capa en píxeles de
// pantalla del escenario (fuera del lienzo escalado): la ilustración del libro es solo fondo (`libro-abierto.webp`,
// páginas en blanco) y el texto, el progreso y «Registrar lectura» son interfaz real encima. El libro no altera el
// progreso al abrirse: solo lee el libro y sus datos.
import { BookOpen, PenLine, Plus } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { formatPercent, percentRead, trackUnit } from '../../domain/books';
import { asset, HOTSPOTS } from '../../scene/sceneMap';
import { toScreen } from '../../scene/stageFit';

const BOOK_ART = asset('assets/room/libro-abierto.webp');
/** Proporción del recurso recortado (1200 × 595). */
const BOOK_RATIO = 1200 / 595;
/** Por debajo de esta altura de panel (móvil en horizontal) el libro grande no cabe legible: se usa el de la escena. */
export const BED_BOOK_MIN_H = 520;

/**
 * Ancho del libro en pantalla (1.48, SPEC §46): ≈ 90 % del panel, anclado a la derecha y apoyado en el edredón, para
 * que los cascos pintados a la izquierda sigan viéndose; con tope por altura y en escritorio.
 */
export function bedBookWidth(fit) {
  return Math.round(Math.min(fit.panelW * 0.9, 600, fit.panelH * 0.3 * BOOK_RATIO));
}

/** Alto del libro y su borde superior en pantalla (para que «Mi diario» no lo pise). */
export const bedBookHeight = (fit) => Math.round(bedBookWidth(fit) / BOOK_RATIO);
export const bedBookTop = (fit) => fit.panelH - bedBookHeight(fit) - 4;

/** Datos de «Por donde vas» sin inventar cifras: sin total no hay porcentaje, barra ni páginas restantes. */
export function bedProgress(book) {
  if (book.status === 'abandoned') {
    // Se conserva y se muestra dónde se dejó; sin barra que lo presente como una lectura en curso
    const at = trackUnit(book) === 'percent' ? formatPercent(percentRead(book)) : `Página ${Number.isFinite(book.currentPage) ? book.currentPage : 0}`;
    return { main: at, secondary: book.pageCount && trackUnit(book) !== 'percent' ? `de ${book.pageCount}` : '', fraction: null, rest: 'Lo dejaste a medias' };
  }
  if (book.status === 'read') return { main: 'Terminado', secondary: book.pageCount ? `${book.pageCount} páginas` : '', fraction: 1, rest: 'Lectura terminada' };
  if (trackUnit(book) === 'percent') {
    const pct = percentRead(book);
    if (!Number.isFinite(pct)) return { main: 'En curso', secondary: '', fraction: null, rest: '' };
    return { main: formatPercent(pct), secondary: 'leído', fraction: pct / 100, rest: '' };
  }
  const page = Number.isFinite(book.currentPage) ? book.currentPage : 0;
  if (!book.pageCount) return { main: `Página ${page}`, secondary: 'Sin total de páginas', fraction: null, rest: '' };
  const left = Math.max(0, book.pageCount - page);
  return {
    main: `Página ${page}`,
    secondary: `de ${book.pageCount} · ${formatPercent(percentRead(book))}`,
    fraction: Math.min(1, page / book.pageCount),
    rest: left === 0 ? 'Estás en la última página' : `Te quedan ${left} ${left === 1 ? 'página' : 'páginas'}`,
  };
}

export function BedBook({ book, fit, onOpenBook, onLog, onChoose, pressed = false, hidden = false }) {
  const w = bedBookWidth(fit);
  // Anclado a la derecha con una pequeña sangría (como apoyado en la cama, no flotando delante)
  const style = { width: w, height: Math.round(w / BOOK_RATIO), left: Math.round(fit.panelW - w * 0.97), '--bw': `${w}px` };
  const art = (
    <>
      <span className="bed-book__contact" aria-hidden="true" />
      <span className="bed-book__art" style={{ backgroundImage: `url(${BOOK_ART})` }} aria-hidden="true" />
    </>
  );
  if (!book) {
    return (
      <section className="bed-book" data-state="empty" style={style} data-compact={w < 360 || undefined} aria-label="Tu lectura actual" inert={hidden || undefined} aria-hidden={hidden || undefined}>
        {art}
        <div className="bed-book__page bed-book__page--left">
          <span className="bed-book__kicker">Tu lectura actual</span>
          <b className="bed-book__title" data-size="medium">
            Ningún libro abierto
          </b>
        </div>
        <div className="bed-book__page bed-book__page--right">
          <span className="bed-book__kicker">Por donde vas</span>
          <span className="bed-book__secondary">Elige qué quieres leer</span>
          <button type="button" className="bed-book__action" onClick={onChoose}>
            <BookOpen aria-hidden="true" /> Elegir un libro
          </button>
        </div>
      </section>
    );
  }
  const title = book.title || 'Sin título';
  const progress = bedProgress(book);
  const size = title.length > 52 ? 'long' : title.length > 24 ? 'medium' : 'short';
  // Terminada o abandonada: se ofrece elegir otra lectura (sin escoger una por su cuenta)
  const finished = book.status === 'read' || book.status === 'abandoned';
  const kicker = book.status === 'abandoned' ? 'Lectura abandonada' : 'Tu lectura actual';
  return (
    <section key={book.id} className="bed-book" data-state={book.status === 'abandoned' ? 'abandoned' : finished ? 'finished' : 'reading'} data-pressed={pressed || undefined} style={style} data-compact={w < 360 || undefined} aria-label="Tu lectura actual" inert={hidden || undefined} aria-hidden={hidden || undefined}>
        {art}
      {/* Página izquierda: abre la ficha del libro (toda la página es el objetivo táctil) */}
      <button type="button" className="bed-book__page bed-book__page--left" onClick={() => onOpenBook(book)} aria-label={`${kicker}: ${title}${book.author ? `, de ${book.author}` : ''}. Abrir su ficha`}>
        <span className="bed-book__kicker" aria-hidden="true">
          {kicker}
        </span>
        <b className="bed-book__title" data-size={size} aria-hidden="true">
          {title}
        </b>
        {book.author && (
          <span className="bed-book__author" aria-hidden="true">
            {book.author}
          </span>
        )}
      </button>
      <div className="bed-book__page bed-book__page--right">
        <span className="bed-book__kicker">Por donde vas</span>
        <span className="bed-book__progress">{progress.main}</span>
        {progress.secondary && <span className="bed-book__secondary">{progress.secondary}</span>}
        {progress.fraction != null && (
          <span className="bed-book__meter" role="progressbar" aria-label="Progreso de lectura" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.fraction * 100)}>
            <i style={{ width: `${progress.fraction * 100}%` }} />
          </span>
        )}
        {progress.rest && <span className="bed-book__rest">{progress.rest}</span>}
        {finished ? (
          <button type="button" className="bed-book__action" onClick={onChoose}>
            <BookOpen aria-hidden="true" /> Elegir otra lectura
          </button>
        ) : (
          <button type="button" className="bed-book__action" onClick={() => onLog(book)}>
            <Plus aria-hidden="true" /> Registrar lectura
          </button>
        )}
      </div>
    </section>
  );
}

/** Cabecera discreta de la habitación (sin barra de estado falsa: respeta el área segura superior). */
export function RoomHeader({ panelW }) {
  // Si el título no cabe a la izquierda de la esquina (Ambiente, Guías, cuenta), pasa a una segunda fila: así el
  // subtítulo nunca queda debajo de los controles, también con el texto ampliado
  const ref = useRef(null);
  const [layout, setLayout] = useState({ rows: 1, max: null });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => {
      const corner = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--room-corner-w')) || 0;
      const free = panelW - corner - 16 - 12 - 14;
      const h2 = el.querySelector('h2');
      const need = h2 ? h2.scrollWidth : 0;
      setLayout((prev) => {
        const next = need > free ? { rows: 2, max: null } : { rows: 1, max: Math.floor(free) };
        return prev.rows === next.rows && prev.max === next.max ? prev : next;
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const corner = document.querySelector('.room-corner');
    if (corner) ro.observe(corner);
    return () => ro.disconnect();
  }, [panelW]);
  return (
    <header ref={ref} className="room-header" data-rows={layout.rows} style={layout.max ? { '--room-header-max': `${layout.max}px` } : undefined}>
      <h2>Mi rincón</h2>
      <p>La biblioteca junto al mar</p>
    </header>
  );
}

/**
 * Accesos legibles y siempre visibles (con o sin guías), cada uno colgado del borde de su mueble y orientado como
 * esa superficie (1.48, SPEC §46): «Mi biblioteca» del frente de la balda de los libros (que baja ≈ 8° hacia la
 * derecha) y «Mi diario» del borde de la mesa junto al portátil (≈ 12°). Ancla y ángulo salen de `HOTSPOTS.*.plaque`;
 * la posición se proyecta con la cámara del escenario y se mantiene dentro del panel.
 */
const PLAQUE_W = { shelf: 124, diary: 104 };
export function RoomNavPlaques({ fit, bookTop, onOpenShelf, onOpenDiary }) {
  const clampX = (x, w) => Math.max(8, Math.min(fit.panelW - w - 8, x));
  // Si el encuadre recorta el mueble (escritorio, horizontal), el acceso se queda en el borde visible más cercano
  const clampY = (y) => Math.max(60, Math.min(fit.panelH - 110, y));
  const place = (id, w, maxTop) => {
    // Ancla en su superficie; si el encuadre la deja fuera, la superficie alternativa del mismo mueble (sin flotar)
    const first = HOTSPOTS[id].plaque;
    const alt = HOTSPOTS[id].plaqueAlt;
    const p = alt && toScreen(fit, first.x, first.y).y < 60 ? alt : first;
    const at = toScreen(fit, p.x, p.y);
    return { left: clampX(at.x, w), top: Math.min(clampY(at.y), maxTop ?? Infinity), transform: `rotate(${p.angle ?? 0}deg)` };
  };
  // El diario no pisa el libro de la cama (su esquina derecha baja con el giro)
  const diaryMax = (bookTop ?? fit.panelH) - 44 - Math.sin(((HOTSPOTS.laptop.plaque.angle ?? 0) * Math.PI) / 180) * PLAQUE_W.diary - 4;
  return (
    <>
      <button type="button" className="room-plaque" data-id="shelf" style={place('shelf', PLAQUE_W.shelf)} onClick={onOpenShelf}>
        <BookOpen aria-hidden="true" />
        <span>Mi biblioteca</span>
        <i aria-hidden="true">›</i>
      </button>
      <button type="button" className="room-plaque" data-id="diary" style={place('laptop', PLAQUE_W.diary, diaryMax)} onClick={onOpenDiary}>
        <PenLine aria-hidden="true" />
        <span>Mi diario</span>
        <i aria-hidden="true">›</i>
      </button>
    </>
  );
}
