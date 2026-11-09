// «Tu mudanza» (1.66, SPEC §66): los seis muebles comunes que se eligen de inicio, una sola vez (decisión de Francisco,
// fase 1 de docs/qa/economia-muebles.md). Se tocan para meterlos en la caja (se pueden repetir) y se quitan desde la
// caja; con seis, «Llevármelos» los pide al servidor, que es quien los da.
import { useMemo, useState } from 'react';
import { ZONAS, ZONA_PAREDES, zonaOf } from './catalog';
import { START_PICKS, STARTER_CHOICES } from './inventory';
import { renderThumb } from './render';

export function StarterPicker({ onPick, onLater }) {
  const [picks, setPicks] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const thumbs = useMemo(() => Object.fromEntries(STARTER_CHOICES.map((c) => [c.id, renderThumb(c.id, 0, 44).toDataURL()])), []);
  // Por zona de la casa (9-11-2026)
  const groups = [...ZONAS, { id: ZONA_PAREDES, nombre: 'Paredes y suelo' }].map((g) => ({ ...g, items: STARTER_CHOICES.filter((c) => zonaOf(c) === g.id) })).filter((g) => g.items.length);
  const left = START_PICKS - picks.length;
  const countOf = (id) => picks.filter((p) => p === id).length;
  const nameOf = (id) => STARTER_CHOICES.find((c) => c.id === id).nombre;

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      await onPick(picks);
    } catch (e) {
      setError(`No se ha podido: ${e.message}`);
      setBusy(false);
    }
  };

  return (
    <section className="ed-start" aria-labelledby="ed-start-title">
      <h2 id="ed-start-title">Tu mudanza</h2>
      <p className="ed-start__lead">Elige {START_PICKS} muebles para empezar. Puedes repetir: dos sillas son dos.</p>
      <div className="ed-start__box" role="group" aria-label={`Tu caja: ${picks.length} de ${START_PICKS}`}>
        {Array.from({ length: START_PICKS }, (_, k) =>
          picks[k] ? (
            <button key={k} type="button" className="ed-start__slot" onClick={() => setPicks((p) => p.filter((_, j) => j !== k))} aria-label={`Quitar ${nameOf(picks[k]).toLowerCase()} de la caja`}>
              <img src={thumbs[picks[k]]} alt="" width={44} height={44} />
            </button>
          ) : (
            <span key={k} className="ed-start__slot ed-start__slot--empty" aria-hidden="true" />
          ),
        )}
      </div>
      <p className="ed-start__left" role="status" aria-live="polite">
        {left ? `Te ${left === 1 ? 'queda' : 'quedan'} ${left}.` : 'La caja está llena.'}
      </p>
      <div className="ed-start__list">
        {groups.map((g) => (
          <div key={g.id} className="ed-start__group">
            <h3>{g.nombre}</h3>
            <div className="ed-start__items">
              {g.items.map((c) => {
                const n = countOf(c.id);
                return (
                  <button key={c.id} type="button" className="ed-start__item" disabled={!left} aria-pressed={n > 0} onClick={() => setPicks((p) => (p.length < START_PICKS ? [...p, c.id] : p))}>
                    <img src={thumbs[c.id]} alt="" width={44} height={44} />
                    <span>{c.nombre}</span>
                    {n > 0 && <b aria-label={`${n} en la caja`}>×{n}</b>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {error && (
        <p className="ed-start__error" role="alert">
          {error}
        </p>
      )}
      <div className="ed-start__actions">
        <button type="button" className="px-btn" onClick={onLater}>
          Más tarde
        </button>
        <button type="button" className="px-btn px-btn--sage" disabled={left > 0 || busy} onClick={confirm}>
          {busy ? 'Subiendo la caja…' : 'Llevármelos'}
        </button>
      </div>
    </section>
  );
}
