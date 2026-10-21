// Luz de la habitación por hora del día (SPEC §2.3): haces komorebi, sombras de hojas, velo dorado
// del atardecer y noche azul con huecos donde la lámpara colgante y las velas encienden su luz naranja.
import { DESK_CANDLE, HOTSPOTS, LAMP, LANTERN } from '../../scene/sceneMap';
import { useSvgIds } from '../../hooks/useSvgIds';
import { bounds } from '../../scene/homography';
import { BEAMS } from './beams';

const LEAVES = Array.from({ length: 26 }, (_, i) => {
  const r = (n) => {
    const v = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
    return v - Math.floor(v);
  };
  return { x: 40 + r(1) * 900, y: 860 + r(2) * 700, rx: 14 + r(3) * 26, ry: 6 + r(4) * 12, rot: r(5) * 180 };
});

const laptop = bounds(HOTSPOTS.laptop.shape);

/** Penumbra de noche con huecos solo donde hay luces encendidas. */
function nightMask(lampOn, candleOn) {
  const holes = [];
  if (lampOn) holes.push(`radial-gradient(circle 190px at ${LAMP.x}px ${LAMP.y + 40}px, transparent 0, rgba(0,0,0,0.55) 55%, #000 100%)`);
  if (candleOn) {
    holes.push(`radial-gradient(circle 120px at ${LANTERN.x}px ${LANTERN.y}px, transparent 0, rgba(0,0,0,0.5) 50%, #000 100%)`);
    holes.push(`radial-gradient(circle 80px at ${DESK_CANDLE.x}px ${DESK_CANDLE.y}px, transparent 0, #000 100%)`);
  }
  return holes.length ? holes.join(', ') : 'linear-gradient(#000, #000)';
}

export function TimeOfDayLayers({ timeOfDay, lampOn = true, candleOn = true }) {
  const sid = useSvgIds();
  const mask = nightMask(lampOn, candleOn);
  return (
    <div className="tod" data-tod={timeOfDay} data-lamp={lampOn} data-candle={candleOn} aria-hidden="true">
      {/* Komorebi: haces diagonales que respiran y sombras de hojas a la deriva */}
      <div className="tod__beams">
        {BEAMS.map((b, i) => (
          <span
            key={i}
            className="tod__beam"
            style={{
              left: b.x - b.w * 2.6,
              top: b.y - b.len / 2,
              width: b.w * 5.2,
              height: b.len,
              transform: `rotate(${(Math.atan2(b.dy, b.dx) * 180) / Math.PI - 90}deg)`,
              opacity: b.strength,
              animationDelay: `${-i * 2.3}s`,
            }}
          />
        ))}
      </div>
      <svg className="tod__leaves" viewBox="0 0 984 1599" width="984" height="1599">
        <defs>
          <filter id={sid('f-leaf-blur')} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
        </defs>
        <g filter={sid.url('f-leaf-blur')} className="tod__leaves-drift">
          {LEAVES.map((l, i) => (
            <ellipse key={i} cx={l.x} cy={l.y} rx={l.rx} ry={l.ry} transform={`rotate(${l.rot} ${l.x} ${l.y})`} />
          ))}
        </g>
      </svg>

      {/* Atardecer dorado: velo ámbar y rosa */}
      <div className="tod__sunset" />
      <div className="tod__sunset-warm" />

      {/* Noche de lectura: penumbra azul con las luces cálidas abiertas */}
      <div className="tod__night" style={{ WebkitMaskImage: mask, maskImage: mask, maskComposite: 'intersect', WebkitMaskComposite: 'source-in' }} />
      {/* Luces apagadas: la bombilla y la llama pintadas se oscurecen */}
      <div className="tod__off tod__off--lamp" style={{ left: LAMP.x - 46, top: LAMP.y - 46, width: 92, height: 92 }} />
      <div className="tod__off tod__off--lantern" style={{ left: LANTERN.x - 30, top: LANTERN.y - 34, width: 60, height: 64 }} />
      <div className="tod__off tod__off--candle" style={{ left: DESK_CANDLE.x - 22, top: DESK_CANDLE.y - 24, width: 44, height: 50 }} />
      <div className="tod__glow tod__glow--lamp" style={{ left: LAMP.x - 230, top: LAMP.y - 150, width: 460, height: 520 }} />
      <div className="tod__glow tod__glow--shelf" style={{ left: -60, top: 20, width: 360, height: 820 }} />
      <div className="tod__glow tod__glow--bulb" style={{ left: LAMP.x - 40, top: LAMP.y - 40, width: 80, height: 80 }} />
      <div className="tod__glow tod__glow--lantern" style={{ left: LANTERN.x - 150, top: LANTERN.y - 140, width: 300, height: 280 }} />
      <div className="tod__glow tod__glow--candle" style={{ left: DESK_CANDLE.x - 90, top: DESK_CANDLE.y - 90, width: 180, height: 180 }} />
      <div
        className="tod__glow tod__glow--screen"
        style={{ left: laptop.x - 40, top: laptop.y - 30, width: laptop.w + 80, height: laptop.h + 120 }}
      />
    </div>
  );
}
