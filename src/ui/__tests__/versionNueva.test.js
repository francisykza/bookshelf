// 1.162.2 · La versión nueva llega de verdad (src/ui/versionNueva.js): al volver a la app con una versión nueva puesta, se
// recarga; nunca escribiendo ni en la primera instalación; y cada vuelta (como mucho cada 15 minutos) se pregunta si hay otra.
import { describe, expect, it, vi } from 'vitest';
import { BUSCAR_CADA_MS, escribiendo, vigilarVersion } from '../versionNueva';

/** Un emisor de eventos mínimo (el navegador de las pruebas de dominio no tiene DOM). */
function emisor(extra = {}) {
  const oyentes = {};
  return {
    ...extra,
    addEventListener: (t, f) => (oyentes[t] ??= new Set()).add(f),
    removeEventListener: (t, f) => oyentes[t]?.delete(f),
    emitir: (t) => oyentes[t]?.forEach((f) => f()),
  };
}

function montar({ controller = {}, activo = null } = {}) {
  const sw = emisor({ controller });
  const doc = emisor({ visibilityState: 'visible', activeElement: activo });
  const waiting = { postMessage: vi.fn() };
  const reg = { waiting, update: vi.fn(() => Promise.resolve()) };
  const recargar = vi.fn();
  let t = 0;
  const reloj = { avanza: (ms) => (t += ms) };
  const soltar = vigilarVersion(sw, reg, { doc, recargar, ahora: () => t });
  const fuera = () => {
    doc.visibilityState = 'hidden';
    doc.emitir('visibilitychange');
  };
  const vuelve = () => {
    doc.visibilityState = 'visible';
    doc.emitir('visibilitychange');
  };
  return { sw, doc, reg, waiting, recargar, reloj, soltar, fuera, vuelve };
}

describe('versionNueva', () => {
  it('al pasar a segundo plano, pone la versión que espera', () => {
    const m = montar();
    m.fuera();
    expect(m.waiting.postMessage).toHaveBeenCalledWith('activar-version');
  });

  it('si se puso una versión nueva mientras estabas fuera, al volver recarga (una vez)', () => {
    const m = montar();
    m.fuera();
    m.sw.emitir('controllerchange');
    m.vuelve();
    expect(m.recargar).toHaveBeenCalledTimes(1);
    m.fuera();
    m.vuelve();
    expect(m.recargar).toHaveBeenCalledTimes(1);
  });

  it('sin versión nueva, volver no recarga', () => {
    const m = montar();
    m.fuera();
    m.vuelve();
    expect(m.recargar).not.toHaveBeenCalled();
  });

  it('la primera instalación (sin controlador al abrir) no recarga', () => {
    const m = montar({ controller: null });
    m.sw.emitir('controllerchange');
    m.fuera();
    m.vuelve();
    expect(m.recargar).not.toHaveBeenCalled();
  });

  it('escribiendo en un campo no recarga: espera a la próxima vuelta', () => {
    const campo = { tagName: 'TEXTAREA' };
    const m = montar({ activo: campo });
    m.sw.emitir('controllerchange');
    m.fuera();
    m.vuelve();
    expect(m.recargar).not.toHaveBeenCalled();
    m.doc.activeElement = { tagName: 'BUTTON' };
    m.fuera();
    m.vuelve();
    expect(m.recargar).toHaveBeenCalledTimes(1);
  });

  it('pregunta por una versión nueva al volver, como mucho cada 15 minutos', () => {
    const m = montar();
    m.fuera();
    m.vuelve();
    expect(m.reg.update).not.toHaveBeenCalled();
    m.reloj.avanza(BUSCAR_CADA_MS);
    m.fuera();
    m.vuelve();
    expect(m.reg.update).toHaveBeenCalledTimes(1);
    m.reloj.avanza(60000);
    m.fuera();
    m.vuelve();
    expect(m.reg.update).toHaveBeenCalledTimes(1);
  });

  it('al soltarlo deja de vigilar', () => {
    const m = montar();
    m.soltar();
    m.sw.emitir('controllerchange');
    m.fuera();
    m.vuelve();
    expect(m.recargar).not.toHaveBeenCalled();
    expect(m.waiting.postMessage).not.toHaveBeenCalled();
  });

  it('qué cuenta como escribir', () => {
    const doc = (activeElement) => ({ activeElement });
    expect(escribiendo(doc({ tagName: 'INPUT', type: 'text' }))).toBe(true);
    expect(escribiendo(doc({ tagName: 'INPUT', type: 'checkbox' }))).toBe(false);
    expect(escribiendo(doc({ tagName: 'DIV', isContentEditable: true }))).toBe(true);
    expect(escribiendo(doc({ tagName: 'BUTTON' }))).toBe(false);
    expect(escribiendo(doc(null))).toBe(false);
  });
});
