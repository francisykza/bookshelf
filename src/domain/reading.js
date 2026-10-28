// Registro de lecturas (SPEC §14.6, 1.20.0): cada lectura es un registro propio con la posición que tenía el
// libro EN ESE MOMENTO. Distingue tres cosas que antes iban en un solo número: la posición alcanzada (`to`),
// el avance respecto a la anterior (`delta`) y las páginas leídas que cuentan para estadísticas (`pages`).
// Todo es puro: la vista previa del formulario y el guardado usan las mismas funciones.
import { clampPage, clampPercent, fmtNum, isDevice, newId, positionOf, roundTo, trackUnit } from './books';
import { addDays, dayKey } from './dates';

export const MODES = {
  added: { label: 'He leído', help: 'Páginas que has leído en esta sesión.' },
  page: { label: 'Voy por la página', help: 'La página por la que vas ahora.' },
  percent: { label: 'Porcentaje', help: 'El porcentaje que marca tu lector (de 0 a 100, un decimal).' },
};

/** Modalidades posibles para un libro: «He leído» solo con seguimiento por páginas. */
export function modesFor(book) {
  if (trackUnit(book) === 'pages') return ['added', 'page', 'percent'];
  return book.pageCount ? ['percent', 'page'] : ['percent'];
}

const byTime = (a, b) => a.date.localeCompare(b.date) || (a.createdAt || '').localeCompare(b.createdAt || '');

/** Registros de un libro en orden cronológico. */
export const bookLog = (log, bookId) => log.filter((e) => e.bookId === bookId).sort(byTime);

/** Por defecto: porcentaje si el libro va por porcentaje; si no, la última modalidad usada o «He leído». */
export function defaultMode(book, log) {
  const modes = modesFor(book);
  if (trackUnit(book) === 'percent') return 'percent';
  const last = bookLog(log, book.id)
    .reverse()
    .find((e) => e.source === 'form' && modes.includes(e.mode));
  return last?.mode ?? 'added';
}

/** Cuenta como día de lectura (racha, sello y «días leyendo»). Las correcciones nunca. */
export const isActive = (e) => e.kind !== 'correction' && (e.active ?? e.pages > 0);

/**
 * Número tecleado con coma o punto decimal. Rechaza vacíos, signos, letras y separadores de miles
 * (para no adivinar si «1.234» son mil doscientas o uno con algo).
 */
export function parseDecimal(text) {
  const s = String(text ?? '').trim();
  if (!s) return { error: 'Escribe un número.' };
  if (!/^\d+([.,]\d+)?$/.test(s)) return { error: 'Usa solo cifras y, si hace falta, una coma decimal (p. ej. 42,5).' };
  const value = Number(s.replace(',', '.'));
  return Number.isFinite(value) ? { value, decimals: s.split(/[.,]/)[1]?.length ?? 0 } : { error: 'Ese número no es válido.' };
}

/** Valida lo tecleado según la modalidad. Devuelve `{ value }` o `{ error }`. */
export function validateInput(book, mode, text) {
  const parsed = parseDecimal(text);
  if (parsed.error) return parsed;
  const { value, decimals } = parsed;
  if (mode === 'percent') {
    if (value > 100) return { error: 'El porcentaje va de 0 a 100.' };
    if (decimals > 1) return { error: 'Usa como mucho un decimal (p. ej. 42,5).' };
    return { value };
  }
  if (decimals > 0) return { error: 'Las páginas son números enteros.' };
  if (mode === 'added' && value < 1) return { error: 'Escribe al menos 1 página.' };
  if (mode === 'page' && book.pageCount && value > book.pageCount) return { error: `El libro tiene ${book.pageCount} páginas.` };
  return { value };
}

/** Posición en la unidad del libro a partir de lo tecleado (convierte página ↔ porcentaje si hace falta). */
function targetOf(book, mode, value) {
  const unit = trackUnit(book);
  if (mode === 'page' && unit === 'percent') return { to: roundTo((value / book.pageCount) * 100, 1), entered: { page: value } };
  if (mode === 'percent' && unit === 'pages') return { to: Math.round((book.pageCount * value) / 100), entered: { percent: value } };
  return { to: value, entered: null };
}

/** Registros del libro con posición conocida en esa unidad (la cadena de posiciones). */
const chain = (log, book, unit) => bookLog(log, book.id).filter((e) => e.unit === unit && e.to != null);

/**
 * Posición anterior fiable para un registro del día `date`. Si no hay registros posteriores del libro es la
 * posición actual (cuando ya es un dato: mayor que 0, con historial o al sumar páginas); si es
 * retrospectivo, la última posición conocida antes de ese día. `null` si no la hay.
 */
