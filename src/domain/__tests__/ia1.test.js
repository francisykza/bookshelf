// Fase IA-1 (SPEC §18): motor físico y ambiental, color de portada y bibliotecario local. Todo puro o con
// cargadores falsos: ninguna prueba toca la red.
import { describe, expect, it, vi } from 'vitest';
import { SPINE_PALETTE, VIBE_PRESETS, calculateBookPhysics, getDeterministicVibe, normalizeTag } from '../../utils/vibeEngine';
import { createCoverColorService, dominantColor } from '../../utils/coverColor';
import { LIMITS, parseMood, recommendLocally, sanitizeCatalog, toCatalog } from '../../utils/localLibrarian';

const finite = (p) => [p.thickness, p.height].every(Number.isFinite);

describe('física del libro', () => {
  it('grosor por páginas con límites 0,5–1,8', () => {
    expect(calculateBookPhysics({ pageCount: 80 }).thickness).toBeCloseTo(0.5, 10);
    expect(calculateBookPhysics({ pageCount: 1000 }).thickness).toBeCloseTo(1.8, 10);
    expect(calculateBookPhysics({ pageCount: 540 }).thickness).toBeCloseTo(0.5 + 0.5 * 1.3, 10);
    expect(calculateBookPhysics({ pageCount: 5 }).thickness).toBe(0.5);
    expect(calculateBookPhysics({ pageCount: 99999 }).thickness).toBe(1.8);
  });

  it('páginas ausentes, negativas o NaN → 0,9 y valores finitos', () => {
    for (const pageCount of [undefined, null, -10, 0, Number.NaN, 'muchas', Infinity]) {
      const p = calculateBookPhysics({ pageCount });
      expect(p.thickness).toBe(0.9);
      expect(finite(p)).toBe(true);
    }
    expect(finite(calculateBookPhysics(null))).toBe(true);
    expect(finite(calculateBookPhysics(undefined))).toBe(true);
  });

  it('audiolibros: minutos o horas convertidas, nunca mezcladas', () => {
    expect(calculateBookPhysics({ editionType: 'audiobook', durationMinutes: 120 }).thickness).toBeCloseTo(0.5, 10);
    expect(calculateBookPhysics({ editionType: 'audiobook', durationMinutes: 2400 }).thickness).toBeCloseTo(1.8, 10);
    // 20 h = 1200 min
    expect(calculateBookPhysics({ editionType: 'audiobook', audioHours: 20 }).thickness).toBeCloseTo(0.5 + ((1200 - 120) / 2280) * 1.3, 10);
    expect(calculateBookPhysics({ editionType: 'audiobook', durationMinutes: 0 }).thickness).toBe(0.9);
    expect(calculateBookPhysics({ editionType: 'audiobook', duration: 500 }).thickness).toBe(0.9);
  });

  it('altura 0,95–1,08 y color estables por id o título', () => {
    const a = calculateBookPhysics({ id: 'circe', title: 'Circe' });
    const b = calculateBookPhysics({ id: 'circe', title: 'Otro' });
    expect(a.height).toBe(b.height);
    expect(a.spineColor).toBe(b.spineColor);
    expect(calculateBookPhysics({ title: '  CIRCE ' }).height).toBe(calculateBookPhysics({ title: 'circe' }).height);
    for (let i = 0; i < 200; i += 1) {
      const p = calculateBookPhysics({ id: `x${i}` });
      expect(p.height).toBeGreaterThanOrEqual(0.95);
      expect(p.height).toBeLessThanOrEqual(1.08);
      expect(SPINE_PALETTE).toContain(p.spineColor);
    }
    expect(SPINE_PALETTE).toContain(calculateBookPhysics({}).spineColor);
  });

  it('personalización > edición > géneros > papel', () => {
    expect(calculateBookPhysics({ appearance: { material: 'metallic' }, editionType: 'leatherbound' }).material).toBe('metallic');
    expect(calculateBookPhysics({ editionType: 'paperback', categories: ['Clásico'] }).material).toBe('paper');
    expect(calculateBookPhysics({ editionType: 'leatherbound' }).material).toBe('leather');
    expect(calculateBookPhysics({ editionType: 'hardcover' }).material).toBe('cloth');
    expect(calculateBookPhysics({ categories: ['Clásicos'] }).material).toBe('leather');
    expect(calculateBookPhysics({ categories: ['Poesía'] }).material).toBe('cloth');
    expect(calculateBookPhysics({ categories: ['Ciencia ficción'] }).material).toBe('metallic');
    expect(calculateBookPhysics({ categories: ['Ensayo'] }).material).toBe('paper');
  });

  it('pan de oro: personalización, edición y luego inferencia', () => {
    expect(calculateBookPhysics({ appearance: { goldFoil: false }, categories: ['Fantasía'] }).goldFoil).toBe(false);
    expect(calculateBookPhysics({ editionType: 'paperback', categories: ['Fantasía'] }).goldFoil).toBe(false);
    expect(calculateBookPhysics({ categories: ['Fantasía'] }).goldFoil).toBe(true);
  });

  it('no modifica el libro recibido', () => {
    const book = Object.freeze({ id: 'f', pageCount: 300, categories: Object.freeze(['Fantasía']) });
    expect(() => calculateBookPhysics(book)).not.toThrow();
    expect(() => getDeterministicVibe(book)).not.toThrow();
  });
});

