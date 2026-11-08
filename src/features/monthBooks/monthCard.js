// Las tarjetas de «Tu mes en libros»: 1080 × 1920, dibujadas en un lienzo con la misma instantánea que enseña la pantalla, sin capturar nada del
// DOM y con las mismas piezas que el resumen (peanas, balda, estrella y rama). La primera lleva el podio, las cifras, hasta 6 libros más y el
// recuerdo; las siguientes, hasta 9 libros y su numeración. Pedir las imágenes va aparte, con un límite por cada una: ninguna bloquea la tarjeta.
import { spineColor } from '../../domain/books';
import { cardPlan } from '../../domain/monthSummary';

const W = 1080;
const H = 1920;
const P = 48;
const PIE = 96;
const TEXTO = 'Georgia, Lora, serif';
const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const C = { fondo: '#f8edd4', papel: '#fbf1da', tinta: '#38291e', suave: '#6b5844', linea: '#ad8d60', marco: '#9a7c4b', madera: '#8c5a34', luz: '#dbb375', sombra: '#4b3021', burdeos: '#6f2a2e', marfil: '#fff4d7', numeral: '#ffdf9d', numeralSombra: '#4f2d21' };
const PLANK = 24;
const GAP = 18;
const COL_GAP = 16;
const MAX_H = 760;
const CONCURRENCIA = 6;

/** Las portadas que han fallado hace poco no se vuelven a esperar al reabrir o cambiar una casilla; Reintentar borra la lista. */
const fallidas = new Map();
const RECUERDO_FALLO = 60_000;
export const olvidarFallidas = () => fallidas.clear();

function cargarUna(url, ms, signal) {
  return new Promise((resolve) => {
    const visto = fallidas.get(url);
    if (visto && Date.now() - visto < RECUERDO_FALLO) return resolve(null);
    const image = new Image();
    let hecho = false;
    const fin = (valor) => {
      if (hecho) return;
      hecho = true;
      clearTimeout(reloj);
      signal?.removeEventListener('abort', cancelar);
      if (!valor) {
        if (!signal?.aborted) fallidas.set(url, Date.now());
        image.src = '';
      }
      resolve(valor);
    };
    const cancelar = () => fin(null);
    const reloj = setTimeout(() => fin(null), ms);
    signal?.addEventListener('abort', cancelar);
    image.crossOrigin = 'anonymous';
    image.referrerPolicy = 'no-referrer';
    image.onload = () => {
      if (image.naturalWidth < 10) return fin(null);
      if (image.decode) return image.decode().then(() => fin(image), () => fin(image));
      return fin(image);
    };
    image.onerror = () => fin(null);
    image.src = url;
    return undefined;
  });
}

/** Rellena `memo` (id del libro → imagen o null) según llegan. Cada carga tiene su tope. */
export async function cargarPortadas(libros, memo, { ms = 6000, signal } = {}) {
  const cola = libros.filter((b) => b.cover && !memo.get(b.id));
  const trabajar = async () => {
    while (cola.length && !signal?.aborted) {
      const libro = cola.shift();
      memo.set(libro.id, await cargarUna(libro.cover, ms, signal));
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCIA }, trabajar));
  return memo;
}

const PIEZAS = ['podium-first', 'podium-second', 'podium-third', 'shelf', 'star', 'laurel', 'rama', 'rama-oro', 'destello', 'libros', 'book', 'calendario', 'bookmark'];
let piezasListas = null;
/** Las piezas de madera de la pantalla, las mismas en la tarjeta. Si alguna falla, se dibuja una versión sencilla en su lugar. */
export async function cargarPiezas(ms = 3000) {
  if (piezasListas) return piezasListas;
  const pares = await Promise.all(PIEZAS.map(async (id) => [id, await cargarUna(`/assets/puerto/acabado/${id}.svg`, ms)]));
  const mapa = new Map(pares);
  if (pares.every(([, img]) => img)) piezasListas = mapa;
  return mapa;
}

/** Espera a la letra de respaldo, sin depender de ella: con el tope agotado, la tarjeta sale con la del sistema. */
export function esperarFuentes(ms = 2500) {
  const pedir = Promise.all([document.fonts.load('700 56px Lora'), document.fonts.load('italic 46px Lora')]).catch(() => null);
  return Promise.race([pedir, new Promise((resolve) => setTimeout(resolve, ms))]);
}

