// 1.118 (§118) · Los gestos cerrados: la misma lista en la app y en el servidor, y el tiempo de la placa.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GESTOS, METALES, gestoDe, tiempoJuntos } from '../gestos';

const sql = readFileSync(new URL('../../../../../supabase/migrations/20261207120000_sala_parejas.sql', import.meta.url), 'utf8');

describe('los gestos de la sala', () => {
  it('son los mismos siete que deja el servidor, en el mismo orden', () => {
    const check = /gesto in \(([^)]+)\)/.exec(sql)[1];
    const servidor = check.split(',').map((x) => x.trim().replace(/'/g, ''));
    expect(GESTOS.map((g) => g.id)).toEqual(servidor);
    expect(GESTOS).toHaveLength(7);
  });
  it('cada uno tiene botón, bocadillo y frase, sin texto libre', () => {
    for (const g of GESTOS) {
      expect(g.boton.length).toBeGreaterThan(0);
      expect(g.bocadillo.length).toBeLessThanOrEqual(20);
      expect(g.frase('Bea')).toMatch(/^Bea/);
    }
    expect(gestoDe('noches').frase('Bea')).toBe('Bea te da las buenas noches.');
    // Un gesto desconocido se lee como el saludo de siempre
    expect(gestoDe('otro').id).toBe('hola');
  });
});

describe('el tiempo juntos de la placa', () => {
  it('en minutos y horas', () => {
    expect(tiempoJuntos(0)).toBe('0 min');
    expect(tiempoJuntos(45)).toBe('45 min');
    expect(tiempoJuntos(60)).toBe('1 h');
    expect(tiempoJuntos(200)).toBe('3 h 20 min');
    expect(tiempoJuntos(3120)).toBe('52 h');
  });
  it('tres metales, sin más', () => {
    expect(Object.keys(METALES)).toEqual(['laton', 'plata', 'oro']);
  });
});
