// La imagen del corcho en la habitación: la composición entera, a escala, con los mismos papeles que el lienzo, en una textura estática.
// Se dibuja una vez por revisión y nunca por fotograma. Quien llama decide qué composición pasa: a un visitante solo le llega la copia pública.
import { anchorOf, boundsOf, centerOf, formatOf, PAPERS, INK, pinLocal, PIN_COLORS, THREADS } from './model';
import { dibujoCanvas } from './dibujo';

export const BOARD_W = 1536;
export const BOARD_H = 1152;
const HAND = "'Caveat', 'Segoe Print', cursive";
const TYPE = "'Courier Prime', 'Courier New', monospace";
const BOOK = "'Cormorant Garamond', Garamond, Georgia, serif";

// El corcho se pinta aquí y no desde el SVG: en WebKit, un SVG dibujado en un lienzo impide subirlo como textura
function paintCork(ctx) {
  ctx.fillStyle = '#AD794D';
  ctx.fillRect(0, 0, BOARD_W, BOARD_H);
  let seed = 7;
  const next = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const tones = ['#9A6840', '#BC8A5C', '#8F5F3A', '#C2946A'];
  for (let n = 0; n < 5200; n += 1) {
    ctx.fillStyle = tones[Math.floor(next() * tones.length)];
    ctx.fillRect(Math.floor(next() * BOARD_W), Math.floor(next() * BOARD_H), 3 + Math.floor(next() * 9), 2 + Math.floor(next() * 4));
  }
}

function wrap(ctx, text, maxW, maxLines) {
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxW && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) return lines;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines.slice(0, maxLines);
}

