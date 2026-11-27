import { describe, expect, it } from 'vitest';
import { liboDe, marcarVisto } from '../libo';
import { asomoAqui, avisosDeLibo, callar, debeAsomar, fijarDia, guardarCafeLibo, ideaAhora, leerCafeLibo, marcarAsomoAqui, sugerenciaDelDia, sugerencias, sugerenciasDeAmigos, textoPlano } from '../sugerencias';

const HOY = '2026-11-22';
const memoria = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
};
const libro = (id, extra = {}) => ({ id, title: `Libro ${id}`, status: 'want', review: '', rating: null, addedAt: '2026-01-01T10:00:00.000Z', startedAt: null, finishedAt: null, ...extra });
const PROHIBIDO = /racha|te lo est[aá]s perdiendo|[uú]ltima oportunidad|date prisa|quedan \d+ (horas|minutos)|compra|pago|ticket|sobre|figura/i;

describe('Libo · avisos reunidos', () => {
  const almacen = {
    rebajados: [{ id: 'sillon', nombre: 'Sillón orejero', clave: 'sillon@2026-11-22' }],
    ofertasSinVer: ['sillon@2026-11-22'],
    nuevos: [{ id: 'foco-heroe', nombre: 'Foco de héroe' }],
    sinVer: new Set(['foco-heroe']),
  };

  it('sin nada pendiente, no hay avisos', () => {
    expect(avisosDeLibo({ hoy: HOY })).toEqual([]);
  });

  it('lo que sigues rebajado va antes que lo nuevo, y lo que el monitor ya avisó no se repite', () => {
    const [a] = avisosDeLibo({ almacen, hoy: HOY });
    expect(a.ir).toBe('almacen');
    expect(textoPlano(a.partes)).toBe('Lo que sigues está de oferta hoy en el almacén: sillón orejero.');
    const [b] = avisosDeLibo({ almacen, monitorVistos: ['o:sillon@2026-11-22'], hoy: HOY });
    expect(textoPlano(b.partes)).toBe('Ha llegado algo nuevo al almacén: foco de héroe.');
    expect(avisosDeLibo({ almacen, monitorVistos: ['o:sillon@2026-11-22', 'n:foco-heroe'], hoy: HOY })).toEqual([]);
  });

  it('el café avisa de clientes cada día nuevo y el mismo día solo si quedan', () => {
    const ahora = Date.parse('2026-11-22T10:00:00Z');
    expect(avisosDeLibo({ cafe: { hoy: HOY, pendientes: 0, hucha: 0, t: ahora }, hoy: HOY, ahora })).toEqual([]);
    expect(textoPlano(avisosDeLibo({ cafe: { hoy: HOY, pendientes: 2, hucha: 0, t: ahora }, hoy: HOY, ahora })[0].partes)).toBe('Tu café tiene clientes esperando.');
    expect(avisosDeLibo({ cafe: { hoy: '2026-11-21', pendientes: 0, hucha: 0, t: ahora }, hoy: HOY, ahora })[0].ir).toBe('cafe');
  });

  it('la hucha solo avisa un día entero después de tu última visita', () => {
    const t = Date.parse('2026-11-21T20:00:00Z');
    expect(avisosDeLibo({ cafe: { hoy: HOY, pendientes: 0, hucha: 1, t }, hoy: HOY, ahora: t + 23 * 3600000 })).toEqual([]);
    const [a] = avisosDeLibo({ cafe: { hoy: HOY, pendientes: 0, hucha: 1, t }, hoy: HOY, ahora: t + 24 * 3600000 });
    expect(textoPlano(a.partes)).toMatch(/hucha/);
  });

  it('el buzón cuenta las cartas sin leer', () => {
    expect(textoPlano(avisosDeLibo({ correo: 1, hoy: HOY })[0].partes)).toMatch(/una carta/);
    expect(textoPlano(avisosDeLibo({ correo: 3, hoy: HOY })[0].partes)).toMatch(/3 cartas/);
  });

  it('lo que apunta el café se lee igual y lo roto no cuenta', () => {
    const s = memoria();
    expect(leerCafeLibo('u1', s)).toBe(null);
    guardarCafeLibo('u1', { pendientes: 2, hucha: 1 }, { hoy: HOY, ahora: 5 }, s);
    expect(leerCafeLibo('u1', s)).toEqual({ hoy: HOY, pendientes: 2, hucha: 1, t: 5 });
    expect(leerCafeLibo('u2', s)).toBe(null);
    s.setItem('bookshelf:libo-cafe:u3', '{"hoy":"ayer"}');
    expect(leerCafeLibo('u3', s)).toBe(null);
  });
});

