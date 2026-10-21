// Pruebas de la cámara de la habitación (SPEC §12.2): cover en móvil sin deformar, límites del desplazamiento,
// centro lógico conservado al rotar y objeto enfocado traído a la vista.
import { describe, expect, it } from 'vitest';
import { cameraCss, clampOffset, fitCamera, logicalCenter, offsetCentering, offsetShowing } from '../../scene/camera';

describe('cámara', () => {
  it('en móvil cubre el viewport sin deformar la ilustración', () => {
    const cam = fitCamera(390, 844);
    expect(cam.cover).toBe(true);
    expect(cam.rw).toBeGreaterThanOrEqual(390);
    expect(cam.rh).toBeGreaterThanOrEqual(844);
    expect(cam.rw / cam.rh).toBeCloseTo(984 / 1599, 6);
  });

  it('en escritorio se ve entera (contain) y centrada', () => {
    const cam = fitCamera(1440, 900);
    expect(cam.cover).toBe(false);
    expect(cam.rh).toBeCloseTo(900, 6);
    expect(clampOffset(cam, -500, 300)).toEqual({ x: cam.centerX, y: cam.centerY });
  });

  it('acota el desplazamiento a vw − anchoRenderizado ≤ x ≤ 0', () => {
    const cam = fitCamera(390, 844);
    expect(clampOffset(cam, 50, 50)).toEqual({ x: 0, y: 0 });
    expect(clampOffset(cam, -9999, -9999)).toEqual({ x: cam.minX, y: cam.minY });
    expect(cam.minX).toBeCloseTo(390 - cam.rw, 6);
  });

  it('conserva el centro lógico al rotar', () => {
    const portrait = fitCamera(390, 844);
    const offset = offsetCentering(portrait, { x: 300, y: 900 });
    const center = logicalCenter(portrait, offset);
    const back = offsetCentering(fitCamera(412, 915), center);
    const again = logicalCenter(fitCamera(412, 915), back);
    expect(again.x).toBeCloseTo(center.x, 0);
    expect(again.y).toBeCloseTo(center.y, 0);
  });

  it('trae a la vista un objeto enfocado con 16 px de margen, dentro de los límites', () => {
    const cam = fitCamera(390, 844);
    const offset = { x: 0, y: 0 };
    const next = offsetShowing(cam, offset, { left: 380, right: 420, top: 100, bottom: 140 }, 16);
    expect(next.x).toBeCloseTo(-(420 - (390 - 16)), 6);
    expect(offsetShowing(cam, offset, { left: 5000, right: 5040, top: 0, bottom: 10 }, 16).x).toBeCloseTo(cam.minX, 6);
  });

  it('la transformación usa translate + scale con origen en la esquina', () => {
    const cam = fitCamera(390, 844);
    expect(cameraCss(cam, { x: -10.123, y: 0 })).toBe(`translate(-10.12px, 0px) scale(${cam.scale})`);
  });
});
