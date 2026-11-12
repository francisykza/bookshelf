// 1.124 · Los carteles de la fachada (maqueta de Francisco del 12-11-2026): placas de madera, esmalte y latón para las
// viviendas, el rótulo colgante del café-librería y la placa azul del Gran Hotel. El marco se dibuja con CSS (placas.css)
// y los iconos son SVG de 16 × 16 en cuadrícula de píxel; el texto va siempre aparte, como texto real, para admitir
// nombres, estados y traducciones. Los usan la calle 3D (calleView.js) y la fachada 2D (facadeView.js).

import './placas.css';

const SVG = 'http://www.w3.org/2000/svg';

/** Un icono de píxel: rectángulos [x, y, ancho, alto] sobre una cuadrícula de 16 × 16, con bordes nítidos. */
function icono(nombre, rects) {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('class', `ed-placa__icono ed-placa__icono--${nombre}`);
  for (const [x, y, w, h, tono] of rects) {
    const r = document.createElementNS(SVG, 'rect');
    r.setAttribute('x', String(x));
    r.setAttribute('y', String(y));
    r.setAttribute('width', String(w));
    r.setAttribute('height', String(h));
    if (tono) r.setAttribute('class', tono);
    svg.append(r);
  }
  return svg;
}

// La llave: anilla hueca a la izquierda, caña y dos dientes; un brillo en la anilla
const LLAVE = [
  [2, 4, 4, 1],
  [1, 5, 1, 5],
  [6, 5, 1, 5],
  [2, 10, 4, 1],
  [2, 5, 1, 1, 'luz'],
  [7, 7, 8, 2],
  [7, 7, 8, 1, 'luz'],
  [11, 9, 1, 3],
  [13, 9, 2, 2],
];
// La campanilla de recepción: botón, cúpula, filo y base
const CAMPANA = [
  [7, 2, 2, 1],
  [7, 3, 2, 1, 'luz'],
  [5, 5, 6, 1],
  [4, 6, 8, 4],
  [5, 6, 2, 2, 'luz'],
  [3, 10, 10, 1],
  [2, 12, 12, 2],
];
// La flecha hacia la izquierda
const FLECHA = [
  [5, 3, 1, 10],
  [4, 4, 1, 8],
  [3, 5, 1, 6],
  [2, 6, 1, 4],
  [1, 7, 1, 2],
  [6, 6, 9, 4],
];

const span = (clase, texto) => {
  const el = document.createElement('span');
  el.className = clase;
  if (texto != null) el.textContent = texto;
  return el;
};

/**
 * La placa de una vivienda: el número en su compartimento de nogal y, a la derecha, el estado o el nombre.
 * `tipo`: 'libre' (esmalte marfil), 'propia' (esmalte verde y la llave) o 'ajena' (el nombre real del vecino).
 * Los nombres largos se cortan con puntos suspensivos; el nombre entero va en la etiqueta accesible del botón.
 */
export function placaVivienda(numero, texto, tipo) {
  const placa = span(`ed-window__plate ed-placa ed-placa--${tipo}`);
  const num = span('ed-placa__num', numero);
  const txt = span('ed-placa__txt', texto);
  placa.append(num, txt);
  if (tipo === 'propia') placa.append(icono('llave', LLAVE));
  return placa;
}

/** El rótulo colgante del café-librería y, debajo, el aviso de papel (solo si lo hay, p. ej. «Se traspasa»). */
export function rotuloCafe(nombre, aviso = '') {
  const cartel = span('ed-window__plate ed-cartel');
  const tabla = span('ed-cartel__tabla');
  tabla.append(span('ed-cartel__txt', nombre));
  cartel.append(tabla);
  if (aviso) cartel.append(span('ed-cartel__aviso', aviso));
  return cartel;
}

/**
 * El cartel del bajo según lo que diga el portal (`shopBadge`): en traspaso, «Café-librería» con el aviso «Se traspasa»
 * debajo; inaugurado, el rótulo con el nombre del café, sin aviso; sin nada, «Café-librería».
 */
export function cartelDelBajo(estado = '') {
  if (!estado) return rotuloCafe('Café-librería');
  if (estado === 'Se traspasa') return rotuloCafe('Café-librería', estado);
  return rotuloCafe(estado);
}

/** La placa direccional del Gran Hotel: esmalte azul noche, flecha a la izquierda y campanilla. */
export function placaHotel(texto = 'Al Gran Hotel') {
  const placa = span('ed-window__plate ed-placa ed-placa--hotel');
  placa.append(icono('flecha', FLECHA), icono('campana', CAMPANA), span('ed-placa__txt', texto));
  return placa;
}
