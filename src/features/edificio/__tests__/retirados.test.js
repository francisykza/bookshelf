// 1.89 · Retirar objetos sin perderlos y las reglas de los esenciales.
import { describe, expect, it } from 'vitest';
import { GUARDIA, conBasicos, faltan, opcionesDe, ordenadorDe, ROLES, sustituir } from '../esenciales';
import { RETIRADOS, empaquetar, leerPiso, repartir } from '../retirados';
import { addItem, moveItem, removeItem, rotateItem } from '../room';

const base = (items, extra = {}) => ({ v: 1, pared: 'yeso', suelo: 'tablas', items, ...extra });
const SILLON = { uid: 1, id: 'sillon', x: 4, y: 6, rot: 0, tono: 0 };
const MESA = { uid: 2, id: 'estanteria', x: 0, y: 0, rot: 0, tono: 0 };
const ROSA = { uid: 9, id: 'rosa-estrellas', x: 3, y: 3, rot: 0, tono: 0 };

describe('objetos retirados', () => {
  it('sale de lo visible y vuelve al guardar, igual que estaba', () => {
    const room = leerPiso(base([SILLON, ROSA]));
    expect(room.items.map((i) => i.uid)).toEqual([1]);
    expect(room.ocultos).toEqual([ROSA]);
    expect(empaquetar(room)).toEqual(base([SILLON, ROSA]));
  });

  it('no bloquea mover un mueble encima, y entonces se aparca sin cambiar de sitio', () => {
    const room = leerPiso(base([MESA, ROSA]));
    const moved = moveItem(room, 2, { x: 2, y: 3 });
    expect(moved.error).toBeUndefined();
    const layout = empaquetar(moved.room);
    expect(layout.items.map((i) => i.uid)).toEqual([2]);
    expect(layout.ocultos).toEqual([ROSA]);
    const vuelta = leerPiso(layout);
    expect(vuelta.items.map((i) => i.uid)).toEqual([2]);
    expect(vuelta.ocultos).toEqual([ROSA]);
  });

  it('un mueble nuevo no reutiliza el identificador de lo oculto', () => {
    const room = leerPiso(base([SILLON, ROSA]));
    expect(addItem(room, 'silla').item.uid).toBe(10);
  });

  it('al dejar de estar retirado vuelve a su sitio solo si sigue libre', () => {
    const libre = { uid: 5, id: 'lampara-pie', x: 3, y: 3, rot: 0, tono: 0 };
    expect(repartir(base([SILLON]), [libre]).items.map((i) => i.uid)).toEqual([1, 5]);
    const ocupado = repartir(base([{ uid: 6, id: 'mesa-baja', x: 3, y: 3, rot: 0, tono: 0 }]), [libre]);
    expect(ocupado.items.map((i) => i.uid)).toEqual([6]);
    expect(ocupado.ocultos).toEqual([libre]);
  });

  it('descarta lo aparcado que no es válido y no duplica identificadores', () => {
    const room = repartir(base([SILLON]), [{ uid: 1, id: 'farol-azul', x: 0, y: 0, rot: 0, tono: 0 }, { uid: 3, id: 'nada', x: 0, y: 0, rot: 0, tono: 0 }]);
    expect(room.ocultos).toBeUndefined();
    expect(RETIRADOS.has('perrito')).toBe(true);
  });
});

describe('esenciales', () => {
  const guard = (items) => ({ ...base(items), guard: GUARDIA });

  it('no se guarda el último de su tipo, pero sí si hay otro; el piso antiguo sigue siendo editable', () => {
    expect(removeItem(guard([SILLON]), 1).error).toBe('esencial');
    expect(removeItem(guard([SILLON, { uid: 3, id: 'sofa', x: 0, y: 0, rot: 0, tono: 0 }]), 1).room).toBeTruthy();
    const viejo = guard([{ uid: 1, id: 'silla', x: 1, y: 1, rot: 0, tono: 0 }]);
    expect(faltan(viejo).length).toBe(3);
    expect(removeItem(viejo, 1).room.items).toEqual([]);
  });

  it('sustituir conserva identificador y lo de encima; si no cabe, lo dice', () => {
    const desk = { uid: 4, id: 'escritorio', x: 2, y: 2, rot: 0, tono: 0 };
    const res = sustituir(guard([desk]), 4, { id: 'escritorio', tono: 2 });
    expect(res.room.items[0]).toMatchObject({ uid: 4, tono: 2, x: 2, y: 2 });
    const sofa = sustituir(guard([SILLON]), 1, { id: 'mecedora', tono: 0 });
    expect(sofa.room.items[0]).toMatchObject({ uid: 1, id: 'mecedora' });
    expect(sustituir(guard([SILLON]), 1, { id: 'estanteria' }).error).toBe('desconocido');
  });

  it('un esencial gira con sus piezas de una celda encima', () => {
    const desk = { uid: 4, id: 'escritorio', x: 2, y: 2, rot: 0, tono: 0 };
    const taza = { uid: 5, id: 'lampara-mesa', x: 2, y: 2, rot: 0, tono: 0 };
    expect(rotateItem(guard([desk, taza]), 4).room).toBeTruthy();
  });

  it('el ordenador sale del escritorio, en una celda libre, y sin guardarse', () => {
    const desk = { uid: 4, id: 'escritorio', x: 2, y: 2, rot: 0, tono: 0 };
    expect(ordenadorDe(base([desk]))).toMatchObject({ id: 'ordenador', uid: 4, x: 2, y: 2 });
    const taza = { uid: 5, id: 'lampara-mesa', x: 2, y: 2, rot: 0, tono: 0 };
    expect(ordenadorDe(base([desk, taza]))).toMatchObject({ x: 3, y: 2 });
    expect(ordenadorDe(base([]))).toBeNull();
  });

  it('los básicos se tienen siempre, también con copias con acabado', () => {
    const inv = conBasicos({ copias: { sillon: 1 }, acabados: { sillon: { nacar: 1 } } });
    expect(inv.copias).toMatchObject({ sillon: 2, estanteria: 1, escritorio: 1 });
    expect(conBasicos(null)).toBeNull();
    const rol = ROLES[1];
    expect(opcionesDe(inv, base([MESA]), rol, MESA).length).toBeGreaterThan(0);
  });
});
