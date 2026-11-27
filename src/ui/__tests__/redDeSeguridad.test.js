// 1.159 · La red de seguridad (docs/qa/ordenador-negro.md): reconoce un trozo de código perdido y recarga una sola vez
import { describe, expect, it, vi } from 'vitest';
import { esTrozoPerdido, recargarUnaVez } from '../recarga';

const almacen = () => {
  const datos = new Map();
  return { getItem: (k) => datos.get(k) ?? null, setItem: (k, v) => datos.set(k, v) };
};

describe('Red de seguridad · el trozo perdido', () => {
  it('reconoce el mensaje de Safari, Chrome y Firefox', () => {
    expect(esTrozoPerdido(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(esTrozoPerdido(new TypeError('Failed to fetch dynamically imported module: https://libotown.es/assets/PisoDesktop-abc.js'))).toBe(true);
    expect(esTrozoPerdido(new TypeError('error loading dynamically imported module'))).toBe(true);
  });

  it('un fallo cualquiera no es un trozo perdido', () => {
    expect(esTrozoPerdido(new TypeError("undefined is not an object (evaluating 'a.b')"))).toBe(false);
    expect(esTrozoPerdido(null)).toBe(false);
  });
});

describe('Red de seguridad · recargar una vez', () => {
  it('recarga la primera vez y no vuelve a hacerlo antes de 30 s', () => {
    const a = almacen();
    const recargar = vi.fn();
    expect(recargarUnaVez(1000, a, recargar)).toBe(true);
    expect(recargarUnaVez(20000, a, recargar)).toBe(false);
    expect(recargar).toHaveBeenCalledTimes(1);
    expect(recargarUnaVez(40000, a, recargar)).toBe(true);
    expect(recargar).toHaveBeenCalledTimes(2);
  });

  it('sin almacenamiento no recarga (no podría saber si ya lo hizo)', () => {
    const roto = {
      getItem: () => {
        throw new Error('SecurityError');
      },
    };
    const recargar = vi.fn();
    expect(recargarUnaVez(1000, roto, recargar)).toBe(false);
    expect(recargar).not.toHaveBeenCalled();
  });
});