export function previousPosition(book, log, date, mode) {
  const unit = trackUnit(book);
  const known = chain(log, book, unit);
  const latest = !log.some((e) => e.bookId === book.id && e.date > date);
  if (latest) {
    const current = positionOf(book);
    return { latest, from: current > 0 || known.length || mode === 'added' ? current : null };
  }
  const before = known.filter((e) => e.date <= date).pop();
  return { latest, from: before ? before.to : null };
}

/**
 * Construye un registro sin tocar el estado. Devuelve `{ error }` o `{ entry, position, conflict, correction }`:
 * `position` es la posición nueva del libro (o `null` si no cambia) y `correction` indica un retroceso que
 * hay que confirmar.
 */
export function buildEntry(book, log, { date, mode, text, declared = false, id = newId('s'), now = new Date().toISOString(), source = 'form', today = dayKey() }) {
  const checked = validateInput(book, mode, text);
  if (checked.error) return checked;
  const unit = trackUnit(book);
  const { latest } = previousPosition(book, log, date, mode);
  let { from } = previousPosition(book, log, date, mode);
  let to;
  let entered = null;
  let delta;
  if (mode === 'added') {
    delta = checked.value;
    to = from != null ? from + delta : null;
    if (to != null && to > book.pageCount) return { error: `Pasarías de la página ${book.pageCount}, la última del libro.` };
  } else {
    ({ to, entered } = targetOf(book, mode, checked.value));
    // Un día pasado por debajo de la posición de hoy es un dato histórico, no un retroceso
    if (date < today && from != null && to < from) from = null;
    delta = from != null ? roundTo(to - from, unit === 'percent' ? 1 : 0) : null;
  }
  const kind = delta != null && delta < 0 ? 'correction' : 'read';
  const pages = kind === 'read' && unit === 'pages' ? Math.max(0, delta ?? 0) : 0;
  const entry = {
    id,
    bookId: book.id,
    date,
    createdAt: now,
    kind,
    unit,
    mode,
    from,
    to,
    pages,
    delta,
    total: book.pageCount ?? null,
    active: kind === 'read' && ((delta ?? 0) > 0 || declared),
    source,
    ...(entered && { entered }),
  };
  // Un registro retrospectivo nunca baja la posición actual; solo la mueve el más reciente
  let position = null;
  if (latest && to != null && (kind === 'correction' || to > positionOf(book))) position = to;
  const later = chain(log, book, unit).find((e) => e.date > date);
  const conflict = later && to != null && to > later.to ? later : null;
  return { entry, position, conflict, correction: kind === 'correction' };
}

/**
 * Botones rápidos (±1, ±10, +5): se agrupan en un registro `quick` por libro y día mientras sea el último
 * del libro. Devuelve `{ log, position, entry }` o `null` si no cambia nada.
 */
export function quickUpdate(book, log, target, { date, now = new Date().toISOString(), id = newId('s'), source = 'quick' }) {
  const unit = trackUnit(book);
  const current = positionOf(book);
  const to = unit === 'pages' ? clampPage(book, target) : roundTo(clampPercent(target), 1);
  if (to === current) return null;
  const mine = bookLog(log, book.id);
  const last = mine[mine.length - 1];
  const reuse = source === 'quick' && last?.source === 'quick' && last.date === date && last.unit === unit && last.from != null;
  const base = reuse ? log.filter((e) => e.id !== last.id) : log;
  const from = reuse ? last.from : current;
  if (to === from) return { log: base, position: to, entry: null };
  const delta = roundTo(to - from, unit === 'percent' ? 1 : 0);
  const kind = delta < 0 ? 'correction' : 'read';
  const entry = {
    id: reuse ? last.id : id,
    bookId: book.id,
    date,
    createdAt: reuse ? last.createdAt : now,
    kind,
    unit,
    mode: unit === 'pages' ? 'page' : 'percent',
    from,
    to,
    pages: kind === 'read' && unit === 'pages' ? delta : 0,
    delta,
    total: book.pageCount ?? null,
    active: kind === 'read',
    source,
  };
  return { log: [...base, entry], position: to, entry };
}

/**
 * Edita el valor de un registro por su id: recalcula páginas y avance a partir de su posición anterior.
 * Un registro de lectura no puede convertirse en retroceso (para eso está la corrección).
 */
