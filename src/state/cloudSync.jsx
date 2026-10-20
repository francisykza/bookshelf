// Sincronización con la cuenta (SPEC §9ter, 1.16.0). El localStorage sigue siendo la fuente inmediata y la
// app funciona sin conexión; esto sube cada cambio a Supabase unos segundos después, baja lo que otro
// dispositivo haya guardado al volver a la app y, si hay dos versiones distintas, pregunta cuál quedarse.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { cloudEnabled, fetchLibrary, getClient, saveLibrary, signOut as cloudSignOut } from '../services/cloud';
import { DEVICE_SETTINGS, hydrate, useLibrary } from './useLibrary';

const META_KEY = 'bookshelf:sync';
const BACKUP_KEY = 'bookshelf:backup';
const PUSH_DELAY = 3000;
const EMPTY_META = { userId: null, syncedAt: null, dirty: false, at: null };

function readMeta() {
  try {
    return { ...EMPTY_META, ...JSON.parse(localStorage.getItem(META_KEY) ?? 'null') };
  } catch {
    return { ...EMPTY_META };
  }
}

function writeMeta(meta) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    // Sin almacenamiento: la sincronización sigue en memoria durante la sesión.
  }
}

function backup(data, from) {
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify({ from, savedAt: new Date().toISOString(), data }));
  } catch {
    // Si no cabe la copia de seguridad, la elección sigue adelante.
  }
}

/** Lo que se sincroniza: todo menos los ajustes propios del dispositivo. */
function snapshot(state) {
  const settings = { ...state.settings };
  for (const key of DEVICE_SETTINGS) delete settings[key];
  return JSON.stringify({ ...state, settings });
}

/** Resumen para elegir entre dos versiones. */
function summarize(data, updatedAt) {
  const books = Array.isArray(data?.books) ? data.books : [];
  return {
    books: books.length,
    read: books.filter((b) => b.status === 'read').length,
    figures: Object.keys(data?.progress?.figures?.owned ?? {}).length,
    updatedAt,
  };
}

const errorText = (error) => {
  const msg = String(error?.message ?? error ?? '');
  if (/fetch|network/i.test(msg)) return 'No hay conexión con la nube.';
  if (/rate limit|security purposes/i.test(msg)) return 'Demasiados intentos seguidos. Espera un poco y vuelve a probar.';
  if (/jwt|session/i.test(msg)) return 'Tu sesión ha caducado. Vuelve a entrar.';
  return msg || 'Algo ha fallado al sincronizar.';
};

const CloudContext = createContext(null);

