// «La librería del puerto»: orden del ranking semanal y mensual y el podio que recibe la distinción.
import { describe, expect, it } from 'vitest';
import { demoResults, monthlyRanking, podiumDistinctions, weeklyRanking } from '../ranking';

const r = (user, week, moves, at, min = 7) => ({ user, nombre: user, week, moves, min, at });

describe('ranking', () => {
  it('semana: menos movimientos primero; a igualdad, quien lo consiguió antes; cuenta el mejor intento', () => {
    const results = [r('ana', '2026-W44', 9, 5), r('ana', '2026-W44', 7, 50), r('luis', '2026-W44', 7, 20), r('eva', '2026-W44', 8, 1), r('otro', '2026-W43', 7, 1)];
    expect(weeklyRanking(results, '2026-W44').map((x) => [x.user, x.moves, x.puesto])).toEqual([
      ['luis', 7, 1],
      ['ana', 7, 2],
      ['eva', 8, 3],
    ]);
  });

  it('mes: más semanas completadas; luego menos movimientos de más; luego quien terminó antes', () => {
    const results = [
      // ana: dos semanas, 1 de más en total
      r('ana', '2026-W40', 7, 10),
      r('ana', '2026-W41', 8, 20),
      // luis: dos semanas, 0 de más
      r('luis', '2026-W40', 7, 30),
      r('luis', '2026-W41', 7, 40),
      // eva: una semana perfecta (cuenta menos que dos)
      r('eva', '2026-W41', 7, 1),
      // W45 cae en noviembre: no cuenta para octubre
      r('eva', '2026-W45', 7, 1),
    ];
    expect(monthlyRanking(results, '2026-10').map((x) => [x.user, x.semanas, x.extra, x.puesto])).toEqual([
      ['luis', 2, 0, 1],
      ['ana', 2, 1, 2],
      ['eva', 1, 0, 3],
    ]);
  });

  it('el podio son los tres primeros, con su puesto en la nota', () => {
    const ranking = weeklyRanking([r('a', 'W', 7, 1), r('b', 'W', 7, 2), r('c', 'W', 8, 3), r('d', 'W', 9, 4)], 'W');
    expect(podiumDistinctions(ranking, 'libreria-semana', 'semana 44')).toEqual([
      { user: 'a', kind: 'libreria-semana', note: '1.º · semana 44' },
      { user: 'b', kind: 'libreria-semana', note: '2.º · semana 44' },
      { user: 'c', kind: 'libreria-semana', note: '3.º · semana 44' },
    ]);
  });

  it('los datos de demostración son reproducibles y nunca bajan del mínimo', () => {
    const weeks = [{ week: '2026-W44', min: 7, start: 0 }];
    expect(demoResults(weeks)).toEqual(demoResults(weeks));
    expect(demoResults(weeks).every((x) => x.moves >= x.min && x.user.startsWith('demo-'))).toBe(true);
  });
});
