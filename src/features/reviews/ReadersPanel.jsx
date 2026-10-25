// «Voces de lectores» (SPEC §25.6): opiniones públicas de una obra con estadísticas reales del servidor. Media
// con un decimal, número de personas, desglose bajo demanda, impresiones con su propio recuento y reseñas de 20 en
// 20 en orden estable. Spoilers plegados. Texto siempre como texto (sin HTML). Carga bajo demanda.
import { useCallback, useEffect, useState } from 'react';
import { ReaderAvatar } from '../../components/avatars/ReaderAvatar';
import { RatingStars } from '../../components/book/Rating';
import { CommunityGate } from '../social/components/SocialHub';
import { useCommunity } from '../social/hooks/useCommunity';
import { PAGE_SIZE, blockUser, fetchProfiles, fetchReviews, fetchStats, reportContent } from '../social/services/community';
import { fromQuarters, statsView } from './opinion';

const fmtDate = (iso) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

export function ReviewCard({ review, author, mine, onBlock, onReport }) {
  const [open, setOpen] = useState(!review.has_spoilers);
  const rating = fromQuarters(review.rating_quarters);
  const alias = author?.alias ?? 'Lector';
  return (
    <article className="review-card">
      <div className="review-card__head">
        <ReaderAvatar avatarId={author?.avatar_id} alias={alias} size="review" />
        <div className="review-card__who">
          <b>{alias}</b>
          <small>{fmtDate(review.published_at)}</small>
        </div>
        {rating != null && <RatingStars value={rating} />}
      </div>
      {review.body &&
        (open ? (
          <p className="review-card__body">{review.body}</p>
        ) : (
          <button type="button" className="spoiler-toggle" onClick={() => setOpen(true)}>
            Contiene spoilers · Mostrar la reseña
          </button>
        ))}
      {!mine && (onBlock || onReport) && (
        <div className="review-card__menu">
          {onReport && (
            <button type="button" onClick={() => onReport(review)}>
              Denunciar
            </button>
          )}
          {onBlock && (
            <button type="button" onClick={() => onBlock(review.user_id)}>
              Bloquear a {alias}
            </button>
          )}
        </div>
      )}
    </article>
  );
}

/**
 * `workId`: obra de la comunidad (null si el libro aún no se ha publicado nunca y no tiene referencia externa
 * resuelta). `following`: ids seguidos (entrega 3) o null si la función no está disponible.
 */
export function ReadersPanel({ workId, following = null }) {
  const community = useCommunity({ autoload: true });
  const [stats, setStats] = useState(null);
  const [items, setItems] = useState([]);
  const [authors, setAuthors] = useState({});
  const [phase, setPhase] = useState('idle');
  const [failure, setFailure] = useState('');
  const [more, setMore] = useState(false);
  const [onlyFollowing, setOnlyFollowing] = useState(false);
  const [showBands, setShowBands] = useState(false);
  const [notice, setNotice] = useState('');

  const ready = community.status === 'ready';
  const loadPage = useCallback(
    async (cursor) => {
      const page = await fetchReviews(workId, { cursor, authors: onlyFollowing ? following : null });
      const profiles = await fetchProfiles(page.map((r) => r.user_id));
      setAuthors((a) => ({ ...a, ...profiles }));
      setItems((list) => (cursor ? [...list, ...page] : page));
      setMore(page.length === PAGE_SIZE);
    },
    [workId, onlyFollowing, following],
  );

  useEffect(() => {
    if (!ready || !workId) return undefined;
    let alive = true;
    setPhase((p) => (p === 'ok' ? 'refreshing' : 'loading'));
    setFailure('');
    Promise.all([fetchStats(workId, { fresh: true }), loadPage(null)])
      .then(([s]) => alive && (setStats(s), setPhase('ok')))
      .catch((e) => alive && (setFailure(e.message), setPhase('error')));
    return () => {
      alive = false;
    };
  }, [ready, workId, loadPage]);

  if (!ready) return <CommunityGate status={community.status} error={community.error} onRetry={community.load} />;
  const view = statsView(stats);
  const maxBand = Math.max(1, ...view.bands.map((b) => b.count));

  return (
    <section className="readers" aria-label="Voces de lectores">
      <div className="readers__summary">
        {view.average != null && <span className="readers__average">{view.averageText}</span>}
        <p className="readers__headline">{workId ? view.headline : 'Esta historia todavía espera su primera opinión'}</p>
      </div>
      {view.ratings > 0 && (
        <div>
          <button type="button" className="spoiler-toggle" aria-expanded={showBands} onClick={() => setShowBands((v) => !v)}>
            {showBands ? 'Ocultar el desglose' : 'Ver el desglose de puntuaciones'}
          </button>
          {showBands && (
            <ul className="readers__bands" aria-label="Puntuaciones por intervalos de cuartos de estrella">
              {view.bands.map((b) => (
                <li key={b.id}>
                  <span>{b.label}</span>
                  <span className="readers__bar">
                    <i style={{ width: `${(b.count / maxBand) * 100}%` }} />
                  </span>
                  <span className="readers__count">{b.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {view.impressions.some((d) => d.n > 0) && (
        <ul className="readers__impressions" aria-label="Impresiones de los lectores">
          {view.impressions.map((d) => (
            <li key={d.id}>
              <span>{d.label}</span>
              <span className="readers__bar" title={`${d.low} → ${d.high}`}>
                <i style={{ width: d.average == null ? 0 : `${((d.average - 1) / 4) * 100}%` }} />
              </span>
              <span className="readers__count">{d.n} {d.n === 1 ? 'respuesta' : 'respuestas'}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="readers__filters" role="group" aria-label="Qué opiniones ver">
        <button type="button" aria-pressed={!onlyFollowing} onClick={() => setOnlyFollowing(false)}>
          Todas
        </button>
        <button type="button" aria-pressed={onlyFollowing} disabled={!following} onClick={() => setOnlyFollowing(true)} title={following ? undefined : 'Disponible al seguir a otros lectores'}>
          Lectores que sigo
        </button>
      </div>
      {phase === 'loading' && <p className="social-note">Buscando opiniones…</p>}
      {phase === 'error' && (
        <p className="social-error" role="alert">
          {failure}
        </p>
      )}
      {notice && <p role="status" className="social-note">{notice}</p>}
      {phase !== 'loading' && phase !== 'error' && items.length === 0 && workId && <p className="social-note">Todavía no hay reseñas publicadas{onlyFollowing ? ' de lectores que sigues' : ''}.</p>}
      {items.map((r) => (
        <ReviewCard
          key={r.id}
          review={r}
          author={authors[r.user_id]}
          mine={r.user_id === community.userId}
          onReport={async (rev) => {
            await reportContent('review', rev.id, 'Denuncia desde Voces de lectores');
            setNotice('Gracias: la denuncia llega solo a moderación.');
          }}
          onBlock={async (uid) => {
            await blockUser(uid);
            setItems((list) => list.filter((x) => x.user_id !== uid));
            setNotice('Has bloqueado a esta persona: ya no verás sus aportaciones.');
          }}
        />
      ))}
      {more && (
        <button type="button" className="social-btn" onClick={() => loadPage(items.at(-1))}>
          Ver más opiniones
        </button>
      )}
    </section>
  );
}
