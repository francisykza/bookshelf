// 1.132 (§16.2): el influencer de cada nivel, en la app. Las cifras y las recetas contra el servidor están en
// cafe-influencer.rls.test.js; aquí, las fichas, lo que pide del libro, lo que dice, el reloj de arena y su dibujo.
import { describe, expect, it } from 'vitest';
import { validateAvatar } from '../actor';
import { barraFilas, relojFilas } from '../cafe/cafeArena';
import { clientesDelDia, recetaValida } from '../cafe/cafeClientes';
import {
  ARENA_SEGUNDOS,
  INFLUENCERS,
  NIVELES_INFLUENCER,
  arenaQueda,
  arenaTexto,
  despedidaInfluencer,
  enFrase,
  influencerDe,
  numeroInfluencer,
  pedidoInfluencer,
  saludoViral,
  semillaInfluencer,
} from '../cafe/cafeInfluencers';
import { pedidosLibro, pilarPuede } from '../cafe/cafeLibreria';
import { cartaDe, desdeNivel } from '../cafe/cafeNiveles';

const POSIBLES = [
  { genero: 'fantasia', extension: 'largo' },
  { genero: 'amor', extension: 'corto' },
  { genero: 'misterio', extension: 'corto' },
  { genero: 'misterio', extension: 'largo' },
];
const arena = (filas) => filas.join('').split('').filter((c) => c === 'a' || c === 'A').length;

