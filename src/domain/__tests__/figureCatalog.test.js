// Pruebas del contrato del catálogo de figuras (SPEC §11.7): alias antiguos y campos canónicos, validación
// aislada por entrada, vinculación por saga/título sin falsos positivos por autor, conservación del
// inventario y recuperación tras un fallo de carga.
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createCatalogLoader, figureForBook, normalizeCatalog, normalizeFigure } from '../figureCatalog';
import { EMPTY_FIGURES, openMysteryBox, rankOf } from '../figures';
import { PRESET_SAGAS } from '../sagas';

const realCatalog = JSON.parse(readFileSync(new URL('../../../public/figures/catalog.json', import.meta.url), 'utf8'));
const silentLog = { warn: () => {} };

const legacyEntry = {
  id: 'dama_ceniza',
  name: 'La Dama de la Ceniza',
  sagaTitle: 'Nacidos de la Bruma',
  matchKeywords: ['mistborn', 'imperio final'],
  rarity: 'legendary',
  starter: true,
  accent: '#c9d2dc',
  particles: 'mist',
  boxImage: 'dama-ceniza-box.jpg',
  unboxedImage: 'dama-ceniza-box.jpg',
  loreSeals: ['BRUMA', 'ACERO', 'LIBERTAD', 'SECRETOS', 'CENIZA'],
  blisterParts: [{ name: 'Rostro', kind: 'face', crop: { x: 10, y: 10, w: 50, h: 50 } }],
};

const canonicalEntry = {
  id: 'nueva',
  name: 'Figura Nueva',
  sagaTitle: 'Saga Nueva',
  subtitle: 'Edición de prueba',
  matchKeywords: ['saga nueva'],
  rarity: 'epic',
  unlockedByDefault: false,
  accentColor: '#AA5500',
  secondaryColor: '#123456',
  particlePreset: 'wind',
  boxImage: 'nueva-box.png',
  unboxedImage: 'nueva-figure.webp',
  unboxedSize: { w: 600, h: 900 },
  loreSeals: ['A', 'B', 'C', 'D', 'E'],
  blisterParts: ['1', '2', '3', '4', '5'],
  since: 2,
};

describe('normalización del catálogo', () => {
  it('acepta los alias antiguos', () => {
    const { figure } = normalizeFigure(legacyEntry, { imageSize: { w: 1024, h: 1536 } });
    expect(figure.unlockedByDefault).toBe(true);
    expect(figure.accentColor).toBe('#c9d2dc');
    expect(figure.particlePreset).toBe('mist');
    expect(figure.secondaryColor).toBe('#C59B27');
    expect(figure.subtitle).toBe('');
    // Los alias internos siguen ahí para los consumidores actuales
    expect(figure.starter).toBe(true);
    expect(figure.accent).toBe('#c9d2dc');
    expect(figure.particles).toBe('mist');
  });

  it('interpreta los campos canónicos', () => {
    const { figure, error } = normalizeFigure(canonicalEntry);
    expect(error).toBeUndefined();
    expect(figure).toMatchObject({ subtitle: 'Edición de prueba', accentColor: '#AA5500', secondaryColor: '#123456', particlePreset: 'wind', unlockedByDefault: false });
    expect(figure.unboxedAvailable).toBe(true);
    expect(figure.unboxedSize).toEqual({ w: 600, h: 900 });
    expect(figure.unboxedImage).toBe('/figures/nueva-figure.webp');
  });

  it('aplica los valores por defecto', () => {
    const { figure } = normalizeFigure({ id: 'x', boxImage: 'x.png', rarity: 'rare' });
    expect(figure).toMatchObject({ accentColor: '#E8C46A', particlePreset: 'gold', secondaryColor: '#C59B27', subtitle: '', unlockedByDefault: false });
  });

  it('marca como legacy la figura que reutiliza la foto de la caja', () => {
    const { figure } = normalizeFigure(legacyEntry);
    expect(figure.unboxedAvailable).toBe(false);
    expect(figure.unboxedImage).toBeNull();
  });

  it('aísla las entradas inválidas sin perder el resto', () => {
    const { figures, errors } = normalizeCatalog({
      figures: [legacyEntry, { name: 'sin id' }, { ...legacyEntry, name: 'duplicada' }, { ...canonicalEntry, rarity: 'mítica' }, { ...canonicalEntry, id: 'corta', loreSeals: ['A'] }],
    });
    expect(figures.map((f) => f.id)).toEqual(['dama_ceniza']);
    expect(errors).toHaveLength(4);
  });

  it('conserva las entradas antiguas con otro número de piezas', () => {
    const { figures } = normalizeCatalog(realCatalog);
    const jinete = figures.find((f) => f.id === 'jinete_dragones');
    expect(jinete.parts).toHaveLength(4);
  });

  it('descarta un recorte fuera de la imagen pero mantiene la figura', () => {
    const { figure, warnings } = normalizeFigure({ ...legacyEntry, pinCrop: { x: 1000, y: 0, w: 300, h: 300 } }, { imageSize: { w: 1024, h: 1536 } });
    expect(figure.pinCrop).toBeNull();
    expect(warnings.some((w) => w.includes('pinCrop'))).toBe(true);
  });

  it('limpia matchKeywords vacías o que no son texto', () => {
    const { figure } = normalizeFigure({ ...legacyEntry, matchKeywords: ['bruma', '', 3, '  '] });
    expect(figure.matchKeywords).toEqual(['bruma']);
  });

  it('el catálogo real es válido y mantiene sus IDs', () => {
    const { figures, errors } = normalizeCatalog(realCatalog);
    expect(errors).toEqual([]);
    // 1.45.0: dos figuras nuevas al final (la Dama sigue primera para los libros de su saga)
    expect(figures.map((f) => f.id)).toEqual(['dama_ceniza', 'jinete_dragones', 'viajero_asteroide', 'bardo_viento', 'hechicera_eea', 'guardian_clavos', 'maestro_superviviente']);
  });
});

