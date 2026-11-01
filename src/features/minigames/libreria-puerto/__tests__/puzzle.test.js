// «La librería del puerto»: reglas del puzle, soluciones de los niveles, estrellas por movimientos y pistas.
import { describe, expect, it } from 'vitest';
import { LEVELS, levelById } from '../levels';
import { canLift, check, createGame, dropAt, exportState, footprint, hint, isComplete, minMoves, place, replay, reset, restoreState, returnToCrate, stars, undo } from '../puzzle';

const solve = (level) => level.solution.reduce((g, s) => place(level, g, s.libro, { balda: s.balda, x: s.x, y: s.y, orient: s.orient }), createGame(level));

describe('soluciones', () => {
  for (const level of LEVELS) {
    it(`${level.id}: su solución coloca todos los libros paso a paso y gana`, () => {
      let game = createGame(level);
      for (const s of level.solution) {
        const target = { balda: s.balda, x: s.x, y: s.y, orient: s.orient };
        expect(check(level, game, s.libro, target), `${s.libro}`).toEqual({ ok: true, reason: null });
        // Soltarlo en su columna lo deja exactamente ahí (la gravedad lleva al mismo sitio)
        expect(dropAt(level, game, s.libro, s.balda, s.x, s.orient).target).toEqual(target);
        game = place(level, game, s.libro, target);
        expect(game.placed[s.libro]).toEqual(target);
      }
      expect(game.won).toBe(true);
      expect(level.solution).toHaveLength(level.libros.length);
    });
  }

  it('n3 exige girar: los dos libros de alto 5 no caben de pie en ninguna balda', () => {
    const level = levelById('n3');
    const game = createGame(level);
    for (const id of ['gran-atlas', 'diccionario']) {
      for (const balda of level.baldas) {
        for (let x = 0; x < balda.ancho; x += 1) expect(dropAt(level, game, id, balda.id, x, 'pie').ok).toBe(false);
      }
    }
  });

  it('n2: los libros de alto 4 solo caben de pie arriba', () => {
    const level = levelById('n2');
    expect(dropAt(level, createGame(level), 'velas', 'B', 0, 'pie')).toMatchObject({ ok: false, reason: 'fuera' });
    expect(dropAt(level, createGame(level), 'velas', 'A', 0, 'pie').ok).toBe(true);
  });
});

