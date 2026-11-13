// Preparar en la barra (revisión del 12-11-2026): cada etapa con su objeto y su gesto; ninguno falla ni tiene tiempo
// límite; lo hecho no se pierde al soltar; con movimiento reducido o teclado, de una vez.
import { describe, expect, it } from 'vitest';
import { ETAPAS, GESTOS, MANTENER_MS, crearGesto, gestosDe, nombreEtapa, vistaTaza, verAyuda } from '../cafe/cafeGestos';

const CAFE = { bebida: 'cafe', grano: 'intenso', leche: 'avena', toque: 'canela' };
const TE = { bebida: 'te', grano: 'suave', leche: 'sin', toque: 'miel' };

/** Un círculo de `vueltas` alrededor de (cx, cy), en pasos de 10°. */
function girar(g, vueltas, { cx = 200, cy = 300, r = 60, sentido = 1 } = {}) {
  let s = g.abajo(cx + r, cy, 0);
  for (let k = 1; k <= vueltas * 36; k += 1) {
    const a = (sentido * k * Math.PI) / 18;
    s = g.mover(cx + Math.cos(a) * r, cy + Math.sin(a) * r, k * 16);
  }
  return s;
}
function vaivenes(g, eje, n, amp = 40) {
  let s = g.abajo(200, 300, 0);
  for (let k = 1; k <= n * 2 + 1; k += 1) {
    const v = (k % 2 ? 1 : -1) * amp;
    s = g.mover(eje === 'x' ? 200 + v : 200, eje === 'y' ? 300 + v : 300, k * 30);
  }
  return s;
}

describe('las etapas de la barra', () => {
  it('cada receta pasa por sus gestos, todos distintos entre sí', () => {
    expect(ETAPAS).toEqual(['bebida', 'grano', 'extraer', 'leche', 'toque']);
    const cafe = ETAPAS.flatMap((e) => gestosDe(e, CAFE));
    expect(cafe).toEqual(['manivela', 'apisonar', 'palanca', 'vapor', 'verter', 'agitar']);
    const te = ETAPAS.flatMap((e) => gestosDe(e, TE));
    expect(te).toEqual(['cuchara', 'tetera', 'colador', 'hilo']);
    expect(new Set([...cafe, ...te]).size).toBe(cafe.length + te.length);
    // Cada gesto con su orden, su ayuda, su botón de un toque y su pista (todas distintas)
    const pistas = Object.values(GESTOS).map((g) => g.pista);
    expect(new Set(pistas).size).toBe(pistas.length);
    for (const g of Object.values(GESTOS)) expect(g.orden && g.ayuda && g.atajo).toBeTruthy();
  });
  it('sin leche y sin nada, esas etapas no tienen gesto; los nombres siguen a la bebida', () => {
    expect(gestosDe('leche', { leche: 'sin' })).toEqual([]);
    expect(gestosDe('toque', { toque: 'nada' })).toEqual([]);
    expect(gestosDe('bebida', CAFE)).toEqual([]);
    expect(nombreEtapa('grano', TE)).toBe('Hoja');
    expect(nombreEtapa('extraer', TE)).toBe('Reposar');
    expect(nombreEtapa('extraer', CAFE)).toBe('Extraer');
  });
});

