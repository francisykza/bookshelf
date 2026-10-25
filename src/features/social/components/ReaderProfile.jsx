// Perfil autorizado de otro lector (SPEC §25.8): alias, avatar, su rincón si lo ha hecho visible (hasta 3 libros,
// 3 figuras desbloqueadas, Guardián y lectura actual solo si lo activó) y sus opiniones publicadas. Vista de SOLO
// LECTURA: no carga nada en la biblioteca del visitante ni permite acciones sobre la cuenta visitada. Seguir,
// dejar de seguir y bloquear (con confirmación).
import { useEffect, useState } from 'react';
import { ReaderAvatar } from '../../../components/avatars/ReaderAvatar';
import { PanelShell } from '../../../components/panels/PanelShell';
import { useFigureCatalog } from '../../../components/figures/figureCatalog';
import { ReviewCard } from '../../reviews/ReadersPanel';
import { useCommunity } from '../hooks/useCommunity';
import { blockUser, fetchProfiles } from '../services/community';
import { fetchCorner, fetchReviewsBy } from '../services/connections';
import { CommunityGate } from './SocialHub';

export function ReaderProfileView({ userId, onClose }) {
  const community = useCommunity({ autoload: true });
  const [data, setData] = useState(null);
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const ready = community.status === 'ready';
  const { following, loadFollowing } = community;
  // Nombres de las figuras del catálogo público (las expuestas son de la colección de su dueño)
  const catalog = useFigureCatalog();
  const figureName = (id) => catalog.find((f) => f.id === id)?.name ?? 'Figura de coleccionista';

  useEffect(() => {
    if (ready && following === null) loadFollowing().catch(() => {});
  }, [ready, following, loadFollowing]);

  useEffect(() => {
    if (!ready) return undefined;
    let alive = true;
    Promise.all([fetchProfiles([userId]), fetchCorner(userId), fetchReviewsBy(userId)])
      .then(([profiles, corner, reviews]) => alive && setData({ profile: profiles[userId], corner, reviews }))
      .catch((e) => alive && setFailure(e.message));
    return () => {
      alive = false;
    };
  }, [ready, userId]);

  if (!ready) return <CommunityGate status={community.status} error={community.error} onRetry={community.load} />;
  if (failure)
    return (
      <p className="social-error" role="alert">
        {failure}
      </p>
    );
  if (!data) return <p className="social-note">Abriendo su rincón…</p>;
  if (!data.profile) return <p className="social-note">Este perfil no está disponible.</p>;

  const mine = userId === community.userId;
  const isFollowing = following?.includes(userId) ?? false;
  const corner = data.corner?.visible || mine ? data.corner : null;
  const toggle = async () => {
    setBusy(true);
    setFailure('');
    try {
      await community.setFollow(userId, !isFollowing);
    } catch (e) {
      setFailure(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="reader-profile">
      <div className="profile-form__me">
        <ReaderAvatar avatarId={data.profile.avatar_id} alias={data.profile.alias} size="profile" />
        <div className="reader-profile__who">
          <h3>{data.profile.alias}</h3>
          {!mine && (
            <div className="social-actions">
              <button type="button" className={`social-btn ${isFollowing ? '' : 'social-btn--primary'}`} aria-pressed={isFollowing} onClick={toggle} disabled={busy || following === null}>
                {isFollowing ? 'Dejar de seguir' : 'Seguir'}
              </button>
              {!confirmBlock && (
                <button type="button" className="social-btn" onClick={() => setConfirmBlock(true)}>
                  Bloquear
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {confirmBlock && (
        <div className="social-confirm" role="alertdialog" aria-label={`Bloquear a ${data.profile.alias}`}>
          <p>¿Bloquear a {data.profile.alias}? Dejaréis de veros y de seguiros. Puedes deshacerlo en «Mi Perfil & Avatar».</p>
          <div className="social-actions">
            <button
              type="button"
              className="social-btn social-btn--primary"
              onClick={async () => {
                await blockUser(userId);
                onClose?.();
              }}
            >
              Sí, bloquear
            </button>
            <button type="button" className="social-btn" onClick={() => setConfirmBlock(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
      {corner ? (
        <section className="reader-profile__corner" aria-label="Su rincón">
          {corner.show_current && corner.current_title && (
            <p className="social-note">
              Leyendo ahora: <b>{corner.current_title}</b>
            </p>
          )}
          {corner.featured_books?.length > 0 && (
            <>
              <h4>Libros destacados</h4>
              <ul className="reader-profile__list">
                {corner.featured_books.map((b) => (
                  <li key={b.id}>
                    <b>{b.title}</b> {b.author && <span>· {b.author}</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
          {corner.figure_ids?.length > 0 && (
            <>
              <h4>Figuras expuestas</h4>
              <ul className="reader-profile__list">
                {corner.figure_ids.map((id) => (
                  <li key={id}>{figureName(id)}</li>
                ))}
              </ul>
            </>
          )}
          {corner.guardian_id && (
            <p className="social-note">
              Guardián: <b>{figureName(corner.guardian_id)}</b>
            </p>
          )}
        </section>
      ) : (
        <p className="social-note">Su rincón no está a la vista.</p>
      )}
      <section aria-label="Opiniones publicadas">
        <h4>Opiniones publicadas</h4>
        {data.reviews.length === 0 && <p className="social-note">Todavía no ha publicado opiniones.</p>}
        {data.reviews.map((r) => (
          <div key={r.id} className="reader-profile__review">
            {r.work && <p className="social-hand">{r.work.title}</p>}
            <ReviewCard review={r} author={data.profile} mine={mine} />
          </div>
        ))}
      </section>
    </div>
  );
}

export function ReaderProfile({ userId, onClose }) {
  return (
    <PanelShell onClose={onClose} label="Perfil de lector" variant="social">
      <div className="social-hub">
        <div className="social-hub__head">
          <h2>Rincón de lector</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>
        <div className="social-hub__body">
          <ReaderProfileView userId={userId} onClose={onClose} />
        </div>
      </div>
    </PanelShell>
  );
}
