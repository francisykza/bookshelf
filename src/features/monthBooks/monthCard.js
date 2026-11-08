// Las tarjetas de «Tu mes en libros» (Fase 2): 1080 × 1920, dibujadas en un lienzo con el mismo resumen que enseña la pantalla. Nada sale del
// dispositivo salvo pedir las portadas. Si una portada no se puede usar (sin red o sin CORS), va una cubierta con el título y la imagen se genera igual.
// Cada bloque ocupa todo lo que puede: las portadas toman el sitio que dejan cifras, favorito y frase, y la tarjeta se lee en un móvil sin ampliar.
import { spineColor } from '../../domain/books';
import { cardPages } from '../../domain/monthSummary';
import { preloadCover } from '../pisoLab/coverPreload';

const W = 1080;
const H = 1920;
const P = 48;
const PIE = 104;
const PIXEL = 'PuertoPixel, ui-monospace, monospace';
const TEXTO = 'Lora, Georgia, serif';
const C = { fondo: '#efdfbd', papel: '#fbf1da', tinta: '#38271f', suave: '#6d5743', madera: '#7a4f2c', luz: '#a06f42', sombra: '#4d3019', hueco: '#5c3a22', burdeos: '#6f2a2e', laton: '#b08d3f' };
const PLANK = 24;
const GAP = 20;
const COL_GAP = 18;
const MAX_H = 860;
/** Con favorito o frase, la primera tarjeta lleva menos portadas para que se vean grandes; las demás, 12. */
const PRIMERA_CON_EXTRAS = 8;

const conTiempo = (promise, ms) => Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(null), ms))]);

function lineas(ctx, texto, ancho, maximo) {
  const palabras = String(texto).split(/\s+/).filter(Boolean);
  const out = [];
  let linea = '';
  let i = 0;
  for (; i < palabras.length; i += 1) {
    const prueba = linea ? `${linea} ${palabras[i]}` : palabras[i];
    if (ctx.measureText(prueba).width <= ancho) linea = prueba;
    else if (!linea) {
      linea = palabras[i];
      out.push(linea);
      linea = '';
    } else {
      out.push(linea);
      linea = palabras[i];
    }
    if (out.length === maximo) break;
  }
  if (linea && out.length < maximo) out.push(linea);
  if (i < palabras.length - 1 || out.some((l) => ctx.measureText(l).width > ancho)) {
    let ultima = out[out.length - 1] ?? '';
    while (ultima && ctx.measureText(`${ultima}…`).width > ancho) ultima = ultima.slice(0, -1);
    out[out.length - 1] = `${ultima.trimEnd()}…`;
  }
  return out;
}

function escribir(ctx, texto, x, y, { font, color = C.tinta, align = 'left', ancho = W, maximo = 1, alto = 40 }) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  const filas = lineas(ctx, texto, ancho, maximo);
  filas.forEach((l, i) => ctx.fillText(l, x, y + i * alto));
  return filas.length * alto;
}

/** Una cifra nunca se recorta: se reduce hasta caber. */
function cifra(ctx, valor, x, y, size, ancho, align = 'left') {
  const texto = valor.toLocaleString('es-ES');
  let s = Math.round(size);
  ctx.font = `${s}px ${PIXEL}`;
  while (s > 24 && ctx.measureText(texto).width > ancho) {
    s -= 4;
    ctx.font = `${s}px ${PIXEL}`;
  }
  ctx.fillStyle = C.tinta;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.fillText(texto, x, y + (size - s) / 2);
}

function cubierta(ctx, book, x, y, w, h) {
  ctx.fillStyle = spineColor(book);
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255, 244, 215, 0.55)';
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 10, y + 10, w - 20, h - 20);
  const size = Math.max(22, Math.round(w / 8));
  escribir(ctx, book.title, x + w / 2, y + 28, { font: `600 ${size}px ${TEXTO}`, color: '#fff4d7', align: 'center', ancho: w - 44, maximo: 6, alto: Math.round(size * 1.25) });
}

