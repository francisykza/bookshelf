// Libo, el gato guía (docs/qa/libo.md): su modo y los capítulos vistos, en los ajustes de la biblioteca.
import { describe, expect, it } from 'vitest';
import { BIENVENIDA, CAPITULOS, LIBO_KEY, MODOS, MODO_INICIAL, SALUDOS, abrePorSuCuenta, cambiarModo, estaVisible, haVisto, liboDe, marcarPresentadoAqui, marcarVisto, presentadoAqui } from '../libo';

describe('Libo en los ajustes', () => {
  it('sin nada guardado (o con datos rotos) sugiere y no ha enseñado nada', () => {
    for (const settings of [{}, undefined, { libo: null }, { libo: 'x' }, { libo: { modo: 'otro', vistos: 'hola' } }]) {
      expect(liboDe(settings)).toEqual({ modo: MODO_INICIAL, vistos: [], dia: null, callados: {} });
    }
    expect(MODO_INICIAL).toBe('sugiere');
    expect(liboDe({ libo: { vistos: ['hola', 3, null] } }).vistos).toEqual(['hola']);
  });

  it('marca capítulos una sola vez y conserva el modo', () => {
    const a = { libo: { modo: 'llamar', vistos: [] } };
    const p = marcarVisto(a, 'bienvenida');
    expect(p).toMatchObject({ libo: { modo: 'llamar', vistos: ['bienvenida'] } });
    const b = { ...a, ...p };
    expect(haVisto(b, 'bienvenida')).toBe(true);
    expect(marcarVisto(b, 'bienvenida')).toBeNull();
  });

  it('solo abre un capítulo por su cuenta si sugiere y no lo has visto', () => {
    expect(abrePorSuCuenta({}, 'bienvenida')).toBe(true);
    expect(abrePorSuCuenta({ libo: { vistos: ['bienvenida'] } }, 'bienvenida')).toBe(false);
    expect(abrePorSuCuenta({ libo: { modo: 'llamar' } }, 'bienvenida')).toBe(false);
    expect(abrePorSuCuenta({ libo: { modo: 'descansa' } }, 'bienvenida')).toBe(false);
  });

  it('descansar le quita de la esquina; los demás modos le dejan a la vista', () => {
    expect(estaVisible({})).toBe(true);
    expect(estaVisible({ libo: { modo: 'llamar' } })).toBe(true);
    expect(estaVisible({ libo: { modo: 'descansa' } })).toBe(false);
  });

  it('cambia de modo sin perder lo visto, y no acepta modos inventados', () => {
    const s = { libo: { modo: 'sugiere', vistos: ['hola'] } };
    expect(cambiarModo(s, 'descansa')).toMatchObject({ libo: { modo: 'descansa', vistos: ['hola'] } });
    expect(cambiarModo(s, 'charlar')).toBeNull();
    expect(Object.keys(MODOS)).toEqual(['sugiere', 'llamar', 'descansa']);
  });
});

describe('marca del dispositivo', () => {
  it('recuerda qué capítulos abrió Libo aquí, y sin almacenamiento no falla', () => {
    const m = new Map();
    const storage = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
    expect(presentadoAqui('bienvenida', storage)).toBe(false);
    marcarPresentadoAqui(['hola', 'bienvenida'], storage);
    expect(JSON.parse(m.get(LIBO_KEY))).toEqual(['hola', 'bienvenida']);
    expect(presentadoAqui('bienvenida', storage)).toBe(true);
    expect(presentadoAqui('cafe', storage)).toBe(false);
    marcarPresentadoAqui('cafe', storage);
    expect(presentadoAqui('cafe', storage)).toBe(true);
    expect(JSON.parse(m.get(LIBO_KEY))).toEqual(['hola', 'bienvenida', 'cafe']);
    const roto = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('bloqueado'); } };
    expect(presentadoAqui('bienvenida', roto)).toBe(false);
    expect(() => marcarPresentadoAqui('cafe', roto)).not.toThrow();
  });

  it('la marca del bloque 1 («presentado») vale como el saludo y la bienvenida, no como los sitios nuevos', () => {
    const m = new Map([[LIBO_KEY, 'presentado']]);
    const storage = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
    expect(presentadoAqui('hola', storage)).toBe(true);
    expect(presentadoAqui('bienvenida', storage)).toBe(true);
    expect(presentadoAqui('edificio', storage)).toBe(false);
    marcarPresentadoAqui('edificio', storage);
    expect(JSON.parse(m.get(LIBO_KEY))).toEqual(['hola', 'bienvenida', 'edificio']);
    // Datos rotos: como si no hubiera nada
    m.set(LIBO_KEY, '{roto');
    expect(presentadoAqui('hola', storage)).toBe(false);
  });
});

describe('la bienvenida', () => {
  it('empieza saludando, termina en su esquina y no habla de las figuras', () => {
    expect(BIENVENIDA[0].id).toBe('hola');
    expect(BIENVENIDA[0].ancla).toBeNull();
    expect(BIENVENIDA.at(-1).ancla).toBe('.libo-rincon__gato');
    const textos = [...BIENVENIDA.flatMap((p) => [p.titulo, p.texto({ leyendo: true }), p.texto({ leyendo: false })]), ...Object.values(SALUDOS)].join(' ');
    expect(textos).not.toMatch(/figura|ático|caja sorpresa|guardián/i);
  });

  it('la lectura cambia según estés leyendo o no', () => {
    const lectura = BIENVENIDA.find((p) => p.id === 'lectura');
    expect(lectura.texto({ leyendo: true })).toMatch(/apunta por qué página vas/);
    expect(lectura.texto({ leyendo: false })).toMatch(/eliges lo que vas a leer/);
  });
});

describe('los capítulos de cada sitio', () => {
  it('cada sitio tiene su capítulo, empieza saludando sin señalar nada y cada paso tiene un control distinto', () => {
    expect(Object.keys(CAPITULOS)).toEqual(['bienvenida', 'edificio', 'tu-piso', 'cafe', 'hotel', 'comunidad']);
    for (const [id, { pasos, repaso }] of Object.entries(CAPITULOS)) {
      expect(pasos[0].id, id).toBe('hola');
      expect(pasos[0].ancla, id).toBeNull();
      expect(pasos.length, id).toBeGreaterThanOrEqual(4);
      expect(repaso, id).toMatch(/^Repasar /);
      const anclas = pasos.slice(1).map((p) => p.ancla);
      expect(new Set(anclas).size, id).toBe(anclas.length);
      expect(new Set(pasos.map((p) => p.id)).size, id).toBe(pasos.length);
      expect(SALUDOS[id === 'bienvenida' ? 'piso' : id], id).toBeTruthy();
    }
  });

  it('en el café, Libo presenta a Pilar y se aparta', () => {
    const ids = CAPITULOS.cafe.pasos.map((p) => p.id);
    expect(ids.indexOf('pilar')).toBe(ids.length - 2);
    expect(CAPITULOS.cafe.pasos.at(-1).ancla).toBe('.libo-rincon__gato');
  });

  it('textos cortos, sin figuras ni cosas retiradas (sobres, reciclaje, pizarra)', () => {
    for (const { pasos } of Object.values(CAPITULOS)) {
      for (const p of pasos) {
        const t = p.texto({ leyendo: false });
        expect(t.length, p.id).toBeLessThanOrEqual(170);
        expect(`${p.titulo} ${t}`).not.toMatch(/figura|ático|caja sorpresa|guardián|sobre|reciclar|pizarra/i);
      }
    }
  });
});
