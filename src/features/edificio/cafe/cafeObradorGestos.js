// El café-librería del bajo, 1.143: los gestos del obrador (docs/qa/cafe-libreria.md §18.5). Cada receta, dos gestos con su
// objeto y su sonido; después, la pala al horno y, en la barra, las pinzas.
// - Magdalenas de limón: rallar (el limón, de arriba abajo por el rallador de latón, en pasadas largas) y colmar (la cuchara
//   por encima de los seis moldes de papel rizado: una pasada de ida y otra de vuelta).
// - Empanada de bonito: el rodillo (arriba y abajo, de punta a punta de la masa) y el repulgo (dar la vuelta al borde de la
//   fuente de barro con el dedo).
// - La pala: meterla (empujar hacia el fondo, hacia arriba en la pantalla) y sacarla (tirar hacia ti, hacia abajo).
// - Las pinzas: de la vitrina al plato (bajar).
// Las reglas de la barra: ningún gesto falla ni tiene tiempo límite; lo hecho no se pierde al soltar; con movimiento reducido o
// con el teclado, cada gesto se hace de una vez (`completar`) y queda bien. Como en el taller, el mimo cuenta: cada gesto de la
// receta queda «bien» (2) o «se podía mejorar» (1), y de ahí salen las estrellas de la hornada. Las distancias, en px a 390 de
// ancho (crecen con la pantalla). Solo cuentas: sin React ni Three.

export const MEDIDAS_OBRADOR = {
  /** Rallar: el recorrido que hace falta (en pasadas largas de este largo) y cuántas pasadas como mucho para que quede bien. */
  rallar: 110,
  pasadasRallar: 5,
  maxRallar: 8,
  /** Colmar: el ancho de la fila de moldes (seis), lo que llena cruzar uno entero y desde cuánto rebosa. */
  moldes: 6,
  filaMoldes: 300,
  colmo: 1.45,
  cruce: 0.55,
  /** El rodillo: el recorrido (tres pasadas de este largo) y cuántas, como mucho, para que quede pareja. */
  rodillo: 130,
  pasadasRodillo: 3,
  maxRodillo: 5,
  /** El repulgo: el radio del borde (px a 390), los tramos que hay que cerrar y cuánto se puede apartar el dedo del borde. */
  radioRepulgo: 92,
  tramosRepulgo: 24,
  bordeRepulgo: 0.3,
  /** Fracción del recorrido que tiene que ir pegada al borde para que quede bien. */
  pegado: 0.7,
  /** La pala y las pinzas: el recorrido hasta el final. */
  pala: 120,
  pinzas: 90,
};
const M = MEDIDAS_OBRADOR;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

/** Los gestos de la receta (en su orden) y si cuentan para el mimo. */
export const GESTOS_RECETA = { magdalenas: ['rallar', 'colmar'], empanada: ['rodillo', 'repulgo'] };
export const CON_MIMO = new Set(['rallar', 'colmar', 'rodillo', 'repulgo']);

/** La postura de cada objeto al empezar. */
function poseInicial(tipo) {
  return {
    rallar: { t: 0, rallado: 0, pasadas: 0 },
    colmar: { x: -1, llenos: Array(M.moldes).fill(0) },
    rodillo: { y: 0, estirada: 0, pasadas: 0 },
    repulgo: { angulo: 0, hechos: Array(M.tramosRepulgo).fill(false), dentro: true },
    meter: { dentro: 0 },
    sacar: { fuera: 0 },
    pinzas: { baja: 0, cogida: false },
  }[tipo];
}

/**
 * Un gesto del obrador. `escala`: ancho de la pantalla / 390; `centro`: dónde está el objeto en la pantalla (el repulgo da la
 * vuelta a su alrededor; los moldes se reparten a sus lados); `ancho` (la fila de moldes) y `radio` (el borde de la fuente), en px. Cada llamada devuelve el estado nuevo: { tipo, progreso (0 a 1),
 * hecho, pose, pulsado, eventos (para los sonidos), mimo (2 o 1; solo al acabar los que cuentan) }.
 */
