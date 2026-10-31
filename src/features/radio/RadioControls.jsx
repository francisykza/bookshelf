// Controles de la radio del rincón (1.62, SPEC §62.3; maqueta 02-radio, izquierda): sintonías reproducibles, pista y
// autor, reproducir/pausar (anterior y siguiente solo si la sintonía tiene más de una pista), volumen de música y de
// ambiente por separado, «Apagar en» 15/30/60/No y créditos. Los mismos controles en el panel del salón y en la hoja
// del lector EPUB. Lo que se ve es lo que hace el reproductor (`radioPlayer.js`), no lo que se pulsó.
import { Pause, Play, SkipBack, SkipForward, Volume1, Volume2 } from 'lucide-react';
import { useId } from 'react';
import { SLEEP_OPTIONS, next, previous, selectStation, setAmbienceVolume, setMusicVolume, setSleep, toggle, useRadio } from './radioPlayer';

const STATUS = { idle: 'Pulsa reproducir para empezar.', loading: 'Cargando…', playing: 'Sonando', paused: 'En pausa' };
const clock = (ms) => new Date(ms).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

export const RADIO_ART = '/media/social-radio/radio-v1.webp';

export function RadioControls({ soundOn = true, onToggleSound = null, titleId, head = true }) {
  const radio = useRadio();
  const ids = { stations: useId(), music: useId(), ambience: useId(), sleep: useId() };
  const playing = radio.status === 'playing' || radio.status === 'loading';
  const many = (radio.station?.tracks.length ?? 0) > 1;

  if (!radio.stations.length)
    return (
      <div className="radio">
        <p className="radio__note">Aún no hay música disponible en la radio.</p>
      </div>
    );

  return (
    <div className="radio">
      {/* En la hoja del lector EPUB el título ya está en su cabecera */}
      {head && (
        <header className="radio__head">
          <img className="radio__art" src={RADIO_ART} alt="" width="180" height="110" decoding="async" />
          <h2 id={titleId}>La radio del rincón</h2>
          <p>Música para acompañar tu lectura</p>
        </header>
      )}

      <fieldset className="radio__stations">
        <legend id={ids.stations}>Sintonías</legend>
        {radio.stations.map((s) => (
          <label key={s.id} className="radio__station" data-on={s.id === radio.station?.id || undefined}>
            <input type="radio" name={ids.stations} checked={s.id === radio.station?.id} onChange={() => selectStation(s.id)} />
            <span>
              {s.title}
              {s.tracks.every((t) => t.demo) && <small>Pista de demostración</small>}
            </span>
          </label>
        ))}
      </fieldset>

      <section className="radio__now" aria-label="Lo que suena">
        <p className="radio__track">
          <b>{radio.track?.title}</b>
          <span>{radio.track?.artist}</span>
        </p>
        <div className="radio__buttons">
          {many && (
            <button type="button" className="radio__skip" onClick={previous} aria-label="Pista anterior">
              <SkipBack aria-hidden="true" />
            </button>
          )}
          <button type="button" className="radio__play" onClick={toggle} aria-label={playing ? 'Pausar la música' : 'Reproducir la música'}>
            {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          </button>
          {many && (
            <button type="button" className="radio__skip" onClick={next} aria-label="Pista siguiente">
              <SkipForward aria-hidden="true" />
            </button>
          )}
        </div>
        <p className="radio__status" role={radio.status === 'error' ? 'alert' : 'status'} data-status={radio.status}>
          {radio.status === 'error' ? radio.error : radio.slept && radio.status !== 'playing' ? 'La música se ha apagado con el temporizador.' : STATUS[radio.status]}
        </p>
      </section>

      <div className="radio__volumes">
        <label htmlFor={ids.music}>Música</label>
        <span className="radio__slider">
          <Volume1 aria-hidden="true" />
          <input id={ids.music} type="range" min="0" max="100" step="5" value={Math.round(radio.musicVolume * 100)} onChange={(e) => setMusicVolume(e.target.value / 100)} aria-valuetext={`${Math.round(radio.musicVolume * 100)} %`} />
          <Volume2 aria-hidden="true" />
        </span>
        <label htmlFor={ids.ambience}>Ambiente</label>
        <span className="radio__slider">
          <Volume1 aria-hidden="true" />
          <input id={ids.ambience} type="range" min="0" max="100" step="5" value={Math.round(radio.ambienceVolume * 100)} onChange={(e) => setAmbienceVolume(e.target.value / 100)} aria-valuetext={`${Math.round(radio.ambienceVolume * 100)} %`} />
          <Volume2 aria-hidden="true" />
        </span>
        {!soundOn && (
          <p className="radio__note">
            El ambiente está apagado.
            {onToggleSound && (
              <button type="button" className="link-btn" onClick={onToggleSound}>
                Encenderlo
              </button>
            )}
          </p>
        )}
      </div>

      <fieldset className="radio__sleep">
        <legend id={ids.sleep}>Apagar la música en</legend>
        <div className="radio__chips">
          {[...SLEEP_OPTIONS, null].map((m) => (
            <label key={m ?? 'no'} className="radio__chip" data-on={radio.sleepMinutes === m || undefined}>
              <input type="radio" name={ids.sleep} checked={radio.sleepMinutes === m} onChange={() => setSleep(m)} />
              <span>{m ? `${m} min` : 'No'}</span>
            </label>
          ))}
        </div>
        {radio.sleepAt && <p className="radio__note">Se apagará a las {clock(radio.sleepAt)}. El ambiente sigue como esté.</p>}
      </fieldset>

      <details className="radio__credits">
        <summary>Ver créditos</summary>
        <ul>
          {radio.station?.tracks.map((t) => (
            <li key={t.id}>
              <b>{t.title}</b> · {t.artist}. {t.credits}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
