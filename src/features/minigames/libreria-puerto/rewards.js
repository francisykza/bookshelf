// Adaptador de recompensas de DEMOSTRACIÓN para «La librería del puerto». No consume tickets reales, no concede figuras,
// no toca Supabase, la biblioteca, misiones, pity ni sincronización: todo vive en memoria y está rotulado «Demo».
//
// Flujo previsto para el futuro (aquí solo simulado): misiones → ticket dorado → acceso al reto mensual (con reintentos)
// → victoria → figura del mes. IMPORTANTE para una versión real: la victoria que anuncia el navegador NO es prueba
// suficiente. Consumir el ticket y conceder la figura tendrá que hacerlo el servidor (una función con RLS/seguridad en
// Supabase), validando el ticket, el mes, que la figura no se concedió ya y, si se quiere, la partida (por ejemplo,
// reproduciendo las colocaciones con estas mismas reglas). El juego solo informa; nunca concede.

export const MODES = {
  practica: { id: 'practica', label: 'Práctica', reward: false },
  reto: { id: 'reto', label: 'Reto mensual (demo)', reward: true },
};

/** Figura ilustrativa del reto mensual ficticio: no existe en el catálogo ni se guarda en ninguna parte. */
export const DEMO_REWARD = { id: 'demo-farolera', nombre: 'La Farolera del Puerto', etiqueta: 'Demo' };

/**
 * `createDemoAdapter({ month, onChange })`: un ticket dorado de demostración que desbloquea el reto del mes (sin gastarse
 * en cada intento) y una recompensa ilustrativa que se «concede» una sola vez por mes. `onChange(state)` informa a la
 * interfaz. Nada se persiste.
 */
export function createDemoAdapter({ month = 'demo-mes', onChange = () => {} } = {}) {
  const state = { tickets: 1, unlocked: false, attempts: 0, rewarded: false, month, log: [] };
  const emit = () => onChange({ ...state, log: [...state.log] });
  const note = (text) => {
    state.log = [`${new Date().toLocaleTimeString('es-ES')} · ${text}`, ...state.log].slice(0, 40);
  };
  return {
    get state() {
      return { ...state };
    },
    /** Usar el ticket dorado de demostración para abrir el reto del mes (no se gasta en los reintentos). */
    unlock() {
      if (state.unlocked) return true;
      if (state.tickets < 1) return false;
      state.unlocked = true;
      note('Ticket dorado (demo) usado: reto del mes abierto, con reintentos.');
      emit();
      return true;
    },
    /** Eventos del juego: { type: 'start' | 'exit' | 'win', mode, level, moves }. */
    handle(event) {
      if (event.type === 'start') {
        if (event.mode === 'reto') state.attempts += 1;
        note(`Inicio · ${MODES[event.mode]?.label ?? event.mode} · nivel ${event.level}`);
      } else if (event.type === 'exit') {
        note(`Salida · nivel ${event.level}`);
      } else if (event.type === 'win') {
        note(`Victoria · nivel ${event.level} en ${event.moves} movimientos`);
        if (event.mode === 'reto' && state.unlocked && !state.rewarded) {
          state.rewarded = true;
          note(`Recompensa ilustrativa: «${DEMO_REWARD.nombre}» (Demo). No se ha concedido nada real.`);
        }
      }
      emit();
    },
  };
}
