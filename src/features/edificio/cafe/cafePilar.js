// El café-librería del bajo, 1.130 (§15.1, aprobado por Francisco el 14-11-2026: «Vale lo de pilar»): Pilar prepara lo que ya
// dominas. Tú lees la comanda y eliges cada parte de la receta; los gestos de cada etapa los hace ella, en la barra y en 3D,
// con sus sonidos: la taza entera en unos 3 segundos. Aquí, solo cuentas: la postura de cada objeto en cada momento del gesto
// (de 0 a 1, de su postura inicial a la final de `completar`) y los sonidos que suenan por el camino.
import { MEDIDAS, crearGesto } from './cafeGestos';

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
/** Sube rápido y se asienta (como una mano que sabe lo que hace). */
const suave = (t) => 1 - (1 - clamp(t)) ** 3;
/** Ida y vuelta: 0 → 1 → 0 en `t`. */
const vaiven = (t, veces) => Math.sin(clamp(t) * Math.PI * 2 * veces);
/** Bajar, mantener y volver: 0 → 1 (en `a`) … 1 → 0 (desde `b`). */
const meseta = (t, a = 0.18, b = 0.86) => (t < a ? t / a : t > b ? Math.max(0, (1 - t) / (1 - b)) : 1);

/** Cuánto tarda Pilar en cada gesto (ms): la taza de café con leche y canela, unos 3 s con los respiros. */
export const PILAR_MS = {
  manivela: 420,
  apisonar: 260,
  palanca: 620,
  cuchara: 330,
  tetera: 600,
  colador: 420,
  vapor: 560,
  verter: 420,
  agitar: 360,
  hilo: 420,
  molinillo: 480,
  cazo: 560,
  batir: 460,
  rascar: 420,
  coctelera: 520,
  mortero: 440,
  soplete: 520,
};
/** El respiro entre un gesto y el siguiente cuando prepara Pilar (más corto que a mano). */
export const PILAR_RESPIRO_MS = 140;

/** La postura del objeto del gesto `tipo` en el momento `t` (0 a 1). `arte`: el dibujo de la leche que hace Pilar. */
export function poseAuto(tipo, t, { arte = 'corazon' } = {}) {
  const u = clamp(t);
  const k = suave(u);
  switch (tipo) {
    case 'manivela':
      return { angulo: u * Math.PI * 2 * MEDIDAS.vueltas, molido: u };
    case 'apisonar':
      return { bajada: u < 0.85 ? suave(u / 0.85) : 1 };
    case 'palanca':
      return { bajada: meseta(u), extraido: clamp((u - 0.18) / 0.68) };
    case 'cuchara':
      return { t: k };
    case 'tetera':
      return { alzada: meseta(u) * 0.8, lleno: clamp((u - 0.18) / 0.68) };
    case 'colador':
      return { altura: -Math.abs(vaiven(u, MEDIDAS.vecesColador / 2)) * 0.8, inmersiones: Math.floor(u * MEDIDAS.vecesColador) };
    case 'vapor':
      return { inclina: meseta(u) * 0.7, espuma: clamp((u - 0.18) / 0.68) };
    case 'verter':
      return { vertido: u, x: arte === 'hoja' ? vaiven(u, 2) * 0.5 : 0, ondas: arte === 'hoja' ? Math.floor(u * (MEDIDAS.ondasHoja + 1)) : 0, arte: u >= 1 ? arte : null };
    case 'agitar':
      return { x: vaiven(u, MEDIDAS.vecesAgitar / 2), golpes: Math.floor(u * MEDIDAS.vecesAgitar) };
    case 'hilo': {
      const n = Math.max(1, Math.round(u * 24));
      return { puntos: Array.from({ length: n }, (_, j) => [Math.cos(j * 0.55) * (0.15 + j * 0.028), Math.sin(j * 0.55) * (0.15 + j * 0.028)]) };
    }
    case 'molinillo':
      return { angulo: u * Math.PI * 2 * MEDIDAS.vueltasMolinillo, espeso: u };
    case 'cazo':
      return { inclina: meseta(u) * 0.8, servido: clamp((u - 0.18) / 0.68) };
    case 'batir':
      return { angulo: u * Math.PI * 2 * MEDIDAS.vueltasBatir, montada: u };
    case 'rascar': {
      const n = Math.min(MEDIDAS.trazosRascar, Math.floor(u * MEDIDAS.trazosRascar));
      return { t: u >= 1 ? 1 : (u * MEDIDAS.trazosRascar) % 1, raspados: n };
    }
    case 'coctelera':
      return { x: vaiven(u, MEDIDAS.vecesCoctelera / 2), agitado: u, golpes: Math.floor(u * MEDIDAS.vecesCoctelera) };
    case 'mortero': {
      const g = Math.floor(u * MEDIDAS.golpesMortero);
      return { maza: u >= 1 ? 0 : 1 - ((u * MEDIDAS.golpesMortero) % 1), golpes: Math.min(MEDIDAS.golpesMortero, g) };
    }
    case 'soplete':
      return { x: vaiven(u, MEDIDAS.vecesSoplete / 2) * 0.8, dorado: u, llama: u < 1 };
    default:
      return crearGesto(tipo).completar().pose;
  }
}

/** Los sonidos de cada gesto, repartidos por su recorrido: [sonido, en qué momentos (0 a 1)]. */
const SONIDOS = {
  manivela: ['clic', 16],
  apisonar: ['golpe', [0.86]],
  palanca: ['abajo', [0.18]],
  cuchara: ['hojas', [0.9]],
  colador: ['plop', MEDIDAS.vecesColador],
  verter: ['onda', 3],
  agitar: ['sacudida', MEDIDAS.vecesAgitar],
  hilo: ['hilo', 5],
  molinillo: ['remueve', 12],
  batir: ['bate', 20],
  rascar: ['raspa', MEDIDAS.trazosRascar],
  coctelera: ['hielo', MEDIDAS.vecesCoctelera],
  mortero: ['machaca', MEDIDAS.golpesMortero],
  soplete: ['chispa', [0.02]],
};
const momentos = (v) => (Array.isArray(v) ? v : Array.from({ length: v }, (_, j) => (j + 0.5) / v));
/** Lo que suena entre `t0` y `t1` (sin contar t0). */
export function sonidosEntre(tipo, t0, t1) {
  const s = SONIDOS[tipo];
  if (!s) return [];
  return momentos(s[1])
    .filter((m) => m > t0 && m <= t1)
    .map(() => s[0]);
}
/** Los que suenan mientras dura (el café que cae, el agua, el vapor, el chocolate, la llama): entre qué momentos. */
export const BUCLE_PILAR = { palanca: [0.18, 0.86], tetera: [0.18, 0.86], vapor: [0.18, 0.86], cazo: [0.18, 0.86], soplete: [0, 0.98] };
