// Medidas por acción para el medidor del piloto (`&medir=1`): guardar una lectura, desplazar la biblioteca y reposo.
// Los bloqueos salen de la API de tareas largas donde existe (Chrome, también en Android). Safari no la tiene: allí un
// temporizador que se repite mide cuánto llega tarde, y ese retraso es lo que la página ha estado bloqueada. Con la CPU
// limitada por las herramientas de Chrome esa sonda ve pausas que no son tareas: por eso solo se usa donde no hay otra.
import { persistLog } from '../../state/serialize';

const PROBE_MS = 16;
/** Un retraso por encima de esto cuenta como bloqueo. */
const BLOCK_MS = 30;
const LONG_MS = 50;
/** Tras confirmar un guardado, lo que se sigue mirando: lo que provoca (cerrar, redibujar) también cuenta. */
const AFTER_SAVE_MS = 1200;
/** Sin eventos de desplazamiento durante esto, el gesto ha terminado. */
const SCROLL_END_MS = 250;
const KEEP = 20;
export const IDLE_MS = 30000;

const blocks = [];
const tasks = [];
let hasLongTasks = false;
const saves = [];
const scrolls = [];
const listeners = new Set();
let started = false;
let pendingSave = null;
let scrolling = null;
let idle = null;

const round = (v) => Math.round(v);
const median = (list) => {
  const s = [...list].sort((a, b) => a - b);
  return s.length ? s[s.length >> 1] : null;
};
const keep = (list, item) => {
  list.push(item);
  if (list.length > KEEP) list.shift();
};
function notify() {
  window.__pisoLabMedidas = snapshot();
  for (const fn of listeners) fn();
}

/** Bloqueos que tocan la ventana [from, to]: el más largo y cuántos pasan de 50 ms. */
function blocksIn(from, to) {
  const inside = (hasLongTasks ? tasks : blocks).filter((b) => b.end >= from && b.start <= to);
  return { bloqueo: round(Math.max(0, ...inside.map((b) => b.ms))), mas50: inside.filter((b) => b.ms > LONG_MS).length, fuente: hasLongTasks ? 'tareas largas' : 'sonda' };
}

function probe() {
  let expected = performance.now() + PROBE_MS;
  const tick = () => {
    const now = performance.now();
    const late = now - expected;
    // Con la página oculta los temporizadores se frenan a propósito: eso no es un bloqueo
    if (late > BLOCK_MS && document.visibilityState === 'visible') {
      blocks.push({ start: expected, end: now, ms: late });
      if (blocks.length > 400) blocks.splice(0, 100);
    }
    expected = now + PROBE_MS;
    setTimeout(tick, PROBE_MS);
  };
  setTimeout(tick, PROBE_MS);
}

// ── Guardar una lectura ──
function onMark(entry) {
  if (entry.name === 'lectura:toque') pendingSave = { at: entry.startTime };
  else if ((entry.name === 'lectura:confirmada' || entry.name === 'lectura:fallida') && pendingSave) {
    const save = pendingSave;
    pendingSave = null;
    save.end = entry.startTime;
    save.ok = entry.name === 'lectura:confirmada';
    setTimeout(() => closeSave(save), AFTER_SAVE_MS);
  }
}

function closeSave(save) {
  const to = save.end + AFTER_SAVE_MS;
  const inWindow = persistLog.filter((e) => e.at >= save.at && e.at <= to);
  const serial = inWindow.filter((e) => e.kind === 'serializar');
  const writes = inWindow.filter((e) => e.kind === 'escribir');
  keep(saves, {
    total: round(save.end - save.at),
    resultado: save.ok ? 'confirmado' : 'no se pudo escribir',
    ...blocksIn(save.at, to),
    serializaciones: serial.length,
    librosRehechos: serial.reduce((n, e) => n + e.rebuilt, 0),
    libros: serial.at(-1)?.books ?? null,
    serializarMs: round(serial.reduce((n, e) => n + e.ms, 0)),
    escrituras: writes.length,
    escrituraFallida: writes.some((e) => !e.ok),
    escribirMs: round(writes.reduce((n, e) => n + e.ms, 0)),
    caracteres: writes.at(-1)?.chars ?? serial.at(-1)?.chars ?? null,
  });
  notify();
}

