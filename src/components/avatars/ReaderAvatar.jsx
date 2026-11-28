// Avatar del lector (SPEC §25.3): el MISMO componente en reseñas (40 px), listados (48 px), perfil (96 px) y
// sillones (44–64 px según el ancho). Sin avatar elegido, un medallón de papel con la inicial del alias (nunca una imagen
// generada ni una foto arbitraria).
// 1.165 (bloque 3 de docs/qa/comunidad-visita.md): con `userId`, el retrato es el busto de su personaje en un marco de píxel;
// sin personaje, Libo asomándose. Sin la migración de los personajes, los retratos ilustrados de antes.
import { useEffect, useState } from 'react';
import { avatarById } from '../../domain/avatars';
import { RETRATO_LIBO, bustoDe, pedirPersonaje, personajeSabido, retratosAntiguos } from '../../features/social/retratos';

function useRetrato(userId) {
  const inicial = () => {
    if (!userId || retratosAntiguos()) return { tipo: 'antiguo' };
    const sabido = personajeSabido(userId);
    if (sabido === null) return { tipo: 'libo' };
    return { tipo: 'cargando' };
  };
  const [retrato, setRetrato] = useState(inicial);
  useEffect(() => {
    if (!userId) return undefined;
    let vivo = true;
    pedirPersonaje(userId).then(async (personaje) => {
      if (!vivo) return;
      if (retratosAntiguos()) return setRetrato({ tipo: 'antiguo' });
      if (!personaje) return setRetrato({ tipo: 'libo' });
      try {
        const src = await bustoDe(personaje);
        if (vivo) setRetrato({ tipo: 'personaje', src });
      } catch {
        if (vivo) setRetrato({ tipo: 'libo' });
      }
    });
    return () => {
      vivo = false;
    };
  }, [userId]);
  return retrato;
}

export function ReaderAvatar({ userId = null, avatarId, alias = '', size = 'list', className = '', decorative = false }) {
  const retrato = useRetrato(userId);
  const avatar = avatarById(avatarId);
  const label = decorative ? undefined : alias ? `Avatar de ${alias}` : avatar?.label;
  const inicial = (
    <span className="reader-avatar__initial" aria-hidden="true">
      {(alias.trim()[0] ?? '·').toUpperCase()}
    </span>
  );
  let dentro;
  if (retrato.tipo === 'personaje') dentro = <img src={retrato.src} alt="" width="96" height="96" decoding="async" draggable={false} />;
  else if (retrato.tipo === 'libo') dentro = <img src={RETRATO_LIBO} alt="" width="420" height="400" loading="lazy" decoding="async" draggable={false} />;
  else if (retrato.tipo === 'cargando') dentro = inicial;
  else dentro = avatar ? <img src={avatar.image} alt="" width="256" height="256" loading="lazy" decoding="async" draggable={false} /> : inicial;
  return (
    <span className={`reader-avatar ${className}`} data-size={size} data-retrato={retrato.tipo} role={decorative ? undefined : 'img'} aria-label={label} aria-hidden={decorative || undefined}>
      {dentro}
    </span>
  );
}
