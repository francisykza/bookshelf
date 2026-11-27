// Pruebas del encaje cover y del gesto del panorama (SPEC §16.4 y §16.6).
import { describe, expect, it } from 'vitest';
import { framingFor, fitCover, toImage, toScreen, visibleFraction } from '../../scene/stageFit';
import { MAIN_ROOM, SOCIAL_ROOM, swipeTarget } from '../../scene/panorama';

const ROOM = { width: 941, height: 1672, framing: [{ maxAspect: 0.62, x: 0.5, y: 0.5 }, { maxAspect: Infinity, x: 0.5, y: 0.79 }] };

describe('encaje cover', () => {
  it('scale = max(panelW / imgW, panelH / imgH) y la imagen cubre el panel', () => {
    for (const [w, h] of [[360, 800], [390, 844], [412, 915], [844, 390], [1440, 900]]) {
      const fit = fitCover(w, h, ROOM);
      expect(fit.scale).toBeCloseTo(Math.max(w / 941, h / 1672), 10);
      expect(fit.offsetX).toBeLessThanOrEqual(0);
      expect(fit.offsetY).toBeLessThanOrEqual(0);
      expect(fit.offsetX + 941 * fit.scale).toBeGreaterThanOrEqual(w - 1e-9);
      expect(fit.offsetY + 1672 * fit.scale).toBeGreaterThanOrEqual(h - 1e-9);
    }
  });

  it('con encuadre 0,5 el recorte queda centrado', () => {
    const fit = fitCover(390, 844, ROOM);
    expect(fit.offsetX).toBeCloseTo((390 - 941 * fit.scale) / 2, 10);
    expect(fit.offsetY).toBeCloseTo(0, 10);
  });

  it('el encuadre se elige por relación de aspecto', () => {
    expect(framingFor(ROOM.framing, 0.46).y).toBe(0.5);
    expect(framingFor(ROOM.framing, 1.6).y).toBe(0.79);
  });

  it('toScreen y toImage son inversas', () => {
    const fit = fitCover(844, 390, ROOM);
    const p = toScreen(fit, 812, 1166);
    const q = toImage(fit, p.x, p.y);
    expect(q.x).toBeCloseTo(812, 9);
    expect(q.y).toBeCloseTo(1166, 9);
  });

  it('mide qué parte de un objeto queda dentro del encuadre', () => {
    const fit = fitCover(1440, 900, ROOM);
    expect(visibleFraction(fit, [[0, 0], [100, 0], [100, 100], [0, 100]])).toBe(0);
    expect(visibleFraction(fit, [[300, 1000], [400, 1000], [400, 1100], [300, 1100]])).toBe(1);
  });
});

describe('gesto del panorama', () => {
  it('izquierda desde MAIN, derecha desde SOCIAL, sin bucle', () => {
    expect(swipeTarget(MAIN_ROOM, -60, 0)).toBe(SOCIAL_ROOM);
    expect(swipeTarget(SOCIAL_ROOM, 60, 0)).toBe(MAIN_ROOM);
    expect(swipeTarget(MAIN_ROOM, 60, 0)).toBeNull();
    expect(swipeTarget(SOCIAL_ROOM, -60, 0)).toBeNull();
  });

  it('49 px o un gesto vertical no cambian de habitación', () => {
    expect(swipeTarget(MAIN_ROOM, -49, 0)).toBeNull();
    expect(swipeTarget(MAIN_ROOM, -60, -50)).toBeNull();
    expect(swipeTarget(MAIN_ROOM, -130, -99)).toBe(SOCIAL_ROOM);
    expect(swipeTarget(MAIN_ROOM, -130, -100)).toBeNull();
  });
});
