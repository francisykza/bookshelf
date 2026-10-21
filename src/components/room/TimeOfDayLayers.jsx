// Luz de la habitación por hora del día (SPEC §2.3): haces komorebi, sombras de hojas, velo dorado
// del atardecer y noche azul con huecos donde la lámpara colgante y las velas encienden su luz naranja.
import { DESK_CANDLE, HOTSPOTS, LAMP, LANTERN } from '../../scene/sceneMap';
import { bounds } from '../../scene/homography';
import { BEAMS } from './beams';

/** Dos sombras de hojas localizadas (sobre la cama y el suelo del balcón), cada una con su periodo. */
const LEAF_SHADES = [
  { x: 120, y: 1000, w: 420, h: 300, period: 21 },
  { x: 560, y: 900, w: 360, h: 260, period: 25 },
];

const laptop = bounds(HOTSPOTS.laptop.shape);

export function TimeOfDayLayers({ timeOfDay, lampOn = true, candleOn = true }) {
  return (
    <div className="tod" data-tod={timeOfDay} data-lamp={lampOn} data-candle={candleOn} aria-hidden="true">
      {/* Komorebi (SPEC §12.6): dos rayos que respiran por opacidad y dos sombras de hojas ya suavizadas */}
      <div className="tod__beams">
        {BEAMS.slice(0, 2).map((b, i) => (
          <span
            key={i}
            className="tod__beam"
            style={{
              left: b.x - b.w * 2.6,
              top: b.y - b.len / 2,
              width: b.w * 5.2,
              height: b.len,
              transform: `rotate(${(Math.atan2(b.dy, b.dx) * 180) / Math.PI - 90}deg)`,
              '--beam-period': `${16 + i * 3}s`,
              animationDelay: `${-i * 5}s`,
            }}
          />
        ))}
      </div>
      {LEAF_SHADES.map((l, i) => (
        <span key={i} className="tod__leafshade" style={{ left: l.x, top: l.y, width: l.w, height: l.h, '--leaf-period': `${l.period}s`, animationDelay: `${-i * 7}s` }} />
      ))}

      {/* Atardecer dorado: velo ámbar y rosa */}
      <div className="tod__sunset" />
      <div className="tod__sunset-warm" />

      {/* Noche de lectura: penumbra azul con las luces cálidas abiertas */}
      {/* Tinte nocturno general, sin máscara (una máscara que falla deja un rectángulo opaco) */}
      <div className="tod__night" />
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
