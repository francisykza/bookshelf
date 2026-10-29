// La lectura actual escrita en el libro pintado sobre la cama (1.49, SPEC §47). El fondo ya trae un libro abierto con
// la perspectiva y la luz de la escena: en vez de poner otro encima (silueta duplicada, perspectiva cenital ajena a la
// cama), el contenido se proyecta en el mismo sistema de coordenadas de la ilustración sobre la zona útil de cada
// página (`BOOK_LEFT_PAGE` y `BOOK_RIGHT_PAGE`, ya separadas del pliegue y de los bordes) con la homografía del
// escenario. El lienzo de cada página tiene las proporciones reales de su zona, así que la perspectiva es la del
// papel sin aplastar el texto. La capa visible va con las superficies (la luz del día y de la noche la tiñen igual que
// a la habitación); el botón real de «Registrar lectura» va en la capa de los objetos tocables, en el mismo sitio.
import { BOOK_LEFT_PAGE, BOOK_RIGHT_PAGE } from '../../scene/sceneMap';
import { bedProgress } from './BedBook';

const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const angleOf = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
/**
 * Colocación de una página (1.50): un rectángulo centrado en su zona útil y girado con la orientación media de sus
 * bordes superior e inferior, sin la cizalla de la homografía (que inclinaba las letras). El tamaño es un poco menor
 * que la zona para que las esquinas no se salgan del papel.
 */
function settle(quad, kw, kh) {
  const [tl, tr, br, bl] = quad;
  const w = Math.round(((dist(tl, tr) + dist(bl, br)) / 2) * kw);
  const h = Math.round(((dist(tl, bl) + dist(tr, br)) / 2) * kh);
  const cx = (tl[0] + tr[0] + br[0] + bl[0]) / 4;
  const cy = (tl[1] + tr[1] + br[1] + bl[1]) / 4;
  const a = (angleOf(tl, tr) + angleOf(bl, br)) / 2;
  return { w, h, transform: `translate(${(cx - w / 2).toFixed(1)}px, ${(cy - h / 2).toFixed(1)}px) rotate(${a.toFixed(4)}rad)` };
}
export const LEFT = settle(BOOK_LEFT_PAGE, 0.97, 0.92);
export const RIGHT = settle(BOOK_RIGHT_PAGE, 0.86, 0.86);
const place = (c) => ({ width: c.w, height: c.h, transform: c.transform, transformOrigin: '50% 50%' });

/** Estado del libro de la cama: lectura, terminada, abandonada o ninguna. */
const stateOf = (book) => (!book ? 'empty' : book.status === 'abandoned' ? 'abandoned' : book.status === 'read' ? 'finished' : 'reading');

/** Capa visible (decorativa para la accesibilidad: el nombre lo dan el hotspot del libro y el botón). */
export function BookOnBed({ book }) {
  const state = stateOf(book);
  if (!book) {
    return (
      <div className="bed-pages" data-state="empty" aria-hidden="true">
        <div className="bed-pages__page bed-pages__page--left" style={place(LEFT)}>
          <span className="bed-pages__kicker">Tu lectura</span>
          <span className="bed-pages__titlebox">
            <b className="bed-pages__title" data-size="medium">
              Ningún libro abierto
            </b>
          </span>
        </div>
        <div className="bed-pages__page bed-pages__page--right" style={place(RIGHT)}>
          <span className="bed-pages__secondary">Elige qué quieres leer</span>
          <span className="bed-pages__action">Elegir un libro</span>
        </div>
      </div>
    );
  }
  const title = book.title || 'Sin título';
  const progress = bedProgress(book);
  // Tres tamaños según la longitud: los largos ocupan más líneas con una letra algo menor, nunca diminuta
  const size = title.length > 40 ? 'long' : title.length > 16 ? 'medium' : 'short';
  return (
    <div key={book.id} className="bed-pages" data-state={state} aria-hidden="true">
      <div className="bed-pages__page bed-pages__page--left" style={place(LEFT)}>
        <span className="bed-pages__kicker">{state === 'abandoned' ? 'Lectura abandonada' : state === 'finished' ? 'Lectura terminada' : 'Estás leyendo'}</span>
        {/* Caja de altura fija (tres líneas): el autor no se mueve aunque cambie la longitud del título */}
        <span className="bed-pages__titlebox">
          <b className="bed-pages__title" data-size={size}>
            {title}
          </b>
        </span>
        {book.author && <span className="bed-pages__author">{book.author}</span>}
      </div>
      <div className="bed-pages__page bed-pages__page--right" style={place(RIGHT)}>
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
export function BookOnBedActions({ book, scale, onLog, onChoose, hidden = false }) {
  const state = stateOf(book);
  const label = state === 'reading' ? `Registrar lectura de ${book.title}` : state === 'empty' ? 'Elegir un libro' : 'Elegir otra lectura';
  // Alto mínimo de la zona táctil en px de la ilustración: 44 px de pantalla a la escala actual
  const minH = Math.ceil(44 / Math.max(0.1, scale));
  return (
    // Con un panel delante, el botón de la habitación no se anuncia ni recibe el foco
    <div className="bed-pages bed-pages--actions" data-state={state} inert={hidden || undefined} aria-hidden={hidden || undefined}>
      <div className="bed-pages__page bed-pages__page--right" style={place(RIGHT)}>
        <button type="button" className="bed-pages__hit" style={{ '--hit': `${minH}px` }} aria-label={label} onClick={() => (state === 'reading' ? onLog(book) : onChoose())} />
      </div>
    </div>
  );
}
