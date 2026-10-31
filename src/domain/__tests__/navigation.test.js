// Pruebas de navegación, recompensas y transiciones (SPEC §13): historial sin entradas duplicadas,
// restauración de vista y panel, intento de unboxing idempotente con consumo único y transiciones interrumpidas.
import { describe, expect, it } from 'vitest';
import { EMPTY_FIGURES, markUnboxSeen, openBoxAttempt } from '../figures';
import { ROOT, createNavigator, safeParent } from '../navigation';
import { ENTERING, LEAVING, ROOM, SHELF, request, settle } from '../../hooks/useShelfTransition';

/** Historial de navegador en memoria: pila de entradas y `back()` que dispara `popstate`. */
function fakeHistory() {
  const h = {
    stack: [null],
    index: 0,
    onpop: null,
    get state() {
      return h.stack[h.index];
    },
    get length() {
      return h.stack.length;
    },
    pushState(state) {
      h.stack = h.stack.slice(0, h.index + 1);
      h.stack.push(state);
      h.index += 1;
    },
    replaceState(state) {
      h.stack[h.index] = state;
    },
    back() {
      if (h.index === 0) {
        h.left = true;
        return;
      }
      h.index -= 1;
      h.onpop?.(h.stack[h.index]);
    },
  };
  return h;
}

function setup() {
  const history = fakeHistory();
  const seen = [];
  const nav = createNavigator(history, (loc) => seen.push(loc));
  history.onpop = (state) => nav.pop(state);
  return { history, nav, seen };
}

describe('historial', () => {
  it('registra la ubicación inicial sin añadir entradas', () => {
    const { history, nav } = setup();
    expect(history.length).toBe(1);
    expect(nav.current()).toEqual(ROOT);
  });

  it('librería → libro → Atrás → librería → Atrás → habitación', () => {
    const { history, nav } = setup();
    nav.go({ view: 'shelf', panel: null });
    nav.go({ view: 'shelf', panel: { type: 'book', id: 'circe' } });
    expect(history.length).toBe(3);
    nav.back();
    expect(nav.current()).toEqual({ view: 'shelf', panel: null });
    nav.back();
    expect(nav.current()).toEqual(ROOT);
    expect(history.left).toBeUndefined();
  });

  it('ir dos veces al mismo destino no duplica la entrada', () => {
    const { history, nav } = setup();
    nav.go({ view: 'room', panel: { type: 'laptop' } });
    nav.go({ view: 'room', panel: { type: 'laptop' } });
    expect(history.length).toBe(2);
  });

  it('ir al padre de la entrada actual equivale a Atrás', () => {
    const { history, nav } = setup();
    nav.go({ view: 'shelf', panel: { type: 'vault', id: 'dama' } });
    nav.go({ view: 'shelf', panel: { type: 'vault', id: 'dama', section: 'unbox' } });
    nav.go({ view: 'shelf', panel: { type: 'vault', id: 'dama' } });
    expect(history.index).toBe(1);
    expect(nav.current().panel.section).toBeUndefined();
  });

  it('desde la raíz, Atrás es del navegador (sin trampa)', () => {
    const { history, nav } = setup();
    nav.back();
    expect(history.length).toBe(1);
    expect(nav.current()).toEqual(ROOT);
  });

  it('restaura vista y panel tras recargar en una entrada interna', () => {
    const { history, nav } = setup();
    nav.go({ view: 'shelf', panel: null });
    nav.go({ view: 'shelf', panel: { type: 'book', id: 'circe' } });
    const reloaded = createNavigator(history);
    expect(reloaded.current()).toEqual({ view: 'shelf', panel: { type: 'book', id: 'circe' } });
  });

  it('sin padre interno, Cerrar reemplaza por el destino seguro en vez de salir', () => {
    const history = fakeHistory();
    history.replaceState({ bookshelf: { loc: { view: 'shelf', panel: { type: 'book', id: 'x' } }, depth: 0, parent: null } });
    const nav = createNavigator(history);
    nav.back();
    expect(history.left).toBeUndefined();
    expect(nav.current()).toEqual({ view: 'shelf', panel: null });
    expect(safeParent({ view: 'shelf', panel: { type: 'vault', section: 'unbox' } }).panel).toEqual({ type: 'vault' });
  });

  it('no guarda en el historial más que campos serializables', () => {
    const { history, nav } = setup();
    nav.go({ view: 'shelf', panel: { type: 'book', id: 'circe', book: { title: 'Circe' }, fn: () => {} } });
    expect(Object.keys(history.state.bookshelf.loc.panel)).toEqual(['type', 'id']);
  });
});

