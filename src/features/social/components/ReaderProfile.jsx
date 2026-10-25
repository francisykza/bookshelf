// Perfil autorizado de otro lector (SPEC §25.8, §28.10): 1) rincón ilustrado, 2) avatar con su adorno, nombre,
// rol oficial y seguir, 3) última, actual y próxima lectura, 4) libros que le representan, 5) colecciones y
// reseña destacada, 6) historial de opiniones. Vista de SOLO LECTURA: nada se carga solo en la biblioteca del
// visitante; «Añadir a pendientes» es una acción explícita por libro que guarda en privado su procedencia.
// Seguir, dejar de seguir y bloquear (con confirmación). Nada se inventa para rellenar huecos.
import { Ban, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ReaderAvatar } from '../../../components/avatars/ReaderAvatar';
import { PanelShell } from '../../../components/panels/PanelShell';
import { useFigureCatalog } from '../../../components/figures/figureCatalog';
import { OptionsMenu } from '../../../components/book/Annotations';
import { Cover } from '../../../components/shelf/BookItem';
import { createBook } from '../../../domain/books';
import { useLibrary } from '../../../state/useLibrary';
import { ReviewCard } from '../../reviews/ReadersPanel';
import { DISTINCTIONS, MEMORY_OBJECTS, inLibrary, pendingFromRef, savedCollection, visibleDistinctions } from '../huellas';
import { useCommunity } from '../hooks/useCommunity';
import { blockUser, fetchProfiles } from '../services/community';
import { fetchCorner, fetchReviewsBy } from '../services/connections';
import { fetchAdornments, fetchCollections, fetchCornerExtras, fetchDistinctions } from '../services/huellas';
import { CornerScene, MemoryObject } from './CornerScene';
import { CommunityGate } from './SocialHub';

const longDate = (d) => (d ? new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : null);

/** «Añadir a pendientes»: acción separada por libro; si ya está en tu biblioteca, lo dice. */
function AddToPending({ book, from }) {
  const { state, actions } = useLibrary();
  const [done, setDone] = useState(false);
  const already = inLibrary(state.books, book);
  if (already || done)
    return (
      <span className="huella-added" role="status">
        {done ? 'Añadido a Pendientes' : 'Ya está en tu biblioteca'}
      </span>
    );
  return (
    <button
      type="button"
      className="social-btn"
      onClick={() => {
        actions.addBook(createBook(pendingFromRef(book, from)));
        setDone(true);
      }}
    >
      Añadir a pendientes
    </button>
  );
}

