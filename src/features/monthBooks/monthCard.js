// Las tarjetas de «Tu mes en libros» (Fase 2): 1080 × 1920, dibujadas en un lienzo con el mismo resumen que enseña la pantalla. Nada sale del
// dispositivo salvo pedir las portadas. Si una portada no se puede usar (sin red o sin CORS), va una cubierta con el título y la imagen se genera igual.
import { spineColor } from '../../domain/books';
import { cardPages } from '../../domain/monthSummary';
import { preloadCover } from '../pisoLab/coverPreload';

const W = 1080;
const H = 1920;
const P = 64;
const PIXEL = 'PuertoPixel, ui-monospace, monospace';
const TEXTO = 'Lora, Georgia, serif';
const C = { fondo: '#efdfbd', papel: '#fbf1da', tinta: '#38271f', suave: '#6d5743', madera: '#7a4f2c', luz: '#a06f42', sombra: '#4d3019', hueco: '#5c3a22', burdeos: '#6f2a2e', laton: '#b08d3f' };
const PLANK = 24;
const GAP = 34;

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

function cubierta(ctx, book, x, y, w, h) {
  ctx.fillStyle = spineColor(book);
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255, 244, 215, 0.55)';
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 10, y + 10, w - 20, h - 20);
  const size = Math.max(22, Math.round(w / 8));
  escribir(ctx, book.title, x + w / 2, y + 28, { font: `600 ${size}px ${TEXTO}`, color: '#fff4d7', align: 'center', ancho: w - 44, maximo: 6, alto: Math.round(size * 1.25) });
}

function portada(ctx, item, imagen, x, y, w, h) {
  if (imagen) {
    // Entera y apoyada en la balda: sin recortar
    const k = Math.min(w / imagen.naturalWidth, h / imagen.naturalHeight);
    const iw = imagen.naturalWidth * k;
    const ih = imagen.naturalHeight * k;
    ctx.drawImage(imagen, x + (w - iw) / 2, y + h - ih, iw, ih);
  } else cubierta(ctx, item.book, x, y, w, h);
  if (item.count > 1) {
    const t = `${item.count} lecturas`;
    ctx.font = `600 ${Math.max(20, Math.round(w / 9))}px ${TEXTO}`;
    const bw = Math.min(w, ctx.measureText(t).width + 20);
    const bh = Math.max(32, Math.round(w / 6));
    ctx.fillStyle = C.burdeos;
    ctx.fillRect(x, y + h - bh, bw, bh);
    ctx.fillStyle = '#fff4d7';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(t, x + 10, y + h - bh / 2);
  }
}

// `tope`: altura máxima de portada para que favorito y frase quepan sin pisar la marca
function medidas(n, tope = Infinity) {
  const cols = n <= 6 ? 3 : 4;
  const h = Math.min(n <= 3 ? 435 : n <= 6 ? 405 : 285, Math.floor(tope));
  return { cols, h, w: Math.round((h * 2) / 3) };
}
const altoBaldas = (n, tope) => {
  const { cols, h } = medidas(n, tope);
  return Math.ceil(n / cols) * (h + PLANK + GAP) + GAP;
};

function baldas(ctx, items, imagenes, y0, tope) {
  const { cols, w, h } = medidas(items.length, tope);
  const filas = Math.ceil(items.length / cols);
  ctx.fillStyle = C.hueco;
  ctx.fillRect(P - 16, y0, W - 2 * P + 32, altoBaldas(items.length, tope));
  for (let f = 0; f < filas; f += 1) {
    const fila = items.slice(f * cols, (f + 1) * cols);
    const y = y0 + GAP + f * (h + PLANK + GAP);
    const hueco = (W - 2 * P - cols * w) / (cols + 1);
    const inicio = P + (W - 2 * P - (fila.length * w + (fila.length - 1) * hueco)) / 2;
    fila.forEach((item, i) => portada(ctx, item, imagenes.get(item.book.id), inicio + i * (w + hueco), y, w, h));
    ctx.fillStyle = C.madera;
    ctx.fillRect(P - 16, y + h, W - 2 * P + 32, PLANK);
    ctx.fillStyle = C.luz;
    ctx.fillRect(P - 16, y + h, W - 2 * P + 32, 5);
    ctx.fillStyle = C.sombra;
    ctx.fillRect(P - 16, y + h + PLANK - 5, W - 2 * P + 32, 5);
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
  escribir(ctx, 'Tu mes en libros', P, 66, { font: `62px ${PIXEL}`, ancho: W - 2 * P });
  escribir(ctx, `${etiqueta}${enCurso ? ' · en curso' : ''}`, P, 146, { font: `600 44px ${TEXTO}`, color: C.burdeos, ancho: W - 2 * P });
  if (pie) escribir(ctx, pie, P, 208, { font: `32px ${TEXTO}`, color: C.suave, ancho: W - 2 * P });
  return pie ? 262 : 216;
}

function marca(ctx) {
  escribir(ctx, 'BookShelf', W / 2, H - 92, { font: `34px ${PIXEL}`, color: C.suave, align: 'center' });
}

const CIFRAS_ALTO = 190;
function cifras(ctx, s, y) {
  const datos = [
    [s.finishedCount, 'Libros terminados'],
    [s.pages, 'Páginas registradas'],
    [s.days, 'Días de lectura'],
  ];
  const ancho = (W - 2 * P - 40) / 3;
  datos.forEach(([n, label], i) => {
    const x = P + i * (ancho + 20);
    ctx.fillStyle = C.papel;
    ctx.fillRect(x, y, ancho, CIFRAS_ALTO);
    ctx.strokeStyle = C.laton;
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 2, y + 2, ancho - 4, CIFRAS_ALTO - 4);
    escribir(ctx, n.toLocaleString('es-ES'), x + ancho / 2, y + 26, { font: `64px ${PIXEL}`, align: 'center', ancho: ancho - 20 });
    escribir(ctx, label, x + ancho / 2, y + 108, { font: `600 30px ${TEXTO}`, color: C.suave, align: 'center', ancho: ancho - 24, maximo: 2, alto: 36 });
  });
}

