// 1.151 · La llave de tu edificio, lo que no necesita el resto del edificio (docs/qa/amigos-vecinos.md, bloque 1): cómo se
// escribe y se comparte, por qué no abre y el enlace `#llave=` que la app guarda hasta que puedes usarlo. Lo usan el telefonillo
// (Telefonillo.jsx) y el aviso del enlace (LlaveHandler.jsx), que va en el arranque de la app: aquí no se importa nada pesado.
import { client, fail } from '../social/services/community';

/** Cómo se lee y se comparte una llave: «ABCD-EFGH». */
export const llaveBonita = (codigo) => (codigo ? `${codigo.slice(0, 4)}-${codigo.slice(4)}` : '');
/** Lo que alguien escribe, limpio: mayúsculas, sin espacios ni guiones (el servidor hace lo mismo). */
export const llaveLimpia = (texto) =>
  String(texto ?? '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();
/** El enlace que abre la app con la llave (`#llave=`, como las invitaciones a clubes: el código no llega al servidor). */
export const enlaceLlave = (codigo, origen = globalThis.location?.origin ?? 'https://libotown.es') => `${origen}/#llave=${codigo}`;
/** La llave de un enlace (`#llave=ABCDEFGH`), o null. */
export const llaveDeHash = (hash) => /^#llave=([A-HJ-NP-Z2-9]{8})$/i.exec(hash ?? '')?.[1]?.toUpperCase() ?? null;

/** Por qué una llave no abre, dicho para quien la tiene en la mano. */
export const MOTIVOS_LLAVE = {
  no_sirve: 'Esta llave ya no abre ninguna puerta: puede que haya caducado, que ya se haya usado o que la hayan retirado. Pide otra.',
  lleno: 'Ese edificio está lleno: no queda ninguna puerta libre.',
  ya_vives: 'Ya vives en ese edificio.',
  tuya: 'Es una llave tuya: dásela a un amigo para que se mude contigo.',
  comunidad: 'Para mudarte, activa «Participar en la comunidad» en «Mi Perfil & Avatar».',
  sesion: 'Inicia sesión en «Tu cuenta» para usar la llave.',
};

// La llave de un enlace se guarda en el dispositivo hasta que puedes usarla (quien llega sin cuenta, primero la crea)
export const LLAVE_KEY = 'bookshelf:llave';
const SIETE_DIAS = 7 * 24 * 3600 * 1000;

export function guardarLlavePendiente(codigo, storage = globalThis.localStorage, ahora = Date.now()) {
  try {
    storage?.setItem(LLAVE_KEY, JSON.stringify({ codigo, en: ahora }));
  } catch {
    // Sin almacenamiento, vale mientras la app siga abierta
  }
}
export function llavePendiente(storage = globalThis.localStorage, ahora = Date.now()) {
  try {
    const v = JSON.parse(storage?.getItem(LLAVE_KEY) || 'null');
    if (!v || typeof v.codigo !== 'string' || !(ahora - v.en < SIETE_DIAS)) return null;
    return llaveLimpia(v.codigo);
  } catch {
    return null;
  }
}
export function olvidarLlavePendiente(storage = globalThis.localStorage) {
  try {
    storage?.removeItem(LLAVE_KEY);
  } catch {
    // Nada que olvidar
  }
}

/**
 * Lo que abre una llave antes de usarla: `{ motivo, de: { alias, avatar_id }, vecinos, caduca }`. `motivo` es null si te puedes
 * mudar; si no, 'no_sirve', 'lleno', 'ya_vives', 'tuya', 'comunidad' o 'sesion'.
 */
export async function verLlave(codigo) {
  const sb = await client();
  const { data, error } = await sb.rpc('edificio_ver_llave', { cod: codigo });
  fail(error);
  return data;
}

/** Mudarte con una llave (tu piso y tus muebles van contigo): `{ edificio, puerta }`. */
export async function mudarse(codigo) {
  const sb = await client();
  const { data, error } = await sb.rpc('edificio_mudarse', { cod: codigo });
  fail(error);
  return data;
}
