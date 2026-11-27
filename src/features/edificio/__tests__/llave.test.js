// 1.151 · La llave de tu edificio en el cliente (llave.js): cómo se escribe, el enlace y la llave guardada en el dispositivo.
import { describe, expect, it } from 'vitest';
import { LLAVE_KEY, enlaceLlave, guardarLlavePendiente, llaveBonita, llaveDeHash, llaveLimpia, llavePendiente, olvidarLlavePendiente } from '../llave';

const almacen = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

describe('la llave del edificio en el cliente', () => {
  it('se lee en dos mitades y se limpia como en el servidor', () => {
    expect(llaveBonita('KLMN2345')).toBe('KLMN-2345');
    expect(llaveBonita('')).toBe('');
    expect(llaveLimpia(' klmn-23 45 ')).toBe('KLMN2345');
  });

  it('el enlace lleva el código en el fragmento, que no llega al servidor', () => {
    expect(enlaceLlave('KLMN2345', 'https://libotown.es')).toBe('https://libotown.es/#llave=KLMN2345');
    expect(llaveDeHash('#llave=klmn2345')).toBe('KLMN2345');
    // Solo letras y cifras que no se confunden (sin I, O, 0 ni 1), y exactamente 8
    expect(llaveDeHash('#llave=KLMN0345')).toBeNull();
    expect(llaveDeHash('#llave=KLMN234')).toBeNull();
    expect(llaveDeHash('#club=abc')).toBeNull();
    expect(llaveDeHash('')).toBeNull();
  });

  it('la llave de un enlace se guarda 7 días en el dispositivo', () => {
    const s = almacen();
    const ahora = Date.parse('2026-11-26T10:00:00Z');
    guardarLlavePendiente('KLMN2345', s, ahora);
    expect(JSON.parse(s.getItem(LLAVE_KEY))).toEqual({ codigo: 'KLMN2345', en: ahora });
    expect(llavePendiente(s, ahora + 6 * 86400000)).toBe('KLMN2345');
    expect(llavePendiente(s, ahora + 7 * 86400000)).toBeNull();
    olvidarLlavePendiente(s);
    expect(llavePendiente(s, ahora)).toBeNull();
    // Basura en el almacén o sin almacén: nada
    s.setItem(LLAVE_KEY, '{roto');
    expect(llavePendiente(s, ahora)).toBeNull();
    expect(llavePendiente(null, ahora)).toBeNull();
  });
});
