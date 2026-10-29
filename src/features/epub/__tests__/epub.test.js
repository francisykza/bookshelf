// 1.55–1.56 (SPEC §53–54): cálculos del lector EPUB que no necesitan el DOM: rutas, porcentaje por texto legible,
// enlaces reescritos, límites, coincidencias de vinculación y dónde seguir leyendo entre dispositivos.
import { describe, expect, it } from 'vitest';
import { MATCH_MESSAGES, matchEpub, normalizeBib } from '../../../domain/bookMatch';
import { LITE_IMAGES, LITE_IMAGE_BYTES, MAX_FILE, MAX_UNZIPPED, isLite, parseReaderHash, positionPercent, resolvePath, sizeProblem, textLength, unzippedProblem } from '../epubFile';
import { forFile, startPosition, syncedPosition } from '../epubPosition';
import { createBook } from '../../../domain/books';
import { reducer } from '../../../state/useLibrary';

describe('lector EPUB', () => {
  it('rutas internas relativas a la carpeta del archivo, sin fragmento', () => {
    expect(resolvePath('OEBPS', 'Text/cap1.xhtml')).toBe('OEBPS/Text/cap1.xhtml');
    expect(resolvePath('OEBPS/Text', '../Images/a%20b.jpg')).toBe('OEBPS/Images/a b.jpg');
    expect(resolvePath('OEBPS/Text', 'cap2.xhtml#nota-3')).toBe('OEBPS/Text/cap2.xhtml');
    expect(resolvePath('', 'cap.xhtml')).toBe('cap.xhtml');
    expect(resolvePath('OEBPS', '#solo-ancla')).toBe('');
  });

  it('el porcentaje pesa el texto legible, no el número de documentos ni sus bytes', () => {
    // Tres documentos: una portada casi vacía, uno corto y uno largo
    const chapters = [{ size: 9000, weight: 10 }, { size: 300, weight: 290 }, { size: 700, weight: 700 }];
    expect(positionPercent(chapters, { chapter: 1, frac: 0 })).toBe(1);
    expect(positionPercent(chapters, { chapter: 2, frac: 0 })).toBe(30);
    expect(positionPercent(chapters, { chapter: 2, frac: 1 })).toBe(100);
    expect(positionPercent(chapters, { chapter: 2, frac: 2 })).toBe(100);
    expect(positionPercent([], {})).toBe(0);
    // Posiciones de la 1.55 (sin peso): por tamaño, como entonces
    expect(positionPercent([{ size: 100 }, { size: 300 }], { chapter: 1, frac: 0 })).toBe(25);
    // Texto legible: sin etiquetas, cabecera, estilos ni espacios repetidos
    expect(textLength('<html><head><title>T</title><style>p{}</style></head><body><p>Hola   <b>mar</b></p></body></html>')).toBe('Hola mar'.length);
  });

  it('enlaces reescritos del documento', () => {
    expect(parseReaderHash('#bs-go-3-nota%201')).toEqual({ kind: 'go', chapter: 3, fragment: 'nota 1' });
    expect(parseReaderHash('#bs-go-0')).toEqual({ kind: 'go', chapter: 0, fragment: '' });
    expect(parseReaderHash('#bs-img-7')).toEqual({ kind: 'img', index: 7 });
    expect(parseReaderHash('#n12')).toEqual({ kind: 'fragment', fragment: 'n12' });
    expect(parseReaderHash('')).toBe(null);
  });

  it('límites: archivo, contenido descomprimido y modo ligero por imágenes', () => {
    expect(sizeProblem(MAX_FILE)).toBe(null);
    expect(sizeProblem(MAX_FILE + 1)).toMatch(/máximo/);
    expect(unzippedProblem(MAX_UNZIPPED + 1)).toMatch(/seguridad/);
    expect(isLite({ count: LITE_IMAGES, bytes: 0 })).toBe(false);
    expect(isLite({ count: LITE_IMAGES + 1, bytes: 0 })).toBe(true);
    expect(isLite({ count: 3, bytes: LITE_IMAGE_BYTES + 1 })).toBe(true);
  });
});

