// Pestañas de la comunidad de la entrega 3 (SPEC §25.8–25.10): mi rincón compartido, lectores seguidos con su
// actividad y «En la sala» (leer en compañía). Todo dentro del mismo panel «Comunidad» (un solo perfil).
import { ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { RatingStars } from '../../../components/book/Rating';
import { Cover } from '../../../components/shelf/BookItem';
import { ReaderAvatar } from '../../../components/avatars/ReaderAvatar';
import { useFigureCatalog } from '../../../components/figures/figureCatalog';
import { currentBook } from '../../../domain/books';
import { useLibrary } from '../../../state/useLibrary';
import { cornerSelection, seatParticipants, sessionMinutes } from '../connections';
import { useCommunity } from '../hooks/useCommunity';
import { fetchProfiles } from '../services/community';
import { fetchActivity, fetchCorner, saveCorner } from '../services/connections';
import { sitDownNow, standUpNow, usePresence } from '../hooks/usePresence';
import { ReaderProfileView } from './ReaderProfile';
import { warmVisit } from '../visitScene';
import { SectionIcon } from '../../../components/SectionIcon';
import { CollectionsEditor, HuellasEditor } from './HuellasEditor';

function Gate({ community, children }) {
  if (community.status !== 'ready') return <p className="social-note">Abre «Mi Perfil & Avatar» para empezar.</p>;
  if (!community.member) return <p className="social-note">Activa «Participar en la comunidad» en «Mi Perfil & Avatar» para usar esta sección.</p>;
  return children;
}

/** Mi rincón: selección voluntaria de lo que otras personas pueden ver. */
export function CornerTab() {
  const community = useCommunity({ autoload: true });
  const { state } = useLibrary();
  const catalog = useFigureCatalog();
  const owned = state.progress.figures?.owned ?? {};
  const [form, setForm] = useState(null);
  const [message, setMessage] = useState('');
  const [failure, setFailure] = useState('');
  const [saving, setSaving] = useState(false);
  const ready = community.status === 'ready' && community.member;

  useEffect(() => {
    if (!ready) return undefined;
    let alive = true;
    fetchCorner(community.userId)
      .then((c) => {
        if (!alive) return;
        setForm({
          visible: Boolean(c?.visible),
          books: (c?.featured_books ?? []).map((b) => b.id),
          figures: c?.figure_ids ?? [],
          guardian: c?.guardian_id ?? null,
          showCurrent: Boolean(c?.show_current),
        });
      })
      .catch((e) => alive && setFailure(e.message));
    return () => {
      alive = false;
    };
  }, [ready, community.userId]);

  if (!ready || !form) return <Gate community={community}>{failure ? <p className="social-error">{failure}</p> : <p className="social-note">Abriendo tu rincón…</p>}</Gate>;
  const reading = currentBook(state.books, state.settings);
  const toggleIn = (key, id, max) => setForm((f) => ({ ...f, [key]: f[key].includes(id) ? f[key].filter((x) => x !== id) : f[key].length < max ? [...f[key], id] : f[key] }));
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFailure('');
    setMessage('');
    try {
      const sel = cornerSelection({ books: state.books.filter((b) => form.books.includes(b.id)), figures: form.figures, owned, guardian: form.guardian, showCurrent: form.showCurrent, currentTitle: reading?.title ?? '' });
      await saveCorner(community.userId, { visible: form.visible, ...sel });
      setMessage(form.visible ? 'Tu rincón está a la vista de la comunidad.' : 'Tu rincón está oculto.');
    } catch (e) {
      setFailure(e.message);
    } finally {
      setSaving(false);
    }
  };
  const ownedFigures = catalog.filter((f) => owned[f.id]);

  return (
    <>
    <form className="profile-form" onSubmit={save} noValidate>
      <p className="social-note">Elige qué pueden ver otras personas. Tu biblioteca, tus notas y tus avances siguen siendo privados.</p>
      <label className="social-check">
        <input type="checkbox" checked={form.visible} onChange={(e) => setForm((f) => ({ ...f, visible: e.target.checked }))} />
        <span>Mostrar mi rincón a la comunidad</span>
      </label>
      <fieldset className="corner-pick">
        <legend>Hasta 3 libros destacados</legend>
        {state.books.slice(0, 60).map((b) => (
          <label key={b.id} className="social-check">
            <input type="checkbox" checked={form.books.includes(b.id)} disabled={!form.books.includes(b.id) && form.books.length >= 3} onChange={() => toggleIn('books', b.id, 3)} />
            <span>
              {b.title} <small>· {b.author}</small>
            </span>
          </label>
        ))}
      </fieldset>
      <fieldset className="corner-pick">
        <legend>Hasta 3 figuras desbloqueadas</legend>
        {ownedFigures.length === 0 && <p className="social-note">Aún no tienes figuras desbloqueadas.</p>}
        {ownedFigures.map((f) => (
          <label key={f.id} className="social-check">
            <input type="checkbox" checked={form.figures.includes(f.id)} disabled={!form.figures.includes(f.id) && form.figures.length >= 3} onChange={() => toggleIn('figures', f.id, 3)} />
            <span>{f.name}</span>
          </label>
        ))}
      </fieldset>
      {ownedFigures.length > 0 && (
        <label>
          <span>Guardián expuesto (en el reposabrazos de tu sillón)</span>
          <select className="social-input" value={form.guardian ?? ''} onChange={(e) => setForm((f) => ({ ...f, guardian: e.target.value || null }))}>
            <option value="">Ninguno</option>
            {ownedFigures.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="social-check">
        <input type="checkbox" checked={form.showCurrent} disabled={!reading} onChange={(e) => setForm((f) => ({ ...f, showCurrent: e.target.checked }))} />
        <span>Mostrar lo que estoy leyendo ahora{reading ? ` («${reading.title}»)` : ''}</span>
      </label>
      {failure && (
        <p className="social-error" role="alert">
          {failure}
        </p>
      )}
      <div className="social-actions">
        <button type="submit" className="social-btn social-btn--primary" disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar mi rincón'}
        </button>
        <span role="status">{message}</span>
      </div>
    </form>
    <HuellasEditor />
    <CollectionsEditor />
    </>
  );
}

/** Lectores que sigo y su actividad: reseñas publicadas por ellos y novedades de mis clubes. */
export function ReadersTab({ onVisit = null }) {
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
      <section aria-label="Actividad" className="readers">
        <h3 className="social-title">Actividad</h3>
        {activity === null && !failure && (
          <p className="social-note" role="status">
            Cargando su actividad…
          </p>
        )}
        {activity && activity.reviews.length === 0 && activity.clubs.length === 0 && <p className="social-note">Nada nuevo por aquí.</p>}
        <ul className="reader-rows">
          {activity?.reviews.map((r) => {
            const alias = profiles[r.user_id]?.alias ?? 'Lector';
            // Portada: la de tu ejemplar si es la misma obra; si no, la cubierta tipográfica del resolvedor de siempre
            const mineCopy = r.work ? state.books.find((b) => b.workId === r.work.id) : null;
            const cover = { id: r.work?.id ?? r.id, title: r.work?.title ?? 'Obra', author: r.work?.author ?? '', cover: mineCopy?.cover ?? '' };
            return (
              <li key={r.id}>
                <button type="button" className="activity-card" onClick={() => setViewing(r.user_id)} aria-label={`Opinión de ${alias}${r.work ? ` sobre «${r.work.title}»` : ''}. Abrir su rincón`}>
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
                      <ReaderAvatar avatarId={profiles[r.user_id]?.avatar_id} alias={alias} size="review" decorative />
                      <span className="activity-card__alias">{alias}</span>
                      {r.rating_quarters != null && <RatingStars value={r.rating_quarters / 4} />}
                    </span>
                    {r.has_spoilers ? <em>Contiene spoilers</em> : r.body && <span className="activity-card__excerpt">{r.body}</span>}
                  </span>
                </button>
              </li>
            );
          })}
          {/* Clubes: el tipo («Club de lectura») va aparte del nombre que puso su creador, sin tocarlo */}
          {activity?.clubs.map((c) => (
            <li key={c.id} className="activity-club">
              <SectionIcon name="club" size={32} className="activity-club__icon" />
              <span className="activity-club__kind">Club de lectura</span>
              <b>{c.name}</b>
              {c.status === 'archived' ? <small>Archivado</small> : c.discussion_point ? <small>{c.discussion_point}</small> : null}
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
