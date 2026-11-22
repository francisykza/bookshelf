// El café-librería del bajo, 1.143: los gestos del obrador (docs/qa/cafe-libreria.md §18.5). Cada receta, dos gestos con su
// objeto y su sonido; después, la pala al horno y, en la barra, las pinzas.
// - Magdalenas de limón: rallar (el limón, de arriba abajo por el rallador de latón, en pasadas largas) y colmar (la cuchara
//   por encima de los seis moldes de papel rizado: una pasada de ida y otra de vuelta).
// - Empanada de bonito: el rodillo (arriba y abajo, de punta a punta de la masa) y el repulgo (dar la vuelta al borde de la
//   fuente de barro con el dedo).
// - La pala: meterla (empujar hacia el fondo, hacia arriba en la pantalla) y sacarla (tirar hacia ti, hacia abajo).
// - Las pinzas: de la vitrina al plato (bajar).
// 1.145 (bloque 3), las cuatro recetas nuevas:
// - Galletas del puerto: los cortapastas (cuatro toques en la masa: que no se pisen) y la glasa (seguir la raya de puntos).
// - Pan de la bodega: amasar (cuatro empujones con la palma, parejos) y, al día siguiente, greñar (un tajo, sin dudar).
// - Bizcocho del tostadero: envolver (tres jotas enteras con la espátula) y el tamiz (cubrir la plantilla del ancla).
// - Tortilla de patatas: cascar (tres huevos: un toque y abrir de lado) y la vuelta con el plato (media vuelta sin parar).
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
  /** 1.145. Los cortapastas: la hoja de masa (medio ancho; el alto, el 60 %), cuántas formas y lo que se separan. */
  hojaGalletas: 140,
  formas: 4,
  separaFormas: 44,
  /** La glasa: el ancho de la raya, su ola, los tramos y lo que se puede apartar el dedo. */
  glasa: 250,
  olaGlasa: 20,
  tramosGlasa: 24,
  bordeGlasa: 18,
  /** Amasar: lo que hay que empujar en cada empujón, cuántos y cuánto pueden diferir (el más largo entre el más corto). */
  amasar: 56,
  empujes: 4,
  parejo: 1.8,
  /** Greñar: el largo del tajo. */
  grenar: 150,
  /** Envolver: lo que baja y lo que sube cada jota, y cuántas. */
  bajaJota: 52,
  subeJota: 26,
  jotas: 3,
  /** El tamiz: el ancho de la plantilla (el alto, el 60 %) y su cuadrícula. */
  plantilla: 200,
  colsTamiz: 4,
  filasTamiz: 3,
  /** Cascar: lo que hay que abrir el huevo de lado y cuántos. */
  abrirHuevo: 44,
  huevos: 3,
  /** La vuelta: el radio de la sartén y lo que se puede volver atrás sin que cuente (en radianes). */
  radioSarten: 78,
  atras: 0.35,
};
const M = MEDIDAS_OBRADOR;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

/** Los gestos de la receta (en su orden) y si cuentan para el mimo. */
export const GESTOS_RECETA = {
  magdalenas: ['rallar', 'colmar'],
  empanada: ['rodillo', 'repulgo'],
  galletas: ['cortapastas', 'glasa'],
  pan: ['amasar', 'grenar'],
  bizcocho: ['envolver', 'tamiz'],
  tortilla: ['cascar', 'vuelta'],
};
export const CON_MIMO = new Set(['rallar', 'colmar', 'rodillo', 'repulgo', 'cortapastas', 'glasa', 'amasar', 'grenar', 'envolver', 'tamiz', 'cascar', 'vuelta']);
/** Las cuatro formas de los cortapastas, en su orden. */
export const FORMAS_GALLETA = ['ancla', 'barco', 'estrella', 'faro'];
/** La raya de la glasa (de 0 a 1 a lo ancho): la altura de la ola, de -1 a 1. */
export const olaGlasa = (u) => Math.sin(u * Math.PI * 3);

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
    cortapastas: { cortes: [] },
    glasa: { hechos: Array(M.tramosGlasa).fill(false), u: null, dentro: true },
    amasar: { estira: 0, empujes: 0 },
    grenar: { corte: 0, u: 0 },
    envolver: { pliegues: 0, t: 0 },
    tamiz: { cubiertas: Array(M.colsTamiz * M.filasTamiz).fill(false), u: null, v: null, levantada: false },
    cascar: { huevos: 0, abre: 0, lado: 1, cascaras: 0 },
    vuelta: { giro: 0 },
  }[tipo];
}

