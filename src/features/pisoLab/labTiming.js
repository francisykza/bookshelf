// Los tiempos del piloto, por fases. Sirve en cualquier navegador: no depende de la API de tareas largas, que Safari no tiene.
//
// Arranque (una vez por carga de página):
//   lectura de la biblioteca  leer y preparar lo guardado, dentro del arranque de la app
//   hasta el portal           desde que empezó a cargar la página hasta que el portal está montado
//
// Cada vez que se monta la habitación, una medida con su origen:
//   puerta    has tocado una puerta: cuenta desde ese toque; es la única que es una «Entrada»
//   recarga   se ha recargado la página estando dentro: cuenta desde el inicio de la página
//   vuelta    vuelves de Decorar a la habitación: cuenta desde que se vuelve a montar, nunca desde la puerta de antes
//
// Sus fases, una detrás de otra:
//   acercamiento  la animación del portal hasta que empieza a montarse (cero si no vienes de la puerta)
//   datos         traer el código de la escena
//   escena        construirla: geometrías, exterior de las ventanas y portadas (con su tope de espera)
//   interactuar   desde ahí hasta que un toque se atiende de verdad: dibujada y con el hilo principal libre
export const LIBRARY_START = 'piso-lab:biblioteca-inicio';
export const LIBRARY_END = 'piso-lab:biblioteca-fin';
export const FIRST_DRAW = 'piso-lab:primer-dibujo';

/** El hilo está libre cuando varias esperas seguidas de un temporizador cuestan menos que esto. */
const QUIET_MS = 50;
const QUIET_RUNS = 3;
const PROBE_MS = 10;
const PROBE_LIMIT_MS = 20000;

const round = (value) => (value == null ? null : Math.round(value));
let pressAt = null;
let portalMs = null;
let mounted = 0;
let current = null;
const last = { puerta: null, recarga: null, vuelta: null };

/** Se ha tocado una puerta. El clic que sigue al dedo no vuelve a poner el reloj en marcha. */
export function markPress({ repeat = false } = {}) {
  const now = performance.now();
  if (repeat && pressAt !== null && now - pressAt < 2000) return;
  pressAt = now;
}

export function markPortal() {
  if (portalMs === null) portalMs = performance.now();
}

function libraryMs() {
  const end = performance.getEntriesByName(LIBRARY_END).at(-1);
  const start = performance.getEntriesByName(LIBRARY_START).at(-1);
  return end && start ? end.startTime - start.startTime : null;
}

/** Empieza a montarse la habitación: decide de dónde cuenta y gasta el toque de la puerta. */
export function beginMount() {
  const now = performance.now();
  const kind = pressAt !== null ? 'puerta' : mounted === 0 ? 'recarga' : 'vuelta';
  current = { kind, from: kind === 'puerta' ? pressAt : kind === 'recarga' ? 0 : now, mountAt: now, hidden: document.visibilityState === 'hidden' };
  pressAt = null;
  mounted += 1;
  const measure = current;
  const hide = () => {
    if (document.visibilityState === 'hidden') measure.hidden = true;
  };
  document.addEventListener('visibilitychange', hide);
  measure.stopWatching = () => document.removeEventListener('visibilitychange', hide);
}

/** Se desmonta antes de cerrar la medida (en desarrollo, React monta dos veces): no gasta el toque de la puerta. */
export function cancelMount() {
  if (!current || current.closed) return;
  current.stopWatching();
  if (current.kind === 'puerta') pressAt = current.from;
  mounted -= 1;
  current = null;
}

export function markCode() {
  if (current) current.codeAt = performance.now();
}
export function markScene() {
  if (current) current.sceneAt = performance.now();
}

/** Espera a que un toque se pueda atender y da la medida por cerrada. */
export function markInteractive() {
  const measure = current;
  if (!measure) return;
  let good = 0;
  let firstGood = 0;
  const started = performance.now();
  const probe = () => {
    if (current !== measure) return;
    const asked = performance.now();
    setTimeout(() => {
      const now = performance.now();
      if (now - asked - PROBE_MS < QUIET_MS) {
        if (good === 0) firstGood = asked;
        good += 1;
      } else good = 0;
      if (good >= QUIET_RUNS || now - started > PROBE_LIMIT_MS) close(measure, good >= QUIET_RUNS ? firstGood : now);
      else probe();
    }, PROBE_MS);
  };
  requestAnimationFrame(() => requestAnimationFrame(probe));
}

function close(measure, at) {
  if (current !== measure) return;
  measure.closed = true;
  measure.stopWatching();
  const drawn = performance.getEntriesByName(FIRST_DRAW).at(-1)?.startTime;
  const result = {
    origen: measure.kind,
    total: round(at - measure.from),
    acercamiento: round(measure.mountAt - measure.from),
    datos: round((measure.codeAt ?? measure.mountAt) - measure.mountAt),
    escena: round((measure.sceneAt ?? measure.mountAt) - (measure.codeAt ?? measure.mountAt)),
    primerDibujo: drawn != null && drawn >= measure.mountAt ? round(drawn - measure.from) : null,
    interactuar: round(at - (measure.sceneAt ?? at)),
    oculta: measure.hidden,
  };
  last[measure.kind] = result;
  publish();
  // Las comprobaciones esperan a esto. «Entrada» es solo la de la puerta, y con la página oculta el número no vale nada
  if (measure.kind === 'puerta' && !measure.hidden) window.__pisoLabEntrada = result.total;
}

function publish() {
  window.__pisoLabTiempos = timings();
}

export function timings() {
  return { arranque: { hastaElPortal: round(portalMs), lecturaBiblioteca: round(libraryMs()) }, ...last };
}

function line(name, m) {
  if (!m) return null;
  const hidden = m.oculta ? ' (no vale: la página se ocultó)' : '';
  const door = m.origen === 'puerta' ? `puerta ${m.acercamiento}, ` : '';
  return `${name}: ${m.total} ms${hidden} (${door}datos ${m.datos}, escena ${m.escena}, interactuar ${m.interactuar})`;
}

/** Las líneas del medidor. Sin entrada todavía, lo dice en vez de enseñar un número que no toca. */
export function timingLines() {
  const t = timings();
  return [
    `Arranque: ${t.arranque.hastaElPortal ?? '–'} ms hasta el portal; biblioteca leída en ${t.arranque.lecturaBiblioteca ?? '–'} ms`,
    line('Entrada', t.puerta) ?? 'Entrada: sin medir (entra por la puerta)',
    line('Recarga dentro', t.recarga),
    line('Vuelta de Decorar', t.vuelta),
  ].filter(Boolean);
}

/** Para las pruebas. */
export function resetTimings() {
  pressAt = null;
  portalMs = null;
  mounted = 0;
  current = null;
  last.puerta = null;
  last.recarga = null;
  last.vuelta = null;
}
