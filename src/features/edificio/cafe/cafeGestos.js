// El café-librería del bajo · preparar en la barra (Francisco, 12-11-2026: «quiero que el proceso de hacer el cafe sea
// divertido y adictivo, y que cada paso se sienta unico, tanto por los movimientos que haga el usuario como por los objetos
// que tenga que ver»). La receta no cambia (bebida, grano u hoja, leche y toque; las mismas que el servidor); cambia cómo se
// hace: cada etapa tiene su objeto y su gesto.
// - Bebida: tocar la cafetera o la tetera.
// - Grano: el tarro y la manivela del molinillo (dos vueltas). Hoja: el tarro y la cuchara hasta el colador.
// - Extracción: apisonar (deslizar hacia abajo) y bajar la palanca y mantenerla. Infusión: levantar la tetera y mantenerla,
//   y subir y bajar el colador.
// - Leche: inclinar la jarra bajo el vapor y mantenerla, y servirla con pulso (un trazo hacia abajo; ondulado, sale una hoja).
// - Toque: agitar el bote de canela o dibujar un hilo de miel.
// Bloque 4a (1.122), una receta nueva por nivel con su gesto y su objeto (Francisco, 12-11-2026):
// - Chocolate (nivel 2): el cacao se elige en su tarro; en el cazo de cobre, remover con el molinillo de madera (círculos
//   amplios, tres vueltas: se espesa) y servir inclinando el cazo sobre la taza (deslizar a la izquierda y mantener).
// - Nata montada (nivel 3): batir girando las varillas en el bol (vueltas pequeñas y seguidas, hasta que hace picos).
// Bloque 4b (1.123), con su gesto y su objeto (Francisco, 12-11-2026):
// - Vainilla (nivel 4): en la tabla, rascar la vaina con la punta del cuchillo, de arriba abajo, tres trazos (cada uno se
//   vuelve a armar subiendo el dedo o soltándolo); las semillas negras caen en la taza.
// - Café con hielo (nivel 5): se muele y se extrae como el café; después, en la coctelera con hielo, agitar de lado a lado
//   con vaivenes amplios (diez, el hielo suena). La leche, fría: sin vapor, solo servirla.
// Reglas: ningún gesto falla ni tiene tiempo límite; lo hecho no se pierde al soltar; los gestos no cambian las estrellas
// (solo cuenta la receta); con movimiento reducido o con el teclado, cada gesto se hace de una vez (`completar`).
// Aquí, solo cuentas (sin React ni Three): los reconocedores reciben puntos en píxeles y dan el progreso y la postura.

export const ETAPAS = ['bebida', 'grano', 'extraer', 'leche', 'toque'];

/** El nombre corto de una etapa (en la fila de arriba del cuadro), según la bebida. */
export function nombreEtapa(id, receta = {}) {
  const te = receta.bebida === 'te';
  const choco = receta.bebida === 'chocolate';
  const frio = receta.bebida === 'frio';
  return { bebida: 'Bebida', grano: te ? 'Hoja' : choco ? 'Cacao' : 'Grano', extraer: te ? 'Reposar' : choco ? 'Remover' : frio ? 'Agitar' : 'Extraer', leche: 'Leche', toque: 'Toque' }[id] ?? id;
}

/** Qué se elige en cada etapa (la extracción no tiene elección: sale de la bebida). */
export const ELIGE = { bebida: 'bebida', grano: 'grano', extraer: null, leche: 'leche', toque: 'toque' };

