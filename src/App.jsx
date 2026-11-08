// BookShelf — "Mediterranean Cozy Reading Sanctuary" (SPEC.md). Interfaz diegética: la habitación es
// el menú. Este componente coordina el panorama de habitaciones, la librería, los paneles, el sonido y el
// temporizador. Cambiar de habitación es estado de interfaz: no recrea proveedores ni toca la biblioteca.
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { modalRoot } from './components/panels/modalRoot';
import { setTimeOfDay } from './audio/ambientAudio';
import { adoptSettings, connectSettings, resumeSound, setBackgroundSound, soundStarted } from './audio/audioController';
import { playUiSound } from './audio/uiSounds';
import { SoundPanel } from './components/panels/SoundPanel';
import { timeOfDayByClock } from './domain/dates';
import { BookDetailModal } from './components/book/BookDetailModal';
import { AccountPanel } from './components/panels/AccountPanel';
import { LibrarianPanel } from './components/panels/LibrarianPanel';
import { LaptopPanel } from './components/panels/LaptopPanel';
import { PomodoroTray } from './components/panels/PomodoroTray';
import { currentBook } from './domain/books';
import { LogUndoToast, ReadingLogSheet, UNDO_MS } from './components/panels/ReadingLogSheet';
import { describeEntry } from './domain/reading';
import { ReviewSheet } from './components/panels/ReviewSheet';
import { dayKey } from './domain/dates';
import { SagaMapModal } from './components/panels/SagaMapModal';
import { FigureDetail } from './components/figures/FigureDetail';
import { FIGURES_ENABLED } from './domain/figures';
import { FiguresVaultModal } from './components/figures/FiguresVaultModal';
import { CozyRoom, ROOM_VIEW, SHELF_VIEW } from './components/room/CozyRoom';
import { PanoramicRoom } from './components/room/PanoramicRoom';
import { BaldaPanel } from './components/room/BaldaPanel';
import { RoomCorner } from './components/room/RoomCorner';
import { SocialRoom } from './components/room/SocialRoom';
import { RadioPanel } from './features/radio/RadioPanel';
import { HOME_PISO, choose as chooseStart, newRoomAvailable, startsInRoom } from './features/pisoLab/inicio';
import { PRODUCTION_HOST } from './features/pisoLab/sampleLibrary';
import { AddBookCard } from './components/shelf/AddBookCard';
import { ShelfView } from './components/shelf/ShelfView';
import { PerfProfiler } from './perf/PerfProfiler';
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
// 1.58 (SPEC §56): la visita a un rincón se carga solo al abrirla (y el vídeo, solo cuando empieza la entrada)
const ReaderVisit = lazy(() => import('./features/social/components/ReaderVisit').then((m) => ({ default: m.ReaderVisit })));
// Piloto del piso en primera persona (solo laboratorio): se abre con /?piloto=piso; el inicio no cambia
const PISO_MESA = { on: 'Está sobre la mesa', off: 'Dejar sobre la mesa' };
const PisoLabPanel = lazy(() => import('./features/pisoLab/PisoLabPanel').then((m) => ({ default: m.PisoLabPanel })));
const PisoDesktop = lazy(() => import('./features/pisoLab/PisoDesktop').then((m) => ({ default: m.PisoDesktop })));
const EdificioPanel = lazy(() => import('./features/edificio/EdificioPanel').then((m) => ({ default: m.EdificioPanel })));
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
    // 1.67: con las figuras ocultas, una URL antigua del Ático, una figura o un Guardián no abre nada
    if (!FIGURES_ENABLED && ['vault', 'figure', 'guardian'].includes(p.type)) return null;
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
  // Piloto: /?piloto=piso entra directo en el portal de prueba
  // En producción no: su portal de prueba lleva una vecina inventada, y allí no se cargan datos de demostración
  const pilot = useMemo(() => new URLSearchParams(window.location.search).get('piloto') === 'piso' && window.location.hostname !== PRODUCTION_HOST, []);
  useEffect(() => {
    if (pilot && !locRef.current.panel) openPanel({ type: 'pisoLab' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Versión privada (src/features/pisoLab/inicio.js): la habitación es la pantalla de inicio y su puerta lleva al
  // edificio. Sin panel encima, se vuelve a ella; «Volver a la experiencia anterior» lo desactiva en este dispositivo
  const [home, setHome] = useState(() => !pilot && startsInRoom());
  useEffect(() => {
    if (home && !location.panel && location.view === 'room') nav.replace({ view: 'room', panel: { type: 'pisoLab', id: HOME_PISO } });
  }, [home, location.panel, location.view, nav]);
  // Los pisos del piloto (lab-1A, lab-2B y su portal) solo se abren con ?piloto=piso. Una entrada del historial de la 1.87,
  // que sobrevive a recargar, lleva a tu piso (o se cierra con la experiencia anterior): nunca un piso de prueba como tuyo
  useEffect(() => {
    const p = location.panel;
    if (pilot || p?.type !== 'pisoLab' || p.id === HOME_PISO) return;
    nav.replace({ view: location.view, panel: home ? { ...p, id: HOME_PISO } : null });
  }, [pilot, home, location.panel, location.view, nav]);
  // El edificio, a mano antes de tocar la puerta: sin esto, mientras llega se vería la habitación de antes debajo
  useEffect(() => {
    if (!home) return undefined;
    const id = setTimeout(() => import('./features/edificio/EdificioPanel').catch(() => {}), 2500);
    return () => clearTimeout(id);
  }, [home]);
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
  // 1.59 (SPEC §59.7): la caducidad cuenta desde el registro (`at`), no desde que el aviso se monta: abrir y cerrar un
  // panel (que lo oculta) ya no lo hace reaparecer ni reinicia sus 8 s
  useEffect(() => {
    if (!undoLog) return undefined;
    const id = setTimeout(() => setUndoLog((u) => (u === undoLog ? null : u)), Math.max(0, undoLog.at + UNDO_MS - Date.now()));
    return () => clearTimeout(id);
  }, [undoLog]);
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
    if (settings.sound && !soundStarted()) {
      resumeSound();
      return;
    }
    setBackgroundSound(!settings.sound);
  };

  // 1.90: el controlador de sonido manda; los ajustes de siempre lo reflejan, y lo que se cambie en ellos le llega
  useEffect(() => connectSettings((mirror) => actions.setSettings(mirror)), [actions]);
  useEffect(() => adoptSettings({ sound: settings.sound !== false, sfx: settings.sfx !== false, uiVolume: settings.uiVolume ?? 0.25 }), [settings.sound, settings.sfx, settings.uiVolume]);

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
    <main className="sanctuary" data-view={view} data-phase={phase} data-home-3d={home || undefined} inert={panel ? true : undefined}>
      <h1 className="sr-only-focus">BookShelf, tu santuario de lectura junto al mar</h1>
      {/* 1.89.1: con la habitación 3D como destino, la ilustrada sigue montada pero no se ve; hasta que llega el piso, solo este aviso */}
      {home && (
        <p className="home-boot" role="status">
          Abriendo tu piso…
        </p>
      )}
      {/* Con un panel abierto o la librería delante, el panorama no cambia de habitación */}
      <PanoramicRoom
        locked={Boolean(panel) || phase !== ROOM || guide.active}
        reducedMotion={reducedMotion}
        forceMain={guide.active}
        onSettled={setSettledRoom}
        controls={
          phase === ROOM ? (
            <RoomCorner
              onOpenAccount={() => openPanel({ type: 'account' })}
              onStartGuide={guide.start}
              onToggleSound={toggleSound}
              onOpenRadio={() => openPanel({ type: 'radio' })}
              guideActive={guide.active}
              offscreen={offscreen}
              // Mientras dure la prueba: de la experiencia anterior se puede volver a la habitación nueva
              onOpenNewRoom={
                !pilot && newRoomAvailable()
                  ? () => {
                      chooseStart('habitacion');
                      setHome(true);
                    }
                  : null
              }
            />
          ) : null
        }
        renderMain={(active) => (
          <CozyRoom
            active={active}
            interactive={phase === ROOM}
            timer={timer}
            onOpenShelf={openShelf}
            onOpenBook={openBook}
            onOpenBalda={(id, group) => openPanel({ type: 'balda', id, select: String(group) })}
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
            showFigures={FIGURES_ENABLED}
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
            // 1.62 (SPEC §62.2): la visita sabe que viene del salón para volver allí
            onVisit={(id) => {
              playUiSound('visit');
              openPanel({ type: 'visit', id, from: 'salon' });
            }}
            onOpenRadio={() => openPanel({ type: 'radio' })}
            onOpenGuardian={FIGURES_ENABLED ? (id) => openPanel({ type: 'guardian', id }) : null}
            // La música del edificio empieza en este mismo toque (en iOS, fuera de un toque no suena)
            onOpenEdificio={() => openPanel({ type: 'edificio' })}
          />
        )}
      />
      <InviteHandler onJoined={(clubId) => openPanel({ type: 'social', tab: 'club', id: clubId })} />
      <PerfProfiler id="library">
      <ShelfView
        phase={phase}
        onTransitionEnd={onTransitionEnd}
        onBack={nav.back}
        onOpenBook={openBook}
        onAddBook={() => openPanel({ type: 'add' })}
        onAskLibrarian={() => openPanel({ type: 'librarian' })}
        onImport={() => openPanel({ type: 'import' })}
        onOpenVault={
          FIGURES_ENABLED
            ? (id) => {
                playUiSound('atticOpen');
                openPanel({ type: 'vault', id });
              }
            : null
        }
      />
      </PerfProfiler>

      {panel?.type === 'book' && <PerfProfiler id="book"><BookDetailModal key={panel.id} bookId={panel.id} initialPage={panel.tab} onClose={close} onSwitch={(id, tab) => switchPanel({ type: 'book', id, ...(tab ? { tab } : null) })} timer={timer} soundOn={settings.sound} onToggleSound={toggleSound} onOpenProfile={() => switchPanel({ type: 'social', tab: 'perfil' })} onOpenReader={(id) => switchPanel({ type: 'reader', id })} onComplete={(id) => switchPanel({ type: 'review', id, tab: 'book' })} /></PerfProfiler>}
      {panel?.type === 'laptop' && (
        <LaptopPanel
          onClose={close}
          initialTab={panel.tab}
          selectDay={panel.select === 'today' ? dayKey() : DAY_RE.test(panel.select ?? '') ? panel.select : null}
          // Una lectura terminada desde el calendario abre su reseña EN LUGAR del calendario (un solo panel)
          onComplete={(bookId, date) => switchPanel({ type: 'review', id: bookId, select: date })}
          onOpenLibrary={() => nav.replace({ view: 'shelf', panel: null })}
          onOpenBook={(id, tab) => switchPanel({ type: 'book', id, tab })}
          onOpenVault={
            FIGURES_ENABLED
              ? () => {
                  playUiSound('atticOpen');
                  openPanel({ type: 'vault' });
                }
              : null
          }
        />
      )}
      {(panel?.type === 'log' || (panel?.type === 'pisoLab' && panel.select?.startsWith('registro'))) && (
        <ReadingLogSheet
          key={panel.type === 'log' ? panel.id : 'piso-lab'}
          bookId={panel.type === 'log' ? panel.id : currentBook(state.books, settings)?.id}
          initialDate={panel.type === 'pisoLab' ? panel.select.split(':')[1] : undefined}
          onClose={close}
          onSaved={(entry, meta) => {
            playUiSound('pageLeaves');
            // Si termina el libro, su reseña sustituye a esta vista (onComplete): no se cierra aquí
            if (meta.completes) return;
            const d = describeEntry(entry);
            setUndoLog({ entry, before: meta.before, figuresBefore: meta.figuresBefore, text: d.advance ?? d.position ?? 'guardada', at: Date.now() });
            close();
          }}
          // Si el registro termina el libro, su reseña sustituye a la vista de registro (como en la ficha)
          onComplete={(id) => switchPanel(panel.type === 'pisoLab' ? { type: 'review', id, tab: 'piso', select: panel.id } : { type: 'review', id, tab: 'book' })}
        />
      )}
      {!panel && <LogUndoToast item={undoLog} onUndo={undoLastLog} />}
      {/* Piloto: al volver a la habitación tras registrar, el mismo aviso, por encima del panel del piso */}
      {panel?.type === 'pisoLab' && panel.id && (!panel.select || panel.select.startsWith('ordenador')) && createPortal(<LogUndoToast item={undoLog} onUndo={undoLastLog} />, modalRoot())}
      {panel?.type === 'review' &&<ReviewSheet key={panel.id} bookId={panel.id} onClose={() => switchPanel(panel.tab === 'piso' ? { type: 'pisoLab', id: panel.select } : panel.tab === 'book' ? { type: 'book', id: panel.id } : { type: 'laptop', tab: 'calendar', select: panel.select })} />}
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
      {/* Rincón 01: una balda de cerca para elegir el ejemplar; elegirlo abre su ficha y Atrás vuelve a la habitación */}
      {panel?.type === 'balda' && <BaldaPanel key={`${panel.id}-${panel.select}`} shelfId={panel.id} group={panel.select ?? 0} onClose={close} onOpenBook={(book) => switchPanel({ type: 'book', id: book.id })} />}
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
      {panel?.type === 'visit' && (
        <Suspense fallback={<div className="reader-visit-wait" aria-hidden="true" />}>
          <ReaderVisit
            key={panel.id}
            userId={panel.id}
            stage={panel.section === 'habitacion' ? 'habitacion' : 'casa'}
            select={panel.select ?? null}
            // La entrada sustituye su paso en el historial: volver desde la habitación lleva al origen (1.58.1)
            onEnter={() => switchPanel({ type: 'visit', id: panel.id, section: 'habitacion', from: panel.from })}
            onSelect={(select) => openPanel({ type: 'visit', id: panel.id, section: 'habitacion', select, from: panel.from })}
            from={panel.from ?? null}
            onBack={close}
            onProfile={() => openPanel({ type: 'reader', id: panel.id })}
          />
        </Suspense>
      )}
      {panel?.type === 'reader' && (
        <Suspense fallback={null}>
          <ReaderProfile userId={panel.id} onClose={close} />
        </Suspense>
      )}
      {panel?.type === 'pisoLab' && (pilot || panel.id === HOME_PISO) && (
        <Suspense fallback={null}>
          <PisoLabPanel
            pisoId={panel.id ?? null}
            select={panel.select ?? null}
            onOpen={(id) => openPanel({ type: 'pisoLab', id })}
            onSelect={(select) => openPanel({ type: 'pisoLab', id: panel.id, select })}
            onBack={close}
            onClose={close}
            onOpenBook={(book, row) => openPanel({ type: 'pisoLab', id: panel.id, select: `ficha:${row}:${book.id}` })}
            onRegister={() => openPanel({ type: 'pisoLab', id: panel.id, select: 'registro' })}
            onExit={() => switchPanel({ type: 'pisoLab' })}
            onOpenLibrary={() => nav.replace({ view: 'shelf', panel: null })}
            onAddBook={() => openPanel({ type: 'pisoLab', id: panel.id, select: 'abrir:add' })}
            home={home && panel.id === HOME_PISO}
            onOpenAccount={() => openPanel({ type: 'account' })}
            onOpenProfile={() => openPanel({ type: 'social', tab: 'perfil' })}
            // La música del edificio empieza en este mismo toque (en iOS, fuera de un toque no suena)
            onEdificio={() => openPanel({ type: 'edificio' })}
            onAnterior={() => {
              chooseStart('anterior');
              setHome(false);
              nav.replace({ view: 'room', panel: null });
            }}
          />
        </Suspense>
      )}
      {panel?.type === 'pisoLab' && panel.select?.startsWith('ficha:') && (() => {
        const bookId = panel.select.split(':').slice(2).join(':');
        const row = panel.select.split(':')[1];
        return <BookDetailModal key={bookId} bookId={bookId} mainPlace={PISO_MESA} onClose={close} onSwitch={(id, tab) => switchPanel(tab ? { type: 'book', id, tab } : { type: 'pisoLab', id: panel.id, select: `ficha:${row}:${id}` })} timer={timer} soundOn={settings.sound} onToggleSound={toggleSound} onOpenProfile={() => switchPanel({ type: 'social', tab: 'perfil' })} onOpenReader={(id) => switchPanel({ type: 'reader', id })} onComplete={(id) => switchPanel({ type: 'review', id, tab: 'book' })} />;
      })()}
      {panel?.type === 'pisoLab' && panel.select?.startsWith('ordenador') && (() => {
        // El ordenador del piso: 'ordenador' es su escritorio y 'ordenador:app:vista', una pantalla concreta
        const [, tab = null, view = 'today'] = panel.select.split(':');
        const here = (select) => switchPanel({ type: 'pisoLab', id: panel.id, select });
        return (
          <Suspense fallback={null}>
            <LaptopPanel
              key={panel.select}
              onRegister={(date, app, vista) => {
                // Al volver del registro, la misma pantalla del ordenador y no su escritorio
                if (app) here(`ordenador:${app}:${vista}`);
                openPanel({ type: 'pisoLab', id: panel.id, select: date ? `registro:${date}` : 'registro' });
              }}
              onClose={close}
              initialTab={tab}
              diaryView={view}
              onComplete={(bookId) => switchPanel({ type: 'review', id: bookId, tab: 'piso', select: panel.id })}
              onOpenLibrary={() => here('toda')}
              onOpenBook={(id) => here(`ficha:2:${id}`)}
              onOpenVault={null}
              desktop={(open) => <PisoDesktop open={open} tool={(name) => openPanel({ type: 'pisoLab', id: panel.id, select: `abrir:${name}` })} go={{ library: () => here('toda'), community: () => openPanel({ type: 'social' }), register: () => openPanel({ type: 'pisoLab', id: panel.id, select: 'registro' }) }} />}
            />
          </Suspense>
        );
      })()}
      {panel?.type === 'pisoLab' && panel.select?.startsWith('abrir:') && (() => {
        // Las demás herramientas, encima del piso: al cerrarlas se vuelve al ordenador
        const tool = panel.select.slice(6);
        const toBook = (book) => switchPanel({ type: 'pisoLab', id: panel.id, select: `ficha:2:${book.id}` });
        return (
          <Suspense fallback={null}>
            {tool === 'add' && <AddBookCard onClose={close} onAdded={close} />}
            {tool === 'import' && <GoodreadsImportPanel onClose={close} />}
            {tool === 'librarian' && <LibrarianPanel onClose={close} onOpenBook={toBook} />}
            {tool === 'atlas' && <SagaMapModal onClose={close} onOpenBook={toBook} />}
            {tool === 'sonido' && <SoundPanel onClose={close} />}
            {tool === 'radio' && <RadioPanel onClose={close} soundOn={settings.sound} onToggleSound={toggleSound} />}
            {tool === 'account' && <AccountPanel onClose={close} onOpenProfile={() => switchPanel({ type: 'social', tab: 'perfil' })} />}
            {tool === 'tray' && (
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
                  switchPanel({ type: 'pisoLab', id: panel.id, select: 'ordenador:calendar:calendar' });
                }}
              />
            )}
          </Suspense>
        );
      })()}
      {panel?.type === 'edificio' && (
        <Suspense fallback={null}>
          <EdificioPanel
            pisoId={panel.id ?? null}
            soundOn={settings.sound}
            onOpenPiso={(id) => openPanel({ type: 'edificio', id })}
            onClose={close}
            onOpenProfile={() => switchPanel({ type: 'social', tab: 'perfil' })}
            onOpenMissions={() => openPanel({ type: 'laptop', tab: 'missions' })}
            timer={timer}
            askPages={askPages}
            onPagesDone={() => setAskPages(false)}
            onOpenCalendar={() => {
              setAskPages(false);
              playUiSound('computerOn');
              switchPanel({ type: 'laptop', tab: 'calendar' });
            }}
          />
        </Suspense>
      )}
      {panel?.type === 'radio' && <RadioPanel onClose={close} soundOn={settings.sound} onToggleSound={toggleSound} />}
      {panel?.type === 'guardian' && <GuardianCard figureId={panel.id} onClose={close} />}
      {panel?.type === 'import' && (
        <Suspense fallback={null}>
          <GoodreadsImportPanel onClose={close} />
        </Suspense>
      )}
      {panel?.type === 'social' && (
        <Suspense fallback={null}>
          <SocialHub
            onClose={close}
            initialTab={panel.tab ?? 'lectores'}
            timer={timer}
            openClubId={panel.id ?? null}
            // 1.62 (SPEC §62): la pestaña vive en la ubicación; lo tuyo (perfil, rincón) se apila para volver con Atrás
            onTab={(tab, push) => (push ? openPanel : switchPanel)({ type: 'social', tab })}
            onOpenReader={(id) => openPanel({ type: 'reader', id })}
            // 1.62 (SPEC §62.2): Atrás desde la visita vuelve a la pestaña de la que se salió (Lectores o Salón)
            onVisit={(id) => openPanel({ type: 'visit', id, from: (panel.tab ?? 'lectores') === 'sala' ? 'salon' : 'lectores' })}
          />
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
          <PerfProfiler id="app">
            <Sanctuary />
          </PerfProfiler>
        </CommunityProvider>
      </CloudProvider>
    </LibraryProvider>
  );
}
