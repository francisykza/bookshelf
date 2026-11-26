// Olmo, el búho librero (1.150; Francisco, 26-11-2026: «el personaje de suscriptor que sustituye a Pilar… que sea muy
// característico y atractivo para el público»). Con la suscripción de Libotown, Olmo atiende la barra del café en lugar de
// Pilar y hace todo lo que hace ella. Diseño propio, con las cajas de la casa (como el mapache del casino, `mapache3d.js`):
// un búho grande y redondo, con penachos, gafas redondas de alambre, chaleco de punto mostaza con botones de madera, una
// bufanda escocesa con un lápiz metido en el nudo y alas en vez de manos. Sabio y tranquilo. No se parece a ningún búho de
// otra obra: nada de pajarita, ni de birrete, ni de monóculo.
//
// Solo datos y la pose de cada momento (sin Three.js): el motor 3D del café lo convierte en volúmenes con su luz, y el retrato
// de la franja y las poses de la guía salen de aquí mismo (`retratoOlmo`), así que siempre es el mismo Olmo. Unidades del
// piso (una casilla = 1); mira hacia +y, de pie sobre z = 0, centrado en x = 0. Mide unos 1,9 con los penachos, como Pilar.

const B = (x0, y0, z0, x1, y1, z1, c) => ({ b: [x0, y0, z0, x1, y1, z1], c });
/** La misma caja, en el lado izquierdo (x reflejada). */
const ESPEJO = (bx) => B(-bx.b[3], bx.b[1], bx.b[2], -bx.b[0], bx.b[4], bx.b[5], bx.c);
const PAR = (bx) => [bx, ESPEJO(bx)];
/** Un número de 0 a 1 que siempre es el mismo para (i, j). */
const azar = (i, j) => {
  const x = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const PLUMA = [138, 100, 70];
const PLUMA_O = [98, 68, 48];
const PLUMA_C = [178, 140, 100];
const CREMA = [238, 224, 194];
const CREMA_O = [204, 182, 146];
const DISCO = [226, 204, 164];
const DISCO_O = [176, 140, 98];
const OJO = [244, 176, 52];
const OJO_O = [206, 128, 30];
const PUPILA = [28, 20, 18];
const BRILLO = [255, 252, 238];
const PICO = [118, 102, 84];
const ALAMBRE = [116, 84, 40];
const MOSTAZA = [206, 158, 50];
const MOSTAZA_O = [170, 124, 34];
const BOTON = [112, 72, 42];
const TARTAN = [164, 44, 48];
const TARTAN_V = [42, 94, 66];
const TARTAN_L = [232, 200, 96];
const GARRA = [216, 166, 74];
const LAPIZ = [240, 192, 58];
const GOMA = [226, 142, 150];

// La silueta redonda: rodajas de una elipse, una encima de otra (el cuerpo, de z 0,04 a 1,36; la cabeza, de 1,25 a 1,81)
const CUERPO_Z = [0.7, 0.66];
const CUERPO_R = [0.37, 0.3];
const CABEZA_Z = [1.53, 0.28];
const CABEZA_R = [0.34, 0.28];
const radio = ([zc, sz], [rx, ry], z) => {
  const u = (z - zc) / sz;
  const k = u >= 1 || u <= -1 ? 0 : Math.sqrt(1 - u * u);
  return [rx * k, ry * k];
};
const rodajas = (zc, rr, z0, z1, paso, color) => {
  const out = [];
  for (let z = z0; z < z1 - 1e-6; z += paso) {
    const [w, d] = radio(zc, rr, z + paso / 2);
    if (w > 0.02) out.push(B(-w, -d, z, w, d, Math.min(z1, z + paso), color));
  }
  return out;
};
/** Lo de delante de una rodaja del cuerpo (a la altura z): hasta dónde llega por delante. */
const frente = (z) => radio(CUERPO_Z, CUERPO_R, z)[1];
const frenteCabeza = (z) => radio(CABEZA_Z, CABEZA_R, z)[1];

const PASO = 0.06;
const CHALECO = [0.46, 1.16];

/** El cuerpo, quieto (la cabeza, las alas y los párpados se mueven aparte). */
const CUERPO = (() => {
  const out = [];
  // Las patas con sus garras, que asoman por delante, y la colita detrás
  out.push(...PAR(B(0.06, 0.02, 0.0, 0.2, 0.16, 0.07, PLUMA_O)));
  for (const dx of [-0.045, 0, 0.045])
    out.push(...PAR(B(0.13 + dx - 0.016, 0.16, 0, 0.13 + dx + 0.016, 0.27, 0.035, GARRA)), ...PAR(B(0.13 + dx - 0.012, 0.27, 0, 0.13 + dx + 0.012, 0.29, 0.022, PLUMA_O)));
  out.push(B(-0.13, -0.36, 0.1, 0.13, -0.24, 0.2, PLUMA_O), B(-0.09, -0.4, 0.12, 0.09, -0.34, 0.18, PLUMA));
  // El cuerpo redondo, con el plumaje
  out.push(...rodajas(CUERPO_Z, CUERPO_R, 0.04, 1.36, PASO, PLUMA));
  // El chaleco de punto: un poco más ancho que el cuerpo, con el elástico de abajo más oscuro
  for (let z = CHALECO[0]; z < CHALECO[1] - 1e-6; z += PASO) {
    const [w, d] = radio(CUERPO_Z, CUERPO_R, z + PASO / 2);
    const c = z < CHALECO[0] + PASO ? MOSTAZA_O : MOSTAZA;
    out.push(B(-w - 0.018, -d - 0.018, z, w + 0.018, d + 0.018, z + PASO, c));
    // El punto: canalé vertical por delante (franjas más oscuras), menos en el escote
    if (z >= CHALECO[0] + PASO) {
      for (let x = -w + 0.05; x < w - 0.04; x += 0.065) {
        const escote = z > 0.9 && Math.abs(x) < 0.03 + (z - 0.9) * 0.55;
        if (!escote) out.push(B(x - 0.009, d + 0.014, z + 0.004, x + 0.009, d + 0.024, z + PASO - 0.004, MOSTAZA_O));
      }
    }
  }
  // El escote en pico: la pechuga clara asoma por encima de los botones
  for (let z = 0.9; z < 1.2; z += 0.03) {
    const a = 0.018 + (z - 0.9) * 0.55;
    out.push(B(-a, frente(z + 0.015) + 0.02, z, a, frente(z + 0.015) + 0.03, z + 0.03, CREMA));
  }
  // La tripa clara de debajo del chaleco, con sus manchas en uve
  for (let z = 0.16; z < CHALECO[0]; z += PASO) {
    const [w, d] = radio(CUERPO_Z, CUERPO_R, z + PASO / 2);
    out.push(B(-w * 0.62, d - 0.004, z, w * 0.62, d + 0.01, z + PASO, CREMA));
    const fila = Math.round(z / PASO);
    for (let x = -w * 0.45 + (fila % 2) * 0.05; x < w * 0.5; x += 0.1) out.push(B(x - 0.015, d + 0.01, z + 0.02, x + 0.015, d + 0.016, z + 0.035, CREMA_O));
  }
  // Los tres botones de madera del chaleco
  for (const z of [0.6, 0.72, 0.84]) out.push(B(-0.024, frente(z) + 0.022, z - 0.022, 0.024, frente(z) + 0.04, z + 0.022, BOTON));
  // La bufanda escocesa, gorda, entre el cuerpo y la cabeza: rojo con franjas verdes y un hilo amarillo
  const BZ = [1.16, 1.33];
  out.push(B(-0.27, -0.23, BZ[0], 0.27, 0.23, BZ[1], TARTAN));
  for (const x of [-0.2, -0.06, 0.08, 0.22]) out.push(B(x - 0.025, -0.235, BZ[0], x + 0.025, 0.235, BZ[1], TARTAN_V));
  out.push(B(-0.275, -0.235, 1.235, 0.275, 0.235, 1.25, TARTAN_V));
  out.push(B(-0.276, -0.236, 1.28, 0.276, 0.236, 1.287, TARTAN_L));
  // El nudo, delante a la derecha, y la punta que cuelga con sus flecos
  out.push(B(0.06, 0.22, 1.13, 0.22, 0.29, 1.3, TARTAN), B(0.11, 0.285, 1.14, 0.14, 0.295, 1.29, TARTAN_V));
  const colgando = frente(0.9) + 0.045;
  out.push(B(0.08, colgando - 0.04, 0.78, 0.21, colgando, 1.16, TARTAN));
  for (const z of [0.86, 0.98, 1.08]) out.push(B(0.078, colgando - 0.042, z, 0.212, colgando + 0.003, z + 0.025, TARTAN_V));
  out.push(B(0.078, colgando - 0.042, 0.93, 0.212, colgando + 0.003, 0.938, TARTAN_L));
  out.push(B(0.12, colgando - 0.042, 0.78, 0.14, colgando + 0.004, 1.16, TARTAN_V));
  for (let x = 0.09; x < 0.21; x += 0.03) out.push(B(x, colgando - 0.03, 0.73, x + 0.014, colgando - 0.01, 0.78, TARTAN));
  // El lápiz metido en el nudo, con su goma rosa
  out.push(B(0.17, 0.2, 1.26, 0.2, 0.27, 1.36, LAPIZ), B(0.17, 0.2, 1.36, 0.2, 0.27, 1.39, GOMA));
  return out;
})();

/** Dónde gira la cabeza (el cuello, bajo la bufanda): la cabeza se mira y se ladea desde aquí. */
const PIVOTE_CABEZA = [0, 0, 1.3];
const OJOS = [0.128, 1.56];

/** La cabeza: el disco de la cara, los ojos ámbar, las gafas de alambre, el pico, las cejas y los penachos. */
const CABEZA = (() => {
  const out = [];
  out.push(...rodajas(CABEZA_Z, CABEZA_R, 1.25, 1.81, 0.045, PLUMA));
  // Moteado claro en la coronilla y los lados (siempre el mismo)
  for (let i = 0; i < 16; i += 1) {
    const z = 1.42 + azar(i, 1) * 0.3;
    const [w, d] = radio(CABEZA_Z, CABEZA_R, z);
    const x = (azar(i, 2) * 2 - 1) * w * 0.8;
    out.push(B(x - 0.014, -d * 0.6, z, x + 0.014, d * 0.25, z + 0.016, PLUMA_C));
  }
  // El disco facial: dos círculos claros con el borde oscuro, uno por ojo, que se juntan en el pico
  const [ex, ez] = OJOS;
  const f = frenteCabeza(ez) + 0.004;
  for (const s of [1, -1]) {
    const cx = s * ex;
    out.push(B(cx - 0.13, f - 0.02, ez - 0.13, cx + 0.13, f, ez + 0.04, DISCO_O));
    out.push(B(cx - 0.112, f - 0.01, ez - 0.13, cx + 0.112, f + 0.006, ez + 0.112, DISCO));
    out.push(B(cx - 0.132, f - 0.01, ez - 0.085, cx + 0.132, f + 0.006, ez + 0.085, DISCO));
  }
  out.push(B(-0.04, f - 0.01, 1.42, 0.04, f + 0.008, 1.56, DISCO));
  // Los ojos grandes, ámbar, con su pupila y el brillo
  for (const s of [1, -1]) {
    const cx = s * ex;
    out.push(B(cx - 0.062, f + 0.004, ez - 0.062, cx + 0.062, f + 0.014, ez + 0.062, OJO));
    out.push(B(cx - 0.062, f + 0.005, ez - 0.062, cx + 0.062, f + 0.015, ez - 0.05, OJO_O));
    out.push(B(cx - 0.036, f + 0.012, ez - 0.034, cx + 0.036, f + 0.02, ez + 0.038, PUPILA));
    out.push(B(cx + s * 0.004 - 0.016, f + 0.018, ez + 0.006, cx + s * 0.004 + 0.002, f + 0.024, ez + 0.03, BRILLO));
  }
  // Las gafas redondas de alambre (un octógono por ojo), el puente y las patillas hasta detrás de la cabeza
  const g = f + 0.03;
  for (const s of [1, -1]) {
    const cx = s * ex;
    out.push(B(cx - 0.055, g, ez + 0.08, cx + 0.055, g + 0.012, ez + 0.096, ALAMBRE));
    out.push(B(cx - 0.055, g, ez - 0.096, cx + 0.055, g + 0.012, ez - 0.08, ALAMBRE));
    out.push(B(cx - 0.096, g, ez - 0.055, cx - 0.08, g + 0.012, ez + 0.055, ALAMBRE));
    out.push(B(cx + 0.08, g, ez - 0.055, cx + 0.096, g + 0.012, ez + 0.055, ALAMBRE));
    for (const [dx, dz] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ])
      out.push(B(cx + dx * 0.068 - 0.014, g, ez + dz * 0.068 - 0.014, cx + dx * 0.068 + 0.014, g + 0.012, ez + dz * 0.068 + 0.014, ALAMBRE));
  }
  out.push(B(-0.034, g, ez + 0.03, 0.034, g + 0.012, ez + 0.044, ALAMBRE));
  out.push(...PAR(B(0.222, g - 0.04, ez + 0.03, 0.236, g + 0.006, ez + 0.044, ALAMBRE)));
  for (const s of [1, -1]) {
    const lado = radio(CABEZA_Z, CABEZA_R, ez + 0.04)[0] + 0.006;
    const [a, b] = s > 0 ? [lado - 0.012, lado] : [-lado, -lado + 0.012];
    out.push(B(a, -0.12, ez + 0.03, b, g - 0.04, ez + 0.044, ALAMBRE));
  }
  // El pico corto y ganchudo, entre los ojos
  out.push(B(-0.03, f, 1.44, 0.03, f + 0.05, 1.52, PICO), B(-0.02, f + 0.03, 1.415, 0.02, f + 0.06, 1.45, PLUMA_O));
  // Las cejas de plumas oscuras, altas, separadas de las gafas y subiendo hacia fuera: cara amable, nunca enfadada
  out.push(...PAR(B(0.09, f + 0.004, ez + 0.14, 0.17, f + 0.018, ez + 0.162, PLUMA_O)), ...PAR(B(0.17, f + 0.002, ez + 0.152, 0.24, f + 0.016, ez + 0.176, PLUMA_O)));
  // Los penachos: dos mechones de pluma en triángulo (anchos abajo, en punta arriba y algo hacia fuera), oscuros con el borde
  // de fuera más claro. Gruesos de delante a atrás, para que de lado sigan siendo plumas y no cuernos.
  const PENACHO = [
    [0.1, 0.27, 1.72, 1.79, 0.07, PLUMA_O],
    [0.15, 0.29, 1.79, 1.85, 0.06, PLUMA_O],
    [0.2, 0.3, 1.85, 1.9, 0.045, PLUMA_O],
    [0.245, 0.3, 1.9, 1.94, 0.03, PLUMA],
  ];
  for (const [a, b, z0, z1, d, c] of PENACHO) out.push(...PAR(B(a, -d, z0, b, d, z1, c)));
  out.push(...PAR(B(0.27, -0.05, 1.74, 0.285, 0.05, 1.86, PLUMA_C)));
  return out;
})();

