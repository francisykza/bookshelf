// 1.153 · El servicio de la app «Amigos» (migración supabase/migrations/20270101120000_amigos.sql; reglas de verdad en
// src/features/social/__tests__/amigos.rls.test.js). Sin la migración, `loadAmigos` lo dice con `code: 'unavailable'`.
import { client, fail } from './community';
import { amigosActivo, avancesJuntos, firmaEnviada, firmaLectura, guardarFirma, juntosGuardados, lecturaParaAmigos } from '../amigosLectura';

const rpc = async (nombre, args) => {
  const sb = await client();
  const { data, error } = await sb.rpc(nombre, args);
  fail(error);
  return data;
};

const lista = (x) => (Array.isArray(x) ? x : []);

/** Todo lo de la app: tu código, tus ajustes, tus amigos, solicitudes, buzón, lecturas a la vez y llaves. */
export async function loadAmigos() {
  const d = await rpc('amigos_panel');
  return {
    codigo: d?.codigo ?? null,
    ajustes: { leyendo: d?.ajustes?.leyendo !== false, terminados: d?.ajustes?.terminados !== false, juntos: d?.ajustes?.juntos !== false },
    amigos: lista(d?.amigos).map((a) => ({ ...a, leyendo: a.leyendo == null ? null : lista(a.leyendo), terminados: a.terminados == null ? null : lista(a.terminados) })),
    solicitudes: lista(d?.solicitudes),
    esperando: lista(d?.esperando),
    recomendaciones: lista(d?.recomendaciones),
    juntos: lista(d?.juntos),
    llaves: lista(d?.llaves),
    llavesDadas: lista(d?.llaves_dadas),
  };
}

/** De quién es un código de amigo (null si de nadie que puedas ver). */
export const buscarCodigo = (cod) => rpc('amigos_buscar_codigo', { cod });

export const guardarAjustes = ({ leyendo, terminados, juntos }) => rpc('amigos_ajustes', { leyendo, terminados, juntos });

export const recomendar = (para, { titulo, autor }, frase) => rpc('amigos_recomendar', { para, titulo, autor: autor ?? '', frase });
export const recomendacionesVistas = () => rpc('amigos_recomendaciones_vistas');

export const proponerJuntos = (para, { titulo, autor }) => rpc('amigos_juntos_proponer', { para, titulo, autor: autor ?? '' });
export const responderJuntos = (juntos, acepta) => rpc('amigos_juntos_responder', { juntos, acepta });
export const dejarJuntos = (juntos) => rpc('amigos_juntos_dejar', { juntos });

/** La llave de tu edificio, para un amigo: le llega a su app. */
export const darLlaveAmigo = (para) => rpc('amigos_dar_llave', { para });

/**
 * Manda a tus amigos lo que lees, lo terminado y tu avance en cada lectura a la vez, si ha cambiado desde lo último que se
 * mandó desde este aparato (`forzar`, aunque no). Devuelve si se mandó.
 */
export async function publicarLectura(uid, books, { forzar = false, juntos = null } = {}) {
  if (!uid || !amigosActivo(uid)) return false;
  const { leyendo, terminados } = lecturaParaAmigos(books);
  const avances = avancesJuntos(books, juntos ?? juntosGuardados(uid));
  const firma = firmaLectura({ leyendo, terminados, avances });
  if (!forzar && firma === firmaEnviada(uid)) return false;
  await rpc('amigos_publicar', { leyendo, terminados, avances });
  guardarFirma(uid, firma);
  return true;
}
