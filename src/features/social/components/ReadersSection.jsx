// «Lectores» (1.62, SPEC §62; maqueta material-diseno/social-radio/maquetas/04-comunidad.png): buscador de lectoras y
// lectores, «A quienes sigues» con su avatar (abre su perfil) y «Visitar rincón», y «Lo que comparten»: opiniones
// compactas de quien sigues. La portada y «Leer reseña» abren la ficha pública del libro (la reseña entera, con los
// spoilers ocultos hasta pedirlos, y «Añadir a pendientes» explícito); nunca la ficha de un libro propio. Datos reales,
// estados de carga, error y vacío, y opiniones por páginas.
import { BookOpen, ChevronRight, CirclePlus, EyeOff, Flag, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { RatingStars } from '../../../components/book/Rating';
import { OptionsMenu } from '../../../components/book/Annotations';
import { ReaderAvatar } from '../../../components/avatars/ReaderAvatar';
import { SectionIcon } from '../../../components/SectionIcon';
import { Cover, PhysicalBook } from '../../../components/shelf/BookItem';
import { useLibrary } from '../../../state/useLibrary';
import { ReviewCard } from '../../reviews/ReadersPanel';
import { fetchProfiles, reportContent, searchProfiles } from '../services/community';
import { fetchActivity, fetchMoreActivity } from '../services/connections';
import { warmVisit } from '../visitScene';
import { AddToPending } from './AddToPending';

/** Referencia pública de la obra de una opinión (título y autoría de la comunidad; la portada, la de tu ejemplar). */
const workRef = (r, books) => {
  const mine = r.work ? books.find((b) => b.workId === r.work.id) : null;
  return { id: r.work?.id ?? r.id, work_id: r.work_id ?? r.work?.id ?? null, title: r.work?.title ?? 'Obra', author: r.work?.author ?? '', cover: mine?.cover ?? '' };
};

/**
 * Ficha pública de un libro reseñado: portada, título, autoría, quién lo reseña (su avatar abre su perfil), la reseña
 * entera con la protección de spoilers de siempre y «Añadir a pendientes» (detecta duplicados por la obra).
 */
function PublicBookSheet({ review, author, books, onClose, onOpenReader }) {
  const ref = workRef(review, books);
  const head = useRef(null);
  useEffect(() => {
    head.current?.focus({ preventScroll: true });
  }, []);
  // Escape la cierra esté donde esté el foco (p. ej. tras «Añadir a pendientes», que se sustituye por su aviso)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  const alias = author?.alias ?? 'Lector';
  return (
    <section
      className="public-book"
      role="dialog"
      aria-modal="true"
      aria-label={ref.title}
      data-escape-local="open"
    >
      <header className="public-book__head">
        <button type="button" className="public-book__close" onClick={onClose} aria-label="Volver a lectores">
          <X aria-hidden="true" />
        </button>
        <h3 ref={head} tabIndex={-1}>
          {ref.title}
        </h3>
      </header>
      <div className="public-book__body">
        <div className="public-book__card">
          <span className="public-book__cover" aria-hidden="true">
            <PhysicalBook book={{ id: ref.id, title: ref.title, author: ref.author, cover: ref.cover, editionType: 'hardcover' }} variant="corner" />
          </span>
          <div>
            <p className="public-book__title">{ref.title}</p>
            {ref.author && <p className="public-book__author">{ref.author}</p>}
            <button type="button" className="public-book__who" onClick={() => onOpenReader?.(review.user_id)} disabled={!onOpenReader}>
              <ReaderAvatar avatarId={author?.avatar_id} alias={alias} size="review" decorative />
              <span>Reseña de {alias}</span>
            </button>
          </div>
        </div>
        <AddToPending book={ref} from={{ kind: 'review', ownerAlias: alias }} />
        <ReviewCard review={review} author={author} mine={false} />
      </div>
    </section>
  );
}

/** Una opinión compacta de quien sigues (como en la maqueta): quién, la obra, su valoración y el principio del texto. */
function SharedReview({ review: r, author, books, onRead, onOpenReader }) {
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState('');
  const alias = author?.alias ?? 'Lector';
  const ref = workRef(r, books);
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
    <article className="share-card" aria-label={`Opinión de ${alias}${r.work ? ` sobre «${r.work.title}»` : ''}`}>
      <header className="share-card__head">
        <button type="button" className="share-card__avatar" onClick={() => onOpenReader?.(r.user_id)} aria-label={`Ver el perfil de ${alias}`} disabled={!onOpenReader}>
          <ReaderAvatar avatarId={author?.avatar_id} alias={alias} size="review" decorative />
        </button>
        <span className="share-card__who">
          <b>{alias}</b>
          <small>{r.has_spoilers ? 'ha compartido una reseña' : 'ha reseñado un libro'}</small>
        </span>
        {!confirming && (
          <OptionsMenu
            label={`Opciones de la opinión de ${alias}`}
            items={[
              ...(onOpenReader ? [{ label: 'Ver su perfil', icon: null, onSelect: () => onOpenReader(r.user_id) }] : []),
              { label: 'Denunciar', icon: <Flag aria-hidden="true" />, onSelect: () => setConfirming(true) },
            ]}
          />
        )}
      </header>
      {r.has_spoilers ? (
        <button type="button" className="share-card__spoiler" onClick={onRead}>
          <EyeOff aria-hidden="true" />
          <span>
            <b>Contiene spoilers</b>
            <small>Toca para ver la reseña{r.work ? ` de «${r.work.title}»` : ''}.</small>
          </span>
          <ChevronRight aria-hidden="true" />
        </button>
      ) : (
        <>
          <div className="share-card__book">
            <button type="button" className="share-card__cover" onClick={onRead} aria-label={`Abrir la ficha pública de «${ref.title}»`}>
              <Cover book={ref} />
            </button>
            <div className="share-card__text">
              <b>{ref.title}</b>
              {ref.author && <span className="share-card__author">{ref.author}</span>}
              {r.rating_quarters != null && <RatingStars value={r.rating_quarters / 4} />}
              {r.body && <p className="share-card__excerpt">«{r.body}»</p>}
            </div>
          </div>
          <footer className="share-card__actions">
            <button type="button" className="share-card__action" onClick={onRead}>
              <BookOpen aria-hidden="true" /> Leer reseña
            </button>
            <AddToPending book={ref} from={{ kind: 'review', ownerAlias: alias }} icon={<CirclePlus aria-hidden="true" />} />
          </footer>
        </>
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

/** Una persona (seguida o encontrada): su avatar abre su perfil; «Visitar rincón» abre su casa. */
function Person({ id, profile, onOpenReader, onVisit }) {
  const alias = profile?.alias;
  return (
    <li className="reader-person">
      <button type="button" className="reader-person__open" onClick={() => onOpenReader?.(id)} disabled={!onOpenReader || !alias} aria-label={alias ? `Ver el perfil de ${alias}` : 'Cargando su nombre…'}>
        <ReaderAvatar avatarId={profile?.avatar_id} alias={alias ?? ''} size="profile" decorative />
        {alias ? <span className="reader-person__name">{alias}</span> : <span className="follow-row__name--loading" aria-hidden="true" />}
      </button>
      {onVisit && alias && (
        <button type="button" className="reader-person__visit" onPointerDown={warmVisit} onFocus={warmVisit} onClick={() => onVisit(id)} aria-label={`Visitar el rincón de ${alias}`}>
          Visitar rincón
        </button>
      )}
    </li>
  );
}

export function ReadersSection({ community, onVisit = null, onOpenClub = null, onOpenReader = null }) {
  const { state } = useLibrary();
  const { following, loadFollowing } = community;
  const [profiles, setProfiles] = useState({});
  const [activity, setActivity] = useState(null);
  const [failure, setFailure] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [reading, setReading] = useState(null);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState(null);
  const lastRead = useRef(null);

  useEffect(() => {
    if (following === null) loadFollowing().catch((e) => setFailure(e.message));
  }, [following, loadFollowing]);

  // 1.59 (SPEC §59.9): nombres y actividad en paralelo; de los autores solo se piden los que faltan
  useEffect(() => {
    if (following === null) return undefined;
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
  }, [following]);

  // Búsqueda en la comunidad (a partir de dos letras, con una pausa breve; una respuesta tardía no pisa la última)
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setFound(null);
      return undefined;
    }
    let alive = true;
    const id = setTimeout(() => {
      searchProfiles(term, community.userId)
        .then((rows) => alive && setFound(rows))
        .catch((e) => alive && setFound({ error: e.message }));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [query, community.userId]);

  const more = async () => {
    const last = activity?.reviews.at(-1);
    if (!last) return;
    setLoadingMore(true);
    try {
      const page = await fetchMoreActivity(following, last.published_at);
      const authors = await fetchProfiles(page.reviews.map((r) => r.user_id));
      setProfiles((prev) => ({ ...prev, ...authors }));
      setActivity((a) => ({ ...a, reviews: [...a.reviews, ...page.reviews.filter((r) => !a.reviews.some((x) => x.id === r.id))], more: page.more }));
    } catch (e) {
      setFailure(e.message);
    } finally {
      setLoadingMore(false);
    }
  };

  // La ficha sustituye a la lista (que sigue montada, oculta): al cerrarla vuelven la posición y el foco al botón que la
  // abrió (se guarda el botón, no el foco: WebKit no enfoca los botones al tocarlos)
  const openReview = (r, trigger) => {
    const body = trigger?.closest('.social-hub__body');
    lastRead.current = { trigger, body, top: body?.scrollTop ?? 0 };
    setReading(r);
    if (body) body.scrollTop = 0;
  };
  const closeReview = () => {
    setReading(null);
    requestAnimationFrame(() => {
      const { trigger, body, top } = lastRead.current ?? {};
      if (body) body.scrollTop = top;
      trigger?.focus?.({ preventScroll: true });
    });
  };

  const term = query.trim();
  const followedMatches = term ? (following ?? []).filter((id) => (profiles[id]?.alias ?? '').toLocaleLowerCase('es').includes(term.toLocaleLowerCase('es'))) : following ?? [];

  return (
    <>
    <div className="readers-section" hidden={Boolean(reading)}>
      {failure && (
        <p className="social-error" role="alert">
          {failure}
        </p>
      )}
      <label className="readers-search">
        <Search aria-hidden="true" />
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar lectoras y lectores" aria-label="Buscar lectoras y lectores" autoComplete="off" enterKeyHint="search" />
        {query && (
          <button type="button" onClick={() => setQuery('')} aria-label="Limpiar la búsqueda">
            <X aria-hidden="true" />
          </button>
        )}
      </label>

      {term.length >= 2 && (
        <section aria-label="Resultados de la búsqueda" className="readers">
          <h3 className="social-title">En la comunidad</h3>
          {found === null && <p className="social-note">Buscando…</p>}
          {found?.error && (
            <p className="social-error" role="alert">
              {found.error}
            </p>
          )}
          {Array.isArray(found) && found.length === 0 && <p className="social-note">Nadie con ese alias (o su perfil no es público).</p>}
          {Array.isArray(found) && found.length > 0 && (
            <ul className="reader-people">
              {found.map((p) => (
                <Person key={p.user_id} id={p.user_id} profile={p} onOpenReader={onOpenReader} onVisit={(following ?? []).includes(p.user_id) ? onVisit : null} />
              ))}
            </ul>
          )}
        </section>
      )}

      <section aria-label="Lectores que sigo" className="readers">
        <h3 className="social-title">A quienes sigues</h3>
        {following === null && !failure && <p className="social-note">Cargando…</p>}
        {following?.length === 0 && <p className="social-note">Aún no sigues a nadie. Busca un alias o abre el perfil de quien escribe una reseña para seguirle.</p>}
        {following?.length > 0 && term && followedMatches.length === 0 && <p className="social-note">Ninguna persona que sigues se llama así.</p>}
        <ul className="reader-people">
          {followedMatches.map((id) => (
            <Person key={id} id={id} profile={id in profiles ? profiles[id] : undefined} onOpenReader={onOpenReader} onVisit={onVisit} />
          ))}
        </ul>
      </section>

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
              <SharedReview review={r} author={profiles[r.user_id]} books={state.books} onRead={(e) => openReview(r, e?.currentTarget)} onOpenReader={onOpenReader} />
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
        {activity?.more && (
          <button type="button" className="social-btn readers-more" onClick={more} disabled={loadingMore}>
            {loadingMore ? 'Cargando…' : 'Ver más opiniones'}
          </button>
        )}
      </section>
    </div>
    {/* La ficha va fuera de la lista (oculta mientras tanto): foco y Escape solo en ella */}
    {reading && <PublicBookSheet review={reading} author={profiles[reading.user_id]} books={state.books} onClose={closeReview} onOpenReader={onOpenReader} />}
    </>
  );
}
