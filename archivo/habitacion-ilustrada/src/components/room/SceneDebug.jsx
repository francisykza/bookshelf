// Diagnóstico de escena (SPEC §16.9), solo en desarrollo y con `?sceneDebug=1`: rejilla de coordenadas de la
// ilustración, polígonos de hotspots con su id y ancla, dimensiones intrínsecas, escala y desplazamientos,
// rectángulo visible tras el recorte y la coordenada de imagen bajo el puntero. No modifica datos ni persiste
// nada; usa exactamente la misma transformación que el escenario (`stageTransform`).
import { useEffect, useState } from 'react';
import { HOTSPOTS, ROOM_SHELVES, pts } from '../../scene/sceneMap';
import { stageTransform, toImage } from '../../scene/stageFit';

const STEP = 50;

export default function SceneDebug({ room, fit, stageRef }) {
  const [pointer, setPointer] = useState(null);
  useEffect(() => {
    const node = stageRef.current;
    if (!node) return undefined;
    const move = (event) => {
      const r = node.getBoundingClientRect();
      setPointer(toImage(fit, event.clientX - r.left, event.clientY - r.top));
    };
    node.addEventListener('pointermove', move);
    return () => node.removeEventListener('pointermove', move);
  }, [fit, stageRef]);

  const main = room.id === 'MAIN_ROOM';
  const v = fit.visible;
  const lines = [];
  for (let x = 0; x <= room.width; x += STEP) lines.push(<line key={`x${x}`} x1={x} y1={0} x2={x} y2={room.height} data-major={x % 100 === 0 || undefined} />);
  for (let y = 0; y <= room.height; y += STEP) lines.push(<line key={`y${y}`} x1={0} y1={y} x2={room.width} y2={y} data-major={y % 100 === 0 || undefined} />);

  return (
    <div className="scene-debug" aria-hidden="true">
      <svg className="scene-debug__svg" width={room.width} height={room.height} viewBox={`0 0 ${room.width} ${room.height}`} style={{ transform: stageTransform(fit) }}>
        <g className="scene-debug__grid">{lines}</g>
        {Array.from({ length: Math.floor(room.width / 100) + 1 }, (_, i) => (
          <text key={`tx${i}`} x={i * 100 + 3} y={14}>
            {i * 100}
          </text>
        ))}
        {Array.from({ length: Math.floor(room.height / 100) + 1 }, (_, i) => (
          <text key={`ty${i}`} x={3} y={i * 100 - 3}>
            {i * 100}
          </text>
        ))}
        {main &&
          Object.entries(HOTSPOTS).map(([id, h]) => (
            <g key={id} className="scene-debug__spot">
              <polygon points={pts(h.shape)} />
              <circle cx={h.label.x} cy={h.label.y} r={5} />
              <text x={h.label.x + 8} y={h.label.y - 6}>
                {id}
              </text>
            </g>
          ))}
        {main &&
          ROOM_SHELVES.map((s) => (
            <g key={s.id} className="scene-debug__shelf">
              <polygon points={pts(s.quad)} />
              <text x={s.quad[0][0] + 4} y={s.quad[0][1] + 14}>
                {s.id}
              </text>
            </g>
          ))}
        <rect className="scene-debug__visible" x={v.x} y={v.y} width={v.w} height={v.h} />
      </svg>
      <dl className="scene-debug__info">
        <dt>Habitación</dt>
        <dd>{room.id}</dd>
        <dt>Imagen</dt>
        <dd>
          {room.width} × {room.height}
        </dd>
        <dt>Escala</dt>
        <dd>{fit.scale.toFixed(4)}</dd>
        <dt>Desplazamiento</dt>
        <dd>
          {fit.offsetX.toFixed(1)}, {fit.offsetY.toFixed(1)}
        </dd>
        <dt>Visible</dt>
        <dd>
          x {v.x.toFixed(0)}–{(v.x + v.w).toFixed(0)} · y {v.y.toFixed(0)}–{(v.y + v.h).toFixed(0)}
        </dd>
        <dt>Puntero</dt>
        <dd>{pointer ? `${pointer.x.toFixed(0)}, ${pointer.y.toFixed(0)}` : '—'}</dd>
      </dl>
    </div>
  );
}
