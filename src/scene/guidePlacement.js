// Colocación de la guía (SPEC §16, Anexo B6): anclas con la misma transformación del escenario y tarjetas que
// nunca salen del viewport seguro. Funciones puras salvo `safeAreas`, que lee las variables CSS de env().
import { HOTSPOTS } from './sceneMap';
import { toScreen } from './stageFit';

const MARGIN = 16;
/** Zona reservada arriba para la esquina de controles generales. */
const TOP_RESERVE = 60;

/** Áreas seguras del dispositivo (env()) leídas de variables CSS. */
export function safeAreas() {
  const cs = getComputedStyle(document.documentElement);
  const v = (name) => parseFloat(cs.getPropertyValue(name)) || 0;
  return { top: v('--sat'), right: v('--sar'), bottom: v('--sab'), left: v('--sal') };
}

/** Centro de la caja del hotspot en pantalla (relativo al panel). */
export function anchorPoint(fit, id) {
  const shape = HOTSPOTS[id]?.shape;
  if (!shape) return null;
  const xs = shape.map((p) => p[0]);
  const ys = shape.map((p) => p[1]);
  return toScreen(fit, (Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2);
}

/** Posición de la tarjeta: encima o debajo del ancla, centrada, siempre dentro del viewport seguro. */
export function placeCard(fit, point, size, safe) {
  const minX = MARGIN + safe.left;
  const maxX = fit.panelW - MARGIN - safe.right - size.w;
  const minY = Math.max(TOP_RESERVE, MARGIN + safe.top);
  const maxY = fit.panelH - MARGIN - safe.bottom - size.h;
  const clampX = (x) => Math.max(minX, Math.min(maxX, x));
  const clampY = (y) => Math.max(minY, Math.min(maxY, y));
  const inside = point && point.x >= 0 && point.x <= fit.panelW && point.y >= 0 && point.y <= fit.panelH;
  if (!inside) return { x: clampX((fit.panelW - size.w) / 2), y: clampY((fit.panelH - size.h) / 2), firefly: point ? { x: Math.max(minX, Math.min(fit.panelW - MARGIN, point.x)), y: Math.max(minY, Math.min(fit.panelH - MARGIN, point.y)) } : null };
  const gap = 28;
  const above = point.y - gap - size.h;
  const below = point.y + gap;
  const y = point.y > fit.panelH / 2 ? (above >= minY ? above : below) : below <= maxY ? below : above;
  return { x: clampX(point.x - size.w / 2), y: clampY(y), firefly: point };
}
