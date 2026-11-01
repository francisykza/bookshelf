// Reglas de «La librería del puerto» (prototipo, solo desarrollo). Lógica pura: sin DOM, sin red, sin recompensas.
//
// Cada balda es una cuadrícula de `ancho` × `alto` celdas (x hacia la derecha, y hacia arriba desde la tabla). Un libro
// colocado ocupa el rectángulo [x, x + w) × [y, y + h), con w × h = grosor × alto de pie y alto × grosor tumbado.
// Reglas: dentro de la balda, sin solapes, y apoyado entero (y = 0, o todas sus columnas sobre otro libro justo debajo).
// No se puede sacar un libro que tiene otro encima (quedaría flotando). Soltar en una columna deja caer el libro hasta
// apoyarse (gravedad); si cae torcido (una columna sin apoyo) o no cabe, la posición no vale y el tablero no cambia.

export const STATE_VERSION = 1;

/** Ancho y alto que ocupa un libro según su orientación. */
export const footprint = (libro, orient) => (orient === 'tumbado' ? { w: libro.alto, h: libro.grosor } : { w: libro.grosor, h: libro.alto });

/** Estado inicial de un nivel: todos los libros en la caja, de pie. */
export function createGame(level) {
  return {
    v: STATE_VERSION,
    level: level.id,
    placed: Object.fromEntries(level.libros.map((b) => [b.id, null])),
    history: [],
    // Jugadas en orden (poner, caja, deshacer): con ellas se puede repetir la partida y comprobarla (`replay`)
    jugadas: [],
    moves: 0,
    won: false,
  };
}

const bookOf = (level, id) => level.libros.find((b) => b.id === id);
const shelfOf = (level, id) => level.baldas.find((s) => s.id === id);

/** Rectángulos ocupados en una balda, sin el libro `except`. */
function occupied(level, game, shelfId, except = null) {
  const out = [];
  for (const [id, p] of Object.entries(game.placed)) {
    if (!p || p.balda !== shelfId || id === except) continue;
    out.push({ id, x: p.x, y: p.y, ...footprint(bookOf(level, id), p.orient) });
  }
  return out;
}

const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Altura de la pila en una columna (celda libre más baja por encima de todo lo apoyado), sin `except`. */
function columnTop(rects, col) {
  let top = 0;
  for (const r of rects) if (col >= r.x && col < r.x + r.w) top = Math.max(top, r.y + r.h);
  return top;
}

/**
 * ¿Vale esta posición exacta? `{ ok, reason }`. Razones: 'fuera' (no cabe en la balda), 'solape' (choca con otro libro),
 * 'flota' (alguna columna sin apoyo justo debajo).
 */
export function check(level, game, libroId, { balda, x, y, orient }) {
  const libro = bookOf(level, libroId);
  const shelf = shelfOf(level, balda);
  if (!libro || !shelf) return { ok: false, reason: 'fuera' };
  const { w, h } = footprint(libro, orient);
  if (x < 0 || y < 0 || x + w > shelf.ancho || y + h > shelf.alto) return { ok: false, reason: 'fuera' };
  const rects = occupied(level, game, balda, libroId);
  const me = { x, y, w, h };
  if (rects.some((r) => overlaps(r, me))) return { ok: false, reason: 'solape' };
  if (y > 0) for (let c = x; c < x + w; c += 1) if (!rects.some((r) => c >= r.x && c < r.x + r.w && r.y + r.h === y)) return { ok: false, reason: 'flota' };
  return { ok: true, reason: null };
}

/**
 * Dónde caería el libro al soltarlo con su borde izquierdo en la columna `x` de `balda` (gravedad), y si vale.
 * `x` se ajusta para que el libro quede dentro de la balda a lo ancho.
 */
export function dropAt(level, game, libroId, balda, x, orient) {
  const libro = bookOf(level, libroId);
  const shelf = shelfOf(level, balda);
  const { w, h } = footprint(libro, orient);
  const cx = Math.max(0, Math.min(shelf.ancho - w, Math.round(x)));
  const rects = occupied(level, game, balda, libroId);
  let y = 0;
  for (let c = cx; c < cx + w; c += 1) y = Math.max(y, columnTop(rects, c));
  const target = { balda, x: cx, y, orient };
  const result = w > shelf.ancho ? { ok: false, reason: 'fuera' } : check(level, game, libroId, target);
  return { target, w, h, ...result };
}

/** ¿Se puede coger este libro? No si tiene otro encima. */
export function canLift(level, game, libroId) {
  const p = game.placed[libroId];
  if (!p) return { ok: true, reason: null };
  const { w, h } = footprint(bookOf(level, libroId), p.orient);
  const above = occupied(level, game, p.balda, libroId).some((r) => r.y === p.y + h && r.x < p.x + w && p.x < r.x + r.w);
  return above ? { ok: false, reason: 'encima' } : { ok: true, reason: null };
}

const snapshot = (game) => JSON.stringify(game.placed);

function commit(level, game, placed, jugada) {
  const next = { ...game, placed, history: [...game.history, snapshot(game)], jugadas: [...(game.jugadas ?? []), jugada], moves: game.moves + 1 };
  next.won = isComplete(level, next);
  return next;
}

/** Colocar (o mover) un libro en una posición exacta. Si no vale, devuelve el mismo estado sin cambios. */
export function place(level, game, libroId, target) {
  if (game.won || !canLift(level, game, libroId).ok || !check(level, game, libroId, target).ok) return game;
  const prev = game.placed[libroId];
  if (prev && prev.balda === target.balda && prev.x === target.x && prev.y === target.y && prev.orient === target.orient) return game;
  return commit(level, game, { ...game.placed, [libroId]: { balda: target.balda, x: target.x, y: target.y, orient: target.orient } }, { t: 'poner', libro: libroId, balda: target.balda, x: target.x, y: target.y, orient: target.orient });
}

