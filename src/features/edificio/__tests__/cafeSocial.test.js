import { describe, expect, it } from 'vitest';
import { baldaDeVisita, ordenRanking } from '../cafe/cafeSocial';
import { destacadosDe, estanteLibreria } from '../cafe/cafeLibreria';

const fila = (alias, nivel, reputacion, ganados = 0, semana = 0) => ({ userId: alias, alias, nivel, reputacion, ganados, semana, yo: false });

describe('los cafés de los demás (1.141)', () => {
  it('cada tabla ordena por lo suyo; los empates comparten puesto y el orden no baila', () => {
    const filas = [fila('Bea', 3, 2000, 40, 5), fila('Ana', 3, 2000, 90, 30), fila('Cris', 4, 3000, 10, 30), fila('Dani', 1, 0, 0, 0)];
    expect(ordenRanking(filas, 'nivel').map((f) => [f.alias, f.puesto])).toEqual([
      ['Cris', 1],
      ['Ana', 2],
      ['Bea', 2],
      ['Dani', 4],
    ]);
    expect(ordenRanking(filas, 'ganados').map((f) => f.alias)).toEqual(['Ana', 'Bea', 'Cris', 'Dani']);
    // En la semana, a igualdad de reputación, el de más nivel
    expect(ordenRanking(filas, 'semana').map((f) => [f.alias, f.puesto])).toEqual([
      ['Cris', 1],
      ['Ana', 2],
      ['Bea', 3],
      ['Dani', 4],
    ]);
    expect(ordenRanking([], 'nivel')).toEqual([]);
  });

  it('la balda de un café visitado: el catálogo con su portada y los leídos de su dueño, sin título', () => {
    const balda = baldaDeVisita([
      { clave: 'cat:nada', titulo: 'Nada', genero: 'novela', balda: 2 },
      { genero: 'novela', balda: 1 },
      { genero: 'poesia', balda: 3 },
      { genero: 'poesia', balda: 0 },
    ]);
    expect(balda.map((b) => [b.clave, b.genero, b.ejemplares, b.tuyo])).toEqual([
      ['cat:nada', 'novela', 2, false],
      ['leido:novela:1', 'novela', 1, true],
      ['leido:poesia:1', 'poesia', 3, true],
    ]);
    expect(balda[0].cover).toMatch(/^https:\/\/covers\.openlibrary\.org\//);
    // Se dibuja como cualquier balda, y de cara va el del catálogo
    expect(estanteLibreria(balda).flatMap((t) => t.lomos)).toHaveLength(6);
    expect(destacadosDe(balda).find((d) => d.genero === 'novela').clave).toBe('cat:nada');
  });
});
