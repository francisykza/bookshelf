import { describe, expect, it } from 'vitest';
import { DIRECCION, HOSTS_PRODUCCION, esDireccionAntigua, esProduccion } from '../direcciones';

describe('direcciones de Libotown (§136.6)', () => {
  it('libotown.es, su www y la dirección de antes son producción', () => {
    expect(HOSTS_PRODUCCION).toEqual(['libotown.es', 'www.libotown.es', 'bookshelf-wine-iota.vercel.app']);
    for (const host of HOSTS_PRODUCCION) expect(esProduccion(host)).toBe(true);
    expect(esProduccion('LIBOTOWN.ES')).toBe(true);
    expect(esProduccion('libotown.es.')).toBe(true);
  });

  it('las previews y el ordenador no son producción', () => {
    for (const host of ['localhost', '127.0.0.1', 'bookshelf-git-piso.vercel.app', 'libotown.es.example.com', 'otro.libotown.es', '', undefined]) {
      expect(esProduccion(host)).toBe(false);
    }
  });

  it('solo la dirección de Vercel de siempre avisa de la mudanza', () => {
    expect(esDireccionAntigua('bookshelf-wine-iota.vercel.app')).toBe(true);
    expect(esDireccionAntigua('libotown.es')).toBe(false);
    expect(esDireccionAntigua('www.libotown.es')).toBe(false);
    expect(esDireccionAntigua('localhost')).toBe(false);
    expect(DIRECCION).toBe('https://libotown.es/');
  });
});
