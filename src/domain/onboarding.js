// Onboarding diegético (SPEC §16, Anexo B): máquina de estados explícita y almacenamiento seguro. Sin React.
// idle → welcome → reading → habits → social → gift → completed; «Saltar guía» desde cualquier parada.
// Las paradas se habilitan por fase: en la Fase 1 solo bienvenida, lectura y rituales (social y regalo quedan
// registradas como pendientes y no se mencionan). La clave de finalización es local a este navegador.

export const ONBOARDING_KEY = 'bookshelf_onboarding_done';
/** Fase del producto desplegada: decide qué paradas existen. */
export const CURRENT_PHASE = 1;

export const STATES = ['idle', 'welcome', 'reading', 'habits', 'social', 'gift', 'completed'];

export const STOPS = {
  welcome: {
    phase: 1,
    anchor: 'book',
    secondary: [],
    title: 'Bienvenido a tu refugio de lectura',
    text: 'Aquí tus libros, tus pequeños rituales y las historias compartidas encuentran su lugar.',
  },
  reading: {
    phase: 1,
    anchor: 'book',
    secondary: ['shelf', 'figures'],
    title: 'Lectura y colección',
    text: 'Registra tu lectura desde el libro abierto. En las baldas encontrarás tu biblioteca y tus figuras.',
  },
  habits: {
    phase: 1,
    anchor: 'laptop',
    secondary: ['tray'],
    title: 'Rituales',
    text: 'Consulta tu calendario y tu racha en el portátil. Toca el té para dedicar un rato tranquilo a leer.',
  },
  // Fase 2 (pendiente): «Tu refugio continúa al otro lado. Vamos al Salón Social.»
  social: { phase: 2, anchor: 'tablet', secondary: [], title: 'Salón Social', text: 'Tu refugio continúa al otro lado. Vamos al Salón Social.' },
  // Fase 3 (pendiente): «Tu primera sorpresa te espera en el Ático.»
  gift: { phase: 3, anchor: 'figures', secondary: [], title: 'Tu primera sorpresa', text: 'Tu primera sorpresa te espera en el Ático.' },
};

/** Paradas disponibles en una fase, en orden. */
export const route = (phase = CURRENT_PHASE) => ['welcome', 'reading', 'habits', 'social', 'gift'].filter((s) => STOPS[s].phase <= phase);

/** ¿Es una parada visible? */
export const isStop = (state, phase = CURRENT_PHASE) => route(phase).includes(state);

/** Siguiente estado: desde `idle` empieza; tras la última parada disponible, `completed`. */
export function next(state, phase = CURRENT_PHASE) {
  const stops = route(phase);
  if (state === 'idle' || state === 'completed') return 'welcome';
  const i = stops.indexOf(state);
  if (i < 0) return 'completed';
  return stops[i + 1] ?? 'completed';
}

/** Estado anterior (la bienvenida no tiene atrás). */
export function back(state, phase = CURRENT_PHASE) {
  const stops = route(phase);
  const i = stops.indexOf(state);
  return i > 0 ? stops[i - 1] : state;
}

/** ¿Es la última parada disponible? */
export const isLast = (state, phase = CURRENT_PHASE) => route(phase).at(-1) === state;

/**
 * Almacén de finalización con respaldo en memoria: si `localStorage` está bloqueado o lanza, la guía sigue
 * funcionando durante la sesión y la app abre igual.
 */
export function createDoneStore(getStorage = () => globalThis.localStorage) {
  let memory = false;
  return {
    isDone() {
      try {
        return getStorage()?.getItem(ONBOARDING_KEY) === 'true' || memory;
      } catch {
        return memory;
      }
    },
    markDone() {
      memory = true;
      try {
        getStorage()?.setItem(ONBOARDING_KEY, 'true');
        return true;
      } catch {
        return false;
      }
    },
  };
}
