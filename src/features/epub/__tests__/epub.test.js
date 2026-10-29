// 1.55 (SPEC §53): cálculos del lector EPUB que no necesitan el DOM (rutas, porcentaje y límites).
import { describe, expect, it } from 'vitest';
import { LITE_IMAGES, LITE_IMAGE_BYTES, MAX_FILE, MAX_UNZIPPED, isLite, positionPercent, resolvePath, sizeProblem, unzippedProblem } from '../epubFile';

describe('lector EPUB', () => {
  it('rutas internas relativas a la carpeta del archivo, sin fragmento', () => {
    expect(resolvePath('OEBPS', 'Text/cap1.xhtml')).toBe('OEBPS/Text/cap1.xhtml');
    expect(resolvePath('OEBPS/Text', '../Images/a%20b.jpg')).toBe('OEBPS/Images/a b.jpg');
    expect(resolvePath('OEBPS/Text', 'cap2.xhtml#nota-3')).toBe('OEBPS/Text/cap2.xhtml');
    expect(resolvePath('', 'cap.xhtml')).toBe('cap.xhtml');
    expect(resolvePath('OEBPS', '#solo-ancla')).toBe('');
  });

  it('porcentaje ponderado por el tamaño de los capítulos', () => {
    const chapters = [{ size: 100 }, { size: 300 }, { size: 600 }];
    expect(positionPercent(chapters, { chapter: 0, frac: 0 })).toBe(0);
    expect(positionPercent(chapters, { chapter: 1, frac: 0.5 })).toBe(25);
    expect(positionPercent(chapters, { chapter: 2, frac: 1 })).toBe(100);
    expect(positionPercent(chapters, { chapter: 2, frac: 2 })).toBe(100);
    expect(positionPercent([], {})).toBe(0);
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
