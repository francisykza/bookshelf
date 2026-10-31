// SOCIAL_ROOM (SPEC §16.1 y §25.9): la ilustración del salón en su escenario cover con sus objetos de comunidad
// (tablet, cuadro del club, sillones con quien lee de verdad ahora y Guardián en el reposabrazos), anclados al
// mapa de la escena. Si la imagen falla, se dice y se puede reintentar; el regreso a MAIN_ROOM sigue disponible.
import { ROOMS } from '../../scene/sceneMap';
import { SocialSeats } from '../../features/social/components/SocialSeats';
import { BaySailboats } from './BaySailboats';
import { SceneBase } from './SceneBase';
import { SceneStage } from './SceneStage';

export function SocialRoom({ status, onRetry, attempt = 0, active = false, reducedMotion = false, timer, onOpenHub, onOpenReader, onVisit, onOpenGuardian, onOpenRadio }) {
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
      {status === 'ok' && <BaySailboats roomId="SOCIAL_ROOM" sea={ROOMS.SOCIAL_ROOM.sea} active={active} reducedMotion={reducedMotion} src={ROOMS.SOCIAL_ROOM.src} />}
      {status === 'ok' && onOpenHub && <SocialSeats active={active} timer={timer} onOpenHub={onOpenHub} onOpenReader={onOpenReader} onVisit={onVisit} onOpenRadio={onOpenRadio} onOpenGuardian={onOpenGuardian} />}
    </SceneStage>
  );
}