describe('preajustes ambientales', () => {
  it('alias en español e inglés, con acentos y mayúsculas', () => {
    expect(getDeterministicVibe({ categories: ['FANTASÍA'] }).presetId).toBe('fantasy');
    expect(getDeterministicVibe({ tags: ['Sci-Fi'] }).presetId).toBe('science_fiction');
    expect(getDeterministicVibe({ categories: ['Novela negra'] }).presetId).toBe('mystery');
    expect(getDeterministicVibe({ categories: ['Romántica'] }).presetId).toBe('romance');
    expect(getDeterministicVibe({ categories: ['Navidad'] }).presetId).toBe('winter');
    expect(normalizeTag('  Ciencia   Ficción ')).toBe('ciencia ficcion');
  });

  it('varios géneros: prioridad estable e independiente del orden', () => {
    const a = getDeterministicVibe({ categories: ['Fantasía', 'Romántica', 'Misterio'] });
    const b = getDeterministicVibe({ categories: ['Misterio', 'Romántica', 'Fantasía'] });
    expect(a).toEqual(b);
    expect(a.presetId).toBe('mystery');
  });

  it('sin coincidencias parciales dentro de palabras y con datos incompletos', () => {
    expect(getDeterministicVibe({ categories: ['Neorromanticismo'] }).presetId).toBe('default');
    expect(getDeterministicVibe({}).presetId).toBe('default');
    expect(getDeterministicVibe(null)).toEqual({ presetId: 'default', ...VIBE_PRESETS.default });
    expect(getDeterministicVibe({ categories: [42, null, ''] }).presetId).toBe('default');
  });
});

