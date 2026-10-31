// Pestañas de la comunidad de la entrega 3 (SPEC §25.8–25.10): mi rincón compartido, lectores seguidos con su
// actividad y «En la sala» (leer en compañía). Todo dentro del mismo panel «Comunidad» (un solo perfil).
import { ChevronRight, Flag } from 'lucide-react';
import { useEffect, useState } from 'react';
import { RatingStars } from '../../../components/book/Rating';
import { Cover } from '../../../components/shelf/BookItem';
import { ReaderAvatar } from '../../../components/avatars/ReaderAvatar';
import { currentBook } from '../../../domain/books';
import { useLibrary } from '../../../state/useLibrary';
import { seatParticipants, sessionMinutes } from '../connections';
import { useCommunity } from '../hooks/useCommunity';
import { OptionsMenu } from '../../../components/book/Annotations';
import { fetchProfiles, reportContent } from '../services/community';
import { fetchActivity } from '../services/connections';
import { sitDownNow, standUpNow, usePresence } from '../hooks/usePresence';
import { ReaderProfileView } from './ReaderProfile';
import { warmVisit } from '../visitScene';
import { SectionIcon } from '../../../components/SectionIcon';
import { CornerEditor } from './CornerEditor';
import { CollectionsEditor } from './HuellasEditor';