describe('vinculación libro ↔ figura', () => {
  const { figures } = normalizeCatalog(realCatalog);
  const find = (title, author) => figureForBook(figures, { title, author }, PRESET_SAGAS)?.id ?? null;

  it('vincula por saga explícita y por título', () => {
    expect(find('Nacidos de la bruma (El imperio final)', 'Brandon Sanderson')).toBe('dama_ceniza');
    expect(find('El Pozo de la Ascensión', 'Brandon Sanderson')).toBe('dama_ceniza');
  });

  it('no vincula otro libro del mismo autor', () => {
    expect(find('El camino de los reyes', 'Brandon Sanderson')).toBeNull();
    expect(find('Elantris', 'Brandon Sanderson')).toBeNull();
  });

  it('«Alas de sangre» y «Fourth Wing» llevan a la misma figura', () => {
    expect(find('Alas de sangre', 'Rebecca Yarros')).toBe('jinete_dragones');
    expect(find('Fourth Wing', 'Rebecca Yarros')).toBe('jinete_dragones');
  });

  it('el autor desambigua títulos parecidos de otros autores', () => {
    expect(find('La bruma del puerto', 'Otra Autora')).toBeNull();
    expect(find('Circe', 'Madeline Miller')).toBe('hechicera_eea');
    expect(find('Circe', '')).toBe('hechicera_eea');
  });

  it('compara palabras completas, no trozos', () => {
    expect(find('Circenses de medianoche', 'Madeline Miller')).toBeNull();
  });
});

describe('inventario', () => {
  it('normalizar el catálogo no cambia IDs, piezas ni pity', () => {
    const { figures } = normalizeCatalog(realCatalog);
    const fs = { ...EMPTY_FIGURES, owned: { dama_ceniza: { display: 'unboxed', parts: [0, 2], obtainedAt: '2026-10-01' } }, guardian: 'dama_ceniza', seals: 3, boxes: 2, pity: { relic: 2, figure: 7 } };
    const dama = figures.find((f) => f.id === 'dama_ceniza');
    expect(rankOf(dama.parts.length, fs.owned.dama_ceniza)).toBe(2);
    // La preferencia «desprecintada» se conserva aunque ahora se muestre la caja
    expect(fs.owned.dama_ceniza.display).toBe('unboxed');
    const rules = figures.map((f) => ({ id: f.id, rarity: f.rarity, parts: f.parts }));
    const { fs: next } = openMysteryBox(fs, rules, [0.9, 0.9, 0.1, 0.1, 0.1]);
    expect(next.owned.dama_ceniza.parts).toEqual(expect.arrayContaining([0, 2]));
    expect(next.guardian).toBe('dama_ceniza');
    expect(next.boxes).toBe(1);
  });
});

describe('carga del catálogo', () => {
  it('un fallo no se queda guardado como catálogo vacío', async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('sin red'))
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => realCatalog });
    const loader = createCatalogLoader({ fetchFn, log: silentLog });
    expect(await loader.load()).toBeNull();
    expect(loader.get()).toBeNull();
    expect(await loader.load()).toBeNull();
    const list = await loader.load();
    expect(list).toHaveLength(7);
    expect(loader.get()).toBe(list);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it('un JSON sin «figures» cuenta como fallo', async () => {
    const loader = createCatalogLoader({ fetchFn: async () => ({ ok: true, json: async () => [] }), log: silentLog });
    expect(await loader.load()).toBeNull();
  });
});