export function crearGestoObrador(tipo, { escala = 1, centro = null, ancho = null, radio = null } = {}) {
  const e = Math.max(0.6, escala);
  // La fila de moldes y el borde de la fuente, medidos en la escena si se dan (px); si no, los de 390 px de ancho, escalados
  const fila = ancho > 40 ? ancho : M.filaMoldes * e;
  const radioBorde = radio > 20 ? radio : M.radioRepulgo * e;
  const c = centro ?? { x: 195 * e, y: 400 };
  let progreso = 0;
  let hecho = false;
  let pose = poseInicial(tipo);
  let pulsado = false;
  let mimo = null;
  let ultimo = null;
  let y0 = 0;
  // Los trazos (rallar, rodillo): de dónde viene y hacia dónde va el que está en marcha
  let recorrido = 0;
  let pasadas = 0;
  let dir = 0;
  let tramo = 0;
  // El repulgo: cuánto del recorrido iba pegado al borde
  let enBorde = 0;
  let total = 0;
  let angAntes = null;

  const estado = (eventos = []) => ({ tipo, progreso, hecho, pose, pulsado, eventos, mimo });
  const acabar = (eventos, m) => {
    if (hecho) return;
    hecho = true;
    progreso = 1;
    if (CON_MIMO.has(tipo)) mimo = m;
    eventos.push('hecho');
  };
  const moldeEn = (x) => {
    const ancho = fila;
    const u = (x - (c.x - ancho / 2)) / ancho;
    return u < 0 || u >= 1 ? -1 : Math.floor(u * M.moldes);
  };

  return {
    tipo,
    get estado() {
      return estado();
    },
    abajo(x, y) {
      if (hecho) return estado();
      pulsado = true;
      ultimo = { x, y };
      y0 = y;
      dir = 0;
      tramo = 0;
      angAntes = null;
      const eventos = ['toca'];
      if (tipo === 'pinzas') {
        pose = { ...pose, cogida: true };
        eventos.push('pinza');
      }
      if (tipo === 'colmar') pose = { ...pose, x: clamp((x - c.x) / (fila / 2), -1.2, 1.2) };
      return estado(eventos);
    },
    mover(x, y) {
      if (!pulsado || hecho) return estado();
      const eventos = [];
      const dx = x - ultimo.x;
      const dy = y - ultimo.y;
      ultimo = { x, y };
      if (tipo === 'rallar') {
        // Solo cuenta hacia abajo; subir es volver a poner el limón arriba
        if (dy > 0) {
          recorrido += dy;
          tramo += dy;
          const antes = Math.floor((tramo - dy) / (14 * e));
          if (Math.floor(tramo / (14 * e)) > antes) eventos.push('raspa');
        } else if (dy < -4 * e && tramo > 0) {
          if (tramo >= 24 * e) pasadas += 1;
          tramo = 0;
        }
        const largo = M.rallar * e;
        progreso = clamp(recorrido / (largo * M.pasadasRallar));
        pose = { t: clamp(tramo / largo), rallado: progreso, pasadas };
        if (progreso >= 1) acabar(eventos, pasadas + (tramo >= 24 * e ? 1 : 0) <= M.maxRallar ? 2 : 1);
      } else if (tipo === 'colmar') {
        const ancho = fila;
        // El molde que pisa este tramo (por su punto medio): cruzar uno entero lo llena algo más de la mitad
        const k = moldeEn(x - dx / 2);
        const llenos = [...pose.llenos];
        if (k >= 0) {
          const antes = llenos[k];
          llenos[k] = Math.min(1.8, llenos[k] + (Math.abs(dx) / (ancho / M.moldes)) * M.cruce);
          if (antes < 1 && llenos[k] >= 1) eventos.push('colmado');
          if (antes <= M.colmo && llenos[k] > M.colmo) eventos.push('rebosa');
          if (Math.floor(antes * 4) < Math.floor(llenos[k] * 4)) eventos.push('masa');
        }
        pose = { x: clamp((x - c.x) / (ancho / 2), -1.2, 1.2), llenos };
        progreso = llenos.reduce((s, v) => s + Math.min(1, v), 0) / M.moldes;
        if (llenos.every((v) => v >= 0.97)) acabar(eventos, llenos.every((v) => v <= M.colmo) ? 2 : 1);
      } else if (tipo === 'rodillo') {
        const d = Math.sign(dy);
        if (d && dir && d !== dir && Math.abs(tramo) >= 18 * e) {
          pasadas += 1;
          tramo = 0;
          eventos.push('vuelta');
        }
        if (d) dir = d;
        tramo += Math.abs(dy);
        recorrido += Math.abs(dy);
        if (Math.floor((recorrido - Math.abs(dy)) / (20 * e)) < Math.floor(recorrido / (20 * e))) eventos.push('rueda');
        const largo = M.rodillo * e;
        progreso = clamp(recorrido / (largo * M.pasadasRodillo));
        pose = { y: clamp((y - y0) / largo, -1, 1), estirada: progreso, pasadas };
        if (progreso >= 1) acabar(eventos, pasadas + 1 <= M.maxRodillo ? 2 : 1);
      } else if (tipo === 'repulgo') {
        const R = radioBorde;
        const r = Math.hypot(x - c.x, y - c.y);
        const a = Math.atan2(y - c.y, x - c.x);
        const paso = Math.hypot(dx, dy);
        const pegadoAhora = Math.abs(r - R) <= R * M.bordeRepulgo;
        total += paso;
        if (pegadoAhora) enBorde += paso;
        const hechos = [...pose.hechos];
        // Cuenta el tramo bajo el dedo (y los que se salte entre dos puntos), mientras no se vaya al centro
        if (r >= R * 0.45) {
          const n = M.tramosRepulgo;
          const idx = (ang) => ((Math.floor(((ang + Math.PI) / (2 * Math.PI)) * n) % n) + n) % n;
          const desde = angAntes == null ? a : angAntes;
          let delta = Math.atan2(Math.sin(a - desde), Math.cos(a - desde));
          const pasos = Math.max(1, Math.ceil(Math.abs(delta) / ((2 * Math.PI) / n)));
          for (let k = 0; k <= pasos; k += 1) {
            const i = idx(desde + (delta * k) / pasos);
            if (!hechos[i]) {
              hechos[i] = true;
              eventos.push('pellizco');
            }
          }
          angAntes = a;
        } else angAntes = null;
        pose = { angulo: a, hechos, dentro: pegadoAhora };
        progreso = hechos.filter(Boolean).length / M.tramosRepulgo;
        if (progreso >= 1) acabar(eventos, total <= 0 || enBorde / total >= M.pegado ? 2 : 1);
      } else if (tipo === 'meter') {
        const v = clamp((y0 - y) / (M.pala * e));
        if (v > pose.dentro) pose = { dentro: v };
        progreso = pose.dentro;
        if (progreso >= 1) acabar(eventos);
      } else if (tipo === 'sacar') {
        const v = clamp((y - y0) / (M.pala * e));
        if (v > pose.fuera) pose = { fuera: v };
        progreso = pose.fuera;
        if (progreso >= 1) acabar(eventos);
      } else if (tipo === 'pinzas') {
        const v = clamp((y - y0) / (M.pinzas * e));
        if (v > pose.baja) pose = { ...pose, baja: v };
        progreso = pose.baja;
        if (progreso >= 1) {
          eventos.push('plato');
          acabar(eventos);
        }
      }
      return estado(eventos);
    },
    arriba() {
      pulsado = false;
      if (tipo === 'rallar' && tramo >= 24 * e) pasadas += 1;
      if (tipo === 'rallar') tramo = 0;
      if (tipo === 'pinzas' && !hecho) pose = { ...pose, cogida: false };
      angAntes = null;
      return estado([]);
    },
    /** De una vez (movimiento reducido o teclado): queda hecho y bien. */
    completar() {
      if (hecho) return estado();
      const eventos = [];
      pose = {
        rallar: { t: 0, rallado: 1, pasadas: M.pasadasRallar },
        colmar: { x: 1, llenos: Array(M.moldes).fill(1) },
        rodillo: { y: 0, estirada: 1, pasadas: M.pasadasRodillo },
        repulgo: { angulo: 0, hechos: Array(M.tramosRepulgo).fill(true), dentro: true },
        meter: { dentro: 1 },
        sacar: { fuera: 1 },
        pinzas: { baja: 1, cogida: true },
      }[tipo];
      if (tipo === 'pinzas') eventos.push('plato');
      acabar(eventos, 2);
      return estado(eventos);
    },
  };
}