/**
 * Los párpados (para el parpadeo lento de búho y los ojos contentos de la guía): tapan cada ojo con el color del disco, con una
 * rayita oscura en arco (como un «^» al revés: ojos que sonríen). Derecho e izquierdo.
 */
const PARPADOS = (() => {
  const [ex, ez] = OJOS;
  const f = frenteCabeza(ez) + 0.004;
  return [1, -1].map((s) => {
    const cx = s * ex;
    return [
      B(cx - 0.062, f + 0.003, ez - 0.062, cx + 0.062, f + 0.022, ez + 0.062, DISCO),
      B(cx - 0.05, f + 0.022, ez - 0.012, cx - 0.026, f + 0.026, ez + 0.002, PLUMA_O),
      B(cx - 0.028, f + 0.022, ez - 0.002, cx + 0.028, f + 0.026, ez + 0.012, PLUMA_O),
      B(cx + 0.026, f + 0.022, ez - 0.012, cx + 0.05, f + 0.026, ez + 0.002, PLUMA_O),
    ];
  });
})();

/** Dónde arranca cada ala (el hombro, por la sisa del chaleco): el ala derecha; la izquierda es su reflejo. */
const PIVOTE_ALA = [0.33, 0, 1.08];
/** El ala derecha, plegada contra el costado: plumas pardas con barras claras y las primarias más oscuras abajo. */
const ALA = (() => {
  const out = [];
  const tramos = [
    [1.08, 0.12, -0.1, 0.06],
    [0.96, 0.16, -0.14, 0.12],
    [0.82, 0.18, -0.16, 0.14],
    [0.68, 0.17, -0.17, 0.13],
    [0.56, 0.14, -0.17, 0.08],
    [0.46, 0.1, -0.16, 0.02],
  ];
  tramos.forEach(([z1, alto, y0, y1], i) => {
    const x0 = 0.3 + (i === 0 ? 0.02 : 0.045 - i * 0.004);
    const c = i >= 4 ? PLUMA_O : PLUMA;
    out.push(B(x0, y0, z1 - alto, x0 + 0.085, y1, z1, c));
    if (i >= 1 && i <= 3) out.push(B(x0 + 0.083, y0 + 0.02, z1 - alto * 0.55, x0 + 0.09, y1 - 0.02, z1 - alto * 0.45, PLUMA_C));
  });
  return out;
})();

