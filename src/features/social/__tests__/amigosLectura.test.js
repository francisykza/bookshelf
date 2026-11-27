// 1.153 · Lo que la app manda a tus amigos de tu lectura y cómo se casa «Leemos el mismo» con tus libros.
import { describe, expect, it } from 'vitest';
import { avancesJuntos, diaCorto, lecturaParaAmigos, libroDe, pendientesBuzon, tituloClave } from '../amigosLectura';

const libro = (o) => ({ id: o.title, author: 'Autora', pageCount: 200, currentPage: 0, trackBy: 'pages', status: 'want', quotes: [], review: 'privada', ...o });

describe('lo que ven tus amigos', () => {
  it('solo títulos y autores: hasta 3 que lees y los 5 últimos terminados con su día', () => {
    const books = [
      libro({ title: 'A', status: 'reading', updatedAt: '2026-11-01' }),
      libro({ title: 'B', status: 'reading', updatedAt: '2026-11-03' }),
      libro({ title: 'C', status: 'reading', updatedAt: '2026-11-02' }),
      libro({ title: 'D', status: 'reading', updatedAt: '2026-10-01' }),
      ...['E', 'F', 'G', 'H', 'I', 'J'].map((t, i) => libro({ title: t, status: 'read', finishedAt: `2026-11-1${i}T10:00:00Z` })),
      libro({ title: 'Quiero', status: 'want' }),
    ];
    const { leyendo, terminados } = lecturaParaAmigos(books);
    expect(leyendo.map((l) => l.titulo)).toEqual(['B', 'C', 'A']);
    expect(terminados.map((l) => l.titulo)).toEqual(['J', 'I', 'H', 'G', 'F']);
    expect(terminados[0]).toEqual({ titulo: 'J', autor: 'Autora', fecha: '2026-11-15' });
    // Nada de notas, reseñas ni páginas
    expect(JSON.stringify({ leyendo, terminados })).not.toMatch(/privada|currentPage|200/);
  });

  it('el mismo libro aunque se escriba distinto; el avance en porcentaje y el terminado, 100', () => {
    expect(tituloClave('  La Sombra del VIENTO! ')).toBe(tituloClave('la sombra del viento'));
    expect(tituloClave('Café')).toBe('cafe');
    const books = [libro({ title: 'Rebeca', status: 'reading', currentPage: 50 }), libro({ title: 'Drácula', status: 'read', currentPage: 200 })];
    expect(libroDe(books, 'REBECA')?.title).toBe('Rebeca');
    expect(libroDe(books, 'Otro')).toBeNull();
    const juntos = [
      { id: 'j1', titulo: 'rebeca', estado: 'activa' },
      { id: 'j2', titulo: 'Dracula', estado: 'activa' },
      { id: 'j3', titulo: 'Otro', estado: 'activa' },
      { id: 'j4', titulo: 'Rebeca', estado: 'invitada' },
    ];
    expect(avancesJuntos(books, juntos)).toEqual([
      { id: 'j1', pct: 25 },
      { id: 'j2', pct: 100 },
    ]);
  });

  it('lo nuevo del buzón y las fechas cortas', () => {
    const d = { llaves: [{}], juntos: [{ estado: 'invitada', propuse: false }, { estado: 'invitada', propuse: true }, { estado: 'activa' }], recomendaciones: [{ vista: false }, { vista: true }] };
    expect(pendientesBuzon(d)).toBe(3);
    expect(pendientesBuzon(null)).toBe(0);
    expect(diaCorto('2026-11-20')).toMatch(/20 nov/);
  });
});
