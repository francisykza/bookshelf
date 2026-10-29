// Lectura de un EPUB en el dispositivo (SPEC §53): JSZip (cargado bajo demanda por quien llama) + DOMParser del navegador.
// Comprueba los límites, saca el orden de lectura y prepara cada capítulo como HTML sin scripts ni estilos del archivo,
// con las imágenes como `blob:` (con tope en «modo ligero»). Las funciones puras de abajo no necesitan el DOM.

export const MAX_FILE = 60 * 1024 * 1024;
export const MAX_UNZIPPED = 250 * 1024 * 1024;
export const MAX_CHAPTER = 4 * 1024 * 1024;
export const LITE_IMAGES = 300;
export const LITE_IMAGE_BYTES = 40 * 1024 * 1024;
export const LITE_PER_CHAPTER = 30;
/** Una sola imagen por encima de esto no se muestra (se explica): protege la memoria del dispositivo. */
export const MAX_IMAGE = 12 * 1024 * 1024;
/** Versión del formato de anclajes (1.56, SPEC §54.2): bloque de texto + fracción, con la fracción del capítulo. */
export const ANCHOR_VERSION = 2;
/** Bloques de texto que sirven de ancla, en orden de documento (deterministas para un mismo archivo). */
export const BLOCKS = 'p, h1, h2, h3, h4, h5, h6, li, pre, dt, dd, figure, table, hr, img';

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

/**
 * Caracteres de texto legible de un documento (sin etiquetas, comentarios, `head`, estilos ni espacios repetidos):
 * el peso de cada documento en el porcentaje, independiente de la letra, la pantalla y del tamaño del archivo.
 */