describe('los gestos', () => {
  it('la manivela: dos vueltas en cualquier sentido, con un clic cada octavo; una vuelta se queda a medias', () => {
    const una = girar(crearGesto('manivela', { centro: { x: 200, y: 300 } }), 1);
    expect(una.hecho).toBe(false);
    expect(una.progreso).toBeCloseTo(0.5, 1);
    const g = crearGesto('manivela', { centro: { x: 200, y: 300 } });
    let clics = 0;
    let s = g.abajo(260, 300, 0);
    for (let k = 1; k <= 72; k += 1) {
      const a = (-k * Math.PI) / 18;
      s = g.mover(200 + Math.cos(a) * 60, 300 + Math.sin(a) * 60, k * 16);
      clics += s.eventos.filter((x) => x === 'clic').length;
    }
    expect(s.hecho).toBe(true);
    expect(clics).toBe(16);
    expect(s.pose.angulo).toBeLessThan(0);
    // Girar pegado al centro no cuenta (no se puede «hacer trampa» temblando)
    const g2 = crearGesto('manivela', { centro: { x: 200, y: 300 } });
    expect(girar(g2, 2, { r: 5 }).progreso).toBe(0);
  });
  it('apisonar: un deslizamiento firme hacia abajo; a medias, al soltar, el prensador sube y se sigue luego', () => {
    const g = crearGesto('apisonar');
    g.abajo(200, 300);
    expect(g.mover(200, 330).hecho).toBe(false);
    expect(g.arriba().pose.bajada).toBe(0);
    g.abajo(200, 300);
    const s = g.mover(200, 380);
    expect(s.hecho).toBe(true);
    expect(s.eventos).toContain('golpe');
  });
  it('la palanca: abajo y mantenida suma tiempo; soltar no pierde lo extraído', () => {
    const g = crearGesto('palanca');
    g.abajo(200, 300, 0);
    expect(g.mover(200, 395, 10).eventos).toContain('abajo');
    g.paso(10);
    let s = g.paso(10 + 100);
    for (let t = 110; t <= 700; t += 50) s = g.paso(t);
    expect(s.progreso).toBeGreaterThan(0.3);
    expect(s.hecho).toBe(false);
    const medio = s.progreso;
    s = g.arriba();
    expect(s.pose.bajada).toBe(0);
    expect(s.progreso).toBe(medio);
    // Sin bajarla del todo no cae nada
    g.abajo(200, 300, 2000);
    g.mover(200, 340, 2000);
    for (let t = 2000; t <= 3000; t += 50) s = g.paso(t);
    expect(s.progreso).toBe(medio);
    // Abajo otra vez, hasta el final
    g.mover(200, 400, 3000);
    for (let t = 3000; t <= 3000 + MANTENER_MS.palanca; t += 50) s = g.paso(t);
    expect(s.hecho).toBe(true);
    expect(s.pose.extraido).toBe(1);
  });
  it('la cuchara llega al colador arrastrándola; si se suelta antes, vuelve al tarro', () => {
    const g = crearGesto('cuchara');
    g.abajo(100, 300);
    g.mover(160, 300);
    expect(g.arriba().pose.t).toBe(0);
    g.abajo(100, 300);
    const s = g.mover(240, 310);
    expect(s.hecho).toBe(true);
    expect(s.eventos).toContain('hojas');
  });
  it('la tetera: hacia arriba y mantenida, se llena; el vapor, de lado y mantenido, crea la leche', () => {
    for (const [tipo, mover, campo] of [
      ['tetera', [200, 220], 'lleno'],
      ['vapor', [140, 300], 'espuma'],
    ]) {
      const g = crearGesto(tipo);
      g.abajo(200, 300, 0);
      g.mover(...mover, 0);
      let s;
      for (let t = 0; t <= MANTENER_MS[tipo] + 100; t += 50) s = g.paso(t);
      expect(s.hecho).toBe(true);
      expect(s.pose[campo]).toBe(1);
    }
  });
  it('el colador y la canela cuentan vaivenes amplios; los temblores no cuentan', () => {
    const c = vaivenes(crearGesto('colador'), 'y', 5);
    expect(c.hecho).toBe(true);
    expect(c.pose.inmersiones).toBe(5);
    expect(vaivenes(crearGesto('colador'), 'y', 5, 5).progreso).toBe(0);
    const a = vaivenes(crearGesto('agitar'), 'x', 8);
    expect(a.hecho).toBe(true);
    expect(vaivenes(crearGesto('agitar'), 'x', 8, 6).progreso).toBe(0);
  });
  it('servir con pulso: recto sale un corazón; ondulado, una hoja; en dos trazos también vale', () => {
    const recto = crearGesto('verter');
    recto.abajo(200, 200);
    let s = recto.mover(200, 260);
    expect(recto.arriba().progreso).toBeCloseTo(0.4, 1);
    recto.abajo(200, 200);
    s = recto.mover(200, 300);
    expect(s.hecho).toBe(true);
    expect(s.pose.arte).toBe('corazon');
    const onda = crearGesto('verter');
    onda.abajo(200, 200);
    for (let k = 1; k <= 10; k += 1) s = onda.mover(200 + (k % 2 ? 16 : -16), 200 + k * 16);
    expect(s.hecho).toBe(true);
    expect(s.pose.arte).toBe('hoja');
  });
  it('el hilo de miel se dibuja por encima de la taza, con los puntos para la escena', () => {
    const g = crearGesto('hilo', { centro: { x: 200, y: 300 } });
    let s = g.abajo(200, 300);
    for (let k = 1; k <= 40; k += 1) s = g.mover(200 + Math.cos(k / 3) * 50, 300 + Math.sin(k / 3) * 50);
    expect(s.hecho).toBe(true);
    expect(s.pose.puntos.length).toBeGreaterThan(10);
    expect(s.pose.puntos.every(([u, v]) => Math.abs(u) <= 1 && Math.abs(v) <= 1)).toBe(true);
  });
  it('de una vez (movimiento reducido o teclado), cualquier gesto queda hecho', () => {
    for (const tipo of Object.keys(GESTOS)) {
      const s = crearGesto(tipo).completar();
      expect(s.hecho, tipo).toBe(true);
      expect(s.eventos).toContain('hecho');
    }
    expect(crearGesto('verter').completar().pose.arte).toBe('corazon');
    expect(crearGesto('hilo').completar().pose.puntos.length).toBeGreaterThan(5);
  });
});

