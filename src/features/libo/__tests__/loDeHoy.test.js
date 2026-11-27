// 1.158 · «Lo de hoy», la tarjeta de Libo (docs/qa/libo-lo-de-hoy.md): lo que dice de cada cosa y sus iconos de píxel
import { describe, expect, it } from 'vitest';
import { avisosDeLibo, hoyDeLibo, saludoDeHoy } from '../sugerencias';
import { ICONOS, TINTA, trazos } from '../iconos';

const HOY = '2026-11-22';
const MISIONES = ['sentarse', 'color', 'pasear'];
// Lo mismo que en las sugerencias: nada de rachas, prisas ni pago
const PROHIBIDO = /racha|te lo est[aá]s perdiendo|[uú]ltima oportunidad|date prisa|quedan \d+ (horas|minutos)|compra|pago|ticket|sobre|figura/i;

describe('Lo de hoy · lo que dice el servidor', () => {
  it('sin poder preguntar (sin migración o sin red), Libo no habla de ello', () => {
    expect(hoyDeLibo({})).toEqual({ pendientes: [], hechas: [] });
    expect(
      hoyDeLibo({
        casino: null,
        ruleta: null,
        armario: null,
        misiones: MISIONES,
      }),
    ).toEqual({ pendientes: [], hechas: [] });
  });

  it('el casino cuenta las manos que quedan hoy y, jugadas, pasa a lo hecho', () => {
    const { pendientes } = hoyDeLibo({ casino: { quedan: 2, mesas: [] } });
    expect(pendientes).toEqual([
      expect.objectContaining({
        id: 'casino',
        icono: 'casino',
        titulo: 'Casino · te quedan 2 manos',
        chip: '2',
        ir: 'casino',
      }),
    ]);
    expect(hoyDeLibo({ casino: { quedan: 1, mesas: [] } }).pendientes[0].titulo).toBe('Casino · te queda 1 mano');
    const otra = hoyDeLibo({ casino: { quedan: 0, mesas: [] } });
    expect(otra.pendientes).toEqual([]);
    expect(otra.hechas).toEqual([
      expect.objectContaining({
        id: 'casino',
        titulo: 'Casino · manos jugadas',
      }),
    ]);
  });

  it('las mesas para dos que te esperan van primero; las que tú montaste, no', () => {
    const mesas = [
      { id: 'm1', estado: 'invitada', anfitrion: false },
      { id: 'm2', estado: 'invitada', anfitrion: true },
    ];
    const { pendientes } = hoyDeLibo({ casino: { quedan: 3, mesas } });
    expect(pendientes.map((p) => p.id)).toEqual(['mesa', 'casino']);
    expect(pendientes[0].titulo).toBe('Te esperan en una mesa para dos');
  });

  it('las misiones cuentan solo las tres de hoy, y con las tres hechas pasan a lo hecho', () => {
    const una = hoyDeLibo({
      armario: { hechas: ['color', 'mover'] },
      misiones: MISIONES,
    }).pendientes[0];
    expect(una).toEqual(
      expect.objectContaining({
        id: 'misiones',
        icono: 'misiones',
        titulo: 'Misiones · 1 de 3',
        chip: '1/3',
        ir: 'misiones',
      }),
    );
    expect(
      hoyDeLibo({
        armario: { hechas: ['sentarse', 'color'] },
        misiones: MISIONES,
      }).pendientes[0].gracia,
    ).toBe('La última te espera sentada');
    const todas = hoyDeLibo({
      armario: { hechas: MISIONES },
      misiones: MISIONES,
    });
    expect(todas.pendientes).toEqual([]);
    expect(todas.hechas[0].titulo).toBe('Misiones · 3 de 3');
  });

  it('la ruleta solo sale si esta semana aún no ha girado', () => {
    expect(hoyDeLibo({ ruleta: { giro: null } }).pendientes[0]).toEqual(expect.objectContaining({ id: 'ruleta', icono: 'ruleta', ir: 'casino' }));
    expect(hoyDeLibo({ ruleta: { giro: { casilla: 2 } } })).toEqual({
      pendientes: [],
      hechas: [],
    });
  });

  it('todo lo que dice es tranquilo: sin rachas, prisas ni pago', () => {
    const { pendientes, hechas } = hoyDeLibo({
      casino: { quedan: 2, mesas: [{ estado: 'invitada', anfitrion: false }] },
      ruleta: { giro: null },
      armario: { hechas: [] },
      misiones: MISIONES,
    });
    for (const f of [...pendientes, ...hechas]) expect(`${f.titulo} ${f.gracia}`).not.toMatch(PROHIBIDO);
  });
});

