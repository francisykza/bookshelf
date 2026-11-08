// Economía del edificio (1.67, SPEC §67; fases 2 y 4 de docs/qa/economia-muebles.md): tickets, tienda del bajo y sobres.
// Solo números y textos: la regla de verdad (cobrar, sortear, dar copias) está en el servidor
// (supabase/migrations/20261104120000_edificio_tienda.sql), y una prueba comprueba que estos números coinciden con los
// suyos. Los tickets solo se ganan leyendo y nunca se compran con dinero.
import { isRetirado } from './retirados';
import { CATALOG, isEspecial, isMistico } from './catalog';

export const RAREZAS = [
  { id: 'comun', nombre: 'Común', precio: 20, reciclar: 3 },
  { id: 'poco-comun', nombre: 'Poco común', precio: 40, reciclar: 8 },
  { id: 'raro', nombre: 'Raro', precio: null, reciclar: 20 },
];

// Los místicos (docs/qa/misticos.md): no se compran, no se reciclan ni se regalan, para que no sean moneda
export const RAREZAS_MISTICAS = [
  { id: 'mistico', nombre: 'Místico', precio: null, reciclar: null },
  { id: 'legendario', nombre: 'Místico legendario', precio: null, reciclar: null },
];

// Los premios (1.79, la placa de la suite de la semana): tampoco son moneda
export const RAREZAS_ESPECIALES = [{ id: 'especial', nombre: 'Premio', precio: null, reciclar: null }];

export const MISION_TICKETS = 12;
export const BIENVENIDA = 30;
/** El mueble número PITY seguido sin nada raro es raro seguro (se cuenta entre todos los sobres). */
export const PITY = 15;

export const rarezaOf = (cat) => cat?.rareza ?? 'comun';
export const rarezaInfo = (id) => RAREZAS.find((r) => r.id === id) ?? RAREZAS_MISTICAS.find((r) => r.id === id) ?? RAREZAS_ESPECIALES.find((r) => r.id === id) ?? RAREZAS[0];

const sinSaga = CATALOG.filter((c) => !c.set && !isMistico(c) && !isEspecial(c));
const deCategorias = (...cats) => sinSaga.filter((c) => cats.includes(c.cat)).map((c) => c.id);

/** La temporada de sobres a la venta (cada temporada trae sus sobres; los de antes pueden volver o no). */
export const TEMPORADA = { id: 't1', nombre: 'Otoño en el puerto', corto: 'Temporada 1' };

/**
 * Los sobres de la pared (decisión de Francisco del 1-11-2026: por tipos y temporadas, y alguno más caro con más
 * posibilidades de lo bueno). Cada mueble de un sobre sale de su lista con estas probabilidades por rareza; si el sobre
 * no tiene nada de la rareza que toca, sale de todo el catálogo («de fuera del sobre»). Se abre de 1 en 1 o de 5 en
 * 5 (en el de 5, si los cuatro primeros son comunes, el quinto es poco común).
 */
export const SOBRES = [
  {
    id: 'salon',
    nombre: 'Sala de estar',
    portada: 'sofa',
    color: [96, 132, 84],
    coste1: 10,
    coste5: 45,
    prob: { raro: 0.06, 'poco-comun': 0.24 },
    muebles: deCategorias('asientos', 'mesas'),
    dice: '¡Este va de sillones, mesas y estanterías! Para montar el rincón de leer de toda la vida.',
  },
  {
    id: 'luces',
    nombre: 'Luces del puerto',
    portada: 'lampara-mesa',
    color: [214, 140, 60],
    coste1: 10,
    coste5: 45,
    prob: { raro: 0.06, 'poco-comun': 0.24 },
    muebles: deCategorias('luz', 'pared'),
    dice: 'Lámparas, cuadros y alguna guirnalda. Para cuando anochece y aún te quedan capítulos.',
  },
  {
    id: 'balcon',
    nombre: 'Balcón y detalles',
    portada: 'planta-grande',
    color: [86, 112, 142],
    coste1: 10,
    coste5: 45,
    prob: { raro: 0.06, 'poco-comun': 0.24 },
    muebles: deCategorias('plantas', 'alfombras', 'detalles'),
    dice: 'Plantas, alfombras y cositas para la mesa. Y dicen que a veces trae un gato dormido...',
  },
  {
    id: 'coleccion',
    nombre: 'Edición coleccionista',
    portada: 'gato',
    color: [201, 138, 28],
    coste1: 25,
    coste5: 110,
    // Místicos (1.73, cifras aprobadas por Francisco): 1 % por mueble, restado de lo raro; 1 de cada 4, legendario
    prob: { raro: 0.14, 'poco-comun': 0.35, mistico: 0.01 },
    legendario: 0.25,
    muebles: sinSaga.map((c) => c.id),
    dice: 'El caro de la casa: de todo un poco, bastantes más papeletas para lo poco común y lo raro... y, muy de vez en cuando, algo que no es de este mundo.',
  },
];

export const sobreOf = (id) => SOBRES.find((s) => s.id === id) ?? null;
export const costeDe = (sobre, cuantos) => (cuantos === 5 ? sobre.coste5 : sobre.coste1);
const probDe = (sobre, rareza) => (rareza === 'comun' ? 1 - sobre.prob.raro - sobre.prob['poco-comun'] - (sobre.prob.mistico ?? 0) : sobre.prob[rareza]);

/** Lo que se vende en la tienda: todo lo que no es de sagas y tiene precio (lo raro solo sale en sobres). */
export const TIENDA = sinSaga.filter((c) => rarezaInfo(rarezaOf(c)).precio != null && !isRetirado(c.id));
export const precioDe = (id) => {
  const cat = CATALOG.find((c) => c.id === id);
  return cat && !cat.set ? rarezaInfo(rarezaOf(cat)).precio : null;
};

/** Qué puede salir en un sobre, por rareza, con su probabilidad por mueble (para enseñarla en la tienda). */
export function oddsTable(sobre) {
  const misticos = sobre.prob.mistico
    ? RAREZAS_MISTICAS.map((r) => {
        const prob = sobre.prob.mistico * (r.id === 'legendario' ? sobre.legendario : 1 - sobre.legendario);
        // Lo de la caja del casino (el conejo) no sale en sobres
        const items = CATALOG.filter((c) => c.rareza === r.id && !c.casino);
        return { ...r, prob, items, fuera: false, cada: items.length ? prob / items.length : 0 };
      })
    : [];
  const normales = RAREZAS.map((r) => {
    const propios = sinSaga.filter((c) => sobre.muebles.includes(c.id) && rarezaOf(c) === r.id);
    const fuera = !propios.length;
    const items = fuera ? sinSaga.filter((c) => rarezaOf(c) === r.id) : propios;
    const prob = probDe(sobre, r.id);
    return { ...r, prob, items, fuera, cada: items.length ? prob / items.length : 0 };
  });
  return [...normales, ...misticos];
}

/** Cuántos muebles faltan, como mucho, para algo raro seguro. */
export const sobresHastaRaro = (sinRaro) => Math.max(1, PITY - (sinRaro ?? 0));

export const ticketsText = (n) => `${n} ${n === 1 ? 'ticket' : 'tickets'}`;
