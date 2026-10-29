// Lectura de un EPUB en el dispositivo (SPEC §53): JSZip (cargado bajo demanda por quien llama) + DOMParser del navegador.
// Comprueba los límites, saca el orden de lectura y prepara cada capítulo como HTML sin scripts ni estilos del archivo,
// con las imágenes como `blob:` (con tope en «modo ligero»). Las funciones puras de abajo no necesitan el DOM.

export const MAX_FILE = 60 * 1024 * 1024;
export const MAX_UNZIPPED = 250 * 1024 * 1024;
export const MAX_CHAPTER = 4 * 1024 * 1024;
export const LITE_IMAGES = 300;
export const LITE_IMAGE_BYTES = 40 * 1024 * 1024;
export const LITE_PER_CHAPTER = 30;

export class EpubError extends Error {
  friendly = true;
}

const mib = (b) => `${(b / 1048576).toFixed(1).replace('.', ',')} MiB`;

/** Límites del archivo antes de abrirlo (tamaño) y después (descomprimido). Devuelve el motivo o null. */
export function sizeProblem(fileSize) {
  return fileSize > MAX_FILE ? `El archivo pesa ${mib(fileSize)} y el máximo es ${mib(MAX_FILE)}.` : null;
}
export function unzippedProblem(bytes) {
  return bytes > MAX_UNZIPPED ? `Descomprimido ocupa ${mib(bytes)} y el máximo es ${mib(MAX_UNZIPPED)}: no se puede abrir con seguridad.` : null;
}
/** Muchas imágenes → modo ligero (cada capítulo carga como mucho LITE_PER_CHAPTER). */
export const isLite = ({ count, bytes }) => count > LITE_IMAGES || bytes > LITE_IMAGE_BYTES;

/** Ruta dentro del ZIP de un `href` relativo a `base` (carpeta del archivo que lo cita), sin fragmento. */
export function resolvePath(base, href) {
  const clean = decodeURIComponent(String(href ?? '').split('#')[0]);
  if (!clean) return '';
  const parts = (clean.startsWith('/') ? [] : base.split('/').filter(Boolean)).concat(clean.split('/'));
  const out = [];
  for (const p of parts) {
    if (!p || p === '.') continue;
    if (p === '..') out.pop();
    else out.push(p);
  }
  return out.join('/');
}
const dirOf = (path) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');

/** Porcentaje del libro en una posición: capítulos anteriores enteros + fracción del actual, ponderado por tamaño. */
export function positionPercent(chapters, { chapter = 0, frac = 0 } = {}) {
  const total = chapters.reduce((s, c) => s + Math.max(1, c.size), 0);
  if (!total) return 0;
  const before = chapters.slice(0, chapter).reduce((s, c) => s + Math.max(1, c.size), 0);
  const here = Math.max(1, chapters[chapter]?.size ?? 0) * Math.min(1, Math.max(0, frac));
  return Math.round(((before + here) / total) * 1000) / 10;
}

const FONT_OBFUSCATION = ['http://www.idpf.org/2008/embedding', 'http://ns.adobe.com/pdf/enc#RC'];
const uncompressed = (entry) => entry?._data?.uncompressedSize ?? 0;
const IMAGE = /^image\//;

function parseXml(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new EpubError('El EPUB está dañado: uno de sus archivos internos no se puede leer.');
  return doc;
}
const byLocal = (root, name) => [...root.getElementsByTagName('*')].filter((el) => el.localName === name);

/**
 * Abre el EPUB y devuelve su estructura: metadatos, capítulos del orden de lectura (con tamaño y título del índice),
 * recuento de imágenes y si va en modo ligero. Lanza `EpubError` con un motivo comprensible.
 */
export async function openEpub(JSZip, data) {
  let zip;
  try {
    zip = await JSZip.loadAsync(data);
  } catch {
    throw new EpubError('No es un EPUB válido (no se puede abrir como archivo comprimido).');
  }
  const entries = Object.values(zip.files);
  const problem = unzippedProblem(entries.reduce((s, e) => s + uncompressed(e), 0));
  if (problem) throw new EpubError(problem);
  // DRM: si hay contenido cifrado (no la simple ofuscación de fuentes), no se puede leer y se dice
  const encryption = zip.file('META-INF/encryption.xml');
  if (encryption) {
    const methods = byLocal(parseXml(await encryption.async('string')), 'EncryptionMethod').map((m) => m.getAttribute('Algorithm'));
    if (methods.some((m) => !FONT_OBFUSCATION.includes(m))) throw new EpubError('Este EPUB tiene DRM (está cifrado): solo puede abrirse en la aplicación de la tienda donde lo compraste.');
  }
  const container = zip.file('META-INF/container.xml');
  if (!container) throw new EpubError('No es un EPUB válido: le falta META-INF/container.xml.');
  const rootfile = byLocal(parseXml(await container.async('string')), 'rootfile')[0]?.getAttribute('full-path');
  const opfFile = rootfile && zip.file(rootfile);
  if (!opfFile) throw new EpubError('No es un EPUB válido: no encontramos su descripción (OPF).');
  const opf = parseXml(await opfFile.async('string'));
  const base = dirOf(rootfile);
  const manifest = new Map(byLocal(opf, 'item').map((it) => [it.getAttribute('id'), { href: resolvePath(base, it.getAttribute('href')), type: it.getAttribute('media-type') ?? '', props: it.getAttribute('properties') ?? '' }]));
  const meta = (name) => byLocal(opf, name)[0]?.textContent?.trim() ?? '';
  const spine = byLocal(opf, 'itemref')
    .filter((r) => r.getAttribute('linear') !== 'no')
    .map((r) => manifest.get(r.getAttribute('idref')))
    .filter((it) => it && /html|xml/.test(it.type) && zip.file(it.href));
  if (!spine.length) throw new EpubError('Este EPUB no tiene capítulos que se puedan leer.');
  const images = [...manifest.values()].filter((it) => IMAGE.test(it.type));
  const imageInfo = { count: images.length, bytes: images.reduce((s, it) => s + uncompressed(zip.file(it.href)), 0) };
  const titles = await tocTitles(zip, manifest, opf);
  const chapters = spine.map((it, i) => ({ href: it.href, size: uncompressed(zip.file(it.href)), title: titles.get(it.href) || `Capítulo ${i + 1}` }));
  return { zip, title: meta('title'), author: meta('creator'), chapters, images: imageInfo, lite: isLite(imageInfo) };
}

