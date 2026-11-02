// 1.69 · Tu personaje (SPEC §69): aspecto, caminos por el suelo y asientos (sin DOM).
import { describe, expect, it } from 'vitest';
import { DEFAULT_AVATAR, actorBoxes, approachCell, blockedCells, findPath, isSeat, nearestFree, seatOf, validateAvatar } from '../actor';
import { ROOM, addItem, createRoom } from '../room';

describe('aspecto', () => {
  it('rellena lo que falte con el de serie y rechaza lo que no es de las listas', () => {
    expect(validateAvatar({ pelo: 'mono' })).toEqual({ ...DEFAULT_AVATAR, pelo: 'mono' });
    expect(validateAvatar(null)).toBeNull();
    expect(validateAvatar({ jersey: 99 })).toBeNull();
    expect(validateAvatar({ nombre: 'x' })).toBeNull();
    expect(validateAvatar({ gafas: 1 })).toBeNull();
  });

  it('cada pose tiene cajas bien formadas y de pie mide unos dos metros de cajas', () => {
    for (const pose of ['stand', 'walk', 'sit', 'lie'])
      for (let facing = 0; facing < 4; facing += 1) {
        const boxes = actorBoxes({ ...DEFAULT_AVATAR, pelo: 'rizos', gafas: true }, { x: 3, y: 4, facing, pose, step: 1, h: 0.8 });
        for (const { b } of boxes) {
          expect(b[0]).toBeLessThanOrEqual(b[3]);
          expect(b[1]).toBeLessThanOrEqual(b[4]);
          expect(b[2]).toBeLessThanOrEqual(b[5]);
        }
      }
    const top = Math.max(...actorBoxes(DEFAULT_AVATAR, { x: 0, y: 0, facing: 0, pose: 'stand' }).map((x) => x.b[5]));
    expect(top).toBeGreaterThan(1.9);
    expect(top).toBeLessThan(2.3);
  });
});

describe('caminos', () => {
  const room = () => {
    let r = createRoom({});
    r = addItem(r, 'sofa', { near: { x: 4, y: 4 }, rot: 0 }).room;
    return r;
  };

  it('los muebles de suelo estorban; las alfombras no', () => {
    let r = createRoom({});
    r = addItem(r, 'alfombra', { near: { x: 4, y: 4 } }).room;
    expect(blockedCells(r).some(Boolean)).toBe(false);
    expect(blockedCells(room()).filter(Boolean).length).toBe(6);
  });

  it('rodea los muebles y no corta esquinas', () => {
    const r = room();
    const grid = blockedCells(r);
    const sofa = r.items[0];
    const from = { x: sofa.x - 1, y: sofa.y };
    const to = { x: sofa.x + 3, y: sofa.y + 1 };
    const path = findPath(grid, from, to);
    expect(path.at(-1)).toEqual(to);
    let prev = from;
    for (const c of path) {
      expect(grid[c.y * ROOM.w + c.x]).toBe(0);
      expect(Math.max(Math.abs(c.x - prev.x), Math.abs(c.y - prev.y))).toBe(1);
      if (c.x !== prev.x && c.y !== prev.y) {
        expect(grid[prev.y * ROOM.w + c.x]).toBe(0);
        expect(grid[c.y * ROOM.w + prev.x]).toBe(0);
      }
      prev = c;
    }
    expect(findPath(grid, from, { x: sofa.x, y: sofa.y })).toBeNull();
    expect(grid[nearestFree(grid, sofa.x + 1, sofa.y + 1).y * ROOM.w + nearestFree(grid, sofa.x + 1, sofa.y + 1).x]).toBe(0);
  });

  it('se sienta mirando hacia donde mira el asiento, y se llega por delante', () => {
    for (let rot = 0; rot < 4; rot += 1) {
      const r = addItem(createRoom({}), 'sillon', { near: { x: 4, y: 4 }, rot }).room;
      const item = r.items[0];
      const s = seatOf(item);
      expect(s.facing).toBe(rot);
      expect(s.pose).toBe('sit');
      const [c] = approachCell(blockedCells(r), item, null);
      // La celda de llegada queda al lado del frente del sillón
      const front = [[0, 1], [-1, 0], [0, -1], [1, 0]][rot];
      expect(Math.sign(c.x + 0.5 - s.x) === front[0] || front[0] === 0).toBe(true);
      expect(Math.sign(c.y + 0.5 - s.y) === front[1] || front[1] === 0).toBe(true);
    }
    expect(isSeat('cama')).toBe(true);
    expect(isSeat('mesa')).toBe(false);
    expect(seatOf(addItem(createRoom({}), 'cama', { near: { x: 4, y: 4 } }).room.items[0]).pose).toBe('lie');
  });
});
