// 1.150 · Olmo, el búho librero: el personaje de suscriptor que sustituye a Pilar en el café (decisión de Francisco del
// 26-11-2026). Quién atiende según la suscripción y la vista previa, su voz, su retrato sacado del modelo 3D y su pose.
import { afterEach, describe, expect, it } from 'vitest';
import { conOlmo, esSuscriptor, fijarSuscripcion, fijarVistaPrevia } from '../../../domain/suscripcion';
import { precioDe } from '../economy';
import { FRASES_OLMO, anfitrion, conQuien } from '../cafe/cafePersonaje';
import { OLMO, poseOlmo } from '../cafe/olmo3d';
import { LIENZO_OLMO, MOMENTO_OLMO, POSES_OLMO, REPOSO_OLMO, poseDeOlmo, poseOlmoAlHablar, poseOlmoDelPaso, poseOlmoEnReposo, poseOlmoUrl } from '../cafe/olmoPoses';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

afterEach(() => {
  fijarSuscripcion(false);
  fijarVistaPrevia(false);
});

describe('quién atiende el café', () => {
  it('sin suscripción ni vista previa, Pilar', () => {
    expect(conOlmo()).toBe(false);
    expect(anfitrion().id).toBe('pilar');
    expect(anfitrion().nombre).toBe('Pilar');
    expect(conQuien('Pilar coloca las cajas ella sola')).toBe('Pilar coloca las cajas ella sola');
  });

  it('con la suscripción, Olmo', () => {
    fijarSuscripcion(true);
    expect(anfitrion().id).toBe('olmo');
  });

  it('la vista previa de las cuentas de pruebas enseña a Olmo, pero no da precios de suscriptor', () => {
    const antes = precioDe('chester-terciopelo');
    fijarVistaPrevia(true);
    expect(anfitrion().nombre).toBe('Olmo');
    expect(esSuscriptor()).toBe(false);
    expect(precioDe('chester-terciopelo')).toBe(antes);
    expect(antes).toBe(600);
  });

  it('los textos de los datos que nombran a Pilar pasan a Olmo, en masculino', () => {
    fijarVistaPrevia(true);
    expect(conQuien('Pilar coloca las cajas ella sola')).toBe('Olmo coloca las cajas él solo');
    expect(conQuien('12 piezas · Pilar vende 4 al día')).toBe('12 piezas · Olmo vende 4 al día');
  });
});

describe('la voz de Olmo', () => {
  it('tiene lo mismo que decir que Pilar, con sus palabras', () => {
    fijarVistaPrevia(true);
    const olmo = anfitrion();
    fijarVistaPrevia(false);
    const pilar = anfitrion();
    expect(Object.keys(olmo.dice).sort()).toEqual(Object.keys(pilar.dice).sort());
    for (const k of Object.keys(olmo.dice)) {
      const a = typeof olmo.dice[k] === 'function' ? olmo.dice[k]('El Faro') : olmo.dice[k];
      const b = typeof pilar.dice[k] === 'function' ? pilar.dice[k]('El Faro') : pilar.dice[k];
      if (k !== 'esperando') expect(a).not.toBe(b);
    }
    expect(olmo.dice.huele('El Faro')).toContain('«El Faro»');
  });

  it('sus frases sueltas, sin repetirse y con la de Francisco', () => {
    expect(new Set(FRASES_OLMO).size).toBe(FRASES_OLMO.length);
    expect(FRASES_OLMO).toContain('Este libro huele a lluvia… te va a gustar.');
  });
});

