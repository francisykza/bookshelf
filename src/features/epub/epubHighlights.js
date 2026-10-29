// Subrayados del lector EPUB (SPEC §55.4). Una nota con fragmento ES el subrayado: aquí solo se calcula su rango, se
// recupera al abrir la sección y se pinta encima del texto sin cambiar su tipografía. Las funciones reciben el documento
// del capítulo (el iframe sin scripts) y trabajan con la API del DOM desde la app; nada de cadenas HTML.

export const RANGE_VERSION = 3;
const CONTEXT = 32;
const BLOCK = '[data-bs-block]';

const blockOf = (node) => (node?.nodeType === 1 ? node : node?.parentElement)?.closest?.(BLOCK) ?? null;

/** Desplazamiento de un punto del DOM sobre el texto canónico de su bloque (las marcas no lo cambian). */
function pointOffset(block, node, offset) {
  const r = block.ownerDocument.createRange();
  r.setStart(block, 0);
  r.setEnd(node, offset);
  return r.toString().length;
}

/** Nodos de texto bajo un elemento, en orden. */
function textNodes(root) {
  const out = [];
  const walker = root.ownerDocument.createTreeWalker(root, 4);
  // Las páginas de paso del modo paginado no son texto del libro
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (!n.parentElement?.closest('[data-turn]')) out.push(n);
  return out;
}

/** Punto del DOM a partir de un desplazamiento en el texto de un bloque. */
function pointAt(block, offset) {
  let left = offset;
  const nodes = textNodes(block);
  for (const n of nodes) {
    if (left <= n.data.length) return { node: n, offset: left };
    left -= n.data.length;
  }
  const last = nodes[nodes.length - 1];
  return last ? { node: last, offset: last.data.length } : null;
}

const squash = (t) => String(t ?? '').replace(/\s+/g, ' ').trim();

/**
 * Ancla de rango de una selección: bloque y desplazamiento de inicio y fin, más contexto anterior y posterior para
 * recuperarlo si cambiara la estructura. Null si la selección no cae en bloques del documento.
 */
export function rangeAnchor(range) {
  const sb = blockOf(range.startContainer);
  const eb = blockOf(range.endContainer);
  if (!sb || !eb) return null;
  const start = pointOffset(sb, range.startContainer, range.startOffset);
  const end = pointOffset(eb, range.endContainer, range.endOffset);
  const before = sb.textContent.slice(0, start);
  const after = eb.textContent.slice(end);
  return {
    v: RANGE_VERSION,
    start: { block: Number(sb.getAttribute('data-bs-block')), offset: start },
    end: { block: Number(eb.getAttribute('data-bs-block')), offset: end },
    prefix: squash(before).slice(-CONTEXT),
    suffix: squash(after).slice(0, CONTEXT),
  };
}

/** Texto normalizado (espacios colapsados) con el mapa a cada nodo y posición, para buscar sin depender del marcado. */
function flatText(root) {
  let text = '';
  const map = [];
  let space = true;
  for (const n of textNodes(root)) {
    for (let i = 0; i < n.data.length; i++) {
      const c = n.data[i];
      if (/\s/.test(c)) {
        if (space) continue;
        space = true;
        text += ' ';
      } else {
        space = false;
        text += c;
      }
      map.push({ node: n, offset: i });
    }
  }
  return { text, map };
}

/** Todas las apariciones de `needle` en `hay`. */
function occurrences(hay, needle) {
  const out = [];
  if (!needle) return out;
  for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + 1)) out.push(i);
  return out;
}

/**
 * Rango de un subrayado en el documento: primero su ancla estructural (si el texto coincide); si no, el fragmento con su
 * contexto en el bloque o en la sección. Devuelve `{ range, status }`: `ok`, `ambiguous` (varias apariciones posibles:
 * no se marca ninguna) o `missing`.
 */
