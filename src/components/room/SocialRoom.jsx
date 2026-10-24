// SOCIAL_ROOM (SPEC §16.1, Fase 1): solo la ilustración del salón en su escenario cover. Sin datos sociales,
// sin botones sobre la tablet, el cuadro ni los sillones (llegan en fases posteriores). Si la imagen falla, se
// dice y se puede reintentar; el regreso a MAIN_ROOM sigue disponible en la navegación del panorama.
import { ROOMS } from '../../scene/sceneMap';
import { BaySailboats } from './BaySailboats';
import { SceneBase } from './SceneBase';
import { SceneStage } from './SceneStage';

export function SocialRoom({ status, onRetry, attempt = 0, active = false, reducedMotion = false }) {
  return (
    <SceneStage
      room={ROOMS.SOCIAL_ROOM}
      className="scene-stage--social"
      overlay={() =>
        status === 'error' ? (
          <div className="scene-error paper-sheet" role="alert">
            <p>No se ha podido cargar la ilustración del Salón Social.</p>
            <button type="button" className="scene-error__retry" onClick={onRetry}>
              Reintentar
            </button>
          </div>
        ) : null
      }
    >
      {status !== 'error' && <SceneBase room={ROOMS.SOCIAL_ROOM} attempt={attempt} priority="low" />}
      {/* Veleros ambientales de la bahía del ventanal (Anexo A), en pausa cuando el salón no está a la vista */}
      {status === 'ok' && <BaySailboats roomId="SOCIAL_ROOM" sea={ROOMS.SOCIAL_ROOM.sea} active={active} reducedMotion={reducedMotion} />}
    </SceneStage>
  );
}