function Gate({ community, children }) {
  if (community.status !== 'ready') return <p className="social-note">Abre «Mi Perfil & Avatar» para empezar.</p>;
  if (!community.member) return <p className="social-note">Activa «Participar en la comunidad» en «Mi Perfil & Avatar» para usar esta sección.</p>;
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
 * Una opinión de alguien a quien sigues: portada (la de tu ejemplar si es la misma obra; si no, la cubierta tipográfica),
 * título y autoría, quién la escribe y su valoración, y el principio del texto (nunca un spoiler). Tocarla abre su
 * rincón; «…» ofrece lo mismo y denunciarla (con confirmación, como en «Voces de lectores»).
 */
function SharedReview({ review: r, author, books, onOpen }) {
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState('');
  const alias = author?.alias ?? 'Lector';
  const mineCopy = r.work ? books.find((b) => b.workId === r.work.id) : null;
  const cover = { id: r.work?.id ?? r.id, title: r.work?.title ?? 'Obra', author: r.work?.author ?? '', cover: mineCopy?.cover ?? '' };
  const report = async () => {
    setConfirming(false);
    try {
      await reportContent('review', r.id, 'Denuncia desde «Lo que comparten»');
      setNotice('Gracias: moderación la revisará.');
    } catch (e) {
      setNotice(e.message);
    }
  };
  return (
    <article className="activity-card">
      <img className="activity-card__clip" src="/assets/bookshelf/notebook/brass-paper-clip.webp" alt="" width="160" height="128" aria-hidden="true" />
      <button type="button" className="activity-card__open" onClick={onOpen} aria-label={`Opinión de ${alias}${r.work ? ` sobre «${r.work.title}»` : ''}. Abrir su rincón`}>
        <span className="activity-card__cover" aria-hidden="true">
          <Cover book={cover} />
        </span>
        <span className="activity-card__text" aria-hidden="true">
          {r.work && (
            <b className="activity-card__title">
              {r.work.title}
              {r.work.author && <small> · {r.work.author}</small>}
            </b>
          )}
          <span className="activity-card__who">
            <ReaderAvatar avatarId={author?.avatar_id} alias={alias} size="review" decorative />
            <span className="activity-card__alias">{alias}</span>
            {r.rating_quarters != null && <RatingStars value={r.rating_quarters / 4} />}
          </span>
          {r.has_spoilers ? <em>Contiene spoilers</em> : r.body && <span className="activity-card__excerpt">{r.body}</span>}
        </span>
      </button>
      {!confirming && (
        <span className="activity-card__menu">
          <OptionsMenu
            label={`Opciones de la opinión de ${alias}`}
            items={[
              { label: 'Ver su rincón', icon: null, onSelect: onOpen },
              { label: 'Denunciar', icon: <Flag aria-hidden="true" />, onSelect: () => setConfirming(true) },
            ]}
          />
        </span>
      )}
      {confirming && (
        <div className="social-confirm" role="alertdialog" aria-label="Denunciar esta opinión">
          <p>¿Denunciar esta opinión? Solo la verá moderación; la otra persona no sabrá quién la ha denunciado.</p>
          <div className="social-actions">
            <button type="button" className="social-btn social-btn--primary" onClick={report}>
              Sí, denunciar
            </button>
            <button type="button" className="social-btn" onClick={() => setConfirming(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
      {notice && (
        <p className="social-note" role="status">
          {notice}
        </p>
      )}
    </article>
  );
}

/** Lectores que sigo y lo que comparten: reseñas publicadas por ellos y novedades de mis clubes. */
export function ReadersTab({ onVisit = null, onOpenClub = null }) {
  const community = useCommunity({ autoload: true });
  const { state } = useLibrary();
  const { following, loadFollowing } = community;
  const [profiles, setProfiles] = useState({});
  const [activity, setActivity] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [failure, setFailure] = useState('');
  const ready = community.status === 'ready' && community.member;

  useEffect(() => {
    if (ready && following === null) loadFollowing().catch((e) => setFailure(e.message));
  }, [ready, following, loadFollowing]);

  // 1.59 (SPEC §59.9): los nombres de quien sigues llegan en cuanto están (sin esperar a la actividad), en paralelo con
  // la actividad; de sus autores solo se piden los que faltan (los perfiles ya cargados vienen de la caché)
  useEffect(() => {
    if (!ready || following === null) return undefined;
    let alive = true;
    const fail = (e) => alive && setFailure(e.message);
    fetchProfiles(following)
      .then((p) => alive && setProfiles((prev) => ({ ...prev, ...p })))
      .catch(fail);
    fetchActivity(following)
      .then(async (a) => {
        const authors = await fetchProfiles(a.reviews.map((r) => r.user_id));
        if (alive) {
          setProfiles((prev) => ({ ...prev, ...authors }));
          setActivity(a);
        }
      })
      .catch(fail);
    return () => {
      alive = false;
    };
  }, [ready, following]);

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
      {failure && (
        <p className="social-error" role="alert">
          {failure}
        </p>
      )}
      <section aria-label="Lectores que sigo" className="readers">
        <h3 className="social-title">Lectores que sigo</h3>
        {following?.length === 0 && <p className="social-note">Aún no sigues a nadie. Abre el perfil de quien escribe una reseña para seguirle.</p>}
        <ul className="reader-rows">
          {(following ?? []).map((id) => (
            <li key={id}>
              <button type="button" className="follow-row" onClick={() => setViewing(id)}>
                <ReaderAvatar avatarId={profiles[id]?.avatar_id} alias={profiles[id]?.alias ?? ''} size="list" decorative />
                {/* Mientras llega su nombre, un hueco discreto (nunca un «Lector» genérico que parezca otra persona) */}
                {id in profiles ? (
                  <span className="follow-row__name">{profiles[id]?.alias ?? 'Perfil no disponible'}</span>
                ) : (
                  <span className="follow-row__name follow-row__name--loading">
                    <span className="sr-only-focus">Cargando su nombre…</span>
                  </span>
                )}
                <span className="follow-row__go">Ver su rincón</span>
                <ChevronRight aria-hidden="true" />
              </button>
              {/* 1.58 (SPEC §56): visita opcional a su casa; el perfil de siempre sigue en el botón de arriba */}
              {onVisit && profiles[id] && (
                <button type="button" className="follow-row__visit" onPointerDown={warmVisit} onFocus={warmVisit} onClick={() => onVisit(id)} aria-label={`Visitar el rincón de ${profiles[id].alias}`}>
                  Visitar rincón
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
      {/* 1.60 (SPEC §60): «Lo que comparten», como en la maqueta: cada opinión es una hoja sujeta con su clip */}
      <section aria-label="Lo que comparten" className="readers">
        <h3 className="social-title">Lo que comparten</h3>
        {activity === null && !failure && (
          <p className="social-note" role="status">
            Cargando su actividad…
          </p>
        )}
        {activity && activity.reviews.length === 0 && activity.clubs.length === 0 && <p className="social-note">Nada nuevo por aquí.</p>}
        <ul className="reader-rows">
          {activity?.reviews.map((r) => (
            <li key={r.id}>
              <SharedReview review={r} author={profiles[r.user_id]} books={state.books} onOpen={() => setViewing(r.user_id)} />
            </li>
          ))}
          {/* Clubes: el tipo («Club de lectura») va aparte del nombre que puso su creador, sin tocarlo */}
          {activity?.clubs.map((c) => (
            <li key={c.id} className="activity-club">
              <SectionIcon name="club" size={40} className="activity-club__icon" />
              <span className="activity-club__text">
                <span className="activity-club__kind">Club de lectura</span>
                <b>{c.name}</b>
                {c.status === 'archived' ? <small>Archivado</small> : c.discussion_point ? <small>{c.discussion_point}</small> : null}
              </span>
              {onOpenClub && (
                <button type="button" className="activity-club__enter" onClick={() => onOpenClub(c.id)} aria-label={`Entrar en el club ${c.name}`}>
                  Entrar <ChevronRight aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </Gate>
  );
}

/** «En la sala»: sentarse a leer de forma voluntaria y ver quién lee ahora (sin inventar a nadie). */
export function RoomTab({ timer }) {
  const community = useCommunity({ autoload: true });
  const { state } = useLibrary();
  const reading = currentBook(state.books, state.settings);
  const { rows, me, failure } = usePresence({ enabled: community.status === 'ready' && community.member, userId: community.userId });
  const sit = sitDownNow;
  const stand = () => standUpNow(community.userId);
  const [profiles, setProfiles] = useState({});
  const [share, setShare] = useState(Boolean(reading));
  const participants = seatParticipants(rows, community.userId, Infinity);

  useEffect(() => {
    if (!participants.all.length) return;
    fetchProfiles(participants.all.map((r) => r.user_id)).then(setProfiles).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participants.all.map((r) => r.user_id).join(',')]);

  return (
    <Gate community={community}>
      <p className="social-note">Entrar en el salón no te sienta a leer. Si te sientas, otras personas verán tu avatar y tu alias{share ? ' y el libro que lees' : ''} mientras sigas con la app abierta. No se registran páginas ni premios.</p>
      {failure && (
        <p className="social-error" role="alert">
          {failure}
        </p>
      )}
      {me ? (
        <div className="social-actions">
          <span>
            Estás sentado/a · {timer?.running ? `con tu temporizador (${Math.ceil(timer.remaining / 60000)} min)` : sessionMinutes(me.started_at)}
          </span>
          <button type="button" className="social-btn" onClick={stand}>
            Levantarme
          </button>
        </div>
      ) : (
        <div className="profile-form">
          <label className="social-check">
            <input type="radio" name="sit-share" checked={share && Boolean(reading)} disabled={!reading} onChange={() => setShare(true)} />
            <span>Compartir el libro actual{reading ? ` («${reading.title}»)` : ' (no tienes ninguno empezado)'}</span>
          </label>
          <label className="social-check">
            <input type="radio" name="sit-share" checked={!share || !reading} onChange={() => setShare(false)} />
            <span>Mostrar solo mi avatar y mi alias</span>
          </label>
          <div className="social-actions">
            <button type="button" className="social-btn social-btn--primary" onClick={() => sit({ shareBook: share && Boolean(reading), bookTitle: reading?.title })}>
              Sentarme a leer
            </button>
          </div>
        </div>
      )}
      <section aria-label="Quién lee ahora" className="readers">
        <h3 className="social-title">Leyendo ahora en el salón</h3>
        {participants.all.length === 0 && <p className="social-note">Los sillones están vacíos.</p>}
        {participants.all.map((r) => (
          <div key={r.user_id} className="follow-row">
            <ReaderAvatar avatarId={profiles[r.user_id]?.avatar_id} alias={profiles[r.user_id]?.alias ?? ''} size="list" />
            <span>
              <b>{profiles[r.user_id]?.alias ?? 'Lector'}</b>
              {r.share_book && r.book_title ? ` · «${r.book_title}»` : ''} · {sessionMinutes(r.started_at)}
            </span>
          </div>
        ))}
      </section>
    </Gate>
  );
}
