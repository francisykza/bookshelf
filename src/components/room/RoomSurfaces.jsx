// Superficies con datos de la habitación (SPEC §20): la pantalla del portátil con BookShelf abierto en Calendario
// y el libro abierto con la lectura actual. Cada una es un lienzo local proyectado con la homografía del mueble
// (`rectToQuad`) sobre su quad medido en la ilustración: comparte escala y recorte con el fondo, no sale del bisel
// ni cruza el pliegue. Son vistas ambientales: no tienen botones propios (los hotspots del portátil y del libro
// abren el panel y la ficha).
import { progressParts } from '../../domain/roomSurfaces';
import { rectToQuad } from '../../scene/homography';
import { BOOK_LEFT_PAGE, BOOK_RIGHT_PAGE, LAPTOP_FOREGROUND, LAPTOP_SCREEN, asset } from '../../scene/sceneMap';
import { CalendarApp } from '../panels/ReadingCalendar';
import { getDeterministicVibe, stableHash } from '../../utils/vibeEngine';

/** Lienzo lógico de la pantalla, proporcional a su quad (≈ 143 × 118 px de la ilustración). */
const SCREEN = { w: 300, h: 248 };
/** Fondo de escritorio de la pantalla (SPEC §23.4): «Bahía mediterránea al anochecer-1», 640 × 400. */
const SCREEN_WALLPAPER = asset('images/room-refresh/pantalla-bahia.webp');

/**
 * La pantalla encendida con el Calendario de BookShelf (SPEC §21.3): la vista compacta del MISMO calendario del
 * panel (`CalendarApp variant="scene"`), proyectada una vez en las esquinas interiores del bisel, sobre un fondo de
 * escritorio con la bahía (SPEC §23.4) que solo se mueve con `running`. La planta y el vaso se repintan delante.
 * Decorativa: el hotspot del portátil es el único objetivo táctil.
 */
export function LaptopScreen({ today, running = false }) {
  return (
    <>
      <div className="laptop-screen" data-running={running || undefined} style={{ width: SCREEN.w, height: SCREEN.h, transform: rectToQuad(SCREEN.w, SCREEN.h, LAPTOP_SCREEN) }} aria-hidden="true">
        {/* Fondo de escritorio: la bahía al anochecer, recortada dentro del monitor y con un desplazamiento tenue */}
        <span className="laptop-screen__wallpaper" style={{ backgroundImage: `url(${SCREEN_WALLPAPER})` }} />
        <CalendarApp variant="scene" today={today} />
      </div>
      {/* Lo que está delante de la pantalla, recortado de la propia ilustración */}
      <img className="laptop-foreground" src={LAPTOP_FOREGROUND.src} alt="" width={LAPTOP_FOREGROUND.w} height={LAPTOP_FOREGROUND.h} style={{ left: LAPTOP_FOREGROUND.x, top: LAPTOP_FOREGROUND.y }} draggable="false" aria-hidden="true" />
    </>
  );
}

/** Lienzo lógico de cada página: el mismo para las dos (son del mismo tamaño físico; la perspectiva la pone el quad). */
const PAGE = { w: 250, h: 330 };
const pageStyle = (quad) => ({ width: PAGE.w, height: PAGE.h, transform: rectToQuad(PAGE.w, PAGE.h, quad) });

/**
 * Ornamentos editoriales locales (SVG sencillo, trazo de tinta). Se eligen de forma determinista con el preajuste
 * del motor local (`getDeterministicVibe`) y, si no hay etiquetas, con el id del libro. Son un adorno de la app,
 * no una ilustración oficial de la obra.
 */