describe('Libo · la sugerencia del día', () => {
  it('estantería vacía: añadir el primer libro', () => {
    const [s] = sugerencias({ books: [], vistos: ['edificio', 'cafe', 'hotel'], hoy: HOY });
    expect(s.id).toBe('vacia');
    expect(s.acciones[0].ir).toBe('anadir');
  });

  it('un libro terminado hace poco y sin reseña; uno antiguo o ya reseñado, no', () => {
    const books = [
      libro('a', { status: 'read', finishedAt: '2026-11-20T18:00:00.000Z' }),
      libro('b', { status: 'read', finishedAt: '2026-09-01T18:00:00.000Z' }),
      libro('c', { status: 'read', finishedAt: '2026-11-21T18:00:00.000Z', review: 'Me encantó' }),
      libro('d', { status: 'read', finishedAt: '2026-11-21T18:00:00.000Z', rating: 4 }),
    ];
    const lista = sugerencias({ books, vistos: ['edificio', 'cafe', 'hotel'], hoy: HOY });
    expect(lista.map((s) => s.id)).toEqual(['resena:a']);
    expect(textoPlano(lista[0].partes)).toBe('Terminaste Libro a. ¿Le dejas una reseña?');
    expect(lista[0].acciones[0]).toMatchObject({ ir: 'resena', libro: 'a' });
  });

  it('un libro de «Leyendo» sin abrir en tres semanas (por su último registro)', () => {
    const books = [libro('a', { status: 'reading', startedAt: '2026-09-01T10:00:00.000Z' }), libro('b', { status: 'reading', startedAt: '2026-09-01T10:00:00.000Z' })];
    const log = [{ bookId: 'b', date: '2026-11-15' }];
    const lista = sugerencias({ books, log, vistos: ['edificio', 'cafe', 'hotel'], hoy: HOY });
    expect(lista.map((s) => s.id)).toEqual(['parado:a']);
    expect(lista[0].acciones.map((a) => a.ir)).toEqual(['callar', 'ficha']);
  });

  it('los sitios del edificio sin ver, solo con piso en el edificio', () => {
    const books = [libro('a')];
    expect(sugerencias({ books, vistos: ['edificio'], hoy: HOY }).map((s) => s.id)).toEqual(['ver:cafe', 'ver:hotel']);
    expect(sugerencias({ books, vistos: [], edificio: false, hoy: HOY })).toEqual([]);
  });

  it('una al día: la de hoy se mantiene y, contestada, no llega otra hasta mañana', () => {
    const books = [libro('a', { status: 'read', finishedAt: '2026-11-20T18:00:00.000Z' })];
    let settings = {};
    const lista = sugerencias({ books, settings, vistos: [], hoy: HOY });
    const deHoy = sugerenciaDelDia(lista, settings, HOY);
    expect(deHoy.id).toBe('resena:a');
    settings = { ...settings, ...fijarDia(settings, HOY, deHoy.id, true) };
    settings = { ...settings, ...callar(settings, deHoy.id, HOY) };
    const despues = sugerencias({ books, settings, vistos: [], hoy: HOY });
    expect(despues.map((s) => s.id)).toEqual(['ver:edificio', 'ver:cafe', 'ver:hotel']);
    expect(sugerenciaDelDia(despues, settings, HOY)).toBe(null);
    // Mañana, la siguiente; la callada vuelve pasados 30 días
    expect(sugerenciaDelDia(despues, settings, '2026-11-23').id).toBe('ver:edificio');
    expect(sugerencias({ books, settings, vistos: ['edificio', 'cafe', 'hotel'], hoy: '2026-12-22' }).map((s) => s.id)).toEqual([]);
  });

  it('si la de ayer se quedó sin contestar, hoy otra distinta', () => {
    const lista = sugerencias({ books: [libro('a')], vistos: [], hoy: HOY });
    const settings = fijarDia({}, '2026-11-21', 'ver:edificio', true);
    expect(sugerenciaDelDia(lista, settings, HOY).id).toBe('ver:cafe');
    expect(sugerenciaDelDia([lista[0]], settings, HOY).id).toBe('ver:edificio');
  });

  it('«¿Qué hago ahora?» da otra idea, o una tranquila con lo que tienes', () => {
    const books = [libro('a', { status: 'reading', startedAt: '2026-11-20T10:00:00.000Z' })];
    const idea = ideaAhora({ candidatas: [], books });
    expect(idea.acciones[0].ir).toBe('registrar');
    expect(ideaAhora({ candidatas: [], books: [libro('b')] }).acciones[0].ir).toBe('biblioteca');
    expect(ideaAhora({ candidatas: [], books: [], edificio: true }).acciones[0].ir).toBe('edificio');
  });

  it('los textos son cortos, con calma y sin presión', () => {
    const books = [libro('a', { status: 'read', finishedAt: '2026-11-20T18:00:00.000Z' }), libro('b', { status: 'reading', startedAt: '2026-09-01T10:00:00.000Z' }), libro('c')];
    const todo = [
      ...sugerencias({ books, vistos: [], hoy: HOY }),
      ...sugerencias({ books: [], vistos: [], hoy: HOY }),
      ...avisosDeLibo({ correo: 2, cafe: { hoy: '2026-11-21', pendientes: 0, hucha: 2, t: 0 }, almacen: { rebajados: [], ofertasSinVer: [], nuevos: [{ id: 'x', nombre: 'Algo' }, { id: 'y', nombre: 'Otro' }], sinVer: new Set(['x', 'y']) }, hoy: HOY, ahora: Date.now() }),
      ideaAhora({ books }),
      ideaAhora({ books: [libro('d')] }),
    ];
    for (const s of todo) {
      const t = textoPlano(s.partes);
      expect(t.length).toBeLessThanOrEqual(110);
      expect(t).not.toMatch(PROHIBIDO);
      expect(t).not.toMatch(/!/);
    }
  });
});

