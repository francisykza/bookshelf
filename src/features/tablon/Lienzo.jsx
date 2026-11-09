// El lienzo del tablón: tarjetas e hilos libres sobre corcho. Los gestos se reciben en un único elemento y, mientras dura uno,
// el documento no cambia: la tarjeta se mueve con un parche temporal y al soltar se confirma una sola vez.
import { forwardRef, memo, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { anchorOf, centerOf, clampZoom, fitView, formatOf, localDelta, nearView, normalizeAngle, PAPERS, resized, SLOP, sortedItems, THREADS, toWorld, zoomAt } from './model';

const ASSET = '/assets/puerto/tablon';

const Card = memo(function Card({ item, selected, organizing, zoom, source }) {
  const format = formatOf(item);
  const n = item.body.length;
  const style = { left: item.x, top: item.y, width: item.width, height: item.height, transform: `rotate(${item.rotation}deg)`, '--paper': PAPERS[item.paper], '--sheet': `url(${ASSET}/paper-${item.paper}.svg)` };
  return (
    <div className={`tb-card${selected ? ' is-selected' : ''}${source ? ' is-source' : ''}`} data-item={item.id} data-kind={item.kind} data-format={format} data-long={n > 110 ? 'largo' : n > 50 ? 'medio' : undefined} data-oculta={item.spoiler && !item.retirada ? 'si' : undefined} style={style}>
      <div className="tb-card__paper" />
      <div className="tb-card__in">
        {item.retirada ? (
          <p className="tb-card__gone">Nota retirada</p>
        ) : item.spoiler ? (
          <p className="tb-card__spoiler">Spoiler. Toca para leerlo</p>
        ) : (
          <>
            {item.kind === 'book' && (item.cover ? <img className="tb-card__cover" src={item.cover} alt="" draggable="false" loading="lazy" /> : <div className="tb-card__spine" aria-hidden="true" />)}
            <p className="tb-card__body">{item.body}</p>
            {item.caption && <small className="tb-card__caption">{item.caption}</small>}
            {item.firma && <small className="tb-card__caption">De {item.firma}</small>}
          </>
        )}
      </div>
      <img className="tb-card__pin" src={`${ASSET}/pin-${item.pin}.svg`} alt="" draggable="false" />
      {item.sticker && <img className="tb-card__sticker" src={`${ASSET}/sticker-${item.sticker}.svg`} alt="" draggable="false" />}
      {selected && organizing && (
        <>
          <span className="tb-handle tb-handle--size" data-handle="size" style={{ '--h': 44 / zoom + 'px' }} aria-hidden="true" />
          <span className="tb-handle tb-handle--turn" data-handle="turn" style={{ '--h': 44 / zoom + 'px' }} aria-hidden="true" />
        </>
      )}
    </div>
  );
});

function edgePath(a, b) {
  const sag = Math.min(46, Math.hypot(b.x - a.x, b.y - a.y) * 0.12);
  return `M${a.x} ${a.y} Q${(a.x + b.x) / 2} ${(a.y + b.y) / 2 + sag} ${b.x} ${b.y}`;
}

const NO_VIEW = { x: 0, y: 0, zoom: 1 };

/**
 * `mode`: 'ver' (nunca modifica), 'organizar' o 'conectar'. `onChange(id, patch)` se llama una vez, al terminar el gesto.
 * Con `readOnly` no hay más modo que mirar. La vista se conserva en el componente y `ref` da `fit()` y `zoomBy(k)`.
 */
export const Lienzo = forwardRef(function Lienzo({ doc, mode, readOnly = false, selected, selectedEdge, connectFrom, onTapItem, onTapEdge, onTapEmpty, onChange, label }, ref) {
  const host = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState(NO_VIEW);
  const viewRef = useRef(view);
  viewRef.current = view;
  const [patch, setPatchState] = useState(null);
  const patchRef = useRef(null);
  const setPatch = (v) => {
    patchRef.current = v;
    setPatchState(v);
  };
  const [fitted, setFitted] = useState(false);
  const pointers = useRef(new Map());
  const gesture = useRef(null);
  const space = useRef(false);
  const docRef = useRef(doc);
  docRef.current = doc;
  const handlers = useRef({});
  handlers.current = { onTapItem, onTapEdge, onTapEmpty, onChange, mode, readOnly };

  const fit = () => {
    const r = host.current.getBoundingClientRect();
    if (r.width && r.height) setView(fitView(docRef.current.items, r.width, r.height));
  };
  useImperativeHandle(ref, () => ({
    fit,
    zoomBy: (k) => {
      const r = host.current.getBoundingClientRect();
      setView((v) => zoomAt(v, { x: r.width / 2, y: r.height / 2 }, v.zoom * k));
    },
    center: () => {
      const r = host.current.getBoundingClientRect();
      return toWorld(viewRef.current, { x: r.width / 2, y: r.height / 2 });
    },
    view: () => viewRef.current,
  }));

  useEffect(() => {
    const node = host.current;
    const read = () => {
      const r = node.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
    };
    read();
    const watcher = new ResizeObserver(read);
    watcher.observe(node);
    return () => watcher.disconnect();
  }, []);
  useEffect(() => {
    if (size.w && !fitted) {
      fit();
      setFitted(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.w, fitted]);

  // Rueda: zoom hacia el puntero. Tiene que ser no pasivo para que la página no se mueva
  useEffect(() => {
    const node = host.current;
    const onWheel = (e) => {
      e.preventDefault();
      const r = node.getBoundingClientRect();
      setView((v) => zoomAt(v, { x: e.clientX - r.left, y: e.clientY - r.top }, v.zoom * Math.exp(-e.deltaY * 0.0015)));
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, []);

  const reset = () => {
    pointers.current.clear();
    gesture.current = null;
    setPatch(null);
  };
  useEffect(() => {
    const down = (e) => {
      if (e.code === 'Space' && !/INPUT|TEXTAREA|SELECT|BUTTON/.test(e.target.tagName)) {
        space.current = true;
        e.preventDefault();
      }
    };
    const up = (e) => {
      if (e.code === 'Space') space.current = false;
    };
    const blur = () => {
      space.current = false;
      reset();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);
  // Cambiar de modo a mitad de un gesto lo cancela
  useEffect(reset, [mode]);

  const local = (e) => {
    const r = host.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const startPinch = () => {
    const [a, b] = [...pointers.current.values()];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    gesture.current = { type: 'pinch', dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom: viewRef.current.zoom, world: toWorld(viewRef.current, mid) };
    setPatch(null);
  };
  const onDown = (e) => {
    if (e.button) return;
    const p = local(e);
    host.current.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 2) return startPinch();
    if (pointers.current.size > 2) return undefined;
    const t = e.target;
    const handle = t.closest?.('[data-handle]')?.dataset.handle ?? null;
    const itemId = t.closest?.('[data-item]')?.dataset.item ?? null;
    const edgeId = t.closest?.('[data-edge]')?.dataset.edge ?? null;
    gesture.current = { type: 'press', start: p, view: viewRef.current, handle, itemId, edgeId, id: e.pointerId, moved: false, item: itemId ? docRef.current.items.find((i) => i.id === itemId) : null, pan: space.current };
    return undefined;
  };
  const onMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    const g = gesture.current;
    if (!g) return;
    if (g.type === 'pinch') {
      const [a, b] = [...pointers.current.values()];
      if (!b) return;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const zoom = clampZoom((g.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / g.dist);
      setView({ zoom, x: g.world.x - mid.x / zoom, y: g.world.y - mid.y / zoom });
      return;
    }
    if (e.pointerId !== g.id) return;
    const dx = p.x - g.start.x;
    const dy = p.y - g.start.y;
    if (!g.moved && Math.hypot(dx, dy) <= SLOP) return;
    g.moved = true;
    const { mode: m, readOnly: ro } = handlers.current;
    const organizing = m === 'organizar' && !ro && !g.pan;
    const item = g.item;
    const zoom = g.view.zoom;
    if (organizing && item && g.handle === 'size') {
      const d = localDelta(item, dx / zoom, dy / zoom);
      setPatch({ id: item.id, ...resized(item, item.width + d.x, item.height + d.y) });
    } else if (organizing && item && g.handle === 'turn') {
      const w = toWorld(viewRef.current, p);
      const c = centerOf(item);
      setPatch({ id: item.id, rotation: normalizeAngle((Math.atan2(w.y - c.y, w.x - c.x) * 180) / Math.PI + 90) });
    } else if (organizing && item) {
      setPatch({ id: item.id, x: item.x + dx / zoom, y: item.y + dy / zoom });
    } else {
      setView({ zoom, x: g.view.x - dx / zoom, y: g.view.y - dy / zoom });
    }
  };
  const onUp = (e) => {
    if (!pointers.current.delete(e.pointerId)) return;
    const g = gesture.current;
    if (g?.type === 'pinch') {
      // El dedo que queda no empieza otro gesto: hay que levantarlo
      if (pointers.current.size < 2) gesture.current = pointers.current.size ? { type: 'idle' } : null;
      return;
    }
    if (!g || g.type !== 'press' || e.pointerId !== g.id) return;
    gesture.current = null;
    if (g.moved) {
      const cur = patchRef.current;
      if (cur) {
        const { id, ...rest } = cur;
        handlers.current.onChange?.(id, rest);
      }
      setPatch(null);
      return;
    }
    const h = handlers.current;
    if (g.itemId) h.onTapItem?.(g.itemId);
    else if (g.edgeId) h.onTapEdge?.(g.edgeId);
    else h.onTapEmpty?.();
  };
  const onCancel = (e) => {
    pointers.current.delete(e.pointerId);
    if (!pointers.current.size) {
      gesture.current = null;
      setPatch(null);
    }
  };

  const items = useMemo(() => {
    if (!patch) return doc.items;
    const { id, ...rest } = patch;
    return doc.items.map((i) => (i.id === id ? { ...i, ...rest } : i));
  }, [doc.items, patch]);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const visible = useMemo(() => (size.w ? sortedItems(nearView(items, view, size.w, size.h, selected)) : []), [items, view, size, selected]);
  const near = useMemo(() => new Set(visible.map((i) => i.id)), [visible]);
  const edges = doc.edges.filter((e) => near.has(e.source_item_id) || near.has(e.target_item_id));
  const organizing = mode === 'organizar' && !readOnly;

  return (
    <div ref={host} className="tb-map" data-mode={readOnly ? 'lectura' : mode} data-items={visible.length} role="application" aria-label={label} style={{ backgroundSize: `${240 * view.zoom}px`, backgroundPosition: `${-view.x * view.zoom}px ${-view.y * view.zoom}px` }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onCancel} onLostPointerCapture={onCancel}>
      <div className="tb-world" style={{ transform: `translate(${-view.x * view.zoom}px, ${-view.y * view.zoom}px) scale(${view.zoom})` }}>
        <svg className="tb-threads" width="1" height="1" aria-hidden="true">
          {edges.map((e) => {
            const s = byId.get(e.source_item_id);
            const t = byId.get(e.target_item_id);
            if (!s || !t) return null;
            const a = anchorOf(s, e.source_anchor);
            const b = anchorOf(t, e.target_anchor);
            const d = edgePath(a, b);
            return (
              <g key={e.id} data-edge={e.id} className={selectedEdge === e.id ? 'is-selected' : undefined}>
                <path d={d} className="tb-thread__hit" style={{ strokeWidth: 22 / view.zoom }} />
                <path d={d} className="tb-thread__shadow" />
                <path d={d} className="tb-thread" stroke={THREADS[e.color]} />
                {e.label && (
                  <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 8} textAnchor="middle" className="tb-thread__label">
                    {e.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {visible.map((i) => (
          <Card key={i.id} item={i} selected={selected === i.id} organizing={organizing} zoom={view.zoom} source={connectFrom === i.id} />
        ))}
      </div>
    </div>
  );
});
