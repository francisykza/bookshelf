// Controles generales de la esquina (SPEC §16.5, §38.2): «Ambiente» y «Guías» en papel marfil. «Ambiente» agrupa
// la hora del día (clima de la escena), la iluminación (lámpara y vela) y el sonido (ambiente y sonidos táctiles),
// con las mismas preferencias de antes; al final, cuenta y pantalla completa para no perder ninguna función.
// Viven fuera del track del panorama (no se desplazan con la habitación) y respetan el área segura.
import { CircleUser, Map as MapIcon, Moon, Sun, Sunset, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { chime, lampClick, matchStrike } from '../../audio/ambientAudio';
import { useCloud } from '../../state/cloudSync';
import { useLibrary } from '../../state/useLibrary';
import { TOD_ORDER } from './RoomHotspots';

/** Qué indica el punto de color del acceso a la cuenta (solo con estados reales de la sincronización). */
const SYNC_TEXT = { synced: 'Copia en la nube al día', pending: 'Hay cambios por subir', syncing: 'Sincronizando', error: 'La sincronización ha fallado', conflict: 'Hay un conflicto por resolver', offline: 'Sin conexión' };

/** Horas del día con nombre corto e icono (1.47). */
const TIMES = { morning: { label: 'Mañana', Icon: Sun }, sunset: { label: 'Atardecer', Icon: Sunset }, night: { label: 'Noche', Icon: Moon } };

/** Menú desplegable que se cierra al tocar fuera o con Escape. */
function useMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (event.type === 'keydown' ? event.key === 'Escape' : !ref.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', close, true);
    document.addEventListener('keydown', close, true);
    return () => {
      document.removeEventListener('pointerdown', close, true);
      document.removeEventListener('keydown', close, true);
    };
  }, [open]);
  return [open, setOpen, ref];
}

/** Interruptor de una fila del menú «Ambiente». */
function Toggle({ on, onChange, children }) {
  return (
    <button type="button" className="ambient-menu__toggle" role="switch" aria-checked={Boolean(on)} onClick={onChange}>
      <span>{children}</span>
      <i aria-hidden="true" />
    </button>
  );
}

