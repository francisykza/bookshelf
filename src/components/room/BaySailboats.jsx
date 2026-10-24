// Veleros ambientales de la bahía (SPEC §16, Anexo A), reutilizables en MAIN_ROOM y SOCIAL_ROOM. Viven en el
// lienzo de la ilustración (mismas coordenadas que la imagen) y se recortan con la máscara del agua medida en
// cada habitación: nunca cruzan costa, montes, pared, vegetación ni carpintería. Desplazamiento y cabeceo van en
// nodos distintos; los desfases son deterministas (sin azar por render). Sin canvas ni partículas.
//
// Contrato de «cita navegante» (Anexo A4): `quote` + `onOpenQuote`. En la Fase 1 no existe la función, así que
// ningún velero reclama atención ni es interactivo; en la Fase 2 solo el velero `sea.interactive` lo será.
import { useEffect, useState } from 'react';
import { boatPhase, insidePolygon, staticPoint } from '../../scene/sea';

/** Polígonos → `clip-path: path()` en px del lienzo (el contenedor empieza en el origen de la imagen). */
const clipPath = (polys) => `path('${polys.map((p) => `M${p.map(([x, y]) => `${x} ${y}`).join(' L')} Z`).join(' ')}')`;

/**
 * Destellos del agua (SPEC §19.6): puntos deterministas DENTRO de las regiones de agua (y la máscara los recorta de
 * todos modos); ciclos desfasados de 3–6 s y opacidad máxima 0,18. Nunca sobre tierra, marcos ni montes.
 */
function glintsFor(roomId, sea, count) {
  const out = [];
  for (let i = 0; out.length < count && i < count * 12; i += 1) {
    const poly = sea.water[i % sea.water.length];
    const xs = poly.map((p) => p[0]);
    const ys = poly.map((p) => p[1]);
    const x = Math.min(...xs) + boatPhase(`${roomId}-gx`, i) * (Math.max(...xs) - Math.min(...xs));
    const y = Math.min(...ys) + boatPhase(`${roomId}-gy`, i) * (Math.max(...ys) - Math.min(...ys));
    if (insidePolygon([x, y], poly) && insidePolygon([x - 5, y], poly) && insidePolygon([x + 5, y], poly)) out.push({ x, y, d: 3 + boatPhase(`${roomId}-gd`, i) * 3, w: 6 + (i % 3) * 2 });
  }
  return out;
}

function Sailboat({ size }) {
  const w = size;
  const h = size * 1.15;
  return (
    <svg className="sailboat__art" width={w} height={h} viewBox="0 0 20 23" aria-hidden="true">
      {/* Estela: un trazo corto y claro bajo el casco */}
      <path className="sailboat__wake" d="M1 21.6 Q10 23 19 21.6" />
      <path className="sailboat__hull" d="M3 19 L17 19 L14.5 21.2 L5.5 21.2 Z" />
      <path className="sailboat__sail-shade" d="M10.6 2 L10.6 17.6 L16.4 17.6 Z" />
      <path className="sailboat__sail" d="M9.6 1 L9.6 17.6 L3 17.6 Z" />
      <path className="sailboat__mast" d="M10.1 1 L10.1 19" />
    </svg>
  );
}

export function BaySailboats({ roomId, sea, active = true, reducedMotion = false, quote = null, onOpenQuote = null, count = 2 }) {
  // Pestaña oculta → pausa (además de la habitación inactiva o tapada por un modal)
  const [visible, setVisible] = useState(() => document.visibilityState === 'visible');
  useEffect(() => {
    const onVis = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);
  if (!sea?.lanes?.length) return null;
  const lanes = sea.lanes.slice(0, Math.min(3, Math.max(1, count)));
  const glints = glintsFor(roomId, sea, 10);
  const running = active && visible && !reducedMotion;
  // Fase 1: sin cita navegante no hay velero interactivo (se conserva el contrato para la Fase 2)
  const interactive = Boolean(quote && onOpenQuote);

  return (
    <div className="bay" data-room={roomId} data-running={running || undefined} data-reduced={reducedMotion || undefined} style={{ clipPath: clipPath(sea.water) }} aria-hidden={interactive ? undefined : 'true'}>
      {glints.map((g, i) => (
        <span key={`g${i}`} className="sea-glint" style={{ left: g.x - g.w / 2, top: g.y, width: g.w, animationDuration: `${g.d.toFixed(2)}s`, animationDelay: `${(-g.d * boatPhase(roomId, i + 7)).toFixed(2)}s` }} />
      ))}
      {lanes.map((lane, i) => {
        const t = boatPhase(roomId, i);
        const [sx, sy] = staticPoint(lane, t);
        return (
          <div
            key={i}
            className="sailboat"
            data-lane={i}
            style={{
              '--x0': `${lane.from[0] - lane.size / 2}px`,
              '--y0': `${lane.from[1] - lane.size * 1.15}px`,
              '--x1': `${lane.to[0] - lane.size / 2}px`,
              '--y1': `${lane.to[1] - lane.size * 1.15}px`,
              '--sx': `${sx - lane.size / 2}px`,
              '--sy': `${sy - lane.size * 1.15}px`,
              animationDelay: `${-(t * 110).toFixed(2)}s`,
            }}
          >
            <div className="sailboat__body" style={{ animationDelay: `${-(t * 7).toFixed(2)}s` }}>
              <Sailboat size={lane.size} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
