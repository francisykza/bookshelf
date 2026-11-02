// Abrir un sobre de la tienda (1.67, SPEC §67): lo que trae ya lo ha sorteado el servidor; esto solo lo enseña con
// calma y emoción. Desde la 1.68 (maquetas de Francisco) se abre en el mostrador, visto de cerca y casi de frente
// (`renderShopCounter` de shopRoom.js, el mismo motor que los pisos): la dependienta, con las manos en el tablero, sonríe
// al terminar. El sobre elegido tiembla en
// el tablero con un halo del color de lo mejor que trae (lo único que se adelanta, y es verdad), se toca para rasgar la
// tira de arriba, sale la luz y las cartas se reparten boca abajo; se dan la vuelta tocándolas o con «Mostrar todos».
// Abajo, un papel dice qué hacer y al final cuántos son nuevos. Sin falsos «casi», sin cuentas atrás ni prisas. Con
// movimiento reducido, directo al resultado.
// 1.73 (místicos, bloque 3): un místico o un legendario sale con su propia carta: el ser se mueve dentro (misticos.js),
// con un halo y destellos del color de su escalón, y su nota. Igual de honesto: el halo del sobre solo dice lo que de
// verdad trae.
import { useEffect, useMemo, useRef, useState } from 'react';
import { catalogItem, isMistico } from './catalog';
import { misticoThumb } from './misticos';
import { rarezaInfo } from './economy';
import { renderThumb } from './render';
import { PACK_H, PACK_TEAR, PACK_W, cardBackArt, packArt } from './shopArt';
import { COUNTER_H, COUNTER_W, renderShopCounter } from './shopRoom';

const ORDER = ['comun', 'poco-comun', 'raro', 'mistico', 'legendario'];
const ALTO = ['raro', 'mistico', 'legendario'];
const OPEN_MS = 950;
const STAGGER_MS = 280;
const bestOf = (premios) => premios.reduce((b, p) => (ORDER.indexOf(p.rareza) > ORDER.indexOf(b) ? p.rareza : b), 'comun');
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const nameOf = (id) => catalogItem(id)?.nombre ?? id;

/** El mueble de la carta: su miniatura recortada a lo dibujado y ampliada por enteros hasta llenar el hueco. */
function cardThumb(id, size = 64) {
  const src = renderThumb(id, 0, size);
  const { data } = src.getContext('2d').getImageData(0, 0, size, size);
  let x0 = size;
  let y0 = size;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < size; y += 1)
    for (let x = 0; x < size; x += 1)
      if (data[(y * size + x) * 4 + 3] > 0) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
  if (x1 < 0) return src.toDataURL();
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const k = Math.max(1, Math.floor(Math.min((size - 4) / w, (size - 4) / h)));
  const out = document.createElement('canvas');
  out.width = size;
  out.height = size;
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, x0, y0, w, h, Math.floor((size - w * k) / 2), Math.floor((size - h * k) / 2), w * k, h * k);
  return out.toDataURL();
}

/** La cara de un místico: el ser, vivo, a unos 12 fotogramas por segundo mientras la carta está boca arriba. */
function MisticoFace({ id, size, live }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const paint = (t) => {
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(misticoThumb(id, size, t), 0, 0);
    };
    paint(1.3);
    if (!live) return undefined;
    let raf = 0;
    let last = 0;
    const t0 = performance.now();
    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      if (now - last < 80) return;
      last = now;
      paint(1.3 + (now - t0) / 1000);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [id, size, live]);
  return <canvas ref={ref} className="gacha__mistico" width={size} height={size} aria-hidden="true" />;
}

/** El adorno del papel: dos rayas y una flor de lis pequeña en medio. */
function Ornament() {
  return (
    <span className="gacha__orn" aria-hidden="true">
      <i />✦<i />
    </span>
  );
}