function imagenEntera(ctx, imagen, x, y, w, h) {
  const k = Math.min(w / imagen.naturalWidth, h / imagen.naturalHeight);
  const iw = imagen.naturalWidth * k;
  const ih = imagen.naturalHeight * k;
  ctx.drawImage(imagen, x + (w - iw) / 2, y + h - ih, iw, ih);
}

function portada(ctx, item, imagen, x, y, w, h) {
  if (imagen) imagenEntera(ctx, imagen, x, y, w, h);
  else cubierta(ctx, item.book, x, y, w, h);
  if (item.count > 1) {
    const t = `${item.count} lecturas`;
    ctx.font = `600 ${Math.max(24, Math.round(w / 8))}px ${TEXTO}`;
    const bw = Math.min(w, ctx.measureText(t).width + 24);
    const bh = Math.max(38, Math.round(w / 5.5));
    ctx.fillStyle = C.burdeos;
    ctx.fillRect(x, y + h - bh, bw, bh);
    ctx.fillStyle = '#fff4d7';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(t, x + 12, y + h - bh / 2);
  }
}

/** La retícula con la que cada portada sale más grande en ese alto. */
function encaje(n, alto) {
  const ancho = W - 2 * P;
  let mejor = null;
  for (let cols = 1; cols <= Math.min(n, 4); cols += 1) {
    const filas = Math.ceil(n / cols);
    const porAncho = ((ancho - (cols - 1) * COL_GAP) / cols) * 1.5;
    const porAlto = (alto - GAP - filas * (PLANK + GAP)) / filas;
    const h = Math.floor(Math.min(porAncho, porAlto, MAX_H));
    if (!mejor || h > mejor.h) mejor = { cols, filas, h, w: Math.round((h * 2) / 3) };
  }
  return { ...mejor, alto: mejor.filas * (mejor.h + PLANK + GAP) + GAP };
}

function baldas(ctx, items, imagenes, y0, e) {
  ctx.fillStyle = C.hueco;
  ctx.fillRect(P - 16, y0, W - 2 * P + 32, e.alto);
  for (let f = 0; f < e.filas; f += 1) {
    const fila = items.slice(f * e.cols, (f + 1) * e.cols);
    const y = y0 + GAP + f * (e.h + PLANK + GAP);
    const paso = e.w + Math.min(COL_GAP * 2, (W - 2 * P - e.cols * e.w) / Math.max(1, e.cols - 1 || 1));
    const ocupado = fila.length * e.w + (fila.length - 1) * (paso - e.w);
    const inicio = (W - ocupado) / 2;
    fila.forEach((item, i) => portada(ctx, item, imagenes.get(item.book.id), inicio + i * paso, y, e.w, e.h));
    ctx.fillStyle = C.madera;
    ctx.fillRect(P - 16, y + e.h, W - 2 * P + 32, PLANK);
    ctx.fillStyle = C.luz;
    ctx.fillRect(P - 16, y + e.h, W - 2 * P + 32, 5);
    ctx.fillStyle = C.sombra;
    ctx.fillRect(P - 16, y + e.h + PLANK - 5, W - 2 * P + 32, 5);
  }
}

function fondo(ctx) {
  ctx.fillStyle = C.fondo;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = C.laton;
  ctx.fillRect(28, 28, W - 56, 6);
  ctx.fillRect(28, H - 34, W - 56, 6);
}

function cabecera(ctx, etiqueta, enCurso, pie) {
  escribir(ctx, 'Tu mes en libros', P, 58, { font: `76px ${PIXEL}`, ancho: W - 2 * P });
  escribir(ctx, `${etiqueta}${enCurso ? ' · en curso' : ''}`, P, 148, { font: `600 56px ${TEXTO}`, color: C.burdeos, ancho: W - 2 * P });
  if (pie) escribir(ctx, pie, P, 222, { font: `38px ${TEXTO}`, color: C.suave, ancho: W - 2 * P });
  return pie ? 282 : 232;
}