export function RoomCorner({ onOpenAccount, onStartGuide, onToggleSound, guideActive = false, offscreen = [] }) {
  const cloud = useCloud();
  const { state, actions } = useLibrary();
  const { settings } = state;
  const guides = Boolean(settings.showGuides);
  const [menu, setMenu, menuRef] = useMenu();
  const [ambient, setAmbient, ambientRef] = useMenu();
  // Tamaño de la esquina para que el encabezado de la habitación no quede debajo (SPEC §45)
  const cornerRef = useRef(null);
  useLayoutEffect(() => {
    const el = cornerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const root = document.documentElement;
    const write = () => {
      root.style.setProperty('--room-corner-w', `${Math.round(el.offsetWidth)}px`);
      root.style.setProperty('--room-corner-h', `${Math.round(el.offsetHeight)}px`);
    };
    write();
    const ro = new ResizeObserver(write);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Tres casos (SPEC §12.3): app instalada a pantalla completa, API de pantalla completa o ninguna
  const installedFullscreen = window.matchMedia?.('(display-mode: fullscreen)').matches ?? false;
  const fullscreenApi = Boolean(document.fullscreenEnabled && document.documentElement.requestFullscreen);
  const [fullscreen, setFullscreen] = useState(() => Boolean(document.fullscreenElement));
  const [fsHint, setFsHint] = useState(null);
  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  useEffect(() => {
    if (!fsHint) return undefined;
    const id = setTimeout(() => setFsHint(null), 6000);
    return () => clearTimeout(id);
  }, [fsHint]);
  const toggleFullscreen = () => {
    if (!fullscreenApi) {
      setFsHint('Este navegador no deja abrir la página a pantalla completa. Instala BookShelf («Añadir a pantalla de inicio») y se abrirá sin barras.');
      return;
    }
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => setFsHint('El navegador no ha concedido la pantalla completa; la app sigue igual.'));
  };

  const setTime = (timeOfDay) => {
    if (timeOfDay === settings.timeOfDay && !settings.timeAuto) return;
    // Elegirla a mano detiene el cambio automático por reloj hasta la próxima visita
    actions.setSettings({ timeOfDay, timeAuto: false });
    chime();
  };

  return (
    <>
      <div ref={cornerRef} className="room-corner" data-146="">
        {/* Cuenta y copias: acceso propio y pequeño (no depende de abrir Ambiente) */}
        <button type="button" className="corner-paper corner-account craft craft--paper" data-status={cloud.status} onClick={onOpenAccount} aria-label="Tu cuenta y copias" aria-description={SYNC_TEXT[cloud.status]} title={cloud.user ? `Tu cuenta: ${cloud.user.email}` : 'Tu cuenta y copias'}>
          <CircleUser aria-hidden="true" />
        </button>
        {/* «Ambiente»: clima de la escena, iluminación y sonido */}
        <div className="ambient-menu" ref={ambientRef} data-no-room-swipe>
          <button type="button" className="corner-paper craft craft--paper" aria-expanded={ambient} aria-haspopup="true" onClick={() => setAmbient((v) => !v)}>
            <Sun aria-hidden="true" />
            <span>Ambiente</span>
          </button>
          {ambient && (
            <div className="ambient-menu__panel corner-sheet" role="group" aria-label="Ambiente">
              <div className="ambient-menu__head">
                <h3>Ambiente</h3>
                <button type="button" className="ambient-menu__close" onClick={() => setAmbient(false)} aria-label="Cerrar Ambiente">
                  <X aria-hidden="true" />
                </button>
              </div>
              <p className="corner-sheet__heading" id="amb-time">
                Hora del día
              </p>
              <div className="ambient-menu__times" role="radiogroup" aria-labelledby="amb-time">
                {TOD_ORDER.map((t) => {
                  const { label, Icon } = TIMES[t];
                  // La hora que se ve está marcada siempre; si sigue el reloj, lo dice la línea de debajo
                  return (
                    <button key={t} type="button" role="radio" className="craft craft--choice" aria-checked={settings.timeOfDay === t} onClick={() => setTime(t)}>
                      <Icon aria-hidden="true" />
                      {label}
                    </button>
                  );
                })}
              </div>
              <Toggle on={settings.timeAuto} onChange={() => actions.setSettings({ timeAuto: !settings.timeAuto })}>
                Seguir el reloj
              </Toggle>
              <p className="ambient-menu__clock" aria-live="polite">
                {settings.timeAuto ? 'La luz cambia sola con la hora.' : 'Hora elegida a mano: ya no sigue el reloj.'}
              </p>
              <p className="corner-sheet__heading">Iluminación</p>
              <Toggle
                on={settings.lampOn}
                onChange={() => {
                  lampClick();
                  actions.setSettings({ lampOn: !settings.lampOn });
                }}
              >
                Lámpara de latón
              </Toggle>
              <Toggle
                on={settings.candleOn}
                onChange={() => {
                  matchStrike(!settings.candleOn);
                  actions.setSettings({ candleOn: !settings.candleOn });
                }}
              >
                Vela de la mesita
              </Toggle>
              <p className="corner-sheet__heading">Sonido</p>
              <Toggle on={settings.sound} onChange={onToggleSound}>
                Olas, brisa y páginas
              </Toggle>
              <Toggle on={settings.sfx !== false} onChange={() => actions.setSettings({ sfx: settings.sfx === false })}>
                Sonidos al tocar
              </Toggle>
              <div className="corner-sheet__more">
                {!installedFullscreen && (
                  <button type="button" className="corner-sheet__link" aria-pressed={fullscreenApi ? fullscreen : undefined} onClick={toggleFullscreen}>
                    {fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        {/* «Guías» (SPEC §19.5): repetir la guía, resaltar objetos y, si el encuadre recorta algo, acceso a esos objetos */}
        <div className="guides-menu" ref={menuRef} data-no-room-swipe>
          <button
            type="button"
            className="guides-toggle corner-paper craft craft--paper"
            aria-pressed={guides || guideActive}
            aria-expanded={menu}
            aria-haspopup="true"
            disabled={guideActive}
            onClick={() => setMenu((v) => !v)}
            title="Guías"
            aria-label={offscreen.length ? `Guías (${offscreen.length} objetos fuera de vista)` : 'Guías'}
          >
            <MapIcon aria-hidden="true" />
            <span>Guías</span>
            {offscreen.length > 0 && <i className="guides-toggle__dot" aria-hidden="true" />}
          </button>
          {menu && (
            <ul className="guides-menu__list corner-sheet">
              <li>
                <button
                  type="button"
                  onClick={(event) => {
                    setMenu(false);
                    onStartGuide?.(event.currentTarget.closest('.guides-menu')?.querySelector('.guides-toggle'));
                  }}
                >
                  Repetir la guía de la habitación
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setMenu(false);
                    actions.setSettings({ showGuides: !guides });
                  }}
                >
                  {guides ? 'Ocultar las insignias de los objetos' : 'Resaltar lo que puedes tocar'}
                </button>
              </li>
              {offscreen.length > 0 && <li className="guides-menu__heading">Fuera de vista</li>}
              {offscreen.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setMenu(false);
                      item.onActivate();
                    }}
                  >
                    {item.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {fsHint && (
        <p className="fs-hint" role="status">
          {fsHint}
        </p>
      )}
    </>
  );
}
