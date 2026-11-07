// Dónde van las tres capas del exterior: solo cuentas, sin Three.js ni lienzos, para poder comprobar sus bordes.
// Cada capa es un plano paralelo a la pared. Se mide en «celdas sobre la pared»: lo que ocupa visto desde el sillón, en el
// plano de la pared. Así las tres se pintan alineadas y, al moverse la cabeza, se separan como lo harían de verdad.

/** Píxeles de lienzo por celda sobre la pared: desde el sillón, un píxel de lienzo es uno del dibujo final. */
export const PX_PER_CELL = 72;

/**
 * `depth`: distancia detrás de la pared. `wide`: ancho sobre la pared. `z0`, `z1`: alturas sobre la pared. `texel`: píxeles
 * de pantalla por píxel de lienzo; la capa cercana va a 2, la misma densidad que el suelo y la pared, porque está más cerca.
 */
export const LAYERS = {
  near: { depth: 2.2, wide: 3.2, z0: 0.6, z1: 3.8, texel: 2 },
  mid: { depth: 10, wide: 4.6, z0: 0.6, z1: 2.6, texel: 1 },
  // La lejana, más ancha y más alta que lo que se ve desde el sillón: al acercarte a una balda (1.88) la ventana se ve
  // desde más cerca y más de lado, y no debe asomar su final. `sky` es donde empieza el degradado del cielo, como antes
  far: { depth: 34, wide: 6, z0: 0.6, z1: 4.4, sky: 4, texel: 1 },
};

/** Tamaño del lienzo de una capa, en píxeles. */
export function layerSize(name) {
  const l = LAYERS[name];
  const k = PX_PER_CELL / l.texel;
  return [Math.round(l.wide * k), Math.round((l.z1 - l.z0) * k)];
}

/** Altura de una celda sobre la pared → fila del lienzo de esa capa. */
export const rowOf = (name, z) => Math.round(((LAYERS[name].z1 - z) * PX_PER_CELL) / LAYERS[name].texel);
/** Desplazamiento desde el centro del hueco → columna del lienzo de esa capa. */
export const colOf = (name, s) => Math.round(((LAYERS[name].wide / 2 + s) * PX_PER_CELL) / LAYERS[name].texel);

/**
 * El plano real de una capa, en metros de la escena y en coordenadas a lo largo de la pared: `eye` es { s, z, d } (a lo largo,
 * altura y distancia a la pared) y `centre`, el punto de la pared frente al que se alinea.
 */
export function layerPlane(name, eye, centre) {
  const l = LAYERS[name];
  const k = (eye.d + l.depth) / eye.d;
  const zMid = (l.z0 + l.z1) / 2;
  return {
    s: eye.s + (centre - eye.s) * k,
    z: eye.z + (zMid - eye.z) * k,
    width: l.wide * k,
    height: (l.z1 - l.z0) * k,
    depth: l.depth,
  };
}

/** Por dónde corta a una capa el rayo que sale del ojo `from` y pasa por un punto del hueco. */
function hitOn(depth, from, s, z) {
  const k = (from.d + depth) / from.d;
  return { s: from.s + (s - from.s) * k, z: from.z + (z - from.z) * k };
}

/**
 * Lo que sobra de cada capa, en metros, viendo el hueco `pane` ({ s0, s1, z0, z1 }) desde todos los ojos `eyes`. Si es
 * negativo, por ese lado se vería el final de la capa. `plane`: el del asiento, porque las capas no se mueven al girar.
 */
export function layerMargins(name, plane, pane, eyes) {
  let left = Infinity;
  let right = Infinity;
  let top = Infinity;
  let bottom = Infinity;
  for (const from of eyes) {
    for (const [s, z] of [[pane.s0, pane.z0], [pane.s1, pane.z0], [pane.s0, pane.z1], [pane.s1, pane.z1]]) {
      const p = hitOn(plane.depth, from, s, z);
      left = Math.min(left, p.s - (plane.s - plane.width / 2));
      right = Math.min(right, plane.s + plane.width / 2 - p.s);
      bottom = Math.min(bottom, p.z - (plane.z - plane.height / 2));
      top = Math.min(top, plane.z + plane.height / 2 - p.z);
    }
  }
  return { left, right, top, bottom };
}

/**
 * Qué cambia con la planta: cuánto quedan los tejados por debajo del horizonte. Desde una planta baja casi tapan el agua y
 * desde la última se ve mucho más puerto.
 */
export const ALTURAS = { 1: { roofGap: 0.28 }, 2: { roofGap: 0.46 }, 3: { roofGap: 0.64 } };

/** Cada cuánto se mueve el agua. Pocos pasos, como el resto del pixel art, y un redibujado pequeño por paso. */
export const WATER_MS = 420;
export const WATER_FRAMES = 4;
/** Filas de agua con brillos: las que pueden asomar por encima de los tejados. */
export const GLINT_ROWS = 66;
