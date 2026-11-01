// Abrir un sobre de la tienda (1.67, SPEC §67): lo que trae ya lo ha sorteado el servidor; esto solo lo enseña con
// calma y emoción. El sobre de la pared que se ha elegido tiembla con un halo del color de lo mejor que trae (lo único
// que se adelanta, y es verdad), se toca para rasgar la tira de arriba, sale la luz y las cartas se dan la vuelta una a
// una (o todas con «Revelar todo»). Sin falsos «casi», sin cuentas atrás ni prisas. Con movimiento reducido, directo al
// resultado.
import { useEffect, useMemo, useRef, useState } from 'react';
import { catalogItem } from './catalog';
import { rarezaInfo } from './economy';
import { renderThumb } from './render';
import { PACK_H, PACK_TEAR, PACK_W, cardBackArt, packArt } from './shopArt';

const ORDER = ['comun', 'poco-comun', 'raro'];
const OPEN_MS = 950;
const STAGGER_MS = 280;
const bestOf = (premios) => premios.reduce((b, p) => (ORDER.indexOf(p.rareza) > ORDER.indexOf(b) ? p.rareza : b), 'comun');
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const nameOf = (id) => catalogItem(id)?.nombre ?? id;

export function GachaReveal({ premios, sobre, sfx, onClose, onGoPiso }) {
  const best = bestOf(premios);
  const still = useMemo(() => reducedMotion(), []);
  const [phase, setPhase] = useState(still ? 'done' : 'sealed');
  const [shown, setShown] = useState(() => premios.map(() => still));
  const shownRef = useRef(shown);
  const timers = useRef([]);
  const art = useMemo(() => packArt(sobre), [sobre]);
  const back = useMemo(() => cardBackArt(), []);
  const thumbs = useMemo(() => premios.map((p) => renderThumb(p.mueble, 0, 64).toDataURL()), [premios]);
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));
  const allShown = shown.every(Boolean);
  const focusRef = useRef(null);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  // Con movimiento reducido no hay animación, pero sí la nota de lo mejor (la persona acaba de tocar «Abrir»)
  useEffect(() => {
    if (still) sfx.play(`reveal-${best}`);
    focusRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flip = (i) => {
    if (shownRef.current[i]) return;
    shownRef.current = shownRef.current.map((v, k) => v || k === i);
    sfx.play('flip');
    later(() => sfx.play(`reveal-${premios[i].rareza}`), 140);
    setShown(shownRef.current);
  };

  const open = () => {
    if (phase !== 'sealed') return;
    sfx.play('tear');
    setPhase('opening');
    later(() => {
      setPhase('cards');
      // Uno solo se da la vuelta solo
      if (premios.length === 1) later(() => flip(0), 380);
    }, OPEN_MS);
  };

  const flipAll = () => {
    let k = 0;
    premios.forEach((_, i) => {
      if (shownRef.current[i]) return;
      later(() => flip(i), k * STAGGER_MS);
      k += 1;
    });
  };

  useEffect(() => {
    if (phase === 'cards' && allShown) later(() => setPhase('done'), 650);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, allShown]);

  const nuevos = premios.filter((p) => p.nuevo).length;
  const summary = `${premios.length === 1 ? 'Te llevas' : `Te llevas ${premios.length} muebles:`} ${premios.map((p) => nameOf(p.mueble).toLowerCase()).join(', ')}.${nuevos ? ` ${nuevos === 1 ? 'Uno es nuevo' : `${nuevos} son nuevos`} para ti.` : ''}`;

  return (
    <div className={`gacha gacha--${best} is-${phase}`} role="dialog" aria-modal="true" aria-labelledby="gacha-title">
      <h2 id="gacha-title" className="px-sr">
        {premios.length === 1 ? 'Abriendo un sobre' : 'Abriendo un paquete de cinco'}
      </h2>
      {(phase === 'sealed' || phase === 'opening') && (
        <div className="gacha__stage">
          <button ref={focusRef} type="button" className="gacha__env" onClick={open} disabled={phase !== 'sealed'} aria-label={`Rasgar el sobre «${sobre.nombre}»`} style={{ '--ew': PACK_W, '--eh': PACK_H, '--fh': PACK_TEAR }}>
            <span className="gacha__glow" aria-hidden="true" />
            <span className="gacha__burst" aria-hidden="true" />
            <img className="gacha__body" src={art.body} alt="" draggable="false" />
            <img className="gacha__flap" src={art.top} alt="" draggable="false" />
            {best === 'raro' && (
              <span className="gacha__motes" aria-hidden="true">
                {Array.from({ length: 8 }, (_, k) => (
                  <i key={k} style={{ '--k': k, '--t': (k * 37) % 60 }} />
                ))}
              </span>
            )}
          </button>
          <p className="gacha__hint" aria-live="polite">
            {phase === 'sealed' ? 'Toca el sobre para rasgarlo.' : ''}
          </p>
        </div>
      )}
      {(phase === 'cards' || phase === 'done') && (
        <>
          <ul className={`gacha__cards gacha__cards--n${premios.length}`}>
            {premios.map((p, i) => {
              const info = rarezaInfo(p.rareza);
              return (
                <li key={i} style={{ '--i': i }}>
                  <button
                    ref={i === 0 && premios.length > 1 ? focusRef : null}
                    type="button"
                    className={`gacha__card is-${p.rareza}${shown[i] ? ' is-shown' : ''}`}
                    onClick={() => flip(i)}
                    aria-label={shown[i] ? `${nameOf(p.mueble)}, ${info.nombre.toLowerCase()}${p.nuevo ? ', nuevo' : ''}` : `Dar la vuelta a la carta ${i + 1}`}
                  >
                    <img className="gacha__back" src={back} alt="" draggable="false" />
                    <span className="gacha__face">
                      {p.rareza !== 'comun' && <span className="gacha__rays" aria-hidden="true" />}
                      <img src={thumbs[i]} alt="" width={64} height={64} draggable="false" />
                      <strong>{nameOf(p.mueble)}</strong>
                      <small>{info.nombre}</small>
                      {p.nuevo && <b className="gacha__new">Nuevo</b>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {phase === 'cards' && !allShown && premios.length > 1 && (
            <button type="button" className="px-btn gacha__all" onClick={flipAll}>
              Revelar todo
            </button>
          )}
          {phase === 'done' && (
            <div className="gacha__done">
              <p role="status">{summary}</p>
              <div className="gacha__actions">
                <button type="button" className="px-btn" onClick={onClose}>
                  Volver a la tienda
                </button>
                <button type="button" className="px-btn px-btn--sage" onClick={onGoPiso}>
                  Colocar en mi piso
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
