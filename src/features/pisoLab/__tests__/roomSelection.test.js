import { describe, expect, it } from 'vitest';
import { spineQueue } from '../../../domain/roomShelf';
import { ROOM_LIMIT, chosenIds, firstOf, roomLimit, roomSelection, toggleExhibit } from '../roomSelection';
import { shelfRows } from '../shelfLayout';
import { COPY_KEY, MARK_KEY, PRODUCTION_HOST, SAMPLE_SIZES, sampleBooks, sampleState, seedPilotLibrary } from '../sampleLibrary';

const memoryStore = (seed = {}) => {
  const map = new Map(Object.entries(seed));
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, v), removeItem: (k) => map.delete(k), map };
};

describe('la selección de la habitación', () => {
  it('el límite empieza en 30 y se puede cambiar para probar', () => {
    expect(ROOM_LIMIT).toBe(30);
    expect(roomLimit('')).toBe(30);
    expect(roomLimit('?visibles=12')).toBe(12);
    expect(roomLimit('?visibles=0')).toBe(30);
    expect(roomLimit('?visibles=abc')).toBe(30);
    expect(roomLimit('?visibles=99999')).toBe(30);
  });

  it('nunca pasa del límite, sea cual sea el tamaño', () => {
    for (const n of SAMPLE_SIZES) expect(roomSelection(sampleBooks(n), {}).length).toBe(Math.min(n, 30));
    const { rows, placed } = shelfRows(sampleBooks(5000), sampleState(5000).settings);
    expect(rows.flat().length + 1).toBeLessThanOrEqual(30);
    expect(placed.size).toBe(rows.flat().length + 1);
  });

  it('empieza por las lecturas actuales y sigue con los elegidos', () => {
    const { books, settings } = sampleState(1000);
    const ids = roomSelection(books, settings, 30, 'lab-0').map((b) => b.id);
    expect(ids.slice(0, 2)).toEqual(expect.arrayContaining(['lab-1', 'lab-2']));
    expect(ids.slice(2, 5)).toEqual(['lab-10', 'lab-20', 'lab-30']);
    expect(ids).not.toContain('lab-0');
  });

  it('el resto sale en el mismo orden que con la biblioteca entera', () => {
    const books = sampleBooks(1000);
    const whole = spineQueue(books, {}, 'lab-0')
      .slice(0, 29)
      .map((b) => b.id);
    expect(roomSelection(books, {}, 30, 'lab-0').map((b) => b.id)).toEqual(whole);
  });

  it('un elegido que ya no está no ocupa sitio', () => {
    const ids = roomSelection(sampleBooks(5), { roomExhibit: ['borrado'] }, 30).map((b) => b.id);
    expect(ids).toHaveLength(5);
    expect(ids).not.toContain('borrado');
  });

  it('firstOf coincide con ordenar y cortar', () => {
    const list = [5, 1, 9, 3, 7, 2, 8, 4, 6, 0];
    expect(firstOf(list, (a, b) => a - b, 3)).toEqual([0, 1, 2]);
    expect(firstOf(list, (a, b) => a - b, 30)).toHaveLength(10);
  });
});

describe('exponer', () => {
  it('solo cambia los ajustes de exposición y se puede deshacer', () => {
    const settings = { roomFeaturedId: 'a', roomExhibit: ['b'] };
    expect(Object.keys(toggleExhibit(settings, 'c'))).toEqual(['roomExhibit']);
    expect(toggleExhibit(settings, 'c').roomExhibit).toEqual(['b', 'c']);
    expect(toggleExhibit(settings, 'b').roomExhibit).toEqual([]);
    expect(toggleExhibit(settings, 'a')).toEqual({ roomFeaturedId: null });
    expect(chosenIds(settings)).toEqual(['a', 'b']);
  });

  it('con la selección llena no añade más', () => {
    const roomExhibit = Array.from({ length: 29 }, (_, i) => `b${i}`);
    expect(toggleExhibit({ roomExhibit }, 'otro', 30)).toBeNull();
    expect(toggleExhibit({ roomExhibit }, 'b3', 30).roomExhibit).toHaveLength(28);
  });
});

describe('las bibliotecas de prueba', () => {
  it('son siempre las mismas y la pequeña es el principio de la grande', () => {
    expect(sampleBooks(1000)).toEqual(sampleBooks(1000));
    expect(sampleBooks(50)).toEqual(sampleBooks(1000).slice(0, 50));
    const ids = new Set(sampleBooks(5000).map((b) => b.id));
    expect(ids.size).toBe(5000);
    expect(sampleBooks(5000)[4999].title).toContain('n.º 5000');
  });

  it('mezclan portadas buenas, ausentes y que fallan, y todos los estados', () => {
    const books = sampleBooks(1000);
    const good = books.filter((b) => /covers\/c\d/.test(b.cover)).length;
    const none = books.filter((b) => !b.cover).length;
    expect(good).toBeGreaterThan(500);
    expect(none).toBeGreaterThan(150);
    expect(1000 - good - none).toBeGreaterThan(80);
    expect(new Set(books.map((b) => b.status))).toEqual(new Set(['reading', 'read', 'want', 'abandoned']));
  });

  const place = (search, hostname = 'bookshelf-git-piso.vercel.app') => ({ search, hostname });

  it('nunca se siembran en producción', () => {
    const store = memoryStore({ 'bookshelf:v1': 'míos' });
    expect(seedPilotLibrary(place('?piloto=piso&biblioteca=50', PRODUCTION_HOST), store)).toBe(false);
    expect(store.getItem('bookshelf:v1')).toBe('míos');
  });

  it('sin pedirlo no hacen nada', () => {
    const store = memoryStore({ 'bookshelf:v1': 'míos' });
    expect(seedPilotLibrary(place('?piloto=piso'), store)).toBe(false);
    expect(seedPilotLibrary(place('?biblioteca=50'), store)).toBe(false);
    expect(seedPilotLibrary(place('?piloto=piso&biblioteca=7'), store)).toBe(false);
    expect(store.getItem('bookshelf:v1')).toBe('míos');
  });

  it('guardan lo que hubiera y lo devuelven', () => {
    const store = memoryStore({ 'bookshelf:v1': 'míos' });
    expect(seedPilotLibrary(place('?piloto=piso&biblioteca=50'), store)).toBe(true);
    expect(store.getItem(COPY_KEY)).toBe('míos');
    expect(store.getItem(MARK_KEY)).toBe('50');
    expect(JSON.parse(store.getItem('bookshelf:v1')).books).toHaveLength(50);
    // Cambiar de tamaño no pisa la copia
    expect(seedPilotLibrary(place('?piloto=piso&biblioteca=0'), store)).toBe(true);
    expect(store.getItem(COPY_KEY)).toBe('míos');
    expect(seedPilotLibrary(place('?piloto=piso&biblioteca=propia'), store)).toBe(true);
    expect(store.getItem('bookshelf:v1')).toBe('míos');
    expect(store.getItem(MARK_KEY)).toBeNull();
  });

  it('recargar no borra lo registrado', () => {
    const store = memoryStore();
    seedPilotLibrary(place('?piloto=piso&biblioteca=50'), store);
    store.setItem('bookshelf:v1', 'con cambios');
    expect(seedPilotLibrary(place('?piloto=piso&biblioteca=50'), store)).toBe(false);
    expect(store.getItem('bookshelf:v1')).toBe('con cambios');
  });
});