/**
 * El ala derecha levantada, doblada por el codo, como quien levanta la mano para explicar algo (la pose de la guía que
 * señala): un tramo hacia fuera desde el hombro y la punta hacia arriba, con las primarias oscuras arriba como dedos.
 */
const ALA_ARRIBA = [
  B(0.3, -0.12, 0.98, 0.5, 0.1, 1.12, PLUMA),
  B(0.45, -0.11, 1.08, 0.56, 0.09, 1.48, PLUMA),
  B(0.555, -0.08, 1.18, 0.565, 0.06, 1.4, PLUMA_C),
  B(0.45, -0.1, 1.48, 0.56, 0.08, 1.58, PLUMA_O),
  ...[0.45, 0.485, 0.52].map((x, i) => B(x, -0.07, 1.58, x + 0.03, 0.05, 1.64 + i * 0.03, PLUMA_O)),
];

/** Un libro pequeño, abierto, para la pose de la guía en la que lee (y para cuando hable de libros). */
// Lo sostiene bajo el pico, por delante de la bufanda: tapas granate, páginas color hueso con sus renglones y el lomo
const LIBRO = (() => {
  const [y0, z0] = [0.36, 1.02];
  const TAPA = [120, 40, 44];
  const HOJA = [244, 236, 214];
  const RENGLON = [150, 138, 120];
  const out = [
    B(-0.18, y0, z0, -0.005, y0 + 0.03, z0 + 0.22, TAPA),
    B(0.005, y0, z0, 0.18, y0 + 0.03, z0 + 0.22, TAPA),
    B(-0.17, y0 + 0.03, z0 + 0.012, -0.01, y0 + 0.045, z0 + 0.21, HOJA),
    B(0.01, y0 + 0.03, z0 + 0.012, 0.17, y0 + 0.045, z0 + 0.21, HOJA),
    B(-0.005, y0, z0, 0.005, y0 + 0.046, z0 + 0.22, [88, 28, 32]),
  ];
  for (const [k, z] of [0.17, 0.13, 0.09, 0.05].entries()) {
    out.push(B(-0.14, y0 + 0.045, z0 + z, k === 3 ? -0.07 : -0.035, y0 + 0.049, z0 + z + 0.01, RENGLON));
    out.push(B(0.035, y0 + 0.045, z0 + z, k === 2 ? 0.09 : 0.14, y0 + 0.049, z0 + z + 0.01, RENGLON));
  }
  return out;
})();

