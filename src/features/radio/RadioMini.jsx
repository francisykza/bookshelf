// Control compacto de la radio (1.62, SPEC §62.3; maqueta 02-radio, derecha): en el pie de herramientas del lector EPUB,
// solo si ya has puesto música en esta sesión (nunca se impone). Pista, reproducir/pausar y abrir la radio entera; no
// tapa el texto ni atiende gestos de página.
import { ChevronUp, Pause, Play } from 'lucide-react';
import { RADIO_ART } from './RadioControls';
import { toggle, useRadio } from './radioPlayer';

export function RadioMini({ onOpen }) {
  const radio = useRadio();
  if (radio.status === 'idle' || !radio.track) return null;
  const playing = radio.status === 'playing' || radio.status === 'loading';
  return (
    <div className="radio-mini" role="group" aria-label="Música">
      <img className="radio-mini__art" src={RADIO_ART} alt="" width="54" height="33" decoding="async" />
      <p className="radio-mini__track">
        <b>{radio.track.title}</b>
        <span>{radio.status === 'error' ? radio.error : radio.status === 'loading' ? 'Cargando…' : playing ? 'Sonando' : 'En pausa'}</span>
      </p>
      <button type="button" className="radio-mini__play" onClick={toggle} aria-label={playing ? 'Pausar la música' : 'Reproducir la música'}>
        {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
      </button>
      <button type="button" className="radio-mini__open" onClick={onOpen} aria-label="Abrir la radio">
        <ChevronUp aria-hidden="true" />
      </button>
    </div>
  );
}
