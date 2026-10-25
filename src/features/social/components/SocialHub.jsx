// Panel de la comunidad (SPEC §25.3): «Mi Perfil & Avatar». Es el único perfil y el único selector de avatar:
// se abre desde «Tu cuenta» y lo reutiliza la tablet de la sala social. Carga bajo demanda.
import { useEffect, useState } from 'react';
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
    <form className="profile-form" onSubmit={save} noValidate>
      <div className="profile-form__me">
        <ReaderAvatar avatarId={avatarId} alias={alias} size="profile" />
        <div>
          <p className="social-note">Así te verán otras personas de la comunidad: solo tu alias, tu avatar y lo que tú decidas publicar.</p>
          <p className="social-hand">Tu correo nunca se muestra.</p>
        </div>
      </div>
      <div>
        <label htmlFor="profile-alias">Alias público</label>
        <input id="profile-alias" className="social-input" value={alias} maxLength={ALIAS_MAX} autoComplete="off" onChange={(e) => setAlias(e.target.value)} aria-invalid={Boolean(alias) && Boolean(error)} aria-describedby="profile-alias-help" />
        <small id="profile-alias-help" className="social-note">
          {alias && error ? error : `Entre 2 y ${ALIAS_MAX} caracteres. Elígelo tú: no usamos tu nombre de cuenta.`}
        </small>
      </div>
      <fieldset className="avatar-picker" role="radiogroup" aria-label="Avatar">
        <legend>Avatar</legend>
        {AVATARS.map((a) => (
          <button key={a.id} type="button" role="radio" aria-checked={avatarId === a.id} onClick={() => setAvatarId(a.id)} aria-label={a.label}>
            <ReaderAvatar avatarId={a.id} size="list" decorative />
            <span>{a.label}</span>
          </button>
        ))}
      </fieldset>
      <label className="social-check">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        <span>Participar en la comunidad: otras personas con sesión iniciada podrán ver mi alias, mi avatar y las opiniones que yo publique.</span>
      </label>
      {failure && (
        <p className="social-error" role="alert">
          {failure}
        </p>
      )}
      <div className="social-actions">
        <button type="submit" className="social-btn social-btn--primary" disabled={saving || Boolean(error)}>
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

const TABS = [
  { id: 'perfil', label: 'Mi Perfil & Avatar', Panel: ProfileTab },
  { id: 'rincon', label: 'Mi rincón', Panel: CornerTab },
  { id: 'lectores', label: 'Lectores', Panel: ReadersTab },
  { id: 'sala', label: 'En la sala', Panel: RoomTab },
  { id: 'club', label: 'Club', Panel: ClubTab },
];

export function SocialHub({ onClose, initialTab = 'perfil', timer = null, openClubId = null }) {
  const tabs = TABS;
  const [tab, setTab] = useState(tabs.some((t) => t.id === initialTab) ? initialTab : 'perfil');
  const Current = tabs.find((t) => t.id === tab).Panel;
  return (
    <PanelShell onClose={onClose} label="Comunidad" variant="social">
      <div className="social-hub">
        <div className="social-hub__head">
          <h2>Comunidad</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>
        <div className="social-hub__tabs" role="tablist" aria-label="Secciones de la comunidad">
          {tabs.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="social-hub__body">
          <Current timer={timer} openClubId={openClubId} />
        </div>
      </div>
    </PanelShell>
  );
}
