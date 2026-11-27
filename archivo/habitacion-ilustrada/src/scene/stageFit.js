// Encaje de una ilustración en su panel (SPEC §16.4, Fase 1): una única transformación de escala y
// desplazamiento para la imagen, los overlays y los hotspots. Cubre el panel sin deformar (cover) y reparte el
// recorte según el encuadre de la habitación para cada relación de aspecto. Funciones puras, en px CSS.

/** Encuadre según la relación de aspecto del panel: fracción del sobrante que se recorta por la izquierda/arriba. */
export function framingFor(framing, aspect) {
  const list = framing ?? [];
  return list.find((f) => aspect <= f.maxAspect) ?? list[list.length - 1] ?? { x: 0.5, y: 0.5 };
}

/**
 * scale = max(panelW / imgW, panelH / imgH); el sobrante (≤ 0) se reparte con el encuadre (0,5 = centrado).
 * Devuelve escala, desplazamiento y el rectángulo visible de la imagen (en px de imagen).
 */
export function fitCover(panelW, panelH, room) {
  const w = Math.max(1, panelW);
  const h = Math.max(1, panelH);
  const scale = Math.max(w / room.width, h / room.height);
  const f = framingFor(room.framing, w / h);
  const offsetX = (w - room.width * scale) * f.x;
  const offsetY = (h - room.height * scale) * f.y;
  return {
    panelW: w,
    panelH: h,
    scale,
    offsetX,
    offsetY,
    visible: { x: -offsetX / scale, y: -offsetY / scale, w: w / scale, h: h / scale },
  };
}

/** Punto de la imagen → pantalla (relativo al panel). */
export const toScreen = (fit, x, y) => ({ x: fit.offsetX + x * fit.scale, y: fit.offsetY + y * fit.scale });

/** Pantalla (relativa al panel) → punto de la imagen (diagnóstico). */
export const toImage = (fit, x, y) => ({ x: (x - fit.offsetX) / fit.scale, y: (y - fit.offsetY) / fit.scale });

/** Transformación CSS del escenario (`transform-origin: 0 0`). */
export const stageTransform = (fit) => `translate(${round(fit.offsetX)}px, ${round(fit.offsetY)}px) scale(${fit.scale})`;
const round = (n) => Math.round(n * 100) / 100 || 0;

/** ¿Cuánto de un polígono queda dentro del rectángulo visible? 1 = entero, 0 = fuera del todo. */
export function visibleFraction(fit, shape) {
  const xs = shape.map((p) => p[0]);
  const ys = shape.map((p) => p[1]);
  const box = { x: Math.min(...xs), y: Math.min(...ys), r: Math.max(...xs), b: Math.max(...ys) };
  const v = fit.visible;
  const iw = Math.max(0, Math.min(box.r, v.x + v.w) - Math.max(box.x, v.x));
  const ih = Math.max(0, Math.min(box.b, v.y + v.h) - Math.max(box.y, v.y));
  const area = Math.max(1, (box.r - box.x) * (box.b - box.y));
  return (iw * ih) / area;
}
