// Panel de la comunidad (SPEC §25.3): «Mi Perfil & Avatar». Es el único perfil y el único selector de avatar:
// se abre desde «Tu cuenta» y lo reutiliza la tablet de la sala social. Carga bajo demanda.
// 1.60 (SPEC §60): todo el panel va en el cuaderno de cuero con anillas (el mismo recurso que la ficha del libro), con
// pestañas de papel y un título por sección como en las maquetas («Tu perfil lector», «Comunidad», «Entre lectores»).
import { Check } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { NotebookShell } from '../../../components/primitives';
import { ReaderAvatar } from '../../../components/avatars/ReaderAvatar';
import { AVATARS } from '../../../domain/avatars';
import { PanelShell } from '../../../components/panels/PanelShell';
import { ALIAS_MAX, aliasError } from '../../reviews/opinion';
import { useCommunity } from '../hooks/useCommunity';
import { fetchMyBlocks, unblockUser } from '../services/community';
import { ClubTab } from './ClubTab';
import { CornerTab, ReadersTab, RoomTab } from './SocialTabs';

/** Mensaje para cada estado en el que la comunidad aún no se puede usar. */
export function CommunityGate({ status, error, onRetry }) {
  if (status === 'off') return <p className="social-note">Esta versión no tiene la nube configurada: la comunidad necesita una cuenta.</p>;
  if (status === 'signed-out') return <p className="social-note">Para tener perfil y leer opiniones de otras personas, inicia sesión en «Tu cuenta».</p>;
  if (status === 'loading' || status === 'idle') return <p className="social-note">Abriendo tu rincón…</p>;
  if (status === 'unavailable') return <p className="social-note">La comunidad aún no está disponible en este servidor. Tu biblioteca, el calendario y el temporizador siguen funcionando igual.</p>;
  return (
    <div>
      <p className="social-error" role="alert">
        {error || 'No se ha podido abrir la comunidad.'}
      </p>
      <button type="button" className="social-btn" onClick={onRetry}>
        Reintentar
      </button>
    </div>
  );
}

