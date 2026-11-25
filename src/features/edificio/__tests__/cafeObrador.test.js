// 1.143 · El obrador del café: las reglas (cafeObrador.js) y los gestos (cafeObradorGestos.js). Cada gesto se acaba haciéndolo
// como dice su ayuda y queda «bien»; hecho a pasaditas o pasándose, queda «se podía mejorar»; nunca falla; con movimiento
// reducido, de una vez y bien.
import { describe, expect, it } from 'vitest';
import { GESTO_OBRADOR, HORNABLES, OBRADOR_NIVEL, PIDE_COMIDA_CADA, RECETAS_OBRADOR, bandejaLibre, comandaComida, estrellasBebida, estrellasHornada, fraseComida, fraseHorno, huecoVitrina, laPieza, paraAcompanar, pedidoComida, piezasDe, recetaAbierta, sinPieza } from '../cafe/cafeObrador';
import { GESTOS_RECETA, MEDIDAS_OBRADOR as M, crearGestoObrador } from '../cafe/cafeObradorGestos';

/** Arrastra por una lista de puntos; devuelve el último estado con todos los eventos del trazo. */
function trazo(g, puntos) {
  let s = g.abajo(...puntos[0]);
  const eventos = [...s.eventos];
  for (const p of puntos.slice(1)) {
    s = g.mover(...p);
    eventos.push(...s.eventos);
  }
  return { ...s, eventos };
}
const linea = (a, b, n = 20) => Array.from({ length: n + 1 }, (_, k) => [a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);

describe('las reglas del obrador', () => {
  it('seis recetas, cada una desde su nivel (1.145: todas se hornean); cada una con sus dos gestos', () => {
    expect(RECETAS_OBRADOR.map((r) => r.id)).toEqual(['magdalenas', 'empanada', 'galletas', 'pan', 'bizcocho', 'tortilla']);
    expect(HORNABLES).toEqual(RECETAS_OBRADOR.map((r) => r.id));
    expect(OBRADOR_NIVEL).toBe(4);
    expect(recetaAbierta('magdalenas', 3)).toBe(false);
    expect(recetaAbierta('magdalenas', 4)).toBe(true);
    expect(RECETAS_OBRADOR.map((r) => r.nivel)).toEqual([4, 4, 5, 6, 7, 8]);
    for (const r of RECETAS_OBRADOR) {
      expect(recetaAbierta(r.id, r.nivel - 1), r.id).toBe(false);
      expect(recetaAbierta(r.id, r.nivel), r.id).toBe(true);
    }
    for (const id of HORNABLES) {
      expect(GESTOS_RECETA[id]).toEqual(RECETAS_OBRADOR.find((r) => r.id === id).gestos);
      for (const g of GESTOS_RECETA[id]) expect(GESTO_OBRADOR[g]).toMatchObject({ orden: expect.any(String), ayuda: expect.any(String), bien: expect.any(String), mejor: expect.any(String) });
    }
  });

  it('las estrellas dan las piezas; la vitrina y el horno cuentan lo que hay', () => {
    expect([1, 2, 3].map((e) => piezasDe('magdalenas', e))).toEqual([4, 5, 6]);
    expect([estrellasHornada([2, 2]), estrellasHornada([1, 2]), estrellasHornada([1, 1])]).toEqual([3, 2, 1]);
    const o = { bandejas: 1, cabe: 12, horneando: [], piezas: { magdalenas: 7, empanada: 2 } };
    expect(huecoVitrina(o)).toBe(3);
    expect(bandejaLibre(o)).toBe(1);
    expect(bandejaLibre({ ...o, horneando: [{ bandeja: 1 }] })).toBeNull();
    expect(paraAcompanar(o, 'dulce')).toEqual([{ receta: 'magdalenas', piezas: 7 }]);
    expect(paraAcompanar({ ...o, piezas: { magdalenas: 3 } }, 'salado')).toEqual([]);
    expect(fraseHorno(0)).toMatch(/huele/i);
    expect(fraseHorno(1)).toMatch(/campanilla/i);
  });
  it('máximo dos: uno de cada tres pide comida, sin libro; sus estrellas, solo de la bebida', () => {
    expect(PIDE_COMIDA_CADA).toBe(3);
    // 4 aciertos de la bebida, 3★; 2 o 3, 2★; si no, 1★ (nunca cero)
    expect([0, 1, 2, 3, 4].map((a) => estrellasBebida(a))).toEqual([1, 1, 2, 2, 3]);
    expect(estrellasBebida()).toBe(1);
    // El pedido, como el de un libro pero sin libro: solo lo que le apetece
    expect(pedidoComida('salado')).toEqual({ id: 'comida', tipo: 'salado', quiere: null, excentrico: false, genero: null, extension: null, forma: null });
    expect(pedidoComida('otra cosa').tipo).toBe('dulce');
    expect(Object.isFrozen(pedidoComida('dulce'))).toBe(true);
    // Lo que dice, sin comillas (va detrás de la bebida) y siempre la misma para el mismo cliente
    for (const tipo of ['dulce', 'salado']) {
      for (let n = 0; n < 6; n++) {
        const f = fraseComida(tipo, n);
        expect(f).toMatch(new RegExp(tipo));
        expect(f).not.toMatch(/[«»]/);
        expect(fraseComida(tipo, n)).toBe(f);
      }
    }
    expect(fraseComida('dulce', -4)).toBe(fraseComida('dulce', 4));
    expect(comandaComida('salado')).toBe('Algo salado para acompañar');
    expect(sinPieza('dulce')).toMatch(/nada dulce/);
    expect(laPieza('magdalenas')).toBe('la magdalena');
    expect(laPieza('empanada')).toBe('la empanada');
    expect(laPieza('nada')).toBe('la pieza');
  });
});

describe('los gestos del obrador', () => {
  const c = { x: 195, y: 400 };

  it('rallar: pasadas largas hacia abajo, bien; a rasguños, se podía mejorar', () => {
    let g = crearGestoObrador('rallar', { centro: c });
    let s;
    for (let k = 0; k < 6 && !s?.hecho; k += 1) {
      s = trazo(g, linea([195, 300], [195, 300 + M.rallar + 10]));
      g.arriba();
    }
    expect(s.hecho).toBe(true);
    expect(s.mimo).toBe(2);
    expect(s.eventos).toContain('hecho');
    g = crearGestoObrador('rallar', { centro: c });
    for (let k = 0; k < 40; k += 1) {
      s = trazo(g, linea([195, 300], [195, 330], 6));
      g.arriba();
      if (s.hecho) break;
    }
    expect(s.hecho).toBe(true);
    expect(s.mimo).toBe(1);
  });

  it('colmar: una pasada de ida y otra de vuelta, bien; pasándose, rebosa', () => {
    const ancho = M.filaMoldes;
    let g = crearGestoObrador('colmar', { centro: c });
    let s = trazo(g, [...linea([c.x - ancho / 2, 400], [c.x + ancho / 2 - 1, 400], 60), ...linea([c.x + ancho / 2 - 1, 400], [c.x - ancho / 2, 400], 60)]);
    expect(s.hecho).toBe(true);
    expect(s.mimo).toBe(2);
    g = crearGestoObrador('colmar', { centro: c });
    // Cuatro veces sobre el primero antes de pasar a los demás
    s = trazo(g, [...linea([c.x - ancho / 2, 400], [c.x - ancho / 2 + 49, 400], 10), ...linea([c.x - ancho / 2 + 49, 400], [c.x - ancho / 2, 400], 10), ...linea([c.x - ancho / 2, 400], [c.x - ancho / 2 + 49, 400], 10), ...linea([c.x - ancho / 2 + 49, 400], [c.x - ancho / 2, 400], 10)]);
    s = trazo(g, [...linea([c.x - ancho / 2, 400], [c.x + ancho / 2 - 1, 400], 60), ...linea([c.x + ancho / 2 - 1, 400], [c.x - ancho / 2, 400], 60)]);
    expect(s.hecho).toBe(true);
    expect(s.mimo).toBe(1);
  });

  it('el rodillo: pasadas largas, bien; a pasaditas, se podía mejorar', () => {
    let g = crearGestoObrador('rodillo', { centro: c });
    const largo = M.rodillo + 20;
    let s = trazo(g, [...linea([195, 300], [195, 300 + largo]), ...linea([195, 300 + largo], [195, 300]), ...linea([195, 300], [195, 300 + largo])]);
    expect(s.hecho).toBe(true);
    expect(s.mimo).toBe(2);
    g = crearGestoObrador('rodillo', { centro: c });
    const vaiven = [];
    for (let k = 0; k < 20; k += 1) vaiven.push(...linea([195, 300 + (k % 2) * 30], [195, 300 + ((k + 1) % 2) * 30], 4));
    s = trazo(g, vaiven);
    expect(s.hecho).toBe(true);
    expect(s.mimo).toBe(1);
  });

  it('el repulgo: una vuelta pegada al borde, bien; por dentro, se podía mejorar', () => {
    const R = M.radioRepulgo;
    const vuelta = (r) => Array.from({ length: 73 }, (_, k) => [c.x + Math.cos((k / 72) * 2 * Math.PI) * r, c.y + Math.sin((k / 72) * 2 * Math.PI) * r]);
    let s = trazo(crearGestoObrador('repulgo', { centro: c }), vuelta(R));
    expect(s.hecho).toBe(true);
    expect(s.mimo).toBe(2);
    expect(s.eventos).toContain('hecho');
    s = trazo(crearGestoObrador('repulgo', { centro: c }), vuelta(R * 0.55));
    expect(s.hecho).toBe(true);
    expect(s.mimo).toBe(1);
    // En el centro no cuenta
    s = trazo(crearGestoObrador('repulgo', { centro: c }), vuelta(R * 0.2));
    expect(s.hecho).toBe(false);
  });

  it('la pala y las pinzas: hasta el final del recorrido; no cuentan para el mimo', () => {
    let s = trazo(crearGestoObrador('meter'), linea([195, 500], [195, 500 - M.pala - 5]));
    expect([s.hecho, s.mimo]).toEqual([true, null]);
    s = trazo(crearGestoObrador('sacar'), linea([195, 300], [195, 300 + M.pala + 5]));
    expect(s.hecho).toBe(true);
    s = trazo(crearGestoObrador('pinzas'), linea([195, 300], [195, 300 + M.pinzas + 5]));
    expect(s.hecho).toBe(true);
    expect(s.eventos).toContain('plato');
  });

  it('soltar no pierde nada y, de una vez, queda bien', () => {
    const g = crearGestoObrador('meter');
    trazo(g, linea([195, 500], [195, 460]));
    g.arriba();
    const s = trazo(g, linea([195, 500], [195, 440]));
    expect(s.progreso).toBeGreaterThan(0.45);
    for (const t of ['rallar', 'colmar', 'rodillo', 'repulgo']) expect(crearGestoObrador(t).completar()).toMatchObject({ hecho: true, mimo: 2, progreso: 1 });
  });
});

// 1.144 · Bloque 2: las mejoras, la maestría, la especialidad, el mostrador y las manos de Pilar
import { CUPO_MOSTRADOR, MEJORAS_OBRADOR, PREMIO_MAESTRIA, TARTAS, faltanMaestria, fraseMostrador, maestriaDe, piezasEnLetra, precioMesa, siguienteMejora, tartasEn } from '../cafe/cafeObrador';
import { trazoPilar } from '../cafe/cafeObradorGestos';

describe('1.144 · las mejoras del obrador', () => {
  it('el horno y la vitrina suben de grado en grado, con su precio y su nivel, y se acaban', () => {
    expect(siguienteMejora('horno', 1)).toMatchObject({ grado: 2, precio: 250, nivel: 4 });
    expect(siguienteMejora('horno', 2)).toMatchObject({ grado: 3, precio: 600, nivel: 6 });
    expect(siguienteMejora('horno', 3)).toBeNull();
    expect(siguienteMejora('vitrina', 1)).toMatchObject({ grado: 2, precio: 150 });
    expect(siguienteMejora('vitrina', 3)).toMatchObject({ grado: 4, precio: 700, nivel: 7 });
    expect(siguienteMejora('vitrina', 4)).toBeNull();
    expect(siguienteMejora('otra', 1)).toBeNull();
    // Cada grado dice cuánto cabe y cuánto vende Pilar: lo mismo que las cifras
    for (const m of MEJORAS_OBRADOR.vitrina) expect(m.se).toContain(`Pilar vende ${CUPO_MOSTRADOR[m.grado]} al día`);
  });
  it('las vitrinas de tartas cuentan hasta dos', () => {
    expect(tartasEn(null)).toBe(0);
    expect(tartasEn({ items: [{ id: TARTAS.mueble }, { id: 'otra' }] })).toBe(1);
    expect(tartasEn({ items: [{ id: TARTAS.mueble }, { id: TARTAS.mueble }, { id: TARTAS.mueble }] })).toBe(2);
  });
});

describe('1.144 · la maestría y la especialidad', () => {
  it('★ con 3 hornadas buenas, ★★ con 10 y ★★★ con 25; lo que falta para la siguiente', () => {
    expect([0, 2, 3, 9, 10, 24, 25, 99].map(maestriaDe)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
    expect(faltanMaestria(0)).toBe(3);
    expect(faltanMaestria(4)).toBe(6);
    expect(faltanMaestria(25)).toBeNull();
    expect(PREMIO_MAESTRIA).toHaveLength(3);
  });
  it('★ da una pieza más por bandeja; ★★ y la especialidad, un grano más cada una en la mesa', () => {
    expect(piezasDe('magdalenas', 3, 2)).toBe(6);
    expect(piezasDe('magdalenas', 3, 3)).toBe(7);
    expect(precioMesa('magdalenas')).toBe(2);
    expect(precioMesa('magdalenas', { especialidad: 'magdalenas' })).toBe(3);
    expect(precioMesa('magdalenas', { especialidad: 'empanada', buenas: 10 })).toBe(3);
    expect(precioMesa('empanada', { especialidad: 'empanada', buenas: 25 })).toBe(5);
  });
});

describe('1.144 · el mostrador', () => {
  it('Pilar dice lo que se llevaron, en letra y con su «y»', () => {
    expect(fraseMostrador({ magdalenas: 4 })).toBe('«Mientras no estabas se llevaron cuatro magdalenas.»');
    expect(fraseMostrador({ empanada: 1, magdalenas: 2 })).toBe('«Mientras no estabas se llevaron dos magdalenas y una ración de empanada.»');
    expect(fraseMostrador({})).toMatch(/vacía/);
    expect(piezasEnLetra('tortilla', 1)).toBe('un pincho de tortilla');
    expect(piezasEnLetra('magdalenas', 20)).toBe('20 magdalenas');
  });
});

describe('1.144 · «Que lo hornee Pilar»: sus manos hacen cada gesto bien hecho', () => {
  for (const escala of [360 / 390, 1, 430 / 390]) {
    it(`a ${Math.round(escala * 390)} px, con el reconocedor de siempre`, () => {
      let semilla = 7;
      const azar = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647);
      const centro = { x: 195 * escala, y: 380 };
      for (const tipo of ['rallar', 'colmar', 'rodillo', 'repulgo', 'meter']) {
        const g = crearGestoObrador(tipo, { escala, centro });
        const { puntos, ms } = trazoPilar(tipo, { escala, centro, azar });
        expect(ms).toBeGreaterThan(300);
        expect(ms).toBeLessThan(1300);
        let s = g.abajo(puntos[0].x, puntos[0].y);
        for (const p of puntos.slice(1)) if (!s.hecho) s = g.mover(p.x, p.y);
        expect(s.hecho, tipo).toBe(true);
        if (tipo !== 'meter') expect(s.mimo, tipo).toBe(2);
      }
    });
  }
  it('con la fila de moldes y el borde de la fuente medidos en la escena', () => {
    const centro = { x: 200, y: 400 };
    for (const [tipo, med] of [
      ['colmar', { ancho: 240 }],
      ['repulgo', { radio: 70 }],
    ]) {
      const g = crearGestoObrador(tipo, { centro, ...med });
      const { puntos } = trazoPilar(tipo, { centro, ...med });
      let s = g.abajo(puntos[0].x, puntos[0].y);
      for (const p of puntos.slice(1)) if (!s.hecho) s = g.mover(p.x, p.y);
      expect(s).toMatchObject({ hecho: true, mimo: 2 });
    }
  });
});

// 1.145 · Bloque 3: el recetario crece (galletas, pan, bizcocho y tortilla), los hitos, el excéntrico y el favorito
import { ACERTIJOS, FAVORITOS, FOGON, HITOS_OBRADOR, PALA, PISTA_ACERTIJO, faltanHito, hitosDe, palaDe, paraElPedido } from '../cafe/cafeObrador';
import { HABITUALES } from '../cafe/cafeClientes';

describe('1.145 · el recetario crece', () => {
  it('las cifras de las cuatro nuevas: 6, 7 u 8 piezas; el pan, de un día para otro; la tortilla, al fogón', () => {
    expect(['galletas', 'pan', 'bizcocho', 'tortilla'].map((id) => [1, 2, 3].map((e) => piezasDe(id, e)))).toEqual([
      [6, 7, 8],
      [6, 7, 8],
      [6, 7, 8],
      [6, 7, 8],
    ]);
    expect(RECETAS_OBRADOR.map((r) => r.precio)).toEqual([2, 3, 2, 4, 4, 5]);
    expect(RECETAS_OBRADOR.filter((r) => r.noche).map((r) => r.id)).toEqual(['pan']);
    expect(RECETAS_OBRADOR.filter((r) => r.fogon).map((r) => r.id)).toEqual(['tortilla']);
    expect(palaDe('tortilla')).toBe(FOGON);
    expect(palaDe('pan')).toBe(PALA);
    for (const r of RECETAS_OBRADOR) {
      expect(GESTOS_RECETA[r.id]).toEqual(r.gestos);
      for (const g of r.gestos) expect(GESTO_OBRADOR[g], g).toMatchObject({ orden: expect.any(String), ayuda: expect.any(String), bien: expect.any(String), mejor: expect.any(String) });
      expect(laPieza(r.id)).not.toBe('la pieza');
    }
    // Ocho gestos nuevos, todos distintos de los de la primera tanda
    expect(new Set(RECETAS_OBRADOR.flatMap((r) => r.gestos)).size).toBe(12);
  });

  it('los hitos: 25, 100, 250, 500 y 1.000 piezas; un adorno y 20 granos cada uno', () => {
    expect(HITOS_OBRADOR.cifras).toEqual([25, 100, 250, 500, 1000]);
    expect(HITOS_OBRADOR.granos).toBe(20);
    expect(HITOS_OBRADOR.adornos).toHaveLength(5);
    expect(HITOS_OBRADOR.frases).toHaveLength(5);
    expect([0, 24, 25, 99, 100, 999, 1000, 5000].map(hitosDe)).toEqual([0, 0, 1, 1, 2, 4, 5, 5]);
    expect([0, 24, 25, 600].map(faltanHito)).toEqual([25, 1, 75, 400]);
    expect(faltanHito(1000)).toBeNull();
  });

  it('el favorito de cada habitual, uno por cada uno de los doce; pagan +2, solo por su favorito', () => {
    expect(FAVORITOS).toHaveLength(HABITUALES.length);
    expect(HABITUALES).toHaveLength(12);
    // Cada receta es el favorito de dos
    for (const r of RECETAS_OBRADOR) expect(FAVORITOS.filter((f) => f === r.id), r.id).toHaveLength(2);
    expect(precioMesa('galletas', { favorito: 'galletas' })).toBe(4);
    expect(precioMesa('magdalenas', { favorito: 'galletas' })).toBe(2);
    const p = pedidoComida('salado', 'pan');
    expect(p).toMatchObject({ tipo: 'salado', quiere: 'pan', excentrico: false });
    expect(fraseComida('salado', 0, p)).toMatch(/pan de la bodega/);
    expect(comandaComida('salado', p)).toBe('Pan de la bodega (su favorito)');
    // Su favorito, el primero de lo que le vale
    const o = { piezas: { empanada: 3, pan: 2, magdalenas: 4 } };
    expect(paraElPedido(o, p).map((x) => x.receta)).toEqual(['pan', 'empanada']);
  });

  it('el excéntrico: un acertijo por receta, sin nombrarla; paga el doble; mira toda la vitrina', () => {
    for (const r of RECETAS_OBRADOR) {
      expect(ACERTIJOS[r.id]).toBeTruthy();
      expect(ACERTIJOS[r.id].toLowerCase()).not.toContain(r.nombre.toLowerCase());
      expect(PISTA_ACERTIJO[r.id]).toBeTruthy();
    }
    expect(precioMesa('tortilla', { excentrico: true })).toBe(10);
    // El doble y la especialidad; nunca el +2 del favorito
    expect(precioMesa('empanada', { excentrico: true, especialidad: 'empanada', favorito: 'empanada' })).toBe(7);
    const p = pedidoComida('dulce', 'bizcocho', true);
    expect(p).toMatchObject({ quiere: 'bizcocho', excentrico: true });
    expect(fraseComida('dulce', 0, p)).toContain(ACERTIJOS.bizcocho);
    expect(comandaComida('dulce', p)).toBe(`«${ACERTIJOS.bizcocho}»`);
    expect(sinPieza('dulce', p)).toMatch(/Otro día/);
    // Mira toda la vitrina, dulce o salado
    expect(paraElPedido({ piezas: { empanada: 1, galletas: 2, pan: 0 } }, p).map((x) => x.receta)).toEqual(['empanada', 'galletas']);
    // Sin receta que exista, no es un excéntrico con acertijo
    expect(pedidoComida('dulce', 'paella', true)).toMatchObject({ quiere: null, excentrico: false });
  });
});

describe('1.145 · los ocho gestos nuevos', () => {
  const c = { x: 195, y: 400 };
  const tocar = (g, x, y) => {
    const s = g.abajo(x, y);
    g.arriba();
    return s;
  };

  it('los cortapastas: cuatro formas separadas, bien; pisándose, se podía mejorar', () => {
    let g = crearGestoObrador('cortapastas', { centro: c });
    let s;
    for (const [x, y] of [
      [-100, -50],
      [100, -50],
      [-100, 50],
      [100, 50],
    ])
      s = tocar(g, c.x + x, c.y + y);
    expect(s).toMatchObject({ hecho: true, mimo: 2 });
    expect(s.pose.cortes.map((k) => k.forma)).toEqual(['ancla', 'barco', 'estrella', 'faro']);
    g = crearGestoObrador('cortapastas', { centro: c });
    for (const [x, y] of [
      [-100, -50],
      [-95, -45],
      [-100, 50],
      [100, 50],
    ])
      s = tocar(g, c.x + x, c.y + y);
    expect(s).toMatchObject({ hecho: true, mimo: 1 });
    // Fuera de la masa no corta
    g = crearGestoObrador('cortapastas', { centro: c });
    expect(tocar(g, c.x + 400, c.y).pose.cortes).toHaveLength(0);
  });

  it('la glasa: por la raya de puntos, bien; lejos de ella, se podía mejorar', () => {
    const W = M.glasa;
    const ola = (k, n) => [c.x - W / 2 + (W * k) / n, c.y + Math.sin((k / n) * Math.PI * 3) * M.olaGlasa];
    let s = trazo(crearGestoObrador('glasa', { centro: c }), Array.from({ length: 121 }, (_, k) => ola(k, 120)));
    expect(s).toMatchObject({ hecho: true, mimo: 2 });
    s = trazo(crearGestoObrador('glasa', { centro: c }), linea([c.x - W / 2, c.y + 50], [c.x + W / 2, c.y + 50], 120));
    expect(s).toMatchObject({ hecho: true, mimo: 1 });
  });

  it('amasar: cuatro empujones parejos, bien; uno corto y otro larguísimo, se podía mejorar', () => {
    let g = crearGestoObrador('amasar', { centro: c });
    let s;
    for (let k = 0; k < 4; k += 1) {
      s = trazo(g, linea([195, 420], [195, 420 - M.amasar - 10], 10));
      g.arriba();
    }
    expect(s).toMatchObject({ hecho: true, mimo: 2 });
    g = crearGestoObrador('amasar', { centro: c });
    for (const largo of [M.amasar + 2, M.amasar * 3, M.amasar + 2, M.amasar + 2]) {
      s = trazo(g, linea([195, 500], [195, 500 - largo], 16));
      g.arriba();
    }
    expect(s).toMatchObject({ hecho: true, mimo: 1 });
  });

  it('greñar: un tajo sin dudar, bien; volviendo atrás, se podía mejorar', () => {
    let s = trazo(crearGestoObrador('grenar', { centro: c }), linea([100, 400], [100 + M.grenar + 10, 360], 30));
    expect(s).toMatchObject({ hecho: true, mimo: 2 });
    s = trazo(crearGestoObrador('grenar', { centro: c }), [...linea([100, 400], [180, 390], 10), ...linea([180, 390], [160, 392], 4), ...linea([160, 392], [100 + M.grenar + 40, 360], 30)]);
    expect(s).toMatchObject({ hecho: true, mimo: 1 });
  });

  it('envolver: tres jotas enteras, bien; una a medias, se podía mejorar', () => {
    const jota = (x) => [...linea([x, 340], [x, 340 + M.bajaJota + 8], 10), ...linea([x, 340 + M.bajaJota + 8], [x + 30, 340 + M.bajaJota + 8 - M.subeJota - 6], 8)];
    let g = crearGestoObrador('envolver', { centro: c });
    let s;
    for (let k = 0; k < 3; k += 1) {
      s = trazo(g, jota(160 + k * 10));
      g.arriba();
    }
    expect(s).toMatchObject({ hecho: true, mimo: 2 });
    g = crearGestoObrador('envolver', { centro: c });
    trazo(g, linea([160, 340], [160, 340 + M.bajaJota * 0.7], 8));
    g.arriba();
    for (let k = 0; k < 3; k += 1) {
      s = trazo(g, jota(160 + k * 10));
      g.arriba();
    }
    expect(s).toMatchObject({ hecho: true, mimo: 1 });
  });

  it('el tamiz: cubrir la plantilla, bien; espolvoreando por toda la mesa, se podía mejorar', () => {
    const W = M.plantilla;
    const H = W * 0.6;
    const filas = (ancho) => [-H / 3, 0, H / 3].flatMap((dy, k) => linea([c.x + (k % 2 ? 1 : -1) * ancho, c.y + dy], [c.x + (k % 2 ? -1 : 1) * ancho, c.y + dy], 40));
    let s = trazo(crearGestoObrador('tamiz', { centro: c }), filas(W / 2 - 4));
    expect(s).toMatchObject({ hecho: true, mimo: 2 });
    expect(s.pose.levantada).toBe(true);
    s = trazo(crearGestoObrador('tamiz', { centro: c }), filas(W * 2));
    expect(s).toMatchObject({ hecho: true, mimo: 1 });
  });

  it('cascar: tres huevos abiertos de lado, bien; abriéndolos hacia abajo caen cáscaras', () => {
    let g = crearGestoObrador('cascar', { centro: c });
    let s;
    for (let k = 0; k < 3; k += 1) {
      s = trazo(g, linea([195, 400], [195 + M.abrirHuevo + 6, 402], 8));
      g.arriba();
    }
    expect(s).toMatchObject({ hecho: true, mimo: 2 });
    expect(s.eventos).toContain('abre');
    g = crearGestoObrador('cascar', { centro: c });
    s = trazo(g, linea([195, 400], [195 + M.abrirHuevo + 6, 400 + M.abrirHuevo + 6], 8));
    expect(s.eventos).toContain('cascara');
    g.arriba();
    for (let k = 0; k < 2; k += 1) {
      s = trazo(g, linea([195, 400], [195 + M.abrirHuevo + 6, 402], 8));
      g.arriba();
    }
    expect(s).toMatchObject({ hecho: true, mimo: 1 });
  });

  it('la vuelta con el plato: media vuelta sin parar, bien; soltando a medias, se podía mejorar', () => {
    const r = M.radioSarten * 0.8;
    const arco = (a0, a1, n = 30) => Array.from({ length: n + 1 }, (_, k) => [c.x + Math.cos(a0 + ((a1 - a0) * k) / n) * r, c.y + Math.sin(a0 + ((a1 - a0) * k) / n) * r]);
    let s = trazo(crearGestoObrador('vuelta', { centro: c }), arco(0, Math.PI + 0.1));
    expect(s).toMatchObject({ hecho: true, mimo: 2 });
    expect(s.eventos).toContain('plof');
    const g = crearGestoObrador('vuelta', { centro: c });
    trazo(g, arco(0, 1));
    g.arriba();
    s = trazo(g, arco(1, Math.PI + 0.2));
    expect(s).toMatchObject({ hecho: true, mimo: 1 });
  });

  it('de una vez (movimiento reducido o teclado), cada uno queda hecho y bien', () => {
    for (const t of ['cortapastas', 'glasa', 'amasar', 'grenar', 'envolver', 'tamiz', 'cascar', 'vuelta']) expect(crearGestoObrador(t).completar(), t).toMatchObject({ hecho: true, mimo: 2, progreso: 1 });
  });

  for (const escala of [360 / 390, 1, 430 / 390, 600 / 390]) {
    it(`las manos de Pilar los hacen bien a ${Math.round(escala * 390)} px`, () => {
      let semilla = 11;
      const azar = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647);
      const centro = { x: 195 * escala, y: 380 };
      for (const tipo of ['cortapastas', 'glasa', 'amasar', 'grenar', 'envolver', 'tamiz', 'cascar', 'vuelta']) {
        for (let vez = 0; vez < 5; vez += 1) {
          const g = crearGestoObrador(tipo, { escala, centro });
          const { puntos, ms } = trazoPilar(tipo, { escala, centro, azar });
          expect(ms, tipo).toBeGreaterThan(300);
          expect(ms, tipo).toBeLessThan(2500);
          // Con `alza`, la mano se levanta antes de ese punto (un toque o un empujón nuevo)
          let s = g.abajo(puntos[0].x, puntos[0].y);
          for (const p of puntos.slice(1)) {
            if (s.hecho) break;
            if (p.alza) {
              g.arriba();
              s = g.abajo(p.x, p.y);
            } else s = g.mover(p.x, p.y);
          }
          expect(s.hecho, `${tipo} (${vez})`).toBe(true);
          expect(s.mimo, `${tipo} (${vez})`).toBe(2);
        }
      }
    });
  }
});

