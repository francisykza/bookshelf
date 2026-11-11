// La ruleta de premios del casino (1.109, SPEC §109; plan en docs/qa/casino-3d.md, bloque c): un giro a la semana, solo a
// solas. Decide el servidor (supabase/migrations/20261201120000_casino_ruleta.sql); la rueda de la sala solo enseña lo
// decidido. Estas son las mismas casillas, en el mismo orden y con las mismas probabilidades que
// `piso_casino_ruleta_casillas` (una prueba lo comprueba).
import { JERSEYS, prendaNombre } from '../actor';
import { catalogItem } from '../catalog';

/** Las nueve casillas, en el orden de la rueda (la 0 arriba con la rueda quieta y, desde ahí, en el sentido del reloj). */
export const RULETA = [
  { id: 'fichas:20', tipo: 'fichas', cantidad: 20, peso: 28 },
  { id: 'jersey:22', tipo: 'prenda', cantidad: 1, peso: 7 },
  { id: 'fichas:40', tipo: 'fichas', cantidad: 40, peso: 20 },
  { id: 'lampara-flecos', tipo: 'mueble', cantidad: 1, peso: 6 },
  { id: 'garbanzos:100', tipo: 'garbanzos', cantidad: 100, peso: 20 },
  { id: 'ruleta-sobremesa', tipo: 'mueble', cantidad: 1, peso: 5 },
  { id: 'fichas:80', tipo: 'fichas', cantidad: 80, peso: 9 },
  { id: 'reloj-deco', tipo: 'mueble', cantidad: 1, peso: 3 },
  // La más rara: el mapache crupier, un compañero legendario que te acompaña
  { id: 'mapache-crupier', tipo: 'companero', cantidad: 1, peso: 2 },
];
/** Lo que se da en fichas si el premio ya lo tenías (el giro no se pierde). */
export const RULETA_REPETIDO = 40;
/** La casilla más rara (la del mapache): se pinta dorada. */
export const CASILLA_RARA = 8;

/** El nombre de lo que trae una casilla. */
export function premioNombre(c) {
  if (c.tipo === 'fichas') return `${c.cantidad} fichas`;
  if (c.tipo === 'garbanzos') return `${c.cantidad} garbanzos`;
  if (c.tipo === 'prenda') {
    const [k, v] = c.id.split(':');
    return (k === 'jersey' && JERSEYS.find((j) => j.id === Number(v))?.nombre) || prendaNombre(c.id);
  }
  return catalogItem(c.id)?.nombre ?? c.id;
}

/** El lunes (AAAA-MM-DD) de la semana de `dia` (AAAA-MM-DD). */
export function lunesDe(dia) {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/**
 * El ángulo (radianes, en el sentido contrario al reloj visto de frente) que deja la casilla `n` bajo la flecha de arriba,
 * más `vueltas` enteras desde `desde`, con un desvío dentro de la casilla (`desvio` de -0,5 a 0,5 de su ancho). La rueda se
 * para siempre dentro de su casilla y lejos de los bordes (el desvío se limita a ±0,3): nada de quedarse en la raya.
 */
export function anguloFinal(n, desde = 0, vueltas = 5, desvio = 0) {
  const paso = (2 * Math.PI) / RULETA.length;
  const objetivo = (n + 0.5 + Math.max(-0.3, Math.min(0.3, desvio))) * paso;
  const base = desde - (((desde % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI));
  let a = base + objetivo;
  while (a < desde + vueltas * 2 * Math.PI) a += 2 * Math.PI;
  return a;
}

/** Qué casilla queda bajo la flecha con la rueda girada `angulo` radianes. */
export function casillaEn(angulo) {
  const paso = (2 * Math.PI) / RULETA.length;
  const a = ((angulo % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return Math.floor(a / paso) % RULETA.length;
}

/**
 * La frenada: una curva que solo frena (su velocidad baja sin parar desde el primer instante hasta cero), sin pausas ni
 * acelerones cerca del final. `t` de 0 a 1.
 */
export const frenada = (t) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;