function ProfileTab() {
  const community = useCommunity({ autoload: true });
  const { profile } = community;
  const [alias, setAlias] = useState(profile?.alias ?? '');
  const [avatarId, setAvatarId] = useState(profile?.avatar_id ?? null);
  const [enabled, setEnabled] = useState(Boolean(profile?.community_enabled));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [failure, setFailure] = useState('');

  // Al llegar el perfil del servidor, el formulario parte de él (solo si aún no se ha tocado)
  useEffect(() => {
    if (!profile) return;
    setAlias((a) => a || profile.alias);
    setAvatarId((v) => v ?? profile.avatar_id);
    setEnabled(Boolean(profile.community_enabled));
  }, [profile]);

  if (community.status !== 'ready') return <CommunityGate status={community.status} error={community.error} onRetry={community.load} />;

  const error = aliasError(alias);
  const save = async (event) => {
    event.preventDefault();
    if (error) return;
    setSaving(true);
    setFailure('');
    setMessage('');
    try {
      await community.saveProfile({ alias, avatar_id: avatarId, community_enabled: enabled });
      setMessage('Guardado.');
    } catch (e) {
      setFailure(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="profile-form profile-sheet" onSubmit={save} noValidate>
      {/* Así te verán: avatar grande, alias y la promesa de privacidad */}
      <div className="profile-hero">
        <ReaderAvatar avatarId={avatarId} alias={alias} size="profile" />
        <b className="profile-hero__name">{alias.trim() || 'Tu alias'}</b>
        <p className="profile-hero__note">
          Solo compartes lo que tú eliges.
          <br />
          Tu correo nunca se muestra.
        </p>
      </div>
      <div className="profile-field">
        <label className="profile-heading" htmlFor="profile-alias">
          Alias público
        </label>
        <input id="profile-alias" className="social-input" value={alias} maxLength={ALIAS_MAX} autoComplete="off" onChange={(e) => setAlias(e.target.value)} aria-invalid={Boolean(alias) && Boolean(error)} aria-describedby="profile-alias-help" />
        <small id="profile-alias-help" className="social-note">
          {alias && error ? error : `Entre 2 y ${ALIAS_MAX} caracteres. Elígelo tú: no usamos tu nombre de cuenta.`}
        </small>
      </div>
      <fieldset className="avatar-picker" role="radiogroup" aria-label="Avatar">
        <legend className="profile-heading">Elige tu avatar</legend>
        <div className="avatar-picker__grid">
        {AVATARS.map((a) => (
          <button key={a.id} type="button" role="radio" aria-checked={avatarId === a.id} onClick={() => setAvatarId(a.id)} aria-label={a.label}>
            <span className="avatar-picker__art">
              <ReaderAvatar avatarId={a.id} size="pick" decorative />
              {avatarId === a.id && (
                <span className="avatar-picker__check" aria-hidden="true">
                  <Check />
                </span>
              )}
            </span>
            <span>{a.label}</span>
          </button>
        ))}
        </div>
      </fieldset>
      <label className="social-check profile-join">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        <span>
          <b>Participar en la comunidad</b>
          <small>Otras personas con sesión iniciada podrán ver tu alias, tu avatar y las opiniones que publiques.</small>
        </span>
      </label>
      {failure && (
        <p className="social-error" role="alert">
          {failure}
        </p>
      )}
      <div className="profile-save">
        <button type="submit" className="profile-save__btn" disabled={saving || Boolean(error)}>
          {saving ? 'Guardando…' : 'Guardar perfil'}
        </button>
        <span role="status">{message}</span>
      </div>
      {profile && <BlockedList />}
    </form>
  );
}

/** Personas bloqueadas, con confirmación antes de desbloquear. */
function BlockedList() {
  const [list, setList] = useState(null);
  const [failure, setFailure] = useState('');
  const [confirming, setConfirming] = useState(null);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let alive = true;
    fetchMyBlocks()
      .then((rows) => alive && setList(rows))
      .catch((e) => alive && setFailure(e.message));
    return () => {
      alive = false;
    };
  }, []);
  const unblock = async (person) => {
    setConfirming(null);
    setFailure('');
    try {
      await unblockUser(person.user_id);
      setList((rows) => rows.filter((r) => r.user_id !== person.user_id));
      setNotice(`Has desbloqueado a ${person.alias ?? 'esta persona'}.`);
    } catch (e) {
      setFailure(e.message);
    }
  };
  return (
    <section className="blocked-list" aria-label="Personas bloqueadas">
      <h3>Personas bloqueadas</h3>
      {failure && (
        <p className="social-error" role="alert">
          {failure}
        </p>
      )}
      {notice && (
        <p className="social-note" role="status">
          {notice}
        </p>
      )}
      {list === null && !failure && <p className="social-note">Cargando…</p>}
      {list?.length === 0 && <p className="social-note">No has bloqueado a nadie.</p>}
      {list?.map((person) => {
        const name = person.alias ?? 'Lector bloqueado';
        return (
          <div key={person.user_id} className="blocked-list__row">
            <ReaderAvatar avatarId={person.avatar_id} alias={name} size="list" />
            <b className="blocked-list__name">{name}</b>
            {confirming === person.user_id ? (
              <span className="social-actions" role="alertdialog" aria-label={`Desbloquear a ${name}`}>
                <span>¿Desbloquear? Volveréis a ver vuestras aportaciones.</span>
                <button type="button" className="social-btn social-btn--primary" onClick={() => unblock(person)}>
                  Sí, desbloquear
                </button>
                <button type="button" className="social-btn" onClick={() => setConfirming(null)}>
                  Cancelar
                </button>
              </span>
            ) : (
              <button type="button" className="social-btn" onClick={() => setConfirming(person.user_id)}>
                Desbloquear
              </button>
            )}
          </div>
        );
      })}
    </section>
  );
}

