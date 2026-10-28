// Habitación nocturna (1.51, SPEC §49): la ilustración de noche de la maqueta con su propio mapa (`nightMap.js`).
// Capas, todas en coordenadas de la ilustración y con la misma cámara (`SceneStage`):
//   1. fondo pintado (sin libro, sin carteles, pantalla apagada);
//   2. objetos con datos: pantalla del portátil con el calendario y libro abierto (recurso aparte) con la lectura;
//   3. carteles de papel fijados a su soporte;
//   4. zonas tocables de los objetos pintados.
// Los controles superiores y «Social ›» viven fuera (capa de interfaz con áreas seguras). La lámpara y la vela
// apagadas oscurecen solo su luz. Sin partículas, notas ni destellos.
import { BookOpen, PenLine } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { bounds, clipPolygon, rectToQuad } from '../../scene/homography';
import { NIGHT_BOOK, NIGHT_LIGHTS, NIGHT_PLAQUES, NIGHT_ROOM, NIGHT_SCREEN, NIGHT_SOCIAL, NIGHT_SPOTS } from '../../scene/nightMap';
import { asset } from '../../scene/sceneMap';
import { toScreen, visibleFraction } from '../../scene/stageFit';
import { CalendarApp } from '../panels/ReadingCalendar';
import { RoomHeader, bedProgress } from './BedBook';
import { SceneBase } from './SceneBase';
import { SceneStage } from './SceneStage';

// Lienzo con la proporción del trozo de pantalla que se ve (≈ 90 × 160 px de la ilustración): el calendario no se aplasta
const SCREEN = { w: 160, h: 270 };
const WALLPAPER = asset('images/room-refresh/pantalla-bahia.webp');

/** Esquinas del libro en la escena (para su zona tocable y para saber si se ve). */
function bookCorners() {
  const { w, h, cx, cy, scale, angle } = NIGHT_BOOK;
  const a = (angle * Math.PI) / 180;
  return [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ].map(([x, y]) => [cx + scale * (x * Math.cos(a) - y * Math.sin(a)), cy + scale * (x * Math.sin(a) + y * Math.cos(a))]);
}
export const NIGHT_BOOK_SHAPE = bookCorners();

/** Transformación plana de un rectángulo al paralelogramo medio de un trapecio (igual en todos los motores). */
function plaqueStyle(quad, fit) {
  const [tl, tr, br, bl] = quad;
  const u = [tr[0] - tl[0], tr[1] - tl[1]];
  const v = [(bl[0] - tl[0] + br[0] - tr[0]) / 2, (bl[1] - tl[1] + br[1] - tr[1]) / 2];
  const w = Math.round(Math.hypot(u[0], u[1]));
  const h = Math.round(Math.hypot(v[0], v[1]));
  const m = [u[0] / w, u[1] / w, v[0] / h, v[1] / h, tl[0], tl[1]].map((n) => +n.toFixed(5));
  return { width: w, height: h, fontSize: Math.round(h * 0.46), '--hit': `${Math.ceil(46 / Math.max(0.1, fit.scale))}px`, transform: `matrix(${m.join(',')})` };
}

function Spot({ id, shape, label, onActivate }) {
  const b = bounds(shape);
  return <button type="button" className="hotspot night-spot" data-id={id} style={{ left: b.x, top: b.y, width: b.w, height: b.h, clipPath: clipPolygon(shape) }} aria-label={label} onClick={onActivate} />;
}