/** Devolver un libro a la caja (si no sostiene a otro). */
export function returnToCrate(level, game, libroId) {
  if (game.won || !game.placed[libroId] || !canLift(level, game, libroId).ok) return game;
  return commit(level, game, { ...game.placed, [libroId]: null }, { t: 'caja', libro: libroId });
}

/** Deshacer la última colocación (no deshace una victoria ya anunciada: tras ganar el tablero queda fijo). */
export function undo(level, game) {
  if (game.won || !game.history.length) return game;
  const placed = JSON.parse(game.history.at(-1));
  return { ...game, placed, history: game.history.slice(0, -1), jugadas: [...(game.jugadas ?? []), { t: 'deshacer' }], moves: game.moves + 1, won: false };
}

/** Volver al principio del nivel. */
export const reset = (level) => createGame(level);

/** Todos los libros en las baldas (ninguno en la caja). Las colocaciones ya son válidas por construcción. */
export function isComplete(level, game) {
  return level.libros.every((b) => game.placed[b.id]);
}

/** Baldas llenas en el sentido de «sin libros pendientes para ella»: todas las columnas ocupadas en la base. */
export function shelfFull(level, game, shelfId) {
  const shelf = shelfOf(level, shelfId);
  const rects = occupied(level, game, shelfId);
  for (let c = 0; c < shelf.ancho; c += 1) if (!rects.some((r) => c >= r.x && c < r.x + r.w && r.y === 0)) return false;
  return true;
}

/** Mínimo de movimientos de un nivel: cada libro se coloca una vez. */
export const minMoves = (level) => level.libros.length;

/**
 * Estrellas al terminar (0 si no está terminado): una por terminar, dos si se hace en el mínimo + 2 movimientos y tres
 * si se hace en el mínimo exacto y sin pistas. Deshacer cuenta como movimiento.
 */
export function stars(level, game, { hints = 0 } = {}) {
  const min = minMoves(level);
  if (!game.won) return { total: 0, min, moves: game.moves };
  const total = hints === 0 && game.moves <= min ? 3 : game.moves <= min + 2 ? 2 : 1;
  return { total, min, moves: game.moves };
}

/**
 * Pista: el siguiente paso de la solución del nivel que aún no está hecho, si se puede hacer ya (`ok`); si algo lo
 * estorba, `ok` es false y el paso sirve igualmente de orientación.
 */
export function hint(level, game) {
  for (const step of level.solution) {
    const p = game.placed[step.libro];
    if (p && p.balda === step.balda && p.x === step.x && p.y === step.y && p.orient === step.orient) continue;
    const target = { balda: step.balda, x: step.x, y: step.y, orient: step.orient };
    return { libro: step.libro, target, ok: canLift(level, game, step.libro).ok && check(level, game, step.libro, target).ok };
  }
  return null;
}

/** Estado serializable con versión (para guardar y retomar). */
export function exportState(game) {
  return JSON.stringify({ v: STATE_VERSION, level: game.level, placed: game.placed, history: game.history, jugadas: game.jugadas ?? [], moves: game.moves, won: game.won });
}

/**
 * Restaurar un estado exportado. Se rechaza (devuelve null) si la versión o el nivel no coinciden o si alguna colocación
 * no cumple las reglas: un estado manipulado no puede dejar libros flotando ni dar una victoria falsa.
 */
export function restoreState(level, text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!data || data.v !== STATE_VERSION || data.level !== level.id || typeof data.placed !== 'object') return null;
  let game = createGame(level);
  const entries = Object.entries(data.placed).filter(([id, p]) => p && bookOf(level, id));
  // Se recolocan de abajo arriba para comprobar el apoyo de cada uno
  entries.sort((a, b) => a[1].y - b[1].y);
  for (const [id, p] of entries) {
    const next = place(level, game, id, p);
    // place() devuelve el mismo objeto si la colocación no vale
    if (next === game) return null;
    game = next;
  }
  // Las jugadas guardadas no se comprueban aquí (para el ranking cuenta `replay` en el servidor, no este estado)
  const jugadas = Array.isArray(data.jugadas) ? data.jugadas.filter((j) => j && typeof j === 'object') : [];
  return { ...game, history: Array.isArray(data.history) ? data.history.filter((h) => typeof h === 'string') : [], jugadas, moves: Number(data.moves) || 0, won: isComplete(level, game) };
}

/**
 * Repite una partida jugada a jugada desde el principio y devuelve el estado final, o null si alguna jugada no vale
 * (fuera de las reglas, de otro nivel, mal formada o después de ganar). Es lo que haría el servidor antes de aceptar un
 * resultado del ranking: los movimientos se cuentan aquí, nunca se toman del cliente.
 */
export function replay(level, jugadas) {
  if (!Array.isArray(jugadas) || jugadas.length > 500) return null;
  let game = createGame(level);
  for (const j of jugadas) {
    let next = game;
    if (j?.t === 'poner' && bookOf(level, j.libro) && (j.orient === 'pie' || j.orient === 'tumbado') && [j.x, j.y].every(Number.isInteger)) {
      next = place(level, game, j.libro, { balda: j.balda, x: j.x, y: j.y, orient: j.orient });
    } else if (j?.t === 'caja' && bookOf(level, j.libro)) next = returnToCrate(level, game, j.libro);
    else if (j?.t === 'deshacer') next = undo(level, game);
    if (next === game) return null;
    game = next;
  }
  return game;
}