function paintPaper(ctx, item, format, w, h, scale) {
  const x = -w / 2;
  const y = -h / 2;
  ctx.fillStyle = 'rgba(47,28,18,.42)';
  ctx.fillRect(x + 5 * scale, y + 7 * scale, w, h);
  if (format === 'correo') {
    const band = 12 * scale;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillStyle = '#fbf5e6';
    ctx.fillRect(x, y, w, h);
    for (let k = -h; k < w + h; k += band * 2) {
      ctx.fillStyle = Math.round(k / (band * 2)) % 2 ? '#2e6a86' : '#b23a2a';
      ctx.beginPath();
      ctx.moveTo(x + k, y + h);
      ctx.lineTo(x + k + band, y + h);
      ctx.lineTo(x + k + band + h, y);
      ctx.lineTo(x + k + h, y);
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = PAPERS[item.paper] ?? PAPERS.crema;
    ctx.fillRect(x + 9 * scale, y + 9 * scale, w - 18 * scale, h - 18 * scale);
    return;
  }
  ctx.fillStyle = format === 'libro' ? '#fbf5e6' : (PAPERS[item.paper] ?? PAPERS.crema);
  ctx.fillRect(x, y, w, h);
  if (format === 'rayada') {
    ctx.fillStyle = 'rgba(74,116,136,.42)';
    for (let l = 54 * scale; l < h; l += 32 * scale) ctx.fillRect(x, y + l, w, Math.max(1, 2 * scale));
    ctx.fillStyle = 'rgba(178,58,42,.5)';
    ctx.fillRect(x + 26 * scale, y, Math.max(1, 2 * scale), h);
  } else if (format === 'ficha') {
    ctx.fillStyle = '#b23a2a';
    ctx.fillRect(x, y + 38 * scale, w, Math.max(1.5, 3 * scale));
  }
}

/** `doc`: { items, edges }. `unread`: solo para el dueño, una chincheta dorada en la esquina. */
export async function drawBoard(doc, { unread = false } = {}) {
  await Promise.all([`32px ${HAND}`, `20px ${TYPE}`, `700 24px ${BOOK}`].map((f) => document.fonts?.load?.(f).catch(() => null)));
  const canvas = document.createElement('canvas');
  canvas.width = BOARD_W;
  canvas.height = BOARD_H;
  const ctx = canvas.getContext('2d');
  paintCork(ctx);
  const items = doc?.items ?? [];
  if (items.length) {
    const b = boundsOf(items);
    const scale = Math.min((BOARD_W - 70) / b.w, (BOARD_H - 70) / b.h, 1.7);
    const ox = (BOARD_W - b.w * scale) / 2 - b.x * scale;
    const oy = (BOARD_H - b.h * scale) / 2 - b.y * scale;
    const at = (p) => [p.x * scale + ox, p.y * scale + oy];
    const byId = new Map(items.map((i) => [i.id, i]));
    for (const e of doc.edges ?? []) {
      const s = byId.get(e.source_item_id);
      const t = byId.get(e.target_item_id);
      if (!s || !t) continue;
      const [ax, ay] = at(anchorOf(s, e.source_anchor));
      const [bx, by] = at(anchorOf(t, e.target_anchor));
      for (const [color, off] of [['rgba(47,28,18,.4)', 4], [THREADS[e.color] ?? THREADS.terracota, 0]]) {
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(2.5, 4 * scale);
        ctx.beginPath();
        ctx.moveTo(ax + off, ay + off);
        ctx.quadraticCurveTo((ax + bx) / 2 + off, (ay + by) / 2 + off + 40 * scale, bx + off, by + off);
        ctx.stroke();
      }
    }
    for (const i of [...items].sort((a, c) => a.z - c.z)) {
      const [cx, cy] = at(centerOf(i));
      const w = i.width * scale;
      const h = i.height * scale;
      const format = formatOf(i);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((i.rotation * Math.PI) / 180);
      const clavo = pinLocal(i);
      const pinX = clavo ? clavo.x * scale - w / 2 : 0;
      const pinY = clavo ? clavo.y * scale - h / 2 : -h / 2;
      if (format === 'dibujo') {
        const lado = Math.min(w, h);
        if (i.recortado) {
          ctx.shadowColor = 'rgba(47,28,18,.42)';
          ctx.shadowOffsetX = 5 * scale;
          ctx.shadowOffsetY = 7 * scale;
        } else paintPaper(ctx, i, format, w, h, scale);
        ctx.drawImage(dibujoCanvas(i.dibujo, i.recortado), -lado / 2, -lado / 2, lado, lado);
        ctx.shadowColor = 'transparent';
      } else {
      paintPaper(ctx, i, format, w, h, scale);
      ctx.fillStyle = INK;
      ctx.textBaseline = 'top';
      const hidden = i.retirada || i.spoiler;
      const text = i.retirada ? 'Nota retirada' : i.spoiler ? 'Spoiler' : i.body;
      const pad = (format === 'rayada' ? 36 : 18) * scale;
      const top = (format === 'ficha' ? 46 : 26) * scale;
      if (format === 'libro' && !hidden) {
        ctx.fillStyle = '#4c6a55';
        ctx.fillRect(-w / 2 + 14 * scale, -h / 2 + 18 * scale, w - 28 * scale, h - 72 * scale);
        ctx.fillStyle = INK;
        ctx.font = `700 ${24 * scale}px ${BOOK}`;
        ctx.fillText(wrap(ctx, text, w - 28 * scale, 1)[0] ?? '', -w / 2 + 14 * scale, h / 2 - 46 * scale);
      } else {
        const size = (format === 'cita' ? 20 : 30) * scale;
        ctx.font = `${size}px ${format === 'cita' ? TYPE : HAND}`;
        const lh = size * 1.12;
        wrap(ctx, text, w - pad * 1.6, Math.max(1, Math.floor((h - top - 10 * scale) / lh))).forEach((l, n) => ctx.fillText(l, -w / 2 + pad, -h / 2 + top + n * lh));
      }
      }
      ctx.fillStyle = 'rgba(47,28,18,.45)';
      ctx.beginPath();
      ctx.arc(pinX + 3 * scale, pinY + 4 * scale, 11 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PIN_COLORS[i.pin] ?? PIN_COLORS.laton;
      ctx.beginPath();
      ctx.arc(pinX, pinY, 11 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  if (unread) {
    ctx.fillStyle = '#E8B93A';
    ctx.beginPath();
    ctx.arc(BOARD_W - 44, 44, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8A6420';
    ctx.beginPath();
    ctx.arc(BOARD_W - 50, 38, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas;
}
