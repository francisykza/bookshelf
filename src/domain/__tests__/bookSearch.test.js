// Reglas del buscador (SPEC §40): ISBN, normalización, orden sin ocultar ediciones, ediciones sin mezclar datos y
// libros ya presentes.
import { describe, expect, it } from 'vitest';
import { dedupeResults, editionFromFormat, langCode, normalizeEditions, normalizeText, ownedMatch, parseIsbn, rankResults, yearOf } from '../bookSearch';

describe('ISBN', () => {
  it('reconoce ISBN-13 e ISBN-10 con guiones o espacios y los lleva a ISBN-13', () => {
    expect(parseIsbn('978-1-338-63517-1')).toBe('9781338635171');
    expect(parseIsbn(' 9781338635171 ')).toBe('9781338635171');
    expect(parseIsbn('0-306-40615-2')).toBe('9780306406157');
    expect(parseIsbn('843760494X')).toBe('9788437604947');
  });
  it('no confunde números cualesquiera ni dígitos de control erróneos con un ISBN', () => {
    expect(parseIsbn('9781338635172')).toBeNull();
    expect(parseIsbn('1984')).toBeNull();
    expect(parseIsbn('El nombre del viento')).toBeNull();
  });
});

describe('texto', () => {
  it('ignora mayúsculas, tildes y puntuación', () => {
    expect(normalizeText('¡Balada de PÁJAROS cantores, y serpientes!')).toBe('balada de pajaros cantores y serpientes');
    expect(normalizeText('Cien años de soledad')).toBe(normalizeText('cien anos de soledad'));
  });
  it('códigos de idioma y años de fechas libres', () => {
    expect(langCode('/languages/spa')).toBe('es');
    expect(langCode('en')).toBe('en');
    expect(yearOf('May 19, 2020')).toBe('2020');
    expect(yearOf('')).toBe('');
  });
});

describe('orden de resultados', () => {
  const results = [
    { key: 'a', title: 'The Hunger Games', author: 'Suzanne Collins', language: 'en', isbn: '9780439023481' },
    { key: 'b', title: 'Balada de pájaros cantores y serpientes', author: 'Suzanne Collins', language: 'es', isbn: '9788427219892' },
    { key: 'c', title: 'The Ballad of Songbirds and Snakes', author: 'Suzanne Collins', language: 'en', isbn: '9781338635171' },
  ];
  it('pone primero el ISBN exacto', () => {
    expect(rankResults(results, { query: '978-1-338-63517-1', isbn: '9781338635171', lang: 'es' })[0].key).toBe('c');
  });
  it('prioriza el título buscado (sin tildes) y el idioma del usuario sin quitar nada', () => {
    const out = rankResults(results, { query: 'balada de pajaros', lang: 'es' });
    expect(out[0].key).toBe('b');
    expect(out).toHaveLength(3);
    const byLang = rankResults(results, { query: 'suzanne collins', lang: 'es' });
    expect(byLang[0].key).toBe('b');
    expect(byLang.map((r) => r.key).slice(1)).toEqual(['a', 'c']);
  });
  it('solo quita duplicados reales: mismo ISBN u obra, no otra edición con el mismo título', () => {
    const out = dedupeResults([
      { key: 'g1', title: 'Momo', author: 'Michael Ende', isbn: '9788420482590' },
      { key: 'g2', title: 'Momo', author: 'Michael Ende', isbn: '978-84-204-8259-0' },
      { key: 'g3', title: 'Momo', author: 'Michael Ende', isbn: '9788491221166' },
      { key: 'o1', workKey: '/works/OL1W', title: 'Momo', author: 'Michael Ende' },
      { key: 'o2', workKey: '/works/OL1W', title: 'Momo', author: 'Michael Ende' },
    ]);
    expect(out.map((r) => r.key)).toEqual(['g1', 'g3', 'o1']);
  });
});

describe('ediciones', () => {
  const entries = [
    { key: '/books/E1', title: 'The Ballad of Songbirds and Snakes', publishers: ['Scholastic'], publish_date: '2020', number_of_pages: 517, languages: [{ key: '/languages/eng' }], isbn_13: ['9781338635171'], covers: [-1, 10] },
    { key: '/books/E2', title: 'Balada de pájaros cantores y serpientes', publishers: ['Molino'], publish_date: '2025', number_of_pages: 592, languages: [{ key: '/languages/spa' }], isbn_10: ['8427248490'], physical_format: 'Hardcover' },
    { key: '/books/E3', title: 'Ballad of Songbirds and Snakes', publishers: ['Blackstone Audio'], publish_date: '2023', languages: [{ key: '/languages/eng' }] },
  ];
  it('cada edición conserva solo sus datos y las del idioma del usuario van primero', () => {
    const [first, ...rest] = normalizeEditions(entries, { lang: 'es' });
    expect(first).toMatchObject({ editionKey: '/books/E2', publisher: 'Molino', editionDate: '2025', pageCount: 592, language: 'es', cover: '', isbn: '9788427248496', format: 'Hardcover' });
    expect(rest).toHaveLength(2);
    const audio = rest.find((e) => e.editionKey === '/books/E3');
    // Sin páginas ni portada propias: vacías, no tomadas de otra edición
    expect(audio.pageCount).toBeNull();
    expect(audio.cover).toBe('');
    expect(rest.find((e) => e.editionKey === '/books/E1').cover).toBe('https://covers.openlibrary.org/b/id/10-L.jpg');
  });
  it('el formato del proveedor se traduce solo si es inequívoco', () => {
    expect(editionFromFormat('Hardcover')).toBe('hardcover');
    expect(editionFromFormat('Mass Market Paperback')).toBe('paperback');
    expect(editionFromFormat('Audio CD')).toBe('audiobook');
    expect(editionFromFormat('Unknown Binding')).toBeNull();
    expect(editionFromFormat('')).toBeNull();
  });
});

describe('ya en la biblioteca', () => {
  const books = [{ title: 'Circe', author: 'Madeline Miller', isbn: '978-0-316-55634-7' }];
  it('distingue la misma edición (ISBN) de otro ejemplar con el mismo título', () => {
    expect(ownedMatch({ title: 'Circe (edición de bolsillo)', author: 'Madeline Miller', isbn: '9780316556347' }, books)).toBe('isbn');
    expect(ownedMatch({ title: 'CIRCE', author: 'madeline miller', isbn: '9788491818663' }, books)).toBe('title');
    expect(ownedMatch({ title: 'Galatea', author: 'Madeline Miller', isbn: '' }, books)).toBeNull();
  });
});