/** Los gestos de una etapa, en orden, para la receta elegida hasta ahí. */
export function gestosDe(etapa, receta = {}) {
  const te = receta.bebida === 'te';
  // El chocolate: el cacao va directo al cazo (se elige el tarro y ya); lo suyo es remover y servir
  if (receta.bebida === 'chocolate') {
    if (etapa === 'grano') return [];
    if (etapa === 'extraer') return ['molinillo', 'cazo'];
  }
  const frio = receta.bebida === 'frio';
  if (etapa === 'grano') return [te ? 'cuchara' : 'manivela'];
  // El café con hielo: después de extraer, a la coctelera
  if (etapa === 'extraer') return te ? ['tetera', 'colador'] : frio ? ['apisonar', 'palanca', 'coctelera'] : ['apisonar', 'palanca'];
  // La leche del café con hielo va fría: sin vapor
  if (etapa === 'leche') return receta.leche && receta.leche !== 'sin' ? (frio ? ['verter'] : ['vapor', 'verter']) : [];
  if (etapa === 'toque') return { canela: ['agitar'], miel: ['hilo'], nata: ['batir'], vainilla: ['rascar'] }[receta.toque] ?? [];
  return [];
}

/** Lo que dice el cuadro para cada gesto: la orden, la ayuda y el botón de un toque (movimiento reducido). */
export const GESTOS = {
  manivela: { orden: 'Gira la manivela del molinillo', ayuda: 'Dos vueltas, hacia el lado que quieras.', atajo: 'Moler', pista: 'giro' },
  apisonar: { orden: 'Apisona el café', ayuda: 'Desliza el prensador hacia abajo, con firmeza.', atajo: 'Apisonar', pista: 'abajo' },
  palanca: { orden: 'Baja la palanca y mantenla', ayuda: 'Mientras la tienes abajo, cae el café en la taza.', atajo: 'Extraer', pista: 'abajo-mantener' },
  cuchara: { orden: 'Lleva una cucharada al colador', ayuda: 'Arrastra la cuchara del tarro hasta la taza.', atajo: 'Echar las hojas', pista: 'derecha' },
  tetera: { orden: 'Levanta la tetera y vierte', ayuda: 'Desliza hacia arriba y mantén mientras se llena.', atajo: 'Verter el agua', pista: 'arriba-mantener' },
  colador: { orden: 'Sube y baja el colador', ayuda: 'Unas cuantas veces, para que el té suelte su color.', atajo: 'Infusionar', pista: 'vaiven-vertical' },
  vapor: { orden: 'Inclina la jarra bajo el vapor', ayuda: 'Desliza hacia un lado y mantén hasta que la leche se cree.', atajo: 'Cremar la leche', pista: 'lado-mantener' },
  verter: { orden: 'Sirve la leche con pulso', ayuda: 'Un trazo hacia abajo. Recto, sale un corazón; ondulado, una hoja.', atajo: 'Servir la leche', pista: 'trazo' },
  agitar: { orden: 'Agita la canela sobre la taza', ayuda: 'Sacude de lado a lado.', atajo: 'Espolvorear', pista: 'vaiven' },
  hilo: { orden: 'Dibuja un hilo de miel', ayuda: 'Pasa el dedo por encima de la taza, como quieras.', atajo: 'Echar la miel', pista: 'dibujo' },
  molinillo: { orden: 'Remueve el chocolate con el molinillo', ayuda: 'Círculos amplios dentro del cazo: tres vueltas y se espesa.', atajo: 'Remover', pista: 'remover' },
  cazo: { orden: 'Inclina el cazo sobre la taza', ayuda: 'Desliza hacia la izquierda y mantén mientras cae el chocolate.', atajo: 'Servir el chocolate', pista: 'izquierda-mantener' },
  batir: { orden: 'Bate la nata girando las varillas', ayuda: 'Vueltas pequeñas y seguidas, hasta que haga picos.', atajo: 'Montar la nata', pista: 'batir' },
  rascar: { orden: 'Rasca la vaina de vainilla', ayuda: 'Pasa el cuchillo a lo largo de la vaina, de arriba abajo: tres trazos.', atajo: 'Rascar la vaina', pista: 'rascar' },
  coctelera: { orden: 'Agita la coctelera con hielo', ayuda: 'De lado a lado, con brío, hasta que el hielo cante.', atajo: 'Agitar', pista: 'coctelera' },
  // Bloque 6b (1.127): en el tostador del sótano, no en la barra
  tambor: { orden: 'Tira del asa de la trampilla y mantén', ayuda: 'Hacia ti (hacia abajo) y sin soltar, mientras caen los granos al enfriador.', atajo: 'Abrir la trampilla', pista: 'tirar' },
};