// 1.62 (SPEC §62, decisión de Francisco): tres pestañas principales (Lectores, Salón, Clubes); «Tu perfil lector» y
// «Mi rincón» son hojas propias que se abren desde tu avatar, sin perder ninguna función. Los ids de siempre se
// conservan (enlaces, historial, «Tu cuenta» → perfil).
const TABS = [
  { id: 'lectores', label: 'Lectores', title: 'Entre lectores', Panel: ReadersTab },
  { id: 'sala', label: 'Salón', title: 'Entre lectores', Panel: RoomTab },
  { id: 'club', label: 'Clubes', title: 'Entre lectores', Panel: ClubTab },
];
const OWN = [
  { id: 'perfil', label: 'Mi perfil y avatar', title: 'Tu perfil lector', Panel: ProfileTab },
  { id: 'rincon', label: 'Mi rincón', title: 'Comunidad', Panel: CornerTab },
];

/** Tu avatar en la cabecera: abre «Tu perfil lector» y «Mi rincón» (un menú pequeño; Escape lo cierra). */
function OwnMenu({ onOpen }) {
  const community = useCommunity({ autoload: true });
  const [open, setOpen] = useState(false);
  const btn = useRef(null);
  const profile = community.profile;
  // Escape cierra el menú esté donde esté el foco (WebKit no enfoca el botón al tocarlo); el panel no se cierra
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
      btn.current?.focus();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open]);
  return (
    <div className="social-own" data-escape-local={open ? 'open' : undefined}>
      <button
        ref={btn}
        type="button"
        className="social-own__btn"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Tu perfil y tu rincón"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && open) {
            e.stopPropagation();
            setOpen(false);
          }
        }}
      >
        <ReaderAvatar avatarId={profile?.avatar_id ?? null} alias={profile?.alias ?? ''} size="list" decorative />
      </button>
      {open && (
        <div
          className="social-own__menu"
          role="menu"
          aria-label="Lo tuyo"
          onKeyDown={(e) => {
            if (e.key !== 'Escape') return;
            e.stopPropagation();
            setOpen(false);
            btn.current?.focus();
          }}
        >
          {OWN.map((o) => (
            <button
              key={o.id}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onOpen(o.id);
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * `tab` viene de la ubicación (historial): cambiar de pestaña sustituye la entrada; abrir lo tuyo (perfil, rincón) añade
 * una, así Atrás vuelve a la pestaña de la que venías. Sin `onTab`, la pestaña vive solo aquí (compatibilidad).
 */
export function SocialHub({ onClose, initialTab = 'lectores', timer = null, openClubId = null, onVisit = null, onTab = null, onOpenReader = null }) {
  const valid = (id) => [...TABS, ...OWN].some((t) => t.id === id);
  const [localTab, setLocalTab] = useState(valid(initialTab) ? initialTab : 'lectores');
  const tab = onTab ? (valid(initialTab) ? initialTab : 'lectores') : localTab;
  const go = (id, push = false) => (onTab ? onTab(id, push) : setLocalTab(id));
  // Un club abierto desde «Lectores» (su tarjeta «Entrar») o desde un enlace
  const [clubId, setClubId] = useState(openClubId);
  const current = [...TABS, ...OWN].find((t) => t.id === tab);
  const own = OWN.some((o) => o.id === tab);
  const Current = current.Panel;
  const openClub = (id) => {
    setClubId(id);
    go('club');
  };
  return (
    <PanelShell onClose={onClose} label="Comunidad" variant="social">
      <NotebookShell className="social-hub social-notebook" data-tab={tab}>
        <div className="social-hub__head">
          <OwnMenu onOpen={(id) => go(id, true)} />
          <h2>{current.title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>
        <div className="social-hub__tabs" role="tablist" aria-label="Secciones de la comunidad">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => go(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        {own && (
          <p className="social-own__crumb">
            <button type="button" className="link-btn" onClick={() => go('lectores')}>
              ← Entre lectores
            </button>
          </p>
        )}
        <div className="social-hub__body">
          <Current timer={timer} openClubId={clubId} onVisit={onVisit} onOpenClub={openClub} onOpenReader={onOpenReader} />
        </div>
      </NotebookShell>
    </PanelShell>
  );
}
