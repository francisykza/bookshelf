// Panel «Sonido»: la radio del puerto. Interruptor general, tres canales con volumen y silencio propios, y qué suena. Solo ofrece pistas con archivo real.
import { useEffect, useRef } from 'react';
import { AMBIENCES, MUSICS, SCENE_AMBIENCE, activateSound, chooseTrack, resumeSound, setChannelLevel, setSoundOn, useSoundState } from '../../audio/audioController';
import { playUiSound } from '../../audio/uiSounds';
import { PixelControl, PixelIcon } from '../../ui/PixelIcon';
import { PortIcon } from '../../ui/PortIcon';
import { PanelShell } from './PanelShell';

const NIVEL_AL_REANUDAR = 25;
// Volumen de cada canal antes de silenciarlo, para devolverlo igual
const beforeMute = {};

function Level({ id, label, value, disabled }) {
  const level = Number(value);
  const muted = level === 0;
  const toggle = () => {
    if (muted) setChannelLevel(id, beforeMute[id] || NIVEL_AL_REANUDAR);
    else {
      beforeMute[id] = level;
      setChannelLevel(id, 0);
    }
  };
  return (
    <div className="port-slider pp-level">
      <label htmlFor={`sonido-${id}`}>
        <span className="pp-plate">{label}</span>
        <output className="pp-plate" htmlFor={`sonido-${id}`}>
          {level} %
        </output>
      </label>
      <div className="pp-level__row">
        <input id={`sonido-${id}`} type="range" min="0" max="100" step="1" value={level} disabled={disabled} style={{ '--v': `${level}%` }} onChange={(e) => setChannelLevel(id, e.target.value)} />
        <button type="button" className="pp-btn pp-btn--icon pp-mute" aria-pressed={muted} aria-label={`Silenciar ${label}`} disabled={disabled} onClick={toggle}>
          <PortIcon name="altavoz" />
        </button>
      </div>
    </div>
  );
}

function Choice({ title, name, options, value, onChoose, disabled, tapes = false }) {
  return (
    <fieldset className="port-choice pp-choice" data-tapes={tapes || undefined} disabled={disabled}>
      <legend>{title}</legend>
      {options.map((o) => {
        const tape = tapes && o.file;
        return (
          <label key={o.id} className={tape ? 'pp-tape' : 'pp-chip'}>
            <input type="radio" name={name} value={o.id} checked={value === o.id} onChange={() => onChoose(o.id)} />
            <span>{o.label}</span>
            {tape && (
              <i className="pp-tape__reels" aria-hidden="true">
                <b />
                <b />
              </i>
            )}
            {value === o.id && <PixelControl name="check" />}
          </label>
        );
      })}
    </fieldset>
  );
}

export function SoundPanel({ onClose }) {
  const s = useSoundState();
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    playUiSound('panel-open');
  }, []);
  const close = () => {
    playUiSound('panel-close');
    onClose();
  };
  const failing = [s.errors.ambience && AMBIENCES.find((x) => x.id === s.errors.ambience)?.label, s.errors.music && MUSICS.find((x) => x.id === s.errors.music)?.label].filter(Boolean);
  const ambiences = s.legacy ? [AMBIENCES[0], SCENE_AMBIENCE, ...AMBIENCES.slice(1)] : AMBIENCES;
  return (
    <PanelShell onClose={close} label="Sonido" variant="port-sheet">
      <div className="port-sheet pp-radio">
        <header className="pp-menu__head">
          <h2>Radio del puerto</h2>
          <button type="button" className="pp-btn pp-btn--icon" onClick={close} aria-label="Cerrar Sonido">
            <PixelControl name="close" />
          </button>
        </header>
        <div className="port-sheet__body port-sound">
          <div className="pp-radio__set">
            <PixelIcon name="sonido" size={144} />
          </div>
          {s.decided ? (
            <label className="port-switch">
              <span>Sonido {s.on ? 'activado' : 'silenciado'}</span>
              <input type="checkbox" role="switch" checked={s.on} onChange={(e) => setSoundOn(e.target.checked)} />
              <i aria-hidden="true" />
            </label>
          ) : (
            <div className="port-sound__start">
              <p>BookShelf está en silencio. Nada suena hasta que tú lo actives.</p>
              <button type="button" className="pp-btn pp-btn--primary" onClick={activateSound}>
                <PortIcon name="altavoz" />
                Activar sonido
              </button>
            </div>
          )}
          {s.needsTap && (
            <button type="button" className="pp-btn" onClick={resumeSound}>
              Reanudar el sonido
            </button>
          )}
          <div className="pp-board">
            <Level id="effects" label="Efectos" value={s.effects} disabled={!s.on} />
            <Level id="ambience" label="Ambiente" value={s.ambience} disabled={!s.on} />
            <Level id="music" label="Música" value={s.music} disabled={!s.on} />
          </div>
          <Choice title="Ambiente" name="sonido-ambiente" options={ambiences} value={s.ambienceId} onChoose={(id) => chooseTrack('ambienceId', id)} disabled={!s.on} />
          <Choice title="Música" name="sonido-musica" options={MUSICS} value={s.musicId} onChoose={(id) => chooseTrack('musicId', id)} disabled={!s.on} tapes />
          {failing.length > 0 && (
            <p className="port-note" role="status">
              <PortIcon name="error" />
              No se ha podido cargar: {failing.join(' y ')}. Lo demás sigue funcionando; vuelve a elegirlo para intentarlo otra vez.
            </p>
          )}
        </div>
      </div>
    </PanelShell>
  );
}
