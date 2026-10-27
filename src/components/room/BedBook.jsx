// Primer plano de la habitación (SPEC §38): el libro abierto grande sobre la cama con la lectura actual, la
// cabecera «Mi rincón» y los accesos de papel a la biblioteca y al diario. Todo va en la capa en píxeles de
// pantalla del escenario (fuera del lienzo escalado): la ilustración del libro es solo fondo (`libro-abierto.webp`,
// páginas en blanco) y el texto, el progreso y «Registrar lectura» son interfaz real encima. El libro no altera el
// progreso al abrirse: solo lee el libro y sus datos.
import { BookOpen, PenLine, Plus } from 'lucide-react';
import { formatPercent, percentRead, trackUnit } from '../../domain/books';
import { asset, HOTSPOTS } from '../../scene/sceneMap';
import { toScreen } from '../../scene/stageFit';

const BOOK_ART = asset('assets/room/libro-abierto.webp');
/** Proporción del recurso recortado (1200 × 595). */
const BOOK_RATIO = 1200 / 595;
/** Por debajo de esta altura de panel (móvil en horizontal) el libro grande no cabe legible: se usa el de la escena. */
export const BED_BOOK_MIN_H = 520;

/** Ancho del libro en pantalla: algo más ancho que el móvil (sangra por los lados como en la maqueta), con tope. */
export function bedBookWidth(fit) {
  return Math.round(Math.min(fit.panelW * 1.06, 660, fit.panelH * 0.34 * BOOK_RATIO));
}

/** Datos de «Por donde vas» sin inventar cifras: sin total no hay porcentaje, barra ni páginas restantes. */
export function bedProgress(book) {
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
  const style = { width: w, height: Math.round(w / BOOK_RATIO), '--bw': `${w}px`, backgroundImage: `url(${BOOK_ART})` };
  if (!book) {
    return (
      <section className="bed-book" data-state="empty" style={style} aria-label="Tu lectura actual" inert={hidden || undefined} aria-hidden={hidden || undefined}>
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
  const finished = book.status === 'read';
  return (
    <section key={book.id} className="bed-book" data-state={finished ? 'finished' : 'reading'} data-pressed={pressed || undefined} style={style} aria-label="Tu lectura actual" inert={hidden || undefined} aria-hidden={hidden || undefined}>
      {/* Página izquierda: abre la ficha del libro (toda la página es el objetivo táctil) */}
      <button type="button" className="bed-book__page bed-book__page--left" onClick={() => onOpenBook(book)} aria-label={`Tu lectura actual: ${title}${book.author ? `, de ${book.author}` : ''}. Abrir su ficha`}>
        <span className="bed-book__kicker" aria-hidden="true">
          Tu lectura actual
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
export function RoomHeader() {
  return (
    <header className="room-header">
      <h2>Mi rincón</h2>
      <p>La biblioteca junto al mar</p>
    </header>
  );
}

/**
 * Accesos legibles y siempre visibles (con o sin guías): «Mi biblioteca» sobre la estantería y «Mi diario» junto a
 * la mesa del portátil. Cada uno se ancla a su mueble con la cámara del escenario y se mantiene dentro del panel.
 */
const PLAQUE_W = { shelf: 132, diary: 112 };
export function RoomNavPlaques({ fit, bookTop, onOpenShelf, onOpenDiary }) {
  const clampX = (x, w) => Math.max(8, Math.min(fit.panelW - w - 8, x));
  // Si el encuadre recorta el mueble (escritorio, horizontal), el acceso se queda en el borde visible más cercano
  const clampY = (y) => Math.max(88, Math.min(fit.panelH - 110, y));
  const shelf = toScreen(fit, HOTSPOTS.shelf.plaque.x, HOTSPOTS.shelf.plaque.y);
  const laptop = toScreen(fit, HOTSPOTS.laptop.plaque.x, HOTSPOTS.laptop.plaque.y);
  // El diario se apoya en la mesa sin taparse con el libro de la cama
  const diaryTop = clampY(Math.min(laptop.y, (bookTop ?? fit.panelH) - 52));
  return (
    <>
      <button type="button" className="room-plaque" data-id="shelf" style={{ left: clampX(shelf.x, PLAQUE_W.shelf), top: clampY(shelf.y) }} onClick={onOpenShelf}>
        <BookOpen aria-hidden="true" />
        <span>Mi biblioteca</span>
        <i aria-hidden="true">›</i>
      </button>
      <button type="button" className="room-plaque" data-id="diary" style={{ left: clampX(laptop.x - PLAQUE_W.diary, PLAQUE_W.diary), top: diaryTop }} onClick={onOpenDiary}>
        <PenLine aria-hidden="true" />
        <span>Mi diario</span>
        <i aria-hidden="true">›</i>
      </button>
    </>
  );
}