/** Tiempos de los gestos que se mantienen (lo mantenido se suma: soltar no pierde nada). */
export const MANTENER_MS = { palanca: 1400, tetera: 1500, vapor: 1500, cazo: 1500, tambor: 1600 };
/** Vueltas de la manivela, vaivenes y trazos (en píxeles a 390 px de ancho; se escalan con la pantalla). */
export const MEDIDAS = {
  vueltas: 2,
  radioMin: 18,
  /** El molinillo remueve en círculos amplios (más radio, tres vueltas); las varillas, en vueltas pequeñas (cinco). */
  vueltasMolinillo: 3,
  radioMolinillo: 34,
  vueltasBatir: 5,
  radioBatir: 10,
  cazo: 70,
  apisonar: 70,
  palanca: 100,
  cuchara: 140,
  tetera: 80,
  vaivenColador: 22,
  vecesColador: 5,
  vapor: 70,
  verter: 150,
  ondaVerter: 10,
  ondasHoja: 3,
  vaivenAgitar: 20,
  vecesAgitar: 8,
  /** La coctelera: vaivenes mucho más amplios que la canela, y más. */
  vaivenCoctelera: 46,
  vecesCoctelera: 10,
  /** La vainilla: tres trazos hacia abajo de este largo; se vuelve a armar subiendo esto o soltando. */
  rascar: 60,
  rearmeRascar: 24,
  trazosRascar: 3,
  hilo: 300,
  /** El asa de la trampilla del tambor: tanto hacia abajo para abrirla del todo. */
  tambor: 90,
};

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/** La postura de cada objeto al empezar su gesto. */
function poseInicial(tipo) {
  return {
    manivela: { angulo: 0, molido: 0 },
    apisonar: { bajada: 0 },
    palanca: { bajada: 0, extraido: 0 },
    cuchara: { t: 0 },
    tetera: { alzada: 0, lleno: 0 },
    colador: { altura: 0, inmersiones: 0 },
    vapor: { inclina: 0, espuma: 0 },
    verter: { vertido: 0, x: 0, ondas: 0, arte: null },
    agitar: { x: 0, golpes: 0 },
    hilo: { puntos: [] },
    molinillo: { angulo: 0, espeso: 0 },
    cazo: { inclina: 0, servido: 0 },
    batir: { angulo: 0, montada: 0 },
    rascar: { t: 0, raspados: 0 },
    coctelera: { x: 0, agitado: 0, golpes: 0 },
    tambor: { abierta: 0, caido: 0 },
  }[tipo];
}
/** Los gestos que giran alrededor de un centro: cuántas vueltas y desde qué distancia cuenta. */
const GIROS = { manivela: ['vueltas', 'radioMin', 'molido'], molinillo: ['vueltasMolinillo', 'radioMolinillo', 'espeso'], batir: ['vueltasBatir', 'radioBatir', 'montada'] };

/** Cuenta vaivenes en un eje: un cambio de sentido cuenta si el recorrido desde el último extremo pasa de `amplitud`. */
function vaiven(amplitud) {
  let dir = 0;
  let extremo = null;
  let veces = 0;
  return {
    empezar(v) {
      dir = 0;
      extremo = v;
    },
    /** Devuelve true si este punto ha sido un cambio de sentido. */
    mover(v) {
      if (extremo == null) extremo = v;
      if (dir === 0) {
        if (Math.abs(v - extremo) >= amplitud) {
          dir = Math.sign(v - extremo);
          extremo = v;
        }
        return false;
      }
      if ((v - extremo) * dir > 0) {
        extremo = v;
        return false;
      }
      if (Math.abs(v - extremo) >= amplitud) {
        dir = -dir;
        extremo = v;
        veces += 1;
        return true;
      }
      return false;
    },
    get veces() {
      return veces;
    },
  };
}