// ── Desplazar la biblioteca ──
function onScroll(event) {
  const list = event.target;
  if (!(list instanceof Element) || !list.classList.contains('plab-library__list')) return;
  const now = performance.now();
  if (scrolling) {
    scrolling.lastScroll = now;
    return;
  }
  scrolling = { list, from: now, lastScroll: now, top: list.scrollTop, stamps: [now], rows: 0, images: 0 };
  const frame = (t) => {
    const s = scrolling;
    if (!s) return;
    if (t - s.lastScroll > SCROLL_END_MS) return closeScroll(s);
    s.stamps.push(t);
    // Contar lo montado también cuesta: uno de cada diez fotogramas
    if (s.stamps.length % 10 === 0) {
      s.rows = Math.max(s.rows, s.list.querySelectorAll('.plab-row').length);
      s.images = Math.max(s.images, s.list.querySelectorAll('img').length);
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function closeScroll(s) {
  scrolling = null;
  // Solo cuenta mientras se movía: los fotogramas de después del último evento sobran
  const stamps = s.stamps.filter((t) => t <= s.lastScroll + PROBE_MS);
  const duration = (stamps.at(-1) ?? s.from) - stamps[0];
  if (stamps.length < 6 || duration < 200) return;
  const gaps = stamps
    .slice(1)
    .map((t, i) => t - stamps[i])
    .sort((a, b) => a - b);
  let worstSecond = null;
  for (let i = 0, j = 0; i < stamps.length; i += 1) {
    while (j < stamps.length && stamps[j] < stamps[i] + 1000) j += 1;
    if (stamps[i] + 1000 <= stamps.at(-1)) worstSecond = Math.min(worstSecond ?? Infinity, j - i);
  }
  keep(scrolls, {
    segundos: Math.round(duration / 100) / 10,
    fps: Math.round((gaps.length * 10000) / duration) / 10,
    peorSegundo: worstSecond,
    p95: Math.round(gaps[Math.floor(gaps.length * 0.95)] * 10) / 10,
    peor: Math.round(gaps.at(-1) * 10) / 10,
    pxPorSegundo: round(Math.abs(s.list.scrollTop - s.top) / (duration / 1000)),
    ...blocksIn(stamps[0], stamps.at(-1)),
    filas: s.rows,
    imagenes: s.images,
    fotogramas: stamps.length,
  });
  notify();
}

// ── Reposo ──
/** Cuenta durante 30 s, sin tocar nada, los dibujos de la escena y los cambios en la página fuera del medidor. */
export function countIdle(renders, ms = IDLE_MS) {
  if (idle) return idle.promise;
  const from = performance.now();
  const startRenders = renders();
  let changes = 0;
  let touched = false;
  let hidden = document.visibilityState === 'hidden';
  const observer = new MutationObserver((records) => {
    for (const r of records) if (!r.target.closest?.('.plab-meter') && !r.target.parentElement?.closest('.plab-meter')) changes += 1;
  });
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
  const touch = (event) => {
    if (!event.target.closest?.('.plab-meter')) touched = true;
  };
  const hide = () => {
    if (document.visibilityState === 'hidden') hidden = true;
  };
  window.addEventListener('pointerdown', touch, true);
  window.addEventListener('keydown', touch, true);
  document.addEventListener('visibilitychange', hide);
  const run = { from, ms };
  run.promise = new Promise((resolve) => {
    setTimeout(() => {
      observer.disconnect();
      window.removeEventListener('pointerdown', touch, true);
      window.removeEventListener('keydown', touch, true);
      document.removeEventListener('visibilitychange', hide);
      const result = {
        segundos: ms / 1000,
        escena: renders() - startRenders,
        cambiosPagina: changes,
        ...blocksIn(from, from + ms),
        valido: !touched && !hidden,
        motivo: touched ? 'has tocado la pantalla' : hidden ? 'la página se ocultó' : null,
      };
      idle = null;
      last.reposo = result;
      notify();
      resolve(result);
    }, ms);
  });
  idle = run;
  notify();
  return run.promise;
}

const last = { reposo: null };

export function idleLeft() {
  return idle ? Math.max(0, Math.ceil((idle.from + idle.ms - performance.now()) / 1000)) : null;
}

export function snapshot() {
  return { guardados: [...saves], desplazamientos: [...scrolls], reposo: last.reposo };
}

/** Empieza a escuchar una vez por página. Devuelve cómo dejar de recibir avisos. */
export function watchActions(onChange) {
  if (!started) {
    started = true;
    hasLongTasks = PerformanceObserver.supportedEntryTypes?.includes('longtask') ?? false;
    if (hasLongTasks) {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          tasks.push({ start: e.startTime, end: e.startTime + e.duration, ms: e.duration });
          if (tasks.length > 400) tasks.splice(0, 100);
        }
      }).observe({ type: 'longtask', buffered: true });
    } else probe();
    new PerformanceObserver((list) => list.getEntries().forEach(onMark)).observe({ type: 'mark' });
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
  }
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/** ¿Lo mide un navegador controlado por un programa? Así se ve si un resultado es de emulación. */
export const automated = () => navigator.webdriver === true;

/** Las líneas del medidor para estas acciones. */
export function actionLines() {
  const { guardados, desplazamientos, reposo } = snapshot();
  const s = guardados.at(-1);
  const lines = [
    s
      ? `Guardar lectura (último): ${s.total} ms hasta confirmarse, ${s.resultado}; bloqueo más largo ${s.bloqueo} ms; ${s.mas50} de más de 50 ms`
      : 'Guardar lectura: sin medir (guarda una lectura)',
  ];
  if (s) {
    lines.push(
      `Guardar, por dentro: ${s.serializaciones} ${s.serializaciones === 1 ? "serialización" : "serializaciones"}, ${s.librosRehechos} de ${s.libros ?? '–'} libros rehechos, ${s.serializarMs} ms; ${s.escrituras} ${s.escrituras === 1 ? "escritura" : "escrituras"} de ${s.caracteres != null ? `${(s.caracteres / 1e6).toFixed(2)} M` : '–'} caracteres, ${s.escribirMs} ms${s.escrituraFallida ? ', falló' : ''}`,
    );
    if (guardados.length > 1)
      lines.push(`Guardados medidos: ${guardados.length}; mediana ${median(guardados.map((g) => g.total))} ms; peor bloqueo ${Math.max(...guardados.map((g) => g.bloqueo))} ms`);
  }
  const d = desplazamientos.at(-1);
  lines.push(
    d
      ? `Desplazar biblioteca (último, ${d.segundos} s a ${d.pxPorSegundo} px/s): ${d.fps} FPS; peor segundo ${d.peorSegundo ?? '–'}; fotograma: percentil 95 ${d.p95} ms, peor ${d.peor} ms; bloqueo más largo ${d.bloqueo} ms; ${d.mas50} bloqueos de más de 50 ms; ${d.filas} filas y ${d.imagenes} imágenes montadas`
      : 'Desplazar biblioteca: sin medir (abre «Buscar en toda la biblioteca» y desplázate)',
  );
  if (desplazamientos.length > 1) {
    const time = desplazamientos.reduce((n, x) => n + x.segundos, 0);
    const frames = desplazamientos.reduce((n, x) => n + x.fotogramas - 1, 0);
    lines.push(
      `Desplazamientos medidos: ${desplazamientos.length}, ${Math.round(time * 10) / 10} s; ${Math.round((frames / time) * 10) / 10} FPS en total; peor segundo ${Math.min(...desplazamientos.map((x) => x.peorSegundo ?? Infinity))}`,
    );
  }
  const left = idleLeft();
  lines.push(
    left != null
      ? `Reposo: contando, quedan ${left} s; no toques nada`
      : reposo
        ? `Reposo ${reposo.segundos} s: ${reposo.escena} dibujos de la escena; ${reposo.cambiosPagina} cambios en la página; ${reposo.mas50} bloqueos de más de 50 ms${reposo.valido ? '' : ` (no vale: ${reposo.motivo})`}`
        : 'Reposo: sin medir',
  );
  lines.push(`Bloqueos medidos con: ${hasLongTasks ? 'la API de tareas largas' : 'una sonda de temporizador (este navegador no tiene la API de tareas largas)'}`);
  lines.push(`Medido en: ${automated() ? 'navegador automatizado, emulación' : 'navegador normal; di si es un móvil físico y cuál'}`);
  return lines;
}
