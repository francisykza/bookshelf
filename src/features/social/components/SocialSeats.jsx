// Objetos interactivos del Salón Social (SPEC §25.9–25.10), anclados al mapa de la escena (misma transformación
// de cámara que la ilustración): la tablet (comunidad), el cuadro de recomendación (club), los dos sillones con
// los medallones de quien lee de verdad ahora y el Guardián expuesto sobre el reposabrazos. Los sillones vacíos
// quedan vacíos; si hay más lectores que sillones, un «+N lectores» discreto abre la lista. Información mínima en
// la escena; los detalles, en los paneles.
import { useEffect, useState } from 'react';
import { ReaderAvatar } from '../../../components/avatars/ReaderAvatar';
import { PinArt } from '../../../components/figures/FigureArt';
import { useFigureCatalog } from '../../../components/figures/figureCatalog';
import { clipPolygon } from '../../../scene/homography';
import { SOCIAL_SPOTS } from '../../../scene/socialMap';
import { seatParticipants, sessionMinutes } from '../connections';
import { useCommunity } from '../hooks/useCommunity';
import { usePresence } from '../hooks/usePresence';
import { fetchProfiles } from '../services/community';
import { fetchCorners } from '../services/connections';

const box = (shape) => {
  const xs = shape.map((p) => p[0]);
  const ys = shape.map((p) => p[1]);
  return { left: Math.min(...xs), top: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
};

/** Botón con la forma del objeto pintado (sin dibujo propio): un único objetivo accesible por objeto. */
function Spot({ spot, label, onActivate }) {
  const b = box(spot.shape);
  // El recorte se expresa relativo a la caja del botón
  const local = spot.shape.map(([x, y]) => [x - b.left, y - b.top]);
  return <button type="button" className="social-spot" data-id={spot.id} style={{ ...b, clipPath: clipPolygon(local) }} aria-label={label} title={label} onClick={onActivate} />;
}

export function SocialSeats({ active, timer, onOpenHub, onOpenReader, onOpenGuardian }) {
  const community = useCommunity({ autoload: active });
  const enabled = community.status === 'ready' && community.member;
  const { rows } = usePresence({ enabled, userId: community.userId, watching: active });
  const [profiles, setProfiles] = useState({});
  const [corners, setCorners] = useState({});
  const [now, setNow] = useState(() => Date.now());
  const catalog = useFigureCatalog();
  const { seated, extra } = seatParticipants(rows, community.userId, SOCIAL_SPOTS.seats.length, now);
  const ids = seated.map((r) => r.user_id).join(',');

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

  return (
    <div className="social-objects">
      <Spot spot={SOCIAL_SPOTS.tablet} label="Tablet: perfiles, lectores que sigues y opiniones" onActivate={() => onOpenHub('lectores')} />
      <Spot spot={SOCIAL_SPOTS.board} label="Cuadro de recomendación: club de lectura" onActivate={() => onOpenHub('club')} />
      {SOCIAL_SPOTS.seats.map((seat, i) => {
        const person = seated[i];
        if (!person) return <Spot key={seat.id} spot={seat} label="Sillón libre: sentarme a leer" onActivate={() => onOpenHub('sala')} />;
        const profile = profiles[person.user_id];
        const mine = person.user_id === community.userId;
        const corner = corners[person.user_id];
        const guardian = corner?.visible && corner.guardian_id ? catalog.find((f) => f.id === corner.guardian_id) : null;
        const time = mine && timer?.running ? `leyendo · ${Math.ceil(timer.remaining / 60000)} min` : sessionMinutes(person.started_at, now);
        return (
          <div key={seat.id}>
            <Spot spot={seat} label={mine ? 'Tu sillón: leer en compañía' : `Sillón de ${profile?.alias ?? 'un lector'}`} onActivate={() => onOpenHub('sala')} />
            <button type="button" className="seat-medallion" style={{ left: seat.medallion[0], top: seat.medallion[1] }} onClick={() => (mine ? onOpenHub('sala') : onOpenReader(person.user_id))} aria-label={`${profile?.alias ?? 'Lector'}${person.share_book && person.book_title ? `, leyendo «${person.book_title}»` : ''}, ${time}`}>
              <ReaderAvatar avatarId={profile?.avatar_id} alias={profile?.alias ?? ''} size="seat" decorative />
              <span className="seat-medallion__label" aria-hidden="true">
                <b>{profile?.alias ?? 'Lector'}</b>
                {person.share_book && person.book_title && <i>{person.book_title}</i>}
                <span>{time}</span>
              </span>
            </button>
            {guardian && (
              // El Guardián, aparte del avatar (nunca en su marco), sobre el reposabrazos
              <button type="button" className="seat-guardian saga-pin" data-owned style={{ left: seat.armrest[0], top: seat.armrest[1] }} onClick={() => onOpenGuardian(guardian.id)} aria-label={`Guardián de ${profile?.alias ?? 'este lector'}: ${guardian.name}`}>
                <PinArt fig={guardian} />
              </button>
            )}
          </div>
        );
      })}
      {extra > 0 && (
        <button type="button" className="seat-more" style={{ left: SOCIAL_SPOTS.more[0], top: SOCIAL_SPOTS.more[1] }} onClick={() => onOpenHub('sala')}>
          +{extra} {extra === 1 ? 'lector' : 'lectores'}
        </button>
      )}
    </div>
  );
}
