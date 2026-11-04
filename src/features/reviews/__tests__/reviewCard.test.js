import { describe, expect, it } from 'vitest';
import { portadaPermitida } from '../../../../api/portada';
import { datosLectura, partirLineas, repartir } from '../reviewCard';

const medir = (t) => t.length;
const SALTO = String.fromCharCode(10);

describe('partirLineas', () => {
  it('no pasa del ancho y conserva todas las palabras', () => {
    const texto = 'una historia que se queda contigo mucho después de cerrar el libro';
    const lineas = partirLineas(texto, medir, 20);
    expect(lineas.every((l) => l.length <= 20)).toBe(true);
    expect(lineas.join(' ')).toBe(texto);
  });

  it('marca los párrafos con una línea vacía y no deja una al final', () => {
    expect(partirLineas(['uno', '', 'dos', ''].join(SALTO), medir, 20)).toEqual(['uno', '', 'dos']);
  });

  it('una palabra más larga que el ancho va sola, sin perderse', () => {
    expect(partirLineas('a supercalifragilistico b', medir, 5)).toEqual(['a', 'supercalifragilistico', 'b']);
  });
});

describe('repartir', () => {
  const lineas = Array.from({ length: 40 }, (_, k) => `l${k}`);

  it('no pierde ninguna línea ni pasa de lo que cabe', () => {
    const hojas = repartir(lineas, 10, 15, 8);
    expect(hojas.flat()).toEqual(lineas);
    expect(hojas[0].length).toBeLessThanOrEqual(10);
    expect(hojas.at(-1).length).toBeLessThanOrEqual(8);
    hojas.slice(1, -1).forEach((h) => expect(h.length).toBeLessThanOrEqual(15));
  });

  it('la última imagen siempre tiene texto junto a la firma', () => {
    const hojas = repartir(lineas.slice(0, 10), 10, 15, 8);
    expect(hojas.length).toBe(2);
    expect(hojas[1].length).toBeGreaterThan(0);
  });

  it('con cita, el texto llena la primera imagen y la última puede llevar solo cita y firma', () => {
    const hojas = repartir(lineas.slice(0, 6), 8, 15, 4, 0);
    expect(hojas).toEqual([lineas.slice(0, 6), []]);
  });

  it('ninguna hoja empieza ni acaba en un salto de párrafo', () => {
    const conSaltos = lineas.flatMap((l, k) => (k % 3 === 2 ? [l, ''] : [l]));
    for (const hoja of repartir(conSaltos, 7, 9, 6)) {
      expect(hoja[0]).not.toBe('');
      expect(hoja.at(-1)).not.toBe('');
    }
  });
});

describe('datosLectura', () => {
  it('solo cuenta lo que se sabe', () => {
    expect(datosLectura({ status: 'reading', editionType: 'hardcover' })).toEqual([['Edición', 'Tapa dura']]);
  });

  it('calcula los días de lectura de un libro terminado', () => {
    const datos = datosLectura({ status: 'read', startedAt: '2026-10-01T10:00:00Z', finishedAt: '2026-10-11T10:00:00Z', pageCount: 320 });
    expect(datos).toContainEqual(['Leído en', '10 días']);
    expect(datos).toContainEqual(['Páginas', '320']);
  });
});

describe('portadaPermitida', () => {
  it('acepta los hosts de portadas y las pide por https', () => {
    expect(portadaPermitida('http://books.google.com/books/content?id=abc&zoom=1')).toBe('https://books.google.com/books/content?id=abc&zoom=1');
  });

  it('rechaza cualquier otro destino', () => {
    for (const u of ['https://evil.test/x.png', 'https://books.google.com.evil.test/x', 'https://books.google.com@evil.test/x', 'file:///etc/passwd', 'http://localhost/x', 'nada', '']) {
      expect(portadaPermitida(u)).toBeNull();
    }
  });
});
