// Abrir un sobre de la tienda (1.67, SPEC §67): lo que trae ya lo ha sorteado el servidor; esto solo lo enseña con
// calma y emoción. Desde la 1.68 (maquetas de Francisco) se abre en el mostrador, visto de cerca y casi de frente
// (`renderShopCounter` de shopRoom.js, el mismo motor que los pisos): la dependienta, con las manos en el tablero, sonríe
// al terminar. El sobre elegido tiembla en
// el tablero con un halo del color de lo mejor que trae (lo único que se adelanta, y es verdad), se toca para rasgar la
// tira de arriba, sale la luz y las cartas se reparten boca abajo; se dan la vuelta tocándolas o con «Mostrar todos».
// Abajo, un papel dice qué hacer y al final cuántos son nuevos. Sin falsos «casi», sin cuentas atrás ni prisas. Con
// movimiento reducido, directo al resultado.
// 1.76 (maquetas de Francisco, §76): el sobre es el mismo del expositor y del selector, en primer plano (packArt), y el
// tablero del mostrador es más hondo: el sobre y las cartas se apoyan en él, cada uno en su punto del tablero
// (`counterLayout`; una carta centrada, cinco en 3 + 2), con una sombra corta. El reverso lleva el color de la colección.
// El sobre está en la madera, de frente e inclinado, dibujado con la misma cámara que el mostrador (`counterPack`). Tres
// gestos breves: al tocarlo, la tira (con la pestaña) se desprende entera y queda en la madera justo encima; la primera
// carta asoma por la boca del sobre (en el de cinco, el sobre se desliza a la izquierda y las otras cuatro esperan boca
// abajo en 2 × 2 a la derecha: «1 de 5 reveladas»); y al continuar, las cartas ocupan su sitio definitivo (3 + 2) y el
// sobre y la tira salen del encuadre. Una carta
// revelada se elige tocándola (✓) y «Colocar [nombre]» la lleva al editor del piso; nada se vuelve a cobrar ni a sortear:
// son las recompensas que ya confirmó la compra.
// 1.73 (místicos, bloque 3): un místico o un legendario sale con su propia carta: el ser se mueve dentro (misticos.js),
// con un halo y destellos del color de su escalón, y su nota. Igual de honesto: el halo del sobre solo dice lo que de
// verdad trae.
import { useEffect, useMemo, useRef, useState } from 'react';
import { catalogItem, isMistico } from './catalog';
import { misticoThumb } from './misticos';
import { rarezaInfo } from './economy';
import { renderThumb } from './render';
import { cardBackArt } from './shopArt';
import { COUNTER_H, COUNTER_W, PEEK_TURN, STRIP_TURN, counterLayout, counterPack, renderShopCounter } from './shopRoom';

