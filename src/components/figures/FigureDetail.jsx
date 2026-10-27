// Detalle de una figura expuesta (SPEC §37.3): acercarse al objeto de la balda. Nombre real, la imagen grande y
// completa, «Figura / Caja» para previsualizar (no cambia lo expuesto hasta aplicarlo), las piezas con su estado
// real, «Cambiar de balda» (con intercambio o sustitución explícitos: nada se pierde) y «Guardar en el ático» (la
// figura, sus piezas y su progreso no cambian). Solo figuras que tienes.
import { Archive, ChevronRight, Library, X } from 'lucide-react';
import { useState } from 'react';
import { SLOT_NAMES, placeOnShelf, removeFromShelf, roomDisplay, roomPresentations, setSlotDisplay, shelfSlots, slotOf } from '../../domain/figures';
import { useLibrary } from '../../state/useLibrary';
import { PanelShell } from '../panels/PanelShell';
import { FigureArt, PartArt } from './FigureArt';
import { useFigureCatalog } from './figureCatalog';

/** Ramita botánica mínima de los separadores. */
function Sprig() {
  return (
    <svg viewBox="0 0 22 14" aria-hidden="true">
      <path d="M2 12C7 9 12 6 20 2" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M8 9c-1-3 1-5 3-5-1 2-1 4-3 5zM13 6c0-3 2-4 4-4-1 2-2 3-4 4z" fill="currentColor" />
    </svg>
  );
}

const LABEL = { unboxed: 'Figura', box: 'Caja' };

