// La estiba (1.86): las reglas del juego, sin dibujo. La bodega del día y los sellos los decide el servidor
// (20261116120000_hotel_estiba.sql); aquí se calcula lo mismo para enseñar la carga mientras se coloca.

/** Gira una forma un cuarto de vuelta `rot` veces y la deja pegada a la esquina (igual que piso_estiba_girar). */
export function girar(celdas, rot = 0) {
  const r = celdas.map(([x, y]) => [[x, -y, -x, y][rot], [y, x, -y, -x][rot]]);
  const ax = Math.min(...r.map((c) => c[0]));
  const ay = Math.min(...r.map((c) => c[1]));
  return r.map(([a, b]) => [a - ax, b - ay]).sort((p, q) => p[1] - q[1] || p[0] - q[0]);
}

/** Los huecos que ocupa un bulto puesto en `x`, `y` con su giro. */
export const huecosDe = (pieza, x, y, rot) => girar(pieza.celdas, rot).map(([a, b]) => [x + a, y + b]);

const clave = ([x, y]) => `${x}:${y}`;

/** Los huecos ya ocupados por la carga, sin contar el bulto `salvo`. */
export function ocupados(bodega, carga, salvo = null) {
  const set = new Set();
  for (const c of carga) {
    if (c.pieza === salvo) continue;
    const pieza = bodega.piezas.find((p) => p.id === c.pieza);
    if (pieza) for (const h of huecosDe(pieza, c.x, c.y, c.rot)) set.add(clave(h));
  }
  return set;
}

/** ¿Cabe ese bulto ahí? Dentro de la bodega, sin pisar el casco ni otro bulto. */
export function cabe(bodega, carga, pieza, x, y, rot) {
  const llenos = ocupados(bodega, carga, pieza.id);
  const casco = new Set(bodega.bloqueadas.map(clave));
  return huecosDe(pieza, x, y, rot).every((h) => h[0] >= 0 && h[1] >= 0 && h[0] < bodega.w && h[1] < bodega.h && !casco.has(clave(h)) && !llenos.has(clave(h)));
}

/** Cuántos huecos llena la carga. */
export const huecosLlenos = (bodega, carga) => ocupados(bodega, carga).size;

/** El nivel que alcanza una carga (`null` si no llega a media bodega) y los sellos que da, como piso_estiba_sellos. */
export function nivelDe(bodega, celdas) {
  const pct = (celdas * 100) / bodega.total;
  const nivel = [...bodega.niveles].reverse().find((n) => pct >= n.desde) ?? null;
  return { nivel, sellos: nivel ? nivel.sellos : 1, pct: Math.floor(pct) };
}

/** Qué mueble va en cada bulto (solo para dibujarlo y nombrarlo), por tamaño. */
const BULTOS = {
  1: [{ id: 'silla', nombre: 'Silla' }],
  2: [
    { id: 'silla', nombre: 'Silla' },
    { id: 'lampara-pie', nombre: 'Lámpara' },
  ],
  3: [
    { id: 'sofa', nombre: 'Sofá' },
    { id: 'mesa', nombre: 'Mesa' },
  ],
  4: [
    { id: 'estanteria', nombre: 'Estantería' },
    { id: 'mesa', nombre: 'Mesa grande' },
  ],
  5: [
    { id: 'cama', nombre: 'Cama' },
    { id: 'estanteria', nombre: 'Librería' },
  ],
  6: [{ id: 'cama', nombre: 'Cama grande' }],
};
export function bultoDe(pieza) {
  const lista = BULTOS[Math.min(6, pieza.celdas.length)];
  return lista[pieza.id % lista.length];
}

export const sellosDe = (n) => `${n} ${n === 1 ? 'sello' : 'sellos'}`;

/**
 * La pared de premios. Las prendas y la gaviota llevan los precios de piso_estiba_premios (una prueba lo comprueba); son
 * «clave:valor» del aspecto (actor.js) o ids del catálogo. Se tienen una vez.
 */
export const PARED = [
  { id: 'complemento:gorro-estibador', tipo: 'prenda', precio: 24, nombre: 'Gorro de estibador', texto: 'De lana gruesa, para el relente del muelle.' },
  { id: 'pantalon:10', tipo: 'prenda', precio: 28, nombre: 'Mahón de faena', texto: 'Azul de trabajo, de los que aguantan.' },
  { id: 'jersey:17', tipo: 'prenda', precio: 36, nombre: 'Jersey de rayas', texto: 'Crudo con rayas marineras.' },
  { id: 'gaviota-puerto', tipo: 'companero', precio: 120, nombre: 'Gaviota del puerto', texto: 'Te sigue a todas partes y no sale en ningún sobre.' },
];
