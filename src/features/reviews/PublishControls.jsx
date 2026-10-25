// Publicación explícita de una reseña (SPEC §25.5). Guardar la reseña NUNCA publica: «Publicar en mi rincón»
// enseña antes exactamente qué se verá (puntuación, texto, spoilers, impresiones opcionales, alias y avatar) y
// solo entonces envía una copia pública. Editar la reseña privada no cambia lo publicado: se ofrece «Actualizar
// publicación». Retirar no borra la reseña privada. Se reutiliza en la ficha del libro y al terminar una lectura.
import { useState } from 'react';
import { ReaderAvatar } from '../../components/avatars/ReaderAvatar';
import { formatRating } from '../../domain/books';
import { useCommunity } from '../social/hooks/useCommunity';
import { ensureWork, publishReview, withdrawReview } from '../social/services/community';
import { BODY_MAX, IMPRESSIONS, draftDiffers, externalWorkRef, publicCopy } from './opinion';

function ImpressionInput({ dim, value, onChange }) {
  return (
    <div className="impression-row" role="radiogroup" aria-label={`${dim.label}: de ${dim.low.toLowerCase()} a ${dim.high.toLowerCase()}`}>
      <span>
        <b>{dim.label}</b> <small>({dim.low} → {dim.high})</small>
      </span>
      <span className="impression-row__scale">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${dim.label} ${n} de 5`} onClick={() => onChange(value === n ? null : n)}>
            {n}
          </button>
        ))}
      </span>
    </div>
  );
}

export function PublishControls({ book, onUpdate, onOpenProfile }) {
  // Se pide al abrir la ficha (acción del usuario), nunca al abrir la habitación
  const community = useCommunity({ autoload: true });
  // Solo cuenta la publicación hecha con ESTA cuenta (la biblioteca del dispositivo puede venir de otra)
  const pub = book.publicReview && book.publicReview.userId === community.userId ? book.publicReview : null;
  const [preview, setPreview] = useState(false);
  const [impressions, setImpressions] = useState(() => pub?.impressions ?? {});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const copy = publicCopy({ rating: book.rating, body: book.review, spoilers: book.reviewSpoilers, impressions });
  const published = pub?.status === 'published';
  const changed = draftDiffers(book, community.userId);
  const tooLong = (book.review ?? '').length > BODY_MAX;

  const spoilerBox = (
    <label className="social-check">
      <input type="checkbox" checked={Boolean(book.reviewSpoilers)} onChange={(e) => onUpdate({ reviewSpoilers: e.target.checked })} />
      <span>Contiene spoilers</span>
    </label>
  );

  if (community.status !== 'ready' || !community.member) {
    return (
      <div className="publish">
        {spoilerBox}
        {community.status !== 'off' && (
          <p className="social-note">
            Tu reseña es privada.{' '}
            {onOpenProfile && (
              <button type="button" className="spoiler-toggle" onClick={onOpenProfile}>
                Activa la comunidad en «Mi Perfil & Avatar» para poder publicarla
              </button>
            )}
          </p>
        )}
      </div>
    );
  }

  const confirm = async () => {
    setBusy(true);
    setFailure('');
    try {
      const workId = book.workId ?? (await ensureWork({ externalId: externalWorkRef(book), title: book.title, author: book.author }));
      const saved = await publishReview(workId, copy);
      onUpdate({ workId, publicReview: { status: 'published', userId: community.userId, workId, copy, impressions, publishedAt: saved.published_at } });
      setPreview(false);
    } catch (e) {
      setFailure(e.message);
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    setBusy(true);
    setFailure('');
    try {
      await withdrawReview(pub.workId, community.userId);
      onUpdate({ publicReview: { ...pub, status: 'withdrawn' } });
    } catch (e) {
      setFailure(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="publish">
      {spoilerBox}
      {published && <p className="social-note">Publicada en tu rincón{changed ? ' · has cambiado la reseña desde entonces' : ''}.</p>}
      {pub?.status === 'withdrawn' && <p className="social-note">Retiraste la publicación; tu reseña privada sigue aquí.</p>}
      {!preview && (
        <div className="social-actions">
          {(!published || changed) && (
            <button type="button" className="social-btn social-btn--primary" onClick={() => setPreview(true)} disabled={busy || tooLong}>
              {published ? 'Actualizar publicación' : 'Publicar en mi rincón'}
            </button>
          )}
          {published && (
            <button type="button" className="social-btn" onClick={withdraw} disabled={busy}>
              Retirar publicación
            </button>
          )}
        </div>
      )}
      {tooLong && <p className="social-error">La reseña pública admite hasta {BODY_MAX.toLocaleString('es-ES')} caracteres.</p>}
      {preview && (
        <div className="publish__preview" aria-label="Lo que verán otras personas">
          <p className="social-note">
            <b>Esto es exactamente lo que verán otras personas.</b> Tus notas, citas, páginas e historial no se publican.
          </p>
          <div className="profile-form__me">
            <ReaderAvatar avatarId={community.profile.avatar_id} alias={community.profile.alias} size="review" />
            <b>{community.profile.alias}</b>
          </div>
          <dl>
            <dt>Puntuación</dt>
            <dd>{copy.rating_quarters == null ? 'Sin puntuación' : `${formatRating(copy.rating_quarters / 4)} de 5`}</dd>
            <dt>Reseña</dt>
            <dd>{copy.body ? copy.body : 'Sin texto'}</dd>
            <dt>Spoilers</dt>
            <dd>{copy.has_spoilers ? 'Sí: se mostrará plegada' : 'No'}</dd>
          </dl>
          <details>
            <summary className="spoiler-toggle">Impresiones (opcional)</summary>
            {IMPRESSIONS.map((d) => (
              <ImpressionInput key={d.id} dim={d} value={impressions[d.id] ?? null} onChange={(v) => setImpressions((s) => ({ ...s, [d.id]: v }))} />
            ))}
          </details>
          {failure && (
            <p className="social-error" role="alert">
              {failure}
            </p>
          )}
          <div className="social-actions">
            <button type="button" className="social-btn social-btn--primary" onClick={confirm} disabled={busy}>
              {busy ? 'Publicando…' : published ? 'Actualizar' : 'Publicar'}
            </button>
            <button type="button" className="social-btn" onClick={() => setPreview(false)} disabled={busy}>
              Cancelar
            </button>
          </div>
        </div>
      )}
      {!preview && failure && (
        <p className="social-error" role="alert">
          {failure}
        </p>
      )}
    </div>
  );
}
