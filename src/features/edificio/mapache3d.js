// El mapache crupier en 3D (1.109; decisión de Francisco del 10-11-2026: «modelo 3D de verdad», no el dibujo plano): la
// casilla más rara de la ruleta del casino, un compañero legendario que te acompaña. Hecho con cajas, como el personaje y el
// crupier (`actor.js`), para que se lea con la misma luz y el mismo píxel que las escenas 3D. Original: un mapache gris con
// su antifaz natural, la cola de anillos, la visera verde de crupier, pajarita roja y ligas doradas en los brazos; ni
// personaje ni mascota de ningún casino o juego.
//
// Solo datos y la pose de cada momento (sin Three.js): cada motor 3D lo convierte en volúmenes con su luz. Unidades del
// piso (una casilla = 1); mira hacia +y, de pie sobre z = 0, centrado en x = 0. Mide unos 0,8 (el personaje, 1,9).

const B = (x0, y0, z0, x1, y1, z1, c) => ({ b: [x0, y0, z0, x1, y1, z1], c });
/** La misma caja, en el lado izquierdo (x reflejada). */
const ESPEJO = (bx) => B(-bx.b[3], bx.b[1], bx.b[2], -bx.b[0], bx.b[4], bx.b[5], bx.c);
const PAR = (bx) => [bx, ESPEJO(bx)];

const GRIS = [134, 128, 140];
const GRIS_O = [86, 80, 92];
const BLANCO = [238, 234, 226];
const NEGRO = [38, 32, 40];
const NARIZ = [22, 18, 22];
const OJO = [250, 246, 236];
const VERDE = [40, 120, 80];
const VERDE_C = [92, 178, 124];
const ROJO = [176, 38, 52];
const ORO = [226, 182, 90];

/** El cuerpo, quieto (la cola, las fichas y los párpados se mueven aparte). */
const CUERPO = [
  // Pies y patas
  ...PAR(B(0.03, -0.05, 0, 0.13, 0.1, 0.05, NEGRO)),
  ...PAR(B(0.02, -0.08, 0.04, 0.14, 0.06, 0.18, GRIS)),
  // Tronco, con la tripa blanca y la pajarita roja con su botón dorado
  B(-0.16, -0.1, 0.16, 0.16, 0.1, 0.44, GRIS),
  B(-0.1, 0.1, 0.18, 0.1, 0.115, 0.39, BLANCO),
  ...PAR(B(0.015, 0.1, 0.385, 0.075, 0.13, 0.44, ROJO)),
  B(-0.02, 0.105, 0.395, 0.02, 0.138, 0.43, ORO),
  // Brazos, doblados hacia delante para los malabares, con su liga dorada de crupier y las manitas negras
  ...PAR(B(0.15, -0.04, 0.27, 0.21, 0.05, 0.42, GRIS)),
  ...PAR(B(0.145, -0.045, 0.355, 0.215, 0.055, 0.38, ORO)),
  ...PAR(B(0.15, 0.05, 0.27, 0.21, 0.17, 0.32, GRIS)),
  ...PAR(B(0.145, 0.16, 0.26, 0.215, 0.21, 0.33, NEGRO)),
  // Cabeza, con los mofletes blancos de los lados
  B(-0.18, -0.12, 0.44, 0.18, 0.12, 0.7, GRIS),
  ...PAR(B(0.18, -0.02, 0.46, 0.205, 0.1, 0.56, BLANCO)),
  // La cara: lo blanco de abajo, el antifaz negro y las cejas blancas
  B(-0.15, 0.12, 0.45, 0.15, 0.13, 0.53, BLANCO),
  B(-0.17, 0.12, 0.53, 0.17, 0.135, 0.6, NEGRO),
  ...PAR(B(0.05, 0.12, 0.5, 0.15, 0.133, 0.53, NEGRO)),
  B(-0.16, 0.12, 0.6, 0.16, 0.133, 0.635, BLANCO),
  // Los ojos, con su pupila
  ...PAR(B(0.07, 0.135, 0.55, 0.12, 0.14, 0.59, OJO)),
  ...PAR(B(0.08, 0.14, 0.555, 0.105, 0.145, 0.58, NARIZ)),
  // El hocico, la nariz y la boca
  B(-0.06, 0.12, 0.45, 0.06, 0.22, 0.53, BLANCO),
  B(-0.03, 0.22, 0.49, 0.03, 0.24, 0.53, NARIZ),
  B(-0.03, 0.205, 0.455, 0.03, 0.222, 0.465, GRIS_O),
  // Orejas, con lo blanco de dentro
  ...PAR(B(0.08, -0.04, 0.7, 0.17, 0.04, 0.79, GRIS_O)),
  ...PAR(B(0.1, 0.04, 0.71, 0.15, 0.045, 0.77, BLANCO)),
  // La visera verde de crupier: la cinta y el ala, con su filo más oscuro
  B(-0.185, -0.125, 0.635, 0.185, 0.125, 0.67, VERDE),
  B(-0.15, 0.125, 0.645, 0.15, 0.19, 0.656, VERDE_C),
  B(-0.15, 0.19, 0.642, 0.15, 0.2, 0.656, VERDE),
];