/** Las líneas de un texto, a la mayor letra que lo deja entero; solo con el mínimo agotado se corta. */
function lineas(ctx, texto, ancho, maximo) {
  const out = [];
  let linea = '';
  for (const palabra of String(texto).split(/\s+/).filter(Boolean)) {
    const prueba = linea ? `${linea} ${palabra}` : palabra;
    if (ctx.measureText(prueba).width <= ancho) linea = prueba;
    else {
      if (linea) out.push(linea);
      linea = palabra;
    }
  }
  if (linea) out.push(linea);
  if (out.length <= maximo && !out.some((l) => ctx.measureText(l).width > ancho)) return { filas: out, cabe: true };
  const filas = out.slice(0, maximo);
  let ultima = filas[filas.length - 1] ?? '';
  while (ultima && ctx.measureText(`${ultima}…`).width > ancho) ultima = ultima.slice(0, -1);
  filas[filas.length - 1] = `${ultima.trimEnd()}…`;
  return { filas, cabe: false };
}

function ajustar(ctx, texto, ancho, maximo, font, grande, minimo) {
  let size = grande;
  let r;
  for (;;) {
    ctx.font = font(size);
    r = lineas(ctx, texto, ancho, maximo);
    if (r.cabe || size <= minimo) break;
    size -= 2;
  }
  return { size, filas: r.filas };
}

function pintar(ctx, filas, x, y, alto, { color = C.tinta, align = 'left' } = {}) {
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  filas.forEach((l, i) => ctx.fillText(l, x, y + i * alto));
  return filas.length * alto;
}

function escribir(ctx, texto, x, y, { font, color, align, ancho = W }) {
  ctx.font = font;
  return pintar(ctx, lineas(ctx, texto, ancho, 1).filas, x, y, 0, { color, align });
}

function cubierta(ctx, book, x, y, w, h) {
  ctx.fillStyle = spineColor(book);
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255, 244, 215, 0.55)';
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 8, y + 8, w - 16, h - 16);
  const interior = w - 36;
  const fuente = (s) => `600 ${s}px ${TEXTO}`;
  const titulo = ajustar(ctx, book.title, interior, Math.max(4, Math.floor((h * 0.68) / 30)), fuente, Math.max(26, Math.round(w / 7)), 16);
  ctx.font = fuente(titulo.size);
  pintar(ctx, titulo.filas, x + w / 2, y + 22, Math.round(titulo.size * 1.22), { color: C.marfil, align: 'center' });
  if (book.author) {
    const fa = (s) => `italic ${s}px ${TEXTO}`;
    const autor = ajustar(ctx, book.author, interior, 2, fa, Math.max(18, Math.round(w / 11)), 14);
    ctx.font = fa(autor.size);
    const alto = Math.round(autor.size * 1.2);
    pintar(ctx, autor.filas, x + w / 2, y + h - 20 - autor.filas.length * alto, alto, { color: C.marfil, align: 'center' });
  }
}

function imagenEntera(ctx, imagen, x, y, w, h) {
  const k = Math.min(w / imagen.naturalWidth, h / imagen.naturalHeight);
  const iw = imagen.naturalWidth * k;
  const ih = imagen.naturalHeight * k;
  ctx.save();
  ctx.shadowColor = 'rgba(33, 20, 9, 0.34)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 4;
  ctx.shadowOffsetY = 5;
  ctx.drawImage(imagen, x + (w - iw) / 2, y + h - ih, iw, ih);
  ctx.restore();
}

function portada(ctx, item, imagen, x, y, w, h) {
  if (imagen) imagenEntera(ctx, imagen, x, y, w, h);
  else cubierta(ctx, item.book, x, y, w, h);
  if (item.count > 1) {
    const t = `${item.count} lecturas`;
    ctx.font = `600 ${Math.max(22, Math.round(w / 8))}px ${SANS}`;
    const bw = Math.min(w, ctx.measureText(t).width + 20);
    const bh = Math.max(34, Math.round(w / 5.5));
    ctx.fillStyle = C.burdeos;
    ctx.fillRect(x, y + h - bh, bw, bh);
    ctx.fillStyle = C.marfil;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(t, x + 10, y + h - bh / 2);
  }
}

