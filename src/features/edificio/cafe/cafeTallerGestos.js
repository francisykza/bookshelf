// El café-librería del bajo, 1.133: los gestos del taller de la trastienda (docs/qa/cafe-libreria.md §16.3; Francisco: «lo más
// artesanales y placenteras posibles»). Cada daño, su gesto, su objeto y su sonido, y se mide sobre el propio libro: la escena
// convierte el dedo en un punto de la tapa o de las páginas (`u`, `v`, de 0 a 1, de izquierda a derecha y de arriba abajo en la
// pantalla), así que los gestos no dependen del tamaño de la pantalla.
// - Polvo y moho: la brocha, pasadas largas y suaves por la tapa (limpia por donde pasa; el moho pide más pasadas).
// - Manchas y lápiz: la goma de miga, círculos pequeños sobre cada mancha; después, barrer las migas con el canto de la mano.
// - Página arrugada: la plegadera de hueso, deslizarla por encima del pliegue. 1.133.2: el pliegue va en ocho tramos y cada
//   pasada (ida o vuelta, aunque levantes el dedo) baja a la mitad la cresta de los tramos que toca; con dos, queda plano.
// - Lomo despegado: la cola caliente, pincelar el lomo de la cabeza al pie; y la prensa, girar el husillo hasta el tope.
// - Título borrado: el hierro caliente sobre el pan de oro, apretar y mantener sobre cada letra.
// - El ex libris: apretar y mantener el sello en la guarda.
// Reglas (las de la barra): ningún gesto falla ni tiene tiempo límite; lo hecho no se pierde al soltar; con movimiento reducido o
// con el teclado, cada gesto se hace de una vez (`completar`) y queda bien. A diferencia de la barra, aquí el mimo cuenta: cada
// daño queda «bien» (2) o «se podía mejorar» (1), y de ahí salen las estrellas (`estrellasTaller`). Solo cuentas: sin React ni
// Three.

/** El libro en el banco, en metros: la tapa cerrada; abierto, el doble de ancho (las dos páginas). */
export const LIBRO_TALLER = { ancho: 0.26, hondo: 0.36 };
/** Los gestos y sus tiempos. */
export const MEDIDAS_TALLER = {
  /**
   * Polvo: la cuadrícula de la tapa, el radio de la brocha y lo que limpia cada paso (cada 5 mm de recorrido). Tras ver la 1.133
   * (Francisco: «algunas acciones tardan demasiado, como quitar el polvo»), una brocha ancha: unas cuatro pasadas limpian la tapa
   * (antes, diez o doce); el moho, en la misma pasada si se le pasa por encima.
   */
  polvoCols: 8,
  polvoFilas: 11,
  brocha: 0.07,
  limpia: 0.12,
  limpiaMoho: 0.6,
  /** Más deprisa que esto (m/ms), la pasada es brusca. */
  brusca: 0.0016,
  /** Manchas: lo que borra cada paso (cada 4 mm) dentro de la mancha (un par de círculos por mancha). */
  borra: 0.024,
  /** Barrer las migas: una pasada de este ancho (en `u` de las dos páginas). */
  barrido: 0.36,
  /**
   * Pliegue (1.133.2, Francisco: «la de arrugar las paginas» no se entendía): el pliegue va en tramos y cada tramo baja a la
   * mitad con cada pasada de la plegadera por encima; dar la vuelta cuenta como otra pasada cuando se retrocede al menos `vuelta`
   * (fracción del pliegue). A esta distancia (m), aún se está sobre él; centrado, a menos de `centrado`.
   */
  vuelta: 0.08,
  sobrePliegue: 0.03,
  centrado: 0.011,
  /** Cola: lo que deja cada paso en su tramo del lomo; con más de esto, sobra. */
  cola: 0.6,
  colaDeMas: 2.8,
  lomoAncho: 0.16,
  /** La prensa: vueltas del husillo hasta el tope y desde qué distancia del centro cuenta (px a 390 de ancho). */
  vueltas: 2,
  radioHusillo: 14,
  /** El oro: lo que se mantiene el hierro sobre cada letra (ms) y lo centrado que tiene que estar (fracción de media letra). */
  oroMs: 450,
  oroCentro: 1,
  /** El ex libris: lo que se mantiene el sello (ms). */
  exlibrisMs: 650,
};