/** La cola de anillos, desde su arranque (`PIVOTE_COLA`): hacia atrás y curvándose hacia arriba. */
const COLA = Array.from({ length: 6 }, (_, i) => {
  const w = i === 0 || i === 5 ? 0.045 : 0.06;
  const y = -0.035 - i * 0.065;
  const z = 0.02 + i * i * 0.014;
  return B(-w, y - 0.04, z - w, w, y + 0.035, z + w, i % 2 ? NEGRO : i === 0 ? GRIS : [158, 152, 164]);
});
const PIVOTE_COLA = [0, -0.1, 0.2];

/** Una ficha (roja con el centro dorado), de canto hacia delante, centrada en 0. */
const FICHA = [B(-0.045, -0.012, -0.045, 0.045, 0.012, 0.045, ROJO), B(-0.025, -0.016, -0.025, 0.025, 0.016, 0.025, ORO)];
/** Los párpados (para el guiño y el parpadeo): tapan cada ojo con el negro del antifaz. Derecho e izquierdo. */
const PARPADOS = PAR(B(0.065, 0.135, 0.545, 0.125, 0.148, 0.595, NEGRO));

export const MAPACHE = { cuerpo: CUERPO, cola: COLA, pivoteCola: PIVOTE_COLA, ficha: FICHA, parpados: PARPADOS, alto: 0.8 };

/**
 * La pose en el instante `t` (segundos): { bote, cola (giro de la cola en vertical, radianes), fichas: [[x, y, z] | null ×3],
 * parpados: [derecho, izquierdo] (true: cerrado) }. Quieto, hace malabares con tres fichas por fuera de la cara (de las
 * manos hasta por encima de las orejas) y guiña de vez en cuando; al seguirte, va al trote con una ficha en la mano y la
 * cola dando botes. Con `quieto` (movimiento reducido), sin malabares: la ficha en la mano y los ojos abiertos.
 */
export function poseMapache(t, { moving = false, quieto = false } = {}) {
  const enMano = [[0.18, 0.24, 0.3], null, null];
  if (quieto) return { bote: 0, cola: 0, fichas: enMano, parpados: [false, false] };
  if (moving) {
    return { bote: Math.abs(Math.sin(t * 9)) * 0.045, cola: Math.sin(t * 9) * 0.45, fichas: enMano, parpados: [false, false] };
  }
  const fichas = [0, 1, 2].map((i) => {
    const a = t * 3.1 + (i * 2 * Math.PI) / 3;
    return [Math.cos(a) * 0.27, 0.24, 0.62 + Math.sin(a) * 0.34];
  });
  const guino = t % 4.5 > 4.2;
  const parpadeo = t % 3.1 < 0.12;
  return { bote: 0, cola: Math.sin(t * 2.2) * 0.35, fichas, parpados: [guino || parpadeo, parpadeo] };
}
