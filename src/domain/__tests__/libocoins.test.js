import { describe, expect, it } from 'vitest';
import { conLibocoins, libocoinsText, MONEDA } from '../libocoins';
import { ticketsText } from '../../features/edificio/economy';

describe('Libocoins (docs/qa/libocoins.md)', () => {
  it('se llaman así en singular y en plural', () => {
    expect(MONEDA).toEqual({ una: 'Libocoin', varias: 'Libocoins' });
    expect(libocoinsText(1)).toBe('1 Libocoin');
    expect(libocoinsText(0)).toBe('0 Libocoins');
    expect(libocoinsText(25)).toBe('25 Libocoins');
  });

  it('los precios y saldos de la economía usan el nombre nuevo', () => {
    expect(ticketsText(1)).toBe('1 Libocoin');
    expect(ticketsText(46)).toBe('46 Libocoins');
  });

  it('los mensajes del servidor que dicen «tickets» se leen con Libocoins', () => {
    expect(conLibocoins('No tienes tickets suficientes.')).toBe('No tienes Libocoins suficientes.');
    expect(conLibocoins('Di qué buscas: otro mueble, una rareza o unos tickets.')).toBe('Di qué buscas: otro mueble, una rareza o unos Libocoins.');
    expect(conLibocoins('Ese mueble se cambia por entre 5 y 20 tickets.')).toBe('Ese mueble se cambia por entre 5 y 20 Libocoins.');
    expect(conLibocoins('Tickets: 1 ticket')).toBe('Libocoins: 1 Libocoin');
    expect(conLibocoins('Sin conexión.')).toBe('Sin conexión.');
    expect(conLibocoins(undefined)).toBe('');
  });
});
