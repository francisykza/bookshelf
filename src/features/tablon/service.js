// Servicio del tablón: una sola fuente de datos para el mueble y el ordenador. Todo pasa por funciones del servidor
// (supabase/migrations/20261120120000_tablon.sql). Sin la migración o sin cuenta, el tablón funciona solo en este dispositivo.
import { client, fail } from '../social/services/community';
import { emptyDoc, uid } from './model';

const draftKey = (userId) => `bookshelf:tablon:borrador:${userId ?? 'local'}`;
const localKey = (userId) => `bookshelf:tablon:local:${userId ?? 'local'}`;
const read = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? null;
  } catch {
    return null;
  }
};
const write = (key, value) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Sin almacenamiento, el documento sigue en memoria
  }
};

export const readDraft = (userId) => read(draftKey(userId));
export const writeDraft = (userId, draft) => write(draftKey(userId), draft);
export const clearDraft = (userId) => write(draftKey(userId), null);

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const cleanItem = (i) => ({ ...i, x: num(i.x), y: num(i.y), width: num(i.width, 240), height: num(i.height, 180), rotation: num(i.rotation), z: num(i.z) });
const normalize = (d) => ({
  local: false,
  tablero: d.tablero,
  composiciones: d.composiciones ?? [],
  actual: { ...d.actual, doc: { items: (d.actual.items ?? []).map(cleanItem), edges: d.actual.edges ?? [] } },
  recibidas: d.recibidas ?? [],
  sinLeer: d.sin_leer ?? 0,
  avisos: d.avisos ?? [],
});

function localBoard(userId) {
  let saved = read(localKey(userId));
  if (!saved) {
    saved = { id: uid(), title: 'Composición 1', revision: 0, doc: emptyDoc() };
    write(localKey(userId), saved);
  }
  return { local: true, tablero: { acepta: false, activa: saved.id, publica: null }, composiciones: [{ id: saved.id, title: saved.title, visibility: 'private', revision: saved.revision }], actual: { id: saved.id, title: saved.title, visibility: 'private', revision: saved.revision, bounds: null, doc: saved.doc }, recibidas: [], sinLeer: 0, avisos: [] };
}

/** Tu tablón. Sin cuenta o sin la migración, el de este dispositivo. */
export async function loadBoard(userId, comp = null) {
  if (!userId) return localBoard(userId);
  try {
    const sb = await client();
    const { data, error } = await sb.rpc('tablon_cargar', { comp });
    fail(error);
    return normalize(data);
  } catch (e) {
    if (e.code === 'unavailable' || e.code === 'off') return localBoard(userId);
    throw e;
  }
}

const itemPayload = ({ retirada: _r, firma: _f, ...i }) => i;

export async function saveBoard(userId, local, comp, revision, title, doc, bounds) {
  if (local) {
    const next = revision + 1;
    write(localKey(userId), { id: comp, title, revision: next, doc });
    return { revision: next };
  }
  const sb = await client();
  const { data, error } = await sb.rpc('tablon_guardar', { comp, base: revision, titulo: title, nuevos: doc.items.map(itemPayload), hilos: doc.edges, limites: bounds });
  fail(error);
  return data;
}

const rpc = async (name, args) => {
  const sb = await client();
  const { data, error } = await sb.rpc(name, args);
  fail(error);
  return data;
};

export const createComposition = (clave, titulo) => rpc('tablon_crear', { clave, titulo });
export const deleteComposition = (comp) => rpc('tablon_borrar', { comp });
export const setBoardOptions = (options) => rpc('tablon_ajustes', options);
export const publish = (comp, base) => rpc('tablon_publicar', { comp, base });
export const unpublish = () => rpc('tablon_despublicar');
export const markRead = (nota) => rpc('tablon_leer_nota', { nota });
export const archiveNote = (nota) => rpc('tablon_archivar_nota', { nota });
export const clearNotices = () => rpc('tablon_avisos_vistos');
export const sentNotes = () => rpc('tablon_mis_enviadas');
export const setNotePermission = (nota, permitir) => rpc('tablon_permiso_nota', { nota, permitir });
export const withdrawNote = (nota) => rpc('tablon_retirar_nota', { nota });
export const sendNote = ({ destino, texto, estilo, spoiler, permitePublico, clave }) => rpc('tablon_enviar_nota', { destino, texto, estilo, es_spoiler: spoiler, permite_publico: permitePublico, clave });

/** Lo que puede ver quien visita; null si no hay permiso o aún no existe la migración. */
export async function loadVisit(lector) {
  try {
    const d = await rpc('tablon_visita', { lector });
    if (!d) return null;
    return { ...d, publico: d.publico ? { ...d.publico, doc: { items: (d.publico.items ?? []).map(cleanItem), edges: d.publico.edges ?? [] } } : null };
  } catch (e) {
    if (e.code === 'unavailable' || e.code === 'off') return null;
    throw e;
  }
}

/** El libro de visitas antiguo: solo tuyo, sin borrar ni publicar nada. */
export async function oldGuestbook(userId) {
  const d = await rpc('piso_social', { piso: userId });
  return d?.visitas ?? [];
}
