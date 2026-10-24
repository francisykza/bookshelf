// Veleros de la bahía (SPEC §16, Anexo A): los carriles medidos mantienen el barco entero dentro del agua en
// ambas habitaciones, los desfases son deterministas y la cita navegante no existe aún (Fase 1).
import { describe, expect, it } from 'vitest';
import { ROOMS } from '../../scene/sceneMap';
import { boatInWater, boatPhase, insidePolygon } from '../../scene/sea';

describe('veleros de la bahía', () => {
  for (const room of Object.values(ROOMS)) {
    it(`${room.id}: cada barco va siempre sobre el agua de su carril`, () => {
      expect(room.sea.lanes.length).toBeGreaterThanOrEqual(2);
      expect(room.sea.lanes.length).toBeLessThanOrEqual(3);
      for (const lane of room.sea.lanes) {
        for (let t = 0; t <= 1.0001; t += 0.05) expect(boatInWater(room.sea, lane, t), `${room.id} t=${t.toFixed(2)}`).toBe(true);
      }
    });

    it(`${room.id}: el agua está dentro de la imagen`, () => {
      for (const poly of room.sea.water) for (const [x, y] of poly) expect(x >= 0 && y >= 0 && x <= room.width && y <= room.height).toBe(true);
    });
  }

  it('los veleros pintados no quedan bajo un carril animado', () => {
    // Medidos en las ilustraciones: un barco animado nunca pasa a menos de 14 px de uno pintado
    const painted = { MAIN_ROOM: [[775, 792], [805, 820]], SOCIAL_ROOM: [[94, 688], [162, 754]] };
    for (const [id, boats] of Object.entries(painted)) {
      for (const lane of ROOMS[id].sea.lanes) {
        for (let t = 0; t <= 1.0001; t += 0.02) {
          const x = lane.from[0] + (lane.to[0] - lane.from[0]) * t;
          const y = lane.from[1] + (lane.to[1] - lane.from[1]) * t;
          for (const [px, py] of boats) expect(Math.hypot(x - px, y - py), `${id} cerca de (${px}, ${py})`).toBeGreaterThanOrEqual(14);
        }
      }
    }
  });

  it('desfases deterministas y distintos por barco y habitación', () => {
    expect(boatPhase('MAIN_ROOM', 0)).toBe(boatPhase('MAIN_ROOM', 0));
    expect(boatPhase('MAIN_ROOM', 0)).not.toBe(boatPhase('MAIN_ROOM', 1));
    expect(boatPhase('MAIN_ROOM', 0)).not.toBe(boatPhase('SOCIAL_ROOM', 0));
    expect(insidePolygon([1, 1], [[0, 0], [2, 0], [2, 2], [0, 2]])).toBe(true);
  });
});