describe('el influencer de cada nivel (1.132)', () => {
  it('siete personajes, del 2 al 8, con nombre, accesorio y color propios y un aspecto que vale', () => {
    expect(NIVELES_INFLUENCER).toEqual([2, 3, 4, 5, 6, 7, 8]);
    const fichas = NIVELES_INFLUENCER.map(influencerDe);
    expect(new Set(fichas.map((f) => f.nombre)).size).toBe(7);
    expect(new Set(fichas.map((f) => f.accesorio)).size).toBe(7);
    expect(new Set(fichas.map((f) => f.tema.join())).size).toBe(7);
    for (const f of fichas) {
      expect(validateAvatar(f.avatar)).not.toBeNull();
      expect(f.tema.every((c) => Number.isInteger(c) && c >= 0 && c <= 255)).toBe(true);
      expect(['corto', 'largo']).toContain(f.libro.extension);
      expect(['regalar', 'aqui', 'llevar']).toContain(f.libro.forma);
      expect(f.saludo.length).toBeGreaterThan(20);
      expect(f.publica.length).toBeGreaterThan(5);
    }
    expect(influencerDe(1)).toBeNull();
    expect(influencerDe(9)).toBeNull();
  });

  it('cada receta se puede preparar con la carta de la barra anterior llena (la del 7, café intenso sin nada; la del 8, con hielo, entera y vainilla)', () => {
    for (const n of NIVELES_INFLUENCER) expect(recetaValida(INFLUENCERS[n].pide, cartaDe(desdeNivel(n) - 1))).toBe(true);
    expect(INFLUENCERS[7].pide).toEqual(['cafe', 'intenso', 'sin', 'nada']);
    expect(INFLUENCERS[8].pide).toEqual(['frio', 'suave', 'entera', 'vainilla']);
  });

  it('del libro pide su extensión y su forma, de lo que hay en la balda; con la balda vacía, solo el café', () => {
    const p = pedidoInfluencer(2, POSIBLES, 0);
    expect(p).toMatchObject({ id: 'libro', extension: 'corto', forma: 'llevar' });
    expect(['amor', 'misterio']).toContain(p.genero);
    // Sin ningún libro de su extensión, uno de cualquiera
    expect(pedidoInfluencer(3, [{ genero: 'amor', extension: 'corto' }], 5)).toMatchObject({ genero: 'amor', extension: 'corto', forma: 'aqui' });
    expect(pedidoInfluencer(2, [], 0)).toBeNull();
    expect(pedidoInfluencer(1, POSIBLES, 0)).toBeNull();
    // El mismo todo el día, y distinto según el día
    expect(semillaInfluencer('2026-11-14', 4)).toBe(semillaInfluencer('2026-11-14', 4));
    expect(semillaInfluencer('2026-11-14', 4)).not.toBe(semillaInfluencer('2026-11-15', 4));
  });

  it('llega el primero del día, con su receta fija y su pedido; los virales, como cualquiera, con de quién era el vídeo', () => {
    const balda = [
      { clave: 'a', title: 'A', genero: 'amor', paginas: 200, ejemplares: 2 },
      { clave: 'b', title: 'B', genero: 'fantasia', paginas: 500, ejemplares: 1 },
    ];
    const dia = {
      dia: '2026-11-14',
      carta: [],
      clientes: [{ n: 1, semilla: 11, servido: false }],
      habituales: [],
      virales: [{ n: 201, semilla: 7, servido: false }],
      viralesDe: 3,
      influencer: { nivel: 2, servido: false, sube: true, estrellas: null, aTiempo: false, viral: false },
    };
    const lista = clientesDelDia(dia, pedidosLibro(dia, balda));
    expect(lista.map((c) => c.n)).toEqual([numeroInfluencer(2), 1, 201]);
    const [inf, , viral] = lista;
    expect(inf.nombre).toBe('La Bloguera del Muelle');
    expect(inf.influencer).toMatchObject({ nivel: 2, sube: true, accesorio: 'palo' });
    expect(inf.pide).toEqual(INFLUENCERS[2].pide);
    expect(inf.pedido).toMatchObject({ id: 'libro', genero: 'amor', extension: 'corto', forma: 'llevar' });
    expect(viral.viral).toBe(3);
    expect(viral.pedido.id).toBe('libro');
    // Pilar nunca lo prepara (aunque domines la bebida)
    expect(pilarPuede({ cafe: 99 }, 'cafe', { excentrico: Boolean(inf.influencer) })).toBe(false);
  });

  it('lo que dicen: el saludo del viral dice de quién era el vídeo; la despedida, cómo salió', () => {
    expect(saludoViral(3)).toBe('¡Hola! Vengo por el vídeo del Booktuber de las Gafas Redondas. ¿Me pones esto?');
    expect(saludoViral(2)).toBe('¡Hola! Vengo por el vídeo de la Bloguera del Muelle. ¿Me pones esto?');
    expect(saludoViral(8)).toContain('de la Autora de «Cafés con alma»');
    expect(saludoViral(0)).toBe('¡Hola! Vengo por un vídeo de tu café. ¿Me pones esto?');
    expect(enFrase('La Crítica de la Libreta Roja')).toBe('la Crítica de la Libreta Roja');
    expect(enFrase('El Catador de Cafés')).toBe('el Catador de Cafés');
    expect(despedidaInfluencer({ a_tiempo: true, viral: true })).toContain('viral');
    expect(despedidaInfluencer({ a_tiempo: true, viral: false })).toContain('a tiempo');
    expect(despedidaInfluencer({ a_tiempo: false, viral: false })).toContain('Gracias');
  });

  it('el reloj de arena: de lleno a vacío en 150 s, y dicho sin números', () => {
    expect(arenaQueda(0)).toBe(1);
    expect(arenaQueda((ARENA_SEGUNDOS * 1000) / 2)).toBeCloseTo(0.5, 6);
    expect(arenaQueda(ARENA_SEGUNDOS * 1000)).toBe(0);
    expect(arenaQueda(ARENA_SEGUNDOS * 2000)).toBe(0);
    expect(arenaQueda(-5)).toBe(1);
    const textos = [1, 0.8, 0.6, 0.4, 0.1, 0].map(arenaTexto);
    expect(new Set(textos).size).toBe(5);
    for (const t of textos) expect(t).not.toMatch(/\d/);
    expect(arenaTexto(0)).toBe('Se ha acabado la arena');
  });

  it('el dibujo del reloj: siempre del mismo tamaño, la arena no se pierde y cae por el centro', () => {
    const lleno = relojFilas(1, 0);
    const total = arena(lleno);
    expect(total).toBeGreaterThan(40);
    for (const q of [1, 0.9, 0.5, 0.25, 0.01, 0]) {
      for (const fase of [0, 1]) {
        const f = relojFilas(q, fase);
        expect(f).toHaveLength(26);
        expect(new Set(f.map((x) => x.length))).toEqual(new Set([17]));
        expect(arena(f)).toBe(total);
      }
    }
    // Arriba (filas 4 a 13) se vacía y abajo (14 a 21) se llena; a medias, el hilo de granos cae por la columna del centro
    const arriba = (f) => arena(f.slice(4, 14));
    expect(arriba(relojFilas(1))).toBe(total);
    expect(arriba(relojFilas(0))).toBe(0);
    const medio = [relojFilas(0.5, 0), relojFilas(0.5, 1)];
    expect(medio.some((f) => f.slice(14, 22).some((fila) => fila[8] === 's'))).toBe(true);
    expect(relojFilas(1).join('')).not.toContain('s');
    expect(relojFilas(0).join('')).not.toContain('s');
    // Con movimiento reducido, una barra quieta que se vacía
    const b = (q) => barraFilas(q);
    expect(new Set(b(1).map((x) => x.length))).toEqual(new Set([24]));
    expect(arena(b(1))).toBeGreaterThan(arena(b(0.5)));
    expect(arena(b(0.5))).toBeGreaterThan(arena(b(0.1)));
    expect(arena(b(0))).toBe(0);
  });
});
