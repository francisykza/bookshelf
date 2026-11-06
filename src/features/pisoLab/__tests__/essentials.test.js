import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addItem, check, exportRoom, moveItem, recolorItem, removeItem, rotateItem } from '../../edificio/room';
import { LAYOUTS, essentialItems, isEssential, readingTable, repairRoom, withGuard, zoneOf } from '../essentials';
import { loadRoom, pisoById, repairNews, resetRoom, saveRoom } from '../labStore';

const memory = new Map();
vi.stubGlobal('localStorage', {
  getItem: (k) => memory.get(k) ?? null,
  setItem: (k, v) => memory.set(k, v),
  removeItem: (k) => memory.delete(k),
});

const mine = pisoById('lab-1A');
const layout = LAYOUTS['lab-1A'];
const KEY = 'bookshelf:lab:piso-primera-persona:plano2:lab-1A';
const of = (room, id) => room.items.find((i) => i.id === id);
const old = (items) => ({ v: 1, pared: 'yeso', suelo: 'tablas', items });
const complete = (room) => essentialItems(room).length === 5;

beforeEach(() => memory.clear());

describe('elementos esenciales', () => {
  it('los dos pisos de partida los traen, sin tener que recolocar nada', () => {
    for (const id of ['lab-1A', 'lab-2B']) {
      const fixed = repairRoom(pisoById(id).seed(), LAYOUTS[id]);
      expect(fixed.added).toEqual([]);
      expect(fixed.moved).toEqual([]);
      expect(fixed.stored).toEqual([]);
      expect(fixed.changed).toBe(false);
    }
  });

  it('se mueven y cambian de color como cualquier mueble, pero no se guardan', () => {
    let room = loadRoom(mine);
    const moved = moveItem(room, of(room, 'estanteria').uid, { x: 0, y: 6 });
    expect(moved.error).toBeUndefined();
    expect(of(moved.room, 'estanteria')).toMatchObject({ x: 0, y: 6 });
    expect(complete(moved.room)).toBe(true);
    const walled = moveItem(room, of(room, 'puerta-piso').uid, { pared: 'izq', a: 1 });
    expect(walled.error).toBeUndefined();
    // La puerta también necesita paso: delante de la estantería no
    expect(moveItem(room, of(room, 'puerta-piso').uid, { pared: 'fondo', a: 0 }).error).toBe('zona');
    for (const id of ['estanteria', 'mesa-baja', 'puerta-piso', 'ordenador']) expect(removeItem(room, of(room, id).uid).error).toBe('esencial');
    room = recolorItem(room, of(room, 'escritorio').uid).room;
    expect(of(room, 'escritorio').tono).toBe(1);
  });

  it('el escritorio se lleva el ordenador, al moverlo y al girarlo', () => {
    let room = loadRoom(mine);
    const desk = of(room, 'escritorio');
    room = moveItem(room, desk.uid, { x: 4, y: 6 }).room;
    expect(of(room, 'ordenador')).toMatchObject({ x: 4, y: 6 });
    room = rotateItem(room, desk.uid).room;
    expect(of(room, 'escritorio').rot).toBe(1);
    expect(of(room, 'ordenador').rot).toBe(1);
    // Sigue sobre el mueble y lo reconoce como su apoyo
    expect(check(room, of(room, 'ordenador')).ok).toBe(true);
    // Cuatro cuartos de vuelta y vuelve a estar igual
    for (let i = 0; i < 3; i += 1) room = rotateItem(room, desk.uid).room;
    expect(of(room, 'ordenador')).toMatchObject({ x: of(room, 'escritorio').x, y: of(room, 'escritorio').y, rot: 0 });
  });

  it('el ordenador solo cabe en el escritorio', () => {
    const room = loadRoom(mine);
    const pc = of(room, 'ordenador');
    expect(moveItem(room, pc.uid, { x: 6, y: 0 }).error).toBeUndefined();
    expect(moveItem(room, pc.uid, { x: 2, y: 3 }).error).toBe('escritorio');
  });

  it('el paso sigue al mueble: delante, según hacia dónde mire', () => {
    expect(zoneOf({ id: 'escritorio', x: 4, y: 4, rot: 0 }, 1)).toEqual({ x0: 4, y0: 5, x1: 6, y1: 6 });
    expect(zoneOf({ id: 'escritorio', x: 4, y: 4, rot: 2 }, 1)).toEqual({ x0: 4, y0: 3, x1: 6, y1: 4 });
    expect(zoneOf({ id: 'escritorio', x: 4, y: 4, rot: 1 }, 1)).toEqual({ x0: 3, y0: 4, x1: 4, y1: 6 });
    expect(zoneOf({ id: 'escritorio', x: 4, y: 4, rot: 3 }, 1)).toEqual({ x0: 5, y0: 4, x1: 6, y1: 6 });
    let room = loadRoom(mine);
    const plant = (x, y) => check(room, { uid: 99, id: 'planta-grande', x, y, rot: 0, tono: 0 }).reason;
    expect(plant(5, 1)).toBe('zona');
    expect(plant(0, 1)).toBe('zona');
    expect(plant(7, 1)).toBe('zona');
    expect(plant(8, 5)).toBeUndefined();
    room = moveItem(room, of(room, 'escritorio').uid, { x: 4, y: 6 }).room;
    expect(plant(5, 1)).toBeUndefined();
    expect(plant(4, 7)).toBe('zona');
  });

  it('un esencial no se puede dejar sin paso ni quitárselo a otro', () => {
    const room = loadRoom(mine);
    const desk = of(room, 'escritorio');
    // Pegado a la pared de enfrente: no queda sitio delante
    expect(moveItem(room, desk.uid, { x: 4, y: 8 }).error).toBe('zona');
    // Delante del escritorio hay una planta
    const blocked = moveItem(room, of(room, 'planta-grande').uid, { x: 4, y: 6 }).room;
    expect(moveItem(blocked, desk.uid, { x: 4, y: 5 }).error).toBe('zona');
    // Encima del paso de la estantería
    expect(moveItem(room, desk.uid, { x: 0, y: 1 }).error).toBe('zona');
  });

  it('el sillón sí puede estar delante de la mesa, pero nada puede ir encima de ella', () => {
    const room = loadRoom(mine);
    const free = { ...room, items: room.items.filter((i) => i.id !== 'sillon') };
    expect(check(free, { uid: 99, id: 'sillon', x: 2, y: 4, rot: 2, tono: 0 }).ok).toBe(true);
    expect(check(free, { uid: 99, id: 'planta-grande', x: 3, y: 4, rot: 0, tono: 0 }).reason).toBe('zona');
    expect(check(room, { uid: 99, id: 'lampara-mesa', x: 2, y: 3, rot: 0, tono: 0 }).reason).toBe('reservado');
  });

  it('una alfombra puede pasar por debajo del paso', () => {
    const room = loadRoom(mine);
    expect(check(room, { uid: 99, id: 'alfombra', x: 5, y: 2, rot: 0, tono: 0 }).reason).not.toBe('zona');
  });

  it('una copia de más sí se puede guardar, y la otra pasa a ser la esencial', () => {
    let room = loadRoom(mine);
    const added = addItem(room, 'estanteria', { near: { x: 7, y: 7 } });
    expect(added.error).toBeUndefined();
    room = added.room;
    expect(isEssential(room, added.item)).toBe(false);
    const removed = removeItem(room, of(room, 'estanteria').uid);
    expect(removed.error).toBeUndefined();
    expect(isEssential(removed.room, added.item)).toBe(true);
    expect(removeItem(removed.room, added.item.uid).error).toBe('esencial');
  });

  it('la distribución de cada cual se respeta: lo que ya está no se mueve', () => {
    const items = [
      { uid: 1, id: 'estanteria', x: 7, y: 5, rot: 1, tono: 2 },
      { uid: 2, id: 'mesa-baja', x: 5, y: 7, rot: 0, tono: 1 },
      { uid: 3, id: 'escritorio', x: 1, y: 7, rot: 2, tono: 2 },
      { uid: 4, id: 'ordenador', x: 2, y: 7, rot: 2, tono: 1 },
      { uid: 5, id: 'puerta-piso', pared: 'izq', a: 2, tono: 1 },
      { uid: 6, id: 'sillon', x: 3, y: 4, rot: 0, tono: 2 },
    ];
    const fixed = repairRoom(old(items), layout);
    expect(fixed.changed).toBe(false);
    expect(fixed.added).toEqual([]);
    expect(of(fixed.room, 'estanteria')).toMatchObject({ x: 7, y: 5, rot: 1, tono: 2 });
    expect(of(fixed.room, 'ordenador')).toMatchObject({ x: 2, y: 7 });
  });

  it('una distribución guardada antes de los esenciales se completa sin perder la decoración', () => {
    const before = old([
      { uid: 1, id: 'alfombra', x: 2, y: 2, rot: 0, tono: 1 },
      { uid: 2, id: 'sillon', x: 2, y: 4, rot: 2, tono: 2 },
      { uid: 3, id: 'planta-grande', x: 5, y: 0, rot: 0, tono: 1 },
      { uid: 4, id: 'estanteria', x: 6, y: 6, rot: 1, tono: 2 },
      { uid: 5, id: 'ventana', pared: 'fondo', a: 7, tono: 1 },
    ]);
    memory.set(KEY, JSON.stringify(before));
    const room = loadRoom(mine);
    expect(complete(room)).toBe(true);
    expect(room.pared).toBe('yeso');
    // Lo que había se queda donde estaba, con su color
    expect(of(room, 'estanteria')).toMatchObject({ uid: 4, tono: 2, x: 6, y: 6, rot: 1 });
    expect(of(room, 'sillon')).toMatchObject({ uid: 2, tono: 2, x: 2, y: 4 });
    expect(of(room, 'planta-grande')).toMatchObject({ x: 5, y: 0, tono: 1 });
    expect(of(room, 'ventana')).toMatchObject({ a: 7, tono: 1 });
    // Lo nuevo busca un sitio libre en vez de echar a lo que ya está
    expect(of(room, 'puerta-piso').a).not.toBe(7);
    expect(of(room, 'escritorio')).not.toMatchObject({ x: 5, y: 0 });
    expect(check(room, of(room, 'escritorio')).ok).toBe(true);
    expect(check(room, of(room, 'ordenador')).ok).toBe(true);
    expect(check(room, of(room, 'puerta-piso')).ok).toBe(true);
    // Lo dice una vez, y la copia de antes queda guardada
    const news = repairNews(mine);
    expect(news.added).toEqual(['Mesa de lectura', 'Escritorio', 'Ordenador', 'Puerta de salida']);
    expect(news.moved).toBe(0);
    expect(repairNews(mine).added).toEqual([]);
    expect(memory.get(`${KEY}:antes`)).toBe(JSON.stringify(before));
  });

  it('lo que estorba al paso de un esencial se aparta lo justo', () => {
    const fixed = repairRoom(old([
      { uid: 1, id: 'estanteria', x: 0, y: 0, rot: 0, tono: 0 },
      { uid: 2, id: 'planta-grande', x: 0, y: 1, rot: 0, tono: 1 },
    ]), layout);
    const plant = of(fixed.room, 'planta-grande');
    expect(fixed.moved).toEqual(['planta-grande']);
    expect(plant.tono).toBe(1);
    expect(Math.hypot(plant.x, plant.y - 1)).toBeLessThan(3);
    expect(of(fixed.room, 'estanteria')).toMatchObject({ x: 0, y: 0 });
  });

  it('reparar dos veces da lo mismo: ni reordena ni vuelve a guardar', () => {
    memory.set(KEY, JSON.stringify(old([{ uid: 7, id: 'estanteria', x: 6, y: 6, rot: 1, tono: 1 }])));
    const first = loadRoom(mine);
    const saved = memory.get(KEY);
    expect(repairRoom(first, layout).changed).toBe(false);
    const plain = (room) => room.items.map((i) => [i.uid, i.id, i.x, i.y, i.rot, i.pared, i.a, i.tono]);
    expect(plain(loadRoom(mine))).toEqual(plain(first));
    expect(memory.get(KEY)).toBe(saved);
  });

  it('el ordenador nuevo busca hueco en el escritorio y no echa lo que ya está encima', () => {
    const fixed = repairRoom(old([
      { uid: 1, id: 'escritorio', x: 2, y: 7, rot: 0, tono: 2 },
      { uid: 2, id: 'lampara-mesa', x: 2, y: 7, rot: 0, tono: 1 },
    ]), layout);
    expect(of(fixed.room, 'escritorio')).toMatchObject({ uid: 1, tono: 2, x: 2, y: 7 });
    expect(of(fixed.room, 'lampara-mesa')).toMatchObject({ uid: 2, x: 2, y: 7 });
    expect(of(fixed.room, 'ordenador')).toMatchObject({ x: 3, y: 7 });
  });

  it('una mesa grande sirve de mesa de lectura, y quita de encima lo que tuviera', () => {
    const fixed = repairRoom(old([
      { uid: 1, id: 'mesa', x: 4, y: 4, rot: 0, tono: 1 },
      { uid: 2, id: 'lampara-mesa', x: 4, y: 4, rot: 0, tono: 0 },
    ]), layout);
    expect(of(fixed.room, 'mesa')).toMatchObject({ uid: 1, x: 4, y: 4 });
    expect(of(fixed.room, 'mesa-baja')).toBeUndefined();
    expect(readingTable(fixed.room).uid).toBe(1);
    expect(fixed.added).not.toContain('Mesa de lectura');
    expect(fixed.room.items.concat(fixed.stored).some((i) => i.id === 'lampara-mesa')).toBe(true);
    const lamp = of(fixed.room, 'lampara-mesa');
    expect(lamp?.x === 4 && lamp?.y === 4).toBe(false);
  });

  it('lo que no cabe se aparta sin borrarse y vuelve en cuanto hay sitio', () => {
    const lots = [];
    for (let y = 0; y < 9; y += 1) for (let x = 0; x < 9 && lots.length < 40; x += 1) lots.push({ uid: lots.length + 1, id: 'mesilla', x, y, rot: 0, tono: 0 });
    const full = repairRoom(old(lots), layout);
    expect(full.room.items.length + full.stored.length).toBe(lots.length + 5);
    expect(full.stored.length).toBeGreaterThan(0);
    expect(complete(full.room)).toBe(true);
    const spare = { ...full.room, items: full.room.items.filter((i) => i.id !== 'mesilla') };
    const back = repairRoom(spare, layout, full.stored);
    expect(back.stored).toEqual([]);
    expect(back.room.items.filter((i) => i.id === 'mesilla')).toHaveLength(full.stored.length);
  });

  it('los uid nuevos no repiten los de lo que espera sitio', () => {
    const fixed = repairRoom(old([{ uid: 3, id: 'sillon', x: 7, y: 7, rot: 0, tono: 0 }]), layout, [{ uid: 50, id: 'mesilla', x: 8, y: 0, rot: 0, tono: 0 }]);
    const uids = fixed.room.items.map((i) => i.uid);
    expect(new Set(uids).size).toBe(uids.length);
    expect(Math.min(...uids.filter((u) => u !== 3 && u !== 50))).toBeGreaterThan(50);
  });

  it('restablecer vuelve a la distribución de partida', () => {
    const room = loadRoom(mine);
    saveRoom(mine, moveItem(room, of(room, 'escritorio').uid, { x: 4, y: 6 }).room);
    const reset = resetRoom(mine);
    expect(complete(reset)).toBe(true);
    expect(of(reset, 'escritorio')).toMatchObject({ x: 5, y: 0, tono: 0 });
    expect(memory.has(KEY)).toBe(false);
  });

  it('una distribución guardada no lleva las reglas, y las recupera al cargar', () => {
    const room = loadRoom(mine);
    expect(JSON.parse(exportRoom(room)).guard).toBeUndefined();
    const plain = { ...room, guard: undefined };
    expect(removeItem(plain, of(plain, 'estanteria').uid).error).toBeUndefined();
    expect(removeItem(withGuard(plain), of(plain, 'estanteria').uid).error).toBe('esencial');
  });
});