const ORDER = ['comun', 'poco-comun', 'raro', 'mistico', 'legendario'];
const ALTO = ['raro', 'mistico', 'legendario'];
const OPEN_MS = 1400;
// Lo que tardan las cartas en llegar a su sitio definitivo al continuar
const SETTLE_MS = 520;
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
  const n = premios.length;
  const still = useMemo(() => reducedMotion(), []);
  const [phase, setPhase] = useState(still ? 'done' : 'sealed');
  const [shown, setShown] = useState(() => premios.map(() => still));
  // La recompensa elegida para colocarla (índice) o null; la marca ✓ es solo suya
  const [picked, setPicked] = useState(null);
  const shownRef = useRef(shown);
  const timers = useRef([]);
  const going = useRef(false);
  const pack = useMemo(() => counterPack(sobre), [sobre]);
  const back = useMemo(() => cardBackArt(sobre), [sobre]);
  const layout = useMemo(() => counterLayout(premios.length), [premios.length]);
  const scene = useMemo(() => ({ base: renderShopCounter('base').scene, happy: renderShopCounter('happy').scene }), []);
  const thumbs = useMemo(() => premios.map((p) => cardThumb(p.mueble)), [premios]);
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));
  const allShown = shown.every(Boolean);
  const focusRef = useRef(null);
  const cardRef = useRef(null);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  // Con movimiento reducido no hay animación, pero sí la nota de lo mejor (la persona acaba de tocar «Abrir»)
  useEffect(() => {
    if (still) sfx.play(`reveal-${best}`);
    focusRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Una carta se da la vuelta una sola vez (aunque se toque dos veces o se mezcle con «Revelar todas»)
  const flip = (i) => {
    if (shownRef.current[i]) return;
    shownRef.current = shownRef.current.map((v, k) => v || k === i);
    sfx.play('flip');
    later(() => sfx.play(`reveal-${premios[i].rareza}`), 140);
    setShown(shownRef.current);
  };

  const openPack = () => {
    if (phase !== 'sealed') return;
    sfx.play('tear');
    setPhase('opening');
    // La primera se da la vuelta aún dentro del sobre y sale boca arriba por su boca («1 de 5 reveladas»); con una
    // sola, sigue sola a su sitio
    later(() => flip(0), 450);
    later(() => {
      setPhase('peek');
      if (n === 1) later(() => setPhase('cards'), 900);
    }, OPEN_MS);
  };

  const revealRest = () => {
    let k = 0;
    premios.forEach((_, i) => {
      if (shownRef.current[i]) return;
      later(() => flip(i), k * STAGGER_MS);
      k += 1;
    });
  };

  // Al continuar desde «1 de 5», primero las cartas van a su sitio (3 + 2) y luego se giran
  const flipAll = () => {
    if (phase !== 'peek') return revealRest();
    setPhase('cards');
    later(revealRest, SETTLE_MS);
  };

  // Tocar una carta: boca abajo, se revela; ya revelada, se elige para colocarla. Desde «1 de 5», tocar cualquiera
  // primero lleva las cartas a su sitio
  const touch = (i) => {
    if (phase === 'opening') return;
    if (phase === 'peek') {
      setPhase('cards');
      if (i > 0) later(() => flip(i), SETTLE_MS);
      return;
    }
    if (!shownRef.current[i]) return flip(i);
    if (picked === i) return;
    sfx.play('tap');
    setPicked(i);
  };

  useEffect(() => {
    if (phase === 'peek') cardRef.current?.focus();
  }, [phase]);

  useEffect(() => {
    if (phase === 'cards' && allShown) later(() => setPhase('done'), 650);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, allShown]);

  const nuevos = premios.filter((p) => p.nuevo).length;
  const reveladas = shown.filter(Boolean).length;
  const summary = `${n === 1 ? 'Te llevas' : `Te llevas ${n} muebles:`} ${premios.map((p) => nameOf(p.mueble).toLowerCase()).join(', ')}.${nuevos ? ` ${nuevos === 1 ? 'Uno es nuevo' : `${nuevos} son nuevos`} para ti.` : ''}`;
  const tally = `${n === 1 ? 'Un mueble' : `${n} muebles`} para tu piso${nuevos ? ` · ${nuevos === 1 ? (n === 1 ? 'nuevo' : '1 nuevo') : `${nuevos} nuevos`}` : ''}`;
  const sealed = phase === 'sealed';
  const final = phase === 'done';
  const legendario = premios.find((p) => p.rareza === 'legendario');
  const mistico = premios.find((p) => p.rareza === 'mistico');
  const misticoNote = legendario
    ? `${nameOf(legendario.mueble)} puede acompañarte: elígelo en el armario de tu personaje.`
    : mistico
      ? `${nameOf(mistico.mueble)} se coloca en tu piso sobre su peana, en la pestaña «Místicos».`
      : '';
  // Lo elegido se lleva al editor del piso con su identificador real (un legendario no se coloca: te acompaña)
  const choice = picked !== null && premios[picked].rareza !== 'legendario' ? premios[picked] : null;
  const goPiso = () => {
    if (going.current) return;
    going.current = true;
    onGoPiso(choice?.mueble ?? null);
  };
  // Al abrirlo, la primera asoma por la boca del sobre y las demás esperan (layout.peek); al continuar, cada carta va a
  // su sitio definitivo (layout.cards), el mismo para la revelación, la elección y lo que se toca, y el sobre vacío y la
  // tira salen por la izquierda hasta quedar fuera del encuadre; al final (y con movimiento reducido, desde el principio)
  // ya no están: sobre la madera solo quedan las cartas
  const open = phase === 'opening' || phase === 'peek';
  const gone = phase === 'cards';
  const spots = open ? layout.peek : layout.cards;
  const to = (a, b) => (gone ? b : open ? a : { left: 0, top: 0 });
  const packAt = to(layout.side, pack.exit);
  const stripAt = to(layout.side, pack.stripExit);
  const packVars = { '--ax': packAt.left, '--ay': packAt.top };
  const stripVars = { '--ax': stripAt.left, '--ay': stripAt.top, '--turn': `${STRIP_TURN}deg` };
  // Solo en desarrollo: las pruebas comparan lo que se toca con el reparto calculado
  if (import.meta.env.DEV) window.__gacha = { layout, pack, board: { top: renderShopCounter('base').top, edge: renderShopCounter('base').edge } };

  return (
    <div
      className={`gacha gacha--${best} is-${phase}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="gacha-title"
      style={{ '--cw': COUNTER_W, '--ch': COUNTER_H, backgroundImage: `url(${final ? scene.happy : scene.base})` }}
    >
      <h2 id="gacha-title" className="px-sr">
        {n === 1 ? `Abriendo un sobre «${sobre.nombre}»` : `Abriendo cinco sobres «${sobre.nombre}»`}
      </h2>
      {!final && (
        <>
          {/* El sobre tumbado en el tablero, dibujado con la cámara del mostrador (counterPack): la tira con la pestaña
              y el cuerpo son dos capas del tamaño de la escena; la tira se desprende entera y cae en la madera */}
          <span className="gacha__fx" aria-hidden="true" style={{ ...packVars, '--l': pack.box.left, '--r': pack.box.right, '--t': pack.box.top, '--b': pack.box.bottom }}>
            <span className="gacha__glow" />
            <span className="gacha__burst" />
            {sealed && ALTO.includes(best) && (
              <span className="gacha__motes">
                {Array.from({ length: 8 }, (_, k) => (
                  <i key={k} style={{ '--k': k, '--t': (k * 37) % 60 }} />
                ))}
              </span>
            )}
          </span>
          <img
            className="gacha__lie gacha__lie--strip"
            src={pack.strip}
            alt=""
            draggable="false"
            style={{ ...stripVars, '--sx': pack.stripAt.left, '--sy': pack.stripAt.top, '--rx': pack.rest.left, '--ry': pack.rest.top }}
          />
          <img className="gacha__lie gacha__lie--body" src={pack.body} alt="" draggable="false" style={{ ...packVars, '--sx': pack.stripAt.left, '--sy': pack.stripAt.top }} />
          {/* La zona que se toca es el recuadro del sobre en la misma proyección del dibujo */}
          {sealed && (
            <button
              ref={focusRef}
              type="button"
              className="gacha__env"
              onClick={openPack}
              aria-label={`Rasgar el sobre «${sobre.nombre}»`}
              style={{ '--l': pack.box.left, '--r': pack.box.right, '--t': pack.box.top, '--b': pack.box.bottom }}
            />
          )}
        </>
      )}
      {!sealed && (
        <ul className={`gacha__cards gacha__cards--n${n}${final ? ' is-final' : ''}`} style={{ '--peek-turn': `${PEEK_TURN}deg` }}>
          {premios.map((p, i) => {
            const info = rarezaInfo(p.rareza);
            const at = spots[i];
            const isPicked = shown[i] && picked === i;
            const peeking = open && i === 0;
            return (
              <li key={i} className={peeking ? 'is-peeking' : undefined} style={{ '--i': i, '--x': at.left, '--y': at.top, '--card-w': `${at.w * 100}cqw` }}>
                {peeking && (
                  <span className="gacha__peek" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                )}
                <button
                  ref={i === 1 ? cardRef : null}
                  type="button"
                  className={`gacha__card is-${p.rareza}${shown[i] ? ' is-shown' : ''}${isPicked ? ' is-picked' : ''}`}
                  onClick={() => touch(i)}
                  aria-pressed={shown[i] ? isPicked : undefined}
                  aria-label={shown[i] ? `${nameOf(p.mueble)}, ${info.nombre.toLowerCase()}${p.nuevo ? ', nuevo' : ''}` : `Revelar carta ${i + 1} de ${n}`}
                >
                  <img className="gacha__back" src={back} alt="" draggable="false" />
                  <span className="gacha__face">
                    {(p.rareza === 'mistico' || p.rareza === 'legendario') && <span className="gacha__rays" aria-hidden="true" />}
                    {isMistico(catalogItem(p.mueble)) ? (
                      <>
                        <MisticoFace id={p.mueble} size={n === 1 ? 96 : 64} live={shown[i] && !still} />
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
                  {isPicked && (
                    <b className="gacha__pick" aria-hidden="true">
                      ✓
                    </b>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {/* Abajo, de borde a borde (como en las maquetas): el nombre del sobre y qué hacer; al abrir, cuántas van */}
      <div className="gacha__paper">
        {final ? (
          <>
            <p className="gacha__tally" role="status">
              <span aria-hidden="true">{tally}</span>
              <span className="px-sr">{summary}</span>
            </p>
            {misticoNote && <p className="gacha__mnote">{misticoNote}</p>}
            <button type="button" className="px-btn px-btn--sage gacha__go" onClick={goPiso}>
              {choice ? `Colocar ${nameOf(choice.mueble).toLowerCase()}` : 'Colocar en mi piso'}
            </button>
            <p className="gacha__hint gacha__hint--pick" aria-live="polite">
              {choice ? '' : 'Toca una carta para elegir qué colocar.'}
            </p>
            <button type="button" className="gacha__link" onClick={onClose}>
              Volver a la tienda
            </button>
          </>
        ) : sealed || phase === 'opening' || n === 1 ? (
          <>
            <h3 className="gacha__title">{sobre.nombre}</h3>
            <Ornament />
            <p className="gacha__hint" aria-live="polite">
              {sealed ? 'Toca para rasgar el precinto.' : ''}
            </p>
          </>
        ) : (
          <>
            <p className="gacha__count" aria-live="polite">
              <i aria-hidden="true" />
              {reveladas} de {n} reveladas
              <i aria-hidden="true" />
            </p>
            {!allShown && (
              <button type="button" className="px-btn px-btn--sage gacha__go" onClick={flipAll}>
                Revelar todas
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
