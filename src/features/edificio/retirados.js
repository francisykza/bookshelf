// Objetos retirados temporalmente (1.89, SPEC §89). Los sprites planos con partículas desentonan con los muebles modelados,
// así que dejan de dibujarse y de ofrecerse, pero siguen siendo tuyos: no se tocan inventario, identificadores ni posiciones.
//
// En memoria, un piso tiene `items` (lo que se ve y se edita) y `ocultos` (lo retirado, que no bloquea nada). Al guardar:
//  - lo oculto vuelve a `items` en su sitio si sigue cabiendo: el piso guardado es igual que antes;
//  - si ya no cabe (has puesto algo encima de su celda), se aparca en `layout.ocultos`, con sus coordenadas intactas.
// Para restaurar uno: quitarlo de RETIRADOS. Al cargar vuelve a su sitio solo si sigue libre; si no, se queda en `ocultos`,
// «esperando sitio» y avisado en Decorar. Nunca se recoloca en otra parte ni se solapa con nada.
import { acabadoOf } from './acabados';
import { catalogItem } from './catalog';
import { ROOM, check, validateRoom } from './room';

/** Se retiran enteros: farol, rosa y búho sobre peana, y el perrito sobre su cojín. */
export const RETIRADOS = new Set(['farol-azul', 'rosa-estrellas', 'buho-estrellas', 'perrito']);
/** Destellos de los acabados y animación encima de gramola y mesa de tapete: el mueble y su color se quedan, el efecto no. */
export const EFECTOS_APAGADOS = true;

export const isRetirado = (id) => RETIRADOS.has(id);

/** ¿Este objeto colocado necesita animarse? Con los efectos apagados solo quedaría un místico no retirado. */
export function tieneVida(item) {
  const cat = catalogItem(item.id);
  if (!cat || isRetirado(item.id)) return false;
  if (cat.rareza === 'mistico' || cat.mascota) return true;
  return !EFECTOS_APAGADOS && Boolean(cat.vivo || item.acabado);
}

function limpio(raw) {
  const cat = raw && typeof raw === 'object' ? catalogItem(raw.id) : null;
  if (!cat || !Number.isInteger(raw.uid) || raw.uid < 1 || !Number.isInteger(raw.tono) || raw.tono < 0 || raw.tono >= cat.tonos.length) return null;
  const piel = raw.acabado && acabadoOf(raw.acabado) ? { acabado: raw.acabado } : null;
  if (cat.capa === 'pared') return Number.isInteger(raw.a) ? { uid: raw.uid, id: raw.id, pared: raw.pared, a: raw.a, tono: raw.tono, ...piel } : null;
  return [raw.x, raw.y, raw.rot].every(Number.isInteger) ? { uid: raw.uid, id: raw.id, x: raw.x, y: raw.y, rot: raw.rot, tono: raw.tono, ...piel } : null;
}

/** De un piso validado y lo aparcado en su layout, la habitación de memoria: lo retirado sale de `items` y pasa a `ocultos`. */
export function repartir(room, aparcados = null) {
  if (!room) return room;
  const items = room.items.filter((i) => !isRetirado(i.id));
  const ocultos = room.items.filter((i) => isRetirado(i.id));
  const usados = new Set(room.items.map((i) => i.uid));
  const vuelta = [];
  for (const raw of Array.isArray(aparcados) ? aparcados : []) {
    const item = limpio(raw);
    if (!item || usados.has(item.uid)) continue;
    usados.add(item.uid);
    if (isRetirado(item.id)) ocultos.push(item);
    else vuelta.push(item);
  }
  let out = { ...room, items };
  // Ya no está retirado: vuelve a su sitio exacto si sigue libre; si no, espera
  for (const item of vuelta) {
    if (out.items.length < ROOM.maxItems && check(out, item).ok) out = { ...out, items: [...out.items, item] };
    else ocultos.push(item);
  }
  return ocultos.length ? { ...out, ocultos } : out;
}

/** Lo que llega del servidor: validado y repartido. */
export function leerPiso(layout) {
  return repartir(validateRoom(layout), layout?.ocultos);
}

/** Lo que se guarda: lo visible, más todo lo oculto (en su sitio si cabe; aparcado si no). Nunca una lista filtrada. */
export function empaquetar(room) {
  const layout = validateRoom(room);
  if (!layout) return null;
  let out = layout;
  const aparcados = [];
  for (const item of [...(room.ocultos ?? [])].sort((a, b) => a.uid - b.uid)) {
    if (out.items.length < ROOM.maxItems && check(out, item).ok) out = { ...out, items: [...out.items, item] };
    else aparcados.push(item);
  }
  return aparcados.length ? { ...out, ocultos: aparcados } : out;
}

/** Los que ya podrían volver pero tienen ocupado su sitio. */
export const esperanSitio = (room) => (room.ocultos ?? []).filter((i) => !isRetirado(i.id));
