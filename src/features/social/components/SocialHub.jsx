// Panel de la comunidad (SPEC §25.3): «Mi Perfil & Avatar». Es el único perfil y el único selector de avatar:
// se abre desde «Tu cuenta» y lo reutiliza la tablet de la sala social. Carga bajo demanda.
import { useEffect, useState } from 'react';
import { ReaderAvatar } from '../../../components/avatars/ReaderAvatar';
import { AVATARS } from '../../../domain/avatars';
import { PanelShell } from '../../../components/panels/PanelShell';
import { ALIAS_MAX, aliasError } from '../../reviews/opinion';
import { useCommunity } from '../hooks/useCommunity';

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
    </form>
  );
}

const TABS = [{ id: 'perfil', label: 'Mi Perfil & Avatar', Panel: ProfileTab }];

export function SocialHub({ onClose, initialTab = 'perfil', extraTabs = [] }) {
  const tabs = [...TABS, ...extraTabs];
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
          <Current />
        </div>
      </div>
    </PanelShell>
  );
}
