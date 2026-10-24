// «Tu cuenta» (SPEC §9ter, 1.16.0): entrar con correo y contraseña, estado de la sincronización, elección
// cuando hay dos versiones y copias en archivo (exportar / importar). Ficha de papel algodón como los menús.
import { playUiSound } from '../../audio/uiSounds';
import { CloudCheck, CloudOff, Download, KeyRound, LogOut, RefreshCw, Upload, UserPlus } from 'lucide-react';
import { useRef, useState } from 'react';
import { signIn, signUp } from '../../services/cloud';
import { useCloud } from '../../state/cloudSync';
import { hydrate, useLibrary } from '../../state/useLibrary';
import { PanelShell } from './PanelShell';

const STATUS_TEXT = {
  loading: 'Comprobando tu sesión…',
  'signed-out': 'Sin cuenta: tus datos viven solo en este dispositivo.',
  syncing: 'Sincronizando…',
  pending: 'Hay cambios por guardar en tu cuenta.',
  synced: 'Todo guardado en tu cuenta.',
  offline: 'Sin conexión: se guardará al volver la red.',
  error: 'No se pudo sincronizar.',
  conflict: 'Hay dos versiones distintas: elige cuál quedarte.',
};

const when = (iso) => {
  if (!iso) return 'nunca';
  const d = new Date(iso);
  return d.toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

function Version({ title, s, onPick, label }) {
  return (
    <div className="account-version">
      <h4>{title}</h4>
      <p>
        {s.books} libros · {s.read} leídos · {s.figures} figuras
      </p>
      <p className="account-version__when">Actualizada: {when(s.updatedAt)}</p>
      <button type="button" className="account-btn" onClick={onPick}>
        {label}
      </button>
    </div>
  );
}

const authError = (text) => {
  if (/invalid login credentials/i.test(text)) return 'Correo o contraseña incorrectos.';
  if (/email not confirmed/i.test(text)) return 'Aún no has confirmado tu correo: abre el enlace que te enviamos y vuelve a entrar.';
  if (/already registered/i.test(text)) return 'Ya hay una cuenta con ese correo. Entra con tu contraseña.';
  if (/password should be|weak/i.test(text)) return 'La contraseña es demasiado corta o sencilla (mínimo 8 caracteres).';
  if (/rate limit|security purposes/i.test(text)) return 'Demasiados intentos seguidos. Espera un poco y vuelve a probar.';
  if (/fetch|network/i.test(text)) return 'No hay conexión con la nube.';
  return text;
};

function SignIn() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [info, setInfo] = useState('');
  const signup = mode === 'signup';

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMsg('');
    setInfo('');
    try {
      if (signup) {
        const inside = await signUp(email.trim(), password);
        if (!inside) {
          setInfo(`Te hemos enviado un correo a ${email.trim()}. Abre el enlace para confirmar tu cuenta y después entra aquí con tu contraseña.`);
          setMode('login');
        }
      } else {
        await signIn(email.trim(), password);
      }
    } catch (err) {
      setMsg(authError(String(err?.message ?? err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="account-form" onSubmit={submit}>
      <label htmlFor="account-email">Correo</label>
      <input id="account-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" />
      <label htmlFor="account-password">Contraseña</label>
      <input
        id="account-password"
        type="password"
        required
        minLength={8}
        autoComplete={signup ? 'new-password' : 'current-password'}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder={signup ? 'Mínimo 8 caracteres' : ''}
      />
      <button type="submit" className="account-btn account-btn--primary" disabled={busy || !email.includes('@') || password.length < 8}>
        {signup ? <UserPlus aria-hidden="true" /> : <KeyRound aria-hidden="true" />} {signup ? 'Crear mi cuenta' : 'Entrar'}
      </button>
      <button
        type="button"
        className="account-link"
        onClick={() => {
          setMode(signup ? 'login' : 'signup');
          setMsg('');
        }}
      >
        {signup ? 'Ya tengo cuenta: entrar' : '¿Primera vez? Crea tu cuenta'}
      </button>
      {info && <p className="account-hint" role="status">{info}</p>}
      {msg && <p className="account-error" role="alert">{msg}</p>}
    </form>
  );
}

function Backups() {
  const { state, actions } = useLibrary();
  const fileRef = useRef(null);
  const [msg, setMsg] = useState('');

  const exportCopy = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bookshelf-copia-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMsg('Copia descargada.');
  };

  const importCopy = async (file) => {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data?.books)) throw new Error();
      const next = hydrate(data);
      if (!window.confirm(`¿Sustituir lo de este dispositivo por la copia (${next.books.length} libros)? Lo actual se perderá si no lo has exportado.`)) return;
      actions.replaceState(next);
      setMsg('Copia importada.');
    } catch {
      setMsg('Ese archivo no es una copia de BookShelf.');
    } finally {
      fileRef.current.value = '';
    }
  };

  return (
    <section className="account-section">
      <h3>Copias en archivo</h3>
      <div className="account-row">
        <button type="button" className="account-btn" onClick={exportCopy}>
          <Download aria-hidden="true" /> Exportar copia
        </button>
        <button type="button" className="account-btn" onClick={() => fileRef.current?.click()}>
          <Upload aria-hidden="true" /> Importar copia
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => importCopy(e.target.files?.[0])} />
      </div>
      {msg && <p className="account-hint" role="status">{msg}</p>}
    </section>
  );
}