/** Hoja de un recuerdo: su historia (libro y dedicatoria) y añadir el libro a pendientes. */
function MemorySheet({ memory, ownerAlias, onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  const obj = MEMORY_OBJECTS[memory.object];
  return (
    <div className="huella-sheet" role="dialog" aria-modal="false" aria-label={`Recuerdo: ${obj?.name}`}>
      <button type="button" className="huella-sheet__close" onClick={onClose} aria-label="Cerrar el recuerdo" autoFocus>
        <X aria-hidden="true" />
      </button>
      <div className="huella-sheet__object" aria-hidden="true">
        <MemoryObject object={memory.object} />
      </div>
      <div className="huella-sheet__text">
        <h4>Una historia que se quedó</h4>
        <p className="huella-sheet__book">
          {obj?.name} · <b>{memory.book?.title}</b>
          {memory.book?.author && <span>, de {memory.book.author}</span>}
        </p>
        {memory.dedication && <blockquote>«{memory.dedication}»</blockquote>}
        {memory.book && <AddToPending book={memory.book} from={{ kind: 'corner', ownerAlias }} />}
      </div>
    </div>
  );
}

/**
 * Última · Actual · Próxima: tres huecos de portada con la misma proporción y bases alineadas; el título va debajo.
 * La portada sale del resolvedor de siempre (`Cover`): si no hay imagen o falla, cubierta tipográfica con título
 * y autor. Solo se muestran los huecos que la persona eligió (nada se rellena).
 */
function BookTrio({ last, current, next }) {
  const slots = [
    ['Última', last],
    ['Actual', current],
    ['Próxima', next],
  ].filter(([, b]) => b);
  if (!slots.length) return null;
  return (
    <section className="huella-trio" aria-label="Sus lecturas" data-count={slots.length}>
      {slots.map(([label, b]) => (
        <figure key={label} className="huella-trio__item">
          <figcaption>{label}</figcaption>
          <span className="huella-cover" aria-hidden="true">
            <Cover book={{ id: b.id ?? `${label}-${b.title}`, title: b.title, author: b.author ?? '', cover: b.cover ?? '' }} />
          </span>
          <p>
            <b>{b.title}</b>
            {b.author && <small>{b.author}</small>}
          </p>
        </figure>
      ))}
    </section>
  );
}

function CollectionCard({ collection, ownerAlias }) {
  const { state, actions } = useLibrary();
  const [open, setOpen] = useState(false);
  const saved = (state.settings.savedCollections ?? []).some((c) => c.id === collection.id);
  return (
    <article className="huella-collection">
      <header>
        <h5>{collection.title}</h5>
        <p>de {ownerAlias}</p>
      </header>
      <ul className="huella-collection__covers" aria-hidden="true">
        {collection.books.slice(0, 3).map((b) => (
          <li key={b.id}>
            <Cover book={b} />
          </li>
        ))}
      </ul>
      {collection.dedication && <p className="huella-collection__dedication">«{collection.dedication}»</p>}
      <div className="social-actions">
        <button type="button" className="social-btn" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? 'Ocultar libros' : `Ver los ${collection.books.length} libros`}
        </button>
        {/* Guardar la colección es una copia privada: NO añade sus libros a Pendientes */}
        <button
          type="button"
          className="social-btn"
          aria-pressed={saved}
          onClick={() =>
            actions.setSettings({
              savedCollections: saved ? state.settings.savedCollections.filter((c) => c.id !== collection.id) : [...(state.settings.savedCollections ?? []), savedCollection(collection, ownerAlias)],
            })
          }
        >
          {saved ? 'Guardada' : 'Guardar colección'}
        </button>
      </div>
      {open && (
        <ol className="huella-collection__books">
          {collection.books.map((b) => (
            <li key={b.id}>
              <span>
                <b>{b.title}</b> <small>· {b.author}</small>
                {b.phrase && <em>«{b.phrase}»</em>}
              </span>
              <AddToPending book={b} from={{ kind: 'collection', ownerAlias, collectionTitle: collection.title, id: collection.id }} />
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}

/** Insignias: el rol junto al nombre; las distinciones se explican al pulsarlas (significado, origen y fecha). */
function DistinctionBadges({ items, roles }) {
  const [shown, setShown] = useState(null);
  const list = items.filter((d) => Boolean(DISTINCTIONS[d.kind].role) === roles);
  if (!list.length) return null;
  return (
    <span className={roles ? 'huella-roles' : 'huella-awards'}>
      {list.map((d) => {
        const info = DISTINCTIONS[d.kind];
        const key = `${d.kind}-${d.awarded_on ?? ''}`;
        return (
          <span key={key} className="huella-badge-wrap">
            <button type="button" className="huella-badge" data-mark={info.mark} aria-expanded={shown === key} onClick={() => setShown((s) => (s === key ? null : key))}>
              {info.name}
            </button>
            {shown === key && (
              <span className="huella-badge__info" role="note">
                {info.meaning}
                {d.note && <> · {d.note}</>}
                {d.awarded_on && <> · {longDate(d.awarded_on)}</>}
                {roles ? ' · Rol con permisos asignado por el servidor.' : ' · Asignada por el equipo.'}
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

export function ReaderProfileView({ userId, onClose }) {
  const community = useCommunity({ autoload: true });
  const { state } = useLibrary();
  const [data, setData] = useState(null);
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [memory, setMemory] = useState(null);
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
    // Lo de la 1.35.0 es opcional: si el servidor aún no lo tiene, el perfil de siempre sigue funcionando
    const soft = (p, fallback) => p.catch(() => fallback);
    Promise.all([fetchProfiles([userId]), fetchCorner(userId), fetchReviewsBy(userId), soft(fetchCornerExtras(userId), null), soft(fetchAdornments([userId]), {}), soft(fetchCollections(userId), { items: [] }), soft(fetchDistinctions(userId), { rows: [], moderator: false })])
      .then(([profiles, corner, reviews, extras, adornments, collections, distinctions]) =>
        alive && setData({ profile: profiles[userId], corner: corner && extras && !extras.unavailable ? { ...corner, ...extras } : corner, reviews, adornment: adornments[userId] ?? null, collections: collections.items.filter((c) => c.visible || userId === community.userId), distinctions: visibleDistinctions(distinctions.rows, distinctions.moderator) }),
      )
      .catch((e) => alive && setFailure(e.message));
    return () => {
      alive = false;
    };
  }, [ready, userId, community.userId]);

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
  const alias = data.profile.alias;
  const figureId = corner?.figure_ids?.[0] ?? corner?.guardian_id ?? null;
  const figure = figureId ? catalog.find((f) => f.id === figureId) : null;
  // La lectura actual publicada solo trae su título: en tu propio perfil se completa con tu libro (portada y
  // autor); en el de otra persona, el resolvedor de portadas pinta la cubierta tipográfica del título
  const ownCurrent = mine && corner?.current_title ? state.books.find((b) => b.title === corner.current_title) : null;
  const current = corner?.show_current && corner.current_title ? (ownCurrent ? { id: ownCurrent.id, title: ownCurrent.title, author: ownCurrent.author, cover: ownCurrent.cover } : { title: corner.current_title }) : null;
  const featuredReview = data.reviews[0] ?? null;
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
      {/* 1 · Rincón ilustrado */}
      {corner ? <CornerScene corner={corner} figure={figure} ownerAlias={alias} onOpenMemory={setMemory} /> : <p className="social-note">Su rincón no está a la vista.</p>}
      {memory && <MemorySheet memory={memory} ownerAlias={alias} onClose={() => setMemory(null)} />}

      {/* 2 · Avatar (con su adorno cuando exista el arte aprobado), nombre, rol y seguir */}
      <div className="huella-who">
        {/* El adorno es una preferencia guardada (data-adornment); su ilustración aún no existe y no se pinta una rama
            provisional (docs/design/pending). El avatar va solo, sin desplazar el nombre. */}
        <span className="huella-avatar" data-adornment={data.adornment ?? undefined}>
          <ReaderAvatar avatarId={data.profile.avatar_id} alias={alias} size="profile" />
        </span>
        <div className="huella-who__text">
          <h3 className="huella-who__name">
            <span>{alias}</span> <DistinctionBadges items={data.distinctions} roles />
          </h3>
          <DistinctionBadges items={data.distinctions} roles={false} />
          {!mine && (
            <div className="huella-who__actions">
              <button type="button" className={`huella-follow ${isFollowing ? '' : 'huella-follow--primary'}`} aria-pressed={isFollowing} onClick={toggle} disabled={busy || following === null}>
                {isFollowing ? 'Siguiendo' : 'Seguir'}
              </button>
              <OptionsMenu label={`Más opciones sobre ${alias}`} items={[{ label: isFollowing ? 'Dejar de seguir' : 'Seguir', icon: null, onSelect: toggle }, { label: `Bloquear a ${alias}`, icon: <Ban aria-hidden="true" />, danger: true, onSelect: () => setConfirmBlock(true) }]} />
            </div>
          )}
        </div>
      </div>
      {confirmBlock && (
        <div className="social-confirm" role="alertdialog" aria-label={`Bloquear a ${alias}`}>
          <p>¿Bloquear a {alias}? Dejaréis de veros y de seguiros. Puedes deshacerlo en «Mi Perfil & Avatar».</p>
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

      {corner && (
        <>
          {/* 3 · Última, actual y próxima (solo lo que eligió mostrar) */}
          <BookTrio last={corner.last_book} current={current} next={corner.next_book} />

          {/* «Una historia que se quedó»: el primer recuerdo expuesto, con su dedicatoria (si la tiene) */}
          {corner.memories?.[0] && (
            <button type="button" className="huella-story" onClick={() => setMemory(corner.memories[0])}>
              <span className="huella-story__object" aria-hidden="true">
                <MemoryObject object={corner.memories[0].object} />
              </span>
              <span className="huella-story__text">
                <b>Una historia que se quedó</b>
                {corner.memories[0].dedication ? <em>«{corner.memories[0].dedication}»</em> : <em>{corner.memories[0].book?.title}</em>}
              </span>
            </button>
          )}

          {/* 4 · Libros que le representan */}
          {corner.signature_books?.length > 0 && (
            <section aria-label="Libros que le representan">
              <h4>Libros que me representan</h4>
              <ul className="huella-signature">
                {corner.signature_books.map((b) => (
                  <li key={b.id}>
                    <span className="huella-cover" aria-hidden="true">
                      <Cover book={b} />
                    </span>
                    <span>
                      <b>{b.title}</b> <small>{b.author}</small>
                      {b.phrase && <em>«{b.phrase}»</em>}
                    </span>
                    {!mine && <AddToPending book={b} from={{ kind: 'corner', ownerAlias: alias }} />}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {corner.figure_ids?.length > 1 && (
            <section aria-label="Figuras expuestas">
              <h4>Figuras expuestas</h4>
              <ul className="reader-profile__list">
                {corner.figure_ids.map((id) => (
                  <li key={id}>{figureName(id)}</li>
                ))}
              </ul>
            </section>
          )}
          {corner.guardian_id && (
            <p className="social-note">
              Guardián: <b>{figureName(corner.guardian_id)}</b>
            </p>
          )}
        </>
      )}

      {/* 5 · Colecciones y reseña destacada */}
      {data.collections.length > 0 && (
        <section aria-label="Colecciones">
          <h4>Colecciones</h4>
          {data.collections.map((c) => (
            <CollectionCard key={c.id} collection={c} ownerAlias={alias} />
          ))}
        </section>
      )}
      {featuredReview && (
        <section aria-label="Reseña destacada">
          <h4>Reseña destacada</h4>
          {featuredReview.work && <p className="social-hand">{featuredReview.work.title}</p>}
          <ReviewCard review={featuredReview} author={data.profile} mine={mine} />
        </section>
      )}

      {/* 6 · Historial */}
      <section aria-label="Opiniones publicadas">
        <h4>Opiniones publicadas</h4>
        {data.reviews.length === 0 && <p className="social-note">Todavía no ha publicado opiniones.</p>}
        {data.reviews.slice(1).map((r) => (
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
