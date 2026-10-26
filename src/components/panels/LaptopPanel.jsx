// Ordenador (SPEC §34): un pequeño escritorio digital mediterráneo. Fondo de la bahía, barra superior con BookShelf
// y la hora, una ventana marfil con la app activa y un dock con seis apps. Cerrar la app (✕ de la ventana) vuelve
// al escritorio con el dock; «Salir» vuelve a la habitación. Las apps abiertas se conservan ocultas al cambiar de una
// a otra: un formulario a medias no se pierde, y salir con uno escrito pide confirmación.
import { LogOut, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { dayKey } from '../../domain/dates';
import { summarize } from '../../domain/reading';
import { useNow } from '../../hooks/useReducedMotion';
import { useLibrary } from '../../state/useLibrary';
import { GoalApp, MissionsApp, StatsApp } from '../computer/ComputerApps';
import { SectionIcon } from '../SectionIcon';
import { DailyQuote, dailyQuoteReady } from './DailyQuote';
import { DiaryApp } from './DiaryApp';
import { PanelShell } from './PanelShell';
import { SessionsApp } from './ReadingCalendar';

// `id` se conserva (rutas y paneles guardados); `short` es el rótulo del dock y `icon` su imagen ilustrada
const TABS = [
  { id: 'calendar', label: 'Mi diario', short: 'Diario', icon: 'diario' },
  { id: 'stats', label: 'Estadísticas', short: 'Datos', icon: 'datos' },
  { id: 'sessions', label: 'Sesiones', short: 'Sesiones', icon: 'sesiones' },
  { id: 'goal', label: 'Reto anual', short: 'Reto', icon: 'reto' },
  { id: 'missions', label: 'Misiones y Guardián', short: 'Misiones', icon: 'misiones' },
  { id: 'quote', label: 'Citas', short: 'Citas', icon: 'citas' },
];

export function LaptopPanel({ onClose, initialTab = 'calendar', selectDay = null, onComplete, onOpenLibrary, onOpenVault, onOpenBook }) {
  const { state } = useLibrary();
  const start = TABS.some((t) => t.id === initialTab) ? initialTab : 'calendar';
  const [app, setApp] = useState(start);
  // Apps montadas (la activa y las que guardan algo a medias)
  const [alive, setAlive] = useState([start]);
  const [confirmExit, setConfirmExit] = useState(false);
  const screenRef = useRef(null);
  // Apps con algo escrito en un formulario aún abierto
  const touched = useRef(new Set());
  const now = useNow(30000);
  const year = new Date().getFullYear();

  const pending = (id) => touched.current.has(id) && Boolean(screenRef.current?.querySelector(`[data-pc-app="${id}"] form`));
  const open = (id) => {
    setConfirmExit(false);
    setApp(id);
    setAlive((list) => (list.includes(id) ? list : [...list, id]));
  };
  const closeApp = () => {
    const id = app;
    setApp(null);
    if (!pending(id)) {
      touched.current.delete(id);
      setAlive((list) => list.filter((x) => x !== id));
    }
  };
  const requestExit = () => {
    if (TABS.some((t) => pending(t.id))) setConfirmExit(true);
    else onClose();
  };
  const today = summarize(
    state.progress.readingLog.filter((e) => e.date === dayKey()),
    state.books,
  );

  return (
    <PanelShell onClose={requestExit} label="Ordenador: Mi diario y apps de lectura" variant="laptop">
      <div className="pc" data-app={app ?? 'desktop'}>
        <header className="pc__bar">
          <button type="button" className="pc__exit" onClick={requestExit} aria-label="Salir del ordenador">
            <LogOut aria-hidden="true" />
            <span>Salir</span>
          </button>
          <span className="pc__brand">BookShelf</span>
          <time className="pc__time" dateTime={new Date(now).toISOString()}>
            {new Date(now).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
          </time>
        </header>

        {confirmExit && (
          <div className="pc__confirm" role="alertdialog" aria-labelledby="pc-confirm-text">
            <p id="pc-confirm-text">Tienes un formulario a medias. Si sales del ordenador, se perderá lo que no hayas guardado.</p>
            <div>
              <button type="button" className="pc-btn pc-btn--ghost" onClick={() => setConfirmExit(false)} autoFocus>
                Seguir aquí
              </button>
              <button type="button" className="pc-btn pc-btn--primary" onClick={onClose}>
                Salir
              </button>
            </div>
          </div>
        )}

        <div
          ref={screenRef}
          className="pc__screen"
          onInput={(e) => {
            const id = e.target.closest?.('[data-pc-app]')?.dataset.pcApp;
            if (id) touched.current.add(id);
          }}
        >
          {!app && (
            <div className="pc-home">
              <p className="pc-home__day">{new Date(now).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
              <p className="pc-home__note">{today.text ? `Hoy: ${today.text}` : 'Hoy aún no has registrado lectura.'}</p>
              <p className="pc-home__hint">Elige una aplicación en el dock.</p>
            </div>
          )}
          {TABS.filter((t) => alive.includes(t.id)).map((t) => (
            <section key={t.id} className="pc-win" data-pc-app={t.id} id={`pc-app-${t.id}`} hidden={app !== t.id} aria-labelledby={`pc-title-${t.id}`}>
              <header className="pc-win__head">
                <SectionIcon name={t.icon} size={36} className="pc-win__icon" />
                <h2 className="pc-win__title" id={`pc-title-${t.id}`}>
                  {t.label}
                </h2>
                {t.id === 'goal' && <span className="pc-win__meta">{year}</span>}
                <button type="button" className="pc-win__close" onClick={closeApp} aria-label={`Cerrar ${t.label}`}>
                  <X aria-hidden="true" />
                </button>
              </header>
              <div className="pc-win__body">
                {t.id === 'calendar' && <DiaryApp selectDay={selectDay} onComplete={onComplete} onOpenLibrary={onOpenLibrary} onOpenBook={onOpenBook} />}
                {t.id === 'stats' && <StatsApp />}
                {t.id === 'sessions' && <SessionsApp />}
                {t.id === 'goal' && <GoalApp />}
                {t.id === 'missions' && <MissionsApp onOpenVault={onOpenVault} />}
                {t.id === 'quote' && <DailyQuote />}
              </div>
            </section>
          ))}
        </div>

        <nav className="pc-dock" role="tablist" aria-label="Aplicaciones del ordenador">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={app === t.id} aria-controls={alive.includes(t.id) ? `pc-app-${t.id}` : undefined} aria-label={t.label} data-app={t.id} onClick={() => open(t.id)}>
              <span className="pc-dock__icon">
                <SectionIcon name={t.icon} size={32} />
                {t.id === 'quote' && dailyQuoteReady(state) && <i className="pc-dock__badge" aria-label="(sobre por abrir)" />}
              </span>
              <span className="pc-dock__label" aria-hidden="true">
                {t.short}
              </span>
            </button>
          ))}
        </nav>
      </div>
    </PanelShell>
  );
}
