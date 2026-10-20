// «Tu cuenta» (SPEC §9ter, 1.16.0): entrar con el correo y un código, estado de la sincronización, elección
// cuando hay dos versiones y copias en archivo (exportar / importar). Ficha de papel algodón como los menús.
import { CloudCheck, CloudOff, Download, KeyRound, LogOut, Mail, RefreshCw, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { sendCode, verifyCode } from '../../services/cloud';
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

function SignIn() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('email');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const run = async (fn) => {
    setBusy(true);
    setMsg('');
    try {
      await fn();
    } catch (err) {
      const text = String(err?.message ?? err);
      setMsg(/rate limit|security purposes/i.test(text) ? 'Demasiados intentos seguidos. Espera un poco.' : /expired|invalid/i.test(text) ? 'El código no es válido o ha caducado.' : text);
    } finally {
      setBusy(false);
    }
  };

  if (step === 'email') {
    return (
      <form
        className="account-form"
        onSubmit={(event) => {
          event.preventDefault();
          run(async () => {
            await sendCode(email.trim());
            setStep('code');
          });
        }}
      >
        <label htmlFor="account-email">Tu correo</label>
        <input id="account-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" />
        <button type="submit" className="account-btn account-btn--primary" disabled={busy || !email.includes('@')}>
          <Mail aria-hidden="true" /> Enviarme un código
        </button>
        <p className="account-hint">Sin contraseñas: te llega un código de 6 dígitos para entrar.</p>
        {msg && <p className="account-error" role="alert">{msg}</p>}
      </form>
    );
  }

  return (
    <form
      className="account-form"
      onSubmit={(event) => {
        event.preventDefault();
        run(() => verifyCode(email.trim(), code.trim()));
      }}
    >
      <label htmlFor="account-code">Código enviado a {email}</label>
      <input
        id="account-code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6,8}"
        maxLength={8}
        required
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        placeholder="123456"
      />
      <button type="submit" className="account-btn account-btn--primary" disabled={busy || code.length < 6}>
        <KeyRound aria-hidden="true" /> Entrar
      </button>
      <button type="button" className="account-link" onClick={() => setStep('email')}>
        Cambiar de correo o pedir otro código
      </button>
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
      </div>
    </PanelShell>
  );
}