/**
 * Un gesto de la barra. `escala`: ancho de la pantalla / 390 (las distancias crecen con ella); `centro`: dónde está el
 * objeto en la pantalla (la manivela gira a su alrededor; la miel se dibuja sobre la taza). Cada llamada devuelve el
 * estado nuevo: { progreso (0 a 1), hecho, pose, pulsado, eventos (para los sonidos) }.
 */
export function crearGesto(tipo, { escala = 1, centro = null } = {}) {
  const e = Math.max(0.6, escala);
  const M = MEDIDAS;
  let progreso = 0;
  let hecho = false;
  let pose = poseInicial(tipo);
  let pulsado = false;
  let x0 = 0;
  let y0 = 0;
  let ultimo = null;
  let base = 0;
  let ang = 0;
  let total = 0;
  let clics = 0;
  let largo = 0;
  let tAntes = 0;
  const c = centro ?? { x: 0, y: 0 };
  const vv = vaiven((tipo === 'colador' ? M.vaivenColador : tipo === 'verter' ? M.ondaVerter : tipo === 'coctelera' ? M.vaivenCoctelera : M.vaivenAgitar) * e);
  // La vainilla: dónde empezó el trazo, si está armado y lo más abajo que ha llegado
  let armado = true;
  let yTrazo = 0;
  let yArriba = 0;
  let trazos = 0;

  const estado = (eventos = []) => ({ tipo, progreso, hecho, pose, pulsado, eventos });
  const acabar = (eventos) => {
    if (hecho) return;
    hecho = true;
    progreso = 1;
    eventos.push('hecho');
  };

  return {
    tipo,
    get estado() {
      return estado();
    },
    abajo(x, y, t = 0) {
      if (hecho) return estado();
      pulsado = true;
      x0 = x;
      y0 = y;
      ultimo = { x, y };
      base = progreso;
      tAntes = t;
      ang = Math.atan2(y - c.y, x - c.x);
      vv.empezar(tipo === 'colador' ? y : x);
      armado = true;
      yTrazo = y;
      yArriba = y;
      const eventos = ['toca'];
      if (tipo === 'hilo') pose = { puntos: [...pose.puntos, [clamp((x - c.x) / (110 * e), -1, 1), clamp((y - c.y) / (110 * e), -1, 1)]].slice(-48) };
      return estado(eventos);
    },
    mover(x, y, t = 0) {
      if (!pulsado || hecho) return estado();
      const eventos = [];
      const dx = x - x0;
      const dy = y - y0;
      if (GIROS[tipo]) {
        const [kV, kR, kP] = GIROS[tipo];
        if (Math.hypot(x - c.x, y - c.y) >= M[kR] * e) {
          const a = Math.atan2(y - c.y, x - c.x);
          const d = wrap(a - ang);
          ang = a;
          total += Math.abs(d);
          progreso = clamp(total / (M[kV] * 2 * Math.PI));
          pose = { angulo: pose.angulo + d, [kP]: progreso };
          // El sonido de cada uno: el clic de la manivela, el chocolate que se arrastra en el cazo, el batido de las varillas
          const paso = tipo === 'batir' ? Math.PI / 2 : Math.PI / 4;
          const n = Math.floor(total / paso);
          if (n > clics) {
            clics = n;
            eventos.push({ manivela: 'clic', molinillo: 'remueve', batir: 'bate' }[tipo]);
          }
          if (progreso >= 1) acabar(eventos);
        } else ang = Math.atan2(y - c.y, x - c.x);
      } else if (tipo === 'apisonar') {
        const b = clamp(dy / (M.apisonar * e));
        progreso = Math.max(progreso, b);
        pose = { bajada: b };
        if (b >= 1) {
          eventos.push('golpe');
          acabar(eventos);
        }
      } else if (tipo === 'palanca') {
        const b = clamp(dy / (M.palanca * e));
        if (b >= 0.85 && pose.bajada < 0.85) eventos.push('abajo');
        pose = { ...pose, bajada: b };
      } else if (tipo === 'tambor') {
        // Tirar del asa hacia ti: la trampilla se abre; abierta del todo, caen los granos mientras la mantienes
        const b = clamp(dy / (M.tambor * e));
        if (b >= 0.85 && pose.abierta < 0.85) eventos.push('abre');
        pose = { ...pose, abierta: b };
      } else if (tipo === 'cuchara') {
        const tt = clamp(dx / (M.cuchara * e));
        pose = { t: tt };
        progreso = Math.max(progreso, tt);
        if (tt >= 0.9) {
          pose = { t: 1 };
          eventos.push('hojas');
          acabar(eventos);
        }
      } else if (tipo === 'tetera') {
        const al = clamp(-dy / (M.tetera * e));
        pose = { ...pose, alzada: al };
      } else if (tipo === 'colador') {
        if (vv.mover(y)) {
          eventos.push('plop');
          progreso = clamp(vv.veces / M.vecesColador);
          if (progreso >= 1) acabar(eventos);
        }
        pose = { altura: clamp(-dy / (60 * e), -1, 1), inmersiones: vv.veces };
      } else if (tipo === 'vapor') {
        pose = { ...pose, inclina: clamp(dx / (M.vapor * e), -1, 1) };
      } else if (tipo === 'cazo') {
        pose = { ...pose, inclina: clamp(-dx / (M.cazo * e)) };
      } else if (tipo === 'verter') {
        if (vv.mover(x)) eventos.push('onda');
        progreso = Math.max(progreso, clamp(base + Math.max(0, dy) / (M.verter * e)));
        pose = { vertido: progreso, x: clamp(dx / (50 * e), -1, 1), ondas: vv.veces, arte: null };
        if (progreso >= 1) {
          pose = { ...pose, arte: vv.veces >= M.ondasHoja ? 'hoja' : 'corazon' };
          acabar(eventos);
        }
      } else if (tipo === 'agitar') {
        if (vv.mover(x)) {
          eventos.push('sacudida');
          progreso = clamp(vv.veces / M.vecesAgitar);
          if (progreso >= 1) acabar(eventos);
        }
        pose = { x: clamp(dx / (40 * e), -1, 1), golpes: vv.veces };
      } else if (tipo === 'rascar') {
        // Cada trazo de arriba abajo cuenta una vez; subir el dedo (o soltarlo) lo vuelve a armar
        if (armado) {
          const tt = clamp((y - yTrazo) / (M.rascar * e));
          pose = { t: tt, raspados: trazos };
          progreso = Math.max(progreso, clamp((trazos + tt) / M.trazosRascar));
          if (tt >= 1) {
            trazos += 1;
            armado = false;
            yArriba = y;
            eventos.push('raspa');
            pose = { t: 1, raspados: trazos };
            progreso = clamp(trazos / M.trazosRascar);
            if (trazos >= M.trazosRascar) acabar(eventos);
          }
        } else {
          yArriba = Math.max(yArriba, y);
          if (yArriba - y >= M.rearmeRascar * e) {
            armado = true;
            yTrazo = y;
            pose = { t: 0, raspados: trazos };
          }
        }
      } else if (tipo === 'coctelera') {
        if (vv.mover(x)) {
          eventos.push('hielo');
          progreso = clamp(vv.veces / M.vecesCoctelera);
          if (progreso >= 1) acabar(eventos);
        }
        pose = { x: clamp(dx / (60 * e), -1, 1), agitado: progreso, golpes: vv.veces };
      } else if (tipo === 'hilo') {
        const d = Math.hypot(x - ultimo.x, y - ultimo.y);
        if (d >= 4 * e) {
          const antes = Math.floor(largo / (60 * e));
          largo += d;
          progreso = clamp(largo / (M.hilo * e));
          pose = { puntos: [...pose.puntos, [clamp((x - c.x) / (110 * e), -1, 1), clamp((y - c.y) / (110 * e), -1, 1)]].slice(-48) };
          if (Math.floor(largo / (60 * e)) > antes) eventos.push('hilo');
          if (progreso >= 1) acabar(eventos);
        }
      }
      ultimo = { x, y };
      tAntes = Math.max(tAntes, t);
      return estado(eventos);
    },
    /** Mientras se mantiene pulsado (cada cuadro): la palanca, la tetera y el vapor suman tiempo. */
    paso(t) {
      const dt = Math.max(0, Math.min(100, t - tAntes));
      tAntes = t;
      if (!pulsado || hecho || !MANTENER_MS[tipo]) return estado();
      const eventos = [];
      const listo = tipo === 'palanca' ? pose.bajada >= 0.85 : tipo === 'tambor' ? pose.abierta >= 0.85 : tipo === 'tetera' ? pose.alzada >= 0.6 : tipo === 'cazo' ? pose.inclina >= 0.6 : Math.abs(pose.inclina) >= 0.5;
      if (listo) {
        progreso = clamp(progreso + dt / MANTENER_MS[tipo]);
        const k = { palanca: 'extraido', tetera: 'lleno', vapor: 'espuma', cazo: 'servido', tambor: 'caido' }[tipo];
        pose = { ...pose, [k]: progreso };
        if (progreso >= 1) acabar(eventos);
      }
      return estado(eventos);
    },
    arriba() {
      pulsado = false;
      // Lo que se mueve con el dedo vuelve a su sitio; lo hecho se queda
      if (tipo === 'apisonar') pose = { bajada: hecho ? 1 : 0 };
      else if (tipo === 'palanca') pose = { ...pose, bajada: 0 };
      else if (tipo === 'tambor') pose = { ...pose, abierta: 0 };
      else if (tipo === 'cuchara' && !hecho) pose = { t: 0 };
      else if (tipo === 'tetera') pose = { ...pose, alzada: 0 };
      else if (tipo === 'colador') pose = { ...pose, altura: 0 };
      else if (tipo === 'vapor' || tipo === 'cazo') pose = { ...pose, inclina: 0 };
      else if (tipo === 'verter') pose = { ...pose, x: 0 };
      else if (tipo === 'agitar' || tipo === 'coctelera') pose = { ...pose, x: 0 };
      else if (tipo === 'rascar') pose = { ...pose, t: hecho ? 1 : 0 };
      return estado();
    },
    /** De una vez (movimiento reducido, teclado): el gesto acabado, con su resultado más sencillo. */
    completar() {
      const eventos = [];
      pulsado = false;
      pose = {
        manivela: { angulo: Math.PI * 4, molido: 1 },
        apisonar: { bajada: 1 },
        palanca: { bajada: 0, extraido: 1 },
        cuchara: { t: 1 },
        tetera: { alzada: 0, lleno: 1 },
        colador: { altura: 0, inmersiones: M.vecesColador },
        vapor: { inclina: 0, espuma: 1 },
        verter: { vertido: 1, x: 0, ondas: 0, arte: 'corazon' },
        agitar: { x: 0, golpes: M.vecesAgitar },
        hilo: { puntos: pose.puntos?.length ? pose.puntos : ESPIRAL },
        molinillo: { angulo: Math.PI * 6, espeso: 1 },
        cazo: { inclina: 0, servido: 1 },
        batir: { angulo: Math.PI * 10, montada: 1 },
        rascar: { t: 1, raspados: M.trazosRascar },
        coctelera: { x: 0, agitado: 1, golpes: M.vecesCoctelera },
        tambor: { abierta: 0, caido: 1 },
      }[tipo];
      acabar(eventos);
      return estado(eventos);
    },
  };
}

