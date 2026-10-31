// Perfil autorizado de otro lector (SPEC §25.8, §28.10, §35.3): 1) rincón ilustrado, 2) avatar con su adorno,
// nombre, rol oficial y seguir, 3) lo que está leyendo y, debajo, última y próxima lectura, 4) recuerdos, libros que
// le representan y figuras, 5) colecciones y reseña destacada, 6) historial de opiniones. Vista de SOLO LECTURA: nada se carga solo en la biblioteca del
// visitante; «Añadir a pendientes» es una acción explícita por libro que guarda en privado su procedencia.
// Seguir, dejar de seguir y bloquear (con confirmación). Nada se inventa para rellenar huecos.
import { Ban, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ReaderAvatar } from '../../../components/avatars/ReaderAvatar';
import { PanelShell } from '../../../components/panels/PanelShell';
import { useFigureCatalog } from '../../../components/figures/figureCatalog';
import { OptionsMenu } from '../../../components/book/Annotations';
import { ReaderAdornment } from '../../../components/primitives';
import { Cover, PhysicalBook } from '../../../components/shelf/BookItem';
import { FigureArt } from '../../../components/figures/FigureArt';
import { useLibrary } from '../../../state/useLibrary';
import { ReviewCard } from '../../reviews/ReadersPanel';
import { DISTINCTIONS, MEMORY_OBJECTS, savedCollection } from '../huellas';
import { AddToPending } from './AddToPending';
import { useCommunity } from '../hooks/useCommunity';
import { forgetReaderCorner, useReaderCorner } from '../hooks/useReaderCorner';
import { blockUser } from '../services/community';
import { CornerScene, MemoryObject } from './CornerScene';
import { CommunityGate } from './SocialHub';

const longDate = (d) => (d ? new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : null);

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

/** Libro publicado (solo título, autor y portada) como objeto físico contenido; si no hay imagen, cubierta tipográfica. */
const asBook = (b, key) => ({ id: b.id ?? key, title: b.title, author: b.author ?? '', cover: b.cover ?? '', editionType: 'hardcover' });

/**
 * Lecturas (SPEC §35.3): «Está leyendo» destacada en horizontal y, debajo, «Última lectura» y «Próxima lectura»
 * como dos piezas secundarias. Los títulos pueden ocupar varias líneas. Solo lo que la persona eligió mostrar.
 */
