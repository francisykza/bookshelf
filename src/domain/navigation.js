// Navegación con historial real (SPEC §13.3, 1.19.0). Cada ubicación es un estado serializable
// `{ view: 'room' | 'shelf', panel: null | { type, id?, tab?, section?, select? } }`. La lógica es pura y recibe el
// objeto `history`, así que se prueba sin navegador: la entrada inicial se registra con replaceState, cada
// destino interno añade una entrada, `popstate` restaura sin volver a apilar, y Atrás desde la raíz es del
// navegador (no hay entradas trampa).

export const ROOT = Object.freeze({ view: 'room', panel: null });
const KEY = 'bookshelf';

const PANEL_FIELDS = ['type', 'id', 'tab', 'section', 'select'];

/** Solo los campos serializables y conocidos (nada de objetos de libros ni funciones). */
export function normalizeLocation(loc) {
  const view = loc?.view === 'shelf' ? 'shelf' : 'room';
  const p = loc?.panel;
  if (!p || typeof p.type !== 'string') return { view, panel: null };
  const panel = {};
  for (const k of PANEL_FIELDS) if (p[k] != null && (typeof p[k] === 'string' || typeof p[k] === 'number')) panel[k] = p[k];
  return { view, panel };
}

export const sameLocation = (a, b) => JSON.stringify(normalizeLocation(a)) === JSON.stringify(normalizeLocation(b));

/** Destino seguro al cerrar algo abierto sin padre conocido (recarga, URL directa). */
export function safeParent(loc) {
  const l = normalizeLocation(loc);
  if (l.panel?.type === 'vault' && l.panel.section === 'unbox') return { view: l.view, panel: { type: 'vault', id: l.panel.id } };
  if (l.panel) return { view: l.view, panel: null };
  if (l.view === 'shelf') return ROOT;
  return null;
}

const readEntry = (state) => (state && state[KEY]?.loc ? state[KEY] : null);
const entry = (loc, depth, parent) => ({ [KEY]: { loc: normalizeLocation(loc), depth, parent: parent ? normalizeLocation(parent) : null } });

/**
 * Crea el navegador sobre `history`. `onChange(loc)` se llama cada vez que cambia la ubicación (también en
 * `pop`). Devuelve { current, go, back, pop }.
 */
export function createNavigator(history, onChange = () => {}) {
  let cur = readEntry(history.state);
  if (!cur) {
    const initial = entry(ROOT, 0, null);
    // Conserva lo que hubiera en el estado de la entrada (otras librerías) y registra la ubicación inicial
    history.replaceState({ ...(history.state ?? {}), ...initial }, '');
    cur = initial[KEY];
  }
  return {
    current: () => cur.loc,
    depth: () => cur.depth,
    /** Ir a un destino interno. Si ya es el padre de la entrada actual, equivale a Atrás. */
    go(to, { replace = false } = {}) {
      const loc = normalizeLocation(to);
      if (sameLocation(loc, cur.loc)) return;
      if (!replace && cur.depth > 0 && cur.parent && sameLocation(loc, cur.parent)) {
        history.back();
        return;
      }
      const next = replace ? entry(loc, cur.depth, cur.parent) : entry(loc, cur.depth + 1, cur.loc);
      if (replace) history.replaceState(next, '');
      else history.pushState(next, '');
      cur = next[KEY];
      onChange(cur.loc);
    },
    /** Volver: por el historial si hay una entrada interna anterior; si no, reemplazando por el destino seguro. */
    back() {
      if (cur.depth > 0) {
        history.back();
        return;
      }
      const parent = safeParent(cur.loc);
      if (!parent) return;
      const next = entry(parent, 0, null);
      history.replaceState(next, '');
      cur = next[KEY];
      onChange(cur.loc);
    },
    /** `popstate`: restaura el destino de la entrada sin apilar nada. */
    pop(state) {
      cur = readEntry(state) ?? entry(ROOT, 0, null)[KEY];
      onChange(cur.loc);
    },
  };
}
