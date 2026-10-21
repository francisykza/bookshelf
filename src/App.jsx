// BookShelf — "Mediterranean Cozy Reading Sanctuary" (SPEC.md). Interfaz diegética: la habitación es
// el menú. Este componente coordina la cámara, los objetos que se acercan, el sonido y el temporizador.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { bell, isAmbiencePlaying, setAmbience, setSfx, setTimeOfDay } from './audio/ambientAudio';
import { timeOfDayByClock } from './domain/dates';
import { BookDetailModal } from './components/book/BookDetailModal';
import { AccountPanel } from './components/panels/AccountPanel';
import { LaptopPanel } from './components/panels/LaptopPanel';
import { PomodoroTray } from './components/panels/PomodoroTray';
import { SagaMapModal } from './components/panels/SagaMapModal';
import { FiguresVaultModal } from './components/figures/FiguresVaultModal';
import { CozyRoom, ROOM_VIEW, SHELF_VIEW } from './components/room/CozyRoom';
import { AddBookCard } from './components/shelf/AddBookCard';
import { ShelfView } from './components/shelf/ShelfView';
import { useReadingTimer } from './hooks/useReadingTimer';
import { useReducedMotion } from './hooks/useReducedMotion';
import { ENTERING, ROOM, SHELF, useShelfTransition } from './hooks/useShelfTransition';
import { fitCamera } from './scene/camera';
import { CloudProvider } from './state/cloudSync';
import { LibraryProvider, useLibrary } from './state/useLibrary';

/**
 * Tamaño real del escenario (SPEC §12.2): se mide el contenedor con ResizeObserver y se escribe una sola vez
 * por fotograma, solo si cambia. Durante un pinch-zoom (visualViewport.scale ≠ 1) no se reencuadra.
 */
function useStageSize(ref) {
  const [size, setSize] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const vv = window.visualViewport;
        if (vv && Math.abs(vv.scale - 1) > 0.01) return;
        const w = Math.round(node.clientWidth);
        const h = Math.round(node.clientHeight);
        if (!w || !h) return;
        setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    window.visualViewport?.addEventListener('resize', measure);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.visualViewport?.removeEventListener('resize', measure);
    };
  }, [ref]);
  return size;
}

