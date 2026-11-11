// 2.ª ampliación del Almacén del Puerto (encargo de Francisco del 10-11-2026), bloque 2: la planta de ropa, abajo. Aquí está
// el plano de la ropa, sin dibujo: las zonas (como en una tienda de ropa), qué prendas cuelgan en cada una y de dónde sale
// cada prenda. Lo usan la escena (`almacen3d.js`) y los papeles de la planta (`RopaPapeles.jsx`).
// Mundo de la app, como en `almacenLayout.js`: x a lo ancho, y a lo hondo, z arriba (la planta, en z = BAJO.z).
import { COMPLEMENTOS, JERSEYS, PANTALONES, ROPA_CASINO, ROPA_CHISTERAS, ROPA_ESTIBA, ROPA_RULETA, ROPA_TIENDA, isPrenda, prendaKey } from '../actor';
import { BAJO } from './almacenLayout';

const FIESTA = [...ROPA_CASINO, ...ROPA_ESTIBA, ...ROPA_RULETA, ...ROPA_CHISTERAS];
const deLaPlanta = (key, ids) => ids.map((id) => prendaKey(key, id)).filter((p) => !FIESTA.includes(p));

/**
 * Las zonas de la planta. `area`: lo que ocupa en el suelo (x0, y0, x1, y1), con su suelo (`suelo`); `mira`: dónde se para
 * quien va a verla (un punto de los pasillos de abajo) y hacia dónde mira (`cara`); `tag`: dónde va su letrero (x, y, z).
 */
export const ZONAS_ROPA = [
  {
    id: 'jerseis',
    nombre: 'Jerséis',
    donde: 'Pared izquierda',
    prendas: deLaPlanta('jersey', JERSEYS.map((j) => j.id)),
    area: [0.1, 4.4, 3.6, 21.6],
    suelo: [128, 150, 112],
    mira: [5, 12.6],
    cara: [0, 12.6],
    tag: [1.6, 12.6, BAJO.z + 3.25],
  },
  {
    id: 'pantalones',
    nombre: 'Pantalones',
    donde: 'Isla de la izquierda',
    prendas: deLaPlanta('pantalon', PANTALONES.map((p) => p.id)),
    area: [6.2, 10.3, 10.6, 21.5],
    suelo: [176, 150, 112],
    mira: [11.5, 15.6],
    cara: [8.4, 15.6],
    tag: [8.4, 15.6, BAJO.z + 3.1],
  },
  {
    id: 'complementos',
    nombre: 'Gafas y complementos',
    donde: 'Al fondo, en la vitrina',
    prendas: ['gafas:true', ...deLaPlanta('complemento', COMPLEMENTOS.map((c) => c.id).filter((c) => c !== 'ninguno'))],
    area: [6.2, 4.5, 10.6, 8.3],
    suelo: [184, 98, 70],
    mira: [8.4, 9.0],
    cara: [8.4, 6.4],
    tag: [8.4, 6.4, BAJO.z + 2.8],
  },
  {
    id: 'fiesta',
    nombre: 'Fiesta y faena',
    donde: 'Junto a las escaleras',
    prendas: FIESTA,
    area: [12.3, 10.7, 15.8, 21.3],
    suelo: [150, 50, 58],
    mira: [11.5, 15.6],
    cara: [14.2, 15.6],
    tag: [14.0, 15.6, BAJO.z + 3.1],
  },
];
export const zonaRopa = (id) => ZONAS_ROPA.find((z) => z.id === id) ?? null;

/** El escaparate de delante: maniquíes con los conjuntos que se ganan, mirando hacia dentro. */
export const ESCAPARATE = {
  area: [5.8, 23.9, 15.4, 25.7],
  maniquies: [
    { x: 7.0, look: { jersey: 14, pantalon: 8, complemento: 'capa', gafas: false } },
    { x: 9.4, look: { jersey: 15, pantalon: 9, complemento: 'visera', gafas: false } },
    { x: 11.8, look: { jersey: 16, pantalon: 1, complemento: 'fedora', gafas: true } },
    { x: 14.2, look: { jersey: 17, pantalon: 10, complemento: 'gorro-estibador', gafas: false } },
  ],
};

/** Cuántas prendas caben en la cesta. */
export const CESTA_MAX = 8;

const GAFAS_SI = 'gafas:true';
/** El nombre de una prenda de la planta: «Jersey coral», «Pantalón beis», «Gafas», «Boina»… */
export function nombrePrenda(p) {
  if (p === GAFAS_SI) return 'Gafas redondas';
  const [key, raw] = p.split(':');
  if (key === 'jersey') return `Jersey ${(JERSEYS.find((j) => j.id === Number(raw))?.nombre ?? '').toLowerCase()}`;
  if (key === 'pantalon') return `Pantalón ${(PANTALONES.find((j) => j.id === Number(raw))?.nombre ?? '').toLowerCase()}`;
  return COMPLEMENTOS.find((c) => c.id === raw)?.nombre ?? p;
}
/** La prenda como cambio del aspecto: { jersey: 12 }, { gafas: true }, { complemento: 'boina' }. */
export function cambioDe(p) {
  const [key, raw] = p.split(':');
  if (key === 'gafas') return { gafas: raw === 'true' };
  return { [key]: key === 'complemento' ? raw : Number(raw) };
}
/** ¿Se gana (misiones, casino, estiba) o es de serie? */
export const seGana = (p) => {
  const [key, raw] = p.split(':');
  return key !== 'gafas' && isPrenda(key, key === 'complemento' ? raw : Number(raw));
};
/** Bloque 3 · Lo que cuesta en tickets la ropa propia de la planta (null: no se vende). */
export const precioRopa = (p) => ROPA_TIENDA[p] ?? null;
/** De dónde sale: 'serie', 'misiones', 'casino', 'estiba', 'ruleta', 'chisteras' o 'tienda' (la ropa de la planta, con tickets). */
export function origenDe(p) {
  if (ROPA_TIENDA[p]) return 'tienda';
  if (ROPA_CASINO.includes(p)) return 'casino';
  if (ROPA_ESTIBA.includes(p)) return 'estiba';
  if (ROPA_RULETA.includes(p)) return 'ruleta';
  if (ROPA_CHISTERAS.includes(p)) return 'chisteras';
  return seGana(p) ? 'misiones' : 'serie';
}
export const ORIGEN_TEXTO = {
  serie: 'De serie: para todos',
  misiones: 'Se gana con las misiones del día',
  casino: 'Se cambia por fichas en la caja del casino',
  estiba: 'Se cambia por sellos en la pared de la Lonja',
  ruleta: 'Puede tocar en la ruleta del casino',
  chisteras: 'Se cambia por sellos de las chisteras del casino',
  tienda: 'De la planta: se compra con tickets',
};
/** ¿Es tuya? Lo de serie, siempre; lo que se gana, si está en `prendas`. */
export const esTuya = (p, prendas) => !seGana(p) || (prendas ?? []).includes(p);
/** La cesta, limpia: solo prendas de la planta, sin repetir y como mucho CESTA_MAX. */
const TODAS = new Set(ZONAS_ROPA.flatMap((z) => z.prendas));
export const cestaSana = (lista) => (Array.isArray(lista) ? [...new Set(lista.filter((p) => TODAS.has(p)))].slice(0, CESTA_MAX) : []);
