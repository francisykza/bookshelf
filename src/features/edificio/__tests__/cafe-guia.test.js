// 1.150 · La guía del café en sus menús y botones (bloque 2): qué pasos tocan, con su saludo solo cuando hace falta, lo visto
// por separado (así lo nuevo sale solo) y las dos voces completas.
import { describe, expect, it } from 'vitest';
import { CAPITULOS_CAFE, guiaCafeDe, marcarVistos, pasosDe, textoDe } from '../cafe/cafeGuia';

const todo = () => true;
const solo =
  (...selectores) =>
  (sel) =>
    selectores.some((s) => sel.includes(s));

describe('la guía del café', () => {
  it('cada paso tiene título, ancla única y lo que dicen Olmo y Pilar, distinto', () => {
    for (const [cap, pasos] of Object.entries(CAPITULOS_CAFE)) {
      const ids = pasos.map((p) => p.id);
      expect(new Set(ids).size, cap).toBe(ids.length);
      const anclas = pasos.filter((p) => p.ancla).map((p) => p.ancla);
      expect(new Set(anclas).size, cap).toBe(anclas.length);
      for (const p of pasos) {
        expect(p.titulo.length).toBeGreaterThan(2);
        expect(textoDe(p, 'olmo').length).toBeGreaterThan(10);
        expect(textoDe(p, 'pilar').length).toBeGreaterThan(10);
        expect(['normal', 'contento', 'apunta', 'lee']).toContain(p.pose);
      }
      // Olmo habla a su manera: al menos la mitad de sus frases son suyas
      const distintas = pasos.filter((p) => p.texto.olmo !== p.texto.pilar).length;
      expect(distintas * 2).toBeGreaterThanOrEqual(pasos.length);
    }
  });

  it('la primera vez: saludo, los botones que se ven y despedida', () => {
    const pasos = pasosDe('local', {}, solo('retrato', 'atender', 'decorar', 'libros-btn'));
    expect(pasos.map((p) => p.id)).toEqual(['hola', 'retrato', 'atender', 'decorar', 'libros', 'fin']);
  });

  it('lo visto no vuelve a salir solo; un botón nuevo sale solo él, sin ceremonia', () => {
    const vistos = marcarVistos({}, 'local', pasosDe('local', {}, solo('retrato', 'atender', 'decorar')));
    const settings = { ...vistos };
    expect(pasosDe('local', settings, solo('retrato', 'atender', 'decorar'))).toEqual([]);
    expect(pasosDe('local', settings, solo('retrato', 'atender', 'decorar', 'cuaderno-btn')).map((p) => p.id)).toEqual(['cuaderno']);
  });

  it('el repaso (el retrato) enseña todo lo que se ve, con saludo y despedida', () => {
    const settings = marcarVistos({}, 'local', CAPITULOS_CAFE.local);
    expect(pasosDe('local', settings, solo('retrato', 'atender'), { todos: true }).map((p) => p.id)).toEqual(['hola', 'retrato', 'atender', 'fin']);
  });

  it('nada que se vea, nada que enseñar; marcar dos veces no cambia nada', () => {
    expect(pasosDe('local', {}, () => false)).toEqual([]);
    const s = marcarVistos({}, 'decorar', CAPITULOS_CAFE.decorar);
    expect(guiaCafeDe(s).vistos).toHaveLength(CAPITULOS_CAFE.decorar.length);
    expect(marcarVistos(s, 'decorar', CAPITULOS_CAFE.decorar)).toBeNull();
    expect(pasosDe('decorar', {}, todo).length).toBeGreaterThan(0);
  });

  it('los ajustes rotos o antiguos no rompen nada', () => {
    expect(guiaCafeDe({ guiaCafe: 'x' }).vistos).toEqual([]);
    expect(guiaCafeDe({ guiaCafe: { vistos: [1, 'local:hola'] } }).vistos).toEqual(['local:hola']);
    expect(pasosDe('no-existe', {}, todo)).toEqual([]);
  });
});