/** La retícula con la que cada portada sale más grande en ese alto. */
function encaje(n, alto) {
  const ancho = W - 2 * P;
  let mejor = null;
  for (let cols = 1; cols <= Math.min(n, 6); cols += 1) {
    const filas = Math.ceil(n / cols);
    const porAncho = ((ancho - (cols - 1) * COL_GAP) / cols) * 1.5;
    const porAlto = (alto - GAP - filas * (PLANK + GAP)) / filas;
    const h = Math.floor(Math.min(porAncho, porAlto, MAX_H));
    if (!mejor || h > mejor.h) mejor = { cols, filas, h, w: Math.round((h * 2) / 3) };
  }
  return { ...mejor, alto: mejor.filas * (mejor.h + PLANK + GAP) + GAP };
}

function espejada(ctx, img, x, y, w, h) {
  if (!img) return;
  ctx.save();
  ctx.translate(x + w, y);
  ctx.scale(-1, 1);
  ctx.drawImage(img, 0, 0, w, h);
  ctx.restore();
}

/** Un título con una rama a cada lado. */
function ramas(ctx, piezas, texto, y, alto) {
  const pieza = piezas.get('rama');
  if (!pieza) return;
  const m = ctx.measureText(texto).width / 2;
  const w = 68;
  const h = 40;
  espejada(ctx, pieza, W / 2 - m - w - 16, y + (alto - h) / 2, w, h);
  ctx.drawImage(pieza, W / 2 + m + 16, y + (alto - h) / 2, w, h);
}

function tabla(ctx, piezas, x, y, w, h) {
  const pieza = piezas.get('shelf');
  if (pieza) return ctx.drawImage(pieza, x, y, w, h);
  ctx.fillStyle = C.madera;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = C.luz;
  ctx.fillRect(x, y, w, 4);
  ctx.fillStyle = C.sombra;
  ctx.fillRect(x, y + h - 4, w, 4);
  return undefined;
}

function baldas(ctx, items, imagenes, piezas, y0, e) {
  for (let f = 0; f < e.filas; f += 1) {
    const fila = items.slice(f * e.cols, (f + 1) * e.cols);
    const y = y0 + GAP + f * (e.h + PLANK + GAP);
    const paso = e.w + COL_GAP;
    const ocupado = fila.length * e.w + (fila.length - 1) * (paso - e.w);
    const inicio = (W - ocupado) / 2;
    fila.forEach((item, i) => portada(ctx, item, imagenes.get(item.book.id), inicio + i * paso, y, e.w, e.h));
    tabla(ctx, piezas, P - 16, y + e.h, W - 2 * P + 32, PLANK);
  }
}

/** Ranking personal: 2–1–3, o los que haya, centrados y sin peanas vacías. Las proporciones son las de cada SVG. */
const PEANA = { first: 100 / 112, second: 76 / 112, third: 60 / 112 };
/** Centro vertical del panel frontal de cada dibujo, y tamaño del número según el alto de ese panel. */
const PANEL = { first: 53 / 100, second: 41 / 76, third: 33 / 60 };
const NUMERO = { first: 0.2, second: 0.2, third: 0.13 };
const ALTO_TAPA = { first: 1.05, second: 0.96, third: 0.96 };
const ESCENAS = {
  1: [{ puesto: 0, tipo: 'first' }],
  2: [
    { puesto: 1, tipo: 'second' },
    { puesto: 0, tipo: 'first' },
  ],
  3: [
    { puesto: 1, tipo: 'second' },
    { puesto: 0, tipo: 'first' },
    { puesto: 2, tipo: 'third' },
  ],
};
const BASE = 10;
/** Alto del conjunto: estrella + portada del primero + su peana + la base común. */
const altoPodio = (ancho) => ancho * (0.2 + ALTO_TAPA.first + PEANA.first) + BASE;

