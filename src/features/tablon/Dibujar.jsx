// La hoja para dibujar: unos lápices, Deshacer y Empezar de nuevo, y elegir si se deja la hoja o la forma recortada.
import { useEffect, useMemo, useRef, useState } from 'react';
import { COLOR_NOMBRES, COLORES, dibujoUrl, LADO, MAX_PUNTOS, MAX_TRAZOS, pintar, puntosDe } from './dibujo';

const ESCALA = 4;

/** El dibujo tal como queda clavado. */
export function DibujoPieza({ dibujo, recortado, alt = 'Dibujo', paper }) {
  return (
    <span className="tb-pieza" data-forma={recortado ? 'si' : undefined} style={!recortado && paper ? { background: paper } : undefined}>
      <img src={dibujoUrl(dibujo, recortado)} alt={alt} draggable="false" />
    </span>
  );
}

export function ElegirForma({ value, onChange }) {
  return (
    <div className="tb-dib-modo" role="group" aria-label="Cómo se deja">
      <button type="button" className="tb-btn" aria-pressed={!value} onClick={() => onChange(false)}>La hoja</button>
      <button type="button" className="tb-btn" aria-pressed={value} onClick={() => onChange(true)}>La forma</button>
    </div>
  );
}

export function Dibujar({ submitLabel, sending = false, disabled = false, children, onSubmit }) {
  const [trazos, setTrazos] = useState([]);
  const [color, setColor] = useState(0);
  const [forma, setForma] = useState(false);
  const canvas = useRef(null);
  const actual = useRef(null);
  const dibujo = useMemo(() => ({ v: 1, s: trazos }), [trazos]);
  const lleno = trazos.length >= MAX_TRAZOS || puntosDe(trazos) >= MAX_PUNTOS;

  useEffect(() => {
    const ctx = canvas.current.getContext('2d');
    ctx.clearRect(0, 0, LADO * ESCALA, LADO * ESCALA);
    pintar(ctx, trazos, ESCALA);
  }, [trazos]);

  const punto = (e) => {
    const r = canvas.current.getBoundingClientRect();
    const a = (v) => Math.max(0, Math.min(LADO, Math.round(v * LADO)));
    return [a((e.clientX - r.left) / r.width), a((e.clientY - r.top) / r.height)];
  };
  const down = (e) => {
    if (lleno || (e.button && e.pointerType === 'mouse')) return;
    canvas.current.setPointerCapture(e.pointerId);
    actual.current = { c: color, p: punto(e) };
    pintar(canvas.current.getContext('2d'), [actual.current], ESCALA);
  };
  const move = (e) => {
    const k = actual.current;
    if (!k || puntosDe(trazos) + k.p.length / 2 >= MAX_PUNTOS) return;
    const [x, y] = punto(e);
    const lx = k.p[k.p.length - 2];
    const ly = k.p[k.p.length - 1];
    if (x === lx && y === ly) return;
    k.p.push(x, y);
    pintar(canvas.current.getContext('2d'), [{ c: k.c, p: [lx, ly, x, y] }], ESCALA);
  };
  const up = () => {
    if (!actual.current) return;
    const k = actual.current;
    actual.current = null;
    setTrazos((t) => [...t, k]);
  };

  return (
    <div className="tb-form tb-dib">
      <canvas ref={canvas} className="tb-dib__hoja" width={LADO * ESCALA} height={LADO * ESCALA} role="img" aria-label="Hoja para dibujar con el dedo" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
      <div className="tb-dib__util">
        <div className="tb-dib__colores" role="group" aria-label="Lápiz">
          {COLORES.map((c, i) => <button key={c} type="button" className="tb-dot" style={{ background: c }} aria-label={COLOR_NOMBRES[i]} aria-pressed={color === i} onClick={() => setColor(i)} />)}
        </div>
        <button type="button" className="tb-btn" disabled={!trazos.length} onClick={() => setTrazos((t) => t.slice(0, -1))}>Deshacer</button>
        <button type="button" className="tb-btn" disabled={!trazos.length} onClick={() => setTrazos([])}>Empezar de nuevo</button>
      </div>
      {lleno && <p className="tb-note" role="status">La hoja está llena. Deshaz algún trazo para seguir.</p>}
      <ElegirForma value={forma} onChange={setForma} />
      <div className="tb-dib__corcho">
        {trazos.length ? <DibujoPieza dibujo={dibujo} recortado={forma} alt="Así quedará" paper="#F7EDD5" /> : <p>Aquí verás cómo queda</p>}
      </div>
      {children}
      <button type="button" className="tb-btn tb-btn--main" disabled={!trazos.length || sending || disabled} onClick={() => onSubmit({ dibujo, recortado: forma })}>{sending ? 'Enviando…' : submitLabel}</button>
    </div>
  );
}