describe('color de portada', () => {
  const px = (rgba, n) => new Uint8ClampedArray(Array.from({ length: n }, () => rgba).flat());

  it('portada con color: el grupo representativo, sin que el margen blanco domine', () => {
    const data = new Uint8ClampedArray([...px([255, 255, 255, 255], 600), ...px([30, 80, 160, 255], 300), ...px([0, 0, 0, 0], 100)]);
    expect(dominantColor(data)).toBe('#1E50A0');
  });

  it('monocromática o transparente → sin color (se queda el inicial)', () => {
    expect(dominantColor(px([250, 250, 250, 255], 500))).toBeNull();
    expect(dominantColor(px([10, 10, 10, 255], 500))).toBeNull();
    expect(dominantColor(px([120, 120, 120, 255], 500))).toBeNull();
    expect(dominantColor(px([200, 30, 30, 0], 500))).toBeNull();
  });

  it('CORS, error y tiempo agotado conservan el color inicial', async () => {
    const cors = createCoverColorService({ load: () => Promise.reject(new DOMException('tainted', 'SecurityError')) });
    expect(await cors.get('https://x/a.jpg', { fallbackColor: '#536753' })).toEqual({ color: '#536753', source: 'fallback' });
    vi.useFakeTimers();
    const slow = createCoverColorService({ load: () => new Promise(() => {}) });
    const p = slow.get('https://x/b.jpg', { fallbackColor: '#405B70', timeoutMs: 3000 });
    await vi.advanceTimersByTimeAsync(3001);
    expect(await p).toEqual({ color: '#405B70', source: 'fallback' });
    vi.useRealTimers();
  });

  it('caché, deduplicación y como mucho dos análisis a la vez', async () => {
    let active = 0;
    let peak = 0;
    const calls = [];
    const load = (url) => {
      calls.push(url);
      active += 1;
      peak = Math.max(peak, active);
      return new Promise((resolve) =>
        setTimeout(() => {
          active -= 1;
          resolve(px([30, 80, 160, 255], 50));
        }, 5),
      );
    };
    const svc = createCoverColorService({ load, cacheSize: 3 });
    const urls = ['https://c/1', 'https://c/1', 'https://c/2', 'https://c/3', 'https://c/4'];
    const results = await Promise.all(urls.map((u) => svc.get(u, { fallbackColor: '#000000' })));
    expect(results.every((r) => r.source === 'cover')).toBe(true);
    expect(calls.filter((u) => u === 'https://c/1')).toHaveLength(1);
    expect(peak).toBeLessThanOrEqual(2);
    expect(svc.stats().cached).toBeLessThanOrEqual(3);
    await svc.get('https://c/4');
    expect(calls.filter((u) => u === 'https://c/4')).toHaveLength(1);
  });

  it('cancelar un consumidor no rompe la tarea compartida', async () => {
    const svc = createCoverColorService({ load: () => new Promise((r) => setTimeout(() => r(px([200, 60, 40, 255], 50)), 10)) });
    const ctrl = new AbortController();
    const a = svc.get('https://c/x', { fallbackColor: '#111111', signal: ctrl.signal });
    const b = svc.get('https://c/x', { fallbackColor: '#222222' });
    ctrl.abort();
    expect(await a).toEqual({ color: '#111111', source: 'fallback' });
    expect((await b).source).toBe('cover');
  });

  it('URLs inválidas no se analizan', async () => {
    const load = vi.fn();
    const svc = createCoverColorService({ load });
    expect((await svc.get('', { fallbackColor: '#77644F' })).source).toBe('fallback');
    expect((await svc.get('javascript:alert(1)', { fallbackColor: '#77644F' })).source).toBe('fallback');
    expect(load).not.toHaveBeenCalled();
  });
});