describe('la taza en la barra', () => {
  it('se llena con lo extraído y la leche; el té coge color con el colador; canela y miel encima', () => {
    expect(vistaTaza(CAFE).lleno).toBe(0);
    const hechos = { palanca: { extraido: 1 }, verter: { vertido: 1, arte: 'hoja' }, agitar: { golpes: 8 } };
    const v = vistaTaza(CAFE, hechos);
    expect(v.lleno).toBe(1);
    expect(v.arte).toBe('hoja');
    expect(v.canela).toBe(1);
    expect(v.crema).toBe(true);
    const te = vistaTaza(TE, { cuchara: { t: 1 }, tetera: { lleno: 1 } }, { tipo: 'colador', pose: { inmersiones: 2 } });
    expect(te.hojas).toBe(true);
    expect(te.lleno).toBeCloseTo(0.85);
    expect(te.color).toBeLessThan(1);
    expect(te.crema).toBe(false);
  });
});

describe('la «!» de ayuda', () => {
  it('en los niveles 1 y 2 siempre; después, solo si te quedas parado; y lo que diga el ajuste', () => {
    expect(verAyuda('auto', 1, false)).toBe(true);
    expect(verAyuda('auto', 2, false)).toBe(true);
    expect(verAyuda('auto', 3, false)).toBe(false);
    expect(verAyuda('auto', 3, true)).toBe(true);
    expect(verAyuda('siempre', 5, false)).toBe(true);
    expect(verAyuda('nunca', 1, true)).toBe(false);
  });
});

describe('bloque 4a: el chocolate y la nata, con su gesto y su objeto', () => {
  const CHOCO = { bebida: 'chocolate', grano: 'suave', leche: 'sin', toque: 'nata' };
  it('el chocolate se remueve y se sirve del cazo; la nata se bate; todos distintos de los demás', () => {
    const choco = ETAPAS.flatMap((e) => gestosDe(e, CHOCO));
    expect(choco).toEqual(['molinillo', 'cazo', 'batir']);
    const cafe = ETAPAS.flatMap((e) => gestosDe(e, CAFE));
    const te = ETAPAS.flatMap((e) => gestosDe(e, TE));
    expect(choco.some((g) => cafe.includes(g) || te.includes(g))).toBe(false);
    expect(nombreEtapa('grano', CHOCO)).toBe('Cacao');
    expect(nombreEtapa('extraer', CHOCO)).toBe('Remover');
    expect(MANTENER_MS.cazo).toBeGreaterThan(0);
  });
  it('el molinillo pide tres vueltas amplias; cerca del centro no cuenta', () => {
    const g = crearGesto('molinillo', { centro: { x: 200, y: 300 } });
    expect(girar(g, 3, { r: 10 }).progreso).toBe(0);
    const g2 = crearGesto('molinillo', { centro: { x: 200, y: 300 } });
    expect(girar(g2, 2, { r: 60 }).hecho).toBe(false);
    const s = girar(g2, 1.1, { r: 60 });
    expect(s.hecho).toBe(true);
    expect(s.pose.espeso).toBe(1);
  });
  it('las varillas: cinco vueltas pequeñas, y la nata sale montada', () => {
    const g = crearGesto('batir', { centro: { x: 200, y: 300 } });
    const s = girar(g, 5.1, { r: 20 });
    expect(s.hecho).toBe(true);
    expect(s.pose.montada).toBe(1);
    expect(vistaTaza(CHOCO, { batir: s.pose }).nata).toBe(1);
  });
  it('el cazo se inclina a la izquierda y se mantiene; soltar no pierde lo servido', () => {
    const g = crearGesto('cazo');
    g.abajo(300, 300, 0);
    g.mover(200, 300, 10);
    g.paso(100);
    g.paso(200);
    const medio = g.arriba();
    expect(medio.progreso).toBeGreaterThan(0);
    expect(medio.pose.inclina).toBe(0);
    g.abajo(300, 300, 1000);
    g.mover(300 + 40, 300, 1010);
    expect(g.paso(1100).progreso).toBe(medio.progreso);
    expect(crearGesto('cazo').completar().pose.servido).toBe(1);
    const taza = vistaTaza(CHOCO, { molinillo: { espeso: 1 }, cazo: { servido: 1 } });
    expect(taza.lleno).toBeGreaterThan(0.8);
    expect(taza.crema).toBe(false);
  });
});