function Sanctuary() {
  const { state, actions } = useLibrary();
  const { settings } = state;
  const stageRef = useRef(null);
  const size = useStageSize(stageRef);
  const camera = useMemo(() => fitCamera(size.w, size.h), [size]);
  const k = camera.scale;
  const reducedMotion = useReducedMotion();
  const { phase, toShelf, toRoom, onTransitionEnd } = useShelfTransition({ reducedMotion, mobile: camera.cover });
  // La cámara de escritorio se acerca mientras la librería entra y se aleja mientras sale
  const view = phase === ENTERING || phase === SHELF ? SHELF_VIEW : ROOM_VIEW;
  const [panel, setPanel] = useState(null);
  const [askPages, setAskPages] = useState(false);

  const onFocusDone = useCallback((minutes) => {
    bell();
    actions.logPomodoro(minutes ?? settings.focusMinutes, settings.drink);
    setAskPages(true);
    setPanel((p) => p ?? { type: 'tray' });
  }, [actions, settings.focusMinutes, settings.drink]);

  const timer = useReadingTimer({
    focusMinutes: settings.focusMinutes,
    breakMinutes: settings.breakMinutes,
    onFocusDone,
    onBreakDone: bell,
  });

  // El sonido solo puede arrancar tras un gesto: el AudioContext se crea al pulsar los auriculares
  const toggleSound = () => {
    // Si estaba activado pero aún no había sonado (sin gesto previo), el primer toque lo enciende
    if (settings.sound && !isAmbiencePlaying()) {
      setAmbience(true);
      return;
    }
    const next = !settings.sound;
    actions.setSettings({ sound: next });
    setAmbience(next);
  };

  // Sonido activado por defecto: arranca con el primer toque o tecla en cualquier parte de la página
  useEffect(() => {
    if (!settings.sound) return undefined;
    const start = (event) => {
      if (event.target instanceof Element && event.target.closest('[data-id="headphones"]')) return;
      setAmbience(true);
      cleanup();
    };
    const cleanup = () => {
      window.removeEventListener('pointerdown', start, true);
      window.removeEventListener('keydown', start, true);
    };
    window.addEventListener('pointerdown', start, true);
    window.addEventListener('keydown', start, true);
    return cleanup;
  }, [settings.sound]);

  // La escena sigue al reloj (mañana, atardecer, noche) mientras no la cambies a mano
  useEffect(() => {
    if (!settings.timeAuto) return undefined;
    const sync = () => {
      const byClock = timeOfDayByClock();
      if (byClock !== settings.timeOfDay) actions.setSettings({ timeOfDay: byClock });
    };
    const id = setInterval(sync, 60000);
    return () => clearInterval(id);
  }, [settings.timeAuto, settings.timeOfDay, actions]);

  // Sonidos táctiles (papel, rotulador, ronroneo…) desactivables
  useEffect(() => setSfx(settings.sfx !== false), [settings.sfx]);

  // El ambiente sonoro sigue a la hora: grillos de noche, chicharras y gaviotas al atardecer
  useEffect(() => setTimeOfDay(settings.timeOfDay), [settings.timeOfDay]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape' && !panel && (phase === SHELF || phase === ENTERING)) toRoom();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panel, phase, toRoom]);

  const close = useCallback(() => setPanel(null), []);
  const openBook = (book) => setPanel({ type: 'book', id: book.id });

  return (
    <main ref={stageRef} className="sanctuary" data-view={view} data-phase={phase} inert={panel ? true : undefined}>
      <div className="backdrop" aria-hidden="true" />
      <h1 className="sr-only-focus">BookShelf, tu santuario de lectura junto al mar</h1>
      <CozyRoom
        k={k}
        camera={camera}
        view={view}
        interactive={phase === ROOM}
        hidden={phase === SHELF}
        timer={timer}
        onOpenShelf={toShelf}
        onOpenBook={openBook}
        onOpenLaptop={() => setPanel({ type: 'laptop' })}
        onOpenTray={() => setPanel({ type: 'tray' })}
        onToggleSound={toggleSound}
        onOpenAtlas={() => setPanel({ type: 'atlas' })}
        onOpenVault={(id) => setPanel({ type: 'vault', id })}
        onOpenAccount={() => setPanel({ type: 'account' })}
        modalOpen={Boolean(panel)}
      />
      <ShelfView
        phase={phase}
        onTransitionEnd={onTransitionEnd}
        onBack={toRoom}
        onOpenBook={openBook}
        onAddBook={() => setPanel({ type: 'add' })}
        onOpenVault={(id) => setPanel({ type: 'vault', id })}
      />

      {panel?.type === 'book' && <BookDetailModal key={panel.id} bookId={panel.id} onClose={close} onSwitch={(id) => setPanel({ type: 'book', id })} />}
      {panel?.type === 'laptop' && <LaptopPanel onClose={close} initialTab={panel.tab} onOpenVault={() => setPanel({ type: 'vault' })} />}
      {panel?.type === 'vault' && <FiguresVaultModal onClose={close} initialId={panel.id} />}
      {panel?.type === 'tray' && (
        <PomodoroTray
          onClose={() => {
            setAskPages(false);
            close();
          }}
          timer={timer}
          askPages={askPages}
          onPagesDone={() => setAskPages(false)}
          onOpenCalendar={() => {
            setAskPages(false);
            setPanel({ type: 'laptop', tab: 'calendar' });
          }}
        />
      )}
      {panel?.type === 'atlas' && <SagaMapModal onClose={close} onOpenBook={openBook} />}
      {panel?.type === 'account' && <AccountPanel onClose={close} />}
      {panel?.type === 'add' && <AddBookCard onClose={close} onAdded={toShelf} />}
    </main>
  );
}

export default function App() {
  return (
    <LibraryProvider>
      <CloudProvider>
        <Sanctuary />
      </CloudProvider>
    </LibraryProvider>
  );
}
