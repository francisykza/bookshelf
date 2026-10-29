// BookShelf — "Mediterranean Cozy Reading Sanctuary" (SPEC.md). Interfaz diegética: la habitación es
// el menú. Este componente coordina el panorama de habitaciones, la librería, los paneles, el sonido y el
// temporizador. Cambiar de habitación es estado de interfaz: no recrea proveedores ni toca la biblioteca.
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isAmbiencePlaying, setAmbience, setSfx, setTimeOfDay } from './audio/ambientAudio';
import { playUiSound, setUiVolume } from './audio/uiSounds';
import { timeOfDayByClock } from './domain/dates';
import { BookDetailModal } from './components/book/BookDetailModal';
import { AccountPanel } from './components/panels/AccountPanel';
import { LibrarianPanel } from './components/panels/LibrarianPanel';
import { LaptopPanel } from './components/panels/LaptopPanel';
import { PomodoroTray } from './components/panels/PomodoroTray';
import { LogUndoToast, ReadingLogSheet } from './components/panels/ReadingLogSheet';
import { describeEntry } from './domain/reading';
import { ReviewSheet } from './components/panels/ReviewSheet';
import { dayKey } from './domain/dates';
import { SagaMapModal } from './components/panels/SagaMapModal';
import { FigureDetail } from './components/figures/FigureDetail';
import { FiguresVaultModal } from './components/figures/FiguresVaultModal';
import { CozyRoom, ROOM_VIEW, SHELF_VIEW } from './components/room/CozyRoom';
import { PanoramicRoom } from './components/room/PanoramicRoom';
import { RoomCorner } from './components/room/RoomCorner';
import { SocialRoom } from './components/room/SocialRoom';
import { AddBookCard } from './components/shelf/AddBookCard';
import { ShelfView } from './components/shelf/ShelfView';
import { useReadingTimer } from './hooks/useReadingTimer';
import { useAppNavigation } from './hooks/useAppNavigation';
import { useOnboarding } from './hooks/useOnboarding';
import { useReducedMotion } from './hooks/useReducedMotion';
import { ENTERING, ROOM, SHELF, useShelfTransition } from './hooks/useShelfTransition';
import { CloudProvider } from './state/cloudSync';
import { CommunityProvider } from './features/social/hooks/useCommunity';
import { GuardianCard } from './features/social/components/GuardianCard';
import { InviteHandler } from './features/social/components/InviteHandler';
import { LibraryProvider, useLibrary } from './state/useLibrary';

// La comunidad se descarga solo al abrirla (SPEC §25.13)
const SocialHub = lazy(() => import('./features/social/components/SocialHub').then((m) => ({ default: m.SocialHub })));
const GoodreadsImportPanel = lazy(() => import('./features/imports/GoodreadsImportPanel').then((m) => ({ default: m.GoodreadsImportPanel })));
const ReaderProfile = lazy(() => import('./features/social/components/ReaderProfile').then((m) => ({ default: m.ReaderProfile })));

