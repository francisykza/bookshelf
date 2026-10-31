// Objetos interactivos del Salón Social (SPEC §25.9–25.10), anclados al mapa de la escena (misma transformación
// de cámara que la ilustración): la tablet (comunidad), el cuadro de recomendación (club), los dos sillones con
// los medallones de quien lee de verdad ahora y el Guardián expuesto sobre el reposabrazos. Los sillones vacíos
// quedan vacíos; si hay más lectores que sillones, un «+N lectores» discreto abre la lista. Información mínima en
// la escena; los detalles, en los paneles.
// 1.62 (SPEC §62.2): el sillón libre abre aquí mismo la elección para sentarte (con una etiqueta «Sentarme» sobre el
// cojín) y el avatar de quien lee abre su tarjeta junto al asiento: su lectura solo si la comparte, «Ver perfil» y
// «Visitar su rincón». Tu propio avatar abre la tuya, con «Levantarme».
import { ArrowRight, BookOpen, Armchair } from 'lucide-react';
import { useCallback, useEffect, useId, useState } from 'react';
import { ReaderAvatar } from '../../../components/avatars/ReaderAvatar';
import { PinArt } from '../../../components/figures/FigureArt';
import { useFigureCatalog } from '../../../components/figures/figureCatalog';
import { clipPolygon } from '../../../scene/homography';
import { SOCIAL_SPOTS } from '../../../scene/socialMap';
import { seatParticipants, sessionMinutes } from '../connections';
import { useCommunity } from '../hooks/useCommunity';
import { sitDownNow, standUpNow, usePresence } from '../hooks/usePresence';
import { fetchProfiles } from '../services/community';
import { fetchCorners } from '../services/connections';
import { RADIO_ART } from '../../radio/RadioControls';
import { useRadio } from '../../radio/radioPlayer';
import { SeatCard } from './SeatCard';
import { SeatChoice } from './SeatChoice';

