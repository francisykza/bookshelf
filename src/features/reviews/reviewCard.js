// La reseña como imagen (1.85), pensada para TikTok: el cuaderno de la app, con portada, valoración, los datos de la lectura y el
// texto entero. Si no cabe en una imagen, sigue en otra, como un carrusel. Se dibuja en un lienzo en el dispositivo y nada sale de
// él, salvo la portada que haya que pedir. Las franjas de arriba y abajo quedan libres porque TikTok pone ahí su interfaz.
import { EDITIONS, formatRating, spineColor, visualEdition } from '../../domain/books';

export const FORMATOS = {
  tiktok: { nombre: 'TikTok', w: 1080, h: 1920, arriba: 120, abajo: 250 },
  post: { nombre: 'Publicación', w: 1080, h: 1350, arriba: 56, abajo: 56 },
};

export const PAPELES = {
  cuaderno: { nombre: 'Cuaderno', fondo: ['#50694f', '#26382c'], papel: '#fbf3e1', fibra: '#ecdfc4', tinta: '#35261a', suave: '#7a6650', acento: '#8c3f3b', marco: '#cda6a0', lomo: '#8a5a30', estrella: '#c8982e' },
  noche: { nombre: 'Noche', fondo: ['#1c2c48', '#0b1220'], papel: '#16233a', fibra: '#1e2e48', tinta: '#f2e8d4', suave: '#a9b4c4', acento: '#e6bd68', marco: '#566a8a', lomo: '#0a111e', estrella: '#e6bd68' },
  terracota: { nombre: 'Terracota', fondo: ['#c0704c', '#7e3a24'], papel: '#fdf1e0', fibra: '#f4e0c8', tinta: '#46231a', suave: '#8a5c48', acento: '#b24a2c', marco: '#e2ab8e', lomo: '#6e3220', estrella: '#c9792a' },
};

const SERIF = '"Cormorant Garamond", Georgia, serif';
const TEXTO = 'Lora, Georgia, serif';
const MANO = 'Caveat, cursive';
const LOMO = 70;
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Parte el texto en líneas que caben en `ancho`; una línea vacía es un salto de párrafo. `medir` devuelve el ancho de un texto. */
export function partirLineas(texto, medir, ancho) {
  const lineas = [];
  for (const parrafo of texto.trim().split(/\n+/)) {
    let linea = '';
    for (const palabra of parrafo.trim().split(/\s+/).filter(Boolean)) {
      const prueba = linea ? `${linea} ${palabra}` : palabra;
      if (medir(prueba) <= ancho || !linea) linea = prueba;
      else {
        lineas.push(linea);
        linea = palabra;
      }
    }
    if (linea) lineas.push(linea);
    lineas.push('');
  }
  lineas.pop();
  return lineas;
}

/**
 * Reparte en varias imágenes un texto que no cabe en una: `primera` líneas en la primera, `resto` en las siguientes y `ultima`
 * en la final, que además lleva la firma. `minimo` son las líneas que se guardan para esa final: sin cita, para que la firma no
 * se quede sola; con cita puede ser 0, porque la cita y la firma ya hacen una buena última imagen.
 */
export function repartir(lineas, primera, resto, ultima, minimo = 2) {
  const hojas = [];
  let i = 0;
  let cabe = primera;
  do {
    let fin = i + Math.max(1, Math.min(cabe, lineas.length - i - minimo));
    // Una hoja no acaba ni empieza con un salto de párrafo
    while (fin > i + 1 && lineas[fin - 1] === '') fin -= 1;
    hojas.push(lineas.slice(i, fin));
    i = fin;
    while (lineas[i] === '') i += 1;
    cabe = resto;
  } while (lineas.length - i > ultima);
  hojas.push(lineas.slice(i));
  return hojas;
}

const fechaCorta = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
};

