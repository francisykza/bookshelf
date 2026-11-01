// «El edificio del puerto» (1.63, SPEC §63), abierto desde la tablet del Salón Social. El portal enseña las seis
// puertas de tu edificio (el servidor te reparte al azar la primera vez), tu buzón con los sellos de tus vecinos, tu
// piso (se decora y se guarda solo) y el de cada vecino (solo se mira, y se le puede dejar un sello). Hace falta la
// comunidad activada. Se carga bajo demanda: nada de esto pesa en la habitación.
import { ArrowLeft, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ReaderAvatar } from '../../components/avatars/ReaderAvatar';
import { PanelShell } from '../../components/panels/PanelShell';
import { useCommunity } from '../social/hooks/useCommunity';
import { SELLOS } from './catalog';
import { starterRoom } from './demo';
import './edificio.css';
import { mountPiso } from './piso';
import { ART_H, ART_W, createRoomRenderer } from './render';
import { doorLabel, doorsOf, loadEdificio, savePiso, setSello } from './service';

const SAVE_MS = 900;
const selloText = (id) => SELLOS.find((s) => s.id === id)?.texto ?? '';

/** Miniaturas de los pisos, de tarde, con un solo dibujante para todas. */
function useThumbs(vecinos, enabled) {
  return useMemo(() => {
    if (!enabled || !vecinos) return {};
    const renderer = createRoomRenderer();
    const canvas = document.createElement('canvas');
    canvas.width = ART_W;
    canvas.height = ART_H;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(ART_W, ART_H);
    const out = {};
    for (const v of vecinos) {
      if (!v.room) continue;
      renderer.bake(v.room);
      renderer.draw(ctx, image, { evening: true });
      out[v.user_id] = canvas.toDataURL();
    }
    return out;
  }, [vecinos, enabled]);
}

