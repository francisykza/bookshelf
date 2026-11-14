// El taller de la trastienda (1.133, cafe-libreria.md §16.3): cada daño con su gesto y su objeto; ninguno falla ni tiene tiempo
// límite; lo hecho no se pierde al soltar; con movimiento reducido o teclado, de una vez y bien. El mimo de cada daño (2 bien,
// 1 se podía mejorar) da las estrellas.
import { describe, expect, it } from 'vitest';
import { CLIENTES_TALLER, DANO, DANOS, LIBROS_TALLER, PRIMER_ENCARGO, cuantosDanos, encargoDe, estrellasTaller, premioTaller } from '../cafe/cafeTaller';
import { LIBRO_TALLER, PLIEGUE, crearGestoTaller, gestosDano, letrasTapa, manchasDe, mohoDe, polvoInicial, superficieDe } from '../cafe/cafeTallerGestos';

/** Una pasada de lado a lado de la superficie a la altura `v`; `paso` en `u` cada 10 ms. */
function pasada(g, v, t0, { paso = 0.02, dir = 1 } = {}) {
  let t = t0;
  let s = g.abajo({ u: dir > 0 ? 0 : 1, v, t });
  const eventos = [...s.eventos];
  for (let u = 0; u <= 1.0001; u += paso) {
    t += 10;
    s = g.mover({ u: dir > 0 ? u : 1 - u, v, t });
    eventos.push(...s.eventos);
  }
  g.arriba();
  return { s, t, eventos };
}
function cepillar(g, { paso = 0.02, max = 10 } = {}) {
  const filas = [0.05, 0.18, 0.32, 0.45, 0.59, 0.72, 0.86, 0.97];
  let t = 0;
  let n = 0;
  let s;
  const eventos = [];
  for (let r = 0; r < max; r += 1)
    for (const v of filas) {
      const p = pasada(g, v, t + 100, { paso, dir: n % 2 ? -1 : 1 });
      ({ s, t } = p);
      eventos.push(...p.eventos);
      n += 1;
      if (s.hecho) return { s, n, eventos };
    }
  return { s, n, eventos };
}
/** Círculos pequeños (1,5 cm de radio, en metros) alrededor de un punto de las dos páginas. */
function circulos(g, m, { radio = 0.015, t0 = 0, vueltas = 8, hasta = () => false } = {}) {
  const W = LIBRO_TALLER.ancho * 2;
  const D = LIBRO_TALLER.hondo;
  let t = t0;
  let s = g.abajo({ u: m.u + radio / W, v: m.v, t });
  for (let k = 1; k <= vueltas * 16; k += 1) {
    const a = (k * Math.PI) / 8;
    t += 16;
    s = g.mover({ u: m.u + (Math.cos(a) * radio) / W, v: m.v + (Math.sin(a) * radio) / D, t });
    if (hasta(s)) break;
  }
  g.arriba();
  return { s, t };
}
const sobreElPliegue = (f, desvio = 0) => {
  // `desvio`, en metros, perpendicular al pliegue
  const W = LIBRO_TALLER.ancho * 2;
  const D = LIBRO_TALLER.hondo;
  const dx = (PLIEGUE.b[0] - PLIEGUE.a[0]) * W;
  const dy = (PLIEGUE.b[1] - PLIEGUE.a[1]) * D;
  const L = Math.hypot(dx, dy);
  return { u: PLIEGUE.a[0] + (PLIEGUE.b[0] - PLIEGUE.a[0]) * f + ((-dy / L) * desvio) / W, v: PLIEGUE.a[1] + (PLIEGUE.b[1] - PLIEGUE.a[1]) * f + ((dx / L) * desvio) / D };
};
function alisar(g, { desvio = 0, idas = 2 } = {}) {
  let t = 0;
  let s = g.abajo({ ...sobreElPliegue(0, desvio), t });
  for (let i = 0; i < idas && !s.hecho; i += 1)
    for (let k = 0; k <= 20 && !s.hecho; k += 1) {
      const f = i % 2 ? 1 - k / 20 : k / 20;
      t += 20;
      s = g.mover({ ...sobreElPliegue(f, desvio), t });
    }
  return s;
}

