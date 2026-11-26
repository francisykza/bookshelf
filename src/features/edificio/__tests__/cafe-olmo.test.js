// 1.150 · Olmo, el búho librero: el personaje de suscriptor que sustituye a Pilar en el café (decisión de Francisco del
// 26-11-2026). Quién atiende según la suscripción y la vista previa, su voz, su retrato sacado del modelo 3D y su pose.
import { afterEach, describe, expect, it } from 'vitest';
import { conOlmo, esSuscriptor, fijarSuscripcion, fijarVistaPrevia } from '../../../domain/suscripcion';
import { precioDe } from '../economy';
import { FRASES_OLMO, anfitrion, conQuien } from '../cafe/cafePersonaje';
import { OLMO, poseOlmo, retratoOlmo } from '../cafe/olmo3d';

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

  it('el retrato sale del modelo: cuadrícula cuadrada, paleta completa y distinto en cada pose', () => {
    const vistos = new Set();
    for (const pose of ['normal', 'contento', 'apunta', 'lee']) {
      const r = retratoOlmo(pose);
      expect(r.filas).toHaveLength(24);
      for (const f of r.filas) {
        expect(f).toHaveLength(24);
        for (const ch of f) if (ch !== '.') expect(r.paleta[ch]).toMatch(/^#[0-9a-f]{6}$/);
      }
      vistos.add(r.filas.join('\n'));
    }
    expect(vistos.size).toBe(4);
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