/** Los datos de la lectura que se conocen; nada de rellenar lo que no está. */
export function datosLectura(book) {
  const datos = [];
  if (book.finishedAt && book.status === 'read') datos.push(['Terminado', fechaCorta(book.finishedAt)]);
  if (book.startedAt && book.finishedAt && book.status === 'read') {
    const dias = Math.max(1, Math.round((new Date(book.finishedAt) - new Date(book.startedAt)) / 86400000));
    if (Number.isFinite(dias)) datos.push(['Leído en', `${dias} ${dias === 1 ? 'día' : 'días'}`]);
  }
  if (book.status === 'reading' && book.currentPage) datos.push(['Voy por', `pág. ${book.currentPage}`]);
  if (book.pageCount) datos.push(['Páginas', String(book.pageCount)]);
  const edicion = EDITIONS[visualEdition(book)]?.short;
  if (edicion) datos.push(['Edición', edicion]);
  if (book.categories?.[0]) datos.push(['Género', book.categories[0]]);
  return datos.slice(0, 4);
}

function imagen(src, cruzado) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (cruzado) img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** La portada, si se puede usar en un lienzo. Open Library lo permite; lo demás, o si falla, pasa por `/api/portada`. */
export async function cargarPortada(src) {
  if (!src) return null;
  if (src.startsWith('data:') || src.startsWith('blob:')) return imagen(src, false).catch(() => null);
  if (src.startsWith('/')) return imagen(src, true).catch(() => null);
  if (src.includes('covers.openlibrary.org')) {
    const directa = await imagen(src, true).catch(() => null);
    if (directa) return directa;
  }
  return imagen(`/api/portada?u=${encodeURIComponent(src)}`, true).catch(() => null);
}

async function fuentes() {
  if (!document.fonts?.load) return;
  await Promise.allSettled([`700 60px ${SERIF}`, `italic 600 40px ${SERIF}`, `400 40px ${TEXTO}`, `italic 400 40px ${TEXTO}`, `600 60px ${MANO}`].map((f) => document.fonts.load(f, 'Reseña')));
}

function esquinas(g, x, y, w, h, r) {
  g.beginPath();
  if (g.roundRect) g.roundRect(x, y, w, h, r);
  else g.rect(x, y, w, h);
}

function escribir(g, texto, x, y, fuente, color, alinear = 'left', espacio = 0) {
  g.font = fuente;
  g.fillStyle = color;
  g.textAlign = alinear;
  g.textBaseline = 'alphabetic';
  if ('letterSpacing' in g) g.letterSpacing = `${espacio}px`;
  g.fillText(texto, x, y);
  if ('letterSpacing' in g) g.letterSpacing = '0px';
}

function grano(g, x, y, w, h, color, semilla) {
  g.fillStyle = color;
  let s = semilla;
  const azar = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < (w * h) / 900; k += 1) g.fillRect(x + azar() * w, y + azar() * h, 2 + azar() * 16, 1.5);
}

function hoja(g, f, p, semilla) {
  const fondo = g.createRadialGradient(f.w / 2, f.h * 0.35, 80, f.w / 2, f.h / 2, f.h * 0.75);
  fondo.addColorStop(0, p.fondo[0]);
  fondo.addColorStop(1, p.fondo[1]);
  g.fillStyle = fondo;
  g.fillRect(0, 0, f.w, f.h);
  const x = 56;
  const y = f.arriba;
  const w = f.w - 112;
  const h = f.h - f.arriba - f.abajo;
  g.save();
  g.shadowColor = 'rgb(0 0 0 / 0.45)';
  g.shadowBlur = 44;
  g.shadowOffsetY = 18;
  esquinas(g, x, y, w, h, 14);
  g.fillStyle = p.papel;
  g.fill();
  g.restore();
  g.save();
  esquinas(g, x, y, w, h, 14);
  g.clip();
  grano(g, x, y, w, h, p.fibra, semilla);
  g.fillStyle = p.lomo;
  g.fillRect(x, y, LOMO, h);
  g.fillStyle = 'rgb(0 0 0 / 0.16)';
  g.fillRect(x + LOMO, y, 12, h);
  g.restore();
  // Las anillas del cuaderno
  for (let ry = y + 56; ry < y + h - 30; ry += 104) {
    esquinas(g, x + 16, ry, LOMO + 2, 16, 8);
    g.fillStyle = '#c99a44';
    g.fill();
    esquinas(g, x + 20, ry + 3, LOMO - 8, 4, 2);
    g.fillStyle = '#f2d68c';
    g.fill();
  }
  const mx = x + LOMO + 34;
  const my = y + 30;
  const mw = w - LOMO - 62;
  const mh = h - 60;
  g.strokeStyle = p.marco;
  g.lineWidth = 3;
  g.strokeRect(mx, my, mw, mh);
  g.lineWidth = 1.5;
  g.strokeRect(mx + 9, my + 9, mw - 18, mh - 18);
  return { x: mx + 44, y: my + 44, w: mw - 88, fin: my + mh - 40 };
}

