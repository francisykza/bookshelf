// 1.134 · 1.135 · El estado del almacén de hoy, compartido por el ordenador del piso (la tarjeta, la nota del cajón y la pantalla
// «Almacén»), la «!» del monitor del piso y la ficha del almacén. Se pide una vez al abrir y como mucho cada cinco minutos (o al
// pasar la medianoche del servidor), nunca a cada rato. Lo visto (en el dispositivo) y lo que sigues (en el servidor) avisan a
// todos los que lo enseñan, para que la «!» se apague a la vez en todas partes.
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { almacenDesear, loadAlmacen } from '../service';
import { marcarMonitor, marcarVistos, monitorPendiente, resumenAlmacen, vistosDelAlmacen } from './almacenAvisos';

const FRESCO_MS = 5 * 60000;
let cache = null; // { t, s }: s, lo que dice `piso_almacen_estado` (null sin la migración)
// La petición en curso: la tarjeta, la nota del cajón y el monitor comparten una sola
let enCurso = null;
let version = 0;
const oyentes = new Set();

/** Algo ha cambiado (el estado, lo visto o lo que sigues): quien lo enseñe, que se repinte. */
function avisar() {
  version += 1;
  for (const f of oyentes) f();
}
const suscribir = (f) => {
  oyentes.add(f);
  return () => oyentes.delete(f);
};
const vigente = (c) => c && Date.now() - c.t < FRESCO_MS && !(c.s?.vuelve && Date.now() >= c.s.vuelve);

function estadoHoy(fresco) {
  if (!fresco && vigente(cache)) return Promise.resolve(cache.s);
  if (!fresco && enCurso) return enCurso;
  const p = loadAlmacen().then((s) => {
    cache = { t: Date.now(), s };
    avisar();
    return s;
  });
  enCurso = p;
  p.finally(() => {
    if (enCurso === p) enCurso = null;
  }).catch(() => {});
  return p;
}

/**
 * El estado de la caja de hoy: { fase: 'cargando' | 'listo' | 'cerrado' | 'error', estado, version, reintentar }. `version` cambia
 * con lo visto y lo que sigues: sirve para recalcular lo que depende de ello. Con `activo` falso no pide nada.
 */
export function useAlmacenHoy(activo = true) {
  const v = useSyncExternalStore(suscribir, () => version);
  const [fase, setFase] = useState(() => (vigente(cache) ? (cache.s ? 'listo' : 'cerrado') : 'cargando'));
  const vivo = useRef(true);
  const cargar = useCallback((fresco = false) => {
    estadoHoy(fresco).then(
      (s) => vivo.current && setFase(s ? 'listo' : 'cerrado'),
      () => vivo.current && setFase('error'),
    );
  }, []);
  useEffect(() => {
    vivo.current = true;
    if (activo) cargar();
    return () => {
      vivo.current = false;
    };
  }, [cargar, activo]);
  const reintentar = useCallback(() => {
    setFase('cargando');
    cargar(true);
  }, [cargar]);
  return { fase, estado: fase === 'listo' ? (cache?.s ?? null) : null, version: v, reintentar };
}

/** Lo que sigues ha cambiado (lo dice el servidor): al estado compartido. */
export function ponerDeseados(lista) {
  if (!cache?.s || !Array.isArray(lista)) return;
  cache = { ...cache, s: { ...cache.s, deseados: lista } };
  avisar();
}

/**
 * Seguir (`quiere` true) o dejar de seguir el precio de un mueble. Se ve al momento y, si el servidor dice que no, vuelve a como
 * estaba (y el error sube: 'almacen:deseo', 'almacen:deseos' o la red). Devuelve la lista entera.
 */
export async function desear(id, quiere) {
  const antes = cache?.s?.deseados;
  if (Array.isArray(antes)) ponerDeseados(quiere ? [...antes.filter((x) => x !== id), id] : antes.filter((x) => x !== id));
  try {
    const lista = await almacenDesear(id, quiere);
    ponerDeseados(lista);
    return lista;
  } catch (e) {
    if (Array.isArray(antes)) ponerDeseados(antes);
    throw e;
  }
}

/** Lo que se dice si no se ha podido seguir. */
export const mensajeDeseo = (e) =>
  /almacen:deseos/.test(e?.message ?? '')
    ? 'Ya sigues 40 muebles: deja de seguir alguno para seguir este.'
    : /almacen:deseo/.test(e?.message ?? '')
      ? 'Este mueble no se puede seguir.'
      : 'No se ha podido guardar. Inténtalo otra vez.';

/** Dar por vistos unos nuevos y unas ofertas de lo que sigues, y avisar. */
export function verAvisos(ids, dia, claves = []) {
  if (!ids.length && !claves.length) return;
  marcarVistos(ids, dia, claves);
  avisar();
}

/** El monitor del piso ya ha avisado (se ha abierto el ordenador). */
export function monitorAvisado(r) {
  if (!r) return;
  marcarMonitor(r);
  avisar();
}

/**
 * 1.135 · ¿Lleva su «!» el monitor del piso? Solo por lo tuyo (algo nuevo sin ver o algo que sigues rebajado) y hasta que se abre
 * el ordenador. `activo`: tu piso, con cuenta (en el de un vecino o sin cuenta, nunca y sin pedir nada).
 */
export function useMonitorAlmacen(activo) {
  const { fase, estado, version } = useAlmacenHoy(activo);
  return useMemo(() => {
    if (!activo || fase !== 'listo' || !estado) return false;
    const vistos = vistosDelAlmacen(estado.dia);
    return monitorPendiente(resumenAlmacen(estado, vistos), vistos);
    // `version` cambia con lo visto: hay que volver a leerlo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo, fase, estado, version]);
}
