// El café-librería del bajo, 1.130 (§15.1, aprobado por Francisco el 14-11-2026: «Vale lo de pilar»): Pilar prepara lo que ya
// dominas. Tú lees la comanda y eliges cada parte de la receta; los gestos de cada etapa los hace ella, en la barra y en 3D,
// con sus sonidos: la taza entera en unos 3 segundos. Aquí, solo cuentas: la postura de cada objeto en cada momento del gesto
// (de 0 a 1, de su postura inicial a la final de `completar`) y los sonidos que suenan por el camino.
//
// 1.131 (Francisco, 14-11-2026: «quiero que cuando pilar prepara el café ella se haga más orgánico y no tan robótico»): ya no
// va a velocidad constante ni repite el mismo movimiento al milímetro. Cada gesto lleva el ritmo de una mano: arranca, trabaja
// con pequeñas irregularidades y se asienta (`tiempoPilar`); se prepara antes de apretar, se pasa un poco y vuelve, sostiene con
// un temblor leve, y cada sacudida, inmersión o golpe es algo distinto del anterior. `semilla` (0 a 1) cambia todo eso en cada
// taza, así que dos tazas nunca son iguales. Los sonidos salen del propio movimiento (el clic de la manivela, cuando la
// manivela pasa de verdad por ese punto), no de un reloj. Al final de cada gesto la postura es la misma de siempre.
import { MEDIDAS, crearGesto } from './cafeGestos';

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;
/** Suave al empezar y al acabar. */
const suave = (t) => {
  const u = clamp(t);
  return u * u * (3 - 2 * u);
};
/** Llega un poco más allá y vuelve (`k`, cuánto se pasa). */
const pasaYVuelve = (t, k = 1.4) => {
  const u = clamp(t) - 1;
  return 1 + (k + 1) * u ** 3 + k * u ** 2;
};
/** Un número de 0 a 1 que depende de `n` y de la semilla (siempre el mismo para los dos). */
const azar = (n, s) => {
  const x = Math.sin((n + 1) * 12.9898 + s * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * El tiempo de la mano: de 0 a 1 como `t`, pero sin velocidad constante. Arranca despacio, va algo más rápida en medio y se
 * asienta; además, un pulso lento (distinto en cada taza) la adelanta o la retrasa un poco. Siempre hacia delante.
 */
export function tiempoPilar(t, semilla = 0.5) {
  const u = clamp(t);
  const base = 0.35 * u + 0.65 * suave(u);
  const pulso = 0.03 * Math.sin(TAU * (1.5 + semilla) * u + semilla * TAU) * Math.sin(Math.PI * u);
  return clamp(base + pulso);
}

/** Cuánto tarda Pilar en cada gesto (ms, de media): la taza de café con leche y canela, unos 3 s con los respiros. */
export const PILAR_MS = {
  manivela: 420,
  apisonar: 300,
  palanca: 620,
  cuchara: 340,
  tetera: 600,
  colador: 440,
  vapor: 560,
  verter: 440,
  agitar: 380,
  hilo: 440,
  molinillo: 480,
  cazo: 560,
  batir: 460,
  rascar: 440,
  coctelera: 520,
  mortero: 460,
  soplete: 520,
};
/** El respiro entre un gesto y el siguiente cuando prepara Pilar (de media; más corto que a mano). */
export const PILAR_RESPIRO_MS = 150;
/**
 * 1.131: lo más que espera Pilar a que la cámara llegue a la siguiente herramienta antes de empezar el gesto (si sigue en el
 * mismo sitio, nada; si va de la balda de las jarras a la lanza de vapor, casi todo).
 */
export const PILAR_MIRA_MS = 420;
/** Lo que dura este gesto esta vez y el respiro de después: nunca dos iguales (entre −10 % y +12 %; el respiro, más suelto). */
export const duracionPilar = (tipo, semilla = 0.5) => Math.round((PILAR_MS[tipo] ?? 450) * (0.9 + 0.22 * semilla));
export const respiroPilar = (semilla = 0.5) => Math.round(PILAR_RESPIRO_MS * (0.7 + 0.8 * semilla));

/**
 * Coger, sostener y dejar: 0 → `alto` en [0, `a`] (se pasa un poco y vuelve), un temblor leve de la mano en medio (nada en los
 * bordes) y de vuelta a 0 en [`b`, 1]; con `rebote`, lo que se suelta (la palanca) se pasa un poco al volver.
 */
function sostener(u, { a = 0.2, b = 0.84, alto = 1, temblor = 0.02, s = 0.5, rebote = 0 }) {
  if (u <= a) return alto * pasaYVuelve(u / a, 0.9);
  if (u < b) return alto * (1 - temblor * Math.sin((Math.PI * (u - a)) / (b - a)) * (0.5 + 0.5 * Math.sin(TAU * 2.6 * (u - a) + s * TAU)));
  const r = (u - b) / (1 - b);
  return alto * (1 - suave(r)) - rebote * Math.sin(Math.PI * clamp((r - 0.6) / 0.4));
}

/** Vueltas de muñeca: el ángulo con la mano que va un poco más rápida en la bajada y más lenta en la subida. */
const vueltas = (u, n, k = 0.18) => {
  const a = u * TAU * n;
  return a + k * Math.sin(a);
};

/** La postura del objeto del gesto `tipo` en el momento `t` (0 a 1). `arte`: el dibujo de la leche; `semilla`: esta taza. */
export function poseAuto(tipo, t, { arte = 'corazon', semilla = 0.5 } = {}) {
  const s = semilla;
  const u = tiempoPilar(t, s);
  switch (tipo) {
    case 'manivela':
      return { angulo: vueltas(u, MEDIDAS.vueltas), molido: u };
    case 'apisonar': {
      // Apoya, sube un pelo, aprieta (se pasa un poco), afloja y vuelve a apretar
      if (u < 0.14) return { bajada: -0.12 * Math.sin((Math.PI * u) / 0.14) };
      if (u < 0.6) return { bajada: pasaYVuelve((u - 0.14) / 0.46, 1.1) };
      if (u < 0.8) return { bajada: 1 - 0.16 * Math.sin((Math.PI * (u - 0.6)) / 0.2) };
      return { bajada: 1 };
    }
    case 'palanca':
      // La baja (y se pasa un poco), la sostiene con un temblor mientras cae el café y la suelta, que rebota al volver
      return { bajada: sostener(u, { a: 0.2, b: 0.84, temblor: 0.025, s, rebote: 0.06 }), extraido: suave(clamp((u - 0.2) / 0.64)) };
    case 'cuchara':
      return { t: clamp(suave(u) + 0.04 * Math.sin(Math.PI * clamp((u - 0.68) / 0.32)), 0, 1.04) };
    case 'tetera':
      return { alzada: sostener(u, { a: 0.2, b: 0.84, alto: 0.8, temblor: 0.06, s }), lleno: suave(clamp((u - 0.2) / 0.64)) };
    case 'colador': {
      // Cada inmersión, de un hondo distinto
      const n = MEDIDAS.vecesColador;
      const j = Math.min(n - 1, Math.floor(u * n));
      return { altura: -Math.abs(Math.sin(Math.PI * n * u)) * (0.62 + 0.3 * azar(j, s)), inmersiones: Math.floor(u * n) };
    }
    case 'vapor':
      // La jarra sube y baja un poco bajo la lanza mientras se crema
      return { inclina: sostener(u, { a: 0.18, b: 0.86, alto: 0.7, temblor: 0.12, s }), espuma: suave(clamp((u - 0.18) / 0.68)) };
    case 'verter': {
      const vaiven = Math.sin(TAU * 2 * u);
      const pulso = 0.06 * Math.sin(TAU * 1.5 * u + s * TAU) * Math.sin(Math.PI * u);
      return { vertido: suave(u), x: arte === 'hoja' ? vaiven * 0.5 : pulso, ondas: arte === 'hoja' ? Math.floor(u * (MEDIDAS.ondasHoja + 1)) : 0, arte: u >= 1 ? arte : null };
    }
    case 'agitar': {
      // Cada sacudida, con su fuerza
      const n = MEDIDAS.vecesAgitar;
      const j = Math.min(n - 1, Math.floor(u * n));
      return { x: Math.sin(Math.PI * n * u) * (0.78 + 0.22 * azar(j, s)), golpes: Math.floor(u * n) };
    }
    case 'hilo': {
      // La espiral de miel, a pulso: ni el radio ni el paso son exactos
      const n = Math.max(1, Math.round(u * 24));
      return {
        puntos: Array.from({ length: n }, (_, j) => {
          const a = j * 0.55 + 0.06 * Math.sin(j * 0.9 + s * TAU);
          const r = 0.15 + j * 0.028 + 0.014 * Math.sin(j * 1.7 + s * TAU);
          return [Math.cos(a) * r, Math.sin(a) * r];
        }),
      };
    }
    case 'molinillo':
      return { angulo: vueltas(u, MEDIDAS.vueltasMolinillo, 0.14), espeso: u };
    case 'cazo':
      return { inclina: sostener(u, { a: 0.18, b: 0.86, alto: 0.8, temblor: 0.05, s }), servido: suave(clamp((u - 0.18) / 0.68)) };
    case 'batir':
      return { angulo: vueltas(u, MEDIDAS.vueltasBatir, 0.22), montada: u };
    case 'rascar': {
      // Cada pasada del cuchillo, suave y con una pausa breve al final
      const n = MEDIDAS.trazosRascar;
      const r = Math.min(n, Math.floor(u * n));
      return { t: u >= 1 ? 1 : suave(clamp(((u * n) % 1) / 0.82)), raspados: r };
    }
    case 'coctelera': {
      const n = MEDIDAS.vecesCoctelera;
      const j = Math.min(n - 1, Math.floor(u * n));
      return { x: Math.sin(Math.PI * n * u) * (0.8 + 0.2 * azar(j + 7, s)), agitado: u, golpes: Math.floor(u * n) };
    }
    case 'mortero': {
      // Sube la mano (más de la mitad del golpe) y la deja caer
      const n = MEDIDAS.golpesMortero;
      const g = Math.floor(u * n);
      const dentro = (u * n) % 1;
      return { maza: u >= 1 ? 0 : dentro >= 0.55 ? 1 : 0, golpes: Math.min(n, g) };
    }
    case 'soplete':
      return { x: Math.sin(Math.PI * MEDIDAS.vecesSoplete * u) * (0.8 - 0.1 * Math.sin(TAU * u + s * TAU) * Math.sin(Math.PI * u)), dorado: u, llama: u < 1 };
    default:
      return crearGesto(tipo).completar().pose;
  }
}

/**
 * Los sonidos de cada gesto: [sonido, cuándo]. `cuándo` es una lista de momentos (del tiempo de la mano) o una cuenta que
 * avanza con el movimiento (suena cada vez que pasa de un entero al siguiente): las vueltas de la manivela, cada sacudida al
 * llegar a su extremo, cada golpe del mortero al caer.
 */
const giros = (n, porVuelta, k) => (u) => (vueltas(u, n, k) / TAU) * porVuelta + 1e-9;
const ciclos = (n, desfase = 0.5) => (u) => u * n + desfase + 1e-9;
const SONIDOS = {
  manivela: ['clic', giros(MEDIDAS.vueltas, 8, 0.18)],
  apisonar: ['golpe', [0.42]],
  palanca: ['abajo', [0.2]],
  cuchara: ['hojas', [0.9]],
  colador: ['plop', ciclos(MEDIDAS.vecesColador)],
  verter: ['onda', ciclos(3)],
  agitar: ['sacudida', ciclos(MEDIDAS.vecesAgitar)],
  hilo: ['hilo', ciclos(5)],
  molinillo: ['remueve', giros(MEDIDAS.vueltasMolinillo, 4, 0.14)],
  batir: ['bate', giros(MEDIDAS.vueltasBatir, 4, 0.22)],
  rascar: ['raspa', ciclos(MEDIDAS.trazosRascar)],
  coctelera: ['hielo', ciclos(MEDIDAS.vecesCoctelera)],
  mortero: ['machaca', ciclos(MEDIDAS.golpesMortero, 0.45)],
  soplete: ['chispa', [0.02]],
};
/** Lo que suena entre `t0` y `t1` (sin contar t0), en el tiempo de la mano de esta taza. */
export function sonidosEntre(tipo, t0, t1, semilla = 0.5) {
  const def = SONIDOS[tipo];
  if (!def || t1 <= t0) return [];
  const [u0, u1] = [tiempoPilar(t0, semilla), tiempoPilar(t1, semilla)];
  const [nombre, cuando] = def;
  if (Array.isArray(cuando)) return cuando.filter((m) => m > u0 && m <= u1).map(() => nombre);
  const n = Math.max(0, Math.floor(cuando(u1)) - Math.floor(cuando(u0)));
  return Array.from({ length: n }, () => nombre);
}
/** Los que suenan mientras dura (el café que cae, el agua, el vapor, el chocolate, la llama): entre qué momentos de la mano. */
export const BUCLE_PILAR = { palanca: [0.2, 0.84], tetera: [0.2, 0.84], vapor: [0.18, 0.86], cazo: [0.18, 0.86], soplete: [0, 0.98] };
