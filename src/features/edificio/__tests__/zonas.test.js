// Muebles por zona de la casa (reestructuración de muebles, decisión de Francisco del 9-11-2026).
import { describe, expect, it } from 'vitest';
import { CATALOG, ZONAS, ZONA_PAREDES, catalogItem, zonaOf } from '../catalog';
import { isRetirado } from '../retirados';

const validas = new Set([...ZONAS.map((z) => z.id), ZONA_PAREDES, 'misticos']);

describe('zonas de la casa', () => {
  it('cada mueble tiene una zona conocida', () => {
    for (const c of CATALOG) expect(validas.has(zonaOf(c)), c.id).toBe(true);
  });

  it('los de la casa van a su sitio', () => {
    const z = (id) => zonaOf(catalogItem(id));
    expect([z('sillon'), z('lampara-pie'), z('estanteria')]).toEqual(['lectura', 'lectura', 'lectura']);
    expect([z('mesa'), z('mesa-baja')]).toEqual(['salon', 'salon']);
    expect(z('escritorio')).toBe('estudio');
    for (const id of ['ventana', 'cuadro', 'espejo', 'mapa', 'estante-pared', 'reloj', 'tapiz', 'guirnalda']) expect(z(id), id).toBe(ZONA_PAREDES);
  });

  it('el tipo (cat) no cambia: lo usan los sobres y el servidor', () => {
    expect(catalogItem('sillon').cat).toBe('asientos');
    expect(catalogItem('escritorio').cat).toBe('mesas');
  });

  it('hoy, lo que queda a la venta se reparte entre lectura, salón, estudio y paredes', () => {
    const usadas = new Set(CATALOG.filter((c) => !isRetirado(c.id) && c.cat !== 'misticos' && !c.compania).map(zonaOf));
    expect([...usadas].sort()).toEqual(['estudio', 'lectura', ZONA_PAREDES, 'salon'].sort());
  });
});
