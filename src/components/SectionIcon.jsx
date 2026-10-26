// Iconos ilustrados de sección (docs/design/ordenador-recursos.md): un solo componente carga las imágenes
// suministradas, sin recolorear ni redibujar. Ya traen su baldosa marfil: no se envuelven en otra. Decorativos por
// defecto (el nombre accesible lo lleva el control que los contiene); `label` los convierte en imagen con nombre.
export const SECTION_ICONS = ['diario', 'datos', 'sesiones', 'reto', 'misiones', 'citas', 'biblioteca', 'coleccion', 'sagas', 'comunidad', 'club', 'encuentros', 'resenas', 'notas'];

export function SectionIcon({ name, size = 32, label, className = '' }) {
  return (
    <img
      className={`section-icon ${className}`.trim()}
      src={`/assets/icons/sections/${name}.webp`}
      width={size}
      height={size}
      alt={label ?? ''}
      aria-hidden={label ? undefined : 'true'}
      draggable={false}
      decoding="async"
    />
  );
}
