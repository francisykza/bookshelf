import { describe, expect, it } from 'vitest';
import { createRoom, moveItem, validateRoom } from '../room';
import { GUARDIA, dejarSitioAlLibro, sitioDelLibro, sitioValido, zonaLibro } from '../esenciales';

const piso = (...tops) => ({
  ...createRoom({ pared: 'yeso', suelo: 'tablas' }),
  guard: GUARDIA,
  items: [
    { uid: 1, id: 'sillon', tono: 0, x: 4, y: 6, rot: 2 },
    { uid: 2, id: 'mesa-baja', tono: 0, x: 4, y: 4, rot: 0 },
    { uid: 3, id: 'escritorio', tono: 0, x: 0, y: 3, rot: 3 },
    ...tops,
  ],
});
const tetera = (x, y = 4) => ({ uid: 7, id: 'tetera', tono: 0, x, y, rot: 0 });
const planta = (x, y = 4) => ({ uid: 8, id: 'planta-pequena', tono: 0, x, y, rot: 0 });

describe('la zona del libro en la mesa', () => {
  it('es la celda más cercana al asiento, también con la mesa girada', () => {
    expect(zonaLibro(piso()).celda).toEqual({ x: 4, y: 4 });
    const girada = { ...piso(), items: [{ uid: 1, id: 'sillon', tono: 0, x: 4, y: 6, rot: 2 }, { uid: 2, id: 'mesa-baja', tono: 0, x: 4, y: 3, rot: 1 }] };
    expect(zonaLibro(girada).celda).toEqual({ x: 4, y: 4 });
  });

  it('impide colocar encima y ofrece un sitio válido', () => {
    const room = piso(planta(5));
    expect(moveItem(room, 8, { x: 4, y: 4 }).error).toBe('libro');
    expect(sitioValido(room, room.items.find((i) => i.uid === 8))).toEqual({ x: 5, y: 4 });
  });

  it('deja colocar en la otra celda y en otras superficies', () => {
    const room = piso(planta(5));
    expect(moveItem(room, 8, { x: 0, y: 3 }).error).toBeUndefined();
    expect(zonaLibro(room).invasores).toEqual([]);
  });

  it('un piso antiguo sigue siendo válido y su libro busca otra celda, sin guardar nada', () => {
    const layout = { v: 1, pared: 'yeso', suelo: 'tablas', items: piso(tetera(4)).items };
    const room = validateRoom(layout);
    expect(room).not.toBeNull();
    expect(zonaLibro(room).invasores.map((i) => i.id)).toEqual(['tetera']);
    expect(sitioDelLibro(room)).toEqual({ x: 5, y: 4 });
    expect(layout.items.find((i) => i.uid === 7)).toMatchObject({ x: 4, y: 4 });
  });

  it('dejar sitio aparta sin quitar nada del piso', () => {
    const room = piso(tetera(4), planta(5));
    const res = dejarSitioAlLibro(room);
    expect(res.error).toBeUndefined();
    expect(res.room.items).toHaveLength(room.items.length);
    expect(zonaLibro(res.room).invasores).toEqual([]);
    expect(res.room.items.find((i) => i.uid === 8)).toMatchObject({ x: 5, y: 4 });
    // Lo original no cambia: solo lo devuelto, si quien decora lo pide
    expect(room.items.find((i) => i.uid === 7)).toMatchObject({ x: 4, y: 4 });
  });

  it('sin mesa no hay zona ni reglas', () => {
    const room = { ...createRoom({ pared: 'yeso', suelo: 'tablas' }), guard: GUARDIA };
    expect(zonaLibro(room)).toBeNull();
    expect(sitioDelLibro(room)).toBeNull();
  });
});