function marca(ctx) {
  escribir(ctx, 'BookShelf', W / 2, H - 88, { font: `36px ${PIXEL}`, color: C.suave, align: 'center' });
}

/** Las cifras como composición: la de libros manda y las otras dos la acompañan. */
function cifras(ctx, s, y, alto) {
  const k = alto / 340;
  const x = P;
  const ancho = W - 2 * P;
  const izq = Math.round(ancho * 0.46);
  ctx.fillStyle = C.papel;
  ctx.fillRect(x, y, ancho, alto);
  ctx.fillStyle = C.laton;
  ctx.fillRect(x, y, ancho, 6);
  ctx.fillRect(x, y + 12, ancho, 2);
  ctx.fillRect(x, y + alto - 6, ancho, 6);
  ctx.fillRect(x, y + alto - 14, ancho, 2);
  ctx.fillRect(x + izq, y + 32, 3, alto - 64);
  cifra(ctx, s.finishedCount, x + izq / 2, y + 48 * k, 176 * k, izq - 40, 'center');
  escribir(ctx, 'Libros terminados', x + izq / 2, y + 234 * k, { font: `600 ${Math.round(42 * k)}px ${TEXTO}`, color: C.burdeos, align: 'center', ancho: izq - 30 });
  const dx = x + izq + 40;
  const dw = ancho - izq - 64;
  const filaH = (alto - 40) / 2;
  [
    [s.pages, 'Páginas registradas'],
    [s.days, 'Días de lectura'],
  ].forEach(([n, label], i) => {
    const fy = y + 22 + i * filaH;
    cifra(ctx, n, dx, fy + 8 * k, 88 * k, dw);
    escribir(ctx, label, dx, fy + 96 * k, { font: `600 ${Math.round(36 * k)}px ${TEXTO}`, color: C.suave, ancho: dw });
  });
}

function favorito(ctx, book, imagen, y, alto) {
  ctx.fillStyle = C.hueco;
  ctx.fillRect(P, y, W - 2 * P, alto);
  const h = alto - 40;
  const w = Math.round((h * 2) / 3);
  const cx = P + 28;
  if (imagen) imagenEntera(ctx, imagen, cx, y + 20, w, h);
  else cubierta(ctx, book, cx, y + 20, w, h);
  ctx.fillStyle = C.madera;
  ctx.fillRect(P, y + alto - 20, W - 2 * P, 20);
  const tx = cx + w + 36;
  const ancho = W - P - tx - 24;
  const titulo = alto >= 300 ? 60 : 54;
  escribir(ctx, 'Mi favorito del mes', tx, y + 28, { font: `600 40px ${TEXTO}`, color: C.laton, ancho });
  escribir(ctx, book.title, tx, y + 88, { font: `600 ${titulo}px ${TEXTO}`, color: '#fff4d7', ancho, maximo: alto >= 300 ? 3 : 2, alto: Math.round(titulo * 1.22) });
}

const FRASE = { size: 46, linea: 62, ancho: W - 2 * P - 56, maximo: 4 };
const altoFrase = (ctx, texto) => {
  ctx.font = `italic ${FRASE.size}px ${TEXTO}`;
  return lineas(ctx, `«${texto}»`, FRASE.ancho, FRASE.maximo).length * FRASE.linea + 48;
};
function frase(ctx, texto, y) {
  const h = altoFrase(ctx, texto);
  ctx.fillStyle = C.papel;
  ctx.fillRect(P, y, W - 2 * P, h);
  escribir(ctx, `«${texto}»`, W / 2, y + 24, { font: `italic ${FRASE.size}px ${TEXTO}`, align: 'center', ancho: FRASE.ancho, maximo: FRASE.maximo, alto: FRASE.linea });
  return h;
}

