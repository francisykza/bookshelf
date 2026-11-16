// 1.130 · Los libros del café, igual de importantes que el café: solo se pide lo que hay en la balda (género con ejemplares y
// una extensión que exista en él), en tres partes; los aciertos del libro; las estrellas de siete; las secciones de la
// estantería (una por género con ejemplares, cada lomo en su sitio y sin salirse); y cuándo prepara Pilar.
import { describe, expect, it } from 'vitest';
import { ESTANTERIA } from '../cafe/cafeLayout';
import { GENEROS, clientesDelDia, librosDeLaBalda } from '../cafe/cafeClientes';
import {
  CORTO_MAX,
  FORMAS,
  SIN_LIBRO,
  aciertosLibro,
  comandaLibro,
  comandaLibroAcertijo,
  encajaExtension,
  atrezzoEstante,
  destacadosDe,
  estanteLibreria,
  estrellasTotal,
  extensionDe,
  frasePedido,
  pedidosLibro,
  pedidosPosiblesBalda,
  pilarHaceEtapa,
  pilarPuede,
  seccionesDe,
} from '../cafe/cafeLibreria';

const enBalda = (clave, genero, balda = 1) => ({ clave, titulo: `Libro ${clave}`, genero, caja: 0, balda });
const biblio = (id, pageCount) => ({ id, title: `Libro ${id}`, author: 'Autoría', pageCount, categories: [] });