describe('bloque 4b: la vainilla y el café con hielo, con su gesto y su objeto', () => {
  const FRIO = { bebida: 'frio', grano: 'intenso', leche: 'entera', toque: 'vainilla' };
  it('el café con hielo se agita en la coctelera y su leche va fría; la vainilla se rasca; gestos nuevos y distintos', () => {
    const frio = ETAPAS.flatMap((e) => gestosDe(e, FRIO));
    expect(frio).toEqual(['manivela', 'apisonar', 'palanca', 'coctelera', 'verter', 'rascar']);
    expect(nombreEtapa('extraer', FRIO)).toBe('Agitar');
    expect(GESTOS.coctelera.pista).not.toBe(GESTOS.agitar.pista);
    expect(GESTOS.rascar.pista).not.toBe(GESTOS.apisonar.pista);
  });
  it('la coctelera pide diez vaivenes amplios; los de la canela no bastan', () => {
    expect(vaivenes(crearGesto('coctelera'), 'x', 10, 20).progreso).toBe(0);
    const s = vaivenes(crearGesto('coctelera'), 'x', 10, 60);
    expect(s.hecho).toBe(true);
    expect(s.pose.agitado).toBe(1);
    const taza = vistaTaza(FRIO, { palanca: { extraido: 1 }, coctelera: s.pose, verter: { vertido: 1, arte: 'corazon' } });
    expect(taza.hielo).toBe(1);
    expect(taza.arte).toBeNull();
    expect(taza.crema).toBe(false);
  });
  it('la vainilla: tres trazos de arriba abajo; uno largo sin subir cuenta solo una vez', () => {
    const largo = crearGesto('rascar');
    largo.abajo(200, 100);
    let s = largo.mover(200, 400);
    expect(s.pose.raspados).toBe(1);
    expect(s.hecho).toBe(false);
    const g = crearGesto('rascar');
    // Dos trazos en la misma pulsación (subiendo entre uno y otro) y el tercero en otra
    g.abajo(200, 100);
    g.mover(200, 170);
    g.mover(200, 120);
    s = g.mover(200, 190);
    expect(s.pose.raspados).toBe(2);
    g.arriba();
    g.abajo(200, 100);
    s = g.mover(200, 170);
    expect(s.hecho).toBe(true);
    expect(vistaTaza(FRIO, { rascar: s.pose }).vainilla).toBe(1);
  });
});

