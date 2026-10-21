// Habitación "Mediterranean Cozy Room" (SPEC §2–§3): lienzo de 984 × 1599 escalado a la ventana,
// con la cámara de dos estados (`ROOM_VIEW` ↔ `SHELF_VIEW`) y todos los objetos diegéticos.
// 1.8.0: habitación viva sin botones encima, datos reales sobre los objetos y parallax de tres capas
// (mar y cielo lejos, la habitación en medio y la cama en primer plano).
import { summarize } from '../../domain/reading';
import { Cloud, CloudOff, Maximize, Minimize, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { chime, lampClick, matchStrike } from '../../audio/ambientAudio';
import { currentBook, progressLabel } from '../../domain/books';
import { dayKey } from '../../domain/dates';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useRoomCamera } from '../../hooks/useRoomCamera';
import { ScrollChevron } from '../shelf/ScrollChevron';
import { LITE_SCENE } from '../../scene/renderMode';
import { useCloud } from '../../state/cloudSync';
import { useLibrary } from '../../state/useLibrary';
import { DecorBoundary } from './DecorBoundary';
import { FrontLayer } from './FrontLayer';
import { RoomAtmosphereCanvas } from './RoomAtmosphereCanvas';
import { Hotspot, RoomLabel, TimeDial, TOD_ORDER, todName } from './RoomHotspots';
import { BedBookmark, CloudShadow, DrinkSteam, LaptopPostit, SoundWaves, TeaMist, readingStreak } from './RoomLiveData';
import { RoomFigureShelves, RoomOcclusion, RoomShelfBooks } from './RoomShelfBooks';
import { SceneBase } from './SceneBase';
import { SceneLayers } from './SceneLayers';
import { TeaDrain } from './TeaDrain';
import { TimeOfDayLayers } from './TimeOfDayLayers';

export const ROOM_VIEW = 'ROOM_VIEW';
export const SHELF_VIEW = 'SHELF_VIEW';

/** Punto de la ilustración hacia el que viaja la cámara de escritorio al acercarse a la estantería. */
const SHELF_FOCUS = { x: 230, y: 470, zoom: 1.75 };

/** Recorrido de pistas (solo con «Mostrar guías»): un objeto tras otro se aviva para enseñarte qué tocar. */
const SPOT_ORDER = ['book', 'laptop', 'tray', 'headphones', 'figures', 'shelf', 'lamp', 'lantern', 'chime', 'sun'];
const SPOT_MS = 2600;

