// Entrega 2 · dominio (SPEC §25.3–25.6): catálogo de avatares coherente en las tres capas, copia pública sin
// datos privados, cuartos de estrella, alias y presentación de estadísticas.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AVATARS, avatarById, isAvatarId } from '../../../domain/avatars';
import { aliasError, draftDiffers, externalWorkRef, fromQuarters, publicCopy, statsView, toQuarters } from '../../reviews/opinion';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..');

describe('catálogo de avatares', () => {
  const json = JSON.parse(readFileSync(join(ROOT, 'public', 'avatars', 'catalog.json'), 'utf8'));
  const sql = readFileSync(join(ROOT, 'supabase', 'migrations', '20261025090000_entrega2_identidad_opiniones.sql'), 'utf8');

  it('seis avatares con id estable, label, image y alt; rutas públicas en /avatars/', () => {
    expect(json.avatars).toHaveLength(6);
    for (const a of json.avatars) {
      expect(a).toMatchObject({ id: expect.stringMatching(/^[a-z-]+$/), label: expect.any(String), alt: expect.any(String) });
      expect(a.image).toBe(`/avatars/${a.id}.webp`);
      expect(a.image.startsWith('/public')).toBe(false);
    }
  });

  it('los mismos ids en el catálogo público, en la app y en la restricción del servidor', () => {
    const ids = json.avatars.map((a) => a.id);
    expect(AVATARS.map((a) => a.id)).toEqual(ids);
    const check = /avatar_id\s+text check \(avatar_id in \(([^)]*)\)\)/.exec(sql)[1];
    expect(check.split(',').map((s) => s.trim().replace(/'/g, ''))).toEqual(ids);
    expect(isAvatarId('gato-lector')).toBe(true);
    expect(isAvatarId('data:image/png;base64,AAA')).toBe(false);
    expect(avatarById('https://ejemplo.com/foto.png')).toBeNull();
  });
});

describe('opinión pública', () => {
  it('3,75 se guarda como 15 cuartos y vuelve igual; sin puntuación es null, nunca 0', () => {
    expect(toQuarters(3.75)).toBe(15);
    expect(fromQuarters(15)).toBe(3.75);
    expect(toQuarters(null)).toBeNull();
    expect(toQuarters(0)).toBeNull();
    expect(fromQuarters(0)).toBeNull();
    expect(toQuarters(0.25)).toBe(1);
    expect(toQuarters(5)).toBe(20);
  });

  it('la copia pública solo lleva los campos autorizados (nada del diario)', () => {
    const copy = publicCopy({ rating: 4.5, body: 'Me encantó', spoilers: true, impressions: { pace: 4, emotion: 9, surprise: null } });
    expect(Object.keys(copy).sort()).toEqual(['body', 'emotion', 'has_spoilers', 'pace', 'rating_quarters', 'romance', 'surprise']);
    expect(copy).toMatchObject({ rating_quarters: 18, body: 'Me encantó', has_spoilers: true, pace: 4, emotion: null, surprise: null, romance: null });
    expect(publicCopy({ body: 'x'.repeat(6000) }).body).toHaveLength(5000);
  });

  it('editar la reseña privada no cambia lo publicado: se detecta para ofrecer «Actualizar publicación»', () => {
    const base = { rating: 4, review: 'Bonito', reviewSpoilers: false };
    const pub = { status: 'published', userId: 'u1', copy: publicCopy({ rating: 4, body: 'Bonito' }), impressions: {} };
    expect(draftDiffers({ ...base, publicReview: pub })).toBe(false);
    expect(draftDiffers({ ...base, review: 'Bonito y triste', publicReview: pub })).toBe(true);
    expect(draftDiffers({ ...base, publicReview: { ...pub, status: 'withdrawn' } })).toBe(false);
    // Una publicación hecha con otra cuenta no se trata como propia
    expect(draftDiffers({ ...base, review: 'Otro texto', publicReview: pub }, 'u2')).toBe(false);
  });

  it('alias de 2 a 40 caracteres, sin espacios sobrantes', () => {
    expect(aliasError('A')).toMatch(/Al menos/);
    expect(aliasError('Ana')).toBe('');
    expect(aliasError(' Ana')).toMatch(/espacios/);
    expect(aliasError('x'.repeat(41))).toMatch(/Como mucho/);
  });

  it('identidad de obra: solo obras verificadas de Open Library; si no, obra local', () => {
    expect(externalWorkRef({ workRef: { source: 'openlibrary', id: '/works/OL17301948W' } })).toBe('/works/OL17301948W');
    expect(externalWorkRef({ workRef: { source: 'google', id: 'abc' } })).toBeNull();
    expect(externalWorkRef({ title: 'Circe', isbn: '9780316556347' })).toBeNull();
  });
});

describe('estadísticas', () => {
  it('sin opiniones, primeras valoraciones (< 5) y media con un decimal', () => {
    expect(statsView(null).headline).toBe('Esta historia todavía espera su primera opinión');
    expect(statsView({ reviews: 3, ratings: 3, average: '3.833333' }).headline).toBe('Primeras valoraciones: 3 lectores');
    expect(statsView({ reviews: 2, ratings: 0, average: null }).headline).toBe('Todavía nadie la ha puntuado');
    expect(statsView({ reviews: 1, ratings: 1, average: '4' }).headline).toBe('Una primera voz para esta historia');
    const v = statsView({ reviews: 7, ratings: 7, average: '3.6785714', band_4: 5, band_3: 2, pace_n: 2, pace_avg: '3.5' });
    expect(v.averageText).toBe('3,7');
    expect(v.average).toBeCloseTo(3.6785714);
    expect(v.bands.map((b) => [b.label, b.count])).toEqual([
      ['(0, 1]', 0],
      ['(1, 2]', 0],
      ['(2, 3]', 2],
      ['(3, 4]', 5],
      ['(4, 5]', 0],
    ]);
    // Cada impresión con su propio número de respuestas
    expect(v.impressions.find((d) => d.id === 'pace')).toMatchObject({ n: 2, average: 3.5 });
    expect(v.impressions.find((d) => d.id === 'romance')).toMatchObject({ n: 0, average: null });
  });
});
