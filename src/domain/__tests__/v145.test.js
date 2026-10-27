// 1.45.0 (SPEC §37): catálogo con las dos figuras nuevas y las cuatro posiciones de las baldas.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizeCatalog } from '../figureCatalog';
import { placeOnShelf, removeFromShelf, roomDisplay, roomPresentations, setSlotDisplay, shelfSlots } from '../figures';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const json = JSON.parse(readFileSync(join(ROOT, 'public/figures/catalog.json'), 'utf8'));
const catalog = normalizeCatalog(json).figures;
const fig = (id) => catalog.find((f) => f.id === id);

describe('catálogo 1.45', () => {
  it('las dos figuras nuevas entran sin errores, con 5 sellos y 5 piezas dentro de su caja', () => {
    expect(normalizeCatalog(json).errors).toEqual([]);
    for (const id of ['guardian_clavos', 'maestro_superviviente']) {
      const f = fig(id);
      expect(f.boxAlpha).toBe(true);
      expect(f.loreSeals).toHaveLength(5);
      expect(f.parts).toHaveLength(5);
      expect(f.parts.every((p) => p.crop)).toBe(true);
      expect(roomPresentations(f)).toEqual({ box: true, unboxed: true });
    }
  });

  it('las cajas fotografiadas antiguas y los personajes planos no se exponen en la habitación', () => {
    expect(roomDisplay(fig('dama_ceniza'), 'box')).toBe(null);
    expect(roomDisplay(fig('viajero_asteroide'), 'unboxed')).toBe(null);
  });

  it('la Dama sigue siendo la figura de su saga para los libros de Mistborn (las nuevas van detrás)', () => {
    expect(catalog.findIndex((f) => f.id === 'dama_ceniza')).toBeLessThan(catalog.findIndex((f) => f.id === 'guardian_clavos'));
  });
});

describe('posiciones de las baldas', () => {
  const owned = { guardian_clavos: { obtainedAt: '2026-01-01' }, maestro_superviviente: { obtainedAt: '2026-02-01' }, dama_ceniza: { obtainedAt: '2025-01-01' } };

  it('sin elección: lo que tienes con recurso, en orden de llegada; nada de lo que no tienes', () => {
    const s = shelfSlots({ owned, guardian: 'dama_ceniza', shelf: null }, catalog);
    expect(s.map((x) => x?.id ?? null)).toEqual(['guardian_clavos', 'maestro_superviviente', null, null]);
    expect(shelfSlots({ owned: {}, shelf: null }, catalog).every((x) => x === null)).toBe(true);
  });

  it('una posición guardada con una figura que ya no tienes queda vacía', () => {
    const s = shelfSlots({ owned: { guardian_clavos: {} }, shelf: [{ id: 'maestro_superviviente', display: 'box' }, null, { id: 'guardian_clavos', display: 'unboxed' }, null] }, catalog);
    expect(s).toEqual([null, null, { id: 'guardian_clavos', display: 'unboxed' }, null]);
  });

  it('mover, intercambiar, sustituir y guardar en el ático nunca pierden figuras', () => {
    const start = [{ id: 'a', display: 'box' }, { id: 'b', display: 'unboxed' }, null, null];
    expect(placeOnShelf(start, 'a', null, 3)).toEqual([null, { id: 'b', display: 'unboxed' }, null, { id: 'a', display: 'box' }]);
    expect(placeOnShelf(start, 'a', null, 1, 'swap')).toEqual([{ id: 'b', display: 'unboxed' }, { id: 'a', display: 'box' }, null, null]);
    expect(placeOnShelf(start, 'a', null, 1, 'replace')).toEqual([null, { id: 'a', display: 'box' }, null, null]);
    expect(placeOnShelf(start, 'c', 'unboxed', 2)[2]).toEqual({ id: 'c', display: 'unboxed' });
    expect(setSlotDisplay(start, 'a', 'unboxed')[0]).toEqual({ id: 'a', display: 'unboxed' });
    expect(removeFromShelf(start, 'b')).toEqual([{ id: 'a', display: 'box' }, null, null, null]);
  });
});