describe('Libo · el bocadillo asoma una vez al día', () => {
  it('solo si sugiere, tiene algo que decir y hoy no ha asomado', () => {
    expect(debeAsomar({}, { hoy: HOY, hayAlgo: true })).toBe(true);
    expect(debeAsomar({}, { hoy: HOY, hayAlgo: false })).toBe(false);
    expect(debeAsomar({ libo: { modo: 'llamar' } }, { hoy: HOY, hayAlgo: true })).toBe(false);
    expect(debeAsomar({}, { hoy: HOY, hayAlgo: true, aqui: true })).toBe(false);
    const settings = fijarDia({}, HOY, null, true);
    expect(debeAsomar(settings, { hoy: HOY, hayAlgo: true })).toBe(false);
    expect(debeAsomar(settings, { hoy: '2026-11-23', hayAlgo: true })).toBe(true);
  });

  it('la marca del aparato vale para hoy (y una fecha posterior, para las pruebas)', () => {
    const s = memoria();
    expect(asomoAqui(HOY, s)).toBe(false);
    marcarAsomoAqui(HOY, s);
    expect(asomoAqui(HOY, s)).toBe(true);
    expect(asomoAqui('2026-11-23', s)).toBe(false);
    s.setItem('bookshelf:libo-asomo', '9999-12-31');
    expect(asomoAqui(HOY, s)).toBe(true);
  });

  it('fijar el día y callar no pierden el modo ni los capítulos vistos', () => {
    let settings = { libo: { modo: 'llamar', vistos: ['hola'] } };
    settings = { ...settings, ...fijarDia(settings, HOY, 'ver:cafe', false) };
    settings = { ...settings, ...callar(settings, 'ver:cafe', HOY) };
    settings = { ...settings, ...marcarVisto(settings, 'cafe') };
    expect(liboDe(settings)).toEqual({ modo: 'llamar', vistos: ['hola', 'cafe'], dia: { fecha: HOY, sugerencia: 'ver:cafe', asomo: false }, callados: { 'ver:cafe': HOY } });
    expect(fijarDia(settings, HOY, 'otra', false)).toBe(null);
  });
});