/** Alas (las dos, ya reflejadas): [derecha, izquierda]. */
const ALAS = [ALA, ALA.map(ESPEJO)];

/** Lo que sube Olmo para asomar por encima de la barra: está de pie en un taburete bajo, detrás del mostrador. */
const TABURETE = 0.12;

export const OLMO = {
  cuerpo: CUERPO,
  cabeza: CABEZA,
  pivoteCabeza: PIVOTE_CABEZA,
  parpados: PARPADOS,
  alas: ALAS,
  alaArriba: ALA_ARRIBA,
  pivoteAla: PIVOTE_ALA,
  libro: LIBRO,
  alto: 1.94,
  taburete: TABURETE,
  /** Para la mano del café (`manoPilar`): los colores del ala que agarra los mangos. */
  colores: { pluma: PLUMA, plumaO: PLUMA_O, plumaC: PLUMA_C, chaleco: MOSTAZA },
};

const suave = (u) => {
  const v = Math.max(0, Math.min(1, u));
  return v * v * (3 - 2 * v);
};
/** Una campana de 0 a 1 a 0 entre a y b (sube, se queda y baja). */
const campana = (t, a, b, rampa = 0.35) => Math.min(suave((t - a) / rampa), suave((b - t) / rampa));

/**
 * La pose en el instante `t` (segundos): { giro (la cabeza hacia los lados, radianes), ladeo (la cabeza inclinada, radianes),
 * parpados: [derecho, izquierdo] (true: cerrados), alas: [derecha, izquierda] (cuánto se abren, radianes), esponja (las plumas
 * ahuecadas: 0 a 1), respira (de −1 a 1) }.
 *
 * Quieto: respira despacio, parpadea lento (a veces dos veces seguidas), de vez en cuando gira la cabeza para mirar hacia un
 * lado, como hacen los búhos, y la vuelve; ladea la cabeza con curiosidad y se ahueca las plumas. Con `prepara` (está
 * haciendo un café), las alas se mueven un poco al trabajar y no se distrae. Con `quieto` (movimiento reducido), nada se mueve.
 */