const M = MEDIDAS_TALLER;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const azar = (s) => {
  let x = (s | 0) + 0x6d2b79f5;
  return () => {
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
};

/** La semilla de un encargo (lo que cambia de un libro a otro: dónde están el moho y las manchas). */
export const semillaEncargo = (e) => (e ? (e.libro ?? 0) * 31 + (e.n ?? 1) * 7 : 1);

/** Los píxeles de la tapa (la cubierta cerrada, vista desde arriba) y la letra de píxel del título (5 × 7, con su Ñ). */
export const TAPA_PX = { w: 80, h: 110 };
export const LETRA_PX = { ancho: 5, alto: 7, paso: 6, y: 18 };

/**
 * Las letras del título en la tapa (las mismas para el dibujo y para el hierro): [{ ch, k, x, y, u, v, w, h }], con su esquina en
 * píxeles de la tapa (`x`, `y`) y su centro y su tamaño en `u` y `v`. Centradas en lo que queda de tapa a la derecha del
 * lomo; los espacios ocupan sitio pero no tienen letra.
 */
export function letrasTapa(tapa = '') {
  const txt = [...String(tapa).toUpperCase()].slice(0, 9);
  const { w, h } = TAPA_PX;
  const { ancho, alto, paso, y } = LETRA_PX;
  const centro = (Math.round(M.lomoAncho * w) + w) / 2;
  const x0 = Math.round(centro - (txt.length * paso - 1) / 2);
  const out = [];
  txt.forEach((ch, i) => {
    if (ch === ' ') return;
    const x = x0 + i * paso;
    out.push({ ch, k: out.length, x, y, u: (x + ancho / 2) / w, v: (y + alto / 2) / h, w: ancho / w, h: alto / h });
  });
  return out;
}

/** Las manchas de las dos páginas (en `u` de las dos): un cerco de taza, un garabato de lápiz y una mancha de grasa. */
export function manchasDe(semilla = 1) {
  const r = azar(semilla * 13 + 5);
  const izq = r() < 0.5;
  const lado = (a) => (izq ? a : 1 - a);
  return [
    { tipo: 'anillo', u: lado(0.2 + r() * 0.08), v: 0.3 + r() * 0.12, r: 0.034 },
    { tipo: 'lapiz', u: lado(0.3 + r() * 0.08), v: 0.66 + r() * 0.12, r: 0.03 },
    { tipo: 'grasa', u: lado(0.7 + r() * 0.1), v: 0.38 + r() * 0.3, r: 0.032 },
  ];
}

/** El pliegue de la página de la derecha, de punta a punta (en `u` y `v` de las dos páginas). */
export const PLIEGUE = { a: [0.63, 0.16], b: [0.86, 0.84] };
/** Los tramos del pliegue: cada uno, de 1 (arrugado) a 0 (liso), baja a la mitad con cada pasada de la plegadera. */
export const TRAMOS_PLIEGUE = 8;
/** Lo que levanta el pliegue sin alisar (m): una cresta que se ve y que la plegadera va dejando plana. */
export const ALTO_PLIEGUE = 0.0065;

/** Lo arrugado del pliegue en `s` (de 0, en la punta de arriba, a 1, en la de abajo), entre tramo y tramo. */
export function arrugaEn(tramos, s) {
  if (!tramos?.length) return 0;
  const n = tramos.length;
  const x = clamp(s) * n - 0.5;
  const i = Math.floor(x);
  const f = x - i;
  const a = tramos[Math.max(0, Math.min(n - 1, i))];
  const b = tramos[Math.max(0, Math.min(n - 1, i + 1))];
  return a + (b - a) * f;
}

/** Dónde cae un punto de las dos páginas (`u`, `v`) respecto al pliegue: `s`, a lo largo (0 a 1), y `d`, de lado (m). */
export function sobrePliegue(u, v) {
  const W = LIBRO_TALLER.ancho * 2;
  const D = LIBRO_TALLER.hondo;
  const [ax, ay, bx, by] = [PLIEGUE.a[0] * W, PLIEGUE.a[1] * D, PLIEGUE.b[0] * W, PLIEGUE.b[1] * D];
  const L = Math.hypot(bx - ax, by - ay);
  const [x, y] = [u * W, v * D];
  return { s: ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / (L * L), d: ((x - ax) * -(by - ay) + (y - ay) * (bx - ax)) / L };
}

/**
 * El relieve del pliegue (m, hacia arriba) en un punto de las dos páginas: una cresta afilada a lo largo del pliegue y otra
 * más baja a su lado, que se apagan hacia las puntas y bajan a medida que la plegadera alisa cada tramo (`tramos`).
 */
export function alturaPliegue(tramos, u, v) {
  if (!tramos) return 0;
  const { s, d } = sobrePliegue(u, v);
  if (s < -0.08 || s > 1.08) return 0;
  // A la mitad, la cresta baja a un tercio (que se note la primera pasada)
  const k = arrugaEn(tramos, s) ** 1.6 * Math.sin(Math.PI * clamp((s + 0.08) / 1.16)) ** 0.6;
  if (k <= 0) return 0;
  const cresta = (dd, ancho) => Math.max(0, 1 - Math.abs(dd) / ancho) ** 1.4;
  return ALTO_PLIEGUE * k * (cresta(d, 0.016) + 0.45 * cresta(d - 0.022, 0.011));
}

/** Las casillas de la tapa con moho (tres, según la semilla). */
export function mohoDe(semilla = 1) {
  const r = azar(semilla * 7 + 11);
  const n = M.polvoCols * M.polvoFilas;
  const out = new Set();
  while (out.size < 3) out.add(Math.floor(r() * n));
  return [...out];
}

/** El polvo de la tapa al llegar: casi todo por igual, algo más en los bordes, y el moho aparte. */
export function polvoInicial(semilla = 1) {
  const r = azar(semilla * 3 + 1);
  const polvo = [];
  for (let f = 0; f < M.polvoFilas; f += 1)
    for (let c = 0; c < M.polvoCols; c += 1) {
      const borde = c === 0 || f === 0 || c === M.polvoCols - 1 || f === M.polvoFilas - 1;
      polvo.push(clamp(0.82 + r() * 0.18 + (borde ? 0.1 : 0)));
    }
  const moho = new Array(polvo.length).fill(0);
  for (const k of mohoDe(semilla)) moho[k] = 1;
  return { polvo, moho };
}

/** El ancho de la superficie de cada gesto (la tapa o las dos páginas). */
const SUPERFICIE = { polvo: 'tapa', cola: 'tapa', dorado: 'tapa', manchas: 'pliego', arrugas: 'pliego', exlibris: 'pliego', prensa: null };
export const superficieDe = (tipo) => SUPERFICIE[tipo] ?? null;
const anchoDe = (tipo) => (SUPERFICIE[tipo] === 'pliego' ? LIBRO_TALLER.ancho * 2 : LIBRO_TALLER.ancho);

/** Los gestos de un daño, en orden (el lomo, la cola y luego la prensa). */
export const gestosDano = (dano) => (dano === 'lomo' ? ['cola', 'prensa'] : [dano]);

/**
 * Un gesto del taller. `tapa`: el título de la tapa (para el oro); `semilla`: la del encargo; `centro` y `escala`, solo la
 * prensa (dónde está el husillo en la pantalla, en px, y el ancho de la pantalla / 390). Cada llamada devuelve el estado:
 * { tipo, progreso (0 a 1), hecho, pulsado, fase, mimo (2 o 1, al terminar), vista (lo que se dibuja), pose (la herramienta),
 * eventos (para los sonidos), frota (si suena el bucle de la herramienta) }.
 */
export function crearGestoTaller(tipo, { tapa = '', semilla = 1, centro = null, escala = 1 } = {}) {
  const W = anchoDe(tipo);
  const D = LIBRO_TALLER.hondo;
  let progreso = 0;
  let hecho = false;
  let pulsado = false;
  let mimo = null;
  let fase = tipo === 'manchas' ? 'frotar' : null;
  let ultimo = null;
  let frota = false;
  let pose = { u: 0.5, v: 0.5, baja: 0 };
  // Lo que se va dibujando
  const ini = tipo === 'polvo' ? polvoInicial(semilla) : null;
  const polvo = ini?.polvo ?? null;
  const moho = ini?.moho ?? null;
  const nube = [];
  let largo = 0;
  let brusco = 0;
  let claros = 0;
  const manchas = tipo === 'manchas' ? manchasDe(semilla).map((m) => ({ ...m, alfa: 1 })) : null;
  const migas = [];
  let dentro = 0;
  let fuera = 0;
  let barrido = 0;
  let barridoDesde = null;
  // El pliegue: cada tramo, lo que le queda; en qué pasada se alisó por última vez; hacia dónde va la plegadera y lo que lleva
  // retrocedido (para saber cuándo da la vuelta)
  const tramos = tipo === 'arrugas' ? new Array(TRAMOS_PLIEGUE).fill(1) : null;
  const paseDe = tramos ? new Array(TRAMOS_PLIEGUE).fill(-1) : null;
  let pase = 0;
  let sentido = 0;
  let atras = 0;
  let sAnt = null;
  let lisos = 0;
  let desvio = 0;
  let sobre = 0;
  let lejos = 0;
  const cola = tipo === 'cola' ? new Array(10).fill(0) : null;
  let angulo = 0;
  let girado = 0;
  let cuartos = 0;
  const letras = tipo === 'dorado' ? letrasTapa(tapa) : null;
  const oro = letras ? letras.map(() => 0) : null;
  const centradas = letras ? letras.map(() => null) : null;
  let letra = -1;
  let tPulsa = 0;
  let exlibris = { baja: 0, presion: 0, sellado: false, u: 0.25, v: 0.5 };
  const r = azar(semilla * 17 + 3);

  const vista = () => {
    if (tipo === 'polvo') return { polvo, moho, nube };
    if (tipo === 'manchas') return { manchas, migas, barrido: clamp(barrido) };
    if (tipo === 'arrugas') return { arruga: tramos.reduce((s, x) => s + x, 0) / tramos.length, tramos: [...tramos] };
    if (tipo === 'cola') return { cola };
    if (tipo === 'prensa') return { prensa: clamp(girado / (M.vueltas * Math.PI * 2)), angulo };
    if (tipo === 'dorado') return { oro, letra };
    if (tipo === 'exlibris') return { exlibris };
    return {};
  };
  const estado = (eventos = []) => ({ tipo, progreso, hecho, pulsado, fase, mimo, vista: vista(), pose, eventos, frota });
  const terminar = (eventos, m) => {
    hecho = true;
    progreso = 1;
    pulsado = false;
    frota = false;
    mimo = m;
    eventos.push('hecho');
  };

  // ── Lo que hace cada gesto con un tramo del dedo (de `a` a `b`, en u y v; `dt` en ms) ──
  function tramo(a, b, dt, eventos, t = 0) {
    const dx = (b.u - a.u) * W;
    const dy = (b.v - a.v) * D;
    const len = Math.hypot(dx, dy);
    if (tipo === 'polvo') {
      const pasos = Math.max(1, Math.ceil(len / 0.005));
      const rapido = len / Math.max(1, dt) > M.brusca;
      largo += len;
      if (rapido) brusco += len;
      let limpio = false;
      for (let i = 1; i <= pasos; i += 1) {
        const x = (a.u + ((b.u - a.u) * i) / pasos) * W;
        const y = (a.v + ((b.v - a.v) * i) / pasos) * D;
        for (let f = 0; f < M.polvoFilas; f += 1)
          for (let c = 0; c < M.polvoCols; c += 1) {
            const k = f * M.polvoCols + c;
            const cx = ((c + 0.5) / M.polvoCols) * W;
            const cy = ((f + 0.5) / M.polvoFilas) * D;
            const d = Math.hypot(cx - x, cy - y);
            if (d > M.brocha) continue;
            const caida = 1 - (d / M.brocha) ** 2;
            const antes = polvo[k];
            polvo[k] = Math.max(0, polvo[k] - M.limpia * caida);
            if (moho[k] > 0) {
              const m0 = moho[k];
              moho[k] = Math.max(0, moho[k] - M.limpia * M.limpiaMoho * caida);
              if (m0 >= 0.3 && moho[k] < 0.3) eventos.push('moho');
            }
            if (antes - polvo[k] > 0.01) limpio = true;
          }
      }
      if (limpio && len > 0.002) {
        nube.push({ u: b.u, v: b.v, t, k: largo });
        if (nube.length > 28) nube.shift();
      }
      frota = len > 0.0005;
      const sucio = polvo.map((p, k) => Math.max(p, moho[k]));
      const media = sucio.reduce((s, p) => s + p, 0) / sucio.length;
      const limpias = sucio.filter((p) => p < 0.15).length / sucio.length;
      progreso = clamp(Math.min(1 - media, limpias) / 0.86);
      // Cada cuarto de tapa que queda limpio, un soplo (para el sonido: «claro:1» a «claro:3»)
      while (claros < Math.min(3, Math.floor(limpias * 4))) {
        claros += 1;
        eventos.push(`claro:${claros}`);
      }
      // Casi limpia, lo que queda se va con el último soplo (no hace falta repasar cada rincón)
      if (limpias >= 0.85 && media < 0.14 && moho.every((m) => m < 0.2)) {
        polvo.fill(0);
        moho.fill(0);
        terminar(eventos, largo > 0 && brusco / largo > 0.35 ? 1 : 2);
      }
      return;
    }
    if (tipo === 'manchas') {
      if (fase === 'barrer') {
        if (barridoDesde == null) barridoDesde = a.u;
        barrido = Math.max(barrido, Math.abs(b.u - barridoDesde) / M.barrido);
        frota = len > 0.0005;
        if (barrido >= 1) {
          migas.length = 0;
          eventos.push('migas');
          terminar(eventos, dentro + fuera > 0 && dentro / (dentro + fuera) < 0.5 ? 1 : 2);
        }
        return;
      }
      const pasos = Math.max(1, Math.ceil(len / 0.004));
      let borrando = false;
      for (let i = 1; i <= pasos; i += 1) {
        const x = (a.u + ((b.u - a.u) * i) / pasos) * W;
        const y = (a.v + ((b.v - a.v) * i) / pasos) * D;
        const paso = len / pasos;
        for (const m of manchas) {
          const d = Math.hypot(m.u * W - x, m.v * D - y);
          if (d <= m.r * 1.15) {
            if (m.alfa > 0) {
              const a0 = m.alfa;
              m.alfa = Math.max(0, m.alfa - M.borra);
              borrando = true;
              if (a0 > 0.05 && m.alfa <= 0.05) {
                m.alfa = 0;
                eventos.push('mancha');
              }
              // Las migas caen alrededor de lo que se frota
              if (r() < 0.22 && migas.length < 46) migas.push({ u: m.u + ((r() - 0.5) * m.r * 3.2) / W, v: m.v + ((r() - 0.5) * m.r * 3.2) / D, g: r() });
            }
            dentro += paso;
          } else if (d <= m.r * 2.6 && m.alfa > 0) fuera += paso;
        }
      }
      frota = borrando;
      const quedan = manchas.reduce((s, m) => s + m.alfa, 0) / manchas.length;
      progreso = clamp((1 - quedan) * 0.85);
      if (manchas.every((m) => m.alfa <= 0.05)) {
        fase = 'barrer';
        frota = false;
        eventos.push('barrer');
      }
      return;
    }
    if (tipo === 'arrugas') {
      // Sin moverse no alisa (un toque quieto no es una pasada)
      if (len < 0.0005) return;
      const pasos = Math.max(1, Math.ceil(len / 0.004));
      let alisa = false;
      for (let i = 1; i <= pasos; i += 1) {
        const { s, d: lado } = sobrePliegue(a.u + ((b.u - a.u) * i) / pasos, a.v + ((b.v - a.v) * i) / pasos);
        // Fuera de las puntas, la distancia es a la punta más cercana
        const fuera = s < 0 ? -s : s > 1 ? s - 1 : 0;
        const d = Math.hypot(lado, fuera * Math.hypot((PLIEGUE.b[0] - PLIEGUE.a[0]) * W, (PLIEGUE.b[1] - PLIEGUE.a[1]) * D));
        if (d > M.sobrePliegue || s < -0.05 || s > 1.05) {
          lejos += 1;
          continue;
        }
        sobre += 1;
        desvio += d;
        const sc = clamp(s);
        // Dar la vuelta: retroceder un trecho cuenta como otra pasada (los tramos se pueden alisar otra vez)
        if (sAnt != null && sc !== sAnt) {
          const va = Math.sign(sc - sAnt);
          if (!sentido) sentido = va;
          else if (va !== sentido) {
            atras += Math.abs(sc - sAnt);
            if (atras >= M.vuelta) {
              sentido = va;
              atras = 0;
              pase += 1;
            }
          } else atras = 0;
        }
        sAnt = sc;
        alisa = true;
        const k = Math.min(TRAMOS_PLIEGUE - 1, Math.floor(sc * TRAMOS_PLIEGUE));
        if (paseDe[k] !== pase && tramos[k] > 0) {
          paseDe[k] = pase;
          tramos[k] = Math.max(0, tramos[k] - 0.5);
          // Cada tramo que queda liso, una nota que sube (el último, el «ya está» de la página); a medias, el papel que cede
          if (tramos[k] === 0) {
            lisos += 1;
            eventos.push(`liso:${lisos}`);
          } else eventos.push(`aplana:${k}`);
        }
      }
      frota = alisa;
      const queda = tramos.reduce((s, x) => s + x, 0) / tramos.length;
      progreso = clamp(1 - queda) * 0.98;
      if (queda <= 0) {
        eventos.push('alisado');
        const medio = sobre ? desvio / sobre : 0;
        terminar(eventos, medio > M.centrado || lejos > sobre * 0.4 ? 1 : 2);
      }
      return;
    }
    if (tipo === 'cola') {
      const pasos = Math.max(1, Math.ceil(len / 0.004));
      let pinta = false;
      for (let i = 1; i <= pasos; i += 1) {
        const u = a.u + ((b.u - a.u) * i) / pasos;
        const v = a.v + ((b.v - a.v) * i) / pasos;
        if (u > M.lomoAncho || v < -0.03 || v > 1.03) continue;
        const k = clamp(Math.floor(clamp(v, 0, 0.999) * cola.length), 0, cola.length - 1);
        cola[k] += ((len / pasos) / (D / cola.length)) * M.cola;
        pinta = true;
      }
      frota = pinta && len > 0.0005;
      progreso = clamp(cola.reduce((s, c) => s + Math.min(1, c), 0) / cola.length);
      if (cola.every((c) => c >= 1)) terminar(eventos, cola.some((c) => c > M.colaDeMas) ? 1 : 2);
    }
  }

  return {
    get estado() {
      return estado();
    },
    abajo({ u, v, x, y, t = 0 }) {
      if (hecho) return estado();
      pulsado = true;
      const eventos = ['abajo'];
      if (tipo === 'prensa') {
        const c = centro ?? { x: 0, y: 0 };
        angulo = Math.atan2(y - c.y, x - c.x);
        ultimo = { x, y, t };
        pose = { ...pose, baja: 1 };
        return estado(eventos);
      }
      if (u == null) return estado();
      ultimo = { u, v, t };
      pose = { u, v, baja: 1, presion: 0 };
      barridoDesde = fase === 'barrer' ? u : null;
      // Cada vez que se apoya la plegadera es una pasada nueva
      if (tipo === 'arrugas') {
        pase += 1;
        sentido = 0;
        atras = 0;
        sAnt = null;
      }
      if (tipo === 'dorado') {
        // La letra más cercana bajo el hierro (con un poco de holgura alrededor)
        let mejor = -1;
        let dm = Infinity;
        letras.forEach((l, k) => {
          if (oro[k] >= 1) return;
          const du = Math.abs(u - l.u) / (l.w / 2);
          const dv = Math.abs(v - l.v) / (l.h / 2);
          const d = Math.max(du, dv);
          if (d < 1.6 && d < dm) {
            dm = d;
            mejor = k;
          }
        });
        letra = mejor;
        tPulsa = t;
        if (mejor >= 0) {
          if (centradas[mejor] == null || dm <= M.oroCentro) centradas[mejor] = dm <= M.oroCentro;
          eventos.push('hierro');
        }
      }
      if (tipo === 'exlibris') {
        tPulsa = t;
        exlibris = { ...exlibris, baja: 1, u: clamp(u, 0.2, 0.275), v: clamp(v, 0.3, 0.68) };
      }
      return estado(eventos);
    },
    mover({ u, v, x, y, t = 0 }) {
      if (!pulsado || hecho) return estado();
      const eventos = [];
      if (tipo === 'prensa') {
        const c = centro ?? { x: 0, y: 0 };
        const rr = Math.hypot(x - c.x, y - c.y);
        if (rr >= M.radioHusillo * Math.max(0.6, escala)) {
          const a = Math.atan2(y - c.y, x - c.x);
          let d = a - angulo;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          angulo = a;
          // Hacia los dos lados sirve (como la manivela); lo que cuenta es lo girado
          girado += Math.abs(d);
          const q = Math.floor(girado / (Math.PI / 2));
          if (q > cuartos) {
            cuartos = q;
            eventos.push('husillo');
          }
          frota = Math.abs(d) > 0.01;
          progreso = clamp(girado / (M.vueltas * Math.PI * 2));
          if (progreso >= 1) {
            eventos.push('tope');
            terminar(eventos, 2);
          }
        }
        return estado(eventos);
      }
      if (u == null) return estado();
      const dt = Math.max(1, t - (ultimo?.t ?? t));
      const a = ultimo ?? { u, v };
      pose = { ...pose, u, v };
      if (tipo === 'dorado' || tipo === 'exlibris') {
        if (tipo === 'exlibris') exlibris = { ...exlibris, u: clamp(u, 0.2, 0.275), v: clamp(v, 0.3, 0.68) };
        ultimo = { u, v, t };
        return estado();
      }
      tramo(a, { u, v }, dt, eventos, t);
      ultimo = { u, v, t };
      return estado(eventos);
    },
    /** Lo que se mantiene (el oro y el ex libris) avanza con el tiempo mientras se aprieta. */
    paso(t = 0) {
      if (!pulsado || hecho) return estado();
      const eventos = [];
      if (tipo === 'dorado' && letra >= 0) {
        const l = letras[letra];
        const d = Math.max(Math.abs(pose.u - l.u) / (l.w / 2), Math.abs(pose.v - l.v) / (l.h / 2));
        if (d < 2.2) {
          const dt = Math.max(0, t - tPulsa);
          oro[letra] = clamp(oro[letra] + dt / M.oroMs);
          pose = { ...pose, presion: oro[letra] };
          if (oro[letra] >= 1) {
            eventos.push(`oro:${letra}`);
            letra = -1;
          }
        }
        tPulsa = t;
        progreso = clamp(oro.reduce((s, o) => s + o, 0) / oro.length);
        if (oro.every((o) => o >= 1)) {
          const bien = centradas.filter(Boolean).length;
          terminar(eventos, bien >= letras.length * 0.8 ? 2 : 1);
        }
      }
      if (tipo === 'exlibris') {
        const pr = clamp(exlibris.presion + Math.max(0, t - tPulsa) / M.exlibrisMs);
        tPulsa = t;
        exlibris = { ...exlibris, presion: pr };
        progreso = pr;
        if (pr >= 1) {
          exlibris = { ...exlibris, sellado: true, baja: 0 };
          eventos.push('sellado');
          terminar(eventos, 2);
        }
      }
      return estado(eventos);
    },
    arriba() {
      pulsado = false;
      frota = false;
      ultimo = null;
      barridoDesde = null;
      if (tipo === 'dorado') letra = -1;
      if (tipo === 'exlibris') exlibris = { ...exlibris, baja: 0 };
      pose = { ...pose, baja: 0 };
      // El pliegue: soltar no pierde nada de lo alisado
      if (tipo === 'arrugas') sAnt = null;
      return estado(['arriba']);
    },
    /** De una vez (movimiento reducido o teclado): queda hecho y bien. */
    completar() {
      if (hecho) return estado();
      const eventos = [];
      if (polvo) {
        polvo.fill(0);
        moho.fill(0);
      }
      if (manchas) {
        for (const m of manchas) m.alfa = 0;
        migas.length = 0;
        barrido = 1;
      }
      if (tramos) tramos.fill(0);
      if (cola) cola.fill(1.2);
      if (tipo === 'prensa') {
        girado = M.vueltas * Math.PI * 2;
        eventos.push('tope');
      }
      if (oro) oro.fill(1);
      if (tipo === 'exlibris') {
        exlibris = { ...exlibris, sellado: true, baja: 0, presion: 1 };
        eventos.push('sellado');
      }
      terminar(eventos, 2);
      return estado(eventos);
    },
  };
}