describe('el modelo 3D y su retrato', () => {
  const todas = [...OLMO.cuerpo, ...OLMO.cabeza, ...OLMO.alas.flat(), ...OLMO.alaArriba, ...OLMO.libro, ...OLMO.parpados.flat()];

  it('todas las cajas tienen volumen y colores válidos', () => {
    for (const { b, c } of todas) {
      expect(b[0]).toBeLessThan(b[3]);
      expect(b[1]).toBeLessThan(b[4]);
      expect(b[2]).toBeLessThan(b[5]);
      expect(c).toHaveLength(3);
      for (const v of c) expect(v >= 0 && v <= 255).toBe(true);
    }
  });

  it('de pie sobre el suelo, centrado y de la altura de Pilar; asoma por encima de la barra (1,05)', () => {
    const z0 = Math.min(...todas.map(({ b }) => b[2]));
    const z1 = Math.max(...[...OLMO.cuerpo, ...OLMO.cabeza].map(({ b }) => b[5]));
    expect(z0).toBe(0);
    expect(z1).toBeGreaterThan(1.8);
    expect(z1).toBeLessThan(2);
    expect(OLMO.taburete).toBeGreaterThan(0);
    const xs = OLMO.cuerpo.flatMap(({ b }) => [b[0], b[3]]);
    expect(Math.abs(Math.min(...xs) + Math.max(...xs))).toBeLessThan(0.05);
    expect(Math.min(...OLMO.cabeza.map(({ b }) => b[2]))).toBeGreaterThan(1.05);
  });

  it('es el Olmo de la hoja de Francisco (1.156): sin chaleco mostaza, con la bufanda roja y verde y las gafas naranjas', () => {
    const todas = [...OLMO.cuerpo, ...OLMO.cabeza];
    const hay = (rgb) => todas.some(({ c }) => c.join() === rgb.join());
    expect(hay([206, 158, 50])).toBe(false);
    expect(hay([156, 36, 36])).toBe(true);
    expect(hay([48, 70, 40])).toBe(true);
    expect(hay([228, 144, 48])).toBe(true);
    expect(OLMO.colores.chaleco).toBeUndefined();
  });

  it('se mueve: parpadea, gira la cabeza, se ahueca; con movimiento reducido, quieto', () => {
    const muestras = Array.from({ length: 300 }, (_, i) => poseOlmo(i * 0.05));
    expect(muestras.some((p) => p.parpados[0])).toBe(true);
    expect(Math.max(...muestras.map((p) => Math.abs(p.giro)))).toBeGreaterThan(0.5);
    expect(Math.max(...muestras.map((p) => p.ladeo))).toBeGreaterThan(0.15);
    expect(Math.max(...muestras.map((p) => p.esponja))).toBeGreaterThan(0.5);
    expect(poseOlmo(7, { quieto: true })).toEqual({ giro: 0, ladeo: 0, parpados: [false, false], alas: [0, 0], esponja: 0, respira: 0 });
    // Preparando un café, las alas trabajan
    expect(poseOlmo(1, { prepara: true }).alas[0]).toBeGreaterThan(0.05);
  });
});

describe('las poses de Olmo (1.156)', () => {
  it('las 22 de su hoja, recortadas en lienzos iguales', () => {
    expect(POSES_OLMO).toHaveLength(22);
    expect(new Set(POSES_OLMO).size).toBe(22);
    for (const p of POSES_OLMO) {
      const archivo = join('public', poseOlmoUrl(p));
      expect(existsSync(archivo)).toBe(true);
      // Cabecera de WebP (VP8X: el ancho y el alto, menos uno, en 24 bits)
      const b = readFileSync(archivo);
      expect(b.toString('ascii', 0, 4)).toBe('RIFF');
      expect(b.toString('ascii', 12, 16)).toBe('VP8X');
      expect(b.readUIntLE(24, 3) + 1).toBe(LIENZO_OLMO.w);
      expect(b.readUIntLE(27, 3) + 1).toBe(LIENZO_OLMO.h);
    }
  });

  it('cada momento tiene una pose de verdad, y lo que no existe es la de siempre', () => {
    for (const p of Object.values(MOMENTO_OLMO)) expect(POSES_OLMO).toContain(p);
    expect(poseDeOlmo('no-existe')).toBe('libro');
    expect(poseDeOlmo('normal')).toBe('libro');
    expect(poseDeOlmo('contento')).toBe('cafe');
    expect(poseDeOlmo('duerme')).toBe('duerme');
    expect(anfitrion).toBeTypeOf('function');
  });

  it('la guía: saluda al empezar, acompaña y celebra al final', () => {
    expect(poseOlmoDelPaso(0, 5)).toBe('saluda');
    expect(poseOlmoDelPaso(4, 5)).toBe('celebra');
    expect(['camina', 'libro']).toContain(poseOlmoDelPaso(2, 5));
    expect(poseOlmoDelPaso(2, 5, 'contento')).toBe('carino');
  });

  it('en la franja: lee y se duerme sin tocar nada; con cada frase, su gesto', () => {
    expect(poseOlmoEnReposo(0)).toBe('libro');
    expect(poseOlmoEnReposo(REPOSO_OLMO.lee)).toBe('lee');
    expect(poseOlmoEnReposo(REPOSO_OLMO.duerme)).toBe('duerme');
    for (let k = 0; k < FRASES_OLMO.length; k += 1) expect(POSES_OLMO).toContain(poseOlmoAlHablar(k));
  });
});