/** El hilo de miel por defecto (de una vez): una espiral pequeña. */
const ESPIRAL = Array.from({ length: 24 }, (_, k) => {
  const a = k * 0.55;
  const r = 0.15 + k * 0.028;
  return [Math.round(Math.cos(a) * r * 100) / 100, Math.round(Math.sin(a) * r * 100) / 100];
});

/**
 * Lo que se ve en la barra con lo hecho hasta ahora (para la escena): cuánto lleva la taza y de qué, la espuma, el dibujo de
 * la leche, la canela y la miel. `hechos`: { gesto: pose final }; `actual`: el gesto en curso y su postura.
 */
/** El dibujo de la leche: el de verdad al acabar; mientras se sirve, el que va saliendo (con el mismo criterio), de arriba abajo. */
function arteDe(v) {
  if (!v) return { arte: null };
  if (v.arte) return { arte: v.arte };
  if ((v.vertido ?? 0) <= 0.5) return { arte: null };
  return { arte: (v.ondas ?? 0) >= MEDIDAS.ondasHoja ? 'hoja' : 'corazon', arteParcial: ((v.vertido ?? 0) - 0.5) * 2 };
}
export function vistaTaza(receta = {}, hechos = {}, actual = null) {
  const pose = (g) => (actual?.tipo === g ? actual.pose : hechos[g]) ?? null;
  const te = receta.bebida === 'te';
  const conLeche = receta.leche && receta.leche !== 'sin';
  const base = conLeche ? 0.55 : 0.85;
  const choco = receta.bebida === 'chocolate';
  const frio = receta.bebida === 'frio';
  const primero = te ? (pose('tetera')?.lleno ?? 0) : choco ? (pose('cazo')?.servido ?? 0) : (pose('palanca')?.extraido ?? 0);
  const leche = conLeche ? (pose('verter')?.vertido ?? 0) : 0;
  // El té coge color con cada inmersión del colador
  const color = te ? clamp(0.35 + (pose('colador')?.inmersiones ?? 0) / MEDIDAS.vecesColador) : 1;
  return {
    lleno: clamp(primero * base + leche * (1 - base)),
    leche: conLeche ? clamp(leche) : 0,
    color,
    crema: !te && !choco && !frio && primero > 0.4,
    // El café con hielo: los cubitos aparecen en la taza al acabar de agitar
    hielo: frio ? (hechos.coctelera ? 1 : 0) : 0,
    // Las semillas de vainilla, según los trazos
    vainilla: receta.toque === 'vainilla' ? clamp((pose('rascar')?.raspados ?? 0) / MEDIDAS.trazosRascar) : 0,
    // La nata, que crece en picos según se bate y se posa en la taza al acabar
    nata: receta.toque === 'nata' ? (hechos.batir ? 1 : 0) : 0,
    espeso: choco ? (pose('molinillo')?.espeso ?? 0) : 0,
    ...(frio ? { arte: null } : arteDe(pose('verter'))),
    canela: clamp((pose('agitar')?.golpes ?? 0) / MEDIDAS.vecesAgitar),
    miel: pose('hilo')?.puntos ?? [],
    hojas: te && (pose('cuchara')?.t ?? 0) >= 1,
  };
}

/**
 * Las ayudas visuales (Francisco, 12-11-2026: «para que la gente no se líe a causa del pixel art»): una «!» de píxel sobre lo
 * siguiente que hay que tocar. 'auto': en los niveles 1 y 2 siempre y, después, si alguien se queda parado; 'siempre'; 'nunca'.
 * Al elegir, sobre todas las opciones de esa parte (nunca delata cuál es la buena).
 */
/** Dónde va la notita del cómo: a un lado de la pista si cabe (148 de ancho a 50 del centro), y si no, debajo. */
const NOTA = { ancho: 148, aparte: 50, margen: 8 };
export function ladoNota(x, ancho) {
  const hueco = NOTA.aparte + NOTA.ancho + NOTA.margen;
  if (x + hueco <= ancho) return 'der';
  if (x - hueco >= 0) return 'izq';
  return 'abajo';
}
export const AYUDA_NIVELES = 2;
export const AYUDA_PARADO_MS = 6000;
export function verAyuda(ayudas, nivel, parado) {
  if (ayudas === 'nunca') return false;
  if (ayudas === 'siempre') return true;
  return (nivel ?? 1) <= AYUDA_NIVELES || Boolean(parado);
}
