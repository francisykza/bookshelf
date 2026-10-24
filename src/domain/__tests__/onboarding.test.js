// Onboarding (SPEC §16, Anexo B): máquina de estados por fases, almacenamiento con respaldo en memoria y
// colocación de la tarjeta dentro del viewport seguro.
import { describe, expect, it } from 'vitest';
import { ONBOARDING_KEY, STATES, back, createDoneStore, isLast, isStop, next, route } from '../onboarding';
import { placeCard } from '../../scene/guidePlacement';

describe('máquina de estados', () => {
  it('declara todos los estados en orden', () => {
    expect(STATES).toEqual(['idle', 'welcome', 'reading', 'habits', 'social', 'gift', 'completed']);
  });

  it('Fase 1: bienvenida, lectura y rituales; luego termina', () => {
    expect(route(1)).toEqual(['welcome', 'reading', 'habits']);
    expect(next('idle', 1)).toBe('welcome');
    expect(next('welcome', 1)).toBe('reading');
    expect(next('reading', 1)).toBe('habits');
    expect(next('habits', 1)).toBe('completed');
    expect(isLast('habits', 1)).toBe(true);
    expect(isStop('social', 1)).toBe(false);
  });

  it('Fases 2 y 3 añaden la parada social y la del regalo sin cambiar el inicio', () => {
    expect(route(2)).toEqual(['welcome', 'reading', 'habits', 'social']);
    expect(route(3)).toEqual(['welcome', 'reading', 'habits', 'social', 'gift']);
    expect(next('habits', 2)).toBe('social');
    expect(next('gift', 3)).toBe('completed');
  });

  it('Atrás no sale de la bienvenida', () => {
    expect(back('welcome', 1)).toBe('welcome');
    expect(back('habits', 1)).toBe('reading');
  });
});

describe('almacén de finalización', () => {
  const memoryStorage = () => {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
  };

  it('guarda la finalización en la clave local', () => {
    const storage = memoryStorage();
    const store = createDoneStore(() => storage);
    expect(store.isDone()).toBe(false);
    expect(store.markDone()).toBe(true);
    expect(storage.getItem(ONBOARDING_KEY)).toBe('true');
    expect(createDoneStore(() => storage).isDone()).toBe(true);
  });

  it('con localStorage bloqueado no lanza y recuerda en memoria durante la sesión', () => {
    const blocked = {
      getItem() {
        throw new Error('SecurityError');
      },
      setItem() {
        throw new Error('SecurityError');
      },
    };
    const store = createDoneStore(() => blocked);
    expect(store.isDone()).toBe(false);
    expect(store.markDone()).toBe(false);
    expect(store.isDone()).toBe(true);
  });
});

describe('colocación de la tarjeta', () => {
  const safe = { top: 0, right: 0, bottom: 0, left: 0 };
  const fit = { panelW: 390, panelH: 844 };
  const size = { w: 320, h: 200 };

  it('se queda dentro del viewport seguro aunque el ancla esté en un borde', () => {
    for (const point of [{ x: 5, y: 830 }, { x: 385, y: 20 }, { x: 195, y: 422 }]) {
      const p = placeCard(fit, point, size, safe);
      expect(p.x).toBeGreaterThanOrEqual(16);
      expect(p.x + size.w).toBeLessThanOrEqual(390 - 16);
      expect(p.y).toBeGreaterThanOrEqual(60);
      expect(p.y + size.h).toBeLessThanOrEqual(844 - 16);
    }
  });

  it('con el ancla fuera de pantalla, centra la tarjeta y deja la luciérnaga en el borde', () => {
    const p = placeCard({ panelW: 1440, panelH: 900 }, { x: 200, y: -400 }, size, safe);
    expect(p.y).toBeGreaterThanOrEqual(60);
    expect(p.firefly.y).toBeGreaterThanOrEqual(0);
    expect(p.firefly.y).toBeLessThanOrEqual(900);
  });

  it('respeta las áreas seguras', () => {
    const p = placeCard(fit, { x: 195, y: 800 }, size, { top: 47, right: 0, bottom: 34, left: 0 });
    expect(p.y + size.h).toBeLessThanOrEqual(844 - 16 - 34);
  });
});
