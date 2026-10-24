// Pruebas de la 1.23.0 (SPEC §17): selector de lecturas activas y «Otros…», significados de colores por ID y
// puerta de sonidos (repeticiones y voces).
import { describe, expect, it } from 'vitest';
import { OTHER, choiceLabels, initialReadingOrder, isBookId, normalize, readingChoices, searchLibrary } from '../bookPicker';
import { COLOR_IDS, colorIdOf, draftFrom, meaningOf, originalDraft, toSettings, validateMeanings } from '../quoteMeanings';
import { createSoundGate } from '../../audio/uiSounds';

const b = (id, status, title = id, author = 'Autora') => ({ id, status, title, author });

describe('selector de lecturas activas', () => {
  const books = [b('a', 'want'), b('r1', 'reading'), b('d', 'read'), b('r2', 'reading'), b('r3', 'reading')];

  it('solo lecturas activas, con el libro actual primero', () => {
    const order = initialReadingOrder(books, 'r2');
    expect(order).toEqual(['r2', 'r1', 'r3']);
    expect(readingChoices(books, order).map((x) => x.id)).toEqual(['r2', 'r1', 'r3']);
  });

  it('el libro actual fuera de las lecturas activas no se cuela', () => {
    expect(initialReadingOrder(books, 'a')).toEqual(['r1', 'r2', 'r3']);
  });

  it('cero y una lectura', () => {
    expect(readingChoices([b('a', 'want')], initialReadingOrder([b('a', 'want')], 'a'))).toEqual([]);
    expect(readingChoices([b('x', 'reading')], ['x']).map((x) => x.id)).toEqual(['x']);
  });

  it('el orden no se recoloca al actualizarse los datos: las nuevas lecturas van al final', () => {
    const order = ['r2', 'r1'];
    const next = [b('r1', 'reading'), b('r2', 'reading'), b('n', 'reading'), b('r3', 'read')];
    expect(readingChoices(next, order).map((x) => x.id)).toEqual(['r2', 'r1', 'n']);
  });

  it('títulos repetidos llevan el autor', () => {
    const labels = choiceLabels([b('1', 'reading', 'Circe', 'Madeline Miller'), b('2', 'reading', 'circe', 'Otra'), b('3', 'reading', 'Dune')]);
    expect(labels['1']).toBe('Circe — Madeline Miller');
    expect(labels['3']).toBe('Dune');
  });
});

describe('«Otros…»: buscar en mi biblioteca', () => {
  const lib = [b('1', 'want', 'El Nombre del Viento', 'Patrick Rothfuss'), b('2', 'read', 'Canción de Aquiles', 'Madeline Miller'), b('3', 'reading', 'Circe', 'Madeline Miller')];

  it('consulta vacía no lista la biblioteca', () => {
    expect(searchLibrary(lib, '   ')).toBeNull();
  });

  it('por título y autor, sin mayúsculas, acentos ni espacios dobles', () => {
    expect(searchLibrary(lib, 'nombre  VIENTO').map((x) => x.id)).toEqual(['1']);
    expect(searchLibrary(lib, 'cancion').map((x) => x.id)).toEqual(['2']);
    expect(searchLibrary(lib, 'miller').map((x) => x.id)).toEqual(['2', '3']);
    expect(searchLibrary(lib, 'tolkien')).toEqual([]);
    expect(normalize('  Ñandú  Ágil ')).toBe('nandu agil');
  });

  it('«Otros…» nunca es un id de libro', () => {
    expect(isBookId(lib, OTHER)).toBe(false);
    expect(isBookId(lib, '')).toBe(false);
    expect(isBookId(lib, '1')).toBe(true);
  });
});

describe('significados de los colores', () => {
  it('se resuelven por ID y conservan el color', () => {
    const meanings = { yellow: { label: 'Ideas para recordar', description: '' } };
    expect(meaningOf(meanings, 'yellow')).toMatchObject({ id: 'yellow', label: 'Ideas para recordar', hex: '#f7dc6f' });
    expect(meaningOf(meanings, 'pink').label).toBe('Rosa Emoción');
  });

  it('un dato antiguo con hexadecimal se lee como su ID y uno desconocido tiene respaldo', () => {
    expect(colorIdOf('#F7DC6F')).toBe('yellow');
    expect(meaningOf({}, '#123456')).toMatchObject({ id: null, label: 'Color sin significado' });
  });

  it('valida obligatoriedad, longitud y duplicados', () => {
    const d = draftFrom({});
    d.pink.label = '  ';
    d.blue.label = 'x'.repeat(33);
    d.gold.label = 'amarillo idea';
    d.yellow.description = 'y'.repeat(121);
    const e = validateMeanings(d);
    expect(e.pink.label).toBeTruthy();
    expect(e.blue.label).toMatch(/32/);
    expect(e.gold.label).toMatch(/ya tiene/);
    expect(e.yellow.description).toMatch(/120/);
  });

  it('guarda solo lo cambiado y restaurar vuelve a los originales', () => {
    const d = draftFrom({});
    d.yellow.label = 'Ideas para recordar';
    expect(toSettings(d)).toEqual({ yellow: { label: 'Ideas para recordar', description: '' } });
    expect(toSettings(originalDraft())).toEqual({});
    expect(COLOR_IDS).toEqual(['pink', 'yellow', 'blue', 'gold']);
  });
});

describe('puerta de sonidos', () => {
  it('80 ms entre repeticiones del mismo evento', () => {
    const gate = createSoundGate();
    expect(gate('save', 0, 130)).toBe(true);
    expect(gate('save', 40, 130)).toBe(false);
    expect(gate('save', 200, 130)).toBe(true);
  });

  it('como mucho tres voces a la vez', () => {
    const gate = createSoundGate();
    expect(gate('a', 0, 500)).toBe(true);
    expect(gate('b', 1, 500)).toBe(true);
    expect(gate('c', 2, 500)).toBe(true);
    expect(gate('d', 3, 500)).toBe(false);
    expect(gate('d', 600, 500)).toBe(true);
  });
});
