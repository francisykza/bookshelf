// 1.165 · El retrato de quien lee (docs/qa/comunidad-visita.md, bloque 3; Francisco, 28-11-2026, «Sí, así»): el busto de su
// personaje, el mismo en la Comunidad, Amigos, la visita y el telefonillo. El aspecto lo da `comunidad_personajes` (migración
// 20270102120000), por lotes: los avatares que se piden a la vez van en una sola llamada. Sin la migración, la app sigue con los
// retratos de antes; sin personaje, Libo. El dibujo lo hace el motor del edificio, que se carga solo cuando hace falta.
import { validateAvatar } from '../edificio/actor';
import { client, fail } from './services/community';

const TAM = 96;
const personajes = new Map(); // userId → personaje validado o null (no tiene)
const esperando = new Map(); // userId → [resolve]
const bustos = new Map(); // aspecto → dataURL
let sinMigracion = false;
let lote = null;

/** Vacía lo guardado (cambio de cuenta o un bloqueo nuevo). */
export function clearRetratos() {
  personajes.clear();
  bustos.clear();
  sinMigracion = false;
}

/** ¿Ya se sabe que el servidor no tiene la migración? (entonces, los retratos de antes) */
export const retratosAntiguos = () => sinMigracion;

/** Lo que ya se sabe de un lector sin pedir nada: undefined si aún no se ha preguntado. */
export const personajeSabido = (userId) => (sinMigracion ? null : personajes.get(userId));

async function pedirLote() {
  const ids = [...esperando.keys()];
  const avisos = [...esperando.entries()];
  esperando.clear();
  lote = null;
  try {
    const sb = await client();
    for (let i = 0; i < ids.length; i += 60) {
      const trozo = ids.slice(i, i + 60);
      const { data, error } = await sb.rpc('comunidad_personajes', { ids: trozo });
      fail(error);
      const recibidos = new Map((data ?? []).map((f) => [f.user_id, validateAvatar(f.personaje)]));
      for (const id of trozo) personajes.set(id, recibidos.get(id) ?? null);
    }
  } catch (e) {
    // Sin la migración (o sin nube): los de antes, sin volver a preguntar en esta sesión
    if (e?.code === 'unavailable' || e?.code === 'off') sinMigracion = true;
  }
  for (const [id, resolvers] of avisos) for (const r of resolvers) r(sinMigracion ? null : (personajes.get(id) ?? null));
}

/** El personaje de un lector (o null). Se juntan en una sola llamada los que se piden a la vez. */
export function pedirPersonaje(userId) {
  if (!userId || sinMigracion) return Promise.resolve(null);
  if (personajes.has(userId)) return Promise.resolve(personajes.get(userId));
  return new Promise((resolve) => {
    if (!esperando.has(userId)) esperando.set(userId, []);
    esperando.get(userId).push(resolve);
    lote ??= setTimeout(pedirLote, 30);
  });
}

/** El busto de un personaje como imagen (dibujado una vez por aspecto). */
export async function bustoDe(personaje) {
  const clave = JSON.stringify(personaje);
  if (bustos.has(clave)) return bustos.get(clave);
  const { renderActorThumb } = await import('../edificio/render');
  const url = renderActorThumb(personaje, { frame: 'busto', size: TAM }).toDataURL();
  bustos.set(clave, url);
  return url;
}

/** El retrato neutro de quien no tiene personaje: Libo asomándose. */
export const RETRATO_LIBO = '/assets/libo/poses/asoma.webp';
