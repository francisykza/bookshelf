import { describe, expect, it } from 'vitest';
import { CATALOG } from '../catalog';
import { NEIGHBOURS, starterRoom } from '../demo';
import { ROOM, addItem, check, createRoom, exportRoom, findFreeSpot, heightOf, importRoom, itemsOn, moveItem, reasonText, recolorItem, removeItem, rotateItem, setFloor, setWall, validateRoom } from '../room';

const one = (room, id, x, y, rot = 0) => ({ ...room, items: [...room.items, { uid: room.items.length + 1, id, x, y, rot, tono: 0 }] });

describe('El edificio del puerto · reglas del piso', () => {
  it('el catálogo tiene medidas, capa y al menos un tono en cada mueble', () => {
    for (const c of CATALOG) {
      expect(['alfombra', 'suelo', 'encima', 'pared']).toContain(c.capa);
      expect(c.w).toBeGreaterThan(0);
      if (c.capa !== 'pared') expect(c.d).toBeGreaterThan(0);
      expect(c.tonos.length).toBeGreaterThan(0);
    }
    expect(new Set(CATALOG.map((c) => c.id)).size).toBe(CATALOG.length);
  });

  it('los muebles no se pisan, pero sí pueden ir sobre una alfombra', () => {
    let room = one(createRoom(), 'alfombra', 2, 2);
    expect(check(room, { uid: 9, id: 'sillon', x: 2, y: 2, rot: 0, tono: 0 }).ok).toBe(true);
    room = one(room, 'sillon', 2, 2);
    expect(check(room, { uid: 9, id: 'mesilla', x: 3, y: 3, rot: 0, tono: 0 })).toMatchObject({ ok: false, reason: 'choque', con: 'sillon' });
    expect(check(room, { uid: 9, id: 'alfombra', x: 3, y: 3, rot: 0, tono: 0 })).toMatchObject({ ok: false, reason: 'choque' });
  });

  it('nada se sale de la cuadrícula; el giro cambia ancho por fondo', () => {
    const room = createRoom();
    expect(check(room, { uid: 1, id: 'sofa', x: 7, y: 0, rot: 0, tono: 0 }).reason).toBe('fuera');
    expect(check(room, { uid: 1, id: 'sofa', x: 7, y: 0, rot: 1, tono: 0 }).ok).toBe(true);
    expect(check(room, { uid: 1, id: 'sofa', x: -1, y: 0, rot: 0, tono: 0 }).reason).toBe('fuera');
    expect(check(room, { uid: 1, id: 'sofa', x: 0.5, y: 0, rot: 0, tono: 0 }).reason).toBe('fuera');
    expect(check(room, { uid: 1, id: 'sofa', x: 0, y: 0, rot: 0, tono: 9 }).reason).toBe('desconocido');
  });

  it('lo pequeño va encima de un mueble con superficie y se apoya a su altura', () => {
    let room = createRoom();
    expect(check(room, { uid: 5, id: 'lampara-mesa', x: 1, y: 1, rot: 0, tono: 0 }).reason).toBe('apoyo');
    room = one(room, 'mesilla', 1, 1);
    const lamp = { uid: 5, id: 'lampara-mesa', x: 1, y: 1, rot: 0, tono: 0 };
    expect(check(room, lamp).ok).toBe(true);
    room = { ...room, items: [...room.items, lamp] };
    expect(heightOf(room, lamp)).toBe(0.9);
    expect(itemsOn(room, 1).map((i) => i.uid)).toEqual([5]);
    // El sillón no tiene superficie
    room = one(room, 'sillon', 4, 4);
    expect(check(room, { uid: 9, id: 'tetera', x: 4, y: 4, rot: 0, tono: 0 }).reason).toBe('apoyo');
  });

  it('al mover un mueble, lo de encima va con él; no se gira ni se guarda con cosas encima', () => {
    let room = one(createRoom(), 'mesa-baja', 1, 1);
    room = { ...room, items: [...room.items, { uid: 2, id: 'libros', x: 2, y: 1, rot: 0, tono: 0 }] };
    const moved = moveItem(room, 1, { x: 5, y: 6 }).room;
    expect(moved.items.find((i) => i.uid === 2)).toMatchObject({ x: 6, y: 6 });
    expect(rotateItem(moved, 1).error).toBe('encima');
    expect(removeItem(moved, 1).error).toBe('encima');
    expect(removeItem(moved, 2).room.items).toHaveLength(1);
  });

  it('girar busca un hueco cercano si girado no cabe donde está', () => {
    let room = one(createRoom(), 'sofa', 0, 0);
    room = one(room, 'mesilla', 0, 2);
    const turned = rotateItem(room, 1);
    expect(turned.error).toBeUndefined();
    const sofa = turned.room.items.find((i) => i.uid === 1);
    expect(sofa.rot).toBe(1);
    expect(check(turned.room, sofa).ok).toBe(true);
  });

  it('lo de pared va en la del fondo o en la de la izquierda, sin solaparse', () => {
    let room = createRoom();
    const win = { uid: 1, id: 'ventana', pared: 'fondo', a: 7, tono: 0 };
    expect(check(room, win).ok).toBe(true);
    expect(check(room, { ...win, a: 8 }).reason).toBe('fuera');
    room = { ...room, items: [win] };
    expect(check(room, { uid: 2, id: 'cuadro', pared: 'fondo', a: 6, tono: 0 })).toMatchObject({ ok: false, reason: 'choque', con: 'ventana' });
    expect(check(room, { uid: 2, id: 'cuadro', pared: 'izq', a: 6, tono: 0 }).ok).toBe(true);
    expect(rotateItem(room, 1).error).toBe('pared');
    expect(moveItem(room, 1, { pared: 'izq', a: 0 }).room.items[0]).toMatchObject({ pared: 'izq', a: 0 });
  });

  it('añadir pone cada cosa en el primer hueco libre y respeta el máximo', () => {
    let room = createRoom();
    const res = addItem(room, 'tetera');
    expect(res.error).toBe('sitio');
    room = addItem(room, 'mesa').room;
    const tea = addItem(room, 'tetera');
    expect(check(tea.room, tea.item).ok).toBe(true);
    expect(heightOf(tea.room, tea.item)).toBe(1.25);
    let full = createRoom();
    for (let k = 0; k < ROOM.maxItems; k += 1) full = addItem(full, 'reloj').room ?? addItem(full, 'silla').room;
    expect(full.items).toHaveLength(ROOM.maxItems);
    expect(addItem(full, 'silla').error).toBe('lleno');
    expect(findFreeSpot(createRoom(), 'no-existe')).toBe(null);
  });

  it('color, pared y suelo solo aceptan valores del catálogo', () => {
    const room = one(createRoom(), 'sillon', 0, 0);
    expect(recolorItem(room, 1).room.items[0].tono).toBe(1);
    expect(setWall(room, 'noche').pared).toBe('noche');
    expect(setWall(room, 'neón').pared).toBe('yeso');
    expect(setFloor(room, 'barro').suelo).toBe('barro');
    expect(setFloor(room, 'mármol').suelo).toBe('tablas');
  });

  it('validateRoom (lo que haría el servidor) rechaza lo que no sale del catálogo o no cabe', () => {
    const good = starterRoom();
    expect(importRoom(exportRoom(good))).toEqual(validateRoom(good));
    expect(validateRoom({ ...good, v: 2 })).toBe(null);
    expect(validateRoom({ ...good, pared: 'oro' })).toBe(null);
    expect(validateRoom({ ...good, items: [...good.items, { uid: 99, id: 'trono', x: 0, y: 8, rot: 0, tono: 0 }] })).toBe(null);
    expect(validateRoom({ ...good, items: [...good.items, { uid: 99, id: 'sofa', x: 1, y: 0, rot: 0, tono: 0 }] })).toBe(null);
    expect(validateRoom({ ...good, items: [...good.items, { ...good.items[0] }] })).toBe(null);
    expect(validateRoom({ ...good, items: [{ uid: 1, id: 'libros', x: 0, y: 8, rot: 0, tono: 0 }] })).toBe(null);
    // Campos de más no pasan: solo se copian los que cuentan
    const extra = validateRoom({ ...good, items: good.items.map((i) => ({ ...i, nota: '<b>hola</b>' })) });
    expect(extra.items.every((i) => !('nota' in i))).toBe(true);
    expect(importRoom('no es json')).toBe(null);
  });

  it('los pisos de los vecinos de prueba son válidos', () => {
    for (const n of NEIGHBOURS.filter((x) => !x.propio)) expect(validateRoom(n.room())).not.toBe(null);
    expect(starterRoom().items.length).toBeGreaterThan(5);
  });

  it('cada motivo tiene su frase', () => {
    for (const r of ['fuera', 'apoyo', 'encima', 'lleno', 'sitio', 'gira', 'pared']) expect(reasonText(r)).toMatch(/\.$/);
    expect(reasonText('choque', 'sofa')).toBe('Choca con: sofá.');
  });
});