// 1.154 · Libo y los amigos (docs/qa/amigos-vecinos.md, bloque 4)
describe('Libo · lo de tus amigos', () => {
  const AGENDA = {
    llaves: [{ codigo: 'ABCDEFGH', alias: 'Bruno' }],
    recomendaciones: [
      { id: 'r1', alias: 'Carla', titulo: 'Orgullo y prejuicio', vista: false },
      { id: 'r0', alias: 'Carla', titulo: 'Visto ya', vista: true },
    ],
    amigos: [
      { user_id: 'u-bruno', alias: 'Bruno', terminados: [{ titulo: 'REBECA', fecha: '2026-11-20' }, { titulo: 'Drácula', fecha: '2026-11-20' }] },
      { user_id: 'u-dani', alias: 'Dani', terminados: [{ titulo: 'Rebeca', fecha: '2026-10-01' }] },
      { user_id: 'u-eva', alias: 'Eva', terminados: null },
    ],
  };
  const BOOKS = [libro('rebeca', { title: 'Rebeca' }), libro('dracula', { title: 'Drácula', status: 'read' })];

  it('una llave, una recomendación sin ver y un amigo que terminó hace poco algo que quieres leer', () => {
    const lista = sugerenciasDeAmigos(AGENDA, BOOKS, HOY);
    expect(lista.map((s) => s.id)).toEqual(['amigo-llave:ABCDEFGH', 'amigo-recomienda:r1', 'amigo-termino:u-bruno:rebeca']);
    expect(textoPlano(lista[0].partes)).toBe('Bruno te ha dado la llave de su edificio. Si os apetece ser vecinos, la tienes en tu agenda de Amigos.');
    expect(textoPlano(lista[1].partes)).toBe('Carla te ha recomendado Orgullo y prejuicio. ¿Le echas un vistazo?');
    expect(textoPlano(lista[2].partes)).toBe('Bruno ha terminado Rebeca, que tienes en «Quiero leer». Por si te anima a empezarlo.');
    expect(lista[2].acciones).toEqual([
      { ir: 'ficha', libro: 'rebeca', boton: 'Ver su ficha' },
      { ir: 'amigos', boton: 'Abrir Amigos' },
    ]);
    for (const s of lista) expect(textoPlano(s.partes)).not.toMatch(PROHIBIDO);
    expect(sugerenciasDeAmigos(null, BOOKS, HOY)).toEqual([]);
  });

  it('entran en la sugerencia del día (una al día) después de las reseñas, y contestadas se callan un mes', () => {
    const resena = libro('fin', { status: 'read', finishedAt: '2026-11-20T10:00:00.000Z' });
    const todas = sugerencias({ books: [...BOOKS, resena], amigos: AGENDA, edificio: false, hoy: HOY });
    expect(todas[0].id).toBe('resena:fin');
    expect(todas[1].id).toBe('amigo-llave:ABCDEFGH');
    const callado = callar({}, 'amigo-llave:ABCDEFGH', HOY);
    const despues = sugerencias({ books: BOOKS, amigos: AGENDA, settings: callado, edificio: false, hoy: HOY });
    expect(despues.map((s) => s.id)).not.toContain('amigo-llave:ABCDEFGH');
    expect(sugerenciaDelDia(despues, callado, HOY).id).toBe('amigo-recomienda:r1');
  });
});