export function FigureDetail({ id, onClose }) {
  const { state, actions } = useLibrary();
  const catalog = useFigureCatalog();
  const fs = state.progress.figures;
  const fig = catalog.find((f) => f.id === id && fs.owned[f.id]) ?? null;
  const slots = shelfSlots(fs, catalog);
  const at = slotOf(slots, id);
  const shown = at >= 0 ? slots[at].display : null;
  const ways = roomPresentations(fig);
  const [preview, setPreview] = useState(() => shown ?? roomDisplay(fig, 'box') ?? 'box');
  const [choosing, setChoosing] = useState(false);
  const [pending, setPending] = useState(null);
  const [status, setStatus] = useState('');
  const nameOf = (slot) => catalog.find((f) => f.id === slot?.id)?.name ?? '';

  if (!catalog.length) return null;
  if (!fig) {
    return (
      <PanelShell onClose={onClose} label="Figura" variant="figure">
        <div className="fig-detail">
          <button type="button" className="fig-detail__close" onClick={onClose} aria-label="Cerrar">
            <X aria-hidden="true" />
          </button>
          <p className="fig-detail__note">Esta figura no está en tu colección.</p>
        </div>
      </PanelShell>
    );
  }

  const entry = fs.owned[fig.id];
  const roomReady = ways.box || ways.unboxed;
  const display = ways[preview] ? preview : roomDisplay(fig, preview);
  const save = (next, message) => {
    actions.setFigureShelf(next);
    setStatus(message);
    setChoosing(false);
    setPending(null);
  };
  const choose = (target) => {
    const occupant = slots[target];
    if (occupant && occupant.id !== fig.id) {
      setPending(target);
      return;
    }
    save(placeOnShelf(slots, fig.id, display, target), `Expuesta en la ${SLOT_NAMES[target].toLowerCase()}.`);
  };

  return (
    <PanelShell onClose={onClose} label={`${fig.name}: detalle`} variant="figure">
      <div className="fig-detail">
        <button type="button" className="fig-detail__close" onClick={onClose} aria-label="Cerrar">
          <X aria-hidden="true" />
        </button>
        <p className="fig-detail__kicker">Tu colección</p>
        <h2>{fig.name}</h2>
        <span className="fig-detail__rule" aria-hidden="true">
          <Sprig />
        </span>

        <div className="fig-detail__stage">
          <FigureArt fig={fig} display={roomReady ? display : 'box'} />
        </div>

        {ways.box && ways.unboxed ? (
          <div className="fig-detail__switch" role="radiogroup" aria-label="Ver como">
            {['unboxed', 'box'].map((d) => (
              <button key={d} type="button" role="radio" aria-checked={display === d} className="craft craft--choice" onClick={() => setPreview(d)}>
                {LABEL[d]}
              </button>
            ))}
          </div>
        ) : (
          <p className="fig-detail__note">
            {!roomReady ? 'Aún no hay imagen de esta figura para exponerla en la habitación.' : ways.box ? 'Solo hay imagen de la figura en su caja.' : 'Solo hay imagen de la figura suelta.'}
          </p>
        )}

        {/* Aplicar la presentación es una acción explícita: previsualizar no cambia lo expuesto */}
        {at >= 0 && display !== shown && (
          <button type="button" className="fig-action craft craft--terra" onClick={() => save(setSlotDisplay(slots, fig.id, display), `Ahora se expone ${display === 'unboxed' ? 'la figura suelta' : 'en su caja'}.`)}>
            <span aria-hidden="true" />
            Exponer {display === 'unboxed' ? 'la figura suelta' : 'en su caja'}
            <span aria-hidden="true" />
          </button>
        )}

        <span className="fig-detail__rule" aria-hidden="true" />
        <h3>Piezas de la colección</h3>
        <ul className="fig-detail__parts">
          {fig.parts.map((part, i) => {
            const owned = entry.parts?.includes(i) ?? false;
            return (
              <li key={part.name} data-owned={owned}>
                <span className="fig-detail__part" aria-hidden="true">
                  <PartArt fig={fig} part={part} />
                </span>
                <small>{part.name}</small>
                <span className="sr-only-focus">{owned ? 'conseguida' : 'por conseguir'}</span>
              </li>
            );
          })}
        </ul>

        {roomReady && (
          <div className="fig-detail__actions">
            <button type="button" className="fig-action craft craft--paper" aria-expanded={choosing} onClick={() => setChoosing((v) => !v)}>
              <Library aria-hidden="true" />
              {at >= 0 ? 'Cambiar de balda' : 'Poner en una balda'}
              <ChevronRight aria-hidden="true" />
            </button>
            {choosing && (
              <ul className="fig-detail__slots" aria-label="Elige una posición">
                {SLOT_NAMES.map((name, i) => (
                  <li key={name}>
                    <button type="button" className="craft craft--choice" aria-pressed={i === at} disabled={i === at} onClick={() => choose(i)}>
                      {name}
                      <small>{i === at ? 'Aquí está' : slots[i] ? nameOf(slots[i]) : 'Libre'}</small>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {pending != null && (
              <div className="fig-detail__confirm" role="alertdialog" aria-label="Posición ocupada">
                <p>En la {SLOT_NAMES[pending].toLowerCase()} está {nameOf(slots[pending])}.</p>
                <div>
                  {at >= 0 && (
                    <button type="button" className="craft craft--paper" onClick={() => save(placeOnShelf(slots, fig.id, display, pending, 'swap'), 'Intercambiadas.')}>
                      Intercambiar
                    </button>
                  )}
                  <button type="button" className="craft craft--paper" onClick={() => save(placeOnShelf(slots, fig.id, display, pending, 'replace'), `${nameOf(slots[pending])} vuelve al Ático.`)}>
                    Sustituir
                  </button>
                  <button type="button" className="craft craft--paper" onClick={() => setPending(null)}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
            {at >= 0 && (
              <button type="button" className="fig-action craft craft--paper" onClick={() => save(removeFromShelf(slots, fig.id), 'Guardada en el Ático. Sigue siendo tuya.')}>
                <Archive aria-hidden="true" />
                Guardar en el ático
                <ChevronRight aria-hidden="true" />
              </button>
            )}
          </div>
        )}
        <p className="fig-detail__status" role="status">
          {status}
        </p>
      </div>
    </PanelShell>
  );
}
