// Parte de v128.test.js (1.28 y 1.29) que probaba la habitación ilustrada: el temporizador junto al borde y los lomos.
import { describe, expect, it } from 'vitest';
import { placeAnnotation } from '../../scene/guidePlacement';

describe('temporizador junto al borde: márgenes mínimos', () => {
  it('se limita a max(12 px, área segura) por cada lado', () => {
    expect(placeAnnotation({ w: 390, h: 844 }, { x: 385, y: 560 }, { w: 80, h: 44 }, { top: 0, right: 0, bottom: 0, left: 0 })).toEqual({ x: 298, y: 504 });
    expect(placeAnnotation({ w: 844, h: 390 }, { x: 840, y: 20 }, { w: 80, h: 44 }, { top: 0, right: 47, bottom: 21, left: 47 })).toEqual({ x: 717, y: 12 });
  });
});

describe('1.29.0 · texturas de lomo sin deformaciones extremas', async () => {
  const { MAX_STRETCH, spineArtSize } = await import('../spineArt');
  it('estira como mucho 1,35 y recorta el resto, siempre cubriendo el lomo', () => {
    const ratio = 0.19;
    for (const [w, h] of [[5, 100], [12, 100], [19, 100], [24, 100], [40, 100]]) {
      const s = spineArtSize(w, h, ratio);
      expect(s.w).toBeGreaterThanOrEqual(w - 1e-9);
      expect(s.h).toBeGreaterThanOrEqual(h - 1e-9);
      const stretch = s.w / s.h / ratio;
      expect(stretch).toBeLessThanOrEqual(MAX_STRETCH + 1e-9);
      expect(stretch).toBeGreaterThanOrEqual(1 / MAX_STRETCH - 1e-9);
    }
    expect(spineArtSize(19, 100, ratio)).toEqual({ w: 19, h: 100 });
  });
});
