// El casino del sótano del Gran Hotel (1.80; paso C de docs/qa/gran-hotel.md §9.4, decisiones de Francisco del
// 2-11-2026). «Las 21 páginas»: un veintiuno contra el crupier con cartas-página, tres manos al día y SIN APOSTAR: cada
// mano da fichas (8 si ganas, 12 con veintiuna servida, 4 si empatas y 2 si pierdes; nunca se pierde nada), con un
// tope de 150 a la semana. La puerta solo se enciende si hoy has leído (páginas registradas o una sesión de lectura).
// Reparte y puntúa el servidor (supabase/migrations/20261110120000_hotel_casino.sql): aquí solo se ven tus cartas y la
// vista del crupier. Sin falsos «casi», sin cuentas atrás y sin «otra más»: al acabar la mano, el resultado y ya.
// Encargo de Francisco (3-11-2026, «que tenga más presencia, acorde a los colores de la sala y más videojuego»): arriba,
// la sala con el crupier que habla en un bocadillo; debajo, la mesa de juego de cerca, como en un videojuego: tapete
// verde con marco de latón y nogal, el marcador (fichas, garbanzos, semana y las tres manos como fichas de colores),
// cartas grandes que se reparten deslizándose, el total de cada uno en cifras de píxel, un cartel con el resultado y
// botones gruesos. Con movimiento reducido, sin animaciones; los sonidos, breves y solo con el sonido de la app activado.
// Tres pestañas: a solas, la mesa para dos (MesaParaDos.jsx), con un amigo y el mismo crupier, en diferido, y la caja
// (CajaCasino.jsx), donde las fichas se cambian por premios; la ventanilla de la sala también la abre.
import { useEffect, useRef, useState } from 'react';
import { dayKey } from '../../../domain/dates';
import { useLibrary } from '../../../state/useLibrary';
import { useCommunity } from '../../social/hooks/useCommunity';
import { jugarCasino, loadCasino, repartirCasino } from '../service';
import { createShopSfx } from '../shopAudio';
import { Carta, Huecos, PixelNum, Total } from './cartas21';
import { useCountUp } from './useCountUp';
import { CASINO, fichasDe, FINAL, leidoHoy } from './veintiuna';
import { CASINO_H, CASINO_W, renderCasino } from './casinoArt';
import { CajaCasino } from './CajaCasino';
import { MesaParaDos } from './MesaParaDos';

const NOTE = {
  loading: 'Un momento, que bajamos al sótano…',
  'signed-out': 'Inicia sesión y activa la comunidad para bajar al casino.',
  'no-community': 'Activa la comunidad en tu perfil para bajar al casino.',
  soon: 'El casino aún está cerrado: abre muy pronto.',
};

// Lo que dice el crupier (frases cerradas; nunca empuja a jugar otra)
const DICE = {
  cerrada: 'Hoy aún no has leído. Lee un poco y te abro la mesa.',
  nueva: '¿Repartimos? Hoy tienes tres manos.',
  sigue: 'Cuando quieras, reparto la siguiente.',
  jugando: '¿Otra carta o te plantas?',
  veintiuna: '¡Veintiuna servida! Bien jugado.',
  ganada: 'Bien jugado: la mano es tuya.',
  empate: 'Empate. A partes iguales.',
  perdida: 'Esta vez, la casa. Las fichas son tuyas igual.',
  hecho: 'Por hoy cerramos la mesa. Mañana, más.',
  pareja: 'Mesa para dos: el mismo mazo y el mismo crupier para los dos.',
  caja: 'La caja está abierta: elige con calma, los precios no cambian.',
};

const CARTEL = { veintiuna: '¡Veintiuna!', ganada: '¡Ganas la mano!', empate: 'Empate', perdida: 'Gana la casa' };

/** Lo que dice cada ficha del marcador de manos. */
function manoDice(m, k, mesas) {
  if (!m) return `Mano ${k + 1}: por jugar`;
  const con = m.mesa ? ` con ${mesas.find((x) => x.id === m.mesa)?.amigo?.alias ?? 'un amigo'}` : '';
  if (m.estado === 'jugando') return `Mano ${k + 1}${con}: en juego`;
  if (m.estado === 'esperando') return `Mano ${k + 1}${con}: esperando`;
  return `Mano ${k + 1}${con}: ${FINAL[m.estado].toLowerCase()}, +${m.fichas}`;
}

