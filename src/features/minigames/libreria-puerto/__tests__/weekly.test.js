// «La librería del puerto»: el nivel de la semana se genera igual para todos y siempre tiene solución en el mínimo.
import { describe, expect, it } from 'vitest';
import { createGame, dropAt, minMoves, place, stars } from '../puzzle';
import { LIMITS, generateLevel, monthOfWeek, previousWeek, weekId, weekStart } from '../weekly';

const seeds = Array.from({ length: 200 }, (_, i) => `${2026 + Math.floor(i / 52)}-W${String((i % 52) + 1).padStart(2, '0')}`);

describe('nivel de la semana', () => {
  it('semana ISO y su mes', () => {
    expect(weekId(new Date(2026, 9, 31))).toBe('2026-W44');
    expect(weekId(new Date(2027, 0, 1))).toBe('2026-W53');
    expect(monthOfWeek('2026-W44')).toBe('2026-10');
    expect(monthOfWeek('2026-W53')).toBe('2026-12');
    expect(new Date(weekStart('2026-W44')).toISOString().slice(0, 10)).toBe('2026-10-26');
    expect(previousWeek('2026-W44')).toBe('2026-W43');
    expect(previousWeek('2027-W01')).toBe('2026-W53');
  });

  it('la misma semilla da el mismo nivel; semillas distintas, niveles distintos', () => {
    expect(generateLevel('2026-W44')).toEqual(generateLevel('2026-W44'));
    const shapes = new Set(seeds.slice(0, 30).map((s) => JSON.stringify(generateLevel(s).baldas)));
    expect(shapes.size).toBeGreaterThan(15);
  });

  it('200 semanas: caben en el lienzo, se resuelven paso a paso en el mínimo y dan tres estrellas', () => {
    let forcedLying = 0;
    for (const seed of seeds) {
      const level = generateLevel(seed);
      expect(level.libros.length).toBeLessThanOrEqual(LIMITS.maxBooks);
      expect(level.libros.reduce((n, b) => n + b.grosor, 0)).toBeLessThanOrEqual(LIMITS.maxThickness);
      expect(level.baldas.reduce((n, b) => n + b.alto, 0)).toBeLessThanOrEqual(LIMITS.maxShelfHeight);
      expect(new Set(level.libros.map((b) => b.id)).size).toBe(level.libros.length);
      let game = createGame(level);
      for (const s of level.solution) {
        const target = { balda: s.balda, x: s.x, y: s.y, orient: s.orient };
        // Soltarlo en su columna lo deja justo ahí (la gravedad lleva al mismo sitio)
        expect(dropAt(level, game, s.libro, s.balda, s.x, s.orient), `${seed} · ${s.libro}`).toMatchObject({ ok: true, target });
        game = place(level, game, s.libro, target);
      }
      expect(game.won, seed).toBe(true);
      expect(game.moves).toBe(minMoves(level));
      expect(stars(level, game).total).toBe(3);
      const tallest = Math.max(...level.baldas.map((b) => b.alto));
      if (level.libros.some((b) => b.alto > tallest)) forcedLying += 1;
    }
    // Una buena parte de las semanas obliga a tumbar algún libro
    expect(forcedLying).toBeGreaterThan(40);
  });
});
