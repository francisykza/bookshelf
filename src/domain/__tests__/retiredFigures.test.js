// 1.58.1: las figuras SVG provisionales se retiran. Una cuenta antigua sigue cargando, conserva su inventario
// histórico y nunca ve, obtiene ni expone una figura retirada; sin premio posible la caja no se gasta.
import { describe, expect, it } from 'vitest';
import { EMPTY_FIGURES, RETIRED_FIGURES, boxHasPrize, openBoxAttempt, openMysteryBox, withoutRetired } from '../figures';
import { hydrate } from '../../state/useLibrary';
import { cornerSelection } from '../../features/social/connections';

const parts = (n) => Array.from({ length: n }, (_, i) => ({ name: `p${i}` }));
const CATALOG = [
  { id: 'dama_ceniza', rarity: 'legendary', parts: parts(5) },
  { id: 'jinete_dragones', rarity: 'legendary', parts: parts(5) },
  { id: 'guardian_clavos', rarity: 'epic', parts: parts(5) },
  { id: 'maestro_superviviente', rarity: 'legendary', parts: parts(5) },
];
const full = { parts: [0, 1, 2, 3, 4], display: 'box' };

const oldAccount = {
  ...EMPTY_FIGURES,
  owned: { dama_ceniza: { parts: [0], display: 'box' }, viajero_asteroide: { parts: [0, 1], display: 'box' }, hechicera_eea: { parts: [], display: 'unboxed' } },
  guardian: 'viajero_asteroide',
  path: 'hechicera_eea',
  placements: { viajero_asteroide: 'principito', dama_ceniza: 'mistborn' },
  shelf: [{ id: 'viajero_asteroide', display: 'box' }, { id: 'dama_ceniza', display: 'box' }, null, null],
  boxes: 2,
  unbox: { id: 'a1', reward: { type: 'figure', id: 'bardo_viento' }, at: '2026-10-01', seen: false },
  lastReward: { type: 'figure', id: 'bardo_viento' },
};

describe('figuras retiradas', () => {
  it('se quitan de las selecciones activas, pero el inventario histórico se conserva', () => {
    const fs = withoutRetired(oldAccount);
    expect(fs.owned).toEqual(oldAccount.owned);
    expect(fs.guardian).toBe(null);
    expect(fs.path).toBe(null);
    expect(fs.placements).toEqual({ dama_ceniza: 'mistborn' });
    expect(fs.shelf).toEqual([null, { id: 'dama_ceniza', display: 'box' }, null, null]);
    expect(fs.lastReward).toBe(null);
    expect(fs.unbox.seen).toBe(true);
    expect(fs.boxes).toBe(2);
  });

  it('una cuenta antigua guardada sigue cargando', () => {
    const state = hydrate({ version: 6, books: [], progress: { figures: oldAccount } });
    expect(state.progress.figures.guardian).toBe(null);
    expect(Object.keys(state.progress.figures.owned)).toContain('viajero_asteroide');
  });

  it('las cajas nunca sortean una figura retirada (aunque llegue en el catálogo)', () => {
    const withRetired = [...CATALOG, ...RETIRED_FIGURES.map((id) => ({ id, rarity: 'rare', parts: parts(5) }))];
    for (let i = 0; i < 200; i++) {
      const rnd = Array.from({ length: 8 }, () => Math.random());
      const { reward } = openMysteryBox({ ...EMPTY_FIGURES, boxes: 1, guardian: 'dama_ceniza', owned: { dama_ceniza: { parts: [] } }, pity: { relic: 0, figure: 9 } }, withRetired, rnd);
      expect(reward).toBeTruthy();
      expect(RETIRED_FIGURES).not.toContain(reward.id);
    }
  });

  it('el pity de figura sigue garantizando una épica/legendaria válida', () => {
    const { reward } = openMysteryBox({ ...EMPTY_FIGURES, boxes: 1, guardian: 'dama_ceniza', owned: { dama_ceniza: full }, pity: { relic: 0, figure: 9 } }, CATALOG, [0.99, 0.99, 0.99]);
    expect(reward.type).toBe('figure');
    expect(reward.pity).toBe(true);
    expect(CATALOG.map((f) => f.id)).toContain(reward.id);
  });

  it('sin premio posible la caja no se abre ni se gasta, y no hay premio indefinido', () => {
    const owned = Object.fromEntries(CATALOG.map((f) => [f.id, full]));
    const fs = { ...EMPTY_FIGURES, boxes: 3, guardian: null, owned };
    expect(boxHasPrize(fs, CATALOG)).toBe(false);
    expect(openMysteryBox(fs, CATALOG, [0.1])).toEqual({ fs, reward: null });
    expect(openBoxAttempt(fs, CATALOG, [0.1], 'x')).toBe(fs);
    // Con un Guardián válido el premio (un sello) vuelve a ser posible
    expect(boxHasPrize({ ...fs, guardian: 'dama_ceniza' }, CATALOG)).toBe(true);
    expect(boxHasPrize({ ...fs, guardian: 'viajero_asteroide' }, CATALOG)).toBe(false);
  });

  it('el rincón publicado no incluye figuras retiradas', () => {
    const sel = cornerSelection({ figures: ['viajero_asteroide', 'dama_ceniza'], owned: oldAccount.owned, guardian: 'viajero_asteroide' });
    expect(sel.figure_ids).toEqual(['dama_ceniza']);
    expect(sel.guardian_id).toBe(null);
  });
});