/** Un día local `YYYY-MM-DD` (el `select` de la navegación del calendario). */
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function Sanctuary() {
  const { state, actions } = useLibrary();
  const { settings } = state;
  const reducedMotion = useReducedMotion();
  // La librería entra por encima del panorama con un fundido corto (sin el zoom de cámara de versiones anteriores)
  const { phase, toShelf, toRoom, onTransitionEnd } = useShelfTransition({ reducedMotion, mobile: true });
  const view = phase === ENTERING || phase === SHELF ? SHELF_VIEW : ROOM_VIEW;
  // Ubicación con historial real (SPEC §13.3): vista y panel salen del historial; Atrás vuelve al destino
  // interno anterior antes de abandonar BookShelf
  const { location, nav } = useAppNavigation();
  const panel = useMemo(() => {
    const p = location.panel;
    if (!p) return null;
    // Un libro que ya no existe (recarga tras borrarlo) cae al destino seguro
    if (p.type === 'book' && !state.books.some((b) => b.id === p.id)) return null;
    return p;
  }, [location.panel, state.books]);
  const locRef = useRef(location);
  useEffect(() => {
    locRef.current = location;
  }, [location]);
  // Control que abrió el panel: se guarda ANTES de abrir (al volverse inerte la habitación, el navegador le
  // quita el foco) y se le devuelve al cerrar, ya sin `inert`
  const opener = useRef(null);
  const openPanel = useCallback(
    (p) => {
      if (!locRef.current.panel && document.activeElement instanceof HTMLElement && document.activeElement !== document.body) opener.current = document.activeElement;
      nav.go({ view: locRef.current.view, panel: p });
    },
    [nav],
  );
  const hadPanel = useRef(false);
  // Tipo del último panel abierto: al cerrar un libro suena su cubierta (más suave que el resto)
  const lastPanel = useRef(null);
  useEffect(() => {
    if (panel) {
      hadPanel.current = true;
      lastPanel.current = panel.type;
      return undefined;
    }
    if (!hadPanel.current) return undefined;
    hadPanel.current = false;
    const el = opener.current;
    opener.current = null;
    // Un solo sonido al cerrar cualquier panel: la cubierta del libro o papel amortiguado
    playUiSound(lastPanel.current === 'book' ? 'bookClose' : 'close');
    const id = requestAnimationFrame(() => {
      if (el?.isConnected && !el.closest('[inert]')) el.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(id);
  }, [panel]);
  const switchPanel = useCallback((p) => nav.replace({ view: locRef.current.view, panel: p }), [nav]);
  // Una reseña no se restaura al recargar (sería abrirla al hidratar): vuelve al calendario de ese día
  useEffect(() => {
    if (locRef.current.panel?.type === 'review') switchPanel({ type: 'laptop', tab: 'calendar', select: locRef.current.panel.select });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [askPages, setAskPages] = useState(false);
  // Último registro hecho desde el libro de la cama: «Deshacer» lo revierte entero (registro, posición y sellos)
  const [undoLog, setUndoLog] = useState(null);
  const dismissUndo = useCallback(() => setUndoLog(null), []);
  const undoLastLog = () => {
    if (!undoLog) return;
    actions.revertLog(undoLog.entry.id, undoLog.before, undoLog.figuresBefore);
    setTimeout(() => actions.persistNow(), 0);
    setUndoLog(null);
  };
  // Guía diegética (Anexo B): arranca con MAIN_ROOM decodificada y medida, quieta y sin nada prioritario abierto
  const [mainReady, setMainReady] = useState(false);
  // Objetos que el encuadre deja fuera: se ofrecen en el menú de «Guías» (SPEC §19.5)
  const [offscreen, setOffscreen] = useState([]);
  const [settledRoom, setSettledRoom] = useState(null);
  const guide = useOnboarding({ ready: mainReady, blocked: Boolean(panel) || phase !== ROOM || settledRoom !== 'MAIN_ROOM' });

  // La vista sigue a la ubicación: la máquina de transición hace el resto
  useEffect(() => {
    if (location.view === 'shelf') toShelf();
    else toRoom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.view]);

  const onFocusDone = useCallback((minutes) => {
    playUiSound('sessionEnd', { force: true });
    actions.logPomodoro(minutes ?? settings.focusMinutes, settings.drink);
    setAskPages(true);
    if (!locRef.current.panel) openPanel({ type: 'tray' });
  }, [actions, settings.focusMinutes, settings.drink, openPanel]);

  const timer = useReadingTimer({
    focusMinutes: settings.focusMinutes,
    breakMinutes: settings.breakMinutes,
    onFocusDone,
    onBreakDone: () => playUiSound('sessionEnd', { force: true }),
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

  // Sonidos táctiles (papel, rotulador, ronroneo…) desactivables, con su volumen propio
  useEffect(() => setSfx(settings.sfx !== false), [settings.sfx]);
  useEffect(() => setUiVolume(settings.uiVolume ?? 0.25), [settings.uiVolume]);

  // El ambiente sonoro sigue a la hora: grillos de noche, chicharras y gaviotas al atardecer
  useEffect(() => setTimeOfDay(settings.timeOfDay), [settings.timeOfDay]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape' && !panel && (phase === SHELF || phase === ENTERING)) nav.back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panel, phase, nav]);

  // Cerrar y Volver usan la misma navegación que el gesto Atrás
  const close = nav.back;
  const openBook = (book) => openPanel({ type: 'book', id: book.id });
  const openShelf = () => {
    playUiSound('libraryOpen');
    nav.go({ view: 'shelf', panel: null });
  };

  return (
    <main className="sanctuary" data-view={view} data-phase={phase} inert={panel ? true : undefined}>
      <h1 className="sr-only-focus">BookShelf, tu santuario de lectura junto al mar</h1>
      {/* Con un panel abierto o la librería delante, el panorama no cambia de habitación */}
      <PanoramicRoom
        locked={Boolean(panel) || phase !== ROOM || guide.active}
        reducedMotion={reducedMotion}
        forceMain={guide.active}
        onSettled={setSettledRoom}
        controls={phase === ROOM ? <RoomCorner onOpenAccount={() => openPanel({ type: 'account' })} onStartGuide={guide.start} onToggleSound={toggleSound} guideActive={guide.active} offscreen={offscreen} /> : null}
        renderMain={(active) => (
          <CozyRoom
            active={active}
            interactive={phase === ROOM}
            timer={timer}
            onOpenShelf={openShelf}
            onOpenBook={openBook}
            onOpenLaptop={() => {
              playUiSound('computerOn');
              openPanel({ type: 'laptop', select: 'today' });
            }}
            onOpenTray={() => openPanel({ type: 'tray' })}
            onLogReading={(book) => {
              playUiSound('monthTurn');
              setUndoLog(null);
              openPanel({ type: 'log', id: book.id });
            }}
            onToggleSound={toggleSound}
            onOpenAtlas={() => openPanel({ type: 'atlas' })}
            onOpenVault={(id) => {
              playUiSound('atticOpen');
              openPanel({ type: 'vault', id });
            }}
            onOpenFigure={(id) => {
              playUiSound('figureSelect');
              openPanel({ type: 'figure', id });
            }}
            modalOpen={Boolean(panel)}
            guide={guide}
            onReady={setMainReady}
            onOffscreen={setOffscreen}
          />
        )}
        renderSocial={(active, social) => (
          <SocialRoom
            status={social.status}
            attempt={social.attempt}
            onRetry={social.retry}
            active={active && !panel && phase === ROOM}
            reducedMotion={reducedMotion}
            timer={timer}
            onOpenHub={(tab) => {
              playUiSound('visit');
              openPanel({ type: 'social', tab });
            }}
            onOpenReader={(id) => {
              playUiSound('visit');
              openPanel({ type: 'reader', id });
            }}
            onOpenGuardian={(id) => openPanel({ type: 'guardian', id })}
          />
        )}
      />
      <InviteHandler onJoined={(clubId) => openPanel({ type: 'social', tab: 'club', id: clubId })} />
      <ShelfView
        phase={phase}
        onTransitionEnd={onTransitionEnd}
        onBack={nav.back}
        onOpenBook={openBook}
        onAddBook={() => openPanel({ type: 'add' })}
        onAskLibrarian={() => openPanel({ type: 'librarian' })}
        onImport={() => openPanel({ type: 'import' })}
        onOpenVault={(id) => {
          playUiSound('atticOpen');
          openPanel({ type: 'vault', id });
        }}
      />

      {panel?.type === 'book' && <BookDetailModal key={panel.id} bookId={panel.id} initialPage={panel.tab} onClose={close} onSwitch={(id) => switchPanel({ type: 'book', id })} onOpenProfile={() => switchPanel({ type: 'social', tab: 'perfil' })} onOpenReader={(id) => switchPanel({ type: 'reader', id })} onComplete={(id) => switchPanel({ type: 'review', id, tab: 'book' })} />}
      {panel?.type === 'laptop' && (
        <LaptopPanel
          onClose={close}
          initialTab={panel.tab}
          selectDay={panel.select === 'today' ? dayKey() : DAY_RE.test(panel.select ?? '') ? panel.select : null}
          // Una lectura terminada desde el calendario abre su reseña EN LUGAR del calendario (un solo panel)
          onComplete={(bookId, date) => switchPanel({ type: 'review', id: bookId, select: date })}
          onOpenLibrary={() => nav.replace({ view: 'shelf', panel: null })}
          onOpenBook={(id, tab) => switchPanel({ type: 'book', id, tab })}
          onOpenVault={() => {
            playUiSound('atticOpen');
            openPanel({ type: 'vault' });
          }}
        />
      )}
      {panel?.type === 'log' && (
        <ReadingLogSheet
          key={panel.id}
          bookId={panel.id}
          onClose={close}
          onSaved={(entry, meta) => {
            playUiSound('pageLeaves');
            // Si termina el libro, su reseña sustituye a esta vista (onComplete): no se cierra aquí
            if (meta.completes) return;
            const d = describeEntry(entry);
            setUndoLog({ entry, before: meta.before, figuresBefore: meta.figuresBefore, text: d.advance ?? d.position ?? 'guardada' });
            close();
          }}
          // Si el registro termina el libro, su reseña sustituye a la vista de registro (como en la ficha)
          onComplete={(id) => switchPanel({ type: 'review', id, tab: 'book' })}
        />
      )}
      {!panel && <LogUndoToast item={undoLog} onUndo={undoLastLog} onDismiss={dismissUndo} />}
      {panel?.type === 'review' &&<ReviewSheet key={panel.id} bookId={panel.id} onClose={() => switchPanel(panel.tab === 'book' ? { type: 'book', id: panel.id } : { type: 'laptop', tab: 'calendar', select: panel.select })} />}
      {panel?.type === 'vault' && (
        <FiguresVaultModal
          onClose={close}
          initialId={panel.id}
          section={panel.section === 'unbox' ? 'unbox' : 'inspect'}
          // Vitrina ↔ Cámara de Unboxing es un paso de navegación: Atrás desde la cámara vuelve a la vitrina
          onSection={(section, id) => openPanel({ type: 'vault', id: id ?? panel.id, ...(section === 'unbox' ? { section } : null) })}
          onShowInRoom={(id) => switchPanel({ type: 'figure', id })}
        />
      )}
      {panel?.type === 'figure' && <FigureDetail key={panel.id} id={panel.id} onClose={close} />}
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
            playUiSound('computerOn');
            switchPanel({ type: 'laptop', tab: 'calendar' });
          }}
        />
      )}
      {panel?.type === 'atlas' && <SagaMapModal onClose={close} onOpenBook={openBook} />}
      {panel?.type === 'account' && <AccountPanel onClose={close} onOpenProfile={() => switchPanel({ type: 'social', tab: 'perfil' })} />}
      {panel?.type === 'reader' && (
        <Suspense fallback={null}>
          <ReaderProfile userId={panel.id} onClose={close} />
        </Suspense>
      )}
      {panel?.type === 'guardian' && <GuardianCard figureId={panel.id} onClose={close} />}
      {panel?.type === 'import' && (
        <Suspense fallback={null}>
          <GoodreadsImportPanel onClose={close} />
        </Suspense>
      )}
      {panel?.type === 'social' && (
        <Suspense fallback={null}>
          <SocialHub onClose={close} initialTab={panel.tab} timer={timer} openClubId={panel.id ?? null} />
        </Suspense>
      )}
      {panel?.type === 'librarian' && <LibrarianPanel onClose={close} onOpenBook={(book) => switchPanel({ type: 'book', id: book.id })} />}
      {panel?.type === 'add' && <AddBookCard onClose={close} onAdded={() => nav.replace({ view: 'shelf', panel: null })} />}
    </main>
  );
}

export default function App() {
  return (
    <LibraryProvider>
      <CloudProvider>
        <CommunityProvider>
          <Sanctuary />
        </CommunityProvider>
      </CloudProvider>
    </LibraryProvider>
  );
}
