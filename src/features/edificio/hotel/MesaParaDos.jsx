// La mesa para dos del casino (1.80; decisiones de Francisco del 3-11-2026: «Fichas y garbanzos», «Os seguís los dos»,
// «En diferido»). Con un amigo (os seguís los dos) se juega contra el mismo crupier y el mismo mazo, cada uno cuando
// quiere: el crupier destapa cuando habéis terminado los dos. Esas manos son de las tres del día y dan 2 fichas de
// compañía. Entre los dos se puede apostar, aceptándolo los dos: una mesa al día por pareja, hasta 10 fichas y 50
// garbanzos (imaginarios, sin ningún valor); gana quien acaba más cerca de 21 sin pasarse y el empate se devuelve.
// Las cantidades se eligen entre unas pocas fijas (nunca texto libre) y nunca más de lo que tienes. Las cartas del amigo
// se ven boca abajo hasta que la mesa se resuelve. Lo decide todo el servidor (20261110120000_hotel_casino.sql).
// Desde la 1.82 (Francisco, 4-11-2026), sin mesa del día con ese amigo o sin manos se sigue con mesas de garbanzos: solo
// se apuestan garbanzos, no gastan las tres manos y no dan fichas. Cada jugada toca al amigo para que lo vea al momento.
import { useState } from 'react';
import { ReaderAvatar } from '../../../components/avatars/ReaderAvatar';
import { aceptarMesa, avisarMesa, invitarMesa, invitarMesaGarbanzos, jugarMesa, loadCasino, rechazarMesa } from '../service';
import { Carta, PixelNum, Total } from './cartas21';
import { CASINO, fichasDe, FINAL, garbanzosDe } from './veintiuna';

const FICHAS = [0, 2, 5, CASINO.apuestaFichas];
const GARBANZOS = [0, 10, 25, CASINO.apuestaGarbanzos];
const CARTEL = { veintiuna: '¡Veintiuna!', ganada: '¡Ganas la mano!', empate: 'Empate', perdida: 'Gana la casa' };
// En las mesas de garbanzos solo cuenta quién gana a quién
const CARTEL_GARBANZOS = { ganas: '¡Ganas tú!', pierdes: 'Gana tu amigo', empate: 'Empate' };

const nombre = (m) => m.amigo?.alias ?? 'Tu pareja de mesa';
const hayApuesta = (m) => m.fichas > 0 || m.garbanzos > 0;
/** Lo que se apuesta cada uno, para leerlo. */
const apuestaDe = (m) =>
  hayApuesta(m)
    ? [m.fichas > 0 && fichasDe(m.fichas), m.garbanzos > 0 && garbanzosDe(m.garbanzos)].filter(Boolean).join(' y ') + ' cada uno'
    : 'Sin apuesta: por la compañía';
/** El bote (lo de los dos). */
const boteDe = (m) => [m.fichas > 0 && fichasDe(m.fichas * 2), m.garbanzos > 0 && garbanzosDe(m.garbanzos * 2)].filter(Boolean).join(' y ');

/** Cómo acabó la mesa, para el aviso. */
function resultado(m) {
  const mano = m.solo_garbanzos ? '' : `${FINAL[m.mia.estado]}: +${fichasDe(m.mia.fichas)}. `;
  if (!hayApuesta(m)) return mano.trim();
  if (m.apuesta === 'ganas') return `${mano}Te llevas el bote: ${boteDe(m)}.`;
  if (m.apuesta === 'pierdes') return `${mano}El bote es para ${nombre(m)}.`;
  return `${mano}Empate con ${nombre(m)}: cada uno recupera lo suyo.`;
}

/** En qué está una mesa, en dos palabras. */
function enQue(m) {
  if (m.estado === 'invitada') return m.anfitrion ? `Esperando a que ${nombre(m)} acepte` : `${nombre(m)} te invita`;
  if (m.estado === 'cerrada') return { ganas: 'Ganas la apuesta', pierdes: `La apuesta es de ${nombre(m)}`, empate: 'Apuesta devuelta' }[m.apuesta] ?? 'Mesa cerrada';
  return m.mia?.estado === 'jugando' ? 'Te toca' : `Esperando a ${nombre(m)}`;
}

