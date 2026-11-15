// 1.133.1 · Tocar un sitio de la sala y llegar andando (Francisco, 15-11-2026: «si pulsas un sitio de la sala puedas ir a el,
// ahora mismo no siempre hace esa función»): el camino rodea lo que hay en medio y, si en el sitio tocado no se puede estar,
// llega al hueco libre más cercano.
import { describe, expect, it } from 'vitest';
import { MOSTRADOR, cercaLibre, dentro, libreEntre, ruta } from '../cafe/cafeLayout';

// Una mesa grande en medio del local (x de 3 a 5, y de 5 a 6), como las cajas de lo colocado
const MESA = [3, 5, 0, 5, 6];
const OP = { limpio: true, nivel: 2, muebles: [MESA] };

/** Que se pueda andar todo el camino, tramo a tramo, desde (fx, fy). */
function andable(fx, fy, camino) {
  let d = { x: fx, y: fy };
  for (const p of camino) {
    if (!libreEntre(d.x, d.y, p.x, p.y, OP)) return false;
    d = p;
  }
  return true;
}

describe('ruta del café', () => {
  it('en línea recta si no hay nada en medio', () => {
    expect(ruta(2, 4, 2, 8, OP)).toEqual([{ x: 2, y: 8 }]);
  });

  it('rodea una mesa que está en medio y llega donde se tocó', () => {
    expect(libreEntre(4, 4, 4, 7.5, OP)).toBe(false);
    const camino = ruta(4, 4, 4, 7.5, OP);
    expect(camino.length).toBeGreaterThan(1);
    expect(andable(4, 4, camino)).toBe(true);
    expect(camino.at(-1)).toEqual({ x: 4, y: 7.5 });
    // Sin vueltas de más: poco más que bordear la mesa
    let largo = 0;
    let d = { x: 4, y: 4 };
    for (const p of camino) {
      largo += Math.hypot(p.x - d.x, p.y - d.y);
      d = p;
    }
    expect(largo).toBeLessThan(6);
  });

  it('al tocar un mueble o el mostrador, llega al hueco libre más cercano, por el lado de quien anda', () => {
    const x = (MOSTRADOR.x0 + MOSTRADOR.x1) / 2;
    const camino = ruta(4, 5.5 + 2, x, 5.5, OP);
    const meta = camino.at(-1);
    expect(dentro(meta.x, meta.y, OP)).toBe(true);
    expect(Math.hypot(meta.x - x, meta.y - 5.5)).toBeLessThan(1);
    // Por delante del mostrador (el lado del salón), no por detrás
    expect(meta.x).toBeLessThan(MOSTRADOR.x0);
    expect(andable(4, 7.5, camino)).toBe(true);
  });

  it('el centro de la mesa: al borde de la mesa más cercano a quien anda', () => {
    const p = cercaLibre(4, 5.5, 4, 3.8, OP);
    expect(dentro(p.x, p.y, OP)).toBe(true);
    expect(p.y).toBeLessThan(5);
  });

  it('un sitio cerrado (mesas y sillas sin hueco entre ellas): hasta lo más cerca que se pueda, no se queda quieto', () => {
    // El plano inicial del nivel 3: la fila de la primera mesa y la columna de la segunda cierran el rincón de abajo a la izquierda
    const muebles = [
      [1.7, 4.55, 0, 3.5, 5.35, 1],
      [1.7, 6.55, 0, 2.5, 7.35, 1],
      [0.7, 6.55, 0, 1.5, 7.35, 1],
      [2.7, 6.55, 0, 3.5, 7.35, 1],
      [3.7, 8.55, 0, 4.5, 9.35, 1],
      [3.7, 7.55, 0, 4.5, 8.35, 1],
      [3.7, 9.55, 0, 4.5, 10.35, 1],
      [0.7, 8.55, 0, 1.5, 9.35, 1],
    ];
    const op = { limpio: true, nivel: 3, muebles };
    const camino = ruta(2.1, 5.8, 2.1, 10.15, op);
    expect(camino).not.toBeNull();
    let d = { x: 2.1, y: 5.8 };
    for (const p of camino) {
      expect(libreEntre(d.x, d.y, p.x, p.y, op)).toBe(true);
      d = p;
    }
    expect(Math.hypot(d.x - 2.1, d.y - 10.15)).toBeLessThan(Math.hypot(2.1 - 2.1, 5.8 - 10.15) - 1);
  });

  it('sin sitio libre cerca (muy fuera del local), no hay camino', () => {
    expect(ruta(4, 4, 25, 40, OP)).toBeNull();
  });

  it('es rápido (se calcula al tocar, en el móvil)', () => {
    const t0 = performance.now();
    for (let k = 0; k < 20; k += 1) ruta(1.2, 8.5, 9.2, 4.2, OP);
    expect((performance.now() - t0) / 20).toBeLessThan(25);
  });
});
