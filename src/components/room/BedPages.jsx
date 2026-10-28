// La lectura actual escrita en el libro pintado sobre la cama (1.49, SPEC §47). El fondo ya trae un libro abierto con
// la perspectiva y la luz de la escena: en vez de poner otro encima (silueta duplicada, perspectiva cenital ajena a la
// cama), el contenido se proyecta en el mismo sistema de coordenadas de la ilustración sobre la zona útil de cada
// página (`BOOK_LEFT_PAGE` y `BOOK_RIGHT_PAGE`, ya separadas del pliegue y de los bordes) con la homografía del
// escenario. El lienzo de cada página tiene las proporciones reales de su zona, así que la perspectiva es la del
// papel sin aplastar el texto. La capa visible va con las superficies (la luz del día y de la noche la tiñen igual que
// a la habitación); el botón real de «Registrar lectura» va en la capa de los objetos tocables, en el mismo sitio.
import { rectToQuad } from '../../scene/homography';
import { BOOK_LEFT_PAGE, BOOK_RIGHT_PAGE } from '../../scene/sceneMap';
import { bedProgress } from './BedBook';

const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
/** Lienzo de una página con las proporciones de su zona (px de la ilustración, sin escala adicional). */
function canvasOf(quad) {
  const [tl, tr, br, bl] = quad;
  return { w: Math.round((dist(tl, tr) + dist(bl, br)) / 2), h: Math.round((dist(tl, bl) + dist(tr, br)) / 2) };
}
export const LEFT = canvasOf(BOOK_LEFT_PAGE);
export const RIGHT = canvasOf(BOOK_RIGHT_PAGE);
const place = (c, quad) => ({ width: c.w, height: c.h, transform: rectToQuad(c.w, c.h, quad) });

/** Estado del libro de la cama: lectura, terminada, abandonada o ninguna. */
const stateOf = (book) => (!book ? 'empty' : book.status === 'abandoned' ? 'abandoned' : book.status === 'read' ? 'finished' : 'reading');

/** Capa visible (decorativa para la accesibilidad: el nombre lo dan el hotspot del libro y el botón). */
export function BookOnBed({ book }) {
  const state = stateOf(book);
  if (!book) {
    return (
      <div className="bed-pages" data-state="empty" aria-hidden="true">
        <div className="bed-pages__page bed-pages__page--left" style={place(LEFT, BOOK_LEFT_PAGE)}>
          <span className="bed-pages__kicker">Tu lectura</span>
          <b className="bed-pages__title" data-size="medium">
            Ningún libro abierto
          </b>
        </div>
        <div className="bed-pages__page bed-pages__page--right" style={place(RIGHT, BOOK_RIGHT_PAGE)}>
          <span className="bed-pages__kicker">Por donde vas</span>
          <span className="bed-pages__secondary">Elige qué quieres leer</span>
          <span className="bed-pages__action">Elegir un libro</span>
        </div>
      </div>
    );
  }
  const title = book.title || 'Sin título';
  const progress = bedProgress(book);
  // Tres tamaños según la longitud: los largos ocupan más líneas con una letra algo menor, nunca diminuta
  const size = title.length > 46 ? 'long' : title.length > 22 ? 'medium' : 'short';
  return (
    <div key={book.id} className="bed-pages" data-state={state} aria-hidden="true">
      <div className="bed-pages__page bed-pages__page--left" style={place(LEFT, BOOK_LEFT_PAGE)}>
        <span className="bed-pages__kicker">{state === 'abandoned' ? 'Lectura abandonada' : 'Tu lectura'}</span>
        <b className="bed-pages__title" data-size={size}>
          {title}
        </b>
        {book.author && <span className="bed-pages__author">{book.author}</span>}
      </div>
      <div className="bed-pages__page bed-pages__page--right" style={place(RIGHT, BOOK_RIGHT_PAGE)}>
        <span className="bed-pages__kicker">Por donde vas</span>
        <span className="bed-pages__progress">{progress.main}</span>
        {progress.secondary && <span className="bed-pages__secondary">{progress.secondary}</span>}
        {progress.fraction != null && (
          <span className="bed-pages__meter">
            <i style={{ width: `${progress.fraction * 100}%` }} />
          </span>
        )}
        <span className="bed-pages__action" data-kind={state === 'reading' ? 'log' : 'choose'}>
          {state === 'reading' ? 'Registrar lectura' : 'Elegir otra lectura'}
        </span>
      </div>
    </div>
  );
}

/**
 * Capa tocable: el botón real, proyectado en el mismo lugar que el dibujado (y con superficie de pulsación de al
 * menos 44 px de pantalla). Va por encima del hotspot del libro, que abre la ficha desde el resto de las páginas.
 */
export function BookOnBedActions({ book, scale, onLog, onChoose }) {
  const state = stateOf(book);
  const label = state === 'reading' ? `Registrar lectura de ${book.title}` : state === 'empty' ? 'Elegir un libro' : 'Elegir otra lectura';
  // Alto mínimo de la zona táctil en px de la ilustración: 44 px de pantalla a la escala actual
  const minH = Math.ceil(44 / Math.max(0.1, scale));
  return (
    <div className="bed-pages bed-pages--actions" data-state={state}>
      <div className="bed-pages__page bed-pages__page--right" style={place(RIGHT, BOOK_RIGHT_PAGE)}>
        <button type="button" className="bed-pages__hit" style={{ '--hit': `${minH}px` }} aria-label={label} onClick={() => (state === 'reading' ? onLog(book) : onChoose())} />
      </div>
    </div>
  );
}
