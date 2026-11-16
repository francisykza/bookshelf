// 1.141 (§141): los cafés de los demás (Francisco, 16-11-2026: «poder ver las cafeterias de los demás y poder tener un ranking
// de las cafeterias que más nivel tienen y más monedas acumulan según el edificio»). Aquí, solo reglas (sin React ni Three):
// las tablas del ranking y la balda de un café visitado, tal como la dibuja la escena.
import { libroDelCatalogo } from './cafeCatalogoLibros';

/** Los dos rankings: los vecinos de tu edificio y quien sigues. */
export const AMBITOS = [
  { id: 'edificio', nombre: 'Tu edificio' },
  { id: 'seguidos', nombre: 'A quien sigues' },
];
/** Un número con el punto de los miles (2.400), también con cuatro cifras. */
export const miles = (n) => String(Math.trunc(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
/**
 * Las tres tablas: nivel (y reputación), granos ganados en total y la reputación de esta semana. `cifra`, lo grande; `sub`, la
 * línea de debajo (1.142, Francisco: «en los ranking no se ve bien la reputación»); `detalle`, lo que se lee en voz alta.
 */
export const TABLAS = [
  { id: 'nivel', nombre: 'Nivel', cifra: (f) => `Nv ${f.nivel}`, sub: (f) => `${miles(f.reputacion)} rep.`, detalle: (f) => `${miles(f.reputacion)} de reputación` },
  { id: 'ganados', nombre: 'Granos ganados', cifra: (f) => miles(f.ganados), sub: () => 'granos', detalle: () => 'granos en total' },
  { id: 'semana', nombre: 'Esta semana', cifra: (f) => `+${miles(f.semana)}`, sub: () => 'de rep.', detalle: () => 'de reputación desde el lunes' },
];
const CLAVES = {
  nivel: (f) => [f.nivel, f.reputacion],
  ganados: (f) => [f.ganados, f.nivel],
  semana: (f) => [f.semana, f.nivel],
};

/**
 * Las filas de una tabla, de más a menos, con su puesto (los empates comparten puesto: 1, 2, 2, 4). A igualdad, por alias, para
 * que el orden no baile entre una carga y otra.
 */
export function ordenRanking(filas = [], tabla = 'nivel') {
  const clave = CLAVES[tabla] ?? CLAVES.nivel;
  const orden = filas.slice().sort((a, b) => {
    const [x, y] = [clave(a), clave(b)];
    return y[0] - x[0] || y[1] - x[1] || String(a.alias).localeCompare(String(b.alias), 'es') || String(a.userId).localeCompare(String(b.userId));
  });
  let puesto = 0;
  return orden.map((f, k) => {
    if (k === 0 || clave(f)[0] !== clave(orden[k - 1])[0] || clave(f)[1] !== clave(orden[k - 1])[1]) puesto = k + 1;
    return { ...f, puesto };
  });
}

/**
 * La balda de un café visitado, como la de `librosDeLaBalda`: los del catálogo, enteros (con su portada); los leídos de su
 * dueño llegan sin título ni clave, y aquí son lomos sin nombre de su género (claves `leido:genero:n`, para darles color).
 */
export function baldaDeVisita(libros = []) {
  const n = {};
  return libros
    .filter((b) => b && b.genero && b.balda > 0)
    .map((b) => {
      const cat = b.clave ? libroDelCatalogo(b.clave) : null;
      if (cat) return { ...cat, clave: b.clave, genero: b.genero, paginas: cat.pageCount > 0 ? cat.pageCount : null, ejemplares: b.balda, tuyo: false };
      n[b.genero] = (n[b.genero] ?? 0) + 1;
      const clave = `leido:${b.genero}:${n[b.genero]}`;
      return { id: clave, clave, title: clave, author: '', genero: b.genero, paginas: null, ejemplares: b.balda, tuyo: true, cover: null };
    });
}
