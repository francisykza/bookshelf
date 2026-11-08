// «El edificio del puerto» (1.63, SPEC §63), abierto desde la tablet del Salón Social. El portal enseña las seis
// puertas de tu edificio (el servidor te reparte al azar la primera vez), tu buzón con lo que te dejan tus vecinos, tu
// piso (se decora y se guarda solo) y el de cada vecino (se mira, se firma su libro y se le regala). Hace falta la
// comunidad activada. Se carga bajo demanda: nada de esto pesa en la habitación.
import { ArrowLeft, X } from 'lucide-react';
import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { ReaderAvatar } from '../../components/avatars/ReaderAvatar';
import { PanelShell } from '../../components/panels/PanelShell';
import { dayKey } from '../../domain/dates';
import { useCommunity } from '../social/hooks/useCommunity';
import { FIRMAS, catalogItem } from './catalog';
import { adoptMyPiso, rememberMyPiso, saveMyPiso } from './myPiso';
import './edificio.css';
import { mountFacade } from './facadeView';
import { START_PICKS } from './inventory';
import { setEdificioMusic, setEdificioMusicInside } from './music';
import { mountPiso } from './piso';
import { installPixelVars, pixelIconSrc } from './pixelUi';
import { PRENDAS, prendaNombre } from './actor';
import { missionsOf, todayKey } from './dailyMissions';
import { contarDiaria, doorLabel, elegirInicio, escucharMesas, firmar, loadArmario, loadCasino, loadEdificio, loadInventario, loadSocial, localAvatar, meGusta, regalar, saveCompanero, savePersonaje } from './service';
import { VecinoMesa } from './VecinoMesa';
import { GranHotel } from './hotel/GranHotel';
import { mesasQueEsperan } from './hotel/veintiuna';
import { StarterPicker } from './StarterPicker';
import { Tienda } from './Tienda';
// La visita en primera persona trae Three.js: solo se descarga si se entra
const VisitaPiso = lazy(() => import('../pisoLab/VisitaPiso'));

/** La tienda del bajo se abre como un «piso» más del portal (1.67, §67). */
const TIENDA_ID = 'tienda';
/** El Gran Hotel, adonde lleva la limusina (1.74, §74), también se abre como un «piso» más (Atrás vuelve al portal). */
const HOTEL_ID = 'hotel';

const SAVE_MS = 900;
// Cada cuánto se mira si te espera una mesa para dos del casino, estés donde estés del edificio (1.81)
const AVISO_MS = 20000;
const fechaCorta = (dia) => dia.split('-').reverse().slice(0, 2).join('/');
const nombreMesa = (m) => m.amigo?.alias ?? 'Tu amigo';
const avisoMesa = (m) => (m.estado === 'invitada' ? `${nombreMesa(m)} te invita a la mesa para dos del casino.` : `Te toca en la mesa para dos con ${nombreMesa(m)}.`);
// Cómo se ve un piso: «dentro» de la habitación (a pantalla completa, con la balda o la mesa del vecino abajo; por defecto) o
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
const firmaText = (id) => FIRMAS.find((x) => x.id === id)?.texto ?? '';
// Lo del buzón que ya has leído (1.78): la carta y su número solo cuentan lo nuevo; se guarda por usuario en este aparato
const readKey = (uid) => `bookshelf:edificio:correo-leido:${uid}`;
const readMail = (uid) => {
  try {
    return new Set(JSON.parse(localStorage.getItem(readKey(uid)) ?? '[]'));
  } catch {
    return new Set();
  }
};
const markMail = (uid, lines) => {
  try {
    localStorage.setItem(readKey(uid), JSON.stringify(lines.slice(0, 40)));
  } catch {
    // Sin almacenamiento, lo leído vale mientras la fachada está abierta
  }
};

