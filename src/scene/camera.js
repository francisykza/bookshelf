// Cámara de la habitación (SPEC §12.2, 1.18.0): una sola transformación para todas las capas. En móvil la
// ilustración cubre la pantalla (cover) y se puede desplazar dentro de sus límites; en escritorio se ve
// entera (contain). Funciones puras: medidas del viewport en px CSS, escena en px lógicos.
import { SCENE_H, SCENE_W } from './sceneMap';

export const MOBILE_MAX = 760;

/** Escala, tamaño renderizado y límites del desplazamiento para un viewport. */
export function fitCamera(vw, vh) {
  const cover = vw <= MOBILE_MAX;
  const scale = cover ? Math.max(vw / SCENE_W, vh / SCENE_H) : Math.min(vw / SCENE_W, vh / SCENE_H);
  const rw = SCENE_W * scale;
  const rh = SCENE_H * scale;
  return {
    cover,
    scale,
    vw,
    vh,
    rw,
    rh,
    // Límites del desplazamiento en cover: vw − rw ≤ x ≤ 0 y vh − rh ≤ y ≤ 0
    minX: Math.min(0, vw - rw),
    minY: Math.min(0, vh - rh),
    centerX: (vw - rw) / 2,
    centerY: (vh - rh) / 2,
  };
}

/** Desplazamiento dentro de los límites (en contain, siempre centrado). */
export function clampOffset(cam, x, y) {
  if (!cam.cover) return { x: cam.centerX, y: cam.centerY };
  return { x: Math.min(0, Math.max(cam.minX, x)), y: Math.min(0, Math.max(cam.minY, y)) };
}

/** Punto lógico de la escena que está en el centro del viewport. */
export const logicalCenter = (cam, offset) => ({ x: (cam.vw / 2 - offset.x) / cam.scale, y: (cam.vh / 2 - offset.y) / cam.scale });

/** Desplazamiento que deja el punto lógico `p` en el centro del viewport (acotado). */
export const offsetCentering = (cam, p) => clampOffset(cam, cam.vw / 2 - p.x * cam.scale, cam.vh / 2 - p.y * cam.scale);

/** Desplazamiento mínimo para que un rectángulo de pantalla quede visible con `margin` px. */
export function offsetShowing(cam, offset, rect, margin = 16) {
  let { x, y } = offset;
  if (rect.left < margin) x += margin - rect.left;
  else if (rect.right > cam.vw - margin) x -= rect.right - (cam.vw - margin);
  if (rect.top < margin) y += margin - rect.top;
  else if (rect.bottom > cam.vh - margin) y -= rect.bottom - (cam.vh - margin);
  return clampOffset(cam, x, y);
}

/** Transformación CSS de la cámara (`transform-origin: 0 0`). */
export function cameraCss(cam, offset, shelf = null) {
  if (shelf) {
    // Escritorio, acercándose a la estantería: el foco al centro, ampliado y con un leve giro
    const s = cam.scale * shelf.zoom;
    return `translate(${cam.vw / 2}px, ${cam.vh / 2}px) scale(${s}) rotateY(7deg) translate(${-shelf.x}px, ${-shelf.y}px)`;
  }
  const r = (n) => Math.round(n * 100) / 100 || 0;
  return `translate(${r(offset.x)}px, ${r(offset.y)}px) scale(${cam.scale})`;
}