describe('reglas', () => {
  const level = levelById('n3');

  it('girar intercambia ancho y alto', () => {
    const atlas = level.libros.find((b) => b.id === 'gran-atlas');
    expect(footprint(atlas, 'pie')).toEqual({ w: 2, h: 5 });
    expect(footprint(atlas, 'tumbado')).toEqual({ w: 5, h: 2 });
  });

  it('una colocación inválida no cambia el estado (fuera, solape, flotando)', () => {
    let game = place(level, createGame(level), 'gran-atlas', { balda: 'A', x: 0, y: 0, orient: 'tumbado' });
    const before = exportState(game);
    expect(place(level, game, 'nautica', { balda: 'A', x: 6, y: 0, orient: 'tumbado' })).toBe(game); // fuera
    expect(place(level, game, 'nautica', { balda: 'A', x: 1, y: 0, orient: 'pie' })).toBe(game); // solape
    expect(place(level, game, 'limones', { balda: 'A', x: 5, y: 1, orient: 'pie' })).toBe(game); // flota
    expect(check(level, game, 'limones', { balda: 'A', x: 4, y: 2, orient: 'tumbado' }).reason).toBe('flota'); // medio apoyado
    expect(exportState(game)).toBe(before);
    game = place(level, game, 'diccionario', { balda: 'A', x: 0, y: 2, orient: 'tumbado' });
    expect(game.placed.diccionario).toBeTruthy();
  });

  it('la gravedad apila y detecta un apoyo incompleto', () => {
    let game = place(level, createGame(level), 'gran-atlas', { balda: 'A', x: 0, y: 0, orient: 'tumbado' });
    expect(dropAt(level, game, 'diccionario', 'A', 0, 'tumbado')).toMatchObject({ ok: true, target: { y: 2 } });
    // Asomando por la derecha del atlas (columna 5 sin nada debajo): no se apoya entero
    expect(dropAt(level, game, 'diccionario', 'A', 2, 'tumbado')).toMatchObject({ ok: false, reason: 'flota' });
    game = place(level, game, 'diccionario', { balda: 'A', x: 0, y: 2, orient: 'tumbado' });
    // El de abajo no se puede sacar mientras sostiene a otro
    expect(canLift(level, game, 'gran-atlas')).toEqual({ ok: false, reason: 'encima' });
    expect(returnToCrate(level, game, 'gran-atlas')).toBe(game);
  });

  it('mover un libro ya colocado y devolverlo a la caja', () => {
    let game = place(level, createGame(level), 'limones', { balda: 'B', x: 0, y: 0, orient: 'pie' });
    game = place(level, game, 'limones', { balda: 'B', x: 3, y: 0, orient: 'pie' });
    expect(game.placed.limones).toMatchObject({ x: 3 });
    game = returnToCrate(level, game, 'limones');
    expect(game.placed.limones).toBe(null);
  });

  it('deshacer y reiniciar', () => {
    let game = place(level, createGame(level), 'limones', { balda: 'B', x: 0, y: 0, orient: 'pie' });
    game = place(level, game, 'limones', { balda: 'A', x: 2, y: 0, orient: 'tumbado' });
    game = undo(level, game);
    expect(game.placed.limones).toEqual({ balda: 'B', x: 0, y: 0, orient: 'pie' });
    game = undo(level, game);
    expect(game.placed.limones).toBe(null);
    expect(undo(level, game).placed).toEqual(game.placed);
    expect(reset(level)).toEqual(createGame(level));
  });

  it('victoria solo con todos los libros colocados, y una sola vez', () => {
    let game = createGame(level);
    for (const s of level.solution.slice(0, -1)) game = place(level, game, s.libro, s);
    expect(game.won).toBe(false);
    expect(isComplete(level, game)).toBe(false);
    const last = level.solution.at(-1);
    game = place(level, game, last.libro, last);
    expect(game.won).toBe(true);
    // Tras ganar, el tablero queda fijo: nada lo cambia hasta reiniciar
    expect(returnToCrate(level, game, last.libro)).toBe(game);
    expect(undo(level, game)).toBe(game);
  });

  it('guardar y restaurar conservan el tablero; un estado manipulado se rechaza', () => {
    const half = level.solution.slice(0, 4).reduce((g, s) => place(level, g, s.libro, s), createGame(level));
    const back = restoreState(level, exportState(half));
    expect(back.placed).toEqual(half.placed);
    expect(back.won).toBe(false);
    expect(restoreState(level, exportState(solve(level))).won).toBe(true);
    // Otra versión, otro nivel, JSON roto o un libro flotando: no se restaura
    expect(restoreState(level, exportState(half).replace('"v":1', '"v":9'))).toBe(null);
    expect(restoreState(levelById('n1'), exportState(half))).toBe(null);
    expect(restoreState(level, '{roto')).toBe(null);
    const tampered = JSON.parse(exportState(createGame(level)));
    tampered.placed.limones = { balda: 'B', x: 0, y: 2, orient: 'pie' };
    expect(restoreState(level, JSON.stringify(tampered))).toBe(null);
  });
});
describe('estrellas por movimientos y pistas', () => {
  for (const level of LEVELS) {
    it(`${level.id}: su solución se hace en el mínimo (un movimiento por libro) y da tres estrellas`, () => {
      const game = solve(level);
      expect(game.moves).toBe(minMoves(level));
      expect(stars(level, game)).toEqual({ total: 3, min: level.libros.length, moves: level.libros.length });
      // Con una pista, como mucho dos
      expect(stars(level, game, { hints: 1 }).total).toBe(2);
    });
  }

  it('dos estrellas hasta el mínimo + 2; una a partir de ahí; ninguna sin terminar', () => {
    const level = levelById('n1');
    const at = (id, x) => ({ balda: 'A', x, y: 0, orient: 'pie' });
    let game = place(level, createGame(level), 'cuaderno-sal', at('cuaderno-sal', 0));
    expect(stars(level, game).total).toBe(0);
    // Un rodeo: llevarlo a otra columna y volver (dos movimientos de más)
    game = place(level, game, 'cuaderno-sal', at('cuaderno-sal', 5));
    game = place(level, game, 'cuaderno-sal', at('cuaderno-sal', 0));
    for (const s of level.solution.slice(1)) game = place(level, game, s.libro, { balda: s.balda, x: s.x, y: s.y, orient: s.orient });
    expect(game.moves).toBe(6);
    expect(stars(level, game).total).toBe(2);
    // Deshacer cuenta: un movimiento más ya es una estrella
    let longer = place(level, createGame(level), 'cuaderno-sal', at('cuaderno-sal', 3));
    longer = undo(level, longer);
    longer = place(level, longer, 'cuaderno-sal', at('cuaderno-sal', 5));
    longer = place(level, longer, 'cuaderno-sal', at('cuaderno-sal', 0));
    for (const s of level.solution.slice(1)) longer = place(level, longer, s.libro, { balda: s.balda, x: s.x, y: s.y, orient: s.orient });
    expect(longer.moves).toBe(7);
    expect(stars(level, longer).total).toBe(1);
  });

  it('pista: el siguiente paso de la solución; dice si se puede hacer ya', () => {
    const level = levelById('n3');
    let game = createGame(level);
    expect(hint(level, game)).toEqual({ libro: 'gran-atlas', target: { balda: 'A', x: 0, y: 0, orient: 'tumbado' }, ok: true });
    game = place(level, game, 'gran-atlas', { balda: 'A', x: 0, y: 0, orient: 'tumbado' });
    expect(hint(level, game).libro).toBe('diccionario');
    // Si otro libro ocupa el sitio, la pista lo dice (ok: false)
    game = place(level, game, 'limones', { balda: 'A', x: 0, y: 2, orient: 'tumbado' });
    expect(game.placed.limones).not.toBe(null);
    expect(hint(level, game)).toMatchObject({ libro: 'diccionario', ok: false });
    expect(hint(level, solve(level))).toBe(null);
  });
});