describe('bibliotecario local', () => {
  const catalog = [
    { id: 'b', title: 'La casa del lago', tags: ['Misterio', 'Thriller'], pageCount: 220, status: 'want' },
    { id: 'a', title: 'Noches de niebla', tags: ['Misterio', 'Terror'], pageCount: 180, status: 'want' },
    { id: 'c', title: 'Amor en Lisboa', tags: ['Romántica'], pageCount: 320, status: 'reading' },
    { id: 'd', title: 'La gran saga', tags: ['Fantasía épica', 'Aventura'], pageCount: 900, status: 'want' },
    { id: 'e', title: 'Sin páginas', tags: ['Misterio'], status: 'read' },
  ];

  it('catálogo vacío: sin recomendaciones y mensaje útil', () => {
    const r = recommendLocally({ userMood: 'misterio', catalog: [] });
    expect(r.recommendedIds).toEqual([]);
    expect(r.librarianWhisper).toMatch(/vacía/);
  });

  it('máximo dos IDs, todos del catálogo, con desempate estable por ID', () => {
    const r = recommendLocally({ userMood: 'algo de misterio', catalog });
    expect(r.recommendedIds.length).toBeLessThanOrEqual(2);
    expect(r.recommendedIds.every((id) => catalog.some((b) => b.id === id))).toBe(true);
    const shuffled = recommendLocally({ userMood: 'algo de misterio', catalog: [...catalog].reverse() });
    expect(shuffled.recommendedIds).toEqual(r.recommendedIds);
    expect(r.suggestedWeather).toBe('fog');
  });

  it('negaciones simples: «sin terror», «no quiero romance»', () => {
    const r = recommendLocally({ userMood: 'misterio corto sin terror', catalog });
    expect(r.recommendedIds).not.toContain('a');
    expect(r.recommendedIds[0]).toBe('b');
    expect(parseMood('no quiero romance').rejectedTags).toContain('romance');
    expect(recommendLocally({ userMood: 'no quiero romance, algo largo', catalog }).recommendedIds).toEqual(['d']);
    // «sin terror y corto»: la negación no alcanza a «corto»
    expect(parseMood('sin terror y corto').short).toBe(true);
  });

  it('largo y corto solo con páginas conocidas', () => {
    expect(recommendLocally({ userMood: 'algo largo', catalog }).recommendedIds).toEqual(['d']);
    const short = recommendLocally({ userMood: 'algo breve', catalog });
    expect(short.recommendedIds).not.toContain('e');
  });

  it('IDs repetidos y entradas inválidas no bloquean', () => {
    const r = recommendLocally({ userMood: 'romántico', catalog: [null, 5, { title: 'sin id' }, { id: 'c', tags: ['Romántica'] }, { id: 'c', tags: ['Terror'] }] });
    expect(r.recommendedIds).toEqual(['c']);
    expect(sanitizeCatalog([{ id: 'x', tags: Array.from({ length: 50 }, (_, i) => `t${i}`) }])[0].tags).toHaveLength(LIMITS.tags);
  });

  it('sin coincidencias: sugerencia neutra identificada como tal', () => {
    const r = recommendLocally({ userMood: 'poesía', catalog });
    expect(r.librarianWhisper).toMatch(/sugerencia neutra/);
    expect(r.recommendedIds.length).toBeLessThanOrEqual(1);
  });

  it('petición no reconocida: invita a probar algo sencillo, sin inventar', () => {
    const r = recommendLocally({ userMood: 'xyzzy', catalog });
    expect(r.recommendedIds).toEqual([]);
    expect(r.librarianWhisper).toMatch(/Prueba/);
  });

  it('la frase tiene como mucho 20 palabras', () => {
    for (const mood of ['misterio', 'algo largo y épico', 'romántico', 'xyzzy', 'poesía', 'tranquilo']) {
      const w = recommendLocally({ userMood: mood, catalog }).librarianWhisper.split(/\s+/).filter(Boolean);
      expect(w.length).toBeLessThanOrEqual(20);
    }
  });

  it('acota la petición a 500 caracteres y el catálogo a 5000 libros', () => {
    expect(() => recommendLocally({ userMood: 'misterio '.repeat(500), catalog })).not.toThrow();
    const huge = Array.from({ length: 6000 }, (_, i) => ({ id: `n${i}`, tags: ['Misterio'] }));
    expect(sanitizeCatalog(huge)).toHaveLength(LIMITS.catalog);
  });

  it('el catálogo de la app solo lleva metadatos existentes', () => {
    const cat = toCatalog([{ id: 'z', title: 'Z', author: 'A', editionType: 'audiobook', categories: ['Misterio'], pageCount: 300, status: 'want', review: 'privado' }]);
    expect(cat).toEqual([{ id: 'z', title: 'Z', mediaType: 'audiobook', tags: ['Misterio'], pageCount: 300, status: 'want' }]);
  });
});
