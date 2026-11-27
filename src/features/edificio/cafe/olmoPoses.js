// Las poses de Olmo (Francisco, 26-11-2026: «Para después añade a olmo con las animaciones que te paso igual que a libo»; 27-11-2026,
// «Igualar el 3D al dibujo»). Las dibujó él; `scripts/olmo-poses.mjs` las recorta de su hoja en lienzos iguales (311 × 257, apoyadas
// abajo y a la misma escala), así que cambiar de pose no cambia el tamaño de Olmo. Van donde antes salía su retrato de píxel: la
// guía del café, el cuadro de diálogo, la caja, el cuaderno, el obrador y el tostadero. Reglas puras, sin React: qué pose toca en
// cada momento (como `src/features/libo/poses.js`).

export const POSES_OLMO = Object.freeze([
  'libro',
  'saluda',
  'lee',
  'camina',
  'cafe',
  'celebra',
  'duerme',
  'duda',
  'carino',
  'enfado',
  'sorpresa',
  'lee-feliz',
  'corre',
  'gatito',
  'asoma',
  'espaldas',
  'mareado',
  'estudia',
  'descansa',
  'llora',
  'resopla',
  'estrella',
]);

/** El lienzo de todas las poses. */
export const LIENZO_OLMO = Object.freeze({ w: 311, h: 257 });

// Los nombres de los retratos de antes (sacados del 3D, 1.150), por si aún se piden así
const ANTES = { normal: 'libro', contento: 'cafe', apunta: 'libro' };

/** La pose que se pide, o la de siempre (de pie con su libro) si no existe. */
export const poseDeOlmo = (pose) => (POSES_OLMO.includes(pose) ? pose : (ANTES[pose] ?? 'libro'));

/** La imagen de una pose. */
export const poseOlmoUrl = (pose) => `/assets/olmo/poses/${poseDeOlmo(pose)}.webp`;

/** Cada momento del café, su pose. */
export const MOMENTO_OLMO = Object.freeze({
  /** En el cuadro de diálogo, cuando habla */
  habla: 'libro',
  /** Mientras te prepara la bebida */
  prepara: 'cafe',
  /** Cuando se ofrece a prepararla */
  ofrece: 'saluda',
  /** «Esto ya lo dominas» */
  dominas: 'estrella',
  /** En la caja del mostrador, contando lo vendido; y al terminar */
  caja: 'cafe',
  cajaHecha: 'celebra',
  /** En el obrador, de aquí para allá */
  obrador: 'camina',
  /** En el tostadero, con el humo del tambor */
  tostadero: 'resopla',
  /** En su cuaderno de encargos */
  cuaderno: 'estudia',
});

/** La pose de cada paso de la guía del café: saluda al empezar, te acompaña y celebra el final. */
export function poseOlmoDelPaso(i, total, pose = null) {
  if (i === 0) return 'saluda';
  if (i >= total - 1) return 'celebra';
  if (pose === 'contento') return 'carino';
  return i % 2 ? 'camina' : 'libro';
}

/** Sin tocar nada: primero se sienta a leer y, mucho rato después, se duerme (segundos). */
export const REPOSO_OLMO = Object.freeze({ lee: 30, duerme: 90 });

/** La pose en la franja cuando no pasa nada, según el rato que llevas sin tocar nada. */
export function poseOlmoEnReposo(quieto = 0) {
  if (quieto >= REPOSO_OLMO.duerme) return 'duerme';
  if (quieto >= REPOSO_OLMO.lee) return 'lee';
  return 'libro';
}

// Al tocarle en la barra dice una frase suya, cada una con su gesto (en el orden de `FRASES_OLMO`, dando la vuelta)
const AL_HABLAR = ['lee-feliz', 'cafe', 'libro', 'duda', 'cafe', 'estudia', 'sorpresa', 'carino', 'gatito', 'descansa', 'estrella', 'lee-feliz'];

/** La pose con la frase número `i`. */
export const poseOlmoAlHablar = (i) => AL_HABLAR[((i % AL_HABLAR.length) + AL_HABLAR.length) % AL_HABLAR.length];

/** Cuánto dura el mareo de muchos toques seguidos antes de volver a lo suyo (ms). */
export const DURA_MAREO = 1600;