export function poseOlmo(t, { quieto = false, prepara = false } = {}) {
  if (quieto) return { giro: 0, ladeo: 0, parpados: [false, false], alas: [0, 0], esponja: 0, respira: 0 };
  const respira = Math.sin(t * 1.7);
  // Parpadeo lento cada 4,3 s (y doble cada tres veces)
  const p = t % 4.3;
  const doble = Math.floor(t / 4.3) % 3 === 2;
  const parpadeo = p < 0.22 || (doble && p > 0.42 && p < 0.62);
  if (prepara) {
    const a = 0.12 + Math.sin(t * 5.2) * 0.06;
    return { giro: Math.sin(t * 0.9) * 0.08, ladeo: 0, parpados: [parpadeo, parpadeo], alas: [a, a * 0.6], esponja: 0, respira };
  }
  // Un ciclo de 15 s: mira a un lado (3–5,5 s), ladea la cabeza (8,5–10 s), mira al otro lado más rato (11–13 s) y se ahueca
  const c = t % 15;
  const giro = 0.95 * campana(c, 3, 5.5, 0.6) - 0.7 * campana(c, 11, 13, 0.7) + Math.sin(t * 0.5) * 0.05;
  const ladeo = 0.26 * campana(c, 8.5, 10, 0.25);
  const esponja = campana(c, 6.5, 7.2, 0.2);
  const alas = [0.02 + esponja * 0.14, 0.02 + esponja * 0.14];
  return { giro, ladeo, parpados: [parpadeo, parpadeo], alas, esponja, respira };
}