function formatTimer(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function CozyRoom({ k, camera, view, interactive = true, hidden = false, onOpenShelf, onOpenBook, onOpenLaptop, onOpenTray, onToggleSound, onOpenAtlas, onOpenVault, onOpenAccount, modalOpen = false, timer }) {
  const cloud = useCloud();
  const { state, actions } = useLibrary();
  const { settings, books, progress } = state;
  const reducedMotion = useReducedMotion();
  const worldRef = useRef(null);
  const [label, setLabel] = useState(null);
  const [chimeRing, setChimeRing] = useState(false);
  const [spotIndex, setSpotIndex] = useState(0);
  const cameraRef = useRef(null);
  const teaLevelRef = useRef(null);
  const timers = useRef([]);
  const reading = currentBook(books, settings);
  const inRoom = interactive;
  // Con un modal delante la habitación se queda quieta (el temporizador sigue contando)
  const live = inRoom && !modalOpen;
  const [base, setBase] = useState({ status: 'loading', attempt: 0 });
  const guides = Boolean(settings.showGuides);

  // Fuera de la habitación, con un modal delante o con movimiento reducido se congelan las animaciones SVG
  useEffect(() => {
    const svgs = worldRef.current?.querySelectorAll('svg') ?? [];
    svgs.forEach((svg) => (live && !reducedMotion ? svg.unpauseAnimations?.() : svg.pauseAnimations?.()));
  }, [live, reducedMotion]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // Tres casos (SPEC §12.3): app instalada a pantalla completa (sin pestaña), API de pantalla completa del
  // navegador, o ninguna de las dos (la pestaña explica, solo al tocarla, la alternativa de instalarla)
  const installedFullscreen = window.matchMedia?.('(display-mode: fullscreen)').matches ?? false;
  const fullscreenApi = Boolean(document.fullscreenEnabled && document.documentElement.requestFullscreen);
  const canFullscreen = !installedFullscreen;
  const [fullscreen, setFullscreen] = useState(() => Boolean(document.fullscreenElement));
  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const [fsHint, setFsHint] = useState(null);
  const toggleFullscreen = () => {
    if (!fullscreenApi) {
      setFsHint('Este navegador no deja abrir la página a pantalla completa. Instala BookShelf («Añadir a pantalla de inicio») y se abrirá sin barras.');
      return;
    }
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else
      document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {
        setFsHint('El navegador no ha concedido la pantalla completa; la app sigue igual.');
      });
  };
  useEffect(() => {
    if (!fsHint) return undefined;
    const id = setTimeout(() => setFsHint(null), 6000);
    return () => clearTimeout(id);
  }, [fsHint]);

  const pointing = Boolean(label);
  const pointingRef = useRef(false);
  useEffect(() => {
    pointingRef.current = pointing;
  }, [pointing]);
  useEffect(() => {
    if (!guides || !inRoom || reducedMotion || pointing) return undefined;
    const id = setInterval(() => setSpotIndex((i) => (i + 1) % SPOT_ORDER.length), SPOT_MS);
    return () => clearInterval(id);
  }, [guides, inRoom, reducedMotion, pointing]);
  const spot = guides && inRoom && !reducedMotion && !pointing ? SPOT_ORDER[spotIndex] : null;

  // Parallax de tres capas: el ratón (o la inclinación del móvil) mueve cada capa a su velocidad
  useEffect(() => {
    const surface = cameraRef.current;
    // En el perfil móvil no hay parallax: ni siquiera se registran los sensores
    if (!surface || reducedMotion || !live || LITE_SCENE) return undefined;
    const set = (x, y) => {
      surface.style.setProperty('--px', x.toFixed(3));
      surface.style.setProperty('--py', y.toFixed(3));
    };
    // Mientras señalas un objeto la habitación se queda quieta: el objetivo no se escapa del cursor
    const onMove = (event) => {
      if (pointingRef.current) return;
      set(event.clientX / window.innerWidth - 0.5, event.clientY / window.innerHeight - 0.5);
    };
    const onTilt = (event) => {
      if (event.gamma === null || event.beta === null) return;
      set(Math.max(-0.5, Math.min(0.5, event.gamma / 40)), Math.max(-0.5, Math.min(0.5, (event.beta - 45) / 50)));
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('deviceorientation', onTilt);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('deviceorientation', onTilt);
      set(0, 0);
    };
  }, [reducedMotion, live]);
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));

  // Cámara: una sola transformación para todas las capas; en móvil, cover desplazable (SPEC §12.2)
  // Flechas de la habitación: solo si queda escena fuera del encuadre en ese lado (tolerancia de 2 px)
  const [edges, setEdges] = useState({ left: false, right: false });
  const onOffset = useCallback((offset, cam) => {
    const left = cam.cover && offset.x < -2;
    const right = cam.cover && offset.x > cam.minX + 2;
    setEdges((e) => (e.left === left && e.right === right ? e : { left, right }));
  }, []);
  const { panBy } = useRoomCamera({ camera, shelfFocus: !camera.cover && view === SHELF_VIEW ? SHELF_FOCUS : null, worldRef, surfaceRef: cameraRef, enabled: inRoom, onOffset });

  const onHover = (next, id) => {
    if (next) setLabel(next);
    else setLabel((current) => (!id || current?.id === id || current?.id?.startsWith('spine') ? null : current));
  };

  const cycleTime = () => {
    const next = TOD_ORDER[(TOD_ORDER.indexOf(settings.timeOfDay) + 1) % TOD_ORDER.length];
    // Elegirla a mano detiene el cambio automático por reloj hasta la próxima visita
    actions.setSettings({ timeOfDay: next, timeAuto: false });
    chime();
    setChimeRing(true);
    later(() => setChimeRing(false), 2600);
    setLabel((l) => (l?.id === 'chime' || l?.id === 'dial' ? { ...l, title: todName(next), text: 'Carillón de cristal · tocar para cambiar la hora' } : l));
  };


  // Nivel del té: se vacía durante la lectura y se rellena en el descanso
  const inSession = timer.running || timer.remaining < timer.total;
  const teaLevel = inSession ? (timer.phase === 'focus' ? timer.remaining / timer.total : 1 - timer.remaining / timer.total) : null;
  useEffect(() => {
    teaLevelRef.current = teaLevel;
  }, [teaLevel]);

  const readThisYear = books.filter((b) => b.status === 'read' && b.finishedAt?.startsWith(String(new Date().getFullYear()))).length;
  const timerText = timer.running ? `${timer.phase === 'focus' ? 'Leyendo' : 'Descanso'} · ${formatTimer(timer.remaining)}` : null;
  const today = dayKey();
  const todaySummary = summarize(
    progress.readingLog.filter((e) => e.date === today),
    books,
  );
  const streak = readingStreak(progress.readingLog);



  return (
    <div
      ref={cameraRef}
      className="room-camera"
      data-view={view}
      data-cover={camera.cover || undefined}
      data-hidden={hidden || undefined}
      inert={hidden ? true : undefined}
      data-modal={modalOpen || undefined}
      data-pointing={pointing}
      data-guides={guides}
      data-shelf-awake={spot === 'shelf' || label?.id === 'shelf' || Boolean(label?.id?.startsWith('spine'))}
      aria-hidden={!inRoom}
    >
      <div ref={worldRef} className="world" style={{ '--k': k }} inert={!inRoom ? true : undefined}>
        {/* Marco de ventanal de madera: la habitación se asoma a la pantalla sin bandas negras */}
        <span className="world__frame" aria-hidden="true" />
        <div className="world__parallax">
          <div className="world__breath">
            <SceneBase attempt={base.attempt} onStatus={(status) => setBase((b) => (b.status === status ? b : { ...b, status }))} />
            <SceneLayers timeOfDay={settings.timeOfDay} chimeRing={chimeRing} />

            <Hotspot
              id="shelf"
              spot={spot === 'shelf'}
              guides={guides}
              hint={1}
              onHover={onHover}
              onActivate={onOpenShelf}
              label={{ title: 'Mi librería de roble', text: `${books.length} libros · toca para acercarte` }}
            />
            <RoomShelfBooks
              books={books}
              currentId={reading?.id}
              onOpenShelf={onOpenShelf}
              onHover={onHover}
              active={inRoom}
              awake={spot === 'shelf' || label?.id === 'shelf' || Boolean(label?.id?.startsWith('spine'))}
            />
            <Hotspot
              id="figures"
              spot={spot === 'figures'}
              guides={guides}
              hint={2}
              onHover={onHover}
              onActivate={() => onOpenVault()}
              label={{ title: 'Vitrina de figuras', text: `${Object.keys(progress.figures?.owned ?? {}).length} figuras · toca para subir al Ático`, meta: progress.figures?.boxes ? `🎁 ${progress.figures.boxes} Caja${progress.figures.boxes === 1 ? '' : 's'} Sorpresa por abrir` : undefined }}
            />
            <RoomFigureShelves figures={progress.figures} onOpenVault={onOpenVault} onHover={onHover} />
            <RoomOcclusion />

            {/* Primer plano: la cama y todo lo que hay encima, la capa que más se mueve */}
            <div className="layer-front">
              <FrontLayer />
              <TeaDrain level={teaLevel} />
              <LaptopPostit streak={streak} todayPages={todaySummary.pages} todayPercent={todaySummary.percentBooks} />
              <Hotspot
                id="book"
                spot={spot === 'book'}
                guides={guides}
                hint={0}
                onHover={onHover}
                onActivate={() => (reading ? onOpenBook(reading) : onOpenShelf())}
                label={
                  reading
                    ? { title: reading.title, text: reading.author, meta: progressLabel(reading), aria: `Leyendo ahora: ${reading.title}, de ${reading.author}, ${progressLabel(reading).toLowerCase()}. Abrir libro` }
                    : { title: 'Ningún libro abierto', text: 'Elige uno en tu librería' }
                }
              />
              <BedBookmark book={reading} onOpen={onOpenBook} onAdvance={(book, pages) => actions.setPage(book.id, book.currentPage + pages)} />
              <Hotspot
                id="laptop"
                spot={spot === 'laptop'}
                guides={guides}
                hint={3}
                onHover={onHover}
                onActivate={onOpenLaptop}
                label={{ title: 'Estadísticas y reto anual', text: `${readThisYear} de ${settings.yearGoal} libros este año`, meta: 'Calendario · Misiones del Booknook' }}
              />
              <Hotspot
                id="headphones"
                spot={spot === 'headphones'}
                guides={guides}
                hint={5}
                onHover={onHover}
                onActivate={() => {
                  onToggleSound();
                  setLabel((l) => (l?.id === 'headphones' ? { ...l, text: settings.sound ? 'Silencio · tocar para escuchar el mar' : 'Olas, brisa y páginas sonando' } : l));
                }}
                label={{
                  title: 'Sonido ambiental',
                  text: settings.sound ? 'Olas, brisa y páginas sonando' : 'Tocar para escuchar el mar',
                  aria: settings.sound ? 'Silenciar el sonido ambiental' : 'Activar el sonido ambiental de olas, brisa y páginas',
                }}
              />
              <Hotspot
                id="tray"
                spot={spot === 'tray'}
                guides={guides}
                hint={7}
                onHover={onHover}
                onActivate={onOpenTray}
                label={{ title: 'Temporizador cozy', text: timerText ?? 'Té helado y cerezas · elige tu bebida' }}
              />
              <TeaMist timer={timer} />
              <DrinkSteam drink={settings.drink} active={timer.running} />
              <SoundWaves on={settings.sound} />
            </div>

            <TimeOfDayLayers timeOfDay={settings.timeOfDay} lampOn={settings.lampOn} candleOn={settings.candleOn} />
            <CloudShadow timeOfDay={settings.timeOfDay} />
            <DecorBoundary resetKey={settings.timeOfDay}>
              <RoomAtmosphereCanvas timeOfDay={settings.timeOfDay} scale={k} paused={!live} reducedMotion={reducedMotion} teaLevelRef={teaLevelRef} />
            </DecorBoundary>

            <Hotspot
              id="chime"
              spot={spot === 'chime'}
              guides={guides}
              hint={11}
              onHover={onHover}
              onActivate={cycleTime}
              label={{ title: todName(settings.timeOfDay), text: 'Carillón de cristal · tocar para cambiar la hora' }}
            />
            <TimeDial timeOfDay={settings.timeOfDay} onOpen={onOpenAtlas} onHover={onHover} spot={spot === 'sun'} />

            {/* Interruptores físicos: la lámpara colgante y el farolillo con vela de la mesita */}
            <Hotspot
              id="lamp"
              spot={spot === 'lamp'}
              guides={guides}
              hint={13}
              onHover={onHover}
              onActivate={() => {
                lampClick();
                actions.setSettings({ lampOn: !settings.lampOn });
              }}
              label={{ title: 'Lámpara colgante', text: settings.lampOn ? 'Encendida · tocar para apagar' : 'Apagada · tocar para encender' }}
            />
            <Hotspot
              id="lantern"
              spot={spot === 'lantern'}
              guides={guides}
              hint={15}
              onHover={onHover}
              onActivate={() => {
                matchStrike(!settings.candleOn);
                actions.setSettings({ candleOn: !settings.candleOn });
              }}
              label={{ title: 'Farolillo con vela', text: settings.candleOn ? 'Encendido · tocar para soplar' : 'Apagado · tocar para encenderlo' }}
            />

            {/* Etiqueta colgante discreta: alternativa visible al clic en la estantería */}
            <button type="button" className="shelf-tag" onClick={onOpenShelf}>
              <span>Ver mi librería</span>
            </button>

            <RoomLabel label={label} />
          </div>
        </div>
      </div>


      {/* Si la ilustración no llega, se dice y se puede reintentar: nada de objetos flotando sobre un hueco */}
      {base.status === 'error' && (
        <div className="scene-error paper-sheet" role="alert">
          <p>No se ha podido cargar la ilustración de la habitación.</p>
          <button type="button" className="scene-error__retry" onClick={() => setBase((b) => ({ status: 'loading', attempt: b.attempt + 1 }))}>
            Reintentar
          </button>
        </div>
      )}

      {/* Esquina superior derecha, discreta: pantalla completa, sonidos táctiles y guías */}
      {inRoom && (
        <div className="room-corner">
          <button
            type="button"
            className="corner-btn corner-btn--cloud"
            data-status={cloud.status}
            onClick={onOpenAccount}
            aria-label="Tu cuenta y copias de tus datos"
            title={cloud.user ? `Tu cuenta: ${cloud.user.email}` : 'Tu cuenta y copias'}
          >
            {cloud.status === 'offline' || cloud.status === 'off' ? <CloudOff aria-hidden="true" /> : <Cloud aria-hidden="true" />}
          </button>
          {canFullscreen && (
            <button
              type="button"
              className="corner-btn"
              onClick={toggleFullscreen}
              aria-pressed={fullscreenApi ? fullscreen : undefined}
              aria-label={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
              title={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            >
              {fullscreen ? <Minimize aria-hidden="true" /> : <Maximize aria-hidden="true" />}
            </button>
          )}
          <button
            type="button"
            className="corner-btn"
            aria-pressed={settings.sfx}
            onClick={() => actions.setSettings({ sfx: !settings.sfx })}
            aria-label={settings.sfx ? 'Desactivar sonidos táctiles (papel, rotulador, clics…)' : 'Activar sonidos táctiles (papel, rotulador, clics…)'}
            title={settings.sfx ? 'Sonidos táctiles activados' : 'Sonidos táctiles desactivados'}
          >
            {settings.sfx ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
          </button>
          <button
            type="button"
            className="guides-toggle"
            aria-pressed={guides}
            onClick={() => actions.setSettings({ showGuides: !guides })}
            title={guides ? 'Ocultar las guías' : 'Resaltar lo que puedes tocar'}
            aria-label={guides ? 'Ocultar las guías' : 'Mostrar guías: resaltar lo que puedes tocar'}
          >
            <Sparkles aria-hidden="true" />
            <span>Guías</span>
          </button>
        </div>
      )}
      {camera.cover && inRoom && (
        <>
          <ScrollChevron dir="left" className="room-chevron room-chevron--left" available={edges.left} onClick={() => panBy(camera.vw * 0.55)} />
          <ScrollChevron dir="right" className="room-chevron room-chevron--right" available={edges.right} onClick={() => panBy(-camera.vw * 0.55)} />
        </>
      )}
      {fsHint && (
        <p className="fs-hint" role="status">
          {fsHint}
        </p>
      )}
    </div>
  );
}