export function textLength(html) {
  return String(html ?? '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(head|style|script)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, 'x')
    .replace(/\s+/g, ' ')
    .trim().length;
}

const weightOf = (c) => Math.max(1, c.weight ?? c.size ?? 0);

/**
 * Porcentaje del archivo en una posición: documentos anteriores enteros + fracción del actual, ponderado por su texto
 * legible (`weight`; los de la 1.55, por tamaño). Ubicación aproximada, no prueba de lectura.
 */
export function positionPercent(chapters, { chapter = 0, frac = 0 } = {}) {
  const total = chapters.reduce((s, c) => s + weightOf(c), 0);
  if (!total) return 0;
  const before = chapters.slice(0, chapter).reduce((s, c) => s + weightOf(c), 0);
  const here = (chapters[chapter] ? weightOf(chapters[chapter]) : 0) * Math.min(1, Math.max(0, frac));
  return Math.round(((before + here) / total) * 1000) / 10;
}

/** Enlace del capítulo reescrito por el lector: `#bs-go-N-fragmento` (otro documento) o `#bs-img-K` (cargar imagen). */
export function parseReaderHash(hash) {
  const raw = String(hash ?? '').replace(/^#/, '');
  let h = raw;
  try {
    h = decodeURIComponent(raw);
  } catch {
    // fragmento mal codificado: se usa tal cual
  }
  let m = /^bs-go-(\d+)(?:-(.*))?$/.exec(h);
  if (m) return { kind: 'go', chapter: Number(m[1]), fragment: m[2] || '' };
  m = /^bs-img-(\d+)$/.exec(h);
  if (m) return { kind: 'img', index: Number(m[1]) };
  return h ? { kind: 'fragment', fragment: h } : null;
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
  // ISBN declarado en los identificadores (evidencia para la vinculación, nunca la única)
  const isbn = byLocal(opf, 'identifier')
    .map((el) => el.textContent.replace(/^urn:isbn:/i, '').replace(/[\s-]/g, ''))
    .find((v) => /^(97[89])?\d{9}[\dX]$/i.test(v)) ?? '';
  // Sentido de las páginas declarado por el EPUB (libros de derecha a izquierda)
  const rtl = byLocal(opf, 'spine')[0]?.getAttribute('page-progression-direction') === 'rtl';
  const spine = byLocal(opf, 'itemref')
    .filter((r) => r.getAttribute('linear') !== 'no')
    .map((r) => manifest.get(r.getAttribute('idref')))
    .filter((it) => it && /html|xml/.test(it.type) && zip.file(it.href));
  if (!spine.length) throw new EpubError('Este EPUB no tiene capítulos que se puedan leer.');
  const images = [...manifest.values()].filter((it) => IMAGE.test(it.type));
  const imageInfo = { count: images.length, bytes: images.reduce((s, it) => s + uncompressed(zip.file(it.href)), 0) };
  const titles = await tocTitles(zip, manifest, opf);
  const chapters = [];
  for (const [i, it] of spine.entries()) {
    const size = uncompressed(zip.file(it.href));
    // El peso es el texto legible; un documento enorme no se lee entero solo para pesarlo
    const weight = size > MAX_CHAPTER ? size : textLength(await zip.file(it.href).async('string'));
    chapters.push({ href: it.href, size, weight, title: titles.get(it.href) || `Sección ${i + 1}` });
  }
  return { zip, title: meta('title'), author: meta('creator'), isbn, rtl, chapters, images: imageInfo, lite: isLite(imageInfo) };
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
 * Un documento listo para el iframe sin scripts: cuerpo sin elementos activos ni estilos del archivo; bloques de texto
 * numerados (`data-bs-block`, el ancla de la posición); imágenes como `blob:` (en modo ligero, solo las primeras
 * LITE_PER_CHAPTER y las que se pidan en `allow`; el resto, su descripción y «Cargar imagen»); enlaces del mismo documento
 * tal cual, a otro documento como `#bs-go-N-fragmento` y externos sin enlace. Devuelve `{ body, urls, deferred }`; quien
 * lo use revoca las URL al cambiar de documento.
 */
export async function chapterBody(book, index, { allow = new Set() } = {}) {
  const ch = book.chapters[index];
  const file = book.zip.file(ch.href);
  if (!file) throw new EpubError('Falta esta sección dentro del EPUB.');
  if (ch.size > MAX_CHAPTER) return { body: `<p class="epub-note">Esta sección es demasiado grande para mostrarla (${mib(ch.size)}).</p>`, urls: [], deferred: 0 };
  const text = await file.async('string');
  let doc = new DOMParser().parseFromString(text, 'application/xhtml+xml');
  if (doc.getElementsByTagName('parsererror').length) doc = new DOMParser().parseFromString(text, 'text/html');
  const body = doc.body ?? doc.getElementsByTagName('body')[0] ?? doc.documentElement;
  body.querySelectorAll(DROP).forEach((el) => el.remove());
  for (const el of body.querySelectorAll('*')) {
    for (const attr of [...el.attributes]) if (/^on/i.test(attr.name) || attr.name === 'style' || attr.name === 'srcdoc' || attr.name === 'formaction') el.removeAttribute(attr.name);
  }
  const dir = dirOf(ch.href);
  const urls = [];
  let loaded = 0;
  let deferred = 0;
  const altFor = (img, extra) => {
    const span = doc.createElement('span');
    span.setAttribute('class', 'epub-alt');
    span.textContent = img.getAttribute('alt') || 'Imagen';
    if (extra) span.appendChild(extra);
    return span;
  };
  for (const [k, img] of [...body.querySelectorAll('img, image')].entries()) {
    const src = img.getAttribute('src') ?? img.getAttribute('href') ?? img.getAttribute('xlink:href');
    const entry = src && book.zip.file(resolvePath(dir, src));
    if (!entry) {
      img.replaceWith(altFor(img));
      continue;
    }
    const bytes = uncompressed(entry);
    if (bytes > MAX_IMAGE) {
      const note = doc.createElement('span');
      note.textContent = ` · demasiado grande para mostrarla (${mib(bytes)})`;
      img.replaceWith(altFor(img, note));
      continue;
    }
    if (book.lite && loaded >= LITE_PER_CHAPTER && !allow.has(k)) {
      deferred++;
      const link = doc.createElement('a');
      link.setAttribute('href', `#bs-img-${k}`);
      link.setAttribute('class', 'epub-load');
      link.textContent = 'Cargar imagen';
      const sep = doc.createTextNode(' · ');
      const span = altFor(img);
      span.appendChild(sep);
      span.appendChild(link);
      img.replaceWith(span);
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
    if (/^[a-z][a-z0-9+.-]*:/i.test(href)) {
      a.removeAttribute('href');
      continue;
    }
    const [path, frag = ''] = href.split('#');
    const target = path ? resolvePath(dir, path) : ch.href;
    if (target === ch.href) {
      // Mismo documento (notas al pie): el navegador salta solo, sin scripts
      if (frag) a.setAttribute('href', `#${frag}`);
      else a.removeAttribute('href');
      continue;
    }
    const n = book.chapters.findIndex((c) => c.href === target);
    if (n >= 0) a.setAttribute('href', `#bs-go-${n}${frag ? `-${encodeURIComponent(frag)}` : ''}`);
    else a.removeAttribute('href');
  }
  // Bloques del ancla, en orden de documento
  [...body.querySelectorAll(BLOCKS)].forEach((el, i) => el.setAttribute('data-bs-block', String(i)));
  return { body: body.innerHTML, urls, deferred };
}

/** Huella SHA-256 del archivo: reconoce el mismo EPUB en otro dispositivo sin subirlo. */
export async function epubHash(buffer) {
  const d = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
