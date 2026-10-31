// Carga autorizada del rincón de otra persona (SPEC §35.3, §56), compartida por su perfil y por la visita. Cada carga
// lleva su número: si cambia la persona, la cuenta o se cierra, los datos anteriores se borran AL MOMENTO y cualquier
// respuesta tardía se ignora (nunca se ve el contenido de otra persona mientras carga la siguiente). Lo que el servidor
// no devuelve (RLS, bloqueos, rincón oculto) no existe aquí.
// 1.59 (SPEC §59.9): lo recién cargado se reutiliza un minuto (visita → perfil → visita) en vez de repetir las siete
// consultas; «Reintentar» y bloquear a la persona lo descartan.
import { useCallback, useEffect, useRef, useState } from 'react';
import { visibleDistinctions } from '../huellas';
import { fetchProfiles } from '../services/community';
import { fetchCorner, fetchReviewsBy } from '../services/connections';
import { fetchAdornments, fetchCollections, fetchCornerExtras, fetchDistinctions } from '../services/huellas';

/** Rincones cargados hace poco, por cuenta y persona. Solo en memoria (se pierde al recargar). */
const recent = new Map();
const FRESH_MS = 60_000;

const fresh = (cacheKey) => {
  const hit = recent.get(cacheKey);
  return hit && Date.now() - hit.at < FRESH_MS ? hit.data : null;
};

/** Olvida lo guardado de una persona (al bloquearla) o todo. */
export function forgetReaderCorner(userId) {
  for (const k of [...recent.keys()]) if (!userId || k.endsWith(`:${userId}`)) recent.delete(k);
}

/**
 * `{ status, data, failure, reload }`. `status`: `waiting` (comunidad no lista), `loading`, `error` (red o servidor) o
 * `ready`. Con `ready`, `data.profile` nulo significa «perfil no disponible» (bloqueo, fuera de la comunidad).
 */
export function useReaderCorner(userId, community) {
  const ready = community.status === 'ready';
  const viewer = community.userId;
  const [nonce, setNonce] = useState(0);
  const cacheKey = `${viewer ?? '-'}:${userId}`;
  const key = `${cacheKey}:${nonce}`;
  // Si se acaba de cargar (p. ej. desde la visita), se pinta ya, sin pasar por «cargando»
  const [result, setResult] = useState(() => {
    const data = ready && userId ? fresh(cacheKey) : null;
    return data ? { key, data, failure: '' } : { key: null, data: null, failure: '' };
  });
  const seq = useRef(0);

  useEffect(() => {
    if (!ready || !userId) return undefined;
    const mine = ++seq.current;
    const cached = nonce === 0 ? fresh(cacheKey) : null;
    if (cached) {
      setResult((r) => (r.key === key && r.data === cached ? r : { key, data: cached, failure: '' }));
      return () => {
        seq.current += 1;
      };
    }
    // Lo de la 1.35.0 es opcional: si el servidor aún no lo tiene, el perfil de siempre sigue funcionando
    const soft = (p, fallback) => p.catch(() => fallback);
    Promise.all([fetchProfiles([userId]), fetchCorner(userId), fetchReviewsBy(userId), soft(fetchCornerExtras(userId), null), soft(fetchAdornments([userId]), {}), soft(fetchCollections(userId), { items: [] }), soft(fetchDistinctions(userId), { rows: [], moderator: false })])
      .then(([profiles, corner, reviews, extras, adornments, collections, distinctions]) => {
        if (mine !== seq.current) return;
        const data = {
          profile: profiles[userId] ?? null,
          corner: corner && extras && !extras.unavailable ? { ...corner, ...extras } : corner,
          reviews,
          adornment: adornments[userId] ?? null,
          collections: collections.items.filter((c) => c.visible || userId === viewer),
          distinctions: visibleDistinctions(distinctions.rows, distinctions.moderator),
        };
        recent.set(cacheKey, { at: Date.now(), data });
        setResult({ key, failure: '', data });
      })
      .catch((e) => mine === seq.current && setResult({ key, data: null, failure: e.message || 'No se ha podido cargar.' }));
    return () => {
      // Cerrar o cambiar de persona: la respuesta que llegue tarde ya no vale
      seq.current += 1;
    };
  }, [ready, userId, viewer, key, cacheKey, nonce]);

  const reload = useCallback(() => {
    recent.delete(cacheKey);
    setNonce((n) => n + 1);
  }, [cacheKey]);
  // Solo valen los datos de ESTA persona y ESTA cuenta (los de la anterior no se enseñan ni un instante)
  const cachedNow = result.key !== key && nonce === 0 && ready && userId ? fresh(cacheKey) : null;
  const current = result.key === key ? result : { data: cachedNow, failure: '' };
  const status = !ready ? 'waiting' : current.failure ? 'error' : current.data ? 'ready' : 'loading';
  return { status, data: current.data, failure: current.failure, reload };
}
