// Controles generales de la esquina (SPEC §16.5): cuenta, pantalla completa, hora del día, sonidos táctiles y
// guías. Viven fuera del track del panorama (no se desplazan con la habitación) y respetan el área segura.
// 1.21 (Fase 1): la ilustración nueva no tiene carillón; cambiar la hora pasa a este control de ambiente.
import { Cloud, CloudOff, Maximize, Minimize, Moon, Sparkles, Sun, Sunset, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { chime } from '../../audio/ambientAudio';
import { useCloud } from '../../state/cloudSync';
import { useLibrary } from '../../state/useLibrary';
import { TOD_ORDER, todName } from './RoomHotspots';

const TOD_ICON = { morning: Sun, sunset: Sunset, night: Moon };

export function RoomCorner({ onOpenAccount }) {
  const cloud = useCloud();
  const { state, actions } = useLibrary();
  const { settings } = state;
  const guides = Boolean(settings.showGuides);

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

  const next = TOD_ORDER[(TOD_ORDER.indexOf(settings.timeOfDay) + 1) % TOD_ORDER.length];
  const TodIcon = TOD_ICON[settings.timeOfDay] ?? Sun;
  const cycleTime = () => {
    // Elegirla a mano detiene el cambio automático por reloj hasta la próxima visita
    actions.setSettings({ timeOfDay: next, timeAuto: false });
    chime();
  };

  return (
    <>
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
        {!installedFullscreen && (
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
          data-id="time"
          onClick={cycleTime}
          aria-label={`${todName(settings.timeOfDay)}. Cambiar a ${todName(next).toLowerCase()}`}
          title={`${todName(settings.timeOfDay)} · tocar para cambiar la hora`}
        >
          <TodIcon aria-hidden="true" />
        </button>
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
      {fsHint && (
        <p className="fs-hint" role="status">
          {fsHint}
        </p>
      )}
    </>
  );
}
