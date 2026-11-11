// «Salir a pie» (Exteriores en 3D, bloque 2): el piso 3D marca que sales por tu puerta y el portal 3D, al montarse, sabe
// que tiene que empezar en el umbral del edificio y no con la llegada por el muelle. Caduca sola: si el portal no llega a
// montarse enseguida (otro camino, un error), la próxima vez se llega como siempre.
const VIGENCIA_MS = 8000;
let saliendo = 0;

/** Lo llama el piso justo antes de ir al edificio por su puerta. */
export function marcarSalida() {
  saliendo = Date.now();
}

/** ¿Vienes de salir por la puerta de tu piso? No la gasta: la olvida `olvidarSalida` al terminar de salir. */
export function vienesDeSalir() {
  return saliendo > 0 && Date.now() - saliendo < VIGENCIA_MS;
}

export function olvidarSalida() {
  saliendo = 0;
}