export function CloudProvider({ children }) {
  const { state, actions } = useLibrary();
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(cloudEnabled ? 'loading' : 'off');
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(null);
  const [lastSync, setLastSync] = useState(() => readMeta().at);

  const stateRef = useRef(state);
  const metaRef = useRef(readMeta());
  const snapRef = useRef(null);
  const busyRef = useRef(false);
  const againRef = useRef(false);
  const syncRef = useRef(null);
  if (snapRef.current === null) snapRef.current = snapshot(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const saveMeta = useCallback((patch) => {
    metaRef.current = { ...metaRef.current, ...patch };
    writeMeta(metaRef.current);
  }, []);

  const markSynced = useCallback(
    (userId, syncedAt, snap) => {
      snapRef.current = snap;
      const at = new Date().toISOString();
      saveMeta({ userId, syncedAt, dirty: snapshot(stateRef.current) !== snap, at });
      setLastSync(at);
      setStatus(metaRef.current.dirty ? 'pending' : 'synced');
    },
    [saveMeta],
  );

  /** Aplica la versión de la nube en este dispositivo. */
  const applyRemote = useCallback(
    (u, remote) => {
      const next = hydrate(remote.data);
      actions.replaceState(next);
      markSynced(u.id, remote.updated_at, snapshot(next));
    },
    [actions, markSynced],
  );

  /** Sube lo de este dispositivo; si otro se adelantó, pregunta en vez de pisarlo. */
  const upload = useCallback(
    async (u, expected) => {
      const current = stateRef.current;
      const snap = snapshot(current);
      const syncedAt = await saveLibrary(u.id, current, expected);
      if (syncedAt) {
        markSynced(u.id, syncedAt, snap);
        return;
      }
      const remote = await fetchLibrary(u.id);
      setConflict({ remote, reason: 'both' });
      setStatus('conflict');
    },
    [markSynced],
  );

  const runSync = useCallback(
    async (u) => {
      const remote = await fetchLibrary(u.id);
      const meta = metaRef.current;
      if (meta.userId !== u.id) {
        // Primera vez de este dispositivo con esta cuenta
        if (!remote) return upload(u, null);
        setConflict({ remote, reason: 'first' });
        setStatus('conflict');
        return undefined;
      }
      if (!remote) return upload(u, null);
      if (remote.updated_at !== meta.syncedAt) {
        if (meta.dirty) {
          setConflict({ remote, reason: 'both' });
          setStatus('conflict');
          return undefined;
        }
        applyRemote(u, remote);
        return undefined;
      }
      if (meta.dirty) return upload(u, meta.syncedAt);
      setStatus('synced');
      return undefined;
    },
    [applyRemote, upload],
  );

  const sync = useCallback(
    async (u) => {
      if (!u || conflict) return;
      if (busyRef.current) {
        againRef.current = true;
        return;
      }
      if (!navigator.onLine) {
        setStatus('offline');
        return;
      }
      busyRef.current = true;
      setStatus('syncing');
      setError('');
      try {
        await runSync(u);
      } catch (err) {
        setError(errorText(err));
        setStatus(navigator.onLine ? 'error' : 'offline');
      } finally {
        busyRef.current = false;
        if (againRef.current) {
          againRef.current = false;
          syncRef.current?.(u);
        }
      }
    },
    [conflict, runSync],
  );

  useEffect(() => {
    syncRef.current = sync;
  }, [sync]);

  // Sesión: la que ya hubiera guardada, y los cambios (entrar, salir, renovar el token)
  useEffect(() => {
    if (!cloudEnabled) return undefined;
    let sub = null;
    let alive = true;
    getClient().then(async (sb) => {
      const { data } = await sb.auth.getSession();
      if (!alive) return;
      setUser(data.session?.user ?? null);
      if (!data.session) setStatus('signed-out');
      sub = sb.auth.onAuthStateChange((_event, session) => {
        const next = session?.user ?? null;
        setUser((prev) => (prev?.id === next?.id ? prev : next));
        if (!next) setStatus('signed-out');
      }).data.subscription;
    });
    return () => {
      alive = false;
      sub?.unsubscribe();
    };
  }, []);

  // Al entrar (o al resolverse una elección), sincroniza
  useEffect(() => {
    if (user && !conflict) sync(user);
  }, [user, conflict, sync]);

  // Cada cambio local se sube unos segundos después
  useEffect(() => {
    if (!user || conflict || metaRef.current.userId !== user.id) return undefined;
    if (snapshot(state) === snapRef.current) return undefined;
    saveMeta({ dirty: true });
    setStatus(navigator.onLine ? 'pending' : 'offline');
    const id = setTimeout(() => sync(user), PUSH_DELAY);
    return () => clearTimeout(id);
  }, [state, user, conflict, sync, saveMeta]);

  // Al volver a la app o recuperar la conexión, se baja lo nuevo y se envía lo pendiente
  useEffect(() => {
    if (!user) return undefined;
    const onVisible = () => {
      if (document.visibilityState === 'visible') sync(user);
    };
    const onOnline = () => sync(user);
    const onOffline = () => setStatus('offline');
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [user, sync]);

  // Que el navegador no borre los datos por falta de espacio o de uso
  useEffect(() => {
    navigator.storage?.persist?.().catch(() => {});
  }, []);

  /** Elección ante dos versiones: 'cloud' (la de la cuenta) o 'device' (la de este dispositivo). */
  const resolve = useCallback(
    async (choice) => {
      if (!user || !conflict) return;
      const { remote } = conflict;
      setStatus('syncing');
      setError('');
      try {
        if (choice === 'cloud') {
          backup(stateRef.current, 'device');
          applyRemote(user, remote);
        } else {
          if (remote) backup(remote.data, 'cloud');
          const syncedAt = await saveLibrary(user.id, stateRef.current, remote?.updated_at ?? null);
          if (!syncedAt) throw new Error('Otro dispositivo acaba de guardar. Vuelve a intentarlo.');
          markSynced(user.id, syncedAt, snapshot(stateRef.current));
        }
        setConflict(null);
      } catch (err) {
        setError(errorText(err));
        setStatus('conflict');
      }
    },
    [user, conflict, applyRemote, markSynced],
  );

  const signOut = useCallback(async () => {
    await cloudSignOut();
    saveMeta({ ...EMPTY_META });
    setConflict(null);
    setUser(null);
    setStatus('signed-out');
  }, [saveMeta]);

  const value = useMemo(
    () => ({
      enabled: cloudEnabled,
      user,
      status,
      error,
      lastSync,
      conflict: conflict && {
        reason: conflict.reason,
        cloud: summarize(conflict.remote?.data, conflict.remote?.updated_at),
        device: summarize(state, lastSync),
      },
      syncNow: () => sync(user),
      resolve,
      signOut,
    }),
    [user, status, error, lastSync, conflict, state, sync, resolve, signOut],
  );

  return <CloudContext.Provider value={value}>{children}</CloudContext.Provider>;
}

export function useCloud() {
  const ctx = useContext(CloudContext);
  if (!ctx) throw new Error('useCloud debe usarse dentro de <CloudProvider>');
  return ctx;
}
