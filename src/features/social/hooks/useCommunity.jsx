// Estado de la comunidad (SPEC §25.3): un único perfil compartido por todas sus representaciones (perfil,
// reseñas, sillones), cargado bajo demanda —no al abrir la habitación— y reiniciado al cambiar de cuenta o
// cerrar sesión (con la caché social). Un fallo social nunca afecta a la biblioteca, el calendario o el reloj.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useCloud } from '../../../state/cloudSync';
import { clearSocialCache, fetchMyProfile, probeCommunity, saveMyProfile } from '../services/community';

const CommunityContext = createContext(null);

/**
 * `status`: 'off' (sin nube), 'signed-out', 'idle' (aún no se ha pedido), 'loading', 'unavailable' (falta la
 * migración en el servidor), 'ready' o 'error'. `profile`: el propio (null si aún no existe).
 */
export function CommunityProvider({ children }) {
  const cloud = useCloud();
  const userId = cloud.user?.id ?? null;
  const [state, setState] = useState({ status: 'idle', profile: null, error: '' });
  const wanted = useRef(false);
  const seq = useRef(0);

  // Cambio de cuenta o cierre de sesión: fuera todo lo del usuario anterior
  useEffect(() => {
    clearSocialCache(userId);
    seq.current += 1;
    setState({ status: 'idle', profile: null, error: '' });
    if (userId && wanted.current) setTimeout(() => load(), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const load = useCallback(async () => {
    wanted.current = true;
    if (!cloud.enabled || !userId) return;
    const mine = ++seq.current;
    setState((s) => ({ ...s, status: s.status === 'ready' ? 'ready' : 'loading', error: '' }));
    try {
      await probeCommunity();
      const profile = await fetchMyProfile(userId);
      if (mine === seq.current) setState({ status: 'ready', profile, error: '' });
    } catch (e) {
      if (mine === seq.current) setState((s) => ({ ...s, status: e.code === 'unavailable' ? 'unavailable' : 'error', error: e.message }));
    }
  }, [cloud.enabled, userId]);

  const saveProfile = useCallback(
    async (patch) => {
      const profile = await saveMyProfile(userId, patch);
      setState({ status: 'ready', profile, error: '' });
      return profile;
    },
    [userId],
  );

  const value = useMemo(() => {
    const status = !cloud.enabled ? 'off' : !userId ? (cloud.status === 'loading' ? 'loading' : 'signed-out') : state.status;
    return { status, userId, profile: state.profile, error: state.error, load, saveProfile, member: Boolean(state.profile?.community_enabled) };
  }, [cloud.enabled, cloud.status, userId, state, load, saveProfile]);

  return <CommunityContext.Provider value={value}>{children}</CommunityContext.Provider>;
}

/** El estado de la comunidad; `autoload` lo pide al montar (solo componentes sociales). */
export function useCommunity({ autoload = false } = {}) {
  const ctx = useContext(CommunityContext);
  if (!ctx) throw new Error('useCommunity debe usarse dentro de <CommunityProvider>');
  const { status, load } = ctx;
  useEffect(() => {
    if (autoload && status === 'idle') load();
  }, [autoload, status, load]);
  return ctx;
}
