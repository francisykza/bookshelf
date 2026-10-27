// Figuras de Coleccionista (SPEC §7, 1.14.0): reglas puras de la colección, el Guardián de Lectura y sus 5
// sellos, las Cajas Sorpresa con pity garantizado, el rango por piezas del blíster y la sinergia de saga.

export const SEALS_PER_BOX = 5;
/** Cajas seguidas sin pieza hasta que una reliquia queda garantizada. */
export const RELIC_PITY = 3;
/** Cajas seguidas sin figura épica/legendaria hasta que una queda garantizada. */
export const FIGURE_PITY = 10;

export const RARITY = {
  legendary: { label: 'Legendaria', weight: 1, color: '#e8c46a' },
  epic: { label: 'Épica', weight: 2, color: '#c08ae8' },
  rare: { label: 'Rara', weight: 4, color: '#7ab8e8' },
};

/** Figuras con las que empiezas y las palabras para colocarlas junto a su libro. */
export const STARTERS = [
  { id: 'dama_ceniza', keywords: ['mistborn', 'bruma', 'imperio final'] },
  { id: 'jinete_dragones', keywords: ['fourth wing', 'alas de sangre'] },
];

/** Sin acentos ni mayúsculas, para comparar títulos. */
export function fold(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** Primer libro de la estantería que coincide con las palabras clave de una figura. */
export function matchBook(keywords, books) {
  const keys = (keywords ?? []).map(fold).filter(Boolean);
  return books.find((b) => keys.some((k) => fold(b.title).includes(k))) ?? null;
}

export const EMPTY_FIGURES = {
  owned: {},
  guardian: null,
  seals: 0,
  lastSealDay: null,
  boxes: 0,
  pity: { relic: 0, figure: 0 },
  path: null,
  placements: {},
  synergy: 0,
  synergyDay: null,
  lastReward: null,
  sealBox: false,
  // Último intento de apertura confirmado (SPEC §13.6): { id, reward, at, seen }
  unbox: null,
  // 1.45.0 (SPEC §37): lo expuesto en las baldas de la habitación, cuatro posiciones { id, display } o null.
  // Sin elegir nada todavía (null), se expone lo de siempre de forma automática.
  shelf: null,
};

/** Las cuatro posiciones: dos por balda (superior y central), de izquierda a derecha. */
export const SHELF_SLOTS = 4;
export const SLOT_NAMES = ['Balda superior, izquierda', 'Balda superior, derecha', 'Balda central, izquierda', 'Balda central, derecha'];

/**
 * Presentaciones que admite la habitación: solo con recursos de verdad (caja recortada con transparencia y figura
 * suelta en imagen con transparencia). Las cajas fotografiadas antiguas y los personajes planos (SVG) no se exponen.
 */
export function roomPresentations(fig) {
  return {
    box: Boolean(fig?.boxAlpha && fig.boxImage),
    unboxed: Boolean(fig?.unboxedAvailable && fig.unboxedImage && !/\.svg(\?|$)/i.test(fig.unboxedImage)),
  };
}

/** Presentación válida para la habitación: la pedida si existe; si no, la otra; null si no hay ninguna. */
export function roomDisplay(fig, wanted) {
  const p = roomPresentations(fig);
  if (wanted === 'unboxed' && p.unboxed) return 'unboxed';
  if (wanted === 'box' && p.box) return 'box';
  return p.unboxed ? 'unboxed' : p.box ? 'box' : null;
}

/**
 * Las cuatro posiciones tal y como se ven: lo elegido (solo figuras que tienes y con recurso para la habitación)
 * o, sin elección, las que tienes con recurso, el Guardián primero y luego por orden de llegada.
 */
export function shelfSlots(fs, catalog) {
  const byId = new Map(catalog.map((f) => [f.id, f]));
  const valid = (slot) => {
    const fig = slot && byId.get(slot.id);
    if (!fig || !fs.owned?.[slot.id]) return null;
    const display = roomDisplay(fig, slot.display);
    return display ? { id: slot.id, display } : null;
  };
  if (Array.isArray(fs.shelf)) {
    const seen = new Set();
    return Array.from({ length: SHELF_SLOTS }, (_, i) => {
      const slot = valid(fs.shelf[i]);
      if (!slot || seen.has(slot.id)) return null;
      seen.add(slot.id);
      return slot;
    });
  }
  const owned = catalog.filter((f) => fs.owned?.[f.id] && roomDisplay(f, 'box'));
  owned.sort((a, b) => (a.id === fs.guardian ? -1 : b.id === fs.guardian ? 1 : (fs.owned[a.id].obtainedAt || '').localeCompare(fs.owned[b.id].obtainedAt || '')));
  const list = owned.slice(0, SHELF_SLOTS).map((f) => ({ id: f.id, display: roomDisplay(f, 'box') }));
  return Array.from({ length: SHELF_SLOTS }, (_, i) => list[i] ?? null);
}

/** Dónde está expuesta una figura (índice de posición) o -1. */
export const slotOf = (slots, id) => slots.findIndex((s) => s?.id === id);

/**
 * Coloca una figura en una posición. Si estaba en otra, se mueve; si la de destino está ocupada, `mode` decide:
 * «swap» intercambia las dos y «replace» devuelve la otra al Ático (sigue siendo tuya). Devuelve las posiciones.
 */
export function placeOnShelf(slots, id, display, target, mode = 'swap') {
  const next = [...slots];
  const from = slotOf(next, id);
  const current = from >= 0 ? next[from] : null;
  const occupant = next[target] && next[target].id !== id ? next[target] : null;
  next[target] = { id, display: display ?? current?.display ?? 'box' };
  if (from >= 0 && from !== target) next[from] = occupant && mode === 'swap' ? occupant : null;
  return next;
}

/** Cambia la presentación expuesta en su posición (sin moverla). */
export function setSlotDisplay(slots, id, display) {
  return slots.map((s) => (s?.id === id ? { ...s, display } : s));
}

/** «Guardar en el ático»: deja su posición vacía (la figura, sus piezas y su progreso no cambian). */
export function removeFromShelf(slots, id) {
  return slots.map((s) => (s?.id === id ? null : s));
}

/** Estado inicial: las dos figuras de partida, la Dama como Guardián y una caja de bienvenida. */
export function initialFigures(books, extraBoxes = 0, now = new Date().toISOString()) {
  const owned = {};
  const placements = {};
  STARTERS.forEach((s) => {
    owned[s.id] = { display: 'box', parts: [0], obtainedAt: now };
    const book = matchBook(s.keywords, books);
    if (book) placements[s.id] = book.id;
  });
  return { ...EMPTY_FIGURES, owned, placements, guardian: STARTERS[0].id, boxes: 1 + extraBoxes };
}

/** Rango de coleccionista (1–5 estrellas) según los huecos del blíster completados. */
export function rankOf(partsTotal, entry) {
  if (!entry) return 0;
  const have = entry.parts?.length ?? 0;
  if (!partsTotal) return 1;
  return Math.min(5, 1 + Math.floor((have / partsTotal) * 4));
}

/**
 * Enciende un sello del Guardián: como mucho uno al día (salvo `force`, el botón de prueba). Si el día se
 * leyó un libro con su figura al lado, deja además una carga de sinergia. El 5.º sello da una Caja Sorpresa.
 */
export function grantSeal(fs, date, { force = false, bookId = null } = {}) {
  if (!fs) return fs;
  let next = fs;
  const synergic = bookId && Object.values(fs.placements ?? {}).some((v) => (Array.isArray(v) ? v.includes(bookId) : v === bookId));
  if (synergic && fs.synergyDay !== date) next = { ...next, synergy: (next.synergy ?? 0) + 1, synergyDay: date };
  if (!next.guardian) return next;
  if (!force && next.lastSealDay === date) return next;
  const seals = next.seals + 1;
  if (seals >= SEALS_PER_BOX) return { ...next, seals: 0, boxes: next.boxes + 1, lastSealDay: date, sealBox: true };
  return { ...next, seals, lastSealDay: date, sealBox: false };
}

/** Piezas que le faltan a una figura (índices del blíster). */
const missingParts = (fig, entry) => fig.parts.map((_, i) => i).filter((i) => !(entry?.parts ?? []).includes(i));

/**
 * Abre una Caja Sorpresa. `figs` es el catálogo (id, rarity, parts) y `rnd` una lista de números al azar
 * (así la regla es pura y se puede probar). Devuelve el estado nuevo y la recompensa.
 */
export function openMysteryBox(fs, figs, rnd) {
  if (!fs || fs.boxes <= 0 || !figs.length) return { fs, reward: null };
  const r = [...rnd];
  const next = () => (r.length ? r.shift() : Math.random());
  const inc = fs.synergy > 0 ? 2 : 1;
  const pity = { relic: fs.pity.relic + inc, figure: fs.pity.figure + inc };
  const owned = { ...fs.owned };
  const unowned = figs.filter((f) => !owned[f.id]);
  const path = figs.find((f) => f.id === fs.path) ?? null;
  const pick = (list) => {
    // Al azar ponderado por rareza (las raras salen más)
    const total = list.reduce((s, f) => s + (RARITY[f.rarity]?.weight ?? 1), 0);
    let roll = next() * total;
    for (const f of list) {
      roll -= RARITY[f.rarity]?.weight ?? 1;
      if (roll <= 0) return f;
    }
    return list[list.length - 1];
  };
  let reward = null;

  const highUnowned = unowned.filter((f) => f.rarity === 'epic' || f.rarity === 'legendary');
  if (pity.figure >= FIGURE_PITY && highUnowned.length) {
    // Pity de figura: la de tu Senda si es épica/legendaria y aún no la tienes
    const fig = highUnowned.find((f) => f.id === path?.id) ?? pick(highUnowned);
    reward = { type: 'figure', id: fig.id, pity: true };
  } else if (unowned.length && next() < 0.1) {
    const fig = unowned.find((f) => f.id === path?.id && next() < 0.5) ?? pick(unowned);
    reward = { type: 'figure', id: fig.id };
  } else {
    const withMissing = figs.filter((f) => owned[f.id] && missingParts(f, owned[f.id]).length);
    const preferred = withMissing.find((f) => f.id === path?.id) ?? withMissing.find((f) => f.id === fs.guardian) ?? null;
    if (withMissing.length && (pity.relic >= RELIC_PITY || next() < 0.55)) {
      const fig = pity.relic >= RELIC_PITY && preferred ? preferred : (preferred && next() < 0.5 ? preferred : withMissing[Math.floor(next() * withMissing.length)]);
      const miss = missingParts(fig, owned[fig.id]);
      const part = miss[Math.floor(next() * miss.length)];
      reward = { type: 'part', id: fig.id, part, pity: pity.relic >= RELIC_PITY };
    } else reward = { type: 'seal' };
  }

  let out = { ...fs, boxes: fs.boxes - 1, synergy: Math.max(0, (fs.synergy ?? 0) - 1), owned, pity, lastReward: reward, sealBox: false };
  if (reward.type === 'figure') {
    owned[reward.id] = { display: 'box', parts: [], obtainedAt: new Date().toISOString() };
    const fig = figs.find((f) => f.id === reward.id);
    if (fig.rarity !== 'rare' || reward.pity) pity.figure = 0;
  } else if (reward.type === 'part') {
    owned[reward.id] = { ...owned[reward.id], parts: [...owned[reward.id].parts, reward.part] };
    pity.relic = 0;
  } else if (out.guardian) {
    // Fragmento de sello: un sello extra para tu Guardián (no cuenta como lectura del día)
    out = grantSeal({ ...out, lastSealDay: null }, '', { force: true });
    out.lastSealDay = fs.lastSealDay;
    out.lastReward = reward;
  }
  return { fs: out, reward };
}

/**
 * Abre una Caja Sorpresa dentro de un intento identificado (SPEC §13.6). Consumir la caja y conceder el
 * premio es una sola actualización, con las reglas de `openMysteryBox` intactas. Repetir el mismo `attemptId`
 * devuelve el estado tal cual (el premio ya confirmado), sin consumir otra caja ni sortear de nuevo.
 */
export function openBoxAttempt(fs, figs, rnd, attemptId, at = new Date().toISOString()) {
  if (!fs || !attemptId) return fs;
  if (fs.unbox?.id === attemptId) return fs;
  if (fs.boxes <= 0 || !figs.length) return fs;
  const { fs: next, reward } = openMysteryBox(fs, figs, rnd);
  if (!reward) return fs;
  let rank = null;
  if (reward.type === 'part') {
    const fig = figs.find((f) => f.id === reward.id);
    rank = { before: rankOf(fig.parts.length, fs.owned[reward.id]), after: rankOf(fig.parts.length, next.owned[reward.id]) };
  }
  return { ...next, unbox: { id: attemptId, reward: { ...reward, rank }, at, seen: false } };
}

/** El resultado del intento ya se ha mostrado: no se vuelve a presentar al entrar en la cámara. */
export function markUnboxSeen(fs, attemptId) {
  if (!fs?.unbox || fs.unbox.id !== attemptId || fs.unbox.seen) return fs;
  return { ...fs, unbox: { ...fs.unbox, seen: true }, lastReward: null };
}