const FAVORITO_ALTO = 190;
function favorito(ctx, book, imagen, y) {
  ctx.fillStyle = C.papel;
  ctx.fillRect(P, y, W - 2 * P, FAVORITO_ALTO);
  const w = 104;
  const h = 156;
  if (imagen) {
    const k = Math.min(w / imagen.naturalWidth, h / imagen.naturalHeight);
    ctx.drawImage(imagen, P + 18 + (w - imagen.naturalWidth * k) / 2, y + 17 + h - imagen.naturalHeight * k, imagen.naturalWidth * k, imagen.naturalHeight * k);
  } else cubierta(ctx, book, P + 18, y + 17, w, h);
  escribir(ctx, 'Mi favorito del mes', P + 148, y + 26, { font: `600 32px ${TEXTO}`, color: C.burdeos, ancho: W - 2 * P - 170 });
  escribir(ctx, book.title, P + 148, y + 76, { font: `600 40px ${TEXTO}`, ancho: W - 2 * P - 170, maximo: 2, alto: 50 });
}

const altoFrase = (ctx, texto) => {
  ctx.font = `italic 36px ${TEXTO}`;
  return lineas(ctx, `«${texto}»`, W - 2 * P - 40, 4).length * 48 + 40;
};
function frase(ctx, texto, y) {
  const h = altoFrase(ctx, texto);
  ctx.fillStyle = C.papel;
  ctx.fillRect(P, y, W - 2 * P, h);
  escribir(ctx, `«${texto}»`, W / 2, y + 20, { font: `italic 36px ${TEXTO}`, align: 'center', ancho: W - 2 * P - 40, maximo: 4, alto: 48 });
  return h;
}

async function fuentes() {
  try {
    await Promise.all([document.fonts.load(`62px ${PIXEL}`), document.fonts.load(`600 44px ${TEXTO}`), document.fonts.load(`italic 36px ${TEXTO}`)]);
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
  const paginas = cardPages(summary.finished);
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
      baldas(ctx, items, imagenes, y0 + 40);
      return lienzo;
    }
    const fav = conFavorito ? summary.favorite : null;
    const texto = conFrase ? summary.quote.trim() : '';
    const vacio = items.length === 0;
    const otros = [CIFRAS_ALTO + (summary.unknown ? 50 : 0), fav ? FAVORITO_ALTO : 0, texto ? altoFrase(ctx, texto) : 0].filter(Boolean);
    const sitio = H - 110 - y0 - otros.reduce((a, b) => a + b, 0);
    const filas = vacio ? 1 : Math.ceil(items.length / medidas(items.length).cols);
    const tope = (sitio - 8 * (otros.length + 2) - GAP) / filas - PLANK - GAP;
    const altoCentral = vacio ? 240 : altoBaldas(items.length, tope);
    const salto = Math.min(140, Math.max(8, (sitio - altoCentral) / (otros.length + 2)));
    let y = y0 + salto;
    if (vacio) {
      ctx.fillStyle = C.papel;
      ctx.fillRect(P, y, W - 2 * P, 240);
      escribir(ctx, summary.hasActivity ? 'Este mes has seguido avanzando' : 'Un mes tranquilo', W / 2, y + 88, { font: `600 46px ${TEXTO}`, color: C.burdeos, align: 'center', ancho: W - 2 * P - 40, maximo: 2, alto: 58 });
      y += 240 + salto;
    } else {
      baldas(ctx, items, imagenes, y, tope);
      y += altoCentral + salto;
    }
    cifras(ctx, summary, y);
    y += CIFRAS_ALTO;
    if (summary.unknown) {
      escribir(ctx, 'Solo incluye los avances convertibles a páginas', W / 2, y + 12, { font: `28px ${TEXTO}`, color: C.suave, align: 'center', ancho: W - 2 * P });
      y += 50;
    }
    y += salto;
    if (fav) {
      favorito(ctx, fav, imagenes.get(fav.id), y);
      y += FAVORITO_ALTO + salto;
    }
    if (texto) frase(ctx, texto, y);
    return lienzo;
  });
  return { lienzos, sinPortada };
}
