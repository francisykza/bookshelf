// La sala de lectura del Gran Hotel (1.83, docs/qa/gran-hotel.md §9.5): la versión física del temporizador y de «leer en
// compañía». Te sientas en un sillón, empieza tu sesión y ves a quien lee a la vez, con su personaje y su compañero. El
// reloj es el de la app (useReadingTimer) y la presencia, la del salón (reading_presence), con la misma elección de qué
// compartir. Al acabar la sesión se apuntan las páginas con el formulario de la bandeja. Lo que solo pasa aquí: saludar a
// quien lee contigo, saber con quién has leído y, si terminas un libro, dejar su lomo en la librería común.
import { useEffect, useMemo, useRef, useState } from 'react';
import { SessionReport } from '../../../components/panels/PomodoroTray';
import { currentBook } from '../../../domain/books';
import { useLibrary } from '../../../state/useLibrary';
import { SeatChoice } from '../../social/components/SeatChoice';
import { seatParticipants, sessionMinutes } from '../../social/connections';
import { useCommunity } from '../../social/hooks/useCommunity';
import { sitDownNow, standUpNow, usePresence } from '../../social/hooks/usePresence';
import { fetchProfiles } from '../../social/services/community';
import { DEFAULT_AVATAR } from '../actor';
import { misticoOf, misticoSprite } from '../misticos';
import { renderActorThumb } from '../render';
import { dejarLomo, localAvatar, retirarLomo, salaLibreria, salaPersonajes, saludarEnSala, saludosEnSala } from '../service';
import { renderSala, SALA_H, SALA_W, SILLONES } from './salaArt';
import { SalaLibreria } from './SalaLibreria';

const mmss = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

const SALUDO_MS = 15000;
const SALUDO_VISIBLE_MS = 10000;
const lista = (nombres) => (nombres.length < 2 ? nombres.join('') : `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`);

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// Más pequeño que en el muelle: en la sala hay seis sillones y no debe tapar a quien lee
const PAL = 0.7;

