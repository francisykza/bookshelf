// Las dos piezas que solo existen en el piloto: el ordenador del escritorio y la puerta de salida. No están en CATALOG: no se
// venden, no salen en la balda y no necesitan fila en `piso_catalogo`. Si el piso pasa a la app, habrá que decidir su sitio.
import { registerCatalogItem } from '../edificio/catalog';
import { registerShape } from '../edificio/furniture';

const B = (x0, y0, z0, x1, y1, z1, c, extra = {}) => ({ b: [x0, y0, z0, x1, y1, z1], c, ...extra });
const shade = (c, k) => c.map((v) => Math.round(v * k));
const CREMA = [232, 218, 190];
const GRAFITO = [84, 80, 88];
const SALVIA = [150, 170, 140];
const MADERA = [150, 98, 60];
const NOGAL = [110, 70, 46];
const MADERA_CLARA = [190, 142, 96];
const LATON = [196, 156, 76];
const PANTALLA = [96, 150, 170];

registerCatalogItem({ id: 'ordenador', nombre: 'Ordenador', cat: 'detalles', capa: 'encima', w: 1, d: 1, tonos: [CREMA, GRAFITO, SALVIA] });
registerCatalogItem({ id: 'puerta-piso', nombre: 'Puerta de salida', cat: 'pared', capa: 'pared', w: 2, tonos: [MADERA, NOGAL, MADERA_CLARA] });

registerShape('ordenador', (T) => [
  B(0.34, 0.2, 0, 0.66, 0.46, 0.04, shade(T, 0.72)),
  B(0.44, 0.28, 0.04, 0.56, 0.36, 0.16, shade(T, 0.62)),
  B(0.1, 0.18, 0.16, 0.9, 0.42, 0.72, T),
  B(0.17, 0.42, 0.22, 0.83, 0.44, 0.66, PANTALLA, { grain: 0 }),
  B(0.18, 0.56, 0, 0.82, 0.86, 0.035, shade(T, 0.88)),
]);

registerShape('puerta-piso', (T) => [
  B(0.2, 0, 0, 1.8, 0.03, 3.02, T),
  B(0.36, 0, 1.68, 1.64, 0.05, 2.8, shade(T, 0.82)),
  B(0.36, 0, 0.24, 1.64, 0.05, 1.46, shade(T, 0.82)),
  B(0.08, 0, 0, 0.2, 0.12, 3.14, shade(T, 0.72)),
  B(1.8, 0, 0, 1.92, 0.12, 3.14, shade(T, 0.72)),
  B(0.08, 0, 3.02, 1.92, 0.12, 3.14, shade(T, 0.72)),
  B(1.56, 0, 1.42, 1.66, 0.12, 1.52, LATON, { grain: 0 }),
]);