function estrella(g, cx, cy, r) {
  g.beginPath();
  for (let k = 0; k < 10; k += 1) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const d = k % 2 ? r * 0.46 : r;
    g.lineTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d);
  }
  g.closePath();
}

function estrellas(g, valor, x, y, r, p) {
  for (let k = 0; k < 5; k += 1) {
    const cx = x + r + k * (r * 2.3);
    const lleno = Math.max(0, Math.min(1, valor - k));
    estrella(g, cx, y, r);
    g.strokeStyle = p.estrella;
    g.lineWidth = 3;
    g.stroke();
    if (lleno) {
      g.save();
      g.beginPath();
      g.rect(cx - r, y - r, r * 2 * lleno, r * 2);
      g.clip();
      estrella(g, cx, y, r);
      g.fillStyle = p.estrella;
      g.fill();
      g.restore();
    }
  }
}

function cubierta(g, book, portada, x, y, w, h) {
  g.save();
  g.shadowColor = 'rgb(0 0 0 / 0.4)';
  g.shadowBlur = 24;
  g.shadowOffsetX = 8;
  g.shadowOffsetY = 12;
  g.fillStyle = spineColor(book);
  g.fillRect(x, y, w, h);
  g.restore();
  if (portada) {
    // La portada llena su sitio sin deformarse
    const k = Math.max(w / portada.width, h / portada.height);
    const sw = w / k;
    const sh = h / k;
    g.drawImage(portada, (portada.width - sw) / 2, (portada.height - sh) / 2, sw, sh, x, y, w, h);
  } else {
    g.strokeStyle = 'rgb(255 240 200 / 0.75)';
    g.lineWidth = 3;
    g.strokeRect(x + 16, y + 16, w - 32, h - 32);
    // Título, adorno y autor, centrados, como la cubierta de la app
    const tam = Math.round(w * 0.125);
    const fuente = `700 ${tam}px ${SERIF}`;
    g.font = fuente;
    const lineas = partirLineas(book.title, (l) => g.measureText(l).width, w - 64).slice(0, 5);
    const y0 = y + h / 2 - ((lineas.length - 1) * tam * 1.12) / 2 - tam * 0.5;
    lineas.forEach((l, k) => escribir(g, l, x + w / 2, y0 + k * tam * 1.12, fuente, '#fff4dc', 'center'));
    const yFin = y0 + lineas.length * tam * 1.12;
    escribir(g, '❦', x + w / 2, yFin + tam * 0.3, `400 ${Math.round(tam * 0.8)}px ${SERIF}`, 'rgb(255 240 200 / 0.8)', 'center');
    const fuenteAutor = `italic 600 ${Math.round(tam * 0.68)}px ${SERIF}`;
    g.font = fuenteAutor;
    partirLineas(book.author, (l) => g.measureText(l).width, w - 64)
      .slice(0, 2)
      .forEach((l, k) => escribir(g, l, x + w / 2, yFin + tam * 1.2 + k * tam * 0.8, fuenteAutor, 'rgb(255 244 220 / 0.9)', 'center'));
  }
  g.fillStyle = 'rgb(255 255 255 / 0.14)';
  g.fillRect(x + 7, y, 3, h);
}

