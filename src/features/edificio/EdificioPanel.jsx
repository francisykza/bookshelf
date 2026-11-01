// «El edificio del puerto» (1.63, SPEC §63), abierto desde la tablet del Salón Social. El portal enseña las seis
// puertas de tu edificio (el servidor te reparte al azar la primera vez), tu buzón con los sellos de tus vecinos, tu
// piso (se decora y se guarda solo) y el de cada vecino (solo se mira, y se le puede dejar un sello). Hace falta la
// comunidad activada. Se carga bajo demanda: nada de esto pesa en la habitación.
import { ArrowLeft, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ReaderAvatar } from '../../components/avatars/ReaderAvatar';
import { PanelShell } from '../../components/panels/PanelShell';
import { useCommunity } from '../social/hooks/useCommunity';
import { SELLOS } from './catalog';
import { starterRoom } from './demo';
import './edificio.css';
import { mountFacade } from './facadeView';
import { START_PICKS } from './inventory';
import { mountPiso } from './piso';
import { installPixelVars, pixelIconSrc } from './pixelUi';
import { doorLabel, elegirInicio, loadEdificio, loadInventario, savePiso, setSello } from './service';
import { StarterPicker } from './StarterPicker';

const SAVE_MS = 900;
// Cómo se ve un piso: «dentro» de la habitación (a pantalla completa, con la balda o los sellos abajo; por defecto) o
// como ficha (el dibujo arriba y lo demás debajo). Es una preferencia de este dispositivo.
const VIEW_KEY = 'bookshelf:edificio:vista';
const readView = () => {
  try {
    return localStorage.getItem(VIEW_KEY) === 'ficha' ? 'ficha' : 'dentro';
  } catch {
    return 'dentro';
  }
};
const saveView = (v) => {
  try {
    localStorage.setItem(VIEW_KEY, v);
  } catch {
    // Sin almacenamiento, la vista vale solo mientras está abierto
  }
};
const selloText = (id) => SELLOS.find((s) => s.id === id)?.texto ?? '';

/** La fachada del edificio (la dibuja facade.js fuera de React); cada ventana ocupada es un botón. */
function Facade({ vecinos, onOpenPiso }) {
  const ref = useRef(null);
  const open = useRef(onOpenPiso);
  useEffect(() => {
    open.current = onOpenPiso;
  }, [onOpenPiso]);
  useEffect(() => {
    const view = mountFacade(ref.current, {
      flats: vecinos.map((v) => ({
        puerta: v.puerta,
        room: v.room,
        mine: v.yo,
        name: v.yo ? 'Tu piso' : v.alias,
        label: v.yo ? `Entrar en tu piso, ${doorLabel(v.puerta)}` : `Llamar y entrar en el piso de ${v.alias}, ${doorLabel(v.puerta)}`,
        onOpen: () => open.current(v.user_id),
      })),
    });
    return () => view.destroy();
  }, [vecinos]);
  return <div ref={ref} className="ed-facade-mount" />;
}

/** El piso montado en un contenedor (lo dibuja el motor de píxeles, fuera de React). */
function PisoView({ room, editable, label, soundOn, inside, inventory, onChange }) {
  const ref = useRef(null);
  const api = useRef(null);
  const changed = useRef(onChange);
  useEffect(() => {
    changed.current = onChange;
  }, [onChange]);
  useEffect(() => {
    // En la vista «dentro», tu piso se abre ya decorando, con la balda abajo
    const piso = mountPiso(ref.current, { room, editable, label, inside, inventory, decorate: inside && editable, muted: !soundOn, onChange: (r) => changed.current?.(r) });
    api.current = piso;
    return () => piso.destroy();
    // El piso se monta una vez: los cambios los lleva él (y avisa con onChange)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label, editable]);
  useEffect(() => {
    api.current?.setMuted(!soundOn);
  }, [soundOn]);
  useEffect(() => {
    api.current?.setInside(inside);
  }, [inside]);
  // El inventario llega después del piso (y cambia al elegir los muebles de inicio)
  useEffect(() => {
    api.current?.setInventory(inventory);
  }, [inventory]);
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
  const [view, setView] = useState(readView);
  // Mis copias de cada mueble (1.66, §66); null: sin la migración del inventario, todo libre como antes
  const [inventory, setInventory] = useState(null);
  const [choosing, setChoosing] = useState(false);
  const inside = view === 'dentro';
  const pending = useRef(null);
  const timer = useRef(0);

  // Marcos de píxel para los sellos y el buzón (los mismos que los controles del piso)
  useEffect(() => installPixelVars(), []);

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
        // Si no llega, la balda ofrece todo y el servidor sigue siendo quien decide al guardar
        return loadInventario().then((inv) => alive && setInventory(inv), () => {});
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

  const pickStart = async (ids) => {
    const inv = await elegirInicio(ids);
    setInventory(inv);
    setChoosing(false);
  };
  const startPending = Boolean(mine && inventory && !inventory.inicioElegido);

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
  } else if (open && mine && choosing) {
    body = <StarterPicker onPick={pickStart} onLater={() => setChoosing(false)} />;
  } else if (open) {
    const label = mine ? `Tu piso, ${doorLabel(open.puerta)}` : `Piso de ${open.alias}, ${doorLabel(open.puerta)}`;
    body = (
      <div className={inside ? 'ed-room ed-inside' : 'ed-room'}>
        <div className="ed-head">
          <ReaderAvatar avatarId={open.avatar_id} alias={open.alias ?? ''} size="list" decorative />
          <div>
            <h2 className="ed-title" id="ed-title">
              {mine ? 'Tu piso' : `Piso de ${open.alias}`} · {doorLabel(open.puerta)}
            </h2>
            <p className="ed-sub">{mine ? 'Tus vecinos lo ven como lo dejes.' : 'Puedes mirar, pero no tocar nada.'}</p>
          </div>
        </div>
        {open.room ? <PisoView key={open.user_id} room={open.room} editable={mine} label={label} soundOn={soundOn} inside={inside} inventory={mine ? inventory : null} onChange={mine ? onMyChange : null} /> : <p className="ed-note">Aún no ha decorado su piso.</p>}
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
      </div>
    );
  } else {
    const inbox = data.vecinos.filter((v) => !v.yo && v.sello_recibido);
    // El portal (1.65): el cielo del dibujo sigue detrás del título y el edificio llega de borde a borde
    body = (
      <div className="ed-portal">
        <h2 className="ed-title" id="ed-title">
          El edificio del puerto
        </h2>
        <p className="ed-sub">Tu puerta: {doorLabel(data.puerta)}. Toca una puerta para entrar.</p>
        <Facade vecinos={data.vecinos} onOpenPiso={onOpenPiso} />
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
      </div>
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
        {startPending && !choosing && (
          <button type="button" className="px-btn ed-bar__start" onClick={() => setChoosing(true)}>
            Elige tus {START_PICKS} muebles
          </button>
        )}
        {pisoId && open && !choosing && (
          <button
            type="button"
            className="px-btn px-btn--icon ed-bar__view"
            title={inside ? 'Ver como ficha' : 'Entrar en la habitación'}
            onClick={() => {
              const next = inside ? 'ficha' : 'dentro';
              saveView(next);
              setView(next);
            }}
          >
            <img className="px-icon" src={pixelIconSrc(inside ? 'ficha' : 'dentro')} alt="" width={33} height={33} />
            <span className="px-sr">{inside ? 'Ver como ficha' : 'Entrar en la habitación'}</span>
          </button>
        )}
      </div>
      {body}
    </PanelShell>
  );
}
