// «Tu cuenta» (SPEC §9ter, 1.16.0): entrar con correo y contraseña, estado de la sincronización, elección
// cuando hay dos versiones y copias en archivo (exportar / importar). Ficha de papel algodón como los menús.
import { playUiSound } from '../../audio/uiSounds';
import { CloudCheck, CloudOff, Download, KeyRound, LogOut, RefreshCw, Trash2, Upload, UserPlus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { deleteAccount, signIn, signUp } from '../../services/cloud';
import { EDAD_MINIMA, LEGAL, PALABRA_BORRAR } from '../../domain/legal';
import { useCloud } from '../../state/cloudSync';
import { hydrate, useLibrary } from '../../state/useLibrary';
import { MODOS, cambiarModo, liboDe } from '../../features/libo/libo';
import { poseUrl } from '../../features/libo/poses';
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
  const [acepto, setAcepto] = useState(false);
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
      {signup && (
        <label className="account-check account-check--legal">
          <input type="checkbox" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} />
          <span>
            Tengo {EDAD_MINIMA} años o más y acepto las{' '}
            <a href={LEGAL.normas} target="_blank" rel="noopener">
              normas de la comunidad
            </a>{' '}
            y la{' '}
            <a href={LEGAL.privacidad} target="_blank" rel="noopener">
              política de privacidad
            </a>
            .
          </span>
        </label>
      )}
      <button type="submit" className="account-btn account-btn--primary" disabled={busy || !email.includes('@') || password.length < 8 || (signup && !acepto)}>
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
    a.download = `libotown-copia-${new Date().toISOString().slice(0, 10)}.json`;
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
      setMsg('Ese archivo no es una copia de Libotown.');
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
 * Borrar la cuenta (Play Store, docs/qa/play-store.md §2.1). Hay que escribir BORRAR: no se puede deshacer. Lo que dejaste a
 * otros queda como «Lector anónimo» (Francisco, 20-11-2026) y lo de este dispositivo se queda aquí.
 */
function BorrarCuenta({ onBorrada }) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const listo = texto.trim().toUpperCase() === PALABRA_BORRAR;

  const borrar = async (event) => {
    event.preventDefault();
    if (!listo) return;
    setBusy(true);
    setMsg('');
    try {
      await deleteAccount();
      await onBorrada();
    } catch (err) {
      setMsg(/fetch|network/i.test(String(err?.message ?? err)) ? 'No hay conexión: tu cuenta sigue como estaba. Prueba otra vez con red.' : 'No se ha podido borrar la cuenta y no se ha borrado nada. Prueba otra vez.');
      setBusy(false);
    }
  };

  const cerrar = () => {
    setAbierto(false);
    setTexto('');
    setMsg('');
  };

  if (!abierto)
    return (
      <button type="button" className="account-link account-link--danger" onClick={() => setAbierto(true)}>
        Borrar mi cuenta
      </button>
    );
  return (
    <form className="account-delete" onSubmit={borrar} aria-labelledby="account-delete-title">
      <h4 id="account-delete-title">Borrar mi cuenta</h4>
      <ul>
        <li>Se borran tu cuenta, tu copia en la nube, tu perfil, tu piso, tu café y tus partidas. No se puede deshacer.</li>
        <li>Tus reseñas, tus mensajes en clubes, los post-its y dibujos que enviaste y los lomos que dejaste se quedan, pero como «Lector anónimo».</li>
        <li>Tus clubes pasan al miembro más antiguo.</li>
        <li>Lo que hay en este dispositivo se queda aquí hasta que lo borres o desinstales la app. Si quieres conservarlo, exporta una copia antes.</li>
      </ul>
      <label htmlFor="account-delete-word">Escribe {PALABRA_BORRAR} para confirmar</label>
      <input id="account-delete-word" value={texto} onChange={(e) => setTexto(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} />
      <div className="account-row">
        <button type="submit" className="account-btn account-btn--danger" disabled={!listo || busy}>
          <Trash2 aria-hidden="true" /> {busy ? 'Borrando…' : 'Borrar mi cuenta para siempre'}
        </button>
        <button type="button" className="account-btn" disabled={busy} onClick={cerrar}>
          No, volver
        </button>
      </div>
      {msg && (
        <p className="account-error" role="alert">
          {msg}
        </p>
      )}
    </form>
  );
}