// ── El retrato de píxel, sacado del modelo ──
/** Las poses del retrato (la franja del café y la guía): ojos, alas y si lleva el libro. */
const POSES_RETRATO = {
  normal: {},
  contento: { ojos: 'cerrados' },
  apunta: { ala: 'arriba' },
  lee: { libro: true },
};
const hex = ([r, g, b]) =>
  `#${[r, g, b]
    .map((v) =>
      Math.max(0, Math.min(255, Math.round(v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
const LETRAS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * El retrato de Olmo como dibujo de píxel ({ filas, paleta }, el formato de `PixelArt`): el modelo visto de frente, en una
 * cuadrícula de `n × n`, encuadrando de la bufanda a los penachos (o el cuerpo entero con `entero`). Cada píxel toma la caja
 * que está más delante; las cajas más finas que un píxel ocupan al menos uno (así se ven las gafas). De frente de verdad: lo que
 * Olmo tiene a su derecha sale a la izquierda del dibujo, como cuando le miras en la barra. Con un contorno oscuro alrededor,
 * como los demás retratos del café.
 */
export function retratoOlmo(pose = 'normal', { n = 24, entero = false } = {}) {
  const op = POSES_RETRATO[pose] ?? POSES_RETRATO.normal;
  const ojosCerrados = op.ojos === 'cerrados';
  const alaDer = op.ala === 'arriba' ? ALA_ARRIBA : ALA;
  const cajas = [...CUERPO, ...CABEZA, ...alaDer, ...ALA.map(ESPEJO), ...(ojosCerrados ? PARPADOS.flat() : []), ...(op.libro ? LIBRO : [])];
  const [X0, X1, Z0, Z1] = entero ? [-0.62, 0.62, -0.05, 1.95] : op.ala === 'arriba' ? [-0.5, 0.62, 0.98, 1.97] : [-0.48, 0.48, 1.03, 1.97];
  const lado = Math.max(X1 - X0, Z1 - Z0) / n;
  const cx = (X0 + X1) / 2;
  const x0 = cx - (lado * n) / 2;
  const z1 = Z1;
  const prof = Array.from({ length: n }, () => new Array(n).fill(-Infinity));
  const color = Array.from({ length: n }, () => new Array(n).fill(null));
  for (const { b, c } of cajas) {
    let i0 = Math.round((b[0] - x0) / lado);
    let i1 = Math.round((b[3] - x0) / lado) - 1;
    let j0 = Math.round((z1 - b[5]) / lado);
    let j1 = Math.round((z1 - b[2]) / lado) - 1;
    if (i1 < i0) i1 = i0 = Math.floor(((b[0] + b[3]) / 2 - x0) / lado);
    if (j1 < j0) j1 = j0 = Math.floor((z1 - (b[2] + b[5]) / 2) / lado);
    for (let j = Math.max(0, j0); j <= Math.min(n - 1, j1); j += 1) {
      for (let i = Math.max(0, i0); i <= Math.min(n - 1, i1); i += 1) {
        if (b[4] >= prof[j][i]) {
          prof[j][i] = b[4];
          color[j][i] = c;
        }
      }
    }
  }
  // El contorno: los huecos que tocan algo dibujado
  const CONTORNO = [44, 28, 20];
  const lleno = (i, j) => i >= 0 && j >= 0 && i < n && j < n && color[j][i] && color[j][i] !== CONTORNO;
  const borde = [];
  for (let j = 0; j < n; j += 1) for (let i = 0; i < n; i += 1) if (!color[j][i] && (lleno(i - 1, j) || lleno(i + 1, j) || lleno(i, j - 1) || lleno(i, j + 1))) borde.push([i, j]);
  for (const [i, j] of borde) color[j][i] = CONTORNO;
  const paleta = {};
  const letraDe = new Map();
  const filas = color.map((fila) =>
    [...fila]
      .reverse()
      .map((c) => {
        if (!c) return '.';
        const k = c.join(',');
        if (!letraDe.has(k)) {
          const l = LETRAS[letraDe.size];
          letraDe.set(k, l);
          paleta[l] = hex(c);
        }
        return letraDe.get(k);
      })
      .join(''),
  );
  return { filas, paleta };
}