describe('repetir una partida (validación del ranking)', () => {
  it('las jugadas de una partida la reproducen exactamente: mismos movimientos y victoria', () => {
    const level = levelById('n3');
    let game = createGame(level);
    game = place(level, game, 'nautica', { balda: 'B', x: 0, y: 0, orient: 'pie' });
    game = returnToCrate(level, game, 'nautica');
    game = undo(level, game);
    game = returnToCrate(level, game, 'nautica');
    for (const s of level.solution) game = place(level, game, s.libro, { balda: s.balda, x: s.x, y: s.y, orient: s.orient });
    const again = replay(level, game.jugadas);
    expect(again.won).toBe(true);
    expect(again.moves).toBe(game.moves);
    expect(again.placed).toEqual(game.placed);
  });

  it('rechaza jugadas imposibles, inventadas o de más (y una lista vacía no gana)', () => {
    const level = levelById('n1');
    const ok = level.solution.map((s) => ({ t: 'poner', libro: s.libro, balda: s.balda, x: s.x, y: s.y, orient: s.orient }));
    expect(replay(level, ok)).toMatchObject({ won: true, moves: 4 });
    // Un libro en el aire, otro encima de otro, uno que no existe, una jugada mal formada
    expect(replay(level, [{ ...ok[0], y: 2 }])).toBe(null);
    expect(replay(level, [ok[0], { ...ok[1], x: 0 }])).toBe(null);
    expect(replay(level, [{ ...ok[0], libro: 'inventado' }])).toBe(null);
    expect(replay(level, [{ t: 'teletransportar' }])).toBe(null);
    // Deshacer sin nada que deshacer, o jugar después de ganar
    expect(replay(level, [{ t: 'deshacer' }])).toBe(null);
    expect(replay(level, [...ok, { t: 'caja', libro: 'faros' }])).toBe(null);
    expect(replay(level, []).won).toBe(false);
    expect(replay(level, 'no es una lista')).toBe(null);
  });
});