/** Títulos del índice (EPUB 3 `nav` o EPUB 2 `toc.ncx`) por ruta de capítulo. */
async function tocTitles(zip, manifest, opf) {
  const out = new Map();
  try {
    const nav = [...manifest.values()].find((it) => it.props.split(' ').includes('nav'));
    if (nav && zip.file(nav.href)) {
      const doc = parseXml(await zip.file(nav.href).async('string'));
      for (const a of byLocal(doc, 'a')) {
        const p = resolvePath(dirOf(nav.href), a.getAttribute('href'));
        if (p && !out.has(p)) out.set(p, a.textContent.trim());
      }
      return out;
    }
    const ncxId = byLocal(opf, 'spine')[0]?.getAttribute('toc');
    const ncx = ncxId && manifest.get(ncxId);
    if (ncx && zip.file(ncx.href)) {
      const doc = parseXml(await zip.file(ncx.href).async('string'));
      for (const point of byLocal(doc, 'navPoint')) {
        const src = byLocal(point, 'content')[0]?.getAttribute('src');
        const label = byLocal(point, 'text')[0]?.textContent?.trim();
        const p = resolvePath(dirOf(ncx.href), src);
        if (p && label && !out.has(p)) out.set(p, label);
      }
    }
  } catch {
    // Sin índice legible: «Capítulo N»
  }
  return out;
}

const DROP = 'script, iframe, object, embed, form, input, button, select, textarea, link, style, meta, base, audio, video, source';

/**
 * Un capítulo listo para el iframe sin scripts: cuerpo sin elementos activos ni estilos del archivo, imágenes como
 * `blob:` (en modo ligero, solo las primeras LITE_PER_CHAPTER; el resto, su texto alternativo) y enlaces internos
 * marcados con `data-epub-href` y sin `href`. Devuelve `{ body, urls }`; quien lo use revoca las URL al cambiar de capítulo.
 */
export async function chapterBody(book, index) {
  const ch = book.chapters[index];
  const file = book.zip.file(ch.href);
  if (!file) throw new EpubError('Falta este capítulo dentro del EPUB.');
  if (ch.size > MAX_CHAPTER) return { body: `<p class="epub-note">Este capítulo es demasiado grande para mostrarlo (${mib(ch.size)}).</p>`, urls: [], skippedImages: 0 };
  const text = await file.async('string');
  let doc = new DOMParser().parseFromString(text, 'application/xhtml+xml');
  if (doc.getElementsByTagName('parsererror').length) doc = new DOMParser().parseFromString(text, 'text/html');
  const body = doc.body ?? doc.getElementsByTagName('body')[0] ?? doc.documentElement;
  body.querySelectorAll(DROP).forEach((el) => el.remove());
  for (const el of body.querySelectorAll('*')) {
    for (const attr of [...el.attributes]) if (/^on/i.test(attr.name) || attr.name === 'style') el.removeAttribute(attr.name);
  }
  const dir = dirOf(ch.href);
  const urls = [];
  let loaded = 0;
  let skippedImages = 0;
  for (const img of [...body.querySelectorAll('img, image')]) {
    const src = img.getAttribute('src') ?? img.getAttribute('href') ?? img.getAttribute('xlink:href');
    const entry = src && book.zip.file(resolvePath(dir, src));
    if (!entry || (book.lite && loaded >= LITE_PER_CHAPTER)) {
      if (book.lite && entry) skippedImages++;
      const alt = doc.createElement('span');
      alt.className = 'epub-alt';
      alt.textContent = img.getAttribute('alt') || '[imagen]';
      img.replaceWith(alt);
      continue;
    }
    const url = URL.createObjectURL(await entry.async('blob'));
    urls.push(url);
    loaded++;
    if (img.localName === 'image') {
      img.setAttribute('href', url);
      img.removeAttribute('xlink:href');
    } else img.setAttribute('src', url);
    img.removeAttribute('srcset');
  }
  for (const a of body.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href');
    if (/^[a-z][a-z0-9+.-]*:/i.test(href)) a.removeAttribute('href');
    else {
      // Sin `href`: un enlace interno nunca navega el iframe por sí mismo (el lector decide el salto)
      a.setAttribute('data-epub-href', resolvePath(dir, href));
      a.removeAttribute('href');
      a.setAttribute('class', 'epub-link');
    }
  }
  return { body: body.innerHTML, urls, skippedImages };
}

/** Huella SHA-256 del archivo: reconoce el mismo EPUB en otro dispositivo sin subirlo. */
export async function epubHash(buffer) {
  const d = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
