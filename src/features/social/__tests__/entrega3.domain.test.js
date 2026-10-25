// Entrega 3 · dominio (SPEC §25.8–25.12): tropos con denominador, reparto en sillones sin inventar a nadie,
// tiempo de sesión, selección del rincón y enlaces de invitación.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TROPES, cornerSelection, inviteLink, inviteTokenFromHash, seatParticipants, sessionMinutes, tropeAnswer, tropeView } from '../connections';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..');

describe('tropos', () => {
  it('el catálogo coincide con la restricción del servidor', () => {
    const sql = readFileSync(join(ROOT, 'supabase', 'migrations', '20261025120000_entrega3_conexiones_clubes.sql'), 'utf8');
    const ids = /tropes <@ array\[([^\]]*)\]/.exec(sql)[1].split(',').map((s) => s.trim().replace(/'/g, ''));
    expect(TROPES.map((t) => t.id)).toEqual(ids);
  });

  it('distingue no responder, «ninguna encaja» y una selección', () => {
    expect(tropeAnswer({ answered: false })).toEqual({ tropes: null, tropes_none: false });
    expect(tropeAnswer({ answered: true, none: true })).toEqual({ tropes: [], tropes_none: true });
    expect(tropeAnswer({ answered: true, selected: ['academia', 'inventado'] })).toEqual({ tropes: ['academia'], tropes_none: false });
  });

  it('siempre con denominador y porcentaje solo desde 5 respuestas', () => {
    const few = tropeView([
      { trope: 'academia', votes: 3, respondents: 4 },
      { trope: null, votes: 0, respondents: 4 },
    ]);
    expect(few).toMatchObject({ respondents: 4, consensus: false });
    expect(few.items).toEqual([expect.objectContaining({ id: 'academia', text: '3 de 4 lectores', percent: null })]);
    const many = tropeView([{ trope: 'academia', votes: 3, respondents: 8 }]);
    expect(many.items[0]).toMatchObject({ text: '3 de 8 lectores', percent: 38 });
  });
});

describe('sillones', () => {
  const now = Date.parse('2026-10-25T10:00:00Z');
  const row = (id, minsAgo, seenAgo = 0) => ({ user_id: id, started_at: new Date(now - minsAgo * 60000).toISOString(), last_seen: new Date(now - seenAgo * 60000).toISOString() });

  it('sin nadie, los sillones quedan vacíos', () => {
    expect(seatParticipants([], 'yo', 2, now)).toEqual({ seated: [], extra: 0, all: [] });
  });

  it('yo primero, luego por llegada; los que no caben en «+N»; las presencias caducadas no cuentan', () => {
    const r = seatParticipants([row('a', 30), row('b', 20), row('yo', 5), row('c', 10), row('viejo', 60, 4)], 'yo', 2, now);
    expect(r.seated.map((x) => x.user_id)).toEqual(['yo', 'a']);
    expect(r.extra).toBe(2);
  });

  it('el tiempo se calcula desde la marca de inicio', () => {
    expect(sessionMinutes(new Date(now - 7 * 60000).toISOString(), now)).toBe('7 min');
    expect(sessionMinutes(new Date(now - 75 * 60000).toISOString(), now)).toBe('1 h 15 min');
  });
});

describe('rincón y club', () => {
  it('como mucho 3 libros con campos públicos y solo figuras desbloqueadas', () => {
    const sel = cornerSelection({
      books: [1, 2, 3, 4].map((i) => ({ id: `b${i}`, title: `T${i}`, author: 'A', quotes: ['privada'], review: 'privada' })),
      figures: ['dama_ceniza', 'no_tengo'],
      owned: { dama_ceniza: {} },
      guardian: 'no_tengo',
      showCurrent: false,
      currentTitle: 'Circe',
    });
    expect(sel.featured_books).toHaveLength(3);
    expect(Object.keys(sel.featured_books[0])).toEqual(['id', 'title', 'author', 'cover']);
    expect(sel.figure_ids).toEqual(['dama_ceniza']);
    expect(sel.guardian_id).toBeNull();
    expect(sel.current_title).toBeNull();
  });

  it('el token de invitación va en el fragmento y solo se acepta con su forma exacta', () => {
    const token = 'a'.repeat(64);
    expect(inviteLink('https://bookshelf.test', token)).toBe(`https://bookshelf.test/#club=${token}`);
    expect(inviteTokenFromHash(`#club=${token}`)).toBe(token);
    expect(inviteTokenFromHash('#club=123')).toBeNull();
  });
});
