// MAIN_ROOM · "Mediterranean Cozy Room" (SPEC §2–§3, §16.7): la ilustración nueva en su escenario cover, con
// todos los objetos diegéticos recalibrados sobre ella. Imagen, overlays y hotspots comparten UNA
// transformación (SceneStage); no hay parallax independiente ni cámara que exponga bordes vacíos. Con la
// habitación fuera de pantalla, tras un modal o con movimiento reducido, los efectos decorativos se detienen.
import { useEffect, useRef, useState } from 'react';
import { lampClick, matchStrike } from '../../audio/ambientAudio';
import { currentBook, progressLabel } from '../../domain/books';
import { getDeterministicVibe } from '../../utils/vibeEngine';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { HOTSPOTS, ROOMS } from '../../scene/sceneMap';
import { visibleFraction } from '../../scene/stageFit';
import { useLibrary } from '../../state/useLibrary';
import { OnboardingGuide } from '../onboarding/OnboardingGuide';
import { useToday } from '../../hooks/useToday';
import { AmbientLife, BreezeLeaves } from './AmbientLife';
import { BaySailboats } from './BaySailboats';
import { LaptopScreen, OpenBookPages } from './RoomSurfaces';
import { Hotspot, RoomLabel, TimeDial } from './RoomHotspots';
import { CloudShadow, DrinkSteam, SoundWaves, TeaMist } from './RoomLiveData';
import { RoomFigureShelves, RoomShelfBooks } from './RoomShelfBooks';
import { SceneBase } from './SceneBase';
import { SceneStage } from './SceneStage';
import { TeaDrain } from './TeaDrain';
import { TimeOfDayLayers } from './TimeOfDayLayers';

export const ROOM_VIEW = 'ROOM_VIEW';
export const SHELF_VIEW = 'SHELF_VIEW';

/** Recorrido de pistas (solo con «Mostrar guías»): un objeto tras otro se aviva para enseñarte qué tocar. */
const SPOT_ORDER = ['book', 'laptop', 'tray', 'headphones', 'figures', 'shelf', 'lamp', 'lantern', 'sun'];
const SPOT_MS = 2600;
/** Objetos que deben poder alcanzarse aunque el encuadre los recorte (alternativa en un solo control). */
const ESSENTIAL = ['book', 'laptop', 'tray', 'headphones', 'figures', 'shelf', 'lamp', 'lantern'];