// 1.145.1: la nota de la campanilla y el horno del HUD
import { enElHornoTexto, yaEsta } from '../cafe/cafeObrador';
describe('1.145.1 · lo que dice el horno al terminar', () => {
  it('una receta, con su artículo y su verbo', () => {
    expect(yaEsta(['magdalenas'])).toBe('Ya están las magdalenas.');
    expect(yaEsta(['empanada'])).toBe('Ya está la empanada.');
    expect(yaEsta(['pan'])).toBe('Ya está el pan.');
    expect(yaEsta(['tortilla'])).toBe('Ya ha cuajado la tortilla.');
  });
  it('cada receta del recetario tiene su frase', () => {
    for (const r of RECETAS_OBRADOR) expect(yaEsta([r.id])).toMatch(/^Ya .+\.$/);
  });
  it('varias a la vez, en una frase y sin repetir', () => {
    expect(yaEsta(['galletas', 'pan'])).toBe('Ya están las galletas y el pan.');
    expect(yaEsta(['magdalenas', 'magdalenas', 'empanada', 'bizcocho'])).toBe('Ya están las magdalenas, la empanada y el bizcocho.');
    expect(yaEsta([])).toBe('');
    expect(yaEsta(['otra'])).toBe('');
  });
  it('lo que hay dentro, para el horno del HUD', () => {
    expect(enElHornoTexto(['empanada'])).toBe('la empanada');
    expect(enElHornoTexto(['magdalenas', 'galletas'])).toBe('las magdalenas y las galletas');
  });
});