/**
 * Sonido de la interfaz (SPEC §17.5): efectos activados y su volumen propio (preferencias de este dispositivo).
 * Arrastrar el volumen no suena; solo «Probar» reproduce una muestra.
 */
function UiSound() {
  const { state, actions } = useLibrary();
  const { sfx, uiVolume = 0.25 } = state.settings;
  const pct = Math.round(uiVolume * 100);
  return (
    <section className="account-section">
      <h3>Sonido de la interfaz</h3>
      <label className="account-check">
        <input type="checkbox" checked={sfx !== false} onChange={(e) => actions.setSettings({ sfx: e.target.checked })} />
        Sonidos al tocar (papel, madera, cerámica…)
      </label>
      <label className="account-range">
        <span>Volumen de los efectos: {pct} %</span>
        <input type="range" min="0" max="100" step="5" value={pct} disabled={sfx === false} onChange={(e) => actions.setSettings({ uiVolume: Number(e.target.value) / 100 })} aria-valuetext={`${pct} %`} />
      </label>
      <div className="account-row">
        <button type="button" className="account-btn" disabled={sfx === false} onClick={() => playUiSound('save')}>
          Probar
        </button>
      </div>
      <p className="account-hint">El sonido ambiental (mar y brisa) se enciende y apaga con los auriculares de la habitación.</p>
    </section>
  );
}

export function AccountPanel({ onClose }) {
  const cloud = useCloud();

  return (
    <PanelShell onClose={onClose} label="Tu cuenta" variant="account">
      <div className="account paper-sheet">
        <div className="account__head">
          <h2>Tu cuenta</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        {!cloud.enabled ? (
          <p className="account-status" data-status="off">
            <CloudOff aria-hidden="true" /> Esta versión no tiene la nube configurada: tus datos viven solo en este dispositivo. Usa las copias para pasarlos a otro.
          </p>
        ) : (
          <section className="account-section">
            <p className="account-status" data-status={cloud.status} role="status">
              {cloud.status === 'synced' ? <CloudCheck aria-hidden="true" /> : cloud.status === 'offline' || cloud.status === 'signed-out' ? <CloudOff aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
              {STATUS_TEXT[cloud.status] ?? ''}
            </p>
            {cloud.error && <p className="account-error" role="alert">{cloud.error}</p>}

            {cloud.user ? (
              <>
                <p className="account-who">
                  Has entrado como <strong>{cloud.user.email}</strong>
                  <br />
                  Última sincronización: {when(cloud.lastSync)}
                </p>
                {cloud.conflict && (
                  <div className="account-conflict">
                    <p>
                      {cloud.conflict.reason === 'first'
                        ? 'Tu cuenta ya tiene datos guardados y este dispositivo tiene los suyos. ¿Con cuáles te quedas?'
                        : 'Otro dispositivo guardó cambios mientras este también cambiaba. ¿Con cuáles te quedas?'}
                    </p>
                    <div className="account-versions">
                      <Version title="En tu cuenta" s={cloud.conflict.cloud} label="Usar estos" onPick={() => cloud.resolve('cloud')} />
                      <Version title="En este dispositivo" s={cloud.conflict.device} label="Subir estos" onPick={() => cloud.resolve('device')} />
                    </div>
                    <p className="account-hint">La versión que descartes se guarda aparte en este dispositivo, por si acaso.</p>
                  </div>
                )}
                <div className="account-row">
                  <button type="button" className="account-btn" onClick={cloud.syncNow} disabled={cloud.status === 'syncing' || Boolean(cloud.conflict)}>
                    <RefreshCw aria-hidden="true" /> Sincronizar ahora
                  </button>
                  <button type="button" className="account-btn" onClick={cloud.signOut}>
                    <LogOut aria-hidden="true" /> Cerrar sesión
                  </button>
                </div>
              </>
            ) : (
              cloud.status !== 'loading' && <SignIn />
            )}
          </section>
        )}

        <Backups />
        <UiSound />
      </div>
    </PanelShell>
  );
}