export function resolveRange(doc, quote) {
  const ep = quote.epub ?? {};
  const want = squash(quote.text);
  if (!want) return { range: null, status: 'missing' };
  const r = ep.range;
  if (r?.start && r?.end) {
    const sb = doc.querySelector(`[data-bs-block="${r.start.block}"]`);
    const eb = doc.querySelector(`[data-bs-block="${r.end.block}"]`);
    const a = sb && pointAt(sb, r.start.offset);
    const b = eb && pointAt(eb, r.end.offset);
    if (a && b) {
      const range = doc.createRange();
      range.setStart(a.node, a.offset);
      range.setEnd(b.node, b.offset);
      if (squash(range.toString()) === want) return { range, status: 'ok' };
    }
  }
  // Recuperación por texto: dentro de su bloque si se conoce; si no, en toda la sección
  const scopes = [];
  const block = ep.block != null ? doc.querySelector(`[data-bs-block="${ep.block}"]`) : null;
  if (block) scopes.push(block);
  scopes.push(doc.body);
  for (const scope of scopes) {
    const flat = flatText(scope);
    let hits = occurrences(flat.text, want);
    if (hits.length > 1 && (r?.prefix || r?.suffix)) {
      hits = hits.filter((i) => (!r.prefix || flat.text.slice(Math.max(0, i - r.prefix.length - 1), i).trim().endsWith(r.prefix)) && (!r.suffix || flat.text.slice(i + want.length, i + want.length + r.suffix.length + 1).trim().startsWith(r.suffix)));
    }
    if (hits.length === 1) {
      const s = flat.map[hits[0]];
      const e = flat.map[hits[0] + want.length - 1];
      const range = doc.createRange();
      range.setStart(s.node, s.offset);
      range.setEnd(e.node, e.offset + 1);
      return { range, status: 'ok' };
    }
    if (hits.length > 1) return { range: null, status: 'ambiguous' };
  }
  return { range: null, status: 'missing' };
}

/** Color translúcido de una categoría (sin tocar el color del texto). */
export function tint(hex, night = false) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? '').trim());
  const n = m ? parseInt(m[1], 16) : 0xd3a943;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${night ? 0.38 : 0.26})`;
}

const MARK = 'mark[data-bs-hl]';
const STYLE_ID = 'bs-hl-style';
const supportsHighlights = (win) => Boolean(win?.CSS?.highlights && typeof win.Highlight === 'function');

/** Quita los subrayados pintados (marcas o resaltados) sin tocar el texto. */
export function clearHighlights(doc) {
  const win = doc.defaultView;
  if (supportsHighlights(win)) for (const key of [...win.CSS.highlights.keys()]) if (String(key).startsWith('bs-hl-')) win.CSS.highlights.delete(key);
  for (const mark of [...doc.querySelectorAll(MARK)]) {
    const parent = mark.parentNode;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    parent.normalize();
  }
  doc.getElementById(STYLE_ID)?.remove();
}

/** Envuelve el tramo de cada nodo de texto del rango en una marca (sin anidar ni partir enlaces o cursivas). */
function wrapRange(doc, range, id, color) {
  const nodes = textNodes(range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer : range.commonAncestorContainer.parentNode).filter((n) => range.intersectsNode(n));
  for (const n of nodes) {
    const from = n === range.startContainer ? range.startOffset : 0;
    const to = n === range.endContainer ? range.endOffset : n.data.length;
    if (to <= from || n.parentElement?.closest(MARK)) continue;
    let target = n;
    if (to < target.data.length) target.splitText(to);
    if (from > 0) target = target.splitText(from);
    const mark = doc.createElement('mark');
    mark.setAttribute('data-bs-hl', id);
    mark.style.backgroundColor = color;
    mark.style.color = 'inherit';
    target.parentNode.insertBefore(mark, target);
    mark.appendChild(target);
  }
}

/**
 * Pinta los subrayados de una sección. `items` = `[{ id, range, color }]` (rangos ya resueltos). Con la API de
 * resaltados se agrupan por color; si no, marcas. Devuelve la lista para poder saber qué subrayado se ha tocado.
 */
export function paintHighlights(doc, items) {
  clearHighlights(doc);
  const win = doc.defaultView;
  if (!items.length) return [];
  if (supportsHighlights(win)) {
    const groups = new Map();
    for (const it of items) {
      if (!groups.has(it.color)) groups.set(it.color, []);
      groups.get(it.color).push(it.range);
    }
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    let css = '';
    [...groups.entries()].forEach(([color, ranges], i) => {
      win.CSS.highlights.set(`bs-hl-${i}`, new win.Highlight(...ranges));
      css += `::highlight(bs-hl-${i}) { background-color: ${color}; }\n`;
    });
    style.textContent = css;
    doc.head.appendChild(style);
  } else {
    // De atrás hacia delante: partir nodos no invalida los rangos que quedan por pintar
    for (const it of [...items].reverse()) wrapRange(doc, it.range, it.id, it.color);
  }
  return items;
}

/** ¿Qué subrayado hay en este punto del texto? (un toque deja la selección contraída ahí). */
export function highlightAt(items, node, offset) {
  const mark = (node?.nodeType === 1 ? node : node?.parentElement)?.closest?.(MARK);
  if (mark) return mark.getAttribute('data-bs-hl');
  for (const it of items) {
    try {
      if (it.range.isPointInRange(node, offset)) return it.id;
    } catch {
      // punto de otro documento
    }
  }
  return null;
}