export function editEntry(entry, book, text) {
  const mode = entry.mode ?? 'added';
  const checked = validateInput(book ?? { pageCount: entry.total }, mode, text);
  if (checked.error) return checked;
  const unit = entry.unit;
  let to = entry.to;
  let delta;
  if (mode === 'added') {
    delta = checked.value;
    to = entry.from != null ? entry.from + delta : null;
  } else {
    to = book ? targetOf(book, mode, checked.value).to : checked.value;
    delta = entry.from != null ? roundTo(to - entry.from, unit === 'percent' ? 1 : 0) : null;
  }
  if (entry.kind === 'read' && delta != null && delta < 0) return { error: 'Eso sería un retroceso: bórralo y registra una corrección.' };
  if (entry.kind === 'correction' && delta != null && delta >= 0) return { error: 'Una corrección tiene que quedar por debajo de la posición anterior.' };
  const pages = entry.kind === 'read' && unit === 'pages' ? Math.max(0, delta ?? 0) : 0;
  return { entry: { ...entry, to, delta, pages, editedAt: new Date().toISOString(), active: entry.kind === 'read' && ((delta ?? 0) > 0 || !!entry.active) } };
}

/** Valor del registro tal como se teclea al editarlo. */
export function entryInput(entry) {
  if ((entry.mode ?? 'added') === 'added') return String(entry.pages ?? '');
  if (entry.entered?.page != null) return String(entry.entered.page);
  if (entry.entered?.percent != null) return fmtNum(entry.entered.percent);
  return entry.to != null ? fmtNum(entry.to) : '';
}

/** Añade un registro; si su id ya está (doble toque, reintento) devuelve el mismo log sin cambios. */
export const appendEntry = (log, entry) => (!entry || log.some((e) => e.id === entry.id) ? log : [...log, entry]);

/** Puntos porcentuales sin «+0»: un avance positivo diminuto es «<0,1». */
export function formatPP(delta) {
  if (delta > 0 && delta < 0.1) return '<0,1';
  return fmtNum(roundTo(delta, 1));
}

/**
 * Texto de un registro con los datos que tenía AL REGISTRARSE (nunca con la posición de hoy).
 * `position`: dónde quedó; `advance`: cuánto avanzó (o `null` si no se sabe).
 */
export function describeEntry(e, { compact = false } = {}) {
  const pct = e.unit === 'percent';
  const pp = (d) => (compact ? `${formatPP(d)} pp` : `${formatPP(d)} puntos porcentuales`);
  if (e.kind === 'correction') {
    const where = pct ? `${fmtNum(e.to)} %` : `página ${e.to}`;
    return { position: `Corrección: ahora ${where}`, advance: null, correction: true };
  }
  if (e.to == null) return { position: null, advance: `${e.pages} ${e.pages === 1 ? 'página registrada' : 'páginas registradas'}` };
  const position = pct ? `${fmtNum(e.to)} % leído` : `Página ${e.to}${e.total ? ` de ${e.total}` : ''}`;
  let advance = null;
  if (e.delta > 0) advance = pct ? `+${pp(e.delta)}` : `+${e.delta} ${e.delta === 1 ? 'página' : 'páginas'}`;
  return { position, advance };
}

/**
 * Vista previa del formulario (1.47, SPEC §45): frases cortas con lo que se registrará y cómo queda el libro.
 * Libro de 528 págs. en la 25 y «He leído 20» (o «Voy por la página 45») → «Registrarás 20 páginas», «Pasarás de
 * la página 25 a la 45», «8,5 % leído». Una corrección hacia atrás se dice como tal y no suma páginas.
 */
export function previewLines(e) {
  const pct = e.unit === 'percent';
  const at = (v) => (pct ? `el ${fmtNum(v)} %` : `la página ${v}`);
  if (e.kind === 'correction') return [`Corregirás tu posición: de ${at(e.from)} a ${at(e.to)}`, 'No suma páginas ni cuenta para la racha'];
  const lines = [];
  if (pct) {
    if (e.delta > 0) lines.push(`Registrarás ${formatPP(e.delta)} puntos de avance`);
    if (e.from != null && e.to != null) lines.push(`Pasarás del ${fmtNum(e.from)} % al ${fmtNum(e.to)} %`);
    else if (e.to != null) lines.push(`Quedarás en el ${fmtNum(e.to)} %`);
    return lines;
  }
  const n = e.delta > 0 ? e.delta : e.pages;
  if (n > 0) lines.push(`Registrarás ${n} ${n === 1 ? 'página' : 'páginas'}`);
  if (e.from != null && e.to != null && e.to !== e.from) lines.push(`Pasarás de la página ${e.from} a la ${e.to}`);
  else if (e.to != null && e.from == null) lines.push(`Quedarás en la página ${e.to}`);
  else if (e.to != null) lines.push(`Sigues en la página ${e.to}`);
  if (e.to != null && e.total) lines.push(`${fmtNum(roundTo((e.to / e.total) * 100, 1))} % leído`);
  return lines;
}

export const entryText = (e, opts) => {
  const { position, advance } = describeEntry(e, opts);
  return [position, advance].filter(Boolean).join(' · ');
};