async function fuentes() {
  try {
    await Promise.all([document.fonts.load(`76px ${PIXEL}`), document.fonts.load(`600 56px ${TEXTO}`), document.fonts.load(`italic 46px ${TEXTO}`)]);
  } catch {
    // Con la tipografía de respaldo la tarjeta sale igual
  }
}

/** Devuelve un lienzo por tarjeta. `sinPortada`: cuántas portadas se han sustituido por una cubierta con el título. */
export async function dibujarMes({ summary, etiqueta, conFavorito = true, conFrase = true }) {
  await fuentes();
  const libros = summary.finished.map((f) => f.book);
  const pedidas = await Promise.all(libros.map((b) => (b.cover ? conTiempo(preloadCover(b.cover), 8000) : Promise.resolve(null))));
  const imagenes = new Map(libros.map((b, i) => [b.id, pedidas[i]]));
  const sinPortada = pedidas.filter((img, i) => libros[i].cover && !img).length;
  const fav = conFavorito ? summary.favorite : null;
  const texto = conFrase ? summary.quote.trim() : '';
  const enPrimera = fav || texto ? PRIMERA_CON_EXTRAS : 12;
  const paginas = [summary.finished.slice(0, enPrimera), ...(summary.finished.length > enPrimera ? cardPages(summary.finished.slice(enPrimera)) : [])];
  const lienzos = paginas.map((items, k) => {
    const lienzo = document.createElement('canvas');
    lienzo.width = W;
    lienzo.height = H;
    const ctx = lienzo.getContext('2d');
    fondo(ctx);
    const pie = paginas.length > 1 ? `Página ${k + 1} de ${paginas.length} · ${libros.length} libros` : '';
    const y0 = cabecera(ctx, etiqueta, summary.current, pie);
    marca(ctx);
    if (k > 0) {
      const sitio = H - PIE - y0;
      const e = encaje(items.length, sitio);
      baldas(ctx, items, imagenes, y0 + (sitio - e.alto) / 2, e);
      return lienzo;
    }
    const vacio = items.length === 0;
    const plan = (compacto) => {
      const altoCifras = compacto ? 290 : 340;
      const altoFav = compacto ? 270 : 330;
      const otros = [altoCifras + (summary.unknown ? 56 : 0), fav ? altoFav : 0, texto ? altoFrase(ctx, texto) : 0].filter(Boolean);
      const sitio = H - PIE - y0 - otros.reduce((a, b) => a + b, 0);
      return { altoCifras, altoFav, otros, sitio, e: vacio ? null : encaje(items.length, sitio - 14 * (otros.length + 1)) };
    };
    let p = plan(false);
    if (p.e && p.e.h < 300 && (fav || texto)) p = plan(true);
    const central = vacio ? Math.min(460, p.sitio * 0.6) : p.e.alto;
    const salto = Math.max(12, (p.sitio - central) / (p.otros.length + 1));
    let y = y0 + salto / 2;
    if (vacio) {
      ctx.fillStyle = C.papel;
      ctx.fillRect(P, y, W - 2 * P, central);
      escribir(ctx, summary.hasActivity ? 'Este mes has seguido avanzando' : 'Un mes tranquilo', W / 2, y + central / 2 - 84, { font: `600 72px ${TEXTO}`, color: C.burdeos, align: 'center', ancho: W - 2 * P - 80, maximo: 2, alto: 88 });
    } else baldas(ctx, items, imagenes, y, p.e);
    y += central + salto;
    cifras(ctx, summary, y, p.altoCifras);
    y += p.altoCifras;
    if (summary.unknown) {
      escribir(ctx, 'Solo incluye los avances convertibles a páginas', W / 2, y + 12, { font: `32px ${TEXTO}`, color: C.suave, align: 'center', ancho: W - 2 * P });
      y += 56;
    }
    y += salto;
    if (fav) {
      favorito(ctx, fav, imagenes.get(fav.id), y, p.altoFav);
      y += p.altoFav + salto;
    }
    if (texto) frase(ctx, texto, y);
    return lienzo;
  });
  return { lienzos, sinPortada };
}