describe('el encargo del taller', () => {
  it('las cifras aprobadas y las listas', () => {
    expect(DANOS).toEqual(['polvo', 'manchas', 'arrugas', 'lomo', 'dorado']);
    for (const d of DANOS) expect(DANO[d].nombre && DANO[d].objeto && DANO[d].orden && DANO[d].ayuda && DANO[d].atajo).toBeTruthy();
    expect([premioTaller(1), premioTaller(2), premioTaller(3)]).toEqual([
      { granos: 6, reputacion: 15 },
      { granos: 9, reputacion: 22 },
      { granos: 12, reputacion: 30 },
    ]);
    expect(LIBROS_TALLER).toHaveLength(16);
    expect(CLIENTES_TALLER).toHaveLength(12);
    expect(PRIMER_ENCARGO.danos).toEqual(['polvo', 'arrugas', 'dorado']);
    expect(encargoDe({ n: 1, libro: 0, quien: 0, danos: PRIMER_ENCARGO.danos, llega: '2026-11-14' })).toMatchObject({ primero: true, tapa: 'QUIJOTE' });
    expect(encargoDe(null)).toBeNull();
    // De 2 a 5 daños: más con el nivel
    expect([cuantosDanos(3, 0), cuantosDanos(3, 1), cuantosDanos(5, 0), cuantosDanos(7, 1), cuantosDanos(12, 1)]).toEqual([2, 3, 3, 5, 5]);
  });
  it('las estrellas salen del mimo: todo bien, 3; al menos la mitad, 2; si no, 1 (nunca 0)', () => {
    expect(estrellasTaller([2, 2, 2])).toBe(3);
    expect(estrellasTaller([1, 2, 2])).toBe(2);
    expect(estrellasTaller([1, 2])).toBe(2);
    expect(estrellasTaller([1, 1, 2])).toBe(1);
    expect(estrellasTaller([1, 1])).toBe(1);
    expect(estrellasTaller([])).toBe(1);
  });
  it('cada daño, sus gestos y su superficie; el lomo, la cola y luego la prensa', () => {
    expect(DANOS.flatMap(gestosDano)).toEqual(['polvo', 'manchas', 'arrugas', 'cola', 'prensa', 'dorado']);
    expect(['polvo', 'manchas', 'arrugas', 'cola', 'prensa', 'dorado', 'exlibris'].map(superficieDe)).toEqual(['tapa', 'pliego', 'pliego', 'tapa', null, 'tapa', 'pliego']);
  });
  it('las letras del título: sin los espacios, con la Ñ, y cada libro con su moho y sus manchas', () => {
    expect(letrasTapa('MOBY DICK').map((l) => l.ch).join('')).toBe('MOBYDICK');
    expect(letrasTapa('CAÑAS').map((l) => l.ch).join('')).toBe('CAÑAS');
    for (const l of letrasTapa('QUIJOTE')) expect(l.u - l.w / 2 > 0 && l.u + l.w / 2 < 1).toBe(true);
    expect(manchasDe(7)).toEqual(manchasDe(7));
    expect(manchasDe(7)).not.toEqual(manchasDe(8));
    expect(mohoDe(7)).toHaveLength(3);
    const { polvo, moho } = polvoInicial(7);
    expect(polvo.every((p) => p > 0.8)).toBe(true);
    expect(moho.filter((m) => m > 0)).toHaveLength(3);
  });
});