/** Resumen de un conjunto de registros sin mezclar unidades: «22 páginas · avance registrado en 1 ebook». */
export function summarize(entries, books) {
  const byId = new Map(books.map((b) => [b.id, b]));
  const reads = entries.filter((e) => e.kind !== 'correction');
  const pages = reads.reduce((s, e) => s + (e.pages || 0), 0);
  const pctBooks = [...new Set(reads.filter((e) => e.unit === 'percent').map((e) => e.bookId))].map((id) => byId.get(id)).filter(Boolean);
  const parts = [];
  if (pages > 0) parts.push(`${pages.toLocaleString('es-ES')} ${pages === 1 ? 'página' : 'páginas'}`);
  if (pctBooks.length) {
    const ebooks = pctBooks.every((b) => isDevice(b));
    const noun = ebooks ? (pctBooks.length === 1 ? 'ebook' : 'ebooks') : pctBooks.length === 1 ? 'libro' : 'libros';
    parts.push(`avance registrado en ${pctBooks.length} ${noun}`);
  }
  return { pages, percentBooks: pctBooks.length, text: parts.join(' · ') };
}

/**
 * Lecturas por día y libro: `{ [date]: [{ book, entries, pages, last }] }`, con el libro más leído primero.
 * `last` es el último registro del libro ese día (su posición es la de ese momento).
 */
export function groupByDay(log, books) {
  const byId = new Map(books.map((b) => [b.id, b]));
  const days = {};
  [...log].sort(byTime).forEach((e) => {
    const book = byId.get(e.bookId);
    if (!book || (e.kind !== 'correction' && !(e.pages > 0) && e.to == null && !e.active)) return;
    const list = (days[e.date] ??= []);
    let group = list.find((g) => g.book.id === book.id);
    if (!group) list.push((group = { book, entries: [], pages: 0, last: null }));
    group.entries.push(e);
    group.pages += e.kind === 'correction' ? 0 : e.pages || 0;
    group.last = e;
  });
  Object.values(days).forEach((list) => list.sort((a, b) => b.pages - a.pages));
  return days;
}

/** Dato breve de la celda del calendario: páginas del día o, si solo hay porcentaje, la posición de ese día. */
export function dayDatum(groups) {
  const pages = groups.reduce((s, g) => s + g.pages, 0);
  if (pages > 0) return { kind: 'pages', pages, text: `${pages}`, label: `${pages} ${pages === 1 ? 'página' : 'páginas'}` };
  const pct = groups.map((g) => g.entries.filter((e) => e.unit === 'percent' && e.to != null && e.kind !== 'correction').pop()).find(Boolean);
  if (pct) return { kind: 'percent', pages: 0, text: `${fmtNum(pct.to)} %`, label: `${fmtNum(pct.to)} % leído` };
  return { kind: 'none', pages: 0, text: '', label: '' };
}

/** Escala del mapa de calor por páginas; `'pct'` para días con lectura solo por porcentaje. */
export function heat(groups) {
  const pages = groups.reduce((s, g) => s + g.pages, 0);
  if (pages > 0) return pages < 15 ? 1 : pages < 35 ? 2 : pages < 60 ? 3 : 4;
  return groups.some((g) => g.entries.some(isActive)) ? 'pct' : 0;
}

/**
 * Migración v6 (SPEC §14.7): los registros agregados de versiones anteriores conservan fecha, libro y
 * páginas y reciben id y tipo, sin inventar posiciones. Idempotente.
 */
export function normalizeLog(log) {
  if (!Array.isArray(log)) return [];
  const seen = new Set();
  return log
    .filter((e) => e && typeof e === 'object' && typeof e.date === 'string' && e.bookId)
    .map((e) => {
      let next = e;
      if (!e.id) {
        const pages = Math.max(0, Math.round(Number(e.pages) || 0));
        next = { ...e, id: `legacy-${e.date}-${e.bookId}`, kind: 'read', unit: 'pages', mode: 'added', from: null, to: null, pages, delta: pages, total: null, active: pages > 0, source: 'legacy', createdAt: null };
      }
      if (seen.has(next.id)) next = { ...next, id: `${next.id}-${seen.size}` };
      seen.add(next.id);
      return next;
    });
}

/**
 * Días seguidos leyendo hasta hoy (si hoy aún no has leído, cuenta la racha hasta ayer). Solo lecturas reales:
 * una corrección o una posición sin lectura declarada no la alargan. Única fuente para la pantalla del portátil
 * y para el panel de estadísticas.
 */
export function readingStreak(log, today = new Date()) {
  const days = activeDays(log);
  let cursor = days.has(dayKey(today)) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Días (clave local `YYYY-MM-DD`) con lectura real: la marca de actividad del calendario. */
export const activeDays = (log) => new Set((log ?? []).filter(isActive).map((e) => e.date));