describe('Lo de hoy · los avisos de otros sitios', () => {
  it('cada aviso trae su icono, el dato en corto y su frase', () => {
    const ahora = Date.parse('2026-11-22T10:00:00Z');
    const almacen = {
      rebajados: [{ id: 'sillon', nombre: 'sillón orejero', clave: 'k' }],
      ofertasSinVer: ['k'],
      nuevos: [],
      sinVer: new Set(),
    };
    const lista = avisosDeLibo({
      correo: 2,
      almacen,
      cafe: { hoy: '2026-11-21', pendientes: 0, hucha: 0, t: ahora },
      hoy: HOY,
      ahora,
    });
    expect(lista.map((a) => [a.id, a.icono, a.titulo])).toEqual([
      ['correo', 'buzon', '2 cartas en tu buzón'],
      ['almacen', 'rebaja', 'Sillón orejero, de oferta'],
      ['cafe', 'cafe', 'Clientes en tu café'],
    ]);
    for (const a of lista) {
      expect(a.gracia).toBeTruthy();
      expect(ICONOS[a.icono]).toBeTruthy();
    }
  });

  it('lo nuevo del almacén lleva la caja', () => {
    const almacen = {
      rebajados: [],
      ofertasSinVer: [],
      nuevos: [
        { id: 'a', nombre: 'Foco' },
        { id: 'b', nombre: 'Neón' },
      ],
      sinVer: new Set(['a', 'b']),
    };
    expect(avisosDeLibo({ almacen, hoy: HOY })[0]).toEqual(
      expect.objectContaining({
        icono: 'nuevo',
        titulo: '2 muebles nuevos en el almacén',
      }),
    );
  });
});

describe('Lo de hoy · el saludo', () => {
  it('cuenta lo que queda en palabras y, con todo hecho, se echa la siesta', () => {
    expect(saludoDeHoy({ pendientes: 1 })).toEqual({
      antes: 'Hoy tienes ',
      fuerte: 'una cosa',
      despues: ' por aquí. No corre prisa.',
    });
    expect(saludoDeHoy({ pendientes: 5, hechas: 2 }).fuerte).toBe('cinco cosas');
    expect(saludoDeHoy({ pendientes: 0, hechas: 2 }).despues).toMatch(/siesta/);
    expect(saludoDeHoy({})).toBe(null);
  });
});

describe('Lo de hoy · los iconos de píxel', () => {
  it('todos son de 11 × 11 y solo usan la tinta del kit', () => {
    for (const [nombre, filas] of Object.entries(ICONOS)) {
      expect(filas, nombre).toHaveLength(11);
      for (const fila of filas) {
        expect(fila, nombre).toHaveLength(11);
        for (const c of fila) if (c !== '.') expect(TINTA[c], `${nombre}: ${c}`).toBeTruthy();
      }
    }
  });

  it('se dibujan como un trazo por color, un cuadrado por píxel', () => {
    const t = trazos('hecho');
    expect(t.map((x) => x.color).sort()).toEqual([TINTA.G, TINTA.o].sort());
    const pixeles = ICONOS.hecho.join('').replace(/\./g, '').length;
    expect(t.reduce((n, x) => n + (x.d.match(/M/g) ?? []).length, 0)).toBe(pixeles);
    expect(trazos('no-existe')).toEqual([]);
  });
});