/** Contenido de las dos páginas, en px del recurso del libro. */
function Pages({ book, fit, onLog, onChoose }) {
  const L = NIGHT_BOOK.left;
  const R = NIGHT_BOOK.right;
  const place = (z) => ({ left: z.cx - z.w / 2, top: z.cy - z.h / 2, width: z.w, height: z.h, transform: `rotate(${z.angle}deg)` });
  // Alto mínimo de la zona táctil del botón: 44 px de pantalla a la escala de la escena y del libro
  const minHit = Math.ceil(46 / Math.max(0.05, fit.scale * NIGHT_BOOK.scale));
  const state = !book ? 'empty' : book.status === 'abandoned' ? 'abandoned' : book.status === 'read' ? 'finished' : 'reading';
  const title = book?.title || 'Sin título';
  const progress = book ? bedProgress(book) : null;
  const size = title.length > 46 ? 'long' : title.length > 20 ? 'medium' : 'short';
  const action = state === 'reading' ? { text: 'Registrar lectura', aria: `Registrar lectura de ${title}`, run: () => onLog(book) } : { text: state === 'empty' ? 'Elegir un libro' : 'Elegir otra lectura', aria: state === 'empty' ? 'Elegir un libro' : 'Elegir otra lectura', run: onChoose };
  return (
    <>
      <div className="night-page night-page--left" style={place(L)} aria-hidden="true">
        <span className="night-page__kicker">{state === 'abandoned' ? 'Lectura abandonada' : state === 'empty' ? 'Tu lectura' : 'Estás leyendo'}</span>
        <b className="night-page__title" data-size={book ? size : 'medium'}>
          {book ? title : 'Ningún libro abierto'}
        </b>
        {book?.author && <span className="night-page__author">{book.author}</span>}
      </div>
      <div className="night-page night-page--right" style={place(R)}>
        {progress ? (
          <>
            <span className="night-page__progress" aria-hidden="true">
              {progress.main}
            </span>
            {progress.secondary && (
              <span className="night-page__secondary" aria-hidden="true">
                {progress.secondary}
              </span>
            )}
            {progress.fraction != null && (
              <span className="night-page__meter" aria-hidden="true">
                <i style={{ width: `${progress.fraction * 100}%` }} />
              </span>
            )}
          </>
        ) : (
          <span className="night-page__secondary" aria-hidden="true">
            Elige qué quieres leer
          </span>
        )}
        <button type="button" className="night-page__action" style={{ '--hit': `${minHit}px` }} aria-label={action.aria} onClick={action.run}>
          <span aria-hidden="true">{action.text}</span>
        </button>
      </div>
    </>
  );
}

export function NightRoom({ book, settings, live, attempt, onStatus, onOpenBook, onLog, onOpenShelf, onOpenLaptop, onOpenVault, onToggleSound, onToggleLamp, onToggleCandle, onOffscreen, actions, today, modalOpen = false }) {
  // «Social ›» se coloca junto al marco del ventanal: la capa de interfaz lee su posición de estas variables
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.roomNight = '';
    return () => {
      delete root.dataset.roomNight;
      root.style.removeProperty('--night-social-x');
      root.style.removeProperty('--night-social-y');
    };
  }, []);
  const spots = useMemo(() => ({ ...NIGHT_SPOTS, book: { shape: NIGHT_BOOK_SHAPE } }), []);
  const { left: bl, top: bt, w: bw, h: bh } = { left: NIGHT_BOOK.cx - NIGHT_BOOK.w / 2, top: NIGHT_BOOK.cy - NIGHT_BOOK.h / 2, w: NIGHT_BOOK.w, h: NIGHT_BOOK.h };
  return (
    <SceneStage
      room={NIGHT_ROOM}
      className="room-camera night-room"
      data-view="ROOM_VIEW"
      data-live={live || undefined}
      overlay={(fit) => (
        <>
          {/* Nombre accesible de la pantalla (sin título visible, como de día) */}
          <RoomHeader panelW={fit.panelW} />
          <NightOverlay fit={fit} spots={spots} actions={actions} onOffscreen={onOffscreen} />
        </>
      )}
    >
      {(fit) => (
        <div className="world night-world">
          <SceneBase room={NIGHT_ROOM} attempt={attempt} onStatus={onStatus} />
          {/* Luz que se apaga con su objeto: solo alrededor de la lámpara y de la vela */}
          <div className="tod night-lights" data-tod="night" aria-hidden="true">
            {!settings.lampOn && <span className="night-lights__off" style={{ left: NIGHT_LIGHTS.lamp.x - NIGHT_LIGHTS.lamp.r, top: NIGHT_LIGHTS.lamp.y - NIGHT_LIGHTS.lamp.r, width: NIGHT_LIGHTS.lamp.r * 2, height: NIGHT_LIGHTS.lamp.r * 2 }} />}
            {!settings.candleOn && <span className="night-lights__off" style={{ left: NIGHT_LIGHTS.candle.x - NIGHT_LIGHTS.candle.r, top: NIGHT_LIGHTS.candle.y - NIGHT_LIGHTS.candle.r, width: NIGHT_LIGHTS.candle.r * 2, height: NIGHT_LIGHTS.candle.r * 2 }} />}
          </div>
          {/* Pantalla del portátil: el calendario en el plano de la pantalla, con brillo de noche */}
          <div className="laptop-screen" data-night="" style={{ width: SCREEN.w, height: SCREEN.h, transform: rectToQuad(SCREEN.w, SCREEN.h, NIGHT_SCREEN) }} aria-hidden="true">
            <span className="laptop-screen__wallpaper" style={{ backgroundImage: `url(${WALLPAPER})` }} />
            <CalendarApp variant="scene" today={today} />
          </div>
          {/* Zonas tocables de los objetos pintados (por debajo del libro y de los carteles) */}
          <div className="room-hotspots night-spots">
            <Spot id="shelf" shape={NIGHT_SPOTS.shelf.shape} label="Mi librería" onActivate={onOpenShelf} />
            <Spot id="figures" shape={NIGHT_SPOTS.figures.shape} label="Vitrina de figuras: El Ático" onActivate={() => onOpenVault()} />
            <Spot id="lamp" shape={NIGHT_SPOTS.lamp.shape} label={settings.lampOn ? 'Lámpara: apagar' : 'Lámpara: encender'} onActivate={onToggleLamp} />
            <Spot id="laptop" shape={NIGHT_SPOTS.laptop.shape} label="Portátil: estadísticas y calendario" onActivate={onOpenLaptop} />
            <Spot id="lantern" shape={NIGHT_SPOTS.lantern.shape} label={settings.candleOn ? 'Vela: soplar' : 'Vela: encender'} onActivate={onToggleCandle} />
            <Spot id="headphones" shape={NIGHT_SPOTS.headphones.shape} label={settings.sound ? 'Silenciar el sonido ambiental' : 'Activar el sonido ambiental de olas, brisa y páginas'} onActivate={onToggleSound} />
            {/* Libro: sombra de contacto, el recurso sin estirar y su contenido; el resto del libro abre la ficha */}
            <span className="night-book__contact" style={{ left: NIGHT_BOOK.cx - 400, top: NIGHT_BOOK.cy + 120, width: 800, height: 120 }} aria-hidden="true" />
            <div className="night-book" inert={modalOpen || undefined} aria-hidden={modalOpen || undefined} style={{ left: bl, top: bt, width: bw, height: bh, transform: `rotate(${NIGHT_BOOK.angle}deg) scale(${NIGHT_BOOK.scale})` }}>
              <img className="night-book__art" src={NIGHT_BOOK.src} width={NIGHT_BOOK.w} height={NIGHT_BOOK.h} alt="" draggable="false" />
              <button type="button" className="hotspot night-book__open" data-id="book" aria-label={book ? `Leyendo ahora: ${book.title}${book.author ? `, de ${book.author}` : ''}. Abrir libro` : 'Ningún libro abierto: elegir uno'} onClick={() => (book ? onOpenBook(book) : onOpenShelf())} />
              <Pages book={book} fit={fit} onLog={onLog} onChoose={onOpenShelf} />
            </div>
            {/* Carteles fijados a su soporte, en la perspectiva del mueble */}
            <button type="button" className="room-plaque room-plaque--scene" data-id="shelf" data-projected="true" style={plaqueStyle(NIGHT_PLAQUES.shelf, fit)} onClick={onOpenShelf}>
              <BookOpen aria-hidden="true" />
              <span>Mi biblioteca</span>
              <i aria-hidden="true">›</i>
            </button>
            <button type="button" className="room-plaque room-plaque--scene" data-id="diary" data-projected="true" style={plaqueStyle(NIGHT_PLAQUES.diary, fit)} onClick={onOpenLaptop}>
              <PenLine aria-hidden="true" />
              <span>Mi diario</span>
              <i aria-hidden="true">›</i>
            </button>
          </div>
        </div>
      )}
    </SceneStage>
  );
}