function podio(ctx, entradas, imagenes, piezas, y0, ancho) {
  const escena = ESCENAS[entradas.length];
  const total = escena.length * ancho;
  const inicio = (W - total) / 2;
  const base = y0 + altoPodio(ancho) - BASE;
  escena.forEach((p, i) => {
    const x = inicio + i * ancho;
    const alto = ancho * PEANA[p.tipo];
    const arriba = base - alto;
    const tapaH = ancho * ALTO_TAPA[p.tipo];
    const tapaW = (tapaH * 2) / 3;
    const item = entradas[p.puesto];
    const pieza = piezas.get(`podium-${p.tipo}`);
    if (pieza) ctx.drawImage(pieza, x, arriba, ancho, alto);
    else {
      ctx.fillStyle = C.madera;
      ctx.fillRect(x, arriba, ancho, alto);
      ctx.fillStyle = C.luz;
      ctx.fillRect(x, arriba, ancho, 7);
    }
    // La portada, delante: su base pisa la cara superior de la peana
    const apoyo = (ancho * 6) / 112;
    portada(ctx, item, imagenes.get(item.book.id), x + (ancho - tapaW) / 2, arriba + apoyo - tapaH, tapaW, tapaH);
    const numero = String(p.puesto + 1);
    ctx.font = `700 ${Math.round(ancho * NUMERO[p.tipo])}px Lora, Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const caja = ctx.measureText(numero);
    const linea = arriba + alto * PANEL[p.tipo] + (caja.actualBoundingBoxAscent - caja.actualBoundingBoxDescent) / 2;
    ctx.fillStyle = C.numeralSombra;
    ctx.fillText(numero, x + ancho / 2 + 2, linea + 3);
    ctx.fillStyle = C.numeral;
    ctx.fillText(numero, x + ancho / 2, linea);
    const oro = piezas.get('rama-oro');
    if (oro) {
      const fs2 = Math.round(ancho * NUMERO[p.tipo]);
      const hw = caja.width / 2 + fs2 * 0.1;
      const oy = arriba + alto * PANEL[p.tipo] - fs2 * 0.55;
      ctx.drawImage(oro, x + ancho / 2 - hw - fs2 * 0.6, oy, fs2 * 0.6, fs2 * 1.1);
      espejada(ctx, oro, x + ancho / 2 + hw, oy, fs2 * 0.6, fs2 * 1.1);
    }
    if (p.puesto === 0 && piezas.get('star')) {
      const e = Math.round(ancho * 0.16);
      const dw = e * 3;
      if (piezas.get('destello')) ctx.drawImage(piezas.get('destello'), x + (ancho - dw) / 2, arriba + apoyo - tapaH - e - 8 + (e - dw * 0.32) / 2, dw, dw * 0.32);
      ctx.drawImage(piezas.get('star'), x + (ancho - e) / 2, arriba + apoyo - tapaH - e - 8, e, e);
    }
  });
  ctx.fillStyle = C.madera;
  ctx.fillRect(inicio - 12, base, total + 24, BASE);
  ctx.fillStyle = C.luz;
  ctx.fillRect(inicio - 12, base, total + 24, 3);
  ctx.fillStyle = C.sombra;
  ctx.fillRect(inicio - 12, base + BASE - 3, total + 24, 3);
}

function fondo(ctx) {
  ctx.fillStyle = C.fondo;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = C.marco;
  ctx.lineWidth = 5;
  ctx.strokeRect(18, 18, W - 36, H - 36);
  ctx.lineWidth = 2;
  ctx.strokeRect(28, 28, W - 56, H - 56);
}

function adorno(ctx, piezas, y) {
  const w = 56;
  const h = 25;
  ctx.fillStyle = C.linea;
  ctx.fillRect(P + 40, y + h / 2, W / 2 - w / 2 - P - 56, 2);
  ctx.fillRect(W / 2 + w / 2 + 16, y + h / 2, W / 2 - w / 2 - P - 56, 2);
  const pieza = piezas.get('laurel');
  if (pieza) ctx.drawImage(pieza, (W - w) / 2, y, w, h);
}

function cabecera(ctx, piezas, etiqueta, enCurso, n, total) {
  if ('letterSpacing' in ctx) ctx.letterSpacing = '3px';
  escribir(ctx, 'TU MES EN LIBROS', W / 2, 54, { font: `700 36px ${TEXTO}`, align: 'center', ancho: W - 2 * P - 200 });
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  escribir(ctx, `${etiqueta}${enCurso ? ' · en curso' : ''}`, W / 2, 102, { font: `700 48px ${TEXTO}`, align: 'center', ancho: W - 2 * P - 200 });
  if (total > 1) escribir(ctx, `${n}/${total}`, W - P, 62, { font: `700 34px ${SANS}`, color: C.suave, align: 'right', ancho: 130 });
  adorno(ctx, piezas, 166);
  return 204;
}

function marca(ctx) {
  escribir(ctx, 'BookShelf', W / 2, H - 80, { font: `700 28px ${TEXTO}`, color: C.suave, align: 'center' });
}

/** Tres cifras iguales: acompañan al podio, no compiten con él. */
const ALTO_CIFRAS = 142;
function cifras(ctx, s, y, piezas) {
  const ancho = W - 2 * P;
  const col = ancho / 3;
  ctx.fillStyle = C.linea;
  ctx.fillRect(P, y, ancho, 2);
  ctx.fillRect(P, y + ALTO_CIFRAS - 2, ancho, 2);
  ctx.fillRect(P + col, y + 18, 2, ALTO_CIFRAS - 36);
  ctx.fillRect(P + 2 * col, y + 18, 2, ALTO_CIFRAS - 36);
  [
    [s.finishedCount, 'libros', 'libros'],
    [s.pages, 'páginas', 'book'],
    [s.days, 'días leyendo', 'calendario'],
  ].forEach(([valor, label, icono], i) => {
    const cx = P + col * i + col / 2;
    const texto = valor.toLocaleString('es-ES');
    let t = 58;
    ctx.font = `700 ${t}px ${TEXTO}`;
    while (t > 28 && ctx.measureText(texto).width > col - 30) {
      t -= 4;
      ctx.font = `700 ${t}px ${TEXTO}`;
    }
    ctx.fillStyle = C.tinta;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const icon = piezas.get(icono);
    const ancho2 = ctx.measureText(texto).width;
    ctx.fillText(texto, cx + (icon ? 27 : 0), y + 56);
    if (icon) ctx.drawImage(icon, cx - ancho2 / 2 - 27, y + 37, 44, 38);
    escribir(ctx, label, cx, y + 94, { font: `500 27px ${SANS}`, color: C.suave, align: 'center', ancho: col - 18 });
  });
}

const FRASE = { ancho: W - 2 * P - 56, maximo: 5, fuente: (s) => `italic ${s}px ${TEXTO}` };
const medirFrase = (ctx, texto) => {
  const r = ajustar(ctx, texto, FRASE.ancho, FRASE.maximo, FRASE.fuente, 36, 26);
  const linea = Math.round(r.size * 1.36);
  return { ...r, linea, alto: r.filas.length * linea + 36 };
};
function frase(ctx, medida, y) {
  ctx.fillStyle = C.linea;
  ctx.fillRect(P, y, W - 2 * P, 2);
  ctx.fillRect(P, y + medida.alto - 2, W - 2 * P, 2);
  ctx.font = FRASE.fuente(medida.size);
  pintar(ctx, medida.filas, W / 2, y + 18, medida.linea, { align: 'center' });
}

const SUBTITULO = { 1: 'Una historia que se queda conmigo', 2: 'Dos historias que se quedan conmigo', 3: 'Tres historias que se quedan conmigo' };
const ALTO_TITULO = 118;
const ALTO_RESTO = 66;

/** Devuelve un lienzo por tarjeta, con lo que haya en `imagenes` (id → imagen o null) y `piezas`. */
export function dibujarMes({ summary, etiqueta, imagenes, piezas = new Map(), conFavoritos = true, conFrase = true }) {
  const enPodio = conFavoritos ? summary.podium : [];
  const resto = conFavoritos ? summary.rest : summary.finished;
  const texto = conFrase ? summary.quote.trim() : '';
  const paginas = cardPlan(resto, enPodio.length > 0);
  return paginas.map((items, k) => {
    const lienzo = document.createElement('canvas');
    lienzo.width = W;
    lienzo.height = H;
    const ctx = lienzo.getContext('2d');
    fondo(ctx);
    const y0 = cabecera(ctx, piezas, etiqueta, summary.current, k + 1, paginas.length);
    marca(ctx);
    if (k > 0) {
      const sitio = H - PIE - y0;
      const e = encaje(items.length, sitio);
      baldas(ctx, items, imagenes, piezas, y0 + (sitio - e.alto) / 2, e);
      return lienzo;
    }
    const sinLibros = summary.finished.length === 0;
    const medida = texto ? medirFrase(ctx, texto) : null;
    const hayPodio = enPodio.length > 0;
    const nota = summary.unknown ? 52 : 0;
    const fijos = (hayPodio ? ALTO_TITULO : 0) + ALTO_CIFRAS + nota + (items.length ? ALTO_RESTO : 0) + (medida?.alto ?? 0);
    const sitio = H - PIE - y0 - fijos;
    const bloques = (hayPodio ? 1 : 0) + (items.length ? 1 : 0) + (sinLibros ? 1 : 0) + 1 + (medida ? 1 : 0);
    const margen = 16 * (bloques + 1);
    let ancho = 0;
    let e = null;
    if (hayPodio) {
      const reservaResto = items.length ? Math.min(400, (sitio - margen) * 0.38) : 0;
      ancho = Math.min(enPodio.length === 1 ? 400 : 330, (sitio - margen - reservaResto - BASE) / (altoPodio(1) - BASE));
      if (items.length) e = encaje(items.length, sitio - margen - altoPodio(ancho));
    } else if (items.length) e = encaje(items.length, sitio - margen);
    const central = (hayPodio ? altoPodio(ancho) : 0) + (e?.alto ?? (sinLibros ? Math.min(460, sitio * 0.6) : 0));
    const salto = Math.max(12, (sitio - central) / (bloques + 1));
    let y = y0 + salto * 0.5;
    if (hayPodio) {
      escribir(ctx, 'Mis favoritos del mes', W / 2, y, { font: `700 56px ${TEXTO}`, align: 'center', ancho: W - 2 * P });
      ramas(ctx, piezas, 'Mis favoritos del mes', y, 56);
      escribir(ctx, SUBTITULO[enPodio.length], W / 2, y + 68, { font: `italic 32px ${TEXTO}`, color: C.suave, align: 'center', ancho: W - 2 * P });
      y += ALTO_TITULO;
      podio(ctx, enPodio, imagenes, piezas, y, ancho);
      y += altoPodio(ancho) + salto;
    }
    if (sinLibros) {
      const alto = central;
      ctx.fillStyle = C.papel;
      ctx.fillRect(P, y, W - 2 * P, alto);
      const fuente = (s) => `600 ${s}px ${TEXTO}`;
      const r = ajustar(ctx, summary.hasActivity ? 'Este mes has seguido avanzando' : 'Un mes tranquilo', W - 2 * P - 80, 3, fuente, 72, 40);
      ctx.font = fuente(r.size);
      const linea = Math.round(r.size * 1.22);
      pintar(ctx, r.filas, W / 2, y + (alto - r.filas.length * linea) / 2, linea, { color: C.burdeos, align: 'center' });
      y += alto + salto;
    }
    cifras(ctx, summary, y, piezas);
    y += ALTO_CIFRAS;
    if (summary.unknown) {
      escribir(ctx, 'Solo incluye los avances convertibles a páginas', W / 2, y + 10, { font: `28px ${SANS}`, color: C.suave, align: 'center', ancho: W - 2 * P });
      y += nota;
    }
    y += salto;
    if (e) {
      escribir(ctx, hayPodio ? 'También me acompañaron' : 'Libros terminados', W / 2, y, { font: `700 40px ${TEXTO}`, align: 'center', ancho: W - 2 * P });
      ramas(ctx, piezas, hayPodio ? 'También me acompañaron' : 'Libros terminados', y, 40);
      y += ALTO_RESTO;
      baldas(ctx, items, imagenes, piezas, y, e);
      y += e.alto + salto;
    }
    if (medida) {
      frase(ctx, medida, y);
      if (piezas.get('bookmark')) {
        ctx.font = FRASE.fuente(medida.size);
        const mitad = Math.max(...medida.filas.map((l) => ctx.measureText(l).width)) / 2;
        ctx.drawImage(piezas.get('bookmark'), Math.max(P + 10, W / 2 - mitad - 44), y + (medida.alto - 52) / 2, 28, 52);
      }
    }
    return lienzo;
  });
}