/** La fachada del edificio (la dibuja facade.js fuera de React); cada ventana ocupada es un botón. */
function Facade({ vecinos, onOpenPiso, shopBadge, mail = null, userId = '' }) {
  const ref = useRef(null);
  const open = useRef(onOpenPiso);
  useEffect(() => {
    open.current = onOpenPiso;
  }, [onOpenPiso]);
  useEffect(() => {
    const me = vecinos.find((v) => v.yo);
    const view = mountFacade(ref.current, {
      flats: vecinos.map((v) => ({
        puerta: v.puerta,
        room: v.room,
        mine: v.yo,
        name: v.yo ? 'Tu piso' : v.alias,
        label: v.yo ? `Entrar en tu piso, ${doorLabel(v.puerta)}` : `Llamar y entrar en el piso de ${v.alias}, ${doorLabel(v.puerta)}`,
        onOpen: () => open.current(v.user_id),
      })),
      // Sin la migración de la tienda (o sin inventario aún), el escaparate es solo dibujo
      onOpenShop: shopBadge == null ? null : () => open.current(TIENDA_ID),
      shopBadge: shopBadge ?? '',
      mail: mail && { lines: mail, read: readMail(userId), onRead: (lines) => markMail(userId, lines) },
      onOpenLimo: () => open.current(HOTEL_ID),
      // Tu personaje (y el legendario que te sigue), que van andando hasta la tienda o la limusina (1.78)
      walker: me ? { avatar: me.personaje ?? localAvatar(userId), companion: me.companero ?? null } : null,
    });
    return () => view.destroy();
    // El correo llega como lista nueva en cada render: se compara por su texto
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vecinos, shopBadge, mail?.join('|'), userId]);
  return <div ref={ref} className="ed-facade-mount" />;
}

