// Lo que tienes a la vista en la estantería, publicado para quien visita tu piso (supabase/migrations/20261121120000_piso_expuestos.sql).
// La lectura actual no entra: si se enseña o no ya lo decide «Está leyendo» en tu rincón. Sin la migración, la visita sigue con lo compartido.
import { client } from '../social/services/community';

const MAX = 60;
const sentKey = (userId) => `bookshelf:expuestos:${userId}`;
const publicCover = (url) => (typeof url === 'string' && /^https:\/\//.test(url) && url.length <= 600 ? url : '');

/** Lo justo de cada libro que hay a la vista, en el orden de la estantería. `shelf`: el resultado de `shelfRows`. */
export function expuestosDe(shelf) {
  if (!shelf) return [];
  return [shelf.cover, ...shelf.rows.flat().map((i) => i.book)]
    .filter((b) => b && b.status !== 'reading')
    .slice(0, MAX)
    .map((b) => ({ id: String(b.id), title: b.title, author: b.author ?? '', cover: publicCover(b.cover) }));
}

/** Solo escribe si la lista ha cambiado desde el último envío correcto de este dispositivo. Un fallo no molesta: se reintenta al volver. */
export async function publicarExpuestos(userId, lista) {
  const firma = JSON.stringify(lista);
  try {
    if (localStorage.getItem(sentKey(userId)) === firma) return;
    const sb = await client();
    const { error } = await sb.rpc('piso_publicar_expuestos', { lista });
    if (!error) localStorage.setItem(sentKey(userId), firma);
  } catch {
    // Sin cuenta, sin red o sin la migración: no hay nada que publicar
  }
}

export async function cargarExpuestos(lector) {
  try {
    const sb = await client();
    const { data, error } = await sb.rpc('piso_expuestos_de', { lector });
    return error || !Array.isArray(data) ? [] : data;
  } catch {
    return [];
  }
}
