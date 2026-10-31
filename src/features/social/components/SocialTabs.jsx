// Pestañas de la comunidad de la entrega 3 (SPEC §25.8–25.10): mi rincón compartido, lectores seguidos con su
// actividad y «En la sala» (leer en compañía). Todo dentro del mismo panel «Comunidad» (un solo perfil).
import { BookOpen } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { ReaderAvatar } from '../../../components/avatars/ReaderAvatar';
import { seatParticipants, sessionMinutes } from '../connections';
import { useCommunity } from '../hooks/useCommunity';
import { fetchProfiles } from '../services/community';
import { sitDownNow, standUpNow, usePresence } from '../hooks/usePresence';
import { ReaderProfileView } from './ReaderProfile';
import { ReadersSection } from './ReadersSection';
import { SeatChoice } from './SeatChoice';
import { CornerEditor } from './CornerEditor';
import { CollectionsEditor } from './HuellasEditor';

function Gate({ community, children }) {
  if (community.status !== 'ready') return <p className="social-note">Abre «Tu perfil lector» desde tu avatar, arriba a la izquierda, para empezar.</p>;
  if (!community.member) return <p className="social-note">Activa «Participar en la comunidad» en «Tu perfil lector» (desde tu avatar, arriba a la izquierda) para usar esta sección.</p>;
  return children;
}

/** Mi rincón (1.60, §60): el rincón y su ambiente en el cuaderno, y debajo las colecciones. */
export function CornerTab() {
  return (
    <CornerEditor Gate={Gate}>
      <CollectionsEditor />
    </CornerEditor>
  );
}

/**
 * Lectores (1.62, SPEC §62): buscador, a quienes sigues y lo que comparten (`ReadersSection`). El avatar abre su perfil
 * como panel propio (Atrás vuelve aquí); sin ese acceso (compatibilidad), su perfil se abre aquí mismo.
 */
export function ReadersTab({ onVisit = null, onOpenClub = null, onOpenReader = null }) {
  const community = useCommunity({ autoload: true });
  const [viewing, setViewing] = useState(null);
  if (viewing)
    return (
      <div>
        <button type="button" className="spoiler-toggle" onClick={() => setViewing(null)}>
          ← Volver a lectores
        </button>
        <ReaderProfileView userId={viewing} onClose={() => setViewing(null)} />
      </div>
    );
  return (
    <Gate community={community}>
      <ReadersSection community={community} onVisit={onVisit} onOpenClub={onOpenClub} onOpenReader={onOpenReader ?? setViewing} />
    </Gate>
  );
}

/**
 * «Salón» (1.62, SPEC §62.2; maqueta 04, centro): «Tu lugar en el salón» con la misma elección que el sillón de la escena
 * (alias y lectura actual / solo alias) y «Leyendo en compañía», la lista completa de quien lee ahora (también quien no
 * cabe en los sillones), con su rincón a un toque. Solo presencia real: entrar aquí no te sienta.
 */
export function RoomTab({ timer, onVisit = null }) {
  const community = useCommunity({ autoload: true });
  const { rows, me, failure } = usePresence({ enabled: community.status === 'ready' && community.member, userId: community.userId });
  const [profiles, setProfiles] = useState({});
  const [busy, setBusy] = useState(false);
  const titleId = useId();
  const participants = seatParticipants(rows, community.userId, Infinity);
  const others = participants.all.filter((r) => r.user_id !== community.userId);

  useEffect(() => {
    if (!participants.all.length) return;
    fetchProfiles(participants.all.map((r) => r.user_id)).then(setProfiles).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participants.all.map((r) => r.user_id).join(',')]);

  const run = async (action) => {
    setBusy(true);
    await action();
    setBusy(false);
  };

  return (
    <Gate community={community}>
      <section className="room-tab" aria-labelledby={titleId}>
        <h3 className="room-tab__title" id={titleId}>
          Tu lugar en el salón
        </h3>
        {failure && (
          <p className="social-error" role="alert">
            {failure}
          </p>
        )}
        {me ? (
          <div className="room-tab__me">
            <ReaderAvatar avatarId={profiles[me.user_id]?.avatar_id} alias={profiles[me.user_id]?.alias ?? ''} size="list" />
            <p>
              <b>Estás sentado/a</b>
              {me.share_book && me.book_title ? (
                <span>
                  Leyendo <i>{me.book_title}</i>
                </span>
              ) : (
                <span>Solo con tu alias</span>
              )}
              <small>{timer?.running ? `Con tu temporizador · ${Math.ceil(timer.remaining / 60000)} min` : sessionMinutes(me.started_at)}</small>
            </p>
            <button type="button" className="seat-choice__sit" onClick={() => run(() => standUpNow(community.userId))} disabled={busy}>
              {busy ? 'Levantándote…' : 'Levantarme'}
            </button>
          </div>
        ) : (
          <SeatChoice onSit={(choice) => run(() => sitDownNow(choice))} busy={busy} />
        )}
      </section>
      <section aria-label="Leyendo en compañía" className="room-tab__company">
        <h3 className="room-tab__title">Leyendo en compañía</h3>
        {others.length === 0 ? (
          <p className="social-note">Ahora mismo no hay nadie más sentado. Los sillones esperan.</p>
        ) : (
          <ul className="room-tab__list">
            {others.map((r) => {
              const alias = profiles[r.user_id]?.alias ?? 'Lector';
              return (
                <li key={r.user_id} className="room-tab__reader">
                  <ReaderAvatar avatarId={profiles[r.user_id]?.avatar_id} alias={profiles[r.user_id]?.alias ?? ''} size="list" />
                  <span className="room-tab__who">
                    <b>{alias}</b>
                    {r.share_book && r.book_title && (
                      <span>
                        <BookOpen aria-hidden="true" />
                        Leyendo {r.book_title}
                      </span>
                    )}
                    <small>{sessionMinutes(r.started_at)}</small>
                  </span>
                  {onVisit && (
                    <button type="button" className="reader-person__visit" onClick={() => onVisit(r.user_id)} aria-label={`Ver el rincón de ${alias}`}>
                      Ver rincón
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </Gate>
  );
}