/** El piso montado en un contenedor (lo dibuja el motor de píxeles, fuera de React). */
function PisoView({ room, editable, label, soundOn, inside, decorate = false, inventory, avatar, companion = null, prendas = null, missions = null, notice = null, likes = null, placeId = null, placeAcabado = null, onPlaced = null, onChange, onAvatarChange, onCompanionChange = null, onEvent, onLike, onDressing = null, closeDressing = 0 }) {
  const ref = useRef(null);
  const api = useRef(null);
  const changed = useRef(onChange);
  const avatarChanged = useRef(onAvatarChange);
  const evented = useRef(onEvent);
  const likedRef = useRef(onLike);
  const palChanged = useRef(onCompanionChange);
  const dressed = useRef(onDressing);
  useEffect(() => {
    dressed.current = onDressing;
    palChanged.current = onCompanionChange;
    changed.current = onChange;
    avatarChanged.current = onAvatarChange;
    evented.current = onEvent;
    likedRef.current = onLike;
  }, [onChange, onAvatarChange, onCompanionChange, onEvent, onLike, onDressing]);
  useEffect(() => {
    // Tu piso se abre sin decorar (1.78: la habitación es la protagonista; la balda sale con «Decorar»). Si vienes de
    // la tienda a poner un mueble (placeId) o de elegir tu mudanza (`decorate`), se abre decorando
    const piso = mountPiso(ref.current, { room, editable, label, inside, decorate: editable && decorate, inventory, muted: !soundOn, avatar, companion, prendas, missions, onCompanionChange: (id) => palChanged.current?.(id), onDressing: (on) => dressed.current?.(on), onChange: (r) => changed.current?.(r), onAvatarChange: (a) => avatarChanged.current?.(a), onEvent: (t) => evented.current?.(t), likes, onLike: onLike ? (uid, si) => likedRef.current?.(uid, si) : null, placeId, placeAcabado });
    api.current = piso;
    // El mueble que venía de la tienda ya está puesto: no se vuelve a poner si el piso se monta otra vez
    if (placeId) onPlaced?.();
    // Solo en desarrollo: las pruebas buscan los muebles en el dibujo (screenOfItem) y miran al personaje
    if (import.meta.env.DEV) window.__edificioPiso = piso;
    return () => {
      piso.destroy();
      dressed.current?.(false);
    };
    // El piso se monta una vez: los cambios los lleva él (y avisa con onChange)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label, editable]);
  useEffect(() => {
    api.current?.setMuted(!soundOn);
  }, [soundOn]);
  // «← Al piso» de la barra con el armario abierto: se cierra sin guardar (1.77)
  useEffect(() => {
    if (closeDressing) api.current?.closeWardrobe(false);
  }, [closeDressing]);
  useEffect(() => {
    api.current?.setInside(inside);
  }, [inside]);
  // El inventario llega después del piso (y cambia al elegir los muebles de inicio)
  useEffect(() => {
    api.current?.setInventory(inventory);
  }, [inventory]);
  // El armario y las misiones del día llegan del servidor (y cambian al hacer una)
  useEffect(() => {
    api.current?.setPrendas(prendas);
  }, [prendas]);
  useEffect(() => {
    api.current?.setMissions(missions);
  }, [missions]);
  useEffect(() => {
    api.current?.setLikes(likes);
  }, [likes]);
  // El místico que te acompaña (o al vecino)
  useEffect(() => {
    api.current?.setCompanion(companion);
  }, [companion]);
  useEffect(() => {
    if (notice) api.current?.notify(notice.text);
  }, [notice]);
  return <div ref={ref} className="ed-piso" />;
}

export function EdificioPanel({ pisoId = null, soundOn = false, onOpenPiso, onClose, onOpenProfile, onOpenMissions = null, timer: reloj = null, askPages = false, onPagesDone, onOpenCalendar }) {
  const community = useCommunity({ autoload: true });
  // La melodía «Dos balcones» mientras estás en el edificio (1.73), si el sonido de la app está activado
  useEffect(() => {
    setEdificioMusic(soundOn);
    return () => setEdificioMusic(false);
  }, [soundOn]);
  const ready = community.status === 'ready' && community.member;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState('');
  const [view, setView] = useState(readView);
  // Mis copias de cada mueble (1.66, §66); null: sin la migración del inventario, todo libre como antes
  const [inventory, setInventory] = useState(null);
  const [choosing, setChoosing] = useState(false);
  // En la tienda, con un sobre abierto, el «Volver» de la barra vuelve a la tienda (1.68)
  const [revealing, setRevealing] = useState(false);
  const [closeReveal, setCloseReveal] = useState(0);
  // El mueble elegido en un sobre para colocarlo (1.76): el piso se abre con él listo para arrastrar
  const [toPlace, setToPlace] = useState(null);
  const [toPlaceAcabado, setToPlaceAcabado] = useState(null);
  // Dentro del hotel, la sala en la que estás (1.75): null es la fachada; el «Volver» de la barra sale a la calle
  const [hotelRoom, setHotelRoom] = useState(null);
  const [hotelDir, setHotelDir] = useState(false);
  // El armario de tu piso abierto (1.77): la barra dice «← Al piso» y «Armario»
  const [dressing, setDressing] = useState(false);
  // De quién es el piso que se está visitando en primera persona (null: la vista isométrica de siempre)
  const [visita3d, setVisita3d] = useState(null);
  const [closeDressing, setCloseDressing] = useState(0);
  const [wasHotel, setWasHotel] = useState(false);
  const inside = view === 'dentro';
  const pending = useRef(null);
  // Armario del personaje y misiones del día (1.70): undefined mientras llega; null sin la migración
  const [armario, setArmario] = useState(undefined);
  const [notice, setNotice] = useState(null);
  const counting = useRef(new Set());
  const [won, setWon] = useState(null);
  const [wonTickets, setWonTickets] = useState(0);
  // Vecinos (1.71): libro de visitas, «me gusta» y regalos de cada piso abierto; null sin la migración
  const [socialOf, setSocialOf] = useState({});
  const [day] = useState(todayKey);
  const timer = useRef(0);
  const avatarTimer = useRef(0);
  const pendingAvatar = useRef(null);

  // Marcos de píxel para la mesa del vecino y el buzón (los mismos que los controles del piso)
  useEffect(() => installPixelVars(), []);

  useEffect(() => {
    if (!ready) return undefined;
    let alive = true;
    loadEdificio()
      .then((d) => {
        if (!alive) return;
        // La primera vez, tu piso empieza con unos pocos muebles (y se guarda ya). Si lo acabas de cambiar en la
        // habitación de inicio, esa versión (myPiso.js): su guardado puede ir aún de camino
        setData(adoptMyPiso(community.userId, d));
        // El armario y las misiones del día (1.70); sin su migración, null y no se enseñan
        loadArmario(day).then((a) => alive && setArmario(a), () => alive && setArmario(null));
        // Si no llega, la balda ofrece todo y el servidor sigue siendo quien decide al guardar
        return loadInventario().then((inv) => alive && setInventory(inv), () => {});
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [ready, community.userId, attempt, day]);

  // Al salir con un guardado pendiente, se guarda ya
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      clearTimeout(avatarTimer.current);
      if (pendingAvatar.current) savePersonaje(pendingAvatar.current.userId, pendingAvatar.current.personaje).catch(() => {});
      if (pending.current) saveMyPiso(pending.current.userId, pending.current.room).catch(() => {});
    },
    [],
  );

  const inShop = pisoId === TIENDA_ID;
  const inHotel = pisoId === HOTEL_ID;
  const open = pisoId && !inShop && !inHotel ? (data?.vecinos.find((v) => v.user_id === pisoId) ?? null) : null;
  const me = data?.vecinos.find((v) => v.yo) ?? null;
  const mine = open?.yo;
  // Dentro de un piso, la melodía baja; en la fachada y en la tienda, a su volumen
  const inPiso = Boolean(pisoId && !inShop && !inHotel);
  // Las mesas para dos que te esperan avisan estés donde estés, menos dentro del propio casino
  const enCasino = inHotel && hotelRoom === 'casino';
  const [mesas, setMesas] = useState([]);
  const [avisosVistos, setAvisosVistos] = useState(() => new Set());
  // El toque de un amigo llega al momento; la consulta periódica queda por si falla
  const mirarMesas = useRef(null);
  useEffect(() => (ready ? escucharMesas(() => mirarMesas.current?.()) : undefined), [ready]);
  useEffect(() => {
    if (!ready || enCasino) return undefined;
    let alive = true;
    const mirar = () => {
      if (document.hidden) return;
      loadCasino(dayKey()).then(
        (c) => alive && setMesas(c?.mesas ?? []),
        () => {},
      );
    };
    mirarMesas.current = mirar;
    mirar();
    const t = setInterval(mirar, AVISO_MS);
    document.addEventListener('visibilitychange', mirar);
    return () => {
      alive = false;
      mirarMesas.current = null;
      clearInterval(t);
      document.removeEventListener('visibilitychange', mirar);
    };
  }, [ready, enCasino]);
  const avisoDe = (m) => `${m.id}:${m.estado}`;
  const aviso = enCasino || dressing || revealing ? null : (mesasQueEsperan(mesas).find((m) => !avisosVistos.has(avisoDe(m))) ?? null);
  const irAlCasino = () => {
    setHotelRoom('casino');
    if (!inHotel) onOpenPiso(HOTEL_ID);
  };
  useEffect(() => setEdificioMusicInside(inPiso), [inPiso]);
  // Al salir del hotel se olvida la sala: la próxima vez se llega otra vez a la fachada
  if (wasHotel !== inHotel) {
    setWasHotel(inHotel);
    if (!inHotel) {
      setHotelRoom(null);
      setHotelDir(false);
    }
  }

  const onMyChange = (room) => {
    setData((d) => d && { ...d, vecinos: d.vecinos.map((v) => (v.yo ? { ...v, room } : v)) });
    pending.current = { userId: community.userId, room };
    // La habitación de inicio lo ve ya así, aunque el guardado aún no haya salido
    rememberMyPiso(community.userId, { room });
    setSaving('Guardando…');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const job = pending.current;
      pending.current = null;
      saveMyPiso(job.userId, job.room)
        .then(() => setSaving('Guardado.'))
        .catch((e) => setSaving(`No se ha podido guardar: ${e.message}`));
    }, SAVE_MS);
  };

  // Tu personaje (§69): se guarda un poco después del último cambio, como el piso
  // Misiones del día (§70): las tres de hoy con lo hecho, y la prenda que llega al hacerlas
  const missions = armario ? { items: missionsOf(day).map((m) => ({ ...m, hecha: armario.hechas.includes(m.id) })), proxima: PRENDAS.find((p) => !armario.prendas.includes(p)) ?? null, ganada: won, tickets: wonTickets } : null;
  const onMyEvent = (tipo) => {
    const m = missionsOf(day).find((x) => x.id === tipo);
    if (!armario || !m || armario.hechas.includes(tipo) || counting.current.has(tipo)) return;
    counting.current.add(tipo);
    contarDiaria(tipo, day)
      .then((a) => {
        setArmario(a);
        if (a.nueva) setWon(a.nueva);
        // Con todo el armario ya tuyo, las tres dan tickets (1.79): se suman a tu saldo sin esperar a recargar
        if (a.tickets) {
          setWonTickets(a.tickets);
          setInventory((inv) => inv && { ...inv, tickets: inv.tickets + a.tickets });
        }
        setNotice({ text: a.nueva ? `¡Las tres misiones de hoy! Prenda nueva en tu armario: ${prendaNombre(a.nueva)}.` : a.tickets ? `¡Las tres misiones de hoy! Ya tienes toda la ropa: +${a.tickets} tickets.` : `Misión del día hecha: ${m.texto.toLowerCase()}.` });
      })
      .catch(() => {})
      .finally(() => counting.current.delete(tipo));
  };

  const onMyAvatar = (personaje) => {
    setData((d) => d && { ...d, vecinos: d.vecinos.map((v) => (v.yo ? { ...v, personaje } : v)) });
    setSaving('Guardando…');
    clearTimeout(avatarTimer.current);
    pendingAvatar.current = { userId: community.userId, personaje };
    avatarTimer.current = setTimeout(() => {
      pendingAvatar.current = null;
      savePersonaje(community.userId, personaje)
        .then((r) => setSaving(r.local ? 'Guardado en este dispositivo.' : 'Guardado.'))
        .catch((e) => setSaving(`No se ha podido guardar: ${e.message}`));
    }, SAVE_MS);
  };

  // El místico legendario que te acompaña: se guarda al momento (el servidor comprueba que lo tienes)
  const onMyCompanion = (companero) => {
    setData((d) => d && { ...d, vecinos: d.vecinos.map((v) => (v.yo ? { ...v, companero } : v)) });
    setSaving('Guardando…');
    saveCompanero(community.userId, companero)
      .then(() => setSaving('Guardado.'))
      .catch((e) => setSaving(`No se ha podido guardar: ${e.message}`));
  };

  const pickStart = async (ids) => {
    const inv = await elegirInicio(ids);
    setInventory(inv);
    setChoosing(false);
    // Recién elegidos tus muebles, el piso se abre decorando para colocarlos
    setJustPicked(true);
  };
  const [justPicked, setJustPicked] = useState(false);
  const startPending = Boolean(mine && inventory && !inventory.inicioElegido);

  // Lo social del piso abierto (o el tuyo, en el portal, para tu buzón)
  const socialId = open ? open.user_id : !pisoId && me ? me.user_id : null;
  useEffect(() => {
    if (!socialId) return undefined;
    let alive = true;
    loadSocial(socialId).then(
      (sx) => alive && setSocialOf((m) => ({ ...m, [socialId]: sx })),
      () => alive && setSocialOf((m) => ({ ...m, [socialId]: null })),
    );
    return () => {
      alive = false;
    };
  }, [socialId]);
  const social = socialId ? socialOf[socialId] : undefined;
  const likes = social ? { megusta: social.megusta, mios: social.mios } : null;
  const setSocial = (id, sx) => setSocialOf((m) => ({ ...m, [id]: sx }));
  const onLike = (uid, si) => {
    const id = open.user_id;
    meGusta(id, uid, si).then(
      (sx) => setSocial(id, sx),
      () => {},
    );
  };
  const onFirmar = async (frase) => setSocial(open.user_id, await firmar(open.user_id, frase));
  const onRegalar = async (mueble, acabado) => setInventory(await regalar(open.user_id, mueble, acabado));

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
  } else if (inHotel) {
    body = <GranHotel room={hotelRoom} onRoom={setHotelRoom} directory={hotelDir} onDirectory={setHotelDir} soundOn={soundOn} timer={reloj} askPages={askPages} onPagesDone={onPagesDone} onOpenCalendar={onOpenCalendar} onInventory={setInventory} />;
  } else if (inShop) {
    body = inventory?.tienda ? (
      <Tienda inventory={inventory} room={me?.room} soundOn={soundOn} onInventory={setInventory} onGoPiso={(id, acabado = null) => {
          if (!me) return;
          setToPlace(id ?? null);
          setToPlaceAcabado(acabado);
          onOpenPiso(me.user_id);
        }} onOpenMissions={onOpenMissions} onReveal={setRevealing} closeReveal={closeReveal} />
    ) : (
      <p className="ed-note">{inventory ? 'La tienda del bajo abre muy pronto.' : 'Abriendo la tienda…'}</p>
    );
  } else if (pisoId && !open) {
    body = <p className="ed-note">Este piso ya no está en tu edificio.</p>;
  } else if (open && mine && choosing) {
    body = <StarterPicker onPick={pickStart} onLater={() => setChoosing(false)} />;
  } else if (open) {
    const label = mine ? `Tu piso, ${doorLabel(open.puerta)}` : `Piso de ${open.alias}, ${doorLabel(open.puerta)}`;
    body = (
      <div className={`${inside ? 'ed-room ed-inside' : 'ed-room'}${dressing ? ' is-dressing' : ''}`}>
        <div className="ed-head">
          <ReaderAvatar avatarId={open.avatar_id} alias={open.alias ?? ''} size="list" decorative />
          <div>
            <h2 className="ed-title" id="ed-title">
              {mine ? 'Tu piso' : `Piso de ${open.alias}`} · {doorLabel(open.puerta)}
            </h2>
            {/* Dentro de tu piso, solo el nombre: la habitación manda */}
            {!(mine && inside) && <p className="ed-sub">{mine ? 'Tus vecinos lo ven como lo dejes.' : likes ? 'Toca un mueble para darle un «me gusta».' : 'Puedes mirar, pero no tocar nada.'}</p>}
          </div>
        </div>
        {!mine && open.room && visita3d !== open.user_id && (
          <button type="button" className="ed-visita-toggle" onClick={() => setVisita3d(open.user_id)}>
            Entrar en 3D
          </button>
        )}
        {!mine && open.room && visita3d === open.user_id ? (
          <Suspense fallback={<p className="ed-note">Entrando…</p>}>
            <VisitaPiso key={open.user_id} vecino={open} edificio={data.edificio} onVolver={onClose} onIso={() => setVisita3d(null)} />
          </Suspense>
        ) : open.room ? <PisoView key={open.user_id} room={open.room} editable={mine} label={label} soundOn={soundOn} inside={inside} decorate={mine && justPicked} inventory={mine ? inventory : null} avatar={mine ? (open.personaje ?? localAvatar(community.userId)) : open.personaje} companion={open.companero ?? null} onCompanionChange={mine ? onMyCompanion : null} prendas={mine ? (armario?.prendas ?? null) : null} missions={mine ? missions : null} notice={mine ? notice : null} likes={likes} placeId={mine ? toPlace : null} placeAcabado={mine ? toPlaceAcabado : null} onPlaced={() => setToPlace(null)} onLike={mine ? null : onLike} onChange={mine ? onMyChange : null} onAvatarChange={mine ? onMyAvatar : null} onEvent={mine ? onMyEvent : null} onDressing={mine ? setDressing : null} closeDressing={closeDressing} /> : <p className="ed-note">Aún no ha decorado su piso.</p>}
        {!mine && open.room && visita3d === open.user_id && (
          <button type="button" className="ed-visita-toggle is-dentro" onClick={() => setVisita3d(null)}>
            Ver en isométrica
          </button>
        )}
        {mine && (
          <p className="ed-saving" role="status" aria-live="polite">
            {saving}
          </p>
        )}
        {!mine && <VecinoMesa vecino={open} social={social ?? null} inventory={inventory} myRoom={me?.room ?? null} myId={community.userId} today={day} onFirmar={onFirmar} onRegalar={onRegalar} />}
      </div>
    );
  } else {
    // El correo del buzón dibujado en la fachada (1.73: sin la tarjeta «Tu buzón» ni el título, a petición de Francisco)
    const mail = [
      ...(social?.regalos.slice(0, 5).map((r) => `${r.alias ?? 'Un vecino'} te regaló: ${catalogItem(r.mueble).nombre.toLowerCase()}.`) ?? []),
      ...(social?.visitas.slice(0, 5).map((v) => `${v.alias ?? 'Un vecino'} firmó en tu libro de visitas: «${firmaText(v.frase)}».`) ?? []),
      // Con su fecha: el buzón recuerda lo leído por su texto, y mañana puede ser otra mesa con la misma persona
      ...mesasQueEsperan(mesas).map((m) => `${avisoMesa(m)} (${fechaCorta(m.dia)})`),
      ...mesas.filter((m) => m.estado === 'cerrada').map((m) => `Ha terminado la mesa para dos con ${nombreMesa(m)}: mira el resultado en el casino. (${fechaCorta(m.dia)})`),
    ];
    // El portal (1.65): el edificio de borde a borde; el nombre queda para los lectores de pantalla
    body = (
      <div className="ed-portal">
        <h2 className="px-sr" id="ed-title">
          El edificio del puerto. Tu puerta: {doorLabel(data.puerta)}.
        </h2>
        <Facade vecinos={data.vecinos} onOpenPiso={onOpenPiso} shopBadge={inventory?.tienda ? `${inventory.tickets} tickets` : null} mail={mail} userId={community.userId} />
      </div>
    );
  }

  return (
    <PanelShell onClose={onClose} label={inHotel ? 'El Gran Hotel del Puerto' : inShop ? 'La tienda del bajo' : pisoId && open ? (mine ? 'Tu piso' : `Piso de ${open.alias}`) : 'El edificio del puerto'} variant="edificio">
      <div className="ed-bar">
        {pisoId ? (
          <button type="button" className="ed-bar__back" onClick={dressing ? () => setCloseDressing((n) => n + 1) : inShop && revealing ? () => setCloseReveal((n) => n + 1) : inHotel && hotelRoom ? () => setHotelRoom(null) : onClose}>
            <ArrowLeft aria-hidden="true" />
            {dressing ? 'Al piso' : inShop && revealing ? 'Volver a la tienda' : inHotel ? (hotelRoom ? 'A la calle' : 'Al puerto') : 'Volver al portal'}
          </button>
        ) : (
          <button type="button" className="ed-bar__close" onClick={onClose} aria-label="Cerrar el edificio">
            <X aria-hidden="true" />
          </button>
        )}
        {dressing && <p className="ed-bar__title">Armario</p>}
        {/* En la fachada del hotel, el Directorio de las plantas (1.77) */}
        {inHotel && !hotelRoom && (
          <button type="button" className="px-btn ed-bar__dir" aria-expanded={hotelDir} onClick={() => setHotelDir((d) => !d)}>
            Directorio
          </button>
        )}
        {startPending && !choosing && (
          <button type="button" className="px-btn ed-bar__start" onClick={() => setChoosing(true)}>
            Elige tus {START_PICKS} muebles
          </button>
        )}
        {pisoId && open && !choosing && !dressing && (
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
      {aviso && (
        <div className="ed-aviso" role="status">
          <ReaderAvatar avatarId={aviso.amigo?.avatar_id} alias={nombreMesa(aviso)} size="list" decorative />
          <p>{avisoMesa(aviso)}</p>
          <button type="button" className="px-btn" onClick={irAlCasino}>
            Ir al casino
          </button>
          <button type="button" className="ed-aviso__no" aria-label="Ahora no" onClick={() => setAvisosVistos((v) => new Set(v).add(avisoDe(aviso)))}>
            <X aria-hidden="true" />
          </button>
        </div>
      )}
      {body}
    </PanelShell>
  );
}