/** Cabecera de la primera imagen; devuelve dónde sigue el contenido. */
function cabecera(g, book, portada, c, p, f, opciones) {
  const compacto = f.h < 1500;
  escribir(g, 'MI RESEÑA', c.x + c.w / 2, c.y + 30, `600 ${compacto ? 30 : 34}px ${SERIF}`, p.acento, 'center', 8);
  let y = c.y + (compacto ? 60 : 72);
  const cw = compacto ? 196 : 270;
  const ch = Math.round(cw * 1.5);
  cubierta(g, book, portada, c.x, y, cw, ch);
  const tx = c.x + cw + 36;
  const tw = c.w - cw - 36;
  let tamano = compacto ? 58 : 70;
  let lineas;
  do {
    g.font = `700 ${tamano}px ${SERIF}`;
    lineas = partirLineas(book.title, (t) => g.measureText(t).width, tw);
    tamano -= 4;
  } while (lineas.length > 3 && tamano > 36);
  tamano += 4;
  let ty = y + tamano * 0.86;
  lineas.slice(0, 4).forEach((l) => {
    escribir(g, l, tx, ty, `700 ${tamano}px ${SERIF}`, p.tinta);
    ty += tamano * 1.04;
  });
  const autor = `italic 600 ${compacto ? 34 : 40}px ${SERIF}`;
  g.font = autor;
  partirLineas(book.author, (t) => g.measureText(t).width, tw)
    .slice(0, 2)
    .forEach((l) => {
      ty += 2;
      escribir(g, l, tx, ty, autor, p.suave);
      ty += compacto ? 38 : 44;
    });
  if (book.rating) {
    const r = compacto ? 22 : 27;
    ty += r + 8;
    estrellas(g, book.rating, tx, ty, r, p);
    ty += r + (compacto ? 34 : 42);
    escribir(g, `${formatRating(book.rating)} de 5`, tx, ty, `400 ${compacto ? 28 : 32}px ${TEXTO}`, p.suave);
  }
  y = Math.max(y + ch, ty) + (compacto ? 26 : 36);
  if (opciones.detalles) {
    const datos = datosLectura(book);
    if (datos.length) {
      const col = c.w / datos.length;
      g.strokeStyle = p.marco;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(c.x, y);
      g.lineTo(c.x + c.w, y);
      g.stroke();
      datos.forEach(([clave, valor], k) => {
        const cx = c.x + col * k + col / 2;
        escribir(g, clave.toUpperCase(), cx, y + 36, `600 21px ${SERIF}`, p.acento, 'center', 2);
        let v = 29;
        g.font = `400 ${v}px ${TEXTO}`;
        while (g.measureText(valor).width > col - 12 && v > 18) {
          v -= 1;
          g.font = `400 ${v}px ${TEXTO}`;
        }
        escribir(g, valor, cx, y + 76, `400 ${v}px ${TEXTO}`, p.tinta, 'center');
      });
      y += 100;
      g.beginPath();
      g.moveTo(c.x, y);
      g.lineTo(c.x + c.w, y);
      g.stroke();
      y += 30;
    }
  }
  return y;
}

function cierre(g, nombre, ramita, c, p) {
  if (ramita) {
    const h = 190;
    g.drawImage(ramita, c.x + c.w - h * 0.64, c.fin - h + 6, h * 0.64, h);
  }
  if (nombre) escribir(g, `— ${nombre}`, c.x + c.w - 136, c.fin - 34, `600 68px ${MANO}`, p.tinta, 'right');
  escribir(g, 'BookShelf', c.x, c.fin - 8, `italic 600 30px ${SERIF}`, p.suave);
}