/** Privacidad, normas y aviso legal: páginas públicas de libotown.es (las enlaza también la ficha de la Play Store) */
function Legal() {
  return (
    <section className="account-section account-legal">
      <h3>Privacidad y normas</h3>
      <p className="account-row account-legal__links">
        <a href={LEGAL.privacidad} target="_blank" rel="noopener">
          Política de privacidad
        </a>
        <a href={LEGAL.normas} target="_blank" rel="noopener">
          Normas de la comunidad
        </a>
        <a href={LEGAL.avisoLegal} target="_blank" rel="noopener">
          Aviso legal
        </a>
      </p>
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
      <h3>Ambiente</h3>
      <label className="account-check">
        <input type="checkbox" checked={state.settings.bookVibe !== false} onChange={(e) => actions.setSettings({ bookVibe: e.target.checked })} />
        Teñir la luz de la habitación con el tono del libro que leo
      </label>
      <h3>Ayudas visuales</h3>
      <label className="account-range">
        <span>La «!» sobre lo siguiente que hay que tocar (café-librería)</span>
        <select value={state.settings.ayudasCafe ?? 'auto'} onChange={(e) => actions.setSettings({ ayudasCafe: e.target.value })}>
          <option value="auto">Al empezar (niveles 1 y 2) y si me quedo parado</option>
          <option value="siempre">Siempre</option>
          <option value="nunca">Nunca</option>
        </select>
      </label>
    </section>
  );
}

/**
 * Libo, el gato guía (docs/qa/libo.md): cómo se porta. Viaja con tus ajustes. `foco`: se abre desde su bocadillo y la
 * sección se pone a la vista.
 */
function LiboAjustes({ foco = false }) {
  const { state, actions } = useLibrary();
  const { modo } = liboDe(state.settings);
  const ref = useRef(null);
  useEffect(() => {
    if (!foco) return;
    ref.current?.scrollIntoView({ block: 'start' });
    ref.current?.querySelector('input:checked')?.focus({ preventScroll: true });
  }, [foco]);
  return (
    <section ref={ref} className="account-section account-libo" aria-labelledby="account-libo-t">
      <h3 id="account-libo-t">
        <img src={poseUrl(modo === 'llamar' ? 'lee' : modo === 'descansa' ? 'duerme' : 'saluda')} alt="" aria-hidden="true" width="46" height="44" /> Libo, el gato guía
      </h3>
      <fieldset className="account-libo__modos">
        <legend>Cómo se porta Libo</legend>
        {Object.entries(MODOS).map(([id, nombre]) => (
          <label key={id} className="account-check">
            <input type="radio" name="libo-modo" value={id} checked={modo === id} onChange={() => actions.setSettings(cambiarModo(state.settings, id))} />
            {nombre}
          </label>
        ))}
      </fieldset>
      <p className="account-hint">
        {modo === 'sugiere'
          ? 'Te enseña cada sitio la primera vez y te recuerda alguna cosa, como mucho una al día.'
          : modo === 'llamar'
            ? 'Se queda en su esquina y solo habla cuando le tocas.'
            : 'No sale en las esquinas. Puedes despertarle desde aquí cuando quieras.'}
      </p>
    </section>
  );
}

export function AccountPanel({ onClose, onOpenProfile, foco = null }) {
  const cloud = useCloud();
  const [borrada, setBorrada] = useState(false);

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
            {borrada && !cloud.user && (
              <p className="account-hint" role="status">
                Tu cuenta se ha borrado. Lo de este dispositivo sigue aquí: puedes seguir usando Libotown sin cuenta.
              </p>
            )}

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
                <BorrarCuenta
                  onBorrada={async () => {
                    await cloud.signOut();
                    setBorrada(true);
                  }}
                />
              </>
            ) : (
              cloud.status !== 'loading' && <SignIn />
            )}
          </section>
        )}

        {/* Acceso al perfil de la comunidad (el mismo que abre la tablet de la sala social) */}
        {onOpenProfile && (
          <section className="account-section">
            <h3>Mi Perfil & Avatar</h3>
            <p className="account-hint">Tu alias, tu avatar y lo que decidas compartir con otros lectores.</p>
            <button type="button" className="account-btn" onClick={onOpenProfile}>
              Abrir mi perfil
            </button>
          </section>
        )}
        <Backups />
        <UiSound />
        <LiboAjustes foco={foco === 'libo'} />
        <Legal />
      </div>
    </PanelShell>
  );
}