describe('los libros del café (1.130)', () => {
  it('la balda, como libros: su género de sección, sus páginas y sus ejemplares', () => {
    const balda = librosDeLaBalda({ libros: [enBalda('a', 'misterio', 2), enBalda('b', 'poesia'), { ...enBalda('c', 'amor'), balda: 0, caja: 3 }] }, [biblio('a', 120), biblio('b', 0)]);
    expect(balda.map((b) => [b.clave, b.genero, b.paginas, b.ejemplares])).toEqual([
      ['a', 'misterio', 120, 2],
      ['b', 'poesia', null, 1],
    ]);
    expect(seccionesDe(balda).map((s) => s.genero)).toEqual(['misterio', 'poesia']);
  });

  it('la extensión: corto hasta 300 páginas; sin páginas vale para las dos', () => {
    expect([extensionDe(CORTO_MAX), extensionDe(CORTO_MAX + 1), extensionDe(0), extensionDe(null)]).toEqual(['corto', 'largo', null, null]);
    expect([encajaExtension(120, 'corto'), encajaExtension(120, 'largo'), encajaExtension(null, 'largo'), encajaExtension(null, 'corto')]).toEqual([true, false, true, true]);
  });

  it('solo se pide lo que hay en la balda; sin ejemplares, nadie pide libro', () => {
    const balda = librosDeLaBalda({ libros: [enBalda('a', 'misterio'), enBalda('b', 'misterio'), enBalda('c', 'fantasia')] }, [biblio('a', 120), biblio('b', 150), biblio('c', 640)]);
    expect(pedidosPosiblesBalda(balda)).toEqual([
      { genero: 'fantasia', extension: 'largo' },
      { genero: 'misterio', extension: 'corto' },
    ]);
    const dia = { clientes: [1, 2, 3, 4].map((n) => ({ n, semilla: 1000 * n + n * 13 })), habituales: [{ n: 101, quien: 1, semilla: 77 }] };
    const pedidos = pedidosLibro(dia, balda);
    for (const p of Object.values(pedidos)) {
      expect(pedidosPosiblesBalda(balda)).toContainEqual({ genero: p.genero, extension: p.extension });
      expect(FORMAS.map((f) => f.id)).toContain(p.forma);
    }
    // Los dos primeros, géneros distintos (mientras se pueda)
    expect(new Set([pedidos[1].genero, pedidos[2].genero]).size).toBe(2);
    expect(pedidosLibro(dia, [])[1]).toBe(SIN_LIBRO);
    expect(clientesDelDia(dia, pedidos)[0].pedido).toBe(pedidos[1]);
    // Las formas salen de la semilla: con muchos clientes aparecen las tres
    const muchos = { clientes: Array.from({ length: 30 }, (_, k) => ({ n: k + 1, semilla: k * 7919 + 5 })), habituales: [] };
    expect(new Set(Object.values(pedidosLibro(muchos, balda)).map((p) => p.forma)).size).toBe(3);
  });

  it('los aciertos del libro, las frases y las estrellas de siete', () => {
    const pedido = { id: 'libro', genero: 'misterio', extension: 'corto', forma: 'regalar' };
    expect(aciertosLibro({ genero: 'misterio', paginas: 200 }, pedido, 'regalar')).toEqual([true, true, true]);
    expect(aciertosLibro({ genero: 'amor', paginas: 500 }, pedido, 'llevar')).toEqual([false, false, false]);
    expect(aciertosLibro({ genero: 'misterio', paginas: null }, pedido, 'aqui')).toEqual([true, true, false]);
    expect(aciertosLibro(null, pedido, 'regalar')).toEqual([false, false, false]);
    expect(frasePedido(pedido)).toBe('Y para leer, un misterio, cortito, para regalar.');
    expect(comandaLibro(pedido)).toBe('Misterio · corto · para regalar');
    expect(comandaLibroAcertijo(pedido)).toHaveLength(3);
    expect(comandaLibro(SIN_LIBRO)).toBeNull();
    for (const g of GENEROS) expect(frasePedido({ ...pedido, genero: g.id })).not.toMatch(/undefined/);
    expect([estrellasTotal(4, 3), estrellasTotal(4, 2), estrellasTotal(3, 1), estrellasTotal(2, 1), estrellasTotal(4, 0), estrellasTotal(0, 3)]).toEqual([3, 2, 2, 1, 2, 1]);
  });

  it('la estantería por secciones: una por género con ejemplares, un lomo por ejemplar, sin salirse ni pisarse', () => {
    const filas = GENEROS.flatMap((g, k) => Array.from({ length: 6 }, (_, i) => enBalda(`${g.id}-${i}`, g.id, 1 + ((i + k) % 2))));
    const balda = librosDeLaBalda(
      { libros: filas },
      filas.map((x, i) => biblio(x.clave, (i * 97) % 900)),
    );
    const tramos = estanteLibreria(balda);
    const lomos = tramos.flatMap((t) => t.lomos);
    expect(lomos).toHaveLength(balda.reduce((s, b) => s + b.ejemplares, 0));
    expect(new Set(tramos.filter((t) => t.placa).map((t) => t.genero)).size).toBe(GENEROS.length);
    for (const t of tramos) {
      expect(t.y0).toBeGreaterThanOrEqual(ESTANTERIA.y0);
      expect(t.y1).toBeLessThanOrEqual(ESTANTERIA.y1);
      for (const l of t.lomos) expect(balda.find((b) => b.clave === l.clave).genero).toBe(t.genero);
    }
    // En una misma fila, ningún lomo pisa a otro
    const porFila = {};
    for (const t of tramos) for (const l of t.lomos) (porFila[t.fila] ??= []).push(l);
    for (const ls of Object.values(porFila)) {
      ls.sort((a, b) => a.y0 - b.y0);
      for (let k = 1; k < ls.length; k += 1) expect(ls[k].y0).toBeGreaterThanOrEqual(ls[k - 1].y1);
    }
    expect(estanteLibreria([])).toEqual([]);
  });

  it('cada placa, en su hueco: como mucho tres secciones por fila y, con pocos libros, un bloque recogido en el centro', () => {
    // Pocos ejemplares en muchas secciones (lo que queda tras unas ventas): antes iban todas seguidas y las placas se pisaban
    const pocos = GENEROS.slice(0, 7).flatMap((g, k) => Array.from({ length: 1 + (k % 2) }, (_, i) => enBalda(`${g.id}-${i}`, g.id, 1)));
    for (const balda of [
      librosDeLaBalda(
        { libros: pocos },
        pocos.map((x, i) => biblio(x.clave, 120 + i * 60)),
      ),
      librosDeLaBalda({ libros: GENEROS.flatMap((g) => Array.from({ length: 6 }, (_, i) => enBalda(`${g.id}-${i}`, g.id, 1))) }, []),
    ]) {
      const tramos = estanteLibreria(balda);
      const porFila = {};
      for (const t of tramos.filter((x) => x.placa)) (porFila[t.fila] ??= []).push(t);
      for (const ts of Object.values(porFila)) {
        expect(ts.length).toBeLessThanOrEqual(3);
        ts.sort((a, b) => a.placa.y - b.placa.y);
        for (let k = 1; k < ts.length; k += 1) expect(ts[k].placa.y - ts[k - 1].placa.y).toBeGreaterThanOrEqual((ts[k].hueco + ts[k - 1].hueco) / 2 - 1e-9);
      }
    }
    const tramos = estanteLibreria(
      librosDeLaBalda(
        { libros: pocos },
        pocos.map((x) => biblio(x.clave, 200)),
      ),
    );
    // 1.140: por la pared entera, de la columna del centro hacia fuera (las tres filas de arriba antes que la del suelo)
    for (const t of tramos) expect(t.hueco).toBeGreaterThan(1);
    expect(tramos.slice(0, 3).map((t) => [t.fila, t.casilla[0]])).toEqual([
      [2, 1],
      [1, 1],
      [3, 1],
    ]);
    expect(tramos.some((t) => t.fila === 0)).toBe(false);
  });

  it('1.140: la estantería vestida, sin pisar ningún lomo: de cara junto a su sección, cajas abajo y adorno en los huecos', () => {
    const balda = librosDeLaBalda(
      { libros: [enBalda('a', 'misterio', 3), enBalda('b', 'poesia', 2)] },
      [
        { ...biblio('a', 200), cover: 'https://x/a.jpg' },
        biblio('b', 400),
      ],
    );
    const tramos = estanteLibreria(balda);
    const cosas = atrezzoEstante(tramos, balda, { cajas: 7 });
    const caras = cosas.filter((c) => c.tipo === 'cara');
    expect(caras.map((c) => c.clave).sort()).toEqual(['a', 'b']);
    expect(destacadosDe(balda).find((d) => d.genero === 'misterio').cover).toBe('https://x/a.jpg');
    for (const c of caras) expect(tramos.find((t) => t.genero === c.genero).fila).toBe(c.fila);
    expect(cosas.filter((c) => c.tipo === 'caja')).toHaveLength(2);
    expect(cosas.filter((c) => c.tipo === 'caja').every((c) => c.fila === 0)).toBe(true);
    // Hay de todo y las cuatro filas tienen algo
    expect(new Set(cosas.map((c) => c.tipo)).size).toBeGreaterThanOrEqual(4);
    expect(new Set([...cosas, ...tramos].map((c) => c.fila)).size).toBe(4);
    // Nada se pisa ni se sale de la pared
    const porFila = {};
    for (const t of tramos) (porFila[t.fila] ??= []).push([t.y0, t.y1]);
    for (const c of cosas) (porFila[c.fila] ??= []).push([c.y0, c.y1]);
    for (const xs of Object.values(porFila)) {
      xs.sort((p, q) => p[0] - q[0]);
      for (let k = 1; k < xs.length; k += 1) expect(xs[k][0]).toBeGreaterThanOrEqual(xs[k - 1][1]);
      expect(xs[0][0]).toBeGreaterThanOrEqual(ESTANTERIA.y0);
      expect(xs.at(-1)[1]).toBeLessThanOrEqual(ESTANTERIA.y1);
    }
    // Siempre igual para la misma balda; sin cajas, ninguna
    expect(atrezzoEstante(tramos, balda, { cajas: 7 })).toEqual(cosas);
    expect(atrezzoEstante(tramos, balda).some((c) => c.tipo === 'caja')).toBe(false);
  });

  it('Pilar: solo lo que dominas (12), nunca al excéntrico, y lo nuevo de la carta, a mano hasta dominarlo', () => {
    const dominio = { cafe: 12, te: 11, 'toque:nata': 3 };
    expect(pilarPuede(dominio, 'cafe')).toBe(true);
    expect(pilarPuede(dominio, 'te')).toBe(false);
    expect(pilarPuede(dominio, 'cafe', { excentrico: true })).toBe(false);
    expect(pilarHaceEtapa(dominio, { bebida: 'cafe', grano: 'suave' }, 'grano')).toBe(true);
    expect(pilarHaceEtapa(dominio, { bebida: 'cafe', toque: 'canela' }, 'toque')).toBe(true);
    expect(pilarHaceEtapa(dominio, { bebida: 'cafe', toque: 'nata' }, 'toque')).toBe(false);
    expect(pilarHaceEtapa({ ...dominio, 'toque:nata': 12 }, { bebida: 'cafe', toque: 'nata' }, 'toque')).toBe(true);
    expect(pilarHaceEtapa(dominio, { bebida: 'cafe', grano: 'casa' }, 'grano')).toBe(false);
    expect(pilarHaceEtapa(dominio, { bebida: 'te' }, 'extraer')).toBe(false);
  });
});