const ORNAMENTS = {
  sprig: 'M4 20 C18 16 30 12 46 4 M14 17 C12 12 14 9 18 7 M14 17 C18 19 22 19 25 17 M25 13 C24 9 26 6 30 5 M25 13 C29 15 33 15 36 12 M36 9 C36 6 38 4 41 3',
  star: 'M25 2 L28 10 L36 12 L28 14 L25 22 L22 14 L14 12 L22 10 Z M8 18 L9 20 L11 21 L9 22 L8 24 L7 22 L5 21 L7 20 Z M42 4 L43 6 L45 7 L43 8 L42 10 L41 8 L39 7 L41 6 Z',
  wave: 'M2 14 C8 8 14 8 20 14 C26 20 32 20 38 14 C42 10 46 10 48 12 M8 20 C12 17 16 17 20 20',
  geometric: 'M25 3 L35 13 L25 23 L15 13 Z M25 8 L30 13 L25 18 L20 13 Z M4 13 L12 13 M38 13 L46 13',
};
const ORNAMENT_BY_VIBE = { fantasy: 'star', science_fiction: 'star', mystery: 'geometric', winter: 'geometric', romance: 'sprig' };
function ornamentFor(book) {
  const preset = getDeterministicVibe(book).presetId;
  return ORNAMENT_BY_VIBE[preset] ?? (stableHash(`ornament:${book.id ?? book.title}`) % 2 ? 'wave' : 'sprig');
}

function Ornament({ kind }) {
  return (
    <svg className="open-pages__ornament" data-kind={kind} viewBox="0 0 50 26" width="50" height="26" aria-hidden="true">
      <path d={ORNAMENTS[kind]} />
    </svg>
  );
}

/**
 * El libro abierto como doble página editorial (SPEC §21.2), con el papel pintado de fondo: a la izquierda la
 * portadilla de la lectura actual («Lectura actual», título, autoría y un ornamento); a la derecha «Por donde
 * vas» con la página, el total y el porcentaje. Sin portada pegada, tarjetas ni fondos añadidos. Cada página
 * tiene su quad y nada cruza el pliegue; se monta de nuevo al cambiar de libro (`key`) para no mezclar datos.
 */
export function OpenBookPages({ book }) {
  if (!book) {
    return (
      <div className="open-pages" data-state="empty" aria-hidden="true">
        <div className="open-pages__page open-pages__page--left" style={pageStyle(BOOK_LEFT_PAGE)}>
          <span className="open-pages__kicker">Lectura actual</span>
          <b className="open-pages__title" data-size="medium">
            Tu próxima historia empieza aquí
          </b>
          <Ornament kind="sprig" />
        </div>
        <div className="open-pages__page open-pages__page--right" style={pageStyle(BOOK_RIGHT_PAGE)}>
          <span className="open-pages__kicker">Por donde vas</span>
          <span className="open-pages__secondary">Elige un libro en tu librería</span>
        </div>
      </div>
    );
  }
  const title = book.title || 'Sin título';
  const progress = progressParts(book);
  const size = title.length > 48 ? 'long' : title.length > 22 ? 'medium' : 'short';
  return (
    <div key={book.id} className="open-pages" data-state="book" aria-hidden="true">
      <div className="open-pages__page open-pages__page--left" style={pageStyle(BOOK_LEFT_PAGE)}>
        <span className="open-pages__kicker">Lectura actual</span>
        <b className="open-pages__title" data-size={size}>
          {title}
        </b>
        {book.author && <span className="open-pages__author">{book.author}</span>}
        <Ornament kind={ornamentFor(book)} />
      </div>
      <div className="open-pages__page open-pages__page--right" style={pageStyle(BOOK_RIGHT_PAGE)}>
        <span className="open-pages__kicker">Por donde vas</span>
        <span className="open-pages__progress">{progress.main}</span>
        {progress.secondary && <span className="open-pages__secondary">{progress.secondary}</span>}
        {progress.fraction != null && (
          <span className="open-pages__meter">
            <i style={{ width: `${Math.max(0, Math.min(1, progress.fraction)) * 100}%` }} />
          </span>
        )}
      </div>
    </div>
  );
}