/** El piso montado en un contenedor (lo dibuja el motor de píxeles, fuera de React). */
function PisoView({ room, editable, label, soundOn, onChange }) {
  const ref = useRef(null);
  const api = useRef(null);
  const changed = useRef(onChange);
  useEffect(() => {
    changed.current = onChange;
  }, [onChange]);
  useEffect(() => {
    const piso = mountPiso(ref.current, { room, editable, label, muted: !soundOn, onChange: (r) => changed.current?.(r) });
    api.current = piso;
    return () => piso.destroy();
    // El piso se monta una vez: los cambios los lleva él (y avisa con onChange)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label, editable]);
  useEffect(() => {
    api.current?.setMuted(!soundOn);
  }, [soundOn]);
  return <div ref={ref} className="ed-piso" />;
}

export function EdificioPanel({ pisoId = null, soundOn = false, onOpenPiso, onClose, onOpenProfile }) {
  const community = useCommunity({ autoload: true });
  const ready = community.status === 'ready' && community.member;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState('');
  const [selloMsg, setSelloMsg] = useState('');
  const pending = useRef(null);
  const timer = useRef(0);

  useEffect(() => {
    if (!ready) return undefined;
    let alive = true;
    loadEdificio()
      .then((d) => {
        if (!alive) return;
        // La primera vez, tu piso empieza con unos pocos muebles (y se guarda ya)
        const me = d.vecinos.find((v) => v.yo);
        if (me && !me.room) {
          me.room = starterRoom();
          savePiso(community.userId, me.room).catch(() => {});
        }
        setData(d);
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [ready, community.userId, attempt]);

  // Al salir con un guardado pendiente, se guarda ya
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      if (pending.current) savePiso(pending.current.userId, pending.current.room).catch(() => {});
    },
    [],
  );

  const thumbs = useThumbs(data?.vecinos, !pisoId);
  const open = pisoId ? (data?.vecinos.find((v) => v.user_id === pisoId) ?? null) : null;
  const mine = open?.yo;

  const onMyChange = (room) => {
    setData((d) => d && { ...d, vecinos: d.vecinos.map((v) => (v.yo ? { ...v, room } : v)) });
    pending.current = { userId: community.userId, room };
    setSaving('Guardando…');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const job = pending.current;
      pending.current = null;
      savePiso(job.userId, job.room)
        .then(() => setSaving('Guardado.'))
        .catch((e) => setSaving(`No se ha podido guardar: ${e.message}`));
    }, SAVE_MS);
  };

  const leaveSello = async (vecino, sello) => {
    const next = vecino.sello_dado === sello ? null : sello;
    try {
      await setSello(community.userId, vecino.user_id, next);
      setData((d) => d && { ...d, vecinos: d.vecinos.map((v) => (v.user_id === vecino.user_id ? { ...v, sello_dado: next } : v)) });
      setSelloMsg(next ? `Has dejado «${selloText(next)}» en el buzón de ${vecino.alias}.` : `Has quitado tu sello del buzón de ${vecino.alias}.`);
    } catch (e) {
      setSelloMsg(`No se ha podido dejar el sello: ${e.message}`);
    }
  };

  let body;
  if (community.status === 'signed-out' || community.status === 'off') {
    body = <p className="ed-note">Inicia sesión en «Tu cuenta» para tener un piso en el edificio.</p>;
  } else if (community.status === 'unavailable' || community.status === 'error') {
    body = <p className="ed-note">{community.error || 'La comunidad no está disponible ahora mismo.'}</p>;
  } else if (community.status !== 'ready') {
    body = <p className="ed-note">Abriendo el portal…</p>;
  } else if (!community.member) {
    body = (
      <div className="ed-note">
        <p>El edificio es para quien tiene la comunidad activada: tus vecinos verán tu piso y tu alias.</p>
        <button type="button" className="ed-btn ed-btn--primary" onClick={onOpenProfile}>
          Activar la comunidad en mi perfil
        </button>
      </div>
    );
  } else if (error) {
    body = (
      <div className="ed-note" role="alert">
        <p>{error}</p>
        <button type="button" className="ed-btn" onClick={() => (setError(''), setAttempt((n) => n + 1))}>
          Reintentar
        </button>
      </div>
    );
  } else if (!data) {
    body = <p className="ed-note">Buscando tu puerta…</p>;
  } else if (pisoId && !open) {
    body = <p className="ed-note">Este piso ya no está en tu edificio.</p>;
  } else if (open) {
    const label = mine ? `Tu piso, ${doorLabel(open.puerta)}` : `Piso de ${open.alias}, ${doorLabel(open.puerta)}`;
    body = (
      <>
        <div className="ed-head">
          <ReaderAvatar avatarId={open.avatar_id} alias={open.alias ?? ''} size="list" decorative />
          <div>
            <h2 className="ed-title" id="ed-title">
              {mine ? 'Tu piso' : `Piso de ${open.alias}`} · {doorLabel(open.puerta)}
            </h2>
            <p className="ed-sub">{mine ? 'Tus vecinos lo ven como lo dejes.' : 'Puedes mirar, pero no tocar nada.'}</p>
          </div>
        </div>
        {open.room ? <PisoView key={open.user_id} room={open.room} editable={mine} label={label} soundOn={soundOn} onChange={mine ? onMyChange : null} /> : <p className="ed-note">Aún no ha decorado su piso.</p>}
        {mine && (
          <p className="ed-saving" role="status" aria-live="polite">
            {saving}
          </p>
        )}
        {!mine && (
          <section className="ed-sellos" aria-labelledby="ed-sellos-title">
            <h3 id="ed-sellos-title">Dejar un sello en su buzón</h3>
            <div className="ed-sellos__row" role="group" aria-labelledby="ed-sellos-title">
              {SELLOS.map((s) => (
                <button key={s.id} type="button" className="ed-sello" aria-pressed={open.sello_dado === s.id} onClick={() => leaveSello(open, s.id)}>
                  {s.texto}
                </button>
              ))}
            </div>
            <p className="ed-sellos__msg" role="status" aria-live="polite">
              {selloMsg || (open.sello_dado ? `Ya le dejaste «${selloText(open.sello_dado)}». Tócalo otra vez para quitarlo.` : '')}
            </p>
          </section>
        )}
      </>
    );
  } else {
    const inbox = data.vecinos.filter((v) => !v.yo && v.sello_recibido);
    body = (
      <>
        <h2 className="ed-title" id="ed-title">
          El edificio del puerto
        </h2>
        <p className="ed-sub">Tu puerta: {doorLabel(data.puerta)}. Toca una puerta para entrar.</p>
        <ul className="ed-doors">
          {doorsOf(data.vecinos).map(({ puerta, vecino }) => (
            <li key={puerta}>
              {vecino ? (
                <button type="button" className={`ed-door${vecino.yo ? ' ed-door--mine' : ''}`} onClick={() => onOpenPiso(vecino.user_id)} aria-label={vecino.yo ? `Entrar en tu piso, ${doorLabel(puerta)}` : `Llamar y entrar en el piso de ${vecino.alias}, ${doorLabel(puerta)}`}>
                  {thumbs[vecino.user_id] ? <img src={thumbs[vecino.user_id]} alt="" width={ART_W} height={ART_H} /> : <span className="ed-door__empty">Sin decorar</span>}
                  <span className="ed-door__label">
                    <strong>{doorLabel(puerta)}</strong>
                    <span>{vecino.yo ? 'Tu piso' : vecino.alias}</span>
                  </span>
                </button>
              ) : (
                <div className="ed-door ed-door--free">
                  <span className="ed-door__empty">Puerta libre</span>
                  <span className="ed-door__label">
                    <strong>{doorLabel(puerta)}</strong>
                    <span>Llegará alguien</span>
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
        <section className="ed-inbox" aria-labelledby="ed-inbox-title">
          <h3 id="ed-inbox-title">Tu buzón</h3>
          {inbox.length ? (
            <ul>
              {inbox.map((v) => (
                <li key={v.user_id}>
                  {v.alias} ({doorLabel(v.puerta)}) te dejó «{selloText(v.sello_recibido)}».
                </li>
              ))}
            </ul>
          ) : (
            <p>Todavía no tienes sellos. Cuando un vecino visite tu piso, podrá dejarte uno.</p>
          )}
        </section>
      </>
    );
  }

  return (
    <PanelShell onClose={onClose} label={pisoId && open ? (mine ? 'Tu piso' : `Piso de ${open.alias}`) : 'El edificio del puerto'} variant="edificio">
      <div className="ed-bar">
        {pisoId ? (
          <button type="button" className="ed-bar__back" onClick={onClose}>
            <ArrowLeft aria-hidden="true" />
            Volver al portal
          </button>
        ) : (
          <button type="button" className="ed-bar__close" onClick={onClose} aria-label="Cerrar el edificio">
            <X aria-hidden="true" />
          </button>
        )}
      </div>
      {body}
    </PanelShell>
  );
}