export function Casino({ onStreet, soundOn = false }) {
  const { state } = useLibrary();
  const leido = leidoHoy(state);
  const community = useCommunity({ autoload: true });
  const member = community.status === 'ready' && community.member;
  const [data, setData] = useState(undefined);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [modo, setModo] = useState('solo');
  // Cuántas cartas había antes de la última jugada (las nuevas entran deslizándose) y si la mano acaba de terminar
  const [antes, setAntes] = useState({ tuyas: Infinity, crupier: Infinity });
  const [recien, setRecien] = useState(false);
  const [sfx] = useState(() => createShopSfx({ muted: !soundOn }));
  useEffect(() => sfx.setMuted(!soundOn), [sfx, soundOn]);
  useEffect(() => () => sfx.destroy(), [sfx]);
  const root = useRef(null);
  const dia = dayKey();

  useEffect(() => {
    if (!member) return undefined;
    let alive = true;
    loadCasino(dia).then(
      (d) => alive && setData(d),
      () => alive && setData(null),
    );
    return () => {
      alive = false;
    };
  }, [member, dia]);
  useEffect(() => {
    root.current?.scrollIntoView({ block: 'start' });
  }, []);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onStreet();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onStreet]);

  let status = 'loading';
  if (['signed-out', 'off'].includes(community.status)) status = 'signed-out';
  else if (['unavailable', 'error'].includes(community.status)) status = 'soon';
  else if (community.status === 'ready' && !community.member) status = 'no-community';
  else if (member && data === null) status = 'soon';
  else if (member && data) status = 'ready';

  const abierta = status === 'ready' && leido;
  const room = renderCasino({ apagada: !abierta });
  // A solas: la última mano que no es de una mesa para dos
  const solo = (d) => d?.manos.filter((m) => !m.mesa).at(-1) ?? null;
  const mano = solo(data);
  const enJuego = Boolean(mano && mano.estado === 'jugando');
  const fichas = useCountUp(data?.fichas ?? 0);
  const garbanzos = useCountUp(data?.garbanzos ?? 0);
  // Lo que te espera en la mesa para dos: invitaciones y manos por jugar
  const teEsperan = data ? data.mesas.filter((m) => (m.estado === 'invitada' && !m.anfitrion) || (m.estado === 'jugando' && m.mia?.estado === 'jugando')) : [];

  const run = async (fn) => {
    setBusy(true);
    setMsg('');
    setRecien(false);
    setAntes(enJuego ? { tuyas: mano.tuyas.length, crupier: mano.crupier.length } : { tuyas: 0, crupier: 0 });
    try {
      const next = await fn();
      setData(next);
      sfx.play('deal');
      const ult = solo(next);
      if (ult && ult.estado !== 'jugando') {
        setRecien(true);
        setTimeout(() => sfx.play(`mano-${ult.estado}`), 180);
        if (ult.fichas > 0) setTimeout(() => sfx.play('chips'), 520);
        setMsg(`${FINAL[ult.estado]}: +${fichasDe(ult.fichas)}.`);
      }
    } catch (e) {
      setMsg(`No se ha podido: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };
  const repartir = () => run(() => repartirCasino(dia));
  const jugar = (accion) => run(() => jugarCasino(dia, accion));
  const cambiar = (m) => {
    sfx.play('tap');
    setModo(m);
    setMsg('');
    setRecien(false);
    setAntes({ tuyas: Infinity, crupier: Infinity });
  };

  let dice = null;
  if (status === 'ready') {
    if (modo === 'caja') dice = DICE.caja;
    else if (!leido) dice = DICE.cerrada;
    else if (modo === 'pareja') dice = DICE.pareja;
    else if (enJuego) dice = DICE.jugando;
    else if (mano && recien) dice = DICE[mano.estado];
    else if (teEsperan.length) dice = `${teEsperan[0].amigo?.alias ?? 'Alguien'} te espera en la mesa para dos.`;
    else if (data.quedan === 0) dice = DICE.hecho;
    else dice = data.manos.length ? DICE.sigue : DICE.nueva;
  }
  const place = (p) => ({ left: `${p.left * 100}%`, top: `${p.top * 100}%` });
  const semana = data ? Math.min(data.semana, data.tope) : 0;
  return (
    <section className="gh-casino" ref={root} aria-labelledby="gh-casino-title" data-escape-local="open">
      <h3 className="px-sr" id="gh-casino-title">
        El casino del sótano
      </h3>
      <div className={abierta ? 'gh-casino__scene' : 'gh-casino__scene is-off'} style={{ aspectRatio: `${CASINO_W} / ${CASINO_H}` }}>
        <img
          className="gh-casino__art"
          src={room.scene}
          alt={
            abierta
              ? 'El casino del sótano, de noche: moqueta roja con rombos dorados, papel pintado verde, una lámpara de flecos sobre la mesa de tapete verde, el crupier con chaleco, pajarita y visera, un rótulo de neón «21» y la ventanilla de la caja con su reja.'
              : 'El casino del sótano, en penumbra: la mesa de tapete verde y el crupier, con las luces apagadas.'
          }
          draggable="false"
        />
        {modo === 'caja' && <img className="gh-casino__outline" src={room.outlines.caja} alt="" aria-hidden="true" draggable="false" />}
        {dice && (
          <p className="gh-casino__say" style={place(room.at.cabeza)} key={dice}>
            <span className="px-sr">El crupier dice: </span>
            {dice}
          </p>
        )}
        {status === 'ready' && (
          <button type="button" className="gh-spot is-caja" style={place(room.at.caja)} aria-pressed={modo === 'caja'} onClick={() => cambiar(modo === 'caja' ? 'solo' : 'caja')}>
            Caja
          </button>
        )}
      </div>

      {/* La mesa de juego, de cerca */}
      <div className={abierta ? 'gh-21' : 'gh-21 is-off'}>
        {status !== 'ready' ? (
          <p className="gh-21__note">{NOTE[status]}</p>
        ) : (
          <>
            <div className="gh-21__hud">
              <div className="gh-21__purse">
                <p className="gh-21__chips">
                  <i aria-hidden="true" />
                  <PixelNum value={fichas} label={`${data.fichas} fichas`} />
                  <span aria-hidden="true">fichas</span>
                </p>
                <p className="gh-21__chips is-beans">
                  <i aria-hidden="true" />
                  <PixelNum value={garbanzos} label={`${data.garbanzos} garbanzos`} />
                  <span aria-hidden="true">garbanzos</span>
                </p>
              </div>
              <div className="gh-21__week">
                <span>
                  Semana {semana}/{data.tope}
                </span>
                <span className="gh-21__bar" role="progressbar" aria-label="Fichas de esta semana" aria-valuemin={0} aria-valuemax={data.tope} aria-valuenow={semana}>
                  <span style={{ width: `${(semana / data.tope) * 100}%` }} />
                </span>
              </div>
              <ol className="gh-21__hands" aria-label="Tus manos de hoy">
                {Array.from({ length: CASINO.manos }, (_, k) => {
                  const m = data.manos[k];
                  return (
                    <li key={k} className={m ? `is-${m.estado}${m.mesa ? ' is-pair' : ''}` : ''}>
                      <span className="px-sr">{manoDice(m, k, data.mesas)}</span>
                    </li>
                  );
                })}
              </ol>
            </div>

            <div className="gh-21__modes" role="group" aria-label="Cómo jugar">
              <button type="button" aria-pressed={modo === 'solo'} onClick={() => cambiar('solo')}>
                A solas
              </button>
              <button type="button" aria-pressed={modo === 'pareja'} onClick={() => cambiar('pareja')}>
                Con un amigo
                {teEsperan.length > 0 && (
                  <b className="gh-21__badge" aria-label={`${teEsperan.length} te ${teEsperan.length === 1 ? 'espera' : 'esperan'}`}>
                    {teEsperan.length}
                  </b>
                )}
              </button>
              <button type="button" aria-pressed={modo === 'caja'} onClick={() => cambiar('caja')}>
                La caja
              </button>
            </div>

            {modo === 'caja' ? (
              <CajaCasino data={data} dia={dia} onData={setData} sfx={sfx} />
            ) : !leido ? (
              <div className="gh-21__felt">
                <div className="gh-21__closed">
                  <h4>La puerta está apagada</h4>
                  <p>El casino solo se enciende los días que lees. Registra unas páginas o una sesión de lectura y el crupier te reparte.</p>
                </div>
              </div>
            ) : modo === 'pareja' ? (
              <MesaParaDos data={data} dia={dia} onData={setData} sfx={sfx} />
            ) : (
              <>
                <div className="gh-21__felt">
                  <div className="gh-21__row is-crupier">
                    <Total who="Crupier" value={mano ? mano.suyo : null} />
                    {mano ? (
                      <ul className="gh-21__cards" aria-label={`Cartas del crupier${mano.suyo != null ? `: ${mano.suyo}` : ''}`}>
                        {mano.crupier.map((c, k) => (
                          <Carta key={`${mano.mano}-c${k}`} c={c} k={k} nueva={k >= antes.crupier} />
                        ))}
                        {enJuego && <Carta tapada k={1} nueva={antes.crupier === 0} />}
                      </ul>
                    ) : (
                      <Huecos />
                    )}
                  </div>

                  <div className="gh-21__middle">
                    {mano && recien && mano.estado !== 'jugando' ? (
                      <p className={`gh-21__banner is-${mano.estado}`}>
                        <b>{CARTEL[mano.estado]}</b>
                        <span>
                          <PixelNum value={`+${mano.fichas}`} label={`más ${fichasDe(mano.fichas)}`} />
                          <i aria-hidden="true" />
                        </span>
                      </p>
                    ) : (
                      <svg className="gh-21__motto" viewBox="0 0 300 40" aria-hidden="true">
                        <path id="gh-21-arc" d="M 20 6 Q 150 46 280 6" fill="none" />
                        <text>
                          <textPath href="#gh-21-arc" startOffset="50%" textAnchor="middle">
                            LAS 21 PÁGINAS
                          </textPath>
                        </text>
                      </svg>
                    )}
                  </div>

                  <div className="gh-21__row is-tuyas">
                    {mano ? (
                      <ul className="gh-21__cards" aria-label={`Tus cartas: ${mano.tu}`}>
                        {mano.tuyas.map((c, k) => (
                          <Carta key={`${mano.mano}-t${k}`} c={c} k={k} nueva={k >= antes.tuyas} />
                        ))}
                      </ul>
                    ) : (
                      <Huecos />
                    )}
                    <Total who="Tú" value={mano ? mano.tu : null} />
                  </div>
                </div>

                <div className="gh-21__acts">
                  {enJuego ? (
                    <>
                      <button type="button" className="gh-21btn is-hit" disabled={busy} onClick={() => jugar('pedir')}>
                        Pedir carta
                      </button>
                      <button type="button" className="gh-21btn is-stand" disabled={busy} onClick={() => jugar('plantarse')}>
                        Plantarse
                      </button>
                    </>
                  ) : data.quedan > 0 ? (
                    <button type="button" className="gh-21btn is-deal" disabled={busy} onClick={repartir}>
                      {`Repartir la mano ${CASINO.manos - data.quedan + 1} de ${CASINO.manos}`}
                    </button>
                  ) : (
                    <p className="gh-21__done">Hoy ya has jugado tus tres manos: el crupier vuelve a barajar mañana.</p>
                  )}
                </div>
                <p className="gh-21__msg" role="status" aria-live="polite">
                  {msg}
                </p>
              </>
            )}
            <details className="gh-21__rules">
              <summary>Cómo se juega</summary>
              <p>
                Pide cartas para acercarte a 21 sin pasarte (el as vale 1 u 11; las figuras, 10) y plántate cuando quieras. El crupier pide hasta llegar a 17. Contra el crupier no se apuesta nada:
                ganar da {CASINO.ganada} fichas, una veintiuna servida {CASINO.veintiuna}, empatar {CASINO.empate} y perder {CASINO.perdida}. Como mucho, {CASINO.tope} fichas a la semana.
              </p>
              <p>
                Con un amigo (os seguís los dos) jugáis contra el mismo crupier y el mismo mazo, cada uno cuando quiera; esas manos son de tus tres del día y dan {CASINO.compania} fichas más de
                compañía. Entre los dos podéis apostar, una mesa al día, hasta {CASINO.apuestaFichas} fichas y {CASINO.apuestaGarbanzos} garbanzos: se lo lleva quien acabe más cerca de 21 sin
                pasarse, y si empatáis se devuelve. Los garbanzos son de mentira: {CASINO.garbanzosInicio} al empezar y {CASINO.garbanzosDia} más cada día que juegas.
              </p>
            </details>
          </>
        )}
      </div>
    </section>
  );
}
