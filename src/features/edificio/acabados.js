// Acabados de los muebles (1.86; CLAUDE.md, «Identidad de los muebles»). Una copia con acabado es el mismo mueble con otra piel:
// sus colores se pasan a los del acabado conservando luces y sombras, y en el piso lleva destellos. Sale en 1 de cada 20 copias
// de los sobres y la tienda vende siempre liso. La regla de verdad, en 20261115120000_edificio_acabados.sql.
import { isMistico } from './catalog';

export const ACABADO_PROB = 0.05;

/** `tonos`: de sombra a luz. `peso`: de cada 100 copias con acabado, cuántas son de este. */
export const ACABADOS = [
  { id: 'salitre', nombre: 'Salitre', peso: 45, tonos: ['#143f4c', '#2c7f86', '#7fd0c4', '#e4fbf0'], chispa: '#d9fff4' },
  { id: 'sol-de-tarde', nombre: 'Sol de tarde', peso: 30, tonos: ['#6d2a12', '#c8641c', '#f5b13c', '#fff0b0'], chispa: '#fff3b8' },
  { id: 'lacado', nombre: 'Lacado de puerto', peso: 20, tonos: ['#2a0710', '#8c1426', '#df3a3a', '#ffc9a0'], chispa: '#ffd98a' },
  { id: 'nacar', nombre: 'Nácar', peso: 5, tonos: ['#4a3f86', '#8f8fe0', '#efc2e6', '#ffffff'], chispa: '#ffffff' },
];

export const acabadoOf = (id) => ACABADOS.find((a) => a.id === id) ?? null;

/** ¿Puede llevar acabado? Los mismos que entran en la Lonja: hasta «raro», sin sagas ni mascotas. */
export function admiteAcabado(cat) {
  if (!cat || cat.set || cat.mascota || cat.compania || isMistico(cat)) return false;
  return ['comun', 'poco-comun', 'raro'].includes(cat.rareza ?? 'comun');
}

const rgb = (hex) => [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
const memo = new Map();

/** El color `[r, g, b]` en la piel de un acabado: misma luz, otro tono. Sin acabado, o si no es un color, lo deja igual. */
export function tintar(color, acabado) {
  const a = acabadoOf(acabado);
  if (!a || !Array.isArray(color)) return color;
  const key = a.id + color.join();
  if (memo.has(key)) return memo.get(key);
  const [r, g, b] = color;
  // La luz se estira un poco para que el mueble no quede plano, y se reparte por los cuatro tonos del acabado
  const luz = Math.min(0.999, Math.max(0, ((0.3 * r + 0.59 * g + 0.11 * b) / 255 - 0.08) * 1.25));
  const pos = luz * (a.tonos.length - 1);
  const k = Math.floor(pos);
  const [c0, c1] = [rgb(a.tonos[k]), rgb(a.tonos[k + 1])];
  const out = c0.map((v, n) => Math.round(v + (c1[n] - v) * (pos - k)));
  memo.set(key, out);
  return out;
}

/** Las probabilidades para enseñarlas: «1 de cada 20» y, de esas, cada acabado. */
export const acabadosTexto = () => `1 de cada ${Math.round(1 / ACABADO_PROB)} copias trae un acabado: ${ACABADOS.map((a) => `${a.nombre} ${a.peso} %`).join(', ')}.`;