/**
 * Un gesto del obrador. `escala`: ancho de la pantalla / 390; `centro`: dónde está el objeto en la pantalla (el repulgo da la
 * vuelta a su alrededor; los moldes se reparten a sus lados); `ancho` (la fila de moldes) y `radio` (el borde de la fuente), en px. Cada llamada devuelve el estado nuevo: { tipo, progreso (0 a 1),
 * hecho, pose, pulsado, eventos (para los sonidos), mimo (2 o 1; solo al acabar los que cuentan) }.
 */
export function crearGestoObrador(tipo, { escala = 1, centro = null, ancho = null, radio = null, alto = null, ola = null } = {}) {
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
  // 1.145: las medidas de las recetas nuevas (si no se dan en la escena, las de 390 px)
  const hojaW = ancho > 40 ? ancho / 2 : M.hojaGalletas * e;
  const hojaH = alto > 20 ? alto / 2 : hojaW * 0.6;
  const rayaW = ancho > 40 ? ancho : M.glasa * e;
  const plantW = ancho > 40 ? ancho : M.plantilla * e;
  const plantH = alto > 20 ? alto : plantW * 0.6;
  // La ola de la glasa: la que se ve en la escena (px), si se da; el margen para ir pegado, a su medida
  const olaPx = ola > 4 ? ola : M.olaGlasa * e;
  const bordePx = Math.max(M.bordeGlasa * e, olaPx * 0.8);
  const radioSarten = radio > 20 ? radio : M.radioSarten * e;
  // Amasar: dónde empezó el empujón, si ya contó y lo largo de cada uno
  let base = null;
  let contado = false;
  let largo = 0;
  const largos = [];
  // Greñar, envolver, cascar y la vuelta: las dudas (soltar a medias o volver atrás), las jotas rotas y lo de cada huevo
  let dudas = 0;
  let dirAntes = null;
  let baja = 0;
  let sube = 0;
  let fondo = null;
  let rotos = 0;
  let abierto = false;
  let dxHuevo = 0;
  let dyHuevo = 0;
  let giro = 0;
  let atras = 0;

  const estado = (eventos = []) => ({ tipo, progreso, hecho, pose, pulsado, eventos, mimo });
  const acabar = (eventos, m) => {
    if (hecho) return;
    hecho = true;
    progreso = 1;
    if (CON_MIMO.has(tipo)) mimo = m;
    eventos.push('hecho');
  };
  // El tamiz: marca las casillas de la plantilla por las que pasa el dedo (de a a b); dice si ha pasado por dentro
  function marcarTamiz(xa, ya, xb, yb, eventos) {
    const cub = [...pose.cubiertas];
    const pasos = Math.max(1, Math.ceil(Math.hypot(xb - xa, yb - ya) / (8 * e)));
    let dentro = false;
    for (let k = 0; k <= pasos; k += 1) {
      const px = xa + ((xb - xa) * k) / pasos;
      const py = ya + ((yb - ya) * k) / pasos;
      const u = (px - (c.x - plantW / 2)) / plantW;
      const v = (py - (c.y - plantH / 2)) / plantH;
      if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;
      dentro = true;
      const i = Math.floor(v * M.filasTamiz) * M.colsTamiz + Math.floor(u * M.colsTamiz);
      if (!cub[i]) {
        cub[i] = true;
        eventos.push('cubre');
      }
    }
    pose = { cubiertas: cub, u: (xb - c.x) / (plantW / 2), v: (yb - c.y) / (plantH / 2), levantada: false };
    progreso = cub.filter(Boolean).length / cub.length;
    return dentro;
  }
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
      if (tipo === 'cortapastas') {
        const u = (x - c.x) / hojaW;
        const v = (y - c.y) / hojaH;
        if (Math.abs(u) <= 1.05 && Math.abs(v) <= 1.05) {
          const pisa = pose.cortes.some((k) => Math.hypot((k.u - u) * hojaW, (k.v - v) * hojaH) < M.separaFormas * e);
          const cortes = [...pose.cortes, { u: clamp(u, -0.92, 0.92), v: clamp(v, -0.85, 0.85), forma: FORMAS_GALLETA[pose.cortes.length], pisa }];
          pose = { cortes };
          progreso = cortes.length / M.formas;
          eventos.push('corta');
          if (cortes.length >= M.formas) acabar(eventos, cortes.some((k) => k.pisa) ? 1 : 2);
        }
      }
      if (tipo === 'amasar') {
        base = y;
        contado = false;
        largo = 0;
        eventos.push('masaToca');
      }
      if (tipo === 'grenar') {
        dirAntes = null;
        if (progreso > 0) dudas += 1;
      }
      if (tipo === 'envolver') {
        baja = 0;
        sube = 0;
        fondo = y;
      }
      if (tipo === 'cascar') {
        abierto = false;
        dxHuevo = 0;
        dyHuevo = 0;
        pose = { ...pose, abre: 0 };
        eventos.push('golpe');
      }
      if (tipo === 'tamiz') marcarTamiz(x, y, x, y, eventos);
      if (tipo === 'glasa') pose = { ...pose, u: clamp((x - (c.x - rayaW / 2)) / rayaW, 0, 1) };
      if (tipo === 'vuelta') angAntes = Math.hypot(x - c.x, y - c.y) >= radioSarten * 0.3 ? Math.atan2(y - c.y, x - c.x) : null;
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
      } else if (tipo === 'glasa') {
        // Cada tramo de la raya se cubre al pasar por encima (a lo ancho); el mimo, cuánto del recorrido iba pegado a la raya
        const izq = c.x - rayaW / 2;
        const ua = clamp((x - dx - izq) / rayaW, 0, 1);
        const ub = clamp((x - izq) / rayaW, 0, 1);
        const pegadoAhora = Math.abs(y - (c.y + olaGlasa(ub) * olaPx)) <= bordePx;
        const paso = Math.hypot(dx, dy);
        total += paso;
        if (pegadoAhora) enBorde += paso;
        const hechos = [...pose.hechos];
        const n = M.tramosGlasa;
        const [a, b] = ua <= ub ? [ua, ub] : [ub, ua];
        const enRaya = (x - izq) / rayaW >= -0.03 && (x - izq) / rayaW <= 1.03;
        if (enRaya)
          for (let i = Math.floor(a * n); i <= Math.min(n - 1, Math.floor(b * n)); i += 1)
            if (!hechos[i]) {
              hechos[i] = true;
              eventos.push('glasa');
            }
        pose = { hechos, u: ub, dentro: pegadoAhora };
        progreso = hechos.filter(Boolean).length / n;
        if (progreso >= 1) acabar(eventos, total <= 0 || enBorde / total >= M.pegado ? 2 : 1);
      } else if (tipo === 'amasar') {
        const L = M.amasar * e;
        if (base == null) base = y;
        if (y > base) {
          // Recoger la masa (bajar el dedo) después de un empujón deja empezar el siguiente sin soltar
          if (contado && y - (base - largo) >= L * 0.5) {
            largos.push(largo);
            contado = false;
            largo = 0;
            eventos.push('recoge');
          }
          if (!contado) base = y;
        }
        const ext = Math.max(0, base - y);
        largo = Math.max(largo, ext);
        if (!contado && ext >= L) {
          contado = true;
          pose = { ...pose, empujes: pose.empujes + 1 };
          eventos.push('empuja');
        }
        pose = { ...pose, estira: clamp(ext / (L * 1.6)) };
        progreso = clamp((pose.empujes + (contado ? 0 : clamp(ext / L) * 0.9)) / M.empujes);
        if (pose.empujes >= M.empujes) {
          const todos = [...largos, largo].filter((v) => v > 0);
          acabar(eventos, Math.max(...todos) / Math.max(1, Math.min(...todos)) <= M.parejo ? 2 : 1);
        }
      } else if (tipo === 'grenar') {
        const paso = Math.hypot(dx, dy);
        if (paso > 0.5) {
          const d = [dx / paso, dy / paso];
          if (dirAntes && d[0] * dirAntes[0] + d[1] * dirAntes[1] < -0.3 && paso > 3 * e) dudas += 1;
          dirAntes = d;
          const antes = recorrido;
          recorrido += paso;
          if (Math.floor(antes / (26 * e)) < Math.floor(recorrido / (26 * e))) eventos.push('tajo');
        }
        progreso = clamp(recorrido / (M.grenar * e));
        pose = { corte: progreso, u: clamp((x - c.x) / (M.grenar * e * 0.6), -1, 1) };
        if (progreso >= 1) acabar(eventos, dudas === 0 ? 2 : 1);
      } else if (tipo === 'envolver') {
        // Una jota: baja por el centro y, desde lo más hondo, sube por el lado
        if (y > fondo) {
          if (sube > 6 * e) {
            // Vuelve a bajar sin acabar de subir: empieza otra jota (la de antes queda a medias)
            if (baja >= M.bajaJota * e * 0.5) rotos += 1;
            baja = 0;
            sube = 0;
          }
          baja += y - fondo;
          fondo = y;
        } else sube = Math.max(sube, fondo - y);
        const paso = Math.hypot(dx, dy);
        if (Math.floor(recorrido / (24 * e)) < Math.floor((recorrido + paso) / (24 * e))) eventos.push('espatula');
        recorrido += paso;
        const tJota = clamp((Math.min(baja, M.bajaJota * e) / (M.bajaJota * e)) * 0.6 + (Math.min(sube, M.subeJota * e) / (M.subeJota * e)) * 0.4);
        if (baja >= M.bajaJota * e && sube >= M.subeJota * e) {
          pose = { pliegues: pose.pliegues + 1, t: 0 };
          eventos.push('pliega');
          baja = 0;
          sube = 0;
          fondo = y;
        } else pose = { ...pose, t: tJota };
        progreso = clamp((pose.pliegues + pose.t * 0.9) / M.jotas);
        if (pose.pliegues >= M.jotas) acabar(eventos, rotos === 0 ? 2 : 1);
      } else if (tipo === 'tamiz') {
        const paso = Math.hypot(dx, dy);
        const dentro = marcarTamiz(x - dx, y - dy, x, y, eventos);
        total += paso;
        if (dentro) enBorde += paso;
        if (dentro && Math.floor(recorrido / (22 * e)) < Math.floor((recorrido + paso) / (22 * e))) eventos.push('azucar');
        recorrido += paso;
        if (progreso >= 1) {
          pose = { ...pose, levantada: true };
          acabar(eventos, total <= 0 || enBorde / total >= M.pegado ? 2 : 1);
        }
      } else if (tipo === 'cascar') {
        if (!abierto) {
          dxHuevo += dx;
          dyHuevo += Math.abs(dy);
          const abre = clamp(Math.abs(dxHuevo) / (M.abrirHuevo * e));
          pose = { ...pose, abre, lado: Math.sign(dxHuevo) || 1 };
          if (abre >= 1) {
            abierto = true;
            const cascara = dyHuevo > Math.abs(dxHuevo) * 0.75;
            pose = { ...pose, huevos: pose.huevos + 1, abre: 1, cascaras: pose.cascaras + (cascara ? 1 : 0) };
            eventos.push('abre');
            if (cascara) eventos.push('cascara');
          }
        }
        progreso = clamp((pose.huevos + (abierto ? 0 : pose.abre * 0.9)) / M.huevos);
        if (pose.huevos >= M.huevos) acabar(eventos, pose.cascaras === 0 ? 2 : 1);
      } else if (tipo === 'vuelta') {
        const r = Math.hypot(x - c.x, y - c.y);
        const a = Math.atan2(y - c.y, x - c.x);
        if (r >= radioSarten * 0.3 && angAntes != null) {
          const delta = Math.atan2(Math.sin(a - angAntes), Math.cos(a - angAntes));
          if (giro !== 0 && Math.sign(delta) !== Math.sign(giro) && Math.abs(delta) > 0.01) atras += Math.abs(delta);
          const antes = giro;
          giro += delta;
          if (Math.abs(antes) <= 0.2 && Math.abs(giro) > 0.2) eventos.push('gira');
        }
        angAntes = r >= radioSarten * 0.3 ? a : null;
        progreso = clamp(Math.abs(giro) / Math.PI);
        pose = { giro: progreso };
        if (progreso >= 1) {
          eventos.push('plof');
          acabar(eventos, atras <= M.atras && dudas === 0 ? 2 : 1);
        }
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
      if (tipo === 'amasar') {
        if (contado) largos.push(largo);
        contado = false;
        largo = 0;
        base = null;
        if (!hecho) pose = { ...pose, estira: 0 };
      }
      if (tipo === 'envolver' && !hecho && baja >= M.bajaJota * e * 0.5) {
        rotos += 1;
        baja = 0;
        sube = 0;
        pose = { ...pose, t: 0 };
      }
      if (tipo === 'vuelta' && !hecho && progreso > 0.1) dudas += 1;
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
        cortapastas: { cortes: FORMAS_GALLETA.map((forma, k) => ({ u: -0.66 + k * 0.44, v: k % 2 ? 0.3 : -0.3, forma, pisa: false })) },
        glasa: { hechos: Array(M.tramosGlasa).fill(true), u: 1, dentro: true },
        amasar: { estira: 0, empujes: M.empujes },
        grenar: { corte: 1, u: 0 },
        envolver: { pliegues: M.jotas, t: 0 },
        tamiz: { cubiertas: Array(M.colsTamiz * M.filasTamiz).fill(true), u: null, v: null, levantada: true },
        cascar: { huevos: M.huevos, abre: 1, lado: 1, cascaras: 0 },
        vuelta: { giro: 1 },
      }[tipo];
      if (tipo === 'pinzas') eventos.push('plato');
      if (tipo === 'vuelta') eventos.push('plof');
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
export function trazoPilar(tipo, { escala = 1, centro = null, ancho = null, radio = null, alto = null, ola = null, azar = Math.random } = {}) {
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
  // 1.145. Con `alza`, la mano se levanta antes de ese punto (un toque o un empujón nuevo)
  if (tipo === 'cortapastas') {
    const w = ancho > 40 ? ancho / 2 : M.hojaGalletas * e;
    const h = alto > 20 ? alto / 2 : w * 0.6;
    for (let k = 0; k < M.formas; k += 1) puntos.push({ x: c.x + (-0.66 + k * 0.44) * w + pulso(), y: c.y + (k % 2 ? 0.3 : -0.3) * h + pulso(), alza: k > 0 });
    return { puntos, ms: 1100 * ritmo };
  }
  if (tipo === 'glasa') {
    const w = ancho > 40 ? ancho : M.glasa * e;
    for (let i = 0; i <= 60; i += 1) {
      const u = -0.02 + (1.04 * i) / 60;
      puntos.push({ x: c.x - w / 2 + u * w, y: c.y + olaGlasa(Math.max(0, Math.min(1, u))) * (ola > 4 ? ola : M.olaGlasa * e) + pulso() / 2 });
    }
    return { puntos, ms: 1000 * ritmo };
  }
  if (tipo === 'amasar') {
    const L = M.amasar * e * 1.15;
    for (let k = 0; k < M.empujes; k += 1) for (let i = 0; i <= 6; i += 1) puntos.push({ x: c.x + pulso() / 2, y: c.y + L / 2 - (L * i) / 6, alza: k > 0 && i === 0 });
    return { puntos, ms: 1200 * ritmo };
  }
  if (tipo === 'grenar') {
    const L = M.grenar * e * 1.1;
    for (let i = 0; i <= 16; i += 1) {
      const t = i / 16;
      puntos.push({ x: c.x - L * 0.18 + Math.sin(t * Math.PI) * 18 * e, y: c.y - L / 2 + L * t });
    }
    return { puntos, ms: 420 * ritmo };
  }
  if (tipo === 'envolver') {
    const b = M.bajaJota * e * 1.15;
    const sb = M.subeJota * e * 1.3;
    for (let k = 0; k < M.jotas; k += 1) {
      for (let i = 0; i <= 6; i += 1) puntos.push({ x: c.x + pulso() / 2, y: c.y - b / 2 + (b * i) / 6, alza: k > 0 && i === 0 });
      for (let i = 1; i <= 5; i += 1) puntos.push({ x: c.x + (22 * e * i) / 5, y: c.y + b / 2 - (sb * i) / 5 });
    }
    return { puntos, ms: 1200 * ritmo };
  }
  if (tipo === 'tamiz') {
    const w = ancho > 40 ? ancho : M.plantilla * e;
    const h = alto > 20 ? alto : w * 0.6;
    for (let f = 0; f < M.filasTamiz; f += 1)
      for (let i = 0; i <= 10; i += 1) {
        const u = f % 2 ? 1 - i / 10 : i / 10;
        puntos.push({ x: c.x - w / 2 + (0.06 + u * 0.88) * w, y: c.y - h / 2 + ((f + 0.5) / M.filasTamiz) * h + pulso() / 2 });
      }
    return { puntos, ms: 1100 * ritmo };
  }
  if (tipo === 'cascar') {
    for (let k = 0; k < M.huevos; k += 1) {
      const lado = k % 2 ? -1 : 1;
      for (let i = 0; i <= 5; i += 1) puntos.push({ x: c.x + (lado * (M.abrirHuevo * e * 1.15 * i)) / 5, y: c.y + pulso() / 3, alza: k > 0 && i === 0 });
    }
    return { puntos, ms: 1100 * ritmo };
  }
  if (tipo === 'vuelta') {
    const R = radio > 20 ? radio : M.radioSarten * e;
    const desde = Math.PI / 2;
    for (let i = 0; i <= 24; i += 1) {
      const a = desde + ((Math.PI + 0.25) * i) / 24;
      puntos.push({ x: c.x + Math.cos(a) * R * 0.8, y: c.y + Math.sin(a) * R * 0.8 });
    }
    return { puntos, ms: 520 * ritmo };
  }
  if (tipo === 'meter') {
    for (let i = 0; i <= 9; i += 1) puntos.push({ x: c.x + pulso() / 2, y: c.y - (M.pala * e * 1.12 * i) / 9 });
    return { puntos, ms: 480 * ritmo };
  }
  return { puntos, ms: 0 };
}
