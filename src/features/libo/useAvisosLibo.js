// Libo, bloque 3: los avisos que reúne en tu piso (docs/qa/libo.md §2.4). Lee lo que ya cuentan otros sitios, sin pedir nada
// nuevo al servidor: el almacén de hoy (el mismo estado que la «!» del monitor), lo que tu café dejó apuntado en este aparato
// y las cartas de tu buzón (la misma consulta que el portal, como mucho cada cinco minutos).
import { useEffect, useMemo, useState } from 'react';
import { useAlmacenHoy } from '../edificio/hotel/almacenHoy';
import { resumenAlmacen, vistosDelAlmacen } from '../edificio/hotel/almacenAvisos';
import { loadSocial } from '../edificio/service';
import { correoLeido, correoSinLeer } from '../edificio/correo';
import { avisosDeLibo, leerCafeLibo } from './sugerencias';
import { loadAmigos } from '../social/services/amigos';

const FRESCO_MS = 5 * 60000;
let correoCache = null; // { uid, t, social }

/** Los avisos de hoy para Libo (lista vacía con `activo` falso: el piso de un vecino, sin cuenta…). */
export function useAvisosLibo(activo, userId) {
  const { fase, estado, version } = useAlmacenHoy(activo);
  const [social, setSocial] = useState(() => (correoCache?.uid === userId ? correoCache.social : null));
  useEffect(() => {
    if (!activo || !userId) return undefined;
    if (correoCache?.uid === userId && Date.now() - correoCache.t < FRESCO_MS) return undefined;
    let vivo = true;
    loadSocial(userId).then(
      (s) => {
        correoCache = { uid: userId, t: Date.now(), social: s };
        if (vivo) setSocial(s);
      },
      () => {},
    );
    return () => {
      vivo = false;
    };
  }, [activo, userId]);
  return useMemo(() => {
    if (!activo || !userId) return [];
    let almacen = null;
    let monitorVistos = [];
    if (fase === 'listo' && estado) {
      const vistos = vistosDelAlmacen(estado.dia);
      almacen = resumenAlmacen(estado, vistos);
      monitorVistos = vistos.monitor;
    }
    return avisosDeLibo({ almacen, monitorVistos, cafe: leerCafeLibo(userId), correo: social ? correoSinLeer(social, correoLeido(userId)) : 0 });
    // `version` cambia con lo visto del almacén: hay que volver a leerlo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo, userId, fase, estado, version, social]);
}

// 1.154 · Tu agenda de amigos, para las sugerencias de Libo (docs/qa/amigos-vecinos.md, bloque 4): la misma consulta que la app
// Amigos, como mucho cada cinco minutos. Sin la migración o sin red, null: Libo no habla de amigos.
let amigosCache = null; // { uid, t, amigos }

export function useAmigosLibo(activo, userId) {
  const [amigos, setAmigos] = useState(() => (amigosCache?.uid === userId ? amigosCache.amigos : null));
  useEffect(() => {
    if (!activo || !userId) return undefined;
    if (amigosCache?.uid === userId && Date.now() - amigosCache.t < FRESCO_MS) return undefined;
    let vivo = true;
    loadAmigos().then(
      (a) => {
        amigosCache = { uid: userId, t: Date.now(), amigos: a };
        if (vivo) setAmigos(a);
      },
      () => {
        amigosCache = { uid: userId, t: Date.now(), amigos: null };
      },
    );
    return () => {
      vivo = false;
    };
  }, [activo, userId]);
  return activo && amigosCache?.uid === userId ? amigos : null;
}