describe('los gestos del taller', () => {
  it('la brocha: pasadas largas y suaves limpian la tapa; el moho pide más; soltar no pierde nada', () => {
    const g = crearGestoTaller('polvo', { semilla: 7 });
    const una = pasada(g, 0.45, 0).s;
    expect(una.hecho).toBe(false);
    expect(una.progreso).toBeGreaterThan(0);
    expect(g.estado.progreso).toBe(una.progreso);
    const { s, n, eventos } = cepillar(crearGestoTaller('polvo', { semilla: 7 }));
    expect(s.hecho).toBe(true);
    expect(s.mimo).toBe(2);
    // Tras ver la 1.133 («tarda demasiado»): unas cuatro pasadas, no diez o doce
    expect(n).toBeGreaterThanOrEqual(3);
    expect(n).toBeLessThanOrEqual(6);
    expect(eventos.filter((e) => e === 'moho')).toHaveLength(3);
    // Un soplo por cada cuarto de tapa limpia (su sonido), una sola vez cada uno y en orden
    expect(eventos.filter((e) => e.startsWith('claro:'))).toEqual(['claro:1', 'claro:2', 'claro:3']);
    expect(s.vista.polvo.every((p) => p === 0)).toBe(true);
  });
  it('a brochazos también se limpia, pero «se podía mejorar»', () => {
    const { s } = cepillar(crearGestoTaller('polvo', { semilla: 7 }), { paso: 0.12 });
    expect(s.hecho).toBe(true);
    expect(s.mimo).toBe(1);
  });
  it('la goma de miga: círculos sobre cada mancha, y después barrer las migas', () => {
    const g = crearGestoTaller('manchas', { semilla: 7 });
    let t = 0;
    let s;
    const borradas = [];
    for (const m of manchasDe(7)) {
      ({ s, t } = circulos(g, m, { t0: t, hasta: (e) => e.vista.manchas.find((x) => x.u === m.u).alfa <= 0 }));
      borradas.push(s.vista.manchas.find((x) => x.u === m.u).alfa);
    }
    expect(borradas).toEqual([0, 0, 0]);
    expect(s.fase).toBe('barrer');
    expect(s.hecho).toBe(false);
    expect(s.vista.migas.length).toBeGreaterThan(5);
    // Barrer con el canto de la mano: una pasada larga
    s = g.abajo({ u: 0.3, v: 0.5, t });
    for (let u = 0.3; u <= 0.75; u += 0.03) s = g.mover({ u, v: 0.5, t: (t += 16) });
    expect(s.hecho).toBe(true);
    expect(s.mimo).toBe(2);
    expect(s.vista.migas).toHaveLength(0);
  });
  it('frotar alrededor de las manchas en vez de encima ensucia el papel: «se podía mejorar»', () => {
    const g = crearGestoTaller('manchas', { semilla: 3 });
    let t = 0;
    for (const m of manchasDe(3)) ({ t } = circulos(g, m, { radio: m.r * 2, t0: t, vueltas: 10 }));
    let s;
    for (const m of manchasDe(3)) ({ s, t } = circulos(g, m, { t0: t, hasta: (e) => e.vista.manchas.find((x) => x.u === m.u).alfa <= 0 }));
    expect(s.fase).toBe('barrer');
    s = g.abajo({ u: 0.2, v: 0.5, t });
    for (let u = 0.2; u <= 0.7; u += 0.03) s = g.mover({ u, v: 0.5, t: (t += 16) });
    expect(s.hecho).toBe(true);
    expect(s.mimo).toBe(1);
  });
  it('la plegadera: ida y vuelta a lo largo del pliegue; centrada, bien; un poco fuera, se podía mejorar', () => {
    const ida = alisar(crearGestoTaller('arrugas'), { idas: 1 });
    expect(ida.hecho).toBe(false);
    expect(ida.vista.arruga).toBe(0.5);
    const bien = alisar(crearGestoTaller('arrugas'));
    expect(bien.hecho).toBe(true);
    expect(bien.mimo).toBe(2);
    const torcida = alisar(crearGestoTaller('arrugas'), { desvio: 0.02 });
    expect(torcida.hecho).toBe(true);
    expect(torcida.mimo).toBe(1);
    // Lejos del pliegue no alisa
    const lejos = alisar(crearGestoTaller('arrugas'), { desvio: 0.06 });
    expect(lejos.hecho).toBe(false);
    expect(lejos.vista.arruga).toBe(1);
  });
  it('la cola: dos pasadas del pie a la cabeza bastan; cargar un tramo, sobra cola', () => {
    const g = crearGestoTaller('cola');
    let t = 0;
    let s;
    for (let n = 0; n < 2; n += 1) {
      s = g.abajo({ u: 0.08, v: 0, t });
      for (let v = 0; v <= 1.0001; v += 0.04) s = g.mover({ u: 0.08, v, t: (t += 20) });
      g.arriba();
    }
    expect(s.hecho).toBe(true);
    expect(s.mimo).toBe(2);
    // Fuera del lomo no pinta
    const fuera = crearGestoTaller('cola');
    fuera.abajo({ u: 0.6, v: 0, t: 0 });
    for (let v = 0; v <= 1; v += 0.04) s = fuera.mover({ u: 0.6, v, t: v * 500 });
    expect(s.progreso).toBe(0);
    const mucha = crearGestoTaller('cola');
    t = 0;
    s = mucha.abajo({ u: 0.08, v: 0, t });
    for (let k = 0; k < 16; k += 1) for (let v = 0; v <= 0.3; v += 0.03) s = mucha.mover({ u: 0.08, v: k % 2 ? 0.3 - v : v, t: (t += 20) });
    for (let n = 0; n < 2 && !s.hecho; n += 1) for (let v = 0; v <= 1.0001; v += 0.04) s = mucha.mover({ u: 0.08, v, t: (t += 20) });
    expect(s.hecho).toBe(true);
    expect(s.mimo).toBe(1);
  });
  it('la prensa: dos vueltas al husillo, en cualquier sentido, con un clic cada cuarto y el tope', () => {
    for (const sentido of [1, -1]) {
      const g = crearGestoTaller('prensa', { centro: { x: 200, y: 300 } });
      let s = g.abajo({ x: 260, y: 300, t: 0 });
      let clics = 0;
      const eventos = [];
      for (let k = 1; k <= 80 && !s.hecho; k += 1) {
        const a = (sentido * k * Math.PI) / 18;
        s = g.mover({ x: 200 + Math.cos(a) * 60, y: 300 + Math.sin(a) * 60, t: k * 16 });
        clics += s.eventos.filter((e) => e === 'husillo').length;
        eventos.push(...s.eventos);
      }
      expect(s.hecho).toBe(true);
      expect(s.mimo).toBe(2);
      expect(clics).toBe(8);
      expect(eventos).toContain('tope');
    }
    // Una vuelta, a medias; soltar no la pierde
    const g = crearGestoTaller('prensa', { centro: { x: 200, y: 300 } });
    let s = g.abajo({ x: 260, y: 300, t: 0 });
    for (let k = 1; k <= 36; k += 1) s = g.mover({ x: 200 + Math.cos((k * Math.PI) / 18) * 60, y: 300 + Math.sin((k * Math.PI) / 18) * 60, t: k * 16 });
    g.arriba();
    expect(g.estado.progreso).toBeCloseTo(0.5, 1);
    expect(g.estado.hecho).toBe(false);
  });
  it('el hierro y el pan de oro: apretar y mantener sobre cada letra; fuera de la letra, se podía mejorar', () => {
    const dorar = (tapa, fuera = 0) => {
      const g = crearGestoTaller('dorado', { tapa });
      let t = 0;
      let s;
      const oros = [];
      for (const l of letrasTapa(tapa)) {
        s = g.abajo({ u: l.u, v: l.v + (l.h / 2) * fuera, t });
        for (let k = 0; k < 80; k += 1) {
          s = g.paso((t += 16));
          oros.push(...s.eventos.filter((e) => e.startsWith('oro')));
          if (s.eventos.some((e) => e.startsWith('oro'))) break;
        }
        g.arriba();
        t += 300;
      }
      return { s, oros };
    };
    const bien = dorar('QUIJOTE');
    expect(bien.s.hecho).toBe(true);
    expect(bien.s.mimo).toBe(2);
    expect(bien.oros).toHaveLength(7);
    const torcido = dorar('QUIJOTE', 1.4);
    expect(torcido.s.hecho).toBe(true);
    expect(torcido.s.mimo).toBe(1);
    // A medias: soltar se queda con el oro de cada letra
    const g = crearGestoTaller('dorado', { tapa: 'RIMAS' });
    const [l] = letrasTapa('RIMAS');
    g.abajo({ u: l.u, v: l.v, t: 0 });
    g.paso(300);
    g.arriba();
    expect(g.estado.vista.oro[0]).toBeGreaterThan(0.4);
    expect(g.estado.vista.oro[0]).toBeLessThan(1);
    g.abajo({ u: l.u, v: l.v, t: 1000 });
    expect(g.paso(1400).vista.oro[0]).toBe(1);
  });
  it('el ex libris: apretar y mantener el sello en la guarda', () => {
    const g = crearGestoTaller('exlibris');
    let s = g.abajo({ u: 0.25, v: 0.6, t: 0 });
    s = g.paso(500);
    expect(s.hecho).toBe(false);
    s = g.paso(950);
    expect(s.hecho).toBe(true);
    expect(s.eventos).toContain('sellado');
    expect(s.vista.exlibris.sellado).toBe(true);
  });
  it('con movimiento reducido o teclado, cada gesto de una vez y bien', () => {
    for (const tipo of ['polvo', 'manchas', 'arrugas', 'cola', 'prensa', 'dorado', 'exlibris']) {
      const s = crearGestoTaller(tipo, { tapa: 'ODISEA', semilla: 5 }).completar();
      expect(s.hecho, tipo).toBe(true);
      expect(s.mimo, tipo).toBe(2);
      expect(s.progreso, tipo).toBe(1);
    }
  });
});
