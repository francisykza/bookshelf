// Libo, bloque 3: los avisos que reúne en tu piso (docs/qa/libo.md §2.4). Lee lo que ya cuentan otros sitios, sin pedir nada
// nuevo al servidor: el almacén de hoy (el mismo estado que la «!» del monitor), lo que tu café dejó apuntado en este aparato
// y las cartas de tu buzón (la misma consulta que el portal, como mucho cada cinco minutos).
import { useEffect, useMemo, useState } from 'react';
import { useAlmacenHoy } from '../edificio/hotel/almacenHoy';
import { resumenAlmacen, vistosDelAlmacen } from '../edificio/hotel/almacenAvisos';
import { loadArmario, loadCasino, loadRuleta, loadSocial } from '../edificio/service';
import { missionsOf, todayKey } from '../edificio/dailyMissions';
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

// 1.158 · Lo de hoy (docs/qa/libo-lo-de-hoy.md; Francisco, 27-11-2026: «Sí, que pregunte»): al abrir su tarjeta, Libo pregunta
// al servidor por el casino, la ruleta de la semana y las misiones del día. Con caché de un minuto (abrir y cerrar la tarjeta
// no repite las preguntas) y corta, para que al volver de jugar diga lo de verdad. Lo que falle (sin migración, sin red) llega
// como null y Libo no habla de ello.
const HOY_FRESCO_MS = 60000;
let hoyCache = null; // { uid, dia, t, promesa }

export function cargarHoyLibo(userId, dia = todayKey()) {
  if (!userId) return Promise.resolve(null);
  if (hoyCache?.uid === userId && hoyCache.dia === dia && Date.now() - hoyCache.t < HOY_FRESCO_MS) return hoyCache.promesa;
  const nulo = (p) => p.then((x) => x ?? null, () => null);
  const promesa = Promise.all([nulo(loadCasino(dia)), nulo(loadRuleta(dia)), nulo(loadArmario(dia))]).then(([casino, ruleta, armario]) => ({ casino, ruleta, armario, misiones: missionsOf(dia).map((m) => m.id) }));
  hoyCache = { uid: userId, dia, t: Date.now(), promesa };
  return promesa;
}

/** Olvida lo preguntado (las pruebas, o al volver de jugar si hiciera falta). */
export function olvidarHoyLibo() {
  hoyCache = null;
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