/**
 * Capa de interfaz de la noche: coloca «Social ›» junto al ventanal (variables CSS) y avisa de lo que el encuadre
 * deja fuera para ofrecerlo en «Guías». El té no está pintado de noche: el temporizador se ofrece siempre ahí.
 */
function NightOverlay({ fit, spots, actions, onOffscreen }) {
  // Si el encuadre deja fuera el ventanal (escritorio), «Social ›» se queda en el borde visible más cercano
  const at = toScreen(fit, NIGHT_SOCIAL.x, NIGHT_SOCIAL.y);
  const outside = at.y < 64 || at.x > fit.panelW - 60;
  const social = outside ? { x: fit.panelW - 100, y: Math.round(fit.panelH * 0.46) } : { x: Math.max(8, Math.min(fit.panelW - 100, at.x)), y: Math.min(fit.panelH - 120, at.y) };
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--night-social-x', `${Math.round(social.x)}px`);
    root.style.setProperty('--night-social-y', `${Math.round(social.y)}px`);
  }, [social.x, social.y]);
  const cut = Object.keys(spots)
    .filter((id) => actions[id] && visibleFraction(fit, spots[id].shape) < 0.25)
    .join(',');
  useEffect(() => {
    const list = cut ? cut.split(',') : [];
    onOffscreen?.([...list.map((id) => ({ id, title: actions[id].title, onActivate: () => actions[id].onActivate() })), { id: 'tray', title: actions.tray.title, onActivate: () => actions.tray.onActivate(), absent: true }]);
    // `actions` cambia en cada render: se resume en `cut`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cut, onOffscreen]);
  return null;
}
