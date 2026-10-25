// Avatar del lector (SPEC §25.3): el MISMO componente en reseñas (40 px), listados (48 px), perfil (96 px) y
// sillones (44–64 px según el ancho). Los retratos ya traen su marco dorado: no se añade otro borde. Sin avatar
// elegido, un medallón de papel con la inicial del alias (nunca una imagen generada ni una foto arbitraria).
import { avatarById } from '../../domain/avatars';

export function ReaderAvatar({ avatarId, alias = '', size = 'list', className = '', decorative = false }) {
  const avatar = avatarById(avatarId);
  const label = decorative ? undefined : alias ? `Avatar de ${alias}` : avatar?.label;
  return (
    <span className={`reader-avatar ${className}`} data-size={size} role={decorative ? undefined : 'img'} aria-label={label} aria-hidden={decorative || undefined}>
      {avatar ? (
        <img src={avatar.image} alt="" width="256" height="256" loading="lazy" decoding="async" draggable={false} />
      ) : (
        <span className="reader-avatar__initial" aria-hidden="true">
          {(alias.trim()[0] ?? '·').toUpperCase()}
        </span>
      )}
    </span>
  );
}
