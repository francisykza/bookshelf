import { beforeEach, describe, expect, it, vi } from 'vitest';
import { moveItem, rotateItem, validateRoom } from '../../edificio/room';
import { FACHADAS, PISOS, canEdit, loadRoom, pendientes, pisoById, saveRoom, ventanasDe } from '../labStore';

const memory = new Map();
beforeEach(() => {
  memory.clear();
  vi.stubGlobal('localStorage', { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v), removeItem: (k) => memory.delete(k) });
});

const a = pisoById('lab-1A');
const b = pisoById('lab-2B');
const lampOf = (room) => room.items.find((i) => i.id === 'lampara-pie');

describe('pisos de prueba', () => {
  it('los dos son layouts válidos, con identificador y orientación distintos', () => {
    for (const piso of PISOS) expect(validateRoom(piso.seed())).toBeTruthy();
    expect(a.id).not.toBe(b.id);
    expect(a.mira).not.toBe(b.mira);
    expect(JSON.stringify(a.seed().items)).not.toBe(JSON.stringify(b.seed().items));
  });

  it('solo edita quien vive allí, y el piso ajeno nunca se escribe', () => {
    expect(canEdit(a)).toBe(true);
    expect(canEdit(b)).toBe(false);
    expect(saveRoom(b, b.seed())).toBe(false);
    expect(memory.size).toBe(0);
  });

  it('mover y girar la lámpara del primero se conserva y deja intacto el segundo', () => {
    const before2 = JSON.stringify(loadRoom(b));
    let room = loadRoom(a);
    const lamp = lampOf(room);
    room = moveItem(room, lamp.uid, { x: 8, y: 3 }).room;
    room = rotateItem(room, lamp.uid).room;
    expect(saveRoom(a, room)).toBe(true);
    const reloaded = lampOf(loadRoom(a));
    expect([reloaded.x, reloaded.y, reloaded.rot]).toEqual([8, 3, 1]);
    expect(JSON.stringify(loadRoom(b))).toBe(before2);
  });

  it('un guardado estropeado no se abre: vuelve el piso de partida', () => {
    memory.set('bookshelf:lab:piso-primera-persona:plano2:lab-1A', '{"v":1,"items":[{"id":"no-existe"}]}');
    const ids = (room) => room.items.map((i) => `${i.uid}:${i.id}`).sort();
    expect(ids(loadRoom(a))).toEqual(ids(a.seed()));
  });
});

describe('ventanas', () => {
  it('solo las orientadas hacia el Gran Hotel lo muestran', () => {
    const v1 = ventanasDe(a, a.seed());
    expect(v1.map((v) => [v.pared, v.hotel])).toEqual([['fondo', true], ['izq', false]]);
    expect(ventanasDe(b, b.seed()).some((v) => v.hotel)).toBe(false);
    expect(Object.values(FACHADAS.norte)).not.toContain('hotel');
  });

  it('el horizonte depende de la planta', () => {
    expect(ventanasDe(a, a.seed())[0].horizonte).not.toBe(ventanasDe(b, b.seed())[0].horizonte);
  });
});

describe('piezas pendientes', () => {
  it('los pisos de prueba no tienen; un místico o un acabado sí se avisan', () => {
    expect(pendientes(a.seed())).toEqual([]);
    const room = a.seed();
    const raro = { ...room, items: [...room.items, { uid: 99, id: 'dragoncillo', x: 8, y: 8, rot: 0, tono: 0 }] };
    expect(pendientes(raro)).toHaveLength(1);
  });
});