function Readings({ last, current, next }) {
  if (!last && !current && !next) return null;
  const item = (label, b, key) => (
    <figure className="huella-read" data-kind={key}>
      <span className="huella-read__book">
        <PhysicalBook book={asBook(b, key)} variant="corner" />
      </span>
      <figcaption>
        <span className="huella-read__label">{label}</span>
        <b>{b.title}</b>
        {b.author && <small>{b.author}</small>}
      </figcaption>
    </figure>
  );
  return (
    <section className="huella-readings" aria-label="Sus lecturas">
      {current && item('Está leyendo', current, 'current')}
      {(last || next) && (
        <div className="huella-readings__pair">
          {last && item('Última lectura', last, 'last')}
          {next && item('Próxima lectura', next, 'next')}
        </div>
      )}
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
            <button type="button" className="huella-badge" data-mark={info.mark} aria-expanded={shown === key} aria-label={info.name} title={info.name} onClick={() => setShown((s) => (s === key ? null : key))}>
              <img src={info.art} alt="" width="28" height="28" decoding="async" />
            </button>
            {shown === key && (
              <span className="huella-badge__info" role="note">
                <b>{info.name}</b> · {info.meaning}
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
  const ready = community.status === 'ready';
  const { following, loadFollowing } = community;
  // 1.58 (§56): la carga autorizada es la misma que usa la visita; al cambiar de persona no queda nada de la anterior
  const { data, failure } = useReaderCorner(userId, community);

  useEffect(() => {
    if (ready && following === null) loadFollowing().catch(() => {});
  }, [ready, following, loadFollowing]);

  if (!ready) return <CommunityGate status={community.status} error={community.error} onRetry={community.load} />;
  if (failure)
    return (
      <p className="social-error" role="alert">
        {failure}
      </p>
    );
  if (!data) return <p className="social-note">Abriendo su rincón…</p>;
  if (!data.profile) return <p className="social-note">Este perfil no está disponible.</p>;
  return (
    <ReaderProfileContent
      data={data}
      userId={userId}
      mine={userId === community.userId}
      following={following}
      onToggleFollow={(next) => community.setFollow(userId, next)}
      onBlock={async () => {
        await blockUser(userId);
        forgetReaderCorner(userId);
        onClose?.();
      }}
    />
  );
}

/**
 * Presentación del rincón con los datos ya cargados (y ya filtrados por su visibilidad en el servidor). No consulta
 * nada: lo que no viene en `data` no se pinta.
 */
export function ReaderProfileContent({ data, userId, mine, following, onToggleFollow, onBlock }) {
  const { state } = useLibrary();
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [memory, setMemory] = useState(null);
  // Nombres de las figuras del catálogo público (las expuestas son de la colección de su dueño)
  const catalog = useFigureCatalog();
  const figureOf = (id) => catalog.find((f) => f.id === id) ?? null;
  const figureName = (id) => figureOf(id)?.name ?? 'Figura de coleccionista';

  const isFollowing = following?.includes(userId) ?? false;
  const corner = data.corner?.visible || mine ? data.corner : null;
  const alias = data.profile.alias;
  // Solo figuras del catálogo vigente (las retiradas de un rincón antiguo no se muestran)
  const figure = [...(corner?.figure_ids ?? []), corner?.guardian_id].map((id) => (id ? figureOf(id) : null)).find(Boolean) ?? null;
  // La lectura actual publicada solo trae su título: en tu propio perfil se completa con tu libro (portada y
  // autor); en el de otra persona, el resolvedor de portadas pinta la cubierta tipográfica del título
  const ownCurrent = mine && corner?.current_title ? state.books.find((b) => b.title === corner.current_title) : null;
  const current = corner?.show_current && corner.current_title ? (ownCurrent ? { id: ownCurrent.id, title: ownCurrent.title, author: ownCurrent.author, cover: ownCurrent.cover } : { title: corner.current_title }) : null;
  const featuredReview = data.reviews[0] ?? null;
  const toggle = async () => {
    setBusy(true);
    setFailure('');
    try {
      await onToggleFollow(!isFollowing);
    } catch (e) {
      setFailure(e.message);
    } finally {
      setBusy(false);
    }
  };
  const shownFigures = (corner?.figure_ids ?? []).map(figureOf).filter(Boolean);

  return (
    <div className="reader-profile">
      {/* 1 · Rincón ilustrado (sin placa encima de la mesa: los recuerdos tienen su sección más abajo) */}
      {corner ? <CornerScene corner={corner} figure={figure} ownerAlias={alias} onOpenMemory={setMemory} /> : <p className="social-note">Su rincón no está a la vista.</p>}
      {memory && <MemorySheet memory={memory} ownerAlias={alias} onClose={() => setMemory(null)} />}

      {/* 2 · Avatar (con su adorno cuando exista el arte aprobado) junto al nombre, rol y seguir */}
      <div className="huella-who">
        <span className="huella-avatar" data-adornment={data.adornment ?? undefined}>
          <ReaderAvatar avatarId={data.profile.avatar_id} alias={alias} size="profile" />
          {data.adornment && <ReaderAdornment id={data.adornment} />}
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
      {failure && (
        <p className="social-error" role="alert">
          {failure}
        </p>
      )}
      {confirmBlock && (
        <div className="social-confirm" role="alertdialog" aria-label={`Bloquear a ${alias}`}>
          <p>¿Bloquear a {alias}? Dejaréis de veros y de seguiros. Puedes deshacerlo en «Mi Perfil & Avatar».</p>
          <div className="social-actions">
            <button type="button" className="social-btn social-btn--primary" onClick={onBlock}>
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
          {/* 3 · Está leyendo y, debajo, última y próxima (solo lo que eligió mostrar) */}
          <Readings last={corner.last_book} current={current} next={corner.next_book} />

          {/* 4 · Recuerdos: objeto, frase y libro, compactos; cada uno abre su historia */}
          {corner.memories?.length > 0 && (
            <section className="huella-memories" aria-label="Recuerdos que se quedan">
              <h4>Recuerdos que se quedan</h4>
              <ul>
                {corner.memories.map((m) => (
                  <li key={m.id}>
                    <button type="button" className="huella-memory" onClick={() => setMemory(m)}>
                      <span className="huella-memory__object" aria-hidden="true">
                        <MemoryObject object={m.object} />
                      </span>
                      <span className="huella-memory__text">
                        {m.dedication && <em>«{m.dedication}»</em>}
                        <span>{m.book?.title ?? MEMORY_OBJECTS[m.object]?.name}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

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
          {shownFigures.length > 1 && (
            <section className="huella-figures" aria-label="Figuras expuestas">
              <h4>Figuras expuestas</h4>
              <ul>
                {shownFigures.map((fig) => (
                  <li key={fig.id}>
                    <span className="huella-figures__art" aria-hidden="true">
                      <FigureArt fig={fig} display="box" />
                    </span>
                    <span>{fig.name}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {corner.guardian_id && figureOf(corner.guardian_id) && (
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