/** Elegir una cantidad entre unas pocas (sin escribir nada). */
function Cantidad({ label, opciones, value, max, onChange, de }) {
  return (
    <fieldset className="gh-21__qty">
      <legend>{label}</legend>
      {opciones.map((n) => (
        <button key={n} type="button" className="gh-21chip" aria-pressed={value === n} aria-label={de(n)} disabled={n > max} onClick={() => onChange(n)}>
          {n}
        </button>
      ))}
    </fieldset>
  );
}

export function MesaParaDos({ data, dia, onData, sfx }) {
  const [sel, setSel] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [antes, setAntes] = useState({ tuyas: Infinity, crupier: Infinity, suyas: Infinity });
  const [amigo, setAmigo] = useState(null);
  const [apFichas, setApFichas] = useState(0);
  const [apGarbanzos, setApGarbanzos] = useState(0);

  const mesa = data.mesas.find((m) => m.id === sel && m.mia) ?? null;
  const recibidas = data.mesas.filter((m) => m.estado === 'invitada' && !m.anfitrion);
  const otras = data.mesas.filter((m) => !(m.estado === 'invitada' && !m.anfitrion) && m.estado !== 'rechazada');
  // Con quién se puede abrir la mesa del día y con quién, si no, una de garbanzos
  const mesaDelDia = (a) => data.quedan > 0 && !data.mesas.some((m) => m.amigo.uid === a.uid && m.dia === dia && m.estado !== 'rechazada' && !m.solo_garbanzos);
  const mesaGarbanzos = (a) => data.quedanGarbanzos > 0 && !data.mesas.some((m) => m.amigo.uid === a.uid && ['invitada', 'jugando'].includes(m.estado));
  const libres = data.amigos.filter((a) => mesaDelDia(a) || mesaGarbanzos(a));
  const elegido = libres.find((a) => a.uid === amigo) ?? null;
  const deGarbanzos = elegido ? !mesaDelDia(elegido) : libres.every((a) => !mesaDelDia(a));
  const faltaApuesta = deGarbanzos && (apGarbanzos === 0 || apGarbanzos > data.garbanzos);

  const run = async (fn, id = sel, tocar = true) => {
    setBusy(true);
    setMsg('');
    const prev = data.mesas.find((m) => m.id === id);
    setAntes(prev?.mia ? { tuyas: prev.mia.tuyas.length, crupier: prev.crupier.length, suyas: prev.suya?.cartas ?? 0 } : { tuyas: 0, crupier: 0, suyas: 0 });
    try {
      const next = await fn();
      onData(next);
      const m = next.mesas.find((x) => x.id === id);
      sfx.play(m?.mia ? 'deal' : 'tap');
      // Se le toca cuando algo le afecta: si sigues pidiendo cartas, aún no
      const otro = (m ?? prev)?.amigo?.uid;
      if (tocar && otro && m?.mia?.estado !== 'jugando') avisarMesa(otro);
      if (m?.mia && m.estado === 'cerrada' && prev?.estado !== 'cerrada') {
        setTimeout(() => sfx.play(`mano-${m.mia.estado}`), 180);
        if (m.mia.fichas > 0) setTimeout(() => sfx.play('chips'), 520);
        setMsg(resultado(m));
      }
      return next;
    } catch (e) {
      setMsg(`No se ha podido: ${e.message}`);
      return null;
    } finally {
      setBusy(false);
    }
  };
  const invitar = async () => {
    const next = await run(() => (deGarbanzos ? invitarMesaGarbanzos(dia, elegido.uid, apGarbanzos) : invitarMesa(dia, elegido.uid, apFichas, apGarbanzos)), null);
    if (next) {
      avisarMesa(elegido.uid);
      setMsg(`Invitación enviada a ${elegido.alias}: le llega el aviso aunque no esté en el casino. Cuando acepte, el crupier os reparte.`);
      setAmigo(null);
    }
  };
  const aceptar = (m) => {
    setSel(m.id);
    run(() => aceptarMesa(m.id), m.id);
  };
  const abrir = (m) => {
    setSel(m.id);
    setMsg('');
    setAntes({ tuyas: Infinity, crupier: Infinity, suyas: Infinity });
  };

  // ── La mesa, de cerca ──
  if (mesa) {
    const juego = mesa.estado === 'jugando';
    const tuTurno = juego && mesa.mia.estado === 'jugando';
    const suya = mesa.suya ?? { estado: 'jugando', cartas: 2 };
    return (
      <>
        <div className="gh-21__felt is-pair">
          <div className="gh-21__row is-crupier">
            <Total who="Crupier" value={mesa.suyo} />
            <ul className="gh-21__cards" aria-label={`Cartas del crupier${mesa.suyo != null ? `: ${mesa.suyo}` : ''}`}>
              {mesa.crupier.map((c, k) => (
                <Carta key={`c${k}`} c={c} k={k} nueva={k >= antes.crupier} />
              ))}
              {juego && <Carta tapada k={1} />}
            </ul>
          </div>

          <div className="gh-21__friend">
            <ReaderAvatar avatarId={mesa.amigo.avatar_id} alias={nombre(mesa)} size="list" decorative />
            <p>
              <b>{nombre(mesa)}</b>
              <span>{juego ? (suya.estado === 'jugando' ? 'aún juega su mano' : 'ya ha terminado') : `${suya.tu}${suya.tu > 21 ? ', se pasa' : ''}`}</span>
            </p>
            <ul className="gh-21__cards is-mini" aria-label={juego ? `Cartas de ${nombre(mesa)}: ${suya.cartas}, boca abajo` : `Cartas de ${nombre(mesa)}: ${suya.tu}`}>
              {juego ? Array.from({ length: suya.cartas }, (_, k) => <Carta key={k} tapada mini />) : suya.tuyas.map((c, k) => <Carta key={k} c={c} k={k} mini nueva={antes.suyas !== Infinity} />)}
            </ul>
          </div>

          <div className="gh-21__middle">
            {!juego ? (
              <p className={`gh-21__banner is-${mesa.mia.estado}`}>
                <b>{mesa.solo_garbanzos ? CARTEL_GARBANZOS[mesa.apuesta] : CARTEL[mesa.mia.estado]}</b>
                {!mesa.solo_garbanzos && (
                  <span>
                    <PixelNum value={`+${mesa.mia.fichas}`} label={`más ${fichasDe(mesa.mia.fichas)}`} />
                    <i aria-hidden="true" />
                  </span>
                )}
                {hayApuesta(mesa) && <em className={`is-${mesa.apuesta}`}>{{ ganas: 'El bote es tuyo', pierdes: `Bote para ${nombre(mesa)}`, empate: 'Bote devuelto' }[mesa.apuesta]}</em>}
              </p>
            ) : (
              <p className="gh-21__pot">
                <span>{hayApuesta(mesa) ? 'Bote' : 'Mesa para dos'}</span>
                <b>{hayApuesta(mesa) ? boteDe(mesa) : 'por la compañía'}</b>
              </p>
            )}
          </div>

          <div className="gh-21__row is-tuyas">
            <ul className="gh-21__cards" aria-label={`Tus cartas: ${mesa.mia.tu}`}>
              {mesa.mia.tuyas.map((c, k) => (
                <Carta key={`t${k}`} c={c} k={k} nueva={k >= antes.tuyas} />
              ))}
            </ul>
            <Total who="Tú" value={mesa.mia.tu} />
          </div>
        </div>

        <div className="gh-21__acts">
          {tuTurno ? (
            <>
              <button type="button" className="gh-21btn is-hit" disabled={busy} onClick={() => run(() => jugarMesa(mesa.id, 'pedir'))}>
                Pedir carta
              </button>
              <button type="button" className="gh-21btn is-stand" disabled={busy} onClick={() => run(() => jugarMesa(mesa.id, 'plantarse'))}>
                Plantarse
              </button>
            </>
          ) : juego ? (
            <>
              <p className="gh-21__done">Esperando a que {nombre(mesa)} juegue su mano: el crupier destapa cuando terminéis los dos.</p>
              <button type="button" className="gh-21btn is-deal is-small" disabled={busy} onClick={() => run(() => loadCasino(dia), sel, false)}>
                Mirar si ha jugado
              </button>
            </>
          ) : null}
        </div>
        <button type="button" className="gh-21link" onClick={() => (setSel(null), setMsg(''))}>
          Volver a las mesas para dos
        </button>
        <p className="gh-21__msg" role="status" aria-live="polite">
          {msg}
        </p>
      </>
    );
  }

  // ── Las mesas: invitaciones, partidas en curso y una nueva ──
  return (
    <>
      <div className="gh-21__felt is-lobby">
        <h4 className="gh-21__lobbytitle">Mesa para dos</h4>
        {recibidas.length + otras.length > 0 && (
          <ul className="gh-21__tables" aria-label="Tus mesas para dos">
            {recibidas.map((m) => (
              <li key={m.id} className="gh-21__table is-invite">
                <ReaderAvatar avatarId={m.amigo.avatar_id} alias={nombre(m)} size="list" decorative />
                <p>
                  <b>
                    {nombre(m)} te invita a una mesa{m.solo_garbanzos ? ' de garbanzos' : ''}
                  </b>
                  <span>{apuestaDe(m)}</span>
                </p>
                <div>
                  <button type="button" className="gh-21btn is-deal is-small" disabled={busy || (m.solo_garbanzos ? data.quedanGarbanzos : data.quedan) === 0 || m.fichas > data.fichas || m.garbanzos > data.garbanzos} onClick={() => aceptar(m)}>
                    Aceptar y repartir
                  </button>
                  <button type="button" className="gh-21link" disabled={busy} onClick={() => run(() => rechazarMesa(m.id), m.id)}>
                    No, gracias
                  </button>
                </div>
              </li>
            ))}
            {otras.map((m) => (
              <li key={m.id} className={`gh-21__table is-${m.estado}`}>
                <ReaderAvatar avatarId={m.amigo.avatar_id} alias={nombre(m)} size="list" decorative />
                <p>
                  <b>
                    Mesa{m.solo_garbanzos ? ' de garbanzos' : ''} con {nombre(m)}
                  </b>
                  <span>
                    {enQue(m)} · {apuestaDe(m)}
                  </span>
                </p>
                <div>
                  {m.estado === 'invitada' ? (
                    <button type="button" className="gh-21link" disabled={busy} onClick={() => run(() => rechazarMesa(m.id), m.id)}>
                      Retirar
                    </button>
                  ) : (
                    <button type="button" className="gh-21btn is-deal is-small" onClick={() => abrir(m)}>
                      {m.estado === 'jugando' && m.mia?.estado === 'jugando' ? 'Jugar mi mano' : 'Ver la mesa'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {data.amigos.length === 0 ? (
          <p className="gh-21__empty">Para jugar en pareja hace falta un amigo: alguien a quien sigues y que te sigue en la comunidad.</p>
        ) : libres.length === 0 ? (
          recibidas.length === 0 && <p className="gh-21__empty">{data.quedanGarbanzos === 0 ? 'Por hoy ya vale de mesas: mañana hay más.' : 'Ya tienes una mesa abierta con cada amigo: acabadla para empezar otra.'}</p>
        ) : (
          <div className="gh-21__new">
            <fieldset className="gh-21__who">
              <legend>Invitar a</legend>
              {libres.map((a) => (
                <button key={a.uid} type="button" className="gh-21friend" aria-pressed={amigo === a.uid} onClick={() => setAmigo(a.uid)}>
                  <ReaderAvatar avatarId={a.avatar_id} alias={a.alias} size="list" decorative />
                  <span>{a.alias}</span>
                </button>
              ))}
            </fieldset>
            {deGarbanzos ? (
              <p className="gh-21__empty">Mesa de garbanzos: no gasta manos ni da fichas. Hoy te quedan {data.quedanGarbanzos}.</p>
            ) : (
              <Cantidad label="Fichas en juego" opciones={FICHAS} value={apFichas} max={data.fichas} onChange={setApFichas} de={fichasDe} />
            )}
            <Cantidad label="Garbanzos en juego" opciones={deGarbanzos ? GARBANZOS.slice(1) : GARBANZOS} value={apGarbanzos} max={data.garbanzos} onChange={setApGarbanzos} de={garbanzosDe} />
            <button type="button" className="gh-21btn is-deal" disabled={busy || !elegido || faltaApuesta} onClick={invitar}>
              {!elegido ? 'Elige con quién jugar' : faltaApuesta ? 'Elige cuántos garbanzos' : `Invitar a ${elegido.alias}`}
            </button>
          </div>
        )}
      </div>
      <p className="gh-21__msg" role="status" aria-live="polite">
        {msg}
      </p>
    </>
  );
}