describe('intento de unboxing', () => {
  const figs = [
    { id: 'a', rarity: 'rare', parts: [{}, {}, {}] },
    { id: 'b', rarity: 'epic', parts: [{}, {}] },
  ];
  const base = { ...EMPTY_FIGURES, owned: { a: { display: 'box', parts: [0], obtainedAt: 'x' } }, guardian: 'a', boxes: 2 };

  it('consume una sola caja aunque el mismo intento se repita', () => {
    const once = openBoxAttempt(base, figs, [0.9, 0.2, 0.3, 0.4], 'intento-1', 't');
    const twice = openBoxAttempt(once, figs, [0.01, 0.01, 0.01], 'intento-1', 't');
    expect(once.boxes).toBe(1);
    expect(twice).toBe(once);
    expect(twice.unbox.reward).toEqual(once.unbox.reward);
  });

  it('dos intentos distintos consumen dos cajas y no hay tercero sin cajas', () => {
    const one = openBoxAttempt(base, figs, [0.9, 0.2, 0.3], 'i1', 't');
    const two = openBoxAttempt(one, figs, [0.9, 0.2, 0.3], 'i2', 't');
    const three = openBoxAttempt(two, figs, [0.9, 0.2, 0.3], 'i3', 't');
    expect(two.boxes).toBe(0);
    expect(three).toBe(two);
  });

  it('el resultado confirmado queda guardado hasta que se ve', () => {
    const opened = openBoxAttempt(base, figs, [0.9, 0.2, 0.3], 'i1', 't');
    expect(opened.unbox).toMatchObject({ id: 'i1', seen: false });
    const seen = markUnboxSeen(opened, 'i1');
    expect(seen.unbox.seen).toBe(true);
    expect(seen.boxes).toBe(opened.boxes);
    expect(markUnboxSeen(seen, 'otro')).toBe(seen);
  });

  it('una pieza informa del rango anterior y el nuevo', () => {
    const opened = openBoxAttempt({ ...base, pity: { relic: 5, figure: 0 } }, figs, [0.9, 0.1, 0.1, 0.1, 0.1], 'p', 't');
    expect(opened.unbox.reward.type).toBe('part');
    expect(opened.unbox.reward.rank.after).toBeGreaterThanOrEqual(opened.unbox.reward.rank.before);
  });
});

describe('transiciones interrumpidas', () => {
  it('invertir a mitad de la entrada no se atasca', () => {
    let p = request(ROOM, SHELF);
    expect(p).toBe(ENTERING);
    p = request(p, ROOM);
    expect(p).toBe(LEAVING);
    p = request(p, SHELF);
    expect(p).toBe(ENTERING);
    expect(settle(p)).toBe(SHELF);
  });

  it('repetir la misma petición no reinicia la transición', () => {
    expect(request(ENTERING, SHELF)).toBe(ENTERING);
    expect(request(LEAVING, ROOM)).toBe(LEAVING);
    expect(request(SHELF, SHELF)).toBe(SHELF);
  });

  it('con movimiento reducido o pestaña oculta el cambio es directo', () => {
    expect(request(ROOM, SHELF, true)).toBe(SHELF);
    expect(request(SHELF, ROOM, true)).toBe(ROOM);
  });
});

describe('origen de la visita (1.62)', () => {
  it('la habitación conserva de dónde se vino y, sin padre, se vuelve allí', () => {
    expect(safeParent({ view: 'room', panel: { type: 'visit', id: 'u', section: 'habitacion', select: 'libros/k', from: 'salon' } }).panel).toEqual({ type: 'visit', id: 'u', section: 'habitacion', select: 'libros', from: 'salon' });
    expect(safeParent({ view: 'room', panel: { type: 'visit', id: 'u', section: 'habitacion', select: 'leyendo', from: 'lectores' } }).panel).toEqual({ type: 'visit', id: 'u', section: 'habitacion', from: 'lectores' });
    expect(safeParent({ view: 'room', panel: { type: 'visit', id: 'u', from: 'salon' } }).panel).toBeNull();
    expect(safeParent({ view: 'room', panel: { type: 'visit', id: 'u', from: 'lectores' } }).panel).toEqual({ type: 'social', tab: 'lectores' });
  });
});