export function GachaReveal({ premios, sobre, sfx, onClose, onGoPiso }) {
  const best = bestOf(premios);
  const still = useMemo(() => reducedMotion(), []);
  const [phase, setPhase] = useState(still ? 'done' : 'sealed');
  const [shown, setShown] = useState(() => premios.map(() => still));
  const shownRef = useRef(shown);
  const timers = useRef([]);
  const art = useMemo(() => packArt(sobre), [sobre]);
  const back = useMemo(() => cardBackArt(), []);
  const scene = useMemo(() => ({ base: renderShopCounter('base').scene, happy: renderShopCounter('happy').scene }), []);
  const thumbs = useMemo(() => premios.map((p) => cardThumb(p.mueble)), [premios]);
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

  // «Mostrar todos» con el sobre aún cerrado: directo a las cartas boca arriba, sin la animación
  const showAll = () => {
    timers.current.forEach(clearTimeout);
    shownRef.current = premios.map(() => true);
    setShown(shownRef.current);
    setPhase('done');
    sfx.play(`reveal-${best}`);
  };

  useEffect(() => {
    if (phase === 'cards' && allShown) later(() => setPhase('done'), 650);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, allShown]);

  const nuevos = premios.filter((p) => p.nuevo).length;
  const summary = `${premios.length === 1 ? 'Te llevas' : `Te llevas ${premios.length} muebles:`} ${premios.map((p) => nameOf(p.mueble).toLowerCase()).join(', ')}.${nuevos ? ` ${nuevos === 1 ? 'Uno es nuevo' : `${nuevos} son nuevos`} para ti.` : ''}`;
  const tally = `${premios.length === 1 ? 'Un mueble' : `${premios.length} muebles`} para tu piso${nuevos ? ` · ${nuevos === 1 ? (premios.length === 1 ? 'nuevo' : '1 nuevo') : `${nuevos} nuevos`}` : ''}`;
  const sealed = phase === 'sealed' || phase === 'opening';
  const legendario = premios.find((p) => p.rareza === 'legendario');
  const mistico = premios.find((p) => p.rareza === 'mistico');
  const misticoNote = legendario
    ? `${nameOf(legendario.mueble)} puede acompañarte: elígelo en el armario de tu personaje.`
    : mistico
      ? `${nameOf(mistico.mueble)} se coloca en tu piso sobre su peana, en la pestaña «Místicos».`
      : '';

  return (
    <div className={`gacha gacha--${best} is-${phase}`} role="dialog" aria-modal="true" aria-labelledby="gacha-title" style={{ '--cw': COUNTER_W, '--ch': COUNTER_H, backgroundImage: `url(${phase === 'done' ? scene.happy : scene.base})` }}>
      <h2 id="gacha-title" className="px-sr">
        {premios.length === 1 ? `Abriendo un sobre «${sobre.nombre}»` : `Abriendo cinco sobres «${sobre.nombre}»`}
      </h2>
      {sealed && (
        <div className="gacha__stage">
          <button ref={focusRef} type="button" className="gacha__env" onClick={open} disabled={phase !== 'sealed'} aria-label={`Rasgar el sobre «${sobre.nombre}»`} style={{ '--ew': PACK_W, '--eh': PACK_H, '--fh': PACK_TEAR }}>
            <span className="gacha__glow" aria-hidden="true" />
            <span className="gacha__burst" aria-hidden="true" />
            <span className="gacha__shadow" aria-hidden="true" />
            <img className="gacha__body" src={art.body} alt="" draggable="false" />
            <img className="gacha__flap" src={art.top} alt="" draggable="false" />
            {ALTO.includes(best) && (
              <span className="gacha__motes" aria-hidden="true">
                {Array.from({ length: 8 }, (_, k) => (
                  <i key={k} style={{ '--k': k, '--t': (k * 37) % 60 }} />
                ))}
              </span>
            )}
          </button>
        </div>
      )}
      {!sealed && (
        <ul className={`gacha__cards gacha__cards--n${premios.length}`}>
          {premios.map((p, i) => {
            const info = rarezaInfo(p.rareza);
            return (
              <li key={i} style={{ '--i': i }}>
                <button
                  ref={i === 0 && premios.length > 1 && phase === 'cards' ? focusRef : null}
                  type="button"
                  className={`gacha__card is-${p.rareza}${shown[i] ? ' is-shown' : ''}`}
                  onClick={() => flip(i)}
                  aria-label={shown[i] ? `${nameOf(p.mueble)}, ${info.nombre.toLowerCase()}${p.nuevo ? ', nuevo' : ''}` : `Dar la vuelta a la carta ${i + 1}`}
                >
                  <img className="gacha__back" src={back} alt="" draggable="false" />
                  <span className="gacha__face">
                    {p.rareza !== 'comun' && <span className="gacha__rays" aria-hidden="true" />}
                    {isMistico(catalogItem(p.mueble)) ? (
                      <>
                        <MisticoFace id={p.mueble} size={premios.length === 1 ? 96 : 64} live={shown[i] && !still} />
                        <span className="gacha__sparks" aria-hidden="true">
                          {Array.from({ length: 6 }, (_, k) => (
                            <i key={k} style={{ '--k': k }} />
                          ))}
                        </span>
                      </>
                    ) : (
                      <img src={thumbs[i]} alt="" width={64} height={64} draggable="false" />
                    )}
                    <strong>{nameOf(p.mueble)}</strong>
                    <small>{info.nombre}</small>
                    {p.nuevo && <b className="gacha__new">Nuevo</b>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="gacha__paper">
        {phase === 'done' ? (
          <>
            <p className="gacha__tally" role="status">
              <span aria-hidden="true">{tally}</span>
              <span className="px-sr">{summary}</span>
            </p>
            {misticoNote && <p className="gacha__mnote">{misticoNote}</p>}
            <Ornament />
            <button type="button" className="px-btn px-btn--sage gacha__go" onClick={onGoPiso}>
              Colocar en mi piso
            </button>
            <button type="button" className="gacha__link" onClick={onClose}>
              Volver a la tienda
            </button>
          </>
        ) : (
          <>
            <h3 className="gacha__title">{premios.length === 1 ? 'Una sorpresa para tu rincón' : 'Cinco sorpresas para tu rincón'}</h3>
            <Ornament />
            <p className="gacha__hint" aria-live="polite">
              {sealed ? 'Toca el sobre para abrirlo.' : premios.length > 1 ? 'Toca las cartas para darles la vuelta.' : ''}
            </p>
            {(sealed || (premios.length > 1 && !allShown)) && (
              <button type="button" className="gacha__link" onClick={sealed ? showAll : flipAll}>
                Mostrar todos
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