describe('vinculación: ¿este archivo es este libro?', () => {
  const book = { title: 'En llamas', author: 'Suzanne Collins', isbn: '9788427202122' };
  it('normaliza sin perder números de volumen', () => {
    expect(normalizeBib('  ¡En  LLAMAS!: Los juegos del hambre, 2 ')).toBe('en llamas los juegos del hambre 2');
    expect(normalizeBib('Café')).toBe('cafe');
  });
  it('coincidencia, otra edición, datos insuficientes y discrepancia', () => {
    expect(matchEpub(book, { title: 'En Llamas', author: 'Collins, Suzanne' })).toBe('match');
    expect(matchEpub(book, { title: 'En llamas', author: 'Suzanne Collins', isbn: '9780439023498' })).toBe('edition');
    expect(matchEpub(book, { title: 'Cualquier cosa', author: '', isbn: '978-84-272-0212-2' })).toBe('match');
    expect(matchEpub(book, { title: '', author: '' })).toBe('unknown');
    expect(matchEpub(book, { title: 'Catching Fire', author: 'Suzanne Collins' })).toBe('unknown');
    expect(matchEpub(book, { title: 'Circe', author: 'Madeline Miller' })).toBe('mismatch');
    // Otra entrega de la saga no es el mismo libro
    expect(matchEpub({ title: 'Los juegos del hambre 2', author: 'Suzanne Collins' }, { title: 'Los juegos del hambre 3', author: 'Suzanne Collins' })).toBe('unknown');
    expect(MATCH_MESSAGES.mismatch).toMatch(/otro libro/);
  });
});

describe('dónde seguir leyendo', () => {
  const H = 'h1';
  const pos = (frac, extra = {}) => ({ v: 2, hash: H, href: 'c2.xhtml', block: Math.round(frac * 100), offset: 0, frac, percent: frac * 100, ...extra });
  it('una posición de otro archivo nunca se aplica', () => {
    expect(forFile(pos(0.5, { hash: 'otro' }), H)).toBe(null);
    expect(startPosition(null, pos(0.5, { hash: 'otro' }), H)).toEqual({ pos: null, conflict: null });
  });
  it('mismo archivo en otro dispositivo: se recupera la sincronizada', () => {
    expect(startPosition(null, pos(0.4, { rev: 3 }), H).pos.frac).toBe(0.4);
  });
  it('este dispositivo va por delante de su base: gana el local', () => {
    expect(startPosition({ pos: pos(0.7), baseRev: 3, dirty: true }, pos(0.4, { rev: 3 }), H).pos.frac).toBe(0.7);
  });
  it('el otro dispositivo escribió después y aquí no se movió nada: gana el otro', () => {
    expect(startPosition({ pos: pos(0.7), baseRev: 3, dirty: false }, pos(0.2, { rev: 4 }), H).pos.frac).toBe(0.2);
  });
  it('los dos cambiaron desde la misma revisión: se pregunta (sin elegir «la más avanzada»)', () => {
    const r = startPosition({ pos: pos(0.7), baseRev: 3, dirty: true }, pos(0.2, { rev: 4 }), H);
    expect(r.conflict).toEqual({ here: pos(0.7), other: pos(0.2, { rev: 4 }) });
  });
  it('cada escritura sincronizada sube la revisión', () => {
    expect(syncedPosition(pos(0.1), { rev: 4 }).rev).toBe(5);
    expect(syncedPosition(pos(0.1), null).rev).toBe(1);
  });
});

describe('notas del lector', () => {
  it('guardar dos veces la misma nota (reintento, doble toque) no la duplica', () => {
    const st = { books: [createBook({ id: 'b', title: 'L' })], settings: {}, progress: { readingLog: [] } };
    const quote = { id: 'q-fija', text: 'Fragmento', color: 'yellow', epub: { v: 2, hash: 'h', href: 'a.xhtml' } };
    const once = reducer(st, { type: 'addQuote', id: 'b', quote });
    const twice = reducer(once, { type: 'addQuote', id: 'b', quote });
    expect(twice.books[0].quotes).toHaveLength(1);
    expect(twice).toBe(once);
  });
});
