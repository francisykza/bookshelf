// 1.100 · Las ofertas del almacén en el cliente: el mismo precio que cobra el servidor y nada raro del estado.
import { describe, expect, it } from 'vitest';
import { mapaOfertas, precioOferta } from '../hotel/ofertas';

describe('ofertas del almacén', () => {
  it('el precio de oferta redondea el descuento a la baja, como el servidor', () => {
    expect(precioOferta(20, 20)).toBe(16);
    expect(precioOferta(40, 50)).toBe(20);
    expect(precioOferta(25, 20)).toBe(20);
    expect(precioOferta(33, 50)).toBe(17);
    expect(precioOferta(20)).toBe(20);
    expect(precioOferta(20, -5)).toBe(20);
  });

  it('solo se leen ofertas con forma de oferta; la primera de cada mueble manda', () => {
    const m = mapaOfertas([{ id: 'mesa', pct: 20, tipo: 'dia' }, { id: 'reloj', pct: 50, tipo: 'semana' }, { id: 'mesa', pct: 90 }, { id: 'x', pct: 0 }, { id: 'y', pct: 2.5 }, null, { pct: 20 }]);
    expect([...m.keys()]).toEqual(['mesa', 'reloj']);
    expect(m.get('mesa')).toEqual({ id: 'mesa', pct: 20, tipo: 'dia' });
    expect(m.get('reloj').tipo).toBe('semana');
    expect(mapaOfertas(undefined).size).toBe(0);
  });
});