function formatTimer(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Avisa de qué objetos deja fuera el encuadre (≥ 75 % recortado) para ofrecerlos en «Guías» (SPEC §19.5). Solo
 * informa cuando cambia la lista; las acciones se leen de una referencia para no quedarse viejas.
 */
function OffscreenReporter({ fit, actionsRef, onChange }) {
  const ids = ESSENTIAL.filter((id) => visibleFraction(fit, HOTSPOTS[id].shape) < 0.25).join(',');
  useEffect(() => {
    onChange?.(ids ? ids.split(',').map((id) => ({ id, title: actionsRef.current[id].title, onActivate: () => actionsRef.current[id].onActivate() })) : []);
  }, [ids, onChange, actionsRef]);
  return null;
}

export function CozyRoom({ active = true, interactive = true, onOpenShelf, onOpenBook, onOpenLaptop, onOpenTray, onToggleSound, onOpenAtlas, onOpenVault, modalOpen = false, timer, guide = null, onReady, onOffscreen }) {
  const { state, actions } = useLibrary();
  const { settings, books, progress } = state;
  const reducedMotion = useReducedMotion();
  const worldRef = useRef(null);
  const [label, setLabel] = useState(null);
  const [spotIndex, setSpotIndex] = useState(0);
  const reading = currentBook(books, settings);
  // Ambiente del libro: solo el de la lectura actual (elegida por ti o la automática de siempre), nunca al
  // pasar por encima de otro libro; desactivable en «Tu cuenta»
  const vibe = settings.bookVibe !== false && reading ? getDeterministicVibe(reading) : null;
  const inRoom = interactive && active;
  // Con un modal delante o la habitación fuera de pantalla, lo decorativo se detiene (el temporizador sigue)
  const live = inRoom && !modalOpen;
  const [base, setBase] = useState({ status: 'loading', attempt: 0 });
  const guides = Boolean(settings.showGuides);

  // Animaciones SVG: en pausa fuera de pantalla, con un modal delante, con la pestaña oculta o con movimiento reducido
  useEffect(() => {
    const apply = () => {
      const run = live && !reducedMotion && document.visibilityState === 'visible';
      worldRef.current?.querySelectorAll('svg').forEach((svg) => (run ? svg.unpauseAnimations?.() : svg.pauseAnimations?.()));
    };
    apply();
    document.addEventListener('visibilitychange', apply);
    return () => document.removeEventListener('visibilitychange', apply);
  }, [live, reducedMotion]);

  const pointing = Boolean(label);
  useEffect(() => {
    if (!guides || !live || reducedMotion || pointing) return undefined;
    const id = setInterval(() => setSpotIndex((i) => (i + 1) % SPOT_ORDER.length), SPOT_MS);
    return () => clearInterval(id);
  }, [guides, live, reducedMotion, pointing]);
  const tourSpot = guides && live && !reducedMotion && !pointing ? SPOT_ORDER[spotIndex] : null;
  // Durante la guía se avivan el objeto de la parada y sus secundarios (una sola tarjeta, sin globos sueltos)
  const guideSpots = guide?.visible ? [guide.stop.anchor, ...guide.stop.secondary] : [];
  const spot = guide?.visible ? null : tourSpot;
  const lit = (id) => spot === id || guideSpots.includes(id);

  // Lista para la guía: ilustración decodificada (la geometría ya está medida por el escenario)
  const readyRef = useRef(onReady);
  useEffect(() => {
    readyRef.current = onReady;
  }, [onReady]);
  useEffect(() => {
    readyRef.current?.(base.status === 'ok');
  }, [base.status]);

  const onHover = (next, id) => {
    if (next) setLabel(next);
    else setLabel((current) => (!id || current?.id === id || current?.id?.startsWith('spine') ? null : current));
  };

  // Nivel del té: se vacía durante la lectura y se rellena en el descanso
  const inSession = timer.running || timer.remaining < timer.total;
  const teaLevel = inSession ? (timer.phase === 'focus' ? timer.remaining / timer.total : 1 - timer.remaining / timer.total) : null;

  const readThisYear = books.filter((b) => b.status === 'read' && b.finishedAt?.startsWith(String(new Date().getFullYear()))).length;
  const timerText = timer.running ? `${timer.phase === 'focus' ? 'Leyendo' : 'Descanso'} · ${formatTimer(timer.remaining)}` : null;
  // Día local (cambia a medianoche y al volver a la app): lo usa la pantalla del portátil
  const today = useToday();

  const openBook = () => (reading ? onOpenBook(reading) : onOpenShelf());
  const toggleLamp = () => {
    lampClick();
    actions.setSettings({ lampOn: !settings.lampOn });
  };
  const toggleCandle = () => {
    matchStrike(!settings.candleOn);
    actions.setSettings({ candleOn: !settings.candleOn });
  };
  const ACTIONS = {
    book: { title: reading ? `Libro abierto: ${reading.title}` : 'Libro abierto', onActivate: openBook },
    laptop: { title: 'Portátil: estadísticas y calendario', onActivate: onOpenLaptop },
    tray: { title: 'Té helado: temporizador', onActivate: onOpenTray },
    headphones: { title: 'Auriculares: sonido ambiental', onActivate: onToggleSound },
    figures: { title: 'Vitrina de figuras: El Ático', onActivate: () => onOpenVault() },
    shelf: { title: 'Mi librería', onActivate: onOpenShelf },
    lamp: { title: settings.lampOn ? 'Lámpara: apagar' : 'Lámpara: encender', onActivate: toggleLamp },
    lantern: { title: settings.candleOn ? 'Vela: soplar' : 'Vela: encender', onActivate: toggleCandle },
  };
  const actionsRef = useRef(ACTIONS);
  useEffect(() => {
    actionsRef.current = ACTIONS;
  });

  return (
    <SceneStage
      room={ROOMS.MAIN_ROOM}
      className="room-camera"
      data-view={ROOM_VIEW}
      data-modal={modalOpen || undefined}
      data-pointing={pointing}
      data-guides={guides}
      data-live={live || undefined}
      data-shelf-awake={spot === 'shelf' || label?.id === 'shelf' || Boolean(label?.id?.startsWith('spine'))}
      overlay={(fit) => (
        <>
          {/* Si la ilustración no llega, se dice y se puede reintentar: nada de objetos flotando sobre un hueco */}
          {base.status === 'error' && (
            <div className="scene-error paper-sheet" role="alert">
              <p>No se ha podido cargar la ilustración de la habitación.</p>
              <button type="button" className="scene-error__retry" onClick={() => setBase((b) => ({ status: 'loading', attempt: b.attempt + 1 }))}>
                Reintentar
              </button>
            </div>
          )}
          {guide?.visible && inRoom && <OnboardingGuide guide={guide} fit={fit} reducedMotion={reducedMotion} />}
          {/* Etiqueta informativa: interfaz en píxeles de pantalla, nunca dentro del lienzo escalado (ni durante
              el cambio de habitación, ni con la guía o un panel abiertos) */}
          {/* Anotaciones de la habitación en píxeles de pantalla (capa sin eventos): el temporizador sobre el vaso */}
          <div className="room-annotations">{inRoom && <TeaMist timer={timer} fit={fit} />}</div>
          {live && !guide?.visible && <RoomLabel label={label} fit={fit} />}
          <OffscreenReporter fit={fit} actionsRef={actionsRef} onChange={onOffscreen} />
        </>
      )}
    >
      {(fit) => (
      <div ref={worldRef} className="world" data-base={base.status}>
        {/* 0 · ilustración */}
        <SceneBase room={ROOMS.MAIN_ROOM} attempt={base.attempt} onStatus={(status) => setBase((b) => (b.status === status ? b : { ...b, status }))} />

        {/* 5 · veleros de la bahía, recortados por la máscara del agua (detrás de la luz del día) */}
        <BaySailboats roomId="MAIN_ROOM" sea={ROOMS.MAIN_ROOM.sea} active={live} reducedMotion={reducedMotion} />
        <AmbientLife active={live} reducedMotion={reducedMotion} candleOn={settings.candleOn} timeOfDay={settings.timeOfDay} />
        <BreezeLeaves active={live} reducedMotion={reducedMotion} />

        {/* 8 · superficies integradas en la ilustración (lomos, pantalla y su primer plano, páginas del libro):
            debajo de la luz y la atmósfera, que las tiñen igual que al resto de la habitación (SPEC §21.1) */}
        <div className="room-surfaces">
          <RoomShelfBooks books={books} currentId={reading?.id} onOpenShelf={onOpenShelf} onHover={onHover} active={live} scale={fit.scale} awake={spot === 'shelf' || label?.id === 'shelf' || Boolean(label?.id?.startsWith('spine'))} />
          <LaptopScreen today={today} running={live && !reducedMotion} />
          <OpenBookPages book={reading} />
        </div>

        {/* 10 · luz y atmósfera (sin geometría heredada) */}
        <TimeOfDayLayers timeOfDay={settings.timeOfDay} lampOn={settings.lampOn} candleOn={settings.candleOn} vibe={vibe} />
        <CloudShadow timeOfDay={live ? settings.timeOfDay : 'night'} />

        {/* 20 · objetos dinámicos integrados en la ilustración */}
        <div className="room-objects">
          <RoomFigureShelves figures={progress.figures} onOpenVault={onOpenVault} onHover={onHover} />
          <TeaDrain level={teaLevel} />
          <DrinkSteam drink={settings.drink} active={timer.running} />
          <SoundWaves on={settings.sound && live} />
        </div>

        {/* 30 · hotspots (la librería general primero: los objetos concretos van por encima) */}
        <div className="room-hotspots">
          <Hotspot id="shelf" spot={lit('shelf')} guides={guides} hint={1} onHover={onHover} onActivate={onOpenShelf} label={{ title: 'Mi librería de roble', text: `${books.length} libros · toca para acercarte` }} />
          <Hotspot
            id="figures"
            spot={lit('figures')}
            guides={guides}
            hint={2}
            onHover={onHover}
            onActivate={() => onOpenVault()}
            label={{ title: 'Vitrina de figuras', text: `${Object.keys(progress.figures?.owned ?? {}).length} figuras · toca para subir al Ático`, meta: progress.figures?.boxes ? `🎁 ${progress.figures.boxes} Caja${progress.figures.boxes === 1 ? '' : 's'} Sorpresa por abrir` : undefined }}
          />
          <Hotspot
            id="book"
            spot={lit('book')}
            guides={guides}
            hint={0}
            onHover={onHover}
            onActivate={openBook}
            label={
              reading
                ? { title: reading.title, text: reading.author, meta: progressLabel(reading), aria: `Leyendo ahora: ${reading.title}, de ${reading.author}, ${progressLabel(reading).toLowerCase()}. Abrir libro` }
                : { title: 'Ningún libro abierto', text: 'Elige uno en tu librería' }
            }
          />
          <Hotspot id="laptop" spot={lit('laptop')} guides={guides} hint={3} onHover={onHover} onActivate={onOpenLaptop} label={{ title: 'Estadísticas y reto anual', text: `${readThisYear} de ${settings.yearGoal} libros este año`, meta: 'Calendario · Misiones del Booknook' }} />
          <Hotspot
            id="headphones"
            spot={lit('headphones')}
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
          <Hotspot id="tray" spot={lit('tray')} guides={guides} hint={7} onHover={onHover} onActivate={onOpenTray} label={{ title: 'Temporizador cozy', text: timerText ?? 'Té helado · elige tu bebida' }} />
          <Hotspot id="lamp" spot={lit('lamp')} guides={guides} hint={13} onHover={onHover} onActivate={toggleLamp} label={{ title: 'Lámpara de latón', text: settings.lampOn ? 'Encendida · tocar para apagar' : 'Apagada · tocar para encender' }} />
          <Hotspot id="lantern" spot={lit('lantern')} guides={guides} hint={15} onHover={onHover} onActivate={toggleCandle} label={{ title: 'Vela de la mesita', text: settings.candleOn ? 'Encendida · tocar para soplar' : 'Apagada · tocar para encenderla' }} />
          <TimeDial timeOfDay={settings.timeOfDay} onOpen={onOpenAtlas} onHover={onHover} spot={lit('sun')} />
        </div>

      </div>
      )}
    </SceneStage>
  );
}