function bloqueCita(g, cita, c, y, p) {
  const fuente = `italic 400 34px ${TEXTO}`;
  g.font = fuente;
  const lineas = partirLineas(`«${cita.text}»`, (t) => g.measureText(t).width, c.w - 56).slice(0, 6);
  const alto = lineas.length * 48 + 40;
  g.fillStyle = p.acento;
  g.fillRect(c.x, y, 5, alto);
  lineas.forEach((l, k) => escribir(g, l, c.x + 28, y + 46 + k * 48, fuente, p.tinta));
  return alto;
}

const altoCita = (g, cita, c) => {
  g.font = `italic 400 34px ${TEXTO}`;
  return Math.min(6, partirLineas(`«${cita.text}»`, (t) => g.measureText(t).width, c.w - 56).length) * 48 + 76;
};

/** Dibuja las imágenes de la reseña y devuelve sus lienzos. Sin portada usable, va la cubierta dibujada y `sinPortada` lo dice. */
export async function dibujarResena({ book, texto, nombre, formato = 'tiktok', papel = 'cuaderno', detalles = true, cita = null }) {
  const f = FORMATOS[formato];
  const p = PAPELES[papel];
  await fuentes();
  const [portada, ramita] = await Promise.all([cargarPortada(book.cover), imagen('/assets/bookshelf/notebook/botanical-sprig.webp', false).catch(() => null)]);
  const crear = () => {
    const c = document.createElement('canvas');
    c.width = f.w;
    c.height = f.h;
    return c;
  };
  // Primero se mide en un lienzo de prueba cuánto sitio deja la cabecera
  const prueba = crear().getContext('2d');
  const c0 = hoja(prueba, f, p, 11);
  const inicio = cabecera(prueba, book, portada, c0, p, f, { detalles });
  const pie = 130;
  const reservaCita = cita ? altoCita(prueba, cita, c0) : 0;
  let plan = null;
  // El tamaño más grande con el que todo cabe en una imagen; si no, el de lectura cómoda y más imágenes
  for (const tam of [50, 46, 42, 40]) {
    const alto = Math.round(tam * 1.46);
    prueba.font = `400 ${tam}px ${TEXTO}`;
    const lineas = partirLineas(texto, (t) => prueba.measureText(t).width, c0.w);
    const primera = Math.floor((c0.fin - inicio) / alto);
    const resto = Math.floor((c0.fin - c0.y - 50) / alto);
    const ultima = Math.floor((c0.fin - pie - reservaCita - inicio) / alto);
    plan = { tam, alto, lineas, primera, resto, ultimaResto: Math.floor((c0.fin - c0.y - 50 - pie - reservaCita) / alto) };
    if (lineas.length <= ultima) {
      plan.hojas = [lineas];
      break;
    }
  }
  if (!plan.hojas) plan.hojas = repartir(plan.lineas, plan.primera, plan.resto, plan.ultimaResto, cita ? 0 : 2);

  const total = plan.hojas.length;
  const lienzos = plan.hojas.map((lineas, k) => {
    const lienzo = crear();
    const g = lienzo.getContext('2d');
    const c = hoja(g, f, p, 11 + k * 7);
    let y;
    if (k === 0) y = cabecera(g, book, portada, c, p, f, { detalles });
    else {
      escribir(g, book.title, c.x, c.y + 30, `italic 600 36px ${SERIF}`, p.acento);
      y = c.y + 62;
    }
    y += plan.alto * 0.72;
    for (const linea of lineas) {
      if (linea) escribir(g, linea, c.x, y, `400 ${plan.tam}px ${TEXTO}`, p.tinta);
      y += linea ? plan.alto : plan.alto * 0.6;
    }
    if (total > 1) escribir(g, `${k + 1} / ${total}`, c.x + c.w, c.y + 30, `600 30px ${SERIF}`, p.suave, 'right', 2);
    if (k === total - 1) {
      // Si la cita va sola en la última imagen, en el centro de la hoja
      if (cita) bloqueCita(g, cita, c, lineas.length ? y : (c.y + c.fin) / 2 - 120, p);
      cierre(g, nombre, ramita, c, p);
    }
    return lienzo;
  });
  return { lienzos, sinPortada: Boolean(book.cover) && !portada };
}