/**
 * 1.144: «Que lo hornee Pilar» (con la receta dominada, maestría ★★★). El trazo con el que sus manos hacen un gesto bien hecho, en
 * px de la pantalla, con las mismas medidas que el reconocedor: { puntos: [{ x, y }], ms }. Se le da al reconocedor como si fuera un
 * dedo (abajo en el primero, mover en los demás), así suenan y se ven igual que a mano. El pulso, con `azar`: nunca dos iguales.
 */
export function trazoPilar(tipo, { escala = 1, centro = null, ancho = null, radio = null, azar = Math.random } = {}) {
  const e = Math.max(0.6, escala);
  const c = centro ?? { x: 195 * e, y: 400 };
  const pulso = () => (azar() - 0.5) * 4 * e;
  const ritmo = 0.9 + azar() * 0.2;
  const puntos = [];
  if (tipo === 'rallar') {
    const largo = M.rallar * e * 1.12;
    for (let k = 0; k < M.pasadasRallar; k += 1) {
      for (let i = 0; i <= 8; i += 1) puntos.push({ x: c.x + pulso(), y: c.y - largo / 2 + (largo * i) / 8 });
      for (let i = 1; i <= 3; i += 1) puntos.push({ x: c.x + pulso(), y: c.y + largo / 2 - (largo * i) / 3 });
    }
    return { puntos, ms: 1100 * ritmo };
  }
  if (tipo === 'colmar') {
    const fila = ancho > 40 ? ancho : M.filaMoldes * e;
    const a = c.x - fila / 2 - 8 * e;
    const b = c.x + fila / 2 + 8 * e;
    const y = c.y + pulso();
    for (let i = 0; i <= 72; i += 1) puntos.push({ x: a + ((b - a) * i) / 72, y });
    for (let i = 1; i <= 72; i += 1) puntos.push({ x: b - ((b - a) * i) / 72, y: y + 2 * e });
    return { puntos, ms: 900 * ritmo };
  }
  if (tipo === 'rodillo') {
    const largo = 112 * e;
    const x = c.x + pulso();
    for (let k = 0; k < 4; k += 1) for (let i = k ? 1 : 0; i <= 10; i += 1) puntos.push({ x, y: c.y + (k % 2 ? 1 : -1) * (largo / 2 - (largo * i) / 10) });
    return { puntos, ms: 850 * ritmo };
  }
  if (tipo === 'repulgo') {
    const R = radio > 20 ? radio : M.radioRepulgo * e;
    const desde = -Math.PI / 2 + (azar() - 0.5) * 0.6;
    for (let i = 0; i <= 52; i += 1) {
      const a = desde + ((2 * Math.PI + 0.4) * i) / 52;
      puntos.push({ x: c.x + Math.cos(a) * R, y: c.y + Math.sin(a) * R });
    }
    return { puntos, ms: 950 * ritmo };
  }
  if (tipo === 'meter') {
    for (let i = 0; i <= 9; i += 1) puntos.push({ x: c.x + pulso() / 2, y: c.y - (M.pala * e * 1.12 * i) / 9 });
    return { puntos, ms: 480 * ritmo };
  }
  return { puntos, ms: 0 };
}
