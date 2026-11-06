import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addItem, check, exportRoom, moveItem, recolorItem, removeItem, rotateItem } from '../../edificio/room';
import { LAYOUTS, isEssential, repairRoom, withGuard } from '../essentials';
import { loadRoom, pisoById, resetRoom, saveRoom, repairNews } from '../labStore';

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
const present = (room) => ['estanteria', 'mesa-baja', 'escritorio', 'ordenador', 'puerta-piso'].every((id) => of(room, id) && isEssential(layout, of(room, id)));

beforeEach(() => memory.clear());

describe('elementos esenciales', () => {
  it('los dos pisos de partida los traen en su sitio, sin tener que recolocar nada', () => {
    for (const id of ['lab-1A', 'lab-2B']) {
      const seed = pisoById(id).seed();
      const fixed = repairRoom(seed, LAYOUTS[id]);
      expect(fixed.added).toEqual([]);
      expect(fixed.moved).toEqual([]);
      expect(fixed.stored).toEqual([]);
      expect(fixed.changed).toBe(false);
    }
  });

  it('no se mueven, no se giran y no se guardan, pero sí cambian de color', () => {
    let room = loadRoom(mine);
    for (const id of ['estanteria', 'mesa-baja', 'escritorio', 'ordenador']) {
      const item = of(room, id);
      expect(moveItem(room, item.uid, { x: 8, y: 8 }).error).toBe('esencial');
      expect(rotateItem(room, item.uid).error).toBe('esencial');
      expect(removeItem(room, item.uid).error).toBe('esencial');
    }
    expect(removeItem(room, of(room, 'puerta-piso').uid).error).toBe('esencial');
    const painted = recolorItem(room, of(room, 'escritorio').uid);
    expect(painted.error).toBeUndefined();
    room = painted.room;
    expect(of(room, 'escritorio').tono).toBe(1);
    expect(isEssential(layout, of(room, 'escritorio'))).toBe(true);
  });

  it('protege el paso hasta ellos y el sitio del ejemplar', () => {
    const room = loadRoom(mine);
    const zona = (x, y) => check(room, { uid: 99, id: 'planta-grande', x, y, rot: 0, tono: 0 }).reason;
    expect(zona(0, 1)).toBe('zona');
    expect(zona(5, 1)).toBe('zona');
    expect(zona(7, 1)).toBe('zona');
    const free = { ...room, items: room.items.filter((i) => i.id !== 'sillon') };
    expect(check(free, { uid: 99, id: 'planta-grande', x: 3, y: 4, rot: 0, tono: 0 }).reason).toBe('zona');
    // El sillón sí puede estar delante de la mesa
    expect(check(free, { uid: 99, id: 'sillon', x: 2, y: 4, rot: 2, tono: 0 }).ok).toBe(true);
    expect(zona(8, 5)).toBeUndefined();
    // Una lámpara sobre la mesa de lectura no; sobre otra mesa, sí
    expect(check(room, { uid: 99, id: 'lampara-mesa', x: 2, y: 3, rot: 0, tono: 0 }).reason).toBe('reservado');
    // Lo nuevo tampoco cae ahí
    const added = addItem(room, 'planta-grande', { near: { x: 5.5, y: 1.5 } }).item;
    expect(check(room, added).ok).toBe(true);
  });

  it('una alfombra sí puede pasar por debajo de la zona', () => {
    const room = loadRoom(mine);
    expect(check(room, { uid: 99, id: 'alfombra', x: 5, y: 2, rot: 0, tono: 0 }).reason).not.toBe('zona');
  });

  it('una distribución guardada antes de los esenciales se completa sin perder la decoración', () => {
    const before = old([
      { uid: 1, id: 'alfombra', x: 2, y: 2, rot: 0, tono: 1 },
      { uid: 2, id: 'sillon', x: 2, y: 4, rot: 2, tono: 2 },
      { uid: 3, id: 'planta-grande', x: 7, y: 0, rot: 0, tono: 1 },
      { uid: 4, id: 'estanteria', x: 6, y: 6, rot: 1, tono: 2 },
      { uid: 5, id: 'ventana', pared: 'fondo', a: 7, tono: 1 },
    ]);
    memory.set(KEY, JSON.stringify(before));
    const room = loadRoom(mine);
    expect(present(room)).toBe(true);
    // Conserva suelo, pared, identificador y color
    expect(room.pared).toBe('yeso');
    expect(of(room, 'estanteria')).toMatchObject({ uid: 4, tono: 2, x: 0, y: 0, rot: 0 });
    expect(of(room, 'sillon')).toMatchObject({ uid: 2, tono: 2, x: 2, y: 4 });
    // Lo que estorbaba sigue en el piso, en otro sitio
    const plant = of(room, 'planta-grande');
    expect(plant.tono).toBe(1);
    expect(check(room, plant).ok).toBe(true);
    const window = of(room, 'ventana');
    expect(window.tono).toBe(1);
    expect(window.a).not.toBe(7);
    // Y lo dice una vez; la copia de antes queda guardada
    const news = repairNews(mine);
    expect(news.added).toEqual(['Mesa de lectura', 'Escritorio', 'Ordenador', 'Puerta de salida']);
    expect(news.moved).toBe(2);
    expect(repairNews(mine).added).toEqual([]);
    expect(memory.get(`${KEY}:antes`)).toBe(JSON.stringify(before));
  });

  it('reparar dos veces da lo mismo: ni reordena ni vuelve a guardar', () => {
    memory.set(KEY, JSON.stringify(old([{ uid: 7, id: 'estanteria', x: 6, y: 6, rot: 1, tono: 1 }])));
    const first = loadRoom(mine);
    const saved = memory.get(KEY);
    expect(repairRoom(first, layout).changed).toBe(false);
    expect(JSON.stringify(loadRoom(mine))).toBe(JSON.stringify(first));
    expect(memory.get(KEY)).toBe(saved);
  });

  it('adopta el mueble ya colocado y lleva consigo lo que tiene encima', () => {
    const fixed = repairRoom(old([
      { uid: 1, id: 'escritorio', x: 2, y: 7, rot: 0, tono: 2 },
      { uid: 2, id: 'lampara-mesa', x: 3, y: 7, rot: 0, tono: 1 },
    ]), layout);
    expect(of(fixed.room, 'escritorio')).toMatchObject({ uid: 1, tono: 2, x: 5, y: 0 });
    expect(of(fixed.room, 'lampara-mesa')).toMatchObject({ uid: 2, x: 6, y: 0 });
    expect(fixed.moved).toEqual([]);
  });

  it('una mesa grande sirve de mesa de lectura sin acercarse al sillón', () => {
    const fixed = repairRoom(old([{ uid: 1, id: 'mesa', x: 6, y: 6, rot: 0, tono: 1 }]), layout);
    expect(of(fixed.room, 'mesa')).toMatchObject({ uid: 1, x: 2, y: 2 });
    expect(of(fixed.room, 'mesa-baja')).toBeUndefined();
    expect(fixed.added).not.toContain('Mesa de lectura');
  });

  it('lo que no cabe se aparta sin borrarse y vuelve en cuanto hay sitio', () => {
    const lots = [];
    for (let y = 0; y < 9; y += 1) for (let x = 0; x < 9 && lots.length < 40; x += 1) lots.push({ uid: lots.length + 1, id: 'mesilla', x, y, rot: 0, tono: 0 });
    const full = repairRoom(old(lots), layout);
    expect(full.room.items.length + full.stored.length).toBe(lots.length + 5);
    expect(full.stored.length).toBeGreaterThan(0);
    expect(present(full.room)).toBe(true);
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

  it('restablecer vuelve a la distribución de partida, con los esenciales', () => {
    const room = loadRoom(mine);
    saveRoom(mine, recolorItem(room, of(room, 'escritorio').uid).room);
    const reset = resetRoom(mine);
    expect(present(reset)).toBe(true);
    expect(of(reset, 'escritorio').tono).toBe(0);
    expect(memory.has(KEY)).toBe(false);
  });

  it('la distribución guardada no lleva las reglas, y sin reglas nada cambia', () => {
    const room = loadRoom(mine);
    expect(JSON.parse(exportRoom(room)).guard).toBeUndefined();
    const plain = { ...room, guard: undefined };
    expect(moveItem(plain, of(plain, 'ordenador').uid, { x: 6, y: 0 }).error).toBeUndefined();
    expect(withGuard(plain, layout).guard.locked(of(plain, 'escritorio'))).toBe(true);
  });
});