/** El compañero de quien lee, vivo en el suelo junto a su sillón. Con movimiento reducido, quieto. */
function Companero({ id, pie }) {
  const host = useRef(null);
  useEffect(() => {
    const sprite = misticoSprite(id);
    const { canvas, ax, ay } = sprite;
    canvas.className = 'gh-lect__pal';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.left = `${((pie.x - ax * PAL) / SALA_W) * 100}%`;
    canvas.style.top = `${((pie.y - ay * PAL) / SALA_H) * 100}%`;
    canvas.style.width = `${((canvas.width * PAL) / SALA_W) * 100}%`;
    host.current.append(canvas);
    if (reducedMotion()) {
      sprite.paint(1.3);
      return () => canvas.remove();
    }
    let raf = 0;
    let last = 0;
    const t0 = performance.now();
    const tick = (now) => {
      if (now - last > 80) {
        last = now;
        sprite.paint((now - t0) / 1000);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      canvas.remove();
    };
  }, [id, pie.x, pie.y]);
  return <span ref={host} className="gh-lect__palhost" />;
}

/** La cara del personaje, para la lista de quien lee. */
function Cara({ avatar }) {
  const src = useMemo(() => renderActorThumb(avatar, { frame: 'head', size: 40 }).toDataURL(), [avatar]);
  return <img className="gh-lect__cara" src={src} alt="" draggable="false" />;
}

export function SalaLectura({ onStreet, timer, askPages = false, onPagesDone = () => {}, onOpenCalendar = () => {} }) {
  const { state } = useLibrary();
  const community = useCommunity({ autoload: true });
  const enabled = community.status === 'ready' && community.member;
  const { rows, me, failure } = usePresence({ enabled, userId: community.userId });
  const [profiles, setProfiles] = useState({});
  const [aspectos, setAspectos] = useState({});
  const [libreria, setLibreria] = useState(null);
  const [oferta, setOferta] = useState(null);
  const [saludados, setSaludados] = useState([]);
  const [saludo, setSaludo] = useState(null);
  const [leidoCon, setLeidoCon] = useState([]);
  const pidiendo = useRef(null);
  const [eligiendo, setEligiendo] = useState(false);
  const [busy, setBusy] = useState(false);
  const root = useRef(null);
  const book = currentBook(state.books, state.settings);
  const { seated, extra } = seatParticipants(rows, community.userId, SILLONES.length);
  const ids = seated.map((r) => r.user_id).join(',');
  const aspecto = (r) => aspectos[r.user_id]?.personaje ?? (r.user_id === community.userId ? localAvatar(r.user_id) : null) ?? DEFAULT_AVATAR;
  const room = renderSala(seated.map(aspecto));
  const enSesion = timer.running || timer.remaining < timer.total;

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
  useEffect(() => {
    if (!enabled || !ids) return undefined;
    let alive = true;
    fetchProfiles(ids.split(',')).then(
      (p) => alive && setProfiles((antes) => ({ ...antes, ...p })),
      () => {},
    );
    salaPersonajes(ids.split(',')).then(
      (a) => alive && setAspectos(a),
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [enabled, ids]);

  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    salaLibreria().then(
      (l) => alive && setLibreria(l),
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [enabled]);
  // Con quién has leído: quien ha estado en la sala mientras tú seguías sentado
  const sentado = Boolean(me);
  useEffect(() => {
    if (!sentado || !ids) return;
    const otros = ids.split(',').filter((id) => id !== community.userId);
    setLeidoCon((antes) => (otros.every((id) => antes.includes(id)) ? antes : [...new Set([...antes, ...otros])]));
  }, [sentado, ids, community.userId]);
  // Quien te saluda: se mira solo mientras estás sentado y la migración está aplicada
  const conSaludos = sentado && Boolean(libreria);
  useEffect(() => {
    if (!conSaludos) return undefined;
    let alive = true;
    const mirar = () =>
      saludosEnSala().then(
        (de) => alive && de?.length > 0 && setSaludo(de[0]),
        () => {},
      );
    mirar();
    const cada = setInterval(mirar, SALUDO_MS);
    return () => {
      alive = false;
      clearInterval(cada);
    };
  }, [conSaludos]);
  useEffect(() => {
    if (!saludo) return undefined;
    const fuera = setTimeout(() => setSaludo(null), SALUDO_VISIBLE_MS);
    return () => clearTimeout(fuera);
  }, [saludo]);
  useEffect(() => {
    if (askPages) pidiendo.current ??= new Date().toISOString();
  }, [askPages]);

  const sentarse = async (choice) => {
    setBusy(true);
    setLeidoCon([]);
    const ok = await sitDownNow(choice);
    setBusy(false);
    if (!ok) return;
    setEligiendo(false);
    if (!timer.running) timer.start();
  };
  const levantarse = async () => {
    setBusy(true);
    if (timer.running) timer.pause();
    if (me) await standUpNow(community.userId);
    setBusy(false);
  };
  // Si acabas de terminar un libro, antes de levantarte puedes dejar su lomo: en el servidor se deja sentado
  const apuntado = () => {
    const desde = pidiendo.current;
    pidiendo.current = null;
    const terminado = desde && state.books.find((b) => b.status === 'read' && b.finishedAt >= desde);
    onPagesDone();
    if (terminado && me && libreria) setOferta(terminado.title);
    else if (me) standUpNow(community.userId);
  };
  const cerrarOferta = (lomo) => {
    setOferta(null);
    const fin = () => me && standUpNow(community.userId);
    if (!lomo) return fin();
    setBusy(true);
    return dejarLomo(lomo)
      .then(setLibreria, () => {})
      .finally(() => {
        setBusy(false);
        fin();
      });
  };
  const retirar = (id) => retirarLomo(id).then(setLibreria, () => {});
  const saludar = (id) => {
    setSaludados((antes) => [...antes, id]);
    saludarEnSala(id).catch(() => {});
  };

  const nombre = (r) => (r.user_id === community.userId ? 'Tú' : (profiles[r.user_id]?.alias ?? 'Alguien'));
  const otros = seated.length - (me ? 1 : 0) + extra;
  const hola = seated.findIndex((r) => r.user_id === saludo);
  const compania = leidoCon.length > 0 && (askPages || oferta) ? <p className="gh-lect__con">Has leído con {lista(leidoCon.map((id) => profiles[id]?.alias ?? 'alguien'))}.</p> : null;
  return (
    <section className="gh-casino gh-lect" ref={root} aria-labelledby="gh-lect-title" data-escape-local="open">
      <h3 className="px-sr" id="gh-lect-title">
        La sala de lectura
      </h3>
      <div className="gh-casino__scene" style={{ aspectRatio: `${SALA_W} / ${SALA_H}` }}>
        <img
          className="gh-casino__art"
          src={room.scene}
          alt={`La sala de lectura, de noche: parqué en espiga, librerías de nogal hasta el techo, una ventana al puerto, una alfombra azul y seis sillones de cuero con su lámpara. ${seated.length === 1 ? 'Hay una persona leyendo' : seated.length ? `Hay ${seated.length} personas leyendo` : 'Están vacíos'}.`}
          draggable="false"
        />
        {seated.map((r, k) => {
          const id = aspectos[r.user_id]?.companero;
          return misticoOf(id)?.legendario ? <Companero key={r.user_id} id={id} pie={room.pies[k]} /> : null;
        })}
        {hola >= 0 && (
          <span className="gh-lect__hola" aria-hidden="true" style={{ left: `${(room.cabezas[hola].x / SALA_W) * 100}%`, top: `${(room.cabezas[hola].y / SALA_H) * 100}%` }}>
            ¡Hola!
          </span>
        )}
      </div>

      <div className="gh-21 gh-lect__panel">
        {askPages ? (
          <div className="gh-lect__paper">
            {compania}
            <SessionReport book={book} onDone={apuntado} onOpenCalendar={onOpenCalendar} />
          </div>
        ) : oferta ? (
          <div className="gh-lect__paper">
            {compania}
            <p className="gh-lect__con">
              Has terminado <em>{oferta}</em>. ¿Dejas su lomo en la librería de la sala? Lo verá todo el hotel, con tu nombre.
            </p>
            <div className="gh-21__acts">
              <button type="button" className="gh-21btn is-deal" disabled={busy} onClick={() => cerrarOferta(oferta)}>
                Dejar el lomo
              </button>
            </div>
            <button type="button" className="gh-21link" disabled={busy} onClick={() => cerrarOferta(null)}>
              Ahora no
            </button>
          </div>
        ) : (
          <>
            <div className="gh-lect__clock">
              <p>{timer.phase === 'focus' ? 'Sesión de lectura' : 'Descanso'}</p>
              <strong aria-live="off">{mmss(timer.remaining)}</strong>
              {book && timer.phase === 'focus' && (
                <p>
                  con <em>{book.title}</em>
                </p>
              )}
            </div>
            {eligiendo ? (
              <div className="gh-lect__paper">
                <SeatChoice onSit={sentarse} busy={busy} titleId="gh-lect-elige" />
                <button type="button" className="gh-21link" onClick={() => setEligiendo(false)}>
                  Ahora no
                </button>
              </div>
            ) : (
              <div className="gh-21__acts">
                {timer.running ? (
                  <button type="button" className="gh-21btn is-stand" onClick={timer.pause}>
                    Pausar
                  </button>
                ) : enSesion ? (
                  <button type="button" className="gh-21btn is-deal" onClick={timer.start}>
                    Seguir leyendo
                  </button>
                ) : enabled && !me ? (
                  <button type="button" className="gh-21btn is-deal" onClick={() => setEligiendo(true)}>
                    Sentarte a leer
                  </button>
                ) : (
                  <button type="button" className="gh-21btn is-deal" onClick={timer.start}>
                    Empezar a leer
                  </button>
                )}
                {enabled && !me && enSesion && (
                  <button type="button" className="gh-21btn is-stand" onClick={() => setEligiendo(true)}>
                    Sentarte
                  </button>
                )}
                {me && (
                  <button type="button" className="gh-21btn is-stand" disabled={busy} onClick={levantarse}>
                    Levantarte
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {enabled ? (
          <>
            <h4 className="gh-21__lobbytitle">{otros > 0 ? 'Leyendo ahora' : 'Aún no lee nadie más'}</h4>
            {seated.length > 0 && (
              <ul className="gh-lect__list" aria-label="Quién lee ahora">
                {seated.map((r) => (
                  <li key={r.user_id}>
                    <Cara avatar={aspecto(r)} />
                    <p>
                      <b>{nombre(r)}</b>
                      <span>
                        {r.share_book && r.book_title ? `«${r.book_title}» · ` : ''}
                        {sessionMinutes(r.started_at)}
                      </span>
                    </p>
                    {conSaludos && r.user_id !== community.userId && (
                      <button type="button" className="gh-21link gh-lect__saluda" disabled={saludados.includes(r.user_id)} aria-label={`Saludar a ${nombre(r)}`} onClick={() => saludar(r.user_id)}>
                        {saludados.includes(r.user_id) ? 'Saludado' : r.user_id === saludo ? 'Devolver' : 'Saludar'}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {extra > 0 && <p className="gh-21__empty">Y {extra} más, en los sillones del fondo.</p>}
            {hola >= 0 && (
              <p className="gh-21__note" role="status">
                {profiles[saludo]?.alias ?? 'Alguien'} levanta la vista y te saluda.
              </p>
            )}
            {libreria && <SalaLibreria libreria={libreria} onRetirar={retirar} />}
          </>
        ) : (
          <p className="gh-21__note">Puedes leer aquí igual. Para ver a quien lee a la vez, activa la comunidad en tu perfil.</p>
        )}
        {failure && (
          <p className="gh-21__msg" role="status">
            No se ha podido: {failure}
          </p>
        )}
      </div>
    </section>
  );
}
