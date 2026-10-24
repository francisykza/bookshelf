// Luz de la habitación por hora del día (SPEC §2.3 y §16.7): velo dorado del atardecer y noche azul con el
// exterior de la puerta-ventana más oscuro que el interior, y halos cálidos solo sobre la lámpara de latón y la
// vela de la mesita, medidos en la ilustración nueva. Sin haces ni sombras de hojas heredadas (eran de la
// ilustración anterior) y sin máscaras: solo capas de color con opacidad.
import { CANDLE, EXTERIOR, LAMP, SCENE_H, SCENE_W, pts } from '../../scene/sceneMap';

export function TimeOfDayLayers({ timeOfDay, lampOn = true, candleOn = true }) {
  return (
    <div className="tod" data-tod={timeOfDay} data-lamp={lampOn} data-candle={candleOn} aria-hidden="true">
      {/* Atardecer dorado: velo ámbar y rosa */}
      <div className="tod__sunset" />
      <div className="tod__sunset-warm" />

      {/* Noche de lectura: tinte general y el exterior (cielo, bahía y balcón) más profundo */}
      <div className="tod__night" />
      <svg className="tod__night-sky" viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} width={SCENE_W} height={SCENE_H}>
        <polygon points={pts(EXTERIOR)} />
      </svg>

      {/* Luces apagadas: la bombilla y la llama pintadas se oscurecen */}
      <div className="tod__off tod__off--lamp" style={{ left: LAMP.x - 30, top: LAMP.y - 30, width: 60, height: 60 }} />
      <div className="tod__off tod__off--candle" style={{ left: CANDLE.x - 16, top: CANDLE.y - 14, width: 32, height: 36 }} />
      <div className="tod__glow tod__glow--lamp" style={{ left: LAMP.x - 200, top: LAMP.y - 120, width: 400, height: 420 }} />
      <div className="tod__glow tod__glow--bulb" style={{ left: LAMP.x - 34, top: LAMP.y - 30, width: 68, height: 60 }} />
      <div className="tod__glow tod__glow--candle" style={{ left: CANDLE.x - 90, top: CANDLE.y - 80, width: 180, height: 170 }} />
    </div>
  );
}