describe('bloque 6b: el tambor del tostador', () => {
  it('tirar del asa hacia ti abre la trampilla; mantenida, caen los granos; soltar la cierra sin perder lo caído', () => {
    const g = crearGesto('tambor');
    g.abajo(200, 300, 0);
    // A medias no cae nada
    g.mover(200, 330, 10);
    let s = g.paso(400);
    expect(s.progreso).toBe(0);
    expect(g.mover(200, 395, 410).eventos).toContain('abre');
    for (let t = 420; t <= 1200; t += 50) s = g.paso(t);
    expect(s.progreso).toBeGreaterThan(0.3);
    expect(s.hecho).toBe(false);
    const medio = s.progreso;
    s = g.arriba();
    expect(s.pose.abierta).toBe(0);
    expect(s.progreso).toBe(medio);
    // Otra vez abajo hasta el final: 1,6 s mantenida en total
    g.abajo(200, 300, 2000);
    g.mover(200, 395, 2010);
    for (let t = 2020; t <= 3200 && !s.hecho; t += 50) s = g.paso(t);
    expect(s.hecho).toBe(true);
    expect(s.pose.caido).toBe(1);
  });
  it('de una vez (movimiento reducido o teclado)', () => {
    const s = crearGesto('tambor').completar();
    expect(s).toMatchObject({ hecho: true, pose: { abierta: 0, caido: 1 } });
  });
});

// Bloque 6c (1.129): la sala de catas
describe('el chai (mortero) y el brûlée (soplete)', () => {
  const CHAI = { bebida: 'chai', grano: 'suave', leche: 'entera', toque: 'brulee' };
  it('el chai: las especias en el mortero y, después, como el té', () => {
    expect(gestosDe('grano', CHAI)).toEqual(['mortero']);
    expect(gestosDe('extraer', CHAI)).toEqual(['tetera', 'colador']);
    expect(gestosDe('toque', CHAI)).toEqual(['soplete']);
    expect([nombreEtapa('grano', CHAI), nombreEtapa('extraer', CHAI)]).toEqual(['Especias', 'Reposar']);
    for (const g of ['mortero', 'soplete']) expect(GESTOS[g]).toMatchObject({ orden: expect.any(String), ayuda: expect.any(String), atajo: expect.any(String) });
  });
  it('el mortero: cada toque es un golpe; al cuarto, hecho', () => {
    const g = crearGesto('mortero');
    for (let k = 1; k <= 3; k += 1) {
      const s = g.abajo(100, 100, k * 100);
      expect(s.eventos).toContain('machaca');
      expect(s.pose).toEqual({ maza: 1, golpes: k });
      expect(s.hecho).toBe(false);
      expect(g.arriba().pose.maza).toBe(0);
    }
    const s = g.abajo(100, 100, 500);
    expect(s).toMatchObject({ hecho: true, progreso: 1, pose: { golpes: 4 } });
    expect(s.eventos).toEqual(expect.arrayContaining(['machaca', 'hecho']));
  });
  it('el soplete: en zigzag sin soltar, se dora; soltando no se pierde nada', () => {
    const g = crearGesto('soplete');
    expect(g.abajo(200, 300, 0).pose.llama).toBe(true);
    let x = 200;
    for (let k = 1; k <= 3; k += 1) {
      x = k % 2 ? 240 : 200;
      g.mover(x, 300, k * 100);
    }
    const medio = g.arriba();
    expect(medio.pose.llama).toBe(false);
    expect(medio.progreso).toBeGreaterThan(0);
    expect(medio.hecho).toBe(false);
    // Moverse sin apretar no dora
    expect(g.mover(100, 300, 500).progreso).toBe(medio.progreso);
    g.abajo(200, 300, 600);
    let s;
    for (let k = 1; k <= 12 && !s?.hecho; k += 1) s = g.mover(k % 2 ? 240 : 200, 300, 600 + k * 100);
    expect(s).toMatchObject({ hecho: true, progreso: 1 });
    expect(s.pose.dorado).toBe(1);
  });
  it('de una vez, y la taza: especias, costra y dorado', () => {
    expect(crearGesto('mortero').completar().pose).toEqual({ maza: 0, golpes: 4 });
    expect(crearGesto('soplete').completar().pose).toEqual({ x: 0, dorado: 1, llama: false });
    expect(vistaTaza(CHAI, {})).toMatchObject({ chai: true, hojas: false, especias: 0, brulee: 0, dorado: 0 });
    const hechos = { mortero: { maza: 0, golpes: 4 }, tetera: { alzada: 0, lleno: 1 }, soplete: { x: 0, dorado: 1, llama: false } };
    expect(vistaTaza(CHAI, hechos)).toMatchObject({ hojas: true, especias: 1, brulee: 1, dorado: 1 });
    expect(vistaTaza(CHAI, hechos).lleno).toBeGreaterThan(0);
  });
});