const box = (shape) => {
  const xs = shape.map((p) => p[0]);
  const ys = shape.map((p) => p[1]);
  return { left: Math.min(...xs), top: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
};

/** Botón con la forma del objeto pintado (sin dibujo propio): un único objetivo accesible por objeto. */
function Spot({ spot, label, onActivate, ...rest }) {
  const b = box(spot.shape);
  // El recorte se expresa relativo a la caja del botón
  const local = spot.shape.map(([x, y]) => [x - b.left, y - b.top]);
  return <button type="button" className="social-spot" data-id={spot.id} style={{ ...b, clipPath: clipPolygon(local) }} aria-label={label} title={label} onClick={onActivate} {...rest} />;
}

export function SocialSeats({ active, timer, onOpenHub, onOpenReader, onVisit, onOpenGuardian, onOpenRadio = null }) {
  const radio = useRadio();
  const community = useCommunity({ autoload: active });
  const enabled = community.status === 'ready' && community.member;
  const { rows, me, failure } = usePresence({ enabled, userId: community.userId, watching: active });
  const [profiles, setProfiles] = useState({});
  const [corners, setCorners] = useState({});
  const [now, setNow] = useState(() => Date.now());
  // Tarjeta abierta: `{ kind: 'sentarse' | 'lector', id?, anchor }` (el ancla es el botón que la abrió)
  const [card, setCard] = useState(null);
  const [busy, setBusy] = useState(false);
  const catalog = useFigureCatalog();
  const { seated, extra } = seatParticipants(rows, community.userId, SOCIAL_SPOTS.seats.length, now);
  const ids = seated.map((r) => r.user_id).join(',');
  const close = useCallback(() => setCard(null), []);
  const titleId = useId();

  // El tiempo visible se recalcula cada 30 s a partir de la marca de inicio (nada se escribe por segundo)
  useEffect(() => {
    if (!active || !seated.length) return undefined;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [active, seated.length]);

  useEffect(() => {
    if (!enabled || !ids) return undefined;
    let alive = true;
    const list = ids.split(',');
    Promise.all([fetchProfiles(list), fetchCorners(list)])
      .then(([p, c]) => alive && (setProfiles(p), setCorners(c)))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [enabled, ids]);

  // Salón fuera de la vista (otro panel, otra habitación), cuenta cambiada o quien la tenía abierta se levantó (o caducó):
  // la tarjeta deja de enseñarse (nunca alguien que ya no está)
  const person = card?.kind === 'lector' ? seated.find((r) => r.user_id === card.id) : null;
  const shown = active && enabled && card && (card.kind !== 'lector' || person) ? card : null;
  const open = shown?.kind === 'lector' ? person : null;

  const sit = async (choice) => {
    setBusy(true);
    const ok = await sitDownNow(choice);
    setBusy(false);
    if (ok) setCard(null);
  };
  const stand = async () => {
    setBusy(true);
    const ok = await standUpNow(community.userId);
    setBusy(false);
    if (ok) setCard(null);
  };

  const timeOf = (person) => (person.user_id === community.userId && timer?.running ? `leyendo · ${Math.ceil(timer.remaining / 60000)} min` : sessionMinutes(person.started_at, now));

  return (
    <div className="social-objects">
      <Spot spot={SOCIAL_SPOTS.tablet} label="Tablet: perfiles, lectores que sigues y opiniones" onActivate={() => onOpenHub('lectores')} />
      {onOpenRadio && (
        // La radio del rincón: objeto físico sobre la mesa (sombra de contacto bajo las patas) que abre su panel
        <button type="button" className="social-radio" style={{ left: SOCIAL_SPOTS.radio.x, top: SOCIAL_SPOTS.radio.y, width: SOCIAL_SPOTS.radio.w }} onClick={onOpenRadio} aria-label={radio.status === 'playing' ? 'Radio del rincón: sonando. Abrir sus controles' : 'Radio del rincón: música para leer'}>
          <img src={RADIO_ART} alt="" width="360" height="221" decoding="async" draggable="false" />
        </button>
      )}
      <Spot spot={SOCIAL_SPOTS.board} label="Cuadro de recomendación: club de lectura" onActivate={() => onOpenHub('club')} />
      {SOCIAL_SPOTS.seats.map((seat, i) => {
        const person = seated[i];
        if (!person) {
          // Sentarse aquí mismo si participas y aún no estás sentado/a; si no, la pestaña «Salón» lo explica
          const canSit = enabled && !me;
          return (
            <div key={seat.id}>
              <Spot
                spot={seat}
                label={canSit ? 'Sillón libre: sentarme a leer' : 'Sillón libre'}
                aria-haspopup={canSit ? 'dialog' : undefined}
                aria-expanded={canSit ? card?.kind === 'sentarse' && card.seat === seat.id : undefined}
                onActivate={(e) => (canSit ? setCard(card?.seat === seat.id ? null : { kind: 'sentarse', seat: seat.id, anchor: e.currentTarget }) : onOpenHub('sala'))}
              />
              {canSit && (
                // Etiqueta pintada sobre el cojín (no es un control: el toque pasa al sillón)
                <span className="seat-free" style={{ left: seat.medallion[0], top: seat.medallion[1] }} aria-hidden="true">
                  <Armchair />
                  Sentarme
                </span>
              )}
            </div>
          );
        }
        const profile = profiles[person.user_id];
        const mine = person.user_id === community.userId;
        const corner = corners[person.user_id];
        const guardian = corner?.visible && corner.guardian_id ? catalog.find((f) => f.id === corner.guardian_id) : null;
        const time = timeOf(person);
        const alias = profile?.alias ?? 'Lector';
        const openCard = (e) => setCard(card?.id === person.user_id ? null : { kind: 'lector', id: person.user_id, anchor: e.currentTarget });
        return (
          <div key={seat.id}>
            <Spot spot={seat} label={mine ? 'Tu sillón: leer en compañía' : `Sillón de ${alias}`} onActivate={openCard} aria-haspopup="dialog" />
            <button
              type="button"
              className="seat-medallion"
              style={{ left: seat.medallion[0], top: seat.medallion[1] }}
              onClick={openCard}
              aria-haspopup="dialog"
              aria-expanded={card?.id === person.user_id}
              aria-label={`${mine ? `Tú (${alias})` : alias}${person.share_book && person.book_title ? `, leyendo «${person.book_title}»` : ''}, ${time}`}
            >
              <ReaderAvatar avatarId={profile?.avatar_id} alias={profile?.alias ?? ''} size="seat" decorative />
              <span className="seat-medallion__label" aria-hidden="true">
                <b>{alias}</b>
                {person.share_book && person.book_title && <i>{person.book_title}</i>}
                <span>{time}</span>
              </span>
            </button>
            {guardian && (
              // El Guardián, aparte del avatar (nunca en su marco), sobre el reposabrazos
              <button type="button" className="seat-guardian saga-pin" data-owned style={{ left: seat.armrest[0], top: seat.armrest[1] }} onClick={() => onOpenGuardian(guardian.id)} aria-label={`Guardián de ${alias}: ${guardian.name}`}>
                <PinArt fig={guardian} />
              </button>
            )}
          </div>
        );
      })}
      {extra > 0 && (
        // Más lectores que sillones: la lista completa («Leyendo en compañía») en la pestaña «Salón», sin amontonar retratos
        <button type="button" className="seat-more" style={{ left: SOCIAL_SPOTS.more[0], top: SOCIAL_SPOTS.more[1] }} onClick={() => onOpenHub('sala')}>
          +{extra} {extra === 1 ? 'lector' : 'lectores'}
        </button>
      )}
      {shown?.kind === 'sentarse' && (
        <SeatCard anchor={card.anchor} label="Sentarme a leer" onClose={close} wide>
          <h3 className="seat-card__title">Sentarme a leer</h3>
          {failure && (
            <p className="social-error" role="alert">
              {failure}
            </p>
          )}
          <SeatChoice onSit={sit} busy={busy} titleId={titleId} />
        </SeatCard>
      )}
      {open && (
        <ReaderCard
          person={open}
          profile={profiles[open.user_id]}
          mine={open.user_id === community.userId}
          time={timeOf(open)}
          anchor={card.anchor}
          busy={busy}
          failure={failure}
          onClose={close}
          onStand={stand}
          onProfile={() => (setCard(null), onOpenReader(open.user_id))}
          onVisit={onVisit ? () => (setCard(null), onVisit(open.user_id)) : null}
        />
      )}
    </div>
  );
}

/** Quien lee en un sillón: avatar, alias, su lectura solo si la comparte, y los accesos a su perfil y su rincón. */
function ReaderCard({ person, profile, mine, time, anchor, busy, failure, onClose, onStand, onProfile, onVisit }) {
  const alias = profile?.alias ?? 'Lector';
  const book = person.share_book && person.book_title ? person.book_title : null;
  return (
    <SeatCard anchor={anchor} label={mine ? 'Tu sitio en el salón' : `${alias} en el salón`} onClose={onClose}>
      <div className="seat-card__who">
        <ReaderAvatar avatarId={profile?.avatar_id} alias={profile?.alias ?? ''} size="list" decorative />
        <div>
          <h3 className="seat-card__title">{mine ? `Tú · ${alias}` : alias}</h3>
          {book && (
            <p className="seat-card__reading">
              Leyendo <i>{book}</i>
            </p>
          )}
          <p className="seat-card__time">{mine ? `Sentado/a · ${time}` : time}</p>
        </div>
      </div>
      {failure && mine && (
        <p className="social-error" role="alert">
          {failure}
        </p>
      )}
      {mine ? (
        <button type="button" className="seat-card__primary" onClick={onStand} disabled={busy}>
          {busy ? 'Levantándote…' : 'Levantarme'}
        </button>
      ) : (
        <>
          <button type="button" className="seat-card__link" onClick={onProfile}>
            <BookOpen aria-hidden="true" />
            Ver perfil
          </button>
          {onVisit && (
            <button type="button" className="seat-card__primary" onClick={onVisit}>
              Visitar su rincón
              <ArrowRight aria-hidden="true" />
            </button>
          )}
        </>
      )}
    </SeatCard>
  );
}
