// 1.62 (SPEC §62.3): solo se ofrecen sintonías con pistas reproducibles y documentadas (nada de categorías vacías).
import { describe, expect, it } from 'vitest';
import { STATIONS, playableStations } from '../catalog';

const track = (extra = {}) => ({ id: 't', title: 'Pista', artist: 'Autoría', credits: 'Condiciones', src: '/media/social-radio/pista.mp3', ...extra });

describe('catálogo de la radio', () => {
  it('el catálogo piloto trae una sintonía con su pista de demostración', () => {
    expect(STATIONS.map((s) => s.id)).toEqual(['piloto']);
    expect(STATIONS[0].tracks).toHaveLength(1);
    expect(STATIONS[0].tracks[0]).toMatchObject({ demo: true, src: '/media/social-radio/brisa-de-papel-demo.mp3' });
  });

  it('descarta sintonías sin pistas y pistas sin fuente local, autoría o créditos', () => {
    const raw = {
      stations: [
        { id: 'vacia', title: 'Café tranquilo', tracks: [] },
        { id: 'fuera', title: 'Externa', tracks: [track({ src: 'https://example.com/a.mp3' })] },
        { id: 'sin-creditos', title: 'Sin créditos', tracks: [track({ credits: '' })] },
        { id: 'buena', title: 'Buena', tracks: [track(), track({ id: 'x', artist: '' })] },
      ],
    };
    expect(playableStations(raw).map((s) => [s.id, s.tracks.length])).toEqual([['buena', 1]]);
    expect(playableStations(null)).toEqual([]);
  });
});
